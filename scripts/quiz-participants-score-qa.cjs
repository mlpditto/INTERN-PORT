// V102.104: an approved ONE-TIME practice attempt showed "undefined/-" in the Participants table and was left out of the class
// average, because a practice run only has practiceScore / practiceTotalQ and the two approve buttons never wrote
// correctCount / totalQuestions. Runs the REAL helper and the REAL approve functions from public/admin.html.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');
function grab(marker) {
  const i = html.indexOf(marker); assert(i > -1, 'missing ' + marker);
  let d = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) return html.slice(i, j + 1); }
  throw new Error('unbalanced ' + marker);
}

(async () => {
  const writes = [];
  const attemptDoc = { current: null };
  const fakeBatch = () => ({ update: (ref, data) => { writes.push([ref.path, data]); }, set: (ref, data) => { writes.push([ref.path, data]); }, commit: async () => {} });
  const db = {
    collection: (c) => ({ doc: (id) => { const path = c + '/' + (id || 'new'); return { path, get: async () => ({ exists: true, data: () => attemptDoc.current }) }; } }),
    batch: fakeBatch
  };
  const ctx = {
    db, console, window: {}, alert: (m) => { throw new Error('alert: ' + m); }, confirm: () => true, showToast() {}, closeReviewOverlay() {},
    awardQuizSpeedBeri() {}, openFeedbackAfterApprove() {}, attemptScoreMultiplier: () => 1, firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS', increment: n => ({ inc: n }) } } },
    quizzesData: [], quizForAttempt: (q) => q, pendingQuizzesCache: [], renderPendingQuizzes() {}, drawKanban() {},
    calculateAttemptScoring: () => ({ correctCount: 26, score: 0.87 })
  };
  vm.createContext(ctx);
  vm.runInContext(['function quizAttemptCounts(', 'async function approveQuizAttempt(', 'async function approveQuizAttemptActual('].map(grab).join('\n'), ctx);
  const questions = Array.from({ length: 30 }, () => ({ type: 'choice', correct: 0 }));
  const quiz = { id: 'q1', title: 'Retail', totalPoints: 1.0, questions };
  ctx.quizzesData.push(quiz);

  // ---- helper
  const c = ctx.quizAttemptCounts;
  assert.deepEqual({ ...c({ correctCount: 28, totalQuestions: 30 }, quiz) }, { correct: 28, total: 30 }, 'a normal attempt is unchanged');
  assert.deepEqual({ ...c({ status: 'approved', practiceScore: 26, practiceTotalQ: 30 }, quiz) }, { correct: 26, total: 30 }, 'practice numbers fill in');
  assert.deepEqual({ ...c({ status: 'approved', correctCount: 30 }, quiz) }, { correct: 30, total: 30 }, 'Full marks without totalQuestions → the quiz length');
  assert.deepEqual({ ...c({ status: 'approved' }, null) }, { correct: 0, total: 0 }, 'nothing to go on never throws or yields undefined');
  assert.deepEqual({ ...c({ correctCount: 0, totalQuestions: 30, practiceScore: 26 }, quiz) }, { correct: 0, total: 30 }, 'a real 0 is not replaced by the practice score');

  // ---- 🍇 Actual on a practice attempt writes the two numbers
  attemptDoc.current = { quizId: 'q1', userId: 'u1', status: 'practice_done', isPractice: true, practiceScore: 26, practiceTotalQ: 30, answers: new Array(30).fill(null) };
  await ctx.approveQuizAttemptActual('q1_u1');
  const upd = writes.find(w => w[0] === 'quiz_attempts/q1_u1')[1];
  assert.equal(upd.status, 'approved'); assert.equal(upd.correctCount, 26); assert.equal(upd.totalQuestions, 30);

  // ... but leaves an existing real correctCount / totalQuestions alone
  writes.length = 0;
  attemptDoc.current = { quizId: 'q1', userId: 'u1', status: 'pending', correctCount: 25, totalQuestions: 30, answers: [] };
  await ctx.approveQuizAttemptActual('q1_u1');
  const upd2 = writes.find(w => w[0] === 'quiz_attempts/q1_u1')[1];
  assert(!('correctCount' in upd2) && !('totalQuestions' in upd2), 'real counts are not overwritten');

  // ---- 🍎 Full marks writes totalQuestions too
  writes.length = 0;
  attemptDoc.current = { quizId: 'q1', userId: 'u1', status: 'practice_done', isPractice: true, practiceScore: 26, practiceTotalQ: 30 };
  await ctx.approveQuizAttempt('q1_u1');
  const upd3 = writes.find(w => w[0] === 'quiz_attempts/q1_u1')[1];
  assert.equal(upd3.correctCount, 30); assert.equal(upd3.totalQuestions, 30);

  // ---- the table row and the class average both go through the helper
  const code = html.split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join('\n');
  assert(!/fmtScore\(att\.correctCount\) \+ "\/" \+ \(att\.totalQuestions/.test(code), 'the row no longer reads correctCount/totalQuestions directly');
  assert(/const cnt = quizAttemptCounts\(att, quiz\)/.test(code) && /const cnt = quizAttemptCounts\(a, quiz\)/.test(code), 'row and average use quizAttemptCounts');
  console.log('PASS: approved practice attempt → real score in Participants + class average; approve buttons write correctCount / totalQuestions (admin V102.104)');
})().catch(e => { console.error(e); process.exitCode = 1; });
