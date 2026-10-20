// V102.340: the pending-quiz table recounted choice answers with a raw compare, so a correct TWO-answer question
// (stored joined, e.g. "0\n---\n2") counted as wrong — the row said 14/15 and "Approve (1.40 pts)" while the
// attempt held correctCount 15 and Review showed every question correct. Runs the REAL renderPendingQuizzes.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');
function grab(marker) {
  const i = html.indexOf(marker); assert(i > -1, 'missing ' + marker);
  let d = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) return html.slice(i, j + 1); }
  throw new Error('unbalanced ' + marker);
}

const tbody = { innerHTML: '' };
const el = () => ({ style: {}, innerText: '' });
const ctx = {
  console, window: {},
  document: { querySelector: () => tbody, getElementById: el },
  updateReviewQueueEmptyState() {}, drawKanban() {}, attemptScoreMultiplier: () => 1,
  quizForAttempt: (q) => q, quizzesData: [], usersData: [], pendingQuizzesCache: []
};
vm.createContext(ctx);
vm.runInContext(['function parseStoredChoiceAnswer(', 'function choiceAnswerMatches(', 'function renderPendingQuizzes('].map(grab).join('\n'), ctx);

// 15 questions like PRETEST-1.3: Q13 is "Choose TWO" with correct [0, 2]
const questions = Array.from({ length: 15 }, () => ({ type: 'choice', correct: [1] }));
questions[12] = { type: 'choice', correct: [0, 2] };
ctx.quizzesData.push({ id: 'q1', title: 'PRETEST-1.3', totalPoints: 1.5, questions });

function row(answers) {
  tbody.innerHTML = '';
  ctx.renderPendingQuizzes([{ id: 'a1', quizId: 'q1', userId: 'u1', displayName: 'Bew', status: 'pending', correctCount: 15, totalQuestions: 15, answers }]);
  return tbody.innerHTML;
}
const all = Array(15).fill(1);

// joined multi-answer (how index.html stores it) → full marks
const good = all.slice(); good[12] = '0\n---\n2';
let h = row(good);
assert(h.includes('<td>15/15</td>'), 'joined multi-answer counts as correct: ' + (h.match(/<td>\d+\/\d+<\/td>/) || [])[0]);
assert(h.includes('Approve (1.50 pts)'), 'approve button awards full points');

// order of picks does not matter
const rev = all.slice(); rev[12] = '2\n---\n0';
assert(row(rev).includes('<td>15/15</td>'), 'picks in any order still match');

// an array answer still works
const arr = all.slice(); arr[12] = [0, 2];
assert(row(arr).includes('<td>15/15</td>'), 'array answer still matches');

// wrong or partial multi-answer is still wrong
const half = all.slice(); half[12] = '0';
assert(row(half).includes('<td>14/15</td>'), 'one of two picks is not correct');
const extra = all.slice(); extra[12] = '0\n---\n1\n---\n2';
assert(row(extra).includes('<td>14/15</td>'), 'an extra wrong pick is not correct');

// single answers unchanged, including a missing one
const miss = all.slice(); miss[12] = '0\n---\n2'; miss[0] = null; miss[1] = 0;
h = row(miss);
assert(h.includes('<td>13/15</td>') && h.includes('Approve (1.30 pts)'), 'single-answer scoring unchanged');

console.log('PASS: pending table counts a joined multi-answer as correct (15/15 · 1.50 pts) and still marks wrong/partial picks wrong (admin V102.340)');
