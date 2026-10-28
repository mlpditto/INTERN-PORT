// V102.480 — quiz deadline LINE alerts. No browser: (1) functions/quiz-deadline.js (pure timing, copy, Flex validity) and
// (2) the REAL runQuizDeadlines() + scanQuizPending() sliced out of functions/index.js and run in vm with a fake Firestore and a
// recording pushLineFlex. Pins: T-24 h group bubble, T-3 h personal only to interns who have not submitted, quiet hours,
// idempotency, re-arm on a moved deadline, opt-outs, daily cap, critical quota, retry after a transient failure, truthful Beri line.
//   TZ=Asia/Bangkok node scripts/quiz-deadline-check.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const D = require('../functions/quiz-deadline.js');
const backend = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const H = D.HOUR;
// Bangkok wall clock -> epoch ms (UTC+7, no DST)
const bkk = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 7, mi || 0);

// ---------- 1. timing ----------
const dl = bkk(2026, 10, 25, 18, 0);                         // closes 25 Oct 18:00
assert.equal(D.isQuietHour(bkk(2026, 10, 25, 6, 59)), true);
assert.equal(D.isQuietHour(bkk(2026, 10, 25, 7, 0)), false);
assert.equal(D.isQuietHour(bkk(2026, 10, 25, 21, 59)), false);
assert.equal(D.isQuietHour(bkk(2026, 10, 25, 22, 0)), true);
const plan = (now, deadline) => { const p = D.planDeadline(now, deadline); return p.group ? 'group' : (p.personal ? 'personal' : 'none'); };
assert.equal(plan(dl - 25 * H, dl), 'none', '25 h out: too early');
assert.equal(plan(dl - 24 * H, dl), 'group', 'T-24 h: group');
assert.equal(plan(dl - 10 * H, dl), 'group', 'between: still the group window');
assert.equal(plan(dl - 4 * H, dl), 'group', 'T-4 h still group (personal opens at T-3 h)');
assert.equal(plan(dl - 3 * H, dl), 'personal', 'T-3 h: personal');
assert.equal(plan(dl - 1 * H, dl), 'personal', 'T-1 h: personal');
assert.equal(plan(dl - 10 * 60000, dl), 'none', 'closer than 20 min: noise');
assert.equal(plan(dl + 1, dl), 'none', 'after the deadline');
assert.equal(plan(NaN, dl), 'none'); assert.equal(plan(dl, NaN), 'none');
// quiet hours: deadline 23:59 -> T-24 h is 23:59 (quiet) -> waits for 07:00
const late = bkk(2026, 10, 25, 23, 59);
assert.equal(plan(bkk(2026, 10, 24, 23, 59), late), 'none', 'T-24 h at 23:59 is quiet');
assert.equal(plan(bkk(2026, 10, 25, 7, 0), late), 'group', '07:00 sends the group bubble');
// deadline 08:00 -> deadline-3h = 05:00 (quiet) -> personal moves to 21:00 the evening before
const early = bkk(2026, 10, 25, 8, 0);
assert.equal(new Date(D.personalStartMs(early) + 7 * H).toISOString().slice(0, 16), '2026-10-24T21:00', '05:00 moves to 21:00 the day before');
assert.equal(plan(bkk(2026, 10, 24, 20, 0), early), 'group');
assert.equal(plan(bkk(2026, 10, 24, 21, 0), early), 'personal');
assert.equal(plan(bkk(2026, 10, 25, 2, 0), early), 'none', '02:00 is quiet');
assert.equal(plan(bkk(2026, 10, 25, 7, 0), early), 'personal', 'still owed at 07:00 with 1 h left');
// deadline 00:30 -> deadline-3h = 21:30 (not quiet) -> personal at 21:30, never later in the night
const mid = bkk(2026, 10, 26, 0, 30);
assert.equal(new Date(D.personalStartMs(mid) + 7 * H).toISOString().slice(11, 16), '21:30');
// deadline 01:00 -> -3h = 22:00 (quiet) -> 21:00
assert.equal(new Date(D.personalStartMs(bkk(2026, 10, 26, 1, 0)) + 7 * H).toISOString().slice(11, 16), '21:00');
// a quiz that goes live with 2 h left gets the personal bubble only
assert.equal(plan(dl - 2 * H, dl), 'personal');
// sweep every hour of 48 h before a 14:00 deadline: never a push in quiet hours, group never after personal opens
{
    const dd = bkk(2026, 10, 25, 14, 0);
    for (let m = 0; m < 48 * 60; m += 15) {
        const now = dd - m * 60000, p = D.planDeadline(now, dd);
        if (p.group || p.personal) assert.ok(!D.isQuietHour(now), 'no push in quiet hours at ' + new Date(now + 7 * H).toISOString());
        assert.ok(!(p.group && p.personal), 'group and personal are exclusive');
    }
}
assert.notEqual(D.markerId('q1', dl), D.markerId('q1', dl + H), 'a moved deadline re-arms');
assert.equal(D.markerId('q1', dl), D.markerId('q1', dl));

