// V102.168 → V102.173: Divisions & Groups window. A colour-coded rail of divisions (+ Only I) → the selected division's groups (its list + the groups of the people in it,
// so the same group name can sit in several divisions) → the picked group's actions inline and ITS PEOPLE, who can be moved between divisions (users.division, written
// at once, group name unchanged). One search across every division, which can also offer a group in a division's list; Save only while the lists differ.
// Real markup + CSS + render functions from public/admin.html, stub db.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
for (const gone of ['dv-solo', 'dv-bucket', 'dv-menu', 'dv-dot', 'moveGroupToDivision', 'divHomeIn']) assert.ok(!html.includes(gone), 'orphan removed: ' + gone);

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
const chipA = html.indexOf(':is(#user-group-tabs, #gs-list, #div-editor)');
const css = html.slice(html.indexOf('.grp-chip { --c:#64748b'), chipA) + html.slice(styleA, styleB) + html.slice(chipA, html.indexOf('\n', chipA));
const mA = html.indexOf('<div id="divisionsModal" class="modal">'), mB = html.indexOf('<!-- V102.119: Archive modal', mA);
const modal = html.slice(mA, mB);
assert.ok(modal.includes('id="dv-newrow" hidden') && modal.includes('id="div-savebar" hidden'), 'new-division row and Save bar start hidden');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>.modal{display:flex}</style><style>' + css + '</style>' + modal);
        await page.addScriptTag({ content: [
            "let groupStyle = { groups: {}, divisions: {} }; let divLook = null;   // V102.180: the look doc (empty here) + the closed 🎨 editor",
            'var usersData = [',
            '  { id: "u1", displayName: "Bua", group: "EXTERN" }, { id: "u2", displayName: "nt", group: "EXTERN" }, { id: "u3", displayName: "YUI", group: "Audit" },',
            '  { id: "u4", displayName: "Kate", group: "Pharmacists" }, { id: "u5", displayName: "Joey", group: "Pharmacists" }, { id: "u6", displayName: "Gap", group: "Pharmacists", isIgnored: true },',
            '  { id: "u7", displayName: "Zed", group: "Audit", division: "RSU" } ];',
            'var divisionConfig = { RSU: ["EXTERN", "Junior"], CAFE: ["Audit", "Marketing"] }, calls = [], toasts = [], batches = [], __groups = ["Audit", "EXTERN", "Junior", "Marketing", "Pharmacists", "Public"];',
            'var showToast = function (m) { toasts.push(m); }; var grpAction = function (a, g) { calls.push(a + ":" + g); }; var confirm = function () { return true; }; var alert = function () {};',
            'var getGlobalGroups = function () { return __groups.slice(); }; var canonicalGroupName = function (n) { return __groups.find(function (g) { return g.toUpperCase() === n.toUpperCase(); }) || n; };',
            'var renderUserGroupTabs = function () {};',
            'var db = { batch: function () { var ops = []; return { update: function (ref, d) { ops.push(ref.id + ":" + JSON.stringify(d)); }, commit: function () { batches.push(ops); return Promise.resolve(); } }; }, collection: function () { return { doc: function (id) { return { id: id }; } }; } };',
            'var escapeHtml = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };',
            grabConst('const groupColorMap = {'), grabConst('const groupIconMap = {'),
            html.slice(html.indexOf('        const divUp = x =>'), html.indexOf('\n', html.indexOf('        const divUp = x =>'))),
            ['function groupStyleOf(', 'function divChipLook(', 'function userMemberships(', 'function userInDivision(', 'function divAlsoOf(', 'function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function userDivisionOf(', 'function divColor(',
                'function divDiff(', 'function setDivDirty(', 'function divMembersOf(', 'function divGroupsOf(', 'function renderDivisionAdminList(', 'function onDivEditorClick(', 'function divAddGroup(', 'async function divMovePeople(',
                'function addDivision(', 'function removeDivision('].map(grabFn).join('\n'),
            'var divDraft = JSON.parse(JSON.stringify(divisionConfig)), divPick = "", divPickDiv = "", divPeople = new Set(), divSel = "", divFilter = "", divShowEmpty = false;'
        ].join('\n') });
        await page.evaluate(() => renderDivisionAdminList());

        const txt = sel => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim().replace(/([^\s\d])(\d+)$/, '$1 $2')));
        const chips = () => txt('.dv-chips .grp-chip, .dv-chips .dv-more');
        const vis = sel => page.$eval(sel, e => getComputedStyle(e).display);
        // 1. rail counts PEOPLE (active ones) in each division; the first division is selected; its groups = its list + the groups of its people
        assert.deepEqual(await txt('.dv-rail'), ['RSU 3', 'CAFE 1', 'Only I 2'], 'rail: people per division (Zed is explicitly in RSU; the hidden Gap is not counted)');
        assert.deepEqual(await chips(), ['EXTERN 2', 'Audit 1', 'Junior 0'], 'RSU: its list + Audit because Zed is in it, people first');
        assert.equal(await vis('#div-savebar'), 'none'); assert.equal(await vis('#dv-newrow'), 'none');
        const cols = await page.$$eval('.dv-rail', els => els.map(e => e.style.getPropertyValue('--c')));
        assert.equal(new Set(cols).size, 3, 'each rail entry has its own colour: ' + cols);
        assert.equal(await page.locator('.dv-bar').count(), 0, 'no action bar until a group is picked');
        // 2. pick Audit inside RSU → inline bar + only THAT Audit's people (Zed, not YUI who is in CAFE)
        await page.click('.dv-chip[data-g="Audit"][data-d="RSU"]');
        assert.deepEqual(await page.$$eval('.dv-bar [data-act]', els => els.map(e => e.dataset.act)), ['rename', 'merge', 'visibility', 'look', 'delete']);   // V102.180: 🎨 Look joined the bar
        assert.deepEqual(await txt('.dv-person'), ['All 1', 'Zed'], 'the people of (RSU, Audit)');
        assert.equal(await page.locator('.dv-moverow').count(), 0, 'nothing selected → no move row');
        await page.click('.dv-bar [data-act="rename"]');
        assert.deepEqual(await page.evaluate(() => calls), ['rename:Audit']);
        // 3. select Zed → Move row → CAFE: written at once to users.division, the group stays, counts follow, no list change needed (CAFE already offers Audit)
        await page.click('.dv-person[data-person="u7"]');
        assert.deepEqual(await txt('.dv-moverow .dv-mv'), ['CAFE', 'Only I']);
        await page.click('.dv-moverow [data-to="CAFE"]');
        await page.waitForFunction(() => batches.length === 1);
        assert.deepEqual(await page.evaluate(() => batches[0]), ['u7:{"division":"CAFE"}']);
        assert.deepEqual(await txt('.dv-rail'), ['RSU 2', 'CAFE 2', 'Only I 2']);
        assert.equal(await vis('#div-savebar'), 'none', 'Audit was already in CAFE\'s list → nothing to save');
        assert.ok((await page.evaluate(() => toasts)).some(t => t === 'Moved 1 → CAFE'));
        // 4. Only I → select a whole group (All, hidden people included) → move to RSU: the group joins RSU's list (a draft change, Save writes it)
        await page.click('.dv-rail[data-sel="__only"]');
        assert.equal((await chips())[0], 'Pharmacists 2', 'Only I shows the group with people first');
        await page.click('.dv-chip[data-g="Pharmacists"][data-d=""]');
        assert.deepEqual(await txt('.dv-person'), ['All 3', 'Kate', 'Joey', '🙈 Gap']);
        await page.click('.dv-person[data-allpeople]');
        assert.equal(await page.$$eval('.dv-person[aria-pressed="true"]', e => e.length), 3);
        await page.click('.dv-moverow [data-to="RSU"]');
        await page.waitForFunction(() => batches.length === 2);
        assert.equal(await page.evaluate(() => batches[1].length), 3);
        assert.deepEqual(await txt('.dv-rail'), ['RSU 4', 'CAFE 2', 'Only I 0']);
        assert.equal(await page.$eval('#div-save-diff', e => e.textContent), '1 change · + Pharmacists in RSU');
        // 5. search across every division, and offer the group in this division's list
        await page.click('.dv-rail[data-sel="RSU"]');
        await page.fill('#dv-filter', 'aud');
        await page.dispatchEvent('#dv-filter', 'input');
        assert.deepEqual(await chips(), ['Audit 2', '＋ Add “Audit” to RSU', '＋ New group “aud” in RSU'], 'Audit lives in CAFE (2 people); one tap offers it in RSU too, or creates the typed name');
        assert.ok((await txt('.dv-cap span'))[0].includes('all divisions'));
        await page.locator('.dv-addgrp').first().click();
        assert.deepEqual(await page.evaluate(() => divDraft.RSU), ['EXTERN', 'Junior', 'Pharmacists', 'Audit']);
        assert.equal(await page.$eval('#div-save-diff', e => e.textContent), '2 changes · + Pharmacists in RSU · + Audit in RSU');
        assert.equal(await page.$eval('#dv-filter', e => e.value), '', 'the search clears');
        assert.equal(await page.locator('.dv-chip[data-g="Audit"][data-d="RSU"]').count(), 1, 'Audit is now listed (empty) under RSU');
        // an empty listed group can be taken back out of the list
        await page.click('[data-rmlist="RSU"]');
        assert.deepEqual(await page.evaluate(() => divDraft.RSU), ['EXTERN', 'Junior', 'Pharmacists']);
        // 6. a brand-new group name → offered in the division as an empty group
        await page.click('.dv-rail[data-sel="CAFE"]');
        await page.fill('#dv-filter', 'Lab');
        await page.dispatchEvent('#dv-filter', 'input');
        await page.click('.dv-addgrp');
        assert.ok((await page.evaluate(() => divDraft.CAFE)).includes('Lab'));
        // 7. a division that is not saved yet cannot receive people
        await page.click('.dv-newbtn');
        await page.fill('#new-div-name', 'LAB'); await page.click('#dv-newrow .dv-add');
        await page.click('.dv-rail[data-sel="CAFE"]');
        await page.click('.dv-chip[data-g="Audit"][data-d="CAFE"]'); await page.click('.dv-person[data-allpeople]');
        assert.equal(await page.$eval('.dv-moverow [data-to="LAB"]', e => e.disabled), true, 'unsaved division → disabled');
        const before = await page.evaluate(() => batches.length);
        await page.click('.dv-moverow [data-to="LAB"]', { force: true });
        assert.equal(await page.evaluate(() => batches.length), before, 'nothing written');
        // 8. delete a division → the selection falls back to one that exists
        await page.click('.dv-rail[data-sel="LAB"]'); await page.click('.dv-del[data-del="LAB"]');
        assert.equal(await page.$eval('.dv-rail.on', e => e.dataset.sel), 'RSU', 'selection falls back to a division that exists');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Divisions & Groups — people per division, same group name in several divisions, move people (users.division) between divisions, search + offer a group, Save only for list changes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
