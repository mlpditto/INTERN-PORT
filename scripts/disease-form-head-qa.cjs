// V102.132: Disease Codex edit/add form — header made as lean as the Drug form's (icon-only AI buttons,
// provider-logo model rail behind the model chip, ⓘ details holding Updated / Contributors / the authorship key).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); assert.ok(a >= 0 && b > a, 'anchor ' + from); return html.slice(a, b); };
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 980, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://dxhead.test/', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://dxhead.test/');
        await page.route('**/*', route => route.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
        const syncStart = html.indexOf('        window.syncModelDefault =');
        await page.addScriptTag({ content: html.slice(syncStart, html.indexOf('\n        };', syncStart) + 11) });
        for (const css of ['text-ai-chips.css', 'audit-toolbar.css']) await page.addStyleTag({ path: 'public/' + css });
        await page.addScriptTag({ path: 'public/ai-model-registry.js' });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addScriptTag({ content: cut('        window.browseAuditProvider =', '        window.auditModelControlsHtml') });
        await page.addScriptTag({ content: cut('        window.aiModelLogoHtml = function', '        // V101.84: ✦ Suggest fix') });
        await page.evaluate(() => { window.DXA_FIELD_KEYS = ['diseaseName']; window.DXA_ARRAY_FIELDS = {}; window.dxaState = { internDraftValues: null }; window.dxaCollectForm = () => ({ diseaseName: 'Influenza' }); });
        await page.addScriptTag({ content: cut('        function dxaShowAiButtons() {', '        // Model for AI fill / AI Review / AI ICD') + '\n' + cut('        function dxaNormProvVal(', '        async function dxaLoadProvenanceForEdit') +
            '\nObject.assign(window,{dxaShowAiButtons,dxaHideAiButtons,dxaRenderFormModelRail,dxaPickFormModel,dxaToggleFormModelRail,dxaToggleFormMore,dxaSetStatusChip,dxaClearProvenanceTint,dxaApplyProvenanceTint});' });

        // open the form view like dxaEdit does
        await page.evaluate(() => {
            localStorage.setItem('ai_default_dxa_model', 'gpt-6-luna');
            document.getElementById('dxa-ai-model-val').value = 'gpt-6-luna';
            const m = document.getElementById('diseaseCodexAdminModal');
            m.style.cssText = 'display:block;position:static;padding:12px;';
            m.querySelector('.modal-content').style.cssText += ';position:relative;margin:0 auto;max-width:910px;width:910px;box-sizing:border-box;';
            document.querySelectorAll('#diseaseCodexAdminModal [id^="dxa-view-"]').forEach(v => { v.style.display = v.id === 'dxa-view-form' ? 'block' : 'none'; });
            document.getElementById('dxa-form-mode-label').textContent = 'Edit · Influenza';
            document.getElementById('dxa-form-doc-id').textContent = 'doc: 7QpL…hFa';
            dxaShowAiButtons(); dxaSetStatusChip('📚 Published', 'published');
        });

        // ---- structure / icon-only / one row ----
        assert.deepEqual(await page.locator('.dxa-form-actions > *').evaluateAll(es => es.map(e => e.id)), ['dxa-form-ai-fill-btn', 'dxa-form-ai-review-btn', 'dxa-form-copy-btn', 'dxa-form-model-wrap', 'dxa-form-info-toggle']);
        assert.deepEqual(await page.locator('#dxa-form-ai-fill-btn, #dxa-form-ai-review-btn').allInnerTexts(), ['🤖', '🔍']);
        await page.evaluate(() => { dxaHideAiButtons(); dxaShowAiButtons(); });
        assert.deepEqual(await page.locator('#dxa-form-ai-fill-btn, #dxa-form-ai-review-btn').allInnerTexts(), ['🤖', '🔍'], 'labels the code writes back stay icon-only');
        assert.match(await page.locator('#dxa-form-ai-fill-btn').getAttribute('title'), /AI fill empty fields/);
        const g = await page.evaluate(() => { const h = document.querySelector('.dxa-form-head').getBoundingClientRect(), tabs = document.getElementById('dxa-form-tabs').getBoundingClientRect(), a = document.querySelector('.dxa-form-actions').getBoundingClientRect(), n = document.getElementById('dxa-form-mode-label').getBoundingClientRect(); return { headH: Math.round(h.height), toTabs: Math.round(tabs.top - h.top), sameRow: Math.abs(a.top - n.top) < 20 }; });
        assert.ok(g.headH <= 50 && g.sameRow, 'one row: ' + JSON.stringify(g));
        assert.ok(g.toTabs <= 70, 'header + closed panels stay compact: ' + JSON.stringify(g));

        // ---- model chip + provider rail ([hidden] must really hide) ----
        assert.equal(await page.locator('#dxa-form-model-rail').isVisible(), false);
        assert.equal(await page.locator('#dxa-form-more').isVisible(), false);
        assert.equal(await page.locator('#dxa-form-model-name').innerText(), 'Luna 6');
        await page.locator('#dxa-form-model-toggle').click();
        assert.equal(await page.locator('#dxa-form-model-rail').isVisible(), true);
        assert.equal(await page.locator('#dxa-form-model-rail .audit-provider').count() > 3, true, 'provider logo tabs');
        assert.equal(await page.locator('#dxa-form-model-rail .text-ai-chips > button').count(), await page.evaluate(() => TEXT_AI_MODELS.length), 'every model reachable');
        await page.locator('#dxa-form-model-rail .audit-provider[data-provider="Claude"]').click();
        await page.locator('#dxa-form-model-rail .text-ai-chips > button[data-value="claude-haiku-4-5"]').click();
        assert.equal(await page.locator('#dxa-ai-model-val').inputValue(), 'claude-haiku-4-5');
        assert.equal(await page.locator('#dxa-form-model-name').innerText(), 'Haiku 4.5');
        assert.equal(await page.locator('#dxa-form-model-rail').isVisible(), false, 'a pick closes the rail');
        assert.equal(await page.locator('#dxa-form-model-toggle').getAttribute('aria-expanded'), 'false');
        await page.locator('#dxa-form-model-toggle').click();
        assert.equal(await page.locator('#dxa-form-model-rail .audit-provider[aria-pressed=true]').getAttribute('data-provider'), 'Claude', 'reopens on the picked provider');
        await page.locator('#dxa-form-model-toggle').click();
        assert.equal(await page.locator('#dxa-form-model-rail').isVisible(), false);

        // ---- ⓘ details: manual toggle; the authorship key opens it once, clearing it closes it ----
        await page.evaluate(() => { const m = document.getElementById('dxa-form-meta'); m.style.display = 'flex'; m.innerHTML = '<span><strong>Updated:</strong> today</span>'; });
        await page.locator('#dxa-form-info-toggle').click();
        assert.equal(await page.locator('#dxa-form-more').isVisible(), true);
        assert.match(await page.locator('#dxa-form-more').innerText(), /Updated/);
        await page.locator('#dxa-form-info-toggle').click();
        assert.equal(await page.locator('#dxa-form-more').isVisible(), false);
        await page.evaluate(() => { dxaState.internDraftValues = { diseaseName: 'Influenza' }; dxaApplyProvenanceTint(); });
        assert.equal(await page.locator('#dxa-form-more').isVisible(), true, 'authorship key shows → ⓘ opens');
        assert.equal(await page.locator('#dxa-prov-legend').isVisible(), true);
        await page.locator('#dxa-form-info-toggle').click();                         // user closes it …
        await page.evaluate(() => dxaApplyProvenanceTint());                         // … a re-tint (every keystroke) must not reopen it
        assert.equal(await page.locator('#dxa-form-more').isVisible(), false);
        await page.evaluate(() => { dxaState.internDraftValues = null; dxaApplyProvenanceTint(); });   // no draft → cleared
        assert.equal(await page.locator('#dxa-prov-legend').isVisible(), false);
        await page.locator('#dxa-form-info-toggle').click();                         // a manually opened panel is not closed by a clear
        await page.evaluate(() => dxaClearProvenanceTint());
        assert.equal(await page.locator('#dxa-form-more').isVisible(), true);

        // ---- narrow screens (only the modal is judged — the rest of admin.html is not laid out for phones here) ----
        for (const width of [320, 390, 736]) {
            await page.setViewportSize({ width, height: 900 });
            await page.evaluate(w => { document.querySelector('#diseaseCodexAdminModal .modal-content').style.width = Math.min(910, w - 24) + 'px'; }, width);
            assert.ok(await page.evaluate(() => { const c = document.querySelector('#diseaseCodexAdminModal .modal-content'); return c.scrollWidth <= c.clientWidth + 1 && [...c.querySelectorAll('.dxa-form-head, .dxa-form-head *')].every(e => e.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1); }), 'header overflows at ' + width);
        }
        assert.deepEqual(errors, []);
        console.log('PASS: Disease form header — icon-only 🤖 🔍 📋, provider rail from the model chip (pick closes it), ⓘ details + authorship key auto-open once, narrow screens');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
