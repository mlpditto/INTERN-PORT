// V101.389 🪨 Carry 13 online on the REAL index.html — three phones (three logins) playing through the REAL referee (functions/room-act.js
// → room-rock13.js runs here in node on a small in-memory Firestore; the pages reach it through exposeFunction and their listeners poll
// it). Proves: the 🤖 Practice │ 🌐 With friends rail; the host opens a room (7 rounds, ⚡ 60 s), 📤 hands over ?r13=<code>, two friends
// join by the code, only the host starts; layout B: in the secret pick a ring round every face still picking, my pick shows only on my
// phone ("🔒 You sent"), the others see ✓; then the faces in placing order with chip + card, ONE ring round the one placing, "👉 Your
// turn" pulses there and "<name>'s turn" + 👋 Nudge (?r13=1) everywhere else; English apart from names; 🌈 taps a carrier; played to
// the end the same winner shows on every phone and each logs rock13 mode 'live'; a late turn is played on by a waiting phone; 🏳 the
// leaver's face becomes 🤖; 320 px fits.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const R = require(path.resolve('functions/room-act.js'));
const Rules = require(path.resolve('public/rock13-rules.js'));

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
let seed = 9; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function phone(browser, auth) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.errors = errors;
  await page.exposeFunction('__roomAct', async (data) => { try { return { ok: await R.handle({ auth: { uid: auth }, data }, { db, HttpsError, now: Date.now(), rand }) }; } catch (e) { return { err: { code: e.code, details: e.details, message: e.message } }; } });
  await page.exposeFunction('__doc', (p) => (store.has(p) ? clone(store.get(p)) : null));
  await page.exposeFunction('__list', (col, uid) => [...store.keys()].filter((k) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/') && (store.get(k).authUids || []).includes(uid)).map((k) => Object.assign({ __id: k.split('/').pop() }, clone(store.get(k)))));
  await page.addInitScript((auth) => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen', 'r13TourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    localStorage.setItem('r13Cfg', JSON.stringify({ n: 5, rounds: 7 }));
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
const until = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 6000 });
const shot = (X, n) => (process.env.R13_SHOTS ? X.locator('#r13Modal .modal-content').screenshot({ path: path.join(process.env.R13_SHOTS, n + '.png') }) : null);   // optional proof pictures
const full = (rk) => { const r = store.get(rk), G = clone(r.g); if (G.phase === 'submit') G.subs = (store.get(rk + '/secret/subs') || {}).subs || {}; return G; };

(async () => {
  const browser = await chromium.launch();
  const A = await phone(browser, 'authA'), B = await phone(browser, 'authB'), C = await phone(browser, 'authC');
  const P = { authA: A, authB: B, authC: C }, byAuth = (u) => P[u];
  const roomOf = (code) => [...store.entries()].find(([k, v]) => /^rooms\/[^/]+$/.test(k) && v.code === code && v.game === 'rock13');

  // the mode rail, a room with 7 rounds
  await A.evaluate(() => { rock13Open(); });
  assert.deepEqual(await A.$$eval('#r13Modal [aria-label="Mode"] button', (b) => b.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['🤖 Practice*', '🌐 With friends']);
  assert.ok(await A.$('#r13-start'), 'practice is still there');
  await A.click('#r13-mode-1'); await until(A, () => !!document.getElementById('r13o-new'));
  assert.equal(await A.$('#r13-start'), null);
  assert.equal(await text(A, '#r13o-new'), '＋ New room · ⚡ 60 s', 'lean: the rounds rail above says 7 | 14');
  assert.equal(await A.$eval('#r13-r7', (b) => b.classList.contains('on')), true);
  await A.click('#r13o-new');
  await until(A, () => !!document.getElementById('r13o-roomcode'));
  const code = (await text(A, '#r13o-roomcode')).replace(/\D/g, ''); assert.match(code, /^\d{4}$/);
  assert.ok(await A.$eval('#r13o-start', (b) => b.disabled), 'alone: Start waits');
  assert.match(await text(A, '#r13o-seats'), /🤖 ×2fills/, 'empty seats show the 🤖 that will fill to 3');
  await A.evaluate(() => { window.__clip = null; }); await A.click('#r13o-invite');
  await until(A, () => /\?r13=\d{4}/.test(window.__clip || '')); assert.match(await A.evaluate(() => window.__clip), new RegExp('มายด์ invites you to Carry 13 · code ' + code));
  for (const X of [B, C]) { await X.evaluate(() => { rock13Open(); R13.online(1); }); await until(X, () => !!document.getElementById('r13o-code')); await X.fill('#r13o-code', code); await X.click('#r13o-join'); await until(X, () => !!document.getElementById('r13o-seats')); }
  assert.equal(await B.$('#r13o-start'), null, 'only the host starts');
  await until(A, () => /Start · 3$/.test((document.getElementById('r13o-start') || {}).textContent || ''));
  await A.click('#r13o-start');
  for (const X of [A, B, C]) await until(X, () => !!document.getElementById('r13o-row'));
  const [rk] = roomOf(code), order = store.get(rk).order;

  // the secret pick: rings round everyone still picking; my pick only on my phone
  for (const X of [A, B, C]) {
    const v = await X.evaluate(() => ({ h: document.getElementById('r13o-turn').textContent, mine: document.getElementById('r13o-turn').classList.contains('r13o-mine'), rings: document.querySelectorAll('#r13o-row .r13o-ring').length }));
    assert.deepEqual(v, { h: '👉 Pick in secret', mine: true, rings: 3 });
  }
  await A.click('.r13-card[data-card="5"]'); await A.click('.r13-chip[data-chip="b"]');
  assert.equal(await text(A, '#r13o-send'), '▸ Send 5 · 🔵');
  await A.click('#r13o-send');
  await until(A, () => /🔒 You sent 5 · 🔵/.test((document.getElementById('r13o-sent') || {}).textContent || ''));
  await until(B, () => document.querySelectorAll('#r13o-row .r13o-ring').length === 2);
  assert.equal(await A.$eval('#r13o-turn', (e) => e.textContent), 'Waiting for 2');
  assert.equal(await B.$('#r13o-row [data-seat="0"] .r13o-ring'), null, 'my ring is gone on their phones (sent)');
  assert.deepEqual(await B.$$eval('#r13o-row small', (e) => e.map((x) => x.textContent)), ['🪨0', '🪨0', '🪨0'], 'lean: no … / ✓ under the faces, the ring says it');
  assert.equal(await B.$('#r13o-sent'), null); assert.doesNotMatch(await B.$eval('#r13o-row', (e) => e.textContent), /🔵5/, 'my pick is not on their phone');
  await shot(B, 'online-pick');

  // play to the end through the pages; check the turn look once
  let looked = false, rainbow = false;
  for (let guard = 0; guard < 120; guard++) {
    const room = store.get(rk); if (room.status !== 'playing') break;
    const G = full(rk);
    if (G.phase === 'submit') {
      for (let s = 0; s < order.length; s++) if (!room.g.sent[s]) {
        const X = byAuth(order[s]), p = G.players[s];
        await until(X, () => !!document.getElementById('r13o-send'));
        const chip = p.chips.w > 0 && G.round >= 3 ? 'w' : ['r', 'g', 'b'].find((c) => p.chips[c] > 0) || 'w';
        await X.click('.r13-card[data-card="' + p.cards[0] + '"]'); await X.click('.r13-chip[data-chip="' + chip + '"]'); await X.click('#r13o-send');
        await until(X, (s) => { const st = R13Online._st().room; return !st.g || st.g.phase !== 'submit' || !!st.g.sent[s]; }, s);
      }
      continue;
    }
    const t = Rules.turn(G), X = byAuth(order[t]);
    await until(X, () => document.getElementById('r13o-turn') && document.getElementById('r13o-turn').textContent === '👉 Your turn');
    if (!looked) {
      looked = true;
      const hold = await X.evaluate((t) => ({ mine: document.getElementById('r13o-turn').classList.contains('r13o-mine'), rings: document.querySelectorAll('#r13o-row .r13o-ring').length, ringOn: !!document.querySelector('#r13o-row [data-seat="' + t + '"] .r13o-ring'), nudge: !!document.getElementById('r13o-nudge') }), t);
      assert.deepEqual(hold, { mine: true, rings: 1, ringOn: true, nudge: false }, 'my turn: the header pulses, one ring round my face');
      const W = byAuth(order[(t + 1) % 3]);
      await until(W, (t) => !!document.querySelector('#r13o-row [data-seat="' + t + '"] .r13o-ring'), t);
      const wait = await W.evaluate(() => ({ h: document.getElementById('r13o-turn').textContent, nudge: (document.getElementById('r13o-nudge') || {}).textContent, put: !!document.getElementById('r13o-put') }));
      if (G.subs[t].chip !== 'w') { const pv = Rules.preview(G, t, G.subs[t].chip); assert.equal(await text(X, '#r13o-put'), '▸ Place ' + (pv.take ? '💥 🪨' + pv.take : '→ ' + pv.total), 'lean: the outcome is in the button'); }
      assert.equal(await X.$('#r13o-pv'), null, 'no separate preview line');
      assert.deepEqual(wait, { h: G.players[t].name + "'s turn", nudge: '👋 Nudge', put: false });
      await shot(X, 'online-mine'); await shot(W, 'online-wait');
      const faces = await W.$$eval('#r13o-row .r13o-f small', (e) => e.map((x) => x.textContent));
      assert.ok(faces.every((f) => /^⏭?[🔴🟢🔵🌈]\d 🪨\d+$/u.test(f)), 'each face: chip + card · 🪨 — ' + faces);
      await W.evaluate(() => { window.__clip = null; }); await W.click('#r13o-nudge'); await until(W, () => /\?r13=1/.test(window.__clip || ''));
      for (const Y of [A, B, C]) {
        const tx = await Y.$eval('#r13Modal', (m) => m.textContent.replace(/มายด์|ต้นข้าว|ภูมิ/g, '').replace(/[มตภ]/g, '')   /* the face initials */);
        assert.doesNotMatch(tx, /[฀-๿]/, 'the room is English (names aside): ' + tx.slice(0, 200));
      }
      assert.ok(await X.$eval('#r13o-resign', (b) => b.getBoundingClientRect().bottom <= document.querySelector('#r13Modal .modal-content').getBoundingClientRect().bottom + 1), 'the last button sits inside the popup');
    }
    if (G.subs[t].chip === 'w') { await X.click('#r13-st-g'); rainbow = true; } else await X.click('#r13o-put');
    await until(X, (n) => { const r = R13Online._st().room; return r.status !== 'playing' || r.g.log.length > n; }, G.log.length);
  }
  assert.ok(rainbow, 'a 🌈 was placed by tapping a carrier');
  for (const X of [A, B, C]) await until(X, () => !!document.getElementById('r13o-final'));
  const finals = await Promise.all([A, B, C].map((X) => text(X, '#r13o-final')));
  const own = ['มายด์', 'ต้นข้าว', 'ภูมิ'], norm = finals.map((f, i) => f.replace('🏆 You win', '🏆 ' + own[i]));
  assert.equal(new Set(norm).size, 1, 'the same winner on every phone: ' + finals);
  const logs = await Promise.all([A, B, C].map((X) => X.evaluate(() => window.__logs.filter((x) => x.g === 'rock13'))));
  logs.forEach((l) => assert.equal(l[0].mode, 'live')); assert.equal(logs.filter((l) => l[0].win === 'w').length, 1);

  // a late turn is played on by a waiting phone; 🏳 the leaver's face becomes 🤖
  await A.evaluate(() => R13Online.leave()); await until(A, () => !!document.getElementById('r13o-new')); await A.click('#r13o-new');
  await until(A, () => !!document.getElementById('r13o-roomcode'));
  const code2 = (await text(A, '#r13o-roomcode')).replace(/\D/g, '');
  await B.evaluate(() => R13Online.leave()); await until(B, () => !!document.getElementById('r13o-code')); await B.fill('#r13o-code', code2); await B.click('#r13o-join');
  await until(A, () => /Start · 3$/.test((document.getElementById('r13o-start') || {}).textContent || '')); await A.click('#r13o-start');
  const [rk2] = roomOf(code2); await until(B, () => !!document.getElementById('r13o-row'));
  assert.equal(await B.$$eval('#r13o-row .r13o-f', (e) => e.length), 3, 'two friends + 🤖');
  await A.click('.r13-card[data-card="3"]'); await A.click('.r13-chip[data-chip="r"]'); await A.click('#r13o-send');
  await until(A, () => !!document.getElementById('r13o-sent'));
  store.set(rk2, Object.assign(store.get(rk2), { turnDeadline: Date.now() - 1000, updatedAt: Date.now() }));
  await new Promise((res) => setTimeout(res, 4000));
  assert.notEqual(store.get(rk2).wait, 'submit:1', 'B ran out of time: their pick was drawn and the game went on');
  const leaver = B; leaver.once('dialog', (d) => d.accept()); await leaver.click('#r13o-resign');
  await until(A, () => { const r = R13Online._st().room; return r && (r.status === 'done' || r.g.players[1].bot); });
  if (store.get(rk2).status === 'playing') assert.match(await A.$eval('#r13o-row [data-seat="1"]', (e) => e.textContent), /🤖/, 'the leaver\'s seat is a 🤖');
  // 320 px
  await C.setViewportSize({ width: 320, height: 640 }); await C.evaluate(() => R13Online.leave());
  assert.ok(await C.$eval('#r13Modal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits the lobby');
  await A.setViewportSize({ width: 320, height: 640 });
  if (store.get(rk2).status === 'playing') assert.ok(await A.$eval('#r13Modal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), '320 px fits the room');
  for (const X of [A, B, C]) assert.deepEqual(X.errors, []);
  await browser.close();
  console.log('rock13-online-qa: OK — 🤖 │ 🌐 rail; room 7 rounds ⚡ 60 s, 🤖 fill shown, 📤 ?r13=<code>, join by code, only the host starts; secret pick: rings on everyone picking (no … / ✓), 🔒 You sent only on my phone; placing: ▸ Place → n in the button, one ring on the placer, 👉 Your turn pulses, Name\'s turn + 👋 Nudge (?r13=1), faces chip+card · 🪨; English; 🌈 taps a carrier; same winner on 3 phones, logged live; late pick drawn by a waiting phone; 🏳 seat → 🤖; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
