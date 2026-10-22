// V102.314: Grand Line Deck friction fixes. The REAL admin.html in Chromium (network stubbed):
// the style tile survives a reload (design_style_pref) and keeps the Master Formula hint; in clip mode a style pick leaves the series
// placeholder alone; the clip chips' ghost comes from GLC_ENGINES (one source); the render spinner names the chosen engine;
// the Codex Gallery shows no "Loading…" before a load and its button stays one line.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('⏳ Loading the pathophysiology'), 'no Loading text before a load');
assert.ok(!html.includes('<p style="color:#888;">Gemini Omni Flash · 9:16'), 'the spinner is not hard-wired to Omni Flash');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
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
            await page.waitForFunction(() => typeof window.selectDesignStyle === 'function' && typeof window.glcPaintGhosts === 'function', null, { timeout: 30000 });
            await page.waitForTimeout(400);
        };
        await load();
        await page.evaluate(() => { localStorage.removeItem('design_style_pref'); localStorage.removeItem('design_engine_model_pref'); });
        await load();

        // 1. style: default, pick, survives a reload, keeps the Master Formula hint
        const tiles = await page.$$eval('.style-option', els => els.map(e => e.dataset.style));
        assert.equal(tiles.length, 14, 'V102.333: eight pharmacy styles + the six One Piece ones');
        const def = await page.inputValue('#selected-design-style');
        assert.equal(def, tiles[0], 'default = 🧑‍⚕️ Pharmacist explainer (V102.333)');
        await page.evaluate(() => selectDesignStyle(document.querySelectorAll('.style-option')[4]));
        assert.match(await page.$eval('#design-prompt', e => e.placeholder), /^\[Context \+ Goal \+ Source \+ Expectations\]/, 'a style pick keeps the formula hint');
        assert.equal(await page.evaluate(() => localStorage.getItem('design_style_pref')), tiles[4], 'pick saved');
        await load();
        assert.equal(await page.inputValue('#selected-design-style'), tiles[4], 'restored after a reload');
        assert.equal(await page.$eval('.style-option.active', e => e.dataset.style), tiles[4], 'the restored tile is the active one');
        // a tile that no longer exists → default, key dropped
        await page.evaluate(() => localStorage.setItem('design_style_pref', 'a style that was removed'));
        await load();
        assert.equal(await page.inputValue('#selected-design-style'), tiles[0], 'unknown saved style → default');
        assert.equal(await page.evaluate(() => localStorage.getItem('design_style_pref')), null, 'stale key removed');

        // 2. clip mode: a style pick leaves the series placeholder; back to image mode shows the formula hint
        await page.evaluate(() => selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="or/google/veo-3.1-lite"]')));
        await page.evaluate(() => selectDesignStyle(document.querySelectorAll('.style-option')[2]));
        assert.match(await page.$eval('#design-prompt', e => e.placeholder), /10-episode 9:16 series/, 'clip placeholder stays');
        await page.evaluate(() => selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="as/gemini-nano-banana-2.1"]')));
        assert.match(await page.$eval('#design-prompt', e => e.placeholder), /^\[Context \+ Goal/, 'image mode: formula hint back');

        // 3. ghosts come from GLC_ENGINES
        const ghost = () => page.$eval('.alabasta-genmage-quick-chip[data-value="or/google/veo-3.1-lite"] .gm-ghost', e => e.textContent);
        assert.equal(await ghost(), '8 s · $0.40');
        await page.evaluate(() => { GLC_ENGINES['or/google/veo-3.1-lite'].usd = 0.07; glcPaintGhosts(); });
        assert.equal(await ghost(), '8 s · $0.56', 'a price change in GLC_ENGINES reaches the chip');
        assert.equal(await page.$eval('.alabasta-genmage-quick-chip[data-value="as/gemini-nano-banana-2.1"] .gm-ghost', e => e.textContent), '$0.03', 'image chips keep their own ghost');

        // 4. Plan says free; steps line + series total; the spinner names the engine
        await page.evaluate(() => selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="or/kwaivgi/kling-v3.0-std"]')));
        assert.match(await page.$eval('#btn-generate-design', e => e.textContent), /Plan 10 episodes$/);
        const steps = await page.evaluate(() => {
            window._glcSeries = { id: '', topic: 't', style: 's', episodes: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, title: 'E' + (i + 1), status: i < 2 ? 'done' : 'planned', costUsd: i < 2 ? 1 : 0, seconds: 8 })) };
            glcRenderEpisodes();
            return [...document.querySelectorAll('#glc-steps .glc-step')].map(e => e.textContent);
        });
        assert.deepEqual(steps, ['① Plan · free ✓', '② ▶ Render one at a time · paid · 2/10', '💰 $2.00 / ≈ $10.08 series'], 'steps follow the engine and what was rendered');
        const spin = await page.evaluate(() => {
            window.callUniversalAI = () => new Promise(() => {});   // never answers: we only read the spinner
            glcRenderEpisode(3);
            return document.getElementById('design-preview-container').textContent;
        });
        assert.match(spin, /Rendering EP03…Kling 3\.0 Std · 9:16 · 8 s/, 'spinner names the chosen engine: ' + spin.slice(0, 80));

        // 5. gallery: placeholder text, button one line
        assert.match(await page.$eval('#mgw-gallery-empty', e => e.textContent), /show here/);
        assert.equal(await page.$eval('#mgw-gallery-load-btn', e => getComputedStyle(e).whiteSpace), 'nowrap');

        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS deck-friction-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
