// V101.72: the intern flood popup, blend design — the REAL public/index.html + flood-watch.js/css on a touch phone (file://, network
// blocked, Firebase + Open-Meteo stubbed). ok = small green pill + two flat rows (💧 canal · 🛣️ road), NO scene; เฝ้าระวัง / เสี่ยงสูง = ONE
// scene that carries the status pill, the river number, the canal level and the road (pill size grows with severity 22 → 30 → 38 px);
// river chips, 7-day rain and a single footer line (📍 district · 2554 · 2569 · 📋 ▸ = the details summary) in every state; no data = nothing
// drawn. SHOT=1 also writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const src = fs.readFileSync('public/flood-watch.js', 'utf8');
for (const gone of ['function statusHtml(', 'function riverAlertHtml(', 'function tilesHtml(', 'function histHtml(', 'function stats(', 'function trendHtml', 'function rainHtml', 'function nearHtml', 'function riverHtml', 'function wxRow', 'function srcDots']) assert.ok(!src.includes(gone), gone + ' is gone');
assert.ok(src.includes("q > RV_LIMIT ? 'red'") && src.includes('var RV_LIMIT = 2200;'), 'card river tier and the popup alert share the 2,200 line');
assert.ok(src.includes('&daily=precipitation_sum,precipitation_probability_max&past_days=3&forecast_days=4'), 'Open-Meteo daily rain in the same request');
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(idx.includes('flood-watch.js?v=V101.76') && idx.includes('flood-watch.css?v=V101.76'), 'cache-bust bumped');
assert.ok(!idx.includes('fw-river-strip') && !src.includes('fw-river-strip'), 'V101.71: the card strip is gone');

async function open(browser, width, opts) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((opts) => {
        const now = Date.now();
        const DATA = { risk: opts.risk || 'low', canalRisk: opts.canalRisk || 'low', title: 'สถานีใกล้เคียงยังไม่มีสัญญาณน้ำเพิ่มผิดปกติ',
            canal: { name: 'ค.ทรงกระเทียม ปตร คลองทรงกระเทียม', km: 1.1, freeboardM: opts.fb != null ? opts.fb : 0.93, change24cm: opts.fb != null && opts.fb < 0 ? 48 : -46 }, road: {}, rain24mm: 5.8, traffy6h: 2,
            pop: { credit: 'ข้อมูล: สำนักการระบายน้ำ กรุงเทพมหานคร ผ่าน POPNIX Flood', canals: [{ name: 'ค.ทรงกระเทียม ปตร', km: 1.1, wl: -0.03, level: 'ok', trend: 'up', deltaCm: 5 }, { name: 'ค.ทรงกระเทียม ถ.นาคนิวาส', km: 2, wl: -0.67, level: 'ok', trend: '' }], roads: [{ name: 'ถ.นาคนิวาส (ซ. 38)', km: 1.3, level: 'dry', depthCm: 0 }, { name: 'ถ.สุคนธสวัสดิ์ (ซ. 15)', km: 2.1, level: 'dry', depthCm: 0 }] },
            river: { stations: [{ code: 'C.2', place: 'นครสวรรค์', cap: 3735, pct: 54, q: 2009, at: now, d24: 10, src: 'thaiwater' }, { code: 'C.13', place: 'ชัยนาท', cap: 2720, pct: Math.round(opts.c13 / 2720 * 100), q: opts.c13, at: now, d24: -80, src: 'thaiwater' }, { code: 'C.29B', place: 'อยุธยา', cap: 3600, pct: 58, q: 2078, at: now, d24: 0, src: 'rid' }] },
            district: opts.district, history: opts.district ? { y2554: 'moderate', y2569: 'high' } : null, checkedAt: now };
        if (opts.nodata) { DATA.canal = null; DATA.road = undefined; DATA.risk = 'info'; DATA.river = { stations: [] }; DATA.pop = null; DATA.traffy6h = 0; }
        if (opts.closedRoad) DATA.road = { risk: 'high', n: 1, nearest: { name: 'ถ.นาคนิวาส', m: 220, depthCm: 35, closed: true, motorbike: 'blocked', sedan: 'risky', sensor: true } };
        if (opts.wetRoad) DATA.road = { risk: 'moderate', n: 1, nearest: { name: 'ถ.นาคนิวาส', m: 320, depthCm: 15, motorbike: 'risky', sedan: 'ok', sensor: true } };
        window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: DATA }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
        // Open-Meteo: today in Bangkok = the 4th daily entry
        const day = n => { const d = new Date(now + n * 86400000); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); };
        const realFetch = window.fetch;
        window.fetch = (u) => {
            if (String(u).includes('air-quality-api')) return Promise.resolve({ ok: true, json: () => ({ current: { pm2_5: 21.3, us_aqi: 76 } }) });
            if (String(u).includes('api.open-meteo.com')) return Promise.resolve({ ok: true, json: () => ({ current: { temperature_2m: 26.4, apparent_temperature: 32, weather_code: 3, is_day: 1, precipitation: 0 }, hourly: { time: [], precipitation_probability: [] },
                daily: { time: [day(-3), day(-2), day(-1), day(0), day(1), day(2), day(3)], precipitation_sum: [12, 31, 4, 5.8, 9, 18, 2], precipitation_probability_max: [90, 100, 40, 30, 60, 80, 30] } }) });
            return realFetch(u);
        };
    }, opts);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        for (const step of [() => renderDailyCheckinCard(), () => fwInit(), () => fwOnUserDoc({ home: { lat: 13.83, lon: 100.66 }, optIn: true }), () => fwOpen(), () => fwTab('home')]) {
            try { step(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
        }
    });
    await page.waitForTimeout(1000);
    return { page, ctx, errors };
}
const text = (page, sel) => page.locator(sel).evaluateAll(ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));

