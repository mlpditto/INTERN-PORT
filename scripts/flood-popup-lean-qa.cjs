// V101.65: the intern flood popup, lean — the REAL public/index.html + flood-watch.js/css on a touch phone (file://, network
// blocked, Firebase + Open-Meteo stubbed). Home tab: status badge + one sentence · คลอง / ถนน tiles · ฝน 7 วัน (3 back, today,
// 3 ahead) · เขต 2554 / 2569 line · details folded (stations, roads, Traffy, river one line, weather, sources once). A Chao
// Phraya station over 2,500 m³/s surfaces a red line and turns the badge to เฝ้าระวัง. SHOT=1 also writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const src = fs.readFileSync('public/flood-watch.js', 'utf8');
for (const gone of ['function stats(', 'function trendHtml', 'function rainHtml', 'function nearHtml', 'function riverHtml', 'function wxRow', 'function srcDots']) assert.ok(!src.includes(gone), gone + ' is gone');
assert.ok(src.includes("q > RV_LIMIT ? 'red'") && src.includes('var RV_LIMIT = 2200;'), 'card river tier and the popup alert share the 2,200 line');
assert.ok(src.includes('&daily=precipitation_sum,precipitation_probability_max&past_days=3&forecast_days=4'), 'Open-Meteo daily rain in the same request');
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(idx.includes('flood-watch.js?v=V101.71') && idx.includes('flood-watch.css?v=V101.71'), 'cache-bust bumped');
assert.ok(!idx.includes('fw-river-strip') && !src.includes('fw-river-strip'), 'V101.71: the card strip is gone');

