// V101.160: "feedback not given yet" reminder popup — the REAL public/quiz-feedback-remind.js with fake globals (userId, myOwnRow,
// quizzesCache, quizAttemptsCache, openFeedbackForPastAttempt). Pure rules (pending / inPeriod / decide), the popup (3 newest + "+n more",
// score chips, Thai), Later / × / Esc = Later, once a day, 3 Laters in a row stop it until the pending count drops, Give now / a row opens
// that quiz's feedback, fits a 363px phone. Also checks index.html loads the script and arms it from the quiz_attempts listener.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/quiz-feedback-remind\.js\?v=/.test(idx), 'index.html loads the reminder script');
assert.ok(/achievementSourceReady\('quiz'\);\s*\n?\s*if \(window\.fbRemind\) fbRemind\.arm\(\);/.test(idx.replace(/\r/g, '')), 'armed from the quiz_attempts listener');
const guide = fs.readFileSync('public/intern-guide.en.md', 'utf8'), guideTh = fs.readFileSync('public/intern-guide.md', 'utf8');
for (const g of [guide, guideTh]) assert.ok(/^## 3\. 💬 Feedback/m.test(g) && /^## 4\. 📓 Journal/m.test(g), 'guide: Feedback is section 3, Journal moved to 4');
assert.ok(/🎁/.test(guide) && /never more than your score/.test(guide), 'EN guide explains the 🎁 bonus rule');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 363, height: 780 } })).newPage();
    await page.route('https://quiz.test/', r => r.fulfill({ body: '<body></body>', contentType: 'text/html' }));
    await page.goto('https://quiz.test/');
    await page.setContent('<body><div id="x"></div></body>');
    await page.addScriptTag({ content: fs.readFileSync('public/quiz-feedback-remind.js', 'utf8') });
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
    const plus = n => new Date(Date.parse(today + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    await page.evaluate(({ end }) => {
      const ts = ms => ({ toMillis: () => ms });
      const now = Date.now(), day = 86400000;
      window.userId = 'u1';
      window.myOwnRow = () => ({ startDate: '2026-01-01', endDate: end });
      window.quizzesCache = [
        { id: 'a', title: 'PRETEST-1.3' }, { id: 'b', title: 'PRETEST-1.1', quizType: 'standard' }, { id: 'c', title: 'RP-1' }, { id: 'd', title: 'Long quiz title that must not break the row layout at all' },
        { id: 'poll', title: 'Poll', isPoll: true }, { id: 'ex', title: 'Exam', quizType: 'exam' }
      ];
      const at = (id, status, ms, c, t, extra) => Object.assign({ quizId: id, status, timestamp: ts(ms), correctCount: c, totalQuestions: t }, extra || {});
      window.quizAttemptsCache = {
        a: at('a', 'approved', now, 9, 10), b: at('b', 'approved', now - day, 10, 10), c: at('c', 'approved', now - 3 * day, 4, 10), d: at('d', 'approved', now - 5 * day, 6, 10),
        poll: at('poll', 'approved', now, 1, 1), ex: at('ex', 'approved', now, 1, 1), p: at('a', 'pending', now, 0, 10), given: at('b', 'approved', now, 5, 10, { feedbackGiven: true })
      };
      window.opened = [];
      window.openFeedbackForPastAttempt = id => opened.push(id);
      localStorage.clear();
    }, { end: plus(30) });
    // ---- pure rules
    const pure = await page.evaluate(() => {
      const list = fbRemind.pending(quizAttemptsCache, quizzesCache);
      return {
        ids: list.map(p => p.quizId),
        inP: [fbRemind.inPeriod({ endDate: '2026-12-31' }, '2026-10-16'), fbRemind.inPeriod({ endDate: '2026-10-15' }, '2026-10-16'), fbRemind.inPeriod({ endDate: '2026-10-16' }, '2026-10-16'), fbRemind.inPeriod({}, '2026-10-16'), fbRemind.inPeriod({ endDate: '2026-12-31', notAnInternship: true }, '2026-10-16'), fbRemind.inPeriod({ startDate: '2026-11-01', endDate: '2026-12-31' }, '2026-10-16')],
        dec: [fbRemind.decide(null, 2, 'T'), fbRemind.decide({ day: 'T', later: 0, n: 2 }, 2, 'T'), fbRemind.decide({ day: 'Y', later: 3, n: 2 }, 2, 'T'), fbRemind.decide({ day: 'Y', later: 3, n: 2 }, 1, 'T'), fbRemind.decide({ day: 'Y', later: 1, n: 2 }, 0, 'T')].map(d => [d.show, d.state.later, d.state.n])
      };
    });
    assert.deepEqual(pure.ids, ['a', 'b', 'c', 'd'], 'graded standard quizzes without feedback, newest first (poll / exam / pending / already-given are out)');
    assert.deepEqual(pure.inP, [true, false, true, false, false, false], 'inside the period: end day counts; no end date, notAnInternship, not started = no');
    assert.deepEqual(pure.dec, [[true, 0, 2], [false, 0, 2], [false, 3, 2], [true, 0, 1], [false, 0, 0]], 'decide: first look shows; same day no; 3 Laters stop; a drop in pending resets; nothing pending = no');
    // ---- popup
    await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-pop').count(), 1, 'popup shown');
    assert.match(await page.locator('#fbr-pop h4').innerText(), /^4 quizzes need your feedback$/);
    assert.equal(await page.locator('#fbr-pop .fbr-q').count(), 3, 'three newest rows');
    assert.match(await page.locator('#fbr-pop .fbr-more').innerText(), /^\+1 more$/);
    assert.equal(await page.locator('#fbr-pop .fbr-q').first().innerText().then(t => /PRETEST-1\.3/.test(t) && /9\/10/.test(t) && /today/.test(t)), true, 'newest first with score + age');
    const chips = await page.locator('#fbr-pop .fbr-q em').evaluateAll(e => e.map(x => x.className));
    assert.deepEqual(chips, ['fbr-g', 'fbr-g', 'fbr-r'], '9/10 and 10/10 green, 4/10 red');
    const fit = await page.evaluate(() => { const r = document.getElementById('fbr-pop').getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth, document.documentElement.scrollWidth <= innerWidth]; });
    assert.deepEqual(fit, [true, true, true], 'fits a 363px phone, no horizontal scroll');
    const btnH = await page.evaluate(() => [...document.querySelectorAll('#fbr-pop button')].map(b => Math.round(b.getBoundingClientRect().height)));
    assert.ok(btnH.every(h => h >= 44), 'touch targets ≥ 44px: ' + btnH);
    // Later → closes, counts one Later, and the same day nothing more
    await page.click('#fbr-later');
    assert.equal(await page.locator('#fbr-back').count(), 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fbRemind:u1')).later), 1);
    await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-back').count(), 0, 'once a day');
    // next day: shows again; Esc and the backdrop are Laters too → 3 in a row stops it
    const setDay = async d => page.evaluate(d => { const s = JSON.parse(localStorage.getItem('fbRemind:u1')); s.day = d; localStorage.setItem('fbRemind:u1', JSON.stringify(s)); }, d);
    await setDay('2000-01-01'); await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-back').count(), 1, 'a new day → shown again');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fbRemind:u1')).later), 2, 'Esc = Later');
    await setDay('2000-01-01'); await page.evaluate(() => fbRemind.check());
    await page.mouse.click(2, 2);   // backdrop
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fbRemind:u1')).later), 3, 'backdrop = Later');
    await setDay('2000-01-01'); await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-back').count(), 0, '3 Laters in a row → stops');
    // feedback given for one quiz (pending 4 → 3) → counter resets and it shows again
    await page.evaluate(() => { quizAttemptsCache.a.feedbackGiven = true; }); await setDay('2000-01-01');
    await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-back').count(), 1, 'after giving feedback it wakes up again');
    assert.match(await page.locator('#fbr-pop h4').innerText(), /^3 quizzes/);
    // Give now opens the newest remaining quiz; a row opens that quiz; neither adds a Later
    await page.click('#fbr-go');
    assert.deepEqual(await page.evaluate(() => opened), ['b'], 'Give now → newest remaining (a is done)');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fbRemind:u1')).later), 0);
    await setDay('2000-01-01'); await page.evaluate(() => fbRemind.check());
    await page.locator('#fbr-pop .fbr-q').nth(1).click();
    assert.deepEqual(await page.evaluate(() => opened), ['b', 'c'], 'a row opens that quiz');
    // Thai + out of period / busy
    await page.evaluate(() => document.body.classList.add('lang-th-on')); await setDay('2000-01-01'); await page.evaluate(() => fbRemind.check());
    assert.match(await page.locator('#fbr-pop h4').innerText(), /^ค้าง 3 ควิซที่ยังไม่ได้ feedback$/); assert.equal(await page.locator('#fbr-later').innerText(), 'ภายหลัง');
    await page.keyboard.press('Escape');
    await page.evaluate(({ end }) => { window.myOwnRow = () => ({ endDate: end }); }, { end: plus(-1) }); await setDay('2000-01-01');
    await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-back').count(), 0, 'after the internship period there is no popup (the admin ⏰ takes over)');
    await page.evaluate(({ end }) => { window.myOwnRow = () => ({ endDate: end }); const m = document.createElement('div'); m.className = 'modal'; m.style.display = 'flex'; document.body.appendChild(m); }, { end: plus(30) });
    await page.evaluate(() => fbRemind.check());
    assert.equal(await page.locator('#fbr-back').count(), 0, 'not on top of another open modal');
    console.log('PASS: feedback reminder — rules (graded standard only, internship period, once a day, 3 Laters stop, reset on feedback), popup (3 newest, chips, Thai, phone fit), guide section 3 in EN/TH');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
