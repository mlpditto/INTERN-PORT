// V101.336 (mobile-native fix 1 + 2, mockup-mobile-native/): the REAL public/index.html (file://, network blocked, Firebase stubbed)
// on a touch phone and on a desktop with a mouse.
//  1. touch: every text field is at least 16px so iOS does not zoom into it (the fin amount and the enroll code keep their bigger size);
//     desktop: field sizes are unchanged.
//  2. the hover rules that lift, scale or look "selected" fire with a mouse only — a tap on a phone leaves nothing stuck.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const GATED = [
  '#assignments-container .assignment-card:hover', '.poll-option-btn:hover:not(:disabled)', '.avatar-circle:hover',
  '.cs-sys-card:hover', '.cs-sys-card:hover .cs-sys-emoji', '.pl-chip:hover', '.mood-btn:hover', '.tool-tag-btn:hover',
  '.lean-kpi:hover', '.j-card:hover', '.dc-discussion-send:hover:not(:disabled)', '.dc-sec-chip:hover',
];

async function open(browser, touch) {
  const ctx = await browser.newContext(touch
    ? { viewport: { width: 375, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
    // index.html reloads itself 15 s after load without LIFF — keep the page still for the test
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms, ...a) { if (ms === 15000 && /location\.reload/.test(String(fn))) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important');
    const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    // probes: the fields the audit found under 16px + one hover target, in a plain visible box at the top
    const box = document.createElement('div');
    box.id = 'qa-probe';
    box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fff;padding:20px;font-size:16px';
    box.innerHTML = '<textarea class="dc-discussion-input" id="qa-dc"></textarea>'
      + '<div class="dc-submit-field"><input id="qa-submit" type="text"></div>'
      + '<input id="qa-check" type="checkbox">'
      + '<div style="padding:30px"><img class="avatar-circle" id="qa-av" alt="" style="display:inline-block;background:#ddd"></div>';
    document.body.appendChild(box);
    // the fin amount field is drawn when the modal opens — add one of the same shape
    document.getElementById('finModal').insertAdjacentHTML('beforeend', '<div class="fin-amt"><input id="qa-fin" type="number"></div>');
  });
  return { page, ctx };
}

const px = (page, sel) => page.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), sel);
const transform = (page, sel) => page.evaluate(s => getComputedStyle(document.querySelector(s)).transform, sel);

(async () => {
  const browser = await chromium.launch();
  let enrollDesktop = 0;
  try {
    // every gated hover rule sits inside the mouse-only media query, and nowhere else
    {
      const { page, ctx } = await open(browser, false);
      const found = await page.evaluate((gated) => {
        const out = {};
        const walk = (rules, media) => { for (const r of rules) {
          if (r.cssRules && r.media) walk(r.cssRules, r.media.mediaText);
          else if (r.selectorText && gated.includes(r.selectorText)) (out[r.selectorText] = out[r.selectorText] || []).push(media);
        } };
        for (const sh of document.styleSheets) { try { walk(sh.cssRules, ''); } catch (_) {} }
        return out;
      }, GATED);
      for (const sel of GATED) {
        assert.deepEqual(found[sel], ['(hover: hover) and (pointer: fine)'], sel + ' lives only under the mouse-only query: ' + JSON.stringify(found[sel]));
      }
      enrollDesktop = await px(page, '#enroll-code-input');
      assert(enrollDesktop > 16, 'enroll code is bigger than 16px to begin with (' + enrollDesktop + ')');
      await ctx.close();
    }

    // phone
    {
      const { page, ctx } = await open(browser, true);
      assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the harness phone reports a coarse pointer');
      assert.equal(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), false, 'and no mouse hover');
      for (const sel of ['#qa-dc', '#qa-submit', '#sne-date', '#sne-start']) {
        assert((await px(page, sel)) >= 16, sel + ' is at least 16px on touch (got ' + (await px(page, sel)) + ')');
      }
      assert.equal(await px(page, '#qa-fin'), 20, 'the fin amount keeps its 1.25em');
      assert.equal(await px(page, '#enroll-code-input'), enrollDesktop, 'the enroll code keeps its own size');
      await page.locator('#qa-av').tap();
      await page.waitForTimeout(350);
      assert.equal(await transform(page, '#qa-av'), 'none', 'a tapped avatar does not stay scaled');
      if (process.env.QA_SHOT) await page.screenshot({ path: process.env.QA_SHOT });
      await ctx.close();
    }

    // desktop with a mouse: sizes as before, hover still works
    {
      const { page, ctx } = await open(browser, false);
      assert.equal(await px(page, '#qa-dc'), 16 * 0.9, 'desktop keeps the 0.9em discussion box');
      await page.locator('#qa-av').hover();
      await page.waitForTimeout(350);
      assert.notEqual(await transform(page, '#qa-av'), 'none', 'mouse hover still scales the avatar');
      await ctx.close();
    }
    console.log('mobile-native-touch-qa: PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('mobile-native-touch-qa: FAIL\n', e); process.exit(1); });
