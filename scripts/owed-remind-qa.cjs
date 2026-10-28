// V101.228: 🔔 "still to do" sheet on open (public/owed-remind.js) — the REAL script inside the REAL index.html on a 390 px phone (Bangkok clock fixed),
// with the real articles.js, quiz-feedback-remind.js and knowthyself-nudge.js next to it. Pure rules (pending / inPeriod / decide / others / afternoon),
// Journal + Case only from 16:00 on weekdays but an unread article any hour, the sheet (EN / TH / KO, rows, "+n more", fits 390 px, 44 px targets), Later /
// backdrop / Esc, once a day, three Laters stop it until something is done, rows go to the item, the chime (played · locked → "tap anywhere" ·
// muted · once a day), and the ONE-popup-a-day precedence: the sheet holds the slot (📰 popup, feedback reminder and Know thyself stay quiet), gives
// way when one of them already showed today, waits behind a modal, and changes nothing outside the internship period.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html));
assert.ok(/<script defer src="owed-remind\.js\?v=V101\.\d+"><\/script>/.test(html), 'index.html loads the sheet');
assert.ok(/ktNudge\.paintC\(\); \}[^\n]*\n\s*if \(window\.owedRemind\) owedRemind\.arm\(\);/.test(html), 'armed from the users/{uid} snapshot, next to Know thyself');
const src = n => fs.readFileSync('public/' + n, 'utf8').replace(/\r\n/g, '\n');
for (const n of ['articles.js', 'quiz-feedback-remind.js', 'knowthyself-nudge.js']) assert.ok(/getElementById\('ord-back'\)/.test(src(n)), n + ' waits while the sheet is open');
for (const n of ['articles.js', 'quiz-feedback-remind.js', 'knowthyself-nudge.js']) assert.ok(/owedRemind\.holds\(\)/.test(src(n)), n + ' stays quiet while the sheet holds the day');

