// V101.371 🧊 นับไว (owner: "เพิ่มโหมดไม่นับถอยหลังเวลา แต่เก็บ stat ให้ ADMIN และ user ทราบ" · "เฉลยควรบอกวิธีนับ พร้อมตัวเลขกำกับ",
// picks: 🟥 C ภาพย่อย · 🧊 B ตารางมองจากบน, mockup-count-free/) on the REAL index.html, 390×844 touch phone.
// Proves: the lobby has a chip rail ⏱ แข่งเวลา / 🧘 ไม่จับเวลา (timed at first, the pick kept on the phone); 🧘: the clock counts UP in
// grey and never ends a question, no points, ✓ n in the header; the end shows ✓ n/5 · total time · average, the seconds of each question,
// and a best total kept only for a 5/5 run; the admin log gets mode "rect free"; the 🟥 answer = every rectangle as a small numbered
// picture (1…n, one lit in each), grouped by how many pieces it covers, and "a + b + … = n รูป"; the 🧊 answer = a top-view table of
// heights (= the real stack) with each row's sum and "… = n ก้อน"; nothing scrolls sideways at 320 px.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen']) localStorage.setItem(k, '1');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    let r = 17; CG._rng(() => ((r = (r * 16807) % 2147483647) / 2147483647)); window.__modes = []; const see = GameLog.see; GameLog.see = (game, s) => { window.__modes.push(s.mode); return see(game, s); }; countOpen(); });

  // ---- lobby chip rail ----
  const rail = () => page.evaluate(() => ['cg-timed', 'cg-free'].map((id) => { const b = document.getElementById(id); return b ? b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '') : null; }));
  assert.deepEqual(await rail(), ['⏱ แข่งเวลา 30 วิ*', '🧘 ไม่จับเวลา'], 'timed at first');
  await page.click('#cg-free');
  assert.deepEqual(await rail(), ['⏱ แข่งเวลา 30 วิ', '🧘 ไม่จับเวลา*']); assert.equal(await page.evaluate(() => localStorage.getItem('countFree')), '1', 'the pick is kept');

  // ---- 🧘 play: counts up, never ends, no points ----
  await page.click('#cg-rect');
  await page.waitForTimeout(2300);
  const h = await page.evaluate(() => ({ clock: document.getElementById('cg-clock').textContent, up: document.getElementById('cg-clock').classList.contains('up'), pts: /🏆/.test(document.querySelector('#countModal .cg-top').textContent), res: !!document.getElementById('cg-res'), mark: document.getElementById('cg-right') && document.getElementById('cg-right').textContent }));
  assert.deepEqual(h, { clock: '⏱ 0:02', up: true, pts: false, res: false, mark: '✓ 0' }, 'counts up, no 🏆, no answer forced');
  await page.evaluate(() => { CG._g().el = 31; });
  await page.waitForTimeout(1100);
  assert.equal(await page.$('#cg-res'), null, 'past 30 s still waiting'); assert.match(await page.textContent('#cg-clock'), /^⏱ 0:3\d$/);

  // ---- 🟥 answer: numbered small pictures, grouped ----
  await page.evaluate(() => { CG.key(0); CG.ok(); });
  const rc = await page.evaluate(() => { const p = CG._g().p, th = [...document.querySelectorAll('#cg-thumbs .cg-th')];
    return { n: p.n, res: document.getElementById('cg-res').textContent, figHidden: getComputedStyle(document.getElementById('cg-fig')).display === 'none', nums: th.map((t) => +t.querySelector('b').textContent), lit: th.every((t) => t.querySelectorAll('rect.lit').length === 1),
      rects: th.map((t) => { const r = t.querySelector('rect.lit'); return [+r.dataset.x1, +r.dataset.y1, +r.dataset.x2, +r.dataset.y2].join(); }).sort().join('|') === p.ans.map((r) => r.join()).sort().join('|'),
      heads: [...document.querySelectorAll('#cg-thumbs h5')].map((e) => e.textContent), eq: document.getElementById('cg-eq').textContent }; });
  assert.equal(rc.res, '✗ ตอบ 0 · เฉลย ' + rc.n + ' · ⏱ ' + (await page.evaluate(() => CG._g().qt[0])) + ' วิ', 'V101.372: the seconds this question took');
  assert.ok(rc.figHidden, 'the big picture gives way to the small ones');
  assert.deepEqual(rc.nums, Array.from({ length: rc.n }, (_, i) => i + 1), 'numbered 1…n'); assert.ok(rc.lit && rc.rects, 'each small picture lights one rectangle, every rectangle once');
  const groups = rc.heads.map((t) => +(/· (\d+) รูป$/.exec(t) || [])[1]);
  assert.equal(groups.reduce((a, b) => a + b, 0), rc.n, 'the groups add up'); assert.ok(rc.heads.every((t) => /^\d+ ช่อง · \d+ รูป$/.test(t)), rc.heads.join());
  assert.equal(rc.eq, rc.heads.map((t) => t.split(' · ')[0] + ' ' + /(\d+) รูป$/.exec(t)[1]).join(' + ') + ' = ' + rc.n + ' รูป', 'the sum line');

  // ---- finish the 🧘 run with 5/5 → stats + best ----
  await page.evaluate(() => { CG.next(); for (let i = 0; i < 4; i++) { const g = CG._g(); g.el = 10 + i; String(CG._count(g.p)).split('').forEach((d) => CG.key(+d)); CG.ok(); CG.next(); } });
  const end = await page.evaluate(() => ({ stats: [...document.querySelectorAll('#cg-stats > div')].map((d) => d.firstChild.textContent), qs: [...document.querySelectorAll('#cg-qt span')].map((s) => s.className), best: localStorage.getItem('countFreeBest_rect'), g: CG._g() }));
  const total = end.g.qt.reduce((a, b) => a + b, 0);
  assert.deepEqual(end.stats, ['✓ 4/5', Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0'), Math.round(total / 5) + ' วิ'], 'end: right · total · average');
  assert.deepEqual(end.qs, ['no', 'ok', 'ok', 'ok', 'ok'], 'each question with its seconds');
  assert.equal(end.best, null, 'not 5/5 → no best time');
  await page.evaluate(() => { CG.start('rect'); for (let i = 0; i < 5; i++) { const g = CG._g(); g.el = 7; String(CG._count(g.p)).split('').forEach((d) => CG.key(+d)); CG.ok(); CG.next(); } });
  assert.equal(await page.evaluate(() => localStorage.getItem('countFreeBest_rect')), '35', '5/5 → best total kept'); assert.match(await page.textContent('#cg-best'), /ดีสุด 0:35/);
  assert.ok((await page.evaluate(() => window.__modes)).includes('rect free'), 'the admin log says "rect free"');

  // ---- 🧊 answer: top-view table ----
  await page.evaluate(() => { CG.start('cube'); CG.key(0); CG.ok(); });
  const cb = await page.evaluate(() => { const p = CG._g().p, rows = [...document.querySelectorAll('#cg-topv tr')];
    return { h: p.h, n: CG._count(p), cells: rows.map((r) => [...r.querySelectorAll('td.h')].map((t) => +t.textContent)), sums: rows.map((r) => r.querySelector('td.s').textContent), eq: document.getElementById('cg-eq').textContent, svg: !!document.querySelector('#cg-fig svg') }; });
  assert.deepEqual(cb.cells, cb.h, 'the table = the stack seen from above');
  assert.deepEqual(cb.sums, cb.h.map((r) => '=' + r.reduce((a, b) => a + b, 0)), 'each row sum');
  assert.equal(cb.eq, cb.h.map((r) => r.reduce((a, b) => a + b, 0)).filter(Boolean).join(' + ') + ' = ' + cb.n + ' ก้อน'); assert.ok(cb.svg, 'the stack stays beside it');

  // ---- timed mode is unchanged: counts down, points ----
  await page.evaluate(() => { CG.lobby(); }); await page.click('#cg-timed'); await page.click('#cg-rect');
  assert.equal(await page.evaluate(() => [document.getElementById('cg-clock').classList.contains('up'), /🏆/.test(document.querySelector('#countModal .cg-top').textContent), localStorage.getItem('countFree')].join()), 'false,true,0', 'timed: countdown + 🏆');

  // ---- 320 px ----
  await page.setViewportSize({ width: 320, height: 640 });
  for (const mode of ['rect', 'cube']) { await page.evaluate((m) => { CG.start(m); CG.key(0); CG.ok(); }, mode); assert.ok(await page.$eval('#countModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), mode + ': no sideways scroll at 320 px'); }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('count-free-qa: OK — chip rail kept, 🧘 counts up / never ends / no points, end stats + per question + best only at 5/5, admin mode "rect free", 🟥 numbered small pictures by group + sum, 🧊 top-view table + row sums, timed unchanged, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
