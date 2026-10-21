// V101.185: lean quiz runner (mockup C, picked 2026-10-21). The REAL public/index.html renderQuizStep on a phone
// (file://, network blocked, Firebase stubbed): one progress row (position · answered · skipped | language capsule) over a
// tap-to-jump segment bar; capsule in each language's own script without a duplicate of the quiz's own language;
// type tag only for non-choice questions; ‹ Previous; ≤360px the short "5/15 · 3✓ · 1 skipped" with nothing overlapping.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const src = fs.readFileSync('public/index.html', 'utf8');
assert.ok(src.includes("(currentQuiz.shortTitle || currentQuiz.title || 'Quiz') + (isPracticeMode ? ' · Practice' : '')"), 'header names the quiz');
assert.ok(!/class="quiz-focus-map"/.test(src), 'the "Questions" map is gone');

async function open(browser, width, quiz, step, answers) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    page.on('pageerror', () => {});
    await page.goto(INDEX);
    await page.waitForTimeout(500);
    await page.evaluate(([qz, step, answers]) => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        qtBackgroundTranslate = () => {};
        try { localStorage.removeItem('qt_selected_lang'); } catch (_) {}
        currentQuiz = qz; isPracticeMode = false;
        userAnswers = answers.slice();
        shuffleMap = qz.questions.map(() => null);
        currentStep = step;
        document.getElementById('quizModal').style.display = 'flex';
        renderQuizStep(false);
        clearInterval(quizTimerInterval);
    }, [quiz, step, answers]);
    await page.waitForTimeout(200);
    return { page, ctx };
}
const Q = (i, type) => ({ type: type || 'choice', q: 'Question text number ' + i + ' — which is the best response?', options: ['A one', 'B two', 'C three', 'D four'], correct: [0] });
const EN = { id: 'QEN', title: 'PRETEST-1.3 long title', shortTitle: 'PRETEST-1.3', quizType: 'standard', questions: Array.from({ length: 15 }, (_, i) => Q(i + 1, i === 6 ? 'ordering' : 'choice')) };
const TH = { id: 'QTH', title: 'แบบทดสอบ', quizType: 'standard', questions: [{ type: 'choice', q: 'ข้อใดถูกต้องที่สุด', options: ['ก', 'ข'], correct: [0] }, { type: 'choice', q: 'ข้อสอง', options: ['ค', 'ง'], correct: [0] }] };
const answers = Array(15).fill(null); answers[0] = 2; answers[2] = 0; answers[3] = 1;   // Q2 skipped, on Q5

(async () => {
    const browser = await chromium.launch();
    try {
        let { page, ctx } = await open(browser, 390, EN, 4, answers);
        const r = await page.evaluate(() => {
            const m = document.getElementById('quizModal');
            const segs = [...m.querySelectorAll('.qz-seg button')];
            return {
                map: m.querySelectorAll('.quiz-focus-map, .quiz-focus-progress').length,
                long: [...m.querySelectorAll('.qz-long')].map(s => s.textContent.replace(/\s+/g, ' ').trim()),
                segs: segs.map(b => b.className || '-').join(','), cur: segs.findIndex(b => b.getAttribute('aria-current') === 'step'),
                cap: [...m.querySelectorAll('.qz-cap button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
                capNames: [...m.querySelectorAll('.qz-cap button')].map(b => b.getAttribute('aria-label')),
                badge: document.getElementById('quiz-q-type-badge').textContent, badgeShown: getComputedStyle(document.getElementById('quiz-q-type-badge')).display,
                prev: [document.getElementById('btn-quiz-prev').textContent, document.getElementById('btn-quiz-prev').getAttribute('aria-label')],
                langLabel: /Language/.test(m.querySelector('.qt-bar').textContent),
            };
        });
        assert.equal(r.map, 0, 'old counter + "Questions" map gone');
        assert.deepEqual(r.long, ['Question 5 / 15', '3 answered · 1 skipped'], 'position · answered · skipped: ' + JSON.stringify(r.long));
        assert.equal(r.segs, 'ok,-,ok,ok,cur,' + Array(10).fill('-').join(','), 'segments: answered green, current blue');
        assert.equal(r.cur, 4, 'aria-current on the current segment');
        assert.deepEqual(r.cap, ['EN*', 'ไทย', '한', '日', '中'], 'capsule in each script, original first: ' + r.cap);
        assert.ok(!r.capNames.includes('English'), 'no duplicate English chip on an English quiz');
        assert.ok(!r.langLabel, 'no "Language" word');
        assert.equal(r.badge, '', 'no CHOICE tag on a choice question');
        assert.equal(r.badgeShown, 'none');
        assert.deepEqual(r.prev, ['‹', 'Previous question'], '‹ Previous with a spoken name');
        // tap a segment = jump
        await page.locator('.qz-seg button').nth(9).click();
        assert.equal(await page.evaluate(() => currentStep), 9, 'tapping segment 10 jumps to Q10');
        // a non-choice question keeps its tag
        await page.evaluate(() => { currentStep = 6; renderQuizStep(false); clearInterval(quizTimerInterval); });
        assert.equal(await page.textContent('#quiz-q-type-badge'), 'ORDERING', 'non-choice type keeps its tag');
        // tap targets: a segment is at least 22px tall
        assert.ok(await page.evaluate(() => document.querySelector('.qz-seg button').getBoundingClientRect().height >= 22), 'segment tap height ≥ 22px');
        await ctx.close();

        // 320px: short text, one row, nothing overlaps, no sideways scroll
        ({ page, ctx } = await open(browser, 320, EN, 4, answers));
        const n = await page.evaluate(() => {
            const g = s => document.querySelector(s).getBoundingClientRect();
            const shortEl = document.querySelector('.qz-short');
            return { short: shortEl.textContent.replace(/\s+/g, ' ').trim(), shortShown: getComputedStyle(shortEl).display, longShown: getComputedStyle(document.querySelector('.qz-long')).display,
                countRight: g('.qz-count').right, capLeft: g('.qz-cap').left, capRight: g('.qz-cap').right, rowRight: g('.qz-prog').right, countH: g('.qz-count').height,
                over: document.querySelector('#quizModal .modal-content').scrollWidth - document.querySelector('#quizModal .modal-content').clientWidth };
        });
        assert.equal(n.short, '5/15 · 3✓ · 1 skipped', 'short form: ' + n.short);
        assert.ok(n.shortShown !== 'none' && n.longShown === 'none', 'short form shown, long hidden: ' + n.shortShown + '/' + n.longShown);
        assert.ok(n.countRight <= n.capLeft + 0.5 && n.capRight <= n.rowRight + 0.5, 'text and capsule side by side, no overlap: ' + JSON.stringify(n));
        assert.ok(n.countH < 22, 'one line: ' + n.countH);
        assert.ok(n.over <= 1, 'no sideways scroll at 320');
        await ctx.close();

        // a Thai quiz: the original chip says ไทย and there is no separate Thai chip
        ({ page, ctx } = await open(browser, 390, TH, 0, [null, null]));
        const th = await page.evaluate(() => [...document.querySelectorAll('.qz-cap button')].map(b => b.textContent));
        assert.deepEqual(th, ['ไทย', 'EN', '한', '日', '中'], 'Thai quiz capsule: ' + th);
        await ctx.close();
        console.log('PASS: quiz-run lean C — one progress row + language capsule (own scripts, no duplicate), tap-to-jump segments, skipped count, CHOICE tag hidden, ‹ Previous, 320px short form without overlap');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
