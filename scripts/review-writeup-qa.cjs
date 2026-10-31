// V102.507–508 / V101.244: 📰 in the quiz Review header (right after the PDF icon) = a PERSONAL review for this one intern — the REAL reviewQuiz()
// in public/admin.html (file://, network blocked, Firebase = self-returning Proxy, fake attempt doc, stubbed callUniversalAI + db).
// Checks: the button sits next to PDF, icon-only with EN + TH + KO tooltips; the click opens the panel under the header and runs NO AI (V102.511) — ✨ drafts;
// the prompt carries the wrong / partial questions (stem, the pick, the key, the explanation) and NO name, id or picture, and asks for
// V102.550: short stories grouped by concept, each with its reason and a 🧠 memory aid, no invented facts, not a per-question key; the draft lands in the textarea, nothing is written until Send;
// Send writes quiz_attempts.adminComment (+At/+By) and nothing else; ✨ asks before replacing text; the language chip changes the prompt;
// an existing adminComment prefills the box and does NOT auto-draft; an all-correct attempt gets a dimmed button and no panel; phone 390 px fits.
// Static: the intern's result card + History row escape the comment and keep line breaks; Articles.fromMistakes is gone.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;
const html = fs.readFileSync('public/admin.html', 'utf8'), aj = fs.readFileSync('public/articles-admin.js', 'utf8');
const idx = fs.readFileSync('public/index.html', 'utf8'), hcss = fs.readFileSync('public/history-compact.css', 'utf8');

