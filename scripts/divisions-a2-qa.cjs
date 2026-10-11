// V102.168: Divisions & Groups window, A2 — a colour-coded rail of divisions (+ Only I), the selected division's groups below, the picked group's
// actions inline (rename / merge / visibility / delete + "→ division" chips), a search across every division, and a Save bar that only shows
// (with a summary) while the draft differs from what is saved. Real markup + CSS + render functions from public/admin.html, stub db.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
for (const gone of ['dv-solo', 'dv-bucket', 'dv-menu', 'dv-dot']) assert.ok(!html.includes(gone), 'orphan removed: ' + gone);

function grabFn(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', html.indexOf(')', i));
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 1);
}
function grabConst(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', i);
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 2);
}
const styleA = html.indexOf('#divisionsModal .modal-content { align-self'), styleB = html.indexOf('</style>', styleA);
const css = html.slice(html.indexOf('.grp-chip { --c:#64748b'), html.indexOf(':is(#user-group-tabs, #gs-list, #div-editor)')) + html.slice(styleA, styleB)
    + html.slice(html.indexOf(':is(#user-group-tabs, #gs-list, #div-editor)'), html.indexOf('\n', html.indexOf(':is(#user-group-tabs, #gs-list, #div-editor)')));
const mA = html.indexOf('<div id="divisionsModal" class="modal">'), mB = html.indexOf('<!-- V102.119: Archive modal', mA);
const modal = html.slice(mA, mB);
assert.ok(modal.includes('id="dv-newrow" hidden') && modal.includes('id="div-savebar" hidden'), 'new-division row and Save bar start hidden');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>.modal{display:flex}</style><style>' + css + '</style>' + modal);
        await page.addScriptTag({ content: [
            'var users = [].concat(Array(1).fill("Audit"), Array(2).fill("EXTERN"), Array(2).fill("Pharmacists"), ["Public"]).map(function (g) { return { group: g }; });',
            'var usersData = users, divisionConfig = { CAFE: ["Audit", "Marketing"], RSU: ["EXTERN", "Junior"] }, calls = [], toasts = [];',
            'var showToast = function (m) { toasts.push(m); }; var grpAction = function (a, g) { calls.push(a + ":" + g); };',
            'var escapeHtml = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };',
            grabConst('const groupColorMap = {'), grabConst('const groupIconMap = {'),
            ['function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function getGlobalGroups(', 'function divGroupCount(',
                'function divHomeIn(', 'function divDiff(', 'function setDivDirty(', 'function renderDivisionAdminList(', 'function onDivEditorClick(', 'function moveGroupToDivision(', 'function addDivision(', 'function removeDivision('].map(grabFn).join('\n'),
            grabFn('function divColor('),
            'var divDraft = JSON.parse(JSON.stringify(divisionConfig)), divPick = "", divSel = "", divFilter = "", divShowEmpty = false;'
        ].join('\n') });
        await page.evaluate(() => renderDivisionAdminList());

        // chip text is "name" + "count" with no space between (two spans) — add one so the expectations read naturally
        const txt = sel => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim().replace(/(\D)(\d+)$/, '$1 $2')));
        const chips = () => txt('.dv-chips .grp-chip, .dv-chips .dv-more');
        // 1. rail + selected division
        assert.deepEqual(await txt('.dv-rail'), ['CAFE 1', 'RSU 2', 'Only I 3'], 'rail: divisions then Only I, with active people');
        assert.deepEqual((await txt('.dv-rail.on')), ['CAFE 1'], 'the first division is selected');
        assert.deepEqual(await chips(), ['Audit 1', 'Marketing 0'], 'only CAFE\'s groups, people first');
        const colours = await page.$$eval('.dv-rail', els => els.map(e => e.style.getPropertyValue('--c')));
        assert.equal(new Set(colours).size, 3, 'each rail entry has its own colour: ' + colours);
        assert.equal(await page.$eval('.dv-panel', e => e.style.getPropertyValue('--dc')), colours[0], 'the panel wears the division colour');
        assert.equal(await page.locator('.dv-bar').count(), 0, 'no action bar until a group is picked');
        assert.equal(await page.$eval('#div-savebar', e => getComputedStyle(e).display), 'none', 'Save bar hidden while nothing changed');
        assert.equal(await page.$eval('#dv-newrow', e => getComputedStyle(e).display), 'none', 'new-division row hidden');
        // 2. switch division
        await page.click('.dv-rail[data-sel="RSU"]');
        assert.deepEqual(await chips(), ['EXTERN 2', 'Junior 0']);
        // 3. Only I folds the empty groups
        await page.click('.dv-rail[data-sel="__only"]');
        assert.deepEqual(await chips(), ['Pharmacists 2', 'Public 1', '+ 5 empty'], await chips());
        await page.click('.dv-more[data-more="1"]');
        assert.equal((await chips()).length, 8, 'expanding shows the five empties (+ hide empty button)');
        await page.click('.dv-more[data-more="0"]');
        // 4. pick a group → inline bar; Public cannot be deleted
        await page.click('.dv-chip[data-g="Public"]');
        assert.equal(await page.locator('.dv-bar [data-act="delete"]').count(), 0, 'Public has no Delete');
        await page.click('.dv-chip[data-g="Pharmacists"]');
        assert.deepEqual(await page.$$eval('.dv-bar [data-act]', els => els.map(e => e.dataset.act)), ['rename', 'merge', 'visibility', 'delete']);
        assert.deepEqual(await txt('.dv-mv'), ['CAFE', 'RSU'], 'move targets: every division except where it is (it is already in Only I)');
        await page.click('.dv-bar [data-act="rename"]');
        assert.deepEqual(await page.evaluate(() => calls), ['rename:Pharmacists'], 'actions go to grpAction with the picked group');
        // 5. move → draft changes, Save bar appears with a summary
        await page.click('.dv-mv[data-to="CAFE"]');
        assert.equal(await page.$eval('#div-savebar', e => getComputedStyle(e).display), 'flex', 'Save bar shows');
        assert.equal(await page.$eval('#div-save-diff', e => e.textContent), '1 change · Pharmacists → CAFE');
        assert.equal(await page.$eval('#div-save', e => e.disabled), false);
        assert.deepEqual(await txt('.dv-rail'), ['CAFE 3', 'RSU 2', 'Only I 1']);
        // moving it back = no net change → the bar goes away again
        await page.click('.dv-rail[data-sel="CAFE"]'); await page.click('.dv-chip[data-g="Pharmacists"]');
        assert.deepEqual(await txt('.dv-mv'), ['RSU', 'Only I']);
        await page.click('.dv-mv[data-to=""]');
        assert.equal(await page.$eval('#div-savebar', e => getComputedStyle(e).display), 'none', 'net-zero change hides the Save bar');
        // 6. search across every division
        await page.fill('#dv-filter', 'ext');
        assert.deepEqual(await chips(), ['EXTERN 2'], 'search finds EXTERN although RSU is not the selected division');
        assert.ok((await txt('.dv-cap span'))[0].includes('all divisions'));
        assert.equal(await page.locator('.dv-rail.on').count(), 0, 'no rail entry is highlighted while searching');
        await page.fill('#dv-filter', ''); await page.evaluate(() => { divFilter = ''; renderDivisionAdminList(); });
        // 7. new division: ＋ opens the row, adding lands on it and shows it in the summary
        await page.click('.dv-newbtn');
        assert.equal(await page.$eval('#dv-newrow', e => getComputedStyle(e).display), 'flex');
        await page.fill('#new-div-name', 'LAB'); await page.click('#dv-newrow .dv-add');
        assert.deepEqual((await txt('.dv-rail.on')), ['LAB 0'], 'lands on the new division');
        assert.ok((await txt('.dv-cap span'))[0].startsWith('no groups yet'));
        assert.equal(await page.$eval('#div-save-diff', e => e.textContent), '1 change · + LAB');
        // 8. delete a division → its groups fall back to Only I, summary says so without listing each group
        await page.click('.dv-del[data-del="LAB"]');
        await page.click('.dv-rail[data-sel="RSU"]'); await page.click('.dv-del[data-del="RSU"]');
        assert.equal(await page.$eval('#div-save-diff', e => e.textContent), '1 change · − RSU');
        assert.equal(await page.$eval('.dv-rail.on', e => e.dataset.sel), 'CAFE', 'selection falls back to a division that still exists');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Divisions & Groups A2 — rail with colours, selected division\'s groups, inline actions + move chips, cross-division search, Save bar only on change');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
