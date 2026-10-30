// V102.535: Grand Line Deck Review — the REAL admin.html in Chromium (network stubbed, fake image model). Checks: the check line on numbers and doses;
// Download / Copy Base64 / Copy prompt are icon-only with tooltips; Copy prompt gives the exact text the image model got; the Review step finishes on
// Download or Copy Base64 and reopens for a new image; on clips it finishes once every episode is reviewed; the bar fits at desktop and phone width.
const path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
    const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
      if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
      return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
    });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto('file:///' + PUB + '/admin.html');
    await page.waitForFunction(() => document.readyState === 'complete' && typeof window.generateAIDesign === 'function' && document.querySelector('#gm-enhancer-rail .text-ai-chips'), null, { timeout: 30000 });
    await page.waitForTimeout(300);
    await page.evaluate(PNG => {
      const hub = document.getElementById('hub-view-design');
      let el = hub; while (el && el !== document.body) { el.style.setProperty('display', 'block', 'important'); el.style.visibility = 'visible'; el = el.parentElement; }
      hub.style.cssText += ';position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto;padding:8px;';
      window.__sent = []; window.__clip = []; window.showToast = () => {};
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__clip.push(t); } }, configurable: true });
      window.callUniversalAI = async (m, prompt, j, v, s, o) => { if (o && o.feature === 'design_image') window.__sent.push(prompt); return { imageDataUrl: PNG, text: '' }; };
    }, PNG);
    const steps = () => page.$$eval('#gm-steps .gm-st', els => els.map(e => (e.classList.contains('done') ? 'd' : e.classList.contains('now') ? 'n' : '-')).join(''));
    const create = async () => { await page.evaluate(() => { document.getElementById('design-prompt').value = 'Warfarin basics'; return generateAIDesign({ skipEnhance: true }); }); await page.evaluate(() => gmPaintSteps()); };

    assert.equal(await page.locator('#design-actions').isVisible(), false, 'no bar before an image');
    await create();
    const bar = page.locator('#design-actions');
    assert.equal(await bar.isVisible(), true, 'the bar shows with the image');
    assert.match(await bar.locator('.gm-check').innerText(), /Check numbers and doses against your source/);
    assert.match(await bar.locator('.gm-check').getAttribute('title'), /ตรวจตัวเลขและขนาดยา/, 'TH in the tooltip');
    for (const [id, label] of [['gm-act-download', 'Download'], ['gm-act-b64', 'Copy Base64'], ['gm-act-prompt', 'Copy prompt']]) {
      const b = page.locator('#' + id);
      assert.equal((await b.innerText()).trim(), '', id + ' is icon only');
      assert.equal(await b.getAttribute('aria-label'), label);
      assert.ok((await b.getAttribute('title')).includes('·'), id + ' has an EN · TH tooltip');
      const r = await b.boundingBox(); assert.ok(r.width === 38 && r.height === 38, id + ' is a 38 px icon: ' + JSON.stringify(r));
    }
    assert.equal(await steps(), 'ddddd' + 'n', 'an image waits on Review');

    // Copy prompt = the exact prompt the image model received, and does not finish Review
    await page.locator('#gm-act-prompt').click();
    await page.waitForFunction(() => window.__clip.length === 1);
    const [sent, copied] = await page.evaluate(() => [window.__sent[window.__sent.length - 1], window.__clip[0]]);
    assert.equal(copied, sent, 'Copy prompt gives what was sent');
    assert.ok(sent.includes('Warfarin basics') && sent.includes('Style: ') && sent.includes('original characters only'), sent);
    assert.equal(await steps(), 'dddddn', 'Copy prompt does not finish Review');

    // Download finishes Review; a new image opens it again; Copy Base64 finishes it too
    const dl = page.waitForEvent('download');
    await page.locator('#gm-act-download').click();
    assert.match((await dl).suggestedFilename(), /^AI_Design_\d+\.png$/);
    assert.equal(await steps(), 'dddddd', 'Download finishes the stepper');
    await create();
    assert.equal(await steps(), 'dddddn', 'a new image needs its own review');
    await page.locator('#gm-act-b64').click();
    assert.equal(await steps(), 'dddddd', 'Copy Base64 finishes it too');

    // the bar stays inside the preview card, also on a phone
    for (const w of [1000, 390]) {
      await page.setViewportSize({ width: w, height: 800 }); await page.waitForTimeout(150);
      const d = await bar.evaluate(n => { const r = n.getBoundingClientRect(), p = n.parentElement.getBoundingClientRect(); return { l: r.left - p.left, r: p.right - r.right }; });
      assert.ok(d.l >= 0 && d.r >= 0, 'the bar fits at ' + w + ' px: ' + JSON.stringify(d));
    }

    // clips: Review waits until every episode is reviewed
    const clip = await page.evaluate(() => {
      window.glcIsClipMode = () => true;
      const r = {};
      window._glcSeries = { episodes: [{ n: 1, status: 'done' }, { n: 2, status: 'done' }] }; gmPaintSteps();
      r.one = [...document.querySelectorAll('#gm-steps .gm-st')].pop().className;
      window._glcSeries.episodes.forEach(e => { e.reviewed = { by: 'a' }; }); gmPaintSteps();
      r.all = [...document.querySelectorAll('#gm-steps .gm-st')].pop().className;
      window.glcIsClipMode = () => false; window._glcSeries = null;
      return r;
    });
    assert.match(clip.one, /\bnow\b/, 'Review stays open with unreviewed clips: ' + clip.one);
    assert.match(clip.all, /\bdone\b/, 'every clip reviewed finishes it: ' + clip.all);
    assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
    console.log('PASS: Grand Line Deck Review — check line, icon-only actions, Copy prompt = the prompt sent, Review finishes on Download / Copy Base64 or every clip reviewed, fits 1000 / 390 px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
