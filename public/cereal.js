/* V101.327 (+V101.335 🌐 online play — cereal-online.js draws the 🌐 tab, the room and the waiting screen; lock / ask / arrest / end go
   through the cerealAct callable when the game is online; V101.333 owner picks from mockup-cereal-ux/: 1A lean quota warning above 🔒, 2A+D reveal = every day's route drawn on the board
   in its own colour + 🔎 ทบทวนคดี, 12 sounds via cereal-sound.js; V101.329 tutorial hooks, V101.331 🤖 bot mode — owner pick C: two cards 🔪 vs 🤖 / 🕵️ vs 🤖 with 🥄 levels, no hand-off
   when the other seat is the bot, a ≥ 0.6 s "🤖 กำลังคิด…" beat then what the bot did in public, then ▸ ตาคุณ; V101.330 polish: Thai first with a small English line, labelled ask chips, ✕ / ↺ fixed) — 🥣 Cereal Killer, Phase 1: pass-and-play on ONE phone (Killer vs Detective, city map A/B). Owner's mockup picks
   2026-11-20: K-A (board first, kill / witness chips appear under the board after the 3rd step, notebook strip at the bottom),
   D-A (question cards as a chip rail, the public case log at the bottom), a tint hand-off screen between every turn, reveal
   with a day rail. Entry: the 🥣 button beside 💰 FIN on Schedule (cerealOpen). Rules come from cereal-rules.js and the board
   from cereal-maps.js — this file only draws and stores. State = localStorage cereal_v1_<userId> (the killer's path is in
   there too: pass-and-play is trust-based until Phase 2 moves the secret behind the cerealAct function). Reads and writes
   nothing in Firestore. Handlers hang off window.CK (one global, no inline-handler id shadowing); cerealOpen() is the entry. */
