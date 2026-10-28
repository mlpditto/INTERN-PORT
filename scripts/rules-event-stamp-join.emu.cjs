// Firestore EMULATOR test (not run by CI — it needs Java + the emulators): `event_stamps` auto-claim — whoever tapped Join on or before the event day gets the stamp from that day on, no code.
//   PATH="/c/Program Files/Microsoft/jdk-21.0.12.101-hotspot/bin:$PATH" firebase emulators:start --only firestore,auth --project intern-port-edfa7
//   node scripts/rules-event-stamp-join.emu.cjs
// NOTE: REST cannot reproduce the SDK serverTimestamp() == request.time check (the clause `d.createdAt == request.time`, same as codeClaimOk), so run this with that ONE clause
// swapped for `true` in a scratch copy of firestore.rules — every other clause is exercised for real.
// Plain REST like rules-reflective-claim.emu.cjs: users are real emulator accounts; the seed uses the emulator's "owner" bypass.
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
const val = v => typeof v === 'string' ? { stringValue: v } : { timestampValue: (v || new Date()).toISOString() };
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
const seed = (col, id, data) => post(`${FS}/${col}?documentId=${id}`, fields(data), 'owner');
const create = (u, id, data) => post(`${FS}/event_stamps?documentId=${id}`, fields(data), u.token);
const ok = r => r.status === 200, denied = r => r.status === 403;
const bkk = off => new Date(Date.now() + 7 * 3600e3 + off * 864e5).toISOString().slice(0, 10);   // Bangkok date key, off days from today

(async () => {
    const s = Date.now(), a = await mkUser('a' + s), b = await mkUser('b' + s);
    const t = (name, cond, r) => assert.ok(cond(r), name + ' → got ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
    const today = bkk(0), tomorrow = bkk(1), yesterday = bkk(-1);
    const ev = (id, date) => seed('events', id, { title: 'T ' + id, eventDate: date, badge: 'b-' + id });
    const interest = (id, ev, u, at) => seed('event_interests', id, { eventId: ev, userId: 'u-' + u.uid, authUid: u.uid, createdAt: at || new Date() });
    const stamp = (ev, date, u, via) => Object.assign({ eventId: ev, userId: 'u-' + u.uid, authUid: u.uid, displayName: 'x', title: 'T ' + ev, eventDate: date, badge: 'b-' + ev, via: via || 'join', interestId: 'i-' + ev + u.uid, createdAt: new Date() });
    await ev('e1' + s, today); await ev('e2' + s, tomorrow); await ev('e3' + s, yesterday);
    await interest('i-e1' + s + a.uid, 'e1' + s, a); await interest('i-e2' + s + a.uid, 'e2' + s, a); await interest('i-e3' + s + a.uid, 'e3' + s, a);                       // joined just now
    await interest('i-e4' + s + a.uid, 'e4' + s, a, new Date(Date.now() - 3 * 864e5)); await ev('e4' + s, yesterday);                                                         // joined 3 days ago, event was yesterday

    t('joined → stamp on the event day', ok, await create(a, 'e1' + s + '_u-' + a.uid, stamp('e1' + s, today, a)));
    t('same stamp twice (already exists)', r => r.status === 409, await create(a, 'e1' + s + '_u-' + a.uid, stamp('e1' + s, today, a)));
    t('event is tomorrow → not yet', denied, await create(a, 'e2' + s + '_u-' + a.uid, stamp('e2' + s, tomorrow, a)));
    t('joined AFTER the event day → no auto stamp', denied, await create(a, 'e3' + s + '_u-' + a.uid, stamp('e3' + s, yesterday, a)));
    t('joined 3 days ago, event yesterday → stamp', ok, await create(a, 'e4' + s + '_u-' + a.uid, stamp('e4' + s, yesterday, a)));
    t('someone who never joined', denied, await create(b, 'e1' + s + '_u-' + b.uid, Object.assign(stamp('e1' + s, today, b), { interestId: 'i-e1' + s + a.uid })));
    t("another intern's interest", denied, await create(b, 'e4' + s + '_u-' + b.uid, Object.assign(stamp('e4' + s, yesterday, b), { interestId: 'i-e4' + s + a.uid })));
    t('a different badge than the event has', denied, await create(a, 'e5' + s + '_u-' + a.uid, Object.assign(stamp('e1' + s, today, a), { badge: 'forged' })));
    t('an unknown via', denied, await create(b, 'e1' + s + '_u-' + b.uid + 'x', stamp('e1' + s, today, b, 'free')));
    console.log('rules-event-stamp-join: all assertions passed');
})().catch(e => { console.error(e); process.exit(1); });
