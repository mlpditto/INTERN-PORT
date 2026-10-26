// V102.372 + V101.197 (owner's pick "1 + 2"): ＋ Disease in the article's Links = a published Disease Codex entry picked by hand (no AI);
// the intern's Disease Codex entry lists the articles about it (drafted from it or linked to it) with ✓ read / new, a tap opens the sheet.
// The REAL admin.html + articles-admin.js, and the REAL index.html + articles.js on a 390 px phone, with fake Firestore data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8'), aj = fs.readFileSync('public/articles-admin.js', 'utf8'), idx = fs.readFileSync('public/index.html', 'utf8'), ij = fs.readFileSync('public/articles.js', 'utf8');
assert.ok(/<script src="articles-admin\.js\?v=V102\.(?:3[7-9]\d|[4-9]\d\d)"><\/script>/.test(admin) && /<script src="articles\.js\?v=V101\.(?:19[7-9]|[2-9]\d\d)" defer><\/script>/.test(idx), 'cache-busters bumped');
assert.ok(aj.includes("function diseases() {") && aj.includes("chip('＋ Disease', S.pick === 'disease'"), 'admin: the disease source + chip');
assert.ok(ij.includes('forDisease: function (diseaseId) {') && ij.includes("l.kind === 'disease'"), 'intern: forDisease + the 🩺 link');
assert.ok(idx.includes('id="dx-detail-articles"') && idx.includes('function dxPaintArticles(diseaseId) {') && idx.includes('dxPaintArticles(disease._id || disease.id);'), 'index: the articles block is painted on every detail render');

