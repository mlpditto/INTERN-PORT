/* V101.377 🔢 เลขลับ · โหมดฝึก 🤖 (owner 2026-11-26: game 1 of docs/MIND-GAMES-PLAN.md, inspired by a game-show mechanic, our own name and
   look; picks: the 5th tile in the games row · help levels 🟩 the app crosses out (C1) → ✏️ you cross out (C2) → 📏 the range bar only
   (B) → 🧠 no help, the log only (A) · a ❓ tour read aloud in Thai, mockup-secret-number/). 🤖 thinks of 1–100; each question from the
   menu costs 🎫 1 and is answered truthfully; a wrong guess costs 🎫 1 more. Score = 🎫 used, fewer is better; a best per help level
   (snBest_h<n>); game_plays: game 'secret', mode 'h<n>', win 'w', score = 🎫 (🏆 Top 3 counts 🧠 only). window.SN, window.secretOpen. */
(function () {
    'use strict';
    var MAX = 100, rng = Math.random, g = null, help = 1, toast = null, pend = null, cross = false;
    var HELP = { 1: ['🟩', 'ขีดให้'], 2: ['✏️', 'ขีดเอง'], 3: ['📏', 'แถบช่วง'], 4: ['🧠', 'ไม่มีตัวช่วย'] };
    // the question menu: [id, chip, needs numbers, test(n, a, b), the asked line]
    var QS = [
        ['gt', '> __ ?', 1, function (n, a) { return n > a; }, function (a) { return 'มากกว่า ' + a + ' ?'; }],
        ['even', 'คู่ ?', 0, function (n) { return n % 2 === 0; }, function () { return 'เลขคู่ ?'; }],
        ['div3', 'หาร 3 ลงตัว ?', 0, function (n) { return n % 3 === 0; }, function () { return 'หาร 3 ลงตัว ?'; }],
        ['prime', 'จำนวนเฉพาะ ?', 0, function (n) { if (n < 2) return false; for (var d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }, function () { return 'จำนวนเฉพาะ ?'; }],
        ['unit', 'หลักหน่วย = __ ?', 1, function (n, a) { return n % 10 === a; }, function (a) { return 'หลักหน่วยคือ ' + a + ' ?'; }],
        ['range', 'อยู่ใน __–__ ?', 2, function (n, a, b) { return n >= Math.min(a, b) && n <= Math.max(a, b); }, function (a, b) { return 'อยู่ใน ' + Math.min(a, b) + '–' + Math.max(a, b) + ' ?'; }]
    ];
    function q(id) { for (var i = 0; i < QS.length; i++) if (QS[i][0] === id) return QS[i]; return null; }
    function get(k) { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } }
    function set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    /** numbers still possible after every answer (and every wrong guess) */
    function live() {
        var out = [];
        for (var n = 1; n <= MAX; n++) {
            var ok = g.wrong.indexOf(n) < 0;
            for (var i = 0; ok && i < g.log.length; i++) { var L = g.log[i], Q = q(L.id); if (Q[3](n, L.a, L.b) !== L.ans) ok = false; }
            if (ok) out.push(n);
        }
        return out;
    }
    function S(k) { if (window.BWSound && BWSound.on && BWSound.on() && BWSound.play) { try { BWSound.play(k); } catch (e) { } } }

    // ---- ❓ the tour: 4 scenes, each read aloud (public/secret-voice/t1…t4.mp3, Paxa foithong, made once) ----------------------------
    var tour = -1, aud = null;
    function seen() { try { return !!localStorage.getItem('snTourSeen'); } catch (e) { return true; } }
    function vOn() { try { return localStorage.getItem('snVoice') !== 'off'; } catch (e) { return true; } }
    function hush() { if (aud) { try { aud.pause(); } catch (e) { } aud = null; } }
    function say(i) { hush(); if (!vOn()) return; try { aud = new Audio('secret-voice/t' + (i + 1) + '.mp3'); var p = aud.play(); if (p && p.catch) p.catch(function () { /* needs a tap first */ }); } catch (e) { aud = null; } }
    var TOUR = [
        ['🤖 คิดเลขลับไว้ 1 ตัว<br>ตั้งแต่ 1 ถึง 100', 'The bot keeps a number from 1 to 100.', function () { return '<div class="sn-big">🤖 💭 <b>?</b></div>'; }],
        ['แตะคำถาม เช่น “มากกว่า 50 ?”<br>🤖 ตอบจริงเสมอ · ใช้ 🎫 1 ใบ', 'Ask from the menu — always a true answer, 1 🎫.', function () { return '<div class="sn-log"><div><span>มากกว่า 50 ?</span><b class="no">✗ ไม่</b></div><div><span>เลขคู่ ?</span><b class="yes">✓ ใช่</b></div></div>'; }],
        ['ตารางขีดเลขที่ตัดทิ้งได้ให้<br>แตะเลขที่เหลือ = ทาย · ผิดเสีย 🎫 1', 'The board crosses out; tap a number to guess.', function () { var h = ''; for (var n = 1; n <= 30; n++) h += '<span class="' + (n % 2 || n < 20 ? 'out' : '') + '">' + n + '</span>'; return '<div class="sn-grid sm">' + h + '</div>'; }],
        ['ใช้ 🎫 น้อยสุด = เก่งสุด<br>อยากยากขึ้น: ✏️ ขีดเอง · 📏 · 🧠', 'Fewest 🎫 wins · harder: cross out yourself, or no help.', function () { return '<div class="sn-lvs">' + [1, 2, 3, 4].map(function (k) { return '<span class="' + (k === 1 ? 'on' : '') + '">' + HELP[k][0] + ' ' + HELP[k][1] + '</span>'; }).join('') + '</div>'; }]
    ];
    function tourHtml() {
        var s = TOUR[tour];
        return '<div class="sn sn-tour" id="sn-tour"><div class="sn-top"><h3>❓ วิธีเล่น</h3><span class="sn-pill">' + (tour + 1) + '/4</span>'
            + '<button type="button" class="sn-x" id="sn-voice" onclick="SN.voice()" aria-label="Sound" aria-pressed="' + vOn() + '">' + (vOn() ? '🔊' : '🔇') + '</button>'
            + '<button type="button" class="sn-x" onclick="SN.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<div class="sn-say" id="sn-tcap">' + s[0] + '<small>' + s[1] + '</small></div>' + s[2]()
            + '<div class="sn-tnav"><button type="button" class="sn-skip" onclick="SN.tourEnd()">ข้าม</button><div class="sn-dots">' + [0, 1, 2, 3].map(function (n) { return '<i class="' + (n === tour ? 'on' : '') + '"></i>'; }).join('') + '</div>'
            + '<button type="button" class="sn-go" id="sn-tnext" onclick="SN.tourNext()">' + (tour === 3 ? '▸ เริ่ม' : 'ถัดไป ▸') + '</button></div></div>';
    }

    // ---- drawing -----------------------------------------------------------------------------------------------------------------
    var CSS = '#snModal .modal-content{max-width:420px;padding:14px;border-radius:20px}'
        + '#snModal .sn{display:flex;flex-direction:column;gap:9px;color:#0f172a}#snModal button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#snModal .sn-top{display:flex;align-items:center;gap:6px}#snModal .sn-top h3{margin:0;font-size:1.1em;color:#0f766e;flex:1;white-space:nowrap}'
        + '#snModal .sn-pill{border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:.8em;font-weight:800;white-space:nowrap}'
        + '#snModal .sn-x{background:none;border:0;font-size:1.15em;color:#94a3b8;padding:2px 4px}'
        + '#snModal .sn-chips,#snModal .sn-lvs{display:flex;flex-wrap:wrap;gap:6px}#snModal .sn-chips button,#snModal .sn-lvs button,#snModal .sn-lvs span{border:1px solid #99f6e4;border-radius:999px;padding:6px 11px;font-size:.82em;font-weight:800;color:#115e59;background:#f0fdfa}'
        + '#snModal .sn-chips button.on,#snModal .sn-lvs .on{background:#0d9488;color:#fff;border-color:#0d9488}'
        + '#snModal .sn-row{display:flex;gap:8px;align-items:center}#snModal .sn-row input{width:64px;font-size:16px;font-weight:900;text-align:center;border:2px solid #99f6e4;border-radius:12px;padding:8px 4px;color:#0f766e}'
        + '#snModal .sn-go{background:#0d9488;color:#fff;border:0;border-radius:14px;padding:11px 16px;font-weight:900;font-size:1em}#snModal .sn-go.alt{background:#fff;color:#0f766e;border:2px solid #0d9488}#snModal .sn-go:disabled{opacity:.45}'
        + '#snModal .sn-log{display:flex;flex-direction:column;gap:4px;font-size:.85em;max-height:150px;overflow:auto}#snModal .sn-log div{display:flex;justify-content:space-between;background:#f8fafc;border-radius:10px;padding:5px 9px}'
        + '#snModal .yes{color:#15803d}#snModal .no{color:#b91c1c}'
        + '#snModal .sn-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}#snModal .sn-grid button,#snModal .sn-grid span{font-size:.72em;text-align:center;padding:5px 0;border-radius:5px;background:#f0fdfa;color:#115e59;font-weight:800;border:0}'
        + '#snModal .sn-grid .out{background:#f1f5f9;color:#cbd5e1;text-decoration:line-through;font-weight:500}#snModal .sn-grid .bad{background:#fee2e2;color:#b91c1c}'
        + '#snModal .sn-bar{position:relative;height:30px;border-radius:10px;background:#e2e8f0;overflow:hidden}#snModal .sn-bar i{position:absolute;top:0;bottom:0;background:#5eead4}#snModal .sn-bar b{position:absolute;top:6px;font-size:.75em;color:#134e4a}'
        + '#snModal .sn-note{font-size:.78em;color:#64748b;text-align:center}#snModal .sn-toast{font-size:.85em;font-weight:800;color:#b45309;text-align:center}'
        + '#snModal .sn-big{font-size:2.6em;font-weight:900;color:#0f766e;text-align:center}'
        + '#snModal .sn-tour{min-height:400px}#snModal .sn-say{background:#f0fdfa;border:1px solid #99f6e4;border-radius:14px;padding:10px 12px;font-weight:800;line-height:1.5;color:#134e4a}#snModal .sn-say small{display:block;font-size:.72em;font-weight:600;color:#64748b}'
        + '#snModal .sn-tnav{display:flex;align-items:center;gap:8px;margin-top:auto}#snModal .sn-skip{background:none;border:0;color:#64748b;font-weight:800}'
        + '#snModal .sn-dots{flex:1;display:flex;gap:4px;justify-content:center}#snModal .sn-dots i{width:6px;height:6px;border-radius:9px;background:#99f6e4;display:block}#snModal .sn-dots i.on{width:16px;background:#0d9488}'
        + '#snModal .sn-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}#snModal .sn-stats div{background:#f0fdfa;border-radius:14px;padding:10px 4px;font-weight:900;font-size:1.2em}#snModal .sn-stats small{display:block;font-size:.6em;color:#0f766e}';
    function root() {
        var m = document.getElementById('snModal');
        if (!m) {
            if (!document.getElementById('sn-css')) { var st = document.createElement('style'); st.id = 'sn-css'; st.textContent = CSS; document.head.appendChild(st); }
            m = document.createElement('div'); m.id = 'snModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Secret number');
            m.innerHTML = '<div class="modal-content"><div id="sn-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) SN.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    var X = '<button type="button" class="sn-x" onclick="SN.close()" aria-label="Close">✕</button>';
    var HQ = '<button type="button" class="sn-x" id="sn-help" onclick="SN.tour()" aria-label="How to play" title="วิธีเล่น">❓</button>';
    function lobbyHtml() {
        return '<div class="sn"><div class="sn-top"><h3>🔢 เลขลับ · 🤖</h3>' + HQ + X + '</div>'
            + (window.GameTop ? GameTop.line('secret') : '')
            + '<div class="sn-note">🤖 คิดเลข 1–100 · ถามได้ทีละข้อ 🎫 1 ใบ · ใช้ 🎫 น้อยสุดชนะ</div>'
            + '<div class="sn-lvs" role="group" aria-label="Help">' + [1, 2, 3, 4].map(function (k) { var b = get('snBest_h' + k); return '<button type="button" id="sn-h' + k + '" class="' + (help === k ? 'on' : '') + '" aria-pressed="' + (help === k) + '" onclick="SN.help(' + k + ')">' + HELP[k][0] + ' ' + HELP[k][1] + (b ? ' · ' + b + '🎫' : '') + '</button>'; }).join('') + '</div>'
            + '<button type="button" class="sn-go" id="sn-start" onclick="SN.start()">▸ เริ่ม</button></div>';
    }
    function askHtml() {
        var Q = pend ? q(pend) : null, h = '<div class="sn-chips" role="group" aria-label="Questions">' + QS.map(function (x) { return '<button type="button" data-q="' + x[0] + '" class="' + (pend === x[0] ? 'on' : '') + '" onclick="SN.pick(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>';
        if (Q) {
            h += '<div class="sn-row">' + (Q[2] ? '<input id="sn-a" type="number" inputmode="numeric" min="' + (Q[0] === 'unit' ? 0 : 1) + '" max="' + (Q[0] === 'unit' ? 9 : MAX) + '" placeholder="' + (Q[0] === 'unit' ? '0–9' : '1–100') + '" aria-label="Number">' : '')
                + (Q[2] === 2 ? '<span>–</span><input id="sn-b" type="number" inputmode="numeric" min="1" max="100" placeholder="1–100" aria-label="To">' : '')
                + '<button type="button" class="sn-go" id="sn-ask" onclick="SN.ask()">ถาม 🎫</button></div>';
        }
        return h;
    }
    function playHtml() {
        var L = live(), h = '<div class="sn"><div class="sn-top"><h3>🔢 เลขลับ · ' + HELP[help][0] + '</h3><span class="sn-pill" id="sn-used">🎫 ' + used() + '</span>' + HQ + X + '</div>';
        if (help === 1 || help === 2) {
            h += '<div class="sn-grid" id="sn-grid">';
            for (var n = 1; n <= MAX; n++) {
                var out = help === 1 ? L.indexOf(n) < 0 : g.mine.indexOf(n) >= 0, bad = g.wrong.indexOf(n) >= 0;
                h += '<button type="button" data-n="' + n + '" class="' + (bad ? 'out bad' : out ? 'out' : '') + '" onclick="SN.cell(' + n + ')"' + (bad ? ' disabled' : '') + '>' + n + '</button>';
            }
            h += '</div>' + (help === 1 ? '<div class="sn-note" id="sn-left">เหลือ ' + L.length + ' ตัว · แตะเลข = ทาย</div>'
                : '<div class="sn-row"><button type="button" class="sn-go' + (cross ? '' : ' alt') + '" id="sn-cross" onclick="SN.mode(1)" aria-pressed="' + cross + '">✏️ ขีด</button><button type="button" class="sn-go' + (cross ? ' alt' : '') + '" id="sn-aim" onclick="SN.mode(0)" aria-pressed="' + !cross + '">🎯 ทาย</button></div>');
        } else if (help === 3) {
            var lo = L[0], hi = L[L.length - 1];
            h += '<div class="sn-bar" id="sn-bar"><i style="left:' + (lo - 1) + '%;width:' + (hi - lo + 1) + '%"></i><b style="left:6px">1</b><b style="right:6px">100</b></div><div class="sn-note" id="sn-range">อยู่ระหว่าง ' + lo + '–' + hi + '</div>';
        }
        h += askHtml();
        if (help >= 3) h += '<div class="sn-row"><input id="sn-g" type="number" inputmode="numeric" min="1" max="100" placeholder="__" aria-label="Your guess"><button type="button" class="sn-go alt" id="sn-guess" onclick="SN.guessBox()">🎯 ทาย</button></div>';
        if (toast) h += '<div class="sn-toast" id="sn-toast">' + toast + '</div>';
        if (g.log.length) h += '<div class="sn-log" id="sn-log">' + g.log.slice().reverse().map(function (x, i) { return '<div><span>' + (g.log.length - i) + ' · ' + esc(x.txt) + '</span><b class="' + (x.ans ? 'yes">✓ ใช่' : 'no">✗ ไม่') + '</b></div>'; }).join('') + '</div>';
        return h + '</div>';
    }
    function endHtml() {
        var b = get('snBest_h' + help), nb = g.newBest, sec = Math.round((g.endAt - g.at) / 1000);
        return '<div class="sn"><div class="sn-top"><h3>🔢 จบ · 🤖 คิดเลข ' + g.n + ' · ' + HELP[help][0] + '</h3>' + X + '</div>'
            + '<div class="sn-big" id="sn-final">🎯 ' + g.n + '</div>'
            + '<div class="sn-stats" id="sn-stats"><div>' + used() + '<small>🎫 ที่ใช้</small></div><div>' + g.wrong.length + '<small>ทายผิด</small></div><div>' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) + '<small>เวลา</small></div></div>'
            + '<div class="sn-note" id="sn-best">' + (nb ? '🎉 สถิติใหม่ · ' : 'ดีสุด ') + b + ' 🎫 · แบ่งครึ่งทุกครั้ง ≈ 7 🎫</div>'
            + '<button type="button" class="sn-go" id="sn-again" onclick="SN.start()">↻ อีกรอบ</button><button type="button" class="sn-x" style="align-self:center" onclick="SN.lobby()">⬅ เปลี่ยนตัวช่วย</button></div>';
    }
    function used() { return g.log.length + g.wrong.length; }
    function render() {
        var m = root(); document.getElementById('sn-body').innerHTML = tour >= 0 ? tourHtml() : !g ? lobbyHtml() : g.end ? endHtml() : playHtml(); m.style.display = 'flex';
        if (g && tour < 0 && window.GameLog) GameLog.see('secret', { id: g.id, n: used(), done: g.end, mode: 'h' + help, win: g.end ? 'w' : null, score: String(used()), res: [] });
    }
    function guess(n) {
        if (!g || g.end) return;
        if (n === g.n) {
            g.end = true; g.endAt = Date.now(); var b = get('snBest_h' + help);
            g.newBest = !b || used() < b; if (g.newBest) set('snBest_h' + help, used()); S('endW');
        } else if (g.wrong.indexOf(n) < 0) { g.wrong.push(n); toast = '✗ ไม่ใช่ ' + n + ' · 🎫 +1'; S('lose'); }
        render();
    }

    window.SN = {
        open: function () { g = null; toast = null; if (!seen()) return SN.tour(); render(); },
        tour: function () { tour = 0; render(); say(0); },
        tourNext: function () { if (tour < 0) return; if (tour < 3) { tour++; render(); say(tour); } else SN.tourEnd(); },
        tourEnd: function () { hush(); tour = -1; try { localStorage.setItem('snTourSeen', '1'); } catch (e) { } render(); },
        voice: function () { try { localStorage.setItem('snVoice', vOn() ? 'off' : 'on'); } catch (e) { } if (vOn() && tour >= 0) say(tour); else hush(); render(); },
        help: function (k) { help = HELP[k] ? k : 1; render(); },
        lobby: function () { g = null; toast = null; render(); },
        start: function () { g = { id: Date.now().toString(36) + Math.floor(rng() * 1e6).toString(36), n: 1 + Math.floor(rng() * MAX), log: [], wrong: [], mine: [], end: false, at: Date.now() }; pend = null; cross = false; toast = null; render(); },
        pick: function (id) { if (!g || g.end || !q(id)) return; pend = id; toast = null; render(); var f = document.getElementById('sn-a'); if (f) f.focus(); if (!q(id)[2]) SN.ask(); },
        ask: function () {
            var Q = pend && q(pend); if (!g || g.end || !Q) return;
            var a = Q[2] ? +(document.getElementById('sn-a') || {}).value : 0, b = Q[2] === 2 ? +(document.getElementById('sn-b') || {}).value : 0;
            var lo = Q[0] === 'unit' ? 0 : 1, hi = Q[0] === 'unit' ? 9 : MAX;
            if (Q[2] && !(Number.isInteger(a) && a >= lo && a <= hi && (Q[2] < 2 || (Number.isInteger(b) && b >= 1 && b <= MAX)))) { toast = 'ใส่เลข ' + lo + '–' + hi; return render(); }
            g.log.push({ id: Q[0], a: a, b: b, ans: !!Q[3](g.n, a, b), txt: Q[4](a, b) }); pend = null; toast = null; S('pick'); render();
        },
        cell: function (n) { if (!g || g.end) return; if (help === 2 && cross) { var i = g.mine.indexOf(n); if (i < 0) g.mine.push(n); else g.mine.splice(i, 1); return render(); } guess(n); },
        mode: function (c) { cross = !!c; render(); },
        guessBox: function () { var v = +(document.getElementById('sn-g') || {}).value; if (!Number.isInteger(v) || v < 1 || v > MAX) { toast = 'ใส่เลข 1–100'; return render(); } guess(v); },
        close: function () { hush(); tour = -1; g = null; var m = document.getElementById('snModal'); if (m) m.style.display = 'none'; },
        // for scripts/secret-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _live: function () { return live(); }, _qs: QS
    };
    window.secretOpen = function () { SN.open(); };
})();
