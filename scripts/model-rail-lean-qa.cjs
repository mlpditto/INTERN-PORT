// V102.487 lean model rail: vendor icons first, only that vendor's models below; no chip borders; a violet / blue dot for the
// OpenRouter route / Google bill; a faint Thai-flag wash on chips that read Thai inside a picture.
const assert = require('assert');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BODY = '<div id="a"><input type="hidden" id="research-model-select" value="or/deepseek/deepseek-v4-pro-0813"><div id="ha"></div></div>' +
    '<div id="row" class="audit-model-row"><div class="audit-providers" id="own-tabs"></div><input type="hidden" id="lp-ai-model" value="gpt-6-luna"><div id="hb"></div></div>';

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1100, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 700 } });
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            await page.route('https://qa.test/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body>' + BODY }));
            await page.goto('https://qa.test/');
            await page.addStyleTag({ path: path.join('public', 'text-ai-chips.css') });
            await page.addScriptTag({ path: path.join('public', 'ai-model-ui.js') });
            await page.evaluate(() => { window.initRegistryModelSelectors(); });
            const a = page.locator('[data-model-input="research-model-select"]');
            const shown = async rail => rail.locator(':scope > button[data-value]').evaluateAll(bs => bs.filter(b => !b.hidden).map(b => b.dataset.value));

            // vendor-first: opens on the picked model's vendor, the other vendors stay in the DOM but hidden
            assert.deepEqual(await shown(a), ['or/deepseek/deepseek-v4.1-flash-1017', 'or/deepseek/deepseek-v4-pro-0813'], 'DeepSeek models only @' + width);
            assert.equal(await a.locator(':scope > button[data-value]').count(), 17, 'all 17 chips stay in the DOM');
            assert.equal(await a.locator('.mr-vendor[aria-pressed="true"]').getAttribute('data-provider'), 'DeepSeek');
            // V102.515 design B: the chips sit right after the pressed icon (flex order), show no vendor word and no logo; aria-label keeps the full name
            const seats = async () => a.evaluate(r => { const items = [...r.querySelectorAll('.mr-vendor, :scope > button[data-value]:not([hidden])')].sort((x, y) => Number(x.style.order || 0) - Number(y.style.order || 0)); return items.map(e => e.classList.contains('mr-vendor') ? '[' + e.dataset.provider + ']' : e.textContent.trim().replace(/\s+/g, ' ')); });
            assert.deepEqual(await seats(), ['[Gemini]', '[GPT]', '[Claude]', '[Qwen]', '[DeepSeek]', 'Flash V4.1', 'Pro V4', '[Muse]'], 'DeepSeek chips follow the DeepSeek icon, no vendor word');
            assert.equal(await a.locator('button[data-value="or/deepseek/deepseek-v4-pro-0813"]').getAttribute('aria-label'), 'DeepSeek V4 Pro', 'aria-label keeps the full name');
            assert.equal(await a.evaluate(r => getComputedStyle(r.querySelector('.mr-vendors')).display), 'contents', 'the icon bar is display:contents');
            assert.equal(await a.evaluate(r => getComputedStyle(r.querySelector('button[data-value="or/deepseek/deepseek-v4-pro-0813"] .text-ai-logo')).display), 'none', 'no logo inside the chip');
            await a.locator('.mr-vendor[data-provider="Gemini"]').click();
            assert.deepEqual(await seats(), ['[Gemini]', 'Lite 3.5', 'Flash 3.8', 'Argon 4', 'Gemma 4 26B', '[GPT]', '[Claude]', '[Qwen]', '[DeepSeek]', '[Muse]'], 'after tapping Gemini its chips follow the Gemini icon');
            assert.deepEqual(await shown(a), ['as/gemini-3.5-flash-lite', 'gemini-3.8-flash', 'as/gemini-4-argon', 'or/google/gemma-4-26b-a4b-it'], 'Gemini models only');
            // picking a chip keeps the registry behaviour (one pressed chip, value stored)
            await a.locator('button[data-value="gemini-3.8-flash"]').click();
            assert.equal(await page.locator('#research-model-select').inputValue(), 'gemini-3.8-flash');
            assert.equal(await a.locator('[data-value][aria-pressed="true"]').count(), 1);
            // an outside change of the value moves the vendor tab with it
            await page.evaluate(() => { const i = document.getElementById('research-model-select'); i.value = 'claude-opus-5-5'; i.dispatchEvent(new Event('change')); });
            assert.deepEqual((await shown(a)).sort(), ['claude-haiku-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1'].sort(), 'follows the value');

            // a rail whose row already has its own provider tabs keeps its layout (no second tab bar)
            assert.equal(await page.locator('[data-model-input="lp-ai-model"]').count(), 1, 'the tabbed row still gets its rail');
            assert.equal(await page.locator('[data-model-input="lp-ai-model"] .mr-vendors').count(), 0, 'rails with their own tabs are untouched');
            assert.equal(await page.locator('[data-model-input="lp-ai-model"] > button[hidden]').count(), 0, 'and keep every chip visible for their own tabs to filter');

            // no tray, no chip border, no bars
            const chrome = await page.evaluate(() => {
                const rail = document.querySelector('[data-model-input="research-model-select"]');
                const r = getComputedStyle(rail), chip = getComputedStyle(rail.querySelector('button[data-value="claude-haiku-5-5"]'));
                return { trayBorder: r.borderTopWidth, trayBg: r.backgroundColor, chipBorder: chip.borderTopWidth, chipBar: getComputedStyle(rail.querySelector('button[data-value="claude-haiku-5-5"]'), '::after').content };
            });
            assert.deepEqual(chrome, { trayBorder: '0px', trayBg: 'rgba(0, 0, 0, 0)', chipBorder: '0px', chipBar: 'none' }, 'no tray, no border, no bar @' + width);

            // signals: OpenRouter = violet dot, Google bill = blue dot, Thai = faint flag wash, picked chip = solid vendor colour
            await a.locator('.mr-vendor[data-provider="Gemini"]').click();
            const sig = await page.evaluate(() => {
                const q = v => document.querySelector('[data-model-input="research-model-select"] button[data-value="' + v + '"]');
                const dot = b => getComputedStyle(b, '::after').backgroundColor;
                return { gemma: dot(q('or/google/gemma-4-26b-a4b-it')), flash: dot(q('gemini-3.8-flash')), flashWash: getComputedStyle(q('gemini-3.8-flash')).backgroundImage, argonWash: getComputedStyle(q('as/gemini-4-argon')).backgroundImage };
            });
            assert.equal(sig.gemma, 'rgb(118, 36, 244)', 'OpenRouter dot');
            assert.equal(sig.flash, 'rgb(66, 133, 244)', 'Google-bill dot');
            assert.match(sig.flashWash, /rgba\(165, 25, 49/, 'Thai wash on Flash 3.8');
            assert.equal(sig.argonWash, 'none', 'no wash on a model that was not tested with Thai images');
            assert.deepEqual(errors, [], 'no page errors');
            await page.close();
        }
        console.log('model-rail-lean-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
