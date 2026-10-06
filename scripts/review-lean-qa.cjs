// V102.98: Review Quiz Attempt, lean — runs the REAL reviewQuiz() from public/admin.html (file://, network blocked, Firebase = self-returning
// Proxy, fake attempt doc). Checks: one-row header with icon buttons, Full marks / Actual buttons (Manten / Shōjiki only in the tooltip),
// ONE strip of Cheat / Timing chips whose detail cards open themselves on Moderate / High, the AI-model rail only when the quiz has a
// free-text question, a PRACTICE badge for practice_done attempts, and the approve buttons disabled once approved.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

const choiceQ = (i) => ({ type: 'choice', q: 'Question ' + (i + 1), options: ['A', 'B', 'C', 'D'], correct: 1 });
const baseQuiz = () => ({ id: 'q1', title: 'Retail Pharmacy-1', shortTitle: 'RP-1', quizType: 'standard', totalPoints: 1, questions: Array.from({ length: 6 }, (_, i) => choiceQ(i)) });
const baseAttempt = (extra) => Object.assign({ quizId: 'q1', userId: 'u1', displayName: 'nt', pictureUrl: '', status: 'pending', correctCount: 6, totalQuestions: 6, answers: [1, 1, 1, 1, 1, 1] }, extra || {});

async function open(browser, { quiz, attempt, cheat }) {
  const ctx = await browser.newContext({ viewport: { width: 940, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
    window.firebase = P; window.mermaid = P;
  });
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(ADMIN, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.evaluate(({ quiz, attempt, cheat }) => {
    [...document.querySelectorAll('body > *')].filter(e => /Admin Portal/.test(e.innerText || '')).forEach(e => e.style.setProperty('display', 'none', 'important'));
    attempt.cheatMonitoring = cheat || {};
    attempt.timestamp = { toDate: () => new Date(), toMillis: () => Date.now() };
    window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => attempt }) }) }) };
    window.quizzesData = [quiz]; window.usersData = [];
    window.renderMdInline = window.renderMdInline || (t => String(t == null ? '' : t));
  }, { quiz, attempt, cheat });
  await page.evaluate(() => reviewQuiz('q1_u1'));
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#reviewQuizOverlay').count(), 1, 'overlay renders' + (dialogs.length ? ': ' + dialogs[0] : ''));
  return { page, ctx };
}

