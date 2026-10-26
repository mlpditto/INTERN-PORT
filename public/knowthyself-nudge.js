// V101.214: nudges for interns who have not done 🧭 Know thyself yet (owner's pick "B + C", mockup-knowthyself-reminder.html).
// Done = users.personality has a NERIS type (Part A) or a Big Five result (Part B); both nudges vanish for good once it is done.
// B · a small bottom sheet when the app opens: at most once a week, 3 times in all, never on a day the 📰 article popup or the quiz
//     feedback reminder already showed (one popup a day is enough), never on top of anything; "Not again" stops it for good.
// C · a card under today's sent Journal ("🧭 want questions that fit you?"): the first day an entry is sent, and once more 7+ days later;
//     ✕ stops it for good. Start (either) opens Personal Info on the Know thyself tab.
// Nothing here scores, ranks or rewards — the Know thyself promise. State is per device (localStorage), like the feedback reminder.
(function () {
    'use strict';
    var KEY = 'ktNudge:', WEEK = 7, MAX_B = 3, MAX_C = 2;
    var T = {
        en: { title: 'Know yourself in 3 minutes', sub: 'A short 20-question check, or the 16 Personalities result you already have — it helps your Journal ask better questions. It never affects any score.', p1: '⏱ 3 min', p2: '🔒 only you + admin', p3: '✍️ better Journal questions', later: 'Later', go: 'Start →', off: 'Don’t remind me again',
            cTitle: '🧭 Want Journal questions that fit you?', cSub: 'Do Know thyself (3 min) and the Journal can ask about your own way of working.', cGo: 'Try it', close: 'Close' },
        th: { title: 'รู้จักตัวเองใน 3 นาที', sub: 'ทำแบบสั้น 20 ข้อ หรือใส่ผล 16 Personalities ที่เคยทำ — ใช้ช่วย Journal ตั้งคำถามชวนคิด ไม่มีผลกับคะแนนใด ๆ', p1: '⏱ 3 นาที', p2: '🔒 เห็นเฉพาะคุณกับแอดมิน', p3: '✍️ ช่วยตั้งคำถาม Journal', later: 'ไว้ทีหลัง', go: 'เริ่มเลย →', off: 'ไม่ต้องเตือนอีก',
            cTitle: '🧭 อยากได้คำถามชวนคิดที่เหมาะกับคุณ?', cSub: 'ทำ Know thyself 3 นาที แล้ว Journal จะชวนคิดตามบุคลิกของคุณ', cGo: 'ลองเลย', close: 'ปิด' },
        ko: { title: '3분 만에 나를 알아보기', sub: '짧은 20문항, 또는 이미 있는 16 Personalities 결과 — Journal 질문을 더 잘 맞춰 줘요. 점수에는 영향이 없어요.', p1: '⏱ 3분', p2: '🔒 나와 관리자만', p3: '✍️ 더 나은 Journal 질문', later: '나중에', go: '시작 →', off: '다시 알리지 않기',
            cTitle: '🧭 나에게 맞는 Journal 질문을 원하나요?', cSub: 'Know thyself(3분)를 하면 Journal이 나의 일하는 방식에 대해 물어봐요.', cGo: '해 보기', close: '닫기' }
    };
    function lang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    function bkk(d) { return (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
    function days(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
    function uid() { return typeof userId !== 'undefined' ? userId : ''; }
    function me() { return window.myUserDoc || {}; }
    function done(m) { var p = m && m.personality; return !!(p && (p.neris || p.big5)); }
    function load(u) { try { return JSON.parse(localStorage.getItem(KEY + u) || 'null') || {}; } catch (_) { return {}; } }
    function save(u, st) { try { localStorage.setItem(KEY + u, JSON.stringify(st)); } catch (_) { /* private mode */ } }
    function blocked() { var u = uid(); return !u || u === 'preview-admin' || (typeof isPreview !== 'undefined' && isPreview) || window.myRegistered === false; }

    // ---- pure rules (exposed for the test)
    // B: st = { b: [days shown], off }; popDay = the article popup's day; fbDay = the feedback reminder's day
    function decideB(m, st, today, popDay, fbDay) {
        st = st || {}; var b = st.b || [];
        if (done(m) || st.off || b.length >= MAX_B) return false;
        if (popDay === today || fbDay === today) return false;          // one popup a day is enough
        return !b.length || days(b[b.length - 1], today) >= WEEK;
    }
    // C: st = { c: [days shown], cOff } — the first day, once more a week+ later; the same day keeps it up
    function decideC(m, st, today) {
        st = st || {}; var c = st.c || [];
        if (done(m) || st.cOff) return false;
        if (c.indexOf(today) >= 0) return true;
        return c.length < MAX_C && (!c.length || days(c[c.length - 1], today) >= WEEK);
    }

    // ---- open Personal Info on the Know thyself tab (the modal opens after its own read)
    function openSelf() {
        if (typeof openPersonalInfoModal !== 'function') return;
        openPersonalInfoModal();
        var n = 0, t = setInterval(function () {
            var m = document.getElementById('personalInfoModal');
            if (m && m.style.display === 'flex') { clearInterval(t); if (typeof switchPersonalTab === 'function') switchPersonalTab('self'); }
            else if (++n > 50) clearInterval(t);
        }, 100);
    }

    function css() {
        if (document.getElementById('kt-css')) return;
        var s = document.createElement('style'); s.id = 'kt-css';
        s.textContent = '#kt-back{position:fixed;inset:0;z-index:10040;background:rgba(15,23,42,.45);animation:ktFade .15s ease-out}' +
            '#kt-sheet{position:fixed;left:0;right:0;bottom:0;z-index:10041;max-width:560px;margin:0 auto;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(15,23,42,.18);padding:16px 18px calc(14px + env(safe-area-inset-bottom));box-sizing:border-box;font-family:Kanit,sans-serif;text-align:left;animation:ktUp .2s ease-out}' +
            '#kt-sheet .em{font-size:30px;line-height:1}#kt-sheet h3{margin:6px 0 4px;font:800 18px/1.3 Kanit,sans-serif;color:#1e293b}#kt-sheet p{margin:0 0 10px;font:400 13.5px/1.5 Kanit,sans-serif;color:#64748b}' +
            '#kt-sheet .pl{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}#kt-sheet .pl span{font:700 12px/1 Kanit,sans-serif;background:#f5f3ff;color:#5b21b6;border-radius:999px;padding:6px 10px}' +
            '#kt-sheet .ac{display:flex;align-items:center;gap:8px}#kt-sheet button{min-height:0;margin:0;width:auto;cursor:pointer;font-family:Kanit,sans-serif}' +
            '#kt-sheet .lt{border:0;background:none;color:#64748b;font-weight:700;font-size:14px;padding:12px 10px}#kt-sheet .go{flex:1;height:46px;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:800;font-size:15px;box-shadow:0 4px 12px rgba(124,58,237,.3)}' +
            '#kt-sheet .nv{display:block;margin:8px auto 0;border:0;background:none;color:#a8a2b5;font-size:12px;padding:6px 10px}#kt-sheet button:focus{outline:none}#kt-sheet button:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}' +
            '@keyframes ktUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}@keyframes ktFade{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){#kt-sheet,#kt-back{animation:none}}' +
            '#kt-jcard{display:flex;align-items:center;gap:8px;margin:10px 0 16px;padding:9px 10px;border:1px dashed #c4b5fd;border-radius:12px;background:linear-gradient(135deg,#f5f3ff,#fff);font-family:Kanit,sans-serif;text-align:left}' +
            '#kt-jcard .t{flex:1;min-width:0;font-size:12.5px;line-height:1.4;color:#4c1d95}#kt-jcard .t b{display:block;font-size:13.5px}' +
            '#kt-jcard button{min-height:0;margin:0;width:auto;cursor:pointer;font-family:Kanit,sans-serif}#kt-jcard .go{flex:none;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:800;font-size:12.5px;padding:7px 12px;white-space:nowrap}' +
            '#kt-jcard .x{flex:none;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:#a8a2b5;font-size:14px}';
        document.head.appendChild(s);
    }

    // ---- B · the sheet
    function busy() {
        if (document.getElementById('art-back') || document.getElementById('fbr-back') || document.getElementById('cm-back') || document.getElementById('kt-back')) return true;
        var g = document.getElementById('internGuideOverlay'); if (g && g.classList.contains('open')) return true;
        return Array.prototype.some.call(document.querySelectorAll('.modal'), function (m) { var d = m.style.display; return d === 'flex' || d === 'block' || m.classList.contains('open') || m.classList.contains('show'); });
    }
    function fbDay(u) { try { return (JSON.parse(localStorage.getItem('fbRemind:' + u) || 'null') || {}).day || ''; } catch (_) { return ''; } }
    function showB(st, today) {
        css();
        var L = T[lang()], u = uid();
        var back = document.createElement('div'); back.id = 'kt-back';
        var sh = document.createElement('div'); sh.id = 'kt-sheet'; sh.className = 'lang-no-toggle'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-labelledby', 'kt-title');
        sh.innerHTML = '<div class="em" aria-hidden="true">🧭</div><h3 id="kt-title">' + L.title + '</h3><p>' + L.sub + '</p>' +
            '<div class="pl"><span>' + L.p1 + '</span><span>' + L.p2 + '</span><span>' + L.p3 + '</span></div>' +
            '<div class="ac"><button type="button" class="lt" data-k="later">' + L.later + '</button><button type="button" class="go" data-k="go">' + L.go + '</button></div>' +
            '<button type="button" class="nv" data-k="off">' + L.off + '</button>';
        document.body.appendChild(back); document.body.appendChild(sh);
        st.b = (st.b || []).concat([today]); save(u, st);   // showing it counts, whatever the answer
        function close(k) {
            document.removeEventListener('keydown', onKey); back.remove(); sh.remove();
            if (k === 'off') { st.off = true; save(u, st); }
            if (k === 'go') openSelf();
        }
        function onKey(e) { if (e.key === 'Escape') close('later'); }
        document.addEventListener('keydown', onKey);
        back.onclick = function () { close('later'); };
        sh.onclick = function (e) { var b = e.target.closest && e.target.closest('[data-k]'); if (b) close(b.dataset.k); };
        var go = sh.querySelector('.go'); if (go) go.focus();
    }
    var tries = 0, armed = false;
    function check() {
        try {
            if (blocked() || !window.myUserDoc) return;
            var u = uid(), st = load(u), today = bkk();
            if (!decideB(me(), st, today, me().articlePopDay || '', fbDay(u))) return;
            if (busy()) { if (tries++ < 20) setTimeout(check, 3000); return; }
            showB(st, today);
        } catch (e) { console.warn('ktNudge:', e); }
    }
    // after the article popup (2.5 s) and the feedback reminder (3.5 s) had their turn
    function arm() { if (armed) return; armed = true; setTimeout(check, 8000); }

    // ---- C · the card under today's sent Journal (daily-canvas.js hero: #dc-hero.dc-done)
    function paintC() {
        try {
            var hero = document.getElementById('dc-hero'), card = document.getElementById('kt-jcard');
            var on = !!hero && hero.classList.contains('dc-done') && !blocked() && !!window.myUserDoc;
            var u = uid(), st = on ? load(u) : null, today = bkk();
            if (!on || !decideC(me(), st, today)) { if (card) card.remove(); return; }
            if (card) return;
            if ((st.c || []).indexOf(today) < 0) { st.c = (st.c || []).concat([today]); save(u, st); }
            css();
            var L = T[lang()];
            card = document.createElement('div'); card.id = 'kt-jcard'; card.className = 'lang-no-toggle';
            card.innerHTML = '<div class="t"><b>' + L.cTitle + '</b>' + L.cSub + '</div><button type="button" class="go">' + L.cGo + '</button><button type="button" class="x" aria-label="' + L.close + '" title="' + L.close + '">✕</button>';
            card.querySelector('.go').onclick = function () { openSelf(); };
            card.querySelector('.x').onclick = function () { var s = load(u); s.cOff = true; save(u, s); card.remove(); };
            hero.appendChild(card);
        } catch (e) { console.warn('ktNudge card:', e); }
    }
    function watchC() {
        var hero = document.getElementById('dc-hero');
        if (!hero) return false;
        new MutationObserver(paintC).observe(hero, { attributes: true, attributeFilter: ['class'] });
        paintC();
        return true;
    }
    document.addEventListener('DOMContentLoaded', function () { if (!watchC()) setTimeout(watchC, 0); });

    window.ktNudge = { arm: arm, check: check, paintC: paintC, done: done, decideB: decideB, decideC: decideC, openSelf: openSelf, MAX_B: MAX_B, MAX_C: MAX_C };
})();
