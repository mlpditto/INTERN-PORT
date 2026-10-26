// V102.234 — chips under the quiz title: ALL of them show when the line has room; only when it does not do the lowest-priority ones fold into a "+n" button
// (hover = names, tap = unfold in place). Real admin.html + the real renderQuizzesNow with fixture quizzes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.evaluate(() => {
            const mk = (id, o) => Object.assign({ id, title: 'Quiz ' + id, shortTitle: id, isActive: false, questions: Array.from({ length: 15 }, () => ({ q: 'x', options: ['a', 'b'], correct: 0 })), tags: 'Diabetes', translations: { th: {} } }, o);
            const list = [
                mk('busy', { isTemplate: true, oneTimeMode: true, targetGroup: 'RSU', unlockScore: 20, examStyle: 'pebc', materials: [{ name: 'Slides', url: 'https://example.com/a.pdf' }, { name: 'Guide', url: 'https://example.com/b.pdf' }], isPoll: true }),
                mk('plain', {}),
            ];
            list.forEach((x, i) => { x.__c = 1000 + i; x.createdAt = { toMillis: () => x.__c, toDate: () => new Date(x.__c), seconds: x.__c }; });
            window.quizzesData = list; renderQuizzesNow();
            // the bare page keeps the Assignments tab hidden — make the list card measurable without touching its own rules
            for (let n = document.getElementById('quiz-list-card'); n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.display = 'block';
            window.qaFitChips();
        });
        // resize → the fit runs from a ResizeObserver + rAF, so wait for the expected state instead of a fixed sleep (a slow runner read the row before it re-fitted)
        const settle = async (w, expectPlus) => {
            await page.setViewportSize({ width: w, height: 900 });
            if (expectPlus !== undefined) await page.waitForFunction(want => { const row = [...document.querySelectorAll('#quizzesTableInactive tbody tr')].find(t => t.querySelector('#fb-badge-busy')); return !!row.querySelector('.qa-plus') === want; }, expectPlus, { timeout: 10000 });
            await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        };
        // the fit re-creates the "+n" button on every pass, so a real mouse click can land on a node that was just replaced — tap it from inside the page and wait for the new state
        const tapPlus = async open => {
            await page.evaluate(() => document.querySelector('#quizzesTableInactive .qa-plus').click());
            await page.waitForFunction(want => { const b = document.querySelector('#quizzesTableInactive .qa-plus'); return !!b && (b.textContent === '−') === want; }, open, { timeout: 10000 });
        };
        const snap = () => page.evaluate(() => {
            const rowOf = id => [...document.querySelectorAll('#quizzesTableInactive tbody tr')].find(t => t.querySelector('#fb-badge-' + id));
            const info = id => {
                const l2 = rowOf(id).querySelector('.qa-l2');
                const chips = [...l2.children].filter(c => c.getAttribute('data-qp'));
                const vis = chips.filter(c => getComputedStyle(c).display !== 'none');
                const plus = l2.querySelector('.qa-plus');
                return {
                    total: chips.length, visible: vis.length, plus: plus ? plus.textContent : null, plusTitle: plus ? plus.title : '', h: Math.round(l2.getBoundingClientRect().height), avail: l2.clientWidth,
                    usedW: Math.round(vis.reduce((a, c) => a + c.getBoundingClientRect().width + 4, 0) + (plus ? plus.getBoundingClientRect().width : 0)),
                    feedbackVisible: vis.some(c => /fb-badge/.test(c.id)), auditVisible: vis.some(c => /🧪|audit/i.test(c.textContent + c.getAttribute('title'))), open: l2.classList.contains('is-open'),
                    qps: vis.map(c => +c.getAttribute('data-qp')),
                };
            };
            return { busy: info('busy'), plain: info('plain') };
        });

        // 1 · wide: everything fits → every chip shows, no "+n"
        let r = await snap();
        assert.ok(r.busy.total >= 9, 'the crowded fixture really has many chips: ' + r.busy.total);
        assert.equal(r.busy.plus, null, 'wide: no "+n" when the line has room'); assert.equal(r.busy.visible, r.busy.total, 'wide: every chip is shown');
        assert.ok(r.busy.h < 40, 'wide: the chips stay on one line: ' + r.busy.h);
        assert.equal(r.plain.plus, null, 'plain quiz: never a "+n"');

        // 2 · narrow (same page, resized): the lowest priorities fold, ⭐ and 🧪 stay, nothing overflows the line
        await settle(390, true);
        r = await snap();
        assert.ok(r.busy.plus && /^\+[IVXLCDM]+$/.test(r.busy.plus), 'phone: the "+n" button counts in Roman numerals: ' + r.busy.plus);
        const nHidden = await page.evaluate(() => [...document.querySelectorAll('#quizzesTableInactive .qa-l2')].map(l => [...l.children].filter(c => c.getAttribute('data-qp') && c.classList.contains('qa-hid')).length).find(x => x > 0));
        assert.equal(r.busy.visible + nHidden, r.busy.total, 'narrow: visible + hidden = all chips'); assert.equal(await page.evaluate(n => window.qaRoman(n), nHidden), r.busy.plus.slice(1), 'the numeral matches the hidden count');
        assert.ok(r.busy.feedbackVisible && r.busy.auditVisible, 'narrow: ⭐ feedback and 🧪 audit always stay');
        assert.ok(r.busy.usedW <= r.busy.avail + 2, 'narrow: what is shown fits the line: ' + r.busy.usedW + ' vs ' + r.busy.avail);
        assert.ok(r.busy.plusTitle.split(' · ').length >= nHidden && new RegExp('Show ' + nHidden + ' more').test(r.busy.plusTitle), 'narrow: hover lists the hidden chips, with plain digits: ' + r.busy.plusTitle);
        assert.equal(r.plain.plus, null, 'narrow: the 4-chip plain quiz still has no "+n"');

        for (const [n, roman] of [[1, 'I'], [4, 'IV'], [5, 'V'], [9, 'IX'], [11, 'XI'], [14, 'XIV'], [40, 'XL'], [1994, 'MCMXCIV']]) assert.equal(await page.evaluate(x => window.qaRoman(x), n), roman, 'qaRoman(' + n + ')');
        // 3 · tap unfolds every chip in place, tap again folds
        await tapPlus(true);
        r = await snap();
        assert.equal(r.busy.visible, r.busy.total, 'unfolded: every chip visible'); assert.equal(r.busy.plus, '−', 'unfolded: the button becomes −'); assert.equal(r.busy.open, true);
        await tapPlus(false);
        r = await snap();
        assert.ok(r.busy.visible < r.busy.total && /^\+[IVXLCDM]+$/.test(r.busy.plus), 'folded again');

        // 3b · tablet width (>480px, narrow card): Arabic digits again
        await settle(640); await page.waitForFunction(() => [...document.querySelectorAll('#quizzesTableInactive .qa-plus')].every(b => /^\+\d+$/.test(b.textContent)), null, { timeout: 10000 });
        r = await snap();
        if (r.busy.plus) assert.ok(/^\+\d+$/.test(r.busy.plus), 'above 480px the count is Arabic: ' + r.busy.plus);
        // 4 · wide again → back to everything, no "+n"
        await settle(1600, false);
        r = await snap();
        assert.equal(r.busy.plus, null, 'back to wide: "+n" gone'); assert.equal(r.busy.visible, r.busy.total, 'back to wide: all chips shown');
        console.log('PASS: Quiz chips — all shown when the line has room (1600px), lowest priorities fold into "+n" only when they do not fit (390px: Roman numeral +V, Arabic above 480px; ⭐ 🧪 stay, hover lists, tap unfolds), plain quiz never folds, follows resize');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
