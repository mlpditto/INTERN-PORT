// V102.474 — Articles editor: after Save the pressed button turns green ("✓ Saved") and stays green until the next edit. The REAL admin.html, fake Firestore.
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
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');
        await page.evaluate(() => {
            let n = 0; window.__writes = [];
            window.db = { collection: name => ({ get: async () => ({ docs: [] }), add: async v => { window.__writes.push(['add', v]); return { id: 'n' + (++n) }; }, doc: id => ({ update: async v => { window.__writes.push(['update', id, v]); }, delete: async () => {} }) }) };
            db = window.db; const S = Articles._S; S.list = []; S.loaded = true; S.loading = false; Articles.open(); Articles.edit(null);
        });
        const btns = () => page.evaluate(() => [...document.querySelectorAll('#art-btns button')].map(b => [b.textContent.trim(), b.classList.contains('ok'), getComputedStyle(b).backgroundColor]));
        const set = (id, v) => page.evaluate(([i, x]) => { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('input')); }, [id, v]);

        // 0 · before any save nothing is green
        let b = await btns(); assert.deepEqual(b.map(x => [x[0].replace(/^\W+/, ''), x[1]]).slice(1), [['Save draft', false], ['Schedule', false]]);
        await set('art-title', 'Stroke checklist'); await set('art-bodyta', 'Line one');

        // 1 · Save draft → that button turns green with ✓ Saved, the other stays as it was
        await page.evaluate(() => Articles.save(false)); await page.waitForFunction(() => !Articles._S.saving);
        b = await btns();
        assert.deepEqual([b[1][0], b[1][1], b[1][2]], ['✓ Saved', true, 'rgb(22, 163, 74)'], 'Save draft → green ✓ Saved');
        assert.equal(b[2][1], false, 'the primary button is untouched'); assert.match(b[2][0], /Schedule/);
        assert.equal(await page.evaluate(() => __writes.length), 1);

        // 2 · typing makes the article dirty again → green goes at once (live repaint, no full render)
        await set('art-bodyta', 'Line one and two');
        b = await btns(); assert.deepEqual([b[1][0], b[1][1]], ['Save draft', false], 'an edit takes the green away');

        // 3 · the primary button: Schedule → saved as scheduled → "✓ Saved" green; the secondary is the plain "Back to draft"
        await page.evaluate(() => Articles.save(true)); await page.waitForFunction(() => !Articles._S.saving);
        b = await btns(); assert.deepEqual([b[2][0], b[2][1], b[2][2]], ['✓ Saved', true, 'rgb(22, 163, 74)'], 'primary → green ✓ Saved');
        assert.match(b[1][0], /Back to draft/); assert.equal(b[1][1], false);

        // 4 · a non-text edit (a full render) also clears it; then Save (now "💾 Save") goes green again
        await page.evaluate(() => Articles.cover('🫁'));
        b = await btns(); assert.ok(!b[2][1] && /Save/.test(b[2][0]) && !/Saved/.test(b[2][0]), 'cover change → back to Save');
        await page.evaluate(() => Articles.save(true)); await page.waitForFunction(() => !Articles._S.saving);
        b = await btns(); assert.deepEqual([b[2][0], b[2][1]], ['✓ Saved', true]);

        // 5 · opening another article starts clean
        await page.evaluate(() => Articles.edit(null));
        b = await btns(); assert.ok(b.every(x => !x[1]), 'a freshly opened article has no green');

        // 6 · a failed save is not green
        await set('art-title', 'Another'); await set('art-bodyta', 'x');
        await page.evaluate(() => { window.db.collection = () => ({ add: async () => { throw new Error('permission-denied'); } }); db = window.db; Articles.save(false); });
        await page.waitForFunction(() => !Articles._S.saving);
        b = await btns(); assert.ok(b.every(x => !x[1]), 'a failed save never turns green');

        const mine = errors.filter(e => /articles|btnsHtml|paintLive/i.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: Articles Save turns green (✓ Saved) on the pressed button, stays until the next edit (typing and full renders), not on a fresh article, not on a failed save');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
