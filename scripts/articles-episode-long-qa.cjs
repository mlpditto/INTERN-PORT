// V102.622 (owner) — Admin 📰 Articles: (1) "ไม่มีให้กด ep 3": a SAVED episode whose body ends with a "➡️ Next:" line offers ✨ Episode n+1
// after it is reopened (the source used to live only in memory after a ✨ draft); (2) "ภาษาอังกฤษ เกิน 2000 char ควรมี option ให้เลือกเกินได้":
// ⤢ Long shows once a body passes 2000, lets it save (up to 6000, stored as long: true), and the counter turns amber instead of red.
// The REAL admin.html + articles-admin.js, a fake Firestore, a stubbed callUniversalAI (nothing leaves the page).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.match(admin, /<script src="articles-admin\.js\?v=V102\.(62[2-9]|6[3-9]\d|[7-9]\d\d)"><\/script>/, 'articles-admin.js cache-busted');

const EP2 = '👦 The next day, the older brother walks in scratching his arm.\n\n💡 Over **1 year old**, step up to **Class 4, 5** with care.\n\n💊 Triamcinolone, Mometasone\n➡️ Next: how long, how much per week and the side effects to watch';

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
        await page.waitForFunction(() => window.Articles && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');

        await page.evaluate((EP2) => {
            window.__ai = [];
            window.callUniversalAI = async (model, prompt) => { window.__ai.push(prompt); return { text: '🧴 Episode three text.\n\n💊 Clobetasol' }; };
            const S = Articles._S, now = Date.now();
            S.list = [{ id: 'a2', title: { en: 'Topical corticosteroids (2)' }, body: { en: EP2 }, cover: { emoji: '💊' }, status: 'draft', startAt: now, endAt: now + 864e5,
                audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null }];
            S.loaded = true; S.loading = false;
            Articles.open(); Articles.edit('a2');
        }, EP2);
        const chip = () => page.locator('#art-body .art-ft .art-ep');

        // 1 · reopened saved episode 2 → ✨ Episode 3, and it drafts a NEW article "(3)" with episode 2 in the prompt
        assert.ok(!(await page.evaluate(() => Articles._S.epSrc)), 'no remembered source (a fresh open)');
        assert.equal(await chip().count(), 1, 'the footer offers the next episode');
        assert.equal((await chip().innerText()).trim(), '✨ Ep 3');
        await chip().click(); await page.waitForFunction(() => !Articles._S.aiBusy);
        const r = await page.evaluate(() => ({ title: Articles._S.cur.title.en, id: Articles._S.cur.id, prompt: window.__ai[0] || '', body: Articles._S.cur.body.en }));
        assert.equal(r.title, 'Topical corticosteroids (3)'); assert.equal(r.id, null, 'a new article');
        assert.ok(r.prompt.includes('The next day, the older brother'), 'episode 2 goes into the prompt');
        assert.ok(r.prompt.includes('how long, how much per week'), 'the "Next:" topic goes into the prompt');
        assert.equal(r.body, '🧴 Episode three text.\n\n💊 Clobetasol');
        // no "Next:" line → no chip
        await page.evaluate(() => Articles.edit('a2'));
        await page.evaluate(() => { const e = document.getElementById('art-bodyta'); e.value = 'short, finished story'; e.dispatchEvent(new Event('input')); Articles._S.cur.body.en = e.value; });
        await page.evaluate(() => Articles.lang ? Articles.lang('en') : null);
        assert.equal(await page.evaluate(() => { const a = Articles._S.cur; return !!(a.body.en.match(/➡️\s*Next:/)); }), false);

        // 2 · ⤢ Long: hidden under 2000; over → red + refused; ⤢ Long → amber, saves, long: true; > 6000 still refused
        await page.evaluate(() => Articles.edit(null));
        const fill = n => page.evaluate(n => { const e = document.getElementById('art-title'); e.value = 'Long one'; e.dispatchEvent(new Event('input'));
            const b = document.getElementById('art-bodyta'); b.value = 'x'.repeat(n); b.dispatchEvent(new Event('input')); }, n);
        const st = () => page.evaluate(() => { const l = document.getElementById('art-long'), c = document.getElementById('art-count');
            return { long: l ? (l.hidden ? 'hidden' : l.getAttribute('aria-pressed')) : 'none', cls: c.className, err: Articles._validate(Articles._S.cur, false), doc: Articles._toDoc(Articles._S.cur, 'draft').long }; });
        await fill(1900);
        assert.deepEqual(await st(), { long: 'hidden', cls: 'near', err: '', doc: false }, 'under the limit: no ⤢ Long (V102.624: amber from 1800)');
        await fill(2094);
        let s = await st();
        assert.equal(s.long, 'false'); assert.equal(s.cls, 'over'); assert.match(s.err, /EN body is longer than 2000 characters — tap ⤢ Long/);
        await page.click('#art-long');
        s = await st();
        assert.deepEqual(s, { long: 'true', cls: 'long', err: '', doc: true }, '⤢ Long on: amber counter, saves, long: true');
        assert.equal((await page.locator('#art-count').innerText()).trim(), '2094 / 2000 · ~3 min', 'the number is shown once');
        await fill(6001);
        assert.match((await st()).err, /EN body is longer than 6000 characters\.$/, 'Long still has a ceiling');
        await page.click('#art-long');
        assert.equal((await st()).doc, false, 'tap again = back to the 2000 limit');

        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db.collection|firebase/.test(e);   // the page's own boot under the stub
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Articles — a reopened episode with "➡️ Next:" offers ✨ Episode n+1 (new article, previous episode in the prompt); ⤢ Long past 2000 (amber, saves, long: true, ceiling 6000, tap again to undo)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
