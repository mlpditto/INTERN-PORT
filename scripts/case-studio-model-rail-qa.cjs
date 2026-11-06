// V102.592: Case Card Studio model rail on the REAL admin.html (every script loaded, network blocked). image-model-prices.js adds 3 vendor-logo
// buttons to #alabasta-case-card-quick-rail before case-studio-steps.js copies that rail, so the Studio drew 3 empty buttons = a blank first pill.
// Also pins the models: GPT Image 2.6 (2026-11-04) and Grok Imagine Image 2.0 (grok-imagine-image-quality has no OpenRouter endpoint since 11-02).
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = require('url').pathToFileURL(path.join(process.cwd(), 'public/admin.html')).href;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        await page.addInitScript(() => {
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(ADMIN, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        const r = await page.evaluate(() => {
            const seg = document.querySelector('#cs-model-lbl + .cs-seg');
            return {
                groups: [...seg.children].map(g => (g.dataset.owner || '?') + ':' + [...g.querySelectorAll('button')].map(b => b.dataset.value).join(',')),
                blank: [...seg.querySelectorAll('button')].filter(b => !b.dataset.value || b.dataset.value === 'undefined' || !b.textContent.trim()).length,
                options: [...document.getElementById('case-studio-image-model').options].map(o => o.value),
            };
        });
        assert.equal(r.blank, 0, 'no empty button in the model rail: ' + r.groups.join(' | '));
        assert.deepEqual(r.groups, ['gemini:as/gemini-nano-banana-2.1,as/gemini-3.1-flash-lite-image,as/gemini-3-pro-image', 'openai:gpt-image-2.6-flare,gpt-image-2.6-sunburst', 'grok:or/x-ai/grok-imagine-image-2.0'], 'Gemini · OpenAI 2.6 · Grok 2.0, no blank group first');
        assert.equal(r.options.length, 6, 'the hidden <select> holds the 6 models only: ' + r.options);
        console.log('PASS: Case Card Studio model rail — no blank pill, GPT Image 2.6 Flare / Sunburst, Grok Imagine 2.0');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
