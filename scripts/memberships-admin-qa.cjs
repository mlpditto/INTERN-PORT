// V102.183 (option A): a user keeps ONE primary pair (users.group + users.division) and may hold MEMBERSHIPS users.memberships =
// [{ division, group }] — on that division's board / work / UI, points stay with the primary. Legacy users.extraGroups reads as
// memberships (division = the list that holds the group) and is kept in sync on save. User Hub: "also" = pair chips, + opens the two-step
// picker in membership mode. Users rail: a member counts in the division; the row wears a dashed "+RSU · EXTERN". Divisions & Groups:
// members are dashed, not movable. Merge / delete rewrite memberships like extraGroups. REAL functions on a minimal DOM.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/memberships: gsExtra\.map\(m => \(\{ division: m\.division \|\| '', group: canonicalGroupName\(m\.group\) \}\)\)\.filter\(m => m\.group && gsPairKey\(m\.division, m\.group\) !== gsPairKey\(gsDivision, newGroup\)\),/.test(html), 'Save writes memberships (pairs, never the primary)');
assert.ok(/extraGroups: \[\.\.\.new Set\(gsExtra\.map\(m => canonicalGroupName\(m\.group\)\)\.filter\(g => g && g\.toUpperCase\(\) !== newGroup\.toUpperCase\(\)\)\)\],/.test(html), 'extraGroups stays in sync (group names) for the intern app');
assert.ok(html.includes('gsExtra = user ? userMemberships(user) : [];'), 'the modal loads pairs through the helper');
assert.ok(!html.includes('id="gs-extra-pick"'), 'the flat extra-group pick list is gone (the two-step picker does it)');
assert.ok(!html.includes("getElementById('gs-extra-pick')"), 'setUserGroup must not touch the removed gs-extra-pick (it threw and the profile window never opened)');
assert.ok(/aria-controls="gs-pane-group" onclick="gsExtraToggle\(\)" aria-label="Add a membership"/.test(html), '+ = add a membership through the picker');
assert.ok(grab(html, 'async function runGroupMerge(').includes('{ memberships: next }') && grab(html, 'async function deleteGroupGlobally(').includes("memberships: u.memberships.filter("), 'merge / delete rewrite memberships');
const fns = ['function userDivisionOf(', 'function userMemberships(', 'function userInDivision(', 'function userInScope(', 'function userGroupTagHtml(', 'function divColor(', 'function divChipLook(', 'function groupStyleOf(',
    'function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function gsExtraPaint(', 'function gsExtraRemove(', 'function gsExtraAdd(', 'function gsExtraToggle(',
    'function gsPickDivision(', 'function gsPickGroup(', 'function gsPaintMainGroup(', 'function gsDivisionChipHtml(', 'function renderGsGroupList(', 'function toggleGsGroups(', 'function gsState(', 'function gsDirtyCount(', 'function gsDirtyPaint('].map(m => grab(html, m)).join('\n');
