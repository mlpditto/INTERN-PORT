// V101.374 ⚫⚪ ไพ่เงา ❓ วิธีเล่น (owner pick A, mockup-shadow-tutorial/tutorial-ABC.png) on the REAL index.html, 390×844 touch phone.
// Proves: the first open plays a 4-scene tour inside the popup (not the lobby) and reads scene 1 aloud; ถัดไป ▸ stays in one place and
// each scene plays its own clip (the last one stops first); ▸ เริ่ม lands on the lobby and the tour never opens by itself again; ❓ in
// the lobby replays it; 🔇 (the game's own sound switch) stops the voice and nothing plays while muted; ข้าม / ✕ stop it; it fits
// 320 px; the 4 clips exist and are small. Audio is stubbed — real sound needs a phone.
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
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.__played = []; window.Audio = function (src) { this.src = src; this.paused = true; };
    window.Audio.prototype.play = function () { this.paused = false; window.__played.push(this.src); return Promise.resolve(); };
    window.Audio.prototype.pause = function () { if (!this.paused) window.__played.push('stop'); this.paused = true; };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
  const played = () => page.evaluate(() => window.__played.slice());

  // first open → the tour, scene 1 read aloud
  await page.evaluate(() => bwOpen());
  assert.ok(await page.$('#bw-tour'), 'first open = the tour'); assert.equal(await page.$('#bw-start'), null, 'not the lobby');
  assert.match(await page.textContent('#bw-tcap'), /^คุณมีไพ่ 0–8/);
  assert.equal(await page.$$eval('#bw-tour .bw-hand button', (b) => b.length), 9, 'scene 1 shows the 3×3 hand');
  assert.deepEqual(await played(), ['shadow-voice/t1.mp3']);
  // ถัดไป ▸ fixed; each scene its clip
  const tops = [], caps = [];
  for (let i = 0; i < 4; i++) {
    tops.push(await page.$eval('#bw-tnext', (b) => Math.round(b.getBoundingClientRect().top)));
    caps.push((await page.textContent('#bw-tcap')).slice(0, 12));
    if (i < 3) await page.click('#bw-tnext');
  }
  assert.equal(new Set(tops).size, 1, 'ถัดไป ▸ does not move ' + tops);
  assert.match(caps[1], /^ลงคว่ำ/); assert.match(caps[2], /^เลขสูงกว่า/); assert.match(caps[3], /^📓/);
  assert.deepEqual(await played(), ['shadow-voice/t1.mp3', 'stop', 'shadow-voice/t2.mp3', 'stop', 'shadow-voice/t3.mp3', 'stop', 'shadow-voice/t4.mp3']);
  assert.equal(await page.textContent('#bw-tnext'), '▸ เริ่ม');
  await page.click('#bw-tnext');
  assert.ok(await page.isVisible('#bw-start'), '▸ เริ่ม → the lobby'); assert.equal((await played()).slice(-1)[0], 'stop', 'the voice stops');
  assert.equal(await page.evaluate(() => localStorage.getItem('bwTourSeen')), '1');
  await page.evaluate(() => { BW.close(); bwOpen(); });
  assert.ok(await page.isVisible('#bw-start'), 'never opens by itself again');
  // ❓ replays; 🔇 stops the voice, kept, nothing plays while muted
  await page.evaluate(() => { window.__played = []; }); await page.click('#bw-help');
  assert.ok(await page.$('#bw-tour')); assert.deepEqual(await played(), ['shadow-voice/t1.mp3'], '❓ replays with the voice');
  await page.click('#bw-snd');
  assert.equal(await page.evaluate(() => localStorage.getItem('shadowSound')), 'off'); assert.equal((await played()).slice(-1)[0], 'stop', '🔇 stops it');
  await page.evaluate(() => { window.__played = []; }); await page.click('#bw-tnext');
  assert.deepEqual(await played(), [], 'muted: no clip');
  await page.click('#bw-snd'); assert.deepEqual(await played(), ['shadow-voice/t2.mp3'], '🔊 again reads the scene it is on');
  await page.click('.bw-tskip'); assert.deepEqual((await played()).slice(-1), ['stop'], 'ข้าม stops it'); assert.ok(await page.isVisible('#bw-start'));
  await page.evaluate(() => { BW.tour(); window.__played = []; BW.close(); });
  assert.deepEqual(await played(), ['stop'], 'closing the popup stops it');
  // 320 px
  await page.setViewportSize({ width: 320, height: 640 }); await page.evaluate(() => { bwOpen(); BW.tour(); });
  for (let i = 0; i < 4; i++) {
    assert.ok(await page.$eval('#bwModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), 'scene ' + (i + 1) + ' fits 320 px');
    if (i < 3) await page.click('#bw-tnext');
  }
  for (const n of [1, 2, 3, 4]) { const b = fs.statSync('public/shadow-voice/t' + n + '.mp3').size; assert.ok(b > 20000 && b < 100000, 't' + n + ' ' + b); }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('shadow-tour-qa: OK — first open = 4-scene tour read aloud (t1…t4, Paxa foithong), ถัดไป fixed, ▸ เริ่ม → lobby and never again, ❓ replays, 🔇/🔊 stops / resumes the voice, ข้าม / ✕ stop it, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
