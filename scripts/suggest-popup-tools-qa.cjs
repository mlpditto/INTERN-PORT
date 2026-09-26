// V101.98: AI Suggested Questions popup — copy without key, Copy all (with / without key), Add all,
// ⭐ Score all (Quality Review rubric on the Quality Audit model). Real code sliced from admin.html.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const slice = (startMarker, endMarker) => {
    const a = html.indexOf(startMarker);
    const b = html.indexOf(endMarker, a + startMarker.length);
    if (a < 0 || b < 0) throw new Error('slice not found: ' + startMarker);
    return html.slice(a, b);
};
const audit = slice('        window.AUDIT_DIMS = [', '        window.auditDimLabels = function') + slice('        window.auditDimLabels = function', '\n        };\n') + '\n        };\n';
const compareText = slice('        window._compareQText = function', '\n        };\n') + '\n        };\n';
const popup = slice('        window.showAiSuggestionsPopup = function', '        // --- 🎨 Design Lab Logic');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent('<meta charset="utf-8"><body></body>');
        // V101.99: the real admin CSS (its global `details summary` reset and button sizes caused the two layout bugs fixed here).
        await page.addStyleTag({ content: [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n') });
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            window.toasts = []; window.showToast = m => toasts.push(m);
            window.added = []; window.addQuestionUI = q => added.push(q.q);
            window.labels = 0; window.autoLabelQuizExamStyle = () => labels++;
            window.copied = []; window.unifiedCopyToClipboard = (text) => copied.push(text);
            window.getQuizFormData = () => ({ title: 'Contraception', blueprint: {} });
            window.auditFixModel = () => 'gpt-6-luna';
            window.aiModelShortName = id => ({ 'gpt-6-luna': 'Luna 6' })[id] || id;
            window.safeJsonParse = JSON.parse;
        });
        await page.addScriptTag({ content: audit + compareText + popup });
        const items = [
            { q: 'Q one stem', type: 'choice', options: ['a1', 'b1', 'c1', 'd1'], correct: [2], explanation: 'why one' },
            { q: 'Q two stem — choose TWO', type: 'choice', options: ['a2', 'b2', 'c2', 'd2', 'e2'], correct: [0, 2], explanation: 'why two' },
            { q: 'Q three stem', type: 'choice', options: ['a3', 'b3', 'c3', 'd3'], correct: [1] }
        ];
        assert.equal(await page.evaluate(s => showAiSuggestionsPopup(s), items), 3);

        // toolbar + per-card buttons
        assert.equal(await page.locator('.ai-sugg-toolbar button').count(), 4);
        assert.match(await page.locator('#ai-sugg-add-all').innerText(), /Add all \(3\)/);
        assert.match((await page.locator('#ai-sugg-score-all').textContent()).replace(/\s+/g, ' '), /Score all · Luna 6/);
        assert.equal(await page.locator('[aria-label="Copy without answer key"]').count(), 3);
        // V101.99: icon-only — per card copy + key badge (B), toolbar answer / question sheet + "all" tag (C).
        assert.equal(await page.locator('[aria-label="Copy with answer key"] .cpy-badge.cpy-key .fa-key').count(), 3);
        assert.equal(await page.locator('[aria-label="Copy without answer key"] .cpy-badge.cpy-nokey .fa-key').count(), 3);
        assert.equal(await page.locator('[aria-label="Copy all with answer key"] .fa-clipboard-check').count(), 1);
        assert.equal(await page.locator('[aria-label="Copy all without answer key"] .fa-clipboard-list').count(), 1);
        for (const label of ['Copy all with answer key', 'Copy all without answer key']) assert.equal((await page.locator(`[aria-label="${label}"]`).textContent()).trim(), 'all', label + ' shows no text but the all tag');
        for (const label of ['Copy with answer key', 'Copy without answer key']) assert.equal((await page.locator(`[aria-label="${label}"]`).first().textContent()).trim(), '', label + ' is icon-only');

        // copy without key (card 2), copy all with / without key
        await page.locator('[aria-label="Copy without answer key"]').nth(1).click();
        let text = await page.evaluate(() => copied.at(-1));
        assert.match(text, /^Q two stem — choose TWO\nA\) a2\nB\) b2/);
        assert.doesNotMatch(text, /✅|why two|เฉลย/, 'no answer key, no explanation');
        await page.locator('[aria-label="Copy all with answer key"]').click();
        text = await page.evaluate(() => copied.at(-1));
        assert.match(text, /^Q1\. Q one stem/); assert.match(text, /Q3\. Q three stem/);
        assert.match(text, /✅ C\. c1/); assert.match(text, /✅ A\. a2[\s\S]*✅ C\. c2/, 'multi-answer key marks both');
        assert.match(text, /💡 why one/); assert.match(text, /\n\n---\n\n/);
        await page.locator('[aria-label="Copy all without answer key"]').click();
        text = await page.evaluate(() => copied.at(-1));
        assert.match(text, /^Q1\. Q one stem\nA\) a1/); assert.doesNotMatch(text, /✅|💡/);

        // one card ADD, then Add all adds only the rest
        await page.locator('.ai-sugg-add').first().click();
        assert.deepEqual(await page.evaluate(() => added), ['Q one stem']);
        assert.match(await page.locator('#ai-sugg-add-all').innerText(), /Add all \(2\)/);
        await page.locator('#ai-sugg-add-all').click();
        assert.deepEqual(await page.evaluate(() => added), ['Q one stem', 'Q two stem — choose TWO', 'Q three stem']);
        assert.match(await page.locator('#ai-sugg-add-all').innerText(), /All added/);
        assert.equal(await page.locator('#ai-sugg-add-all').isDisabled(), true);
        assert.equal(await page.locator('.ai-sugg-add:not(:disabled)').count(), 0);
        assert(await page.evaluate(() => labels) >= 1, 'exam-style auto label runs');

        // ⭐ Score all: one call, Audit model, rubric + multi-answer key in the prompt, stars + dims + escaped rationale
        await page.evaluate(() => {
            window.calls = [];
            const sc = (k, c, d, f, b, cl, l) => ({ keyDefensibility: k, clarity: c, distractorQuality: d, itemFlaws: f, bloomLevel: b, clinicalDepth: cl, languageConsistency: l });
            window.callUniversalAI = async (...args) => { calls.push(args); return { text: JSON.stringify({ perQuestionAudit: [
                { qNumber: 1, scores: sc(5, 4, 3, 4, 3, 4, 5), averageScore: 4.0, detectedBloomName: 'Apply', rationale: 'ตัวลวง <b>อ่อน</b>' },
                { qNumber: 2, scores: sc(2, 4, 3, 3, 4, 4, 5), detectedBloomName: 'Analyze', rationale: 'ข้อ C ไม่ถูก' },
                { qNumber: 3, scores: sc(4, 4, 4, 4, 2, 3, 5), averageScore: 3.7 }
            ] }) }; };
        });
        await page.locator('#ai-sugg-score-all').click();
        await page.waitForFunction(() => /Score again/.test(document.getElementById('ai-sugg-score-all').textContent));
        const call = await page.evaluate(() => ({ model: calls[0][0], isJson: calls[0][2], feature: calls[0][5].feature, prompt: calls[0][1], n: calls.length }));
        assert.equal(call.n, 1); assert.equal(call.model, 'gpt-6-luna'); assert.equal(call.isJson, true); assert.equal(call.feature, 'quiz_suggest_score');
        assert.match(call.prompt, /RUBRIC — score each question on 7 dimensions/);
        assert.match(call.prompt, /Q2 \(choice\): Q two stem — choose TWO[\s\S]*correct: A,C/);
        assert.match(call.prompt, /"perQuestionAudit"/);
        assert.match(await page.locator('#ai-sugg-avg-0').innerText(), /4\.0/);
        assert.match(await page.locator('#ai-sugg-avg-1').innerText(), /3\.6/, 'average computed when the model omits it');
        assert.match(await page.locator('#ai-sugg-score-0 summary').innerText(), /7 dimensions · lowest Distractor Quality 3/);
        assert.match(await page.locator('#ai-sugg-score-1 summary').innerText(), /lowest Key Defensibility 2/);
        assert.equal(await page.locator('#ai-sugg-score-0').innerHTML().then(h => h.includes('<b>อ่อน</b>')), false, 'rationale is escaped');
        assert.match(await page.locator('#ai-sugg-score-0').innerText(), /ตัวลวง <b>อ่อน<\/b>/);
        assert.equal(await page.locator('#ai-sugg-score-2 details').count(), 1);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#ai-sugg-score-0 summary'), '::before').content), '"▸"', 'disclosure marker shown despite the global summary reset');

        // a short reply says so; a failure restores the button
        await page.evaluate(() => { window.callUniversalAI = async () => ({ text: JSON.stringify({ perQuestionAudit: [{ qNumber: 1, scores: { clarity: 5 } }] }) }); });
        await page.locator('#ai-sugg-score-all').click();
        await page.waitForFunction(() => toasts.some(t => /Scored 1 of 3/.test(t)));
        await page.evaluate(() => { window.callUniversalAI = async () => { throw new Error('Opus 5.5 declined this request'); }; window.alerts = []; window.alert = m => alerts.push(m); });
        await page.locator('#ai-sugg-score-all').click();
        await page.waitForFunction(() => alerts.length === 1);
        assert.match(await page.evaluate(() => alerts[0]), /Score error: Opus 5\.5 declined/);
        assert.equal(await page.locator('#ai-sugg-score-all').isDisabled(), false);

        // a regenerated popup ignores a stale score reply
        await page.evaluate(() => { window.callUniversalAI = () => new Promise(r => { window.finishScore = r; }); });
        await page.locator('#ai-sugg-score-all').click();
        await page.evaluate(s => { document.getElementById('ai-suggestions-popup').remove(); showAiSuggestionsPopup(s); }, items);
        await page.evaluate(() => finishScore({ text: JSON.stringify({ perQuestionAudit: [{ qNumber: 1, scores: { clarity: 5 }, averageScore: 5 }] }) }));
        await page.waitForTimeout(100);
        assert.equal(await page.locator('#ai-sugg-avg-0').innerText(), '', 'stale scores not painted on the new set');

        for (const width of [390, 1000]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow at ' + width);
            // V101.99: every card button stays inside its card (the ADD button used to hang off the edge at 390 px).
            assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#ai-suggestions-popup button')].filter(b => { const card = b.closest('div[style*="border-radius:20px"]'); if (!card) return false; const r = b.getBoundingClientRect(), c = card.getBoundingClientRect(); return r.right > c.right + 1 || r.left < c.left - 1; }).map(b => b.getAttribute('aria-label') || b.textContent.trim())), [], 'buttons inside their card at ' + width);
        }
        assert.deepEqual(errors, []);
        console.log('PASS: suggestions popup — copy no-key, Copy all ±key, Add all after single adds, Score all (Audit model, rubric, multi-answer key, avg fallback, escaped rationale, short reply, error, stale reply), 390/1000px');
    } finally { await browser.close(); }
})();
