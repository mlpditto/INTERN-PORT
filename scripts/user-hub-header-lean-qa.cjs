// V102.164: admin ▸ User Hub modal — the header is ONE line (person · LINE ID ⧉ · enrollment code ⧉ · Google · EN/TH · points · Beri · ×;
// the words Profile / LINE ID / Enrollment CODE / pts moved into tooltips), the User group block is ONE row (the main group as the
// rail chip that opens the picker · "also" + faded extra chips · +), and the Save row shows only once something differs from the
// opened state, carrying the group diff and a count. Static pins + the REAL gs* functions on the real markup + CSS.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('class="gs-plus gs-chip-div" onclick="openDivisionsModal()"'), 'V102.178: step ① of the picker ends with a ＋ that opens Divisions & Groups');
assert.ok(!html.includes('<i class="fa-solid fa-gear"></i> <span data-gs-en="Divisions'), 'the grey text link under the rail is gone');
const header = html.slice(html.indexOf('<div class="gs-header lang-no-toggle">'), html.indexOf('<input type="hidden" id="gs-uid">'));
assert.ok(!html.includes('class="gs-identity"'), 'the second identity row is gone');
for (const gone of ['data-gs-en="Profile"', '>LINE ID<', '>Enrollment CODE<', '</span> pts<']) assert.ok(!header.includes(gone), 'no label text: ' + gone);
assert.ok(!header.includes('class="gs-id"') && !html.includes('gsCopyLineId'), 'V102.174: no LINE ID chip in the header any more');
const social = html.slice(html.indexOf('<section class="gs-profile-card gs-card-social">'), html.indexOf('</section>', html.indexOf('<section class="gs-profile-card gs-card-social">')));
assert.ok(/id="gs-social-line" hidden><\/div>\n<div class="gs-card-field gs-line-uid"><label for="gs-line-uid">LINE User ID<\/label>[\s\S]*?onclick="gsCopyProfile\(this, false\)">Copy<\/button>[\s\S]*?<input type="text" id="gs-line-uid" readonly hidden>/.test(social), 'V102.174: the LINE ID is a read-only field with Copy, right after LINE in the Social card');
// V102.176: the enrollment CODE chip lives inline in the Personal details card header (not in the modal header); same chip: icon · code · ⧉
const basicStart = html.indexOf('<section class="gs-profile-card gs-card-basic"><header>');
const basicHeader = html.slice(basicStart, html.indexOf('</header>', basicStart));
assert.ok(/Personal details<\/h3><button type="button" class="gs-code" id="gs-enrollment-chip" onclick="gsCopyEnrollmentCode\(\)"[^>]*><i class="fa-solid fa-key"[^>]*><\/i><code id="gs-enrollment-code">-<\/code><i class="fa-regular fa-copy"/.test(basicHeader), 'enrollment chip sits right after the Personal details title and copies');
assert.ok(!header.includes('gs-enrollment-chip'), 'and is gone from the modal header');
for (const id of ['gs-hub-pic', 'gs-title-name', 'gs-google-chip', 'gs-google-email', 'gs-user-score', 'gs-user-beri']) assert.ok(header.includes('id="' + id + '"'), 'header keeps #' + id);
const order = ['gs-header-person', 'class="gs-ident"', 'class="gs-spacer"', 'class="gs-lang-switch"', 'gs-bal-pts', 'gs-bal-beri', 'gs-header-close'].map(m => header.indexOf(m));
assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'order: person · identity · spacer · EN/TH · points · Beri · ×');
assert.ok(html.includes("function gsCopyEnrollmentCode()"), 'copy handler exists');
// V102.180: Google = ONE icon (the G) + email; the chip itself disconnects (no 🌐 in front, no link-slash button behind)
assert.ok(html.includes("chip.title = (link && link.email ? link.email + ' — ' : '')"), 'the full Google address is the chip tooltip');
assert.ok(/<button type="button" id="gs-google-chip" class="gs-google" onclick="gsDisconnectGoogle\(\)"[^>]*><svg viewBox="0 0 48 48"[^>]*>(?:<path [^>]*\/>){4}<\/svg><code id="gs-google-email" hidden>-<\/code><\/button>/.test(header), 'Google chip = the G only (email is hidden, shown on hover), click disconnects');
assert.ok(!header.includes('🌐') && !header.includes('fa-link-slash'), 'no second icon on the Google chip');
const grp = html.slice(html.indexOf('<section class="gs-inline-group lang-no-toggle"'), html.indexOf('<div id="gs-pane-group" hidden>'));
assert.ok(!grp.includes('gs-group-summary') && !grp.includes('Select one group') && !/<button[^>]*id="gs-group-toggle"/.test(grp), 'no summary box / help text / Change group button');
assert.ok(!html.includes('gs-grp-row') && !html.includes('id="gs-also"') && !html.includes('id="gs-extra-add"') && !grp.includes('<h3'), 'V102.214: no separate User group block — no heading, "also" label or + button; the main chip opens the picker');
assert.ok(/id="gs-title-name">\.\.\.<\/span><span id="gs-current-group"><\/span><span class="gs-extra-chips" id="gs-extra-chips"><\/span>/.test(html), 'V102.209: the main group chips sit right after the name in the header');
assert.ok(/<div class="gs-save-row lang-no-toggle" id="gs-save-row" hidden><span id="gs-save-diff"/.test(html), 'the Save row starts hidden and carries the diff');
assert.ok(!html.includes("'Save profile and group together'") && !html.includes("'Unsaved changes'"), 'the two status sentences are gone');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));   // body brace, not a default-param "{}" (groupChipHtml(g, o = {}))
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const fns = ['function gsPaintMainGroup(', 'function gsState(', 'function gsDirtyCount(', 'function gsDirtyPaint(', 'function gsExtraPaint(', 'function gsExtraRemove(', 'function gsExtraAdd(',
    'function gsExtraRenderPick(', 'function gsSetMembMode(', 'function gsPickGroup(', 'function toggleGsGroups(', 'function groupStyleOf(', 'function divChipLook(', 'function groupChipHtml(', 'function gsDivisionChipHtml(', 'function userMemberships(', 'function userInDivision(', 'function divColor(', 'function userDivisionOf('].map(m => grab(html, m)).join('\n');
