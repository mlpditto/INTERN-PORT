// V102.223 / V101.139 — (1) the Quiz Engine live pill is an icon (+ caret) with the words in the hover, (2) the drug-news card is not drawn in the CAFE (Content Creator) UI.
const fs = require('fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const flood = fs.readFileSync('public/flood-watch.css', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(admin));
const grab = marker => { const i = admin.indexOf(marker); assert.ok(i >= 0, marker); let d = 0, k = admin.indexOf('{', admin.indexOf(')', i)); for (; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}' && --d === 0) break; } return admin.slice(i, k + 1); };
const fn = grab('window.quizLivePillHtml = function');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
        await page.setContent('<meta charset="utf-8"><body></body>');
        const rows = await page.evaluate(src => {
            const now = Date.now(), out = {};
            window.QUIZ_TIMER_HOURS = [1, 24]; window.quizTimerLabel = h => h + 'h';
            let st;
            window.quizLiveState = () => st;
            new Function(src + '; window.quizLivePillHtml = window.quizLivePillHtml;')();
            for (const [k, s] of Object.entries({ off: { kind: 'off' }, expired: { kind: 'expired', dead: new Date(2026, 9, 12, 18, 0) }, sched: { kind: 'sched', start: new Date(2026, 9, 20, 9, 0) }, live: { kind: 'live', dead: new Date(now + 36e5) } })) {
                st = s; const h = document.createElement('div'); h.innerHTML = window.quizLivePillHtml({ id: 'q1' });
                const sum = h.querySelector('summary');
                out[k] = { text: sum.textContent.replace(/\s+/g, ' ').trim(), title: sum.getAttribute('title'), aria: sum.getAttribute('aria-label'), icons: [...sum.querySelectorAll('i')].map(i => i.className), menu: h.querySelector('.qa-live-body').textContent.replace(/\s+/g, ' ').trim() };
            }
            return out;
        }, fn);
        assert.equal(rows.off.text, ''); assert.deepEqual(rows.off.icons, ['fa-solid fa-play', 'fa-solid fa-chevron-down qa-caret']); assert.match(rows.off.title, /^Go live/);
        assert.equal(rows.expired.text, ''); assert.match(rows.expired.title, /^Expired .*2026/); assert.equal(rows.expired.aria, rows.expired.title, 'the hover text is also the accessible name');
        assert.equal(rows.sched.text, ''); assert.match(rows.sched.title, /^Scheduled — starts .*2026/);
        assert.ok(/\d/.test(rows.live.text) || rows.live.text === '', 'a live pill keeps only its countdown digits (filled by the page timer)'); assert.match(rows.live.title, /^Live until/);
        assert.match(rows.off.menu, /Go live for/, 'the menu behind the pill keeps its words');

        // the CAFE UI does not draw the news card
        await page.setContent('<meta charset="utf-8"><body><div id="hfr-news"><div class="hfr-card news"><ul class="hfr-nl"><li><a>Headline</a></li></ul></div></div></body>');
        await page.addStyleTag({ content: flood });
        assert.equal(await page.locator('#hfr-news .hfr-card').isVisible(), true, 'visible in the Intern UI');
        await page.evaluate(() => document.body.classList.add('cafe-mode'));
        assert.equal(await page.locator('#hfr-news .hfr-card').isVisible(), false, 'hidden when body.cafe-mode is on');
        await page.evaluate(() => document.body.classList.remove('cafe-mode'));
        assert.equal(await page.locator('#hfr-news .hfr-card').isVisible(), true, 'and back when the Intern UI returns');
        console.log('PASS: live pill = icon + caret with the words in the hover (off / expired / scheduled / live), menu unchanged; news card hidden in the CAFE UI');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
