// V101.378 🔢 เลขลับ · โหมดฝึก 🤖 (owner 2026-11-26, docs/MIND-GAMES-PLAN.md §3, mockup-secret-number/) on the REAL index.html, 390×844.
// Proves: the 5th tile in the games row opens it; the first open plays a 4-scene tour read aloud (t1…t4), ❓ replays, 🔊/🔇 kept;
// every menu question answers truthfully over 2000 random (number, question) pairs; the live set never drops the secret; 🟩 crosses
// out what the answers rule out and a tap on a live number guesses; ✏️ crosses only what you tap (✏️ ขีด) and 🎯 guesses; 📏 shows the
// live range; 🧠 shows the log only; a wrong guess costs 🎫 1 and is marked; the end shows 🎫 / wrong / time, keeps a best per help
// level, ↻ starts again; game_plays mode 'h<n>' win 'w' score = 🎫; a bad number asks again; 320 px fits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.__played = []; window.Audio = function (src) { this.src = src; this.paused = true; };
    window.Audio.prototype.play = function () { this.paused = false; window.__played.push(this.src); return Promise.resolve(); };
    window.Audio.prototype.pause = function () { if (!this.paused) window.__played.push('stop'); this.paused = true; };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.reject(new Error('off')) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });

  // the doorway: the 5th tile in the games row; the first open = the tour, read aloud
  const tiles = await page.$$eval('#u-games-row .u-game', (b) => b.map((x) => x.textContent.replace(/\s+/g, '')));
  assert.equal(tiles.length, 6); assert.match(tiles[4], /🔢เลขลับ/);
  await page.click('#u-games-row .u-game:nth-child(5)');
  assert.ok(await page.isVisible('#sn-tour'), 'first open = the tour'); assert.deepEqual(await page.evaluate(() => window.__played), ['secret-voice/t1.mp3']);
  const tops = [];
  for (let i = 0; i < 5; i++) { tops.push(await page.$eval('#sn-tnext', (b) => Math.round(b.getBoundingClientRect().top))); await page.click('#sn-tnext'); }
  assert.equal(new Set(tops).size, 1, 'ถัดไป ▸ stays put ' + tops);
  assert.deepEqual(await page.evaluate(() => window.__played), ['secret-voice/t1.mp3', 'stop', 'secret-voice/t2.mp3', 'stop', 'secret-voice/t3.mp3', 'stop', 'secret-voice/t4.mp3', 'stop', 'secret-voice/t5.mp3', 'stop']);
  assert.ok(await page.isVisible('#sn-start'), '▸ เริ่ม → lobby'); assert.equal(await page.evaluate(() => localStorage.getItem('snTourSeen')), '1');
  await page.click('#sn-help'); await page.click('#sn-voice');
  assert.equal(await page.evaluate(() => localStorage.getItem('snVoice')), 'off'); await page.evaluate(() => { window.__played = []; });
  await page.click('#sn-tnext'); assert.deepEqual(await page.evaluate(() => window.__played), [], '🔇 kept: silent');
  await page.click('.sn-skip');
  for (const f of [1, 2, 3, 4, 5]) { const b = fs.statSync('public/secret-voice/t' + f + '.mp3').size; assert.ok(b > 20000 && b < 100000, 't' + f + ' ' + b); }

  // truth table: every question over 2000 random pairs, checked against plain arithmetic
  const truth = await page.evaluate(() => {
    const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
    const want = { gt: (n, a) => n > a, even: (n) => n % 2 === 0, div3: (n) => n % 3 === 0, prime: isPrime, unit: (n, a) => n % 10 === a, range: (n, a, b) => n >= Math.min(a, b) && n <= Math.max(a, b) };
    const bad = [];
    for (let k = 0; k < 2000; k++) { const n = 1 + Math.floor(Math.random() * 100), a = Math.floor(Math.random() * 101), b = 1 + Math.floor(Math.random() * 100); SN._qs.forEach((q) => { if (q[3](n, a, b) !== want[q[0]](n, a, b)) bad.push(q[0] + ' ' + n + ' ' + a + ' ' + b); }); }
    // the live set never drops the secret over 300 random games of 8 questions
    for (let k = 0; k < 300; k++) { SN.start(); const g = SN._g(); for (let i = 0; i < 8; i++) { const q = SN._qs[Math.floor(Math.random() * SN._qs.length)]; const a = q[0] === 'unit' ? Math.floor(Math.random() * 10) : 1 + Math.floor(Math.random() * 100), b = 1 + Math.floor(Math.random() * 100); g.log.push({ id: q[0], a, b, ans: q[3](g.n, a, b), txt: '' }); } if (SN._live().indexOf(g.n) < 0) bad.push('live lost ' + g.n); }
    SN.lobby(); return bad.slice(0, 5);
  });
  assert.deepEqual(truth, []);

  // 🟩 a game by taps: ask > 50, even, then guess wrong once and right
  await page.evaluate(() => { SN._rng(() => 0.415); });   // the secret = 42
  await page.click('#sn-h1'); await page.click('#sn-start');
  assert.equal(await page.evaluate(() => SN._g().n), 42);
  await page.click('[data-q="gt"]'); await page.fill('#sn-a', '50'); await page.click('#sn-ask');
  await page.click('[data-q="even"]');
  assert.match(await page.textContent('#sn-log'), /2 · เลขคู่ \?✓ ใช่.*1 · มากกว่า 50 \?✗ ไม่/);
  assert.equal(await page.textContent('#sn-left'), 'เหลือ 25 ตัว · แตะเลข = ทาย');
  assert.ok(await page.$eval('[data-n="51"]', (b) => b.classList.contains('out')) && await page.$eval('[data-n="41"]', (b) => b.classList.contains('out')), 'odd and > 50 crossed out');
  await page.click('[data-n="40"]');
  assert.match(await page.textContent('#sn-toast'), /✗ ไม่ใช่ 40 · 🎫 \+1/); assert.ok(await page.$eval('[data-n="40"]', (b) => b.disabled && b.classList.contains('bad')));
  assert.equal(await page.textContent('#sn-used'), '🎫 3');
  await page.click('[data-q="gt"]'); await page.fill('#sn-a', '500'); await page.click('#sn-ask');
  assert.match(await page.textContent('#sn-toast'), /ใส่เลข 1–100/); assert.equal(await page.textContent('#sn-used'), '🎫 3', 'a bad number costs nothing');
  const logs = []; await page.exposeFunction('__log', (x) => logs.push(x));
  await page.evaluate(() => { const s = GameLog.see; GameLog.see = function (gm, st) { if (st && st.done) window.__log({ gm, mode: st.mode, win: st.win, score: st.score }); return s.apply(this, arguments); }; });
  await page.click('[data-n="42"]');
  assert.equal(await page.textContent('#sn-final'), '🎯 42'); assert.match(await page.textContent('#sn-stats'), /^3🎫 ที่ใช้1ทายผิด/);
  assert.match(await page.textContent('#sn-best'), /🎉 สถิติใหม่ · 3 🎫/); assert.equal(await page.evaluate(() => localStorage.getItem('snBest_h1')), '3');
  assert.deepEqual(logs[0], { gm: 'secret', mode: 'h1', win: 'w', score: '3' });

  // ✏️ crosses only what you tap
  await page.evaluate(() => { SN.lobby(); SN.help(2); SN.start(); });
  await page.click('[data-q="even"]');
  assert.equal(await page.$$eval('#sn-grid .out', (e) => e.length), 0, '✏️: the app crosses nothing');
  await page.click('#sn-cross'); await page.click('[data-n="7"]');
  assert.ok(await page.$eval('[data-n="7"]', (b) => b.classList.contains('out')), 'my cross'); assert.equal(await page.evaluate(() => SN._g().end), false, 'a cross is not a guess');
  await page.click('[data-n="7"]'); assert.ok(!(await page.$eval('[data-n="7"]', (b) => b.classList.contains('out'))), 'tap again uncrosses');
  await page.click('#sn-aim'); await page.click('[data-n="42"]'); assert.ok(await page.isVisible('#sn-final'), '🎯 guesses');
  // 📏 the range; 🧠 the log only
  await page.evaluate(() => { SN.lobby(); SN.help(3); SN.start(); });
  await page.click('[data-q="range"]'); await page.fill('#sn-a', '30'); await page.fill('#sn-b', '60'); await page.click('#sn-ask');
  assert.equal(await page.textContent('#sn-range'), 'อยู่ระหว่าง 30–60'); assert.equal(await page.$('#sn-grid'), null, '📏 no board');
  await page.fill('#sn-g', '42'); await page.click('#sn-guess'); assert.ok(await page.isVisible('#sn-final'));
  await page.evaluate(() => { SN.lobby(); SN.help(4); SN.start(); });
  assert.equal(await page.$('#sn-grid'), null); assert.equal(await page.$('#sn-bar'), null, '🧠 no help');
  // best per level shown in the lobby; ↻
  await page.evaluate(() => SN.lobby()); assert.match(await page.textContent('#sn-h1'), /🟩 ขีดให้ · 3🎫/);
  // 320 px
  await page.setViewportSize({ width: 320, height: 640 });
  const fits = () => page.$eval('#snModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1);
  assert.ok(await fits(), 'lobby 320'); await page.evaluate(() => { SN.help(1); SN.start(); SN.pick('range'); }); assert.ok(await fits(), 'board + two boxes 320');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('secret-qa: OK — 5th games tile, tour t1…t4 read aloud (🔇 kept), every question true over 2000 pairs, the secret never crossed out, 🟩 auto-cross + tap guess, ✏️ own crosses, 📏 range, 🧠 log only, wrong guess 🎫 +1, best per level, log h<n> w, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
