/* V101.378 🔢 เลขลับ · โหมดฝึก 🤖 (owner 2026-11-26: game 1 of docs/MIND-GAMES-PLAN.md, inspired by a game-show mechanic, our own name and
   look; picks: the 5th tile in the games row · help levels 🟩 the app crosses out (C1) → ✏️ you cross out (C2) → 📏 the range bar only
   (B) → 🧠 no help, the log only (A) · a ❓ tour read aloud in Thai, mockup-secret-number/). 🤖 thinks of 1–100; each question from the
   menu costs 🎫 1 and is answered truthfully; a wrong guess costs 🎫 1 more. Score = 🎫 used, fewer is better; a best per help level
   (snBest_h<n>); game_plays: game 'secret', mode 'h<n>', win 'w', score = 🎫 (🏆 Top 3 counts 🧠 only). window.SN, window.secretOpen.
   V101.385 refresh (owner 2026-11-27: English first, no tactics, pick B mockup-secret-refresh/): the 🟩 count is a mini bar beside 🎫,
   live cells tinted + framed, ruled-out cells struck + hatched, a wrong guess flashes with one line above the grid, the log shows the
   last 3 (+n more), a question with no number can be asked once (its chip then shows the answer), the same numbered question is
   never charged twice; the end shows 🏅 New best (+ light confetti) and 📤 Share, and no longer says how to play well. */
