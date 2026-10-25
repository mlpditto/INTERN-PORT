// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): the `reflective_logs` claim rule — an intern collects the mentor's bonus on their OWN entry, nothing else.
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-reflective-claim.emu.cjs
// Plain REST: users are real emulator accounts with a custom `admin:false` claim; every write under test goes through the rules (the seed uses the emulator's "owner" bypass).
const assert = require('assert');
const FS = 'http://127.0.0.1:8085/v1/projects/intern-port-edfa7/databases/(default)/documents', AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const j = async (url, opt) => { const r = await fetch(url, opt); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t; } return { status: r.status, body: b }; };
const post = (url, body, auth) => j(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + auth } : {}), body: JSON.stringify(body) });

async function mkUser(name, admin) {
    const s = await post(AUTH + '/accounts:signUp?key=fake', { email: name + '@test.local', password: 'pw123456', returnSecureToken: true });
    await post(AUTH + '/accounts:update?key=fake', { localId: s.body.localId, customAttributes: JSON.stringify({ admin: !!admin }) }, 'owner');
    const t = await post(AUTH + '/accounts:signInWithPassword?key=fake', { email: name + '@test.local', password: 'pw123456', returnSecureToken: true });
    return { uid: s.body.localId, token: t.body.idToken };
}
const val = v => typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { doubleValue: v } : typeof v === 'string' ? { stringValue: v } : { timestampValue: new Date().toISOString() };
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
const seed = (id, data) => post(`${FS}/reflective_logs?documentId=${id}`, fields(data), 'owner');
const patch = (u, id, data) => j(`${FS}/reflective_logs/${id}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify(fields(data)) });
const ok = r => r.status === 200, denied = r => r.status === 403;

(async () => {
    const stamp = Date.now(), a = await mkUser('a' + stamp), b = await mkUser('b' + stamp), adm = await mkUser('adm' + stamp, true);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    const log = (id, over) => seed(id, Object.assign({ userId: a.uid, text: 'hello', adminComment: 'nice', adminBonus: 0.2 }, over || {}));
    await log('l1' + stamp); await log('l2' + stamp); await log('l3' + stamp); await log('l4' + stamp, { pointsClaimed: true }); await log('l5' + stamp);

    // 1. the owner collects: pointsClaimed true + claimedAt + adminAcknowledged — exactly what claimReflectivePoints writes
    t('owner claims their own bonus', ok, await patch(a, 'l1' + stamp, { pointsClaimed: true, claimedAt: 'now', adminAcknowledged: false }));
    // 2. ...but only that: no other field rides along
    t('claim + change the bonus', denied, await patch(a, 'l2' + stamp, { pointsClaimed: true, adminBonus: 9 }));
    t('claim + rewrite the mentor comment', denied, await patch(a, 'l2' + stamp, { pointsClaimed: true, adminComment: 'x' }));
    t('change the bonus alone', denied, await patch(a, 'l2' + stamp, { adminBonus: 9 }));
    t('edit the entry text', denied, await patch(a, 'l2' + stamp, { text: 'edited' }));
    t('"claim" by writing false', denied, await patch(a, 'l2' + stamp, { pointsClaimed: false, claimedAt: 'now' }));
    // 3. once only: a claimed entry cannot be claimed (or touched) again
    t('claim an already-claimed entry', denied, await patch(a, 'l4' + stamp, { pointsClaimed: true, claimedAt: 'now' }));
    // 4. nobody collects someone else's bonus
    t('another intern claims it', denied, await patch(b, 'l3' + stamp, { pointsClaimed: true, claimedAt: 'now' }));
    // 5. admin unchanged
    t('admin edits any field', ok, await patch(adm, 'l5' + stamp, { adminBonus: 0.5, adminComment: 'updated' }));
    console.log('PASS: reflective_logs — the owner can collect once (pointsClaimed / claimedAt / adminAcknowledged only), nobody else can, no other field, admin unchanged.');
})().catch(e => { console.error(e); process.exit(1); });
