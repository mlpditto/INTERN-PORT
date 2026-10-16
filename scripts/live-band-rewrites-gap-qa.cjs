// V102.255 — (a) Quiz Engine list: the column header (Title · Items · pts · Action) is on top, the "🟢 Live · n" band sits UNDER it and above the Live rows, then the Paused · Templates band and its rows
// (the real admin.html in Chromium); (b) the Rewrites view lost its ~110px of nothing above "Improvements" (the real template strings).
const assert = require('node:assert/strict'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

// (b) Rewrites spacing — no divider, no padding, tight heading, a smaller gap under the summary
const iw = html.indexOf('improvementsHtml = `'), seg = html.slice(iw, iw + 900);
assert.ok(!/border-top:2px solid #f8f9fa/.test(seg) && !/padding-top:20px/.test(seg) && !/margin-top:25px/.test(seg), 'the divider / 25px / 20px spacing is gone from the Improvements wrapper');
assert.ok(/<h4 style="color:var\(--primary\); margin:0 0 8px; font-size:0\.85em;">/.test(seg), 'the heading hugs its list (8px)');
assert.ok(/<details style="margin-bottom:10px; background:#fafafa; border:1px solid #f0f0f0/.test(html), 'the summary block leaves 10px (was 16px)');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => document.readyState === 'complete' && !!document.getElementById('quiz-list-card'));
        // make every part visible whatever tab is open, then read the vertical order inside the card
        const r = await page.evaluate(() => {
            const card = document.getElementById('quiz-list-card');
            for (let el = card; el && el !== document.body; el = el.parentElement) { if (getComputedStyle(el).display === 'none') el.style.display = 'block'; }
            const act = document.getElementById('quizzesTableActive'), body = act.querySelector('tbody');
            body.innerHTML = '<tr id="row-live-1"><td>Live row</td><td>10</td><td>x</td></tr>';
            document.getElementById('section-active-quizzes').textContent = '🟢 Live · 3';
            const y = el => Math.round(el.getBoundingClientRect().top);
            const hdr = act.querySelector('thead tr:first-child'), band = act.querySelector('thead tr.qlist-live'), live = document.getElementById('row-live-1'), pausedBand = document.getElementById('section-inactive-quizzes');
            return {
                hdrText: [...hdr.querySelectorAll('th')].map(t => t.textContent.trim()), bandText: band.textContent.trim(), bandId: band.querySelector('th').id,
                order: [y(hdr), y(band), y(live), y(pausedBand)], h4Gone: !document.querySelector('h4#section-active-quizzes'), bandBg: getComputedStyle(band.querySelector('th')).backgroundColor,
                bandInsideCard: card.contains(band), bandSpan: band.querySelector('th').colSpan,
            };
        });
        assert.deepEqual(r.hdrText, ['Title', 'Items · pts', 'Action'], 'the column header row is unchanged');
        assert.equal(r.bandText, '🟢 Live · 3', 'the band shows what the existing JS writes into #section-active-quizzes'); assert.equal(r.bandId, 'section-active-quizzes'); assert.equal(r.bandSpan, 3);
        assert.ok(r.h4Gone && r.bandInsideCard, 'the old heading above the card is gone; the band is inside the card');
        assert.ok(r.order[0] < r.order[1] && r.order[1] < r.order[2] && r.order[2] < r.order[3], 'order top → bottom: header · Live band · Live rows · Paused band: ' + r.order);
        assert.ok(r.order[1] - r.order[0] <= 60 && r.order[2] - r.order[1] <= 50, 'tight: header → band → first row: ' + r.order);
        assert.equal(r.bandBg, 'rgb(239, 246, 255)');
        console.log('PASS: list order — column header, then the 🟢 Live · n band, then the rows, then Paused · Templates; Rewrites view has no divider / empty gap above Improvements');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
