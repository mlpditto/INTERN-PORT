// V102.564 (owner, B): several Case Cards from one sheet. The admin checks every summary first; cards are made two at a time; one failure stops nothing and can be retried alone.
(function () {
    const MAX = 20, MIN_NOTE = 20, WORKERS = 2;
    // V102.583 (owner pick C): a tile per model — its own glyph and colours, the vendor logo in the corner; [value, name, glyph, colour 1, colour 2, vendor]
    const MODELS = [['as/gemini-nano-banana-2.1', 'Nano Banana 2.1', '🍌', '#fef08a', '#facc15', 'gemini'], ['as/gemini-3.1-flash-lite-image', 'NB 2 Lite', '🪶', '#e0f2fe', '#7dd3fc', 'gemini'], ['as/gemini-3-pro-image', 'NB Pro', '💎', '#e0e7ff', '#818cf8', 'gemini'], ['gpt-image-2.5-flare', 'GPT 2.5 Flare', '🔥', '#ffe4e6', '#fb7185', 'openai'], ['gpt-image-2.5-sunburst', 'GPT 2.5 Sunburst', '☀️', '#ffedd5', '#fb923c', 'openai'], ['or/x-ai/grok-imagine-image-quality', 'Grok Imagine', '', '#475569', '#0f172a', 'grok']];
    const VENDORS = { gemini: ['#1a73e8', 'assets/logos/gemini-spark-color.svg'], openai: ['#111827', 'assets/logos/openai-blossom-black.svg'], grok: ['#7c3aed', 'assets/logos/grok-white.svg'] };
    // [value, name, ratio, what it shows]; the wide templates come out 16:9, so their drawing is wider
    const LAYOUTS = [['infographic', 'Infographic', '4:3', 'Summary card: heading and info boxes'], ['lifestyle', 'Lifestyle', '16:9', 'Daily-life trigger tiles'], ['symptoms', 'Symptoms', '16:9', 'Body and symptoms'], ['selfcare', 'Self-care', '16:9', 'What-to-do tiles'], ['minimal', 'Minimal', '4:3', 'Picture only, little text']];
    const DRAW = {
        infographic: '<rect x="4" y="4" width="21" height="3" rx="1" fill="currentColor"/><rect x="4" y="9" width="9" height="9" rx="1.5" fill="currentColor" opacity=".35"/><rect x="15" y="9" width="10" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="15" y="13" width="10" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="15" y="16.5" width="7" height="1.6" rx=".8" fill="currentColor" opacity=".6"/>',
        lifestyle: '<circle cx="9" cy="9" r="3" fill="currentColor" opacity=".45"/><circle cx="19.5" cy="9" r="3" fill="currentColor" opacity=".45"/><circle cx="30" cy="9" r="3" fill="currentColor" opacity=".45"/><rect x="5" y="15" width="8" height="2" rx="1" fill="currentColor"/><rect x="15.5" y="15" width="8" height="2" rx="1" fill="currentColor"/><rect x="26" y="15" width="8" height="2" rx="1" fill="currentColor"/>',
        symptoms: '<circle cx="11" cy="6.5" r="2.6" fill="currentColor"/><rect x="7.5" y="10" width="7" height="9" rx="3" fill="currentColor" opacity=".55"/><circle cx="14" cy="13" r="1.4" fill="#ef4444"/><path d="M15.5 13 H23" stroke="currentColor" stroke-width="1"/><rect x="24" y="6" width="11" height="2" rx="1" fill="currentColor"/><rect x="24" y="12" width="11" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="24" y="16" width="8" height="2" rx="1" fill="currentColor" opacity=".6"/>',
        selfcare: '<rect x="4" y="4" width="14.5" height="6" rx="1.5" fill="currentColor" opacity=".3"/><rect x="20.5" y="4" width="14.5" height="6" rx="1.5" fill="currentColor" opacity=".3"/><rect x="4" y="12" width="14.5" height="6" rx="1.5" fill="currentColor" opacity=".3"/><rect x="20.5" y="12" width="14.5" height="6" rx="1.5" fill="currentColor" opacity=".3"/><path d="M6 7l1.5 1.5L10 5.5M22.5 7l1.5 1.5 2.5-3M6 15l1.5 1.5L10 13.5M22.5 15l1.5 1.5 2.5-3" fill="none" stroke="#16a34a" stroke-width="1.3" stroke-linecap="round"/>',
        minimal: '<circle cx="20" cy="7" r="2.4" fill="currentColor" opacity=".5"/><path d="M3 16 L10 9 L15 13.5 L18 11 L26 17 Z" fill="currentColor" opacity=".45"/><rect x="8" y="17.5" width="13" height="1.6" rx=".8" fill="currentColor"/>',
    };
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
            const warn = short ? ['Short note', 'Add detail here or leave it out'] : dup ? ['Same HN', 'Same HN as a case above'] : has ? ['Has card', 'This case already has a card'] : null;
            const pay = buildSafeAlabastaCaseVisualPayload(c);
            return { c, on: !warn, warn, taxonomy: pay.taxonomySummary, summary: pay.safeSummary.replace(SCRUB_LEAD, ''), english: false, state: 'idle', error: '', url: '', cost: null };
        });
    }
    const consentOf = r => !!(r.c.privacyConsent && r.c.privacyConsent.details);

    async function translate(r) {
        if (r.english || !r.summary.trim()) return;
        const mark = on => { r.translating = on; const el = document.querySelector('.ccm-row[data-i="' + rows.indexOf(r) + '"]'); if (el) el.classList.toggle('is-tr', on); };
        mark(true);
        const from = r.summary, en = await translateAlabastaSummaryToEnglish(from, r.taxonomy, consentOf(r));
        mark(false);
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

    const tiles = () => MODELS.map(([v, t, g, c1, c2, vd]) => `<button type="button" class="ccm-tile" aria-pressed="${v === model}" data-tip="${esc(t)}" aria-label="${esc(t)}" style="--c1:${c1};--c2:${c2};--vc:${VENDORS[vd][0]}" onclick="caseCardMulti.pickModel('${esc(v)}')"><span>${g || `<img src="${VENDORS.grok[1]}" alt="">`}</span><img class="ccm-tv${vd === 'grok' ? ' dk' : ''}" src="${VENDORS[vd][1]}" alt=""></button>`).join('');
    const thumbs = on => LAYOUTS.map(([v, t, r, d]) => { const w = r === '16:9' ? 39 : 29; return `<button type="button" class="ccm-thumb" aria-pressed="${v === on}" data-tip="${esc(t + ' · ' + r)}&#10;${esc(d)}" aria-label="${esc(t + ', ' + r)}" onclick="caseCardMulti.pickLayout('${v}')"><svg viewBox="0 0 ${w} 22" width="${w * 24 / 22}" height="24" aria-hidden="true"><rect x="1" y="1" width="${w - 2}" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/>${DRAW[v]}</svg></button>`; }).join('');
    function picks() {
        const on = getCaseCardLayout(), m = MODELS.find(x => x[0] === model) || MODELS[0], l = LAYOUTS.find(x => x[0] === on) || LAYOUTS[0];
        return `<div class="ccm-pick"><div class="ccm-rail" role="group" aria-label="Image model">${tiles()}</div><span class="ccm-div"></span><div class="ccm-rail" role="group" aria-label="Style">${thumbs(on)}</div></div><div class="ccm-cap"><b>${esc(m[1])}</b> · ${esc(l[1])} <i>${l[2]}</i></div>`;
    }
    function head() {
        const done = rows.filter(r => r.state === 'done').length, failed = rows.filter(r => r.state === 'failed').length, picked = rows.filter(r => r.on).length, wait = rows.filter(r => r.on && r.state !== 'done').length, left = rows.filter(r => r.on && r.state === 'idle').length;
        const retryAll = !busy && failed >= 2 ? '<button type="button" class="ccm-ghost" onclick="caseCardMulti.retryFailed()">↻ Retry failed</button>' : '';
        const action = busy ? `<span class="ccm-count">${done + failed} of ${picked}</span><button type="button" class="ccm-ghost" onclick="caseCardMulti.halt()"${stop ? ' disabled' : ''}>${stop ? 'Stopping…' : 'Stop'}</button>`
            : done || failed ? `<span class="ccm-count">${done} ready${failed ? ' · ' + failed + ' failed' : ''}</span>${retryAll}${left ? '<button type="button" class="ccm-go" onclick="caseCardMulti.run()">Generate ' + left + '</button>' : ''}${done ? '<button type="button" class="ccm-go" onclick="caseCardMulti.zip(this)">⬇ ZIP (' + done + ')</button>' : ''}`
                : wait ? `<button type="button" class="ccm-go" onclick="caseCardMulti.run()">Generate ${wait} card${wait === 1 ? '' : 's'}</button>`
                    : '<span class="ccm-count">Select at least 1 case</span><button type="button" class="ccm-go" disabled>Generate</button>';
        return `<div class="ccm-hd"><b>Case cards</b><span class="ccm-acts">${action}<button type="button" class="ccm-x" onclick="caseCardMulti.close()" aria-label="Close"${busy ? ' disabled' : ''}>✕</button></span></div>` +
            (busy ? `<div class="ccm-bar"><span style="width:${picked ? Math.round((done + failed) / picked * 100) : 0}%"></span></div>` : done || failed ? ''
                : `${picks()}<label class="ccm-all"><input type="checkbox" id="ccm-all" onchange="caseCardMulti.all(this.checked)" aria-label="Select all"> ${picked} of ${rows.length} selected</label>`);
    }
    function rowHtml(r, i) {
        const c = r.c, hn = `<i>${esc(c.caseId || '—')}</i>`, sys = esc(alabastaEnglishOnly(c.diseaseSystemLabel || '') || 'Other');
        if (r.state === 'idle') return `<div class="ccm-row${r.translating ? ' is-tr' : ''}" data-i="${i}"><input type="checkbox" ${r.on ? 'checked' : ''} onchange="caseCardMulti.tick(${i}, this.checked)" aria-label="Include ${esc(c.caseId || '')}"><div class="ccm-txt"><b>${hn} ${sys}${r.warn ? ` <button type="button" class="ccm-flag" title="${esc(r.warn[1])}" onclick="showToast(this.title)">${esc(r.warn[0])}</button>` : ''}<span class="ccm-tr" title="Translating"></span></b><textarea rows="2" oninput="caseCardMulti.edit(${i}, this.value)" aria-label="Summary">${esc(r.summary)}</textarea></div></div>`;
        if (r.state === 'done') return `<div class="ccm-res ok"><img src="${esc(r.url)}" alt="Case card ${esc(c.caseId || '')}" onclick="caseCardMulti.zoom(${i})"><small>${hn} ✓ ${r.saved === false ? 'Gallery save failed' : 'Saved'} <a href="${esc(r.url)}" download="${esc(fileOf(c))}">⬇ PNG</a><button type="button" class="ccm-re" onclick="caseCardMulti.again(${i})" title="Make this card again" aria-label="Regenerate ${esc(c.caseId || '')}"${busy ? ' disabled' : ''}>↻</button></small></div>`;
        if (r.state === 'failed') return `<div class="ccm-res bad"><small>${hn} ✕ ${esc(r.error)}</small><button type="button" class="ccm-ghost" onclick="caseCardMulti.retry(${i})"${busy ? ' disabled' : ''}>↻ Retry</button></div>`;
        return `<div class="ccm-row"><span class="ccm-s">${r.state === 'running' ? '⟳' : '·'}</span><div class="ccm-txt"><b>${hn} ${sys}</b></div></div>`;
    }
    const fileOf = c => (c.caseId ? 'case-' + String(c.caseId).replace(/[^\w.-]+/g, '_') : 'case-' + c.id) + '.png';
    function draw() {
        const box = $('ccm-sheet');
        if (!box) return;
        const shown = rows.map((r, i) => [r, i]).filter(([r]) => !ran || r.on);
        box.innerHTML = head() + `<div class="ccm-body${shown.length && shown.every(([r]) => r.state === 'done' || r.state === 'failed') ? ' grid' : ''}">${shown.map(([r, i]) => rowHtml(r, i)).join('')}</div>`;
        const all = $('ccm-all'), n = rows.filter(r => r.on).length;
        if (all) { all.checked = n === rows.length; all.indeterminate = n > 0 && n < rows.length; }
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

    function zoom(i) {
        const r = rows[i], ov = document.createElement('div');
        ov.id = 'ccm-zoom';
        ov.innerHTML = `<div class="ccm-zb"><img src="${esc(r.url)}" alt="Case card ${esc(r.c.caseId || '')}"><span><button type="button" class="ccm-ghost" onclick="caseCardMulti.again(${i})">↻ Regenerate</button><a class="ccm-go" href="${esc(r.url)}" download="${esc(fileOf(r.c))}">⬇ PNG</a><button type="button" class="ccm-ghost" onclick="caseCardMulti.unzoom()">Close</button></span></div>`;
        ov.addEventListener('click', e => { if (e.target === ov) unzoom(); });
        document.body.appendChild(ov);
    }
    function unzoom() { const ov = $('ccm-zoom'); if (ov) ov.remove(); }

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
        all(on) { rows.forEach(r => { r.on = on; }); draw(); if (on) pool(rows.slice(), WORKERS, translate); },
        zoom, unzoom,
        edit(i, v) { rows[i].summary = v; rows[i].english = true; },
        pickModel(m) { model = m; try { localStorage.setItem(prefKey(), m); } catch (e) { /* this sheet still uses it */ } draw(); },
        pickLayout(l) { selectCaseCardLayout(l); draw(); },
        run() { runList(rows.filter(r => r.on && r.state !== 'done')); },
        retry(i) { runList([rows[i]]); },
        retryFailed() { runList(rows.filter(r => r.state === 'failed')); },
        again(i) { unzoom(); rows[i].state = 'idle'; runList([rows[i]]); },
        halt() { stop = true; draw(); },
    };
})();
