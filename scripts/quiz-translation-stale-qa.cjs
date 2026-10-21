// V101.183 / V102.355: a stored quiz translation is used only while it still fits the quiz.
// PRETEST-1.3 (2026-10-21): the quiz was rebuilt to 15 questions but kept a 10-question Thai set whose questions had ONE
// choice each → Thai readers saw the OLD questions and "undefined" choices. Intern: the REAL index.html qtGetEffectiveQuestion
// (file://, network blocked); admin: the REAL qtSrcSig + qtAdminTranslateOneLang cut out of admin.html and run in node.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const adm = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 40)); return src.slice(i, j); };
const sigI = cut(idx, '        function qtSrcSig(q) {', '        // The admin-built translation');
const sigA = cut(adm, '        function qtSrcSig(q) {', '        window.qtSrcSig = qtSrcSig;');
assert.equal(sigI.trim(), sigA.trim(), 'intern and admin hash a question the same way');

(async () => {
    // ---------- admin: a translation that drops choices is rejected and retried; a good one carries src
    const ctx = { console, window: {}, safeJsonParse: t => { try { return JSON.parse(t); } catch (_) { return null; } }, textAIModel: () => 'm', buildQuizTranslatePrompt: () => 'p' };
    vm.createContext(ctx);
    vm.runInContext(sigA + cut(adm, '        async function qtAdminTranslateOneLang(', '        // V93.02 admin: added `silent` param') + ';this.qtSrcSig=qtSrcSig;this.one=qtAdminTranslateOneLang;', ctx);
    const src = [{ q: 'Q one', options: ['a', 'b', 'c', 'd'] }, { q: 'Q two', options: ['e', 'f', 'g', 'h'] }];
    const replies = [
        JSON.stringify({ questions: [{ q: 'ข้อหนึ่ง', options: ['ก'] }, { q: 'ข้อสอง', options: ['จ'] }] }),                                  // one choice each (the PRETEST-1.3 shape)
        JSON.stringify({ questions: [{ q: 'ข้อหนึ่ง', options: ['ก', 'ข', 'ค', ''] }, { q: 'ข้อสอง', options: ['จ', 'ฉ', 'ช', 'ซ'] }] }),     // an empty choice
        JSON.stringify({ questions: [{ q: 'ข้อหนึ่ง', options: ['ก', 'ข', 'ค', 'ง'] }, { q: 'ข้อสอง', options: ['จ', 'ฉ', 'ช', 'ซ'] }] }),
    ];
    let calls = 0;
    ctx.callUniversalAI = async () => ({ text: replies[calls++] });
    const out = await ctx.one(src, 'en', 'th');
    assert.equal(calls, 3, 'two bad samples retried, the third accepted');
    assert.deepEqual(out.questions.map(q => q.src), src.map(q => ctx.qtSrcSig(q)), 'each translated question carries the src fingerprint');
    calls = 0; ctx.callUniversalAI = async () => ({ text: replies[0] });
    await assert.rejects(() => ctx.one(src, 'en', 'th'), /choices do not match/, 'three one-choice samples → the language fails (old set is not overwritten with junk)');
    // admin save drops stale translations when the questions changed
    assert.ok(/if \(prevQuiz\.translations && sigOf\(prevQuiz\.questions\) !== sigOf\(data\.questions\)\) \{\s*data\.translations = firebase\.firestore\.FieldValue\.delete\(\);/.test(adm), 'save clears translations when the questions changed');

    // ---------- intern
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        page.on('pageerror', () => {});
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
        await page.waitForTimeout(500);
        const r = await page.evaluate(() => {
            const Q = (i, n) => ({ type: 'choice', q: 'EN question ' + i, options: Array.from({ length: n }, (_, k) => 'EN choice ' + i + '.' + k), correct: [0] });
            const questions = Array.from({ length: 15 }, (_, i) => Q(i + 1, 4));
            const old10 = Array.from({ length: 10 }, (_, i) => ({ q: 'TH old ' + (i + 1), options: ['TH only one'] }));
            const good = questions.map((q, i) => ({ q: 'TH ' + (i + 1), options: q.options.map((_, k) => 'TH choice ' + k), src: qtSrcSig(q) }));
            const out = {};
            qtGetSelectedLang = () => 'th';
            qtBackgroundTranslate = () => {};   // no network here
            localStorage.clear();
            const run = (translations, i) => { currentQuiz = { id: 'QZ', questions, translations }; const e = qtGetEffectiveQuestion(i); return { q: e.q, opts: e.options, src: e._translationSource || (e._translationPending ? 'pending' : 'orig') }; };
            out.stale = run({ th: { questions: old10 } }, 0);
            out.good = run({ th: { questions: good } }, 0);
            const edited = good.map(t => ({ ...t })); edited[2] = { ...edited[2], src: 'zzz' };   // Q3 translated from an older text
            out.edited = run({ th: { questions: edited } }, 2);
            const short = good.map(t => ({ ...t })); short[4] = { ...short[4], options: ['TH a', 'TH b'] };
            out.short = run({ th: { questions: short } }, 4);
            const legacy = good.map(({ src, ...t }) => t);   // written before V102.355: no src
            out.legacy = run({ th: { questions: legacy } }, 1);
            // a browser cache made from the OLD question text is not used; one made from this text is
            currentQuiz = { id: 'QZ', questions };
            localStorage.setItem(qtCacheKey('QZ', 0, 'th'), JSON.stringify({ q: 'TH cached old', options: ['x'] }));
            const c1 = qtGetEffectiveQuestion(0); out.cacheOld = c1._translationPending ? 'pending' : c1.q;
            currentQuiz = { id: 'QZ', questions };
            localStorage.setItem(qtCacheKey('QZ', 0, 'th'), JSON.stringify({ q: 'TH cached', options: ['1', '2', '3', '4'], src: qtSrcSig(questions[0]) }));
            out.cacheNew = qtGetEffectiveQuestion(0).q;
            return out;
        });
        assert.equal(r.stale.src, 'pending', '10-question set on a 15-question quiz is ignored → live translation: ' + JSON.stringify(r.stale));
        assert.equal(r.stale.q, 'EN question 1', 'meanwhile the CURRENT question shows');
        assert.ok(r.stale.opts.every(o => typeof o === 'string' && o.startsWith('EN choice')), 'all four choices, no undefined');
        assert.deepEqual([r.good.src, r.good.q, r.good.opts.length], ['prebuilt', 'TH 1', 4], 'a matching set is used');
        assert.equal(r.edited.src, 'pending', 'a question whose source text changed is not shown in its old translation');
        assert.equal(r.short.src, 'pending', 'a translation with fewer choices is not used');
        assert.equal(r.legacy.src, 'prebuilt', 'older sets without src still work when they fit');
        assert.equal(r.cacheOld, 'pending', 'an old browser cache is not reused');
        assert.equal(r.cacheNew, 'TH cached', 'a cache of this exact question is reused');
    } finally { await browser.close(); }
    console.log('PASS: quiz translations — stale / short / edited sets ignored (live translation instead of old questions or "undefined" choices), admin rejects dropped choices and stamps src, save clears translations when questions change');
})().catch(e => { console.error(e); process.exit(1); });
