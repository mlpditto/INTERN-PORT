// V102.376 (owner, 2026-10-23): the Quiz Editor's READ FIRST box has ONE lean label — "📖 Read first" then the model select + ✨ ☰ ✨ All —
// and the former aside "(own page before the timer starts, kept in the review — markdown)" lives in the textarea placeholder, merged with
// the "Background or vocabulary…" hint. Static: the REAL box markup sliced out of public/admin.html.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.match(admin, /<title>Nika Admin \(V102\.(?:37[6-9]|3[89]\d|[4-9]\d\d)\)<\/title>/, 'admin V102.376+');

const start = admin.indexOf('<div class="q-primer-row"');
assert.ok(start > 0, 'the READ FIRST box is still there');
const box = admin.slice(start, admin.indexOf('</textarea>', start));
const label = box.slice(box.indexOf('<label'), box.indexOf('</label>'));
const labelHead = label.slice(0, label.indexOf('<span style="margin-left:auto'));      // the part before the right-hand controls

assert.ok(/fa-book-open[^]*<\/i>\s*Read first\s*$/.test(labelHead), 'the label is icon + "Read first" and nothing else before the controls: ' + labelHead.slice(-120));
assert.ok(!/own page before the timer/.test(label), 'the aside is gone from the label');
assert.ok(label.includes('${window._qPrimerModelSelect()}') && label.includes('_qPrimerDraft(this, \'full\')') && label.includes('_qPrimerDraft(this, \'terms\')') && label.includes('_qPrimerDraftAll(this)'), 'model select + ✨ + ☰ + ✨ All untouched');

const ph = (box.match(/<textarea class="q-primer" placeholder="([^"]*)"/) || [])[1] || '';
for (const need of ['Background or vocabulary the learner needs before answering', 'own page before the timer starts', 'kept in the review', 'Markdown', 'Do not give away the answer', '(optional)'])
    assert.ok(ph.includes(need), 'placeholder carries: ' + need + ' — ' + ph);
assert.ok(ph.length < 220, 'placeholder stays one sentence-ish: ' + ph.length);
console.log('PASS: READ FIRST head is one lean label; the own-page / review / markdown hint moved into the placeholder with the Background hint');
