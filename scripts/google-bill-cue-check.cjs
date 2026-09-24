// V101.57: Google Cloud bill cues — chips on Google-billed routes carry data-bill="google",
// and the AI usage overview opens with a Google Cloud bill card built from ai_usage.
//   node scripts/google-bill-cue-check.cjs
const assert = require('node:assert/strict'), { chromium } = require('playwright');
(async () => { const browser = await chromium.launch(); try {
    const page = await browser.newPage();
    await page.setContent('<div id="rail"></div><div id="ov"></div>');
    await page.addStyleTag({ path: 'public/text-ai-chips.css' });
    await page.addStyleTag({ path: 'public/ai-usage-overview.css' });
    await page.addScriptTag({ path: 'public/ai-model-ui.js' });
    const billed = await page.evaluate(() => {
        document.getElementById('rail').innerHTML = textAIChipsHtml('', 'gpt-5.6-luna', '');
        return [...document.querySelectorAll('#rail button[data-bill="google"]')].map(b => b.dataset.value);
    });
    assert.deepEqual(billed, ['as/gemini-3.5-flash-lite', 'gemini-3.8-flash']);
    assert.equal(await page.evaluate(() => isGoogleBilledModel('or/google/gemini-3.1-flash-image-preview')), false);
    assert.match(await page.locator('#rail button[data-value="gemini-3.8-flash"]').getAttribute('title'), /Google Cloud bill/);
    assert.equal(await page.locator('#rail .text-ai-chips').evaluate(n => getComputedStyle(n, '::after').content), '"Google Cloud bill"');

    await page.evaluate(() => {
        const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        const docs = [{ date, totalCount: 10, totalTokens: 1000, models: {
            a: { provider: 'gemini', model: 'gemini-3.5-flash', count: 3, tokens: 300 },
            b: { provider: 'gemini-aistudio', model: 'gemini-3.8-flash', count: 2, tokens: 100 },
            c: { provider: 'openai', model: 'gpt-5.6-luna', count: 5, tokens: 600 } } }];
        window.db = { collection: () => ({ where: () => ({ orderBy: () => ({ get: async () => ({ docs: docs.map(d => ({ data: () => d })) }) }) }) }) };
    });
    await page.addScriptTag({ path: 'public/ai-usage-overview.js' });
    await page.evaluate(() => aiUsageOverview.mount('ov'));
    const card = page.locator('#ov .gc-bill');
    assert.equal(await card.count(), 1);
    const text = await card.innerText();
    assert.match(text, /40%/);                                  // 400 of 1,000 tokens
    assert.match(text, /Vertex AI · Gemini\s+3\s+300/);
    assert.match(text, /Gemini API · AI Studio\s+2\s+100/);
    assert.match(text, /Cloud Text-to-Speech\s+0\s+0/);
    assert.match(text, /Prepay — Gemini API requests stop when the credit reaches ฿0/);
    assert.match(text, /FKB-300 · ฿300 \/ month/);
    assert.deepEqual(await card.locator('a.gc-link').evaluateAll(a => a.map(n => n.getAttribute('href'))), ['https://aistudio.google.com/billing', 'https://console.cloud.google.com/billing/reports']);
    await page.locator('#ov select[aria-label="Activity view"]').selectOption('Daily');
    assert.equal(await page.locator('#ov .au-scroll th .gc-ring').count(), 2);  // gemini rows only, not gpt
    for (const width of [320, 390, 1024]) { await page.setViewportSize({ width, height: 800 }); assert(await page.locator('#ov').evaluate(n => n.scrollWidth <= n.clientWidth)); }
    console.log('PASS: Google-billed chips, rail legend, Google Cloud bill card, row rings, mobile width');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
