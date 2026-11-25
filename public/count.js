/* V101.362 🧊 นับไว (Count Fast) — two eye-and-speed games, solo, against the clock (owner 2026-11-25, pick C: answer, then the answer shows):
   🟥 Count the Rectangles — a line drawing; how many rectangles are in it (every rectangle whose four sides are drawn lines).
   🧊 Count the Cubes — a stack seen from the corner; how many cubes (the stack has no holes and no overhangs, so hidden ones count too).
   5 questions a run, 30 s each, a number pad; after each answer the picture explains it (rectangles light up one by one / every column shows its height).
   Reads and writes nothing but localStorage countBest_rect / countBest_cube / countTourSeen. window.CG, window.countOpen. A room with friends = later.
   V101.367 (owner "Build A + the ❓ tour", mockup-count-tour/): a 44 px pad, the answer and ✓ on one row (✓ grey until a number), 5 round
   dots, a fuller question saying what counts, ? in the header; a 3-scene tour plays INSIDE the popup (fixed height, so ถัดไป ▸ never
   moves) — on the first open, and from ?; the clock waits while it is open.
   V101.371 (owner: "เพิ่มโหมดไม่นับถอยหลังเวลา แต่เก็บ stat ให้ ADMIN และ user ทราบ" · "เฉลยควรบอกวิธีนับ พร้อมตัวเลขกำกับ", mockup-count-free/):
   a lobby chip rail ⏱ แข่งเวลา / 🧘 ไม่จับเวลา (kept: countFree). 🧘 = the clock counts up in grey, no question ends on time, no points;
   the end shows ✓ n/5 · total · average and each question's seconds; a best total is kept only for 5/5 (countFreeBest_rect / _cube);
   the admin log says "rect free" / "cube free". The answer (both modes): 🟥 pick C = every rectangle as a small numbered picture, grouped
   by how many pieces it covers, with "1 ช่อง a + 2 ช่อง b … = n รูป" (the old one-by-one lighting is gone); 🧊 pick B = a top-view table
   of heights beside the stack, each row's sum and "… = n ก้อน".
   V101.373 (owner "tutorial ครบ? ขอเสียงบรรยายไทยด้วย"): each ❓ scene reads itself in Thai — public/count-voice/t1…t3.mp3, made once
   with Paxa TTS (voice foithong, like 🥣 / 🐺; no call at play time). 🔊 / 🔇 beside ✕ in the tour, kept as countVoice; ข้าม / ✕ / the
   next scene stop it; with the voice on, scene 1's three steps keep its pace (2.6 s each). */
