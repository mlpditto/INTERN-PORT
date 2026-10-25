// Admin "✎ Case No." — fixes a wrong case number on a New Cases card; the intern's History copy follows.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');

// the card carries the pencil next to the code chip
assert.ok(/<span class="cdup-hn-code">[^\n]*<\/span><button type="button" class="cno-edit" onclick="editCaseNo\('\$\{c\.id\}'\)"/.test(admin), 'pencil beside the code chip');
assert.ok(/\.alabasta-inbox-card \.cno-edit/.test(admin), 'pencil style');

const i = admin.indexOf('async function editCaseNo(');
assert.ok(i > 0, 'editCaseNo exists');
const end = admin.indexOf('\n        }\r\n', i) > 0 ? admin.indexOf('\n        }\r\n', i) : admin.indexOf('\n        }\n', i);
const src = admin.slice(i, end + 10);

function run(c, answer) {
    const log = { toasts: [], ops: [] };
    const ctx = {
        casesData: [c], console,
        prompt: () => answer,
        showToast: (m) => log.toasts.push(m),
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } },
        db: { batch: () => ({ update: (r, d) => log.ops.push(['update', r.path, d]), commit: async () => log.ops.push(['commit']) }), collection: (n) => ({ doc: (id) => ({ path: n + '/' + id }) }) },
        stageSubmissionMirror: async (batch, id, f) => { log.ops.push(['mirror', id, f]); }
    };
    vm.createContext(ctx);
    vm.runInContext(src + '\nthis.editCaseNo = editCaseNo;', ctx);
    return ctx.editCaseNo(c.id).then(() => JSON.parse(JSON.stringify(log)));
}

(async () => {
    let l = await run({ id: 'c1', caseId: '3', disease: 'ENT / หูคอจมูก' }, ' 27121 ');
    assert.deepEqual(l.ops[0], ['update', 'cases/c1', { caseId: '27121', caseIdPrev: '3', adminUpdatedAt: 'TS' }], 'the case: new no. (trimmed) + the old one kept');
    assert.deepEqual(l.ops[1], ['mirror', 'c1', { 'metadata.caseId': '27121', title: '27121 - ENT / หูคอจมูก' }], 'the intern copy follows');
    assert.deepEqual(l.ops[2], ['commit']);
    assert.match(l.toasts[0], /3 → 27121/);
    for (const [ans, why] of [[null, 'cancel'], ['   ', 'blank'], ['3', 'unchanged']]) {
        l = await run({ id: 'c1', caseId: '3', disease: 'x' }, ans);
        assert.equal(l.ops.length, 0, why + ' → nothing written');
    }
    l = await run({ id: 'c2', caseId: '', disease: '' }, 'A1');
    assert.deepEqual(l.ops[1][2], { 'metadata.caseId': 'A1' }, 'no disease → the title is left alone');
    l = await run({ id: 'c3', caseId: '1' }, 'x'.repeat(80));
    assert.equal(l.ops[0][2].caseId.length, 40, 'capped at 40 chars');
    console.log('PASS case-no-edit-qa');
})().catch(e => { console.error(e); process.exit(1); });
