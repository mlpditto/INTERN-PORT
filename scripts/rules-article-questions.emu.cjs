// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): the `article_questions` rule (V101.212 📰 💬 Any Q?).
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-article-questions.emu.cjs
// An intern creates a bounded question about an existing article, as themselves, status 'open', createdAt = request time; they read only their own;
// only admins read all, answer (update) or delete. Plain REST: real emulator accounts with an `admin` claim; the seed uses the "owner" bypass.
const assert = require('assert');
const P = 'projects/intern-port-edfa7/databases/(default)/documents', FS = 'http://127.0.0.1:8085/v1/' + P, AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
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
const create = (u, id, data, stamp) => post(`${FS}:commit`, { writes: [Object.assign({ update: { name: `${P}/article_questions/${id}`, fields: fields(data) }, currentDocument: { exists: false } },
    stamp === false ? {} : { updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }] })] }, u.token);
const seed = (col, id, data) => post(`${FS}/${col}?documentId=${id}`, { fields: fields(data) }, 'owner');
const get = (u, id) => j(`${FS}/article_questions/${id}`, { headers: { Authorization: 'Bearer ' + u.token } });
const patch = (u, id, data) => j(`${FS}/article_questions/${id}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
const del = (u, id) => j(`${FS}/article_questions/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + u.token } });
const ok = r => r.status === 200, denied = r => r.status === 403;

(async () => {
    const stamp = Date.now(), a = await mkUser('a' + stamp), b = await mkUser('b' + stamp), adm = await mkUser('adm' + stamp, true);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
    const art = 'art' + stamp;
    await seed('articles', art, { status: 'scheduled' });
    const q = over => Object.assign({ articleId: art, articleTitle: 'Psittacosis', kind: 'ask', text: 'Can it spread person to person?', lang: 'th', authUid: a.uid, userId: a.uid, status: 'open', createdAt: 1 }, over || {});
    let n = 0; const id = () => 'q' + stamp + '_' + (n++);

    // 1. the intern asks — every kind, Thai text, exactly 300 characters
    const mine = id();
    t('an intern asks about an article', ok, await create(a, mine, q()));
    t('⚠️ wrong / out of date', ok, await create(a, id(), q({ kind: 'wrong' })));
    t('💡 please add', ok, await create(a, id(), q({ kind: 'add', text: 'ก'.repeat(300) })));
    // 2. bounded, owned, honest
    t('asking as someone else (authUid)', denied, await create(a, id(), q({ authUid: b.uid })));
    t('asking for another userId', denied, await create(a, id(), q({ userId: b.uid })));
    t('an unknown kind', denied, await create(a, id(), q({ kind: 'spam' })));
    t('301 characters', denied, await create(a, id(), q({ text: 'x'.repeat(301) })));
    t('only spaces', denied, await create(a, id(), q({ text: '   ' })));
    t('an article that does not exist', denied, await create(a, id(), q({ articleId: 'nope' + stamp })));
    t('created already answered', denied, await create(a, id(), q({ status: 'answered' })));
    t('an extra field (an answer)', denied, await create(a, id(), q({ answer: 'self-answered' })));
    t('a missing field (lang)', denied, await create(a, id(), (o => { delete o.lang; return o; })(q())));
    t('a made-up time instead of the server time', denied, await create(a, id(), Object.assign(q(), { createdAt: undefined }), false));
    // 3. reading: own only; admins read all
    t('the asker reads their own', ok, await get(a, mine));
    t('another intern cannot read it', denied, await get(b, mine));
    t('an admin reads it', ok, await get(adm, mine));
    // 4. only admins answer or remove
    t('the asker cannot edit it', denied, await patch(a, mine, { text: 'edited' }));
    t('the asker cannot mark it answered', denied, await patch(a, mine, { status: 'answered' }));
    t('an admin answers it', ok, await patch(adm, mine, { status: 'answered', answer: 'Rarely.' }));
    t('the asker cannot delete it', denied, await del(a, mine));
    t('an admin deletes it', ok, await del(adm, mine));
    console.log('PASS: article_questions rules — own bounded create (3 kinds, ≤ 300, real article, open, server time), own read, admin read/answer/delete only');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
