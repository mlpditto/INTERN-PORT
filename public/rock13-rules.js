/* V101.382 🪨 Carry 13 — the rules, pure (owner 2026-11-27, game 4 of docs/MIND-GAMES-PLAN.md: a game-show mechanic, our own name
   and look, pick A3 = carriers holding a board, mockup-rock13/). 3 carriers 🔴🟢🔵. Each set every player holds cards 0–6 and chips
   🔴🔴🟢🟢🔵🔵🌈, each used once. A round: everyone picks a card + a chip in secret → reveal → place one by one: 🌈 first, then the
   higher card first; a tie goes clockwise from the 👑. At your turn you may ⏭ Pass once a round (you then place after everyone who
   did not pass; the first to pass places last) — never as the last one left. 🌈 picks its carrier at its turn. A stone that brings
   a carrier to 13 or more: you take every stone that was there (1 🪨 per stone, a 0 counts) and your stone stays. The last one to
   take stones in a round holds 👑 next round. 7 or 14 rounds (new cards + chips after round 7, the stones stay). Fewest 🪨 wins;
   a tie goes to the one who took stones longer ago. Bots play the tactics (the tutorial never teaches them — owner).
   The same file runs on the page (window.Rock13Rules) and later in functions/ (the room referee). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Rock13Rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var ST = ['r', 'g', 'b'], LIMIT = 13, SET = 7;
    function fresh() { return { cards: [0, 1, 2, 3, 4, 5, 6], chips: { r: 2, g: 2, b: 2, w: 1 } }; }
    function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

    /** a new game: players = [{ id, name, bot }] in clockwise order; rounds 7 | 14; first = 👑 seat */
    function create(players, rounds, first) {
        return {
            rounds: rounds === 7 ? 7 : 14, round: 1, first: first || 0, phase: 'submit', stands: { r: [], g: [], b: [] },
            players: players.map(function (p) { var f = fresh(); return { id: p.id, name: p.name, bot: !!p.bot, cards: f.cards, chips: f.chips, pen: 0, penAt: 0 }; }),
            subs: {}, main: [], passed: [], did: {}, log: [], step: 0, hitRound: -1
        };
    }
    function canSubmit(g, s, card, chip) {
        var p = g.players[s];
        return g.phase === 'submit' && !!p && !g.subs[s] && p.cards.indexOf(card) >= 0 && (p.chips[chip] || 0) > 0;
    }
    /** a secret pick; when everyone has picked, the round is revealed and the queue is set */
    function submit(g, s, card, chip) {
        if (!canSubmit(g, s, card, chip)) return false;
        g.subs[s] = { card: card, chip: chip };
        if (Object.keys(g.subs).length === g.players.length) reveal(g);
        return true;
    }
    function reveal(g) {
        var n = g.players.length, seats = [];
        for (var i = 0; i < n; i++) {
            var sb = g.subs[i], p = g.players[i];
            p.cards.splice(p.cards.indexOf(sb.card), 1); p.chips[sb.chip]--;
            seats.push(i);
        }
        function cw(s) { return (s - g.first + n) % n; }
        seats.sort(function (a, b) {
            var A = g.subs[a], B = g.subs[b];
            return ((B.chip === 'w') - (A.chip === 'w')) || (B.card - A.card) || (cw(a) - cw(b));
        });
        g.main = seats; g.passed = []; g.did = {}; g.phase = 'place'; g.hitBy = null;
    }
    /** who acts now (a seat) or -1 */
    function turn(g) {
        if (g.phase !== 'place') return -1;
        if (g.main.length) return g.main[0];
        return g.passed.length ? g.passed[g.passed.length - 1] : -1;
    }
    /** ⏭ allowed: once a round, while someone else is still to place */
    function canPass(g, s) {
        return turn(g) === s && g.main[0] === s && g.passed.indexOf(s) < 0 && (g.main.length > 1 || g.passed.length > 0);
    }
    function pass(g, s) {
        if (!canPass(g, s)) return false;
        g.main.shift(); g.passed.push(s); g.log.push({ r: g.round, k: 'pass', s: s }); return true;
    }
    /** the carrier this seat's stone goes to: its chip, or the one it picks with 🌈 */
    function target(g, s, pick) { var c = g.subs[s].chip; return c === 'w' ? (ST.indexOf(pick) >= 0 ? pick : null) : c; }
    /** what placing would do: { st, total, take } */
    function preview(g, s, st) {
        var card = g.subs[s].card, a = g.stands[st], total = sum(a) + card;
        return { st: st, total: total, take: total >= LIMIT ? a.length : 0 };
    }
    function place(g, s, pick) {
        if (turn(g) !== s) return false;
        var st = target(g, s, pick); if (!st) return false;
        var card = g.subs[s].card, pv = preview(g, s, st), p = g.players[s];
        if (g.main[0] === s) g.main.shift(); else g.passed.pop();
        g.step++;
        if (pv.take) { p.pen += pv.take; p.penAt = g.step; g.hitBy = s; g.stands[st] = [card]; }
        else g.stands[st].push(card);
        g.did[s] = true;
        g.log.push({ r: g.round, k: 'place', s: s, st: st, card: card, take: pv.take, chip: g.subs[s].chip });
        if (turn(g) < 0) endRound(g);
        return pv;
    }
    function endRound(g) {
        if (g.hitBy != null) g.first = g.hitBy;
        g.subs = {}; g.main = []; g.passed = [];
        if (g.round >= g.rounds) { g.phase = 'end'; return; }
        g.round++;
        if (g.round === SET + 1) g.players.forEach(function (p) { var f = fresh(); p.cards = f.cards; p.chips = f.chips; });
        g.phase = 'submit';
    }
    /** when time runs out: place without passing; 🌈 goes to the lightest carrier (fewer stones on a tie) */
    function lightest(g) {
        return ST.slice().sort(function (a, b) { return (sum(g.stands[a]) - sum(g.stands[b])) || (g.stands[a].length - g.stands[b].length); })[0];
    }
    /** seats best first: fewest 🪨; a tie → the one whose last take was longer ago (never = best) */
    function ranking(g) {
        return g.players.map(function (p, i) { return i; }).sort(function (a, b) {
            var A = g.players[a], B = g.players[b]; return (A.pen - B.pen) || (A.penAt - B.penAt) || (a - b);
        });
    }
    function setRound(g) { return ((g.round - 1) % SET) + 1; }   // 1…7 inside the current set

    // ---- 🤖 bots: they use the tactics; the tutorial never teaches these -------------------------------------------------
    /** the secret pick: { card, chip } */
    function botPick(g, s, rng) {
        rng = rng || Math.random;
        var p = g.players[s], late = setRound(g) >= 5, best = null;
        var chips = Object.keys(p.chips).filter(function (c) { return p.chips[c] > 0; });
        p.cards.forEach(function (card) {
            chips.forEach(function (chip) {
                var v = 0, sts = chip === 'w' ? ST : [chip];
                // the safest carrier for this card (🌈 picks later, so it takes the best one)
                var risk = Math.min.apply(null, sts.map(function (st) {
                    var a = g.stands[st], t = sum(a) + card;
                    return t >= LIMIT ? a.length * 3 + 2 : t >= LIMIT - 3 && card > 0 ? (t - (LIMIT - 4)) * 0.6 : 0;
                }));
                v -= risk;
                if (!late) v += card * 0.35;                   // big stones go early while the carriers are light
                else v -= card * 0.25;
                if (card <= 1 && !late) v -= 1.2;              // keep 0 and 1 for the end of the set
                if (chip === 'w') v += late ? 1.5 : -2.5;      // keep 🌈 for the end
                sts.forEach(function (st) { var t = sum(g.stands[st]) + card; if (chip !== 'w' && (t === 11 || t === 12)) v += 0.8; });   // leave a heavy carrier for the next one
                v += (rng() - 0.5) * 0.9;
                if (!best || v > best.v) best = { card: card, chip: chip, v: v };
            });
        });
        return { card: best.card, chip: best.chip };
    }
    /** at its turn: { pass } or { pick } (the carrier for 🌈) */
    function botTurn(g, s) {
        var chip = g.subs[s].chip;
        if (chip === 'w') {
            var opts = ST.map(function (st) { return preview(g, s, st); });
            var safe = opts.filter(function (o) { return !o.take; });
            if (safe.length) { safe.sort(function (a, b) { return b.total - a.total; }); return { pick: safe[0].st }; }   // heaviest that still holds
            if (canPass(g, s)) return { pass: true };
            opts.sort(function (a, b) { return a.take - b.take; }); return { pick: opts[0].st };                          // the fewest stones
        }
        var pv = preview(g, s, chip);
        if (pv.take && canPass(g, s)) return { pass: true };
        return { pick: chip };
    }
    return { ST: ST, LIMIT: LIMIT, SET: SET, create: create, canSubmit: canSubmit, submit: submit, turn: turn, canPass: canPass, pass: pass,
        target: target, preview: preview, place: place, lightest: lightest, ranking: ranking, setRound: setRound, sum: sum, botPick: botPick, botTurn: botTurn };
});
