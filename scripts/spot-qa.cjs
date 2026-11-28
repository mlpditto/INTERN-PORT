// V101.391 🪞 Memory Fracture · practice (owner 2026-11-28, docs/MEMORY-SPOT-PLAN.md PR 1, layout C mockup-memory-fracture/) on the REAL
// index.html, 390×844. Proves: every generated change really changes its slot and nothing else changes (3 levels × 300 seeds); the
// scoring and 💎; the 7th tile opens it; the first open plays a 5-scene tour of the rules read aloud (spot-voice/t1…t5, files present),
// no tactics; the level rail is remembered; a round walks 👀 → 🎲 → 🔍 → 📊 on the rail with the seconds in the step you are in, by the
// clock too (look → bet → ×1 → find → reveal); bets you cannot pay are greyed; taps toggle and stop at changes + 2; the reveal marks
// found / missed / wrong and names every change; 3 rounds end with game_plays game 'spot' mode 'l<level>'; 320 px fits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const S = require('../public/spot-scene.js');

// ---- the shelf + changes, pure ----
for (const lv of [1, 2, 3]) {
  for (let seed = 1; seed <= 300; seed++) {
    const sc = S.make(lv, seed), L = S.LEVELS[lv];
    assert.equal(sc.diffs.length, L.diffs, `level ${lv} seed ${seed}: ${L.diffs} changes`);
    assert.equal(sc.orig.length, L.cols * L.rows);
    const cells = sc.diffs.flatMap((d) => d.cells);
    assert.equal(new Set(cells).size, cells.length, 'a slot changes at most once');
    sc.orig.forEach((o, i) => assert.equal(JSON.stringify(o) !== JSON.stringify(sc.changed[i]), cells.includes(i), `level ${lv} seed ${seed} slot ${i}: changed ⇔ listed`));
    sc.diffs.forEach((d) => { assert.ok(L.kinds.includes(d.kind)); assert.ok(d.say.length > 4); });
    assert.deepEqual(S.make(lv, seed), sc, 'same seed, same shelf');
  }
}
{ // a look-alike only ever turns into its partner, at a strength the partner has
  for (let seed = 1; seed <= 300; seed++) {
    const sc = S.make(3, seed);
    sc.diffs.filter((d) => d.kind === 'lasa').forEach((d) => { const a = sc.orig[d.cells[0]], b = sc.changed[d.cells[0]], A = S.DRUGS.find((x) => x[0] === a.name), B = S.DRUGS.find((x) => x[0] === b.name); assert.equal(A[5], b.name); assert.ok(B[1].includes(a.dose)); });
  }
}
{ // scoring: (found − wrong) × bet; 💎: ×1.5 −1, ×2 −2 and −1 more past 2 wrong, all found with no wrong +1
  const sc = S.make(2, 9), all = sc.diffs.map((d) => d.cells[0]), bad = sc.orig.map((x, i) => i).filter((i) => !sc.diffs.some((d) => d.cells.includes(i)));
  assert.deepEqual(['n', 'raw', 'pts', 'gem'].map((k) => S.score(sc, all, 1)[k]), [6, 6, 6, 1]);
  assert.deepEqual(['n', 'raw', 'pts', 'gem'].map((k) => S.score(sc, all.slice(0, 4).concat(bad.slice(0, 1)), 1.5)[k]), [4, 3, 4.5, -1]);
  assert.deepEqual(['n', 'raw', 'pts', 'gem'].map((k) => S.score(sc, all.slice(0, 2).concat(bad.slice(0, 3)), 2)[k]), [2, 0, 0, -3]);
  const sw = sc.diffs.find((d) => d.cells.length === 2); if (sw) assert.equal(S.score(sc, [sw.cells[1]], 1).n, 1, '🔀 either slot finds the swap');
}
for (let i = 1; i <= 5; i++) assert.ok(fs.existsSync(path.resolve('public/spot-voice/t' + i + '.mp3')), 'spot-voice/t' + i + '.mp3 is there');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen', 'r13TourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
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

  // the doorway: the 7th tile; the first open = the tour, read aloud, rules only
  const tiles = await page.$$eval('#u-games-row .u-game', (b) => b.map((x) => x.textContent.replace(/\s+/g, '')));
  assert.equal(tiles.length, 7); assert.match(tiles[6], /🪞Memory/);
  await page.click('#sch-spot-btn');
  assert.ok(await page.isVisible('#sp-tour'), 'first open = the tour');
  const caps = [];
  for (let i = 0; i < 5; i++) { caps.push(await page.textContent('#sp-tcap')); await page.click('#sp-tnext'); }
  assert.ok(!caps.join(' ').match(/เคล็ด|กับดัก|ควร|ทริค|เทคนิค|tip/i), 'the tour teaches rules only, no tactics');
  assert.deepEqual(await page.evaluate(() => window.__played), ['spot-voice/t1.mp3', 'stop', 'spot-voice/t2.mp3', 'stop', 'spot-voice/t3.mp3', 'stop', 'spot-voice/t4.mp3', 'stop', 'spot-voice/t5.mp3', 'stop']);
  assert.ok(await page.isVisible('#sp-start')); assert.equal(await page.evaluate(() => localStorage.getItem('spotTourSeen')), '1');
  await page.click('#sp-help'); await page.click('#sp-voice'); assert.equal(await page.evaluate(() => localStorage.getItem('spotVoice')), 'off');
  await page.evaluate(() => { window.__played = []; }); await page.click('#sp-tnext'); assert.deepEqual(await page.evaluate(() => window.__played), [], '🔇 stays quiet');
  await page.evaluate(() => SP.tourEnd());

  // the level rail
  await page.click('#sp-lv2'); assert.equal(await page.evaluate(() => localStorage.getItem('spotLevel')), '2');
  assert.match(await page.textContent('#sp-lv2'), /13 items · 6 changes/);

  // the clock walks the rail by itself: 👀 → 🎲 → (no bet = ×1) → 🔍 → 📊
  await page.evaluate(() => SP._step(15)); await page.click('#sp-start');
  const railOf = () => page.$$eval('#sp-rail span', (s) => s.map((x) => x.className + ':' + x.textContent.trim()));
  const r0 = await railOf(); assert.match(r0[0], /^on:👀 \d+$/); assert.deepEqual(r0.slice(1), [':🎲', ':🔍', ':📊']);
  await page.waitForFunction(() => SP._g().phase === 'show', null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => SP._g().rounds[0].bet), 1, 'no bet in time = ×1');
  assert.deepEqual(await railOf(), ['ok:👀', 'ok:🎲', 'ok:🔍', 'on:📊']);
  await page.evaluate(() => SP._step(1e9));

  // round 2 by hand: ▸ Ready, bet ×2, taps
  await page.click('#sp-next');
  assert.equal(await page.$$eval('#sp-find', (e) => e.length), 0);
  await page.click('#sp-ready');
  assert.match((await railOf())[1], /^on:🎲 10$/); assert.ok(await page.isVisible('.sp-gone'), '🎲 the shelf is gone');
  const gem = await page.evaluate(() => SP._g().gem);
  assert.deepEqual(await page.$$eval('.sp-bet', (b) => b.map((x) => x.disabled)), [false, gem < 1, gem < 2], 'bets you cannot pay are grey');
  await page.evaluate(() => { SP._g().gem = 3; SP._render(); }); await page.click('#sp-bet-2');
  assert.match((await railOf())[2], /^on:🔍 90$/);
  const sc = await page.evaluate(() => SP._g().rounds[1].sc), wrong = sc.orig.map((x, i) => i).filter((i) => !sc.diffs.some((d) => d.cells.includes(i)));
  for (const d of sc.diffs.slice(0, 4)) await page.click(`#sp-find .sp-cell[data-k="${d.cells[d.cells.length - 1]}"]`);
  await page.click(`#sp-find .sp-cell[data-k="${wrong[0]}"]`); await page.click(`#sp-find .sp-cell[data-k="${wrong[0]}"]`);
  assert.equal(await page.evaluate(() => SP._g().rounds[1].taps.length), 4, 'tap again = undo');
  for (const k of wrong.slice(0, 6)) await page.click(`#sp-find .sp-cell[data-k="${k}"]`);
  assert.equal(await page.evaluate(() => SP._g().rounds[1].taps.length), 8, 'changes + 2 taps at most');
  assert.equal(await page.$$eval('#sp-taps i.u', (e) => e.length), 8);
  await page.click('#sp-done');
  assert.equal(await page.$$eval('#sp-list > div', (e) => e.length), 6, 'every change named');
  assert.equal(await page.$$eval('#sp-list > div.ok', (e) => e.length), 4);
  assert.equal(await page.textContent('#sp-sum'), '✅ 4 ❌ 4 → 0 × 2 = 0 · 💎 −3', '×2 past 2 wrong costs 💎 1 more');
  assert.equal(await page.$$eval('#spModal svg circle[stroke="#16a34a"]', (e) => e.length) >= 4, true, 'found = green');
  assert.equal(await page.$$eval('#spModal svg path[stroke="#dc2626"]', (e) => e.length), 4, 'wrong = ✗');

  // round 3 + the end
  await page.click('#sp-next'); await page.click('#sp-ready'); await page.click('#sp-bet-1');
  const sc3 = await page.evaluate(() => SP._g().rounds[2].sc);
  for (const d of sc3.diffs) await page.evaluate((k) => SP.tap(k), d.cells[0]);
  await page.click('#sp-done'); assert.match(await page.textContent('#sp-sum'), /^✅ 6 = 6 · 💎 \+1$/, 'all found, none wrong: 💎 back');
  await page.click('#sp-next');
  assert.ok(await page.isVisible('#sp-final')); assert.equal(await page.$$eval('#sp-rounds > div', (e) => e.length), 3);
  const g = await page.evaluate(() => SP._g()), last = await page.evaluate(() => window.__logs[window.__logs.length - 1]);
  assert.deepEqual({ g: last.g, mode: last.mode, done: last.done, n: last.n, score: last.score, res: last.res.length }, { g: 'spot', mode: 'l2', done: true, n: 3, score: String(g.pts), res: 3 });
  assert.equal(last.win, g.pts >= 18 ? 'w' : 'l');

  // 320 px: nothing sideways, the shelf fits
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('#sp-again');
  assert.ok(await page.$eval('#spModal .modal-content', (el) => el.scrollWidth <= el.clientWidth + 1), '320 px: nothing sideways');
  assert.ok(await page.$eval('#spModal .sp-pic svg', (s) => s.getBoundingClientRect().bottom <= innerHeight + 1), '320 px: the shelf fits the screen');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('spot-qa: OK — changes real (3 levels × 300 seeds), LASA to its partner, scoring + 💎; 7th tile; tour t1…t5 rules only; level kept; the clock walks 👀 → 🎲 → 🔍 → 📊; bets greyed when unpaid; taps toggle, capped; reveal marks + names; game_plays spot l2; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
