// V102.480 — the quiz editor's "Deadline alert (LINE)" chip. The REAL admin.html in Chromium (network stubbed):
// a new quiz and a legacy quiz (no field) open with it ON; a quiz saved with notifyDeadline:false opens OFF;
// getQuizFormData() carries what the chip says; saveQuiz() writes `notifyDeadline`; the LINE quota card has labels
// for the two new push tags.
//   PLAYWRIGHT_MODULE=... node scripts/quiz-deadline-editor-qa.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const html = fs.readFileSync('public/admin.html', 'utf8');

// static pins — the save path and the quota labels
assert.ok(html.includes("notifyDeadline: formData.notifyDeadline !== false,"), 'saveQuiz writes notifyDeadline');
assert.ok(html.includes("quizDeadlineGroup: 'deadline group'") && html.includes("quizDeadlineDM: 'deadline 1:1'"), 'quota card labels the new tags');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html), 'title carries the version');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof fillQuizForm === 'function' && typeof getQuizFormData === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.evaluate(() => { window.showToast = () => {}; window.triggerAutoSave = () => {}; });

        const state = () => page.evaluate(() => ({
            checked: document.getElementById('quiz-notify-deadline').checked,
            data: getQuizFormData().notifyDeadline,
            label: document.getElementById('quiz-notify-deadline').closest('label').textContent.trim()
        }));

        // the chip is in the markup, ON by default, beside the existing LINE chip
        const inMarkup = await page.evaluate(() => {
            const a = document.getElementById('quiz-notify-group'), b = document.getElementById('quiz-notify-deadline');
            return { same: !!a && !!b && a.closest('div') === b.closest('div'), on: b.defaultChecked, tip: b.closest('label').title };
        });
        assert.ok(inMarkup.same, 'deadline chip sits in the same row as "Notify LINE every submit"');
        assert.ok(inMarkup.on, 'ON in the markup');
        assert.match(inMarkup.tip, /22:00–07:00/, 'the tooltip names quiet hours');

        await page.evaluate(() => fillQuizForm({ id: 'legacy', title: 'Legacy', questions: [] }));
        let s = await state();
        assert.deepEqual([s.checked, s.data], [true, true], 'a quiz saved before the field existed opens ON');

        await page.evaluate(() => fillQuizForm({ id: 'q-off', title: 'Quiet', notifyDeadline: false, questions: [] }));
        s = await state();
        assert.deepEqual([s.checked, s.data], [false, false], 'notifyDeadline:false opens OFF and reads back false');

        await page.evaluate(() => { document.getElementById('quiz-notify-deadline').checked = true; });
        s = await state();
        assert.equal(s.data, true, 'ticking it is read back by getQuizFormData');

        await page.evaluate(() => fillQuizForm({ id: 'q-on', title: 'Loud', notifyDeadline: true, questions: [] }));
        s = await state();
        assert.deepEqual([s.checked, s.data], [true, true]);

        // the opt-out must not touch the other LINE chip
        await page.evaluate(() => { document.getElementById('quiz-notify-deadline').checked = false; });
        const other = await page.evaluate(() => ({ group: getQuizFormData().notifyGroup, dl: getQuizFormData().notifyDeadline }));
        assert.deepEqual(other, { group: false, dl: false }, 'the two chips are independent');

        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS quiz-deadline-editor-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
