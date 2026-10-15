// V101.154 / V102.241 — Explore shop tiles: ONE tinted surface (name + category sit on the background), whole tile opens the shop, the two best unearned
// shops are double-width, earned = dim + green frame, no category = neutral tile. The REAL public/index.html + renderExploreLinks in Chromium.
// Also: admin RL_CATEGORIES and index EXPLORE_CATS carry the same keys.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8'), adm = fs.readFileSync('public/admin.html', 'utf8');

const keysOf = (src, re) => [...src.match(re)[1].matchAll(/\b(meat|noodle|rice|sweet|drink|health|fast)\b\s*[:,]/g)].map(m => m[1]);
const idxKeys = [...idx.match(/const EXPLORE_CATS = \{([\s\S]*?)\n        \};/)[1].matchAll(/\b(meat|noodle|rice|sweet|drink|health|fast): \[/g)].map(m => m[1]).sort();
const admKeys = [...adm.match(/const RL_CATEGORIES = \[(.*)\];/)[1].matchAll(/\['(\w+)'/g)].map(m => m[1]).sort();
assert.deepEqual(idxKeys, admKeys, 'admin RL_CATEGORIES and index EXPLORE_CATS carry the same keys');
assert.equal(idxKeys.length, 7);
assert.ok(/id="rl-category"/.test(adm) && /rlPaintCats\(\);/.test(adm) && /data\.category = category/.test(adm), 'admin: chip row, paint, save');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
            const lo = document.getElementById('loading-overlay'); if (lo) lo.style.setProperty('display', 'none', 'important');   // the signed-out harness page shows its loading cover
            window.__opened = [];
            window.explOpenLink = id => window.__opened.push(id);
            reviewLinksCache = [
                { id: 'a', title: 'BEARHOUSE', url: 'https://e.com/a', beriReward: 10, category: 'meat' },
                { id: 'b', title: 'Solsot', url: 'https://e.com/b', beriReward: 10, category: 'health' },   // earned
                { id: 'c', title: 'สุกี้แห้ง 100 ปี', url: 'https://e.com/c', beriReward: 10, category: 'noodle' },
                { id: 'd', title: 'Emily', url: 'https://e.com/d', beriReward: 8, category: 'sweet' },
                { id: 'e', title: 'PRE&PRO PnP', url: 'https://e.com/e', beriReward: 8 },                    // no category
                { id: 'f', title: 'Weird', url: 'https://e.com/f', beriReward: 9, category: 'nonsense' },     // unknown key → neutral
            ];
            reviewLinkClicksCache = { b: { linkId: 'b' } };
            for (let n = document.getElementById('explore-links-list'); n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');   // the Explore tab is not the open one in this page
            renderExploreLinks();
            const cards = [...document.querySelectorAll('#explore-links-list .expl-shop-card')];
            const grid = document.getElementById('explore-links-list');
            const q = (c, sel) => c.querySelector(sel);
            return {
                n: cards.length,
                feat: cards.map(c => c.classList.contains('expl-feat')),
                earned: cards.map(c => c.classList.contains('expl-earned')),
                spans: cards.map(c => getComputedStyle(c).gridColumnEnd),
                cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
                widths: cards.map(c => Math.round(c.getBoundingClientRect().width)),
                cats: cards.map(c => (q(c, '.expl-cat') || {}).textContent || ''),
                tint: cards.map(c => c.getAttribute('style') || ''),
                nameBg: getComputedStyle(q(cards[0], '.expl-name')).backgroundColor,
                nameInsideTile: (() => { const t = cards[0].getBoundingClientRect(), n = q(cards[0], '.expl-name').getBoundingClientRect(); return n.left >= t.left && n.right <= t.right && n.bottom <= t.bottom; })(),
                footerBand: !!cards[0].querySelector('.expl-shop-actions, .expl-shop-heading'),
                openBtns: cards.map(c => !!q(c, 'button.expl-open[onclick^="explOpenLink"]')),
                openText: cards.map(c => q(c, 'button.expl-open').textContent.trim()),
                allText: grid.innerText,
                coin: cards.map(c => (q(c, '.expl-coin') || {}).textContent || ''),
                logoSize: cards.map(c => Math.round(q(c, '.expl-hero > span').getBoundingClientRect().width)),
            };
        });
        assert.equal(r.n, 6);
        assert.deepEqual(r.feat, [true, false, true, false, false, false], 'the two best UNEARNED shops (10, 10; the earned 10 is skipped) are featured');
        assert.deepEqual(r.earned, [false, true, false, false, false, false]);
        assert.ok(r.cols >= 2, 'two columns on a phone: ' + r.cols);
        assert.ok(r.widths[0] > r.widths[3] * 1.8, 'featured is double-width: ' + r.widths.join(','));
        assert.ok(r.cats[0].includes('Grill') && r.cats[1].includes('Healthy') && r.cats[4] === '' && r.cats[5] === '', 'category label only for a known category: ' + JSON.stringify(r.cats));
        assert.ok(/--bg:#fff1eb/.test(r.tint[0]) && r.tint[4].trim() === '' && r.tint[5].trim() === '', 'tinted by category; none / unknown = neutral');
        assert.equal(r.nameBg, 'rgba(0, 0, 0, 0)', 'the name sits straight on the tile (no band behind it)');
        assert.ok(r.nameInsideTile && !r.footerBand, 'no footer band / heading row any more');
        assert.ok(r.openBtns.every(Boolean) && r.openText.every(t => t === ''), 'the whole-tile Open overlay is a real button with no "Open ↗" label');
        assert.ok(!/Open ↗/.test(r.allText), 'no Open label printed');
        assert.deepEqual(r.coin, ['🪙 +10', '', '🪙 +10', '🪙 +8', '🪙 +8', '🪙 +9'], 'earned shop shows no badge (the missing +N is the signal)');
        assert.ok(r.logoSize[0] === 60 && r.logoSize[3] === 46, 'logo 60 on featured, 46 on the rest: ' + r.logoSize.join(','));

        // clicks: the tile opens; the tools do not. Real mouse clicks at the point where a finger would land (and the hit element is checked first).
        const hit = async (cardIdx, sel, fx, fy) => page.evaluate(([i, sel, fx, fy]) => {
            const card = document.querySelectorAll('#explore-links-list .expl-shop-card')[i];
            card.scrollIntoView({ block: 'center' });
            const el = sel ? card.querySelector(sel) : card, r = el.getBoundingClientRect();
            const x = r.left + r.width * fx, y = r.top + r.height * fy, top = document.elementFromPoint(x, y);
            return { x, y, cls: top && (top.className || top.tagName), isTarget: !!top && (top === el || el.contains(top)) };
        }, [cardIdx, sel, fx, fy]);
        let h = await hit(3, '', 0.5, 0.8);   // the lower middle of the Emily tile (over its name / background)
        assert.ok(/expl-open/.test(h.cls), 'a tap on the tile body lands on the Open overlay: ' + JSON.stringify(h));
        await page.mouse.click(h.x, h.y);
        const afterTile = await page.evaluate(() => window.__opened.slice());
        assert.deepEqual(afterTile, ['d'], 'tapping the tile opens that shop');
        await page.evaluate(() => { window.__opened = []; window.explCopyLink = () => { window.__copied = 1; }; window.openExploreReviewModal = () => { window.__rev = 1; }; });
        h = await hit(3, 'button[aria-label="Copy link"]', 0.5, 0.5);
        assert.ok(h.isTarget, 'the copy icon is hit-testable above the overlay: ' + JSON.stringify(h));
        await page.mouse.click(h.x, h.y);
        h = await hit(3, 'button[aria-label="Write a review"]', 0.5, 0.5);
        assert.ok(h.isTarget, 'the review icon is hit-testable above the overlay: ' + JSON.stringify(h));
        await page.mouse.click(h.x, h.y);
        const tools = await page.evaluate(() => ({ opened: window.__opened.slice(), copied: window.__copied, rev: window.__rev }));
        assert.deepEqual(tools.opened, [], 'copy / review icons never open the shop');
        assert.ok(tools.copied === 1 && tools.rev === 1, 'the tools still work');

        // tooltip kept on the overlay (explore-open-tooltip-qa asserts the wording)
        assert.ok(await page.locator('.expl-shop-card').first().locator('button.expl-open').getAttribute('title').then(t => /Earn once per shop/.test(t)));

        // narrow phone: one column, no horizontal scroll
        await page.setViewportSize({ width: 320, height: 800 });
        const narrow = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, spans: [...document.querySelectorAll('#explore-links-list .expl-shop-card')].map(c => Math.round(c.getBoundingClientRect().right)).every(x => x <= 320) }));
        assert.ok(narrow.over <= 1 && narrow.spans, '320px: nothing sticks out ' + JSON.stringify(narrow));
        // desktop
        await page.setViewportSize({ width: 1100, height: 900 });
        const wide = await page.evaluate(() => getComputedStyle(document.getElementById('explore-links-list')).gridTemplateColumns.split(' ').length);
        assert.ok(wide >= 4, 'desktop: 4+ columns, got ' + wide);

        assert.deepEqual(errors.filter(e => !/firebase\.|Cannot read properties of undefined/.test(e)), [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Explore tiles — one tinted surface, whole tile opens, featured = 2 best unearned, earned dim, neutral without category, 1 / 2 / 4+ columns');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
