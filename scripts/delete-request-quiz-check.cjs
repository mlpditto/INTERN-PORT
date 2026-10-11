// V102.156: admin "Delete requests" ▸ Delete on a QUIZ ATTEMPT request actually deletes (it used to end in "Use the existing admin review screen…"
// because deleteSource had no quiz branch), taking an approved score back off the user and logging the reversal, like deletePollParticipant.
// Legacy-linked accounts (user_auth_links effectiveUserId ≠ rawLiffUserId, the Joeylive case) no longer die on "Owner mismatch": the item
// may carry the raw LIFF id while the request carries the effective id. The REAL public/delete-requests.js in a vm with a fake Firestore.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(require('path').join(__dirname, '../public/delete-requests.js'), 'utf8');
const admin = fs.readFileSync(require('path').join(__dirname, '../public/admin.html'), 'utf8');
assert.ok(/<script src="delete-requests\.js\?v=V102\.\d+"><\/script>/.test(admin), 'admin.html cache-busts the script with a current version (it sat on V100.40)');

function makeDb(data) {
    const ops = [];
    const docRef = (col, id) => {
        const ref = { path: col + '/' + id };
        ref.get = async () => ({ exists: data[col + '/' + id] !== undefined, data: () => data[col + '/' + id], ref });
        return ref;
    };
    const db = {
        collection: col => ({ doc: id => docRef(col, id || ('auto' + ops.length)) }),
        batch: () => ({
            delete: ref => ops.push(['delete', ref.path]),
            update: (ref, d) => ops.push(['update', ref.path, d]),
            set: (ref, d) => ops.push(['set', ref.path, d]),
            commit: async () => { ops.forEach(o => { if (o[0] === 'delete') delete data[o[1]]; }); ops.push(['commit']); }
        })
    };
    return { db, ops };
}
const J = v => JSON.parse(JSON.stringify(v));   // vm-realm objects: compare by value, not prototype
function run(data, globals) {
    const { db, ops } = makeDb(data);
    const noop = async () => {};   // admin.html handlers the mapping table names; never reached in these cases
    const context = { window: {}, document: { addEventListener() {} }, db, usersData: [{ id: 'eff' }, { id: 'u1' }],
        deleteCaseSubmission: noop, deleteProductListing: noop, delWork: noop, deleteReflectiveLog: noop, deleteLearningNote: noop,
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS', increment: n => ({ inc: n }) } } }, quizAttemptsAllCache: [{ id: 'q1_u1' }, { id: 'other' }], ...globals };
    vm.createContext(context);
    vm.runInContext(code.replace('    function adminUI() {', '    window.deleteSource = deleteSource; window.describeRequest = describeRequest;\n    function adminUI() {'), context);
    return { ctx: context, ops, data };
}

(async () => {
    // 1. approved attempt → delete + score back + log; returns true (gone)
    let t = run({ 'quiz_attempts/q1_u1': { userId: 'u1', quizId: 'q1', status: 'approved', score: 0.5, quizTitle: 'Vitamin B' } });
    assert.equal(await t.ctx.window.deleteSource({ itemType: 'quiz', itemId: 'q1_u1', userId: 'u1', authUid: 'A1' }), true);
    assert.deepEqual(J(t.ops), [['delete', 'quiz_attempts/q1_u1'], ['update', 'users/u1', { score: { inc: -0.5 } }],
        ['set', 'checkin_logs/auto2', { userId: 'u1', type: 'manual_adjust', amount: -0.5, note: 'Revert: quiz attempt deleted on request (Vitamin B)', timestamp: 'TS' }], ['commit']], 'one batch: delete, revert, log');
    assert.deepEqual(J(t.ctx.quizAttemptsAllCache), [{ id: 'other' }], 'the client cache drops it too');
    // 2. pending attempt → delete only
    t = run({ 'quiz_attempts/q1_u1': { userId: 'u1', quizId: 'q1', status: 'pending' } });
    assert.equal(await t.ctx.window.deleteSource({ itemType: 'quiz', itemId: 'q1_u1', userId: 'u1', authUid: 'A1' }), true);
    assert.deepEqual(J(t.ops), [['delete', 'quiz_attempts/q1_u1'], ['commit']], 'nothing to take back');
    // 3. approved but the user doc is gone → delete, no score write (a batch update on a missing doc would fail the whole batch)
    t = run({ 'quiz_attempts/q1_x': { userId: 'x', status: 'approved', score: 1 } });
    assert.equal(await t.ctx.window.deleteSource({ itemType: 'quiz', itemId: 'q1_x', userId: 'x', authUid: 'A1' }), true);
    assert.deepEqual(J(t.ops), [['delete', 'quiz_attempts/q1_x'], ['commit']]);
    // 4. legacy-linked: request says 'eff', attempt says 'raw' → allowed via user_auth_links, score back onto 'eff' (the users doc)
    t = run({ 'quiz_attempts/q1_raw': { userId: 'raw', quizId: 'q1', status: 'approved', score: 0.3 }, 'user_auth_links/A1': { effectiveUserId: 'eff', rawLiffUserId: 'raw' } });
    assert.equal(await t.ctx.window.deleteSource({ itemType: 'quiz', itemId: 'q1_raw', userId: 'eff', authUid: 'A1' }), true);
    assert.deepEqual(J(t.ops[0]), ['delete', 'quiz_attempts/q1_raw']); assert.deepEqual(J(t.ops[1]), ['update', 'users/eff', { score: { inc: -0.3 } }]);
    // 5. a genuinely different owner is still refused (link points elsewhere)
    t = run({ 'quiz_attempts/q1_z': { userId: 'z', status: 'approved', score: 0.3 }, 'user_auth_links/A1': { effectiveUserId: 'eff', rawLiffUserId: 'raw' } });
    await assert.rejects(t.ctx.window.deleteSource({ itemType: 'quiz', itemId: 'q1_z', userId: 'eff', authUid: 'A1' }), /Owner mismatch/);
    assert.deepEqual(J(t.ops), [], 'nothing written');
    // 6. a link whose effectiveUserId is not the requester gives no extra id
    t = run({ 'quiz_attempts/q1_raw': { userId: 'raw', status: 'pending' }, 'user_auth_links/A1': { effectiveUserId: 'someone-else', rawLiffUserId: 'raw' } });
    await assert.rejects(t.ctx.window.deleteSource({ itemType: 'quiz', itemId: 'q1_raw', userId: 'eff', authUid: 'A1' }), /Owner mismatch/);
    // 7. other types without a source still get the old guidance (unchanged)
    t = run({ 'submissions/w1': { userId: 'u1' } });
    await assert.rejects(t.ctx.window.deleteSource({ itemType: 'work', itemId: 'w1', userId: 'u1', authUid: 'A1' }), /Use the existing admin review screen/);
    // 8. describeRequest resolves the quiz title for a legacy-linked attempt (it showed "Untitled item")
    t = run({});
    const data = { 'users/eff': { displayName: 'Joeylive' }, 'quiz_attempts/q1_raw': { userId: 'raw', quizId: 'q1' }, 'quizzes/q1': { title: 'A, AN, THE' }, 'user_auth_links/A1': { effectiveUserId: 'eff', rawLiffUserId: 'raw' } };
    const read = async (c, id) => data[c + '/' + id] || null;
    const info = await t.ctx.window.describeRequest({ itemType: 'quiz', itemId: 'q1_raw', userId: 'eff', authUid: 'A1' }, read);
    assert.equal(info.title, 'A, AN, THE'); assert.equal(info.name, 'Joeylive');
    console.log('PASS: delete request ▸ quiz attempt: delete + score back + log in one batch, pending = delete only, missing user = no score write, legacy-linked ids accepted via user_auth_links, real mismatches still refused, other types unchanged, legacy title resolves');
})().catch(error => { console.error(error); process.exitCode = 1; });
