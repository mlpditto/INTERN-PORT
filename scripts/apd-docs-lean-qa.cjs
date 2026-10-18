// V102.311: 📎 Documents sheet lean — one head line (title · name · 📎+ · ×), rows = type icon · name · ghost size · 🤖 ↗ 🗑,
// mode row = one language chip on the left + emoji-only mode chips. The REAL admin.html, Firebase stubbed, nothing written.
// APD_SHOT=<png> saves the sheet.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!/>\+ Attach<\/button>/.test(html) && !/PDF or image, under 4 MB<\/span>/.test(html), 'the Attach line and its hint are gone');
assert.ok(/class="apd-attach" onclick="document\.getElementById\('apd-file'\)\.click\(\)" title="Attach · PDF or image, under 4 MB/.test(html), '📎+ in the head opens the same file input, hint in the tooltip');
assert.ok(!/apd-mode-lbl" title=/.test(html) && !/<span class="apd-seg"/.test(html), 'no "Mode" label, no TH|EN segment');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI { constructor() {} getGenerativeModel() { return {}; } } export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof openApplicantDocs === 'function' && document.readyState === 'complete');
        const r = await page.evaluate(() => {
            const out = {}, $ = s => document.querySelector(s), txt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
            window.apdLoadReviews = async () => {};
            preRegData = [{ id: 'P1', fullName: 'นภาพร ลักษณวงศ์' }];
            applicantDocsCache = { P1: [] };
            localStorage.removeItem('apd_review_mode'); localStorage.removeItem('apd_review_lang');
            openApplicantDocs('P1');
            out.empty = txt($('#apd-list'));
            applicantDocsCache = { P1: [{ id: 'd1', name: 'Resume_นศภ.นภาพร.pdf', size: 790 * 1024, contentType: 'application/pdf' }, { id: 'd2', name: 'transcript_scan.jpg', size: 1.2 * 1024 * 1024, contentType: 'image/jpeg' }] };
            renderApplicantDocs();
            const head = $('#applicantDocsModal .apd-head');
            out.head = { h3: txt(head.querySelector('h3')), kids: [...head.children].map(k => k.className), attach: txt(head.querySelector('.apd-attach')), attachTitle: head.querySelector('.apd-attach').title, oneLine: head.getBoundingClientRect().height < 34 };
            out.rows = [...document.querySelectorAll('#apd-list .apd-row')].map(r => ({ ic: txt(r.querySelector('.apd-ic')), name: txt(r.querySelector('.apd-name')), kb: txt(r.querySelector('.apd-kb')), btns: [...r.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || '') + ':' + txt(b)), h: Math.round(r.getBoundingClientRect().height) }));
            out.mode = [...$('#apd-mode').children].map(c => c.className + ':' + txt(c));
            apdSetLang('en'); out.langAfter = [...$('#apd-mode').children].map(c => c.className + ':' + txt(c)); out.langChip = $('#apd-mode .apd-lang').getAttribute('onclick');
            apdSetLang('th');
            return out;
        });
        assert.equal(r.empty, 'No documents yet · ยังไม่มีเอกสาร');
        assert.deepEqual(r.head, { h3: '📎 Documents · นภาพร ลักษณวงศ์', kids: ['', 'apd-attach', 'apd-x'], attach: '📎+', attachTitle: 'Attach · PDF or image, under 4 MB · แนบไฟล์ · 파일 첨부', oneLine: true }, 'one head line: title · name · 📎+ · ×');
        assert.deepEqual(r.rows, [
            { ic: '📄', name: 'Resume_นศภ.นภาพร.pdf', kb: '790 KB', btns: ['AI review, two models:🤖Review ×2', 'Open:↗', 'Delete:🗑'], h: r.rows[0].h },   // V102.309: the 🤖 button carries its collapsed label
            { ic: '🖼', name: 'transcript_scan.jpg', kb: '1.2 MB', btns: ['Open:↗', 'Delete:🗑'], h: r.rows[1].h }
        ], 'rows: type icon · name · ghost size · 🤖 (PDF only) ↗ 🗑');
        assert.ok(r.rows.every(x => x.h <= 40), 'one-line rows: ' + JSON.stringify(r.rows.map(x => x.h)));
        assert.deepEqual(r.mode, ['apd-lang:TH', 'apd-mode-chip on:🏪', 'apd-mode-chip:🏥', 'apd-mode-chip:🏭', 'apd-mode-chip:🎓'], 'language chip left, emoji-only modes');
        assert.deepEqual([r.langAfter[0], r.langChip], ['apd-lang:EN', "apdSetLang('th')"], 'the chip shows the current language and flips to the other');
        if (process.env.APD_SHOT) await page.locator('#applicantDocsModal .modal-content').screenshot({ path: process.env.APD_SHOT });
        const mine = errs.filter(e => /apd|Applicant/i.test(e));
        assert.deepEqual(mine, [], 'no sheet errors: ' + mine.join(' | '));
        console.log('PASS: Documents lean — head line with 📎+, one-line rows (icon · name · size · 🤖 ↗ 🗑), TH chip left + emoji modes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