// ---------- 2. Beri line is only the tier that is really on offer ----------
assert.deepEqual(D.beatBeri(dl - 20 * H, dl, null) && D.beatBeri(dl - 20 * H, dl, null).amount, 1, 'default max 5 -> 20 % = 1 inside the last 24 h');
assert.equal(D.beatBeri(dl - 20 * H, dl, null).untilMs, dl - 6 * H, 'the 1 Beri holds until T-6 h');
assert.equal(D.beatBeri(dl - 20 * H, dl, 10).amount, 2);
assert.equal(D.beatBeri(dl - 5 * H, dl, 10), null, 'under 6 h: nothing');
assert.equal(D.beatBeri(dl - 20 * H, dl, 0), null, 'max 0 = off');
assert.equal(D.beatBeri(dl - 20 * H, dl, 2), null, '20 % of 2 rounds to 0');

// ---------- 3. bubbles ----------
const now1 = dl - 20 * H;
const items = [
    { quizId: 'qa', name: 'Asthma 1', deadlineMs: dl, done: 2, total: 6, deadlineBeriMax: null },
    { quizId: 'qb', name: 'ยาต้านเชื้อรา (Antifungal)', deadlineMs: dl + 2 * H, done: 0, total: 6, deadlineBeriMax: 0 }
];
const g = D.buildGroupFlex(items, now1);
assert.deepEqual(D.validateFlex(g), [], 'group bubble valid');
const gText = JSON.stringify(g);
assert.ok(gText.includes('Asthma 1') && gText.includes('ทำแล้ว 2/6') && gText.includes('ทำแล้ว 0/6'), 'rows with done/total');
assert.ok(gText.includes('+1 Beri') && (gText.match(/Beri/g) || []).length === 1, 'Beri line only for the quiz that pays (max 0 -> none)');
assert.ok(!gText.includes('+5 Beri'), 'never promises +5 inside the last 24 h');
assert.equal(g.contents.footer.contents[0].action.uri, 'https://liff.line.me/2008959998-yjcNpaGt?tab=quiz', 'two quizzes -> the quiz tab');
assert.equal(D.buildGroupFlex([items[0]], now1).contents.footer.contents[0].action.uri, 'https://liff.line.me/2008959998-yjcNpaGt?tab=quiz&quiz=qa', 'one quiz -> deep link');
assert.ok(g.altText.length <= 400);
for (const lang of ['en', 'th', 'kr', 'zz']) {
    const p = D.buildPersonalFlex(items, dl - 2 * H, lang);
    assert.deepEqual(D.validateFlex(p), [], 'personal bubble valid in ' + lang);
    assert.ok(!/undefined|NaN/.test(JSON.stringify(p)), 'nothing undefined / NaN in ' + lang);
}
assert.ok(JSON.stringify(D.buildPersonalFlex(items, dl - 2 * H, 'th')).includes('เหลือ 2 ชม.'));
assert.ok(JSON.stringify(D.buildPersonalFlex(items, dl - 2 * H, 'en')).includes('2 h left'));
assert.ok(!/Beri/.test(JSON.stringify(D.buildPersonalFlex(items, dl - 2 * H, 'en'))), 'T-2 h: no Beri promise at all');
{ // many quizzes: capped, "+N more", still valid and small
    const many = Array.from({ length: 12 }, (_, i) => ({ quizId: 'q' + i, name: 'Quiz ' + i + ' ' + 'x'.repeat(60), deadlineMs: dl, done: 1, total: 6, deadlineBeriMax: 5 }));
    const gm = D.buildGroupFlex(many, now1), pm = D.buildPersonalFlex(many, now1, 'en');
    assert.deepEqual([D.validateFlex(gm), D.validateFlex(pm)], [[], []]);
    assert.ok(JSON.stringify(gm).includes('+6 อีก') && JSON.stringify(pm).includes('+9 more'));
}
// the validator really rejects what costs a whole push
const bad = JSON.parse(JSON.stringify(g));
bad.contents.body.contents[0].contents[0].text = '';
bad.contents.footer.contents[0].action.uri = 'http://x';
bad.contents.footer.contents[0].action.label = 'x'.repeat(21);
bad.altText = '';
assert.equal(D.validateFlex(bad).length, 4, JSON.stringify(D.validateFlex(bad)));

