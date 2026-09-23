// V101.08: harness for the editor System select. Extracts the real helpers
// VERBATIM from public/admin.html (populateQuizSystemSelect, quizSystemValueFromDoc,
// quizSystemFields) and checks that every CASE_SYSTEMS key has an intern icon
// palette entry (QUIZ_SYSTEM_PALETTE in index.html) so the override never
// silently falls back to the regex guess.
//   node scripts/quiz-system-select-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8').replace(/\r\n/g, '\n');
const admin = read('admin.html');
const index = read('index.html');
const taxonomy = read('case-taxonomy.js');

const a = admin.indexOf('window.populateQuizSystemSelect = function');
const b = admin.indexOf('        const QUIZ_TAG_MAX = 20;', a);
if (a < 0 || b < 0) { console.error('system-select helpers not found in admin.html'); process.exit(1); }

const DELETE = { sentinel: 'FieldValue.delete()' };
const els = {};
const mk = id => els[id] || (els[id] = { id, innerHTML: '', _value: '', get value() { return this._value; }, set value(v) { const ok = [...this.innerHTML.matchAll(/value="([^"]*)"/g)].some(m => m[1] === v); this._value = ok ? v : ''; } });
const window = { CASE_SYSTEMS: [
    { key: 'respiratory', emoji: '🫁', label: { en: 'Respiratory' } },
    { key: 'neuro', emoji: '🧠', label: { en: 'Neurological' } },
    { key: 'infection', emoji: '🦠', label: { en: 'Infection' } }
] };
const ctx = {
    window,
    document: { getElementById: mk },
    escapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    firebase: { firestore: { FieldValue: { delete: () => DELETE } } }
};
new Function(...Object.keys(ctx), admin.slice(a, b))(...Object.values(ctx));

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);
const sel = mk('quiz-system-select');

window.populateQuizSystemSelect('neuro');
check('options = Auto + systems + Uncategorized', (sel.innerHTML.match(/<option /g) || []).length, 5);
check('stored key selected', sel.value, 'neuro');
window.populateQuizSystemSelect('bogus');
check('unknown key → Auto', sel.value, '');
window.populateQuizSystemSelect('__none');
check('Uncategorized selectable', sel.value, '__none');

check('doc: coverageSystem wins', window.quizSystemValueFromDoc({ coverageSystem: 'neuro', diseaseSystemKey: 'gi' }), 'neuro');
check('doc: __auto falls to diseaseSystemKey', window.quizSystemValueFromDoc({ coverageSystem: '__auto', diseaseSystemKey: 'gi' }), 'gi');
check('doc: __none stays', window.quizSystemValueFromDoc({ coverageSystem: '__none', diseaseSystemKey: 'gi' }), '__none');
check('doc: nothing → Auto', window.quizSystemValueFromDoc({}), '');

const j = v => JSON.stringify(v, (k, x) => x === DELETE ? '<DELETE>' : x);
check('fields: key on update', j(window.quizSystemFields('neuro', true)), '{"coverageSystem":"neuro","diseaseSystemKey":"neuro"}');
check('fields: key on add', j(window.quizSystemFields('neuro', false)), '{"coverageSystem":"neuro","diseaseSystemKey":"neuro"}');
check('fields: Auto on update deletes both', j(window.quizSystemFields('', true)), '{"coverageSystem":"<DELETE>","diseaseSystemKey":"<DELETE>"}');
check('fields: Auto on add writes nothing', j(window.quizSystemFields('', false)), '{}');
check('fields: __none on update', j(window.quizSystemFields('__none', true)), '{"coverageSystem":"__none","diseaseSystemKey":"<DELETE>"}');
check('fields: __none on add', j(window.quizSystemFields('__none', false)), '{"coverageSystem":"__none"}');

// every CASE_SYSTEMS key must have an icon palette entry on the intern page
const caseKeys = [...taxonomy.matchAll(/\{ key: '([a-z_]+)'/g)].map(m => m[1]);
const pal = index.slice(index.indexOf('const QUIZ_SYSTEM_PALETTE = {'), index.indexOf('};', index.indexOf('const QUIZ_SYSTEM_PALETTE = {')));
const palKeys = [...pal.matchAll(/^\s*([a-z_]+):\s*'/gm)].map(m => m[1]);
check('CASE_SYSTEMS keys found', caseKeys.length > 5, true);
check('palette covers every CASE_SYSTEMS key', caseKeys.filter(k => !palKeys.includes(k)).join(','), '');

// the save path and the coverage picker both go through quizSystemFields
check('3 update() paths merge the pair (save, template, go live)', (admin.match(/Object\.assign\(data, window\.quizSystemFieldsFromEditor\(true\)\)/g) || []).length, 3);
check('3 add() paths merge the pair', (admin.match(/Object\.assign\(data, window\.quizSystemFieldsFromEditor\(false\)\)/g) || []).length, 3);
check('raw select value never enters formData', /systemKey/.test(admin.slice(admin.indexOf('function getQuizFormData'), admin.indexOf('function getQuizFormData') + 12000)), false);
check('coverage picker uses the same helper', admin.includes(".update(window.quizSystemFields(chosen, true))"), true);
check('old single-field picker write is gone', admin.includes(".update({ coverageSystem: value })"), false);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
