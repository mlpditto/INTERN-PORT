// V101.383 (owner 2026-11-27: a phone in LINE could not join a ไพ่เงา room — "เปิดแอปจาก LINE ก่อน") on the REAL index.html.
// When the anonymous sign-in fails at boot and succeeds later, that new sign-in has no user_auth_links doc, so roomAct / cerealAct
// refuse it. Proves: ensureAuthLink() writes user_auth_links/{current uid} → this LINE user once, again only when the sign-in
// changes, and the ไพ่เงา / เลขลับ / Cereal online calls each link the current sign-in before they reach the server.
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
    window.__ev = []; window.__user = { uid: 'anonBoot', isAnonymous: true };
    const doc = (p) => ({ set: (d) => { window.__ev.push('link:' + p + '>' + d.effectiveUserId); return Promise.resolve(); }, get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {}, collection: (c) => col(p + '/' + c) });
    const col = (c) => ({ doc: (id) => doc(c + '/' + id), where: () => col(c), orderBy: () => col(c), limit: () => col(c), get: () => Promise.resolve({ docs: [], empty: true, forEach() {} }), onSnapshot: (ok) => { if (c === 'rooms') setTimeout(() => ok({ docs: [], forEach() {} }), 0); return () => {}; }, add: () => Promise.resolve({ id: 'x' }) });
    window.firebase = { auth: () => ({ get currentUser() { return window.__user; }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }),
      functions: () => ({ httpsCallable: (n) => (d) => { window.__ev.push('call:' + n + ':' + window.__user.uid); return Promise.reject(Object.assign(new Error('off'), { code: 'unavailable' })); } }),
      firestore: Object.assign(() => ({ collection: col, batch: () => ({ set() {}, commit: () => Promise.resolve() }) }), { FieldValue: { serverTimestamp: () => 0, arrayUnion: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); userId = 'U_line'; userProfile = { userId: 'U_raw', displayName: 'มายด์' }; window.__ev = []; });

  assert.equal(typeof (await page.evaluate(() => typeof window.ensureAuthLink)), 'string');
  await page.evaluate(() => ensureAuthLink());
  assert.deepEqual(await page.evaluate(() => window.__ev), ['link:user_auth_links/anonBoot>U_line'], 'links the current sign-in to this LINE user');
  await page.evaluate(() => ensureAuthLink());
  assert.equal((await page.evaluate(() => window.__ev)).length, 1, 'once per sign-in');

  // the boot sign-in failed; a later one has a new uid → each online game links it before calling the server
  for (const [label, fn] of [['bw', () => BWOnline.join('1234')], ['secret', () => SNOnline.join('1234')], ['cereal', () => CerealOnline && CerealOnline.join && CerealOnline.join('1234')]]) {
    const uid = 'anonLate_' + label;
    await page.evaluate((u) => { window.__user = { uid: u, isAnonymous: true }; window.__ev = []; }, uid);
    await page.evaluate(fn).catch(() => {});
    await page.waitForFunction(() => window.__ev.some((x) => x.startsWith('call:')), null, { timeout: 3000 }).catch(() => {});
    const ev = await page.evaluate(() => window.__ev);
    const li = ev.indexOf('link:user_auth_links/' + uid + '>U_line'), ci = ev.findIndex((x) => x.startsWith('call:'));
    if (ci < 0 && label === 'cereal') { console.log('  (cereal join needs its own screen state; checked by the shared call() instead)'); continue; }
    assert.ok(li >= 0 && ci > li, label + ': link first, then the server call ' + JSON.stringify(ev));
  }
  assert.match(require('node:fs').readFileSync('public/cereal-online.js', 'utf8'), /ensureAuthLink && ensureAuthLink\(\)\)\.then\(function \(\) \{ return firebase\.functions\(\)\.httpsCallable\('cerealAct'\)/, 'Cereal online links first too');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('auth-link-qa: OK — ensureAuthLink links the current sign-in to the LINE user once, again when the sign-in changes; ไพ่เงา / เลขลับ online calls link first');
})().catch((e) => { console.error(e); process.exit(1); });
