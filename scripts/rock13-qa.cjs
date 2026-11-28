// V101.382 🪨 Carry 13 · ฝึกกับ 🤖 (owner 2026-11-27, docs/MIND-GAMES-PLAN.md §8, pick A3 mockup-rock13/) on the REAL index.html,
// 390×844. Proves: the 6th tile opens it; the first open shows the ONE-page tour of the rules (V101.396, owner pick B: 5 lines, the carriers picture under line 1, no Next, no empty block) read aloud line after line (t1…t5, the line being read framed), ❓ replays, 🔊/🔇 kept;
// the lobby (V101.397 pick A: face on the title row, one EN rules line, 👥 3–7 + 🔁 7 │ 14 in one rail, ▸ Start) is remembered; a round: ▸ ส่ง waits for a card + a chip, used ones grey out, the bots
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
    window.__played = []; window.Audio = function (src) { this.src = src; this.paused = true; window.__aud = this; };
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
  assert.equal(tiles.length, 7); assert.match(tiles[5], /🪨Carry13/);
  await page.click('#u-games-row .u-game:nth-child(6)');
  assert.ok(await page.isVisible('#r13-tour'), 'first open = the tour'); assert.deepEqual(await page.evaluate(() => window.__played), ['rock13-voice/t1.mp3']);
  // V101.396 one page: 5 lines (English, the Thai line under it), the carriers picture under line 1 only, ▸ Start, no paging, no scrolling at 390 × 844
  const one = () => page.evaluate(() => { const c = document.querySelector('#r13Modal .modal-content'), r = c.getBoundingClientRect(), rs = [...document.querySelectorAll('#r13-tour .r13-rule')]; return { rules: rs.length, now: rs.findIndex((x) => x.classList.contains('now')), paging: !!document.querySelector('#r13-tour .r13-dots, #r13-tour .r13-skip, #r13-tour .r13-pill'), start: document.getElementById('r13-tnext').textContent, head: document.querySelector('#r13-tour h3').textContent, fits: r.top >= 0 && r.bottom <= innerHeight && c.scrollHeight <= c.clientHeight + 1, h: Math.round(r.height), gap: Math.round(document.getElementById('r13-tnext').getBoundingClientRect().top - rs[rs.length - 1].getBoundingClientRect().bottom), pics: rs.map((x) => x.querySelectorAll('.r13-pic .r13-c').length), sums: [...rs[0].querySelectorAll('.r13-sum')].map((x) => x.textContent), sumLines: [...rs[0].querySelectorAll('.r13-sum')].map((x) => Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x.querySelector('b')).fontSize))), en: rs.map((x) => x.querySelector(':scope > div > b').textContent), th: rs[0].querySelector(':scope > div > small').textContent }; });
  let t = await one();
  assert.deepEqual({ rules: t.rules, now: t.now, paging: t.paging, start: t.start, head: t.head, fits: t.fits }, { rules: 5, now: 0, paging: false, start: '▸ Start', head: '❓ How to play', fits: true }, 'one page: 5 lines, line 1 framed while it is read, English head + ▸ Start, no scrolling ' + JSON.stringify(t));
  assert.ok(t.gap >= 0 && t.gap <= 16 && t.h < 660, 'no empty block: ▸ Start sits right under line 5 ' + JSON.stringify({ gap: t.gap, h: t.h }));
  assert.deepEqual(t.pics, [3, 0, 0, 0, 0], 'the 3 carriers under line 1 only'); assert.deepEqual(t.sums, ['8/13', '11/13', '2/13']); assert.ok(t.sumLines.every((n) => n <= 1), 'each weight stays on one line ' + t.sumLines);
  assert.equal(t.en[0], '3 carriers — never let one reach 13.'); assert.equal(t.th, 'คน 3 คนแบกกระดานหิน 🔴🟢🔵 · ห้ามให้ใครแบกถึง 13');
  assert.ok(!(await page.textContent('#r13-tcap')).match(/เคล็ด|กับดัก|ควร|เก็บไว้/), 'the tour teaches rules only, no tactics');
  for (let i = 1; i < 5; i++) { await page.evaluate(() => { window.__aud.paused = true; window.__aud.onended(); }); assert.equal((await one()).now, i, 'the end of line ' + i + ' starts line ' + (i + 1)); }
  await page.evaluate(() => { window.__aud.paused = true; window.__aud.onended(); }); assert.equal((await one()).now, -1, 'after line 5 no line is framed');
  assert.deepEqual(await page.evaluate(() => window.__played), ['rock13-voice/t1.mp3', 'rock13-voice/t2.mp3', 'rock13-voice/t3.mp3', 'rock13-voice/t4.mp3', 'rock13-voice/t5.mp3'], 't1…t5 once each, in order');
  await page.click('#r13-tnext');
  assert.ok(await page.isVisible('#r13-start')); assert.equal(await page.evaluate(() => localStorage.getItem('r13TourSeen')), '1');
  await page.click('#r13-help'); assert.equal((await one()).now, 0, '❓ replays from line 1'); await page.click('#r13-voice'); assert.equal(await page.evaluate(() => localStorage.getItem('r13Voice')), 'off'); assert.equal((await one()).now, -1, '🔇: no line framed');
  assert.deepEqual(await page.evaluate(() => window.__played.slice(5)), ['rock13-voice/t1.mp3', 'stop'], '🔇 stops the clip');
  await page.evaluate(() => { window.__played = []; }); await page.click('#r13-tnext'); await page.click('#r13-help'); assert.deepEqual(await page.evaluate(() => window.__played), [], '🔇 stays quiet');
  await page.setViewportSize({ width: 320, height: 568 });
  assert.ok(await page.evaluate(() => { const b = document.getElementById('r13-tnext').getBoundingClientRect(), c = document.querySelector('#r13Modal .modal-content').getBoundingClientRect(); return b.top >= c.top && b.bottom <= c.bottom + 1 && b.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth; }), '320 × 568: the lines scroll, ▸ Start stays in sight');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => R13.tourEnd());

  // the lobby rails
  await page.click('#r13-n4'); await page.click('#r13-r7');
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('r13Cfg'))), { n: 4, rounds: 7 });
  // V101.397 lean lobby (owner pick A): face on the title row, one EN rules line, 👥 + 🔁 chips in one rail with each emoji once, no "คุณ + 🤖 n", ▸ Start
  const lobby = await page.$eval('#r13Modal .r13', (r) => ({ face: !!r.querySelector('.r13-top #pxa-face .pxa svg'), row: !!r.querySelector('#pxa-row'), note: r.querySelector('.r13-note').textContent, lbl: [...r.querySelectorAll('.r13-one .r13-lbl')].map((x) => x.textContent), n4: r.querySelector('#r13-n4').title, r7: r.querySelector('#r13-r7').title + '|' + r.querySelector('#r13-r7').textContent, start: r.querySelector('#r13-start').textContent, mode: [...r.querySelectorAll('[aria-label="Mode"] button')].map((b) => b.textContent), txt: r.textContent }));
  assert.deepEqual([lobby.face, lobby.row, lobby.note, lobby.lbl, lobby.n4, lobby.r7, lobby.start, lobby.mode], [true, false, '🔴🟢🔵 never reach 13 · 🪨 fewest wins', ['👥', '🔁'], 'You + 🤖 3', '7 rounds|7', '▸ Start', ['🤖 Practice', '🌐 Friends']], JSON.stringify(lobby));
  assert.ok(!/คุณ \+|your face|รอบ|เริ่ม/.test(lobby.txt), 'each number once, EN only: ' + lobby.txt);

  // play: seeded bots, no waiting
  await page.evaluate(() => { let s = 11; R13._rng(() => ((s = (s * 16807) % 2147483647) / 2147483647)); R13._speed(5); });
  await page.click('#r13-start');
  assert.equal(await page.evaluate(() => R13Sound.playing), true, 'your pick = your turn: the soft loop plays');
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
      const t = await page.textContent('#r13-put'), pv = await page.evaluate(() => { const g = R13._g(); return Rock13Rules.preview(g, 0, g.subs[0].chip); });
      // V101.390 Greek C: the outcome lives in the button, red on 💥
      assert.equal(t, '▸ วาง ' + (pv.take ? '💥 🪨' + pv.take : '→ ' + pv.total), 'the button says what placing does');
      assert.equal(await page.$eval('#r13-put', (b) => b.classList.contains('hit')), !!pv.take); if (pv.take) sawBoom++;
      if (can && sawPass === 1) { await page.click('#r13-pass'); continue; }
      await page.click('#r13-put');
    }
  }
  await page.waitForSelector('#r13-final');
  const snd = await page.evaluate(() => R13Sound.log.join(' '));
  for (const k of ['music+', 'music-', 'put', 'pass', 'turn']) assert.ok(snd.split(' ').includes(k), 'sound cue ' + k + ': ' + snd.slice(0, 200));
  assert.ok(/(win|lose)/.test(snd.split(' ').slice(-3).join(' ')), 'the end has its sound'); assert.equal(await page.evaluate(() => R13Sound.playing), false, 'the loop stops at the end');
  const g = await page.evaluate(() => R13._g());
  assert.equal(g.phase, 'end'); assert.equal(g.round, 7);
  const rows = await page.$$eval('#r13-rank div', (d) => d.map((x) => x.textContent));
  assert.equal(rows.length, 4); rows.forEach((r) => assert.match(r, /🪨 \d+/));
  const log = await page.evaluate(() => window.__logs.filter((x) => x.g === 'rock13' && x.done).slice(-1)[0]);
  assert.equal(log.mode, 'bot'); assert.equal(log.score, String(g.players[0].pen)); assert.ok(['w', 'l'].includes(log.win));
  assert.ok(sawTurn >= 7 && sawRainbow >= 1 && sawPass >= 1, 'played my turns, 🌈 and ⏭ ' + JSON.stringify({ sawTurn, sawRainbow, sawPass, sawBoom }));
  await page.screenshot({ path: process.env.R13_SHOT || path.join(require('node:os').tmpdir(), 'r13-end.png') });
  // V101.390 🏛 Greek C: "n left" under each carrier (no stone count), a new stone drops in once, 💥 the old stones tumble off once
  const fx = await page.evaluate(() => {
    const R = Rock13Rules, G = R.create([{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }, { id: 'c', name: 'c' }], 7, 0);
    G.stands = { r: [3, 1], g: [5, 4], b: [6, 2, 4] };
    R13._stands(G); const a = R13._stands(G);
    G.stands.g.push(0); const b = R13._stands(G); const c = R13._stands(G);
    G.stands.b = [3]; G.log.push({ take: 3 }); const d = R13._stands(G);
    const box = document.createElement('div'); box.innerHTML = a;
    return { left: [...box.querySelectorAll('.r13-left')].map((x) => x.textContent + '|' + x.className), count: /🪨<\/small>/.test(a), a: /r13-drop|r13-fall/.test(a), b: (b.match(/r13-drop/g) || []).length, c: /r13-drop|r13-fall/.test(c), d: (d.match(/r13-fall/g) || []).length };
  });
  assert.deepEqual(fx, { left: ['9 left|r13-left', '4 left|r13-left w', '⚠ 1 left|r13-left h'], count: false, a: false, b: 1, c: false, d: 3 }, 'Greek C tags + effects play once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const rm = await page.evaluate(() => { const m = document.querySelector('#r13Modal .modal-content'), d = document.createElement('div'); d.innerHTML = '<svg><g class="r13-fall"></g><g class="r13-drop"></g></svg>'; m.appendChild(d); const r = [getComputedStyle(d.querySelector('.r13-fall')).display, getComputedStyle(d.querySelector('.r13-drop')).animationName]; d.remove(); return r; });
  assert.deepEqual(rm, ['none', 'none'], 'reduced motion: no drop, no fall');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.click('#r13-again'); assert.ok(await page.isVisible('#r13-send'), '↻ starts again');
  await page.click('#r13-snd'); assert.equal(await page.evaluate(() => [localStorage.getItem('r13Sound'), R13Sound.playing].join()), 'off,false', '🔇 stops the loop and is kept');
  assert.equal(await page.textContent('#r13-snd'), '🔇'); await page.click('#r13-snd'); assert.equal(await page.evaluate(() => R13Sound.playing), true);

  // 320 px
  await page.setViewportSize({ width: 320, height: 640 });
  assert.ok(await page.$eval('#r13Modal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits');
  assert.ok(await page.$eval('#u-games-row', (r) => [...r.children].every((b) => b.getBoundingClientRect().right <= r.getBoundingClientRect().right + 1)), 'the 6 tiles fit 320 px');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('rock13-qa: OK — 6th tile; one-page rules tour (5 lines + the carriers picture, no tactics) read line after line, ❓ + 🔇 kept, ▸ Start in sight at 320 × 568; 👥 3–7 + 7│14 remembered; ▸ ส่ง needs card + chip; bots place in queue order; ▸ วาง says the new weight / 💥; ⏭ only when allowed; 🌈 taps a carrier; 7 rounds to a ranking; logged rock13 bot; the A2 loop only on your turn, cues put/fall/pass/turn/end, 🔇 kept; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
