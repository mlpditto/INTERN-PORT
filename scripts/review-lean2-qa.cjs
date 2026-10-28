// V102.485: Review Quiz Attempt, lean round 2 — runs the REAL reviewQuiz() from public/admin.html (file://, network blocked, Firebase = self-returning
// Proxy, fake attempt doc). Checks: ONE helper (rvStatusOf) names every card skipped / typed / correct / partial / wrong / review; the chip rail
// (All · Rank · Incomplete · Partial · Wrong · Correct, zero-count chips hidden, "All" the only neutral state) filters the list; compact bars —
// a skipped or typed-not-ranked Rank card starts folded to one line, the rest open, ONE Expand all / Collapse all, a per-card fold button, state
// that survives the re-render after Save score; the "0.32 / 1.00 pts" and "⚠ Low active (0%)" chips on the Cheat / Timing strip while the two
// approve buttons stay SEPARATE; the Rank "📋 Copy key" on the Correct line; the orange unsaved dot on 💾; a leaner controls row with a ≥ 40 px hit area.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

const R = (q, options, tiers, unsafe) => ({ type: 'rank', q, accepted: [], options, tiers, unsafe: unsafe || options.map(() => 0), why: options.map(() => ''), correct: [tiers.indexOf(0)] });
const mkQuiz = () => ({
  id: 'q1', title: 'Daily Quiz - D1', shortTitle: 'D1', quizType: 'standard', totalPoints: 1,
  questions: [
    R('Acute diarrhea, first choice?', ['Oral rehydration salts (ORS)', 'Loperamide', 'Racecadotril', 'Bismuth subsalicylate'], [0, 1, 1, 1]),
    R('GERD in pregnancy, first choice?', ['Ranitidine 150 mg', 'Calcium carbonate', 'Gaviscon', 'Metoclopramide 10 mg', 'Omeprazole 20 mg'], [1, 0, 0, 2, 1]),
    R('Non-drowsy antihistamine for an older adult?', ['loratadine 10 mg', 'fexofenadine 180 mg', 'cetirizine 10 mg', 'chlorpheniramine 4 mg', 'diphenhydramine 25 mg'], [0, 0, 0, 2, 2]),
    R('Non-steroid nasal spray, regular use?', ['Saline', 'Azelastine', 'Cromolyn', 'Ipratropium', 'Oxymetazoline'], [0, 0, 1, 2, 2]),
    { type: 'choice', q: 'Contraindicated in the first trimester?', options: ['Paracetamol', 'Isotretinoin', 'Cetirizine', 'Calcium carbonate'], correct: 1 },
    { type: 'choice', q: 'First-line for moderate allergic rhinitis?', options: ['Oral decongestant', 'Intranasal corticosteroid', 'Antibiotic', 'Saline only'], correct: 1 },
    { type: 'choice', q: 'Maximum daily paracetamol (adult)?', options: ['2 g', '3 g', '4 g', '6 g'], correct: 2 },
    R('Pregnant woman asks for an antihistamine — confirm what first?', ['Fever / cough', 'Trimester', 'Brand / price', 'Allergies / conditions', 'Past antihistamine'], [1, 0, 2, 1, 2]),
    R('Dull headache 2 days, no fever — which class first?', ['Paracetamol', 'NSAIDs', 'Triptan', 'Opioid', 'Ergotamine'], [0, 1, 2, 2, 2]),
    R('Dry cough 3 days — which first?', ['Dextromethorphan', 'Paracetamol', 'Chlorpheniramine', 'Guaifenesin', 'Amoxicillin'], [0, 1, 1, 2, 2]),
    R('Watery diarrhea 1 day — rank the options', ['Loperamide', 'Probiotics', 'Oral Rehydration Solution (ORS)', 'Ciprofloxacin', 'Racecadotril'], [1, 2, 0, 2, 1], [0, 0, 0, 1, 0]),
  ],
});
const mkAttempt = () => ({
  quizId: 'q1', userId: 'u1', displayName: 'Sample Intern', pictureUrl: '', status: 'pending', correctCount: 1, totalQuestions: 11,
  answers: ['', 'ANTACID', 'BILASTINE', 'OXYMETAZOLINE', 1, 0, 2, null, '', '', null],
  durations: [17, 37, 25, 49, 20, 15, 12, 195, 6, 4, 32], durationsActive: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], firstAnswerLatencySec: [5, 9, 8, 12, 6, 4, 3, 40, 2, 1, 10],
  answerChangeCounts: [0, 1, 0, 1, 0, 0, 0, 3, 0, 0, 2],
});

