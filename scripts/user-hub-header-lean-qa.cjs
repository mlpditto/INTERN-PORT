// V102.164: admin ▸ User Hub modal — the header is ONE line (person · LINE ID ⧉ · enrollment code ⧉ · Google · EN/TH · points · Beri · ×;
// the words Profile / LINE ID / Enrollment CODE / pts moved into tooltips), the User group block is ONE row (the main group as the
// rail chip that opens the picker · "also" + faded extra chips · +), and the Save row shows only once something differs from the
// opened state, carrying the group diff and a count. Static pins + the REAL gs* functions on the real markup + CSS.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
const header = html.slice(html.indexOf('<div class="gs-header lang-no-toggle">'), html.indexOf('<input type="hidden" id="gs-uid">'));
assert.ok(!html.includes('class="gs-identity"'), 'the second identity row is gone');
for (const gone of ['data-gs-en="Profile"', '>LINE ID<', '>Enrollment CODE<', '</span> pts<']) assert.ok(!header.includes(gone), 'no label text: ' + gone);
assert.ok(/<button type="button" class="gs-id" onclick="gsCopyLineId\(\)"[^>]*><i class="fa-solid fa-id-card"[^>]*><\/i><code id="gs-line-id">/.test(header), 'LINE ID chip = icon · value · ⧉, one frame');
assert.ok(/<button type="button" class="gs-code" id="gs-enrollment-chip" onclick="gsCopyEnrollmentCode\(\)"[^>]*><i class="fa-solid fa-key"[^>]*><\/i><code id="gs-enrollment-code">-<\/code><i class="fa-regular fa-copy"/.test(header), 'enrollment chip copies (⧉)');
for (const id of ['gs-hub-pic', 'gs-title-name', 'gs-google-chip', 'gs-google-email', 'gs-user-score', 'gs-user-beri']) assert.ok(header.includes('id="' + id + '"'), 'header keeps #' + id);
const order = ['gs-header-person', 'class="gs-ident"', 'class="gs-spacer"', 'class="gs-lang-switch"', 'gs-bal-pts', 'gs-bal-beri', 'gs-header-close'].map(m => header.indexOf(m));
assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'order: person · identity · spacer · EN/TH · points · Beri · ×');
assert.ok(html.includes("function gsCopyEnrollmentCode()"), 'copy handler exists');
const grp = html.slice(html.indexOf('<section class="gs-inline-group lang-no-toggle"'), html.indexOf('<div id="gs-pane-group" hidden>'));
assert.ok(!grp.includes('gs-group-summary') && !grp.includes('Select one group') && !/<button[^>]*id="gs-group-toggle"/.test(grp), 'no summary box / help text / Change group button');
assert.ok(/<div class="gs-grp-row">\s*<span id="gs-current-group"><\/span>\s*<span class="gs-also" id="gs-also" hidden/.test(grp), 'one row: main chip slot, then "also" (hidden until used)');
assert.ok(/<div class="gs-save-row lang-no-toggle" id="gs-save-row" hidden><span id="gs-save-diff"/.test(html), 'the Save row starts hidden and carries the diff');
assert.ok(!html.includes("'Save profile and group together'") && !html.includes("'Unsaved changes'"), 'the two status sentences are gone');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));   // body brace, not a default-param "{}" (groupChipHtml(g, o = {}))
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const fns = ['function gsPaintMainGroup(', 'function gsState(', 'function gsDirtyCount(', 'function gsDirtyPaint(', 'function gsExtraPaint(', 'function gsExtraRemove(', 'function gsExtraAdd(',
    'function gsExtraRenderPick(', 'function gsExtraToggle(', 'function gsPickGroup(', 'function toggleGsGroups(', 'function groupChipHtml('].map(m => grab(html, m)).join('\n');
