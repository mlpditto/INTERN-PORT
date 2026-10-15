// V102.246 — User Hub profile cards: the header is ONE lean row (~34px). The enrollment-code chip used to be 44px tall (`.gs-profile-card button { min-height:44px }` beat `.gs-code { min-height:0 }`)
// and alone made "Personal details" 56px. The REAL admin <style> blocks + the real card markup in Chromium (mouse and touch).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const styles = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
const cards = [...html.matchAll(/<section class="gs-profile-card gs-card-(basic|contact|work|social)">[\s\S]*?<\/section>/g)].map(m => m[0]).join('\n').replace('<code id="gs-enrollment-code">-</code>', '<code id="gs-enrollment-code">6CFGXV</code>');
assert.ok(/gs-card-basic/.test(cards) && /gs-card-social/.test(cards), 'the four profile cards were found in admin.html');
const file = path.resolve('public/_card_head_qa.html');
fs.writeFileSync(file, `<!doctype html><meta charset="utf-8">${styles}<body style="padding:20px"><div id="groupSelectModal" style="display:block;position:static;background:none"><div class="modal-content" style="width:560px;max-width:560px"><div class="gs-profile-cards" style="grid-template-columns:1fr">${cards}</div></div></div></body>`);
(async () => {
    const browser = await chromium.launch();
    try {
        for (const [label, opts] of [['mouse', {}], ['touch', { hasTouch: true }]]) {
            const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, ...opts });
            const page = await ctx.newPage();
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(pathToFileURL(file).href);
            await page.waitForTimeout(250);
            const m = await page.evaluate(() => {
                const size = el => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
                const basic = document.querySelector('.gs-card-basic header');
                return {
                    heads: [...document.querySelectorAll('.gs-profile-card header')].map(h => size(h)[1]),
                    chip: size(document.getElementById('gs-enrollment-chip')),
                    copy: size(document.querySelector('.gs-card-basic .gs-copy-card')), edit: size(document.querySelector('.gs-card-basic .gs-edit-card')),
                    oneRow: [...basic.children].every(c => Math.abs(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2 - (basic.getBoundingClientRect().top + basic.getBoundingClientRect().height / 2)) < 8),
                    chipText: document.getElementById('gs-enrollment-chip').innerText.trim(),
                };
            });
            assert.ok(m.heads.every(h => h <= 38), label + ': every card header ≤ 38px (was 56 on Personal details): ' + m.heads.join(','));
            assert.ok(m.chip[1] <= 28 && m.chip[1] >= 22, label + ': the code chip is 22-28px tall: ' + m.chip.join('x'));
            assert.deepEqual([m.copy[1], m.edit[1]], [26, 26], label + ': the 📋 and ✏️ buttons are 26px');
            assert.ok(m.oneRow && m.chipText === '6CFGXV', label + ': title + code + buttons on ONE row, code still readable');
            await ctx.close();
        }
        console.log('PASS: User Hub card headers — one lean row (~34px), code chip 26px, buttons 26px, same with a touch device');
    } finally { await browser.close(); try { fs.unlinkSync(file); } catch (e) { /* already gone */ } }
})().catch(e => { try { fs.unlinkSync(file); } catch (x) { /* ok */ } console.error(e); process.exit(1); });
