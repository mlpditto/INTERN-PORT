// V102.295: 📄 Import CV sheet — 💬 Review ×2: the same two-model CV review as 📎 Documents, on the text already read for the
// import. REAL gsCv* slice + the REAL apdReviewPrompt / apdReviewHtml / apdRenderReview / apdRunReview from public/admin.html,
// a stubbed callUniversalAI. Covers: chip in the header, two cards labelled A / B with short names, two calls with
// feature resume_review carrying the CV text, a filter re-render keeps the review, an image-only CV gets a message and no
// call, a model error is shown per card, Close clears everything, and the Documents sheet renderer still fills #apd-ai.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('id="gs-cv-review-btn"') && html.includes('id="gs-cv-review"'), 'chip + box in the sheet markup');
const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
const a = html.indexOf('const GS_CV_MODEL'), b = html.indexOf('function gsEditProfileCard(button)');
assert.ok(a > 0 && b > a, 'cv slice found');
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const code = html.slice(a, b) + '\n' + ['function apdReviewPrompt(', 'function apdReviewHtml(', 'function apdRenderReview(', 'async function apdRunReview('].map(m => grab(html, m)).join('\n');
const page_html = `<!doctype html><meta charset="utf-8">${styles}<body style="font-size:16px"><div id="apd-ai"></div>
<div id="gs-pane-profile"><div id="gs-cv-sheet" hidden></div><input id="gs-fullname-th" value="ภัทราพร"><input id="gs-tel" value=""></div>
<script>
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.safeJsonParse = s => JSON.parse(s);
window.__calls = []; window.__answers = {};
window.callUniversalAI = async (model, prompt, isJson, vision, sys, opts) => { window.__calls.push({ model, prompt, isJson, opts }); const a = window.__answers[model]; if (a instanceof Error) throw a; return { text: a }; };
window.apdReviewModels = () => ['gpt-6-luna', 'claude-haiku-4-5'];
window.__init = 0; window.apdInitModelRows = () => { window.__init++; };
window.aiModelShortName = id => ({ 'gpt-6-luna': 'Luna 6', 'claude-haiku-4-5': 'Haiku 4.5' })[id] || id;
var _APPLICANT_EXT = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
${code}
</script>`;
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
        const errs = []; page.on('pageerror', e => { errs.push(e.message); console.error('pageerror:', e.message); });
        await page.setContent(page_html);
        const cvText = 'ภัทราพร สุนทรินทร์ Bachelor of Pharmacy Burapha University GPA 3.21 internship community pharmacy counselling OTC dispensing experience volunteer health camp 2025 ' .repeat(3);
        await page.evaluate(t => {
            _gsCvText = t; _gsCvReviewHtml = '';
            _gsCvRows = gsCvBuildRows({ 'gs-fullname-th': 'ภัทราพร', 'gs-tel': '' }, { fullName: 'ภัทราพร', phone: '0812345678' });
            gsCvRender('CV_test.pdf', '✓ text read from the PDF · 🤖 Claude Opus 5.5');
        }, cvText);
        const btn = page.locator('#gs-cv-review-btn');
        assert.equal(await btn.count(), 1, 'chip in the header');
        assert.match(await btn.textContent(), /Review ×2/);
        assert.ok(await btn.evaluate(e => /รีวิว/.test(e.title) && /리뷰/.test(e.title)), 'tooltip EN · TH · KO');
        assert.equal(await page.locator('#gs-cv-review').isHidden(), true, 'box hidden until asked');
        // two models answer → two cards A / B with short names, two calls with the CV text
        await page.evaluate(() => { window.__answers = {
            'gpt-6-luna': 'Sure: {"summary":"ผู้สมัครมีพื้นฐานร้านยา","strengths":["ให้คำปรึกษา OTC"],"gaps":["ไม่ระบุใบอนุญาต"],"questions":["เคยจ่ายยาเองไหม"],"suggestions":["ใส่เลขใบอนุญาต"]}',
            'claude-haiku-4-5': '{"summary":"GPA ดี ประสบการณ์ค่ายสุขภาพ","strengths":["จิตอาสา"],"gaps":[],"questions":[],"suggestions":["เพิ่มรายละเอียดฝึกงาน"]}' }; });
        await page.evaluate(() => gsCvReview());
        await page.waitForFunction(() => document.querySelectorAll('#gs-cv-review > div').length === 2);
        const calls = await page.evaluate(() => window.__calls);
        assert.deepEqual(calls.map(c => c.model), ['gpt-6-luna', 'claude-haiku-4-5']);
        assert.ok(calls.every(c => c.isJson === true && c.opts.feature === 'resume_review' && c.prompt.includes('GPA 3.21')), 'both calls carry the CV text as resume_review');
        assert.equal(await page.evaluate(() => window.__init), 1, 'the Documents model rows are built first (the picks live there)');
        const heads = await page.$$eval('#gs-cv-review > div > div:first-child', es => es.map(e => e.textContent));
        assert.deepEqual(heads, ['A · Luna 6', 'B · Haiku 4.5'], 'cards named by slot + short name');
        assert.ok(await page.$eval('#gs-cv-review', e => /ผู้สมัครมีพื้นฐานร้านยา/.test(e.textContent) && /ให้คำปรึกษา OTC/.test(e.textContent) && /Not a hiring decision/.test(e.textContent)));
        assert.equal(await page.locator('#gs-cv-review').isVisible(), true);
        if (process.env.CVR_SHOT) await page.locator('#gs-cv-sheet').screenshot({ path: process.env.CVR_SHOT });
        assert.equal(await btn.evaluate(e => e.disabled), false, 'chip re-enabled');
        assert.ok(await page.$eval('#gs-cv-review', e => parseFloat(getComputedStyle(e.querySelector('div > div:first-child')).fontSize) >= 11), 'cards readable inside the 12.5px sheet (16px base)');
        // the review survives a filter re-render
        await page.evaluate(() => gsCvSetFilter('diff'));
        assert.equal(await page.locator('#gs-cv-review > div').count(), 2, 'review kept after re-render');
        assert.equal(await page.locator('#gs-cv-review').isVisible(), true);
        // a model that fails is shown as an error card, the other still renders
        await page.evaluate(() => { window.__calls = []; window.__answers['claude-haiku-4-5'] = new Error('Provider unavailable'); });
        await page.evaluate(() => gsCvReview());
        await page.waitForFunction(() => /Provider unavailable/.test(document.getElementById('gs-cv-review').textContent));
        assert.equal(await page.locator('#gs-cv-review > div').count(), 2);
        assert.ok(await page.$eval('#gs-cv-review', e => /B · Haiku 4.5/.test(e.textContent) && /ผู้สมัครมีพื้นฐานร้านยา/.test(e.textContent)));
        // image-only CV → message, no call
        await page.evaluate(() => { window.__calls = []; _gsCvText = ''; _gsCvReviewHtml = ''; gsCvRender('scan.jpg', '🖼 read as an image (vision model)'); });
        await page.evaluate(() => gsCvReview());
        assert.ok(/read as an image/.test(await page.$eval('#gs-cv-review', e => e.textContent)), 'image-only message');
        assert.equal(await page.evaluate(() => window.__calls.length), 0, 'no call without text');
        // Close clears the state
        await page.evaluate(() => gsCvClose());
        assert.deepEqual(await page.evaluate(() => [_gsCvText, _gsCvReviewHtml, _gsCvRows.length]), ['', '', 0]);
        // the Documents sheet renderer still fills #apd-ai with the same cards
        await page.evaluate(() => apdRenderReview([{ model: 'gpt-6-luna', data: { summary: 'ok' } }, { model: 'claude-haiku-4-5', error: 'x' }]));
        assert.deepEqual(await page.$$eval('#apd-ai > div > div:first-child', es => es.map(e => e.textContent)), ['A · Luna 6', 'B · Haiku 4.5']);
        assert.deepEqual(errs, []);
        console.log('cv-review-two-models-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
