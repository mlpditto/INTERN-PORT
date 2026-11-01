// V102.561: Jev check against other quizzes. Pairs need a rare shared word, a common one does not count, the list is capped, only "same fact" is shown; skipped questions are listed.
const assert = require('node:assert/strict');
const J = require('../functions/jev-quiz-check.js');
const q = (t, o) => ({ q: t, options: o || ['one', 'two'], correct: [0], explanation: 'because' });
const others = [{ id: 'B', title: 'Eye 2', questions: [q('Latanoprost mechanism uveoscleral'), q('Timolol asthma warning')] }, { id: 'C', title: 'Heart', questions: [q('Amlodipine edema')] }];
let c = J.repeatCandidates([q('Which latanoprost mechanism applies')], others);
assert.deepEqual(c.map(x => [x.quizId, x.otherQ]), [['B', 0]], 'shares a rare word with one question only');
assert.deepEqual(J.repeatCandidates([q('Warfarin bleeding risk', ['one', 'two'])], others), [], 'nothing shared, nothing asked');
const many = Array.from({ length: 20 }, (_, i) => q('Pharmacist counselling ' + i, ['one', 'two']));
assert.deepEqual(J.repeatCandidates([q('Pharmacist role', ['one', 'two'])], [{ id: 'X', title: 'X', questions: many }]), [], 'a word in over 12 questions says nothing');
const wide = Array.from({ length: 30 }, (_, i) => q('Zidovudine detail' + i + ' ' + 'word' + i + 'xxxx', ['one', 'two']));
assert.ok(J.repeatCandidates(wide, [{ id: 'X', title: 'X', questions: wide.slice(0, 10) }]).length <= 60, 'capped at 60 pairs');
assert.equal(J.repeatCandidates(wide.slice(0, 1), [{ id: 'X', title: 'X', questions: wide.slice(0, 10) }]).length <= 3, true, 'three per question');
(async () => {
    const r = await J.findRepeats([q('Which latanoprost mechanism applies')], others, async pairs => { assert.equal(pairs[0].b.quiz, 'Eye 2'); assert.ok(pairs[0].a.stem && pairs[0].b.options); return { results: [{ sameFact: 0.914, verdict: 'dup' }] }; });
    assert.deepEqual(r.repeats.map(x => [x.q, x.quizId, x.otherQ, x.score, x.title]), [[0, 'B', 0, 0.91, 'Eye 2']]);
    assert.equal(r.compared, 1);
    assert.deepEqual((await J.findRepeats([q('Which latanoprost mechanism applies')], others, async () => ({ results: [{ sameFact: 0.5, verdict: 'unsure' }] }))).repeats, [], 'unsure is not shown');
    const plan = J.planCheck({ questions: [{ q: 'a', options: ['x', 'y'], correct: [0] }, { q: 'b', options: ['x', 'y'], correct: [0], explanation: 'e' }, { q: 'c', options: ['x', 'y'], correct: [0] }] });
    assert.deepEqual(plan.unchecked, [0, 2]); assert.equal(plan.noExplanation, 2);
    console.log('PASS jev-repeats');
})().catch(e => { console.error(e); process.exit(1); });
