/* V101.353 🐺 Werewolf solo — you and 4–8 🤖 on this phone (owner pick B, mockup-werewolf-solo/: seats with a speech tag under
   each name, the whole table on one screen). Flow: lobby → your role card → 🌙 night (your power on a seat) → ☀️ day (bots
   speak as tags; you tap a seat, then 🤨 / 👍 / 🔮) → 🗳 vote (the bots' counts on the seats, you add yours or ⏭) → night …
   → reveal. Rules = wolf-rules.js (the same file the Telegram bot uses), the bots = wolf-ai.js; this file draws and stores.
   A player's role shows when they die. No timer (the bots answer at once). State = localStorage wolf_v1_<userId>; reads and
   writes nothing in Firestore. Entry: the 🐺 button beside 🥣 on Schedule (wolfOpen). Handlers hang off window.WW. */
(function () {
    'use strict';
    var W = window.WolfRules, AI = window.WolfAI;
    if (!W || !AI) { console.warn('[wolf] wolf-rules.js / wolf-ai.js must load first'); return; }

    var NAMES = ['ต้น', 'ใบ', 'ฟ้า', 'นนท์', 'มุก', 'ภู', 'แพร', 'ก้อง', 'เจ'];
    var FACES = ['🦊', '🐰', '🐱', '🐻', '🐼', '🐯', '🐨', '🐸', '🐵'];
    var RNAME = { wolf: 'มนุษย์หมาป่า', seer: 'ผู้หยั่งรู้', guard: 'บอดี้การ์ด', witch: 'แม่มด', villager: 'ชาวบ้าน' };
    var RHOW = {
        wolf: 'ทุกคืนเลือกกัด 1 คน · ชนะเมื่อหมาป่าเท่ากับคนที่เหลือ',
        seer: 'ทุกคืนเช็ก 1 คน ว่าเป็น 🐺 ไหม',
        guard: 'ทุกคืนเลือกคุ้มกัน 1 คน · ห้ามคนเดิม 2 คืนติด',
        witch: '💊 ชุบคนถูกกัด 1 ครั้ง · ☠️ วางยา 1 ครั้ง',
        villager: 'ไม่มีพลัง · หาหมาป่าจากคำพูดแล้วโหวตออก'
    };
    var E = W.EMOJI, MAX_GAMES = 10;

    function key() { var u = ''; try { u = typeof userId !== 'undefined' ? userId : ''; } catch (_) { /* not declared */ } return 'wolf_v1_' + (u || 'anon'); }
    function load() { try { var d = JSON.parse(localStorage.getItem(key()) || 'null'); if (d && Array.isArray(d.games)) return d; } catch (_) { /* blocked storage */ } return { games: [] }; }
    function save() { if (g) g.upd = Date.now(); try { localStorage.setItem(key(), JSON.stringify(store)); } catch (_) { /* storage may be blocked (LIFF) */ } }

    var store = { games: [] }, g = null, sel = null;     // g = the open game; sel = the tapped seat
    var ui = { n: 7, level: 2 };
    var rng = Math.random;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function nm(id) { return g.names[id]; }
    function alive() { return g.ids.filter(function (id) { return g.st.alive[id]; }); }
    function myRole() { return g.st.roles[g.me]; }
    function meAlive() { return !!g.st.alive[g.me]; }
    function holder(r) { return W.withRole(g.st.roles, g.st.alive, r)[0] || null; }

    // ---- the game ---------------------------------------------------------------------------------------
    function newGame(n, level) {
        var ids = [], names = {}, faces = {}, pool = NAMES.map(function (x, i) { return i; });
        for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
        for (var k = 1; k <= n; k++) {
            var id = 'p' + k; ids.push(id);
            if (k === 1) { names[id] = 'คุณ'; faces[id] = '🙂'; } else { names[id] = NAMES[pool[k - 2]]; faces[id] = FACES[pool[k - 2]]; }
        }
        var st = W.newState(W.deal(ids, W.defaultCounts(n), rng));
        return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), upd: Date.now(), status: 'playing',
            n: n, level: level, me: 'p1', ids: ids, names: names, faces: faces, st: st, phase: 'role', day: 1,
            checks: {}, claims: [], said: [], votes: [], deaths: [], tags: {}, draft: {}, botVotes: null, lastNight: null, lastVote: null,
            saves: 0, heals: 0, poisoned: null, result: null };
    }
    function finishIf() {
        var w = W.winner(g.st); if (!w) return false;
        g.status = 'finished'; g.phase = 'over'; g.result = { winner: w, day: g.day };
        return true;
    }
    function startNight() {
        g.phase = 'night'; g.draft = {}; sel = null; g.tags = {};
        // the wolves' bite is fixed before the witch looks, so a 🧪 player sees the real victim
        if (!(meAlive() && myRole() === 'wolf')) g.draft.bite = W.wolfTarget(AI.wolfVotes(g, rng), rng);
    }
    function endNight() {
        var d = g.draft, picks = { bite: d.bite || null, guard: null, seer: null, heal: false, poison: null };
        var seer = holder('seer'), guard = holder('guard'), witch = holder('witch');
        if (seer) picks.seer = seer === g.me ? d.seer || null : AI.seerPick(g, seer, rng);
        if (guard) picks.guard = guard === g.me ? d.guard || null : AI.guardPick(g, guard, rng);
        if (witch && (g.st.witch.heal || g.st.witch.poison)) {
            var wp = witch === g.me ? { heal: !!d.heal, poison: d.poison || null } : AI.witchPick(g, witch, picks.bite, rng);
            if (wp.heal && picks.bite && !W.pickError(g.st, witch, 'heal', picks.bite)) picks.heal = true;
            if (wp.poison && !W.pickError(g.st, witch, 'poison', wp.poison)) picks.poison = wp.poison;
        }
        if (picks.guard && W.pickError(g.st, guard, 'guard', picks.guard)) picks.guard = null;
        if (picks.seer && W.pickError(g.st, seer, 'seer', picks.seer)) picks.seer = null;
        var r = W.resolveNight(g.st, picks);
        if (r.seen) { g.checks[seer] = g.checks[seer] || {}; g.checks[seer][r.seen.id] = r.seen.wolf; }
        if (picks.bite && picks.guard === picks.bite) g.saves++;
        if (picks.bite && picks.heal) g.heals++;
        if (picks.poison) g.poisoned = { by: witch, t: picks.poison, day: g.day };
        g.st = r.state;
        r.dead.forEach(function (id) { g.deaths.push({ id: id, day: g.day, how: 'night' }); });
        g.lastNight = r.dead;
        if (finishIf()) return;
        startDay();
    }
    function startDay() { g.phase = 'day'; sel = null; g.tags = {}; botsTalk(); }
    function botsTalk() {
        var t = AI.talk(g), mine = g.tags[g.me];
        t.claims.forEach(function (c) { g.claims.push(c); });
        g.tags = t.tags; if (mine) g.tags[g.me] = mine;
    }
    function say(k, t, wolf) {
        if (!meAlive() || g.phase !== 'day' || !t || t === g.me || !g.st.alive[t]) return;
        var day = g.day, me = g.me;
        g.said = g.said.filter(function (x) { return !(x.by === me && x.day === day); });
        g.claims = g.claims.filter(function (x) { return !(x.by === me && x.day === day); });
        if (k === 'claim') {
            var real = myRole() === 'seer' && g.checks[me] && (t in g.checks[me]) && g.checks[me][t] === !!wolf;
            g.claims.push({ by: me, day: day, t: t, wolf: !!wolf, fake: !real });
            g.tags[me] = { k: 'claim', t: t, wolf: !!wolf };
        } else {
            g.said.push({ day: day, by: me, k: k, t: t });
            g.tags[me] = { k: k, t: t };
        }
        botsTalk();   // the bots re-read the table after you speak
    }
    function toVote() {
        Object.keys(g.tags).forEach(function (b) { var x = g.tags[b]; if (b !== g.me && (x.k === 'sus' || x.k === 'trust')) g.said.push({ day: g.day, by: b, k: x.k, t: x.t, soft: !!x.soft }); });
        g.phase = 'vote'; sel = null; g.botVotes = AI.votes(g);
    }
    function castVote(t) {
        var v = {}; Object.keys(g.botVotes || {}).forEach(function (b) { v[b] = g.botVotes[b]; });
        if (meAlive()) v[g.me] = t || 'skip';
        var r = W.tallyVotes(g.st, v);
        Object.keys(v).forEach(function (b) { g.votes.push({ day: g.day, by: b, t: v[b] }); });
        g.lastVote = { out: r.out, counts: r.counts };
        if (r.out) { g.st = W.eliminate(g.st, r.out); g.deaths.push({ id: r.out, day: g.day, how: 'vote' }); }
        if (finishIf()) return;
        g.day++; startNight();
    }

    // ---- drawing ----------------------------------------------------------------------------------------
    function root() {
        var m = document.getElementById('wolfModal');
        if (!m) {
            m = document.createElement('div'); m.id = 'wolfModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Werewolf');
            m.innerHTML = '<div class="modal-content"><div id="ww-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) WW.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function render() {
        var m = root(), html = !g ? lobbyHtml() : g.phase === 'role' ? roleHtml() : g.phase === 'night' ? nightHtml() : g.phase === 'day' ? dayHtml() : g.phase === 'vote' ? voteHtml() : endHtml();
        m.classList.toggle('dark', !!g && g.phase === 'night');
        document.getElementById('ww-body').innerHTML = html;
    }
    function top(title, pills) { return '<div class="ww-top"><h3>' + title + '</h3>' + (pills || '') + '<button type="button" class="ww-x" onclick="WW.back()" aria-label="Close">✕</button></div>'; }
    function pill(s, cls) { return '<span class="ww-pill' + (cls ? ' ' + cls : '') + '">' + s + '</span>'; }
    function rolePill() { return pill(E[myRole()] + ' ' + (meAlive() ? 'คุณ' : '💀'), 'acc'); }
    function count() { return pill('👥 ' + alive().length + '/' + g.n); }
    function tagHtml(id) {
        if (!g.st.alive[id]) return '<span class="tag' + (g.st.roles[id] === 'wolf' ? ' r' : '') + '">' + E[g.st.roles[id]] + ' ' + RNAME[g.st.roles[id]] + '</span>';
        var x = g.tags[id]; if (!x || x.k === 'quiet') return '';
        if (x.k === 'sus') return '<span class="tag r">🤨 ' + esc(nm(x.t)) + '</span>';
        if (x.k === 'trust') return '<span class="tag g">👍 ' + esc(nm(x.t)) + '</span>';
        return '<span class="tag v">🔮 ' + esc(nm(x.t)) + ' ' + (x.wolf ? '🐺' : '👤') + '</span>';
    }
    /* What only I know about a seat, in its top-right corner: my wolf mates, my 🔮 checks. */
    function mark(id) {
        if (id === g.me || !g.st.alive[id]) return '';
        if (myRole() === 'wolf' && g.st.roles[id] === 'wolf') return '<span class="mk">🐺</span>';
        var c = g.checks[g.me]; if (c && (id in c)) return '<span class="mk">' + (c[id] ? '🐺' : '👤') + '</span>';
        return '';
    }
    /** opts: { can(id) → tappable, on: selected id, votes: { id: n }, tags: bool } */
    function seats(opts) {
        var h = '<div class="ww-seats">';
        g.ids.forEach(function (id, i) {
            var dead = !g.st.alive[id], can = !dead && opts.can && opts.can(id);
            var cls = 'ww-seat' + (id === g.me ? ' me' : '') + (dead ? ' dead' : '') + (can ? ' pick' : '') + (opts.on === id ? ' on' : '');
            h += '<button type="button" class="' + cls + '" data-id="' + id + '"' + (can ? ' onclick="WW.tap(\'' + id + '\')"' : ' disabled') + '>'
                + '<span class="n">' + (i + 1) + '</span>' + (opts.votes && opts.votes[id] ? '<span class="vc">' + opts.votes[id] + '</span>' : mark(id))
                + '<span class="f">' + (dead ? '💀' : g.faces[id]) + '</span>' + esc(nm(id)) + (opts.tags === false && !dead ? '' : tagHtml(id)) + '</button>';
        });
        return h + '</div>';
    }
    function deadWords(list) { return list && list.length ? list.map(function (id) { return '💀 ' + esc(nm(id)) + ' ' + E[g.st.roles[id]]; }).join(' · ') : 'คืนสงบ ไม่มีใครตาย'; }
    function voteWords() { var v = g.lastVote; return !v ? '' : v.out ? '🗳 ' + esc(nm(v.out)) + ' ถูกโหวตออก ' + E[g.st.roles[v.out]] : '🗳 เสมอ · ไม่มีใครออก'; }

    function lobbyHtml() {
        var c = W.defaultCounts(ui.n), h = '<div class="ww">' + top('🐺 มนุษย์หมาป่า', pill('🤖 เล่นกับบอท', 'acc'));
        h += '<div class="ww-row"><span class="ww-mini">👥 คน</span>' + [5, 7, 9].map(function (n) { return '<button type="button" class="ww-chip' + (ui.n === n ? ' on' : '') + '" onclick="WW.set(\'n\',' + n + ')">' + n + '</button>'; }).join('') + '</div>';
        h += '<div class="ww-row"><span class="ww-mini">🎭 บท</span>' + W.ROLES.filter(function (r) { return c[r]; }).map(function (r) { return '<span class="ww-chip ro">' + E[r] + ' ' + c[r] + '</span>'; }).join('') + '</div>';
        h += '<div class="ww-row"><span class="ww-mini">🤖 บอท</span>' + [1, 2, 3].map(function (l) { return '<button type="button" class="ww-chip' + (ui.level === l ? ' on' : '') + '" onclick="WW.set(\'level\',' + l + ')">' + '🥄'.repeat(l) + '</button>'; }).join('') + '</div>';
        h += '<button type="button" class="ww-primary" id="ww-start" onclick="WW.start()">▸ เริ่ม · บทสุ่ม</button>';
        var games = store.games.slice().sort(function (a, b) { return b.upd - a.upd; });
        if (games.length) {
            var cur = games.filter(function (x) { return x.status === 'playing'; })[0];
            h += '<div class="ww-lbl">🎮 ' + games.length + '</div>';
            games.forEach(function (x) {
                var r = E[x.st.roles[x.me]], fin = x.status === 'finished', won = fin && ((x.result.winner === 'wolf') === (x.st.roles[x.me] === 'wolf'));
                var bar = fin ? (won ? ' r-w' : ' r-l') : ' r-p';
                var words = fin ? r + ' คุณ · ' + (won ? '🏆' : '💀') + ' วัน ' + x.result.day : r + ' คุณ · ' + (x.phase === 'night' ? '🌙 คืน ' : '☀️ วัน ') + x.day + ' · 👥 ' + W.aliveIds(x.st.alive).length + '/' + x.n;
                h += '<button type="button" class="ww-game' + bar + (x === cur ? ' cur' : '') + '" data-game="' + x.id + '" onclick="WW.resume(\'' + x.id + '\')">' + words + '<span class="go">' + (fin ? '↺' : '▸') + '</span></button>';
            });
        } else h += '<div class="ww-empty" id="ww-empty">🎮 ยังไม่มีเกม · เลือกจำนวนคน แล้ว ▸ เริ่ม</div>';
        return h + '</div>';
    }
    function roleHtml() {
        var r = myRole(), mates = r === 'wolf' ? alive().filter(function (id) { return id !== g.me && g.st.roles[id] === 'wolf'; }) : [];
        var c = W.defaultCounts(g.n);
        return '<div class="ww' + (r === 'wolf' ? ' wolf' : '') + '">' + top('🎭 บทของคุณ')
            + '<div class="ww-card"><div class="big">' + E[r] + '</div><h4>' + RNAME[r] + '</h4><p>' + RHOW[r] + '</p>'
            + (mates.length ? '<p class="mates">🐺 เพื่อน: ' + mates.map(function (id) { return g.faces[id] + ' ' + esc(nm(id)); }).join(' · ') + '</p>' : '') + '</div>'
            + '<div class="ww-note">' + W.ROLES.filter(function (x) { return c[x]; }).map(function (x) { return E[x] + ' ' + c[x]; }).join(' · ') + ' · ใครเป็นอะไร ไม่มีใครรู้</div>'
            + '<button type="button" class="ww-primary" id="ww-go" onclick="WW.night()">🌙 เข้าสู่คืนแรก</button></div>';
    }
    function nightHtml() {
        var r = myRole(), d = g.draft, me = g.me, h = '', ask = '', btn = '', can = null, on = sel;
        var note = g.lastVote && g.day > 1 ? voteWords() : '';
        if (!meAlive()) { ask = '💀 ดูอยู่'; btn = '☀️ ไปเช้า'; }
        else if (r === 'wolf') {
            ask = '🐺 กัดใคร?'; can = function (id) { return g.st.roles[id] !== 'wolf'; }; on = d.bite || sel;
            btn = d.bite ? '🐺 กัด ' + esc(nm(d.bite)) + ' ▸' : '';
        } else if (r === 'seer') {
            var done = g.checks[me] || {};
            if (d.seer) { ask = '🔮 ' + esc(nm(d.seer)) + ' = ' + (done[d.seer] ? '🐺 หมาป่า' : '👤 ไม่ใช่หมาป่า'); btn = '☀️ ไปเช้า'; on = d.seer; }
            else { ask = '🔮 เช็กใคร?'; can = function (id) { return id !== me && !(id in done); }; btn = sel ? '🔮 ดู ' + esc(nm(sel)) : ''; }
        } else if (r === 'guard') {
            ask = '🛡️ คุ้มกันใคร?'; can = function (id) { return id !== g.st.lastGuard; }; on = d.guard || sel;
            if (g.st.lastGuard) note = (note ? note + ' · ' : '') + 'เมื่อคืนคุ้มกัน ' + esc(nm(g.st.lastGuard)) + ' · คืนนี้เลือกคนอื่น';
            btn = d.guard ? '🛡️ คุ้มกัน ' + esc(nm(d.guard)) + ' ▸' : '';
        } else if (r === 'witch' && (g.st.witch.heal || g.st.witch.poison)) {
            ask = '🧪 ใช้ยาไหม?'; on = d.poison || null;
            if (d.aim) { can = function (id) { return id !== me; }; on = d.poison || sel; }
            note = (note ? note + ' · ' : '') + (d.bite ? '🐺 คืนนี้กัด ' + esc(nm(d.bite)) : '🐺 คืนนี้ไม่มีใครถูกกัด');
            btn = '☀️ ไปเช้า';
        } else { ask = '😴 หลับตา…'; btn = '☀️ ไปเช้า'; }
        h += '<div class="ww">' + top('🌙 คืน ' + g.day, pill(ask, 'ask'));
        h += seats({ can: can, on: on, tags: false });
        if (note) h += '<div class="ww-note" id="ww-night-note">' + note + '</div>';
        if (meAlive() && r === 'witch' && (g.st.witch.heal || g.st.witch.poison)) {
            h += '<div class="ww-row">';
            if (g.st.witch.heal && d.bite) h += '<button type="button" class="ww-chip' + (d.heal ? ' on' : '') + '" id="ww-heal" onclick="WW.heal()">💊 ชุบ ' + esc(nm(d.bite)) + '</button>';
            if (g.st.witch.poison) h += '<button type="button" class="ww-chip' + (d.aim ? ' on' : '') + '" id="ww-poison" onclick="WW.aim()">☠️ วางยา' + (d.poison ? ' ' + esc(nm(d.poison)) : '') + '</button>';
            h += '</div>';
        }
        if (r === 'seer' && meAlive() && !d.seer && sel) btn = '🔮 ดู ' + esc(nm(sel));
        h += '<button type="button" class="ww-primary" id="ww-night-go" onclick="WW.nightGo()"' + (btn ? '' : ' disabled') + '>' + (btn || ({ wolf: '🐺 แตะคนที่จะกัด', seer: '🔮 แตะคนที่จะเช็ก' }[r] || '🛡️ แตะคนที่จะคุ้มกัน')) + '</button>';
        return h + '</div>';
    }
    function dayHtml() {
        var h = '<div class="ww">' + top('☀️ วัน ' + g.day, count() + rolePill());
        h += seats({ can: meAlive() ? function (id) { return id !== g.me; } : null, on: sel });
        var lines = [];
        if (g.lastNight) lines.push('🌙 ' + deadWords(g.lastNight));
        if (g.checks[g.me] && Object.keys(g.checks[g.me]).length) lines.push('🔮 ' + Object.keys(g.checks[g.me]).map(function (id) { return esc(nm(id)) + ' ' + (g.checks[g.me][id] ? '🐺' : '👤'); }).join(' · '));
        h += '<div class="ww-note" id="ww-day-note">' + lines.join('<br>') + (meAlive() && !sel ? (lines.length ? '<br>' : '') + 'แตะที่นั่ง แล้วเลือกคำพูด' : '') + '</div>';
        if (meAlive() && sel) {
            var n = esc(nm(sel));
            h += '<div class="ww-say" id="ww-say"><button type="button" class="ww-chip" onclick="WW.say(\'sus\')">🤨 สงสัย ' + n + '</button><button type="button" class="ww-chip" onclick="WW.say(\'trust\')">👍 เชื่อ ' + n + '</button>'
                + '<button type="button" class="ww-chip" onclick="WW.say(\'claim\',true)">🔮 ' + n + ' 🐺</button><button type="button" class="ww-chip" onclick="WW.say(\'claim\',false)">🔮 ' + n + ' 👤</button></div>';
        }
        h += '<button type="button" class="ww-primary" id="ww-to-vote" onclick="WW.toVote()">🗳 ไปโหวต</button>';
        return h + '</div>';
    }
    function voteHtml() {
        var counts = {}; Object.keys(g.botVotes || {}).forEach(function (b) { var t = g.botVotes[b]; if (t !== 'skip') counts[t] = (counts[t] || 0) + 1; });
        var skips = Object.keys(g.botVotes || {}).filter(function (b) { return g.botVotes[b] === 'skip'; }).length;
        var h = '<div class="ww wolf">' + top('🗳 โหวต วัน ' + g.day, count());
        h += seats({ can: meAlive() ? function (id) { return id !== g.me; } : null, on: sel, votes: counts });
        h += '<div class="ww-row">' + (meAlive() ? '<button type="button" class="ww-chip' + (sel === 'skip' ? ' on' : '') + '" id="ww-skip" onclick="WW.tap(\'skip\')">⏭ ข้าม</button>' : '')
            + '<span class="ww-note">' + (skips ? '⏭ ' + skips + ' · ' : '') + 'เสมอ = ไม่มีใครออก</span></div>';
        var label = !meAlive() ? '▸ นับโหวต' : sel === 'skip' ? '⏭ ข้าม' : sel ? '🗳 โหวต ' + esc(nm(sel)) : '🗳 แตะคนที่จะโหวต';
        h += '<button type="button" class="ww-primary" id="ww-vote" onclick="WW.vote()"' + (meAlive() && !sel ? ' disabled' : '') + '>' + label + '</button>';
        return h + '</div>';
    }
    function endHtml() {
        var w = g.result.winner, mine = (w === 'wolf') === (myRole() === 'wolf');
        var h = '<div class="ww">' + top((w === 'wolf' ? '🐺 หมาป่าชนะ' : '🏆 ฝั่งชาวบ้านชนะ'), pill(mine ? '🎉 คุณชนะ' : '😵 คุณแพ้', mine ? 'win' : 'lose'));
        h += '<div class="ww-res" id="ww-res">';
        var order = g.ids.slice().sort(function (a, b) { return W.ROLES.indexOf(g.st.roles[a]) - W.ROLES.indexOf(g.st.roles[b]); });
        order.forEach(function (id) {
            var r = g.st.roles[id], dd = g.deaths.filter(function (x) { return x.id === id; })[0], bits = [];
            bits.push(dd ? (dd.how === 'vote' ? '💀 โหวตออก วัน ' + dd.day : '💀 ตายคืน ' + dd.day) : '✅ รอด');
            var cl = g.claims.filter(function (c) { return c.by === id; });
            if (cl.some(function (c) { return c.fake; })) bits.push('🤥 อ้างว่าเป็น 🔮');
            else if (cl.length) bits.push('🔮 บอกจริง ' + cl.length + ' ครั้ง');
            if (r === 'guard' && g.saves) bits.push('🛡️ กันกัดได้ ' + g.saves);
            if (r === 'witch') { if (g.heals) bits.push('💊 ชุบ ' + g.heals); if (g.poisoned) bits.push('☠️ ' + esc(nm(g.poisoned.t))); }
            h += '<div class="r' + (id === g.me ? ' me' : '') + '"><b>' + E[r] + ' ' + esc(nm(id)) + '</b>' + bits.join(' · ') + '</div>';
        });
        h += '</div><button type="button" class="ww-primary" id="ww-again" onclick="WW.again()">↺ เล่นใหม่</button>';
        return h + '</div>';
    }

    // ---- actions ----------------------------------------------------------------------------------------
    function put() { store.games = store.games.filter(function (x) { return x.id !== g.id; }); store.games.unshift(g); store.games = store.games.slice(0, MAX_GAMES); save(); }
    window.WW = {
        open: function () { store = load(); g = null; sel = null; render(); root().style.display = 'flex'; },
        close: function () { if (g) put(); else save(); var m = document.getElementById('wolfModal'); if (m) m.style.display = 'none'; },
        back: function () { if (g) { put(); g = null; sel = null; render(); } else WW.close(); },
        set: function (k, v) { ui[k] = v; render(); },
        start: function () { g = newGame(ui.n, ui.level); put(); render(); },
        resume: function (id) { g = store.games.filter(function (x) { return x.id === id; })[0] || null; sel = null; render(); },
        again: function () { var n = g.n, l = g.level; put(); g = newGame(n, l); put(); render(); },
        night: function () { startNight(); put(); render(); },
        tap: function (id) {
            if (g.phase === 'night') {
                var r = myRole();
                if (r === 'wolf') g.draft.bite = id; else if (r === 'guard') g.draft.guard = id;
                else if (r === 'witch' && g.draft.aim) g.draft.poison = id;
                else sel = id;
            } else sel = sel === id ? null : id;
            render();
        },
        heal: function () { g.draft.heal = !g.draft.heal; render(); },
        aim: function () { if (g.draft.aim) { g.draft.aim = false; g.draft.poison = null; } else g.draft.aim = true; render(); },
        nightGo: function () {
            if (meAlive() && myRole() === 'seer' && !g.draft.seer && sel) {   // see the answer first, then ☀️
                g.draft.seer = sel; g.checks[g.me] = g.checks[g.me] || {}; g.checks[g.me][sel] = g.st.roles[sel] === 'wolf'; sel = null; put(); render(); return;
            }
            endNight(); put(); render();
        },
        say: function (k, wolf) { say(k, sel, wolf); sel = null; put(); render(); },
        toVote: function () { toVote(); put(); render(); },
        vote: function () { castVote(sel); sel = null; put(); render(); },
        // for scripts/wolf-solo-qa.cjs
        _game: function () { return g; }, _rng: function (f) { rng = f; }
    };
    window.wolfOpen = function () { WW.open(); };
})();
