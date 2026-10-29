// V102.506: 📰 in the quiz Review header (right after the PDF icon) drafts a learning article from the attempt's wrong answers — the REAL
// reviewQuiz() in public/admin.html + the REAL articles-admin.js (file://, network blocked, Firebase = self-returning Proxy, fake attempt doc,
// stubbed callUniversalAI). Checks: the button sits next to PDF, icon-only with EN + TH tooltips; it sends the wrong / partial questions (stem,
// the pick, the key, the explanation) and never the learner's name / id / picture; the result opens in the Article editor as a NEW unsaved
// Draft over the Review overlay, nothing written to Firestore; an all-correct attempt gets a dimmed button that does nothing; phone 390 px fits.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;
const html = fs.readFileSync('public/admin.html', 'utf8'), aj = fs.readFileSync('public/articles-admin.js', 'utf8');
assert.match(html, /<script src="articles-admin\.js\?v=V102\.(50[4-9]|5[1-9]\d|[6-9]\d\d)"><\/script>/, 'articles-admin.js cache-busted');
assert.ok(aj.includes('fromMistakes: function (src) {'), 'Articles.fromMistakes exists');

const mkQuiz = () => ({
  id: 'q1', title: 'Contraceptive Knowledge', shortTitle: 'Contra', quizType: 'standard', totalPoints: 1.5,
  questions: [
    { type: 'choice', q: 'Which advantage of the 24/4 regimen is best supported?', options: ['Less weight gain', 'Shorter hormone-free interval reduces withdrawal symptoms'], correct: 1, explanation: 'A shorter HFI blunts hormone withdrawal (PMDD).' },
    { type: 'choice', q: 'Postpartum breastfeeding smoker wants a daily pill — which?', options: ['Combined pill', 'Progestin-only pill'], correct: 1 },
    { type: 'choice', q: 'Rank progestins by androgenic activity', options: ['Cyproterone > LNG > Drospirenone', 'Levonorgestrel > Norgestimate > Desogestrel'], correct: 1, explanation: 'Second-generation progestins are the most androgenic.' },
    { type: 'choice', q: 'Migraine with aura and spironolactone — drospirenone safety point?', options: ['Estrogen is contraindicated; check potassium', 'No precautions'], correct: 0 },
    { type: 'choice', q: 'Skipped question', options: ['A', 'B'], correct: 0 },
  ],
});
const mkAttempt = () => ({
  quizId: 'q1', userId: 'u-secret-77', displayName: 'Bew Sample', pictureUrl: 'https://example.test/bew.png', status: 'pending', correctCount: 2, totalQuestions: 5,
  answers: [0, 1, 0, 1, null], durations: [11, 9, 54, 69, 3],
});

async function open(browser, { width, height, quiz, attempt }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
    window.firebase = P; window.mermaid = P;
  });
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(ADMIN, { waitUntil: 'load' }); await page.waitForTimeout(400);
  page.on('dialog', d => d.dismiss());
  await page.evaluate(({ quiz, attempt }) => {
    [...document.querySelectorAll('body > *')].filter(e => /Admin Portal/.test(e.innerText || '')).forEach(e => e.style.setProperty('display', 'none', 'important'));
    const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
    attempt.cheatMonitoring = {}; attempt.timestamp = { toDate: () => new Date(), toMillis: () => Date.now() };
    window.__att = attempt; window.__writes = []; window.__prompts = [];
    const ref = (c, id) => ({ id, get: async () => ({ exists: true, data: () => window.__att }), set: async d => { window.__writes.push(['set', c, d]); }, update: async d => { window.__writes.push(['update', c, d]); } });
    window.db = { collection: c => ({ doc: id => ref(c, id), add: async d => { window.__writes.push(['add', c, d]); return { id: 'x' }; }, get: async () => ({ docs: [] }) }) };
    window.quizzesData = [quiz]; window.usersData = [];
    window.renderMdInline = window.renderMdInline || (t => String(t == null ? '' : t));
    window.callUniversalAI = async (model, prompt, json, img, sys, opts) => { window.__prompts.push({ model, prompt, json, img, opts }); await new Promise(r => setTimeout(r, 60)); return { text: 'TITLE: Progestins and the hormone-free interval\n---\n💡 **Shorter HFI** means fewer withdrawal symptoms.\n⚠️ Breastfeeding smokers: avoid estrogen.\n💊 drospirenone, levonorgestrel' }; };
    Articles._S.loaded = true;   // skip the articles list read (no Firestore here)
  }, { quiz, attempt });
  await page.evaluate(() => reviewQuiz('a1')); await page.waitForTimeout(400);
  assert.equal(await page.locator('#reviewQuizOverlay').count(), 1, 'overlay renders');
  return { page, ctx, errs };
}
const noise = e => /ServiceWorker|browseAuditProvider|providerModelRailHtml|reading 'auth'|db\.collection is not a function/.test(e);