const css = [
    html.slice(html.indexOf('        .grp-chip { --c:#64748b;'), html.indexOf('        /* V102.64: Event modal')),
    html.slice(html.indexOf('        .grp-chip:hover {'), html.indexOf('        /* V102.59: the picker is sections')),
    html.slice(html.indexOf('        /* V102.164: one header line'), html.indexOf('        /* --- [V92.37] User Hub Backlog')),
    html.slice(html.indexOf('        /* V102.164: the group block is ONE row'), html.indexOf('        #groupSelectModal .gs-inline-group h3 { font-size:13px')),
    html.slice(html.indexOf('        /* V102.164: the Save row appears only'), html.indexOf('        #groupSelectModal .gs-save-row span')),
    html.match(/        #groupSelectModal \.gs-lang-switch \{[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n/)[0]
].join('\n');
const markup = '<div id="groupSelectModal" style="width:100%"><div class="modal-content">' + header
    + '<input type="hidden" id="gs-uid"><div id="gs-profile-body"><input type="text" id="gs-tel" value="081"></div>'
    + grp + '<div id="gs-pane-group" hidden><input type="text" id="gs-input" hidden><div id="gs-list"><button class="gs-chip" data-group="MLP" data-div="" onclick="gsPickGroup(this, this.dataset.group, this.dataset.div)">MLP</button><button class="gs-chip" data-group="EXTERN" data-div="RSU" onclick="gsPickGroup(this, this.dataset.group, this.dataset.div)">EXTERN</button></div></div></section>'
    + html.slice(html.indexOf('<div class="gs-save-row lang-no-toggle" id="gs-save-row" hidden>'), html.indexOf('</div>', html.indexOf('id="gs-save-row"')) + 6) + '</div></div>';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--primary:#4361ee;--text-sub:#64748b}body{margin:0;font:14px sans-serif}' + css + '</style>' + markup);
        await page.addScriptTag({ content: [
            "let groupStyle = { groups: {}, divisions: {} };   // V102.180: the look doc, empty here",
            "var escapeHtml = s => String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));",
            "var getGroupColor = g => ({ MLP: '#ef4444', EXTERN: '#7209b7', CAFE: '#f97316' })[g] || '#6c757d'; var getGroupIcon = g => 'fa-tag';",
            "var groupActiveCount = g => ({ MLP: 9, EXTERN: 2, CAFE: 4 })[g] || 0; var groupTotalCount = g => groupActiveCount(g);",
            "var getGlobalGroups = () => ['MLP', 'EXTERN', 'CAFE']; var gsCollectAddresses = () => []; var gsLanguage = 'en'; var gsText = (en, th) => gsLanguage === 'th' ? th : en;",
            "var renderGsGroupList = function () {}; var gsMembMode = false, gsMembDiv = ''; " + html.match(/const gsPairKey = [^\n]*/)[0] + " var gsDivision = 'RSU', usersData = [{ group: 'EXTERN', division: 'RSU' }], divisionConfig = { RSU: ['EXTERN', 'Junior'] }, opened = 0, openDivisionsModal = function () { opened++; }; var gsRefreshProfileCards = function () {}; let gsExtra = []; let gsSnap = null;",
            fns,
            "document.getElementById('gs-input').value = 'EXTERN'; gsPaintMainGroup('EXTERN'); gsExtraPaint(); gsSnap = Object.assign(gsState(), { groupName: 'EXTERN' }); gsDirtyPaint();",
            "document.getElementById('gs-profile-body').oninput = () => gsDirtyPaint();"
        ].join('\n') });
        const top = sel => page.$eval(sel, e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2));   // vertical centre: items differ in height on one line
        const vis = sel => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);
        // header: one line on a desktop width
        const tops = await Promise.all(['.gs-header-person', '.gs-lang-switch', '.gs-bal-pts', '.gs-bal-beri', '.gs-header-close'].map(top));
        assert.ok(Math.max(...tops) - Math.min(...tops) <= 6, 'everything on one line at 900px: ' + tops.join(','));
        // group block
        assert.equal(await page.$eval('#gs-current-group .gs-main', e => e.id + '|' + e.className + '|' + e.querySelector('.grp-name').textContent + '|' + e.getAttribute('aria-expanded')), 'gs-group-toggle|grp-chip gs-main on|EXTERN|false', 'main group = rail chip, selected look, carries the toggle');
        // V102.178: "Audit in RSU" — the division chip beside the main chip opens the same picker (step ① is where the division is chosen)
        assert.equal(await page.$eval('#gs-current-group .gs-divchip .grp-name', e => e.textContent), 'RSU', 'EXTERN lives in RSU');
        assert.equal(await page.locator('#gs-current-group .gs-in').textContent(), '›');
        await page.click('#gs-current-group .gs-divchip');
        assert.equal(await page.$eval('#gs-pane-group', e => e.hidden), false, 'the division chip opens the picker');
        await page.click('#gs-group-toggle');   // fold it again for the steps below
        assert.equal(await vis('#gs-save-row'), false, 'nothing changed → no Save row');
        await page.click('#gs-group-toggle');
        assert.equal(await page.$eval('#gs-pane-group', e => e.hidden), false, 'tap the chip → picker opens');
        assert.equal(await page.$eval('#gs-group-toggle', e => e.getAttribute('aria-expanded')), 'true');
        await page.evaluate(() => gsExtraAdd('CAFE'));
        assert.equal(await page.$eval('#gs-extra-chips .grp-chip .grp-name', e => e.textContent), 'CAFE');
        assert.equal(await page.$eval('#gs-extra-chips .gs-pair', e => getComputedStyle(e).opacity), '0.6', 'membership pair chips are faded');
        assert.equal(await vis('#gs-save-row'), true, 'extras changed → Save row');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 1 change');
        assert.equal(await page.$eval('#gs-save-diff', e => e.innerHTML), '', 'no group diff yet');
        await page.click('#gs-list [data-group="MLP"]');
        assert.equal(await page.$eval('#gs-current-group .gs-main .grp-name', e => e.textContent), 'MLP', 'picking repaints the chip');
        assert.equal(await page.$eval('#gs-current-group .gs-divchip .grp-name', e => e.textContent), 'Only I', 'a group in no division → Only I');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 2 changes');
        assert.deepEqual(await page.$$eval('#gs-save-diff .grp-chip', els => els.map(e => e.textContent.trim() + (e.classList.contains('on') ? '*' : ''))), ['EXTERN', 'MLP*'], 'diff = old chip → new chip (selected look)');
        await page.evaluate(() => gsExtraRemove('CAFE'));
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 1 change', 'extras back → one change');
        await page.fill('#gs-tel', '082');
        assert.equal(await page.$eval('#gs-save-btn', e => e.textContent.trim()), 'Save 2 changes', 'a profile field counts');
        await page.fill('#gs-tel', '081');
        await page.click('#gs-list [data-group="EXTERN"]');
        assert.equal(await vis('#gs-save-row'), false, 'back to the opened state → the row folds');
        // phone: identity chips wrap under the name, × stays on the first line
        await page.setViewportSize({ width: 375, height: 700 });
        assert.ok(await top('.gs-ident') > await top('.gs-header-person') + 20, 'identity chips drop under the name at 375px');
        const edge = sel => page.$eval(sel, e => Math.round(e.getBoundingClientRect().top));   // V102.209: the person block is taller on a phone (division › group under the name), so compare top edges
        assert.ok(Math.abs(await edge('.gs-header-close') - await edge('.gs-header-person')) <= 6, '× stays on the first line');
        assert.ok(await edge('#gs-current-group') > await edge('.gs-header-person') + 20, 'V102.209: division › group drops under the name on a phone');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: User Hub — one-line header (labels → tooltips, ⧉ on LINE ID + code, wraps on phone), group block one row (rail chip toggles the picker, also/extras faded), Save row only when dirty with diff + count');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
