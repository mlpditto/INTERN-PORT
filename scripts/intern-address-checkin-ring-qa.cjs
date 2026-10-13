// V101.133 — two small intern-side pieces, on the REAL public/index.html (Chromium, network blocked, Firebase stubbed):
//  1. Personal Info → Contact has TWO addresses, EN first: "Hometown (as on ID card)" = users.addressIdCard and "Current address" = users.address
//     (the admin profile modal already edits both); load + save wire both.
//  2. A soft green ring on the Personal Info button (#u-info-btn) = checked in today; renderDailyCheckinCard toggles .checked-in from myCheckin.lastDate.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(idx.includes("document.getElementById('pi-address-idcard').value = d.addressIdCard || \"\";"), 'the profile loads users.addressIdCard');
assert.ok(/address: address,\n\s*addressIdCard: addressIdCard,/.test(idx), 'saving writes users.addressIdCard next to users.address');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
        await page.waitForTimeout(500);

        // ---- 1. addresses: EN first, Hometown then Current
        const a = await page.evaluate(() => {
            const lab = id => document.querySelector('label[for="' + id + '"]').textContent.trim();
            const h = document.getElementById('pi-address-idcard'), c = document.getElementById('pi-address');
            return { hLabel: lab('pi-address-idcard'), cLabel: lab('pi-address'), order: !!(h.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING), hPh: h.placeholder, cPh: c.placeholder, hTh: h.dataset.thPlaceholder, cTh: c.dataset.thPlaceholder };
        });
        assert.match(a.hLabel, /^🏠 Hometown \(as on ID card\) ที่อยู่ตามบัตรประชาชน( [가-힯() 신분증기준]+)?$/, 'label: English first, Thai after (Korean run optional)'); assert.match(a.cLabel, /^📍 Current address ที่อยู่ปัจจุบัน( [가-힯]+)?$/);
        assert.ok(a.order, 'Hometown sits above Current');
        assert.ok(/^[A-Za-z]/.test(a.hPh) && /^[A-Za-z]/.test(a.cPh) && /[ก-๙]/.test(a.hTh) && /[ก-๙]/.test(a.cTh), 'placeholders: EN by default, Thai in data-th-placeholder');

        // ---- 2. the check-in ring (the button has a colour transition → wait for the final colour, never read mid-way)
        const settle = async rgb => page.waitForFunction(c => getComputedStyle(document.getElementById('u-info-btn')).borderTopColor === c, rgb, { timeout: 3000 });
        const before = await page.evaluate(() => getComputedStyle(document.getElementById('u-info-btn')).borderTopColor);
        const width0 = await page.evaluate(() => document.getElementById('u-info-btn').getBoundingClientRect().width);
        assert.equal(before, 'rgb(251, 217, 181)', 'default: the orange border');
        await page.evaluate(() => { myCheckin = { currentStreak: 3, bestStreak: 3, lastDate: getBangkokDateTimeParts().dateKey }; renderDailyCheckinCard(); });
        assert.equal(await page.evaluate(() => document.getElementById('u-info-btn').classList.contains('checked-in')), true, 'checked in today → .checked-in');
        await settle('rgb(134, 239, 172)');
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('u-info-btn')).boxShadow), 'none', 'a soft ring round it too');
        await page.evaluate(() => { myCheckin = { currentStreak: 3, bestStreak: 3, lastDate: '2000-01-01' }; renderDailyCheckinCard(); });
        assert.equal(await page.evaluate(() => document.getElementById('u-info-btn').classList.contains('checked-in')), false, 'another day → no ring');
        await settle('rgb(251, 217, 181)');
        assert.equal(await page.evaluate(() => document.getElementById('u-info-btn').getBoundingClientRect().width), width0, 'the ring does not change the button size (border colour + shadow only)');
        assert.deepEqual(errors.filter(e => !/firebase\.|Cannot read properties of undefined/.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: intern Contact — Hometown (as on ID card) + Current address, EN first; green ring on the Info button when checked in today');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
