// V102.262: Quiz cover style reference — real quiz-cover.js + quiz-cover.css in a page with a fake quizzesData and callUniversalAI.
// 🧬 opens a strip of other quizzes' covers; ≤ 2 can be ticked (a third drops the oldest); Nano Banana 2.1 sends ONE stitched
// sheet as visionData and the reference sentence leads the prompt; a model that cannot take an image (Image 2) sends none and the
// strip is disabled; unticked = no visionData at all (behaviour unchanged).
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('https://quiz.test/', route => route.fulfill({ body: '<div></div>', contentType: 'text/html' }));
    // two real, different-sized PNGs (CORS open, like Storage on the live origin)
    const mk = async (w, h, color) => page.evaluate(({ w, h, color }) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); }, { w, h, color });
    await page.goto('https://quiz.test/');
    const pngs = { a: await mk(120, 160, '#8b5cf6'), b: await mk(300, 300, '#10b981'), c: await mk(90, 120, '#f59e0b') };
    for (const k of Object.keys(pngs)) {
      const buf = Buffer.from(pngs[k].split(',')[1], 'base64');
      await page.route('https://cdn.test/' + k + '.png', route => route.fulfill({ status: 200, body: buf, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
    }
    await page.setContent('<div><div><input id="quiz-title" value="PRETEST-1.2"></div></div>');
    await page.addStyleTag({ content: fs.readFileSync('public/text-ai-chips.css', 'utf8') });
    await page.addStyleTag({ content: fs.readFileSync('public/quiz-cover.css', 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync('public/quiz-cover.js', 'utf8') });
    await page.evaluate(() => {
      window.quizzesData = [{ id: 'q1', title: 'PRETEST-1.1', coverUrl: 'https://cdn.test/a.png' }, { id: 'q2', title: 'PRETEST-1.3', coverUrl: 'https://cdn.test/b.png' }, { id: 'q3', title: 'RP-1', coverUrl: 'https://cdn.test/c.png' }, { id: 'q4', title: 'No cover' }];
      window.calls = [];
      const out = document.createElement('canvas'); out.width = 120; out.height = 160; out.getContext('2d').fillRect(0, 0, 120, 160);
      window.callUniversalAI = async (model, prompt, isJson, vision) => { calls.push({ model, prompt, vision }); return { imageDataUrl: out.toDataURL('image/png') }; };
      localStorage.removeItem('quiz_cover_ai_model');
      QuizCover.set('');
    });
    const ed = page.locator('#quiz-cover-editor');
    // strip hidden until 🧬; only covers that exist are offered
    assert.equal(await ed.locator('[data-refs]').isHidden(), true, 'strip hidden at first');
    await ed.locator('[data-ref-toggle]').click();
    assert.equal(await ed.locator('[data-ref-tile]').count(), 3, 'three quizzes have a cover (the one without is skipped)');
    // ≤ 2 ticked, a third drops the oldest
    const tile = i => ed.locator('[data-ref-tile]').nth(i);
    await tile(0).click(); await tile(1).click();
    assert.deepEqual(await ed.locator('[data-ref-tile]').evaluateAll(b => b.map(x => x.getAttribute('aria-pressed'))), ['true', 'true', 'false']);
    await tile(2).click();
    assert.deepEqual(await ed.locator('[data-ref-tile]').evaluateAll(b => b.map(x => x.getAttribute('aria-pressed'))), ['false', 'true', 'true'], 'a third tick drops the oldest');
    await tile(2).click(); await tile(0).click(); // now 1 and 0
    assert.deepEqual(await ed.locator('[data-ref-tile]').evaluateAll(b => b.map(x => x.getAttribute('aria-pressed'))), ['true', 'true', 'false']);
    // Nano Banana 2.1 (first chip) → generate sends one sheet + the reference line first
    await ed.locator('[data-generate]').click();
    await page.waitForFunction(() => calls.length === 1);
    const c1 = await page.evaluate(() => calls[0]);
    assert.equal(c1.model, 'as/gemini-nano-banana-2.1');
    assert.ok(c1.vision && c1.vision.image_mimetype === 'image/jpeg' && c1.vision.image_base64.length > 200, 'visionData = one JPEG sheet');
    assert.ok(c1.prompt.startsWith('An image is attached: a reference sheet'), 'reference sentence leads the prompt');
    const dims = await page.evaluate(async b64 => { const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob()); return [bmp.width, bmp.height]; }, c1.vision.image_base64);
    assert.deepEqual(dims, [960, 640], 'two 3:4 cells side by side');
    // Image 2 → no image, no sentence, strip disabled
    await page.waitForFunction(() => !QuizCover.isBusy());
    await ed.locator('[data-model-chip]').nth(1).click();
    assert.equal(await ed.locator('[data-refs]').evaluate(e => e.classList.contains('ref-off')), true, 'strip disabled for a model without image input');
    assert.equal(await ed.locator('[data-ref-toggle]').evaluate(e => e.classList.contains('ref-off')), true);
    await ed.locator('[data-generate]').click();
    await page.waitForFunction(() => calls.length === 2);
    await page.waitForFunction(() => !QuizCover.isBusy());
    const c2 = await page.evaluate(() => calls[1]);
    assert.equal(c2.vision, null, 'no visionData for Image 2'); assert.ok(!/reference sheet/.test(c2.prompt), 'no reference sentence for Image 2');
    // nothing ticked → unchanged behaviour on Nano Banana 2.1
    await ed.locator('[data-model-chip]').nth(0).click();
    for (const i of [0, 1]) await tile(i).click();
    assert.deepEqual(await ed.locator('[data-ref-tile]').evaluateAll(b => b.map(x => x.getAttribute('aria-pressed'))), ['false', 'false', 'false']);
    await ed.locator('[data-generate]').click();
    await page.waitForFunction(() => calls.length === 3);
    const c3 = await page.evaluate(() => calls[2]);
    assert.equal(c3.vision, null); assert.ok(!/reference sheet/.test(c3.prompt));
    console.log('PASS: Quiz cover style reference — 🧬 strip of other covers, ≤ 2 refs, one JPEG sheet + leading sentence on Nano Banana 2.1, nothing sent on Image 2 (strip disabled) or when none ticked');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
