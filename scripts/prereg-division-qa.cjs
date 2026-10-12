// V102.199 — Pre-register: Division / Group / Also in as chips (no dropdown), not choosing a Division = Only I, the code carries division + memberships,
// a waiting row can be re-assigned, the Period line shows a duration. The real admin.html in Chromium; Firestore stubbed.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8');
assert.ok(!/id="prereg-group"/.test(admin), 'the group dropdown is gone');
assert.ok(/id="prereg-pick"/.test(admin) && /id="prereg-dur"/.test(admin), 'chip host + duration chip');
assert.ok(/\.\.\.\(typeof preData\.division === 'string' \? \{ division: preData\.division \} : \{\}\)/.test(index) && /memberships: preData\.memberships\.filter/.test(index), 'the claim copies division + memberships (only when the code has them)');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.evaluate(() => {
            window.__adds = []; window.__upd = []; window.__cfg = [];
            divisionConfig = { MLP: ['Pharmacists'], CAFE: ['Content Creator'] };
            usersData = []; preRegData = [];
            getGlobalGroups = () => ['Junior', 'INTERN', 'EXTERN', 'Public', 'Pharmacists', 'Content Creator', 'Audit'];
            showToast = () => {};
            db = { collection: n => ({ add: async d => { window.__adds.push([n, d]); }, doc: id => ({ update: async d => { window.__upd.push([n, id, d]); }, set: async (d, o) => { window.__cfg.push([n, id, d, o]); } }) }) };
            const m = document.getElementById('preRegModal'); let e = m; while (e && e !== document.documentElement) { if (getComputedStyle(e).display === 'none') e.style.setProperty('display', 'block', 'important'); e = e.parentElement; }
            openPreRegModal();
        });
        const chips = sel => page.$$eval(sel, els => els.map(e => e.textContent.trim()));
        const on = () => page.$$eval('#prereg-pick .pr-chip.on', els => els.map(e => e.textContent.trim()));
        assert.deepEqual(await chips('#prereg-pick .pr-line:nth-child(1) .pr-chip'), ['Only I', 'MLP', 'CAFE'], 'Division rail: Only I first');
        assert.deepEqual(await on(), ['Only I', 'Junior'], 'default: Only I · Junior');
        assert.deepEqual(await chips('#prereg-pick .pr-line:nth-child(2) .pr-chip'), ['Junior', 'INTERN', 'EXTERN', 'Public', 'Audit', '＋ group'], 'Only I lists the base groups + groups no division lists');
        // pick CAFE → its groups; the group follows
        await page.click('#prereg-pick [data-v="CAFE"]');
        assert.deepEqual(await on(), ['CAFE', 'Content Creator'], 'a division with groups picks its first group');
        assert.deepEqual(await chips('#prereg-pick .pr-line:nth-child(2) .pr-chip'), ['Content Creator', '＋ group']);
        // a new group typed inside CAFE (Audit exists globally, so its spelling is kept)
        await page.click('#prereg-pick .pr-line:nth-child(2) .pr-chip.dash'); await page.fill('#prereg-pick .pr-in', 'audit'); await page.press('#prereg-pick .pr-in', 'Enter');
        assert.deepEqual(await on(), ['CAFE', 'Audit'], 'typed group (a twin of an existing one keeps its spelling)');
        // Also in: add MLP › Pharmacists
        await page.click('#prereg-pick [onclick*="addToggle"]');
        await page.click('#prereg-pick [onclick*="addDiv"][data-v="MLP"]'); await page.click('#prereg-pick [onclick*="addGroup"][data-v="Pharmacists"]');
        assert.deepEqual(await chips('#prereg-pick .pr-line:nth-child(3) .pr-chip'), ['MLP › Pharmacists ×', '＋ Add division / group']);
        // the primary pair never doubles as a membership
        await page.evaluate(() => { preRegForm.addDiv = 'CAFE'; preRegApply('form', 'addGroup', 'Audit'); });
        assert.equal((await chips('#prereg-pick .pr-line:nth-child(3) .pr-chip')).filter(t => /CAFE › Audit/.test(t)).length, 0, 'CAFE › Audit is the primary, not an extra');
        // period → duration
        await page.fill('#prereg-start', '2026-10-05'); await page.fill('#prereg-end', '2026-12-28'); await page.dispatchEvent('#prereg-end', 'input');
        assert.equal(await page.$eval('#prereg-dur', e => e.hidden ? '' : e.textContent), '12 wk', 'duration chip');
        // generate
        await page.fill('#prereg-name-th', 'ธนพล'); await page.fill('#prereg-nick', 'Joey');
        await page.evaluate(() => addPreRegUser());
        const add = await page.evaluate(() => window.__adds[0][1]);
        assert.equal(add.group, 'Audit'); assert.equal(add.division, 'CAFE');
        assert.deepEqual(add.memberships, [{ division: 'MLP', group: 'Pharmacists' }]);
        assert.equal(add.startDate, '2026-10-05');
        assert.deepEqual(await page.evaluate(() => window.__cfg.map(c => c[2])), [{ CAFE: ['Content Creator', 'Audit'] }], 'Audit is listed in CAFE (merge — only the touched division)');
        // next code keeps division/group, drops the extras
        assert.deepEqual(await on(), ['CAFE', 'Audit']); assert.equal((await chips('#prereg-pick .pr-line:nth-child(3) .pr-chip')).length, 1);
        // not choosing a Division → Only I, stored explicitly
        await page.click('#prereg-pick [data-v=""]'); await page.fill('#prereg-name-th', 'Mint'); await page.evaluate(() => addPreRegUser());
        const add2 = await page.evaluate(() => window.__adds[1][1]);
        assert.equal(add2.division, '', 'Only I = empty division, explicit'); assert.equal(add2.group, 'Audit', 'switching division keeps the group when the new list has it');
        // a waiting row: tags + tap → picker → saved at once
        await page.evaluate(() => { preRegData = [{ id: 'p1', fullName: 'Mint', code: 'ABC123', group: 'Junior', division: '', memberships: [{ division: 'CAFE', group: 'Audit' }], claimed: false }]; renderPreRegList(); });
        const tags = await page.$eval('#prereg-list .pr-tags', e => e.textContent.replace(/\s+/g, ' ').trim());
        assert.match(tags, /Junior.*Only I.*\+ CAFE › Audit/, 'row: Group · Division · + pairs');
        await page.click('#prereg-list .pr-tags');
        assert.equal(await page.locator('#prereg-list .pr-rowpick').count(), 1, 'tap opens the picker under the row');
        await page.click('#prereg-list .pr-rowpick [data-v="MLP"]');
        const upd = await page.evaluate(() => window.__upd.pop());
        assert.equal(upd[1], 'p1'); assert.equal(upd[2].division, 'MLP'); assert.equal(upd[2].group, 'Pharmacists', 'division change → the group follows'); assert.deepEqual(upd[2].memberships, [{ division: 'CAFE', group: 'Audit' }]);
        assert.deepEqual(errs.filter(e => /preReg|prereg|pr-/.test(e)), [], 'no page errors from this feature');
        console.log('PASS: Pre-register — Division / Group / Also in chips (default Only I · Junior), division → its groups, typed group, memberships (primary excluded), duration chip, code carries division + memberships, a new group is listed in its division (merge), waiting row re-assign saves at once, claim copies both');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
