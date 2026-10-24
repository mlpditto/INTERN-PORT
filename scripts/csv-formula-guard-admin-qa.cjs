// V102.386: the admin CSV exports neutralise formula-looking cells.
// A cell that starts with = + @ (or - followed by more text) gets a leading ' and is quoted,
// so Excel / Sheets never run a product description or an intern's name as a formula.
// Three admin exports share the rule: pixCsvCell (Personal Info, tested in personal-info-health-qa),
// toCsvField (Alabasta product listings) and the Articles Who-read-it `q` — the last two are tested here
// straight from the source, no browser.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', 'public');
const adm = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const art = fs.readFileSync(path.join(root, 'articles-admin.js'), 'utf8');

function grabFn(src, head) {
    const i = src.indexOf(head);
    assert.ok(i >= 0, 'source has ' + head);
    const j = src.indexOf('\n        }', i);
    assert.ok(j > i, 'end of ' + head);
    return src.slice(i, j + '\n        }'.length);
}

const toCsvField = new Function(grabFn(adm, 'function toCsvField(v) {') + '\nreturn toCsvField;')();
const qLine = art.match(/var q = function \(v\) \{.*?\};/);
assert.ok(qLine, 'articles-admin.js has the Who-read-it q helper');
const q = new Function(qLine[0] + '\nreturn q;')();

for (const [name, f] of [['toCsvField', toCsvField], ['articles q', q]]) {
    assert.equal(f('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"', name + ': formula-looking cell is neutralised, quotes doubled');
    assert.equal(f('+66 81 234 5678'), '"\'+66 81 234 5678"', name + ': leading + is guarded');
    assert.equal(f('@everyone'), '"\'@everyone"', name + ': leading @ is guarded');
    assert.equal(f('-5 mg'), '"\'-5 mg"', name + ': leading minus with more text is guarded');
    assert.equal(f('-'), '-', name + ': a lone dash stays a dash');
    assert.equal(f('plain text'), 'plain text', name + ': plain text untouched');
    assert.equal(f('a,b'), '"a,b"', name + ': a comma still quotes');
    assert.equal(f('say "hi"'), '"say ""hi"""', name + ': quotes doubled');
    assert.equal(f(null), '', name + ': null is empty');
    assert.equal(f(12), '12', name + ': a number is untouched');
    assert.equal(f('2026-10-24'), '2026-10-24', name + ': a date is untouched');
}
assert.equal(toCsvField('line\nbreak'), '"line\nbreak"', 'toCsvField: a newline still quotes');

console.log('PASS: admin CSV exports guard formula-looking cells (toCsvField · Articles Who-read-it q) — = + @ - get a leading \' and are quoted; plain text, numbers and dates untouched');
