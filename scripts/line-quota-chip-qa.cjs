// V102.479 — the LINE chip / card shows LINE's OWN numbers (line_usage/{month}.api, written daily by watchLineQuota) while they are fresh
// (< 36 h), and falls back to the project's counter otherwise. The REAL loadLineUsage sliced out of admin.html with a fake Firestore.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const tbStart = html.indexOf('<div class="stat-chips"');
const popAt = html.indexOf('<div id="line-usage-pop"');
const markup = html.slice(tbStart, html.indexOf('id="line-digest-now-btn"', popAt) + 400);
const code = ['window.toggleLineUsagePop = function', 'window.loadLineUsage = async function'].map(m => grab(html, m)).join(';\n');
const consts = html.match(/const LINE_MONTHLY_QUOTA = \d+;/)[0] + html.match(/const LINE_COUNT_START_MONTH = '[^']+';/)[0] + grab(html, 'const LINE_TAG_LABELS = ') + ';';
const GREEN = 'rgb(34, 197, 94)', AMBER = 'rgb(245, 158, 11)', RED = 'rgb(220, 38, 38)';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--primary:#4361ee}#line-usage-pop[hidden]{display:none}</style>' + markup);
        await page.addScriptTag({ content: [
            'var __doc = null;',
            'var db = { collection: c => ({ doc: id => ({ get: async () => ({ exists: !!__doc, data: () => __doc }) }) }) };',
            'function filterBoard() {} function previewDigest() {} function sendDigestNow() {} function copyDigestText() {} function closeDigestPreview() {}',
            consts, code
        ].join('\n') });
        const ago = h => '{ toMillis: () => Date.now() - ' + h + ' * 3600e3 }';
        const paint = async (docExpr) => { await page.evaluate(`__doc = ${docExpr}; window._lineDigestAtCap = undefined;`); await page.evaluate(() => window.loadLineUsage()); return page.evaluate(() => ({
            chip: document.getElementById('line-usage-chip-n').textContent, chipColor: document.getElementById('line-usage-chip-n').style.color, count: document.getElementById('line-usage-count').textContent,
            countColor: document.getElementById('line-usage-count').style.color, bar: document.getElementById('line-usage-bar').style.width, breakdown: document.getElementById('line-usage-breakdown').textContent,
            note: document.getElementById('line-usage-note').textContent, sendDisabled: document.getElementById('line-digest-now-btn').disabled, sendTitle: document.getElementById('line-digest-now-btn').title, atCap: window._lineDigestAtCap })); };
        const COUNTER = 'total: 12, byTag: { notifyQuizDigest: 10, notifyAdminOnNewCase: 2 }';

        // no api block (watchLineQuota not deployed yet): exactly today's counter chip
        let s = await paint(`{ ${COUNTER} }`);
        assert.deepEqual([s.chip, s.chipColor, s.breakdown], ['12/300', GREEN, 'digest 10 · case 2'], 'no api → the counter, as before');

        // fresh + ok: LINE's number leads, the counter follows
        s = await paint(`{ ${COUNTER}, api: { limit: 300, used: 41, tier: 'ok', projected: 120, runOutDay: null, checkedAt: ${ago(1)} } }`);
        assert.deepEqual([s.chip, s.count, s.chipColor, s.countColor, s.bar], ['41/300', '41/300', GREEN, GREEN, '14%'], 'LINE 41, green');
        assert.equal(s.breakdown, 'LINE 41 · counted 12 · digest 10 · case 2', 'LINE first, then our counter and its split');
        assert.ok(!/คาดว่า/.test(s.note), 'no projection note while ok');

        // fresh + watch tier under 70 %: amber (the pace is the worry), with the projection note
        s = await paint(`{ ${COUNTER}, api: { limit: 300, used: 120, tier: 'watch', projected: 372, runOutDay: 25, checkedAt: ${ago(2)} } }`);
        assert.deepEqual([s.chip, s.chipColor, s.countColor], ['120/300', AMBER, AMBER], 'a pace that projects past the limit is amber at 40 %');
        assert.match(s.note, /คาดว่าสิ้นเดือน ~372 · จะเต็มวันที่ 25/);

        // fresh + critical: red, the headroom first, then the projection
        s = await paint(`{ ${COUNTER}, api: { limit: 300, used: 280, tier: 'critical', projected: 340, runOutDay: 28, checkedAt: ${ago(1)} } }`);
        assert.deepEqual([s.chip, s.chipColor, s.bar], ['280/300', RED, '93%']); assert.match(s.note, /^⚠️ 20 left this month/); assert.match(s.note, /คาดว่าสิ้นเดือน ~340 · จะเต็มวันที่ 28/);
        assert.equal(s.sendDisabled, false, 'not at the cap yet: Send digest stays on');

        // full: LINE's number decides the Send-digest gate even when our counter is far below
        s = await paint(`{ ${COUNTER}, api: { limit: 300, used: 300, tier: 'full', projected: 400, runOutDay: null, checkedAt: ${ago(1)} } }`);
        assert.deepEqual([s.chip, s.chipColor, s.atCap, s.sendDisabled, s.sendTitle], ['300/300', RED, true, true, 'Monthly LINE quota reached'], 'at LINE\'s cap the Send button is off though our counter says 12');

        // another plan size
        s = await paint(`{ ${COUNTER}, api: { limit: 1000, used: 41, tier: 'ok', projected: 120, checkedAt: ${ago(1)} } }`);
        assert.deepEqual([s.chip, s.bar], ['41/1000', '4%'], 'the limit is LINE\'s, not the hard-coded 300');

        // stale (> 36 h), an error-only block and an unlimited plan all fall back to the counter
        s = await paint(`{ ${COUNTER}, api: { limit: 300, used: 250, tier: 'critical', projected: 340, runOutDay: 28, checkedAt: ${ago(40)} } }`);
        assert.deepEqual([s.chip, s.chipColor, s.breakdown], ['12/300', GREEN, 'digest 10 · case 2'], 'a 40-hour-old LINE number is not trusted');
        s = await paint(`{ ${COUNTER}, api: { error: 'Authentication failed', errorAt: ${ago(1)} } }`); assert.equal(s.chip, '12/300', 'error-only block → counter');
        s = await paint(`{ ${COUNTER}, api: { limit: null, used: 900, tier: 'ok', checkedAt: ${ago(1)} } }`); assert.equal(s.chip, '12/300', 'unlimited plan (limit null) → counter');
        s = await paint(`{ ${COUNTER}, api: { limit: 300, used: 41, tier: 'ok', checkedAt: { seconds: Math.floor(Date.now() / 1000) - 600 } } }`); assert.equal(s.chip, '41/300', 'a plain {seconds} timestamp counts too');

        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: LINE chip + card — LINE\'s own count when fresh (<36 h): number, limit, colour of the worse tier, projection note, Send gate on LINE\'s cap; stale / error / unlimited → the project counter');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
