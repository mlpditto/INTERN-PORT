// Drug Codex list toolbar — "+ Add Drug" stays on the SAME line as search / AI Auto-Draft / imports at ~1000 px (it used to wrap onto its own row).
// Real admin.html markup + drug-toolbar.js + the real CSS files; measures element tops in the toolbar.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); assert.ok(a >= 0 && b > a, 'anchor ' + from); return html.slice(a, b); };
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://addbtn.test/', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://addbtn.test/');
        await page.route('**/*', route => route.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
        const syncStart = html.indexOf('        window.syncModelDefault =');
        await page.addScriptTag({ content: html.slice(syncStart, html.indexOf('\n        };', syncStart) + 11) });
        await page.evaluate(() => {
            window.updateModelDescription = window.showToast = () => {};
            window.DCA_AI_LS_KEY = 'ai_default_drug_codex_model'; window.DCA_AI_FALLBACK_MODEL = 'claude-4-sonnet-latest';
        });
        for (const css of ['text-ai-chips.css', 'audit-toolbar.css', 'drug-toolbar.css', 'ai-capsule.css', 'drug-list-ui.css']) await page.addStyleTag({ path: 'public/' + css });
        await page.addScriptTag({ path: 'public/ai-model-registry.js' });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addScriptTag({ content: cut('        window.browseAuditProvider =', '        window.auditModelControlsHtml') });
        await page.addScriptTag({ content: cut('        window.aiModelLogoHtml = function', '        // V101.84: ✦ Suggest fix') });
        await page.addScriptTag({ path: 'public/drug-toolbar.js' });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        await page.evaluate(() => {
            const m = document.getElementById('drugCodexAdminModal');
            m.style.display = 'block';
            document.getElementById('dca-view-published').style.display = 'block';
        });
        const measure = () => page.evaluate(() => {
            const tb = document.querySelector('#dca-view-published .dca-toolbar');
            const kids = [...tb.children].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
            const add = tb.querySelector('.dca-add-btn').getBoundingClientRect();
            return { kids, addTop: Math.round(add.top), addRight: Math.round(add.right), tbRight: Math.round(tb.getBoundingClientRect().right), scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
        });
        if (process.env.SHOT) await page.locator('#dca-view-published .dca-toolbar').screenshot({ path: process.env.SHOT });
        const results = {};
        for (const w of [1000, 980, 1100, 1280]) {
            await page.setViewportSize({ width: w, height: 800 });
            results[w] = await measure();
            const r = results[w];
            assert.ok(Math.max(...r.kids) - Math.min(...r.kids) <= 12, w + 'px: toolbar items share one line ' + JSON.stringify(r));
            assert.ok(r.addRight <= r.tbRight, w + 'px: + Add Drug inside the toolbar ' + JSON.stringify(r));
        }
        await page.setViewportSize({ width: 390, height: 800 });
        const n = await measure();
        assert.ok(n.scrollW <= n.innerW + 1, '390px: no horizontal overflow ' + JSON.stringify(n));
        console.log(JSON.stringify(results), JSON.stringify(n));
        await page.setViewportSize({ width: 1000, height: 800 });
        assert.deepEqual(errors, []);
        console.log('drug-add-btn-line-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exit(1); });
