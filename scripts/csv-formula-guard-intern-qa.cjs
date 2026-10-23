// V101.203: the intern My Cases CSV export (exportCaseStatsCsv) neutralises formula-looking cells.
// Every cell is quoted; one that starts with = + @ (or - followed by more text) gets a leading ',
// so Excel / Sheets never run a note typed as =HYPERLINK(...) as a formula — the same rule the
// admin exports use (pixCsvCell / toCsvField / Articles Who-read-it). Tested straight from the
// source of index.html, no browser.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

const head = 'function csvCell(v) {';
const i = src.indexOf(head);
assert.ok(i >= 0, 'index.html has csvCell');
const j = src.indexOf('\n        }', i);
assert.ok(j > i, 'end of csvCell');
const csvCell = new Function(src.slice(i, j + '\n        }'.length) + '\nreturn csvCell;')();

assert.ok(/const esc = csvCell;/.test(src), 'exportCaseStatsCsv writes every cell through csvCell');

assert.equal(csvCell('plain'), '"plain"', 'every cell is quoted');
assert.equal(csvCell('=1+1'), '"\'=1+1"', 'a leading = is neutralised');
assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"', 'formula-looking cell is neutralised, quotes doubled');
assert.equal(csvCell('+66 81 234 5678'), '"\'+66 81 234 5678"', 'a leading + is guarded');
assert.equal(csvCell('@everyone'), '"\'@everyone"', 'a leading @ is guarded');
assert.equal(csvCell('-5 mg'), '"\'-5 mg"', 'a leading minus with more text is guarded');
assert.equal(csvCell('-'), '"-"', 'a lone dash stays a dash');
assert.equal(csvCell(null), '""', 'null is an empty quoted cell');
assert.equal(csvCell(0), '"0"', 'zero points stay 0');
assert.equal(csvCell('say "hi"'), '"say ""hi"""', 'quotes doubled');
assert.equal(csvCell('2026-10-24'), '"2026-10-24"', 'a date is untouched');
assert.equal(csvCell('ไข้; ไอ'), '"ไข้; ไอ"', 'Thai text untouched');

console.log('PASS: intern My Cases CSV guards formula-looking cells (csvCell) — = + @ - get a leading \' inside the quotes; plain text, numbers and dates untouched');
