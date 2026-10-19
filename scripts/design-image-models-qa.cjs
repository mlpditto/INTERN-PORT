// V102.315: Miss Goldenweek image engines — Seedream 5.0 Flash + GPT Image 2.5 Sunburst go through OpenRouter's Image API
// (generationOptions.imageApi), the older chips do not; ✨ Create ends with the button back to "Create" (the busy counter's
// stop function used to be declared inside try, so finally threw a ReferenceError and the button stayed "Manifesting…").
// The REAL admin.html in Chromium (network stubbed), the REAL generateAIDesign; callUniversalAI stubbed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!fs.readFileSync('public/quiz-cover.js', 'utf8').includes("id: 'or/meta/muse-image'"), 'Quiz cover no longer offers Muse Image');
const PUB = path.resolve('public').replace(/\\/g, '/');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        page.on('dialog', d => d.dismiss());
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.generateAIDesign === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);

        // one Create run on an engine: proceed through the prompt modal, return the image call's options + the button afterwards
        const run = (engine, fail) => page.evaluate(async ({ engine, fail, PNG }) => {
            selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="' + engine + '"]'));
            document.getElementById('design-prompt').value = 'warfarin INR target infographic';
            const calls = [];
            window.callUniversalAI = async (model, prompt, isJson, vision, sys, opts) => {
                calls.push({ model, opts: opts || {} });
                if (opts && opts.feature === 'design_enhance') return { text: 'An infographic about the INR target' };
                if (fail) throw new Error('upstream 503');
                return { text: PNG };
            };
            const done = window.generateAIDesign();
            for (let i = 0; i < 50 && document.getElementById('aiDesignPromptModal').style.display !== 'flex'; i++) await new Promise(r => setTimeout(r, 20));
            document.getElementById('btn-design-proceed').click();
            let err = null; try { await done; } catch (e) { err = e.name + ': ' + e.message; }
            const btn = document.getElementById('btn-generate-design');
            const img = calls.find(c => c.opts.feature === 'design_image') || {};
            return { err, model: img.model, imageApi: !!img.opts.imageApi, btnDisabled: btn.disabled, btnText: btn.textContent.trim(), shown: !!document.getElementById('generated-image') };
        }, { engine, fail, PNG });

        const seed = await run('or/bytedance-seed/seedream-5-0-flash');
        assert.deepEqual(seed, { err: null, model: 'or/bytedance-seed/seedream-5-0-flash', imageApi: true, btnDisabled: false, btnText: 'Create', shown: true }, 'Seedream → Image API, button back: ' + JSON.stringify(seed));
        const sun = await run('or/openai/gpt-image-2.5-sunburst');
        assert.deepEqual([sun.err, sun.imageApi, sun.btnDisabled, sun.btnText], [null, true, false, 'Create'], 'Sunburst → Image API: ' + JSON.stringify(sun));
        const img2 = await run('or/openai/gpt-5.4-image-2');
        assert.deepEqual([img2.err, img2.imageApi, img2.btnText], [null, false, 'Create'], 'Image 2 stays on chat completions: ' + JSON.stringify(img2));
        const nb = await run('as/gemini-nano-banana-2.1');
        assert.deepEqual([nb.err, nb.imageApi, nb.btnText], [null, false, 'Create'], 'Nano Banana unchanged');
        const bad = await run('or/bytedance-seed/seedream-5-0-flash', true);
        assert.deepEqual([bad.err, bad.btnDisabled, bad.btnText], [null, false, 'Create'], 'a failed render also frees the button: ' + JSON.stringify(bad));

        // the saved pick survives a reload (DESIGN_ENGINE_VALID knows the new ids)
        await page.reload();
        await page.waitForFunction(() => typeof window.generateAIDesign === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        assert.equal(await page.inputValue('#design-engine'), 'or/bytedance-seed/seedream-5-0-flash', 'pick restored');

        assert.deepEqual(errs, [],'no page errors: ' + errs.join(' | '));
        console.log('PASS design-image-models-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
