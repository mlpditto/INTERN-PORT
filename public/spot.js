/* V101.400 🪞 Memory Fracture · practice (owner 2026-11-28, docs/MEMORY-SPOT-PLAN.md PR 1; layout C = the steps rail,
   mockup-memory-fracture/screens.png). Levels 🥄 / 🥄🥄 / 🥄🥄🥄, 3 rounds. A round walks the rail 👀 → 🎲 → 🔍 → 📊; the step you are in
   holds its seconds: 👀 look at the shelf 60 s (▸ Ready to go early) → 🎲 the shelf is gone, bet in 10 s (×1 free · ×1.5 💎1 · ×2 💎2,
   one tap goes on; none = ×1) → 🔍 the shelf is back with changes, tap the slots that changed in 90 s (tap again to undo; changes + 2
   taps at most) → 📊 green = found, dashed = missed, ✗ = wrong, each change named. Shelf + scoring in spot-scene.js. A ❓ tour of the
   rules only, ONE page like 🔢 / 🪨 (5 lines, English first), read aloud in Thai line after line (spot-voice/t1…t5.mp3) — no
   tactics (owner: every game gets a voiced tutorial of the rules).
   game_plays: game 'spot', mode 'l1' | 'l2' | 'l3', score = the points, win 'w' when the points reach the number of changes.
   V101.401 🤖 Practice │ 🌐 Friends: the rooms are spot-online.js (SPOnline), drawn inside this popup; mode 'live' there.
   window.SP, window.spotOpen. */
