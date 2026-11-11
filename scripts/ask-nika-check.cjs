// V101.263: askNika on a fake Firestore. Who may ask, the daily count (a busy service does not cost one), the quiz pause and its time limit, no guessing,
// cited sources only, and the log never holds who asked.
const assert = require('node:assert/strict'), fs = require('node:fs');
const N = require('../functions/nika-ask.js');

class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const NOW = Date.parse('2026-11-03T12:00:00+07:00'), H = 3600000, DAY = '2026-11-03';
const ts = ms => ({ toMillis: () => ms });
let DB, posted, reply;
const FV = { increment: n => ({ __inc: n }), serverTimestamp: () => 'TS' };
const setDoc = (name, id, data, merge) => {
    DB[name] = DB[name] || {};
    const cur = merge ? DB[name][id] || {} : {}, out = { ...cur };
    for (const [k, v] of Object.entries(data)) out[k] = v && v.__inc != null ? (cur[k] || 0) + v.__inc : v;
    DB[name][id] = out;
};
const ref = (name, id) => ({
    name, id,
    get: async () => { const d = (DB[name] || {})[id]; return { exists: !!d, data: () => d }; },
    set: async (data, opts) => setDoc(name, id, data, opts && opts.merge)
});
const query = (name, filters) => ({
    where: (f, op, v) => query(name, [...filters, [f, v]]),
    get: async () => ({ docs: Object.entries(DB[name] || {}).filter(([, d]) => filters.every(([f, v]) => d[f] === v)).map(([id, d]) => ({ id, data: () => d })) })
});
const db = {
    collection: name => ({
        doc: id => ref(name, id),
        where: (f, op, v) => query(name, [[f, v]]),
        add: async data => setDoc(name, 'auto' + Object.keys(DB[name] || {}).length, data)
    }),
    runTransaction: fn => fn({ get: r => r.get(), set: (r, d, o) => setDoc(r.name, r.id, d, o && o.merge) })
};
const deps = { db, FieldValue: FV, HttpsError, isAdmin: t => t && t.admin === true, dayKey: DAY, now: NOW, token: async () => 'tok', post: async (u, b, t) => { posted.push({ u, b, t }); if (reply instanceof Error) throw reply; return reply; } };
const ask = (data, auth = { uid: 'anon1', token: {} }) => N.handle({ auth, data }, deps);
const ok = (text = '* Monitor BP') => ({ answer: { state: 'SUCCEEDED', answerText: text, citations: [{ sources: [{ referenceId: '1' }, { referenceId: '0' }, { referenceId: '1' }] }], references: [
    { chunkInfo: { documentMetadata: { title: 'Amlodipine', structData: { kind: 'drug', sourceId: 'd1', title: 'Amlodipine', section: 'Monitoring' } } } },
    { chunkInfo: { documentMetadata: { title: 'HTN', structData: { kind: 'disease', sourceId: 'x1', title: 'Hypertension' } } } },
    { chunkInfo: { documentMetadata: { structData: { kind: 'drug', sourceId: 'unused', title: 'Not cited' } } } }] } });
const fresh = () => { DB = { user_auth_links: { anon1: { effectiveUserId: 'U1' } }, users: { U1: { displayName: 'Ann' } }, quiz_attempts: {} }; posted = []; reply = ok(); };

