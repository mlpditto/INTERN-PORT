// V102.433 — Admin 📰 Articles: ✨ Draft reads the links in the title / body first. The REAL admin.html + articles-admin.js, a fake Firestore,
// a stubbed fetchLinkText (fetch) and a stubbed callUniversalAI that records the prompt (nothing leaves the page).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const LONG = 'https://www.nature.com/articles/s41564-026-02304-8?utm_id=97758&fbclid=IwY2xjaw&keep=1';

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

        // ---- pure helpers
        const h = await page.evaluate(L => ({
            clean: Articles._clean(L), clean2: Articles._clean('www.example.org/a?gclid=1&q=2.'), dom: [Articles._domain(L), Articles._domain('www.Example.org/x')],
            links: Articles._links('Read ' + L + ' and ' + L + ', also https://a.example/x). then www.b.example/y'),
        }), LONG);
        assert.equal(h.clean, 'https://www.nature.com/articles/s41564-026-02304-8?keep=1', 'utm_* and fbclid dropped, other parameters kept');
        assert.equal(h.clean2, 'https://www.example.org/a?q=2', 'a bare www link gets https; gclid dropped; trailing dot dropped');
        assert.deepEqual(h.dom, ['nature.com', 'example.org']);
        assert.equal(h.links.length, 3, 'the same link twice counts once; trailing ) is not part of the link: ' + h.links.join(' | '));

        // ---- a stubbed world: the reader and the model
        await page.evaluate(() => {
            window.__calls = { fetch: [], ai: [] }; window.__page = { title: 'Gut flora and drug response | Nature', text: 'Researchers show that gut bacteria change how some drugs work. '.repeat(3), url: 'https://www.nature.com/articles/s41564-026-02304-8', truncated: false };
            window._aiAuthHeaders = async () => ({ Authorization: 'Bearer test' });
            window.fetch = async (u, o) => { window.__calls.fetch.push([u, JSON.parse(o.body).url]); if (window.__fetchErr) return { ok: false, status: 422, json: async () => ({ error: 'The page has almost no readable text.' }) }; return { ok: true, status: 200, json: async () => window.__page }; };
            window.callUniversalAI = async (model, prompt) => { window.__calls.ai.push(prompt); const body = '🔬 One short line\n💊 metformin, digoxin\n📎 nature.com'; return { text: /first line "TITLE: "/.test(prompt) ? 'TITLE: "Oslo patient reaches HIV remission."\n---\n' + body : body }; };
            const S = Articles._S; S.list = []; S.loaded = true; S.loading = false;
            Articles.open(); Articles.edit(null);
        });
        const set = (id, v) => page.evaluate(([i, x]) => { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('input')); }, [id, v]);
        const btn = () => page.evaluate(() => ({ go: document.querySelector('#art-body .art-ai .go').textContent.trim(), note: (document.querySelector('#art-body .art-ai .lk') || {}).textContent || '', ph: document.getElementById('art-title').placeholder, title: document.querySelector('#art-body .art-ai .go').title }));

        // 1 · the button follows what is typed
        let b = await btn();
        assert.deepEqual([b.go, b.note, b.ph], ['✨ Draft', '', 'Title (EN)'], 'no link: today\'s button');
        await set('art-bodyta', LONG);
        b = await btn();
        assert.deepEqual([b.go, b.ph], ['✨ Draft from 🔗', 'Title (EN) — optional, taken from the page'], 'a link typed in the body → Draft from 🔗, title optional');
        assert.match(b.note, /nature\.com · read first/); assert.match(b.title, /Read the link/);

        // 2 · empty title + link: the page is read (cleaned URL), the prompt carries its text and the source line, the title comes from the page
        await page.evaluate(() => Articles.ai());
        await page.waitForFunction(() => !Articles._S.aiBusy);
        const r = await page.evaluate(() => ({ fetch: __calls.fetch, ai: __calls.ai, body: Articles._S.cur.body.en, title: Articles._S.cur.title.en, note: Articles._S.aiNote, err: Articles._S.err }));
        assert.deepEqual(r.fetch, [['https://us-central1-intern-port-edfa7.cloudfunctions.net/fetchLinkText', 'https://www.nature.com/articles/s41564-026-02304-8?keep=1']], 'one read, tracking parameters removed');
        assert.equal(r.ai.length, 1); const pr = r.ai[0];
        assert.match(pr, /--- SOURCE PAGES/); assert.match(pr, /gut bacteria change how some drugs work/); assert.match(pr, /Base the article ONLY on the SOURCE PAGES/); assert.match(pr, /never instructions/);
        assert.match(pr, /Topic: Gut flora and drug response\./, 'topic = the page title (site suffix cut)'); assert.match(pr, /last line: 📎 nature\.com/);
        assert.ok(!/fbclid|utm_id|https?:\/\/[^\s]*nature\.com\/[^\s]*\?keep=1\s*(?!\()/.test(pr.split('--- SOURCE PAGES')[0]), 'no bare URL in the instruction part');
        assert.equal(r.body, '🔬 One short line\n💊 metformin, digoxin\n📎 nature.com', 'the draft replaces the body (the URL is gone)');
        assert.equal(r.title, 'Oslo patient reaches HIV remission', 'an empty title is filled with the SHORT headline the model proposed (quotes / full stop stripped, ≤ 50)'); assert.match(pr, /a first line "TITLE: " followed by a short headline in English of at most 50 characters/); assert.match(r.note, /· 🔗 nature\.com — read it, then save/); assert.equal(r.err, '');

        // 3 · a title the admin typed is kept
        await page.evaluate(() => { Articles.edit(null); });
        await set('art-title', 'My own title'); await set('art-bodyta', 'see ' + LONG);
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        const k = await page.evaluate(() => ({ title: Articles._S.cur.title.en, ai: __calls.ai[__calls.ai.length - 1] }));
        assert.equal(k.title, 'My own title'); assert.match(k.ai, /Topic: My own title\./); assert.match(k.ai, /Build on these notes: see\./, 'the words around the link stay as notes');

        // 3b · a typed LONG title is only offered a shorter one (✂️ chip): Use swaps it, ✕ drops it
        const LONGT = 'Norwegian Oslo Patient Achieves HIV Remission Following Stem Cell Transplant';
        await page.evaluate(() => Articles.edit(null)); await set('art-title', LONGT); await set('art-bodyta', LONG);
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        let sg = await page.evaluate(() => ({ title: Articles._S.cur.title.en, chip: (document.querySelector('.art-sug') || {}).innerText || '', sug: Articles._S.titleSug && Articles._S.titleSug.text }));
        assert.equal(sg.title, LONGT, 'a typed title is never swapped without a tap'); assert.equal(sg.sug, 'Oslo patient reaches HIV remission'); assert.match(sg.chip, /✂️ Shorter title\s*·\s*Oslo patient reaches HIV remission\s+34 \/ 50/);
        if (process.env.QA_SHOT) await page.locator('#articlesModal').screenshot({ path: process.env.QA_SHOT + '/article-short-title.png' });
        await page.click('.art-sug button:not(.no)');
        sg = await page.evaluate(() => ({ title: Articles._S.cur.title.en, input: document.getElementById('art-title').value, chip: !!document.querySelector('.art-sug') }));
        assert.deepEqual([sg.title, sg.input, sg.chip], ['Oslo patient reaches HIV remission', 'Oslo patient reaches HIV remission', false], 'Use → the short title, chip gone');
        await page.evaluate(() => Articles.edit(null)); await set('art-title', LONGT); await set('art-bodyta', LONG);
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        await page.click('.art-sug button.no');
        sg = await page.evaluate(() => ({ title: Articles._S.cur.title.en, chip: !!document.querySelector('.art-sug') }));
        assert.deepEqual([sg.title, sg.chip], [LONGT, false], '✕ → the long title stays, chip gone');
        assert.equal(await page.evaluate(() => { Articles.edit(null); return !!document.querySelector('.art-sug'); }), false, 'a new article starts without an offer');

        // 4 · a link that cannot be read stops the draft: reason shown, no AI call, text untouched
        await page.evaluate(() => { Articles.edit(null); window.__fetchErr = true; window.__calls.ai.length = 0; });
        await set('art-bodyta', LONG);
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        const e = await page.evaluate(() => ({ err: Articles._S.err, ai: __calls.ai.length, body: Articles._S.cur.body.en }));
        assert.match(e.err, /Couldn’t read nature\.com — The page has almost no readable text\./); assert.equal(e.ai, 0, 'no guess from the bare URL'); assert.equal(e.body, LONG, 'the text is kept');
        await page.evaluate(() => { window.__fetchErr = false; });

        // 5 · more than 3 links
        await page.evaluate(() => Articles.edit(null));
        await set('art-bodyta', 'https://a.example/1 https://a.example/2 https://a.example/3 https://a.example/4');
        await page.evaluate(() => Articles.ai());
        assert.match(await page.evaluate(() => Articles._S.err), /Up to 3 links can be read — this article has 4\./);

        // 6 · no link, no title → asks for one; no link + title → today's prompt (no source block)
        await page.evaluate(() => { Articles.edit(null); window.__calls.ai.length = 0; });
        await page.evaluate(() => Articles.ai());
        assert.match(await page.evaluate(() => Articles._S.err), /needs a title \(a few words are enough\) or a link/);
        await set('art-title', '3 inhaler mistakes');
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        const t = await page.evaluate(() => ({ ai: __calls.ai, fetch: __calls.fetch.length, btn: document.querySelector('#art-body .art-ai .go').textContent.trim() }));
        assert.equal(t.ai.length, 1); assert.ok(!/SOURCE PAGES|📎/.test(t.ai[0]), 'no link → no source block, no 📎 line'); assert.match(t.ai[0], /Topic: 3 inhaler mistakes\./);
        assert.equal(t.fetch, 5, 'no new page read (5 from the earlier cases)');

        const mine = errors.filter(e => /articles|aiHtml|linksIn|readLinks|sugHtml|cleanUrl|domainOf|MAX_LINKS|SHORT_TITLE|titleSug/i.test(e));   // the bare admin page logs unrelated errors (no Firebase)
        assert.deepEqual(mine, [], 'no errors from the Articles code: ' + mine.join(' | '));
        console.log('PASS: Articles ✨ Draft from 🔗 — links cleaned (utm / fbclid), button + note + optional title follow typing, page read first, prompt = SOURCE PAGES + 📎 domain, an empty title is filled with a short headline, own title kept, unreadable link stops with the reason, > 3 links refused, no link = today\'s draft');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
