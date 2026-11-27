// V101.384 🧪 functions/tester-claim.js on a small in-memory Firestore: peek shows the group; a claim makes a minimal tester
// account (isTester + isIgnored, group Tester, ends with the code) and counts it on the code; refusals: bad / missing / paused /
// expired / full code, an existing account, a sign-in with no LINE link, no login. Device fields are cut to what we keep.
const assert = require('node:assert/strict');
const path = require('node:path');
const T = require(path.resolve('functions/tester-claim.js'));

class HttpsError extends Error { constructor(code, msg, details) { super(msg); this.code = code; this.details = details; } }
function fakeDb(store) {
  const doc = (p) => ({ path: p, get: async () => ({ exists: store.has(p), data: () => JSON.parse(JSON.stringify(store.get(p))) }) });
  return {
    collection: (c) => ({ doc: (id) => doc(c + '/' + id) }),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = { get: (r) => r.get(), set: (r, v) => writes.push(() => store.set(r.path, v)), update: (r, v) => writes.push(() => store.set(r.path, Object.assign({}, store.get(r.path), v))) };
      const out = await fn(tx); writes.forEach((w) => w()); return out;
    }
  };
}
const NOW = Date.UTC(2026, 10, 27, 3), DAY = 864e5;
const deps = (store) => ({ db: fakeDb(store), HttpsError, now: NOW, FieldValue: { serverTimestamp: () => 'TS' } });
const req = (uid, data) => ({ auth: uid ? { uid } : null, data });
const code = async (p, c) => { try { await p; } catch (e) { return (e.details && e.details.code) || e.code; } return 'ok'; };

(async () => {
  const store = new Map([
    ['tester_codes/TEST-4821', { label: 'Game test', max: 2, used: 0, untilMs: NOW + 7 * DAY, paused: false, testers: [] }],
    ['tester_codes/TEST-0001', { label: 'old', max: 5, used: 0, untilMs: NOW - 1, paused: false }],
    ['tester_codes/TEST-0002', { label: 'paused', max: 5, used: 0, untilMs: NOW + DAY, paused: true }],
    ['user_auth_links/a1', { effectiveUserId: 'U1', displayName: 'Mind', pictureUrl: 'https://x/p.jpg' }],
    ['user_auth_links/a2', { effectiveUserId: 'U2', displayName: 'Tonkhao' }],
    ['user_auth_links/a3', { effectiveUserId: 'U3', displayName: 'Joey' }],
    ['user_auth_links/a9', { effectiveUserId: 'U9' }], ['users/U9', { displayName: 'Intern', group: 'Junior' }]
  ]);
  const D = deps(store);
  assert.deepEqual(await T.handle(req('a1', { code: ' test-4821 ', peek: true }), D), { label: 'Game test', untilMs: NOW + 7 * DAY, left: 2 }, 'peek: lower case and spaces are fine');
  assert.equal(store.has('users/U1'), false, 'peek writes nothing');

  const r = await T.handle(req('a1', { code: 'TEST-4821', device: { os: 'android', osVer: '14', model: 'vivo V29', modelCode: 'V2250', line: '14.19.1', screen: '393x873', read: true, extra: 'x', email: 'no' } }), D);
  assert.equal(r.ok, true);
  const u = store.get('users/U1');
  assert.deepEqual({ g: u.group, t: u.isTester, i: u.isIgnored, c: u.testerCode, until: u.testerUntil, s: u.score, name: u.displayName, end: u.endDate },
    { g: 'Tester', t: true, i: true, c: 'TEST-4821', until: NOW + 7 * DAY, s: 0, name: 'Mind', end: '2026-12-04' });
  assert.deepEqual(Object.keys(u.device).sort(), ['line', 'model', 'modelCode', 'os', 'osVer', 'read', 'screen'], 'only the device fields we keep');
  assert.equal(store.get('tester_codes/TEST-4821').used, 1); assert.equal(store.get('tester_codes/TEST-4821').testers[0].name, 'Mind');

  assert.equal(await code(T.handle(req('a1', { code: 'TEST-4821', device: {} }), D)), 'has-account', 'a second claim by the same person');
  assert.equal(await code(T.handle(req('a9', { code: 'TEST-4821', device: {} }), D)), 'has-account', 'an intern keeps their account');
  assert.equal(await code(T.handle(req('a2', { code: 'TEST-4821', device: { os: 'windows-phone' } }), D)), 'ok');
  assert.equal(store.get('users/U2').device.os, 'other', 'unknown OS → other');
  assert.equal(await code(T.handle(req('a3', { code: 'TEST-4821', device: {} }), D)), 'full', 'max 2');
  assert.equal(await code(T.handle(req('a3', { code: 'TEST-0001', device: {} }), D)), 'expired');
  assert.equal(await code(T.handle(req('a3', { code: 'TEST-0002', peek: true }), D)), 'paused');
  assert.equal(await code(T.handle(req('a3', { code: 'TEST-9999', peek: true }), D)), 'no-code');
  assert.equal(await code(T.handle(req('a3', { code: 'K7Q2PX', peek: true }), D)), 'no-code', 'an intern code is not a tester code');
  assert.equal(await code(T.handle(req('zz', { code: 'TEST-4821', device: {} }), D)), 'permission-denied', 'no LINE link');
  assert.equal(await code(T.handle(req(null, { code: 'TEST-4821', peek: true }), D)), 'unauthenticated');
  assert.equal(T.cleanDevice({ model: '<b>' + 'x'.repeat(80) }).model.length, 40, 'cut and cleaned');
  console.log('tester-claim-check: OK — peek; claim = minimal tester account (isTester + isIgnored, group Tester, ends with the code), counted on the code; refusals: has-account, full, expired, paused, unknown, intern code, no LINE link, no login; device fields cut');
})().catch((e) => { console.error(e); process.exit(1); });
