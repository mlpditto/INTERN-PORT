/* 🥣 Cereal Killer, Phase 1½ PR 1 (not loaded by the page yet — PR 2 wires it in): the bot (pure, no DOM, no Firebase). Owner 2026-11-20: "เพิ่มโหมดเล่นกับบอทได้ด้วย".
   Runs in the page (window.CerealBot) and in node (scripts/cereal-bot-check.cjs). Needs cereal-rules.js (window.CerealRules / require).

   PUBLIC history (what the detective is allowed to know) — the only thing the bot detective reads:
     pub = { day, detectivePos, arrestsLeft, usedQuestions: [q], skipUsed, kills, cereals: [ids], witness,
             days: [{ day, det: detective cell while the killer moved (null on day 1), kill: id|null, witness: id|null,
                      asks: [{ q, ans }], misses: [ids] }] }
   The bot killer also reads its own secret: { pos (null before day 1), home }.

   Levels 🥄 1 · 🥄🥄 2 · 🥄🥄🥄 3:
     detective 1 = random card, arrests when ≤ 3 candidates and one is in reach · 2 = card that splits the candidates most evenly
                   (entropy), arrests when half the suspects are in reach (a third from day 5 with arrests to spare, anything on day 7)
                   · 3 = as 2, and moves to keep more suspects within arrest reach
     killer    1 = greedy: any legal kill, random · 2 = scores how many cells the detective could still suspect, distance from the
                   detective, a far witness park, a fresh house in reach tomorrow, keeps the quiet day for an emergency · 3 = leans harder on hiding */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cereal-rules.js'));
  else root.CerealBot = factory(root.CerealRules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  if (!R) throw new Error('cereal-bot.js needs cereal-rules.js first');

  // ---- seeded random ---------------------------------------------------------------------------------
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (arr, rand) => arr[Math.floor((rand || Math.random)() * arr.length)];

  // ---- memo (per board object: paths and distances are asked thousands of times a game) ----------------
  const memo = new WeakMap();
  function mm(map) { let m = memo.get(map); if (!m) { m = { paths: new Map(), dist: new Map() }; memo.set(map, m); } return m; }
  function paths3(map, from, blocked) {
    const m = mm(map), key = from + '|' + blocked.join(',');
    let v = m.paths.get(key); if (!v) { v = R.legalPaths(map, from, R.STEPS.killer, { canRide: true, blocked }); m.paths.set(key, v); }
    return v;
  }
  function dist(map, a, b) {
    const m = mm(map), key = a * 1000 + b;
    let v = m.dist.get(key); if (v == null) { v = R.distance(map, a, b, { canRide: true }); if (v < 0) v = 9; m.dist.set(key, v); }
    return v;
  }

  // ---- deduction ------------------------------------------------------------------------------------
  /** The answer the app would give for a killer on `cell` (the less telling one when two compass directions are true). */
  function publicAnswer(map, q, cell, witness) {
    const a = R.answer(map, q, cell, witness);
    return a.length > 1 ? R.leastInformative(map, witness, a) : a[0];
  }
  /** Ends of every legal killer day from `starts`, given that day's public facts. */
  function stepDay(map, starts, d) {
    const out = new Set(), blocked = d.det != null ? [d.det] : [];
    for (const s of starts) {
      for (const p of paths3(map, s, blocked)) {
        const end = p[p.length - 1];
        if (d.kill != null && !p.includes(d.kill)) continue;
        if (d.witness != null && end === d.witness) continue;
        out.add(end);
      }
    }
    return out;
  }
  function applyClues(map, set, d) {
    let s = [...set];
    for (const a of d.asks || []) s = s.filter(c => publicAnswer(map, a.q, c, d.witness) === a.ans);
    for (const m of d.misses || []) s = s.filter(c => c !== m);
    return new Set(s);
  }
  /** Every cell the killer can be on now, from public facts only. Always contains the truth (cereal-bot-check proves it). */
  function candidates(map, pub) {
    let set = null;
    for (const d of pub.days) {
      const starts = set == null ? R.killerHomeOptions(map) : [...set];
      set = applyClues(map, stepDay(map, starts, d), d);
    }
    return set == null ? new Set(R.killerHomeOptions(map)) : set;
  }

  // ---- detective -------------------------------------------------------------------------------------
  /** Every detective path from `from` (≤ 3 steps, +1 through a café), shortest per end cell. */
  function detectivePaths(map, from) {
    const best = new Map(), max = R.STEPS.detective + 1;
    (function walk(path) {
      if (R.validateDetectivePath(map, path).ok) { const e = path[path.length - 1]; if (!best.has(e) || best.get(e).length > path.length) best.set(e, path); }
      if (path.length - 1 >= max) return;
      for (const t of R.stepTargets(map, path[path.length - 1], { canRide: true })) walk(path.concat(t));
    })([from]);
    return [...best.values()];
  }
  const reachOf = (map, cell, cands) => cands.filter(c => R.arrestValid(map, cell, c)).length;
  function meanDist(map, cell, cands) {
    if (!cands.length) return 0;
    let s = 0; for (const c of cands) s += dist(map, cell, c); return s / cands.length;
  }
  function moveScore(map, end, cands, pub, level) {
    const askable = pub.witness != null && R.QUESTIONS.some(q => q !== 'area' && !pub.usedQuestions.includes(q)) && R.canQuestion(map, end, pub.witness);
    return (askable ? 100 : 0) + (level >= 3 ? 14 : 10) * reachOf(map, end, cands) - meanDist(map, end, cands);
  }
  /** Where to start (day 1) and how to walk. Returns { start: café|null, path }. */
  function detectiveMove(map, pub, level, rand) {
    const cands = [...candidates(map, pub)];
    let start = null, from = pub.detectivePos;
    if (from == null) {
      const cafes = R.detectiveStartOptions(map);
      start = cafes.map(c => ({ c, s: Math.max(...detectivePaths(map, c).map(p => moveScore(map, p[p.length - 1], cands, pub, level))) }))
        .sort((a, b) => b.s - a.s || a.c - b.c)[0].c;
      if (level === 1) start = pick(cafes, rand);
      from = start;
    }
    const scored = detectivePaths(map, from).map(p => ({ p, s: moveScore(map, p[p.length - 1], cands, pub, level) })).sort((a, b) => b.s - a.s || a.p.length - b.p.length);
    const path = level === 1 ? pick(scored.slice(0, 3), rand).p : scored[0].p;
    return { start, path };
  }
  function entropy(map, q, cands, witness) {
    const n = {}; for (const c of cands) { const a = publicAnswer(map, q, c, witness); n[a] = (n[a] || 0) + 1; }
    let h = 0; for (const k in n) { const p = n[k] / cands.length; h -= p * Math.log2(p); } return h;
  }
  /** Which card to ask from `cell` (null = none possible). */
  function detectiveAsk(map, pub, level, rand, cell) {
    if (pub.witness == null || !R.canQuestion(map, cell, pub.witness)) return null;
    const open = R.QUESTIONS.filter(q => q !== 'area' && !pub.usedQuestions.includes(q));
    if (!open.length) return null;
    if (level === 1) return pick(open, rand);
    const cands = [...candidates(map, pub)];
    return open.map(q => ({ q, h: entropy(map, q, cands, pub.witness) })).sort((a, b) => b.h - a.h || open.indexOf(a.q) - open.indexOf(b.q))[0].q;
  }
  /** Arrest target from `cell`, or null to end the turn quietly. 🥄: only when ≤ 3 cells are left. 🥄🥄 / 🥄🥄🥄: when enough of
   *  the suspects stand within reach for the arrests and days left (any chance at all on day 7). */
  function detectiveArrest(map, pub, level, rand, cell) {
    const cands = [...candidates(map, pub)], inReach = cands.filter(c => R.arrestValid(map, cell, c));
    if (!inReach.length) return null;
    const frac = inReach.length / cands.length, daysLeft = R.DAYS - pub.day;
    let go;
    if (level === 1) go = cands.length <= 3;
    else if (pub.day >= R.DAYS) go = true;
    else go = frac >= 0.5 || (pub.day >= 5 && frac >= 1 / 3 && pub.arrestsLeft > Math.max(1, daysLeft - 1));
    if (!go) return null;
    return level === 1 ? pick(inReach, rand) : inReach.sort((a, b) => a - b)[0];
  }

  // ---- killer ------------------------------------------------------------------------------------------
  function killerOptions(map, pub, me) {
    const out = [], blocked = pub.detectivePos != null ? [pub.detectivePos] : [];
    const homes = me.pos == null ? R.killerHomeOptions(map) : [me.pos];
    for (const home of homes) for (const path of paths3(map, home, blocked)) {
      const kills = R.killOptions(map, path, pub.cereals);
      const tries = kills.map(k => ({ kill: k })); if (!pub.skipUsed) tries.push({ kill: null });
      for (const t of tries) {
        const parks = t.kill != null ? R.witnessOptions(map, t.kill) : [];
        for (const w of (parks.length ? parks : [null])) {
          const v = R.validateKillerTurn(map, { path, kill: t.kill, witness: w }, { blocked, taken: pub.cereals, kills: pub.kills, skipUsed: pub.skipUsed });
          if (v.ok && R.calendarOk(pub.day, v.kills)) out.push({ home: me.pos == null ? home : null, path, kill: t.kill, witness: w, kills: v.kills });
        }
      }
    }
    return out;
  }
  /** Fresh houses the killer could still touch tomorrow from `end` (any legal 3-step path). */
  function freshReach(map, end, taken) {
    const seen = new Set();
    for (const p of paths3(map, end, [])) for (const id of p) if (R.type(map, id) === R.T.HOUSE && !taken.includes(id)) seen.add(id);
    return seen.size;
  }
  /** Cells the detective can end on today (all cafés' reach on day 1). */
  function detectiveEnds(map, det) {
    const froms = det != null ? [det] : R.detectiveStartOptions(map), out = new Set();
    for (const f of froms) for (const p of detectivePaths(map, f)) out.add(p[p.length - 1]);
    return [...out];
  }
  function killerScore(map, pub, o, level, ctx) {
    const end = o.path[o.path.length - 1];
    const left = R.DAYS - pub.day, need = R.MAX_KILLS - o.kills;
    if (need > left) return -1e6 + o.kills;                        // can no longer reach 6
    const taken = o.kill != null ? pub.cereals.concat(o.kill) : pub.cereals;
    // what the detective could still suspect after today — the heart of hiding
    const d = { day: pub.day, det: pub.detectivePos, kill: o.kill, witness: o.witness, asks: [], misses: [] };
    const after = [...stepDay(map, ctx.starts, d)];
    let s = 3 * Math.log2(1 + after.length);
    if (o.witness != null) s += 1.5 * Math.min(dist(map, o.witness, end), 6);   // the detective walks to the witness to ask
    // risk: can the detective end today with this cell in arrest reach?
    if (level >= 3) {
      const tmp = { day: pub.day, detectivePos: pub.detectivePos, witness: o.witness, usedQuestions: pub.usedQuestions };
      let bestE = null, bs = -Infinity;
      for (const e of ctx.ends) { const sc = moveScore(map, e, after, tmp, 2); if (sc > bs) { bs = sc; bestE = e; } }
      if (bestE != null && R.arrestValid(map, bestE, end)) s -= 30;
      else if (ctx.ends.some(e => R.arrestValid(map, e, end))) s -= 6;
    } else if (ctx.ends.some(e => R.arrestValid(map, e, end))) s -= 12;
    if (o.kill == null) s -= (need === left ? 0 : 8);             // keep the quiet day for an emergency
    if (need > 0) { const fr = freshReach(map, end, taken); s += fr === 0 ? -60 : Math.min(fr, 4) * 1.5; }
    return s;
  }
  /** One killer day: { home (day 1 only), path, kill, witness }, or null when cornered / no legal turn. */
  function killerTurn(map, pub, me, level, rand) {
    const opts = killerOptions(map, pub, me);
    if (!opts.length) return null;
    if (level === 1) { const k = opts.filter(o => o.kill != null); return pick(k.length ? k : opts, rand); }
    const ctx = { starts: pub.days.length ? [...candidates(map, pub)] : R.killerHomeOptions(map), ends: detectiveEnds(map, pub.detectivePos) };
    let best = null, bs = -Infinity;
    for (const o of opts) { const s = killerScore(map, pub, o, level, ctx) + (rand ? rand() * 0.5 : 0); if (s > bs) { bs = s; best = o; } }
    return best;
  }

  return { rng, publicAnswer, candidates, stepDay, detectivePaths, detectiveMove, detectiveAsk, detectiveArrest, killerOptions, killerTurn, LEVELS: [1, 2, 3] };
});
