// V101.375 🧊 นับไว 🥄 levels (owner "เกมนี้ควรมีให้เลือกระดับความยากด้วย", pick A = a 🥄 rail like ไพ่เงา, mockup-count-levels/) on the
// REAL index.html, 390×844 touch phone. Proves: the lobby has 🥄 ง่าย · 🥄🥄 กลาง · 🥄🥄🥄 ยาก under the timer rail, กลาง by default, a tap
// is kept (countLv); the level moves the questions' size (ง่าย q5 ≈ old q3, ยาก q1 ≈ old q3 and q5 bigger than ever, 🧊 ยาก q5 = a 5×5
// stack); each level keeps its own best (🥄🥄 keeps the old keys); the end says the level, ↻ plays it again; game_plays mode ends ' l<n>'; 320 px.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen']) localStorage.setItem(k, '1');
    localStorage.setItem('countVoice', 'off'); localStorage.setItem('countBest_rect', '700'); localStorage.setItem('countFreeBest_cube_l1', '95');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.reject(new Error('off')) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    let q = 11; Math.random = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });

  await page.evaluate(() => countOpen());
  const lvs = await page.$$eval('#countModal [aria-label="Level"] button', (b) => b.map((x) => x.textContent + (x.classList.contains('on') ? '*' : '')));
  assert.deepEqual(lvs, ['🥄 ง่าย', '🥄🥄 กลาง*', '🥄🥄🥄 ยาก'], 'three levels, กลาง by default');
  const order = await page.$$eval('#countModal .cg > *', (e) => e.map((x) => x.getAttribute('aria-label') || x.className));
  assert.ok(order.indexOf('Level') === order.indexOf('Timer') + 1, 'right under the timer rail ' + order);
  assert.match(await page.textContent('#cg-rect small'), /🏆 700/, '🥄🥄 keeps the old best');
  await page.click('#cg-lv3');
  assert.equal(await page.evaluate(() => localStorage.getItem('countLv')), '3');
  assert.match(await page.textContent('#cg-lv3'), /ยาก/); assert.ok(await page.$eval('#cg-lv3', (b) => b.classList.contains('on')));
  assert.doesNotMatch(await page.textContent('#cg-rect small'), /700/, 'ยาก has its own best');
  await page.evaluate(() => { CG.free(1); CG.lv(1); });
  assert.match(await page.textContent('#cg-cube small'), /ดีสุด 1:35/, 'ง่าย 🧘 best of its own');
  await page.evaluate(() => CG.free(0));

  // drive the real generator through CG.start + next: read each question's answer as the game shows it
  const run = (lv, m) => page.evaluate(([lv, m]) => {
    CG.lv(lv); const res = [];
    for (let k = 0; k < 12; k++) {
      CG.start(m); const g = CG._g(), row = [];
      for (let i = 0; i < 5; i++) { row.push({ n: CG._count(g.p), side: g.p.n }); g.typed = ''; CG.key(0); CG.ok(); CG.next(); }
      res.push(row);
    }
    CG.lobby(); return res;
  }, [lv, m]);
  const avg = (rs, i) => rs.reduce((a, r) => a + r[i].n, 0) / rs.length;
  const e = await run(1, 'rect'), mid = await run(2, 'rect'), h = await run(3, 'rect');
  assert.ok(avg(e, 4) < avg(mid, 4) && avg(mid, 4) < avg(h, 4), 'q5 grows with the level ' + [avg(e, 4), avg(mid, 4), avg(h, 4)]);
  assert.ok(avg(h, 0) > avg(mid, 0), 'ยาก starts bigger ' + [avg(mid, 0), avg(h, 0)]);
  assert.ok(Math.max(...h.map((r) => r[4].n)) > 30, 'ยาก goes past the old top (30)');
  const ch = await run(3, 'cube');
  assert.ok(ch.some((r) => r[4].side === 5), '🧊 ยาก q5 can be a 5×5 stack');

  // the end says the level, ↻ keeps it, the log mode carries it
  await page.evaluate(() => { window.__logs = []; const s = GameLog.see; GameLog.see = function (game, st) { if (st && st.done) window.__logs.push(st.mode); return s.apply(this, arguments); }; });
  await page.evaluate(() => { CG.lv(3); CG.start('rect'); const g = CG._g(); for (let i = 0; i < 5; i++) { String(CG._count(g.p)).split('').forEach((d) => CG.key(+d)); CG.ok(); CG.next(); } });
  assert.match(await page.textContent('#countModal h3'), /จบรอบ · 🥄🥄🥄/);
  assert.equal(await page.evaluate(() => localStorage.getItem('countBest_rect_l3') > 0), true, 'ยาก best kept under its own key');
  assert.equal(await page.evaluate(() => localStorage.getItem('countBest_rect')), '700', '🥄🥄 best untouched');
  assert.deepEqual(await page.evaluate(() => window.__logs), ['rect l3']);
  await page.click('text=↻ เล่นอีก'); assert.equal(await page.evaluate(() => CG._g().lv), 3, '↻ plays the same level');
  // 320 px lobby
  await page.evaluate(() => CG.lobby()); await page.setViewportSize({ width: 320, height: 640 });
  assert.ok(await page.$eval('#countModal .modal-content', (el) => el.scrollWidth <= el.clientWidth + 1), '320 px fits');
  const rows = await page.$$eval('#countModal [aria-label="Level"] button', (b) => new Set(b.map((x) => Math.round(x.getBoundingClientRect().top))).size);
  assert.equal(rows, 1, 'the three levels stay on one line at 320 px');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('count-level-qa: OK — 🥄 ง่าย · 🥄🥄 กลาง · 🥄🥄🥄 ยาก under the timer, กลาง default, kept; sizes grow with the level (ยาก past 30 rects, 🧊 5×5); a best per level (🥄🥄 = old keys); the end says the level, ↻ keeps it, log mode " l3"; 320 px one line');
})().catch((e) => { console.error(e); process.exit(1); });
