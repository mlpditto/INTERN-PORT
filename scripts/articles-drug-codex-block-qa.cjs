// V101.198 (owner: "แบบเดียวกับ #1983" for drugs): the intern's Drug Codex entry lists the articles linked to it with ＋ Codex — ✓ read / new,
// a tap opens the article sheet (the drug detail closes). The REAL index.html + articles.js on a 390 px phone with fake Firestore data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8'), ij = fs.readFileSync('public/articles.js', 'utf8');
assert.ok(/<script src="articles\.js\?v=V101\.19[8-9]" defer><\/script>/.test(idx) || /<script src="articles\.js\?v=V101\.[2-9]\d\d" defer><\/script>/.test(idx), 'cache-buster bumped');
assert.ok(ij.includes('forDrug: function (drugId) {') && ij.includes('function aboutCodex(pred) {'), 'intern: forDrug shares the filter with forDisease');
assert.ok(idx.includes('id="dc-detail-articles"') && idx.includes('function codexPaintArticles(boxId, list, heading) {') && idx.includes('dcPaintArticles(drug._id || drug.id);') && idx.includes('dxPaintArticles(disease._id || disease.id);'), 'index: one painter for both entries');

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const ph = await ctx.newPage();
    const errs = []; ph.on('pageerror', e => { if (!/ServiceWorker|mermaid/.test(e.message)) errs.push(e.message); });
    await ph.addInitScript(() => {
      const facade = { collection: n => window.__fake.collection(n), runTransaction: f => window.__fake.runTransaction(f) };
      const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.__fake = { collection: () => chain, runTransaction: async () => {} };
      window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } }) : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain, apply: () => chain });
    });
    await ph.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await ph.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await ph.waitForFunction(() => window.internArticles && typeof dcOpenDetail === 'function' && typeof dcPaintArticles === 'function' && typeof dxOpenDetail === 'function');
    const r = await ph.evaluate(async () => {
      const D = 864e5, now = Date.now(), wait = ms => new Promise(res => setTimeout(res, ms)), out = {}, writes = [];
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
      const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
      const art = (id, o) => Object.assign({ status: 'scheduled', title: { en: 'T ' + id }, body: { en: 'B ' + id }, cover: { emoji: '📰' }, startAt: { toMillis: () => now - D }, endAt: { toMillis: () => now + D }, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' }, o);
      const docs = {
        a1: art('a1', { title: { en: 'Elobixibat: counsel before breakfast', th: 'เอโลบิซิแบต' }, links: [{ kind: 'codex', id: 'd1', label: 'Elobixibat' }, { kind: 'quiz', id: 'q1', label: 'Constipation quiz' }] }),
        a2: art('a2', { title: { en: 'Chronic constipation: the ladder' }, links: [{ kind: 'codex', id: 'd1', label: 'Elobixibat' }], startAt: { toMillis: () => now - 3 * D } }),
        a3: art('a3', { title: { en: 'Not for me' }, links: [{ kind: 'codex', id: 'd1', label: 'Elobixibat' }], audience: { divisions: ['CU'], groups: [] } }),
        a4: art('a4', { title: { en: 'Hordeolum: the 3-day rule' }, links: [{ kind: 'disease', id: 'h1', label: 'Hordeolum' }] })
      };
      window.__fake = {
        collection: n => ({ where: () => ({ get: async () => ({ docs: Object.keys(docs).map(id => ({ id, data: () => docs[id] })) }) }), doc: id => ({ id, path: n + '/' + id, set: async (v) => { writes.push([n, id, JSON.parse(JSON.stringify(v))]); } }) }),
        runTransaction: async f => f({ get: async () => ({ exists: true }), set: () => {} })
      };
      userId = 'U1'; window.myRegistered = true;
      window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-10-01', articleSeen: { a2: { act: 'ok', at: now - D } }, articlePopDay: internArticles._bkkDay(now) };
      internArticles.onUserDoc(); await wait(2800);
      out.forD1 = internArticles.forDrug('d1'); out.forNone = internArticles.forDrug('zzz'); out.forH1 = internArticles.forDisease('h1').map(x => x.id);
      // the Drug Codex entry
      dcState.codex = [{ _id: 'd1', genericName: 'Elobixibat', atcCode: 'A06AX09', drugClass: 'IBAT inhibitor', brandNames: ['Goofice'], indication: 'Chronic constipation', dosing: 'Adult: 10 mg once daily before breakfast' }, { _id: 'd2', genericName: 'Salbutamol' }];
      dcOpenDetail('d1'); await wait(100);
      const box = document.getElementById('dc-detail-articles');
      out.box = [box.hidden, [...box.querySelectorAll('.dx-art')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), /ยานี้/.test(box.textContent), box.getBoundingClientRect().top < document.getElementById('dc-detail-body').getBoundingClientRect().top, document.getElementById('drugCodexDetailModal').style.display];
      dcOpenDetail('d2'); await wait(50); out.boxNone = [box.hidden, box.innerHTML];
      dcOpenDetail('d1'); await wait(50);
      box.querySelector('.dx-art').click(); await wait(300);
      const sh = document.getElementById('art-sheet');
      out.sheet = [!!sh, sh && sh.querySelector('h3').textContent, document.getElementById('drugCodexDetailModal').style.display, sh && [...sh.querySelectorAll('.art-link')].map(b => b.textContent)];
      sh.querySelector('.ok').click(); await wait(300);
      if (document.querySelector('#art-sheet .anyq')) internArticles.close('ok');   // V101.212: Got it keeps the sheet 7 s for 💬 Any Q? (articles-anyq-qa.cjs) — closed by hand here
      out.read = [!!document.getElementById('art-sheet'), (window.myUserDoc.articleSeen.a1 || {}).act, writes.length > 0];
      dcOpenDetail('d1'); await wait(50);
      out.after = [...box.querySelectorAll('.dx-art')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      // the Disease Codex entry still paints its own block (same painter)
      dcCloseDetail();
      dxState.codex = [{ _id: 'h1', diseaseName: 'Hordeolum' }]; dxOpenDetail('h1'); await wait(50);
      const dxBox = document.getElementById('dx-detail-articles');
      out.dx = [dxBox.hidden, [...dxBox.querySelectorAll('.dx-art')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), /โรคนี้/.test(dxBox.textContent)];
      return out;
    });
    assert.deepEqual(r.forD1, [{ id: 'a1', title: 'Elobixibat: counsel before breakfast', read: false }, { id: 'a2', title: 'Chronic constipation: the ladder', read: true }], 'articles linked to d1 with ＋ Codex, newest first, read state; not the CU-only one: ' + JSON.stringify(r.forD1));
    assert.deepEqual([r.forNone, r.forH1], [[], ['a4']], 'other entries untouched');
    assert.deepEqual(r.box, [false, ['📰 Elobixibat: counsel before breakfast new', '📰 Chronic constipation: the ladder ✓ read'], true, true, 'flex'], 'the drug block: "ยานี้" heading, above the body, in the open modal: ' + JSON.stringify(r.box));
    assert.deepEqual(r.boxNone, [true, ''], 'a drug with no articles hides the block');
    assert.deepEqual(r.sheet.slice(0, 3), [true, 'Elobixibat: counsel before breakfast', 'none'], 'tap → the sheet, the drug detail closed: ' + JSON.stringify(r.sheet));
    assert.deepEqual(r.sheet[3], ['💊 Elobixibat', '🧪 Constipation quiz 🪙 +1'], 'the sheet keeps its links');
    assert.deepEqual(r.read, [false, 'ok', true], '👍 Got it = read, written');
    assert.deepEqual(r.after, ['📰 Elobixibat: counsel before breakfast ✓ read', '📰 Chronic constipation: the ladder ✓ read'], 'back in the drug entry it is ✓ read');
    assert.deepEqual(r.dx, [false, ['📰 Hordeolum: the 3-day rule new'], true], 'the disease block still works with the shared painter');
    assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
    console.log('PASS: the intern Drug Codex entry lists the articles linked to it (＋ Codex): ✓ read / new, hidden when none, tap → sheet → read; the disease block shares the painter');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