async function open(browser, { width, height, quiz, attempt, otherAttemptId }) {
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
    const RQ = window.RankQuiz; const a = attempt;
    if (quiz.questions.length === 11) {   // the Rank sample; the all-choice quiz in the last case is used as is
      a.answers[1] = RQ.pack('ANTACID', null, null); a.answers[2] = RQ.pack('BILASTINE', null, null); a.answers[3] = RQ.pack('OXYMETAZOLINE', null, null);
      a.answers[7] = RQ.pack('', [1, 0, 3, 4, 2], null); a.answers[10] = RQ.pack('', [2, 4, 1, 3, 0], null);
    }
    a.cheatMonitoring = {}; a.timestamp = { toDate: () => new Date(), toMillis: () => Date.now() };
    window.__att = a;
    window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => window.__att }) }) }) };
    window.quizzesData = [quiz]; window.usersData = [];
    window.renderMdInline = window.renderMdInline || (t => String(t == null ? '' : t));
    window.__clip = []; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__clip.push(t); } }, configurable: true }); } catch (e) {}
  }, { quiz, attempt });
  await page.evaluate(() => reviewQuiz('q1_u1')); await page.waitForTimeout(500);
  assert.equal(await page.locator('#reviewQuizOverlay').count(), 1, 'overlay renders');
  return { page, ctx, errs };
}
const vis = (page) => page.evaluate(() => [...document.querySelectorAll('#reviewQuizOverlay .rv-q')].filter(w => w.dataset.rvHide !== '1').map(w => Number(w.dataset.rvI) + 1));
const openMap = (page) => page.evaluate(() => [...document.querySelectorAll('#reviewQuizOverlay .rv-q')].map(w => w.dataset.rvOpen === '1'));

