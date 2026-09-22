// V101.06: harness for the Tag hygiene panel. Extracts computeQuizTagHygiene
// VERBATIM from public/admin.html (no copy of the logic here) and runs it over a
// fixture that covers every bucket the panel shows.
//   node scripts/quiz-tag-hygiene-check.cjs
const fs = require('fs');
const path = require('path');

// Git checks admin.html out with CRLF on Windows (autocrlf); the markers below are LF.
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const start = html.indexOf('window.computeQuizTagHygiene = function');
const end = html.indexOf('\n        };\n', start);
if (start < 0 || end < 0) { console.error('computeQuizTagHygiene not found in admin.html'); process.exit(1); }
const src = html.slice(start, end + '\n        };'.length);
const window = {};
new Function('window', src)(window);

const quizzes = [
    { id: 'A', tags: 'Headache, Pharmacotherapy, headache' },          // case variant inside one quiz
    { id: 'B', tags: 'Headaches , Drug Interaction' },                  // plural + spacing
    { id: 'C', tags: 'drug-interactions,AI_VARIANT, Pharmacotherapy' }, // punctuation + marker
    { id: 'D', tags: '' },                                              // untagged
    { id: 'E', tags: 'Should Not Count', isHistoryRevision: true },     // skipped
    { id: 'F', questions: [{ q: 'x', tags: 'Ibuprofen' }, { q: 'y', tags: 'pharmacotherapy' }] } // per-question only
];
const h = window.computeQuizTagHygiene(quizzes);

const checks = [
    ['considered', h.considered, 5],
    ['tagged', h.tagged, 3],
    ['untagged', h.untagged, 2],
    ['distinct keys', h.distinct, 6],
    ['top tag is pharmacotherapy x2', `${h.entries[0].key}:${h.entries[0].count}`, 'pharmacotherapy:2'],
    ['case variants', h.caseVariants.map(e => e.key).join(','), 'headache'],
    ['case variant forms', h.caseVariants[0].forms.map(f => `${f.raw}=${f.n}`).join(','), 'Headache=1,headache=1'],
    ['near-duplicate groups', h.nearDuplicates.length, 2],
    ['near-dup group keys', h.nearDuplicates.map(g => g.map(e => e.key).sort().join('|')).sort().join(' ; '), 'drug interaction|drug-interactions ; headache|headaches'],
    ['singletons', h.singletons.length, 5],
    ['markers', h.markers.map(e => e.key).join(','), 'ai_variant'],
    ['per-question distinct', h.perQuestionDistinct, 2],
    ['per-question only', h.perQuestionOnly.join(','), 'ibuprofen'],
    ['empty input', window.computeQuizTagHygiene([]).distinct, 0]
];
let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
