// V102.141: AI API Settings — lean rows. The REAL modal markup from admin.html + the real ai-model-ui.js / ai-settings-ui.js / CSS.
// Every id the open / save / paste / export code reads is still there; a saved key rings its logo green (CSS only); each Model Default
// shows ONE chip until tapped, then a pick changes the (hidden) select + the stored default and folds the row; works at 390 px.
// Set AIS_SHOTS=<dir> to dump screenshots.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (from, to) => { const a = html.indexOf(from); assert(a > 0, 'missing: ' + from); const b = html.indexOf(to, a); assert(b > a, 'missing end: ' + to); return html.slice(a, b); };

// Static wiring
assert.ok(/<link rel="stylesheet" href="ai-settings-ui\.css\?v=V\d+\.\d+">/.test(html), 'ai-settings-ui.css linked');
assert.ok(/<script src="ai-settings-ui\.js\?v=V\d+\.\d+" defer><\/script>/.test(html), 'ai-settings-ui.js loaded');
const modal = slice('<div id="aiKeysModal"', '<script type="importmap">');
const REQUIRED_IDS = ['local-gemini-key', 'local-openai-key', 'local-typhoon-key', 'local-anthropic-key', 'local-llama-key', 'local-openrouter-key',
    'local-qwen-url', 'local-qwen-key', 'local-qwen-vd-model', 'local-qwen-speaker-catalog', 'local-gcp-mode', 'local-gcp-project', 'local-gcp-location', 'local-gcp-token',
    'bulk-paste-keys', 'import-file-input', 'acc-local', 'acc-vertex', 'acc-usage', 'ai-usage-details', 'usage-list', 'ai-usage-7d', 'ai-evals-7d', 'quota-list', 'vertex-manual-fields', 'vertex-auto-status',
    'default-translate-model', 'default-analyzer-model', 'default-review-model', 'default-qfp-model'];
