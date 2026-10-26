// V101.214 🧭 Know thyself nudges (owner's pick B + C, mockup-knowthyself-reminder.html): the REAL index.html + knowthyself-nudge.js +
// daily-canvas.js on a 390 px touch phone, Firestore faked (nothing leaves the page).
// B · bottom sheet: weekly, 3 times max, not on a day the article popup / feedback reminder showed, waits for other popups, Later /
//     Not again / Start (opens Personal Info on the Know thyself tab). C · a card under today's sent Journal: first day + once a week later,
//     ✕ stops it. Both gone for good once Part A or B is done. No score anywhere.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8'), js = fs.readFileSync('public/knowthyself-nudge.js', 'utf8');
assert.ok(/<script src="daily-canvas\.js\?v=V101\.\d+"><\/script>\s*<script src="knowthyself-nudge\.js\?v=V101\.\d+"><\/script>/.test(html), 'loads right after daily-canvas.js (the card hangs on its hero)');
assert.ok(/internArticles\.onUserDoc\(\);[^\n]*\n\s*if \(window\.ktNudge\) \{ ktNudge\.arm\(\); ktNudge\.paintC\(\); \}/.test(html), 'the users/{uid} snapshot arms it');
assert.ok(!/score|beri|increment|collection\(/i.test(js.replace(/never affects any score|ไม่มีผลกับคะแนน|점수에는|scores, ranks or rewards/g, '')), 'no score, Beri or Firestore write anywhere in the nudge');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            const doc = () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve(), onSnapshot: () => () => {} });
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }),
                firestore: Object.assign(() => ({ collection: () => ({ doc, where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.ktNudge && document.getElementById('dc-hero'));
        await page.evaluate(() => {
            window.liff = window.liff || {};   // the network is blocked, so the LINE SDK never loads — without this the page reloads itself after 15 s
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            document.getElementById('kanban-content').style.display = 'block';
            if (typeof switchMissionTab === 'function') switchMissionTab('reflection');
            userId = 'U1'; window.myRegistered = true; localStorage.clear();
            window.myUserDoc = { id: 'U1', group: 'EXTERN' };
        });
        const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
        const ago = n => new Date(Date.parse(today + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);

        // ---- 1. the rules
        const p = await page.evaluate(({ today, a6, a7, a1 }) => {
            const K = ktNudge, m = {}, dn = { personality: { neris: { type: 'ISTP' } } }, b5 = { personality: { big5: { O: 50 } } };
            return {
                b: [K.decideB(m, {}, today, '', ''), K.decideB(dn, {}, today, '', ''), K.decideB(b5, {}, today, '', ''), K.decideB(m, { off: true }, today, '', ''), K.decideB(m, { b: [a7, a7, a7] }, today, '', ''),
                    K.decideB(m, {}, today, today, ''), K.decideB(m, {}, today, '', today), K.decideB(m, { b: [a6] }, today, '', ''), K.decideB(m, { b: [a7] }, today, '', ''), K.decideB(m, { b: [today] }, today, '', '')],
                c: [K.decideC(m, {}, today), K.decideC(dn, {}, today), K.decideC(m, { cOff: true }, today), K.decideC(m, { c: [today] }, today), K.decideC(m, { c: [a6] }, today), K.decideC(m, { c: [a7] }, today), K.decideC(m, { c: [a7, a1] }, today)],
                done: [K.done({}), K.done(dn), K.done(b5), K.done({ personality: {} })]
            };
        }, { today, a6: ago(6), a7: ago(7), a1: ago(1) });
        assert.deepEqual(p.b, [true, false, false, false, false, false, false, false, true, false], 'B: new → yes · done (A or B) · Not again · 3 shown · article / feedback popup today · 6 days · 7 days → yes · already today: ' + p.b);
        assert.deepEqual(p.c, [true, false, false, true, false, true, false], 'C: first day · done · ✕ · same day stays · 6 days · 7 days → yes · twice already: ' + p.c);
        assert.deepEqual(p.done, [false, true, true, false], 'done = a NERIS type or a Big Five result');

        // ---- 2. B waits for another popup, then shows; Later = nothing more today
        await page.evaluate(() => { const d = document.createElement('div'); d.id = 'art-back'; document.body.appendChild(d); ktNudge.check(); });
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-sheet')), false, 'never on top of the article popup');
        await page.evaluate(() => document.getElementById('art-back').remove());
        await page.waitForFunction(() => document.getElementById('kt-sheet'), null, { timeout: 5000 });
        await page.waitForTimeout(300);   // the slide-up animation
        let s = await page.evaluate(() => { const sh = document.getElementById('kt-sheet'), r = sh.getBoundingClientRect(); return { title: sh.querySelector('h3').textContent, pills: [...sh.querySelectorAll('.pl span')].map(e => e.textContent), btns: [...sh.querySelectorAll('button')].map(b => b.textContent), bottom: Math.round(innerHeight - r.bottom), w: Math.round(r.width), over: sh.scrollWidth > sh.clientWidth + 1, focus: document.activeElement.classList.contains('go'), st: JSON.parse(localStorage.getItem('ktNudge:U1')), noToggle: sh.classList.contains('lang-no-toggle') }; });
        assert.deepEqual([s.title, s.btns, s.bottom, s.w, s.over, s.focus, s.noToggle], ['Know yourself in 3 minutes', ['Later', 'Start →', 'Don’t remind me again'], 0, 390, false, true, true], 'bottom sheet across the phone: ' + JSON.stringify(s));
        assert.deepEqual(s.pills, ['⏱ 3 min', '🔒 only you + admin', '✍️ better Journal questions']);
        assert.deepEqual(s.st.b, [today], 'showing it counts (1 of 3)');
        if (process.env.QA_SHOT) await page.screenshot({ path: process.env.QA_SHOT + '/kt-sheet.png' });
        await page.click('#kt-sheet .lt');
        await page.evaluate(() => ktNudge.check());
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-sheet')), false, 'Later: gone, and not again today');

        // ---- 3. Not again = never; Start opens Personal Info on the Know thyself tab
        await page.evaluate(({ a7 }) => { localStorage.setItem('ktNudge:U1', JSON.stringify({ b: [a7] })); ktNudge.check(); }, { a7: ago(7) });
        await page.click('#kt-sheet .nv');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ktNudge:U1')).off), true, '“Don’t remind me again” is kept');
        await page.evaluate(({ a7 }) => { localStorage.setItem('ktNudge:U1', JSON.stringify({ b: [a7] })); ktNudge.check(); }, { a7: ago(7) });
        await page.click('#kt-sheet .go');
        await page.waitForFunction(() => document.getElementById('personalInfoModal').style.display === 'flex' && document.getElementById('pi-tab-self').getAttribute('aria-selected') === 'true', null, { timeout: 6000 });
        await page.evaluate(() => { document.getElementById('personalInfoModal').style.display = 'none'; });

        // ---- 4. a feedback-reminder day or an article-popup day: no sheet (one popup a day)
        await page.evaluate(({ a7, today }) => { localStorage.setItem('ktNudge:U1', JSON.stringify({ b: [a7] })); localStorage.setItem('fbRemind:U1', JSON.stringify({ day: today })); ktNudge.check(); }, { a7: ago(7), today });
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-sheet')), false, 'not on a feedback-reminder day');
        await page.evaluate(({ today }) => { localStorage.removeItem('fbRemind:U1'); window.myUserDoc.articlePopDay = today; ktNudge.check(); }, { today });
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-sheet')), false, 'not on an article-popup day');
        await page.evaluate(() => { delete window.myUserDoc.articlePopDay; });

        // ---- 5. C: the card under today's sent Journal; ✕ stops it; never before today's entry is in
        await page.evaluate(() => { localStorage.setItem('ktNudge:U1', JSON.stringify({ off: true })); reflectiveLogsCache = []; renderReflectiveLogs(); });
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-jcard')), false, 'no card before today’s entry');
        await page.evaluate(() => { reflectiveLogsCache = [{ id: 't', content: 'Learned: x', mood: '😊', timestamp: { toDate: () => new Date() } }]; renderReflectiveLogs(); });
        await page.waitForFunction(() => document.getElementById('kt-jcard'));
        s = await page.evaluate(() => { const c = document.getElementById('kt-jcard'), pane = document.getElementById('rl-reflection-pane'); return { inHero: !!c.closest('#dc-hero.dc-done'), text: c.querySelector('.t b').textContent, go: c.querySelector('.go').textContent, over: pane.scrollWidth > pane.clientWidth + 1, st: JSON.parse(localStorage.getItem('ktNudge:U1')).c }; });
        assert.deepEqual(s, { inHero: true, text: '🧭 Want Journal questions that fit you?', go: 'Try it', over: false, st: [today] }, 'the card sits in the hero under the sent entry (even with the sheet turned off): ' + JSON.stringify(s));
        if (process.env.QA_SHOT) await page.locator('#rl-reflection-pane').screenshot({ path: process.env.QA_SHOT + '/kt-card.png' });
        await page.click('#kt-jcard .x');
        await page.evaluate(() => { renderReflectiveLogs(); ktNudge.paintC(); });
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-jcard') || !JSON.parse(localStorage.getItem('ktNudge:U1')).cOff), false, '✕ = gone for good');

        // ---- 6. done → both gone at once (card removed on the next user-doc paint)
        await page.evaluate(() => { localStorage.setItem('ktNudge:U1', JSON.stringify({})); renderReflectiveLogs(); ktNudge.paintC(); });
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-jcard')), true);
        await page.evaluate(() => { window.myUserDoc.personality = { neris: { type: 'ISTP' } }; ktNudge.paintC(); ktNudge.check(); });
        await page.waitForTimeout(100);
        assert.deepEqual(await page.evaluate(() => [!!document.getElementById('kt-jcard'), !!document.getElementById('kt-sheet')]), [false, false], 'done: no card, no sheet');

        // ---- 7. Thai
        await page.evaluate(() => { document.body.classList.add('lang-th-on'); window.myUserDoc.personality = null; localStorage.setItem('ktNudge:U1', JSON.stringify({})); ktNudge.check(); });
        await page.waitForFunction(() => document.getElementById('kt-sheet'));
        assert.equal(await page.textContent('#kt-sheet h3'), 'รู้จักตัวเองใน 3 นาที');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => !!document.getElementById('kt-sheet')), false, 'Esc = Later');

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: 🧭 Know thyself nudges — B sheet (weekly · 3 max · one popup a day · waits · Later / Not again / Start → Know thyself tab · Esc) · C card under the sent Journal (first day + a week later · ✕) · both gone once done · no score · 390 px · Thai');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
