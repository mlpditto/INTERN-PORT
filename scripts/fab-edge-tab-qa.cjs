// V101.177: the intern ＋ is a sunset tab on the right edge (was a 64px pulsing circle at bottom:30px that sat under
// the iPhone Safari bottom bar). The REAL public/index.html on a touch phone (file://, network blocked, Firebase stubbed).
// Checks: tab shape/place, no pulse, viewport-fit=cover, the footer is only the version on the tab's row,
// the tab slides into the edge on scroll down and comes back on scroll up and at the end of the page.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const FILE = path.resolve('public/index.html');
const INDEX = pathToFileURL(FILE).href;
const VERSION = fs.readFileSync(FILE, 'utf8').match(/<title>[^<]*(V\d+\.\d+)/)[1];

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      // a long page, like a real intern home with its cards
      document.getElementById('main-app').insertAdjacentHTML('afterbegin', '<div id="qa-filler" style="height:2400px"></div>');
    });

    assert.match(await page.getAttribute('meta[name="viewport"]', 'content'), /viewport-fit=cover/, 'viewport-fit=cover so env(safe-area-inset-bottom) is reported on iPhone');

    const tab = () => page.evaluate(() => {
      const b = document.getElementById('unified-fab-btn'), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, anim: cs.animationName, bg: cs.backgroundImage, radius: cs.borderRadius, away: b.classList.contains('fab-away') };
    });
    let t = await tab();
    assert.equal(Math.round(t.r), 390, 'tab touches the right edge');
    assert.equal(Math.round(t.w), 48); assert.equal(Math.round(t.h), 52);
    assert.equal(Math.round(844 - t.b), 20, 'tab sits 20px above the bottom (+ safe-area on iPhone)');
    assert.equal(t.anim, 'none', 'no pulse animation');
    assert.match(t.bg, /linear-gradient/, 'sunset gradient');
    assert.match(t.radius, /^16px 0px 0px 16px$/, 'rounded on the left only: ' + t.radius);
    assert.equal(await page.locator('#unified-fab-btn').getAttribute('onmouseover'), null, 'no mouse-hover rotate handlers (a tap fired them on phones)');

    // footer: only the version, small, no spacer above it
    const foot = await page.evaluate(() => {
      const f = document.getElementById('intern-footer-line'), prev = f.previousElementSibling;
      return { text: f.innerText.trim(), fs: getComputedStyle(f).fontSize, nameShown: document.getElementById('intern-app-name').offsetParent !== null, prevH: prev && prev.style.height };
    });
    assert.equal(foot.text, VERSION, 'footer shows only the version');
    assert.equal(foot.fs, '11px');
    assert.equal(foot.nameShown, false, 'app name hidden (kept in the DOM for cafe-content.js)');
    assert.notEqual(foot.prevH, '50px', 'the 50px spacer is gone');

    // scroll behaviour
    const scrollTo = async y => { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(120); };
    await scrollTo(200); await scrollTo(600);
    assert.equal((await tab()).away, true, 'scrolling down slides the tab away');
    await page.waitForTimeout(350);
    assert(Math.round((await tab()).l) >= 390, 'tab is off-screen while away');
    await scrollTo(500);
    assert.equal((await tab()).away, false, 'scrolling up brings it back');
    await scrollTo(900);
    assert.equal((await tab()).away, true);
    await scrollTo(1e6);
    t = await tab();
    assert.equal(t.away, false, 'at the end of the page the tab is back');
    await page.waitForTimeout(350);
    t = await tab();
    const row = await page.evaluate(() => { const r = document.getElementById('intern-footer-line').getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
    assert(Math.abs((row.t + row.b) / 2 - (t.t + t.b) / 2) <= 6, `footer row lines up with the tab at the end (row ${Math.round(row.t)}-${Math.round(row.b)}, tab ${Math.round(t.t)}-${Math.round(t.b)})`);

    await ctx.close();
    console.log('PASS: ＋ edge tab — right edge, 48×52, no pulse, hides on scroll down / back on scroll up + at the end; footer = ' + VERSION + ' on the tab row');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
