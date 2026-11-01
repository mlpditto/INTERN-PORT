// V102.568: Merge with a preview in Chromium: both notes and systems stay, the other case folds with 0 points in one batch, Undo restores both, other interns and reviewed cases cannot merge.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/case-dup.js', 'utf8'), html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const css = html.slice(html.indexOf('.cdup-chip {'), html.indexOf('#toast .toast-undo'));
assert.ok(html.includes('id="alabasta-bulk-merge"') && html.includes('caseDup.picked()'), 'on the bulk bar');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1024, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 800 } }), errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${css}</style><div id="toast"></div><div id="chip"></div>` }));
            await page.goto('https://qa.test/a.html');
            await page.evaluate(() => {
                const t = h => ({ toMillis: () => 1800000000000 - h * 3600000 });
                window.casesData = [
                    { id: 'a', userId: 'u', displayName: 'Intern A', caseId: '1', customer: 'x', disease: 'Other / อื่นๆ', diseaseSystemKey: 'other', diseaseSystemLabel: 'Other / อื่นๆ', note: 'ตาแดงทั้งสองข้าง น้ำตาไหล คันตา', symptomTags: ['Eye Redness'], timestamp: t(3), status: 'pending' },
                    { id: 'b', userId: 'u', displayName: 'Intern A', caseId: '1', customer: 'x', disease: 'Cough note', diseaseSystemKey: 'renal', diseaseSystemLabel: 'Renal/Urinary / ปัสสาวะ', note: 'ปัสสาวะแสบขัด กินน้ำน้อย จ่ายยา 5 วัน', medications: ['norfloxacin'], timestamp: t(1), status: 'pending' },
                    { id: 'c', userId: 'other', displayName: 'Intern B', caseId: '1', customer: 'x', diseaseSystemKey: 'skin', note: 'ผื่นที่แขน', timestamp: t(2), status: 'pending' },
                    { id: 'd', userId: 'u', displayName: 'Intern A', caseId: '9', customer: 'y', diseaseSystemKey: 'msk', note: 'ปวดหลัง', timestamp: t(4), status: 'reviewed', isArchived: true },
                    { id: 'e', userId: 'u', displayName: 'Intern A', caseId: '9', customer: 'y', diseaseSystemKey: 'msk', note: 'ปวดเข่าข้างซ้ายมาก', timestamp: t(0.5), status: 'pending' }];
                window.alabastaTaxonomyCatalog = [{ key: 'renal', label: 'Renal/Urinary', thaiLabel: 'ปัสสาวะ' }, { key: 'other', label: 'Other', thaiLabel: 'อื่นๆ' }];
                window.CASE_SYSTEM_EMOJI = { renal: '💧', other: '📋' }; window.caseSystemShort = k => k; window.alabastaAgo = () => '1 hr';
                window.__toast = []; window.showToast = m => window.__toast.push(m); window.ALLOWED_EMAIL = 'a@x'; window.__batches = [];
                const D = { serverTimestamp: () => 'ts', delete: () => '__del' };
                window.firebase = { firestore: { FieldValue: D } };
                window.db = { collection: () => ({ doc: id => id }), batch: () => { const ups = []; return { update: (id, f) => ups.push([id, f]), commit: async () => { window.__batches.push(ups); ups.forEach(([id, f]) => { const c = casesData.find(x => x.id === id); Object.entries(f).forEach(([k, v]) => { if (v === '__del') delete c[k]; else c[k] = v; }); }); } }; } };
                window.stageSubmissionMirror = async () => 1; window.renderAlabastaInbox = () => {};
            });
            await page.addScriptTag({ content: js });
            const [a, b, c, d, e] = [0, 1, 2, 3, 4];
            assert.equal(await page.evaluate(() => !!caseDup.joinPlan(casesData[0], casesData[2])), false, 'another intern');
            assert.equal(await page.evaluate(() => !!caseDup.joinPlan(casesData[3], casesData[4])), false, 'a reviewed case');
            assert.ok((await page.evaluate(() => caseDup.html(casesData[4]))).startsWith('<span'), 'a reviewed older case keeps the quiet chip');
            const chip = await page.evaluate(() => caseDup.html(casesData[1]));
            assert.ok(chip.startsWith('<button') && chip.includes('follow-up?'), 'pending pair: the chip opens the sheet');
            await page.evaluate(h => { document.getElementById('chip').innerHTML = h; }, chip);
            await page.click('#chip button');
            const sheet = page.locator('#cdup-back .cdup-win');
            const text = await sheet.innerText();
            assert.ok(text.includes('After merge') && text.includes('💧 renal + 📋 other'), text);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no side scroll');
            assert.equal(await page.evaluate(() => __batches.length), 0, 'nothing is written before the press');
            await page.click('.cdup-keep.rec');
            await page.waitForFunction(() => __batches.length === 1);
            let s = await page.evaluate(() => ({ a: casesData[0], b: casesData[1], n: __batches[0].length }));
            assert.equal(s.n, 2, 'one batch, two cases');
            assert.ok(s.b.note.includes('ปัสสาวะ') && s.b.note.includes('ตาแดง') && s.b.note.startsWith('ปัสสาวะ'), 'both notes, the base first');
            assert.deepEqual(s.b.diseaseSystemKeys, ['renal', 'other']);
            assert.deepEqual(s.b.symptomTags, ['Eye Redness']);
            assert.deepEqual(s.b.medications, ['norfloxacin']);
            assert.equal(s.b.disease, 'Cough note', 'a real title stays');
            assert.deepEqual([s.a.status, s.a.adminBonus, s.a.isArchived, s.a.mergedInto], ['reviewed', 0, true, 'b']);
            await page.evaluate(() => caseDup.undoMerge('a', 'b'));
            await page.waitForFunction(() => __batches.length === 2);
            s = await page.evaluate(() => ({ a: casesData[0], b: casesData[1] }));
            assert.equal(s.b.note, 'ปัสสาวะแสบขัด กินน้ำน้อย จ่ายยา 5 วัน', 'Undo puts the note back');
            assert.equal(s.b.diseaseSystemKeys, undefined);
            assert.equal(s.b.symptomTags, undefined);
            assert.deepEqual([s.a.status, s.a.isArchived, s.a.mergedInto], ['pending', false, undefined]);

            // ticked on the bulk bar, the older one first, and Not the same case hides the chip
            await page.evaluate(() => { window.alabastaSelectedIds = new Set(['b', 'a']); caseDup.openPicked(); });
            assert.ok((await page.locator('.cmg-side').first().innerText()).includes('ตาแดง'), 'the older case is case 1');
            await page.click('.cdup-no');
            assert.equal(await page.evaluate(() => caseDup.html(casesData[1])), '', 'dismissed');
            await page.evaluate(() => { window.alabastaSelectedIds = new Set(['a']); });
            assert.equal(await page.evaluate(() => caseDup.picked()), null, 'exactly two');
            await page.evaluate(() => { localStorage.clear(); casesData[1].caseId = '2'; casesData[1].customer = 'z'; window.alabastaSelectedIds = new Set(['a', 'b']); caseDup.openPicked(); });
            assert.ok((await page.locator('.cmg-warn').innerText()).includes('Different HN') && (await page.locator('.cmg-warn').innerText()).includes('Different patient name'));
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('case-merge-qa OK');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