// ---- static
assert.ok(!aj.includes('fromMistakes'), 'Articles.fromMistakes removed — the 📰 is not an Articles feature');
assert.ok(!html.includes('_reviewWrongForArticle') && !html.includes('reviewWrongToArticle'), 'no leftover Articles hand-off in admin.html');
assert.match(html, /<script src="articles-admin\.js\?v=V102\.(50[7-9]|5[1-9]\d|[6-9]\d\d)"><\/script>/, 'articles-admin.js cache-busted');
assert.ok(idx.includes('<div class="qan-body">${fmtAdminNote(attempt.adminComment)}</div>'), 'intern result card: fmtAdminNote (escaped, **bold** highlighted)');
assert.ok(/\.qr-admin-note \{[^}]*background:#fffdf8;[^}]*color:#1f2937/.test(idx) && /\.qr-admin-note \.qan-body \{[^}]*white-space:pre-wrap/.test(idx), 'V101.246: the card is pale with dark text and keeps line breaks');
assert.ok(!idx.includes('<div style="background:var(--primary); color:white; padding:15px; border-radius:12px; margin-bottom:20px; box-shadow:0 4px 15px rgba(67,97,238,0.2)'), 'the solid blue card is gone');
{ const hw = fs.readFileSync('public/halloween.css', 'utf8'); assert.ok(/html\.hw \.qr-admin-note \{[^}]*dashed #fb923c/.test(hw) && hw.includes('html.hw .qr-admin-note::after { content: "🎃"'), 'halloween.css dresses the card in season only'); }
assert.match(idx, /halloween\.css\?v=V101\.(24[6-9]|2[5-9]\d|[3-9]\d\d)/, 'halloween.css cache-busted');
assert.ok(idx.includes('position:relative; white-space:pre-wrap;">') && idx.includes('</i>${fmtAdminNote(item.adminComment)}'), 'intern History row: fmtAdminNote + pre-wrap');
assert.ok(!idx.includes('"${attempt.adminComment}"') && !idx.includes('${item.adminComment}\n'), 'no raw adminComment left in index.html');
assert.ok(/\.history-compact \.hl-comment \{[^}]*white-space:pre-wrap;/.test(hcss), 'history-lean comment keeps line breaks');
assert.match(idx, /history-compact\.css\?v=V101\.(24[4-9]|2[5-9]\d|[3-9]\d\d)/, 'history-compact.css cache-busted');
// V101.245: **…** → <strong class="adm-key"> after escaping — the same regex in index.html and history-lean.js; everything else stays text
{
  const line = (idx.match(/window\.fmtAdminNote = .*$/m) || [])[0]; assert.ok(line, 'fmtAdminNote defined in index.html');
  const escapeHtml = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = new Function('escapeHtml', 'const window = {}; ' + line + ' return window.fmtAdminNote;')(escapeHtml);
  assert.equal(fmt('• x **ต้องตรวจ potassium** <b>y</b>\n**a** and **b**'), '• x <strong class="adm-key">ต้องตรวจ potassium</strong> &lt;b&gt;y&lt;/b&gt;\n<strong class="adm-key">a</strong> and <strong class="adm-key">b</strong>', 'bold marks become highlighted strong, HTML is escaped, newlines kept');
  assert.equal(fmt('**unclosed and 2*3'), '**unclosed and 2*3', 'stray asterisks stay as typed');
  assert.ok(fs.readFileSync('public/history-lean.js', 'utf8').includes('esc(s.adminComment).replace(/\\*\\*([^*\\n]{1,200}?)\\*\\*/g, \'<strong class="adm-key">$1</strong>\')'), 'history-lean.js applies the same bold rule');
  assert.ok(/\.adm-key \{[^}]*background:#fef3c7/.test(idx), 'the .adm-key highlight style exists');
  assert.match(idx, /history-lean\.js\?v=V101\.(24[5-9]|2[5-9]\d|[3-9]\d\d)/, 'history-lean.js cache-busted');
}

const mkQuiz = () => ({
  id: 'q1', title: 'Contraceptive Knowledge', shortTitle: 'Contra', quizType: 'standard', totalPoints: 1.5,
  questions: [
    { type: 'choice', q: 'Which advantage of the 24/4 regimen is best supported?', options: ['Less weight gain', 'Shorter hormone-free interval reduces withdrawal symptoms'], correct: 1, explanation: 'A shorter HFI blunts hormone withdrawal symptoms.' },
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
const DRAFT = 'สวัสดี Bew\nเรื่อง HFI สั้น…\n\nสู้ ๆ นะ';

async function open(browser, { width, height, quiz, attempt, dialogs = 'dismiss' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
    window.firebase = P; window.mermaid = P;
  });
  await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(ADMIN, { waitUntil: 'load' }); await page.waitForTimeout(400);
  page.on('dialog', d => { page.__dialogs = (page.__dialogs || []).concat(d.message()); dialogs === 'accept' ? d.accept() : d.dismiss(); });
  await page.evaluate(({ quiz, attempt }) => {
    [...document.querySelectorAll('body > *')].filter(e => /Admin Portal/.test(e.innerText || '')).forEach(e => e.style.setProperty('display', 'none', 'important'));
    const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
    attempt.cheatMonitoring = {}; attempt.timestamp = { toDate: () => new Date(), toMillis: () => Date.now() };
    window.__att = attempt; window.__writes = []; window.__prompts = []; window.__toasts = [];
    const ref = (c, id) => ({ id, get: async () => ({ exists: true, data: () => window.__att }),
      set: async d => { window.__writes.push(['set', c, id, Object.keys(d)]); },
      update: async d => { window.__writes.push(['update', c, id, Object.keys(d).sort(), typeof d.adminComment === 'string' ? d.adminComment : null, typeof d.adminCommentBy === 'string' ? d.adminCommentBy : null]); } });
    window.db = { collection: c => ({ doc: id => ref(c, id), add: async d => { window.__writes.push(['add', c, Object.keys(d)]); return { id: 'x' }; }, get: async () => ({ docs: [] }) }) };
    window.quizzesData = [quiz]; window.usersData = [];
    window.renderMdInline = window.renderMdInline || (t => String(t == null ? '' : t));
    window.showToast = (m) => { window.__toasts.push(String(m)); };
    window.callUniversalAI = async (model, prompt, json, img, sys, opts) => { window.__prompts.push({ model, prompt, json, img, opts }); await new Promise(r => setTimeout(r, 400)); return { text: 'สวัสดี Bew\nเรื่อง HFI สั้น…\n\nสู้ ๆ นะ' }; };   // slow enough for the busy-state assertion
    localStorage.removeItem('ai_review_writeup_lang'); localStorage.removeItem('ai_review_writeup_model');
  }, { quiz, attempt });
  await page.evaluate(() => reviewQuiz('a1')); await page.waitForTimeout(400);
  assert.equal(await page.locator('#reviewQuizOverlay').count(), 1, 'overlay renders');
  return { page, ctx, errs };
}
const noise = e => /ServiceWorker|browseAuditProvider|providerModelRailHtml|reading 'auth'|db\.collection is not a function/.test(e);
const waitIdle = page => page.waitForFunction(() => !document.getElementById('rv-writeup-draft').disabled);

(async () => {
  const browser = await chromium.launch();
  try {
    // ---- 1. desktop: the button, the panel, the prompt, Send
    {
      const { page, ctx, errs } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: mkAttempt() });
      const btn = page.locator('#rv-writeup-btn');
      assert.equal(await btn.count(), 1, 'one 📰 button');
      assert.equal(await btn.evaluate(b => b.previousElementSibling && b.previousElementSibling.getAttribute('aria-label')), 'Export PDF', 'it sits right after the PDF icon');
      assert.equal((await btn.innerText()).trim(), '', 'icon only — the words are in the tooltip');
      assert.equal(await btn.getAttribute('aria-disabled'), null);
      assert.equal(await btn.getAttribute('aria-expanded'), 'false');
      assert.match(await btn.getAttribute('title'), /Personal review for Bew — AI drafts from the 3 wrong answers.*quiz result and History/, 'EN tooltip: ' + await btn.getAttribute('title'));
      assert.match(await btn.getAttribute('data-th-title'), /รีวิวส่วนตัวสำหรับ Bew.*3 ข้อ/, 'TH tooltip');
      assert.match(await btn.getAttribute('data-kr-title'), /Bew.*3문항/, 'KO tooltip');
      const box = await btn.boundingBox(), pdf = await page.locator('#reviewQuizOverlay [aria-label="Export PDF"]').boundingBox();
      assert.equal(Math.round(box.width), Math.round(pdf.width), 'same size as the PDF icon'); assert.equal(Math.round(box.height), Math.round(pdf.height));
      const panel = page.locator('#rv-writeup');
      assert.equal(await panel.count(), 1, 'the panel is in the overlay'); assert.equal(await panel.isHidden(), true, 'folded until the click');
      assert.equal(await page.locator('#rv-writeup-text').inputValue(), '', 'empty box: no earlier review');
      assert.equal((await panel.locator('span').first().innerText()).trim(), '📰 Personal review', 'V102.511: the panel title carries no name');
      await btn.click();
      assert.equal(await panel.isVisible(), true, 'the panel opens under the header');
      assert.equal(await btn.getAttribute('aria-expanded'), 'true');
      assert.equal(await panel.evaluate(p => p.getBoundingClientRect().top >= document.querySelector('#reviewQuizOverlay > div > div').getBoundingClientRect().bottom - 1), true, 'under the header row');
      assert.equal(await page.evaluate(() => window.__prompts.length), 0, 'V102.511: opening the panel runs no AI');
      assert.equal(await page.locator('#rv-writeup-note').innerText(), 'Pick the language and model, then ✨', 'the empty panel says what to do');
      await page.locator('#rv-writeup-draft').click();
      assert.equal(await page.locator('#rv-writeup-draft').isDisabled(), true, 'busy while the AI drafts');
      await waitIdle(page);
      const p = await page.evaluate(() => window.__prompts);
      assert.equal(p.length, 1, 'one AI call, only after ✨');
      const pr = p[0].prompt;
      for (const s of ['Which advantage of the 24/4 regimen', 'Less weight gain', 'Shorter hormone-free interval reduces withdrawal symptoms', 'A shorter HFI blunts hormone withdrawal', 'Rank progestins', 'Second-generation progestins', 'Migraine with aura', 'No precautions', 'Estrogen is contraindicated',
        'short learning story in Thai', 'Contraceptive Knowledge', 'starts with "• "', 'grouped by concept', 'Do NOT go question by question', 'do NOT mention scores', 'starting with "🧠 "', 'why it feels right', 'invent no number, dose, study or guideline', 'no names', 'ครับ / ค่ะ', 'headed "Read more" (in Thai)', '2–4 specific sources', 'no URLs, no invented sources', 'in English (Latin script)', 'never transliterate', 'in **double asterisks**', 'and the **…** marks'])
        assert(pr.includes(s), 'the prompt carries: ' + s);
      for (const s of ['Postpartum breastfeeding', 'Skipped question', 'u-secret-77', 'example.test', 'Bew', 'Sample', 'article', 'popup'])
        assert(!new RegExp('(^|[^A-Za-z])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z]|$)', 'i').test(pr), 'the prompt must not carry: ' + s);   // whole word: "particles" is not "article"
      assert.equal(p[0].opts.feature, 'review_writeup', 'its own AI feature tag');
      assert.equal(await page.locator('#rv-writeup-text').inputValue(), DRAFT, 'the draft lands in the box, line breaks kept');
      assert.match(await page.locator('#rv-writeup-note').innerText(), /^✨ gpt-6-luna · \d+ s — read it, edit, then Send$/, 'note: model + seconds');
      assert.equal(await page.locator('#rv-writeup input[type=hidden][id^=ai-review-writeup-model-]').inputValue(), 'gpt-6-luna', 'the hidden model input carries the default');
      assert.deepEqual(await page.evaluate(() => window.__writes), [], 'nothing written before Send');
      assert.equal(await page.locator('#articlesModal:visible').count(), 0, 'the Article editor stays closed');
      // the model rail = the page's vendor-first rail (V102.487): vendor icons, then only that vendor's chips
      const rail = page.locator('#rv-writeup .text-ai-chips');
      assert.equal(await rail.count(), 1, 'one model rail in the panel');
      const vendors = await rail.locator('.mr-vendors .mr-vendor').evaluateAll(bs => bs.map(b => [b.dataset.provider, b.getAttribute('aria-pressed')]));
      assert(vendors.length >= 5, 'vendor icons: ' + JSON.stringify(vendors));
      const pressed = vendors.filter(v => v[1] === 'true').map(v => v[0]);
      assert.equal(pressed.length, 1, 'exactly one vendor pressed: ' + pressed);
      const shown = await rail.locator(':scope > button:not([hidden])').evaluateAll(bs => bs.map(b => [b.getAttribute('aria-label').split(' ')[0], b.classList.contains('active'), b.dataset.value]));
      assert(shown.length >= 1 && shown.every(c => c[0] === pressed[0]), 'only the pressed vendor\'s chips show: ' + JSON.stringify(shown));
      assert.equal(shown.filter(c => c[1]).map(c => c[2]).join(), 'gpt-6-luna', 'the active chip is the default model');
      const hiddenN = await rail.locator(':scope > button[hidden]').count(); assert(hiddenN > shown.length, 'the other vendors\' chips are hidden, not gone: ' + hiddenN);
      { const seat = await rail.evaluate(r => { const on = r.querySelector('.mr-vendor[aria-pressed="true"]'), c = r.querySelector(':scope > button:not([hidden])'); return [on.style.order, c.style.order]; }); assert.equal(Number(seat[1]), Number(seat[0]) + 1, 'V102.515: the chips are seated right after the pressed icon: ' + seat); }
      const other = vendors.find(v => v[1] !== 'true')[0];
      await rail.locator('.mr-vendor[data-provider="' + other + '"]').click();
      const shown2 = await rail.locator(':scope > button:not([hidden])').evaluateAll(bs => bs.map(b => [b.getAttribute('aria-label').split(' ')[0], b.dataset.value]));
      assert(shown2.length >= 1 && shown2.every(c => c[0] === other), 'another vendor icon shows its chips: ' + JSON.stringify(shown2));
      await rail.locator(':scope > button:not([hidden])').first().click();
      const pickedModel = shown2[0][1];
      assert.equal(await page.evaluate(() => localStorage.getItem('ai_review_writeup_model')), pickedModel, 'the pick is remembered');
      assert.equal(await rail.locator(':scope > button.active').getAttribute('data-value'), pickedModel, 'the picked chip is active');
      // V102.525: ONE flag chip that cycles 🇹🇭 → 🇺🇸 → 🇰🇷 → 🇹🇭 (the three-flag group is gone), on the header row with ✨ and Send at the right corner
      const lang = page.locator('#rv-writeup-lang');
      assert.equal(await lang.count(), 1, 'one language chip'); assert.equal(await page.locator('#rv-writeup .rv-lang').count(), 1, 'no other flags');
      assert.equal(await lang.getAttribute('data-lang'), 'th', 'Thai by default'); assert.match(await lang.getAttribute('title'), /^Language: Thai/); assert.match(await lang.getAttribute('data-th-title'), /ภาษา: ไทย/); assert.match(await lang.getAttribute('data-kr-title'), /언어: 태국어/);
      { const row = await page.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(), t = document.querySelector('#rv-writeup span').getBoundingClientRect(), p = document.getElementById('rv-writeup').getBoundingClientRect();
          return { title: Math.round(t.top), lang: Math.round(r('rv-writeup-lang').top), draft: Math.round(r('rv-writeup-draft').top), send: Math.round(r('rv-writeup-send').top), sendRight: Math.round(p.right - r('rv-writeup-send').right), box: Math.round(r('rv-writeup-text').top), sendBottom: Math.round(r('rv-writeup-send').bottom), rows: document.querySelectorAll('#rv-writeup > div').length }; });
        assert(Math.abs(row.lang - row.title) <= 12 && Math.abs(row.draft - row.title) <= 12 && Math.abs(row.send - row.title) <= 12, 'flag, ✨ and Send share the title row: ' + JSON.stringify(row));
        assert(row.sendRight >= 8 && row.sendRight <= 24, 'Send sits in the right corner (panel padding only): ' + row.sendRight);
        assert(row.box >= row.sendBottom, 'the box is below that row and nothing is below the box: ' + JSON.stringify(row)); assert.equal(row.rows, 1, 'the bottom button row is gone'); }
      await lang.click(); assert.equal(await lang.getAttribute('data-lang'), 'en', 'one tap → English'); assert.equal(await lang.innerText(), '🇺🇸'); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'rv-writeup-lang', 'focus stays on the chip');
      assert.equal(await page.evaluate(() => localStorage.getItem('ai_review_writeup_lang')), 'en', 'the pick is remembered');
      await lang.click(); assert.equal(await lang.getAttribute('data-lang'), 'ko', 'next tap → Korean'); await lang.click(); assert.equal(await lang.getAttribute('data-lang'), 'th', 'and back to Thai');
      await lang.click(); assert.equal(await lang.getAttribute('data-lang'), 'en');
      // ✨ with text in the box asks first; the dismissed confirm = no call
      await page.locator('#rv-writeup-draft').click(); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__prompts.length), 1, 'dismissed confirm → no second AI call');
      assert.match(page.__dialogs.pop(), /Replace the text in the box/, 'the confirm wording');
      await page.evaluate(() => { window.confirm = () => true; });
      await page.locator('#rv-writeup-draft').click(); await waitIdle(page);
      const p2 = await page.evaluate(() => window.__prompts);
      assert.equal(p2.length, 2, 'accepted confirm → a new draft'); assert(p2[1].prompt.includes('in English'), 'the English chip reached the prompt');
      assert.equal(p2[1].model, pickedModel, 'the picked model is the one called');
      // edit, then Send
      await page.locator('#rv-writeup-text').fill(DRAFT + '\nแก้โดยแอดมิน');
      await page.locator('#rv-writeup-send').click(); await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => window.__writes), [['update', 'quiz_attempts', 'a1', ['adminComment', 'adminCommentAt', 'adminCommentBy'], DRAFT + '\nแก้โดยแอดมิน', 'medlifeplus@gmail.com']], 'Send = one update of adminComment on the attempt, nothing else');
      assert.match(await page.locator('#rv-writeup-note').innerText(), /✓ Sent/); assert.deepEqual(await page.evaluate(() => window.__toasts), ['📰 Personal review sent']);
      await btn.click(); assert.equal(await panel.isHidden(), true, 'the button folds the panel again'); assert.equal(await btn.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(errs.filter(e => !noise(e)), [], 'no page errors: ' + errs);
      await ctx.close();
    }
    // ---- 2. AI failure → the note says so, the box stays empty, nothing written; Send on an empty box refuses
    {
      const { page, ctx } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: mkAttempt() });
      await page.evaluate(() => { window.callUniversalAI = async () => { throw new Error('proxy down'); }; });
      await page.locator('#rv-writeup-btn').click(); await page.locator('#rv-writeup-draft').click(); await waitIdle(page);
      assert.equal(await page.locator('#rv-writeup-note').innerText(), '✨ proxy down');
      assert.equal(await page.locator('#rv-writeup-text').inputValue(), '');
      await page.locator('#rv-writeup-send').click(); await page.waitForTimeout(100);
      assert.match(page.__dialogs.pop(), /Nothing to send/, 'empty Send refuses');
      assert.deepEqual(await page.evaluate(() => window.__writes), []);
      await ctx.close();
    }
    // ---- 3. an earlier review on the attempt → prefilled, no auto-draft
    {
      const att = mkAttempt(); att.adminComment = 'รีวิวเดิม\nบรรทัดสอง';
      const { page, ctx } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: att });
      assert.equal(await page.locator('#rv-writeup-text').inputValue(), 'รีวิวเดิม\nบรรทัดสอง', 'the box shows the review already sent');
      await page.locator('#rv-writeup-btn').click(); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__prompts.length), 0, 'no AI call on open (and none implied by the old text)');
      assert.equal(await page.locator('#rv-writeup-note').innerText(), '', 'no hint when the box already has text');
      await ctx.close();
    }
    // ---- 4. all correct → dimmed, tooltip says why, no panel, click does nothing
    {
      const att = mkAttempt(); att.answers = [1, 1, 1, 0, 0];
      const { page, ctx } = await open(browser, { width: 1280, height: 900, quiz: mkQuiz(), attempt: att });
      const btn = page.locator('#rv-writeup-btn');
      assert.equal(await btn.getAttribute('aria-disabled'), 'true');
      assert.match(await btn.getAttribute('title'), /No wrong answers/);
      assert.match(await btn.getAttribute('data-th-title'), /ไม่มีข้อที่ตอบผิด/);
      assert(Number(await btn.evaluate(b => getComputedStyle(b).opacity)) < 0.6, 'dimmed');
      assert.equal(await page.locator('#rv-writeup').count(), 0, 'no panel in the overlay');
      await btn.click({ force: true }); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__prompts.length), 0, 'no AI call');
      await ctx.close();
    }
    // ---- 5. phone: the header wraps without sideways scroll; the panel fits the width
    {
      const { page, ctx, errs } = await open(browser, { width: 390, height: 844, quiz: mkQuiz(), attempt: mkAttempt() });
      const hdr = await page.evaluate(() => { const h = document.querySelector('#reviewQuizOverlay > div > div'); return { sw: h.scrollWidth, cw: h.clientWidth }; });
      assert(hdr.sw <= hdr.cw + 1, 'no horizontal overflow in the header at 390 px: ' + JSON.stringify(hdr));
      const b = await page.locator('#rv-writeup-btn').boundingBox();
      assert(b && b.x >= 0 && b.x + b.width <= 390, 'the button is on screen: ' + JSON.stringify(b));
      await page.locator('#rv-writeup-btn').click(); await page.locator('#rv-writeup-draft').click(); await waitIdle(page);
      const pb = await page.locator('#rv-writeup').evaluate(p => ({ sw: p.scrollWidth, cw: p.clientWidth, r: p.getBoundingClientRect().right }));
      assert(pb.sw <= pb.cw + 1 && pb.r <= 390, 'the panel fits 390 px: ' + JSON.stringify(pb));
      assert.equal(await page.locator('#rv-writeup-text').inputValue(), DRAFT);
      assert.deepEqual(errs.filter(e => !noise(e)), [], 'no page errors: ' + errs);
      await ctx.close();
    }
    console.log('PASS: review 📰 personal write-up — V102.525 one flag chip that cycles + ✨ / Send on the title row (right corner); next to PDF, EN + TH + KO tooltips, panel under the header (no AI until ✨), one academic bullet-style prompt from the wrong answers (no name), draft in the box, Send = quiz_attempts.adminComment only, ✨ asks first, language chip, prefill without auto-draft, all-correct dimmed, 390 px fits; intern side escapes + pre-wrap; Articles.fromMistakes gone');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
