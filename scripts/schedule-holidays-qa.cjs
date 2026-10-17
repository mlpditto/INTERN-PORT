// V101.162: Schedule (intern) shows the holidays an admin saved for the intern's nationality ("—" = Thailand) and the health / cat days an admin approved.
// Personal Info: Nationality dropdown sits on the Nickname row, default "—". The REAL public/index.html on a phone (file://, network blocked, Firebase stubbed;
// the holidays documents are placed straight into SCH_HOL.docs, so no Firestore is needed).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8');
const src = fs.readFileSync('scripts/schedule-ui-qa.cjs', 'utf8');
const m = src.match(/async function open\(browser\) \{[\s\S]*?\r?\n\}\r?\n/);
assert.ok(m, 'open() found in schedule-ui-qa.cjs');
const INDEX = require('node:url').pathToFileURL(path.resolve('public/index.html')).href;
const open = new Function('INDEX', 'return ' + m[0])(INDEX);

assert.ok(/id="pi-nationality"/.test(idx) && /<option value="">—<\/option>/.test(idx), 'nationality dropdown, default "—"');
const row = idx.slice(idx.indexOf('id="pi-nickname"') - 400, idx.indexOf('<option value="SG">'));
assert.ok(row.includes('id="pi-nationality"'), 'nationality shares the Nickname row');
assert.ok(/nationality: document\.getElementById\('pi-nationality'\)\.value/.test(idx), 'saved with Personal Info');
assert.ok(/getElementById\('pi-nationality'\)\.value = d\.nationality/.test(idx), 'loaded with Personal Info');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const { page, errors } = await open(browser);
    await page.evaluate(() => {
        const t = schDateKey(new Date()), y = t.slice(0, 4);
        window.__t = t;
        SCH_HOL.docs['TH_' + y] = [{ d: t, en: 'Sample TH day', local: 'วันทดสอบ' }];
        SCH_HOL.docs['JP_' + y] = [{ d: t, en: 'Sample JP day', local: '' }];
        SCH_HOL.docs['KR_' + y] = []; SCH_HOL.docs['SG_' + y] = [];
        SCH_HOL.docs['OBS_' + y] = [{ d: t, k: 'm' }, { d: t, k: 'c' }];
        SCH_HOL.obs = { [t.slice(5) + 'm']: 'Sample health day' };
        openScheduleModal();
    });
    await page.waitForTimeout(300);
    const read = () => page.evaluate(() => ({ lines: [...document.querySelectorAll('#sch-week .sch-hol')].map(x => x.textContent), cls: document.querySelector('#sch-week [data-schday="' + __t + '"]').className }));
    let r = await read();
    assert.ok(r.lines.some(l => l.includes('🇹🇭') && l.includes('Sample TH day') && l.includes('วันทดสอบ')), 'no nationality = Thai list: ' + r.lines);
    assert.ok(r.lines.some(l => l.includes('🩺') && l.includes('Sample health day')), 'approved health day shows: ' + r.lines);
    assert.ok(!r.lines.some(l => l.includes('🐱')), 'an approved cat day with no name loaded draws nothing');
    assert.ok(!r.lines.some(l => l.includes('JP')), 'other countries do not show');
    assert.ok(/\bhol\b/.test(r.cls), 'the day circle carries .hol');
    await page.evaluate(() => { myUserDoc.nationality = 'JP'; schRenderAgenda(); });
    r = await read();
    assert.ok(r.lines.some(l => l.includes('🇯🇵') && l.includes('Sample JP day')) && !r.lines.some(l => l.includes('Sample TH day')), 'JP intern sees the JP list only: ' + r.lines);
    assert.ok(r.lines.some(l => l.includes('🩺')), 'health day shows for every nationality');
    await page.evaluate(() => { myUserDoc.nationality = 'SG'; schRenderAgenda(); });
    r = await read();
    assert.ok(!r.lines.some(l => l.includes('🇸🇬')) && r.lines.some(l => l.includes('🩺')), 'SG with nothing saved: only the health day');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    await browser.close();
    console.log('schedule-holidays-qa: PASS');
})().catch(e => { console.error(e); process.exit(1); });
