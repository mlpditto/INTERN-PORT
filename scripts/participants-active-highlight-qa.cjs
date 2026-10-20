// V102.329: Participants table — an ACTIVE intern's row is lightly highlighted (green tint + green bar on the left + a tooltip).
// "Active" = hwIsActiveUser (the Homework picker's rule): not hidden, and today inside startDate–endDate (or notAnInternship).
// A cheat-warning row keeps its own background and only gains the bar; a dismissed attempt stays dimmed with no highlight.
// Runs the REAL showQuizParticipants() from public/admin.html (file://, network blocked, Firebase = Proxy, fake data).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, timezoneId: 'Asia/Bangkok' })).newPage();
    await page.addInitScript(() => {
      const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
      window.firebase = P; window.mermaid = P;
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(ADMIN, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      [...document.querySelectorAll('body > *')].filter(e => /Admin Portal/.test(e.innerText || '')).forEach(e => e.style.setProperty('display', 'none', 'important'));
      const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const now = { startDate: day(-10), endDate: day(10) };
      // name, user extras, attempt extras
      const rows = [
        ['Now', now, {}],
        ['Past', { startDate: day(-90), endDate: day(-30) }, {}],
        ['NoPeriod', {}, {}],
        ['Hidden', Object.assign({ isIgnored: true }, now), {}],
        ['Staff', { notAnInternship: true }, {}],
        ['Warn', now, { cheatMonitoring: { summary: { totalEvents: 6, riskLabel: 'High', riskScore: 9 } } }],
        ['Dismissed', now, { isDismissed: true }],
      ];
      usersData = rows.map((r, i) => Object.assign({ id: 'u' + i, displayName: r[0], pictureUrl: '', group: 'Public' }, r[1]));
      const ts = ms => ({ toMillis: () => ms, toDate: () => new Date(ms) });
      const quiz = { id: 'q1', title: 'T', quizType: 'standard', totalPoints: 1, questions: Array.from({ length: 10 }, () => ({ type: 'choice', q: 'Q', options: ['A', 'B'], correct: 0 })) };
      window.quizzesData = [quiz];
      window.quizAttemptsAllCache = rows.map((r, i) => Object.assign({ id: 'a' + i, quizId: 'q1', userId: 'u' + i, displayName: r[0], status: 'approved', correctCount: 8, totalQuestions: 10, startTime: ts(1e12), timestamp: ts(1e12 + 600000 + i) }, r[2]));
      window.db = { collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }), doc: () => ({ get: async () => ({ exists: false }) }) }) };
    });
    await page.evaluate(() => showQuizParticipants('q1'));
    await page.waitForSelector('#quiz-participants-container table', { timeout: 5000 });
    const info = await page.$$eval('#quiz-participants-container tr.participant-row', trs => trs.map(tr => ({
      name: tr.querySelector('.lang-no-toggle').textContent.trim(), active: tr.classList.contains('is-active-user'),
      bg: getComputedStyle(tr).backgroundColor, bar: getComputedStyle(tr).boxShadow, title: tr.getAttribute('title') || '',
    })));
    const by = Object.fromEntries(info.map(x => [x.name, x]));
    assert.deepEqual(info.filter(x => x.active).map(x => x.name).sort(), ['Now', 'Staff', 'Warn'], 'active = in period or not an internship, not hidden, not dismissed');
    assert.equal(by.Now.bg, 'rgb(240, 253, 244)', 'light green tint'); assert.match(by.Now.bar, /rgb\(74, 222, 128\)/, 'green bar on the left');
    assert.match(by.Now.title, /Active now/); assert.match(by.Now.title, /ฝึกงานอยู่ตอนนี้/); assert.match(by.Now.title, /현재 실습 중/);
    assert.equal(by.Warn.bg, 'rgb(255, 241, 242)', 'a High cheat warning keeps its red tint'); assert.match(by.Warn.bar, /rgb\(74, 222, 128\)/, '…and gains the bar');
    for (const n of ['Past', 'NoPeriod', 'Hidden']) { assert.equal(by[n].bg, 'rgba(0, 0, 0, 0)', n + ' plain'); assert.equal(by[n].bar, 'none', n + ' no bar'); assert.equal(by[n].title, ''); }
    assert.equal(by.Dismissed.bar, 'none', 'a dismissed attempt is not highlighted'); assert.equal(by.Dismissed.bg, 'rgb(241, 245, 249)', 'it stays dimmed grey');
    console.log('PASS: Participants — active interns highlighted (tint + bar + EN/TH/KO tooltip); warnings keep their colour; past / no period / hidden / dismissed plain');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
