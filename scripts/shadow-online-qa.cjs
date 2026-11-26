// V101.379 ⚫⚪ ไพ่เงา 🌐 กับเพื่อน + 🔢 ห้องสด on the REAL index.html — two phones (two pages, two logins) playing through the REAL
// referee (functions/room-act.js runs here in node on a small in-memory Firestore; the pages reach it through exposeFunction, and
// their onSnapshot listeners poll it). Proves: the 🤖 · 📱 · 🌐 · 🔢 rail; 🌐 📤 ชวน creates a room and hands over a link ?bw=<code>
// (clipboard outside LINE); the friend joins by the code; a full game by taps — only the turn holder gets a hand, the waiter
// sees ⏳ and never the other's number, my face-down tile shows to me only; the end opens every number on both phones with the
// same winner, and each logs mode 'online' with its own win; 📤 สะกิด; past 1 h the waiter gets ⏰ รับชนะ and wins; 🔢: a 4-digit
// code, the creator lands in the game when the friend joins, a ⏱ clock, and a turn that runs out is played for the late player
// (its lowest tile) by the waiting phone; ✕ back to the rooms; 🏳 resign; 320 px fits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const R = require(path.resolve('functions/room-act.js'));

// ---- the in-memory Firestore the referee writes to ----------------------------------------------------------------------------
const store = new Map(); let auto = 0;
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)), ref: docRef(p) });
function docRef(p) { return { id: p.split('/').pop(), path: p, get: async () => snap(p), set: async (v) => { store.set(p, clone(v)); }, update: async (v) => { store.set(p, Object.assign(clone(store.get(p)) || {}, clone(v))); }, collection: (n) => colRef(p + '/' + n) }; }
function colRef(p, filters, lim) {
  filters = filters || [];
  return { doc: (id) => docRef(p + '/' + (id || ('room' + String(++auto).padStart(8, '0')))), where: (f, op, v) => colRef(p, filters.concat([[f, v]]), lim), limit: (n) => colRef(p, filters, n),
    get: async () => { let docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).filter((k) => filters.every(([f, v]) => (store.get(k) || {})[f] === v)).map(snap); if (lim) docs = docs.slice(0, lim); return { empty: !docs.length, docs }; } };
}
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => { const w = []; const tx = { get: (r) => r.get(), set: (r, v) => w.push(() => r.set(v)), update: (r, v) => w.push(() => r.update(v)) }; const out = await fn(tx); for (const f of w) await f(); return out; } };
class HttpsError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }
for (const [a, u, n] of [['authA', 'UA', 'มายด์'], ['authB', 'UB', 'ต้นข้าว']]) { store.set('user_auth_links/' + a, { effectiveUserId: u }); store.set('users/' + u, { nickName: n }); }
let seed = 3; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function phone(browser, auth) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.errors = errors;
  await page.exposeFunction('__roomAct', async (data) => { try { return { ok: await R.handle({ auth: { uid: auth }, data }, { db, HttpsError, now: Date.now(), rand }) }; } catch (e) { return { err: { code: e.code, details: e.details, message: e.message } }; } });
  await page.exposeFunction('__doc', (p) => (store.has(p) ? clone(store.get(p)) : null));
  await page.exposeFunction('__list', (col, uid) => [...store.keys()].filter((k) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/') && (store.get(k).authUids || []).includes(uid)).map((k) => Object.assign({ __id: k.split('/').pop() }, clone(store.get(k)))));
  await page.addInitScript((auth) => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.__clip = null; window.__logs = [];
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true });
    const poll = (get, cb) => { let last = '@'; const f = async () => { const v = await get(); const j = JSON.stringify(v); if (j !== last) { last = j; cb(v); } }; f(); const t = setInterval(f, 120); return () => clearInterval(t); };
    const docApi = (p) => ({ onSnapshot: (cb) => poll(() => window.__doc(p), (v) => cb({ exists: !!v, data: () => v })), collection: (n) => ({ doc: (id) => docApi(p + '/' + n + '/' + id) }) });
    const fake = { collection: (c) => ({ doc: (id) => docApi(c + '/' + id), where: (f, op, uid) => ({ onSnapshot: (cb) => poll(() => window.__list(c, uid), (v) => cb({ docs: v.map((x) => ({ id: x.__id, data: () => x })) })) }), add: () => Promise.resolve() }) };
    window.firebase = { auth: () => ({ currentUser: { uid: auth }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }),
      functions: () => ({ httpsCallable: (name) => (d) => (name === 'roomAct' ? window.__roomAct(d).then((r) => { if (r.err) { const e = new Error(r.err.message); e.code = r.err.code; e.details = r.err.details; throw e; } return { data: r.ok }; }) : Promise.reject(new Error('off'))) }),
      firestore: Object.assign(() => fake, { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  }, auth);
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); window.db = window.db || firebase.firestore();
    const s = GameLog.see; GameLog.see = function (g, x) { if (x && x.done) window.__logs.push({ g, mode: x.mode, win: x.win, score: x.score }); return s.apply(this, arguments); }; });
  return page;
}
const text = (p, sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim());
const until = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 5000 });

