// V101.12: harness for the AI Curate "Copy" button. Extracts questionPlainText
// VERBATIM from public/quiz-curate.js and checks the clipboard text, plus the
// static wiring (button in both card modes, number passed from both call sites).
//   node scripts/quiz-curate-copy-check.cjs
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'quiz-curate.js'), 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('    function questionPlainText(q, number, missingKey) {');
const b = src.indexOf('\n    }\n', a);
if (a < 0 || b < 0) { console.error('questionPlainText not found'); process.exit(1); }
const fn = new Function(src.slice(a, b + '\n    }'.length) + '\nreturn questionPlainText;')();

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

check('stem + numbered choices + answer key', fn({ q: ' ผู้ป่วยเด็ก 10 ปี ', type: 'choice', correct: 1, options: ['Cefepime', 'Levofloxacin ', 'Pip/Tazo', 'Aztreonam'] }, 2, false),
    'Q2 · ผู้ป่วยเด็ก 10 ปี\n\n1. Cefepime\n2. Levofloxacin  [Answer key]\n3. Pip/Tazo\n4. Aztreonam');
check('multiple correct answers all marked', fn({ q: 'S', type: 'choice', correct: [0, 2], options: ['a', 'b', 'c'] }, 1, false), 'Q1 · S\n\n1. a  [Answer key]\n2. b\n3. c  [Answer key]');
check('missing key → no marker', fn({ q: 'S', type: 'choice', correct: 0, options: ['a', 'b'] }, 3, true), 'Q3 · S\n\n1. a\n2. b');
check('context included when it differs from the stem', fn({ q: 'S', content: 'Case text', type: 'choice', correct: 0, options: ['a'] }, 4, false), 'Q4 · S\n\nCase text\n\n1. a  [Answer key]');
check('context skipped when identical to the stem', fn({ q: 'S', content: 'S', type: 'choice', correct: 0, options: ['a'] }, 4, false), 'Q4 · S\n\n1. a  [Answer key]');
check('ordering type: note instead of markers', fn({ q: 'Order these', type: 'ordering', options: ['x', 'y'] }, 5, false), 'Q5 · Order these\n\n1. x\n2. y\n(Answer key: this option order)');
check('essay: stem only', fn({ q: 'Explain', type: 'essay' }, 6, false), 'Q6 · Explain');
check('no number → bare stem', fn({ q: 'Explain', type: 'essay' }, 0, false), 'Explain');
check('explanation never copied', fn({ q: 'S', explanation: 'secret', type: 'choice', correct: 0, options: ['a'] }, 1, false).includes('secret'), false);

check('button added to the collapsed-row controls', /controls\.append\(copyButton\(q, number, missingKey\)\); \/\/ V101\.12/.test(src), true);
check('compare card: button rides the heading, no extra row', /heading\.append\(copyButton\(s\.source\.form\.questions\[id - 1\], id, s\.source\.missingKeys\.includes\(id\)\)\);/.test(src) && !/controls\.append\(copyButton\(q, number, missingKey\)\); host\.append\(controls\);/.test(src), true);
check('button is icon-only with an aria-label', /button\.innerHTML = icon\('fa-copy'\);/.test(src) && /setAttribute\('aria-label', 'Copy question'/.test(src) && !/node\('button', 'Copy'/.test(src), true);
check('success swaps to a check icon and reverts', /icon\(ok \? 'fa-check' : 'fa-xmark'\)/.test(src) && /button\.innerHTML = icon\('fa-copy'\); button\.classList\.remove\('done'\); \}, 1500\)/.test(src), true);
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'quiz-curate.css'), 'utf8');
check('css: heading is a flex row, copy button is a 28px icon square', /\.curate-compare-card h4\{[^}]*display:flex;[^}]*justify-content:space-between/.test(css) && /\.curate-copy\{[^}]*width:28px;height:28px;min-height:0/.test(css), true);
check('compare call site passes the number', /s\.source\.missingKeys\.includes\(id\), id\); grid\.append\(card\);/.test(src), true);
check('list call site passes the number', /sourceView\(row\.querySelector\('\.curate-source'\), q, false, \[\], s\.source\.missingKeys\.includes\(id\), id\);/.test(src), true);
check('clipboard API with execCommand fallback', /navigator\.clipboard\.writeText\(text\)[\s\S]*document\.execCommand\('copy'\)/.test(src), true);
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
check('admin cache-busts both curate assets', /quiz-curate\.css\?v=V\d+\.\d+/.test(admin) && /quiz-curate\.js\?v=V\d+\.\d+/.test(admin), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
