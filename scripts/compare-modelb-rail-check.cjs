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
        console.log('PASS: Model B rail — Qwen/DeepSeek/Grok logos, Grok offered + kept, retired ids migrate, Grok opt-in elsewhere');
    } finally { await browser.close(); }
})();
