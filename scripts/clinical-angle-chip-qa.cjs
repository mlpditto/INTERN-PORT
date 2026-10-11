// V102.158: 🩺 Clinical angle — a toggle beside Rewrite (quiz review toolbar, rewrite mode only). While on, the batch Rewrite prompt AND the
// single-question prompt (Regen / Compare B) carry a CLINICAL ANGLE block that recasts non-medical questions as pharmacy / hospital tasks;
// the admin steer is still placed after it (it declares itself highest priority). Remembered in localStorage. The REAL functions in a browser.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const batch = grab(html, 'function buildQuizAnalyzePrompt(');
const single = grab(html, 'window._buildSingleQImprovePrompt = function(');
assert.ok(batch.includes('${window.clinicalAngleBlock ? window.clinicalAngleBlock() : \'\'}'), 'the batch Rewrite prompt carries the block');
assert.ok(/\$\{window\.clinicalAngleBlock \? window\.clinicalAngleBlock\(\) : ''\}\$\{steerBlock\}/.test(single), 'the single-question prompt carries the block BEFORE the admin steer');
const toolbar = grab(html, 'window.auditToolbarHtml = function(');
assert.ok(toolbar.includes("${isAudit ? '' : window.clinicalAngleChipHtml()}<button type=\"button\" class=\"audit-run\""), 'the chip sits right before Rewrite, rewrite mode only');
assert.ok(html.includes('.audit-actions .clinical-angle[aria-pressed="true"]'), 'on-state style');

const code = [grab(html, 'window.clinicalAngleOn = function'), grab(html, 'window.toggleClinicalAngle = function'), grab(html, 'window.clinicalAngleChipHtml = function'),
    grab(html, 'window.clinicalAngleBlock = function'), batch, 'window.buildQuizAnalyzePrompt = buildQuizAnalyzePrompt;', single, grab(html, 'window.auditToolbarHtml = function(')].join(';\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="host"></div>' }));
        await page.goto('https://qa.test/h.html');
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addScriptTag({ content: [
            'var __toasts = []; function showToast(m) { __toasts.push(m); }',
            'var _auditDimNames = {}; window.auditDimLabels = () => ""; window.reviewTabsHtml = () => "<nav></nav>"; window.auditModelControlsHtml = () => "";',
            'var TEXT_AI_MODELS = [{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" }, { id: "gpt-6-luna", label: "GPT 6 Luna" }]; var TEXT_AI_TRIAL_MODELS = []; function textAIModel() { return "gemini-3.8-flash"; }',
            'window.textAIModelInfo = id => TEXT_AI_MODELS.find(m => m.id === id); window.providerModelRailHtml = () => "";',
            code
        ].join('\n') });
        const q = [{ q: 'Which Copilot app summarises a Teams meeting?', type: 'choice', options: ['Teams', 'Word', 'Excel', 'Outlook'], correct: [0] }];
        const batchHas = () => page.evaluate(q => buildQuizAnalyzePrompt(q, ['copilot'], null).includes('CLINICAL ANGLE'), q);
        const singleP = steer => page.evaluate(([q, s]) => window._buildSingleQImprovePrompt(q[0], 'recall only', 'make it a scenario', s), [q, steer]);

        // off by default: no block anywhere, chip unpressed and only in rewrite mode
        assert.equal(await page.evaluate(() => window.clinicalAngleOn()), false);
        assert.equal(await batchHas(), false, 'off: batch prompt has no block');
        assert.ok(!(await singleP('')).includes('CLINICAL ANGLE'), 'off: single prompt has no block');
        await page.evaluate(() => { document.getElementById('host').innerHTML = window.auditToolbarHtml(false, 'rewrite'); });
        assert.equal(await page.locator('#host .clinical-angle').count(), 1, 'chip in rewrite mode');
        assert.equal(await page.$eval('#host .clinical-angle', e => e.getAttribute('aria-pressed')), 'false');
        assert.ok(await page.$eval('#host .audit-actions', e => e.firstElementChild.classList.contains('clinical-angle') && e.children[1].classList.contains('audit-run')), 'chip sits right before Rewrite');
        await page.evaluate(() => { document.getElementById('host').innerHTML = window.auditToolbarHtml(false, 'audit'); });
        assert.equal(await page.locator('#host .clinical-angle').count(), 0, 'no chip in Review (audit) mode');

        // tap: on, remembered, toast; both prompts carry the block; the steer comes AFTER it
        await page.evaluate(() => { document.getElementById('host').innerHTML = window.auditToolbarHtml(false, 'rewrite'); });
        await page.click('#host .clinical-angle');
        assert.equal(await page.$eval('#host .clinical-angle', e => e.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.evaluate(() => localStorage.getItem('quizClinicalAngle')), '1', 'remembered');
        assert.ok((await page.evaluate(() => __toasts[0])).includes('on'), 'toast says on');
        assert.equal(await batchHas(), true, 'on: batch prompt carries the block');
        const sp = await singleP('keep the stem');
        assert.ok(sp.includes('CLINICAL ANGLE') && sp.includes('COMMUNITY PHARMACY') && sp.includes('HOSPITAL PHARMACY'), 'on: single prompt carries the block with both settings');
        assert.ok(sp.indexOf('CLINICAL ANGLE') < sp.indexOf('ADMIN STEER'), 'the admin steer stays after the block (highest priority)');
        assert.ok(sp.includes('Keep the SAME skill'), 'the block keeps the original skill');
        // a fresh toolbar reads the remembered state
        await page.evaluate(() => { document.getElementById('host').innerHTML = window.auditToolbarHtml(true, 'rewrite'); });
        assert.equal(await page.$eval('#host .clinical-angle', e => e.getAttribute('aria-pressed')), 'true', 'a re-rendered toolbar shows it on');
        // tap again: off everywhere
        await page.click('#host .clinical-angle');
        assert.equal(await page.evaluate(() => window.clinicalAngleOn()), false);
        assert.equal(await batchHas(), false, 'off again: batch prompt clean');
        assert.ok(!(await singleP('')).includes('CLINICAL ANGLE'), 'off again: single prompt clean');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: 🩺 Clinical angle toggle — rewrite mode only, remembered, both prompt builders carry the block while on (steer still last), clean while off');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
