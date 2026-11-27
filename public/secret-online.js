/* V101.380 🔢 เลขลับ หลายคน (owner 2026-11-27, pick A: player cards + a grid of what I know about the chosen player · the host picks
   ⏱ 1 ชม. or 60 วิ a turn · mockup-secret-multi/). Drawn inside the เลขลับ popup (secret.js calls SNOnline.lobbyHtml / html). The
   referee is roomAct with game 'secret' (functions/room-secret.js): this file reads rooms/{id} (players, 🎫, ⭐, who is out, the log
   without answers) and rooms/{id}/hand/{my login} (my number, my answers, my wrong guesses) and sends create / join / start / ask /
   guess / claim / resign / cancel. 📤 invites in LINE (?sn=<code>), no OA quota. A late turn is skipped by the waiting phones.
   window.SNOnline. */
(function () {
    'use strict';
    var st = { uid: null, list: [], err: '', msg: '', busy: false, open: null, room: null, hand: null, unList: null, unRoom: null, unHand: null, to: null, q: null, live: false, tick: null, pending: null, logged: {} };
    var MAX = 100;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function rr() { if (window.SN && SN._render) SN._render(); }
    function call(data) { return Promise.resolve(window.ensureAuthLink && ensureAuthLink()).then(function () { return firebase.functions().httpsCallable('roomAct')(Object.assign({ game: 'secret' }, data)); }).then(function (r) { return r.data || {}; }); }   // V101.383 link this sign-in first
    function msg(e) {
        var c = e && e.details && e.details.code;
        return { 'no-room': 'ไม่พบห้องที่เปิดอยู่ด้วยรหัสนี้', full: 'ห้องเต็มแล้ว (6 คน)', started: 'เกมเริ่มไปแล้ว', 'not-your-turn': 'ยังไม่ถึงตาคุณ', out: 'คนนี้ออกแล้ว', 'no-ticket': '🎫 หมดแล้ว', alone: 'รอเพื่อนอีกอย่างน้อย 1 คน', early: 'เขายังมีเวลา' }[c]
            || (e && e.code === 'permission-denied' ? 'เปิดแอปจาก LINE ก่อน' : 'ส่งไม่สำเร็จ ลองอีกครั้ง');
    }
    function face(p, sz) { sz = sz || 28; return p && p.pic ? '<img class="sno-av" style="width:' + sz + 'px;height:' + sz + 'px" src="' + esc(p.pic) + '" alt="" referrerpolicy="no-referrer">' : '<span class="sno-av" style="width:' + sz + 'px;height:' + sz + 'px">' + esc(((p && p.name) || '?').slice(0, 1)) + '</span>'; }
    function name(g, u) { return u === st.uid ? 'คุณ' : esc((g.players[u] || {}).name || '?'); }
    function css() {
        if (document.getElementById('sno-css')) return;
        var s = document.createElement('style'); s.id = 'sno-css';
        s.textContent = '#snModal .sno-av{border-radius:50%;object-fit:cover;background:#ccfbf1;color:#0f766e;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex:none}'
            + '#snModal .sno-row{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;background:#fff;text-align:left;width:100%;font-weight:800}#snModal .sno-row small{display:block;font-weight:600;color:#64748b;font-size:.78em}#snModal .sno-row .go{margin-left:auto;color:#b45309;white-space:nowrap}#snModal .sno-row .wait{margin-left:auto;color:#64748b;white-space:nowrap}'
            + '#snModal .sno-ps{display:flex;gap:6px}#snModal .sno-p{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 2px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;font-size:.72em;font-weight:800}'
            + '#snModal .sno-p.on{border:2px solid #0d9488;background:#f0fdfa}#snModal .sno-p.out{opacity:.4}#snModal .sno-p.turn{box-shadow:0 0 0 2px #fbbf24}#snModal .sno-p small{font-weight:600;color:#64748b;white-space:nowrap}#snModal .sno-p span.nm{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
            + '#snModal .sno-code{display:flex;gap:6px;justify-content:center}#snModal .sno-code span{width:44px;height:52px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center}'
            + '#snModal .sno-join{display:flex;gap:6px}#snModal .sno-join input{flex:1;min-width:0;font-size:16px;font-weight:900;text-align:center;letter-spacing:4px;border:2px solid #99f6e4;border-radius:12px;padding:8px}#snModal .sno-join input::placeholder{letter-spacing:normal}'
            + '#snModal .sno-err{color:#b91c1c;font-weight:800;text-align:center;font-size:.85em}';
        document.head.appendChild(s);
    }
    function start() {
        if (st.unList || st.tried) return;
        st.tried = true;
        Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(function () {
            var u = window.firebase && firebase.auth && firebase.auth().currentUser; st.uid = u && u.uid;
            if (!st.uid || typeof db === 'undefined') { st.err = 'ต้องเปิดจาก LINE เพื่อเล่นกับเพื่อน'; st.tried = false; return rr(); }
            st.unList = db.collection('rooms').where('authUids', 'array-contains', st.uid).onSnapshot(function (s) {
                st.list = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (x) { return x.game === 'secret'; });
                if (st.pending) { var c = st.pending; st.pending = null; SNOnline.join(c); }
                rr();
            }, function () { st.err = 'โหลดห้องไม่ได้'; rr(); });
            rr();
        }).catch(function () { st.err = 'ต้องเปิดจาก LINE เพื่อเล่นกับเพื่อน'; st.tried = false; rr(); });
    }
    function busy(p) { st.busy = true; st.msg = ''; rr(); return p.then(function (x) { st.busy = false; rr(); return x; }, function (e) { st.busy = false; st.msg = msg(e); rr(); return null; }); }

    function lobbyHtml() {
        css(); start();
        var h = st.err ? '<div class="sno-err">' + esc(st.err) + '</div>' : '';
        if (st.msg) h += '<div class="' + (/^📋/.test(st.msg) ? 'sn-note' : 'sno-err') + '" id="sno-msg">' + esc(st.msg) + '</div>';
        st.list.filter(function (x) { return x.status === 'playing' || x.status === 'lobby'; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }).forEach(function (x) {
            var mine = x.turn === st.uid, n = x.order.length;
            h += '<button type="button" class="sno-row" data-room="' + x.id + '" onclick="SNOnline.open(\'' + x.id + '\')">🔢 ' + (x.status === 'lobby' ? '🔑 ' + x.code : n + ' คน') + '<small>' + x.order.map(function (u) { return name(x, u); }).join(' · ') + '</small>'
                + (x.status === 'lobby' ? '<span class="wait">รอเริ่ม…</span>' : mine ? '<b class="go">▶ ตาคุณ</b>' : '<span class="wait">⏳ ตา ' + name(x, x.turn) + '</span>') + '</button>';
        });
        h += '<div class="sn-lvs" role="group" aria-label="Turn time">' + [[false, '⏱ ตาละ 1 ชม.'], [true, '⚡ ตาละ 60 วิ']].map(function (k) { return '<button type="button" id="sno-live-' + k[0] + '" class="' + (st.live === k[0] ? 'on' : '') + '" aria-pressed="' + (st.live === k[0]) + '" onclick="SNOnline.setLive(' + k[0] + ')">' + k[1] + '</button>'; }).join('') + '</div>'
            + '<button type="button" class="sn-go" id="sno-new" onclick="SNOnline.create()"' + (st.busy ? ' disabled' : '') + '>＋ เปิดห้อง · 2–6 คน</button>'
            + '<div class="sno-join"><input id="sno-code" inputmode="numeric" maxlength="4" placeholder="ใส่รหัสห้อง" aria-label="Room code"><button type="button" class="sn-go alt" id="sno-join" onclick="SNOnline.join()">เข้า</button></div>';
        return h;
    }

    /** the numbers still possible for `to` from my own answers and wrong guesses */
    function liveFor(to) {
        var hd = st.hand || {}, notes = (hd.notes || []).filter(function (x) { return x.to === to; }), wrong = (hd.wrong || []).filter(function (x) { return x.to === to; }).map(function (x) { return x.n; });
        var QS = {}; ((window.SN && SN._qs) || []).forEach(function (q) { QS[q[0]] = q[3]; });
        var out = [];
        for (var n = 1; n <= MAX; n++) { if (wrong.indexOf(n) >= 0) continue; var ok = true; for (var i = 0; ok && i < notes.length; i++) { var f = QS[notes[i].q]; if (f && !!f(n, notes[i].a, notes[i].b) !== notes[i].ans) ok = false; } if (ok) out.push(n); }
        return out;
    }
    function secs() { var g = st.room; return g && g.turnDeadline ? Math.max(0, Math.ceil((g.turnDeadline - Date.now()) / 1000)) : 0; }
    function clock() { var s = secs(); return s >= 3600 ? '1:00:00' : s >= 60 ? Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2) : s + ' วิ'; }
    function html() {
        css();
        var g = st.room, hd = st.hand;
        if (!g) return '<div class="sn"><div class="sn-note">กำลังโหลด…</div></div>';
        var X = '<button type="button" class="sn-x" onclick="SNOnline.leave()" aria-label="Back">✕</button>';
        if (g.status === 'lobby') {
            var host = g.creatorAuth === st.uid;
            return '<div class="sn"><div class="sn-top"><h3>🔢 เลขลับ · ห้อง</h3><span class="sn-pill">' + g.order.length + '/6</span>' + X + '</div>'
                + '<div class="sn-note">รหัสห้อง · บอกเพื่อน · ' + (g.live ? '⚡ ตาละ 60 วิ' : '⏱ ตาละ 1 ชม.') + '</div><div class="sno-code" id="sno-roomcode">' + g.code.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>'
                + '<div class="sn-log" id="sno-seats">' + g.order.map(function (u) { return '<div><span>' + face(g.players[u], 22) + ' ' + name(g, u) + (u === g.creatorAuth ? ' · เจ้าของห้อง' : '') + '</span><b class="yes">✓</b></div>'; }).join('') + '</div>'
                + (st.msg ? '<div class="' + (/^📋/.test(st.msg) ? 'sn-note' : 'sno-err') + '">' + esc(st.msg) + '</div>' : '')
                + (host ? '<div class="sn-row"><button type="button" class="sn-go alt" id="sno-invite" onclick="SNOnline.invite()" aria-label="Invite in LINE">📤</button><button type="button" class="sn-go" style="flex:1" id="sno-start" onclick="SNOnline.startGame()"' + (g.order.length < 2 || st.busy ? ' disabled' : '') + '>▸ เริ่ม (' + g.order.length + ' คน)</button></div>'
                    + '<button type="button" class="sn-x" style="align-self:center;font-size:.8em" onclick="SNOnline.cancel()">✕ ปิดห้อง</button>' : '<div class="sn-note">⏳ รอเจ้าของห้องกด ▸ เริ่ม</div>')
                + '<div class="sn-note">ทุกคนได้เลขลับ 1–100 · 🎫 6 · ทายถูก ⭐ +3 · ผิด −1</div></div>';
        }
        if (!hd) return '<div class="sn"><div class="sn-note">กำลังโหลด…</div></div>';
        if (g.status === 'done') return endHtml(g, X);
        var others = g.order.filter(function (u) { return u !== st.uid; });
        if (!st.to || st.to === st.uid || g.out[st.to]) st.to = others.filter(function (u) { return !g.out[u]; })[0] || others[0];
        var myT = g.turn === st.uid, L = liveFor(st.to), last = g.log[g.log.length - 1];
        var h = '<div class="sn"><div class="sn-top"><h3>🔢 ' + (myT ? 'ตาคุณ' : 'ตา ' + name(g, g.turn)) + '</h3><span class="sn-pill" id="sno-clock">⏳ ' + clock() + '</span><span class="sn-pill">เลขคุณ ' + hd.n + '</span>' + X + '</div>'
            + '<div class="sno-ps" id="sno-players">' + g.order.map(function (u) {
                return '<button type="button" class="sno-p' + (u === st.to ? ' on' : '') + (g.out[u] ? ' out' : '') + (u === g.turn ? ' turn' : '') + '" data-u="' + u + '"' + (u === st.uid ? ' disabled' : ' onclick="SNOnline.target(\'' + u + '\')"') + '>' + face(g.players[u]) + '<span class="nm">' + name(g, u) + '</span><small>🎫 ' + g.tickets[u] + ' · ⭐ ' + g.score[u] + '</small></button>';
            }).join('') + '</div>';
        if (last) h += '<div class="sn-note" id="sno-last">' + lastLine(g, last) + '</div>';
        var outN = g.out[st.to] ? (g.log.filter(function (x) { return x.k === 'out' && x.to === st.to; })[0] || {}).n : null;
        h += '<div class="sn-note" id="sno-left">ที่คุณรู้เรื่อง <b>' + name(g, st.to) + '</b> · ' + (outN ? 'ออกแล้ว · เลข ' + outN : 'เหลือ ' + L.length + ' ตัว') + '</div><div class="sn-grid" id="sno-grid">';
        for (var n = 1; n <= MAX; n++) { var bad = (hd.wrong || []).some(function (x) { return x.to === st.to && x.n === n; }); h += '<button type="button" data-n="' + n + '" class="' + (bad ? 'out bad' : L.indexOf(n) < 0 ? 'out' : '') + '"' + (myT && !bad && !g.out[st.to] ? ' onclick="SNOnline.guess(' + n + ')"' : ' disabled') + '>' + n + '</button>'; }
        h += '</div>';
        if (myT) {
            var Q = st.q && (SN._qs || []).filter(function (x) { return x[0] === st.q; })[0];
            h += '<div class="sn-chips" role="group" aria-label="Questions">' + (SN._qs || []).map(function (x) { return '<button type="button" data-q="' + x[0] + '" class="' + (st.q === x[0] ? 'on' : '') + '" onclick="SNOnline.pick(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>'
                + '<div class="sn-row">' + (Q && Q[2] ? '<input id="sno-a" type="number" inputmode="numeric" placeholder="' + (Q[0] === 'unit' ? '0–9' : '1–100') + '" aria-label="Number">' : '') + (Q && Q[2] === 2 ? '<span>–</span><input id="sno-b" type="number" inputmode="numeric" placeholder="1–100" aria-label="To">' : '')
                + '<button type="button" class="sn-go" style="flex:1" id="sno-ask" onclick="SNOnline.ask()"' + (!Q || st.busy ? ' disabled' : '') + '>ถาม ' + name(g, st.to) + ' 🎫</button></div>'
                + '<div class="sn-note">แตะเลขในตาราง = ทายเลข ' + name(g, st.to) + ' · ถูก ⭐ +3 · ผิด ⭐ −1 🎫 −1</div>';
        } else {
            var late = g.turnDeadline && Date.now() > g.turnDeadline;
            h += '<div class="sn-row"><button type="button" class="sn-go alt" style="flex:1" id="sno-nudge" onclick="SNOnline.nudge()">📤 สะกิด ' + name(g, g.turn) + '</button>' + (late ? '<button type="button" class="sn-go" id="sno-claim" onclick="SNOnline.claim()">⏭ ข้ามตา</button>' : '') + '</div>';
        }
        if (st.msg) h += '<div class="sno-err" id="sno-msg">' + esc(st.msg) + '</div>';
        return h + '<button type="button" class="sn-x" style="align-self:center;font-size:.8em" onclick="SNOnline.resign()">🏳 ออกจากเกม</button></div>';
    }
    function lastLine(g, L) {
        if (L.k === 'ask') return 'ล่าสุด: ' + name(g, L.by) + ' ถาม ' + name(g, L.to) + ' · ' + esc(L.txt) + (L.by === st.uid ? '' : ' 🔒');
        if (L.k === 'guess') return 'ล่าสุด: ' + name(g, L.by) + ' ทาย ' + name(g, L.to) + ' = ' + L.n + (L.right ? ' 🎯 +3' : ' ✗');
        if (L.k === 'out') return '✖ ' + name(g, L.to) + ' ออก · เลข ' + L.n;
        if (L.k === 'skip') return '⏭ ข้ามตา' + name(g, L.to);
        if (L.k === 'left') return '🏳 ' + name(g, L.to) + ' ออกจากเกม';
        return '';
    }
    function endHtml(g, X) {
        var r = g.result || {}, won = (r.winners || []).indexOf(st.uid) >= 0;
        if (!st.logged[st.open] && window.GameLog && r.reason !== 'cancelled') {
            st.logged[st.open] = 1;
            try { GameLog.see('secret', { id: st.open, n: 1, done: true, mode: g.live ? 'live' : 'online', win: won ? 'w' : 'l', score: String(g.score[st.uid] || 0), res: [] }); } catch (e) { }
        }
        if (r.reason === 'cancelled') return '<div class="sn"><div class="sn-top"><h3>🔢 ปิดห้องแล้ว</h3>' + X + '</div><button type="button" class="sn-go" onclick="SNOnline.leave()">⬅ ห้องอื่น</button></div>';
        return '<div class="sn"><div class="sn-top"><h3>🔢 จบเกม</h3>' + X + '</div>'
            + '<div class="sn-big" style="font-size:1.3em" id="sno-final">🏆 ' + (r.winners || []).map(function (u) { return name(g, u); }).join(' · ') + ' ชนะ</div>'
            + '<div class="sn-log" id="sno-rank">' + (r.rank || []).map(function (u, i) { return '<div><span>' + (['🥇', '🥈', '🥉'][i] || i + 1) + ' ' + face(g.players[u], 22) + ' ' + name(g, u) + '</span><b>เลข ' + (r.nums || {})[u] + ' · ⭐ ' + g.score[u] + '</b></div>'; }).join('') + '</div>'
            + '<button type="button" class="sn-go" onclick="SNOnline.leave()">⬅ ห้องอื่น</button></div>';
    }
    function tick() {
        clearInterval(st.tick);
        st.tick = setInterval(function () {
            var g = st.room; if (!g || g.status !== 'playing') return;
            var c = document.getElementById('sno-clock'); if (c) c.textContent = '⏳ ' + clock();
            if (g.live && Date.now() > g.turnDeadline + 800 && g.turn !== st.uid && !st.busy) SNOnline.claim();
        }, 1000);
    }
    function share(alt, title, big, button, uri) {
        var card = { type: 'flex', altText: alt, contents: { type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#0f766e', paddingAll: '16px', contents: [{ type: 'text', text: '🔢 เลขลับ', color: '#ccfbf1', size: 'xs', weight: 'bold' }, { type: 'text', text: title, color: '#ffffff', size: 'lg', weight: 'bold', wrap: true }] },
            body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: big, size: 'xxl', weight: 'bold', align: 'center' }, { type: 'text', text: 'ทุกคนมีเลขลับ 1–100 · ทายให้ถูก', size: 'xs', color: '#6b7280', align: 'center' }] },
            footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#0d9488', height: 'sm', action: { type: 'uri', label: button, uri: uri } }] } } };
        var text = alt + '\n' + uri;
        var viaLine = window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker') ? Promise.resolve(liff.shareTargetPicker([card])).then(function (x) { return x ? 'sent' : 'closed'; }, function () { return null; }) : Promise.resolve(null);
        return viaLine.then(function (x) {
            if (x === 'sent' || x === 'closed') return x === 'sent';
            if (navigator.share) return navigator.share({ text: text }).then(function () { return true; }, function () { return false; });
            try { return navigator.clipboard.writeText(text).then(function () { st.msg = '📋 คัดลอกลิงก์แล้ว'; rr(); return true; }, function () { return false; }); } catch (e) { return false; }
        });
    }
    function link(q) { return 'https://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '') + '?sn=' + q; }

    window.SNOnline = {
        lobbyHtml: lobbyHtml, html: html,
        active: function () { return !!st.open; },
        setLive: function (v) { st.live = !!v; rr(); },
        create: function () { return busy(call({ action: 'create', live: st.live })).then(function (r) { if (r && r.roomId) { st.hostName = r.name; SNOnline.open(r.roomId); } }); },
        join: function (code) {
            var el = document.getElementById('sno-code'); code = String(code || (el && el.value) || '').replace(/\D/g, '');
            if (code.length !== 4) { st.msg = 'ใส่รหัส 4 หลัก'; return rr(); }
            if (!st.uid) { st.pending = code; start(); return; }
            return busy(call({ action: 'join', code: code })).then(function (r) { if (r && r.roomId) SNOnline.open(r.roomId); });
        },
        open: function (id) {
            SNOnline.close(); st.open = id; st.room = null; st.hand = null; st.to = null; st.q = null; st.msg = '';
            st.unRoom = db.collection('rooms').doc(id).onSnapshot(function (s) { st.room = s.exists ? s.data() : null; rr(); }, function () { st.msg = 'โหลดห้องไม่ได้'; rr(); });
            st.unHand = db.collection('rooms').doc(id).collection('hand').doc(st.uid).onSnapshot(function (s) { st.hand = s.exists ? s.data() : null; rr(); }, function () { });
            tick(); rr();
        },
        close: function () { if (st.unRoom) st.unRoom(); if (st.unHand) st.unHand(); st.unRoom = st.unHand = null; clearInterval(st.tick); st.open = null; },
        leave: function () { SNOnline.close(); rr(); },
        invite: function () { var g = st.room; if (!g) return; var nm = (g.players[g.creatorAuth] || {}).name || 'เพื่อน'; return share('🔢 ' + nm + ' ชวนเล่นเลขลับ · รหัส ' + g.code, nm + ' ชวนเล่นเลขลับ', '🔑 ' + g.code, '▸ เข้าห้อง', link(g.code)); },
        startGame: function () { return busy(call({ action: 'start', roomId: st.open })); },
        cancel: function () { return busy(call({ action: 'cancel', roomId: st.open })); },
        target: function (u) { st.to = u; st.msg = ''; rr(); },
        pick: function (q) { st.q = q; st.msg = ''; rr(); var f = document.getElementById('sno-a'); if (f) f.focus(); },
        ask: function () {
            var Q = st.q && (SN._qs || []).filter(function (x) { return x[0] === st.q; })[0]; if (!Q) return;
            var a = Q[2] ? +(document.getElementById('sno-a') || {}).value : 0, b = Q[2] === 2 ? +(document.getElementById('sno-b') || {}).value : 0;
            var lo = Q[0] === 'unit' ? 0 : 1, hi = Q[0] === 'unit' ? 9 : MAX;
            if (Q[2] && !(Number.isInteger(a) && a >= lo && a <= hi && (Q[2] < 2 || (Number.isInteger(b) && b >= 1 && b <= MAX)))) { st.msg = 'ใส่เลข ' + lo + '–' + hi; return rr(); }
            return busy(call({ action: 'ask', roomId: st.open, to: st.to, q: Q[0], a: a, b: b })).then(function (r) { if (r) st.q = null; });
        },
        guess: function (n) { var g = st.room; if (!g || !window.confirm('ทายเลข' + ((g.players[st.to] || {}).name || '') + ' = ' + n + ' ?')) return; return busy(call({ action: 'guess', roomId: st.open, to: st.to, n: n })); },
        claim: function () { if (!st.open) return; return busy(call({ action: 'claim', roomId: st.open })); },
        resign: function () { if (!st.open || !window.confirm('ออกจากเกมนี้?')) return; return busy(call({ action: 'resign', roomId: st.open })); },
        nudge: function () { var g = st.room; if (!g) return; return share('🔢 ถึงตาคุณแล้ว · เลขลับ', 'ถึงตาคุณแล้ว', '🔢 ' + g.order.length + ' คน', '▸ ไปเล่น', link('1')); },
        deepLink: function (v) { v = String(v || ''); if (/^\d{4}$/.test(v)) { if (st.uid) SNOnline.join(v); else { st.pending = v; start(); } } },
        _st: function () { return st; }
    };
})();
