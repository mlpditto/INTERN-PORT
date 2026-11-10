// 🌞 Nika: the third tab of DD Codex. Asks the askNika callable, which holds the daily count and the quiz pause; this page only shows them.
(function () {
    const TEXT = {
        en: { ph: 'Ask about a drug, a disease or an article', ask: 'Ask', left: n => `${n} questions left today`, wait: 'Looking in the library…',
            none: 'Not in our library yet', noneSub: 'Nika only answers from Codex and Articles, so it will not guess.', search: '🔎 Search Drugs',
            safe: '🛟 For learning only. Check with your preceptor before using it on a patient. Do not type patient names or HN.',
            pause: 'Paused during your quiz', pauseSub: 'Nika opens again when you finish.', limit: "That's all for today", limitSub: n => `${n} questions a day. Back tomorrow. Codex and Articles stay open.`,
            busy: 'Nika is busy', busySub: 'Please try again in a minute. This question was not counted.', fail: 'Could not reach Nika. Please try again.', sources: 'Sources' },
        th: { ph: 'ถามเรื่องยา โรค หรือบทความ', ask: 'ถาม', left: n => `เหลือ ${n} คำถามวันนี้`, wait: 'กำลังค้นในคลัง…',
            none: 'ยังไม่มีในคลัง', noneSub: 'Nika ตอบจาก Codex และ Articles เท่านั้น จึงจะไม่เดา', search: '🔎 ค้นใน Drugs',
            safe: '🛟 ใช้เพื่อการเรียนเท่านั้น ปรึกษา preceptor ก่อนใช้กับผู้ป่วย และห้ามพิมพ์ชื่อผู้ป่วยหรือ HN',
            pause: 'พักระหว่างทำ Quiz', pauseSub: 'Nika จะเปิดอีกครั้งเมื่อทำเสร็จ', limit: 'วันนี้ครบแล้ว', limitSub: n => `ถามได้วันละ ${n} คำถาม พรุ่งนี้กลับมาใหม่ Codex และ Articles ยังเปิดอยู่`,
            busy: 'Nika ไม่ว่าง', busySub: 'ลองใหม่อีกครั้งในอีกสักครู่ คำถามนี้ไม่ถูกนับ', fail: 'ติดต่อ Nika ไม่ได้ ลองใหม่อีกครั้ง', sources: 'แหล่งที่มา' }
    };
    const CHIPS = ['Amlodipine: what to monitor?', 'Atorvastatin side effects', 'Agomelatine mechanism'];
    // V101.303 (owner): one-click tools outside the app — open in the phone's browser (LINE: external window), never inside Nika's answer
    const LINKS = [{ e: '🫘', url: 'https://cpa-microalbuminurea.netlify.app/', en: 'Kidney risk screening', th: 'คัดกรองความเสี่ยงโรคไต', ko: '신장 위험 선별', by: 'สมาคมเภสัชกรรมชุมชน (ประเทศไทย)' }];
    function openOut(url) {
        if (window.liff && typeof liff.isInClient === 'function' && liff.isInClient() && liff.openWindow) { liff.openWindow({ url: url, external: true }); return; }
        const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url;
    }
    const DAILY = 10;
    const t = () => TEXT[document.body.classList.contains('lang-th-on') ? 'th' : 'en'];
    const call = data => firebase.functions().httpsCallable('askNika')(data).then(r => r.data || {});
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const ICON = { drug: '💊', disease: '🩺', article: '📰' };
    let left = null, busy = false;

    function answerHtml(text) {
        const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
        let html = '', open = false;
        lines.forEach(l => {
            const m = /^[*\-•]\s+(.*)$/.exec(l);
            if (m && !open) { html += '<ul class="nk-a">'; open = true; }
            if (!m && open) { html += '</ul>'; open = false; }
            html += m ? `<li>${bold(m[1])}</li>` : `<p class="nk-p">${bold(l)}</p>`;
        });
        return html + (open ? '</ul>' : '');
    }
    const pane = () => document.getElementById('nika-section-content');
    const q = sel => pane().querySelector(sel);
    function paintLeft() { const el = q('.nk-left'); if (el) el.textContent = left == null ? '' : t().left(left); }
    function note(icon, head, sub) { return `<div class="nk-pause"><span>${icon}</span><b>${esc(head)}</b><small>${esc(sub)}</small></div>`; }
    function setForm(on) { q('.nk-form').hidden = !on; }
    // V101.305 (owner): the chips follow the intern's own quizzes: questions answered wrong, newest quiz first, only in quizzes
    // already passed (score > 0, the same rule that opens the answer key in View Answers), so no key leaks. Else the samples.
    const strip = s => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const when = a => { const x = a && a.timestamp; return x ? (x.toMillis ? x.toMillis() : (x.seconds || 0) * 1000) : 0; };
    function wrongChips() {
        const out = [], seen = {};
        try {
            if (typeof quizAttemptsCache === 'undefined' || typeof quizzesCache === 'undefined' || typeof computeAttemptScore !== 'function') return out;
            Object.values(quizAttemptsCache).filter(a => a && Array.isArray(a.answers) && !a.isPractice && !a.isPoll).sort((a, b) => when(b) - when(a)).forEach(a => {
                let quiz = quizzesCache.find(x => x.id === a.quizId);
                if (quiz && typeof quizForAttempt === 'function') quiz = quizForAttempt(quiz, a, quizzesCache) || quiz;
                if (!quiz || quiz.isPoll || !(computeAttemptScore(a, quiz.totalPoints) > 0)) return;
                (quiz.questions || []).forEach((qq, i) => {
                    const type = qq.type || 'choice';
                    if (out.length >= 3 || (type !== 'choice' && type !== 'flashcard') || qq.correct == null || Array.isArray(qq.correct) || !Array.isArray(qq.options)) return;
                    if (a.answers[i] == qq.correct) return;
                    const stem = strip(qq.q), key = strip(qq.options[qq.correct]);
                    if (stem.length < 3 || !key || seen[stem]) return;
                    seen[stem] = 1;
                    out.push({ wrong: true, label: stem, ask: (stem + ' → ' + key).slice(0, 300) });
                });
            });
        } catch (e) { console.warn('nika chips', e && e.message); }
        return out;
    }
    let chips = [];
    function paintChips() {
        const box = q('.nk-chips'); if (!box) return;
        chips = wrongChips();
        CHIPS.forEach(c => { if (chips.length < 3) chips.push({ label: c, ask: c }); });
        box.innerHTML = chips.map((c, i) => `<button type="button" class="nk-chip${c.wrong ? ' nk-wrong' : ''}" data-i="${i}" title="${esc(c.label)}">${c.wrong ? '❌ ' : ''}${esc(c.label)}</button>`).join('');
        box.querySelectorAll('.nk-chip').forEach(b => { b.onclick = () => { const c = chips[+b.dataset.i]; q('#nk-question').value = c.ask; ask(c.ask); }; });
    }

    function shell() {
        const x = t();
        pane().innerHTML = `<div class="nk-body lang-no-toggle"><div class="nk-form"><div class="nk-box"><textarea id="nk-question" rows="2" maxlength="300" placeholder="${esc(x.ph)}" aria-label="${esc(x.ph)}"></textarea><button type="button" class="nk-go">${esc(x.ask)}</button></div>
            <div class="nk-chips"></div></div>
            <div class="nk-links">${LINKS.map((l, i) => `<button type="button" class="nk-link" data-i="${i}" title="${esc(l.by)} · ${esc(l.url)}">${l.e} ${esc(document.body.classList.contains('lang-th-on') ? l.th : l.en)} <span aria-hidden="true">↗</span></button>`).join('')}</div>
            <div class="nk-out" aria-live="polite"></div><div class="nk-safe">${esc(x.safe)}</div><div class="nk-left"></div></div>`;
        q('.nk-go').onclick = () => ask(q('#nk-question').value);
        pane().querySelectorAll('.nk-link').forEach(b => { b.onclick = () => openOut(LINKS[+b.dataset.i].url); });
    }
    function paused() { setForm(false); q('.nk-out').innerHTML = note('⏸', t().pause, t().pauseSub); }
    function limited() { setForm(false); left = 0; q('.nk-out').innerHTML = note('🌙', t().limit, t().limitSub(DAILY)); paintLeft(); }

    function paintAnswer(r, question) {
        const out = q('.nk-out'), x = t(), asked = `<div class="nk-q">${esc(question)}</div>`;
        if (r.notFound) {
            out.innerHTML = `${asked}<div class="nk-none"><b>❔ ${esc(x.none)}</b><span>${esc(x.noneSub)}</span></div><div class="nk-src"><button type="button" class="nk-search">${esc(x.search)}</button></div>`;
            q('.nk-search').onclick = () => ddSwitchType('drug');
            return;
        }
        out.innerHTML = asked + answerHtml(r.answer) + `<div class="nk-src" aria-label="${esc(x.sources)}">` + (r.sources || []).map((s, i) =>
            `<button type="button" class="nk-s" data-kind="${esc(s.kind)}" data-id="${esc(s.id)}"><b>${i + 1}</b> ${ICON[s.kind] || ''} ${esc(s.title)}</button>`).join('') + '</div>';
        pane().querySelectorAll('.nk-s').forEach(b => { b.onclick = () => openSource(b.dataset.kind, b.dataset.id); });
    }

    // The Codex entry opens on top, so the answer is still here when it closes.
    function whenListed(list, id, open) {
        let tries = 0;
        (function poll() {
            if (list().some(d => d._id === id)) return open(id);
            if (++tries < 50) setTimeout(poll, 100);
        })();
    }
    function openSource(kind, id) {
        if (kind === 'article') return window.internArticles && internArticles.openArticle(id);
        if (kind === 'drug') {
            if (!dcState.loaded) { dcState.loaded = true; dcLoadCodex(); }
            return whenListed(() => dcState.codex || [], id, dcOpenDetail);
        }
        if (!dxState.loaded) { dxState.loaded = true; dxLoadCodex(); }
        whenListed(() => dxState.codex || [], id, dxOpenDetail);
    }

    async function ask(text) {
        const question = String(text || '').trim(), x = t();
        if (busy || question.length < 3) { if (!busy) q('#nk-question').focus(); return; }
        busy = true; q('.nk-go').disabled = true;
        q('.nk-out').innerHTML = `<div class="nk-q">${esc(question)}</div><div class="nk-wait" role="status">${esc(x.wait)}</div>`;
        try {
            const r = await call({ question });
            if (r.left != null) left = r.left;
            if (r.paused) paused();
            else if (r.limit) limited();
            else if (r.busy) q('.nk-out').innerHTML = note('☕', x.busy, x.busySub);
            else { paintAnswer(r, question); q('#nk-question').value = ''; }
        } catch (e) {
            console.warn('askNika', e && e.message);
            q('.nk-out').innerHTML = note('⚠️', x.fail, '');
        }
        busy = false; q('.nk-go').disabled = false; paintLeft();
    }

    window.nikaAsk = {
        _links: LINKS, _openOut: openOut, _wrongChips: wrongChips,
        async show() {
            const card = document.getElementById('dd-codex-card');
            card.classList.remove('nk-sun'); void card.offsetWidth; card.classList.add('nk-sun');
            if (!pane().firstElementChild) shell();
            paintChips();
            try {
                if (typeof ensureFirebaseAuthReady === 'function') await ensureFirebaseAuthReady(10000);
                const r = await call({ peek: true });
                left = r.left;
                if (r.paused) paused();
                else if (left === 0) limited();
                else { setForm(true); if (q('.nk-out .nk-pause')) q('.nk-out').innerHTML = ''; }
                paintLeft();
            } catch (e) { console.warn('askNika peek', e && e.message); }
        },
        hide() { document.getElementById('dd-codex-card').classList.remove('nk-sun'); }
    };
})();
