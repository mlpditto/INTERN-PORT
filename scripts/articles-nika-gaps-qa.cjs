// V102.628 (owner pick 2A) — admin 📰 Articles: ❔ n in the header = questions interns asked Nika that the library could not answer (nika_questions
// notFound, 30 days, no names in the log). Alike questions count once (×n, newest wording), most asked first; ✨ Draft = a new article titled with the
// question in its language; 🙈 hides it (app_settings/nika_gaps). The REAL admin.html + articles-admin.js, a stub Firestore. OUTDIR=… saves a shot.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');

        const r = await page.evaluate(() => {
            const H = 3600e3, now = Date.now(), at = h => ({ toMillis: () => now - h * H }), G = Articles._G, S = Articles._S;
            const docs = [
                { question: 'Sacubitril/valsartan เริ่มยังไง?', notFound: true, at: at(50) },
                { question: 'sacubitril/valsartan  เริ่มยังไง', notFound: true, at: at(48) },
                { question: 'Sacubitril/valsartan เริ่มยังไง', notFound: true, at: at(70) },
                { question: 'SGLT2i stop before surgery?', notFound: true, at: at(5) },
                { question: 'Amlodipine: what to monitor?', notFound: false, sources: 3, at: at(1) },   // answered: not a gap
                { question: 'Old one', notFound: true, at: at(31 * 24) },                                // > 30 days
                { question: 'Hidden one', notFound: true, at: at(2) }];
            const out = {};
            out.rows = Articles._gapRows(docs, { 'hidden one': true }, now).map(g => [g.n, g.q]);
            S.list = []; S.loaded = true; S.loading = false; Articles.open();
            G.loaded = true; G.list = Articles._gapRows(docs, { 'hidden one': true }, now); Articles.filter('all');
            const chip = document.querySelector('#articlesModal .art-gap');
            out.chip = [chip.textContent, chip.getAttribute('aria-expanded'), !document.getElementById('art-gaps')];
            Articles.gaps();
            out.list = [...document.querySelectorAll('#art-gaps .art-gp')].map(x => [x.querySelector('.n').textContent, x.querySelector('.t').textContent, x.querySelector('.w').textContent]);
            out.open = document.querySelector('#articlesModal .art-gap').getAttribute('aria-expanded');
            return out;
        });
        assert.deepEqual(r.rows, [[3, 'sacubitril/valsartan  เริ่มยังไง'], [1, 'SGLT2i stop before surgery?']], 'alike counted once (newest wording), answered / old / hidden out: ' + JSON.stringify(r.rows));
        assert.deepEqual(r.chip, ['❔ 2', 'false', true], 'closed chip with the count');
        assert.deepEqual(r.list, [['×3', 'sacubitril/valsartan  เริ่มยังไง', '2 d'], ['×1', 'SGLT2i stop before surgery?', '5 h']]);
        assert.equal(r.open, 'true');
        if (process.env.OUTDIR) await page.locator('#articlesModal .modal-content').screenshot({ path: process.env.OUTDIR + '/nika-gaps.png', clip: undefined });

        // ✨ Draft: a new unsaved article titled with the question, in its language
        const d = await page.evaluate(() => { Articles.gapDraft(0); const S = Articles._S; return { id: S.cur.id, title: S.cur.title, lang: S.lang, field: document.getElementById('art-title').value, gaps: !document.getElementById('art-gaps') }; });
        assert.deepEqual(d, { id: null, title: { th: 'sacubitril/valsartan  เริ่มยังไง' }, lang: 'th', field: 'sacubitril/valsartan  เริ่มยังไง', gaps: true });

        // 🙈 hides: gone from the list and the count, saved to app_settings/nika_gaps (merge)
        const h = await page.evaluate(async () => {
            const writes = []; window.db = { collection: n => ({ doc: id => ({ set: (v, o) => { writes.push([n, id, v, o]); return Promise.resolve(); } }) }) };
            try { db = window.db; } catch (e) { /* db is window.db */ }
            Articles.gaps(); const ok = await Articles.gapHide(1);
            return { ok, writes, chip: document.querySelector('#articlesModal .art-gap').textContent, rows: document.querySelectorAll('#art-gaps .art-gp').length };
        });
        assert.deepEqual(h, { ok: true, writes: [['app_settings', 'nika_gaps', { hidden: { 'sglt2i stop before surgery': true } }, { merge: true }]], chip: '❔ 1', rows: 1 }, JSON.stringify(h));
        assert.deepEqual(errors.filter(e => /gap|nika/i.test(e)), [], 'no ❔ errors (the offline admin page has its own noise): ' + errors);
        console.log('PASS: Articles ❔ Nika gaps (V102.628) — not-found questions, 30 days, alike ×n, most asked first; ✨ Draft titles a new article in its language; 🙈 hides (app_settings/nika_gaps)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
