// V101.367 🧊 นับไว (owner "Build A + the ❓ tour", "คำถามสั้นไป", mockup-count-tour/) on the REAL index.html, 390×844 touch phone.
// Proves: the first open plays the ❓ tour inside the popup (not the lobby); scene 1 lights ① → ② → ③ = 3 รูป with motion allowed (and
// shows ③ at once with reduced motion); ถัดไป ▸ stays in one place across the 3 scenes (fixed height); ▸ เริ่ม / ข้าม / Esc end it and
// it never auto-opens again; ? replays it from the lobby and mid-question, where the clock waits and the same question comes back;
// the question says what counts; ✓ sits beside the answer, grey until a number; the pad keys are 44 px; 5 round dots follow the answers.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function open(browser, motion) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: motion ? 'no-preference' : 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('countVoice', 'off');   // V101.373: the voice slows scene 1 — count-voice-qa covers it
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
  return { page, errors };
}
const cap = (page) => page.$eval('#cg-tcap', (e) => e.textContent);

(async () => {
  const browser = await chromium.launch();
  // ---- motion allowed: first open = the tour, scene 1 lights up step by step ----
  const { page, errors } = await open(browser, true);
  await page.evaluate(() => countOpen());
  assert.ok(await page.$('#cg-tour'), 'the first open plays the tour'); assert.equal(await page.$('#cg-rect'), null, 'not the lobby');
  assert.match(await cap(page), /^① ช่องซ้าย/);
  await page.waitForFunction(() => /^③ รวมทั้งกรอบ = 3 รูป/.test(document.getElementById('cg-tcap').textContent), null, { timeout: 4000 });
  assert.equal(await page.$$eval('.cg-tsteps span.on', (e) => e.length), 3, '① ② ③ all lit');
  assert.equal(await page.$$eval('#cg-tfig rect[stroke="#ea580c"]', (r) => r.length), 1, 'one rectangle lit at a time');
  const tops = [];
  for (let i = 0; i < 3; i++) { tops.push(await page.$eval('#cg-tnext', (b) => Math.round(b.getBoundingClientRect().top))); if (i < 2) await page.click('#cg-tnext'); }
  assert.equal(new Set(tops).size, 1, 'fixed height: ถัดไป ▸ does not move ' + tops);
  assert.equal(await page.textContent('#cg-tnext'), '▸ เริ่ม');
  await page.click('#cg-tnext');
  assert.ok(await page.isVisible('#cg-rect'), '▸ เริ่ม → the lobby'); assert.equal(await page.evaluate(() => localStorage.getItem('countTourSeen')), '1');
  await page.evaluate(() => { CG.close(); countOpen(); });
  assert.ok(await page.isVisible('#cg-rect'), 'never auto-opens again');

  // ---- a question: fuller question, ✓ beside the answer (grey until a number), 44 px keys, dots ----
  await page.click('#cg-rect');
  const q = await page.evaluate(() => ({ ask: document.getElementById('cg-ask').textContent, okRow: document.getElementById('cg-ok').parentElement.className, okBg: getComputedStyle(document.getElementById('cg-ok')).backgroundColor, inPad: !!document.querySelector('.cg-pad #cg-ok'), keyH: Math.round(document.querySelector('.cg-pad button').getBoundingClientRect().height), dots: [...document.querySelectorAll('.cg-dots i')].map((i) => i.className) }));
  assert.deepEqual(q, { ask: 'มีสี่เหลี่ยมกี่รูป?รวมรูปซ้อน · รวมกรอบนอก', okRow: 'cg-row', okBg: 'rgb(226, 232, 240)', inPad: false, keyH: 44, dots: ['now', '', '', '', ''] }, 'question, answer row, grey ✓, 44 px keys, dots');
  await page.click('.cg-pad button:text-is("1")');
  assert.equal(await page.$eval('#cg-ok', (b) => getComputedStyle(b).backgroundColor), 'rgb(249, 115, 22)', '✓ turns orange with a number');

  // ---- ? mid-question: the clock waits, the same question comes back ----
  const before = await page.evaluate(() => { const g = CG._g(); return { left: g.left, n: CG._count(g.p), typed: g.typed }; });
  await page.click('#cg-help'); assert.ok(await page.$('#cg-tour'));
  await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(() => CG._g().left), before.left, 'the clock waits during the tour');
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => { const g = CG._g(); return { left: g.left, n: CG._count(g.p), typed: g.typed, ans: document.getElementById('cg-ans').textContent }; });
  assert.deepEqual(after, { ...before, ans: before.typed }, 'Esc → the same question, what I typed kept');
  await page.evaluate(() => { const g = CG._g(); CG.key('del'); String(CG._count(g.p)).split('').forEach((d) => CG.key(+d)); CG.ok(); CG.next(); });
  assert.deepEqual(await page.$$eval('.cg-dots i', (e) => e.map((i) => i.className)), ['ok', 'now', '', '', ''], 'a right answer turns its dot green');
  await page.evaluate(() => { CG.key(0); CG.ok(); });
  assert.equal(await page.$$eval('.cg-dots i.no', (e) => e.length), 1, 'a wrong one red');
  await page.evaluate(() => CG.start('cube'));
  assert.equal(await page.textContent('#cg-ask'), 'มีลูกบาศก์กี่ก้อน?รวมก้อนที่ถูกบัง');
  await page.evaluate(() => CG.close());
  await page.close();

  // ---- reduced motion: scene 1 shows ③ at once; ข้าม ends it ----
  const r = await open(browser, false);
  await r.page.evaluate(() => countOpen());
  assert.match(await cap(r.page), /^③ รวมทั้งกรอบ = 3 รูป/, 'reduced motion: the last step at once');
  await r.page.click('.cg-tskip'); assert.ok(await r.page.isVisible('#cg-rect'));
  await r.page.setViewportSize({ width: 320, height: 640 }); await r.page.click('#cg-help');
  assert.ok(await r.page.$eval('#countModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), 'tour fits 320 px');
  assert.deepEqual([...errors, ...r.errors], []);
  await browser.close();
  console.log('count-tour-qa: OK — first open = tour, ① ② ③ step by step (at once with reduced motion), ถัดไป fixed, never again, ? replays and the clock waits, fuller question, ✓ grey → orange beside the answer, 44 px keys, dots, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
