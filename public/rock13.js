/* V101.382 🪨 Carry 13 · ฝึกกับ 🤖 (owner 2026-11-27: game 4 of docs/MIND-GAMES-PLAN.md, our own name and look, pick A3 =
   carriers holding a board with the stones as numbered cubes, mockup-rock13/rock13-A3.png). You + 2–6 🤖, 7 or 14 rounds. Rules in
   rock13-rules.js. Each round: pick a card + a chip → ▸ ส่ง → everyone places in order (the queue bar); at your turn ▸ วาง or ⏭ Pass,
   🌈 taps a carrier. A ❓ tour of the rules only, read aloud in Thai (rock13-voice/t1…t5.mp3) — no tactics (owner: "ไม่เผยเทคนิค").
   game_plays: game 'rock13', mode 'bot', win 'w' when you rank first, score = your 🪨. window.R13, window.rock13Open. */
(function () {
    'use strict';
    var NAME = 'Carry 13', R = function () { return window.Rock13Rules; };
    var COL = { r: '#dc2626', g: '#16a34a', b: '#2563eb' }, CHIP = { r: '🔴', g: '🟢', b: '🔵', w: '🌈' };
    var g = null, id = null, multi = false, wasMine = false, cfg = { n: 5, rounds: 14 }, pick = { card: null, chip: null }, news = '', timer = null, rng = Math.random, SPEED = 650;
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    try { var c = JSON.parse(get('r13Cfg') || '{}'); if (c.n >= 3 && c.n <= 7) cfg.n = c.n; if (c.rounds === 7) cfg.rounds = 7; } catch (e) { }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function S(k) { if (window.R13Sound) R13Sound.play(k); }   // rock13-sound.js: cues + the soft A2 loop on your turn
    function nm(s) { return s === 0 ? 'คุณ' : g.players[s].name; }

    // ---- a carrier holding a board; the stones are cubes, 3 a row, the newest on top; knees bend toward 13 --------------------
    // V101.390 🏛 Greek C (owner 2026-11-28, mockup-rock13-greek/greek-C.png): a toga with a sash + cape in the carrier colour, gold band,
    // sandals; the board wrapped in cloth; marble stones with serif numbers, the newest outlined in gold. Weight shows in the pose: knees
    // bend, the face goes calm → strained (8) → about to drop (11), 💦 from 8, strain lines from 11. `fx` = { drop: the new stone falls in,
    // fall: the old stones (an array) tumble off after a 💥 } — played once, off under reduced motion.
    var DARK = { r: '#7f1d1d', g: '#14532d', b: '#1e3a8a' }, HAIR = { r: '#5b3417', g: '#2b1d12', b: '#c99a3b' };
    function cubeAt(v, i, n, headY, cube, cls, gold) {
        var row = Math.floor(i / 3), m = Math.min(3, n - row * 3), x = 50 - m * cube / 2 + (i % 3) * cube, y = headY - 17 - (row + 1) * cube;
        return '<g' + cls + '><rect x="' + (x + 2) + '" y="' + (y + 3) + '" width="' + cube + '" height="' + cube + '" rx="2" fill="#0002"/>'
            + '<path d="M' + x + ' ' + y + 'l4 -4h' + cube + 'l-4 4z" fill="#fbf6ea"/><path d="M' + (x + cube) + ' ' + y + 'l4 -4v' + cube + 'l-4 4z" fill="#cdbd9c"/>'
            + '<rect x="' + x + '" y="' + y + '" width="' + cube + '" height="' + cube + '" rx="2" fill="#ece2cc"' + (gold ? ' stroke="#c9973a" stroke-width="2"' : ' stroke="#d6c7a6" stroke-width=".8"') + '/>'
            + '<path d="M' + (x + 3) + ' ' + (y + 6) + 'q6 4 9 1t9 5" stroke="#d3c3a2" stroke-width=".7" fill="none"/>'
            + '<text x="' + (x + cube / 2) + '" y="' + (y + 18) + '" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#5b4632">' + v + '</text></g>';
    }
    function carrier(st, a, fx) {
        fx = fx || {};
        var cube = 24, shown = fx.fall ? fx.fall.length + a.length : a.length, rows = Math.max(1, Math.ceil(shown / 3)), H = 96 + rows * cube, sum = R().sum(a), bend = Math.min(1, sum / 13);
        var headY = H - 66 + bend * 9, legY = H - 24 + bend * 5, knee = 5 + bend * 12, c = COL[st], s = '<svg viewBox="0 0 100 ' + H + '" width="100%" height="' + H + '" aria-hidden="true" style="overflow:visible">';
        s += '<ellipse cx="50" cy="' + (H - 1) + '" rx="' + (20 + bend * 7) + '" ry="3" fill="#0002"/>'
            + '<rect x="10" y="' + (headY - 17) + '" width="80" height="8" rx="4" fill="' + c + '"/><path d="M14 ' + (headY - 13) + 'h72" stroke="' + DARK[st] + '" stroke-width="1.2" opacity=".6"/>';
        if (fx.fall) fx.fall.forEach(function (v, i) { s += cubeAt(v, i, shown, headY, cube, ' class="r13-fall" style="--dx:' + ((i % 3) - 1) * 18 + 'px;--r:' + ((i % 2) ? 40 : -35) + 'deg"', false); });
        a.forEach(function (v, i) { var k = (fx.fall ? fx.fall.length : 0) + i, last = i === a.length - 1; s += cubeAt(v, k, shown, headY, cube, last && (fx.drop || fx.fall) ? ' class="r13-drop"' : '', last); });
        s += '<path d="M37 ' + (headY + 11) + 'q-10 ' + (legY - headY - 4) + ' -6 ' + (legY - headY + 6) + 'h38q4 -10 -6 ' + (-(legY - headY - 4) - 10) + 'z" fill="' + DARK[st] + '" opacity=".85"/>'
            + '<path d="M38 ' + (headY + 14) + 'L20 ' + (headY - 11) + 'M62 ' + (headY + 14) + 'L80 ' + (headY - 11) + '" stroke="#e8b48f" stroke-width="5.5" stroke-linecap="round"/>'
            + '<path d="M26 ' + (headY - 3) + 'l4 3M74 ' + (headY - 3) + 'l-4 3" stroke="#d4a017" stroke-width="3" stroke-linecap="round"/>'
            + '<circle cx="50" cy="' + headY + '" r="8.5" fill="#f0c3a0"/><path d="M41.5 ' + (headY - 2) + 'a8.5 8.5 0 0 1 17 0" fill="' + HAIR[st] + '"/>'
            + [42, 46, 50, 54, 58].map(function (x) { return '<circle cx="' + x + '" cy="' + (headY - 6 + Math.abs(x - 50) / 3) + '" r="2.6" fill="' + HAIR[st] + '"/>'; }).join('')
            + '<path d="M42 ' + (headY - 3) + 'q8 -3 16 0" stroke="#d4a017" stroke-width="1.6" fill="none"/>';
        var ey = headY + 1;
        if (sum >= 11) s += '<path d="M45 ' + (ey - 2) + 'l3 2-3 2M55 ' + (ey - 2) + 'l-3 2 3 2" stroke="#6b2b16" stroke-width="1.4" fill="none"/><path d="M45 ' + (headY + 6) + 'q5 -3 10 0" stroke="#6b2b16" stroke-width="1.6" fill="none"/>';
        else if (sum >= 8) s += '<circle cx="47" cy="' + ey + '" r="1.2" fill="#6b2b16"/><circle cx="53" cy="' + ey + '" r="1.2" fill="#6b2b16"/><path d="M46 ' + (headY + 5.5) + 'h8" stroke="#6b2b16" stroke-width="1.5"/>';
        else s += '<circle cx="47" cy="' + ey + '" r="1.2" fill="#6b2b16"/><circle cx="53" cy="' + ey + '" r="1.2" fill="#6b2b16"/><path d="M46 ' + (headY + 4.5) + 'q4 3 8 0" stroke="#6b2b16" stroke-width="1.4" fill="none"/>';
        if (sum >= 8) s += '<text x="61" y="' + (headY - 1) + '" font-size="' + (sum >= 11 ? 12 : 9) + '">💦</text>';
        if (sum >= 11) s += '<text x="28" y="' + (headY + 3) + '" font-size="10">💦</text><path d="M13 ' + (headY + 22) + 'l-5 -2M87 ' + (headY + 22) + 'l5 -2M14 ' + (headY + 28) + 'l-6 1M86 ' + (headY + 28) + 'l6 1" stroke="#a89676" stroke-width="1.5" stroke-linecap="round"/>';
        var ty = headY + 9, th = legY - headY - 4;
        s += '<path d="M37 ' + ty + 'h26l3 ' + th + 'h-32z" fill="#fbf8f1" stroke="#e3dccb" stroke-width=".8"/>'
            + '<path d="M38 ' + ty + 'l26 ' + (th * .8) + 'v' + (th * .2) + 'l-27 ' + (-th * .85) + 'z" fill="' + c + '"/>'
            + '<rect x="36" y="' + (ty + th * .5) + '" width="28" height="3" fill="#d4a017"/>'
            + '<path d="M44 ' + legY + 'l-' + knee + ' 11l' + (knee - 3) + ' 11M56 ' + legY + 'l' + knee + ' 11l-' + (knee - 3) + ' 11" stroke="#e8b48f" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            + '<path d="M38 ' + (legY + 22) + 'h8M54 ' + (legY + 22) + 'h8" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/></svg>';
        return s;
    }
    /** what changed on each carrier since the last picture: a stone came (drop) or the old ones fell (fall) — each shows once */
    var seen = null;
    function changes() {
        var out = {}, now = {};
        R().ST.forEach(function (st) {
            var a = g.stands[st], b = seen && seen[st];
            now[st] = a.slice();
            if (!b || a.length === 0) return;
            if (a.length === b.length + 1 && b.every(function (v, i) { return v === a[i]; })) out[st] = { drop: 1 };
            else if (a.length === 1 && b.length && (b.length > 1 || b[0] !== a[0] || g.log.length && (g.log[g.log.length - 1] || {}).take)) out[st] = { fall: b };
        });
        seen = now;
        return out;
    }
    function stands(tap, fn) {
        var fx = changes();
        return '<div class="r13-st">' + R().ST.map(function (st) {
            var a = g.stands[st], sum = R().sum(a), cl = sum >= 11 ? ' hot' : sum >= 8 ? ' warm' : '', on = tap && tap[st], left = R().LIMIT - sum;
            var inner = carrier(st, a, fx[st]) + '<div class="r13-sum"><b style="color:' + COL[st] + '">' + sum + '</b><small>/13</small></div>'
                + (on ? '<div class="r13-tap">' + on + '</div>' : '<span class="r13-left' + (sum >= 11 ? ' h' : sum >= 8 ? ' w' : '') + '">' + (sum >= 11 ? '⚠ ' : '') + left + ' left</span>');
            return tap ? '<button type="button" class="r13-c' + cl + ' pick" id="r13-st-' + st + '" onclick="' + (fn || 'R13.put') + '(\'' + st + '\')" aria-label="Carrier ' + st + '">' + inner + '</button>'
                : '<div class="r13-c' + cl + '" id="r13-st-' + st + '">' + inner + '</div>';
        }).join('') + '</div>';
    }
    function players() {
        return '<div class="r13-pl" id="r13-pl">' + g.players.map(function (p, s) {
            return '<span class="' + (s === 0 ? 'me' : '') + '">' + (s === g.first ? '👑 ' : '') + esc(nm(s)) + ' 🪨' + p.pen + '</span>';
        }).join('') + '</div>';
    }
    function queue() {
        var R_ = R(), t = R_.turn(g), done = [], order = [];
        g.log.forEach(function (x) { if (x.r === g.round && x.k === 'place') done.push(x.s); });
        // done in placing order, then the one acting, the rest of the line, then the passers (last passer first)
        order = done.concat(g.main).concat(g.passed.slice().reverse());
        return '<div class="r13-q" id="r13-q">' + order.map(function (s) {
            var sb = g.subs[s] || {}, k = done.indexOf(s) >= 0 ? ' done' : s === t ? ' now' : '', ps = g.passed.indexOf(s) >= 0 ? '⏭ ' : '';
            return '<span class="' + k.trim() + '">' + ps + (sb.chip === 'w' ? '🌈' : CHIP[sb.chip] || '') + ' ' + sb.card + ' ' + esc(nm(s)) + (k === ' done' ? ' ✓' : '') + '</span>';
        }).join('<i>→</i>') + '</div>';
    }

    // ---- ❓ the tour: the rules only, never the tactics; 5 scenes read aloud -------------------------------------------------
    var tour = -1, aud = null;
    function vOn() { return get('r13Voice') !== 'off'; }
    function hush() { if (aud) { try { aud.pause(); } catch (e) { } aud = null; } }
    function say(i) { hush(); if (!vOn()) return; try { aud = new Audio('rock13-voice/t' + (i + 1) + '.mp3'); var p = aud.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { aud = null; } }
    function mini(st, a) { return '<div class="r13-c">' + carrier(st, a) + '<div class="r13-sum"><b style="color:' + COL[st] + '">' + R().sum(a) + '</b><small>/13</small></div></div>'; }
    var TOUR = [
        ['คน 3 คนแบกกระดานหิน 🔴🟢🔵<br>ห้ามให้ใครแบกถึง 13', '3 carriers — never let one reach 13.', function () { return '<div class="r13-st">' + mini('r', [5, 3]) + mini('g', [6, 4, 1]) + mini('b', [2]) + '</div>'; }],
        ['ทุกรอบเลือกการ์ด 1 ใบ + ชิป 1 อัน<br>ทุกคนเลือกลับพร้อมกัน · ใช้ได้ครั้งเดียว', 'Pick a card and a chip, in secret, each once.', function () { return '<div class="r13-hand">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) { return '<span class="r13-card' + (n === 4 ? ' on' : '') + '">' + n + '</span>'; }).join('') + '</div><div class="r13-hand">' + ['r', 'r', 'g', 'g', 'b', 'b', 'w'].map(function (c, i) { return '<span class="r13-chip' + (i === 2 ? ' on' : '') + '">' + CHIP[c] + '</span>'; }).join('') + '</div>'; }],
        ['เปิดแล้ววางทีละคน: 🌈 ก่อน<br>แล้วเลขมากก่อน · เท่ากันเริ่มจาก 👑<br>🌈 เลือกคนแบกเองตอนถึงตา', 'Rainbow first, then the higher card; a tie starts at the crown.', function () { return '<div class="r13-q"><span>🌈 0 มายด์</span><i>→</i><span>🔴 6 ภูมิ</span><i>→</i><span>🟢 4 คุณ</span><i>→</i><span>🔵 4 ต้นข้าว</span></div>'; }],
        ['วางแล้วถึง 13 = หินเก่าหล่นมาหาคุณ<br>ก้อนละ 🪨 1 (0 ก็นับ) · ก้อนของคุณอยู่ต่อ', 'Reach 13 and you take every old stone; yours stays.', function () { return '<div class="r13-st">' + mini('g', [6, 4, 2]) + '<div class="r13-big">+ 3 = 15 💥<br>🪨 +3</div>' + mini('g', [3]) + '</div>'; }],
        ['ถึงตาแล้วกด ⏭ Pass ได้รอบละครั้ง<br>ไปวางท้าย (คน Pass ก่อนวางหลังสุด)<br>🪨 น้อยสุดชนะ · 14 รอบ แจกใหม่หลังรอบ 7', 'Pass once a round to place last · fewest stones wins.', function () { return '<div class="r13-q"><span class="done">🔴 6 ภูมิ ✓</span><i>→</i><span class="now">⏭ 🟢 4 คุณ</span></div>'; }]
    ];
    function tourHtml() {
        var s = TOUR[tour];
        return '<div class="r13 r13-tour" id="r13-tour"><div class="r13-top"><h3>❓ วิธีเล่น</h3><span class="r13-pill">' + (tour + 1) + '/' + TOUR.length + '</span>'
            + '<button type="button" class="r13-x" id="r13-voice" onclick="R13.voice()" aria-label="Sound" aria-pressed="' + vOn() + '">' + (vOn() ? '🔊' : '🔇') + '</button>'
            + '<button type="button" class="r13-x" onclick="R13.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<div class="r13-say" id="r13-tcap">' + s[0] + '<small>' + s[1] + '</small></div>' + s[2]()
            + '<div class="r13-tnav"><button type="button" class="r13-skip" onclick="R13.tourEnd()">ข้าม</button><div class="r13-dots">' + TOUR.map(function (x, n) { return '<i class="' + (n === tour ? 'on' : '') + '"></i>'; }).join('') + '</div>'
            + '<button type="button" class="r13-go" id="r13-tnext" onclick="R13.tourNext()">' + (tour === TOUR.length - 1 ? '▸ เริ่ม' : 'ถัดไป ▸') + '</button></div></div>';
    }

    // ---- screens --------------------------------------------------------------------------------------------------------------
    var X = '<button type="button" class="r13-x" onclick="R13.close()" aria-label="Close">✕</button>';
    function SND() { var o = !window.R13Sound || R13Sound.on(); return '<button type="button" class="r13-x" id="r13-snd" onclick="R13.sound()" aria-label="Sound" aria-pressed="' + o + '">' + (o ? '🔊' : '🔇') + '</button>'; }
    var HQ = '<button type="button" class="r13-x" id="r13-help" onclick="R13.tour()" aria-label="How to play" title="วิธีเล่น">❓</button>';
    function top(extra) { return '<div class="r13-top"><h3>🪨 ' + NAME + '</h3>' + (extra || '') + SND() + HQ + X + '</div>'; }
    function lobbyHtml() {
        // V101.389 🤖 Practice │ 🌐 With friends (rock13-online.js, rooms through roomAct)
        var mode = window.R13Online ? '<div class="r13-rail" role="group" aria-label="Mode">' + [[0, '🤖 Practice'], [1, '🌐 With friends']].map(function (k) { var on = !!k[0] === multi; return '<button type="button" id="r13-mode-' + k[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="R13.online(' + k[0] + ')">' + k[1] + '</button>'; }).join('') + '</div>' : '';
        var rounds = '<div class="r13-rail" role="group" aria-label="Rounds">' + [7, 14].map(function (n) { return '<button type="button" id="r13-r' + n + '" class="' + (cfg.rounds === n ? 'on' : '') + '" aria-pressed="' + (cfg.rounds === n) + '" onclick="R13.set(\'rounds\',' + n + ')">' + n + (multi ? ' rounds' : ' รอบ') + '</button>'; }).join('') + '</div>';
        if (multi && window.R13Online) return '<div class="r13">' + top() + (window.GameTop ? GameTop.line('rock13') : '') + (window.PixelAvatar ? PixelAvatar.lobbyRow() : '') + mode + rounds + R13Online.lobbyHtml() + '</div>';
        return '<div class="r13">' + top() + (window.GameTop ? GameTop.line('rock13') : '') + (window.PixelAvatar ? PixelAvatar.lobbyRow() : '') + mode
            + '<div class="r13-note">🔴🟢🔵 ห้ามแบกถึง 13 · 🪨 น้อยสุดชนะ</div>'
            + '<div class="r13-rail" role="group" aria-label="Players">' + [3, 4, 5, 6, 7].map(function (n) { return '<button type="button" id="r13-n' + n + '" class="' + (cfg.n === n ? 'on' : '') + '" aria-pressed="' + (cfg.n === n) + '" onclick="R13.set(\'n\',' + n + ')">👥 ' + n + '</button>'; }).join('') + '</div>'
            + rounds
            + '<div class="r13-note">คุณ + 🤖 ' + (cfg.n - 1) + '</div>'
            + '<button type="button" class="r13-go" id="r13-start" onclick="R13.start()">▸ เริ่ม</button></div>';
    }
    function handHtml() {
        var p = g.players[0], chips = [];
        ['r', 'g', 'b', 'w'].forEach(function (c) { var max = c === 'w' ? 1 : 2; for (var i = 0; i < max; i++) chips.push([c, i < p.chips[c]]); });
        var ok = pick.card != null && pick.chip;
        return '<div class="r13-hand" role="group" aria-label="Cards">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) {
            var has = p.cards.indexOf(n) >= 0;
            return '<button type="button" class="r13-card' + (pick.card === n ? ' on' : '') + '" data-card="' + n + '"' + (has ? '' : ' disabled') + ' onclick="R13.card(' + n + ')">' + n + '</button>';
        }).join('') + '</div><div class="r13-hand" role="group" aria-label="Chips">' + chips.map(function (x, i) {
            var on = pick.chip === x[0] && x[1] && (i === 0 || chips[i - 1][0] !== x[0] || !chips[i - 1][1]);
            return '<button type="button" class="r13-chip' + (on ? ' on' : '') + '" data-chip="' + x[0] + '"' + (x[1] ? '' : ' disabled') + ' onclick="R13.chip(\'' + x[0] + '\')">' + CHIP[x[0]] + '</button>';
        }).join('') + '</div>'
            + '<button type="button" class="r13-go" id="r13-send" onclick="R13.send()"' + (ok ? '' : ' disabled') + '>▸ ส่ง' + (ok ? ' ' + pick.card + ' · ' + CHIP[pick.chip] : '') + '</button>';
    }
    function turnHtml() {
        var sb = g.subs[0], R_ = R(), pass = R_.canPass(g, 0) ? '<button type="button" class="r13-go alt" id="r13-pass" onclick="R13.pass()">⏭ Pass</button>' : '';
        if (sb.chip === 'w') return '<div class="r13-turn" id="r13-turn"><div class="r13-tt">👉 ตาคุณ · 🌈 แตะคนแบก</div>' + (pass ? '<div class="r13-row">' + pass + '</div>' : '') + '</div>';
        var pv = R_.preview(g, 0, sb.chip);
        return '<div class="r13-turn" id="r13-turn"><div class="r13-tt">👉 ตาคุณ</div>'
            + '<div class="r13-row"><button type="button" class="r13-go' + (pv.take ? ' hit' : '') + '" id="r13-put" onclick="R13.put()">▸ วาง ' + (pv.take ? '💥 🪨' + pv.take : '→ ' + pv.total) + '</button>' + pass + '</div></div>';
    }
    function playHtml() {
        var R_ = R(), mine = g.phase === 'place' && R_.turn(g) === 0, tap = null;
        if (mine && g.subs[0].chip === 'w') { tap = {}; R_.ST.forEach(function (st) { var pv = R_.preview(g, 0, st); tap[st] = '= ' + pv.total + (pv.take ? ' 💥' + pv.take : ''); }); }
        var h = '<div class="r13">' + top('<span class="r13-pill" id="r13-round">' + g.round + '/' + g.rounds + '</span>') + players();
        if (g.phase === 'place') h += queue();
        h += stands(tap);
        if (news) h += '<div class="r13-news" id="r13-news">' + news + '</div>';
        if (g.phase === 'submit') h += handHtml();
        else if (mine) h += turnHtml();
        else h += '<div class="r13-note" id="r13-wait">🤖 กำลังวาง…</div>';
        return h + '</div>';
    }
    function endHtml() {
        var rk = R().ranking(g), my = rk.indexOf(0) + 1, MED = ['🥇', '🥈', '🥉'];
        return '<div class="r13">' + top() + '<div class="r13-big" id="r13-final">' + (my === 1 ? '🏆 คุณชนะ' : 'คุณได้ที่ ' + my) + '</div>'
            + '<div class="r13-rank" id="r13-rank">' + rk.map(function (s, i) { return '<div class="' + (s === 0 ? 'me' : '') + '"><b>' + (MED[i] || i + 1) + '</b><span>' + esc(nm(s)) + '</span><b>🪨 ' + g.players[s].pen + '</b></div>'; }).join('') + '</div>'
            + '<button type="button" class="r13-go" id="r13-again" onclick="R13.start()">↻ อีกรอบ</button><button type="button" class="r13-x" style="align-self:center" onclick="R13.lobby()">⬅ ตั้งค่า</button></div>';
    }

    var CSS = '#r13Modal .modal-content{max-width:440px;padding:14px;border-radius:20px}'
        + '#r13Modal .r13{display:flex;flex-direction:column;gap:9px;color:#0f172a}#r13Modal button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#r13Modal .r13-top{display:flex;align-items:center;gap:6px}#r13Modal .r13-top h3{margin:0;font-size:1.1em;color:#78350f;flex:1;white-space:nowrap}'
        + '#r13Modal .r13-pill{border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:.8em;font-weight:800;white-space:nowrap}'
        + '#r13Modal .r13-x{background:none;border:0;font-size:1.15em;color:#94a3b8;padding:2px 4px}'
        + '#r13Modal .r13-rail{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}#r13Modal .r13-rail button{border:1px solid #fcd34d;border-radius:999px;padding:6px 12px;font-size:.85em;font-weight:800;color:#78350f;background:#fffbeb}'
        + '#r13Modal .r13-rail .on{background:#b45309;border-color:#b45309;color:#fff}'
        + '#r13Modal .r13-go{background:#b45309;color:#fff;border:0;border-radius:14px;padding:11px 16px;font-weight:900;font-size:1em;flex:1}#r13Modal .r13-go.alt{background:#fff;color:#78350f;border:2px solid #b45309}#r13Modal .r13-go:disabled{opacity:.45}'
        + '#r13Modal .r13-note{font-size:.8em;color:#64748b;text-align:center;font-weight:700}'
        + '#r13Modal .r13-pl{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}#r13Modal .r13-pl span{font-size:.72em;font-weight:800;padding:3px 7px;border-radius:999px;background:#f1f5f9}#r13Modal .r13-pl .me{background:#fef3c7;color:#92400e}'
        + '#r13Modal .r13-st{display:flex;gap:6px;align-items:flex-end}#r13Modal .r13-c{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;border-radius:14px;padding:4px 2px;text-align:center;background:#f8fafc;border:2px solid transparent;color:inherit;font:inherit}'
        + '#r13Modal .r13-c.warm{background:#fff7ed}#r13Modal .r13-c.hot{background:#fff1f2}#r13Modal .r13-c.pick{border:2px dashed #b45309}'
        + '#r13Modal .r13-c svg{display:block;max-width:110px}#r13Modal .r13-sum{white-space:nowrap}#r13Modal .r13-sum b{font-size:1.25em}#r13Modal .r13-sum small{opacity:.6;font-weight:800}#r13Modal .r13-tap{font-size:.75em;font-weight:900;color:#b45309}'
        + '#r13Modal .r13-hand{display:flex;gap:4px;justify-content:center}#r13Modal .r13-card{flex:1 1 0;min-width:0;max-width:40px;height:46px;padding:0;border-radius:9px;border:2px solid #cbd5e1;background:#fff;font-weight:900;font-size:1.1em;display:inline-flex;align-items:center;justify-content:center;color:#0f172a}'
        + '#r13Modal .r13-card.on,#r13Modal .r13-chip.on{border-color:#b45309;background:#fffbeb;color:#b45309}#r13Modal .r13-card:disabled,#r13Modal .r13-chip:disabled{opacity:.22}'
        + '#r13Modal .r13-chip{flex:1 1 0;min-width:0;max-width:36px;height:36px;border-radius:50%;border:2px solid transparent;background:none;font-size:1.25em;display:inline-flex;align-items:center;justify-content:center;padding:0}'
        + '#r13Modal .r13-q{display:flex;gap:3px;align-items:center;flex-wrap:wrap;justify-content:center;font-size:.72em;font-weight:800}#r13Modal .r13-q span{padding:3px 7px;border-radius:999px;background:#f1f5f9}#r13Modal .r13-q .done{opacity:.55}#r13Modal .r13-q .now{background:#b45309;color:#fff}#r13Modal .r13-q i{font-style:normal;opacity:.4}'
        + '#r13Modal .r13-turn{border:2px solid #b45309;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:8px;background:#fffbeb}#r13Modal .r13-tt{font-weight:900;text-align:center}#r13Modal .r13-row{display:flex;gap:6px}'
        + '#r13Modal .r13-news{font-size:.85em;font-weight:900;text-align:center;color:#b91c1c}'
        + '#r13Modal .r13-big{font-size:1.4em;font-weight:900;color:#78350f;text-align:center;align-self:center}'
        + '#r13Modal .r13-rank{display:flex;flex-direction:column;gap:4px}#r13Modal .r13-rank div{display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:12px;background:#f8fafc;font-size:.9em}#r13Modal .r13-rank span{flex:1}#r13Modal .r13-rank .me{background:#fef3c7}'
        + '#r13Modal .r13-tour{min-height:400px}#r13Modal .r13-say{background:#fffbeb;border:1px solid #fcd34d;border-radius:14px;padding:10px 12px;font-weight:800;line-height:1.5;color:#78350f}#r13Modal .r13-say small{display:block;font-size:.72em;font-weight:600;color:#64748b}'
        + '#r13Modal .r13-tnav{display:flex;align-items:center;gap:8px;margin-top:auto}#r13Modal .r13-skip{background:none;border:0;color:#64748b;font-weight:800}'
        + '#r13Modal .r13-dots{flex:1;display:flex;gap:4px;justify-content:center}#r13Modal .r13-dots i{width:6px;height:6px;border-radius:9px;background:#fcd34d;display:block}#r13Modal .r13-dots i.on{width:16px;background:#b45309}'
        + '#r13Modal .r13-tnav .r13-go{flex:none}'
        // V101.390 🏛 Greek C
        + '#r13Modal .modal-content{background:radial-gradient(120% 60% at 50% 0%,#fffdf7 0%,#f6f0e2 60%,#efe6d2 100%);border:1px solid #e3d5b5}'
        + '#r13Modal .r13-top h3{font-family:Georgia,"Times New Roman",serif;font-weight:700;letter-spacing:.3px;color:#8a6a1f}'
        + '#r13Modal .r13-go{background:linear-gradient(#f7dc8a,#e2b64c);color:#4a3507;border:1px solid #c9973a;box-shadow:inset 0 1px 0 #fff8,0 2px 0 #b8862f;min-height:48px;font-size:1.05em;white-space:nowrap}'
        + '#r13Modal .r13-go.hit{background:linear-gradient(#d65a4a,#a8281e);color:#fff;border-color:#8f1f17;box-shadow:inset 0 1px 0 #fff5,0 2px 0 #7d1a13}'
        + '#r13Modal .r13-go.alt{background:#fffaf0;color:#6b5320;border:2px solid #d9c38f;box-shadow:none}#r13Modal .r13-go:disabled{opacity:.45}'
        + '#r13Modal .r13-card{height:48px;border-color:#d9c9a6;background:linear-gradient(#fffdf8,#f1e8d4);font-family:Georgia,serif;color:#4a3a28}'
        + '#r13Modal .r13-chip{max-width:44px;height:44px;border-radius:14px}'
        + '#r13Modal .r13-card.on,#r13Modal .r13-chip.on{border-color:#c9973a;background:#fff4d6;color:#8a5a00}'
        + '#r13Modal .r13-c{background:#fffdf8aa;border:2px solid #eadfc6}#r13Modal .r13-c.warm{background:#fff1dc;border-color:#f0a44b}#r13Modal .r13-c.hot{background:#fde4df;border-color:#dc4a3c;animation:r13Shake .5s ease-in-out infinite}'
        + '#r13Modal .r13-c svg{max-width:112px;overflow:visible}#r13Modal .r13-sum{font-family:Georgia,serif;font-weight:700}#r13Modal .r13-sum b{font-size:1.4em}'
        + '#r13Modal .r13-left{font-size:.66em;font-weight:900;border-radius:999px;padding:1px 7px;opacity:.55;white-space:nowrap}#r13Modal .r13-left.w{background:#e07b1a;color:#fff;opacity:1}#r13Modal .r13-left.h{background:#c0352a;color:#fff;opacity:1}'
        + '#r13Modal .r13-tt{font-family:Georgia,serif;color:#b45309;animation:r13Pop 1.6s ease-in-out infinite}#r13Modal .r13-turn{background:#fffaf0;border-color:#d9c38f}'
        + '#r13Modal .r13-q,#r13Modal .r13o-row{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;scrollbar-width:none;padding-bottom:2px}#r13Modal .r13-q>*,#r13Modal .r13o-row>*{flex:none}#r13Modal .r13-q::-webkit-scrollbar,#r13Modal .r13o-row::-webkit-scrollbar{display:none}'
        + '#r13Modal .r13-drop{animation:r13Drop .4s ease-in both}#r13Modal .r13-fall{transform-box:fill-box;transform-origin:center;animation:r13Fall .7s ease-in .15s both}'
        + '@keyframes r13Drop{0%{transform:translateY(-26px);opacity:0}60%{opacity:1}100%{transform:none}}@keyframes r13Fall{to{transform:translate(var(--dx),70px) rotate(var(--r));opacity:0}}'
        + '@keyframes r13Shake{25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}@keyframes r13Pop{50%{transform:scale(1.04)}}'
        + '@media (prefers-reduced-motion:reduce){#r13Modal .r13-c.hot,#r13Modal .r13-drop,#r13Modal .r13-tt{animation:none}#r13Modal .r13-fall{display:none}}';
    function root() {
        var m = document.getElementById('r13Modal');
        if (!m) {
            if (!document.getElementById('r13-css')) { var st = document.createElement('style'); st.id = 'r13-css'; st.textContent = CSS; document.head.appendChild(st); }
            m = document.createElement('div'); m.id = 'r13Modal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', NAME);
            m.innerHTML = '<div class="modal-content"><div id="r13-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) R13.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function render() {
        var m = root(), on = tour < 0 && !!window.R13Online && R13Online.active();
        document.getElementById('r13-body').innerHTML = tour >= 0 ? tourHtml() : on ? R13Online.html() : !g ? lobbyHtml() : g.phase === 'end' ? endHtml() : playHtml(); m.style.display = 'flex';
        var mine = on ? R13Online.mine() : !!g && tour < 0 && (g.phase === 'submit' || (g.phase === 'place' && R().turn(g) === 0));
        if (on && mine && !wasMine) S('turn');   // online: a chime when it comes to me
        wasMine = mine;
        if (window.R13Sound) R13Sound.music(mine);   // the soft loop only on your turn
        if (!on && g && tour < 0 && window.GameLog) {
            var end = g.phase === 'end';
            GameLog.see('rock13', { id: id, n: g.round, done: end, mode: 'bot', win: end ? (R().ranking(g)[0] === 0 ? 'w' : 'l') : null, score: String(g.players[0].pen), res: [] });
        }
    }
    /** let the bots act until it is your turn, a new round or the end */
    function run() {
        clearTimeout(timer); timer = null;
        if (!g || g.phase !== 'place') return;
        var s = R().turn(g); if (s === 0 || s < 0) return;
        timer = setTimeout(function () {
            timer = null; if (!g || g.phase !== 'place' || R().turn(g) !== s) return;
            var t = R().botTurn(g, s);
            if (t.pass) { R().pass(g, s); news = '⏭ ' + esc(nm(s)) + ' Pass'; S('pass'); } else act(s, t.pick);
            if (g.phase === 'place' && R().turn(g) === 0) S('turn');
            render(); run();
        }, SPEED);
    }
    function act(s, st) {
        var round = g.round, pv = R().place(g, s, st);
        if (!pv) return;
        news = pv.take ? '💥 ' + esc(nm(s)) + ' ทำหินหล่น · 🪨 +' + pv.take : '';
        S(pv.take ? 'fall' : 'put');
        if (g.phase === 'end') S(R().ranking(g)[0] === 0 ? 'win' : 'lose');
        else if (g.round !== round) pick = { card: null, chip: null };
    }

    window.R13 = {
        open: function () { g = null; news = ''; if (!get('r13TourSeen')) return R13.tour(); render(); },
        tour: function () { tour = 0; render(); say(0); },
        tourNext: function () { if (tour < 0) return; if (tour < TOUR.length - 1) { tour++; render(); say(tour); } else R13.tourEnd(); },
        tourEnd: function () { hush(); tour = -1; put('r13TourSeen', '1'); render(); },
        voice: function () { put('r13Voice', vOn() ? 'off' : 'on'); if (vOn() && tour >= 0) say(tour); else hush(); render(); },
        set: function (k, v) { if (k === 'n' && v >= 3 && v <= 7) cfg.n = v; if (k === 'rounds') cfg.rounds = v === 7 ? 7 : 14; put('r13Cfg', JSON.stringify(cfg)); render(); },
        lobby: function () { clearTimeout(timer); g = null; news = ''; render(); },
        start: function () {
            clearTimeout(timer);
            var ps = [{ id: 'me', name: 'คุณ' }];
            for (var i = 1; i < cfg.n; i++) ps.push({ id: 'bot' + i, name: '🤖' + i, bot: true });
            g = R().create(ps, cfg.rounds, Math.floor(rng() * cfg.n)); id = Date.now().toString(36) + Math.floor(rng() * 1e6).toString(36);
            pick = { card: null, chip: null }; news = ''; render();
        },
        card: function (n) { if (g && g.phase === 'submit' && g.players[0].cards.indexOf(n) >= 0) { pick.card = n; S('pick'); render(); } },
        chip: function (c) { if (g && g.phase === 'submit' && g.players[0].chips[c] > 0) { pick.chip = c; S('pick'); render(); } },
        send: function () {
            if (!g || !R().canSubmit(g, 0, pick.card, pick.chip)) return;
            R().submit(g, 0, pick.card, pick.chip);
            for (var s = 1; s < g.players.length; s++) { var b = R().botPick(g, s, rng); R().submit(g, s, b.card, b.chip); }
            news = ''; render(); run(); if (g.phase === 'place' && R().turn(g) === 0) S('turn');
        },
        put: function (st) {
            if (!g || g.phase !== 'place' || R().turn(g) !== 0) return;
            var chip = g.subs[0].chip; if (chip === 'w' && !st) return; if (chip !== 'w') st = null;
            act(0, st); render(); run();
        },
        pass: function () { if (g && R().pass(g, 0)) { news = '⏭ คุณ Pass · วางท้าย'; S('pass'); render(); run(); } },
        sound: function () { if (window.R13Sound) R13Sound.toggle(); render(); },
        online: function (v) { multi = !!v; g = null; news = ''; if (!multi && window.R13Online) R13Online.close(); render(); },   // V101.389 🤖 │ 🌐
        close: function () { if (window.R13Online) R13Online.close(); clearTimeout(timer); timer = null; hush(); if (window.R13Sound) R13Sound.music(false); tour = -1; var m = document.getElementById('r13Modal'); if (m) m.style.display = 'none'; },
        // for scripts/rock13-qa.cjs
        _render: function () { render(); }, _cfg: function () { return cfg; },
        _stands: function (G, tap, fn) { var keep = g; g = G; try { return stands(tap, fn); } finally { g = keep; } },   // the carriers for rock13-online.js
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _speed: function (ms) { SPEED = ms; }
    };
    window.rock13Open = function () { R13.open(); };
})();