const css = [
    html.slice(html.indexOf('        .grp-chip { --c:#64748b;'), html.indexOf('        /* V102.64: Event modal')),
    html.slice(html.indexOf('        .grp-chip:hover {'), html.indexOf('        /* V102.59: the picker is sections')),
    html.slice(html.indexOf('        /* V102.164: one header line'), html.indexOf('        /* --- [V92.37] User Hub Backlog')),
    html.slice(html.indexOf('        /* V102.164: the group block is ONE row'), html.indexOf('        #groupSelectModal #gs-extra-pick {')),
    html.slice(html.indexOf('        /* V102.164: the Save row appears only'), html.indexOf('        #groupSelectModal .gs-save-row span')),
    html.match(/        #groupSelectModal \.gs-lang-switch \{[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n/)[0]
].join('\n');
const markup = '<div id="groupSelectModal" style="width:100%"><div class="modal-content">' + header
    + '<input type="hidden" id="gs-uid"><div id="gs-profile-body"><input type="text" id="gs-tel" value="081"></div>'
    + grp + '<div id="gs-pane-group" hidden><input type="text" id="gs-input" hidden><div id="gs-list"><button class="gs-chip" data-group="MLP" onclick="gsPickGroup(this, this.dataset.group)">MLP</button><button class="gs-chip" data-group="EXTERN" onclick="gsPickGroup(this, this.dataset.group)">EXTERN</button></div></div></section>'
    + html.slice(html.indexOf('<div class="gs-save-row lang-no-toggle" id="gs-save-row" hidden>'), html.indexOf('</div>', html.indexOf('id="gs-save-row"')) + 6) + '</div></div>';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--primary:#4361ee;--text-sub:#64748b}body{margin:0;font:14px sans-serif}' + css + '</style>' + markup);
        await page.addScriptTag({ content: [
            "var escapeHtml = s => String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));",
            "var getGroupColor = g => ({ MLP: '#ef4444', EXTERN: '#7209b7', CAFE: '#f97316' })[g] || '#6c757d'; var getGroupIcon = g => 'fa-tag';",
            "var groupActiveCount = g => ({ MLP: 9, EXTERN: 2, CAFE: 4 })[g] || 0; var groupTotalCount = g => groupActiveCount(g);",
            "var getGlobalGroups = () => ['MLP', 'EXTERN', 'CAFE']; var gsCollectAddresses = () => []; var gsLanguage = 'en'; var gsText = (en, th) => gsLanguage === 'th' ? th : en;",
            "var gsRefreshProfileCards = function () {}; let gsExtra = []; let gsSnap = null;",
            fns,
            "document.getElementById('gs-input').value = 'EXTERN'; gsPaintMainGroup('EXTERN'); gsExtraPaint(); gsSnap = Object.assign(gsState(), { groupName: 'EXTERN' }); gsDirtyPaint();",
            "document.getElementById('gs-profile-body').oninput = () => gsDirtyPaint();"
        ].join('\n') });
        const top = sel => page.$eval(sel, e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));   // vertical centre: items differ in height on one line
        const vis = sel => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);
        // header: one line on a desktop width
        const tops = await Promise.all(['.gs-header-person', '.gs-id', '#gs-enrollment-chip', '.gs-lang-switch', '.gs-bal-pts', '.gs-bal-beri', '.gs-header-close'].map(top));
        assert.ok(Math.max(...tops) - Math.min(...tops) <= 6, 'everything on one line at 900px: ' + tops.join(','));
        assert.equal(await page.$eval('.gs-id', e => e.querySelectorAll('.fa-copy').length), 1, 'LINE ID has ⧉');
        assert.equal(await page.$eval('#gs-enrollment-chip', e => e.querySelectorAll('.fa-copy').length), 1, 'enrollment code has ⧉');
        // group block
        assert.equal(await page.$eval('#gs-current-group .grp-chip', e => e.id + '|' + e.className + '|' + e.querySelector('.grp-name').textContent + '|' + e.getAttribute('aria-expanded')), 'gs-group-toggle|grp-chip gs-main on|EXTERN|false', 'main group = rail chip, selected look, carries the toggle');
        assert.equal(await vis('#gs-also'), false, '"also" hidden with no extras');
        assert.equal(await vis('#gs-save-row'), false, 'nothing changed → no Save row');
        await page.click('#gs-group-toggle');
        assert.equal(await page.$eval('#gs-pane-group', e => e.hidden), false, 'tap the chip → picker opens');
        assert.equal(await page.$eval('#gs-group-toggle', e => e.getAttribute('aria-expanded')), 'true');
        await page.evaluate(() => gsExtraAdd('CAFE'));
        assert.equal(await vis('#gs-also'), true, '"also" shows with an extra');
        assert.equal(await page.$eval('#gs-extra-chips .grp-chip .grp-name', e => e.textContent), 'CAFE');
        assert.equal(await page.$eval('#gs-extra-chips .grp-chip', e => getComputedStyle(e).opacity), '0.6', 'extra chips are faded');
        assert.equal(await vis('#gs-save-row'), true, 'extras changed → Save row');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 1 change');
        assert.equal(await page.$eval('#gs-save-diff', e => e.innerHTML), '', 'no group diff yet');
        await page.click('#gs-list [data-group="MLP"]');
        assert.equal(await page.$eval('#gs-current-group .grp-name', e => e.textContent), 'MLP', 'picking repaints the chip');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 2 changes');
        assert.deepEqual(await page.$$eval('#gs-save-diff .grp-chip', els => els.map(e => e.textContent.trim() + (e.classList.contains('on') ? '*' : ''))), ['EXTERN', 'MLP*'], 'diff = old chip → new chip (selected look)');
        await page.evaluate(() => gsExtraRemove('CAFE'));
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 1 change', 'extras back → one change');
        assert.equal(await vis('#gs-also'), false);
        await page.fill('#gs-tel', '082');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 2 changes', 'a profile field counts');
        await page.fill('#gs-tel', '081');
        await page.click('#gs-list [data-group="EXTERN"]');
        assert.equal(await vis('#gs-save-row'), false, 'back to the opened state → the row folds');
        // phone: identity chips wrap under the name, × stays on the first line
        await page.setViewportSize({ width: 375, height: 700 });
        assert.ok(await top('.gs-ident') > await top('.gs-header-person') + 20, 'identity chips drop under the name at 375px');
        assert.ok(Math.abs(await top('.gs-header-close') - await top('.gs-header-person')) <= 6, '× stays on the first line');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: User Hub — one-line header (labels → tooltips, ⧉ on LINE ID + code, wraps on phone), group block one row (rail chip toggles the picker, also/extras faded), Save row only when dirty with diff + count');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
