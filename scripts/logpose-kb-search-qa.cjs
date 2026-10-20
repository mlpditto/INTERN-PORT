// V102.349 (Log Pose A): Thai-aware knowledge-base search. Runs the REAL kbQueryTerms / kbFindPassages from public/admin.html
// in a vm: Thai questions are split into words (Intl.Segmenter), passages anywhere in a document are found (not only the
// first 2,000 characters), the best passages fit a 20,000-character budget, the folder filter holds, and when nothing
// matches the result says so (no silent "first 3 files").
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

const cut = (marker, endMarker) => { const i = html.indexOf(marker); assert.ok(i > 0, 'found ' + marker); const j = html.indexOf(endMarker, i); assert.ok(j > i, 'end ' + endMarker); return html.slice(i, j); };
const src = cut('        const KB_STOP = new Set([', '        function queryKnowledgeBaseLocal(query)');
assert.ok(/function queryKnowledgeBaseLocal\(query\) \{ return kbFindPassages\(query\)\.text; \}/.test(html), 'the old entry point now delegates');
assert.ok(!/relevantDocs = pool\.slice\(0, 3\)/.test(html), 'no silent "first 3 files" fallback');
assert.ok(/kbLabel = '📎 No match in the knowledge base — general knowledge'/.test(html), 'a miss is said out loud');
assert.ok(/appendResearchMessage\('ai', aiResponse, kbLabel,/.test(html), 'the answer carries the 📎 sources label');

const filter = { value: 'all' };
const ctx = vm.createContext({ document: { getElementById: id => id === 'kb-filter-sidebar' ? filter : null }, knowledgeBaseCache: [], Intl });
vm.runInContext(src + '\nthis.kbQueryTerms = kbQueryTerms; this.kbFindPassages = kbFindPassages;', ctx);
const find = q => JSON.parse(JSON.stringify(ctx.kbFindPassages(q)));   // out of the vm realm, so deepEqual compares plain values

// ---- Thai question → real words, stop words gone
const terms = ctx.kbQueryTerms('ยาลิเทียมมีผลข้างเคียงอะไรบ้าง ช่วยสรุปหน่อย');
assert.ok(terms.includes('ลิเทียม') && terms.includes('ผลข้างเคียง'), 'Thai words found: ' + terms.join('|'));
assert.ok(!terms.includes('อะไร') && !terms.includes('บ้าง') && !terms.includes('ช่วย'), 'question words dropped: ' + terms.join('|'));
assert.deepEqual(Array.from(ctx.kbQueryTerms('What is the dose of Lithium?')), ['dose', 'lithium']);

// ---- a match deep inside a long document (beyond the old 2,000 characters)
const filler = n => 'เนื้อหาทั่วไปเกี่ยวกับการดูแลผู้ป่วยในหอผู้ป่วย '.repeat(n);
ctx.knowledgeBaseCache = [
    { name: '20260401 Psychopharmacology.pdf', folder: 'Psych', content: filler(200) + ' ลิเทียม (lithium) ผลข้างเคียงที่พบบ่อยคือ มือสั่น ปัสสาวะบ่อย ต้องติดตามระดับยาในเลือด ' + filler(50) },
    { name: 'Time&Task Management with AI.pdf', folder: 'Skills', content: filler(30) + ' Pomodoro time blocks. ' },
    { name: 'โรคกระดูกพรุนและยาที่ใช้ในปัจจุบัน.pdf', folder: 'Bone', content: filler(40) + ' อะเลนโดรเนต ทานตอนเช้าขณะท้องว่าง ' },
];
vm.runInContext('knowledgeBaseCache = this.knowledgeBaseCache', ctx);
let r = find('ยาลิเทียมมีผลข้างเคียงอะไรบ้าง');
assert.equal(r.matched, true);
assert.deepEqual(r.sources.map(x => x.name), ['20260401 Psychopharmacology.pdf'], 'only the file that holds the answer: ' + JSON.stringify(r.sources) + ' terms ' + r.terms.join('|'));
assert.ok(r.text.includes('มือสั่น'), 'the passage with the answer is sent');
const at = Number((r.text.match(/from character (\d+)/) || [])[1]);
assert.ok(at > 2000, 'found past the old 2,000-character cut: ' + at);
assert.ok(r.text.length <= 20000 + 400, 'within the budget: ' + r.text.length);

// ---- nothing matches → matched:false, no files sent
r = find('ราคาทองวันนี้เท่าไร');
assert.deepEqual([r.matched, r.text, r.sources.length], [false, '', 0], 'a miss sends nothing');

// ---- folder filter still holds
filter.value = 'Bone';
r = find('ลิเทียม ผลข้างเคียง');
assert.equal(r.matched, false, 'Psych file is outside the Bone folder');
r = find('อะเลนโดรเนต ทานยังไง');
assert.deepEqual(r.sources.map(x => x.name), ['โรคกระดูกพรุนและยาที่ใช้ในปัจจุบัน.pdf']);
filter.value = 'all';

// ---- budget + passage cap on a huge document
ctx.knowledgeBaseCache = [{ name: 'Big.pdf', folder: 'X', content: ('lithium tremor. ' + 'x'.repeat(1100)).repeat(200) }];
vm.runInContext('knowledgeBaseCache = this.knowledgeBaseCache', ctx);
r = find('lithium tremor');
assert.ok(r.text.length <= 20000 + 16 * 120, 'budget respected: ' + r.text.length);
assert.ok(r.sources[0].passages <= 16 && r.sources[0].passages >= 10, 'several passages, capped: ' + r.sources[0].passages);

console.log('PASS: Log Pose KB search — Thai words via Intl.Segmenter, passages anywhere in a document, 20,000-character budget, folder filter, honest miss (no "first 3 files")');
