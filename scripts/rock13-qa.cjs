// V101.382 🪨 Carry 13 · ฝึกกับ 🤖 (owner 2026-11-27, docs/MIND-GAMES-PLAN.md §8, pick A3 mockup-rock13/) on the REAL index.html,
// 390×844. Proves: the 6th tile opens it; the first open plays a 5-scene tour of the rules read aloud (t1…t5), ❓ replays, 🔊/🔇 kept;
// the lobby rails 👥 3–7 and 7 │ 14 รอบ are remembered; a round: ▸ ส่ง waits for a card + a chip, used ones grey out, the bots
// place in the queue's order, at your turn ▸ วาง shows what it does (💥 when it takes stones), ⏭ Pass shows only when allowed,
// 🌈 asks you to tap a carrier; the carriers hold cube stones; a full 7-round game ends with a ranking where everyone's 🪨 matches
// the rules; game_plays game 'rock13' mode 'bot' with win and score; 320 px fits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.__played = []; window.Audio = function (src) { this.src = src; this.paused = true; };
    window.Audio.prototype.play = function () { this.paused = false; window.__played.push(this.src); return Promise.resolve(); };
    window.Audio.prototype.pause = function () { if (!this.paused) window.__played.push('stop'); this.paused = true; };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.reject(new Error('off')) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    window.__logs = []; const see = GameLog.see; GameLog.see = function (gm, s) { window.__logs.push(Object.assign({ g: gm }, s)); return see.apply(this, arguments); };
  });

  // the doorway: the 6th tile; the first open = the tour, read aloud
  const tiles = await page.$$eval('#u-games-row .u-game', (b) => b.map((x) => x.textContent.replace(/\s+/g, '')));
  assert.equal(tiles.length, 6); assert.match(tiles[5], /🪨Carry13/);
  await page.click('#u-games-row .u-game:nth-child(6)');
  assert.ok(await page.isVisible('#r13-tour'), 'first open = the tour'); assert.deepEqual(await page.evaluate(() => window.__played), ['rock13-voice/t1.mp3']);
  const caps = [];
  for (let i = 0; i < 5; i++) { caps.push(await page.textContent('#r13-tcap')); await page.click('#r13-tnext'); }
  assert.ok(!caps.join(' ').match(/เคล็ด|กับดัก|ควร|เก็บไว้/), 'the tour teaches rules only, no tactics');
  assert.deepEqual(await page.evaluate(() => window.__played), ['rock13-voice/t1.mp3', 'stop', 'rock13-voice/t2.mp3', 'stop', 'rock13-voice/t3.mp3', 'stop', 'rock13-voice/t4.mp3', 'stop', 'rock13-voice/t5.mp3', 'stop']);
  assert.ok(await page.isVisible('#r13-start')); assert.equal(await page.evaluate(() => localStorage.getItem('r13TourSeen')), '1');
  await page.click('#r13-help'); await page.click('#r13-voice'); assert.equal(await page.evaluate(() => localStorage.getItem('r13Voice')), 'off');
  await page.evaluate(() => { window.__played = []; }); await page.click('#r13-tnext'); assert.deepEqual(await page.evaluate(() => window.__played), [], '🔇 stays quiet');
  await page.evaluate(() => R13.tourEnd());

  // the lobby rails
  await page.click('#r13-n4'); await page.click('#r13-r7');
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('r13Cfg'))), { n: 4, rounds: 7 });
  assert.match(await page.textContent('#r13Modal'), /คุณ \+ 🤖 3/);

  // play: seeded bots, no waiting
  await page.evaluate(() => { let s = 11; R13._rng(() => ((s = (s * 16807) % 2147483647) / 2147483647)); R13._speed(5); });
  await page.click('#r13-start');
  assert.equal(await page.$$eval('#r13Modal svg', (e) => e.length), 3, 'three carriers');
  assert.ok(await page.$eval('#r13-send', (b) => b.disabled), '▸ ส่ง waits for a card and a chip');
  let sawTurn = 0, sawPass = 0, sawRainbow = 0, sawBoom = 0;
  for (let guard = 0; guard < 200; guard++) {
    const st = await page.evaluate(() => { const g = R13._g(); return { phase: g.phase, turn: Rock13Rules.turn(g), round: g.round }; });
    if (st.phase === 'end') break;
    if (st.phase === 'submit') {
      const pick = await page.evaluate(() => { const p = R13._g().players[0]; return { card: p.cards[0], chip: ['w', 'r', 'g', 'b'].find((c) => p.chips[c] > 0) }; });
      await page.click('[data-card="' + pick.card + '"]'); await page.click('[data-chip="' + pick.chip + '"]');
      assert.match(await page.textContent('#r13-send'), new RegExp('ส่ง ' + pick.card));
      await page.click('#r13-send');
      if (st.round === 1) assert.ok(await page.isVisible('#r13-q'), 'the queue shows after the reveal');
      continue;
    }
    if (st.turn !== 0) { await page.waitForFunction(() => { const g = R13._g(); return g.phase !== 'place' || Rock13Rules.turn(g) === 0; }, null, { timeout: 5000 }); continue; }
    sawTurn++;
    const can = await page.evaluate(() => Rock13Rules.canPass(R13._g(), 0));
    assert.equal(!!(await page.$('#r13-pass')), can, '⏭ only when allowed');
    if (can) sawPass++;
    const chip = await page.evaluate(() => R13._g().subs[0].chip);
    if (chip === 'w') {
      sawRainbow++; assert.match(await page.textContent('#r13-turn'), /แตะคนแบก/); assert.ok(await page.$('#r13-st-r.pick'));
      await page.click('#r13-st-b');
    } else {
      const t = await page.textContent('#r13-turn'), pv = await page.evaluate(() => { const g = R13._g(); return Rock13Rules.preview(g, 0, g.subs[0].chip); });
      assert.ok(t.includes('= ' + pv.total), 'the turn box says the new weight'); if (pv.take) { sawBoom++; assert.match(t, new RegExp('💥 เก็บ 🪨 ' + pv.take)); }
      if (can && sawPass === 1) { await page.click('#r13-pass'); continue; }
      await page.click('#r13-put');
    }
  }
  await page.waitForSelector('#r13-final');
  const g = await page.evaluate(() => R13._g());
  assert.equal(g.phase, 'end'); assert.equal(g.round, 7);
  const rows = await page.$$eval('#r13-rank div', (d) => d.map((x) => x.textContent));
  assert.equal(rows.length, 4); rows.forEach((r) => assert.match(r, /🪨 \d+/));
  const log = await page.evaluate(() => window.__logs.filter((x) => x.g === 'rock13' && x.done).slice(-1)[0]);
  assert.equal(log.mode, 'bot'); assert.equal(log.score, String(g.players[0].pen)); assert.ok(['w', 'l'].includes(log.win));
  assert.ok(sawTurn >= 7 && sawRainbow >= 1 && sawPass >= 1, 'played my turns, 🌈 and ⏭ ' + JSON.stringify({ sawTurn, sawRainbow, sawPass, sawBoom }));
  await page.screenshot({ path: process.env.R13_SHOT || path.join(require('node:os').tmpdir(), 'r13-end.png') });
  await page.click('#r13-again'); assert.ok(await page.isVisible('#r13-send'), '↻ starts again');

  // 320 px
  await page.setViewportSize({ width: 320, height: 640 });
  assert.ok(await page.$eval('#r13Modal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits');
  assert.ok(await page.$eval('#u-games-row', (r) => [...r.children].every((b) => b.getBoundingClientRect().right <= r.getBoundingClientRect().right + 1)), 'the 6 tiles fit 320 px');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('rock13-qa: OK — 6th tile; 5-scene rules tour read aloud (no tactics), ❓ + 🔇 kept; 👥 3–7 + 7│14 remembered; ▸ ส่ง needs card + chip; bots place in queue order; ▸ วาง says the new weight / 💥; ⏭ only when allowed; 🌈 taps a carrier; 7 rounds to a ranking; logged rock13 bot; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