(function () {
    'use strict';
    var NAME = 'Memory Fracture', S = function () { return window.SpotScene; };
    var g = null, tour = -1, aud = null, tread = -1, tick = null, STEP = 1000, level = 1, multi = false;
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    var lv = +get('spotLevel'); if (lv >= 1 && lv <= 3) level = lv;
    function fmt(n) { return String(Math.round(n * 10) / 10); }

    // ---- sound: short cues made in the phone (no files) ----------------------------------------------------------------------
    var ac = null;
    function sndOn() { return get('spotSound') !== 'off'; }
    function cue(k) {
        if (!sndOn()) return;
        try {
            ac = ac || new (window.AudioContext || window.webkitAudioContext)();
            var P = { ok: [[880, .08], [1320, .12]], no: [[180, .18]], tick: [[1000, .03]], gone: [[600, .05], [300, .2]], go: [[520, .08], [780, .1]] }[k] || [], t = ac.currentTime;
            P.forEach(function (p) {
                var o = ac.createOscillator(), v = ac.createGain(); o.type = k === 'no' ? 'square' : 'sine'; o.frequency.value = p[0];
                v.gain.setValueAtTime(.0001, t); v.gain.exponentialRampToValueAtTime(k === 'tick' ? .05 : .12, t + .01); v.gain.exponentialRampToValueAtTime(.0001, t + p[1]);
                o.connect(v); v.connect(ac.destination); o.start(t); o.stop(t + p[1] + .02); t += p[1];
            });
        } catch (e) { }
    }

    // ---- ❓ the tour: the rules only, one page; the voice reads the 5 lines one after another and frames the one it is on -------
    function vOn() { return get('spotVoice') !== 'off'; }
    function hush() { if (aud) { aud.onended = null; try { aud.pause(); } catch (e) { } aud = null; } tread = -1; }
    function mark(i) { tread = i; var r = document.querySelectorAll('#sp-tour .sp-rule'); for (var k = 0; k < r.length; k++) r[k].classList.toggle('now', k === i); }
    function say(i) {   // reads line i, then the next one, to the end
        hush(); if (!vOn()) return mark(-1);
        try {
            var a = aud = new Audio('spot-voice/t' + (i + 1) + '.mp3'); mark(i);
            a.onended = function () { if (aud !== a) return; aud = null; if (tour >= 0 && i < TOUR.length - 1) say(i + 1); else mark(-1); };
            var p = a.play(); if (p && p.catch) p.catch(function () { if (aud === a) { aud = null; mark(-1); } });
        } catch (e) { aud = null; mark(-1); }
    }
    var TOUR = [   // [Thai line (what the voice reads), English line]
        ['👀 จำชั้นยาให้ได้ใน 60 วินาที · ดูชื่อยา ขนาดยา สี และจำนวน', 'Remember the shelf in 60 s.'],
        ['🎲 ชั้นยาหายไป · เดิมพันใน 10 วินาที · ×1 ฟรี · ×1.5 ใช้ 💎1 · ×2 ใช้ 💎2', 'The shelf goes; bet in 10 s.'],
        ['🔍 ชั้นยากลับมาแต่มีบางช่องเปลี่ยน · แตะช่องที่ต่างใน 90 วินาที · แตะซ้ำเพื่อยกเลิก', 'Tap the slots that changed in 90 s.'],
        ['📊 เจอ +1 · แตะผิด −1 · แล้วคูณเดิมพัน · ×2 แตะผิดเกิน 2 เสีย 💎 เพิ่ม 1 · เจอครบไม่ผิดเลย ได้ 💎 คืน 1', 'Found +1, wrong −1, times the bet.'],
        ['ที่เปลี่ยนได้: 🎨 สี · ➖ หาย · ➕ เพิ่ม · 🔀 สลับที่ · 📦 จำนวน · 💊 ขนาดยา · 🔤 ชื่อคล้าย · 3 รอบ · คะแนนรวมยิ่งมากยิ่งดี', 'What can change · 3 rounds · most points is best.']
    ];
    function tourHtml() {
        return '<div class="sp sp-tour" id="sp-tour"><div class="sp-top"><h3>❓ How to play</h3>'
            + '<button type="button" class="sp-x" id="sp-voice" onclick="SP.voice()" aria-label="Voice" aria-pressed="' + vOn() + '">' + (vOn() ? '🔊' : '🔇') + '</button>'
            + '<button type="button" class="sp-x" onclick="SP.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<ol class="sp-rules" id="sp-tcap">' + TOUR.map(function (s, i) { return '<li class="sp-rule' + (i === tread ? ' now' : '') + '"><i aria-hidden="true">' + (i + 1) + '</i><div><b>' + s[1] + '</b><small>' + s[0] + '</small></div></li>'; }).join('') + '</ol>'
            + '<button type="button" class="sp-go" id="sp-tnext" onclick="SP.tourEnd()">▸ Start</button></div>';
    }

    // ---- pieces ----------------------------------------------------------------------------------------------------------------
    var X = '<button type="button" class="sp-x" onclick="SP.close()" aria-label="Close">✕</button>';
    var HQ = '<button type="button" class="sp-x" id="sp-help" onclick="SP.tour()" aria-label="How to play" title="How to play">❓</button>';
    function SND() { return '<button type="button" class="sp-x" id="sp-snd" onclick="SP.sound()" aria-label="Sound" aria-pressed="' + sndOn() + '">' + (sndOn() ? '🔊' : '🔇') + '</button>'; }
    function top(title, extra) { return '<div class="sp-top"><h3>' + title + '</h3>' + (extra || '') + SND() + HQ + X + '</div>'; }
    var STEPS = ['👀', '🎲', '🔍', '📊'];
    function rail(k, n) { return '<div class="sp-rail" id="sp-rail" aria-label="Steps">' + STEPS.map(function (e, i) { return '<span class="' + (i === k ? 'on' : i < k ? 'ok' : '') + '">' + e + (i === k && n != null ? ' <b id="sp-left">' + n + '</b>' : '') + '</span>'; }).join('') + '</div>'; }
    function bets(on, gem) {
        return '<div class="sp-bets" role="group" aria-label="Bet">' + [[1, 'free'], [1.5, '💎1'], [2, '💎2']].map(function (b) {
            var can = S().BETS[b[0]] <= gem;
            return '<button type="button" class="sp-bet' + (b[0] === on ? ' on' : '') + '" id="sp-bet-' + String(b[0]).replace('.', '') + '"' + (can ? '' : ' disabled') + ' onclick="SP.bet(' + b[0] + ')">×' + b[0] + '<small>' + b[1] + '</small></button>';
        }).join('') + '</div>';
    }
    function cur() { return g.rounds[g.round - 1]; }
    function maxTaps() { return cur().sc.diffs.length + 2; }

    // ---- screens ---------------------------------------------------------------------------------------------------------------
    function lobbyHtml() {
        // V101.401 🤖 Practice │ 🌐 Friends (spot-online.js, rooms through roomAct). With friends the 🥄 row is the host's pick for a new room.
        var M = multi && window.SPOnline;
        var mode = window.SPOnline ? '<div class="sp-mode" role="group" aria-label="Mode">' + [[0, '🤖 Practice'], [1, '🌐 Friends']].map(function (k) { var on = !!k[0] === multi; return '<button type="button" id="sp-mode-' + k[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="SP.online(' + k[0] + ')">' + k[1] + '</button>'; }).join('') + '</div>' : '';
        var lv = '<div class="sp-lv' + (M ? ' row' : '') + '" role="group" aria-label="Level">' + [1, 2, 3].map(function (n) { var L = S().LEVELS[n], what = L.items + ' items · ' + L.diffs + ' changes'; return '<button type="button" id="sp-lv' + n + '" class="' + (level === n ? 'on' : '') + '" aria-pressed="' + (level === n) + '" title="' + what + '" aria-label="Level ' + n + ' · ' + what + '" onclick="SP.level(' + n + ')">' + '🥄'.repeat(n) + (M ? '' : '<small>' + what + '</small>') + '</button>'; }).join('') + '</div>';
        if (M) return '<div class="sp">' + top('🪞 ' + NAME) + mode + lv + SPOnline.lobbyHtml() + '</div>';
        return '<div class="sp">' + top('🪞 ' + NAME) + mode
            + '<div class="sp-note" title="👀 จำชั้นยา → 🔍 หาช่องที่เปลี่ยน · 3 รอบ&#10;👀 선반을 기억하고 → 🔍 바뀐 칸 찾기 · 3라운드">👀 remember → 🔍 spot the changes · 3 rounds</div>'
            + lv + '<button type="button" class="sp-go" id="sp-start" onclick="SP.start()">▸ Start</button></div>';
    }
    function playHtml() {
        var c = cur(), head = top('🪞 Round ' + g.round + '/' + S().ROUNDS, '<span class="sp-pill" id="sp-gem">💎 ' + g.gem + '</span>'), h = '<div class="sp">' + head;
        if (g.phase === 'look') return h + rail(0, g.left) + '<div class="sp-pic">' + S().draw(c.sc, 'orig') + '</div><button type="button" class="sp-go alt" id="sp-ready" onclick="SP.ready()">▸ Ready</button></div>';
        if (g.phase === 'bet') return h + rail(1, g.left) + '<div class="sp-pic sp-gone" aria-hidden="true">' + S().draw(c.sc, 'orig') + '<span>🫥</span></div>' + bets(-1, g.gem) + '</div>';
        if (g.phase === 'find') {
            var dots = ''; for (var i = 0; i < maxTaps(); i++) dots += '<i class="' + (i < c.taps.length ? 'u' : '') + '"></i>';
            return h + rail(2, g.left) + '<div class="sp-pic" id="sp-find" onclick="SP.hit(event)">' + S().draw(c.sc, 'changed', c.taps.map(function (k) { return { k: k, t: 'tap' }; })) + '</div>'
                + '<div class="sp-row"><div class="sp-taps" id="sp-taps" aria-label="Taps">' + dots + '</div><button type="button" class="sp-go" id="sp-done" onclick="SP.done()">✓ Done</button></div></div>';
        }
        // 📊 show
        var r = c.res, marks = [];
        c.sc.diffs.forEach(function (d, i) { d.cells.forEach(function (k) { marks.push({ k: k, t: r.found[i] ? 'ok' : 'miss' }); }); });
        r.wrong.forEach(function (k) { marks.push({ k: k, t: 'no' }); });
        var list = c.sc.diffs.map(function (d, i) { return '<div class="' + (r.found[i] ? 'ok' : '') + '"><span>' + (r.found[i] ? '✅' : '◌') + '</span>' + d.say + '</div>'; }).join('');
        var line = '✅ ' + r.n + (r.wrong.length ? ' ❌ ' + r.wrong.length : '') + (c.bet !== 1 ? ' → ' + r.raw + ' × ' + c.bet : '') + ' = ' + fmt(r.pts) + (r.gem ? ' · 💎 ' + (r.gem > 0 ? '+' : '−') + Math.abs(r.gem) : '');
        return h + rail(3) + '<div class="sp-pic sp-small">' + S().draw(c.sc, 'changed', marks) + '</div><div class="sp-list" id="sp-list">' + list + '</div>'
            + '<div class="sp-sum" id="sp-sum">' + line + '</div><button type="button" class="sp-go" id="sp-next" onclick="SP.next()">' + (g.round < S().ROUNDS ? '▸ Round ' + (g.round + 1) : '▸ Result') + '</button></div>';
    }
    function target() { return g.rounds.reduce(function (a, c) { return a + c.sc.diffs.length; }, 0); }
    function endHtml() {
        var win = g.pts >= target();
        return '<div class="sp">' + top('🪞 ' + '🥄'.repeat(g.level)) + '<div class="sp-big" id="sp-final">' + (win ? '🏆 ' : '') + '⭐ ' + fmt(g.pts) + '<small>/ 🎯 ' + target() + '</small></div>'
            + '<div class="sp-rounds" id="sp-rounds">' + g.rounds.map(function (c, i) { return '<div><b>' + (i + 1) + '</b><span>✅ ' + c.res.n + '/' + c.sc.diffs.length + (c.res.wrong.length ? ' ❌ ' + c.res.wrong.length : '') + ' · ×' + c.bet + '</span><b>' + fmt(c.res.pts) + '</b></div>'; }).join('') + '</div>'
            + '<div class="sp-note">💎 ' + g.gem + ' left</div>'
            + '<button type="button" class="sp-go" id="sp-again" onclick="SP.start()">↻ Again</button><button type="button" class="sp-x" style="align-self:center" onclick="SP.lobby()">⬅ Levels</button></div>';
    }

    var CSS = '#spModal .modal-content{max-width:440px;padding:12px;border-radius:20px;background:#fffdf8;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}'   /* a timed shelf must fit a short phone without scrolling */
        + '#spModal .sp{display:flex;flex-direction:column;gap:8px;color:#0f172a}#spModal button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#spModal .sp-top{display:flex;align-items:center;gap:6px}#spModal .sp-top h3{margin:0;font-size:1.05em;color:#4c1d95;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '#spModal .sp-pill{border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:.85em;font-weight:900;white-space:nowrap;background:#fff}'
        + '#spModal .sp-x{background:none;border:0;font-size:1.15em;color:#94a3b8;padding:2px 4px;min-width:32px;min-height:32px}'
        + '#spModal .sp-rail{display:flex;gap:4px}#spModal .sp-rail span{flex:1;text-align:center;border-radius:10px;padding:6px 0;font-weight:900;font-size:.9em;background:#f1f5f9;color:#94a3b8;white-space:nowrap}'
        + '#spModal .sp-rail span.on{background:#7c3aed;color:#fff}#spModal .sp-rail span.ok{color:#16a34a;background:#f0fdf4}'
        + '#spModal .sp-pic{position:relative;display:flex;justify-content:center}#spModal .sp-pic svg{display:block;width:100%;height:auto;max-height:calc(100dvh - 192px);border-radius:12px;touch-action:manipulation}'
        + '#spModal .sp-small svg{max-height:38dvh}#spModal #sp-find .sp-cell{cursor:pointer}'
        + '#spModal .sp-gone svg{filter:grayscale(1) blur(8px);opacity:.3;max-height:calc(100dvh - 200px)}#spModal .sp-gone span{position:absolute;inset:0;display:grid;place-items:center;font-size:48px}'
        + '#spModal .sp-go{background:#7c3aed;color:#fff;border:0;border-radius:14px;padding:11px 16px;font-weight:900;font-size:1.05em;min-height:48px;white-space:nowrap}#spModal .sp-go.alt{background:#f5f3ff;color:#5b21b6;border:2px solid #ddd6fe}'
        + '#spModal .sp-bets{display:flex;gap:6px}#spModal .sp-bet{flex:1;border:2px solid #e2e8f0;border-radius:14px;padding:8px 4px;background:#fff;font-weight:900;font-size:1.2em;min-height:56px;color:#0f172a}'
        + '#spModal .sp-bet small{display:block;font-size:.6em;color:#64748b}#spModal .sp-bet.on{border-color:#7c3aed;background:#f5f3ff}#spModal .sp-bet:disabled{opacity:.3}'
        + '#spModal .sp-row{display:flex;gap:8px;align-items:center}#spModal .sp-row .sp-go{flex:1}'
        + '#spModal .sp-taps{display:flex;gap:4px;flex-wrap:wrap;max-width:45%}#spModal .sp-taps i{width:11px;height:11px;border-radius:50%;background:#e2e8f0}#spModal .sp-taps i.u{background:#f59e0b}'
        + '#spModal .sp-list{display:flex;flex-direction:column;gap:3px;font-size:.82em;font-weight:700;color:#64748b}#spModal .sp-list div{display:flex;gap:6px}#spModal .sp-list .ok{color:#0f172a}'
        + '#spModal .sp-sum{text-align:center;font-weight:900;font-size:1.1em;color:#4c1d95}'
        + '#spModal .sp-note{font-size:.82em;color:#64748b;text-align:center;font-weight:700}'
        + '#spModal .sp-lv{display:flex;flex-direction:column;gap:6px}#spModal .sp-lv button{display:flex;align-items:center;justify-content:space-between;border:2px solid #e2e8f0;border-radius:14px;padding:10px 14px;background:#fff;font-size:1.1em;min-height:52px}'
        + '#spModal .sp-lv small{font-size:.72em;color:#64748b;font-weight:800}#spModal .sp-lv .on{border-color:#7c3aed;background:#f5f3ff}'
        + '#spModal .sp-lv.row{flex-direction:row}#spModal .sp-lv.row button{flex:1;justify-content:center;min-height:44px;padding:8px 4px}'
        + '#spModal .sp-mode{display:flex;gap:6px;justify-content:center}#spModal .sp-mode button{border:1px solid #ddd6fe;border-radius:999px;padding:6px 12px;font-size:.85em;font-weight:800;color:#5b21b6;background:#f5f3ff}#spModal .sp-mode .on{background:#7c3aed;color:#fff;border-color:#7c3aed}'
        + '#spModal .sp-big{font-size:1.8em;font-weight:900;color:#4c1d95;text-align:center}#spModal .sp-big small{font-size:.5em;color:#64748b;margin-left:6px}'
        + '#spModal .sp-rounds{display:flex;flex-direction:column;gap:4px}#spModal .sp-rounds div{display:flex;gap:8px;align-items:center;padding:7px 10px;border-radius:12px;background:#f8fafc;font-size:.9em}#spModal .sp-rounds span{flex:1}'
        + '#spModal .sp-rules{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}#spModal .sp-rule{display:flex;gap:10px;align-items:center;text-align:left;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:5px 10px}'
        + '#spModal .sp-rule>i{flex:none;width:24px;height:24px;border-radius:50%;background:#7c3aed;color:#fff;font-style:normal;font-weight:900;font-size:.8em;line-height:24px;text-align:center}#spModal .sp-rule.now{border-color:#7c3aed;box-shadow:0 0 0 2px #ddd6fe}'
        + '#spModal .sp-rule>div{min-width:0;flex:1}#spModal .sp-rule>div>b{display:block;font-weight:700;font-size:.86em;line-height:1.3;color:#4c1d95}#spModal .sp-rule>div>small{display:block;font-size:.72em;font-weight:600;line-height:1.35;color:#64748b}'
        + '#spModal .sp-tour .sp-go{position:sticky;bottom:0;box-shadow:0 -6px 0 #fffdf8,0 14px 0 #fffdf8}'   /* ▸ Start stays in sight when a short phone scrolls the lines */
        + '@media (prefers-reduced-motion:reduce){#spModal *{transition:none!important;animation:none!important}}';
    function root() {
        var m = document.getElementById('spModal');
        if (!m) {
            if (!document.getElementById('sp-css')) { var st = document.createElement('style'); st.id = 'sp-css'; st.textContent = CSS; document.head.appendChild(st); }
            m = document.createElement('div'); m.id = 'spModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', NAME);
            m.innerHTML = '<div class="modal-content"><div id="sp-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) SP.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function render() {
        var m = root();
        document.getElementById('sp-body').innerHTML = tour >= 0 ? tourHtml() : window.SPOnline && SPOnline.active() ? SPOnline.html() : !g ? lobbyHtml() : g.phase === 'end' ? endHtml() : playHtml();
        m.style.display = 'flex';
        if (g && tour < 0 && window.GameLog && !(window.SPOnline && SPOnline.active())) {
            var end = g.phase === 'end', done = g.rounds.filter(function (c) { return c.res; });
            GameLog.see('spot', { id: g.id, n: done.length, done: end, mode: 'l' + g.level, win: end ? (g.pts >= target() ? 'w' : 'l') : null, score: fmt(g.pts), res: done.map(function (c) { return c.res.n + '/' + c.sc.diffs.length; }) });
        }
    }

    // ---- the clock: one tick a second; only the number on the rail changes between steps -------------------------------------
    function stop() { clearInterval(tick); tick = null; }
    function phase(p, secs) { stop(); g.phase = p; g.left = secs; render(); if (secs) tick = setInterval(second, STEP); }
    function second() {
        if (!g) return stop();
        g.left--;
        var el = document.getElementById('sp-left'); if (el) el.textContent = g.left;
        if (g.left > 0 && g.left <= 5) cue('tick');
        if (g.left > 0) return;
        if (g.phase === 'look') return toBet();
        if (g.phase === 'bet') return SP.bet(1);
        if (g.phase === 'find') return SP.done();
    }
    function toBet() { cue('gone'); phase('bet', S().BET); }
    function newRound() {
        var seed = Math.floor(Math.random() * 2147483647);
        g.rounds.push({ seed: seed, sc: S().make(g.level, seed), bet: 1, taps: [], res: null });
        phase('look', S().LOOK);
    }

    window.SP = {
        open: function () { stop(); g = null; if (!get('spotTourSeen')) return SP.tour(); render(); },
        tour: function () { stop(); tour = 0; render(); say(0); },
        tourEnd: function () { hush(); tour = -1; put('spotTourSeen', '1'); g = null; render(); },
        voice: function () { put('spotVoice', vOn() ? 'off' : 'on'); if (vOn() && tour >= 0) say(0); else hush(); render(); },
        sound: function () { put('spotSound', sndOn() ? 'off' : 'on'); var b = document.getElementById('sp-snd'); if (b) { b.textContent = sndOn() ? '🔊' : '🔇'; b.setAttribute('aria-pressed', sndOn()); } },
        level: function (n) { if (n >= 1 && n <= 3) { level = n; put('spotLevel', String(n)); render(); } },
        lobby: function () { stop(); g = null; render(); },
        online: function (v) { stop(); multi = !!v; g = null; if (!multi && window.SPOnline) SPOnline.close(); render(); },   // V101.401 🤖 │ 🌐
        start: function () { stop(); g = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), level: level, round: 1, gem: 3, pts: 0, rounds: [] }; cue('go'); newRound(); },
        ready: function () { if (g && g.phase === 'look') toBet(); },
        bet: function (b) { if (!g || g.phase !== 'bet' || !(b in S().BETS) || S().BETS[b] > g.gem) return; cur().bet = +b; cue('go'); phase('find', S().FIND); },
        hit: function (e) { var c = e && e.target && e.target.closest && e.target.closest('.sp-cell'); if (c) SP.tap(+c.getAttribute('data-k')); },
        tap: function (k) {
            if (!g || g.phase !== 'find') return;
            var t = cur().taps, i = t.indexOf(k);
            if (i >= 0) t.splice(i, 1); else if (t.length < maxTaps()) t.push(k); else return;
            render();
        },
        done: function () {
            if (!g || g.phase !== 'find') return;
            var c = cur(); c.res = S().score(c.sc, c.taps, c.bet); g.pts += c.res.pts; g.gem = Math.max(0, g.gem + c.res.gem);
            cue(c.res.n ? 'ok' : 'no'); phase('show', 0);
        },
        next: function () { if (!g || g.phase !== 'show') return; if (g.round < S().ROUNDS) { g.round++; newRound(); } else phase('end', 0); },
        close: function () { stop(); hush(); tour = -1; if (window.SPOnline) SPOnline.close(); var m = document.getElementById('spModal'); if (m) m.style.display = 'none'; },
        // for scripts/spot-qa.cjs
        _g: function () { return g; }, _step: function (ms) { STEP = ms; }, _render: function () { render(); },
        _ui: { rail: rail, cue: cue, level: function () { return level; } }   // for spot-online.js
    };
    window.spotOpen = function () { SP.open(); };
})();
