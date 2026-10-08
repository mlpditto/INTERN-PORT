// V102.129 / V101.73: Drug Codex download files (drug_codex.materials = [{name,url}]).
//  admin  — form editor (drug-materials.js), 📎 n chip + pop-up on the drug list, saved payload shape
//  intern — list 📎 n icon rule + detail-header file chips (real helpers cut out of index.html)
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
const intern = fs.readFileSync('public/index.html', 'utf8');
const cut = (src, from, to) => {
    const a = src.indexOf(from), b = src.indexOf(to, a);
    assert.ok(a >= 0 && b > a, 'anchor: ' + from);
    return src.slice(a, b);
};
const adminFns = cut(admin, '        // V102.129: 📎 n on the row', '        function dcaPublishedRowHtml(drug)');
const internFns = [
    cut(intern, '        function looksLikeOpaqueMaterialName(', '        // V102.21: file type from the link'),
    cut(intern, '        // V102.21: file type from the link', '        // Compact pre-quiz access'),
    cut(intern, '        // V101.73: admin-added download files of a drug', '        function dcRenderList() {'),
].join('\n');
// the form block, the row template and the save payload must carry the feature
assert.match(admin, /id="dca-mat-list"/);
assert.match(admin, /payload\.materials = drugMaterials\.read\(document\.getElementById\('dca-mat-list'\)\)/);
assert.match(admin, /\$\{dcaMatBtnHtml\(drug\)\}/);
assert.match(admin, /drugMaterials\.paint\(document\.getElementById\('dca-mat-list'\), data && data\.materials\)/);
assert.match(intern, /chips\.push\(\.\.\.dcFileChipsHtml\(drug\)\)/);
assert.match(intern, /\$\{dcMaterialsOf\(drug\)\.length \? `<span class="dc-row-mat/);

const globalStyles = Array.from(admin.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi), m => m[0]).join('\n');
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 760, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent(globalStyles + '<div style="padding:12px;width:600px"><label>📎 <span id="dca-mat-count"></span></label><div id="dca-mat-list"></div><button type="button" id="dca-mat-add" onclick="drugMaterials.add(document.getElementById(\'dca-mat-list\'))">➕ Add link</button></div>');
        await page.addStyleTag({ path: 'public/drug-materials.css' });
        await page.addScriptTag({ path: 'public/drug-materials.js' });
        await page.evaluate(({ aFns, iFns }) => {
            window.dcaState = { codex: [
                { _id: 'd1', genericName: 'Baloxavir marboxil', materials: [
                    { name: 'Pharmacy brief', url: 'https://drive.google.com/file/d/abc/view' },
                    { name: '', url: 'https://example.test/files/xofluza-leaflet.pdf' },
                    { name: 'broken', url: 'javascript:alert(1)' }] },
                { _id: 'd2', genericName: 'Warfarin' },
                { _id: 'd3', genericName: 'Odd <b>"name"</b>', materials: [{ name: 'a"b<i>', url: 'https://x.test/a?b="c"' }] },
            ] };
            window.calls = [];
            window.dcaEdit = id => calls.push(['edit', id]); window.dcaSwitchSection = s => calls.push(['section', s]);
            window.dcaEscapeHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            window.escapeHtml = window.dcaEscapeHtml;
            const s = document.createElement('script'); s.textContent = aFns + '\n' + iFns + '\nObject.assign(window,{dcaMaterialsOf,dcaMatBtnHtml,dcaOpenMaterials,dcMaterialsOf,dcFileChipsHtml});'; document.head.appendChild(s);
        }, { aFns: adminFns, iFns: internFns });

        // ---- admin form editor ----
        const list = '#dca-mat-list';
        await page.evaluate(() => drugMaterials.paint(document.getElementById('dca-mat-list'), dcaState.codex[0].materials));
        assert.equal(await page.locator(list + ' .dm-row').count(), 2, 'the javascript: link is not painted');
        assert.equal(await page.locator('#dca-mat-count').innerText(), '2');
        // global width trap: inputs / delete share one row, nothing stretched to 100 %
        const g = await page.evaluate(() => { const r = document.querySelector('#dca-mat-list .dm-row'); const [n, u] = r.querySelectorAll('input'); const d = r.querySelector('.dm-del'); return { rowH: Math.round(r.getBoundingClientRect().height), n: Math.round(n.getBoundingClientRect().width), u: Math.round(u.getBoundingClientRect().width), d: Math.round(d.getBoundingClientRect().width), same: Math.abs(n.getBoundingClientRect().top - d.getBoundingClientRect().top) < 14 }; });
        assert.ok(g.same && g.rowH < 56 && g.d <= 32 && g.n > 80 && g.u > 80, 'row layout ' + JSON.stringify(g));
        // add → type a title and a link → read gives trimmed {name,url}; a title-only row and a bad link are dropped
        await page.locator('#dca-mat-add').click();
        await page.locator(list + ' .dm-row').nth(2).locator('.dm-name').fill('  Leaflet  ');
        await page.locator(list + ' .dm-row').nth(2).locator('.dm-url').fill('  https://onedrive.live.com/x  ');
        await page.locator('#dca-mat-add').click();
        await page.locator(list + ' .dm-row').nth(3).locator('.dm-name').fill('title only');
        await page.locator('#dca-mat-add').click();
        await page.locator(list + ' .dm-row').nth(4).locator('.dm-url').fill('ftp://nope');
        assert.equal(await page.locator(list + ' .dm-row').nth(4).locator('.dm-url').evaluate(e => e.classList.contains('dm-bad')), true);
        assert.deepEqual(await page.evaluate(() => drugMaterials.read(document.getElementById('dca-mat-list'))), [
            { name: 'Pharmacy brief', url: 'https://drive.google.com/file/d/abc/view' },
            { name: '', url: 'https://example.test/files/xofluza-leaflet.pdf' },
            { name: 'Leaflet', url: 'https://onedrive.live.com/x' },
        ]);
        // delete + recount; repaint clears (Add / draft form = no files)
        await page.locator(list + ' .dm-row').nth(0).locator('.dm-del').click();
        assert.equal(await page.locator(list + ' .dm-row').count(), 4);
        await page.evaluate(() => drugMaterials.paint(document.getElementById('dca-mat-list'), undefined));
        assert.equal(await page.locator(list + ' .dm-row').count(), 0);
        assert.deepEqual(await page.evaluate(() => drugMaterials.read(document.getElementById('dca-mat-list'))), []);
        // kinds
        assert.deepEqual(await page.evaluate(() => ['https://drive.google.com/a', 'https://x.test/a.pdf', 'https://x.test/a', 'https://youtu.be/q'].map(u => drugMaterials.kind(drugMaterials.parse(u)).name)), ['Google Drive', 'PDF', 'Link', 'YouTube']);

        // ---- admin list chip + pop-up ----
        assert.match(await page.evaluate(() => dcaMatBtnHtml(dcaState.codex[0])), /📎 2/);
        assert.equal(await page.evaluate(() => dcaMatBtnHtml(dcaState.codex[1])), '');
        await page.evaluate(() => dcaOpenMaterials('d1'));
        const pop = page.locator('body > div').last();
        assert.match(await pop.innerText(), /Baloxavir marboxil \(2\)/);
        const links = await pop.locator('a').evaluateAll(es => es.map(e => [e.getAttribute('href'), e.target, e.rel, e.innerText.trim()]));
        assert.deepEqual(links, [
            ['https://drive.google.com/file/d/abc/view', '_blank', 'noopener noreferrer', 'Pharmacy brief'],
            ['https://example.test/files/xofluza-leaflet.pdf', '_blank', 'noopener noreferrer', 'example.test'],
        ]);
        await pop.locator('[data-act="edit"]').click();
        assert.deepEqual(await page.evaluate(() => calls), [['edit', 'd1'], ['section', 'refs']]);
        assert.equal(await page.locator('body > div').last().innerText().then(t => /Baloxavir/.test(t)), false, 'pop-up closed');
        // markup in names / urls stays text
        await page.evaluate(() => dcaOpenMaterials('d3'));
        assert.equal(await page.locator('body > div').last().locator('b, i').count(), 1 /* the type icon */);
        await page.locator('body > div').last().locator('[data-act="close"]').click();

        // ---- intern: list icon rule + detail chips ----
        const chips = await page.evaluate(() => dcFileChipsHtml(dcaState.codex[0]));
        assert.equal(chips.length, 2);
        assert.match(chips[0], /href="https:\/\/drive\.google\.com\/file\/d\/abc\/view"[^>]*target="_blank"/);
        assert.match(chips[0], /--mk:#1e8e3e/);
        assert.match(chips[1], /--mk:#dc2626/);            // .pdf → red
        assert.match(chips[1], /xofluza-leaflet\.pdf/);    // no title → readable file name from the URL
        assert.ok(!chips.join('').includes('javascript:'));
        assert.deepEqual(await page.evaluate(() => [dcMaterialsOf(dcaState.codex[1]).length, dcMaterialsOf(null).length, dcMaterialsOf({ materials: 'x' }).length]), [0, 0, 0]);
        const evil = await page.evaluate(() => dcFileChipsHtml(dcaState.codex[2]).join(''));
        assert.ok(!/<i>|"c"/.test(evil.replace(/<i class="[^"]*" aria-hidden="true"><\/i>/g, '')), 'escaped: ' + evil);
        assert.deepEqual(errors, []);
        console.log('PASS: Drug Codex download files — admin editor (valid https only, width trap), 📎 chip + pop-up, intern list icon rule + coloured file chips, escaping');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
