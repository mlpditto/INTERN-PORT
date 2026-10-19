// V102.312: 📄 Import CV — the 📄 button opens the sheet with a provider-first model rail (default Claude Opus 5.5) before any file
// is picked; the pick is remembered (ai_text_gs-cv-model), the read uses it, the sheet names it, and GPT 6 Luna gets an amber hint.
// The REAL admin.html in Chromium (network stubbed), the REAL providerModelRailHtml / browseAuditProvider; callUniversalAI stubbed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('GS_CV_MODEL_LABEL'), 'the fixed model label is gone');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 640, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        const load = async () => {
            await page.goto('file:///' + PUB + '/admin.html');
            await page.waitForFunction(() => document.readyState === 'complete' && typeof window.providerModelRailHtml === 'function' && typeof gsCvOpen === 'function', null, { timeout: 30000 });
            await page.waitForTimeout(500);
            await page.evaluate(() => {
                window.__clicks = 0;
                document.getElementById('groupSelectModal').style.display = 'flex';
                document.getElementById('gs-cv-file').click = () => { window.__clicks++; };
                window.callUniversalAI = async (model) => { window.__model = model; return { text: '{"nickname":"Ploy"}' }; };
                window.safeJsonParse = s => JSON.parse(s);
                window.gsCvImage = async () => ({ image_base64: 'x', image_mimetype: 'image/jpeg' });
                gsCvImage = window.gsCvImage;
            });
        };
        await load();
        await page.evaluate(() => { try { localStorage.removeItem('ai_text_gs-cv-model'); } catch (_) {} });

        // 1. 📄 opens the sheet with the rail; no file dialog yet
        await page.evaluate(() => gsCvOpen());
        assert.equal(await page.evaluate(() => window.__clicks), 0, 'no file dialog before a model is shown');
        assert.equal(await page.locator('#gs-cv-sheet').isHidden(), false, 'sheet open');
        assert.equal(await page.locator('#gs-cv-sheet #gs-cv-model').inputValue(), 'claude-opus-5-5', 'default Opus 5.5');
        assert.equal(await page.locator('#gs-cv-sheet .text-ai-chips > button.active').getAttribute('data-value'), 'claude-opus-5-5', 'default chip active');
        assert.equal(await page.locator('#gs-cv-sheet .audit-provider[aria-pressed="true"]').getAttribute('data-provider'), 'Claude', 'Claude tab shown');
        const shown = await page.locator('#gs-cv-sheet .text-ai-chips > button:not([hidden])').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')));
        assert.ok(shown.length > 0 && shown.every(l => l.startsWith('Claude ')), 'only Claude chips: ' + shown.join(','));
        assert.ok(/Sonnet 5\.5/.test(await page.locator('#gs-cv-hint').innerText()), 'hint names the cheaper text-PDF models');

        // 2. pick GPT 6 Luna → amber hint, remembered
        await page.locator('#gs-cv-sheet .audit-provider[data-provider="GPT"]').click();
        await page.locator('#gs-cv-sheet .text-ai-chips > button[data-value="gpt-6-luna"]').click();
        assert.equal(await page.locator('#gs-cv-model').inputValue(), 'gpt-6-luna');
        assert.ok(await page.locator('#gs-cv-hint').evaluate(e => e.classList.contains('warn') && /Luna/.test(e.textContent)), 'Luna warning');
        assert.equal(await page.evaluate(() => localStorage.getItem('ai_text_gs-cv-model')), 'gpt-6-luna', 'pick saved');
        // then Sonnet 5.5 → hint back to normal
        await page.locator('#gs-cv-sheet .audit-provider[data-provider="Claude"]').click();
        await page.locator('#gs-cv-sheet .text-ai-chips > button[data-value="claude-sonnet-5-5"]').click();
        assert.equal(await page.locator('#gs-cv-hint').evaluate(e => e.classList.contains('warn')), false);

        // 3. Choose file → dialog; the read uses the pick and the sheet names it
        await page.locator('#gs-cv-choose').click();
        assert.equal(await page.evaluate(() => window.__clicks), 1, 'Choose file opens the dialog');
        await page.evaluate(() => gsCvFile({ files: [new File(['x'], 'cv.png', { type: 'image/png' })] }));
        assert.equal(await page.evaluate(() => window.__model), 'claude-sonnet-5-5', 'the read uses the picked model');
        assert.ok(/Claude Sonnet 5\.5/.test(await page.locator('#gs-cv-sheet .cv-h small').innerText()), 'the sheet names the model');

        // 4. reload: the rail opens on the remembered pick
        await load();
        await page.evaluate(() => gsCvOpen());
        assert.equal(await page.locator('#gs-cv-model').inputValue(), 'claude-sonnet-5-5', 'remembered across reloads');
        await page.evaluate(() => gsCvClose());
        assert.equal(await page.locator('#gs-cv-sheet').isHidden(), true, 'Close hides the sheet');

        // 5. phone width: rail wraps, no horizontal overflow
        await page.setViewportSize({ width: 375, height: 800 });
        await page.evaluate(() => { document.getElementById('groupSelectModal').style.display = 'flex'; gsCvOpen(); });
        const ov = await page.locator('#gs-cv-sheet').evaluate(e => e.scrollWidth - e.clientWidth);
        assert.ok(ov <= 1, 'no horizontal overflow at 375 px: ' + ov);

        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS cv-import-model-rail-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
