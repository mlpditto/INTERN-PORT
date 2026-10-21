// Home ▸ History accordion header: the last totals pill (🪙 Beri) must sit fully inside #work-section-sum,
// which clips with overflow:hidden — its -4px right margin used to cut off the pill's rounded right edge.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vp of [{ width: 1787, height: 600 }, { width: 363, height: 700 }]) {
            const page = await browser.newPage({ viewport: vp });
            await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
            page.on('pageerror', () => {});
            await page.goto(require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href);
            await page.waitForTimeout(400);
            const r = await page.evaluate(() => {
                const host = document.getElementById('section-general-work'); document.body.appendChild(host);
                host.style.cssText = 'display:block!important;position:fixed;inset:0 0 auto 0;z-index:999999;background:#fff';
                const sum = document.getElementById('work-section-sum');
                // same markup history-lean.js renderChrome() mirrors into the header
                // the hidden 30-day sparkline can come after the 🪙 pill
                sum.innerHTML = '<span class="hl-ts">🔥 <b>3</b></span><button type="button" class="hl-tp" aria-expanded="false">5.4<small>pt</small><i class="hl-adj" aria-hidden="true">⚖️</i></button><span class="hl-tb" title="Beri earned on these entries">🪙 <b>4</b></span><span class="hl-spark"><svg width="40" height="16"></svg></span>';
                const box = sum.getBoundingClientRect(), last = sum.querySelector('.hl-tb').getBoundingClientRect();
                return { boxRight: box.right, lastRight: last.right };
            });
            assert.ok(r.lastRight <= r.boxRight + 0.5, `${vp.width}px: 🪙 pill ends inside the header totals (pill ${r.lastRight} > box ${r.boxRight})`);
            await page.close();
        }
        console.log('PASS: History header — 🪙 pill sits fully inside #work-section-sum at desktop and phone width');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
