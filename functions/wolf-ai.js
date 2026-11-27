/* V101.353 🐺 Werewolf solo — the bots' brain (owner pick B, mockup-werewolf-solo/). Pure functions over a solo game object
   (public/wolf.js builds it): no DOM, no storage. Runs in the page (window.WolfAI) and in node for scripts/wolf-ai-check.cjs.
   Game fields read here: ids, me, level (1–3 🥄), day, st (wolf-rules.js state), checks { seerId: { id: isWolf } },
   claims [{ by, day, t, wolf, fake }], said [{ day, by, k: 'sus'|'trust', t, soft }], votes [{ day, by, t }].
   A bot never peeks at a role it could not know: its own, its wolf mates', its own 🔮 checks, and the roles of the dead
   (the solo game shows a role when its player dies). Noise per (bot, target, day) comes from a hash, so a bot's 🤨 tag and its
   vote agree with each other within a day, and a replay gives the same game. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WolfAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NOISE = { 1: 4, 2: 1.5, 3: 0.8 };

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function alive(g) { return g.ids.filter(function (id) { return g.st.alive[id]; }); }
  function role(g, id) { return g.st.roles[id]; }
  function dead(g, id) { return !g.st.alive[id]; }
  // 2026-11-27 (🎲 😈 🃏 🧱): the 😈 minion is wolf-side without being a wolf — it knows the wolves (never accuses or votes one), the
  // wolves do not know it; a 🧱 mason trusts the other mason like a 🔮 check; a 🃏 jester says nothing and skips every vote.
  function evil(g, id) { var r = role(g, id); return r === 'wolf' || r === 'minion'; }
  function isBot(g, id) { return g.bots ? g.bots.indexOf(id) >= 0 : id !== g.me; }   // Telegram (2026-11-26): g.bots lists the bot seats; solo: everyone but me
  function argmax(m, ids) { var best = null; ids.forEach(function (id) { if (best === null || m[id] > m[best]) best = id; }); return best; }
  function argmin(m, ids) { var best = null; ids.forEach(function (id) { if (best === null || m[id] < m[best]) best = id; }); return best; }
  function noise(g, b, t) { return (hash(g.id + '|' + b + '|' + t + '|' + g.day) - 0.5) * 2 * (NOISE[g.level] || 1.5); }
  function claimers(g) { var out = []; g.claims.forEach(function (c) { if (out.indexOf(c.by) < 0) out.push(c.by); }); return out; }

  /** How much a village-side bot b suspects each other living player: { id: score }, higher = more wolf-like. */
  function sus(g, b) {
    var out = {}, me = role(g, b), others = alive(g).filter(function (id) { return id !== b; });
    var mine = (g.checks && g.checks[b]) || {};
    // seer claimants b still believes: the real seer believes nobody else; a dead claimant shown not to be 🔮 is a liar
    var cl = claimers(g).filter(function (p) {
      if (p === b) return false;
      if (me === 'seer') return false;
      if (dead(g, p) && role(g, p) !== 'seer') return false;
      return true;
    });
    var cred = cl.length ? 1 / cl.length : 0;
    others.forEach(function (t) {
      var s = noise(g, b, t);
      if (t in mine) s += mine[t] ? 50 : -50;
      if (me === 'mason' && role(g, t) === 'mason') s -= 50;   // 🧱 the pair know each other
      if (me === 'seer' && claimers(g).indexOf(t) >= 0) s += 50;          // only I am the seer: any other claimant lies
      if (cl.length > 1 && cl.indexOf(t) >= 0) s += 3;                    // two seers: one of them is lying
      out[t] = s;
    });
    g.claims.forEach(function (c) {
      if (cl.indexOf(c.by) < 0 || !(c.t in out)) return;
      out[c.t] += c.wolf ? 8 * cred : -5 * cred;
    });
    g.said.forEach(function (x) {
      if (x.by === b) return;
      if (x.t === b && x.k === 'sus' && g.level >= 2 && x.by in out) out[x.by] += 2;   // I know I am innocent
      if (!(x.t in out)) return;
      out[x.t] += (x.k === 'sus' ? 1 : -0.5) * (x.soft ? 0.3 : 1);   // a hunch (soft) moves the table less
    });
    if (g.level >= 2) g.ids.forEach(function (x) {
      if (!dead(g, x)) return;
      var wasWolf = role(g, x) === 'wolf';
      g.said.forEach(function (s) { if (s.t === x && s.k === 'trust' && wasWolf && s.by in out) out[s.by] += 2; });
      g.claims.forEach(function (c) { if (c.t === x && c.by in out && c.wolf !== wasWolf) out[c.by] += 20; });   // a check the dead disprove
      g.votes.forEach(function (v) { if (v.t === x && v.by in out) out[v.by] += wasWolf ? -1 : 1; });
    });
    return out;
  }
  /** The village bots' average suspicion of each living player — what the table "thinks". Wolves follow it to blend in. */
  function consensus(g) {
    var out = {}, n = {}, vb = alive(g).filter(function (id) { return isBot(g, id) && !evil(g, id) && role(g, id) !== 'jester'; });
    vb.forEach(function (b) { var s = sus(g, b); Object.keys(s).forEach(function (t) { out[t] = (out[t] || 0) + s[t]; n[t] = (n[t] || 0) + 1; }); });
    alive(g).forEach(function (t) { out[t] = n[t] ? out[t] / n[t] : 0; });
    return out;
  }
  /** A wolf bot's wish list among the living non-wolves: the claimed seer and whoever accuses a wolf first. */
  function wolfScore(g, b) {
    var out = {}, cl = claimers(g), con = consensus(g);
    alive(g).forEach(function (t) {
      if (role(g, t) === 'wolf') return;
      var s = noise(g, b, t);
      if (cl.indexOf(t) >= 0) s += g.level >= 2 ? 6 : 2;
      g.said.forEach(function (x) { if (x.by === t && x.k === 'sus' && role(g, x.t) === 'wolf' && !dead(g, x.t)) s += 2; });
      g.claims.forEach(function (c) { if (c.by === t && c.wolf && role(g, c.t) === 'wolf') s += 4; });
      out[t] = s - (con[t] || 0) * 0.3;   // trusted players are the dangerous ones
    });
    return out;
  }

  // ---- night --------------------------------------------------------------------------------------------
  /** The wolf bots' votes for tonight's bite { wolfId: targetId }. */
  function wolfVotes(g, rng) {
    var out = {}, prey = alive(g).filter(function (t) { return role(g, t) !== 'wolf'; });
    alive(g).forEach(function (b) {
      if (!isBot(g, b) || role(g, b) !== 'wolf' || !prey.length) return;
      out[b] = g.level === 1 ? prey[Math.floor(rng() * prey.length)] : argmax(wolfScore(g, b), prey);
    });
    return out;
  }
  function seerPick(g, b, rng) {
    var done = (g.checks && g.checks[b]) || {}, c = alive(g).filter(function (t) { return t !== b && !(t in done); });
    if (!c.length) return null;
    if (g.level === 1) return c[Math.floor(rng() * c.length)];
    return argmax(sus(g, b), c);
  }
  function guardPick(g, b, rng) {
    var c = alive(g).filter(function (t) { return t !== g.st.lastGuard; });
    if (!c.length) return null;
    if (g.level >= 2) {
      var s = sus(g, b), seer = claimers(g).filter(function (p) { return c.indexOf(p) >= 0 && p !== b && s[p] < 5; })[0];
      if (seer) return seer;
      if (c.indexOf(b) >= 0 && rng() < 0.3) return b;
    }
    return c[Math.floor(rng() * c.length)];
  }
  /** The witch bot after the bite is known: { heal: bool, poison: id|null }. */
  function witchPick(g, b, bite, rng) {
    var w = g.st.witch, out = { heal: false, poison: null };
    if (w.heal && bite && (bite === b || (g.level >= 2 && claimers(g).indexOf(bite) >= 0) || rng() < 0.5)) out.heal = true;
    if (w.poison && g.level >= 2) {
      var s = sus(g, b), c = alive(g).filter(function (t) { return t !== b && t !== bite; }), top = argmax(s, c);
      if (top && s[top] >= 8) out.poison = top;
    }
    return out;
  }

  // ---- day ----------------------------------------------------------------------------------------------
  /** What each living bot says today: { tags: { id: { k: 'sus'|'trust'|'claim'|'quiet', t, wolf } }, claims: [new claims] }.
   *  A bot claims at most once per day; call again after the player speaks and the bots re-read the table. */
  function talk(g) {
    var tags = {}, claims = [], today = function (b) { return g.claims.some(function (c) { return c.by === b && c.day === g.day; }); };
    var fakedBefore = g.claims.some(function (c) { return c.fake && isBot(g, c.by); });
    var con = consensus(g);
    alive(g).forEach(function (b) {
      if (!isBot(g, b)) return;
      var r = role(g, b), c = null;
      var old = g.claims.filter(function (x) { return x.by === b; });
      if (today(b)) { var t0 = old[old.length - 1]; tags[b] = { k: 'claim', t: t0.t, wolf: t0.wolf }; return; }
      if (r === 'jester') { tags[b] = { k: 'quiet' }; return; }   // 🃏 never defends itself
      if (r === 'seer') {
        var mine = (g.checks && g.checks[b]) || {}, told = old.map(function (x) { return x.t; });
        var fresh = Object.keys(mine).filter(function (t) { return told.indexOf(t) < 0; });
        var hit = fresh.filter(function (t) { return mine[t] && !dead(g, t); })[0];
        var pick = hit || ((old.length || g.level >= 2) ? fresh[fresh.length - 1] : null);   // V101.356: 🥄🥄+ claims from day 1
        if (pick) c = { by: b, day: g.day, t: pick, wolf: !!mine[pick], fake: false };
      } else if (r === 'wolf' && g.level >= 2 && (old.length || !fakedBefore)) {
        var accuser = g.claims.filter(function (x) { return x.wolf && role(g, x.t) === 'wolf' && !dead(g, x.by) && x.by !== b; })[0];
        var good = alive(g).filter(function (t) { return role(g, t) !== 'wolf'; });
        if (old.length) {   // a fake seer keeps the story going: clears a mate, or names a villager
          var mate = alive(g).filter(function (t) { return t !== b && role(g, t) === 'wolf' && !old.some(function (x) { return x.t === t; }); })[0];
          var t1 = mate || argmax(con, good.filter(function (t) { return !old.some(function (x) { return x.t === t; }); }));
          if (t1) c = { by: b, day: g.day, t: t1, wolf: !mate, fake: true };
        } else if (accuser && !dead(g, accuser)) c = { by: b, day: g.day, t: accuser, wolf: true, fake: true };
        else if (g.level === 3 && g.day >= 2 && !g.claims.length && hash(g.id + b + 'fake') < 0.5) {
          var t2 = argmax(con, good.filter(function (t) { return t !== g.me || hash(g.id + 'me') < 0.5; }));
          if (t2) c = { by: b, day: g.day, t: t2, wolf: true, fake: true };
        }
        if (c && !old.length) fakedBefore = true;
      }
      if (c) { claims.push(c); tags[b] = { k: 'claim', t: c.t, wolf: c.wolf }; return; }
      var ids = alive(g).filter(function (t) { return t !== b; });
      var m = evil(g, b) ? (function () { var o = {}; ids.forEach(function (t) { o[t] = role(g, t) === 'wolf' ? -99 : (con[t] || 0) + noise(g, b, t); }); return o; })() : sus(g, b);
      var hi = argmax(m, ids), lo = argmin(m, ids);
      // a low bar to speak (day 1 has only noise to go on), a higher one to vote (votes() needs ≥ 1)
      // V101.356 (owner's playthrough): day 1 has only noise — a bot speaks only on a strong hunch (90 % of its level's noise), so about
      // a quarter accuse, a quarter say 👍, the rest stay quiet, instead of a wall of red 🤨
      var bar = g.day === 1 ? (NOISE[g.level] || 1.5) * 0.9 : 0.4;
      if (hi && m[hi] >= bar) tags[b] = { k: 'sus', t: hi, soft: m[hi] < 1 };
      else if (lo && m[lo] <= -bar && !evil(g, b)) tags[b] = { k: 'trust', t: lo, soft: m[lo] > -1 };
      else tags[b] = { k: 'quiet' };
    });
    return { tags: tags, claims: claims };
  }
  /** The bots' day votes { botId: targetId | 'skip' }. Wolves pile onto whoever the table suspects most, never a mate. */
  function votes(g) {
    var out = {}, con = consensus(g);
    alive(g).forEach(function (b) {
      if (!isBot(g, b)) return;
      var ids = alive(g).filter(function (t) { return t !== b; });
      if (role(g, b) === 'jester') { out[b] = 'skip'; return; }   // 🃏 wants the votes, casts none
      if (evil(g, b)) {
        var prey = ids.filter(function (t) { return role(g, t) !== 'wolf'; }), m = {};
        prey.forEach(function (t) { m[t] = (con[t] || 0) + noise(g, b, t) * 0.5; });
        out[b] = argmax(m, prey) || 'skip';
        return;
      }
      var s = sus(g, b), hi = argmax(s, ids);
      out[b] = hi && s[hi] >= 1 ? hi : 'skip';
    });
    return out;
  }

  /** 🏹 (2026-11-26, Telegram 🎲 extra role): the dead hunter bot b shoots the living player it suspects most. */
  function hunterPick(g, b) {
    var c = alive(g).filter(function (t) { return t !== b; });
    if (!c.length) return null;
    return g.level === 1 ? c[Math.floor(hash(g.id + b + 'shot') * c.length)] : argmax(sus(g, b), c);
  }
  /** 💘 (2026-11-26, Telegram 🎲 extra role): the cupid bot b pairs two living players at random (itself allowed). */
  function cupidPick(g, b, rng) {
    var c = alive(g).slice(); if (c.length < 2) return null;
    var i = Math.floor(rng() * c.length), a = c.splice(i, 1)[0];
    return [a, c[Math.floor(rng() * c.length)]];
  }
  /** V101.358 (owner pick D on 🌕): why the wolves want t, in a few words — what the day showed (a 🔮 claim, a finger at a wolf,
   *  the table trusting t). null = nothing to say (a first-night guess). */
  function wolfWhy(g, t) {
    if (g.claims.some(function (c) { return c.by === t && c.wolf && role(g, c.t) === 'wolf'; })) return 'ชี้ตัว 🐺';   // named one of us
    if (g.claims.some(function (c) { return c.by === t; })) return 'อ้างเป็น 🔮';
    if (g.said.some(function (x) { return x.by === t && x.k === 'sus' && role(g, x.t) === 'wolf'; })) return 'สงสัย 🐺';
    var con = consensus(g); if ((con[t] || 0) <= -1.5) return 'คนไว้ใจเยอะ';
    return null;
  }
  return { sus: sus, consensus: consensus, wolfScore: wolfScore, wolfVotes: wolfVotes, wolfWhy: wolfWhy, seerPick: seerPick, guardPick: guardPick, witchPick: witchPick, hunterPick: hunterPick, cupidPick: cupidPick, talk: talk, votes: votes, hash: hash };
});
