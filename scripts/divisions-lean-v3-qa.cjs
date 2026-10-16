// V102.257 — Divisions & Groups lean: the division panel is ONE line (🏆 · group chips · 🎨 🔗 ✕), each number shown once (a single group does not repeat the division's count), a labelled
// ＋ Division beside the search field, ⇄ Merge as an icon in the title row with its panel right under it, and the merge panel = ONE list of names, two taps (🗑 retire → 📌 keep), preview + Merge on line 2.
// The REAL admin.html page in Chromium with fixture data (firebase stubbed; the merge confirm is dismissed, nothing is written).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof openDivisionsModal === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(400);
        const open = sel => page.evaluate(s => {
            const u = (id, name, group, division) => ({ id, displayName: name, group, division, score: 1, isIgnored: false });
            usersData = [u('1', 'Bua', 'EXTERN', 'RSU'), u('2', 'nt', 'EXTERN', 'RSU'), u('3', 'Bew', 'Extern', 'BUU'), u('4', 'Pat', 'Junior', 'BUU'), u('5', 'A', 'Pharmacists', 'CU'), u('6', 'X', 'Public', '')];
            preRegData = []; quizzesData = []; divisionConfig = { RSU: ['EXTERN'], BUU: ['Extern', 'Junior'], CAFE: [], CU: ['Pharmacists'] };
            openDivisionsModal(s);
        }, sel);

        await open('RSU'); await page.waitForTimeout(250);
        // ① search row + title row
        const L = await page.evaluate(() => {
            const m = document.getElementById('divisionsModal'), f = m.querySelector('.dv-filter'), head = m.querySelector('.dv-head');
            return {
                newInFilter: !!f.querySelector('.dv-newbtn'), newText: (f.querySelector('.dv-newbtn') || {}).textContent, newInRail: !!m.querySelector('.dv-rail-row .dv-newbtn'),
                mergeInHead: !!head.querySelector('#gs-merge-btn'), mergeIsIcon: head.querySelector('#gs-merge-btn').textContent.trim(), oldRow: !!document.querySelector('#divisionsModal [id="gs-merge-btn"] ~ *') && false,
                panelBeforeFilter: !!(m.querySelector('#gs-merge-panel').compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING), noInto: !document.getElementById('gs-merge-into'),
                capHasChips: !!m.querySelector('.dv-cap .dv-chips .dv-chip'), capIcon: m.querySelector('.dv-cap .dv-cap-i').textContent.trim(), capTip: m.querySelector('.dv-cap .dv-cap-i').title,
                capH: Math.round(m.querySelector('.dv-cap').getBoundingClientRect().height), panelH: Math.round(m.querySelector('.dv-panel').getBoundingClientRect().height),
                railCount: m.querySelector('.dv-rail.on small').textContent.trim(), chipClass: m.querySelector('.dv-cap .dv-chip').className, chipSmallShown: getComputedStyle(m.querySelector('.dv-cap .dv-chip small')).display !== 'none',
                mergeBtnCount: document.querySelectorAll('#gs-merge-btn').length,
            };
        });
        assert.ok(L.newInFilter && L.newText === '＋ Division' && !L.newInRail, '＋ Division is a labelled button beside the search field, no dashed circle in the rail');
        assert.ok(L.mergeInHead && L.mergeIsIcon === '⇄' && L.mergeBtnCount === 1, '⇄ is an icon in the title row (and the old text row is gone)');
        assert.ok(L.panelBeforeFilter && L.noInto, 'the merge panel sits under the title row, before the search; no separate Into list');
        assert.ok(L.capHasChips && L.capIcon === '🏆' && /ranked together as one board · 2 people/.test(L.capTip), 'RSU panel: 🏆 + the group chips on the cap row; the sentence is the tooltip: ' + L.capTip);
        assert.ok(L.capH <= 60, 'the cap row (icon · chips · 🎨 🔗 ✕) is ONE line: ' + L.capH);
        assert.equal(L.railCount, '2', 'the people count is on the division chip'); assert.ok(/dv-nocount/.test(L.chipClass) && !L.chipSmallShown, 'RSU has ONE group → its chip does not repeat the 2');
        await open('BUU'); await page.waitForTimeout(200);
        const B = await page.evaluate(() => [...document.querySelectorAll('.dv-cap .dv-chip')].map(c => ({ t: c.textContent.replace(/\s+/g, ' ').trim(), shown: getComputedStyle(c.querySelector('small')).display !== 'none' })));
        assert.ok(B.length === 2 && B.every(c => c.shown) && B.map(c => c.t).join('|') === 'Extern1|Junior1', 'a division with several groups keeps each group count (1 + 1): ' + JSON.stringify(B));
        await page.fill('#dv-filter', 'zzz'); await page.dispatchEvent('#dv-filter', 'input'); await page.waitForTimeout(150);
        assert.equal(await page.$eval('.dv-cap .dv-cap-i', e => e.textContent.trim()), '🔎', 'typing a search: 🔎');
        assert.ok(/＋ New group “zzz” in BUU/.test(await page.$eval('.dv-addgrp', e => e.textContent)), 'the create suggestion is still there'); await page.fill('#dv-filter', ''); await page.dispatchEvent('#dv-filter', 'input');

        // ② the merge panel: open from the icon, one list, two taps
        await page.click('#gs-merge-btn');
        assert.equal(await page.$eval('#gs-merge-btn', e => e.getAttribute('aria-expanded')), 'true'); assert.equal(await page.$eval('#gs-merge-panel', e => e.hidden), false);
        const names = () => page.$$eval('#gs-merge-from button', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(await names(), ['Extern 1', 'EXTERN 2', 'Junior 1', 'Pharmacists 1'], 'ONE list with every spelling (Public is not offered to retire)');
        assert.equal(await page.$eval('#gs-merge-preview', e => e.textContent), '🗑 → 📌'); assert.equal(await page.$eval('#gs-merge-go', e => e.disabled), true);
        await page.click('#gs-merge-from button[data-g="Extern"]');
        assert.deepEqual((await names()).slice(0, 1), ['🗑 Extern 1'], '1st tap: the name to retire'); assert.equal(await page.$eval('#gs-merge-preview', e => e.textContent.trim()), '🗑 Extern → ❔');
        assert.ok((await page.$$eval('#gs-merge-from button', els => els.some(e => e.dataset.g === 'Public'))), 'Public can now be picked as the one to KEEP');
        await page.click('#gs-merge-from button[data-g="EXTERN"]');
        assert.ok((await names()).includes('📌 EXTERN 2'), '2nd tap: the name to keep');
        const pv = await page.evaluate(() => ({ t: document.getElementById('gs-merge-preview').textContent.replace(/\s+/g, ' ').trim(), title: document.getElementById('gs-merge-preview').title, go: document.getElementById('gs-merge-go').disabled }));
        assert.equal(pv.t, 'Extern → EXTERN · 👤 1 · 🧩 1', 'preview on line 2: ' + pv.t); assert.equal(pv.title, '“Extern” → “EXTERN”: 1 users · 1 division slots', 'the full sentence is the tooltip (the confirm quotes it)'); assert.equal(pv.go, false, 'Merge is enabled');
        const h2 = await page.evaluate(() => ({ panel: Math.round(document.getElementById('gs-merge-panel').getBoundingClientRect().height) }));
        assert.ok(h2.panel <= 130, 'the panel is two short lines (' + h2.panel + 'px; it was ~310)');
        // Merge asks first (the full sentence is in the dialog); dismiss → nothing is written
        let dialog = ''; page.once('dialog', d => { dialog = d.message(); d.dismiss(); });
        await page.click('#gs-merge-go'); await page.waitForTimeout(150);
        assert.ok(/Merge group "Extern" into "EXTERN"\?/.test(dialog) && /“Extern” → “EXTERN”: 1 users · 1 division slots/.test(dialog), 'the confirm quotes the full sentence: ' + dialog.slice(0, 160));
        // undo: tapping a picked name un-picks it
        await page.click('#gs-merge-from button[data-g="EXTERN"]'); assert.ok(!(await names()).some(n => n.startsWith('📌')), 'tap the kept name again → un-picked');
        await page.click('#gs-merge-from button[data-g="Extern"]'); assert.equal(await page.$eval('#gs-merge-preview', e => e.textContent), '🗑 → 📌', 'tap the retired name again → back to the start');
        await page.click('#gs-merge-btn'); assert.equal(await page.$eval('#gs-merge-panel', e => e.hidden), true, '⇄ closes the panel');
        console.log('PASS: Divisions & Groups lean — ONE-line division panel, each number once, ＋ Division beside the search, ⇄ in the title row, merge panel = one list + two taps (🗑 → 📌) with the preview and Merge on line 2');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
