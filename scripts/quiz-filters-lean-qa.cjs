// V102.196 — Quiz Engine toolbar: icon-only pills + hover, counts on the pills (no Audited / Tags status chips), sort = one cycling icon button,
// Style / Tags / Tag hygiene folded behind one button (closed by default), "#" searches tags only. The REAL page + real renderQuizzesNow in Chromium.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');

// static contract
assert.ok(!html.includes('id="quiz-audit-stat"') && !html.includes('id="quiz-tag-stat"'), 'the two status chips are gone (their numbers ride on the pills)');
assert.ok(!html.includes('id="quiz-sort-select"'), 'the sort dropdown is gone');
assert.ok(/id="quiz-more-filters"[^>]*display:none/.test(html), 'Style · Tags · Tag hygiene start folded');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        // the toolbar lives in Assignments ▸ Quiz Engine: open that tab so the buttons are clickable (not logged in — the tab switchers are plain DOM code)
        await page.evaluate(() => { try { switchTab('assignments'); } catch (e) { /* ignore */ } try { switchAssignmentsSubtab('subtab-quiz-engine'); } catch (e) { /* ignore */ }
            // the login gate keeps the app hidden: force the toolbar's ancestors visible so real clicks work
            ['quiz-sort-btn', 'quiz-more-btn', 'quiz-hyg-badge'].forEach(id => { let e = document.getElementById(id); while (e && e !== document.documentElement) { if (getComputedStyle(e).display === 'none') e.style.setProperty('display', 'block', 'important'); e.hidden = e.id === 'quiz-hyg-badge' ? false : e.hidden; e = e.parentElement; } });
        });
        const mk = (id, over) => Object.assign({ id, title: 'Quiz ' + id, shortTitle: id, isActive: false, questions: [{ q: 'x', options: ['a', 'b'], correct: 0 }], tags: 'Diabetes', translations: { th: {} }, __c: 1 }, over);
        const run = list => page.evaluate(l => {
            l.forEach(q => { q.createdAt = { toMillis: () => q.__c, toDate: () => new Date(q.__c), seconds: q.__c }; });
            quizzesData = l;
            try { renderQuizzesNow(); } catch (e) { return { err: String(e && e.message || e) }; }
            const pill = f => { const b = document.querySelector(`#quiz-filter-pills [data-filter="${f}"]`); const n = b && b.querySelector('.qf-n'); return { text: b ? b.textContent.trim() : null, n: n && !n.hidden ? n.textContent : '', title: b ? b.title : null }; };
            const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; };
            return {
                unaudited: pill('unaudited'), incomplete: pill('tagsincomplete'), ai: vis('quiz-ai-tag-btn') ? document.getElementById('quiz-ai-tag-btn').textContent.trim() : '',
                styleRail: vis('quiz-style-pills'), styleText: document.getElementById('quiz-style-pills').textContent.replace(/\s+/g, ' ').trim(),
                tagChips: [...document.querySelectorAll('#quiz-tag-chips .badge')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
                hyg: (document.getElementById('quiz-hyg-badge').textContent || '').trim(), hygWarn: !!document.querySelector('#quiz-hyg-badge .qf-ok.warn'),
                rows: [...document.querySelectorAll('#quizzesTableInactive tbody tr, #quizzesTableActive tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ')).join(' | ')
            };
        }, list);

        // ---- counts on the pills, AI-tag button, hygiene OK ----
        const eight = 'Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta';
        let r = await run([mk('a', { tags: eight }), mk('b', { tags: 'Alpha' }), mk('c', { tags: 'Beta' })]);
        assert.ok(!r.err, 'renderQuizzesNow threw: ' + r.err);
        assert.equal(r.unaudited.n, '3', '3 quizzes never audited → the 🧪 pill carries 3'); assert.match(r.unaudited.title, /3 of 3 quizzes never audited/);
        assert.equal(r.unaudited.text.replace(/\d+$/, '').trim(), '🧪', 'icon-only pill (the count is the only text)');
        assert.ok(r.incomplete.n !== '' && /^🏷️/.test(r.incomplete.text), 'incomplete pill shows its count: ' + JSON.stringify(r.incomplete));
        assert.match(r.ai, /✨\s*\d+/, 'the AI-tag-all button appears with the count while something is incomplete: ' + r.ai);
        assert.equal(r.styleRail, false, 'no style rail with fewer than two styles');
        assert.equal(r.tagChips.length, 7, 'six tags + the "+N ⌕" chip: ' + r.tagChips); assert.match(r.tagChips[6], /^\+2/, '8 distinct tags − 6 shown = +2');
        assert.match(r.hyg, /^🏷️ OK · \d+$/, 'hygiene OK badge: ' + r.hyg); assert.equal(r.hygWarn, false);
        // ---- hygiene warn when spelling drifts ----
        r = await run([mk('a', { tags: 'Headache' }), mk('b', { tags: 'headache' })]);
        assert.equal(r.hygWarn, true, 'case variants → the badge warns'); assert.match(r.hyg, /^⚠ \d+$/);
        // ---- style rail: needs two styles; "none" hidden ----
        r = await run([mk('a', { examStyle: 'kokushi' }), mk('b', { examStyle: 'pebc1' }), mk('c', {})]);
        assert.equal(r.styleRail, true, 'two styles → the rail shows'); assert.ok(!/none/.test(r.styleText), 'no "— none" pill unless it is the selected one');
        r = await run([mk('a', { examStyle: 'kokushi' }), mk('c', {})]);
        assert.equal(r.styleRail, false, 'one style only → hidden');

        // ---- sort: one cycling icon button ----
        const sort = () => page.evaluate(() => ({ s: window.currentQuizSort, title: document.getElementById('quiz-sort-btn').title, icon: document.querySelector('#quiz-sort-btn i').className }));
        let s = await sort(); assert.equal(s.s, 'newest'); assert.match(s.title, /^Sort: Newest first — tap for A → Z$/);
        const seen = [s.s];
        for (let i = 0; i < 4; i++) { await page.click('#quiz-sort-btn'); s = await sort(); seen.push(s.s); }
        assert.equal(JSON.stringify(seen), JSON.stringify(['newest', 'az', 'submissions', 'audit', 'newest']), 'newest → A–Z → most submissions → audit → newest');
        await page.click('#quiz-sort-btn'); s = await sort(); assert.match(s.icon, /fa-arrow-down-a-z/); assert.match(s.title, /A → Z — tap for Most submissions/);

        // ---- "#" = tags only ----
        await run([mk('t1', { title: 'Headache guide', tags: 'Cardio' }), mk('t2', { title: 'Plain', tags: 'Headache' })]);
        const rowsFor = async q => { await page.evaluate(v => { document.getElementById('quiz-search-global').value = v; renderQuizzesNow(); }, q); return page.evaluate(() => [...document.querySelectorAll('#quizzesTableInactive tbody tr, #quizzesTableActive tbody tr')].map(r => r.textContent).join(' | ')); };
        let txt = await rowsFor('head');
        assert.ok(/Headache guide/.test(txt) && /Plain/.test(txt), 'plain search matches title OR tags');
        txt = await rowsFor('#head');
        assert.ok(!/Headache guide/.test(txt) && /Plain/.test(txt), '"#head" matches tags only: ' + txt.slice(0, 120));
        await page.evaluate(() => { document.getElementById('quiz-search-global').value = ''; });

        // ---- the folded panel ----
        const more = () => page.evaluate(() => ({ d: document.getElementById('quiz-more-filters').style.display, exp: document.getElementById('quiz-more-btn').getAttribute('aria-expanded') }));
        let m = await more(); assert.equal(m.d, 'none'); assert.equal(m.exp, 'false');
        await page.click('#quiz-more-btn'); m = await more(); assert.equal(m.d, 'flex'); assert.equal(m.exp, 'true');
        await page.click('#quiz-more-btn'); m = await more(); assert.equal(m.d, 'none');
        // a chosen style lights the button even while the panel is folded
        await run([mk('a', { examStyle: 'kokushi' }), mk('b', { examStyle: 'pebc1' })]);
        await page.evaluate(() => { setQuizStyleFilter('kokushi'); renderQuizzesNow(); });   // renderQuizzes is debounced
        assert.equal(await page.evaluate(() => document.getElementById('quiz-more-btn').classList.contains('has-dot')), true, 'a selected style puts a dot on the ⚙ button');
        await page.evaluate(() => { setQuizStyleFilter(''); });
        // the hygiene badge opens the panel + the details
        assert.equal(await page.$eval('#quiz-hyg-badge .qf-ok', e => e.getAttribute('onclick')), 'openQuizHygiene()', 'the badge calls openQuizHygiene()');
        await page.evaluate(() => document.querySelector('#quiz-hyg-badge .qf-ok').click());   // DOM click (the forced-visible harness page scrolls oddly for a real pointer click)
        assert.deepEqual(await page.evaluate(() => [document.getElementById('quiz-more-filters').style.display, document.getElementById('quiz-tag-hygiene').open]), ['flex', true], 'badge → panel + hygiene open');

        console.log('PASS: Quiz Engine toolbar lean — counts on 🧪/🏷️ pills (+ ✨), sort cycles on one icon button, Style/Tags/hygiene folded (dot when a style is chosen), # = tags only, hygiene OK/⚠ badge');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
