// V102.606 (owner pick A–C) — Articles editor: A) an empty TH / KO body (EN written) says "interns see 🇬🇧 · tap ✨ From EN" in the box;
// B) "Saved · 501 min ago" → "8 h ago", a day+ → "2 d ago"; C) When & who / Links remember open / folded per browser (next article, after reload).
// The REAL admin.html, fake Firestore.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => {
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase });
        });
        const url = require('url').pathToFileURL(process.cwd() + '/public/admin.html').href;
        const boot = async (saved) => {
            await page.goto(url);
            await page.waitForFunction(() => window.Articles && document.readyState === 'complete');
            await page.evaluate((saved) => {
                window.db = { collection: () => ({ get: async () => ({ docs: [] }), add: async () => ({ id: 'n1' }), doc: () => ({ update: async () => {}, delete: async () => {}, get: async () => ({ exists: false }) }) }) };
                db = window.db; const S = Articles._S; S.list = []; S.loaded = true; S.loading = false; Articles.open(); Articles.edit(null);
                if (saved) { S.cur.id = 'x1'; S.cur.title = { en: 'Mpox rash' }; S.cur.body = { en: 'One afternoon at the OPD pharmacy…' }; S.base = JSON.stringify(S.cur); Articles.lang('en'); }
            }, saved);
        };
        const ph = () => page.evaluate(() => document.getElementById('art-bodyta').placeholder);
        const ago = (min) => page.evaluate((m) => { const S = Articles._S; S.base = JSON.stringify(S.cur); S.savedAt = Date.now() - m * 60000; Articles.lang(S.lang); return document.querySelector('#art-stl .art-save').textContent; }, min);

        // A
        await boot(true);
        assert.match(await ph(), /^A short story/, 'EN keeps the usual hint');
        await page.evaluate(() => Articles.lang('ko'));
        assert.equal(await ph(), 'ว่าง · intern เห็นฉบับ 🇬🇧 · กด ✨ From EN ด้านบน\nEmpty · interns see the 🇬🇧 version · tap ✨ From EN', 'empty KO with EN written');
        await page.evaluate(() => Articles.lang('th'));
        assert.match(await ph(), /^ว่าง · intern เห็นฉบับ 🇬🇧/, 'empty TH too');
        await page.evaluate(() => { Articles._S.cur.body.th = 'มีแล้ว'; Articles.lang('th'); });
        assert.match(await ph(), /^A short story/, 'TH with text: usual hint');
        await page.evaluate(() => { Articles._S.cur.body = {}; Articles.lang('ko'); });
        assert.match(await ph(), /^A short story/, 'no EN yet: nothing to fall back to → usual hint');

        // B
        assert.equal(await ago(0), 'Saved');
        assert.equal(await ago(7), 'Saved · 7 min ago');
        assert.equal(await ago(501), 'Saved · 8 h ago');
        assert.equal(await ago(2 * 1440 + 30), 'Saved · 2 d ago');

        // C — a saved article opens with When & who folded; open it → stays open on the next article and after a reload
        const whenOpen = () => page.evaluate(() => [...document.querySelectorAll('#art-body details.art-sec')][0].open);
        await boot(true);
        await page.evaluate(() => localStorage.removeItem('articleSecOpen'));
        await boot(false);
        assert.equal(await whenOpen(), true, 'a new article opens it (old default)');
        await page.waitForTimeout(50);
        await boot(true);
        assert.equal(await whenOpen(), false, 'saved article: still folded — the new article\'s default open was not remembered');
        await page.click('#art-body details.art-sec >> nth=0 >> summary');
        await page.waitForTimeout(50);
        assert.equal(await whenOpen(), true);
        await boot(true);
        assert.equal(await whenOpen(), true, 'still open after a reload');
        await page.click('#art-body details.art-sec >> nth=0 >> summary');
        await page.waitForTimeout(50);
        await boot(true);
        assert.equal(await whenOpen(), false, 'folded again → stays folded');
        await page.evaluate(() => localStorage.setItem('articleSecOpen', 'not json'));
        await boot(false);
        assert.equal(await whenOpen(), true, 'bad stored value → the old default (a new article opens it)');

        assert.deepEqual(errors.filter(e => /Articles|art-|agoText|bodyPh|secOpen/.test(e)), []);
        console.log('PASS: Articles editor A–C — empty TH/KO says interns see 🇬🇧 · From EN; Saved 8 h / 2 d ago; When & who remembers open/folded per browser');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
