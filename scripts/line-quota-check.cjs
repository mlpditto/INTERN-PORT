// V102.479 — the daily LINE quota watch. No browser: functions/line-quota.js (pure tier maths + the owner's mail) and the REAL runWatchLineQuota
// sliced out of functions/index.js and run in a vm with LINE (axios), Firestore and the mail helper stubbed.
//   node scripts/line-quota-check.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const Q = require('../functions/line-quota.js');
const backend = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');

// ---------- tier maths
const T = (limit, used, day, dim) => Q.quotaTier({ limit, used, dayOfMonth: day, daysInMonth: dim || 31 });
let r = T(300, 15, 1);
assert.deepEqual([r.tier, r.runOutDay], ['ok', null], 'one busy first day (15 of 300) is not an alarm: the projection only counts from day 5 or 20 used');
r = T(300, 20, 1); assert.equal(r.tier, 'watch', '20 on day 1 projects 620 → watch'); assert.equal(r.runOutDay, 15);
r = T(300, 120, 10);
assert.deepEqual([r.tier, r.pct, r.perDay, r.projected, r.runOutDay], ['watch', 40, 12, 372, 25], 'steady 12/day on day 10 → ends at ~372, full on day 25');
r = T(300, 90, 10); assert.deepEqual([r.tier, r.projected, r.runOutDay], ['ok', 279, null], '9/day stays under the limit');
const at = u => T(300, u, 30, 30).tier;
assert.deepEqual([209, 210, 269, 270, 299, 300, 301].map(at), ['ok', 'watch', 'watch', 'critical', 'critical', 'full', 'full'], '70 % / 90 % / 100 % boundaries');
r = T(null, 500, 10); assert.deepEqual([r.tier, r.pct, r.unlimited], ['ok', null, true], 'an unlimited plan never alarms');
assert.equal(T('none', 500, 10).tier, 'ok'); assert.equal(T(0, 5, 3).tier, 'ok');
assert.equal(T(300, 280, 31, 31).runOutDay, null, 'no run-out day when the month ends first / is already past 90 %: only a pace that crosses before month end reports one');
assert.deepEqual(Q.TIERS, ['ok', 'watch', 'critical', 'full']); assert.ok(Q.tierRank('critical') > Q.tierRank('watch') && Q.tierRank('nope') === 0);
assert.deepEqual(Q.bangkokDayInfo(new Date('2026-10-31T17:30:00Z')), { month: '2026-11', day: 1, daysInMonth: 30 }, 'Bangkok calendar: 00:30 on 1 Nov');
assert.deepEqual(Q.bangkokDayInfo(new Date('2028-02-15T00:00:00Z')), { month: '2028-02', day: 15, daysInMonth: 29 }, 'leap February');

// ---------- the mail
const m = Q.quotaMail({ month: '2026-10', day: 10, limit: 300, used: 120, counter: 90, byTag: { notifyQuizDigest: 60, notifyAdminOnNewCase: 20, odd_tag: 5, notifyQuizReminder: 0 }, pct: 40, perDay: 12, projected: 372, runOutDay: 25, tier: 'watch' });
assert.match(m.subject, /^🟡 โควตา LINE 2026-10: ใช้ 120\/300 \(40%\) · คาดเต็มวันที่ 25$/);
for (const s of ['120/300 (40%)', 'เหลือ 180', '12 ข้อความ/วัน', '~372', 'จะเต็มวันที่ 25 (อีก 15 วัน)', 'LINE นับ 120 · ระบบนับเองได้ 90', 'ต่าง 30 ข้อความ = ส่งนอกระบบ', 'OA Manager', 'digest 60 · case 20 · odd_tag 5', 'Send digest now', 'milestone', '/admin.html']) assert.ok((m.subject + '\n' + m.text).includes(s), 'mail has: ' + s);
assert.ok(!/undefined|NaN|null/.test(m.subject + m.text), 'nothing undefined in the mail');
assert.ok(!m.text.includes('ใช้มากสุด: digest 60 · case 20 · odd_tag 5 · '), 'top three only');
const mFull = Q.quotaMail({ month: '2026-10', day: 20, limit: 300, used: 300, counter: 310, byTag: {}, pct: 100, perDay: 15, projected: 465, runOutDay: null, tier: 'full' });
assert.match(mFull.subject, /^🔴 .*300\/300 \(100%\) · เต็มแล้ว$/); assert.match(mFull.text, /429/); assert.match(mFull.text, /ตัวนับของระบบมากกว่า LINE 10/, 'counter above LINE is called out');
assert.ok(!/undefined|NaN/.test(mFull.text) && !mFull.text.includes('ใช้มากสุด'), 'no tag line when there are no tags');
const mNoCounter = Q.quotaMail({ month: '2026-10', day: 3, limit: 300, used: 215, counter: null, byTag: null, pct: 72, perDay: 72, projected: 2200, runOutDay: 4, tier: 'watch' });
assert.ok(!mNoCounter.text.includes('ระบบนับเอง') && !/undefined|NaN/.test(mNoCounter.text), 'no drift line without a counter');
assert.match(Q.quotaMail({ month: '2026-10', day: 25, limit: 300, used: 275, counter: 275, pct: 92, perDay: 11, projected: 341, runOutDay: 27, tier: 'critical' }).subject, /^🟠/);

