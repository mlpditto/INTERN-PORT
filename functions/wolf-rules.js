/* 🐺 Werewolf — rules engine (Phase 0, 2026-11-23). Not used by any function yet.
   Pure functions: no Telegram, no Firebase, no state of its own. Phase 1–2 (the wolfBot webhook + wolfTick clock) call
   these inside a transaction, the same way cerealAct calls cereal-rules.js. Plan: docs/WEREWOLF-PLAN.md §3.
   Players are ids (Telegram user ids as strings). Roles: wolf 🐺 · seer 🔮 · guard 🛡️ · witch 🧪 · villager 👤.
   Every random choice takes rng (a () => [0, 1) function) so the check script can replay a game exactly. */
'use strict';

const ROLES = ['wolf', 'seer', 'guard', 'witch', 'villager'];
const EMOJI = { wolf: '🐺', seer: '🔮', guard: '🛡️', witch: '🧪', villager: '👤' };
const MIN_PLAYERS = 5, MAX_PLAYERS = 10;
const NIGHT_SEC = 90, VOTE_SEC = 60, TALK_SEC = [120, 180, 300], TALK_DEFAULT = 180;
// The default deck per player count (plan §3): [wolf, seer, guard, witch, villager]
const DECKS = {
  5: [1, 1, 1, 0, 2], 6: [2, 1, 1, 0, 2], 7: [2, 1, 1, 1, 2],
  8: [2, 1, 1, 1, 3], 9: [3, 1, 1, 1, 3], 10: [3, 1, 1, 1, 4],
};

/** The default role counts for n players, e.g. { wolf: 1, seer: 1, guard: 1, witch: 0, villager: 2 }. */
function defaultCounts(n) {
  const d = DECKS[n];
  if (!d) throw new Error('players must be ' + MIN_PLAYERS + '–' + MAX_PLAYERS + ', got ' + n);
  const out = {};
  ROLES.forEach((r, i) => { out[r] = d[i]; });
  return out;
}

/** null when the host's counts are playable for n players, else a reason code. */
function countsError(counts, n) {
  if (!(n >= MIN_PLAYERS && n <= MAX_PLAYERS)) return 'players';
  let sum = 0;
  for (const k of Object.keys(counts)) {
    if (!ROLES.includes(k)) return 'role';
    const v = counts[k];
    if (!Number.isInteger(v) || v < 0) return 'count';
    sum += v;
  }
  if (sum !== n) return 'sum';
  const w = counts.wolf || 0;
  if (w < 1) return 'no-wolf';
  if (w * 2 >= n) return 'too-many-wolves';   // wolves would win before the first morning
  for (const r of ['seer', 'guard', 'witch']) if ((counts[r] || 0) > 1) return 'one-' + r;
  return null;
}

/** Shuffle the deck onto the players: { id: role }. */
function deal(ids, counts, rng) {
  rng = rng || Math.random;
  const err = countsError(counts, ids.length);
  if (err) throw new Error('bad counts: ' + err);
  const deck = [];
  ROLES.forEach((r) => { for (let i = 0; i < (counts[r] || 0); i++) deck.push(r); });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const out = {};
  ids.forEach((id, i) => { out[id] = deck[i]; });
  return out;
}

const aliveIds = (alive) => Object.keys(alive).filter((id) => alive[id]);
const withRole = (roles, alive, role) => aliveIds(alive).filter((id) => roles[id] === role);

/** Fresh secret state for a game: roles + the witch's two potions + who the guard covered last night. */
function newState(roles) {
  const alive = {};
  Object.keys(roles).forEach((id) => { alive[id] = true; });
  return { roles, alive, witch: { heal: true, poison: true }, lastGuard: null, night: 1 };
}

/** Who still has to press a button tonight: { id: kind }. Villagers sleep. The witch acts after the wolves. */
function nightTurns(state) {
  const out = {};
  for (const id of aliveIds(state.alive)) {
    const r = state.roles[id];
    if (r === 'wolf' || r === 'seer' || r === 'guard') out[id] = r;
    else if (r === 'witch' && (state.witch.heal || state.witch.poison)) out[id] = 'witch';
  }
  return out;
}

/** null when actor may make this pick, else a reason code.
 *  kind: 'wolf' | 'seer' | 'guard' | 'heal' | 'poison'; target: a player id (heal takes the bitten id). */
