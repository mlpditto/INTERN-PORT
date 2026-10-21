// V101.184: Schedule round 4 (mockup picked 2026-10-21). The REAL public/index.html on a touch phone (file://, network blocked,
// Firebase stubbed): This week / Next week follow the strip's Mon–Sun weeks · Next week folds to its header like Missed (reset on
// every open) · no legend under the strip · 3px ring, pale = 20 %, 20px day count · under 24 h left in orange · ▶ keeps its size
// but gets a 42px tap area that never covers the time or the title · a Journal / Case already done today stays as a faded tile
// and is not counted anywhere else.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

async function open(browser, doneToday) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    // V102.358: pin the page clock (Wed 21 Oct 2026 12:00 Bangkok). The 'under 24 h' fixture is now + 20 h and must land on TOMORROW (a week-list
    // row, orange); before 04:00 it was still today (a today tile, grey by design) and the run went red every night, on CI too.
    await page.clock.setFixedTime(new Date('2026-10-21T12:00:00+07:00'));
    await page.addInitScript(() => {
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    page.on('pageerror', () => {});
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    await page.waitForTimeout(600);
    await page.evaluate(doneToday => {
        const H = 3600000, D = n => new Date(Date.now() + n * 86400000), key = n => schDateKey(D(n));
        const ts = n => ({ toDate: () => D(n), seconds: Math.floor(D(n) / 1000) });
        window.userId = 'U1';
        usersData = [{ id: 'U1', displayName: 'Sample', startDate: key(-60), endDate: key(120) }];
        window.myUserDoc = { id: 'U1', startDate: key(-60), endDate: key(120) };
        myCheckin = { lastDate: key(0) };
        myCasesCache = window.myCasesCache = doneToday ? [{ id: 'c0', timestamp: ts(0), createdAt: ts(0) }] : [];
        window.myReflectiveLogsCache = doneToday ? [{ id: 'j0', timestamp: ts(0), createdAt: ts(0) }] : [];
        questsCache = [];
        // one quiz per bucket, placed by the page's own week (whatever weekday the test runs on)
        const mon = schMonday(new Date());
        const at = (dayFromMon, h) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + dayFromMon, h, 0, 0);
        const Q = (id, title, due) => ({ id, title, isActive: true, deadline: due });
        const soon = new Date(Date.now() + 20 * H);
        quizzesCache = [Q('zs', 'Soon quiz', soon), Q('zn', 'Next week quiz', at(9, 12)), Q('zl', 'Later quiz', at(20, 12)),
            Q('zt', 'ยาวมาก ชื่อแบบทดสอบภาษาไทยที่ยาวมากจนต้องตัดด้วยจุดสามจุดแน่นอน', soon)];
        quizAttemptsCache = {}; mySubmissionsCache = {};
        schEventsCache = []; schMyEventInterests = {}; schLoadEvents = () => {};
        getUnifiedAllItems = () => [];
        schCheckinDays = new Set([key(0)]);
        if (window.assignedGoals) assignedGoals.userOpen = () => {};
    }, doneToday);
    await page.evaluate(() => openScheduleModal());
    await page.waitForTimeout(250);
    return { page, ctx };
}

const heads = page => page.evaluate(() => [...document.querySelectorAll('#sch-agenda > div')].map(d => d.firstElementChild && d.firstElementChild.style.textTransform === 'uppercase' ? d.textContent.replace(/\s+/g, ' ').trim() : null).filter(Boolean));
const rowTitles = page => page.evaluate(() => [...document.querySelectorAll('#sch-agenda span.lang-no-toggle')].filter(s => s.offsetParent).map(s => s.textContent.trim()));

