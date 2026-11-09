// V101.294 (owner): the 🏅 ring is the certificate request — icon only (pick 3): 🎓 ready · ⏳ sent · 🎓✓ approved; below the points gate the
// request opens on the last day of the internship; the first time it is ready a 2-step how-to (pick A, cert-tour.js) rings ⋯ then 🎓, once per device.
// The REAL index.html on a phone (390px, touch), Firebase stubbed.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } }; });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.certTourMaybe === 'function' && typeof updateCertificateButton === 'function');
    await page.evaluate(() => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      try { renderDailyCheckinCard(); } catch (e) { /* firebase-less */ }
      localStorage.setItem('certTourSeen', '1');   // states first, the tour later
    });
    const state = (d) => page.evaluate((d) => {
      updateCertificateButton(d);
      const b = document.getElementById('cert-menu-item'), ring = document.getElementById('badge-cert');
      return { shown: b.style.display !== 'none', text: b.textContent, title: b.title, aria: b.getAttribute('aria-label'), cls: ['cert-ready', 'cert-pend', 'cert-ok'].filter(c => ring.classList.contains(c)), clickable: !b.disabled && !!b.onclick };
    }, d);
    const ready = await state({ score: 31.98, startDate: day(-20), endDate: day(18) });
    assert.deepEqual([ready.shown, ready.text, ready.cls, ready.clickable], [true, '🎓', ['cert-ready'], true], 'gate reached: 🎓 only, ring ready, tap = request');
    assert.ok(/Request/.test(ready.title) && /ขอใบรับรอง/.test(ready.aria), 'the words live in title / aria-label');
    const low = await state({ score: 3, startDate: day(-20), endDate: day(18) });
    assert.deepEqual([low.shown, low.cls], [false, []], 'below the gate before the last day: nothing');
    const lastDay = await state({ score: 3, startDate: day(-38), endDate: day(0) });
    assert.deepEqual([lastDay.shown, lastDay.text, lastDay.cls], [true, '🎓', ['cert-ready']], 'below the gate ON the last day: 🎓 ready');
    const after = await state({ score: 0, startDate: day(-50), endDate: day(-3) });
    assert.deepEqual([after.text, after.cls], ['🎓', ['cert-ready']], 'after the last day too');
    const pend = await state({ score: 31.98, startDate: day(-20), endDate: day(18), certRequested: true });
    assert.deepEqual([pend.text, pend.cls, pend.clickable], ['⏳', ['cert-pend'], false], 'sent: ⏳');
    const ok = await state({ score: 31.98, startDate: day(-20), endDate: day(18), certRequested: true, certApproved: true });
    assert.deepEqual([ok.text, ok.cls, ok.clickable], ['🎓✓', ['cert-ok'], true], 'approved: 🎓✓, tappable (V101.297: opens the ⬇️ PDF sheet)');
    // the grad slot on the card: from the last day for everyone
    const grad = await page.evaluate(([s, e]) => { checkGraduation({ score: 1, startDate: s, endDate: e }); const g = document.getElementById('grad-action'); return [g.style.display, /requestCert\(\)/.test(g.innerHTML)]; }, [day(-38), day(0)]);
    assert.deepEqual(grad, ['', true], 'last day, 1 point: the card shows Request Cert');
    const gradBefore = await page.evaluate(([s, e]) => { checkGraduation({ score: 99, startDate: s, endDate: e }); return document.getElementById('grad-action').style.display; }, [day(-20), day(18)]);
    assert.equal(gradBefore, 'none', 'before the last day the card slot stays hidden (the ring is the way in)');
    // the ring on the month head: the button stays inside the 30px circle (it used to spill "Request Certificate" over the month)
    await state({ score: 31.98, startDate: day(-20), endDate: day(18) });
    await page.evaluate(() => { const m = document.getElementById('activity-more'); if (m.getAttribute('aria-expanded') !== 'true') m.click(); });
    await page.waitForTimeout(200);
    const fit = await page.evaluate(() => {
      const r = document.getElementById('badge-cert').getBoundingClientRect(), b = document.getElementById('cert-menu-item').getBoundingClientRect();
      return { inHead: !!document.querySelector('#monthly-progress .mp-head #badge-cert'), r: [r.width, r.height], inside: b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5, bw: b.width };
    });
    if (fit.inHead) { assert.deepEqual(fit.r, [30, 30], 'ring stays 30px'); assert.ok(fit.inside && fit.bw >= 29, 'the whole ring is the button, nothing spills: ' + JSON.stringify(fit)); }
    // the tour: twice in a row, once only
    await page.evaluate(() => { document.getElementById('activity-more').click(); localStorage.removeItem('certTourSeen'); });
    await state({ score: 31.98, startDate: day(-20), endDate: day(18) });
    await page.waitForSelector('#certTour .ct-tip');
    const ringOn = sel => page.evaluate(sel => { const a = document.querySelector('#certTour .ct-ring').getBoundingClientRect(), b = document.querySelector(sel).getBoundingClientRect(); return a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom; }, sel);
    await page.waitForTimeout(400);
    assert.ok(await ringOn('#activity-more'), 'scene 1 rings ⋯');
    assert.match(await page.textContent('#certTour .ct-t'), /ขอใบ Cert ได้แล้ว/);
    await page.click('#certTour .ct-next');
    await page.waitForTimeout(450);
    assert.equal(await page.getAttribute('#activity-more', 'aria-expanded'), 'true', 'scene 2 opens the details');
    assert.ok(await ringOn('#badge-cert'), 'scene 2 rings the 🎓 ring');
    await page.click('#certTour .ct-next');
    assert.equal(await page.locator('#certTour').count(), 0, 'done closes it');
    assert.equal(await page.evaluate(() => localStorage.getItem('certTourSeen')), '1');
    await state({ score: 31.98, startDate: day(-20), endDate: day(18) });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#certTour').count(), 0, 'once per device');
    assert.deepEqual(errors.filter(e => /cert|Cert/.test(e)), []);
    console.log('PASS: 🏅 ring = cert request (🎓 / ⏳ / 🎓✓, no text, fits the ring), last-day request below the gate, 2-step how-to once per device');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
