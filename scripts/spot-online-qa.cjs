// V101.401 🪞 Memory Fracture with friends on the REAL index.html — three phones (three logins) playing through the REAL referee
// (functions/room-act.js → room-spot.js runs here in node on a small in-memory Firestore; the pages reach it through exposeFunction
// and their listeners poll it). Proves: the 🤖 Practice │ 🌐 Friends rail, the 🥄 row = the host's pick; the host opens a room
// (code, 📤 hands over ?spot=<code>), two friends join by the code, only the host starts; everyone walks the same rail on the
// room's clock: 👀 the same shelf on every phone, a green ✓ on each face that is Ready, all Ready moves on; 🎲 my bet shows only
// on my phone, the others see ✓; 🔍 the changed shelf, taps toggle and stop at the cap, "🔒 Sent" after ✓ Done; 📊 the same ranking
// on every phone (✅ ❌ × bet = points, 💎 ±), my own marks on the shelf, only the host has ▸ Round 2; the clock alone moves a
// room on, and when the 🔍 time ends my taps go by themselves; played to the end the same winner shows on every phone and each
// logs spot mode 'live'; 🏳 a leaver's face greys out and the last one wins; ?spot=<code> joins; 360 × 640 with the biggest shelf
// fits without scrolling; 320 px nothing sideways.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const R = require(path.resolve('functions/room-act.js'));

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
for (const [a, u, n] of [['authA', 'UA', 'Mint'], ['authB', 'UB', 'Poom'], ['authC', 'UC', 'Fern']]) { store.set('user_auth_links/' + a, { effectiveUserId: u }); store.set('users/' + u, { nickName: n }); }
let seed = 11; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function phone(browser, auth) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.errors = errors;
  page.on('dialog', (d) => d.accept());
  await page.exposeFunction('__roomAct', async (data) => { try { return { ok: await R.handle({ auth: { uid: auth }, data }, { db, HttpsError, now: Date.now(), rand }) }; } catch (e) { return { err: { code: e.code, details: e.details, message: e.message } }; } });
  await page.exposeFunction('__doc', (p) => (store.has(p) ? clone(store.get(p)) : null));
  await page.exposeFunction('__list', (col, uid) => [...store.keys()].filter((k) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/') && (store.get(k).authUids || []).includes(uid)).map((k) => Object.assign({ __id: k.split('/').pop() }, clone(store.get(k)))));
  await page.addInitScript((auth) => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'countTourSeen', 'bwTourSeen', 'snTourSeen', 'r13TourSeen', 'spotTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    localStorage.setItem('spotLevel', '1'); localStorage.setItem('spotSound', 'off');
    window.__clip = null; window.__logs = [];
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true });
    const poll = (get, cb) => { let last = '@'; const f = async () => { const v = await get(); const j = JSON.stringify(v); if (j !== last) { last = j; cb(v); } }; f(); const t = setInterval(f, 100); return () => clearInterval(t); };
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
const until = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 8000 });
const shot = (X, n) => (process.env.SPOT_SHOTS ? X.locator('#spModal .modal-content').screenshot({ path: path.join(process.env.SPOT_SHOTS, n + '.png') }) : null);   // optional proof pictures
const fmt = (n) => String(Math.round(n * 10) / 10);