(async () => {
    const browser = await chromium.launch();
    try {
        // ---- 1. bucket rule: the strip's Mon–Sun weeks (a fixed Wednesday 19:00)
        let { page, ctx } = await open(browser, false);
        const b = await page.evaluate(() => {
            const now = new Date(2026, 9, 21, 19, 0), B = due => schBucketOf({ due }, now);
            return [B(new Date(2026, 9, 25, 23, 0)), B(new Date(2026, 9, 26, 9, 0)), B(new Date(2026, 10, 1, 23, 0)), B(new Date(2026, 10, 2, 9, 0)),
                schBucketOf({ opens: new Date(2026, 9, 23, 9, 0), due: new Date(2026, 10, 30) }, now), B(new Date(2026, 9, 21, 22, 0)), B(new Date(2026, 9, 20))];
        });
        assert.deepEqual(b, ['week', 'nextweek', 'nextweek', 'later', 'week', 'today', 'missed'], 'Sun 25 = this week · Mon 26–Sun 1 = next week · Mon 2 = later · opens Fri = this week: ' + b);

        // ---- 2. Next week folds to its header (count kept), opens on tap, and every open starts folded again
        const before = await heads(page);
        const nextHead = before.find(h => /^Next week/i.test(h));
        assert.ok(nextHead && /1\s*▾$/.test(nextHead), 'NEXT WEEK 1 ▾ header: ' + before.join(' | '));
        assert.ok(!(await rowTitles(page)).includes('Next week quiz'), 'folded: its row is hidden');
        await page.evaluate(() => schToggleNextWeek()); await page.waitForTimeout(80);
        assert.ok((await rowTitles(page)).includes('Next week quiz'), 'tap the header: the row shows');
        assert.ok((await heads(page)).some(h => /^Next week.*▴$/i.test(h)), '▴ when open');
        await page.evaluate(() => { closeScheduleModal(); openScheduleModal(); }); await page.waitForTimeout(80);
        assert.ok(!(await rowTitles(page)).includes('Next week quiz'), 'reopen = folded again');
        assert.ok((await rowTitles(page)).includes('Later quiz') || (await heads(page)).some(h => /^Later/i.test(h)), 'Later still listed');

        // ---- 3. strip: no legend · 3px ring · 20px day count
        assert.equal(await page.locator('#sch-week .sch-legend').count(), 0, 'no legend under the strip');
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#sch-week .sch-n b')).top), '3px', '3px ring');
        assert.equal(await page.evaluate(() => { const i = document.createElement('i'); i.className = 'sch-cnt'; document.querySelector('#sch-week .sch-n').appendChild(i); const h = getComputedStyle(i).height; i.remove(); return h; }), '20px', '20px day count');

        // ---- 4. under 24 h left: orange bold; a later row stays grey
        const when = await page.evaluate(() => [...document.querySelectorAll('#sch-agenda span')].filter(s => / left$/.test(s.textContent.trim()) && s.offsetParent).map(s => [s.textContent.trim(), getComputedStyle(s).color, getComputedStyle(s).fontWeight]));
        const soonRow = when.find(w => /^\d+h/.test(w[0])), farRow = when.find(w => /^\d+d/.test(w[0]));
        assert.ok(soonRow && soonRow[1] === 'rgb(194, 65, 12)' && +soonRow[2] >= 700, 'under 24 h = orange bold: ' + JSON.stringify(when));
        assert.ok(farRow && farRow[1] === 'rgb(100, 116, 139)', 'days left = grey: ' + JSON.stringify(farRow));

        // ---- 5. ▶: same size, 42px tap area that never covers the time or a long Thai title
        const taps = await page.evaluate(() => [...document.querySelectorAll('#sch-agenda .sch-go')].filter(x => x.offsetParent).map(btn => {
            const row = btn.parentElement, r = e => e.getBoundingClientRect(), br = r(btn), cy = br.top + br.height / 2;
            const spans = [...row.children].filter(x => x.tagName === 'SPAN'), time = spans[spans.length - 1], title = spans[1];
            const at = (x, y) => document.elementFromPoint(x, y);
            return { h: Math.round(br.height), up: at(br.left + br.width / 2, cy - 20) === btn, down: at(br.left + br.width / 2, cy + 20) === btn, left: at(br.left - 4, cy) === btn,
                time: time.contains(at(r(time).right - 1, cy)), title: title.contains(at(r(title).right - 1, cy)) };
        }));
        assert.ok(taps.length >= 2, 'quiz rows with ▶: ' + taps.length);
        for (const t of taps) assert.ok(t.h < 24 && t.up && t.down && t.left && t.time && t.title, '▶ small, 42px tap area, time + title still their own: ' + JSON.stringify(t));
        await ctx.close();

        // ---- 6. done today: Journal + Case stay as faded tiles, counted nowhere else
        ({ page, ctx } = await open(browser, true));
        const tiles = await page.evaluate(() => [...document.querySelectorAll('#sch-agenda .sch-tile')].map(t => ({ t: t.querySelector('.tt').textContent.trim(), done: t.classList.contains('done'), op: getComputedStyle(t).opacity })));
        assert.deepEqual(tiles.map(t => t.t), ['Journal', 'Case'], 'tiles stay in order: ' + JSON.stringify(tiles));
        assert.ok(tiles.every(t => t.done && t.op === '0.42'), 'both faded: ' + JSON.stringify(tiles));
        const counted = await page.evaluate(() => { const its = schAgendaItems(); const m = schWeekMarks(its)[schDateKey(new Date())] || {}; return { today: its.filter(it => schBucketOf(it, new Date()) === 'today').map(it => it.kind), jo: !!m.jo, co: !!m.co }; });
        assert.ok(!counted.today.includes('j') && !counted.today.includes('c') && !counted.jo && !counted.co, 'a done tile is not a to-do (badge / ring): ' + JSON.stringify(counted));
        assert.ok(!(await page.textContent('#sch-agenda')).includes('All done'), 'no "All done" message');
        await ctx.close();
        console.log('PASS schedule-r4-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
