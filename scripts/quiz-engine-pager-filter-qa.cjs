// V102.152: Quiz Engine — numbered pager ("1–10 of 153", 1 … 6 7 8 … 16) and the Coverage-by-System chips as a LIST FILTER.
// Static: the filter is read by renderQuizzesNow next to the exam-style filter, the bar sits above Active Quizzes (inline display, not [hidden]), the pager is the new function.
// Behaviour: the REAL quizPagerHtml / quizSystemIds / setQuizSystemFilter / renderQuizSystemFilterBar / renderQuizCoverage in a browser with stubbed data.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('const sysIds = window.quizSystemIds();') && html.includes('if (sysIds && !sysIds.has(q.id)) return;'), 'renderQuizzesNow filters by the chosen system');
assert.ok(html.indexOf('if (sysIds && !sysIds.has(q.id)) return;') > html.indexOf("if (window.currentQuizStyle && (q.examStyle || '__none') !== window.currentQuizStyle) return;"), 'next to the exam-style filter');
assert.ok(html.includes('paginContainer.innerHTML = quizPagerHtml(inactiveQuizPage, totalInactivePages, sortedInactive.length, INACTIVE_QUIZ_PER_PAGE);'), 'pager uses the new function');
assert.ok(!html.includes('>Prev</button>') || !/Page \$\{inactiveQuizPage\} \//.test(html), 'old Prev / Page n / Next text is gone');
assert.ok(html.includes('if (window.renderQuizSystemFilterBar) window.renderQuizSystemFilterBar(activeCount + inactiveCount);'), 'the bar follows the filtered count');
const barAt = html.indexOf('id="quiz-system-filter-bar"');
assert.ok(barAt > html.indexOf('id="quiz-search-global"') && barAt < html.indexOf('id="section-active-quizzes"'), 'the bar sits between the toolbar and Active Quizzes');
assert.ok(/id="quiz-system-filter-bar" style="display:none;/.test(html) && !/id="quiz-system-filter-bar"[^>]*\shidden/.test(html), 'hidden by inline display:none (an inline display would beat [hidden])');
assert.ok(!html.includes("onclick=\"window.openQuizCoverageList('${s.key}')\""), 'a system chip no longer opens the modal');
assert.ok(html.includes("window.openQuizCoverageList('__uncat')"), 'Uncategorized still opens the assign list');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const code = [
    grab(html, 'function goInactiveQuizPage('), grab(html, 'function changeInactiveQuizPage('), grab(html, 'function quizPagerHtml('),
    grab(html, 'window.quizSystemIds = function'), grab(html, 'window.setQuizSystemFilter = function'), grab(html, 'window.renderQuizSystemFilterBar = function'),
    grab(html, 'window.renderQuizCoverage = function')
].join(';\n');
const panel = html.slice(html.indexOf('<details id="quiz-coverage-panel"'), html.indexOf('</details>', html.indexOf('<details id="quiz-coverage-panel"')) + 10);
const bar = html.slice(html.lastIndexOf('<div', barAt), html.indexOf('</div>', barAt) + 6);

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--primary:#4361ee}</style><div id="subtab">' + panel + bar + '<div id="inactive-quiz-pagination"></div></div>');
        await page.addScriptTag({ content: [
            'var inactiveQuizPage = 1, __renders = 0, __opened = null; function renderQuizzes() { __renders++; }',
            'var escapeHtml = function (s) { return String(s); };',
            'window._qcovSystems = [{ key: "heme", emoji: "🩸", label: { en: "Heme/Immune" } }, { key: "renal", emoji: "💧", label: { en: "Renal/Urinary" } }, { key: "gi", emoji: "🍽️", label: { en: "GI" } }, { key: "other", emoji: "📦", label: { en: "Other" } }];',
            'window.computeQuizCoverageBuckets = function () { return { heme: [{ id: "q1" }], renal: [{ id: "q2" }, { id: "q3" }], gi: [], other: [], __uncat: [{ id: "q9" }] }; };',
            'window.openQuizCoverageList = function (k) { __opened = k; };',
            code
        ].join('\n') });

        // ---- pager ----
        const draw = (p, t, c) => page.evaluate(([p, t, c]) => { document.getElementById('inactive-quiz-pagination').innerHTML = quizPagerHtml(p, t, c, 10); return null; }, [p, t, c]);
        const read = () => page.$eval('#inactive-quiz-pagination', e => ({ text: [...e.children].map(c => c.textContent).join(' '), cur: [...e.querySelectorAll('[aria-current]')].map(b => b.textContent), dis: [...e.querySelectorAll('button:disabled')].map(b => b.textContent) }));
        await draw(1, 16, 153);
        let r = await read();
        assert.equal(r.text, '1–10 of 153 ‹ 1 2 … 16 ›', 'page 1 of 16: ' + r.text);
        assert.deepEqual(r.cur, ['1']); assert.deepEqual(r.dis, ['‹'], 'no previous on page 1');
        await draw(7, 16, 153); r = await read();
        assert.equal(r.text, '61–70 of 153 ‹ 1 … 6 7 8 … 16 ›', r.text); assert.deepEqual(r.cur, ['7']); assert.deepEqual(r.dis, []);
        await draw(16, 16, 153); r = await read();
        assert.equal(r.text, '151–153 of 153 ‹ 1 … 15 16 ›', 'the last page ends at the real count: ' + r.text); assert.deepEqual(r.dis, ['›'], 'no next on the last page');
        await draw(3, 4, 40); r = await read();
        assert.equal(r.text, '21–30 of 40 ‹ 1 2 3 4 ›', 'no ellipsis when nothing is skipped: ' + r.text);
        await draw(1, 1, 0); r = await read();
        assert.equal(r.text, '0–0 of 0 ‹ 1 ›', 'an empty list: ' + r.text);
        // buttons drive the page and re-render
        await draw(7, 16, 153);
        await page.click('#inactive-quiz-pagination button:has-text("8")');
        assert.deepEqual(await page.evaluate(() => [inactiveQuizPage, __renders]), [8, 1], 'a number goes straight to that page');
        await page.evaluate(() => { inactiveQuizPage = 8; });
        await draw(8, 16, 153);
        await page.click('#inactive-quiz-pagination button:has-text("›")');
        assert.equal(await page.evaluate(() => inactiveQuizPage), 9, '› is next');
        await page.click('#inactive-quiz-pagination button:has-text("‹")');
        assert.equal(await page.evaluate(() => inactiveQuizPage), 8, '‹ is previous');

        // ---- Coverage chips as a filter ----
        await page.evaluate(() => window.renderQuizCoverage());
        const chip = label => page.locator('#qcov-grid > div', { hasText: label }).first();
        const frame = el => el.evaluate(e => e.style.boxShadow);
        assert.equal(await page.evaluate(() => window.quizSystemIds()), null, 'no system = no filter');
        assert.equal(await page.$eval('#quiz-system-filter-bar', e => getComputedStyle(e).display), 'none', 'bar hidden at first');
        await page.evaluate(() => { __renders = 0; });
        await chip('Renal/Urinary').click();
        assert.equal(await page.evaluate(() => window.currentQuizSystem), 'renal');
        assert.deepEqual(await page.evaluate(() => [...window.quizSystemIds()]), ['q2', 'q3'], 'the filter is the chip\'s own bucket');
        assert.equal(await page.evaluate(() => [inactiveQuizPage, __renders]).then(a => a[0]), 1, 'back to page 1');
        assert.ok(await page.evaluate(() => __renders) >= 1, 'the lists re-render');
        assert.notEqual(await frame(chip('Renal/Urinary')), '', 'the chosen chip is framed');
        assert.equal(await frame(chip('Heme/Immune')), '', 'the others are not');
        assert.equal(await page.evaluate(() => __opened), null, 'a chip no longer opens the modal');
        await page.evaluate(() => window.renderQuizSystemFilterBar(2));
        assert.equal(await page.$eval('#quiz-system-filter-bar', e => getComputedStyle(e).display), 'flex', 'bar shown');
        let bt = await page.$eval('#quiz-system-filter-bar', e => e.innerText.replace(/\s+/g, ' ').trim());
        assert.ok(bt.startsWith('💧 Renal/Urinary 2 quizzes') && bt.includes('Manage categories…'), bt);
        await page.evaluate(() => window.renderQuizSystemFilterBar(1));
        assert.ok((await page.$eval('#quiz-system-filter-bar', e => e.innerText)).includes('1 quiz') && !(await page.$eval('#quiz-system-filter-bar', e => e.innerText)).includes('1 quizzes'), 'singular');
        await page.click('#quiz-system-filter-bar a');
        assert.equal(await page.evaluate(() => __opened), 'renal', 'Manage categories… opens the old list for the chosen system');
        // another chip switches; the same chip again clears
        await chip('Heme/Immune').click();
        assert.equal(await page.evaluate(() => window.currentQuizSystem), 'heme', 'another chip switches the filter');
        assert.notEqual(await frame(chip('Heme/Immune')), ''); assert.equal(await frame(chip('Renal/Urinary')), '');
        await chip('Heme/Immune').click();
        assert.equal(await page.evaluate(() => window.currentQuizSystem), '', 'the same chip again clears it');
        await page.evaluate(() => window.renderQuizSystemFilterBar(5));
        assert.equal(await page.$eval('#quiz-system-filter-bar', e => getComputedStyle(e).display), 'none', 'bar hides when cleared');
        // × clears too
        await chip('Renal/Urinary').click();
        await page.evaluate(() => window.renderQuizSystemFilterBar(2));
        await page.click('#quiz-system-filter-bar button[aria-label="Clear filter"]');
        assert.equal(await page.evaluate(() => window.currentQuizSystem), '', '× clears the filter');
        // gap chip (0 quizzes) is not clickable; Uncategorized still opens the assign list
        await page.evaluate(() => { __opened = null; });
        await chip('GI').click({ force: true });
        assert.equal(await page.evaluate(() => window.currentQuizSystem), '', 'a gap chip does nothing');
        await page.locator('#qcov-grid > div', { hasText: 'Uncategorized' }).click();
        assert.equal(await page.evaluate(() => __opened), '__uncat', 'Uncategorized still opens the assign list');
        assert.equal(await page.evaluate(() => window.currentQuizSystem), '', 'and is not a filter');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Quiz Engine numbered pager (counter, ellipses, ‹ ›, empty/last page) + Coverage chips as a list filter (frame, bar, clear, Manage categories, gap + Uncategorized unchanged)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
