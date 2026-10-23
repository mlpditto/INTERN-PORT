// V102.383: Grand Line Deck / Miss Goldenweek — (1) the generated picture is read from the reply's image fields first (imageDataUrl /
// dataUrl / data[0] / markdown ![](url) / bare base64), never the model's text note (Nano Banana returns both → the note rendered as a
// broken <img>); a text-only reply is a clear error that quotes the text, and the Download / Copy bar hides while a new image renders;
// (2) a one-click 📋 Copy on the AI Refined Prompt modal. The REAL admin.html + the REAL generateAIDesign; callUniversalAI stubbed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.match(html, /<title>Nika Admin \(V102\.(?:38[3-9]|39\d|[4-9]\d\d)\)<\/title>/, 'admin V102.383+');
assert.ok(html.includes('window.gmImageSrcOf = function (resp) {') && html.includes('const imageUrl = window.gmImageSrcOf(imgResp);') && !html.includes('const { text: imageUrl } = await callUniversalAI(engine'), 'the design generator reads the image through gmImageSrcOf');
assert.ok(html.includes('id="btn-design-copy"') && html.includes('window.copyAiDesignRefinedPrompt = async function (btn) {'), 'the Copy button + handler');
const PUB = path.resolve('public').replace(/\\/g, '/');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.generateAIDesign === 'function' && typeof window.gmImageSrcOf === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);

        const unit = await page.evaluate(PNG => [
            gmImageSrcOf({ text: 'Here is your infographic.', imageDataUrl: PNG }) === PNG,
            gmImageSrcOf({ text: PNG }) === PNG,
            gmImageSrcOf({ raw: { data: [{ url: 'https://cdn.test/a.png' }] }, text: '' }),
            gmImageSrcOf({ text: 'Done! ![infographic](https://cdn.test/b.png)' }),
            gmImageSrcOf({ text: 'iVBORw0KGgo' + 'A'.repeat(120) }).slice(0, 30),
            gmImageSrcOf({ text: 'I cannot create that image.' }),
            gmImageSrcOf(null), gmImageSrcOf({ raw: { data: [{ b64_json: 'QUJD' + 'A'.repeat(120) }] } }).slice(0, 22)
        ], PNG);
        assert.deepEqual(unit, [true, true, 'https://cdn.test/a.png', 'https://cdn.test/b.png', 'data:image/png;base64,iVBORw0K', '', '', 'data:image/png;base64,'], 'gmImageSrcOf: bytes first, URL, markdown, bare base64, text-only → empty: ' + JSON.stringify(unit));

        // the REAL generator: note + image → the image; text only → the error pane quoting the text, no Download bar
        const run = reply => page.evaluate(async ({ reply, PNG }) => {
            selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="as/gemini-nano-banana-2.1"]'));
            document.getElementById('design-prompt').value = 'restaurant rules infographic';
            window.callUniversalAI = async (model, prompt, isJson, vision, sys, opts) => (opts && opts.feature === 'design_enhance') ? { text: '[TASK]: an infographic' } : reply;
            const toasts = []; window.showToast = m => toasts.push(m);
            const done = window.generateAIDesign();
            for (let i = 0; i < 50 && document.getElementById('aiDesignPromptModal').style.display !== 'flex'; i++) await new Promise(r => setTimeout(r, 20));
            document.getElementById('btn-design-proceed').click();
            let err = null; try { await done; } catch (e) { err = e.message; }
            const img = document.getElementById('generated-image');
            return { err, src: img ? img.getAttribute('src') : null, actions: getComputedStyle(document.getElementById('design-actions')).display, pane: document.getElementById('design-preview-container').textContent.replace(/\s+/g, ' ').trim().slice(0, 160), toasts, btn: document.getElementById('btn-generate-design').textContent.trim() };
        }, { reply, PNG });
        const good = await run({ text: 'Here is your infographic. I kept the palette teal and blue.', imageDataUrl: PNG });
        assert.deepEqual([good.err, good.src === PNG, good.actions, good.btn, good.toasts.pop()], [null, true, 'flex', 'Create', '✨ Masterpiece created!'], 'note + image → the image renders, bar shown: ' + JSON.stringify(good));
        const bad = await run({ text: 'I cannot create that image because it contains flags.' });
        assert.deepEqual([bad.err, bad.src, bad.actions, bad.btn], [null, null, 'none', 'Create'], 'text only → no <img>, the bar (left over from the previous image) is hidden: ' + JSON.stringify(bad));
        assert.match(bad.pane, /answered with text instead of an image: “I cannot create that image because it contains flags\.”/, 'the error pane quotes the model: ' + bad.pane);
        assert.match(dialogs[dialogs.length - 1] || '', /Generation Error: The model answered with text/, 'the alert says the same');

        // one-click Copy on the refined prompt
        const copy = await page.evaluate(async () => {
            const ta = document.getElementById('ai-design-refined-text'); ta.value = '👉 [TASK]: Create a comparative infographic\n👉 [CONTEXT]: …';
            const got = []; navigator.clipboard.writeText = async t => { got.push(t); };
            const toasts = []; window.showToast = m => toasts.push(m);
            const btn = document.getElementById('btn-design-copy'), footer = btn.parentElement;
            const before = btn.textContent.trim();
            await copyAiDesignRefinedPrompt(btn);
            const during = btn.textContent.trim();
            await new Promise(r => setTimeout(r, 1700));
            return { got, before, during, after: btn.textContent.trim(), toasts, first: footer.firstElementChild === btn, pushLeft: btn.style.marginRight === 'auto', order: [...footer.querySelectorAll('button')].map(b => b.textContent.trim()) };
        });
        assert.deepEqual([copy.got, copy.before, copy.during, copy.after, copy.toasts, copy.first, copy.pushLeft, copy.order], [['👉 [TASK]: Create a comparative infographic\n👉 [CONTEXT]: …'], 'Copy', 'Copied', 'Copy', ['📋 Prompt copied'], true, true, ['Copy', 'Cancel', 'Create Masterpiece']],
            'Copy: the whole prompt to the clipboard, "Copied" for 1.5 s, sits left of Cancel / Create: ' + JSON.stringify(copy));
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: design image = bytes before the model\'s note (gmImageSrcOf), text-only reply → quoted error + hidden bar; one-click 📋 Copy on the refined prompt');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
