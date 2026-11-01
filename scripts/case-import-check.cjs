// V102.560: Import PDF, server side. Flags come from the printed range by code; identifiers in the answer are reported; only JPEGs pass; the prompt asks to keep hospital and stamp out; admin only.
const assert = require('node:assert/strict'), fs = require('node:fs');
const C = require('../functions/case-import.js');

assert.equal(C.flagOf('142', '<130'), 'high');
assert.equal(C.flagOf('13.1', '12-16'), '');
assert.equal(C.flagOf('6.6', '2.6-6.0'), 'high');
assert.equal(C.flagOf('2.0', '2.6 - 6.0'), 'low');
assert.equal(C.flagOf('5.7', '<5.7'), 'limit', 'at the bound of a strict range');
assert.equal(C.flagOf('5.7', '≤5.7'), '');
assert.equal(C.flagOf('60', '>40'), '', 'above a floor is fine');
assert.equal(C.flagOf('Negative', 'Negative'), '', 'words carry no flag');
assert.equal(C.flagOf('1,200', '100-200'), 'high');

assert.deepEqual(C.textWarnings('Hemoglobin 13.1 FBS 92'), []);
assert.deepEqual(C.textWarnings('HN 123456'), ['hn']);
assert.deepEqual(C.textWarnings('1 2345 67890 12 3'), ['id']);
assert.deepEqual(C.textWarnings('a@b.co'), ['email']);
assert.deepEqual(C.textWarnings('tel 081-234-5678'), ['phone']);
assert.deepEqual(C.textWarnings('นางสาว สมศรี'), ['name']);
assert.deepEqual(C.textWarnings('Dr. Somchai'), ['name']);
assert.deepEqual(C.textWarnings('โรงพยาบาลตัวอย่าง'), ['place']);
assert.deepEqual(C.textWarnings('Sample Hospital'), ['place']);

const r = C.parseRead(JSON.stringify({ title: 'Annual check', basics: { age: 40, bp: '118/76' }, labs: [{ test: 'LDL', value: '142', unit: 'mg/dL', range: '<130', flag: 'nope' }, { test: 'Empty', value: '' }], notes: ['Chest X-ray normal'], sensitive: ['Pap smear: negative'] }));
assert.equal(r.title, 'Annual check'); assert.equal(r.basics.age, '40');
assert.deepEqual(r.labs, [{ test: 'LDL', value: '142', unit: 'mg/dL', range: '<130', flag: 'high' }], 'the AI cannot set a flag; empty rows go');
assert.deepEqual(r.sensitive, ['Pap smear: negative']); assert.deepEqual(r.warnings, []);
assert.deepEqual(C.parseRead(JSON.stringify({ title: 'x', labs: [{ test: 'T', value: '1' }], notes: ['โรงพยาบาลตัวอย่าง'] })).warnings, ['place'], 'a hospital in the answer is reported');
assert.equal(C.parseRead('not json'), null); assert.equal(C.parseRead('{"title":"x"}'), null, 'nothing read');

const jpg = '/9j/' + 'A'.repeat(200);
assert.equal(C.validImages([jpg]), true);
assert.equal(C.validImages([]), false);
assert.equal(C.validImages(Array(7).fill(jpg)), false, 'page limit');
assert.equal(C.validImages(['JVBERi0' + 'A'.repeat(200)]), false, 'a PDF cannot pass');
assert.equal(C.validImages(['/9j/' + 'A'.repeat(2 * 1024 * 1024)]), false, 'size limit');
assert.match(C.PROMPT, /hospital or clinic name, or the text of a stamp/);

(async () => {
    let body, url;
    const out = await C.readImages([jpg], 'k', async (u, b) => { url = u; body = b; return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'T', labs: [{ test: 'A', value: '1' }] }) }] } }], usageMetadata: { totalTokenCount: 9 } } }; });
    assert.ok(url.includes('gemini-3.8-flash')); assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
    assert.equal(out.read.title, 'T'); assert.equal(out.tokens, 9);

    const src = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
    const fn = src.slice(src.indexOf('exports.importCaseRead'), src.indexOf('exports.importCaseRead') + 900);
    assert.ok(fn.includes('isAdminToken(request.auth.token)'), 'admin only');
    assert.ok(fn.includes('validImages'), 'checks the images');
    assert.ok(!/\.(set|update|add)\(/.test(fn) && !fn.includes('bucket'), 'stores nothing');
    console.log('PASS case-import-check');
})().catch(e => { console.error(e); process.exit(1); });
