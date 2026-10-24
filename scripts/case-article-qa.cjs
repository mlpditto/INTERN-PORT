// Admin ▸ Alabasta ▸ Cases: icon-only actions — ✅ Review, 🖼️ Case Card (the main "make" button) and 📰 Article from the case (public/case-article.js).
// The real module in a vm with a fake Firestore / AI: the buttons, the prompt (no HN / name / initials), the draft saved to Articles (never scheduled),
// the case remembering it, the confirm / "already has one" paths, and every way it can fail.
//   node scripts/case-article-qa.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync('public/case-article.js', 'utf8');

// ---- static pins in admin.html
assert.ok(/<script src="case-article\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
const table = admin.slice(admin.indexOf('const mainActions = isPending'), admin.indexOf('const mainActions = isPending') + 6000);
assert.ok(/class="alabasta-go-btn is-icon" title="Review" aria-label="Review"[^>]*>✅<\/button>/.test(table), 'table: Review is the ✅ icon alone');
assert.ok(/caseArticle\.btns\(c\)/.test(table) && /\$\{isPending \? '' : makeBtns\}/.test(table), 'table: 🖼️ + 📰 on pending rows (before ❌) and on reviewed rows');
assert.ok(!/Generate Case Card<\/button>/.test(table), 'the ⋯ menu no longer lists Case Card (it is a button)');
assert.ok(/openAlabastaPoneglyph/.test(table) && /generateQuizFromCase/.test(table) && /deleteCaseSubmission/.test(table), 'the other tools stay in ⋯');
const inbox = admin.slice(admin.lastIndexOf('<div class="ib-actions">'), admin.lastIndexOf('<div class="ib-actions">') + 2000);
assert.ok(/alabasta-go-btn is-icon"[^>]*>✅<\/button>/.test(inbox) && /caseArticle\.btns\(c\)/.test(inbox), 'inbox card: ✅ icon + 🖼️ 📰');
assert.ok(/\.alabasta-action-btn\.is-case-article\.is-done/.test(admin) && /\.alabasta-go-btn\.is-icon/.test(admin), 'styles');

// ---- the module
const T0 = 1;
const log = { added: [], updated: [], confirms: [], toasts: [], opened: [], ai: [] };
let AIOUT, CONFIRM = true;
const CASES = {
    c1: { id: 'c1', caseId: '26956', displayName: 'Bew', customer: 'ญ.ม.', disease: 'Other', diseaseSystemLabel: 'Other / อื่นๆ', note: 'ญ อายุ 20 ขอยาสอด คันเล็กน้อย ตกขาวสีเขียวเหลือง ทำงานที่ฮอนด้า' },
    c2: { id: 'c2', disease: 'GI', note: '   ' }, c3: { id: 'c3', disease: 'GI', note: 'ปวดท้อง', articleId: 'artOld', articleTitle: 'Old article' }
};
const ctx = {
    console, localStorage: { getItem: () => null }, escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;'),
    getAlabastaCaseById: (id) => CASES[id], showToast: (m) => log.toasts.push(m), confirm: (m) => { log.confirms.push(m); return CONFIRM; },
    textAIModelInfo: () => null, safeJsonParse: (t) => { try { return JSON.parse(t); } catch (_) { return null; } },
    callUniversalAI: async (model, prompt, isJson, v, k, opts) => { log.ai.push({ model, prompt, isJson, opts }); const x = AIOUT.shift(); if (x instanceof Error) throw x; return { text: x, model: 'gpt-6-luna' }; },
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }, auth: { currentUser: { email: 'me@x' } },
    db: { collection: (n) => ({ add: async (d) => { log.added.push([n, d]); return { id: 'newArt' }; }, doc: (id) => ({ update: async (d) => { log.updated.push([n, id, d]); } }) }) },
    Articles: { load: async () => {}, open: () => log.opened.push('open'), edit: (id) => log.opened.push('edit:' + id), _defaultWindow: () => ({ start: 1000, end: 2000 }) }
};
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const OK = JSON.stringify({ title: { en: 'Green discharge? Ask first 🩺', th: 'ตกขาวสีเขียว ถามก่อน', ko: '녹색 분비물 먼저 묻기' }, body: { en: 'Line one\nLine two\nLine three', th: 'บรรทัดหนึ่ง\nสอง\nสาม', ko: '하나\n둘\n셋' }, emoji: '🩺' });
const reset = () => { Object.values(log).forEach(a => { a.length = 0; }); CONFIRM = true; };

// 1. the buttons
const btns = ctx.caseArticle.btns(CASES.c1);
assert.ok(btns.includes("openAlabastaCaseCard('c1')") && btns.includes('is-case-card') && btns.includes("writeArticleFromCase('c1', this)") && btns.includes('is-case-article'), btns);
assert.ok(!/is-done/.test(btns), 'no green ring before an article exists');
assert.ok(/is-case-article is-done/.test(ctx.caseArticle.btns(CASES.c3)), 'ok = a green ring once the case has an article');
assert.ok(!/>\s*[A-Za-z]{3,}\s*</.test(btns.replace(/<span class="alabasta-emoji">[^<]*<\/span>/g, '')), 'icon only — no visible words');
assert.ok(!ctx.caseArticle.btns({ id: "x'><img>" }).includes("<img>"), 'the id is escaped');

// 2. the prompt: the clinical note, nothing that identifies
const p = ctx.caseArticle.prompt(CASES.c1);
assert.ok(p.includes('ญ อายุ 20 ขอยาสอด') && p.includes('Other / อื่นๆ') && /PURE JSON/.test(p));
assert.ok(!p.includes('26956') && !p.includes('Bew') && !p.includes('ญ.ม.'), 'no HN, no intern name, no patient initials in the prompt');
assert.ok(/no patient-identifying content/.test(p), 'and the model is told not to add any');

(async () => {
    // 3. the happy path
    reset(); AIOUT = [OK];
    const btn = { innerHTML: '📰', disabled: false };
    await ctx.writeArticleFromCase('c1', btn);
    assert.equal(log.confirms.length, 1); assert.ok(/no HN or names/.test(log.confirms[0]) && /DRAFT/.test(log.confirms[0]), 'asks first, says what is sent');
    assert.equal(log.ai.length, 1); assert.equal(log.ai[0].isJson, true); assert.equal(log.ai[0].opts.feature, 'case_article'); assert.equal(log.ai[0].model, 'gpt-6-luna', "the Articles editor's default model");
    const [coll, doc0] = log.added[0]; const doc = Object.assign(JSON.parse(JSON.stringify(doc0)), { startAt: doc0.startAt });   // plain copy (the vm has its own Object / Array)
    assert.equal(coll, 'articles'); assert.equal(doc.status, 'draft', 'a DRAFT — never scheduled'); assert.deepEqual(doc.links, []); assert.equal(doc.caseSource, 'cases/c1');
    assert.deepEqual([Object.prototype.toString.call(doc.startAt) === '[object Date]', doc.aiDrafted, doc.aiDraftedModel, doc.createdBy, doc.cover.emoji, doc.audience.groups.length], [true, true, 'gpt-6-luna', 'me@x', '🩺', 0]);
    assert.deepEqual(Object.keys(doc.title), ['en', 'th', 'ko']); assert.ok(doc.body.en.split('\n').length === 3);
    assert.deepEqual(JSON.parse(JSON.stringify(log.updated)), [['cases', 'c1', { articleId: 'newArt', articleTitle: 'Green discharge? Ask first 🩺' }]], 'the case remembers its article');
    await new Promise(r => setTimeout(r, 0));   // openArticle waits for Articles.load()
    assert.deepEqual([...log.opened], ['open', 'edit:newArt'], 'the editor opens on it');
    assert.ok(log.toasts.some(t => /Draft article/.test(t)));
    assert.deepEqual([btn.innerHTML, btn.disabled], ['📰', false], 'the button is restored');
    assert.equal(CASES.c1.articleId, 'newArt', 'the in-memory case is updated too (the ring turns green at once)');
    // 4. declined confirm → nothing happens
    reset(); AIOUT = [OK]; CONFIRM = false; CASES.c1.articleId = ''; delete CASES.c1.articleId;
    await ctx.writeArticleFromCase('c1', { innerHTML: '', disabled: false });
    assert.deepEqual([log.ai.length, log.added.length, log.updated.length], [0, 0, 0]);
    // 5. a case with an article: confirm "write another?" — Cancel opens the existing one
    reset(); AIOUT = [OK]; CONFIRM = false;
    await ctx.writeArticleFromCase('c3', null);
    await new Promise(r => setTimeout(r, 0));
    assert.ok(/already has an article/.test(log.confirms[0])); assert.deepEqual([...log.opened], ['open', 'edit:artOld']); assert.equal(log.ai.length, 0);
    // 6. no note → says so, no AI
    reset(); AIOUT = [OK];
    await ctx.writeArticleFromCase('c2', null);
    assert.ok(log.toasts.some(t => /no note/.test(t))); assert.equal(log.ai.length, 0);
    // 7. bad JSON twice → an error toast, nothing saved, the button restored
    reset(); AIOUT = ['not json', '{"title":"x"}']; const b2 = { innerHTML: '📰', disabled: false }; delete CASES.c1.articleId;
    await ctx.writeArticleFromCase('c1', b2);
    assert.equal(log.ai.length, 2, 'one retry'); assert.deepEqual([log.added.length, log.updated.length], [0, 0]); assert.ok(log.toasts.some(t => /invalid JSON/.test(t))); assert.deepEqual([b2.innerHTML, b2.disabled], ['📰', false]);
    // 8. the model throws → toast, nothing saved
    reset(); AIOUT = [new Error('proxy down')];
    await ctx.writeArticleFromCase('c1', null);
    assert.ok(log.toasts.some(t => /proxy down/.test(t))); assert.equal(log.added.length, 0);
    // 9. an empty article is refused
    reset(); AIOUT = [JSON.stringify({ title: { en: 'T' }, body: { en: '', th: '' } })];
    await ctx.writeArticleFromCase('c1', null);
    assert.ok(log.toasts.some(t => /empty article/.test(t))); assert.equal(log.added.length, 0);
    // 10. a missing case / no AI core
    reset(); await ctx.writeArticleFromCase('nope', null); assert.equal(log.confirms.length, 0);
    const keep = ctx.callUniversalAI; ctx.callUniversalAI = undefined; reset(); await ctx.writeArticleFromCase('c1', null);
    assert.ok(log.toasts.some(t => /AI core not loaded/.test(t))); ctx.callUniversalAI = keep;
    console.log('PASS: Case actions — ✅ / 🖼️ / 📰 icon-only (ring when an article exists), ⋯ keeps the rest; 📰 prompt has no HN / name / initials, saves an Articles DRAFT + remembers it on the case + opens it; declined / already-has-one / no note / bad JSON / model error / empty article all handled');
})().catch(e => { console.error(e); process.exit(1); });
