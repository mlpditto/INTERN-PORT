// V102.172: User Hub group picker = (division, group) pairs. Each division section offers its list + the groups of the people in it, so the SAME group name can sit
// under several divisions; picking a chip sets the user's division AND group (users.division is written only when it changed). Real renderGsGroupList /
// gsPickGroup / gsState / gsDirtyCount / gsDivisionChipHtml over a stub DOM.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes("...(gsSnap && gsDivision !== gsSnap.division ? { division: gsDivision } : {}),"), 'the save writes users.division only when it changed');
assert.ok(html.includes("...(data.division ? { division: data.division } : {}),"), 'approving a request keeps the division asked for');

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
            'var divisionConfig = { CAFE: ["Audit", "Marketing"], RSU: ["EXTERN", "Junior"] }, gsEmptyOpen = true, gsDivision = "CAFE", gsExtra = [], gsSnap = null;',
            'var usersData = [{ group: "Audit", division: "CAFE" }, { group: "Audit", division: "RSU" }, { group: "EXTERN" }, { group: "EXTERN" }, { group: "Pharmacists" }, { group: "Pharmacists" }];',
            'var escapeHtml = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };',
            'var getGlobalGroups = function () { return ["Audit", "EXTERN", "Junior", "Marketing", "Pharmacists", "Public"]; }; var gsExtraPaint = function () {}; var gsDirtyPaint = function () {}; var gsCollectAddresses = function () { return []; };',
            grabConst('const groupColorMap = {'), grabConst('const groupIconMap = {'),
            ['function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function divColor(', 'function userDivisionOf(',
                'function gsDivisionChipHtml(', 'function gsPaintMainGroup(', 'function renderGsGroupList(', 'function gsPickGroup(', 'function gsState(', 'function gsDirtyCount('].map(grabFn).join('\n'),
            'renderGsGroupList();'
        ].join('\n') });

        const sec = () => page.$$eval('.gs-sec', els => els.map(e => e.querySelector('.gs-sec-head').textContent.replace(/\s+/g, ' ').trim() + ' = ' + [...e.querySelectorAll('.gs-chip')].map(c => c.dataset.group + (c.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(',')));
        let s = await sec();
        // CAFE offers Audit (+ Marketing, empty); RSU offers EXTERN/Junior AND Audit (a person is explicitly in it) — Audit under BOTH
        assert.ok(s[0].includes('CAFE') && s[0].endsWith('= Audit*,Marketing'), s[0]);
        assert.ok(s[1].includes('RSU') && /= (Audit,EXTERN,Junior|EXTERN,Audit,Junior|EXTERN,Junior,Audit)/.test(s[1].split(' ranked together ').pop() ? s[1] : s[1]), 'RSU lists Audit too: ' + s[1]);
        assert.ok(s[2].startsWith('Only I') && s[2].includes('Pharmacists') && s[2].includes('Public'), 'Only I: ' + s[2]);
        // only the (CAFE, Audit) chip is selected, not the Audit under RSU
        assert.deepEqual(await page.$$eval('.gs-chip[aria-pressed="true"]', els => els.map(e => e.dataset.group + '/' + e.dataset.div)), ['Audit/CAFE']);
        // the main-row division chip shows the user's chosen division
        await page.evaluate(() => gsPaintMainGroup('Audit'));
        assert.equal(await page.$eval('#gs-current-group .gs-divchip .grp-name', e => e.textContent), 'CAFE');

        // snapshot, then pick Audit under RSU → same group name, other division = ONE change; the row repaints
        await page.evaluate(() => { gsSnap = Object.assign(gsState(), { groupName: 'Audit' }); });
        assert.equal(await page.evaluate(() => gsDirtyCount()), 0);
        await page.click('.gs-chip[data-group="Audit"][data-div="RSU"]');
        assert.equal(await page.evaluate(() => gsDivision), 'RSU');
        assert.equal(await page.$eval('#gs-input', e => e.value), 'Audit', 'the group name did not change');
        assert.equal(await page.evaluate(() => gsDirtyCount()), 1, 'division only → one change');
        assert.deepEqual(await page.$$eval('.gs-chip[aria-pressed="true"]', els => els.map(e => e.dataset.group + '/' + e.dataset.div)), ['Audit/RSU']);
        // a different group AND division at once is one change, not two
        await page.click('.gs-chip[data-group="Pharmacists"][data-div=""]');
        assert.equal(await page.evaluate(() => [gsDivision, document.getElementById('gs-input').value].join('/')), '/Pharmacists');
        assert.equal(await page.evaluate(() => gsDirtyCount()), 1, 'group + division picked together = one change');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: User Hub picker — (division, group) sections, same group name under several divisions, picking sets both, one change counted');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
