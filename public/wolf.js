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
        wolf: 'ทุกคืนเลือกกัด 1 คน',
        seer: 'ทุกคืนเช็ก 1 คน ว่าเป็น 🐺 ไหม',
        guard: 'ทุกคืนเลือกคุ้มกัน 1 คน · ห้ามคนเดิม 2 คืนติด',
        witch: '💊 ชุบคนถูกกัด 1 ครั้ง · ☠️ วางยา 1 ครั้ง',
        villager: 'ไม่มีพลัง · หาหมาป่าจากคำพูดแล้วโหวตออก'
    };
    var E = W.EMOJI, MAX_GAMES = 10;
    // V101.355 (owner picks B + L4 + card A, mockup-werewolf-lobby-ux/): role tiles with a short name, a one-line tip under the tapped
    // tile, the bot level as three nights (dark tiles like the game's night), the side's 🏆 goal on the role card
    var SHORT = { wolf: 'หมาป่า', seer: 'ผู้หยั่งรู้', guard: 'การ์ด', witch: 'แม่มด', villager: 'ชาวบ้าน' };
    var TIP = { wolf: 'กัด 1 คนทุกคืน · ชนะเมื่อเท่ากับคนที่เหลือ', seer: 'ส่อง 1 คนทุกคืน ว่าเป็น 🐺 ไหม', guard: 'คุ้มกัน 1 คนทุกคืน · ห้ามคนเดิม 2 คืนติด',
        witch: '💊 ชุบคนถูกกัด 1 ครั้ง · ☠️ วางยา 1 ครั้ง', villager: 'ไม่มีพลัง · หา 🐺 จากคำพูดแล้วโหวตออก' };
    // V101.359 (owner pick C, round3): the chosen night says what the bots do, in one line under the row (like the role tip)
    var LVTIP = { 1: 'บอทเดาเกือบสุ่ม · เหมาะเล่นครั้งแรก', 2: 'บอทจำว่าใครพูดอะไร · 🔮 เปิดตัว · 🐺 แย้งกลับ', 3: 'บอทหลอกเก่ง · 🐺 อาจอ้างเป็น 🔮' };
    // V101.360 (owner pick B, mockup-werewolf-telegram-guide/): play with friends — the Telegram bot (no bots in the game). One row under
    // ▸ เริ่ม; a tap opens the guide in place (▾ / ▴), a tap on the row again folds it. The bot is public (@NikaWerewolf_bot), no token here.
    var TG_BOT = 'NikaWerewolf_bot';
    var NIGHTS = [[1, '🌆', 'หัวค่ำ', 'ง่าย'], [2, '🌙', 'เที่ยงคืน', 'กลาง'], [3, '🌕', 'คืนเดือนเพ็ญ', 'ยาก']];
    function goal(r) { return r === 'wolf' ? '🏆 ชนะเมื่อ 🐺 เท่ากับคนที่เหลือ' : '🏆 ชนะเมื่อ 🐺 ออกครบ'; }

    function key() { var u = ''; try { u = typeof userId !== 'undefined' ? userId : ''; } catch (_) { /* not declared */ } return 'wolf_v1_' + (u || 'anon'); }
    function load() { try { var d = JSON.parse(localStorage.getItem(key()) || 'null'); if (d && Array.isArray(d.games)) return d; } catch (_) { /* blocked storage */ } return { games: [] }; }
    function save() { if (g) g.upd = Date.now(); try { localStorage.setItem(key(), JSON.stringify(store)); } catch (_) { /* storage may be blocked (LIFF) */ } }

    var store = { games: [] }, g = null, sel = null;     // g = the open game; sel = the tapped seat
    var ui = { n: 7, level: 2, tip: 'wolf' };
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
    // V101.357 sound (owner pick B, wolf-sound.js): every cue comes from a tap
    function snd(k) { if (window.WWSound) WWSound.play(k); }
    function finishIf() {
        var w = W.winner(g.st); if (!w) return false;
        g.status = 'finished'; g.phase = 'over'; g.result = { winner: w, day: g.day };
        snd((w === 'wolf') === (myRole() === 'wolf') ? 'win' : 'lose');
        return true;
    }
    function startNight() {
        g.phase = 'night'; g.draft = {}; sel = null; g.tags = {};
        // the wolves' bite is fixed before the witch looks, so a 🧪 player sees the real victim
        if (!(meAlive() && myRole() === 'wolf')) g.draft.bite = W.wolfTarget(AI.wolfVotes(g, rng), rng);
        else g.draft.mates = AI.wolfVotes(g, rng);   // V101.358 (owner pick A): your bot mates say who they want — you still decide
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
        snd(r.dead.length ? 'death' : 'morning');
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
        snd('vote');
    }
    function castVote(t) {
        var v = {}; Object.keys(g.botVotes || {}).forEach(function (b) { v[b] = g.botVotes[b]; });
        if (meAlive()) v[g.me] = t || 'skip';
        var r = W.tallyVotes(g.st, v);
        Object.keys(v).forEach(function (b) { g.votes.push({ day: g.day, by: b, t: v[b] }); });
        g.lastVote = { out: r.out, counts: r.counts };
        if (r.out) { g.st = W.eliminate(g.st, r.out); g.deaths.push({ id: r.out, day: g.day, how: 'vote' }); snd('out'); }
        if (finishIf()) return;
        g.day++; startNight();
        if (r.out) setTimeout(function () { snd('night'); }, 900); else snd('night');
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
        var m = root(), html = !g ? lobbyHtml() : ui.peek ? roleHtml(true) : g.phase === 'role' ? roleHtml() : g.phase === 'night' ? nightHtml() : g.phase === 'day' ? dayHtml() : g.phase === 'vote' ? voteHtml() : endHtml();
        m.classList.toggle('dark', !!g && g.phase === 'night' && !ui.peek);
        document.getElementById('ww-body').innerHTML = html;
        if (window.WWTour) WWTour.coach(coachKey());   // V101.357 (pick B): one hint at a time on the first real turn
        if (g && window.GameLog) { var fin = g.status === 'finished';   // V101.370 🎮 game time for the admin (game-log.js): a round = a night + a day
            GameLog.see('wolf', { id: g.id, n: fin ? g.day : g.day - 1, done: fin, mode: g.n + ' ' + g.level, win: fin && g.result ? ((g.result.winner === 'wolf') === (myRole() === 'wolf') ? 'w' : 'l') : null, score: fin && g.result ? 'D' + g.result.day : '' }); }
    }
    function coachKey() {
        if (!g || ui.peek || g.status !== 'playing' || !meAlive()) return null;
        if (g.phase === 'night') { var r = myRole(); if (r === 'witch' && !(g.st.witch.heal || g.st.witch.poison)) r = 'villager'; return 'night-' + r; }
        return g.phase === 'day' ? 'day' : g.phase === 'vote' ? 'vote' : null;
    }
    function top(title, pills, noSound) {   // V101.357: 🔊 / 🔇 in the game screens (the lobby header has ❓ instead — one row at 320 px)
        var on = !window.WWSound || WWSound.on();
        return '<div class="ww-top"><h3>' + title + '</h3>' + (pills || '') + (noSound ? '' : '<button type="button" class="ww-x" id="ww-snd" onclick="WW.snd()" aria-label="Sound" aria-pressed="' + on + '">' + (on ? '🔊' : '🔇') + '</button>')
            + '<button type="button" class="ww-x"' + (noSound ? '' : ' style="margin-left:6px"') + ' onclick="WW.back()" aria-label="Close">✕</button></div>';
    }
    function pill(s, cls) { return '<span class="ww-pill' + (cls ? ' ' + cls : '') + '">' + s + '</span>'; }
    function rolePill() { return '<button type="button" class="ww-pill acc ww-me" id="ww-me" onclick="WW.peek(true)" title="ดูบทของคุณ">' + E[myRole()] + ' ' + (meAlive() ? 'คุณ' : '💀') + '</button>'; }   // V101.355: tap = the role card again
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
                + '<span class="f">' + (dead ? '💀' : g.faces[id]) + '</span>' + esc(nm(id)) + (opts.tags === false && !dead ? '' : tagHtml(id)) + (opts.extra && !dead ? opts.extra(id) : '') + '</button>';
        });
        return h + '</div>';
    }
    function deadWords(list) { return list && list.length ? list.map(function (id) { return '💀 ' + esc(nm(id)) + ' ' + E[g.st.roles[id]]; }).join(' · ') : 'คืนสงบ ไม่มีใครตาย'; }
    function voteWords() { var v = g.lastVote; return !v ? '' : v.out ? '🗳 ' + esc(nm(v.out)) + ' ถูกโหวตออก ' + E[g.st.roles[v.out]] : '🗳 เสมอ · ไม่มีใครออก'; }

    function lobbyHtml() {
        var c = W.defaultCounts(ui.n), was = ui.prevN ? W.defaultCounts(ui.prevN) : null, h = '<div class="ww ww-lobby">' + top('🐺 มนุษย์หมาป่า', pill('🤖<span class="tx"> เล่นกับบอท</span>', 'acc') + (window.WWTour ? '<button type="button" class="ww-pill ww-help" id="ww-help" onclick="WWTour.open()" title="วิธีเล่น">❓</button>' : ''), true) + (window.GameTop ? GameTop.line('wolf') : '');   // V101.375 🏆 Top 3
        h += '<div class="ww-row"><span class="ww-mini">👥 คน</span>' + [5, 7, 9].map(function (n) { return '<button type="button" class="ww-chip' + (ui.n === n ? ' on' : '') + '" onclick="WW.set(\'n\',' + n + ')">' + n + '</button>'; }).join('') + '</div>';
        var rs = W.ROLES.filter(function (r) { return c[r]; }), tip = rs.indexOf(ui.tip) >= 0 ? ui.tip : null;
        h += '<div class="ww-tiles" id="ww-roles" style="grid-template-columns:repeat(' + rs.length + ',minmax(0,1fr))">' + rs.map(function (r) {
            return '<button type="button" class="ww-tile' + (tip === r ? ' on' : '') + (was && was[r] !== c[r] ? ' bump' : '') + '" data-role="' + r + '" aria-pressed="' + (tip === r) + '" onclick="WW.set(\'tip\',\'' + (tip === r ? '' : r) + '\')"><span class="e">' + E[r] + '</span>' + SHORT[r] + '<b>' + c[r] + '</b></button>';
        }).join('') + '</div>';
        if (tip) h += '<div class="ww-tip" id="ww-tip">' + E[tip] + ' <b>' + SHORT[tip] + '</b> ' + TIP[tip] + '</div>';
        h += '<div class="ww-nights" id="ww-levels" role="group" aria-label="Bot level">' + NIGHTS.map(function (x) {
            return '<button type="button" class="' + (ui.level === x[0] ? 'on' : '') + '" aria-pressed="' + (ui.level === x[0]) + '" onclick="WW.set(\'level\',' + x[0] + ')"><i>' + x[1] + '</i>' + x[2] + '<small>' + x[3] + '</small></button>';
        }).join('') + '</div>';
        var lv = NIGHTS.filter(function (x) { return x[0] === ui.level; })[0];
        if (lv) h += '<div class="ww-lvtip" id="ww-lvtip">' + lv[1] + ' <b>' + lv[2] + '</b> ' + LVTIP[lv[0]] + '</div>';
        h += '<button type="button" class="ww-primary" id="ww-start" onclick="WW.start()">▸ เริ่มเกม · สุ่มบท</button>';
        h += '<button type="button" class="ww-tgrow' + (ui.tg ? ' open' : '') + '" id="ww-tgrow" aria-expanded="' + !!ui.tg + '" onclick="WW.tg()"><span>✈️</span><span>เล่นกับเพื่อนใน Telegram · ไม่มีบอท</span><span class="ar">' + (ui.tg ? '▴' : '▾') + '</span></button>';
        if (ui.tg) h += '<div class="ww-tg" id="ww-tg">'
            + '<ol><li><i>➕</i><span>เพิ่มบอทเข้ากลุ่ม Telegram ของแก๊ง</span></li><li><i>⌨️</i><span>ในกลุ่มพิมพ์ <b>/werewolf</b></span></li>'
            + '<li><i>👥</i><span>เพื่อน 5–10 คนกด <b>▸ เข้าร่วม</b> แล้วกด <b>Start</b> ในแชทบอท</span></li><li><i>🌙</i><span>หัวห้องกด <b>▸ เริ่ม</b> · บทส่งทาง DM · โหวตในกลุ่ม</span></li></ol>'
            + '<div class="ww-tgb"><button type="button" class="p" id="ww-tg-add" onclick="WW.tgOpen(\'add\')">➕ เพิ่มบอทเข้ากลุ่ม</button><button type="button" class="s" id="ww-tg-chat" onclick="WW.tgOpen(\'chat\')">💬 เปิดแชทบอท</button></div>'
            + '<div class="ww-tgnote">➕ จะเปิด Telegram ให้เลือกกลุ่ม · บอท @' + TG_BOT + '</div></div>';
        var games = store.games.slice().sort(function (a, b) { return b.upd - a.upd; });
        if (games.length) {
            var cur = games.filter(function (x) { return x.status === 'playing'; })[0];
            h += '<div class="ww-lbl">🎮 ' + games.length + '</div>';
            games.forEach(function (x) {
                var r = E[x.st.roles[x.me]], fin = x.status === 'finished', won = fin && ((x.result.winner === 'wolf') === (x.st.roles[x.me] === 'wolf'));
                var bar = fin ? (won ? ' r-w' : ' r-l') : ' r-p';
                var words = fin ? r + ' คุณ · วัน ' + x.result.day : r + ' คุณ · ' + (x.phase === 'night' ? '🌙 คืน ' : '☀️ วัน ') + x.day + ' · 👥 ' + W.aliveIds(x.st.alive).length + '/' + x.n;
                h += '<button type="button" class="ww-game' + bar + (x === cur ? ' cur' : '') + '" data-game="' + x.id + '" onclick="WW.resume(\'' + x.id + '\')">' + words + (fin ? '<span class="res ' + (won ? 'w' : 'l') + '">' + (won ? 'ชนะ' : 'แพ้') + '</span><span class="go" title="ดูผล" aria-label="ดูผล">👁</span>' : '<span class="go cont">▸ เล่นต่อ</span>') + '</button>';
            });
        } else h += '<div class="ww-empty" id="ww-empty">🎮 ยังไม่มีเกม · ▸ เริ่มได้เลย</div>';
        return h + '</div>';
    }
    function roleHtml(peek) {
        var r = myRole(), mates = r === 'wolf' ? g.ids.filter(function (id) { return id !== g.me && g.st.roles[id] === 'wolf'; }) : [];
        var c = W.defaultCounts(g.n);
        // V101.357 (owner pick A + flip-in, mockup-werewolf-card/): a colour per role (🐺 red · 🔮 violet · 🛡️ blue · 🧪 green · 👤 amber), ✨ บทพิเศษ
        // above a power role, the deck as an icon row with your role framed, a villager line, more air; the card turns in once (not on 👤 คุณ peek)
        var rs = W.ROLES.filter(function (x) { return c[x]; });
        return '<div class="ww ww-rolepg' + (r === 'wolf' ? ' wolf' : '') + '">' + top('🎭 บทของคุณ')
            + '<div class="ww-card r-' + r + (peek ? '' : ' flip') + '" id="ww-card">' + (r === 'villager' ? '' : '<div class="sp">✨ บทพิเศษ</div>') + '<div class="big">' + E[r] + '</div><h4>' + RNAME[r] + '</h4><p>' + RHOW[r] + '</p>'
            + (mates.length ? '<p class="mates">🐺 เพื่อน: ' + mates.map(function (id) { return g.faces[id] + ' ' + esc(nm(id)) + (g.st.alive[id] ? '' : ' 💀'); }).join(' · ') + '</p>' : '')
            + '<span class="ww-goal" id="ww-goal">' + goal(r) + '</span></div>'
            + '<div class="ww-cnt r-' + r + '" id="ww-cnt" style="grid-template-columns:repeat(' + rs.length + ',minmax(0,1fr))">' + rs.map(function (x) { return '<span class="' + (x === r ? 'me' : '') + '"><i>' + E[x] + '</i>' + SHORT[x] + ' <b>' + c[x] + '</b></span>'; }).join('') + '</div>'
            + (r === 'villager' ? '<div class="ww-vil" id="ww-vil">🌙 ชาวบ้านไม่ต้องทำอะไรตอนกลางคืน · กด 🌙 แล้วไปเช้าได้เลย</div>' : '')
            + (peek ? '<button type="button" class="ww-primary" id="ww-peek-back" onclick="WW.peek(false)">↩ กลับเกม</button>'
                : '<button type="button" class="ww-primary" id="ww-go" onclick="WW.night()">🌙 เข้าสู่คืนแรก</button>') + '</div>';
    }
    function nightHtml() {
        var r = myRole(), d = g.draft, me = g.me, h = '', ask = '', btn = '', can = null, on = sel, extra = null;
        var note = g.lastVote && g.day > 1 ? voteWords() : '';
        if (!meAlive()) { ask = '💀 ดูอยู่'; btn = '☀️ ไปเช้า'; }
        else if (r === 'wolf') {
            var mv = d.mates || {}, want = {};
            Object.keys(mv).forEach(function (m) { if (g.st.alive[m] && mv[m]) (want[mv[m]] = want[mv[m]] || []).push(m); });
            ask = '🐺 กัดใคร?' + (Object.keys(want).length ? ' · เพื่อนเลือกแล้ว' : ''); can = function (id) { return g.st.roles[id] !== 'wolf'; }; on = d.bite || sel;
            extra = function (id) {
                var ws = want[id]; if (!ws) return '';
                var why = g.level === 3 && AI.wolfWhy ? AI.wolfWhy(g, id) : null;
                return (g.level === 3 && ws.length > 1 ? '<span class="ww-wc">' + ws.length + '</span>' : '')
                    + '<span class="ww-want">🐺 ' + ws.map(function (m) { return esc(nm(m)); }).join(' · ') + '</span>'   // the pill already says เพื่อนเลือกแล้ว; the seat is too narrow for more
                    + (why ? '<span class="ww-why">' + why + '</span>' : '');
            };
            btn = d.bite ? '🐺 กัด ' + esc(nm(d.bite)) + ' ▸' : '';
        } else if (r === 'seer') {
            var done = g.checks[me] || {};
            if (d.seer) { ask = '🔮 ' + esc(nm(d.seer)) + ' = ' + (done[d.seer] ? '🐺 หมาป่า' : '👤 ไม่ใช่หมาป่า'); btn = '☀️ ไปเช้า'; on = d.seer; }
            else if (!alive().some(function (id) { return id !== me && !(id in done); })) { ask = '🔮 ส่องครบทุกคนแล้ว'; btn = '☀️ ไปเช้า'; }   // V101.356: nobody left to check — the night must still go on
            else { ask = '🔮 เช็กใคร?'; can = function (id) { return id !== me && !(id in done); }; btn = sel ? '🔮 ดู ' + esc(nm(sel)) : ''; }
        } else if (r === 'guard') {
            ask = '🛡️ คุ้มกันใคร?'; can = function (id) { return id !== g.st.lastGuard; }; on = d.guard || sel;
            if (g.st.lastGuard && g.st.alive[g.st.lastGuard]) note = (note ? note + ' · ' : '') + 'เมื่อคืนคุ้มกัน ' + esc(nm(g.st.lastGuard)) + ' · คืนนี้เลือกคนอื่น';   // V101.356: not about someone already dead
            btn = d.guard ? '🛡️ คุ้มกัน ' + esc(nm(d.guard)) + ' ▸' : '';
        } else if (r === 'witch' && (g.st.witch.heal || g.st.witch.poison)) {
            ask = '🧪 ใช้ยาไหม?'; on = d.poison || null;
            if (d.aim) { can = function (id) { return id !== me; }; on = d.poison || sel; }
            note = (note ? note + ' · ' : '') + (d.bite ? '🐺 คืนนี้กัด ' + esc(nm(d.bite)) : '🐺 คืนนี้ไม่มีใครถูกกัด');
            btn = '☀️ ไปเช้า';
        } else { ask = '😴 หลับตา…'; btn = '☀️ ไปเช้า'; }
        h += '<div class="ww">' + top('🌙 คืน ' + g.day, pill(ask, 'ask'));
        h += seats({ can: can, on: on, tags: false, extra: extra });
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
                + '<button type="button" class="ww-chip" onclick="WW.say(\'claim\',true)">🔮 อ้าง ' + n + ' 🐺</button><button type="button" class="ww-chip" onclick="WW.say(\'claim\',false)">🔮 อ้าง ' + n + ' 👤</button></div>';
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
        open: function () { store = load(); g = null; sel = null; ui.peek = false; render(); root().style.display = 'flex'; if (window.WWTour && !WWTour.seen()) WWTour.open(); },
        snd: function () { if (window.WWSound) WWSound.toggle(); render(); },
        close: function () { if (window.WWTour && WWTour.isOpen && WWTour.isOpen()) WWTour.close(); if (g) put(); else save(); var m = document.getElementById('wolfModal'); if (m) m.style.display = 'none'; },
        back: function () { if (ui.peek) { ui.peek = false; render(); return; } if (g) { put(); g = null; sel = null; render(); } else WW.close(); },
        peek: function (on) { ui.peek = !!on; render(); },
        tg: function () { ui.tg = !ui.tg; render(); },
        // t.me/<bot>?startgroup=… asks Telegram to pick a group and add the bot; outside LINE a new tab, inside LINE the phone's browser / app
        tgOpen: function (k) {
            var url = 'https://t.me/' + TG_BOT + (k === 'add' ? '?startgroup=werewolf' : '');
            try { if (window.liff && liff.isInClient && liff.isInClient()) { liff.openWindow({ url: url, external: true }); return url; } } catch (_) { /* fall through */ }
            window.open(url, '_blank', 'noopener'); return url;
        },
        set: function (k, v) { if (k === 'n' && ui.n !== v) ui.prevN = ui.n; ui[k] = v || null; if (k !== 'tip') ui[k] = v; render(); if (k === 'n') ui.prevN = null; },
        start: function () { g = newGame(ui.n, ui.level); put(); render(); },
        resume: function (id) { g = store.games.filter(function (x) { return x.id === id; })[0] || null; sel = null; ui.peek = false; render(); },
        again: function () { var n = g.n, l = g.level; put(); g = newGame(n, l); put(); render(); },
        night: function () { startNight(); put(); render(); snd('night'); },
        tap: function (id) {
            if (g.phase === 'night') {
                var r = myRole();
                if (r === 'wolf') { g.draft.bite = id; snd('bite'); } else if (r === 'guard') { g.draft.guard = id; snd('guard'); }
                else if (r === 'witch' && g.draft.aim) { g.draft.poison = id; snd('poison'); }
                else sel = id;
            } else sel = sel === id ? null : id;
            render();
        },
        heal: function () { g.draft.heal = !g.draft.heal; if (g.draft.heal) snd('heal'); render(); },
        aim: function () { if (g.draft.aim) { g.draft.aim = false; g.draft.poison = null; } else g.draft.aim = true; render(); },
        nightGo: function () {
            if (meAlive() && myRole() === 'seer' && !g.draft.seer && sel) {   // see the answer first, then ☀️
                g.draft.seer = sel; g.checks[g.me] = g.checks[g.me] || {}; g.checks[g.me][sel] = g.st.roles[sel] === 'wolf'; snd(g.checks[g.me][sel] ? 'seeWolf' : 'seeGood'); sel = null; put(); render(); return;
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
