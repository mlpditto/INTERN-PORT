// V102.172 → V102.178: User Hub group picker is TWO STEPS — ① Division (coloured chips, Only I, ＋ opens Divisions & Groups) then ② the groups of that division (its list + the groups of
// its people + the user's own group). Tapping a division puts the user there (group unchanged); tapping a group sets group (+ division). The same group name can sit in several divisions.
// users.division is written only when it changed. Real renderGsGroupList / gsPickDivision / gsPickGroup / gsState / gsDirtyCount / gsDivisionChipHtml over a stub DOM.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes("...(gsSnap && gsDivision !== gsSnap.division ? { division: gsDivision } : {}),"), 'the save writes users.division only when it changed');
assert.ok(html.includes("...(data.division ? { division: data.division } : {}),"), 'approving a request keeps the division asked for');
assert.ok(html.includes('class="gs-plus gs-chip-div" onclick="openDivisionsModal()"') && !html.includes('gs-sec-head"'), 'the ＋ at the end of step ① opens Divisions & Groups; the old per-division sections are gone');
assert.ok(html.includes('<span class="gs-in">›</span>') && html.includes('hint: \'change division\', attrs: \'aria-controls="gs-pane-group" onclick="toggleGsGroups()"\''), 'the header reads "CAFE › Audit" (division first) and the division chip opens the same picker');

function grabFn(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', html.indexOf(')', i));
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 1);
}
function grabConst(marker) {
    const i = html.indexOf(marker); let d = 0, k = html.indexOf('{', i);
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 2);
}
const css = html.slice(html.indexOf('.grp-chip { --c:#64748b'), html.indexOf(':is(#user-group-tabs, #gs-list, #div-editor)'));

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>' + css + '</style><input id="gs-input" value="Audit"><span id="gs-current-group"></span><div id="gs-list"></div><div id="gs-pane-group" hidden></div><div id="gs-save-row" hidden></div>');
        await page.addScriptTag({ content: [
            "let groupStyle = { groups: {}, divisions: {} };   // V102.180: the look doc, empty here",
            'var divisionConfig = { CAFE: ["Audit", "Marketing"], RSU: ["EXTERN", "Junior"] }, gsEmptyOpen = false, gsDivision = "CAFE", gsExtra = [], gsMembMode = false, gsMembDiv = "", gsSnap = null, opened = 0, openDivisionsModal = function () { opened++; };',
            'var usersData = [{ group: "Audit", division: "CAFE" }, { group: "Audit", division: "RSU" }, { group: "EXTERN" }, { group: "EXTERN" }, { group: "Pharmacists" }, { group: "Pharmacists" }];',
            'var escapeHtml = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };',
            'var getGlobalGroups = function () { return ["Audit", "EXTERN", "Junior", "Marketing", "Pharmacists", "Public"]; }; var gsExtraPaint = function () {}; var gsDirtyPaint = function () {}; var gsCollectAddresses = function () { return []; };',
            grabConst('const groupColorMap = {'), grabConst('const groupIconMap = {'),
            ['function groupStyleOf(', 'function divChipLook(', 'function userMemberships(', 'function userInDivision(', 'function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function divColor(', 'function userDivisionOf(',
                'function gsDivisionChipHtml(', 'function gsPaintMainGroup(', 'function renderGsGroupList(', 'function gsPickDivision(', 'function gsPickGroup(', 'function gsState(', 'function gsDirtyCount('].map(grabFn).join('\n'),
            'gsPaintMainGroup("Audit"); renderGsGroupList();'
        ].join('\n') });

        const norm = els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim().replace(/([^\s\d])(\d+)$/, '$1 $2'));
        const txt = sel => page.$$eval(sel, norm);
        const on = sel => page.$$eval(sel + '[aria-pressed="true"]', norm);
        // header: "Audit in CAFE"
        assert.deepEqual(await txt('#gs-current-group .grp-chip'), ['CAFE 1', 'Audit 2']);   // V102.209: division first
        assert.equal(await page.locator('#gs-current-group .gs-in').textContent(), '›');
        // step ①: every division + Only I, with its people; the user's division is lit
        assert.deepEqual(await txt('.gs-divpick'), ['CAFE 1', 'RSU 3', 'Only I 2'], 'division rail with people per division');
        assert.deepEqual(await on('.gs-divpick'), ['CAFE 1']);
        const cols = await page.$$eval('.gs-divpick', els => els.map(e => e.style.getPropertyValue('--c')));
        assert.equal(new Set(cols).size, 3, 'each division has its own colour');
        // step ②: only CAFE's groups (its list), the user's group lit
        assert.deepEqual(await txt('#gs-list .gs-chip'), ['Audit 1', 'Marketing 0']);
        assert.deepEqual(await on('#gs-list .gs-chip'), ['Audit 1']);
        assert.equal(await page.$eval('.gs-rail2', e => e.style.getPropertyValue('--dc')), cols[0], 'the group panel wears the division colour');
        assert.ok((await txt('.gs-step'))[1].includes('Group in CAFE'));

        // snapshot, then tap RSU in step ① → the user is in RSU, group unchanged, ONE change; the group panel switches; the header follows
        await page.evaluate(() => { gsSnap = Object.assign(gsState(), { groupName: 'Audit' }); });
        assert.equal(await page.evaluate(() => gsDirtyCount()), 0);
        await page.click('.gs-divpick[data-div="RSU"]');
        assert.equal(await page.evaluate(() => gsDivision), 'RSU');
        assert.equal(await page.$eval('#gs-input', e => e.value), 'Audit', 'the group name did not change');
        assert.equal(await page.evaluate(() => gsDirtyCount()), 1, 'division only → one change');
        assert.deepEqual(await txt('#gs-list .gs-chip'), ['Audit 1', 'EXTERN 2', 'Junior 0'], 'RSU: its list + Audit (a person is in it) — the same group name, other division, other count');
        assert.deepEqual(await txt('#gs-current-group .grp-chip'), ['RSU 3', 'Audit 2']);
        // pick another group inside RSU → group + division together = still one change
        await page.click('#gs-list .gs-chip[data-group="EXTERN"]');
        assert.equal(await page.evaluate(() => [gsDivision, document.getElementById('gs-input').value].join('/')), 'RSU/EXTERN');
        assert.equal(await page.evaluate(() => gsDirtyCount()), 1, 'group + division picked together = one change');
        // Only I: groups no division offers (the user's own group first) — empty ones fold
        await page.click('.gs-divpick[data-div=""]');
        assert.equal(await page.evaluate(() => gsDivision), '');
        assert.deepEqual((await txt('#gs-list .gs-chip')).slice(0, 2), ['EXTERN 0', 'Pharmacists 2'], 'the user\'s own group is offered first even where nobody has it');
        assert.ok((await txt('#gs-list .grp-empty')).some(t => /^\+ \d+ empty$/.test(t)), 'empty groups fold');
        // an empty division is still selectable and offers the user's group
        await page.evaluate(() => { divisionConfig.LAB = []; renderGsGroupList(); });
        await page.click('.gs-divpick[data-div="LAB"]');
        assert.deepEqual(await txt('#gs-list .gs-chip'), ['EXTERN 0'], 'LAB (empty) offers just the user\'s group — one tap and Save');
        assert.equal(await page.evaluate(() => gsDivision), 'LAB');
        // ＋ opens Divisions & Groups
        await page.click('.gs-plus');
        assert.equal(await page.evaluate(() => opened), 1);
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: User Hub picker — ① Division → ② Group in it; division change keeps the group, group pick sets both, one change counted, empty divisions selectable');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
