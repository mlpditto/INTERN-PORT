/* V101.401 🪞 Memory Fracture with friends (owner 2026-11-28: "เล่นกับเพื่อนพร้อมเดิมพัน" — PR 2 of docs/MEMORY-SPOT-PLAN.md; picks: the
   layout of mock-spot-room/ · 2 players = winner 💎+2, loser 0 · no "found all" bonus in a room · after 📊 the host goes on or the
   room does in 30 s). Drawn inside the Memory Fracture popup (spot.js calls SPOnline.lobbyHtml / html). The referee is roomAct with
   game 'spot' (functions/room-spot.js): this file reads rooms/{id} (seats, the step, the shelf the step allows, who is ready / has
   sent, and at 📊 everyone's result) and rooms/{id}/hand/{my login} (my own bet and answer) and sends create / join / start / ready /
   bet / taps / next / claim / resign / cancel. Everyone walks the same rail 👀 → 🎲 → 🔍 → 📊 on the room's clock; one row of faces
   under it: a green ring + ✓ = ready / has sent. Bets and answers stay hidden until 📊. When the 🔍 time ends my taps go by
   themselves; a waiting phone moves a late room on. 📤 invites in LINE (?spot=<code>). English only. window.SPOnline. */
(function () {
    'use strict';
    var st = { uid: null, list: [], err: '', msg: '', busy: false, open: null, room: null, hand: null, unList: null, unRoom: null, unHand: null, tick: null, pending: null, logged: {}, taps: [], key: '', auto: '' };
    var STEPS = ['look', 'bet', 'find', 'show'];
    function S() { return window.SpotScene; }
    function U() { return (window.SP && SP._ui) || {}; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function rr() { if (window.SP && SP._render) SP._render(); }
    function call(data) { return Promise.resolve(window.ensureAuthLink && ensureAuthLink()).then(function () { return firebase.functions().httpsCallable('roomAct')(Object.assign({ game: 'spot' }, data)); }).then(function (r) { return r.data || {}; }); }
    function msg(e) {
        var c = e && e.details && e.details.code;
        return { 'no-room': 'No open room with that code', full: 'Room full (7)', started: 'Already started', alone: 'Need 1 more player', early: 'There is still time', 'bad-bet': 'Pick a bet you can pay', 'bad-taps': 'Tap slots on the shelf', sent: 'Already sent', 'not-now': 'Too late for that', 'not-host': 'Only the host does that', left: 'You left this game' }[c]
            || (e && e.code === 'permission-denied' ? 'Open the app in LINE first' : 'Failed · try again');
    }
    function face(p, sz) { sz = sz || 26; if (p && p.px && window.PixelAvatar && PixelAvatar.ok(p.px)) return PixelAvatar.face(p.px, sz, 'spo-av'); return p && p.pic ? '<img class="spo-av" style="width:' + sz + 'px;height:' + sz + 'px" src="' + esc(p.pic) + '" alt="" referrerpolicy="no-referrer">' : '<span class="spo-av" style="width:' + sz + 'px;height:' + sz + 'px">' + esc(((p && p.name) || '?').slice(0, 1)) + '</span>'; }
    function name(g, u) { return u === st.uid ? 'You' : esc((g.players[u] || {}).name || '?'); }
    function fmt(n) { return String(Math.round(n * 10) / 10); }
    function css() {
        if (document.getElementById('spo-css')) return;
        var s = document.createElement('style'); s.id = 'spo-css';
        s.textContent = '#spModal .spo-av{border-radius:50%;object-fit:cover;background:#ede9fe;color:#5b21b6;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex:none;overflow:hidden}'
            + '#spModal .spo-row{display:flex;gap:4px;justify-content:center;flex-wrap:wrap}'
            + '#spModal .spo-f{display:flex;flex-direction:column;align-items:center;min-width:40px;max-width:58px;font-size:.66em;font-weight:800;line-height:1.2;color:#0f172a}#spModal .spo-f.me .nm{color:#6d28d9}#spModal .spo-f.out{opacity:.4}'
            + '#spModal .spo-f .nm{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#spModal .spo-f small{color:#64748b;font-weight:800;white-space:nowrap}'
            + '#spModal .spo-fr{position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #ddd6fe}#spModal .spo-f.ok .spo-fr{border-color:#16a34a}'
            + '#spModal .spo-f.ok .spo-fr::after{content:"✓";position:absolute;right:-5px;bottom:-5px;width:15px;height:15px;border-radius:50%;background:#16a34a;color:#fff;font:900 10px/15px Arial,sans-serif;text-align:center}'
            + '#spModal .spo-pill{border:1px solid #ddd6fe;background:#fff;color:#5b21b6;border-radius:999px;padding:3px 9px;font-size:.78em;font-weight:800;white-space:nowrap}'
            + '#spModal .spo-room{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;background:#fff;text-align:left;width:100%;font-weight:800;font-size:.9em;color:#0f172a}#spModal .spo-room small{display:block;font-weight:600;color:#64748b;font-size:.8em}#spModal .spo-room .go{margin-left:auto;color:#6d28d9;white-space:nowrap}#spModal .spo-room .wait{margin-left:auto;color:#64748b;white-space:nowrap}'
            + '#spModal .spo-code{display:flex;gap:6px;justify-content:center}#spModal .spo-code span{width:44px;height:52px;border-radius:12px;background:#f5f3ff;border:1px solid #ddd6fe;color:#6d28d9;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center}'
            + '#spModal .spo-join{display:flex;gap:6px}#spModal .spo-join input{flex:1;min-width:0;font-size:16px;font-weight:900;text-align:center;letter-spacing:4px;border:2px solid #ddd6fe;border-radius:12px;padding:8px}#spModal .spo-join input::placeholder{letter-spacing:normal}'
            + '#spModal .spo-err{color:#b91c1c;font-weight:800;text-align:center;font-size:.85em}#spModal .spo-k{font-size:.8em;color:#475569;text-align:center;font-weight:800}'
            + '#spModal .spo-rank{display:flex;flex-direction:column;gap:4px}#spModal .spo-rank>div{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:12px;background:#f8fafc;font-size:.86em;font-weight:800}#spModal .spo-rank>div.me{background:#f5f3ff}'
            + '#spModal .spo-rank .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#spModal .spo-rank small{color:#64748b;font-weight:700;white-space:nowrap}#spModal .spo-rank b.g{color:#16a34a}#spModal .spo-rank b.r{color:#dc2626}'
            + '#spModal .spo .sp-pic svg{max-height:calc(100dvh - 296px)}#spModal .spo .sp-gone svg{max-height:calc(100dvh - 322px)}#spModal .spo .sp-small svg{max-height:30dvh}';   /* the faces row and 🏳 take about 100 px of the timed steps */
        document.head.appendChild(s);
    }
    function start() {
        if (st.unList || st.tried) return;
        st.tried = true;
        Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(function () {
            var u = window.firebase && firebase.auth && firebase.auth().currentUser; st.uid = u && u.uid;
            if (!st.uid || typeof db === 'undefined') { st.err = 'Open in LINE to play with friends'; st.tried = false; return rr(); }
            st.unList = db.collection('rooms').where('authUids', 'array-contains', st.uid).onSnapshot(function (s) {
                st.list = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (x) { return x.game === 'spot'; });
                if (st.pending) { var c = st.pending; st.pending = null; SPOnline.join(c); }
                rr();
            }, function () { st.err = 'Could not load rooms'; rr(); });
            rr();
        }).catch(function () { st.err = 'Open in LINE to play with friends'; st.tried = false; rr(); });
    }
    function busy(p) { st.busy = true; st.msg = ''; rr(); return p.then(function (x) { st.busy = false; rr(); return x; }, function (e) { st.busy = false; st.msg = msg(e); rr(); return null; }); }
    function note() { return st.msg ? '<div class="' + (/^📋/.test(st.msg) ? 'sp-note' : 'spo-err') + '" id="spo-msg">' + esc(st.msg) + '</div>' : ''; }
    function seatOf(g, u) { return (g.order || []).indexOf(u); }
    function playing(G) { return G.gem.map(function (x, s) { return s; }).filter(function (s) { return !G.out[s]; }); }
    function left() { var g = st.room; return g && g.turnDeadline ? Math.max(0, Math.ceil((g.turnDeadline - Date.now()) / 1000)) : 0; }
    /** does the room wait on me in this step? */
    function mine(g) {
        var G = g.g, s = seatOf(g, st.uid); if (!G || s < 0 || G.out[s]) return false;
        return G.phase === 'look' ? !G.ready[s] : G.phase === 'bet' || G.phase === 'find' ? !G.sent[s] : false;
    }

    /** the rooms list + ＋ New room + join by code (inside the Memory Fracture lobby, under 🌐 Friends) */
    function lobbyHtml() {
        css(); start();
        var h = st.err ? '<div class="spo-err">' + esc(st.err) + '</div>' : '';
        h += note();
        st.list.filter(function (x) { return x.status === 'playing' || x.status === 'lobby'; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }).forEach(function (x) {
            h += '<button type="button" class="spo-room" data-room="' + x.id + '" onclick="SPOnline.open(\'' + x.id + '\')">🪞 ' + (x.status === 'lobby' ? '🔑 ' + x.code : '👥 ' + x.order.length) + '<small>' + x.order.map(function (u) { return name(x, u); }).join(' · ') + '</small>'
                + (x.status === 'lobby' ? '<span class="wait">Waiting…</span>' : '<b class="go">▶ Round ' + ((x.g && x.g.round) || 1) + '/' + x.rounds + '</b>') + '</button>';
        });
        return h + '<button type="button" class="sp-go" id="spo-new" onclick="SPOnline.create()"' + (st.busy ? ' disabled' : '') + '>＋ New room · ⚡ live</button>'
            + '<div class="spo-join"><input id="spo-code" inputmode="numeric" maxlength="4" placeholder="Room code" aria-label="Room code"><button type="button" class="sp-go alt" style="flex:none" id="spo-join" onclick="SPOnline.join()">Join</button></div>';
    }
    /** the faces: a green ring + ✓ on everyone who is ready / has sent in this step */
    function rowHtml(g) {
        var G = g.g, done = G.phase === 'look' ? G.ready : G.phase === 'show' ? {} : G.sent;
        return '<div class="spo-row" id="spo-row">' + g.order.map(function (u, s) {
            return '<div class="spo-f' + (u === st.uid ? ' me' : '') + (G.out[s] ? ' out' : done[s] ? ' ok' : '') + '" data-seat="' + s + '"><div class="spo-fr">' + face(g.players[u], 26) + '</div><span class="nm">' + name(g, u) + '</span><small>' + (G.out[s] ? '🏳' : '💎 ' + G.gem[s]) + '</small></div>';
        }).join('') + '</div>';
    }
    function head(g) {
        var G = g.g, me = seatOf(g, st.uid);
        return '<div class="sp-top"><h3 id="spo-round">🪞 Round ' + G.round + '/' + G.rounds + '</h3><span class="sp-pill" id="spo-gem">💎 ' + (me >= 0 ? G.gem[me] : 0) + '</span>'
            + '<button type="button" class="sp-x" onclick="SPOnline.leave()" aria-label="Back">✕</button></div>';
    }
    function html() {
        css();
        var g = st.room, X = '<button type="button" class="sp-x" onclick="SPOnline.leave()" aria-label="Back">✕</button>';
        if (!g) return '<div class="sp"><div class="sp-note">Loading…</div></div>';
        if (g.status === 'lobby') {
            var host = g.creatorAuth === st.uid, n = g.order.length;
            return '<div class="sp spo"><div class="sp-top"><h3>🪞 Room</h3>' + (host ? '<button type="button" class="spo-pill" id="spo-invite" onclick="SPOnline.invite()">📤 Invite</button>' : '') + X + '</div>'
                + '<div class="spo-code" id="spo-roomcode">' + g.code.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>'
                + '<div class="spo-row" id="spo-seats">' + g.order.map(function (u) { return '<div class="spo-f ok' + (u === st.uid ? ' me' : '') + '"><div class="spo-fr">' + face(g.players[u], 26) + '</div><span class="nm">' + name(g, u) + '</span><small>' + (u === g.creatorAuth ? 'host' : '✓') + '</small></div>'; }).join('') + '</div>'
                + '<div class="spo-k" id="spo-key">' + '🥄'.repeat(g.level) + ' · ' + g.rounds + ' rounds · 💎 3 each · 2–7 players</div>' + note()
                + (host ? '<button type="button" class="sp-go" id="spo-start" onclick="SPOnline.startGame()"' + (n < 2 || st.busy ? ' disabled' : '') + '>▸ Start · ' + (n < 2 ? 'needs 2' : n) + '</button>'
                    + '<button type="button" class="sp-x" style="align-self:center;font-size:.8em" onclick="SPOnline.cancel()">✕ Close room</button>' : '<div class="sp-note">⏳ Waiting for the host</div>') + '</div>';
        }
        if (g.status === 'done') return endHtml(g, X);
        if (!g.g) return '<div class="sp"><div class="sp-note">Loading…</div></div>';
        var G = g.g, me = seatOf(g, st.uid), sc = { cols: G.cols, rows: G.rows, orig: G.orig || [], changed: G.changed || [], diffs: G.diffs || [] }, k = STEPS.indexOf(G.phase);
        var h = '<div class="sp spo">' + head(g) + U().rail(k, left()) + rowHtml(g), bye = '<button type="button" class="sp-x" id="spo-resign" style="align-self:center;font-size:.8em" onclick="SPOnline.resign()">🏳 Leave game</button>';
        var hd = st.hand && st.hand.round === G.round ? st.hand : null, out = me < 0 || G.out[me];
        if (G.phase === 'look') {
            var nr = playing(G).filter(function (s) { return G.ready[s]; }).length, ready = out || G.ready[me];
            return h + '<div class="sp-pic">' + S().draw(sc, 'orig') + '</div><button type="button" class="sp-go' + (ready ? ' alt' : '') + '" id="spo-ready" onclick="SPOnline.ready()"' + (ready || st.busy ? ' disabled' : '') + '>✓ Ready · ' + nr + '/' + playing(G).length + '</button>' + note() + bye + '</div>';
        }
        if (G.phase === 'bet') {
            var my = hd && hd.bet, sent = out || G.sent[me];
            return h + '<div class="sp-pic sp-gone" aria-hidden="true">' + S().draw(sc, 'orig') + '<span>🫥</span></div>'
                + '<div class="sp-bets" role="group" aria-label="Bet">' + [[1, 'free'], [1.5, '💎1'], [2, '💎2']].map(function (b) {
                    var can = !sent && !st.busy && S().BETS[b[0]] <= G.gem[me];
                    return '<button type="button" class="sp-bet' + (sent && my === b[0] ? ' on' : '') + '" id="spo-bet-' + String(b[0]).replace('.', '') + '"' + (can ? '' : ' disabled') + ' onclick="SPOnline.bet(' + b[0] + ')">×' + b[0] + '<small>' + b[1] + '</small></button>';
                }).join('') + '</div><div class="spo-k" id="spo-betnote">' + (sent && my ? '🔒 ×' + my + ' is in · hidden until 📊' : '🔒 Your bet is hidden until 📊') + '</div>' + note() + bye + '</div>';
        }
        if (G.phase === 'find') {
            var done = out || G.sent[me], taps = done ? ((hd && hd.taps) || []) : st.taps, dots = '';
            for (var i = 0; i < G.max; i++) dots += '<i class="' + (i < taps.length ? 'u' : '') + '"></i>';
            var waiting = playing(G).filter(function (s) { return !G.sent[s]; }).length;
            return h + '<div class="sp-pic" id="spo-find"' + (done ? '' : ' onclick="SPOnline.hit(event)"') + '>' + S().draw(sc, 'changed', taps.map(function (t) { return { k: t, t: 'tap' }; })) + '</div>'
                + (done ? '<div class="spo-k" id="spo-sent">🔒 Sent · waiting for ' + waiting + '</div>' : '<div class="sp-row"><div class="sp-taps" id="spo-taps" aria-label="Taps">' + dots + '</div><button type="button" class="sp-go" id="spo-done" onclick="SPOnline.done()"' + (st.busy ? ' disabled' : '') + '>✓ Done</button></div>')
                + note() + bye + '</div>';
        }
        // 📊 the round's result
        var res = G.res || [], r = res[me], marks = [], host2 = g.creatorAuth === st.uid;
        if (r) { G.diffs.forEach(function (d, i) { d.cells.forEach(function (c) { marks.push({ k: c, t: r.found[i] ? 'ok' : 'miss' }); }); }); r.wrong.forEach(function (c) { marks.push({ k: c, t: 'no' }); }); }
        else G.diffs.forEach(function (d) { d.cells.forEach(function (c) { marks.push({ k: c, t: 'miss' }); }); });
        var order = playing(G).sort(function (a, b) { return res[b].pts - res[a].pts || a - b; });
        var rank = order.map(function (s) {
            var x = res[s], u = g.order[s];
            return '<div class="' + (u === st.uid ? 'me' : '') + '" data-seat="' + s + '"><b>' + (['🥇', '🥈', '🥉'][x.rank - 1] || x.rank) + '</b>' + face(g.players[u], 22) + '<span class="nm">' + name(g, u) + '</span><small>✅' + x.n + (x.wrong.length ? ' ❌' + x.wrong.length : '') + ' ×' + x.bet + '</small><b>' + fmt(x.pts) + '</b>'
                + (x.gem ? '<b class="' + (x.gem > 0 ? 'g' : 'r') + '">💎' + (x.gem > 0 ? '+' : '−') + Math.abs(x.gem) + '</b>' : '') + '</div>';
        }).join('');
        var list = G.diffs.map(function (d, i) { var f = r && r.found[i]; return '<div class="' + (f ? 'ok' : '') + '"><span>' + (f ? '✅' : '◌') + '</span>' + d.say + '</div>'; }).join('');
        return h + '<div class="sp-pic sp-small">' + S().draw(sc, 'changed', marks) + '</div><div class="spo-rank" id="spo-rank">' + rank + '</div><div class="sp-list" id="spo-list">' + list + '</div>' + note()
            + (host2 ? '<button type="button" class="sp-go" id="spo-next" onclick="SPOnline.next()"' + (st.busy ? ' disabled' : '') + '>' + (G.round < G.rounds ? '▸ Round ' + (G.round + 1) : '▸ Result') + '</button>' : '<div class="sp-note" id="spo-wait">⏳ ' + (G.round < G.rounds ? 'Round ' + (G.round + 1) : 'The result') + ' comes next</div>') + bye + '</div>';
    }
    function endHtml(g, X) {
        var r = g.result || {};
        if (r.reason === 'cancelled') return '<div class="sp"><div class="sp-top"><h3>🪞 Room closed</h3>' + X + '</div><button type="button" class="sp-go" onclick="SPOnline.leave()">⬅ Rooms</button></div>';
        var G = g.g, me = seatOf(g, st.uid), rank = r.rank || [];
        if (!st.logged[st.open] && window.GameLog && G && me >= 0) {
            st.logged[st.open] = 1;
            try { GameLog.see('spot', { id: st.open, n: G.round, done: true, mode: 'live', win: rank[0] === st.uid ? 'w' : 'l', score: fmt(G.pts[me]), res: [] }); } catch (e) { }
        }
        return '<div class="sp spo"><div class="sp-top"><h3>🪞 Game over</h3>' + X + '</div>'
            + '<div class="sp-big" id="spo-final">' + (rank[0] === st.uid ? '🏆 You win' : '🏆 ' + name(g, rank[0])) + '</div>'
            + '<div class="spo-rank" id="spo-end">' + rank.map(function (u, i) { var s = seatOf(g, u); return '<div class="' + (u === st.uid ? 'me' : '') + '"><b>' + (G.out[s] ? '🏳' : ['🥇', '🥈', '🥉'][i] || i + 1) + '</b>' + face(g.players[u], 22) + '<span class="nm">' + name(g, u) + '</span><small>⭐ ' + fmt(G.pts[s]) + '</small><b>💎 ' + G.gem[s] + '</b></div>'; }).join('') + '</div>'
            + '<button type="button" class="sp-go" onclick="SPOnline.leave()">⬅ Rooms</button></div>';
    }
    /** once a second: the number on the rail; my taps go when the 🔍 time ends; a waiting phone moves a late room on */
    function tick() {
        clearInterval(st.tick);
        st.tick = setInterval(function () {
            var g = st.room; if (!g || g.status !== 'playing' || !g.g || !g.turnDeadline) return;
            var el = document.getElementById('sp-left'); if (el) el.textContent = left();
            var G = g.g, over = Date.now() - g.turnDeadline, key = G.round + ':' + G.phase, me = seatOf(g, st.uid);
            if (over < 0 || st.busy) return;
            if (G.phase === 'find' && me >= 0 && !G.out[me] && !G.sent[me] && st.auto !== key) { st.auto = key; SPOnline.done(); return; }
            if (over > 1500 + 700 * Math.max(0, me) && !st.claiming) { st.claiming = true; call({ action: 'claim', roomId: st.open }).then(function () { st.claiming = false; }, function () { st.claiming = false; }); }
        }, 500);
    }
    function share(alt, title, big, button, uri) {
        var card = { type: 'flex', altText: alt, contents: { type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#6d28d9', paddingAll: '16px', contents: [{ type: 'text', text: '🪞 Memory Fracture', color: '#ede9fe', size: 'xs', weight: 'bold' }, { type: 'text', text: title, color: '#ffffff', size: 'lg', weight: 'bold', wrap: true }] },
            body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: big, size: 'xxl', weight: 'bold', align: 'center' }, { type: 'text', text: 'Remember the shelf · spot the changes · bet 💎', size: 'xs', color: '#6b7280', align: 'center', wrap: true }] },
            footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#6d28d9', height: 'sm', action: { type: 'uri', label: button, uri: uri } }] } } };
        var text = alt + '\n' + uri;
        var viaLine = window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker') && (!liff.isLoggedIn || liff.isLoggedIn()) ? Promise.resolve(liff.shareTargetPicker([card])).then(function (x) { return x ? 'sent' : 'closed'; }, function () { return null; }) : Promise.resolve(null);
        return viaLine.then(function (x) {
            if (x === 'sent' || x === 'closed') return x === 'sent';
            if (navigator.share) return navigator.share({ text: text }).then(function () { return true; }, function () { return false; });
            try { return navigator.clipboard.writeText(text).then(function () { st.msg = '📋 Link copied'; rr(); return true; }, function () { return false; }); } catch (e) { return false; }
        });
    }
    function link(q) { return 'https://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '') + '?spot=' + q; }
    function cue(k) { if (U().cue) U().cue(k); }

    window.SPOnline = {
        lobbyHtml: lobbyHtml, html: html,
        active: function () { return !!st.open; },
        create: function () { return busy(call({ action: 'create', level: U().level ? U().level() : 2 })).then(function (r) { if (r && r.roomId) SPOnline.open(r.roomId); }); },
        join: function (code) {
            var el = document.getElementById('spo-code'); code = String(code || (el && el.value) || '').replace(/\D/g, '');
            if (code.length !== 4) { st.msg = 'Enter the 4-digit code'; return rr(); }
            if (!st.uid) { st.pending = code; start(); return; }
            return busy(call({ action: 'join', code: code })).then(function (r) { if (r && r.roomId) SPOnline.open(r.roomId); });
        },
        open: function (id) {
            SPOnline.close(); st.open = id; st.room = null; st.hand = null; st.msg = ''; st.taps = []; st.key = ''; st.auto = '';
            st.unRoom = db.collection('rooms').doc(id).onSnapshot(function (s) {
                st.room = s.exists ? s.data() : null;
                var G = st.room && st.room.g, key = G ? G.round + ':' + G.phase : '';
                if (key !== st.key) { if (st.key) cue(G && G.phase === 'bet' ? 'gone' : G && G.phase === 'show' ? 'ok' : 'go'); st.key = key; st.taps = []; st.msg = ''; }   // a new step: my taps start empty
                rr();
            }, function () { st.msg = 'Could not load the room'; rr(); });
            st.unHand = db.collection('rooms').doc(id).collection('hand').doc(st.uid).onSnapshot(function (s) { st.hand = s.exists ? s.data() : null; rr(); }, function () { });
            tick(); rr();
        },
        close: function () { if (st.unRoom) st.unRoom(); if (st.unHand) st.unHand(); st.unRoom = st.unHand = null; clearInterval(st.tick); st.open = null; },
        leave: function () { SPOnline.close(); rr(); },
        invite: function () { var g = st.room; if (!g) return; var nm = (g.players[g.creatorAuth] || {}).name || 'A friend'; return share('🪞 ' + nm + ' invites you to Memory Fracture · code ' + g.code, nm + ' invites you', '🔑 ' + g.code, '▸ Join', link(g.code)); },
        startGame: function () { return busy(call({ action: 'start', roomId: st.open })); },
        cancel: function () { return busy(call({ action: 'cancel', roomId: st.open })); },
        ready: function () { return busy(call({ action: 'ready', roomId: st.open })); },
        bet: function (b) { return busy(call({ action: 'bet', roomId: st.open, bet: b })); },
        hit: function (e) { var c = e && e.target && e.target.closest && e.target.closest('.sp-cell'); if (c) SPOnline.tap(+c.getAttribute('data-k')); },
        tap: function (k) {
            var g = st.room, G = g && g.g; if (!G || G.phase !== 'find' || !mine(g)) return;
            var i = st.taps.indexOf(k);
            if (i >= 0) st.taps.splice(i, 1); else if (st.taps.length < G.max) st.taps.push(k); else return;
            rr();
        },
        done: function () { var g = st.room, G = g && g.g; if (!G || G.phase !== 'find' || !mine(g)) return; return busy(call({ action: 'taps', roomId: st.open, taps: st.taps.slice() })); },
        next: function () { return busy(call({ action: 'next', roomId: st.open })); },
        resign: function () { if (!st.open || !window.confirm('Leave this game? Your seat stays empty.')) return; return busy(call({ action: 'resign', roomId: st.open })); },
        deepLink: function (v) { v = String(v || ''); if (/^\d{4}$/.test(v)) { if (st.uid) SPOnline.join(v); else { st.pending = v; start(); } } },
        _st: function () { return st; }
    };
})();
