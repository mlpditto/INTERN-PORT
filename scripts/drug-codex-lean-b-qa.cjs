// V102.637 (owner pick B, mockup-codex-lean): Drug Codex lean — the REAL admin.html in Chromium (network stubbed, sample data, nothing written):
// · the published list is one line per drug (name + thin % bar · ATC / Cls / Brd dots · 🤖 ✏️ ⋯), the column heads filter in Incomplete first,
//   who / when sit in ⋯, the "avg · n incomplete" line is gone (numbers once);
// · 👶 Peds / 🫁 Bronchodilator moved under 📥 (still open their previews);
// · drafts are grouped by where they came from (an import · articles · interns): the group names its source and its note ONCE, each row shows its %,
//   ✓ Approve turns amber under 80 % and the approve prompt starts "⚠️ Only n% filled"; "📥 new entry" is gone, "✨ edit · X" stays.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaRenderPublishedList === 'function' && typeof dcaDraftRowHtml === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(() => {
            const empty = Object.fromEntries(DCA_FIELD_KEYS.map(k => [k, DCA_ARRAY_FIELDS[k] ? [] : '']));
            const fill = n => Object.fromEntries(DCA_FIELD_KEYS.map((k, i) => [k, i < n ? (DCA_ARRAY_FIELDS[k] ? ['x'] : 'x') : (DCA_ARRAY_FIELDS[k] ? [] : '')]));
            const at = ms => ({ toMillis: () => ms, toDate: () => new Date(ms), seconds: ms / 1000 });
            dcaState.codex = [
                Object.assign({}, empty, { _id: 'hyo', genericName: 'Hyoscine', createdAt: at(1e12), updatedAt: at(1e12) }),
                Object.assign({}, fill(12), { _id: 'amx', genericName: 'Amoxicillin', atcCode: 'J01CA04', class: 'Aminopenicillin', brandNames: ['Amoxil', 'Moxatag'], createdAt: at(1e12), updatedAt: at(1.1e12) }),
                Object.assign({}, fill(19), { _id: 'dzp', genericName: 'Diazepam', atcCode: 'N05BA01', class: 'Benzodiazepine', brandNames: ['Valium'], createdAt: at(1e12), updatedAt: at(1e12) }),
            ];
            const note = 'From CPE article (Naresuan University, 10 Nov 2026): gastroretentive drug delivery systems — only what the article states.';
            dcaState.drafts = [
                Object.assign({}, fill(6), { _id: 'd1', genericName: 'gabapentin', importSource: 'cpe-grdds-2569', submittedBy: 'admin-import', submittedByName: 'Admin import · CPE NU 2569', internNotes: note, status: 'pending', createdAt: at(1.2e12) }),
                Object.assign({}, fill(5), { _id: 'd2', genericName: 'ciprofloxacin', importSource: 'cpe-grdds-2569', submittedBy: 'admin-import', submittedByName: 'Admin import · CPE NU 2569', internNotes: note, status: 'pending', createdAt: at(1.2e12) }),
                Object.assign({}, fill(18), { _id: 'd3', genericName: 'loratadine', submittedBy: 'uidX', submittedByName: 'Intern A', internNotes: 'from the leaflet', targetDrugId: 'amx', status: 'pending', createdAt: at(1.3e12) }),
            ];
            dcaState.sortMode = 'completeness';
            const m = document.getElementById('drugCodexAdminModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.showToast = () => {};
            window.__calls = []; window.dcaPedsImportOpen = () => __calls.push('peds'); window.dcaBronchImportOpen = () => __calls.push('bronch');
            window.codexBonusPrompt = async o => { __calls.push(o.heading); return null; };   // capture the approve prompt, cancel it
            dcaSwitchView('published'); dcaRenderPublishedList(); if (typeof dcaUpdateCounts === 'function') dcaUpdateCounts();
        });

        // 1 · the list: one line per drug, dots, bar, heads; numbers once
        const row = id => page.locator(`#dca-list .dca-row[data-id="${id}"]`);
        assert.deepEqual(await row('hyo').locator('.dca-dot').evaluateAll(es => es.map(e => (e.tagName === 'BUTTON' ? '○' : '●'))), ['○', '○', '○']);
        assert.deepEqual(await row('amx').locator('.dca-dot').evaluateAll(es => es.map(e => (e.tagName === 'BUTTON' ? '○' : '●'))), ['●', '●', '●']);
        assert.ok(+(await row('amx').locator('.dca-bar').getAttribute('data-pct')) > 0);
        assert.equal(await row('amx').locator('.dca-row-updated-abs').isVisible(), false, 'when sits in ⋯');
        assert.deepEqual(await page.$$eval('#dca-list .dca-cols .dca-col', es => es.map(e => e.textContent.replace(/\s+/g, ' ').trim())), ['ATC 1', 'Cls 1', 'Brd 1']);
        assert.equal((await page.$eval('#dca-published-summary', e => e.textContent)).trim(), '', 'no "avg · n incomplete" line');
        const rh = await page.$$eval('#dca-list .dca-row', es => es.map(e => Math.round(e.getBoundingClientRect().height)));
        assert.ok(Math.max(...rh) <= 50, 'one line each: ' + rh);

        // 2 · 📥 holds the imports
        assert.equal(await page.isVisible('#dca-view-published .dca-toolbar > button[onclick="dcaPedsImportOpen()"]'), false, 'not on the toolbar line');
        await page.click('#dca-view-published .dca-import > summary');
        await page.click('.dca-import-menu button[onclick="dcaPedsImportOpen()"]');
        assert.equal(await page.$eval('.dca-import', d => d.open), false, 'running an import closes the menu');
        await page.click('#dca-view-published .dca-import > summary'); await page.click('.dca-import-menu button[onclick="dcaBronchImportOpen()"]');
        assert.deepEqual(await page.evaluate(() => __calls), ['peds', 'bronch']);
        if (process.env.OUTDIR) await page.locator('#drugCodexAdminModal .modal-content').screenshot({ path: process.env.OUTDIR + '/codex-b-list.png' });

        // 3 · drafts grouped by source: the note once, % per row, amber Approve under 80 %
        await page.evaluate(() => { dcaSwitchView('drafts'); dcaRenderDraftsList(); });
        const groups = await page.$$eval('#dca-drafts-list .dca-dgroup', gs => gs.map(g => [g.querySelector('.dca-dgroup-head').textContent.trim(), g.querySelectorAll(':scope > .dca-draft-notes-snippet').length, g.querySelectorAll('.dca-draft-row').length]));
        assert.deepEqual(groups, [['📄 Admin import · CPE NU 2569 · 2', 1, 2], ['🙋 Interns · 1', 0, 1]]);
        assert.equal(await page.$$eval('#dca-drafts-list .dca-dgroup:first-child .dca-draft-row .dca-draft-notes-snippet', e => e.length), 0, 'the shared note is not repeated per row');
        assert.equal(await page.$$eval('#dca-drafts-list .dca-row-meta-chip', es => es.filter(e => /new entry/.test(e.textContent)).length), 0, '"📥 new entry" is gone');
        assert.match(await page.$eval('#dca-drafts-list .dca-dgroup-in .dca-row-meta-chip', e => e.textContent), /✨ edit · Amoxicillin/);
        assert.equal(await page.$$eval('#dca-drafts-list .dca-dgroup:first-child .dca-draft-approve-btn.dca-low', e => e.length), 2, 'both CPE drafts are under 80 %');
        assert.equal(await page.$$eval('#dca-drafts-list .dca-dgroup-in .dca-draft-approve-btn.dca-low', e => e.length), 0);
        assert.equal(await page.$$eval('#dca-drafts-list .dca-dgroup-in .dca-draft-submitter', e => e.length), 1, 'interns keep who + when');
        await page.click('#dca-drafts-list .dca-dgroup:first-child .dca-draft-approve-btn >> nth=0');
        await page.waitForFunction(() => __calls.length === 3);
        assert.match(await page.evaluate(() => __calls[2]), /^⚠️ Only \d+% filled\.\nApprove & publish "gabapentin"/);
        if (process.env.OUTDIR) await page.locator('#drugCodexAdminModal .modal-content').screenshot({ path: process.env.OUTDIR + '/codex-b-drafts.png' });

        assert.deepEqual(errs.filter(e => /dca|Codex|draft/i.test(e)), [], 'no Codex errors: ' + errs.join(' | '));
        console.log('PASS: Drug Codex lean B — one line per drug (% bar, ATC / Cls / Brd dots, heads filter, who/when in ⋯, no avg line), 📥 imports menu, drafts grouped by source (note once, % per row, amber Approve + "⚠️ Only n% filled" under 80 %, no "new entry")');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
