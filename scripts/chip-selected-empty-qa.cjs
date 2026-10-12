// V102.210: a chosen chip with nobody active in it (BUU 0 › Junior 0) keeps its REAL colour instead of the empty-grey one.
// groupChipHtml writes --c:#94a3b8 for empty chips and also --cs (the real colour); the chosen-chip rule paints with var(--cs, var(--c)).
// Real CSS rule cut from admin.html + chips carrying the exact inline style groupChipHtml emits.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes("style=\"--c:${empty ? '#94a3b8' : c};${empty ? ' --cs:' + c + ';' : ''}\">${glyph}"), 'groupChipHtml writes --cs for empty chips');
const base = html.match(/\.grp-chip\.on, \.grp-chip\[aria-pressed="true"\] \{[^}]*\}/);
assert.ok(base && base[0].includes('var(--cs, var(--c))'), 'the chosen-chip rule paints with --cs first');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const chip = (state, style) => `<button class="grp-chip" ${state} style="${style}">x</button>`;
    await page.setContent(`<style>${base[0]}</style>
        ${chip('aria-pressed="true"', '--c:#94a3b8; --cs:#8b5cf6;')}${chip('aria-pressed="true"', '--c:#0ea5e9;')}${chip('aria-pressed="true"', '--c:#94a3b8;')}`);
    const bg = await page.$$eval('.grp-chip', els => els.map(e => getComputedStyle(e).backgroundColor));
    assert.equal(bg[0], 'rgb(139, 92, 246)', 'chosen + empty shows its real colour');
    assert.equal(bg[1], 'rgb(14, 165, 233)', 'a normal chosen chip is unchanged');
    assert.equal(bg[2], 'rgb(148, 163, 184)', 'a chosen chip with no --cs stays grey');
    await browser.close();
    console.log('PASS: chosen empty chip keeps its colour (--cs); normal chips unchanged');
})().catch(e => { console.error(e); process.exit(1); });
