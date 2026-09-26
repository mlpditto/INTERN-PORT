// V102.11: Quality Improvement Comparison → Model B rail: every chip carries its owner logo
// (Qwen / DeepSeek too) and the Grok trial chip is offered and kept once picked.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const cut = (start, end) => {
    const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('slice not found: ' + start);
    return html.slice(a, b);
};
const modelB = cut('        window._compareModelB = function', '        window.generateAiProposalB =');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://cmp.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
        await page.route('https://cmp.test/assets/**', r => r.fulfill({ path: 'public' + new URL(r.request().url()).pathname, contentType: 'image/svg+xml' }));
        await page.goto('https://cmp.test/');
        for (const css of ['public/text-ai-chips.css', 'public/audit-toolbar.css']) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addScriptTag({ content: modelB });
        await page.evaluate(() => { localStorage.clear(); document.body.innerHTML = '<div id="b" style="background:#fff;padding:12px">' + window._compareModelBPickerHtml() + '</div>'; });

        const chips = await page.locator('#b .text-ai-chips > button').evaluateAll(bs => bs.map(b => ({ label: b.getAttribute('aria-label'), owner: b.querySelector('.text-ai-logo')?.dataset.owner || '', bg: b.querySelector('.text-ai-logo') ? getComputedStyle(b.querySelector('.text-ai-logo')).backgroundImage : '' })));
        const byLabel = Object.fromEntries(chips.map(c => [c.label, c]));
        for (const [label, owner] of [['Qwen 3.8 Flash', 'qwen'], ['Qwen 3.8 Max', 'qwen'], ['DeepSeek V4.1 Flash', 'deepseek'], ['DeepSeek V4 Pro', 'deepseek'], ['Grok 4.7', 'grok']]) {
            assert.ok(byLabel[label], label + ' chip is offered');
            assert.equal(byLabel[label].owner, owner, label + ' carries its logo');
            assert.match(byLabel[label].bg, new RegExp(owner + '-'), label + ' logo file resolves');
        }
        assert.deepEqual(chips.filter(c => !c.owner).map(c => c.label), [], 'every chip has a logo');
        assert.equal(await page.locator('#b .text-ai-logo[data-owner="grok"]').evaluate(e => getComputedStyle(e).filter), 'invert(1)', 'white Grok mark is dark on the light rail');

        // V102.12: OpenRouter theme — grape tint + grape border + Grape→Volt bar + corner glyph.
        const orLook = sel => page.locator(sel).evaluate(b => { const s = getComputedStyle(b), a = getComputedStyle(b, '::after'), z = getComputedStyle(b, '::before'); return { bg: s.backgroundColor, img: s.backgroundImage, border: s.borderTopColor, bar: a.backgroundImage, glyph: z.backgroundImage }; });
        const qwen = await orLook('#b button[aria-label="Qwen 3.8 Flash"]');
        assert.match(qwen.img, /rgba\(118, 36, 244, 0\.1\)/, 'grape tint');
        assert.equal(qwen.border, 'rgb(118, 36, 244)', 'grape border');
        assert.match(qwen.bar, /rgb\(118, 36, 244\).*rgb\(200, 255, 0\)/, 'Grape→Volt bar');
        assert.match(qwen.glyph, /glyph-grape\.svg/, 'corner glyph');
        // V102.13: vendor themes — unpicked tint + border + bar in the vendor colour; picked = vendor colour solid, white name + logo.
        const look = sel => page.locator(sel).evaluate(b => { const s = getComputedStyle(b), a = getComputedStyle(b, '::after'), l = b.querySelector('.text-ai-logo'), ls = l && getComputedStyle(l); return { vendor: b.dataset.vendor, bg: s.backgroundColor, img: s.backgroundImage, border: s.borderTopColor, color: s.color, bar: a.backgroundColor + '|' + a.backgroundImage, logo: ls ? ls.backgroundImage.replace(/^.*\//, '') + '|' + ls.filter : '' }; });
        const pick = async label => { await page.locator(`#b button[aria-label="${label}"]`).click(); return look(`#b button[aria-label="${label}"]`); };
        await page.locator('#b button[aria-label="Claude Sonnet 5"]').click();
        const luna = await look('#b button[aria-label="GPT 6 Luna"]');
        assert.equal(luna.vendor, 'openai');
        assert.match(luna.img, /rgba\(13, 13, 13, 0\.05\)/, 'GPT ink tint');
        assert.deepEqual([luna.border, luna.bar.split('|')[0]], ['rgb(13, 13, 13)', 'rgb(13, 13, 13)'], 'GPT ink border + bar');
        const haiku = await look('#b button[aria-label="Claude Haiku 4.5"]');
        assert.deepEqual([haiku.vendor, haiku.border, haiku.bar.split('|')[0]], ['claude', 'rgb(227, 165, 140)', 'rgb(217, 119, 87)'], 'Claude clay border + bar');
        const flash = await look('#b button[aria-label="Gemini 3.8 Flash"]');
        assert.deepEqual([flash.vendor, flash.border], ['gemini', 'rgb(174, 203, 250)'], 'Gemini blue border');
        assert.match(flash.bar, /rgb\(66, 133, 244\)/, 'Gemini keeps the Google-bill rainbow bar');
        const sonnet = await look('#b button[aria-label="Claude Sonnet 5"]');
        assert.deepEqual([sonnet.bg, sonnet.img, sonnet.color], ['rgb(217, 119, 87)', 'none', 'rgb(255, 255, 255)'], 'picked Claude = clay solid, white name (no amber)');
        assert.match(sonnet.logo, /invert\(1\)/, 'white Claude mark');
        const lunaOn = await pick('GPT 6 Luna');
        assert.deepEqual([lunaOn.bg, lunaOn.color], ['rgb(13, 13, 13)', 'rgb(255, 255, 255)'], 'picked GPT = ink solid');
        assert.match(lunaOn.logo, /^openai-blossom-white\.svg/, 'white OpenAI blossom');
        const flashOn = await pick('Gemini 3.8 Flash');
        assert.match(flashOn.img, /rgb\(66, 133, 244\).*rgb\(155, 114, 203\)/, 'picked Gemini = blue→purple');
        const picked = await pick('Qwen 3.8 Max');
        assert.deepEqual([picked.bg, picked.color], ['rgb(118, 36, 244)', 'rgb(255, 255, 255)'], 'picked OpenRouter = grape solid');
        assert.match(picked.bar, /rgb\(200, 255, 0\)/, 'Volt bar on the grape pick');
        assert.match(await page.locator('#b button[aria-label="Qwen 3.8 Max"]').evaluate(b => getComputedStyle(b, '::before').backgroundImage), /glyph-grape\.svg/, 'picked chip keeps the glyph');
        // the audit toolbar and Curate paint their own amber pick — the vendor colour must still win there
        await page.evaluate(() => { const w = document.createElement('div'); w.className = 'audit-toolbar'; w.id = 'at'; w.innerHTML = textAIChipsHtml('', 'claude-opus-5-5', ''); document.body.append(w); });
        assert.deepEqual(await page.locator('#at button[aria-pressed="true"]').evaluate(b => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color]), ['rgb(217, 119, 87)', 'rgb(255, 255, 255)'], 'audit toolbar pick uses the vendor colour');
        await page.evaluate(() => document.getElementById('at').remove());

        // picking Grok is kept (trial ids used to normalise back to Luna)
        await page.locator('#b button[aria-label="Grok 4.7"]').click();
        assert.equal(await page.evaluate(() => window._compareModelB()), 'or/x-ai/grok-4.7');
        await page.evaluate(() => { document.getElementById('b').innerHTML = window._compareModelBPickerHtml(); });
        assert.equal(await page.locator('#b button[aria-pressed="true"]').getAttribute('aria-label'), 'Grok 4.7', 'reopened rail shows Grok picked');
        await page.evaluate(() => localStorage.setItem('ai_default_2model_b', 'gpt-5.6-sol'));
        assert.equal(await page.evaluate(() => window._compareModelB()), 'gpt-6-sol', 'retired ids still move to their successor');

        // Qwen / DeepSeek logos also show on other flat rails (settings etc.)
        assert.equal(await page.evaluate(() => (textAIChipsHtml('', 'gpt-6-luna', '').match(/data-owner="(qwen|deepseek)"/g) || []).length), 4);
        assert.equal(await page.evaluate(() => /grok/.test(textAIChipsHtml('', 'gpt-6-luna', ''))), false, 'Grok stays opt-in');
        assert.deepEqual(errors, []);
        console.log('PASS: Model B rail — Qwen/DeepSeek/Grok logos, Grok offered + kept, retired ids migrate, Grok opt-in elsewhere, OpenRouter tint/bar/glyph, vendor themes (tint/border/bar, solid pick) incl. audit toolbar');
    } finally { await browser.close(); }
})();
