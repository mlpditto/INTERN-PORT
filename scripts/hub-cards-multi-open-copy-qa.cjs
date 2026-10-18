// V102.296: User Hub profile cards — any number of cards open at once (the V102.280 accordion is gone) and ⧉ Copy all beside the
// EN / TH switch copies the whole profile in one click. The REAL cards markup + header + CSS + gs* functions of public/admin.html.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const adm = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adm));
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
// static pins
const copyBtn = adm.match(/<button type="button" class="gs-copy-all"[^>]*>⧉<\/button>/);
assert.ok(copyBtn, '⧉ Copy all button in the hub header');
assert.ok(/คัดลอก/.test(copyBtn[0]) && /복사/.test(copyBtn[0]), 'tooltip EN · TH · KO');
const switchAt = adm.indexOf('class="gs-lang-switch" onclick=');
assert.ok(adm.indexOf(copyBtn[0]) < switchAt && switchAt - adm.indexOf(copyBtn[0]) < 400, '⧉ sits right before the EN / TH switch');
assert.ok(!adm.includes("c.classList.toggle('gs-folded', c !== openCard)"), 'the accordion fold is gone');

const bodyStart = adm.indexOf('<div id="gs-profile-body"');
const healthStart = adm.indexOf('<section class="gs-profile-card gs-card-health">');
const profileHtml = adm.slice(bodyStart, adm.indexOf('</section>', healthStart) + 10) + '</div>';
const admCss = adm.split('\n').filter(l => /^\s*#groupSelectModal /.test(l)).join('\n');
const fns = ['function gsFoldCards(', 'function gsBodyClick(', 'function gsEditProfileCard(', 'function gsAgeText(', 'function gsRefreshProfileCards(', 'async function gsCopyAll(', 'async function gsCopyProfile('].map(m => grab(adm, m)).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--text-sub:#64748b;--border-color:#dfe5ef;--primary:#4361ee}</style><style>' + admCss + '</style><div id="groupSelectModal"><div class="gs-head">' + copyBtn[0] + '<button type="button" class="gs-lang-switch"><span data-gs-lang="en" aria-pressed="true">EN</span><span data-gs-lang="th">TH</span></button></div><input type="hidden" id="gs-input" value="A">' + profileHtml + '</div>');
        await page.addScriptTag({ content: [
            'var gsLanguage = "en"; function gsText(en, th) { return gsLanguage === "th" ? th : en; } function gsSetLanguage() {} function gsDirtyPaint() {}',
            'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
            'var gsSnap = { fields: {} }, activeUserGroup = "All", activeUserGroupDiv; function userInScope(u, g) { return g === "All" || u.group === g; }',
            'var TOASTS = []; function showToast(t) { TOASTS.push(t); }',
            'window.__clip = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });',
            'var usersData = [];',
            fns
        ].join('\n') });
        const folded = () => page.$$eval('#gs-profile-body .gs-profile-card', els => els.map(e => e.classList.contains('gs-folded')));
        await page.evaluate(() => {
            document.querySelectorAll('.gs-profile-card input').forEach(i => { i.hidden = true; });
            document.getElementById('gs-fullname-th').value = 'สมชาย ใจดี'; document.getElementById('gs-cert-nickname').value = 'ชัย';
            document.getElementById('gs-tel').value = '081-234-5678'; document.getElementById('gs-email').value = 's@x.com';
            document.getElementById('gs-institute').value = 'KKU';
            document.querySelectorAll('.gs-profile-card').forEach(c => c.classList.add('gs-folded'));
            gsRefreshProfileCards();
        });
        assert.deepEqual(await folded(), [true, true, true, true, true], 'all folded at first');
        // several cards open at once
        await page.click('.gs-card-contact > header h3');
        await page.click('.gs-card-basic > header h3');
        await page.click('.gs-card-work > header h3');
        assert.deepEqual(await folded(), [false, false, false, true, true], 'three cards open together');
        await page.click('.gs-card-basic > header h3');
        assert.deepEqual(await folded(), [true, false, false, true, true], 'folding one leaves the others open');
        await page.click('.gs-card-contact .gs-copy-card');
        assert.deepEqual(await folded(), [true, false, false, true, true], 'a header button does not toggle');
        await page.click('.gs-card-health .gs-edit-card');
        assert.deepEqual(await folded(), [true, false, false, true, false], '✏️ unfolds its own card only');
        await page.click('.gs-card-health .gs-edit-card');
        // ⧉ Copy all — every filled field under its card title, empties skipped, current-language labels
        await page.evaluate(() => { window.__clip = []; });   // the 📋 card copy above already wrote once
        await page.click('.gs-copy-all');
        await page.waitForFunction(() => window.__clip.length === 1);
        const text = await page.evaluate(() => window.__clip[0]);
        const lines = text.split('\n');
        assert.equal(lines[0], '== Personal details ==');
        assert.ok(lines.includes('Full name (Thai): สมชาย ใจดี') && lines.includes('Nickname: ชัย'), 'personal fields');
        assert.ok(text.includes('== Contact ==\nPhone: 081-234-5678\nEmail: s@x.com'), 'contact block');
        assert.ok(text.includes('== Education & certificates ==\nInstitute / Workplace: KKU'), 'education block');
        assert.ok(!/== Social ==/.test(text) && !/Health/.test(text), 'cards with nothing filled are skipped');
        assert.ok(!/Born at:|Birthday:/.test(text), 'empty fields skipped');
        assert.equal(await page.evaluate(() => TOASTS.at(-1)), 'Copied the whole profile ✓');
        assert.deepEqual(await folded(), [true, false, false, true, false], 'copying does not change the folds (Health stayed open after its edit toggle)');
        if (process.env.HUB_SHOT) await page.locator('#groupSelectModal').screenshot({ path: process.env.HUB_SHOT });
        // Thai labels follow the switch
        await page.evaluate(() => { gsLanguage = 'th'; document.querySelectorAll('[data-gs-en]').forEach(el => { el.textContent = el.dataset.gsTh; }); });
        await page.click('.gs-copy-all');
        await page.waitForFunction(() => window.__clip.length === 2);
        const th = await page.evaluate(() => window.__clip[1]);
        assert.ok(th.startsWith('== ข้อมูลส่วนตัว ==') && th.includes('ชื่อเล่น: ชัย'), 'Thai titles + labels: ' + th.slice(0, 60));
        assert.equal(await page.evaluate(() => TOASTS.at(-1)), 'คัดลอกข้อมูลทั้งหมดแล้ว ✓');
        // nothing filled → toast, no clipboard write
        await page.evaluate(() => { document.querySelectorAll('.gs-profile-card input').forEach(i => { i.value = ''; }); });
        await page.click('.gs-copy-all');
        await page.waitForFunction(() => /ไม่มีข้อมูล/.test(TOASTS.at(-1)));
        assert.equal(await page.evaluate(() => window.__clip.length), 2, 'no write when empty');
        // the button is a 30px pill beside the switch, not the 44px card button
        const h = await page.$eval('.gs-copy-all', e => e.getBoundingClientRect().height);
        assert.ok(h >= 26 && h <= 34, 'pill height ' + h);
        assert.deepEqual(errs, []);
        console.log('hub-cards-multi-open-copy-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
