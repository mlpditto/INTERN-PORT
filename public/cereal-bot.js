/* 🥣 Cereal Killer — bot opponents (Phase 1½, 2026-11-20). Pure functions over cereal-rules.js; no DOM, no Firebase, no state of its
   own except the knowledge object the caller keeps. The same file runs in the page (window.CerealBot) and in node for
   scripts/cereal-bot-check.cjs, which plays hundreds of seeded games through it.

   Detective bot: keeps the set of killer cells consistent with everything public — every house as a possible home, then per day the
   end cells of every legal 3-path that touches that day's cereal house (or any path on a quiet day), filtered by each card's answer
   (modelling that an ambiguous compass answer is the less telling one) and by missed arrests. Moves toward the candidates, asks the
   card that splits the set most evenly, arrests when a single candidate is within reach.
   Killer bot: scores every legal 3-path — a kill when one is possible, distance from the detective, a witness park far from the
   detective, never ending next to the detective when it can help it; keeps the quiet day for when no kill is possible.
   Levels 🥄 1 random card + loose arrests / greedy walk · 🥄🥄 entropy card, arrest at one candidate / scored walk ·
   🥄🥄🥄 also arrests at two late in the game and the killer looks a turn ahead at the detective's reach. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./cereal-rules.js'));
    else root.CerealBot = factory(root.CerealRules);
})(typeof self !== 'undefined' ? self : this, function (R) {
    'use strict';

    var uniq = function (a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); };
    var pick = function (rng, a) { return a[Math.floor(rng() * a.length)]; };
    var sum = function (a) { return a.reduce(function (s, x) { return s + x; }, 0); };

    // ---- what the detective can know ----------------------------------------------------------------------
    function newKnowledge(map) { return { cands: R.killerHomeOptions(map).slice() }; }

    /** After the killer's day: cands = ends of every legal path from a candidate that fits the public result. */
    function observeKillerTurn(map, k, o) {
        var ends = [];
        k.cands.forEach(function (from) {
            R.legalPaths(map, from, R.STEPS.killer, { exact: true, canRide: true, blocked: o.blocked || [] }).forEach(function (p) {
                var end = p[p.length - 1];
                if (o.kill != null) { if (p.indexOf(o.kill) < 0) return; if (o.witness != null && end === o.witness) return; }
                ends.push(end);
            });
        });
        k.cands = uniq(ends);
        return k;
    }
    /** The answer the app gives for a card when the killer stands on `cell` (two true directions → the less telling one). */
    function expectedAnswer(map, q, cell, witness) {
        var a = R.answer(map, q, cell, witness);
        return a.length > 1 ? R.leastInformative(map, witness, a) : a[0];
    }
    function observeAnswer(map, k, q, ans, witness) { k.cands = k.cands.filter(function (c) { return expectedAnswer(map, q, c, witness) === ans; }); return k; }
    function observeArrestMiss(k, cell) { k.cands = k.cands.filter(function (c) { return c !== cell; }); return k; }

    // ---- detective bot ---------------------------------------------------------------------------------------
    /** Every (end, path) the detective can reach this turn from `from` under the real movement rules. */
    function detectiveReach(map, from) {
        var out = [], seen = {};
        (function walk(path) {
            var end = path[path.length - 1];
            if (!seen[end] || seen[end].length > path.length) { seen[end] = path; }
            R.stepTargets(map, end, { canRide: true }).forEach(function (t) {
                var next = path.concat(t);
                if (R.validateDetectivePath(map, next).ok && (!seen[t] || seen[t].length > next.length)) walk(next);
            });
        })([from]);
        Object.keys(seen).forEach(function (id) { out.push({ end: +id, path: seen[id] }); });
        return out;
    }
    function closeness(map, cell, cands) { return cands.length ? -sum(cands.map(function (c) { return R.distance(map, cell, c, { canRide: false }); })) / cands.length : 0; }

    /** Which café to start from: the one closest to the candidates (level 1: any). */
    function detectiveStart(map, k, level, rng) {
        var cafes = R.detectiveStartOptions(map);
        if (level <= 1) return pick(rng, cafes);
        return cafes.slice().sort(function (a, b) { return closeness(map, b, k.cands) - closeness(map, a, k.cands); })[0];
    }
    /** The card that splits the candidates most evenly (level 1: a random unused card). */
    function pickQuestion(map, k, used, witness, level, rng) {
        var cards = R.QUESTIONS.slice(0, 5).filter(function (q) { return used.indexOf(q) < 0; });
        if (!cards.length) return null;
        if (level <= 1) return pick(rng, cards);
        var best = null, bestH = -1;
        cards.forEach(function (q) {
            var buckets = {}; k.cands.forEach(function (c) { var a = expectedAnswer(map, q, c, witness); buckets[a] = (buckets[a] || 0) + 1; });
            var n = k.cands.length, h = 0;
            Object.keys(buckets).forEach(function (a) { var p = buckets[a] / n; h -= p * Math.log(p); });
            if (h > bestH + 1e-9) { bestH = h; best = q; }
        });
        return bestH > 0 ? best : (level >= 3 ? null : best);   // a card that cannot split anything is not worth burning on 🥄🥄🥄
    }
    /** First half of the turn: where to walk, and which card to ask there (null = nothing to ask). st = { pos, witness, usedQuestions }. */
    function detectivePlan(map, st, k, level, rng) {
        var reach = detectiveReach(map, st.pos);
        var askable = st.witness != null ? reach.filter(function (r) { return R.canQuestion(map, r.end, st.witness); }) : [];
        if (level <= 1) {   // 🥄 does not track candidates: half the time it bothers to ask, with a random card
            if (askable.length && rng() < 0.5) { var q1 = pickQuestion(map, k, st.usedQuestions, st.witness, 1, rng); if (q1) return { path: pick(rng, askable).path, q: q1 }; }
            return { path: [st.pos], q: null };
        }
        var q = askable.length ? pickQuestion(map, k, st.usedQuestions, st.witness, level, rng) : null;
        if (q) {
            // stop at the asking cell that still leaves the most steps for afterwards (shortest path), nearest to the candidates
            askable.sort(function (a, b) { return a.path.length - b.path.length || closeness(map, b.end, k.cands) - closeness(map, a.end, k.cands); });
            return { path: askable[0].path, q: q };
        }
        return { path: [st.pos], q: null };   // nothing to ask: all the walking happens in detectiveFinish, with the answer known
    }
    /** Second half: continue the walk (the answer is in k now) and decide on an arrest. Returns { path, arrest }. */
    function detectiveFinish(map, st, k, level, rng, pathSoFar) {
        var from = pathSoFar[pathSoFar.length - 1];
        // reachable continuations that keep the whole path legal
        var reach = detectiveReach(map, from).map(function (r) { return { end: r.end, path: pathSoFar.concat(r.path.slice(1)) }; }).filter(function (r) { return R.validateDetectivePath(map, r.path).ok; });
        if (level <= 1) {   // 🥄 wanders at random and arrests only when a single candidate is right there
            var r1 = pick(rng, reach), one = k.cands.length === 1 && R.arrestValid(map, r1.end, k.cands[0]) ? k.cands[0] : null;
            return { path: r1.path, arrest: one };
        }
        var inReach = function (end) { return k.cands.filter(function (c) { return R.arrestValid(map, end, c); }); };
        var threshold = level === 2 ? 1 : (st.day >= 5 && st.arrestsLeft >= 2 ? 3 : 2);   // 🥄🥄 only when certain · 🥄🥄🥄 at two, three once the week runs out
        if (k.cands.length && k.cands.length <= threshold) {
            var options = reach.filter(function (r) { return inReach(r.end).length; });
            if (options.length) {
                options.sort(function (a, b) { return inReach(b.end).length - inReach(a.end).length || a.path.length - b.path.length; });
                var o = options[0];
                return { path: o.path, arrest: inReach(o.end)[0] };
            }
        }
        reach.sort(function (a, b) { return closeness(map, b.end, k.cands) - closeness(map, a.end, k.cands) || a.path.length - b.path.length; });
        return { path: reach[0].path, arrest: null };
    }

    // ---- killer bot ----------------------------------------------------------------------------------------------
    /** A whole killer turn. st = { pos (null on day 1), detectivePos, cereals, kills, skipUsed, day }. Returns { home, path, kill, witness } (home only on day 1). */
    function killerTurn(map, st, level, rng) {
        var blocked = st.detectivePos != null ? [st.detectivePos] : [];
        var home = null, pos = st.pos;
        if (pos == null) {
            var houses = R.killerHomeOptions(map), cafes = R.detectiveStartOptions(map);
            if (level <= 1) home = pick(rng, houses);
            else home = houses.slice().sort(function (a, b) { var da = Math.min.apply(null, cafes.map(function (c) { return R.distance(map, a, c); })), db = Math.min.apply(null, cafes.map(function (c) { return R.distance(map, b, c); })); return db - da || rng() - 0.5; })[0];
            pos = home;
        }
        var paths = R.legalPaths(map, pos, R.STEPS.killer, { exact: true, canRide: true, blocked: blocked });
        if (!paths.length) return null;   // cornered: the game ends before this turn
        var dDet = function (cell) { return st.detectivePos == null ? 6 : R.distance(map, st.detectivePos, cell); };
        var options = [];
        paths.forEach(function (p) {
            var end = p[p.length - 1], kills = st.kills < R.MAX_KILLS ? R.killOptions(map, p, st.cereals) : [];
            var variants = [];
            kills.forEach(function (kc) {
                var parks = R.witnessOptions(map, kc).filter(function (w) { return w !== end; });
                if (R.witnessOptions(map, kc).length && !parks.length) return;   // the only park is where this path ends
                if (!parks.length) variants.push({ kill: kc, witness: null });
                else parks.forEach(function (w) { variants.push({ kill: kc, witness: w }); });
            });
            if (!variants.length && !st.skipUsed) variants.push({ kill: null, witness: null });
            variants.forEach(function (v) {
                var s = 0;
                if (v.kill != null) s += 10; else s -= 4;
                s += Math.min(dDet(end), 5) * 1.5;                                   // keep away from the detective
                if (st.detectivePos != null && R.arrestValid(map, st.detectivePos, end)) s -= 6;   // never end in arrest reach if it can be helped
                if (v.witness != null) s += Math.min(dDet(v.witness), 5) * 0.8;           // a witness far from the detective
                if (level >= 2 && v.kill != null) {
                    s += Math.min(R.distance(map, end, v.kill, { canRide: false }), 3) * 1.2;   // end far from the cereal: the detective's search circle is drawn around it
                    if (!R.witnessOptions(map, v.kill).length) s += 3;                        // a house with no park: no witness, no question
                }
                if (level >= 3) s += R.neighbors(map, end).length * 0.5 + (dDet(end) > 4 ? 2 : 0);   // central, outside next turn's reach
                s += rng() * (level <= 1 ? 8 : 0.5);                                 // 🥄: mostly luck
                options.push({ path: p, kill: v.kill, witness: v.witness, score: s });
            });
        });
        if (!options.length) return null;   // no fresh house on any path and the quiet day is spent: there is no legal turn (the good side wins, like being cornered)
        options.sort(function (a, b) { return b.score - a.score; });
        var best = options[0];
        return { home: home, path: best.path, kill: best.kill, witness: best.witness };
    }

    return { newKnowledge: newKnowledge, observeKillerTurn: observeKillerTurn, observeAnswer: observeAnswer, observeArrestMiss: observeArrestMiss, expectedAnswer: expectedAnswer,
        detectiveReach: detectiveReach, detectiveStart: detectiveStart, pickQuestion: pickQuestion, detectivePlan: detectivePlan, detectiveFinish: detectiveFinish, killerTurn: killerTurn,
        LEVELS: [{ level: 1, spoons: '🥄', name: 'Rookie', th: 'มือใหม่' }, { level: 2, spoons: '🥄🥄', name: 'Skilled', th: 'ชำนาญ' }, { level: 3, spoons: '🥄🥄🥄', name: 'Cereal killer', th: 'ซีเรียลคิลเลอร์' }] };
});
