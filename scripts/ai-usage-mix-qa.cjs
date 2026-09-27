// V102.20: AI usage hourly heatmap — each hour is a stacked bar (height = volume, bands = share per model owner in
// its logo colour) with an Official API vs OpenRouter share in the legend, the hover and the model bubble.
// Real module + CSS; the route is read from the hourly key (base64url "provider:model", as recordAiUsage writes it).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const key = (prov, model) => Buffer.from(prov + ':' + model).toString('base64url');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent('<div id="settings"></div>');
        await page.addStyleTag({ path: 'public/ai-usage-overview.css' });
        const models = {
            [key('anthropic', 'claude-sonnet-5')]: { model: 'claude-sonnet-5', tokens: 4000, count: 2 },
            [key('openai', 'gpt-6-luna')]: { model: 'gpt-6-luna', tokens: 2000, count: 3 },
            [key('gemini-aistudio', 'gemini-3.8-flash')]: { model: 'gemini-3.8-flash', tokens: 1000, count: 1 },
            [key('openrouter', 'qwen/qwen3.8-max-0902')]: { model: 'qwen/qwen3.8-max-0902', tokens: 2000, count: 1 },
            [key('openrouter', 'x-ai/grok-4.7')]: { model: 'x-ai/grok-4.7', tokens: 1000, count: 1 }
        };
        await page.evaluate(m => {
            const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            window.docs = [{ date, totalTokens: 12000, totalCount: 9, hours: {
                '10': { tokens: 10000, count: 8, models: m },
                '15': { tokens: 2000, count: 1, models: { [Object.keys(m)[3]]: m[Object.keys(m)[3]] } }
            }, models: {}, providers: {} }];
            window.db = { collection: () => ({ where: () => ({ orderBy: () => ({ get: async () => ({ docs: docs.map(d => ({ data: () => d })) }) }) }) }) };
        }, models);
        await page.addScriptTag({ path: 'public/ai-usage-overview.js' });
        await page.evaluate(() => aiUsageOverview.mount('settings'));
        await page.waitForSelector('#settings .au-mix-legend');

        // legend: owner shares (tokens) + route split
        const legend = await page.locator('.au-mix-legend').innerText();
        assert.match(legend, /Anthropic\s*33%/); assert.match(legend, /Qwen\s*33%/); assert.match(legend, /OpenAI\s*17%/);
        assert.match(legend, /Google\s*8%/); assert.match(legend, /Grok\s*8%/);
        assert.match(legend, /Official API 58% · OpenRouter 42%/, 'route split over the period');

        // the 10:00 cell: full-height bar, one band per owner with its logo colour, shares in the hover
        const cells = page.locator('#settings .au-scroll button');
        const c10 = cells.nth(6 * 24 + 10), c15 = cells.nth(6 * 24 + 15);
        const bar = await c10.evaluate(b => { const m = b.querySelector('.au-mix'); return { h: m.style.height, bands: [...m.children].map(i => [getComputedStyle(i).backgroundColor || '', getComputedStyle(i).backgroundImage, Number(i.style.flexGrow)]) }; });
        assert.equal(bar.h, '100%', 'busiest hour = full height');
        assert.deepEqual(bar.bands.map(b => b[2]), [1000, 2000, 4000, 2000, 1000], 'google, openai, anthropic, qwen, grok (bottom-up)');
        assert.match(bar.bands[0][1], /linear-gradient/, 'Google = its 4-colour band');
        assert.deepEqual(bar.bands.slice(1).map(b => b[0]), ['rgb(13, 13, 13)', 'rgb(217, 119, 87)', 'rgb(99, 54, 231)', 'rgb(113, 113, 122)']);
        const title = await c10.getAttribute('title');
        assert.match(title, /Anthropic 40% · OpenAI 20% · Qwen 20% · Google 10% · Grok 10%/);
        assert.match(title, /Official API 70% · OpenRouter 30%/);
        assert.equal(await c15.evaluate(b => b.querySelector('.au-mix').style.height), '40%', 'a smaller hour = a shorter bar');
        assert.match(await c15.getAttribute('title'), /Official API 0% · OpenRouter 100%/);
        assert.equal(await cells.nth(6 * 24 + 3).locator('.au-mix').count(), 0, 'empty hour stays gray');

        // calls metric: shares follow the metric
        await page.locator('#settings select[aria-label="Heatmap metric"]').selectOption('count');
        assert.match(await page.locator('#settings .au-scroll button').nth(6 * 24 + 10).getAttribute('title'), /OpenAI 38%/);

        // the model bubble carries the split
        await page.locator('#settings .au-scroll button').nth(6 * 24 + 10).click();
        assert.match(await page.locator('.au-bubble-mix').innerText(), /Official API 70% · OpenRouter 30%/);
        assert.deepEqual(errors, []);
        console.log('PASS: usage heatmap — stacked owner bars in logo colours, height = volume, legend + hover + bubble route split, metric-aware');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
