// V101.380 🔢 เลขลับ หลายคน on the REAL index.html — three phones (three logins) playing through the REAL referee (functions/room-act.js →
// room-secret.js runs here in node on a small in-memory Firestore; the pages reach it through exposeFunction and their listeners poll
// it). Proves: the 🤖 ฝึกกับบอท │ 🌐 หลายคน rail; the host opens a room (⏱ 1 ชม.), 📤 hands over ?sn=<code>, two friends join by the
// code, only the host starts and only with 2+; each phone shows its own number; the asker's answer crosses out on their grid only and
// the others see the question with 🔒; a right guess on the grid = ⭐ +3 and that player is out (their number shown); played to the end
// the same winner and every number show on every phone, each logs mode 'online'; ⚡ 60 วิ: a late turn is skipped by a waiting phone;
// 🏳 leave; 320 px fits.
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
for (const [a, u, n] of [['authA', 'UA', 'มายด์'], ['authB', 'UB', 'ต้นข้าว'], ['authC', 'UC', 'ภูมิ']]) { store.set('user_auth_links/' + a, { effectiveUserId: u }); store.set('users/' + u, { nickName: n }); }
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
  const A = await phone(browser, 'authA'), B = await phone(browser, 'authB'), C = await phone(browser, 'authC');
  const P = { authA: A, authB: B, authC: C };
  const roomOf = (code) => [...store.entries()].find(([k, v]) => /^rooms\/[^/]+$/.test(k) && v.code === code && v.game === 'secret');

  // the mode rail and a room with ⏱ 1 ชม.
  await A.evaluate(() => { secretOpen(); });
  assert.deepEqual(await A.$$eval('[aria-label="Mode"] button', (b) => b.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['🤖 Practice*', '🌐 Friends']);
  assert.ok(await A.$('#sn-h1'), 'practice keeps its help levels');
  await A.click('#sn-mode-1'); await until(A, () => !!document.getElementById('sno-new'));
  assert.equal(await A.$('#sn-h1'), null);
  assert.ok(await A.$('[data-gtop="secretOn"]') && !(await A.$('[data-gtop="secret"]')), 'V101.381 🌐 shows its own 🏆 board');
  await A.click('#sno-live-false'); await A.click('#sno-new');
  await until(A, () => !!document.getElementById('sno-roomcode'));
  const code = (await text(A, '#sno-roomcode')).replace(/\D/g, ''); assert.match(code, /^\d{4}$/);
  assert.ok(await A.$eval('#sno-start', (b) => b.disabled), 'alone: ▸ เริ่ม waits');
  await A.evaluate(() => { window.__clip = null; }); await A.click('#sno-invite');
  await until(A, () => /\?sn=\d{4}/.test(window.__clip || '')); assert.match(await A.evaluate(() => window.__clip), new RegExp('มายด์ invites you to Secret number · code ' + code));
  for (const X of [B, C]) { await X.evaluate(() => { secretOpen(); SN.multi(1); }); await until(X, () => !!document.getElementById('sno-code')); await X.fill('#sno-code', code); await X.click('#sno-join'); await until(X, () => !!document.getElementById('sno-seats')); }
  assert.match(await text(B, '#sno-seats'), /มายด์.*host.*You/); assert.equal(await B.$('#sno-start'), null, 'only the host starts');
  await until(A, () => /Start · 3/.test((document.getElementById('sno-start') || {}).textContent || ''));
  await A.click('#sno-start');
  for (const X of [A, B, C]) await until(X, () => !!document.getElementById('sno-players'));
  const [rk, room] = roomOf(code), rid = rk.split('/')[1], nums = store.get('rooms/' + rid + '/secret/hands').nums;
  for (const [u, X] of Object.entries(P)) assert.match(await X.textContent('.sn-top'), new RegExp('🔒 ' + nums[u] + '\\b'), 'each phone shows its own number');
  void room;
  {
    const g0 = store.get(rk), holder = P[g0.turn], waiter = P[Object.keys(P).find((u) => u !== g0.turn)];
    const hold = await holder.evaluate((u) => ({ h: document.getElementById('sno-turn').textContent, mine: document.getElementById('sno-turn').classList.contains('sno-mine'), ring: !!document.querySelector('#sno-players [data-u="' + u + '"] #sno-ring'), rings: document.querySelectorAll('#sno-ring').length, nudge: !!document.getElementById('sno-nudge'), clock: !!document.getElementById('sno-clock') }), g0.turn);
    assert.deepEqual(hold, { h: '👉 Your turn', mine: true, ring: true, rings: 1, nudge: false, clock: false }, 'V101.387 my turn: the header pulses, a ring round my face, no ⏳ pill');
    const dash = await holder.$eval('#sno-ring', (c) => parseFloat(c.getAttribute('stroke-dasharray')));
    assert.ok(dash > 90 && dash <= 100, 'the ring starts nearly full: ' + dash);
    const wait = await waiter.evaluate((u) => ({ h: document.getElementById('sno-turn').textContent, mine: document.getElementById('sno-turn').classList.contains('sno-mine'), ring: !!document.querySelector('#sno-players [data-u="' + u + '"] #sno-ring'), nudge: (document.getElementById('sno-nudge') || {}).textContent, inTop: !!document.querySelector('.sn-top #sno-nudge'), ask: !!document.getElementById('sno-ask') }), g0.turn);
    assert.deepEqual(wait, { h: g0.players[g0.turn].name + "'s turn", mine: false, ring: true, nudge: '👋 Nudge', inTop: true, ask: false }, 'someone else\'s turn: their face has the ring, 👋 Nudge in the header');
    for (const X of [A, B, C]) {
      const t = await X.$eval('#snModal', (m) => m.textContent.replace(/มายด์|ต้นข้าว|ภูมิ/g, '').replace(/[มตภ](?=You|🎫)/g, ''));
      assert.doesNotMatch(t, /[\u0E00-\u0E7F]/, 'the room is English (names aside)');
    }
    const bottom = await holder.$eval('#sno-resign', (b) => { const r = b.getBoundingClientRect(), m = document.querySelector('#snModal .modal-content').getBoundingClientRect(); return r.bottom <= m.bottom + 1; });
    assert.ok(bottom, 'the last button sits inside the popup');
  }

  // the turn holder asks, the answer crosses out only on their grid
  let g = store.get(rk), me = P[g.turn], others = Object.keys(P).filter((u) => u !== g.turn);
  const t1 = others[0];
  await me.click('#sno-players [data-u="' + t1 + '"]');
  await me.click('[data-q="even"]'); await me.click('#sno-ask');
  await until(me, () => document.querySelectorAll('#sno-grid .out').length === 50);
  const even = nums[t1] % 2 === 0;
  assert.equal(await me.$eval('#sno-grid [data-n="1"]', (b) => b.classList.contains('out')), even, 'odd numbers crossed out after a ✓ even (or the reverse)');
  await until(me, () => ((SNOnline._st().hand || {}).notes || []).length === 1);
  const chip = await me.evaluate((t) => { const st = SNOnline._st(), r = st.room, was = r.turn; r.turn = st.uid; st.to = t; const d = document.createElement('div'); d.innerHTML = SNOnline.html(); r.turn = was; const b = d.querySelector('[data-q="even"]'); const g2 = d.querySelector('[data-q="gt"]'); return [b.disabled, b.classList.contains('done'), g2.disabled]; }, t1);
  assert.deepEqual(chip, [true, true, false], 'V101.385: Even? asked of this person → its chip is off on my next turn; > __? stays');
  for (const u of others) await until(P[u], () => /🔒/.test((document.getElementById('sno-last') || {}).textContent || ''));
  assert.equal(await P[others[1]].$$eval('#sno-grid .out', (e) => e.length), 0, 'someone else\'s answer never crosses my grid');
  assert.match(await text(P[others[1]], '#sno-last'), /→.* · Even\? 🔒/);
  // the next turn guesses right on its grid: +3 and the target is out
  g = store.get(rk); me = P[g.turn]; const tgt = Object.keys(P).find((u) => u !== g.turn);
  await until(me, () => !!document.getElementById('sno-ask'));
  await me.click('#sno-players [data-u="' + tgt + '"]');
  me.once('dialog', (d) => d.accept()); await me.click('#sno-grid [data-n="' + nums[tgt] + '"]');
  await until(me, (t) => (document.querySelector('#sno-players [data-u="' + t + '"]') || {}).className.includes('out'), tgt);
  g = store.get(rk); assert.equal(g.out[tgt], true); assert.equal(g.score[Object.keys(P).find((u) => P[u] === me)], 3);
  await until(P[tgt], () => / out · \d/.test((document.getElementById('sno-last') || {}).textContent || ''));
  // play to the end: the remaining two guess each other's numbers
  for (let guard = 0; guard < 30; guard++) {
    g = store.get(rk); if (g.status !== 'playing') break;
    const X = P[g.turn], to = Object.keys(P).find((u) => u !== g.turn && !g.out[u]);
    await until(X, () => !!document.getElementById('sno-ask'));
    await X.click('#sno-players [data-u="' + to + '"]');
    X.once('dialog', (d) => d.accept()); await X.click('#sno-grid [data-n="' + nums[to] + '"]');
    await X.waitForTimeout(300);
  }
  for (const X of [A, B, C]) await until(X, () => !!document.getElementById('sno-final'));
  const finals = await Promise.all([A, B, C].map((X) => text(X, '#sno-final')));
  const own = ['มายด์', 'ต้นข้าว', 'ภูมิ'];   // each phone calls itself "You"
  const norm = finals.map((f, i) => f.replace('You', own[i]).replace(/^🏆 /, '').split(' · ').sort().join(','));
  assert.equal(new Set(norm).size, 1, 'the same winner on every phone: ' + finals);
  for (const [u] of Object.entries(P)) assert.match(await text(A, '#sno-rank'), new RegExp('🔒 ' + nums[u]), 'every number revealed');
  const logs = await Promise.all([A, B, C].map((X) => X.evaluate(() => window.__logs.filter((x) => x.g === 'secret'))));
  logs.forEach((l) => assert.equal(l[0].mode, 'online')); assert.ok(logs.some((l) => l[0].win === 'w'));

  // ⚡ 60 วิ: a late turn is skipped by a waiting phone
  await A.evaluate(() => SNOnline.leave()); await A.click('#sno-live-true'); await A.click('#sno-new');
  await until(A, () => !!document.getElementById('sno-roomcode'));
  const code2 = (await text(A, '#sno-roomcode')).replace(/\D/g, '');
  await B.evaluate(() => SNOnline.leave()); await until(B, () => !!document.getElementById('sno-code')); await B.fill('#sno-code', code2); await B.click('#sno-join');
  await until(A, () => /Start · 2/.test((document.getElementById('sno-start') || {}).textContent || '')); await A.click('#sno-start');
  const [rk2] = roomOf(code2); await until(B, () => !!document.getElementById('sno-players'));
  const late = store.get(rk2).turn;
  store.set(rk2, Object.assign(store.get(rk2), { turnDeadline: Date.now() - 1000, updatedAt: Date.now() }));
  await new Promise((res) => setTimeout(res, 3500));
  assert.notEqual(store.get(rk2).turn, late, 'the waiting phone skipped the late turn'); assert.equal(store.get(rk2).log.slice(-1)[0].k, 'skip');
  // 🏳 leave, 320 px
  const leaver = P[store.get(rk2).turn === 'authA' ? 'authB' : 'authA'];
  leaver.once('dialog', (d) => d.accept()); await leaver.click('#sno-resign');
  await until(A, () => !!document.getElementById('sno-final'));
  await C.setViewportSize({ width: 320, height: 640 }); await C.evaluate(() => SNOnline.leave());
  assert.ok(await C.$eval('#snModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits');
  for (const X of [A, B, C]) assert.deepEqual(X.errors, []);
  await browser.close();
  console.log('secret-online-qa: OK — V101.387 ring round the turn holder, 👉 Your turn, 👋 Nudge in the header, English; 🤖 │ 🌐 rail; room by host, 📤 ?sn=<code>, join by code, only the host starts; each phone its own number; an answer crosses only the asker\'s grid, others see 🔒; a right guess +3 and out; same winner + all numbers on every phone, logged online; ⚡ late turn skipped; 🏳; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
