// V101.160: reminder popup for quiz feedback not given yet ("Warm sunrise" look). Shown at most once a day when the app opens, only
// while today is inside the user's internship period (users.endDate; no end date or notAnInternship = never) and only for GRADED
// STANDARD quizzes without feedback (the same gate as the Give Feedback button). "Later" three times in a row (the × / backdrop / Esc
// count as Later) stops it until feedback has been given once — seen as the pending count dropping. State lives in localStorage only.
// Pure part (pending / decide) is exposed for the test; the DOM part is lazy.
(function () {
    'use strict';
    var KEY = 'fbRemind:', MAX_LATER = 3, armed = false;
    var D = {
        en: { title: function (n) { return n + (n === 1 ? ' quiz needs' : ' quizzes need') + ' your feedback'; }, sub: 'Quick — stars, a line, a topic.', later: 'Later', go: '💬 Give now', foot: 'Opens the newest · once a day', today: 'today', yest: 'yesterday', ago: function (d) { return d + ' days ago'; }, more: function (n) { return '+' + n + ' more'; }, close: 'Close' },
        th: { title: function (n) { return 'ค้าง ' + n + ' ควิซที่ยังไม่ได้ feedback'; }, sub: 'แป๊บเดียว — ดาว 1 บรรทัด 1 หัวข้อ', later: 'ภายหลัง', go: '💬 ให้เลย', foot: 'เปิดข้อล่าสุด · วันละครั้ง', today: 'วันนี้', yest: 'เมื่อวาน', ago: function (d) { return d + ' วันก่อน'; }, more: function (n) { return 'อีก ' + n + ' ข้อ'; }, close: 'ปิด' },
        ko: { title: function (n) { return '피드백이 필요한 퀴즈 ' + n + '개'; }, sub: '간단히 — 별점, 한 줄, 주제 하나.', later: '나중에', go: '💬 지금 남기기', foot: '가장 최근 퀴즈가 열려요 · 하루 한 번', today: '오늘', yest: '어제', ago: function (d) { return d + '일 전'; }, more: function (n) { return '외 ' + n + '개'; }, close: '닫기' }
    };
    function lang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    function bkk(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
    function ms(ts) { return ts && ts.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : Number(ts) || 0); }
    // quizzes: array of quiz docs; attempts: object quizId → attempt (quizAttemptsCache)
    function pending(attempts, quizzes) {
        var byId = {}; (quizzes || []).forEach(function (q) { byId[q.id] = q; });
        return Object.keys(attempts || {}).map(function (id) { return attempts[id]; }).filter(function (a) {
            var q = a && byId[a.quizId];
            return q && a.status === 'approved' && !q.isPoll && (q.quizType === 'standard' || !q.quizType) && !a.feedbackGiven;
        }).sort(function (a, b) { return ms(b.timestamp) - ms(a.timestamp); }).map(function (a) {
            var q = byId[a.quizId], total = Number(a.totalQuestions) || 0, c = Number(a.correctCount);
            return { quizId: a.quizId, title: q.shortTitle || q.title || a.quizId, ts: ms(a.timestamp), correct: Number.isFinite(c) ? c : null, total: total };
        });
    }
    // inside the internship period (inclusive): needs endDate; startDate optional
    function inPeriod(me, today) {
        if (!me || me.notAnInternship || !me.endDate) return false;
        var e = String(me.endDate).slice(0, 10), s = me.startDate ? String(me.startDate).slice(0, 10) : '';
        return today <= e && (!s || today >= s);
    }
    // state {day, later, n} → {show, state}. today = Bangkok date string.
    function decide(state, count, today) {
        var st = { day: (state && state.day) || '', later: (state && state.later) || 0, n: state && typeof state.n === 'number' ? state.n : count };
        if (count < st.n) st.later = 0;          // feedback was given since the last look
        st.n = count;
        var show = count > 0 && st.day !== today && st.later < MAX_LATER;
        return { show: show, state: st };
    }
    function load(uid) { try { return JSON.parse(localStorage.getItem(KEY + uid) || 'null'); } catch (_) { return null; } }
    function save(uid, st) { try { localStorage.setItem(KEY + uid, JSON.stringify(st)); } catch (_) {} }

    function css() {
        if (document.getElementById('fbr-css')) return;
        var s = document.createElement('style'); s.id = 'fbr-css';
        s.textContent = '#fbr-back{position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:16px}' +
            '#fbr-pop{width:100%;max-width:340px;box-sizing:border-box;border-radius:20px;padding:18px 16px 14px;background:linear-gradient(180deg,#fff7ed 0%,#fff 55%);box-shadow:0 12px 40px rgba(0,0,0,.25);color:#1e293b;font-family:inherit}' +
            '#fbr-pop .fbr-ic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:8px;background:#ffedd5}' +
            '#fbr-pop h4{margin:0;font-size:17px;color:#9a3412}#fbr-pop small{display:block;margin-top:2px;font-size:13px;color:#c2410c}' +
            '#fbr-pop .fbr-q{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:9px 12px;margin:6px 0;border:0;border-radius:14px;background:#fff;box-shadow:0 1px 0 #fed7aa;font-size:14px;color:inherit;text-align:left;cursor:pointer;min-height:44px}' +
            '#fbr-pop .fbr-q b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#fbr-pop .fbr-q span{display:flex;align-items:center;gap:6px;flex:none;font-size:12px;color:#64748b}' +
            '#fbr-pop .fbr-q em{font-style:normal;font-weight:800;padding:2px 9px;border-radius:999px}.fbr-g{background:#dcfce7;color:#15803d}.fbr-a{background:#fef3c7;color:#b45309}.fbr-r{background:#fee2e2;color:#b91c1c}' +
            '#fbr-pop .fbr-more{font-size:12px;color:#9a3412;text-align:center;margin:2px 0}' +
            '#fbr-pop .fbr-btns{display:flex;gap:8px;margin-top:12px}#fbr-pop .fbr-btns button{flex:1;min-height:44px;border:0;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer}' +
            '#fbr-later{background:#fff1e6;color:#9a3412}#fbr-go{background:linear-gradient(135deg,#fb923c,#f97316);color:#fff}' +
            '#fbr-pop .fbr-foot{font-size:12px;color:#64748b;margin-top:8px;text-align:center}';
        document.head.appendChild(s);
    }
    function when(L, ts, today) {
        if (!ts) return '';
        var d = Math.round((new Date(today + 'T00:00:00Z') - new Date(bkk(new Date(ts)) + 'T00:00:00Z')) / 86400000);
        return d <= 0 ? L.today : d === 1 ? L.yest : L.ago(d);
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function show(list, uid, st, today) {
        css();
        var L = D[lang()], back = document.createElement('div'); back.id = 'fbr-back';
        var rows = list.slice(0, 3).map(function (p) {
            var r = p.total ? p.correct / p.total : null, cls = r === null ? '' : r >= .8 ? 'fbr-g' : r >= .5 ? 'fbr-a' : 'fbr-r';
            return '<button type="button" class="fbr-q" data-q="' + esc(p.quizId) + '"><b>' + esc(p.title) + '</b><span>' + esc(when(L, p.ts, today)) + (r === null ? '' : ' <em class="' + cls + '">' + p.correct + '/' + p.total + '</em>') + '</span></button>';
        }).join('');
        back.innerHTML = '<div id="fbr-pop" class="lang-no-toggle" role="dialog" aria-modal="true" aria-label="' + esc(L.title(list.length)) + '"><div class="fbr-ic" aria-hidden="true">💬</div><h4>' + esc(L.title(list.length)) + '</h4><small>' + esc(L.sub) + '</small>' + rows +
            (list.length > 3 ? '<div class="fbr-more">' + esc(L.more(list.length - 3)) + '</div>' : '') +
            '<div class="fbr-btns"><button type="button" id="fbr-later">' + esc(L.later) + '</button><button type="button" id="fbr-go">' + esc(L.go) + '</button></div><div class="fbr-foot">' + esc(L.foot) + '</div></div>';
        document.body.appendChild(back);
        // showing counts as today's look; a dismissal adds a "Later", opening feedback does not
        st.day = today; save(uid, st);
        var done = false;
        function close(open) {
            if (done) return; done = true;
            document.removeEventListener('keydown', onKey); back.remove();
            if (open) { if (typeof window.openFeedbackForPastAttempt === 'function') window.openFeedbackForPastAttempt(open); }
            else { st.later += 1; save(uid, st); }
        }
        function onKey(e) { if (e.key === 'Escape') close(null); }
        document.addEventListener('keydown', onKey);
        back.addEventListener('click', function (e) {
            var q = e.target.closest && e.target.closest('[data-q]');
            if (q) return close(q.dataset.q);
            if (e.target.id === 'fbr-go') return close(list[0].quizId);
            if (e.target === back || e.target.id === 'fbr-later') close(null);
        });
        var go = document.getElementById('fbr-go'); if (go) go.focus();
    }
    function busy() {
        if (document.getElementById('fbr-back') || document.getElementById('art-back')) return true;   // V101.176: + the 📰 article popup (articles.js calls check() when it closes)
        return Array.prototype.some.call(document.querySelectorAll('.modal'), function (m) { return m.style.display === 'flex' || m.classList.contains('open') || m.classList.contains('show'); });
    }
    function check() {
        try {
            var uid = typeof userId !== 'undefined' ? userId : '';
            if (!uid || uid === 'preview-admin') return;
            var me = typeof myOwnRow === 'function' ? myOwnRow() : {};
            var today = bkk();
            if (!inPeriod(me, today)) return;
            var list = pending(typeof quizAttemptsCache !== 'undefined' ? quizAttemptsCache : {}, typeof quizzesCache !== 'undefined' ? quizzesCache : []);
            var d = decide(load(uid), list.length, today);
            save(uid, d.state);
            if (d.show && !busy()) show(list, uid, d.state, today);
        } catch (e) { console.warn('fbRemind:', e); }
    }
    // Called from the quiz_attempts listener; waits a moment so quizzes + the user's row have loaded, once per page load.
    function arm() { if (armed) return; armed = true; setTimeout(check, 3500); }
    window.fbRemind = { arm: arm, check: check, pending: pending, inPeriod: inPeriod, decide: decide, MAX_LATER: MAX_LATER };
})();
