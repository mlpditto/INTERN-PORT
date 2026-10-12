// V102.202 — the 🌊 flood filter is a per-user control on the Users column header, not a chip in the Division rail.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const m = html.match(/function renderUserGroupTabs\(\) \{[\s\S]*?\n        \}\n/);
assert.ok(m, 'renderUserGroupTabs found');
assert.ok(!/toggleUserFloodView/.test(m[0]), 'no 🌊 chip in the Division rail any more');
assert.ok(/paintUserFloodBtn\(floodCount\)/.test(m[0]), 'the rail render updates the header button');
assert.ok(/<th>User [\s\S]*?id="user-flood-only" onclick="toggleUserFloodView\(\)"[^>]*hidden/.test(html), 'a hidden-by-default 🌊 toggle on the User column header');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        const r = await page.evaluate(() => {
            const b = document.getElementById('user-flood-only'), out = [];
            window._userFloodOnly = false; paintUserFloodBtn(0); out.push(b.hidden);
            paintUserFloodBtn(2); out.push(b.hidden, b.title, b.textContent, b.getAttribute('aria-pressed'));
            window._userFloodOnly = true; paintUserFloodBtn(0); out.push(b.hidden, b.textContent, b.getAttribute('aria-pressed'));
            return out;
        });
        assert.deepEqual(r, [true, false, 'Flood alerts on · 2 — tap to show only them', '🌊', 'false', false, '🌊▾', 'true'], 'hidden with nobody opted in; shown with a count tooltip; stays while the filter is on');
        assert.deepEqual(errs.filter(e => /Flood|flood/.test(e)), [], 'no page errors from this feature');
        console.log('PASS: flood filter = a 🌊 toggle on the User column header (shown only while someone is opted in, count in the tooltip), not a chip in the Division rail');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
