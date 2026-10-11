// V101.117: ⚙ Settings moved out of the profile rail and its own modal INTO the Info modal — a round ⚙ top-right, left of ×; tap → the
// privacy panel (two opt-outs · 📖 Guide · Reload · status) folds out under the title. openSettingsModal() still works (opens Info +
// unfolds). Static pins + the REAL togglePiSettings / openSettingsModal / loadSettingsPrefs / saveSettingsPref on the real markup + CSS.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('id="settingsModal"'), 'the Settings modal is gone');
const rail = html.slice(html.indexOf('<div id="profile-quick-actions">'), html.indexOf('<div class="u-hdr-more"'));   // V101.117: the rail sits inside the info row
assert.ok(!rail.includes('openSettingsModal') && !rail.includes('fa-gear'), 'no ⚙ in the rail');
assert.equal((rail.match(/<button/g) || []).length, 4, 'four rail buttons: Schedule · Info · EN · Flood');
const info = html.slice(html.indexOf('<div id="personalInfoModal" class="modal">'), html.indexOf('<div class="pi-tabs"'));
const xAt = info.indexOf('&times;'), gearAt = info.indexOf('id="pi-settings-btn"'), h3At = info.indexOf('<h3'), panelAt = info.indexOf('<div id="pi-settings" class="pi-settings" hidden>');
assert.ok(xAt > 0 && gearAt > xAt && h3At > gearAt && panelAt > h3At, '× then ⚙ (both float right → ⚙ lands left of ×), then the title, then the folded panel');
assert.ok(/<button type="button" id="pi-settings-btn" class="pi-gear" onclick="togglePiSettings\(\)" aria-expanded="false" aria-controls="pi-settings"/.test(info), '⚙ toggles the panel');
for (const id of ['settings-grammar-optout', 'settings-line-notify-optout', 'btn-intern-guide', 'settings-reload-btn', 'settings-save-status']) assert.ok(info.includes('id="' + id + '"'), 'panel keeps #' + id);
assert.ok(/#personalInfoModal \.pi-gear \{ float:right;/.test(html), 'gear CSS');
// V101.117: "Match" is icon-only (label in the tooltip); the hint sentence is folded behind an ⓘ (tooltip on hover, tap unfolds the line)
assert.ok(/aria-label="Match with Enrollment Key">🔑<\/button>/.test(info), 'Match chip = 🔑 only');
assert.ok(/<button type="button" class="pi-help" onclick="piToggleHint\(\)" aria-expanded="false" aria-controls="pi-hint" title="Please enter real info — used for contact and certificates/.test(info), 'ⓘ carries the hint as a tooltip');
assert.ok(/<p id="pi-hint" hidden/.test(info), 'the hint line starts folded');
for (const g of ['public/intern-guide.md', 'public/intern-guide.en.md']) { const t = fs.readFileSync(g, 'utf8'); assert.ok(!/\| ⚙️ \*\*Settings\*\* \|/.test(t) && t.includes('⚙️ ▸ 📖 Guide'), 'guide updated: ' + g); }

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const fns = ['function togglePiSettings(', 'function openSettingsModal(', 'function loadSettingsPrefs(', 'function saveSettingsPref('].map(m => grab(html, m)).join('\n');
const css = html.slice(html.indexOf('        /* V101.117: ⚙ Settings in the Info modal'), html.indexOf("        /* V101.31: the rail's ⋯ menu is gone"));
const markup = html.slice(html.indexOf('<div id="personalInfoModal" class="modal">'), html.indexOf('<div class="pi-tabs"')) + '</div></div>';

(async () => {
    const browser = await chromium.launch();
    try {
        for (const [w, touch] of [[420, false], [360, true]]) {
            const page = await (await browser.newContext({ viewport: { width: w, height: 600 }, hasTouch: touch, isMobile: touch })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;font:14px sans-serif}.modal{display:block}.modal-content{padding:16px;box-sizing:border-box}' + css + '</style>' + markup);
            await page.addScriptTag({ content: [
                "var userId = 'u1'; var gets = 0, sets = []; var db = { collection: () => ({ doc: () => ({ get: async () => { gets++; return { exists: true, data: () => ({ grammarOptOut: true, lineNotifyOptOut: false }) }; }, set: async (d, o) => { sets.push({ d, o }); } }) }) };",
                "var opened = 0; function openPersonalInfoModal() { opened++; document.getElementById('personalInfoModal').style.display = 'block'; }",
                fns].join('\n') });
            const vis = sel => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);
            const box = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
            assert.equal(await vis('#pi-settings'), false, 'panel folded at first @' + w);
            const gear = await box('#pi-settings-btn'), x = await box('#personalInfoModal > .modal-content > span');
            assert.ok(gear.r <= x.l + 1 && Math.abs((gear.t + gear.b) / 2 - (x.t + x.b) / 2) < 14, '⚙ sits left of × on the same line @' + w + ': ' + JSON.stringify({ gear, x }));
            assert.ok(gear.r > w * 0.7, '⚙ is at the top-right @' + w);
            if (touch) assert.ok(gear.b - gear.t >= 36, '36px target on touch');
            await page.click('#pi-settings-btn');
            assert.equal(await vis('#pi-settings'), true, '⚙ unfolds the panel');
            assert.equal(await page.$eval('#pi-settings-btn', e => e.getAttribute('aria-expanded')), 'true');
            await page.waitForFunction(() => document.getElementById('settings-grammar-optout').checked);
            assert.equal(await page.$eval('#settings-line-notify-optout', e => e.checked), false, 'prefs loaded from the user doc');
            assert.equal(await page.evaluate('gets'), 1);
            const panel = await box('#pi-settings'), title = await box('#personalInfoModal h3');
            assert.ok(panel.t >= title.b - 1, 'panel is under the title');
            await page.click('#settings-line-notify-optout');
            assert.deepEqual(await page.evaluate('sets.at(-1)'), { d: { lineNotifyOptOut: true }, o: { merge: true } }, 'a toggle saves one merge set');
            await page.waitForFunction(() => /Saved/.test(document.getElementById('settings-save-status').textContent));
            await page.click('#pi-settings-btn');
            assert.equal(await vis('#pi-settings'), false, '⚙ again folds it');
            await page.evaluate(() => openSettingsModal());
            assert.equal(await page.evaluate('opened'), 1, 'openSettingsModal opens Info…');
            assert.equal(await vis('#pi-settings'), true, '…and unfolds the panel');
            assert.equal(await page.evaluate('gets'), 2, '…reloading the prefs');
            assert.deepEqual(errs, [], 'no page errors @' + w);
            await page.context().close();
        }
        console.log('PASS: ⚙ Settings inside the Info modal — left of × top-right, folds the privacy panel under the title, prefs load/save as before, openSettingsModal opens Info + unfolds; rail is four buttons; guides updated');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
