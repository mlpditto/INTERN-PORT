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
        assert.match(await card.locator('label:has(.gm-formula)').textContent(), /Brief\s+Context \+ Goal \+ Source \+ Expectations/);   // V102.316: Vision → Brief (+ Intent chips)
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
        assert.equal(await bar.locator('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] button').count(), 9, 'engine chips kept (+ Clip 9:16 from V102.291, + 4 OpenRouter clip engines V102.306, + Seedream 5 · Sunburst V102.315)');
        assert.equal(await bar.locator('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] button .gm-ghost').count(), 9, 'V102.306: ghost price · time on every engine chip');
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
        assert.equal(await page.locator('#design-engine').inputValue(), 'as/gemini-nano-banana-2.1');
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
        // V102.364: desktop — the bar is ONE line in clip mode (Plan beside the engine rail), even at 1000 px where the rail scrolls sideways
        for (const w of [1300, 1000]) {
            await page.setViewportSize({ width: w, height: 900 });
            await page.evaluate(() => {
                const c = document.querySelector('#hub-view-design > div');
                let el = c; while (el && el !== document.body) { if (el !== c) el.style.display = 'block'; el.style.visibility = 'visible'; el = el.parentElement; }
                c.style.cssText += ';position:fixed;inset:8px;z-index:2147483647;background:#fff;overflow:auto;padding:16px;';
                selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="or/google/veo-3.1-lite"]'));
                document.querySelectorAll('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] .alabasta-genmage-quick-chip').forEach(c => { c.hidden = !window.GLC_ENGINES[c.dataset.value]; }); glcSyncMode();
            });
            await page.waitForTimeout(200);
            const d = await page.evaluate(() => {
                const b = document.querySelector('#hub-view-design .gm-bar'), r = b.getBoundingClientRect();
                const tops = [...b.children].filter(e => getComputedStyle(e).display !== 'none').map(e => { const q = e.getBoundingClientRect(); return Math.round(q.top + q.height / 2 - r.top); });   // vertical centres (icons are shorter than chips)
                const btn = document.getElementById('btn-generate-design');
                return { h: Math.round(r.height), spread: Math.max(...tops) - Math.min(...tops), btn: btn.textContent.trim(), title: btn.title, inside: Math.round(btn.getBoundingClientRect().right) <= Math.round(r.right), wrap: getComputedStyle(b).flexWrap };
            });
            assert.ok(d.h <= 66 && d.spread <= 12 && d.inside && d.wrap === 'nowrap', 'one line at ' + w + ' px: ' + JSON.stringify(d));
            assert.ok(/^Plan 10 episodes$/.test(d.btn) && /^Free · text only/.test(d.title), 'the free tier sits in the tooltip, not on the button: ' + d.btn + ' / ' + d.title);
        }
        // V102.294: phone width — the bar wraps instead of overflowing; Create is a full-width line inside the viewport
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => {
            const c = document.querySelector('#hub-view-design > div');
            let el = c; while (el && el !== document.body) { if (el !== c) el.style.display = 'block'; el.style.visibility = 'visible'; el = el.parentElement; }
            c.style.cssText += ';position:fixed;inset:8px;z-index:2147483647;background:#fff;overflow:auto;padding:16px;';
        });
        await page.waitForTimeout(300);
        const ph = await page.evaluate(() => {
            const b = document.querySelector('#hub-view-design .gm-bar'), r = b.getBoundingClientRect();
            const btn = document.getElementById('btn-generate-design').getBoundingClientRect();
            const chip = document.querySelector('#hub-view-design .gm-bar .text-ai-chips > button:not([hidden])').getBoundingClientRect();
            return { right: Math.round(r.right), scrollW: b.scrollWidth, clientW: b.clientWidth, btnRight: Math.round(btn.right), btnW: Math.round(btn.width), chipVisible: chip.width > 0 && chip.right <= 390, sep: getComputedStyle(document.querySelector('#hub-view-design .gm-sep')).display };
        });
        assert.ok(ph.right <= 390 && ph.scrollW <= ph.clientW, 'bar inside the phone viewport: ' + JSON.stringify(ph));
        assert.ok(ph.btnRight <= 390 && ph.btnW >= 300, 'Create on its own full line, inside the viewport: ' + JSON.stringify(ph));
        assert.ok(ph.chipVisible, 'chips still shown');
        assert.equal(ph.sep, 'none', 'divider hidden on a phone');
        assert.deepEqual(errs, []);
        console.log('genmage-composer-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
