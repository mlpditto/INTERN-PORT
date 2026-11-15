// Drug / Disease Codex ▸ approve: the "🎁 Award points to the contributor" box opens EMPTY (V102.651, owner: the default should not
// name a score). OK on an empty box = approve with 0 points; a chip fills the box; an AI-suggested score is the first chip, not a pre-fill.
// Runs the real codexBonusPrompt() cut from admin.html in a page.
//   node scripts/codex-bonus-blank-qa.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function grab(name) {
    const at = admin.indexOf('function ' + name + '(');
    assert.ok(at >= 0, name + ' exists');
    let i = admin.indexOf('{', admin.indexOf(')', at)), depth = 0;
    for (; i < admin.length; i++) { if (admin[i] === '{') depth++; else if (admin[i] === '}' && --depth === 0) break; }
    return admin.slice(at, i + 1);
}
const fn = grab('codexBonusPrompt');
assert.ok(!/defaultVal:\s*0\.1/.test(admin), 'no caller offers 0.1 as the default any more');
assert.equal((admin.match(/codexBonusPrompt\(\{/g) || []).length, 3, 'three callers: Review & Edit publish, Drug approve, Disease approve');
assert.ok(/codexBonusPrompt\(\{ heading, suggest: suggested \? suggested\.value : null \}\)/.test(admin), 'the AI-suggested score rides as a chip, not as the value');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 600, height: 500 } });
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: 'window.escapeHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");\n' + fn + '\nwindow.codexBonusPrompt = codexBonusPrompt;' });
    const open = (opts) => page.evaluate(o => { window.__r = 'open'; window.codexBonusPrompt(o).then(v => { window.__r = v; }); }, opts);
    const chips = () => page.$$eval('button[data-val]', b => b.map(x => x.textContent));
    const result = async () => { await page.waitForFunction(() => window.__r !== 'open'); return page.evaluate(() => window.__r); };

    // 1. opens empty; OK = 0 points
    await open({ heading: 'Approve & publish "X" to Drug Codex as-is?' });
    assert.equal(await page.inputValue('input'), '', 'the box opens empty');
    assert.deepEqual(await chips(), ['0.1', '0.5', '1', '2', '5']);
    await page.click('button[data-act="ok"]');
    assert.equal(await result(), 0, 'OK on an empty box → approve with no points');
    // 2. a chip fills it
    await open({ heading: 'h' });
    await page.click('button[data-val="0.5"]');
    assert.equal(await page.inputValue('input'), '0.5');
    await page.keyboard.press('Enter');
    assert.equal(await result(), 0.5);
    // 3. Cancel / Escape = don't approve
    await open({ heading: 'h' }); await page.click('button[data-act="cancel"]'); assert.equal(await result(), null);
    await open({ heading: 'h' }); await page.keyboard.press('Escape'); assert.equal(await result(), null);
    // 4. an AI-suggested score is the first chip, the box still empty; a suggestion equal to a preset is not repeated
    await open({ heading: 'h', suggest: 0.7 });
    assert.equal(await page.inputValue('input'), '', 'a suggestion does not pre-fill');
    assert.deepEqual(await chips(), ['0.7', '0.1', '0.5', '1', '2', '5']);
    await page.click('button[data-val="0.7"]'); await page.click('button[data-act="ok"]');
    assert.equal(await result(), 0.7);
    await open({ heading: 'h', suggest: 1 });
    assert.deepEqual(await chips(), ['1', '0.1', '0.5', '2', '5']);
    await page.keyboard.press('Escape'); await result();
    // 5. an explicit defaultVal still works for a caller that wants one
    await open({ heading: 'h', defaultVal: 2 });
    assert.equal(await page.inputValue('input'), '2');
    await page.keyboard.press('Escape'); await result();
    assert.equal(await page.$$eval('body > div', d => d.length), 0, 'the overlay is gone after each answer');
    await browser.close();
    console.log('PASS: Codex approve points box (V102.651) — opens empty, OK = 0 points, chips fill it, AI-suggested score is the first chip (not a pre-fill), Cancel / Esc = no approve');
})().catch(e => { console.error(e); process.exit(1); });
