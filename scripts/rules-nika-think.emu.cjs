// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): the `nika_think_answers` rule (V101.307 💭 think questions).
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-nika-think.emu.cjs
// An intern answers a question once, as themselves (id = qid_authUid, eight fields, ≤ 1000 characters, server time); they read only their own;
// admins read all, 👍 / reply (update) and delete. app_settings/nika_think: anyone reads, only admins write.
const assert = require('assert');
const P = 'projects/intern-port-edfa7/databases/(default)/documents', FS = 'http://127.0.0.1:8085/v1/' + P, AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const COL = 'nika_think_answers';
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
const create = (u, col, id, data, stamp) => post(`${FS}:commit`, { writes: [Object.assign({ update: { name: `${P}/${col}/${id}`, fields: fields(data) }, currentDocument: { exists: false } },
    stamp === false ? {} : { updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] })] }, u.token);
// what the app's set() sends: no "must not exist" precondition, so a second answer reaches the rules as an UPDATE
const setAny = (u, col, id, data) => post(`${FS}:commit`, { writes: [{ update: { name: `${P}/${col}/${id}`, fields: fields(data) }, updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] }] }, u.token);
const get = (u, col, id) => j(`${FS}/${col}/${id}`, { headers: u ? { Authorization: 'Bearer ' + u.token } : {} });
const patch = (u, col, id, data) => j(`${FS}/${col}/${id}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
const del = (u, col, id) => j(`${FS}/${col}/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + u.token } });
const ok = r => r.status === 200, denied = r => r.status === 403;

(async () => {
    const stamp = Date.now(), a = await mkUser('a' + stamp), b = await mkUser('b' + stamp), adm = await mkUser('adm' + stamp, true);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
    const m = over => Object.assign({ authUid: a.uid, userId: a.uid, qid: 'q' + stamp, kind: 'day', question: 'CKD 4 + NSAID?', answer: 'ไม่ขาย แนะนำ paracetamol', day: '2026-11-11', createdAt: 1 }, over || {});
    const idOf = (d, u) => d.qid + '_' + (u || a).uid;
    let n = 0; const q = () => 'q' + stamp + '-' + (n++);

    // 1. the intern answers — day, article, general; 1000 characters
    const mine = idOf(m());
    t('an intern answers', ok, await create(a, COL, mine, m()));
    for (const kind of ['article', 'general']) { const d = m({ qid: q(), kind }); t('kind ' + kind, ok, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q(), answer: 'ก'.repeat(1000) }); t('1000 characters', ok, await create(a, COL, idOf(d), d)); }
    // 2. once, owned, bounded
    t('a second answer to the same question', denied, await setAny(a, COL, mine, m({ answer: 'changed my mind' })));
    t('the intern cannot edit their answer', denied, await patch(a, COL, mine, { answer: 'edited' }));
    { const d = m({ qid: q() }); t('under another id', denied, await create(a, COL, d.qid + '_other', d)); }
    { const d = m({ qid: q(), authUid: b.uid }); t('as someone else (authUid)', denied, await create(a, COL, d.qid + '_' + b.uid, d)); }
    { const d = m({ qid: q(), userId: b.uid }); t('for another userId', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q(), answer: 'x'.repeat(1001) }); t('1001 characters', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q(), answer: '   ' }); t('only spaces', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q(), kind: 'quiz' }); t('an unknown kind', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q(), day: '11/11/2026' }); t('a day that is not YYYY-MM-DD', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: 'bad_id' }); t('a question id with _', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q(), liked: true }); t('an extra field (a 👍 to oneself)', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q() }); delete d.day; t('a missing field (day)', denied, await create(a, COL, idOf(d), d)); }
    { const d = m({ qid: q() }); t('a made-up time', denied, await create(a, COL, idOf(d), Object.assign(d, { createdAt: undefined }), false)); }
    // 3. reading: own only; admins all
    t('the intern reads their own', ok, await get(a, COL, mine));
    t('another intern cannot', denied, await get(b, COL, mine));
    t('an admin reads it', ok, await get(adm, COL, mine));
    // 4. admins 👍 / reply / delete
    t('an admin likes it', ok, await patch(adm, COL, mine, { liked: true }));
    t('an admin replies', ok, await patch(adm, COL, mine, { reply: 'ดีมาก' }));
    t('the intern cannot delete it', denied, await del(a, COL, mine));
    t('an admin deletes it', ok, await del(adm, COL, mine));
    // 5. the questions doc
    t('an admin writes the questions', ok, await patch(adm, 'app_settings', 'nika_think', { note: 'x' }));
    t('an intern cannot', denied, await patch(a, 'app_settings', 'nika_think', { note: 'y' }));
    t('anyone reads them', ok, await get(null, 'app_settings', 'nika_think'));
    console.log('PASS: nika_think_answers rules — one owned bounded answer per question (id = qid_authUid, eight fields, ≤ 1000, server time), own read, admin read / 👍 / reply / delete; app_settings/nika_think admin write, public read');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
