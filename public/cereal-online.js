/* V101.335 — 🥣 Cereal Killer Phase 2 PR 2: play ONLINE, two phones, turns at any time (owner pick B + C, mockup-cereal-online/).
   The lobby gets two tabs — 📱 เครื่องนี้ (pass-and-play + 🤖, as before) | 🌐 ออนไลน์ (my online games first, then ＋ สร้างห้อง /
   🔑 มีรหัสห้อง). ＋ opens the room screen: a big 6-letter code, 📋 copy, the two seats; the game starts the moment the friend joins.
   Every move goes through the cerealAct callable (functions/cereal-act.js) — this page never writes cereal_games. The game doc is
   watched live (onSnapshot) and mapped onto the same game object cereal.js draws, so the board, notebook and reveal are the same
   screens. While the other player moves: the public board + "⏳ ตา Pond · n นาที"; after 1 hour ⏳ เคลม. The killer's own
   notebook comes from cerealAct mySecret (no client can read secret/killer). Share cards / LINE invite = PR 3. window.CKOnline. */
(function () {
    'use strict';
    var R = window.CerealRules;
    var st = { uid: null, list: [], unList: null, unGame: null, gameId: null, doc: null, secret: {}, err: '', busy: false, view: null, code: '', side: 'A', role: 'killer', timer: null, authTried: false };
    var C = function () { return window.CK && CK._; };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function call(data) { return firebase.functions().httpsCallable('cerealAct')(data).then(function (r) { return r.data || {}; }); }
    function msg(e) {
        var c = e && e.details && e.details.code;
        return { 'no-game': 'ไม่พบห้องที่เปิดอยู่ด้วยรหัสนี้', 'own-game': 'นี่คือห้องของคุณเอง', started: 'เกมเริ่มไปแล้ว', 'not-your-turn': 'ยังไม่ถึงตาคุณ', 'too-early': 'ยังไม่ครบ 1 ชม.' }[c]
            || (e && e.code === 'permission-denied' ? 'เปิดแอปจาก LINE ก่อน' : 'ส่งไม่สำเร็จ ลองอีกครั้ง');
    }
    function meRole(doc) { return ['killer', 'detective'].filter(function (r) { return doc.players && doc.players[r] && doc.players[r].authUid === st.uid; })[0] || null; }
    function rerender() { var c = C(); if (c) c.render(); }

    // ---- list of my online games (live) --------------------------------------------------------------------
    function start() {
        if (st.unList || st.authTried) return;
        st.authTried = true;
        Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(function () {
            var u = firebase.auth && firebase.auth().currentUser; st.uid = u && u.uid;
            if (!st.uid) { st.err = 'ต้องเปิดจาก LINE เพื่อเล่นออนไลน์'; st.authTried = false; rerender(); return; }
            st.unList = db.collection('cereal_games').where('authUids', 'array-contains', st.uid).onSnapshot(function (s) {
                st.list = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (x) { return x.status !== 'cancelled'; });
                rerender();
            }, function () { st.err = 'โหลดเกมออนไลน์ไม่ได้'; rerender(); });
            rerender();
        }).catch(function () { st.err = 'ต้องเปิดจาก LINE เพื่อเล่นออนไลน์'; st.authTried = false; rerender(); });
    }
    function myTurn(x) { return x.status === 'playing' && x.phase === meRole(x); }
    function myTurnCount() { return st.list.filter(myTurn).length; }
    function mins(ms) { var m = Math.max(0, Math.floor(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' น.' : m + ' น.'; }

    function lobbyHtml() {
        start();
        var c = C(), L = c.L, h = '';
        if (st.err) h += '<div class="ck-warn" id="ck-on-err">' + esc(st.err) + '</div>';
        if (st.view === 'create') {
            h += '<div class="ck-row"><span class="ck-mini">ฉันเป็น</span><button type="button" class="ck-chip' + (st.role === 'killer' ? ' on' : '') + '" id="ck-on-role-killer" onclick="CKOnline.pick(\'role\',\'killer\')">🔪 ฆาตกร</button><button type="button" class="ck-chip' + (st.role === 'detective' ? ' on' : '') + '" id="ck-on-role-detective" onclick="CKOnline.pick(\'role\',\'detective\')">🕵️ นักสืบ</button></div>'
                + '<div class="ck-row"><span class="ck-mini">แผนที่</span><button type="button" class="ck-chip' + (st.side === 'A' ? ' on' : '') + '" onclick="CKOnline.pick(\'side\',\'A\')">A <small>🥄🥄 ฆาตกร+</small></button><button type="button" class="ck-chip' + (st.side === 'B' ? ' on' : '') + '" onclick="CKOnline.pick(\'side\',\'B\')">B <small>🥄 นักสืบ+</small></button></div>'
                + '<button type="button" class="ck-primary" id="ck-on-create" onclick="CKOnline.create()"' + (st.busy || !st.uid ? ' disabled' : '') + '>' + L('＋ สร้างห้อง', 'Create a room') + '</button>'
                + '<button type="button" class="ck-chip" style="align-self:center" onclick="CKOnline.pick(\'view\',null)">✕ ยกเลิก</button>';
            return h;
        }
        if (st.view === 'join') {
            h += '<div class="ck-row"><span class="ck-mini">รหัสห้อง</span><label class="ck-name ck-code"><span>🔑</span><input type="text" id="ck-on-code" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="K7P3QX" value="' + esc(st.code) + '" aria-label="Room code"></label></div>'
                + '<button type="button" class="ck-primary" id="ck-on-join" onclick="CKOnline.join()"' + (st.busy || !st.uid ? ' disabled' : '') + '>' + L('🔑 เข้าร่วม', 'Join') + '</button>'
                + '<button type="button" class="ck-chip" style="align-self:center" onclick="CKOnline.pick(\'view\',null)">✕ ยกเลิก</button>';
            return h;
        }
        var order = function (x) { return myTurn(x) ? 0 : x.status === 'playing' ? 1 : x.status === 'lobby' ? 2 : 3; };
        var games = st.list.slice().sort(function (a, b) { return order(a) - order(b) || (b.updatedAt || 0) - (a.updatedAt || 0); }).slice(0, 12);
        if (games.length) {
            h += '<div class="ck-nb"><div class="lbl">🌐 เกมออนไลน์ของฉัน</div>';
            games.forEach(function (x) {
                var me = meRole(x), other = me === 'killer' ? 'detective' : 'killer', on = other && x.names ? x.names[other] : '', mine = myTurn(x), tail;
                if (x.status === 'lobby') tail = '<span class="ck-wait">👥 รอเพื่อน · ' + esc(x.code) + '</span>';
                else if (x.status === 'finished') tail = '<span class="ck-pill">' + (x.result && x.result.winner === (me === 'killer' ? 'killer' : 'good') ? '🏆 ชนะ' : '🏁 แพ้') + '</span>';
                else if (mine) tail = '<span class="ck-turn">ตาคุณ</span>';
                else tail = '<span class="ck-wait">⏳ รอ ' + esc(on) + ' · ' + mins(Date.now() - (x.updatedAt || Date.now())) + '</span>';
                h += '<button type="button" class="ck-game' + (mine ? ' mine' : '') + '" data-game="' + esc(x.id) + '" onclick="CKOnline.open(\'' + esc(x.id) + '\')"><span class="d">' + (x.status === 'playing' ? 'D' + x.day : x.status === 'lobby' ? '—' : '🏁') + '</span><span class="who">' + (me === 'killer' ? '🔪' : '🕵️') + ' คุณ' + (on ? ' · ' + (me === 'killer' ? '🕵️ ' : '🔪 ') + esc(on) : '') + '</span>' + tail + '<span class="go">▸</span></button>';
            });
            h += '</div>';
        } else if (st.uid) h += '<div class="ck-note" style="text-align:center">ยังไม่มีเกมออนไลน์ · สร้างห้องแล้วส่งรหัสให้เพื่อน</div>';
        h += '<div class="ck-2btn"><button type="button" class="ck-big" id="ck-on-new" onclick="CKOnline.pick(\'view\',\'create\')">＋<b>สร้างห้อง</b><small>เลือกบทบาท · ได้รหัส</small></button>'
            + '<button type="button" class="ck-big" id="ck-on-have" onclick="CKOnline.pick(\'view\',\'join\')">🔑<b>มีรหัสห้อง</b><small>พิมพ์รหัส 6 ตัว</small></button></div>';
        return h;
    }

    // ---- one game -------------------------------------------------------------------------------------------
    function toGame(doc, prev) {
        var me = meRole(doc), fin = doc.status === 'finished';
        var same = prev && prev.online && prev.online.id === doc.id && prev.day === doc.day && prev.phase === doc.phase;
        var secret = fin && doc.result ? { home: doc.result.revealedHome, path: doc.result.revealedPath || {}, kills: doc.result.revealedKills || {} } : (st.secret[doc.id] || { home: null, path: {}, kills: {} });
        var dd = doc.dd && doc.dd.asked ? doc.dd : same && prev.dd ? prev.dd : { path: [], asked: null };
        return {
            online: { id: doc.id, me: me, code: doc.code, status: doc.status, turnDeadline: doc.turnDeadline, updatedAt: doc.updatedAt, players: doc.players },
            id: doc.id, citySide: doc.citySide, names: doc.names || { killer: '', detective: '' }, status: fin ? 'finished' : 'playing', day: doc.day, phase: doc.phase, hand: null, bot: null,
            secret: secret, detectivePos: same && prev.detectivePos != null && doc.detectivePos == null ? prev.detectivePos : doc.detectivePos,
            cereals: doc.cereals || [], witness: doc.witness, arrestsLeft: doc.arrestsLeft, kills: doc.kills, usedQuestions: doc.usedQuestions || [], skipUsed: !!doc.skipUsed,
            log: doc.log || [], draft: same && prev.draft ? prev.draft : { path: [], kill: null, witness: null }, dd: dd, result: doc.result || null, pubDays: []
        };
    }
    function loadSecret(doc) {
        if (doc.status !== 'playing' || meRole(doc) !== 'killer') return;
        var have = st.secret[doc.id];
        if (have && have._day === doc.day && have._phase === doc.phase) return;
        call({ action: 'mySecret', gameId: doc.id }).then(function (r) {
            st.secret[doc.id] = Object.assign({ _day: doc.day, _phase: doc.phase }, r.secret);
            var c = C(); if (c && c.get() && c.get().online && c.get().online.id === doc.id) { var g = c.get(); g.secret = st.secret[doc.id]; c.render(); }
        }).catch(function (e) { st.err = msg(e); rerender(); });
    }
    function open(id) {
        if (st.unGame) st.unGame();
        st.gameId = id; st.err = ''; st.view = null;
        var c = C();
        st.unGame = db.collection('cereal_games').doc(id).onSnapshot(function (s) {
            if (!s.exists) return;
            var doc = Object.assign({ id: s.id }, s.data()), cur = c.get(), was = cur && cur.online && cur.online.id === id ? cur : null;
            var turnNow = was && was.phase !== doc.phase && doc.phase === meRole(doc);
            st.doc = doc; c.set(toGame(doc, was)); loadSecret(doc);
            if (turnNow) c.snd(doc.phase === 'killer' ? 'heartbeat' : 'tick');
            if (was && was.status !== 'finished' && doc.status === 'finished') c.ui.revealDay = 0;
            c.render(); tick();
        }, function () { st.err = 'โหลดเกมไม่ได้'; c.render(); });
    }
    function leave() { if (st.unGame) st.unGame(); st.unGame = null; st.gameId = null; st.doc = null; if (st.timer) { clearInterval(st.timer); st.timer = null; } }
    function tick() {   // keep "n นาที" and the claim button fresh while waiting
        if (st.timer) return;
        st.timer = setInterval(function () { var c = C(), g = c && c.get(); if (!g || !g.online || g.status !== 'playing' || g.phase === g.online.me) { clearInterval(st.timer); st.timer = null; return; } var m = document.getElementById('cerealModal'); if (m && m.style.display !== 'none') c.render(); }, 30000);
    }

    /** The screen for an online game, or null when cereal.js should draw its own (my turn, the reveal). */
    function screen() {
        var c = C(), g = c.get(), on = g.online;
        if (on.status === 'lobby') return roomHtml();
        if (g.status === 'finished') return null;
        if (g.phase !== on.me) return waitHtml();
        if (on.me === 'killer' && !(st.secret[on.id])) return '<div class="ck killer">' + c.topHtml('🌐 🔪 วันที่ ' + g.day, c.pills(g)) + '<div class="ck-note" style="text-align:center">⏳ กำลังโหลดสมุดลับ…</div></div>';
        return null;
    }
    function roomHtml() {
        var c = C(), g = c.get(), on = g.online, me = on.me;
        var seat = function (r) { var p = on.players && on.players[r]; return '<div class="seat' + (p ? ' on' : ' wait') + '">' + (r === 'killer' ? '🔪' : '🕵️') + '<b>' + (p ? (r === me ? 'คุณ' : esc(p.name)) : '…') + '</b><small>' + (p ? (r === 'killer' ? 'ฆาตกร' : 'นักสืบ') : 'รอเพื่อน') + '</small></div>'; };
        return '<div class="ck lobby">' + c.topHtml('🌐 ห้อง ' + esc(on.code))
            + (st.err ? '<div class="ck-warn">' + esc(st.err) + '</div>' : '')
            + '<div class="ck-room"><div class="code" id="ck-on-room-code">' + esc(on.code) + '</div>'
            + '<div class="ck-row" style="justify-content:center"><button type="button" class="ck-chip on" id="ck-on-copy" onclick="CKOnline.copy()">📋 คัดลอกรหัส</button></div>'
            + '<div class="seats">' + seat('killer') + seat('detective') + '</div>'
            + '<div class="ck-note" style="text-align:center">เพื่อนกด 🥣 → 🌐 ออนไลน์ → 🔑 ใส่รหัส · เกมเริ่มทันทีที่เข้าห้อง</div></div>'
            + '<div class="ck-row" style="justify-content:center"><button type="button" class="ck-chip" id="ck-on-cancel" onclick="CKOnline.cancel()">✕ ยกเลิกห้อง</button><button type="button" class="ck-chip" onclick="CK.lobby()">📋 เกมของฉัน</button></div></div>';
    }
    function waitHtml() {
        var c = C(), g = c.get(), on = g.online, other = g.phase, name = g.names[other] || '', now = Date.now(), late = on.turnDeadline && now > on.turnDeadline;
        var ex = c.publicExtra(g); if (g.detectivePos != null) { ex[g.detectivePos] = ex[g.detectivePos] || {}; ex[g.detectivePos].tk = (ex[g.detectivePos].tk || '') + '🕵️'; }
        if (on.me === 'killer' && st.secret[on.id]) { var kp = c.kposOf(g); if (kp != null) { ex[kp] = ex[kp] || {}; ex[kp].cls = (ex[kp].cls || '') + ' ring'; ex[kp].me = '🔪'; } }
        var card = late
            ? '<div class="ck-waitcard late" id="ck-on-wait"><span>⏳ ' + esc(name) + ' หายไป ' + mins(now - (on.updatedAt || now)) + '</span><small>เกินเวลาแล้ว · กดเคลมเพื่อจบตาที่ค้าง' + (other === 'killer' ? ' (ฆาตกรค้าง = นักสืบชนะ)' : ' (นักสืบค้าง = จบตาที่จุดเดิม)') + '</small><button type="button" class="ck-claim" id="ck-on-claim" onclick="CKOnline.claim()"' + (st.busy ? ' disabled' : '') + '>⏳ เคลม</button></div>'
            : '<div class="ck-waitcard" id="ck-on-wait"><span>⏳ ตา <b>' + esc(name) + '</b> (' + (other === 'killer' ? '🔪' : '🕵️') + ') · ผ่านมา ' + mins(now - (on.updatedAt || now)) + '</span><small>หน้านี้อัปเดตเองเมื่อ ' + esc(name) + ' เล่นเสร็จ · เคลมได้เมื่อครบ 1 ชม.</small></div>';
        return '<div class="ck ' + on.me + '">' + c.topHtml('🌐 ' + (on.me === 'killer' ? '🔪' : '🕵️') + ' วันที่ ' + g.day, c.pills(g)) + (st.err ? '<div class="ck-warn">' + esc(st.err) + '</div>' : '') + card
            + c.boardHtml(g, { extra: ex, tap: false }) + c.logHtml(g) + '<div class="ck-row" style="justify-content:center"><button type="button" class="ck-chip" onclick="CK.lobby()">📋 เกมของฉัน</button><button type="button" class="ck-chip" id="ck-on-resign" onclick="CKOnline.resign()">🏳️ ยอมแพ้</button></div></div>';
    }

    // ---- moves (each one through cerealAct; the snapshot redraws) ------------------------------------------------
    function act(data, after) {
        if (st.busy) return Promise.resolve(null);
        st.busy = true; st.err = ''; rerender();
        return call(data).then(function (r) { st.busy = false; if (after) after(r); rerender(); return r; })
            .catch(function (e) { st.busy = false; st.err = msg(e); rerender(); return null; });
    }
    function lock() {
        var c = C(), g = c.get(), d = g.draft;
        return act({ action: 'killerMove', gameId: g.online.id, path: d.path, kill: typeof d.kill === 'number' ? d.kill : null, witness: d.witness }, function () {
            if (typeof d.kill === 'number') c.snd('crunch'); if (d.witness != null) c.snd('gasp', 0.45);
            g.draft = { path: [], kill: null, witness: null }; delete st.secret[g.online.id];
        });
    }
    function ask(q) {
        var c = C(), g = c.get();
        return act({ action: 'ask', gameId: g.online.id, path: g.dd.path, question: q }, function (r) { g.dd = { path: g.dd.path, asked: { q: q, ans: r.answer, two: !!r.two } }; c.snd('ding'); });
    }
    function end(cell) {
        var c = C(), g = c.get(), path = g.dd.path.length ? g.dd.path : [g.detectivePos];
        return act({ action: 'detectiveEnd', gameId: g.online.id, path: path, arrest: cell }, function (r) { c.ui.arrest = null; if (cell != null) c.snd(r.caught ? 'siren' : 'buzz'); });
    }
    function cornered() {
        var c = C(), g = c.get(), pos = c.kposOf(g);
        act({ action: 'killerMove', gameId: g.online.id, path: [pos, pos, pos, pos] });
        return '<div class="ck killer">' + c.topHtml('🌐 🔪 วันที่ ' + g.day, c.pills(g)) + '<div class="ck-note" style="text-align:center">🔪 จนมุม · ไม่มีทางเดิน 3 ก้าว</div></div>';
    }

    window.CKOnline = {
        lobbyHtml: lobbyHtml, screen: screen, open: open, leave: leave, myTurnCount: myTurnCount, start: start,
        lock: lock, ask: ask, end: end, cornered: cornered,
        pick: function (k, v) { if (k === 'view' && v === 'join') st.code = ''; st[k] = v; st.err = ''; rerender(); },
        create: function () { return act({ action: 'create', role: st.role, side: st.side }, function (r) { st.view = null; if (r && r.gameId) open(r.gameId); }); },
        join: function () {
            var el = document.getElementById('ck-on-code'); st.code = ((el && el.value) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (st.code.length !== 6) { st.err = 'รหัสห้องมี 6 ตัว'; rerender(); return Promise.resolve(null); }
            return act({ action: 'join', code: st.code }, function (r) { st.view = null; if (r && r.gameId) open(r.gameId); });
        },
        copy: function () { var g = C().get(); try { navigator.clipboard.writeText(g.online.code); } catch (_) { /* old webview */ } var b = document.getElementById('ck-on-copy'); if (b) b.textContent = '📋 คัดลอกแล้ว'; },
        cancel: function () { var g = C().get(); return act({ action: 'cancel', gameId: g.online.id }, function () { leave(); C().set(null); }); },
        claim: function () { var g = C().get(); return act({ action: 'claim', gameId: g.online.id }); },
        resign: function () { var g = C().get(); return act({ action: 'resign', gameId: g.online.id }); },
        state: function () { return st; }   // QA
    };
})();
