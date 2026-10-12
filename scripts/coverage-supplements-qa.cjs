// V102.194 — "Supplements" is a Quiz Coverage system, placed right before "Other". Real computeQuizCoverageBuckets from public/admin.html.
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
    CASE_SYSTEMS: [mk('cardiovascular', 'Cardiovascular'), mk('respiratory', 'Respiratory'), mk('infection', 'Infections'), mk('other', 'Other')],
    quizTagList: q => String(q.tags || '').split(',').map(s => s.trim()).filter(Boolean),
    questionTagList: () => []
};
const ctx = vm.createContext({ window: win, quizzesData: [], Array, Set, Object, String });
vm.runInContext(src, ctx);

ctx.quizzesData = [
    { id: 's1', tags: 'Supplements' },
    { id: 's2', tags: 'Vitamin D, Supplement' },
    { id: 's3', tags: 'Supplements & Nutraceuticals' },
    { id: 'm1', tags: 'Supplements', coverageSystem: 'cardiovascular' },        // a manual choice beats the auto-match
    { id: 'm2', tags: 'Hypertension', coverageSystem: 'supplements' },           // …and a quiz can be moved INTO Supplements by hand
    { id: 'c1', tags: 'Cardiovascular' },
    { id: 'x1', tags: 'Something unrelated' }
];
const buckets = win.computeQuizCoverageBuckets();
const keys = win._qcovSystems.map(s => s.key);
assert.equal(JSON.stringify(keys.slice(-2)), JSON.stringify(['supplements', 'other']), 'Supplements sits right before Other: ' + keys);   // JSON: arrays built inside the vm have another realm's prototype
assert.equal(keys.filter(x => x === 'supplements').length, 1, 'only once');
assert.equal(JSON.stringify(buckets.supplements.map(q => q.id).sort()), JSON.stringify(['m2', 's1', 's2', 's3']), 'tags Supplement(s) match; a manual move into it counts');
assert.ok(!buckets.supplements.some(q => q.id === 'm1'), 'a manual override elsewhere wins over the auto-match');
assert.ok(buckets.cardiovascular.some(q => q.id === 'm1'), 'm1 stays in its manual system');
const sys = win._qcovSystems.find(s => s.key === 'supplements');
assert.ok(sys.emoji && sys.label.en === 'Supplements' && sys.label.th === 'อาหารเสริม' && sys.label.ko, 'emoji + en/th/ko labels');
console.log('PASS: Supplements is a coverage system before Other — auto-matches Supplement(s) tags, manual move in/out works, one entry');
