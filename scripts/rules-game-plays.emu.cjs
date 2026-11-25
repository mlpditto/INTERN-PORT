// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): the `game_plays` rule (V101.370 🎮 game time, game-log.js).
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-game-plays.emu.cjs
// An intern adds a play as themselves (authUid = login, userId = login or linked), for one of the 4 games, ≤ 40 rounds, only the known
// fields; nobody edits; only admins read; only admins delete.
const assert = require('assert');
const P = 'projects/intern-port-edfa7/databases/(default)/documents', FS = 'http://127.0.0.1:8085/v1/' + P, AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const COL = 'game_plays';
const j = async (url, opt) => { const r = await fetch(url, opt); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t; } return { status: r.status, body: b }; };
const post = (url, body, auth) => j(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + auth } : {}), body: JSON.stringify(body) });
async function mkUser(name, admin) {
    const s = await post(AUTH + '/accounts:signUp?key=fake', { email: name + '@test.local', password: 'pw123456', returnSecureToken: true });
    await post(AUTH + '/accounts:update?key=fake', { localId: s.body.localId, customAttributes: JSON.stringify({ admin: !!admin }) }, 'owner');
    const t = await post(AUTH + '/accounts:signInWithPassword?key=fake', { email: name + '@test.local', password: 'pw123456', returnSecureToken: true });
    return { uid: s.body.localId, token: t.body.idToken };
}
const val = (v) => v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : { stringValue: String(v) };
const fields = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'at').map(([k, v]) => [k, val(v)]));
const create = (u, id, data) => post(`${FS}:commit`, { writes: [{ update: { name: `${P}/${COL}/${id}`, fields: fields(data) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] }, u.token);
const get = (u, id) => j(`${FS}/${COL}/${id}`, { headers: { Authorization: 'Bearer ' + u.token } });
const patch = (u, id, data) => j(`${FS}/${COL}/${id}?${Object.keys(data).map((k) => 'updateMask.fieldPaths=' + k).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(data) }) });
const del = (u, id) => j(`${FS}/${COL}/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + u.token } });
const ok = (r) => r.status === 200, denied = (r) => r.status === 403;

(async () => {
    const stamp = Date.now(), a = await mkUser('a' + stamp), b = await mkUser('b' + stamp), adm = await mkUser('adm' + stamp, true);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
    const g = (over) => Object.assign({ userId: a.uid, authUid: a.uid, game: 'bw', mode: 'l2', rounds: [5, 12.5, 180], from: 0, sec: 198, win: 'w', score: '5:3', res: ['win', 'lose', 'win'], startedAt: 1, endedAt: 2, v: 'V101.370', at: 1 }, over || {});
    let n = 0; const id = () => 'p' + stamp + '_' + (n++);
    const mine = id();
    t('an intern adds their own play', ok, await create(a, mine, g()));
    for (const game of ['count', 'cereal', 'wolf']) t('game ' + game, ok, await create(a, id(), g({ game, win: null })));
    t('40 rounds', ok, await create(a, id(), g({ rounds: Array(40).fill(1) })));
    t('as someone else (authUid)', denied, await create(a, id(), g({ authUid: b.uid })));
    t('for another userId', denied, await create(a, id(), g({ userId: b.uid })));
    t('an unknown game', denied, await create(a, id(), g({ game: 'chess' })));
    t('41 rounds', denied, await create(a, id(), g({ rounds: Array(41).fill(1) })));
    t('rounds not a list', denied, await create(a, id(), g({ rounds: '5,6' })));
    t('an extra field', denied, await create(a, id(), g({ points: 999 })));
    t('the player cannot read it', denied, await get(a, mine));
    t('another intern cannot read it', denied, await get(b, mine));
    t('an admin reads it', ok, await get(adm, mine));
    t('the player cannot edit it', denied, await patch(a, mine, { win: 'w', sec: 1 }));
    t('an admin cannot edit it either', denied, await patch(adm, mine, { sec: 1 }));
    t('the player cannot delete it', denied, await del(a, mine));
    t('an admin deletes it', ok, await del(adm, mine));
    console.log('PASS: game_plays rules — own create (authUid + userId, 4 games, ≤ 40 rounds, known fields), admin-only read / delete, no edits');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
