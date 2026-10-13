// V102.217 — the tag drill-down header (Learning performance → ☰) is ONE line: 🔬 · title (+N co-occurring) · "9/14 correct · 64.3% · 1 attempt".
// The REAL header markup cut from public/admin.html and the REAL renderTagDrillDownContent writing into it, measured in Chromium at modal width and on a phone.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
const a = html.indexOf('<div id="drilldown-header"'), b = html.indexOf('<div class="lang-no-toggle" id="drilldown-body"');
assert.ok(a > 0 && b > a, 'header markup found');
const header = html.slice(a, b);

function grab(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', html.indexOf(')', i));
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 1);
}
(async () => {
    const browser = await chromium.launch();
    try {
        for (const [vw, long] of [[820, false], [372, false], [372, true]]) {
            const page = await browser.newPage({ viewport: { width: vw, height: 500 } });
            await page.setContent(`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:20px;font:16px Inter,sans-serif}</style><div style="width:${Math.min(vw - 40, 780)}px">${header}<div id="drilldown-body"></div></div>`);
            const r = await page.evaluate(([fn, long]) => {
                window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
                window._drillDownActions = {};
                const render = new Function('escapeHtml', fn + '; return renderTagDrillDownContent;')(window.escapeHtml);
                const tags = long ? ['Allergic rhinitis with a very long descriptive tag that cannot fit on a phone line', 'x'] : ['Allergic rhinitis', 'Rhinitis', 'Cetirizine'];
                try { render({ tags, correct: 9, total: 14, avg: 64.3, attempts: 1 }, [], [], []); } catch (e) { /* the body helpers are not needed for the header */ }
                const t = document.getElementById('drilldown-title'), s = document.getElementById('drilldown-stats'), h = document.getElementById('drilldown-header');
                const tr = t.getBoundingClientRect(), sr = s.getBoundingClientRect();
                return { title: t.textContent, titleTip: t.title, stats: s.textContent, sameLine: Math.abs((tr.top + tr.height / 2) - (sr.top + sr.height / 2)) < 8, headerH: Math.round(h.getBoundingClientRect().height), statsWhole: s.scrollWidth <= s.clientWidth + 1, noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth };
            }, [grab('function renderTagDrillDownContent('), long]);
            assert.ok(r.sameLine, `title and stats share ONE line @${vw}${long ? ' (long title)' : ''}: ${JSON.stringify(r)}`);
            assert.ok(r.headerH <= 60, `the header is one line tall @${vw}: ${r.headerH}px`);
            assert.match(r.stats, /^9\/14 correct · 64\.3% · 1 attempt/, 'stats text unchanged'); assert.ok(r.statsWhole && r.noScroll, 'stats stay whole, no sideways scroll');
            assert.match(r.titleTip, /Allergic rhinitis/, 'the full tag list is the tooltip');
            await page.close();
        }
        console.log('PASS: tag drill-down header — title + "n/N correct · % · attempts" on ONE line (title ellipsises, stats stay whole), 820 px and phone');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