(async () => {
  const browser = await chromium.launch();
  const A = await phone(browser, 'authA'), B = await phone(browser, 'authB'), C = await phone(browser, 'authC');
  const all = [A, B, C], NAME = { authA: 'Mint', authB: 'Poom', authC: 'Fern' }, PG = { authA: A, authB: B, authC: C };
  const roomOf = (code) => [...store.entries()].find(([k, v]) => /^rooms\/[^/]+$/.test(k) && v.code === code && v.game === 'spot');
  const phase = (X, ph, round) => until(X, ([ph, round]) => { const s = window.SPOnline && SPOnline._st().room; return !!s && !!s.g && s.g.phase === ph && (!round || s.g.round === round) && !SPOnline._st().busy; }, [ph, round]);
  const late = (rk) => { store.set(rk, Object.assign(clone(store.get(rk)), { turnDeadline: Date.now() - 100 })); };

  // the mode rail; the 🥄 row is the host's pick
  await A.evaluate(() => { spotOpen(); });
  assert.deepEqual(await A.$$eval('#spModal [aria-label="Mode"] button', (b) => b.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['🤖 Practice*', '🌐 Friends']);
  assert.ok(await A.$('#sp-start'), 'practice is still there');
  await A.click('#sp-mode-1'); await until(A, () => !!document.getElementById('spo-new'));
  assert.equal(await A.$('#sp-start'), null); assert.equal(await text(A, '#spo-new'), '＋ New room · ⚡ live');
  assert.deepEqual(await A.$$eval('#spModal [aria-label="Level"] button', (b) => b.map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['🥄*', '🥄🥄', '🥄🥄🥄'], 'the level row, short');
  await shot(A, 'r1-friends-tab');
  await A.click('#spo-new'); await until(A, () => !!document.getElementById('spo-roomcode'));
  const code = (await text(A, '#spo-roomcode')).replace(/\D/g, ''); assert.match(code, /^\d{4}$/);
  assert.ok(await A.$eval('#spo-start', (b) => b.disabled), 'alone: Start waits'); assert.equal(await text(A, '#spo-start'), '▸ Start · needs 2');
  assert.equal(await text(A, '#spo-key'), '🥄 · 3 rounds · 💎 3 each · 2–7 players');
  await A.evaluate(() => { window.__clip = null; }); await A.click('#spo-invite');
  await until(A, () => /\?spot=\d{4}/.test(window.__clip || '')); assert.match(await A.evaluate(() => window.__clip), new RegExp('Mint invites you to Memory Fracture · code ' + code));
  await B.evaluate(() => { spotOpen(); SP.online(1); }); await until(B, () => !!document.getElementById('spo-code')); await B.fill('#spo-code', code); await B.click('#spo-join'); await until(B, () => !!document.getElementById('spo-seats'));
  await C.evaluate((c) => { spotOpen(); SP.tourEnd(); SP.online(1); SPOnline.deepLink(c); }, code); await until(C, () => !!document.getElementById('spo-seats'));   // what ?spot=<code> runs
  assert.equal(await B.$('#spo-start'), null, 'only the host starts'); assert.equal(await text(B, '.sp-note'), '⏳ Waiting for the host');
  await until(A, () => /Start · 3$/.test((document.getElementById('spo-start') || {}).textContent || ''));
  await shot(A, 'r2-room-waiting');
  await A.click('#spo-start');
  for (const X of all) await phase(X, 'look', 1);
  const [rk] = roomOf(code), order = store.get(rk).order, sec = () => store.get(rk + '/secret/scene'), G = () => store.get(rk).g;
  const seat = (X) => order.indexOf(Object.keys(PG).find((k) => PG[k] === X));

  // 👀 the same shelf everywhere, the rail on step 1 with the seconds, a ✓ on each face that is Ready
  const shelf = await A.$eval('#spModal .sp-pic svg', (s) => s.outerHTML);
  for (const X of all) {
    const v = await X.evaluate(() => ({ round: document.getElementById('spo-round').textContent, gem: document.getElementById('spo-gem').textContent, rail: [...document.querySelectorAll('#sp-rail span')].map((s) => (s.classList.contains('on') ? '*' : '') + s.textContent.replace(/\s*\d+/, '')), left: +document.getElementById('sp-left').textContent, faces: document.querySelectorAll('#spo-row .spo-f').length, ok: document.querySelectorAll('#spo-row .spo-f.ok').length, gone: !!document.querySelector('.sp-gone'), ready: document.getElementById('spo-ready').textContent }));
    assert.deepEqual({ round: v.round, gem: v.gem, rail: v.rail, faces: v.faces, ok: v.ok, gone: v.gone, ready: v.ready }, { round: '🪞 Round 1/3', gem: '💎 3', rail: ['*👀', '🎲', '🔍', '📊'], faces: 3, ok: 0, gone: false, ready: '✓ Ready · 0/3' });
    assert.ok(v.left > 50 && v.left <= 60, '👀 60 s on the rail: ' + v.left);
    assert.equal(await X.$eval('#spModal .sp-pic svg', (s) => s.outerHTML), shelf, 'the same shelf on every phone');
  }
  assert.deepEqual(await A.$$eval('#spo-row .spo-f .nm', (e) => e.map((x) => x.textContent)), ['You', 'Poom', 'Fern'], 'English, names as they are');
  await A.click('#spo-ready');
  for (const X of all) await until(X, () => document.querySelectorAll('#spo-row .spo-f.ok').length === 1);
  assert.equal(await text(A, '#spo-ready'), '✓ Ready · 1/3'); assert.ok(await A.$eval('#spo-ready', (b) => b.disabled)); assert.ok(await B.$eval('#spo-row [data-seat="0"]', (f) => f.classList.contains('ok')), 'Mint ✓ on Poom\'s phone');
  await shot(B, 'r3-look');
  await B.click('#spo-ready'); await C.click('#spo-ready');
  for (const X of all) await phase(X, 'bet', 1);

  // 🎲 my bet only on my phone
  assert.ok(await A.$('.sp-gone'), 'the shelf is gone');
  await A.click('#spo-bet-2');
  await until(A, () => /×2 is in/.test((document.getElementById('spo-betnote') || {}).textContent || ''));
  assert.ok(await A.$eval('#spo-bet-2', (b) => b.classList.contains('on') && b.disabled));
  await until(B, () => document.querySelectorAll('#spo-row .spo-f.ok').length === 1);
  assert.ok(!(await text(B, '#spModal .modal-content')).includes('×2 is in'), 'Poom does not see Mint\'s bet'); assert.equal(await text(B, '#spo-betnote'), '🔒 Your bet is hidden until 📊');
  await shot(B, 'r4-bet');
  await B.click('#spo-bet-15'); await C.click('#spo-bet-1');
  for (const X of all) await phase(X, 'find', 1);

  // 🔍 the changed shelf; taps toggle and stop at the cap; 🔒 Sent
  const n = sec().diffs.length, hitAll = sec().diffs.map((d) => d.cells[0]), allCells = new Set(sec().diffs.flatMap((d) => d.cells)), wrong = [];
  for (let k = 0; k < G().cols * G().rows && wrong.length < 3; k++) if (!allCells.has(k)) wrong.push(k);
  assert.equal(await A.$$eval('#spo-taps i', (d) => d.length), n + 2, 'taps: the changes + 2');
  await A.click('#spo-find .sp-cell[data-k="' + hitAll[0] + '"]'); assert.equal(await A.$$eval('#spo-taps i.u', (d) => d.length), 1);
  await A.click('#spo-find .sp-cell[data-k="' + hitAll[0] + '"]'); assert.equal(await A.$$eval('#spo-taps i.u', (d) => d.length), 0, 'a second tap takes it back');
  for (const k of hitAll) await A.evaluate((k) => SPOnline.tap(k), k);
  await shot(A, 'r5-find');
  await A.click('#spo-done'); await until(A, () => !!document.getElementById('spo-sent'));
  assert.equal(await text(A, '#spo-sent'), '🔒 Sent · waiting for 2'); assert.equal(await A.$('#spo-done'), null);
  for (const k of [hitAll[0]].concat(wrong)) await B.evaluate((k) => SPOnline.tap(k), k);
  await B.click('#spo-done'); await C.click('#spo-done');
  for (const X of all) await phase(X, 'show', 1);

  // 📊 the same ranking on every phone; my marks; only the host goes on
  const res = G().res, rankSeats = [0, 1, 2].sort((a, b) => res[b].pts - res[a].pts || a - b);
  assert.deepEqual(res.map((x) => [x.bet, x.n, x.wrong.length, x.pts, x.gem]), [[2, n, 0, n * 2, 0], [1.5, 1, 3, 0, -1], [1, 0, 0, 0, 0]], 'the referee\'s round: Mint ×2 all found (−2 +2), Poom ×1.5 1 − 3 (−1), Fern nothing');
  for (const X of all) {
    const rows = await X.$$eval('#spo-rank > div', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(rows, rankSeats.map((s) => { const x = res[s], who = seat(X) === s ? 'You' : NAME[order[s]]; return (['🥇', '🥈', '🥉'][x.rank - 1] || x.rank) + NAME[order[s]].slice(0, 1) + who + '✅' + x.n + (x.wrong.length ? ' ❌' + x.wrong.length : '') + ' ×' + x.bet + fmt(x.pts) + (x.gem ? '💎' + (x.gem > 0 ? '+' : '−') + Math.abs(x.gem) : ''); }), 'the ranking rows');
    assert.equal(await X.$$eval('#spo-list > div', (d) => d.length), n, 'every change is named');
    assert.equal(await text(X, '#spo-gem'), '💎 ' + G().gem[seat(X)]);
  }
  assert.equal(await A.$$eval('#spo-list > div.ok', (d) => d.length), n); assert.equal(await B.$$eval('#spo-list > div.ok', (d) => d.length), 1, 'my own ✅ on my phone');
  assert.equal(await text(A, '#spo-next'), '▸ Round 2'); assert.equal(await B.$('#spo-next'), null); assert.equal(await text(B, '#spo-wait'), '⏳ Round 2 comes next');
  await shot(B, 'r6-show');
  await A.click('#spo-next');
  for (const X of all) await phase(X, 'look', 2);
  assert.equal(await text(B, '#spo-round'), '🪞 Round 2/3');

  // the clock alone: 👀 → 🎲 → 🔍 (missing bets = ×1); when the 🔍 time ends my taps go by themselves; 📊 → round 3
  late(rk); for (const X of all) await phase(X, 'bet', 2);
  late(rk); for (const X of all) await phase(X, 'find', 2);
  const two = sec().diffs.slice(0, 2).map((d) => d.cells[0]);
  for (const k of two) await A.evaluate((k) => SPOnline.tap(k), k);
  late(rk); for (const X of all) await phase(X, 'show', 2);
  assert.deepEqual(store.get(rk + '/hand/authA').taps, two, 'Mint\'s two taps went by themselves'); assert.deepEqual(G().res.map((x) => [x.bet, x.n]), [[1, 2], [1, 0], [1, 0]]);
  late(rk); for (const X of all) await phase(X, 'look', 3);

  // round 3 to the end: the same winner everywhere, each logs spot 'live'
  for (const X of all) await X.click('#spo-ready');
  for (const X of all) await phase(X, 'bet', 3);
  for (const X of all) await X.click('#spo-bet-1');
  for (const X of all) await phase(X, 'find', 3);
  await C.evaluate((k) => SPOnline.tap(k), sec().diffs[0].cells[0]);
  for (const X of all) await X.click('#spo-done');
  for (const X of all) await phase(X, 'show', 3);
  assert.equal(await text(A, '#spo-next'), '▸ Result');
  await A.click('#spo-next');
  for (const X of all) await until(X, () => !!document.getElementById('spo-final'));
  const done = store.get(rk), win = done.result.rank[0];
  assert.deepEqual([done.status, done.result.reason], ['done', 'score']);
  for (const X of all) {
    const me = order[seat(X)];
    assert.equal(await text(X, '#spo-final'), me === win ? '🏆 You win' : '🏆 ' + NAME[win]);
    assert.deepEqual(await X.$$eval('#spo-end > div', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim())), done.result.rank.map((u, i) => { const s = order.indexOf(u), who = u === me ? 'You' : NAME[u]; return ['🥇', '🥈', '🥉'][i] + NAME[u].slice(0, 1) + who + '⭐ ' + fmt(done.g.pts[s]) + '💎 ' + done.g.gem[s]; }), 'the final ranking: 💎, then points');
    assert.deepEqual(await X.evaluate(() => window.__logs), [{ g: 'spot', mode: 'live', win: me === win ? 'w' : 'l', score: fmt(done.g.pts[seat(X)]) }]);
  }
  await shot(A, 'r7-end');

  // 🏳 leaving; the biggest shelf on a short phone; 320 px
  for (const X of all) await X.evaluate(() => SPOnline.leave());
  await A.evaluate(() => SP.level(3)); await A.click('#spo-new'); await until(A, () => !!document.getElementById('spo-roomcode'));
  const code2 = (await text(A, '#spo-roomcode')).replace(/\D/g, '');
  assert.equal(await text(A, '#spo-key'), '🥄🥄🥄 · 3 rounds · 💎 3 each · 2–7 players');
  for (const X of [B, C]) { await until(X, () => !!document.getElementById('spo-code')); await X.fill('#spo-code', code2); await X.click('#spo-join'); await until(X, () => !!document.getElementById('spo-seats')); }
  await until(A, () => /Start · 3$/.test((document.getElementById('spo-start') || {}).textContent || '')); await A.click('#spo-start');
  for (const X of all) await phase(X, 'look', 1);
  const fit = (X) => X.$eval('#spModal .modal-content', (c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && c.scrollHeight <= c.clientHeight + 1 && document.documentElement.scrollWidth <= innerWidth; });
  await A.setViewportSize({ width: 360, height: 640 }); assert.ok(await fit(A), '360 × 640 🥄🥄🥄: 👀 with the faces row fits, no scrolling');
  for (const X of all) await X.click('#spo-ready');
  for (const X of all) await phase(X, 'bet', 1);
  assert.ok(await fit(A), '360 × 640 🥄🥄🥄: 🎲 fits, no scrolling');
  for (const X of all) await X.click('#spo-bet-1');
  for (const X of all) await phase(X, 'find', 1);
  assert.ok(await fit(A), '360 × 640 🥄🥄🥄: 🔍 fits, no scrolling');
  await A.setViewportSize({ width: 320, height: 640 }); assert.ok(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#spModal .modal-content').scrollWidth <= document.querySelector('#spModal .modal-content').clientWidth + 1), '320 px: nothing sideways');
  await A.setViewportSize({ width: 390, height: 844 });
  await C.click('#spo-resign');
  await until(A, () => !!document.querySelector('#spo-row [data-seat="2"].out'));
  assert.equal(await text(A, '#spo-row [data-seat="2"] small'), '🏳'); assert.equal(await C.$('#spo-done'), null, 'the leaver has nothing to send');
  await B.click('#spo-resign');
  await until(A, () => !!document.getElementById('spo-final')); assert.equal(await text(A, '#spo-final'), '🏆 You win');
  for (const X of all) assert.deepEqual(X.errors, []);
  await browser.close();
  console.log('spot-online-qa: OK — 🤖 │ 🌐 rail, the 🥄 row is the host\'s pick; room code, 📤 ?spot=, join by code + deep link, host starts; 👀 same shelf, ✓ faces, all Ready moves on; 🎲 my bet only on my phone; 🔍 taps toggle / cap, 🔒 Sent; 📊 same ranking everywhere, my marks, host ▸; the clock alone moves the room on, late taps go by themselves; 3 rounds → same winner, logged live; 🏳 face out, last one wins; 360 × 640 🥄🥄🥄: 👀 🎲 🔍 fit; 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
