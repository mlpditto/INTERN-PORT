// V102.552: the Jev check button in the real admin.html with a stubbed callable: unsaved quiz, results, Open jumps to the question, a clean quiz, an error, phone width.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage();
      await page.addInitScript(() => {
        const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
        window.firebase = P; window.mermaid = P;
      });
      await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
      await page.goto(ADMIN, { waitUntil: 'load' }); await page.waitForTimeout(400);
      await page.evaluate(() => {
        const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
        window.__calls = []; window.__reply = null;
        window.adminApp = { functions: () => ({ httpsCallable: n => async d => { window.__calls.push([n, d]); if (window.__reply instanceof Error) throw window.__reply; return { data: window.__reply }; } }) };
        window.updateQuizPagination = () => { window.__page = quizQPageIndex; }; window.__closed = 0; window.closeQuizReview = () => { window.__closed++; }; window.__jevBtn = document.createElement('button');
        window.getQuizFormData = () => ({ questions: [{ q: 'on screen', content: '', type: 'choice', options: ['a'], correct: [0], explanation: 'e', timer: 60, tags: [], primer: 'not sent' }] });
      });
      const btn = () => page.evaluate(() => { document.getElementById('edit-quiz-id').value = window.__id || ''; window.jevQuizCheck.run(window.__jevBtn); });
      const box = () => page.locator('#jqc-box').innerText();

      { const html = require('node:fs').readFileSync('public/admin.html', 'utf8'); assert.ok(html.includes('id="jev-quiz-check" class="review-tab" aria-label="Jev check" onclick="jevQuizCheck.run(this)"') && html.includes('${items}${jev}</div>'), 'V102.558: a tab beside Scorecard and Rewrites'); assert.equal(await page.locator('#jev-quiz-check').count(), 0, 'no longer in the editor toolbar'); }
      await btn(); await page.waitForTimeout(50);
      assert.match(await box(), /Save the quiz first/);
      assert.equal((await page.evaluate(() => window.__calls)).length, 0, 'an unsaved quiz spends nothing');
      await page.click('.jqc-x');

      await page.evaluate(() => { window.__id = 'quiz1'; window.__reply = { enabled: true, questions: 15, checked: 40, errors: 1, noExplanation: 2, flags: [
        { kind: 'stale', lang: 'ko', q: null, verdict: 'bad' }, { kind: 'key', q: 2, score: 0.05, verdict: 'bad' }, { kind: 'lang', lang: 'th', q: 7, score: 0.5, verdict: 'look' }] }; });
      await btn(); await page.waitForTimeout(100);
      const t = await box();
      assert.match(t, /Korean translation is older/); assert.match(t, /Q3[\s\S]*points away from the marked answer[\s\S]*0\.05/); assert.match(t, /Q8[\s\S]*Thai translation may differ/);
      assert.match(t, /38 OK/); assert.match(t, /1 could not be checked/); assert.ok(!/not checked/.test(t.replace('could not be checked', '')), 'no pill for an empty list');
      assert.deepEqual((await page.evaluate(() => window.__calls)).at(-1), ['jevCheckQuiz', { quizId: 'quiz1', questions: [{ q: 'on screen', content: '', type: 'choice', options: ['a'], correct: [0], explanation: 'e' }] }], 'V102.557: the questions on screen go, unsaved edits included');
      assert.equal(await page.locator('.jqc-list .jqc-bad').count(), 2);
      assert.equal(await page.locator('.jqc-list .jqc-go').count(), 2, 'a whole-quiz note has nowhere to open');
      const r = await page.locator('#jqc-box').boundingBox();
      assert.ok(r.x >= 0 && r.x + r.width <= width, 'the box fits @' + width);
      await page.locator('.jqc-go').first().click();
      assert.equal(await page.evaluate(() => window.__page), 2, 'Open goes to Q3'); assert.equal(await page.evaluate(() => window.__closed), 1, 'and closes the Review');
      assert.equal(await page.locator('#jqc-box').isVisible(), false);

      // V102.561: skipped questions are chips, repeats come first with both stems one tap away, and skipped questions are never called clean
      await page.evaluate(() => { window.__reply = { enabled: true, questions: 5, checked: 2, errors: 0, noExplanation: 2, unchecked: [3, 4], compared: 9, flags: [], repeats: [{ q: 1, quizId: 'b', title: 'Eye 2', otherQ: 2, score: 0.91, stem: 'first stem', otherStem: 'other stem' }] }; });
      await btn(); await page.waitForTimeout(100);
      { const u = await box(); assert.match(u, /2 OK/); assert.match(u, /2 not checked/); assert.match(u, /1 repeat/); assert.match(u, /Q2[\s\S]*Same fact as Eye 2 Q3[\s\S]*0\.91/); assert.match(u, /Compared 9 likely pairs/); assert.ok(!/Nothing to look at/.test(u)); }
      assert.equal(await page.locator('.jqc-pair').isVisible(), false); await page.click('.jqc-cmp'); assert.match(await page.locator('.jqc-pair').innerText(), /first stem[\s\S]*other stem/);
      await page.locator('.jqc-qs .jqc-go').nth(1).click(); assert.equal(await page.evaluate(() => window.__page), 4, 'a chip opens that question');

      await page.evaluate(() => { window.__reply = { enabled: true, questions: 5, checked: 5, errors: 0, noExplanation: 0, flags: [] }; });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /Nothing to look at/); await page.click('.jqc-x');

      await page.evaluate(() => { window.__reply = { enabled: false }; });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /switched off/); await page.click('.jqc-x');

      await page.evaluate(() => { window.__reply = new Error('down'); });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /Could not reach Jev/);
      assert.equal(await page.evaluate(() => window.__jevBtn.disabled), false, 'can try again');
      await page.context().close();
    }
    console.log('PASS: Jev check — whole-quiz button, unsaved quiz, flags in order, Open jumps, clean, off, error, 390 px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
