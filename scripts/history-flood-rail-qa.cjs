// V101.134 — History's right rail: the flood places that are still at risk, one small card beside the timeline (wide screens only), no words.
// The REAL public/index.html + flood-watch.js/css (file://, network blocked, Firebase + Open-Meteo stubbed). A place at เฝ้าระวัง / เสี่ยงสูง shows
// 🏥 / 🏠 + the severity emoji + the river key + the 💧 canal / 🛣️ road numbers; everything ok = no card; × closes it for today (the same
// situation stays closed, a worse one comes back); a tap opens the full popup; it is drawn only when there is room (V101.137: the measured gap right of the timeline >= 150 px, the card narrows to fit) — a ~900 px window has none.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<aside id="hist-flood-rail" class="hist-flood-rail lang-no-toggle"><div class="hfr-stack"><div id="hfr-flood"><\/div><div id="hfr-news"><\/div><\/div><\/aside>/.test(idx), 'the rail (flood slot + news slot) sits in the History shell');

async function open(browser, width, risk, presets) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([risk, presets]) => {
        const now = Date.now();
        const DATA = risk === 'ok'
            ? { risk: 'low', canalRisk: 'low', canal: { name: 'คลอง', km: 1, freeboardM: 0.9, change24cm: 0 }, road: { risk: 'low', n: 0, nearest: null }, river: { stations: [] }, checkedAt: now }
            : { risk: risk, canalRisk: risk, canal: { name: 'คลอง', km: 1, freeboardM: risk === 'high' ? -0.12 : 0.2, change24cm: 5 }, road: { risk: 'moderate', n: 1, nearest: { name: 'ถ.นาคนิวาส', m: 320, depthCm: 15, motorbike: 'risky', sedan: 'ok', sensor: true } }, river: { stations: [{ code: 'C.2', place: 'นครสวรรค์', q: 2600, at: now }] }, checkedAt: now };
        window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: DATA }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
        window.fetch = () => Promise.resolve({ ok: false, json: () => null });
        (presets || []).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } });
    }, [risk, presets]);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { fwInit(); });
    await page.waitForTimeout(700);
    // show the History pane
    await page.evaluate(() => { const c = document.getElementById('work-section-content'); c.style.display = 'block'; document.getElementById('work-pane-history').style.display = 'block'; });
    await page.waitForTimeout(300);   // the rail measures its room when the History panel becomes visible (ResizeObserver)
    return { ctx, page, errors };
}
const snap = page => page.evaluate(() => {
    const r = document.getElementById('hfr-flood'), card = r.querySelector('.hfr-card'), shell = document.querySelector('#work-pane-history > .work-pane-shell');
    const rr = card ? card.getBoundingClientRect() : null, sr = shell.getBoundingClientRect();
    return { hidden: !card, shown: !!card && card.getBoundingClientRect().width > 0, text: card ? card.innerText.replace(/\s+/g, ' ').trim() : '', cls: card ? card.className : '', places: r.querySelectorAll('.hfr-p').length,
        rightOfTimeline: rr ? rr.left >= sr.right - 1 : null, width: rr ? Math.round(rr.width) : null, hasLetters: card ? /[A-Za-zก-๙]{2,}/.test(card.innerText.replace(/m³\/s|cm/g, '')) : null };   // units are the only letters
});

(async () => {
    const browser = await chromium.launch();
    try {
        // at risk, wide
        let { ctx, page, errors } = await open(browser, 1500, 'high');
        let s = await snap(page);
        assert.ok(s.shown && !s.hidden, 'a place at เสี่ยงสูง → the rail card is drawn: ' + JSON.stringify(s));
        assert.equal(s.places, 1, 'only the training site (no home set)'); assert.match(s.cls, /crit/, 'crit styling');
        assert.ok(s.rightOfTimeline, 'it sits to the RIGHT of the History timeline'); assert.ok(s.width >= 200 && s.width <= 240, 'about 236px wide when there is plenty of room: ' + s.width);
        assert.equal(s.hasLetters, false, 'no words in it — emoji and numbers only: ' + JSON.stringify(s.text));
        assert.match(s.text, /🏥/); assert.match(s.text, /m³\/s|2,600/, 'the river line shows its number'); assert.match(s.text, /15/, 'the road depth shows');
        // × closes it for today
        await page.click('#hfr-flood .hfr-x');
        s = await snap(page); assert.ok(s.hidden && !s.shown, '× closes it');
        assert.match(await page.evaluate(() => localStorage.getItem('fwRailOff')), /^\d{4}-\d{2}-\d{2}\|site:crit/, 'remembered for today + this situation');
        await page.evaluate(() => fwInit()); await page.waitForTimeout(600);   // the same data again → stays closed
        assert.ok((await snap(page)).hidden, 'the same situation stays closed');
        await ctx.close();

        // warn → card; a different closed situation does not hide it
        ({ ctx, page, errors } = await open(browser, 1500, 'moderate', [['fwRailOff', '2000-01-01|site:crit']]));
        s = await snap(page); assert.ok(s.shown && /warn/.test(s.cls), 'เฝ้าระวัง → warn card, and an old / different closed key does not hide it: ' + JSON.stringify(s));
        // tap opens the popup
        await page.click('#hfr-flood .hfr-card', { position: { x: 60, y: 30 } });
        assert.equal(await page.evaluate(() => !!document.querySelector('.fw-sheet')), true, 'a tap opens the full popup');
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();

        // everything ok → no card
        ({ ctx, page, errors } = await open(browser, 1500, 'ok'));
        s = await snap(page); assert.ok(s.hidden && !s.shown && s.text === '', 'all ok → nothing drawn');
        await ctx.close();

        // narrow screen → not drawn even when at risk
        ({ ctx, page, errors } = await open(browser, 900, 'high'));
        s = await snap(page); assert.equal(s.shown, false, 'a ~900 px window has no room right of the timeline → the rail is not shown');
        await ctx.close();
        // a mid-size window (~1150 px): there IS room, the card narrows to fit instead of waiting for 1240 px
        ({ ctx, page, errors } = await open(browser, 1150, 'high'));
        s = await snap(page); assert.ok(s.shown && s.rightOfTimeline && s.width >= 120 && s.width < 236, 'at ~1150 px the card is drawn, narrower than 236: ' + JSON.stringify(s));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'and it never causes sideways scroll');
        await ctx.close();
        console.log('PASS: History flood rail — at-risk places only, right of the timeline, no words, × = closed for today, tap = popup, hidden on narrow screens');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