(async () => {
  const browser = await chromium.launch();
  try {
    // ---- pure helper: one classification for every card
    {
      const { page, ctx } = await open(browser, { width: 1100, height: 3400, quiz: mkQuiz(), attempt: mkAttempt() });
      const r = await page.evaluate(() => {
        const rk = (typed, order) => ({ typed, order });
        const f = window.rvStatusOf;
        return [
          f({ isRank: true, rankSc: rk('', null), isCorrect: false, isPartial: false }),
          f({ isRank: true, rankSc: rk('ANTACID', null), isCorrect: false, isPartial: false }),
          f({ isRank: true, rankSc: rk('x', [1, 0]), isCorrect: false, isPartial: true }),
          f({ isRank: true, rankSc: rk('x', [1, 0]), isCorrect: false, isPartial: false }),
          f({ isRank: true, rankSc: rk('x', [1, 0]), isCorrect: true, isPartial: false }),
          f({ isRank: true, rankSc: rk('', null), isCorrect: true, isPartial: false }),   // an admin-approved skipped Rank is just correct
          f({ isChoice: true, studentAns: null, isCorrect: false, isPartial: false }),
          f({ isChoice: true, studentAns: 2, isCorrect: false, isPartial: false }),
          f({ isChoice: true, studentAns: 1, isCorrect: true, isPartial: false }),
          f({ isChoice: true, studentAns: '0', isCorrect: false, isPartial: true }),
          f({ studentAns: '', isCorrect: false }),
          f({ studentAns: 'free text', isCorrect: false }),
          f({ studentAns: 'free text', isCorrect: false, graded: false }),
          f({ studentAns: 'free text', isCorrect: true }),
          window.rvStatusLabel('partial', 0.7), window.rvStatusLabel('typed'), window.rvStatusLabel('skipped'),
        ];
      });
      assert.deepEqual(r, ['skipped', 'typed', 'partial', 'wrong', 'correct', 'correct', 'skipped', 'wrong', 'correct', 'partial', 'skipped', 'review', 'wrong', 'correct', 'Partial 70%', 'Typed · not ranked', 'Skipped'], 'status matrix: ' + JSON.stringify(r));
      await ctx.close();
    }

    // ---- 1. desktop: rail, opening rule, filter, expand / collapse, per-card fold, persistence
    {
      const { page, ctx, errs } = await open(browser, { width: 1100, height: 3400, quiz: mkQuiz(), attempt: mkAttempt() });
      const rail = page.locator('#rv-rail');
      assert.equal(await rail.count(), 1, 'the chip rail renders');
      const chipTxt = (await rail.locator('.rv-chip[data-f]').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
      assert.deepEqual(chipTxt, ['All 11', 'Rank 8', 'Incomplete 6', 'Partial 2', 'Wrong 1', 'Correct 2'], 'counts: zero-count chips ("Needs review") are not drawn: ' + chipTxt);
      assert.equal(await rail.locator('.rv-chip[data-f="all"]').getAttribute('aria-pressed'), 'true', 'All is the neutral state');
      for (const f of ['rank', 'inc', 'partial', 'wrong', 'correct']) assert.equal(await rail.locator('.rv-chip[data-f="' + f + '"]').getAttribute('aria-pressed'), 'false', f + ' is not preselected');
      // opening rule: skipped / typed-not-ranked Rank cards folded to one line, everything else open
      assert.deepEqual(await openMap(page), [false, false, false, false, true, true, true, true, false, false, true], 'Q1–Q4, Q9, Q10 start folded');
      const bars = await page.locator('#reviewQuizOverlay .rv-q[data-rv-open="0"] .rv-bar').allInnerTexts();
      assert.match(bars[0].replace(/\s+/g, ' '), /Q1.*Skipped.*0\.00 \/ 0\.09/, 'a folded bar: Q#, stem, status, score: ' + bars[0]);
      assert.match(bars[1].replace(/\s+/g, ' '), /Q2.*Typed · not ranked/, bars[1]);
      const barH = await page.locator('#reviewQuizOverlay .rv-q[data-rv-open="0"] .rv-bar').first().evaluate(n => n.getBoundingClientRect().height);
      assert(barH <= 44 && barH >= 38, 'a folded bar is one line: ' + barH);
      // the open card does not also show a bar; the folded one does not show its card
      assert.equal(await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="4"] .rv-bar').isVisible(), false);
      assert.equal(await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="0"] .rv-card').isVisible(), false);
      // filter: Partial → Q8 + Q11 only
      await rail.locator('.rv-chip[data-f="partial"]').click();
      assert.deepEqual(await vis(page), [8, 11]);
      assert.equal(await rail.locator('.rv-chip[data-f="partial"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await rail.locator('.rv-chip[data-f="all"]').getAttribute('aria-pressed'), 'false');
      await rail.locator('.rv-chip[data-f="inc"]').click();
      assert.deepEqual(await vis(page), [1, 2, 3, 4, 9, 10], 'Incomplete = skipped + typed-not-ranked');
      await rail.locator('.rv-chip[data-f="rank"]').click();
      assert.deepEqual(await vis(page), [1, 2, 3, 4, 8, 9, 10, 11]);
      await rail.locator('.rv-chip[data-f="wrong"]').click();
      assert.deepEqual(await vis(page), [6]);
      await rail.locator('.rv-chip[data-f="all"]').click();
      assert.equal((await vis(page)).length, 11);
      // ONE Expand all / Collapse all (acts on the visible cards only)
      const xall = rail.locator('.rv-xall');
      assert.match(await xall.innerText(), /Expand all/);
      await xall.click();
      assert.deepEqual(await openMap(page), Array(11).fill(true));
      assert.match(await xall.innerText(), /Collapse all/);
      await xall.click();
      assert.deepEqual(await openMap(page), Array(11).fill(false));
      // filter + expand cooperate: expand only the filtered cards
      await rail.locator('.rv-chip[data-f="inc"]').click();
      await xall.click();
      await rail.locator('.rv-chip[data-f="all"]').click();
      assert.deepEqual(await openMap(page), [true, true, true, true, false, false, false, false, true, true, false], 'Expand all opened only the six visible Incomplete cards');
      // per-card fold button on an open card
      await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="4"] .rv-bar').click();
      assert.equal((await openMap(page))[4], true, 'a folded bar opens its card');
      await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="4"] .rv-fold').click();
      assert.equal((await openMap(page))[4], false, 'the fold button on an open card folds it back to one line');
      // the filter and the open cards survive the re-render that follows Save score / Mark correct
      await rail.locator('.rv-chip[data-f="wrong"]').click();
      await page.evaluate(() => reviewQuiz('q1_u1')); await page.waitForTimeout(300);
      assert.deepEqual(await vis(page), [6], 'filter survives the re-render');
      assert.deepEqual((await openMap(page)).map((o, i) => (i === 0 ? o : null)).slice(0, 1), [true], 'open state survives too');
      assert.deepEqual(errs.filter(e => !/ServiceWorker|browseAuditProvider|providerModelRailHtml/.test(e)), [], 'no page errors: ' + errs);
      await ctx.close();
    }

    // ---- 2. the strip: the two moved chips; the approve buttons stay SEPARATE
    {
      const { page, ctx } = await open(browser, { width: 1100, height: 3400, quiz: mkQuiz(), attempt: mkAttempt() });
      const hdr = page.locator('#reviewQuizOverlay > div > div').first();
      const labels = await hdr.locator('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || b.innerText).trim()));
      assert.equal(labels.filter(l => /Full marks 100%/.test(l)).length, 1, 'Full marks stays its own button');
      assert.equal(labels.filter(l => /Actual \d\.\d\d pts/.test(l)).length, 1, 'Actual stays its own button');
      assert.match(await hdr.locator('button', { hasText: 'Full marks' }).getAttribute('onclick'), /approveQuizAttempt\('q1_u1'\)/);
      assert.match(await hdr.locator('button', { hasText: 'Actual' }).getAttribute('onclick'), /approveQuizAttemptActual\('q1_u1'\)/);
      const actual = (await hdr.locator('button', { hasText: 'Actual' }).innerText()).match(/(\d\.\d\d) pts/)[1];
      const strip = page.locator('#reviewQuizOverlay .rv-sig').first().locator('xpath=..');
      const stripTxt = (await strip.innerText()).replace(/\s+/g, ' ');
      assert(stripTxt.includes(actual + ' / 1.00 pts'), 'the points chip equals the Actual button (' + actual + '): ' + stripTxt);
      const flag = strip.locator('.rv-flag');
      assert.equal(await flag.count(), 1, 'the Low active chip sits on the strip');
      assert.match(await flag.innerText(), /Low active \(0%\)/);
      assert.equal(await page.locator('#rv-sig-timing').isHidden(), true, 'its only flag is Low active → the Timing card stays folded behind the chip');
      await flag.click();
      assert.equal(await page.locator('#rv-sig-timing').isVisible(), true, 'the ⚠ chip opens the Timing details');
      assert.equal(await page.locator('#reviewQuizOverlay .rv-sig[aria-controls="rv-sig-timing"]').getAttribute('aria-expanded'), 'true');
      assert.match(await page.locator('#rv-sig-timing').innerText(), /Low active ratio \(0%\)/);
      await ctx.close();
    }
    {
      // a SECOND flag (every first answer ultra-fast, no changes) keeps the Timing card open by itself
      const att = mkAttempt(); att.firstAnswerLatencySec = att.firstAnswerLatencySec.map(() => 1); att.answerChangeCounts = att.answerChangeCounts.map(() => 0);
      const { page, ctx } = await open(browser, { width: 1100, height: 3400, quiz: mkQuiz(), attempt: att });
      assert.equal(await page.locator('#rv-sig-timing').isVisible(), true, 'a reading with another flag is never hidden behind a click');
      await ctx.close();
    }

    // ---- 3. Copy key (Rank only, on the Correct line) + the unsaved dot + the controls row
    {
      const { page, ctx } = await open(browser, { width: 1100, height: 3400, quiz: mkQuiz(), attempt: mkAttempt() });
      await page.locator('#rv-rail .rv-xall').click();   // open everything
      assert.equal(await page.locator('#reviewQuizOverlay .rv-copykey').count(), 8, 'one per Rank card, none on the choice cards');
      const q8 = page.locator('#reviewQuizOverlay .rv-q[data-rv-i="7"]');
      const key = q8.locator('.rv-copykey');
      const label = q8.locator('span:text-is("Correct:")');
      const dy = Math.abs((await key.evaluate(n => n.getBoundingClientRect().top)) - (await label.evaluate(n => n.getBoundingClientRect().top)));
      assert(dy <= 8, 'Copy key shares the Correct: line (no extra row): Δtop=' + dy);
      await key.click();
      const clip = await page.evaluate(() => window.__clip);
      assert.equal(clip.length, 1);
      assert.match(clip[0], /^Q8 key \(best → worst\):\n1\. .+ — Best\n/, clip[0]);
      assert.equal(clip[0].split('\n').length, 6, 'a heading + five options: ' + clip[0]);
      const q11 = await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="10"] .rv-copykey').getAttribute('data-copy');
      assert.match(decodeURIComponent(q11), /Ciprofloxacin — Avoid ⚠/, 'unsafe options carry ⚠ in the copied key');
      assert.equal(await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="5"] .rv-copykey').count(), 0, 'no Copy key on a choice question');
      // unsaved dot on 💾
      const input = page.locator('#manual-score-q1_u1-5');
      const dot = page.locator('#reviewQuizOverlay .rv-q[data-rv-i="5"] .rv-dirty');
      assert.equal(await dot.isHidden(), true, 'no dot while the field equals what is saved');
      await input.fill('0.05');
      assert.equal(await dot.isVisible(), true, 'typing a different override lights the orange dot');
      assert.equal(await dot.evaluate(n => n.style.position), 'absolute', 'the dot is absolutely placed (no layout change)');
      await input.fill('');
      assert.equal(await dot.isHidden(), true, 'back to the saved value → dot off');
      await input.fill('0.05');
      // Save → the real code re-renders from the saved attempt: dot cleared, input carries the saved value
      await page.evaluate(() => { window.__att.manualScores = { 5: 0.05 }; return reviewQuiz('q1_u1'); }); await page.waitForTimeout(300);
      assert.equal(await page.locator('#manual-score-q1_u1-5').inputValue(), '0.05');
      assert.equal(await page.locator('#reviewQuizOverlay .rv-q[data-rv-i="5"] .rv-dirty').isHidden(), true, 'after a save the dot is cleared');
      // controls row: leaner than the 56 px of V102.484
      const rows = await page.evaluate(() => [...document.querySelectorAll('#reviewQuizOverlay .rv-card')].filter(c => c.offsetParent).map(c => { const s = c.querySelector('[title="Q Score"]'); const r = s.parentElement.parentElement.getBoundingClientRect(); return Math.round(r.height); }));
      assert(rows.length >= 7 && rows.every(h => h <= 46), 'controls row ≤ 46 px (was 56): ' + rows);
      // ≥ 40 px effective hit area for the small controls (the ::after reaches past the visible pill)
      const reach = await page.evaluate(() => {
        const card = [...document.querySelectorAll('#reviewQuizOverlay .rv-card')].find(c => c.offsetParent && c.querySelector('[title="Save Q Score"]'));
        const out = [];
        for (const sel of ['[title="Save Q Score"]', '[aria-label^="Copy question"]', '[title="See Full Question"]']) {
          const b = card.querySelector(sel), r = b.getBoundingClientRect(), x = r.left + r.width / 2;
          const up = document.elementFromPoint(x, r.top - 4), dn = document.elementFromPoint(x, r.bottom + 4);
          out.push({ sel, h: Math.round(r.height), up: !!(up && b.contains(up)), dn: !!(dn && b.contains(dn)) });
        }
        const chip = document.querySelector('#rv-rail .rv-chip[data-f="all"]'), cr = chip.getBoundingClientRect(), cx = cr.left + cr.width / 2;
        const cu = document.elementFromPoint(cx, cr.top - 4), cd = document.elementFromPoint(cx, cr.bottom + 4);
        out.push({ sel: 'chip', h: Math.round(cr.height), up: !!(cu && chip.contains(cu)), dn: !!(cd && chip.contains(cd)) });
        return out;
      });
      for (const o of reach) assert(o.up && o.dn, 'hit area reaches ≥ 4 px past ' + o.sel + ' (visible h ' + o.h + '; the floppy / copy / list icons are Font Awesome, which does not load offline — the ::after is what is measured): ' + JSON.stringify(o));
      await ctx.close();
    }

    // ---- 4. phone: no sideways scroll, the rail wraps, the meta text steps aside
    {
      const { page, ctx } = await open(browser, { width: 390, height: 3000, quiz: mkQuiz(), attempt: mkAttempt() });
      const ov = await page.evaluate(() => { const b = document.querySelector('#reviewQuizOverlay > div > div:nth-child(2)'); return { sw: b.scrollWidth, cw: b.clientWidth }; });
      assert(ov.sw <= ov.cw + 1, 'no horizontal overflow at 390 px: ' + JSON.stringify(ov));
      assert.equal(await page.locator('#reviewQuizOverlay .rv-meta').isHidden(), true, 'the "11 questions · EXAM" text steps aside on a phone');
      assert.equal(await page.locator('#rv-rail').isVisible(), true);
      const bar = await page.locator('#reviewQuizOverlay .rv-bar').first().evaluate(n => n.getBoundingClientRect().height);
      assert(bar <= 44, 'a folded bar stays one line on a phone: ' + bar);
      await ctx.close();
    }

    // ---- 5. nothing to filter by, nothing folded → no rail at all (hide-empty)
    {
      const quiz = { id: 'q1', title: 'T', shortTitle: 'T', quizType: 'standard', totalPoints: 1, questions: Array.from({ length: 4 }, (_, i) => ({ type: 'choice', q: 'Q ' + (i + 1), options: ['A', 'B'], correct: 1 })) };
      const att = { quizId: 'q1', userId: 'u1', displayName: 'nt', pictureUrl: '', status: 'pending', correctCount: 4, totalQuestions: 4, answers: [1, 1, 1, 1] };
      const { page, ctx } = await open(browser, { width: 1100, height: 2000, quiz, attempt: att });
      assert.equal(await page.locator('#rv-rail').count(), 0, 'an all-correct attempt has nothing to filter → no rail');
      assert.equal(await page.locator('#reviewQuizOverlay .rv-q[data-rv-open="0"]').count(), 0);
      await ctx.close();
    }
    console.log('PASS: review lean 2 — one status helper, chip rail + filter, compact bars (skipped / typed-not-ranked fold) + Expand all, state survives re-render, pts + Low active chips on the strip (approve buttons separate), Copy key on the Correct line, unsaved dot, leaner controls row with ≥ 40 px hit areas');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