(async () => {
  const browser = await chromium.launch();
  try {
    // ---- 1. a normal attempt: nothing risky
    {
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt() });
      const hdr = page.locator('#reviewQuizOverlay > div > div').first();
      const h = await hdr.evaluate(n => n.getBoundingClientRect().height);
      assert(h <= 70, 'header is one row (was ~140px): ' + h);
      const tops = await hdr.locator('button').evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().top)));
      assert(Math.max(...tops) - Math.min(...tops) <= 6, 'header buttons share a row: ' + tops);
      const labels = await hdr.locator('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || b.innerText).trim()));
      assert.deepEqual(labels, ['Feedback', 'Timing config', 'Export PDF', '🍎 Full marks 100%', '🍇 Actual 1.00 pts', 'Close'], 'buttons: ' + labels);
      // Manten / Shōjiki live in the tooltip only
      const headText = await hdr.innerText();
      assert(!/Manten|Shōjiki/.test(headText), 'fruit names are not on the buttons');
      assert.match(await hdr.locator('button', { hasText: 'Full marks' }).getAttribute('title'), /Manten Manten no Mi/);
      assert.match(await hdr.locator('button', { hasText: 'Actual' }).getAttribute('title'), /Shōjiki Shōjiki no Mi/);
      assert.match(await hdr.locator('button', { hasText: 'Full marks' }).getAttribute('onclick'), /approveQuizAttempt\('q1_u1'\)/);
      assert.match(await hdr.locator('button', { hasText: 'Actual' }).getAttribute('onclick'), /approveQuizAttemptActual\('q1_u1'\)/);
      assert.match(await hdr.locator('button[aria-label="Export PDF"]').getAttribute('onclick'), /exportIncorrectToPDF\(\)/);
      assert.match(await hdr.locator('button[aria-label="Close"]').getAttribute('onclick'), /closeReviewOverlay\(\)/);
      assert.equal(await hdr.locator('text=PRACTICE attempt').count(), 0, 'no practice badge on a normal attempt');
      // the strip: Cheat None + Timing, details folded
      const chips = page.locator('#reviewQuizOverlay .rv-sig');
      assert.equal(await chips.count(), 2, 'Cheat + Timing chips (the timing card exists whenever the quiz has questions)');
      assert.match(await chips.first().innerText(), /Cheat\s+None/);
      assert.match(await chips.nth(1).innerText(), /Timing\s+Normal/);
      assert.equal(await page.locator('#rv-sig-timing').isHidden(), true, 'a normal timing reading stays folded');
      assert.equal(await page.locator('#rv-sig-cheat').isHidden(), true, 'a clean reading stays folded');
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Cheat Monitoring Summary').isVisible(), false);
      // toggling
      await chips.first().click();
      assert.equal(await page.locator('#rv-sig-cheat').isVisible(), true);
      assert.equal(await chips.first().getAttribute('aria-expanded'), 'true');
      await chips.first().click();
      assert.equal(await page.locator('#rv-sig-cheat').isHidden(), true);
      // no AI-model rail on an all-choice quiz; question 1 is on the first screen
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Short-answer AI model').count(), 0);
      const q1 = await page.locator('#reviewQuizOverlay >> text=Q1').first().evaluate(n => n.getBoundingClientRect().top);
      assert(q1 < 400, 'Q1 is on the first screen: top=' + q1);
      // every answer is right → one merged row per question ("Student = Correct"), no separate Student: / Correct: rows
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Student = Correct:').count(), 6, 'six merged rows');
      assert.equal(await page.locator('#reviewQuizOverlay >> text=/^Student:$/').count(), 0, 'no separate Student: rows');
      assert.equal(await page.locator('#reviewQuizOverlay >> text=/^Correct:$/').count(), 0, 'no separate Correct: rows');
      // approve buttons are live
      assert.equal(await hdr.locator('button', { hasText: 'Full marks' }).isDisabled(), false);
      await ctx.close();
    }
    // ---- 1b. a wrong answer keeps both rows; the right ones merge
    {
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt({ answers: [0, 1, 1, 1, 1, 1], correctCount: 5 }) });
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Student = Correct:').count(), 5);
      assert.equal(await page.locator('#reviewQuizOverlay >> text=/^Student:$/').count(), 1, 'the wrong one shows Student: …');
      assert.equal(await page.locator('#reviewQuizOverlay >> text=/^Correct:$/').count(), 1, '… and Correct: …');
      // multi-answer: picking only part of the right set is NOT merged
      await ctx.close();
    }
    {
      const quiz = baseQuiz(); quiz.questions = [{ type: 'choice', q: 'Pick all', options: ['A', 'B', 'C'], correct: [0, 2] }];
      const { page, ctx } = await open(browser, { quiz, attempt: baseAttempt({ answers: [[0, 2]], totalQuestions: 1, correctCount: 1 }) });
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Student = Correct:').count(), 1, 'a full multi-answer match merges');
      await ctx.close();
    }
    {
      const quiz = baseQuiz(); quiz.questions = [{ type: 'choice', q: 'Pick all', options: ['A', 'B', 'C'], correct: [0, 2] }];
      const { page, ctx } = await open(browser, { quiz, attempt: baseAttempt({ answers: [[0]], totalQuestions: 1, correctCount: 0 }) });
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Student = Correct:').count(), 0, 'a partial match does not merge');
      assert.equal(await page.locator('#reviewQuizOverlay >> text=/^Correct:$/').count(), 1);
      await ctx.close();
    }
    // ---- 1d. per-question footer is icon-only: the words live in title / aria-label
    {
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt({ answers: [0, 1, 1, 1, 1, 1], correctCount: 5 }) });
      const txt = await page.locator('#reviewQuizOverlay').innerText();
      for (const w of ['Mark as Correct', 'Q Score', 'See Full Question']) assert(!txt.includes(w), 'no visible "' + w + '"');
      assert(!/^Save$|^Copy$/m.test(txt), 'no visible Save / Copy');
      for (const t of ['Mark as Correct / Graded', 'Q Score', 'Save Q Score', 'See Full Question']) assert((await page.locator('#reviewQuizOverlay [title="' + t + '"]').count()) >= 6, 'title ' + t);
      assert((await page.locator('#reviewQuizOverlay [aria-label^="Copy question"]').count()) >= 6, 'copy label');
      await ctx.close();
    }
    // ---- 1c. the card title already carries ✔/✖: a single pick repeats no mark, a multi-pick keeps per-option marks
    {
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt({ answers: [0, 1, 1, 1, 1, 1], correctCount: 5 }) });
      const html = await page.locator('#reviewQuizOverlay').innerHTML();
      const marks = (html.match(/✔|✖/g) || []).length;
      assert.equal(marks, 6, 'only the six card titles carry a ✔/✖, the answer rows add none: ' + marks);
      await ctx.close();
    }
    {
      const quiz = baseQuiz(); quiz.questions = [{ type: 'choice', q: 'Pick all', options: ['A', 'B', 'C'], correct: [0, 2] }];
      const { page, ctx } = await open(browser, { quiz, attempt: baseAttempt({ answers: [[0, 1]], totalQuestions: 1, correctCount: 0 }) });
      const html = await page.locator('#reviewQuizOverlay').innerHTML();
      assert(/✔/.test(html) && /✖/.test(html), 'multi-pick keeps ✔ on the right option and ✖ on the wrong one');
      await ctx.close();
    }
    // ---- 2. Moderate cheat reading opens its own card; High timing too
    {
      const cheat = { summary: { totalEvents: 3, riskLabel: 'Moderate', tabSwitchCount: 2, blurCount: 1 }, events: [{ type: 'tab_hidden', timestamp: Date.now(), details: { hiddenDurationSec: 14 } }] };
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt(), cheat });
      assert.equal(await page.locator('#rv-sig-cheat').isVisible(), true, 'Moderate opens by itself');
      assert.equal(await page.locator('#reviewQuizOverlay .rv-sig').first().getAttribute('aria-expanded'), 'true');
      assert.match(await page.locator('#reviewQuizOverlay .rv-sig').first().innerText(), /Moderate\s*·\s*3/);
      assert.match(await page.locator('#rv-sig-cheat').innerText(), /Tab Hidden/i);
      await ctx.close();
    }
    {
      // timing data present: 6 questions answered in ~1 s each with no changes → flagged
      const attempt = baseAttempt({ durations: [1, 1, 1, 1, 1, 1], durationsActive: [1, 1, 1, 1, 1, 1], answerChangeCounts: [0, 0, 0, 0, 0, 0], firstAnswerLatencySec: [1, 1, 1, 1, 1, 1] });
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt });
      const chips = page.locator('#reviewQuizOverlay .rv-sig');
      assert.equal(await chips.count(), 2, 'Cheat + Timing chips');
      const timingLevel = (await chips.nth(1).innerText()).match(/Timing\s+(\w+)/)[1];
      const isOpen = await page.locator('#rv-sig-timing').isVisible();
      assert.equal(isOpen, timingLevel === 'Moderate' || timingLevel === 'High', 'Timing card is open exactly when the level is Moderate/High (' + timingLevel + ')');
      await ctx.close();
    }
    // ---- 3. a quiz with a free-text question keeps the AI-model rail
    {
      const quiz = baseQuiz(); quiz.questions.push({ type: 'short_answer', q: 'Explain', correct: 'x' });
      const { page, ctx } = await open(browser, { quiz, attempt: baseAttempt({ answers: [1, 1, 1, 1, 1, 1, 'text'], totalQuestions: 7 }) });
      assert.equal(await page.locator('#reviewQuizOverlay >> text=Short-answer AI model').count(), 1, 'AI-model rail is there when it can be used');
      await ctx.close();
    }
    // ---- 4. a practice attempt is flagged; approved attempts cannot be approved again
    {
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt({ status: 'practice_done', answers: [null, null, null, null, null, null], practiceAnswers: [1, 1, 1, 1, 0, 0], practiceScore: 4, practiceTotalQ: 6 }) });
      assert.equal(await page.locator('#reviewQuizOverlay >> text=PRACTICE attempt').count(), 1, 'practice badge');
      assert.match(await page.locator('#reviewQuizOverlay button', { hasText: 'Actual' }).innerText(), /Actual 0\.67 pts/, 'the actual score reads the practice answers (4/6 of 1.0)');
      await ctx.close();
    }
    {
      const { page, ctx } = await open(browser, { quiz: baseQuiz(), attempt: baseAttempt({ status: 'approved' }) });
      assert.equal(await page.locator('#reviewQuizOverlay button', { hasText: 'Full marks' }).isDisabled(), true);
      assert.equal(await page.locator('#reviewQuizOverlay button', { hasText: 'Actual' }).isDisabled(), true);
      assert.match(await page.locator('#reviewQuizOverlay button', { hasText: 'Full marks' }).getAttribute('title'), /Already approved/);
      await ctx.close();
    }
    console.log('PASS: review modal — one-row header, Full marks / Actual (names on hover), signal chips with auto-open, conditional AI rail, practice badge');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
