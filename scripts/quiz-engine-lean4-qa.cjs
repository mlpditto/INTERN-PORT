// V102.192 — Quiz Engine page, four small things (from the pasted AI ideas, filtered against earlier picks):
//  1 coverage badge colour = how well a system is covered (green ≥ 10 · amber 5–9 · red < 5; "Other" is not scored)
//  2 Translate Missing shows how many quizzes still miss a translation
//  3 Active = 0 → one line instead of an empty table
//  4 a divider between the quiz tabs and the Beri / Explore tabs
// Real functions from public/admin.html: coverage in a vm, the page itself (real renderQuizzesNow) in Chromium.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

// ---- 4 divider ----
assert.ok(/<\/button>\s*<span class="subtab-sep" role="separator"[^>]*><\/span>\s*<!-- V96\.50: Beri Phase 1/.test(html.replace(/\r\n/g, '\n')), 'separator sits between Exam and Gourmet World');
assert.ok(/\.subtab-sep \{[^}]*width:1px/.test(html), 'separator css');

// ---- 1 coverage colours (real renderQuizCoverage, stubbed buckets) ----
{
    const a = html.indexOf('window.renderQuizCoverage = function () {');
    let i = html.indexOf('{', a), b = 0, k = i;
    for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
    const src = html.slice(a, k + 1) + ';';
    const grid = { innerHTML: '' }, sum = { textContent: '', title: '' };
    const sys = ['heme', 'renal', 'ent', 'resp', 'derm', 'other'].map(key => ({ key, emoji: '•', label: { en: key.toUpperCase() } }));
    const n = { heme: 1, renal: 5, ent: 9, resp: 10, derm: 0, other: 59 };
    const buckets = { __uncat: [] }; sys.forEach(s => { buckets[s.key] = new Array(n[s.key]).fill({}); });
    const win = { _qcovSystems: sys, computeQuizCoverageBuckets: () => buckets, currentQuizSystem: null };
    const ctx = vm.createContext({ window: win, document: { getElementById: id => id === 'qcov-grid' ? grid : id === 'qcov-summary' ? sum : null }, escapeHtml: s => String(s) });
    vm.runInContext(src, ctx);
    win.renderQuizCoverage();
    const badge = key => { const m = grid.innerHTML.match(new RegExp('>' + key.toUpperCase() + '<[\\s\\S]*?class="badge" title="([^"]*)" style="background:([^;]+);')); assert.ok(m, 'badge for ' + key); return { tip: m[1], bg: m[2] }; };
    assert.equal(badge('heme').bg, '#ef4444', '1 quiz → red'); assert.match(badge('heme').tip, /1 quiz · scarce \(< 5\)/);
    assert.equal(badge('renal').bg, '#f59e0b', '5 → amber'); assert.match(badge('renal').tip, /5 quizzes · thin/);
    assert.equal(badge('ent').bg, '#f59e0b', '9 → amber');
    assert.equal(badge('resp').bg, '#10b981', '10 → green'); assert.match(badge('resp').tip, /enough/);
    assert.equal(badge('derm').bg, '#fca5a5', '0 stays the light-red gap chip');
    assert.equal(badge('other').bg, '#94a3b8', 'Other is not scored (grey)'); assert.ok(!/scarce|thin|enough/.test(badge('other').tip), 'no verdict for Other');
    assert.match(sum.title, /green ≥ 10 · amber 5–9 · red < 5/, 'the rule is the summary tooltip');
}

// ---- 2 + 3 in the real page: renderQuizzesNow with a few quizzes ----
(async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        const mk = (id, over) => Object.assign({ id, title: 'Quiz ' + id, shortTitle: id, isActive: false, questions: [{ q: 'x', options: ['a', 'b'], correct: 0 }], tags: 'Diabetes', __c: 1 }, over);
        const run = (list) => page.evaluate((l) => {
            l.forEach(q => { q.createdAt = { toMillis: () => q.__c, toDate: () => new Date(q.__c), seconds: q.__c }; });   // Timestamps can't cross the evaluate boundary
            quizzesData = l;
            try { renderQuizzesNow(); } catch (e) { return { err: String(e && e.message || e) }; }
            const e = document.getElementById('active-quizzes-empty'), t = document.getElementById('quizzesTableActive');
            return { count: document.getElementById('tm-count').textContent, btnTitle: document.getElementById('btn-translate-all-missing').title, emptyShown: getComputedStyle(e).display !== 'none', emptyText: e.textContent.replace(/\s+/g, ' ').trim(), tableShown: t.style.display !== 'none' };
        }, list);
        // nothing live, 2 quizzes miss translations, 1 is translated, 1 template
        let r = await run([mk('a'), mk('b'), mk('c', { translations: { th: {} } }), mk('d', { isTemplate: true, translations: { th: {} } })]);
        assert.ok(!r.err, 'renderQuizzesNow threw: ' + r.err);
        assert.equal(r.count, ' (2)', 'Translate Missing (2)'); assert.match(r.btnTitle, /2 quizzes still miss a translation/);
        assert.ok(r.emptyShown && !r.tableShown, 'Active = 0 → empty line, no table');
        assert.match(r.emptyText, /Nothing is live right now.*Go live · 4 to choose from/, 'tells where to go + how many there are (templates are part of Inactive): ' + r.emptyText);
        // one live quiz → the table is back, the line is gone
        r = await run([mk('a', { isActive: true, translations: { th: {} } }), mk('b', { translations: { th: {} } })]);
        assert.ok(!r.err, r.err); assert.equal(r.count, '', 'everything translated → no count'); assert.match(r.btnTitle, /already has its translations/);
        assert.ok(!r.emptyShown && r.tableShown, 'a live quiz → table, no empty line');
        // a filter that hides the only live quiz → different wording
        await page.evaluate(() => { window.currentQuizSystem = 'nonexistent-system'; });
        r = await run([mk('a', { isActive: true, translations: { th: {} } })]);
        if (!r.err && r.emptyShown) assert.match(r.emptyText, /No live quiz matches this filter/, 'filtered-out ≠ nothing live');
        console.log('PASS: Quiz Engine lean 4 — coverage badge colours (red < 5, amber 5–9, green ≥ 10, Other grey) + rule tooltip, Translate Missing (n), Active = 0 one-line state, divider between quiz tabs and Beri tabs');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
