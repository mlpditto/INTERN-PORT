// Builds public/intern-guide.<lang>.pdf from the guide's markdown (the file the 📖 Guide modal renders) and writes public/intern-guide.pdf.json —
// the sha256 of each markdown source, which scripts/guide-pdf-qa.cjs checks so a PDF can never silently go stale.
//   node scripts/build-guide-pdf.cjs            (needs: playwright, marked@12 — same parser version the app loads from the CDN)
// Env: PLAYWRIGHT_MODULE=<path to playwright>, MARKED_MODULE=<path to marked> when they are not on NODE_PATH.
// The PDFs use the machine's own fonts (Thai + emoji) — build on a machine that has them (Windows: Leelawadee UI / Tahoma / Segoe UI Emoji).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { marked } = require(process.env.MARKED_MODULE || 'marked');

const ROOT = path.resolve(__dirname, '..', 'public');
const LANGS = {
    en: { md: 'intern-guide.en.md', pdf: 'intern-guide.en.pdf', html: 'en', foot: 'Intern guide' },
    th: { md: 'intern-guide.md', pdf: 'intern-guide.th.pdf', html: 'th', foot: 'คู่มือการใช้งาน' }
    // ko: { md: 'intern-guide.ko.md', pdf: 'intern-guide.ko.pdf', html: 'ko', foot: '이용 안내' }   // when the Korean guide exists
};
const sha = t => crypto.createHash('sha256').update(t.replace(/\r\n/g, '\n')).digest('hex');
const version = (/<title>Internship Portfolio \((V[\d.]+)\)<\/title>/.exec(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')) || [, ''])[1];

const CSS = `
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #1e293b; font: 10.5pt/1.55 "Leelawadee UI", "Tahoma", "Noto Sans Thai", "Segoe UI", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif; }
h1 { font-size: 20pt; margin: 0 0 4mm; color: #0f172a; }
h2 { font-size: 14pt; margin: 8mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid #4361ee; color: #4361ee; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 5mm 0 2mm; break-after: avoid; }
p, li { margin: 0 0 2mm; } ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9.5pt; }
th, td { border: 1px solid #cbd5e1; padding: 1.5mm 2.2mm; text-align: left; vertical-align: top; }
th { background: #f1f5f9; } tr { break-inside: avoid; }
code { background: #f1f5f9; padding: 0 1.2mm; border-radius: 1mm; font-size: 9.5pt; }
blockquote { margin: 2mm 0; padding: 1.5mm 4mm; border-left: 1mm solid #4361ee; color: #475569; background: #f8fafc; }
hr { border: 0; border-top: 1px solid #e2e8f0; margin: 4mm 0; }
strong { font-weight: 700; }
`;

(async () => {
    const browser = await chromium.launch();
    const sums = {};
    try {
        for (const [lang, o] of Object.entries(LANGS)) {
            const md = fs.readFileSync(path.join(ROOT, o.md), 'utf8');
            sums[lang] = sha(md);
            const page = await browser.newPage();
            await page.setContent(`<!doctype html><html lang="${o.html}"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${marked.parse(md)}</body></html>`);
            await page.pdf({
                path: path.join(ROOT, o.pdf), format: 'A4', printBackground: true, displayHeaderFooter: true,
                headerTemplate: '<span></span>',
                footerTemplate: `<div style="width:100%;font:7pt 'Leelawadee UI','Tahoma',sans-serif;color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between"><span>${o.foot}${version ? ' · ' + version : ''}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
            });
            await page.close();
            console.log('wrote', o.pdf, fs.statSync(path.join(ROOT, o.pdf)).size, 'bytes');
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(ROOT, 'intern-guide.pdf.json'), JSON.stringify({ built: version, sha256: sums }, null, 2) + '\n');
    console.log('wrote intern-guide.pdf.json', JSON.stringify(sums));
})().catch(e => { console.error(e); process.exit(1); });