// ---------- 4. the runner, REAL code, fake Firestore ----------
const cut = (from, to) => { const a = backend.indexOf(from); assert.ok(a >= 0, 'missing ' + from); const b = backend.indexOf(to, a); assert.ok(b > a, 'missing end ' + to); return backend.slice(a, b); };
const fnSrc = name => cut(`function ${name}(`, '\n}\n') + '\n}\n';
const src = [
    "const NOTIFY_ACTIVE_DAYS = 30;", "const NOTIFY_EXCLUDE_GROUPS = ['staff', 'preceptor'];", "const LINE_LANGS = ['en', 'th', 'kr'];",
    cut('const QUIZ_SUBMITTED_STATUSES', '\n'),
    fnSrc('splitAttemptId'), fnSrc('userLastSeenMs'), fnSrc('activeCohort'), fnSrc('eligibleForQuiz'),
    cut('const DIGEST_NAME_TAIL_RE', '\n'), cut('const DIGEST_COURSE_CODE_RE', '\n'),
    fnSrc('digestQuizName'), fnSrc('digestCleanName'),
    'async function scanQuizPending(' + cut('async function scanQuizPending(', '\n}\n').slice('async function scanQuizPending('.length) + '\n}\n',
    cut('const quizDeadline = require', 'exports.notifyQuizDeadlines = onSchedule(')
].join('\n');

