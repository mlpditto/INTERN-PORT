// V101.391 🧑‍🎨 My pixel (owner 2026-11-28, picks: the game faces · pick parts · layout D + A, mockup-pixel-avatar/) on the REAL
// index.html, 390×844. Proves: every code draws (crisp 16 × 16), bad codes draw nothing; the first lobby visit makes a 🎲 one and says
// so, saved to users.pixel (update, never set) and kept on the phone; ✏️ opens one sheet with 7 rails, a tap changes the preview, 💾
// saves and the lobby row redraws; the row is in the Carry 13, เลขลับ and ไพ่เงา lobbies; the room / Top 3 face helpers draw the pixel
// before the LINE photo; the Top 3 ranker hands px through (both copies); roomAct `me()` copies users.pixel; 320 px fits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// the server side hands the pixel on
assert.match(fs.readFileSync('functions/room-act.js', 'utf8'), /px: \/\^\\d\{7\}\$\/\.test\(x\.pixel \|\| ''\) \? x\.pixel : ''/, 'roomAct me() copies users.pixel');
for (const f of ['functions/game-top-rank.js', 'public/game-top-rank.js']) {
  const gt = require(path.resolve(f)), plays = [{ userId: 'a', game: 'rock13', win: 'w', endedAt: Date.now() }];
  const ranked = gt.rank(plays, Date.now(), () => false), out = gt.forIntern(ranked, 'a', () => ({ name: 'A', pic: '', px: '1011104' }));
  assert.equal(JSON.stringify(out).includes('"px":"1011104"'), true, f + ' hands px to the Top 3');
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen', 'r13TourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.Audio = function () {}; window.Audio.prototype.play = function () { return Promise.resolve(); }; window.Audio.prototype.pause = function () {};
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.reject(new Error('off')) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    window.myUserDoc = { nickName: 'Ditto' }; window.__w = [];
    userId = 'U1'; isPreview = false;   // eslint-disable-line no-undef
    db.collection = ((c) => ({ doc: (id) => ({ update: (x) => { window.__w.push(['update', c, id, x]); return Promise.resolve(); }, set: (x) => { window.__w.push(['set', c, id, x]); return Promise.resolve(); } }) }));   // eslint-disable-line no-undef
  });

  // drawing
  const d = await page.evaluate(() => {
    let all = true; for (let i = 0; i < 300; i++) { const c = PixelAvatar.random(); if (!PixelAvatar.ok(c) || !/<rect/.test(PixelAvatar.svg(c, 16))) all = false; }
    return { all, bad: ['', '12', '9999999', '1011109', 'abcdefg', '10111044'].map((c) => PixelAvatar.svg(c, 16) + PixelAvatar.face(c, 20, 'x')), crisp: /shape-rendering="crispEdges"/.test(PixelAvatar.svg('1011104', 16)) };
  });
  assert.deepEqual(d, { all: true, bad: ['', '', '', '', '', ''], crisp: true });

  // D: the first lobby visit makes one for you
  await page.click('#sch-r13-btn');
  const row = await page.$eval('#pxa-row', (r) => ({ cls: r.className, t: r.innerText.replace(/\s+/g, ' '), px: !!r.querySelector('.pxa svg') }));
  assert.deepEqual([row.cls, row.px], ['pxa-row new', true]); assert.match(row.t, /🎲 Your pixel is ready/);
  const first = await page.evaluate(() => window.myUserDoc.pixel);
  assert.ok(/^\d{7}$/.test(first)); assert.deepEqual(await page.evaluate(() => window.__w), [['update', 'users', 'U1', { pixel: first }]], 'saved with update, never set');
  assert.equal(await page.evaluate(() => localStorage.getItem('pxMine')), first);
  await page.evaluate(() => R13.lobby());
  assert.match(await page.$eval('#pxa-row', (r) => r.className + '|' + r.innerText), /^pxa-row\|Ditto/, 'second time: your name, no "ready"');

  // A: ✏️ → one sheet, 7 rails; a tap changes the preview; 💾 saves and the row redraws
  await page.click('#pxa-edit');
  assert.equal(await page.$eval('#pxModal', (m) => getComputedStyle(m).display), 'flex');
  assert.deepEqual(await page.$$eval('#pxModal .pxa-rl', (e) => e.map((x) => x.textContent)), ['Skin', 'Hair', 'Hair colour', 'Eyes', 'Outfit', 'Outfit colour', 'Extra']);
  assert.ok(await page.$eval('#pxModal', (m) => +getComputedStyle(m).zIndex > +getComputedStyle(document.getElementById('r13Modal')).zIndex), 'over the game');
  const before = await page.$eval('#pxa-prev', (e) => e.innerHTML);
  const want = first.slice(0, 1) + (first[1] === '2' ? '3' : '2') + first.slice(2, 6) + '1';
  await page.click('#pxModal .pxa-rail[data-k="1"] button:nth-child(' + (+want[1] + 1) + ')');
  await page.click('#pxModal .pxa-rail[data-k="6"] button:nth-child(2)');
  assert.notEqual(await page.$eval('#pxa-prev', (e) => e.innerHTML), before, 'the preview follows');
  assert.equal(await page.evaluate(() => PixelAvatar._draft()), want);
  assert.ok(await page.$$eval('#pxModal .pxa-sw, #pxModal .pxa-c', (b) => b.every((x) => x.getBoundingClientRect().height >= 44)), '44 px targets');
  await page.click('#pxa-dice'); assert.notEqual(await page.evaluate(() => PixelAvatar._draft()), null);
  await page.evaluate((c) => { const k = c.split(''); k.forEach((v, i) => PixelAvatar.set(i, +v)); }, want);
  await page.click('#pxa-save');
  assert.equal(await page.$eval('#pxModal', (m) => getComputedStyle(m).display), 'none');
  assert.equal(await page.evaluate(() => window.myUserDoc.pixel), want);
  assert.deepEqual((await page.evaluate(() => window.__w)).slice(-1), [['update', 'users', 'U1', { pixel: want }]]);
  assert.equal(await page.evaluate((c) => { const d = document.createElement('div'); d.innerHTML = PixelAvatar.svg(c, 48); return document.querySelector('#pxa-row .pxa').innerHTML === d.innerHTML; }, want), true, 'the lobby row redraws');

  // the row is in the other room games' lobbies too
  await page.evaluate(() => R13.close());
  for (const [open, modal] of [['secretOpen', 'snModal'], ['bwOpen', 'bwModal']]) {
    await page.evaluate((f) => window[f](), open);
    assert.ok(await page.$eval('#' + modal, (m) => !!m.querySelector('#pxa-row .pxa svg')), modal + ' lobby has my pixel');
    await page.evaluate((m) => { document.getElementById(m).style.display = 'none'; }, modal);
  }

  // the face helpers: pixel first, then the photo, then the initial
  const f = await page.evaluate(() => {
    const out = {}, p = { name: 'Bo', pic: 'https://x/y.jpg', px: '1011104' }, noPx = { name: 'Bo', pic: 'https://x/y.jpg' };
    out.top = GameTop._av ? 'skip' : 'n/a';
    out.pxa = PixelAvatar.face(p.px, 24, 'r13o-av');
    return { out, pf: /class="r13o-av pxa"/.test(out.pxa) };
  });
  assert.ok(f.pf);
  for (const file of ['public/rock13-online.js', 'public/secret-online.js', 'public/shadow-online.js', 'public/game-top.js']) {
    assert.match(fs.readFileSync(file, 'utf8'), /if \(p(?: && p)?\.px && window\.PixelAvatar && PixelAvatar\.ok\(p\.px\)\) return PixelAvatar\.face\(p\.px, /, file + ': the pixel comes before the photo');
  }

  // 320 px: the sheet fits sideways
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => PixelAvatar.edit());
  assert.ok(await page.$eval('#pxModal .modal-content', (el) => el.scrollWidth <= el.clientWidth + 1), '320 px: nothing sideways');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('pixel-avatar-qa: OK — every code draws, bad ones nothing; first lobby visit makes a 🎲 pixel (users.pixel by update + phone); ✏️ sheet 7 rails, preview follows, 💾 saves + row redraws; in 🪨 🔢 ⚫ lobbies; faces: pixel before photo; Top 3 + roomAct hand px on; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
