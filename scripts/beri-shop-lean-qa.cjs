// V102.125: the lean "A Shop for Killers" admin panel — the REAL panel markup + CSS + renderBeriRedemptionsAdmin / give-Beri handlers
// from admin.html, network stubbed. (1) No explanatory paragraph / "Phase 2" / Give label / Pending heading; the stock rule is a tooltip.
// (2) Empty queue = no box and no badge; with 2 pending the badge says 2, the rows sit ABOVE the catalog and the actions are icon-only.
// (3) 🎁 toggles the one-row Give form; a chosen user replaces the search box; a successful give folds the row away, a failed
//     validation does not. (4) Trash is grey and turns red on hover. (5) The panel is short.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return html.slice(i, j); };
const panel = slice('            <div class="lang-no-toggle bs2" id="beri-shop-panel">', '            </div><!-- /subtab-beri-shop -->');
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');
const code = [
    slice('        function renderBeriRewardsAdmin() {', '        // V102.124'),
    slice('        function escapeHtml(value) {', '\n        }\n') + '\n        }\n',
    slice('        function renderBeriRedemptionsAdmin() {', '        async function fulfillBeriRedemption'),
    slice('        let beriGiftUser = null;', '        function renderCertTable() {')
].join('\n');

assert.ok(!/Phase 2|Give Beri to a User|Pending Redemptions|Interns spend Beri here\. Stock is optional \(blank/.test(panel.replace(/title="[^"]*"/g, '')), 'no Phase 2 / Give label / Pending heading / explainer paragraph in visible markup');
assert.ok(panel.includes('title="Interns spend Beri here. Stock is optional: blank = unlimited (no stock counter).">'), 'stock rule lives in the name tooltip');
for (const id of ['beri-gift-chip', 'beri-gift-input', 'beri-gift-suggest', 'beri-gift-amount', 'beri-rewards-list', 'beri-redemptions-list']) assert.ok(panel.includes(`id="${id}"`), 'kept id ' + id);

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 980, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent(`<meta charset="utf-8">${styles}<style>body{margin:0;padding:16px}.subtab-content{display:block!important}</style><div id="subtab-beri-shop" class="subtab-content" style="width:900px">${panel}</div>`);
        await page.addScriptTag({ content: `
            window.log = []; window.alerts = []; window.prompts = [];
            var beriRewardsCache = [{ id: 'a', name: 'SUPER BEAR', beriCost: 2450, stock: 2, isActive: true }, { id: 'b', name: 'Money 100.00', description: 'CLICX or DIME', beriCost: 500, stock: 5, isActive: false }];
            var beriRedemptionsCache = [];
            var usersData = [{ id: 'u1', displayName: 'ธนพร ใจดี', group: 'A', pictureUrl: '' }, { id: 'u2', displayName: 'Napat S.', group: 'A' }];
            window.showToast = m => log.push('toast:' + m); window.alert = m => alerts.push(m); window.prompt = m => { prompts.push(m); return 'bonus'; };
            window.adjBeriCore = (id, v, n) => { log.push('adj:' + id + ':' + v + ':' + n); return Promise.resolve(); };
            window.beriBaht = n => '฿' + Math.round(n * 0.21); window.beriBahtTitle = () => '';
            window.fulfillBeriRedemption = id => log.push('ful:' + id); window.denyBeriRedemption = id => log.push('deny:' + id);
            window.toggleBeriRewardActive = () => {}; window.openBeriRewardModal = () => log.push('add'); window.deleteBeriReward = () => {};
            ${code}
            renderBeriRewardsAdmin(); renderBeriRedemptionsAdmin();
        ` });
        const q = (sel, fn) => page.evaluate(([s, f]) => { const e = document.querySelector(s); return e ? new Function('e', 'return ' + f)(e) : null; }, [sel, fn]);
        const height = () => page.evaluate(() => Math.round(document.getElementById('beri-shop-panel').getBoundingClientRect().height));

        // (1)+(2) empty queue
        assert.equal(await q('#beri-redemptions-list', 'getComputedStyle(e).display'), 'none', 'empty queue draws no box');
        assert.equal(await q('#beri-pend-badge', 'getComputedStyle(e).display'), 'none', 'no badge at 0');
        assert.equal(await q('#beri-give-row', 'getComputedStyle(e).display'), 'none', 'Give row closed by default');
        const text = await q('#beri-shop-panel', 'e.innerText');
        assert.ok(text.includes('A Shop for Killers') && !/Fulfill|Phase|Pending|Give/i.test(text), 'visible text is just the title and the rewards: ' + JSON.stringify(text));
        const hEmpty = await height(); assert.ok(hEmpty < 280, 'empty-queue panel is short: ' + hEmpty);

        // 2 pending
        await page.evaluate(() => { beriRedemptionsCache = [
            { id: 'r1', userId: 'u1', displayName: 'ธนพร ใจดี', rewardName: 'SUPER BEAR', beriCost: 2450 },
            { id: 'r2', userId: 'u2', displayName: 'Napat <b>S.</b>', rewardName: 'Money 100.00', beriCost: 500 }]; renderBeriRedemptionsAdmin(); });
        assert.equal(await q('#beri-pend-badge', 'getComputedStyle(e).display') !== 'none', true); assert.equal((await q('#beri-pend-n', 'e.textContent')), '2');
        assert.equal(await page.locator('.bs2-pend').count(), 2);
        assert.ok(await page.evaluate(() => !!(document.getElementById('beri-redemptions-list').compareDocumentPosition(document.getElementById('beri-rewards-list')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'pending rows sit above the catalog');
        assert.ok((await q('.bs2-pend', 'e.innerText')).includes('ธนพร ใจดี') && (await q('.bs2-pend', 'e.innerText')).includes('2,450'));
        assert.equal(await page.locator('.bs2-pend b >> nth=1').innerText(), 'Napat <b>S.</b>', 'names are escaped');
        for (const b of await page.locator('.bs2-pend button').all()) { assert.equal((await b.innerText()).trim(), '', 'icon-only'); assert.ok(await b.getAttribute('aria-label')); }
        await page.locator('.bs2-ful >> nth=0').click(); await page.locator('.bs2-deny >> nth=1').click();
        assert.deepEqual((await page.evaluate(() => log)).filter(l => /^(ful|deny):/.test(l)), ['ful:r1', 'deny:r2'], '✓ fulfils, ↩ denies, ids intact');
        const hTwo = await height(); assert.ok(hTwo < 400, 'panel with 2 pending is short: ' + hTwo);
        await page.evaluate(() => { beriRedemptionsCache = beriRedemptionsCache.slice(0, 1); renderBeriRedemptionsAdmin(); });
        assert.equal(await q('#beri-pend-badge', 'e.title'), '1 pending redemption', 'singular title');
        await page.evaluate(() => { beriRedemptionsCache = []; renderBeriRedemptionsAdmin(); });
        assert.equal(await q('#beri-pend-badge', 'getComputedStyle(e).display'), 'none', 'badge disappears again'); assert.equal(await q('#beri-redemptions-list', 'getComputedStyle(e).display'), 'none');

        // (3) give row
        await page.locator('#beri-gift-toggle').click();
        assert.notEqual(await q('#beri-give-row', 'getComputedStyle(e).display'), 'none', '🎁 opens the row');
        assert.equal(await q('#beri-gift-toggle', "e.getAttribute('aria-expanded')"), 'true');
        await page.locator('#beri-gift-input').fill('ธน'); await page.evaluate(() => beriGiftInputHandler());
        assert.equal(await page.locator('#beri-gift-suggest > div').count(), 1, 'suggest lists the match');
        await page.locator('#beri-gift-suggest > div').first().click();
        assert.equal(await q('#beri-gift-input', "getComputedStyle(e.parentElement).display"), 'none', 'chip replaces the search box');
        assert.ok((await q('#beri-gift-chip', 'e.innerText')).includes('ธนพร'));
        await page.locator('#beri-gift-amount').fill('');
        await page.evaluate(() => giveBeriToUser());
        assert.deepEqual(await page.evaluate(() => alerts), ['Please specify a Beri amount.']);
        assert.notEqual(await q('#beri-give-row', 'getComputedStyle(e).display'), 'none', 'a failed validation keeps the row open');
        await page.locator('#beri-gift-amount').fill('100'); await page.evaluate(() => giveBeriToUser());
        assert.ok((await page.evaluate(() => log)).includes('adj:u1:100:bonus'), 'same adjBeriCore call as before');
        assert.equal(await q('#beri-give-row', 'getComputedStyle(e).display'), 'none', 'row folds away after a successful give');
        assert.equal(await q('#beri-gift-toggle', "e.getAttribute('aria-expanded')"), 'false');
        assert.equal(await q('#beri-gift-input', "getComputedStyle(e.parentElement).display"), 'block', 'search box is back'); assert.equal(await q('#beri-gift-chip', 'e.innerHTML'), '');
        await page.locator('#beri-gift-toggle').click(); await page.locator('#beri-gift-toggle').click();
        assert.equal(await q('#beri-give-row', 'getComputedStyle(e).display'), 'none', 'toggles back');
        await page.locator('.bs2-add').click(); assert.ok((await page.evaluate(() => log)).includes('add'), '➕ opens the reward modal');

        // (4) trash grey, red on hover (CSS transitions: wait for the colour, not a timer)
        assert.equal(await q('.br-ic-del', 'getComputedStyle(e).color'), 'rgb(148, 163, 184)', 'grey at rest');
        await page.locator('.br-ic-del >> nth=0').hover();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.br-ic-del')).color === 'rgb(220, 38, 38)', null, { timeout: 3000 });
        assert.equal(await q('#beri-rewards-list > div:nth-child(2)', 'getComputedStyle(e).opacity'), '0.55', 'a paused reward is still dimmed');

        assert.deepEqual(errors, []);
        console.log(`PASS: beri shop lean — empty queue ${hEmpty}px / 2 pending ${hTwo}px; pending above catalog with icon-only ✓ ↩; badge; 🎁 one-row Give (chip, validation, folds after success); grey trash`);
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
