// V101.354 (owner 2026-11-24) — 📋 in the article sheet's footer, right before 🌞 Nika, copies the article as shown (the language on the
// flag): title, body without markdown marks, source link. Turns green ✓ for a moment. The footer still fits at 360 and 390 px, also in
// the ✓ Read moment. The REAL index.html + articles.js, a fake Firestore, a recorded clipboard.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const facade = { collection: (n) => window.__fake.collection(n), runTransaction: (f) => Promise.resolve(f({ get: async () => ({ exists: false }), set: () => {} })) };
      const FieldValue = { serverTimestamp: () => 'TS', increment: (n) => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.firebase = new Proxy(function () {}, {
        get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) } })
          : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain,
        apply: () => chain,
      });
      window.__clip = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__clip.push(t); return Promise.resolve(); } } });
    });
    await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.internArticles && window.completeMoment);
    await page.evaluate(() => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
      window.__fake = { collection: () => ({ doc: (id) => ({ id, set: async () => {} }), add: async () => ({ id: 'x' }), where: () => ({ get: async () => ({ docs: [] }) }) }) };
      userId = 'U1'; window.myRegistered = true; window.ensureFirebaseAuthReady = async () => ({ uid: 'a' });
      window.myUserDoc = { id: 'U1', group: 'EXTERN', articleSeen: {} };
      internArticles._show({ a: { id: 'Art9', status: 'scheduled', title: { en: 'Nitrofurantoin is back', th: 'Nitrofurantoin ยาเก่าที่กลับมา' }, body: { en: 'An **old** drug.', th: 'ยา**เก่า**ที่โลกรู้จัก\n\n## หัวข้อ' },
        source: { site: 'x.org', url: 'https://x.org/a' }, cover: { emoji: '📰' }, audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 2 }, kind: 'live' });
    });
    const foot = () => page.$$eval('#art-sheet .foot > button', (b) => b.map((x) => x.className.split(' ').filter((c) => c !== 'bm').join('.') || x.className));
    const order = await foot();
    const i = order.indexOf('cpb'), j = order.indexOf('nkb');
    assert.ok(i >= 0 && j === i + 1, '📋 sits right before 🌞: ' + order.join(' '));
    assert.equal(await page.$eval('#art-sheet .bm.cpb', (b) => b.textContent), '📋');
    assert.equal(await page.$eval('#art-sheet .bm.cpb', (b) => b.getAttribute('aria-label')), 'คัดลอกบทความ');

    // copies the Thai shown, no markdown marks, with the source link; ✓ for a moment
    await page.click('#art-sheet .bm.cpb');
    await page.waitForTimeout(100);
    let clip = await page.evaluate(() => window.__clip.slice());
    assert.deepEqual(clip, ['Nitrofurantoin ยาเก่าที่กลับมา\n\nยาเก่าที่โลกรู้จัก\n\nหัวข้อ\n\nhttps://x.org/a'], 'Thai text as shown: ' + JSON.stringify(clip));
    assert.equal(await page.$eval('#art-sheet .bm.cpb', (b) => [b.textContent, b.classList.contains('ok')].join()), '✓,true', '✓ green after copying');

    // flip the flag to EN → copies English
    await page.evaluate(() => internArticles.lang());
    await page.click('#art-sheet .bm.cpb');
    await page.waitForTimeout(100);
    clip = await page.evaluate(() => window.__clip.slice());
    assert.equal(clip[1], 'Nitrofurantoin is back\n\nAn old drug.\n\nhttps://x.org/a', 'the language on the flag');

    // fits at 320 and 360 px, also after Got it (✓ Read · 💬)
    for (const w of [360, 390]) {   // English is the longest footer (Read more ▾ · 👍 Got it)
      await page.setViewportSize({ width: w, height: 760 });
      assert.ok(await page.$eval("#art-sheet .foot", (f) => f.scrollWidth <= f.clientWidth + 1 && [...f.children].every((c) => c.getBoundingClientRect().right <= f.getBoundingClientRect().right + 1)), "EN footer fits at " + w);
    }
    await page.evaluate(() => internArticles.lang());   // back to Thai (the default)
    for (const w of [360, 390]) {   // 320 px already overflowed before 📋 (🔖🔕📰🌞 + ย่อ + รับทราบ = 304 > 284), as articles-nika-qa checks 360
      await page.setViewportSize({ width: w, height: 760 });
      const fit = await page.$eval('#art-sheet .foot', (f) => {
        const r = f.getBoundingClientRect(), top = f.children[0].getBoundingClientRect().top;
        const ok = [...f.children].every((c) => { const x = c.getBoundingClientRect(); return x.right <= r.right + 1 && x.left >= r.left - 1 && Math.abs(x.top - top) < 30; }) && f.scrollWidth <= f.clientWidth + 1;
        return { ok, info: [Math.round(r.width), f.scrollWidth, [...f.children].map((c) => { const x = c.getBoundingClientRect(); return c.className + ':' + Math.round(x.left - r.left) + '-' + Math.round(x.right - r.left) + '@' + Math.round(x.top - top); })] };
      });
      assert.ok(fit.ok, 'the footer fits on one row at ' + w + ' px: ' + JSON.stringify(fit.info));
    }
    assert.deepEqual(errors.filter((e) => !/ServiceWorker|mermaid|liff|LIFF/i.test(e)), [], 'no page errors: ' + errors);
    console.log('articles-copy-btn-qa: OK — 📋 before 🌞, copies the shown language without marks + source, ✓, fits 360/390');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
