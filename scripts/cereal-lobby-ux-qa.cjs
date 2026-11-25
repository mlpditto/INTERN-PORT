// 🥣 Cereal lobby UX (V101.352, owner picks B + E + empty line, mockup-cereal-lobby-ux/) on the real public/index.html, 390×844
// touch phone, network blocked. Proves: 📱 each game row has a 4 px left bar — grey while unfinished, green / red = did I win vs 🤖
// (2 players), the winner's colour for a friend game (🔪 red / 🕵️ violet); only the newest unfinished game is .cur (accent frame,
// solid ▸); no list → one grey "🎮 ยังไม่มีเกม" line. 🌐 the code box shows 📋 วาง until 6 letters, then ▸ in its place; 📋 reads
// the copied code or the LINE invite (?cereal=CODE wins over another 6-letter word), a blocked clipboard says so and focuses the
// box; finished online rows get green / red; no online games → one grey line; nothing scrolls sideways at 320 px.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const NOW = Date.now();
const LOCAL = [
  { id: 'g4', status: 'playing', day: 3, kills: 2, arrestsLeft: 3, names: { killer: 'คุณ', detective: '🤖' }, bot: { seat: 'detective', level: 2 } },
  { id: 'g3', status: 'playing', day: 1, kills: 0, arrestsLeft: 4, names: { killer: 'A', detective: 'B' } },
  { id: 'g2', status: 'finished', day: 6, kills: 5, arrestsLeft: 0, result: { winner: 'evil', day: 6 }, names: { killer: 'คุณ', detective: '🤖' }, bot: { seat: 'detective', level: 2 } },
  { id: 'g1', status: 'finished', day: 2, kills: 1, arrestsLeft: 2, result: { winner: 'evil', day: 2 }, names: { killer: '🤖', detective: 'คุณ' }, bot: { seat: 'killer', level: 1 } },
  { id: 'g0', status: 'finished', day: 5, kills: 4, arrestsLeft: 1, result: { winner: 'good', day: 5 }, names: { killer: 'Pond', detective: 'Mint' } },
  { id: 'g9', status: 'finished', day: 4, kills: 3, arrestsLeft: 1, result: { winner: 'evil', day: 4 }, names: { killer: 'Pond', detective: 'Mint' } },
];
const pl = (me) => ({ killer: { authUid: me === 'killer' ? 'u1' : 'u2' }, detective: { authUid: me === 'detective' ? 'u1' : 'u2' } });
const ONLINE = [
  { id: 'o1', status: 'finished', day: 4, players: pl('killer'), names: { killer: 'คุณ', detective: 'Mint' }, result: { winner: 'killer' }, updatedAt: NOW },
  { id: 'o2', status: 'finished', day: 2, players: pl('detective'), names: { killer: 'Pond', detective: 'คุณ' }, result: { winner: 'killer' }, updatedAt: NOW - 1 },
  { id: 'o3', status: 'playing', day: 2, phase: 'killer', players: pl('detective'), names: { killer: 'Pond', detective: 'คุณ' }, updatedAt: NOW - 2 },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen']) localStorage.setItem(k, '1');
    localStorage.setItem('cerealCoachSeen', 'all'); localStorage.setItem('cerealSound', 'off');
    window.__docs = []; window.__clip = { text: '', fail: false };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => (window.__clip.fail ? Promise.reject(new Error('NotAllowed')) : Promise.resolve(window.__clip.text)), writeText: () => Promise.resolve() } });
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important');
    const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    ensureFirebaseAuthReady = async () => ({ uid: 'u1' }); requireRegistered = () => true;
    window.__cbs = []; window.__feed = () => window.__cbs.forEach((cb) => cb({ docs: window.__docs.map((x) => ({ id: x.id, data: () => x })) }));
    db.collection = () => ({ where: () => ({ onSnapshot: (cb) => { window.__cbs.push(cb); setTimeout(window.__feed, 10); return () => { window.__cbs = window.__cbs.filter((c) => c !== cb); }; } }), doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }) });
  });
  const open = async (tab, local, online) => {
    await page.evaluate(([tab, local, online]) => {
      try { CK.close(); } catch (_) {}
      var u = ''; try { u = typeof userId !== 'undefined' ? userId : ''; } catch (_) {}
      localStorage.setItem('cereal_v1_' + (u || 'anon'), JSON.stringify({ games: local }));
      window.__docs = online;
      cerealOpen(); CK.tab(tab); window.__feed();
    }, [tab, local, online]);
    await page.waitForTimeout(300);
  };
  const bar = (sel) => page.$eval(sel, (el) => { const s = getComputedStyle(el, '::before'); return { w: s.width, bg: s.backgroundColor, content: s.content }; });
  const noSideScroll = () => page.$eval('#cerealModal .modal-content', (el) => el.scrollWidth <= el.clientWidth + 1);

  // ---- 📱 rows ----
  await open('local', LOCAL, []);
  const rows = await page.$$eval('#cerealModal .ck-game', (els) => els.map((e) => ({ cls: e.className, go: e.querySelector('.go').textContent })));
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((r) => r.cls.match(/r-[a-z]/)[0]), ['r-p', 'r-p', 'r-w', 'r-l', 'r-d', 'r-k'], 'bar per row: unfinished, unfinished, I won vs 🤖, I lost vs 🤖, 🕵️ won, 🔪 won');
  assert.deepEqual(rows.map((r) => /\bcur\b/.test(r.cls)), [true, false, false, false, false, false], 'only the newest unfinished game is .cur');
  // V101.364 pick A: a finished row says who won — 🏆 ชนะ / 😞 แพ้ vs 🤖 (my side), the winning side's icon otherwise; no 🏁
  const res = await page.$$eval('#cerealModal .ck-game', (els) => els.map((e) => { const r = e.querySelector('.ck-res'); return r ? r.textContent : (e.querySelector('.d') || {}).textContent; }));
  assert.deepEqual(res.slice(0, 4), ['D3', res[1], '🏆 ชนะ · D6', '😞 แพ้ · D2'], 'vs 🤖: won / lost from my side ' + JSON.stringify(res));
  assert.match(res[4], /^🕵️ ชนะ · D\d$/); assert.match(res[5], /^🔪 ชนะ · D\d$/);
  const want = { 'r-p': 'rgb(203, 213, 225)', 'r-w': 'rgb(22, 163, 74)', 'r-l': 'rgb(220, 38, 38)', 'r-d': 'rgb(67, 56, 202)', 'r-k': 'rgb(190, 18, 60)' };
  for (const [i, k] of ['r-p', 'r-p', 'r-w', 'r-l', 'r-d', 'r-k'].entries()) {
    const b = await bar('#cerealModal .ck-game:nth-of-type(' + (i + 1) + ')');
    assert.equal(b.w, '4px', 'row ' + i + ' bar is 4 px'); assert.equal(b.bg, want[k], 'row ' + i + ' ' + k + ' colour');
  }
  const cur = await page.$eval('#cerealModal .ck-game.cur', (e) => ({ bw: getComputedStyle(e).borderTopWidth, go: getComputedStyle(e.querySelector('.go')).color }));
  assert.equal(cur.bw, '2px'); assert.equal(cur.go, 'rgb(255, 255, 255)', 'the .cur row has a solid ▸');
  assert.equal(await page.$('#ck-empty'), null, 'no empty line with games');
  assert.ok(await noSideScroll());
  assert.equal(await page.getAttribute('#cerealModal .ck-game.cur', 'onclick'), "CK.resume('g4')", 'the .cur row resumes the newest unfinished game');

  await open('local', [], []);
  assert.equal((await page.textContent('#ck-empty')).trim(), '🥣ยังไม่มีเกม · เลือกบท แล้ว ▸ เริ่ม', 'V101.364 pick A: a big 🥣 over the line');
  assert.ok(await page.isVisible('#ck-empty'));

  // ---- 🌐 code box + empty line ----
  await open('online', [], []);
  await page.waitForSelector('#ck-on-empty');
  assert.match(await page.textContent('#ck-on-empty'), /ยังไม่มีเกม/);
  assert.ok(await page.isVisible('#ck-on-paste')); assert.ok(!(await page.isVisible('#ck-on-join')), '▸ hidden until 6 letters');
  await page.fill('#ck-on-code', 'ab1');
  assert.ok(await page.isVisible('#ck-on-paste'));
  await page.fill('#ck-on-code', 'ab12cd');
  assert.ok(!(await page.isVisible('#ck-on-paste'))); assert.ok(await page.isVisible('#ck-on-join'), '▸ appears at 6 letters');
  await page.fill('#ck-on-code', '');
  assert.ok(await page.isVisible('#ck-on-paste'));

  await page.evaluate(() => { window.__clip.text = 'มาเล่น Cereal Killer กัน ห้อง HELLO1 👉 https://liff.line.me/x?cereal=k7qpz2'; });
  await page.click('#ck-on-paste'); await page.waitForTimeout(100);
  assert.equal(await page.inputValue('#ck-on-code'), 'K7QPZ2', '?cereal= wins');
  assert.ok(await page.isVisible('#ck-on-join')); assert.ok(!(await page.isVisible('#ck-on-paste')));
  await page.fill('#ck-on-code', '');
  await page.evaluate(() => { window.__clip.text = '  zz9qp3 '; });
  await page.click('#ck-on-paste'); await page.waitForTimeout(100);
  assert.equal(await page.inputValue('#ck-on-code'), 'ZZ9QP3', 'a plain copied code');
  await page.fill('#ck-on-code', '');
  await page.evaluate(() => { window.__clip.fail = true; });
  await page.click('#ck-on-paste'); await page.waitForTimeout(100);
  assert.match(await page.textContent('#ck-on-err'), /📋 อ่านไม่ได้/);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ck-on-code', 'blocked clipboard → the box is focused');
  await page.evaluate(() => { window.__clip = { text: 'no code here', fail: false }; });
  await page.click('#ck-on-paste'); await page.waitForTimeout(100);
  assert.equal(await page.inputValue('#ck-on-code'), '', 'no 6-letter code → nothing pasted');

  // ---- 🌐 rows ----
  await open('online', [], ONLINE);
  await page.waitForSelector('#cerealModal .ck-game[data-game="o1"]');
  const on = await page.$$eval('#cerealModal .ck-game[data-game]', (els) => Object.fromEntries(els.map((e) => [e.dataset.game, (e.className.match(/r-[a-z]/) || [''])[0]])));
  assert.deepEqual(on, { o1: 'r-w', o2: 'r-l', o3: 'r-p' }, 'online: won / lost / playing');
  assert.equal(await page.$('#ck-on-empty'), null, 'no empty line with games');

  // ---- 320 px ----
  await page.setViewportSize({ width: 320, height: 700 });
  for (const t of ['online', 'local']) { await open(t, LOCAL, ONLINE); assert.ok(await noSideScroll(), t + ' fits 320 px'); }
  const box = await page.evaluate(() => { CK.tab('online'); const l = document.querySelector('#cerealModal .ck-code'), p = document.getElementById('ck-on-paste'); const a = l.getBoundingClientRect(), b = p.getBoundingClientRect(); return b.right <= a.right + 0.5 && b.left >= a.left; });
  assert.ok(box, '📋 วาง stays inside the code box at 320 px');

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('cereal-lobby-ux-qa: OK (row bars + .cur, empty lines, 📋 วาง / ▸, paste parsing, online bars, 320 px)');
})().catch((e) => { console.error(e); process.exit(1); });