let DB, pushes, failFor, groupTargets;
const sentinel = (kind, v) => ({ __s: kind, v });
const FV = { increment: n => sentinel('inc', n), arrayUnion: (...a) => sentinel('union', a), serverTimestamp: () => sentinel('ts') };
const applySet = (cur, data) => {
    const out = Object.assign({}, cur);
    for (const [k, v] of Object.entries(data)) {
        if (v && v.__s === 'inc') out[k] = (out[k] || 0) + v.v;
        else if (v && v.__s === 'union') out[k] = Array.from(new Set([...(out[k] || []), ...v.v]));
        else if (v && v.__s === 'ts') out[k] = 'TS';
        else out[k] = v;
    }
    return out;
};
const snapOf = docs => ({ docs: docs.map(([id, d]) => ({ id, data: () => d })), forEach(fn) { this.docs.forEach(fn); } });
const fakeDb = {
    collection: name => {
        const col = () => (DB[name] = DB[name] || {});
        const q = { filters: [], where(f, op, v) { this.filters.push([f, op, v]); return this; },
            async get() {
                let rows = Object.entries(col());
                for (const [f, op, v] of this.filters) {
                    if (f === 'DOCID') rows = rows.filter(([id]) => op === '>=' ? id >= v : id < v);
                    else if (op === '==') rows = rows.filter(([, d]) => d[f] === v);
                }
                return snapOf(rows);
            },
            doc: id => ({
                async get() { const d = col()[id]; return { exists: !!d, id, data: () => d }; },
                async set(data, opts) { col()[id] = applySet(opts && opts.merge ? col()[id] || {} : {}, data); }
            })
        };
        return { where: (f, op, v) => Object.assign(Object.create(q), { filters: [] }).where(f, op, v), doc: q.doc, get: () => Object.assign(Object.create(q), { filters: [] }).get() };
    }
};
const context = {
    exports: {}, console: { log() {}, warn() {}, error() {} },
    process: { env: { LINE_CHANNEL_ACCESS_TOKEN: 't' } },
    require: p => { assert.equal(p, './quiz-deadline'); return D; },
    admin: { firestore: Object.assign(() => fakeDb, { FieldValue: FV, FieldPath: { documentId: () => 'DOCID' } }) },
    resolveLineTargets: () => groupTargets,
    pushLineFlex: async (tag, targets, build, suffix) => targets.map(t => {
        const flex = build(t);
        const fail = failFor && failFor(tag, t);
        pushes.push({ tag, to: t.to, flex, ok: !fail });
        return fail ? { target: t.label, ok: false, code: fail } : { target: t.label, ok: true };
    })
};
vm.createContext(context);
vm.runInContext(src + '\nthis.runQuizDeadlines = runQuizDeadlines; this.scanQuizPending = scanQuizPending;', context);
const run = ms => context.runQuizDeadlines(ms);

const NOW = bkk(2026, 10, 25, 12, 0);
const seen = new Date(NOW - 2 * 86400000).toISOString();
const user = (name, extra) => Object.assign({ displayName: name, lastSeen: seen, group: 'Public', preferredLanguage: 'th' }, extra || {});
const fresh = (quizzes, extraUsers) => {
    DB = {
        quizzes: quizzes,
        users: Object.assign({
            U1: user('Ann'), U2: user('Bee', { preferredLanguage: 'en' }), U3: user('Cat'),
            U4: user('Dan', { lineNotifyOptOut: true }), U5: user('Eve', { lastSeen: new Date(NOW - 90 * 86400000).toISOString() }),
            U6: user('Fay', { isIgnored: true }), U7: user('Gus', { group: 'staff' })
        }, extraUsers || {}),
        quiz_attempts: { 'qa_U1': { status: 'completed' }, 'qa_U2': { status: 'in_progress' }, 'qa_U3': { isPractice: true, status: 'completed' } },
        quiz_deadline_alerts: {}, line_usage: {}
    };
    pushes = []; failFor = null; groupTargets = [{ to: 'Cgroup', label: 'group', withScores: false }];
};
const quizAt = (ms, extra) => Object.assign({ isActive: true, title: 'Asthma 1', shortTitle: 'Asthma', deadline: { toMillis: () => ms } }, extra || {});