function pickError(state, actor, kind, target) {
  if (!state.alive[actor]) return 'dead';
  const role = state.roles[actor];
  const need = (kind === 'heal' || kind === 'poison') ? 'witch' : kind;
  if (role !== need) return 'not-your-role';
  if (!(target in state.alive)) return 'no-player';
  if (!state.alive[target]) return 'target-dead';
  if (kind === 'wolf' && state.roles[target] === 'wolf') return 'target-wolf';
  if (kind === 'seer' && target === actor) return 'self';
  if (kind === 'guard' && target === state.lastGuard) return 'guard-repeat';
  if (kind === 'heal' && !state.witch.heal) return 'used';
  if (kind === 'poison' && !state.witch.poison) return 'used';
  if (kind === 'poison' && target === actor) return 'self';
  return null;
}

/** The wolves' victim from their votes { wolfId: targetId }: most votes; a tie is broken by rng; no votes = nobody. */
function wolfTarget(votes, rng) {
  rng = rng || Math.random;
  const n = {};
  Object.values(votes || {}).forEach((t) => { if (t) n[t] = (n[t] || 0) + 1; });
  const ids = Object.keys(n);
  if (!ids.length) return null;
  const top = Math.max(...ids.map((t) => n[t]));
  const tied = ids.filter((t) => n[t] === top).sort();
  return tied[Math.floor(rng() * tied.length)];
}

/** Resolve the night. picks = { bite, guard, seer, heal (bool), poison } — ids or null, already checked by pickError
 *  (bite = wolfTarget(...)). Order (plan §3): guard → heal → bite → poison. The guard does not stop poison.
 *  Returns { state (the next night's), dead: [ids], seen: { id, wolf } | null } and never mutates its input. */
function resolveNight(state, picks) {
  const p = picks || {};
  const next = JSON.parse(JSON.stringify(state));
  const dead = [];
  const bite = p.bite || null;
  const saved = bite && (p.guard === bite || p.heal === true);
  if (p.heal === true && bite) next.witch.heal = false;
  if (bite && !saved) dead.push(bite);
  if (p.poison) {
    next.witch.poison = false;
    if (!dead.includes(p.poison)) dead.push(p.poison);
  }
  dead.forEach((id) => { next.alive[id] = false; });
  next.lastGuard = p.guard || null;
  next.night = state.night + 1;
  const seen = p.seer ? { id: p.seer, wolf: state.roles[p.seer] === 'wolf' } : null;
  return { state: next, dead, seen };
}

/** Count the secret day vote { voter: targetId | 'skip' } (dead voters and votes for the dead are ignored).
 *  The top target is out only when it beats every other target AND the skips; any tie = nobody leaves.
 *  Returns { counts: { id|'skip': n }, out: id | null }. */
function tallyVotes(state, votes) {
  const counts = {};
  for (const [voter, t] of Object.entries(votes || {})) {
    if (!state.alive[voter]) continue;
    if (t !== 'skip' && !state.alive[t]) continue;
    counts[t] = (counts[t] || 0) + 1;
  }
  const keys = Object.keys(counts);
  if (!keys.length) return { counts, out: null };
  const top = Math.max(...keys.map((k) => counts[k]));
  const best = keys.filter((k) => counts[k] === top);
  const out = best.length === 1 && best[0] !== 'skip' ? best[0] : null;
  return { counts, out };
}

/** Remove the voted-out player (or nobody). Returns a new state. */
function eliminate(state, id) {
  const next = JSON.parse(JSON.stringify(state));
  if (id) next.alive[id] = false;
  return next;
}

/** 'village' when no wolf is alive, 'wolf' when wolves are at least everyone else alive, else null. */
function winner(state) {
  const live = aliveIds(state.alive);
  const w = live.filter((id) => state.roles[id] === 'wolf').length;
  if (w === 0) return 'village';
  if (w >= live.length - w) return 'wolf';
  return null;
}

module.exports = {
  ROLES, EMOJI, MIN_PLAYERS, MAX_PLAYERS, NIGHT_SEC, VOTE_SEC, TALK_SEC, TALK_DEFAULT, DECKS,
  defaultCounts, countsError, deal, newState, nightTurns, pickError, wolfTarget, resolveNight,
  tallyVotes, eliminate, winner, aliveIds, withRole,
};
