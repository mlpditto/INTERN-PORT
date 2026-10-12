// V102.195 — Quiz Coverage: Mental Health + Neurological are ONE system ("Neuro & Mental Health", the neuro chip).
// Real computeQuizCoverageBuckets + the real picker alias from public/admin.html; the shared CASE_SYSTEMS (case taxonomy) is not touched.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

const a = html.indexOf('window.computeQuizCoverageBuckets = function () {');
assert.ok(a > 0, 'function found');
let i = html.indexOf('{', html.indexOf(')', a)), b = 0, k = i;
for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
const src = html.slice(a, k + 1) + ';';

const mk = (key, en) => ({ key, emoji: '•', label: { en, ko: en, th: en } });
const win = {
    CASE_SYSTEMS: [mk('cardio', 'Cardiovascular'), mk('neuro', 'Neurological'), mk('mental', 'Mental Health'), mk('other', 'Other')],
    quizTagList: q => String(q.tags || '').split(',').map(s => s.trim()).filter(Boolean),
    questionTagList: () => []
};
const ctx = vm.createContext({ window: win, quizzesData: [], Array, Set, Object, String });
vm.runInContext(src, ctx);
const base = JSON.stringify(win.CASE_SYSTEMS);

ctx.quizzesData = [
    { id: 'n1', tags: 'Neurological' },
    { id: 'n2', tags: 'Epilepsy, Neurological' },
    { id: 'm1', tags: 'Mental Health' },
    { id: 'both', tags: 'Neurological, Mental Health' },                 // matches both → ONE row, not two
    { id: 'man', tags: 'Hypertension', coverageSystem: 'mental' },       // a stored manual 'mental' lands in the merged chip
    { id: 'c1', tags: 'Cardiovascular' }
];
const buckets = win.computeQuizCoverageBuckets();
const keys = win._qcovSystems.map(s => s.key);
assert.equal(JSON.stringify(keys), JSON.stringify(['cardio', 'neuro', 'infection', 'womens_health', 'supplements', 'other']), 'mental is gone, neuro stays, the coverage-only systems still sit before Other: ' + keys);
assert.ok(!('mental' in buckets), 'no separate mental bucket');
assert.equal(JSON.stringify(buckets.neuro.map(q => q.id).sort()), JSON.stringify(['both', 'm1', 'man', 'n1', 'n2']), 'union, a quiz that matched both is listed once');
const sys = win._qcovSystems.find(s => s.key === 'neuro');
assert.ok(sys.label.en === 'Neuro & Mental Health' && sys.label.th && sys.label.ko, 'merged label (en/th/ko)');
assert.equal(JSON.stringify(win.CASE_SYSTEMS), base, 'the shared case taxonomy is untouched');
// without a mental system the neuro chip is left alone
win.CASE_SYSTEMS = [mk('cardio', 'Cardiovascular'), mk('neuro', 'Neurological'), mk('other', 'Other')];
win.computeQuizCoverageBuckets();
assert.equal(win._qcovSystems.find(s => s.key === 'neuro').label.en, 'Neurological', 'no merge when Mental Health is not there');
// the picker shows the merged chip as selected for a stored 'mental'
assert.ok(html.includes("const ov = (q.coverageSystem === 'mental' ? 'neuro' : q.coverageSystem) || '__auto';"), 'category picker aliases mental → neuro');
console.log('PASS: Quiz Coverage — Mental Health + Neurological merged into one chip (union, no double count, manual mental → merged, case taxonomy untouched)');
