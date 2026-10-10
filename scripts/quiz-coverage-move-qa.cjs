// V102.150: "Quiz Coverage by System" moved from the Dashboard sidebar into Assignments ▸ Quiz Engine.
// Static: the panel lives inside #subtab-quiz-engine (not in #dashboard-summary), the sidebar-only toggle / CSS / class are gone.
// Behaviour: the REAL renderQuizCoverage drawn into the REAL panel markup — every system card is visible (no more "Show all systems"),
// the sort / gap colour / Uncategorized card / summary line still work, and a card still opens the list.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

const quizTabStart = html.indexOf('<div id="subtab-quiz-engine"');
const quizTabEnd = html.indexOf('</div><!-- /subtab-quiz-engine -->');
const panelAt = html.indexOf('<details id="quiz-coverage-panel"');
assert.ok(quizTabStart > 0 && quizTabEnd > quizTabStart && panelAt > quizTabStart && panelAt < quizTabEnd, 'the panel is inside Assignments ▸ Quiz Engine');
assert.ok(panelAt < html.indexOf('id="quiz-search-global"'), 'and sits above the list toolbar');
const asideAt = html.indexOf('<aside id="dashboard-summary"');
const asideEnd = html.indexOf('</aside>', asideAt);
assert.ok(asideAt > 0 && !html.slice(asideAt, asideEnd).includes('quiz-coverage-panel') && !html.slice(asideAt, asideEnd).includes('qcov-'), 'the Dashboard sidebar no longer carries it');
assert.ok(html.slice(asideAt, asideEnd).includes('id="line-usage-panel"'), 'the LINE usage panel stays in the sidebar');
assert.equal((html.match(/id="quiz-coverage-panel"/g) || []).length, 1, 'one panel');
for (const gone of ['toggleQuizCoverageSummary', 'qcov-expand', 'qcov-extra', 'qcov-expanded', '#dashboard-summary #qcov-grid', '#dashboard-summary #quiz-coverage-panel'])
    assert.ok(!html.includes(gone), 'orphan removed: ' + gone);
assert.ok(/window\.renderQuizCoverage\(\);? \/\/ V95\.22/.test(html) || /if \(window\.renderQuizCoverage\) window\.renderQuizCoverage\(\); \/\/ V95\.22/.test(html), 'the quizzes snapshot still renders it');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const render = grab(html, 'window.renderQuizCoverage = function');
const panel = html.slice(panelAt, html.indexOf('</details>', panelAt) + '</details>'.length);

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><div id="subtab-quiz-engine">' + panel + '</div>');
        await page.addScriptTag({ content: [
            'var escapeHtml = function (s) { return String(s); };',
            'window._qcovSystems = [{ key: "heme", emoji: "🩸", label: { en: "Heme/Immune" } }, { key: "renal", emoji: "💧", label: { en: "Renal/Urinary" } }, { key: "ent", emoji: "👂", label: { en: "ENT" } }, { key: "gi", emoji: "🍽️", label: { en: "GI" } }, { key: "other", emoji: "📦", label: { en: "Other" } }];',
            'window.computeQuizCoverageBuckets = function () { return { heme: [1], renal: [1, 2], ent: [1, 2, 3], gi: [], other: [], __uncat: [1] }; };',
            'window.openQuizCoverageList = function (k) { window.__opened = k; };',
            'window.setQuizSystemFilter = function (k) { window.__filtered = k; };',   // V102.152: a system card filters the list (quiz-engine-pager-filter-qa.cjs covers that)
            render
        ].join(String.fromCharCode(10)) });
        await page.evaluate(() => window.renderQuizCoverage());

        const cards = await page.$$eval('#qcov-grid > div', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(cards, ['🍽️ GI 0', '📦 Other Miscellaneous (assigned) 0', '🩸 Heme/Immune 1', '💧 Renal/Urinary 2', '👂 ENT 3', '📥 Uncategorized Tap to assign 1'], 'sorted by count (gaps first), Uncategorized last: ' + JSON.stringify(cards));
        assert.equal(await page.$$eval('#qcov-grid > div', els => els.filter(e => getComputedStyle(e).display === 'none').length), 0, 'every card is visible — no "Show all systems" needed here');
        assert.equal(await page.locator('#qcov-expand').count(), 0, 'the expand button is gone');
        assert.equal(await page.$eval('#qcov-summary', e => e.textContent), '3/5 systems · 1 uncat');
        assert.equal(await page.$eval('#quiz-coverage-panel', e => e.open), true, 'open by default');
        const gap = await page.$eval('#qcov-grid > div', e => getComputedStyle(e).borderTopColor);
        assert.notEqual(gap, await page.$eval('#qcov-grid > div:nth-child(5)', e => getComputedStyle(e).borderTopColor), 'a gap card is coloured differently');
        await page.click('#qcov-grid > div:nth-child(5)');
        assert.equal(await page.evaluate(() => window.__filtered), 'ent', 'a card with quizzes filters the list (V102.152; it used to open the modal)');
        await page.click('#qcov-grid > div:nth-child(1)');
        assert.equal(await page.evaluate(() => window.__filtered), 'ent', 'a gap card (0 quizzes) is not clickable');
        await page.click('#qcov-grid > div:last-child');
        assert.equal(await page.evaluate(() => window.__opened), '__uncat', 'Uncategorized opens its list to assign');
        // columns adapt to the width (it used to be a fixed 4)
        const cols = w => page.setViewportSize({ width: w, height: 700 }).then(() => page.$eval('#qcov-grid', g => getComputedStyle(g).gridTemplateColumns.split(' ').length));
        assert.ok((await cols(1000)) >= 4 && (await cols(360)) <= 2, 'responsive columns');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Quiz Coverage lives in Assignments ▸ Quiz Engine — all systems visible, gaps first, Uncategorized + summary, cards filter the list; gone from the Dashboard sidebar');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
