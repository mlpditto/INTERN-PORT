/* V101.382 🪨 Carry 13 · ฝึกกับ 🤖 (owner 2026-11-27: game 4 of docs/MIND-GAMES-PLAN.md, our own name and look, pick A3 =
   carriers holding a board with the stones as numbered cubes, mockup-rock13/rock13-A3.png). You + 2–6 🤖, 7 or 14 rounds. Rules in
   rock13-rules.js. Each round: pick a card + a chip → ▸ ส่ง → everyone places in order (the queue bar); at your turn ▸ วาง or ⏭ Pass,
   🌈 taps a carrier. A ❓ tour of the rules only, read aloud in Thai (rock13-voice/t1…t5.mp3) — no tactics (owner: "ไม่เผยเทคนิค").
   game_plays: game 'rock13', mode 'bot', win 'w' when you rank first, score = your 🪨. window.R13, window.rock13Open. */
(function () {
    'use strict';
    var NAME = 'Carry 13', R = function () { return window.Rock13Rules; };
    var COL = { r: '#dc2626', g: '#16a34a', b: '#2563eb' }, CHIP = { r: '🔴', g: '🟢', b: '🔵', w: '🌈' };
    var g = null, id = null, cfg = { n: 5, rounds: 14 }, pick = { card: null, chip: null }, news = '', timer = null, rng = Math.random, SPEED = 650;
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    try { var c = JSON.parse(get('r13Cfg') || '{}'); if (c.n >= 3 && c.n <= 7) cfg.n = c.n; if (c.rounds === 7) cfg.rounds = 7; } catch (e) { }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function S(k) { if (window.R13Sound) R13Sound.play(k); }   // rock13-sound.js: cues + the soft A2 loop on your turn
    function nm(s) { return s === 0 ? 'คุณ' : g.players[s].name; }

    // ---- a carrier holding a board; the stones are cubes, 3 a row, the newest on top; knees bend toward 13 --------------------
    function carrier(st, a) {
        var cube = 20, rows = Math.max(1, Math.ceil(a.length / 3)), H = 82 + rows * cube, sum = R().sum(a), bend = Math.min(1, sum / 13);
        var headY = H - 60 + bend * 6, legY = H - 24 + bend * 4, knee = 6 + bend * 9, s = '<svg viewBox="0 0 100 ' + H + '" width="100%" height="' + H + '" aria-hidden="true">';
        s += '<rect x="12" y="' + (headY - 15) + '" width="76" height="6" rx="3" fill="#a16207"/>';
        a.forEach(function (v, i) {
            var row = Math.floor(i / 3), n = Math.min(3, a.length - row * 3), x = 50 - n * cube / 2 + (i % 3) * cube, y = headY - 15 - (row + 1) * cube, sh = 70 - v * 6;
            s += '<path d="M' + x + ' ' + y + 'l4 -4h' + cube + 'l-4 4z" fill="hsl(215 15% ' + (sh + 12) + '%)"/><path d="M' + (x + cube) + ' ' + y + 'l4 -4v' + cube + 'l-4 4z" fill="hsl(215 15% ' + (sh - 12) + '%)"/>'
                + '<rect x="' + x + '" y="' + y + '" width="' + cube + '" height="' + cube + '" rx="2" fill="hsl(215 15% ' + sh + '%)"/><text x="' + (x + cube / 2) + '" y="' + (y + 15) + '" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">' + v + '</text>';
        });
        s += '<path d="M38 ' + (headY + 14) + 'L20 ' + (headY - 9) + 'M62 ' + (headY + 14) + 'L80 ' + (headY - 9) + '" stroke="#fca5a5" stroke-width="5" stroke-linecap="round"/>'
            + '<circle cx="50" cy="' + headY + '" r="8" fill="#fca5a5"/>' + (bend > .85 ? '<text x="62" y="' + (headY - 2) + '" font-size="11">💦</text>' : '')
            + '<rect x="37" y="' + (headY + 9) + '" width="26" height="' + (legY - headY - 9) + '" rx="6" fill="' + COL[st] + '"/>'
            + '<path d="M43 ' + legY + 'l-' + knee + ' 11l' + (knee - 4) + ' 11M57 ' + legY + 'l' + knee + ' 11l-' + (knee - 4) + ' 11" stroke="#334155" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        return s;
    }
    function stands(tap) {
        return '<div class="r13-st">' + R().ST.map(function (st) {
            var a = g.stands[st], sum = R().sum(a), cl = sum >= 11 ? ' hot' : sum >= 8 ? ' warm' : '', on = tap && tap[st];
            var inner = carrier(st, a) + '<div class="r13-sum"><b style="color:' + COL[st] + '">' + sum + '</b><small>/13 · ' + a.length + '🪨</small></div>' + (on ? '<div class="r13-tap">' + on + '</div>' : '');
            return tap ? '<button type="button" class="r13-c' + cl + ' pick" id="r13-st-' + st + '" onclick="R13.put(\'' + st + '\')" aria-label="Carrier ' + st + '">' + inner + '</button>'
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
        return '<div class="r13">' + top() + (window.GameTop ? GameTop.line('rock13') : '')
            + '<div class="r13-note">🔴🟢🔵 ห้ามแบกถึง 13 · 🪨 น้อยสุดชนะ</div>'
            + '<div class="r13-rail" role="group" aria-label="Players">' + [3, 4, 5, 6, 7].map(function (n) { return '<button type="button" id="r13-n' + n + '" class="' + (cfg.n === n ? 'on' : '') + '" aria-pressed="' + (cfg.n === n) + '" onclick="R13.set(\'n\',' + n + ')">👥 ' + n + '</button>'; }).join('') + '</div>'
            + '<div class="r13-rail" role="group" aria-label="Rounds">' + [7, 14].map(function (n) { return '<button type="button" id="r13-r' + n + '" class="' + (cfg.rounds === n ? 'on' : '') + '" aria-pressed="' + (cfg.rounds === n) + '" onclick="R13.set(\'rounds\',' + n + ')">' + n + ' รอบ</button>'; }).join('') + '</div>'
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
        if (sb.chip === 'w') return '<div class="r13-turn" id="r13-turn"><div class="r13-tt">ตาคุณ · 🌈 ' + sb.card + ' · แตะคนแบก</div>' + (pass ? '<div class="r13-row">' + pass + '</div>' : '') + '</div>';
        var pv = R_.preview(g, 0, sb.chip);
        return '<div class="r13-turn" id="r13-turn"><div class="r13-tt">ตาคุณ · ' + sb.card + ' → ' + CHIP[sb.chip] + ' = ' + pv.total + (pv.take ? ' 💥 เก็บ 🪨 ' + pv.take : '') + '</div>'
            + '<div class="r13-row"><button type="button" class="r13-go" id="r13-put" onclick="R13.put()">▸ วาง</button>' + pass + '</div></div>';
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
        + '#r13Modal .r13-tnav .r13-go{flex:none}';
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
        var m = root(); document.getElementById('r13-body').innerHTML = tour >= 0 ? tourHtml() : !g ? lobbyHtml() : g.phase === 'end' ? endHtml() : playHtml(); m.style.display = 'flex';
        var mine = !!g && tour < 0 && (g.phase === 'submit' || (g.phase === 'place' && R().turn(g) === 0));
        if (window.R13Sound) R13Sound.music(mine);   // the soft loop only on your turn
        if (g && tour < 0 && window.GameLog) {
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
        close: function () { clearTimeout(timer); timer = null; hush(); if (window.R13Sound) R13Sound.music(false); tour = -1; var m = document.getElementById('r13Modal'); if (m) m.style.display = 'none'; },
        // for scripts/rock13-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _speed: function (ms) { SPEED = ms; }
    };
    window.rock13Open = function () { R13.open(); };
})();
