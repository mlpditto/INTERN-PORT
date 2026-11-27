// V102.710 🧪 tester-admin.js (owner pick B: its own 🧪 in the User Hub bar). The 🧪 button sits right after 📋 Entry in the REAL
// admin.html; the panel (run on a blank page with a small in-memory Firestore): Group · 👥 cycles 5→10→20 · ⏳ 3→7→14 d · ＋
// makes TEST-nnnn with exactly { label, max, used 0, untilMs, paused false, testers [] }; rows show used/max and →end, live first,
// ended rows dim without 📤 ⏸; 📤 copies the LINE link ?tester= and opens LINE share; ⏸ ↔ ▶; the people list shows each tester's
// device and code; English only; 320 px fits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const admin = fs.readFileSync('public/admin.html', 'utf8');
const entry = admin.indexOf('onclick="openPreRegModal()" title="Entry (pre-registration)"'), ta = admin.indexOf('id="ta-open"');
assert.ok(entry > 0 && ta > entry && ta - entry < 1200, 'the 🧪 button sits right after 📋 Entry');
assert.match(admin, /<script src="tester-admin\.js\?v=V102\.710"><\/script>/);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>.modal{position:fixed;inset:0;display:none}.modal-content{background:#fff;margin:20px auto}</style></head><body></body></html>');
  await page.evaluate(() => {
    const store = new Map(), subs = [], NOW = Date.now(), DAY = 864e5;
    window.__store = store; window.__opened = [];
    const snap = () => ({ docs: [...store.entries()].map(([id, v]) => ({ id, data: () => v })) });
    const fire = () => subs.forEach((f) => f(snap()));
    store.set('TEST-1907', { label: 'Watch first', max: 5, used: 4, untilMs: NOW + 3 * DAY, paused: false, createdAt: { toMillis: () => NOW - DAY },
      testers: [{ uid: 'U1', name: 'Mind', pic: '', device: { os: 'ios', model: 'iPhone 12–14' }, at: NOW - 5000 }, { uid: 'U2', name: 'Tonkhao', pic: '', device: { os: 'android', model: 'Galaxy A54', modelCode: 'SM-A546E' }, at: NOW - 1000 }] });
    store.set('TEST-0001', { label: 'Old', max: 5, used: 1, untilMs: NOW - DAY, paused: false, createdAt: { toMillis: () => NOW - 9 * DAY }, testers: [] });
    window.db = { collection: () => ({
      onSnapshot: (f) => { subs.push(f); setTimeout(() => f(snap()), 0); return () => {}; },
      doc: (id) => ({ get: () => Promise.resolve({ exists: store.has(id) }), set: (v) => { store.set(id, Object.assign({}, v, { createdAt: { toMillis: () => Date.now() } })); fire(); return Promise.resolve(); },
        update: (v) => { store.set(id, Object.assign({}, store.get(id), v)); fire(); return Promise.resolve(); } }) }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    window.open = (u) => { window.__opened.push(u); return null; };
    window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } } });
  });
  await page.addScriptTag({ path: path.resolve('public/tester-admin.js') });
  await page.evaluate(() => testerAdmin.open());
  await page.waitForSelector('[data-code="TEST-1907"]');
  assert.match(await page.textContent('#ta-sum'), /1 open · 2 testers/);
  assert.deepEqual(await page.$$eval('.ta-code', (r) => r.map((x) => x.dataset.code + (x.classList.contains('off') ? '-off' : ''))), ['TEST-1907', 'TEST-0001-off'], 'live first, ended dim');
  assert.equal(await page.$$eval('[data-code="TEST-0001"] button', (b) => b.length), 0, 'an ended code has no 📤 ⏸');
  assert.match(await page.textContent('[data-code="TEST-1907"]'), /Watch first · 4\/5 · →/);
  assert.deepEqual(await page.$$eval('.ta-u', (r) => r.map((x) => [...x.querySelectorAll('span')].map((y) => y.textContent.trim()).filter(Boolean).join(' | '))), ['Tonkhao | 🤖 Galaxy A54 | 1907', 'Mind | 🍎 iPhone 12–14 | 1907'], 'newest tester first, with the device');

  // make a code: 👥 20 · ⏳ 14 d
  await page.click('#ta-max'); await page.click('#ta-max'); await page.click('#ta-days'); await page.click('#ta-days');
  assert.deepEqual([await page.textContent('#ta-max'), await page.textContent('#ta-days')], ['👥 5', '⏳ 3d'], 'chips cycle 10→20→5 and 7→14→3');
  await page.click('#ta-max'); await page.click('#ta-max'); await page.click('#ta-days'); await page.click('#ta-days');
  assert.deepEqual([await page.textContent('#ta-max'), await page.textContent('#ta-days')], ['👥 20', '⏳ 14d']);
  await page.fill('#ta-label', 'Game test');
  const t0 = Date.now(); const code = await page.evaluate(() => testerAdmin.create());
  assert.match(code, /^TEST-\d{4}$/);
  const doc = await page.evaluate((c) => window.__store.get(c), code);
  assert.deepEqual({ label: doc.label, max: doc.max, used: doc.used, paused: doc.paused, testers: doc.testers }, { label: 'Game test', max: 20, used: 0, paused: false, testers: [] });
  assert.ok(Math.abs(doc.untilMs - (t0 + 14 * 864e5)) < 5000, '14 days');
  await page.waitForSelector('[data-code="' + code + '"]'); assert.equal(await page.inputValue('#ta-label'), '', 'the box clears');

  // 📤 and ⏸
  await page.click('[data-code="' + code + '"] .ta-i.g');
  assert.equal(await page.evaluate(() => window.__clip), 'https://liff.line.me/2008959998-yjcNpaGt?tester=' + code);
  assert.match(await page.evaluate(() => window.__opened[0]), /^https:\/\/line\.me\/R\/share\?text=.*tester%3DTEST-\d{4}/);
  await page.click('[data-code="TEST-1907"] button[title="Pause"]');
  await page.waitForSelector('[data-code="TEST-1907"].off'); assert.equal(await page.evaluate(() => window.__store.get('TEST-1907').paused), true);
  await page.click('[data-code="TEST-1907"] button[title="Resume"]'); assert.equal(await page.evaluate(() => window.__store.get('TEST-1907').paused), false);
  assert.doesNotMatch(await page.textContent('#taModal'), /[฀-๿]/, 'English only');
  await page.setViewportSize({ width: 320, height: 640 });
  assert.ok(await page.$eval('#taModal .ta', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('tester-admin-qa: OK — 🧪 right after 📋 Entry; 1 open · 2 testers; live first, ended dim without buttons; 👥 5/10/20 · ⏳ 3/7/14 d · ＋ → TEST-nnnn with exact fields; 📤 copies ?tester= + LINE share; ⏸ ↔ ▶; testers with device + code; English only; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