(async () => {
  const browser = await chromium.launch();
  const A = await phone(browser, 'authA'), B = await phone(browser, 'authB');

  // the rail and 🌐 ชวน
  await A.evaluate(() => bwOpen());
  assert.deepEqual(await A.$$eval('[aria-label="Who"] button', (b) => b.map((x) => x.textContent)), ['🤖 บอท', '📱 2 คน', '🌐 เพื่อน', '🔢 ห้องสด']);
  await A.click('#bw-who-online');
  await until(A, () => !!document.getElementById('bwo-new'));
  await A.click('#bwo-new');
  await until(A, () => !!window.__clip && !!document.getElementById('bwo-open'));
  const clip = await A.evaluate(() => window.__clip), code = clip.match(/\?bw=(\d{4})/)[1];
  assert.match(clip, /มายด์ ชวนดวลไพ่เงา · รหัส \d{4}/); assert.match(await text(A, '#bwo-open'), new RegExp('🔑 ' + code + ' ?รอเพื่อน…'));

  // the friend joins by the code → both in the game
  await B.evaluate(() => { bwOpen(); BW.who('online'); });
  await until(B, () => !!document.getElementById('bwo-code'));
  await B.fill('#bwo-code', code); await B.click('#bwo-join');
  await until(B, () => !!document.getElementById('bw-table'));
  await until(A, () => !!document.querySelector('[data-room]'));
  await A.click('[data-room]'); await until(A, () => !!document.getElementById('bw-table'));

  // a full game by taps
  const P = { a: A, b: B };
  for (let guard = 0; guard < 40; guard++) {
    const room = [...store.entries()].find(([k, v]) => /^rooms\/[^/]+$/.test(k) && v.code === code)[1];
    if (room.status !== 'playing') break;
    const me = P[room.turn], them = P[room.turn === 'a' ? 'b' : 'a'], auth = room.turn === 'a' ? 'authA' : 'authB';
    const roomId = [...store.keys()].find((k) => /^rooms\/[^/]+$/.test(k) && store.get(k).code === code).split('/')[1];
    const hand = store.get('rooms/' + roomId + '/hand/' + auth), sec = store.get('rooms/' + roomId + '/secret/hands');
    await until(me, () => !!document.getElementById('bw-hand'));
    await until(them, () => /⏳ รอ/.test((document.getElementById('bw-say') || {}).textContent || ''));
    assert.equal(await them.$('#bw-hand'), null, 'the waiter has no hand');
    if (sec.lt != null) assert.equal(await them.$$eval('#bw-table .bw-t:not(.back)', (e) => e.length), 1, 'my own face-down tile shows to me');
    if (sec.lt != null) assert.equal(await me.$$eval('#bw-table .bw-t:not(.back)', (e) => e.length), 0, 'the other\'s tile is only a colour');
    const n = hand.tiles[0];
    await me.click('#bw-hand button[data-n="' + n + '"]'); await me.click('#bw-play');
    await until(me, () => !document.getElementById('bw-hand') || document.querySelector('#bw-play').disabled === true);
    await me.waitForTimeout(150);
  }
  await until(A, () => !!document.getElementById('bw-final')); await until(B, () => !!document.getElementById('bw-final'));
  const fa = await text(A, '#bw-final'), fb = await text(B, '#bw-final');
  assert.ok((/คุณชนะ/.test(fa) && /แพ้/.test(fb)) || (/แพ้/.test(fa) && /คุณชนะ/.test(fb)) || (/เสมอ/.test(fa) && /เสมอ/.test(fb)), 'the same result on both phones: ' + fa + ' / ' + fb);
  assert.equal(await A.$$eval('#bw-reveal .bw-t.back', (e) => e.length), 0, 'every number open at the end');
  const la = (await A.evaluate(() => window.__logs)).filter((x) => x.g === 'bw'), lb = (await B.evaluate(() => window.__logs)).filter((x) => x.g === 'bw');
  assert.equal(la[0].mode, 'online'); assert.equal(lb[0].mode, 'online');
  assert.deepEqual([la[0].win, lb[0].win].sort(), la[0].win === 'd' ? ['d', 'd'] : ['l', 'w'], 'each logs its own win → 🏆');
  await A.click('#bw-final ~ .bw-act .bw-go'); await until(A, () => !!document.getElementById('bwo-new'));

  // 🌐 past 1 h: ⏰ รับชนะ; 📤 สะกิด
  await A.click('#bwo-new'); await until(A, () => !!document.getElementById('bwo-open'));
  const code2 = (await A.evaluate(() => window.__clip)).match(/\?bw=(\d{4})/)[1];
  await B.evaluate(() => BWOnline.leave()); await until(B, () => !!document.getElementById('bwo-code'));
  await B.fill('#bwo-code', code2); await B.click('#bwo-join'); await until(B, () => !!document.getElementById('bw-table'));
  const id2 = [...store.keys()].find((k) => /^rooms\/[^/]+$/.test(k) && store.get(k).code === code2).split('/')[1];
  const waiter = store.get('rooms/' + id2).turn === 'a' ? B : A;
  if (waiter === A) { await until(A, () => !!document.querySelector('[data-room]')); await A.evaluate((id) => BWOnline.open(id), id2); }
  await until(waiter, () => !!document.getElementById('bwo-nudge'));
  await waiter.evaluate(() => { window.__clip = null; }); await waiter.click('#bwo-nudge');
  await until(waiter, () => /ถึงตาคุณแล้ว/.test(window.__clip || ''));
  assert.equal(await waiter.$('#bwo-claim'), null, 'no claim before 1 h');
  store.set('rooms/' + id2, Object.assign(store.get('rooms/' + id2), { turnDeadline: Date.now() - 1000, updatedAt: Date.now() }));
  await until(waiter, () => !!document.getElementById('bwo-claim')); await waiter.click('#bwo-claim');
  await until(waiter, () => /คุณชนะ · หมดเวลา/.test((document.getElementById('bw-final') || {}).textContent || ''));

  // 🔢 live: code, the creator lands in the game, ⏱, a late turn played for them
  await A.evaluate(() => { BWOnline.leave(); BW.who('live'); }); await until(A, () => !!document.getElementById('bwo-live'));
  await A.click('#bwo-live'); await until(A, () => !!document.getElementById('bwo-livecode'));
  const code3 = (await text(A, '#bwo-livecode')).replace(/\D/g, ''); assert.match(code3, /^\d{4}$/);
  await B.evaluate(() => { BWOnline.leave(); BW.who('live'); }); await until(B, () => !!document.getElementById('bwo-code'));
  await B.fill('#bwo-code', code3); await B.click('#bwo-join');
  await until(A, () => !!document.getElementById('bwo-clock')); await until(B, () => !!document.getElementById('bwo-clock'));
  const id3 = [...store.keys()].find((k) => /^rooms\/[^/]+$/.test(k) && store.get(k).code === code3).split('/')[1];
  const r3 = store.get('rooms/' + id3), lateAuth = r3.turn === 'a' ? 'authA' : 'authB';
  assert.ok(r3.turnDeadline - Date.now() <= 30000 && r3.turnDeadline - Date.now() > 20000, '30 s a turn');
  store.set('rooms/' + id3, Object.assign(store.get('rooms/' + id3), { turnDeadline: Date.now() - 1000, updatedAt: Date.now() }));
  await new Promise((res) => setTimeout(res, 3500));
  const h3 = store.get('rooms/' + id3 + '/hand/' + lateAuth);
  assert.equal(h3.pend, 0, 'the waiting phone asked the referee: the late player\'s lowest tile (0) went down');
  // 🏳 resign; 320 px
  const resigner = r3.turn === 'a' ? A : B;
  resigner.once('dialog', (d) => d.accept()); await resigner.click('text=🏳 ยอมแพ้');
  await until(resigner, () => /คุณยอมแพ้/.test((document.getElementById('bw-final') || {}).textContent || ''));
  await A.setViewportSize({ width: 320, height: 640 }); await A.evaluate(() => { BWOnline.leave(); BW.who('online'); });
  await until(A, () => !!document.getElementById('bwo-new'));
  assert.ok(await A.$eval('#bwModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits');
  assert.equal(new Set(await A.$$eval('[aria-label="Who"] button', (b) => b.map((x) => Math.round(x.getBoundingClientRect().top)))).size, 1, 'the 4 choices on one line at 320 px');
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
  await browser.close();
  console.log('shadow-online-qa: OK — 🤖 · 📱 · 🌐 · 🔢 rail; 🌐 invite link ?bw=<code>, join by code, a full game on two phones (hand only for the turn holder, colours only for the other, my face-down tile to me), same result + all numbers at the end, each logs online + its win; 📤 สะกิด; ⏰ win after 1 h; 🔢 code → both in, ⏱ 30 s, a late turn played for them; 🏳 resign; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
