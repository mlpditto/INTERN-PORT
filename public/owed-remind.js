// V101.228: "still to do" bottom sheet when the app opens (owner's pick A, mockup remind_png/A_sheet): Journal / Case not sent today + 📰 articles
// not read yet, with a short chime. Defaults (the owner did not answer the 7 questions, so the recommended ones):
// • Journal + Case count as owed on weekdays (the Schedule's own `schDailyTiles`), but only from 16:00 Bangkok (owner's pick from the journal history:
//   nobody sends before noon, median 19:00, 90% before 21:00) and never on Sat / Sun Bangkok (almost nobody sends then — the rows are skipped, the
//   simplest rule). An unread article counts at any hour, weekend included (live or "for new interns", not muted — the same articles the 📰 popup would pick). Quizzes closing soon are NOT here
//   (the red/amber chip and the LINE alert cover them); the daily check-in is not here either (it runs on open by itself).
// • Once a Bangkok day, first open that qualifies; "Later" (button / backdrop / Esc) three times in a row stops it until an item is done (the
//   owed count drops). Only inside the internship period (users.endDate; notAnInternship / admin preview / unregistered = never). Per device.
// • ONE popup a day: this sheet holds the slot — while it is pending or shown (`holds()`), the 📰 popup, the feedback reminder and the Know thyself
//   sheet stay quiet (they call holds()); if the 📰 popup, the feedback reminder or Know thyself already showed today, the sheet gives way.
//   With nothing to show (or outside the internship period) none of them change.
// • Rows go straight to the item (Journal tab / Case form / the article sheet — closing that = read). No new Firestore writes, no new rules.
// • Chime: a 2-note WebAudio ding made in code (no asset), once a day, ON by default, 🔔/🔕 on the sheet (saved on the device), vibrate 120 ms
//   where supported. Browsers / LINE LIFF may keep audio locked until a tap: then a hint says "Tap anywhere" and the chime plays on the first tap.
// Pure part (pending / inPeriod / decide / dailyDue) is exposed for the test; the DOM part is lazy.
(function () {
    'use strict';
    var KEY = 'owedRemind:', MUTE = 'owedRemind.mute', MAX_LATER = 3, ART_ROWS = 3, MAX_ROWS = 5, armed = false, tries = 0;
    var D = {
        en: { title: function (n) { return n === 1 ? '1 thing waiting for you' : n + ' things waiting for you'; }, sub: 'Each one is a tap away.', later: 'Later', journal: 'Journal', jh: 'not sent today', kase: 'Case', ch: 'not sent today',
            art: 'Read', go: { journal: '📝 Write Journal', case: '🩺 Add a Case', article: '📰 Read now' }, foot: 'Once a day · “Later” 3 times stops it', on: '🔔 Sound on', off: '🔕 Muted', tap: 'Tap anywhere to hear the chime', more: function (n) { return '+' + n + ' more'; }, close: 'Close' },
        th: { title: function (n) { return 'วันนี้ยังมีค้าง ' + n + ' อย่าง'; }, sub: 'แตะแล้วไปที่งานนั้นได้เลย', later: 'ภายหลัง', journal: 'Journal', jh: 'ยังไม่ได้ส่งวันนี้', kase: 'Case', ch: 'ยังไม่ได้ส่งวันนี้',
            art: 'อ่าน', go: { journal: '📝 เขียน Journal', case: '🩺 บันทึกเคส', article: '📰 อ่านเลย' }, foot: 'วันละครั้ง · กด “ภายหลัง” 3 ครั้งติดจะหยุดเตือน', on: '🔔 เปิดเสียง', off: '🔕 ปิดเสียง', tap: 'แตะที่ใดก็ได้เพื่อฟังเสียงเตือน', more: function (n) { return 'อีก ' + n + ' อย่าง'; }, close: 'ปิด' },
        ko: { title: function (n) { return '오늘 남은 일 ' + n + '개'; }, sub: '탭하면 바로 이동해요.', later: '나중에', journal: 'Journal', jh: '오늘 아직 안 보냄', kase: 'Case', ch: '오늘 아직 안 보냄',
            art: '읽기', go: { journal: '📝 Journal 쓰기', case: '🩺 케이스 쓰기', article: '📰 지금 읽기' }, foot: '하루 한 번 · "나중에"를 3번 누르면 멈춰요', on: '🔔 소리 켬', off: '🔕 소리 끔', tap: '아무 곳이나 탭하면 알림음이 나와요', more: function (n) { return '외 ' + n + '개'; }, close: '닫기' }
    };
    function lang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    function bkk(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
    function bkkHour(d) { return Number((d || new Date()).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false })) % 24; }
    function bkkWeekday(d) { return (d || new Date()).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' }); }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    // ---- pure rules (exposed for the test)
    // in: { journal: true|false|null (owed / done / not loaded yet), case: same, articles: [{id,title}], daily: bool } → ordered rows
    function pending(inp) {
        inp = inp || {}; var out = [];
        if (inp.daily && inp.journal === true) out.push({ k: 'journal' });
        if (inp.daily && inp.case === true) out.push({ k: 'case' });
        (inp.articles || []).forEach(function (a) { out.push({ k: 'article', id: a.id, title: a.title }); });
        return out;
    }
    // inside the internship period (inclusive): needs endDate; startDate optional; an open-ended account never gets it
    function inPeriod(me, today) {
        if (!me || me.notAnInternship || !me.endDate) return false;
        var e = String(me.endDate).slice(0, 10), s = me.startDate ? String(me.startDate).slice(0, 10) : '';
        return today <= e && (!s || today >= s);
    }
    // Journal / Case rows: from 16:00 Bangkok, Mon–Fri only (wd = 'Mon'…'Sun' in Bangkok)
    function dailyDue(hour, wd) { return hour >= 16 && wd !== 'Sat' && wd !== 'Sun'; }
    // state {day, later, n, chime} → {show, state}. count = owed rows now, today = Bangkok date string.
    function decide(state, count, today) {
        var st = { day: (state && state.day) || '', later: (state && state.later) || 0, n: state && typeof state.n === 'number' ? state.n : count, chime: (state && state.chime) || '' };
        if (count < st.n) st.later = 0;          // something was done since the last look
        st.n = count;
        return { show: count > 0 && st.day !== today && st.later < MAX_LATER, state: st };
    }
    // another popup already took today's slot → the sheet gives way. days = { art, fb, kt } Bangkok dates
    function others(days, today) { days = days || {}; return days.art === today || days.fb === today || days.kt === today; }

    function uid() { return typeof userId !== 'undefined' ? userId : ''; }
    function load(u) { try { return JSON.parse(localStorage.getItem(KEY + u) || 'null'); } catch (_) { return null; } }
    function save(u, st) { try { localStorage.setItem(KEY + u, JSON.stringify(st)); } catch (_) {} }
    function muted() { try { return localStorage.getItem(MUTE) === '1'; } catch (_) { return false; } }
    function setMuted(v) { try { if (v) localStorage.setItem(MUTE, '1'); else localStorage.removeItem(MUTE); } catch (_) {} }
    function me() { return typeof myOwnRow === 'function' ? myOwnRow() : (window.myUserDoc || {}); }
    function blocked() { var u = uid(); return !u || u === 'preview-admin' || (typeof isPreview !== 'undefined' && isPreview) || window.myRegistered === false; }
    function ls(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (_) { return {}; } }
    function otherDays(u) { var kt = ls('ktNudge:' + u).b || []; return { art: me().articlePopDay || '', fb: ls('fbRemind:' + u).day || '', kt: kt[kt.length - 1] || '' }; }

    // the rows from the app's own state; articles === null while the 📰 list is still loading
    function gather() {
        var tiles = typeof schDailyTiles === 'function' ? schDailyTiles() : [];
        var pas = typeof profileActivityState !== 'undefined' ? profileActivityState : {};
        function owed(kind, key) { var t = tiles.filter(function (x) { return x.kind === kind; })[0]; return t && pas[key] === 'ready' ? !t.done : null; }
        var arts = window.internArticles && typeof internArticles.owed === 'function' ? internArticles.owed() : [];
        return { journal: owed('j', 'logs'), case: owed('c', 'cases'), articles: arts, daily: dailyDue(bkkHour(), bkkWeekday()) };
    }
    function ctx() {
        if (blocked() || !window.myUserDoc) return null;
        var u = uid(), today = bkk();
        if (!inPeriod(me(), today)) return null;
        return { u: u, today: today };
    }

    // ---- chime (WebAudio, no asset). Returns 'played' | 'locked' | 'none'
    var ac = null;
    function ding() {
        var t = ac.currentTime;
        [[880, 0], [1320, 0.16]].forEach(function (n) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = 'sine'; o.frequency.value = n[0];
            g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(0.22, t + n[1] + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.4);
            o.connect(g); g.connect(ac.destination); o.start(t + n[1]); o.stop(t + n[1] + 0.45);
        });
        try { if (navigator.vibrate) navigator.vibrate(120); } catch (_) {}
    }
    function chime() {
        try {
            var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return 'none';
            ac = ac || new AC();
            if (ac.state === 'running') { ding(); return 'played'; }
            var p = ac.resume && ac.resume(); if (p && p.catch) p.catch(function () {});
            if (ac.state === 'running') { ding(); return 'played'; }
            return 'locked';
        } catch (_) { return 'none'; }
    }
    // after a tap the context can resume: ring then
    function chimeOnTap(done) {
        function tap() {
            document.removeEventListener('pointerdown', tap, true);
            try { var p = ac && ac.resume && ac.resume(); Promise.resolve(p).then(function () { if (ac && ac.state === 'running') { ding(); done(true); } else done(false); }, function () { done(false); }); } catch (_) { done(false); }
        }
        document.addEventListener('pointerdown', tap, true);
        return function () { document.removeEventListener('pointerdown', tap, true); };
    }

    function css() {
        if (document.getElementById('ord-css')) return;
        var s = document.createElement('style'); s.id = 'ord-css';
        s.textContent = '#ord-back{position:fixed;inset:0;z-index:10042;background:rgba(15,23,42,.5);animation:ordFade .15s ease-out}' +
            '#ord-sheet{position:fixed;left:0;right:0;bottom:0;z-index:10043;max-width:560px;margin:0 auto;box-sizing:border-box;border-radius:22px 22px 0 0;padding:10px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,#fff7ed 0%,#fff 60%);box-shadow:0 -10px 30px rgba(15,23,42,.2);color:#1e293b;font-family:Kanit,sans-serif;text-align:left;animation:ordUp .2s ease-out}' +
            '#ord-sheet .ord-grab{width:38px;height:4px;border-radius:2px;background:#fed7aa;margin:0 auto 10px}' +
            '#ord-sheet .ord-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
            '#ord-sheet .ord-bell{position:relative;flex:none;width:46px;height:46px;border-radius:14px;background:#ffedd5;display:flex;align-items:center;justify-content:center;font-size:24px}' +
            '#ord-sheet .ord-bell b{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:10px;background:#ea580c;color:#fff;font:800 12px/20px Kanit,sans-serif;text-align:center;padding:0 5px;box-sizing:border-box}' +
            '#ord-sheet h4{margin:0;font:800 17px/1.25 Kanit,sans-serif;color:#9a3412}#ord-sheet small{display:block;margin-top:1px;font-size:13px;color:#c2410c}' +
            '#ord-sheet .ord-row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;min-height:52px;margin:6px 0;padding:8px 12px;border:1px solid #fed7aa;border-radius:16px;background:#fff;font-family:inherit;color:inherit;text-align:left;cursor:pointer}' +
            '#ord-sheet .ord-ic{flex:none;font-size:22px;line-height:1}#ord-sheet .ord-tx{flex:1;min-width:0}#ord-sheet .ord-tx b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ord-sheet .ord-tx span{display:block;font-size:12.5px;color:#64748b}' +
            '#ord-sheet .ord-chip{flex:none;font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;background:#eef2ff;color:#4361ee}#ord-sheet .ord-arr{flex:none;color:#ea580c;font-weight:900}' +
            '#ord-sheet .ord-more{font-size:12px;color:#9a3412;text-align:center;margin:2px 0}' +
            '#ord-sheet .ord-btns{display:flex;gap:8px;margin-top:10px}#ord-sheet .ord-btns button{min-height:46px;border:0;border-radius:14px;font:800 14px Kanit,sans-serif;cursor:pointer}' +
            '#ord-later{flex:0 0 34%;background:#fff1e6;color:#9a3412}#ord-go{flex:1;background:linear-gradient(135deg,#fb923c,#f97316);color:#fff}' +
            '#ord-sheet .ord-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:#64748b}' +
            '#ord-sheet .ord-foot span{flex:1;min-width:0}#ord-sheet button{margin:0;width:auto}#ord-sheet .ord-row{width:100%}#ord-snd{flex:none;min-height:44px;border:1px solid #fed7aa;border-radius:999px;background:#fff7ed;color:#9a3412;font:800 12.5px Kanit,sans-serif;padding:0 12px;cursor:pointer}' +
            '#ord-tap{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#b45309}' +
            '#ord-sheet button:focus{outline:none}#ord-sheet button:focus-visible{outline:2px solid #fb923c;outline-offset:2px}' +
            '@keyframes ordUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}@keyframes ordFade{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){#ord-sheet,#ord-back{animation:none}}';
        document.head.appendChild(s);
    }

    function rowHtml(L, r) {
        if (r.k === 'article') return '<button type="button" class="ord-row" data-k="article" data-id="' + esc(r.id) + '"><span class="ord-ic" aria-hidden="true">📰</span><span class="ord-tx"><b>' + esc(r.title || '') + '</b></span><span class="ord-chip">' + esc(L.art) + '</span><span class="ord-arr" aria-hidden="true">›</span></button>';
        var j = r.k === 'journal';
        return '<button type="button" class="ord-row" data-k="' + r.k + '"><span class="ord-ic" aria-hidden="true">' + (j ? '📝' : '🩺') + '</span><span class="ord-tx"><b>' + (j ? L.journal : L.kase) + '</b><span>' + (j ? L.jh : L.ch) + '</span></span><span class="ord-arr" aria-hidden="true">›</span></button>';
    }
    // an article row shows at most ART_ROWS; the rest of the list is a "+n more"
    function visible(list) {
        var a = 0, out = [];
        list.forEach(function (r) { if (out.length >= MAX_ROWS) return; if (r.k === 'article') { if (a >= ART_ROWS) return; a++; } out.push(r); });
        return out;
    }
    function go(r) {
        try {
            if (r.k === 'journal') { if (typeof gotoLog === 'function') gotoLog(); }
            else if (r.k === 'case') { if (typeof gotoCaseSubmit === 'function') gotoCaseSubmit(); }
            else if (window.internArticles && typeof internArticles.openArticle === 'function') internArticles.openArticle(r.id);
        } catch (e) { console.warn('owedRemind go:', e); }
    }
    function show(list, c, st) {
        css();
        var L = D[lang()], rows = visible(list);
        var back = document.createElement('div'); back.id = 'ord-back';
        var sh = document.createElement('div'); sh.id = 'ord-sheet'; sh.className = 'lang-no-toggle'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-labelledby', 'ord-title');
        sh.innerHTML = '<div class="ord-grab"></div><div class="ord-head"><div class="ord-bell" aria-hidden="true">🔔<b>' + list.length + '</b></div><div><h4 id="ord-title">' + esc(L.title(list.length)) + '</h4><small>' + esc(L.sub) + '</small></div></div>' +
            rows.map(function (r) { return rowHtml(L, r); }).join('') +
            (list.length > rows.length ? '<div class="ord-more">' + esc(L.more(list.length - rows.length)) + '</div>' : '') +
            '<div class="ord-btns"><button type="button" id="ord-later">' + esc(L.later) + '</button><button type="button" id="ord-go">' + esc(L.go[list[0].k]) + '</button></div>' +
            '<div class="ord-foot"><span>' + esc(L.foot) + '</span><button type="button" id="ord-snd" aria-pressed="' + (muted() ? 'false' : 'true') + '">' + esc(muted() ? L.off : L.on) + '</button></div><div id="ord-tap" hidden>' + esc(L.tap) + '</div>';
        document.body.appendChild(back); document.body.appendChild(sh);
        // showing counts as today's look; Later adds one, opening an item does not
        st.day = c.today; save(c.u, st);
        var done = false, unTap = null;
        function close(item) {
            if (done) return; done = true;
            document.removeEventListener('keydown', onKey); if (unTap) unTap(); back.remove(); sh.remove();
            if (item) go(item); else { st.later += 1; save(c.u, st); }
        }
        function onKey(e) { if (e.key === 'Escape') close(null); }
        document.addEventListener('keydown', onKey);
        back.addEventListener('click', function () { close(null); });
        sh.addEventListener('click', function (e) {
            var t = e.target, snd = t.closest && t.closest('#ord-snd');
            if (snd) {
                setMuted(!muted()); var m = muted(); snd.textContent = m ? L.off : L.on; snd.setAttribute('aria-pressed', m ? 'false' : 'true');
                if (!m) chime();
                return;
            }
            if (t.closest && t.closest('#ord-later')) return close(null);
            if (t.closest && t.closest('#ord-go')) return close(list[0]);
            var row = t.closest && t.closest('.ord-row');
            if (row) close(list.filter(function (r) { return r.k === row.dataset.k && (r.k !== 'article' || r.id === row.dataset.id); })[0]);
        });
        // the chime: once a day, unless muted; if audio is still locked, the first tap rings it
        if (!muted() && st.chime !== c.today) {
            var r = chime();
            if (r === 'played') { st.chime = c.today; save(c.u, st); }
            else if (r === 'locked') {
                var tap = sh.querySelector('#ord-tap'); if (tap) tap.hidden = false;
                unTap = chimeOnTap(function (ok) { if (ok) { st.chime = c.today; save(c.u, st); } var t2 = document.getElementById('ord-tap'); if (t2) t2.hidden = true; });
            }
        }
        var g = sh.querySelector('#ord-go'); if (g) g.focus();
    }
    function busy() {
        if (['ord-back', 'art-back', 'fbr-back', 'cm-back', 'kt-back'].some(function (id) { return document.getElementById(id); })) return true;
        var g = document.getElementById('internGuideOverlay'); if (g && g.classList.contains('open')) return true;
        return Array.prototype.some.call(document.querySelectorAll('.modal'), function (m) { var d = m.style.display; return d === 'flex' || d === 'block' || m.classList.contains('open') || m.classList.contains('show'); });
    }
    // what the sheet would do right now: { c, list, d } or null
    function plan() {
        var c = ctx(); if (!c) return null;
        var g = gather(), list = pending({ journal: g.journal, case: g.case, articles: g.articles || [], daily: g.daily });
        var d = decide(load(c.u), list.length, c.today);
        return { c: c, list: list, d: d, wait: g.articles === null, others: others(otherDays(c.u), c.today) };
    }
    // true while the sheet has today's popup slot (open, shown today, or about to show): the 📰 popup, feedback reminder and Know thyself stay quiet
    function holds() {
        try {
            if (document.getElementById('ord-back')) return true;
            var p = plan(); if (!p) return false;
            if (p.d.state.day === p.c.today) return true;
            return p.d.show && !p.others;
        } catch (_) { return false; }
    }
    function check() {
        try {
            var p = plan(); if (!p) return;
            save(p.c.u, p.d.state);
            if (!p.d.show || p.others) return;
            if (p.wait && tries < 8) { tries++; return setTimeout(check, 1500); }   // the 📰 list has not answered yet
            if (busy()) { if (tries++ < 20) setTimeout(check, 3000); return; }
            show(p.list, p.c, p.d.state);
        } catch (e) { console.warn('owedRemind:', e); }
    }
    // armed from the users/{uid} snapshot, once per page load; waits a moment so the caches and the 📰 list have loaded
    function arm() { if (armed) return; armed = true; setTimeout(check, 3000); }
    window.owedRemind = { arm: arm, check: check, holds: holds, pending: pending, inPeriod: inPeriod, dailyDue: dailyDue, decide: decide, others: others, chime: chime, MAX_LATER: MAX_LATER };
})();
