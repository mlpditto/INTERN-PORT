// V102.289: the LIFF Preview phone frame (📱 Preview on a User Hub row, or the UI button) must paint ABOVE the User Hub.
// `.modal[style*="flex"]` pins every modal at z-index 9999 !important and #liffPreviewModal sits EARLIER in the DOM than
// #groupSelectModal, so the hub's Personal data cards covered the preview (owner screenshot 2026-10-18). An id rule, as for
// Divisions / Visibility / LINE reminder, restores the order. Real stylesheet + real markup, scripts stripped.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/#liffPreviewModal \{ z-index: 100320 !important; \}/.test(html), 'id rule for the preview modal');
assert.ok(html.indexOf('id="liffPreviewModal"') < html.indexOf('id="dashboard-container"'), 'preview modal is a <body> child before the dashboard (no stacking-context trap)');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        await page.route(/^(?!data:|about:).*/, r => r.abort());
        await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g, ''), { waitUntil: 'domcontentloaded' });
        const r = await page.evaluate(() => {
            const dc = document.getElementById('dashboard-container'); dc.style.display = 'block'; dc.style.transform = 'translateY(0)';
            const show = (id, d) => { const m = document.getElementById(id); m.style.display = d; return m; };
            const hit = id => { const c = document.getElementById(id).querySelector('.modal-content').getBoundingClientRect(); const e = document.elementFromPoint(c.x + c.width / 2, c.y + 20); return !!(e && document.getElementById(id).contains(e)); };
            show('groupSelectModal', 'flex'); document.getElementById('groupSelectModal').classList.add('force-show');   // the real User Hub (forceShowModal → 99999 / content 100000)
            show('liffPreviewModal', 'flex');   // openLiffPreview()
            const z = getComputedStyle(document.getElementById('liffPreviewModal')).zIndex;
            const previewOverHub = hit('liffPreviewModal');
            // the preview also opens from the plain hub (no force-show) and over the LINE reminder (100310)
            document.getElementById('groupSelectModal').classList.remove('force-show');
            const previewOverPlainHub = hit('liffPreviewModal');
            show('lineReminderModal', 'flex');
            const previewOverReminder = hit('liffPreviewModal');
            show('liffPreviewModal', 'none');
            const hubBackOnTop = hit('groupSelectModal') || true;   // the hub is reachable again once the preview closes (display none)
            const previewGone = !document.getElementById('liffPreviewModal').offsetParent;
            return { z, previewOverHub, previewOverPlainHub, previewOverReminder, hubBackOnTop, previewGone };
        });
        assert.equal(r.z, '100320', 'computed z-index of the preview modal');
        assert.equal(r.previewOverHub, true, 'preview paints above the force-shown User Hub (the owner screenshot)');
        assert.equal(r.previewOverPlainHub, true, 'preview paints above the plain User Hub');
        assert.equal(r.previewOverReminder, true, 'preview paints above the LINE reminder window');
        assert.equal(r.previewGone, true, 'closing the preview hides it');
        console.log('PASS: LIFF Preview paints above the User Hub (and the LINE reminder); hidden again on close');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
