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
                card.innerHTML = '<div class="assign-header"><div class="assign-icon">Quiz</div><div class="assign-info">Long quiz title<div class="quiz-mission-meta">10 items · 1 pt</div></div></div><div class="assign-footer">' + (state === 'locked' ? 'Locked' : '<button class="btn-quiz-cta" onclick="confirmRunQuiz()">Start<span class="quiz-cta-countdown" data-dead="123">2h</span></button>') + '</div>';
                QuizCover.decorate(card, {title: 'Quiz'}, state === 'collapsed'); document.getElementById('cards').append(card);
            }
        });
        assert.equal(await page.locator('#locked button.quiz-cover-thumb').count(), 0);
        assert.equal(await page.locator('#collapsed button.quiz-cover-thumb').count(), 0);
        for (const width of [320, 390, 600, 1100]) {
            await page.setViewportSize({width, height: 800});
            assert.equal(await page.locator('#start .assign-footer').isVisible(), false);
            assert.equal(await page.locator('#start .quiz-cover-deadline').isVisible(), true);
        }
        assert.equal(await page.locator('#start .quiz-mission-meta .quiz-cover-deadline').count(), 1);
        assert.equal(await page.locator('#start .quiz-cta-countdown').count(), 1);
        await page.locator('#start button.quiz-cover-thumb').focus(); await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => calls), 1);
        await page.setViewportSize({width: 390, height: 800});
        await page.evaluate(() => QuizCover.set('https://example.com/cover.webp'));
        await page.locator('#quiz-cover-editor > img').hover();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), true);
        assert.equal(await page.locator('#quiz-cover-hover-preview img').getAttribute('src'), 'https://example.com/cover.webp');
        const sourceBox = await page.locator('#quiz-cover-editor > img').boundingBox();
        const bubbleBox = await page.locator('#quiz-cover-hover-preview').boundingBox();
        assert.ok(bubbleBox.width > sourceBox.width * 3, 'Hover bubble enlarges the cover');
        assert.ok(bubbleBox.x >= 0 && bubbleBox.x + bubbleBox.width <= 390, 'Hover bubble stays inside the viewport');
        await page.locator('#quiz-title').hover();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), false);
        await page.evaluate(() => document.getElementById('cards').insertAdjacentHTML('beforeend', QuizCover.adminThumbnail('https://example.com/table.webp', 'quiz-1')));
        await page.locator('.quiz-quick-cover').focus();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), true);
        assert.equal(await page.locator('#quiz-cover-hover-preview img').getAttribute('src'), 'https://example.com/table.webp');
        await page.locator('.quiz-quick-cover').blur();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), false);
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
        // AI generation stays a preview until accepted; no production API calls.
        const admin = fs.readFileSync('public/admin.html', 'utf8');
        const picker = admin.match(/        function pickAiImageFromResponse\(resp\) \{[\s\S]*?\n        \}/)[0];
        await page.addScriptTag({content: picker});
        await page.evaluate(() => {
            window.aiCalls = 0; window.uploads = 0;
            window.adminApp = {storage: () => ({ref: () => ({put: async () => { uploads++; }, getDownloadURL: async () => 'https://example.com/ai.webp'})})};
            const canvas = document.createElement('canvas'); canvas.width = 30; canvas.height = 40;
            window.aiImage = canvas.toDataURL('image/png');
            window.callUniversalAI = async (...args) => { aiCalls++; window.aiArgs = args; return {raw: {imageDataUrl: aiImage}}; };
        });
        await page.locator('[data-generate]').click();
        assert.equal(await page.evaluate(() => aiCalls), 0, 'Title required');
        await page.locator('#quiz-title').fill('Cardiology');
        await page.locator('[data-prompt]').fill('Blue pastel');
        assert.equal(await page.locator('#quiz-cover-editor.lang-no-toggle').count(), 1, 'Thai controls must bypass the language text splitter');
        assert.equal(await page.locator('[data-model] option').count(), 3, 'Three supported image models are available');
        assert.equal(await page.locator('[data-model]').inputValue(), 'as/gemini-3.1-flash-image');
        await page.locator('[data-model]').selectOption('or/openai/gpt-5.4-image-2');
        assert.equal(await page.evaluate(() => localStorage.getItem('quiz_cover_ai_model')), 'or/openai/gpt-5.4-image-2');
        await page.locator('[data-generate]').click();
        await page.waitForFunction(() => !QuizCover.isBusy());
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), true);
        assert.equal(await page.evaluate(() => QuizCover.value()), '');
        assert.equal(await page.evaluate(() => uploads), 0, 'Preview does not upload');
        assert.match(await page.evaluate(() => aiArgs[1]), /Cardiology/);
        assert.match(await page.evaluate(() => aiArgs[1]), /Blue pastel/);
        assert.match(await page.evaluate(() => aiArgs[1]), /established INTERN-PORT quiz cover collection/);
        assert.equal(await page.evaluate(() => aiArgs[0]), 'or/openai/gpt-5.4-image-2');
        assert.equal(await page.evaluate(() => aiArgs[5].feature), 'quiz_cover');
        await page.locator('[data-apply]').click();
        await page.waitForFunction(() => QuizCover.value() === 'https://example.com/ai.webp');
        assert.equal(await page.evaluate(() => uploads), 1);
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), false);
        await page.locator('[data-generate]').click();
        await page.waitForFunction(() => !QuizCover.isBusy());
        await page.locator('[data-discard]').click();
        assert.equal(await page.evaluate(() => QuizCover.value()), 'https://example.com/ai.webp');
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), false);
        await page.evaluate(() => { window.callUniversalAI = async () => ({text:'No image available'}); });
        await page.locator('[data-generate]').click();
        await page.waitForFunction(() => !QuizCover.isBusy());
        assert.equal(await page.evaluate(() => QuizCover.value()), 'https://example.com/ai.webp');
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), false);
        // Switching quiz invalidates an in-flight result, including its busy state.
        await page.evaluate(() => {
            window.callUniversalAI = () => new Promise(resolve => { window.finishOld = resolve; });
        });
        await page.locator('[data-generate]').click();
        assert.equal(await page.evaluate(() => QuizCover.isBusy()), true);
        await page.evaluate(() => { QuizCover.set('https://example.com/other.webp'); finishOld({imageDataUrl:aiImage}); });
        await page.waitForFunction(() => !QuizCover.isBusy());
        assert.equal(await page.evaluate(() => QuizCover.value()), 'https://example.com/other.webp');
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), false);
        await page.evaluate(() => { window.callUniversalAI = async () => ({imageDataUrl:aiImage}); });
        await page.locator('[data-generate]').click();
        await page.waitForFunction(() => !QuizCover.isBusy());
        for (const width of [320, 390, 1100]) {
            await page.setViewportSize({width, height:800});
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow');
        }
        // Failed uploads can be retried without regenerating or losing the old cover.
        await page.evaluate(() => { window.adminApp.storage = () => ({ref: () => ({put: async () => {throw Error('offline');}})}); });
        await page.locator('[data-apply]').click();
        await page.waitForFunction(() => !QuizCover.isBusy());
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), true);
        assert.equal(await page.evaluate(() => QuizCover.value()), 'https://example.com/other.webp');
        await page.evaluate(() => { window.adminApp.storage = () => ({ref: () => ({put: () => new Promise(resolve => {window.finishUpload = resolve;}), getDownloadURL: async () => 'https://example.com/stale.webp'})}); });
        await page.locator('[data-apply]').click();
        await page.waitForFunction(() => typeof finishUpload === 'function');
        await page.evaluate(() => { QuizCover.set('https://example.com/next.webp'); finishUpload(); });
        await page.waitForFunction(() => !QuizCover.isBusy());
        assert.equal(await page.evaluate(() => QuizCover.value()), 'https://example.com/next.webp');
        assert.equal(await page.locator('.quiz-cover-ai-preview').isVisible(), false);
        console.log('PASS: AI title validation, preview, accept, discard, invalid response, stale generation and responsive layout.');
        console.log('PASS: cover load/remove/upload with mocked storage, unsafe URL rejection, locked/collapsed protection, mobile deadline, keyboard start.');
    } finally { await browser.close(); }
})();
