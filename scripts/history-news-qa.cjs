// V101.134 — History rail, news card: headlines of the Mahidol Pharmacy DIC "ข่าวยา" list, each a link back to the DIC page.
//  · functions/index.js parseDrugNews (the REAL function, cut from the file) on a fixture shaped like the live list page (rows copied from 2026-10-13);
//  · public/history-news.js on the REAL index.html in Chromium: getDrugNews stubbed → a card of ≤5 links (new tab, noopener, DIC urls only), no label words
//    beyond the headlines, × closes it for today (a newer headline brings it back), a failing / missing callable draws nothing, narrow screens do not show it.
const path = require('node:path'), fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fnSrc = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/getDrugNews/.test(fnSrc) && /exports\.getDrugNews = onCall\(/.test(fnSrc), 'the callable exists');
assert.ok(/request\.auth\) throw new HttpsError\('unauthenticated'/.test(fnSrc.slice(fnSrc.indexOf('exports.getDrugNews'))), 'it needs a login');
assert.ok(idx.includes('history-news.js?v=V101.') && idx.includes("hnInit === 'function') hnInit()"), 'index loads the script and starts it next to the flood watch');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const ctx = vm.createContext({}); vm.runInContext(grab(fnSrc, 'function parseDrugNews('), ctx);
const row = (n, id, t, w) => `<tr>\r\n<td style="padding:5px;width:30px;font-size:20pt;color:#ccc">${n}.</td>\r\n<td style="padding:5px">\r\n<h5 style="margin:0;padding:0"><a href="news_week_full.php?id=${id}">${t} </a>\r\n</h5>\r\n<div style="font-size:11px;margin-bottom:15px">${w} <em>อ่านแล้ว 260 ครั้ง</em></div>\r\n</td>\r\n</tr>`;
const page = '<table>' + row(1, 1891, 'Centanafadine ยาใหม่สำหรับโรคสมาธิสั้นได้รับข้อบ่งใช้จาก USFDA แล้ว', 'สัปดาห์ที่ 2 เดือนตุลาคม พ.ศ.2569') + row(2, 1890, 'Oveporexton: Orexin receptor agonist ตัวแรก &amp; ทางเลือก', 'สัปดาห์ที่ 1 เดือนตุลาคม พ.ศ.2569')
    + row(3, 1890, 'duplicate id', 'x') + row(4, 1889, 'Denosumab <b>อาจ</b> ช่วยลดความเสี่ยง', 'สัปดาห์ที่ 4 เดือนกันยายน พ.ศ.2569') + '</table><a href="news_week_full.php?id=5">sidebar link, not a list row</a>';
ctx.html = page;
const got = JSON.parse(vm.runInContext('JSON.stringify(parseDrugNews(html, 8))', ctx));
assert.deepEqual(got.map(x => x.id), [1891, 1890, 1889], 'rows in order, duplicates and non-row links dropped');
assert.deepEqual(got[0], { id: 1891, title: 'Centanafadine ยาใหม่สำหรับโรคสมาธิสั้นได้รับข้อบ่งใช้จาก USFDA แล้ว', week: 'สัปดาห์ที่ 2 เดือนตุลาคม พ.ศ.2569', url: 'https://pharmacy.mahidol.ac.th/dic/news_week_full.php?id=1891' }, 'title, week (without "อ่านแล้ว"), absolute DIC url');
assert.equal(got[1].title, 'Oveporexton: Orexin receptor agonist ตัวแรก & ทางเลือก', '&amp; decoded'); assert.equal(got[2].title, 'Denosumab อาจ ช่วยลดความเสี่ยง', 'tags stripped');
assert.equal(JSON.parse(vm.runInContext('JSON.stringify(parseDrugNews(html, 2))', ctx)).length, 2, 'limit honoured');
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(parseDrugNews("<html>403 Forbidden</html>", 8))', ctx)), [], 'an error page parses to nothing');

const ITEMS = [1891, 1890, 1889, 1888, 1887, 1886, 1885].map(id => ({ id, title: 'หัวข้อข่าว ' + id + ' ยาใหม่', week: 'สัปดาห์ที่ 2 เดือนตุลาคม พ.ศ.2569', url: 'https://pharmacy.mahidol.ac.th/dic/news_week_full.php?id=' + id }))
    .concat([{ id: 1, title: 'evil', week: '', url: 'https://evil.example/x' }]);
