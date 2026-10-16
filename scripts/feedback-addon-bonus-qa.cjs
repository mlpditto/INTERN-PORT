// V102.253 — the Feedback add-on: the admin's 🎁 box on a feedback card now CREDITS the user (0–1.0, once per quiz, only for a feedback that counts), as its own checkin_logs row (type 'feedback')
// that History shows in its own "💬 Feedback add-on" group. The REAL qfpAddOnQualifies / saveAdminFeedbackScore / qfpIsEmptyPraise / hubBucketOf from public/admin.html + a recording fake batch.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) { const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head); let d = 0; for (let k = html.indexOf('{', i + head.length - 1); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } }
const line = h => { const i = html.indexOf(h); if (i < 0) throw new Error('missing ' + h); return html.slice(i, html.indexOf('\n', i)); };

const ops = [], alerts = [], toasts = [], els = {};
const field = (id, v) => (els[id] = { value: v, innerText: '' });
const ctx = {
    console, window: {}, alert: m => alerts.push(m), showToast: m => toasts.push(m),
    document: { getElementById: id => els[id] || null },
    usersData: [{ id: 'U1', displayName: 'Bew' }], quizzesData: [{ id: 'Q1', title: 'PRETEST-1.1' }],
    firebase: { firestore: { FieldValue: { increment: n => ({ inc: n }), serverTimestamp: () => 'ts' } } },
    db: { collection: n => ({ doc: id => ({ n, id }), where() { const api = { where() { return api; }, get: async () => ({ docs: (ctx.__quizRows || []).map(a => ({ data: () => ({ amount: a }) })) }) }; return api; } }), batch: () => ({ update: (r, d) => ops.push(['update', r.n, r.id, JSON.parse(JSON.stringify(d))]), set: (r, d) => ops.push(['set', r.n, JSON.parse(JSON.stringify(d))]), commit: async () => {} }) },
    qfpNormalizeTopic: s => String(s || '').replace(/[​-‍﻿]/g, '').trim(),
};
vm.createContext(ctx);
vm.runInContext('let _qfpFeedbacks = [];\nconst QFP_ADDON_MAX = 1;\n' + ['function qfpIsEmptyPraise(', 'function qfpAddOnCap(', 'function qfpAddOnQualifies(', 'async function saveAdminFeedbackScore('].map(grab).join('\n') + '\n' + grab('window.hubBucketOf = function(e)') + ';\nwindow.feedbackAddOnPoints = ' + line('window.feedbackAddOnPoints =').replace(/^\s*window\.feedbackAddOnPoints = /, ''), ctx);
const run = c => vm.runInContext(c, ctx);
const fb = (id, extra) => Object.assign({ id, userId: 'U1', quizId: 'Q1', rating: 8, comment: 'good', nextTopic: '', pointsEarned: 0.9 }, extra || {});
ctx.__quizRows = [0.9];
const setFb = list => run('_qfpFeedbacks = ' + JSON.stringify(list));
const save = async (id, score, note) => { ops.length = 0; alerts.length = 0; toasts.length = 0; field('qfp-admin-score-' + id, String(score)); field('qfp-admin-note-' + id, note || ''); await run(`saveAdminFeedbackScore(${JSON.stringify(id)})`); };

