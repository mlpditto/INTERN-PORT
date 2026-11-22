// V102.699 (owner pick D, mockup-dxa-autodraft-lean/): Disease Codex AI Auto-Draft is the toolbar row itself. 🤖 → the name input takes the
// search box's place, + Add steps aside, 🤖 reads ▸ Generate, ✕ goes back; no yellow panel, no second model rail (the model chip's rail drops
// open under the row on tap and folds on a pick). Enter generates (progress on the same button), Esc closes, an empty name / a failure shows
// the error line and leaves ▸ Generate ready. The REAL admin.html, callUniversalAI stubbed.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { try { localStorage.setItem('adminGuideSeen', '1'); } catch (e) {} window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof dxaSwitchView === 'function' && typeof dxaAutoDraftBtn === 'function' && window.dxaRenderListModelChip, null, { timeout: 30000 });
        await page.waitForTimeout(700);
        await page.evaluate(() => {
            window.__calls = []; window.callUniversalAI = (m, p) => new Promise((res, rej) => { window.__calls.push({ m }); window.__res = res; window.__rej = rej; });
            const m = document.getElementById('diseaseCodexAdminModal'); m.style.display = 'flex'; m.classList.add('force-show');
            dxaSwitchView('published');
        });
        const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);
        const btn = () => page.$eval('#dxa-view-published .dxa-ad-btn', e => e.textContent.trim());

        // at rest: search + capsule + Add; nothing of the Auto-Draft row; no yellow panel anywhere
        assert.ok(await vis('#dxa-search') && await vis('#dxa-view-published .dca-add-btn'), 'search + Add at rest');
        assert.ok(!(await vis('#dxa-ai-name')) && !(await vis('#dxa-ai-close')) && !(await vis('#dxa-ai-input-row')), 'no name input, no ✕, no panel at rest');
        assert.equal(await btn(), '🤖 AI Auto-Draft');

        // open: one row — name input where search was, ▸ Generate, model chip, ✕
        await page.click('#dxa-view-published .dxa-ad-btn');
        assert.ok(await vis('#dxa-ai-name') && await vis('#dxa-ai-close'), 'name input + ✕ shown');
        assert.ok(!(await vis('#dxa-search')) && !(await vis('#dxa-view-published .dca-add-btn')), 'search + Add step aside');
        assert.ok(!(await vis('#dxa-ai-input-row')) && !(await vis('#dxa-ai-chip-rail')), 'no yellow panel, no second model rail');
        assert.equal(await btn(), '▸ Generate');
        await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'dxa-ai-name', null, { timeout: 2000 });   // focus lands after 40 ms
        const row = await page.evaluate(() => { const ids = ['dxa-ai-name', 'dxa-ai-model-toggle', 'dxa-ai-close']; const tops = ids.map(i => document.getElementById(i).getBoundingClientRect()).map(r => Math.round((r.top + r.bottom) / 2)); const b = document.querySelector('#dxa-view-published .dxa-ad-btn').getBoundingClientRect(); tops.push(Math.round((b.top + b.bottom) / 2)); return Math.max(...tops) - Math.min(...tops); });
        assert.ok(row <= 6, 'everything on one row (centre spread ' + row + ' px)');
        if (process.env.QA_SHOT) { await page.fill('#dxa-ai-name', 'Arsenic poisoning'); const r = await page.$eval('#dxa-view-published .dca-toolbar', e => { const b = e.getBoundingClientRect(); return { x: b.left - 8, y: b.top - 8, width: b.width + 16, height: b.height + 16 }; }); await page.screenshot({ path: process.env.QA_SHOT, clip: r }); await page.fill('#dxa-ai-name', ''); }

        // the model: only the chip; its rail drops open under the row and a pick folds it
        await page.click('#dxa-ai-model-toggle');
        assert.ok(await vis('#dxa-ai-models'), 'rail opens on tap');
        assert.ok(await page.evaluate(() => document.getElementById('dxa-ai-models').getBoundingClientRect().top >= document.querySelector('#dxa-view-published .dca-toolbar').getBoundingClientRect().bottom - 1), 'rail sits under the row');
        await page.evaluate(() => document.querySelector('#dxa-ai-models [data-value]').click());
        assert.ok(!(await vis('#dxa-ai-models')), 'a pick folds the rail');
        assert.ok(await vis('#dxa-ai-name'), 'still in Auto-Draft after a pick');

        // empty name → error line, button ready
        await page.click('#dxa-view-published .dxa-ad-btn');
        assert.ok(await vis('#dxa-ai-error') && /Type a disease name/.test(await page.textContent('#dxa-ai-error')), 'empty name → error');
        assert.equal(await page.evaluate(() => window.__calls.length), 0, 'no AI call without a name');

        // Enter generates; progress on the same button; a failure keeps the row with ▸ Generate
        await page.fill('#dxa-ai-name', 'Test disease');
        await page.press('#dxa-ai-name', 'Enter');
        await page.waitForFunction(() => window.__calls.length === 1);
        assert.ok(/⏳ Generating/.test(await btn()), 'progress shows on the button: ' + await btn());
        assert.ok(await page.$eval('#dxa-view-published .dxa-ad-btn', e => e.disabled), 'button disabled while running');
        await page.evaluate(() => window.__rej(new Error('model busy')));
        await page.waitForFunction(() => /Auto-draft failed/.test(document.getElementById('dxa-ai-error').textContent));
        await page.waitForTimeout(400);
        assert.equal(await btn(), '▸ Generate', 'after a failure the button is ready again (no stale progress)');
        assert.ok(await vis('#dxa-ai-name'), 'the row stays open with the name');

        // Esc closes back to search
        await page.press('#dxa-ai-name', 'Escape');
        assert.ok(await vis('#dxa-search') && !(await vis('#dxa-ai-name')) && !(await vis('#dxa-ai-error')), 'Esc → search again, error cleared');
        assert.equal(await btn(), '🤖 AI Auto-Draft');
        // ✕ closes too
        await page.click('#dxa-view-published .dxa-ad-btn'); await page.click('#dxa-ai-close');
        assert.ok(await vis('#dxa-search') && !(await vis('#dxa-ai-close')), '✕ → search again');

        const mine = errors.filter(e => /dxa|AutoDraft/i.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: Disease Codex Auto-Draft inline (pick D) — 🤖 morphs the toolbar row (name input · ▸ Generate · model chip · ✕), no panel / second rail, rail on tap folds on pick, Enter / Esc / ✕, empty + failure keep the row ready');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
