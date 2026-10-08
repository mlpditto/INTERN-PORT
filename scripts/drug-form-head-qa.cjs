// V102.131: Drug Codex edit/add form — lean one-row header (drug-toolbar.js / .css, admin.html dcaSetStatusChip).
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
        await page.route('http://head.test/', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://head.test/');
        await page.route('**/*', route => route.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
        const syncStart = html.indexOf('        window.syncModelDefault =');
        await page.addScriptTag({ content: html.slice(syncStart, html.indexOf('\n        };', syncStart) + 11) });
        await page.evaluate(() => {
            window.updateModelDescription = window.showToast = () => {};
            window.DCA_AI_LS_KEY = 'ai_default_drug_codex_model'; window.DCA_AI_FALLBACK_MODEL = 'claude-4-sonnet-latest';
            window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { __copied.push(t); return Promise.resolve(); } }, configurable: true });
        });
        for (const css of ['text-ai-chips.css', 'audit-toolbar.css', 'drug-toolbar.css']) await page.addStyleTag({ path: 'public/' + css });
        await page.addScriptTag({ path: 'public/ai-model-registry.js' });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addScriptTag({ content: cut('        window.browseAuditProvider =', '        window.auditModelControlsHtml') });
        await page.addScriptTag({ content: cut('        window.aiModelLogoHtml = function', '        // V101.84: ✦ Suggest fix') });
        await page.addScriptTag({ content: cut('        function dcaShowAiFillButton() {', '        // ── V95.87') + '\nwindow.dcaSetStatusChip = dcaSetStatusChip; window.dcaShowAiFillButton = dcaShowAiFillButton; window.dcaHideAiFillButton = dcaHideAiFillButton;' });
        await page.addScriptTag({ path: 'public/drug-toolbar.js' });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));

        // open the form view like dcaEdit does
        await page.evaluate(() => {
            const m = document.getElementById('drugCodexAdminModal');
            m.style.cssText = 'display:block;position:static;padding:12px;';
            m.querySelector('.modal-content').style.cssText += ';position:relative;margin:0 auto;max-width:910px;width:910px;box-sizing:border-box;';
            document.getElementById('dca-view-published').style.display = 'none';
            document.getElementById('dca-view-form').style.display = 'block';
            document.getElementById('dca-form-mode-label').textContent = 'Edit · Baloxavir marboxil';
            document.getElementById('dca-form-doc-id').textContent = 'doc: 7QpL2mXr9TzKd3VbYhFa';
            dcaShowAiFillButton(); dcaSetStatusChip('📚 Published', 'published');
        });

        // ---- structure: one row, the old toolbar / provenance rows are gone ----
        const order = await page.locator('.dt-head > *').evaluateAll(es => es.map(e => e.id || e.className.split(' ')[0]));
        assert.deepEqual(order, ['dca-form-mode-label', 'dca-form-status-chip', 'dca-form-ai-badge', 'dca-form-doc-id', 'dt-actions']);
        assert.deepEqual(await page.locator('.dt-actions > *').evaluateAll(es => es.map(e => e.id)), ['dca-form-ai-fill-btn', 'dca-form-ai-review-btn', 'dca-form-copy-btn', 'dt-model-toggle', 'dt-info-toggle']);
        assert.equal(await page.locator('.dt-ai-toolbar, .dt-provenance').count(), 0);
        const g = await page.evaluate(() => { const h = document.querySelector('.dt-head').getBoundingClientRect(), tabs = document.getElementById('dca-form-tabs').getBoundingClientRect(), a = document.querySelector('.dt-actions').getBoundingClientRect(), n = document.getElementById('dca-form-mode-label').getBoundingClientRect(); return { headH: Math.round(h.height), toTabs: Math.round(tabs.top - h.top), sameRow: Math.abs(a.top - n.top) < 20 }; });
        assert.ok(g.headH <= 50 && g.sameRow, 'one row: ' + JSON.stringify(g));
        assert.ok(g.toTabs <= 70, 'header + closed panels stay compact: ' + JSON.stringify(g));
        // icon-only AI buttons survive the show / hide helpers that rewrite their text
        assert.equal(await page.locator('#dca-form-ai-fill-btn').innerText(), '🤖');
        await page.evaluate(() => { dcaHideAiFillButton(); dcaShowAiFillButton(); });
        assert.deepEqual(await page.locator('#dca-form-ai-fill-btn, #dca-form-ai-review-btn').allInnerTexts(), ['🤖', '🔍']);
        assert.match(await page.locator('#dca-form-ai-review-btn').getAttribute('title'), /AI Review|review/i);

        // ---- status chip ----
        assert.equal(await page.locator('#dca-form-status-chip').innerText(), '📚 Published');
        assert.equal(await page.locator('#dca-form-status-chip').evaluate(e => e.classList.contains('is-published')), true);
        await page.evaluate(() => dcaSetStatusChip('📥 Draft', 'draft'));
        assert.equal(await page.locator('#dca-form-status-chip.is-draft').count(), 1);
        await page.evaluate(() => dcaSetStatusChip(''));
        assert.equal(await page.locator('#dca-form-status-chip').isVisible(), false);

        // ---- doc id: short, click copies the full id ----
        assert.ok(await page.locator('#dca-form-doc-id').evaluate(e => e.getBoundingClientRect().width) < 130, 'doc id is truncated');
        await page.locator('#dca-form-doc-id').click();
        assert.deepEqual(await page.evaluate(() => __copied), ['7QpL2mXr9TzKd3VbYhFa']);

        // ---- model chip + provider rail ----
        assert.equal(await page.locator('#dt-models').isVisible(), false, '[hidden] must beat .audit-toolbar display');
        assert.equal(await page.locator('#dt-more').isVisible(), false, '[hidden] must beat .dt-more display');
        await page.locator('#dt-model-toggle').click();
        assert.equal(await page.locator('#dt-models').isVisible(), true);
        assert.equal(await page.locator('#dt-model-toggle').getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#dt-models .audit-provider').count() > 3, true, 'provider logo tabs');
        await page.locator('#dt-models .audit-provider[data-provider="Claude"]').click();
        await page.locator('#dt-models .text-ai-chips > button[data-value="claude-haiku-4-5"]').click();
        assert.equal(await page.locator('#dca-ai-model-val').inputValue(), 'claude-haiku-4-5');
        assert.equal(await page.evaluate(() => localStorage.getItem('ai_default_drug_codex_model')), 'claude-haiku-4-5');
        assert.equal(await page.locator('#dt-model-name').innerText(), 'Haiku 4.5');
        assert.equal(await page.locator('#dt-models').isVisible(), false, 'a pick closes the rail');
        assert.equal(await page.locator('#dt-model-toggle').getAttribute('aria-expanded'), 'false');
        await page.locator('#dt-model-toggle').click();
        assert.equal(await page.locator('#dt-models .audit-provider[aria-pressed=true]').getAttribute('data-provider'), 'Claude', 'rail reopens on the picked provider');
        await page.locator('#dt-model-toggle').click();
        assert.equal(await page.locator('#dt-models').isVisible(), false);

        // ---- ⓘ details: manual toggle; opens once by itself when the authorship key shows up ----
        await page.evaluate(() => { document.getElementById('dca-form-meta').style.display = 'flex'; document.getElementById('dca-form-meta').innerHTML = '<span><strong>Updated:</strong> today</span><span id="dca-prov-inline-key" style="display:none;"></span>'; });
        assert.equal(await page.locator('#dt-more').isVisible(), false);
        await page.locator('#dt-info-toggle').click();
        assert.equal(await page.locator('#dt-more').isVisible(), true);
        assert.match(await page.locator('#dt-more').innerText(), /Updated/);
        await page.locator('#dt-info-toggle').click();
        assert.equal(await page.locator('#dt-more').isVisible(), false);
        await page.evaluate(() => { const k = document.getElementById('dca-prov-inline-key'); k.innerHTML = 'INTERN · ADMIN'; k.style.display = 'inline'; });
        await page.waitForFunction(() => !document.getElementById('dt-more').hidden);
        await page.locator('#dt-info-toggle').click();                 // user closes it …
        await page.evaluate(() => { document.getElementById('dca-prov-inline-key').style.display = 'inline'; });   // … and a re-tint must not reopen it
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#dt-more').isVisible(), false);
        await page.evaluate(() => { document.getElementById('dca-form-meta').innerHTML = '<span id="dca-prov-inline-key" style="display:none;"></span>'; });   // another drug
        await page.evaluate(() => { document.getElementById('dca-prov-inline-key').style.display = 'inline'; });
        await page.waitForFunction(() => !document.getElementById('dt-more').hidden);

        // ---- narrow screens ----
        for (const width of [320, 390, 736]) {
            await page.setViewportSize({ width, height: 900 });
            await page.evaluate(w => { document.querySelector('#drugCodexAdminModal .modal-content').style.width = Math.min(910, w - 24) + 'px'; }, width);
            // (the rest of admin.html is not laid out for phones in this harness — only the modal is judged)
            assert.ok(await page.evaluate(() => { const c = document.querySelector('#drugCodexAdminModal .modal-content'); return c.scrollWidth <= c.clientWidth + 1 && [...c.querySelectorAll('.dt-head, .dt-head *')].every(e => e.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1); }), 'header overflows at ' + width);
        }
        assert.deepEqual(errors, []);
        console.log('PASS: Drug form header — one row (name · status · doc id · 🤖 🔍 📋 · model ▾ · ⓘ), provider rail opens/closes, icon-only buttons survive, ⓘ details + authorship key auto-open once, narrow screens');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
