// V101.164 / V102.286: Know thyself — the tab's new name, and the third chip "In my words" (habits · likes) stored at
// users/{uid}.personality.self with a merge set (neris / big5 untouched); the admin User Hub chip + popover show it.
// REAL markup + CSS + functions of index.html / admin.html in a browser.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const idx = read('public/index.html'), adm = read('public/admin.html'), css = read('public/personal-profile-tabs.css');

assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx) && /<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adm));
// ---- static pins: no visible "Know Yourself" left (comments may keep the history)
const visibleIdx = idx.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const visibleAdm = adm.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
assert.equal((visibleIdx.match(/Know Yourself/g) || []).length, 0, 'index.html: no visible "Know Yourself" left');
assert.equal((visibleAdm.match(/Know Yourself/g) || []).length, 0, 'admin.html: no visible "Know Yourself" left');
assert.ok(idx.includes('>🧭 Know thyself</button>') && idx.includes("'Know thyself'"), 'tab renamed');
for (const id of ['pers-pane-self', 'pers-self-habits', 'pers-self-likes', 'pers-self-save-btn', 'pers-self-saved-note']) assert.ok(idx.includes('id="' + id + '"'), '#' + id);
assert.ok(/data-pane="self" onclick="persSwitchPane\('self'\)"/.test(idx), 'third chip');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const secStart = idx.indexOf('<div id="section-personality"');
const section = idx.slice(secStart, idx.indexOf('<!-- ====', idx.indexOf('id="pers-journal-cta"', secStart)));   // the whole tab, past the Journal bridge
const internFns = ['function persSwitchPane(', 'function renderPersonalitySelf(', 'async function persSaveSelf('].map(m => grab(idx, m)).join('\n');
const admFns = ['function hubPersonalityLabel(', 'function buildHubPersonalityChip(', 'window.toggleHubPersonalityDetail = function(', 'function hubPersDate('].map(m => grab(adm, m)).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        // ------------------------------------------------------------ intern
        {
            const page = await (await browser.newContext({ viewport: { width: 363, height: 900 }, isMobile: true, hasTouch: true })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;font:14px sans-serif}' + css + '</style><div id="personalInfoModal"><div class="modal-content"><button id="pi-tab-self"></button>' + section.replace(' hidden ', ' ') + '</div></div>');
            await page.addScriptTag({ content: [
                "var userId = 'u1', SETS = [], TOASTS = []; function requireRegistered() { return true; } function showToast(t) { TOASTS.push(t); }",
                "var db = { collection: () => ({ doc: () => ({ set: async (d, o) => { SETS.push({ d, o }); } }) }) };",
                internFns
            ].join('\n') });
            const shown = sel => page.$eval(sel, e => e.getClientRects().length > 0);
            await page.evaluate(() => persSwitchPane('neris'));
            assert.equal(await shown('#pers-pane-self'), false, 'self pane hidden on the NERIS chip');
            await page.click('.pers-tab-chip[data-pane="self"]');
            assert.equal(await shown('#pers-pane-self'), true, 'third chip shows the pane');
            assert.equal(await shown('#pers-pane-neris'), false, '…and hides NERIS');
            assert.equal(await page.$eval('.pers-tab-chip[data-pane="self"]', e => e.style.background), 'rgb(124, 58, 237)', 'chip painted on');
            // load
            await page.evaluate(() => renderPersonalitySelf({ personality: { neris: { type: 'ISTP' }, self: { habits: 'ตื่นเช้า', likes: 'city pop', at: '2026-10-18T01:00:00.000Z' } } }));
            assert.deepEqual(await page.evaluate(() => [document.getElementById('pers-self-habits').value, document.getElementById('pers-self-likes').value]), ['ตื่นเช้า', 'city pop'], 'fields filled from users.personality.self');
            assert.ok(/Saved/.test(await page.$eval('#pers-self-saved-note', e => e.textContent)), 'saved note shows the date');
            // a field being typed in is not clobbered by a snapshot
            await page.focus('#pers-self-habits'); await page.fill('#pers-self-habits', 'typing…');
            await page.evaluate(() => renderPersonalitySelf({ personality: { self: { habits: 'from server', likes: 'L2' } } }));
            assert.deepEqual(await page.evaluate(() => [document.getElementById('pers-self-habits').value, document.getElementById('pers-self-likes').value]), ['typing…', 'L2'], 'focused field kept, the other updated');
            // save: one merge set with ONLY personality.self (neris / big5 never in the payload)
            await page.fill('#pers-self-likes', '  กาแฟดริป  ');
            await page.evaluate(() => persSaveSelf());
            const s = await page.evaluate(() => SETS[0]);
            assert.ok(s && s.o && s.o.merge === true, 'merge set');
            assert.deepEqual(Object.keys(s.d), ['personality'], 'only personality');
            assert.deepEqual(Object.keys(s.d.personality), ['self'], 'only personality.self — neris / big5 untouched');
            assert.deepEqual([s.d.personality.self.habits, s.d.personality.self.likes], ['typing…', 'กาแฟดริป'], 'trimmed values');
            assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(s.d.personality.self.at), 'ISO at');
            assert.ok(/Saved/.test(await page.evaluate(() => TOASTS.at(-1))), 'toast');
            assert.equal(await page.$eval('#pers-self-save-btn', e => e.disabled), false, 'button re-enabled');
            // 600-char cap
            await page.fill('#pers-self-habits', 'x'.repeat(700));
            await page.evaluate(() => persSaveSelf());
            assert.equal(await page.evaluate(() => SETS[1].d.personality.self.habits.length), 600, 'capped at 600');
            assert.deepEqual(errs, [], 'no page errors (intern)');
            await page.close();
        }
        // ------------------------------------------------------------ admin
        {
            const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.setContent('<!doctype html><meta charset="utf-8"><div id="lb-popup-header" style="position:relative;"><span id="hub-chip-host"></span><div id="hub-pers-popover" style="display:none;position:absolute;"></div></div>');
            await page.addScriptTag({ content: [
                'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
                'var HUB_NERIS_GROUP = { ISTP: "SP" }, HUB_NERIS_COLOR = { SP: "#d97706" }, HUB_NERIS_GROUP_NAME = { SP: "Explorer" }, HUB_B5_TRAITS = [];',
                'var usersData = [], closeHubPersonalityOnce = () => {};',
                admFns
            ].join('\n') });
            const chipFor = u => page.evaluate(u => { const html = buildHubPersonalityChip(u); document.getElementById('hub-chip-host').innerHTML = html; return html; }, u);
            assert.equal(await chipFor({ id: 'a', personality: {} }), '', 'no chip without anything');
            assert.ok(/In my words/.test(await chipFor({ id: 'b', personality: { self: { habits: 'early riser' } } })), 'self text alone earns the chip');
            assert.ok(/ISTP/.test(await chipFor({ id: 'c', personality: { neris: { type: 'ISTP' }, self: { likes: 'x' } } })), 'a NERIS type still wins the label');
            // popover body shows the words, escaped, only when present
            const popover = async u => { await page.evaluate(u => { usersData = [u]; window._currentPopupUser = u.id; window._persRailOpen = false; const pop = document.getElementById('hub-pers-popover'); pop.style.display = 'none'; }, u); await page.evaluate(() => toggleHubPersonalityDetail({ stopPropagation() {} })); return page.$eval('#hub-pers-popover', e => e.innerHTML); };
            let html = await popover({ id: 'b', personality: { self: { habits: 'early <b>riser</b>', likes: '', at: '2026-10-18T01:00:00.000Z' } } });
            assert.ok(/In my words/.test(html) && /Habits:/.test(html) && /early &lt;b&gt;riser&lt;\/b&gt;/.test(html), 'habits shown, escaped');
            assert.ok(!/Likes:/.test(html), 'empty likes line left out');
            assert.ok(/Know thyself/.test(html), 'popover header renamed');
            html = await popover({ id: 'c', personality: { neris: { type: 'ISTP', at: '2026-10-01T00:00:00.000Z' } } });
            assert.ok(!/In my words/.test(html) && /ISTP/.test(html), 'no self section when there are no words');
            assert.deepEqual(errs, [], 'no page errors (admin)');
            await page.close();
        }
        console.log('know-thyself-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