(async () => {
    const browser = await chromium.launch();
    try {
        // ---- 1. normal day (ok), home in บึงกุ่ม ----
        let { page, ctx, errors } = await open(browser, 412, { c13: 2150, district: 'บึงกุ่ม' });
        assert.deepEqual(await text(page, '.fw-sheet .fw-pill'), ['🌊ปกติ']);
        assert.equal(await page.locator('.fw-sheet .fw-pill.ok').count(), 1);
        for (const gone of ['.fw-scene', '.fw-key', '.fw-badge', '.fw-sub', '.fw-tile', '.fw-rv-alert', '.fw-hist']) assert.equal(await page.locator('.fw-sheet ' + gone).count(), 0, gone + ': no scene / sentence / old rows when ok');
        assert.deepEqual(await text(page, '.fw-sheet .fw-r2 .fw-v2'), ['93cm', 'ไม่ท่วม']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-r2 .fw-n2'), ['▼46'], 'arrow + number only: the wording moved to hover');
        // descriptions: hover (title) on desktop, tap (data-tip bubble) on touch — same text
        const tips = await page.locator('.fw-sheet .fw-r2').evaluateAll(ns => ns.map(n => [n.dataset.tip, n.title]));
        assert.ok(tips[0][0].includes('ต่ำกว่าตลิ่ง 93 ซม.') && tips[0][0].includes('ลดลง 46 ซม. ใน 24 ชม.') && tips[0][1].startsWith(tips[0][0]), 'canal wording in hover + tap text: ' + tips[0][0]);
        assert.equal(tips[1][0], 'ไม่มีถนนท่วมในรัศมี 500 ม.'); assert.ok(tips[1][1].startsWith(tips[1][0]));
        assert.ok(!(await text(page, '.fw-sheet .fw-rows2'))[0].includes('ชม') && !(await text(page, '.fw-sheet .fw-rows2'))[0].includes('ม.'), 'no explanatory wording left in the rows');
        assert.equal(await page.locator('.fw-sheet .fw-tip').count(), 0);
        await page.locator('.fw-sheet .fw-r2').first().click();
        assert.deepEqual(await text(page, '.fw-sheet .fw-tip'), [tips[0][0]], 'a tap shows the description bubble');
        assert.ok(await page.evaluate(() => { const b = document.querySelector('.fw-sheet .fw-tip').getBoundingClientRect(), s = document.querySelector('.fw-sheet').getBoundingClientRect(); return b.left >= s.left && b.right <= s.right && b.bottom <= s.bottom + 1; }), 'bubble stays inside the sheet');
        await page.locator('.fw-sheet .fw-pill').click();
        assert.equal(await page.locator('.fw-sheet .fw-tip').count(), 0, 'a tap elsewhere hides it');
        assert.ok((await page.locator('.fw-sheet .fw-river-row .fw-rs').first().getAttribute('data-tip')).includes('C.2 นครสวรรค์'), 'chips explain themselves too');
        assert.deepEqual(await page.locator('.fw-sheet .fw-r2 .fw-e').evaluateAll(ns => ns.map(n => n.className.replace('fw-e', '').trim() + ':' + n.getBoundingClientRect().width)), ['ok:26', 'ok:26'], 'ok = small emoji');
        const pe0 = await page.locator('.fw-sheet .fw-pill .fw-pe').evaluate(n => n.offsetWidth);
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-rs').count(), 3, 'C.2 · C.13 · C.29B chips');
        assert.ok((await text(page, '.fw-sheet .fw-river-row'))[0].includes('2.0k'), 'values in k m³/s');
        assert.deepEqual(await text(page, '.fw-sheet .fw-river-row .fw-rl'), ['C.2', 'C.13', 'C.29B'], 'each chip names its station');
        assert.equal(await page.locator('.fw-sheet .fw-river-row').getAttribute('data-src'), 'rid');
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-ar.down').count(), 1, 'C.13 −80 → ▼'); assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-ar.up').count(), 0, '+10 is under the 30 m³/s arrow threshold');
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-rw').count(), 0, 'no ⚠️ under the line'); assert.equal(await page.locator('.fw-sheet .fw-river-row > .fw-e.ok').count(), 1);
        assert.deepEqual(await text(page, '.fw-sheet .fw-rain7 .fw-k'), ['mm'], 'rain header = icon + unit only');
        assert.equal(await page.locator('.fw-sheet .fw-day').count(), 7, '7 rain days');
        assert.deepEqual(await page.locator('.fw-sheet .fw-day').evaluateAll(ns => ns.map(n => n.className.replace('fw-day', '').trim())), ['', '', '', 'today', 'fc', 'fc', 'fc']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-day b'), ['12', '31', '4', '5.8', '9', '18', '2']);
        assert.deepEqual((await text(page, '.fw-sheet .fw-day span')).slice(3, 4), ['วันนี้']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-day small'), ['', '', '', '', '60%', '80%', '30%'], 'only the forecast days carry a number (the chance); no dates');
        // footer: ONE line = the details summary
        assert.equal(await page.locator('.fw-sheet .fw-more > summary.fw-foot').count(), 1, 'the district line is the details summary');
        assert.deepEqual(await text(page, '.fw-sheet .fw-foot .fw-dn'), ['บึงกุ่ม']); assert.deepEqual(await text(page, '.fw-sheet .fw-foot .fw-yr b'), ['2554', '2569']);
        assert.deepEqual(await page.locator('.fw-sheet .fw-foot .fw-yr .fw-e').evaluateAll(ns => ns.map(n => n.getAttribute('aria-label') + ':' + n.className.replace('fw-e bare', '').trim())), ['ปานกลาง:warn', 'สูง:crit']);
        assert.ok((await page.locator('.fw-sheet .fw-foot .fw-yr').nth(1).getAttribute('title')).includes('29 ก.ย. 2569'), 'source in the title');
        assert.equal(await page.locator('.fw-sheet .fw-foot .fw-tg').count(), 1, '📋 ▸ on the same line');
        assert.ok(await page.locator('.fw-sheet .fw-foot').evaluate(n => n.getBoundingClientRect().height < 48), 'footer is one line');
        assert.equal(await page.locator('.fw-sheet .fw-more[open]').count(), 0, 'details folded by default');
        for (const old of ['.fw-stats', '.fw-tr', '.fw-rain', '.fw-near', '.fw-river', '.fw-wx']) assert.equal(await page.locator('.fw-sheet ' + old).count(), 0, old + ' gone');
        const h0 = await page.locator('.fw-sheet').evaluate(e => e.getBoundingClientRect().height);
        assert.ok(h0 < 440, 'folded ok popup is ' + Math.round(h0) + ' px');
        // details: one line per station, roads one line, Traffy, weather, sources once
        await page.locator('.fw-sheet .fw-more summary').click();
        const lines = await text(page, '.fw-sheet .fw-dl');
        assert.equal(lines.length, 5, 'canal ×2 · roads · Traffy · weather: ' + JSON.stringify(lines));
        assert.ok(lines[0].includes('ค.ทรงกระเทียม ปตร') && lines[0].includes('-0.03 m') && lines[0].includes('▲ +5 cm/ชม.'));
        assert.ok(lines[2].startsWith('ถ.นาคนิวาส (ซ. 38) · ถ.สุคนธสวัสดิ์ (ซ. 15)') && lines[2].includes('แห้ง'), lines[2]);
        assert.ok(lines[3].includes('Traffy') && lines[3].includes('2'));
        assert.ok(lines[4].includes('26°') && lines[4].includes('76'), lines[4]);
        const meta = (await text(page, '.fw-sheet .fw-meta'))[0];
        assert.ok(!/POPNIX|Open-Meteo|Rocket|Nominatim/.test(meta) && /^\d\d:\d\d · ค\.ทรงกระเทียม/.test(meta), 'meta is time · gauge only: ' + meta);
        // source colours: every row carries a bar with its source(s); the legend lists each used source once
        const bars = await page.locator('.fw-sheet .fw-sb').evaluateAll(ns => ns.map(n => n.dataset.src));
        assert.deepEqual(bars, ['fw', 'fb', 'rid', 'om', 'hist+osm', 'pop', 'pop', 'pop+fb', 'fw', 'om'], 'row → source: ' + JSON.stringify(bars));
        assert.ok(await page.locator('.fw-sheet .fw-sb').evaluateAll(ns => ns.every(n => getComputedStyle(n, '::before').width === '3px')), '3 px bars drawn');
        const legend = await text(page, '.fw-sheet .fw-lg span');
        assert.deepEqual(legend, ['BKK FloodWatch', 'ข้อมูล: สำนักการระบายน้ำ กรุงเทพมหานคร ผ่าน POPNIX Flood', 'Floodboard (CC BY 4.0)', 'ThaiWater · กรมชลประทาน', 'Open-Meteo (CC BY 4.0)', '2569 ประกาศ กทม. 29 ก.ย. · 2554 รายงานข่าว (Rocket Media Lab)', 'เขตจาก OpenStreetMap (Nominatim)'], 'legend = attributions once');
        assert.equal(await page.locator('.fw-sheet .fw-sb[data-src="pop+fb"]').evaluate(n => getComputedStyle(n, '::before').backgroundImage.includes('linear-gradient')), true, 'two agreeing sources → two-colour bar');
        if (process.env.SHOT) await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-ok-open.png') });
        await page.locator('.fw-sheet .fw-more summary').click();
        if (process.env.SHOT) await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-ok.png') });
        await ctx.close();

        // ---- 2. river over 2,500 on a "low" day, wet road, no district (outside Bangkok) → เฝ้าระวัง scene ----
        ({ page, ctx, errors } = await open(browser, 412, { c13: 2610, district: null, wetRoad: true }));
        assert.equal(await page.locator('.fw-sheet .fw-scene').count(), 1, 'not ok → the scene');
        assert.deepEqual(await text(page, '.fw-sheet .fw-pill'), ['⚠️เฝ้าระวัง'], 'risk low + river alert → เฝ้าระวัง');
        assert.equal(await page.locator('.fw-sheet .fw-pill').count(), 1, 'the pill lives in the scene, not above it');
        assert.equal(await page.locator('.fw-sheet .fw-scene .fw-pill.warn').count(), 1);
        const key = (await text(page, '.fw-sheet .fw-scene .fw-key'))[0];
        assert.ok(key.includes('C.13 ชัยนาท') && key.includes('2,610') && key.includes('m³/s'), 'river number in the scene: ' + key);
        assert.equal(await page.locator('.fw-sheet .fw-scene .fw-key .fw-e.crit').count(), 1, '2,610 > 2,500 → crit emoji');
        assert.ok(!(await text(page, '.fw-sheet'))[0].includes('น้ำเหนือกำลังลงมา'), 'the fixed "water coming down" claim is gone');
        assert.ok(!key.includes('เกินเกณฑ์'), 'the threshold wording is not printed in the scene');
        assert.ok((await page.locator('.fw-sheet .fw-scene .fw-key').getAttribute('data-tip')).includes('สูงกว่าเกณฑ์ 2,200 m³/s'), 'threshold in the river card hover text');
        assert.ok((await page.locator('.fw-sheet .fw-sc-lvl').getAttribute('data-tip')).includes('ต่ำกว่าตลิ่ง 93 ซม.'));
        const rt = await page.locator('.fw-sheet .fw-sc-road').getAttribute('data-tip'); assert.ok(rt.includes('ถ.นาคนิวาส') && rt.includes('ห่าง 320 ม.'), rt);
        assert.ok((await page.locator('.fw-sheet .fw-scene').getAttribute('title')).includes('เฝ้าระวัง'), 'scene has a hover text');
        const lbl = await page.locator('.fw-sheet .fw-scene').getAttribute('aria-label');
        assert.ok(lbl.includes('เฝ้าระวัง') && lbl.includes('ต่ำกว่าตลิ่ง 93 ซม.') && lbl.includes('ถนนท่วม 15 ซม.'), lbl);
        assert.ok((await text(page, '.fw-sheet .fw-sc-lvl'))[0].includes('93cm'), 'canal level in the water');
        assert.deepEqual(await text(page, '.fw-sheet .fw-sc-road'), ['🛣️15cm']); assert.equal(await page.locator('.fw-sheet .fw-sc-road .fw-e.warn').count(), 1);
        for (const gone of ['.fw-r2', '.fw-key.fw-sb', '.fw-sc-spill']) assert.equal(await page.locator('.fw-sheet ' + gone).count(), 0, gone + ': rows are folded into the scene');
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-rs.over').count(), 1); assert.ok((await text(page, '.fw-sheet .fw-river-row .fw-rs.over'))[0].includes('C.13'), 'the chip over the line is C.13');
        // V101.76: the card above already says C.13 = 2,610 m³/s, so the strip shows that gauge as a share of capacity (2,610 / 2,720 = 96%) and keeps the flow numbers of the others.
        const dup = (await text(page, '.fw-sheet .fw-river-row .fw-rs.over'))[0];
        assert.ok(dup.includes('96%') && dup.includes('容量比') && !dup.includes('2.6k'), 'C.13 chip = % + 容量比 (capacity ratio), not the repeated flow: ' + dup);
        assert.ok(await page.locator('.fw-sheet .fw-river-row .fw-rp').evaluate(n => n.getBoundingClientRect().width < 40), 'the suffix stays short (a 3-character 容量比, ~29 px)');
        assert.ok((await page.locator('.fw-sheet .fw-river-row .fw-rs.over').getAttribute('data-tip')).includes('96% ของความจุ 2,720') && (await page.locator('.fw-sheet .fw-river-row .fw-rs.over').getAttribute('data-tip')).includes('2,610 m³/s'), 'the hover text keeps both the flow and the capacity');
        const others = await text(page, '.fw-sheet .fw-river-row .fw-rs:not(.over)');
        assert.ok(others.length === 2 && others[0].includes('2.0k') && others[1].includes('2.1k') && !others.join('').includes('%'), 'the other gauges keep their flow numbers: ' + others);
        assert.ok((await page.locator('.fw-sheet .fw-river-row').getAttribute('title')).includes('C.13 96% ของความจุ'), 'row label says the same');
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-rs.over .fw-rw').count(), 1, '⚠️ replaces the dot on the chip over the line');
        assert.equal(await page.locator('.fw-sheet .fw-river-row > .fw-e.crit').count(), 1);
        assert.equal(await page.locator('.fw-sheet .fw-foot .fw-yr').count(), 0, 'no district → no years'); assert.equal(await page.locator('.fw-sheet .fw-foot .fw-tg').count(), 1, 'the toggle stays');
        const pe1 = await page.locator('.fw-sheet .fw-pill .fw-pe').evaluate(n => n.offsetWidth);
        if (process.env.SHOT) await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-warn.png') });
        await ctx.close();

        // ---- 3. เสี่ยงสูง: over the bank, closed road → big pulsing pill, 💦 ----
        ({ page, ctx, errors } = await open(browser, 412, { c13: 2650, district: 'คันนายาว', risk: 'high', canalRisk: 'high', fb: -0.06, closedRoad: true }));
        assert.deepEqual(await text(page, '.fw-sheet .fw-scene .fw-pill'), ['⛔เสี่ยงสูง']); assert.equal(await page.locator('.fw-sheet .fw-scene .fw-pill.crit').count(), 1);
        const pe2 = await page.locator('.fw-sheet .fw-pill .fw-pe').evaluate(n => n.offsetWidth);
        assert.deepEqual([pe0, pe1, pe2], [22, 30, 38], 'pill emoji grows with severity: ok 22 · warn 30 · crit 38');
        assert.ok((await text(page, '.fw-sheet .fw-sc-lvl'))[0].includes('+6cm'), 'over the bank: +6');
        assert.equal(await page.locator('.fw-sheet .fw-sc-spill').count(), 1, '💦 when over the bank');
        assert.deepEqual(await text(page, '.fw-sheet .fw-sc-road'), ['🛣️ปิด']); assert.equal(await page.locator('.fw-sheet .fw-sc-road .fw-e.crit').count(), 1);
        assert.ok(await page.locator('.fw-sheet .fw-pill .fw-pe').evaluate(n => getComputedStyle(n).animationName !== 'none'), 'crit pulses');
        if (process.env.SHOT) await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-crit.png') });
        await ctx.close();

        // ---- 4. no data at all → nothing drawn for water; rain + footer remain, no "ไม่มีข้อมูล" / "—" ----
        ({ page, ctx, errors } = await open(browser, 412, { c13: 0, district: 'ห้วยขวาง', nodata: true }));
        for (const gone of ['.fw-pill', '.fw-scene', '.fw-key', '.fw-r2', '.fw-river-row']) assert.equal(await page.locator('.fw-sheet ' + gone).count(), 0, gone + ' hidden');
        assert.equal(await page.locator('.fw-sheet .fw-rain7').count(), 1, 'rain still shows'); assert.equal(await page.locator('.fw-sheet .fw-foot').count(), 1);
        const t4 = (await text(page, '.fw-sheet'))[0];
        assert.ok(!/ไม่มีข้อมูล|—/.test(t4), 'no placeholder text: ' + t4);
        await ctx.close();

        // ---- 5. 320 px: nothing overflows and the scene top row never overlaps ----
        ({ page, ctx, errors } = await open(browser, 320, { c13: 2650, district: 'คันนายาว', risk: 'high', canalRisk: 'high', fb: -0.06, closedRoad: true }));
        const m = await page.evaluate(() => { const s = document.querySelector('.fw-sheet'); const r = s.getBoundingClientRect(); const a = document.querySelector('.fw-sc-top .fw-pill').getBoundingClientRect(), k = document.querySelector('.fw-sc-top .fw-key').getBoundingClientRect();
            return { sw: s.scrollWidth, cw: s.clientWidth, right: r.right, vw: document.documentElement.clientWidth, gap: Math.round(k.left - a.right), wrap: Math.round(a.height) }; });
        assert.ok(m.sw <= m.cw + 1 && m.right <= m.vw + 1, 'no sideways overflow at 320 px: ' + JSON.stringify(m));
        assert.ok(m.gap >= 4 && m.wrap < 60, 'pill and river card side by side, pill on one line: ' + JSON.stringify(m));
        await ctx.close();

        assert.deepEqual(errors.filter(e => !/firebase./.test(e)), [], 'no page errors beyond the un-stubbed Firebase boot');
        console.log('PASS: flood popup blend — ok = small green pill + flat rows, no scene; เฝ้าระวัง / เสี่ยงสูง = one scene with pill (22 → 30 → 38 px), river number, canal level, road; ⚠️ chip over the line; footer = district + 2554/2569 + details toggle on ONE line; no data = nothing drawn; 320 px safe');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
