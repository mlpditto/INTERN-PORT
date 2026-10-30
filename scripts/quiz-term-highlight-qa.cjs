// V101.187: term highlighting in the quiz runner — the REAL public/index.html renderQuizStep + quiz-term-highlight.js on a phone
// (file://, network blocked, Firebase stubbed). Drugs / classes / conditions / doses / labs are wrapped, the last "?" sentence is
// its own block, an exam reference opening the stem becomes a card; options get the same treatment; inputs, the progress row and
// the language capsule are never touched; choosing an answer still works; only spans + the card are added to the markup.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const QUIZ = {
    id: 'QH', title: 'Highlight test', shortTitle: 'HL', quizType: 'standard', questions: [
        { type: 'choice', q: 'PEBC OSCE STATION — Community Pharmacy (Counselling - Interactive). You meet: Mrs. L.T., 68 years old. Atrial fibrillation on warfarin 4 mg PO daily. Last INR 2.4. New prescription: metronidazole 500 mg PO BID x 7 days for bacterial vaginosis. No NSAIDs. What is the BEST thing to say?',
          options: ['Take metronidazole and continue warfarin unchanged.', 'Hold warfarin for 7 days.', 'Check INR in 2-3 days and watch for bleeding.', 'Switch to clindamycin <b>now</b>.'], correct: [2] },
        { type: 'choice', q: 'A patient with T2DM and CKD takes metformin 1 g BID. Which change is safest', options: ['Stop metformin', 'Keep it'], correct: [0] },
    ],
};

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        page.on('pageerror', () => {});
        await page.goto(INDEX);
        await page.waitForFunction(() => typeof window.quizTermHighlight === 'function', null, { timeout: 5000 });
        const render = step => page.evaluate(([qz, step]) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            qtBackgroundTranslate = () => {};
            currentQuiz = qz; isPracticeMode = false; userAnswers = qz.questions.map(() => null); shuffleMap = qz.questions.map(() => null); currentStep = step;
            document.getElementById('quizModal').style.display = 'flex';
            renderQuizStep(false); clearInterval(quizTimerInterval);
            const box = document.getElementById('quiz-run-container'), txt = s => [...box.querySelectorAll(s)].map(e => e.textContent.trim());
            return {
                dr: txt('.qzh-dr'), dc: txt('.qzh-dc'), dx: txt('.qzh-dx'), ds: txt('.qzh-ds'), lb: txt('.qzh-lb'), ask: txt('.qzh-ask'),
                ref: [...box.querySelectorAll('.qzh-ref')].map(e => [e.querySelector('b').textContent, e.querySelector('span').textContent]),
                stemStart: (() => { const c = box.querySelector('.md-render').cloneNode(true); c.querySelectorAll('.qzh-ref').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40); })(),
                optHl: [...box.querySelectorAll('label')].map(l => l.querySelectorAll('[class^="qzh-"]').length),
                inProgress: box.querySelectorAll('.qz-prog [class^="qzh-"], .qz-seg [class^="qzh-"], .qt-bar [class^="qzh-"]').length,
                htmlInjected: box.querySelectorAll('label b').length, lastOpt: box.querySelectorAll('label')[3] && box.querySelectorAll('label')[3].textContent.replace(/\s+/g, ' ').trim(),
                radios: box.querySelectorAll('input[name="q-opt"]').length,
                refFont: box.querySelector('.qzh-ref') ? parseFloat(getComputedStyle(box.querySelector('.qzh-ref')).fontSize) : 0,
                qFont: parseFloat(getComputedStyle(box.querySelector('.md-render')).fontSize),
                refShadow: box.querySelector('.qzh-ref') ? getComputedStyle(box.querySelector('.qzh-ref')).boxShadow : '',
            };
        }, [QUIZ, step]);

        const a = await render(0);
        assert.deepEqual(a.ref, [['PEBC OSCE STATION', 'Community Pharmacy · Counselling – Interactive']], 'exam reference → card: ' + JSON.stringify(a.ref));
        assert.ok(a.stemStart.startsWith('You meet: Mrs. L.T.'), 'the stem itself now starts at "You meet": ' + a.stemStart);
        assert.ok(a.refFont < a.qFont && a.refShadow !== 'none', 'card text smaller than the question, with a shadow: ' + a.refFont + ' / ' + a.qFont);
        assert.ok(['warfarin', 'metronidazole', 'clindamycin'].every(d => a.dr.map(x => x.toLowerCase()).includes(d)), 'drugs: ' + a.dr);
        assert.ok(a.dc.includes('NSAIDs'), 'drug class: ' + a.dc);
        assert.ok(a.dx.includes('Atrial fibrillation') && a.dx.includes('bacterial vaginosis') && a.dx.includes('bleeding'), 'conditions: ' + a.dx);
        assert.ok(a.ds.includes('4 mg PO daily') && a.ds.includes('500 mg PO BID'), 'doses with route / frequency: ' + a.ds);
        assert.ok(a.lb.includes('INR'), 'lab names: ' + a.lb);
        assert.deepEqual(a.ask, ['What is the BEST thing to say?'], 'the question set off: ' + a.ask);
        assert.ok(a.optHl.every(n => n >= 1), 'every option gets the same treatment: ' + a.optHl);
        assert.equal(a.inProgress, 0, 'progress row / segments / language capsule untouched');
        // the highlighter adds only its own spans / card: every other element is the same with it on or off
        const same = await page.evaluate(() => {
            const shape = () => [...document.querySelectorAll('#quiz-run-container *')].filter(e => !/^qzh-/.test(e.className) && !e.closest('.qzh-ref')).map(e => e.tagName).join(',');
            const on = shape(); const keep = window.quizTermHighlight; window.quizTermHighlight = null;
            renderQuizStep(false); clearInterval(quizTimerInterval); const off = shape(); window.quizTermHighlight = keep;
            renderQuizStep(false); clearInterval(quizTimerInterval);
            return [on === off, [...document.querySelectorAll('#quiz-run-container [class^="qzh-"]')].every(e => e.tagName === 'SPAN' || (e.tagName === 'DIV' && e.className === 'qzh-ref'))];
        });
        assert.deepEqual(same, [true, true], 'only spans + the card are added; the rest of the markup is unchanged');
        assert.equal(a.radios, 4, 'all four options still there');
        // answering still works after the wrap
        await page.locator('#quiz-run-container label').nth(2).click();
        assert.equal(await page.evaluate(() => userAnswers[0]), 2, 'tapping an option still records the answer');

        const b = await render(1);
        assert.deepEqual(b.ask, [], 'no "?" → no question block');
        assert.deepEqual(b.ref, [], 'no exam reference → no card');
        assert.ok(b.dr.map(x => x.toLowerCase()).includes('metformin') && b.dx.includes('T2DM') && b.dx.includes('CKD') && b.ds.includes('1 g BID'), JSON.stringify(b));

        // Codex names join when the page holds them
        const c = await page.evaluate(() => { dcState.codex = [{ genericName: 'Zyxomab', brandNames: ['Zyxo-Brand'] }]; currentQuiz.questions[1].q = 'Start Zyxomab or Zyxo-Brand?'; renderQuizStep(false); clearInterval(quizTimerInterval); return [...document.querySelectorAll('#quiz-run-container .qzh-dr')].map(e => e.textContent); });
        assert.ok(c.includes('Zyxomab') && c.includes('Zyxo-Brand'), 'Codex drug + brand names highlight: ' + c);

        // cheap: 60 renders well under a second each
        const ms = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 60; i++) { currentStep = i % 2; renderQuizStep(false); clearInterval(quizTimerInterval); } return (performance.now() - t) / 60; });
        assert.ok(ms < 60, 'render + highlight per question: ' + ms.toFixed(1) + ' ms');
        // V101.250: Thai disease names, and negative findings underlined in the stem only
        const neg = await page.evaluate(() => {
            currentQuiz.questions[1].q = 'หญิงอายุ 32 ปี มีความดันโลหิตสูง ไม่สูบบุหรี่และไม่มีโรคประจำตัว เสี่ยง VTE ข้อใดเหมาะสม';
            currentQuiz.questions[1].options = ['ไม่มีโรคประจำตัว', 'ไม่ต้องตรวจ'];
            renderQuizStep(false);
            const root = document.getElementById('quiz-run-container') || document.querySelector('#quizModal');
            const txt = s => [...root.querySelectorAll(s)].map(e => e.textContent);
            const stem = root.querySelector('.md-render');
            return { dx: txt('.qzh-dx'), ng: txt('.qzh-ng'), inStem: [...root.querySelectorAll('.qzh-ng')].every(e => stem.contains(e)), line: getComputedStyle(root.querySelector('.qzh-ng')).textDecorationLine };
        });
        assert.deepEqual(neg.dx.slice(0, 2), ['ความดันโลหิตสูง', 'VTE'], 'Thai names + VTE: ' + JSON.stringify(neg));
        assert.deepEqual(neg.ng, ['ไม่สูบบุหรี่', 'ไม่มีโรคประจำตัว'], 'each negative finding on its own: ' + JSON.stringify(neg));
        assert.equal(neg.inStem, true, 'never on an option');
        assert.equal(neg.line, 'underline');
        console.log('PASS: quiz term highlighting — drugs / classes / conditions / doses / labs, question block, exam-reference card (smaller, shadow), same on every option, progress + capsule untouched, answers still record, markup otherwise unchanged, Codex names join, ' + ms.toFixed(1) + ' ms per render');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