(async () => {
  const browser = await chromium.launch();
  try {
    // ---------- admin: ＋ Disease
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errA = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errA.push(e.message); });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(pathToFileURL(path.resolve('public/admin.html')).href);
    await page.waitForFunction(() => window.Articles && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');
    const a = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const reads = [];
      window.db = { collection: coll => ({ get: async () => { reads.push(coll); return { docs: coll === 'disease_codex' ? [{ id: 'h1', data: () => ({ diseaseName: 'Hordeolum', thaiName: 'กุ้งยิง' }) }, { id: 'n1', data: () => ({ diseaseName: 'Neuropathic Pain' }) }, { id: 'bad', data: () => ({}) }] : [] }; }, doc: id => ({ update: async () => {} }) }) };
      const S = Articles._S; S.loaded = true; S.loading = false;
      S.list = [{ id: 'a2', title: { en: 'Hordeolum: the 3-day rule' }, body: { en: 'Warm compress.' }, cover: { emoji: '📰' }, status: 'scheduled', startAt: Date.now() + 864e5, endAt: Date.now() + 8 * 864e5, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' }];
      Articles.open(); Articles.edit('a2'); S.open = { links: true }; Articles.sec && Articles.sec('links', true);
      const out = {};
      out.chips = qa('.art-c.art-add').map(b => b.textContent.trim());
      Articles.openPick('disease'); await wait(50);
      out.pick = [S.pick, reads.filter(c => c === 'disease_codex'), (q('#art-pk-q') || {}).placeholder, qa('.art-pk .opts button').map(b => b.textContent)];   // (the editor prefetches drug_codex on its own)
      Articles.pickQ('neuro'); out.filtered = qa('.art-pk .opts button').map(b => b.textContent);
      Articles.addLink('disease', 'h1');
      out.links = [S.cur.links, S.pick, qa('.art-lk').map(s => s.textContent.replace('✕', '').trim()), qa('.art-lk').map(s => s.className)];
      Articles.openPick('disease'); out.again = qa('.art-pk .opts button').map(b => b.textContent);   // the linked one is no longer offered
      out.doc = Articles._toDoc(S.cur, 'scheduled').links;
      // the drug picker is untouched
      Articles.openPick('codex'); await wait(50); out.drug = [(q('#art-pk-q') || {}).placeholder, reads.slice(-1)[0]];
      Articles.close();
      return out;
    });
    assert.ok(a.chips.includes('＋ Disease') && a.chips.indexOf('＋ Disease') === a.chips.indexOf('＋ Codex') + 1, '＋ Disease sits after ＋ Codex: ' + a.chips);
    assert.deepEqual(a.pick, ['disease', ['disease_codex'], '🩺 Find a disease…', ['🩺 Hordeolum · กุ้งยิง', '🩺 Neuropathic Pain']], 'the picker reads disease_codex once; entries without a name are skipped: ' + JSON.stringify(a.pick));
    assert.deepEqual(a.filtered, ['🩺 Neuropathic Pain'], 'search filters');
    assert.deepEqual(a.links, [[{ kind: 'disease', id: 'h1', label: 'Hordeolum · กุ้งยิง' }], '', ['🩺 Hordeolum · กุ้งยิง'], ['art-lk disease']], 'the link: kind disease, 🩺 in the Links line, picker closed: ' + JSON.stringify(a.links));
    assert.deepEqual(a.again, ['🩺 Neuropathic Pain'], 'a linked disease is not offered twice');
    assert.deepEqual(a.doc, [{ kind: 'disease', id: 'h1', label: 'Hordeolum · กุ้งยิง' }], 'toDoc keeps the disease link');
    assert.deepEqual(a.drug, ['💊 Find a drug…', 'drug_codex'], 'the drug picker still reads drug_codex');
    assert.deepEqual(errA, [], 'admin: no page errors: ' + errA.join(' | '));
    await page.close();

    // ---------- intern: the 🩺 link in the sheet + the Codex entry's articles block
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const ph = await ctx.newPage();
    const errI = []; ph.on('pageerror', e => errI.push(e.message));
    await ph.addInitScript(() => {
      const facade = { collection: n => window.__fake.collection(n), runTransaction: f => window.__fake.runTransaction(f) };
      const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.__fake = { collection: () => chain, runTransaction: async () => {} };
      window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } }) : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain, apply: () => chain });
    });
    await ph.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await ph.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await ph.waitForFunction(() => window.internArticles && typeof dxOpenDetail === 'function' && typeof dxPaintArticles === 'function');
    const r = await ph.evaluate(async () => {
      const D = 864e5, now = Date.now(), wait = ms => new Promise(res => setTimeout(res, ms)), out = {}, writes = [];
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
      const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
      const art = (id, o) => Object.assign({ status: 'scheduled', title: { en: 'T ' + id }, body: { en: 'B ' + id }, cover: { emoji: '📰' }, startAt: { toMillis: () => now - D }, endAt: { toMillis: () => now + D }, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' }, o);
      const docs = {
        a1: art('a1', { title: { en: 'Hordeolum: the 3-day rule', th: 'กุ้งยิง 3 วัน' }, links: [{ kind: 'disease', id: 'h1', label: 'Hordeolum · กุ้งยิง' }, { kind: 'quiz', id: 'q1', label: 'Eye quiz' }] }),
        a2: art('a2', { title: { en: 'Red eye: when to refer' }, dx: { draftId: 'd2', publishedId: 'h1', name: 'Hordeolum' }, startAt: { toMillis: () => now - 3 * D } }),
        a3: art('a3', { title: { en: 'Old hordeolum tips' }, dx: { draftId: 'd3', publishedId: 'h1', name: 'Hordeolum' }, startAt: { toMillis: () => now - 40 * D }, endAt: { toMillis: () => now - 34 * D } }),   // ended before this intern joined; rerun any → still for them
        a4: art('a4', { title: { en: 'Not for me' }, dx: { draftId: 'd4', publishedId: 'h1', name: 'Hordeolum' }, audience: { divisions: ['CU'], groups: [] } }),
        a5: art('a5', { title: { en: 'Another disease' }, links: [{ kind: 'disease', id: 'n1', label: 'Neuropathic Pain' }] })
      };
      window.__fake = {
        collection: n => ({ where: () => ({ get: async () => ({ docs: Object.keys(docs).map(id => ({ id, data: () => docs[id] })) }) }), doc: id => ({ id, path: n + '/' + id, set: async (v, o) => { writes.push([n, id, JSON.parse(JSON.stringify(v))]); } }) }),
        runTransaction: async f => f({ get: async () => ({ exists: true }), set: () => {} })
      };
      userId = 'U1'; window.myRegistered = true;
      window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-10-01', articleSeen: { a2: { act: 'ok', at: now - D } }, articlePopDay: internArticles._bkkDay(now) };   // already had today's popup → none opens by itself
      const spy = []; window.dxOpenDetail_spy = spy;
      internArticles.onUserDoc(); await wait(2800);
      out.loaded = !!internArticles.forDisease;
      out.forH1 = internArticles.forDisease('h1'); out.forN1 = internArticles.forDisease('n1'); out.forNone = internArticles.forDisease('zzz');
      // the Codex entry
      dxState.codex = [{ _id: 'h1', diseaseName: 'Hordeolum', thaiName: 'กุ้งยิง', icd10: 'H00.0', category: 'Ophthalmology', symptoms: '- lump' }, { _id: 'n1', diseaseName: 'Neuropathic Pain' }, { _id: 'x1', diseaseName: 'Nothing' }];
      dxOpenDetail('h1'); await wait(100);
      const box = document.getElementById('dx-detail-articles');
      out.box = [box.hidden, [...box.querySelectorAll('.dx-art')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), box.getBoundingClientRect().top < document.getElementById('dx-detail-body').getBoundingClientRect().top];
      dxOpenDetail('x1'); await wait(50); out.boxNone = [box.hidden, box.innerHTML];
      dxOpenDetail('h1'); await wait(50);
      // tap the first (unread) article → the sheet opens on top, the Codex detail closes; ✓ Got it = read
      box.querySelector('.dx-art').click(); await wait(300);
      const sh = document.getElementById('art-sheet');
      out.sheet = [!!sh, sh && sh.querySelector('h3').textContent, document.getElementById('diseaseCodexDetailModal').style.display, sh && [...sh.querySelectorAll('.art-link')].map(b => b.textContent)];
      sh.querySelector('.ok').click(); await wait(300);
      if (document.querySelector('#art-sheet .anyq')) internArticles.close('ok');   // V101.212: Got it keeps the sheet 7 s for 💬 Any Q? (articles-anyq-qa.cjs) — closed by hand here
      out.read = [!!document.getElementById('art-sheet'), (window.myUserDoc.articleSeen.a1 || {}).act, writes.length > 0];
      dxOpenDetail('h1'); await wait(50);
      out.after = [...box.querySelectorAll('.dx-art')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      // the 🩺 link in the sheet → dxOpenDetail
      window.dxOpenDetail = id => spy.push(id);
      internArticles.openArticle('a2'); await wait(200);
      out.again = [!!document.getElementById('art-sheet'), document.getElementById('art-sheet') && document.getElementById('art-sheet').querySelector('h3').textContent];
      const dxBtn = [...document.querySelectorAll('#art-sheet .art-link')].find(b => /🩺/.test(b.textContent)); if (dxBtn) dxBtn.click(); await wait(200);
      out.dxTap = [spy, !!document.getElementById('art-sheet')];
      return out;
    });
    assert.equal(r.loaded, true);
    assert.deepEqual(r.forH1, [{ id: 'a1', title: 'Hordeolum: the 3-day rule', read: false }, { id: 'a2', title: 'Red eye: when to refer', read: true }, { id: 'a3', title: 'Old hordeolum tips', read: false }], 'articles about h1: linked by hand + drafted from it, newest first, read state; not the CU-only one: ' + JSON.stringify(r.forH1));
    assert.deepEqual([r.forN1.map(x => x.id), r.forNone], [['a5'], []], 'other entries');
    assert.deepEqual(r.box, [false, ['📰 Hordeolum: the 3-day rule new', '📰 Red eye: when to refer ✓ read', '📰 Old hordeolum tips new'], true], 'the block sits above the body with ✓ read / new: ' + JSON.stringify(r.box));
    assert.deepEqual(r.boxNone, [true, ''], 'an entry with no articles hides the block');
    assert.deepEqual(r.sheet.slice(0, 3), [true, 'Hordeolum: the 3-day rule', 'none'], 'tap → the article sheet, the Codex detail closed: ' + JSON.stringify(r.sheet));
    assert.deepEqual(r.sheet[3], ['🩺 Hordeolum · กุ้งยิง', '🧪 Eye quiz 🪙 +1'], 'the sheet shows the hand-picked 🩺 link first');
    assert.deepEqual(r.read, [false, 'ok', true], '👍 Got it = read, written to users/{uid}');
    assert.deepEqual(r.after, ['📰 Hordeolum: the 3-day rule ✓ read', '📰 Red eye: when to refer ✓ read', '📰 Old hordeolum tips new'], 'back in the Codex the article is ✓ read');
    assert.deepEqual(r.again, [true, 'Red eye: when to refer'], 'openArticle opens a read article too');
    assert.deepEqual(r.dxTap, [['h1'], false], 'the 🩺 link in the sheet opens the entry and closes the sheet');
    assert.deepEqual(errI.filter(e => !/ServiceWorker|mermaid/.test(e)), [], 'intern: no page errors: ' + errI.join(' | '));
    console.log('PASS: ＋ Disease link (admin picker from disease_codex, 🩺 in Links, toDoc) + the intern Codex entry lists its articles (✓ read / new, tap → sheet → read) + the 🩺 link in the sheet');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
