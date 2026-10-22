// V102.371 (owner: "ทำแบบ 2 + 3"): 🩺 in the Articles editor drafts a Disease Codex entry from the article (AI Auto-Draft with the article as
// the source) and files it as a PENDING draft; the article remembers it (dx), approving fills dx.publishedId; the Codex rows carry a 📰 chip
// back to the article. The REAL admin.html + articles-admin.js with a fake Firestore and a fake AI (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n'), aj = fs.readFileSync('public/articles-admin.js', 'utf8'), rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/<script src="articles-admin\.js\?v=V102\.37\d"><\/script>/.test(html), 'articles-admin.js cache-busted');
assert.ok(html.includes("window.dxaDraftFromArticle = async function (art) {") && html.includes("dxaBuildAutoDraftPrompt(diseaseName, source)"), 'the article → draft path');
assert.ok(aj.includes('function dxChipHtml(a) {') && !aj.includes("chip('🩺 Disease Codex', false, 'Articles.toCodex()', ' title=\"Open the Disease Codex with"), 'the chip reads dx');
// the rule the admin's draft create must satisfy: submittedBy = own uid, status pending, a disease name
assert.ok(/match \/disease_codex_drafts\/\{draftId\} \{[\s\S]*?allow create: if isSignedIn\(\)\s*&& request\.resource\.data\.submittedBy == request\.auth\.uid\s*&& request\.resource\.data\.status == 'pending'/.test(rules), 'drafts create rule unchanged');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });   // harness noise from the firebase stub at load
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof window.dxaDraftFromArticle === 'function' && typeof dxaApproveDraft === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const writes = [], ops = [], prompts = [], toasts = [];
      window.showToast = m => toasts.push(m);
      window.adminApp = { auth: () => ({ currentUser: { uid: 'admin1', email: 'a@x.test' } }) };
      window.auth = window.adminApp.auth();   // admin.html's `var auth` (the approve paths read auth.currentUser.email)
      const mkRef = (coll, id) => ({ id, _p: coll + '/' + id, update: async d => { writes.push(['update', coll, id, d]); }, get: async () => ({ exists: false }) });
      window.db = { collection: coll => ({ add: async d => { writes.push(['add', coll, d]); return { id: 'd9' }; }, doc: id => mkRef(coll, id || 'pub1'), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
          get: async () => ({ docs: coll === 'articles' ? Articles._S.list.map(a => ({ id: a.id, data: () => Object.assign({}, a) })) : [] }) }),   // Articles.load() re-reads the list
        batch: () => ({ set: (ref, d) => ops.push(['set', ref._p, JSON.parse(JSON.stringify(d))]), update: (ref, d) => ops.push(['update', ref._p, d]), commit: async () => {} }) };
      const AI = { diseaseName: 'Acromegaly (AI)', thaiName: 'อะโครเมกาลี', synonyms: ['GH excess', ''], icd10: 'E22.0', category: 'Endocrine', epidemiology: 'rare', etiology: 'pituitary adenoma', pathophysiology: 'GH/IGF-1', symptoms: '- hands', signs: 'coarse', diagnosis: 'IGF-1', investigations: 'MRI', differential: 'x', treatment: 'surgery', nonPharm: 'y', complications: 'z', prognosis: 'ok', patientCounseling: 'พบแพทย์', redFlags: 'headache', pearls: 'p', references: ['UpToDate: acromegaly'] };
      window.callUniversalAI = async (model, prompt) => { prompts.push([model, prompt]); return { text: JSON.stringify(AI), model: 'm1' }; };
      const S = Articles._S; S.loaded = true; S.loading = false;
      const base = { body: { en: 'Growth hormone excess after the growth plates close. Look at the hands, the jaw and the shoe size.' }, cover: { emoji: '🧪' }, status: 'scheduled', startAt: Date.now() - 864e5, endAt: Date.now() + 864e5, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
      S.list = [Object.assign({ id: 'a1', title: { en: 'Acromegaly: Spotting the Subtle Signs 🔍', th: 'อะโครเมกาลี' } }, base), Object.assign({ id: 'a2', title: { en: 'Dengue (part 2)' } }, base)];
      const out = {};
      Articles.open(); Articles.edit('a1');
      const chipTxt = () => (qa('.art-c.art-add').find(b => /🩺|Drafting/.test(b.textContent)) || {}).textContent;
      out.chip0 = chipTxt();
      // 1. unsaved edit → refused
      S.cur.title.en = 'Acromegaly: edited'; Articles.toCodex(); out.dirty = [(q('.art-err') || {}).textContent, writes.length];
      S.cur.title.en = 'Acromegaly: Spotting the Subtle Signs 🔍'; S.base = JSON.stringify(S.cur);
      // 2. 🩺 → AI draft from the article → Pending Draft + the article's dx
      Articles.toCodex(); out.busy = [S.dxBusy, chipTxt()];
      await wait(80);
      out.prompt = [prompts.length, prompts[0] && /DISEASE TO DRAFT: <<<Acromegaly>>>/.test(prompts[0][1]), prompts[0] && /SOURCE ARTICLE[\s\S]*Title: Acromegaly: Spotting the Subtle Signs 🔍\nGrowth hormone excess/.test(prompts[0][1])];
      const add = writes.find(w => w[0] === 'add'); const d = add && add[2];
      out.draft = d && [add[1], d.status, d.submittedBy, d.submittedByName, d.sourceArticleId, d.sourceArticleTitle, d.diseaseName, d.thaiName, d.synonyms, d.icd10, d.aiDrafted, d.aiDraftedModel, d.createdAt, Object.keys(d).includes('references')];
      out.artWrite = writes.find(w => w[0] === 'update' && w[1] === 'articles');
      out.after = [S.dxBusy, S.cur.dx, JSON.stringify(S.cur) === S.base, chipTxt(), S.aiNote, S.list[0].dx && S.list[0].dx.draftId, toasts[toasts.length - 1]];
      // 3. linked → the chip opens the Codex at Pending Drafts (no second draft)
      let opened = 0; const views = []; window.openDiseaseCodexAdmin = () => { opened++; }; window.dxaSwitchView = v => views.push(v);
      const w1 = writes.length; Articles.toCodex(); await wait(250);
      out.linked = [opened, views, writes.length - w1, document.getElementById('articlesModal').style.display];
      // 3b. published → opens the entry
      const edits = []; window.dxaEdit = id => edits.push(id);
      Articles.open(); Articles.edit('a1'); S.cur.dx = { draftId: 'd9', publishedId: 'pub1', name: 'Acromegaly' }; S.base = JSON.stringify(S.cur); Articles.toCodex(); await wait(250);
      out.pub = [edits, chipTxt && (qa('.art-c.art-add').find(b => /In Disease Codex/.test(b.textContent)) || {}).getAttribute && 1];
      // 4. a duplicate name is refused (nothing written)
      dxaState.codex = [{ _id: 'x1', diseaseName: 'Dengue' }];
      Articles.open(); Articles.edit('a2'); const w2 = writes.length; Articles.toCodex(); await wait(80);
      out.dup = [(q('.art-err') || {}).textContent, writes.length - w2, S.dxBusy, chipTxt()];
      Articles.close();
      // 5. approve as-is: the published doc carries the article, no "intern:" contributor, the article learns the published id
      dxaState.codex = [];
      dxaState.drafts = [{ _id: 'd9', diseaseName: 'Acromegaly', thaiName: 'อะโครเมกาลี', sourceArticleId: 'a1', sourceArticleTitle: 'Acromegaly: Spotting the Subtle Signs 🔍', submittedBy: 'admin1', submittedByName: 'a@x.test', status: 'pending', createdAt: { toDate: () => new Date() } }];
      window.codexBonusPrompt = async () => 0; window.dcaQueueCodexContributorAward = () => 0;
      await dxaApproveDraft('d9');
      out.approve = ops.map(o => [o[0], o[1], o[0] === 'set' ? [o[2].sourceArticleId, o[2].sourceArticleTitle, o[2].contributors, o[2].diseaseName] : o[2]]);
      // 6. the 📰 chip on the draft row and on the published row; tap → the article in the editor
      dxaRenderDraftsList(); const dChip = q('#dxa-drafts-list .dxa-art-chip');
      out.draftRow = [!!dChip, dChip && dChip.textContent, dChip && dChip.getAttribute('title')];
      dxaState.codex = [{ _id: 'pub1', diseaseName: 'Acromegaly', thaiName: 'อะโครเมกาลี', category: 'Endocrine', sourceArticleId: 'a1', sourceArticleTitle: 'Acromegaly: Spotting the Subtle Signs 🔍' }, { _id: 'h1', diseaseName: 'Hordeolum' }];
      dxaState.searchTerm = ''; dxaRenderPublishedList();
      out.pubRow = [qa('#dxa-list .dxa-art-chip').length, (q('#dxa-list .dxa-art-chip') || {}).textContent];
      S.cur = null; S.loaded = false; q('#dxa-list .dxa-art-chip').click(); await wait(300);
      out.tap = [S.cur && S.cur.id, document.getElementById('articlesModal').style.display !== 'none'];
      return out;
    });
    assert.equal(r.chip0, '🩺 Disease Codex', 'the chip before anything: ' + r.chip0);
    assert.deepEqual(r.dirty, ['⚠️ 🩺 Save the article first, then send it to the Disease Codex.', 0], 'an unsaved edit is refused');
    assert.deepEqual(r.busy, [true, '⏳ Drafting Codex entry…'], 'busy chip while the AI drafts');
    assert.deepEqual(r.prompt, [1, true, true], 'one AI call: the Auto-Draft prompt with the article as SOURCE ARTICLE: ' + JSON.stringify(r.prompt));
    assert.deepEqual(r.draft, ['disease_codex_drafts', 'pending', 'admin1', 'a@x.test', 'a1', 'Acromegaly: Spotting the Subtle Signs 🔍', 'Acromegaly', 'อะโครเมกาลี', ['GH excess'], 'E22.0', true, 'm1', 'TS', true], 'the pending draft: ' + JSON.stringify(r.draft));
    assert.deepEqual(r.artWrite, ['update', 'articles', 'a1', { dx: { draftId: 'd9', publishedId: '', name: 'Acromegaly' } }], 'the article remembers the draft');
    assert.deepEqual(r.after.slice(0, 4), [false, { draftId: 'd9', publishedId: '', name: 'Acromegaly' }, true, '🩺 Codex draft pending'], 'after: dx set, not dirty, chip says pending: ' + JSON.stringify(r.after));
    assert.match(r.after[4], /Pending Drafts.*m1/, 'the note names the model'); assert.equal(r.after[5], 'd9', 'the list copy too'); assert.match(r.after[6], /pending approval/);
    assert.deepEqual(r.linked, [1, ['drafts'], 0, 'none'], 'linked → open the Codex at Pending Drafts, nothing written: ' + JSON.stringify(r.linked));
    assert.deepEqual(r.pub[0], ['pub1'], 'published → the entry opens');
    assert.deepEqual(r.dup, ['⚠️ 🩺 "Dengue" is already in the Codex (id x1) — open it there instead.', 0, false, '🩺 Disease Codex'], 'a duplicate is refused: ' + JSON.stringify(r.dup));
    assert.deepEqual(r.approve, [['update', 'articles/a1', { 'dx.publishedId': 'pub1' }], ['set', 'disease_codex/pub1', ['a1', 'Acromegaly: Spotting the Subtle Signs 🔍', ['admin:a@x.test'], 'Acromegaly']], ['update', 'disease_codex_drafts/d9', { status: 'approved', approvedAt: 'TS', approvedBy: 'a@x.test', publishedId: 'pub1' }]], 'approve (one batch): the article learns pub1 + published doc carries the article, no intern: contributor + draft flip: ' + JSON.stringify(r.approve));
    assert.deepEqual(r.draftRow, [true, '📰 Acromegaly: Spotting the Subtle Signs 🔍', 'Drafted from the article “Acromegaly: Spotting the Subtle Signs 🔍” — open it'], 'draft row chip');
    assert.deepEqual(r.pubRow, [1, '📰 Acromegaly: Spotting the Subtle Signs 🔍'], 'published row chip only on the sourced entry');
    assert.deepEqual(r.tap, ['a1', true], 'tap → the article in the editor');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: Articles 🩺 → Disease Codex pending draft (AI from the article) + two-way link — chip states, refusals, approve carries the article, 📰 chips on both rows');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
