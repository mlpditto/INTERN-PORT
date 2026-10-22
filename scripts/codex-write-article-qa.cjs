// V102.379 (owner's pick 5): 📰 Write article on every published Disease Codex row — AI condenses the monograph into a 3–5 line article
// (EN / TH / KO + cover emoji) saved as an Articles DRAFT linked back to the entry (dx.publishedId + a disease link); the entry remembers
// it (articleId / articleTitle) so the row's 📰 chip shows; the Articles editor opens on it. The REAL admin.html with a fake Firestore,
// a fake AI and the Articles module's open/edit stubbed (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.match(html, /<title>Nika Admin \(V102\.(?:379|3[89]\d|[4-9]\d\d)\)<\/title>/, 'admin V102.379+');
assert.ok(html.includes('window.dxaWriteArticle = async function (id, btn) {') && html.includes('function dxaBuildArticlePrompt(d) {'), 'the writer + its prompt');
assert.ok(html.includes("if (disease.sourceArticleId || disease.articleId) chips.push(dxaArticleChipHtml(disease));"), 'the 📰 chip shows for either direction');
assert.ok(!/\$\{dxaMatBtnHtml\(disease\)\}\s*<button type="button" class="dca-row-edit-btn"/.test(html), 'the 📰 button sits between the materials button and Edit');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof window.dxaWriteArticle === 'function' && typeof dxaRenderPublishedList === 'function' && document.readyState === 'complete');
    const r = await page.evaluate(async () => {
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const toasts = []; window.showToast = m => toasts.push(m);
      window.adminApp = { auth: () => ({ currentUser: { uid: 'admin1', email: 'a@x.test' } }) }; window.auth = window.adminApp.auth();
      const writes = []; let addId = 'art9';
      window.db = { collection: coll => ({ add: async d => { writes.push(['add', coll, d]); return { id: addId }; }, doc: id => ({ update: async d => { writes.push(['update', coll, id, d]); }, get: async () => ({ exists: false }) }), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) };
      const opened = []; Articles.load = async () => {}; Articles.open = () => opened.push('open'); Articles.edit = id => opened.push(id);
      const AI = { title: { en: 'Acromegaly: the subtle signs 🔍', th: 'อะโครเมกาลี: สัญญาณที่มองข้าม', ko: '말단비대증: 놓치기 쉬운 징후' }, body: { en: 'Line one about **GH excess**.\nLine two.\nLine three.', th: 'บรรทัดหนึ่ง\nบรรทัดสอง\nบรรทัดสาม', ko: '첫째 줄\n둘째 줄\n셋째 줄' }, emoji: '🧠' };
      const prompts = []; window.callUniversalAI = async (model, prompt, isJson, a, k, opts) => { prompts.push({ model, prompt, isJson, feature: opts && opts.feature }); return { text: JSON.stringify(AI), model: 'm1' }; };
      dxaState.codex = [
        { _id: 'd1', diseaseName: 'Acromegaly', thaiName: 'อะโครเมกาลี', icd10: 'E22.0', category: 'Endocrine', pathophysiology: 'GH excess from a pituitary adenoma.', treatment: 'Transsphenoidal surgery; somatostatin analogues.', redFlags: 'Visual field loss', references: ['ref1'] },
        { _id: 'h1', diseaseName: 'Hordeolum', sourceArticleId: 'a7', sourceArticleTitle: 'Hordeolum: the 3-day rule' }
      ];
      dxaState.searchTerm = '';
      dxaRenderPublishedList();
      const out = {};
      const row = name => qa('#dxa-list .dca-row').find(r => r.querySelector('.dca-row-name').textContent === name);
      out.rows = [qa('#dxa-list .dxa-art-btn').length, !!row('Hordeolum').querySelector('.dxa-art-chip'), !row('Acromegaly').querySelector('.dxa-art-chip'), (row('Hordeolum').querySelector('.dxa-art-chip') || {}).title];
      const order = [...row('Acromegaly').querySelectorAll('.dca-row-actions button')].map(b => b.textContent.trim());
      out.order = order;
      // Cancel at the confirm → nothing
      window.confirm = () => false;
      await dxaWriteArticle('d1', row('Acromegaly').querySelector('.dxa-art-btn'));
      out.cancel = [prompts.length, writes.length, toasts.length];
      // OK → one AI call, an articles draft + the entry stamped, chip, editor opened
      window.confirm = () => true;
      await dxaWriteArticle('d1', row('Acromegaly').querySelector('.dxa-art-btn'));
      const add = writes.find(w => w[0] === 'add'), upd = writes.find(w => w[0] === 'update');
      out.run = { prompts: prompts.length, feature: prompts[0].feature, isJson: prompts[0].isJson, promptHas: ['FORMAT CONTRACT', 'DISEASE: Acromegaly (อะโครเมกาลี) · ICD-10 E22.0 · Endocrine', 'pathophysiology: GH excess', 'treatment: Transsphenoidal', 'body.th Thai only', 'SELF-CHECK'].map(s => prompts[0].prompt.includes(s)), refsOut: !prompts[0].prompt.includes('ref1'),
        add: add && [add[1], add[2].status, add[2].title, add[2].body.en.split('\n').length, add[2].cover, add[2].links, add[2].dx, add[2].aiDrafted, add[2].createdBy, add[2].startAt instanceof Date && add[2].endAt instanceof Date, add[2].readMin, add[2].createdAt],
        upd: upd && [upd[1], upd[2], upd[3]], opened: opened.slice(), toast: toasts[toasts.length - 1],
        chip: (row('Acromegaly').querySelector('.dxa-art-chip') || {}).title, btnTitle: row('Acromegaly').querySelector('.dxa-art-btn').title };
      // already has one → Cancel opens the existing article, no AI
      opened.length = 0; const n = prompts.length; window.confirm = () => false;
      await dxaWriteArticle('d1', row('Acromegaly').querySelector('.dxa-art-btn'));
      out.again = [prompts.length - n, opened.slice()];
      // invalid JSON twice → error toast, button back
      window.callUniversalAI = async () => ({ text: 'not json' });
      window.confirm = () => true; const w0 = writes.length; const btn = row('Hordeolum').querySelector('.dxa-art-btn');
      await dxaWriteArticle('h1', btn);
      out.bad = [writes.length - w0, toasts[toasts.length - 1], btn.disabled, btn.textContent];
      return out;
    });
    assert.deepEqual(r.rows, [2, true, true, 'Drafted from the article “Hordeolum: the 3-day rule” — open it'], 'every row has 📰; the source-article chip is unchanged; a fresh entry has no chip: ' + JSON.stringify(r.rows));
    assert.deepEqual(r.order.slice(-4), ['📰', 'Edit', '📋', '🗑️'], 'row actions: … 📰 · Edit · 📋 · 🗑️: ' + JSON.stringify(r.order));
    assert.deepEqual(r.cancel, [0, 0, 0], 'Cancel writes nothing');
    assert.deepEqual([r.run.prompts, r.run.feature, r.run.isJson, r.run.promptHas, r.run.refsOut], [1, 'disease_article', true, [true, true, true, true, true, true], true], 'one JSON call with the monograph (references left out): ' + JSON.stringify([r.run.prompts, r.run.feature, r.run.promptHas, r.run.refsOut]));
    assert.deepEqual(r.run.add, ['articles', 'draft', { en: 'Acromegaly: the subtle signs 🔍', th: 'อะโครเมกาลี: สัญญาณที่มองข้าม', ko: '말단비대증: 놓치기 쉬운 징후' }, 3, { emoji: '🧠' }, [{ kind: 'disease', id: 'd1', label: 'Acromegaly' }], { draftId: '', publishedId: 'd1', name: 'Acromegaly' }, true, 'a@x.test', true, 1, 'TS'],
      'the article draft: titles, 3-line body, cover, disease link, dx back-link, provenance, window dates: ' + JSON.stringify(r.run.add));
    assert.deepEqual(r.run.upd, ['disease_codex', 'd1', { articleId: 'art9', articleTitle: 'Acromegaly: the subtle signs 🔍' }], 'the entry remembers the article: ' + JSON.stringify(r.run.upd));
    assert.deepEqual(r.run.opened, ['open', 'art9'], 'the Articles editor opens on the new draft');
    assert.match(r.run.toast, /^📰 Draft article “Acromegaly: the subtle signs 🔍” — review it in Articles/);
    assert.equal(r.run.chip, 'Article written from this entry “Acromegaly: the subtle signs 🔍” — open it', 'the row now carries the 📰 chip to the written article');
    assert.match(r.run.btnTitle, /^Write another short article/);
    assert.deepEqual(r.again, [0, ['open', 'art9']], 'with an article already: Cancel opens it, no AI call: ' + JSON.stringify(r.again));
    assert.deepEqual(r.bad, [0, '📰 AI returned invalid JSON after retry.', false, '📰'], 'bad JSON twice → toast, nothing written, button restored: ' + JSON.stringify(r.bad));
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: 📰 Write article from a Disease Codex row — confirm, one JSON call with the monograph, an Articles draft linked both ways, the entry stamped, chip + editor open, retry / cancel / error paths');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
