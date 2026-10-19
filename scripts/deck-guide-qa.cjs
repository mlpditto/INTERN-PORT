// V102.301: the 🏴‍☠️ Grand Line Deck badge opens the deck's own guide (images · video · audio · research) in the same overlay as the
// 📖 Admin guide — admin-guide.js now serves two SETS. The REAL admin-guide.js + the three grand-line-guide markdown files + the real
// admin-guide files; the guide only names buttons and chips that admin.html really has.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/admin-guide.js', 'utf8');
const deck = { en: fs.readFileSync('public/grand-line-guide.en.md', 'utf8'), th: fs.readFileSync('public/grand-line-guide.md', 'utf8'), ko: fs.readFileSync('public/grand-line-guide.ko.md', 'utf8') };
const adm = { en: fs.readFileSync('public/admin-guide.en.md', 'utf8'), th: fs.readFileSync('public/admin-guide.md', 'utf8'), ko: fs.readFileSync('public/admin-guide.ko.md', 'utf8') };

// static: wiring + the three deck files agree + every named control exists in admin.html
assert.ok(/<button type="button" class="deck-guide-btn" onclick="openDeckGuide\(\)"[^>]*>/.test(admin), 'the badge is a button that opens the deck guide');
assert.ok(/class="deck-guide-btn"[^>]*title="[^"]*วิธี[^"]*·[^"]*만들기/.test(admin), 'badge tooltip EN · TH · KO');
assert.ok(/<script src="admin-guide\.js\?v=V102\.\d+" defer><\/script>/.test(admin) && !admin.includes('admin-guide.js?v=V102.226'), 'script cache-busted');
const secs = m => m.split(/\r?\n/).filter(l => /^## /.test(l));
assert.equal(secs(deck.en).length, 4, 'four sections: images · video · audio · research');
assert.equal(secs(deck.th).length, 4); assert.equal(secs(deck.ko).length, 4);
for (const label of ['Plan 10 episodes', 'Clip 9:16', 'Nano Banana 2.1', 'Image 2', 'Visual Style Collection', 'Polish', 'Query Brain', 'Suggest Prompts', 'Focus on KB Only', 'Manage Documents', 'Codex Gallery', 'Clear Chat', 'Send to Podcast', 'Target Length', 'Performance Direction']) {
    assert.ok(admin.includes(label), 'admin.html has "' + label + '"');
    for (const l of ['en', 'th', 'ko']) assert.ok(deck[l].split('**').join('').includes(label), l.toUpperCase() + ' deck guide names "' + label + '"');
}
for (const l of ['en', 'th', 'ko']) assert.ok(/\$0\.80/.test(deck[l]) && /teach-clips/.test(deck[l]) && /clip_series/.test(deck[l]), l + ': cost + save targets');
assert.ok(js.includes("window.openDeckGuide = function () { open('deck'); }") && js.includes("window.openAdminGuide = function () { open('admin'); }"), 'two openers');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>:root{--bg-card:#fff;--text-main:#1e293b;--text-sub:#64748b;--border-color:#e2e8f0;--col-bg:#f1f5f9;--primary:#4361ee}body{margin:0;font-family:sans-serif}</style>
<div id="dashboard-container" style="display:block"><button id="btn-admin-guide" onclick="openAdminGuide()">📖</button><button type="button" class="deck-guide-btn" onclick="openDeckGuide()">🏴‍☠️ Grand Line Deck</button></div>
<script>try{localStorage.setItem('adminGuideSeen','1')}catch(e){}window.marked={parse:function(t){return t.split('\\n').map(function(l){var m=/^### (.+)/.exec(l);return m?'<h3>'+m[1]+'</h3>':'<p>'+l+'</p>';}).join('')}};window.DOMPurify={sanitize:function(h){return h}};</script>
<script src="/admin-guide.js" defer></script>`;
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.route('https://qa.test/**', r => {
            const p = new URL(r.request().url()).pathname;
            const files = { '/h.html': ['text/html', harness], '/admin-guide.js': ['text/javascript', js], '/admin-guide.md': ['text/markdown', adm.th], '/admin-guide.en.md': ['text/markdown', adm.en], '/admin-guide.ko.md': ['text/markdown', adm.ko],
                '/grand-line-guide.md': ['text/markdown', deck.th], '/grand-line-guide.en.md': ['text/markdown', deck.en], '/grand-line-guide.ko.md': ['text/markdown', deck.ko] };
            if (files[p]) return r.fulfill({ contentType: files[p][0], body: files[p][1] });
            return r.fulfill({ status: 404, body: '' });
        });
        await page.goto('https://qa.test/h.html');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#adminGuideOverlay.open').count(), 0, 'seen flag set → no auto-open');
        // the badge → deck guide, English, first section (images), four chips
        await page.click('.deck-guide-btn');
        await page.waitForFunction(() => document.querySelector('#adminGuideOverlay.open') && document.querySelectorAll('#adminGuideOverlay .ag-chip').length === 4);
        assert.equal(await page.$eval('#adminGuideOverlay', e => e.dataset.set), 'deck');
        assert.match(await page.$eval('#adminGuideOverlay .ag-title', e => e.textContent), /Grand Line Deck — how to/);
        const chips = await page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => ({ t: e.textContent, on: e.getAttribute('aria-pressed') })));
        assert.deepEqual(chips.map(c => c.t), ['🖼 Images', '🎬 Video', '🐳 Audio', '🧭 Research Log']);
        assert.equal(chips[0].on, 'true', 'opens on Images (not the admin guide\'s tab map)');
        const body = () => page.$eval('#adminGuideOverlay .ag-body', e => e.innerText);
        assert.ok(/Visual Style Collection/.test(await body()) && /Nano Banana 2\.1/.test(await body()));
        await page.click('#adminGuideOverlay .ag-chip[data-i="1"]');
        assert.ok(/Plan 10 episodes/.test(await body()) && /\$0\.80/.test(await body()) && /teach-clips/.test(await body()), 'video section');
        // Thai switch stays on the deck set
        await page.click('#adminGuideOverlay .ag-l[data-l="th"]');
        // the title repaints at once, the body after the TH file loads — wait for the body (CI is slow)
        await page.waitForFunction(() => /วิธีใช้ Grand Line Deck/.test(document.querySelector('#adminGuideOverlay .ag-title').textContent) && /ยืนยัน/.test(document.querySelector('#adminGuideOverlay .ag-body').innerText));
        assert.ok(/Plan 10 episodes/.test(await body()) && /ยืนยัน/.test(await body()), 'TH video section, same index');
        assert.deepEqual(await page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => e.textContent)), ['🖼 ภาพ', '🎬 วิดีโอ', '🐳 เสียง', '🧭 Research Log']);
        // close, open the ADMIN guide → its own title, its own chips (not the deck's), lands on the tab map; the deck remembers its page
        await page.keyboard.press('Escape');
        await page.click('#btn-admin-guide');
        await page.waitForFunction(() => document.querySelector('#adminGuideOverlay.open') && document.querySelectorAll('#adminGuideOverlay .ag-chip').length >= 5);
        assert.equal(await page.$eval('#adminGuideOverlay', e => e.dataset.set), 'admin');
        assert.match(await page.$eval('#adminGuideOverlay .ag-title', e => e.textContent), /คู่มือ Admin/);
        assert.ok(!(await page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => e.textContent))).includes('🎬 วิดีโอ'), 'admin chips, not deck chips');
        await page.keyboard.press('Escape');
        await page.click('.deck-guide-btn');
        await page.waitForFunction(() => document.querySelector('#adminGuideOverlay').dataset.set === 'deck' && document.querySelectorAll('#adminGuideOverlay .ag-chip').length === 4);
        assert.equal(await page.$eval('#adminGuideOverlay .ag-chip[aria-pressed="true"]', e => e.dataset.i), '1', 'deck guide reopens where it was (video)');
        // KO
        await page.click('#adminGuideOverlay .ag-l[data-l="ko"]');
        await page.waitForFunction(() => /사용법/.test(document.querySelector('#adminGuideOverlay .ag-title').textContent) && /에피소드/.test(document.querySelector('#adminGuideOverlay .ag-body').innerText));
        assert.ok(/Plan 10 episodes/.test(await body()), 'KO video section');
        await page.click('#adminGuideOverlay .ag-l[data-l="en"]');
        assert.deepEqual(errs, []);
        console.log('deck-guide-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