(function () {
    'use strict';
    var MAX = 100, rng = Math.random, g = null, help = 1, toast = null, pend = null, cross = false, multi = false, logAll = false;
    var HELP = { 1: ['🟩', 'Auto'], 2: ['✏️', 'Mark'], 3: ['📏', 'Range'], 4: ['🧠', 'None'] };
    // the question menu: [id, chip, needs numbers, test(n, a, b), the asked line]
    var QS = [
        ['gt', '> __?', 1, function (n, a) { return n > a; }, function (a) { return '> ' + a + '?'; }],
        ['even', 'Even?', 0, function (n) { return n % 2 === 0; }, function () { return 'Even?'; }],
        ['div3', '÷3?', 0, function (n) { return n % 3 === 0; }, function () { return '÷3?'; }],
        ['prime', 'Prime?', 0, function (n) { if (n < 2) return false; for (var d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }, function () { return 'Prime?'; }],
        ['unit', 'Ends in __?', 1, function (n, a) { return n % 10 === a; }, function (a) { return 'Ends in ' + a + '?'; }],
        ['range', 'In __–__?', 2, function (n, a, b) { return n >= Math.min(a, b) && n <= Math.max(a, b); }, function (a, b) { return 'In ' + Math.min(a, b) + '–' + Math.max(a, b) + '?'; }]
    ];
    /** a log entry for the same question with the same numbers (a range in either order) */
    function asked(id, a, b) { for (var i = 0; g && i < g.log.length; i++) { var L = g.log[i]; if (L.id === id && (id === 'range' ? Math.min(L.a, L.b) === Math.min(a, b) && Math.max(L.a, L.b) === Math.max(a, b) : L.a === a)) return L; } return null; }
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
        ['ใช้ 🎫 น้อยสุด = เก่งสุด<br>อยากยากขึ้น: ✏️ ขีดเอง · 📏 · 🧠', 'Fewest 🎫 wins · harder: cross out yourself, or no help.', function () { return '<div class="sn-lvs">' + [1, 2, 3, 4].map(function (k) { return '<span class="' + (k === 1 ? 'on' : '') + '">' + HELP[k][0] + ' ' + HELP[k][1] + '</span>'; }).join('') + '</div>'; }],
        // V101.380 🌐 หลายคน (secret-online.js)
        ['🌐 เล่นกับเพื่อน: ทุกคนมีเลขลับ<br>ตาคุณถาม 1 คน 1 ข้อ · คำตอบเห็นคนเดียว<br>ทายถูก ⭐ +3 · เพื่อนออก', 'With friends: ask one, only you see the answer; a right guess ⭐ +3.', function () { return '<div class="sn-lvs"><span>🧑‍⚕️ 🎫 6</span><span class="on">👩‍⚕️ ?</span><span>🧑 🎫 5 · ⭐ 3</span></div>'; }]
    ];
    function tourHtml() {
        var s = TOUR[tour];
        return '<div class="sn sn-tour" id="sn-tour"><div class="sn-top"><h3>❓ How to play</h3><span class="sn-pill">' + (tour + 1) + '/' + TOUR.length + '</span>'
            + '<button type="button" class="sn-x" id="sn-voice" onclick="SN.voice()" aria-label="Sound" aria-pressed="' + vOn() + '">' + (vOn() ? '🔊' : '🔇') + '</button>'
            + '<button type="button" class="sn-x" onclick="SN.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<div class="sn-say" id="sn-tcap">' + s[1] + '<small>' + s[0] + '</small></div>'   // V101.385 English first; the small Thai line is what the voice reads + s[2]()
            + '<div class="sn-tnav"><button type="button" class="sn-skip" onclick="SN.tourEnd()">Skip</button><div class="sn-dots">' + TOUR.map(function (x, n) { return n; }).map(function (n) { return '<i class="' + (n === tour ? 'on' : '') + '"></i>'; }).join('') + '</div>'
            + '<button type="button" class="sn-go" id="sn-tnext" onclick="SN.tourNext()">' + (tour === TOUR.length - 1 ? '▸ Start' : 'Next ▸') + '</button></div></div>';
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
        + '#snModal .sn-log{display:flex;flex-direction:column;gap:4px;font-size:.85em;max-height:150px;overflow:auto}#snModal .sn-log div{display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border-radius:10px;padding:5px 9px}'
        + '#snModal .yes{color:#15803d}#snModal .no{color:#b91c1c}'
        + '#snModal .sn-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}#snModal .sn-grid button,#snModal .sn-grid span{font-size:.72em;text-align:center;padding:5px 0;border-radius:5px;background:#f0fdfa;color:#115e59;font-weight:800;border:0}'
        + '#snModal .sn-grid .out{background:#f1f5f9 repeating-linear-gradient(135deg,transparent 0 4px,#e2e8f0 4px 5px);color:#cbd5e1;text-decoration:line-through;font-weight:500}#snModal .sn-grid .bad{background:#fee2e2;color:#b91c1c}'
        + '#snModal #sn-grid button:not(.out){background:#ccfbf1;box-shadow:inset 0 0 0 1px #5eead4}#snModal .sn-grid .flash{animation:snFlash .5s 2}@keyframes snFlash{50%{background:#fca5a5}}'
        + '#snModal .sn-chips button.done{opacity:.55;background:#f8fafc;border-color:#e2e8f0}#snModal .sn-left{display:inline-flex;align-items:center;gap:4px}#snModal .sn-left i{width:34px;height:6px;border-radius:9px;background:#e2e8f0;display:block;overflow:hidden}#snModal .sn-left b{display:block;height:6px;background:#14b8a6}'
        + '#snModal .sn-more{background:none;border:0;color:#64748b;font-weight:800;font-size:.75em;align-self:center}#snModal .sn-badge{align-self:center;background:#fef3c7;color:#92400e;border-radius:999px;padding:3px 12px;font-weight:900;font-size:.9em}'
        + '#snModal .sn-conf{position:relative;height:0;pointer-events:none}#snModal .sn-conf i{position:absolute;width:5px;height:9px;border-radius:1px;animation:snFall 1.6s ease-out forwards}@keyframes snFall{from{transform:translateY(-20px) rotate(0)}to{transform:translateY(70px) rotate(300deg);opacity:0}}'
        + '#snModal .sn-top h3{min-width:0;overflow:hidden;text-overflow:ellipsis}@media (max-width:360px){#snModal .sn-left i{width:22px}}'
        + '@media (prefers-reduced-motion:reduce){#snModal .sn-grid .flash,#snModal .sn-conf i{animation:none}#snModal .sn-conf{display:none}}'
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
    var HQ = '<button type="button" class="sn-x" id="sn-help" onclick="SN.tour()" aria-label="How to play" title="How to play">❓</button>';
    function lobbyHtml() {
        var M = multi && window.SNOnline;   // V101.380
        return '<div class="sn"><div class="sn-top"><h3>🔢 Secret number</h3>' + HQ + X + '</div>'
            + (window.GameTop ? GameTop.line(M ? 'secretOn' : 'secret') : '')
            + (window.SNOnline ? '<div class="sn-lvs" role="group" aria-label="Mode">' + [[0, '🤖 Practice'], [1, '🌐 Friends']].map(function (k) { var on = !!k[0] === !!multi; return '<button type="button" id="sn-mode-' + k[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="SN.multi(' + k[0] + ')">' + k[1] + '</button>'; }).join('') + '</div>' : '')
            + (M ? SNOnline.lobbyHtml() + '</div>' : '<div class="sn-note">🤖 picks 1–100 · 🎫 1 a question · fewest wins</div>'
            + '<div class="sn-lvs" role="group" aria-label="Help">' + [1, 2, 3, 4].map(function (k) { var b = get('snBest_h' + k); return '<button type="button" id="sn-h' + k + '" class="' + (help === k ? 'on' : '') + '" aria-pressed="' + (help === k) + '" onclick="SN.help(' + k + ')">' + HELP[k][0] + ' ' + HELP[k][1] + (b ? ' · ' + b + '🎫' : '') + '</button>'; }).join('') + '</div>'
            + '<button type="button" class="sn-go" id="sn-start" onclick="SN.start()">▸ Start</button></div>');
    }
    function askHtml() {
        var Q = pend ? q(pend) : null, h = '<div class="sn-chips" role="group" aria-label="Questions">' + QS.map(function (x) {
            var d = !x[2] && asked(x[0], 0, 0);   // a question with no number: once, then its chip shows the answer
            return '<button type="button" data-q="' + x[0] + '" class="' + (pend === x[0] ? 'on' : '') + (d ? ' done' : '') + '"' + (d ? ' disabled' : ' onclick="SN.pick(\'' + x[0] + '\')"') + '>' + x[1] + (d ? (d.ans ? ' ✓' : ' ✗') : '') + '</button>';
        }).join('') + '</div>';
        if (Q) {
            h += '<div class="sn-row">' + (Q[2] ? '<input id="sn-a" type="number" inputmode="numeric" min="' + (Q[0] === 'unit' ? 0 : 1) + '" max="' + (Q[0] === 'unit' ? 9 : MAX) + '" placeholder="' + (Q[0] === 'unit' ? '0–9' : '1–100') + '" aria-label="Number">' : '')
                + (Q[2] === 2 ? '<span>–</span><input id="sn-b" type="number" inputmode="numeric" min="1" max="100" placeholder="1–100" aria-label="To">' : '')
                + '<button type="button" class="sn-go" id="sn-ask" onclick="SN.ask()">Ask 🎫</button></div>';
        }
        return h;
    }
    function playHtml() {
        var L = live(), h = '<div class="sn"><div class="sn-top"><h3 title="Secret number">🔢 ' + HELP[help][0] + '</h3>'
            + (help === 1 ? '<span class="sn-pill sn-left" id="sn-left" title="Still possible">' + L.length + ' <i><b style="width:' + L.length + '%"></b></i></span>' : '')
            + '<span class="sn-pill" id="sn-used">🎫 ' + used() + '</span>' + HQ + X + '</div>';
        if (toast) h += '<div class="sn-toast" id="sn-toast">' + toast + '</div>';
        if (help === 1 || help === 2) {
            h += '<div class="sn-grid" id="sn-grid" title="Tap a number to guess">';
            for (var n = 1; n <= MAX; n++) {
                var out = help === 1 ? L.indexOf(n) < 0 : g.mine.indexOf(n) >= 0, bad = g.wrong.indexOf(n) >= 0;
                h += '<button type="button" data-n="' + n + '" class="' + (bad ? 'out bad' + (n === g.wrong[g.wrong.length - 1] && g.flash ? ' flash' : '') : out ? 'out' : '') + '" onclick="SN.cell(' + n + ')"' + (bad ? ' disabled' : '') + '>' + n + '</button>';
            }
            h += '</div>' + (help === 1 ? ''
                : '<div class="sn-row"><button type="button" class="sn-go' + (cross ? '' : ' alt') + '" id="sn-cross" onclick="SN.mode(1)" aria-pressed="' + cross + '">✏️ Mark</button><button type="button" class="sn-go' + (cross ? ' alt' : '') + '" id="sn-aim" onclick="SN.mode(0)" aria-pressed="' + !cross + '">🎯 Guess</button></div>');
        } else if (help === 3) {
            var lo = L[0], hi = L[L.length - 1];
            h += '<div class="sn-bar" id="sn-bar"><i style="left:' + (lo - 1) + '%;width:' + (hi - lo + 1) + '%"></i><b style="left:6px">1</b><b style="right:6px">100</b></div><div class="sn-note" id="sn-range">' + lo + '–' + hi + '</div>';
        }
        h += askHtml();
        if (help >= 3) h += '<div class="sn-row"><input id="sn-g" type="number" inputmode="numeric" min="1" max="100" placeholder="__" aria-label="Your guess"><button type="button" class="sn-go alt" id="sn-guess" onclick="SN.guessBox()">🎯 Guess</button></div>';
        if (g.log.length) {   // the last 3, the rest one tap away
            var rows = g.log.slice().reverse(), shown = logAll ? rows : rows.slice(0, 3);
            h += '<div class="sn-log" id="sn-log">' + shown.map(function (x, i) { return '<div><span>' + (g.log.length - i) + ' · ' + esc(x.txt) + '</span><b class="' + (x.ans ? 'yes">✓ Yes' : 'no">✗ No') + '</b></div>'; }).join('') + '</div>'
                + (rows.length > 3 ? '<button type="button" class="sn-more" id="sn-more" onclick="SN.more()">' + (logAll ? 'less ▴' : '+' + (rows.length - 3) + ' more ▾') + '</button>' : '');
        }
        return h + '</div>';
    }
    function endHtml() {
        var b = get('snBest_h' + help), nb = g.newBest, sec = Math.round((g.endAt - g.at) / 1000);
        var conf = nb ? '<div class="sn-conf" aria-hidden="true">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return '<i style="left:' + (6 + i * 8) + '%;top:' + (i * 13 % 30) + 'px;background:' + ['#14b8a6', '#f59e0b', '#a78bfa', '#f43f5e'][i % 4] + ';animation-delay:' + (i % 4) * 0.08 + 's"></i>'; }).join('') + '</div>' : '';
        return '<div class="sn">' + conf + '<div class="sn-top"><h3>🔢 It was ' + g.n + ' · ' + HELP[help][0] + '</h3>' + X + '</div>'
            + '<div class="sn-big" id="sn-final">🎯 ' + g.n + '</div>'
            + (nb ? '<div class="sn-badge" id="sn-best">🏅 New best · ' + b + ' 🎫</div>' : '<div class="sn-note" id="sn-best">Best ' + b + ' 🎫</div>')   // no tip on how to play (owner: no tactics)
            + '<div class="sn-stats" id="sn-stats"><div>' + used() + '<small>🎫 used</small></div><div>' + g.wrong.length + '<small>wrong</small></div><div>' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) + '<small>time</small></div></div>'
            + '<div class="sn-row"><button type="button" class="sn-go" style="flex:1" id="sn-again" onclick="SN.start()">↻ Again</button><button type="button" class="sn-go alt" style="flex:1" id="sn-share" onclick="SN.share()">📤 Share</button></div>'
            + '<button type="button" class="sn-x" style="align-self:center" onclick="SN.lobby()">⬅ Change help</button></div>';
    }
    function used() { return g.log.length + g.wrong.length; }
    function render() {
        var m = root(); document.getElementById('sn-body').innerHTML = tour >= 0 ? tourHtml() : window.SNOnline && SNOnline.active() ? SNOnline.html() : !g ? lobbyHtml() : g.end ? endHtml() : playHtml(); m.style.display = 'flex';
        if (g && tour < 0 && window.GameLog) GameLog.see('secret', { id: g.id, n: used(), done: g.end, mode: 'h' + help, win: g.end ? 'w' : null, score: String(used()), res: [] });
    }
    function guess(n) {
        if (!g || g.end) return;
        if (n === g.n) {
            g.end = true; g.endAt = Date.now(); var b = get('snBest_h' + help);
            g.newBest = !b || used() < b; if (g.newBest) set('snBest_h' + help, used()); S('endW');
        } else if (g.wrong.indexOf(n) < 0) { g.wrong.push(n); g.flash = true; toast = '✗ Not ' + n + ' · 🎫 +1'; S('lose'); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { } }
        render(); g.flash = false;
    }

    window.SN = {
        open: function () { g = null; toast = null; if (!seen()) return SN.tour(); render(); },
        tour: function () { tour = 0; render(); say(0); },
        tourNext: function () { if (tour < 0) return; if (tour < TOUR.length - 1) { tour++; render(); say(tour); } else SN.tourEnd(); },
        tourEnd: function () { hush(); tour = -1; try { localStorage.setItem('snTourSeen', '1'); } catch (e) { } render(); },
        voice: function () { try { localStorage.setItem('snVoice', vOn() ? 'off' : 'on'); } catch (e) { } if (vOn() && tour >= 0) say(tour); else hush(); render(); },
        help: function (k) { help = HELP[k] ? k : 1; render(); },
        multi: function (v) { multi = !!v; g = null; render(); },   // V101.380 🤖 │ 🌐
        _render: function () { var m = document.getElementById('snModal'); if (m && m.style.display === 'flex') render(); },
        lobby: function () { g = null; toast = null; render(); },
        start: function () { logAll = false; g = { id: Date.now().toString(36) + Math.floor(rng() * 1e6).toString(36), n: 1 + Math.floor(rng() * MAX), log: [], wrong: [], mine: [], end: false, at: Date.now() }; pend = null; cross = false; toast = null; render(); },
        pick: function (id) { if (!g || g.end || !q(id)) return; if (!q(id)[2] && asked(id, 0, 0)) { toast = 'Already asked'; return render(); } pend = id; toast = null; render(); var f = document.getElementById('sn-a'); if (f) f.focus(); if (!q(id)[2]) SN.ask(); },
        ask: function () {
            var Q = pend && q(pend); if (!g || g.end || !Q) return;
            var a = Q[2] ? +(document.getElementById('sn-a') || {}).value : 0, b = Q[2] === 2 ? +(document.getElementById('sn-b') || {}).value : 0;
            var lo = Q[0] === 'unit' ? 0 : 1, hi = Q[0] === 'unit' ? 9 : MAX;
            if (Q[2] && !(Number.isInteger(a) && a >= lo && a <= hi && (Q[2] < 2 || (Number.isInteger(b) && b >= 1 && b <= MAX)))) { toast = 'Enter ' + lo + '–' + hi; return render(); }
            if (asked(Q[0], a, b)) { toast = 'Already asked'; return render(); }   // never charge 🎫 for the same question twice
            g.log.push({ id: Q[0], a: a, b: b, ans: !!Q[3](g.n, a, b), txt: Q[4](a, b) }); pend = null; toast = null; S('pick'); render();
        },
        cell: function (n) { if (!g || g.end) return; if (help === 2 && cross) { var i = g.mine.indexOf(n); if (i < 0) g.mine.push(n); else g.mine.splice(i, 1); return render(); } guess(n); },
        mode: function (c) { cross = !!c; render(); },
        guessBox: function () { var v = +(document.getElementById('sn-g') || {}).value; if (!Number.isInteger(v) || v < 1 || v > MAX) { toast = 'Enter 1–100'; return render(); } guess(v); },
        more: function () { logAll = !logAll; render(); },
        share: function () {
            if (!g || !g.end) return;
            var text = '🔢 Secret number · got ' + g.n + ' with ' + used() + ' 🎫 (' + HELP[help][0] + ' ' + HELP[help][1] + ')\nhttps://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '');
            try { if (window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) return liff.shareTargetPicker([{ type: 'text', text: text }]); } catch (e) { }
            try { window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener'); } catch (e) { }
            return text;
        },
        close: function () { if (window.SNOnline) SNOnline.close(); hush(); tour = -1; g = null; var m = document.getElementById('snModal'); if (m) m.style.display = 'none'; },
        // for scripts/secret-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _live: function () { return live(); }, _qs: QS
    };
    window.secretOpen = function () { SN.open(); };
})();
