// V102.252 — ↩️ Repair: old feedback deletes subtracted the QUIZ score. The REAL qfpOpenRepair / qfpRepairOne / helpers from public/admin.html + a fake Firestore holding Bew's rows.
// Covers: finds only the revert rows (single, empty-comment, bulk-clean wording) that are negative and not yet repaired; shows whether the user's quiz row still exists; one tap re-credits once
// (users.score +amount, a new "Repair: …" manual_adjust, the old row stamped repairedAt/repairedBy so it never lists again); nothing happens on cancel / unknown user.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) { const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head); let d = 0; for (let k = html.indexOf('{', i + head.length - 1); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } }
const line = h => { const i = html.indexOf(h); if (i < 0) throw new Error('missing ' + h); return html.slice(i, html.indexOf('\n', i)); };
assert.ok(/id="qfpRepairModal"[^>]*style="z-index:2510;"/.test(html) && /qfpOpenRepair\(\)" title="↩️/.test(html), 'the modal and the ↩️ Repair button exist in the Quiz Feedback panel');

const ts = ms => ({ toMillis: () => ms });
const logs = [
    { id: 'L1', userId: 'U1', type: 'manual_adjust', amount: -0.9, note: "Revert: Quiz Feedback deleted via Panel — 'PRETEST-1.1'", timestamp: ts(2000) },
    { id: 'L2', userId: 'U1', type: 'quiz', amount: 0.9, note: 'Quiz Approved (Actual): 9/10 - PRETEST-1.1' },
    { id: 'L3', userId: 'U2', type: 'manual_adjust', amount: -0.5, note: "Revert: Quiz Feedback deleted (no comment) — 'Other quiz'", timestamp: ts(3000) },
    { id: 'L4', userId: 'U2', type: 'manual_adjust', amount: -1.2, note: "Revert: 3 empty Quiz Feedback bulk-cleaned — 'Bulk quiz'", timestamp: ts(1000) },
    { id: 'L5', userId: 'U1', type: 'manual_adjust', amount: -0.9, note: "Revert: Quiz Feedback deleted via Panel — 'Done one'", repairedAt: 'x', timestamp: ts(500) },
    { id: 'L6', userId: 'U1', type: 'manual_adjust', amount: 0.5, note: 'manual +0.5 for a good answer', timestamp: ts(400) },
    { id: 'L7', userId: 'U1', type: 'manual_adjust', amount: -0.3, note: 'Penalty: late', timestamp: ts(300) },
    { id: 'L8', userId: 'U2', type: 'quiz', amount: 0.5, note: 'Quiz Approved (Actual): 5/10 - Other quiz' },
];
const writes = [], toasts = [], alerts = []; let confirmAnswer = true;
const q = (rows) => ({ get: async () => ({ docs: rows.map(r => ({ id: r.id, data: () => r })) }) });
const db = { collection: n => ({ where(f, op, v) { const filters = [[f, v]]; const api = { where(f2, op2, v2) { filters.push([f2, v2]); return api; }, get: async () => ({ docs: logs.filter(l => filters.every(([k, val]) => l[k] === val)).map(r => ({ id: r.id, data: () => r })) }) }; return api; }, doc: id => ({ n, id }) }), batch: () => ({ update: (r, d) => writes.push(['update', r.n, r.id, d]), set: (r, d) => writes.push(['set', r.n, d]), commit: async () => {} }) };
const el = {}; const ctx = {
    console, window: {}, db, firebase: { firestore: { FieldValue: { increment: n => ({ inc: n }), serverTimestamp: () => 'ts' } } }, auth: { currentUser: { email: 'admin@x' } },
    usersData: [{ id: 'U1', displayName: 'Bew' }, { id: 'U2', displayName: 'Other' }], showToast: m => toasts.push(m), alert: m => alerts.push(m), confirm: m => { ctx.__confirm = m; return confirmAnswer; },
    escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    document: { getElementById: id => el[id] || (el[id] = { style: {}, innerHTML: '' }) },
};
vm.createContext(ctx);
vm.runInContext(['const QFP_REVERT_RE', 'let _qfpRepairRows = []', 'const qfpRevertTitle', 'const qfpMillis'].map(line).join('\n') + '\n' + ['async function qfpOpenRepair(', 'function qfpRenderRepair(', 'async function qfpRepairOne('].map(grab).join('\n'), ctx);
const run = c => vm.runInContext(c, ctx);

