// V102.06: Quality Review Scorecard multi-select → one ✦ call fixes every picked question.
// Real renderAuditScorecard / batch helpers / prompt builder / result remap sliced from admin.html.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const cut = (start, end, includeEnd = false) => {
    const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('slice not found: ' + start);
    return html.slice(a, b + (includeEnd ? end.length : 0));
};
const slices = [
    cut('        window.AUDIT_DIMS = [', '        window.auditDimLabels = function'),
    cut('        window.auditDimLabels = function', '\n        };\n', true),
    cut('        window.REVIEW_TABS =', '        // The rail is rendered'),
    cut('        window.reviewTabsHtml =', '\n        };', true),
    cut('        window.auditFixModel =', '        window.renderAuditStart ='),
    cut('        window.aiModelShortName =', '        function renderAuditScorecard('),
    cut('        function renderAuditScorecard(', '        // V97.33: expand/collapse'),
    cut('        window.auditSuggestFix =', '\n        };\n', true),
    'window.renderAuditScorecard = renderAuditScorecard;'
].join('\n');
const promptBuilder = cut('        function buildQuizAnalyzePrompt(', '\n        }\n', true) + '\nwindow.buildQuizAnalyzePrompt = buildQuizAnalyzePrompt;';
const remap = cut('                if (onlyQNumbers && onlyQNumbers.length && Array.isArray(result.items)) {', '\n                }\n', true);

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://audit.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
        await page.goto('https://audit.test/');
        await page.addStyleTag({ content: [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n') });
        for (const css of ['public/text-ai-chips.css', 'public/audit-toolbar.css']) await page.addStyleTag({ content: fs.readFileSync(css, 'utf8') });
        await page.evaluate(() => { document.body.innerHTML = '<input id="ai-analyzer-model-val" type="hidden" value="gpt-6-luna">'; });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            window.toasts = []; window.showToast = m => toasts.push(m);
            window.calls = [];
            window.showReviewTab = async tab => { window.lastTab = tab; };
            window.analyzeQuizAI = async (btn, opts) => {
                calls.push(JSON.parse(JSON.stringify(opts)));
                document.getElementById('ai-analysis-popup')?.remove(); // the real one replaces its popup
                if (opts.cachedResult) window._aiAnalysisItems = opts.cachedResult.items; // V102.16: merged rounds replay
                else {
                    const nums = opts.onlyQNumbers || [opts.onlyQNumber];
                    window._aiAnalysisItems = nums.slice(0, window.returnCount || nums.length).map(n => ({ qNumber: n, improvedQuestion: { q: 'fixed ' + n } }));
                    window._aiAnalysisText = 'round ' + nums[0]; window._aiAnalysisTokens = 1000; window._aiAnalysisModel = opts.model;
                }
                if (!document.getElementById('ai-analysis-popup')) { const d = document.createElement('div'); d.id = 'ai-analysis-popup'; document.body.append(d); }
            };
        });
        await page.addScriptTag({ content: slices + '\n' + promptBuilder });

        const questions = Array.from({ length: 12 }, (_, i) => ({ q: 'Question ' + (i + 1), type: 'choice', options: ['a', 'b', 'c', 'd'], correct: [0] }));
        const sc = v => ({ keyDefensibility: v, clarity: v, distractorQuality: v, itemFlaws: v, bloomLevel: v, clinicalDepth: v, languageConsistency: v });
        await page.evaluate(q => {
            window._lastAuditByQ = {};
            q.forEach((_, i) => { window._lastAuditByQ[i + 1] = { weakestDim: 'clarity', weakestVal: 2, rationale: 'แก้ข้อ ' + (i + 1) }; });
            renderAuditScorecard({ overallScore: 2.9, perQuestionAudit: q.map((_, i) => ({ qNumber: i + 1, scores: { keyDefensibility: 3, clarity: 2, distractorQuality: 3, itemFlaws: 3, bloomLevel: 2, clinicalDepth: 3, languageConsistency: 2 }, averageScore: 2.6 })) }, 'gpt-6-luna', 1200, {}, q, null, null);
        }, questions);

        const picks = page.locator('#ai-audit-popup .audit-pick');
        assert.equal(await picks.count(), 12, 'one checkbox per card');
        assert.equal(await page.locator('#audit-batch').isVisible(), false, 'bar hidden until something is picked');

        await picks.nth(4).check(); await picks.nth(2).check();
        assert.equal(await page.locator('#audit-batch').isVisible(), true);
        assert.equal(await page.locator('#audit-batch-count').innerText(), '2');
        // V102.16: the count appears once (⊟ n, which is also Deselect all); ✦ carries only the logo; no separate ×
        assert.equal(await page.locator('#audit-batch .audit-batch-clear').getAttribute('aria-label'), 'Deselect all');
        assert.equal(await page.locator('#audit-batch .audit-batch-clear .fa-square-minus').count(), 1);
        assert.equal((await page.locator('#audit-batch-fix').textContent()).trim(), '✦', 'no ×n on the run button');
        assert.equal(await page.locator('#audit-batch .fa-xmark').count(), 0, 'no separate clear ×');
        const fix = page.locator('#audit-batch-fix');
        assert.equal(await fix.locator('.text-ai-logo').getAttribute('data-owner'), 'openai', 'batch button shows the Quality Audit model logo');
        assert.match(await fix.getAttribute('title'), /2 ข้อพร้อมกัน/);

        await fix.click();
        await page.waitForFunction(() => calls.length === 1);
        const call = await page.evaluate(() => calls[0]);
        assert.deepEqual(call.onlyQNumbers, [3, 5], 'picked questions in quiz order');
        assert.deepEqual(call.auditNote.map(n => n.rationale), ['แก้ข้อ 3', 'แก้ข้อ 5'], 'each question brings its own finding');
        assert.equal(call.model, 'gpt-6-luna');
        await page.waitForFunction(() => window.lastTab === 'specialist');
        assert.match(await page.evaluate(() => toasts.at(-1)), /Fixes proposed for 2 questions/);

        // a short reply says so
        await page.evaluate(() => { document.getElementById('ai-analysis-popup')?.remove(); window.returnCount = 1; });
        await fix.click();
        await page.waitForFunction(() => toasts.some(t => /1 of 2/.test(t)));
        await page.evaluate(() => { window.returnCount = 0; });

        // one pick → the single-question path; >10 → disabled; × clears
        await page.locator('.audit-batch-clear').click();
        assert.equal(await page.locator('#audit-batch').isVisible(), false);
        assert.equal(await page.locator('#ai-audit-popup .audit-pick:checked').count(), 0);
        await picks.nth(6).check();
        await page.evaluate(() => { window.returnCount = undefined; document.getElementById('ai-analysis-popup')?.remove(); });
        await fix.click();
        await page.waitForFunction(() => calls.length === 3);
        assert.equal(await page.evaluate(() => calls[2].onlyQNumber), 7, 'one pick uses the single-question fix');
        // V102.16: more than 10 → rounds of 10, merged into one Specialist view (no cap)
        await page.locator('.audit-batch-clear').click();
        for (let i = 0; i < 12; i++) await picks.nth(i).check();
        assert.equal(await fix.isDisabled(), false, '12 picks can run');
        assert.match(await fix.getAttribute('title'), /12 ข้อ · เรียก AI 2 รอบ \(รอบละ 10 ข้อ\)/);
        await page.evaluate(() => { calls.length = 0; });
        await fix.click();
        await page.waitForFunction(() => calls.length === 3);
        const r = await page.evaluate(() => calls);
        assert.deepEqual(r[0].onlyQNumbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'round 1 = first 10');
        assert.deepEqual(r[1].onlyQNumbers, [11, 12], 'round 2 = the rest');
        assert.deepEqual(r[1].auditNote.map(n => n.rationale), ['แก้ข้อ 11', 'แก้ข้อ 12'], 'each round carries its own findings');
        assert.equal(r[2].batchMerged, true, 'merged replay');
        assert.deepEqual(r[2].cachedResult.items.map(it => it.qNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'every fix in one view');
        assert.equal(r[2].cachedTokens, 2000, 'tokens summed');
        await page.waitForFunction(() => toasts.some(t => /Fixes proposed for 12 questions/.test(t)));
        assert.equal(await page.evaluate(() => window.lastTab), 'specialist');
        // a failed round is skipped, the other still shows
        await page.evaluate(() => { calls.length = 0; const real = window.analyzeQuizAI; window.analyzeQuizAI = async (b, o) => { if (o.onlyQNumbers && o.onlyQNumbers[0] === 1) { calls.push(o); document.getElementById('ai-analysis-popup')?.remove(); return; } return real(b, o); }; });
        await fix.click();
        await page.waitForFunction(() => calls.length === 3);
        assert.deepEqual(await page.evaluate(() => calls[2].cachedResult.items.map(it => it.qNumber)), [11, 12]);
        await page.waitForFunction(() => toasts.some(t => /2 of 12/.test(t)));

        // prompt: one finding line per question in the batch; the single-question block unchanged
        const prompt = await page.evaluate(q => buildQuizAnalyzePrompt([q[0], q[1], q[2]], '', [{ weakestDim: 'clarity', weakestVal: 2, rationale: 'สั้นลง' }, null, { weakestDim: 'itemFlaws', weakestVal: 1 }]), questions);
        assert.match(prompt, /AUDIT FINDINGS — each question's improvedQuestion MUST directly fix ITS finding first:/);
        assert.match(prompt, /- Q1: weakest [^\n]*\(2\/5\) · reviewer note \(Thai\): สั้นลง/);
        assert.match(prompt, /- Q3: weakest [^\n]*\(1\/5\)/);
        assert.doesNotMatch(prompt, /- Q2:/, 'a question without a finding gets no line');
        const single = await page.evaluate(q => buildQuizAnalyzePrompt([q[0]], '', { weakestDim: 'clarity', weakestVal: 2, rationale: 'x' }), questions);
        assert.match(single, /AUDIT FINDING for the question above/);
        assert.doesNotMatch(single, /AUDIT FINDINGS —/);

        // result remap: subset numbers 1..k → real question numbers; unknown ones dropped; index-only items too
        const mapped = await page.evaluate(src => {
            const result = { items: [{ qNumber: 1 }, { qNumber: 2 }, { index: 2 }, { qNumber: 9 }] };
            new Function('onlyQNumbers', 'result', src)([3, 5, 8], result);
            return result.items.map(it => [it.qNumber, 'index' in it]);
        }, remap);
        assert.deepEqual(mapped, [[3, false], [5, false], [8, false]]);

        await page.setViewportSize({ width: 390, height: 800 });
        assert.equal(await page.evaluate(() => { const b = document.getElementById('audit-batch').getBoundingClientRect(), p = document.getElementById('ai-audit-popup').getBoundingClientRect(); return b.right <= p.right + 1 && b.left >= p.left - 1; }), true, 'bar fits the popup at 390 px');
        // V102.16: the merged replay is saved as the last analysis and shows no "Saved analysis" badge
        assert.ok(html.includes("if (!(opts && opts.cachedResult && !opts.batchMerged)) { // V102.16"), 'merged batch is saved');
        assert.ok(html.includes('${(opts && opts.cachedResult && !opts.batchMerged) ? `<span title="Saved analysis'), 'no saved badge on a merged batch');
        assert.ok(html.includes('window._aiAnalysisTokens = aiTokens || 0;'), 'rounds can sum tokens');
        assert.deepEqual(errors, []);
        console.log('PASS: scorecard multi-select — checkbox per card, bar count/logo/cap/clear, one call with every picked question + its finding, specialist tab + toast (short reply), single pick → single fix, >10 → rounds of 10 merged (failed round skipped), batch prompt lines, result remap, 390 px');
    } finally { await browser.close(); }
})();
