// V102.148: admin ▸ User Hub ▸ "Also in" — extra groups (users.extraGroups, admin-set only). They only decide which UI(s) a user may open.
// Runs the REAL gsExtra* functions + gsPickGroup cut out of admin.html on a minimal DOM, and pins the save / merge / delete wiring.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

function grab(src, startMarker) {
    const i = src.indexOf(startMarker);
    assert.ok(i >= 0, 'found ' + startMarker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const fns = ['function gsExtraPaint(', 'function gsExtraRemove(', 'function gsExtraAdd(', 'function gsExtraRenderPick(', 'function gsExtraToggle(', 'function gsPickGroup('].map(m => grab(html, m)).join('\n');

// Static wiring
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/id="gs-extra-chips"/.test(html) && /id="gs-extra-pick" hidden/.test(html) && /onclick="gsExtraToggle\(\)"/.test(html), 'the "Also in" row is in the user modal');
assert.ok(/extraGroups: \[\.\.\.new Set\(gsExtra\.map\(g => canonicalGroupName\(g\)\)\.filter\(g => g && g\.toUpperCase\(\) !== newGroup\.toUpperCase\(\)\)\)\]/.test(html), 'Save changes writes extraGroups (canonical names, never the main group)');
assert.ok(/gsExtra = Array\.isArray\(user\?\.extraGroups\) \? user\.extraGroups\.filter\(Boolean\) : \[\];/.test(html), 'the modal loads the user\'s extras');
assert.ok(/bump\(g, 'extra'\)/.test(html) && /\[u\.extra, 'extra-group memberships'\]/.test(html) && /u\.users \+ u\.extra \+ u\.pre/.test(html), 'Merge counts extras as uses');
const merge = grab(html, 'async function runGroupMerge(');
assert.ok(/u\.extraGroups\.map\(g => g === from \? into : g\)/.test(merge) && /\{ extraGroups: next \}/.test(merge), 'Merge / rename rewrites extras');
const del = grab(html, 'async function deleteGroupGlobally(');
assert.ok(/extraGroups: u\.extraGroups\.filter\(g => g !== groupName\)/.test(del), 'Delete removes the group from extras');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><input id="gs-input" value="Pharmacists"><strong id="gs-current-group"></strong><span id="gs-save-status"></span><div id="gs-extra"><span id="gs-extra-chips"></span><button id="gs-extra-add" aria-expanded="false" onclick="gsExtraToggle()"></button></div><div id="gs-extra-pick" hidden></div><div id="gs-list"><button class="gs-chip" data-group="Audit">Audit</button></div>');
        const prelude = [
            "var escapeHtml = function (s) { return String(s).replace(/[&<>\"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]; }); };",
            "var getGlobalGroups = function () { return ['Pharmacists', 'Audit', 'Marketing', 'EXTERN', 'Public']; };",
            "var groupChipHtml = function (g, o) { o = o || {}; return '<button type=\"button\" class=\"grp-chip ' + (o.cls || '') + '\" ' + (o.attrs || '') + ' title=\"' + escapeHtml(o.hint || '') + '\">' + escapeHtml(g) + '</button>'; };",
            "let gsExtra = [];"
        ].join(String.fromCharCode(10));
        await page.addScriptTag({ content: prelude + String.fromCharCode(10) + fns });
        const chips = sel => page.$$eval(sel + ' button', els => els.map(e => e.textContent));

        assert.deepEqual(await chips('#gs-extra-chips'), [], 'no extras at first');
        await page.click('#gs-extra-add');
        assert.equal(await page.$eval('#gs-extra-pick', e => e.hidden), false, '+ opens the picker');
        assert.deepEqual(await chips('#gs-extra-pick'), ['Audit', 'Marketing', 'EXTERN', 'Public'], 'the picker offers every group except the main one');
        await page.click('#gs-extra-pick button[data-g="Audit"]');
        assert.deepEqual(await page.evaluate(() => gsExtra), ['Audit']);
        assert.deepEqual(await chips('#gs-extra-chips'), ['Audit'], 'the added group is a chip');
        assert.deepEqual(await chips('#gs-extra-pick'), ['Marketing', 'EXTERN', 'Public'], 'and leaves the picker');
        await page.evaluate(() => gsExtraAdd('Audit')); await page.evaluate(() => gsExtraAdd('pharmacists'));
        assert.deepEqual(await page.evaluate(() => gsExtra), ['Audit'], 'no duplicates and never the main group');
        await page.click('#gs-extra-chips button[data-g="Audit"]');
        assert.deepEqual(await page.evaluate(() => gsExtra), [], 'tap a chip to remove it');
        assert.deepEqual(await chips('#gs-extra-pick'), ['Audit', 'Marketing', 'EXTERN', 'Public'], 'it is offered again');
        // picking Audit as the MAIN group drops it from the extras
        await page.evaluate(() => { gsExtraAdd('Audit'); gsExtraAdd('Marketing'); });
        await page.evaluate(() => gsPickGroup(document.querySelector('#gs-list .gs-chip'), 'Audit'));
        assert.deepEqual(await page.evaluate(() => gsExtra), ['Marketing'], 'the new main group is removed from the extras');
        await page.click('#gs-extra-add');
        assert.equal(await page.$eval('#gs-extra-pick', e => e.hidden), true, '+ closes the picker');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: admin "Also in" — add / remove / dedupe / main group excluded, saved as users.extraGroups, merge + rename + delete keep extras consistent');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
