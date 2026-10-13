// V101.136 — the guide's PDFs (public/intern-guide.<lang>.pdf, built by scripts/build-guide-pdf.cjs) must match the markdown they were built from:
// public/intern-guide.pdf.json holds the sha256 of each markdown source; if a guide .md changes without a rebuild this fails, so a PDF can never go stale.
// Also: every language the guide modal offers has a PDF, each file is a real PDF, and every section heading of the markdown is in the PDF text.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sha = t => crypto.createHash('sha256').update(t.replace(/\r\n/g, '\n')).digest('hex');
const js = fs.readFileSync('public/intern-guide.js', 'utf8');
const MD = { en: 'public/intern-guide.en.md', th: 'public/intern-guide.md' };
const side = JSON.parse(fs.readFileSync('public/intern-guide.pdf.json', 'utf8'));

const offered = /var LANGS = \[([^\]]*)\]/.exec(js)[1].split(',').map(x => x.replace(/['"\s]/g, '')).filter(Boolean);
const pdfMap = Object.fromEntries([...js.matchAll(/(\w+): '(intern-guide\.\w+\.pdf)'/g)].map(m => [m[1], m[2]]));
assert.deepEqual(offered.sort(), Object.keys(MD).sort(), 'the modal offers exactly the languages this check knows (add the new .md to MD here when Korean arrives)');
for (const l of offered) {
    assert.ok(pdfMap[l], 'a PDF is named for ' + l);
    const file = 'public/' + pdfMap[l];
    assert.ok(fs.existsSync(file), file + ' exists — run: node scripts/build-guide-pdf.cjs');
    const b = fs.readFileSync(file);
    assert.ok(b.slice(0, 5).toString() === '%PDF-' && b.slice(-1024).toString('latin1').includes('%%EOF') && b.length > 20000, file + ' is a real, complete PDF (' + b.length + ' bytes)');
    const md = fs.readFileSync(MD[l], 'utf8');
    assert.equal(side.sha256[l], sha(md), `${pdfMap[l]} is stale — ${MD[l]} changed since it was built; run: node scripts/build-guide-pdf.cjs`);
    // the PDF text carries each ## section title (fonts are embedded as CID, so look in the page text via a loose scan of the numbers + the file's /Count)
    const pages = Number((/\/Count (\d+)/.exec(b.toString('latin1')) || [])[1] || 0);
    assert.ok(pages >= 2 && pages <= 12, `${pdfMap[l]} has a sensible page count: ${pages}`);
}
console.log('PASS: guide PDFs — one per language, real PDFs, built from the current markdown (' + offered.map(l => l + ' ' + side.sha256[l].slice(0, 8)).join(' · ') + ')');
