// V102.384 (owner): a Brief that is already a structured prompt ([TASK] + at least two of CONTEXT / CORE INSTRUCTION / CONSTRAINT /
// OUTPUT) skips AI Refined Prompt — no enhancer call, no modal, the Brief goes to the engine as is (+ the style line); ⚡ Create now
// beside Create skips by hand on any text; a plain Brief still goes through the enhancer and the modal. The REAL admin.html + the REAL
// generateAIDesign; callUniversalAI stubbed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.match(html, /<title>Nika Admin \(V102\.(?:38[4-9]|39\d|[4-9]\d\d)\)<\/title>/, 'admin V102.384+');
assert.ok(html.includes('window.gmIsStructuredPrompt = function (text) {') && html.includes('window.generateAIDesign = async function(opts) {') && html.includes("const finalPrompt = skipEnhance ? rawPrompt : await new Promise((resolve) => {"), 'the skip branches');
assert.ok(html.includes('id="btn-generate-now"') && html.includes('onclick="generateAIDesign({ skipEnhance: true })"'), 'the ⚡ button');
const PUB = path.resolve('public').replace(/\\/g, '/');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const STRUCT = '👉 [TASK]: Create a comparative infographic about restaurant rules.\n\n👉 [CONTEXT]: A social media post for Thai consumers.\n\n👉 [CORE INSTRUCTION]: two columns.\n\n👉 [CONSTRAINT]: flat vector.\n\n👉 [OUTPUT]: 1:1.';

const window_safe = h => /window\.GM_STYLE_SAFE = '([^']+)'/.exec(h)[1];

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        page.on('dialog', d => d.dismiss());
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.generateAIDesign === 'function' && typeof window.gmIsStructuredPrompt === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);

        const unit = await page.evaluate(STRUCT => [
            gmIsStructuredPrompt(STRUCT), gmIsStructuredPrompt('[TASK]: only a task line'), gmIsStructuredPrompt('[task]: a\n[output]: b\n[context]: c'),
            gmIsStructuredPrompt('make an infographic about dengue'), gmIsStructuredPrompt(''), gmIsStructuredPrompt('[CONTEXT] x [OUTPUT] y [CONSTRAINT] z')
        ], STRUCT);
        assert.deepEqual(unit, [true, false, true, false, false, false], 'structured = [TASK] + two more headings, any case: ' + JSON.stringify(unit));

        // one run: records enhancer calls, whether the modal ever opened, the image call's prompt, toasts, the button afterwards
        const run = (brief, opts) => page.evaluate(async ({ brief, opts, PNG }) => {
            selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="as/gemini-nano-banana-2.1"]'));
            document.getElementById('design-prompt').value = brief;
            const calls = []; let modalSeen = false;
            const modal = document.getElementById('aiDesignPromptModal');
            const mo = new MutationObserver(() => { if (modal.style.display === 'flex') modalSeen = true; }); mo.observe(modal, { attributes: true, attributeFilter: ['style'] });
            window.callUniversalAI = async (model, prompt, isJson, vision, sys, o) => { calls.push({ feature: o && o.feature, prompt }); return (o && o.feature === 'design_enhance') ? { text: '[TASK]: enhanced' } : { imageDataUrl: PNG, text: '' }; };
            const toasts = []; window.showToast = m => toasts.push(m);
            const done = window.generateAIDesign(opts);
            for (let i = 0; i < 50 && !modalSeen; i++) await new Promise(r => setTimeout(r, 20));
            if (modalSeen) document.getElementById('btn-design-proceed').click();
            let err = null; try { await done; } catch (e) { err = e.message; }
            mo.disconnect();
            const img = calls.find(c => c.feature === 'design_image') || {};
            return { err, enhanced: calls.some(c => c.feature === 'design_enhance'), modalSeen, imgPrompt: img.prompt || '', toasts, shown: !!document.getElementById('generated-image'), btn: document.getElementById('btn-generate-design').textContent.trim() };
        }, { brief, opts: opts || null, PNG });

        const auto = await run(STRUCT);
        assert.deepEqual([auto.err, auto.enhanced, auto.modalSeen, auto.imgPrompt.startsWith(STRUCT), auto.shown, auto.btn, auto.toasts[0]], [null, false, false, true, true, 'Create', '⚡ Structured Brief — sent as is, no AI Refined Prompt'], 'a structured Brief: no enhancer, no modal, sent as is: ' + JSON.stringify(auto));
        const STYLE = await page.evaluate(() => document.getElementById('selected-design-style').value);
        assert.ok(STYLE.length > 10 && auto.imgPrompt.includes(STYLE), 'V102.532: the chosen Style reaches the image model on a structured Brief: ' + auto.imgPrompt);
        assert.ok(auto.imgPrompt.includes(window_safe(html)), 'the Always added line is still appended');
        const plain = await run('make an infographic about dengue');
        assert.deepEqual([plain.err, plain.enhanced, plain.modalSeen, plain.imgPrompt.startsWith('[TASK]: enhanced'), plain.shown], [null, true, true, true, true], 'a plain Brief still goes through the enhancer + modal: ' + JSON.stringify(plain));
        const manual = await run('make an infographic about dengue', { skipEnhance: true });
        assert.ok(manual.imgPrompt.includes(STYLE), 'V102.532: ⚡ Create now sends the chosen Style: ' + manual.imgPrompt);
        assert.equal(plain.imgPrompt.includes(STYLE), false, 'the refined path adds nothing — the enhancer already wrote the Style in');
        assert.deepEqual([manual.err, manual.enhanced, manual.modalSeen, manual.imgPrompt.startsWith('make an infographic about dengue'), manual.toasts[0]], [null, false, false, true, '⚡ Sent as is — no AI Refined Prompt'], '⚡ Create now skips on any text: ' + JSON.stringify(manual));

        const btn = await page.evaluate(() => { const b = document.getElementById('btn-generate-now'), c = document.getElementById('btn-generate-design'); return [c.nextElementSibling === b, b.textContent.trim(), b.title, b.getAttribute('aria-label'), b.classList.contains('gm-create')]; });
        assert.deepEqual(btn, [true, '⚡', '⚡ Create now — skip AI Refined Prompt and send the Brief as is', 'Create now, skip AI Refined Prompt', true], 'the ⚡ button sits right after Create: ' + JSON.stringify(btn));
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: structured Brief skips AI Refined Prompt automatically, ⚡ Create now skips by hand, a plain Brief still refines');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