// ---------- the runner (real source)
const start = backend.indexOf('async function runWatchLineQuota(deps) {');
const end = backend.indexOf('\n});\n', backend.indexOf('exports.watchLineQuota = onSchedule(')) + 5;
assert.ok(start > 0 && end > start, 'runner + schedule found');
const src = backend.slice(start, end);
assert.ok(!/message\/push|pushLineFlex|broadcast|multicast|narrowcast/.test(src), 'the watch never calls a LINE push endpoint — the alert must not spend the quota it guards');
assert.ok(src.includes("schedule: '0 7 * * *'") && src.includes("timeZone: 'Asia/Bangkok'") && src.includes("secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'GMAIL_APP_PASSWORD']"), 'daily 07:00 Bangkok, token + Gmail secrets only');
assert.ok(src.includes("sendMail"), 'mail goes through the injectable helper (default sendAdminMail)');

const docs = {};
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = (b[k] && typeof b[k] === 'object' && !b[k].__ts && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === 'object' && !a[k].__ts) ? merge(a[k], b[k]) : b[k]; return o; };
const db = { collection: (c) => ({ doc: (id) => ({ get: async () => ({ exists: !!docs[c + '/' + id], data: () => docs[c + '/' + id] }), set: async (v, o) => { docs[c + '/' + id] = o && o.merge ? merge(docs[c + '/' + id] || {}, v) : v; } }) }) };
const FV = { serverTimestamp: () => ({ __ts: true }) };
let apiReply, apiCalls, mails, mailFail, logs;
const context = {
    exports: {}, process: { env: {} }, console: { log: m => logs.push(m), warn: m => logs.push(m), error: m => logs.push(m) },
    onSchedule: (opts, fn) => { fn.opts = opts; return fn; },
    admin: { firestore: Object.assign(() => db, { FieldValue: FV }) },
    axios: { get: async (url, o) => { apiCalls.push({ url, auth: o && o.headers && o.headers.Authorization, timeout: o && o.timeout }); if (apiReply instanceof Error) throw apiReply; return apiReply(url); } },
    sendAdminMail: async () => { throw new Error('the default mailer must not be used in the test'); },
    lineQuota: Q
};
vm.createContext(context); vm.runInContext(src, context);
const run = (extra) => context.runWatchLineQuota(Object.assign({ db, FieldValue: FV, token: 'T', sendMail: async (from, subject, text) => { if (mailFail) throw new Error('smtp down'); mails.push({ from, subject, text }); } }, extra));
const reply = (limited, used) => (url) => ({ data: /consumption$/.test(url) ? { totalUsage: used } : (limited === null ? { type: 'none' } : { type: 'limited', value: limited }) });
const reset = () => { for (const k of Object.keys(docs)) delete docs[k]; apiCalls = []; mails = []; mailFail = false; logs = []; };
const OCT10 = new Date('2026-10-10T00:00:00Z'), OCT12 = new Date('2026-10-12T00:00:00Z'), OCT20 = new Date('2026-10-20T00:00:00Z'), OCT21 = new Date('2026-10-21T00:00:00Z'), NOV3 = new Date('2026-11-03T00:00:00Z'), NOV20 = new Date('2026-11-20T00:00:00Z');

