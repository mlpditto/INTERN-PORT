/* V101.379 ⚫⚪ ไพ่เงา 🌐 กับเพื่อน + 🔢 ห้องสด (owner "ทำให้ user เล่น 2 คน" → A + B + C, mockup-shadow-2p/): the online half, drawn inside
   the ไพ่เงา popup (shadow.js calls BWOnline.lobbyHtml / html). The referee is the roomAct callable (functions/room-act.js): this file
   only reads rooms/{id} (colours, scores, whose turn) and rooms/{id}/hand/{my login} (my own tiles), and sends create / join / play
   / claim / resign / cancel. 🌐: 📤 an invite card in LINE (shareTargetPicker → OS share → clipboard, no OA quota) with ?bw=<code>;
   a turn waits up to 1 h, then the waiting player may take the win; 📤 สะกิด sends "ถึงตาคุณแล้ว". 🔢: a 4-digit code to say out loud,
   both in the room, 30 s a turn — when it runs out the waiting phone asks the referee, which plays the late player's lowest tile.
   A finished game goes to game_plays (mode 'online' / 'live', with my win) → 🏆 Top 3. window.BWOnline. */
(function () {
    'use strict';
    var st = { uid: null, list: [], listed: false, err: '', open: null, room: null, hand: null, unList: null, unRoom: null, unHand: null, busy: false, msg: '', pending: null, waitLive: null, tick: null, seenEnd: {} };
    var CE = { b: '⚫', w: '⚪' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function rr() { if (window.BW && BW._render) BW._render(); }
    function call(data) { return firebase.functions().httpsCallable('roomAct')(Object.assign({ game: 'bw' }, data)).then(function (r) { return r.data || {}; }); }
    function msg(e) {
        var c = e && e.details && e.details.code;
        return { 'no-room': 'ไม่พบห้องที่เปิดอยู่ด้วยรหัสนี้', 'own-room': 'นี่คือห้องของคุณเอง', started: 'เกมเริ่มไปแล้ว', 'not-your-turn': 'ยังไม่ถึงตาคุณ', early: 'เขายังมีเวลา', 'no-tile': 'ไพ่ใบนี้ใช้ไปแล้ว' }[c]
            || (e && e.code === 'permission-denied' ? 'เปิดแอปจาก LINE ก่อน' : 'ส่งไม่สำเร็จ ลองอีกครั้ง');
    }
    function seatOf(g) { return !g || !g.players ? null : g.players.a && g.players.a.authUid === st.uid ? 'a' : g.players.b && g.players.b.authUid === st.uid ? 'b' : null; }
    function oth(s) { return s === 'a' ? 'b' : 'a'; }
    function face(p, sz) { sz = sz || 22; return p && p.pic ? '<img class="bwo-av" style="width:' + sz + 'px;height:' + sz + 'px" src="' + esc(p.pic) + '" alt="" referrerpolicy="no-referrer">' : '<span class="bwo-av" style="width:' + sz + 'px;height:' + sz + 'px">' + esc(((p && p.name) || '?').slice(0, 1)) + '</span>'; }
    function css() {
        if (document.getElementById('bwo-css')) return;
        var s = document.createElement('style'); s.id = 'bwo-css';
        s.textContent = '#bwModal .bwo-av{border-radius:50%;object-fit:cover;background:#3f3a74;color:#e9d5ff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex:none;vertical-align:middle}'
            + '#bwModal .bwo-row{display:flex;align-items:center;gap:8px;border:1px solid #3f3a74;border-radius:14px;padding:9px 11px;background:#1d1a3d;color:#e9d5ff;font-weight:800;text-align:left;width:100%}'
            + '#bwModal .bwo-row small{display:block;opacity:.7;font-weight:600;font-size:.78em}#bwModal .bwo-row .go{margin-left:auto;color:#fbbf24;white-space:nowrap}#bwModal .bwo-row .wait{margin-left:auto;opacity:.75;white-space:nowrap}'
            + '#bwModal .bwo-code{display:flex;gap:8px;justify-content:center}#bwModal .bwo-code span{width:48px;height:58px;border-radius:12px;background:#1d1a3d;border:1px solid #3f3a74;color:#fff;font-size:30px;font-weight:900;display:flex;align-items:center;justify-content:center}'
            + '#bwModal .bwo-join{display:flex;gap:6px}#bwModal .bwo-join input{flex:1;min-width:0;border-radius:12px;border:1px solid #3f3a74;background:#0f0d24;color:#fff;padding:10px;font-size:16px;letter-spacing:4px;text-align:center}#bwModal .bwo-join input::placeholder{letter-spacing:normal}'
            + '#bwModal .bwo-err{color:#fca5a5;font-weight:800;text-align:center;font-size:.85em}#bwModal .bwo-vs{display:flex;align-items:center;gap:4px;font-size:.85em}';
        document.head.appendChild(s);
    }

    // ---- my rooms (live list) ---------------------------------------------------------------------------------------------------
    function start() {
        if (st.unList || st.tried) return;
        st.tried = true;
        Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(function () {
            var u = window.firebase && firebase.auth && firebase.auth().currentUser; st.uid = u && u.uid;
            if (!st.uid || typeof db === 'undefined') { st.err = 'ต้องเปิดจาก LINE เพื่อเล่นกับเพื่อน'; st.tried = false; return rr(); }
            st.unList = db.collection('rooms').where('authUids', 'array-contains', st.uid).onSnapshot(function (s) {
                st.list = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (x) { return x.game === 'bw'; });
                st.listed = true;
                // 🔢 my live room just filled → straight into the game
                if (st.waitLive) { var w = st.list.filter(function (x) { return x.id === st.waitLive && x.status === 'playing'; })[0]; if (w) { st.waitLive = null; return BWOnline.open(w.id); } }
                if (st.pending) { var c = st.pending; st.pending = null; BWOnline.join(c); }
                rr();
            }, function () { st.err = 'โหลดห้องไม่ได้'; rr(); });
            rr();
        }).catch(function () { st.err = 'ต้องเปิดจาก LINE เพื่อเล่นกับเพื่อน'; st.tried = false; rr(); });
    }
    function mine(live) { return st.list.filter(function (x) { return !!x.live === live; }); }
    function myTurn(x) { return x.status === 'playing' && x.turn === seatOf(x); }
    function openRoom(live) { return mine(live).filter(function (x) { return x.status === 'lobby'; })[0] || null; }

    function joinRow() {
        return '<div class="bwo-join"><input id="bwo-code" inputmode="numeric" maxlength="4" placeholder="ใส่รหัสห้อง" aria-label="Room code"><button type="button" class="bw-go" id="bwo-join" onclick="BWOnline.join()"' + (st.busy ? ' disabled' : '') + '>เข้า</button></div>';
    }
    function lobbyHtml(live) {
        css(); start();
        var h = st.err ? '<div class="bwo-err" id="bwo-err">' + esc(st.err) + '</div>' : '', open = openRoom(live);
        if (st.msg) h += '<div class="bwo-err" id="bwo-msg">' + esc(st.msg) + '</div>';
        if (!live) {
            mine(false).filter(function (x) { return x.status === 'playing'; }).sort(function (a, b) { return (myTurn(b) - myTurn(a)) || (b.updatedAt - a.updatedAt); }).forEach(function (x) {
                var me = seatOf(x), o = x.players[oth(me)];
                h += '<button type="button" class="bwo-row" data-room="' + x.id + '" onclick="BWOnline.open(\'' + x.id + '\')">' + face(o, 26) + '<span>' + esc(o.name) + '<small>ตา ' + Math.min(9, x.hist.length + 1) + '/9 · คุณ ' + x.sc[me] + ' : ' + x.sc[oth(me)] + '</small></span>'
                    + (myTurn(x) ? '<b class="go">▶ ตาคุณ</b>' : '<span class="wait">⏳ รอเขา</span>') + '</button>';
            });
            if (open) h += '<div class="bwo-row" id="bwo-open">🔑 ' + open.code + '<span class="wait">รอเพื่อน…</span><button type="button" class="bw-snd" onclick="BWOnline.invite(\'' + open.id + '\')" aria-label="Invite again in LINE">📤</button><button type="button" class="bw-snd" onclick="BWOnline.cancel(\'' + open.id + '\')" aria-label="Close the room">✕</button></div>';
            h += '<div class="bw-note">ตาละครั้ง · ถึงตาเพื่อน กด 📤 สะกิด</div>' + joinRow()
                + '<button type="button" class="bw-go" id="bwo-new" onclick="BWOnline.create(false)"' + (st.busy ? ' disabled' : '') + '>📤 ชวนเพื่อนใน LINE</button>';
            return h;
        }
        if (open) {
            h += '<div class="bw-note">รหัสห้อง · บอกเพื่อน</div><div class="bwo-code" id="bwo-livecode">' + open.code.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>'
                + '<div class="bwo-row">' + face(open.players.a) + esc(open.players.a.name) + ' ✓<span class="wait">รอเพื่อน…</span><button type="button" class="bw-snd" onclick="BWOnline.cancel(\'' + open.id + '\')" aria-label="Close the room">✕</button></div>';
            st.waitLive = open.id;
        } else h += '<div class="bw-note">เล่นพร้อมกัน · ตาละ 30 วิ</div><button type="button" class="bw-go" id="bwo-live" onclick="BWOnline.create(true)"' + (st.busy ? ' disabled' : '') + '>＋ เปิดห้องสด</button>';
        return h + joinRow();
    }

    // ---- one room ---------------------------------------------------------------------------------------------------------------
    function t(n, cls) { return '<span class="bw-t ' + (n % 2 ? 'w' : 'b') + (cls ? ' ' + cls : '') + '">' + n + '</span>'; }
    function back(c, cls) { return '<span class="bw-t back ' + c + (cls ? ' ' + cls : '') + '">?</span>'; }
    function left() { var g = st.room; return g && g.turnDeadline ? Math.max(0, Math.ceil((g.turnDeadline - Date.now()) / 1000)) : 0; }
    function html() {
        var g = st.room, hd = st.hand;
        if (!g || !hd) return '<div class="bw"><div class="bw-note">กำลังโหลด…</div></div>';
        var me = seatOf(g), ot = oth(me), o = g.players[ot], sec = left();
        var top = '<div class="bw-top"><h3 class="bwo-vs">⚫⚪ ' + face(g.players[me]) + ' vs ' + face(o) + '</h3>'
            + (g.status === 'playing' ? (g.live ? '<span class="bw-pill" id="bwo-clock">⏱ ' + sec + '</span>' : '<span class="bw-pill">' + Math.min(9, g.hist.length + 1) + '/9</span>') : '')
            + '<span class="bw-pill sc" id="bw-score">คุณ ' + g.sc[me] + ' : ' + g.sc[ot] + '</span><button type="button" class="bw-x" onclick="BWOnline.leave()" aria-label="Back">✕</button></div>';
        var dots = '<div class="bw-dots">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { var r = g.hist[i]; return '<i class="' + (r ? (r.res === 'draw' ? 'draw' : r.res === me ? 'win' : 'lose') + ' ' + r[ot + 'c'] : i === g.hist.length && g.status === 'playing' ? 'now' : '') + '"></i>'; }).join('') + '</div>';
        if (g.status === 'done') return endHtml(g, me, ot, top);
        var h = '<div class="bw">' + top + dots, L = g.hist[g.hist.length - 1];
        if (L) h += '<div class="bw-note" id="bwo-last">ตาที่แล้ว: ' + (L.res === 'draw' ? '🤝 เสมอ' : L.res === me ? '🏆 คุณชนะ' : '😞 ' + esc(o.name) + ' ชนะ') + '</div>';
        h += '<div class="bw-table" id="bw-table">';
        var myT = g.turn === me;
        if (myT && g.lc) h += back(g.lc, 'huge') + '<div class="bw-note" id="bw-say">' + esc(o.name) + ' ลง ' + CE[g.lc] + ' · ตาคุณ</div>';
        else if (myT) h += '<div class="bw-note" id="bw-say">คุณลงก่อน · ' + esc(o.name) + ' จะเห็นแค่สี</div>';
        else h += (hd.pend != null ? t(hd.pend, 'huge') : '') + '<div class="bw-note" id="bw-say">⏳ รอ ' + esc(o.name) + ' ลง' + (hd.pend != null ? ' · เขาเห็นแค่ ' + CE[hd.pend % 2 ? 'w' : 'b'] : 'ก่อน') + '</div>';
        h += '</div>';
        if (myT) {
            h += '<div class="bw-hand" id="bw-hand">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { var used = hd.tiles.indexOf(n) < 0; return '<button type="button" class="' + (n % 2 ? 'w' : 'b') + (used ? ' used' : '') + (st.sel === n ? ' sel' : '') + '" data-n="' + n + '" onclick="BWOnline.pick(' + n + ')"' + (used ? ' disabled' : '') + '>' + n + '</button>'; }).join('') + '</div>'
                + '<button type="button" class="bw-go" id="bw-play" onclick="BWOnline.play()"' + (st.sel == null || st.busy ? ' disabled' : '') + '>▸ ลง' + (st.sel != null ? ' ' + t(st.sel, 'mini') : '') + '</button>';
        } else if (!g.live) {
            var late = g.turnDeadline && Date.now() > g.turnDeadline;
            h += '<div class="bw-act"><button type="button" class="bw-go alt" id="bwo-nudge" onclick="BWOnline.nudge()">📤 สะกิด</button>'
                + (late ? '<button type="button" class="bw-go" id="bwo-claim" onclick="BWOnline.claim()">⏰ เขาเกิน 1 ชม. · รับชนะ</button>' : '') + '</div>';
        }
        if (st.msg) h += '<div class="bwo-err" id="bwo-msg">' + esc(st.msg) + '</div>';
        var lo = g.left[ot]; h += '<div class="bw-bar" id="bw-nb">📓 ' + g.hist.length + ' ตา<span id="bw-left">' + esc(o.name) + ' เหลือ ⚫ ' + lo.b + ' · ⚪ ' + lo.w + '</span></div>';
        return h + '<button type="button" class="bw-x" style="align-self:center;font-size:.8em" onclick="BWOnline.resign()">🏳 ยอมแพ้</button></div>';
    }
    function endHtml(g, me, ot, top) {
        var r = g.result || {}, w = r.winner === 'draw' ? 'draw' : r.winner === me ? 'win' : 'lose';
        var why = r.reason === 'resigned' ? (w === 'win' ? ' · เขายอมแพ้' : ' · คุณยอมแพ้') : r.reason === 'timeout' ? ' · หมดเวลา' : r.reason === 'cancelled' ? ' · ปิดห้อง' : '';
        log(g, me, w);
        return '<div class="bw">' + top + '<div class="bw-res ' + w + '" id="bw-final" style="text-align:center">' + { win: '🏆 คุณชนะ', lose: '😞 แพ้', draw: '🤝 เสมอ' }[w] + why + '</div>'
            + '<div class="bw-cards" id="bw-reveal">' + (r.nums || []).map(function (x, i) { var mine = me === 'a' ? x[0] : x[1], th = me === 'a' ? x[1] : x[0], res = mine > th ? 'win' : mine < th ? 'lose' : 'draw'; return '<div class="bw-card ' + res + '"><span class="d">' + (i + 1) + '</span>' + t(mine, 'mid') + '<small>vs</small>' + t(th, 'mid') + '</div>'; }).join('') + '</div>'
            + '<div class="bw-act"><button type="button" class="bw-go" onclick="BWOnline.leave()">⬅ ห้องอื่น</button></div></div>';
    }
    function log(g, me, w) {
        if (st.seenEnd[st.open] || !window.GameLog) return; st.seenEnd[st.open] = 1;
        try { GameLog.see('bw', { id: st.open, n: g.hist.length, done: true, mode: g.live ? 'live' : 'online', win: w === 'win' ? 'w' : w === 'lose' ? 'l' : 'd', score: g.sc[me] + ':' + g.sc[oth(me)], res: g.hist.map(function (x) { return x.res === 'draw' ? 'draw' : x.res === me ? 'win' : 'lose'; }) }); } catch (e) { }
    }
    function liveTick() {   // 🔢: the clock in the header, and the waiting phone asks the referee when the turn runs out
        clearInterval(st.tick);
        st.tick = setInterval(function () {
            var g = st.room; if (!g || !g.live || g.status !== 'playing') return;
            var c = document.getElementById('bwo-clock'); if (c) c.textContent = '⏱ ' + left();
            if (Date.now() > g.turnDeadline + 800 && g.turn !== seatOf(g) && !st.busy) BWOnline.claim();
        }, 1000);
    }

    /** a Flex card via shareTargetPicker → the OS share sheet → the clipboard */
    function share(alt, title, big, button, uri) {
        var card = { type: 'flex', altText: alt, contents: { type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#14122b', paddingAll: '16px', contents: [{ type: 'text', text: '⚫⚪ ไพ่เงา', color: '#c4b5fd', size: 'xs', weight: 'bold' }, { type: 'text', text: title, color: '#ffffff', size: 'lg', weight: 'bold', wrap: true }] },
            body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: big, size: 'xxl', weight: 'bold', align: 'center' }, { type: 'text', text: '9 ตา · ถึง 5 ก่อนชนะ', size: 'xs', color: '#6b7280', align: 'center' }] },
            footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#6d28d9', height: 'sm', action: { type: 'uri', label: button, uri: uri } }] } } };
        var text = alt + '\n' + uri;
        var viaLine = window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker') ? Promise.resolve(liff.shareTargetPicker([card])).then(function (x) { return x ? 'sent' : 'closed'; }, function () { return null; }) : Promise.resolve(null);
        return viaLine.then(function (x) {
            if (x === 'sent') return true; if (x === 'closed') return false;
            if (navigator.share) return navigator.share({ text: text }).then(function () { return true; }, function () { return false; });
            try { return navigator.clipboard.writeText(text).then(function () { st.msg = '📋 คัดลอกลิงก์แล้ว'; rr(); return true; }, function () { return false; }); } catch (e) { return false; }
        });
    }
    function link(q) { return 'https://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '') + '?bw=' + q; }
    function myName() { var r = st.list[0], s = r && seatOf(r); return (r && s && r.players[s].name) || 'เพื่อน'; }
    function busy(p) { st.busy = true; st.msg = ''; rr(); return p.then(function (x) { st.busy = false; rr(); return x; }, function (e) { st.busy = false; st.msg = msg(e); rr(); return null; }); }

    window.BWOnline = {
        lobbyHtml: lobbyHtml, html: html,
        active: function () { return !!st.open; },
        create: function (live) {
            return busy(call({ action: 'create', live: !!live })).then(function (r) {
                if (!r) return; if (live) { st.waitLive = r.roomId; return; }
                return BWOnline.invite(r.roomId, r.code, r.name);
            });
        },
        invite: function (id, code, name) {
            var x = st.list.filter(function (r) { return r.id === id; })[0]; code = code || (x && x.code);
            name = name || (x && x.players && x.players.a && x.players.a.name) || myName();
            if (!code) return;
            return share('⚫⚪ ' + name + ' ชวนดวลไพ่เงา · รหัส ' + code, name + ' ชวนดวลไพ่เงา 1 : 1', '🔑 ' + code, '▸ รับคำท้า', link(code));
        },
        join: function (code) {
            var el = document.getElementById('bwo-code'); code = String(code || (el && el.value) || '').replace(/\D/g, '');
            if (code.length !== 4) { st.msg = 'ใส่รหัส 4 หลัก'; return rr(); }
            if (!st.uid) { st.pending = code; start(); return; }
            return busy(call({ action: 'join', code: code })).then(function (r) { if (r && r.roomId) BWOnline.open(r.roomId); });
        },
        cancel: function (id) { st.waitLive = null; return busy(call({ action: 'cancel', roomId: id })); },
        open: function (id) {
            BWOnline.close(); st.open = id; st.sel = null; st.msg = ''; st.room = null; st.hand = null;
            st.unRoom = db.collection('rooms').doc(id).onSnapshot(function (s) { st.room = s.exists ? s.data() : null; if (st.room && st.room.status === 'playing' && st.room.turn !== seatOf(st.room)) st.sel = null; rr(); if (window.GameLog && st.room && st.room.status === 'playing') { try { GameLog.see('bw', { id: id, n: st.room.hist.length, done: false, mode: st.room.live ? 'live' : 'online', win: null, score: '', res: [] }); } catch (e) { } } }, function () { st.msg = 'โหลดห้องไม่ได้'; rr(); });
            st.unHand = db.collection('rooms').doc(id).collection('hand').doc(st.uid).onSnapshot(function (s) { st.hand = s.exists ? s.data() : null; rr(); }, function () { });
            liveTick(); rr();
        },
        close: function () { if (st.unRoom) st.unRoom(); if (st.unHand) st.unHand(); st.unRoom = st.unHand = null; clearInterval(st.tick); st.open = null; },
        leave: function () { BWOnline.close(); rr(); },
        pick: function (n) { if (st.hand && st.hand.tiles.indexOf(n) >= 0) { st.sel = n; if (window.BWSound) try { BWSound.play('pick'); } catch (e) { } rr(); } },
        play: function () { if (st.sel == null || !st.open) return; var n = st.sel; return busy(call({ action: 'play', roomId: st.open, n: n })).then(function (r) { if (r) st.sel = null; }); },
        claim: function () { if (!st.open) return; return busy(call({ action: 'claim', roomId: st.open })); },
        resign: function () { if (!st.open || !window.confirm('ยอมแพ้เกมนี้?')) return; return busy(call({ action: 'resign', roomId: st.open })); },
        nudge: function () { var g = st.room; if (!g) return; var me = seatOf(g); return share('⚫⚪ ถึงตาคุณแล้ว · ' + g.players[me].name + ' รออยู่', 'ถึงตาคุณแล้ว', 'คุณ ' + g.sc[oth(me)] + ' : ' + g.sc[me], '▸ ลงไพ่', link('1')); },
        /** ?bw=<4 digits> from an invite card */
        deepLink: function (v) { v = String(v || ''); if (/^\d{4}$/.test(v)) { st.pending = v; if (st.uid) { st.pending = null; BWOnline.join(v); } else start(); } },
        // for scripts/shadow-online-qa.cjs
        _st: function () { return st; }
    };
})();
