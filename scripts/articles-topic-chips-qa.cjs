// V102.399 (owner's pick 4): the Articles editor — flags for the three languages, and a 🩺 💊 🔗 chip row under the title. ONE click on 🩺 / 💊 files an EMPTY
// Disease / Drug Codex draft (just the topic, no AI) in Pending Drafts — finished later in Poneglyph; the ring says where it stands; a ringed chip opens the entry.
// The REAL admin.html + articles-admin.js with a fake Firestore and an AI that must NOT be called (nothing leaves the page).
//   node scripts/articles-topic-chips-qa.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n'), aj = fs.readFileSync('public/articles-admin.js', 'utf8'), rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<script src="articles-admin\.js\?v=V102\.\d+"><\/script>/.test(html), 'articles-admin.js cache-busted');
assert.ok(html.includes('window.dxaStubFromArticle = async function (art) {') && html.includes('window.dcaStubFromArticle = async function (art) {'), 'the two topic-only helpers');
assert.ok(!/dxaStubFromArticle[\s\S]{0,2200}callUniversalAI/.test(html.slice(html.indexOf('window.dxaStubFromArticle'), html.indexOf('window.dxaStubFromArticle') + 2200)), 'the Disease stub never calls the AI');
assert.ok(/@font-face\{font-family:"Twemoji Country Flags";unicode-range:U\+1F1E6-1F1FF/.test(aj), 'the flag font (Windows has no flag emoji — it would show GB / TH / KR letters)');
assert.ok(aj.includes('function topicRowHtml(a) {') && aj.includes('topicTo: function (k) {') && aj.includes('quizPick: function () {'), 'the chip row + its API');
// the rules the stub must satisfy (unchanged): submittedBy = own uid, status pending, a name
assert.ok(/match \/disease_codex_drafts\/\{draftId\} \{[\s\S]*?allow create: if isSignedIn\(\)\s*&& request\.resource\.data\.submittedBy == request\.auth\.uid\s*&& request\.resource\.data\.status == 'pending'/.test(rules), 'drafts create rule unchanged');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof window.dxaStubFromArticle === 'function' && typeof window.dcaStubFromArticle === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const writes = [], toasts = []; let ai = 0;
      window.showToast = m => toasts.push(m);
      window.adminApp = { auth: () => ({ currentUser: { uid: 'admin1', email: 'a@x.test' } }) }; window.auth = window.adminApp.auth();
      window.callUniversalAI = async () => { ai++; return { text: '{}' }; };
      const mkRef = (coll, id) => ({ id, update: async d => { writes.push(['update', coll, id, JSON.parse(JSON.stringify(d))]); } });
      window.db = { collection: coll => ({ add: async d => { writes.push(['add', coll, JSON.parse(JSON.stringify(d))]); return { id: 'd9' }; }, doc: id => mkRef(coll, id || 'pub1'),
          get: async () => ({ docs: coll === 'articles' ? Articles._S.list.map(a => ({ id: a.id, data: () => Object.assign({}, a) })) : [] }) }) };
      const S = Articles._S; S.loaded = true; S.loading = false;
      const base = { body: { en: 'Trigger points on taut muscle bands cause referred pain.', th: 'จุดกดเจ็บ' }, cover: { emoji: '💡' }, status: 'scheduled', startAt: Date.now() + 864e5, endAt: Date.now() + 5 * 864e5, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
      S.list = [Object.assign({ id: 'a1', title: { en: 'Myofascial Pain Syndrome (MPS) 💡', th: 'กลุ่มอาการปวดกล้ามเนื้อและพังผืด (MPS)' } }, base), Object.assign({ id: 'a2', title: { en: 'Dengue (part 2)' } }, base), Object.assign({ id: 'a3', title: { en: 'Metformin (Glucophage, Glumet)' } }, base)];
      const out = {};
      Articles.open(); Articles.edit('a1');
      // 1. flags on the language pills (dot + flag, "→ 🇬🇧" when empty), the letters stay in the tooltip / aria-label
      out.flags = qa('.art-ed .art-ln')[0] ? qa('.art-ed .art-ln')[0].querySelectorAll('.art-c').length && qa('.art-ed .art-ln .art-c').slice(0, 3).map(b => [b.textContent.trim(), b.getAttribute('aria-label'), b.getAttribute('title')]) : null;
      out.rowFlags = qa('.art-row .art-lg').slice(0, 3).map(s => [s.textContent, s.title]);
      // 2. the chip row under the title, before anything is sent
      const chips = () => qa('.art-xr .art-xc').map(b => b.textContent.trim());
      out.row0 = [chips(), q('#art-title').nextElementSibling && q('#art-title').nextElementSibling.className, qa('.art-xr .art-xc').map(b => b.className.replace('art-xc', '').trim())];
      // 3. 🩺 once → an empty draft: the name without "(…)" and emoji, MPS as the synonym, the TH title, nothing else, no AI
      qa('.art-xr .art-xc')[0].click(); await wait(120);
      const add = writes.find(w => w[0] === 'add'), d = add && add[2];
      out.dxDraft = d && [add[1], d.status, d.submittedBy, d.submittedByName, d.sourceArticleId, d.sourceArticleTitle, d.diseaseName, d.thaiName, d.synonyms, d.aiDrafted, d.topicOnly, d.createdAt, d.etiology, Array.isArray(d.references)];
      out.dxArt = writes.find(w => w[0] === 'update' && w[1] === 'articles');
      out.after = [chips()[0], qa('.art-xr .art-xc')[0].className.replace('art-xc', '').trim(), S.cur.dx, JSON.stringify(S.cur) === S.base, S.list[0].dx && S.list[0].dx.draftId, toasts[toasts.length - 1], ai];
      // 4. a ringed chip opens the Codex at Pending Drafts — no second draft
      let opened = 0; const views = []; window.openDiseaseCodexAdmin = () => { opened++; }; window.dxaSwitchView = v => views.push(v);
      const w1 = writes.length; qa('.art-xr .art-xc')[0].click(); await wait(250);
      out.linked = [opened, [...new Set(views)], writes.length - w1, document.getElementById('articlesModal').style.display];
      // 4b. published → the entry
      const edits = []; window.dxaEdit = id => edits.push(id);
      Articles.open(); Articles.edit('a1'); S.list[0].dx = { draftId: 'd9', publishedId: 'pub1', name: 'Myofascial Pain Syndrome' }; Articles.close(); Articles.open(); Articles.edit('a1');
      out.pubChip = [chips()[0], qa('.art-xr .art-xc')[0].className.replace('art-xc', '').trim()];
      qa('.art-xr .art-xc')[0].click(); await wait(250); out.pubOpen = edits;
      // 5. unsaved edits are SAVED first (a scheduled article stays scheduled), then the draft is made
      Articles.open(); Articles.edit('a2'); S.cur.title.en = 'Dengue fever'; const w2 = writes.length;
      qa('.art-xr .art-xc')[0].click(); await wait(250);
      const seq = writes.slice(w2).map(w => [w[0], w[1], w[0] === 'update' ? (w[3].status || Object.keys(w[3]).join()) : w[2].diseaseName]);
      out.dirtySend = seq;
      // 6. a name already in the Codex is refused, nothing written
      dxaState.codex = [{ _id: 'x1', diseaseName: 'Hypertension' }];
      Articles.open(); Articles.edit('a1'); S.cur.dx = {}; S.base = JSON.stringify(S.cur); S.cur.title.en = 'Hypertension'; S.base = JSON.stringify(S.cur); const w3 = writes.length;
      qa('.art-xr .art-xc')[0].click(); await wait(120);
      out.dup = [(q('.art-err') || {}).textContent, writes.length - w3, qa('.art-xr .art-xc')[0].disabled];
      // 7. 💊: the generic name, the "(…)" names as brand names
      Articles.open(); Articles.edit('a3'); const w4 = writes.length;
      qa('.art-xr .art-xc')[1].click(); await wait(120);
      const dadd = writes.slice(w4).find(w => w[0] === 'add'), dd = dadd && dadd[2];
      out.dcDraft = dd && [dadd[1], dd.status, dd.genericName, dd.brandNames, dd.aiDrafted, dd.topicOnly, dd.sourceArticleId];
      out.dcArt = writes.slice(w4).find(w => w[0] === 'update' && w[1] === 'articles' && w[3].dc);
      out.dcChip = [chips()[1], qa('.art-xr .art-xc')[1].className.replace('art-xc', '').trim()];
      // 8. 🔗 Quiz opens the Links section on the quiz picker
      Articles.open(); Articles.edit('a2'); qa('.art-xr .art-xc')[2].click(); await wait(30);
      out.quiz = [S.open.links, S.pick, !!q('.art-pk, #art-pk-q')];
      out.ai = ai;
      return out;
    });
    assert.deepEqual(r.flags, [['🇬🇧', 'English', 'Required to schedule'], ['🇹🇭', 'Thai', 'Thai version'], ['🇰🇷', 'Korean', 'Empty — interns see EN']].map((x, i) => i === 2 ? [x[0], x[1], x[2]] : x).slice(0, 3).map((x, i) => i === 2 ? ['🇰🇷 → 🇬🇧', 'Korean', 'Empty — interns see EN'] : x), 'flags (the letters live in aria-label / title): ' + JSON.stringify(r.flags));
    assert.deepEqual(r.rowFlags, [['🇬🇧', 'EN'], ['🇹🇭', 'TH — not written yet'], ['🇰🇷', 'KO — not written yet']], 'the list rows too (a missing language says so): ' + JSON.stringify(r.rowFlags));
    assert.deepEqual(r.row0, [['🩺 Disease', '💊 Drug', '🔗 Quiz'], 'art-xr', ['', '', '']], 'the chip row sits right under the title: ' + JSON.stringify(r.row0));
    assert.deepEqual(r.dxDraft, ['disease_codex_drafts', 'pending', 'admin1', 'a@x.test', 'a1', 'Myofascial Pain Syndrome (MPS) 💡', 'Myofascial Pain Syndrome', 'กลุ่มอาการปวดกล้ามเนื้อและพังผืด', ['MPS'], false, true, 'TS', '', true], 'an EMPTY draft with just the topic: ' + JSON.stringify(r.dxDraft));
    assert.deepEqual(r.dxArt, ['update', 'articles', 'a1', { dx: { draftId: 'd9', publishedId: '', name: 'Myofascial Pain Syndrome' } }], 'the article remembers it');
    assert.deepEqual(r.after.slice(0, 5), ['🩺 Draft', 'ring', { draftId: 'd9', publishedId: '', name: 'Myofascial Pain Syndrome' }, true, 'd9'], 'amber ring "Draft", not dirty: ' + JSON.stringify(r.after));
    assert.match(r.after[5], /Pending Drafts.*Poneglyph/); assert.equal(r.after[6], 0, 'no AI call');
    assert.deepEqual(r.linked, [1, ['drafts'], 0, 'none'], 'a ringed chip opens Pending Drafts, writes nothing: ' + JSON.stringify(r.linked));
    assert.deepEqual(r.pubChip, ['🩺 In Codex', 'ring ok'], 'green when published'); assert.deepEqual(r.pubOpen, ['pub1'], 'published → the entry opens');
    assert.deepEqual(r.dirtySend.map(x => x.slice(0, 2).join('/') + ':' + x[2]), ['update/articles:scheduled', 'add/disease_codex_drafts:Dengue fever', 'update/articles:dx'], 'saves first (stays scheduled), then the draft, then the link: ' + JSON.stringify(r.dirtySend));
    assert.deepEqual(r.dup, ['⚠️ 🩺 "Hypertension" is already in the Codex (id x1) — open it there instead.', 0, false], 'a duplicate is refused, nothing written, the chip is usable again: ' + JSON.stringify(r.dup));
    assert.deepEqual(r.dcDraft, ['drug_codex_drafts', 'pending', 'Metformin', ['Glucophage', 'Glumet'], false, true, 'a3'], '💊: generic name + brand names: ' + JSON.stringify(r.dcDraft));
    assert.deepEqual(r.dcArt.slice(0, 3), ['update', 'articles', 'a3']); assert.equal(r.dcArt[3].dc.draftId, 'd9');
    assert.deepEqual(r.dcChip, ['💊 Draft', 'ring']);
    assert.deepEqual(r.quiz, [true, 'quiz', true], '🔗 opens the quiz picker: ' + JSON.stringify(r.quiz));
    assert.equal(r.ai, 0, 'the AI is never called');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: Articles editor — flags for EN / TH / KO, 🩺 💊 🔗 chips under the title; one click files an EMPTY Disease / Drug Codex draft (name, aliases, TH name; no AI), saves first, rings amber → green, opens the entry when ringed, refuses a duplicate');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
