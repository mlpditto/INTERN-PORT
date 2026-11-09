// V101.299 (owner pick B, less text — mockup-cert-steps.html): the day bar's right label carries the certificate step instead of
// "18 days left" (the big 18d stays): 🏅 +n to go · 🎓 Request (tap = request) · ⏳ sent · ⬇️ PDF (tap = the PDF sheet); 🎓 pinned at the bar's end.
// The REAL index.html on a phone (363 px, touch), Firebase stubbed.   node scripts/cert-step-bar-qa.cjs [shots-dir]
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const SHOTS = process.argv[2];
(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 363, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } }; localStorage.setItem('certTourSeen', '1'); });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.getElementById('u-name').textContent = 'NATT OFFICIAL';
            window.__calls = []; window.requestCertificateFromLIFF = () => __calls.push('request'); window.openMyCertSheet = () => __calls.push('sheet');
            try { renderDailyCheckinCard(); } catch (e) { }
        });
        const rem = '#u-tl-remaining';
        // before the step is known: the old days-left label
        await page.evaluate(([s, e]) => updateTimelineBar(s, e, 18.4, { displayName: 'N' }), [day(-21), day(18)]);
        assert.match(await page.textContent(rem), /days left/, 'no step yet → days left');
        assert.equal(await page.locator('#u-tl-pin').isHidden(), true);

        const set = (d, shot) => page.evaluate(d => { document.getElementById('u-score').textContent = d.score.toFixed(2); updateTimelineBar(d.startDate, d.endDate, d.score, d); checkGraduation(d); }, d)
            .then(() => SHOTS && page.locator('#section-profile-combined').screenshot({ path: path.join(SHOTS, shot + '.png') }));
        const base = { startDate: day(-21), endDate: day(18) };

        // 0 · below the gate: 🏅 +n to go, pin greyed, no button
        await set({ ...base, score: 3 }, 'B0');
        const need = await page.evaluate(([s, e]) => certRequiredPoints(s, e), [base.startDate, base.endDate]);
        assert.equal(await page.textContent(rem), '🏅 +' + (Math.ceil((need - 3) * 10) / 10).toFixed(1));
        assert.match(await page.getAttribute(rem, 'title'), /more pts for your certificate/);
        assert.equal(await page.locator(rem + ' button').count(), 0);
        assert.deepEqual(await page.evaluate(() => { const p = document.getElementById('u-tl-pin'); return [p.hidden, p.classList.contains('dim')]; }), [false, true]);
        // the label stays after a date-driven redraw (updateTimelineBar alone)
        await page.evaluate(([s, e]) => updateTimelineBar(s, e), [base.startDate, base.endDate]);
        assert.match(await page.textContent(rem), /^🏅 \+/, 'a redraw keeps the step');

        // 1 · ready: 🎓 Request, tap = request
        await set({ ...base, score: 32.79 }, 'B1');
        assert.equal(await page.textContent(rem), '🎓 Request');
        assert.equal(await page.evaluate(() => document.getElementById('u-tl-pin').classList.contains('dim')), false);
        await page.click(rem + ' button.cs-step.ready');
        // 2 · sent: ⏳ only, not a button
        await set({ ...base, score: 32.79, certRequested: true }, 'B2');
        assert.equal(await page.textContent(rem), '⏳');
        assert.equal(await page.locator(rem + ' button').count(), 0);
        assert.match(await page.getAttribute(rem + ' .cs-step', 'aria-label'), /waiting for the admin/);
        // 3 · approved: ⬇️ PDF, tap = the PDF sheet
        await set({ ...base, score: 32.79, certRequested: true, certApproved: true }, 'B3');
        assert.equal(await page.textContent(rem), '⬇️ PDF');
        await page.click(rem + ' button.cs-step.ok');
        assert.deepEqual(await page.evaluate(() => __calls), ['request', 'sheet']);

        // fits: the label row stays one line, the pill does not push past the card, no side scroll
        const fit = await page.evaluate(() => {
            const r = document.querySelector('#u-tl-remaining').getBoundingClientRect(), c = document.getElementById('section-profile-combined').getBoundingClientRect(), b = document.querySelector('#u-tl-remaining .cs-step').getBoundingClientRect();
            return { inCard: r.right <= c.right, h: Math.round(b.height), scroll: document.documentElement.scrollWidth <= innerWidth };
        });
        assert.deepEqual(fit, { inCard: true, h: 22, scroll: true }, JSON.stringify(fit));
        assert.deepEqual(errors.filter(e => !/firebase\.|db is not defined|reading 'collection'/.test(e)), []);
        await ctx.close();
        console.log('PASS cert-step-bar-qa: day bar right label = 🏅 +n · 🎓 Request (tap) · ⏳ · ⬇️ PDF (tap); 🎓 pin greyed below the gate; survives a date redraw; fits a 363 px phone');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
