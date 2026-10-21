// V102.361: Review scores the Read first page as an 8th, OPTIONAL dimension (null when the question has none — never a 1),
// and the Scorecard row carries a free rule badge (none · leak · hint · short · ok). The REAL table, normalizer, rule check
// and renderer sliced from public/admin.html. SHOT=<png> also saves the rendered Scorecard.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
const cut = (start, end, includeEnd = false) => {
    const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('slice not found: ' + start);
    return html.slice(a, b + (includeEnd ? end.length : 0));
};
const slices = [
    cut('        window.AUDIT_DIMS = [', '        window.auditDimLabels = function'),
    cut('        window.auditDimLabels = function', '\n        };\n', true),
    cut('        window.auditDupDims = function', '\n        };\n', true),
    cut('        window.normalizeAuditScores = function', '\n        };\n', true),
    cut('        window.reviewRunLock = function', '        window.REVIEW_TABS ='),
    cut('        window.REVIEW_TABS =', '        // The rail is rendered'),
    cut('        window.reviewTabsHtml =', '\n        };', true),
    cut('        window.auditFixModel =', '        window.renderAuditStart ='),
    cut('        window.aiModelShortName =', '        function renderAuditScorecard('),
    cut('        function renderAuditScorecard(', '        // V97.33: expand/collapse'),
    'window.renderAuditScorecard = renderAuditScorecard;'
].join('\n');