(async () => {
    // ok → the api block is written, the counter is untouched, nothing is mailed
    reset(); docs['line_usage/2026-10'] = { month: '2026-10', total: 40, byTag: { notifyQuizDigest: 40 }, byDay: { '2026-10-09': 3 } };
    apiReply = reply(300, 50); let out = await run({ now: OCT10 });
    assert.deepEqual([out.ok, out.tier, out.mailed, mails.length], [true, 'ok', false, 0]);
    assert.deepEqual(apiCalls.map(c => c.url), ['https://api.line.me/v2/bot/message/quota', 'https://api.line.me/v2/bot/message/quota/consumption'], 'both endpoints, GET');
    assert.ok(apiCalls.every(c => c.auth === 'Bearer T' && c.timeout === 8000), 'bearer token, 8 s timeout');
    let d = docs['line_usage/2026-10'];
    assert.deepEqual([d.total, d.byTag.notifyQuizDigest, d.byDay['2026-10-09']], [40, 40, 3], 'the project counter fields are untouched');
    assert.deepEqual([d.api.limit, d.api.used, d.api.tier, d.api.error, d.api.pct, d.api.checkedAt.__ts], [300, 50, 'ok', null, 17, true]);

    // watch → mail once; same tier again → no second mail; escalation → mail; full → mail; then quiet
    reset(); docs['line_usage/2026-10'] = { total: 90, byTag: { notifyQuizDigest: 60, notifyAdminOnNewCase: 30 } };
    apiReply = reply(300, 120); out = await run({ now: OCT10 });
    assert.deepEqual([out.tier, out.mailed, mails.length], ['watch', true, 1]);
    assert.equal(mails[0].from, 'INTERN-PORT LINE'); assert.match(mails[0].subject, /^🟡 .*120\/300/); assert.match(mails[0].text, /ต่าง 30 ข้อความ/); assert.match(mails[0].text, /digest 60 · case 30/);
    assert.equal(docs['line_usage/2026-10'].alert.lastMailedTier, 'watch');
    out = await run({ now: OCT10 }); assert.deepEqual([out.mailed, mails.length], [false, 1], 'same tier, same day: no second mail');
    out = await run({ now: OCT12 }); assert.deepEqual([out.mailed, mails.length], [false, 1], 'same tier on a later day: still no second mail');
    apiReply = reply(300, 275); out = await run({ now: OCT20 }); assert.deepEqual([out.tier, out.mailed, mails.length], ['critical', true, 2]); assert.match(mails[1].subject, /^🟠/);
    apiReply = reply(300, 300); out = await run({ now: OCT21 }); assert.deepEqual([out.tier, out.mailed, mails.length], ['full', true, 3]); assert.match(mails[2].subject, /^🔴.*เต็มแล้ว/);
    out = await run({ now: OCT21 }); assert.deepEqual([out.mailed, mails.length], [false, 3], 'full again: quiet');
    apiReply = reply(300, 150); out = await run({ now: OCT21 }); assert.deepEqual([out.mailed, mails.length], [false, 3], 'a number that drops back never re-mails an already-mailed tier');
    // a new month starts fresh
    apiReply = reply(300, 20); out = await run({ now: NOV3 }); assert.deepEqual([out.tier, out.mailed, mails.length], ['ok', false, 3], 'Nov 3, 20 used → projects ~200: ok, and the October mails do not carry over');
    apiReply = reply(300, 250); out = await run({ now: NOV20 }); assert.deepEqual([out.tier, out.mailed, mails.length], ['watch', true, 4], 'a new month starts fresh: watch mails again');
    assert.equal(docs['line_usage/2026-11'].alert.lastMailedTier, 'watch', 'Nov has its own doc');

    // API failure → recorded, never mailed, the previous api numbers stay
    reset(); docs['line_usage/2026-10'] = { total: 10, api: { limit: 300, used: 50, tier: 'ok', checkedAt: { __ts: true }, error: null } };
    apiReply = Object.assign(new Error('Request failed'), { response: { data: { message: 'Authentication failed' } } }); out = await run({ now: OCT10 });
    assert.deepEqual([out.ok, out.error, mails.length], [false, 'Authentication failed', 0]);
    d = docs['line_usage/2026-10']; assert.deepEqual([d.api.error, d.api.used, d.api.limit, !!d.api.errorAt, d.total], ['Authentication failed', 50, 300, true, 10], 'error recorded; the last good numbers and the counter stay');
    reset(); out = await run({ now: OCT10, token: '' }); assert.deepEqual([out.ok, /token/i.test(out.error), apiCalls.length], [false, true, 0], 'no token → recorded, no call');
    reset(); apiReply = () => ({ data: { type: 'limited', value: 300 } }); out = await run({ now: OCT10 }); assert.equal(out.ok, false, 'a reply with no totalUsage is an error, not a zero');

    // unlimited plan
    reset(); apiReply = reply(null, 900); out = await run({ now: OCT10 }); assert.deepEqual([out.ok, out.tier, out.limit, out.mailed], [true, 'ok', null, false]);
    assert.deepEqual([docs['line_usage/2026-10'].api.limit, docs['line_usage/2026-10'].api.tier], [null, 'ok']);

    // mail failure → lastMailedTier unchanged, tomorrow tries again
    reset(); apiReply = reply(300, 120); mailFail = true; out = await run({ now: OCT10 });
    assert.deepEqual([out.ok, out.mailed, !!(docs['line_usage/2026-10'].alert && docs['line_usage/2026-10'].alert.lastMailedTier)], [true, false, false], 'mail down: api block written, alert not marked');
    assert.ok(logs.some(l => /mail failed/.test(l)));
    mailFail = false; out = await run({ now: OCT12 }); assert.deepEqual([out.mailed, mails.length, docs['line_usage/2026-10'].alert.lastMailedTier], [true, 1, 'watch'], 'next run mails and marks it');

    // owner-status: the LINE row reads the api block (Firestore REST shapes) — fresh → LINE's number with levels, stale / absent → the old counter message
    const st = fs.readFileSync('scripts/owner-status.cjs', 'utf8').replace(/\r\n/g, '\n');
    const sStart = st.indexOf('async function checkLineQuota() {'), sSrc = st.slice(sStart, st.indexOf('\n}\n', sStart) + 3);
    const rowsOut = []; let restDoc;
    const sctx = { rows: rowsOut, OK: 'OK', WARN: 'WARN', BAD: 'BAD', NA: 'NA', PROJECT: 'p', LINE_MONTHLY_CAP: 300, accessToken: () => 'tok', getJson: async () => { if (!restDoc) throw new Error('HTTP 404'); return restDoc; }, add: (id, check, status, detail) => rowsOut.push({ id, check, status, detail }), Date, Number, Math, Object, String };
    vm.createContext(sctx); vm.runInContext(sSrc, sctx);
    const iso = h => new Date(Date.now() - h * 3600e3).toISOString();
    const apiDoc = (o) => ({ fields: { total: { integerValue: '12' }, api: { mapValue: { fields: Object.assign({ limit: { integerValue: '300' }, used: { integerValue: '41' }, tier: { stringValue: 'ok' }, projected: { integerValue: '120' }, perDay: { doubleValue: 4.1 }, checkedAt: { timestampValue: iso(1) }, error: { nullValue: null } }, o) } } } });
    const lineRow = async (doc) => { rowsOut.length = 0; restDoc = doc; await sctx.checkLineQuota(); return rowsOut[0]; };
    let row = await lineRow(apiDoc({}));
    assert.equal(row.status, 'OK'); assert.match(row.detail, /LINE says 41\/300 \(14%\)/); assert.match(row.detail, /our counter 12 \(drift 29/); assert.match(row.detail, /4\.1\/day/);
    assert.equal(row.line && row.line.used, 41, 'the json row gains a `line` field (added, nothing removed)');
    row = await lineRow(apiDoc({ tier: { stringValue: 'watch' }, projected: { integerValue: '372' }, runOutDay: { integerValue: '25' } })); assert.equal(row.status, 'WARN'); assert.match(row.detail, /full on day 25/);
    row = await lineRow(apiDoc({ tier: { stringValue: 'critical' }, used: { integerValue: '280' } })); assert.equal(row.status, 'BAD');
    row = await lineRow(apiDoc({ used: { integerValue: '285' }, tier: { stringValue: 'ok' } })); assert.equal(row.status, 'BAD', '90 % or more is BAD whatever the tier says');
    row = await lineRow(apiDoc({ checkedAt: { timestampValue: iso(40) } })); assert.equal(row.status, 'OK'); assert.match(row.detail, /counter undercounts/); assert.match(row.detail, /not deployed or has not run/, 'a 40 h old api block → the old message');
    row = await lineRow({ fields: { total: { integerValue: '7' } } }); assert.match(row.detail, /7 counted/); assert.match(row.detail, /not deployed or has not run/, 'no api block → old message + the hint');
    row = await lineRow(apiDoc({ used: { nullValue: null }, error: { stringValue: 'Authentication failed' } })); assert.match(row.detail, /daily LINE check failed: Authentication failed/, 'an error-only block names the failure');
    row = await lineRow(null); assert.match(row.detail, /no pushes counted yet/, '404 → nothing counted yet');

    // the exported schedule
    assert.equal(typeof context.exports.watchLineQuota, 'function'); assert.equal(context.exports.watchLineQuota.opts.schedule, '0 7 * * *');
    console.log('line-quota-check: all assertions passed');
})().catch(e => { console.error(e); process.exit(1); });
