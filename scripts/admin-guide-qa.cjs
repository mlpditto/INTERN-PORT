// V102.133: the admin guide — the REAL public/admin-guide.js + admin-guide.md behind the 📖 header button.
// Opens on its own once after the first login (dashboard-container turning visible), never again; a chip rail shows one
// section at a time; Esc / × / backdrop close; the guide names every main tab and header button that admin.html really has.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const md = fs.readFileSync('public/admin-guide.md', 'utf8');
const mdEn = fs.readFileSync('public/admin-guide.en.md', 'utf8');
const mdKo = fs.readFileSync('public/admin-guide.ko.md', 'utf8');
const js = fs.readFileSync('public/admin-guide.js', 'utf8');

// Static: wiring in admin.html, and the guide only names tabs that exist.
assert.ok(/<button id="btn-admin-guide"[^>]*onclick="openAdminGuide\(\)"/.test(admin), '📖 button in the header');
assert.ok(/<script src="admin-guide\.js\?v=V\d+\.\d+" defer><\/script>/.test(admin), 'admin-guide.js is loaded');
const tabs = [...admin.matchAll(/class="tab-btn[^"]*" onclick="switchTab\('tab-[a-z-]+'\)"[^>]*>([^<]+)</g)].map(m => m[1].trim());
assert.equal(tabs.length, 7, 'seven main tabs in admin.html: ' + tabs);
const plain = md.split('**').join('');
const plainEn = mdEn.split('**').join('');
for (const t of tabs) { assert.ok(plain.includes(t), 'TH guide names the tab "' + t + '"'); assert.ok(plainEn.includes(t), 'EN guide names the tab "' + t + '"'); assert.ok(mdKo.split('**').join('').includes(t), 'KO guide names the tab "' + t + '"'); }
for (const label of ['Send Login Link', 'Create', 'Archive', 'Logout', 'Sync intern view', 'Bulk Review']) assert.ok(admin.includes(label), 'admin.html has "' + label + '" the guide mentions');
const sections = md.split(/\r?\n/).filter(l => /^## /.test(l));
assert.ok(sections.length >= 5, 'guide has sections: ' + sections.length);
const sectionsEn = mdEn.split(/\r?\n/).filter(l => /^## /.test(l));
assert.equal(sectionsEn.length, sections.length, 'EN and TH guides have the same number of sections');
assert.equal(mdKo.split(/\r?\n/).filter(l => /^## /.test(l)).length, sections.length, 'KO guide has the same number of sections');
for (const label of ['Send Login Link', 'Create', 'Archive', 'Logout']) assert.ok(mdKo.includes(label), 'KO guide names "' + label + '"');
assert.ok(/<button id="btn-admin-guide"[^>]*>📖<\/button>/.test(admin), 'the header button is 📖');
// V102.449: section 6 = Jev (where it is in the app, how to use it, the guardrail) in all three languages, with its three pictures.
{
    const IMGS = ['jev-compare.png', 'jev-categories.png', 'jev-guardrail.png'];
    for (const [name, doc] of [['TH', md], ['EN', mdEn], ['KO', mdKo]]) {
        const s6 = doc.split(/\r?\n## 6\. /)[1];
        assert.ok(s6 && /Jev/.test(s6.split(/\r?\n## /)[0]), name + ' guide has section 6 about Jev');
        for (const f of IMGS) assert.ok(s6.includes('](assets/guide/' + f + ')'), name + ' guide shows ' + f);
        for (const label of ['Compare', 'Categories', 'Gourmet World', 'PDF', 'Reflective Review', 'Assignments']) assert.ok(s6.includes(label), name + ' Jev section names "' + label + '"');
        assert.ok(/60/.test(s6) && /70%/.test(s6) && /80%/.test(s6), name + ' Jev section states the real thresholds (60 pairs · 70% guardrail · 80% pre-ticked)');
    }
    for (const f of IMGS) { const st = fs.statSync('public/assets/guide/' + f); assert.ok(st.size > 20000 && st.size < 400000, f + ' exists and is a sensible size: ' + st.size); }
    // the guide only names Jev places that exist in admin.html
    for (const needle of ['id="rl-cat-btn"', 'openQuizCompareModal()', 'Gourmet World', 'openPdfToQuizModal()', 'quizCompareJevPaint', 'jev-chip']) assert.ok(admin.includes(needle), 'admin.html has ' + needle);
    assert.ok(/ag-body img\{[^}]*max-width:100%/.test(js), 'guide pictures never overflow the modal');
}
for (const label of ['Send Login Link', 'Create', 'Archive', 'Logout']) assert.ok(mdEn.includes(label), 'EN guide names "' + label + '"');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>:root{--bg-card:#fff;--text-main:#1e293b;--text-sub:#64748b;--border-color:#e2e8f0;--col-bg:#f1f5f9;--primary:#4361ee}body{margin:0;font-family:sans-serif}</style>
<div id="dashboard-container" style="display:none"><button id="btn-admin-guide" onclick="openAdminGuide()">📖</button></div>
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
                if (p === '/admin-guide.en.md') return r.fulfill({ contentType: 'text/markdown', body: mdEn });
                if (p === '/admin-guide.ko.md') return r.fulfill({ contentType: 'text/markdown', body: mdKo });
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
            assert.ok(chips.find(c => c.on === 'true' && /Tab map/.test(c.t)), 'opens in English on the tab map: ' + JSON.stringify(chips));
            const body = () => page.$eval('#adminGuideOverlay .ag-body', e => e.innerText);
            assert.ok((await body()).includes('Alabasta'), 'tab map names Alabasta');
            // V102.529: the tab map's ### blocks fold (closed) so the section needs no scrolling on a laptop; one open at a time; the table stays above the folds
            { const f = await page.$$eval('#adminGuideOverlay .ag-fold', ds => ds.map(d => ({ open: d.open, t: d.querySelector('summary').textContent.trim(), kids: d.children.length })));
              assert.ok(f.length >= 5 && f.every(x => !x.open && x.t && x.kids > 1), 'every ### block is a closed fold with its heading and body: ' + JSON.stringify(f));
              assert.equal(await page.locator('#adminGuideOverlay .ag-body > h3').count(), 0, 'no bare h3 left');
              const geo = await page.$eval('#adminGuideOverlay .ag-body', b => ({ sh: b.scrollHeight, ch: b.clientHeight, tableAbove: b.querySelector('.ag-fold').compareDocumentPosition(b.querySelector('p, table')) & Node.DOCUMENT_POSITION_PRECEDING ? true : false }));
              { const closed = geo.sh; await page.$$eval('#adminGuideOverlay .ag-fold', ds => ds.forEach(d => { d.open = true; })); const open = await page.$eval('#adminGuideOverlay .ag-body', b => b.scrollHeight); await page.$$eval('#adminGuideOverlay .ag-fold', ds => ds.forEach(d => { d.open = false; }));
                assert.ok(open > closed + 200, 'closed folds hide their body (open ' + open + ' vs closed ' + closed + ')'); }   // the real fit (1366×768 / 1100×700) was measured with real marked in the render check; the fake marked here makes every line a <p>
              assert.equal(await page.locator('#adminGuideOverlay .ag-folds').count(), 1, 'the folds sit in one grid'); assert.ok(await page.$eval('#adminGuideOverlay .ag-folds', g => getComputedStyle(g).gridTemplateColumns.split(' ').length === (innerWidth > 600 ? 2 : 1)), 'two columns wide, one on a phone');
              assert.ok(geo.tableAbove, 'the table / intro stays above the first fold');
              await page.click('#adminGuideOverlay .ag-fold:nth-of-type(1) > summary'); await page.click('#adminGuideOverlay .ag-fold:nth-of-type(2) > summary');
              assert.deepEqual(await page.$$eval('#adminGuideOverlay .ag-fold', ds => ds.map(d => d.open)), f.map((_, i) => i === 1), 'opening the second fold closes the first (accordion)');
              await page.click('#adminGuideOverlay .ag-fold:nth-of-type(2) > summary');
              assert.equal(await page.locator('#adminGuideOverlay .ag-fold[open]').count(), 0, 'tapping the open one closes it'); }

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

            // Language: EN is the default; EN | TH switches (same section stays), is remembered, and the Thai side still reads.
            const title = () => page.$eval('#adminGuideOverlay .ag-title', e => e.textContent);
            assert.equal(await title(), '📖 Admin guide', 'EN title by default @' + vw);
            assert.equal(await page.$eval('#adminGuideOverlay .ag-l[data-l="en"]', e => e.getAttribute('aria-pressed')), 'true', 'EN chip is pressed');
            await page.click('#adminGuideOverlay .ag-chip[data-i="2"]');
            await page.click('#adminGuideOverlay .ag-l[data-l="th"]');
            await page.waitForFunction(() => /[ก-๙]/.test(document.querySelector('#adminGuideOverlay .ag-title').textContent));
            await page.waitForFunction(() => /[ก-๙]/.test(document.querySelector('#adminGuideOverlay .ag-chip').textContent));   // the TH guide is fetched, then drawn
            const thChips = await page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => ({ t: e.textContent, on: e.getAttribute('aria-pressed') })));
            assert.equal(thChips.length, chips.length, 'TH has the same sections');
            assert.ok(thChips[2].on === 'true' && /แผนที่แท็บ/.test(thChips[2].t), 'switching language keeps the section (tab map): ' + JSON.stringify(thChips));
            assert.equal(await page.evaluate(() => localStorage.getItem('adminGuideLang')), 'th', 'language is remembered');
            // KO: same section stays, Hangul title + chips, remembered.
            await page.click('#adminGuideOverlay .ag-l[data-l="ko"]');
            await page.waitForFunction(() => /[가-힣]/.test(document.querySelector('#adminGuideOverlay .ag-title').textContent));
            await page.waitForFunction(() => /[가-힣]/.test(document.querySelector('#adminGuideOverlay .ag-chip').textContent));
            const koChips = await page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => ({ t: e.textContent, on: e.getAttribute('aria-pressed') })));
            assert.equal(koChips.length, chips.length, 'KO has the same sections');
            assert.ok(koChips[2].on === 'true' && /탭 지도/.test(koChips[2].t), 'switching to KO keeps the section (tab map): ' + JSON.stringify(koChips));
            assert.ok(koChips.every(c => c.t.length <= 16), 'KO chips are short: ' + JSON.stringify(koChips.map(c => c.t)));
            assert.equal(await page.evaluate(() => localStorage.getItem('adminGuideLang')), 'ko', 'KO is remembered');
            assert.ok((await body()).includes('Alabasta'), 'KO tab map names Alabasta');
            await page.click('#adminGuideOverlay .ag-l[data-l="en"]');
            await page.waitForFunction(() => document.querySelector('#adminGuideOverlay .ag-title').textContent === '📖 Admin guide');
            await page.waitForFunction(() => /^[^ก-๙]+$/.test(document.querySelector('#adminGuideOverlay .ag-chip').textContent));
            assert.equal(await page.evaluate(() => localStorage.getItem('adminGuideLang')), 'en');
            await page.click('#adminGuideOverlay .ag-chip[data-i="0"]');

            // Box fits the viewport and sits above a 100000-level editor overlay.
            const box = await page.$eval('#adminGuideOverlay .ag-box', e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom }; });
            assert.ok(box.l >= 0 && box.r <= vw && box.b <= 700, 'dialog inside the viewport @' + vw + ' ' + JSON.stringify(box));
            assert.ok(+await page.$eval('#adminGuideOverlay', e => getComputedStyle(e).zIndex) >= 150000, 'overlay ≥ 150000');

            // Esc closes; the reload never auto-opens again; 📖 reopens on the section last viewed.
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
        // localStorage blocked → still opens from 📖, never throws.
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
        await page.route('https://qa.test/**', r => {
            const p = new URL(r.request().url()).pathname;
            return p === '/h.html' ? r.fulfill({ contentType: 'text/html', body: harness }) : p === '/admin-guide.js' ? r.fulfill({ contentType: 'text/javascript', body: js }) : r.fulfill({ contentType: 'text/markdown', body: p.endsWith('.en.md') ? mdEn : md });
        });
        await page.goto('https://qa.test/h.html');
        await page.evaluate(() => openAdminGuide());
        await page.waitForSelector('#adminGuideOverlay.open');
        assert.deepEqual(errs, [], 'no page errors with storage blocked');
        console.log('PASS: admin guide — V102.529 ### blocks fold (closed, accordion, fits @1100×700); — 📖 opens it (English first, EN | TH switch remembered), it opens once by itself after first login, chip rail shows one section, Esc/× close, fits 412/1100 px, works with storage blocked; guide names all ' + tabs.length + ' real tabs');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
