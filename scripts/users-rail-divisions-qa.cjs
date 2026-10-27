// V102.170: Users (Elite Board) chip rail follows Divisions & Groups — each division wears its own colour, a group that lives in a division is reached
// through a sub-row ("RSU › EXTERN · Junior") instead of a second flat chip, the division stays lit while one of its groups is picked, and every row
// carries a "RSU · EXTERN" tag. Real render functions from public/admin.html over a stub DOM / data.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('<div id="user-subgroup-row" class="lang-no-toggle" hidden></div>'), 'the sub-row exists, hidden, language-toggle-proof');
assert.ok(html.includes('${userFloodMarkHtml(d)}${userGroupTagHtml(d)}${userWorkLinkHtml(d)}</div>'), 'the table row prints the tag after the name (V102.452: then the 🔗 work link)');
{   // V102.452: the 🔗 helper on its own — http(s) only, escaped, opens in a new tab without the row's click
    const vm = require('node:vm'), ctx = vm.createContext({});
    const cut = m => { const i = html.indexOf(m); let k = html.indexOf('{', i), n = 0; for (; k < html.length; k++) { if (html[k] === '{') n++; else if (html[k] === '}' && !--n) break; } return html.slice(i, k + 1); };
    vm.runInContext(cut('function escapeHtml(') + '\n' + cut('function userWorkLinkHtml('), ctx);
    assert.equal(ctx.userWorkLinkHtml({}), '', 'no link → nothing');
    assert.equal(ctx.userWorkLinkHtml({ workLink: 'javascript:alert(1)' }), '', 'a non-http value is never a link');
    const a = ctx.userWorkLinkHtml({ workLink: ' https://drive.google.com/drive/folders/x?a=1&b="2" ' });
    assert.ok(a.includes('href="https://drive.google.com/drive/folders/x?a=1&amp;b=&quot;2&quot;"') && a.includes('target="_blank"') && a.includes('rel="noopener noreferrer"') && a.includes('onclick="event.stopPropagation()"') && a.includes('>🔗</a>'), a);
}
assert.ok(!html.includes("color: '#4f46e5', active: inGroups"), 'division chips no longer all share one colour');

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
const css = html.slice(html.indexOf('.grp-chip { --c:#64748b'), html.indexOf(':is(#user-group-tabs, #gs-list, #div-editor)'));

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>' + css + '</style><div id="user-group-tabs"></div><div id="user-subgroup-row" class="lang-no-toggle" hidden></div>');
        await page.addScriptTag({ content: [
            "let groupStyle = { groups: {}, divisions: {} };   // V102.180: the look doc, empty here",
            'var users = ["EXTERN", "EXTERN", "Pharmacists", "Pharmacists", "Pharmacists", "Audit"];',
            'var usersData = users.map(function (g) { return { group: g }; }), preRegData = [], divisionConfig = { CAFE: ["Audit", "Marketing"], RSU: ["EXTERN", "Junior"] }, activeUserGroup = "All", activeUserGroupDiv;',
            'var escapeHtml = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };',
            'var renderTable = function () {}, renderGroupUsersPanel = function () {}, renderLeaderboard = function () {}, renderBadgeStatsIfOpen = function () {};',
            grabConst('const groupColorMap = {'), grabConst('const groupIconMap = {'),
            ['function groupStyleOf(', 'function divChipLook(', 'function userMemberships(', 'function userInDivision(', 'function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function divColor(', 'function userDivisionOf(', 'function userInScope(',
                'function renderUserGroupTabs(', 'function renderUserSubgroupRow(', 'function userGroupTagHtml(', 'function setUserGroupFilter('].map(grabFn).join('\n'),
            'renderUserGroupTabs();'
        ].join('\n') });

        const txt = sel => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim().replace(/(\D)(\d+)$/, '$1 $2')));
        // 1. All: divisions + Only I groups only; group chips inside a division are not repeated; each division has its own colour
        assert.deepEqual(await txt('#user-group-tabs .grp-chip'), ['All 6', 'CAFE 1', 'RSU 2', 'Pharmacists 3']);
        const cols = await page.$$eval('#user-group-tabs .grp-chip', els => els.map(e => e.style.getPropertyValue('--c')));
        assert.equal(new Set([cols[1], cols[2]]).size, 2, 'CAFE and RSU differ: ' + cols);
        assert.ok(!cols.includes('#4f46e5'), 'no more shared indigo');
        assert.equal(await page.$eval('#user-subgroup-row', e => getComputedStyle(e).display), 'none', 'no sub-row on All');
        // 2. pick a division → sub-row of its groups (people first is not required; configured order, empty ones shown)
        await page.click('#user-group-tabs [data-g="RSU"]');
        assert.equal(await page.evaluate(() => activeUserGroup), 'RSU');
        assert.equal(await page.$eval('#user-group-tabs [data-g="RSU"]', e => e.getAttribute('aria-pressed')), 'true');
        assert.deepEqual(await txt('#user-subgroup-row .sub-l, #user-subgroup-row .grp-chip'), ['RSU ›', 'EXTERN 2', 'Junior 0']);
        assert.equal(await page.$eval('#user-subgroup-row', e => e.style.getPropertyValue('--dc')), cols[2], 'the sub-row wears the division colour');
        // 3. pick a group inside it → the division stays lit, the group lights in the sub-row
        await page.click('#user-subgroup-row [data-g="EXTERN"]');
        assert.equal(await page.evaluate(() => activeUserGroup), 'EXTERN');
        assert.equal(await page.$eval('#user-group-tabs [data-g="RSU"]', e => e.getAttribute('aria-pressed')), 'true', 'RSU stays lit');
        assert.equal(await page.$eval('#user-subgroup-row [data-g="EXTERN"]', e => e.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.$eval('#user-subgroup-row [data-g="Junior"]', e => e.getAttribute('aria-pressed')), 'false');
        assert.equal(await page.evaluate(() => activeUserGroupDiv), 'RSU', 'a sub-row group is read inside its division');
        // 3b. the SAME group name in two divisions: Audit sits in CAFE (listed) and, explicitly, in RSU — each division counts only its own people
        await page.evaluate(() => { usersData.push({ group: 'Audit', division: 'RSU' }); setUserGroupFilter('RSU'); });
        assert.deepEqual(await txt('#user-subgroup-row .sub-l, #user-subgroup-row .grp-chip'), ['RSU ›', 'EXTERN 2', 'Junior 0', 'Audit 1'], 'RSU lists Audit because someone is in it');
        await page.click('#user-subgroup-row [data-g="Audit"]');
        assert.equal(await page.evaluate(() => ({ g: activeUserGroup, d: activeUserGroupDiv })).then(o => o.g + '/' + o.d), 'Audit/RSU');
        assert.deepEqual(await page.evaluate(() => usersData.filter(u => userInScope(u, activeUserGroup, activeUserGroupDiv)).map(u => u.division || '-')), ['RSU'], 'only the Audit person who is in RSU');
        await page.evaluate(() => setUserGroupFilter('CAFE'));
        assert.deepEqual(await txt('#user-subgroup-row .sub-l, #user-subgroup-row .grp-chip'), ['CAFE ›', 'Audit 1', 'Marketing 0'], 'CAFE counts only its own Audit');
        assert.equal(await page.evaluate(() => usersData.filter(u => userInScope(u, 'CAFE', undefined)).length), 1, 'the CAFE chip = people in CAFE');
        await page.evaluate(() => { usersData.pop(); setUserGroupFilter('All'); });
        // 4. an Only I group, or the Camp view → no sub-row
        await page.click('#user-group-tabs [data-g="Pharmacists"]');
        assert.equal(await page.$eval('#user-subgroup-row', e => getComputedStyle(e).display), 'none');
        await page.evaluate(() => { setUserGroupFilter('CAFE'); window._userCampView = true; renderUserGroupTabs(); });
        assert.equal(await page.$eval('#user-subgroup-row', e => getComputedStyle(e).display), 'none', 'Camp view has no sub-row');
        await page.evaluate(() => { window._userCampView = false; setUserGroupFilter('All'); });
        // 5. the row tag
        const tag = (g, division) => page.evaluate(x => userGroupTagHtml(x), division === undefined ? { group: g } : { group: g, division });
        let t = await tag('EXTERN');
        assert.ok(t.includes('RSU · EXTERN') && t.includes('title="RSU › EXTERN"') && t.includes('lang-no-toggle'), t);
        t = await tag('Pharmacists');
        assert.ok(t.includes('>Pharmacists<') && t.includes('title="Only I › Pharmacists"'), t);
        await page.evaluate(() => { activeUserGroup = 'RSU'; });
        t = await tag('EXTERN'); assert.ok(t.includes('>EXTERN<') && !t.includes('RSU ·'), 'inside its division only the group: ' + t);
        await page.evaluate(() => { activeUserGroup = 'EXTERN'; });
        assert.equal(await tag('EXTERN'), '', 'filtered to exactly this group → no tag');
        await page.evaluate(() => { activeUserGroup = 'All'; });
        t = await tag('Audit', 'RSU'); assert.ok(t.includes('RSU · Audit') && t.includes('title="RSU › Audit"'), 'the tag follows the user\'s own division: ' + t);
        t = await tag('EXTERN', '');  assert.ok(t.includes('>EXTERN<') && t.includes('Only I › EXTERN'), 'explicit Only I: ' + t);
        t = await tag('<b>x</b>'); assert.ok(!t.includes('<b>x</b>') && t.includes('&lt;b'), 'group names are escaped');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Users rail — coloured divisions, no repeated group chips, sub-row of the selected division, division stays lit, "RSU · EXTERN" row tag');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
