// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): the `users` rule "no CODE, no earning".
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-users-registered.emu.cjs
// Plain REST: users are real emulator accounts with a custom `admin:false` claim (otherwise isAdmin() errors and denies everything); every write under test goes through the rules.
const assert = require('assert');
const FS = 'http://127.0.0.1:8085/v1/projects/intern-port-edfa7/databases/(default)/documents', AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const j = async (url, opt) => { const r = await fetch(url, opt); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t; } return { status: r.status, body: b }; };

async function mkUser(name, admin) {
    const s = await j(AUTH + '/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: name + '@test.local', password: 'test1234', returnSecureToken: true }) });
    await j(AUTH + '/accounts:update?key=fake', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: s.body.localId, customAttributes: JSON.stringify({ admin: !!admin }) }) });
    const t = await j(AUTH + '/accounts:signInWithPassword?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: name + '@test.local', password: 'test1234', returnSecureToken: true }) });
    return { uid: s.body.localId, token: t.body.idToken };
}
const val = v => typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'string' ? { stringValue: v } : { timestampValue: new Date().toISOString() };
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
// create (POST ?documentId) or update (PATCH with an updateMask so it merges like set/merge does)
const create = (u, id, data) => j(`${FS}/users?documentId=${id}`, { method: 'POST', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify(fields(data)) });
const patch = (u, id, data) => j(`${FS}/users/${id}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify(fields(data)) });
const seed = (id, data) => j(`${FS}/users?documentId=${id}`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(fields(data)) });
const ok = r => r.status === 200, denied = r => r.status === 403;

(async () => {
    const stamp = Date.now(), a = await mkUser('a' + stamp), b = await mkUser('b' + stamp), adm = await mkUser('adm' + stamp, true);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));

    // 1. the hole that was found: a bare doc created WITH a score (check-in / Beri / any earn path, old cached client)
    t('create a bare doc with a score', denied, await create(a, a.uid, { displayName: 'A', score: 0.01 }));
    t('create a bare doc with beri', denied, await create(a, a.uid, { displayName: 'A', beri: 1 }));
    // 2. other self-written profile docs still work for someone not enrolled (settings, personality, socials …)
    t('create a doc with only profile fields', ok, await create(a, a.uid, { displayName: 'A', preferredLanguage: 'th' }));
    t('score on that unregistered doc', denied, await patch(a, a.uid, { score: 5 }));
    t('beri on that unregistered doc', denied, await patch(a, a.uid, { beri: 5 }));
    t('a profile field on it', ok, await patch(a, a.uid, { nickname: 'x' }));
    // 3. enrollment itself: carries enrollmentCode (+ createdAt when new) and may set score 0
    t('claim into an existing unregistered doc', ok, await patch(a, a.uid, { enrollmentCode: 'ABCD', group: 'EXTERN', score: 0 }));
    // 4. now registered: earning works
    t('score on a registered doc', ok, await patch(a, a.uid, { score: 1.5 }));
    t('beri on a registered doc', ok, await patch(a, a.uid, { beri: 3 }));
    // 5. brand-new enrolment
    t('new doc with enrollmentCode + createdAt + score 0', ok, await create(b, b.uid, { displayName: 'B', enrollmentCode: 'WXYZ', createdAt: 1, score: 0, group: 'EXTERN' }));
    // 6. nobody writes someone else's doc
    t('write another user\'s profile', denied, await patch(b, a.uid, { nickname: 'hax' }));
    t('write another user\'s score', denied, await patch(b, a.uid, { score: 999 }));
    // 7. admin unchanged: creates / edits anything, including a score on a bare doc
    t('admin creates a bare doc with a score', ok, await create(adm, 'pre' + stamp, { displayName: 'Admin made', score: 2 }));
    t('admin edits a score', ok, await patch(adm, a.uid, { score: 10 }));
    // 8. a doc that already has a score (made before this rule) keeps working for its owner — nobody is locked out
    const o = await mkUser('o' + stamp); await seed(o.uid, { displayName: 'Legacy', score: 4 });
    t('legacy doc with a score: owner earns', ok, await patch(o, o.uid, { score: 4.5 }));
    console.log('PASS: users rule — no score/beri without being registered (create + update), enrollment and admin unchanged, other fields free, nobody else\'s doc writable');
})().catch(e => { console.error(e); process.exit(1); });
