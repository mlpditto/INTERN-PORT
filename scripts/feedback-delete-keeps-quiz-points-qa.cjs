// V102.251 — deleting a quiz feedback (panel delete, empty-comment delete, bulk clean) must NEVER take points off the user: feedback credits none (submitFeedback writes no score) and
// `pointsEarned` on a feedback doc is only a snapshot of the QUIZ score. Before this, Bew (PRETEST-1.1) got +0.90 for the quiz and then -0.90 "Revert: Quiz Feedback deleted".
// The REAL deleteQuizFeedbackItem / deleteEmptyCommentFeedback / qfpCleanEmptyFeedback / feedbackAddOnPoints from public/admin.html with a recording fake Firestore batch.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) { const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head); let d = 0; for (let k = html.indexOf('{', i + head.length - 1); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } }

const ops = [], confirms = [], toasts = [];
const ctx = {
    console, window: {}, alert: m => { throw new Error('alert: ' + m); }, confirm: m => { confirms.push(m); return true; },
    showToast: m => toasts.push(m), renderQuizFeedbackCards() {}, showQuizFeedbackPanel: async () => {},
    usersData: [{ id: 'U1', displayName: 'Bew' }, { id: 'U2', displayName: 'Other' }], quizzesData: [{ id: 'Q1', title: 'PRETEST-1.1' }],
    firebase: { firestore: { FieldValue: { increment: n => ({ inc: n }), serverTimestamp: () => 'ts' } } },
    db: { collection: n => ({ doc: id => ({ n, id }) }), batch: () => ({ delete: r => ops.push(['delete', r.n, r.id]), update: (r, d) => ops.push(['update', r.n, r.id, d]), set: (r, d) => ops.push(['set', r.n, d]), commit: async () => {} }) },
    qfpNormalizeTopic: s => String(s || '').replace(/[​-‍﻿]/g, '').trim(),
};
vm.createContext(ctx);
const fb = (id, userId, extra) => Object.assign({ id, userId, quizId: 'Q1', displayName: 'x', pointsEarned: 0.9, rating: null, comment: '', nextTopic: '' }, extra || {});
vm.runInContext('window.window = window; let _qfpFeedbacks = [], _qfpCurrentId = "Q1";\n' + ['window.feedbackAddOnPoints =', 'async function deleteEmptyCommentFeedback(', 'async function deleteQuizFeedbackItem(', 'function qfpIsEmptyFeedback(', 'async function qfpCleanEmptyFeedback('].map(h => h.startsWith('window.') ? html.slice(html.indexOf(h), html.indexOf('\n', html.indexOf(h))) : grab(h)).join('\n'), ctx);
// the helper sits on window; the delete functions call it bare, like in the page
ctx.feedbackAddOnPoints = ctx.window.feedbackAddOnPoints;
const run = c => vm.runInContext(c, ctx);
const reset = () => { ops.length = 0; confirms.length = 0; toasts.length = 0; };
const noPointOps = () => ops.every(o => o[0] === 'delete' && o[1] === 'quiz_feedback');

(async () => {
    assert.strictEqual(ctx.feedbackAddOnPoints({ pointsEarned: 0.9 }), 0, 'a feedback with pointsEarned 0.9 (the quiz-score snapshot) credited nothing');

    // 1. the panel delete (the one Bew hit)
    run('_qfpFeedbacks = ' + JSON.stringify([fb('F1', 'U1')]));
    await run('deleteQuizFeedbackItem("F1")');
    assert.deepStrictEqual(ops, [['delete', 'quiz_feedback', 'F1']], 'panel delete: only the feedback doc goes — no users update, no checkin_logs row');
    assert.ok(!/−0\.9|-0\.9|to revert: /.test(confirms[0]) && /quiz score is NOT affected/.test(confirms[0]), 'the confirm says no points move');
    assert.ok(!/reverted/.test(toasts.join('|')), 'the toast does not claim a revert: ' + toasts.join('|'));

    // 2. the empty-comment delete (LAUGH TALE grid)
    reset(); ctx.window._quizFeedbackCache = [fb('F2', 'U1')];
    await run('deleteEmptyCommentFeedback("F2")');
    assert.deepStrictEqual(ops, [['delete', 'quiz_feedback', 'F2']], 'empty-comment delete: only the doc');
    assert.ok(/quiz score is NOT affected/.test(confirms[0]));

    // 3. the bulk clean (two users, one of them twice)
    reset(); run('_qfpFeedbacks = ' + JSON.stringify([fb('F3', 'U1'), fb('F4', 'U1'), fb('F5', 'U2'), fb('F6', 'U2', { rating: 9, comment: 'good' })]));
    await run('qfpCleanEmptyFeedback()');
    assert.deepStrictEqual(ops, [['delete', 'quiz_feedback', 'F3'], ['delete', 'quiz_feedback', 'F4'], ['delete', 'quiz_feedback', 'F5']], 'bulk clean: only the three EMPTY docs go, the one with a rating + comment stays, no points ops');
    assert.ok(noPointOps() && /quiz scores are NOT affected/.test(confirms[0]) && !/PTS/.test(confirms[0]), 'the confirm lists no PTS');
    assert.ok(!/reverted/.test(toasts.join('|')));

    // 4. nothing in the three functions can still write a score or a manual_adjust (guard against a future copy-paste)
    for (const name of ['async function deleteQuizFeedbackItem(', 'async function deleteEmptyCommentFeedback(', 'async function qfpCleanEmptyFeedback(']) {
        const src = grab(name);
        assert.ok(!/\.pointsEarned/.test(src), name + ' no longer reads pointsEarned');
        assert.ok(/feedbackAddOnPoints\(/.test(src), name + ' asks feedbackAddOnPoints for the amount');
    }
    console.log('PASS: deleting a quiz feedback (panel / empty-comment / bulk clean) never touches users.score or writes a manual_adjust — quiz points stay');
})().catch(e => { console.error(e); process.exit(1); });
