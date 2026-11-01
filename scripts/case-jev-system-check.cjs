// V102.562: Jev suggests a case's system: identifiers stay out of the request, only sure answers that differ are suggested, one failure does not stop the rest.
const assert = require('node:assert/strict'), fs = require('node:fs');
const S = require('../functions/case-system-suggest.js');

const c = { id: 'a', caseId: 'H7788', customer: 'สมหมาย รักดี', customerTel: '0812345678', displayName: 'Bew', diseaseSystemKey: 'other' };
const raw = `H7788 สมหมาย รักดี โทร 081-234-5678 นายสมศักดิ์ ใจดี อายุ 40 ปี คุณแม่ชื่อ มาลี มา รพ.ศิริราช เมื่อ 7/10 และ 12 มิ.ย. 2530 HN: AB123 a@b.co ตาแดง น้ำตาไหล ได้ยา paracetamol ชื่อยา cetirizine bew`;
const out = S.scrubNote(raw, c);
['H7788', 'สมหมาย', '081', 'สมศักดิ์', 'ใจดี', 'มาลี', 'ศิริราช', '7/10', 'มิ.ย.', 'AB123', 'a@b.co', 'bew'].forEach(x => assert.ok(!out.toLowerCase().includes(x.toLowerCase()), x + ' stays out: ' + out));
['อายุ 40', 'ตาแดง', 'น้ำตาไหล', 'paracetamol', 'ชื่อยา cetirizine'].forEach(x => assert.ok(out.includes(x), x + ' stays in: ' + out));
assert.ok(S.scrubNote('เด็กชาย อายุ 4 ปี ท้องเสีย', {}).includes('อายุ 4'), 'an age after a title is kept');

const systems = [{ key: 'ent', label: 'ENT', symptoms: ['Eye Redness'] }, { key: 'gi', label: 'GI', symptoms: [] }, { key: 'other', label: 'Other', symptoms: [] }, { key: 'bad key', label: 'x' }];
assert.deepEqual(Object.keys(S.criteriaOf(systems)), ['ent', 'gi', 'other'], 'keys are checked');

(async () => {
    const sent = [], answers = { a: ['ent', .95], b: ['gi', .95], c: ['ent', .6], d: ['other', .99], f: ['pizza', .99] };
    const fetch = async (url, o) => {
        const body = JSON.parse(o.body);
        sent.push({ url, body });
        const id = body.state.case_note.match(/case ([a-g])/)[1];
        if (id === 'e') return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ answers: { system: { type: 'choice', choice: answers[id][0], confidence: answers[id][1] } }, usage: { input_tokens: 100 } }) };
    };
    const mk = (id, key) => ({ id, diseaseSystemKey: key, note: `case ${id} อาการทั่วไป เป็นมาสองวันแล้ว`, customer: 'ซ่อนชื่อ' });
    const r = await S.suggestSystems([mk('a', 'other'), mk('b', 'gi'), mk('c', 'other'), mk('d', 'skin'), mk('e', 'skin'), mk('f', 'skin'), { id: 'g', note: 'สั้น' }], systems, { apiKey: 'K', fetch });
    assert.deepEqual(r.suggestions, [{ id: 'a', key: 'ent' }], 'sure, different, not Other, a known key');
    assert.deepEqual([r.checked, r.skipped, r.errors], [4, 1, 2]);
    assert.ok(sent.every(s => s.url === 'https://jev-ai.pro/api/v1/systemone'), 'Jev AI only, whatever the config says');
    assert.ok(sent.every(s => Object.keys(s.body.state).join() === 'case_note' && !JSON.stringify(s.body).includes('ซ่อนชื่อ')), 'the scrubbed note and nothing else about the case');

    const idx = fs.readFileSync('functions/index.js', 'utf8');
    const fn = idx.slice(idx.indexOf('exports.jevSuggestCaseSystems'), idx.indexOf('// ---- Jev: "same fact?"'));
    assert.ok(fn.includes('requireAdminCallable(request)') && fn.includes('enabled === false') && !/console\.|\.set\(|\.update\(/.test(fn), 'admin only, kill switch, writes and logs nothing');
    console.log('case-jev-system-check OK');
})().catch(e => { console.error(e); process.exit(1); });
