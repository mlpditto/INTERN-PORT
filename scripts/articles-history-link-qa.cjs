// V101.269 (owner pick A, mockups/article-history-link-mockup.html): 📰 in the article sheet's footer → every article in Work ▸ History
// (📰 chip on). The REAL public/articles.js inside the REAL index.html on a phone, with a fake Firestore (nothing leaves the page).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<script src="articles\.js\?v=V101\.\d+" defer><\/script>/.test(html), 'the module is loaded');
const D = 864e5;
(async () => {
  const browser = await chromium.launch();
  try {
    const out = {};
    for (const width of [360, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        const facade = { collection: n => window.__fake.collection(n), runTransaction: f => window.__fake.runTransaction(f) };
        const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
        const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
        window.firebase = new Proxy(function () {}, {
          get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } })
            : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain,
          apply: () => chain
        });
      });
      await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
      await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
      await page.waitForFunction(() => window.internArticles && typeof renderUnifiedHistory === 'function');
      out[width] = await page.evaluate(async ({ D }) => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
        const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
        const writes = [], now = Date.now(), wait = ms => new Promise(res => setTimeout(res, ms));
        window.__fake = {
          collection: n => ({ where: () => ({ get: async () => ({ docs: [] }), onSnapshot: () => () => {} }), doc: id => ({ id, set: async v => { writes.push([n, id, JSON.parse(JSON.stringify(v))]); } }) }),
          runTransaction: async () => {}
        };
        userId = 'U1'; window.myRegistered = true;
        window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-09-01', articleSeen: { b: { act: 'ok', at: now - 3 * D } } };
        const art = (id, o) => Object.assign({ id, status: 'scheduled', title: { en: 'Title ' + id }, body: { en: 'Body ' + id }, startAt: now - D, endAt: now + D, audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 2 }, o);
        const A = internArticles;
        A._S.list = [art('a'), art('b', { startAt: now - 9 * D, endAt: now - 8 * D }), art('c', { startAt: now - 2 * D })];
        const sheet = () => document.getElementById('art-sheet');
        const fits = () => {
          const f = sheet().querySelector('.foot'), r = f.getBoundingClientRect();
          return [...f.children].filter(c => getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden')
            .every(c => { const b = c.getBoundingClientRect(); return b.right <= r.right + 0.5 && b.left >= r.left - 0.5 && b.top < r.top + r.height / 2 && b.bottom > r.top + r.height / 2; });
        };
        const o = {};
        A._show({ a: A._S.list[0], kind: 'live' }); await wait(50);
        const h = sheet().querySelector('.foot .bm.hist');
        o.btn = h && [h.firstChild.textContent, h.querySelector('i') && h.querySelector('i').textContent, h.getAttribute('aria-label'), h.previousElementSibling.classList.contains('mute')];
        o.badge = h && h.querySelector('i') && getComputedStyle(h.querySelector('i')).backgroundColor;
        o.fits = fits();
        A.gotIt(); await wait(50); o.btnGot = !!sheet().querySelector('.foot .bm.hist');
        await A.close('ok'); await wait(50);
        // a fresh sheet, then 📰: the sheet goes (not read), Work ▸ History opens with the 📰 chip on
        A._show({ a: A._S.list[2], kind: 'live' }); await wait(50);
        writes.length = 0;
        const work = document.getElementById('work-section-content'); work.style.display = 'none';
        sheet().querySelector('.foot .bm.hist').click(); await wait(300);
        const on = document.querySelector('#unified-type-filters .hl-chip.on');
        o.after = { sheet: !!sheet(), back: !!document.getElementById('art-back'), work: work.style.display, pane: document.getElementById('work-pane-history').classList.contains('active'),
          filter: unifiedCurrentFilter, chip: on ? on.dataset.filter : '', seen: writes.filter(w => w[0] === 'users').map(w => JSON.stringify(w[2])).join(' ') };
        return o;
      }, { D });
      out[width].errors = errors;
      await ctx.close();
    }
    for (const w of [360, 390]) {
      const o = out[w];
      assert.deepEqual(o.btn, ['📰', '3', 'All articles in History (3)', true], w + ': 📰 right after 🔕 with how many articles History has: ' + JSON.stringify(o.btn));
      assert.equal(o.badge, 'rgb(67, 97, 238)', 'the count is the indigo badge');
      assert.ok(o.fits, w + ' px: the footer row still fits on one line');
      assert.equal(o.btnGot, false, 'not in the 7 s ✓ Read · 💬 moment (that row is full; the sheet closes itself)');
      assert.equal(o.after.sheet || o.after.back, false, 'the sheet and its backdrop close');
      assert.deepEqual([o.after.work, o.after.pane, o.after.filter, o.after.chip], ['block', true, 'article', 'article'], 'Work opens on History with the 📰 chip on: ' + JSON.stringify(o.after));
      assert.match(o.after.seen, /"act":"x"/, 'leaving via 📰 = closed, not read (it comes back): ' + o.after.seen);
      assert.deepEqual(o.errors, [], 'no page errors: ' + o.errors.join(' | '));
    }
    console.log('PASS: article 📰 → History (V101.269) — 📰 + count after 🔕, fits on one row at 360/390, hidden in the 7 s ✓ Read · 💬 moment, closes the sheet as not read, opens Work ▸ History on the 📰 chip');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
