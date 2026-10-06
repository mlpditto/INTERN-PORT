// V102.105: Participants modal header, lean — runs the REAL showQuizParticipants() from public/admin.html (file://, network blocked,
// Firebase = self-returning Proxy, fake Firestore). Checks: title + quiz name, Avg, the "need 10+ attempts" chip, the eye and the X
// on ONE row; the chip is a soft shadowed pill with n-of-10 bars and the sentence in its tooltip (no yellow banner); it disappears at
// 10+ attempts (the per-question panel takes over); the eye toggle really hides the Score column; the X closes the modal.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

async function open(browser, width, nAttempts) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
    window.firebase = P; window.mermaid = P;
  });
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(ADMIN, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.evaluate((n) => {
    [...document.querySelectorAll('body > *')].filter(e => /Admin Portal/.test(e.innerText || '')).forEach(e => e.style.setProperty('display', 'none', 'important'));
    const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
    const questions = Array.from({ length: 5 }, (_, i) => ({ type: 'choice', q: 'Q' + (i + 1), options: ['A', 'B', 'C', 'D'], correct: 1 }));
    const attempts = Array.from({ length: n }, (_, i) => ({ id: 'q1_u' + i, quizId: 'q1', userId: 'u' + i, displayName: 'user' + i, status: 'approved', correctCount: 4, totalQuestions: 5, score: 0.8, answers: [1, 1, 1, 1, 0], timestamp: ts(1e12 + i * 1e6) }));
    attempts.push({ id: 'q1_ux', quizId: 'q1', userId: 'ux', displayName: 'ken', status: 'practice_done', isDismissed: true, practiceScore: 3, practiceTotalQ: 5, answers: [null, null, null, null, null], timestamp: ts(1e12) });
    window.quizzesData = [{ id: 'q1', title: 'Retail Pharmacy-1', shortTitle: 'RP-1', quizType: 'standard', totalPoints: 1, questions }];
    window.db = { collection: () => ({ where: () => ({ get: async () => ({ docs: attempts.map(a => ({ id: a.id, data: () => { const { id, ...rest } = a; return rest; } })) }) }), doc: () => ({ get: async () => ({ exists: false }) }) }) };
  }, nAttempts);
  await page.evaluate(() => showQuizParticipants('q1'));
  await page.waitForSelector('#quiz-participants-container table', { timeout: 5000 });
  return { page, ctx, errors };
}

(async () => {
  const browser = await chromium.launch();
  try {
    // ---- desktop, 6 graded attempts (+1 practice) → chip, one row
    {
      const { page, ctx, errors } = await open(browser, 1100, 6);
      assert.equal(await page.locator('#quiz-participants-info').innerText(), 'Retail Pharmacy-1', 'quiz name in the title, no "Quiz:" prefix');
      assert.equal((await page.locator('#quiz-avg-score-badge').innerText()).trim(), '📊 80.0% · 6/7', 'Avg chip');
      assert.match(await page.locator('#quiz-avg-score-badge').getAttribute('title'), /6 graded attempt\(s\) out of 7/, 'Avg explained in the tooltip');
      const chip = page.locator('#quiz-stats-chip .ppl-chip');
      assert.equal(await chip.count(), 1, 'the low-N chip');
      assert.equal(await chip.locator('.ppl-bars i:not(.o)').count(), 6); assert.equal(await chip.locator('.ppl-bars i.o').count(), 4);
      assert.match(await chip.getAttribute('title'), /need 10\+ attempts .*current: 6/);
      assert.equal(await chip.getAttribute('aria-label'), await chip.getAttribute('title'));
      const st = await chip.evaluate(e => { const c = getComputedStyle(e); return { shadow: c.boxShadow, border: c.borderTopWidth }; });
      assert.notEqual(st.shadow, 'none', 'chip has a shadow'); assert.equal(st.border, '0px', 'and no border');
      assert.equal(await page.locator('#quiz-question-stats').innerHTML(), '', 'the yellow banner is gone');
      assert.equal(await page.locator('#quizParticipantsModal >> text=/^Quiz:/').count(), 0, 'no separate Quiz: line');
      // one row: title, Avg, chip, eye, X share a line
      const tops = await page.evaluate(() => ['#quizParticipantsModal .ppl-head h3', '#quiz-avg-score-badge', '#quiz-stats-chip .ppl-chip', '#hideScoresIcon', '#quizParticipantsModal .ppl-head button.ppl-ib'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
      assert(Math.max(...tops) - Math.min(...tops) <= 4, 'header on one row: ' + tops);
      const sz = await page.evaluate(() => ['#hideScoresIcon', '#quizParticipantsModal .ppl-head button.ppl-ib'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
      assert.deepEqual(sz, [[32, 32], [32, 32]], 'eye and X are 32px icon buttons');
      assert.equal(await page.locator('#quizParticipantsModal .close-modal').count(), 0, 'no floating X');
      // the table starts right under the header (it was ~125px lower)
      const tableTop = await page.evaluate(() => document.querySelector('#quiz-participants-container table').getBoundingClientRect().top - document.querySelector('#quizParticipantsModal .modal-content').getBoundingClientRect().top);
      assert(tableTop < 130, 'table starts high: ' + tableTop);

      // eye toggle hides the Score column (it used to throw: no <i> inside the label)
      assert.equal(await page.locator('#quiz-participants-container th:has-text("Score")').count(), 1);
      await page.locator('#hideScoresIcon').click();
      await page.waitForFunction(() => !document.querySelector('#quiz-participants-container th:nth-child(2)') || !/Score/.test(document.querySelector('#quiz-participants-container thead').innerText));
      assert.equal(await page.locator('#hideScoresIcon i.fa-eye-slash').count(), 1, 'eye icon switches');
      await page.locator('#hideScoresIcon').click();
      await page.waitForFunction(() => /Score/.test(document.querySelector('#quiz-participants-container thead').innerText));

      // X closes
      await page.locator('#quizParticipantsModal .ppl-head button.ppl-ib').click();
      assert.equal(await page.locator('#quizParticipantsModal').isVisible(), false, 'X closes the modal');
      // the Proxy-stubbed boot throws a few unrelated errors; what matters here is that nothing from the modal / eye toggle does
      assert.deepEqual(errors.filter(e => /null|undefined|ppl|hideScores|quizStatsLowN|showQuizParticipants|toggleQuizScores/.test(e)), [], 'no modal errors: ' + errors.join(' | '));
      await ctx.close();
    }
    // ---- 10+ graded attempts: no chip, the per-question panel is there
    {
      const { page, ctx } = await open(browser, 1100, 11);
      assert.equal(await page.locator('#quiz-stats-chip .ppl-chip').count(), 0, 'chip gone at 10+');
      assert((await page.locator('#quiz-question-stats').innerHTML()).length > 50, 'per-question panel takes over');
      await ctx.close();
    }
    // ---- phone: the title takes its own line, the rest wraps under it, nothing overflows
    {
      const { page, ctx } = await open(browser, 390, 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at 390');
      const r = await page.evaluate(() => { const t = document.querySelector('#quizParticipantsModal .ppl-head h3').getBoundingClientRect(), a = document.querySelector('#quiz-avg-score-badge').getBoundingClientRect(); return [t.bottom <= a.top + 1, a.right <= innerWidth]; });
      assert.deepEqual(r, [true, true], 'title on its own line, chips inside the screen');
      await ctx.close();
    }
    console.log('PASS: participants header — one lean row (title + quiz, Avg, shadow chip n/10, eye, X), chip gone at 10+, eye toggle works, X closes, phone wraps');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
