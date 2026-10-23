// V102.374 (owner's pick 6, the drug mirror of #1982): 💊 in the Articles editor drafts a Drug Codex entry from the article (AI Auto-Draft with
// the article as the source) into drug_codex_drafts as PENDING; the article remembers it (dc), approving fills dc.publishedId; the drug rows
// carry the 📰 chip. The REAL admin.html + articles-admin.js with a fake Firestore and a fake AI (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n'), aj = fs.readFileSync('public/articles-admin.js', 'utf8'), rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/<script src="articles-admin\.js\?v=V102\.3[7-9]\d"><\/script>/.test(html), 'articles-admin.js cache-busted');
assert.ok(html.includes("window.dcaDraftFromArticle = async function (art) {") && html.includes("dcaBuildAutoDraftPrompt(drugName, source)"), 'the article → drug draft path');
assert.ok(aj.includes('function dcChipHtml(a) {') && aj.includes('toDrug: function () {'), 'the 💊 chip reads dc');
// the rule the admin's draft create must satisfy: submittedBy = own uid, status pending, a disease name
assert.ok(/match \/drug_codex_drafts\/\{draftId\} \{[\s\S]*?allow create: if isSignedIn\(\)\s*&& request\.resource\.data\.submittedBy == request\.auth\.uid\s*&& request\.resource\.data\.status == 'pending'\s*&& request\.resource\.data\.genericName is string/.test(rules), 'drug drafts create rule unchanged (fits the admin create)');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });   // harness noise from the firebase stub at load
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof window.dcaDraftFromArticle === 'function' && typeof dcaApproveDraft === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');
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
      const AI = { genericName: 'Elobixibat (AI)', brandNames: ['Goofice', ''], atcCode: 'A06AX09', class: 'IBAT inhibitor', indication: 'Chronic constipation', dosing: '10 mg once daily before breakfast', contraindication: 'Bowel obstruction', sideEffects: 'Diarrhoea', interactions: 'None known', mechanism: 'IBAT inhibition', pharmacokinetics: 'Minimal absorption', monitoring: 'Stool frequency', patientCounseling: 'กินก่อนอาหารเช้า', references: ['Goofice label'] };
      window.callUniversalAI = async (model, prompt) => { prompts.push([model, prompt]); return { text: JSON.stringify(AI), model: 'm1' }; };
      const S = Articles._S; S.loaded = true; S.loading = false;
      const base = { body: { en: 'An IBAT inhibitor for chronic constipation. Take before breakfast; diarrhoea in the first week is common.' }, cover: { emoji: '💊' }, status: 'scheduled', startAt: Date.now() - 864e5, endAt: Date.now() + 864e5, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
      S.list = [Object.assign({ id: 'a1', title: { en: 'Elobixibat: counsel before breakfast 💊', th: 'เอโลบิซิแบต' } }, base), Object.assign({ id: 'a2', title: { en: 'Salbutamol (part 2)' } }, base)];
      const out = {};
      Articles.open(); Articles.edit('a1');
      const chipTxt = () => (qa('.art-c.art-add').find(b => /💊|Drafting/.test(b.textContent)) || {}).textContent;
      out.chip0 = chipTxt();
      // 1. unsaved edit → refused
      S.cur.title.en = 'Elobixibat: edited'; Articles.toDrug(); out.dirty = [(q('.art-err') || {}).textContent, writes.length];
      S.cur.title.en = 'Elobixibat: counsel before breakfast 💊'; S.base = JSON.stringify(S.cur);
      // 2. 🩺 → AI draft from the article → Pending Draft + the article's dx
      Articles.toDrug(); out.busy = [S.dcBusy, chipTxt()];
      await wait(80);
      out.prompt = [prompts.length, prompts[0] && /DRUG TO DRAFT: <<<Elobixibat>>>/.test(prompts[0][1]), prompts[0] && /SOURCE ARTICLE[\s\S]*Title: Elobixibat: counsel before breakfast 💊\nAn IBAT inhibitor/.test(prompts[0][1])];
      const add = writes.find(w => w[0] === 'add'); const d = add && add[2];
      out.draft = d && [add[1], d.status, d.submittedBy, d.submittedByName, d.sourceArticleId, d.sourceArticleTitle, d.genericName, d.brandNames, d.atcCode, d.aiDrafted, d.aiDraftedModel, d.createdAt, Object.keys(d).includes('references')];
      out.artWrite = writes.find(w => w[0] === 'update' && w[1] === 'articles');
      out.after = [S.dcBusy, S.cur.dc, JSON.stringify(S.cur) === S.base, chipTxt(), S.aiNote, S.list[0].dc && S.list[0].dc.draftId, toasts[toasts.length - 1]];
      // 3. linked → the chip opens the Codex at Pending Drafts (no second draft)
      let opened = 0; const views = []; window.openDrugCodexAdmin = () => { opened++; }; window.dcaSwitchView = v => views.push(v);
      const w1 = writes.length; Articles.toDrug(); await wait(250);
      out.linked = [opened, views, writes.length - w1, document.getElementById('articlesModal').style.display];
      // 3b. published → opens the entry
      const edits = []; window.dcaEdit = id => edits.push(id);
      Articles.open(); Articles.edit('a1'); S.cur.dc = { draftId: 'd9', publishedId: 'pub1', name: 'Elobixibat' }; S.base = JSON.stringify(S.cur); Articles.toDrug(); await wait(250);
      out.pub = [edits, chipTxt && (qa('.art-c.art-add').find(b => /In Drug Codex/.test(b.textContent)) || {}).getAttribute && 1];
      // 4. a duplicate name is refused (nothing written)
      dcaState.codex = [{ _id: 'x1', genericName: 'Salbutamol' }];
      Articles.open(); Articles.edit('a2'); const w2 = writes.length; Articles.toDrug(); await wait(80);
      out.dup = [(q('.art-err') || {}).textContent, writes.length - w2, S.dcBusy, chipTxt()];
      Articles.close();
      // 5. approve as-is: the published doc carries the article, no "intern:" contributor, the article learns the published id
      dcaState.codex = [];
      dcaState.drafts = [{ _id: 'd9', genericName: 'Elobixibat', brandNames: ['Goofice'], sourceArticleId: 'a1', sourceArticleTitle: 'Elobixibat: counsel before breakfast 💊', submittedBy: 'admin1', submittedByName: 'a@x.test', status: 'pending', createdAt: { toDate: () => new Date() } }];
      window.codexBonusPrompt = async () => 0; window.dcaPromptContributorBonus = async () => 0; window.dcaQueueCodexContributorAward = () => 0;
      await dcaApproveDraft('d9');
      out.approve = ops.map(o => [o[0], o[1], o[0] === 'set' ? [o[2].sourceArticleId, o[2].sourceArticleTitle, o[2].contributors, o[2].genericName] : o[2]]);
      // 6. the 📰 chip on the draft row and on the published row; tap → the article in the editor
      dcaRenderDraftsList(); const dChip = q('#dca-drafts-list .dxa-art-chip');
      out.draftRow = [!!dChip, dChip && dChip.textContent, dChip && dChip.getAttribute('title')];
      dcaState.codex = [{ _id: 'pub1', genericName: 'Elobixibat', brandNames: ['Goofice'], atcCode: 'A06AX09', sourceArticleId: 'a1', sourceArticleTitle: 'Elobixibat: counsel before breakfast 💊' }, { _id: 'h1', genericName: 'Paracetamol' }];
      dcaState.searchTerm = ''; dcaState.sortMode = 'name'; dcaRenderPublishedList();
      out.pubRow = [qa('#dca-list .dxa-art-chip').length, (q('#dca-list .dxa-art-chip') || {}).textContent];
      S.cur = null; S.loaded = false; q('#dca-list .dxa-art-chip').click(); await wait(300);
      out.tap = [S.cur && S.cur.id, document.getElementById('articlesModal').style.display !== 'none'];
      return out;
    });
    assert.equal(r.chip0, '💊 Drug Codex', 'the chip before anything: ' + r.chip0);
    assert.deepEqual(r.dirty, ['⚠️ 💊 Save the article first, then send it to the Drug Codex.', 0], 'an unsaved edit is refused');
    assert.deepEqual(r.busy, [true, '⏳ Drafting Drug Codex entry…'], 'busy chip while the AI drafts');
    assert.deepEqual(r.prompt, [1, true, true], 'one AI call: the Auto-Draft prompt with the article as SOURCE ARTICLE: ' + JSON.stringify(r.prompt));
    assert.deepEqual(r.draft, ['drug_codex_drafts', 'pending', 'admin1', 'a@x.test', 'a1', 'Elobixibat: counsel before breakfast 💊', 'Elobixibat', ['Goofice'], 'A06AX09', true, 'm1', 'TS', true], 'the pending drug draft (name forced, empty brand dropped): ' + JSON.stringify(r.draft));
    assert.deepEqual(r.artWrite, ['update', 'articles', 'a1', { dc: { draftId: 'd9', publishedId: '', name: 'Elobixibat' } }], 'the article remembers the draft');
    assert.deepEqual(r.after.slice(0, 4), [false, { draftId: 'd9', publishedId: '', name: 'Elobixibat' }, true, '💊 Drug draft pending'], 'after: dx set, not dirty, chip says pending: ' + JSON.stringify(r.after));
    assert.match(r.after[4], /Pending Drafts.*m1/, 'the note names the model'); assert.equal(r.after[5], 'd9', 'the list copy too'); assert.match(r.after[6], /pending approval/);
    assert.deepEqual(r.linked, [1, ['drafts'], 0, 'none'], 'linked → open the Codex at Pending Drafts, nothing written: ' + JSON.stringify(r.linked));
    assert.deepEqual(r.pub[0], ['pub1'], 'published → the entry opens');
    assert.deepEqual(r.dup, ['⚠️ 💊 "Salbutamol" is already in the Drug Codex (id x1) — link it with ＋ Codex instead.', 0, false, '💊 Drug Codex'], 'a duplicate is refused: ' + JSON.stringify(r.dup));
    assert.deepEqual(r.approve.map(o => [o[0], o[1], o[2]]).filter(o => o[1] === 'articles/a1' || o[1] === 'drug_codex/pub1'), [['update', 'articles/a1', { 'dc.publishedId': 'pub1' }], ['set', 'drug_codex/pub1', ['a1', 'Elobixibat: counsel before breakfast 💊', ['admin:a@x.test'], 'Elobixibat']]], 'approve (one batch): the article learns pub1 + the published drug carries the article, no intern: contributor: ' + JSON.stringify(r.approve));
    assert.ok(r.approve.some(o => o[0] === 'update' && o[1] === 'drug_codex_drafts/d9' && o[2].status === 'approved' && o[2].publishedId === 'pub1'), 'the draft flips to approved: ' + JSON.stringify(r.approve));
    assert.deepEqual(r.draftRow, [true, '📰 Elobixibat: counsel before breakfast 💊', 'Drafted from the article “Elobixibat: counsel before breakfast 💊” — open it'], 'draft row chip');
    assert.deepEqual(r.pubRow, [1, '📰 Elobixibat: counsel before breakfast 💊'], 'published row chip only on the sourced entry');
    assert.deepEqual(r.tap, ['a1', true], 'tap → the article in the editor');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: Articles 💊 → Drug Codex pending draft (AI from the article) + two-way link — chip states, refusals, approve carries the article, 📰 chips on both drug rows');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
