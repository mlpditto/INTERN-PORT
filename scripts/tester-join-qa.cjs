// V101.384 🧪 tester join on the REAL index.html as a LINE Android phone (vivo V29). Proves: TEST-nnnn typed in Register opens the
// lean tester card (🧪 group · →end) instead of the full form; ✓ Allow device info reads Android 14 · vivo V29 (V2250) · LINE ·
// screen with nothing typed; ▸ Start sends exactly that to claimTester and closes; Skip → 🍎 sends only the OS; a full code says
// so; ?tester= opens it straight from the link; the reader knows an iPhone family by screen and a PC; an ended tester sees
// 🧪 Test ended; English only; 320 px fits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const UA = 'Mozilla/5.0 (Linux; Android 14; V2250 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36 Line/14.19.1/IAB';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 873 }, screen: { width: 393, height: 873 }, isMobile: true, hasTouch: true, userAgent: UA });
  async function open(q) {
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
    await page.addInitScript(() => {
      for (const k of ['internGuideSeen', 'journalTourSeen']) localStorage.setItem(k, '1');
      window.__calls = []; window.__reply = (d) => d.peek ? { label: 'Game test', untilMs: Date.UTC(2026, 11, 4, 5), left: 7 } : { ok: true };
      window.firebase = { auth: () => ({ currentUser: { uid: 'anon1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }),
        functions: () => ({ httpsCallable: (n) => (d) => { window.__calls.push([n, JSON.parse(JSON.stringify(d))]); try { const r = window.__reply(d); return r instanceof Error ? Promise.reject(r) : Promise.resolve({ data: r }); } catch (e) { return Promise.reject(e); } } }),
        firestore: Object.assign(() => { const q = { where: () => q, limit: () => q, orderBy: () => q, get: () => Promise.resolve({ empty: true, docs: [], forEach() {} }), doc: () => q, onSnapshot: () => () => {} }; return { collection: () => q }; }, { FieldValue: { serverTimestamp: () => 0 } }) };
      const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    });
    await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href + (q || ''), { waitUntil: 'load' });
    await page.evaluate(() => { userId = 'U_line'; userProfile = { userId: 'U_line', displayName: 'Mind' }; window.ensureAuthLink = () => Promise.resolve(); });
    return page;
  }
  const page = await open();

  // typed in Register
  await page.evaluate(() => showEnrollmentModal());
  assert.equal(await page.$eval('#enroll-code-input', (e) => e.maxLength), 9, 'TEST-nnnn fits the Register box');
  await page.fill('#enroll-code-input', 'test-4821');
  await page.evaluate(() => claimEnrollmentCode());
  await page.waitForSelector('#tj-allow:not([disabled])');
  assert.equal(await page.$eval('#enrollModal', (m) => getComputedStyle(m).display), 'none', 'the full Register form steps aside');
  assert.match(await page.textContent('#tjModal'), /🧪 Game test\s*→4 Dec/);
  assert.deepEqual(await page.evaluate(() => window.__calls), [['claimTester', { code: 'TEST-4821', peek: true }]]);
  assert.doesNotMatch(await page.textContent('#tjModal'), /[฀-๿]/, 'English only');

  // ✓ Allow → read, nothing typed
  await page.click('#tj-allow');
  await page.waitForSelector('#tj-start');
  const shown = (await page.textContent('#tjModal')).replace(/\s+/g, ' ');
  assert.match(shown, /Android 14/); assert.match(shown, /vivo V29s*V2250/); assert.match(shown, /LINE 14\.19\.1/); assert.match(shown, /393x873/);
  assert.equal(await page.$$eval('#tjModal input', (i) => i.length), 0, 'nothing to type');
  await page.click('#tj-start');
  await page.waitForFunction(() => document.getElementById('tjModal').style.display === 'none');
  const claim = await page.evaluate(() => window.__calls[1]);
  assert.deepEqual(claim, ['claimTester', { code: 'TEST-4821', device: { os: 'android', osVer: '14', model: 'vivo V29', modelCode: 'V2250', line: '14.19.1', screen: '393x873', read: true } }]);

  // Skip → 🍎 · a full code
  await page.evaluate(() => { window.__calls = []; window.__reply = (d) => d.peek ? { label: 'Game test', untilMs: Date.now() + 864e5 } : Object.assign(new Error('full'), { details: { code: 'full' } }); TesterJoin.open('TEST-4821'); });
  await page.waitForSelector('#tj-os-ios:not([disabled])'); await page.click('#tj-os-ios');
  assert.match(await page.textContent('#tj-os'), /🍎\s*iOS/); assert.equal(await page.$('#tj-model'), null, 'skip = OS only');
  await page.click('#tj-start'); await page.waitForSelector('#tj-err');
  assert.equal(await page.textContent('#tj-err'), 'This code is full');
  assert.deepEqual((await page.evaluate(() => window.__calls[1]))[1].device, { os: 'ios', osVer: '', model: '', modelCode: '', line: '', screen: '', read: false });
  await page.click('#tjModal .tj-x');
  assert.equal(await page.$eval('#enrollModal', (m) => getComputedStyle(m).display), 'flex', '✕ goes back to Register');

  // the reader: iPhone family by screen, PC
  const ip = await page.evaluate(() => TesterJoin._read('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.19.0', { w: 390, h: 844 }));
  assert.deepEqual([ip.os, ip.osVer, ip.model, ip.line], ['ios', '17.5', 'iPhone 12–14', '14.19.0']);
  const pc = await page.evaluate(() => TesterJoin._read('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131', { w: 1920, h: 1080 }));
  assert.deepEqual([pc.os, pc.model], ['pc', 'Windows']);
  const k = await page.evaluate(() => TesterJoin._read('Mozilla/5.0 (Linux; Android 10; K) Chrome/131 Mobile', { w: 412, h: 915 }, { model: 'SM-A546E', platformVersion: '14.0.0' }));
  assert.deepEqual([k.model, k.modelCode, k.osVer], ['Galaxy A54', 'SM-A546E', '10'], 'reduced UA: the model comes from the browser hints');

  // an ended tester
  await page.evaluate(() => TesterJoin.check({ isTester: true, testerUntil: Date.now() - 1, testerCode: 'TEST-4821' }));
  assert.match(await page.textContent('#tj-ended'), /Test ended/); assert.equal(await page.$('#tjModal .tj-x'), null, 'no way around it');
  assert.equal(await page.evaluate(() => TesterJoin.check({ isTester: true, testerUntil: Date.now() + 1e6 })), false);
  assert.equal(await page.evaluate(() => TesterJoin.check({ group: 'Junior' })), false, 'interns are never stopped');

  // the LINE link
  const p2 = await open('?tester=TEST-4821');
  await p2.evaluate(() => showEnrollmentModal());
  await p2.waitForSelector('#tj-allow:not([disabled])');
  assert.equal(await p2.$eval('#enrollModal', (m) => getComputedStyle(m).display), 'none', 'the link skips Register');
  await p2.setViewportSize({ width: 320, height: 640 });
  assert.ok(await p2.$eval('#tjModal .tj', (e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= 320), '320 px fits');
  assert.deepEqual(page.errors.concat(p2.errors), []);
  await browser.close();
  console.log('tester-join-qa: OK — TEST-nnnn in Register → lean 🧪 card; ✓ Allow reads Android 14 · vivo V29 (V2250) · LINE · screen, nothing typed; ▸ Start sends exactly that; Skip → OS only; full code said; ✕ back to Register; iPhone family by screen, PC, browser hints; ended tester stopped; ?tester= link; English only; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
