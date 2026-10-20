// V102.333: Visual Style lives in the Brief. The REAL admin.html in Chromium (network stubbed), callUniversalAI stubbed.
// Miss Goldenweek has no left column (Research Log keeps it) · eight pharmacy chips first, default 🧑‍⚕️ Pharmacist explainer ·
// the six One Piece styles behind one chip (a saved One Piece pick still restores and opens its group) · the 🛡️ line rides on
// the enhancer prompt, the image prompt, the clip planner and every clip prompt.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('id="design-style-grid"') && !html.includes('🖌️ Visual Style Collection'), 'the left-column tiles are gone');
assert.ok(/<div id="gm-styles"[\s\S]*?<input type="hidden" id="selected-design-style"/.test(html), 'the style value lives in the Brief');
assert.ok(html.includes('Always keep in the final prompt: ${window.GM_STYLE_SAFE}'), 'the regular enhancer template carries the 🛡️ line too');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SAFE = 'original characters only — not resembling any existing franchise, celebrity or brand; modest professional clothing; no logos';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        page.on('dialog', d => d.dismiss());
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        const load = async (fresh) => {
            await page.goto('file:///' + PUB + '/admin.html');
            await page.waitForFunction(() => typeof window.gmToggleOnePiece === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
            await page.waitForTimeout(400);
            await page.evaluate((fresh) => {
                const hub = document.getElementById('tab-ai-hub');
                document.querySelectorAll('.tab-content').forEach(t => { t.style.display = t === hub ? 'block' : 'none'; });
                let el = hub.parentElement; while (el && el !== document.body) { if (getComputedStyle(el).display === 'none') el.style.display = 'block'; el = el.parentElement; }
                if (!fresh) switchHubMode('design');   // V102.334: fresh = the page as it opens, no mode switch (V102.333 showed an empty AI ARCHITECTURE card there)
                document.querySelectorAll('body *').forEach(x => { if (getComputedStyle(x).position === 'fixed' && !hub.contains(x)) x.style.display = 'none'; });
            }, !!fresh);
        };
        const cols = () => page.evaluate(() => [document.getElementById('hub-sidebar-main').style.display, document.getElementById('hub-grid-container').style.gridTemplateColumns]);
        // 0. V102.334: as the page opens (no mode switch yet) — no left column, no empty card
        await load(true);
        assert.deepEqual(await cols(), ['none', '1fr'], 'fresh load: Miss Goldenweek opens full width');
        assert.equal(await page.isVisible('#hub-sidebar-main'), false, 'no empty AI ARCHITECTURE card on open');
        await page.evaluate(() => { localStorage.removeItem('design_style_pref'); localStorage.removeItem('design_engine_model_pref'); });
        await load();

        // 1. no left column in Miss Goldenweek; Research Log keeps it
        assert.deepEqual(await cols(), ['none', '1fr'], 'design: full width');
        await page.evaluate(() => switchHubMode('research'));
        assert.deepEqual(await cols(), ['block', '350px 1fr'], 'research keeps its column');
        await page.evaluate(() => switchHubMode('design'));

        // 2. the rail: eight pharmacy chips, the One Piece group folded, default Pharmacist explainer, the 🛡️ line
        const rail = () => page.evaluate(() => Array.from(document.querySelectorAll('#gm-styles .gm-sc')).filter(b => b.offsetParent).map(b => b.textContent.trim()));
        assert.deepEqual(await rail(), ['🧑‍⚕️ Pharmacist explainer', '🏪 Community pharmacy', '🏥 Hospital pharmacy', '💊 Clean infographic', '✏️ Whiteboard doodle', '🔬 3D pharmacology', '🧸 Soft clay', '👵 Easy to see', '🏴‍☠️ One Piece ＋6']);
        assert.equal(await page.$eval('#gm-styles .gm-sc.active', b => [b.textContent.trim(), b.getAttribute('aria-checked')].join('|')), '🧑‍⚕️ Pharmacist explainer|true');
        assert.match(await page.textContent('#gm-style-text'), /^friendly Thai pharmacist in a white coat/);
        assert.equal((await page.textContent('#hub-view-design .gm-safe')).trim(), '🛡️ Always added: ' + SAFE);
        await page.click('#gm-op-toggle');
        assert.equal((await rail()).length, 15, 'the six One Piece styles open after the chip');
        assert.equal(await page.getAttribute('#gm-op-toggle', 'aria-expanded'), 'true');
        await page.click('#gm-op-toggle');
        assert.equal((await rail()).length, 9, 'and fold again');

        // 3. a One Piece pick is remembered and opens its group after a reload; a pharmacy pick closes nothing
        await page.click('#gm-op-toggle');
        await page.click('#gm-op-styles .gm-sc >> nth=0');
        assert.match(await page.inputValue('#selected-design-style'), /^one piece anime pirate crew/);
        await load();
        assert.match(await page.inputValue('#selected-design-style'), /^one piece anime pirate crew/, 'restored');
        assert.equal(await page.getAttribute('#gm-op-toggle', 'aria-expanded'), 'true', 'the restored One Piece pick shows its group');
        await page.click('#gm-styles .gm-sc >> nth=3');
        assert.match(await page.inputValue('#selected-design-style'), /^flat vector infographic/);

        // 4. the 🛡️ line on every prompt that renders something
        const p = await page.evaluate(async ({ PNG }) => {
            selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="as/gemini-nano-banana-2.1"]'));
            document.getElementById('design-prompt').value = 'INR target';
            const calls = [];
            window.callUniversalAI = async (model, prompt, isJson, v, s, opts) => { calls.push({ prompt, opts: opts || {} }); return { text: opts && opts.feature === 'design_enhance' ? 'An infographic about INR' : PNG }; };
            const done = generateAIDesign();
            for (let i = 0; i < 50 && document.getElementById('aiDesignPromptModal').style.display !== 'flex'; i++) await new Promise(r => setTimeout(r, 20));
            document.getElementById('btn-design-proceed').click(); await done;
            const enh = calls.find(c => c.opts.feature === 'design_enhance'), img = calls.find(c => c.opts.feature === 'design_image');
            selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="or/google/veo-3.1-lite"]'));
            const plans = [];
            window.callUniversalAI = async (model, prompt) => { plans.push(prompt); return { text: JSON.stringify({ episodes: [{ title: 'T', objective: 'o', fact: 'f', narration: 'n', visual: 'v' }] }) }; };
            await glcPlanEpisodes();
            return { enh: enh.prompt, img: img.prompt, plan: plans[0], clip: glcEpisodePrompt(window._glcSeries.episodes[0]) };
        }, { PNG });
        assert.ok(p.enh.includes('Under [CONSTRAINT] always keep: ' + SAFE) && p.enh.includes('Visual style: flat vector infographic'), 'the infographic enhancer is told the style and the line (it had neither)');
        assert.ok(p.img.endsWith(SAFE) && p.img.split(SAFE).length === 2, 'the image prompt ends with it once');
        assert.ok(p.plan.includes('Characters: ' + SAFE), 'the clip planner');
        assert.ok(p.clip.includes('Characters: ' + SAFE), 'every clip prompt');

        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS deck-style-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
