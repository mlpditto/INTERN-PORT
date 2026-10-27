// V102.440: Edit Case Note — HN and the patient's name can be corrected by the admin, and every change is logged on the case (editHistory).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, a); return html.slice(i, html.indexOf(b, i)); };

// the two boxes are inputs now
assert.ok(/<input type="text" id="edit-case-note-ref" class="ecn-in" maxlength="40"/.test(html), 'HN is an input');
assert.ok(/<input type="text" id="edit-case-note-customer" class="ecn-in" maxlength="80"/.test(html), 'patient is an input');
assert.ok(!/<div id="edit-case-note-ref"|<div id="edit-case-note-customer"/.test(html), 'no read-only box left');

const mk = v => ({ value: v, tagName: 'INPUT', innerHTML: '', hidden: true });
const calls = { updates: [], mirrors: [], closed: 0, alerts: [] };
const els = {
    'edit-case-note-id': mk('c1'), 'edit-case-note-text': mk('note'), 'edit-case-note-save-btn': { innerHTML: 'Save', disabled: false },
    'edit-case-taxonomy-system': mk('skin'), 'edit-case-note-ref': mk('4'), 'edit-case-note-customer': mk('Pop'), 'edit-case-note-history': mk('')
};
const ctx = {
    document: { getElementById: id => els[id] || null }, ALLOWED_EMAIL: 'admin@x.com', alert: m => calls.alerts.push(m),
    casesData: [{ id: 'c1', caseId: '4', customer: 'Pop', note: 'old' }],
    getAlabastaTaxonomyEntry: () => ({ key: 'skin', label: 'Skin', koLabel: '피부' }), getEditCaseSelectedTags: () => ['Rash'],
    escapeHtml: s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } },
    db: { collection: n => ({ doc: id => ({ n, id }) }), batch: () => ({ update: (ref, data) => calls.updates.push([ref, data]), commit: async () => { calls.committed = (calls.committed || 0) + 1; } }) },
    stageSubmissionMirror: async (b, id, fields) => { calls.mirrors.push([id, fields]); return 1; },
    renderAlabastaCases() {}, closeEditCaseNoteModal() { calls.closed++; }, showToast() {}, console, Date, Array, String
};
vm.createContext(ctx);
vm.runInContext(cut('        const ECN_FIELDS', '        function editCaseNote(') + '\n' + cut('        async function saveEditedCaseNote()', '        // V102.273: a case can carry a userId')
    + '\nthis.save = saveEditedCaseNote; this.hist = renderEditCaseHistory;', ctx);

(async () => {
    // nothing changed → no log, no HN mirror
    await ctx.save();
    let [ref, data] = calls.updates[0];
    assert.equal(ref.id, 'c1'); assert.ok(!('editHistory' in data) && !('caseId' in data) && !('customer' in data), 'unchanged HN / name write nothing extra');
    assert.equal(calls.mirrors.length, 0, 'no mirror when HN is the same');

    // both changed → logged, old HN kept, mirror follows
    els['edit-case-note-ref'].value = '  27238 ';
    els['edit-case-note-customer'].value = ' Pop   Ink ';
    calls.updates.length = 0; ctx.casesData[0].editHistory = [{ field: 'caseId', from: '1', to: '4', by: 'a@x.com', at: 1 }];
    await ctx.save();
    [ref, data] = calls.updates[0];
    assert.equal(data.caseId, '27238'); assert.equal(data.caseIdPrev, '4'); assert.equal(data.customer, 'Pop Ink', 'spaces tidied');
    assert.deepEqual(JSON.parse(JSON.stringify(data.editHistory.map(h => [h.field, h.from, h.to, h.by]))), [['caseId', '1', '4', 'a@x.com'], ['caseId', '4', '27238', 'admin@x.com'], ['customer', 'Pop', 'Pop Ink', 'admin@x.com']], 'appended to the history');
    assert.ok(data.editHistory.every(h => typeof h.at === 'number'), 'a plain timestamp (arrays cannot hold serverTimestamp)');
    assert.deepEqual(JSON.parse(JSON.stringify(calls.mirrors[0])), ['c1', { 'metadata.caseId': '27238', title: '27238 - Skin 피부' }], "the intern's History copy follows the HN");
    assert.equal(ctx.casesData[0].caseId, '27238'); assert.equal(ctx.casesData[0].customer, 'Pop Ink'); assert.equal(calls.closed, 2);

    // HN may not be emptied
    els['edit-case-note-ref'].value = '   ';
    const n = calls.updates.length; await ctx.save();
    assert.equal(calls.updates.length, n, 'nothing saved'); assert.match(calls.alerts[0], /HN \/ Ref cannot be empty/);

    // history is capped at 20 and shown newest first (5 lines)
    ctx.casesData[0].editHistory = Array.from({ length: 19 }, (_, i) => ({ field: 'customer', from: 'a' + i, to: 'b' + i, by: 'x@y.z', at: i + 1 }));
    els['edit-case-note-ref'].value = '99'; await ctx.save();
    assert.equal(calls.updates.at(-1)[1].editHistory.length, 20, 'last 20 kept');
    ctx.hist({ editHistory: [{ field: 'caseId', from: '4', to: '5<b>', by: 'ink@x.com', at: Date.UTC(2026, 9, 27, 3) }, { field: 'other', from: 'x', to: 'y', at: 1 }] });
    const h = els['edit-case-note-history'];
    assert.equal(h.hidden, false); assert.match(h.innerHTML, /HN<\/b> 4 → 5&#60;b&#62; · ink/); assert.ok(!/other/.test(h.innerHTML), 'only HN / patient lines, escaped');
    ctx.hist({}); assert.equal(els['edit-case-note-history'].hidden, true, 'hidden when there is nothing');
    console.log('case-edit-hn-name-qa: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
