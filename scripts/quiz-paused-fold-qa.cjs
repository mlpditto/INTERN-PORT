// V102.235 — the Paused / Templates divider folds the whole Paused table + its pager. Default unfolded, remembered per browser, kept open while a search / filter is active.
// Real admin.html + the real renderQuizzesNow with fixture quizzes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const setup = async (page) => {
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
};
const load = async (page) => {
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => { try { renderQuizzesNow; return typeof renderQuizzesNow === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });   // the page's own top-level `let`s must be initialised before a render
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        const mk = (id, o) => Object.assign({ id, title: 'Quiz ' + id, shortTitle: id, isActive: false, questions: Array.from({ length: 15 }, () => ({ q: 'x', options: ['a', 'b'], correct: 0 })), tags: 'Diabetes', translations: { th: {} } }, o);
        const list = [mk('live1', { isActive: true, __d: Date.now() + 4 * 864e5 }), mk('p1', {}), mk('p2', {}), mk('p3', { isTemplate: true })];
        list.forEach((x, i) => { x.__c = 1000 + i; x.createdAt = { toMillis: () => x.__c, toDate: () => new Date(x.__c), seconds: x.__c }; if (x.__d != null) x.deadline = { toDate: () => new Date(x.__d), toMillis: () => x.__d }; });
        window.quizzesData = list; renderQuizzesNow();
        for (let n = document.getElementById('quiz-list-card'); n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.display = 'block';
        const pg = document.getElementById('inactive-quiz-pagination'); if (!pg.innerHTML.trim()) pg.innerHTML = '<span>1–3 of 3</span>';
    });
};
const state = (page) => page.evaluate(() => {
    const div = document.getElementById('section-inactive-quizzes'), disp = id => getComputedStyle(document.getElementById(id)).display;
    return { table: disp('quizzesTableInactive'), pager: disp('inactive-quiz-pagination'), aria: div.getAttribute('aria-expanded'), label: div.querySelector('.qd-t').textContent, forced: div.classList.contains('is-forced'), stored: (() => { try { return localStorage.getItem('quizPausedFolded'); } catch (_) { return 'blocked'; } })(), liveTable: disp('quizzesTableActive') };
});

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [1200, 390]) {
            const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } });
            const page = await ctx.newPage(); await setup(page); await load(page);

            // default: unfolded, nothing stored
            let s = await state(page);
            assert.equal(s.aria, 'true', 'default unfolded @' + vw); assert.equal(s.label, '▾ fold'); assert.notEqual(s.table, 'none', 'Paused table visible'); assert.notEqual(s.pager, 'none', 'pager visible'); assert.notEqual(s.stored, '1');

            // click folds: table + pager gone, Live untouched, choice stored
            await page.click('#section-inactive-quizzes'); s = await state(page);
            assert.equal(s.table, 'none', 'folded: Paused table hidden'); assert.equal(s.pager, 'none', 'folded: pager hidden'); assert.equal(s.aria, 'false'); assert.equal(s.label, '▸ show'); assert.equal(s.stored, '1', 'choice remembered'); assert.notEqual(s.liveTable, 'none', 'Live untouched');
            assert.equal(await page.evaluate(() => document.getElementById('inactive-count').textContent), '3', 'the count stays visible on the divider');

            // a re-render keeps it folded
            await page.evaluate(() => renderQuizzesNow()); s = await state(page); assert.equal(s.table, 'none', 're-render keeps the fold');

            // a search opens it (results are never hidden), clearing returns to folded; clicking while forced does nothing
            await page.evaluate(() => { const i = document.getElementById('quiz-search-global'); i.value = 'quiz'; renderQuizzesNow(); });
            s = await state(page); assert.notEqual(s.table, 'none', 'search: group opens by itself'); assert.equal(s.forced, true); assert.equal(s.label, 'open while filtering');
            await page.click('#section-inactive-quizzes'); s = await state(page); assert.notEqual(s.table, 'none', 'clicking while filtering changes nothing'); assert.equal(s.stored, '1', 'and does not touch the stored choice');
            await page.evaluate(() => { document.getElementById('quiz-search-global').value = ''; renderQuizzesNow(); });
            s = await state(page); assert.equal(s.table, 'none', 'search cleared: the fold choice is back'); assert.equal(s.forced, false);

            // a filter pill / system chip / style filter also opens it
            for (const [k, v] of [['currentQuizFilter', 'paused'], ['currentQuizSystem', 'gi'], ['currentQuizStyle', 'pebc']]) {
                const old = await page.evaluate(k2 => window[k2], k);
                await page.evaluate(([k2, v2]) => { window[k2] = v2; renderQuizzesNow(); }, [k, v]); s = await state(page); assert.notEqual(s.table, 'none', k + ' active: group open');
                await page.evaluate(([k2, o]) => { window[k2] = o; renderQuizzesNow(); }, [k, old]); s = await state(page); assert.equal(s.table, 'none', k + ' cleared: folded again');
            }

            // keyboard: Enter unfolds, Space folds
            await page.focus('#section-inactive-quizzes'); await page.keyboard.press('Enter'); s = await state(page); assert.notEqual(s.table, 'none', 'Enter unfolds'); assert.equal(s.stored, '0');
            await page.keyboard.press(' '); s = await state(page); assert.equal(s.table, 'none', 'Space folds');

            // reload: the choice survives
            await load(page); s = await state(page); assert.equal(s.table, 'none', 'remembered across a reload @' + vw); assert.equal(s.label, '▸ show');
            await ctx.close();
        }
        // blocked storage: folding still works in the session
        const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } }); const p2 = await ctx2.newPage(); await setup(p2);
        await load(p2);
        await p2.evaluate(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });   // blocked only AFTER the page booted (the page itself needs storage to start)
        await p2.click('#section-inactive-quizzes');
        assert.equal((await p2.evaluate(() => getComputedStyle(document.getElementById('quizzesTableInactive')).display)), 'none', 'blocked storage: fold still works');
        await ctx2.close();
        console.log('PASS: Paused / Templates fold — default open, click / Enter / Space fold the table + pager (Live untouched), remembered across reloads, a search / filter pill / system chip / style filter keeps it open, works with storage blocked, 1200 + 390px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
