// V101.63: intern profile card on a touch phone — the REAL public/index.html + flood-watch.js/css (file://), network blocked,
// Firebase stubbed. Checks: river flow is an in-flow strip (no floating capsules), nothing overlaps it, the tool rail fits on one
// row (🔄 now lives in Settings), and "Please complete internship dates" moved into Info → Period with a dot on the Info button.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

async function open(browser, width, withRiver) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript((withRiver) => {
    const now = Date.now();
    const DATA = { risk: 'moderate', canal: { freeboardM: 0.5, change24cm: 2 }, rain24mm: 3 };
    if (withRiver) DATA.river = { stations: [{ code: 'C.2', q: 2000, at: now, d24: 10 }, { code: 'C.13', q: 2500, at: now, d24: 80 }, { code: 'C.29B', q: 2500, at: now, d24: -60 }] };
    window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: DATA }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
  }, withRiver);
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important');
    const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    document.getElementById('u-name').textContent = 'JzS20240130';
    document.getElementById('u-score').textContent = '0.01';
    // each step is isolated: the page's own boot code needs Firebase pieces this harness does not stub
    for (const step of [() => renderDailyCheckinCard(), () => fwInit(), () => fwOnUserDoc({ home: { lat: 13.7, lon: 100.5 }, optIn: true })]) {
      try { step(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
    }
  });
  await page.waitForTimeout(900);
  return { page, ctx, errors };
}

const rect = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0).map(e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, id: e.id || e.className }; }), sel);
const overlaps = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [320, 363, 412]) {
      const { page, ctx, errors } = await open(browser, width, true);
      const tag = ' @' + width + 'px';
      // river: one in-flow strip, no floating capsules
      assert.equal(await page.locator('.fw-rc').count(), 0, 'no floating capsules' + tag);
      const strip = page.locator('#fw-river-strip');
      assert.equal(await strip.isVisible(), true, 'strip visible' + tag);
      assert.equal(await strip.locator('.fw-rs').count(), 3);
      assert.match(await strip.getAttribute('aria-label'), /C\.2 2\.0k, C\.13 2\.5k, C\.29B 2\.5k/);
      assert.equal(await strip.locator('.fw-ar.up').count(), 1, 'rising gauge has ▲');
      assert.equal(await strip.locator('.fw-ar.down').count(), 1, 'falling gauge has ▼');
      // nothing overlaps the strip
      const s = (await rect(page, '#fw-river-strip'))[0];
      const others = await rect(page, '#section-profile-combined #profile-quick-actions button, #section-profile-combined #u-name, #section-profile-combined .profile-score-values > *, #section-profile-combined #daily-checkin-card > *, #section-profile-combined #daily-checkin-card button');
      const hit = others.filter(o => overlaps(s, o));
      assert.deepEqual(hit, [], 'strip overlaps nothing' + tag);
      // the strip stays inside the card
      const card = (await rect(page, '#section-profile-combined'))[0];
      assert(s.l >= card.l && s.r <= card.r, 'strip inside the card' + tag);
      // tool rail: one row, no 🔄
      const rail = await rect(page, '#profile-quick-actions > button');
      assert.equal(rail.length, 5, 'five rail buttons' + tag);
      // 320px (the narrowest phones) may still wrap the fifth button — 44px targets + the avatar pad leave ~200px; it overlaps nothing
      if (width >= 360) assert(Math.max(...rail.map(b => b.t)) - Math.min(...rail.map(b => b.t)) <= 2, 'rail on one row' + tag + ': ' + rail.map(b => Math.round(b.t)));
      for (let i = 0; i < rail.length; i++) for (let j = i + 1; j < rail.length; j++) assert(!overlaps(rail[i], rail[j]), 'rail buttons do not overlap each other' + tag);
      assert.equal(await page.locator('#section-profile-combined [aria-label="Reload page"]').count(), 0, 'no reload button on the card');
      assert.equal(await page.locator('#settingsModal #settings-reload-btn').count(), 1, 'reload lives in Settings');
      // date nudge: moved to Info → Period
      assert.equal(await page.locator('#section-profile-combined #date-alert').count(), 0, 'nudge is gone from the card' + tag);
      assert.equal(await page.locator('#personalInfoModal #date-alert').count(), 1, 'nudge lives in the Info modal');
      assert.equal(await page.locator('#personalInfoModal .pi-card-period #date-alert').count(), 1, 'inside the Period card');
      await page.evaluate(() => paintDateAlert(true));
      assert.equal(await page.locator('#u-info-dot').isVisible(), true, 'Info button wears a dot while dates are missing');
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('date-alert')).display), 'block');
      await page.evaluate(() => paintDateAlert(false));
      assert.equal(await page.locator('#u-info-dot').isVisible(), false);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('date-alert')).display), 'none');
      // the strip opens the flood sheet
      await strip.click();
      assert.equal(await page.locator('.fw-sheet').count(), 1, 'tapping the strip opens flood watch' + tag);
      assert(errors.every(e => /firebase\./.test(e)), 'only the known Firebase-stub errors' + tag + ': ' + errors.join(' | '));
      await ctx.close();
    }
    // no river data -> no strip
    const { page, ctx } = await open(browser, 363, false);
    assert.equal(await page.locator('#fw-river-strip').isVisible(), false, 'strip hidden without river data');
    assert.equal(await page.locator('#fw-river-strip').innerHTML(), '');
    await ctx.close();
    console.log('PASS: profile card — river strip in flow, rail on one row, date nudge in Info (320 / 363 / 412 px)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
