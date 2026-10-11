// V102.166: Groups & Divisions (opened from the User Hub's "Groups & Divisions" link) must paint ABOVE the User Hub, and the
// Visibility modal (opened from it) above Divisions. `.modal[style*="flex"]` pins every modal at z-index 9999 !important, so the
// old inline 4050 was ignored and the DOM order put Divisions underneath. Real stylesheet + real markup, scripts stripped.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!/m\.style\.zIndex = '4050'/.test(html), 'the ignored inline z-index is gone');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
        await page.route(/^(?!data:|about:).*/, r => r.abort());
        await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g, ''), { waitUntil: 'domcontentloaded' });
        const top = await page.evaluate(() => {
            document.getElementById('dashboard-container').style.display = 'block';
            const show = (id, d) => { const m = document.getElementById(id); m.style.display = d; return m; };
            const hit = id => { const r = document.getElementById(id).querySelector('.modal-content').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + 20); return !!(e && document.getElementById(id).contains(e)); };
            show('groupSelectModal', 'flex'); show('divisionsModal', 'flex');
            const divOverHub = hit('divisionsModal');
            show('groupSettingsModal', 'block');
            const visOverDiv = hit('groupSettingsModal');
            return { divOverHub, visOverDiv };
        });
        assert.equal(top.divOverHub, true, 'Divisions paints above the User Hub');
        assert.equal(top.visOverDiv, true, 'Visibility paints above Divisions');
        console.log('PASS: Groups & Divisions opens above the User Hub, Visibility above Divisions');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