for (const id of REQUIRED_IDS) assert.ok(modal.includes(`id="${id}"`), 'modal keeps #' + id);
for (const k of ['gemini', 'openai', 'typhoon', 'anthropic', 'llama', 'openrouter']) assert.ok(modal.includes(`id="local-${k}-key-toggle"`), 'eye icon id for ' + k + ' (togglePasswordVisibility needs it)');
for (const h of ['saveAIKeys()', 'parseAndFillKeys()', 'exportAIKeys()', 'importAIKeys(event)']) assert.ok(modal.includes(h), 'handler ' + h);

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const vw of [1100, 390]) {
            const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
            const errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('http://ais.test/', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
            await page.goto('http://ais.test/');
            await page.route('**/*', route => {
                if (!process.env.AIS_SHOTS) return route.abort();
                const u = new URL(route.request().url());
                if (u.pathname.startsWith('/assets/')) return route.fulfill({ path: path.join('public', u.pathname), contentType: 'image/svg+xml' });
                return u.hostname === 'cdnjs.cloudflare.com' ? route.continue() : route.abort();
            });
            await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
            if (process.env.AIS_SHOTS) await page.addStyleTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css' });
            await page.evaluate(() => { localStorage.setItem('ai_default_analyzer_model', 'claude-opus-5-5'); localStorage.setItem('ai_default_review_model', 'claude-sonnet-5-5'); });
            // the page's own helpers
            await page.addScriptTag({ content: slice('        window.toggleAiAccordion = function', '        window.syncModelDefault') });
            await page.addScriptTag({ content: slice('        window.syncModelDefault =', '\n        };').concat('\n        };') });
            await page.addScriptTag({ content: slice('        window.toggleVertexManualFields = function', '        window.parseAndFillKeys') });
            await page.addScriptTag({ content: slice('        window.togglePasswordVisibility = function', '        window.exportAIKeys') });
            await page.evaluate(() => { window.showToast = () => {}; });
            await page.addScriptTag({ path: 'public/ai-model-ui.js' });
            await page.addStyleTag({ path: 'public/text-ai-chips.css' });
            await page.addStyleTag({ path: 'public/ai-settings-ui.css' });
            await page.evaluate(() => {
                document.querySelector('#default-translate-model').value = 'gpt-6-luna';
                document.querySelector('#default-qfp-model').value = 'gemini-3.8-flash';
                document.dispatchEvent(new Event('DOMContentLoaded'));
            });
            await page.addScriptTag({ path: 'public/ai-settings-ui.js' });
            await page.evaluate(() => { document.getElementById('aiKeysModal').style.display = 'block'; });
            await page.waitForTimeout(300);

            // Rows are collapsed to the chosen chip
            const rows = ['default-translate-model', 'default-analyzer-model', 'default-review-model', 'default-qfp-model'];
            for (const id of rows) {
                const row = page.locator(`.ais-mrow:has(#${id})`);
                assert.equal(await row.locator('.text-ai-chips').count(), 1, id + ' has its rail @' + vw);
                const visible = await row.locator('.text-ai-chips > button').evaluateAll(bs => bs.filter(b => b.offsetParent !== null).map(b => b.dataset.value));
                assert.equal(visible.length, 1, id + ' shows ONE chip @' + vw + ': ' + visible);
                assert.equal(visible[0], await page.locator('#' + id).inputValue(), id + ' the visible chip is the stored default');
            }

            // Tap the chosen chip → the full rail opens; pick another → select + stored default change, row folds
            const tr = page.locator('.ais-mrow:has(#default-translate-model)');
            await tr.locator('.text-ai-chips > button.active').click();
            assert.ok(await tr.evaluate(r => r.classList.contains('open')), 'tap opens the rail @' + vw);
            assert.ok((await tr.locator('.text-ai-chips > button').evaluateAll(bs => bs.filter(b => b.offsetParent !== null).length)) > 8, 'open rail shows every chip');
            if (vw === 390) {
                const g = await tr.evaluate(r => { const m = r.querySelector('.ais-mn').getBoundingClientRect(), c = r.querySelector('.text-ai-chips').getBoundingClientRect(); return { chipsTop: c.top, nameBottom: m.bottom, w: c.width }; });
                assert.ok(g.chipsTop >= g.nameBottom, 'on a phone the open rail drops below the name');
                assert.ok(g.w > 250, 'and uses the full width: ' + g.w);
            }
            await tr.locator('.text-ai-chips > button[data-value="claude-haiku-4-5"]').click();
            assert.equal(await page.locator('#default-translate-model').inputValue(), 'claude-haiku-4-5', 'pick changes the select @' + vw);
            assert.equal(await page.evaluate(() => localStorage.getItem('ai_default_translate_model')), 'claude-haiku-4-5', 'and the stored default');
            assert.ok(!(await tr.evaluate(r => r.classList.contains('open'))), 'a pick folds the row');
            assert.equal(await tr.locator('.text-ai-chips > button').evaluateAll(bs => bs.filter(b => b.offsetParent !== null).map(b => b.dataset.value)).then(a => a.join()), 'claude-haiku-4-5', 'row now shows the new pick');
            // ▾ opens too; tapping the already-chosen chip while open folds it
            await tr.locator('.ais-more').click();
            assert.ok(await tr.evaluate(r => r.classList.contains('open')), '▾ opens');
            await tr.locator('.text-ai-chips > button.active').click();
            assert.ok(!(await tr.evaluate(r => r.classList.contains('open'))), 'tapping the chosen chip while open folds it');
            assert.equal(await page.locator('#default-translate-model').inputValue(), 'claude-haiku-4-5', 'folding keeps the pick');

            // Saved key = green ring (set programmatically, like Quick Paste / open do); empty = not green
            const ring = id => page.locator(`.ais-row:has(#${id}) .ais-logo`).evaluate(e => getComputedStyle(e).borderTopColor);
            await page.evaluate(() => { document.getElementById('local-gemini-key').value = 'AIza-test'; document.getElementById('local-llama-key').value = ''; });
            assert.equal(await ring('local-gemini-key'), 'rgb(34, 165, 91)', 'saved key rings its logo green @' + vw);
            assert.notEqual(await ring('local-llama-key'), 'rgb(34, 165, 91)', 'empty key is not green');

            // Eye, disclosure rows, Vertex pill
            await page.locator('.ais-row:has(#local-gemini-key) .ais-eye').click();
            assert.equal(await page.locator('#local-gemini-key').getAttribute('type'), 'text', 'eye shows the key');
            await page.locator('.ais-row:has(#local-gemini-key) .ais-eye').click();
            assert.equal(await page.locator('#local-gemini-key').getAttribute('type'), 'password', 'eye hides it again');
            assert.ok(!(await page.locator('#local-qwen-url').isVisible()), 'Local endpoint starts folded');
            await page.locator('.ais-drow[aria-controls="acc-local"]').click();
            assert.ok(await page.locator('#local-qwen-url').isVisible(), 'Local endpoint opens');
            assert.ok(await page.locator('.ais-acc:has(#acc-local)').evaluate(e => e.classList.contains('open')), 'and the chevron row is marked open');
            assert.ok(await page.locator('.ais-drow[aria-controls="acc-local"] .ais-chev i').count() === 1, 'chevron icon survives (data-ico)');
            await page.evaluate(() => { document.getElementById('local-gcp-mode').value = 'manual'; toggleVertexManualFields(); });
            assert.equal(await page.locator('#ais-vertex-pill').textContent(), 'Manual', 'Vertex pill follows the auth mode');
            await page.evaluate(() => { document.getElementById('local-gcp-mode').value = 'auto'; toggleVertexManualFields(); });
            assert.equal(await page.locator('#ais-vertex-pill').textContent(), 'Auto');

            // Fits the viewport, footer stays reachable
            const box = await page.locator('#aiKeysModal .ais-set').boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= vw + 0.5, 'dialog inside the viewport @' + vw + ' ' + JSON.stringify(box));
            const foot = await page.locator('.ais-foot').boundingBox();
            assert.ok(foot.y + foot.height <= 900 + 0.5, 'Save bar is on screen @' + vw);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no horizontal page scroll @' + vw);

            if (process.env.AIS_SHOTS) {
                await page.locator('.ais-drow[aria-controls="acc-local"]').click();
                await page.locator('.ais-mrow:has(#default-analyzer-model) .ais-more').click();
                await page.waitForTimeout(150);
                await page.evaluate(() => { document.querySelector('.ais-scroll').scrollTop = 0; });
                await page.locator('#aiKeysModal .ais-set').screenshot({ path: path.join(process.env.AIS_SHOTS, `ais_${vw}.png`) });
            }
            assert.deepEqual(errs, [], 'no page errors @' + vw);
            await page.close();
        }
        console.log('PASS: AI API Settings — every id/handler kept, saved key = green ring, Model Defaults show one chip until tapped (pick persists + folds), disclosure rows + Vertex pill work, fits 1100/390 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