async function open(browser, width, mode, presets) {
    const c = await browser.newContext({ viewport: { width, height: 900 } });
    const pg = await c.newPage(); const errors = []; pg.on('pageerror', e => errors.push(e.message));
    await pg.addInitScript(([mode, items, presets]) => {
        window.__calls = 0;
        window.firebase = { functions: () => ({ httpsCallable: (n) => () => { if (n === 'getDrugNews') { window.__calls++; return mode === 'fail' ? Promise.reject(new Error('unavailable')) : Promise.resolve({ data: { items } }); } return Promise.resolve({ data: { risk: 'low', canalRisk: 'low', canal: { name: 'x', km: 1, freeboardM: 0.9, change24cm: 0 }, road: { risk: 'low', n: 0, nearest: null }, river: { stations: [] }, checkedAt: Date.now() } }); } }), firestore: { FieldValue: {} } };
        window.fetch = () => Promise.resolve({ ok: false, json: () => null });
        (presets || []).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } });
    }, [mode, ITEMS, presets]);
    await pg.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await pg.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await pg.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
    await pg.waitForTimeout(400);
    await pg.evaluate(() => { hnInit(); });
    await pg.waitForTimeout(500);
    await pg.evaluate(() => { document.getElementById('work-section-content').style.display = 'block'; document.getElementById('work-pane-history').style.display = 'block'; });
    await pg.waitForTimeout(300);   // the rail measures its room when the History panel becomes visible (ResizeObserver)
    return { c, pg, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        let { c, pg, errors } = await open(browser, 1500, 'ok');
        const s = await pg.evaluate(() => { const card = document.querySelector('#hfr-news .hfr-card.news'), shell = document.querySelector('#work-pane-history > .work-pane-shell'); const r = card && card.getBoundingClientRect();
            return { n: card ? card.querySelectorAll('li a').length : 0, links: card ? [...card.querySelectorAll('li a')].map(a => [a.getAttribute('href'), a.target, a.rel, a.textContent, a.title]) : [], visible: !!r && r.width > 0, right: r ? r.left >= shell.getBoundingClientRect().right - 1 : null, text: card ? card.innerText.replace(/\s+/g, ' ').trim() : '' }; });
        assert.ok(s.visible && s.right, 'the news card is drawn to the right of the History timeline: ' + JSON.stringify(s).slice(0, 200));
        assert.equal(s.n, 5, 'five headlines at most (and the evil.example row is never one of them)');
        s.links.forEach(l => { assert.match(l[0], /^https:\/\/pharmacy\.mahidol\.ac\.th\/dic\/news_week_full\.php\?id=\d+$/); assert.equal(l[1], '_blank'); assert.match(l[2], /noopener/); assert.match(l[4], /Drug Information Center, Mahidol Pharmacy/, 'source in the tooltip'); });
        assert.ok(!/evil/.test(s.text), 'a non-DIC url is filtered out');
        assert.equal(s.text, '× ' + s.links.map(l => l[3]).join(' ').replace(/\s+/g, ' '), 'nothing but the close × and the headlines is written: ' + s.text);
        // cached: a second init does not call the function again
        await pg.evaluate(() => hnInit()); assert.equal(await pg.evaluate(() => window.__calls), 1, 'kept for 3 hours — one call');
        // × closes for today
        await pg.click('#hfr-news .hfr-x');
        assert.equal(await pg.locator('#hfr-news .hfr-card').count(), 0, '× closes it');
        assert.match(await pg.evaluate(() => localStorage.getItem('hnOff')), /^\d{4}-\d{2}-\d{2}\|1891$/, 'remembered for today + the newest headline');
        await pg.evaluate(() => hnInit()); assert.equal(await pg.locator('#hfr-news .hfr-card').count(), 0, 'stays closed');
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors: ' + errors.join(' | '));
        await c.close();

        // a newer headline than the closed one brings it back
        ({ c, pg } = await open(browser, 1500, 'ok', [['hnOff', '2000-01-01|1800']]));
        assert.equal(await pg.locator('#hfr-news .hfr-card').count(), 1, 'a different closed key does not hide it');
        await c.close();
        // failing callable → nothing
        ({ c, pg } = await open(browser, 1500, 'fail'));
        assert.equal(await pg.locator('#hfr-news .hfr-card').count(), 0, 'no news → no card');
        assert.equal(await pg.evaluate(() => getComputedStyle(document.getElementById('hist-flood-rail')).display), 'none', 'and the rail itself is not drawn');
        await c.close();
        // narrow
        ({ c, pg } = await open(browser, 900, 'ok'));
        assert.equal(await pg.evaluate(() => { const card = document.querySelector('#hfr-news .hfr-card'); return !card || card.getBoundingClientRect().width === 0; }), true, 'a ~900 px window has no room → nothing is drawn');
        await c.close();
        console.log('PASS: History news card — DIC headlines as links (new tab), parser on the live page shape, ≤5, closes for today, silent on failure, wide screens only');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
