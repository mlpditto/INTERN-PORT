// V102.605 (owner pick B, icon only) — Articles editor: 📋 left of ✨ Draft copies title + blank line + body of the open language, as typed
// (unsaved edits too), turns green ✓ for 1.5 s, then 📋 again. The REAL admin.html, fake Firestore, clipboard recorded.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => {
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase });
            window.__clip = [];
            Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); } } });
        });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');
        await page.evaluate(() => {
            window.db = { collection: () => ({ get: async () => ({ docs: [] }), add: async () => ({ id: 'n1' }), doc: () => ({ update: async () => {}, delete: async () => {}, get: async () => ({ exists: false }) }) }) };
            db = window.db; const S = Articles._S; S.list = []; S.loaded = true; S.loading = false; Articles.open(); Articles.edit(null);
        });
        const set = (id, v) => page.evaluate(([i, x]) => { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('input')); }, [id, v]);
        await set('art-title', 'Once-Weekly Insulin'); await set('art-bodyta', 'Monday morning at the OPD pharmacy…\n\n**Insulin icodec**');

        // the button: icon only, right before ✨ Draft
        const look = await page.evaluate(() => { const ai = document.querySelector('#art-body .art-ai'), c = ai.querySelector('.cpy');
            return { text: c.textContent, next: c.nextElementSibling.className, label: c.getAttribute('aria-label') }; });
        assert.deepEqual(look, { text: '📋', next: 'go', label: 'Copy title and body' }, 'icon-only 📋 just left of ✨ Draft: ' + JSON.stringify(look));

        await page.click('#art-body .art-ai .cpy');
        await page.waitForTimeout(50);
        assert.deepEqual(await page.evaluate(() => window.__clip), ['Once-Weekly Insulin\n\nMonday morning at the OPD pharmacy…\n\n**Insulin icodec**'], 'title + blank line + body, unsaved');
        assert.deepEqual(await page.evaluate(() => { const c = document.querySelector('#art-body .art-ai .cpy'); return [c.textContent, c.classList.contains('ok'), getComputedStyle(c).backgroundColor]; }), ['✓', true, 'rgb(220, 252, 231)'], 'green ✓ after the tap');
        await page.waitForTimeout(1600);
        assert.equal(await page.evaluate(() => document.querySelector('#art-body .art-ai .cpy').textContent), '📋', 'back to 📋');

        // empty article → nothing copied
        await set('art-title', ''); await set('art-bodyta', '');
        await page.click('#art-body .art-ai .cpy');
        assert.equal(await page.evaluate(() => window.__clip.length), 1, 'an empty article copies nothing');
        assert.deepEqual(errors.filter(e => /Articles|copyAll|art-/.test(e)), []);
        console.log('PASS: Articles 📋 — icon only left of ✨ Draft, one tap = title + body as typed, green ✓ for 1.5 s, empty = nothing');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
