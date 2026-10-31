// V102.551: the real Review modal with stubbed Firestore: no active seconds is no reading (not 0%), 👁 shows what the intern sees and sends nothing,
// Draft / Sent / Edited, the draft survives a reopen in this browser, a time badge only where the time stands out, ⏱ Time cycles the order.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

const quiz = { id: 'q1', title: 'Sample Quiz', shortTitle: 'Sample', quizType: 'standard', totalPoints: 1, questions: [14, 17, 3, 23, 19, 71].map((s, i) => ({ type: 'choice', q: 'Question ' + i, options: ['A', 'B'], correct: 1 })) };
const mkAttempt = extra => ({ quizId: 'q1', userId: 'u', displayName: 'Sample', status: 'pending', correctCount: 3, totalQuestions: 6, answers: [1, 1, 0, 1, 0, 0], durations: [14, 17, 3, 23, 19, 71], cheatMonitoring: {}, ...extra });

async function open(ctx, attempt) {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
    window.firebase = P; window.mermaid = P;
  });
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(ADMIN, { waitUntil: 'load' }); await page.waitForTimeout(400);
  await page.evaluate(({ quiz, attempt }) => {
    const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
    attempt.timestamp = { toDate: () => new Date(), toMillis: () => Date.now() };
    window.__att = attempt; window.__writes = [];
    const ref = (c, id) => ({ id, get: async () => ({ exists: true, data: () => window.__att }), update: async d => { window.__writes.push(Object.keys(d).sort()); } });
    window.db = { collection: c => ({ doc: id => ref(c, id), get: async () => ({ docs: [] }) }) };
    window.quizzesData = [quiz]; window.usersData = [];
    window.renderMdInline = window.renderMdInline || (t => String(t == null ? '' : t));
    window.showToast = () => {};
    window.ALLOWED_EMAIL = 'admin@example.test';
  }, { quiz, attempt });
  await page.evaluate(() => reviewQuiz('a1')); await page.waitForTimeout(300);
  await page.evaluate(() => rvWriteupToggle());
  return page;
}
const state = p => p.locator('#rv-writeup-state').innerText();
const type = async (p, t) => { await p.fill('#rv-writeup-text', t); };

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

    // no reading is not 0%: missing, or all zero as older attempts hold it
    for (const extra of [{}, { durationsActive: [0, 0, 0, 0, 0, 0] }]) {
      const p = await open(ctx, mkAttempt(extra));
      assert.equal(await p.locator('#reviewQuizOverlay .rv-flag').count(), 0, 'no Low active chip');
      assert.match(await p.locator('#reviewQuizOverlay .rv-sig').nth(1).innerText(), /Normal/, 'and Timing is not raised by it');
      await p.close();
    }
    const real = await open(ctx, mkAttempt({ durationsActive: [1, 1, 1, 1, 1, 1] }));
    assert.match(await real.locator('#reviewQuizOverlay .rv-flag').innerText(), /Low active \(4%\)/, 'a real low reading still warns');
    await real.close();

    const p = await open(ctx, mkAttempt());
    assert.equal(await p.locator('#rv-writeup-state').isHidden(), true, 'an empty box has no state');
    await type(p, 'Line one\n**keep this** <b>x</b>');
    assert.match(await state(p), /^Draft · saved \d\d:\d\d$/);

    // 👁: bold as the intern sees it, escaped, nothing written
    await p.click('#rv-writeup-preview');
    assert.equal(await p.locator('#rv-writeup-view strong.adm-key').innerText(), 'keep this');
    assert.equal(await p.locator('#rv-writeup-view b').count(), 0, 'text is escaped');
    assert.equal(await p.locator('#rv-writeup-text').isHidden(), true);
    assert.equal(await p.evaluate(() => window.__writes.length), 0, 'preview sends nothing');
    await p.click('#rv-writeup-preview');
    assert.equal(await p.locator('#rv-writeup-text').isVisible(), true, 'back to editing');
    await p.close();

    // the draft comes back in this browser; Send clears it
    const q = await open(ctx, mkAttempt());
    assert.match(await q.inputValue('#rv-writeup-text'), /keep this/, 'the draft survives a reopen');
    await q.click('#rv-writeup-send');
    await q.waitForFunction(() => window.__writes.length === 1);
    assert.deepEqual(await q.evaluate(() => window.__writes[0]), ['adminComment', 'adminCommentAt', 'adminCommentBy'], 'Send writes only the comment');
    assert.match(await state(q), /^✓ Sent \d\d:\d\d$/);
    assert.equal(await q.locator('#rv-writeup-send').isDisabled(), true);
    await type(q, 'Line one edited');
    assert.equal(await state(q), 'Edited · not sent');
    assert.match(await q.locator('#rv-writeup-send').innerText(), /Send again/);
    assert.equal(await q.locator('#rv-writeup-send').isDisabled(), false);
    await q.close();

    // times: only the unusual ones until ⏱ Time is on
    const t = await open(ctx, mkAttempt());
    const shown = () => t.$$eval('.rv-time', e => e.filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent.trim()));
    assert.deepEqual(await shown(), ['⚡ 3s', '🐢 71s'], 'only the unusual times show');
    const order = () => t.$$eval('.rv-q', e => e.map(x => +x.dataset.rvI));
    await t.click('#rv-time-sort');
    assert.deepEqual(await order(), [5, 3, 4, 1, 0, 2], 'slowest first');
    assert.equal((await shown()).length, 6, 'sorted: every card shows its time');
    assert.equal(await t.locator('#rv-time-sort').innerText(), '⏱ Slowest');
    await t.click('#rv-time-sort');
    assert.deepEqual(await order(), [2, 0, 1, 4, 3, 5], 'fastest first');
    await t.evaluate(() => window.rvApplyUi('a1'));
    assert.deepEqual(await order(), [2, 0, 1, 4, 3, 5], 'survives the re-apply after a save');
    await t.click('#rv-time-sort');
    assert.deepEqual(await order(), [0, 1, 2, 3, 4, 5], 'back to the quiz order');
    assert.equal((await shown()).length, 2);
    await t.close();

    console.log('PASS: review first batch — Low active only with a reading, 👁 preview, Draft / Sent / Edited, draft survives reopen, unusual-time badges, ⏱ Time order');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
