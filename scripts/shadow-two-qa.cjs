// V101.376 ⚫⚪ ไพ่เงา 📱 2 คน เครื่องเดียว (owner "ทำให้ user เล่น 2 คน", pick A of A+B+C, mockup-shadow-2p/) on the REAL index.html, 390×844.
// Proves: the lobby's 🤖 กับบอท │ 📱 2 คน rail (levels only with the bot); a cover screen before every hand change, and nothing of either
// hand is on the page while it shows; the follower sees the leader's colour only; the round shows colours only (no number until the
// end); the rules hold over 200 random games (each tile once a side, higher wins, a draw scores nobody, the winner leads, stop at 5 or
// 9); the end names the winner and opens every number, no 📤, 📱 back to the lobby; the bot game is untouched; game_plays mode 'two' with
// no win; 320 px fits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.reject(new Error('off')) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    let q = 5; Math.random = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); let s = 9; BW._rng(() => ((s = (s * 16807) % 2147483647) / 2147483647)); });

  // lobby
  await page.evaluate(() => bwOpen());
  assert.deepEqual(await page.$$eval('[aria-label="Who"] button', (b) => b.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['🤖 บอท*', '📱 2 คน', '🌐 เพื่อน', '🔢 ห้องสด']);
  assert.ok(await page.$('#bw-lv2'), 'levels with the bot');
  await page.click('#bw-who-two');
  assert.equal(await page.$('#bw-lv2'), null, 'no levels for 2 คน'); assert.match(await page.textContent('#bw-two-note'), /ส่งเครื่องให้กัน/);

  // a full game by taps, checking the cover and what is on the page
  await page.click('#bw-start');
  const g0 = await page.evaluate(() => ({ lead: BW._g().lead }));
  const P = { me: '1️⃣', bot: '2️⃣' }, other = (s) => (s === 'me' ? 'bot' : 'me');
  let rounds = 0, covers = 0;
  for (let guard = 0; guard < 60; guard++) {
    const st = await page.evaluate(() => { const g = BW._g(); return { end: g.end, cover: g.cover, last: !!g.last, lt: g.lt, lead: g.lead, me: g.me.slice(), bot: g.bot.slice() }; });
    if (st.end) break;
    if (st.cover) {
      covers++;
      const who = st.lt == null ? st.lead : other(st.lead);
      assert.match(await page.textContent('#bw-cvt'), new RegExp('ส่งเครื่องให้ ' + P[who]));
      assert.equal(await page.$('#bw-hand'), null, 'the cover shows no hand');
      if (st.lt != null) assert.match(await page.textContent('#bw-cover .bw-note'), st.lt % 2 ? /⚪/ : /⚫/, 'the follower is told the colour');
      const txt = await page.$eval('#bw-cover', (c) => [...c.children].filter((x) => !x.classList.contains('bw-top')).map((x) => x.textContent).join(' '));
      assert.doesNotMatch(txt.replace(/[12]️⃣/g, ''), /\d/, 'no number on the cover');
      await page.click('#bw-ready'); continue;
    }
    if (st.last) {
      const L = await page.evaluate(() => BW._g().last);
      assert.equal(await page.$$eval('#bw-table .bw-t:not(.back)', (e) => e.length), 0, 'the round shows colours only');
      assert.match(await page.textContent('#bw-res'), L.res === 'draw' ? /เสมอ/ : new RegExp(P[L.res === 'win' ? 'me' : 'bot'] + ' ชนะตานี้'));
      rounds++; await page.click('#bw-next'); continue;
    }
    const who = st.lt == null ? st.lead : other(st.lead), hand = st[who];
    assert.equal(await page.$$eval('#bw-hand button:not([disabled])', (b) => b.length), hand.length, P[who] + "'s own hand");
    if (st.lt != null) assert.equal(await page.$$eval('#bw-table .bw-t.back', (e) => e.length), 1, 'the leader tile face down');
    await page.click('#bw-hand button[data-n="' + hand[0] + '"]'); await page.click('#bw-play');
  }
  const end = await page.evaluate(() => { const g = BW._g(); return { end: g.end, sc: g.sc, n: g.hist.length }; });
  // the last round goes straight to the end screen
  assert.ok(end.end && rounds === end.n - 1 && covers >= 2 * end.n - 1, 'played to the end, a cover each hand change ' + JSON.stringify({ rounds, covers }));
  assert.equal(await page.$$eval('#bw-reveal .bw-t.back', (e) => e.length), 0, 'the end opens every number');
  const fin = await page.textContent('#bw-final');
  assert.match(fin, end.sc.me === end.sc.bot ? /🤝/ : new RegExp('🏆 ' + (end.sc.me > end.sc.bot ? '1️⃣' : '2️⃣')));
  assert.equal(await page.$('#bw-share'), null, 'no 📤 for 2 คน'); assert.equal(await page.textContent('#bw-lvl'), '📱');
  void g0;

  // the rules over 200 random games (through BW.pick / BW.play / BW.ready / BW.next)
  const rules = await page.evaluate(() => {
    const bad = []; let fives = 0;
    for (let k = 0; k < 200; k++) {
      BW.start(); const g = BW._g(), seen = { me: [], bot: [] };
      while (!g.end) {
        if (g.cover) { BW.ready(); continue; }
        if (g.last) { BW.next(); continue; }
        const s = g.lt == null ? g.lead : (g.lead === 'me' ? 'bot' : 'me'), hand = g[s];
        const n = hand[Math.floor(Math.random() * hand.length)]; seen[s].push(n); BW.pick(n); BW.play();
        const L = g.last;
        if (L) {
          const want = L.m > L.b ? 'win' : L.m < L.b ? 'lose' : 'draw';
          if (L.res !== want) bad.push('res ' + JSON.stringify(L));
          if (L.res !== 'draw' && !g.end && g.lead !== (L.res === 'win' ? 'me' : 'bot')) bad.push('lead');
        }
      }
      if (new Set(seen.me).size !== seen.me.length || new Set(seen.bot).size !== seen.bot.length) bad.push('tile twice');
      const me = g.hist.filter((h) => h.res === 'win').length, bot = g.hist.filter((h) => h.res === 'lose').length;
      if (me !== g.sc.me || bot !== g.sc.bot) bad.push('score');
      if (!(g.sc.me === 5 || g.sc.bot === 5 || g.hist.length === 9)) bad.push('stop');
      if (g.sc.me === 5 || g.sc.bot === 5) fives++;
    }
    return { bad: bad.slice(0, 5), fives };
  });
  assert.deepEqual(rules.bad, []); assert.ok(rules.fives > 20, 'some games end at 5');

  // the log: mode 'two', no win; the bot game untouched
  const logs = await page.evaluate(() => { const out = []; const s = GameLog.see; GameLog.see = function (gm, st) { if (st && st.done) out.push({ mode: st.mode, win: st.win }); return s.apply(this, arguments); };
    BW.start(); const g = BW._g(); while (!g.end) { if (g.cover) BW.ready(); else if (g.last) BW.next(); else { const s2 = g.lt == null ? g.lead : (g.lead === 'me' ? 'bot' : 'me'); BW.pick(g[s2][0]); BW.play(); } }
    BW.who('bot'); BW.start(); const h = BW._g(); while (!h.end) { if (h.last) BW.next(); else { BW.pick(h.me[0]); BW.play(); } }
    GameLog.see = s; return out; });
  assert.deepEqual(logs[0], { mode: 'two', win: null }, '2 คน: time only, no win');
  const lb = logs[logs.length - 1];   // each render after the end calls see(); GameLog itself sends once
  assert.match(lb.mode, /^l\d$/); assert.ok(['w', 'l', 'd'].includes(lb.win), 'the bot game still logs its win');
  assert.ok(await page.isVisible('#bw-share'), 'the bot game keeps 📤');

  // V101.377 names: typed in the lobby, kept, shown instead of 1️⃣ / 2️⃣ (escaped), ↺ keeps them, empty = the numbers
  await page.evaluate(() => { BW.lobby(); BW.who('two'); });
  await page.fill('#bw-n1', '  แนน  '); await page.fill('#bw-n2', '<b>บิว</b>');
  await page.click('#bw-start');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bwNames'))), { me: 'แนน', bot: '<b>บิว</b>' });
  assert.match(await page.textContent('#bw-score'), /แนน 0 : 0 <b>บิว<\/b>/, 'names in the score pill, escaped'); assert.equal(await page.$('#bw-score b'), null, 'no injected markup');
  assert.match(await page.textContent('#bw-cvt'), /ส่งเครื่องให้ (แนน|<b>บิว<\/b>)$/);
  await page.evaluate(() => { const g = BW._g(); while (!g.end) { if (g.cover) BW.ready(); else if (g.last) BW.next(); else { const s2 = g.lt == null ? g.lead : (g.lead === 'me' ? 'bot' : 'me'); BW.pick(g[s2][0]); BW.play(); } } });
  assert.match(await page.textContent('#bw-final'), /แนน \d : \d <b>บิว<\/b>/, 'names at the end');
  await page.click('#bw-again'); assert.match(await page.textContent('#bw-score'), /^แนน 0 : 0 /, '↺ keeps the names');
  await page.evaluate(() => { BW.lobby(); BW.who('two'); });
  assert.equal(await page.inputValue('#bw-n1'), 'แนน', 'the lobby remembers'); assert.equal(await page.inputValue('#bw-n2'), '<b>บิว</b>');
  await page.fill('#bw-n1', ''); await page.fill('#bw-n2', ''); await page.click('#bw-start');
  assert.match(await page.textContent('#bw-score'), /^1️⃣ 0 : 0 2️⃣$/, 'empty = the numbers');
  // V101.377 snow (christmas.js): hidden while a game popup is open, back when it closes (inline style — reduced motion hides it by CSS here)
  await page.evaluate(() => document.documentElement.classList.add('xm'));
  await page.waitForFunction(() => { const sn = document.querySelector('.xm-snow'); return !!sn && sn.style.display === 'none'; }, null, { timeout: 3000 });
  await page.evaluate(() => BW.close());
  await page.waitForFunction(() => document.querySelector('.xm-snow').style.display === '', null, { timeout: 3000 });
  await page.evaluate(() => bwOpen());
  await page.waitForFunction(() => document.querySelector('.xm-snow').style.display === 'none', null, { timeout: 3000 });
  await page.evaluate(() => { BW.close(); document.documentElement.classList.remove('xm'); });

  // 320 px: lobby + cover + a hand
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { BW.lobby(); BW.who('two'); });
  const fits = () => page.$eval('#bwModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1);
  assert.ok(await fits(), 'lobby 320'); await page.click('#bw-start'); assert.ok(await fits(), 'cover 320');
  await page.click('#bw-ready'); assert.ok(await fits(), 'hand 320');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('shadow-two-qa: OK — 🤖 │ 📱 2 คน rail, a cover before every hand change (no hand, no number on it), the follower sees a colour, rounds show colours only, 200 games keep the rules, the end names 1️⃣/2️⃣ and opens all, no 📤, log mode two / no win, bot game untouched, names typed/kept/escaped/↺, snow hidden while a game is open, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
