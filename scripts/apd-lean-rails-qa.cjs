// V102.288: admin 📎 Documents sheet — review models A / B are two provider-first rails (logo tabs + that provider's
// models, the Expand quiz pattern) built on first open, not two full catalogue rails from ai-model-ui.js.
// The REAL admin.html in Chromium (network stubbed), the REAL providerModelRailHtml / browseAuditProvider / apdReviewModels.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('<span>Review model A</span>') && !html.includes('id="apd-model-a" value="gpt-6-luna">'), 'the static hidden inputs are gone');
assert.ok(html.includes('id="apd-ab"') && html.includes('class="apd-foot">🔒 Admins only'), 'rows box + lean footer');
const registry = fs.readFileSync('public/ai-model-ui.js', 'utf8');
assert.ok(!/'apd-model-a'/.test(registry) && !/'apd-model-b'/.test(registry), 'ai-model-ui.js no longer auto-upgrades the sheet inputs');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 640, height: 1000 } });
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
            await page.waitForFunction(() => document.readyState === 'complete' && typeof window.providerModelRailHtml === 'function' && typeof openApplicantDocs === 'function', null, { timeout: 30000 });
            await page.waitForTimeout(500);
            await page.evaluate(() => openApplicantDocs('PRE1'));
        };
        await open();
        // the registry built nothing for the sheet; the sheet built two rows
        assert.equal(await page.locator('[data-model-input="apd-model-a"], [data-model-input="apd-model-b"]').count(), 0, 'no auto-upgraded rails');
        assert.equal(await page.locator('#apd-ab .apd-ab-row').count(), 2, 'two rows');
        assert.deepEqual(await page.$$eval('#apd-ab .apd-ab-lbl', es => es.map(e => e.textContent)), ['A', 'B']);
        assert.ok(await page.$eval('#apd-ab .apd-ab-lbl', e => /โมเดลตรวจ/.test(e.title) && /검토/.test(e.title)), 'label tooltip EN · TH · KO');
        // V102.297: + Grok (the OpenRouter trial model) — one more tab, its chips behind it
        const grok = await page.evaluate(() => TEXT_AI_TRIAL_MODELS.filter(m => /grok/i.test(m.id)).map(m => m.id));
        assert.ok(grok.length >= 1, 'a Grok trial model exists');
        const ids = await page.evaluate(g => [...TEXT_AI_MODELS.map(m => m.id), ...g], grok);
        const providers = await page.evaluate(() => [...new Set([...TEXT_AI_MODELS, ...TEXT_AI_TRIAL_MODELS.filter(m => /grok/i.test(m.id))].map(m => m.label.split(' ')[0]))]);
        assert.ok(providers.includes('Grok'), 'Grok tab');
        for (const [row, id, def] of [[0, 'apd-model-a', 'gpt-6-luna'], [1, 'apd-model-b', 'claude-haiku-5-5']]) {
            const r = page.locator('#apd-ab .apd-ab-row').nth(row);
            assert.equal(await r.locator(`#${id}`).count(), 1, id + ' hidden input lives in its row');
            assert.equal(await page.locator('#' + id).inputValue(), def, id + ' default');
            assert.equal(await r.locator('.audit-provider').count(), providers.length, id + ' one tab per provider');
            assert.deepEqual(await r.locator('.text-ai-chips > button').evaluateAll(bs => bs.map(b => b.dataset.value)), ids, id + ' whole catalogue behind the tabs');
            const prov = await page.evaluate(d => TEXT_AI_MODELS.find(m => m.id === d).label.split(' ')[0], def);
            assert.equal(await r.locator(`.audit-provider[aria-pressed="true"]`).getAttribute('data-provider'), prov, id + ' tab of the default');
            const shown = await r.locator('.text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')));
            assert.ok(shown.length > 0 && shown.length < ids.length && shown.every(l => l.startsWith(prov + ' ')), id + " only that provider's chips are shown: " + shown.join(','));
            assert.equal(await r.locator('.text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.filter(b => getComputedStyle(b).display !== 'none').length), shown.length, id + ' hidden chips really hidden');
            assert.equal(await r.locator('.text-ai-chips > button.active').getAttribute('data-value'), def, id + ' default chip active');
        }
        // review runs both models, de-duplicated
        assert.deepEqual(await page.evaluate(() => apdReviewModels()), ['gpt-6-luna', 'claude-haiku-5-5']);
        // row A: switch to the Claude tab → Claude chips; pick Opus → input + localStorage, B untouched
        const A = page.locator('#apd-ab .apd-ab-row').nth(0);
        await A.locator('.audit-provider[data-provider="Claude"]').evaluate(b => b.click());
        assert.ok((await A.locator('.text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')))).every(l => /^Claude /.test(l)), 'Claude tab shows Claude chips');
        await A.locator('.text-ai-chips > button[data-value="claude-opus-5-5"]').evaluate(b => b.click());
        assert.equal(await page.locator('#apd-model-a').inputValue(), 'claude-opus-5-5');
        assert.equal(await A.locator('.text-ai-chips > button[aria-pressed="true"]').count(), 1);
        assert.equal(await page.evaluate(() => localStorage.getItem('ai_text_apd-model-a')), 'claude-opus-5-5', 'pick persisted under the registry key');
        assert.equal(await page.locator('#apd-model-b').inputValue(), 'claude-haiku-5-5', 'B untouched');
        assert.deepEqual(await page.evaluate(() => apdReviewModels()), ['claude-opus-5-5', 'claude-haiku-5-5']);
        // same model on both sides → one review, not two
        const B = page.locator('#apd-ab .apd-ab-row').nth(1);
        await B.locator('.text-ai-chips > button[data-value="claude-opus-5-5"]').evaluate(b => b.click());
        assert.deepEqual(await page.evaluate(() => apdReviewModels()), ['claude-opus-5-5']);
        // Grok: tab → its chip, pick → input + review list keep the trial id (not normalised to the default), logo inverted on the light tab
        await A.locator('.audit-provider[data-provider="Grok"]').evaluate(b => b.click());
        const grokShown = await A.locator('.text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.map(b => b.dataset.value));
        assert.deepEqual(grokShown, grok, 'Grok tab shows the Grok chip(s)');
        await A.locator('.text-ai-chips > button[data-value="' + grok[0] + '"]').evaluate(b => b.click());
        assert.equal(await page.locator('#apd-model-a').inputValue(), grok[0]);
        assert.deepEqual(await page.evaluate(() => apdReviewModels()), [grok[0], 'claude-opus-5-5'], 'review runs Grok, not the normalised default');
        assert.equal(await A.locator('.audit-provider[data-provider="Grok"] .text-ai-logo').evaluate(e => getComputedStyle(e).filter), 'invert(1)', 'white Grok mark inverted on the light tab');
        await open();
        assert.equal(await page.locator('#apd-model-a').inputValue(), grok[0], 'a saved Grok pick survives reload');
        assert.equal(await page.locator('#apd-ab .apd-ab-row').nth(0).locator('.audit-provider[aria-pressed="true"]').getAttribute('data-provider'), 'Grok');
        await A.locator('.audit-provider[data-provider="Claude"]').evaluate(b => b.click());
        await A.locator('.text-ai-chips > button[data-value="claude-opus-5-5"]').evaluate(b => b.click());
        // reopen the page: saved picks (incl. one from before this version, same key) restored, tab follows the pick
        const gem = ids.find(i => /gemini/.test(i));
        await page.evaluate(g => { localStorage.setItem('ai_text_apd-model-b', g); }, gem);
        await open();
        assert.equal(await page.locator('#apd-model-a').inputValue(), 'claude-opus-5-5', 'A restored');
        assert.equal(await page.locator('#apd-ab .apd-ab-row').nth(0).locator('.audit-provider[aria-pressed="true"]').getAttribute('data-provider'), 'Claude');
        const bVal = await page.locator('#apd-model-b').inputValue();
        assert.equal(bVal, gem, 'B restored from a pick saved by the old rail');
        // opening twice does not rebuild (the admin's unsaved tab stays)
        await page.evaluate(() => openApplicantDocs('PRE1'));
        assert.equal(await page.locator('#apd-ab .apd-ab-row').count(), 2);
        // the sheet is short: both rows fit in one 420px-wide sheet without scrolling past the footer
        const h = await page.$eval('#applicantDocsModal .modal-content', e => e.scrollHeight);
        assert.ok(h < 520, 'sheet height ' + h);
        assert.deepEqual(errs, []);
        console.log('apd-lean-rails-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