(async () => {
    // who may ask
    fresh();
    await assert.rejects(N.handle({ data: { question: 'abc' } }, deps), e => e.code === 'unauthenticated');
    await assert.rejects(ask({ question: 'abc' }, { uid: 'nobody', token: {} }), e => e.code === 'permission-denied', 'no LIFF link');
    DB.user_auth_links.ghost = { effectiveUserId: 'U9' };
    await assert.rejects(ask({ question: 'abc' }, { uid: 'ghost', token: {} }), e => e.code === 'permission-denied', 'a link to no user');
    assert.equal(posted.length, 0, 'nothing reached the paid API');
    await assert.rejects(ask({ question: 'a' }), e => e.code === 'invalid-argument');
    await assert.rejects(ask({ question: 'x'.repeat(N.MAX_Q + 1) }), e => e.code === 'invalid-argument');

    // an answer: only what was cited, one chip per entry, the count goes down, intern documents only
    let r = await ask({ question: 'What to monitor?' });
    assert.deepEqual(r.sources.map(s => s.id), ['x1', 'd1']);
    assert.equal(r.left, N.DAILY - 1);
    assert.equal(posted[0].t, 'tok');
    assert.match(posted[0].b.searchSpec.searchParams.filter, /audience: ANY\("intern"\)/);
    assert.match(posted[0].b.answerGenerationSpec.promptSpec.preamble, /NOT_IN_LIBRARY/);
    assert.equal(DB.nika_usage['U1_' + DAY].count, 1);

    // the log has the question and no one's name on it
    const log = Object.values(DB.nika_questions)[0];
    assert.deepEqual(Object.keys(log).sort(), ['at', 'notFound', 'question', 'sources']);
    assert.ok(!JSON.stringify(DB.nika_questions).includes('U1') && !JSON.stringify(DB.nika_questions).includes('anon1'));

    // no guessing
    // the lead-in goes; a sentence that merely mentions a source stays
    { const said = t => N.parseAnswer({ answer: { answerText: t, citations: [{ sources: [{ referenceId: '0' }] }], references: [{ chunkInfo: { documentMetadata: { structData: { kind: 'drug', sourceId: 'd1', title: 'T' } } } }] } }).answer;
      assert.equal(said('Based on the provided sources, warfarin needs INR checks.'), 'Warfarin needs INR checks.');
      assert.equal(said('According to the sources: • one'), '• one');
      assert.equal(said('Based on the provided sources, here is what they say:\n• one\n• two'), '• one\n• two');
      assert.equal(said('จากแหล่งข้อมูลที่ให้มา ยานี้ใช้ได้, ระวังไต'), 'ระวังไต');
      assert.equal(said('Warfarin, based on the sources, needs INR checks.'), 'Warfarin, based on the sources, needs INR checks.'); }
    assert.match(N.requestBody('q').answerGenerationSpec.promptSpec.preamble, /never mention the sources/);
    // V101.306 asked from an article: that article only; a bad id is ignored, never pasted into the filter
    assert.equal(N.requestBody('q', 'Ab_1-x').searchSpec.searchParams.filter, 'audience: ANY("intern") AND kind: ANY("article") AND sourceId: ANY("Ab_1-x")');
    assert.equal(N.requestBody('q', 'x") OR audience: ANY("admin').searchSpec.searchParams.filter, 'audience: ANY("intern")');
    // V101.308: the language chip — a known code names the language, anything else keeps "the language of the question"
    assert.match(N.requestBody('q', null, 'th').answerGenerationSpec.promptSpec.preamble, /^Answer in Thai\. /);
    assert.match(N.requestBody('q', null, 'ko').answerGenerationSpec.promptSpec.preamble, /^Answer in Korean\. /);
    assert.match(N.requestBody('q', null, 'xx').answerGenerationSpec.promptSpec.preamble, /^Answer in the language of the question\./);
    assert.match(N.requestBody('q', null, '__proto__').answerGenerationSpec.promptSpec.preamble, /^Answer in the language of the question\./);
    for (const none of [{ answer: { answerText: 'NOT_IN_LIBRARY' } }, { answer: { answerText: '' } }, { answer: { answerText: 'x', answerSkippedReasons: ['OUT_OF_DOMAIN_QUERY_IGNORED'] } }, { answer: { answerText: 'Unsourced claim', references: [] } }]) {
        assert.equal(N.parseAnswer(none).notFound, true, JSON.stringify(none));
    }
    reply = { answer: { answerText: 'NOT_IN_LIBRARY' } };
    r = await ask({ question: 'Dose of zzq?' });
    assert.equal(r.notFound, true); assert.equal(r.left, N.DAILY - 2, 'a real search still counts');
    assert.equal(Object.values(DB.nika_questions)[1].notFound, true);
    { const n0 = posted.length; await ask({ question: 'Summarize it', articleId: 'Art9' });
      assert.match(posted[n0].b.searchSpec.searchParams.filter, /sourceId: ANY\("Art9"\)/);
      assert.ok(Object.values(DB.nika_questions).some(l => l.articleId === 'Art9' && l.question === 'Summarize it'), 'the log keeps which article'); }

    // busy: not counted, nothing logged
    fresh();
    reply = Object.assign(new Error('quota'), { response: { status: 429 } });
    r = await ask({ question: 'What to monitor?' });
    assert.equal(r.busy, true); assert.equal(r.left, N.DAILY);
    assert.equal(DB.nika_usage['U1_' + DAY].count, 0, 'refunded');
    assert.equal(DB.nika_questions, undefined);

    // the limit, enforced before the paid call
    fresh();
    DB.nika_usage = { ['U1_' + DAY]: { count: N.DAILY } };
    r = await ask({ question: 'What to monitor?' });
    assert.equal(r.limit, true); assert.equal(posted.length, 0);
    assert.deepEqual(await ask({ peek: true }), { left: 0, paused: false });
    DB.nika_usage['U1_2026-11-02'] = { count: N.DAILY };
    delete DB.nika_usage['U1_' + DAY];
    assert.equal((await ask({ peek: true })).left, N.DAILY, 'a new day');

    // paused while a quiz is open, even if the page is bypassed
    fresh();
    DB.quiz_attempts.q1_U1 = { userId: 'U1', status: 'started', startTime: ts(NOW - H) };
    r = await ask({ question: 'What to monitor?' });
    assert.deepEqual(r, { paused: true }); assert.equal(posted.length, 0);
    assert.equal(DB.nika_usage, undefined, 'a pause costs nothing');
    assert.equal((await ask({ peek: true })).paused, true);
    // not by practice, someone else's quiz, a finished one, or one left open long ago
    for (const a of [{ userId: 'U1', status: 'started', isPractice: true, startTime: ts(NOW - H) }, { userId: 'U2', status: 'started', startTime: ts(NOW - H) }, { userId: 'U1', status: 'completed', startTime: ts(NOW - H) }, { userId: 'U1', status: 'started', startTime: ts(NOW - N.QUIZ_LOCK_MS - 1) }]) {
        fresh(); DB.quiz_attempts.q1_U1 = a;
        assert.equal((await ask({ peek: true })).paused, false, JSON.stringify(a));
    }

    // V102.612: the 3 h counts from the last activity, so a quiz resumed after a long break locks again
    fresh(); DB.quiz_attempts.q1_U1 = { userId: 'U1', quizId: 'q1', status: 'started', startTime: ts(NOW - 5 * H), lastActive: ts(NOW - H) };
    assert.equal((await ask({ peek: true })).paused, true, 'active an hour ago');
    // ⏸ on a break: locked until the deadline; no deadline → 24 h after the break began; never past 7 days
    const brk = (pausedAgo, dueIn) => { fresh(); DB.quiz_attempts.q1_U1 = { userId: 'U1', quizId: 'q1', status: 'started', startTime: ts(NOW - pausedAgo - H), pausedAt: ts(NOW - pausedAgo) }; if (dueIn != null) DB.quizzes = { q1: { deadline: ts(NOW + dueIn) } }; return ask({ peek: true }).then(r => r.paused); };
    assert.equal(await brk(5 * H, H), true, 'break 5 h, deadline in 1 h');
    assert.equal(await brk(5 * H, -60000), false, 'deadline passed');
    assert.equal(await brk(23 * H), true, 'no deadline, 23 h');
    assert.equal(await brk(25 * H), false, 'no deadline, 25 h');
    assert.equal(await brk(8 * 24 * H, 10 * 24 * H), false, 'never past 7 days');
    fresh(); DB.quiz_attempts.q1_U1 = { userId: 'U1', quizId: 'q1', status: 'started', isPractice: true, pausedAt: ts(NOW - H) };
    assert.equal((await ask({ peek: true })).paused, false, 'practice never locks');

    // an admin can try it without a LINE link
    fresh();
    r = await ask({ question: 'What to monitor?' }, { uid: 'adm', token: { admin: true } });
    assert.equal(r.left, N.DAILY - 1);

    // the rules keep both collections closed to the client
    const rules = fs.readFileSync('firestore.rules', 'utf8').replace(/\r\n/g, '\n');
    for (const c of ['nika_usage/{usageId}', 'nika_questions/{questionId}']) assert.ok(new RegExp('match /' + c.replace(/[{}/]/g, '\\$&') + ' \\{\\n\\s+allow read: if isAdmin\\(\\);\\n\\s+allow write: if false;').test(rules), c);

    console.log('PASS ask-nika-check');
})().catch(e => { console.error(e); process.exit(1); });
