const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://toolbar.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://toolbar.test/');
        const html = fs.readFileSync('public/admin.html', 'utf8');
        const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');
        await page.setContent(styles + '<style>body{margin:0;background:white}</style><input id="ai-analyzer-model-val" type="hidden" value="gpt-5.6-luna"><div id="ai-audit-popup" style="width:92%;max-width:780px;margin:16px auto;padding:24px;box-sizing:border-box"></div><div id="ai-analysis-popup" style="width:92%;max-width:850px;margin:16px auto;padding:30px;box-sizing:border-box"></div>');
        await page.addStyleTag({ path: 'public/text-ai-chips.css' });
        await page.addStyleTag({ path: 'public/audit-toolbar.css' });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        for (const [start, end] of [
            ['        window.syncModelDefault =', '\n        };'],
            ['        window.auditFixModel =', '        window.renderAuditStart ='],
            ['        window.REVIEW_TABS =', '        // The rail is rendered'],
            ['        window.reviewTabsHtml =', '\n        };'],
            ['        window.showReviewTab =', '\n        };']
        ]) {
            const a = html.indexOf(start), b = html.indexOf(end, a);
            assert(a >= 0 && b > a);
            await page.addScriptTag({ content: html.slice(a, b + (end === '\n        };' ? end.length : 0)) });
        }
        await page.evaluate(() => {
            window.auditQuizAI = (button, options) => window.auditRequest = options;
            // V101.52: the toolbar passes the picked model (a trial model is kept, not normalised).
            window.analyzeQuizAI = (button, options) => window.rewriteRequest = options && options.model ? resolveTrialTextAIModel(options.model) : textAIModel('ai-analyzer-model-val');
            window.closeQuizReview = () => window.closeRequested = true;
            window.exportAiAnalysisMd = () => window.exported = true;
            document.getElementById('ai-audit-popup').innerHTML = auditToolbarHtml(true);
            document.getElementById('ai-analysis-popup').innerHTML = auditToolbarHtml(true, 'specialist', true);
        });
        for (const id of ['ai-audit-popup', 'ai-analysis-popup']) {
            const popup = page.locator('#' + id);
            // V101.05 added Qwen/DeepSeek chips; V101.21 gave them provider tabs; V101.52 adds the Grok trial chip here only.
            assert.equal(await popup.locator('.text-ai-chips button').count(), 14);
            assert.equal(await popup.locator('.text-ai-chips button:visible').count(), 4);
            assert.deepEqual(await popup.locator('.audit-provider').allTextContents(), ['Gemini', 'GPT', 'Claude', 'Qwen', 'DeepSeek', 'Grok']);
            assert.deepEqual(await popup.locator('.audit-provider').evaluateAll(ns => ns.map(n => getComputedStyle(n).color)), ['rgb(168, 180, 255)', 'rgb(125, 211, 176)', 'rgb(232, 180, 154)', 'rgb(201, 160, 240)', 'rgb(127, 200, 245)', 'rgb(212, 212, 216)']);
            assert.equal(await popup.locator('[data-value="gpt-6-astra"]').textContent(), 'Astra 6');
            assert.equal(await popup.locator('[data-value="gpt-6-astra"]').getAttribute('aria-label'), 'GPT 6 Astra');
            assert.equal(await popup.locator('.text-ai-chips [aria-pressed="true"]').count(), 1);
            assert.equal(await popup.locator('.review-tab[aria-pressed="true"]').evaluate(b => getComputedStyle(b).backgroundColor), 'rgb(245, 184, 205)');
            assert.equal(await popup.locator('.review-tab[aria-pressed="false"]').evaluate(b => getComputedStyle(b).backgroundColor), 'rgb(255, 240, 245)');
            for (const width of [320, 390, 736, 1024]) {
                await page.setViewportSize({ width, height: 800 });
                assert(await popup.locator('button:visible').evaluateAll(bs => bs.every(b => {
                    const r = b.getBoundingClientRect(), host = b.closest('.audit-toolbar').getBoundingClientRect();
                    return r.left >= host.left && r.right <= host.right + 1 && b.scrollWidth <= b.clientWidth;
                })), id + ' overflows at ' + width);
                const boxes = await popup.locator('button:visible').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return { l:r.left, r:r.right, t:r.top, b:r.bottom }; }));
                for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
                    const a=boxes[i], b=boxes[j]; assert(!(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t), 'overlapping controls');
                }
            }
        }
        await page.locator('#ai-audit-popup [data-value="gpt-5.6-sol"]').click();
        await page.locator('#ai-audit-popup .audit-run').click();
        assert.equal(await page.evaluate(() => auditRequest.model), 'gpt-5.6-sol');
        await page.locator('#ai-analysis-popup [data-provider="Claude"]').click();
        assert.equal(await page.locator('#ai-analysis-popup .text-ai-chips button:visible').count(), 3);
        assert.equal(await page.locator('#rewrite-ai-model').inputValue(), 'gpt-5.6-luna');
        await page.locator('#ai-analysis-popup [data-value="claude-haiku-4-5"]').click();
        await page.locator('#ai-analysis-popup .audit-run').click();
        assert.equal(await page.evaluate(() => rewriteRequest), 'claude-haiku-4-5');
        // V101.52 Grok trial: kept for the run, never saved as the Settings analyzer default.
        await page.locator('#ai-analysis-popup [data-provider="Grok"]').click();
        await page.locator('#ai-analysis-popup [data-value="or/x-ai/grok-4.7"]').click();
        await page.locator('#ai-analysis-popup .audit-run').click();
        assert.equal(await page.evaluate(() => rewriteRequest), 'or/x-ai/grok-4.7');
        assert.equal(await page.locator('#ai-analyzer-model-val').inputValue(), 'claude-haiku-4-5');
        assert.notEqual(await page.evaluate(() => localStorage.getItem('ai_default_analyzer_model')), 'or/x-ai/grok-4.7');
        await page.locator('#ai-audit-popup [data-provider="Grok"]').click();
        await page.locator('#ai-audit-popup [data-value="or/x-ai/grok-4.7"]').click();
        await page.locator('#ai-audit-popup .audit-run').click();
        assert.equal(await page.evaluate(() => auditRequest.model), 'or/x-ai/grok-4.7');
        assert.equal(await page.evaluate(() => auditFixModel()), 'or/x-ai/grok-4.7');
        assert.equal(await page.evaluate(() => normalizeTextAIModel('or/x-ai/grok-4.7')), 'gpt-5.6-luna');
        await page.locator('#ai-analysis-popup button', { hasText: 'Export' }).click();
        assert.equal(await page.evaluate(() => exported), true);
        await page.locator('#ai-audit-popup [data-review-tab="specialist"]').click();
        assert.equal(await page.locator('#ai-audit-popup').isVisible(), false);
        assert.equal(await page.locator('#ai-analysis-popup').isVisible(), true);
        await page.locator('#ai-analysis-popup [data-review-tab="audit"]').click();
        assert.equal(await page.locator('#ai-audit-popup').isVisible(), true);
        await page.setViewportSize({ width:736, height:360 });
        await page.screenshot({ path:'graphite-toolbar-qa.png' });
        await page.locator('#ai-audit-popup .audit-close').click();
        assert.equal(await page.evaluate(() => closeRequested), true);
        const bridgeStart = html.indexOf('        window.auditSuggestFix =');
        await page.addScriptTag({ content: html.slice(bridgeStart, html.indexOf('\n        };', bridgeStart) + 11) });
        await page.evaluate(() => {
            document.getElementById('ai-audit-popup').style.display = 'block';
            document.getElementById('ai-audit-popup').insertAdjacentHTML('beforeend', auditFixButtonHtml(1));
            window.showToast = () => {};
            window.analyzeQuizAI = async (button, options) => window.fixRequest = options;
            window._aiAnalysisItems = [];
            syncAuditFixHints();
        });
        for (const [value, label] of [['gpt-6-astra', 'GPT 6 Astra'], ['gemini-3.8-flash', 'Gemini 3.8 Flash']]) {
            await page.locator('#ai-audit-popup [data-provider="' + label.split(' ')[0] + '"]').click();
            await page.locator('#ai-audit-popup [data-value="' + value + '"]').click();
            const fix = page.locator('.audit-fix-control button');
            assert((await fix.getAttribute('title')).includes(label));
            assert.equal(await page.locator('.audit-fix-model').innerText(), label);
            await fix.focus();
            assert(await page.locator('.audit-fix-tooltip').isVisible());
            await page.evaluate(() => auditSuggestFix(1, document.querySelector('.audit-fix-control button')));
            assert.equal(await page.evaluate(() => fixRequest.model), value);
            await page.evaluate(() => document.getElementById('ai-audit-popup').style.display = 'block');
        }
        assert(html.includes("const selectedModel = opts?.model ? normalizeTextAIModel(opts.model) : textAIModel('ai-analyzer-model-val');"));
        // Reproduce overlapping rerenders: switching must hide all Rewrites instances.
        await page.evaluate(() => {
            const rewrite = document.getElementById('ai-analysis-popup');
            rewrite.style.display = 'block';
            document.body.append(rewrite.cloneNode(true));
        });
        await page.locator('[id="ai-analysis-popup"]').last().locator('[data-review-tab="audit"]').click();
        assert.equal(await page.locator('[id="ai-analysis-popup"]:visible').count(), 0);
        assert(await page.locator('#ai-audit-popup').isVisible());
        await page.locator('#ai-audit-popup [data-review-tab="specialist"]').click();
        assert.equal(await page.locator('[id="ai-analysis-popup"]').count(), 1);
        await page.evaluate(() => {
            document.getElementById('ai-audit-popup').remove();
            window.auditLoads = 0;
            window.auditQuizAI = () => { auditLoads++; return new Promise(resolve => window.finishAudit = resolve); };
        });
        await page.locator('#ai-analysis-popup [data-review-tab="audit"]').click();
        assert.equal(await page.locator('#ai-analysis-popup [data-review-tab="audit"]').innerText(), 'Loading…');
        await page.evaluate(() => showReviewTab('audit'));
        assert.equal(await page.evaluate(() => auditLoads), 1);
        await page.evaluate(() => {
            const target = document.createElement('div'); target.id = 'ai-audit-popup';
            target.innerHTML = auditToolbarHtml(true); document.body.append(target); finishAudit();
        });
        await page.waitForFunction(() => !window._reviewTabLoading);
        assert(await page.locator('#ai-audit-popup').isVisible());
        assert.equal(await page.locator('#ai-analysis-popup').isVisible(), false);
        // A renderer returning without a result leaves the current view usable.
        await page.evaluate(() => { document.getElementById('ai-analysis-popup').remove(); window.analyzeQuizAI = async () => {}; });
        await page.locator('#ai-audit-popup [data-review-tab="specialist"]').click();
        assert(await page.locator('#ai-audit-popup').isVisible());
        assert.equal(await page.locator('#ai-audit-popup [data-review-tab="specialist"]').isEnabled(), true);
        assert.deepEqual(errors, []);
        console.log('PASS: actual popup CSS, Sakura tabs, thirteen compact chips, no overlap at 320–1024px, audit/rewrite model routing, tabs, Export and Close');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });

