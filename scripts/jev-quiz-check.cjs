// V102.552: Jev's quiz check with a fake Jev: what is asked, what is skipped, the thresholds, a stale translation found without AI, the cache, and one failed call not costing the rest.
const assert = require('node:assert/strict'), fs = require('node:fs');
const J = require('../functions/jev-quiz-check.js');

const q = (n, extra) => ({ q: 'Question ' + n, options: ['A' + n, 'B' + n, 'C' + n], correct: [1], explanation: 'Because B' + n, ...extra });
const answer = noul => ({ ok: true, status: 200, json: async () => ({ answers: { key_fits: { noul }, same_meaning: { noul } }, usage: { input_tokens: 10 } }) });
const run = async (quiz, score, cacheIn = {}) => {
    const asked = [], written = [];
    const fetch = async (u, o) => { const b = JSON.parse(o.body); asked.push(b.state); const s = score(b.state); return s == null ? { ok: false, status: 500 } : answer(s); };
    const out = await J.checkQuiz(quiz, { apiKey: 'k', provider: 'jev', fetch, readCache: async () => cacheIn, writeCache: async e => written.push(...e) });
    return { out, asked, written };
};

(async () => {
    assert.deepEqual([0.34, 0.35, 0.69, 0.7, null].map(J.verdictOf), ['bad', 'look', 'look', 'ok', 'unsure']);

    // the marked answer goes as text, multi-answer joined; no explanation or no key is not asked
    let r = await run({ questions: [q(1), q(2, { explanation: '' }), q(3, { correct: [0, 2] }), { q: 'open', type: 'short_answer', correct: [] }] }, () => 0.9);
    assert.equal(r.asked.length, 2);
    assert.equal(r.asked[0].marked_answer, 'B1');
    assert.equal(r.asked[1].marked_answer, 'A3 + C3');
    assert.deepEqual(r.out.flags, [], 'a clean quiz has nothing to show');
    assert.equal(r.out.noExplanation, 1);
    assert.equal(r.out.checked, 2);

    // a wrong key comes first, then the doubtful
    r = await run({ questions: [q(1), q(2), q(3)] }, s => (s.marked_answer === 'B3' ? 0.05 : s.marked_answer === 'B1' ? 0.5 : 0.95));
    assert.deepEqual(r.out.flags.map(f => [f.q, f.verdict, f.score]), [[2, 'bad', 0.05], [0, 'look', 0.5]]);

    // translations: fewer questions, or a changed source, are found without asking; a current one is asked
    const quiz = { questions: [q(1), q(2)], translations: {
        th: { questions: [{ q: 'ข้อ 1', options: ['ก', 'ข', 'ค'], src: J.srcSig(q(1)) }, { q: 'ข้อ 2', options: ['ก', 'ข', 'ค'], src: 'old' }] },
        ko: { questions: [{ q: 'one' }] } } };
    r = await run(quiz, s => (s.translation ? 0.1 : 0.9));
    assert.equal(r.asked.filter(s => s.translation).length, 1, 'only the current Thai line');
    assert.deepEqual(r.out.flags.map(f => [f.kind, f.lang, f.q]), [['stale', 'ko', null], ['lang', 'th', 0], ['stale', 'th', 1]]);
    assert.deepEqual(r.out.langs, ['th', 'ko'], 'V102.619: the languages the quiz has (matrix columns)');
    assert.deepEqual((await run({ questions: [q(1)] }, () => 0.9)).out.langs, [], 'no translations → no language columns');

    // the same text is not paid for twice
    const first = await run({ questions: [q(1)] }, () => 0.9);
    assert.equal(first.written.length, 1);
    const again = await run({ questions: [q(1)] }, () => { throw new Error('should not ask'); }, { [first.written[0].key]: 0.2 });
    assert.equal(again.asked.length, 0); assert.equal(again.out.flags[0].verdict, 'bad');

    // one failure does not lose the rest and is reported
    r = await run({ questions: [q(1), q(2)] }, s => (s.marked_answer === 'B1' ? null : 0.1));
    assert.equal(r.out.errors, 1); assert.equal(r.out.checked, 1); assert.equal(r.out.flags.length, 1);

    // answers and patient data stay off: the check only reads the quiz, and nothing writes to it
    const src = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
    const fn = src.slice(src.indexOf('exports.jevCheckQuiz'), src.indexOf('// ---- Jev: "same fact?"'));
    assert.ok(fn.includes('requireAdminCallable(request)'), 'admin only');
    assert.ok(fn.includes('enabled === false'), 'shares the kill switch');
    assert.ok(fn.includes('Array.isArray(onScreen)') && fn.includes('.slice(0, 200)'), 'V102.557: checks the questions on screen, capped');
    assert.ok(/if \(!quizId && !shown\) throw/.test(fn) && /let quiz = \{ questions: shown \};\s*if \(quizId\)/.test(fn), 'V102.619: no quizId → the questions on screen only (never saved yet)');
    assert.ok(!/collection\("quizzes"\)[^;]*\.(set|update)\(/.test(fn), 'never writes to the quiz');
    const admin = fs.readFileSync('public/admin.html', 'utf8');
    assert.ok(/function qtSrcSig[\s\S]{0,260}join\('\\u0001'\)/.test(admin) && fs.readFileSync('functions/jev-quiz-check.js', 'utf8').includes("join('\\u0001')"), 'same signature as the page');
    console.log('PASS jev-quiz-check');
})().catch(e => { console.error(e); process.exit(1); });
