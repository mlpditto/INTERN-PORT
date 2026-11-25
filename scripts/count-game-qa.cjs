// V101.362 🧊 นับไว (owner 2026-11-25, pick C: answer, then the answer shows) on the REAL index.html, 390×844 touch phone + a 1024 PC.
// Proves: the rectangle counter is right on known drawings (a 2×1 split = 3, a 2×2 grid = 9, a box with a T line); every 🧊 stack is a
// staircase (each top in sight) and its count = the sum of the heights; the doorways (phone: Schedule row, PC: header beside 🐺) open the
// lobby with 🟥 / 🧊; the number pad types, ⌫ deletes, ✓ waits for a number; a right answer scores 100 + 5 × seconds left, a wrong one
// shows "เฉลย n"; 🟥 then shows every rectangle as a small numbered picture (V101.371); 🧊 shows each column's height and the sum; time running out
// ends the question; 5 questions → the score, a new best kept in localStorage; the keyboard works on PC; nothing scrolls sideways at 320 px.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });

  // the rectangle counter on drawings with a known answer
  const known = await page.evaluate(() => {
    const draw = (boxes, W, H) => { const hs = {}, vs = {}; for (const b of boxes) { for (let x = b[0]; x < b[2]; x++) { hs[x + ',' + b[1]] = 1; hs[x + ',' + b[3]] = 1; } for (let y = b[1]; y < b[3]; y++) { vs[b[0] + ',' + y] = 1; vs[b[2] + ',' + y] = 1; } } return CG._rects(hs, vs, W, H).length; };
    return [draw([[0, 0, 2, 1], [0, 0, 1, 1]], 2, 1), draw([[0, 0, 2, 2], [0, 0, 1, 1], [1, 1, 2, 2]], 2, 2), draw([[0, 0, 4, 2], [0, 0, 2, 2], [0, 0, 2, 1]], 4, 2)];
  });
  assert.deepEqual(known, [3, 9, 5], 'rectangles: a split box = 3, a 2×2 grid = 9, a box with a half line and a T = 5');

  // every stack is a staircase and counts its hidden cubes
  const stacks = await page.evaluate(() => { const out = []; for (let i = 0; i < 40; i++) { CG.start('cube'); const g = CG._g(); g.i = i % 5; const p = g.p, h = p.h; let ok = true, sum = 0; for (let r = 0; r < p.n; r++) for (let c = 0; c < p.n; c++) { sum += h[r][c]; if ((r && h[r][c] > h[r - 1][c]) || (c && h[r][c] > h[r][c - 1])) ok = false; } out.push(ok && sum === CG._count(p)); } CG.close(); return out; });
  assert.ok(stacks.every(Boolean), 'every 🧊 stack: never taller toward you, count = sum of heights');

  // phone doorway → lobby
  assert.equal(await page.$eval('#u-count-chip', (e) => getComputedStyle(e).display), 'none', 'phone: no header chip');
  await page.evaluate(() => document.getElementById('sch-count-btn').click());
  const lobby = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('countModal')).display, modes: [...document.querySelectorAll('.cg-modes button')].map((b) => b.querySelector('i').textContent), noToggle: document.getElementById('countModal').classList.contains('lang-no-toggle') }));
  assert.deepEqual(lobby, { shown: 'flex', modes: ['🟥', '🧊'], noToggle: true }, 'the lobby offers 🟥 and 🧊');

  // 🟥: wrong answer → เฉลย, rectangles light one by one
  await page.click('#cg-rect');
  assert.equal(await page.$eval('#cg-ok', (b) => b.disabled), true, '✓ waits for a number');
  const n = await page.evaluate(() => CG._count(CG._g().p));
  const wrong = n === 1 ? 2 : 1;
  await page.click(`.cg-pad button:text-is("${wrong}")`); await page.click('.cg-pad button:text-is("7")'); await page.click('.cg-pad button[aria-label="Delete"]');
  assert.equal(await page.$eval('#cg-ans', (e) => e.textContent), String(wrong), 'the pad types, ⌫ deletes');
  await page.click('#cg-ok');
  assert.match(await page.$eval('#cg-res', (e) => e.textContent), new RegExp(`^✗ ตอบ ${wrong} · เฉลย ${n} · ⏱ \\d+ วิ$`), 'V101.372: the seconds this question took');
  // V101.371 (pick C): every rectangle as a small numbered picture instead of lighting one by one (count-free-qa covers the details)
  assert.equal(await page.$$eval('#cg-thumbs .cg-th', (t) => t.length), n, 'one small picture per rectangle');

  // question 2: right answer scores 100 + 5 × seconds left
  await page.click('#cg-next');
  const r2 = await page.evaluate(() => { const g = CG._g(); String(CG._count(g.p)).split('').forEach((d) => CG.key(+d)); const left = g.left; CG.ok(); return { left, score: g.score, res: document.getElementById('cg-res').textContent }; });
  assert.equal(r2.score, 100 + r2.left * 5); assert.match(r2.res, /^✓ \d+ ถูก · \+\d+ · ⏱ \d+ วิ$/); assert.equal(+/(\d+) วิ$/.exec(r2.res)[1], 30 - r2.left, 'took = 30 − seconds left');

  // question 3: time runs out → หมดเวลา
  await page.click('#cg-next'); await page.evaluate(() => { CG._g().left = 1; }); await page.waitForSelector('#cg-res', { timeout: 3000 });
  assert.match(await page.$eval('#cg-res', (e) => e.textContent), /^⏱ หมดเวลา · เฉลย \d+$/, 'a time-out never says 30 วิ again');
  for (let i = 0; i < 2; i++) { await page.click('#cg-next'); await page.evaluate(() => { CG.key(0); CG.ok(); }); }
  await page.click('#cg-next');
  const end = await page.evaluate(() => ({ final: document.getElementById('cg-final').textContent, best: localStorage.getItem('countBest_rect'), score: CG._g().score }));
  assert.equal(end.final, '🏆 ' + end.score); assert.equal(await page.$$eval('#cg-qt span', (s) => s.length), 5, 'V101.372: the timed end shows each question\'s seconds too'); assert.equal(end.best, String(end.score), 'a new best is kept');

  // 🧊: the answer shows every column's height and the sum
  await page.evaluate(() => CG.start('cube'));
  await page.evaluate(() => { CG.key(0); CG.ok(); });
  const cube = await page.evaluate(() => { const p = CG._g().p; return { nums: [...document.querySelectorAll('#cg-fig text')].map((t) => +t.textContent).reduce((a, b) => a + b, 0), n: CG._count(p), sum: document.getElementById('cg-eq').textContent }; });
  assert.equal(cube.nums, cube.n, 'the heights on the tops add up to the answer'); assert.ok(cube.sum.endsWith('= ' + cube.n + ' ก้อน'), 'V101.371: the sum line');

  // no sideways scroll at 320 px
  await page.setViewportSize({ width: 320, height: 640 }); await page.evaluate(() => CG.start('rect'));
  assert.ok(await page.$eval('#countModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), 'no sideways scroll at 320 px');
  await page.evaluate(() => CG.close());

  // PC: the header chip beside 🐺, keyboard plays
  await page.setViewportSize({ width: 1024, height: 800 });
  assert.equal(await page.$eval('#u-count-chip', (e) => [getComputedStyle(e).display, e.nextElementSibling.id].join()), 'flex,u-wolf-chip', 'PC: 🧊 just left of 🐺 (🐺 🥣 📅 stay together)');
  await page.click('#u-count-chip'); await page.click('#cg-cube');
  await page.keyboard.press('1'); await page.keyboard.press('Enter');
  assert.ok(await page.$('#cg-res'), 'PC: digits + Enter answer');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#countModal', (e) => e.style.display), 'none', 'PC: Esc closes');

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('count-game-qa: OK — rectangle counter right on known drawings, stacks fair, doorways, pad, wrong → เฉลย + light-up, right = 100 + 5×s, time out, best kept, 🧊 heights, 320 px, PC keys');
})().catch((e) => { console.error(e); process.exit(1); });