const D = 864e5;
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => chain, { FieldValue: { serverTimestamp: () => 'TS', increment: n => n, delete: () => 'DEL', arrayUnion: (...a) => a } }) : chain, apply: () => chain });
      // a fake AudioContext: state is set by the test ('running' | 'suspended'); resume() only works when window.__audioOk
      window.__dings = 0; window.__vib = 0;
      window.AudioContext = function () {
        const self = window.__ac = this; this.state = window.__audioOk ? 'running' : 'suspended'; this.currentTime = 0; this.destination = {};
        this.resume = () => { if (window.__audioOk) self.state = 'running'; return Promise.resolve(); };
        const node = () => ({ type: '', frequency: { value: 0 }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { window.__dings++; }, stop() {} });
        this.createOscillator = node; this.createGain = node;
      };
      navigator.vibrate = () => { window.__vib++; return true; };
    });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.owedRemind && window.internArticles && window.fbRemind && window.ktNudge && typeof schDailyTiles === 'function');
    await page.evaluate(() => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
      const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
    });

    // ---- pure rules
    const pure = await page.evaluate(() => {
      const R = owedRemind, arts = [{ id: 'a1', title: 'A1' }, { id: 'a2', title: 'A2' }];
      return {
        morning: R.pending({ journal: true, case: true, articles: arts, daily: false }).map(r => r.k),
        noon: R.pending({ journal: true, case: true, articles: arts, daily: true }).map(r => r.k),
        done: R.pending({ journal: false, case: true, articles: [], daily: true }).map(r => r.k),
        unknown: R.pending({ journal: null, case: null, articles: [], daily: true }).length,
        inP: [R.inPeriod({ endDate: '2026-12-31' }, '2026-10-16'), R.inPeriod({ endDate: '2026-10-15' }, '2026-10-16'), R.inPeriod({ endDate: '2026-10-16' }, '2026-10-16'), R.inPeriod({ endDate: '2026-12-31', startDate: '2026-11-01' }, '2026-10-16'), R.inPeriod({}, '2026-10-16'), R.inPeriod({ endDate: '2026-12-31', notAnInternship: true }, '2026-10-16')],
        hours: [R.dailyDue(11, 'Wed'), R.dailyDue(12, 'Wed'), R.dailyDue(15, 'Wed'), R.dailyDue(16, 'Wed'), R.dailyDue(23, 'Fri'), R.dailyDue(16, 'Sat'), R.dailyDue(20, 'Sun'), R.dailyDue(16, 'Mon')],
        dec: [R.decide(null, 2, 'T').show, R.decide({ day: 'T', later: 0, n: 2 }, 2, 'T').show, R.decide({ day: 'Y', later: 3, n: 2 }, 2, 'T').show, R.decide({ day: 'Y', later: 3, n: 2 }, 1, 'T').show, R.decide({ day: 'Y', later: 3, n: 2 }, 1, 'T').state.later, R.decide(null, 0, 'T').show, R.decide({ day: 'Y', later: 2, n: 2 }, 2, 'T').show],
        others: [R.others({ art: 'T' }, 'T'), R.others({ fb: 'T' }, 'T'), R.others({ kt: 'T' }, 'T'), R.others({ art: 'Y', fb: 'Y', kt: '' }, 'T')]
      };
    });
    assert.deepEqual(pure.morning, ['article', 'article'], 'Journal / Case not due (before 16:00 or a weekend): only the articles count');
    assert.deepEqual(pure.noon, ['journal', 'case', 'article', 'article'], 'when due, Journal + Case first, then the articles');
    assert.deepEqual(pure.done, ['case'], 'a sent Journal is not owed');
    assert.equal(pure.unknown, 0, 'a cache that has not loaded is not "owed"');
    assert.deepEqual(pure.inP, [true, false, true, false, false, false], 'internship period gate: ' + pure.inP);
    assert.deepEqual(pure.hours, [false, false, false, true, true, false, false, true], '16:00 Bangkok, Mon–Fri only: ' + pure.hours);
    assert.deepEqual(pure.dec, [true, false, false, true, 0, false, true], 'decide: first look · once a day · 3 Laters stop it · done resets · nothing owed: ' + pure.dec);
    assert.deepEqual(pure.others, [true, true, true, false]);

    // ---- real page state: an intern inside the internship period, Journal + Case not sent, two unread articles
    const T0 = Date.parse('2026-10-21T18:00:00+07:00');   // Wednesday 18:00 Bangkok
    async function setup({ now, arts, me, state }) {
      await page.clock.setFixedTime(now);
      await page.evaluate(({ now, arts, me, D, state }) => {
        document.querySelectorAll('#ord-back,#ord-sheet,#art-back,#art-sheet,#fbr-back,#kt-back,#kt-sheet').forEach(e => e.remove());
        document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
        localStorage.clear(); if (state) Object.keys(state).forEach(k => localStorage.setItem(k, JSON.stringify(state[k])));
        userId = 'u1'; window.myRegistered = true;
        window.myUserDoc = Object.assign({ startDate: '2026-09-01', endDate: '2026-12-31', group: 'EXTERN', division: 'RSU' }, me || {});
        profileActivityState.logs = 'ready'; profileActivityState.cases = 'ready';
        window.myReflectiveLogsCache = []; window.myLpEntriesCache = []; window.myCasesCache = [];
        const art = (id, o) => Object.assign({ id, status: 'scheduled', title: { en: 'EN ' + id, th: 'ไทย ' + id, ko: 'KO ' + id }, body: { en: 'B', th: 'ข', ko: 'K' }, startAt: now - D, endAt: now + 5 * D, audience: { divisions: [], groups: [] }, rerun: 'any' }, o);
        internArticles._S.list = (arts || []).map(a => art(a.id, a));
        window.__go = []; window.gotoLog = () => __go.push('journal'); window.gotoCaseSubmit = () => __go.push('case');
        internArticles.openArticle = id => __go.push('article:' + id);
        window.__audioOk = true; window.__dings = 0; window.__vib = 0;
      }, { now, arts, me, D, state });
    }
    const sheetText = () => page.evaluate(() => { const s = document.getElementById('ord-sheet'); return s ? s.innerText.replace(/\s+/g, ' ').trim() : null; });
    const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#ord-sheet .ord-row')).map(r => r.dataset.k + (r.dataset.id ? ':' + r.dataset.id : '')));
    const stateOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('owedRemind:u1') || 'null'));
    const close = () => page.evaluate(() => { document.querySelectorAll('#ord-back,#ord-sheet').forEach(e => e.remove()); });
    const TWO = [{ id: 'a1' }, { id: 'a2', startAt: T0 - 2 * D }];

    // ---- 14:00 — Journal, Case and both articles (newest article first), on the real page
    await setup({ now: T0, arts: TWO });
    fs.mkdirSync(process.env.OWED_PNG || 'C:/Users/HP/AppData/Local/Temp/remind_png', { recursive: true });
    await page.screenshot({ path: (process.env.OWED_PNG || 'C:/Users/HP/AppData/Local/Temp/remind_png') + '/final_before.png' });   // the same Home with no sheet
    await page.evaluate(() => owedRemind.check());
    assert.deepEqual(await rows(), ['journal', 'case', 'article:a1', 'article:a2'], 'weekday evening rows: ' + await rows());
    let txt = await sheetText();
    assert.match(txt, /4 things waiting for you/, txt);
    assert.match(txt, /Journal not sent today/); assert.match(txt, /EN a1/); assert.match(txt, /Write Journal/); assert.match(txt, /Once a day/); assert.match(txt, /Sound on/);
    const fit = await page.evaluate(() => {
      const s = document.getElementById('ord-sheet').getBoundingClientRect();
      const small = Array.from(document.querySelectorAll('#ord-sheet button')).filter(b => b.getBoundingClientRect().height < 44).map(b => b.id || b.className);
      return { w: Math.round(s.width), right: Math.round(s.right), over: document.documentElement.scrollWidth > innerWidth, small, grp: !!document.querySelector('#ord-sheet.lang-no-toggle') };
    });
    assert.ok(fit.w <= 390 && fit.right <= 390 && !fit.over, 'fits a 390 px phone: ' + JSON.stringify(fit));
    assert.deepEqual(fit.small, [], 'every button is at least 44 px high: ' + fit.small);
    assert.ok(fit.grp, 'wrapped in lang-no-toggle so the toggle does not hide the Thai/Korean text');
    let st = await stateOf();
    assert.equal(st.day, '2026-10-21', 'showing counts as today\'s look');
    assert.equal(st.chime, '2026-10-21', 'the chime played (audio unlocked)');
    const snd = await page.evaluate(() => ({ dings: __dings, vib: __vib }));
    assert.deepEqual(snd, { dings: 2, vib: 1 }, 'a 2-note ding + one vibration: ' + JSON.stringify(snd));
    assert.equal(await page.evaluate(() => document.getElementById('ord-tap').hidden), true, 'no "tap anywhere" hint when audio is unlocked');
    // the 📰 popup / feedback reminder / Know thyself stay quiet on top of an open sheet
    await page.evaluate(() => { internArticles._later(); fbRemind.check(); ktNudge.check(); });
    assert.equal(await page.evaluate(() => !!document.getElementById('art-back') || !!document.getElementById('fbr-back') || !!document.getElementById('kt-back')), false, 'no second popup under / over the sheet');
    // a screenshot of the real sheet for the PR
    fs.mkdirSync(process.env.OWED_PNG || 'C:/Users/HP/AppData/Local/Temp/remind_png', { recursive: true });
    await page.waitForTimeout(450);
    await page.screenshot({ path: (process.env.OWED_PNG || 'C:/Users/HP/AppData/Local/Temp/remind_png') + '/final_en.png' });
    // Later / Esc / backdrop each count one Later; it does not come back the same day
    await page.click('#ord-later');
    assert.equal(await page.evaluate(() => !!document.getElementById('ord-sheet')), false, 'Later closes it');
    assert.equal((await stateOf()).later, 1);
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'once a day');
    assert.equal(await page.evaluate(() => owedRemind.holds()), true, 'the day\'s slot stays with the sheet after it closed');
    await page.evaluate(() => { internArticles._later(); fbRemind.check(); ktNudge.check(); });
    assert.equal(await page.evaluate(() => !!document.getElementById('art-back') || !!document.getElementById('fbr-back') || !!document.getElementById('kt-back')), false, 'the others stay quiet for the rest of the day');

    // ---- three Laters in a row stop it; a done item resets; the next day it shows again
    const Y = { 'owedRemind:u1': { day: '2026-10-20', later: 2, n: 4, chime: '2026-10-20' } };
    await setup({ now: T0, arts: TWO, state: Y });
    await page.evaluate(() => owedRemind.check());
    assert.ok(await sheetText(), 'two Laters so far — shows');
    await page.keyboard.press('Escape');
    assert.equal((await stateOf()).later, 3, 'Esc = Later');
    await setup({ now: T0 + D, arts: TWO, state: { 'owedRemind:u1': await stateOf() } });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'three Laters in a row: stopped');
    await setup({ now: T0 + D, arts: [{ id: 'a1' }], state: { 'owedRemind:u1': { day: '2026-10-21', later: 3, n: 4, chime: '' } } });
    await page.evaluate(() => owedRemind.check());
    assert.match(await sheetText() || '', /3 things waiting/, 'an item done (4 → 3) resets the Laters');
    await close();
    await setup({ now: T0, arts: [{ id: 'a1' }], state: { 'owedRemind:u1': { day: '2026-10-20', later: 0, n: 1 } } });
    await page.evaluate(() => owedRemind.check());
    await page.mouse.click(195, 60);   // backdrop
    assert.equal((await stateOf()).later, 1, 'backdrop = Later');

    // ---- rows go straight to the item
    for (const [sel, want] of [['[data-k=journal]', ['journal']], ['[data-k=case]', ['case']], ['[data-id=a2]', ['article:a2']], ['#ord-go', ['journal']]]) {
      await setup({ now: T0, arts: TWO });
      await page.evaluate(() => owedRemind.check());
      await page.click('#ord-sheet ' + sel);
      assert.deepEqual(await page.evaluate(() => __go), want, sel + ' opens the item');
      assert.equal(await page.evaluate(() => !!document.getElementById('ord-sheet')), false, 'the sheet closes');
      assert.equal((await stateOf()).later || 0, 0, 'opening an item is not a Later');
    }

    // ---- morning: only the unread article, no Journal / Case; the article is the primary action; nothing owed → no sheet
    await setup({ now: Date.parse('2026-10-21T09:00:00+07:00'), arts: [{ id: 'a1' }] });
    await page.evaluate(() => owedRemind.check());
    assert.deepEqual(await rows(), ['article:a1'], 'morning: just the article');
    txt = await sheetText(); assert.match(txt, /1 thing waiting for you/); assert.match(txt, /Read now/);
    await close();
    await setup({ now: Date.parse('2026-10-21T09:00:00+07:00'), arts: [] });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'morning with nothing to read: no sheet');
    assert.equal(await page.evaluate(() => owedRemind.holds()), false);
    // Journal / Case from 16:00 Bangkok, never on Sat / Sun; articles any time
    for (const [label, iso, want] of [['15:59 Wed', '2026-10-21T15:59:00+07:00', ['article:a1']], ['16:00 Wed', '2026-10-21T16:00:00+07:00', ['journal', 'case', 'article:a1']], ['18:00 Sat', '2026-10-24T18:00:00+07:00', ['article:a1']], ['20:00 Sun', '2026-10-25T20:00:00+07:00', ['article:a1']], ['16:00 Mon', '2026-10-26T16:00:00+07:00', ['journal', 'case', 'article:a1']]]) {
      await setup({ now: Date.parse(iso), arts: [{ id: 'a1' }] });
      await page.evaluate(() => owedRemind.check());
      assert.deepEqual(await rows(), want, label + ': ' + await rows());
      await close();
    }
    await setup({ now: Date.parse('2026-10-24T18:00:00+07:00'), arts: [] });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'Saturday with nothing to read: no sheet');
    assert.equal(await page.evaluate(() => owedRemind.holds()), false);
    await setup({ now: Date.parse('2026-10-21T15:59:00+07:00'), arts: [] });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'before 16:00 with nothing to read: no sheet');
    // a Journal already sent → only the Case row at 14:00
    await setup({ now: T0, arts: [] });
    await page.evaluate((t) => { window.myReflectiveLogsCache = [{ timestamp: { toDate: () => new Date(t) } }]; }, T0 - 3600e3);
    await page.evaluate(() => owedRemind.check());
    assert.deepEqual(await rows(), ['case'], 'a Journal sent today is not owed: ' + await rows());
    await close();
    // a cache that has not loaded yet is never shown as owed
    await setup({ now: T0, arts: [] });
    await page.evaluate(() => { profileActivityState.logs = 'loading'; profileActivityState.cases = 'loading'; owedRemind.check(); });
    assert.equal(await sheetText(), null, 'not loaded = not owed');

    // ---- "+n more": 3 article rows at most, then +n
    await setup({ now: T0, arts: [1, 2, 3, 4, 5].map(i => ({ id: 'x' + i, startAt: T0 - i * 3600e3 })) });
    await page.evaluate(() => owedRemind.check());
    assert.deepEqual(await rows(), ['journal', 'case', 'article:x1', 'article:x2', 'article:x3'], 'Journal + Case + 3 articles');
    assert.match(await sheetText(), /7 things waiting for you.*\+2 more/, 'the rest is a "+2 more"');
    await close();

    // ---- languages
    for (const [cls, re] of [['lang-th-on', /วันนี้ยังมีค้าง 4 อย่าง.*ยังไม่ได้ส่งวันนี้.*ภายหลัง.*เปิดเสียง/], ['lang-kr-on', /오늘 남은 일 4개.*오늘 아직 안 보냄.*나중에.*소리 켬/]]) {
      await setup({ now: T0, arts: TWO });
      await page.evaluate(c => { document.body.classList.remove('lang-th-on', 'lang-kr-on'); document.body.classList.add(c); }, cls);
      await page.evaluate(() => owedRemind.check());
      assert.match(await sheetText(), re, cls);
      await close();
    }
    await page.evaluate(() => document.body.classList.remove('lang-th-on', 'lang-kr-on'));
    // a Thai screenshot for the PR
    await setup({ now: T0, arts: TWO });
    await page.evaluate(() => { document.body.classList.add('lang-th-on'); owedRemind.check(); });
    await page.waitForTimeout(450);
    await page.screenshot({ path: (process.env.OWED_PNG || 'C:/Users/HP/AppData/Local/Temp/remind_png') + '/final_th.png' });
    await close();
    await page.evaluate(() => document.body.classList.remove('lang-th-on'));

    // ---- the chime: locked audio → hint + first tap rings it; muted → silent; once a day
    await setup({ now: T0, arts: TWO });
    await page.evaluate(() => { window.__audioOk = false; if (window.__ac) window.__ac.state = 'suspended'; owedRemind.check(); });
    assert.equal(await page.evaluate(() => document.getElementById('ord-tap').hidden), false, 'locked audio: "Tap anywhere" hint');
    assert.equal((await page.evaluate(() => __dings)), 0, 'nothing rang yet');
    assert.equal((await stateOf()).chime, '', 'not counted as played');
    await page.evaluate(() => { window.__audioOk = true; });
    await page.waitForTimeout(450);
    await page.screenshot({ path: (process.env.OWED_PNG || 'C:/Users/HP/AppData/Local/Temp/remind_png') + '/final_locked.png' });
    await page.tap('#ord-sheet .ord-head');   // any tap
    await page.waitForFunction(() => __dings === 2);
    await page.waitForFunction(() => document.getElementById('ord-tap').hidden);
    assert.equal((await stateOf()).chime, '2026-10-21', 'the first tap rang it, once');
    await close();
    // muted: no ding, and the 🔕 label; toggling on rings a preview
    await setup({ now: T0, arts: TWO });
    await page.evaluate(() => { localStorage.setItem('owedRemind.mute', '1'); owedRemind.check(); });
    assert.equal(await page.evaluate(() => __dings), 0, 'muted: silent');
    assert.match(await sheetText(), /Muted/);
    assert.equal(await page.evaluate(() => document.getElementById('ord-snd').getAttribute('aria-pressed')), 'false');
    await page.click('#ord-snd');
    assert.equal(await page.evaluate(() => localStorage.getItem('owedRemind.mute')), null, 'toggled on (saved on the device)');
    assert.equal(await page.evaluate(() => __dings), 2, 'turning sound on rings a preview');
    await page.click('#ord-snd');
    assert.equal(await page.evaluate(() => localStorage.getItem('owedRemind.mute')), '1', 'toggled off again');
    assert.equal(await page.evaluate(() => __dings), 2, 'no preview when muting');
    await close();
    // the chime rings once a day: a second sheet the same day (after 3 Later? no — state already has chime today) stays silent
    await setup({ now: T0, arts: TWO, state: { 'owedRemind:u1': { day: '2026-10-20', later: 0, n: 4, chime: '2026-10-21' } } });
    await page.evaluate(() => owedRemind.check());
    assert.ok(await sheetText()); assert.equal(await page.evaluate(() => __dings), 0, 'already chimed today: silent');
    await close();

    // ---- precedence: gives way when another popup already showed today
    const todayKey = '2026-10-21';
    await setup({ now: T0, arts: TWO, me: { articlePopDay: todayKey } });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'the 📰 popup showed today → the sheet gives way');
    assert.equal(await page.evaluate(() => owedRemind.holds()), false);
    await setup({ now: T0, arts: TWO, state: { 'fbRemind:u1': { day: todayKey, later: 0, n: 1 } } });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'the feedback reminder showed today → the sheet gives way');
    await setup({ now: T0, arts: TWO, state: { 'ktNudge:u1': { b: [todayKey] } } });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'Know thyself showed today → the sheet gives way');

    // ---- the sheet holds the slot BEFORE it shows: the real 📰 popup / feedback reminder / Know thyself yield
    await setup({ now: T0, arts: TWO });
    await page.evaluate(() => {
      quizzesCache = [{ id: 'q1', title: 'Q one' }];
      quizAttemptsCache = { q1: { quizId: 'q1', status: 'approved', timestamp: { toMillis: () => Date.now() }, correctCount: 5, totalQuestions: 10 } };
    });
    assert.equal(await page.evaluate(() => owedRemind.holds()), true, 'pending sheet holds the slot');
    await page.evaluate(() => { internArticles._later(); fbRemind.check(); ktNudge.check(); });
    assert.equal(await page.evaluate(() => !!document.getElementById('art-back') || !!document.getElementById('fbr-back') || !!document.getElementById('kt-back') || !!document.getElementById('kt-sheet')), false, 'popup / feedback / Know thyself yield to the pending sheet');
    // outside the internship period nothing changes: the 📰 popup opens as before
    await setup({ now: T0, arts: TWO, me: { endDate: '2026-10-01' } });
    await page.evaluate(() => owedRemind.check());
    assert.equal(await sheetText(), null, 'past the internship end: no sheet');
    assert.equal(await page.evaluate(() => owedRemind.holds()), false, 'and it does not hold the slot');
    await page.evaluate(() => { document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; }); internArticles._later(); });
    assert.equal(await page.evaluate(() => !!document.getElementById('art-back')), true, 'the 📰 popup is unchanged');
    // notAnInternship / admin preview / unregistered: nothing
    for (const [label, fn] of [['notAnInternship', () => { window.myUserDoc.notAnInternship = true; }], ['preview-admin', () => { userId = 'preview-admin'; }], ['unregistered', () => { window.myRegistered = false; }]]) {
      await setup({ now: T0, arts: TWO });
      await page.evaluate(fn); await page.evaluate(() => owedRemind.check());
      assert.equal(await sheetText(), null, label + ': nothing');
      assert.equal(await page.evaluate(() => owedRemind.holds()), false, label + ': no hold');
    }
    // never on top of a modal: waits
    await setup({ now: T0, arts: TWO });
    await page.evaluate(() => { const m = document.querySelector('.modal'); m.style.display = 'flex'; owedRemind.check(); });
    assert.equal(await sheetText(), null, 'a modal is open → waits');
    await page.evaluate(() => { document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; }); });

    // ---- articles.js: owed() — live newest first, then re-runs oldest first; muted / read / not for me excluded; null before the list loads
    const o = await page.evaluate(({ T0, D }) => {
      const A = internArticles, now = T0;
      const art = (id, o) => Object.assign({ id, status: 'scheduled', title: { en: 'T ' + id }, body: { en: 'B' }, startAt: now - D, endAt: now + D, audience: { divisions: [], groups: [] }, rerun: 'any' }, o);
      const old1 = art('old1', { startAt: now - 40 * D, endAt: now - 34 * D }), old2 = art('old2', { startAt: now - 60 * D, endAt: now - 54 * D });
      const live1 = art('l1', { startAt: now - 3 * D }), live2 = art('l2', { startAt: now - D });
      const newbie = { group: 'EXTERN', division: 'RSU', startDate: '2026-10-19' }, vet = { group: 'EXTERN', division: 'RSU', startDate: '2026-09-01' };
      const ids = r => r && r.map(x => x.id).join(',');
      return {
        order: ids(A._owed([old1, live1, old2, live2], newbie, now)),
        vet: ids(A._owed([old1, live1, live2], vet, now)),
        read: ids(A._owed([live1, live2], Object.assign({}, vet, { articleSeen: { l1: { act: 'ok' }, l2: { act: 'x' } } }), now)),
        muted: ids(A._owed([live1], Object.assign({}, vet, { articlesMuted: true }), now)),
        cu: ids(A._owed([art('cu', { audience: { divisions: ['CU'], groups: [] } })], vet, now)),
        draft: ids(A._owed([Object.assign(art('d'), { status: 'draft' })], vet, now)),
        loading: A._owed(null, vet, now), noMe: A._owed([live1], null, now)
      };
    }, { T0, D });
    assert.equal(o.order, 'l2,l1,old2,old1', 'live newest first, then the re-runs oldest first: ' + o.order);
    assert.equal(o.vet, 'l2,l1', 'an intern who joined before the old one ended gets no re-run');
    assert.equal(o.read, 'l2', 'only "Got it / link / History" counts as read — a closed (✕) one is still owed: ' + o.read);
    assert.equal(o.muted, '', 'articles turned off with 🔕: none'); assert.equal(o.cu, '', 'audience');
    assert.equal(o.draft, '', 'draft'); assert.equal(o.loading, null, 'null while the list is loading'); assert.equal(o.noMe, null);

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS owed-remind-qa');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
