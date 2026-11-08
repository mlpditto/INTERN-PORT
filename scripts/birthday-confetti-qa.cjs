// V101.295 (owner 2026-11-08, pick C): 🎂 birthdays. 1) functions/birthdays.js — today + in 3 days, Bangkok calendar, nickname (else first
// name), never the year, hidden / inactive left out, 29 Feb → 28 Feb, across New Year. 2) getBirthdays reads only those fields, login only.
// 3) The REAL index.html on a phone (Bangkok): a birthday today = confetti for everyone, the snow hidden, ONE toast a day
// "🎉 วันนี้วันเกิด X · 🎂 อีก 3 วัน (DD MONTH) วันเกิด Y"; the birthday person gets gold-heavier confetti, 🎂 after the name, a greeting and the
// Happy Birthday music box at the first tap (once a day, Christmas music paused meanwhile); Info ▸ DOB 🙈 chip writes users.birthdayHidden.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const bd = require(path.join(__dirname, '..', 'functions', 'birthdays.js'));

// 1 · server logic
const active = (u) => u.active !== false;
const users = [
    { id: 'A', nickName: 'Joey', firstName: 'ธนพล', birthday: '1988-11-08', phone: '0812345678' },
    { id: 'B', nickName: 'Mint', birthday: '2001-11-11' },
    { id: 'C', nickName: 'Hidden', birthday: '2000-11-08', birthdayHidden: true },
    { id: 'D', nickName: 'Gone', birthday: '2000-11-08', active: false },
    { id: 'E', firstName: 'ปอ', birthday: '1999-11-08' },
    { id: 'F', nickName: 'Later', birthday: '1999-11-09' },
    { id: 'G', nickName: 'NoName' , birthday: '' },
    { id: 'H', nickName: '', firstName: '', birthday: '1999-11-08' },
];
assert.deepEqual(bd.birthdaysAround(users, '2026-11-08', active), [
    { id: 'A', name: 'Joey', md: '11-08', days: 0 }, { id: 'B', name: 'Mint', md: '11-11', days: 3 }, { id: 'E', name: 'ปอ', md: '11-08', days: 0 }
], 'today + in 3 days; hidden, inactive, nameless, no birthday and tomorrow are left out');
assert.ok(bd.birthdaysAround(users, '2026-11-08', active).every(x => Object.keys(x).join() === 'id,name,md,days'), 'no year, no age, no other field');
assert.deepEqual(bd.birthdaysAround([{ id: 'L', nickName: 'Leap', birthday: '2004-02-29' }], '2027-02-28', active), [{ id: 'L', name: 'Leap', md: '02-28', days: 0 }], '29 Feb → 28 Feb in a common year');
assert.deepEqual(bd.birthdaysAround([{ id: 'L', nickName: 'Leap', birthday: '2004-02-29' }], '2028-02-26', active), [{ id: 'L', name: 'Leap', md: '02-29', days: 3 }], 'leap year keeps 29 Feb');
assert.deepEqual(bd.birthdaysAround([{ id: 'N', nickName: 'NewYear', birthday: '2000-01-01' }], '2026-12-29', active), [{ id: 'N', name: 'NewYear', md: '01-01', days: 3 }], 'across New Year');
assert.equal(bd.bangkokToday(new Date('2026-11-07T18:30:00Z')), '2026-11-08', 'Bangkok day (UTC+7)');