(async () => {
    // 1. what counts
    const q = f => run('qfpAddOnQualifies(' + JSON.stringify(f) + ')');
    assert.strictEqual(q({ rating: 8, comment: '' }), true, 'a rating counts');
    assert.strictEqual(q({ rating: null, comment: 'nice' }), true, 'a comment counts');
    assert.strictEqual(q({ rating: null, comment: ' ​ ', nextTopic: '' }), false, 'no rating + only invisible characters = nothing');
    assert.strictEqual(q({ rating: 10, comment: '', nextTopic: '' }), false, '10/10 with no comment does NOT count (the empty-praise rule)');
    assert.strictEqual(q({ rating: 10, comment: 'ชอบมาก' }), true, '10/10 WITH a comment counts');
    assert.strictEqual(q(null), false);

    // 2. first credit: one batch — the feedback doc, the user's score, a 'feedback' log
    setFb([fb('F1')]);
    await save('F1', 0.5, 'good comment');
    assert.deepStrictEqual(ops, [
        ['update', 'quiz_feedback', 'F1', { adminExtraScore: 0.5, adminScoreNote: 'good comment', addOnCredited: 0.5, adminScoreUpdatedAt: 'ts' }],
        ['update', 'users', 'U1', { score: { inc: 0.5 } }],
        ['set', 'checkin_logs', { userId: 'U1', type: 'feedback', quizId: 'Q1', feedbackId: 'F1', amount: 0.5, note: "Feedback add-on: 'PRETEST-1.1' — good comment", timestamp: 'ts' }],
    ], 'credits 0.5 in one batch with its own log type');
    assert.deepStrictEqual(alerts, []); assert.ok(/🎁 \+0\.50 → Bew/.test(toasts.join('|')));
    // 3. save again: only the difference; same number = no score move; lower = a negative row
    await save('F1', 0.8);
    assert.deepStrictEqual([ops[1][3], ops[2][2].amount, /\(adjusted\)/.test(ops[2][2].note)], [{ score: { inc: 0.3 } }, 0.3, true], 're-saving 0.8 credits only +0.30');
    await save('F1', 0.8, 'x');
    assert.deepStrictEqual(ops.map(o => o[1]), ['quiz_feedback'], 'the same number again: only the note is saved — no score, no log');
    assert.ok(/Note saved/.test(toasts.join('|')));
    await save('F1', 0.2);
    assert.deepStrictEqual([ops[1][3], ops[2][2].amount], [{ score: { inc: -0.6 } }, -0.6], 'lowering takes the difference back');

    // 4. cap / format / qualify / user / one per quiz
    for (const bad of ['1.5', '-0.1', '', 'abc']) { await save('F1', bad); assert.strictEqual(ops.length, 0, 'rejected: ' + JSON.stringify(bad)); assert.ok(alerts.length === 1, 'the admin is told'); }
    setFb([fb('F2', { rating: 10, comment: '' })]);
    await save('F2', 0.5); assert.strictEqual(ops.length, 0); assert.ok(/needs a rating or a comment/.test(alerts[0]), 'a 10/10 with no comment cannot get an add-on');
    setFb([fb('F3', { userId: 'GONE' })]); await save('F3', 0.5); assert.strictEqual(ops.length, 0); assert.ok(/User not found/.test(alerts[0]));
    setFb([fb('F4', { addOnCredited: 0.4 }), fb('F5')]);   // same user + quiz already paid on F4
    await save('F5', 0.5); assert.strictEqual(ops.length, 0); assert.ok(/one per quiz/.test(alerts[0]), 'a second feedback of the same user + quiz cannot add another add-on');
    setFb([fb('F6', { quizId: 'Q2' }), fb('F4', { addOnCredited: 0.4 })]);
    await save('F6', 0.5); assert.strictEqual(ops.length, 3, 'a different quiz is a different add-on');

    // 4b. V102.258: never more than the quiz points the user earned for THAT quiz (and never 1.0)
    setFb([fb('C1')]); ctx.__quizRows = [0.9];
    await save('C1', 0.95); assert.strictEqual(ops.length, 0); assert.ok(/cannot be more than the quiz points this user earned \(0\.90\) — max 0\.90/.test(alerts[0]), 'above the quiz points: ' + alerts[0]);
    await save('C1', 0.9); assert.strictEqual(ops.length, 3, 'exactly the quiz points is allowed'); assert.strictEqual(ops[1][3].score.inc, 0.9);
    ctx.__quizRows = [2.5, 0.5]; setFb([fb('C2', { pointsEarned: 3 })]);
    await save('C2', 1.05); assert.strictEqual(ops.length, 0); assert.ok(/between 0 and 1/.test(alerts[0]), 'a big quiz score still caps at 1.0: ' + alerts[0]);
    await save('C2', 1); assert.strictEqual(ops.length, 3, '1.0 is fine when the quiz gave 3.0');
    ctx.__quizRows = []; setFb([fb('C3', { pointsEarned: 0.4 })]);   // no quiz rows → the score the feedback recorded
    await save('C3', 0.5); assert.strictEqual(ops.length, 0); assert.ok(/max 0\.40/.test(alerts[0]), 'falls back to the recorded quiz-score snapshot: ' + alerts[0]);
    await save('C3', 0.4); assert.strictEqual(ops.length, 3);
    ctx.__quizRows = []; setFb([fb('C4', { pointsEarned: 0 })]);
    await save('C4', 0.1); assert.strictEqual(ops.length, 0); assert.ok(/no quiz points for this quiz/.test(alerts[0]), 'no quiz points = no add-on: ' + alerts[0]);
    ctx.__quizRows = [0.9];
    const cap = f => run('qfpAddOnCap(' + JSON.stringify(f) + ')');
    assert.deepStrictEqual([cap({ pointsEarned: 0.9 }), cap({ pointsEarned: 7 }), cap({ pointsEarned: 0 }), cap({}), cap(null)], [0.9, 1, 0, 0, 0], 'the card cap = min(1.0, the recorded quiz score)');

    // 5. what a delete takes back = what was credited
    const fa = f => run('window.feedbackAddOnPoints(' + JSON.stringify(f) + ')');
    assert.deepStrictEqual([fa({ addOnCredited: 0.5 }), fa({ pointsEarned: 0.9 }), fa({ addOnCredited: 0 }), fa({ addOnCredited: -1 }), fa(null)], [0.5, 0, 0, 0, 0], 'only addOnCredited counts — never the quiz-score snapshot');

    // 6. History: its own bucket, apart from quizzes and adjustments
    const bucket = t => run('window.hubBucketOf(' + JSON.stringify({ type: t }) + ')');
    assert.deepStrictEqual(['feedback', 'manual_adjust', 'quiz', 'daily_checkin'].map(bucket), ['feedback', 'manual', 'quizzes', 'checkin']);
    assert.ok(/feedback: '💬 Feedback add-on'/.test(html) && /feedback: \{ accent: '#ec4899'/.test(html), 'the group has a name and a colour');
    assert.ok(/where\('type', '==', 'feedback'\)/.test(html) && /💬 Feedback add-on<\/div>/.test(html), 'the Score breakdown sums the add-on rows (not quiz_feedback.pointsEarned)');
    // 7. the card: max 1, disabled 🎁 for a feedback that does not count
    assert.ok(/id="qfp-admin-score-\$\{f\.id\}" type="number" min="0" max="\$\{qfpAddOnCap\(f\)\}" step="0\.05"/.test(html) && /max \$\{qfpAddOnCap\(f\)\}<\/div>/.test(html), 'the box max and the label show the cap (min of 1.0 and the quiz points)');
    assert.ok(/class="btn-sm"\$\{qfpAddOnQualifies\(f\) \? '' : ' disabled'\}/.test(html), '🎁 is disabled when the feedback does not count');
    console.log('PASS: Feedback add-on — 🎁 credits 0–1.0 once per quiz (difference on re-save), only for a rating or a comment (10/10 with none = no), own log type + History group, deletes take back only what was credited');
})().catch(e => { console.error(e); process.exit(1); });
