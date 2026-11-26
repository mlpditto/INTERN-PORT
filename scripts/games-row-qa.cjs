// V101.368 (owner: "ในจอเล็ก ให้ย้ายปุ่มเกมไปอยู่ด้านล่าง", pick B, mockup-games-row/) on the REAL index.html. Phone (390 + 320): the 4 games
// are one row of short cards with names under History, above the version (🥣 Cereal · 🐺 หมาป่า · 🧊 นับไว · ⚫ ไพ่เงา), same ids and
// handlers, each opens its game; the Schedule goals row keeps 🎯 / 💰 and no game; the row fits 320 px on one line, cards ≥ 44 px tall.
// PC (1024): the row is hidden and the header rail keeps ⚫ 🧊 🐺 🥣.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'bwTourSeen', 'countTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all'); localStorage.setItem('cerealCoachSeen', 'all');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });

  const row = () => page.evaluate(() => {
    const r = document.getElementById('u-games-row'), hist = document.getElementById('section-general-work'), foot = document.getElementById('intern-footer-line');
    const bs = [...r.querySelectorAll('button')], rb = r.getBoundingClientRect();
    return { shown: getComputedStyle(r).display, ids: bs.map((b) => b.id), text: bs.map((b) => b.innerText.replace(/\s+/g, '')), on: bs.map((b) => b.getAttribute('onclick')),
      afterHistory: !!(hist.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING), beforeFooter: r.nextElementSibling === foot,
      oneLine: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size === 1, minH: Math.min(...bs.map((b) => b.getBoundingClientRect().height)),
      fits: bs.every((b) => b.getBoundingClientRect().right <= rb.right + 1) && document.documentElement.scrollWidth <= innerWidth,
      noToggle: r.classList.contains('lang-no-toggle'), schGames: document.querySelectorAll('#sch-goals-box .sch-gb-fin').length, schKeeps: !!document.querySelector('#sch-goals-box #sch-fin-btn') };
  });
  const a = await row();
  assert.deepEqual({ shown: a.shown, ids: a.ids, text: a.text, on: a.on }, { shown: 'grid', ids: ['sch-cereal-btn', 'sch-wolf-btn', 'sch-count-btn', 'sch-bw-btn', 'sch-sn-btn'], text: ['🥣Cereal', '🐺หมาป่า', '🧊นับไว', '⚫ไพ่เงา', '🔢เลขลับ'], on: ['cerealOpen()', 'wolfOpen()', 'countOpen()', 'bwOpen()', 'secretOpen()'] }, 'phone: the games row, named, same ids + handlers');
  assert.ok(a.afterHistory && a.beforeFooter, 'under History, right above the version');
  assert.ok(a.oneLine && a.minH >= 44 && a.fits && a.noToggle, 'one line, ≥ 44 px, fits, Thai names shown ' + JSON.stringify(a));
  assert.equal(a.schGames, 1, 'the Schedule goals row keeps only 💰 (no game)'); assert.ok(a.schKeeps);
  for (const [id, modal] of [['sch-cereal-btn', 'cerealModal'], ['sch-wolf-btn', 'wolfModal'], ['sch-count-btn', 'countModal'], ['sch-bw-btn', 'bwModal'], ['sch-sn-btn', 'snModal']]) {
    await page.click('#' + id);
    assert.equal(await page.$eval('#' + modal, (m) => getComputedStyle(m).display), 'flex', id + ' opens ' + modal);
    await page.evaluate((m) => { document.getElementById(m).style.display = 'none'; }, modal);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  const n = await row(); assert.ok(n.oneLine && n.fits, '320 px: one line, nothing sideways ' + JSON.stringify(n));
  await page.setViewportSize({ width: 1024, height: 800 });
  assert.equal((await row()).shown, 'none', 'PC: the row hides');
  assert.equal(await page.$eval('#u-games-chip', (e) => getComputedStyle(e).display), 'flex', 'PC: the header 🎮 keeps the games');
  await page.click('#u-games-chip');
  assert.deepEqual(await page.evaluate(() => ['u-cereal-chip', 'u-wolf-chip', 'u-count-chip', 'u-bw-chip', 'u-sn-chip'].map((id) => !!document.getElementById(id).offsetParent)), [true, true, true, true, true], 'PC: all 5 in the 🎮 menu');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('games-row-qa: OK — phone: 🥣 Cereal · 🐺 หมาป่า · 🧊 นับไว · ⚫ ไพ่เงา · 🔢 เลขลับ (V101.378) under History, one line, 44 px, each opens its game, Schedule keeps 💰 only; 320 px; PC: row hidden, header rail kept');
})().catch((e) => { console.error(e); process.exit(1); });
