// V102.564 (owner, B): several Case Cards from one sheet. The admin checks every summary first; cards are made two at a time; one failure stops nothing and can be retried alone.
(function () {
    const MAX = 20, MIN_NOTE = 20, WORKERS = 2;
    const MODELS = [['as/gemini-nano-banana-2.1', 'Nano Banana 2.1'], ['as/gemini-3.1-flash-lite-image', 'NB 2 Lite'], ['as/gemini-3-pro-image', 'NB Pro'], ['gpt-image-2.5-flare', 'GPT 2.5 Flare'], ['gpt-image-2.5-sunburst', 'GPT 2.5 Sunburst'], ['or/x-ai/grok-imagine-image-quality', 'Grok Imagine']];
    const LAYOUTS = [['infographic', 'Infographic'], ['lifestyle', 'Lifestyle'], ['symptoms', 'Symptoms'], ['selfcare', 'Self-care'], ['minimal', 'Minimal']];
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const SCRUB_LEAD = 'Educational case summary: ';
    let rows = [], busy = false, stop = false, model = MODELS[0][0], ran = false;
    const $ = id => document.getElementById(id);
    const prefKey = () => window.ALABASTA_CASECARD_MODEL_PREF_KEY;

    function plan(ids) {
        const seen = new Set();
        return ids.map(id => getAlabastaCaseById(id)).filter(Boolean).map(c => {
            const short = String(c.note || '').trim().length < MIN_NOTE, hn = String(c.caseId || '').trim(), dup = !!hn && seen.has(hn), has = !!(c.caseCardImage && c.caseCardImage.downloadUrl);
            if (hn) seen.add(hn);
            const warn = short ? 'Note is short: add detail here or leave it out' : dup ? 'Same HN as a case above' : has ? 'Already has a card' : '';
            const pay = buildSafeAlabastaCaseVisualPayload(c);
            return { c, on: !warn, warn, taxonomy: pay.taxonomySummary, summary: pay.safeSummary.replace(SCRUB_LEAD, ''), english: false, state: 'idle', error: '', url: '', cost: null };
        });
    }
    const consentOf = r => !!(r.c.privacyConsent && r.c.privacyConsent.details);

    async function translate(r) {
        if (r.english || !r.summary.trim()) return;
        r.translating = true;
        const from = r.summary, en = await translateAlabastaSummaryToEnglish(from, r.taxonomy, consentOf(r));
        r.translating = false;
        if (r.summary !== from) return;   // the admin typed meanwhile: their words stay
        r.summary = en || from; r.english = true;
        const ta = document.querySelector('.ccm-row[data-i="' + rows.indexOf(r) + '"] textarea');
        if (ta && document.activeElement !== ta) ta.value = r.summary;
    }
    async function pool(list, n, job) {
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
            while (next < list.length && !stop) await job(list[next++]);
        }));
    }

    const chips = (list, on, fn) => list.map(([v, t]) => `<button type="button" class="ccm-chip" aria-pressed="${v === on}" onclick="caseCardMulti.${fn}('${esc(v)}')">${esc(t)}</button>`).join('');
    function head() {
        const done = rows.filter(r => r.state === 'done').length, failed = rows.filter(r => r.state === 'failed').length, picked = rows.filter(r => r.on).length, wait = rows.filter(r => r.on && r.state !== 'done').length, left = rows.filter(r => r.on && r.state === 'idle').length;
        const action = busy ? `<span class="ccm-count">${done + failed} of ${picked}</span><button type="button" class="ccm-ghost" onclick="caseCardMulti.halt()"${stop ? ' disabled' : ''}>${stop ? 'Stopping…' : 'Stop'}</button>`
            : done || failed ? `<span class="ccm-count">${done} ready${failed ? ' · ' + failed + ' failed' : ''}</span>${left ? '<button type="button" class="ccm-go" onclick="caseCardMulti.run()">Generate ' + left + '</button>' : ''}${done ? '<button type="button" class="ccm-go" onclick="caseCardMulti.zip(this)">⬇ ZIP (' + done + ')</button>' : ''}`
                : `<button type="button" class="ccm-go" onclick="caseCardMulti.run()"${wait ? '' : ' disabled'}>Generate ${wait} card${wait === 1 ? '' : 's'}</button>`;
        return `<div class="ccm-hd"><b>Case cards</b><span class="ccm-acts">${action}<button type="button" class="ccm-x" onclick="caseCardMulti.close()" aria-label="Close"${busy ? ' disabled' : ''}>✕</button></span></div>` +
            (busy || done || failed ? '' : `<div class="ccm-rail">${chips(MODELS, model, 'pickModel')}</div><div class="ccm-rail">${chips(LAYOUTS, getCaseCardLayout(), 'pickLayout')}</div>`);
    }
    function rowHtml(r, i) {
        const c = r.c, hn = `<i>${esc(c.caseId || '—')}</i>`, sys = esc(alabastaEnglishOnly(c.diseaseSystemLabel || '') || 'Other');
        if (r.state === 'idle') return `<div class="ccm-row${r.warn ? ' warn' : ''}" data-i="${i}"><input type="checkbox" ${r.on ? 'checked' : ''} onchange="caseCardMulti.tick(${i}, this.checked)" aria-label="Include ${esc(c.caseId || '')}"><div class="ccm-txt"><b>${hn} ${sys}</b>${r.warn ? `<small>⚠️ ${esc(r.warn)}</small>` : ''}<textarea rows="2" oninput="caseCardMulti.edit(${i}, this.value)" aria-label="Summary">${esc(r.summary)}</textarea></div></div>`;
        if (r.state === 'done') return `<div class="ccm-res ok"><img src="${esc(r.url)}" alt="Case card ${esc(c.caseId || '')}"><small>${hn} ✓ ${r.saved === false ? 'Gallery save failed' : 'Saved'} <a href="${esc(r.url)}" download="${esc(fileOf(c))}">⬇ PNG</a></small></div>`;
        if (r.state === 'failed') return `<div class="ccm-res bad"><small>${hn} ✕ ${esc(r.error)}</small><button type="button" class="ccm-ghost" onclick="caseCardMulti.retry(${i})"${busy ? ' disabled' : ''}>↻ Retry</button></div>`;
        return `<div class="ccm-row"><span class="ccm-s">${r.state === 'running' ? '⟳' : '·'}</span><div class="ccm-txt"><b>${hn} ${sys}</b><p>${esc(r.summary)}</p></div></div>`;
    }
    const fileOf = c => (c.caseId ? 'case-' + String(c.caseId).replace(/[^\w.-]+/g, '_') : 'case-' + c.id) + '.png';
    function draw() {
        const box = $('ccm-sheet');
        if (!box) return;
        const shown = rows.map((r, i) => [r, i]).filter(([r]) => !ran || r.on);
        box.innerHTML = head() + `<div class="ccm-body${shown.every(([r]) => r.state === 'done' || r.state === 'failed') ? ' grid' : ''}">${shown.map(([r, i]) => rowHtml(r, i)).join('')}</div>`;
    }

    function open() {
        const ids = Array.from(window.alabastaSelectedIds || []);
        if (!ids.length) return;
        if (ids.length > MAX) { showToast('Pick ' + MAX + ' cases or fewer'); return; }
        rows = plan(ids); busy = false; stop = false; ran = false;
        try { const m = localStorage.getItem(prefKey()); if (MODELS.some(x => x[0] === m)) model = m; } catch (e) { /* the default stays */ }
        const ov = document.createElement('div');
        ov.id = 'ccm-overlay';
        ov.innerHTML = '<div id="ccm-sheet" class="lang-no-toggle" role="dialog" aria-label="Case cards"></div>';
        document.body.appendChild(ov);
        draw();
        pool(rows.filter(r => r.on), WORKERS, translate);
    }
    function close() {
        if (busy) return;
        const ov = $('ccm-overlay'); if (ov) ov.remove();
        if (ran && typeof clearAlabastaSelection === 'function') clearAlabastaSelection();
        rows = [];
    }

    async function makeOne(r, layout) {
        r.state = 'running'; r.error = ''; draw();
        try {
            await translate(r);
            const summary = r.summary.trim();
            if (!summary) throw new Error('The summary is empty');
            const mode = getCaseCardCompositeMode();
            const base = alabastaCaseCardPromptFor(summary, r.taxonomy, consentOf(r), String(r.c.caseVisualDispensed || '').slice(0, 80));
            const prompt = mode === 'html-overlay' ? _appendNoTextPromptSuffix(base) : base;
            const made = await alabastaCaseCardMakeImage(r.c, prompt, model, mode, null);
            const url = await stampCaseIdOnImage(made.finalDataUrl, r.c.caseId), used = made.model || model;
            r.url = url; r.state = 'done';
            r.saved = await saveCaseCardToGallery(r.c.id, r.c, url, used, layout);
            await db.collection('cases').doc(r.c.id).update({ caseVisualGeneratedAt: firebase.firestore.FieldValue.serverTimestamp(), caseVisualImageModel: used, caseVisualGenerationStatus: 'generated', caseVisualGeneratedBy: ALLOWED_EMAIL || 'admin' });
            syncAlabastaCaseBridgeMarker(r.c.id, { caseVisualImageModel: used, caseVisualGenerationStatus: 'generated', caseVisualGeneratedBy: ALLOWED_EMAIL || 'admin' });
        } catch (e) {
            console.warn('[caseCardMulti]', e && e.message);
            if (r.state !== 'done') { r.state = 'failed'; r.error = (e && e.message ? String(e.message) : 'Failed').slice(0, 140); }
        }
        draw();
    }
    async function runList(list) {
        if (busy || !list.length) return;
        busy = true; stop = false; ran = true;
        const layout = getCaseCardLayout();
        list.forEach(r => { if (r.state !== 'done') r.state = 'wait'; });
        draw();
        // the HTML overlay shares one off-screen node, so that mode goes one at a time
        await pool(list, getCaseCardCompositeMode() === 'html-overlay' ? 1 : WORKERS, r => makeOne(r, layout));
        rows.forEach(r => { if (r.state === 'wait') { r.state = 'idle'; } });
        busy = false; stop = false;
        draw();
    }

    async function zip(btn) {
        btn.disabled = true;
        try {
            if (!window.JSZip) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = ok; s.onerror = () => no(new Error('ZIP library did not load')); document.head.appendChild(s); });
            const z = new window.JSZip();
            rows.filter(r => r.state === 'done').forEach(r => z.file(fileOf(r.c), r.url.split(',')[1], { base64: true }));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(await z.generateAsync({ type: 'blob' }));
            a.download = 'case-cards.zip';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        } catch (e) { showToast('Could not make the ZIP: ' + (e && e.message ? e.message : 'error')); }
        btn.disabled = false;
    }

    window.caseCardMulti = {
        open, close, zip,
        tick(i, on) { const r = rows[i]; r.on = on; draw(); if (on) translate(r); },
        edit(i, v) { rows[i].summary = v; rows[i].english = true; },
        pickModel(m) { model = m; try { localStorage.setItem(prefKey(), m); } catch (e) { /* this sheet still uses it */ } draw(); },
        pickLayout(l) { selectCaseCardLayout(l); draw(); },
        run() { runList(rows.filter(r => r.on && r.state !== 'done')); },
        retry(i) { runList([rows[i]]); },
        halt() { stop = true; draw(); },
    };
})();
