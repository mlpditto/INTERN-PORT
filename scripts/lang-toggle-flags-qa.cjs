// V102.529 / V101.248: the language toggle (#lang-toggle-cycle, lang-toggle.js) shows a country flag — 🇺🇸 EN → 🇰🇷 KR → 🇹🇭 TH → 🇰🇷🇹🇭 both → 🇺🇸;
// the letters stay in aria-label / title, both flags = a short pill (class both), twemoji is asked for where it is loaded.
// Runs the REAL lang-toggle.js on a tiny page that carries the real .lang-toggle-btn CSS from admin.html.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/lang-toggle.js', 'utf8');
const admin = fs.readFileSync('public/admin.html', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8');
const cssOf = html => (html.match(/\.lang-toggle-btn \{[\s\S]*?\.lang-toggle-btn\.both \{[^}]*\}/) || [''])[0];
assert.ok(cssOf(admin) && cssOf(index), 'both pages carry the flag CSS (.lang-toggle-btn … .lang-toggle-btn.both)');
for (const [name, html] of [['admin', admin], ['intern', index]]) {
    assert.ok(/\.lang-toggle-btn img\.emoji \{ width: 16px; height: 16px;/.test(html), name + ': twemoji flag is 16 px');
    assert.ok(/\.lang-toggle-btn\.both \{ width: auto; padding: 0 5px;/.test(html), name + ': two flags widen into a pill');
}
assert.ok(/twemoji\.parse\(cycleBtn/.test(js), 'lang-toggle.js asks twemoji to draw the flag where it is loaded (Windows has no flag glyphs)');
const V = (html, re) => (html.match(re) || [])[1];
assert.ok(+V(admin, /lang-toggle\.js\?v=V102\.(\d+)/) >= 529, 'admin cache-bust carries the flag build');   // not == the title: any later admin release would fail this
assert.ok(+V(index, /lang-toggle\.js\?v=V101\.(\d+)/) >= 248, 'intern cache-bust carries the flag build');

const page_html = `<!doctype html><meta charset="utf-8"><style>body{font-size:16px}${cssOf(admin)}</style>
<button id="lang-toggle-cycle" class="btn-sm lang-toggle-btn" onclick="cycleLang()" title="Language: tap to switch" aria-label="Language (tap to switch)">EN</button>
<script>${js}</script>`;
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 600, height: 300 } });
        await page.route('**/*', r => r.fulfill({ contentType: 'text/html', body: page_html }));
        await page.goto('https://qa.test/');
        await page.evaluate(() => { localStorage.clear(); if (window.applyLangState) applyLangState(); });
        const state = () => page.$eval('#lang-toggle-cycle', b => ({ t: b.textContent, a: b.getAttribute('aria-label'), title: b.title, both: b.classList.contains('both'), active: b.classList.contains('active'), w: Math.round(b.getBoundingClientRect().width), fs: getComputedStyle(b).fontSize }));
        const seen = [];
        for (let i = 0; i < 5; i++) { seen.push(await state()); await page.click('#lang-toggle-cycle'); }
        assert.deepEqual(seen.map(s => s.t), ['🇺🇸', '🇰🇷', '🇹🇭', '🇰🇷🇹🇭', '🇺🇸'], 'the cycle is 🇺🇸 → 🇰🇷 → 🇹🇭 → 🇰🇷🇹🇭 → 🇺🇸: ' + JSON.stringify(seen.map(s => s.t)));
        assert.deepEqual(seen.map(s => s.a), ['Language: EN (tap to switch)', 'Language: KR (tap to switch)', 'Language: TH (tap to switch)', 'Language: K·T (tap to switch)', 'Language: EN (tap to switch)'], 'the letters stay in aria-label');
        assert.deepEqual(seen.map(s => s.title), ['Language: EN — tap to switch', 'Language: KR — tap to switch', 'Language: TH — tap to switch', 'Language: K·T — tap to switch', 'Language: EN — tap to switch'], 'and in the tooltip');
        assert.deepEqual(seen.map(s => s.both), [false, false, false, true, false], 'class both only with two flags');
        assert.deepEqual(seen.map(s => s.active), [false, true, true, true, false], 'active = any flag but EN (unchanged)');
        assert.ok(seen[0].w === 28 && seen[3].w > 28, 'one flag keeps the 28 px disc, two flags widen into a pill (text flags here; twemoji SVGs make it wider on the real page): ' + seen.map(s => s.w));
        assert.equal(seen[0].fs, '15px', 'the flag is 15 px, not the old 0.6em letters');
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('uiLangKR'), localStorage.getItem('uiLangTH')]), ['1', '0'], 'the same storage keys as before (five taps = KR again)');
        console.log('PASS: language toggle = country flags (🇺🇸 → 🇰🇷 → 🇹🇭 → 🇰🇷🇹🇭), letters in aria-label / title, both-flags pill, twemoji asked for, cache-busts match the versions');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