const consts = [html.match(/const groupColorMap = \{[\s\S]*?\};/)[0], html.match(/const groupIconMap = \{[\s\S]*?\};/)[0], html.match(/const gsPairKey = [^\n]*/)[0]].join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><div id="groupSelectModal"><input id="gs-input" hidden><span id="gs-current-group"></span><span id="gs-also" hidden>also</span><span id="gs-extra-chips"></span><button id="gs-extra-add" aria-expanded="false" onclick="gsExtraToggle()">+</button><div id="gs-pane-group" hidden><div id="gs-list"></div></div><div id="gs-save-row" hidden><span id="gs-save-diff"></span><button id="gs-save-btn">Save</button></div><div id="gs-profile-body"></div></div>');
        await page.addScriptTag({ content: [
            "var escapeHtml = s => String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));",
            "let groupStyle = { groups: {}, divisions: {} }; var gsLanguage = 'en', gsText = (en, th) => en, gsEmptyOpen = false, gsSnap = null, gsDivision = 'CAFE', gsExtra = [], gsMembMode = false, gsMembDiv = '';",
            "var divisionConfig = { CAFE: ['Audit', 'Marketing'], RSU: ['EXTERN', 'Junior'] }; var activeUserGroup = 'All', activeUserGroupDiv;",
            "var usersData = [ { id: 'joey', displayName: 'Joeylive', group: 'Audit', division: 'CAFE', memberships: [{ division: 'RSU', group: 'EXTERN' }] }, { id: 'bua', displayName: 'Bua', group: 'EXTERN', division: 'RSU' }, { id: 'old', displayName: 'Old', group: 'Pharmacists', extraGroups: ['Audit'] }, { id: 'kai', displayName: 'Kai', group: 'Junior', division: 'RSU' } ];",
            "var getGlobalGroups = () => ['Audit', 'Marketing', 'EXTERN', 'Junior', 'Pharmacists', 'Public']; var gsCollectAddresses = () => []; var openDivisionsModal = () => {}; var gsNewGroup = () => {};",
            consts, fns].join('\n') });
        const ev = c => page.evaluate(c);
        // --- helpers
        assert.deepEqual(await ev("userMemberships(usersData[0])"), [{ division: 'RSU', group: 'EXTERN' }], 'memberships read as pairs');
        assert.deepEqual(await ev("userMemberships(usersData[2])"), [{ division: 'CAFE', group: 'Audit' }], 'legacy extraGroups → the division whose list holds the group');
        assert.deepEqual(await ev("userMemberships({ group: 'EXTERN', division: 'RSU', memberships: [{ division: 'RSU', group: 'extern' }, { division: 'Nowhere', group: 'Audit' }, { division: 'CAFE', group: 'Audit' }, { division: 'CAFE', group: 'AUDIT' }] })"), [{ division: '', group: 'Audit' }, { division: 'CAFE', group: 'Audit' }], 'primary pair dropped, unknown division → Only I, case-insensitive dedupe');
        assert.deepEqual(await ev("[userInDivision(usersData[0], 'RSU'), userInDivision(usersData[0], 'CAFE'), userInDivision(usersData[1], 'CAFE')]"), [true, true, false]);
        assert.deepEqual(await ev("[userInScope(usersData[0], 'RSU'), userInScope(usersData[0], 'EXTERN', 'RSU'), userInScope(usersData[0], 'EXTERN'), userInScope(usersData[0], 'Junior', 'RSU'), userInScope(usersData[2], 'CAFE')]"), [true, true, true, false, true], 'division chip / group in division / group anywhere / legacy member');
        // --- Users row tag
        assert.match(await ev("userGroupTagHtml(usersData[0])"), /class="usr-grp-tag lang-no-toggle"[^>]*>CAFE · Audit<\/span> <span class="usr-grp-tag usr-grp-also lang-no-toggle"[^>]*title="also: EXTERN in RSU[^"]*">\+RSU · EXTERN<\/span>$/, 'All: primary tag + dashed membership tag');
        await ev("activeUserGroup = 'RSU'; activeUserGroupDiv = undefined");
        assert.match(await ev("userGroupTagHtml(usersData[0])"), /CAFE · Audit<\/span>$/, 'filtered to RSU: the membership that put them here is left out');
        await ev("activeUserGroup = 'All'; activeUserGroupDiv = undefined");
        // --- User Hub: load, pair chips, + → picker in membership mode, pick ① RSU ② Junior, dedupe, × remove, dirty count
        await ev("document.getElementById('gs-input').value = 'Audit'; gsExtra = userMemberships(usersData[0]); gsPaintMainGroup('Audit'); gsExtraPaint(); gsSnap = Object.assign(gsState(), { groupName: 'Audit' }); gsDirtyPaint();");
        assert.deepEqual(await page.$$eval('#gs-extra-chips .gs-pair .grp-name', els => els.map(e => e.textContent)), ['EXTERN', 'RSU'], 'a membership = group | division pair chip');
        assert.equal(await page.$eval('#gs-also', e => e.hidden), false);
        assert.equal(await page.$eval('#gs-save-row', e => e.hidden), true, 'nothing changed yet');
        await page.click('#gs-extra-add');
        assert.deepEqual(await ev("[gsMembMode, document.getElementById('gs-pane-group').hidden, document.getElementById('gs-extra-add').getAttribute('aria-expanded')]"), [true, false, 'true'], '+ opens the picker in membership mode');
        assert.match(await page.$eval('#gs-list', e => e.textContent), /for the new membership/);
        assert.match(await page.$eval('#gs-list .gs-chip-new', e => e.textContent), /New group in CAFE/, 'V102.198: a brand-new group can be typed right in the membership picker');
        assert.equal(await page.locator('#gs-current-group .gs-prim').count(), 0, 'V102.209: no Primary label; the main pair sits in the header after the name');
        assert.ok(/id="gs-also" hidden data-gs-en="Also in"/.test(fs.readFileSync('public/admin.html', 'utf8')), 'and the pairs sit under Also in');
        await page.click('#gs-list [data-div="RSU"]');
        assert.equal(await ev("gsMembDiv"), 'RSU', 'step ① sets the membership division, not the primary');
        assert.equal(await ev("gsDivision"), 'CAFE');
        assert.equal(await page.$eval('#gs-list [data-group="EXTERN"]', e => e.getAttribute('aria-pressed')), 'true', 'an existing membership is marked');
        await page.click('#gs-list [data-group="Junior"]');
        assert.deepEqual(await ev("gsExtra"), [{ division: 'RSU', group: 'EXTERN' }, { division: 'RSU', group: 'Junior' }], 'step ② adds the pair');
        assert.deepEqual(await ev("[gsMembMode, document.getElementById('gs-pane-group').hidden]"), [false, true], 'and folds the picker');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 1 change', 'memberships = one change');
        await ev("gsExtraAdd('Audit', 'CAFE'); gsExtraAdd('junior', 'RSU')");
        assert.equal(await ev("gsExtra.length"), 2, 'the primary pair and a case-variant duplicate are refused');
        await page.click('#gs-extra-chips .gs-pair:last-child .gs-pair-div');
        assert.deepEqual(await ev("gsExtra"), [{ division: 'RSU', group: 'EXTERN' }], '× on the pair removes it');
        assert.equal(await page.$eval('#gs-save-row', e => e.hidden), true, 'back to the opened state');
        // picking the membership pair as the new PRIMARY drops it from the memberships
        await ev("gsPickDivision('RSU'); gsPickGroup(document.createElement('button'), 'EXTERN', 'RSU')");
        assert.deepEqual(await ev("[gsExtra, document.getElementById('gs-input').value, gsDivision]"), [[], 'EXTERN', 'RSU']);
        { const html = fs.readFileSync('public/admin.html', 'utf8');
          assert.ok(/if \(gsMembMode\) \{ cancel\(\); gsExtraAdd\(getGlobalGroups\(\)\.find/.test(html), 'gsNewGroup in membership mode adds the pair');
          assert.ok(/doc\('--divisions-config--'\)\.set\(add, \{ merge: true \}\)/.test(html), 'Save lists a new membership group in its division (merge — never wipes the other divisions)'); }
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: memberships (option A) — pairs helper (legacy extraGroups, primary excluded, Only I for unknown), scope + row tag, User Hub pair chips, + → two-step picker in membership mode, dedupe, ×, dirty count, primary pick drops the pair; save + merge/delete pins');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
