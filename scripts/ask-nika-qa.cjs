// V101.263: the Nika tab on the REAL public/index.html, stubbed callable, at phone width. Third tab, same height, sunrise on pick; ask + chips; answer + numbered
// sources; an answer's text is escaped; not in library, paused, limit and busy each say so; a source opens on top; back to Drugs clears the Nika look.
// V101.308 (owner pick C, no text twice): the tab = the icon + a badge with the count left; 🛟 in the placeholder; ➤; with an answer the chips step aside
// (↺ brings them back); sources = icon + number (title in the tooltip); 📋 copies the answer (✓); the flag asks again in the next language, kept once asked.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

async function open(browser, width, peek) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((peek) => {
    window.__calls = []; window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } });
    window.__peek = peek;
    window.__next = null;
    window.firebase = {
      functions: () => ({ httpsCallable: name => data => {
        if (name !== 'askNika') return Promise.resolve({ data: {} });
        window.__calls.push(data);
        return Promise.resolve({ data: data.peek ? window.__peek : window.__next });
      } }),
      firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }
    };
  }, peek);
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important');
    const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    let n = document.getElementById('dd-codex-card');
    for (; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');
    document.getElementById('dd-section-content').style.display = 'block';
    window.ensureFirebaseAuthReady = async () => ({ uid: 'a' });
    window.__opened = [];
    window.dcOpenDetail = id => window.__opened.push('drug:' + id);
    window.dxOpenDetail = id => window.__opened.push('disease:' + id);
    window.dcLoadCodex = () => {}; window.dxLoadCodex = () => {};
    window.internArticles = { openArticle: id => window.__opened.push('article:' + id) };
    dcState.codex = [{ _id: 'd1' }]; dcState.loaded = true;
    dxState.codex = [{ _id: 'x1' }]; dxState.loaded = true;
  });
  await page.evaluate(() => { document.querySelector('[data-ddtype="nika"]').click(); });
  await page.waitForTimeout(200);
  return { page, ctx };
}
const send = async (page, data, text = 'What to monitor?') => {
  await page.evaluate(d => { window.__next = d; }, data);
  await page.fill('#nk-question', text);
  await page.click('.nk-go');
  await page.waitForTimeout(100);
};
const text = (page, sel) => page.locator('#nika-section-content ' + sel).innerText();

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390]) {
      const { page, ctx } = await open(browser, width, { left: 10, paused: false });
      const tag = ' @' + width;
      const tabs = await page.$$eval('#dd-type-tabs .dd-type-tab', e => e.map(x => { const b = x.getBoundingClientRect(); return { h: Math.round(b.height), t: Math.round(b.top), r: b.right, on: x.classList.contains('active'), id: x.dataset.ddtype }; }));
      assert.deepEqual(tabs.map(t => t.id), ['drug', 'disease', 'nika']);
      assert.equal(new Set(tabs.map(t => t.h)).size, 1, 'equal height' + tag);
      assert.equal(new Set(tabs.map(t => t.t)).size, 1, 'one row' + tag);
      assert.ok(tabs[2].on && tabs[2].r <= width, 'the Nika tab is on and on screen' + tag);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no sideways scroll' + tag);
      assert.equal(await page.locator('#dd-codex-card.nk-sun').count(), 1, 'sunrise' + tag);
      assert.equal(await page.locator('#dc-section-content').isHidden(), true);
      assert.equal(await page.evaluate(() => document.querySelector('.nk-tab img').naturalWidth > 0), true, 'the icon loads');
      assert.equal((await page.evaluate(() => { const b = document.querySelector('.nk-tab .nk-n'), t = document.querySelector('.nk-tab'); return b.hidden ? '' : b.textContent + ' · ' + t.title; })), '10 · Nika · 10 questions left today', 'the count = a badge on the tab' + tag);
      assert.equal(await page.evaluate(() => document.querySelector('.nk-tab').textContent.trim()), '10', 'no "Nika" text on the tab');
      assert.deepEqual(await page.$eval('#nk-question', e => [e.placeholder, e.title]), ['Ask about a drug, a disease or an article · 🛟 no patient names / HN', '🛟 For learning only. Check with your preceptor before using it on a patient. Do not type patient names or HN.'], 'tells them not to type a patient');
      assert.equal(await page.locator('#nika-section-content .nk-safe, #nika-section-content .nk-left').count(), 0, 'no separate lines');
      assert.deepEqual(await page.$eval('.nk-go', b => [b.textContent, b.getAttribute('aria-label')]), ['➤', 'Ask']);
      assert.equal(await page.locator('.nk-chips .nk-chip').count(), 3);
      assert.equal(await page.evaluate(() => { const r = [...document.querySelectorAll('.nk-row button')].map(b => b.getBoundingClientRect()); return r.every(x => x.right <= innerWidth); }), true, 'the chip row fits' + tag);
      assert.ok(await page.$eval('.nk-go', b => b.getBoundingClientRect().height >= 44), '44 px target' + tag);

      // an answer: bullets, bold, escaped, numbered sources that open on top
      await send(page, { answer: 'Monitor these:\n* **BP** at baseline\n    * <img src=x onerror=alert(1)>', sources: [{ kind: 'drug', id: 'd1', title: 'Amlodipine' }, { kind: 'disease', id: 'x1', title: 'Hypertension' }, { kind: 'article', id: 'a1', title: 'Edema' }], left: 9 });
      assert.equal(await page.locator('.nk-a li').count(), 2);
      assert.equal(await page.locator('.nk-a b').innerText(), 'BP');
      assert.equal(await page.locator('.nk-a img').count(), 0, 'answer text is escaped');
      assert.deepEqual(await page.$$eval('.nk-s', e => e.map(b => [b.textContent, b.title])), [['💊1', 'Amlodipine'], ['🩺2', 'Hypertension'], ['📰3', 'Edema']], 'sources = icon + number, the title in the tooltip');
      assert.equal(await page.$eval('.nk-s', b => b.getBoundingClientRect().height < 40), true, 'one line' + tag);
      assert.equal((await page.evaluate(() => { const b = document.querySelector('.nk-tab .nk-n'), t = document.querySelector('.nk-tab'); return b.hidden ? '' : b.textContent + ' · ' + t.title; })), '9 · Nika · 9 questions left today');
      assert.equal(await page.locator('.nk-row').isHidden(), true, 'the chips step aside with an answer');
      assert.deepEqual(await page.$$eval('.nk-src .nk-tool', e => e.map(b => b.textContent + ':' + b.title)), ['🇬🇧:Answer in Thai', '📋:Copy the answer', '↺:New question']);
      await page.click('.nk-copy'); await page.waitForTimeout(50);
      assert.deepEqual([await page.evaluate(() => window.__copied.at(-1)), await page.$eval('.nk-copy', b => b.textContent)], ['Monitor these:\n• BP at baseline\n• <img src=x onerror=alert(1)>', '✓'], '📋 copies plain text, ✓');
      // the flag: the same question in Thai (counted), then Korean, then English again from what was kept (not asked)
      await page.evaluate(() => { window.__next = { answer: '* ดู **BP**', sources: [], left: 8 }; }); await page.click('.nk-lang'); await page.waitForTimeout(100);
      assert.deepEqual((await page.evaluate(() => window.__calls)).at(-1), { question: 'What to monitor?', lang: 'th' });
      assert.deepEqual([await page.locator('.nk-a b').innerText(), await page.$eval('.nk-lang', b => b.textContent + ':' + b.title)], ['BP', '🇹🇭:Answer in Korean']);
      await page.evaluate(() => { window.__next = { answer: '* **혈압** 확인', sources: [], left: 7 }; }); await page.click('.nk-lang'); await page.waitForTimeout(100);
      const n0 = (await page.evaluate(() => window.__calls)).length; await page.click('.nk-lang'); await page.waitForTimeout(100);
      assert.deepEqual([(await page.evaluate(() => window.__calls)).length, await page.locator('.nk-a b').innerText(), await page.$eval('.nk-lang', b => b.textContent)], [n0, 'BP', '🇬🇧'], 'back to English from what was kept, not asked again');
      // ↺ = the chips back, the answer gone
      await page.click('.nk-new'); assert.deepEqual([await page.locator('.nk-row').isVisible(), await page.locator('.nk-a').count()], [true, 0]);
      await send(page, { answer: '* **BP** at baseline', sources: [{ kind: 'drug', id: 'd1', title: 'Amlodipine' }, { kind: 'disease', id: 'x1', title: 'Hypertension' }, { kind: 'article', id: 'a1', title: 'Edema' }], left: 9 });
      assert.equal(await page.inputValue('#nk-question'), '', 'the box clears');
      assert.deepEqual((await page.evaluate(() => window.__calls)).at(-1), { question: 'What to monitor?' });
      for (const b of [0, 1, 2]) await page.locator('.nk-s').nth(b).click();
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => window.__opened), ['drug:d1', 'disease:x1', 'article:a1']);
      assert.equal(await page.locator('#nika-section-content').isVisible(), true, 'the answer stays behind the entry');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'an answer does not widen the page' + tag);

      // not in library
      await send(page, { notFound: true, left: 8 });
      assert.match(await text(page, '.nk-none'), /Not in our library yet/);
      assert.equal(await page.locator('.nk-s').count(), 0);
      assert.deepEqual(await page.$$eval('.nk-src .nk-tool', e => e.map(b => b.textContent)), ['🇬🇧', '↺'], 'nothing to copy when not found');

      // busy keeps the box
      await send(page, { busy: true, left: 8 });
      assert.match(await text(page, '.nk-out'), /Nika is busy[\s\S]*not counted/);
      assert.equal(await page.locator('.nk-form').isVisible(), true);

      // the limit closes the box
      await send(page, { limit: true, left: 0 });
      assert.match(await text(page, '.nk-out'), /That's all for today/);
      assert.equal(await page.locator('.nk-form').isHidden(), true);

      // back to Drugs: the Nika look and panel go, its own tab tint returns
      await page.click('[data-ddtype="drug"]');
      assert.equal(await page.locator('#dd-codex-card.nk-sun').count(), 0);
      assert.equal(await page.locator('#nika-section-content').isHidden(), true);
      assert.equal(await page.$eval('#dd-type-tabs', e => e.dataset.type), 'drug');
      assert.equal(await page.$eval('#dd-codex-title', e => e.style.color), 'rgb(29, 78, 216)');
      await ctx.close();
    }

    // paused on arrival; Thai
    const { page, ctx } = await open(browser, 390, { left: 7, paused: true });
    assert.match(await text(page, '.nk-out'), /Paused during your quiz/);
    assert.equal(await page.locator('.nk-form').isHidden(), true);
    // a pause that ends: reopening the tab gives the box back
    await page.evaluate(() => { window.__peek = { left: 7, paused: false }; document.querySelector('[data-ddtype="drug"]').click(); document.querySelector('[data-ddtype="nika"]').click(); });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.nk-form').isVisible(), true);
    assert.equal(await page.locator('.nk-out .nk-pause').count(), 0);
    await ctx.close();

    const th = await open(browser, 390, { left: 10, paused: false });
    await th.page.evaluate(() => { document.body.classList.add('lang-th-on'); document.getElementById('nika-section-content').textContent = ''; window.nikaAsk.show(); });
    await th.page.waitForTimeout(100);
    assert.deepEqual(await th.page.$eval('#nk-question', e => [e.placeholder, /ห้ามพิมพ์ชื่อผู้ป่วย/.test(e.title)]), ['ถามเรื่องยา โรค หรือบทความ · 🛟 ห้ามใส่ชื่อ / HN', true]);
    assert.equal(await th.page.$eval('.nk-tab', t => t.title), 'Nika · เหลือ 10 คำถามวันนี้');
    await th.ctx.close();
    console.log('PASS: Ask Nika (V101.308 pick C) — icon tab + badge left, 🛟 in the placeholder, ➤, answer + icon-number sources, chips step aside / ↺, 📋 copy, 🇬🇧→🇹🇭→🇰🇷 re-ask (kept), escaped, not in library, busy, limit, paused, Thai, 320 and 390 px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
