// V102.180: 🎨 Look — colour · icon · picture per GROUP and per DIVISION, edited inside Divisions & Groups (group: 🎨 in the picked group's
// action bar; division: 🎨 beside ✕ in the caption), stored in quizzes/--group-style-- and read by getGroupColor / getGroupIcon / divColor /
// divChipLook before the hard-coded maps, so every groupChipHtml chip and the Users row tag follow. Each pick saves at once (merge set).
// Static pins + the REAL functions on a fake db.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('db.collection("quizzes").doc("--group-style--").onSnapshot('), 'listener on the style doc');
assert.ok(/const img = o\.image !== undefined \? o\.image : groupStyleOf\('groups', g\)\.image;/.test(html), 'groupChipHtml reads the picture');
for (const m of ["...divChipLook(d === '' ? '__only' : d)", "...divChipLook(home || '__only')", "...divChipLook(g), color: divColor(g)", "...divChipLook(n), active: total(n)"]) assert.ok(html.includes(m), 'division chip site uses divChipLook: ' + m);
assert.ok(/data-act="look"/.test(html) && /data-divlook="\$\{escapeHtml\(divSel\)\}"/.test(html), '🎨 for the group bar and the division caption');
assert.ok(html.includes("await rlStoreLogoBlob(file)"), 'the picture goes through the shop-logo path (no new Storage rule)');
assert.ok(!fs.readFileSync('storage.rules', 'utf8').includes('group-logos'), 'no new Storage path');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const fns = ['function groupStyleOf(', 'function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml(', 'function userDivisionOf(', 'function divColor(',
    'function divChipLook(', 'function divMembersOf(', 'function divGroupsOf(', 'function divLookHtml(', 'async function saveGroupStyle(', 'function divLookSet(', 'async function divLookUpload(', 'function renderDivisionAdminList(', 'function onDivEditorClick(', 'function userGroupTagHtml('].map(m => grab(html, m)).join('\n');
