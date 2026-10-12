// V102.191 — Learning performance is ONE ROW per cluster (name · bar + % · n/N · peers · limited · view), not a 250 px card.
// Real renderQuizInsightCard + the real CSS from public/admin.html, measured in Chromium at desktop and phone width.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

function grab(marker) {
    const a = html.indexOf(marker); assert.ok(a >= 0, 'marker ' + marker);
    let i = html.indexOf('{', html.indexOf(')', a)), b = 0, k = i;
    for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
    return html.slice(a, k + 1);
}
const cssStart = html.indexOf('.quiz-insight-cards { display:flex;');
const cssEnd = html.indexOf('\n        @media(max-width:600px) {', html.indexOf('.quiz-insight-tags span', cssStart));
const mediaEnd = html.indexOf('\n        }\n', cssEnd) + 10;
const css = html.slice(cssStart, mediaEnd);
assert.ok(cssStart > 0 && css.includes('.qi-view') && css.includes('.qi-ev'), 'row CSS found');

const ctx = vm.createContext({ escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') });
vm.runInContext(grab('function renderQuizInsightCard('), ctx);
const data = [
    { tags: ['Diabetes', 'Diabetes mellitus'], avg: 100, correct: 9, total: 9, attempts: 1, cohortAvg: 100 },
    { tags: ['Allergic rhinitis'], avg: 96, correct: 24, total: 25, attempts: 2, cohortAvg: 100 },
    { tags: ['Pediatrics'], avg: 90, correct: 9, total: 10, attempts: 1, cohortAvg: 100 },
    { tags: ['Asthma & COPD'], avg: 68.4, correct: 17, total: 25, attempts: 3, cohortAvg: 61 },
    { tags: ['Anticoagulation'], avg: 55, correct: 11, total: 20, attempts: 2, cohortAvg: 72 },
    { tags: ['No peers'], avg: 80, correct: 16, total: 20, attempts: 2 }
];
const rows = data.map((g, i) => ctx.renderQuizInsightCard(g, i, data.length, '', 'EXTERN'));

// ---- content ----
assert.ok(rows.every(r => !/Higher observed accuracy<|Topic cluster|View questions<\/button>|related tags|Same-group peers [a-z]/i.test(r.replace(/title="[^"]*"/g, ''))), 'no repeated sentences — they are the accent colour and tooltips now');
assert.ok(rows[0].includes('class="qi-more"') && rows[0].includes('+1') && /<div class="quiz-insight-tags" hidden>/.test(rows[0]), '+N chip with hidden inline tags');
assert.ok(!rows[1].includes('qi-more') && !rows[1].includes('quiz-insight-tags'), 'no extra tags → no chip, no tags row');
assert.ok(rows[0].includes('qi-peer same') && rows[0].includes('>≈<'), '≈ within 5 pts');
assert.ok(rows[2].includes('qi-peer down') && rows[2].includes('▼ −10'), '▼ with the gap');
assert.ok(rows[3].includes('qi-peer up') && rows[3].includes('▲ +7'), '▲ with the gap');
assert.ok(/title="Same-group peers \(EXTERN\) average 61\.0% — 7\.4 pts above"/.test(rows[3]), 'tooltip carries the peer average');
assert.ok(!rows[5].includes('qi-peer'), 'no cohort value → no peer chip');
assert.ok(rows[0].includes('qi-ev') && rows[2].includes('qi-ev') && !rows[1].includes('qi-ev') && !rows[3].includes('qi-ev'), '"limited" only for 1 attempt or < 10 questions');
assert.ok(rows[3].includes('>68.4%<') && rows[0].includes('>100%<') && rows[1].includes('>96%<'), 'decimals only when needed');
assert.ok(rows[1].includes('onclick="openTagDrillDown(1)"') && rows[1].includes('aria-label="View questions"'), 'icon button → the same drill-down');
assert.ok(rows[0].includes('class="quiz-insight-card higher"') && rows[4].includes('class="quiz-insight-card review"'), 'kind = accent class');
assert.ok(!html.includes('cohortBadge'), 'the old peer sentence helper is gone');

// ---- layout in a real browser ----
(async () => {
    const browser = await chromium.launch();
    try {
        for (const [vw, maxRowH] of [[1100, 56], [372, 120]]) {
            const page = await browser.newPage({ viewport: { width: vw, height: 800 } });
            await page.setContent(`<meta charset="utf-8"><style>:root{--border-color:#e2e8f0;--bg-card:#fff;--bg-body:#f1f5f9;--text-sub:#64748b}*{box-sizing:border-box}body{margin:0;padding:12px;font:14px Inter,sans-serif}button{width:100%;min-height:48px}${css}</style><div class="quiz-insight-cards">${rows.join('')}</div>`);
            const m = await page.evaluate(() => {
                const cards = [...document.querySelectorAll('.quiz-insight-card')];
                return { hs: cards.map(c => Math.round(c.getBoundingClientRect().height)), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    view: Math.round(cards[0].querySelector('.qi-view').getBoundingClientRect().width), bars: cards.map(c => Math.round(c.querySelector('.quiz-insight-track').getBoundingClientRect().width)) };
            });
            assert.ok(m.hs.every(h => h <= maxRowH), `rows stay slim @${vw}: ${m.hs}`);
            assert.ok(!m.overflow, `no horizontal scroll @${vw}`);
            assert.ok(m.view <= 34, `the button beats the global button{width:100%} rule: ${m.view}px @${vw}`);
            assert.ok(m.bars.every(w => w >= 60), `the bar keeps room @${vw}: ${m.bars}`);
            // the +N chip unfolds the tags inline
            await page.click('.qi-more');
            assert.equal(await page.evaluate(() => document.querySelector('.quiz-insight-tags').hidden), false, 'chip opens the tags');
            assert.equal(await page.evaluate(() => document.querySelector('.qi-more').getAttribute('aria-expanded')), 'true');
            await page.close();
        }
        console.log('PASS: Learning performance rows — one slim row per cluster (desktop ≤ 56 px, phone ≤ 120 px, no overflow), ≈/▲/▼ peer chips, "limited" only when thin, +N unfolds tags inline, icon button → drill-down');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
