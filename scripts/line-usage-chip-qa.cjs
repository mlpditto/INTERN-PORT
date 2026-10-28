// V102.163: the LINE push quota card moved from the Dashboard sidebar (now gone) into the board toolbar: a chip "✈ 12/300" next to the
// search box, tap → the full card (breakdown, Preview digest → Send / Copy) folds out under the toolbar. loadLineUsage paints chip + card.
// Static pins + the REAL toggleLineUsagePop / loadLineUsage with a fake Firestore.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('<aside id="dashboard-summary"'), 'the sidebar is gone');
assert.equal((html.match(/id="line-usage-panel"/g) || []).length, 1, 'one LINE panel');
const chipAt = html.indexOf('id="line-usage-chip"'), popAt = html.indexOf('<div id="line-usage-pop"'), searchAt = html.indexOf('id="board-search"'), tabsAt = html.indexOf('<!-- V102.163: the LINE push card, folded under the toolbar chip -->'), wsAt = html.indexOf('<div id="dashboard-workspace">');
assert.ok(searchAt < chipAt && chipAt < tabsAt, 'the chip sits in the toolbar after the search box (V102.239: the group-chip rail is gone from the Dashboard)');
assert.ok(!html.includes('id="board-group-tabs"') && !/function renderBoardGroupTabs|function setBoardGroupFilter/.test(html), 'V102.239: no group-chip rail on the Dashboard');
assert.ok(tabsAt < popAt && popAt < wsAt && html.indexOf('id="line-usage-panel"') > popAt && html.indexOf('id="line-usage-panel"') < wsAt, 'the card is inside the popover, under the toolbar, above the workspace');
assert.ok(html.includes("grid-template-columns:minmax(0,1fr); gap:20px"), 'one-column workspace');
for (const id of ['line-usage-count', 'line-usage-breakdown', 'line-digest-preview-btn', 'line-usage-bar', 'line-usage-note', 'line-digest-now-status', 'line-digest-preview-box', 'line-digest-now-btn']) assert.ok(html.includes('id="' + id + '"'), 'card keeps #' + id);
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const tbStart = html.indexOf('<div class="stat-chips"');   // V102.459: the search + LINE chip moved into the chip row
const markup = html.slice(tbStart, wsAt);
const code = ['window.toggleLineUsagePop = function', 'window.loadLineUsage = async function'].map(m => grab(html, m)).join(';\n');
const consts = html.match(/const LINE_MONTHLY_QUOTA = \d+;/)[0] + html.match(/const LINE_COUNT_START_MONTH = '[^']+';/)[0] + grab(html, 'const LINE_TAG_LABELS = ').replace(/^const LINE_TAG_LABELS = /, 'const LINE_TAG_LABELS = ') + ';';
const listeners = html.slice(html.indexOf("document.addEventListener('click', e => {\n                const pop = document.getElementById('line-usage-pop')"), html.indexOf("window.loadLineUsage = async function"));

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--primary:#4361ee}#line-usage-pop[hidden]{display:none}</style><div id="outside" style="height:40px">x</div>' + markup);
        await page.addScriptTag({ content: [
            'var __docs = { "line_usage/2026-10": { total: 12, byTag: { notifyQuizDigest: 10, floodAlert: 2 } } };',
            'var db = { collection: c => ({ doc: id => ({ get: async () => ({ exists: !!__docs[c + "/" + id], data: () => __docs[c + "/" + id] }) }) }) };',
            'function filterBoard() {} function previewDigest() {} function sendDigestNow() {} function copyDigestText() {} function closeDigestPreview() {}',
            consts, code, listeners
        ].join('\n') });
        const vis = sel => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);
        assert.equal(await vis('#line-usage-pop'), false, 'folded at first');
        assert.equal(await page.$eval('#line-usage-chip-n', e => e.textContent), '–/300', 'chip placeholder before the first load');
        await page.evaluate(() => { const d = new Date(); __docs['line_usage/' + d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(0, 7)] = __docs['line_usage/2026-10']; });
        await page.evaluate(() => window.loadLineUsage());
        assert.equal(await page.$eval('#line-usage-chip-n', e => e.textContent), '12/300', 'chip shows the month count');
        assert.equal(await page.$eval('#line-usage-chip-n', e => e.style.color), await page.$eval('#line-usage-count', e => e.style.color), 'chip colour = card colour');
        assert.equal(await vis('#line-usage-pop'), false, 'loading does not open it');
        await page.click('#line-usage-chip');
        assert.equal(await vis('#line-usage-pop'), true, 'tap opens the card');
        assert.equal(await page.$eval('#line-usage-chip', e => e.getAttribute('aria-expanded')), 'true');
        assert.equal(await vis('#line-usage-panel'), true, 'the real panel is shown inside');
        assert.equal(await page.$eval('#line-usage-count', e => e.textContent), '12/300');
        await page.click('#line-usage-chip');
        assert.equal(await vis('#line-usage-pop'), false, 'tap again folds it');
        await page.click('#line-usage-chip'); await page.click('#outside');
        assert.equal(await vis('#line-usage-pop'), false, 'outside click folds it');
        await page.click('#line-usage-chip'); await page.keyboard.press('Escape');
        assert.equal(await vis('#line-usage-pop'), false, 'Esc folds it');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: LINE pushes chip in the board toolbar — count + colour from loadLineUsage, tap/again/outside/Esc fold the real card, sidebar gone, ids kept');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
