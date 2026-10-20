// V102.328: Drug Codex · 🤖 AI Auto-Draft panel, lean A (owner's mockup pick). The REAL admin.html in Chromium (network stubbed):
// ONE line  name · [logo Model ⌄] · ✨ Generate — the chip is the form header's twin (same #dca-ai-model-val, same pick handler) and opens
// the vendor-first rail; a pick updates both chips and closes the rail; the old 17-chip rail is hidden; the hint has no Clear.
// Also: the stray closing div after the sort row is gone (list + bar live in #dca-view-published, the form inside .modal-content),
// and in picking mode the row checkbox no longer sits on "＋ ATC".
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => document.getElementById('dca-ai-model-toggle') && typeof dcaAutoDraftToggle === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });   // the guide popup would take the clicks

        // structure (static DOM, before any script moves things)
        const dom = await page.evaluate(() => ({
            listInPublished: !!document.querySelector('#dca-view-published #dca-list'),
            barInPublished: !!document.querySelector('#dca-view-published #dca-batch-bar'),
            formInCard: !!document.querySelector('#drugCodexAdminModal .modal-content #dca-view-form'),
            draftsInCard: !!document.querySelector('#drugCodexAdminModal .modal-content #dca-view-drafts'),
        }));
        assert.deepEqual(dom, { listInPublished: true, barInPublished: true, formInCard: true, draftsInCard: true }, 'the views nest as written');

        await page.evaluate(() => {
            const empty = Object.fromEntries(DCA_FIELD_KEYS.map(k => [k, '']));
            dcaState.codex = [0, 1, 2].map(i => Object.assign({}, empty, { _id: 'd' + i, genericName: 'DRUG ' + i, brandNames: [] })); dcaState.drafts = [];
            const m = document.getElementById('drugCodexAdminModal');
            m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            dcaSwitchView('published'); dcaRenderPublishedList(); dcaAutoDraftToggle();
        });

        // one line: name · chip · Generate; old rail hidden; short title; no Clear in the hint
        const line = await page.evaluate(() => {
            const cy = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
            return [cy(document.getElementById('dca-ai-name')), cy(document.getElementById('dca-ai-model-toggle')), cy(document.getElementById('dca-ai-go-btn'))];
        });
        assert.ok(Math.max(...line) - Math.min(...line) <= 4, 'name · chip · Generate on one line: ' + line);
        assert.equal(await page.$eval('#dca-ai-chip-rail', e => getComputedStyle(e).display), 'none', 'the 17-chip rail is hidden');
        assert.equal(await page.$eval('.dca-ai-input-row-title', e => e.textContent.trim()), '🤖 AI Auto-Draft');
        assert.match(await page.$eval('#dca-ai-go-btn', e => e.textContent), /✨ Generate/);
        const hint = await page.$eval('#dca-batch-hint', e => e.textContent);
        assert.match(hint, /All incomplete \(3\)/); assert.ok(!/Clear/.test(hint), 'no Clear in the hint: ' + hint);
        const name0 = await page.$eval('#dca-ai-model-toggle .dca-ai-model-name', e => e.textContent);
        assert.equal(name0, await page.$eval('#dt-model-name', e => e.textContent), 'same model as the form header');
        for (const k of ['title', 'data-th-title', 'data-kr-title']) assert.ok(await page.$eval('#dca-ai-model-toggle', (e, k) => e.getAttribute(k), k), 'chip ' + k);

        // the chip opens the vendor-first rail; a pick updates both chips + the value and closes it
        assert.equal(await page.locator('#dca-ai-models').isVisible(), false, 'rail folded by default');
        await page.click('#dca-ai-model-toggle');
        assert.equal(await page.locator('#dca-ai-models').isVisible(), true);
        assert.equal(await page.$eval('#dca-ai-model-toggle', e => e.getAttribute('aria-expanded')), 'true');
        assert.ok(await page.locator('#dca-ai-models .audit-provider').count() > 3, 'vendor logo tabs');
        await page.click('#dca-ai-models .audit-provider[data-provider="Claude"]');
        await page.click('#dca-ai-models .text-ai-chips > button[data-value="claude-haiku-4-5"]');
        assert.equal(await page.inputValue('#dca-ai-model-val'), 'claude-haiku-4-5');
        assert.equal(await page.$eval('#dca-ai-model-toggle .dca-ai-model-name', e => e.textContent), 'Haiku 4.5');
        assert.equal(await page.$eval('#dt-model-name', e => e.textContent), 'Haiku 4.5', 'the form header follows');
        assert.equal(await page.locator('#dca-ai-models').isVisible(), false, 'a pick closes the rail');
        await page.click('#dca-ai-model-toggle');
        assert.equal(await page.$eval('#dca-ai-models .audit-provider[aria-pressed=true]', e => e.dataset.provider), 'Claude', 'reopens on the picked vendor');
        await page.click('#dca-ai-model-toggle');

        // picking mode: the checkbox sits left of the row content, not on "＋ ATC"
        const ov = await page.evaluate(() => {
            const p = document.querySelector('#dca-list .dca-pick').getBoundingClientRect(), a = document.querySelector('#dca-list .dca-add').getBoundingClientRect();
            return p.right <= a.left;
        });
        assert.ok(ov, 'checkbox left of ＋ ATC');

        // a form view hides the list (it used to stay under the form)
        await page.evaluate(() => dcaEdit('d0'));
        assert.equal(await page.locator('#dca-list').isVisible(), false, 'list hidden in the form');
        assert.equal(await page.locator('#dca-view-form').isVisible(), true);
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('drug-autodraft-chip-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
