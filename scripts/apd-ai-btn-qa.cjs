// V102.309: the 🤖 button on a Documents row — hover widens it to "Review ×2" and the tooltip names A/B + mode + language;
// ●● vendor dots while the review runs; ✓ then the row repaints with a count of saved reviews; an error path returns to idle.
// The REAL admin.html (Firebase stubbed, every AI/Storage call stubbed; nothing leaves the page). AIB_SHOT=<png> saves a hover shot.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes("${d.contentType === 'application/pdf' ? apdAiBtnHtml(d) : ''}"), 'row uses apdAiBtnHtml');
assert.ok(/@media \(prefers-reduced-motion:reduce\) \{ #applicantDocsModal \.apd-aib,/.test(html), 'reduced motion switches the motion off');
assert.ok(/\} finally \{ apdAiBtnState\(docId, ok \? 'done' : 'idle'\); \}/.test(html), 'every exit of aiReviewApplicantDoc resets the button');

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
        await page.waitForFunction(() => typeof openApplicantDocs === 'function' && typeof apdAiBtnHtml === 'function' && document.readyState === 'complete');
        await page.evaluate(() => {
            window.apdLoadReviews = async () => {};
            preRegData = [{ id: 'P1', fullName: 'นภาพร' }];
            applicantDocsCache = { P1: [{ id: 'd1', name: 'Resume.pdf', path: 'applicant-docs/P1/a.pdf', size: 790 * 1024, contentType: 'application/pdf' }, { id: 'd2', name: 'scan.jpg', path: 'applicant-docs/P1/b.jpg', size: 1000, contentType: 'image/jpeg' }] };
            openApplicantDocs('P1');
            _apdReviews = [{ id: 'r1', docId: 'd1', results: [] }, { id: 'r2', docId: 'd1', results: [] }, { id: 'r3', docId: 'zz', results: [] }];
            renderApplicantDocs();
            localStorage.setItem('apd_review_mode', 'hospital'); localStorage.setItem('apd_review_lang', 'en');
        });
        const probe = () => page.evaluate(() => {
            const b = document.querySelector('#apd-list .apd-aib'), t = b.querySelector('.apd-aib-txt'), cs = getComputedStyle(t);
            return { count: document.querySelectorAll('#apd-list .apd-aib').length, cls: b.className, ic: b.querySelector('.apd-aib-ic').textContent, txt: t.textContent, txtW: parseFloat(cs.maxWidth), txtO: parseFloat(cs.opacity),
                badge: (b.querySelector('.apd-aib-n') || {}).textContent || '', title: b.title, dots: [...b.querySelectorAll('.apd-aib-dots i')].map(i => i.style.background), dotsShown: getComputedStyle(b.querySelector('.apd-aib-dots')).display, w: Math.round(b.getBoundingClientRect().width) };
        });
        let r = await probe();
        assert.equal(r.count, 1, 'only the PDF row has 🤖 (the image row has none)');
        assert.deepEqual([r.cls, r.ic, r.txt, r.txtW, r.txtO, r.badge, r.dotsShown], ['apd-aib', '🤖', 'Review ×2', 0, 0, '2', 'none'], 'idle: icon + badge 2 (two saved reviews of d1, not the other doc), label collapsed, no dots');
        assert.match(r.title, /^AI review ×2 · .+ \+ .+ · 🏪 ร้านยา · TH/, 'title at render time: both models, the mode and language then: ' + r.title);
        const idleW = r.w;
        // hover: the label slides out, the tooltip is re-read (hospital · EN picked after the render), the robot wakes
        await page.hover('#apd-list .apd-aib'); await page.waitForTimeout(350);
        r = await probe();
        assert.ok(r.txtW > 0 && r.txtO === 1 && r.w > idleW + 30, 'hover widens the button to show Review ×2: ' + JSON.stringify({ w: r.w, idleW, txtW: r.txtW, txtO: r.txtO }));
        assert.match(r.title, /· 🏥 โรงพยาบาล · EN ·/, 'tooltip follows the current mode/lang: ' + r.title);
        assert.equal(await page.$eval('#apd-list .apd-aib .apd-aib-ic', e => getComputedStyle(e).animationName), 'apdAiWake', 'the robot wakes on hover');
        if (process.env.AIB_SHOT) await page.locator('#apd-list').screenshot({ path: process.env.AIB_SHOT });
        await page.mouse.move(5, 5); await page.waitForTimeout(250);
        r = await probe(); assert.equal(r.txtW, 0, 'collapses again when the pointer leaves');
        // a run: ●● in the two vendor colours while it waits, ✓ at the end, then the row repaints with badge 3
        await page.evaluate(() => {
            window.adminApp = { storage: () => ({ ref: () => ({ getDownloadURL: async () => 'blob:x' }) }) };
            window.apdExtractPdfText = async () => 'x'.repeat(300);
            window.__go = null; window.apdRunReview = () => new Promise(res => { window.__go = () => res([{ model: 'gpt-6-luna', data: { summary: 'A', strengths: [], gaps: [], questions: [], suggestions: [] } }, { model: 'claude-haiku-4-5', data: { summary: 'B', strengths: [], gaps: [], questions: [], suggestions: [] } }]); });
            window.apdSummarise = async () => null;
            window.apdSaveReview = async (d, results, extra) => { _apdReviews.unshift({ id: 'r4', docId: d.id, results, mode: extra.mode, lang: extra.lang }); return true; };
            window.__run = aiReviewApplicantDoc('d1');
        });
        await page.waitForFunction(() => !!window.__go);
        r = await probe();
        assert.ok(/is-run/.test(r.cls) && /flex/.test(r.dotsShown) && r.dots.length === 2 && r.dots[0] !== r.dots[1] && r.dots.every(Boolean), 'running: ●● in two vendor colours: ' + JSON.stringify(r.dots));
        assert.equal(await page.$eval('#apd-list .apd-aib .apd-aib-ic', e => getComputedStyle(e).display), 'none', 'the icon hides while running');
        assert.equal(await page.$eval('#apd-list .apd-aib .apd-aib-dots i', e => getComputedStyle(e).animationName), 'apdAiPulse');
        // a re-render mid-run (the applicant_docs listener) keeps the running state
        await page.evaluate(() => renderApplicantDocs());
        r = await probe(); assert.ok(/is-run/.test(r.cls) && /flex/.test(r.dotsShown), 'repaint mid-run keeps ●●');
        await page.evaluate(() => window.__go());
        await page.waitForFunction(() => document.querySelector('#apd-list .apd-aib.is-done'));
        r = await probe(); assert.deepEqual([r.ic, /is-run/.test(r.cls)], ['✓', false], '✓ flashes when the run ends');
        await page.waitForFunction(() => !document.querySelector('#apd-list .apd-aib.is-done') && document.querySelector('#apd-list .apd-aib-n'));
        r = await probe(); assert.deepEqual([r.cls, r.ic, r.badge, r.dotsShown], ['apd-aib', '🤖', '3', 'none'], 'after the flash: idle again, badge counts the new review');
        // an error path (PDF cannot be read): straight back to idle, no ✓, badge unchanged
        await page.evaluate(() => { window.apdExtractPdfText = async () => { throw new Error('nope'); }; });
        await page.evaluate(() => aiReviewApplicantDoc('d1'));
        r = await probe(); assert.deepEqual([r.cls, r.ic, r.badge], ['apd-aib', '🤖', '3'], 'error exit resets the button');
        assert.match(await page.$eval('#apd-ai', e => e.textContent), /Could not read the PDF: nope/);
        const mine = errs.filter(e => /apd|Applicant/i.test(e));
        assert.deepEqual(mine, [], 'no sheet errors: ' + mine.join(' | '));
        console.log('PASS: 🤖 row button — hover expands to Review ×2 + wake, tooltip names A/B · mode · lang live, ●● vendor dots while running (survives a repaint), ✓ then badge count, error path idle');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