async function open(browser, width, opts) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((opts) => {
        const now = Date.now();
        const DATA = { risk: 'low', canalRisk: 'low', title: 'สถานีใกล้เคียงยังไม่มีสัญญาณน้ำเพิ่มผิดปกติ',
            canal: { name: 'ค.ทรงกระเทียม ปตร คลองทรงกระเทียม', km: 1.1, freeboardM: 0.93, change24cm: -46 }, road: {}, rain24mm: 5.8, traffy6h: 2,
            pop: { credit: 'ข้อมูล: สำนักการระบายน้ำ กรุงเทพมหานคร ผ่าน POPNIX Flood', canals: [{ name: 'ค.ทรงกระเทียม ปตร', km: 1.1, wl: -0.03, level: 'ok', trend: 'up', deltaCm: 5 }, { name: 'ค.ทรงกระเทียม ถ.นาคนิวาส', km: 2, wl: -0.67, level: 'ok', trend: '' }], roads: [{ name: 'ถ.นาคนิวาส (ซ. 38)', km: 1.3, level: 'dry', depthCm: 0 }, { name: 'ถ.สุคนธสวัสดิ์ (ซ. 15)', km: 2.1, level: 'dry', depthCm: 0 }] },
            river: { stations: [{ code: 'C.2', place: 'นครสวรรค์', q: 2009, at: now, d24: 10, src: 'thaiwater' }, { code: 'C.13', place: 'ชัยนาท', q: opts.c13, at: now, d24: -80, src: 'thaiwater' }, { code: 'C.29B', place: 'อยุธยา', q: 2078, at: now, d24: 0, src: 'rid' }] },
            district: opts.district, history: opts.district ? { y2554: 'moderate', y2569: 'high' } : null, checkedAt: now };
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
        // ---- normal day, home in บึงกุ่ม ----
        let { page, ctx, errors } = await open(browser, 412, { c13: 2150, district: 'บึงกุ่ม' });
        assert.deepEqual(await text(page, '.fw-sheet .fw-badge'), ['ปกติ']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-sub'), ['น้ำในคลองต่ำกว่าตลิ่ง 93 ซม. · ไม่มีถนนท่วมในรัศมี 500 ม.']);
        assert.equal(await page.locator('.fw-sheet .fw-rv-alert').count(), 0, 'no river alert at 2,150');
        assert.deepEqual(await text(page, '.fw-sheet .fw-tile .fw-v'), ['93cm', 'ไม่ท่วม']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-tile .fw-n'), ['ต่ำกว่าตลิ่ง · ลดลง 46 cm ใน 24 ชม.', 'ในรัศมี 500 ม.']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-rain7 .fw-k'), ['mm'], 'V101.67: rain header = icon + unit only');
        assert.ok(await page.locator('.fw-sheet .fw-tile').evaluateAll(ns => ns.every(n => { const r = n.getBoundingClientRect(); return r.height < 30; })), 'V101.67: คลอง / ถนน are one-line rows');
        assert.equal(await page.locator('.fw-sheet .fw-day').count(), 7, '7 rain days');
        assert.deepEqual(await page.locator('.fw-sheet .fw-day').evaluateAll(ns => ns.map(n => n.className.replace('fw-day', '').trim())), ['', '', '', 'today', 'fc', 'fc', 'fc']);
        assert.deepEqual(await text(page, '.fw-sheet .fw-day b'), ['12', '31', '4', '5.8', '9', '18', '2']);
        assert.deepEqual((await text(page, '.fw-sheet .fw-day span')).slice(3, 4), ['วันนี้']);
        assert.deepEqual((await text(page, '.fw-sheet .fw-day small')).slice(4), ['60%', '80%', '30%'], 'forecast days carry the chance');
        assert.deepEqual(await text(page, '.fw-sheet .fw-hist'), ['เขตบึงกุ่ม2554ปานกลาง2569สูง']);
        assert.ok((await page.locator('.fw-sheet .fw-hist .fw-yr').nth(1).getAttribute('title')).includes('29 ก.ย. 2569'), 'source in the title');
        assert.equal(await page.locator('.fw-sheet .fw-more[open]').count(), 0, 'details folded by default');
        for (const old of ['.fw-stats', '.fw-tr', '.fw-rain', '.fw-near', '.fw-river', '.fw-wx']) assert.equal(await page.locator('.fw-sheet ' + old).count(), 0, old + ' gone');
        const h0 = await page.locator('.fw-sheet').evaluate(e => e.getBoundingClientRect().height);
        assert.ok(h0 < 460, 'folded popup is ' + Math.round(h0) + ' px (was ~377 without the rain card)');
        // details: one line per station, roads one line, Traffy, river one word, weather, sources once (incl. the history sources)
        await page.locator('.fw-sheet .fw-more summary').click();
        const lines = await text(page, '.fw-sheet .fw-dl');
        assert.equal(lines.length, 5, 'canal ×2 · roads · Traffy · weather (river moved to the front): ' + JSON.stringify(lines));
        assert.ok(lines[0].includes('ค.ทรงกระเทียม ปตร') && lines[0].includes('-0.03 m') && lines[0].includes('▲ +5 cm/ชม.'));
        assert.ok(lines[2].startsWith('ถ.นาคนิวาส (ซ. 38) · ถ.สุคนธสวัสดิ์ (ซ. 15)') && lines[2].includes('แห้ง'), lines[2]);
        assert.ok(lines[3].includes('Traffy') && lines[3].includes('2'));
        assert.ok(lines[4].includes('26°') && lines[4].includes('76'), lines[4]);
        // V101.71: the river strip sits on the front under คลอง/ถนน — three chips, dot per tier, ▲▼ vs 24 h, ThaiWater bar
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-rs').count(), 3, 'C.2 · C.13 · C.29B chips');
        assert.ok((await text(page, '.fw-sheet .fw-river-row'))[0].includes('2.0k'), 'values in k m³/s');
        assert.equal(await page.locator('.fw-sheet .fw-river-row').getAttribute('data-src'), 'rid');
        assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-ar.down').count(), 1, 'C.13 −80 → ▼'); assert.equal(await page.locator('.fw-sheet .fw-river-row .fw-ar.up').count(), 0, '+10 is under the 30 m³/s arrow threshold');
        assert.ok(!(await text(page, '.fw-sheet .fw-dl')).some(t => t.includes('แม่น้ำเจ้าพระยา')), 'no duplicate river line under รายละเอียด');
        const meta = (await text(page, '.fw-sheet .fw-meta'))[0];
        assert.ok(!/POPNIX|Open-Meteo|Rocket|Nominatim/.test(meta) && /^\d\d:\d\d · ค\.ทรงกระเทียม/.test(meta), 'V101.69: meta is time · gauge only: ' + meta);
        // V101.69 source colours: every row carries a bar with its source(s); the legend lists each used source once
        const bars = await page.locator('.fw-sheet .fw-sb').evaluateAll(ns => ns.map(n => n.dataset.src));
        assert.deepEqual(bars, ['fw+fb', 'fw', 'fb', 'rid', 'om', 'hist+osm', 'pop', 'pop', 'pop+fb', 'fw', 'om'], 'row → source: ' + JSON.stringify(bars));
        assert.ok(await page.locator('.fw-sheet .fw-sb').evaluateAll(ns => ns.every(n => getComputedStyle(n, '::before').width === '3px')), '3 px bars drawn');
        const legend = await text(page, '.fw-sheet .fw-lg span');
        assert.deepEqual(legend, ['BKK FloodWatch', 'ข้อมูล: สำนักการระบายน้ำ กรุงเทพมหานคร ผ่าน POPNIX Flood', 'Floodboard (CC BY 4.0)', 'ThaiWater · กรมชลประทาน', 'Open-Meteo (CC BY 4.0)', '2569 ประกาศ กทม. 29 ก.ย. · 2554 รายงานข่าว (Rocket Media Lab)', 'เขตจาก OpenStreetMap (Nominatim)'], 'legend = attributions once');
        assert.equal(await page.locator('.fw-sheet .fw-sb[data-src="pop+fb"]').evaluate(n => getComputedStyle(n, '::before').backgroundImage.includes('linear-gradient')), true, 'two agreeing sources → two-colour bar');
        if (process.env.SHOT) await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-lean-open.png') });
        await page.locator('.fw-sheet .fw-more summary').click();
        if (process.env.SHOT) await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-lean.png') });
        await ctx.close();

        // ---- river over 2,500, no district (outside Bangkok), a wet road ----
        ({ page, ctx, errors } = await open(browser, 412, { c13: 2610, district: null, wetRoad: true }));
        assert.deepEqual(await text(page, '.fw-sheet .fw-badge'), ['เฝ้าระวัง'], 'risk low + river alert → เฝ้าระวัง');
        assert.deepEqual(await text(page, '.fw-sheet .fw-rv-alert'), ['แม่น้ำเจ้าพระยาสูงกว่าเกณฑ์ 2,200 m³/sC.13 ชัยนาท · น้ำเหนือกำลังลงมา2,610']);
        assert.ok((await text(page, '.fw-sheet .fw-sub'))[0].includes('แม่น้ำเจ้าพระยาที่ชัยนาทสูงกว่าเกณฑ์'));
        assert.deepEqual(await text(page, '.fw-sheet .fw-tile .fw-v'), ['93cm', '15cm']);
        assert.ok((await text(page, '.fw-sheet .fw-tile .fw-n'))[1].includes('ถ.นาคนิวาส · 320 ม.'));
        assert.equal(await page.locator('.fw-sheet .fw-hist').count(), 0, 'no district → no history line');
        await page.locator('.fw-sheet .fw-more summary').click();
        assert.ok(await page.locator('.fw-sheet .fw-river-row .fw-rd').evaluateAll(ns => ns.some(n => n.style.background.includes('239, 68, 68') || n.style.background === '#ef4444' || n.getAttribute('style').includes('#ef4444'))), 'the 2,610 chip has the red dot');
        if (process.env.SHOT) { await page.locator('.fw-sheet .fw-more summary').click(); await page.locator('.fw-sheet').screenshot({ path: path.resolve('output/flood-popup-lean-alert.png') }); }
        await ctx.close();

        // ---- 320 px: nothing overflows the sheet ----
        ({ page, ctx, errors } = await open(browser, 320, { c13: 2610, district: 'คันนายาว' }));
        const m = await page.evaluate(() => { const s = document.querySelector('.fw-sheet'); const r = s.getBoundingClientRect(); return { sw: s.scrollWidth, cw: s.clientWidth, right: r.right, vw: document.documentElement.clientWidth }; });
        assert.ok(m.sw <= m.cw + 1 && m.right <= m.vw + 1, 'no sideways overflow at 320 px: ' + JSON.stringify(m));
        await ctx.close();

        assert.deepEqual(errors.filter(e => !/firebase./.test(e)), [], 'no page errors beyond the un-stubbed Firebase boot');
        console.log('PASS: flood popup lean — badge + sentence, คลอง/ถนน tiles, 7-day rain from the same Open-Meteo call (3 back · today · 3 ahead with %), เขต 2554/2569 line with sources in titles, details folded (6 lines + sources once), river > 2,500 → red line + เฝ้าระวัง, wet road tile, no history without a district, source bars per row (two-colour when two agree) + dot legend instead of the paragraph, river line 2,200, river strip on the front (3 chips, ThaiWater bar) and not under รายละเอียด, fits 320 px');
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
