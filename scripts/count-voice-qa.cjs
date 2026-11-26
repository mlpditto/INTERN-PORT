// V101.373 🧊 นับไว ❓ tour voice (owner "tutorial ครบ? ขอเสียงบรรยายไทยด้วย") on the REAL index.html, 390×844 touch phone. Audio is stubbed
// (real sound needs a phone): each scene plays its clip, 🔊/🔇 is remembered, ถัดไป / ข้าม / ✕ stop the clip.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function open(browser, motion) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: motion ? 'no-preference' : 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__played = []; window.Audio = function (src) { this.src = src; this.paused = true; }; window.Audio.prototype.play = function () { this.paused = false; window.__played.push(this.src); return Promise.resolve(); }; window.Audio.prototype.pause = function () { if (!this.paused) window.__played.push('stop'); this.paused = true; };
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen']) localStorage.setItem(k, '1');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
  return { page, errors };
}

const played = (page) => page.evaluate(() => window.__played.slice());
(async () => {
  const browser = await chromium.launch();
  const { page, errors } = await open(browser, true);
  // first open: scene 1 reads t1, 🔊 beside ✕ (pressed), scene 1 still reaches ③ at the slower pace
  await page.evaluate(() => countOpen());
  assert.deepEqual(await played(page), ['count-voice/t1.mp3']);
  assert.equal(await page.textContent('#cg-voice'), '🔊'); assert.equal(await page.getAttribute('#cg-voice', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#cg-tcap'), /^① ช่องซ้าย/);
  await page.waitForTimeout(3000); assert.match(await page.textContent('#cg-tcap'), /^② ช่องขวา/, 'voice on: ② after 2.6 s, not 0.9 s');
  await page.waitForFunction(() => /^③/.test(document.getElementById('cg-tcap').textContent), null, { timeout: 4000 });
  // ถัดไป: the last clip stops, t2 plays; then t3
  await page.click('#cg-tnext'); await page.click('#cg-tnext');
  assert.deepEqual(await played(page), ['count-voice/t1.mp3', 'stop', 'count-voice/t2.mp3', 'stop', 'count-voice/t3.mp3']);
  // 🔇: stops, remembered, no clip on the next scene / replay
  await page.click('#cg-voice');
  assert.equal(await page.textContent('#cg-voice'), '🔇'); assert.equal(await page.evaluate(() => localStorage.getItem('countVoice')), 'off');
  assert.equal((await played(page)).slice(-1)[0], 'stop');
  await page.click('#cg-tnext'); await page.evaluate(() => { window.__played = []; CG.tour(); });
  assert.deepEqual(await played(page), [], 'muted: nothing plays');
  // 🔊 again: reads the scene it is on; ข้าม stops it
  await page.click('#cg-voice'); assert.deepEqual(await played(page), ['count-voice/t1.mp3']);
  await page.click('.cg-tskip'); assert.deepEqual(await played(page), ['count-voice/t1.mp3', 'stop'], 'ข้าม stops the voice');
  // ✕ on the popup mid-tour stops it too
  await page.evaluate(() => { CG.tour(); window.__played = []; CG.close(); });
  assert.deepEqual(await played(page), ['stop']);
  // the clips exist and are small
  const fs = require('node:fs');
  for (const n of [1, 2, 3]) { const b = fs.statSync('public/count-voice/t' + n + '.mp3').size; assert.ok(b > 20000 && b < 100000, 't' + n + ' ' + b); }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('count-voice-qa: OK — each ❓ scene reads t1…t3 (Paxa foithong), 🔊/🔇 beside ✕ remembered as countVoice, next / ข้าม / ✕ stop it, scene 1 keeps the voice pace');
})().catch((e) => { console.error(e); process.exit(1); });
