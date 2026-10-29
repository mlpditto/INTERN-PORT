// 2026-10-22: notifyAdminOnNewCase also mails the admin (Gmail SMTP, the flood-alert transport). The REAL callable body from
// functions/index.js in a vm with LINE (axios), Firestore and the mail helper stubbed: LINE + mail go out independently —
// no LINE token → mail only; mail down → LINE still counts; the mail carries the case fields and the admin link, nothing undefined.
//   node scripts/case-mail-notify-check.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const backend = fs.readFileSync('functions/index.js', 'utf8');

// static pins
assert.ok(backend.includes("{ secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID', 'ADMIN_LINE_GROUP_ID', 'GMAIL_APP_PASSWORD'] }"), 'the callable declares the Gmail secret');
assert.ok(backend.includes('async function sendAdminMail(fromName, subject, text, html) {') && backend.includes('async function sendFloodMail(subject, text) {'), 'sendAdminMail beside the untouched sendFloodMail');
assert.ok(/async function sendAdminMail[\s\S]*?to: FLOOD_MAIL, subject, text(?:, \.\.\.\(html \? \{ html \} : \{\}\))? \}\);\r?\n\}/.test(backend), 'sendAdminMail mails the account itself (medlifeplus@gmail.com)');
const start = backend.indexOf('exports.notifyAdminOnNewCase = onCall(');
const src = backend.slice(start, backend.indexOf('\n});', start) + 4);
assert.ok(!src.includes("reason: 'token-missing'") && !src.includes("reason: 'admin-id-missing'"), 'a missing LINE token / target no longer returns before the mail (the product notifier keeps its own early returns)');
let CASE, pushes, mails, mailFail;
const context = {
    exports: {}, console: { log() {}, warn() {}, error() {} },
    onCall: (opts, fn) => { fn.opts = opts; return fn; },
    HttpsError: class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } },
    admin: { firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: !!CASE, data: () => CASE }) }) }) }) },
    process: { env: {} },
    CASE_LINE_PUSH: true,   // V102.496: the switch declared above the function in index.js; true = the LINE path these cases cover (the 'off' case is below)
    axios: { post: async (url, body, opts) => { pushes.push({ to: body.to, alt: body.messages[0].altText }); return { data: {} }; } },
    sendAdminMail: async (fromName, subject, text, html) => { mails.push({ fromName, subject, text, html }); if (mailFail) throw new Error('smtp down'); }
};
vm.createContext(context);
vm.runInContext(src, context);
const fn = context.exports.notifyAdminOnNewCase;
assert.deepEqual(JSON.parse(JSON.stringify(fn.opts.secrets)), ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID', 'ADMIN_LINE_GROUP_ID', 'GMAIL_APP_PASSWORD']);   // vm realm → plain
const call = (env, caseData, fail) => { context.process.env = env; CASE = caseData; pushes = []; mails = []; mailFail = !!fail; return fn({ auth: { uid: 'u1' }, data: { caseDocId: 'c1' } }); };
const FULL = { displayName: 'สมชาย ใจดี', caseId: '26-26870', customer: 'นางสาว ก', disease: 'Hypertension', diseaseSystemLabel: 'Cardiovascular / ระบบหัวใจ', note: 'Amlodipine 5 mg · BP 150/95' };
const LINE = { LINE_CHANNEL_ACCESS_TOKEN: 't', ADMIN_LINE_USER_ID: 'U123', ADMIN_LINE_GROUP_ID: 'C456', GMAIL_APP_PASSWORD: 'p' };

(async () => {
    // 1. everything configured: two LINE pushes + one mail
    let r = await call(LINE, FULL);
    assert.deepEqual([r.ok, r.pushed, r.pushedCount, r.mailed, Array.from(r.results, x => x.target + ':' + x.ok)], [true, true, 2, true, ['admin-1on1:true', 'group:true', 'mail:true']], JSON.stringify(r));
    assert.deepEqual(pushes.map(p => p.to), ['U123', 'C456']);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].fromName, 'INTERN-PORT Cases');
    assert.equal(mails[0].subject, '🩺 Case ใหม่ · สมชาย ใจดี · 26-26870');
    for (const s of ['สมชาย ใจดี ส่ง Case ใหม่', 'HN / Ref: 26-26870', 'ผู้ป่วย: นางสาว ก', 'โรค: Hypertension', 'ระบบ: Cardiovascular / ระบบหัวใจ', 'Note: Amlodipine 5 mg · BP 150/95', 'เปิดหน้า admin: https://mlpditto.github.io/INTERN-PORT/admin.html']) assert.ok(mails[0].text.includes(s), 'mail says: ' + s);
    assert.ok(!/undefined/.test(mails[0].text + mails[0].subject), 'nothing undefined in the mail');
    assert.ok(mails[0].html.includes('<a href="https://mlpditto.github.io/INTERN-PORT/admin.html">เปิดหน้า admin</a>') && !mails[0].html.includes('>https://'), 'HTML part: short link, no visible long URL');
    assert.ok(mails[0].html.includes('Amlodipine 5 mg · BP 150/95'), 'HTML part keeps the note');

    // 2. a sparse case: empty fields are left out, the subject falls back to the disease / Untitled
    r = await call(LINE, { displayName: 'B', disease: 'Asthma' });
    assert.equal(mails[0].subject, '🩺 Case ใหม่ · B · Asthma');
    assert.ok(!/HN \/ Ref|ผู้ป่วย:|ระบบ:/.test(mails[0].text) && mails[0].text.includes('Note: (no note)'), 'sparse case: ' + mails[0].text);
    r = await call(LINE, { displayName: 'C' });
    assert.equal(mails[0].subject, '🩺 Case ใหม่ · C · Untitled');

    // 2b. V102.496 CASE_LINE_PUSH off (the shipped value): no LINE push at all, the mail still goes
    context.CASE_LINE_PUSH = false;
    r = await call(LINE, FULL);
    assert.deepEqual([r.ok, r.pushed, r.pushedCount, r.mailed, pushes.length, mails.length, Array.from(r.results, x => x.target + ':' + x.ok)], [true, false, 0, true, 0, 1, ['mail:true']], JSON.stringify(r));
    context.CASE_LINE_PUSH = true;

    // 3. no LINE token: no push, the mail still goes, the call is ok
    r = await call({ GMAIL_APP_PASSWORD: 'p' }, FULL);
    assert.deepEqual([r.ok, r.pushed, r.pushedCount, r.mailed, pushes.length, mails.length], [true, false, 0, true, 0, 1], JSON.stringify(r));

    // 4. mail down: LINE still counts, mailed false, ok true
    r = await call(LINE, FULL, true);
    assert.deepEqual([r.ok, r.pushedCount, r.mailed, Array.from(r.results, x => x.target + ':' + x.ok)], [true, 2, false, ['admin-1on1:true', 'group:true', 'mail:false']], JSON.stringify(r));

    // 5. neither configured and mail failing: ok false, nothing thrown
    r = await call({}, FULL, true);
    assert.deepEqual([r.ok, r.pushedCount, r.mailed], [false, 0, false]);

    // 6. unauthenticated / missing id still throw; an unknown case is skipped before any send
    await assert.rejects(() => fn({ auth: null, data: { caseDocId: 'c1' } }), /Login required/);
    await assert.rejects(() => fn({ auth: { uid: 'u1' }, data: {} }), /caseDocId required/);
    r = await call(LINE, null);
    assert.deepEqual([r.skipped, r.reason, mails.length, pushes.length], [true, 'case-not-found', 0, 0]);

    console.log('PASS: notifyAdminOnNewCase — LINE pushes + one admin mail (Gmail transport), independent of each other; fields + admin link in the mail; sparse cases; auth / id / missing case unchanged');
})().catch(e => { console.error(e); process.exit(1); });
