// V102.625 (owner: "กด Approve แล้ว งานน่าจะไม่ค้างที่ Backlog?") — approving a requested certificate moves the intern's 📝 Certificate Request
// card(s) in side_quests to Done (doneAt stamped); other interns' cards, other tasks and already-Done cards are left alone; revoking moves nothing.
// The REAL markCertApproved + certRequestTasksDone from public/admin.html, a stub Firestore (Node vm).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const i = admin.indexOf('        async function markCertApproved(uid, no, approved = true) {');
const j = admin.indexOf('        // V96.79: company logo on the certificate.', i);
assert.ok(i > 0 && j > i, 'markCertApproved + certRequestTasksDone found');
const code = admin.slice(i, j);

(async () => {
    const writes = [];
    const cards = {
        t1: { requestedBy: 'U1', isCertificateRequest: true, status: 'Backlog' },
        t2: { requestedBy: 'U1', isCertificateRequest: true, status: 'Doing' },
        t3: { requestedBy: 'U1', isCertificateRequest: true, status: 'Done' },
        t4: { requestedBy: 'U1', status: 'Backlog', title: 'another task' },
        t5: { requestedBy: 'U2', isCertificateRequest: true, status: 'Backlog' }
    };
    const docRef = (col, id) => ({ update: async v => { writes.push([col + '/' + id, Object.keys(v).sort().join(','), v.status || v.certApproved]); } });
    const db = { collection: col => ({
        doc: id => docRef(col, id),
        where: (f, op, val) => ({ get: async () => ({ docs: Object.entries(cards).filter(([, d]) => d[f] === val).map(([id, d]) => ({ id, data: () => d, ref: docRef(col, id) })) }) })
    }) };
    const ctx = { db, usersData: [{ id: 'U1', certRequested: true, certNo: 'MLP-1' }, { id: 'U2' }], console, showToast: () => {},
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } } };
    vm.createContext(ctx);
    vm.runInContext(code + '\nthis.markCertApproved = markCertApproved;', ctx);

    await ctx.markCertApproved('U1', 'MLP-1');
    assert.deepEqual(writes, [
        ['users/U1', 'certApproved,certApprovedAt,certNo', true],
        ['side_quests/t1', 'doneAt,status', 'Done'],
        ['side_quests/t2', 'doneAt,status', 'Done']
    ], 'approve → the user flag, then only U1\'s open Certificate Request cards go to Done: ' + JSON.stringify(writes));

    writes.length = 0;
    await ctx.markCertApproved('U1', 'MLP-1', false);
    assert.deepEqual(writes, [['users/U1', 'certApproved', false]], 'revoke moves no card');

    writes.length = 0;
    await ctx.markCertApproved('U2', 'MLP-2');
    assert.deepEqual(writes, [], 'no request on the user → nothing (as before)');
    console.log('PASS: Certificate Approve moves the intern\'s Certificate Request card(s) to Done (doneAt), leaves other cards / interns alone; revoke moves nothing');
})().catch(e => { console.error(e); process.exit(1); });