(function () {
    'use strict';
    var Q = 5, SEC = 30, MODES = { rect: { e: '🟥', n: 'สี่เหลี่ยม', ask: 'มีสี่เหลี่ยมกี่รูป?', sub: 'รวมรูปซ้อน · รวมกรอบนอก' }, cube: { e: '🧊', n: 'ลูกบาศก์', ask: 'มีลูกบาศก์กี่ก้อน?', sub: 'รวมก้อนที่ถูกบัง' } };
    var tour = null, tourT = null;   // V101.367: { i: scene, step: 1–3 on scene 1 }
    var aud = null;   // V101.373: the ❓ voice now playing
    function vOn() { try { return localStorage.getItem('countVoice') !== 'off'; } catch (e) { return true; } }
    function hush() { if (aud) { try { aud.pause(); } catch (e) { } aud = null; } }
    function say(i) { hush(); if (!vOn()) return; try { aud = new Audio('count-voice/t' + (i + 1) + '.mp3'); var p = aud.play(); if (p && p.catch) p.catch(function () { /* the phone wants a tap first */ }); } catch (e) { aud = null; } }
    var rng = Math.random, g = null, tick = null;
    function mmss(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
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
    function rectSvg(p, lit) {   // lit = one rectangle to light (a small answer picture)
        var U = 36, P = 6, s = '';
        if (lit) s += '<rect class="lit" data-x1="' + lit[0] + '" data-y1="' + lit[1] + '" data-x2="' + lit[2] + '" data-y2="' + lit[3] + '" x="' + (P + lit[0] * U) + '" y="' + (P + lit[1] * U) + '" width="' + (lit[2] - lit[0]) * U + '" height="' + (lit[3] - lit[1]) * U + '" fill="rgba(249,115,22,.35)" stroke="#ea580c" stroke-width="7"/>';
        // one line per straight run (unit pieces leave seams)
        for (var y = 0; y <= p.H; y++) for (var x = 0; x < p.W; x++) if (p.hs[x + ',' + y] && !p.hs[(x - 1) + ',' + y]) { var e = x; while (p.hs[e + ',' + y]) e++; s += '<line x1="' + (P + x * U) + '" y1="' + (P + y * U) + '" x2="' + (P + e * U) + '" y2="' + (P + y * U) + '"/>'; }
        for (var x2 = 0; x2 <= p.W; x2++) for (var y2 = 0; y2 < p.H; y2++) if (p.vs[x2 + ',' + y2] && !p.vs[x2 + ',' + (y2 - 1)]) { var e2 = y2; while (p.vs[x2 + ',' + e2]) e2++; s += '<line x1="' + (P + x2 * U) + '" y1="' + (P + y2 * U) + '" x2="' + (P + x2 * U) + '" y2="' + (P + e2 * U) + '"/>'; }
        return '<svg class="cg-svg" viewBox="0 0 ' + (p.W * U + 2 * P) + ' ' + (p.H * U + 2 * P) + '" stroke="#0f172a" stroke-width="' + (lit ? 4 : 2.5) + '" stroke-linecap="square">' + s + '</svg>';
    }
    // V101.371 pick C: every rectangle as a small numbered picture, grouped by the pieces it covers (a piece = a rectangle with none inside)
    function rectAnswer(p) {
        var inside = function (o, r) { return o[0] >= r[0] && o[1] >= r[1] && o[2] <= r[2] && o[3] <= r[3]; };
        var mins = p.ans.filter(function (r) { return !p.ans.some(function (o) { return o !== r && inside(o, r); }); });
        var list = p.ans.map(function (r) { return { r: r, k: mins.filter(function (m) { return inside(m, r); }).length }; })
            .sort(function (a, b) { return a.k - b.k || a.r[1] - b.r[1] || a.r[0] - b.r[0] || (a.r[2] - a.r[0]) - (b.r[2] - b.r[0]); });
        var groups = [], n = 0;
        list.forEach(function (it) { var last = groups[groups.length - 1]; if (!last || last.k !== it.k) groups.push(last = { k: it.k, items: [] }); last.items.push(it); });
        return '<div class="cg-thumbs" id="cg-thumbs">' + groups.map(function (gr) {
            return '<h5>' + gr.k + ' ช่อง · ' + gr.items.length + ' รูป</h5>' + gr.items.map(function (it) { n++; return '<div class="cg-th">' + rectSvg(p, it.r) + '<b>' + n + '</b></div>'; }).join('');
        }).join('') + '</div><div class="cg-eq" id="cg-eq">' + groups.map(function (gr) { return gr.k + ' ช่อง <em>' + gr.items.length + '</em>'; }).join(' + ') + ' = <em>' + p.n + '</em> รูป</div>';
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

    // V101.371 pick B: the stack seen from above — a table of heights, each row's sum, then the whole sum
    function cubeAnswer(p) {
        var sums = p.h.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
        return '<div class="cg-cubeb">' + cubeSvg(p, true) + '<table id="cg-topv" aria-label="Heights seen from above">' + p.h.map(function (r, i) {
            return '<tr>' + r.map(function (v) { return '<td class="h' + (v ? '' : ' z') + '">' + v + '</td>'; }).join('') + '<td class="s">=' + sums[i] + '</td></tr>';
        }).join('') + '</table></div>';
    }
    function cubeEq(p) { var sums = p.h.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); }).filter(Boolean); return '<div class="cg-note">มองจากด้านบน · เลข = ความสูงของแต่ละกอง</div><div class="cg-eq" id="cg-eq">' + sums.map(function (x) { return '<em>' + x + '</em>'; }).join(' + ') + ' = <em>' + p.n2 + '</em> ก้อน</div>'; }

    // ---- game -------------------------------------------------------------------------------------------------------------
    function count(p) { return p.mode === 'rect' ? p.n : p.n2; }
    function newQ() { g.p = g.mode === 'rect' ? rectPuzzle(g.i) : cubePuzzle(g.i); g.typed = ''; g.left = SEC; g.el = 0; g.done = null; startTick(); }
    function startTick() { clearInterval(tick); tick = setInterval(function () { if (!g || g.done) return clearInterval(tick); if (tour) return; if (g.free) { g.el++; return paintClock(); } g.left--; if (g.left <= 0) { g.left = 0; answer(); } else paintClock(); }, 1000); }
    function answer() {
        clearInterval(tick); var right = g.typed !== '' && +g.typed === count(g.p), pts = right && !g.free ? 100 + g.left * 5 : 0;
        g.score += pts; if (right) g.right++; g.res.push(right); g.qt.push(g.free ? g.el : SEC - g.left); g.done = { right: right, pts: pts, typed: g.typed }; render();
    }
    function paintClock() { var e = document.getElementById('cg-clock'); if (!e) return; if (g.free) { e.textContent = '⏱ ' + mmss(g.el); return; } e.textContent = '⏱ 0:' + (g.left < 10 ? '0' : '') + g.left; e.classList.toggle('low', g.left <= 5); }

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
        + '.cg-modes i{font-style:normal;font-size:2em}.cg-modes small{color:#64748b;font-weight:700}.cg-note{color:#64748b;font-size:.85em;text-align:center}'
        // V101.367: lean pad · answer + ✓ one row · dots · ? · the tour (DESIGN §9: focus shows, nothing moves with reduced motion)
        + '#countModal button:focus-visible{outline:3px solid #f97316;outline-offset:2px}'
        + '#countModal .cg-pad{gap:6px}#countModal .cg-pad button{font-size:1.15em;padding:0;height:44px}'
        + '.cg-ask small{display:block;font-size:.72em;font-weight:700;color:#64748b;margin-top:2px}'
        + '.cg-row{display:flex;gap:8px;align-items:stretch}.cg-row .cg-ans{flex:1;font-size:1.6em;padding:2px;min-height:1.3em}#countModal .cg-row .cg-go{width:84px;font-size:1.3em;padding:0;border-radius:14px}'
        + '#countModal .cg-go{transition:none}#countModal .cg-go:disabled{background:#e2e8f0;color:#94a3b8;opacity:1}'   // §9.1: the app-wide button transition: all made ✓ fade
        + '.cg-dots{display:flex;gap:6px;justify-content:center}.cg-dots i{width:14px;height:14px;border-radius:50%;background:#e2e8f0;display:block;box-sizing:border-box}.cg-dots i.ok{background:#16a34a}.cg-dots i.no{background:#dc2626}.cg-dots i.now{background:#fff;border:2px dashed #f97316}'
        + '#countModal .cg-q{border:1px solid #e2e8f0;background:#fff;border-radius:999px;width:26px;height:26px;font-weight:900;color:#475569;padding:0;flex:0 0 auto}'
        + '.cg-tfig{height:190px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;box-sizing:border-box;display:flex;align-items:center;justify-content:center}.cg-tfig svg{width:100%;height:100%}'
        + '.cg-tcap{text-align:center;font-weight:900;font-size:1.05em;height:3em;overflow:hidden}.cg-tcap small{display:block;font-weight:700;color:#64748b;font-size:.8em;margin-top:2px}'
        + '.cg-tsteps{display:flex;gap:6px;justify-content:center;align-items:center;height:28px;overflow:hidden}.cg-tsteps span{border-radius:999px;padding:3px 10px;font-weight:800;font-size:.85em;background:#f1f5f9;color:#475569}.cg-tsteps span.on{background:#ffedd5;color:#c2410c}'
        + '.cg-tnav{display:flex;align-items:center;gap:8px}.cg-tdots{flex:1;display:flex;gap:5px;justify-content:center}.cg-tdots i{width:8px;height:8px;border-radius:50%;background:#e2e8f0}.cg-tdots i.on{background:#ea580c}'
        + '#countModal .cg-tnav button{border:0;border-radius:12px;padding:10px 14px;font-weight:900}#countModal .cg-tskip{background:none;color:#94a3b8}#countModal .cg-tnext{background:#f97316;color:#fff}'
        + '.cg-trules{font-size:1.4em;line-height:1.8;text-align:center;font-weight:800;color:#0f172a}'
        // V101.371: 🧘 rail + counting-up clock + end stats · the answer that teaches
        + '.cg-rail{display:flex;gap:6px;justify-content:center}#countModal .cg-rail button{border-radius:999px;padding:7px 14px;font-weight:800;font-size:.9em;border:1px solid #fed7aa;background:#fff;color:#9a3412;min-height:36px;transition:none}#countModal .cg-rail button.on{background:#f97316;border-color:#f97316;color:#fff}'
        + '.cg-pill.t.up{background:#f1f5f9;color:#475569}'
        + '.cg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.cg-stats div{background:#fff7ed;border-radius:12px;padding:8px 4px;text-align:center;font-weight:900;font-size:1.15em}.cg-stats small{display:block;font-size:.62em;color:#9a3412;font-weight:700}'
        + '.cg-qt{display:flex;gap:4px;justify-content:center;flex-wrap:wrap}.cg-qt span{border-radius:8px;padding:3px 7px;font-size:.8em;font-weight:800;background:#dcfce7;color:#166534}.cg-qt span.no{background:#fee2e2;color:#991b1b}'
        + '.cg-thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.cg-thumbs h5{grid-column:1/-1;margin:4px 0 0;font-size:.8em;color:#475569}.cg-th{border:1px solid #e2e8f0;border-radius:8px;padding:3px;text-align:center;background:#fff}.cg-th b{display:block;font-size:.8em;color:#ea580c}'
        + '.cg-eq{text-align:center;font-weight:900;color:#0f172a;font-size:.95em}.cg-eq em{font-style:normal;color:#ea580c}'
        + '.cg-cubeb{display:flex;gap:10px;align-items:center;justify-content:center;width:100%}.cg-cubeb .cg-svg{width:48%}#cg-topv{border-collapse:collapse;font-weight:900}#cg-topv td{width:28px;height:28px;text-align:center;border:1px solid #cbd5e1;background:#fff}#cg-topv td.z{color:#cbd5e1}#cg-topv td.s{border:0;background:none;color:#ea580c;width:36px}';
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
    function q() { return '<button type="button" class="cg-q" id="cg-help" onclick="CG.tour()" aria-label="How to count" title="How to count" data-th-title="วิธีนับ">?</button>'; }
    function dots() { var h = '<div class="cg-dots" aria-label="Questions">'; for (var i = 0; i < Q; i++) h += '<i class="' + (i < g.res.length ? (g.res[i] ? 'ok' : 'no') : i === g.i && !g.done ? 'now' : '') + '"></i>'; return h + '</div>'; }
    function lobbyHtml() {
        var free = get('countFree') === 1;
        return '<div class="cg"><div class="cg-top"><h3>🧊 นับไว</h3>' + q() + x() + '</div>'
            + '<div class="cg-rail" role="group" aria-label="Timer"><button type="button" id="cg-timed" class="' + (free ? '' : 'on') + '" aria-pressed="' + !free + '" onclick="CG.free(0)">⏱ แข่งเวลา ' + SEC + ' วิ</button><button type="button" id="cg-free" class="' + (free ? 'on' : '') + '" aria-pressed="' + free + '" onclick="CG.free(1)">🧘 ไม่จับเวลา</button></div>'
            + '<div class="cg-modes">' + ['rect', 'cube'].map(function (k) { var b = get(free ? 'countFreeBest_' + k : 'countBest_' + k); return '<button type="button" id="cg-' + k + '" onclick="CG.start(\'' + k + '\')"><i>' + MODES[k].e + '</i>' + MODES[k].n + '<small>' + (free ? (b ? '⏱ ดีสุด ' + mmss(b) : Q + ' ข้อ · ไม่จับเวลา') : b ? '🏆 ' + b : Q + ' ข้อ · ' + SEC + ' วิ') + '</small></button>'; }).join('') + '</div>'
            + '<div class="cg-note">' + (free ? 'ไม่มีนับถอยหลัง · จับเวลาไว้ดูทีหลัง' : 'ตอบแล้วดูเฉลยทุกข้อ') + '</div></div>';
    }
    function playHtml() {
        var p = g.p, d = g.done, m = MODES[g.mode];
        var h = '<div class="cg"><div class="cg-top"><h3>' + m.e + ' ' + (g.i + 1) + '/' + Q + '</h3>' + (g.free ? '<span class="cg-pill t up" id="cg-clock">⏱ ' + mmss(g.el) + '</span><span class="cg-pill" id="cg-right">✓ ' + g.right + '</span>' : '<span class="cg-pill t" id="cg-clock">⏱ 0:' + (g.left < 10 ? '0' : '') + g.left + '</span><span class="cg-pill">🏆 ' + g.score + '</span>') + q() + x() + '</div>' + dots()
            + '<div class="cg-fig" id="cg-fig"' + (d && p.mode === 'rect' ? ' style="display:none"' : '') + '>' + (p.mode === 'rect' ? rectSvg(p) : d ? cubeAnswer(p) : cubeSvg(p, false)) + '</div>';
        if (!d) {
            h += '<div class="cg-ask" id="cg-ask">' + m.ask + '<small>' + m.sub + '</small></div>'
                + '<div class="cg-row"><div class="cg-ans" id="cg-ans">' + g.typed + '</div><button type="button" class="cg-go" id="cg-ok" onclick="CG.ok()" aria-label="Answer"' + (g.typed === '' ? ' disabled' : '') + '>✓</button></div><div class="cg-pad">'
                + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (k) { return '<button type="button" onclick="CG.key(' + k + ')">' + k + '</button>'; }).join('')
                + '<button type="button" onclick="CG.key(\'del\')" aria-label="Delete">⌫</button><button type="button" onclick="CG.key(0)">0</button></div>';
        } else {
            var n = count(p);
            h += '<div class="cg-res ' + (d.right ? 'ok' : 'no') + '" id="cg-res">' + (d.right ? '✓ ' + n + ' ถูก' + (g.free ? '' : ' · +' + d.pts) : (d.typed === '' ? '⏱ หมดเวลา' : '✗ ตอบ ' + d.typed))   /* V101.372: the answer n shows once, in the #cg-eq sum line */ + (d.typed === '' && !g.free ? '' : '<span class="cg-took" id="cg-took"> · ⏱ ' + g.qt[g.i] + ' วิ</span>') + '</div>'
                + (p.mode === 'rect' ? rectAnswer(p) : cubeEq(p))
                + '<button type="button" class="cg-go" id="cg-next" onclick="CG.next()">' + (g.i + 1 < Q ? '▸ ข้อถัดไป' : '🏁 ดูคะแนน') + '</button>';
        }
        return h + '</div>';
    }
    function qtRow() { return '<div class="cg-qt" id="cg-qt">' + g.qt.map(function (s, i) { return '<span class="' + (g.res[i] ? 'ok' : 'no') + '">ข้อ' + (i + 1) + ' ' + s + 'วิ</span>'; }).join('') + '</div>'; }   // V101.372: both modes
    function endHtml() {
        if (g.free) {   // V101.371 🧘: right · total · average, each question's seconds; a best total only for 5/5
            var tot = g.qt.reduce(function (a, b) { return a + b; }, 0), fk = 'countFreeBest_' + g.mode, fb = get(fk), fnb = g.right === Q && (!fb || tot < fb);
            if (fnb) set(fk, tot);
            return '<div class="cg"><div class="cg-top"><h3>' + MODES[g.mode].e + ' จบรอบ · 🧘</h3>' + x() + '</div>'
                + '<div class="cg-stats" id="cg-stats"><div>✓ ' + g.right + '/' + Q + '<small>ถูก</small></div><div>' + mmss(tot) + '<small>เวลารวม</small></div><div>' + Math.round(tot / Q) + ' วิ<small>เฉลี่ย/ข้อ</small></div></div>'
                + qtRow()
                + '<div class="cg-note" id="cg-best">' + (fnb ? '🎉 สถิติใหม่ · ดีสุด ' + mmss(tot) : fb ? 'ดีสุด ' + mmss(fb) + ' (✓ 5/5)' : 'ถูกครบ 5 ข้อ = เก็บสถิติเวลา') + '</div>'
                + '<button type="button" class="cg-go" onclick="CG.start(\'' + g.mode + '\')">↻ เล่นอีก</button><button type="button" class="cg-x" style="align-self:center" onclick="CG.lobby()">⬅ เลือกเกม</button></div>';
        }
        var best = get('countBest_' + g.mode), nb = g.score > best; if (nb) set('countBest_' + g.mode, g.score);
        return '<div class="cg"><div class="cg-top"><h3>' + MODES[g.mode].e + ' จบรอบ</h3>' + x() + '</div>'
            + '<div class="cg-ans" id="cg-final">🏆 ' + g.score + '</div><div class="cg-note">✓ ' + g.right + '/' + Q + (nb ? ' · 🎉 สถิติใหม่' : best ? ' · สถิติ ' + best : '') + '</div>' + qtRow()
            + '<button type="button" class="cg-go" onclick="CG.start(\'' + g.mode + '\')">↻ เล่นอีก</button><button type="button" class="cg-x" style="align-self:center" onclick="CG.lobby()">⬅ เลือกเกม</button></div>';
    }
    // ---- ❓ the tour (V101.367): 3 scenes inside the popup ------------------------------------------------------------------------
    function tourRect(k) {   // a box split in two: ① left ② right ③ the whole box
        var U = 70, P = 8, on = function (a, b) { return '<rect x="' + (P + a * U) + '" y="' + P + '" width="' + (b - a) * U + '" height="' + U + '" fill="rgba(249,115,22,.25)" stroke="#ea580c" stroke-width="6"/>'; };
        return '<svg viewBox="0 0 ' + (2 * U + 2 * P) + ' ' + (U + 2 * P) + '" width="300">' + (k === 1 ? on(0, 1) : k === 2 ? on(1, 2) : on(0, 2))
            + '<g stroke="#0f172a" stroke-width="3" fill="none"><rect x="' + P + '" y="' + P + '" width="' + 2 * U + '" height="' + U + '"/><line x1="' + (P + U) + '" y1="' + P + '" x2="' + (P + U) + '" y2="' + (P + U) + '"/></g></svg>';
    }
    function tourCubes() {   // 5 cubes: a back column of 2 and three in front; the hidden one is dashed
        var p = { n: 2, h: [[2, 1], [1, 1]] }, s = cubeSvg(p, false);
        var a = 22, b = 12.7, z = 25, cx = 2 * a + 6, top = 4 * z + 4, pt = function (X, Y, K) { return (cx + (X - Y) * a).toFixed(1) + ',' + (top + (X + Y) * b - K * z).toFixed(1); };
        var d = ' fill="rgba(249,115,22,.12)" stroke="#ea580c" stroke-width="1.6" stroke-dasharray="4 3"';
        var hid = '<polygon' + d + ' points="' + [pt(0, 0, 1), pt(1, 0, 1), pt(1, 1, 1), pt(0, 1, 1)].join(' ') + '"/><polygon' + d + ' points="' + [pt(0, 1, 1), pt(1, 1, 1), pt(1, 1, 0), pt(0, 1, 0)].join(' ') + '"/><polygon' + d + ' points="' + [pt(1, 0, 1), pt(1, 1, 1), pt(1, 1, 0), pt(1, 0, 0)].join(' ') + '"/>';
        return s.replace(/viewBox="[^"]+"/, 'viewBox="2 48 96 110"').replace('</svg>', hid + '</svg>');   // crop to the stack
    }
    function tourHtml() {
        var i = tour.i, k = tour.step, fig, cap, steps = '';
        if (i === 0) { fig = tourRect(k); cap = (k === 1 ? '① ช่องซ้าย' : k === 2 ? '② ช่องขวา' : '③ รวมทั้งกรอบ = <b>3 รูป</b>') + '<small>นับทุกสี่เหลี่ยม · รวมกรอบนอก</small>';
            steps = ['① ซ้าย', '② ขวา', '③ ทั้งกรอบ'].map(function (t, n) { return '<span class="' + (n < k ? 'on' : '') + '">' + t + '</span>'; }).join(''); }
        else if (i === 1) { fig = tourCubes(); cap = 'ก้อนที่ถูกบัง (เส้นประ) ก็นับ = <b>5 ก้อน</b><small>กองไม่มีรู · ไม่มีก้อนลอย</small>'; }
        else { fig = '<div class="cg-trules">⏱ ' + SEC + ' วิ · ' + Q + ' ข้อ<br>⌨️ ตอบ → 💡 ดูเฉลย</div>'; cap = 'ตอบถูกเร็ว = 🏆 มาก · 🧘 ไม่จับเวลาก็ได้'; }
        return '<div class="cg" id="cg-tour"><div class="cg-top"><h3>❓ วิธีนับ</h3><button type="button" class="cg-x" id="cg-voice" onclick="CG.voice()" aria-label="Sound" aria-pressed="' + vOn() + '">' + (vOn() ? '🔊' : '🔇') + '</button><button type="button" class="cg-x" onclick="CG.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<div class="cg-tfig" id="cg-tfig">' + fig + '</div><div class="cg-tcap" id="cg-tcap">' + cap + '</div><div class="cg-tsteps">' + steps + '</div>'
            + '<div class="cg-tnav"><button type="button" class="cg-tskip" onclick="CG.tourEnd()">ข้าม</button><div class="cg-tdots">' + [0, 1, 2].map(function (n) { return '<i class="' + (n === i ? 'on' : '') + '"></i>'; }).join('') + '</div>'
            + '<button type="button" class="cg-tnext" id="cg-tnext" onclick="CG.tourNext()">' + (i === 2 ? '▸ เริ่ม' : 'ถัดไป ▸') + '</button></div></div>';
    }
    function tourScene(i) {
        clearInterval(tourT); var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        tour = { i: i, step: i === 0 && !still ? 1 : 3 }; render(); say(i);
        if (i === 0 && !still) tourT = setInterval(function () { if (!tour || tour.i !== 0) return clearInterval(tourT); tour.step++; if (tour.step >= 3) clearInterval(tourT); render(); }, vOn() ? 2600 : 900);
    }
    function render() { var m = root(); document.getElementById('cg-body').innerHTML = tour ? tourHtml() : !g ? lobbyHtml() : g.end ? endHtml() : playHtml(); m.style.display = 'flex';
        if (g && !tour && window.GameLog) GameLog.see('count', { id: g.gid || (g.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), n: g.res.length, done: !!g.end, mode: g.mode + (g.free ? ' free' : ''), win: null, score: g.right + '/' + Q, res: g.res.map(function (x) { return x ? 'ok' : 'no'; }) });   // V101.370 🎮 game time for the admin (game-log.js)
    }
    function onKey(e) {
        var m = document.getElementById('countModal'); if (!m || m.style.display !== 'flex') return;
        if (tour) { if (e.key === 'Escape') CG.tourEnd(); else if (e.key === 'Enter') { e.preventDefault(); CG.tourNext(); } return; }
        if (e.key === 'Escape') return CG.close(); if (!g || g.end) return;
        if (g.done) { if (e.key === 'Enter') { e.preventDefault(); CG.next(); } return; }
        if (/^[0-9]$/.test(e.key)) CG.key(+e.key); else if (e.key === 'Backspace') CG.key('del'); else if (e.key === 'Enter') { e.preventDefault(); CG.ok(); }
    }

    window.CG = {
        open: function () { g = null; if (!get('countTourSeen')) tourScene(0); else render(); },   // V101.367: the tour on the first open
        tour: function () { tourScene(0); },
        tourNext: function () { if (!tour) return; if (tour.i < 2) tourScene(tour.i + 1); else CG.tourEnd(); },
        tourEnd: function () { clearInterval(tourT); hush(); tour = null; set('countTourSeen', 1); render(); },   // back to the lobby / the same question
        lobby: function () { clearInterval(tick); g = null; render(); },
        free: function (v) { set('countFree', v ? 1 : 0); render(); },   // V101.371: ⏱ / 🧘, kept on the phone
        start: function (mode) { g = { mode: mode, i: 0, score: 0, right: 0, res: [], qt: [], free: get('countFree') === 1 }; newQ(); render(); },
        key: function (k) {
            if (!g || g.done) return;
            g.typed = k === 'del' ? g.typed.slice(0, -1) : (g.typed + k).replace(/^0+(?=\d)/, '').slice(0, 2);
            var a = document.getElementById('cg-ans'); if (a) a.textContent = g.typed; var o = document.getElementById('cg-ok'); if (o) o.disabled = g.typed === '';
        },
        ok: function () { if (g && !g.done && g.typed !== '') { answer(); } },
        next: function () { if (!g || !g.done) return; if (g.i + 1 >= Q) { g.end = true; render(); return; } g.i++; newQ(); render(); },
        voice: function () { try { localStorage.setItem('countVoice', vOn() ? 'off' : 'on'); } catch (e) { } if (vOn() && tour) say(tour.i); else hush(); render(); },   // V101.373 🔊 / 🔇
        close: function () { clearInterval(tick); clearInterval(tourT); hush(); tour = null; g = null; var m = document.getElementById('countModal'); if (m) m.style.display = 'none'; },
        // for scripts/count-game-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _rects: rectsIn, _count: count
    };
    window.countOpen = function () { CG.open(); };
    document.addEventListener('keydown', onKey);
})();
