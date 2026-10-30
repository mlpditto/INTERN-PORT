// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): the `intern_messages` rule (V101.247 ✉️ the intern's own copy
// of a Journal "Message to admin").
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-intern-messages.emu.cjs
// An intern creates a bounded copy as themselves (six fields, status 'sent', createdAt = request time); they read only their own; only admins
// read all, reply (update), backfill a copy (create) or delete. Plain REST: real emulator accounts with an `admin` claim.
const assert = require('assert');
const P = 'projects/intern-port-edfa7/databases/(default)/documents', FS = 'http://127.0.0.1:8085/v1/' + P, AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const COL = 'intern_messages';
const j = async (url, opt) => { const r = await fetch(url, opt); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t; } return { status: r.status, body: b }; };
const post = (url, body, auth) => j(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + auth } : {}), body: JSON.stringify(body) });

async function mkUser(name, admin) {
    const s = await post(AUTH + '/accounts:signUp?key=fake', { email: name + '@test.local', password: 'pw123456', returnSecureToken: true });
    await post(AUTH + '/accounts:update?key=fake', { localId: s.body.localId, customAttributes: JSON.stringify({ admin: !!admin }) }, 'owner');
    const t = await post(AUTH + '/accounts:signInWithPassword?key=fake', { email: name + '@test.local', password: 'pw123456', returnSecureToken: true });
    return { uid: s.body.localId, token: t.body.idToken };
}
const val = v => typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'string' ? { stringValue: v } : { timestampValue: new Date().toISOString() };
const fields = o => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'createdAt').map(([k, v]) => [k, val(v)]));
// create through the rules, with createdAt = the server's request time (what FieldValue.serverTimestamp() sends)
const create = (u, id, data, stamp) => post(`${FS}:commit`, { writes: [Object.assign({ update: { name: `${P}/${COL}/${id}`, fields: fields(data) }, currentDocument: { exists: false } },
    stamp === false ? {} : { updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] })] }, u.token);
const get = (u, id) => j(`${FS}/${COL}/${id}`, { headers: { Authorization: 'Bearer ' + u.token } });
const patch = (u, id, data) => j(`${FS}/${COL}/${id}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
// an admin's set({..}, {merge:true}) on a copy that does not exist yet = a create with the reply fields already in it
const backfill = (u, id, data) => j(`${FS}/${COL}/${id}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
const del = (u, id) => j(`${FS}/${COL}/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + u.token } });
const ok = r => r.status === 200, denied = r => r.status === 403;

(async () => {
    const stamp = Date.now(), a = await mkUser('a' + stamp), b = await mkUser('b' + stamp), adm = await mkUser('adm' + stamp, true);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
    const m = over => Object.assign({ authUid: a.uid, userId: a.uid, message: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ', attached: true, status: 'sent', createdAt: 1 }, over || {});
    let n = 0; const id = () => 'm' + stamp + '_' + (n++);

    // 1. the intern sends — with and without the entry attached, exactly 4000 characters
    const mine = id();
    t('an intern keeps a copy of their message', ok, await create(a, mine, m()));
    t('without the entry attached', ok, await create(a, id(), m({ attached: false })));
    t('4000 characters', ok, await create(a, id(), m({ message: 'ก'.repeat(4000) })));
    // 2. bounded, owned, honest
    t('as someone else (authUid)', denied, await create(a, id(), m({ authUid: b.uid })));
    t('for another userId', denied, await create(a, id(), m({ userId: b.uid })));
    t('4001 characters', denied, await create(a, id(), m({ message: 'x'.repeat(4001) })));
    t('only spaces', denied, await create(a, id(), m({ message: '   ' })));
    t('attached is not a bool', denied, await create(a, id(), m({ attached: 'yes' })));
    t('created already answered', denied, await create(a, id(), m({ status: 'answered' })));
    t('created pending (it must never enter a queue)', denied, await create(a, id(), m({ status: 'pending' })));
    t('an extra field (a reply to oneself)', denied, await create(a, id(), m({ reply: 'self-answered' })));
    t('a missing field (attached)', denied, await create(a, id(), (o => { delete o.attached; return o; })(m())));
    t('a made-up time instead of the server time', denied, await create(a, id(), Object.assign(m(), { createdAt: undefined }), false));
    // 3. reading: own only; admins read all
    t('the sender reads their own', ok, await get(a, mine));
    t('another intern cannot read it', denied, await get(b, mine));
    t('an admin reads it', ok, await get(adm, mine));
    // 4. only admins reply, backfill or remove
    t('the sender cannot edit it', denied, await patch(a, mine, { message: 'edited' }));
    t('the sender cannot answer themselves', denied, await patch(a, mine, { status: 'answered', reply: 'done' }));
    t('an admin replies', ok, await patch(adm, mine, { status: 'answered', reply: 'เพิ่มให้แล้ว', repliedBy: 'admin' }));
    const old = id();
    t('an admin backfills a copy for a message sent before V101.247', ok, await backfill(adm, old, { authUid: a.uid, userId: a.uid, message: 'old one', attached: false, status: 'answered', reply: 'late reply', repliedBy: 'admin' }));
    t('an intern cannot backfill one', denied, await backfill(b, id(), { authUid: b.uid, userId: b.uid, message: 'x', attached: false, status: 'answered', reply: 'me' }));
    t('the sender reads the backfilled one', ok, await get(a, old));
    t('the sender cannot delete it', denied, await del(a, mine));
    t('an admin deletes it', ok, await del(adm, mine));
    console.log('PASS: intern_messages rules — own bounded create (six fields, ≤ 4000, bool attached, sent, server time), own read, admin read / reply / backfill / delete only');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
