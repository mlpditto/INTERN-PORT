// V102.488 Phase 2: price on the image-model chips (Case Card rail + Quiz cover rail), one table in image-model-prices.js.
// Chip = model name · faint price, one line; a model with no known price shows nothing.
// The Case Card rail is vendor-first: vendor logos, then only that vendor's models.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const pub = f => path.join('public', f);
const admin = fs.readFileSync(pub('admin.html'), 'utf8');
const cover = fs.readFileSync(pub('quiz-cover.js'), 'utf8');

// real markup + real chip rules from admin.html
const railStart = admin.indexOf('<div class="alabasta-genmage-quick-rail" id="alabasta-case-card-quick-rail"');
assert(railStart > 0, 'Case Card rail not found');
const railHtml = admin.slice(railStart, admin.indexOf('</div>', railStart) + 6);
const cssStart = admin.indexOf('.alabasta-genmage-quick-rail {'), cssEnd = admin.indexOf('.alabasta-genmage-quick-chip[data-value^="or/"]:hover');
assert(cssStart > 0 && cssEnd > cssStart, 'chip css not found');
const chipCss = admin.slice(cssStart, admin.indexOf('}', cssEnd) + 1);

// the new files are wired in admin.html, before quiz-cover.js
assert(admin.includes('href="image-model-prices.css?v='), 'css linked');
assert(admin.indexOf('src="image-model-prices.js') > 0 && admin.indexOf('src="image-model-prices.js') < admin.indexOf('src="quiz-cover.js'), 'prices script loads before quiz-cover.js');
assert(cover.includes('window.imagePriceHtml ? window.imagePriceHtml(model.id)'), 'cover chips ask the table');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1100, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 700 } });
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            await page.route('https://qa.test/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body>' + railHtml }));
            await page.goto('https://qa.test/');
            await page.addStyleTag({ path: pub('text-ai-chips.css') });
            await page.addStyleTag({ path: pub('audit-toolbar.css') });
            await page.addStyleTag({ content: chipCss });
            const heights = async () => page.locator('#alabasta-case-card-quick-rail button[data-value]:not([hidden])').evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
            const before = await heights();
            await page.addStyleTag({ path: pub('image-model-prices.css') });
            await page.addScriptTag({ path: pub('image-model-prices.js') });
            await page.evaluate(() => window.paintImageChips());
            await page.evaluate(() => window.paintImageChips());   // idempotent
            const rail = page.locator('#alabasta-case-card-quick-rail');
            const shown = async () => rail.locator('button[data-value]').evaluateAll(bs => bs.filter(b => b.offsetParent !== null).map(b => b.dataset.value));
            const price = async id => rail.locator(`button[data-value="${id}"] .gm-price`).evaluateAll(es => es.map(e => e.textContent));

            // vendor-first: one icon per vendor, opens on the picked model's vendor
            assert.equal(await rail.locator('.gm-vendors').count(), 1, 'one vendor bar');
            assert.deepEqual(await rail.locator('.gm-vendor').evaluateAll(bs => bs.map(b => b.dataset.vendor)), ['gemini', 'openai', 'grok']);
            assert.equal(await rail.locator('.gm-vendor[aria-pressed="true"]').getAttribute('data-vendor'), 'gemini');
            assert.deepEqual(await shown(), ['as/gemini-nano-banana-2.1', 'as/gemini-3.1-flash-lite-image', 'as/gemini-3-pro-image'], 'Gemini models only');
            assert.equal(await rail.locator('button[data-value]').count(), 6, 'all six chips stay in the DOM');
            assert.equal(await rail.locator('button[data-value] .text-ai-logo').count(), 0, 'no per-chip logo (the vendor icon carries it)');
            await rail.locator('.gm-vendor[data-vendor="openai"]').click();
            assert.deepEqual(await shown(), ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'], 'OpenAI models only');
            assert.equal((await page.locator('#alabasta-case-card-quick-rail button.active').getAttribute('data-value')), 'as/gemini-nano-banana-2.1', 'browsing a vendor does not change the model');
            await rail.locator('.gm-vendor[data-vendor="grok"]').click();
            assert.deepEqual(await shown(), ['or/x-ai/grok-imagine-image-quality']);
            // the page code moves `.active` (syncAlabastaCaseCardQuickRail): the vendor follows the picked model
            await page.evaluate(() => document.querySelectorAll('#alabasta-case-card-quick-rail button[data-value]').forEach(c => c.classList.toggle('active', c.dataset.value === 'gpt-image-2.5-sunburst')));
            await page.waitForFunction(() => document.querySelector('.gm-vendor[aria-pressed="true"]').dataset.vendor === 'openai');
            assert.deepEqual(await shown(), ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']);

            // prices: from the table; unknown = nothing; idempotent; tooltip says "estimate"
            assert.deepEqual(await price('as/gemini-nano-banana-2.1'), ['$0.03']);
            assert.deepEqual(await price('as/gemini-3-pro-image'), ['≈$0.13']);
            assert.deepEqual(await price('gpt-image-2.5-sunburst'), ['≈$0.04–0.08']);
            for (const id of ['gpt-image-2.5-flare', 'or/x-ai/grok-imagine-image-quality']) {
                assert.deepEqual(await price(id), [], id + ': unknown price shows nothing');
                assert(!(await rail.locator(`button[data-value="${id}"]`).getAttribute('title')).includes('ต่อรูป'), id + ' tooltip names no price');
            }
            assert(/ประมาณ/.test(await rail.locator('button[data-value="as/gemini-3.1-flash-lite-image"]').getAttribute('title')), 'estimate says so in the tooltip');
            // one line, same height as before
            const after = await heights();
            assert(after.every(h => h <= before[0] + 2), 'chips keep their height @' + width + ' ' + JSON.stringify([before, after]));
            assert.deepEqual(errors, [], 'no page errors');
            await page.close();
        }
        console.log('image-model-prices-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
