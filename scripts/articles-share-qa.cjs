// V101.291 (owner pick C, mockup-article-share.html): a History article row — the language pill sits after the title (no longer over the body),
// and the Source line ends in · 📤 LINE f. The first share of an article adds 0.1 to users.score once (nothing said on screen); after a share
// only the icon tapped turns wave blue (no pill around both); articleSeen[id].shared = ['line', 'fb'] tells the admin. Facebook only with a Source link. A cancelled LINE picker is not a share.
// The REAL index.html (articles.js + history-lean.js) on a phone, with a fake Firestore (nothing leaves the page).
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const D = 864e5;
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
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
    const o = await page.evaluate(async ({ D }) => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
      const wait = ms => new Promise(res => setTimeout(res, ms)), now = Date.now();
      const store = {}, sets = [];   // users/U1 as the transaction sees it
      window.__fake = {
        collection: n => ({ where: () => ({ get: async () => ({ docs: [] }), onSnapshot: () => () => {} }), doc: id => ({ id, set: async () => {}, get: async () => ({ exists: false }) }) }),
        runTransaction: async f => f({
          get: async () => ({ exists: true, data: () => JSON.parse(JSON.stringify(store)) }),
          set: (ref, v) => { sets.push(JSON.parse(JSON.stringify(v))); for (const [k, x] of Object.entries(v.articleSeen || {})) { store.articleSeen = store.articleSeen || {}; store.articleSeen[k] = Object.assign({}, store.articleSeen[k], x); } }
        })
      };
      const opened = []; window.open = (u) => { opened.push(u); return null; };
      userId = 'U1'; window.myRegistered = true;
      window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-09-01', articleSeen: { a: { act: 'ok', at: now - 60000 }, b: { act: 'ok', at: now - 120000 } } };
      const art = (id, o) => Object.assign({ id, status: 'scheduled', title: { en: 'Title ' + id, th: 'ชื่อ ' + id }, body: { en: '**Bold** first line\nmore', th: 'ไทย' }, startAt: now - D, endAt: now + D, audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 1 }, o);
      internArticles._S.list = [art('a', { source: { url: 'https://thematter.co/x?y=1', site: 'Thematter' } }), art('b')];
      renderUnifiedHistory(internArticles.historyItems()); await wait(100);
      const row = id => document.querySelector('[data-delete-item="art_' + id + '"]') || [...document.querySelectorAll('[data-delete-type="article"]')].find(r => r.querySelector('.art-hist[data-art="' + id + '"]'));
      const out = {};
      const ra = row('a');
      const fl = ra.querySelector('.hl-tt .art-tfl');
      out.flagClosed = fl && getComputedStyle(fl).display;
      ra.click(); await wait(50);
      out.flagOpen = [getComputedStyle(fl).display, fl.textContent, !ra.querySelector('.art-top')];
      const sh = ra.querySelector('.art-src .art-sh');
      out.icons = sh && [...sh.querySelectorAll('button')].map(b => b.className + ':' + b.textContent);
      out.onBefore = sh.querySelectorAll('.on').length;
      // the pill still swaps the body in place
      fl.click(); await wait(20);
      out.swap = [ra.querySelector('.art-md').textContent.trim(), ra.querySelector('.hl-tt .art-tfl').dataset.lang, ra.getAttribute('aria-expanded')];
      ra.querySelector('.hl-tt .art-tfl').click(); await wait(20);
      // LINE outside LINE: the line.me share page; first share → +0.1
      ra.querySelector('.art-sh .ln').click(); await wait(50);
      out.line = [opened[0], JSON.stringify(sets[0]), [...ra.querySelectorAll('.art-sh .on')].map(b => b.dataset.sh).join(), getComputedStyle(ra.querySelector('.art-sh .ln')).backgroundImage, window.myUserDoc.articleSeen.a.act, getComputedStyle(ra.querySelector('.art-sh')).backgroundColor];
      // Facebook after: the sharer page; no second +0.1
      ra.querySelector('.art-sh .fb').click(); await wait(50);
      out.fb = [opened[1], JSON.stringify(sets[1]), [...ra.querySelectorAll('.art-sh .on')].map(b => b.dataset.sh).join()];
      // b: no Source link → LINE only, the text carries the title + first line
      const rb = row('b'); rb.click(); await wait(50);
      out.bIcons = [...rb.querySelectorAll('.art-sh button')].map(b => b.className);
      out.bSrc = rb.querySelector('.art-src').textContent.trim();
      // in LINE: a cancelled picker is not a share; a sent one is
      window.liff = { isApiAvailable: () => true, isInClient: () => false, shareTargetPicker: async () => false };
      rb.querySelector('.art-sh .ln').click(); await wait(50);
      out.cancel = [sets.length, rb.querySelectorAll('.art-sh .on').length];
      const sent = []; window.liff.shareTargetPicker = async m => { sent.push(m); return { status: 'success' }; };
      rb.querySelector('.art-sh .ln').click(); await wait(50);
      out.picked = [sent[0] && sent[0][0].text, JSON.stringify(sets[2]), rb.querySelectorAll('.art-sh .ln.on').length];
      // re-drawn History keeps the blue
      renderUnifiedHistory(internArticles.historyItems()); await wait(50);
      row('a').click(); await wait(30);
      out.redraw = [...row('a').querySelectorAll('.art-sh .on')].map(b => b.dataset.sh).join();
      // not registered: no write
      window.myRegistered = false; internArticles._S.list.push(art('c')); window.myUserDoc.articleSeen.c = { act: 'ok', at: now };
      delete window.liff; await internArticles.share('c', 'line');
      out.unreg = sets.length;
      return out;
    }, { D });
    assert.equal(o.flagClosed, 'none', 'the pill shows only on an open row');
    assert.deepEqual(o.flagOpen, ['inline-block', '🇬🇧', true], 'open row: the pill after the title, no floating box');
    assert.deepEqual(o.icons, ['ln:LINE', 'fb:f'], 'Source line: 📤 LINE f');
    assert.equal(o.onBefore, 0);
    assert.deepEqual(o.swap, ['ไทย', 'th', 'true'], 'the pill swaps the body, the row stays open');
    assert.equal(o.line[0], 'https://line.me/R/share?text=' + encodeURIComponent('Title a\nhttps://thematter.co/x?y=1'));
    assert.deepEqual(JSON.parse(o.line[1]), { articleSeen: { a: { shared: ['line'], sharedAt: 'TS' } }, score: { inc: 0.1 } }, 'first share: +0.1 once');
    assert.equal(o.line[2], 'line', 'only the LINE icon turns blue');
    assert.match(o.line[3], /rgb\(4, 97, 196\).*rgb\(62, 166, 239\)/, 'wave blue gradient');
    assert.equal(o.line[4], 'ok', 'the read state is kept');
    assert.equal(o.line[5], 'rgba(0, 0, 0, 0)', 'no pill behind the icons');
    assert.equal(o.fb[0], 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent('https://thematter.co/x?y=1'));
    assert.deepEqual(JSON.parse(o.fb[1]), { articleSeen: { a: { shared: ['line', 'fb'], sharedAt: 'TS' } } }, 'second share: no more score');
    assert.equal(o.fb[2], 'line,fb');
    assert.deepEqual(o.bIcons, ['ln'], 'no Source link: LINE only');
    assert.match(o.bSrc, /^·\s*📤\s*LINE$/);
    assert.deepEqual(o.cancel, [2, 0], 'a cancelled picker: nothing written, not blue');
    assert.equal(o.picked[0], '📰 Title b\nBold first line');
    assert.deepEqual(JSON.parse(o.picked[1]), { articleSeen: { b: { shared: ['line'], sharedAt: 'TS' } }, score: { inc: 0.1 } });
    assert.equal(o.picked[2], 1);
    assert.equal(o.redraw, 'line,fb', 'still blue after History re-draws');
    assert.equal(o.unreg, 3, 'not registered: nothing written');
    assert.deepEqual(errors, []);
    console.log('PASS: History article — pill after the title; · 📤 LINE f on the Source line; +0.1 once per article; only the tapped icon turns wave blue; FB only with a link; cancelled picker = no share');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
