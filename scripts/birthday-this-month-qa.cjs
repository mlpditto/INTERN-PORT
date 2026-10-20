// V102.330: 🎂 birthday this month (admin only). The REAL admin.html in Chromium (network stubbed, Bangkok time, sample users):
// User Hub rows get a 🎂 chip after Q · J · C (past faded, today solid "Today", no year / age); the header "🎂 n" counts them and
// filters to them (hidden when 0); hidden (isIgnored) users and pre-registrations never count; 29 Feb falls on 28 Feb in a common year.
// The Dashboard strip (holidays-admin.js) shows this month's birthdays first, has a 🎂 kind toggle, and the 🗓 month view marks them.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: 'Asia/Bangkok' })).newPage();
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.birthdayThisMonth === 'function' && typeof renderTable === 'function' && window.Holidays && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        const T = await page.evaluate(() => {
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
            const y = Number(today.slice(0, 4)), m = today.slice(5, 7), dd = today.slice(8, 10);
            const last = String(new Date(Date.UTC(y, Number(m), 0)).getUTCDate()).padStart(2, '0');
            const other = m === '03' ? '04' : '03';
            const mk = (id, name, birthday, extra) => Object.assign({ id, displayName: name, fullName: name, birthday, group: 'Public', score: 1 }, extra || {});
            usersData = [
                mk('today', 'TodayKid', '1999-' + m + '-' + dd),
                mk('first', 'FirstKid', '2000-' + m + '-01'),
                mk('last', 'LastKid', '2001-' + m + '-' + last),
                mk('other', 'OtherMonth', '2000-' + other + '-10'),
                mk('none', 'NoBirthday', ''),
                mk('hidden', 'HiddenKid', '1998-' + m + '-' + dd, { isIgnored: true }),
            ];
            preRegData = [{ id: 'pre1', fullName: 'Pre', claimed: false, birthday: '1999-' + m + '-' + dd }];
            window.__hub = []; window.openUserHub = id => window.__hub.push(id);
            const t = document.getElementById('tab-users');
            document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active')); t.classList.add('active');
            for (let a = t; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            renderTable('users');
            return { today, y, m, dd, last };
        });
        const expect = { today: 'today', first: T.dd === '01' ? 'today' : 'past', last: T.dd === T.last ? 'today' : 'soon' };
        const n = 3;   // today + first + last (first/last may coincide with today's day — still three people)

        // 1 · helpers
        const st = await page.evaluate(() => Object.fromEntries(usersData.map(u => [u.id, (window.birthdayThisMonth(u) || {}).state || null])));
        assert.deepEqual(st, { today: 'today', first: expect.first, last: expect.last, other: null, none: null, hidden: null }, 'states: ' + JSON.stringify(st));
        assert.deepEqual(await page.evaluate(() => [window.birthdayInMonth({ birthday: '2000-02-29' }, 2027, 2), window.birthdayInMonth({ birthday: '2000-02-29' }, 2028, 2)].map(b => b.d + '|' + b.label)),
            ['2027-02-28|29 Feb', '2028-02-29|29 Feb'], '29 Feb → 28 Feb in a common year, label stays 29 Feb');
        assert.equal(await page.evaluate(() => window.birthdayInMonth({ birthday: '2000-10-05', isPreReg: true }, 2026, 10)), null, 'pre-registration never counts');

        // 2 · row chips
        const chips = await page.$$eval('#usersTable tbody tr', trs => trs.map(tr => { const c = tr.querySelector('.u-bday'); return c ? [tr.innerHTML.match(/userRowQuick\('([^']+)'/)?.[1], c.className, c.textContent.trim(), c.title] : null; }).filter(Boolean));
        const byId = Object.fromEntries(chips.map(c => [c[0], c]));
        assert.deepEqual(Object.keys(byId).sort(), ['first', 'last', 'today'], 'chips only for this month, not hidden: ' + JSON.stringify(chips));
        assert.equal(byId.today[2], '🎂 Today'); assert.match(byId.today[1], /\btoday\b/);
        if (expect.first === 'past') { assert.match(byId.first[1], /\bpast\b/); assert.match(byId.first[2], /^🎂 1 [A-Z][a-z]{2}$/, 'date, no year: ' + byId.first[2]); }
        assert.match(byId.today[3], /Birthday .* · วันเกิด · 생일/, 'EN · TH · KO tooltip');
        assert.ok(!chips.some(c => /\d{4}/.test(c[2]) || /age|ปี/.test(c[2])), 'no year / age');

        // 3 · header 🎂 n + filter
        assert.deepEqual(await page.$eval('#user-bday-filter', b => [b.hidden, b.textContent, b.getAttribute('aria-pressed')]), [false, '🎂 ' + n, 'false']);
        const before = await page.$$eval('#usersTable tbody tr .u-qjc', e => e.length);
        await page.click('#user-bday-filter');
        assert.equal(await page.$eval('#user-bday-filter', b => b.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.$$eval('#usersTable tbody tr .u-qjc', e => e.length), n, 'only the birthday rows');
        await page.click('#user-bday-filter');
        assert.equal(await page.$$eval('#usersTable tbody tr .u-qjc', e => e.length), before, 'all rows back');
        await page.evaluate(() => { usersData.forEach(u => { if (u.id !== 'hidden') u.birthday = ''; }); renderTable('users'); });
        assert.equal(await page.$eval('#user-bday-filter', b => b.hidden), true, 'no birthday this month → no pill');
        await page.evaluate(m => { const set = { today: '1999-' + m.m + '-' + m.dd, first: '2000-' + m.m + '-01', last: '2001-' + m.m + '-' + m.last, other: '2000-03-10' }; usersData.forEach(u => { if (set[u.id]) u.birthday = set[u.id]; }); renderTable('users'); }, T);

        // 4 · Dashboard strip
        await page.evaluate(() => {
            try { Holidays.boot(); } catch (e) { /* the Firestore read never resolves here */ }
            const S = Holidays._S; S.obsList = []; S.obs = {}; S.saved = {}; S.loaded = true;
            const h = document.getElementById('tab-sidequest');
            document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active')); h.classList.add('active');
            for (let a = h; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            Holidays.renderStrip();
        });
        const pills = await page.$$eval('#hol-strip .hol-pill', ps => ps.map(p => [p.textContent.replace(/\s+/g, ' ').trim(), p.style.background]));
        assert.equal(pills.length, n, 'one pill per birthday this month (whole month): ' + JSON.stringify(pills));
        assert.ok(pills.every(p => p[0].startsWith('🎂')), 'birthday pills');
        const tp = pills.find(p => /TodayKid/.test(p[0]));
        assert.match(tp[0], /today$/); assert.equal(tp[1], 'rgb(219, 39, 119)', 'today = solid pink');
        assert.ok(!pills.some(p => /HiddenKid|OtherMonth|Pre/.test(p[0])), 'hidden / other month / pre-reg left out');
        await page.click('#hol-strip .hol-pill:has-text("TodayKid")');
        assert.deepEqual(await page.evaluate(() => window.__hub), ['today'], 'a pill opens that person in the User Hub');
        assert.equal(await page.$$eval('#hol-strip .hol-kinds button', b => b.length), 4, '🎌 🩺 🐱 🎂 toggles');
        await page.click('#hol-strip .hol-kinds button[title="Birthdays"]');
        assert.equal(await page.$$eval('#hol-strip .hol-pill', p => p.length), 0, '🎂 off hides them');
        await page.click('#hol-strip .hol-kinds button[title="Birthdays"]');
        // month view
        await page.evaluate(() => Holidays.toggleCal());
        const cal = await page.evaluate(() => ({ cells: [...document.querySelectorAll('#hol-cal .hol-c.k-b')].length, count: (document.querySelector('#hol-cal .hol-n.k-b') || {}).textContent || '' }));
        assert.ok(cal.cells >= 1, 'month view marks the birthday days'); assert.equal(cal.count.replace(/\s+/g, ' ').trim(), '🎂 ' + n);
        await page.evaluate(d => Holidays.pickDay(d), T.today);
        assert.match(await page.$eval('#hol-cal .hol-det', e => e.textContent), /TodayKid/, 'the day list names the person');
        assert.equal(await page.$$eval('#hol-cal .hol-det .hol-ok', b => b.filter(x => x.textContent === '↗').length), 1, '↗ opens the User Hub (never a show-to-interns ✓)');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('birthday-this-month-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
