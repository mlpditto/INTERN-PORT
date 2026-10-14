// V102.232 — Quiz Engine row tools: on wide screens (>1100px) 👥 📖 + the ⋯ actions are ONE icon grid (4 per row, no dropdown); at <=1100px the grid folds back into the ⋯ menu.
// Real admin.html + the real renderQuizzesNow with fixture quizzes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [1200, 1000, 390]) {
            const wide = vw > 1100;
            const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
            await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
            await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
            await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
            const r = await page.evaluate(() => {
                const mk = (id, o) => Object.assign({ id, title: 'Quiz ' + id, shortTitle: id, isActive: false, questions: Array.from({ length: 15 }, () => ({ q: 'x', options: ['a', 'b'], correct: 0 })), tags: 'Diabetes', translations: { th: {} } }, o);
                const list = [mk('p1', { isHomework: true, assignedUsers: ['a', 'b'] }), mk('t1', { isTemplate: true })];
                list.forEach((x, i) => { x.__c = 1000 + i; x.createdAt = { toMillis: () => x.__c, toDate: () => new Date(x.__c), seconds: x.__c }; });
                window.quizzesData = list;
                try { renderQuizzesNow(); } catch (e) { return { err: String(e && e.message || e) }; }
                for (let n = document.getElementById('quizzesTableInactive'); n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.display = 'block';
                const rows = [...document.querySelectorAll('#quizzesTableInactive tbody tr')].filter(t => !/pointer-events/.test(t.getAttribute('style') || ''));
                const info = rows.map(row => {
                    const vis = el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
                    const tx = [...row.querySelectorAll('.qa-tools .qa-tx')];
                    const all = [...row.querySelectorAll('.qa-tools .qa-ib')];
                    const more = row.querySelector('.qa-more-narrow');
                    return {
                        txLabels: tx.map(b => b.getAttribute('aria-label')), txVisible: tx.filter(vis).length, allVisible: all.filter(vis).length,
                        moreVisible: !!vis(more), moreItems: [...row.querySelectorAll('.qa-more-narrow .quiz-more-menu-item')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
                        tops: [...new Set(all.filter(vis).map(b => Math.round(b.getBoundingClientRect().top)))].length, firstRowCount: (() => { const v = all.filter(vis); if (!v.length) return 0; const t0 = Math.round(v[0].getBoundingClientRect().top); return v.filter(b => Math.round(b.getBoundingClientRect().top) === t0).length; })(),
                        homeworkSet: !!row.querySelector('.qa-tools .qa-ib.is-set[aria-label="Assign homework"]'), templateSet: !!row.querySelector('.qa-tools .qa-tx.is-set'),
                        deleteDanger: !!row.querySelector('.qa-tools .qa-tx.is-danger[aria-label="Delete Quiz"]'),
                    };
                });
                return { info };
            });
            assert.ok(!r.err, 'renderQuizzesNow threw: ' + r.err);
            assert.equal(r.info.length, 2, 'two paused/template rows @' + vw);
            for (const [i, x] of r.info.entries()) {
                for (const must of ['Duplicate', 'Discussion Board', 'User Feedback', 'Delete Quiz']) assert.ok(x.txLabels.includes(must), 'tool "' + must + '" is an icon in the grid @' + vw);
                assert.ok(x.txLabels.some(l => /Template/.test(l)), 'the template toggle is an icon');
                assert.ok(x.moreItems.some(t => /Duplicate/.test(t)) && x.moreItems.some(t => /Delete Quiz/.test(t)), 'the ⋯ menu still carries every action (narrow screens)');
                if (wide) {
                    assert.equal(x.moreVisible, false, 'wide: no ⋯ dropdown @' + vw);
                    assert.ok(x.txVisible >= 5, 'wide: the tool icons are visible: ' + x.txVisible); assert.equal(x.firstRowCount, 4, 'wide: 4 icons on the first row (4+4 grid)'); assert.ok(x.tops >= 2, 'wide: the grid wraps onto a second row');
                } else {
                    assert.equal(x.txVisible, 0, 'narrow: the extra tool icons fold away @' + vw); assert.equal(x.moreVisible, true, 'narrow: the ⋯ menu is back @' + vw);
                    assert.equal(x.allVisible, 2, 'narrow: 👥 and 📖 stay in the rail @' + vw);
                }
            }
            assert.equal(r.info.filter(x => x.homeworkSet).length, 1, '📖 keeps its green "homework set" state on the homework quiz only'); assert.equal(r.info.filter(x => x.templateSet).length, 1, '📌 shows green on the template only');
            if (wide) {
                // clicking an icon calls the same handler the ⋯ item did
                await page.evaluate(() => { window.__calls = []; ['duplicateQuiz', 'showQuizDiscussions', 'showQuizFeedbackPanel', 'deleteQuiz', 'toggleTemplateStatus'].forEach(n => { window[n] = (...a) => window.__calls.push(n + ':' + a.join(',')); }); });
                const row = page.locator('#quizzesTableInactive tbody tr').filter({ hasText: 'Quiz p1' }).first();
                for (const label of ['Duplicate', 'Discussion Board', 'User Feedback', 'Delete Quiz', 'Mark as Template']) await row.locator('.qa-tools .qa-tx[aria-label="' + label + '"]').click();
                assert.deepEqual(await page.evaluate(() => window.__calls), ['duplicateQuiz:p1', 'showQuizDiscussions:p1', 'showQuizFeedbackPanel:p1', 'deleteQuiz:p1', 'toggleTemplateStatus:p1,false'], 'each icon calls its handler with the quiz id');
            }
            await page.close();
        }
        console.log('PASS: Quiz row tools — >1100px: 👥 📖 + 🎓/♻️/💬/⭐/📌/🗑 are one quiet icon grid (4+4, no dropdown, handlers + green states intact); <=1100px and phone: the grid folds back into the ⋯ menu');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
