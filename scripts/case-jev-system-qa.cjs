// V102.562: the real render + the real suggestion row in Chromium: ids only go to the server, ✓ saves the system, ✕ hides, the button sits clear of Close at both widths.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const grab = name => { const s = html.indexOf('function ' + name + '('), o = html.indexOf('{\n', s); let d = 0, i = o; for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; } return html.slice(s, i + 1); };
const rules = html.slice(html.indexOf('.alabasta-inbox-kind {'), html.indexOf('.cdup-chip {'));   // the real banner + card CSS, flex row included
const bar = html.slice(html.indexOf('<div id="alabasta-inbox-section"'), html.indexOf('<!-- cards rendered by renderAlabastaInbox() -->'));

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1100, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 800 } }), errs = [];
            page.on('pageerror', e => errs.push(e.message));
            const body = `<!doctype html><meta charset="utf-8"><style>${rules}${fs.readFileSync('public/case-jev-system.css', 'utf8')}</style>${bar}</div></div></div>`;
            await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body }));
            await page.goto('https://qa.test/a.html');
            await page.evaluate(s => {
                window.__calls = []; window.__toast = []; window.__writes = [];
                window.casesData = [
                    { id: 'a', caseId: '1', disease: 'Other / อื่นๆ', diseaseSystemKey: 'other', diseaseSystemLabel: 'Other / อื่นๆ', note: 'n', displayName: 'A' },
                    { id: 'b', caseId: '2', disease: 'Cough case', diseaseSystemKey: 'respiratory', diseaseSystemLabel: 'Respiratory / ระบบหายใจ', diseaseSystemKeys: ['respiratory', 'gi'], note: 'n', displayName: 'B' },
                    { id: 'c', caseId: '3', disease: 'Skin', diseaseSystemKey: 'skin', diseaseSystemLabel: 'Skin / ระบบผิวหนัง', note: 'n', displayName: 'C' }];
                window.productListingsData = []; window.alabastaInitials = () => ''; window.alabastaAgo = () => '1 hr'; window.isAlabastaProductPending = () => false;
                window.caseMoreSystems = c => (c.diseaseSystemKeys || []).slice(1).map(k => ' + ' + k).join('');
                window.CASE_SYSTEM_EMOJI = { ent: '👂', gi: '🍽️' }; window.caseSystemShort = k => k.toUpperCase();
                window.alabastaTaxonomyCatalog = [{ key: 'ent', label: 'ENT', thaiLabel: 'หู คอ จมูก', symptoms: [] }, { key: 'gi', label: 'GI', thaiLabel: 'ทางเดินอาหาร', symptoms: [] }];
                window.showToast = m => window.__toast.push(m); window.ALLOWED_EMAIL = 'a@x';
                window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } };
                window.db = { batch: () => ({ update: (ref, f) => window.__writes.push([ref, f]), commit: async () => {} }), collection: () => ({ doc: id => id }) };
                window.stageSubmissionMirror = async (b, id, f) => window.__writes.push(['mirror', id, f]);
                window.adminApp = { functions: () => ({ httpsCallable: n => async d => { window.__calls.push([n, d]); return { data: { enabled: true, suggestions: [{ id: 'a', key: 'ent' }, { id: 'b', key: 'gi' }], checked: 3, skipped: 0, errors: 0 } }; } }) };
                (0, eval)(s + '\nwindow.renderAlabastaInbox = renderAlabastaInbox; window.renderAlabastaCases = renderAlabastaInbox;');
                renderAlabastaInbox();
            }, grab('renderAlabastaInbox'));
            await page.addScriptTag({ content: fs.readFileSync('public/case-jev-system.js', 'utf8') });
            await page.evaluate(() => renderAlabastaInbox());
            await page.waitForTimeout(150);

            const clear = await page.evaluate(() => { const a = document.getElementById('alabasta-jev-check').getBoundingClientRect(), b = document.getElementById('alabasta-inbox-cta').getBoundingClientRect(); return getComputedStyle(document.getElementById('alabasta-inbox-toggle')).display === 'flex' && (a.right <= b.left || b.right <= a.left) && a.right <= innerWidth; });
            assert.ok(clear, width + ': the button does not cover Close');
            assert.equal((await page.locator('#alabasta-jev-check').innerText()).trim(), '', 'V102.565: the logo only');
            assert.equal(await page.locator('.cjs-inl').count(), 0, 'nothing before the button');
            await page.click('#alabasta-jev-check');
            await page.waitForSelector('.cjs-inl');
            const call = (await page.evaluate(() => window.__calls))[0];
            assert.equal(call[0], 'jevSuggestCaseSystems');
            assert.deepEqual(call[1].caseIds, ['a', 'b', 'c']);
            assert.ok(!JSON.stringify(call[1]).includes('"n"'), 'the note does not leave from the page');
            assert.equal(await page.locator('.cjs-inl').count(), 2, 'a case Jev agrees with shows nothing');
            assert.equal((await page.evaluate(() => window.__writes)).length, 0, 'nothing saved before ✓');
            const cards = page.locator('.alabasta-inbox-card');
            assert.ok((await cards.nth(1).innerText()).includes('GI first'), 'a second system becomes the first');

            await cards.nth(0).locator('.cjs-y').click();
            await page.waitForFunction(() => casesData[0].diseaseSystemKey === 'ent');
            let w = await page.evaluate(() => window.__writes);
            assert.equal(w[0][1].diseaseSystemLabel, 'ENT / หู คอ จมูก');
            assert.equal(w[0][1].disease, 'ENT / หู คอ จมูก', 'a title that repeats the old system follows it');
            assert.deepEqual(w[1], ['mirror', 'a', { title: '1 - ENT / หู คอ จมูก' }]);
            assert.equal(await page.locator('.alabasta-inbox-card.cjs-done').count(), 1, 'green frame');

            await cards.nth(1).locator('.cjs-y').click();
            await page.waitForFunction(() => casesData[1].diseaseSystemKey === 'gi');
            w = await page.evaluate(() => casesData[1]);
            assert.deepEqual(w.diseaseSystemKeys, ['gi', 'respiratory'], 'first swaps, no system is lost');
            assert.equal(w.disease, 'Cough case', 'a real title stays');

            if (process.env.QA_SHOT) await page.screenshot({ path: process.env.QA_SHOT + width + '.png', fullPage: true });
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('case-jev-system-qa OK');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
