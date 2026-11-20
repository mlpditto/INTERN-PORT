/* V101.327 — 🥣 Cereal Killer, Phase 1: pass-and-play on ONE phone (Killer vs Detective, city map A/B). Owner's mockup picks
   2026-11-20: K-A (board first, kill / witness chips appear under the board after the 3rd step, notebook strip at the bottom),
   D-A (question cards as a chip rail, the public case log at the bottom), a tint hand-off screen between every turn, reveal
   with a day rail. Entry: the 🥣 button beside 💰 FIN on Schedule (cerealOpen). Rules come from cereal-rules.js and the board
   from cereal-maps.js — this file only draws and stores. State = localStorage cereal_v1_<userId> (the killer's path is in
   there too: pass-and-play is trust-based until Phase 2 moves the secret behind the cerealAct function). Reads and writes
   nothing in Firestore. Handlers hang off window.CK (one global, no inline-handler id shadowing); cerealOpen() is the entry. */
(function () {
    'use strict';
    var R = window.CerealRules, M = window.CEREAL_MAPS;
    if (!R || !M) { console.warn('[cereal] cereal-rules.js / cereal-maps.js must load first'); return; }

    var ICON = { H: '🏠', P: '🌳', C: '☕', S: '🚇', T: '🚆', B: '🦴', '.': '' };
    var CLS = { H: 'h', P: 'p', C: 'c', S: 's', T: 't', B: 'b', '.': 'r' };
    var CAL = { 2: ' ≥1', 4: ' ≥3', 7: ' 6' };
    var QCARDS = [
        { q: 'dir', ic: '🧭', en: 'Which way from the witness?', th: 'คุณอยู่ทิศใดเมื่อเทียบกับพยาน?' },
        { q: 'row', ic: '↔', en: 'Same row as the witness?', th: 'อยู่แถวเดียวกับพยานหรือไม่?' },
        { q: 'col', ic: '↕', en: 'Same column as the witness?', th: 'อยู่คอลัมน์เดียวกับพยานหรือไม่?' },
        { q: 'building', ic: '🏠', en: 'In a building? (house · café · S)', th: 'อยู่ในอาคารหรือไม่? (บ้าน / ร้านกาแฟ / S)' },
        { q: 'parity', ic: '2·1', en: 'Even or odd cell?', th: 'อยู่บนช่องเลขคู่หรือเลขคี่?' }
    ];
    var MAX_GAMES = 10;

    // ---- storage ----------------------------------------------------------------------------------------
    // index.html declares `let userId` at top level — a global binding, not a window property (see the const ≠ window trap)
    function key() { var u = ''; try { u = typeof userId !== 'undefined' ? userId : ''; } catch (_) { /* not declared */ } return 'cereal_v1_' + (u || 'anon'); }
    function load() { try { var d = JSON.parse(localStorage.getItem(key()) || 'null'); if (d && Array.isArray(d.games)) return d; } catch (_) { /* blocked storage */ } return { games: [] }; }
    function save() { if (g) g.upd = Date.now(); try { localStorage.setItem(key(), JSON.stringify(store)); } catch (_) { /* storage may be blocked (LIFF) */ } }

    var store = { games: [] }, g = null;                 // g = the open game; null = lobby
    var ui = { side: 'A', names: { killer: '', detective: '' }, arrest: null, revealDay: null, rules: false };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function t(en, th) { return ' title="' + esc(en) + '" data-th-title="' + esc(th) + '" aria-label="' + esc(en) + '"'; }
    function mapOf(game) { return R.buildMap(M, game.citySide, null); }
    function kpos(game) { var days = Object.keys(game.secret.path).map(Number).sort(function (a, b) { return b - a; }); return days.length ? game.secret.path[days[0]].slice(-1)[0] : game.secret.home; }
    function blockedFor(game) { return game.detectivePos != null ? [game.detectivePos] : []; }

    function newGame() {
        return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), upd: Date.now(), citySide: ui.side,
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
    }
    function close() {
        if (g && g.status === 'playing' && !g.hand) g.hand = g.phase;   // whoever reopens must tap through the hand-off first
        save();
        var m = document.getElementById('cerealModal'); if (m) m.style.display = 'none';
    }
    function render() {
        root();
        var body = document.getElementById('ck-body');
        var html = !g ? lobbyHtml() : g.status === 'finished' ? revealHtml() : g.hand ? handHtml() : g.phase === 'killer' ? killerHtml() : detectiveHtml();
        body.innerHTML = html;
        var sc = document.querySelector('#cerealModal .modal-content'); if (sc) sc.scrollTop = 0;
    }
    function finish(winner, reason, extra) {
        g.status = 'finished'; g.phase = 'over'; g.hand = null; ui.arrest = null;
        g.result = { winner: winner, reason: reason, day: g.day, cell: extra && extra.cell != null ? extra.cell : null, kpos: kpos(g) };
        g.log.push({ day: g.day, type: 'end', text: winner === 'good' ? '🕵️ wins · ' + reason : '🔪 wins · ' + reason });
        ui.revealDay = g.day;
        save();
    }

    // ---- shared pieces ------------------------------------------------------------------------------------
    function pills(game) {
        return '<span class="ck-pill"' + t('victims', 'เหยื่อ') + '>🥣 ' + game.kills + '/' + R.MAX_KILLS + '</span>'
            + '<span class="ck-pill"' + t('arrests left', 'จับกุมเหลือ') + '>🛡️ ' + game.arrestsLeft + '</span>';
    }
    function topHtml(h3, extra) { return '<div class="ck-top"><h3>' + h3 + '</h3>' + (extra || '') + '<button type="button" class="ck-x" onclick="CK.close()"' + t('Close', 'ปิด') + '>✕</button></div>'; }
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
        var h = '<div class="ck-nb"><div class="lbl">' + (label || 'Case log · public') + '</div>';
        Object.keys(byDay).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
            h += '<div class="r' + (d === game.day ? ' now' : '') + '"><span class="d">D' + d + '</span>' + byDay[d].map(function (e) { return esc(e.text); }).join(' · ') + '</div>';
        });
        return h + '</div>';
    }
    function qcard(q) { for (var i = 0; i < QCARDS.length; i++) if (QCARDS[i].q === q) return QCARDS[i]; return QCARDS[0]; }
    function dirWord(a) { return { N: 'N · north', S: 'S · south', E: 'E · east', W: 'W · west' }[a] || a; }

    // ---- lobby ------------------------------------------------------------------------------------------
    function lobbyHtml() {
        var h = '<div class="ck lobby">' + topHtml('🥣 Cereal Killer', '<button type="button" class="ck-pill' + (ui.rules ? ' acc' : '') + '" onclick="CK.rules()"' + t('How to play', 'กติกา · วิธีเล่น') + '>?</button>');
        if (ui.rules) h += '<div class="ck-rules">🔪 moves exactly 3 steps a day, unseen, and drops 🥣 on a house it touched — 6 victims in 7 days (≥1 by day 2, ≥3 by day 4). A kill next to a park puts a 👁️ witness there.<br>🕵️ moves up to 3 (+1 through ☕), stands by 👁️ and asks one of 5 cards; the app answers truthfully. 🛡️ arrest = own or next cell, 4 tries. 🚇 S to S is one step for both.</div>';
        h += '<div class="ck-row"><span class="ck-mini">Vs</span><span class="ck-chip on">👤 friend</span><button type="button" class="ck-chip" disabled' + t('Play against a bot — coming in the next release', 'เล่นกับบอท · เร็ว ๆ นี้') + '>🤖 bot</button></div>';
        h += '<div class="ck-row"><span class="ck-mini">Map</span>'
            + '<button type="button" id="ck-side-A" class="ck-chip' + (ui.side === 'A' ? ' on' : '') + '" onclick="CK.side(\'A\')"' + t('Side A — favours the killer', 'ด้าน A · ฆาตกรได้เปรียบ') + '>A <small>🥄🥄 killer+</small></button>'
            + '<button type="button" id="ck-side-B" class="ck-chip' + (ui.side === 'B' ? ' on' : '') + '" onclick="CK.side(\'B\')"' + t('Side B — favours the detective', 'ด้าน B · นักสืบได้เปรียบ') + '>B <small>🥄 detective+</small></button></div>';
        h += '<div class="ck-row"><span class="ck-mini">Players</span>'
            + '<label class="ck-name"><span>🔪</span><input type="text" id="ck-n1" maxlength="20" placeholder="Killer" value="' + esc(ui.names.killer) + '" aria-label="Killer name" data-th-placeholder="ฆาตกร"></label>'
            + '<label class="ck-name"><span>🕵️</span><input type="text" id="ck-n2" maxlength="20" placeholder="Detective" value="' + esc(ui.names.detective) + '" aria-label="Detective name" data-th-placeholder="นักสืบ"></label></div>';
        h += '<div class="ck-row" style="padding-left:68px"><span class="ck-pill"' + t('The rulebook: whoever just had breakfast is the killer', 'ใครเพิ่งทานอาหารเช้า = ฆาตกร') + '>🥣 who just had breakfast = 🔪</span></div>';
        h += '<button type="button" class="ck-primary" id="ck-start" onclick="CK.start()"' + t('Start day 1 — the phone goes to the killer first', 'เริ่มวันที่ 1 · มือถืออยู่กับฆาตกรก่อน') + '>▸ Start · 🔪 goes first</button>';
        var games = store.games.filter(function (x) { return x.status === 'playing' || x.status === 'finished'; });
        if (games.length) {
            h += '<div class="ck-nb"><div class="lbl">My games · on this phone</div>';
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
        return '<div class="ck ' + (det ? 'detective' : 'killer') + '">' + topHtml(who + ' Day ' + g.day)
            + '<div class="ck-hand"><div class="ck-note">' + (det ? '🔪 day ' + g.day + ' locked 🔒 · nothing of that turn is on this screen' : g.day === 1 ? 'new game · the killer picks a secret home first' : '🕵️ day ' + (g.day - 1) + ' done') + '</div>'
            + '<div class="who" aria-hidden="true">' + who + '</div><h4>Pass the phone to ' + esc(name) + '</h4><p class="th">' + (det ? 'ส่งมือถือให้นักสืบ' : 'ส่งมือถือให้ฆาตกร') + '</p>'
            + '<div class="ck-row" style="justify-content:center"><span class="ck-pill">Day ' + g.day + ' / 7</span>' + pills(g) + (g.witness != null ? '<span class="ck-pill">👁️ at ' + g.witness + '</span>' : '') + '</div>'
            + '<button type="button" class="ck-primary" id="ck-hand-go" onclick="CK.hand()"' + t('Tap when the phone is in your hands', 'แตะเมื่อถึงมือคุณ') + '>👆 I\'m ' + who + ' ' + esc(name) + '</button>'
            + '<div class="ck-note">the next screen opens only after this tap</div></div></div>';
    }

    // ---- killer turn ---------------------------------------------------------------------------------------
    function killerHtml() {
        var m = mapOf(g), pos = kpos(g), blocked = blockedFor(g), path = g.draft.path;
        if (pos != null && !path.length) {
            if (R.cornered(m, pos, blocked)) { finish('good', 'cornered', { cell: pos }); return revealHtml(); }
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
        var h = '<div class="ck killer">' + topHtml('🔪 Day ' + g.day, pills(g) + '<span class="ck-pill"' + t(g.skipUsed ? 'the quiet day is used' : 'one day without a victim is allowed', g.skipUsed ? 'ใช้วันไม่สังหารไปแล้ว' : 'ไม่สังหารได้ 1 วัน') + '>⏭ ' + (g.skipUsed ? 0 : 1) + '</span>') + calHtml(g);
        h += boardHtml(g, { extra: ex, tap: true, enabled: enabled });
        if (pos == null) h += '<div class="ck-row"><span class="ck-mini">🏠 Home</span><span class="ck-note">tap a house — your secret start</span></div>';
        else {
            h += '<div class="ck-path"><span class="ck-mini">Path</span><b id="ck-path">' + path.join(' › ') + (full ? '' : ' › _'.repeat(R.STEPS.killer + 1 - path.length)) + '</b>'
                + (path.length > 1 || g.day === 1 ? '<button type="button" class="ck-undo" onclick="CK.undo()"' + t('Undo one step', 'ถอยหนึ่งก้าว') + '>↺</button>' : '') + '</div>';
            if (full) {
                var opts = R.killOptions(m, path, g.cereals), kill = g.draft.kill;
                h += '<div class="ck-row" id="ck-kill"><span class="ck-mini">🥣 Kill at</span>';
                path.filter(function (id, i) { return path.indexOf(id) === i && m.cells[id].t === R.T.HOUSE; }).forEach(function (id) {
                    var ok = opts.indexOf(id) >= 0;
                    h += '<button type="button" class="ck-chip' + (kill === id ? ' on' : '') + (ok ? '' : ' dim') + '"' + (ok ? ' onclick="CK.kill(' + id + ')"' : ' disabled' + t('already has cereal', 'มีซีเรียลแล้ว')) + '>🏠 ' + id + '</button>';
                });
                h += '<button type="button" class="ck-chip' + (kill === 'skip' ? ' on' : '') + '"' + (g.skipUsed ? ' disabled' : ' onclick="CK.kill(\'skip\')"') + t('No victim today — once per game', 'ไม่สังหารวันนี้ · ใช้ได้ 1 ครั้ง') + '>⏭ skip</button></div>';
                if (typeof kill === 'number') {
                    var parks = R.witnessOptions(m, kill);
                    h += '<div class="ck-row" id="ck-wit"><span class="ck-mini">👁️ Witness</span>';
                    if (parks.length) parks.forEach(function (id) { h += '<button type="button" class="ck-chip' + (g.draft.witness === id ? ' on' : '') + '" onclick="CK.witness(' + id + ')"' + (id === path[path.length - 1] ? ' disabled' + t('you may not end your turn on the witness park', 'ห้ามจบเทิร์นบนสวนที่วางพยาน') : '') + '>🌳 ' + id + '</button>'; });
                    else h += '<span class="ck-note">no park next to ' + kill + ' — no witness today</span>';
                    h += '</div>';
                }
            }
            var turn = { path: path, kill: typeof kill === 'number' ? kill : null, witness: g.draft.witness }, v = full && g.draft.kill != null ? R.validateKillerTurn(m, turn, { blocked: blocked, taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed }) : { ok: false };
            h += '<button type="button" class="ck-primary" id="ck-lock" onclick="CK.lock()"' + (v.ok ? '' : ' disabled') + t('Lock day ' + g.day + ' and pass the phone', 'ล็อกวันที่ ' + g.day + ' แล้วส่งมือถือ') + '>🔒 Lock day ' + g.day + '</button>';
        }
        h += '<div class="ck-nb"><div class="lbl">📓 notebook · only you see this<span style="margin-left:auto">🏠 home ' + (g.secret.home != null ? g.secret.home : '—') + '</span></div>';
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
        var m = mapOf(g), path = g.draft.path, kill = typeof g.draft.kill === 'number' ? g.draft.kill : null;
        var v = R.validateKillerTurn(m, { path: path, kill: kill, witness: g.draft.witness }, { blocked: blockedFor(g), taken: g.cereals, kills: g.kills, skipUsed: g.skipUsed });
        if (!v.ok) return;
        g.secret.path[g.day] = path.slice();
        if (v.kill != null) { g.cereals.push(v.kill); g.secret.kills[g.day] = v.kill; }
        g.kills = v.kills; g.skipUsed = v.skipUsed; g.witness = v.witness;
        g.log.push({ day: g.day, type: 'kill', witness: v.witness, text: v.kill != null ? '🥣 ' + v.kill + (v.witness != null ? ' · 👁️ ' + v.witness : '') : '⏭ no victim' });
        g.draft = { path: [], kill: null, witness: null };
        if (!R.calendarOk(g.day, g.kills)) finish('good', 'calendar');
        else { g.phase = 'detective'; g.hand = 'detective'; }
        save(); render();
    }

    // ---- detective turn -------------------------------------------------------------------------------------
    function detectiveHtml() {
        var m = mapOf(g), ex = publicExtra(g), add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        var h = '<div class="ck detective">';
        if (g.detectivePos == null) {
            R.detectiveStartOptions(m).forEach(function (id) { add(id, 'cls', ' pick'); });
            h += topHtml('🕵️ Day ' + g.day, pills(g)) + boardHtml(g, { extra: ex, tap: true, enabled: function (id) { return m.cells[id].t === R.T.CAFE; } })
                + '<div class="ck-row"><span class="ck-mini">☕ Start</span><span class="ck-note">tap a café — that is where you begin</span></div>' + logHtml(g) + '</div>';
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
        h += topHtml('🕵️ Day ' + g.day, '<span class="ck-pill acc"' + t('steps left' + (v.bonus ? ' (☕ +1)' : ''), 'ก้าวที่เหลือ') + '>👣 ' + left + '</span>' + pills(g)) + boardHtml(g, { extra: ex, tap: true, enabled: enabled });
        if (path.length > 1) h += '<div class="ck-path"><span class="ck-mini">Path</span><b>' + path.join(' › ') + '</b><button type="button" class="ck-undo" onclick="CK.undo()"' + t('Undo one step', 'ถอยหนึ่งก้าว') + '>↺</button></div>';
        // question cards
        var canAsk = g.witness != null && R.canQuestion(m, last, g.witness) && !g.dd.asked;
        h += '<div class="ck-row" id="ck-ask"><span class="ck-mini">❓ Ask' + (g.witness != null ? ' 👁️' + g.witness : '') + '</span>';
        QCARDS.forEach(function (c) {
            var used = g.usedQuestions.indexOf(c.q) >= 0, past = used ? g.log.filter(function (e) { return e.type === 'ask' && e.q === c.q; })[0] : null;
            h += '<button type="button" class="ck-chip' + (used ? ' used' : '') + '" data-q="' + c.q + '"' + (used || !canAsk ? ' disabled' : ' onclick="CK.ask(\'' + c.q + '\')"') + t(c.en + (past ? ' — D' + past.day + ' → ' + past.ans : ''), c.th) + '>' + c.ic + '</button>';
        });
        h += '</div>';
        if (g.dd.asked) { var a = g.dd.asked; h += '<div class="ck-ans" id="ck-answer">' + qcard(a.q).ic + ' ' + esc(qcard(a.q).en) + ' <b>→ ' + esc(a.q === 'dir' ? dirWord(a.ans) : a.ans) + '</b>' + (a.two ? '<span class="ck-note" style="margin-left:auto">two directions were true · the less telling one is given</span>' : '') + '</div>'; }
        else if (g.witness == null) h += '<div class="ck-note">no witness today — nothing to ask</div>';
        else if (!canAsk) h += '<div class="ck-note">stand on or next to 👁️ ' + g.witness + ' to ask (one card per witness)</div>';
        // arrest
        if (typeof ui.arrest === 'number') h += '<div class="ck-confirm" id="ck-confirm">🛡️ Arrest at <b>' + ui.arrest + '</b>? <span style="font-weight:700;opacity:.8">wrong = 🛡️ ' + g.arrestsLeft + ' → ' + (g.arrestsLeft - 1) + '</span><button type="button" class="yes" onclick="CK.arrest()">Arrest</button><button type="button" class="no" onclick="CK.cancelArrest()"' + t('Cancel', 'ยกเลิก') + '>✕</button></div>';
        else if (ui.arrest === 'pick') h += '<div class="ck-confirm">🛡️ tap your cell or a neighbour<button type="button" class="no" style="margin-left:auto" onclick="CK.cancelArrest()"' + t('Cancel', 'ยกเลิก') + '>✕</button></div>';
        else h += '<div class="ck-row"><span class="ck-mini">Then</span><button type="button" class="ck-chip red" id="ck-arrest" onclick="CK.arrestMode()"' + t('Arrest: your cell or a neighbour · wrong costs one of ' + g.arrestsLeft, 'จับกุม · ช่องที่ยืนหรือช่องติดกัน · ผิดเสีย 1 ครั้ง') + '>🛡️ arrest</button></div>';
        h += '<button type="button" class="ck-primary" id="ck-end" onclick="CK.endTurn()"' + (ui.arrest ? ' disabled' : '') + t('End turn — the witness leaves the map', 'จบเทิร์น · พยานออกจากแผนที่') + '>▸ End turn</button>';
        return h + logHtml(g) + '</div>';
    }
    function tapDetective(id) {
        var m = mapOf(g);
        if (g.detectivePos == null) { if (m.cells[id].t !== R.T.CAFE) return; g.detectivePos = id; g.dd.path = [id]; save(); render(); return; }
        var path = g.dd.path, last = path[path.length - 1];
        if (ui.arrest === 'pick') { if (R.arrestValid(m, last, id)) { ui.arrest = id; render(); } return; }
        if (!R.validateDetectivePath(m, path.concat(id)).ok) return;
        path.push(id); save(); render();
    }
    function ask(q) {
        var m = mapOf(g), last = g.dd.path[g.dd.path.length - 1];
        if (g.witness == null || !R.canQuestion(m, last, g.witness) || g.dd.asked || g.usedQuestions.indexOf(q) >= 0) return;
        var ans = R.answer(m, q, kpos(g), g.witness), pick = ans.length > 1 ? R.leastInformative(m, g.witness, ans) : ans[0];
        g.usedQuestions.push(q); g.dd.asked = { q: q, ans: pick, two: ans.length > 1 };
        g.log.push({ day: g.day, type: 'ask', q: q, ans: pick, text: '❓ ' + qcard(q).ic + ' → ' + pick });
        save(); render();
    }
    function arrestMode() { ui.arrest = 'pick'; render(); }
    function cancelArrest() { ui.arrest = null; render(); }
    function arrest() {
        var cell = ui.arrest; if (typeof cell !== 'number') return;
        ui.arrest = null;
        g.detectivePos = g.dd.path.length ? g.dd.path[g.dd.path.length - 1] : g.detectivePos;   // where the arrest is made from (the reveal shows it)
        if (cell === kpos(g)) { g.log.push({ day: g.day, type: 'arrest', text: '🛡️ ' + cell + ' ✔' }); finish('good', 'arrest', { cell: cell }); render(); return; }
        g.arrestsLeft -= 1;
        g.log.push({ day: g.day, type: 'arrest', text: '🛡️ ' + cell + ' ✗ (' + g.arrestsLeft + ' left)' });
        if (g.arrestsLeft <= 0) { finish('killer', 'arrests'); render(); return; }
        endTurn();
    }
    function endTurn() {
        if (ui.arrest) return;
        var path = g.dd.path.length ? g.dd.path : [g.detectivePos];
        g.detectivePos = path[path.length - 1]; g.witness = null; g.dd = { path: [], asked: null };
        if (g.day >= R.DAYS) finish('killer', 'survived');
        else { g.day += 1; g.phase = 'killer'; g.hand = 'killer'; }
        save(); render();
    }

    // ---- reveal --------------------------------------------------------------------------------------------
    function revealHtml() {
        var m = mapOf(g), r = g.result, days = Object.keys(g.secret.path).map(Number).sort(function (a, b) { return a - b; }), lastDay = days.length ? days[days.length - 1] : 1;
        var sel = ui.revealDay && days.indexOf(ui.revealDay) >= 0 ? ui.revealDay : lastDay;
        var good = r.winner === 'good', title, sub;
        if (r.reason === 'arrest') { title = '🕵️ ' + esc(g.names.detective) + ' caught ' + esc(g.names.killer) + ' at ' + r.cell; sub = 'day ' + r.day + ' · arrest ' + (R.ARRESTS - g.arrestsLeft + 1) + ' of ' + R.ARRESTS; }
        else if (r.reason === 'cornered') { title = '🕵️ ' + esc(g.names.killer) + ' was cornered at ' + r.cell; sub = 'day ' + r.day + ' · no legal 3-step path left'; }
        else if (r.reason === 'calendar') { title = '🕵️ wins — only ' + g.kills + ' victim' + (g.kills === 1 ? '' : 's') + ' by day ' + r.day; sub = 'the calendar wanted ' + R.CALENDAR_MIN[r.day]; }
        else if (r.reason === 'arrests') { title = '🔪 ' + esc(g.names.killer) + ' wins — no arrests left'; sub = 'day ' + r.day + ' · ' + g.kills + ' victims'; }
        else { title = '🔪 ' + esc(g.names.killer) + ' survived 7 days'; sub = g.kills + ' victims · ' + g.arrestsLeft + ' arrest' + (g.arrestsLeft === 1 ? '' : 's') + ' unused'; }
        var ex = publicExtra(g), add = function (id, k, v) { ex[id] = ex[id] || {}; ex[id][k] = (ex[id][k] || '') + v; };
        if (g.secret.home != null) add(g.secret.home, 'cls', ' home');
        var p = g.secret.path[sel] || [];
        p.slice(1).forEach(function (id, i) { add(id, 'cls', ' on'); ex[id].st = String(i + 1); });
        if (p.length) add(p[p.length - 1], 'me', '🔪');
        if (sel === lastDay && r.reason === 'arrest') add(r.cell, 'cls', ' caught');
        if (g.detectivePos != null) add(g.detectivePos, 'tk', '🕵️');
        var h = '<div class="ck lobby">' + topHtml('🏁 Game over', '<span class="ck-pill">Day ' + r.day + ' / 7</span>' + pills(g))
            + '<div class="ck-win"><span class="big" aria-hidden="true">' + (good ? '🕵️' : '🔪') + '</span><div><p class="t">' + title + '</p><p class="s">' + sub + '</p></div></div>'
            + '<div class="ck-days" aria-label="Replay by day">';
        for (var d = 1; d <= R.DAYS; d++) h += '<button type="button" class="' + (d === sel ? 'on' : '') + '"' + (days.indexOf(d) >= 0 ? ' onclick="CK.revealDay(' + d + ')"' : ' disabled') + '>D' + d + '</button>';
        h += '</div>' + boardHtml(g, { extra: ex, tap: false });
        h += '<div class="ck-nb"><div class="lbl">📓 the killer\'s notebook · 🏠 home ' + g.secret.home + '</div>';
        days.forEach(function (d) {
            var asked = g.log.filter(function (e) { return e.day === d && e.type === 'ask'; }).map(function (e) { return qcard(e.q).ic + ' ' + e.ans; }).join(' · ');
            var kl = g.log.filter(function (e) { return e.day === d && e.type === 'kill'; })[0] || {};
            h += '<div class="r' + (d === sel ? ' now' : '') + '"><span class="d">D' + d + '</span><b>' + g.secret.path[d].join(' › ') + '</b><span class="m">' + esc(kl.text || '') + (asked ? ' · ' + esc(asked) : '') + '</span></div>';
        });
        h += '</div><div class="ck-row"><button type="button" class="ck-chip" onclick="CK.revealDay(1)"' + t('Replay from day 1', 'ดูซ้ำตั้งแต่วันแรก') + '>↺ Replay</button><button type="button" class="ck-chip" onclick="CK.lobby()">📋 My games</button></div>';
        h += '<button type="button" class="ck-primary" onclick="CK.rematch()"' + t('New game with the roles swapped', 'เกมใหม่ สลับบทบาท') + '>🆕 New game · swap roles</button></div>';
        return h;
    }

    // ---- actions ---------------------------------------------------------------------------------------------
    function readNames() { var a = document.getElementById('ck-n1'), b = document.getElementById('ck-n2'); if (a) ui.names.killer = a.value; if (b) ui.names.detective = b.value; }
    window.CK = {
        tap: function (id) { if (!g || g.status !== 'playing' || g.hand) return; if (g.phase === 'killer') tapKiller(id); else tapDetective(id); },
        undo: function () { if (!g) return; if (g.phase === 'killer') undo(); else if (g.dd.path.length > 1) { g.dd.path.pop(); save(); render(); } },
        kill: kill, witness: witness, lock: lock,
        hand: function () { if (!g) return; g.hand = null; save(); render(); },
        ask: ask, arrestMode: arrestMode, arrest: arrest, cancelArrest: cancelArrest, endTurn: endTurn,
        side: function (s) { readNames(); ui.side = s; render(); },
        rules: function () { readNames(); ui.rules = !ui.rules; render(); },
        start: function () { readNames(); g = newGame(); store.games.unshift(g); store.games = store.games.slice(0, MAX_GAMES); save(); render(); },
        resume: function (id) { var x = store.games.filter(function (y) { return y.id === id; })[0]; if (!x) return; g = x; ui.arrest = null; if (g.status === 'playing') g.hand = g.phase; else ui.revealDay = g.result.day; save(); render(); },
        rematch: function () { if (g) ui.names = { killer: g.names.detective, detective: g.names.killer }; g = null; render(); },
        lobby: function () { g = null; render(); },
        revealDay: function (d) { ui.revealDay = d; render(); },
        close: close,
        game: function () { return g; }   // read by the QA harness
    };
    window.cerealOpen = open;
})();
