/* V101.402 🌙 Midnight Market · practice with 🤖 (owner 2026-11-29, docs/VAULT-SWAP-PLAN.md PR 1; screen pick A = the dark table,
   mock-vault/vault-swap-mockups.png; a game-show mechanic with our own name, heist mood and drawings). You + 3–6 bots, 🥄 1–3.
   A heist: your card shows below, everyone else's is face down on the table with the 🕴 Fence (3) and the 🗑 Bin (1). The strip on
   top is the queue: ➡ pass 1, ⬅ pass 2. On your turn: tap a card, then ⇄ Swap (you must); 👁 then a Fence / Bin card looks at it
   once a game. A card you know where it is (you held it, or looked) carries a small tag. Under a name: what that seat swapped with.
   📊 after the two passes all cards turn; after 3 heists the partners show and final = total × partner's total.
   Rules in midnight-rules.js. A ❓ tour of the rules only, ONE page (5 lines, English first), read aloud in Thai line after line
   (midnight-voice/t1…t5.mp3) — no tactics (owner: every game gets a voiced tutorial of the rules).
   game_plays: game 'midnight', mode '<seats>p-l<level>', score = the final, win 'w' when you rank first.
   window.MM, window.midnightOpen. */
(function () {
    'use strict';
    var NAME = 'Midnight Market', R = function () { return window.MidnightRules; };
    var g = null, ui = null, tour = -1, aud = null, tread = -1, timer = null, STEP = 900, cfg = { n: 5, lv: 2 };
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    var a = +get('mmSeats'), b = +get('mmLevel'); if (a >= 4 && a <= 7) cfg.n = a; if (b >= 1 && b <= 3) cfg.lv = b;
    var BOTS = [['Mint', '1320211'], ['Poom', '0102031'], ['Fern', '3211102'], ['Bank', '1111111'], ['Nan', '0000000'], ['Tul', '2412034']];   // 🤖 names + pixel faces
    var KIND = { J: ['💎', '#38bdf8', '#082f49', 'Jewels'], G: ['🪙', '#facc15', '#422006', 'Gold'], A: ['🖼', '#f472b6', '#500724', 'Art'], C: ['💵', '#4ade80', '#052e16', 'Cash'], T: ['📡', '#7f1d1d', '#fff', 'Tracker'] };
    function num(n) { return n < 0 ? '−' + (-n) : String(n); }

    // ---- sound: short cues made in the phone (no files) ----------------------------------------------------------------------
    var ac = null;
    function sndOn() { return get('mmSound') !== 'off'; }
    function cue(k) {
        if (!sndOn()) return;
        try {
            ac = ac || new (window.AudioContext || window.webkitAudioContext)();
            var P = { swap: [[420, .05], [620, .07]], mine: [[520, .06], [780, .1]], peek: [[900, .05], [1200, .08]], no: [[180, .18]], show: [[523, .08], [659, .08], [784, .14]], bonus: [[880, .08], [1320, .12]] }[k] || [], t = ac.currentTime;
            P.forEach(function (p) {
                var o = ac.createOscillator(), v = ac.createGain(); o.type = k === 'no' ? 'square' : 'sine'; o.frequency.value = p[0];
                v.gain.setValueAtTime(.0001, t); v.gain.exponentialRampToValueAtTime(.1, t + .01); v.gain.exponentialRampToValueAtTime(.0001, t + p[1]);
                o.connect(v); v.connect(ac.destination); o.start(t); o.stop(t + p[1] + .02); t += p[1];
            });
        } catch (e) { }
    }

    // ---- ❓ the tour: the rules only, one page; the voice reads the 5 lines one after another and frames the one it is on -------
    function vOn() { return get('mmVoice') !== 'off'; }
    function hush() { if (aud) { aud.onended = null; try { aud.pause(); } catch (e) { } aud = null; } tread = -1; }
    function mark(i) { tread = i; var r = document.querySelectorAll('#mm-tour .mm-rule'); for (var k = 0; k < r.length; k++) r[k].classList.toggle('now', k === i); }
    function say(i) {   // reads line i, then the next one, to the end
        hush(); if (!vOn()) return mark(-1);
        try {
            var x = aud = new Audio('midnight-voice/t' + (i + 1) + '.mp3'); mark(i);
            x.onended = function () { if (aud !== x) return; aud = null; if (tour >= 0 && i < TOUR.length - 1) say(i + 1); else mark(-1); };
            var p = x.play(); if (p && p.catch) p.catch(function () { if (aud === x) { aud = null; mark(-1); } });
        } catch (e) { aud = null; mark(-1); }
    }
    var TOUR = [   // [Thai line (what the voice reads), English line]
        ['🃏 ทุกคนได้ไพ่คว่ำคนละ 1 ใบ เห็นเฉพาะของตัวเอง · อีก 3 ใบอยู่ที่นายหน้า · 1 ใบอยู่ในถัง', 'One hidden card each · 3 at the 🕴 Fence · 1 in the 🗑 Bin.'],
        ['⇄ ทุกคนต้องสลับไพ่ 2 ครั้งต่อรอบ · ครั้งแรกเรียงตามคิว ครั้งที่สองย้อนคิว · สลับกับเพื่อน นายหน้า หรือถังก็ได้', 'Everyone must swap twice: ➡ in turn, then ⬅ backwards.'],
        ['📊 จบรอบเปิดไพ่ทั้งหมด · ไพ่ชนิดเดียวกับที่นายหน้ามี ได้แต้มตามเลข คูณจำนวนใบของชนิดนั้น · ไม่ตรงได้ศูนย์', 'Your loot scores its number × the Fence cards of its kind.'],
        ['📡 เครื่องติดตามแต้มติดลบ · ถืออยู่ต้องสลับกับผู้เล่นเท่านั้น · ถ้ามีคนมาสลับเอาไป เราได้บวก 3 · 👁 แอบดูไพ่นายหน้าหรือถังได้ 1 ครั้งต่อเกม', '📡 Tracker: minus, players only; taken from you = +3 · 👁 one peek.'],
        ['🤝 ทุกคนมีคู่หูลับ 1 คน · เล่น 3 รอบ · แต้มสุดท้ายเท่ากับแต้มรวมของเรา คูณแต้มรวมของคู่หู · มากที่สุดชนะ', '🤝 Final = your total × your secret partner\'s · 3 heists.']
    ];
    function tourHtml() {
        return '<div class="mm mm-tour" id="mm-tour"><div class="mm-top"><h3>❓ How to play</h3>'
            + '<button type="button" class="mm-x" id="mm-voice" onclick="MM.voice()" aria-label="Voice" aria-pressed="' + vOn() + '">' + (vOn() ? '🔊' : '🔇') + '</button>'
            + '<button type="button" class="mm-x" onclick="MM.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<ol class="mm-rules" id="mm-tcap">' + TOUR.map(function (s, i) { return '<li class="mm-rule' + (i === tread ? ' now' : '') + '"><i aria-hidden="true">' + (i + 1) + '</i><div><b>' + s[1] + '</b><small>' + s[0] + '</small></div></li>'; }).join('') + '</ol>'
            + '<button type="button" class="mm-go" id="mm-tnext" onclick="MM.tourEnd()">▸ Start</button></div>';
    }

    // ---- pieces ----------------------------------------------------------------------------------------------------------------
    var X = '<button type="button" class="mm-x" onclick="MM.close()" aria-label="Close">✕</button>';
    var HQ = '<button type="button" class="mm-x" id="mm-help" onclick="MM.tour()" aria-label="How to play" title="How to play">❓</button>';
    function SND() { return '<button type="button" class="mm-x" id="mm-snd" onclick="MM.sound()" aria-label="Sound" aria-pressed="' + sndOn() + '">' + (sndOn() ? '🔊' : '🔇') + '</button>'; }
    function top(title, extra) { return '<div class="mm-top"><h3>' + title + '</h3>' + (extra || '') + SND() + HQ + X + '</div>'; }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function nm(s) { return esc(g.players[s].name); }
    function av(s, sz) {
        var PA = window.PixelAvatar, code = s === 0 ? (PA && PA.mine()) : BOTS[s - 1][1], f = PA && code ? PA.face(code, sz, 'mm-av') : '';
        return f || '<span class="mm-av" style="width:' + sz + 'px;height:' + sz + 'px">' + nm(s).charAt(0) + '</span>';
    }
    var DIAL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="#facc15" stroke-width="2.5"/><circle cx="20" cy="20" r="4" fill="#facc15"/>'
        + [0, 45, 90, 135, 180, 225, 270, 315].map(function (d) { return '<line x1="20" y1="7" x2="20" y2="11" stroke="#facc15" stroke-width="2" transform="rotate(' + d + ' 20 20)"/>'; }).join('')
        + '<line x1="20" y1="20" x2="27" y2="13" stroke="#facc15" stroke-width="2.5" stroke-linecap="round"/></svg>';
    function lab(key) { return key === 'b' ? '🗑' : key.charAt(0) === 'f' ? '🕴' + (+key.slice(1) + 1) : nm(+key.slice(1)); }
    function say1(key) { return key === 'b' ? 'the Bin' : key.charAt(0) === 'f' ? 'Fence slot ' + (+key.slice(1) + 1) : nm(+key.slice(1)); }
    /** a card on the table: face down for you, with a tag when you know it */
    function slot(key, badge) {
        var my = R().turn(g) === 0, ok = my && (ui.peek ? R().canPeek(g, 0, key) : R().targets(g, 0).indexOf(key) >= 0), k = g.know[0][key];
        var hit = ui.hit && (ui.hit[0] === key || ui.hit[1] === key);
        return '<button type="button" class="mm-card back' + (ui.sel === key ? ' sel' : '') + (hit ? ' hit' : '') + (my && !ok ? ' off' : '') + '" id="mm-s-' + key + '"' + (ok ? '' : ' disabled')
            + ' onclick="MM.pick(\'' + key + '\')" aria-label="' + say1(key) + (k ? ' · ' + KIND[k.k][3] + ' ' + num(k.n) : '') + '" aria-pressed="' + (ui.sel === key) + '">' + DIAL
            + (k ? '<i class="mm-kn" style="background:' + KIND[k.k][1] + ';color:' + KIND[k.k][2] + '">' + KIND[k.k][0] + num(k.n) + '</i>' : '') + (badge ? '<span class="fc">' + badge + '</span>' : '') + '</button>';
    }
    function face(c, cls) { return '<span class="mm-card up ' + (cls || '') + '" style="background:' + KIND[c.k][1] + ';color:' + KIND[c.k][2] + '" title="' + KIND[c.k][3] + '"><em>' + KIND[c.k][0] + '</em><b>' + num(c.n) + '</b></span>'; }
    function strip() {
        var q = R().queue(g);
        return '<div class="mm-strip" id="mm-strip"><span id="mm-pass" title="' + (g.pass === 1 ? 'Swap 1 · in turn' : 'Swap 2 · backwards') + '">' + (g.pass === 1 ? '➡ 1' : '⬅ 2') + '</span><span class="q">'
            + q.map(function (s, i) { return '<span class="w' + (i === g.ti ? ' on' : i < g.ti ? ' dn' : '') + '" title="' + nm(s) + '">' + av(s, 22) + '</span>'; }).join('') + '</span></div>';
    }
    function moved(s) { for (var i = g.log.length - 1; i >= 0; i--) if (g.log[i].by === s) return '⇄ ' + lab(g.log[i].to); return ''; }
    function fence(open) {
        return '<div class="mm-fence"><div class="grp"><span class="mm-lab">🕴 FENCE BUYS</span><div>' + [0, 1, 2].map(function (i) { return open ? face(g.at['f' + i]) : slot('f' + i); }).join('') + '</div></div>'
            + '<span class="sep"></span><div class="grp"><span class="mm-lab">🗑 BIN</span><div>' + (open ? face(g.at.b) : slot('b')) + '</div></div></div>';
    }

    // ---- screens ---------------------------------------------------------------------------------------------------------------
    function lobbyHtml() {
        var seats = '<span class="mm-grp" role="group" aria-label="Players"><span class="mm-lbl" title="Players">👥</span>' + [4, 5, 6, 7].map(function (n) { return '<button type="button" id="mm-n' + n + '" class="' + (cfg.n === n ? 'on' : '') + '" aria-pressed="' + (cfg.n === n) + '" title="You + 🤖 ' + (n - 1) + '" onclick="MM.set(\'n\',' + n + ')">' + n + '</button>'; }).join('') + '</span>';
        var lv = '<span class="mm-grp" role="group" aria-label="Bot level"><span class="mm-lbl" title="Bot level">🤖</span>' + [1, 2, 3].map(function (n) { return '<button type="button" id="mm-lv' + n + '" class="' + (cfg.lv === n ? 'on' : '') + '" aria-pressed="' + (cfg.lv === n) + '" title="Level ' + n + '" onclick="MM.set(\'lv\',' + n + ')">' + '🥄'.repeat(n) + '</button>'; }).join('') + '</span>';
        return '<div class="mm">' + top('🌙 ' + NAME)
            + '<div class="mm-note" title="⇄ สลับไพ่คว่ำ 2 ครั้ง → ให้ตรงกับที่ 🕴 นายหน้ารับซื้อ · 3 รอบ&#10;⇄ 카드를 두 번 바꾸고 → 🕴 장물아비가 사는 것과 맞추기 · 3라운드">⇄ swap twice → match the 🕴 Fence · 3 heists</div>'
            + '<div class="mm-rail">' + seats + lv + '</div>'
            + '<button type="button" class="mm-go" id="mm-start" onclick="MM.start()">▸ Start</button></div>';
    }
    function playHtml() {
        var my = R().turn(g) === 0, t = R().turn(g), others = [], i, mine = g.at.p0, last = g.log[g.log.length - 1];
        for (i = 1; i < g.n; i++) others.push(i);
        var ev = !last ? '' : '⇄ ' + nm(last.by) + ' ↔ ' + lab(last.to) + (last.bonus >= 0 ? ' · 📡 ' + nm(last.bonus) + ' +3' : '');
        var go = !my ? '<button type="button" class="mm-go wait" id="mm-swap" disabled>… ' + nm(t) + '</button>'
            : ui.peek ? '<button type="button" class="mm-go alt" id="mm-swap" onclick="MM.peek()">👁 Tap a 🕴 / 🗑 card · ✕</button>'
            : '<button type="button" class="mm-go" id="mm-swap"' + (ui.sel ? '' : ' disabled') + ' onclick="MM.swap()">' + (ui.sel ? '⇄ Swap with ' + lab(ui.sel) : '👆 Tap a card') + '</button>';
        return '<div class="mm">' + top('🌙 Heist ' + g.heist + '/' + g.heists) + strip()
            + '<div class="mm-felt">' + fence(false) + '<div class="mm-seats" style="grid-template-columns:repeat(' + others.length + ',minmax(0,1fr))">'
            + others.map(function (s) { return '<div class="mm-seat' + (t === s ? ' turn' : '') + '" id="mm-seat-' + s + '">' + slot('p' + s, av(s, 18)) + '<span class="nm">' + nm(s) + '</span><small>' + moved(s) + '</small></div>'; }).join('') + '</div></div>'
            + '<div class="mm-ev" id="mm-ev" aria-live="polite">' + (ev || '&nbsp;') + '</div>'
            + '<div class="mm-me"><span id="mm-mine" class="' + (ui.hit && (ui.hit[0] === 'p0' || ui.hit[1] === 'p0') ? 'hit' : '') + '">' + face(mine, 'big') + '</span><div class="t">'
            + '<span class="mm-chip" id="mm-total" title="Your total">⭐ ' + num(g.players[0].total) + '</span><span class="mm-chip" id="mm-mate" title="Your secret partner · final = your total × theirs&#10;คู่หูลับของคุณ · แต้มสุดท้าย = แต้มรวมของคุณ × ของคู่หู&#10;비밀 파트너 · 최종 점수 = 내 합계 × 파트너 합계">🤝 ' + av(g.partner[0], 18) + ' ' + nm(g.partner[0]) + '</span>'
            + '<button type="button" class="mm-chip' + (ui.peek ? ' on' : '') + '" id="mm-peek"' + (my && g.players[0].peek > 0 ? '' : ' disabled') + ' onclick="MM.peek()" title="Look at one 🕴 / 🗑 card · once a game&#10;แอบดูไพ่ของนายหน้าหรือถัง 1 ใบ · เกมละ 1 ครั้ง&#10;🕴 / 🗑 카드 한 장 보기 · 게임당 1번" aria-pressed="' + !!ui.peek + '">👁 Peek · ' + g.players[0].peek + '</button>'
            + '</div></div>' + go + '</div>';
    }
    function showHtml() {
        var order = g.players.map(function (p, i) { return i; }).sort(function (x, y) { return g.res[y].sum - g.res[x].sum || x - y; });
        return '<div class="mm mm-show">' + top('📊 Heist ' + g.heist + '/' + g.heists) + '<div class="mm-felt">' + fence(true) + '</div>'
            + '<div class="mm-rows" id="mm-res">' + order.map(function (s) {
                var r = g.res[s], c = r.card, bits = [];
                if (c.k !== 'T') bits.push(r.mult ? KIND[c.k][0] + ' ×' + r.mult : 'no buyer'); else if (g.heist < g.heists && g.next === s) bits.push('starts next');
                if (r.bonus) { if (c.k !== 'T' && !r.mult) bits.pop(); bits.push('+' + r.bonus + ' 📡'); }
                var note = bits.join(' · ');
                return '<div class="mm-row' + (s === 0 ? ' me' : '') + '">' + av(s, 24) + '<span class="nm">' + nm(s) + (g.heist > 1 ? ' <small>⭐ ' + num(g.players[s].total) + '</small>' : '') + '</span><small>' + note + '</small>' + face(c, 'sm') + '<b class="p ' + (r.sum > 0 ? 'g' : r.sum < 0 ? 'r' : '') + '">' + (r.sum > 0 ? '+' : '') + num(r.sum) + '</b></div>';
            }).join('') + '</div>'
            + '<button type="button" class="mm-go" id="mm-next" onclick="MM.next()">' + (g.heist < g.heists ? '▸ Heist ' + (g.heist + 1) : '▸ Result') + '</button></div>';
    }
    function endHtml() {
        var rk = R().ranking(g), medal = ['🥇', '🥈', '🥉'];
        return '<div class="mm">' + top('🌙 Result') + '<div class="mm-big" id="mm-final">' + (rk[0] === 0 ? '🏆 ' : '') + nm(rk[0]) + ' · ' + num(g.final[rk[0]]) + '</div>'
            + '<div class="mm-note">🤝 final = total × secret partner\'s total</div>'
            + '<div class="mm-rows" id="mm-rank">' + rk.map(function (s, i) {
                var p = g.partner[s], f = g.final[s];
                return '<div class="mm-row' + (s === 0 ? ' me' : '') + '"><b class="rk">' + (medal[i] || i + 1) + '</b>' + av(s, 24) + '<span class="nm">' + nm(s) + '</span><small>' + num(g.players[s].total) + ' × ' + av(p, 16) + ' ' + num(g.players[p].total) + '</small><b class="p ' + (f > 0 ? 'g' : f < 0 ? 'r' : '') + '">' + num(f) + '</b></div>';
            }).join('') + '</div>'
            + '<button type="button" class="mm-go" id="mm-again" onclick="MM.start()">↻ Again</button><button type="button" class="mm-x" style="align-self:center" onclick="MM.lobby()">⬅ Players</button></div>';
    }

    var CSS = '#mmModal .modal-content{max-width:440px;padding:12px;border-radius:20px;background:#fffdf8;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}'
        + '#mmModal .mm{display:flex;flex-direction:column;gap:8px;color:#0f172a}#mmModal button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#mmModal .mm-top{display:flex;align-items:center;gap:6px}#mmModal .mm-top h3{margin:0;font-size:1.05em;color:#0f172a;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '#mmModal .mm-pill{border:1px solid #e2e8f0;border-radius:999px;padding:3px 9px;font-size:.82em;font-weight:900;white-space:nowrap;background:#fff}'
        + '#mmModal .mm-x{background:none;border:0;font-size:1.15em;color:#94a3b8;padding:2px 4px;min-width:32px;min-height:32px}'
        + '#mmModal .mm-av{border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;flex:none;overflow:hidden;font-weight:900;font-size:.8em;color:#334155}'
        + '#mmModal .mm-strip{display:flex;align-items:center;gap:6px;font-size:.84em;font-weight:900;color:#334155}#mmModal .mm-strip .q{display:flex;gap:3px;flex:1;align-items:center;min-width:0}'
        + '#mmModal .mm-strip .w{border-radius:50%;padding:2px;border:2px solid transparent;display:inline-flex}#mmModal .mm-strip .w.on{border-color:#f59e0b;box-shadow:0 0 0 2px #fef3c7}#mmModal .mm-strip .w.dn{opacity:.35}'
        + '#mmModal .mm-card{width:44px;max-width:100%;aspect-ratio:11/15;border-radius:9px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;position:relative;flex:none;box-sizing:border-box;padding:0}'
        + '#mmModal .mm-card.back{background:repeating-linear-gradient(45deg,#1e293b 0 6px,#26344b 6px 12px);border:2px solid #475569}#mmModal .mm-card.back svg{width:60%;height:auto}'
        + '#mmModal .mm-card.back.off{opacity:.38}#mmModal .mm-card.back:disabled{cursor:default}#mmModal .mm-card.sel{border-color:#facc15;box-shadow:0 0 0 3px rgba(250,204,21,.45)}#mmModal .mm-card.hit{border-color:#38bdf8}'
        + '#mmModal .mm-kn{position:absolute;right:-5px;top:-7px;font-style:normal;font-size:10px;line-height:1.3;border-radius:999px;padding:0 4px;font-weight:900;border:1px solid #0f172a;white-space:nowrap}'
        + '#mmModal .mm-card.up em{font-style:normal;font-size:19px;line-height:1}#mmModal .mm-card.up b{font-size:18px;line-height:1.1}'
        + '#mmModal .mm-card.big{width:60px;border-radius:12px}#mmModal .mm-card.big em{font-size:27px}#mmModal .mm-card.big b{font-size:25px}#mmModal .mm-card.sm{width:32px;border-radius:7px}#mmModal .mm-card.sm em{font-size:14px}#mmModal .mm-card.sm b{font-size:13px}'
        + '#mmModal #mm-mine.hit .mm-card{box-shadow:0 0 0 3px #38bdf8}'
        + '#mmModal .mm-felt{background:#0f172a;border-radius:16px;padding:10px 8px;color:#e2e8f0;display:flex;flex-direction:column;gap:10px}#mmModal .mm-lab{font-size:.7em;font-weight:900;color:#94a3b8;letter-spacing:.02em;white-space:nowrap}'
        + '#mmModal .mm-fence{display:flex;align-items:flex-end;gap:6px;justify-content:center}#mmModal .mm-fence .grp{display:flex;flex-direction:column;align-items:center;gap:6px}#mmModal .mm-fence .grp>div{display:flex;gap:6px}#mmModal .mm-fence .sep{width:1px;align-self:stretch;background:#334155;margin:0 4px}'
        + '#mmModal .mm-seats{display:grid;gap:4px}#mmModal .mm-seat{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.68em;font-weight:800;color:#e2e8f0;min-width:0;border-radius:10px;padding:6px 0 2px}'
        + '#mmModal .mm-seat.turn{background:#1e293b;box-shadow:0 0 0 1px #f59e0b}#mmModal .mm-seat .nm{margin-top:8px;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}#mmModal .mm-card .fc{position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);display:inline-flex;border:2px solid #0f172a;border-radius:50%}'
        + '#mmModal .mm-seat small{font-size:.92em;color:#fbbf24;min-height:1.3em;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
        + '#mmModal .mm-ev{font-size:.8em;font-weight:800;color:#475569;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '#mmModal .mm-me{display:flex;gap:10px;align-items:center}#mmModal .mm-me .t{flex:1;display:flex;flex-wrap:wrap;gap:6px;min-width:0}'
        + '#mmModal .mm-chip{border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:.84em;font-weight:900;background:#fff;color:#0f172a;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;min-height:32px}'
        + '#mmModal button.mm-chip{min-height:36px}#mmModal .mm-chip.on{border-color:#f59e0b;background:#fffbeb}#mmModal .mm-chip:disabled{opacity:.4;cursor:default}'
        + '#mmModal .mm-go{background:#0f172a;color:#facc15;border:0;border-radius:14px;padding:11px 16px;font-weight:900;font-size:1.05em;min-height:48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '#mmModal .mm-go.alt{background:#fffbeb;color:#92400e;border:2px solid #fcd34d}#mmModal .mm-go:disabled{background:#e2e8f0;color:#64748b;cursor:default}'
        + '#mmModal .mm-note{font-size:.82em;color:#64748b;text-align:center;font-weight:700}'
        + '#mmModal .mm-rail{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}#mmModal .mm-grp{display:inline-flex;align-items:center;gap:4px}#mmModal .mm-lbl{font-size:1.05em}'
        + '#mmModal .mm-grp button{border:2px solid #e2e8f0;border-radius:12px;background:#fff;min-width:40px;min-height:40px;padding:4px 8px;font-weight:900;font-size:.95em;color:#0f172a}#mmModal .mm-grp button.on{border-color:#0f172a;background:#fef9c3}'
        + '#mmModal .mm-rows{display:flex;flex-direction:column;gap:4px}#mmModal .mm-row{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:12px;background:#f8fafc;font-size:.88em;font-weight:800;text-align:left}#mmModal .mm-row.me{background:#eef2ff}'
        + '#mmModal .mm-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mmModal .mm-row small{color:#64748b;font-weight:800;white-space:nowrap;display:inline-flex;align-items:center;gap:3px}'
        + '#mmModal .mm-row .nm small{display:inline;font-size:.85em}#mmModal .mm-row b.p{min-width:34px;text-align:right}#mmModal .mm-row b.p.g{color:#15803d}#mmModal .mm-row b.p.r{color:#b91c1c}#mmModal .mm-row b.rk{min-width:20px;text-align:center}'
        + '#mmModal .mm-big{font-size:1.5em;font-weight:900;text-align:center}'
        + '@media (max-height:700px){#mmModal .mm-show{gap:6px}#mmModal .mm-show .mm-felt{padding:7px 8px}#mmModal .mm-show .mm-fence .mm-card{width:32px;border-radius:7px}#mmModal .mm-show .mm-fence .mm-card em{font-size:14px}#mmModal .mm-show .mm-fence .mm-card b{font-size:13px}'
        + '#mmModal .mm-show .mm-rows{gap:3px}#mmModal .mm-show .mm-row{padding:2px 9px}#mmModal .mm-show .mm-row .mm-card{width:25px;border-radius:6px}#mmModal .mm-show .mm-row .mm-card em{font-size:11px}#mmModal .mm-show .mm-row .mm-card b{font-size:11px}#mmModal .mm-show .mm-go{min-height:44px;padding:8px 16px}}'
        + '#mmModal .mm-rules{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}#mmModal .mm-rule{display:flex;gap:10px;align-items:center;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:5px 10px}'
        + '#mmModal .mm-rule>i{flex:none;width:24px;height:24px;border-radius:50%;background:#0f172a;color:#facc15;font-style:normal;font-weight:900;font-size:.8em;line-height:24px;text-align:center}#mmModal .mm-rule.now{border-color:#f59e0b;box-shadow:0 0 0 2px #fde68a}'
        + '#mmModal .mm-rule>div{min-width:0;flex:1}#mmModal .mm-rule>div>b{display:block;font-weight:700;font-size:.86em;line-height:1.3;color:#0f172a}#mmModal .mm-rule>div>small{display:block;font-size:.72em;font-weight:600;line-height:1.35;color:#64748b}'
        + '#mmModal .mm-tour .mm-go{position:sticky;bottom:0;box-shadow:0 -6px 0 #fffdf8,0 14px 0 #fffdf8}'
        + '@media (prefers-reduced-motion:reduce){#mmModal *{transition:none!important;animation:none!important}}';
    function root() {
        var m = document.getElementById('mmModal');
        if (!m) {
            if (!document.getElementById('mm-css')) { var st = document.createElement('style'); st.id = 'mm-css'; st.textContent = CSS; document.head.appendChild(st); }
            m = document.createElement('div'); m.id = 'mmModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', NAME);
            m.innerHTML = '<div class="modal-content"><div id="mm-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) MM.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function render() {
        var m = root();
        document.getElementById('mm-body').innerHTML = tour >= 0 ? tourHtml() : !g ? lobbyHtml() : g.phase === 'end' ? endHtml() : g.phase === 'show' ? showHtml() : playHtml();
        m.style.display = 'flex';
        if (g && tour < 0 && window.GameLog) {
            var end = g.phase === 'end';
            GameLog.see('midnight', { id: ui.id, n: ui.hist.length, done: end, mode: g.n + 'p-l' + cfg.lv, win: end ? (R().ranking(g)[0] === 0 ? 'w' : 'l') : null, score: end ? String(g.final[0]) : '', res: ui.hist });
        }
    }

    // ---- the table: bots swap one by one with a short pause, then it is your turn ----------------------------------------------
    function stop() { clearTimeout(timer); timer = null; }
    function after() {   // a swap was made
        var l = g.log[g.log.length - 1]; if (l) ui.hit = ['p' + l.by, l.to];
        if (g.phase === 'show') { ui.hist.push(String(g.res[0].sum)); ui.hit = null; cue('show'); }
        ui.sel = null; ui.peek = false; render(); run();
    }
    function run() {
        stop(); if (!g || tour >= 0 || g.phase !== 'swap') return;
        var s = R().turn(g); if (s === 0) return;
        timer = setTimeout(function () {
            timer = null; if (!g || g.phase !== 'swap' || R().turn(g) !== s) return;
            var m = R().botMove(g, s); if (m.peek) R().peek(g, s, m.peek);
            var took = m.to === 'p0' && g.at.p0.k === 'T';
            R().swap(g, s, m.to); cue(took ? 'bonus' : m.to === 'p0' ? 'mine' : 'swap'); after();
        }, STEP);
    }

    window.MM = {
        open: function () { stop(); g = null; if (!get('mmTourSeen')) return MM.tour(); render(); },
        tour: function () { stop(); tour = 0; render(); say(0); },
        tourEnd: function () { hush(); tour = -1; put('mmTourSeen', '1'); render(); run(); },
        voice: function () { put('mmVoice', vOn() ? 'off' : 'on'); if (vOn() && tour >= 0) say(0); else hush(); render(); },
        sound: function () { put('mmSound', sndOn() ? 'off' : 'on'); var x = document.getElementById('mm-snd'); if (x) { x.textContent = sndOn() ? '🔊' : '🔇'; x.setAttribute('aria-pressed', sndOn()); } },
        set: function (k, v) { if (k === 'n' && v >= 4 && v <= 7) { cfg.n = v; put('mmSeats', String(v)); } if (k === 'lv' && v >= 1 && v <= 3) { cfg.lv = v; put('mmLevel', String(v)); } render(); },
        lobby: function () { stop(); g = null; render(); },
        start: function (seed) {
            stop();
            var PA = window.PixelAvatar, ps = [{ id: 'me', name: (PA && PA.nameOf && PA.nameOf()) || 'You' }];
            for (var i = 1; i < cfg.n; i++) ps.push({ id: 'bot' + i, name: BOTS[i - 1][0], bot: true, level: cfg.lv });
            g = R().create(ps, seed || Math.floor(Math.random() * 2147483647) + 1);
            ui = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), sel: null, peek: false, hit: null, hist: [] };
            render(); run();
        },
        pick: function (key) {
            if (!g || g.phase !== 'swap' || R().turn(g) !== 0) return;
            if (ui.peek) { if (!R().peek(g, 0, key)) return; ui.peek = false; cue('peek'); return render(); }
            if (R().targets(g, 0).indexOf(key) < 0) return;
            ui.sel = ui.sel === key ? null : key; render();
        },
        peek: function () { if (!g || R().turn(g) !== 0 || g.players[0].peek < 1) return; ui.peek = !ui.peek; ui.sel = null; render(); },
        swap: function () { if (!g || !ui.sel || R().turn(g) !== 0) return; if (!R().swap(g, 0, ui.sel)) return cue('no'); cue('swap'); after(); },
        next: function () { if (!g || g.phase !== 'show') return; R().next(g); ui.hit = null; render(); run(); },
        close: function () { stop(); hush(); tour = -1; var m = document.getElementById('mmModal'); if (m) m.style.display = 'none'; },
        // for scripts/midnight-qa.cjs
        _g: function () { return g; }, _step: function (ms) { STEP = ms; }, _render: function () { render(); }
    };
    window.midnightOpen = function () { MM.open(); };
})();