(async () => {
    // A. T-24 h: one group bubble, no names, done/total from the digest's own cohort rules
    fresh({ qa: quizAt(NOW + 20 * H) });
    let r = await run(NOW);
    assert.equal(pushes.length, 1, 'one push');
    assert.deepEqual([pushes[0].tag, pushes[0].to], ['quizDeadlineGroup', 'Cgroup']);
    const gj = JSON.stringify(pushes[0].flex);
    assert.ok(gj.includes('ทำแล้ว 1/4'), 'cohort = U1-U4 (U5 stale, U6 ignored, U7 staff are out): 1 of 4 done');
    assert.ok(!/Ann|Bee|Cat|Dan/.test(gj), 'the group copy names nobody');
    assert.deepEqual(D.validateFlex(pushes[0].flex), []);
    assert.ok(Object.keys(DB.quiz_deadline_alerts).some(k => k.startsWith('qa_')) && DB.quiz_deadline_alerts[D.markerId('qa', NOW + 20 * H)].groupAt === 'TS', 'marker written after the push');
    // idempotent: the next hour does not repeat it
    pushes = []; await run(NOW + H); assert.equal(pushes.length, 0, 'same deadline, same marker: nothing repeats');
    // deadline moved -> re-armed
    DB.quizzes.qa = quizAt(NOW + 21 * H); await run(NOW + H); assert.equal(pushes.length, 1, 'moved deadline re-arms'); pushes = [];

    // B. group skipped: opt-out, poll, no deadline, > 24 h, everyone done
    fresh({ qa: quizAt(NOW + 20 * H, { notifyDeadline: false }), qb: quizAt(NOW + 20 * H, { isPoll: true }), qc: { isActive: true, title: 'x' }, qd: quizAt(NOW + 30 * H), qe: quizAt(NOW + 20 * H) });
    DB.users = { U1: user('Ann') }; DB.quiz_attempts = { 'qe_U1': { status: 'approved' } };
    await run(NOW); assert.equal(pushes.length, 0, 'opt-out / poll / no deadline / >24 h / all done: silent');

    // C. T-3 h: personal bubbles only to interns who have NOT submitted; opted-out and out-of-cohort never
    fresh({ qa: quizAt(NOW + 2 * H) });
    r = await run(NOW);
    const to = pushes.map(p => p.to).sort();
    assert.deepEqual(to, ['U2', 'U3'], 'U1 submitted; U4 opted out; U5 stale; U6 ignored; U7 staff -> got ' + to);
    assert.ok(pushes.every(p => p.tag === 'quizDeadlineDM'), 'personal tag');
    assert.ok(JSON.stringify(pushes.find(p => p.to === 'U2').flex).includes('2 h left'), 'U2 reads English');
    assert.ok(JSON.stringify(pushes.find(p => p.to === 'U3').flex).includes('เหลือ 2 ชม.'), 'U3 reads Thai');
    assert.ok(!/Beri/.test(JSON.stringify(pushes.map(p => p.flex))), 'no Beri promise at T-2 h');
    assert.deepEqual(DB.quiz_deadline_alerts[D.markerId('qa', NOW + 2 * H)].personalSent.sort(), ['U2', 'U3']);
    assert.equal(DB.quiz_deadline_alerts['_cap_2026-10-25'].personal, 2, 'daily counter');
    pushes = []; await run(NOW + 1000); assert.equal(pushes.length, 0, 'second run: nobody is nagged twice');
    // a late submitter drops out before the next window
    // D. one bubble per user across several quizzes
    fresh({ qa: quizAt(NOW + 2 * H), qb: quizAt(NOW + 1 * H, { title: 'Second', shortTitle: 'Second' }) });
    DB.quiz_attempts = {};
    await run(NOW);
    assert.equal(pushes.filter(p => p.to === 'U3').length, 1, 'U3 gets ONE bubble for both quizzes');
    assert.ok(/Second/.test(JSON.stringify(pushes.find(p => p.to === 'U3').flex)) && /Asthma/.test(JSON.stringify(pushes.find(p => p.to === 'U3').flex)));

    // E. transient failure retries next hour; permanent failure does not
    fresh({ qa: quizAt(NOW + 2 * H) });
    failFor = (tag, t) => (t.to === 'U2' ? 'transient' : (t.to === 'U3' ? 'no-friend' : null));
    await run(NOW);
    let mk = DB.quiz_deadline_alerts[D.markerId('qa', NOW + 2 * H)];
    assert.deepEqual(mk.personalSent, ['U3'], 'U3 (not a friend) is final; U2 (transient) is not marked');
    pushes = []; failFor = null; await run(NOW + H);
    assert.deepEqual(pushes.map(p => p.to), ['U2'], 'only the transient failure is retried');
    // group push failing leaves no marker
    fresh({ qa: quizAt(NOW + 20 * H) }); failFor = () => 'transient'; await run(NOW);
    assert.equal(Object.keys(DB.quiz_deadline_alerts).length, 0, 'failed group push: no marker, retried next hour');

    // F. daily cap + critical quota
    const crowd = {}; for (let i = 0; i < 20; i++) crowd['U1' + String(i).padStart(2, '0')] = user('N' + i);
    fresh({ qa: quizAt(NOW + 2 * H) }, crowd);
    await run(NOW);
    assert.equal(pushes.length, 15, 'hard cap of 15 personal pushes per day, got ' + pushes.length);
    pushes = []; await run(NOW + H); assert.equal(pushes.length, 0, 'cap is per day: nothing more today');
    pushes = []; DB.quizzes.qz = quizAt(NOW + 23 * H); await run(NOW + 21 * H);   // 09:00 next Bangkok day, a quiz closing 11:00
    assert.ok(pushes.length > 0 && pushes.length <= 15, 'a new day opens a new allowance');
    fresh({ qa: quizAt(NOW + 2 * H) }); DB.line_usage['2026-10'] = { total: 270 };
    await run(NOW); assert.equal(pushes.length, 0, 'quota 270/300: personal pushes skipped');
    fresh({ qa: quizAt(NOW + 20 * H) }); DB.line_usage['2026-10'] = { total: 270 };
    await run(NOW); assert.equal(pushes.length, 1, 'quota critical still lets the single group bubble through');
    fresh({ qa: quizAt(NOW + 20 * H) }); DB.line_usage['2026-10'] = { total: 300 };
    await run(NOW); assert.equal(pushes.length, 0, 'quota exhausted: nothing');

    // G. quiet hours and config
    fresh({ qa: quizAt(bkk(2026, 10, 25, 23, 40)) }); await run(bkk(2026, 10, 25, 23, 0)); assert.equal(pushes.length, 0, 'quiet hours: silent');
    await run(bkk(2026, 10, 25, 23, 0) + 8 * H); // 07:00 next day: the deadline already passed
    assert.equal(pushes.length, 0, 'a missed window is not replayed after the deadline');
    fresh({ qa: quizAt(NOW + 20 * H) }); groupTargets = []; await run(NOW); assert.equal(pushes.length, 0, 'no group configured: no-op, no marker');
    assert.equal(Object.keys(DB.quiz_deadline_alerts).length, 0);
    fresh({ qa: quizAt(NOW + 20 * H) }); context.process.env = {}; r = await run(NOW); assert.equal(pushes.length, 0); assert.equal(r.reason, 'token-missing');

    // H. the digest still sees the same pending list through the shared helper
    context.process.env = { LINE_CHANNEL_ACCESS_TOKEN: 't' };
    fresh({ qa: quizAt(NOW + 2 * H) });
    const act = [{ id: 'U1', group: 'Public' }, { id: 'U2', group: 'Public' }, { id: 'U3', group: 'Public' }];
    const sc = await context.scanQuizPending(fakeDb, 'qa', DB.quizzes.qa, act);
    assert.deepEqual([Array.from(sc.doneIds), sc.missing.map(u => u.id)], [['U1'], ['U2', 'U3']], 'in_progress and practice attempts do not count as done');
    assert.ok(backend.includes('const scan = await scanQuizPending(db, qDoc.id, q, activeUsers);'), 'runQuizDigest calls the shared helper');
    assert.ok(!/const missing = eligible\.filter\(u => !doneIds/.test(backend), 'the digest no longer carries its own copy of the scan');

    // I. wiring pins
    assert.ok(/exports\.notifyQuizDeadlines = onSchedule\(\{\s*schedule: '0 \* \* \* \*',\s*timeZone: 'Asia\/Bangkok'/.test(backend), 'hourly, Bangkok');
    assert.ok(/exports\.notifyQuizDeadlines[\s\S]*?secrets: \['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID', 'ADMIN_LINE_GROUP_ID'\]/.test(backend), 'secrets declared');
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.ok(/match \/quiz_deadline_alerts\/\{id\} \{\s*allow read: if isAdmin\(\);\s*allow write: if false;\s*\}/.test(rules), 'rules: admin read, no client write');
    console.log('PASS quiz-deadline-check');
})().catch(e => { console.error(e); process.exit(1); });
