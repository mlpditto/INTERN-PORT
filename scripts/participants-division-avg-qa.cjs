// V102.261: Participants table — 🏷️ division under the status badge (hidden when none), ⏱ total + ⌀ per question, a slower-than-class-average
// row gets the amber pill, and the Avg pill carries the class-wide ⌀ per question (total time ÷ total questions) in pastel colours.
// Runs the REAL showQuizParticipants() from public/admin.html (file://, network blocked, Firebase = Proxy, fake data).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;
// name, correct, total questions, minutes, seconds, division
const rows = [['Fast', 9, 10, 10, 0, 'Retail Pharmacy'], ['Slow', 8, 10, 30, 0, 'Hospital Pharmacy'], ['Long', 25, 30, 30, 0, ''], ['NoTime', 7, 10, 0, 0, 'Retail Pharmacy']];

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
   
    await page.addInitScript(() => {
      const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
      window.firebase = P; window.mermaid = P;
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(ADMIN, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate((rows) => {
      [...document.querySelectorAll('body > *')].filter(e => /Admin Portal/.test(e.innerText || '')).forEach(e => e.style.setProperty('display', 'none', 'important'));
      const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
      divisionConfig = { 'Hospital Pharmacy': ['H'], 'Retail Pharmacy': ['R'] };
      usersData = rows.map((r, i) => ({ id: 'u' + i, displayName: r[0], pictureUrl: '', group: 'Public', division: r[5] }));
      const quiz = { id: 'q1', title: 'T', quizType: 'standard', totalPoints: 1, questions: Array.from({ length: 10 }, () => ({ type: 'choice', q: 'Q', options: ['A', 'B'], correct: 0 })) };
      const base = Date.UTC(2026, 9, 15, 5, 0, 0);
      window.quizzesData = [quiz];
      window.quizAttemptsAllCache = rows.map((r, i) => { const dur = (r[3] * 60 + r[4]) * 1000, end = base + i * 1000; const a = { id: 'a' + i, quizId: 'q1', userId: 'u' + i, displayName: r[0], status: 'approved', correctCount: r[1], totalQuestions: r[2], timestamp: ts(end), answers: [] }; if (dur) a.startTime = ts(end - dur); return a; });
      window.db = { collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }), doc: () => ({ get: async () => ({ exists: false }) }) }) };
    }, rows);
    await page.evaluate(() => showQuizParticipants('q1'));
    await page.waitForSelector('#quiz-participants-container table', { timeout: 5000 });
    const row = (n) => page.locator('#quiz-participants-container tr.participant-row', { hasText: n });
    // class ⌀/Q = (600+1800+1800) s ÷ (10+10+30) q = 84 s = 1m 24s
    assert.match((await page.locator('#quiz-avg-score-badge').innerText()).trim(), /^📊 [\d.]+% · 4\/4 · ⏱ ⌀ 1m 24s\/Q$/, 'Avg pill carries the class-wide ⌀ per question');
    assert.equal(await page.locator('#quiz-avg-score-badge span').count(), 3, 'one coloured span per figure');
    const cols = await page.locator('#quiz-avg-score-badge span').evaluateAll(els => els.map(e => getComputedStyle(e).color));
    assert.equal(new Set(cols).size, 3, 'three different colours: ' + cols);
    // division chip
    assert.match(await row('Fast').innerText(), /🏷️ Retail Pharmacy/);
    assert.match(await row('Slow').innerText(), /🏷️ Hospital Pharmacy/);
    assert.doesNotMatch(await row('Long').innerText(), /🏷️/, 'no division → nothing shown');
    // per-question average uses each attempt's own question count
    assert.match(await row('Fast').innerText(), /⏱ 10m 0s · ⌀ 1m 0s\/Q/, '600 s ÷ 10');
    assert.match(await row('Slow').innerText(), /⏱ 30m 0s · ⌀ 3m 0s\/Q/, '1800 s ÷ 10');
    assert.match(await row('Long').innerText(), /⏱ 30m 0s · ⌀ 1m 0s\/Q/, '1800 s ÷ 30 — same total, more questions, not slow');
    assert.doesNotMatch(await row('NoTime').innerText(), /⌀/, 'no startTime → no average');
    // slower than the class average (84 s) → amber pill; the others stay plain
    const bg = async (n) => row(n).locator('small').evaluate(e => getComputedStyle(e).backgroundColor);
    assert.notEqual(await bg('Slow'), 'rgba(0, 0, 0, 0)', 'Slow gets the pill');
    assert.equal(await bg('Fast'), 'rgba(0, 0, 0, 0)'); assert.equal(await bg('Long'), 'rgba(0, 0, 0, 0)');
    console.log('PASS: Participants — division chip (hidden when none), ⌀ per question per row and class-wide, slow rows highlighted, pastel pill');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
