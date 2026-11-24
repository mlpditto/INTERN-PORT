/* V101.335 — 🥣 Cereal Killer Phase 2 PR 2: play ONLINE, two phones, turns at any time (owner pick B + C, mockup-cereal-online/).
   The lobby gets two tabs — 📱 เครื่องนี้ (pass-and-play + 🤖, as before) | 🌐 ออนไลน์ (my online games first, then ＋ สร้างห้อง /
   🔑 มีรหัสห้อง). ＋ opens the room screen: a big 6-letter code, 📋 copy, the two seats; the game starts the moment the friend joins.
   Every move goes through the cerealAct callable (functions/cereal-act.js) — this page never writes cereal_games. The game doc is
   watched live (onSnapshot) and mapped onto the same game object cereal.js draws, so the board, notebook and reveal are the same
   screens. While the other player moves: the public board + "⏳ ตา Pond · n นาที"; after 1 hour ⏳ เคลม. The killer's own
   notebook comes from cerealAct mySecret (no client can read secret/killer). window.CKOnline.
   V101.338 — PR 3 (owner pick room B + nudge B, mockup-cereal-share/): 📤 LINE beside 📋 in the room sends a Flex invite card whose
   button opens ?cereal=<code> (joins the room, no typing); 📤 สะกิด in the waiting row sends a "ถึงตาคุณแล้ว" card that opens
   ?cereal=<gameId>. Sent only when the player taps (shareTargetPicker → OS share → clipboard), so no LINE OA quota. Cards carry the
   room code, names and the day — never the killer's home or path. deepLink() is called by applyTabDeepLink in index.html.
   V101.339 (owner pick C, mockup-cereal-tour-bot/): the lobby is one row — ＋ สร้างห้อง + 🔑 [รหัส 6 ตัว] ▸ typed in place (no join screen,
   no "ยังไม่มีเกม…" line, no sub-lines).
   V101.349 Phase 3 online: ＋ สร้างห้อง gets a 🐕 3 คน chip (and the 🗺 🥄 pair chip); a 3-seat room starts when all three are in
   (join takes the first free seat 🔪 → 🐕 → 🕵️). Lola's turn is drawn by cereal.js (lolaHtml); her walk is local until she uses an
   ability — lolaUse sends walk + ability and gets HER answer back; lolaNotes (cerealAct, Lola only) refills her 🔒 notebook.
   Phase 4 (owner pick B, mockup-cereal-stats/): two chips on the 🌐 list — 🏆 n ชนะ and 🏅 k/10; either opens the per-role wins and a
   2-column grid of the ten achievements (earned in colour). The reveal gets one 🏅 ได้ใหม่ line. Read from cereal_stats/{userId},
   which only cerealAct writes; online games only. */
