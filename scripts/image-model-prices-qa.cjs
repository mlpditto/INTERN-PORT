// V102.488 Phase 2: price on the image-model chips (Case Card rail + Quiz cover rail), one table in image-model-prices.js.
// Chip = [vendor logo] model name · faint price, one line; a model with no known price shows nothing.
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
            const heights = async () => page.locator('#alabasta-case-card-quick-rail button').evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
            const before = await heights();
            await page.addStyleTag({ path: pub('image-model-prices.css') });
            await page.addScriptTag({ path: pub('image-model-prices.js') });
            await page.evaluate(() => window.paintImageChips());
            await page.evaluate(() => window.paintImageChips());   // idempotent
            const chips = await page.locator('#alabasta-case-card-quick-rail button').evaluateAll(bs => bs.map(b => ({
                id: b.dataset.value, price: (b.querySelector('.gm-price') || {}).textContent || '', prices: b.querySelectorAll('.gm-price').length,
                logo: (b.querySelector('.text-ai-logo') || {}).dataset ? b.querySelector('.text-ai-logo').dataset.owner : '', logos: b.querySelectorAll('.text-ai-logo').length, title: b.title
            })));
            const by = id => chips.find(c => c.id === id);
            assert.equal(by('as/gemini-nano-banana-2.1').price, '$0.03');
            assert.equal(by('as/gemini-nano-banana-2.1').logo, 'gemini');
            assert.equal(by('as/gemini-3-pro-image').price, '≈$0.13');
            assert.equal(by('gpt-image-2.5-sunburst').logo, 'openai');
            assert.equal(by('or/x-ai/grok-imagine-image-2.0').logo, 'grok');
            for (const id of ['gpt-image-2.5-flare', 'or/x-ai/grok-imagine-image-2.0']) { assert.equal(by(id).prices, 0, id + ': unknown price shows nothing'); assert(!/\?/.test(by(id).title.split('—').pop()), id + ' no ? in the tooltip'); }
            assert(chips.every(c => c.logos === 1 && c.prices <= 1), 'one logo, at most one price, even after painting twice');
            assert(/ประมาณ/.test(by('as/gemini-3.1-flash-lite-image').title), 'estimate says so in the tooltip');
            // same line, same height as before the price was added (the chip is one line)
            const after = await heights();
            assert.deepEqual(after.map(h => h <= before[0] + 2), after.map(() => true), 'chips keep their height @' + width + ' ' + JSON.stringify([before[0], after]));
            // the picked chip shows a white mark for the black OpenAI blossom
            await page.locator('#alabasta-case-card-quick-rail button[data-value="gpt-image-2.5-sunburst"]').evaluate(b => { document.querySelectorAll('#alabasta-case-card-quick-rail button').forEach(x => x.classList.remove('active')); b.classList.add('active'); });
            assert.match(await page.locator('#alabasta-case-card-quick-rail button.active .text-ai-logo').evaluate(e => getComputedStyle(e).filter), /brightness\(0\)|invert/, 'picked chip: OpenAI mark turns white');
            assert.deepEqual(errors, [], 'no page errors');
            await page.close();
        }
        console.log('image-model-prices-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
