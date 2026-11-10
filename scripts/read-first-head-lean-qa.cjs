// V102.376 (owner, 2026-10-23): the Quiz Editor's READ FIRST box has ONE lean label — "📖 Read first" then the model select + ✨ ☰ ✨ All —
// and the former aside "(own page before the timer starts, kept in the review — markdown)" lives in the textarea placeholder, merged with
// the "Background or vocabulary…" hint. Static: the REAL box markup sliced out of public/admin.html.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.match(admin, /<title>Nika Admin \(V102\.(?:37[6-9]|3[89]\d|[4-9]\d\d)\)<\/title>/, 'admin V102.376+');

// V102.631 (owner pick B + C): no label row at all — "📖 Read first" opens the placeholder; the long hint is the box's title; ✨ + the model logo sit in the corner
const start = admin.indexOf('<div class="q-primer-row qp-b">');
assert.ok(start > 0, 'the READ FIRST box is still there');
const box = admin.slice(start, admin.indexOf('<div class="qp-rail"', start));
assert.ok(!/<label/.test(box), 'no label row');
const ph = (box.match(/<textarea class="q-primer"[^>]*placeholder="([^"]*)"/) || [])[1] || '', tip = (box.match(/<textarea class="q-primer"[^>]*title="([^"]*)"/) || [])[1] || '';
assert.ok(ph.startsWith('📖 Read first') && ph.includes('Markdown') && ph.includes('(optional)') && ph.length < 100, 'short placeholder: ' + ph);
for (const need of ['Background or vocabulary the learner needs before answering', 'own page before the timer starts', 'kept in the review', 'Markdown', 'Do not give away the answer'])
    assert.ok(tip.includes(need), 'the title carries: ' + need + ' — ' + tip);
assert.ok(/<span class="qp-act">\$\{window\._qPrimerModelSelect\(\)\}<button type="button" class="qp-mdl" onclick="_qpRowModel\(this\)"[^>]*><\/button><button type="button" class="q-primer-ai" onclick="_qPrimerDraft\(this, 'full'\)"/.test(box), 'corner: model logo, then ✨');
console.log('PASS: READ FIRST box (V102.631) — no label row; 📖 short placeholder, the full hint in its title; model logo + ✨ in the corner');