const consts = [html.match(/const groupColorMap = \{[\s\S]*?\};/)[0], html.match(/const groupIconMap = \{[\s\S]*?\};/)[0], html.match(/const LOOK_COLORS = \[[^\n]*\];/)[0], html.match(/const LOOK_ICONS = \[[^\n]*\];/)[0], "const divUp = x => String(x).trim().toUpperCase();"].join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><div id="divisionsModal"><input id="dv-filter"><div id="div-editor" onclick="onDivEditorClick(event)"></div></div><div id="user-group-tabs"></div>');
        await page.addScriptTag({ content: [
            "var escapeHtml = s => String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));",
            "var sets = []; var db = { collection: () => ({ doc: () => ({ set: async (d, o) => { sets.push({ d, o }); } }) }) }; var firebase = { firestore: { FieldValue: { delete: () => '__DEL__' } } };",
            "var toasts = []; var showToast = m => toasts.push(m); var renderUserGroupTabs = () => {}; var grpAction = () => { throw new Error('grpAction must not run for look'); };",
            "var usersData = [{ id: 'u1', displayName: 'Bua', group: 'EXTERN', division: 'RSU' }, { id: 'u2', displayName: 'Ploy', group: 'EXTERN', division: 'RSU' }, { id: 'u3', displayName: 'Kai', group: 'Junior', division: 'RSU' }, { id: 'u4', displayName: 'Nam', group: 'Pharmacists' }];",
            "var divisionConfig = { RSU: ['EXTERN', 'Junior'] }; var divDraft = { RSU: ['EXTERN', 'Junior'] }; var divSel = 'RSU', divFilter = '', divPick = '', divPickDiv = '', divPeople = new Set(), divShowEmpty = false;",
            "var getGlobalGroups = () => ['EXTERN', 'Junior', 'Pharmacists', 'Public']; var activeUserGroup = 'All', activeUserGroupDiv;",
            "let groupStyle = { groups: {}, divisions: {} }; let divLook = null;",
            consts, fns
        ].join('\n') });
        const ev = (code) => page.evaluate(code);
        // 1. nothing set → the hard-coded maps, an icon in the chip
        assert.equal(await ev("getGroupColor('EXTERN')"), '#ec4899');
        assert.match(await ev("groupChipHtml('EXTERN')"), /<i class="fa-solid fa-user-md"><\/i><span class="grp-name">EXTERN<\/span>/);
        // 2. a set look wins; a picture takes the icon's slot (chip + Users row tag)
        await ev("groupStyle.groups.EXTERN = { color: '#0f766e', image: 'https://x/y.webp' }");
        assert.equal(await ev("getGroupColor('EXTERN')"), '#0f766e'); assert.equal(await ev("getGroupColor('extern')"), '#0f766e', 'case-insensitive key');
        const chip = await ev("groupChipHtml('EXTERN')");
        assert.match(chip, /style="--c:#0f766e;"><img class="grp-img" src="https:\/\/x\/y.webp" alt="" referrerpolicy="no-referrer"><span class="grp-name">EXTERN<\/span>/); assert.ok(!chip.includes('<i class'), 'no icon when there is a picture');
        assert.match(await ev("userGroupTagHtml({ group: 'EXTERN', division: '' })"), /<img class="grp-img" src="https:\/\/x\/y.webp"[^>]*>EXTERN/, 'Users row tag shows the picture');
        assert.equal(await ev("getGroupIcon('EXTERN')"), 'fa-user-md', 'icon unchanged when only colour/picture set');
        // 3. division look
        assert.equal(await ev("divColor('RSU')"), '#0ea5e9', 'hash colour before');
        await ev("groupStyle.divisions.RSU = { color: '#111111', icon: 'fa-star' }");
        assert.equal(await ev("divColor('RSU')"), '#111111'); assert.deepEqual(await ev("divChipLook('RSU')"), { icon: 'fa-star', image: '' }); assert.deepEqual(await ev("divChipLook('__only')"), { icon: 'fa-user', image: '' });
        assert.equal(await ev("divColor('__only')"), '#64748b', 'Only I stays grey');
        await ev("groupStyle = { groups: {}, divisions: {} }");
        // 4. the editor for a group: 🎨 in the bar → look row; a swatch saves at once and repaints
        await ev("divPick = 'EXTERN'; divPickDiv = 'RSU'; renderDivisionAdminList()");
        assert.equal(await page.$$eval('.dv-look', e => e.length), 0, 'closed at first');
        await page.click('.dv-bar [data-act="look"]');
        assert.equal(await page.$eval('.dv-bar .dv-look', e => e.dataset.lookKind), 'groups', '🎨 opens the group look inside the bar');
        assert.equal(await page.$eval('.dv-bar [data-act="look"]', e => e.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.$eval('.dv-look [data-look-color="#ec4899"]', e => e.getAttribute('aria-pressed')), 'true', 'current colour marked');
        assert.equal(await page.$eval('.dv-look [data-look-icon="fa-user-md"]', e => e.getAttribute('aria-pressed')), 'true', 'current icon marked');
        assert.equal(await page.$$eval('.dv-look [data-look-reset]', e => e.length), 0, 'no reset while default');
        await page.click('.dv-look [data-look-color="#22c55e"]');
        assert.deepEqual(await ev('sets.at(-1)'), { d: { groups: { EXTERN: { color: '#22c55e' } } }, o: { merge: true } }, 'one merge set per pick');
        assert.equal(await ev("getGroupColor('EXTERN')"), '#22c55e', 'painted before the listener echoes');
        assert.match(await page.$eval('.dv-chips .dv-chip.on', e => e.getAttribute('style')), /--c:#22c55e/, 'the group chip repaints');
        assert.equal(await page.$eval('.dv-look [data-look-color="#22c55e"]', e => e.getAttribute('aria-pressed')), 'true');
        await page.click('.dv-look [data-look-icon="fa-star"]');
        assert.deepEqual(await ev('sets.at(-1).d'), { groups: { EXTERN: { color: '#22c55e', icon: 'fa-star' } } }, 'icon merges with the colour');
        assert.match(await page.$eval('.dv-look .prev', e => e.innerHTML), /fa-star/, 'preview shows it');
        await page.$eval('.dv-look input[type=url]', e => { e.value = 'https://img/logo.png'; e.dispatchEvent(new Event('change')); });
        assert.deepEqual(await ev('sets.at(-1).d.groups.EXTERN'), { color: '#22c55e', icon: 'fa-star', image: 'https://img/logo.png' });
        assert.match(await page.$eval('.dv-look .dv-img.has img', e => e.src), /img\/logo\.png/, 'picture preview');
        await page.click('.dv-look [data-look-imgx]');
        assert.deepEqual(await ev('sets.at(-1).d.groups.EXTERN'), { color: '#22c55e', icon: 'fa-star' }, '✕ drops the picture');
        await page.click('.dv-look [data-look-reset]');
        assert.deepEqual(await ev('sets.at(-1).d'), { groups: { EXTERN: '__DEL__' } }, 'reset deletes the entry');
        assert.equal(await ev("getGroupColor('EXTERN')"), '#ec4899', 'back to the map');
        await page.click('.dv-bar [data-act="look"]');
        assert.equal(await page.$$eval('.dv-look', e => e.length), 0, '🎨 again folds it');
        // 5. the editor for a division: 🎨 beside ✕ → look row under the caption; a swatch recolours the rail chip
        await page.click('.dv-cap [data-divlook="RSU"]');
        assert.equal(await page.$eval('.dv-panel > .dv-look', e => e.dataset.lookKind), 'divisions');
        await page.click('.dv-panel > .dv-look [data-look-color="#ef4444"]');
        assert.deepEqual(await ev('sets.at(-1).d'), { divisions: { RSU: { color: '#ef4444' } } });
        assert.match(await page.$eval('.dv-rail-row .dv-rail.on', e => e.getAttribute('style')), /--c:#ef4444/, 'rail chip follows');
        await page.click('.dv-panel > .dv-look [data-look-icon="fa-mug-hot"]');
        assert.match(await page.$eval('.dv-rail-row .dv-rail.on', e => e.innerHTML), /fa-mug-hot/, 'rail chip icon follows');
        assert.equal(await page.$eval('.dv-rail-row .dv-rail:not(.on)', e => e.innerHTML.includes('fa-user')), true, 'Only I keeps its icon');
        await page.click('.dv-rail-row [data-sel="__only"]');
        assert.equal(await page.$$eval('.dv-look', e => e.length), 0, 'picking another division closes the editor');
        assert.deepEqual(await ev('toasts'), [], 'no error toasts');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: group / division look — style doc wins over the maps, picture in the chip + row tag, 🎨 editors (group bar / division caption) save one merge set per pick, reset deletes, rail + chips repaint');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
