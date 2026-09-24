const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const html = fs.readFileSync('public/admin.html', 'utf8');
        await page.route('http://models.test/', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://models.test/');
        await page.route('**/*', route => route.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
        const start = html.indexOf('        window.syncModelDefault =');
        await page.addScriptTag({ content: html.slice(start, html.indexOf('\n        };', start) + 11) });
        await page.evaluate(() => {
            window.updateModelDescription = window.showToast = () => {};
            window.syncStorytellerModel = value => ['laughtale-ai-model', 'storyteller-model-select'].forEach(id => document.getElementById(id).value = value);
            window.DCA_AI_LS_KEY = 'ai_default_drug_codex_model';
            window.DCA_AI_FALLBACK_MODEL = 'claude-4-sonnet-latest';
            localStorage.setItem('ai_default_review_model', 'gpt-4o');
            localStorage.setItem('ai_default_design_enhancer_model', 'gpt-5.6-sol');
        });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.addStyleTag({ path: 'public/text-ai-chips.css' });
        await page.addScriptTag({ path: 'public/drug-toolbar.js' });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        // Exercise the real editor-open initialization, which previously overwrote registry click handlers.
        const editorStart = html.indexOf('            const syncChipRailToHidden =');
        const editorEnd = html.indexOf('            // 🔥 Init AI Language Toggle', editorStart);
        assert(editorStart > 0 && editorEnd > editorStart);
        const editorInit = html.slice(editorStart, editorEnd);
        for (let reopen = 0; reopen < 2; reopen++) {
            await page.evaluate(code => { new Function(code)(); }, editorInit);
            // V101.34: the toolbar analyzer rail is gone — #ai-analyzer-model-val is a data-native-model
            // Settings default (value + persistence, no chips); only the Translate popover keeps a rail.
            assert.equal(await page.locator('[data-model-input="ai-analyzer-model-val"]').count(), 0);
            for (const value of ['gemini-3.8-flash', 'gpt-6-luna']) {
                await page.evaluate(v => syncModelDefault('ai-analyzer-model-val', v), value);
                assert.equal(await page.locator('#ai-analyzer-model-val').inputValue(), value);
                assert.equal(await page.locator('#default-analyzer-model').inputValue(), value);
                assert.equal(await page.evaluate(() => localStorage.getItem('ai_default_analyzer_model')), value);
            }
            for (const id of ['toolbar-ai-translate-model']) {
                const rail = page.locator(`[data-model-input="${id}"]`);
                for (const value of ['as/gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gpt-6-luna']) {
                    await rail.locator(`[data-value="${value}"]`).evaluate(b => b.click());
                    assert.equal(await rail.locator('.active').count(), 1);
                    assert.equal(await rail.locator('[aria-pressed="true"]').count(), 1);
                    assert.equal(await rail.locator('[aria-pressed="true"]').getAttribute('data-value'), value);
                    assert.equal(await page.locator('#' + id).inputValue(), value);
                    assert.equal(await rail.locator('button').evaluateAll(bs => bs.filter(b => getComputedStyle(b).backgroundColor === 'rgb(245, 158, 11)').length), 1);
                }
            }
        }
        const ids = await page.evaluate(() => TEXT_AI_MODELS.map(m => m.id));
        assert.equal(ids.length, 13); // V101.05: + Qwen 3.8 Flash/Max, DeepSeek V4.1 Flash/V4 Pro
        const controls = ['toolbar-ai-translate-model', 'ai-tagging-model-val', 'ai-model-design-enhancer', 'ai-model-grammar', 'dxa-ai-model-val', 'ai-model-review', 'research-model-select', 'tts-polish-model', 'laughtale-ai-model', 'storyteller-model-select', 'lp-ai-model', 'apd-model-a', 'apd-model-b', 'case-note-ai-model', 'default-translate-model', 'default-analyzer-model', 'default-review-model', 'default-qfp-model'];
        assert.equal(await page.locator('#ai-model-review').inputValue(), 'gpt-6-luna');
        assert.equal(await page.locator('#ai-model-design-enhancer').inputValue(), 'gpt-6-sol');
        for (const id of controls) {
            const rail = page.locator(`[data-model-input="${id}"]`);
            assert.equal(await rail.count(), 1, id);
            assert.deepEqual(await rail.locator('button').evaluateAll(bs => bs.map(b => b.dataset.value)), ids, id);
            for (const model of ids) {
                await rail.locator(`button[data-value="${model}"]`).evaluate(b => b.click());
                assert.equal(await page.locator('#' + id).inputValue(), model, id);
                assert.equal(await rail.locator('[aria-pressed="true"]').count(), 1, id);
            }
            assert(await rail.locator('button').evaluateAll(bs => bs.every(b => /[ก-๙]/.test(b.title))), id);
        }
        // data-native-model selects are compact: full catalog + persisted choice, no chip rail.
        for (const [id, key] of [['alabasta-case-card-refine-model', 'ai_default_casecard_refine_model']]) {
            assert.equal(await page.locator(`[data-model-input="${id}"]`).count(), 0, id);
            assert.deepEqual(await page.locator(`#${id} option`).evaluateAll(os => os.map(o => o.value)), ids, id);
            for (const model of ids) {
                await page.locator('#' + id).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('change')); }, model);
                assert.equal(await page.evaluate(k => localStorage.getItem(k), key), model, id);
            }
        }
        for (const pref of ['translate', 'analyzer', 'review', 'qfp']) {
            assert.deepEqual(await page.locator(`#default-${pref}-model option`).evaluateAll(os => os.map(o => o.value)), ids);
        }
        for (const railId of ['dt-models', 'dca-ai-chip-rail']) {
            assert.equal(await page.locator(`#${railId} button`).count(), ids.length);
            await page.locator(`#${railId} button[data-value="claude-haiku-4-5"]`).evaluate(b => b.click());
            assert.equal(await page.locator('#dca-ai-model-val').inputValue(), 'claude-haiku-4-5');
        }
        await page.evaluate(() => initRegistryModelSelectors());
        assert.equal(await page.locator('[data-model-input]').count(), controls.length);
        for (const [from, to] of [
            ['        window.auditModelControlsHtml =', '        window.auditToolbarHtml ='],
            ['        window._compareModelB =', '        window.generateAiProposalB ='],
            ['        const IMG_QUIZ_VISION_MODELS =', '        function imageQuizUpdateCount()']
        ]) {
            const a = html.indexOf(from); const b = html.indexOf(to, a);
            assert(a >= 0 && b > a);
            await page.addScriptTag({ content: html.slice(a, b) });
        }
        await page.evaluate(() => {
            const box = document.createElement('div');
            box.id = 'dynamic-model-tests';
            box.innerHTML = auditModelControlsHtml(false) + _compareModelBPickerHtml();
            document.body.append(box);
            imageQuizRenderModelRail();
        });
        assert.equal(await page.locator('#dynamic-model-tests .text-ai-chips').count(), 2);
        assert.equal(await page.locator('#img-quiz-model-rail button').count(), ids.length);
        await page.locator('#dynamic-model-tests .text-ai-chips').first().locator('[data-value="claude-haiku-4-5"]').evaluate(b => b.click());
        assert.equal(await page.locator('#quality-audit-model').inputValue(), 'claude-haiku-4-5');
        await page.locator('#dynamic-model-tests .text-ai-chips').last().locator('[data-value="gpt-6-sol"]').evaluate(b => b.click());
        assert.equal(await page.evaluate(() => _compareModelB()), 'gpt-6-sol');
        const lpStart = html.indexOf('        window.generateWeeklySummary =');
        await page.addScriptTag({ content: html.slice(lpStart, html.indexOf('        window.lpAppendAiToContent =', lpStart)) });
        await page.evaluate(async () => {
            window._lp = { ownerId: 'fixture', entries: [{ date: new Date().toISOString().slice(0, 10), title: 'Practice', contentMarkdown: 'Test entry' }] };
            window.callUniversalAI = async (...args) => { window.testAIArgs = args; return { text: 'Fixture summary' }; };
            document.getElementById('lp-ai-model').value = 'gpt-6-sol';
            await generateWeeklySummary();
        });
        assert.equal(await page.locator('#lp-ai-output').inputValue(), 'Fixture summary');
        assert.equal(await page.evaluate(() => testAIArgs[0]), 'gpt-6-sol');
        assert.equal(await page.evaluate(() => typeof testAIArgs[1]), 'string');
        await page.evaluate(async () => { document.getElementById('lp-entry-content').value = 'Fixture entry'; await aiEnhanceLpEntry(); });
        assert.equal(await page.locator('#lp-ai-output').inputValue(), 'Fixture summary');
        // Render each real rail in a constrained mobile column with the app's CSS.
        await page.evaluate(() => {
            const main = document.createElement('main'); main.style.cssText = 'width:100%;padding:10px;box-sizing:border-box';
            document.querySelectorAll('[data-model-input]').forEach(rail => {
                const label = document.createElement('p'); label.textContent = rail.dataset.modelInput;
                main.append(label, rail);
            });
            document.body.replaceChildren(main);
        });
        for (const width of [320, 390, 736]) {
            await page.setViewportSize({ width, height: 844 });
            assert(await page.locator('.text-ai-chips button').evaluateAll(bs => bs.every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })), `mobile ${width}`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'text-models-qa.png', fullPage: true });
        console.log('PASS: 18 task/Settings rails + 2 native (analyzer, case-card refine) + Drug Codex + audit/compare/image rails; 13 choices, saved migration, selection routing, Thai hints and 320/390/736px rails');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
