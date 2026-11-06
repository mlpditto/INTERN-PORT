// V101.274 FIN Month (owner pick 1+2+3, mockup-fin-month-donut-caps-calendar.html): a donut + ONE category list (% · ฿; a 🎯 cap rides its row as
// เหลือ / เกิน), a category calendar (icon per day it was bought, opens on the category bought on the most days) with "vs the same dates last
// month", and 🎯 Caps chips in Plan (฿ / month per category, stamped per category so sync can carry a set AND a clear). The REAL index.html.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

const exp = []; let n = 1;
const add = (date, cat, amount) => exp.push({ id: 'e' + n++, date, cat, amount, note: '', ts: Date.parse(date + 'T12:00:00+07:00') });
for (let d = 1; d <= 30; d++) { const k = '2026-09-' + String(d).padStart(2, '0'); add(k, '🍜 Food', 100); if (d % 3 === 0) add(k, '☕ Coffee', 60); }
for (let d = 1; d <= 31; d++) { const k = '2026-10-' + String(d).padStart(2, '0'); add(k, '🍜 Food', 150); if (d % 2 === 0) add(k, '☕ Coffee', 60); if (d === 10) add(k, '☕ Coffee', 60); }
add('2026-10-05', '🛒 Groceries', 400); add('2026-10-12', '🎉 Fun', 700);
const SEED = { plans: { '2026-10': { daily: 300, days: {} } }, expenses: exp, tomb: {} };   // a pre-V101.274 record: no caps fields

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(seed => {
            localStorage.setItem('fin_v1_U1', JSON.stringify(seed));
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            const q = () => ({ where: q, orderBy: q, limit: q, get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: q }) });
            const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
            window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
        }, SEED);
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.waitForTimeout(600);
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            userId = 'U1'; finOpen(); finState.month = '2026-10'; finTab('month');
        });
        const m = await page.evaluate(() => {
            const q = s => document.querySelector('#finModal ' + s), qa = s => [...document.querySelectorAll('#finModal ' + s)];
            return {
                slices: qa('.fin-donut circle').length, centre: q('.fin-donut .c').textContent.trim(),
                rows: qa('.fin-crow').map(r => r.querySelector('span').textContent + '|' + r.querySelector('small').textContent + '|' + r.querySelector('b').textContent),
                caps: qa('.fin-cap-bar').length, oldBars: qa('.fin-catbar').length,
                calOn: q('.fin-cal-chips button.on').textContent, stamps: qa('.fin-cal s.on').length, sup: qa('.fin-cal sup').map(x => x.textContent),
                head: q('.fin-cal-h').textContent.replace(/\s+/g, ' ').trim(), big: q('.fin-big').textContent,
            };
        });
        assert.equal(m.slices, 4, 'one donut slice per category spent on');
        assert.equal(m.centre, '🍜Food · most', 'the centre = the biggest category, no total (the headline has it): ' + m.centre);
        assert.ok(!m.centre.includes('฿'), 'no number repeated in the centre');
        assert.deepEqual(m.rows.map(r => r.split('|')[0]), ['🍜 Food', '☕ Coffee', '🎉 Fun', '🛒 Groceries'], 'one list, biggest first');
        assert.equal(m.rows[0].split('|')[1], '69%', 'Food 4,650 of 6,710');
        assert.equal(m.caps, 0, 'no caps yet → no เหลือ / เกิน bars (hide the empty)'); assert.equal(m.oldBars, 0, 'the old bars are gone');
        assert.equal(m.calOn, '🍜 Food', 'the calendar opens on the category bought on the most days');
        assert.ok(await page.$$eval('#finModal .fin-cal-chips button', b => b.every(x => x.getBoundingClientRect().width < 160)), 'chips keep their own width (not the global 100% button rule)');
        assert.equal(m.stamps, 31, 'Food every day'); assert.deepEqual(m.sup, [], 'once a day = no count');
        // Coffee: 15 even days + a 2nd cup on the 10th = 16 × 60 = 960; Sep (same dates 1–30… a past month = all its days) 10 × 60 = 600 → +60%
        await page.click('#finModal .fin-cal-chips button:nth-child(2)');
        const c = await page.evaluate(() => ({ on: document.querySelector('#finModal .fin-cal-chips button.on').textContent, stamps: document.querySelectorAll('#finModal .fin-cal s.on').length, sup: [...document.querySelectorAll('#finModal .fin-cal sup')].map(x => x.textContent), head: document.querySelector('#finModal .fin-cal-h').textContent.replace(/\s+/g, ' ').trim() }));
        assert.equal(c.on, '☕ Coffee'); assert.equal(c.stamps, 15, 'a stamp on each day it was bought'); assert.deepEqual(c.sup, ['2'], 'two cups on one day = ²');
        assert.ok(c.head.includes('฿ 960') && c.head.includes('+60% vs Sep'), 'this month vs the same dates last month: ' + c.head);
        // 🎯 caps in Plan
        await page.evaluate(() => finTab('plan'));
        assert.equal(await page.$$eval('#finModal .fin-cap', b => b.length), 10, 'one chip per category');
        await page.evaluate(() => finCapEdit('☕ Coffee'));
        await page.fill('#fin-cap-amt', '800'); await page.press('#fin-cap-amt', 'Enter');
        await page.evaluate(() => finCapEdit('🍜 Food'));
        await page.fill('#fin-cap-amt', '6000'); await page.click('#finModal .fin-caps-card .fin-btn.sm');
        const saved = await page.evaluate(() => { const d = finLoad(); return { caps: d.caps, stamped: Object.keys(d.capUpd).sort() }; });
        assert.deepEqual(saved.caps, { '☕ Coffee': 800, '🍜 Food': 6000 }); assert.deepEqual(saved.stamped, ['☕ Coffee', '🍜 Food'], 'each cap carries its own stamp');
        assert.equal(await page.$eval('#finModal .fin-cap.set', b => b.textContent.replace(/\s+/g, ' ').trim()), '🍜 6,000', 'a set cap shows on its chip');
        await page.evaluate(() => finTab('month'));
        const bars = await page.$$eval('#finModal .fin-crow', rs => rs.filter(r => r.querySelector('.fin-cap-bar')).map(r => r.querySelector('span').textContent + ' ' + r.querySelector('em').textContent + ' ' + r.querySelector('.fin-cap-bar i').className));
        assert.deepEqual(bars, ['🍜 Food เหลือ ฿ 1,350 cool', '☕ Coffee เกิน ฿ 160 hot'], 'the cap bar rides its own row: เหลือ (green, 78%) / เกิน (red): ' + bars);
        // sync: a newer clear on the other device wins and travels; an older value does not come back
        const sync = await page.evaluate(() => {
            const a = finLoad(), t = Date.now();
            const b = { plans: {}, expenses: [], tomb: {}, caps: { '☕ Coffee': 999 }, capUpd: { '☕ Coffee': t - 60000, '🍜 Food': t + 60000 } };   // Coffee older there, Food cleared later there
            const m = finMerge(a, b), sigBefore = finSig(finCanon(a));
            return { caps: m.caps, foodStamp: m.capUpd['🍜 Food'] === t + 60000, sigChanges: finSig(m) !== sigBefore, remoteKeeps: Object.keys(finFromRemote({ caps: { x: 1 }, capUpd: { x: 2 } }).caps) };
        });
        assert.deepEqual(sync.caps, { '☕ Coffee': 800 }, 'newer local Coffee kept; Food cleared on the other device later → gone');
        assert.equal(sync.foodStamp, true, 'the clear keeps its stamp so it reaches every device');
        assert.equal(sync.sigChanges, true, 'a cap change changes the sync signature (so it gets pushed)');
        assert.deepEqual(sync.remoteKeeps, ['x'], 'caps are read from the Firestore doc');
        assert.deepEqual(errors.filter(e => /fin/i.test(e)), [], 'no FIN errors');
        if (process.env.OUTDIR) {
            await page.evaluate(() => { document.querySelectorAll('#finModal *').forEach(el => { const cs = getComputedStyle(el); if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') { el.style.maxHeight = 'none'; el.style.overflow = 'visible'; } }); });
            await page.setViewportSize({ width: 390, height: 1700 }); await page.waitForTimeout(200);
            await (await page.$('#finModal .modal-content, #finModal > div')).screenshot({ path: process.env.OUTDIR + '/fin-built.png' });
        }
        await ctx.close();
        console.log('PASS: FIN Month — donut (centre = biggest category, no repeated total) + one list with 🎯 เหลือ / เกิน in the row, category calendar (most-days default, ² for twice, +% vs the same dates last month), Plan 🎯 Caps chips; caps sync per category incl. clears');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