(function () {
    'use strict';
    var R = window.CerealRules, M = window.CEREAL_MAPS, B = window.CerealBot;   // B = cereal-bot.js (V101.331); the friend game works without it
    if (!R || !M) { console.warn('[cereal] cereal-rules.js / cereal-maps.js must load first'); return; }

    var ICON = { H: '🏠', P: '🌳', C: '☕', S: '🚇', T: '🚆', B: '🦴', '.': '' };
    var CLS = { H: 'h', P: 'p', C: 'c', S: 's', T: 't', B: 'b', '.': 'r' };
    var CAL = { 2: ' ≥1', 4: ' ≥3', 7: ' 6' };
    var QCARDS = [
        { q: 'dir', ic: '🧭', w: 'ทิศ', en: 'Which way from the witness?', th: 'อยู่ทิศไหนของพยาน?' },
        { q: 'row', ic: '↔', w: 'แถว', en: 'Same row as the witness?', th: 'อยู่แถวเดียวกับพยานไหม?' },
        { q: 'col', ic: '↕', w: 'คอลัมน์', en: 'Same column as the witness?', th: 'อยู่คอลัมน์เดียวกับพยานไหม?' },
        { q: 'building', ic: '🏠', w: 'อาคาร', en: 'In a building? (house · café · S)', th: 'อยู่ในอาคารไหม? (บ้าน · ☕ · S)' },
        { q: 'parity', ic: '2·1', w: 'คู่/คี่', en: 'Even or odd cell?', th: 'ช่องเลขคู่หรือคี่?' }
    ];
    var MAX_GAMES = 10;

    // ---- storage ----------------------------------------------------------------------------------------
    // index.html declares `let userId` at top level — a global binding, not a window property (see the const ≠ window trap)
    function key() { var u = ''; try { u = typeof userId !== 'undefined' ? userId : ''; } catch (_) { /* not declared */ } return 'cereal_v1_' + (u || 'anon'); }
    function load() { try { var d = JSON.parse(localStorage.getItem(key()) || 'null'); if (d && Array.isArray(d.games)) return d; } catch (_) { /* blocked storage */ } return { games: [] }; }
    function save() { if (g) g.upd = Date.now(); try { localStorage.setItem(key(), JSON.stringify(store)); } catch (_) { /* storage may be blocked (LIFF) */ } }

    var store = { games: [] }, g = null;                 // g = the open game; null = lobby
    var ui = { tab: 'local', side: 'A', names: { killer: '', detective: '' }, arrest: null, revealDay: null, rules: false, vs: 'friend', me: 'killer', level: { killer: 2, detective: 2 }, beat: null };
    var BOT_MS = 700;                                     // the bot's "thinking" beat (≥ 0.6 s so its move is seen to happen); CK.botDelay() sets it for QA

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function t(en, th) { return ' title="' + esc(en) + '" data-th-title="' + esc(th) + '" aria-label="' + esc(en) + '"'; }
    function L(th, en) { return th + '<small class="en">' + en + '</small>'; }   // V101.330: Thai first, a small English line under it
    function ansTh(q, a) { return q === 'dir' ? dirWord(a) : ({ yes: 'ใช่', no: 'ไม่ใช่', even: 'คู่', odd: 'คี่' }[a] || a); }
    function mapOf(game) { return R.buildMap(M, game.citySide, null); }
    function snd(k, d) { if (window.CKSound) CKSound.play(k, d); }   // V101.333
    var DAYC = ['#f97316', '#2563eb', '#7c3aed', '#16a34a', '#db2777', '#0891b2', '#ca8a04'];   // V101.333: one colour per day on the reveal
    /* V101.333 (owner pick 1A): true when a day without a victim today loses the game — the calendar minimum, or as many kills
       still owed as days left (today included). */
    function mustKill(game) { if (game.kills >= R.MAX_KILLS) return false; if (!R.calendarOk(game.day, game.kills)) return true; return R.MAX_KILLS - game.kills >= R.DAYS - game.day + 1; }
    function kpos(game) { var days = Object.keys(game.secret.path).map(Number).sort(function (a, b) { return b - a; }); return days.length ? game.secret.path[days[0]].slice(-1)[0] : game.secret.home; }
    function blockedFor(game) { return game.detectivePos != null ? [game.detectivePos] : []; }

    function newGame() {
        var solo = ui.vs === 'bot' && !!B, botSeat = ui.me === 'killer' ? 'detective' : 'killer', lv = ui.level[ui.me];
        if (solo) ui.names = ui.me === 'killer' ? { killer: 'คุณ', detective: '🤖 ' + '🥄'.repeat(lv) } : { killer: '🤖 ' + '🥄'.repeat(lv), detective: 'คุณ' };
        return { bot: solo ? { seat: botSeat, level: lv } : null, pubDays: [], id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), upd: Date.now(), citySide: ui.side,
            names: { killer: (ui.names.killer || '').trim() || 'Killer', detective: (ui.names.detective || '').trim() || 'Detective' },
            status: 'playing', day: 1, phase: 'killer', hand: 'killer',
            secret: { home: null, path: {}, kills: {} }, detectivePos: null, cereals: [], witness: null, arrestsLeft: R.ARRESTS, kills: 0,
            usedQuestions: [], skipUsed: false, log: [], draft: { path: [], kill: null, witness: null }, dd: { path: [], asked: null }, result: null };
    }

    // ---- shell ------------------------------------------------------------------------------------------
    function root() {
        var m = document.getElementById('cerealModal');
        if (!m) {
            m = document.createElement('div'); m.id = 'cerealModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Cereal Killer');
            m.innerHTML = '<div class="modal-content"><div id="ck-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) CK.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function open() {
        store = load(); g = null; ui.arrest = null; ui.rules = false;
        render();
        root().style.display = 'flex';
        if (window.CKTour && !CKTour.seen()) CKTour.open();   // V101.329: How to play, the first time on this device
    }
    function close() {
        if (g && g.status === 'playing' && !g.hand && !g.bot && !g.online) g.hand = g.phase;   // whoever reopens must tap through the hand-off first (not vs 🤖)
        if (botTimer) { clearTimeout(botTimer); botTimer = null; ui.beat = null; }   // a bot turn in flight runs again on reopen
        save();
        if (window.CKTour) CKTour.hideCoach();
        var m = document.getElementById('cerealModal'); if (m) m.style.display = 'none';
    }
    function render() {
        root();
        var body = document.getElementById('ck-body');
        var on = g && g.online && window.CKOnline ? CKOnline.screen() : null;   // V101.335: room / waiting screens
        var html = !g ? lobbyHtml() : on ? on : g.status === 'finished' ? revealHtml() : ui.beat ? beatHtml() : g.hand ? handHtml() : g.phase === 'killer' ? killerHtml() : detectiveHtml();
        body.innerHTML = html;
        var sc = document.querySelector('#cerealModal .modal-content'); if (sc) sc.scrollTop = 0;
        if (window.CKTour) CKTour.coach(coachKey());   // V101.329: first-turn hints follow the step the player is on
    }
    /* Which first-turn hint fits the screen just drawn (cereal-tutorial.js shows each once). null = nothing to coach. */
    function coachKey() {
        if (!g || g.status !== 'playing' || g.hand || ui.beat) return null;
        if (g.phase === 'killer') {
            if (g.secret.home == null) return 'home';
            if (g.draft.path.length < R.STEPS.killer + 1) return 'path';
            var lk = document.getElementById('ck-lock');
            return lk && !lk.disabled ? 'lock' : 'chips';
        }
        if (g.detectivePos == null) return 'cafe';
        var last = g.dd.path.length ? g.dd.path[g.dd.path.length - 1] : g.detectivePos;
        if (g.witness != null && !g.dd.asked && R.canQuestion(mapOf(g), last, g.witness)) return 'ask';
        if (g.dd.asked || (g.witness == null && g.dd.path.length > 1)) return 'arrest';
        return 'move';
    }
    function finish(winner, reason, extra) {
        g.status = 'finished'; g.phase = 'over'; g.hand = null; ui.arrest = null;
        g.result = { winner: winner, reason: reason, day: g.day, cell: extra && extra.cell != null ? extra.cell : null, kpos: kpos(g) };
        g.log.push({ day: g.day, type: 'end', text: winner === 'good' ? '🕵️ wins · ' + reason : '🔪 wins · ' + reason });
        ui.revealDay = 0;   // V101.333: the reveal opens on every day's route at once
        snd(winner === 'good' ? 'siren' : 'lose');
        save();
    }

    // ---- shared pieces ------------------------------------------------------------------------------------
    function pills(game) {
        return '<span class="ck-pill"' + t('victims', 'เหยื่อ') + '>🥣 ' + game.kills + '/' + R.MAX_KILLS + '</span>'
            + '<span class="ck-pill"' + t('arrests left', 'จับกุมเหลือ') + '>🛡️ ' + game.arrestsLeft + '</span>';
    }
    function topHtml(h3, extra) {
        var so = !window.CKSound || CKSound.on();
        return '<div class="ck-top"><h3>' + h3 + '</h3>' + (extra || '') + (window.CKSound ? '<button type="button" class="ck-snd" id="ck-snd" onclick="CK.sound()" aria-pressed="' + so + '"' + t(so ? 'Sound on' : 'Sound off', so ? 'เสียงเปิด' : 'เสียงปิด') + '>' + (so ? '🔊' : '🔇') + '</button>' : '') + '<button type="button" class="ck-x" onclick="CK.close()"' + t('Close', 'ปิด') + '>✕</button></div>';
    }
    function calHtml(game) {
        var h = '<div class="ck-cal"' + t('Victims required by the end of day 2 / 4 / 7', 'เหยื่อขั้นต่ำเมื่อจบวัน 2 / 4 / 7') + '>';
        for (var d = 1; d <= R.DAYS; d++) h += '<span class="' + (d < game.day ? 'done' : d === game.day ? 'now' : '') + '">D' + d + (d < game.day && game.secret.kills[d] ? ' 🥣' : (CAL[d] || '')) + '</span>';
        return h + '</div>';
    }
    /* extra[id] = { cls, st (step badge), tk (tokens), me (actor mark) }; tap = cells call CK.tap(id); enabled(id) gates the taps */
    function boardHtml(game, opt) {
        var m = mapOf(game), h = '<div class="ck-board" aria-label="City map, side ' + game.citySide + '">';
        m.ids.forEach(function (id) {
            var c = m.cells[id], e = (opt.extra && opt.extra[id]) || {}, on = !!opt.tap && (!opt.enabled || opt.enabled(id));
            h += '<button type="button" class="ck-cell ' + CLS[c.t] + (e.cls ? ' ' + e.cls : '') + '" data-id="' + id + '"' + (on ? ' onclick="CK.tap(' + id + ')"' : ' disabled') + ' aria-label="cell ' + id + '">'
                + '<span class="n">' + id + '</span><span class="ic">' + ICON[c.t] + '</span>'
                + (e.st ? '<span class="st">' + e.st + '</span>' : '') + (e.me ? '<span class="me">' + e.me + '</span>' : '') + (e.tk ? '<span class="tk">' + e.tk + '</span>' : '') + '</button>';
        });
        return h + '</div>';
    }
    function publicExtra(game) {
        var ex = {};
        var add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        game.cereals.forEach(function (id) { add(id, 'tk', '🥣'); });
        if (game.witness != null) { add(game.witness, 'tk', '👁️'); add(game.witness, 'cls', ' wit'); }
        return ex;
    }
    function logHtml(game, label) {
        var byDay = {}; game.log.forEach(function (e) { (byDay[e.day] = byDay[e.day] || []).push(e); });
        var h = '<div class="ck-nb"><div class="lbl">' + (label || 'บันทึกคดี · ทุกคนเห็น') + '</div>';
        Object.keys(byDay).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
            h += '<div class="r' + (d === game.day ? ' now' : '') + '"><span class="d">D' + d + '</span>' + byDay[d].map(function (e) { return esc(e.text); }).join(' · ') + '</div>';
        });
        return h + '</div>';
    }
    function qcard(q) { for (var i = 0; i < QCARDS.length; i++) if (QCARDS[i].q === q) return QCARDS[i]; return QCARDS[0]; }
    function dirWord(a) { return { N: 'N · เหนือ', S: 'S · ใต้', E: 'E · ตะวันออก', W: 'W · ตะวันตก' }[a] || a; }

    // ---- lobby ------------------------------------------------------------------------------------------
    function lobbyHtml() {
        var h = '<div class="ck lobby">' + topHtml('🥣 Cereal Killer', '<button type="button" class="ck-pill' + (ui.rules ? ' acc' : '') + '" onclick="CK.rules()"' + t('How to play', 'กติกา · วิธีเล่น') + '>?</button>');
        if (window.CKOnline) {   // V101.335 owner pick B: 📱 เครื่องนี้ | 🌐 ออนไลน์ (the badge = online games waiting for my move)
            var n = CKOnline.myTurnCount();
            h += '<div class="ck-tabs" role="tablist"><button type="button" role="tab" id="ck-tab-local" aria-selected="' + (ui.tab !== 'online') + '" class="' + (ui.tab !== 'online' ? 'on' : '') + '" onclick="CK.tab(\'local\')">📱 เครื่องนี้</button>'
                + '<button type="button" role="tab" id="ck-tab-online" aria-selected="' + (ui.tab === 'online') + '" class="' + (ui.tab === 'online' ? 'on' : '') + '" onclick="CK.tab(\'online\')">🌐 ออนไลน์' + (n ? ' <i class="ck-badge">' + n + '</i>' : '') + '</button></div>';
            if (ui.tab === 'online') return h + CKOnline.lobbyHtml() + '<div class="ck-foot">Cereal Killer · Julián Tunni · Primigenio / Super Noob Games</div></div>';
        }
        if (ui.rules) h += '<div class="ck-rules">🔪 moves exactly 3 steps a day, unseen, and drops 🥣 on a house it touched — 6 victims in 7 days (≥1 by day 2, ≥3 by day 4). A kill next to a park puts a 👁️ witness there.<br>🕵️ moves up to 3 (+1 through ☕), stands by 👁️ and asks one of 5 cards; the app answers truthfully. 🛡️ arrest = own or next cell, 4 tries. 🚇 S to S is one step for both.</div>';
        var solo = ui.vs === 'bot' && !!B;
        h += '<div class="ck-row"><span class="ck-mini">เล่นกับ</span><button type="button" id="ck-vs-friend" class="ck-chip' + (solo ? '' : ' on') + '" onclick="CK.vs(\'friend\')">👤 เพื่อน</button>'
            + '<button type="button" id="ck-vs-bot" class="ck-chip' + (solo ? ' on' : '') + '"' + (B ? ' onclick="CK.vs(\'bot\')"' : ' disabled') + t('Play against the bot on this phone', 'เล่นกับบอทในเครื่องนี้') + '>🤖 บอท</button></div>';
        if (solo) {
            var card = function (me, ic, th, en) {
                var on = ui.me === me, lv = ui.level[me], chips = '';
                for (var n = 1; n <= 3; n++) chips += '<button type="button" class="ck-chip ck-lv' + (lv === n ? ' on' : '') + '" data-lv="' + n + '" onclick="event.stopPropagation();CK.level(\'' + me + '\',' + n + ')"' + t(['', 'easy', 'medium', 'hard'][n], ['', 'ง่าย', 'กลาง', 'ยาก'][n]) + '>' + '🥄'.repeat(n) + '</button>';
                return '<div class="ck-solo' + (on ? ' on' : '') + '" id="ck-me-' + me + '" role="button" tabindex="0" onclick="CK.me(\'' + me + '\')"><span class="big">' + ic + ' vs 🤖</span><span class="tx">' + L(th, en) + '</span><span class="lv">' + chips + '</span></div>';
            };
            h += '<div class="ck-solos">' + card('killer', '🔪', 'คุณซ่อน · บอทไล่จับ', 'you hide, the bot hunts') + card('detective', '🕵️', 'คุณไล่จับ · บอทซ่อน', 'you hunt, the bot hides') + '</div>';
        }
        h += '<div class="ck-row"><span class="ck-mini">แผนที่</span>'
            + '<button type="button" id="ck-side-A" class="ck-chip' + (ui.side === 'A' ? ' on' : '') + '" onclick="CK.side(\'A\')"' + t('Side A — favours the killer', 'ด้าน A · ฆาตกรได้เปรียบ') + '>A <small>🥄🥄 ฆาตกร+</small></button>'
            + '<button type="button" id="ck-side-B" class="ck-chip' + (ui.side === 'B' ? ' on' : '') + '" onclick="CK.side(\'B\')"' + t('Side B — favours the detective', 'ด้าน B · นักสืบได้เปรียบ') + '>B <small>🥄 นักสืบ+</small></button></div>';
        if (!solo) h += '<div class="ck-row"><span class="ck-mini">ผู้เล่น</span>'
            + '<label class="ck-name"><span>🔪</span><input type="text" id="ck-n1" maxlength="20" placeholder="ฆาตกร" value="' + esc(ui.names.killer) + '" aria-label="Killer name" data-th-placeholder="ฆาตกร"></label>'
            + '<label class="ck-name"><span>🕵️</span><input type="text" id="ck-n2" maxlength="20" placeholder="นักสืบ" value="' + esc(ui.names.detective) + '" aria-label="Detective name" data-th-placeholder="นักสืบ"></label></div>';
        if (!solo) h += '<div class="ck-row" style="padding-left:68px"><span class="ck-pill"' + t('The rulebook: whoever just had breakfast is the killer', 'ใครเพิ่งทานอาหารเช้า = ฆาตกร') + '>🥣 ใครเพิ่งกินข้าวเช้า = 🔪</span></div>';
        h += solo ? '<button type="button" class="ck-primary" id="ck-start" onclick="CK.start()">' + L('▸ เริ่ม · ' + (ui.me === 'killer' ? '🔪' : '🕵️') + ' vs 🤖 ' + '🥄'.repeat(ui.level[ui.me]), 'Start vs bot') + '</button>'
            : '<button type="button" class="ck-primary" id="ck-start" onclick="CK.start()"' + t('Start day 1 — the phone goes to the killer first', 'เริ่มวันที่ 1 · มือถืออยู่กับฆาตกรก่อน') + '>' + L('▸ เริ่ม · 🔪 เล่นก่อน', 'Start · killer first') + '</button>';
        var games = store.games.filter(function (x) { return x.status === 'playing' || x.status === 'finished'; });
        if (games.length) {
            h += '<div class="ck-nb"><div class="lbl">เกมของฉัน · ในเครื่องนี้</div>';
            games.forEach(function (x) {
                var fin = x.status === 'finished', res = fin ? (x.result.winner === 'good' ? '🕵️ won · D' + x.result.day : '🔪 won · D' + x.result.day) : '';
                h += '<button type="button" class="ck-game" onclick="CK.resume(\'' + esc(x.id) + '\')"><span class="d">' + (fin ? '🏁' : 'D' + x.day) + '</span><span class="who">🔪 ' + esc(x.names.killer) + ' · 🕵️ ' + esc(x.names.detective) + '</span>'
                    + (fin ? '<span class="ck-pill">' + res + '</span>' : '<span class="ck-pill">🥣 ' + x.kills + '/6</span><span class="ck-pill">🛡️ ' + x.arrestsLeft + '</span>') + '<span class="go">' + (fin ? '↺' : '▸') + '</span></button>';
            });
            h += '</div>';
        }
        h += '<div class="ck-foot">Cereal Killer · Julián Tunni · Primigenio / Super Noob Games</div></div>';
        return h;
    }

    // ---- hand-off -----------------------------------------------------------------------------------------
    function handHtml() {
        var det = g.hand === 'detective', who = det ? '🕵️' : '🔪', name = det ? g.names.detective : g.names.killer;
        return '<div class="ck ' + (det ? 'detective' : 'killer') + '">' + topHtml(who + ' วันที่ ' + g.day)
            + '<div class="ck-hand"><div class="ck-note">' + (det ? '🔪 ล็อกวันที่ ' + g.day + ' แล้ว 🔒' : g.day === 1 ? 'เกมใหม่ · ฆาตกรเลือกบ้านลับก่อน' : '🕵️ จบวันที่ ' + (g.day - 1)) + '</div>'
            + '<div class="who" aria-hidden="true">' + who + '</div><h4>ส่งมือถือให้ ' + esc(name) + '</h4><p class="th">Pass the phone to ' + esc(name) + '</p>'
            + '<div class="ck-row" style="justify-content:center"><span class="ck-pill">วันที่ ' + g.day + ' / 7</span>' + pills(g) + (g.witness != null ? '<span class="ck-pill">👁️ ที่ ' + g.witness + '</span>' : '') + '</div>'
            + '<button type="button" class="ck-primary" id="ck-hand-go" onclick="CK.hand()"' + t('Tap when the phone is in your hands', 'แตะเมื่อถึงมือคุณ') + '>👆 ฉันคือ ' + who + ' ' + esc(name) + '</button></div></div>';
    }

    // ---- killer turn ---------------------------------------------------------------------------------------
    function killerHtml() {
        var m = mapOf(g), pos = kpos(g), blocked = blockedFor(g), path = g.draft.path;
        if (pos != null && !path.length) {
            if (R.cornered(m, pos, blocked)) { if (g.online) return CKOnline.cornered(); finish('good', 'cornered', { cell: pos }); return revealHtml(); }
            path = g.draft.path = [pos];
        }
        var ex = publicExtra(g), add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        if (g.detectivePos != null) add(g.detectivePos, 'tk', '🕵️');
        var full = path.length === R.STEPS.killer + 1, targets = [];
        if (pos == null) R.killerHomeOptions(m).forEach(function (id) { add(id, 'cls', ' pick'); });
        else {
            add(path[0], 'cls', ' ring'); add(path[0], 'me', '🔪');
            path.slice(1).forEach(function (id, i) { add(id, 'cls', ' on'); ex[id].st = String(i + 1); });
            if (!full) { targets = R.stepTargets(m, path[path.length - 1], { blocked: blocked }); targets.forEach(function (id) { add(id, 'cls', ' hint'); }); }
        }
        var enabled = pos == null ? function (id) { return m.cells[id].t === R.T.HOUSE; } : function (id) { return targets.indexOf(id) >= 0; };
        var h = '<div class="ck killer">' + topHtml('🔪 วันที่ ' + g.day, pills(g) + '<span class="ck-pill"' + t(g.skipUsed ? 'the quiet day is used' : 'one day without a victim is allowed', g.skipUsed ? 'ใช้วันไม่สังหารไปแล้ว' : 'ไม่สังหารได้ 1 วัน') + '>⏭ ' + (g.skipUsed ? 0 : 1) + '</span>') + calHtml(g);
        h += boardHtml(g, { extra: ex, tap: true, enabled: enabled });
        if (pos == null) h += '<div class="ck-row"><span class="ck-mini">🏠 บ้าน</span><span class="ck-note">แตะบ้าน 1 หลัง · จุดเริ่มลับของคุณ</span></div>';
        else {
            h += '<div class="ck-path"><span class="ck-mini">เส้นทาง</span><b id="ck-path">' + path.join(' › ') + (full ? '' : ' › _'.repeat(R.STEPS.killer + 1 - path.length)) + '</b>'
                + (path.length > 1 || g.day === 1 ? '<button type="button" class="ck-undo" onclick="CK.undo()"' + t('Undo one step', 'ถอยหนึ่งก้าว') + '>↺</button>' : '') + '</div>';
            if (full) {
                var opts = R.killOptions(m, path, g.cereals), kill = g.draft.kill;
                h += '<div class="ck-row rail" id="ck-kill"><span class="ck-mini">🥣 สังหาร</span>';
                path.filter(function (id, i) { return path.indexOf(id) === i && m.cells[id].t === R.T.HOUSE; }).forEach(function (id) {
                    var ok = opts.indexOf(id) >= 0;
                    h += '<button type="button" class="ck-chip' + (kill === id ? ' on' : '') + (ok ? '' : ' dim') + '"' + (ok ? ' onclick="CK.kill(' + id + ')"' : ' disabled' + t('already has cereal', 'มีซีเรียลแล้ว')) + '>🏠 ' + id + '</button>';
                });
                h += '<button type="button" class="ck-chip' + (kill === 'skip' ? ' on' : '') + '"' + (g.skipUsed ? ' disabled' : ' onclick="CK.kill(\'skip\')"') + t('No victim today — once per game', 'ไม่สังหารวันนี้ · ใช้ได้ 1 ครั้ง') + '>⏭ เว้น</button></div>';
                if (typeof kill === 'number') {
                    var parks = R.witnessOptions(m, kill);
                    h += '<div class="ck-row rail" id="ck-wit"><span class="ck-mini">👁️ พยาน</span>';
                    if (parks.length) parks.forEach(function (id) { h += '<button type="button" class="ck-chip' + (g.draft.witness === id ? ' on' : '') + '" onclick="CK.witness(' + id + ')"' + (id === path[path.length - 1] ? ' disabled' + t('you may not end your turn on the witness park', 'ห้ามจบเทิร์นบนสวนที่วางพยาน') : '') + '>🌳 ' + id + '</button>'; });
                    else h += '<span class="ck-note">ไม่มีสวนติดบ้าน ' + kill + ' · วันนี้ไม่มีพยาน</span>';
                    h += '</div>';
                }
            }
            if (mustKill(g) && typeof g.draft.kill !== 'number') h += '<div class="ck-warn" id="ck-warn">⚠️ วันนี้ต้องมีเหยื่อ · เว้น = แพ้</div>';   // V101.333 pick 1A
            var turn = { path: path, kill: typeof kill === 'number' ? kill : null, witness: g.draft.witness }, v = full && g.draft.kill != null ? R.validateKillerTurn(m, turn, { blocked: blocked, taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed }) : { ok: false };
            h += '<button type="button" class="ck-primary" id="ck-lock" onclick="CK.lock()"' + (v.ok ? '' : ' disabled') + t('Lock day ' + g.day + ' and pass the phone', 'ล็อกวันที่ ' + g.day + ' แล้วส่งมือถือ') + '>' + L('🔒 ล็อกวันที่ ' + g.day, 'Lock day ' + g.day) + '</button>';
        }
        h += '<div class="ck-nb"><div class="lbl">📓 สมุดลับ · เห็นคนเดียว<span style="margin-left:auto">🏠 บ้าน ' + (g.secret.home != null ? g.secret.home : '—') + '</span></div>';
        for (var d = 1; d <= g.day; d++) {
            var p = d < g.day ? g.secret.path[d] : path, k = g.secret.kills[d], w = d < g.day ? (g.log.filter(function (e) { return e.day === d && e.type === 'kill'; })[0] || {}).witness : g.draft.witness;
            h += '<div class="r' + (d === g.day ? ' now' : '') + '"><span class="d">D' + d + '</span><b>' + (p && p.length ? p.join(' › ') : '—') + '</b><span class="m">' + (d < g.day ? (k ? '🥣 ' + k : '⏭') + (w != null ? ' · 👁️ ' + w : '') : '') + '</span></div>';
        }
        return h + '</div></div>';
    }
    function tapKiller(id) {
        var m = mapOf(g), pos = kpos(g);
        if (pos == null) { if (m.cells[id].t !== R.T.HOUSE) return; g.secret.home = id; g.draft.path = [id]; }
        else {
            var path = g.draft.path; if (path.length >= R.STEPS.killer + 1) return;
            if (R.stepTargets(m, path[path.length - 1], { blocked: blockedFor(g) }).indexOf(id) < 0) return;
            path.push(id); g.draft.kill = null; g.draft.witness = null;
        }
        snd('step');
        save(); render();
    }
    function undo() {
        var path = g.draft.path;
        if (path.length > 1) path.pop();
        else if (g.day === 1 && !Object.keys(g.secret.path).length) { g.secret.home = null; g.draft.path = []; }
        g.draft.kill = null; g.draft.witness = null; save(); render();
    }
    function kill(id) { g.draft.kill = id; g.draft.witness = null; save(); render(); }
    function witness(id) { g.draft.witness = id; save(); render(); }
    function lock() {
        if (g.online) { CKOnline.lock(); return; }   // V101.335: the referee validates and stores it
        var m = mapOf(g), path = g.draft.path, kill = typeof g.draft.kill === 'number' ? g.draft.kill : null;
        var v = R.validateKillerTurn(m, { path: path, kill: kill, witness: g.draft.witness }, { blocked: blockedFor(g), taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed });
        if (!v.ok) return;
        g.secret.path[g.day] = path.slice();
        if (v.kill != null) { g.cereals.push(v.kill); g.secret.kills[g.day] = v.kill; }
        g.kills = v.kills; g.skipUsed = v.skipUsed; g.witness = v.witness;
        g.log.push({ day: g.day, type: 'kill', witness: v.witness, text: v.kill != null ? '🥣 ' + v.kill + (v.witness != null ? ' · 👁️ ' + v.witness : '') : '⏭ ไม่มีเหยื่อ' });
        pubPush(v);
        if (v.kill != null) snd('crunch'); if (v.witness != null) snd('gasp', 0.45);
        g.draft = { path: [], kill: null, witness: null };
        if (!R.calendarOk(g.day, g.kills)) finish('good', 'calendar');
        else { g.phase = 'detective'; g.hand = g.bot ? null : 'detective'; if (!g.bot) snd('whoosh', 1); }
        save(); render();
        botNext();
    }

    // ---- detective turn -------------------------------------------------------------------------------------
    function detectiveHtml() {
        var m = mapOf(g), ex = publicExtra(g), add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        var h = '<div class="ck detective">';
        if (g.detectivePos == null) {
            R.detectiveStartOptions(m).forEach(function (id) { add(id, 'cls', ' pick'); });
            h += topHtml('🕵️ วันที่ ' + g.day, pills(g)) + boardHtml(g, { extra: ex, tap: true, enabled: function (id) { return m.cells[id].t === R.T.CAFE; } })
                + '<div class="ck-row"><span class="ck-mini">☕ เริ่ม</span><span class="ck-note">แตะร้านกาแฟ · จุดเริ่มของคุณ</span></div>' + logHtml(g) + '</div>';
            return h;
        }
        var path = g.dd.path.length ? g.dd.path : (g.dd.path = [g.detectivePos]), last = path[path.length - 1];
        var v = R.validateDetectivePath(m, path), left = R.STEPS.detective + (v.bonus ? 1 : 0) - v.steps;
        var targets = ui.arrest === 'pick' ? [] : R.stepTargets(m, last).filter(function (id) { return R.validateDetectivePath(m, path.concat(id)).ok; });
        var arrestCells = ui.arrest === 'pick' ? m.ids.filter(function (id) { return R.arrestValid(m, last, id); }) : [];
        add(last, 'cls', ' ring'); add(last, 'me', '🕵️');
        path.slice(1).forEach(function (id, i) { add(id, 'cls', ' on'); ex[id].st = String(i + 1); });
        targets.forEach(function (id) { add(id, 'cls', ' hint'); });
        arrestCells.forEach(function (id) { add(id, 'cls', ' pick'); });
        if (typeof ui.arrest === 'number') add(ui.arrest, 'cls', ' ring');
        var enabled = function (id) { return ui.arrest === 'pick' ? arrestCells.indexOf(id) >= 0 : targets.indexOf(id) >= 0; };
        h += topHtml('🕵️ วันที่ ' + g.day, '<span class="ck-pill acc"' + t('steps left' + (v.bonus ? ' (☕ +1)' : ''), 'ก้าวที่เหลือ') + '>👣 ' + left + '</span>' + pills(g)) + boardHtml(g, { extra: ex, tap: true, enabled: enabled });
        if (path.length > 1) h += '<div class="ck-path"><span class="ck-mini">เส้นทาง</span><b>' + path.join(' › ') + '</b><button type="button" class="ck-undo" onclick="CK.undo()"' + t('Undo one step', 'ถอยหนึ่งก้าว') + '>↺</button></div>';
        // question cards
        var canAsk = g.witness != null && R.canQuestion(m, last, g.witness) && !g.dd.asked;
        h += '<div class="ck-row rail" id="ck-ask"><span class="ck-mini">❓ ถาม' + (g.witness != null ? ' 👁️' + g.witness : '') + '</span>';
        QCARDS.forEach(function (c) {
            var used = g.usedQuestions.indexOf(c.q) >= 0, past = used ? g.log.filter(function (e) { return e.type === 'ask' && e.q === c.q; })[0] : null;
            h += '<button type="button" class="ck-chip ck-q' + (used ? ' used' : '') + '" data-q="' + c.q + '"' + (used || !canAsk ? ' disabled' : ' onclick="CK.ask(\'' + c.q + '\')"') + t(c.th + ' · ' + c.en + (past ? ' — D' + past.day + ' → ' + past.ans : ''), c.th) + '><span class="qi">' + c.ic + '</span><span class="qw">' + c.w + '</span></button>';
        });
        h += '</div>';
        if (g.dd.asked) { var a = g.dd.asked; h += '<div class="ck-ans" id="ck-answer">' + qcard(a.q).ic + ' ' + esc(qcard(a.q).th) + ' <b>→ ' + esc(ansTh(a.q, a.ans)) + '</b>' + (a.two ? '<span class="ck-note" style="margin-left:auto">จริงทั้ง 2 ทิศ · ให้ทิศที่บอกใบ้น้อยกว่า</span>' : '') + '</div>'; }
        else if (g.witness == null) h += '<div class="ck-note">วันนี้ไม่มีพยาน · ไม่มีอะไรให้ถาม</div>';
        else if (!canAsk) h += '<div class="ck-note">ยืนบนหรือข้าง 👁️ ' + g.witness + ' แล้วถามได้ 1 ใบ</div>';
        // arrest
        if (typeof ui.arrest === 'number') h += '<div class="ck-confirm" id="ck-confirm">🛡️ จับที่ <b>' + ui.arrest + '</b>? <span style="font-weight:700;opacity:.8">ผิด = 🛡️ ' + g.arrestsLeft + ' → ' + (g.arrestsLeft - 1) + '</span><button type="button" class="yes" onclick="CK.arrest()">จับกุม</button><button type="button" class="no" onclick="CK.cancelArrest()"' + t('Cancel', 'ยกเลิก') + '>✕</button></div>';
        else if (ui.arrest === 'pick') h += '<div class="ck-confirm">🛡️ แตะช่องที่ยืนหรือช่องติดกัน<button type="button" class="no" style="margin-left:auto" onclick="CK.cancelArrest()"' + t('Cancel', 'ยกเลิก') + '>✕</button></div>';
        else h += '<div class="ck-row"><span class="ck-mini">จากนั้น</span><button type="button" class="ck-chip red" id="ck-arrest" onclick="CK.arrestMode()"' + t('Arrest: your cell or a neighbour · wrong costs one of ' + g.arrestsLeft, 'จับกุม · ช่องที่ยืนหรือช่องติดกัน · ผิดเสีย 1 ครั้ง') + '>🛡️ จับกุม</button></div>';
        h += '<button type="button" class="ck-primary" id="ck-end" onclick="CK.endTurn()"' + (ui.arrest ? ' disabled' : '') + t('End turn — the witness leaves the map', 'จบเทิร์น · พยานออกจากแผนที่') + '>' + L('▸ จบเทิร์น', 'End turn') + '</button>';
        return h + logHtml(g) + '</div>';
    }
    function tapDetective(id) {
        var m = mapOf(g);
        if (g.detectivePos == null) { if (m.cells[id].t !== R.T.CAFE) return; g.detectivePos = id; g.dd.path = [id]; snd('stepD'); save(); render(); return; }
        var path = g.dd.path, last = path[path.length - 1];
        if (ui.arrest === 'pick') { if (R.arrestValid(m, last, id)) { ui.arrest = id; render(); } return; }
        if (!R.validateDetectivePath(m, path.concat(id)).ok) return;
        path.push(id); snd('stepD'); save(); render();
    }
    function ask(q) {
        if (g.online) { if (!g.dd.asked) CKOnline.ask(q); return; }   // V101.335: only the referee knows where the killer is
        var m = mapOf(g), last = g.dd.path[g.dd.path.length - 1];
        if (g.witness == null || !R.canQuestion(m, last, g.witness) || g.dd.asked || g.usedQuestions.indexOf(q) >= 0) return;
        var ans = R.answer(m, q, kpos(g), g.witness), pick = ans.length > 1 ? R.leastInformative(m, g.witness, ans) : ans[0];
        g.usedQuestions.push(q); g.dd.asked = { q: q, ans: pick, two: ans.length > 1 };
        pubToday().asks.push({ q: q, ans: pick });
        g.log.push({ day: g.day, type: 'ask', q: q, ans: pick, text: '❓ ' + qcard(q).ic + ' → ' + ansTh(q, pick) });
        snd('ding'); save(); render();
    }
    function arrestMode() { ui.arrest = 'pick'; render(); }
    function cancelArrest() { ui.arrest = null; render(); }
    function arrest() {
        var cell = ui.arrest; if (typeof cell !== 'number') return;
        if (g.online) { CKOnline.end(cell); return; }
        ui.arrest = null;
        g.detectivePos = g.dd.path.length ? g.dd.path[g.dd.path.length - 1] : g.detectivePos;   // where the arrest is made from (the reveal shows it)
        if (cell === kpos(g)) { g.log.push({ day: g.day, type: 'arrest', cell: cell, text: '🛡️ ' + cell + ' ✔' }); finish('good', 'arrest', { cell: cell }); render(); return; }
        g.arrestsLeft -= 1; pubToday().misses.push(cell);
        g.log.push({ day: g.day, type: 'arrest', cell: cell, text: '🛡️ ' + cell + ' ✗ (เหลือ ' + g.arrestsLeft + ')' });
        snd('buzz');
        if (g.arrestsLeft <= 0) { finish('killer', 'arrests'); render(); return; }
        endTurn();
    }
    function endTurn() {
        if (ui.arrest) return;
        if (g.online) { CKOnline.end(null); return; }
        var path = g.dd.path.length ? g.dd.path : [g.detectivePos];
        g.detectivePos = path[path.length - 1]; g.witness = null; g.dd = { path: [], asked: null };
        if (g.day >= R.DAYS) finish('killer', 'survived');
        else { g.day += 1; g.phase = 'killer'; g.hand = g.bot ? null : 'killer'; if (!g.bot) snd('whoosh', 0.3); }
        save(); render();
        botNext();
    }

    // ---- 🤖 bot (V101.331) ------------------------------------------------------------------------------------
    /* What the bot detective may know: each day's blocked cell, cereal, witness, answers and missed arrests (cereal-bot.js). */
    function pubPush(v) { (g.pubDays = g.pubDays || []).push({ day: g.day, det: g.detectivePos, kill: v.kill, witness: v.witness, asks: [], misses: [] }); }
    function pubToday() { var d = g.pubDays && g.pubDays[g.pubDays.length - 1]; return d && d.day === g.day ? d : { asks: [], misses: [] }; }
    function pubOf() { return { day: g.day, detectivePos: g.detectivePos, arrestsLeft: g.arrestsLeft, usedQuestions: g.usedQuestions.slice(), skipUsed: g.skipUsed, kills: g.kills, cereals: g.cereals.slice(), witness: g.witness, days: g.pubDays || [] }; }
    var botTimer = null;
    /* If the seat to move now is the bot's, show the thinking beat and move after BOT_MS. */
    function botNext() {
        if (!g || !g.bot || !B || g.status !== 'playing' || g.phase !== g.bot.seat || botTimer) return;
        ui.beat = { think: true }; render(); snd('typing');
        var game = g;
        botTimer = setTimeout(function () { botTimer = null; if (g !== game || g.status !== 'playing') return; if (g.phase === 'killer') botKiller(); else botDetective(); }, BOT_MS);
    }
    function botKiller() {
        var m = mapOf(g), pos = kpos(g), lv = g.bot.level;
        if (pos != null && R.cornered(m, pos, blockedFor(g))) { ui.beat = null; finish('good', 'cornered', { cell: pos }); render(); return; }
        var kt = B.killerTurn(m, pubOf(), { pos: pos, home: g.secret.home }, lv, Math.random);
        if (!kt) { ui.beat = null; finish('good', 'calendar'); render(); return; }
        if (g.secret.home == null) g.secret.home = kt.home;
        var v = R.validateKillerTurn(m, { path: kt.path, kill: kt.kill, witness: kt.witness }, { blocked: blockedFor(g), taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed });
        if (!v.ok) { ui.beat = null; finish('good', 'calendar'); render(); return; }   // never expected: cereal-bot-check proves every turn legal
        g.secret.path[g.day] = kt.path.slice();
        if (v.kill != null) { g.cereals.push(v.kill); g.secret.kills[g.day] = v.kill; }
        g.kills = v.kills; g.skipUsed = v.skipUsed; g.witness = v.witness;
        g.log.push({ day: g.day, type: 'kill', witness: v.witness, text: v.kill != null ? '🥣 ' + v.kill + (v.witness != null ? ' · 👁️ ' + v.witness : '') : '⏭ ไม่มีเหยื่อ' });
        pubPush(v);
        if (v.kill != null) snd('crunch'); if (v.witness != null) snd('gasp', 0.45);
        if (!R.calendarOk(g.day, g.kills)) { ui.beat = null; finish('good', 'calendar'); save(); render(); return; }
        g.phase = 'detective'; g.hand = null;
        ui.beat = { text: v.kill != null ? '🤖 🔪 คืนนี้มีเหยื่อที่ 🏠 ' + v.kill + (v.witness != null ? ' · 👁️ พยานที่ ' + v.witness : ' · ไม่มีพยาน') : '🤖 🔪 คืนนี้ไม่มีเหยื่อ', next: '🕵️' };
        save(); render();
    }
    function botDetective() {
        var m = mapOf(g), lv = g.bot.level, mv = B.detectiveMove(m, pubOf(), lv, Math.random);
        if (g.detectivePos == null) g.detectivePos = mv.start;
        g.dd = { path: mv.path.slice(), asked: null };
        var at = mv.path[mv.path.length - 1], pub = pubOf(); pub.detectivePos = at;
        var parts = ['🤖 🕵️ ' + (mv.path.length > 1 ? 'เดิน ' + mv.path.join(' › ') : 'อยู่ที่ ' + at)];
        var q = B.detectiveAsk(m, pub, lv, Math.random, at);
        if (q) { ask(q); parts.push('ถาม ' + qcard(q).ic + ' → ' + ansTh(q, g.dd.asked.ans)); }
        var a = B.detectiveArrest(m, pubOf(), lv, Math.random, at), path = mv.path.slice();
        if (a != null) {
            parts.push('🛡️ จับที่ ' + a + (a === kpos(g) ? '' : ' ✗'));
            ui.arrest = a; arrest();
        } else endTurn();
        if (g.status === 'finished') { ui.beat = null; render(); return; }
        ui.beat = { text: parts.join(' · '), path: path, next: '🔪' };
        save(); render();
    }
    function beatHtml() {
        var seat = g.bot.seat, ex = publicExtra(g), add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        if (g.detectivePos != null) add(g.detectivePos, 'tk', '🕵️');
        if (seat === 'detective' && kpos(g) != null) { add(kpos(g), 'cls', ' ring'); add(kpos(g), 'me', '🔪'); }   // your own cell, on your own screen
        (ui.beat.path || []).slice(1).forEach(function (id, i) { add(id, 'cls', ' on'); ex[id].st = String(i + 1); });
        var h = '<div class="ck ' + seat + '">' + topHtml('🤖 ' + (seat === 'killer' ? '🔪' : '🕵️') + ' วันที่ ' + g.day, pills(g)) + boardHtml(g, { extra: ex, tap: false });
        if (ui.beat.think) h += '<div class="ck-ans ck-think" id="ck-beat">🤖 ' + (seat === 'killer' ? 'ฆาตกร' : 'นักสืบ') + 'กำลังคิด… <span class="ck-note">bot is thinking</span></div>';
        else h += '<div class="ck-ans" id="ck-beat">' + esc(ui.beat.text) + '</div><button type="button" class="ck-primary" id="ck-bot-ok" onclick="CK.botOk()">' + L('▸ ตาคุณ · ' + ui.beat.next + ' วันที่ ' + g.day, 'Your turn') + '</button>';
        return h + logHtml(g) + '</div>';
    }

    // ---- reveal --------------------------------------------------------------------------------------------
    function revealHtml() {
        var m = mapOf(g), r = g.result, days = Object.keys(g.secret.path).map(Number).sort(function (a, b) { return a - b; }), lastDay = days.length ? days[days.length - 1] : 1;
        var sel = ui.revealDay === 0 ? 0 : ui.revealDay && days.indexOf(ui.revealDay) >= 0 ? ui.revealDay : lastDay;   // 0 = every day (V101.333)
        var good = r.winner === 'good', title, sub;
        if (r.reason === 'arrest') { title = L('🕵️ ' + esc(g.names.detective) + ' จับ ' + esc(g.names.killer) + ' ได้ที่ ' + r.cell, esc(g.names.detective) + ' caught ' + esc(g.names.killer) + ' at ' + r.cell); sub = 'วันที่ ' + r.day + ' · จับครั้งที่ ' + (R.ARRESTS - g.arrestsLeft + 1) + ' จาก ' + R.ARRESTS; }
        else if (r.reason === 'cornered') { title = L('🕵️ ' + esc(g.names.killer) + ' จนมุมที่ ' + r.cell, esc(g.names.killer) + ' was cornered at ' + r.cell); sub = 'วันที่ ' + r.day + ' · ไม่มีทางเดิน 3 ก้าวเหลือแล้ว'; }
        else if (r.reason === 'calendar') { title = L('🕵️ ชนะ · เหยื่อแค่ ' + g.kills + ' ภายในวันที่ ' + r.day, 'detective wins on the calendar'); sub = 'ปฏิทินต้องการอย่างน้อย ' + R.CALENDAR_MIN[r.day]; }
        else if (r.reason === 'arrests') { title = L('🔪 ' + esc(g.names.killer) + ' ชนะ · 🛡️ หมด', esc(g.names.killer) + ' wins — no arrests left'); sub = 'วันที่ ' + r.day + ' · เหยื่อ ' + g.kills; }
        else { title = L('🔪 ' + esc(g.names.killer) + ' รอดครบ 7 วัน', esc(g.names.killer) + ' survived 7 days'); sub = 'เหยื่อ ' + g.kills + ' · 🛡️ เหลือ ' + g.arrestsLeft; }
        var ex = publicExtra(g), add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        if (g.secret.home != null) add(g.secret.home, 'cls', ' home');
        var p = sel ? (g.secret.path[sel] || []) : [];
        p.slice(1).forEach(function (id, i) { add(id, 'cls', ' on'); ex[id].st = String(i + 1); });
        if (p.length) add(p[p.length - 1], 'me', '🔪');
        if (!sel && r.kpos != null) add(r.kpos, 'me', '🔪');
        if ((!sel || sel === lastDay) && r.reason === 'arrest') add(r.cell, 'cls', ' caught');
        var arrests = g.log.filter(function (e) { return e.type === 'arrest'; }).map(function (e) { return { day: e.day, cell: e.cell != null ? e.cell : +((/🛡️ (\d+)/.exec(e.text) || [])[1]), ok: /✔/.test(e.text) }; });
        arrests.forEach(function (a) { if (!a.ok && (!sel || a.day === sel)) add(a.cell, 'cls', ' miss'); });
        if (g.detectivePos != null) add(g.detectivePos, 'tk', '🕵️');
        var h = '<div class="ck lobby">' + topHtml('🏁 จบเกม', pills(g))
            + '<div class="ck-win"><span class="big" aria-hidden="true">' + (good ? '🕵️' : '🔪') + '</span><div><p class="t">' + title + '</p><p class="s">' + sub + '</p></div></div>'
            + '<div class="ck-days" aria-label="Replay by day"><button type="button" class="all' + (sel ? '' : ' on') + '" onclick="CK.revealDay(0)">ทั้งหมด</button>';
        for (var d = 1; d <= R.DAYS; d++) h += '<button type="button" class="' + (d === sel ? 'on' : '') + '"' + (days.indexOf(d) >= 0 ? ' onclick="CK.revealDay(' + d + ')" style="--dc:' + DAYC[d - 1] + '"' : ' disabled') + '>D' + d + '</button>';
        // V101.333 pick 2D: the killer's route drawn on the board, one colour per day (all days, or the one picked)
        var rows = Math.max.apply(null, m.ids.map(function (id) { return m.cells[id].y; }));
        var shown = days.filter(function (d) { return !sel || d === sel; });
        var lines = shown.map(function (d, i) {
            var off = shown.length > 1 ? (i - (shown.length - 1) / 2) * 0.09 : 0;   // a day that walks back over another stays visible beside it
            return '<polyline class="ck-route" data-day="' + d + '" stroke="' + DAYC[d - 1] + '" points="' + g.secret.path[d].map(function (id) { return (m.cells[id].x - 0.5 + off) + ',' + (m.cells[id].y - 0.5 + off); }).join(' ') + '"/>';
        }).join('');
        h += '</div><div class="ck-boardwrap">' + boardHtml(g, { extra: ex, tap: false }) + '<svg class="ck-routes" viewBox="0 0 5 ' + rows + '" preserveAspectRatio="none" aria-hidden="true">' + lines + '</svg></div>';
        h += '<div class="ck-nb"><div class="lbl">📓 สมุดลับของฆาตกร · 🏠 บ้าน ' + g.secret.home + '</div>';
        days.forEach(function (d) {
            var asked = g.log.filter(function (e) { return e.day === d && e.type === 'ask'; }).map(function (e) { return qcard(e.q).ic + ' ' + ansTh(e.q, e.ans); }).join(' · ');
            var kl = g.log.filter(function (e) { return e.day === d && e.type === 'kill'; })[0] || {};
            h += '<div class="r' + (d === sel ? ' now' : '') + '"><span class="d"><i class="ck-dot" style="background:' + DAYC[d - 1] + '"></i>D' + d + '</span><b>' + g.secret.path[d].join(' › ') + '</b><span class="m">' + esc(kl.text || '') + (asked ? ' · ' + esc(asked) : '') + '</span></div>';
        });
        // V101.333 pick 2A: 🔎 ทบทวนคดี — every card asked and every arrest, with where the killer really stood that day
        var steps = g.log.filter(function (e) { return e.type === 'ask' || e.type === 'arrest'; });
        if (steps.length) {
            h += '</div><div class="ck-nb ck-review"><div class="lbl">🔎 ทบทวนคดี</div>';
            steps.forEach(function (e) {
                var kp = (g.secret.path[e.day] || []).slice(-1)[0], line;
                if (e.type === 'ask') line = '❓ ' + qcard(e.q).ic + ' ' + esc(qcard(e.q).w) + ' → ' + esc(ansTh(e.q, e.ans)) + '<span class="m">ฆาตกรอยู่ ' + kp + '</span>';
                else {
                    var c = e.cell != null ? e.cell : +((/🛡️ (\d+)/.exec(e.text) || [])[1]), hit = /✔/.test(e.text), dd = hit ? 0 : R.distance(m, c, kp, { canRide: true });
                    line = '<span class="' + (hit ? 'good' : 'bad') + '">🛡️ จับ ' + c + (hit ? ' ✔' : ' ✗') + '</span>' + (hit ? '' : '<span class="m">ฆาตกรอยู่ ' + kp + ' · ห่าง <b>' + dd + '</b> ช่อง</span>');
                }
                h += '<div class="r"><span class="d">D' + e.day + '</span>' + line + '</div>';
            });
        }
        h += '</div><div class="ck-row"><button type="button" class="ck-chip" onclick="CK.revealDay(1)"' + t('Replay from day 1', 'ดูซ้ำตั้งแต่วันแรก') + '>↺ ดูซ้ำ</button><button type="button" class="ck-chip" onclick="CK.lobby()">📋 เกมของฉัน</button></div>';
        h += '<button type="button" class="ck-primary" onclick="CK.rematch()"' + t('New game with the roles swapped', 'เกมใหม่ สลับบทบาท') + '>' + L('🆕 เกมใหม่ · สลับบทบาท', 'New game · swap roles') + '</button></div>';
        return h;
    }

    // ---- actions ---------------------------------------------------------------------------------------------
    function readNames() { var a = document.getElementById('ck-n1'), b = document.getElementById('ck-n2'); if (a) ui.names.killer = a.value; if (b) ui.names.detective = b.value; }
    window.CK = {
        tap: function (id) { if (!g || g.status !== 'playing' || g.hand) return; if (g.phase === 'killer') tapKiller(id); else tapDetective(id); },
        undo: function () { if (!g) return; if (g.phase === 'killer') undo(); else if (g.dd.path.length > 1) { g.dd.path.pop(); save(); render(); } },
        kill: kill, witness: witness, lock: lock,
        hand: function () { if (!g) return; g.hand = null; snd(g.phase === 'killer' ? 'heartbeat' : 'tick'); save(); render(); },
        sound: function () { if (window.CKSound) CKSound.toggle(); render(); },
        ask: ask, arrestMode: arrestMode, arrest: arrest, cancelArrest: cancelArrest, endTurn: endTurn,
        side: function (s) { readNames(); ui.side = s; render(); },
        rules: function () { readNames(); if (window.CKTour) { CKTour.open(); return; } ui.rules = !ui.rules; render(); },
        start: function () { readNames(); g = newGame(); if (g.bot) g.hand = null; store.games.unshift(g); store.games = store.games.slice(0, MAX_GAMES); ui.beat = null; if (g.bot && g.bot.seat === 'detective') snd('heartbeat'); save(); render(); botNext(); },
        vs: function (v) { readNames(); ui.vs = v; render(); },
        me: function (r) { ui.me = r; render(); },
        level: function (r, n) { ui.me = r; ui.level[r] = n; render(); },
        botOk: function () { ui.beat = null; if (g && g.status === 'playing') snd(g.phase === 'killer' ? 'heartbeat' : 'tick'); render(); },
        botDelay: function (ms) { BOT_MS = ms; },   // QA
        resume: function (id) { var x = store.games.filter(function (y) { return y.id === id; })[0]; if (!x) return; g = x; ui.arrest = null; ui.beat = null; if (g.status === 'playing') g.hand = g.bot ? null : g.phase; else ui.revealDay = 0; save(); render(); botNext(); },
        rematch: function () { if (g && g.online) { if (window.CKOnline) CKOnline.leave(); ui.tab = 'online'; g = null; render(); return; } if (g && g.bot) { ui.vs = 'bot'; ui.me = g.bot.seat; } else if (g) { ui.vs = 'friend'; ui.names = { killer: g.names.detective, detective: g.names.killer }; } g = null; ui.beat = null; render(); },
        lobby: function () { if (g && g.online) { if (window.CKOnline) CKOnline.leave(); ui.tab = 'online'; } g = null; render(); },
        tab: function (tb) { readNames(); ui.tab = tb; render(); },
        revealDay: function (d) { ui.revealDay = d; render(); },
        close: close,
        game: function () { return g; },   // read by the QA harness
        // V101.335: what cereal-online.js needs from this file (the same screens draw an online game)
        _: { get: function () { return g; }, set: function (x) { g = x; }, render: render, ui: ui, topHtml: topHtml, pills: pills, boardHtml: boardHtml, publicExtra: publicExtra, logHtml: logHtml, L: L, snd: snd, kposOf: kpos }
    };
    window.cerealOpen = open;
})();
