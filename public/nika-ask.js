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

    function shell() {
        const x = t();
        pane().innerHTML = `<div class="nk-body lang-no-toggle"><div class="nk-form"><div class="nk-box"><textarea id="nk-question" rows="2" maxlength="300" placeholder="${esc(x.ph)}" aria-label="${esc(x.ph)}"></textarea><button type="button" class="nk-go">${esc(x.ask)}</button></div>
            <div class="nk-chips">${CHIPS.map(c => `<button type="button" class="nk-chip">${esc(c)}</button>`).join('')}</div></div>
            <div class="nk-out" aria-live="polite"></div><div class="nk-safe">${esc(x.safe)}</div><div class="nk-left"></div></div>`;
        q('.nk-go').onclick = () => ask(q('#nk-question').value);
        pane().querySelectorAll('.nk-chip').forEach(c => { c.onclick = () => { q('#nk-question').value = c.textContent; ask(c.textContent); }; });
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
        async show() {
            const card = document.getElementById('dd-codex-card');
            card.classList.remove('nk-sun'); void card.offsetWidth; card.classList.add('nk-sun');
            if (!pane().firstElementChild) shell();
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
