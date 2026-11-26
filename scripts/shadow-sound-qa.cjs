// V101.369 ⚫⚪ ไพ่เงา sounds (owner picked C · เกมตู้, mockup-shadow-sound/) on the REAL index.html, 390×844 touch phone.
// Proves, by the cue log (window.BWSound.log), that: 🤖 leading plays think → its colour (⚫ 'b' low / ⚪ 'w' high); a tap on a tile
// = 'pick', ▸ ลง = 'place' then — when I led — think → the 🤖 colour, then win / lose / draw; a 🧠 tap on a played tile = 'oops'; no
// number cue ('n0'…'n8') ever plays before the game ends; the end opens the 🤖 tiles one by one, each with its own number cue, then the
// end tune (with reduced motion: the end tune only); 🔇 silences everything and is kept on the phone (shadowSound = 'off'); 🔊/🔇 is in
// every header and the header fits 320 px.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function open(browser, motion) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: motion ? 'no-preference' : 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'bwTourSeen', 'countTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    let q = 11; Math.random = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); let s = 5; BW._rng(() => ((s = (s * 16807) % 2147483647) / 2147483647)); });
  return { page, errors };
}

// plays whole games through the real buttons' functions and checks each step's cues
const playGame = (page, level, still) => page.evaluate(([level, still]) => {
  const L = window.BWSound.log, bad = [], since = (k) => L.slice(k);
  BW.level(level); let k = L.length; BW.start(); const g = BW._g();
  const col = (n) => (n % 2 ? 'w' : 'b');
  const botLead = () => (g.lead === 'bot' ? ['think', col(g.botTile)] : []);
  if (JSON.stringify(since(k)) !== JSON.stringify(botLead())) bad.push('start ' + JSON.stringify(since(k)));
  while (!g.end) {
    const n = g.me[0], led = g.lead;
    k = L.length; BW.pick(n); if (JSON.stringify(since(k)) !== '["pick"]') bad.push('pick ' + JSON.stringify(since(k)));
    k = L.length; BW.play(); const h = g.hist[g.hist.length - 1];
    const want = ['place'].concat(!g.end && led === 'me' ? ['think', h.bc] : [], [h.res], g.end && still ? [g.sc.me > g.sc.bot ? 'endW' : g.sc.me < g.sc.bot ? 'endL' : 'endD'] : []);
    if (JSON.stringify(since(k)) !== JSON.stringify(want)) bad.push('play ' + JSON.stringify(since(k)) + ' want ' + JSON.stringify(want));
    if (!g.end) { k = L.length; BW.next(); if (JSON.stringify(since(k)) !== JSON.stringify(botLead())) bad.push('next ' + JSON.stringify(since(k))); }
  }
  return { bad, leak: L.some((x) => /^n\d$/.test(x)), bots: g.hist.map((h) => 'n' + h.b), end: g.sc.me > g.sc.bot ? 'endW' : g.sc.me < g.sc.bot ? 'endL' : 'endD', at: L.length };
}, [level, still]);

(async () => {
  const browser = await chromium.launch();
  // ---- reduced motion: every step's cues over 6 games, 🧠 oops, 🔇 ----
  const { page, errors } = await open(browser, false);
  await page.evaluate(() => bwOpen());
  assert.equal(await page.textContent('#bw-snd'), '🔊', '🔊 in the lobby header, on at first');
  let lastLeadBot = 0;
  for (let i = 0; i < 6; i++) {
    const r = await playGame(page, 1 + (i % 3), true);
    assert.deepEqual(r.bad, [], 'game ' + i);
    assert.equal(r.leak, false, 'no number cue before the end');
    assert.deepEqual(await page.evaluate((at) => window.BWSound.log.slice(at), r.at), [], 'reduced motion: the end tune came with the last ▸ ลง, nothing after');
    lastLeadBot += await page.evaluate(() => BW._g().hist.some((h) => h.lead === 'bot') ? 1 : 0);
    await page.evaluate(() => window.BWSound.log.length = 0);
  }
  assert.ok(lastLeadBot > 0, 'some rounds had 🤖 leading');
  // 🧠: a played tile → oops
  const oops = await page.evaluate(() => { BW.level(3); BW.start(); const g = BW._g(); if (g.lead === 'bot') {} const n = g.me[0]; BW.pick(n); BW.play(); BW.next(); const k = window.BWSound.log.length; BW.pick(n); return window.BWSound.log.slice(k); });
  assert.deepEqual(oops, ['oops'], '🧠 a played tile → oops');
  // header fits 320 px with 🔊
  await page.setViewportSize({ width: 320, height: 640 });
  const hdr = await page.evaluate(() => { const top = document.querySelector('#bwModal .bw-top'), s = document.getElementById('bw-snd'), x = document.querySelector('#bwModal .bw-x'); const r = top.getBoundingClientRect(); return { fits: s.getBoundingClientRect().right <= r.right + 1 && x.getBoundingClientRect().right <= r.right + 1, scroll: document.querySelector('#bwModal .modal-content').scrollWidth <= document.querySelector('#bwModal .modal-content').clientWidth + 1 }; });
  assert.deepEqual(hdr, { fits: true, scroll: true }, '320 px: 🔊 and ✕ fit');
  // 🔇: silence, kept
  await page.click('#bw-snd');
  assert.equal(await page.textContent('#bw-snd'), '🔇'); assert.equal(await page.evaluate(() => localStorage.getItem('shadowSound')), 'off');
  const k0 = await page.evaluate(() => window.BWSound.log.length);
  await playGame(page, 2, true);
  assert.equal(await page.evaluate(() => window.BWSound.log.length), k0, '🔇 plays nothing');
  await page.reload(); await page.evaluate(() => bwOpen());
  assert.equal(await page.textContent('#bw-snd'), '🔇', '🔇 kept after a reload');
  await page.click('#bw-snd'); assert.equal(await page.textContent('#bw-snd'), '🔊');
  assert.deepEqual(await page.evaluate(() => window.BWSound.log), ['pick'], '🔊 back on gives a little blip');
  await page.close();

  // ---- motion allowed: the end opens 🤖 tiles one by one, each with its number, then the tune ----
  const m = await open(browser, true);
  await m.page.evaluate(() => bwOpen());
  const r = await playGame(m.page, 2);
  assert.deepEqual(r.bad, []); assert.equal(r.leak, false);
  await m.page.waitForFunction((n) => window.BWSound.log.length >= n, r.at + r.bots.length + 1, { timeout: 9000 });
  assert.deepEqual(await m.page.evaluate((at) => window.BWSound.log.slice(at), r.at), [...r.bots, r.end], 'each 🤖 tile sounds its number as it opens, then the end tune');
  // a tap on the list opens the rest at once and plays the tune once
  const r2 = await playGame(m.page, 1);
  await m.page.waitForTimeout(500); await m.page.click('#bw-reveal');
  const tail = await m.page.evaluate((at) => window.BWSound.log.slice(at), r2.at);
  assert.equal(tail.filter((x) => /^end/.test(x)).length, 1, 'tap → the end tune once ' + tail);
  await m.page.waitForTimeout(1000);
  assert.equal((await m.page.evaluate((at) => window.BWSound.log.slice(at), r2.at)).filter((x) => /^end/.test(x)).length, 1, 'and never twice');
  assert.deepEqual([...errors, ...m.errors], []);
  await browser.close();
  console.log('shadow-sound-qa: OK — 🤖 lead think→colour, pick, place(→think→colour)→result, 🧠 oops, no number before the end, end: numbers one by one → tune (reduced motion: tune only), 🔇 kept, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
