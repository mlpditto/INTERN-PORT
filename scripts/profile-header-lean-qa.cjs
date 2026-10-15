// V101.117: intern profile header lean — ONE 40px block: avatar (ring = division colour, corner dot = group) · name over pts · Beri · LV ·
// the tool rail as the third column (phones: its own row under the name). The division badge row is gone (CSS-hidden, JS still writes it).
// Real index.html (scripts stripped) in Playwright at 940px and 360px touch, plus the REAL paintProfileGroup / divColor.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raw = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(raw));
const row = raw.slice(raw.indexOf('<div class="profile-info-row">'), raw.indexOf('<!-- V101.41: days left'));
const order = ['id="u-img"', 'class="u-hdr-id"', 'id="u-name-row"', 'class="profile-score-summary"', 'id="profile-quick-actions"', 'class="u-hdr-more"', 'id="u-division-badge"'].map(m => row.indexOf(m));
assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'row order: avatar · (name + score) · rail · more (badge inside): ' + order.join(','));
assert.ok(raw.includes('style="width: 40px; height: 40px; border-width: 3px;"'), 'avatar 40px');
assert.ok(raw.includes('#section-profile-combined #u-division-badge { display: none !important; }'), 'badge row hidden');
assert.ok(raw.includes("if (typeof paintProfileGroup === 'function') paintProfileGroup(myGroup);   // V101.117"), 'division change repaints the ring');
function grab(src, marker) { const i = src.indexOf(marker); assert.ok(i >= 0, marker); let d = 0, k = src.indexOf('{', src.indexOf(')', i)); for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; } return src.slice(i, k + 1); }
const fns = ['function divColor(', 'function paintProfileGroup('].map(m => grab(raw, m)).join('\n');
const html = raw.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link rel="stylesheet" href="(?!https)[^"]*">/g, '').replace('<div id="main-app" class="hidden">', '<div id="main-app">');
const SAMPLE = `
    document.querySelectorAll('#loading-overlay, .center-screen, .modal').forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('#main-app > *').forEach(el => { if (el.id !== 'section-profile-combined') el.style.display = 'none'; });
    document.getElementById('u-name').textContent = 'Joeylive'; document.getElementById('u-score').textContent = '12.09'; document.getElementById('u-beri').textContent = '🪙 52'; document.getElementById('u-crew-rank').textContent = 'LV.2';
    const dv = document.getElementById('u-division-badge'); dv.style.display = 'inline-block'; dv.textContent = 'CU';
    document.querySelector('.unified-metrics-bar').style.display = 'none';
    var getGroupColor = g => '#e67e22', getGroupIcon = g => 'fa-user-md', userDivisionOf = u => (u.division === 'CU' ? 'CU' : ''), myDivisionRaw = 'CU';
`;
(async () => {
    const browser = await chromium.launch();
    try {
        for (const [tag, vp, touch, maxH] of [['desktop', { width: 940, height: 300 }, false, 70], ['phone', { width: 360, height: 360 }, true, 118]]) {
            const page = await (await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.route(/^(?!data:|about:).*/, r => r.abort());
            await page.setContent(html, { waitUntil: 'domcontentloaded' });
            await page.evaluate(SAMPLE); await page.addScriptTag({ content: fns + "\npaintProfileGroup('EXTERN');" });
            const box = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height, c: r.top + r.height / 2 }; });
            const card = await box('#section-profile-combined');
            assert.ok(card.h <= maxH, `${tag}: card ${Math.round(card.h)}px ≤ ${maxH}px`);
            const img = await box('#u-img'), name = await box('#u-name-row'), score = await box('.profile-score-summary'), rail = await box('#profile-quick-actions');
            assert.ok(Math.abs(img.h - 40) <= 1, 'avatar 40px');
            assert.ok(name.t >= img.t - 2 && score.b <= img.b + 2, `${tag}: name + score fit the avatar height`);
            assert.ok(name.l > img.r && score.l > img.r, 'name + score beside the avatar');
            if (touch) assert.ok(rail.t >= img.b - 2, 'phone: rail is its own row under the name'); else assert.ok(Math.abs(rail.c - img.c) <= 8 && rail.l > score.r, 'desktop: rail on the same line, right');
            const buttons = await page.$$eval('#profile-quick-actions > button:not([hidden])', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
            assert.equal(buttons.length, 5);   // V101.147: ⋯ beside Flood
             assert.ok(Math.max(...buttons) - Math.min(...buttons) <= 2, 'rail buttons on one row');
            assert.equal(await page.$eval('#u-division-badge', e => getComputedStyle(e).display), 'none', 'badge row hidden even when JS shows it');
            assert.equal(await page.$eval('#u-img', e => e.style.borderColor), 'rgb(224, 33, 138)', 'ring = division colour (V101.158: CU is pinned to Chulalongkorn pink #e0218a; the hash gave it the same purple as BUU)');
            assert.equal(await page.$eval('#u-img', e => e.title), 'CU › EXTERN', 'tooltip names division › group');
            assert.equal(await page.$eval('#u-group-dot', e => e.hidden), false, 'corner dot = group');
            assert.deepEqual(errs, [], 'no page errors ' + tag);
            await page.context().close();
        }
        console.log('PASS: profile header lean — one 40px block (name + pts beside the avatar, rail right / own row on phones), badge row gone, ring = division colour, desktop ≤70px · phone ≤118px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
