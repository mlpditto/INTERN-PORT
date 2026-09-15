const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.route('https://quiz.test/', route => route.fulfill({body: '<div></div>', contentType: 'text/html'}));
        await page.goto('https://quiz.test/');
        await page.setContent('<div><div><input id="quiz-title"></div></div><div id="cards"></div>');
        await page.addStyleTag({content: fs.readFileSync('public/quiz-cover.css', 'utf8')});
        await page.addScriptTag({content: fs.readFileSync('public/quiz-cover.js', 'utf8')});
        await page.evaluate(() => {
            window.calls = 0; window.confirmRunQuiz = () => calls++;
            QuizCover.set('https://example.com/cover.webp');
            if (QuizCover.value() !== 'https://example.com/cover.webp') throw Error('Load cover');
            QuizCover.set('javascript:alert(1)'); if (QuizCover.value()) throw Error('Unsafe URL');
            for (const state of ['start', 'locked', 'collapsed']) {
                const card = document.createElement('div'); card.id = state;
                card.innerHTML = '<div class="assign-header"><div class="assign-icon">Quiz</div><div class="assign-info">Long quiz title</div></div><div class="assign-footer">' + (state === 'locked' ? 'Locked' : '<button class="btn-quiz-cta" onclick="confirmRunQuiz()">Start<span class="quiz-cta-countdown" data-dead="123">2h</span></button>') + '</div>';
                QuizCover.decorate(card, {title: 'Quiz'}, state === 'collapsed'); document.getElementById('cards').append(card);
            }
        });
        assert.equal(await page.locator('#locked button.quiz-cover-thumb').count(), 0);
        assert.equal(await page.locator('#collapsed button.quiz-cover-thumb').count(), 0);
        for (const width of [320, 390, 600]) {
            await page.setViewportSize({width, height: 800});
            assert.equal(await page.locator('#start .assign-footer').isVisible(), false);
            assert.equal(await page.locator('#start .quiz-cover-deadline').isVisible(), true);
        }
        await page.locator('#start button.quiz-cover-thumb').focus(); await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => calls), 1);
        await page.evaluate(() => {window.adminApp = {storage: () => ({ref: () => ({put: async () => {}, getDownloadURL: async () => 'https://example.com/new.webp'})})};});
        // Test processing and upload with an actual canvas-generated valid image.
        await page.evaluate(async () => {
            const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 60;
            const blob = await new Promise(r => canvas.toBlob(r));
            const dt = new DataTransfer(); dt.items.add(new File([blob], 'cover.png', {type:'image/png'}));
            const input = document.querySelector('#quiz-cover-editor input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change'));
        });
        await page.waitForFunction(() => QuizCover.value() === 'https://example.com/new.webp');
        await page.locator('[data-remove]').click(); assert.equal(await page.evaluate(() => QuizCover.value()), '');
        console.log('PASS: cover load/remove/upload with mocked storage, unsafe URL rejection, locked/collapsed protection, mobile deadline, keyboard start.');
    } finally { await browser.close(); }
})();
