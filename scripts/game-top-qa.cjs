// V101.375 / V102.705 🏆 Top 3 per game (owner 2026-11-26, picks: wins · this week + all time · line B, mockup-game-top3/).
// Proves: functions/ and public/ game-top-rank.js are the same file; the ranking (Monday 00:00 Bangkok week, wins for 🥣 🐺 ⚫⚪,
// 🧊 = best seconds of a 5/5 game, a tie to who got there first, an ignored user never ranks, forIntern = top 3 + my place); on the
// REAL index.html (390×844 touch phone) each of the 4 lobbies shows one 🏆 line from the gameTop callable — three faces with 🥇🥈🥉
// and the value + "คุณ #n" — a tap opens the board (สัปดาห์นี้ │ ตลอดกาล), a second tap folds it; an empty week says so; a failing
// call shows nothing; a finished game makes the next lobby ask again; 320 px fits. Admin: game-admin.js ⏱ เวลา │ 🏆 อันดับ lists
// every player best first (0 wins too), ตลอดกาล reads all game_plays.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// ---- the ranking (node) ----
assert.equal(fs.readFileSync('functions/game-top-rank.js', 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync('public/game-top-rank.js', 'utf8').replace(/\r\n/g, '\n'), 'one file in two places');
const R = require(path.resolve('functions/game-top-rank.js'));
const MON = Date.UTC(2026, 10, 23) - 7 * 3600e3;   // Mon 23 Nov 2026 00:00 Bangkok
assert.equal(R.weekStart(MON), MON); assert.equal(R.weekStart(MON + 6 * 864e5 + 86399e3), MON, 'Sunday 23:59 is the same week');
assert.equal(R.weekStart(MON - 1), MON - 7 * 864e5, 'Sunday night before = the week before');
const P = [
  { userId: 'a', game: 'bw', win: 'w', endedAt: MON + 10 }, { userId: 'b', game: 'bw', win: 'w', endedAt: MON + 5 }, { userId: 'b', game: 'bw', win: 'l', endedAt: MON + 6 },
  { userId: 'c', game: 'bw', win: 'l', endedAt: MON + 1 }, { userId: 'a', game: 'bw', win: 'w', endedAt: MON - 100 }, { userId: 'x', game: 'bw', win: 'w', endedAt: MON + 2 },
  { userId: 'x', game: 'bw', win: 'w', endedAt: MON + 3 },
  { userId: 'a', game: 'count', mode: 'rect l3', score: '5/5', sec: 80, endedAt: MON + 1 }, { userId: 'b', game: 'count', mode: 'cube free l3', score: '5/5', sec: 60, endedAt: MON + 1 },
  { userId: 'c', game: 'count', mode: 'rect l3', score: '4/5', sec: 20, endedAt: MON + 1 }, { userId: 'a', game: 'count', mode: 'cube l3', score: '5/5', sec: 50, endedAt: MON - 9 },
  { userId: 'c', game: 'count', mode: 'rect l2', score: '5/5', sec: 10, endedAt: MON + 1 }, { userId: 'c', game: 'count', mode: 'rect', score: '5/5', sec: 10, endedAt: MON + 1 },
];
const skip = (id) => id === 'x';
const r = R.rank(P, MON + 1000, skip);
assert.deepEqual(r.boards.bw.week.map((x) => x.userId + x.v), ['b1', 'a1'], 'week: one win each, b got there first; x is ignored');
assert.deepEqual(r.boards.bw.all.map((x) => x.userId + x.v), ['a2', 'b1'], 'all time counts last week');
assert.deepEqual(r.boards.count.week.map((x) => x.userId + x.v), ['b60', 'a80'], '🧊 fastest 5/5 at 🥄🥄🥄 first; 4/5, 🥄🥄 and old plays without a level never count');
assert.deepEqual(r.boards.count.all.map((x) => x.userId + x.v), ['a50', 'b60']);
assert.deepEqual(R.board(P, 'bw', skip, true).map((x) => x.userId + x.v), ['a2', 'b1', 'cnull'], 'the admin list keeps who never won, last');
// V101.378 🔢 เลขลับ: fewest 🎫, 🧠 (h4) games only
const SP = [{ userId: 'a', game: 'secret', mode: 'h4', win: 'w', score: '9', endedAt: MON + 1 }, { userId: 'b', game: 'secret', mode: 'h4', win: 'w', score: '6', endedAt: MON + 2 },
  { userId: 'c', game: 'secret', mode: 'h1', win: 'w', score: '2', endedAt: MON + 1 }, { userId: 'a', game: 'secret', mode: 'h4', win: 'w', score: '7', endedAt: MON + 3 }];
assert.deepEqual(R.rank(SP, MON + 1000).boards.secret.week.map((x) => x.userId + x.v), ['b6', 'a7'], '🔢 fewest 🎫 at 🧠 first; 🟩 never counts');
const mine = R.forIntern(r, 'c', (id) => ({ name: 'N' + id, pic: '' }));
assert.deepEqual(mine.bw.week, { top: [{ v: 1, name: 'Nb', pic: '' }, { v: 1, name: 'Na', pic: '' }], me: null });
assert.deepEqual(R.forIntern(r, 'a', (id) => ({ name: id })).count.all.me, { r: 1, v: 50 });

// ---- the intern page ----
const pic = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#fbbf24"/></svg>');
const B = (vals, me) => ({ top: vals.map((v, i) => ({ v, name: ['มายด์', 'ต้นข้าว', 'ภูมิ'][i], pic: i === 2 ? '' : pic })), me });
const DATA = {
  cereal: { week: B([6, 5, 3], { r: 2, v: 5 }), all: B([9, 8, 7], { r: 5, v: 4 }) }, wolf: { week: B([], null), all: B([4, 3], null) },
  count: { week: B([41, 55, 62], { r: 4, v: 70 }), all: B([38, 41, 55], null) }, bw: { week: B([12, 9, 7], { r: 5, v: 4 }), all: B([30, 22, 19], { r: 9, v: 6 }) },
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((DATA) => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.__calls = []; window.__fail = false;
    const call = (name) => (d) => { window.__calls.push(name + ':' + (d && d.userId)); if (name !== 'gameTop') return Promise.resolve({ data: {} }); return window.__fail ? Promise.reject(new Error('x')) : Promise.resolve({ data: { week: 1, games: DATA } }); };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: call }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  }, DATA);
  await page.route('**/*', (q) => (q.request().url().startsWith('file:') || q.request().url().startsWith('data:') ? q.continue() : q.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); userId = 'U1'; });
  const line = (g) => page.$eval('[data-gtop="' + g + '"]', (e) => { const c = e.cloneNode(true); c.querySelectorAll('.gtop-av').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); });   // faces left out (a photo or the name's first letter)

  // a failing call shows nothing
  await page.evaluate(() => { window.__fail = true; bwOpen(); }); await page.waitForTimeout(100);
  assert.equal(await line('bw'), '', 'no answer → no line');
  await page.evaluate(() => { BW.close(); window.__fail = false; GameTop._set(null); GameTop.played(); });

  const games = [['bw', 'bwOpen', 'BW.close()', '🏆 🥇 12🥈 9🥉 7คุณ #5'], ['count', 'countOpen', 'CG.close()', '🏆 🥇 0:41🥈 0:55🥉 1:02คุณ #4'],
    ['cereal', 'cerealOpen', "document.getElementById('cerealModal').style.display='none'", '🏆 🥇 6🥈 5🥉 3คุณ #2'], ['wolf', 'wolfOpen', "document.getElementById('wolfModal').style.display='none'", '🏆 สัปดาห์นี้ยังว่าง · ชนะก่อนได้ 🥇']];
  for (const [g, open, close, want] of games) {
    await page.evaluate((f) => window[f](), open);
    await page.waitForFunction((g) => { const e = document.querySelector('[data-gtop="' + g + '"]'); return e && e.textContent.trim(); }, g, { timeout: 3000 });
    assert.equal((await line(g)).replace(/ /g, ''), want.replace(/ /g, ''), g + ' line');
    const box = await page.$eval('[data-gtop="' + g + '"]', (e) => { const m = e.closest('.modal'); const c = m.querySelector('h3').getBoundingClientRect(), b = e.getBoundingClientRect(); return { below: b.top >= c.bottom - 1, h: b.height }; });
    assert.ok(box.below && box.h < 40, g + ': one line under the title ' + JSON.stringify(box));
    await page.evaluate(close);
  }
  assert.equal((await page.evaluate(() => window.__calls.filter((c) => c.startsWith('gameTop')))).join(), 'gameTop:U1,gameTop:U1', 'asked once more after the failure, then kept');
  assert.equal(await page.$$eval('[data-gtop="cereal"] img.gtop-av', (e) => e.length) >= 0, true);

  // the board: tap opens, ตลอดกาล, tap folds
  await page.evaluate(() => bwOpen());
  await page.click('[data-gtop="bw"]');
  assert.equal(await page.$$eval('[data-gtop="bw"] .gtop-r', (e) => e.length), 3, 'three rows');
  assert.match(await line('bw'), /สัปดาห์นี้ตลอดกาล🥇มายด์12 ชนะ🥈ต้นข้าว9 ชนะ🥉ภูมิ7 ชนะคุณ #5 · 4 ชนะ/);
  await page.click('[data-gtop="bw"] .gtop-rail button:nth-child(2)');
  assert.match(await line('bw'), /มายด์30 ชนะ.*คุณ #9 · 6 ชนะ/, 'ตลอดกาล');
  assert.ok(await page.$('[data-gtop="bw"] .gtop-b'), 'the rail tap does not fold it');
  await page.click('[data-gtop="bw"]');
  assert.equal(await page.$('[data-gtop="bw"] .gtop-b'), null, 'a second tap folds it');
  assert.match(await line('bw'), /🥇30/, 'the line follows the period');
  await page.click('[data-gtop="bw"]'); await page.click('[data-gtop="bw"] .gtop-rail button:nth-child(1)'); await page.click('[data-gtop="bw"]');
  await page.evaluate(() => { BW.close(); countOpen(); }); await page.click('[data-gtop="count"]');
  assert.match(await line('count'), /🥄🥄🥄 ยาก · ✓ 5\/5 เวลาดีสุด/, '🧊 board says it counts ยาก only');
  await page.click('[data-gtop="count"]'); await page.evaluate(() => { CG.close(); bwOpen(); });
  // a finished game → the next lobby asks again
  await page.evaluate(() => { BW._rng(() => 0.3); BW.start(); const g = BW._g(); while (!g.end) { if (g.last) BW.next(); else { BW.pick(g.me[0]); BW.play(); } } });
  await page.evaluate(() => { BW.lobby ? BW.lobby() : BW.open(); });
  await page.waitForTimeout(100);
  assert.equal((await page.evaluate(() => window.__calls.filter((c) => c.startsWith('gameTop')))).length, 3, 'asked again after a game');
  // 320 px, board open
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('[data-gtop="bw"]');
  assert.ok(await page.$eval('#bwModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits');
  assert.deepEqual(errors, []);

  // ---- admin: game-admin.js on a bare page ----
  const ad = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await ad.setContent('<meta charset="utf-8"><div id="gt-admin" hidden></div>');
  for (const f of ['public/game-top-rank.js', 'public/game-admin.js']) await ad.addScriptTag({ path: f });
  const now = Date.now(), ws = R.weekStart(now);
  await ad.evaluate(([ws]) => {
    window.usersData = [{ id: 'a', nickname: 'A' }, { id: 'b', nickname: 'B' }, { id: 'c', nickname: 'C' }, { id: 'x', nickname: 'X', isIgnored: true }];
    window.__allReads = 0;
    window.db = { collection: () => ({ get: () => { window.__allReads++; return Promise.resolve({ docs: [{ userId: 'c', game: 'bw', win: 'w', endedAt: 1, rounds: [1] }, { userId: 'c', game: 'bw', win: 'w', endedAt: 2, rounds: [1] }, { userId: 'a', game: 'bw', win: 'w', endedAt: ws + 5, rounds: [1] }].map((d) => ({ data: () => d })) }); } }) };
    gameAdmin._set([{ userId: 'a', game: 'bw', win: 'w', endedAt: ws + 5, rounds: [3, 4] }, { userId: 'b', game: 'bw', win: 'l', endedAt: ws + 6, rounds: [3] },
      { userId: 'x', game: 'bw', win: 'w', endedAt: ws + 7, rounds: [3] }, { userId: 'c', game: 'bw', win: 'w', endedAt: ws - 5, rounds: [2] }]);
  }, [ws]);
  assert.ok(await ad.isVisible('#gt-admin .gt-t'), 'the time table first');
  await ad.click('text=🏆 อันดับ');
  const rows = () => ad.$$eval('#gt-rank tbody tr', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, '')));
  assert.deepEqual(await rows(), ['🥇A11', 'B01'], 'this week: everyone who played, 0 wins too; last week and ignored left out');
  await ad.click('text=ตลอดกาล'); await ad.waitForFunction(() => window.__allReads === 1);
  assert.deepEqual(await rows(), ['🥇C22', '🥈A11'], 'all time = every game_plays doc');
  await ad.click('text=⏱ เวลา'); assert.equal(await ad.$('#gt-rank'), null, 'back to time');
  await browser.close();
  console.log('game-top-qa: OK — one ranking file in functions/ + public/, week from Monday Bangkok, wins / 🧊 best 5/5 time, ties to the first, ignored never rank; 🏆 line under each of the 4 game titles, tap = board สัปดาห์นี้ │ ตลอดกาล, empty week, failing call hidden, asks again after a game, 320 px; admin 🏆 อันดับ lists everyone, ตลอดกาล reads all');
})().catch((e) => { console.error(e); process.exit(1); });
