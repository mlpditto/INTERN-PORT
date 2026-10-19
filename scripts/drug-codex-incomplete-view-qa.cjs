// V102.327: Drug Codex — Incomplete view. The REAL admin.html in Chromium (network stubbed, sample codex, Firestore writes captured):
// in "Incomplete first" the list holds only drugs under 90 % and a chip rail narrows it (All incomplete · ATC missing · Class missing ·
// Brands missing · 👶 From Peds import; a chip with no drug is not drawn); the Peds chip adds a progress line and "☑ 20 → 🤖 AI draft"
// (ticks the existing multi-select AI draft); empty tiers are ＋ ATC / ＋ class / ＋ brands buttons that open the form AT that field;
// 🤖 per row runs the existing "AI fill empty fields"; the Peds import writes importSource on the drugs it creates; a one-time 🏷️ chip
// previews and then tags drugs an earlier import created (same-batch createdAt), writing ONLY importSource.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaRenderPublishedList === 'function' && typeof dcaPedsTagOpen === 'function' && window.PedsDosing && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });   // the guide popup would take the clicks
        await page.evaluate(() => {
            const P = window.PedsDosing, empty = Object.fromEntries(DCA_FIELD_KEYS.map(k => [k, ''])), full = Object.fromEntries(DCA_FIELD_KEYS.map(k => [k, DCA_ARRAY_FIELDS[k] ? ['x'] : 'x']));
            const half = Object.fromEntries(DCA_FIELD_KEYS.map((k, i) => [k, i % 2 ? '' : (DCA_ARRAY_FIELDS[k] ? ['x'] : 'x')]));   // ~50 %
            const at = ms => ({ toMillis: () => ms, toDate: () => new Date(ms), seconds: ms / 1000 });
            const codex = [];
            // 30 tagged peds drugs (5 with ATC), 7 untagged from ONE earlier batch, 1 untagged created on its own
            P.DATA.slice(0, 30).forEach((s, i) => codex.push(Object.assign({}, empty, { _id: 'tag' + i, genericName: s.genericName, brandNames: [], pedsDosing: { v: 1 }, importSource: 'peds-dosing', createdAt: at(1e12), updatedAt: at(1e12) }, i < 5 ? { atcCode: 'N02BE01' } : {})));
            P.DATA.slice(30, 37).forEach((s, i) => codex.push(Object.assign({}, empty, { _id: 'old' + i, genericName: s.genericName, brandNames: [], pedsDosing: { v: 1 }, createdAt: at(1.7e12), updatedAt: at(1.7e12) })));
            codex.push(Object.assign({}, half, { _id: 'own', genericName: P.DATA[40].genericName, atcCode: '', pedsDosing: { v: 1 }, createdAt: at(1.6e12), updatedAt: at(1.6e12) }));
            for (let i = 0; i < 4; i++) codex.push(Object.assign({}, half, { _id: 'part' + i, genericName: 'Partial ' + i, atcCode: 'C10AA01', class: 'Statin', brandNames: [], createdAt: at(1.5e12), updatedAt: at(1.5e12) }));
            for (let i = 0; i < 3; i++) codex.push(Object.assign({}, full, { _id: 'full' + i, genericName: 'Complete ' + i, atcCode: 'A01AA01', class: 'Sample', brandNames: ['B'], createdAt: at(1.5e12), updatedAt: at(1.5e12) }));
            dcaState.codex = codex; dcaState.drafts = []; dcaState.sortMode = 'completeness';
            const m = document.getElementById('drugCodexAdminModal');
            m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.__writes = []; window.showToast = () => {};
            window.db = { collection: () => ({ doc: id => ({ id }) }), batch: () => ({ update: (ref, data) => __writes.push([ref.id, data]), set: () => __writes.push(['SET']), commit: async () => {} }) };
            window.__ai = 0; window.dcaAiFillEmptyFields = () => { window.__ai++; };
            dcaSwitchView('published'); dcaRenderPublishedList();
        });
        const chips = () => page.$$eval('#dca-inc-rail .dca-inc-chip', es => es.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        const ids = () => page.$$eval('#dca-list .dca-row', es => es.map(e => e.dataset.id));
        const pct = id => page.evaluate(id => dcaCompletenessScore(dcaState.codex.find(d => d._id === id)).pct, id);

        // 1 · the rail + only drugs under 90 %
        assert.equal(await page.$eval('#dca-inc-rail', e => e.hidden), false, 'rail shown in Incomplete first');
        const c = await chips();
        assert.deepEqual(c.map(t => t.replace(/ \d+$/, '')), ['All incomplete', 'ATC missing', 'Class missing', 'Brands missing', '👶 From Peds import', '🏷️ Tag 7 earlier Peds drugs'], JSON.stringify(c));
        const all = await ids();
        assert.ok(!all.some(id => /^full/.test(id)), 'complete drugs leave the view');
        assert.equal(all.length, 42, '30 + 7 + 1 + 4 incomplete');
        assert.equal(c[0], 'All incomplete 42');
        assert.equal(c[4], '👶 From Peds import 30', 'only importSource counts');

        // 2 · a filter
        await page.click('#dca-inc-rail .dca-inc-chip:has-text("Class missing")');
        assert.equal(await page.$eval('#dca-inc-rail .dca-inc-chip.on', e => e.getAttribute('aria-pressed')), 'true');
        const noCls = await ids();
        assert.ok(noCls.length && noCls.every(id => /^(tag|old|own)/.test(id)), 'class missing: ' + noCls.join(','));
        // a filter with no match falls back to All (here: search for a complete drug only)
        await page.fill('#dca-search', 'Partial'); await page.evaluate(() => dcaSearch());
        assert.deepEqual((await chips()).slice(0, 1), ['All incomplete 4'], 'the chosen chip had no drug → back to All');
        assert.ok(!(await chips()).some(t => /Class missing/.test(t)), 'a chip with no drug is not drawn');
        await page.fill('#dca-search', ''); await page.evaluate(() => dcaSearch());

        // 3 · Peds: progress line + ☑ 20 → 🤖
        await page.click('#dca-inc-rail .dca-inc-chip:has-text("From Peds import")');
        assert.equal((await ids()).length, 30);
        assert.match(await page.$eval('.dca-inc-prog', e => e.textContent), /Peds import: 5 \/ 30 have an ATC code/);
        assert.equal(await page.$eval('.dca-inc-bar i', e => e.style.width), '17%');
        await page.click('.dca-inc-sel');
        const sel = await page.evaluate(() => Array.from(dcaBatch.sel));
        assert.equal(sel.length, 20, 'max 20 per run');
        assert.deepEqual(sel, (await ids()).slice(0, 20), 'the first 20 rows of this view');
        assert.equal(await page.$eval('#dca-ai-input-row', e => e.style.display), 'block', 'the AI draft panel opened');
        assert.equal(await page.$$eval('#dca-list .dca-row .dca-pick:checked', e => e.length), 20, 'their boxes are ticked');
        await page.evaluate(() => dcaAutoDraftCancel());

        // 4 · ＋ field buttons open the form at that field; 🤖 runs AI fill; complete rows have no 🤖
        await page.click('#dca-list .dca-row[data-id="tag10"] .dca-add:has-text("ATC")');
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => [dcaState.editingId, document.activeElement && document.activeElement.id].join('|')), 'tag10|dca-f-atcCode');
        await page.evaluate(() => { dcaSwitchView('published'); dcaRenderPublishedList(); });
        await page.click('#dca-list .dca-row[data-id="tag11"] .dca-add:has-text("brands")');
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'dca-f-brandNames');
        await page.evaluate(() => { dcaSwitchView('published'); dcaRenderPublishedList(); });
        await page.click('#dca-list .dca-row[data-id="tag12"] .dca-row-ai-btn');
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => [dcaState.editingId, window.__ai].join('|')), 'tag12|1', '🤖 opens the drug and runs AI fill once');
        await page.evaluate(() => { dcaSwitchView('published'); dcaSetSort('az', document.querySelector('.dca-sort-row [data-sort="az"]')); });
        assert.equal(await page.$eval('#dca-inc-rail', e => e.hidden), true, 'A–Z: no rail');
        assert.equal(await page.$$eval('#dca-list .dca-row[data-id^="full"] .dca-row-ai-btn', e => e.length), 0, 'no 🤖 on a complete drug');
        assert.equal(await page.$$eval('#dca-list .dca-row[data-id^="full"]', e => e.length), 3, 'complete drugs are back in A–Z');
        await page.evaluate(() => dcaSetSort('completeness', document.querySelector('.dca-sort-row [data-sort="completeness"]')));

        // 5 · Peds import now records importSource on what it creates
        const nd = await page.evaluate(() => { const s = PedsDosing.DATA[0]; return dcaPedsNewDoc(s, PedsDosing.forDoc(s), 'TS', 'a@b').importSource; });
        assert.equal(nd, 'peds-dosing');

        // 6 · one-time tag: preview first, then only importSource on the 7 same-batch drugs
        await page.click('#dca-inc-rail .dca-inc-tag');
        const dlg = page.locator('body > div:last-child');
        const txt = await dlg.innerText();
        assert.match(txt, /Tag earlier Peds imports/); assert.match(txt, /one import batch · 7/); assert.match(txt, /1 other drug with peds data was created separately/);
        assert.deepEqual(await page.evaluate(() => __writes), [], 'nothing written by opening the preview');
        await dlg.locator('[data-act="go"]').click();
        await page.waitForTimeout(100);
        const w = await page.evaluate(() => __writes);
        assert.deepEqual(w.map(x => x[0]).sort(), ['old0', 'old1', 'old2', 'old3', 'old4', 'old5', 'old6']);
        assert.ok(w.every(x => JSON.stringify(x[1]) === '{"importSource":"peds-dosing"}'), 'only importSource (no updatedAt): ' + JSON.stringify(w[0]));
        assert.equal(await page.$$eval('body > div:last-child [data-act="go"]', e => e.length), 0, 'the dialog closes');
        // once tagged the chip is gone
        await page.evaluate(() => { dcaState.codex.forEach(d => { if (/^old/.test(d._id)) d.importSource = 'peds-dosing'; }); dcaRenderPublishedList(); });
        assert.ok(!(await chips()).some(t => /Tag/.test(t)), 'the 🏷️ chip hides when nothing is left to tag');
        assert.match((await chips()).find(t => /Peds/.test(t)), /37$/);
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('drug-codex-incomplete-view-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
