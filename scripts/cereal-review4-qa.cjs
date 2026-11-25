// V101.363 (owner "All 4", mockup-cereal-review/before-after.png) on the REAL index.html, 390×844 touch phone, a real pass-and-play
// game driven by taps. Proves: ↺ ถอย is a 44 px target with a word; a one-line key sits right under the board (killer: 🔪 คุณ … ·
// detective: 🕵️ คุณ …); case-log day rows tap open into one line per event with a word (สังหาร / ถามพยาน), the open row drops its
// summary so each number shows once, a second tap closes it, the popup does not jump; on the end screen ▶ walks the picked day from
// home one step at a time (route and step badges grow, 🔪 moves) and stops on the full route; a day chip stops the walk.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('cerealCoachSeen', 'all'); localStorage.setItem('cerealSound', '0');
    window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({}) }), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); }; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    let s = 7; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);   // the same game every run
  });
  await p.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await p.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await p.evaluate(() => { userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' }; document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); cerealOpen(); CK.vs('friend'); CK.start(); });

  // one tap of whatever the screen wants next (first legal choice; a boxed-in killer retries, then may skip)
  const step = () => p.evaluate(() => {
    const q = (s) => document.querySelector('#cerealModal ' + s), all = (s) => [...document.querySelectorAll('#cerealModal ' + s)];
    const g = CK.game(); if (!g || g.status !== 'playing') return 'end';
    if (q('#ck-hand-go')) { q('#ck-hand-go').click(); return 'hand'; }
    const cells = all('.ck-cell:not([disabled])');
    if (g.phase === 'killer') {
      if (g.draft.path.length < 4 && cells.length) { cells[Math.floor(Math.random() * cells.length)].click(); return 'k-walk'; }
      if (g.draft.kill == null) { const k = all('#ck-kill .ck-chip:not([disabled])').filter((c) => c.textContent.includes('🏠'))[0] || ((window.__r || 0) > 30 ? all('#ck-kill .ck-chip:not([disabled])')[0] : null); if (k) { k.click(); return 'k-kill'; } }
      const w = all('#ck-wit .ck-chip:not([disabled])')[0]; if (w && g.draft.witness == null) { w.click(); return 'k-wit'; }
      if (q('#ck-lock') && !q('#ck-lock').disabled) { q('#ck-lock').click(); return 'k-lock'; }
      window.__r = (window.__r || 0) + 1; CK.undo(); CK.undo(); CK.undo(); return 'k-redo';
    }
    if (g.phase === 'detective') {
      if (g.detectivePos == null) { cells[0].click(); return 'd-start'; }
      const a = all('#ck-ask .ck-q:not([disabled])')[0]; if (a) { a.click(); return 'd-ask'; }
      if (g.dd.path.length < 3 && cells.length) { cells[cells.length - 1].click(); return 'd-walk'; }
      q('#ck-end').click(); return 'd-end';
    }
    return 'other';
  });
  const until = async (fn, max = 3000) => { for (let i = 0; i < max; i++) { if (await p.evaluate(fn)) return; await step(); } throw new Error('never reached: ' + fn); };

  // 1 + 3 · the killer mid-route
  await until(() => { const g = CK.game(); return g.phase === 'killer' && !g.hand && g.draft.path.length === 2; });
  const k = await p.evaluate(() => { const u = document.querySelector('#cerealModal .ck-undo').getBoundingClientRect(), key = document.querySelector('#cerealModal .ck-key');
    return { undo: document.querySelector('#cerealModal .ck-undo').textContent, h: Math.round(u.height), w: u.width >= 44, keyAfterBoard: !!key && key.previousElementSibling.classList.contains('ck-board'), key: key && key.textContent, oneLine: key && key.getBoundingClientRect().height < 24 }; });
  assert.deepEqual(k, { undo: '↺ ถอย', h: 44, w: true, keyAfterBoard: true, key: '🔪 คุณ🕵️ นักสืบ👁️ พยาน🥣 เหยื่อเดินได้', oneLine: true }, '↺ ถอย 44 px + the key right under the board, one line');

  // 2 + 3 · the detective on day 2 or later (the case log has an earlier day)
  await until(() => { const g = CK.game(); return g.phase === 'detective' && !g.hand && g.detectivePos != null && g.day >= 2; });
  assert.equal(await p.$eval('#cerealModal .ck-key', (e) => e.previousElementSibling.classList.contains('ck-board') && e.textContent.startsWith('🕵️ คุณ')), true, 'the detective key starts with 🕵️ คุณ');
  const row = '#cerealModal .ck-lr[data-day="1"]';
  const before = await p.evaluate((row) => { const r = document.querySelector(row), mc = document.querySelector('#cerealModal .modal-content'); r.scrollIntoView({ block: 'center' }); return { exp: r.getAttribute('aria-expanded'), ar: r.querySelector('.ar').textContent, sum: r.querySelector('.sm').textContent, top: Math.round(r.getBoundingClientRect().top) }; }, row);
  assert.deepEqual([before.exp, before.ar], ['false', '▾']);
  await p.click(row);
  const open = await p.evaluate((row) => { const r = document.querySelector(row), x = r.nextElementSibling, g = CK.game();
    return { exp: r.getAttribute('aria-expanded'), ar: r.querySelector('.ar').textContent, sum: !!r.querySelector('.sm'), lines: x && x.classList.contains('ck-logx') ? [...x.children].map((c) => c.textContent) : null, events: g.log.filter((e) => e.day === 1).map((e) => e.text), top: Math.round(r.getBoundingClientRect().top) }; }, row);
  assert.deepEqual([open.exp, open.ar, open.sum], ['true', '▴', false], 'the open row drops its summary (each number once)');
  assert.equal(open.lines.length, open.events.length, 'one line per event');
  open.lines.forEach((l, i) => assert.ok(l.endsWith(open.events[i]), 'each line is the event: ' + l));
  assert.ok(open.lines.some((l) => /^(สังหาร|ถามพยาน) · /.test(l)), 'with a word for what happened ' + JSON.stringify(open.lines));
  assert.ok(Math.abs(open.top - before.top) < 30, 'the popup does not jump (a centred popup moves half a line at most) ' + before.top + ' → ' + open.top);
  // on a short screen the popup scrolls: opening a row keeps the scroll (render() used to reset it to the top)
  await p.click(row); await p.setViewportSize({ width: 390, height: 600 });
  const y0 = await p.evaluate((row) => { const sc = document.querySelector('#cerealModal .modal-content'); sc.scrollTop = sc.scrollHeight; return sc.scrollTop; }, row);
  assert.ok(y0 > 20, 'the popup scrolls at 600 px ' + y0);
  await p.evaluate((row) => document.querySelector(row).click(), row);
  assert.equal(await p.$eval('#cerealModal .modal-content', (e) => e.scrollTop), y0, 'opening a row keeps the scroll');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click(row);
  assert.equal(await p.$eval(row, (r) => r.getAttribute('aria-expanded') + (r.nextElementSibling && r.nextElementSibling.classList.contains('ck-logx'))), 'falsefalse', 'a second tap closes it');

  // 4 · the end screen: ▶ walks the day
  await until(() => CK.game().status !== 'playing');
  await p.click('#cerealModal .ck-days button:has-text("D1")');
  const full = await p.evaluate(() => CK.game().secret.path[1]);
  const pts = () => p.evaluate(() => (document.querySelector('#cerealModal .ck-route').getAttribute('points') || '').trim().split(/\s+/).length);
  await p.click('#ck-walk');
  assert.equal(await pts(), 1, '▶ starts at home'); assert.equal(await p.$eval('#ck-walk', (b) => b.classList.contains('on')), true);
  assert.equal(await p.$$eval('#cerealModal .ck-cell .st', (s) => s.length), 0);
  await p.waitForFunction(() => (document.querySelector('#cerealModal .ck-route').getAttribute('points') || '').trim().split(/\s+/).length === 2, null, { timeout: 2000 });
  assert.equal(await p.$eval(`#cerealModal .ck-cell[data-id="${full[1]}"] .me`, (e) => e.textContent), '🔪', '🔪 on step 1');
  await p.waitForFunction((n) => (document.querySelector('#cerealModal .ck-route').getAttribute('points') || '').trim().split(/\s+/).length === n && !document.getElementById('ck-walk').classList.contains('on'), full.length, { timeout: 4000 });
  assert.equal(await p.$$eval('#cerealModal .ck-cell .st', (s) => s.length), full.length - 1, 'stops on the full route with every step number');
  await p.click('#ck-walk'); await p.click('#cerealModal .ck-days button.all');
  await p.waitForTimeout(800);
  assert.equal(await p.$eval('#ck-walk', (b) => b.classList.contains('on')), false, 'a day chip stops the walk');

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('cereal-review4-qa: OK — ↺ ถอย 44 px, key under the board (killer / detective), log rows open one line per event and close, no jump, ▶ walks D1 to the full route, a chip stops it');
})().catch((e) => { console.error(e); process.exit(1); });
