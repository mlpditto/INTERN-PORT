// V101.343 (owner, voice Foi Thong): each How to play card reads itself aloud from public/cereal-voice/s1…s9.mp3 + c-<hint>.mp3 (made once with Paxa TTS).
// 🔊 / 🔇 in the card header is the game's sound switch (CKSound, cerealSound); a refused play (no tap yet) makes the chip pulse and a tap
// plays; a new card / ✕ stop the clip; with ▶ auto on, the clip's end turns the card. The REAL index.html on a phone, nothing leaves the page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  // the nine files exist, are small, and are real MP3s
  for (const n of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'c-home', 'c-path', 'c-chips', 'c-lock', 'c-cafe', 'c-move', 'c-ask', 'c-arrest']) {
    const f = path.resolve('public/cereal-voice/' + n + '.mp3'), b = fs.readFileSync(f);
    assert.ok(b.length > 15000 && b.length < 150000, n + '.mp3 size ' + b.length);
    assert.ok(b[0] === 0xff || b.slice(0, 3).toString() === 'ID3', n + '.mp3 is an MP3');
  }
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1');
      window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
      const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
      // the phone's media element: records plays; the first play is refused like iPhone / LINE before a tap
      window.__plays = []; window.__refuse = 1;
      HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src.replace(/^.*\/(cereal-voice\/[^?]+).*$/, '$1')); this.__on = true; if (window.__refuse > 0) { window.__refuse--; this.__on = false; return Promise.reject(new DOMException('no tap', 'NotAllowedError')); } return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () { this.__on = false; window.__pauses = (window.__pauses || 0) + 1; };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const o = document.getElementById('loading-overlay'); if (o) o.style.setProperty('display', 'none', 'important'); cerealOpen(); });
    await page.waitForSelector('#cerealTour .ct-voice');
    await page.waitForTimeout(50);
    const v = () => page.evaluate(() => { const b = document.querySelector('#cerealTour .ct-voice'); return { plays: window.__plays.slice(), chip: b && b.textContent, wait: b && b.classList.contains('wait'), pressed: b && b.getAttribute('aria-pressed') }; });

    let s = await v();
    assert.deepEqual(s.plays, ['cereal-voice/s1.mp3'], 'card 1 tries its clip when the tour opens');
    assert.equal(s.chip, '🔊'); assert.equal(s.wait, true, 'refused (no tap yet): the 🔊 chip pulses');
    await page.click('#cerealTour .ct-voice');
    s = await v();
    assert.deepEqual(s.plays, ['cereal-voice/s1.mp3', 'cereal-voice/s1.mp3'], 'a tap on the pulsing chip plays card 1');
    assert.equal(s.wait, false, 'played: the chip stops pulsing');

    // each card turns its own clip; the chip sits between the step pill and ✕
    for (let i = 2; i <= 9; i++) await page.click('#cerealTour [data-ct="next"]');
    s = await v();
    assert.deepEqual(s.plays.slice(2), [2, 3, 4, 5, 6, 7, 8, 9].map(i => 'cereal-voice/s' + i + '.mp3'), 'ถัดไป plays the next card');
    assert.deepEqual(await page.evaluate(() => [...document.querySelector('#cerealTour .ct-top').children].map(e => e.className || e.tagName)), ['H3', 'ct-pill', 'ct-voice', 'ct-x'], 'header: title · pill · 🔊 · ✕');
    await page.click('#cerealTour [data-ct="close"]');
    assert.equal(await page.evaluate(() => !!document.getElementById('cerealTour')), false);
    assert.equal(await page.evaluate(() => CKTour._voice().src.includes('s9.mp3') && window.__pauses > 0), true, 'ปิด stops the clip');

    // 🔇: the game's sound switch; nothing plays on the next card; 🔊 again plays this card
    await page.evaluate(() => CKTour.open());
    await page.waitForSelector('#cerealTour .ct-voice');
    const n0 = (await v()).plays.length;
    await page.click('#cerealTour .ct-voice');
    s = await v();
    assert.equal(s.chip, '🔇'); assert.equal(s.pressed, 'false');
    assert.equal(await page.evaluate(() => localStorage.getItem('cerealSound')), 'off', 'the same switch as the game header');
    await page.click('#cerealTour [data-ct="next"]');
    assert.equal((await v()).plays.length, n0, '🔇: no clip on the next card');
    await page.click('#cerealTour .ct-voice');
    s = await v();
    assert.equal(s.chip, '🔊'); assert.equal(s.plays[s.plays.length - 1], 'cereal-voice/s2.mp3', '🔊 again plays this card');

    // ▶ auto with 🔊: the clip's end turns the card (not the 6 s timer)
    await page.click('#cerealTour [data-ct="auto"]');
    assert.equal(await page.evaluate(() => document.querySelector('#cerealTour [data-ct="auto"]').getAttribute('aria-pressed')), 'true');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.querySelector('#cerealTour .ct-pill').textContent), '2 / 8', 'no 6 s timer while the clip plays');
    await page.evaluate(() => CKTour._end());   // the clip ends (QA hook fires the Audio's onended)
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.querySelector('#cerealTour .ct-pill').textContent), '3 / 8', 'auto: the clip end turns the card after 0.8 s');
    await page.click('#cerealTour [data-ct="auto"]');
    await page.keyboard.press('Escape');

    // first-turn coach marks read themselves (c-<key>.mp3); closing the hint stops it; 🔇 = silent
    await page.evaluate(() => { localStorage.setItem('cerealSound', 'on'); localStorage.removeItem('cerealCoachSeen'); window.__pauses = 0; });
    for (const k of ['home', 'path', 'chips', 'lock', 'cafe', 'move', 'ask', 'arrest']) {
      const before = (await v()).plays.length;
      await page.evaluate((k) => CKTour.coach(k), k);
      const p = (await v()).plays;
      assert.equal(p.length, before + 1, 'coach ' + k + ' plays once'); assert.equal(p[p.length - 1], 'cereal-voice/c-' + k + '.mp3');
    }
    await page.evaluate(() => CKTour.hideCoach());
    assert.ok(await page.evaluate(() => window.__pauses > 0), 'closing the hint stops its clip');
    await page.evaluate(() => { localStorage.setItem('cerealSound', 'off'); localStorage.removeItem('cerealCoachSeen'); });
    const nC = (await v()).plays.length; await page.evaluate(() => CKTour.coach('home'));
    assert.equal((await v()).plays.length, nC, '🔇: hints stay silent');
    assert.deepEqual(errors, []);
    console.log('cereal-voice-qa: OK — 8 coach clips play with their hint, stop when it closes, silent on 🔇; — 9 clips (< 150 KB, MP3), card n plays s<n>, refused play → pulsing 🔊 → tap plays, ปิด stops, 🔇 = game switch (cerealSound off, silent), ▶ auto turns on the clip end');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
