// V102.15: Bulk Paste header = one row (design A) + progress ring (design B): 📋 Bulk Paste ⓘ · ring n/N · ← 📚 · 🎯 + logo ▾.
// Real markup, admin <style> blocks, chip CSS; the real E.V.I.E. batch drives the ring.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('slice: ' + a); return html.slice(i, j); };
const modal = slice('    <div id="bulkPasteModal"', '    <!-- V97.20: Generate Quiz from Image(s)');
const chipJs = slice('        window.bpSyncModelChip = function()', '        function renderBulkPastePreview() {');
const logoJs = slice('        window.aiModelLogoHtml = function', '        window.syncAuditFixHints = function');
const batchJs = slice('        async function bulkPasteFindAnswers()', '        // V97.23:');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://bp.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
        await page.route('https://bp.test/assets/**', r => r.fulfill({ path: 'public' + new URL(r.request().url()).pathname, contentType: 'image/svg+xml' }));
        await page.goto('https://bp.test/');
        await page.addStyleTag({ content: styles });
        for (const css of ['public/text-ai-chips.css', 'public/audit-toolbar.css']) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
        await page.evaluate(m => {
            document.body.innerHTML = m;
            const el = document.getElementById('bulkPasteModal'); el.style.display = 'block';
        }, modal);
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
            window.aiModelShortName = id => (textAIModelInfo(id) || {}).short || id;
            window.toasts = []; window.showToast = (...a) => toasts.push(a);
            document.getElementById('bp-ai-model').innerHTML = '<option value="gpt-6-astra">GPT 6 Astra</option>';
        });
        await page.addScriptTag({ content: logoJs + chipJs + batchJs });
        await page.evaluate(() => bpSyncModelChip());

        // stage 1 (paste): header = 📋 Bulk Paste ⓘ; how-to in the hover; no tools, no paragraph
        const tools = page.locator('#bulkPasteModal .bp-head-tools');
        assert.equal(await tools.isVisible(), false, 'tools hidden while pasting');
        assert.match(await page.locator('.bp-help').getAttribute('title'), /คั่นด้วยบรรทัดว่าง/);
        assert.match(await page.locator('.bp-help').getAttribute('aria-label'), /blank line/);
        assert.equal(await page.locator('#bulkPasteModal .bp-head p').count(), 0, 'no description paragraph');
        assert.equal(await page.locator('#bulkPasteModal h3').innerText(), 'Bulk Paste');

        // stage 2 (preview): one row — ring · ← 📚 · 🎯 + logo ▾
        await page.evaluate(() => { document.getElementById('bp-input-stage').style.display = 'none'; document.getElementById('bp-preview-stage').style.display = 'block'; });
        assert.equal(await tools.isVisible(), true, 'tools shown in the preview stage');
        const head = await page.locator('.bp-head').boundingBox();
        assert.ok(head.height <= 60, 'header is one row, got ' + head.height);
        for (const sel of ['#bp-status-dot', '.bp-tools', '#bp-find-btn', '#bp-model-chip']) {
            const b = await page.locator(sel).boundingBox();
            assert.ok(b.y >= head.y - 1 && b.y + b.height <= head.y + head.height + 1, sel + ' sits in the header row');
        }
        const chip = page.locator('#bp-model-chip');
        assert.equal((await chip.innerText()).trim(), '', 'chip is logo + ▾ only');
        assert.equal(await chip.getAttribute('data-model'), 'Astra 6');
        assert.match(await chip.getAttribute('title'), /GPT 6 Astra/);
        assert.equal(await chip.locator('.text-ai-logo').getAttribute('data-owner'), 'openai');

        // ring: the real batch → amber while running, then green n/N, red when some fail
        const run = async failAt => page.evaluate(async f => {
            let n = 0;
            window._bulkPasteParsed = Array.from({ length: 10 }, () => ({ include: true, q: 'Q', options: ['a', 'b'], correct: [] }));
            window.callUniversalAI = () => {};
            window._aiFindAnswerCore = async () => { if (n++ === f) throw new Error('boom'); return { picks: [0], conf: 90, rationale: '' }; };
            window.renderBulkPastePreview = () => {};
            await bulkPasteFindAnswers();
            const ring = document.getElementById('bp-status-dot'), s = getComputedStyle(ring);
            return { text: document.getElementById('bp-preview-count').textContent, c: ring.style.getPropertyValue('--c'), p: ring.style.getPropertyValue('--p'), bg: s.backgroundImage };
        }, failAt);
        const ok = await run(-1);
        assert.deepEqual([ok.text, ok.c, ok.p], ['10/10', '#22c55e', '100']);
        assert.match(ok.bg, /conic-gradient\(rgb\(34, 197, 94\) 100%/, 'green ring, full');
        const bad = await run(3);
        assert.deepEqual([bad.text, bad.c, bad.p], ['9/10', '#ef4444', '90'], 'red ring, 90%');

        // phone: the row fits the modal
        await page.setViewportSize({ width: 390, height: 800 });
        const fit = await page.evaluate(() => { const c = document.querySelector('#bulkPasteModal .modal-content').getBoundingClientRect(); return [...document.querySelectorAll('#bulkPasteModal .bp-head > *, #bulkPasteModal .bp-head-tools > *')].filter(e => e.offsetParent).every(e => { const r = e.getBoundingClientRect(); return r.right <= c.right + 1 && r.left >= c.left - 1; }); });
        assert.equal(fit, true, 'header fits at 390 px');
        assert.deepEqual(errors, []);
        console.log('PASS: Bulk Paste header — one row, ⓘ hover how-to, tools only in preview, logo-only model chip, ring colour/progress from the real batch, 390 px fit');
    } finally { await browser.close(); }
})();
