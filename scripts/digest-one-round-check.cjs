// 2026-11-01: the real runQuizDigest with a fake Firestore. One 23:00 round over 24 h; a quiet day stays quiet unless a quiz closes before the next run;
// a case is e-mailed, so the digest never carries one and a case alone sends nothing.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const backend = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const cut = (from, to) => { const a = backend.indexOf(from); assert.ok(a >= 0, 'missing ' + from); const b = backend.indexOf(to, a); assert.ok(b > a, 'missing end ' + to); return backend.slice(a, b); };
const fnSrc = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';

assert.ok(/exports\.notifyQuizDigest = onSchedule\(\{\s*schedule: '0 23 \* \* \*',\s*timeZone: 'Asia\/Bangkok'/.test(backend), 'one round, 23:00 Bangkok');
assert.ok(!backend.includes('notifyQuizDigestEvening'), 'the 22:00 round is gone');

const src = [
    "const NOTIFY_ACTIVE_DAYS = 30;", "const NOTIFY_EXCLUDE_GROUPS = ['staff', 'preceptor'];",
    cut('const QUIZ_SUBMITTED_STATUSES', '\n'), cut('const DIGEST_UNNAMED_IN_GROUP', '\n'), cut('const DIGEST_MAX_ROWS', '\n'), cut('const DIGEST_URGENT_DAYS', '\n'), cut('const DIGEST_DONE_NAMES', '\n'),
    fnSrc('unnamedInGroupCopy'), fnSrc('splitAttemptId'), fnSrc('userLastSeenMs'), fnSrc('activeCohort'), fnSrc('eligibleForQuiz'),
    cut('const DIGEST_NAME_TAIL_RE', '\n'), cut('const DIGEST_COURSE_CODE_RE', '\n'),
    fnSrc('digestQuizName'), fnSrc('digestCleanName'), fnSrc('digestWentLiveMs'),
    'async function scanQuizPending(' + cut('async function scanQuizPending(', '\n}\n').slice('async function scanQuizPending('.length) + '\n}\n',
    cut('const DIGEST_TAGS', 'exports.notifyQuizDigest = onSchedule(')
].join('\n');

const NOW = Date.parse('2026-11-03T23:00:00+07:00'), H = 3600000;
const ts = ms => ({ toMillis: () => ms, toDate: () => new Date(ms), __ms: ms });
let DB, pushes;
const snapOf = docs => ({ docs: docs.map(([id, d]) => ({ id, data: () => d })), size: docs.length, forEach(fn) { this.docs.forEach(fn); } });
const query = (name, filters) => ({
    where: (f, op, v) => query(name, [...filters, [f, op, v]]),
    orderBy: () => query(name, filters),
    async get() {
        let rows = Object.entries(DB[name] || {});
        for (const [f, op, v] of filters) {
            if (f === 'DOCID') rows = rows.filter(([id]) => (op === '>=' ? id >= v : id < v));
            else if (op === '==') rows = rows.filter(([, d]) => d[f] === v);
            else if (op === '>=') rows = rows.filter(([, d]) => d[f] && (d[f].__ms || 0) >= (v.__ms != null ? v.__ms : v.getTime()));
            else if (op === '<=') rows = rows.filter(([, d]) => d[f] && (d[f].__ms || 0) <= (v.__ms != null ? v.__ms : v.getTime()));
        }
        return snapOf(rows);
    },
    doc: id => ({
        async get() { const d = (DB[name] || {})[id]; return { exists: !!d, id, data: () => d }; },
        async set() {}
    })
});
const fakeDb = { collection: name => query(name, []) };
const firestore = Object.assign(() => fakeDb, {
    Timestamp: { now: () => ts(NOW), fromMillis: ms => ts(ms) },
    FieldValue: { increment: n => n, serverTimestamp: () => 'TS' }, FieldPath: { documentId: () => 'DOCID' }
});
const context = {
    console: { log() {}, warn() {}, error() {} }, process: { env: { LINE_CHANNEL_ACCESS_TOKEN: 't' } },
    admin: { firestore },
    resolveLineTargets: () => [{ to: 'Uadmin', label: 'admin-1on1', withScores: true }, { to: 'Cgroup', label: 'group', withScores: false }],
    pushLineFlex: async (tag, targets, build) => targets.map(t => { pushes.push({ tag, to: t.to, flex: build(t) }); return { target: t.label, ok: true }; })
};
vm.createContext(context);
vm.runInContext(src + '\nthis.runQuizDigest = runQuizDigest;', context);

const seen = new Date(NOW - 2 * 86400000).toISOString();
const fresh = () => {
    DB = {
        users: { U1: { displayName: 'Ann', lastSeen: seen, group: 'Interns' }, U2: { displayName: 'Bee', lastSeen: seen, group: 'Interns' }, U3: { displayName: 'Cat', lastSeen: seen, group: 'Public' } },
        quizzes: {}, quiz_attempts: {}, cases: {}, product_listings: {}, submissions: {}
    };
    pushes = [];
};
const texts = () => JSON.stringify(pushes[0].flex.contents.body.contents) + JSON.stringify(pushes[0].flex.contents.header);
const quizDue = ms => ({ isActive: true, title: 'Asthma 1', shortTitle: 'Asthma', deadline: ts(ms), lastLiveAt: ts(NOW - 200 * H) });

(async () => {
    // a quiet day stays quiet, as long as nothing closes before the next run
    fresh(); DB.quizzes.q1 = quizDue(NOW + 30 * H);
    let r = await context.runQuizDigest('scheduled');
    assert.equal(r.sent, false); assert.equal(pushes.length, 0, 'quiet day: no push');

    // ...a quiz closing within 24 h is the group's only notice, so it goes
    fresh(); DB.quizzes.q1 = quizDue(NOW + 20 * H);
    r = await context.runQuizDigest('scheduled');
    assert.equal(pushes.length, 1); assert.equal(pushes[0].to, 'Cgroup', 'group only');
    assert.match(texts(), /Due soon · 1/); assert.match(texts(), /due tomorrow 19:00/);

    // a case goes by mail, so LINE does not repeat it
    fresh(); DB.cases = { c1: { userId: 'U1', timestamp: ts(NOW - H) } };
    await context.runQuizDigest('scheduled');
    assert.equal(pushes.length, 0, 'a case alone sends nothing');
    assert.ok(!cut('const DIGEST_TAGS', 'exports.notifyQuizDigest = onSchedule(').includes("collection('cases')"), 'the digest never reads cases');
    assert.ok(/const CASE_LINE_PUSH = false;/.test(backend) && /const FLOOD_LINE_PUSH = false;/.test(backend), 'what is mailed stays off LINE');

    console.log('PASS: digest one round — 23:00, quiet days stay quiet unless a quiz closes, mailed cases stay off LINE');
})().catch(e => { console.error(e); process.exit(1); });
