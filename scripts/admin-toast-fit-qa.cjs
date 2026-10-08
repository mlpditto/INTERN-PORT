// V102.123: the admin toast fits its message — the REAL #toast CSS + showToast() from admin.html. A short message gives a
// small pill (no 250 px floor, equal air round the text), a long one wraps only at the 560 px / 90 vw cap (not at half the screen).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 40)); return html.slice(i, j); };
const css = slice('        #toast {', '        @keyframes fadein') ;
const fn = slice('        function showToast(m) {', '        async function svSc(');
assert.ok(!/min-width:\s*250px/.test(css) && css.includes('width: max-content;'), 'no 250 px floor, max-content width');
(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [412, 1100]) {
            const page = await browser.newPage({ viewport: { width: vw, height: 700 } });
            await page.setContent(`<style>body{margin:0}${css}</style><div id="toast" class="lang-no-toggle"></div>`);
            await page.addScriptTag({ content: fn });
            const measure = async msg => {
                await page.evaluate(m => showToast(m), msg);
                await page.waitForTimeout(600);
                return page.evaluate(() => {
                    const t = document.getElementById('toast'), m = t.querySelector('.toast-msg'), c = t.querySelector('.toast-close');
                    const tr = t.getBoundingClientRect(), mr = m.getBoundingClientRect(), cr = c.getBoundingClientRect();
                    return { w: Math.round(tr.width), h: Math.round(tr.height), left: Math.round(mr.left - tr.left), right: Math.round(tr.right - cr.right), gap: Math.round(cr.left - mr.right), centre: Math.round(tr.left + tr.width / 2) };
                });
            };
            const short = await measure('Reward saved!');
            assert.ok(short.w < 200, 'short message → small pill, got ' + short.w + ' px @' + vw);
            assert.ok(Math.abs(short.centre - vw / 2) <= 1, 'stays centred @' + vw);
            assert.ok(short.gap <= 12 && short.left >= 14 && short.right >= 8 && short.right <= 14, 'tight, even padding: ' + JSON.stringify(short));
            assert.ok(short.h < 48, 'one line @' + vw);
            const long = await measure('Could not save the reward — the image upload failed because the connection dropped halfway through; check the network and press 💾 again.');
            const cap = Math.min(vw * 0.9, 560);
            assert.ok(long.w <= cap + 1 && long.w > cap * 0.85, `long message uses the cap (${long.w} of ${Math.round(cap)}) @${vw}`);
            await page.close();
        }
        console.log('PASS: admin toast fits its message — "Reward saved!" is a small centred pill with even padding, long messages wrap only at min(90vw, 560 px) (412 / 1100 px)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
