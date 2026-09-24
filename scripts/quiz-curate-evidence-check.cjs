// V101.14: harness for the tolerant Curate evidence check. Extracts snapQuote /
// normalizeForMatch / validateProposal VERBATIM from public/quiz-curate.js.
//   node scripts/quiz-curate-evidence-check.cjs
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'quiz-curate.js'), 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('    function normalizeForMatch(text) {');
const b = src.indexOf('    function elapsed(s) {', a);
if (a < 0 || b < 0) { console.error('functions not found'); process.exit(1); }
const api = new Function(src.slice(a, b) + '\nreturn { snapQuote, validateProposal };')();

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// snapQuote
const stem = 'ผู้ป่วยข้อเท้าแพลง การใช้ **Celecoxib** ร่วมกับ **Aescin** มีข้อดีสำคัญที่สุดอย่างไร?';
check('exact quote kept as is', api.snapQuote('**Celecoxib** ร่วมกับ', stem), '**Celecoxib** ร่วมกับ');
check('markdown markers dropped by the model → snapped to the marked source', api.snapQuote('Celecoxib ร่วมกับ Aescin', stem), '**Celecoxib** ร่วมกับ **Aescin**');
check('whitespace + case differences', api.snapQuote('Drug   RESERVOIR', 'forms a drug reservoir within'), 'drug reservoir');
check('curly quotes stripped at the edges, inner text snapped', api.snapQuote('“sharp or burning”', 'characterized as "sharp or burning" in'), 'sharp or burning');
check('curly quote inside the excerpt matches a straight one', api.snapQuote('as “sharp', 'characterized as "sharp or burning" in'), 'as "sharp');
check('edge punctuation trimmed before matching', api.snapQuote('"…Acute Pyelonephritis."', 'diagnosed as Acute Pyelonephritis and'), 'Acute Pyelonephritis');
check('unrelated text → null', api.snapQuote('completely different words', stem), null);
check('too-short target → null', api.snapQuote('**', stem), null);
check('non-string source → null', api.snapQuote('x', undefined), null);

// validateProposal
const questions = [
    { q: 'Q one stem about **Headache** therapy', options: ['alpha', 'beta'], explanation: 'exp one' },
    { q: 'Q two stem about headache dosing', options: ['c', 'd'], explanation: 'exp two' },
    { q: 'Q three stem', options: ['e', 'f'] }
];
const s = { source: { form: { questions } }, pins: new Set([1]) };
const rel = (id, evidence) => ({ id, shared: 's', sharedTh: 'ส', difference: 'd', differenceTh: 'ด', preference: 'p', preferenceTh: 'พ', evidence });
const item = (id, keep, reasonType, related) => ({ id, keep, reasonType, topic: 't', reason: 'r', reasonTh: 'ร', detail: 'd', detailTh: 'ด', impact: 'i', impactTh: 'อ', related });
const data = { questions: [
    item(1, true, 'overlap', [rel(2, [{ id: 1, quote: 'Headache therapy' }, { id: 2, quote: 'HEADACHE  dosing' }])]),   // both snap
    item(2, false, 'overlap', [rel(1, [{ id: 2, quote: 'nonsense not there' }, { id: 1, quote: 'exp one' }])]),        // Q2 side unverifiable → relation dropped → other
    item(3, true, 'quality', [rel(1, [{ id: 3, quote: 'Q three stem' }, { id: 1, quote: 'wrong' }, { id: 1, quote: 'alpha' }])]) // one dropped, still both cited
] };
const out = api.validateProposal(data, s, 2);
check('run survives with adjustments', Array.isArray(out) && out.length, 3);
check('snapped quotes replaced by exact source substrings', out[0].related[0].evidence.map(e => e.quote).join('|'), '**Headache** therapy|headache dosing');
check('relation without evidence for one side dropped', out[1].related.length, 0);
check('overlap without comparisons downgraded to other', out[1].reasonType, 'other');
check('single unverifiable excerpt dropped, relation kept', out[2].related[0].evidence.map(e => e.quote).join('|'), 'Q three stem|alpha');
check('note summarises adjustments', s.evidenceNote, '2 excerpts snapped to the source text · 2 unverifiable excerpts dropped · 1 comparison dropped for lack of evidence · 1 overlap reason downgraded to other');

const clean = { questions: [item(1, true, 'coverage', []), item(2, true, 'coverage', []), item(3, false, 'coverage', [])] };
api.validateProposal(clean, s, 2);
check('clean run → empty note', s.evidenceNote, '');

let threw = '';
try { api.validateProposal({ questions: [item(1, false, 'coverage', []), item(2, true, 'coverage', []), item(3, true, 'coverage', [])] }, s, 2); } catch (e) { threw = e.message; }
// V101.32: an off-target / pin-dropping keep set is no longer rejected outright — it is snapped
// to the model's `priority` ranking (pins first). Without a usable ranking it still throws.
check('pins / target still enforced (no ranking → throws)', /dropped a pinned question, with no usable priority ranking/.test(threw), true);
const ranked = { questions: [item(1, false, 'coverage', []), item(2, true, 'coverage', []), item(3, true, 'coverage', [])] };
ranked.questions.forEach((q, i) => { q.priority = 3 - i; }); // Q1 ranked last, but pinned
const snapped = api.validateProposal(ranked, s, 2);
check('pins / target still enforced (ranked → pin kept, exactly n)', snapped.filter(q => q.keep).map(q => q.id).join(','), '1,3');
threw = '';
try { api.validateProposal({ questions: [item(1, true, 'coverage', [rel(2, [{ id: 9, quote: 'x' }])]), item(2, true, 'coverage', []), item(3, false, 'coverage', [])] }, s, 2); } catch (e) { threw = e.message; }
check('structurally invalid evidence still throws', /invalid source evidence/.test(threw), true);

check('status line reports the note', /\+ \(s\.evidenceNote \? ' · ' \+ s\.evidenceNote : ''\)/.test(src), true);
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
check('admin cache-busts quiz-curate.js', /quiz-curate\.js\?v=V\d+\.\d+/.test(admin), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
