// V102.597 Case Card Studio tour (owner 2026-11-06: a step-by-step teaching animation on this page). The REAL admin.html, network blocked.
// Opens by itself the first time the Studio shows (once per browser), 8 steps each ringing its own part, ‹ / ถัดไป › / ข้าม / Esc,
// Esc closes only the tour (not the Studio), the ? beside the title replays it. OUTDIR=… saves a screenshot per step.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = require('url').pathToFileURL(path.join(process.cwd(), 'public/admin.html')).href;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(ADMIN, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('#ct-replay').count(), 1, 'a ? beside the Studio title');
        assert.equal(await page.locator('#caseStudioTour').count(), 0, 'no tour while the Studio is closed');
        // open the Studio → the tour starts by itself (first time on this browser)
        await page.evaluate(() => { document.getElementById('alabasta-case-card-safe-summary').value = 'A man in his late 40s with epigastric discomfort for 2-3 days.'; const m = document.getElementById('alabastaCaseCardModal'); m.style.setProperty('display', 'flex', 'important'); m.style.setProperty('z-index', '100000', 'important'); });
        await page.waitForSelector('#caseStudioTour .ct-tip', { timeout: 5000 });
        assert.equal(await page.evaluate(() => localStorage.getItem('caseStudioTourSeen')), '1', 'remembered: once per browser');
        const rings = [];
        for (let i = 0; i < 8; i++) {
            await page.waitForTimeout(450);
            const s = await page.evaluate(() => {
                const ring = document.querySelector('#caseStudioTour .ct-ring'), tip = document.querySelector('#caseStudioTour .ct-tip');
                const r = ring.style.display === 'none' ? null : ring.getBoundingClientRect(), t = tip.getBoundingClientRect();
                return { step: tip.querySelector('.ct-step').innerText, title: tip.querySelector('.ct-t').innerText, ring: r ? [Math.round(r.width), Math.round(r.height)] : null,
                         inView: t.left >= 0 && t.top >= 0 && t.right <= innerWidth && t.bottom <= innerHeight, overlap: r ? !(t.right < r.left || t.left > r.right || t.bottom < r.top || t.top > r.bottom) : false, thai: /[฀-๿]/.test(tip.innerText) };
            });
            rings.push(s);
            assert.ok(s.step.startsWith((i + 1) + ' / 8'), 'step ' + (i + 1) + ': ' + s.step);
            assert.ok(s.ring && s.ring[0] > 20 && s.ring[1] > 20, 'step ' + (i + 1) + ' rings a part of the Studio: ' + JSON.stringify(s));
            assert.ok(s.inView, 'the card stays on screen at step ' + (i + 1)); assert.equal(s.overlap, false, 'the card does not cover what it explains (step ' + (i + 1) + ')');
            assert.ok(s.thai, 'Thai is visible (lang-no-toggle)');
            if (process.env.OUTDIR) await page.screenshot({ path: process.env.OUTDIR + '/tour-' + (i + 1) + '.png' });
            if (i < 7) await page.click('#caseStudioTour .ct-next');
        }
        assert.equal(await page.locator('#caseStudioTour .ct-next').innerText(), 'เข้าใจแล้ว ✓', 'the last step ends it');
        await page.click('#caseStudioTour .ct-back');
        assert.ok((await page.locator('#caseStudioTour .ct-step').innerText()).startsWith('7 / 8'), '‹ goes back');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#caseStudioTour').count(), 0, 'Esc closes the tour');
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('alabastaCaseCardModal')).display), 'flex', '… but not the Studio');
        // closing and reopening the Studio does not start it again; the ? does
        await page.evaluate(() => { const m = document.getElementById('alabastaCaseCardModal'); m.style.setProperty('display', 'none', 'important'); });
        await page.evaluate(() => { const m = document.getElementById('alabastaCaseCardModal'); m.style.setProperty('display', 'flex', 'important'); });
        await page.waitForTimeout(1000);
        assert.equal(await page.locator('#caseStudioTour').count(), 0, 'seen once → not again by itself');
        await page.click('#ct-replay');
        assert.equal(await page.locator('#caseStudioTour .ct-tip').count(), 1, '? replays it');
        await page.click('#caseStudioTour .ct-skip');
        assert.equal(await page.locator('#caseStudioTour').count(), 0, 'ข้าม closes it');
        assert.deepEqual(errors.filter(e => /tour/i.test(e)), [], 'no tour errors');
        console.log('PASS: Case Card Studio tour — opens once by itself, 8 steps each ringing its own part (card on screen, never over the target, Thai shown), ‹ / ถัดไป / ข้าม, Esc closes only the tour, ? replays');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
