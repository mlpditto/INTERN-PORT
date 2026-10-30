// V102.533: Grand Line Deck Brief — Infographic styles get Layout chips + Sections cards drawn in the chosen layout. The REAL admin.html in Chromium
// (network stubbed). Checks: shown only for an Infographic style on the Image intent and only in the 4-fields Brief; the cards become Layout + Section
// lines in #design-prompt; empty cards add nothing; add / remove up to 6; a style change takes the lines out and back; Free text ⇄ fields round trip;
// the enhancer is told to keep the lines; nothing overflows at desktop or phone width.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(html.includes('Keep the Layout line and every Section line of the draft'), 'the enhancer keeps the lines');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
    const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
      return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
    });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto('file:///' + PUB + '/admin.html');
    await page.waitForFunction(() => document.readyState === 'complete' && typeof window.gmPaintSections === 'function' && document.querySelector('#gm-enhancer-rail .text-ai-chips'), null, { timeout: 30000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const c = document.querySelector('#hub-view-design > div');
      let el = c; while (el && el !== document.body) { if (el !== c) el.style.display = 'block'; el.style.visibility = 'visible'; el = el.parentElement; }
      c.style.cssText += ';position:fixed;inset:8px;z-index:2147483647;background:#fff;overflow:auto;padding:16px;';
    });
    const pick = name => page.evaluate(n => { const c = [...document.querySelectorAll('#hub-view-design .gm-sc')].find(x => x.textContent.includes(n)); selectDesignStyle(c); }, name);
    const prompt = () => page.locator('#design-prompt').inputValue();
    const box = page.locator('#gm-sections');

    await pick('Pharmacist explainer');
    assert.equal(await box.isVisible(), false, 'hidden for a non-Infographic style');
    await pick('Clean infographic');
    assert.equal(await box.isVisible(), true, 'shown for Clean infographic');
    assert.equal(await box.locator('.gm-sec').count(), 4, 'four cards to start');
    assert.equal(await box.locator('.gm-lay.on').innerText(), '2×2');
    assert.equal(await prompt(), '', 'empty cards add nothing — the Brief step stays empty');

    await box.locator('.gm-sec input[data-f="t"]').nth(0).fill('HRT');
    await box.locator('.gm-sec input[data-f="d"]').nth(0).fill('ประโยชน์และความเสี่ยง');
    await box.locator('.gm-sec input[data-f="t"]').nth(2).fill('Bone density');
    assert.equal(await prompt(), 'Layout: 2×2 grid of numbered sections\nSection 1: HRT — ประโยชน์และความเสี่ยง\nSection 2: Bone density', 'filled cards only, numbered in order: ' + await prompt());
    await page.locator('#gm-brief input[data-k="Goal"]').fill('Explain menopause care');
    assert.ok((await prompt()).startsWith('Goal: Explain menopause care\nLayout:'), 'the Brief lines come first');

    // the layout drives the cards and the prompt
    const col = () => box.locator('.gm-sec-cards').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length);
    assert.equal(await col(), 2, '2×2 draws two columns');
    await box.locator('.gm-lay', { hasText: 'Stack' }).click();
    assert.equal(await col(), 1, 'Stack draws one column');
    assert.ok((await prompt()).includes('Layout: single vertical stack'), 'layout in the prompt');
    assert.equal(await box.locator('.gm-sec input[data-f="t"]').nth(0).inputValue(), 'HRT', 'text survives the redraw');

    // add / remove
    await box.locator('.gm-sec-add').click(); await box.locator('.gm-sec-add').click();
    assert.equal(await box.locator('.gm-sec').count(), 6);
    assert.equal(await box.locator('.gm-sec-add').count(), 0, 'no add button at the cap');
    await box.locator('.gm-sec-x').nth(5).click();
    await box.locator('.gm-sec-x').nth(0).click();
    assert.ok(!(await prompt()).includes('HRT'), 'a removed card leaves the prompt');
    await box.locator('.gm-sec input[data-f="t"]').nth(0).fill('HRT "risk" <b>');
    assert.equal(await box.locator('.gm-sec').count(), 4);
    await box.locator('.gm-sec-add').click();
    assert.equal(await box.locator('.gm-sec input[data-f="t"]').nth(0).inputValue(), 'HRT "risk" <b>', 'quotes and tags survive the redraw');

    // a style change takes the lines out and brings them back
    await pick('3D pharmacology');
    assert.ok(!/Layout:|Section \d/.test(await prompt()), 'a non-Infographic style sends no Section lines: ' + await prompt());
    await pick('Clean infographic');
    assert.ok((await prompt()).includes('Layout: single vertical stack'), 'back on Infographic the lines return');

    // Free text ⇄ fields
    const before = await prompt();
    await page.evaluate(() => gmToggleBrief());
    assert.equal(await box.isVisible(), false, 'Free text hides the cards');
    assert.equal(await prompt(), before, 'Free text shows the same prompt');
    await page.evaluate(() => { document.getElementById('design-prompt').value += '\nSection 9: Botanical — evidence'; gmToggleBrief(); });
    assert.equal(await box.isVisible(), true);
    assert.equal(await box.locator('.gm-lay.on').innerText(), 'Stack', 'the layout comes back');
    assert.deepEqual(await box.locator('.gm-sec input[data-f="t"]').evaluateAll(l => l.map(i => i.value)), ['HRT "risk" <b>', 'Bone density', 'Botanical']);
    assert.ok((await prompt()).includes('Section 3: Botanical — evidence'), 'renumbered in order');
    assert.equal(await page.locator('#gm-brief input[data-k="Context"]').inputValue(), '', 'Section lines stay out of Context');

    // without Infographic, a "Section" line in free text is plain Context as before
    await pick('3D pharmacology');
    await page.evaluate(() => { gmToggleBrief(); document.getElementById('design-prompt').value = 'Section 1: keep me'; gmToggleBrief(); });
    assert.equal(await page.locator('#gm-brief input[data-k="Context"]').inputValue(), 'Section 1: keep me', 'nothing is lost');

    // hidden on the clip intents
    await pick('Clean infographic');
    await page.evaluate(() => { window.glcIsClipMode = () => true; gmPaintIntent(); });
    assert.equal(await box.isVisible(), false, 'a clip intent has no Sections');
    await page.evaluate(() => { window.glcIsClipMode = () => false; gmPaintIntent(); });

    // nothing overflows; on a phone the cards stack
    for (const w of [1300, 960, 390]) {
      await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(150);
      const d = await box.evaluate(n => ({ sw: n.scrollWidth, cw: n.clientWidth, past: [...n.querySelectorAll('button,input')].filter(e => e.getBoundingClientRect().right > n.getBoundingClientRect().right + 1).length }));
      assert.ok(d.sw <= d.cw + 1 && d.past === 0, 'fits at ' + w + ' px: ' + JSON.stringify(d));
    }
    assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
    console.log('PASS: Grand Line Deck Layout + Sections — Infographic + Image only, cards become Layout / Section lines, add / remove to 6, style change and Free text round trip, fits 1300 / 960 / 390 px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
