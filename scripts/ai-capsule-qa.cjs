// V102.475 (owner pick A2) — the AI capsule on the Drug + Disease Codex. The REAL admin.html, callUniversalAI stubbed and held open by hand.
// Form header: 🤖 fill · 🔍 review · model chip are ONE capsule (copy + ⓘ beside it); list page: 🤖 AI Auto-Draft + its model chip split capsule;
// one shared model value; fill = idle → running (flipping ⏳ + elapsed time + shimmer) → done (✓, green) → idle; an error restores 🤖; reduced motion = no keyframes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { try { localStorage.setItem('adminGuideSeen', '1'); } catch (e) {} window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof dcaSwitchView === 'function' && typeof dxaSwitchView === 'function' && document.getElementById('dt-model-toggle') && window.aiCapBusy && window.dxaRenderListModelChip, null, { timeout: 30000 });
        await page.waitForTimeout(700);
        await page.evaluate(() => {
            window.__calls = []; window.callUniversalAI = (m, p, j, v, k, o) => new Promise((res, rej) => { window.__calls.push({ m, o }); window.__res = res; window.__rej = rej; });
            { const m = document.getElementById('drugCodexAdminModal'); m.style.display = 'flex'; m.classList.add('force-show'); }
        });
        const $e = (sel, fn, ...a) => page.$eval(sel, fn, ...a);

        // ======== Drug Codex · list page: 🤖 AI Auto-Draft | model chip
        await page.evaluate(() => dcaSwitchView('published'));
        const list = await page.evaluate(() => { const c = document.querySelector('#dca-view-published .ai-cap-list'); return { kids: [...c.children].map(e => e.id || e.className.split(' ')[0] + ':' + e.textContent.trim().slice(0, 30)), cap: document.querySelector('#dca-ai-model-toggle small').textContent, rail: !!document.querySelector('#dca-view-published .dca-toolbar + #dca-ai-models'), panel: !!document.querySelector('#dca-ai-input-row #dca-ai-model-toggle') }; });
        assert.match(list.kids[0], /AI Auto-Draft/); assert.equal(list.kids[1], 'dca-ai-model-toggle'); assert.equal(list.cap, 'Auto-Draft model');
        assert.equal(list.rail, true, 'the rail opens right under the toolbar row'); assert.equal(list.panel, false, 'the chip left the panel');
        await page.click('#dca-ai-model-toggle'); assert.equal(await $e('#dca-ai-models', e => e.hidden), false, 'the chip opens its rail from the list page without opening the panel');
        assert.equal(await $e('#dca-ai-input-row', e => getComputedStyle(e).display), 'none', '…and the panel stays closed');
        await page.click('#dca-ai-model-toggle');

        // ======== Drug Codex · form header capsule
        await page.evaluate(() => { dcaSwitchView('form'); dcaShowAiFillButton(); document.getElementById('dca-f-genericName').value = 'Metformin'; });
        assert.deepEqual(await page.$$eval('#dt-ai-cap > :not(.sh)', es => es.map(e => e.id)), ['dca-form-ai-fill-btn', 'dca-form-ai-review-btn', 'dt-model-toggle']);
        assert.equal(await $e('#dt-ai-cap', e => !!e.querySelector(':scope > .sh') && e.parentElement.classList.contains('dt-actions')), true, 'shimmer layer + capsule sits in the action cluster');
        assert.equal(await $e('#dt-model-toggle small', e => e.textContent), 'Fill and review');
        assert.equal(await $e('#dt-ai-cap', e => getComputedStyle(e).borderRadius.startsWith('999') || parseFloat(getComputedStyle(e).borderRadius) > 100), true, 'a pill');

        // one shared model: the list chip's rail ↔ the form chip
        await page.evaluate(() => document.querySelector('#dca-ai-models [data-value="claude-haiku-5-5"]').click());
        let names = await page.evaluate(() => [document.querySelector('.dca-ai-model-name').textContent, document.getElementById('dt-model-name').textContent, document.getElementById('dca-ai-model-val').value]);
        assert.deepEqual(names, ['Haiku 5.5', 'Haiku 5.5', 'claude-haiku-5-5'], 'pick on the list page → form chip follows');
        await page.evaluate(() => document.querySelector('#dt-models [data-value="gemini-3.8-flash"]').click());
        names = await page.evaluate(() => [document.querySelector('.dca-ai-model-name').textContent, document.getElementById('dt-model-name').textContent, document.getElementById('dca-ai-model-val').value]);
        assert.deepEqual(names, ['Flash 3.8', 'Flash 3.8', 'gemini-3.8-flash'], 'pick in the form → list chip follows');

        // ---- fill: idle → running → done → idle
        const fillTitle = await $e('#dca-form-ai-fill-btn', e => e.title);
        await page.evaluate(() => { window.__calls.length = 0; window.__fill = dcaAiFillEmptyFields(); });
        await page.waitForSelector('#dca-form-ai-fill-btn[data-ai-state="run"]');
        const run = await page.evaluate(() => { const b = document.getElementById('dca-form-ai-fill-btn'), c = document.getElementById('dt-ai-cap'); return { dis: b.disabled, cap: c.dataset.aiState, ic: b.querySelector('.aic-flip').textContent, tm: b.querySelector('.aic-tm').textContent, title: b.title, flip: getComputedStyle(b.querySelector('.aic-flip')).animationName, sh: getComputedStyle(c.querySelector('.sh')).display, shAnim: getComputedStyle(c.querySelector('.sh')).animationName, call: window.__calls.length }; });
        assert.deepEqual([run.dis, run.cap, run.ic, run.tm, run.call], [true, 'run', '⏳', '0:00', 1]); assert.match(run.title, /^Filling \d+ fields…$/);
        assert.equal(run.flip, 'aic-flip', 'the hourglass flips'); assert.equal(run.sh, 'block'); assert.equal(run.shAnim, 'aic-sh', 'the shimmer sweeps');
        await page.waitForFunction(() => document.querySelector('#dca-form-ai-fill-btn .aic-tm').textContent === '0:01', null, { timeout: 4000 });
        await page.evaluate(() => window.__res({ text: JSON.stringify({ drugClass: 'Biguanide' }), model: 'gemini-3.8-flash' }));
        await page.waitForSelector('#dt-ai-cap[data-ai-state="done"]');
        await page.waitForFunction(() => getComputedStyle(document.getElementById('dt-ai-cap')).backgroundColor === 'rgb(220, 252, 231)', null, { timeout: 1500 });   // the .2s colour transition
        const done = await page.evaluate(() => { const b = document.getElementById('dca-form-ai-fill-btn'), c = document.getElementById('dt-ai-cap'); return { txt: b.textContent, dis: b.disabled, bg: getComputedStyle(c).backgroundColor }; });
        assert.deepEqual([done.txt, done.dis, done.bg], ['✓', false, 'rgb(220, 252, 231)'], 'done = ✓ on the success green');
        await page.waitForFunction(() => !document.getElementById('dt-ai-cap').dataset.aiState && document.getElementById('dca-form-ai-fill-btn').textContent === '🤖', null, { timeout: 4000 });
        assert.equal(await $e('#dca-form-ai-fill-btn', e => e.title), fillTitle, 'the original tooltip comes back'); await page.evaluate(() => window.__fill);

        // ---- fill failing: back to 🤖 at once, no green, the form's error box says why
        await page.evaluate(() => { document.getElementById('dca-f-genericName').value = 'Metformin'; window.__fill = dcaAiFillEmptyFields(); });
        await page.waitForSelector('#dt-ai-cap[data-ai-state="run"]');
        await page.evaluate(() => window.__rej(new Error('model busy'))); await page.evaluate(() => window.__fill);
        const bad = await page.evaluate(() => ({ txt: document.getElementById('dca-form-ai-fill-btn').textContent, st: document.getElementById('dt-ai-cap').dataset.aiState || '', err: document.getElementById('dca-form-error').textContent, dis: document.getElementById('dca-form-ai-fill-btn').disabled }));
        assert.deepEqual([bad.txt, bad.st, bad.dis], ['🤖', '', false]); assert.match(bad.err, /AI fill failed: model busy/);

        // ---- review segment: the same states on its own button
        await page.evaluate(() => { const e = document.getElementById('dca-form-error'); e.style.display = 'none'; e.textContent = ''; const b = document.getElementById('dca-form-ai-review-btn'); aiCapBusy(b); });
        assert.deepEqual(await page.evaluate(() => { const b = document.getElementById('dca-form-ai-review-btn'); return [b.dataset.aiState, b.querySelector('.aic-tm').textContent, document.getElementById('dca-form-ai-fill-btn').textContent]; }), ['run', '0:00', '🤖'], 'only the busy segment shows ⏳');
        await page.evaluate(() => aiCapEnd(document.getElementById('dca-form-ai-review-btn'), '🔍', document.getElementById('dca-form-error')));
        assert.equal(await $e('#dt-ai-cap', e => e.dataset.aiState), 'done');
        await page.waitForFunction(() => document.getElementById('dca-form-ai-review-btn').textContent === '🔍' && !document.getElementById('dt-ai-cap').dataset.aiState, null, { timeout: 4000 });

        // ---- reduced motion: no keyframes, the state change alone
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => aiCapBusy(document.getElementById('dca-form-ai-fill-btn'), 'Filling 3 fields…'));
        const rm = await page.evaluate(() => ({ flip: getComputedStyle(document.querySelector('#dca-form-ai-fill-btn .aic-flip')).animationName, sh: getComputedStyle(document.querySelector('#dt-ai-cap .sh')).display, st: document.getElementById('dt-ai-cap').dataset.aiState }));
        assert.deepEqual(rm, { flip: 'none', sh: 'none', st: 'run' }, 'reduced motion: still marked running, nothing moves');
        await page.evaluate(() => aiCapEnd(document.getElementById('dca-form-ai-fill-btn'), '🤖', null)); await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.waitForFunction(() => !document.getElementById('dt-ai-cap').dataset.aiState, null, { timeout: 4000 });

        // ======== Disease Codex · list page + form header
        await page.evaluate(() => { { const d = document.getElementById('drugCodexAdminModal'); d.classList.remove('force-show'); d.style.setProperty('display', 'none', 'important'); } const m = document.getElementById('diseaseCodexAdminModal'); m.style.display = 'flex'; m.classList.add('force-show'); });
        await page.evaluate(() => dxaSwitchView('published'));
        const dl = await page.evaluate(() => { const c = document.querySelector('#dxa-view-published .ai-cap-list'); return { kids: [...c.children].map(e => e.id || e.textContent.trim().slice(0, 30)), cap: document.querySelector('#dxa-ai-model-toggle small').textContent, rail: !!document.querySelector('#dxa-view-published .dca-toolbar + #dxa-ai-models') }; });
        assert.match(dl.kids[0], /AI Auto-Draft/); assert.equal(dl.kids[1], 'dxa-ai-model-toggle'); assert.equal(dl.cap, 'Auto-Draft model'); assert.equal(dl.rail, true);
        await page.click('#dxa-ai-model-toggle'); assert.equal(await $e('#dxa-ai-models', e => e.hidden), false); await page.click('#dxa-ai-model-toggle');
        await page.evaluate(() => { dxaSwitchView('form'); dxaShowAiButtons(); });
        assert.equal(await $e('#dxa-ai-cap', e => e.hidden), false, 'the capsule shows with the AI buttons');
        assert.deepEqual(await page.$$eval('#dxa-ai-cap > :not(.sh)', es => es.map(e => e.id)), ['dxa-form-ai-fill-btn', 'dxa-form-ai-review-btn', 'dxa-form-model-wrap']);
        await page.evaluate(() => dxaHideAiButtons()); assert.equal(await $e('#dxa-ai-cap', e => e.hidden), true, 'Add mode hides the whole capsule'); await page.evaluate(() => dxaShowAiButtons());
        // one shared model: list rail pick → form chip; form rail pick → list chip
        await page.evaluate(() => document.querySelector('#dxa-ai-models [data-value="claude-haiku-5-5"]').click());
        names = await page.evaluate(() => [document.getElementById('dxa-ai-model-name').textContent, document.getElementById('dxa-form-model-name').textContent, document.getElementById('dxa-ai-model-val').value]);
        assert.deepEqual(names, ['Haiku 5.5', 'Haiku 5.5', 'claude-haiku-5-5']);
        await page.evaluate(() => document.querySelector('#dxa-form-model-rail [data-value="gemini-3.8-flash"]').click());
        names = await page.evaluate(() => [document.getElementById('dxa-ai-model-name').textContent, document.getElementById('dxa-form-model-name').textContent]);
        assert.deepEqual(names, ['Flash 3.8', 'Flash 3.8']);
        // fill states on the disease form
        await page.evaluate(() => { document.getElementById('dxa-f-diseaseName').value = 'Asthma'; window.__calls.length = 0; window.__fill = dxaAiFillEmptyFields(); });
        await page.waitForSelector('#dxa-ai-cap[data-ai-state="run"]');
        assert.deepEqual(await page.evaluate(() => { const b = document.getElementById('dxa-form-ai-fill-btn'); return [b.disabled, b.querySelector('.aic-flip').textContent, b.querySelector('.aic-tm').textContent, getComputedStyle(document.querySelector('#dxa-ai-cap .sh')).animationName]; }), [true, '⏳', '0:00', 'aic-sh']);
        await page.evaluate(() => window.__res({ text: JSON.stringify({ category: 'Respiratory' }), model: 'gemini-3.8-flash' }));
        await page.waitForSelector('#dxa-ai-cap[data-ai-state="done"]');
        await page.waitForFunction(() => !document.getElementById('dxa-ai-cap').dataset.aiState && document.getElementById('dxa-form-ai-fill-btn').textContent === '🤖', null, { timeout: 4000 }); await page.evaluate(() => window.__fill);
        await page.evaluate(() => { document.getElementById('dxa-f-diseaseName').value = 'Asthma'; window.__fill = dxaAiFillEmptyFields(); });
        await page.waitForSelector('#dxa-ai-cap[data-ai-state="run"]'); await page.evaluate(() => window.__rej(new Error('model busy'))); await page.evaluate(() => window.__fill);
        assert.deepEqual(await page.evaluate(() => [document.getElementById('dxa-form-ai-fill-btn').textContent, document.getElementById('dxa-ai-cap').dataset.aiState || '', /AI fill failed/.test(document.getElementById('dxa-form-error').textContent)]), ['🤖', '', true]);

        const mine = errors.filter(e => /aiCap|ai-capsule|dxaRenderListModelChip|dxaToggleListModelRail|dt-ai-cap|dxa-ai-cap/.test(e)); assert.deepEqual(mine, [], mine.join(' | '));
        console.log('PASS: AI capsule — Drug + Disease form capsule (fill · review · model), list-page split Auto-Draft capsule, one shared model, fill idle → running (⏳ flip + time + shimmer) → done (✓) → idle, error restores 🤖, reduced motion = no keyframes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
