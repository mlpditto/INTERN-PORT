// V101.402 🌙 Midnight Market · practice (owner 2026-11-29, docs/VAULT-SWAP-PLAN.md PR 1, screen pick A = the dark table) on the REAL
// index.html, 390×844. Proves: the 8th tile (2 rows of 4) and the PC 🎮 menu open it, English first with a Thai + Korean hover; the
// first open shows the ONE-page tour of the rules (5 lines, no tactics) read aloud line after line (midnight-voice/t1…t5, files
// present); 👥 4–7 and 🤖 🥄 1–3 are remembered; on the table only YOUR card shows its face — every other card is face down and a
// tag appears only on a card you know (👁 or one you held); the bots swap by the clock; on your turn you MUST swap (no skip): tap a
// card → ⇄ Swap with …; 👁 once a game on a 🕴 / 🗑 card; holding a 📡 only players can be tapped; ➡ 1 then ⬅ 2, two swaps each;
// 📊 the reveal lists everyone with the rules' points; 3 heists end with final = total × partner's total and game_plays game
// 'midnight' mode '<seats>p-l<level>'; 7 seats fit 320 × 568 and 360 × 640 without scrolling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

for (let i = 1; i <= 5; i++) assert.ok(fs.existsSync(path.resolve('public/midnight-voice/t' + i + '.mp3')), 'midnight-voice/t' + i + '.mp3 is there');
const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
for (const f of ['midnight-rules.js', 'midnight.js']) assert.ok(html.includes('<script src="' + f + '?v=V'), f + ' is loaded with a version');
assert.ok(/'spot', 'midnight'\]/.test(fs.readFileSync(path.resolve('firestore.rules'), 'utf8')), 'firestore.rules lets game_plays take game midnight');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen', 'r13TourSeen', 'spotTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    localStorage.setItem('mmSound', 'off');
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
  const G = () => page.evaluate(() => JSON.parse(JSON.stringify(MM._g())));
  const myTurn = () => page.waitForFunction(() => { const g = MM._g(); return g && (g.phase !== 'swap' || MidnightRules.turn(g) === 0); });
  const fit = () => page.$eval('#mmModal .modal-content', (c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 1; });

  // the doorway: the 8th tile, 2 rows of 4, English first, Thai + Korean on hover; the PC menu has it too
  const tiles = await page.$$eval('#u-games-row .u-game', (b) => b.map((x) => ({ t: x.textContent.replace(/\s+/g, ''), y: Math.round(x.getBoundingClientRect().top), w: x.scrollWidth <= x.clientWidth + 1, title: x.title })));
  assert.equal(tiles.length, 8); assert.match(tiles[7].t, /^🌙Midnight$/);
  assert.equal(new Set(tiles.slice(0, 4).map((x) => x.y)).size, 1); assert.equal(new Set(tiles.slice(4).map((x) => x.y)).size, 1); assert.ok(tiles[4].y > tiles[0].y, '2 rows of 4');
  assert.ok(tiles.every((x) => x.w), 'no tile name is cut');
  assert.match(tiles[7].title, /^Midnight Market · [฀-๿ ]+\n[^\n]*[가-힯]/, 'hover: a Thai line, then a Korean line');
  assert.deepEqual(await page.$eval('#u-mm-chip', (b) => [b.textContent, b.getAttribute('onclick'), /[฀-๿]/.test(b.title) && /[가-힯]/.test(b.title)]), ['🌙Midnight Marketswap & match', 'midnightOpen()', true]);

  // the first open = the tour: one page, 5 lines, read line after line, rules only
  await page.click('#sch-mm-btn');
  assert.ok(await page.isVisible('#mm-tour'), 'first open = the tour');
  const one = () => page.evaluate(() => { const rs = [...document.querySelectorAll('#mm-tour .mm-rule')]; return { rules: rs.length, now: rs.findIndex((x) => x.classList.contains('now')), start: document.getElementById('mm-tnext').textContent, head: document.querySelector('#mm-tour h3').textContent, en: rs.map((x) => x.querySelector('b').textContent), th: rs.every((x) => /[฀-๿]/.test(x.querySelector('small').textContent)) }; });
  let t = await one();
  assert.deepEqual({ rules: t.rules, now: t.now, start: t.start, head: t.head, th: t.th }, { rules: 5, now: 0, start: '▸ Start', head: '❓ How to play', th: true });
  assert.ok(await fit(), 'the tour fits 390 × 844 without scrolling');
  assert.ok(t.en.every((x) => /^[\x20-\x7E·×→➡⬅🕴🗑📡👁🤝−]+$/u.test(x)), 'the bold line is English ' + JSON.stringify(t.en));
  assert.ok(!(await page.textContent('#mm-tcap')).match(/เคล็ด|กับดัก|ควร|ทริค|เทคนิค|tip|should|best to/i), 'the tour teaches rules only, no tactics');
  for (let i = 1; i < 5; i++) { await page.evaluate(() => { window.__aud.paused = true; window.__aud.onended(); }); assert.equal((await one()).now, i, 'the end of line ' + i + ' starts line ' + (i + 1)); }
  await page.evaluate(() => { window.__aud.paused = true; window.__aud.onended(); }); assert.equal((await one()).now, -1);
  assert.deepEqual(await page.evaluate(() => window.__played), [1, 2, 3, 4, 5].map((i) => 'midnight-voice/t' + i + '.mp3'), 't1…t5 once each, in order');
  await page.click('#mm-tnext');

  // the lobby: 👥 4–7 and 🤖 🥄 1–3, remembered
  assert.deepEqual(await page.$$eval('#mmModal .mm-grp button', (b) => b.map((x) => x.id)), ['mm-n4', 'mm-n5', 'mm-n6', 'mm-n7', 'mm-lv1', 'mm-lv2', 'mm-lv3']);
  assert.equal(await page.$eval('#mmModal .mm-note', (e) => /[฀-๿]/.test(e.title) && /[가-힯]/.test(e.title) && /^[\x20-\x7E⇄→🕴·]+$/u.test(e.textContent)), true, 'the rules line: English, Thai + Korean on hover');
  await page.click('#mm-n6'); await page.click('#mm-lv2');
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('mmSeats'), localStorage.getItem('mmLevel'), document.getElementById('mm-n6').getAttribute('aria-pressed'), document.getElementById('mm-n5').getAttribute('aria-pressed')]), ['6', '2', 'true', 'false']);
  await page.evaluate(() => MM._step(15)); await page.click('#mm-start');

  // the table: my card face up, everyone else face down, 3 + 1 on the table, a partner, one peek
  let g = await G();
  assert.equal(g.n, 6); assert.deepEqual(g.players.map((p) => p.bot), [false, true, true, true, true, true]); assert.ok(g.players.slice(1).every((p) => p.level === 2));
  assert.equal(await page.$$eval('#mmModal .mm-felt .mm-card.back', (c) => c.length), 5 + 3 + 1, '5 hands + 3 Fence + 1 Bin, all face down');
  assert.equal(await page.$$eval('#mmModal .mm-felt .mm-card.up', (c) => c.length), 0, 'no face on the table');
  await myTurn();
  // a seeded game from here on (the same swaps every run); one where my first turn comes with loot in my hand, not a 📡
  for (let seed = 20261129; ; seed++) { await page.evaluate((sd) => MM.start(sd), seed); await myTurn(); if (await page.evaluate(() => MM._g().at.p0.k !== 'T' && MM._g().log.length < 6)) break; }
  g = await G();
  const KIND = { J: '💎', G: '🪙', A: '🖼', C: '💵', T: '📡' }, num = (n) => (n < 0 ? '−' + -n : String(n));
  assert.equal(await page.$eval('#mm-mine .mm-card.up', (c) => c.textContent), KIND[g.at.p0.k] + num(g.at.p0.n), 'my card shows its face');
  const tags = () => page.$$eval('#mmModal .mm-felt .mm-kn', (e) => e.map((x) => x.parentElement.id.slice(5) + '=' + x.textContent).sort());
  const known = (gg) => Object.keys(gg.know[0]).filter((k) => k !== 'p0').map((k) => k + '=' + KIND[gg.know[0][k].k] + num(gg.know[0][k].n)).sort();
  assert.deepEqual(await tags(), known(g), 'a tag only on a card I know');
  assert.equal(await page.$$eval('#mmModal .mm-felt .mm-card.back', (c) => c.filter((x) => /Jewels|Gold|Art|Cash|Tracker/.test(x.getAttribute('aria-label'))).length), known(g).length, 'no hidden card leaks into the page');
  assert.equal(await page.textContent('#mm-mate'), '🤝  ' + g.players[g.partner[0]].name); assert.notEqual(g.partner[0], 0);
  assert.equal(await page.textContent('#mm-peek'), '👁 Peek · 1'); assert.equal(await page.textContent('#mm-total'), '⭐ 0');
  assert.match(await page.textContent('#mm-pass'), g.pass === 1 ? /➡ 1/ : /⬅ 2/);
  assert.equal(await page.$$eval('#mm-strip .w', (w) => w.length), 6); assert.equal(await page.$$eval('#mm-strip .w.on', (w) => w.length), 1);

  // I must swap: no skip, the button waits for a card
  assert.deepEqual(await page.$eval('#mm-swap', (b) => [b.disabled, b.textContent]), [true, '👆 Tap a card']);
  assert.equal(await page.$$eval('#mmModal button', (b) => b.filter((x) => /skip|pass|ข้าม/i.test(x.textContent)).length), 0, 'no way to skip a swap');
  // holding a 📡: only players can be tapped
  await page.evaluate(() => { const g = MM._g(); g.__keep = g.at.p0; g.at.p0 = { k: 'T', n: -6 }; MM._render(); });
  assert.deepEqual(await page.$$eval('#mmModal .mm-felt .mm-card.back', (c) => c.filter((x) => !x.disabled).map((x) => x.id).sort()), ['mm-s-p1', 'mm-s-p2', 'mm-s-p3', 'mm-s-p4', 'mm-s-p5'], '📡 in hand: players only');
  assert.equal(await page.$eval('#mm-peek', (b) => b.disabled), false);
  await page.evaluate(() => { const g = MM._g(); g.at.p0 = g.__keep; delete g.__keep; MM._render(); });
  assert.equal(await page.$$eval('#mmModal .mm-felt .mm-card.back', (c) => c.filter((x) => !x.disabled).length), 9);

  // 👁 once a game: a Fence / Bin card, never a hand
  await page.click('#mm-peek');
  assert.deepEqual(await page.$$eval('#mmModal .mm-felt .mm-card.back', (c) => c.filter((x) => !x.disabled).map((x) => x.id).sort()), ['mm-s-b', 'mm-s-f0', 'mm-s-f1', 'mm-s-f2'], '👁: the Fence and the Bin only');
  await page.click('#mm-s-f1'); g = await G();
  assert.ok((await tags()).includes('f1=' + KIND[g.at.f1.k] + num(g.at.f1.n)), 'the card I looked at carries its tag');
  assert.deepEqual(await page.$eval('#mm-peek', (b) => [b.disabled, b.textContent]), [true, '👁 Peek · 0']); assert.equal(g.log.filter((l) => l.by === 0).length, 0, 'a peek is not a swap');

  // tap a card → ⇄ Swap with …; I get that card, mine goes there and I know it
  const before = g, to = 'p' + (1 + (g.partner[0] === 1 ? 1 : 0));
  await page.click('#mm-s-' + to);
  assert.deepEqual(await page.$eval('#mm-swap', (b) => [b.disabled, b.textContent]), [false, '⇄ Swap with ' + g.players[+to.slice(1)].name]);
  assert.equal(await page.$eval('#mm-s-' + to, (b) => b.getAttribute('aria-pressed')), 'true');
  await page.click('#mm-swap'); g = await G();
  const mineLog = g.log.filter((l) => l.by === 0); assert.equal(mineLog.length, 1); assert.equal(mineLog[0].to, to);
  await myTurn(); g = await G();
  if (g.phase === 'swap') {
    assert.equal(g.pass, 2, 'my next turn is in pass 2'); assert.match(await page.textContent('#mm-pass'), /⬅ 2/);
    assert.deepEqual(await tags(), known(g), 'the tags follow what I know after the bots swapped');
    assert.equal(await page.$eval('#mm-mine .mm-card.up', (c) => c.textContent), KIND[g.at.p0.k] + num(g.at.p0.n));
    assert.ok((await page.textContent('#mm-ev')).startsWith('⇄ '), 'the last swap is named');
    assert.equal(await page.$$eval('#mmModal .mm-seat small', (s) => s.filter((x) => x.textContent.startsWith('⇄ ')).length), 5, 'under each name: what that seat swapped with');
  }
  assert.ok(Object.keys(before.at).length === 10 && Object.keys(g.at).length === 10);

  // play the 3 heists; every reveal lists everyone with the rules' points
  const totals = [0, 0, 0, 0, 0, 0];
  for (let h = 1; h <= 3; h++) {
    for (let i = 0; i < 4; i++) {
      await myTurn(); if ((await page.evaluate(() => MM._g().phase)) !== 'swap') break;
      const k = await page.evaluate(() => { const g = MM._g(), T = MidnightRules.targets(g, 0); return T[T.length - 1]; });
      await page.click('#mm-s-' + k); await page.click('#mm-swap');
    }
    await page.waitForSelector('#mm-next'); g = await G();
    assert.equal(g.heist, h); assert.equal(g.log.length, 12); for (let s = 0; s < 6; s++) assert.equal(g.log.filter((l) => l.by === s).length, 2, 'two swaps each');
    assert.deepEqual(g.log.slice(0, 6).map((l) => l.pass).concat(g.log.slice(6).map((l) => l.pass)), [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
    assert.deepEqual(g.log.slice(6).map((l) => l.by), g.log.slice(0, 6).map((l) => l.by).reverse(), '⬅ pass 2 runs backwards');
    g.res.forEach((r, s) => { const m = r.card.k === 'T' ? 0 : ['f0', 'f1', 'f2'].filter((f) => g.at[f].k === r.card.k).length; assert.equal(r.pts, r.card.k === 'T' ? r.card.n : r.card.n * m); totals[s] += r.pts + r.bonus; });
    assert.deepEqual(g.players.map((p) => p.total), totals);
    const rows = await page.$$eval('#mm-res .mm-row', (r) => r.map((x) => x.querySelector('.nm').firstChild.textContent.trim() + ':' + x.querySelector('.mm-card').textContent + ':' + x.querySelector('b.p').textContent));
    assert.deepEqual(rows.slice().sort(), g.players.map((p, s) => p.name + ':' + KIND[g.res[s].card.k] + num(g.res[s].card.n) + ':' + (g.res[s].sum > 0 ? '+' : '') + num(g.res[s].sum)).sort(), 'heist ' + h + ': the reveal');
    assert.equal(await page.$$eval('#mmModal .mm-felt .mm-card.up', (c) => c.length), 4, 'the Fence and the Bin are turned');
    assert.equal(await page.textContent('#mm-next'), h < 3 ? '▸ Heist ' + (h + 1) : '▸ Result');
    assert.ok(await fit(), 'heist ' + h + ': the reveal fits');
    await page.click('#mm-next');
  }

  // the end: final = total × partner's total, the ranking, game_plays
  assert.ok(await page.isVisible('#mm-final')); g = await G();
  assert.deepEqual(g.final, g.players.map((p, s) => p.total * g.players[g.partner[s]].total));
  const rk = await page.evaluate(() => MidnightRules.ranking(MM._g()));
  assert.deepEqual(await page.$$eval('#mm-rank .mm-row', (r) => r.map((x) => x.querySelector('.nm').textContent + '=' + x.querySelector('b.p').textContent)), rk.map((s) => g.players[s].name + '=' + num(g.final[s])));
  assert.equal(await page.textContent('#mm-final'), (rk[0] === 0 ? '🏆 ' : '') + g.players[rk[0]].name + ' · ' + num(g.final[rk[0]]));
  const last = await page.evaluate(() => window.__logs[window.__logs.length - 1]);
  assert.deepEqual({ g: last.g, mode: last.mode, done: last.done, n: last.n, score: last.score, res: last.res.length, win: last.win }, { g: 'midnight', mode: '6p-l2', done: true, n: 3, score: String(g.final[0]), res: 3, win: rk[0] === 0 ? 'w' : 'l' });

  // small phones, 7 seats: the table, the reveal and the end fit without scrolling
  for (const [w, h] of [[320, 568], [360, 640]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { MM.lobby(); MM.set('n', 7); MM.start(77); });
    await myTurn(); assert.ok(await fit(), w + ' × ' + h + ', 7 seats: the table fits');
    assert.ok(await page.$$eval('#mmModal .mm-seat .mm-card', (c) => c.every((x) => x.getBoundingClientRect().width >= 30)), w + ' px: the cards stay big enough to tap');
    for (let i = 0; i < 4; i++) { await myTurn(); if ((await page.evaluate(() => MM._g().phase)) !== 'swap') break; const k = await page.evaluate(() => MidnightRules.targets(MM._g(), 0)[0]); await page.click('#mm-s-' + k); assert.ok(await fit()); await page.click('#mm-swap'); }
    await page.waitForSelector('#mm-next'); assert.ok(await fit(), w + ' × ' + h + ', 7 seats: the reveal fits');
    await page.evaluate(() => { const g = MM._g(); g.heist = 3; MM.next(); }); assert.ok(await page.isVisible('#mm-final')); assert.ok(await fit(), w + ' × ' + h + ', 7 seats: the end fits');
  }
  await page.evaluate(() => { MM.lobby(); MM.set('n', 5); });
  // ✕ closes and stops the bots
  await page.evaluate(() => { MM.start(5); MM.close(); }); await page.waitForTimeout(150);
  assert.equal(await page.$eval('#mmModal', (m) => m.style.display), 'none');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('midnight-qa: OK — 8th tile (2 × 4) + PC menu, EN first, TH + KR hover; one-page tour (5 lines, rules only) read t1…t5; 👥 4–7 · 🥄 1–3 kept; only my card shows, tags only on what I know; must swap (no skip); 📡 players only; 👁 once, 🕴 / 🗑 only; ➡ 1 then ⬅ 2, two swaps each; reveal = the rules; final = total × partner; game_plays midnight 6p-l2; 7 seats fit 320 × 568 and 360 × 640');
})().catch((e) => { console.error(e); process.exit(1); });
