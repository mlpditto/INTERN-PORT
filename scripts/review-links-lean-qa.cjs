// V102.128: lean Explore Links admin cards — 48 px logo, name/logo open Edit, icon-only pause + delete.
// Runs the real renderReviewLinksAdmin + the list's <style> from admin.html next to admin.html's own global styles
// (the `button{width:100%}` rule is the trap the .rl-* buttons must survive).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const fnStart = html.indexOf('function rlLogoDisc(');
const fnEnd = html.indexOf('function rlPaintLogo()');
const rStart = html.indexOf('function renderReviewLinksAdmin()');
const rEnd = html.indexOf('// V102.74: logo disc for the admin list');
const styleOpen = html.indexOf('<style>', html.indexOf('V102.128: `all:unset`'));
const listStyle = html.slice(styleOpen, html.indexOf('</style>', styleOpen) + 8);
assert.ok(fnStart > 0 && fnEnd > fnStart && rStart > 0 && rEnd > rStart && styleOpen > 0, 'anchors found');
const globalStyles = Array.from(html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi), m => m[0]).join('\n');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 940, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent(globalStyles + listStyle + '<div id="review-links-list" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:880px"></div>');
        await page.evaluate(({ fns, render }) => {
            window.calls = [];
            window.reviewLinksCache = [
                { id: 'a1', title: 'ข้าวด้ง (Khao Don)', url: 'https://lin.ee/NbqsOxE?lmaff=1', type: 'line_man', beriReward: 10, isActive: true },
                { id: 'b2', title: '<b>Tricky</b> & "Co"', url: 'http://example.test/x', type: 'other', beriReward: 8, isActive: false },
                { id: 'c3', title: 'A very long shop name that must be cut off with an ellipsis instead of pushing the icons out', url: 'https://lin.ee/' + 'x'.repeat(60), type: 'line_man', beriReward: 9 },
            ];
            window.REVIEW_LINK_TYPE_ICON = { line_man: '🛍️', youtube: '▶️', other: '🔗' };
            window.rlUpdateBulkBtn = () => {};
            window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
            window.openReviewLinkModal = id => calls.push(['edit', id]);
            window.toggleReviewLinkActive = (id, cur) => calls.push(['toggle', id, cur]);
            window.deleteReviewLink = id => calls.push(['delete', id]);
            const s = document.createElement('script'); s.textContent = fns + '\n' + render + '\nwindow.renderReviewLinksAdmin=renderReviewLinksAdmin;'; document.head.appendChild(s);
            renderReviewLinksAdmin();
        }, { fns: html.slice(fnStart, fnEnd), render: html.slice(rStart, rEnd) });

        const cards = page.locator('#review-links-list > div');
        assert.equal(await cards.count(), 3);
        // no text buttons any more
        const text = await page.locator('#review-links-list').innerText();
        assert.doesNotMatch(text, /\b(Edit|Delete|Active|Paused)\b/);
        // geometry: lean card, 48 px logo, 28 px icon buttons, nothing wider than its card
        const g = await page.evaluate(() => {
            const card = document.querySelector('#review-links-list > div').getBoundingClientRect();
            const logo = document.querySelector('.rl-open > span').getBoundingClientRect();
            const ic = [...document.querySelectorAll('.rl-ic')].map(e => Math.round(e.getBoundingClientRect().width));
            const overflow = [...document.querySelectorAll('#review-links-list > div')].map(c => c.scrollWidth > c.clientWidth + 1);
            return { cardH: Math.round(card.height), logo: Math.round(logo.width), ic, overflow };
        });
        assert.ok(g.cardH <= 80, 'card height ' + g.cardH);
        assert.equal(g.logo, 48);
        assert.deepEqual(g.ic, [28, 28, 28, 28, 28, 28]);
        assert.deepEqual(g.overflow, [false, false, false]);
        // clicks: logo and name open Edit, eye toggles with the current state, trash deletes — ids pass through
        await page.locator('.rl-name').nth(0).click();
        await page.locator('.rl-open').nth(0).click();
        await page.locator('.rl-ic.on').first().click();
        await page.locator('.rl-ic.off').click();
        await page.locator('.rl-ic.del').nth(1).click();
        assert.deepEqual(await page.evaluate(() => calls), [['edit', 'a1'], ['edit', 'a1'], ['toggle', 'a1', true], ['toggle', 'b2', false], ['delete', 'b2']]);
        // paused card is dimmed with the slashed eye; markup in a title stays text
        assert.equal(await cards.nth(1).evaluate(e => getComputedStyle(e).opacity), '0.55');
        assert.equal(await cards.nth(1).locator('.fa-eye-slash').count(), 1);
        assert.equal(await page.locator('#review-links-list b').count(), 0);
        assert.match(await cards.nth(1).innerText(), /<b>Tricky<\/b> & "Co"/);
        assert.deepEqual(errors, []);
        console.log('PASS: lean Explore Links cards — icon-only actions, 48 px logo, name/logo open Edit, no overflow, titles escaped');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
