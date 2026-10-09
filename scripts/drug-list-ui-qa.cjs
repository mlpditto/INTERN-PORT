// V102.136: Drug Codex published list — least-complete-first by default, three FIXED tiers per row (same height), Edit + ⋯ menu,
// ONE completeness colour scale. The REAL dcaRenderPublishedList / dcaPublishedRowHtml / dcaCompletenessColor / dcaSetSort and the admin CSS.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + from.length); assert.ok(a >= 0 && b > a, 'anchor ' + from); return html.slice(a, b); };

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 980, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://dlu.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://dlu.test/');
        await page.route('**/*', r => r.abort());
        await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/@font-face\s*\{[^}]*\}/gi, ''));
        await page.addStyleTag({ path: 'public/drug-list-ui.css' });
        await page.addScriptTag({ content: [
            html.match(/const DCA_FIELD_KEYS = \[[\s\S]*?\];/)[0], html.match(/const DCA_ARRAY_FIELDS = \{[^}]*\};/)[0], html.match(/const DCA_EDU_I18N_FIELDS = \[[^\]]*\];/)[0],
            cut('        const DCA_SECTION_DEFS = [', '        // V96.52: data-completeness score'),
            cut('        function dcaCompletenessScore(drug) {', '        // V96.52: section keys → short labels'),
            cut('        // V96.52: section keys → short labels', '        function dcaSwitchSection('),
            cut('        var dcaState = {', '\n        };') + '\n};',
            cut('        function dcaSearch() {', '        function dcaRenderDraftsList() {'),
        ].join('\n') });
        await page.addScriptTag({ content: 'window.dcaBatch = { sel: new Set(), running: false }; window.dcaBatchChipHtml = () => ""; window.dcaListContribChipsHtml = () => ""; window.dcaFormatAbsolute = () => "09 Oct 2026"; window.dcaRenderAzRail = () => {}; ' +
            'window.__calls = []; window.dcaEdit = id => __calls.push("edit:" + id); window.dcaDelete = id => __calls.push("del:" + id); window.dcaCopyRow = id => __calls.push("copy:" + id); window.dcaQuickVisual = id => __calls.push("visual:" + id);' });
        await page.addScriptTag({ path: 'public/drug-list-ui.js' });

        // sample codex: [name, atc, class, brands, filled-field count, updated ms]
        await page.evaluate(() => {
            const extras = DCA_FIELD_KEYS.filter(k => !['genericName', 'brandNames', 'atcCode', 'class'].includes(k));
            const mk = (n, atc, cls, brands, fill, ms) => { const d = { _id: n, genericName: n, atcCode: atc, class: cls, brandNames: brands, updatedAt: { toMillis: () => ms } }; extras.slice(0, fill).forEach(k => { d[k] = DCA_ARRAY_FIELDS[k] ? ['x'] : 'x'; }); return d; };
            dcaState.codex = [mk('Metformin', 'A10BA02', 'Biguanide', ['Glucophage', 'Diabex'], 99, 100), mk('Atorvastatin', '', '', [], 2, 300), mk('Amoxicillin', 'J01CA04', 'Aminopenicillin', ['Amoxil', 'Moxatag', 'Clamoxyl'], 8, 200), mk('Acetazolamide', 'S01EC01', 'CAI', ['Diamox'], 4, 400), mk('Untouched', '', '', [], 0, 50), mk('Ofloxacin', 'S01AE01', 'Fluoroquinolone', ['Tarivid'], 11, 500)].sort((a, b) => a.genericName.localeCompare(b.genericName));   // the snapshot listener orders by name; A–Z only groups
            const m = document.getElementById('drugCodexAdminModal'); m.style.cssText = 'display:block;position:static;padding:0;';
            m.querySelector('.modal-content').style.cssText += ';position:relative;margin:0;max-width:900px;width:900px;box-sizing:border-box;';
            document.getElementById('dca-view-published').style.display = 'block';
            dcaRenderPublishedList();
        });
        const names = () => page.locator('#dca-list .dca-row-name').allInnerTexts().then(a => a.map(s => s.trim().toLowerCase()));
        const pctOf = () => page.locator('#dca-list .dca-row-complete').allInnerTexts().then(a => a.map(s => parseInt(s.replace(/\D/g, ''), 10)));

        // ---- default = least complete first, flat, no letters ----
        assert.equal(await page.evaluate(() => dcaState.sortMode), 'completeness');
        const order = await names(), pcts = await pctOf();
        assert.equal(order[0], 'untouched'); assert.equal(order[order.length - 1], 'metformin');
        assert.deepEqual(pcts, [...pcts].sort((a, b) => a - b), 'ascending %: ' + pcts);
        assert.equal(await page.locator('#dca-list .dca-letter-heading').count(), 0, 'flat list, no letter headings');
        const items = await page.locator('.dca-sort-row .glass-toggle-item').evaluateAll(es => es.map(e => [e.dataset.sort, e.classList.contains('active'), e.textContent.trim()]));
        assert.deepEqual(items.map(i => i[0]), ['completeness', 'az', 'recent']);
        assert.equal(items[0][1], true); assert.match(items[0][2], /Incomplete first/);

        // ---- the other two modes ----
        await page.evaluate(() => dcaSetSort('az', document.querySelector('.dca-sort-row [data-sort="az"]')));
        assert.equal(await page.locator('#dca-list .dca-letter-heading').count() > 0, true, 'A–Z groups by letter');
        assert.equal((await names())[0], 'acetazolamide');
        assert.equal(await page.locator('.dca-sort-row [data-sort="az"].active').count(), 1);
        await page.evaluate(() => dcaSetSort('recent', document.querySelector('.dca-sort-row [data-sort="recent"]')));
        assert.deepEqual(await names(), ['ofloxacin', 'acetazolamide', 'atorvastatin', 'amoxicillin', 'metformin', 'untouched'], 'recent = latest update first');
        await page.evaluate(() => dcaSetSort('completeness', document.querySelector('.dca-sort-row [data-sort="completeness"]')));

        // ---- three fixed tiers: every row has them, so every row is the same height ----
        const rows = page.locator('#dca-list .dca-row');
        assert.equal(await page.locator('#dca-list .dca-row .dca-t1').count(), 6); assert.equal(await page.locator('#dca-list .dca-row .dca-t2').count(), 6); assert.equal(await page.locator('#dca-list .dca-row .dca-t3').count(), 6);
        const hs = await rows.evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().height)));
        assert.ok(Math.min(...hs) > 40, 'rows are laid out: ' + hs); assert.ok(Math.max(...hs) - Math.min(...hs) <= 2, 'rows share one height: ' + hs);
        const first = rows.filter({ hasText: 'UNTOUCHED' });
        assert.match(await first.locator('.dca-t2').innerText(), /ATC —[\s\S]*class not set/); assert.match(await first.locator('.dca-t3 .dca-row-brands').innerText(), /brands —/);
        const amox = rows.filter({ hasText: 'AMOXICILLIN' });
        assert.equal(await amox.locator('.dca-br:not(.dca-br-more)').count(), 2); assert.equal((await amox.locator('.dca-br-more').innerText()).trim(), '+1'); assert.equal(await amox.locator('.dca-br-more').getAttribute('title'), 'Clamoxyl');
        assert.equal((await amox.locator('.dca-row-meta-chip').innerText()).trim(), 'J01CA04');

        // ---- actions: Edit + ⋯ only; the menu holds visual / copy / delete ----
        assert.deepEqual(await amox.locator('.dca-row-actions > *').evaluateAll(es => es.map(e => e.tagName.toLowerCase() + '.' + (e.className.split(' ')[0]))), ['button.dca-row-edit-btn', 'details.dca-more']);
        assert.equal(await amox.locator('.dca-more-menu').isVisible(), false, 'menu closed by default');
        await amox.locator('.dca-more > summary').click();
        assert.equal(await amox.locator('.dca-more-menu').isVisible(), true);
        assert.deepEqual(await amox.locator('.dca-more-menu button').allInnerTexts().then(a => a.map(s => s.trim())), ['🎨 PK visual', '📋 Copy as Markdown', '🗑️ Delete']);
        await amox.locator('.dca-row-copy-btn').click();
        assert.equal(await amox.locator('.dca-more-menu').isVisible(), false, 'running an action closes the menu');
        assert.deepEqual(await page.evaluate(() => __calls), ['copy:Amoxicillin']);
        await amox.locator('.dca-more > summary').click(); await page.keyboard.press('Escape');
        assert.equal(await amox.locator('.dca-more-menu').isVisible(), false, 'Esc closes it');
        await amox.locator('.dca-more > summary').click(); await rows.filter({ hasText: 'METFORMIN' }).locator('.dca-t1').click();
        assert.equal(await amox.locator('.dca-more-menu').isVisible(), false, 'a click elsewhere closes it');
        await amox.locator('.dca-row-edit-btn').click();
        assert.equal((await page.evaluate(() => __calls)).pop(), 'edit:Amoxicillin');
        assert.equal(await page.locator('#dca-list .dca-row-edit-btn').first().getAttribute('aria-label'), 'Edit');
        assert.equal(await page.locator('#dca-list .dca-row-side-top').count(), 6, 'the batch-chip slot (.dca-row-side-top) is still there');
        assert.equal(await page.locator('#dca-list .dca-row .dca-pick').count(), 6, 'the batch checkbox is still there');

        // ---- ONE colour scale (same steps as the form tabs) ----
        const col = async pct => page.evaluate(p => { const c = dcaCompletenessColor(p); return [c.bg, c.fg]; }, pct);
        assert.deepEqual(await col(0), ['#eef2f7', '#64748b']); assert.deepEqual(await col(39), ['#ffedd5', '#9a3412']); assert.deepEqual(await col(40), ['#fef08a', '#713f12']);
        assert.deepEqual(await col(74), ['#fef08a', '#713f12']); assert.deepEqual(await col(75), ['#bbf7d0', '#14532d']); assert.deepEqual(await col(89), ['#bbf7d0', '#14532d']); assert.deepEqual(await col(90), ['#15803d', '#ffffff']); assert.deepEqual(await col(100), ['#15803d', '#ffffff']);
        const bg = await page.locator('#dca-list .dca-row-complete').evaluateAll(es => es.map(e => getComputedStyle(e).backgroundColor));
        assert.equal(bg[0], 'rgb(255, 237, 213)', 'a drug with only a name (5%) is orange — grey is for 0%, checked above'); assert.equal(bg[bg.length - 1], 'rgb(21, 128, 61)', 'a complete drug is dark green');
        assert.equal(new Set(bg).size >= 4, true, 'the sample spans several steps: ' + [...new Set(bg)]);

        if (process.env.SHOT) {
            fs.mkdirSync('output', { recursive: true });
            await rows.filter({ hasText: 'ATORVASTATIN' }).locator('.dca-more > summary').click();
            await page.locator('#drugCodexAdminModal .modal-content').screenshot({ path: 'output/drug-list-ui.png' });
        }
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: drug list — least-complete first by default (+ A–Z, Recent), three fixed tiers with placeholders (same row height), brands ≤ 2 + N, Edit + ⋯ menu (closes on action / Esc / outside click), one 5-step completeness scale');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
