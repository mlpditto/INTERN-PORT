// V101.96: admin re-scoring of multi-answer choice questions. The intern app stores a multi-select
// answer joined ("0\n---\n2"); seven admin paths compared that raw value and scored a correct
// multi-answer attempt as wrong (Approve / Mark correct / score edit / review / analytics).
// Runs the real helpers sliced from admin.html.
const fs = require('fs');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const start = html.indexOf('        function scorePartialMultiChoice(');
const end = html.indexOf('\n        }\n', html.indexOf('        function calculateAttemptScoring(')) + 11;
if (start < 0 || end < start) throw new Error('scoring helpers not found in admin.html');
const window = {};
const api = new Function('window', html.slice(start, end) + '\nreturn { choiceAnswerMatches, calculateAttemptScoring };')(window);

const checks = [];
const check = (name, got, want) => checks.push([name, JSON.stringify(got), JSON.stringify(want)]);
const joined = a => a.join('\n---\n');

check('single: index number', api.choiceAnswerMatches([2], 2), true);
check('single: index as string', api.choiceAnswerMatches([2], '2'), true);
check('single: wrong', api.choiceAnswerMatches([2], 1), false);
check('single: scalar target', api.choiceAnswerMatches(2, 2), true);
check('multi: stored joined, correct', api.choiceAnswerMatches([0, 2], joined([0, 2])), true);
check('multi: stored joined, other order', api.choiceAnswerMatches([0, 2], joined([2, 0])), true);
check('multi: array, correct', api.choiceAnswerMatches([0, 2], [0, 2]), true);
check('multi: one missing', api.choiceAnswerMatches([0, 2], joined([0])), false);
check('multi: one extra', api.choiceAnswerMatches([0, 2], joined([0, 2, 3])), false);
check('no answer', api.choiceAnswerMatches([0], ''), false);
check('no answer (undefined)', api.choiceAnswerMatches([0], undefined), false);
check('empty target never matches', api.choiceAnswerMatches([], ''), false);
check('window export for the second script block', typeof window.choiceAnswerMatches, 'function');

const quiz = { totalPoints: 3, questions: [
    { type: 'choice', correct: [1] },
    { type: 'choice', correct: [0, 2] },
    { type: 'choice', correct: [1, 3] }
] };
const att = { answers: [1, joined([0, 2]), joined([1])] };
const all = api.calculateAttemptScoring(att, quiz);
check('attempt: single + correct multi count, wrong multi does not', all.correctCount, 2);
check('attempt: score = 2 of 3 points', all.score, 2);
const partial = api.calculateAttemptScoring(att, { ...quiz, partialCredit: true });
check('partialCredit path unchanged: 1 + 1 + 0.5', partial.score, 2.5);

let failed = 0;
for (const [name, got, want] of checks) {
    const ok = got === want;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${got}${ok ? '' : ' want=' + want}`);
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
