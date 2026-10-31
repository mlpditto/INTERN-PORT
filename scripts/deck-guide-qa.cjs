// V102.530: the Grand Line Deck how-to lives in the 📖 Admin guide as section 7 (the deck's own 📖 button and grand-line-guide files are gone).
// The REAL admin-guide.js + the three admin-guide markdown files; the chapter only names buttons and chips that admin.html really has.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/admin-guide.js', 'utf8');
const adm = { en: fs.readFileSync('public/admin-guide.en.md', 'utf8'), th: fs.readFileSync('public/admin-guide.md', 'utf8'), ko: fs.readFileSync('public/admin-guide.ko.md', 'utf8') };
const chapter = doc => doc.split(/\r?\n## 7\. /)[1] || '';

// static: one guide, one button + every named control exists in admin.html
assert.ok(!/openDeckGuide|deck-guide/.test(admin) && !/openDeckGuide|SETS/.test(js), 'no second guide, no deck 📖 button');
for (const f of ['grand-line-guide.md', 'grand-line-guide.en.md', 'grand-line-guide.ko.md']) assert.ok(!fs.existsSync('public/' + f), f + ' merged away');
assert.ok(admin.includes(`onclick="switchTab('tab-ai-hub')"`) && /switchTab\('tab-ai-hub'\)"[^>]*>🏴‍☠️ Grand Line Deck<\/button>/.test(admin) && !admin.includes('AI Digital Lab'), 'the top tab is "🏴‍☠️ Grand Line Deck" — "AI Digital Lab" is gone everywhere');
assert.ok(/<script src="admin-guide\.js\?v=V102\.\d+" defer><\/script>/.test(admin) && !admin.includes('admin-guide.js?v=V102.226'), 'script cache-busted');
const subs = { en: ['🖼 Images', '🎬 Video', '🗣️ Thai clip', '🐳 Audio', '🧭 Log Pose'], th: ['🖼 ภาพ', '🎬 วิดีโอ', '🗣️ คลิปไทย', '🐳 เสียง', '🧭 Log Pose'], ko: ['🖼 이미지', '🎬 영상', '🗣️ 태국어 클립', '🐳 오디오', '🧭 Log Pose'] };
for (const l of ['en', 'th', 'ko']) {
    const c = chapter(adm[l]);
    assert.deepEqual(c.split(/\r?\n/).filter(x => /^### /.test(x)).map(x => x.slice(4)), subs[l], l + ': five sub-headings in order');
    assert.ok(!/\n## /.test(c) && !/📖/.test(c), l + ': section 7 is the last one and no longer points at a deck 📖');
    assert.ok(!/section 3|หัวข้อ 3|3절/.test(c), l + ': no stale "section 3" reference');
    assert.ok(/\$0\.80/.test(c) && /teach-clips/.test(c) && /clip_series/.test(c), l + ': cost + save targets');
}
for (const label of ['Plan 10 episodes', 'Clip 9:16', 'Nano Banana 2.1', 'Image 2', 'Visual Style Collection', 'Polish', 'Query Brain', 'Suggest Prompts', 'Focus on KB Only', 'Manage Documents', 'Codex Gallery', 'Clear Chat', 'Send to Podcast', 'Target Length', 'Performance Direction', 'CC ไทย', '🔊 เสียงไทย', 'Series ×10', 'One clip', '⇄ Free text', 'Easy to see', 'Stop after this one', 'Save all']) {
    assert.ok(admin.includes(label), 'admin.html has "' + label + '"');
    for (const l of ['en', 'th', 'ko']) assert.ok(chapter(adm[l]).split('**').join('').includes(label), l.toUpperCase() + ' Deck chapter names "' + label + '"');
}

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>:root{--bg-card:#fff;--text-main:#1e293b;--text-sub:#64748b;--border-color:#e2e8f0;--col-bg:#f1f5f9;--primary:#4361ee}body{margin:0;font-family:sans-serif}</style>
<div id="dashboard-container" style="display:block"><button id="btn-admin-guide" onclick="openAdminGuide()">📖</button></div>
<script>try{localStorage.setItem('adminGuideSeen','1')}catch(e){}window.marked={parse:function(t){return t.split('\\n').map(function(l){var m=/^### (.+)/.exec(l);return m?'<h3>'+m[1]+'</h3>':'<p>'+l+'</p>';}).join('')}};window.DOMPurify={sanitize:function(h){return h}};</script>
<script src="/admin-guide.js" defer></script>`;
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.route('https://qa.test/**', r => {
            const p = new URL(r.request().url()).pathname;
            const files = { '/h.html': ['text/html', harness], '/admin-guide.js': ['text/javascript', js], '/admin-guide.md': ['text/markdown', adm.th], '/admin-guide.en.md': ['text/markdown', adm.en], '/admin-guide.ko.md': ['text/markdown', adm.ko] };
            if (files[p]) return r.fulfill({ contentType: files[p][0], body: files[p][1] });
            return r.fulfill({ status: 404, body: '' });
        });
        await page.goto('https://qa.test/h.html');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#adminGuideOverlay.open').count(), 0, 'seen flag set → no auto-open');
        await page.click('#btn-admin-guide');
        await page.waitForFunction(() => document.querySelector('#adminGuideOverlay.open') && document.querySelectorAll('#adminGuideOverlay .ag-chip').length === 9);
        const chips = () => page.$$eval('#adminGuideOverlay .ag-chip', els => els.map(e => e.textContent));
        assert.equal((await chips())[7], '🏴‍☠️ Deck', 'the eighth chip is the Deck chapter');
        const body = () => page.$eval('#adminGuideOverlay .ag-body', e => { e.querySelectorAll('.ag-fold').forEach(d => { d.open = true; }); return e.innerText; });   // V102.529: every ### block folds
        await page.click('#adminGuideOverlay .ag-chip[data-i="7"]');
        assert.deepEqual(await page.$$eval('#adminGuideOverlay .ag-fold > summary', els => els.map(e => e.textContent)), subs.en, 'the five parts are the chapter\'s folds');
        const en = await body();
        assert.ok(/Visual Style Collection/.test(en) && /Nano Banana 2\.1/.test(en), 'images');
        assert.ok(/Plan 10 episodes/.test(en) && /\$0\.80/.test(en) && /Intent.*Brief.*Style.*Plan.*Render.*Review/s.test(en) && /Stop after this one/.test(en), 'video');
        assert.ok(/CC ไทย/.test(en) && /Kore \/ Charon \/ Achird/.test(en) && /EPnn-th-voice\.mp4/.test(en), 'Thai clip');
        assert.ok(/Query Brain/.test(en) && /Send to Podcast/.test(en), 'audio + Log Pose');
        assert.equal(await page.locator('#adminGuideOverlay .ag-go.next').count(), 0, 'last chapter');
        // the language switch keeps the chapter; reopening lands where it was
        await page.click('#adminGuideOverlay .ag-l[data-l="th"]');
        await page.waitForFunction(() => /ยืนยัน/.test(document.querySelector('#adminGuideOverlay .ag-body').textContent) && /คู่มือ Admin/.test(document.querySelector('#adminGuideOverlay .ag-title').textContent));
        assert.ok(/Plan 10 episodes/.test(await body()), 'TH Deck chapter');
        await page.keyboard.press('Escape');
        await page.click('#btn-admin-guide');
        await page.waitForFunction(() => document.querySelectorAll('#adminGuideOverlay .ag-chip').length === 9);
        assert.equal(await page.$eval('#adminGuideOverlay .ag-chip[aria-pressed="true"]', e => e.dataset.i), '7', 'reopens on the Deck chapter');
        await page.click('#adminGuideOverlay .ag-l[data-l="ko"]');
        await page.waitForFunction(() => /관리자 가이드/.test(document.querySelector('#adminGuideOverlay .ag-title').textContent) && /에피소드/.test(document.querySelector('#adminGuideOverlay .ag-body').textContent));
        assert.ok(/Plan 10 episodes/.test(await body()), 'KO Deck chapter');
        assert.deepEqual(errs, []);
        console.log('deck-guide-qa: all passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
