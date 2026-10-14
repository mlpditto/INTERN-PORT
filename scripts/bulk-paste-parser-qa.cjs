// Bulk Paste parser (parseBulkQuestions, the REAL function cut out of public/admin.html).
// V102.233: a paste where EVERY option sits in its own paragraph (blank line between "ก. …" / "ข. …" / …) while the next question's
// "N. stem" line follows the last option with NO blank line used to come out garbled (stem = an option, options = the next stem…).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const start = html.indexOf('function parseBulkQuestions(text)');
assert.ok(start > 0, 'parseBulkQuestions found');
let depth = 0, k = html.indexOf('{', start);
for (; k < html.length; k++) { if (html[k] === '{') depth++; else if (html[k] === '}') { depth--; if (!depth) break; } }
const ctx = vm.createContext({});
vm.runInContext(html.slice(start, k + 1), ctx);
const parse = t => JSON.parse(JSON.stringify(ctx.parseBulkQuestions(t)));   // out of the vm realm, so deepEqual compares plain arrays
const shape = qs => qs.map(q => q.options.length);

// 1 · the real paste from the owner: 15 questions × 4 options, one option per paragraph
const real = fs.readFileSync(path.join(__dirname, 'fixtures', 'bulk-paste-thai-paragraph-options.txt'), 'utf8');
const r = parse(real);
assert.equal(r.length, 15, 'fifteen questions (was 14, garbled): ' + r.length);
assert.deepEqual(shape(r), Array(15).fill(4), 'every question has its four options');
assert.equal(r[0].q, 'MALA คืออะไร?', 'Q1 stem without the pasted number: ' + r[0].q);
assert.deepEqual(r[0].options, ['ภาวะน้ำตาลในเลือดต่ำรุนแรงจาก metformin', 'ภาวะเลือดเป็นกรดจากกรดแลคติกที่เกี่ยวข้องกับการใช้ metformin', 'ภาวะตับอักเสบเฉียบพลันจาก metformin', 'ภาวะไตวายเฉียบพลันจาก metformin โดยตรง'], 'Q1 options, prefixes stripped');
assert.equal(r[1].q, 'ข้อใดเป็นข้อห้ามใช้ metformin อย่างเด็ดขาด?', 'Q2 stem is the question, not an option');
assert.equal(r[1].options[0], 'ผู้ป่วยเบาหวานชนิดที่ 2 ที่ eGFR 55 ml/min/1.73m²');
assert.equal(r[14].q, 'ข้อใดถูกต้องที่สุดเกี่ยวกับการป้องกัน MALA ในร้านยา/หน่วยบริการปฐมภูมิ?', 'last stem');
assert.equal(r[14].options[3], 'แนะนำให้ผู้ป่วยตรวจเลือดปีละครั้งก็เพียงพอ ไม่ต้องให้คำแนะนำอื่น', 'last option');
assert.ok(r.every(x => !/^[ก-ง]\.\s/.test(x.q) && x.options.every(o => !/^[ก-ง]\.\s/.test(o))), 'no stray "ก." prefixes left in stems or options');

// 2 · the same layout in Latin letters
const latin = ['1. What is a?', '', 'A. one', '', 'B. two', '', 'C. three', '', 'D. four', '2. What is b?', '', 'A. alpha', '', 'B. beta', '', 'C. gamma', '', 'D. delta', '3. What is c?', '', 'A. x', '', 'B. y', '', 'C. z', '', 'D. w'].join('\n');
const l = parse(latin);
assert.deepEqual(l.map(q => q.q), ['What is a?', 'What is b?', 'What is c?']); assert.deepEqual(shape(l), [4, 4, 4]);

// 3 · regressions: the shapes the parser already handled stay as they were
const blank = '1. Stem one?\nA. a1\nB. b1\nC. c1\n\n2. Stem two?\nA. a2\nB. b2\nC. c2';
const b = parse(blank); assert.deepEqual(b.map(q => q.q), ['Stem one?', 'Stem two?'], 'blank-line separated questions'); assert.deepEqual(shape(b), [3, 3]);
const forms = '1. First?\nก. อ1\nข. อ2\nค. อ3\n2. Second?\nก. บ1\nข. บ2\nค. บ3\n3. Third?\nก. ซ1\nข. ซ2\nค. ซ3';
const f = parse(forms); assert.deepEqual(f.map(q => q.q), ['First?', 'Second?', 'Third?'], 'Google-Forms style, no blank lines'); assert.deepEqual(shape(f), [3, 3, 3]);
const single = parse('Which drug?\nA. one\nB. two\nC. three'); assert.equal(single.length, 1); assert.equal(single[0].q, 'Which drug?'); assert.deepEqual(single[0].options, ['one', 'two', 'three']);
// a lone numbered-option question with blank lines between OPTIONS only (not enough numbered stems to be a sequence) is left to the old rules
assert.equal(parse('').length, 0); assert.equal(parse('   ').length, 0);

console.log('PASS: Bulk Paste parser — one-option-per-paragraph pastes (Thai ก./ข./ค./ง. and Latin A./B./C./D.) give 15/3 whole questions; blank-line, Google-Forms and single-question pastes unchanged');