// static checks on the prompt + the weakest-dimension guard (both live inside openQuizReview)
assert.ok(html.includes("'\\n  read first: (none)'") && html.includes('read first: ${String(q.primer)'), 'the Review prompt carries each question\'s Read first, "(none)" when empty');
assert.equal((html.match(/"readFirst": null when the question has no "read first:" text/g) || []).length, 2, 'both rubric prompts (Review + AI-suggestion scoring) allow readFirst = null');
assert.equal((html.match(/if \(scores\[k\] === null \|\| scores\[k\] === undefined \|\| scores\[k\] === ''\) return;/g) || []).length, 2, 'the two weakest-dimension loops skip a null');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1.5 });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://audit.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
        await page.goto('https://audit.test/');
        await page.addStyleTag({ content: [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n') });
        for (const css of ['public/text-ai-chips.css', 'public/audit-toolbar.css']) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
        await page.evaluate(() => { document.body.innerHTML = '<input id="ai-analyzer-model-val" type="hidden" value="gpt-6-luna">'; });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            window.showToast = () => {}; window.showReviewTab = async () => {}; window.analyzeQuizAI = async () => {};
        });
        await page.addScriptTag({ content: slices });

        const r = await page.evaluate(() => {
            const out = {};
            const dims = window.AUDIT_DIMS;
            out.keys = dims.map(d => d.key); out.optional = dims.filter(d => d.optional).map(d => d.key);
            out.rubricNull = /readFirst.*null when the question has none/s.test(window.auditRubricText());
            out.example = window.auditScoresExample();
            out.dupLast = window.auditDupDims().slice(-1)[0];
            // the normalizer: null is fine for readFirst, the average runs over the 7 scored; a 0 or a missing core dimension still throws
            const sc = (rf, extra) => Object.assign({ keyDefensibility: 5, clarity: 4, distractorQuality: 4, itemFlaws: 4, bloomLevel: 3, clinicalDepth: 4, languageConsistency: 5, readFirst: rf }, extra || {});
            const res = { overallScore: 0, perQuestionAudit: [{ qNumber: 1, scores: sc(5) }, { qNumber: 2, scores: sc(null) }, { qNumber: 3, scores: sc(undefined) }] };
            window.normalizeAuditScores(res, 3);
            out.avgs = res.perQuestionAudit.map(x => x.averageScore); out.overall = res.overallScore; out.q3rf = res.perQuestionAudit[2].scores.readFirst;
            const bad = v => { try { window.normalizeAuditScores({ perQuestionAudit: [{ qNumber: 1, scores: v }] }, 1); return 'accepted'; } catch (e) { return 'threw'; } };
            out.zero = bad(sc(0)); out.six = bad(sc(6)); out.missingCore = bad((() => { const s = sc(null); delete s.clarity; return s; })());
            // the rule badge
            const q = (primer, opts, correct) => ({ q: 'Q', type: 'choice', options: opts || ['Levonorgestrel', 'Drospirenone', 'C', 'D'], correct: correct || [0], primer });
            out.chk = {
                none: window.auditPrimerCheck(q('')).kind,
                leak: window.auditPrimerCheck(q('Remember that levonorgestrel is the most androgenic')).kind,
                hint: window.auditPrimerCheck(q('อ่านก่อน: คำตอบที่ถูกคือข้อที่พูดถึงฤทธิ์แอนโดรเจน')).kind,
                short: window.auditPrimerCheck(q('Progestin basics.')).kind,
                ok: window.auditPrimerCheck(q('Progestins differ in androgenic activity and VTE risk; the hormone-free interval is the pill-free gap each cycle.')).kind,
                shortOption: window.auditPrimerCheck(q('A long enough page about option C and D without the key', ['A', 'B', 'C', 'D'], [2])).kind,
            };
            // the Scorecard
            const questions = [
                { q: 'A 26-year-old woman switching from a 21/7 pill to a 24/4 pill. Which advantage of the 24/4 regimen is best supported?', type: 'choice', options: ['More cumulative estrogen', 'Shorter hormone-free interval reduces withdrawal symptoms', 'Lower VTE risk at any dose', 'More complete withdrawal bleeding'], correct: [1],
                  primer: 'ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวมมีสูตร 21/7 และ 24/4 ช่วงปลอดฮอร์โมน (hormone-free interval) คือจำนวนวันที่ไม่มีฮอร์โมนในแต่ละรอบ ชนิดของโปรเจสติน (progestin) ต่างกันทั้งฤทธิ์แอนโดรเจนและความเสี่ยง VTE' },
                { q: 'Rank these progestins from highest to lowest androgenic activity.', type: 'choice', options: ['Levonorgestrel > Norgestimate > Desogestrel', 'Cyproterone > Levonorgestrel > Drospirenone', 'Drospirenone > Desogestrel > Levonorgestrel', 'Drospirenone > Gestodene > Norethindrone'], correct: [0],
                  primer: 'จำไว้ว่า Levonorgestrel > Norgestimate > Desogestrel คือลำดับฤทธิ์แอนโดรเจนจากมากไปน้อย' },
                { q: 'Which counselling point applies to a missed pill in week 1?', type: 'choice', options: ['A', 'B', 'C', 'D'], correct: [2] },
            ];
            const result = { overallScore: 0, perQuestionAudit: [
                { qNumber: 1, scores: sc(5), detectedBloomName: 'Apply', rationale: 'readFirst ปูพื้น hormone-free interval และชนิด progestin โดยไม่ชี้ไปที่ช้อย 2' },
                { qNumber: 2, scores: sc(1), detectedBloomName: 'Remember', rationale: 'readFirst บอกลำดับที่เป็นเฉลยตรง ๆ (ช้อย 1) — ให้เขียนเป็นหลักการจัดลำดับฤทธิ์แอนโดรเจนแทน' },
                { qNumber: 3, scores: sc(null), detectedBloomName: 'Apply', rationale: 'ไม่มี Read first — ข้ออื่นดี' },
            ] };
            window.normalizeAuditScores(result, 3);
            window.renderAuditScorecard(result, 'gpt-6-luna', 5321, null, questions, null, null);
            const pop = document.getElementById('ai-audit-popup');
            out.rows = [...pop.querySelectorAll('div')].filter(d => /^Read first/.test(d.textContent.trim()) && d.children.length === 2).map(d => d.textContent.replace(/\s+/g, ' ').trim());
            out.badges = [...pop.querySelectorAll('[class^="audit-primer-"]')].map(b => b.className.replace('audit-primer-', '') + ':' + b.textContent.trim());
            out.avgsCard = result.perQuestionAudit.map(x => x.averageScore);
            out.humanized = window.auditHumanizeRationale('bloomLevel/clinicalDepth ต่ำสุด (2) · itemFlaws ok · readFirst 1 · keyDefensibilityX stays');
            out.rationaleShown = [...pop.querySelectorAll('.lang-no-toggle')].map(d => d.textContent).find(t => /Read first ปูพื้น/.test(t)) || '';
            pop.style.position = 'static'; pop.style.transform = 'none'; pop.style.maxHeight = 'none'; pop.style.width = '900px';
            return out;
        });
        assert.deepEqual(r.keys.slice(-1), ['readFirst'], '8th dimension: ' + r.keys); assert.equal(r.keys.length, 8);
        assert.deepEqual(r.optional, ['readFirst'], 'only readFirst is optional'); assert.ok(r.rubricNull, 'the rubric says null when there is none');
        assert.match(r.example, /"readFirst": 4/); assert.deepEqual(r.dupLast, ['readFirst', '📖'], 'last in the duplicate table');
        assert.deepEqual(r.avgs, [4.3, 4.1, 4.1], 'Q1 averages 8 scores, Q2/Q3 the 7 scored: ' + r.avgs); assert.equal(r.overall, 4.2); assert.equal(r.q3rf, null, 'undefined becomes null');
        assert.deepEqual([r.zero, r.six, r.missingCore], ['threw', 'threw', 'threw'], 'a 0, a 6 or a missing core dimension still fails');
        assert.deepEqual(r.chk, { none: 'none', leak: 'leak', hint: 'hint', short: 'short', ok: 'ok', shortOption: 'ok' }, 'rule badge kinds (a 1-letter option never counts as a leak): ' + JSON.stringify(r.chk));
        assert.equal(r.rows.length, 3, 'a Read first row per question: ' + JSON.stringify(r.rows));
        assert.match(r.rows[0], /✓.*★★★★★ 5/); assert.match(r.rows[1], /⚠ leak.*★☆☆☆☆ 1/); assert.match(r.rows[2], /—.*— no Read first/);
        assert.deepEqual(r.badges, ['ok:✓', 'leak:⚠ leak', 'none:—']);
        assert.deepEqual(r.avgsCard, [4.3, 3.8, 4.1]);
        assert.equal(r.humanized, 'Bloom Level/Clinical Depth ต่ำสุด (2) · Item Flaws ok · Read first 1 · keyDefensibilityX stays', 'rationale keys become dimension names (whole words only): ' + r.humanized);
        assert.match(r.rationaleShown, /Read first ปูพื้น/, 'the card shows "Read first", not the raw key');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        if (process.env.SHOT) await (await page.$('#ai-audit-popup')).screenshot({ path: process.env.SHOT });
        console.log('PASS: Review 📖 Read first — 8th optional dimension (null when none, average over the scored ones, 0/6/missing still rejected), the prompt carries the page, rule badge none/leak/hint/short/ok, Scorecard rows + "— no Read first"');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
