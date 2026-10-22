// V102.380 (owner's pick 7): 🧪 Make a quiz on every published Disease Codex row — AI writes 5 single-best-answer questions from the
// monograph, the REAL Quiz editor opens on them as a NEW quiz (title · tags · questions · hidden Codex fields prefilled, the blank starter
// gone, nothing saved); Save stores quiz.diseaseCodexId and links the quiz back to the entry's article; the row's 🧪 chip reads
// quizzesData. The REAL admin.html with a fake Firestore and a fake AI (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.match(html, /<title>Nika Admin \(V102\.(?:38\d|39\d|[4-9]\d\d)\)<\/title>/, 'admin V102.380+');
assert.ok(html.includes('<input type="hidden" id="edit-quiz-codex-disease">') && html.includes('<input type="hidden" id="edit-quiz-codex-article">'), 'the two hidden editor fields');
assert.ok(html.includes("if (_codexDisease) data.diseaseCodexId = _codexDisease;"), 'saveQuiz stores diseaseCodexId');
assert.ok(html.includes("if (data.diseaseCodexId && typeof dxaLinkQuizBack === 'function') dxaLinkQuizBack(savedQuizId, data.title)"), 'a NEW quiz links back to the article after Save');
assert.ok(html.includes("document.getElementById('edit-quiz-codex-disease').value = q.diseaseCodexId || '';") && html.includes("['edit-quiz-codex-disease', 'edit-quiz-codex-article'].forEach("), 'fillQuizForm restores / resetQuizForm clears the fields');
assert.ok(html.includes('window.dxaMakeQuiz = async function (id, btn) {') && html.includes('function dxaBuildQuizPrompt(d) {') && html.includes('function dxaQuizOf(d) {'), 'maker + prompt + chip source');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => ({ __union: a }) } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => typeof window.dxaMakeQuiz === 'function' && typeof dxaRenderPublishedList === 'function' && typeof openQuizModal === 'function' && typeof getQuizFormData === 'function' && document.readyState === 'complete');
    const r = await page.evaluate(async () => {
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const toasts = []; window.showToast = m => toasts.push(m);
      window.adminApp = { auth: () => ({ currentUser: { uid: 'admin1', email: 'a@x.test' } }) }; window.auth = window.adminApp.auth();
      const writes = [];
      window.db = { collection: coll => ({ add: async d => { writes.push(['add', coll, d]); return { id: 'z9' }; }, doc: id => ({ update: async d => { writes.push(['update', coll, id, d]); }, get: async () => ({ exists: false }), set: async () => {} }), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }), onSnapshot: () => () => {} }) };
      window.quizzesData = [{ id: 'z1', title: 'Hordeolum basics', diseaseCodexId: 'h1', questions: [{}, {}, {}, {}, {}] }];
      const AI = { title: 'Acromegaly basics', questions: [
        { q: 'A 45-year-old with enlarging hands and a coarse face. Best first test?', options: ['Random GH', 'IGF-1', 'Prolactin', 'Cortisol'], correct: 1, explanation: 'IGF-1 is the screening test; GH is pulsatile.' },
        { q: 'Which finding is a red flag for mass effect?', options: ['Sweating', 'Bitemporal hemianopia', 'Snoring', 'Carpal tunnel'], correct: 1, explanation: 'Optic chiasm compression.' },
        { q: 'First-line treatment?', options: ['Cabergoline', 'Transsphenoidal surgery', 'Radiotherapy', 'Octreotide'], correct: 1, explanation: 'Surgery first.' },
        { q: 'Mechanism?', options: ['GH excess from a pituitary adenoma', 'Cortisol excess', 'Thyroid excess', 'Insulin excess'], correct: 0, explanation: 'GH-secreting adenoma.' },
        { q: 'Counselling point?', options: ['Lifelong follow-up', 'No follow-up', 'Avoid all exercise', 'Stop all medicines'], correct: 0, explanation: 'Recurrence and comorbidity surveillance.' },
        { q: 'bad row', options: ['x'], correct: 7 }
      ] };
      const prompts = []; window.callUniversalAI = async (model, prompt, isJson, a, k, opts) => { prompts.push({ model, prompt, isJson, feature: opts && opts.feature }); return { text: JSON.stringify(AI) }; };
      dxaState.codex = [
        { _id: 'd1', diseaseName: 'Acromegaly', thaiName: 'อะโครเมกาลี', icd10: 'E22.0', category: 'Endocrine', pathophysiology: 'GH excess from a pituitary adenoma.', treatment: 'Transsphenoidal surgery.', articleId: 'art1', references: ['ref1'] },
        { _id: 'h1', diseaseName: 'Hordeolum' }
      ];
      dxaState.searchTerm = '';
      dxaRenderPublishedList();
      const out = {};
      const row = name => qa('#dxa-list .dca-row').find(r => r.querySelector('.dca-row-name').textContent === name);
      out.rows = [qa('#dxa-list .dxa-quiz-btn').length, (row('Hordeolum').querySelector('.dxa-quiz-chip') || {}).textContent, !row('Acromegaly').querySelector('.dxa-quiz-chip'),
        [...row('Acromegaly').querySelectorAll('.dca-row-actions button')].map(b => b.textContent.trim()).slice(-4)];
      // Cancel → nothing
      window.confirm = () => false; await dxaMakeQuiz('d1', row('Acromegaly').querySelector('.dxa-quiz-btn'));
      out.cancel = [prompts.length, getComputedStyle(document.getElementById('quizManageModal')).display];
      // OK → the editor opens prefilled
      window.confirm = () => true; await dxaMakeQuiz('d1', row('Acromegaly').querySelector('.dxa-quiz-btn'));
      await new Promise(res => setTimeout(res, 150));
      const items = qa('#quiz-questions-container .quiz-q-item');
      const fd = getQuizFormData();
      out.run = { prompts: prompts.length, feature: prompts[0].feature, isJson: prompts[0].isJson, promptHas: ['FORMAT CONTRACT', 'exactly 5 questions', 'DISEASE: Acromegaly (อะโครเมกาลี) · ICD-10 E22.0 · Endocrine', 'pathophysiology: GH excess', 'SELF-CHECK'].map(s => prompts[0].prompt.includes(s)), refsOut: !prompts[0].prompt.includes('ref1'),
        modal: getComputedStyle(document.getElementById('quizManageModal')).display, editId: q('#edit-quiz-id').value, title: q('#quiz-title').value, tags: q('#quiz-tags').value, cdx: q('#edit-quiz-codex-disease').value, art: q('#edit-quiz-codex-article').value,
        n: items.length, qs: fd.questions.map(x => [x.q.slice(0, 20), x.options.length, x.correct, (x.explanation || '').slice(0, 12)]), toast: toasts[toasts.length - 1] };
      // Save-time pieces: the data field + the link back (the save routine itself needs live auth, so its two hooks are exercised directly)
      await dxaLinkQuizBack('z9', 'Acromegaly basics');
      out.link = writes.find(w => w[0] === 'update');
      q('#edit-quiz-codex-article').value = ''; writes.length = 0; await dxaLinkQuizBack('z9', 'x'); out.noLink = writes.length;
      // reset clears, fill restores
      resetQuizForm(); out.reset = [q('#edit-quiz-codex-disease').value, q('#edit-quiz-codex-article').value];
      fillQuizForm({ title: 'T', diseaseCodexId: 'h1', questions: [] }); out.fill = q('#edit-quiz-codex-disease').value;
      // already has a quiz → Cancel opens it (no AI)
      const n0 = prompts.length; let opened = null; const realOpen = window.openQuizModal; window.openQuizModal = async id => { opened = id; };
      window.confirm = () => false; await dxaMakeQuiz('h1', row('Hordeolum').querySelector('.dxa-quiz-btn')); window.openQuizModal = realOpen;
      out.again = [prompts.length - n0, opened];
      // bad JSON twice → toast, editor untouched
      window.callUniversalAI = async () => ({ text: 'nope' }); window.confirm = () => true; const t0 = toasts.length;
      forceHideModal('quizManageModal'); await dxaMakeQuiz('d1', row('Acromegaly').querySelector('.dxa-quiz-btn'));
      out.bad = [toasts[toasts.length - 1], getComputedStyle(document.getElementById('quizManageModal')).display, row('Acromegaly').querySelector('.dxa-quiz-btn').textContent, row('Acromegaly').querySelector('.dxa-quiz-btn').disabled];
      return out;
    });
    assert.deepEqual(r.rows, [2, '🧪 Hordeolum basics · 5 Q', true, ['Edit', '🧪', '📋', '🗑️']], 'every row has 🧪 after Edit; a row with a quiz shows the chip: ' + JSON.stringify(r.rows));
    assert.deepEqual(r.cancel, [0, 'none'], 'Cancel: no AI, editor stays closed: ' + JSON.stringify(r.cancel));
    assert.deepEqual([r.run.prompts, r.run.feature, r.run.isJson, r.run.promptHas, r.run.refsOut], [1, 'disease_quiz', true, [true, true, true, true, true], true], 'one JSON call with the monograph: ' + JSON.stringify([r.run.feature, r.run.promptHas, r.run.refsOut]));
    assert.deepEqual([r.run.modal, r.run.editId, r.run.title, r.run.tags, r.run.cdx, r.run.art, r.run.n], ['block', '', 'Acromegaly basics', 'Acromegaly, Endocrine', 'd1', 'art1', 5], 'the editor opens as a NEW quiz, prefilled, starter gone, hidden fields set: ' + JSON.stringify(r.run));
    assert.deepEqual(r.run.qs, [['A 45-year-old with e', 4, [1], 'IGF-1 is the'], ['Which finding is a r', 4, [1], 'Optic chiasm'], ['First-line treatment', 4, [1], 'Surgery firs'], ['Mechanism?', 4, [0], 'GH-secreting'], ['Counselling point?', 4, [0], 'Recurrence a']], 'five questions parsed back by getQuizFormData, the bad row dropped: ' + JSON.stringify(r.run.qs));
    assert.match(r.run.toast, /^🧪 5 questions drafted from “Acromegaly” — review, then Save/);
    assert.deepEqual(r.link, ['update', 'articles', 'art1', { links: { __union: [{ kind: 'quiz', id: 'z9', label: 'Acromegaly basics' }] } }], 'the link back: arrayUnion of a 🧪 link on the article: ' + JSON.stringify(r.link));
    assert.equal(r.noLink, 0, 'no article → no write');
    assert.deepEqual([r.reset, r.fill], [['', ''], 'h1'], 'reset clears the hidden fields, fill restores diseaseCodexId');
    assert.deepEqual(r.again, [0, 'z1'], 'with a quiz already: Cancel opens it, no AI: ' + JSON.stringify(r.again));
    assert.deepEqual(r.bad, ['🧪 AI returned no usable questions after retry.', 'none', '🧪', false], 'bad JSON twice → toast, editor closed, button back: ' + JSON.stringify(r.bad));
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: 🧪 Make a quiz from a Disease Codex row — confirm, one JSON call, the REAL editor prefilled (title · tags · 5 questions · Codex fields), save hooks (diseaseCodexId + 🧪 link on the article), chip, cancel / retry paths');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
