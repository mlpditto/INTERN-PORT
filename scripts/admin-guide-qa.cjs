// V102.133: the admin guide — the REAL public/admin-guide.js + admin-guide.md behind the ❓ header button.
// Opens on its own once after the first login (dashboard-container turning visible), never again; a chip rail shows one
// section at a time; Esc / × / backdrop close; the guide names every main tab and header button that admin.html really has.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const md = fs.readFileSync('public/admin-guide.md', 'utf8');
const js = fs.readFileSync('public/admin-guide.js', 'utf8');

// Static: wiring in admin.html, and the guide only names tabs that exist.
assert.ok(/<button id="btn-admin-guide"[^>]*onclick="openAdminGuide\(\)"/.test(admin), '❓ button in the header');
assert.ok(/<script src="admin-guide\.js\?v=V\d+\.\d+" defer><\/script>/.test(admin), 'admin-guide.js is loaded');
const tabs = [...admin.matchAll(/class="tab-btn[^"]*" onclick="switchTab\('tab-[a-z-]+'\)"[^>]*>([^<]+)</g)].map(m => m[1].trim());
assert.equal(tabs.length, 7, 'seven main tabs in admin.html: ' + tabs);
const plain = md.split('**').join('');
for (const t of tabs) assert.ok(plain.includes(t), 'guide names the tab "' + t + '"');
for (const label of ['Send Login Link', 'Create', 'Archive', 'Logout', 'Sync intern view', 'Bulk Review']) assert.ok(admin.includes(label), 'admin.html has "' + label + '" the guide mentions');
const sections = md.split(/\r?\n/).filter(l => /^## /.test(l));
assert.ok(sections.length >= 5, 'guide has sections: ' + sections.length);

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>:root{--bg-card:#fff;--text-main:#1e293b;--text-sub:#64748b;--border-color:#e2e8f0;--col-bg:#f1f5f9;--primary:#4361ee}body{margin:0;font-family:sans-serif}</style>
<div id="dashboard-container" style="display:none"><button id="btn-admin-guide" onclick="openAdminGuide()">❓</button></div>
<script>window.marked={parse:function(t){return t.split('\\n').map(function(l){var m=/^### (.+)/.exec(l);return m?'<h3>'+m[1]+'</h3>':'<p>'+l+'</p>';}).join('')}};window.DOMPurify={sanitize:function(h){return h}};</script>
<script src="/admin-guide.js" defer></script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [412, 1100]) {
            const ctx = await browser.newContext({ viewport: { width: vw, height: 700 } });
            const page = await ctx.newPage();
            await page.route('https://qa.test/**', r => {
                const p = new URL(r.request().url()).pathname;
                if (p === '/h.html') return r.fulfill({ contentType: 'text/html', body: harness });
                if (p === '/admin-guide.js') return r.fulfill({ contentType: 'text/javascript', body: js });
                if (p === '/admin-guide.md') return r.fulfill({ contentType: 'text/markdown', body: md });
                return r.fulfill({ status: 404, body: '' });
            });
            await page.goto('https://qa.test/h.html');
            await page.waitForTimeout(300);
            assert.equal(await page.locator('#adminGuideOverlay.open').count(), 0, 'not open before login @' + vw);

            // First login → opens by itself, on the tab map.
            await page.evaluate(() => { document.getElementById('dashboard-container').style.display = 'block'; });
            await page.waitForSelector('#adminGuideOverlay.open', { timeout: 3000 });
            await page.waitForFunction(() => document.querySelectorAll('#adminGuideOverlay .ag-chip').length >= 5);
            const chips = await page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => ({ t: e.textContent, on: e.getAttribute('aria-pressed') })));
            assert.ok(chips.find(c => c.on === 'true' && /แผนที่แท็บ/.test(c.t)), 'opens on the tab map: ' + JSON.stringify(chips));
            const body = () => page.$eval('#adminGuideOverlay .ag-body', e => e.innerText);
            assert.ok((await body()).includes('Alabasta'), 'tab map names Alabasta');

            // Chip rail switches section; only that section shows.
            await page.click('#adminGuideOverlay .ag-chip[data-i="0"]');
            const first = await body();
            assert.ok(/Send Login Link/.test(first) && !/Alabasta/.test(first), 'section 0 is login only');

            // Chips are short, icon-led and never empty; the whole box shields the Thai from lang-toggle; prev/next walk the sections.
            assert.ok(chips.every(c => /^\p{Extended_Pictographic}\S*\s\S+/u.test(c.t) && c.t.length <= 16), 'every chip is icon + short name: ' + JSON.stringify(chips.map(c => c.t)));
            assert.ok(/class="ag-box lang-no-toggle"/.test(js), 'the whole box carries lang-no-toggle (title + chips are Thai)');
            assert.equal(await page.locator('#adminGuideOverlay .ag-go:not(.next)').count(), 0, 'no prev button on the first section');
            await page.click('#adminGuideOverlay .ag-go.next');
            assert.equal(await page.$eval('#adminGuideOverlay .ag-chip[aria-pressed="true"]', e => e.dataset.i), '1', 'next › moves to section 1 @' + vw);
            assert.equal(await page.locator('#adminGuideOverlay .ag-go:not(.next)').count(), 1, 'prev ‹ shows from section 1');
            await page.click('#adminGuideOverlay .ag-chip[data-i="' + (chips.length - 1) + '"]');
            assert.equal(await page.locator('#adminGuideOverlay .ag-go.next').count(), 0, 'no next › on the last section');
            await page.click('#adminGuideOverlay .ag-go');
            assert.equal(await page.$eval('#adminGuideOverlay .ag-chip[aria-pressed="true"]', e => e.dataset.i), String(chips.length - 2), '‹ goes back one @' + vw);
            await page.click('#adminGuideOverlay .ag-chip[data-i="0"]');

            // Box fits the viewport and sits above a 100000-level editor overlay.
            const box = await page.$eval('#adminGuideOverlay .ag-box', e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom }; });
            assert.ok(box.l >= 0 && box.r <= vw && box.b <= 700, 'dialog inside the viewport @' + vw + ' ' + JSON.stringify(box));
            assert.ok(+await page.$eval('#adminGuideOverlay', e => getComputedStyle(e).zIndex) >= 150000, 'overlay ≥ 150000');

            // Esc closes; the reload never auto-opens again; ❓ reopens on the section last viewed.
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#adminGuideOverlay.open').count(), 0, 'Esc closes @' + vw);
            await page.reload();
            await page.evaluate(() => { document.getElementById('dashboard-container').style.display = 'block'; });
            await page.waitForTimeout(1200);
            assert.equal(await page.locator('#adminGuideOverlay.open').count(), 0, 'no auto-open the second time @' + vw);
            await page.click('#btn-admin-guide');
            await page.waitForSelector('#adminGuideOverlay.open');
            await page.waitForFunction(() => document.querySelectorAll('#adminGuideOverlay .ag-chip').length >= 5);
            await page.click('#adminGuideOverlay .ag-close');
            assert.equal(await page.locator('#adminGuideOverlay.open').count(), 0, '× closes @' + vw);
            await ctx.close();
        }
        // localStorage blocked → still opens from ❓, never throws.
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
        await page.route('https://qa.test/**', r => {
            const p = new URL(r.request().url()).pathname;
            return p === '/h.html' ? r.fulfill({ contentType: 'text/html', body: harness }) : p === '/admin-guide.js' ? r.fulfill({ contentType: 'text/javascript', body: js }) : r.fulfill({ contentType: 'text/markdown', body: md });
        });
        await page.goto('https://qa.test/h.html');
        await page.evaluate(() => openAdminGuide());
        await page.waitForSelector('#adminGuideOverlay.open');
        assert.deepEqual(errs, [], 'no page errors with storage blocked');
        console.log('PASS: admin guide — ❓ opens it, it opens once by itself after first login, chip rail shows one section, Esc/× close, fits 412/1100 px, works with storage blocked; guide names all ' + tabs.length + ' real tabs');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
