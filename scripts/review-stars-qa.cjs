// V101.156 / V102.243 — the lean Explore review sheet: logo + name, ★ rating (tap again to clear), four icon-only quick tags, text with a counter that appears when you
// type, ฿ + Send on one row, no spinner. A star, a tag or text is enough. The submit writes rating / tags. Peer list + admin queue show them.
// The REAL public/index.html in Chromium (Firebase stubbed). Also: admin ER_TAGS and index EXPLORE_REVIEW_TAGS carry the same keys.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8'), adm = fs.readFileSync('public/admin.html', 'utf8');

const keysIdx = [...idx.match(/const EXPLORE_REVIEW_TAGS = \[(.*)\];/)[1].matchAll(/\['(\w+)'/g)].map(m => m[1]);
const keysAdm = [...adm.match(/const ER_TAGS = \[(.*)\];/)[1].matchAll(/\['(\w+)'/g)].map(m => m[1]);
assert.deepEqual(keysIdx, keysAdm, 'admin ER_TAGS and index EXPLORE_REVIEW_TAGS carry the same keys');
assert.equal(keysIdx.length, 4);
assert.ok(/\$\{r\.rating \?/.test(adm) && /ER_TAGS\.find/.test(adm), 'admin queue shows the stars + tags');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { window.__written = null; window.__lastDoc = ''; window.firebase = new Proxy(function () {}, { get: (t, p) => (p === 'doc' ? id => { window.__lastDoc = id; return window.firebase; } : p === 'set' ? async data => { window.__written = { id: window.__lastDoc, data }; } : window.firebase), apply: () => window.firebase }); });   // records db.collection(..).doc(id).set(data)
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
            const lo = document.getElementById('loading-overlay'); if (lo) lo.style.setProperty('display', 'none', 'important');
            reviewLinksCache = [{ id: 'L1', title: 'BEARHOUSE', url: 'https://e.com', beriReward: 10 }];
            window.__alerts = [];
            window.alert = m => window.__alerts.push(m);
            window.awardEngagementBonusIfDue = () => {};
            openExploreReviewModal('L1');
        });
        const r = await page.evaluate(() => {
            const modal = document.getElementById('exploreReviewModal');
            const txt = modal.innerText.replace(/\s+/g, ' ').trim();
            const spend = document.getElementById('er-spend'), send = [...modal.querySelectorAll('button')].find(b => /submitExploreReview/.test(b.getAttribute('onclick') || ''));
            const row = spend.parentElement.getBoundingClientRect(), sb = send.getBoundingClientRect(), sp = spend.getBoundingClientRect();
            return {
                shown: getComputedStyle(modal).display, txt,
                title: document.getElementById('er-link-title').textContent, logo: !!document.querySelector('#er-logo span'),
                stars: modal.querySelectorAll('.er-star').length, tags: [...modal.querySelectorAll('.er-tag')].map(b => b.textContent + '|' + b.title),
                countHidden: document.getElementById('er-count').hidden, rows: document.getElementById('er-text').rows,
                spendSameRow: Math.abs((sp.top + sp.bottom) / 2 - (sb.top + sb.bottom) / 2) < 6,
                spinner: getComputedStyle(spend, '::-webkit-inner-spin-button').webkitAppearance,
                cancel: /Cancel/.test(modal.innerHTML), write: /Write a review/.test(txt),
                starSize: Math.round(modal.querySelector('.er-star').getBoundingClientRect().width),
            };
        });
        assert.equal(r.shown, 'flex'); assert.equal(r.title, 'BEARHOUSE'); assert.ok(r.logo, 'the shop logo disc is drawn');
        assert.equal(r.stars, 5); assert.equal(r.starSize, 44, 'finger-sized stars');
        assert.deepEqual(r.tags, ['😋|Tasty', '🤝|Good service', '💰|Worth it', '⚡|Fast'], 'four icon-only tags, words in the tooltip');
        assert.ok(r.countHidden && r.rows === 2, 'counter hidden until you type; 2-row box');
        assert.ok(r.spendSameRow, '฿ box and Send share one row');
        assert.ok(!r.cancel, 'no Cancel button (× closes)');
        assert.ok(!/Write a review|Amount spent|optional|Cancel|Send review/.test(r.txt), 'no caption text left in the sheet: ' + r.txt);

        // nothing chosen → refused
        await page.evaluate(() => submitExploreReview());
        assert.equal(await page.evaluate(() => window.__written), null);
        assert.equal((await page.evaluate(() => window.__alerts)).length, 1, 'empty = a short alert, nothing written');

        // star toggles + clears
        await page.locator('.er-star').nth(3).click({ force: true });
        assert.equal(await page.locator('.er-star.on').count(), 4, '4 stars lit');
        await page.locator('.er-star').nth(3).click({ force: true });
        assert.equal(await page.locator('.er-star.on').count(), 0, 'tapping the same star again clears');
        await page.locator('.er-star').nth(3).click({ force: true });

        // tags + text + counter + spend
        await page.locator('.er-tag').nth(0).click({ force: true }); await page.locator('.er-tag').nth(2).click({ force: true });
        assert.deepEqual(await page.locator('.er-tag[aria-pressed="true"]').evaluateAll(b => b.map(x => x.textContent)), ['😋', '💰']);
        await page.fill('#er-text', 'หมูย่างอร่อย'); await page.fill('#er-spend', '250');
        assert.equal(await page.evaluate(() => [document.getElementById('er-count').hidden, document.getElementById('er-count').textContent].join('|')), 'false|12/300', 'counter appears with the first character');
        await page.evaluate(() => submitExploreReview());
        const w = await page.evaluate(() => window.__written);
        assert.equal(w.id, 'L1_' + (await page.evaluate(() => userId)), 'doc id = linkId_userId');
        assert.equal(w.data.rating, 4); assert.deepEqual(w.data.tags, ['tasty', 'worth']); assert.equal(w.data.text, 'หมูย่างอร่อย'); assert.equal(w.data.spendAmount, 250); assert.equal(w.data.status, 'pending');

        // a star alone is enough; text is optional; reopening resets
        await page.evaluate(() => { window.__written = null; openExploreReviewModal('L1'); });
        assert.equal(await page.locator('.er-star.on').count(), 0, 'reopen = reset');
        await page.locator('.er-star').nth(4).click({ force: true });
        await page.evaluate(() => submitExploreReview());
        const w2 = await page.evaluate(() => window.__written);
        assert.ok(w2 && w2.data.rating === 5 && w2.data.text === '' && w2.data.tags.length === 0 && w2.data.spendAmount === null, 'stars only: ' + JSON.stringify(w2));

        // peer list shows ★ + tag icons, and copes with no text
        const peer = await page.evaluate(() => {
            reviewLinkClicksCache = {}; myExploreReviewsCache = {};
            exploreReviewsCache = [{ linkId: 'L1', displayName: 'Nid', rating: 4, tags: ['tasty', 'fast'], text: 'อร่อย' }, { linkId: 'L1', displayName: 'Bua', rating: 5, tags: [], text: '' }, { linkId: 'L1', displayName: 'Old', text: 'older review' }];
            renderExploreLinks();
            return [...document.querySelector('.expl-peer-list').children].map(d => d.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
        });
        assert.equal(peer, 'Nid ★4 😋⚡: อร่อย | Bua ★5 | Old: older review', 'peer list: ' + peer);

        assert.deepEqual(errors.filter(e => !/firebase\.|Cannot read properties of undefined/.test(e)), [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: lean review sheet — ★ first, icon-only tags, counter on typing, ฿ + Send one row, star / tag / text each enough, rating + tags written, peer list shows them');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
