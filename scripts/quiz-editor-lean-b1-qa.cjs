// V102.344: Quiz Editor lean batch 1 (owner's mockup pick) — the REAL admin.html in Chromium (network stubbed):
// header ● Live / ◷ Scheduled / Ended / Paused pill · Points and both Beri fields as − n + with the real payout
// (🥇 n · 60% · 40%, ⏱ n · 60% · 20%, same rounding as awardQuizSpeedBeri) · a quiz opened WITH a cover shows one
// summary line (✏️ Change unfolds the generator) · the fixed-frame note reads "3:4", not 🔒.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (u.startsWith('https://cover.test/')) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof updateQuizEditorSummary === 'function' && typeof QuizCover === 'object' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(() => {
            const m = document.getElementById('quizManageModal');
            m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            document.getElementById('quiz-editor-settings').open = true;
            window.showToast = () => {}; window.triggerAutoSave = () => {};
            QuizCover.set(''); updateQuizEditorSummary();
        });
        const txt = id => page.$eval('#' + id, e => e.textContent.trim());
        const val = id => page.$eval('#' + id, e => e.value);
        const step = (id, sign) => page.click(`.qe-num button[onclick="qeStepNum('${id}', ${sign})"]`);

        // ---- Points: − n + feeds the header ⭐ and never goes below 0
        await page.fill('#quiz-total-points', '1');
        await step('quiz-total-points', 1);
        assert.equal(await val('quiz-total-points'), '2');
        assert.equal(await txt('qe-head-points'), '⭐ 2', 'header follows the stepper');
        for (let i = 0; i < 3; i++) await step('quiz-total-points', -1);
        assert.equal(await val('quiz-total-points'), '0', 'floor at 0');

        // ---- Beri: blank = default; the payout matches awardQuizSpeedBeri's rounding; 0 = off; ⏱ needs a Deadline
        await page.fill('#quiz-eb-beri', ''); await page.fill('#quiz-db-beri', ''); await page.fill('#quiz-deadline', '');
        await page.evaluate(() => updateQuizEditorSummary());
        assert.equal(await txt('qe-eb-pay'), '🥇 10 · 6 · 4', 'blank early-bird = default 10');
        assert.equal(await txt('qe-db-pay'), 'needs a Deadline');
        await step('quiz-eb-beri', 1);
        assert.equal(await val('quiz-eb-beri'), '11', 'a blank field steps from its default');
        assert.equal(await txt('qe-eb-pay'), '🥇 11 · 7 · 4');
        await page.fill('#quiz-eb-beri', '0'); await page.evaluate(() => updateQuizEditorSummary());
        assert.equal(await txt('qe-eb-pay'), 'off');
        const local = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
        const now = Date.now(), H = 3600e3;
        await page.fill('#quiz-deadline', local(new Date(now + 77 * H)));
        await page.evaluate(() => updateQuizEditorSummary());
        assert.equal(await txt('qe-db-pay'), '⏱ 5 · 3 · 1', 'beat-deadline 5 → 5 · 3 · 1');
        const row = await page.$eval('.qe-beri-row', r => { const ys = [...r.querySelectorAll('.qe-num')].map(s => Math.round(s.getBoundingClientRect().top)); return { ys, w: [...r.querySelectorAll('.qe-num input')].map(i => i.getBoundingClientRect().width) }; });
        assert.equal(new Set(row.ys).size, 1, 'both Beri steppers on one line: ' + row.ys);
        assert.ok(row.w.every(w => w <= 44), 'narrow number boxes: ' + row.w);

        // ---- Live pill: hidden for a new quiz; state from isActive + the form dates
        await page.evaluate(() => { document.getElementById('edit-quiz-id').value = ''; updateQuizEditorSummary(); });
        assert.equal(await page.$eval('#qe-head-live', e => e.hidden), true, 'new quiz: no pill');
        const pill = async (active, startH, deadH) => {
            await page.fill('#quiz-start-time', startH === null ? '' : local(new Date(now + startH * H)));
            await page.fill('#quiz-deadline', deadH === null ? '' : local(new Date(now + deadH * H)));
            return page.evaluate(a => {
                quizzesData = [{ id: 'q-lean', isActive: a }];
                document.getElementById('edit-quiz-id').value = 'q-lean';
                updateQuizEditorSummary();
                const p = document.getElementById('qe-head-live');
                return [p.hidden, p.dataset.state, p.textContent];
            }, active);
        };
        assert.deepEqual(await pill(true, -48, 77), [false, 'live', '● Live · 3 d left']);
        assert.deepEqual(await pill(true, -48, 5), [false, 'live', '● Live · 5 h left']);
        assert.deepEqual(await pill(true, -48, null), [false, 'live', '● Live'], 'no deadline = open-ended');
        assert.deepEqual(await pill(true, 30, 100), [false, 'scheduled', '◷ Scheduled · in 1 d']);
        assert.deepEqual(await pill(true, -100, -2), [false, 'ended', '⏹ Ended']);
        assert.deepEqual(await pill(false, -48, 77), [false, 'paused', '⏸ Paused'], 'isActive false = Paused');
        const headY = await page.$$eval('#qe-head-points, #qe-head-live', es => es.map(e => Math.round(e.getBoundingClientRect().top)));
        assert.equal(new Set(headY).size, 1, 'pill sits on the header row');
        await pill(true, -48, 77);
        await page.setViewportSize({ width: 390, height: 900 });
        const phone = await page.evaluate(() => { const p = document.getElementById('qe-head-live'), n = document.getElementById('quiz-manage-title'); return { w: Math.round(p.getBoundingClientRect().width), bg: getComputedStyle(p).backgroundColor, label: p.getAttribute('aria-label'), name: Math.round(n.getBoundingClientRect().width) }; });
        assert.deepEqual([phone.w, phone.bg, phone.label], [10, 'rgb(52, 211, 153)', 'Live · 3 d left'], 'phone: a green 10 px dot, words kept for screen readers / tooltip');
        assert.ok(phone.name >= 35, 'phone: the quiz name keeps room (55 px on production): ' + phone.name);
        await page.setViewportSize({ width: 1280, height: 1000 });

        // ---- cover: opened WITH a cover → one summary line; ✏️ Change unfolds; no cover → never folded
        const cover = () => page.evaluate(() => {
            const el = document.getElementById('quiz-cover-editor'), vis = s => { const e = el.querySelector(s); return !!e && e.offsetParent !== null; };
            return { folded: el.classList.contains('is-folded'), sum: vis('.quiz-cover-sum'), gen: vis('[data-generate]'), text: el.querySelector('[data-sum-text]').textContent, h: Math.round(el.getBoundingClientRect().height) };
        });
        await page.evaluate(() => { QuizCover.set('https://cover.test/c.png'); QuizCover.setStyle('manga'); QuizCover.fold(); });
        let c = await cover();
        assert.ok(c.folded && c.sum && !c.gen, 'folded: summary only ' + JSON.stringify(c));
        assert.equal(c.text, '🎌 Manga · 3:4', 'summary = style · frame (no model name: it is not saved with the cover)');
        assert.ok(c.h <= 70, 'one line: ' + c.h);
        await page.click('#quiz-cover-editor [data-unfold]');
        c = await cover();
        assert.ok(!c.folded && !c.sum && c.gen, 'Change unfolds the generator');
        await page.evaluate(() => { QuizCover.set(''); QuizCover.fold(); });
        assert.equal((await cover()).folded, false, 'no cover → stays open');
        await page.evaluate(() => { QuizCover.set('https://cover.test/c.png'); QuizCover.fold(); QuizCover.set('https://cover.test/d.png'); });
        assert.equal((await cover()).folded, false, 'a new cover (upload / apply) keeps the generator open');

        // ---- fixed-frame note
        const lock = await page.$eval('#quiz-cover-editor .quiz-cover-lock', e => [e.textContent.trim(), e.getAttribute('aria-label'), getComputedStyle(e).borderStyle]);
        assert.deepEqual(lock, ['3:4', 'Fixed frame for every style: portrait 3:4, title band', 'dashed'], 'frame note, not a lock');

        assert.deepEqual(errs, []);
        console.log('PASS: Quiz Editor lean batch 1 — Live/Scheduled/Ended/Paused pill, Points + Beri − n + with the real payout, cover summary line + Change, 3:4 frame note');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