(function () {
    'use strict';
    var R = window.CerealRules;
    var st = { uid: null, list: [], unList: null, unGame: null, gameId: null, doc: null, secret: {}, err: '', busy: false, view: null, code: '', side: 'A', role: 'killer', timer: null, authTried: false, pending: null, listed: false, sent: '',
        lola: false, pair: 1, lnotes: {}, stats: null, unStats: null, achOpen: false };
    // Phase 4 🏅 — ids match functions/cereal-act.js ACH (owner 2026-11-23 "Use these 10"): id · emoji · name · seat · how
    var ACHS = [['instinct', '🧠', 'สัญชาตญาณ', '🕵️', 'จับถูกครั้งแรก'], ['distrust', '🤨', 'ไม่ไว้ใจ', '🕵️', 'ชนะด้วย 🛡️ ครั้งสุดท้าย'], ['cornered', '🧱', 'จนมุม', '🕵️', 'ต้อนจนไม่มีทางเดิน'],
        ['quick', '⚡', 'ปิดคดีไว', '🕵️', 'ชนะภายในวันที่ 3'], ['nocards', '🙈', 'ไม่ถามเลย', '🕵️', 'ชนะโดยไม่ใช้การ์ด'], ['k9', '🐕', 'K9', '🐕', 'กัดถูกตัว'],
        ['planner', '🗓', 'วางแผน', '🔪', 'ชนะโดยใช้วันเว้น'], ['bowl', '🥣', 'ครบชาม', '🔪', 'ชนะ เหยื่อครบ 6'], ['invisible', '🫥', 'ล่องหน', '🔪', 'รอด 7 วัน ไม่โดนจับสักครั้ง'],
        ['scentless', '👃', 'ไร้กลิ่น', '🔪', 'ชนะเกม 3 คน'],
        // 🙋 asked for on the game-over screen, confirmed by the other players (owner pick A, mockup-cereal-self-ach/); SELF in cerealAct
        ['real', '🥛', 'ซีเรียลจริง', '🙋', 'กินซีเรียลระหว่างเล่น'], ['gooddog', '🐶', 'หมาดี', '🐕', 'Lola ไม่หลุดคำใบ้สักคำ'], ['dolittle', '🦜', 'ดูลิตเติล', '🙋', 'เล่นแบบ Lola พูดได้']];
    var SELF = ['real', 'gooddog', 'dolittle'];
    function achOf(id) { return ACHS.filter(function (x) { return x[0] === id; })[0]; }
    var IC = { killer: '🔪', lola: '🐕', detective: '🕵️' }, TH = { killer: 'ฆาตกร', lola: 'Lola', detective: 'นักสืบ' };
    function rolesOf(doc) { return doc && doc.mode === 3 ? ['killer', 'lola', 'detective'] : ['killer', 'detective']; }
    var C = function () { return window.CK && CK._; };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function call(data) { return firebase.functions().httpsCallable('cerealAct')(data).then(function (r) { return r.data || {}; }); }
    function msg(e) {
        var c = e && e.details && e.details.code;
        return { 'no-game': 'ไม่พบห้องที่เปิดอยู่ด้วยรหัสนี้', 'own-game': 'นี่คือห้องของคุณเอง', started: 'เกมเริ่มไปแล้ว', 'not-your-turn': 'ยังไม่ถึงตาคุณ', 'too-early': 'ยังไม่ครบ 1 ชม.' }[c]
            || (e && e.code === 'permission-denied' ? 'เปิดแอปจาก LINE ก่อน' : 'ส่งไม่สำเร็จ ลองอีกครั้ง');
    }
    function meRole(doc) { return rolesOf(doc).filter(function (r) { return doc.players && doc.players[r] && doc.players[r].authUid === st.uid; })[0] || null; }
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
                st.listed = true; rerender(); runPending();
            }, function () { st.err = 'โหลดเกมออนไลน์ไม่ได้'; rerender(); });
            if (typeof userId === 'string' && userId && !st.unStats) st.unStats = db.collection('cereal_stats').doc(userId).onSnapshot(function (s) { st.stats = s.exists ? s.data() : null; rerender(); }, function () { /* no stats yet */ });
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
            // V101.340 (owner pick B, mockup-cereal-lola/): one row ‹ · 🔪 / 🕵️ · 🗺 A | B, then ▸ สร้าง — no row labels, no English line, no ✕ ยกเลิก button
            var mapChip = function (s, lbl, en, th) { return '<button type="button" class="ck-chip' + (st.side === s ? ' on' : '') + '" id="ck-on-side-' + s + '" onclick="CKOnline.pick(\'side\',\'' + s + '\')" title="' + en + '" data-th-title="' + th + '">' + lbl + '</button>'; };
            h += '<div class="ck-row ck-mkrow"><button type="button" class="ck-chip" id="ck-on-back" onclick="CKOnline.pick(\'view\',null)" aria-label="Back" title="Back" data-th-title="กลับ">‹</button>'
                + '<button type="button" class="ck-chip' + (st.role === 'killer' ? ' on' : '') + '" id="ck-on-role-killer" onclick="CKOnline.pick(\'role\',\'killer\')">🔪 ฆาตกร</button>'
                + (st.lola ? '<button type="button" class="ck-chip' + (st.role === 'lola' ? ' on' : '') + '" id="ck-on-role-lola" onclick="CKOnline.pick(\'role\',\'lola\')">🐕 Lola</button>' : '')
                + '<button type="button" class="ck-chip' + (st.role === 'detective' ? ' on' : '') + '" id="ck-on-role-detective" onclick="CKOnline.pick(\'role\',\'detective\')">🕵️ นักสืบ</button>'
                + (st.lola ? '' : '<span class="ck-mkmap">' + mapChip('A', '🗺 A', 'Map A · 🥄🥄 easier for the killer', 'แผนที่ A · ฆาตกรได้เปรียบ') + mapChip('B', 'B', 'Map B · 🥄 easier for the detective', 'แผนที่ B · นักสืบได้เปรียบ') + '</span>') + '</div>'
                // V101.349: 🐕 3 คน + the printed pair (city + suburb), as on 📱 เครื่องนี้
                + '<div class="ck-row" style="gap:6px"><button type="button" class="ck-chip lola' + (st.lola ? ' on' : '') + '" id="ck-on-lola" aria-pressed="' + st.lola + '" onclick="CKOnline.toggleLola()">🐕 3 คน</button>'
                + (st.lola && window.CEREAL_MAPS ? '<button type="button" class="ck-chip on" id="ck-on-pair" onclick="CKOnline.nextPair()" title="' + esc(CEREAL_MAPS.difficulty[st.pair].name) + '" data-th-title="' + esc(CEREAL_MAPS.difficulty[st.pair].th) + '">🗺 ' + '🥄'.repeat(CEREAL_MAPS.difficulty[st.pair].spoons) + '</button>' : '') + '</div>'
                + '<button type="button" class="ck-primary" id="ck-on-create" onclick="CKOnline.create()"' + (st.busy || !st.uid ? ' disabled' : '') + '>▸ สร้าง · ได้รหัส 6 ตัว</button>';
            return h;
        }
        h += achHtml();
        var order = function (x) { return myTurn(x) ? 0 : x.status === 'playing' ? 1 : x.status === 'lobby' ? 2 : 3; };
        var games = st.list.slice().sort(function (a, b) { return order(a) - order(b) || (b.updatedAt || 0) - (a.updatedAt || 0); }).slice(0, 12);
        if (games.length) {
            h += '<div class="ck-nb"><div class="lbl">🌐 เกมออนไลน์ของฉัน</div>';
            games.forEach(function (x) {
                var me = meRole(x), others = rolesOf(x).filter(function (r) { return r !== me; }), on = x.names ? (x.names[x.phase] || x.names[others[0]] || '') : '', mine = myTurn(x), tail;
                if (x.status === 'lobby') tail = '<span class="ck-wait">👥 รอเพื่อน · ' + esc(x.code) + '</span>';
                else if (x.status === 'finished') tail = '<span class="ck-pill">' + (x.result && x.result.winner === (me === 'killer' ? 'killer' : 'good') ? '🏆 ชนะ' : '🏁 แพ้') + '</span>';
                else if (mine) tail = '<span class="ck-turn">ตาคุณ</span>';
                else tail = '<span class="ck-wait">⏳ รอ ' + esc(on) + ' · ' + mins(Date.now() - (x.updatedAt || Date.now())) + '</span>';
                h += '<button type="button" class="ck-game' + (mine ? ' mine' : '') + (x.status === 'finished' ? (x.result && x.result.winner === (me === 'killer' ? 'killer' : 'good') ? ' r-w' : ' r-l') : ' r-p') + '" data-game="' + esc(x.id) + '" onclick="CKOnline.open(\'' + esc(x.id) + '\')"><span class="d">' + (x.status === 'playing' ? 'D' + x.day : x.status === 'lobby' ? '—' : '🏁') + '</span><span class="who">' + IC[me] + ' คุณ' + others.map(function (r) { return x.names && x.names[r] ? ' · ' + IC[r] + ' ' + esc(x.names[r]) : ''; }).join('') + '</span>' + tail + '<span class="go">▸</span></button>';
            });
            h += '</div>';
        }
        var off = st.busy || !st.uid ? ' disabled' : '', full = st.code.length === 6;
        h += '<div class="ck-onrow"><button type="button" class="ck-primary" id="ck-on-new" onclick="CKOnline.pick(\'view\',\'create\')">＋ สร้างห้อง</button>'
            + '<label class="ck-name ck-code"><span>🔑</span><input type="text" id="ck-on-code" maxlength="6" autocomplete="off" autocapitalize="characters" enterkeyhint="go" placeholder="รหัส 6 ตัว" value="' + esc(st.code) + '" aria-label="Room code" oninput="CKOnline.typed(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();CKOnline.join();}">'
            // V101.352 (owner pick E): 📋 วาง until 6 letters are in, then ▸ in the same place
            + '<button type="button" class="ck-paste" id="ck-on-paste" onclick="CKOnline.paste()"' + (full ? ' hidden' : '') + '>📋 วาง</button>'
            + '<button type="button" class="ck-go" id="ck-on-join" onclick="CKOnline.join()" aria-label="Join"' + off + (full ? '' : ' hidden') + '>▸</button></label></div>';
        if (!games.length && st.listed) h += '<div class="ck-empty" id="ck-on-empty">🌐 ยังไม่มีเกม · ＋ สร้างห้อง แล้วส่งรหัสให้เพื่อน</div>';
        return h;
    }

    /** Phase 4 pick B: 🏆 n ชนะ · 🏅 k/10 — either chip opens the per-role wins + the grid of ten. */
    function achHtml() {
        var s = st.stats || {}, a = s.ach || {}, got = ACHS.filter(function (x) { return a[x[0]]; }).length, open = st.achOpen;
        var wins = (s.winsKiller || 0) + (s.winsDetective || 0) + (s.winsLola || 0), ex = ' aria-expanded="' + open + '" onclick="CKOnline.ach()"';
        var h = '<div class="ck-row ck-st">' + (s.played ? '<button type="button" class="ck-chip" id="ck-on-wins"' + ex + '>🏆 ' + wins + ' ชนะ'
            + (open ? ' · 🔪 ' + (s.winsKiller || 0) + ' · 🕵️ ' + (s.winsDetective || 0) + ' · 🐕 ' + (s.winsLola || 0) : '') + '</button>' : '')
            + '<button type="button" class="ck-chip' + (open ? ' on' : '') + '" id="ck-on-ach"' + ex + '>🏅 ' + got + '/' + ACHS.length + (open ? ' ⌄' : ' ›') + '</button></div>';
        if (open) h += '<div class="ck-achgrid" id="ck-on-achgrid">' + ACHS.map(function (x) {
            return '<div class="' + (a[x[0]] ? 'got' : '') + '" data-ach="' + x[0] + '"><b>' + x[1] + '</b><span>' + x[2] + '<small>' + x[3] + ' ' + x[4] + '</small></span></div>';
        }).join('') + '</div>';
        return h;
    }
    /** The reveal's one line: what this game earned me (🏅 ได้ใหม่ when it is the first time). '' when nothing. */
    function achLine(g) {
        var ids = g && g.online && g.result && g.result.ach && g.result.ach[g.online.me];
        var list = (ids || []).map(achOf).filter(Boolean);
        if (!list.length) return selfHtml(g);
        var a = (st.stats && st.stats.ach) || {}, fresh = list.some(function (x) { return a[x[0]] === 1; });
        return '<div class="ck-ach-new" id="ck-ach-new"><b>' + list.map(function (x) { return x[1]; }).join('') + '</b><span>🏅 ' + (fresh ? 'ได้ใหม่' : 'ได้') + ' · '
            + list.map(function (x) { return x[2]; }).join(' · ') + '<small>' + list.map(function (x) { return x[4]; }).join(' · ') + '</small></span></div>' + selfHtml(g);
    }
    /* 🙋 (owner pick A, mockup-cereal-self-ach/): the other players' asks I have not answered (✓ / ✕), then my own chips —
       tap = ask, ⏳ while the others decide, ✓ earned, ✕ turned down. Online, finished games only. */
    function selfHtml(g) {
        var o = g && g.online;
        if (!o || o.status !== 'finished' || !o.me || !o.players) return '';
        var claims = o.claims || {}, seats = rolesOf(o).filter(function (r) { return o.players[r]; }), h = '';
        seats.forEach(function (seat) {
            if (seat === o.me) return;
            Object.keys(claims[seat] || {}).forEach(function (id) {
                var c = claims[seat][id], a = achOf(id);
                if (!a || c.state || (c.votes || {})[o.me] != null) return;
                h += '<div class="ck-self-ask" data-seat="' + seat + '" data-ach="' + id + '"><b>' + a[1] + '</b><span class="sp">' + esc(g.names[seat] || TH[seat]) + ' ขอ ' + a[2] + '<small>' + a[4] + ' · จริงไหม?</small></span>'
                    + '<button type="button" class="y" onclick="CKOnline.vote(\'' + seat + '\',\'' + id + '\',true)"' + (st.busy ? ' disabled' : '') + ' aria-label="Yes" title="จริง">✓</button>'
                    + '<button type="button" class="n" onclick="CKOnline.vote(\'' + seat + '\',\'' + id + '\',false)"' + (st.busy ? ' disabled' : '') + ' aria-label="No" title="ไม่จริง">✕</button></div>';
            });
        });
        var mine = SELF.filter(function (id) { return id === 'real' || (id === 'gooddog' && o.me === 'lola') || (id === 'dolittle' && o.mode === 3); });
        var who = seats.filter(function (r) { return r !== o.me; }).map(function (r) { return esc(g.names[r] || TH[r]); }).join(' · ');
        h += '<div class="ck-self" id="ck-self"><div class="h">🙋 ขอเอง · ' + who + ' ยืนยัน</div><div class="ck-row">' + mine.map(function (id) {
            var a = achOf(id), c = (claims[o.me] || {})[id], s = !c ? '' : c.state === 'ok' ? ' ✓' : c.state === 'no' ? ' ✕' : ' ⏳';
            return '<button type="button" class="ck-chip' + (c ? (c.state === 'ok' ? ' on' : c.state === 'no' ? ' no' : ' wait') : '') + '" data-ach="' + id + '"'
                + (c || st.busy ? ' disabled' : ' onclick="CKOnline.claimAch(\'' + id + '\')"') + ' title="' + esc(a[4]) + '">' + a[1] + ' ' + a[2] + s + '</button>';
        }).join('') + '</div></div>';
        return h;
    }

    // ---- one game -------------------------------------------------------------------------------------------
    function toGame(doc, prev) {
        var me = meRole(doc), fin = doc.status === 'finished';
        var same = prev && prev.online && prev.online.id === doc.id && prev.day === doc.day && prev.phase === doc.phase;
        var secret = fin && doc.result ? { home: doc.result.revealedHome, path: doc.result.revealedPath || {}, kills: doc.result.revealedKills || {} } : (st.secret[doc.id] || { home: null, path: {}, kills: {} });
        var dd = doc.dd && doc.dd.asked ? doc.dd : same && prev.dd ? prev.dd : { path: [], asked: null };
        return {
            online: { id: doc.id, me: me, code: doc.code, status: doc.status, turnDeadline: doc.turnDeadline, updatedAt: doc.updatedAt, players: doc.players, mode: doc.mode, claims: doc.claims || {} },
            id: doc.id, citySide: doc.citySide, suburbSide: doc.suburbSide || null, pair: doc.pair, lola: lolaOf(doc, prev, same), names: doc.names || { killer: '', detective: '' }, status: fin ? 'finished' : 'playing', day: doc.day, phase: doc.phase, hand: null, bot: null,
            secret: secret, detectivePos: same && prev.detectivePos != null && doc.detectivePos == null ? prev.detectivePos : doc.detectivePos,
            cereals: doc.cereals || [], witness: doc.witness, arrestsLeft: doc.arrestsLeft, kills: doc.kills, usedQuestions: doc.usedQuestions || [], skipUsed: !!doc.skipUsed,
            log: doc.log || [], draft: same && prev.draft ? prev.draft : { path: [], kill: null, witness: null }, dd: dd, result: doc.result || null, pubDays: []
        };
    }
    /* V101.349: the public Lola + (for Lola only) her notes; her walk stays local until she uses an ability. */
    function lolaOf(doc, prev, same) {
        if (!doc.lola) return null;
        var mine = meRole(doc) === 'lola', notes = mine && st.lnotes[doc.id] ? st.lnotes[doc.id].notes : [];
        var used = doc.lola.dd && doc.lola.dd.used ? Object.assign({}, doc.lola.dd.used) : null, dd;
        if (used) { var n = notes.filter(function (x) { return x.day === doc.day && x.a === used.a && x.cell === used.cell; }).pop(); if (n) used.ans = n.ans; dd = { path: doc.lola.dd.path, used: used }; }
        else dd = same && prev.lola && prev.lola.dd && !prev.lola.dd.used ? prev.lola.dd : { path: [], used: null };
        return { pos: doc.lola.pos, last: doc.lola.last, dd: dd, notes: notes };
    }
    function loadNotes(doc) {
        if (doc.status !== 'playing' || meRole(doc) !== 'lola') return;
        var have = st.lnotes[doc.id];
        if (have && have._day === doc.day && have._phase === doc.phase && have._used === !!(doc.lola && doc.lola.dd && doc.lola.dd.used)) return;
        call({ action: 'lolaNotes', gameId: doc.id }).then(function (r) {
            st.lnotes[doc.id] = { _day: doc.day, _phase: doc.phase, _used: !!(doc.lola && doc.lola.dd && doc.lola.dd.used), notes: r.notes || [] };
            var c = C(); if (c && c.get() && c.get().online && c.get().online.id === doc.id) { c.set(toGame(doc, c.get())); c.render(); }
        }).catch(function (e) { st.err = msg(e); rerender(); });
    }
    function loadSecret(doc) {
        loadNotes(doc);
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
        var seat = function (r) { var p = on.players && on.players[r]; return '<div class="seat' + (p ? ' on' : ' wait') + '">' + IC[r] + '<b>' + (p ? (r === me ? 'คุณ' : esc(p.name)) : '…') + '</b><small>' + (p ? TH[r] : 'รอเพื่อน') + '</small></div>'; };
        var three = !!(on.players && 'lola' in on.players);
        return '<div class="ck lobby">' + c.topHtml('🌐 ห้อง ' + esc(on.code))
            + (st.err ? '<div class="ck-warn">' + esc(st.err) + '</div>' : '')
            + '<div class="ck-room"><div class="code" id="ck-on-room-code">' + esc(on.code) + '</div>'
            + '<div class="ck-row" style="justify-content:center"><button type="button" class="ck-chip line" id="ck-on-invite" onclick="CKOnline.invite()">' + (st.sent === 'invite' ? '✓ ส่งแล้ว' : '📤 LINE') + '</button><button type="button" class="ck-chip on" id="ck-on-copy" onclick="CKOnline.copy()">📋 คัดลอกรหัส</button></div>'
            + '<div class="seats' + (three ? ' three' : '') + '">' + seat('killer') + (three ? seat('lola') : '') + seat('detective') + '</div>'
            + '<div class="ck-note" style="text-align:center">เพื่อนกด 🥣 → 🌐 ออนไลน์ → 🔑 ใส่รหัส · ' + (three ? 'เกมเริ่มเมื่อครบ 3 คน' : 'เกมเริ่มทันทีที่เข้าห้อง') + '</div></div>'
            + '<div class="ck-row" style="justify-content:center"><button type="button" class="ck-chip" id="ck-on-cancel" onclick="CKOnline.cancel()">✕ ยกเลิกห้อง</button><button type="button" class="ck-chip" onclick="CK.lobby()">📋 เกมของฉัน</button></div></div>';
    }
    function waitHtml() {
        var c = C(), g = c.get(), on = g.online, other = g.phase, name = g.names[other] || '', now = Date.now(), late = on.turnDeadline && now > on.turnDeadline;
        var ex = c.publicExtra(g); if (g.detectivePos != null) { ex[g.detectivePos] = ex[g.detectivePos] || {}; ex[g.detectivePos].tk = (ex[g.detectivePos].tk || '') + '🕵️'; }
        if (on.me === 'killer' && st.secret[on.id]) { var kp = c.kposOf(g); if (kp != null) { ex[kp] = ex[kp] || {}; ex[kp].cls = (ex[kp].cls || '') + ' ring'; ex[kp].me = '🔪'; } }
        var card = late
            ? '<div class="ck-waitcard late" id="ck-on-wait"><span>⏳ ' + esc(name) + ' หายไป ' + mins(now - (on.updatedAt || now)) + '</span><small>เกินเวลาแล้ว · กดเคลมเพื่อจบตาที่ค้าง' + (other === 'killer' ? ' (ฆาตกรค้าง = นักสืบชนะ)' : other === 'lola' ? ' (Lola ค้าง = ข้ามตา Lola)' : ' (นักสืบค้าง = จบตาที่จุดเดิม)') + '</small><button type="button" class="ck-claim" id="ck-on-claim" onclick="CKOnline.claim()"' + (st.busy ? ' disabled' : '') + '>⏳ เคลม</button></div>'
            : '<div class="ck-waitcard" id="ck-on-wait"><span>⏳ ตา <b>' + esc(name) + '</b> (' + IC[other] + ') · ผ่านมา ' + mins(now - (on.updatedAt || now)) + '</span><small>หน้านี้อัปเดตเองเมื่อ ' + esc(name) + ' เล่นเสร็จ · เคลมได้เมื่อครบ 1 ชม.</small></div>';
        return '<div class="ck ' + on.me + '">' + c.topHtml('🌐 ' + IC[on.me] + ' วันที่ ' + g.day, c.pills(g)) + (st.err ? '<div class="ck-warn">' + esc(st.err) + '</div>' : '') + card
            + c.boardHtml(g, { extra: ex, tap: false }) + c.logHtml(g) + '<div class="ck-row" style="justify-content:center"><button type="button" class="ck-chip line" id="ck-on-nudge" onclick="CKOnline.nudge()">' + (st.sent === 'nudge:' + on.id + ':' + g.day + g.phase ? '✓ สะกิดแล้ว' : '📤 สะกิด') + '</button><button type="button" class="ck-chip" onclick="CK.lobby()">📋 เกมของฉัน</button><button type="button" class="ck-chip" id="ck-on-resign" onclick="CKOnline.resign()">🏳️ ยอมแพ้</button></div></div>';
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
    /* V101.349 🐕: walk + one ability in one call; the referee answers her alone (bite = shared 🛡️ arrest). */
    function lolaUse(a, cell) {
        var c = C(), g = c.get(), L0 = g.lola, path = L0.dd.path.length ? L0.dd.path : [L0.pos];
        return act({ action: 'lolaUse', gameId: g.online.id, path: path, ability: a, cell: cell == null ? null : cell }, function (r) {
            if (!r) return;
            if (a === 'bite') { c.snd(r.caught ? 'siren' : 'buzz'); return; }
            var n = { day: g.day, a: a, cell: cell == null ? null : cell, from: path[path.length - 1], ans: r.answer };
            var rec = st.lnotes[g.online.id] || (st.lnotes[g.online.id] = { notes: [] }); rec.notes = rec.notes.concat(n); rec._used = true;
            L0.notes = rec.notes; L0.dd = { path: path, used: { a: a, cell: n.cell, ans: r.answer } }; c.snd('ding');
        });
    }
    function lolaEnd() {
        var c = C(), g = c.get(), L0 = g.lola, path = L0.dd.path.length ? L0.dd.path : [L0.pos];
        return act({ action: 'lolaEnd', gameId: g.online.id, path: path });
    }
    function cornered() {
        var c = C(), g = c.get(), pos = c.kposOf(g);
        act({ action: 'killerMove', gameId: g.online.id, path: [pos, pos, pos, pos] });
        return '<div class="ck killer">' + c.topHtml('🌐 🔪 วันที่ ' + g.day, c.pills(g)) + '<div class="ck-note" style="text-align:center">🔪 จนมุม · ไม่มีทางเดิน 3 ก้าว</div></div>';
    }

    // ---- 📤 share in LINE (V101.338) -------------------------------------------------------------------------------
    function link(v) { return 'https://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '') + '?cereal=' + encodeURIComponent(v); }
    function card(o) {   // o: { alt, color, kicker, title, lines[], big?, button, uri }
        var body = o.lines.map(function (t) { return { type: 'text', text: t, wrap: true, size: 'sm', color: '#3c3c3c' }; });
        if (o.big) body.splice(1, 0, { type: 'text', text: o.big, size: 'xxl', weight: 'bold', color: '#92400e' });
        return { type: 'flex', altText: o.alt, contents: { type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: o.color, paddingAll: '16px', contents: [
                { type: 'text', text: o.kicker, color: '#ffffff', size: 'xs', weight: 'bold' },
                { type: 'text', text: o.title, color: '#ffffff', size: 'lg', weight: 'bold', wrap: true }] },
            body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
            footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#06c755', height: 'sm', action: { type: 'uri', label: o.button, uri: o.uri } }] } } };
    }
    /** Flex card via shareTargetPicker → the OS share sheet → the clipboard. Resolves true when something was handed over. */
    function share(o) {
        var text = o.alt + '\n' + o.uri;
        var viaLine = window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')
            ? Promise.resolve(liff.shareTargetPicker([card(o)])).then(function (r) { return r ? 'sent' : 'closed'; }, function () { return null; })
            : Promise.resolve(null);
        return viaLine.then(function (r) {
            if (r === 'sent') return true;
            if (r === 'closed') return false;   // the picker opened and the player closed it
            if (navigator.share) return navigator.share({ text: text }).then(function () { return true; }, function () { return false; });
            try { return navigator.clipboard.writeText(text).then(function () { st.err = ''; return true; }, function () { return false; }); } catch (_) { return Promise.resolve(false); }
        });
    }
    function invite() {
        var g = C().get(), on = g.online, me = on.me, my = (g.names && g.names[me]) || 'เพื่อน', theirs = g.lola ? '🥣 3 คน · 🐕' : me === 'killer' ? '🕵️ นักสืบ' : '🔪 ฆาตกร';
        return share({ alt: '🥣 ' + my + ' ชวนเล่น Cereal Killer · รหัส ' + on.code, color: '#92400e', kicker: '🥣 CEREAL KILLER', title: my + ' ชวนเล่น ' + theirs,
            lines: ['รหัสห้อง', 'แตะแล้วเข้าห้องเลย ไม่ต้องพิมพ์'], big: on.code, button: '🔑 เข้าห้อง', uri: link(on.code) })
            .then(function (ok) { if (ok) { st.sent = 'invite'; rerender(); } return ok; });
    }
    function nudge() {
        var g = C().get(), on = g.online, to = g.phase, from = on.me, mine = (g.names && g.names[from]) || 'เพื่อน', key = 'nudge:' + on.id + ':' + g.day + g.phase;
        return share({ alt: '🥣 ถึงตาคุณแล้ว · Cereal Killer วันที่ ' + g.day, color: { killer: '#be123c', lola: '#92400e', detective: '#4338ca' }[to], kicker: '🥣 CEREAL KILLER · วันที่ ' + g.day,
            title: 'ถึงตาคุณแล้ว ' + IC[to], lines: [mine + ' (' + IC[from] + ') เล่นเสร็จแล้ว · รอคุณอยู่'], button: '▸ เล่นต่อ', uri: link(on.id) })
            .then(function (ok) { if (ok) { st.sent = key; rerender(); } return ok; });
    }
    /** ?cereal=<6-letter code> joins (or opens, if I am already in it) that room; ?cereal=<gameId> opens that game. */
    function deepLink(v) {
        v = String(v || '').trim();
        if (!/^[A-Za-z0-9]{6,40}$/.test(v)) return;
        st.pending = v;
        if (typeof cerealOpen === 'function') cerealOpen();
        if (window.CK) CK.tab('online');
        start(); runPending();
    }
    function runPending() {
        var v = st.pending;
        if (!v || !st.uid || !st.listed) return;
        st.pending = null;
        if (v.length === 6) {
            var c6 = v.toUpperCase(), mine = st.list.filter(function (x) { return x.code === c6 && meRole(x); }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0];
            if (mine) { open(mine.id); return; }
            st.code = c6; st.view = null; rerender();
            act({ action: 'join', code: c6 }, function (r) { if (r && r.gameId) { st.code = ''; open(r.gameId); } });
            return;
        }
        open(v);
    }

    window.CKOnline = {
        invite: invite, nudge: nudge, deepLink: deepLink,
        lobbyHtml: lobbyHtml, achLine: achLine, ach: function () { st.achOpen = !st.achOpen; rerender(); }, screen: screen, open: open, leave: leave, myTurnCount: myTurnCount, start: start,
        lock: lock, ask: ask, end: end, cornered: cornered, lolaUse: lolaUse, lolaEnd: lolaEnd,
        toggleLola: function () { st.lola = !st.lola; if (!st.lola && st.role === 'lola') st.role = 'killer'; st.err = ''; rerender(); },
        nextPair: function () { st.pair = (st.pair + 1) % ((window.CEREAL_MAPS && CEREAL_MAPS.difficulty.length) || 4); rerender(); },
        pick: function (k, v) { st[k] = v; st.err = ''; rerender(); },
        create: function () { return act({ action: 'create', role: st.role, side: st.side, lola: st.lola, pair: st.pair }, function (r) { st.view = null; if (r && r.gameId) open(r.gameId); }); },
        join: function () {
            var el = document.getElementById('ck-on-code'); st.code = ((el && el.value) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (st.code.length !== 6) { st.err = 'รหัสห้องมี 6 ตัว'; rerender(); return Promise.resolve(null); }
            return act({ action: 'join', code: st.code }, function (r) { if (r && r.gameId) { st.code = ''; open(r.gameId); } });
        },
        typed: function (el) {
            st.code = (el.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
            var full = st.code.length === 6, p = document.getElementById('ck-on-paste'), j = document.getElementById('ck-on-join');
            if (p) p.hidden = full; if (j) j.hidden = !full;
        },
        /** 📋 วาง: the room code from the clipboard — the copied code itself, or the LINE invite (?cereal=CODE wins over any 6-letter word). */
        paste: function () {
            var fail = function () { st.err = '📋 อ่านไม่ได้ · กดค้างในช่องแล้ววาง'; rerender(); var el = document.getElementById('ck-on-code'); if (el) el.focus(); };
            var p; try { p = navigator.clipboard.readText(); } catch (_) { p = null; }
            if (!p || !p.then) { fail(); return Promise.resolve(null); }
            return p.then(function (t) {
                var s = String(t || '').toUpperCase(), m = /CEREAL=([A-Z0-9]{6})(?![A-Z0-9])/.exec(s) || /(?:^|[^A-Z0-9])([A-Z0-9]{6})(?![A-Z0-9])/.exec(s);
                if (!m) { fail(); return null; }
                st.code = m[1]; st.err = ''; rerender(); return m[1];
            }, function () { fail(); return null; });
        },
        copy: function () { var g = C().get(); try { navigator.clipboard.writeText(g.online.code); } catch (_) { /* old webview */ } var b = document.getElementById('ck-on-copy'); if (b) b.textContent = '📋 คัดลอกแล้ว'; },
        cancel: function () { var g = C().get(); return act({ action: 'cancel', gameId: g.online.id }, function () { leave(); C().set(null); }); },
        claim: function () { var g = C().get(); return act({ action: 'claim', gameId: g.online.id }); },
        resign: function () { var g = C().get(); return act({ action: 'resign', gameId: g.online.id }); },
        claimAch: function (id) { var g = C().get(); return act({ action: 'claimAch', gameId: g.online.id, id: id }); },
        vote: function (seat, id, ok) { var g = C().get(); return act({ action: 'voteAch', gameId: g.online.id, seat: seat, id: id, ok: ok }); },
        state: function () { return st; }   // QA
    };
})();
