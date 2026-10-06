// V102.97: a ONE-TIME practice attempt keeps its answers in `practiceAnswers`; the doc also carries the all-null `answers` array
// written at run start. The admin Review modal / scoring / PDF used `att.answers || att.practiceAnswers` and so showed "(no answer)"
// and 0 pts beside a "26/30 (P)" score. Runs the REAL helpers from public/admin.html.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');
function grab(marker) {
  const i = html.indexOf(marker); assert(i > -1, 'missing ' + marker);
  let d = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) return html.slice(i, j + 1); }
  throw new Error('unbalanced ' + marker);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(['function scorePartialMultiChoice(', 'function parseStoredChoiceAnswer(', 'function choiceAnswerMatches(', 'function quizAttemptAnswers(', 'function calculateAttemptScoring('].map(grab).join('\n'), ctx);

const quiz = { totalPoints: 1.0, questions: Array.from({ length: 5 }, (_, i) => ({ type: 'choice', correct: i % 3 })) };   // correct = 0,1,2,0,1
const right = [0, 1, 2, 0, 1];
const nulls = [null, null, null, null, null];

// practice run: real answers empty (all null), practice answers filled
const practice = { status: 'practice_done', answers: nulls, practiceAnswers: [0, 1, 2, 0, 0], practiceScore: 4, practiceTotalQ: 5 };
assert.deepEqual(Array.from(ctx.quizAttemptAnswers(practice)), [0, 1, 2, 0, 0], 'practice answers are used when there are no real ones');
assert.equal(ctx.calculateAttemptScoring(practice, quiz).correctCount, 4, 'scoring reads the practice answers (was 0)');

// ordinary graded attempt: answers win, practiceAnswers ignored
const graded = { status: 'pending', answers: right, practiceAnswers: [9, 9, 9, 9, 9] };
assert.deepEqual(Array.from(ctx.quizAttemptAnswers(graded)), right);
assert.equal(ctx.calculateAttemptScoring(graded, quiz).correctCount, 5);

// real exam after a practice run (practice fields kept, real answers present): real answers win
const both = { status: 'approved', answers: [0, 1, 2, 0, 1], practiceAnswers: [1, 1, 1, 1, 1] };
assert.equal(ctx.calculateAttemptScoring(both, quiz).correctCount, 5);

// empty / missing shapes never throw
assert.deepEqual(Array.from(ctx.quizAttemptAnswers({})), []);
assert.deepEqual(Array.from(ctx.quizAttemptAnswers({ answers: nulls })), nulls, 'nothing practiced → the (null) real answers, as before');
assert.deepEqual(Array.from(ctx.quizAttemptAnswers(null)), []);
assert.equal(ctx.calculateAttemptScoring({ answers: nulls }, quiz).correctCount, 0);

// the review modal, PDF export and per-question AI check all go through the helper; no reader of the broken pattern is left
const code = html.split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join(' ');   // the explanation comment quotes the old pattern
assert.equal((code.match(/att\.answers \|\| att\.practiceAnswers/g) || []).length, 0, 'no `att.answers || att.practiceAnswers` left');
assert((html.match(/quizAttemptAnswers\(att\)/g) || []).length >= 4, 'review, PDF, AI check and scoring use the helper');
console.log('PASS: practice attempts show their practice answers in review / scoring (admin V102.97)');