// 2 · the callable
const fnSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const callable = fnSrc.slice(fnSrc.indexOf('exports.getBirthdays'), fnSrc.indexOf('});', fnSrc.indexOf('exports.getBirthdays')));
assert.ok(/if \(!request\.auth\) throw new HttpsError\('unauthenticated'/.test(callable), 'login only');
assert.ok(/\.select\('birthday', 'birthdayHidden', 'nickName', 'firstName', 'isIgnored', 'notAnInternship', 'startDate', 'endDate'\)/.test(callable), 'reads only what it needs');
assert.ok(callable.includes('isActiveMember'), 'active members only (same rule as the leaderboard)');

// 3 · the intern page
const INDEX = pathToFileURL(path.join(__dirname, '..', 'public', 'index.html')).href;
(async () => {
    const browser = await chromium.launch();
    try {
        const open = async (items, me, opts = {}) => {
            const ctx = opts.ctx || await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
            const page = await ctx.newPage();
            const errs = []; page.on('pageerror', e => { if (!/firebase|db is not defined|Cannot read properties of undefined \(reading '(auth|firestore|collection)'\)/.test(e.message)) errs.push(e.message); });
            await page.addInitScript(({ items }) => {
                window.__calls = [];
                window.firebase = { functions: () => ({ httpsCallable: (n) => (a) => { window.__calls.push(n); return Promise.resolve({ data: { today: '2026-11-08', items } }); } }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
                window.__osc = 0;
                const O = function () { this.currentTime = 0; this.destination = {}; };
                O.prototype.createOscillator = function () { window.__osc++; return { frequency: {}, connect: (g) => g, start() {}, stop() {} }; };
                O.prototype.createGain = function () { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d) => d }; };
                O.prototype.close = function () {};
                window.AudioContext = O;
            }, { items });
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(INDEX, { waitUntil: 'load' });
            await page.waitForFunction(() => window.bdBirthdays);
            await page.evaluate((me) => {
                document.getElementById('main-app').style.setProperty('display', 'block', 'important');
                const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
                document.getElementById('u-name').textContent = 'ธนพล';
                document.documentElement.classList.add('xm');
                window.myUserDoc = { id: me };
                bdBirthdays.sync(); bdBirthdays.sync();
            }, me);
            await page.waitForTimeout(400);
            return { page, ctx, errs };
        };
        const state = (page) => page.evaluate(() => ({
            bd: document.documentElement.classList.contains('bd'), me: document.documentElement.classList.contains('bd-me'),
            pieces: document.querySelectorAll('.bd-confetti b').length, gold: [...document.querySelectorAll('.bd-confetti b')].filter(b => /245, 158, 11|251, 191, 36|253, 230, 138/.test(b.style.background)).length,
            snowShown: [...document.querySelectorAll('.xm-snow')].some(s => getComputedStyle(s).display !== 'none'),
            toast: document.getElementById('toast').classList.contains('show') ? document.querySelector('#toast .toast-msg').textContent : '',
            nameAfter: getComputedStyle(document.getElementById('u-name'), '::after').content, calls: window.__calls.length
        }));
        const items = [{ id: 'A', name: 'Joey', md: '11-08', days: 0 }, { id: 'B', name: 'Mint', md: '11-11', days: 3 }];

        // someone else's birthday today + one in 3 days
        const o = await open(items, 'Z');
        const s1 = await state(o.page);
        assert.deepEqual({ ...s1, gold: undefined }, { bd: true, me: false, pieces: 30, gold: undefined, snowShown: false, toast: '🎉 วันนี้วันเกิด Joey · 🎂 อีก 3 วัน (11 พ.ย.) วันเกิด Mint', nameAfter: 'none', calls: 1 }, 'everyone: confetti instead of snow + one toast: ' + JSON.stringify(s1));
        const z = await o.page.evaluate(() => [Number(getComputedStyle(document.querySelector('.bd-confetti')).zIndex), Number(getComputedStyle(document.getElementById('toast')).zIndex)]);
        assert.ok(z[0] > 99999 && z[0] < z[1], 'confetti over every overlay but under the toast (its text stays readable): ' + z);
        await o.page.click('body'); await o.page.waitForTimeout(100);
        assert.equal(await o.page.evaluate(() => window.__osc), 0, 'no tune for others');
        await o.page.close();
        // same device, same day: confetti again, no second toast
        const o2 = await open(items, 'Z', { ctx: o.ctx });
        const s2 = await state(o2.page);
        assert.ok(s2.bd && s2.pieces === 30 && s2.toast === '', 'the toast is once a day per device: ' + JSON.stringify(s2));
        await o.ctx.close();

        // only "in 3 days": no confetti, the snow stays, the toast
        const t3 = await open([{ id: 'B', name: 'Mint', md: '11-11', days: 3 }], 'Z');
        const s3 = await state(t3.page);
        assert.ok(!s3.bd && s3.pieces === 0 && s3.toast === '🎂 อีก 3 วัน (11 พ.ย.) วันเกิด Mint', 'T-3 only: toast, no confetti: ' + JSON.stringify(s3));
        await t3.ctx.close();

        // the birthday person
        const m = await open(items, 'A');
        const sm = await state(m.page);
        assert.ok(sm.bd && sm.me && sm.pieces === 46 && sm.gold >= 15 && sm.nameAfter === '" 🎂"', 'me: more + gold confetti, 🎂 after the name: ' + JSON.stringify(sm));
        assert.equal(sm.toast, '🎂 Happy birthday Joey! สุขสันต์วันเกิด · 🎂 อีก 3 วัน (11 พ.ย.) วันเกิด Mint', 'me: the greeting, not "today is Joey\'s birthday"');
        await m.page.evaluate(() => { window.__xm = []; window.xmMusic = { isOn: () => true, pause: () => window.__xm.push('pause'), play: () => window.__xm.push('play') }; });
        await m.page.click('body'); await m.page.waitForTimeout(100); await m.page.click('body'); await m.page.waitForTimeout(100);
        const tune = await m.page.evaluate(() => ({ osc: window.__osc, xm: window.__xm.slice(), seen: localStorage.getItem('bd_tune_2026-11-08') }));
        assert.ok(tune.osc === 50 && tune.xm[0] === 'pause' && tune.seen === '1', 'the first tap plays Happy Birthday once (25 notes × 2), Christmas music paused: ' + JSON.stringify(tune));
        assert.deepEqual(m.errs, []);
        await m.ctx.close();

        // nobody: nothing
        const n = await open([], 'Z');
        const sn = await state(n.page);
        assert.ok(!sn.bd && sn.pieces === 0 && sn.toast === '' && sn.snowShown !== undefined, 'no birthdays: nothing changes');

        // Info ▸ DOB chip
        const chip = await n.page.evaluate(() => {
            const writes = []; window.userId = 'Z';
            window.db = { collection: () => ({ doc: () => ({ update: (p) => { writes.push(p); return Promise.resolve(); } }) }) };
            const b = document.getElementById('pi-bday-hide'), a = [b.textContent, b.getAttribute('aria-pressed')];
            paintBirthdayHidden(true); const h = [b.textContent, b.getAttribute('aria-pressed')]; paintBirthdayHidden(false);
            return { a, h, fn: typeof toggleBirthdayHidden };
        });
        assert.deepEqual(chip, { a: ['👀 Others see your 🎂', 'false'], h: ['🙈 Hidden from others', 'true'], fn: 'function' }, 'the 🙈 chip shows its state');
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
        assert.ok(/update\(\{ birthdayHidden: next \}\)/.test(html) && /paintBirthdayHidden\(d\.birthdayHidden === true\)/.test(html), 'the chip saves users.birthdayHidden at once and Info loads it');
        assert.ok(!/'birthdayHidden'/.test(html.slice(html.indexOf('const INFO_POINT_FIELDS'), html.indexOf('function infoPointsDelta'))), 'hiding is not paid for');
        await n.ctx.close();
        console.log('PASS: 🎂 birthdays (V101.295) — today + in 3 days by nickname, no year, hidden / inactive left out, 29 Feb, New Year; getBirthdays login-only, minimal fields; confetti instead of snow for everyone, one toast a day, T-3 toast only, the birthday person: gold confetti + 🎂 + greeting + Happy Birthday once at the first tap; Info 🙈 chip');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
