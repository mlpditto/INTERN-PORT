/* V101.362 🧊 นับไว (Count Fast) — two eye-and-speed games, solo, against the clock (owner 2026-11-25, pick C: answer, then the answer shows):
   🟥 Count the Rectangles — a line drawing; how many rectangles are in it (every rectangle whose four sides are drawn lines).
   🧊 Count the Cubes — a stack seen from the corner; how many cubes (the stack has no holes and no overhangs, so hidden ones count too).
   5 questions a run, 30 s each, a number pad; after each answer the picture explains it (rectangles light up one by one / every column shows its height).
   Reads and writes nothing but localStorage countBest_rect / countBest_cube. window.CG, window.countOpen. A room with friends = later. */
(function () {
    'use strict';
    var Q = 5, SEC = 30, MODES = { rect: { e: '🟥', n: 'สี่เหลี่ยม', ask: 'กี่รูป?' }, cube: { e: '🧊', n: 'ลูกบาศก์', ask: 'กี่ก้อน?' } };
    var rng = Math.random, g = null, tick = null, show = null;
    function ri(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    function get(k) { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } }
    function set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }

    // ---- 🟥 rectangles: outlines of a few rectangles on a W×H lattice; count = every rectangle whose 4 sides are drawn --------------
    function rectPuzzle(level) {
        var W = 8, H = 6, lo = [5, 7, 9, 11, 13][level], hi = [10, 14, 18, 24, 30][level];
        for (var tries = 0; tries < 400; tries++) {
            var hs = {}, vs = {}, k = 1 + level + ri(0, 1), boxes = [[0, 0, W, H]];
            for (var i = 0; i < k; i++) { var x1 = ri(0, W - 2), y1 = ri(0, H - 2); boxes.push([x1, y1, ri(x1 + 1, Math.min(W, x1 + 5)), ri(y1 + 1, Math.min(H, y1 + 4))]); }
            boxes.forEach(function (b) {
                for (var x = b[0]; x < b[2]; x++) { hs[x + ',' + b[1]] = 1; hs[x + ',' + b[3]] = 1; }
                for (var y = b[1]; y < b[3]; y++) { vs[b[0] + ',' + y] = 1; vs[b[2] + ',' + y] = 1; }
            });
            var ans = rectsIn(hs, vs, W, H);
            if (ans.length >= lo && ans.length <= hi) return { mode: 'rect', W: W, H: H, hs: hs, vs: vs, ans: ans, n: ans.length };
        }
        return rectPuzzle(Math.max(0, level - 1));
    }
    function rectsIn(hs, vs, W, H) {
        var out = [];
        function hLine(x1, x2, y) { for (var x = x1; x < x2; x++) if (!hs[x + ',' + y]) return false; return true; }
        function vLine(y1, y2, x) { for (var y = y1; y < y2; y++) if (!vs[x + ',' + y]) return false; return true; }
        for (var x1 = 0; x1 < W; x1++) for (var x2 = x1 + 1; x2 <= W; x2++) for (var y1 = 0; y1 < H; y1++) for (var y2 = y1 + 1; y2 <= H; y2++)
            if (hLine(x1, x2, y1) && hLine(x1, x2, y2) && vLine(y1, y2, x1) && vLine(y1, y2, x2)) out.push([x1, y1, x2, y2]);
        return out;
    }
    function rectSvg(p, upto) {
        var U = 36, P = 6, s = '';
        if (upto) p.ans.slice(0, upto).forEach(function (r, i) {
            var last = i === upto - 1;
            s += '<rect x="' + (P + r[0] * U) + '" y="' + (P + r[1] * U) + '" width="' + (r[2] - r[0]) * U + '" height="' + (r[3] - r[1]) * U + '" fill="' + (last ? 'rgba(249,115,22,.28)' : 'rgba(249,115,22,.05)') + '"' + (last ? ' stroke="#ea580c" stroke-width="5"' : '') + '/>';
        });
        // one line per straight run (unit pieces leave seams)
        for (var y = 0; y <= p.H; y++) for (var x = 0; x < p.W; x++) if (p.hs[x + ',' + y] && !p.hs[(x - 1) + ',' + y]) { var e = x; while (p.hs[e + ',' + y]) e++; s += '<line x1="' + (P + x * U) + '" y1="' + (P + y * U) + '" x2="' + (P + e * U) + '" y2="' + (P + y * U) + '"/>'; }
        for (var x2 = 0; x2 <= p.W; x2++) for (var y2 = 0; y2 < p.H; y2++) if (p.vs[x2 + ',' + y2] && !p.vs[x2 + ',' + (y2 - 1)]) { var e2 = y2; while (p.vs[x2 + ',' + e2]) e2++; s += '<line x1="' + (P + x2 * U) + '" y1="' + (P + y2 * U) + '" x2="' + (P + x2 * U) + '" y2="' + (P + e2 * U) + '"/>'; }
        return '<svg class="cg-svg" viewBox="0 0 ' + (p.W * U + 2 * P) + ' ' + (p.H * U + 2 * P) + '" stroke="#0f172a" stroke-width="2.5" stroke-linecap="square">' + s + '</svg>';
    }

    // ---- 🧊 cubes: a staircase height map (back corner tallest, never taller toward you) so every column's top is in sight --------
    function cubePuzzle(level) {
        var n = level < 2 ? 3 : 4, lo = [4, 6, 8, 11, 14][level], hi = [9, 12, 16, 20, 26][level];
        for (var tries = 0; tries < 400; tries++) {
            var h = [], sum = 0;
            for (var r = 0; r < n; r++) {
                h.push([]);
                for (var c = 0; c < n; c++) {
                    var cap = r === 0 && c === 0 ? ri(2, 4) : Math.min(r ? h[r - 1][c] : 9, c ? h[r][c - 1] : 9);
                    var v = r === 0 && c === 0 ? cap : ri(Math.max(0, cap - 2), cap); h[r].push(v); sum += v;
                }
            }
            if (sum >= lo && sum <= hi && h[n - 1][n - 1] === 0) return { mode: 'cube', n: n, h: h, n2: sum };
        }
        return cubePuzzle(Math.max(0, level - 1));
    }
    function cubeSvg(p, reveal) {
        var a = 22, b = 12.7, z = 25, n = p.n, s = '', top = 4 * z + 4, cx = n * a + 6, list = [];
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) for (var k = 0; k < p.h[r][c]; k++) list.push([r, c, k]);
        list.sort(function (u, v) { return (u[0] + u[1]) - (v[0] + v[1]) || u[2] - v[2]; });
        function pt(x, y, k) { return (cx + (x - y) * a).toFixed(1) + ',' + (top + (x + y) * b - k * z).toFixed(1); }
        list.forEach(function (q) {
            var x = q[1], y = q[0], k = q[2];
            s += '<polygon fill="#ffffff" points="' + [pt(x, y, k + 1), pt(x + 1, y, k + 1), pt(x + 1, y + 1, k + 1), pt(x, y + 1, k + 1)].join(' ') + '"/>';
            s += '<polygon fill="#e2e8f0" points="' + [pt(x, y + 1, k + 1), pt(x + 1, y + 1, k + 1), pt(x + 1, y + 1, k), pt(x, y + 1, k)].join(' ') + '"/>';
            s += '<polygon fill="#cbd5e1" points="' + [pt(x + 1, y, k + 1), pt(x + 1, y + 1, k + 1), pt(x + 1, y + 1, k), pt(x + 1, y, k)].join(' ') + '"/>';
        });
        if (reveal) for (var r2 = 0; r2 < n; r2++) for (var c2 = 0; c2 < n; c2++) if (p.h[r2][c2]) {
            var xy = pt(c2 + 0.5, r2 + 0.5, p.h[r2][c2]).split(',');
            s += '<text x="' + xy[0] + '" y="' + (+xy[1] + 5) + '" text-anchor="middle" font-size="14" font-weight="900" fill="#ea580c" stroke="none">' + p.h[r2][c2] + '</text>';
        }
        return '<svg class="cg-svg" viewBox="0 0 ' + (2 * cx) + ' ' + (top + 2 * n * b + 6) + '" stroke="#94a3b8" stroke-width="1" stroke-linejoin="round">' + s + '</svg>';
    }

    // ---- game -------------------------------------------------------------------------------------------------------------
    function count(p) { return p.mode === 'rect' ? p.n : p.n2; }
    function newQ() { g.p = g.mode === 'rect' ? rectPuzzle(g.i) : cubePuzzle(g.i); g.typed = ''; g.left = SEC; g.done = null; g.upto = 0; startTick(); }
    function startTick() { clearInterval(tick); tick = setInterval(function () { if (!g || g.done) return clearInterval(tick); g.left--; if (g.left <= 0) { g.left = 0; answer(); } else paintClock(); }, 1000); }
    function answer() {
        clearInterval(tick); var right = g.typed !== '' && +g.typed === count(g.p), pts = right ? 100 + g.left * 5 : 0;
        g.score += pts; if (right) g.right++; g.done = { right: right, pts: pts, typed: g.typed }; g.upto = 0; render();
        if (g.mode === 'rect') {   // pick C: the rectangles light up one by one, then the whole count stands
            var n = g.p.n, step = Math.max(120, Math.min(450, 4500 / n)); clearInterval(show);
            show = setInterval(function () { if (!g || !g.done) return clearInterval(show); g.upto++; var f = document.getElementById('cg-fig'); if (f) f.innerHTML = rectSvg(g.p, g.upto); var t = document.getElementById('cg-run'); if (t) t.textContent = g.upto + ' / ' + n; if (g.upto >= n) clearInterval(show); }, step);
        }
    }
    function paintClock() { var e = document.getElementById('cg-clock'); if (e) { e.textContent = '⏱ 0:' + (g.left < 10 ? '0' : '') + g.left; e.classList.toggle('low', g.left <= 5); } }

    // ---- drawing ----------------------------------------------------------------------------------------------------------
    var CSS = '#countModal{z-index:10000}#countModal .modal-content{text-align:left;padding:14px 14px calc(16px + env(safe-area-inset-bottom));max-width:400px;max-height:92vh;overflow:auto}'
        + '#countModal .cg{display:flex;flex-direction:column;gap:10px;font-variant-numeric:tabular-nums}#countModal .cg button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '.cg-top{display:flex;align-items:center;gap:6px}.cg-top h3{margin:0;font-size:1.05em;font-weight:900;color:#ea580c;flex:1;white-space:nowrap}'
        + '.cg-pill{border-radius:999px;padding:3px 9px;font-weight:800;font-size:.85em;background:#f1f5f9;color:#334155;white-space:nowrap}.cg-pill.t{background:#ffedd5;color:#c2410c}.cg-pill.t.low{background:#fee2e2;color:#b91c1c}'
        + '.cg-x{background:none;border:0;color:#94a3b8;font-size:1.1em;padding:2px 4px}'
        + '.cg-fig{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px;display:flex;justify-content:center}.cg-svg{width:100%;max-height:34vh;display:block}'
        + '.cg-ask{text-align:center;font-weight:900;font-size:1.15em;color:#0f172a}.cg-ans{text-align:center;font-size:2em;font-weight:900;border:2px solid #fed7aa;border-radius:14px;padding:4px;min-height:1.4em;color:#0f172a;background:#fff}'
        + '.cg-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#countModal .cg-pad button{background:#fff;border:1px solid #e2e8f0;border-radius:12px;font-size:1.35em;font-weight:800;padding:8px 0;color:#0f172a}'
        + '#countModal .cg-go,#countModal .cg-pad .cg-go{background:#f97316;color:#fff;border:0;border-radius:14px;padding:12px;font-size:1.1em;font-weight:900}#countModal .cg-pad .cg-go{padding:8px 0;border-radius:12px;font-size:1.35em}#countModal .cg-go:disabled{opacity:.45}'
        + '.cg-res{text-align:center;font-weight:900;font-size:1.05em;border-radius:12px;padding:8px}.cg-res.ok{background:#dcfce7;color:#166534}.cg-res.no{background:#fee2e2;color:#991b1b}.cg-sum{text-align:center;color:#475569;font-size:.9em;word-break:break-word}'
        + '.cg-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px}#countModal .cg-modes button{background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:16px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;color:#0f172a}'
        + '.cg-modes i{font-style:normal;font-size:2em}.cg-modes small{color:#64748b;font-weight:700}.cg-note{color:#64748b;font-size:.85em;text-align:center}';
    function root() {
        var m = document.getElementById('countModal');
        if (!m) {
            if (!document.getElementById('cg-css')) { var st = document.createElement('style'); st.id = 'cg-css'; st.textContent = CSS; document.head.appendChild(st); }
            m = document.createElement('div'); m.id = 'countModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Count Fast');
            m.innerHTML = '<div class="modal-content"><div id="cg-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) CG.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function x() { return '<button type="button" class="cg-x" onclick="CG.close()" aria-label="Close">✕</button>'; }
    function lobbyHtml() {
        return '<div class="cg"><div class="cg-top"><h3>🧊 นับไว</h3>' + x() + '</div>'
            + '<div class="cg-modes">' + ['rect', 'cube'].map(function (k) { var b = get('countBest_' + k); return '<button type="button" id="cg-' + k + '" onclick="CG.start(\'' + k + '\')"><i>' + MODES[k].e + '</i>' + MODES[k].n + '<small>' + (b ? '🏆 ' + b : Q + ' ข้อ · ' + SEC + ' วิ') + '</small></button>'; }).join('') + '</div>'
            + '<div class="cg-note">ตอบแล้วดูเฉลยทุกข้อ</div></div>';
    }
    function playHtml() {
        var p = g.p, d = g.done, m = MODES[g.mode];
        var h = '<div class="cg"><div class="cg-top"><h3>' + m.e + ' ' + (g.i + 1) + '/' + Q + '</h3><span class="cg-pill t" id="cg-clock">⏱ 0:' + (g.left < 10 ? '0' : '') + g.left + '</span><span class="cg-pill">🏆 ' + g.score + '</span>' + x() + '</div>'
            + '<div class="cg-fig" id="cg-fig">' + (p.mode === 'rect' ? rectSvg(p, g.upto) : cubeSvg(p, !!d)) + '</div>';
        if (!d) {
            h += '<div class="cg-ask">' + m.ask + '</div><div class="cg-ans" id="cg-ans">' + g.typed + '</div><div class="cg-pad">'
                + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (k) { return '<button type="button" onclick="CG.key(' + k + ')">' + k + '</button>'; }).join('')
                + '<button type="button" onclick="CG.key(\'del\')" aria-label="Delete">⌫</button><button type="button" onclick="CG.key(0)">0</button>'
                + '<button type="button" class="cg-go" id="cg-ok" onclick="CG.ok()"' + (g.typed === '' ? ' disabled' : '') + '>✓</button></div>';
        } else {
            var n = count(p);
            h += '<div class="cg-res ' + (d.right ? 'ok' : 'no') + '" id="cg-res">' + (d.right ? '✓ ' + n + ' ถูก · +' + d.pts : (d.typed === '' ? '⏱ หมดเวลา' : '✗ ตอบ ' + d.typed) + ' · เฉลย ' + n) + '</div>'
                + (p.mode === 'rect' ? '<div class="cg-sum">🟧 <span id="cg-run">0 / ' + n + '</span></div>'
                    : '<div class="cg-sum">' + p.h.map(function (r) { return r.filter(Boolean).join('+'); }).filter(Boolean).join(' + ') + ' = ' + n + '</div>')
                + '<button type="button" class="cg-go" id="cg-next" onclick="CG.next()">' + (g.i + 1 < Q ? '▸ ข้อถัดไป' : '🏁 ดูคะแนน') + '</button>';
        }
        return h + '</div>';
    }
    function endHtml() {
        var best = get('countBest_' + g.mode), nb = g.score > best; if (nb) set('countBest_' + g.mode, g.score);
        return '<div class="cg"><div class="cg-top"><h3>' + MODES[g.mode].e + ' จบรอบ</h3>' + x() + '</div>'
            + '<div class="cg-ans" id="cg-final">🏆 ' + g.score + '</div><div class="cg-note">✓ ' + g.right + '/' + Q + (nb ? ' · 🎉 สถิติใหม่' : best ? ' · สถิติ ' + best : '') + '</div>'
            + '<button type="button" class="cg-go" onclick="CG.start(\'' + g.mode + '\')">↻ เล่นอีก</button><button type="button" class="cg-x" style="align-self:center" onclick="CG.lobby()">⬅ เลือกเกม</button></div>';
    }
    function render() { var m = root(); document.getElementById('cg-body').innerHTML = !g ? lobbyHtml() : g.end ? endHtml() : playHtml(); m.style.display = 'flex'; }
    function onKey(e) {
        var m = document.getElementById('countModal'); if (!m || m.style.display !== 'flex') return;
        if (e.key === 'Escape') return CG.close(); if (!g || g.end) return;
        if (g.done) { if (e.key === 'Enter') { e.preventDefault(); CG.next(); } return; }
        if (/^[0-9]$/.test(e.key)) CG.key(+e.key); else if (e.key === 'Backspace') CG.key('del'); else if (e.key === 'Enter') { e.preventDefault(); CG.ok(); }
    }

    window.CG = {
        open: function () { g = null; render(); },
        lobby: function () { clearInterval(tick); clearInterval(show); g = null; render(); },
        start: function (mode) { g = { mode: mode, i: 0, score: 0, right: 0 }; newQ(); render(); },
        key: function (k) {
            if (!g || g.done) return;
            g.typed = k === 'del' ? g.typed.slice(0, -1) : (g.typed + k).replace(/^0+(?=\d)/, '').slice(0, 2);
            var a = document.getElementById('cg-ans'); if (a) a.textContent = g.typed; var o = document.getElementById('cg-ok'); if (o) o.disabled = g.typed === '';
        },
        ok: function () { if (g && !g.done && g.typed !== '') { answer(); } },
        next: function () { if (!g || !g.done) return; clearInterval(show); if (g.i + 1 >= Q) { g.end = true; render(); return; } g.i++; newQ(); render(); },
        close: function () { clearInterval(tick); clearInterval(show); g = null; var m = document.getElementById('countModal'); if (m) m.style.display = 'none'; },
        // for scripts/count-game-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _rects: rectsIn, _count: count
    };
    window.countOpen = function () { CG.open(); };
    document.addEventListener('keydown', onKey);
})();