(async () => {
  const browser = await chromium.launch();
  try {
    // ---- 1. desktop: the button, the prompt, the editor
    {
      const { page, ctx, errs } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: mkAttempt() });
      const btn = page.locator('#rv-wrong-article');
      assert.equal(await btn.count(), 1, 'one 📰 button');
      assert.equal(await btn.evaluate(b => b.previousElementSibling && b.previousElementSibling.getAttribute('aria-label')), 'Export PDF', 'it sits right after the PDF icon');
      assert.equal((await btn.innerText()).trim(), '', 'icon only — the words are in the tooltip');
      assert.equal(await btn.getAttribute('aria-disabled'), null);
      assert.match(await btn.getAttribute('title'), /learning article from the 3 wrong answers.*nothing is published/, 'EN tooltip counts wrong + partial: ' + await btn.getAttribute('title'));
      assert.match(await btn.getAttribute('data-th-title'), /ข้อที่ตอบผิด 3 ข้อ/, 'TH tooltip');
      const box = await btn.boundingBox(), pdf = await page.locator('#reviewQuizOverlay [aria-label="Export PDF"]').boundingBox();
      assert.equal(Math.round(box.width), Math.round(pdf.width), 'same size as the PDF icon'); assert.equal(Math.round(box.height), Math.round(pdf.height));
      await btn.click();
      const modal = page.locator('#articlesModal');
      await modal.waitFor({ state: 'visible' });
      const z = await page.evaluate(() => [Number(getComputedStyle(document.getElementById('articlesModal')).zIndex), Number(getComputedStyle(document.getElementById('reviewQuizOverlay')).zIndex)]);
      assert(z[0] > z[1], 'the Article editor opens over the Review overlay: ' + z);
      assert.equal(await page.evaluate(() => Articles._S.aiBusy), true, 'busy while the AI drafts');
      await page.waitForFunction(() => !Articles._S.aiBusy);
      const p = await page.evaluate(() => window.__prompts);
      assert.equal(p.length, 1, 'one AI call');
      const pr = p[0].prompt;
      for (const s of ['Which advantage of the 24/4 regimen', 'Less weight gain', 'Shorter hormone-free interval reduces withdrawal symptoms', 'A shorter HFI blunts hormone withdrawal', 'Rank progestins', 'Second-generation progestins', 'Migraine with aura', 'Contraceptive Knowledge'])
        assert(pr.includes(s), 'the prompt carries: ' + s);
      for (const s of ['Postpartum breastfeeding', 'Skipped question', 'Bew', 'u-secret-77', 'example.test', 'Sample'])
        assert(!pr.includes(s), 'the prompt must not carry: ' + s);
      assert.equal(p[0].opts.feature, 'article_draft', 'the Articles AI feature tag');
      const st = await page.evaluate(() => { const S = Articles._S; return { id: S.cur.id, status: S.cur.status, t: S.cur.title.en, b: S.cur.body.en, dirty: JSON.stringify(S.cur) !== S.base, note: S.aiNote, err: S.err }; });
      assert.equal(st.id, null, 'a NEW article (no id)'); assert.equal(st.status, 'draft', 'status Draft');
      assert.equal(st.t, 'Progestins and the hormone-free interval');
      assert.match(st.b, /^💡 \*\*Shorter HFI\*\*/); assert.equal(st.dirty, true, 'unsaved — the admin saves it');
      assert.match(st.note, /from 3 wrong answers — check it against the key, then save/); assert.equal(st.err, '');
      assert.deepEqual(await page.evaluate(() => window.__writes), [], 'nothing written to Firestore');
      assert.match(await page.locator('#art-bodyta').inputValue(), /Shorter HFI/, 'the editor shows the draft');
      await page.evaluate(() => Articles.close());
      assert.equal(await page.evaluate(() => document.getElementById('articlesModal').style.zIndex), '', 'close() clears the raised z-index');
      assert.equal(await page.locator('#reviewQuizOverlay').isVisible(), true, 'the Review is still there underneath');
      assert.deepEqual(errs.filter(e => !noise(e)), [], 'no page errors: ' + errs);
      await ctx.close();
    }
    // ---- 2. AI failure → the error shows, the empty draft stays unsaved
    {
      const { page, ctx } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: mkAttempt() });
      await page.evaluate(() => { window.callUniversalAI = async () => { throw new Error('proxy down'); }; });
      await page.locator('#rv-wrong-article').click();
      await page.waitForFunction(() => !Articles._S.aiBusy);
      assert.equal(await page.evaluate(() => Articles._S.err), '✨ proxy down');
      assert.deepEqual(await page.evaluate(() => window.__writes), []);
      await ctx.close();
    }
    // ---- 3. all correct → dimmed, tooltip says why, click does nothing
    {
      const att = mkAttempt(); att.answers = [1, 1, 1, 0, 0];
      const { page, ctx } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: att });
      const btn = page.locator('#rv-wrong-article');
      assert.equal(await btn.getAttribute('aria-disabled'), 'true');
      assert.match(await btn.getAttribute('title'), /No wrong answers/);
      assert.match(await btn.getAttribute('data-th-title'), /ไม่มีข้อที่ตอบผิด/);
      assert(Number(await btn.evaluate(b => getComputedStyle(b).opacity)) < 0.6, 'dimmed');
      await btn.click({ force: true });   // aria-disabled (so the tooltip still shows) — Playwright would otherwise refuse to click
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__prompts.length), 0, 'no AI call');
      assert.equal(await page.evaluate(() => { const m = document.getElementById('articlesModal'); return !!m && m.style.display === 'block'; }), false, 'the editor stays closed');
      await ctx.close();
    }
    // ---- 4. phone: the header wraps without sideways scroll; the button still works
    {
      const { page, ctx, errs } = await open(browser, { width: 390, height: 844, quiz: mkQuiz(), attempt: mkAttempt() });
      const hdr = await page.evaluate(() => { const h = document.querySelector('#reviewQuizOverlay > div > div'); return { sw: h.scrollWidth, cw: h.clientWidth }; });
      assert(hdr.sw <= hdr.cw + 1, 'no horizontal overflow in the header at 390 px: ' + JSON.stringify(hdr));
      const b = await page.locator('#rv-wrong-article').boundingBox();
      assert(b && b.x >= 0 && b.x + b.width <= 390, 'the button is on screen: ' + JSON.stringify(b));
      await page.locator('#rv-wrong-article').click();
      await page.locator('#articlesModal').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !Articles._S.aiBusy);
      assert.equal(await page.evaluate(() => Articles._S.cur.title.en), 'Progestins and the hormone-free interval');
      assert.deepEqual(errs.filter(e => !noise(e)), [], 'no page errors: ' + errs);
      await ctx.close();
    }
    console.log('PASS: review 📰 article from wrong answers — next to PDF, EN + TH tooltips, wrong + partial questions only (no learner data) in the prompt, a NEW unsaved Draft in the Article editor over the Review, no Firestore writes, AI errors shown, dimmed when all correct, phone 390 fits');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
