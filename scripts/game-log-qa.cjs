// V101.370 🎮 game time (owner: "เก็บ stat ให้ ADMIN ทราบว่าแต่ละเกม user ใช้เวลามาก-น้อย แต่ละตา", all 4 games, admin pick B) on the
// REAL index.html with a fake clock and a fake Firestore. Proves: a finished ⚫ ไพ่เงา game writes ONE game_plays doc with the seconds of
// each round (time to ▸ ลง), the level, win / score / per-round results, userId + authUid; a gap over 3 min counts as 3 min; the end
// screen's later renders write nothing more; 🧊 นับไว: seconds per question, ✓ n/5, ok/no; 🥣 Cereal and 🐺 หมาป่า: a day = a round,
// mode + my side's win; a game closed half-way writes nothing; not signed in (no userId) writes nothing.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all'); localStorage.setItem('cerealCoachSeen', 'all');
    let T = 1.8e12; const real = Date.now; Date.now = () => T; window.__adv = (ms) => { T += ms; }; window.__adds = [];
    const any = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : any), apply: () => any });
    const q = (name) => ({ add: (d) => { window.__adds.push([name, JSON.parse(JSON.stringify(d))]); return Promise.resolve({ id: 'x' }); }, where: () => q(name), orderBy: () => q(name), limit: () => q(name), get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: q }) });
    const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
    const fs = () => db; fs.FieldValue = { serverTimestamp: () => 'TS', increment: () => 0, arrayUnion: () => 0 }; fs.Timestamp = any;
    window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') return fs; if (k === 'auth') return () => ({ currentUser: { uid: 'auth1', getIdToken: async () => 'x' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }); return k === 'then' ? undefined : any; }, apply: () => any });
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    let s = 9; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); userId = 'U1'; });
  const plays = () => page.evaluate(() => window.__adds.filter((a) => a[0] === 'game_plays').map((a) => a[1]));

  // ---- ⚫ ไพ่เงา: 5 s a round, round 2 left for 10 min (counts 3 min) ----
  const bw = await page.evaluate(() => {
    let s = 4; BW._rng(() => ((s = (s * 16807) % 2147483647) / 2147483647));
    bwOpen(); BW.level(2); BW.start(); const g = BW._g(); let i = 0;
    while (!g.end) { __adv(i === 1 ? 600000 : 5000); BW.pick(g.me[0]); BW.play(); if (!g.end) BW.next(); i++; }
    BW.showAll(); return { n: g.hist.length, sc: g.sc.me + ':' + g.sc.bot, res: g.hist.map((h) => h.res), win: g.sc.me > g.sc.bot ? 'w' : g.sc.me < g.sc.bot ? 'l' : 'd' };
  });
  let p = await plays();
  assert.equal(p.length, 1, 'one doc per finished game (later renders add nothing)');
  const want = Array.from({ length: bw.n }, (_, i) => (i === 1 ? 180 : 5));
  assert.deepEqual({ game: p[0].game, mode: p[0].mode, rounds: p[0].rounds, sec: p[0].sec, win: p[0].win, score: p[0].score, res: p[0].res, userId: p[0].userId, authUid: p[0].authUid, from: p[0].from },
    { game: 'bw', mode: 'l2', rounds: want, sec: want.reduce((a, b) => a + b, 0), win: bw.win, score: bw.sc, res: bw.res, userId: 'U1', authUid: 'auth1', from: 0 }, 'ไพ่เงา: seconds per round, 10 min away = 3 min');
  assert.ok(p[0].endedAt > p[0].startedAt && p[0].v && p[0].at === 'TS');
  await page.evaluate(() => { BW.start(); __adv(4000); BW.pick(BW._g().me[0]); BW.play(); BW.close(); });
  assert.equal((await plays()).length, 1, 'closed half-way: nothing');

  // ---- 🧊 นับไว: 3 s a question ----
  const cg = await page.evaluate(() => {
    countOpen(); CG.start('rect'); const g = CG._g();
    for (let i = 0; i < 5; i++) { __adv(3000); if (i % 2 === 0) String(CG._count(g.p)).split('').forEach((d) => CG.key(+d)); else CG.key(0); CG.ok(); CG.next(); }
    return { right: g.right, res: g.res.map((x) => (x ? 'ok' : 'no')) };
  });
  p = await plays(); assert.equal(p.length, 2);
  assert.deepEqual({ game: p[1].game, mode: p[1].mode, rounds: p[1].rounds, score: p[1].score, res: p[1].res, win: p[1].win }, { game: 'count', mode: 'rect', rounds: [3, 3, 3, 3, 3], score: cg.right + '/5', res: cg.res, win: null }, 'นับไว: seconds per question');
  await page.evaluate(() => CG.close());

  // ---- 🥣 Cereal vs 🤖 as 🕵️: a day = a round; finished → my side's win ----
  await page.evaluate(() => { cerealOpen(); CK.vs('bot'); CK.me('detective'); CK.start(); });
  const ck = await page.evaluate(() => { const g = CK.game(); __adv(20000); g.day = 3; CK._.render(); __adv(7000); g.status = 'finished'; g.phase = 'over'; g.result = { winner: 'good', reason: 'x', day: 3 }; CK._.render(); return { me: g.me }; });
  p = await plays(); assert.equal(p.length, 3, 'Cereal: one doc');
  assert.deepEqual({ game: p[2].game, mode: p[2].mode, win: p[2].win, score: p[2].score, rounds: p[2].rounds.length, sec: p[2].sec }, { game: 'cereal', mode: 'bot detective', win: 'w', score: 'D3', rounds: 3, sec: 27 }, 'Cereal vs 🤖 ' + JSON.stringify(ck));
  await page.evaluate(() => { document.getElementById('cerealModal').style.display = 'none'; });

  // ---- 🐺 หมาป่า: a night + a day = a round ----
  await page.evaluate(() => { wolfOpen(); WW.start(); });
  const ww = await page.evaluate(() => { const g = WW._game(); __adv(30000); g.day = 2; g.status = 'finished'; g.phase = 'over'; g.result = { winner: 'village', day: 2 }; WW.peek(false); return { role: g.st.roles[g.me], n: g.n, level: g.level }; });
  p = await plays(); assert.equal(p.length, 4, 'หมาป่า: one doc');
  assert.deepEqual({ game: p[3].game, mode: p[3].mode, win: p[3].win, score: p[3].score, rounds: p[3].rounds.length, sec: p[3].sec }, { game: 'wolf', mode: ww.n + ' ' + ww.level, win: ww.role === 'wolf' ? 'l' : 'w', score: 'D2', rounds: 2, sec: 30 }, 'หมาป่า');
  await page.evaluate(() => { document.getElementById('wolfModal').style.display = 'none'; });

  // ---- not signed in: nothing ----
  await page.evaluate(() => { userId = ''; bwOpen(); BW.start(); const g = BW._g(); while (!g.end) { __adv(2000); BW.pick(g.me[0]); BW.play(); if (!g.end) BW.next(); } });
  assert.equal((await plays()).length, 4, 'no userId: nothing written');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('game-log-qa: OK — ไพ่เงา seconds per round (3 min cap), one doc, closed half-way = none; นับไว per question; Cereal + หมาป่า per day with my win; not signed in = none');
})().catch((e) => { console.error(e); process.exit(1); });
