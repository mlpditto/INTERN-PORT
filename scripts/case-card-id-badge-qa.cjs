// V102.425: every Case Card carries its case id in the top-right corner — a badge on the preview, and burnt into the downloaded PNG by the page itself.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); return admin.slice(i, admin.indexOf(b, i)); };
const stamp = cut('        function stampCaseIdOnImage(', '        async function _renderCaseCardHtmlComposite(');

// static: the save path wires the badge + the download, and the AI prompt never carries the id
const gen = cut('        async function generateAlabastaCaseCardImage()', '        function buildAlabastaPoneglyphDraft');
assert.ok(gen.includes('stampCaseIdOnImage(finalDataUrl, caseItem.caseId)'), 'the download gets the stamped PNG');
assert.ok(/idBadge\.textContent = caseItem\.caseId \? '#' \+ caseItem\.caseId : ''/.test(gen), 'the preview badge shows #id');
assert.ok(/id="alabasta-case-card-id-badge"[^>]*hidden/.test(admin), 'the badge starts hidden');
assert.ok(!/caseId/.test(cut('        function buildAlabastaCaseCardInfographicPrompt(', '        function buildAlabastaCaseCardMinimalPrompt')), 'the prompt never carries the case id (privacy rule)');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
        await page.addScriptTag({ content: stamp + '; window.stampCaseIdOnImage = stampCaseIdOnImage;' });
        const r = await page.evaluate(async () => {
            const c = document.createElement('canvas'); c.width = 800; c.height = 600;
            const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 800, 600);
            const src = c.toDataURL('image/png');
            const out = await stampCaseIdOnImage(src, '26955');
            const img = new Image(); await new Promise(res => { img.onload = res; img.src = out; });
            const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
            const kg = k.getContext('2d'); kg.drawImage(img, 0, 0);
            const dark = (x0, y0, w, h) => { const d = kg.getImageData(x0, y0, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80) n++; return n; };
            return { same: out === src, w: img.width, h: img.height, topRight: dark(560, 0, 240, 60), topLeft: dark(0, 0, 240, 60), bottom: dark(0, 400, 800, 200),
                none: (await stampCaseIdOnImage(src, '')) === src, bad: (await stampCaseIdOnImage('data:image/png;base64,xx', '1')) === 'data:image/png;base64,xx' };
        });
        assert.equal(r.same, false); assert.deepEqual([r.w, r.h], [800, 600], 'same size');
        assert.ok(r.topRight > 200, 'a dark pill in the top-right corner: ' + r.topRight);
        assert.equal(r.topLeft, 0, 'nothing top-left'); assert.equal(r.bottom, 0, 'nothing below');
        assert.equal(r.none, true, 'no id → the image is returned untouched');
        assert.equal(r.bad, true, 'a broken image → the plain image, never a throw');
        console.log('PASS: Case Card id badge — top-right on the preview, burnt into the PNG, untouched without an id, never in the AI prompt.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
