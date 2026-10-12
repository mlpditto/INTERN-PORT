// V101.118: the intern toast fits its message — the REAL #toast CSS + showToast() from index.html (same as admin's V102.123 fix).
// "🔥 5 · เช็คอินแล้ว" used to sit in a 250 px pill with dead black space on one side; now it is a small centred pill with even padding,
// and a long message wraps only at the min(90vw, 560 px) cap.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 40)); return html.slice(i, j); };
const css = slice('        #toast {', '        @keyframes toast-fadein') ;
const fn = slice('        function showToast(m) {', '        // Markdown renderer');
assert.ok(!/min-width:\s*250px/.test(css) && css.includes('width: max-content;'), 'no 250 px floor, max-content width');
(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [390, 1100]) {
            const page = await browser.newPage({ viewport: { width: vw, height: 700 } });
            await page.setContent(`<meta charset="utf-8"><style>body{margin:0}${css}</style><div id="toast" class="lang-no-toggle"></div>`);
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
            const short = await measure('🔥 5 · เช็คอินแล้ว');
            assert.ok(short.w < 200, 'short message → small pill, got ' + short.w + ' px @' + vw);
            assert.ok(Math.abs(short.centre - vw / 2) <= 1, 'stays centred @' + vw);
            assert.ok(short.gap <= 12 && short.left >= 14 && short.right >= 8 && short.right <= 14, 'tight, even padding: ' + JSON.stringify(short));
            assert.ok(short.h < 48, 'one line @' + vw);
            const long = await measure('บันทึกไม่สำเร็จ — การอัปโหลดรูปภาพหยุดกลางคันเพราะสัญญาณหลุด กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดบันทึกอีกครั้ง และถ้ายังไม่ได้ให้ลองใหม่ภายหลังอีกครั้งหนึ่งนะ');
            const cap = Math.min(vw * 0.9, 560);
            assert.ok(long.w <= cap + 1 && long.w > cap * 0.85, `long message uses the cap (${long.w} of ${Math.round(cap)}) @${vw}`);
            await page.close();
        }
        console.log('PASS: intern toast fits its message — "🔥 5 · เช็คอินแล้ว" is a small centred pill with even padding, long messages wrap only at min(90vw, 560 px) (390 / 1100 px)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
