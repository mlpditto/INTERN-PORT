// V101.296: the 🔥 check-in toast closes itself after 10 s — a lighter fill drains to the left (owner pick C).
// REAL #toast CSS + showToast()/toastCountdown() from index.html; the clock is shortened to 1.2 s via toastCountdown(ms).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 40)); return html.slice(i, j); };
const css = slice('        #toast {', '        /* V101.245');
const fn = slice('        function showToast(m) {', '        // Markdown renderer');
assert.match(html, /showToast\(`🔥 \$\{result\.streak\}[^\n]*toastCountdown\(10000\)/, 'check-in toast asks for a 10 s countdown');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
        await page.setContent(`<meta charset="utf-8"><style>body{margin:0}${css}</style><div id="toast" class="lang-no-toggle"></div>`);
        await page.addScriptTag({ content: fn });
        const st = () => page.evaluate(() => { const t = document.getElementById('toast'); return { show: t.classList.contains('show'), timed: t.classList.contains('toast-timed'), size: getComputedStyle(t).backgroundSize.split(',')[0].trim(), vis: getComputedStyle(t).visibility }; });
        const pct = s => parseFloat(s);
        await page.mouse.move(5, 5);

        // 1. plain toast: no drain, stays
        await page.evaluate(() => showToast('Saved'));
        await page.waitForTimeout(1500);
        let s = await st();
        assert.ok(s.show && !s.timed && s.vis === 'visible', 'plain toast stays: ' + JSON.stringify(s));

        // 2. timed: drains, then closes
        await page.evaluate(() => { showToast('🔥 5 · Checked in'); toastCountdown(1200); });
        await page.waitForTimeout(150);
        const a = pct((await st()).size);
        await page.waitForTimeout(450);
        const b = pct((await st()).size);
        assert.ok(a > b && b > 0 && a <= 100, `fill drains (${a}% → ${b}%)`);
        await page.waitForTimeout(900);
        s = await st();
        assert.ok(!s.show && !s.timed && s.vis === 'hidden', 'closes itself: ' + JSON.stringify(s));

        // 3. hover pauses the drain and the close
        await page.evaluate(() => { showToast('🔥 5 · Checked in'); toastCountdown(1200); });
        await page.waitForTimeout(300);
        const box = await page.locator('#toast .toast-msg').boundingBox();
        await page.mouse.move(box.x + 5, box.y + 5);
        const p1 = pct((await st()).size);
        await page.waitForTimeout(1500);
        s = await st();
        assert.ok(s.show && Math.abs(pct(s.size) - p1) < 2, `paused while touched (${p1}% → ${s.size})`);
        await page.mouse.move(5, 5);
        await page.waitForTimeout(1300);
        assert.ok(!(await st()).show, 'resumes and closes after the finger leaves');

        // 4. ✕ still closes at once; a following plain toast is not timed
        await page.evaluate(() => { showToast('🔥 5 · Checked in'); toastCountdown(1200); });
        await page.waitForTimeout(200);
        await page.click('#toast .toast-close');
        assert.ok(!(await st()).show, '✕ closes at once');
        await page.mouse.move(5, 5);   // the pointer left on ✕ would hover-pause the next toast
        await page.evaluate(() => { showToast('🔥 5 · Checked in'); toastCountdown(1200); });
        await page.waitForTimeout(200);
        await page.evaluate(() => showToast('Saved'));
        await page.waitForTimeout(1600);
        s = await st();
        assert.ok(s.show && !s.timed, 'a plain toast replacing a timed one stays: ' + JSON.stringify(s));

        // 5. timed toast replacing a timed one restarts the full clock
        await page.evaluate(() => { showToast('🔥 5 · Checked in'); toastCountdown(1200); });
        await page.waitForTimeout(800);
        await page.evaluate(() => { showToast('🔥 6 · Checked in'); toastCountdown(1200); });
        await page.waitForTimeout(700);
        assert.ok((await st()).show, 'second timed toast gets its own full clock');
        await page.waitForTimeout(800);
        assert.ok(!(await st()).show, 'and then closes');
        console.log('PASS: check-in toast drains and closes itself (pick C); hover/touch pauses; ✕ closes at once; plain toasts still stay until ✕');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