(async () => {
    await run('qfpOpenRepair()');
    const rows = JSON.parse(JSON.stringify(run('_qfpRepairRows')));
    assert.deepStrictEqual(rows.map(r => r.id), ['L3', 'L1', 'L4'], 'only the 3 unrepaired revert rows, newest first (not the repaired one, the manual +0.5, or the penalty)');
    const by = id => rows.find(r => r.id === id);
    assert.deepStrictEqual([by('L1').title, by('L1').amt, by('L1').quizPts], ['PRETEST-1.1', 0.9, 0.9], "Bew's row: title read from the note, quiz row still there (+0.90)");
    assert.strictEqual(by('L3').quizPts, 0.5); assert.strictEqual(by('L4').quizPts, 0, 'a revert with no matching quiz row is shown as ❔, not hidden');
    const html1 = el['qfp-repair-body'].innerHTML;
    assert.ok(/Bew/.test(html1) && /−0\.90/.test(html1) && /📝 \+0\.90/.test(html1) && /❔/.test(html1) && (html1.match(/↩️ \+/g) || []).length === 3, 'the list shows name, −amount, 📝 quiz row, ❔ and one ↩️ button per row');
    assert.strictEqual(el['qfpRepairModal'].style.display, 'flex', 'the modal opens');

    // cancel → nothing written
    confirmAnswer = false; await run('qfpRepairOne(1)');
    assert.strictEqual(writes.length, 0, 'cancel writes nothing'); assert.strictEqual(run('_qfpRepairRows.length'), 3);
    // confirm → one batch: score +0.9, a Repair row, the old row stamped
    confirmAnswer = true; await run('qfpRepairOne(1)');   // index 1 = L1
    assert.deepStrictEqual(JSON.parse(JSON.stringify(writes)), [
        ['update', 'users', 'U1', { score: { inc: 0.9 } }],
        ['set', 'checkin_logs', { userId: 'U1', type: 'manual_adjust', amount: 0.9, repairOf: 'L1', note: "Repair: quiz points restored after a feedback delete — 'PRETEST-1.1'", timestamp: 'ts' }],
        ['update', 'checkin_logs', 'L1', { repairedAt: 'ts', repairedBy: 'admin@x' }],
    ], 'one batch: user +0.90, a "Repair" manual_adjust, the old row stamped');
    assert.ok(/Re-credit \+0\.90 PTS to Bew/.test(ctx.__confirm) && !/No matching quiz row/.test(ctx.__confirm), 'the confirm names the user and amount');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(run('_qfpRepairRows.map(r => r.id)'))), ['L3', 'L4'], 'the row leaves the list'); assert.ok(/↩️ \+0\.90 → Bew/.test(toasts.join('|')));
    // a row with no quiz match warns in the confirm
    writes.length = 0; await run('qfpRepairOne(1)');   // L4
    assert.ok(/No matching quiz row/.test(ctx.__confirm), '❔ rows warn before re-crediting');
    // unknown user → alert, no write
    writes.length = 0; run('_qfpRepairRows.push({ id: "LX", userId: "GONE", amt: 1, title: "t", quizPts: 0 })'); const idx = run('_qfpRepairRows.length - 1'); await run('qfpRepairOne(' + idx + ')');
    assert.strictEqual(writes.length, 0); assert.ok(/User not found/.test(alerts.join('|')), 'a deleted user cannot be re-credited');
    // once repaired the row no longer lists (repairedAt)
    logs.find(l => l.id === 'L1').repairedAt = 'ts'; logs.find(l => l.id === 'L3').repairedAt = 'now'; await run('qfpOpenRepair()');   // what Firestore holds after the stamps
    assert.deepStrictEqual(JSON.parse(JSON.stringify(run('_qfpRepairRows.map(r => r.id)'))), ['L4'], 'a stamped row never lists again');
    console.log('PASS: ↩️ Repair — finds only unrepaired feedback-delete reverts, shows the quiz row, re-credits once per tap (score + Repair row + stamp), cancel / unknown user write nothing');
})().catch(e => { console.error(e); process.exit(1); });
