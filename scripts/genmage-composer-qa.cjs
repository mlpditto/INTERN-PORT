// V102.292: Design hub composer — "🪄 Vision" + ghost formula (no Master Formula pill), ONE toolbar under the textarea:
// ✒ enhancer model as a provider-first rail (built by gmInitEnhancerRail, not the registry's full-catalogue rail) ·
// engine quick switch · ✨ Create. The REAL admin.html in Chromium (network stubbed).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('Master Formula:') && !html.includes('Step 1 enhancer model'), 'pill + old rail gone');
assert.ok(html.includes('id="gm-enhancer-rail"') && html.includes('class="gm-formula"'), 'composer rail host + ghost formula');
assert.ok(!html.includes('</i> Create Masterpiece\';'), 'the run-restore text follows the short label');
const registry = fs.readFileSync('public/ai-model-ui.js', 'utf8');
assert.ok(!registry.includes('ai-model-design-enhancer'), 'ai-model-ui.js no longer upgrades the enhancer input');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        const open = async () => {
            await page.goto('file:///' + PUB + '/admin.html');
            await page.waitForFunction(() => document.readyState === 'complete' && document.querySelector('#gm-enhancer-rail .text-ai-chips'), null, { timeout: 30000 });
            await page.waitForTimeout(300);
        };
        await open();
        const card = page.locator('#hub-view-design > div').first();
        // header: short title + ghost formula, no pill
        assert.match(await card.locator('label').first().textContent(), /Vision\s+Context \+ Goal \+ Source \+ Expectations/);
        assert.ok(await card.locator('.gm-formula').evaluate(e => /สูตร/.test(e.title) && /프롬프트/.test(e.title)), 'formula tooltip TH · KO');
        assert.equal(await card.locator('text=MASTER FORMULA').count(), 0);
        // one toolbar: ✒ rail · sep · engine chips · Create; nothing from the registry
        assert.equal(await page.locator('[data-model-input="ai-model-design-enhancer"]').count(), 0, 'no auto-upgraded rail');
        const bar = card.locator('.gm-bar');
        assert.equal(await bar.count(), 1);
        assert.equal(await bar.locator('#gm-enhancer-rail #ai-model-design-enhancer').count(), 1, 'hidden input lives in the rail');
        assert.equal(await page.locator('#ai-model-design-enhancer').inputValue(), 'gpt-6-luna', 'default = what the registry used to pick');
        const ids = await page.evaluate(() => TEXT_AI_MODELS.map(m => m.id));
        const providers = await page.evaluate(() => [...new Set(TEXT_AI_MODELS.map(m => m.label.split(' ')[0]))]);
        assert.equal(await bar.locator('.audit-provider').count(), providers.length, 'one tab per provider');
        assert.deepEqual(await bar.locator('.text-ai-chips > button').evaluateAll(bs => bs.map(b => b.dataset.value)), ids, 'whole catalogue behind the tabs');
        const shown = await bar.locator('.text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.filter(b => getComputedStyle(b).display !== 'none').map(b => b.getAttribute('aria-label')));
        assert.ok(shown.length > 0 && shown.length < ids.length && shown.every(l => l.startsWith('GPT ')), "only the default's provider is shown: " + shown.join(','));
        assert.equal(await bar.locator('.text-ai-chips > button.active').getAttribute('data-value'), 'gpt-6-luna');
        assert.equal(await bar.locator('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] button').count(), 3, 'engine chips kept (+ Clip 9:16 from V102.291)');
        assert.equal(await bar.locator('#design-engine').count(), 1);
        const create = bar.locator('#btn-generate-design');
        assert.match((await create.textContent()).trim(), /^Create$/);
        assert.equal(await create.getAttribute('aria-label'), 'Create Masterpiece');
        assert.ok(await create.evaluate(e => /สร้างภาพ/.test(e.title) && /이미지/.test(e.title)), 'Create tooltip EN · TH · KO');
        assert.equal(await create.evaluate(e => e.getAttribute('onclick')), 'generateAIDesign()');
        // the bar is one line at 1040px (card width in the hub)
        const rows = await bar.evaluate(e => new Set([...e.children].map(c => Math.round(c.getBoundingClientRect().top))).size);
        assert.equal(rows, 1, 'toolbar on one line');
        // pick: Claude tab → Claude chips; Opus → input + pref key; getter follows; engine untouched
        await bar.locator('.audit-provider[data-provider="Claude"]').evaluate(b => b.click());
        assert.ok((await bar.locator('.text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')))).every(l => /^Claude /.test(l)));
        await bar.locator('.text-ai-chips > button[data-value="claude-opus-5-5"]').evaluate(b => b.click());
        assert.equal(await page.locator('#ai-model-design-enhancer').inputValue(), 'claude-opus-5-5');
        assert.equal(await page.evaluate(() => getAIDesignEnhancerModel()), 'claude-opus-5-5');
        assert.equal(await page.evaluate(() => localStorage.getItem('ai_default_design_enhancer_model')), 'claude-opus-5-5', 'same pref key as before');
        assert.equal(await bar.locator('.text-ai-chips > button[aria-pressed="true"]').count(), 1);
        assert.equal(await page.locator('#design-engine').inputValue(), 'as/gemini-3.1-flash-image');
        // engine switch still works in the new bar
        await bar.locator('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] button[data-value="or/openai/gpt-5.4-image-2"]').evaluate(b => b.click());
        assert.equal(await page.locator('#design-engine').inputValue(), 'or/openai/gpt-5.4-image-2');
        // reload: pick restored, tab follows; a retired id saved by an older version is normalised
        await open();
        assert.equal(await page.locator('#ai-model-design-enhancer').inputValue(), 'claude-opus-5-5', 'restored');
        assert.equal(await bar.locator('.audit-provider[aria-pressed="true"]').getAttribute('data-provider'), 'Claude');
        await page.evaluate(() => localStorage.setItem('ai_default_design_enhancer_model', 'gpt-5.6-sol'));
        await open();
        assert.equal(await page.locator('#ai-model-design-enhancer').inputValue(), 'gpt-6-sol', 'retired id normalised');
        await page.evaluate(() => localStorage.setItem('ai_default_design_enhancer_model', 'no-such-model'));
        await open();
        assert.equal(await page.locator('#ai-model-design-enhancer').inputValue(), 'gpt-6-luna', 'unknown id → default');
        assert.deepEqual(errs, []);
        console.log('genmage-composer-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
