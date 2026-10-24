// Admin ▸ Cases ▸ Review: the score modal checks the intern's Case with the LOCAL model (Ollama, `ol/local`) as soon as it opens.
// Nothing leaves this computer, and the prompt carries only the Note + disease + system (no name, no HN).
// Advisory only: a failed / slow / missing local AI never blocks Save Score. The score it suggests pre-fills the field only while untouched.
(function () {
    const MODEL = 'ol/local';
    const SCORES = [0.1, 0.2, 0.5];
    let run = 0;
    let abort = null;

    const box = () => document.getElementById('case-review-ai');
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));
    const list = (v, n) => (Array.isArray(v) ? v : []).map(x => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, n || 4);

    function buildPrompt(c) {
        return [
            'ROLE: clinical pharmacist reviewing an intern\'s patient Case note.',
            'Reply with PURE JSON only, no markdown. Write each item in the same language as the Note, 1-4 words each.',
            'Keys: ask (array, up to 4: what to ask the patient next), ddx (array, up to 4: conditions to consider),',
            'followUp (string: when to follow up, <= 8 words), meds (array, up to 4: drugs that may be relevant, including ones in the Note),',
            'privacy (string: a phrase in the Note that could identify the patient, or ""), score (0.1, 0.2 or 0.5: bonus for how complete and thoughtful the Note is),',
            'scoreWhy (string, <= 10 words).',
            '',
            'Disease: ' + (c.disease || c.diseaseName || '-'),
            'System: ' + (c.diseaseSystemLabel || '-'),
            'Note: ' + String(c.note || '').slice(0, 1500)
        ].join('\n');
    }

    function parse(text) {
        if (typeof window.safeJsonParse === 'function') return window.safeJsonParse(text);
        return JSON.parse(String(text).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim());
    }

    const row = (icon, title, inner, cls) => `<div class="crai-f${cls ? ' ' + cls : ''}" title="${esc(title)}"><i>${icon}</i>${inner}</div>`;
    const chips = (a) => `<span class="crai-c">${a.map(x => `<u>${esc(x)}</u>`).join('')}</span>`;

    function render(d) {
        const out = [];
        const ask = list(d.ask), ddx = list(d.ddx), meds = list(d.meds);
        const follow = String(d.followUp || '').trim().slice(0, 80);
        const priv = String(d.privacy || '').trim().slice(0, 80);
        if (ask.length) out.push(row('❓', 'ควรซักถามเพิ่ม', chips(ask)));
        if (ddx.length) out.push(row('🩺', 'โรคที่ควรนึกถึง', chips(ddx)));
        if (follow) out.push(row('📅', 'ระยะที่ควรติดตาม', `<span>${esc(follow)}</span>`));
        if (meds.length) out.push(row('💊', 'ยาที่อาจเกี่ยวข้อง', chips(meds)));
        if (priv) out.push(row('🔒', 'อาจระบุตัวผู้ป่วยได้', `<span>${esc(priv)}</span>`, 'bad'));
        return out.join('');
    }

    function applyScore(d) {
        const s = Number(d.score);
        if (!SCORES.includes(s)) return;
        const input = document.getElementById('case-review-score-input');
        const chip = document.querySelector('#caseReviewScoreModal .case-score-chip[data-score="' + s + '"]');
        if (chip) { chip.classList.add('ai'); chip.title = 'AI: ' + String(d.scoreWhy || '').slice(0, 80); }
        // only an untouched field (still the saved 0.0 / empty) is pre-filled — never overwrite what the admin typed
        if (input && !input.dataset.crTouched && (!input.value || Number(input.value) === 0) && typeof setCaseReviewScoreValue === 'function') setCaseReviewScoreValue(s);
    }

    function head(state, caseItem) {
        const label = state === 'run' ? '…' : '🔍';
        return `<div class="crai-head"><span class="crai-model">Ollama · local</span><button type="button" class="dca-ai-review-btn" id="case-review-ai-btn" title="AI Review" aria-label="AI Review"${state === 'run' ? ' disabled' : ''}>${label}</button></div>`;
    }

    async function start(caseItem) {
        const el = box();
        if (!el) return;
        cancel();
        const mine = ++run;
        abort = new AbortController();
        const note = String((caseItem && caseItem.note) || '').trim();
        const btnHook = () => { const b = document.getElementById('case-review-ai-btn'); if (b) b.onclick = () => start(caseItem); };
        el.hidden = false;
        if (note.length < 10) { el.innerHTML = head('idle') + '<div class="crai-msg">Note สั้นเกินไป</div>'; btnHook(); return; }
        el.innerHTML = head('run') + '<div class="crai-msg">กำลังตรวจ…</div>';
        try {
            const r = await window.callUniversalAI(MODEL, buildPrompt(caseItem), true, null, '', { feature: 'case_review_ai', temperature: 0.2, maxTokens: 500, signal: abort.signal });
            if (mine !== run) return;
            const d = parse(r && r.text);
            if (!d || typeof d !== 'object') throw new Error('The local model did not return JSON.');
            el.innerHTML = head('idle') + '<div class="crai-finds">' + render(d) + '</div>';
            applyScore(d);
        } catch (e) {
            if (mine !== run || (e && e.reviewCancelled)) return;
            el.innerHTML = head('idle') + `<div class="crai-msg" title="${esc((e && e.message) || '')}">Local AI ใช้ไม่ได้ — กด 🔍 เพื่อลองใหม่</div>`;
        }
        btnHook();
    }

    function cancel() { run++; if (abort) { try { abort.abort(); } catch (_) {} abort = null; } }

    function hide() {
        cancel();
        const el = box();
        if (el) { el.hidden = true; el.innerHTML = ''; }
        const input = document.getElementById('case-review-score-input');
        if (input) delete input.dataset.crTouched;
        document.querySelectorAll('#caseReviewScoreModal .case-score-chip.ai').forEach(c => { c.classList.remove('ai'); c.removeAttribute('title'); });
    }

    document.addEventListener('input', (e) => { if (e.target && e.target.id === 'case-review-score-input') e.target.dataset.crTouched = '1'; });
    document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#caseReviewScoreModal .case-score-chip')) { const i = document.getElementById('case-review-score-input'); if (i) i.dataset.crTouched = '1'; } });

    window.caseReviewAi = { start, hide, buildPrompt, render };
})();
