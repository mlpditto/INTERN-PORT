/* V101.391 🪞 Memory Fracture · the shelf and its differences (owner 2026-11-28, game 5 of docs/MEMORY-SPOT-PLAN.md; picks: pharmacy
   scenes first, real drug names, 💎 bets from the start, 60 s look / 90 s find / 3 rounds, layout C = the steps rail). Pure: a seed + a
   level make the same shelf and the same changes on any phone (and later in the room referee). A shelf is a grid of slots; a slot is
   empty or one drug: bottle or box, its colour, the name and strength on the label, 1 or 2 of it. The changes (each slot changes at
   most once): 🎨 cap / box colour · ➖ gone · ➕ added · 🔀 two swap places · 📦 1 ↔ 2 · 💊 strength · 🔤 a look-alike name (LASA, Tall
   Man lettering). ⚠️ The LASA pairs and strengths are a pharmacist's to check before the game goes live (owner: real names).
   window.SpotScene; module.exports for node. */
(function (root) {
    'use strict';
    var COLORS = { red: '#dc2626', blue: '#2563eb', green: '#16a34a', orange: '#f59e0b', purple: '#7c3aed', teal: '#0d9488', pink: '#db2777' };
    var CN = Object.keys(COLORS);
    // name · strengths (mg) · form b = bottle, x = box · body tint · colour (the cap of a bottle, the box itself) · its look-alike
    var DRUGS = [
        ['Amlodipine', [5, 10], 'b', '#f8fafc', 'blue'], ['Losartan', [50, 100], 'b', '#f8fafc', 'red'], ['Simvastatin', [10, 20, 40], 'b', '#f8fafc', 'purple'],
        ['Atorvastatin', [10, 20, 40], 'x', '#e0f2fe', 'blue'], ['Omeprazole', [20, 40], 'x', '#fce7f3', 'pink'], ['Paracetamol', [325, 500], 'x', '#fee2e2', 'red'],
        ['Ibuprofen', [200, 400], 'x', '#ffedd5', 'orange'], ['Warfarin', [2, 3, 5], 'b', '#f8fafc', 'blue'], ['Enalapril', [5, 20], 'b', '#f8fafc', 'teal'],
        ['Atenolol', [25, 50, 100], 'b', '#fef3c7', 'green'], ['Cetirizine', [10], 'x', '#e0f2fe', 'teal'], ['Amoxicillin', [250, 500], 'x', '#fef9c3', 'orange'],
        ['hydrALAZINE', [25, 50], 'b', '#fef3c7', 'green', 'hydrOXYzine'], ['hydrOXYzine', [10, 25], 'b', '#ecfccb', 'orange', 'hydrALAZINE'],
        ['glipiZIDE', [5, 10], 'b', '#f8fafc', 'pink', 'glyBURIDE'], ['glyBURIDE', [2.5, 5], 'b', '#f8fafc', 'blue', 'glipiZIDE'],
        ['predniSONE', [5, 20], 'x', '#fef9c3', 'orange', 'prednisoLONE'], ['prednisoLONE', [5, 20], 'x', '#ecfccb', 'green', 'predniSONE'],
        ['traMADol', [50], 'x', '#ede9fe', 'purple', 'traZODone'], ['traZODone', [50, 100], 'x', '#e0f2fe', 'blue', 'traMADol'],
        ['ALPRAZolam', [0.25, 0.5], 'b', '#f8fafc', 'purple', 'LORazepam'], ['LORazepam', [0.5, 1], 'b', '#f8fafc', 'teal', 'ALPRAZolam'],
        ['risperiDONE', [1, 2], 'b', '#f8fafc', 'orange', 'rOPINIRole'], ['rOPINIRole', [0.25, 1], 'b', '#fef3c7', 'red', 'risperiDONE'],
        ['metFORMIN', [500, 850], 'x', '#dbeafe', 'blue', 'metroNIDAZOLE'], ['metroNIDAZOLE', [200, 500], 'x', '#fef9c3', 'green', 'metFORMIN']
    ];
    var BY = {}; DRUGS.forEach(function (d, i) { BY[d[0]] = i; });
    // 🥄 bigger changes only · 🥄🥄 + strengths and names · 🥄🥄🥄 more slots, more changes, names and strengths count double
    var LEVELS = {
        1: { cols: 3, rows: 4, items: 10, diffs: 4, kinds: ['cap', 'gone', 'add', 'swap', 'count'] },
        2: { cols: 3, rows: 5, items: 13, diffs: 6, kinds: ['cap', 'gone', 'add', 'swap', 'count', 'dose', 'lasa'] },
        3: { cols: 4, rows: 5, items: 18, diffs: 8, kinds: ['cap', 'gone', 'add', 'swap', 'count', 'dose', 'dose', 'lasa', 'lasa'] }
    };
    var LOOK = 60, FIND = 90, BET = 10, ROUNDS = 3;
    function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function mg(v) { return v + ' mg'; }
    function item(i, r) { var d = DRUGS[i]; return { d: i, name: d[0], dose: d[1][Math.floor(r() * d[1].length)], form: d[2], tint: d[3], col: d[4], n: 1 }; }
    function clone(x) { return JSON.parse(JSON.stringify(x)); }

    /** the shelf for one round: { level, cols, rows, orig, changed, diffs: [{ kind, cells, say }] } */
    function make(level, seed) {
        var L = LEVELS[level] || LEVELS[1], r = rng(seed), N = L.cols * L.rows, slots = [], cells = shuffle(Array.from({ length: N }, function (x, i) { return i; }), r);
        for (var k = 0; k < N; k++) slots.push(null);
        // drugs: a look-alike pair or two always sit on the shelf together (the label to read twice)
        var pool = shuffle(DRUGS.map(function (d, i) { return i; }), r), pick = [];
        var pairs = shuffle(DRUGS.map(function (d, i) { return i; }).filter(function (i) { return DRUGS[i][5] && i < BY[DRUGS[i][5]]; }), r);
        pairs.slice(0, level).forEach(function (i) { pick.push(i, BY[DRUGS[i][5]]); });
        pool.forEach(function (i) { if (pick.length < L.items && pick.indexOf(i) < 0) pick.push(i); });
        pick = shuffle(pick.slice(0, L.items), r);
        pick.forEach(function (d, j) { slots[cells[j]] = item(d, r); if (r() < .25) slots[cells[j]].n = 2; });
        var orig = clone(slots), ch = clone(slots), used = {}, diffs = [];
        var onShelf = function () { return ch.filter(Boolean).map(function (s) { return s.d; }).concat(orig.filter(Boolean).map(function (s) { return s.d; })); };
        var free = function (want) { return shuffle(Array.from({ length: N }, function (x, i) { return i; }), r).filter(function (i) { return !used[i] && (want === 'empty' ? !orig[i] : !!orig[i]); }); };
        var TRY = { cap: function () {
            var c = free()[0]; if (c == null) return null; var s = ch[c], to = shuffle(CN.filter(function (n) { return n !== s.col; }), r)[0];
            var said = s.name + ': ' + (s.form === 'b' ? s.col + ' cap → ' + to : s.col + ' box → ' + to); s.col = to; return { cells: [c], say: '🎨 ' + said };
        }, gone: function () {
            var c = free()[0]; if (c == null) return null; var s = ch[c]; ch[c] = null; return { cells: [c], say: '➖ ' + s.name + ' gone' };
        }, add: function () {
            var c = free('empty')[0], have = onShelf(), d = shuffle(DRUGS.map(function (x, i) { return i; }).filter(function (i) { return have.indexOf(i) < 0; }), r)[0];
            if (c == null || d == null) return null; ch[c] = item(d, r); return { cells: [c], say: '➕ ' + ch[c].name + ' added' };
        }, swap: function () {
            var f = free(), a = f[0], b = f.filter(function (i) { return i !== a && ch[i] && ch[a] && (ch[i].form !== ch[a].form || ch[i].col !== ch[a].col); })[0];
            if (a == null || b == null) return null; var t = ch[a]; ch[a] = ch[b]; ch[b] = t; return { cells: [a, b], say: '🔀 ' + ch[b].name + ' ⇄ ' + ch[a].name };
        }, count: function () {
            var c = free()[0]; if (c == null) return null; var s = ch[c], was = s.n; s.n = was === 1 ? 2 : 1; return { cells: [c], say: '📦 ' + s.name + ' ×' + was + ' → ×' + s.n };
        }, dose: function () {
            var c = free().filter(function (i) { return DRUGS[ch[i].d][1].length > 1; })[0]; if (c == null) return null;
            var s = ch[c], to = shuffle(DRUGS[s.d][1].filter(function (v) { return v !== s.dose; }), r)[0], was = s.dose; s.dose = to; return { cells: [c], say: '💊 ' + s.name + ' ' + was + ' → ' + mg(to) };
        }, lasa: function () {
            // the label reads its look-alike at the same strength (only where that strength exists for both)
            var c = free().filter(function (i) { var d = DRUGS[ch[i].d]; return d[5] && DRUGS[BY[d[5]]][1].indexOf(ch[i].dose) >= 0; })[0]; if (c == null) return null;
            var s = ch[c], was = s.name; s.name = DRUGS[s.d][5]; return { cells: [c], say: '🔤 ' + was + ' → ' + s.name };
        } };
        var kinds = L.kinds;
        for (var guard = 0; diffs.length < L.diffs && guard < 200; guard++) {
            var kind = kinds[Math.floor(r() * kinds.length)];
            if (guard > 60) kind = ['cap', 'count', 'gone'][guard % 3];   // fall back to the changes that always fit
            var d = TRY[kind]();
            if (!d) continue;
            d.cells.forEach(function (c) { used[c] = 1; });
            d.kind = kind; diffs.push(d);
        }
        return { level: level, cols: L.cols, rows: L.rows, orig: orig, changed: ch, diffs: diffs };
    }
    /** taps (slot numbers) → which changes were found and which taps were wrong */
    function judge(sc, taps) {
        var found = sc.diffs.map(function (d) { return d.cells.some(function (c) { return taps.indexOf(c) >= 0; }); });
        var wrong = taps.filter(function (t) { return !sc.diffs.some(function (d) { return d.cells.indexOf(t) >= 0; }); });
        return { found: found, n: found.filter(Boolean).length, wrong: wrong };
    }
    /** one round's points and 💎: (found − wrong, never below 0) × the bet; ×1.5 costs 💎1, ×2 costs 💎2 and 💎1 more past 2 wrong taps;
     *  every change found with no wrong tap gives 💎1 back */
    var BETS = { 1: 0, 1.5: 1, 2: 2 };
    function score(sc, taps, bet) {
        var j = judge(sc, taps), raw = Math.max(0, j.n - j.wrong.length), gem = -BETS[bet];
        if (bet === 2 && j.wrong.length > 2) gem -= 1;
        if (j.n === sc.diffs.length && !j.wrong.length) gem += 1;
        return { found: j.found, n: j.n, wrong: j.wrong, raw: raw, pts: raw * bet, gem: gem };
    }

    // ---- drawing: one SVG, a cell per slot, wooden planks under each row ----------------------------------------------------
    var CW = 75, RH = 92, W = 300;
    function T(x, y, t, s, w, f) { return '<text x="' + x + '" y="' + y + '" font-size="' + s + '" font-weight="' + (w || 800) + '" fill="' + (f || '#1e293b') + '" text-anchor="middle">' + t + '</text>'; }
    function R(x, y, w, h, f, rx, st) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 2) + '" fill="' + f + '"' + (st ? ' stroke="' + st + '" stroke-width=".8"' : '') + '/>'; }
    function one(s, cx, top, w, ghost) {   // one bottle or box, centred at cx, standing on top + 76; ghost = the 2nd one, behind, no label
        var col = COLORS[s.col], lw = w - 6, fs = Math.min(9, lw / (s.name.length * .56)), out = '';
        if (s.form === 'b') {
            out += R(cx - w * .32, top + 10, w * .64, 9, col, 2) + R(cx - w / 2, top + 18, w, 58, s.tint, 7, '#cbd5e1') + R(cx - lw / 2, top + 30, lw, 30, '#fff', 2, '#e2e8f0');
        } else {
            out += R(cx - w / 2, top + 24, w, 52, s.tint, 3, '#cbd5e1') + R(cx - w / 2, top + 24, w, 7, col, 2) + R(cx - lw / 2, top + 36, lw, 28, '#fff', 2, '#e2e8f0');
        }
        if (ghost) return '<g opacity=".7">' + out + '</g>';
        var ly = s.form === 'b' ? top + 42 : top + 47;
        return out + T(cx, ly, s.name, fs.toFixed(1)) + T(cx, ly + 12, mg(s.dose), Math.min(10, lw / 5).toFixed(1), 900, '#b91c1c');
    }
    function draw(sc, which, marks) {
        var slots = which === 'changed' ? sc.changed : sc.orig, cw = W / sc.cols, H = sc.rows * RH + 8, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sp-shelf" role="img" aria-label="Drug shelf">';
        s += R(0, 0, W, H, '#e7dcc7', 10);
        for (var row = 0; row < sc.rows; row++) s += R(4, 6 + row * RH + 80, W - 8, 6, '#a16207', 2);
        slots.forEach(function (it, i) {
            var c = i % sc.cols, row = Math.floor(i / sc.cols), x = c * cw, top = 6 + row * RH, cx = x + cw / 2, w = Math.min(54, cw - 14);
            s += '<g class="sp-cell" data-k="' + i + '"><rect x="' + x + '" y="' + top + '" width="' + cw + '" height="' + RH + '" fill="transparent"/>';
            if (it) s += it.n === 2 ? one(it, cx + w * .16, top - 5, w * .84, true) + one(it, cx - w * .1, top, w * .84) : one(it, cx, top, w);   // ×2: a second one peeks out behind
            s += '</g>';
        });
        s += '<g pointer-events="none">';   // the marks never catch a tap: tapping a ringed slot again reaches the slot (undo)
        (marks || []).forEach(function (m) {
            var c = m.k % sc.cols, row = Math.floor(m.k / sc.cols), cx = c * cw + cw / 2, cy = 6 + row * RH + 46, r = Math.min(cw, RH) / 2 - 3;
            if (m.t === 'tap') s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#f59e0b22" stroke="#f59e0b" stroke-width="3"/>';
            else if (m.t === 'ok') s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#16a34a" stroke-width="3.5"/>';
            else if (m.t === 'miss') s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-dasharray="6 4"/>';
            else s += '<path d="M' + (cx - 11) + ' ' + (cy - 11) + 'l22 22M' + (cx + 11) + ' ' + (cy - 11) + 'l-22 22" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>';
        });
        return s + '</g></svg>';
    }

    var api = { make: make, judge: judge, score: score, draw: draw, rng: rng, DRUGS: DRUGS, LEVELS: LEVELS, BETS: BETS, LOOK: LOOK, FIND: FIND, BET: BET, ROUNDS: ROUNDS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SpotScene = api;
})(this);
