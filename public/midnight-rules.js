/* V101.402 🌙 Midnight Market — the rules, pure (owner 2026-11-29, docs/VAULT-SWAP-PLAN.md PR 1: a game-show mechanic of swapping
   face-down cards, our own name, heist mood and drawings). 4–7 seats. The deck is seats + 4 cards: loot of 4 kinds 💎 Jewels ·
   🪙 Gold · 🖼 Art · 💵 Cash with a number, and 📡 Trackers with a minus number. 3 heists. A heist: one card each, face down (you see
   yours), 3 cards to the 🕴 Fence, 1 to the 🗑 Bin. Everyone MUST swap twice: ➡ pass 1 clockwise from the starter, ⬅ pass 2 the other
   way round. You swap your card with another player's, a Fence slot or the Bin; all see who swapped with what, never the faces.
   Holding a 📡 you may only swap with a player; when somebody takes a 📡 from you on their turn you get +3 at once. 👁 once a game,
   on your turn, you look at one Fence slot or the Bin. Then all cards turn: your loot scores its number × the Fence cards of its
   kind (none = 0); a 📡 scores its minus number. The holder of the biggest 📡 starts the next heist (nobody holds one: the next
   seat). 🤝 Before the game every seat gets a secret partner, one ring through all seats: you know yours, not who has you.
   Final = your total × your partner's total. Most wins; a tie goes to the higher own total.
   The file keeps what each seat can know (g.know) from the public swaps: the page shows you yours, the bots play on theirs.
   The same file runs on the page (window.MidnightRules) and later in functions/ (the room referee). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(); else root.MidnightRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var KINDS = ['J', 'G', 'A', 'C'], HEISTS = 3, MIN = 4, MAX = 7, FENCE = 3, BONUS = 3;
    var DECKS = {
        4: 'J6 G4 G5 A2 A3 C1 C2 T-5',
        5: 'J6 G4 G5 A2 A3 C1 C2 T-6 T-4',
        6: 'J5 J6 G4 G5 A2 A3 C1 C2 T-6 T-4',
        7: 'J5 J6 G4 G5 A2 A3 A4 C1 C2 T-6 T-4'
    };
    function deck(n) { return DECKS[n].split(' ').map(function (s) { return { k: s.charAt(0), n: +s.slice(1) }; }); }
    function rand(g) {   // mulberry32; the state is one number in g.rs, so a game can be stored and go on
        g.rs = (g.rs + 0x6D2B79F5) >>> 0; var t = g.rs;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function shuffle(g, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand(g) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function pk(s) { return 'p' + s; }
    function same(a, b) { return !!a && !!b && a.k === b.k && a.n === b.n; }

    /** a new game: players = [{ id, name, bot, level }] clockwise, 4–7 of them; seed = any whole number */
    function create(players, seed) {
        var n = players.length; if (n < MIN || n > MAX) throw new Error('4–7 seats');
        var g = { n: n, rs: (seed >>> 0) || 1, heists: HEISTS, heist: 0, phase: '', players: players.map(function (p) { return { id: p.id, name: p.name, bot: !!p.bot, level: p.level || 1, total: 0, peek: 1 }; }) };
        var ring = shuffle(g, players.map(function (p, i) { return i; }));
        g.partner = []; ring.forEach(function (s, i) { g.partner[s] = ring[(i + 1) % n]; });   // partner[s]: the seat whose total multiplies s's
        g.first = Math.floor(rand(g) * n);
        deal(g);
        return g;
    }
    function deal(g) {
        var c = shuffle(g, deck(g.n)), i;
        g.heist++; g.at = {}; g.know = []; g.bonus = []; g.log = []; g.res = null; g.pass = 1; g.ti = 0; g.phase = 'swap';
        for (i = 0; i < g.n; i++) { g.at[pk(i)] = c[i]; g.bonus[i] = 0; g.know[i] = {}; g.know[i][pk(i)] = c[i]; }
        for (i = 0; i < FENCE; i++) g.at['f' + i] = c[g.n + i];
        g.at.b = c[g.n + FENCE];
    }
    function queue(g) { var q = []; for (var i = 0; i < g.n; i++) q.push((g.first + i) % g.n); return g.pass === 2 ? q.reverse() : q; }
    /** the seat to swap now, or -1 */
    function turn(g) { return g.phase === 'swap' ? queue(g)[g.ti] : -1; }
    function slots(g) { var a = []; for (var i = 0; i < g.n; i++) a.push(pk(i)); for (i = 0; i < FENCE; i++) a.push('f' + i); a.push('b'); return a; }
    /** what seat s may swap with now */
    function targets(g, s) {
        var only = g.at[pk(s)].k === 'T';
        return slots(g).filter(function (k) { return k !== pk(s) && (!only || k.charAt(0) === 'p'); });
    }
    function canPeek(g, s, key) { return turn(g) === s && g.players[s].peek > 0 && (key === 'b' || /^f[0-2]$/.test(key)); }
    /** 👁 seat s looks at a Fence slot or the Bin: the card, or null */
    function peek(g, s, key) {
        if (!canPeek(g, s, key)) return null;
        g.players[s].peek--; g.know[s][key] = g.at[key];
        return g.at[key];
    }
    function swapKnow(K, a, b) { var t = K[a]; if (K[b]) K[a] = K[b]; else delete K[a]; if (t) K[b] = t; else delete K[b]; }
    /** seat s swaps with a slot: true when done */
    function swap(g, s, key) {
        if (turn(g) !== s || targets(g, s).indexOf(key) < 0) return false;
        var me = pk(s), p = key.charAt(0) === 'p' ? +key.slice(1) : -1, bonus = p >= 0 && g.at[key].k === 'T';
        if (bonus) g.bonus[p] += BONUS;
        var t = g.at[me]; g.at[me] = g.at[key]; g.at[key] = t;
        for (var q = 0; q < g.n; q++) swapKnow(g.know[q], me, key);   // everyone saw the swap: what they knew moves with the cards
        g.know[s][me] = g.at[me]; if (p >= 0) g.know[p][key] = g.at[key];   // and the two hands see their new card
        g.log.push({ by: s, to: key, pass: g.pass, bonus: bonus ? p : -1 });
        if (++g.ti >= g.n) { if (g.pass === 1) { g.pass = 2; g.ti = 0; } else reveal(g); }
        return true;
    }
    function mult(g, c) { var m = 0; for (var i = 0; i < FENCE; i++) if (g.at['f' + i].k === c.k) m++; return m; }
    function reveal(g) {
        var res = [], worst = -1, i;
        for (i = 0; i < g.n; i++) {
            var c = g.at[pk(i)], m = c.k === 'T' ? 1 : mult(g, c), pts = c.n * m;
            res.push({ card: c, mult: c.k === 'T' ? 0 : m, pts: pts, bonus: g.bonus[i], sum: pts + g.bonus[i] });
            g.players[i].total += pts + g.bonus[i];
            if (c.k === 'T' && (worst < 0 || c.n < g.at[pk(worst)].n)) worst = i;
        }
        g.res = res; g.phase = 'show'; g.next = worst >= 0 ? worst : (g.first + 1) % g.n;
    }
    /** after the reveal: the next heist, or the end */
    function next(g) {
        if (g.phase !== 'show') return false;
        if (g.heist < g.heists) { g.first = g.next; deal(g); return true; }
        g.final = g.players.map(function (p, i) { return p.total * g.players[g.partner[i]].total; });
        g.phase = 'end';
        return true;
    }
    /** seats, best first: final, then the own total, then the seat */
    function ranking(g) {
        var f = g.final || g.players.map(function () { return 0; });
        return g.players.map(function (p, i) { return i; }).sort(function (a, b) { return f[b] - f[a] || g.players[b].total - g.players[a].total || a - b; });
    }

    // ---- 🤖 bots: they play on what their seat can know -----------------------------------------------------------------------
    function unseen(g, K) {   // the cards whose place this knowledge does not hold
        var d = deck(g.n);
        Object.keys(K).forEach(function (k) { for (var i = 0; i < d.length; i++) if (same(d[i], K[k])) { d.splice(i, 1); break; } });
        return d;
    }
    function worth(g, K, c, pool, inPool) {   // the points a card is expected to score with this knowledge of the Fence
        if (c.k === 'T') return c.n;
        var known = 0, open = 0, i;
        for (i = 0; i < FENCE; i++) { var f = K['f' + i]; if (!f) open++; else if (f.k === c.k) known++; }
        var rest = pool.length - (inPool ? 1 : 0), kin = pool.filter(function (x) { return x.k === c.k; }).length - (inPool ? 1 : 0);
        return c.n * (known + (rest > 0 ? open * kin / rest : 0));
    }
    function hold(g, K, key) {   // the expected points of the card at a slot
        var pool = unseen(g, K), c = K[key];
        if (c) return worth(g, K, c, pool, false);
        if (!pool.length) return 0;
        return pool.reduce(function (a, x) { return a + worth(g, K, x, pool, true); }, 0) / pool.length;
    }
    /** what a bot does on its turn: { peek: slot | null, to: slot } — level 1 at random, 2 the best card for itself, 3 minds its partner too */
    function botMove(g, s) {
        var lv = g.players[s].level || 1, T = targets(g, s), me = pk(s), out = { peek: null, to: T[Math.floor(rand(g) * T.length)] };
        if (lv <= 1) return out;
        var K0 = g.know[s];
        if (g.players[s].peek > 0 && g.at[me].k !== 'T' && (lv >= 3 || rand(g) < .5)) {   // look where it tells the most: a Fence slot it does not know
            var un = ['f0', 'f1', 'f2'].filter(function (k) { return !K0[k]; });
            if (un.length) out.peek = un[Math.floor(rand(g) * un.length)];
        }
        var K = {}; Object.keys(K0).forEach(function (k) { K[k] = K0[k]; });
        if (out.peek) K[out.peek] = g.at[out.peek];
        var mate = g.partner[s], best = -1e9, mine = g.players[s].total, theirs = g.players[mate].total;
        T.forEach(function (key) {
            var K2 = {}; Object.keys(K).forEach(function (k) { K2[k] = K[k]; }); swapKnow(K2, me, key);
            var own = hold(g, K2, me), v = own + rand(g) * 1.2;
            if (lv >= 3) {   // the final is a product: what the swap leaves my partner counts as much as my own card; a rival's loss is a small gain
                v = (mine + own) * (theirs + hold(g, K2, pk(mate))) / Math.max(4, Math.abs(mine) + Math.abs(theirs)) + own * .5 + rand(g) * .2;
                if (key.charAt(0) === 'p' && +key.slice(1) !== mate) v -= (hold(g, K2, key) - hold(g, K, key)) * .2;
            }
            if (v > best) { best = v; out.to = key; }
        });
        return out;
    }

    return { KINDS: KINDS, HEISTS: HEISTS, MIN: MIN, MAX: MAX, FENCE: FENCE, BONUS: BONUS, deck: deck, create: create, queue: queue, turn: turn, slots: slots,
        targets: targets, canPeek: canPeek, peek: peek, swap: swap, mult: mult, next: next, ranking: ranking, botMove: botMove, hold: hold, rand: rand };
});
