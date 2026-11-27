/* V101.389 🪨 Carry 13 online (owner 2026-11-27: PR 2 of docs/MIND-GAMES-PLAN.md §8 · pick ค = live rooms only, ⚡ 60 s a pick / a turn ·
   layout B, mockup-rock13-online/rock13-online-ABC.png = the look of the live เลขลับ room). Drawn inside the Carry 13 popup (rock13.js
   calls R13Online.lobbyHtml / html). The referee is roomAct with game 'rock13' (functions/room-rock13.js): this file reads rooms/{id}
   (seats, carriers, who has sent, the queue once the picks show) and rooms/{id}/hand/{my login} (my own pick) and sends create / join /
   start / pick / place / pass / claim / resign / cancel. One row of faces: in the secret pick a ring round everyone still picking, then
   the faces in placing order with chip + card, the ring round the one placing. 👉 Your turn pulses; 👋 Nudge for the others, ⏭ Skip
   once late (a waiting phone also skips by itself). 📤 invites in LINE (?r13=<code>). English only. window.R13Online. */
(function () {
    'use strict';
    var st = { uid: null, list: [], err: '', msg: '', busy: false, open: null, room: null, hand: null, unList: null, unRoom: null, unHand: null, tick: null, pending: null, logged: {}, pick: { card: null, chip: null } };
    var LIVE_MS = 60 * 1000, CH = { r: '🔴', g: '🟢', b: '🔵', w: '🌈' };
    function R() { return window.Rock13Rules; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function rr() { if (window.R13 && R13._render) R13._render(); }
    function call(data) { return Promise.resolve(window.ensureAuthLink && ensureAuthLink()).then(function () { return firebase.functions().httpsCallable('roomAct')(Object.assign({ game: 'rock13' }, data)); }).then(function (r) { return r.data || {}; }); }
    function msg(e) {
        var c = e && e.details && e.details.code;
        return { 'no-room': 'No open room with that code', full: 'Room full (7)', started: 'Already started', 'not-your-turn': 'Not your turn', alone: 'Need 1 more player', early: 'They still have time', 'bad-pick': 'Pick a card and a chip', 'no-pass': 'You cannot pass now', 'bad-place': 'Tap a carrier' }[c]
            || (e && e.code === 'permission-denied' ? 'Open the app in LINE first' : 'Failed · try again');
    }
    function face(p, sz) { sz = sz || 24; return p && p.pic ? '<img class="r13o-av" style="width:' + sz + 'px;height:' + sz + 'px" src="' + esc(p.pic) + '" alt="" referrerpolicy="no-referrer">' : '<span class="r13o-av" style="width:' + sz + 'px;height:' + sz + 'px">' + (p && p.bot ? '🤖' : esc(((p && p.name) || '?').slice(0, 1))) + '</span>'; }
    function name(g, u) { return u === st.uid ? 'You' : esc((g.players[u] || {}).name || '?'); }
    function css() {
        if (document.getElementById('r13o-css')) return;
        var s = document.createElement('style'); s.id = 'r13o-css';
        s.textContent = '#r13Modal .r13o-av{border-radius:50%;object-fit:cover;background:#fde68a;color:#78350f;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex:none}'
            + '#r13Modal .r13o-row{display:flex;gap:4px;justify-content:center;align-items:flex-start;flex-wrap:wrap}'
            + '#r13Modal .r13o-f{display:flex;flex-direction:column;align-items:center;min-width:36px;max-width:56px;font-size:.66em;font-weight:800;line-height:1.15}#r13Modal .r13o-f.done{opacity:.45}#r13Modal .r13o-f.me .nm{color:#b45309}'
            + '#r13Modal .r13o-f .nm{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#r13Modal .r13o-f small{color:#64748b;font-weight:700;white-space:nowrap}#r13Modal .r13o-f small b{color:#16a34a}'
            + '#r13Modal .r13o-fr{position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center}#r13Modal .r13o-fr svg{position:absolute;inset:0;width:32px;height:32px;transform:rotate(-90deg)}#r13Modal .r13o-fr svg circle{fill:none;stroke-width:3.5}'
            + '#r13Modal .r13-top h3.r13o-mine{color:#b45309;animation:r13oPop 1.6s ease-in-out infinite}@keyframes r13oPop{50%{transform:scale(1.04)}}@media (prefers-reduced-motion:reduce){#r13Modal .r13-top h3.r13o-mine{animation:none}}'
            + '#r13Modal .r13o-pill{border:1px solid #fcd34d;background:#fff;color:#78350f;border-radius:999px;padding:3px 9px;font-size:.78em;font-weight:800;white-space:nowrap}'
            + '#r13Modal .r13o-room{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;background:#fff;text-align:left;width:100%;font-weight:800;font-size:.9em}#r13Modal .r13o-room small{display:block;font-weight:600;color:#64748b;font-size:.8em}#r13Modal .r13o-room .go{margin-left:auto;color:#b45309;white-space:nowrap}#r13Modal .r13o-room .wait{margin-left:auto;color:#64748b;white-space:nowrap}'
            + '#r13Modal .r13o-code{display:flex;gap:6px;justify-content:center}#r13Modal .r13o-code span{width:44px;height:52px;border-radius:12px;background:#fffbeb;border:1px solid #fcd34d;color:#b45309;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center}'
            + '#r13Modal .r13o-join{display:flex;gap:6px}#r13Modal .r13o-join input{flex:1;min-width:0;font-size:16px;font-weight:900;text-align:center;letter-spacing:4px;border:2px solid #fcd34d;border-radius:12px;padding:8px}#r13Modal .r13o-join input::placeholder{letter-spacing:normal}'
            + '#r13Modal .r13o-err{color:#b91c1c;font-weight:800;text-align:center;font-size:.85em}#r13Modal .r13o-k{font-size:.8em;color:#475569;text-align:center;font-weight:800}';
        document.head.appendChild(s);
    }
    function start() {
        if (st.unList || st.tried) return;
        st.tried = true;
        Promise.resolve(typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : null).then(function () {
            var u = window.firebase && firebase.auth && firebase.auth().currentUser; st.uid = u && u.uid;
            if (!st.uid || typeof db === 'undefined') { st.err = 'Open in LINE to play with friends'; st.tried = false; return rr(); }
            st.unList = db.collection('rooms').where('authUids', 'array-contains', st.uid).onSnapshot(function (s) {
                st.list = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (x) { return x.game === 'rock13'; });
                if (st.pending) { var c = st.pending; st.pending = null; R13Online.join(c); }
                rr();
            }, function () { st.err = 'Could not load rooms'; rr(); });
            rr();
        }).catch(function () { st.err = 'Open in LINE to play with friends'; st.tried = false; rr(); });
    }
    function busy(p) { st.busy = true; st.msg = ''; rr(); return p.then(function (x) { st.busy = false; rr(); return x; }, function (e) { st.busy = false; st.msg = msg(e); rr(); return null; }); }
    function note() { return st.msg ? '<div class="' + (/^📋/.test(st.msg) ? 'r13-note' : 'r13o-err') + '" id="r13o-msg">' + esc(st.msg) + '</div>' : ''; }

    /** the rooms list + ＋ New room + join by code (inside the Carry 13 lobby, under 🌐 With friends) */
    function lobbyHtml() {
        css(); start();
        var h = st.err ? '<div class="r13o-err">' + esc(st.err) + '</div>' : '';
        h += note();
        st.list.filter(function (x) { return x.status === 'playing' || x.status === 'lobby'; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }).forEach(function (x) {
            var mine = x.status === 'playing' && waitsOnMe(x);
            h += '<button type="button" class="r13o-room" data-room="' + x.id + '" onclick="R13Online.open(\'' + x.id + '\')">🪨 ' + (x.status === 'lobby' ? '🔑 ' + x.code : '👥 ' + x.order.length) + '<small>' + x.order.map(function (u) { return name(x, u); }).join(' · ') + '</small>'
                + (x.status === 'lobby' ? '<span class="wait">Waiting…</span>' : mine ? '<b class="go">▶ Your turn</b>' : '<span class="wait">⏳ ' + (x.g && x.g.round) + '/' + x.rounds + '</span>') + '</button>';
        });
        return h + '<button type="button" class="r13-go" id="r13o-new" onclick="R13Online.create()"' + (st.busy ? ' disabled' : '') + '>＋ New room · ⚡ 60 s</button>'
            + '<div class="r13o-join"><input id="r13o-code" inputmode="numeric" maxlength="4" placeholder="Room code" aria-label="Room code"><button type="button" class="r13-go alt" style="flex:none" id="r13o-join" onclick="R13Online.join()">Join</button></div>';
    }
    function seatOf(g, u) { return (g.order || []).indexOf(u); }
    function waitsOnMe(g) {
        var G = g.g, s = seatOf(g, st.uid); if (!G || s < 0) return false;
        return G.phase === 'submit' ? !G.sent[s] && !(G.players[s] || {}).bot : G.phase === 'place' && R() && R().turn(G) === s;
    }
    function pct() { var g = st.room; return g && g.turnDeadline ? Math.max(0, Math.min(100, Math.round(100 * (g.turnDeadline - Date.now()) / LIVE_MS))) : 0; }
    function ring() { return '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" stroke="#fde68a"/><circle class="r13o-ring" cx="18" cy="18" r="16" stroke="#f59e0b" pathLength="100" stroke-dasharray="' + pct() + ' 100"/></svg>'; }
    function faceCell(g, u, s, o) {
        var G = g.g, p = G.players[s];
        return '<div class="r13o-f' + (u === st.uid ? ' me' : '') + (o.done ? ' done' : '') + '" data-seat="' + s + '"><div class="r13o-fr">' + (o.ring ? ring() : '') + face(Object.assign({}, g.players[u], { bot: p.bot }), 24) + '</div>'
            + '<span class="nm">' + (s === G.first ? '👑' : '') + name(g, u) + '</span><small>' + (o.sub ? o.sub + ' ' : '') + '🪨' + p.pen + '</small></div>';
    }
    /** the faces: while picking in seat order (ring = still picking), then in placing order (ring = placing now) */
    function rowHtml(g) {
        var G = g.g, h = '';
        if (G.phase === 'submit') h = g.order.map(function (u, s) { var sent = !!G.sent[s]; return faceCell(g, u, s, { ring: !sent, sub: '' }); }).join('');
        else {
            var done = [], t = R().turn(G);
            G.log.forEach(function (x) { if (x.r === G.round && x.k === 'place') done.push(x.s); });
            h = done.concat(G.main).concat(G.passed.slice().reverse()).map(function (s) {
                var sb = G.subs[s] || {}; return faceCell(g, g.order[s], s, { ring: s === t, done: done.indexOf(s) >= 0, sub: (G.passed.indexOf(s) >= 0 ? '⏭' : '') + (CH[sb.chip] || '') + sb.card });
            }).join('');
        }
        return '<div class="r13o-row" id="r13o-row">' + h + '</div>';
    }
    function lastLine(g) {
        var G = g.g, L = G.log[G.log.length - 1]; if (!L) return '';
        var who = name(g, g.order[L.s]);
        // V101.390 a turn the clock played (newest of this round) says so once; else only 💥
        var auto = G.log.filter(function (x) { return x.r === G.round && x.auto; }).slice(-1)[0];
        if (auto && G.log.indexOf(auto) >= G.log.length - 3) return '<span style="color:#b45309">⏱ ' + name(g, g.order[auto.s]) + ' ran out · placed ' + auto.card + ' → ' + CH[auto.st] + '</span>';
        return L.k === 'place' && L.take ? '💥 ' + who + ' took 🪨 ' + L.take : '';
    }
    function html() {
        css();
        var g = st.room, X = '<button type="button" class="r13-x" onclick="R13Online.leave()" aria-label="Back">✕</button>';
        if (!g) return '<div class="r13"><div class="r13-note">Loading…</div></div>';
        if (g.status === 'lobby') {
            var host = g.creatorAuth === st.uid, n = g.order.length, bots = Math.max(0, 3 - n);
            return '<div class="r13"><div class="r13-top"><h3>🪨 Room</h3>' + (host ? '<button type="button" class="r13o-pill" id="r13o-invite" onclick="R13Online.invite()">📤 Invite</button>' : '') + X + '</div>'
                + '<div class="r13o-code" id="r13o-roomcode">' + g.code.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>'
                + '<div class="r13o-row" id="r13o-seats">' + g.order.map(function (u) { return '<div class="r13o-f' + (u === st.uid ? ' me' : '') + '"><div class="r13o-fr">' + face(g.players[u], 24) + '</div><span class="nm">' + name(g, u) + '</span><small>' + (u === g.creatorAuth ? 'host' : '✓') + '</small></div>'; }).join('')
                + (bots ? '<div class="r13o-f" style="opacity:.5"><div class="r13o-fr">' + face({ bot: true }, 24) + '</div><span class="nm">🤖' + (bots > 1 ? ' ×' + bots : '') + '</span><small>fills</small></div>' : '') + '</div>'
                + '<div class="r13o-k">' + g.rounds + ' rounds · ⚡ 60 s</div>' + note()
                + (host ? '<button type="button" class="r13-go" id="r13o-start" onclick="R13Online.startGame()"' + (n < 2 || st.busy ? ' disabled' : '') + '>▸ Start · ' + (n < 2 ? 'needs 2' : n + bots) + '</button>'
                    + '<button type="button" class="r13-x" style="align-self:center;font-size:.8em" onclick="R13Online.cancel()">✕ Close room</button>' : '<div class="r13-note">⏳ Waiting for the host</div>') + '</div>';
        }
        if (!g.g) return '<div class="r13"><div class="r13-note">Loading…</div></div>';
        if (g.status === 'done') return endHtml(g, X);
        var G = g.g, me = seatOf(g, st.uid), turn = G.phase === 'place' ? R().turn(G) : -1, mine = waitsOnMe(g), late = g.turnDeadline && Date.now() > g.turnDeadline;
        var head = G.phase === 'submit' ? (mine ? '👉 Pick in secret' : 'Waiting for ' + G.players.filter(function (p, s) { return !G.sent[s]; }).length)
            : mine ? '👉 Your turn' : name(g, g.order[turn]) + '\'s turn';
        var h = '<div class="r13"><div class="r13-top"><h3 id="r13o-turn"' + (mine ? ' class="r13o-mine"' : '') + '>' + head + '</h3>'
            + (mine ? '' : late ? '<button type="button" class="r13o-pill" id="r13o-claim" onclick="R13Online.claim()">⏭ Skip</button>' : '<button type="button" class="r13o-pill" id="r13o-nudge" onclick="R13Online.nudge()">👋 Nudge</button>')
            + '<span class="r13-pill" id="r13o-round">' + G.round + '/' + G.rounds + '</span>' + X + '</div>' + rowHtml(g);
        var tap = null;
        if (mine && G.phase === 'place' && G.subs[me].chip === 'w') { tap = {}; R().ST.forEach(function (c) { var pv = R().preview(G, me, c); tap[c] = '= ' + pv.total + (pv.take ? ' 💥' + pv.take : ''); }); }
        var ln = lastLine(g); if (ln) h += '<div class="r13-news" id="r13o-last">' + ln + '</div>';
        h += R13._stands(G, tap, 'R13Online.put');
        if (G.phase === 'submit') {
            var hd = st.hand && st.hand.sub;
            if (mine) h += handHtml(G.players[me]);
            else if (hd && hd.round === G.round) h += '<div class="r13o-k" id="r13o-sent">🔒 You sent ' + hd.card + ' · ' + CH[hd.chip] + '</div>';
        } else if (mine) {
            var sb = G.subs[me], pass = R().canPass(G, me) ? '<button type="button" class="r13-go alt" id="r13o-pass" onclick="R13Online.pass()"' + (st.busy ? ' disabled' : '') + '>⏭ Pass</button>' : '';
            if (sb.chip === 'w') h += pass ? '<div class="r13-row">' + pass + '</div>' : '';
            else { var pv = R().preview(G, me, sb.chip); h += '<div class="r13-row"><button type="button" class="r13-go' + (pv.take ? ' hit' : '') + '" id="r13o-put" onclick="R13Online.put()"' + (st.busy ? ' disabled' : '') + '>▸ Place ' + (pv.take ? '💥 🪨' + pv.take : '→ ' + pv.total) + '</button>' + pass + '</div>'; }
        }
        return h + note() + '<button type="button" class="r13-x" id="r13o-resign" style="align-self:center;font-size:.8em" onclick="R13Online.resign()">🏳 Leave game</button></div>';
    }
    function handHtml(p) {
        var k = st.pick, chips = [], ok = k.card != null && k.chip && p.cards.indexOf(k.card) >= 0 && p.chips[k.chip] > 0;
        ['r', 'g', 'b', 'w'].forEach(function (c) { var max = c === 'w' ? 1 : 2; for (var i = 0; i < max; i++) chips.push([c, i < p.chips[c]]); });
        return '<div class="r13-hand" role="group" aria-label="Cards">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) {
            var has = p.cards.indexOf(n) >= 0; return '<button type="button" class="r13-card' + (k.card === n ? ' on' : '') + '" data-card="' + n + '"' + (has ? ' onclick="R13Online.card(' + n + ')"' : ' disabled') + '>' + n + '</button>';
        }).join('') + '</div><div class="r13-hand" role="group" aria-label="Chips">' + chips.map(function (x, i) {
            var on = k.chip === x[0] && x[1] && (i === 0 || chips[i - 1][0] !== x[0] || !chips[i - 1][1]);
            return '<button type="button" class="r13-chip' + (on ? ' on' : '') + '" data-chip="' + x[0] + '"' + (x[1] ? ' onclick="R13Online.chip(\'' + x[0] + '\')"' : ' disabled') + '>' + CH[x[0]] + '</button>';
        }).join('') + '</div><button type="button" class="r13-go" id="r13o-send" onclick="R13Online.send()"' + (ok && !st.busy ? '' : ' disabled') + '>▸ Send' + (ok ? ' ' + k.card + ' · ' + CH[k.chip] : '') + '</button>';
    }
    function endHtml(g, X) {
        var r = g.result || {};
        if (r.reason === 'cancelled') return '<div class="r13"><div class="r13-top"><h3>🪨 Room closed</h3>' + X + '</div><button type="button" class="r13-go" onclick="R13Online.leave()">⬅ Rooms</button></div>';
        var G = g.g, me = seatOf(g, st.uid), rank = r.rank || [];
        if (!st.logged[st.open] && window.GameLog && G && me >= 0) {
            st.logged[st.open] = 1;
            try { GameLog.see('rock13', { id: st.open, n: G.round, done: true, mode: 'live', win: rank[0] === st.uid ? 'w' : 'l', score: String(G.players[me].pen), res: [] }); } catch (e) { }
        }
        return '<div class="r13"><div class="r13-top"><h3>🪨 Game over</h3>' + X + '</div>'
            + '<div class="r13-big" id="r13o-final">' + (rank[0] === st.uid ? '🏆 You win' : '🏆 ' + name(g, rank[0])) + '</div>'
            + '<div class="r13-rank" id="r13o-rank">' + rank.map(function (u, i) { var s = seatOf(g, u); return '<div class="' + (u === st.uid ? 'me' : '') + '"><b>' + (['🥇', '🥈', '🥉'][i] || i + 1) + '</b><span>' + face(Object.assign({}, g.players[u], { bot: G.players[s].bot && !g.players[u].pic }), 22) + ' ' + name(g, u) + '</span><b>🪨 ' + G.players[s].pen + '</b></div>'; }).join('') + '</div>'
            + '<button type="button" class="r13-go" onclick="R13Online.leave()">⬅ Rooms</button></div>';
    }
    function tick() {
        clearInterval(st.tick);
        st.tick = setInterval(function () {
            var g = st.room; if (!g || g.status !== 'playing' || !g.turnDeadline) return;
            var p = pct(); Array.prototype.forEach.call(document.querySelectorAll('#r13o-row .r13o-ring'), function (c) { c.setAttribute('stroke-dasharray', p + ' 100'); });
            var over = Date.now() - g.turnDeadline;
            if (over > 0 && !waitsOnMe(g) && !document.getElementById('r13o-claim') && !st.busy) rr();   // 👋 Nudge → ⏭ Skip
            // a waiting phone plays on for the late one; the phones wait a little each so they do not all call at once
            if (over > 800 + 700 * Math.max(0, seatOf(g, st.uid)) && !st.busy && !st.claiming) { st.claiming = true; call({ action: 'claim', roomId: st.open }).then(function () { st.claiming = false; }, function () { st.claiming = false; }); }
        }, 1000);
    }
    function share(alt, title, big, button, uri) {
        var card = { type: 'flex', altText: alt, contents: { type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#b45309', paddingAll: '16px', contents: [{ type: 'text', text: '🪨 Carry 13', color: '#fef3c7', size: 'xs', weight: 'bold' }, { type: 'text', text: title, color: '#ffffff', size: 'lg', weight: 'bold', wrap: true }] },
            body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: big, size: 'xxl', weight: 'bold', align: 'center' }, { type: 'text', text: 'Keep every carrier under 13 · fewest 🪨 wins', size: 'xs', color: '#6b7280', align: 'center', wrap: true }] },
            footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#b45309', height: 'sm', action: { type: 'uri', label: button, uri: uri } }] } } };
        var text = alt + '\n' + uri;
        var viaLine = window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker') && (!liff.isLoggedIn || liff.isLoggedIn()) ? Promise.resolve(liff.shareTargetPicker([card])).then(function (x) { return x ? 'sent' : 'closed'; }, function () { return null; }) : Promise.resolve(null);
        return viaLine.then(function (x) {
            if (x === 'sent' || x === 'closed') return x === 'sent';
            if (navigator.share) return navigator.share({ text: text }).then(function () { return true; }, function () { return false; });
            try { return navigator.clipboard.writeText(text).then(function () { st.msg = '📋 Link copied'; rr(); return true; }, function () { return false; }); } catch (e) { return false; }
        });
    }
    function link(q) { return 'https://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '') + '?r13=' + q; }

    window.R13Online = {
        lobbyHtml: lobbyHtml, html: html,
        active: function () { return !!st.open; },
        mine: function () { var g = st.room; return !!g && g.status === 'playing' && !!g.g && waitsOnMe(g); },
        create: function () { return busy(call({ action: 'create', rounds: R13._cfg().rounds })).then(function (r) { if (r && r.roomId) R13Online.open(r.roomId); }); },
        join: function (code) {
            var el = document.getElementById('r13o-code'); code = String(code || (el && el.value) || '').replace(/\D/g, '');
            if (code.length !== 4) { st.msg = 'Enter the 4-digit code'; return rr(); }
            if (!st.uid) { st.pending = code; start(); return; }
            return busy(call({ action: 'join', code: code })).then(function (r) { if (r && r.roomId) R13Online.open(r.roomId); });
        },
        open: function (id) {
            R13Online.close(); st.open = id; st.room = null; st.hand = null; st.msg = ''; st.pick = { card: null, chip: null };
            st.unRoom = db.collection('rooms').doc(id).onSnapshot(function (s) { var was = st.room && st.room.g && st.room.g.round; st.room = s.exists ? s.data() : null; if (st.room && st.room.g && st.room.g.round !== was) st.pick = { card: null, chip: null }; rr(); }, function () { st.msg = 'Could not load the room'; rr(); });
            st.unHand = db.collection('rooms').doc(id).collection('hand').doc(st.uid).onSnapshot(function (s) { st.hand = s.exists ? s.data() : null; rr(); }, function () { });
            tick(); rr();
        },
        close: function () { if (st.unRoom) st.unRoom(); if (st.unHand) st.unHand(); st.unRoom = st.unHand = null; clearInterval(st.tick); st.open = null; },
        leave: function () { R13Online.close(); rr(); },
        invite: function () { var g = st.room; if (!g) return; var nm = (g.players[g.creatorAuth] || {}).name || 'A friend'; return share('🪨 ' + nm + ' invites you to Carry 13 · code ' + g.code, nm + ' invites you', '🔑 ' + g.code, '▸ Join', link(g.code)); },
        nudge: function () { var g = st.room; if (!g) return; return share('🪨 Your turn · Carry 13', 'Your turn!', '🪨 ' + ((g.g && g.g.round) || 1) + '/' + g.rounds, '▸ Play', link('1')); },
        startGame: function () { return busy(call({ action: 'start', roomId: st.open })); },
        cancel: function () { return busy(call({ action: 'cancel', roomId: st.open })); },
        card: function (n) { st.pick.card = n; st.msg = ''; rr(); },
        chip: function (c) { st.pick.chip = c; st.msg = ''; rr(); },
        send: function () { var k = st.pick; if (k.card == null || !k.chip) return; return busy(call({ action: 'pick', roomId: st.open, card: k.card, chip: k.chip })); },
        put: function (c) { var g = st.room; if (!g || !g.g) return; var me = seatOf(g, st.uid), sb = g.g.subs[me]; if (!sb || (sb.chip === 'w' && !c)) return; return busy(call({ action: 'place', roomId: st.open, st: sb.chip === 'w' ? c : null })); },
        pass: function () { return busy(call({ action: 'pass', roomId: st.open })); },
        claim: function () { if (!st.open) return; return busy(call({ action: 'claim', roomId: st.open })); },
        resign: function () { if (!st.open || !window.confirm('Leave this game? A 🤖 takes your seat.')) return; return busy(call({ action: 'resign', roomId: st.open })); },
        deepLink: function (v) { v = String(v || ''); if (/^\d{4}$/.test(v)) { if (st.uid) R13Online.join(v); else { st.pending = v; start(); } } },
        _st: function () { return st; }
    };
})();
