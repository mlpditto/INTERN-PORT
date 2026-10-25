// V102.410: 👍 / 👎 on a generated quiz cover — counted per model in _meta/cover_feedback (admin doc; no rules change), shown on the model chip,
// and the reasons picked after a 👎 become correction lines in the NEXT Generate prompt. The REAL quiz-cover.js with a stubbed model + Firestore.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://quiz.test/', route => route.fulfill({ body: '<div></div>', contentType: 'text/html' }));
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        await page.route('https://example.com/**', route => route.fulfill({ status: 200, body: png, contentType: 'image/png' }));
        await page.goto('https://quiz.test/');
        await page.setContent('<div><div><input id="quiz-title"></div></div><div id="cards"></div>');
        await page.addStyleTag({ content: fs.readFileSync('public/text-ai-chips.css', 'utf8') });
        await page.addStyleTag({ content: fs.readFileSync('public/quiz-cover.css', 'utf8') });
        const admin = fs.readFileSync('public/admin.html', 'utf8');
        await page.addScriptTag({ content: admin.match(/        function pickAiImageFromResponse\(resp\) \{[\s\S]*?\n        \}/)[0] });
        await page.evaluate(() => {
            window.writes = []; window.prompts = []; window.fail = false;
            // the saved tally: Image 2 has 2 👍 of 3
            window.db = { collection: name => ({ doc: id => ({
                get: async () => ({ exists: true, data: () => ({ tally: { 'or_openai_gpt-5_4-image-2': { up: 2, down: 1 } } }) }),
                set: async (data, opts) => { if (fail) throw new Error('offline'); writes.push({ path: name + '/' + id, data, opts }); }
            }) }) };
            window.firebase = { firestore: { FieldValue: { increment: n => ({ inc: n }), serverTimestamp: () => 'TS' } } };
            window.adminApp = { storage: () => ({ ref: () => ({ put: async () => {}, getDownloadURL: async () => 'https://example.com/ai.webp' }) }) };
            const canvas = document.createElement('canvas'); canvas.width = 30; canvas.height = 40; window.aiImage = canvas.toDataURL('image/png');
            window.callUniversalAI = async (model, prompt, isJson, vision, key, opts) => { prompts.push({ model, prompt, opts }); return { raw: { imageDataUrl: aiImage } }; };
        });
        await page.addScriptTag({ content: fs.readFileSync('public/quiz-cover.js', 'utf8') });
        await page.evaluate(() => QuizCover.set(''));
        await page.locator('#quiz-title').fill('Cardiology');
        const gen = async () => { await page.locator('[data-generate]').click(); await page.waitForFunction(() => !QuizCover.isBusy()); };
        const last = () => page.evaluate(() => writes[writes.length - 1]);

        // thumbs, not ✓ / ✕ (the hooks stay)
        assert.equal(await page.locator('[data-apply]').innerText(), '👍');
        assert.equal(await page.locator('[data-discard]').innerText(), '👎');
        // the saved tally shows on the model chip
        await page.waitForFunction(() => document.querySelector('[data-model-chip][data-value="or/openai/gpt-5.4-image-2"]').title.includes('👍 2/3'));
        assert.equal((await page.locator('[data-model-chip][data-value="as/gemini-nano-banana-2.1"]').getAttribute('title')).includes('👍'), false, 'no votes → no tally');

        // V102.412: the hint is a faint note to the RIGHT of 👍 / 👎 (inside the candidate row), not a line of its own under it
        await page.locator('[data-model-chip][data-value="or/openai/gpt-5.4-image-2"]').click();
        await gen();
        assert.equal(await page.locator('.quiz-cover-ai-preview .quiz-cover-hint').innerText(), 'Check the image and text, then 👍 to apply it — or 👎 / Generate again to retry');
        const bx = async sel => page.locator(sel).first().boundingBox();
        const down = await bx('[data-discard]'), hint = await bx('.quiz-cover-hint');
        assert.ok(hint.x >= down.x + down.width && Math.abs((hint.y + hint.height / 2) - (down.y + down.height / 2)) < 60, 'the hint sits to the right of the buttons, beside them');
        assert.equal((await page.locator('[role=status]').innerText()).trim(), '', 'no extra status line when nothing was blocked');
        assert.ok(hint.width <= 232, 'a narrow note: ' + hint.width);
        // 👍 = counted for the model AND the style, then applied
        await page.locator('[data-model-chip][data-value="or/openai/gpt-5.4-image-2"]').click();
        await gen();
        await page.locator('[data-apply]').click();
        await page.waitForFunction(() => QuizCover.value() === 'https://example.com/ai.webp');
        let w = await last();
        assert.equal(w.path, '_meta/cover_feedback');
        assert.deepEqual(w.opts, { merge: true });
        assert.deepEqual(JSON.parse(JSON.stringify(w.data)), { tally: { 'or_openai_gpt-5_4-image-2': { up: { inc: 1 } } }, byStyle: { clay: { 'or_openai_gpt-5_4-image-2': { up: { inc: 1 } } } }, updatedAt: 'TS' });
        assert.ok((await page.locator('[data-model-chip][data-value="or/openai/gpt-5.4-image-2"]').getAttribute('title')).includes('👍 3/4'), 'the chip tally follows at once');
        assert.equal(await page.locator('[data-reasons]').isHidden(), true);

        // 👎 = counted, the image is dropped, reason chips appear
        await gen();
        await page.locator('[data-discard]').click();
        w = await last();
        assert.deepEqual(JSON.parse(JSON.stringify(w.data)).tally, { 'or_openai_gpt-5_4-image-2': { down: { inc: 1 } } });
        assert.equal(await page.locator('.quiz-cover-ai-preview').isHidden(), true);
        assert.match(await page.locator('[role=status]').innerText(), /Noted 👎/);
        assert.equal(await page.locator('[data-reasons]').isVisible(), true);
        assert.deepEqual(await page.locator('[data-reasons] button').allInnerTexts(), ['Wrong text', 'Off topic', 'Too plain', 'Not pretty']);
        // a picked reason is counted, and goes into the NEXT prompt only
        await page.locator('[data-reasons] button[data-reason="text"]').click();
        assert.deepEqual(JSON.parse(JSON.stringify((await last()).data)), { reasons: { 'or_openai_gpt-5_4-image-2': { text: { inc: 1 } } }, updatedAt: 'TS' });
        assert.equal(await page.locator('[data-reasons] button[data-reason="text"]').getAttribute('aria-pressed'), 'true');
        await gen();
        let p = await page.evaluate(() => prompts[prompts.length - 1].prompt);
        assert.ok(p.includes('misspelled or garbled text: render the title exactly as given'), 'the fix line is in the prompt');
        assert.ok(p.indexOf('misspelled') < p.indexOf('Treat the following JSON'), 'before the JSON data');
        assert.equal(await page.locator('[data-reasons]').isHidden(), true, 'the reason row closes');
        await gen();
        p = await page.evaluate(() => prompts[prompts.length - 1].prompt);
        assert.equal(p.includes('misspelled or garbled'), false, 'used once, then cleared');

        // V102.419: Grok Imagine 2.0 — a chip of its own, the Image API at 3:4, and the vote counts for it (key = the id with / and . turned into _)
        await page.locator('[data-model-chip][data-value="or/x-ai/grok-imagine-image-2.0"]').click();
        await gen();
        const gp = await page.evaluate(() => prompts[prompts.length - 1]);
        assert.equal(gp.model, 'or/x-ai/grok-imagine-image-2.0');
        assert.deepEqual(gp.opts, { feature: 'quiz_cover', imageApi: true, aspectRatio: '3:4' }, 'the Image API at the collection\'s 3:4');
        await page.locator('[data-apply]').click();
        await page.waitForFunction(() => QuizCover.value() === 'https://example.com/ai.webp');
        assert.deepEqual(JSON.parse(JSON.stringify((await last()).data)).tally, { 'or_x-ai_grok-imagine-image-2_0': { up: { inc: 1 } } }, 'the vote is for Grok');
        await page.evaluate(() => { QuizCover.set(''); });
        await page.locator('[data-model-chip][data-value="or/openai/gpt-5.4-image-2"]').click();
        await gen();
        // a failing save never breaks the editor
        await page.evaluate(() => { fail = true; });
        await page.locator('[data-discard]').click();
        await page.waitForTimeout(50);
        assert.equal(await page.locator('[data-reasons]').isVisible(), true, 'the editor keeps working when the save fails');
        // thumbs on nothing do nothing
        const n = await page.evaluate(() => writes.length);
        await page.evaluate(() => { fail = false; });
        await page.evaluate(() => document.querySelector('[data-discard]').click());   // the button is hidden with no candidate; fire the handler anyway
        assert.equal(await page.evaluate(() => writes.length), n, 'no candidate → no vote');
        assert.deepEqual(errors, []);
        console.log('PASS: cover 👍/👎 — per-model + per-style tally in _meta, chip shows 👍 n/m, reasons become next-prompt fixes (once), save failure harmless.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
