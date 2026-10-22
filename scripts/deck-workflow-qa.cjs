// V102.316: Grand Line Deck as a workflow (mockup C + D). The REAL admin.html in Chromium (network stubbed), the REAL
// composer + Episodes card; callUniversalAI, Storage and Firestore stubbed (nothing leaves the page).
// C — step strip, Intent (engine family + hidden chips + last engine per family), 4-field Brief ⇄ free text, 🎨 style line,
//     🎞 One clip plans ONE episode. D — ☑ episodes, the bar's count + total, confirm, render one at a time, ⏹ stop after
//     the current one, every clip kept in memory (👁), 💾 Save all, a new plan refused while clips are unsaved.
// V102.345: a render saves itself; the "not saved" bar + 💾 Save all now cover uploads that FAILED (the test makes Storage fail).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('id="gm-steps"') && html.includes('id="gm-intent"') && html.includes('id="gm-brief"') && html.includes('id="glc-selbar"'), 'workflow markup present');
const PUB = path.resolve('public').replace(/\\/g, '/');
const MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t';

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
        const load = async () => {
            await page.goto('file:///' + PUB + '/admin.html');
            await page.waitForFunction(() => typeof window.gmInitWorkflow === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
            await page.waitForTimeout(400);
            await page.evaluate(() => {   // show the hub tab in design mode; hide fixed overlays (sign-in prompt, guide) so clicks land
                const hub = document.getElementById('tab-ai-hub');
                document.querySelectorAll('.tab-content').forEach(t => { t.style.display = t === hub ? 'block' : 'none'; });
                let el = hub.parentElement; while (el && el !== document.body) { if (getComputedStyle(el).display === 'none') el.style.display = 'block'; el = el.parentElement; }
                if (typeof switchHubMode === 'function') try { switchHubMode('design'); } catch (_) {}
                document.querySelectorAll('body *').forEach(x => { if (getComputedStyle(x).position === 'fixed' && !hub.contains(x)) x.style.display = 'none'; });
            });
        };
        await load();
        await page.evaluate(() => { ['design_intent_pref', 'design_brief_mode', 'design_engine_model_pref', 'design_clip_engine_pref', 'design_image_engine_pref', 'design_style_pref'].forEach(k => localStorage.removeItem(k)); });
        await load();
        const steps = () => page.$$eval('#gm-steps .gm-st', els => els.map(e => (e.classList.contains('done') ? '✓' : e.classList.contains('now') ? '▶' : '·') + e.textContent.replace(/^[✓\d]/, '')));
        const visibleChips = () => page.$$eval('.alabasta-genmage-quick-rail[aria-label="Engine quick switch"] .alabasta-genmage-quick-chip', els => els.filter(e => !e.hidden && getComputedStyle(e).display !== 'none').map(e => e.dataset.value));

        // 1. defaults: image intent, image chips only, Brief is the current step, 4 fields shown, textarea hidden
        assert.deepEqual(await page.$$eval('#gm-intent button.on', b => b.map(x => x.dataset.intent)), ['image']);
        assert.deepEqual(await visibleChips(), ['as/gemini-nano-banana-2.1', 'or/openai/gpt-5.4-image-2', 'or/bytedance-seed/seedream-5-0-flash', 'or/openai/gpt-image-2.5-sunburst'], 'image intent shows image engines only (V102.315: + Seedream 5 · Sunburst)');
        assert.deepEqual(await steps(), ['✓Intent🖼 Image', '▶Brief', '·Style', '·Enhance', '·Createpaid', '·Review']);
        assert.equal(await page.isVisible('#gm-brief'), true); assert.equal(await page.isVisible('#design-prompt'), false);
        assert.match(await page.textContent('#gm-style-text'), /friendly Thai pharmacist in a white coat/, '🎨 line shows the default style (V102.333: Pharmacist explainer)');

        // 2. Brief fields → one prompt
        await page.fill('#gm-brief input[data-k="Context"]', 'Community pharmacy, new warfarin patients');
        await page.fill('#gm-brief input[data-k="Goal"]', 'Say their INR target');
        assert.equal(await page.inputValue('#design-prompt'), 'Context: Community pharmacy, new warfarin patients\nGoal: Say their INR target');
        assert.match(await page.textContent('#gm-brief-count'), /^2 of 4 filled/);
        assert.deepEqual(await page.$$eval('#gm-brief .gm-f.ok', e => e.map(x => x.dataset.f)), ['Context', 'Goal']);
        assert.deepEqual(await steps(), ['✓Intent🖼 Image', '✓Brief', '✓Style', '▶Enhance', '·Createpaid', '·Review']);
        await page.evaluate(() => selectDesignStyle(document.querySelectorAll('.style-option')[3]));
        assert.match(await page.textContent('#gm-style-text'), /flat vector infographic/i, '🎨 line follows the chip (V102.333: the 4th chip is 💊 Clean infographic)');

        // 3. ⇄ Free text and back: labelled lines go to their field, other lines to Context; the mode survives a reload
        await page.click('#gm-brief-toggle');
        assert.equal(await page.isVisible('#design-prompt'), true); assert.equal(await page.isVisible('#gm-brief'), false);
        assert.equal(await page.textContent('#gm-brief-toggle'), '⇄ 4 fields');
        await page.fill('#design-prompt', 'Goal: Say their INR target\nSource: Thai guideline\nolder patients too');
        await page.click('#gm-brief-toggle');
        assert.deepEqual(await page.$$eval('#gm-brief input[data-k]', i => i.map(x => x.value)), ['older patients too', 'Say their INR target', 'Thai guideline', '']);
        await page.click('#gm-brief-toggle');
        await load();
        assert.equal(await page.isVisible('#design-prompt'), true, 'free-text mode remembered');
        await page.click('#gm-brief-toggle');
        await page.fill('#gm-brief input[data-k="Context"]', 'Warfarin counselling');

        // 4. Intent: Image 2 → Series (clip family, default Omni) → Veo Lite → Image (back to Image 2) → Series (back to Veo Lite)
        await page.evaluate(() => selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="or/openai/gpt-5.4-image-2"]')));
        await page.click('#gm-intent button[data-intent="series"]');
        assert.equal(await page.inputValue('#design-engine'), 'as/gemini-omni-1.1-flash');
        assert.ok((await visibleChips()).every(v => !/nano-banana|image-2/.test(v)) && (await visibleChips()).length >= 5, 'series intent shows clip engines only');
        assert.match(await page.textContent('#btn-generate-design'), /Plan 10 episodes/);
        await page.evaluate(() => selectDesignEngine(document.querySelector('.alabasta-genmage-quick-chip[data-value="or/google/veo-3.1-lite"]')));
        await page.click('#gm-intent button[data-intent="image"]');
        assert.equal(await page.inputValue('#design-engine'), 'or/openai/gpt-5.4-image-2', 'image intent returns to the last image engine');
        await page.click('#gm-intent button[data-intent="series"]');
        assert.equal(await page.inputValue('#design-engine'), 'or/google/veo-3.1-lite', 'series intent returns to the last clip engine');
        assert.deepEqual((await steps()).slice(3), ['▶Planfree', '·Renderpaid', '·Review']);

        // 5. 🎞 One clip: the planner is asked for ONE episode, the clip prompt says standalone
        const one = await page.evaluate(async () => {
            gmSetIntent('one');
            const label = document.getElementById('btn-generate-design').textContent.trim();
            const calls = [];
            window.callUniversalAI = async (model, prompt, isJson, v, s, opts) => { calls.push({ prompt, opts }); return { text: JSON.stringify({ episodes: [{ title: 'INR target', objective: 'o', fact: 'f', narration: 'line', visual: 'scene' }, { title: 'extra' }] }) }; };
            await glcPlanEpisodes();
            return { label, asked: /ONE short vertical/.test(calls[0].prompt) && /Exactly 1 episode, n = 1\./.test(calls[0].prompt), rows: document.querySelectorAll('#glc-episodes-list .glc-ep').length, standalone: /a standalone pharmacy teaching clip/.test(glcEpisodePrompt(window._glcSeries.episodes[0])) };
        });
        assert.deepEqual(one, { label: 'Plan 1 clip', asked: true, rows: 1, standalone: true });

        // 6. D — Series ×10 plan, ☑ EP03–05, the bar, confirm, render one at a time with ⏹ after the first
        const d = await page.evaluate(async (MP4) => {
            gmSetIntent('series');
            // V102.345: a render saves itself — here every upload FAILS (offline Storage), the case the "not saved" bar + 💾 Save all exist for
            window.firebase = { app: () => ({ storage: () => ({ ref: () => ({ put: async () => { throw new Error('offline'); } }) }) }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            window.adminApp = null;
            window.db = { collection: () => ({ doc: id => ({ id: id || 'S1', set: async () => {} }) }) };
            const plan = { episodes: Array.from({ length: 10 }, (_, i) => ({ title: 'T' + (i + 1), objective: 'o', fact: 'f', narration: 'n', visual: 'v' })) };
            window.callUniversalAI = async () => ({ text: JSON.stringify(plan) });
            await glcPlanEpisodes();
            const out = { rows: document.querySelectorAll('#glc-episodes-list .glc-ep').length, allN: document.getElementById('glc-all-n').textContent, barHidden: document.getElementById('glc-selbar').hidden };
            [3, 4, 5].forEach(n => { const c = document.querySelector('#glc-ep-' + n + ' .glc-ck'); c.checked = true; c.dispatchEvent(new Event('change')); });
            out.bar = document.getElementById('glc-selbar').textContent;
            document.querySelector('#glc-selbar button.go').click();
            out.ask = document.getElementById('glc-selbar').textContent;
            document.querySelector('#glc-selbar button[aria-label="Cancel"]').click();
            out.afterCancel = document.getElementById('glc-selbar').textContent;
            document.querySelector('#glc-selbar button.go').click();
            // renders wait on a gate so the bar can be read mid-batch
            const renders = []; let open; window.__gate = new Promise(r => { open = r; });
            window.callUniversalAI = async (model, prompt, isJson, v, s, opts) => { renders.push(prompt.match(/episode (\d+)/)[1]); await window.__gate; return { text: '', raw: { videoDataUrl: MP4, seconds: 8, costUsd: 0.4, model: 'google/veo-3.1-lite' } }; };
            const run = glcRenderSelected();
            await new Promise(r => setTimeout(r, 30));
            out.during = document.getElementById('glc-selbar').textContent;
            out.rowPlayDisabled = document.querySelector('#glc-ep-7 button[aria-label="Render episode 7"]').disabled;
            out.ckDisabled = document.querySelector('#glc-ep-7 .glc-ck').disabled;
            document.querySelector('#glc-selbar button.stop').click();
            out.stopping = document.getElementById('glc-selbar').textContent;
            open(); await run;
            out.renders = renders;
            out.status = window._glcSeries.episodes.slice(2, 5).map(e => e.status);
            out.left = Array.from(window._glcSel);
            out.barAfter = document.getElementById('glc-selbar').textContent;
            return out;
        }, MP4);
        assert.deepEqual([d.rows, d.allN, d.barHidden], [10, '10', true]);
        assert.match(d.bar, /^☑ 3 selected · EP03 · EP04 · EP05 · Veo 3\.1 Lite · 3 × \$0\.40 = ≈ \$1\.20/, d.bar);
        assert.match(d.ask, /^Render 3 clips · Veo 3\.1 Lite · ≈ \$1\.20 · you pay per clip that comes back/, 'confirm shows the total');
        assert.match(d.afterCancel, /^☑ 3 selected/, '✕ goes back to the selection');
        assert.match(d.during, /^⏳ Rendering EP03 · 0 of 3 done · spent \$0\.00 of ≈ \$1\.20⏹ Stop after this one/, d.during);
        assert.deepEqual([d.rowPlayDisabled, d.ckDisabled], [true, true], 'row ▶ and ☑ are off during a batch');
        assert.match(d.stopping, /Stopping after this one…/);
        assert.deepEqual(d.renders, ['3'], 'stop after the current one: only EP03 rendered');
        assert.deepEqual(d.status, ['done', 'planned', 'planned']);
        assert.deepEqual(d.left, [4, 5], 'the rest stay selected');
        assert.match(d.barAfter, /☑ 2 selected · EP04 · EP05[\s\S]*💾 1 rendered, not saved · EP03💾 Save all \(1\)/, d.barAfter);

        // 7. render the other two, every clip kept (👁 shows EP03 again), a new plan is refused, 💾 Save all writes each
        const s = await page.evaluate(async (MP4) => {
            window.callUniversalAI = async () => ({ text: '', raw: { videoDataUrl: MP4 + Math.random().toString(36).slice(2, 6), seconds: 8, costUsd: 0.4, model: 'google/veo-3.1-lite' } });
            await glcRenderSelected();
            const out = { kept: Object.keys(window._glcClips).sort(), eyes: document.querySelectorAll('#glc-episodes-list button[aria-label^="Show episode"]').length };
            glcShowClip(3); out.shown = window._glcClip.n;
            const before = window._glcSeries.episodes.length;
            const toasts = []; const t0 = window.showToast; window.showToast = (m) => toasts.push(m);
            window.callUniversalAI = async () => { throw new Error('should not plan'); };
            await glcPlanEpisodes();
            window.showToast = t0;
            out.refused = toasts.some(m => /Save \(or 🗑 discard\) the 3 rendered clips first/.test(m)) && window._glcSeries.episodes.length === before;
            const io = { puts: [], sets: 0 };
            window.firebase = { app: () => ({ storage: () => ({ ref: p => ({ put: async () => { io.puts.push(p); return { ref: { getDownloadURL: async () => 'https://storage.test/' + p } }; } }) }) }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            window.adminApp = null;
            window.db = { collection: () => ({ doc: id => ({ id: id || 'S1', set: async () => { io.sets++; } }) }) };
            await glcSaveAll();
            out.puts = io.puts; out.sets = io.sets;
            out.unsaved = glcUnsaved().length;
            out.barHidden = document.getElementById('glc-selbar').hidden;
            out.steps = Array.from(document.querySelectorAll('#gm-steps .gm-st')).map(e => (e.classList.contains('done') ? '✓' : e.classList.contains('now') ? '▶' : '·') + e.textContent.replace(/^[✓\d]/, ''));
            return out;
        }, MP4);
        assert.deepEqual([s.kept, s.eyes, s.shown], [['3', '4', '5'], 3, 3], 'three clips in memory, 👁 on each, EP03 can be shown again');
        assert.equal(s.refused, true, 'a new plan is refused while clips are unsaved');
        assert.deepEqual(s.puts, ['teach-clips/S1/EP03.mp4', 'teach-clips/S1/EP04.mp4', 'teach-clips/S1/EP05.mp4'], '💾 Save all uploads each clip');
        assert.deepEqual([s.sets, s.unsaved, s.barHidden], [3, 0, true]);
        assert.deepEqual(s.steps.slice(3), ['✓Planfree', '▶Renderpaid', '·Review'], 'Render stays current until every episode is done');

        // 8. phone width: no horizontal overflow in the composer card
        await page.setViewportSize({ width: 600, height: 900 });
        const ov = await page.$eval('#hub-view-design > div', e => e.scrollWidth - e.clientWidth);
        assert.ok(ov <= 1, 'composer card fits at 600 px: ' + ov);

        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS deck-workflow-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
