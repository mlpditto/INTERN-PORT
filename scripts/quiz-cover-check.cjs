const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.route('https://quiz.test/', route => route.fulfill({body: '<div></div>', contentType: 'text/html'}));
        // Cover URLs load a routed 1×1 PNG, so the result does not depend on the network (on CI a
        // real example.com answers 404 fast enough to fire onerror mid-test).
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        await page.route('https://example.com/**', route => route.fulfill({status: 200, body: png, contentType: 'image/png'}));
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
        // V100.86: the editor cover image sits inside the .quiz-cover-editor-thumb frame.
        await page.locator('#quiz-cover-editor .quiz-cover-editor-thumb > img').hover();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), true);
        assert.equal(await page.locator('#quiz-cover-hover-preview img').getAttribute('src'), 'https://example.com/cover.webp');
        const sourceBox = await page.locator('#quiz-cover-editor .quiz-cover-editor-thumb > img').boundingBox();
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
        // V101.46 regression: the cover image fails to load while its preview is showing → blur still hides it.
        await page.locator('.quiz-quick-cover').focus();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), true);
        await page.evaluate(() => { document.querySelector('.quiz-quick-cover .quiz-admin-cover img').hidden = true; });
        await page.locator('.quiz-quick-cover').blur();
        assert.equal(await page.locator('#quiz-cover-hover-preview').isVisible(), false, 'Preview hides on blur even after the image failed');
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
        // V100.86: the optional-detail field stays hidden until the ＋ toggle opens it.
        assert.equal(await page.locator('[data-prompt]').isVisible(), false, 'Optional detail is collapsed by default');
        await page.locator('[data-prompt-toggle]').click();
        assert.equal(await page.locator('[data-prompt-toggle]').getAttribute('aria-expanded'), 'true');
        await page.locator('[data-prompt]').fill('Blue pastel');
        assert.equal(await page.locator('#quiz-cover-editor.lang-no-toggle').count(), 1, 'Thai controls must bypass the language text splitter');
        // V100.86: model picker is an icon chip rail (one .active chip), not a <select>.
        assert.equal(await page.locator('[data-model-chip]').count(), 5, 'Five supported image models are available'); // V101.53: + Seedream 5.0 Lite, Muse Image
        assert.equal(await page.locator('[data-model-chip].active').count(), 1);
        assert.equal(await page.locator('[data-model-chip].active').getAttribute('data-value'), 'as/gemini-3.1-flash-image');
        await page.locator('[data-model-chip][data-value="or/openai/gpt-5.4-image-2"]').click();
        assert.equal(await page.locator('[data-model-chip].active').getAttribute('data-value'), 'or/openai/gpt-5.4-image-2');
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
        // V101.54: a 2:3 AI image (Muse clamps 3:4 to 2:3) is cropped to 3:4 before the preview,
        // keeping more of the bottom (title band) than the top; a 3:4 image passes through unchanged.
        await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 40; c.height = 60;
            const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 40, 60); x.fillStyle = '#0000ff'; x.fillRect(0, 45, 40, 15);
            window.tallImage = c.toDataURL('image/png');
            window.callUniversalAI = async () => ({ imageDataUrl: tallImage });
        });
        await page.locator('[data-generate]').click();
        await page.waitForFunction(() => !QuizCover.isBusy());
        const cropped = await page.evaluate(async () => {
            const img = document.querySelector('.quiz-cover-ai-preview img'); await img.decode();
            const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
            const blue = x.getImageData(20, img.naturalHeight - 2, 1, 1).data;
            return { w: img.naturalWidth, h: img.naturalHeight, bottomIsTitleBand: blue[2] > 200 && blue[0] < 60 };
        });
        assert.ok(Math.abs(cropped.w / cropped.h - 0.75) < 0.01 && cropped.h < 60, '2:3 AI image cropped to 3:4 (got ' + cropped.w + 'x' + cropped.h + ')');
        assert.equal(cropped.bottomIsTitleBand, true, 'crop keeps the bottom (title band)');
        await page.locator('[data-discard]').click();
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
