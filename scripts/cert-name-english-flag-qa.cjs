// V102.599 (owner): in the admin user popup, a "Certificate name (English)" that is not English is highlighted as waiting for a fix
// (amber row + "⚠️ Not English · waiting for a fix" pill), and the flag goes away once the name is English. Runs the REAL
// gsRefreshProfileCards() from admin.html (brace-matched out of the file) on the card's real field markup + the real CSS lines.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
function grab(src, head) {
    const i = src.indexOf(head); assert.ok(i >= 0, 'missing ' + head);
    let d = 0, j = src.indexOf('{', i);
    for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
    throw new Error('unbalanced ' + head);
}
const fn = grab(html, 'function gsRefreshProfileCards() {');
const field = html.match(/<div class="gs-card-field"><label for="gs-cert-fullname"[\s\S]*?<\/div><\/div>|<div class="gs-card-field"><label for="gs-cert-fullname"[\s\S]*?hidden><\/div>/)[0];
const css = html.split('\n').filter(l => /#groupSelectModal \.(gs-card-field\.gs-needs-en|gs-needs-en-pill)/.test(l)).join('\n');
assert.ok(css.includes('gs-needs-en'), 'the highlight CSS is in admin.html');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="groupSelectModal"><section class="gs-profile-card gs-card-work"><header><h3>Education</h3><button class="gs-copy-card"></button></header>${field}</section></div>`);
        await page.evaluate(src => { window.gsText = (en) => en; window.gsAgeText = () => ''; (0, eval)(src); }, fn);
        const check = v => page.evaluate(v => {
            document.getElementById('gs-cert-fullname').value = v; gsRefreshProfileCards();
            const row = document.getElementById('gs-cert-fullname').closest('.gs-card-field'), pill = row.querySelector('.gs-needs-en-pill');
            return { flagged: row.classList.contains('gs-needs-en'), pill: pill && !pill.hidden ? pill.textContent : '', bg: getComputedStyle(row).backgroundColor };
        }, v);
        let r = await check('นัทธมน ล้อกาญจนรัตน์');
        assert.deepEqual(r, { flagged: true, pill: '⚠️ Not English · waiting for a fix', bg: 'rgb(255, 251, 235)' }, 'Thai → amber row + pill: ' + JSON.stringify(r));
        r = await check('Natthamon Lokanjanarat');
        assert.deepEqual(r, { flagged: false, pill: '', bg: 'rgba(0, 0, 0, 0)' }, 'English → no flag');
        r = await check("Mary-Jane O'Neil Jr.");
        assert.equal(r.flagged, false, 'hyphen, apostrophe and dot are English');
        r = await check('Natthamon 2');
        assert.equal(r.flagged, true, 'digits are not a name');
        r = await check('');
        assert.equal(r.flagged, false, 'empty → no flag (it is in "Not provided")');
        console.log('PASS: certificate name not in English → amber row + "⚠️ Not English · waiting for a fix"; English (incl. - \' .) or empty → no flag');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
