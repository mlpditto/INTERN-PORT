// V102.325: 🌐 Translate Missing — Thai quiz titles showed blank. lang-toggle.js wraps Thai runs in .lang-th (hidden while the
// admin page is in EN), and #backfill-list was not shielded. The REAL admin.html + REAL lang-toggle.js in Chromium (network stubbed).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<div id="backfill-list" class="lang-no-toggle"/.test(html), '#backfill-list is shielded from lang-toggle.js');
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
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.qtAdminBackfillRenderList === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
            const m = document.getElementById('backfillSelectModal');
            m.style.setProperty('display', 'block', 'important');
            window._qtBackfillSelected = new Set();
            window._qtBackfillCandidates = [
                { id: 'q1', title: 'วิตามินบี 1-6-12 กับระบบประสาท', questions: [{}, {}] },
                { id: 'q2', title: 'Lenacapavir ความหวังใหม่ในการกำจัด HIV', questions: [{}] },
                { id: 'q3', title: 'AGEs', questions: [{}] },
            ];
            window.qtAdminBackfillRenderList();
        });
        // give the lang-toggle MutationObserver a chance to (not) wrap the new rows
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => ({
            en: !document.body.classList.contains('lang-th-on'),
            titles: [...document.querySelectorAll('#backfill-list label > span[style*="flex:1"]')].map(s => s.innerText.trim()),
            wrapped: document.querySelectorAll('#backfill-list .lang-th').length,
        }));
        assert.ok(r.en, 'the page is in EN mode (the mode that hid Thai)');
        assert.equal(r.wrapped, 0, 'no Thai run inside the list is wrapped in .lang-th');
        assert.deepEqual(r.titles.slice().sort(), ['AGEs', 'Lenacapavir ความหวังใหม่ในการกำจัด HIV', 'วิตามินบี 1-6-12 กับระบบประสาท'].sort(), 'every title shows in full: ' + JSON.stringify(r.titles));
        assert.deepEqual(errs, [], 'no page errors');
        console.log('backfill-list-thai-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
