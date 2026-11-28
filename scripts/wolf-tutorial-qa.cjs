// V101.357 — 🐺 Werewolf solo tutorial (owner pick A + B) and sound (pick B), on the REAL index.html, 390×844 touch phone, network
// blocked. Proves: the first 🐺 open shows 📖 วิธีเล่น (6 scenes, dots, ถัดไป, a dark night scene, ▶ auto remembered, ✕/▸ เริ่มเกม
// mark it seen, not again on reopen, ❓ in the lobby replays it, no sideways scroll at 320 px); first-turn hints appear once each
// (night-<role> under the seats, day, vote) and "ข้ามคำใบ้" stops them all; 🔊 / 🔇 in the game header is remembered and the tour
// shows the same; a whole game logs its cues in order (night first, vote, out / death / morning, win or lose last) and nothing
// plays before the first tap; with 🔇 the cues still log (for this script) but Web Audio is never created.
// V101.398 (owner pick A): 👆 under the seat it taps, dots are buttons, ‹ back, vote count low, morning line = practice reveals the role.
// V101.361 (pick D, fixed height): the tour plays INSIDE the 🐺 popup (not fixed / full screen), the lobby hides under it and comes back
// on close, ถัดไป ▸ stays in one place across scenes, the night scene darkens the popup; on a 927×960 PC screen the buttons sit inside
// the popup right under the content (the old full-screen page left ~500 px of empty space); closing the popup mid-tour ends the tour.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const voice = []; page.on('request', (r) => { const m = /wolf-voice\/([\w-]+)\.mp3/.exec(r.url()); if (m) voice.push(m[1]); });
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen']) localStorage.setItem(k, '1');
    window.__acMade = 0; const AC = window.AudioContext; window.AudioContext = function () { window.__acMade++; return new AC(); };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });

  // A · the tour opens the first time
  await page.evaluate(() => wolfOpen());
  assert.equal(await page.evaluate(() => WWSound._log.length), 0, 'nothing plays before a tap');
  assert.equal(await page.$eval('#wolfTour', (e) => getComputedStyle(e).display), 'block', 'the first open shows 📖 วิธีเล่น');
  const inPop = await page.evaluate(() => { const t = document.getElementById('wolfTour'); return { parent: t.parentElement.matches('#wolfModal .modal-content'), pos: getComputedStyle(t).position, lobby: getComputedStyle(document.getElementById('ww-body')).display }; });
  assert.deepEqual(inPop, { parent: true, pos: 'static', lobby: 'none' }, 'pick D: inside the 🐺 popup, the lobby hidden under it');
  const navTop = [], popDark = [];
  for (let i = 0; i < 6; i++) { await page.evaluate((i) => WWTour.go(i), i); navTop.push(await page.$eval('#wt-next', (b) => Math.round(b.getBoundingClientRect().top))); popDark.push(await page.$eval('#wolfModal .modal-content', (m) => getComputedStyle(m).backgroundColor === 'rgb(30, 27, 75)')); }
  assert.equal(new Set(navTop).size, 1, 'fixed height: ถัดไป ▸ does not move between scenes ' + navTop);
  assert.deepEqual(popDark, [false, true, false, false, false, false], 'the night scene darkens the whole popup');
  await page.evaluate(() => WWTour.go(0));
  const scenes = [];
  for (let i = 0; i < 6; i++) {
    scenes.push(await page.evaluate(() => ({ t: document.querySelector('#wolfTour .wt-top h3').innerText, dark: document.getElementById('wolfTour').classList.contains('dark'), dot: [...document.querySelectorAll('#wolfTour .wt-dots .wt-dot')].findIndex((d) => d.classList.contains('on')), say: document.getElementById('wt-say').innerText })));
    if (i < 5) await page.click('#wt-next');
  }
  assert.deepEqual(scenes.map((x) => x.dot), [0, 1, 2, 3, 4, 5], 'six scenes, the dot follows');
  // V101.398 (owner pick A): the 👆 under the seat it taps (the name readable), dots you can tap, ‹ back from scene 2 on, the vote count in the lower corner, the morning line says practice reveals the role
  const geo = (i) => page.evaluate((i) => { WWTour.go(i); const s = document.querySelector('#wolfTour .wt-seat.tap'), f = document.querySelector('#wolfTour .wt-fing'), seats = document.querySelector('#wolfTour .wt-seats'), vc = document.querySelector('#wolfTour .wt-seat.tap .vc'); const sr = s.getBoundingClientRect(), fr = f.getBoundingClientRect(), nx = seats.nextElementSibling.getBoundingClientRect(); return { under: fr.top >= sr.bottom - 8, x: Math.abs((fr.left + fr.right) / 2 - (sr.left + sr.right) / 2) < 14, clear: fr.bottom <= nx.top + 1, vc: vc ? vc.getBoundingClientRect().top > (sr.top + sr.bottom) / 2 : null }; }, i);
  for (const i of [1, 3, 4]) assert.deepEqual(await geo(i), { under: true, x: true, clear: true, vc: i === 4 ? true : null }, 'scene ' + (i + 1) + ': 👆 under its seat, centred, not over the next block; the vote count low');
  assert.match(scenes[2].say, /เป็น 🔮 \(ฝึกกับ 🤖\)[\s\S]*Practice shows the dead one’s role\./, 'the morning line says practice reveals the role');
  await page.evaluate(() => WWTour.go(0)); assert.equal(await page.$('#wt-prev'), null, 'scene 1: no ‹');
  await page.click('#wolfTour .wt-dots .wt-dot:nth-child(4)'); assert.equal(await page.$eval('#wolfTour .wt-top h3', (h) => h.innerText), '☀️ วัน 1', 'tap the 4th dot → scene 4');
  assert.ok(await page.$eval('#wolfTour .wt-dots .wt-dot', (d) => d.getBoundingClientRect().height >= 28 && d.getBoundingClientRect().width >= 30), 'each dot is a 30 × 28 px target');
  await page.click('#wt-prev'); assert.equal(await page.$eval('#wolfTour .wt-top h3', (h) => h.innerText), '☀️ เช้าวันที่ 1', '‹ goes back one scene');
  await page.evaluate(() => WWTour.go(5)); assert.ok(await page.$('#wt-prev'), 'the last scene has ‹ too');
  for (let i = 0; i < 30 && !voice.includes('s6'); i++) await page.waitForTimeout(100);   // the last clip's request can land after the click on a slow runner
  assert.deepEqual([...new Set(voice)].sort(), ['s1', 's2', 's3', 's4', 's5', 's6'], 'each scene reads itself (wolf-voice/sN.mp3): ' + voice);
  assert.ok(require('fs').existsSync('public/wolf-voice/c-vote.mp3') && require('fs').existsSync('public/wolf-voice/c-night-villager.mp3'), 'all 13 clips are in the repo');
  assert.deepEqual(scenes.map((x) => x.dark), [false, true, false, false, false, false], 'the night scene is dark');
  assert.match(scenes[0].t, /วิธีเล่น/, 'Thai is VISIBLE (innerText — lang-toggle.js hides Thai outside .lang-no-toggle)');
  assert.match(scenes[0].say, /บทลับ/); assert.match(scenes[3].say, /สงสัย/); assert.match(scenes[4].say, /เสมอ = ไม่มีใครออก/);
  const w = await page.$eval('#wolfModal .modal-content', (e) => e.scrollWidth - e.clientWidth); assert.ok(w <= 1);
  await page.setViewportSize({ width: 320, height: 700 }); await page.evaluate(() => WWTour.go(3));
  assert.ok(await page.$eval('#wolfModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), 'no sideways scroll at 320 px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => WWTour.go(0)); await page.click('#wt-auto');
  assert.equal(await page.evaluate(() => localStorage.getItem('wolfTourAuto')), 'on', '▶ auto is remembered');
  await page.click('#wt-auto');
  await page.evaluate(() => WWTour.go(5)); await page.click('#wt-next');   // ▸ เริ่มเกม
  assert.equal(await page.$eval('#wolfTour', (e) => getComputedStyle(e).display), 'none');
  assert.equal(await page.evaluate(() => localStorage.getItem('wolfTourSeen')), '1');
  await page.evaluate(() => { WW.close(); wolfOpen(); });
  assert.equal(await page.$eval('#wolfTour', (e) => getComputedStyle(e).display), 'none', 'not again on reopen');
  const hdr = await page.evaluate(() => { const t = document.querySelector('#wolfModal .ww-top'), x = [...t.querySelectorAll('.ww-x')].pop(), h = t.querySelector('h3'); return [Math.abs(x.getBoundingClientRect().top - h.getBoundingClientRect().top) < 12, !!t.querySelector('#ww-snd')]; });
  assert.deepEqual(hdr, [true, false], 'the lobby header stays on one row (❓, no 🔊 there)');
  await page.setViewportSize({ width: 320, height: 700 });
  assert.ok(await page.evaluate(() => { const t = document.querySelector('#wolfModal .ww-top'), x = [...t.querySelectorAll('.ww-x')].pop(), h = t.querySelector('h3'); return Math.abs(x.getBoundingClientRect().top - h.getBoundingClientRect().top) < 12; }), 'one row at 320 px too');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#ww-help');
  assert.equal(await page.$eval('#wolfTour', (e) => getComputedStyle(e).display), 'block', '❓ replays it');
  await page.evaluate(() => WWTour.close());
  assert.equal(await page.$eval('#ww-body', (e) => getComputedStyle(e).display), 'block', 'close → the lobby is back in the same popup');
  // a tall PC screen (the owner's 927×960): the buttons sit right under the content, inside the popup
  await page.setViewportSize({ width: 927, height: 960 }); await page.click('#ww-help');
  const pc = await page.evaluate(() => { const m = document.querySelector('#wolfModal .modal-content').getBoundingClientRect(), d = document.querySelector('#wolfTour .wt-dots').getBoundingClientRect(), n = document.getElementById('wt-next').getBoundingClientRect(); return { inside: n.bottom <= m.bottom && n.top >= m.top, gap: Math.round(n.top - d.bottom), popH: Math.round(m.height) }; });
  assert.ok(pc.inside && pc.gap < 200 && pc.popH < 760, 'PC: ถัดไป inside the popup, near the content ' + JSON.stringify(pc));
  await page.evaluate(() => WW.close()); await page.evaluate(() => wolfOpen());
  assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.getElementById('wolfTour')).display, getComputedStyle(document.getElementById('ww-body')).display]), ['none', 'block'], 'closing the popup mid-tour ends the tour; the next open shows the lobby');
  await page.setViewportSize({ width: 390, height: 844 });

  // B · first-turn hints, once each
  const seed = (s) => page.evaluate((s) => { let a = s; WW._rng(() => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }); }, s);
  let role = null;
  for (let s = 3; s < 80; s++) { await seed(s); role = await page.evaluate(() => { WW.set('n', 7); WW.start(); return WW._game().st.roles.p1; }); if (role !== 'witch') break; await page.evaluate(() => WW.back()); }
  assert.equal(await page.$eval('#ww-card', (c) => getComputedStyle(c).animationName), 'none', 'reduced motion: the card does not turn');
  await page.click('#ww-go');   // 🌙 เข้าสู่คืนแรก — a tap
  const coach = () => page.$eval('#ww-coach', (c) => [c.previousElementSibling.className, c.textContent]).catch(() => null);
  const c1 = await coach();
  assert.ok(c1 && c1[0] === 'ww-seats', 'the night hint sits under the seats: ' + JSON.stringify(c1));
  assert.match(c1[1], { wolf: /แตะคนที่จะกัด/, seer: /แตะคนที่จะส่อง/, guard: /แตะคนที่จะคุ้มกัน/, villager: /ไม่มีพลังกลางคืน/ }[role]);
  assert.deepEqual(await page.evaluate(() => WWSound._log.slice()), ['night'], 'nightfall howls on the tap');
  // a re-render does not show the same hint again
  await page.evaluate(() => WW.tap(WW._game().ids[1])); assert.equal(await coach(), null, 'each hint once');
  // play on to the day
  for (let i = 0; i < 3 && await page.evaluate(() => WW._game().phase === 'night'); i++) { const p = await page.$('#wolfModal .ww-seat.pick'); if (p) await p.click(); await page.click('#ww-night-go'); }
  const ph = await page.evaluate(() => WW._game().phase);
  assert.equal(ph, 'day', '7 players never end on night 1');
  {
    assert.match((await coach())[1], /ป้ายใต้ชื่อ/, 'the first day hint');
    await page.click('#ww-coach .sk');   // ข้ามคำใบ้
    assert.equal(await page.evaluate(() => localStorage.getItem('wolfCoachSeen')), 'all');
    await page.click('#ww-to-vote');
    assert.equal(await coach(), null, 'after ข้ามคำใบ้ no vote hint');
  }
  // C · sound: the log follows the game; 🔇 is remembered and silences Web Audio
  const log = await page.evaluate(() => WWSound._log.slice());
  assert.equal(log[0], 'night'); assert.ok(log.some((k) => k === 'morning' || k === 'death'), 'morning / death after the night: ' + log);
  assert.equal(log[log.length - 1], 'vote', 'drums for the vote: ' + log);
  assert.equal(await page.textContent('#ww-snd'), '🔊');
  await page.click('#ww-snd');
  assert.equal(await page.textContent('#ww-snd'), '🔇'); assert.equal(await page.evaluate(() => localStorage.getItem('wolfSound')), 'off');
  const v0 = voice.length;
  await page.evaluate(() => WWTour.open()); assert.equal(await page.textContent('#wt-snd'), '🔇', 'the tour shows the same switch'); await page.evaluate(() => WWTour.close());
  assert.equal(voice.length, v0, '🔇: the tour reads nothing');
  // finish a game with 🔇: cues log, no new AudioContext
  const made = await page.evaluate(() => window.__acMade);
  for (let step = 0; step < 80 && await page.evaluate(() => WW._game().phase !== 'over'); step++) {
    const p2 = await page.evaluate(() => WW._game().phase), alive = await page.evaluate(() => !!WW._game().st.alive.p1);
    if (p2 === 'night') { const p = await page.$('#wolfModal .ww-seat.pick'); if (alive && p) await p.click(); await page.click('#ww-night-go'); }
    else if (p2 === 'day') await page.click('#ww-to-vote');
    else { if (alive) await page.click('#ww-skip'); await page.click('#ww-vote'); }
  }
  const end = await page.evaluate(() => WWSound._log.slice(-1)[0]);
  assert.ok(end === 'win' || end === 'lose', 'the game ends on win / lose: ' + end);
  assert.equal(await page.evaluate(() => window.__acMade), made, '🔇: no Web Audio made');
  assert.ok(made >= 1, '🔊: Web Audio was made on the first tap');
  assert.deepEqual(errors, [], 'no page errors');
  await browser.close();
  console.log('wolf-tutorial-qa: OK — tour 6 scenes (dark night, auto, seen, ❓, 320 px), hints once + skip, cues in order, 🔇 remembered + silent');
})().catch((e) => { console.error(e); process.exit(1); });
