// V102.94: Quiz Engine row, lean + inline — the REAL generateRow / qaIconFlags / CSS from public/admin.html.
// Checks: 3 columns, line 1 = title (short) + quality badges, line 2 = every flag as an icon-only chip (words in title/aria-label,
// click handlers kept, numbers kept), Items + pts inline in one cell, no stray third line.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8');
function grabBlock(startMarker, openChar = '{') {
  const i = html.indexOf(startMarker);
  assert(i > -1, 'missing ' + startMarker);
  let d = 0;
  for (let j = html.indexOf(openChar, i + startMarker.length - 1); j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}' && --d === 0) return html.slice(i, j + 1);
  }
  throw new Error('unbalanced ' + startMarker);
}
function grabTable(id) {
  const i = html.indexOf('<table id="' + id + '"');
  assert(i > -1, 'missing table ' + id);
  return html.slice(i, html.indexOf('</table>', i) + 8);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('');
    await page.setContent('<meta charset="utf-8">' + styles + '<div style="padding:12px">' + grabTable('quizzesTableActive') + grabTable('quizzesTableInactive') + '</div>');
    const generateRow = grabBlock('const generateRow = (q, isActiveSection) => {');
    const iconFlags = html.slice(html.indexOf('window.qaIconFlags = function (html) {'), html.indexOf('window.quizLivePillHtml = function (q) {'));
    assert(iconFlags.length > 100, 'qaIconFlags not found');
    await page.addScriptTag({
      content: `
      var covByQuiz = { q1: [{ key: 'other', emoji: '📋', label: { en: 'Other' } }] }, covBuckets = {}, attemptsByQuiz = {}, selectedQuizIds = new Set();
      var QuizCover = { adminThumbnail: () => '<span class="thumb" style="display:inline-block;width:40px;height:40px;background:#ede9fe"></span>' };
      var escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      var classifyQuizOutliers = () => null, computeQuizCheatStats = () => ({ withData: 0 }), quizRecentlyLive = (q) => !!q.recent, isExamEligibleQuiz = () => false;
      var materialDisplayName = (m, i) => m.name || ('file ' + (i + 1));
      window.quizAuditBadgeHtml = (q) => '<span class="chip-audit">🧪 3.3</span>'; window.quizLivePillHtml = (q) => '<span class="qa-live">Live</span>';
      window.quizExamStyleLabel = (s) => s; window._matClickStats = { q2: { total: 5, users: new Set(['a', 'b']) } }; window.quizCounts = {};
      ${iconFlags}
      ${generateRow}
      window.__rows = {
        q1: generateRow({ id: 'q1', title: 'Retail Pharmacy-2', shortTitle: 'Retail-2', quizType: 'graded', oneTimeMode: true, targetGroup: 'Public', isActive: true, questions: new Array(15).fill({ type: 'mcq' }), totalPoints: 1.5 }, true),
        q2: generateRow({ id: 'q2', title: 'Abx Basics (Template)', shortTitle: '', quizType: 'read_only', isPoll: true, isTemplate: true, unlockScore: 20, examStyle: 'open-book', targetGroup: 'Intern-A', isActive: true, notifyGroup: true, recent: false, materials: [{ url: 'u1', name: 'a.pdf' }, { url: 'u2', name: 'b.pdf' }], questions: new Array(24).fill({ type: 'mcq' }), totalPoints: 1 }, false),
      };
      document.querySelector('#quizzesTableActive tbody').innerHTML = window.__rows.q1 + window.__rows.q2;`
    });
    const tbody = page.locator('#quizzesTableActive tbody');
    const row = (n) => tbody.locator('tr').nth(n);

    // headers: 3 columns, Items and Score/Q merged
    for (const id of ['quizzesTableActive', 'quizzesTableInactive']) {
      assert.deepEqual(await page.locator('#' + id + ' thead th').allInnerTexts(), ['Title', 'Items · pts', 'Action']);
    }
    assert.equal(await row(0).locator('td').count(), 3, 'row has 3 cells');

    // line 1: title + (short); the feedback / audit badges share line 2 with the flags (V102.101)
    const l1 = (await row(0).locator('.qa-l1').innerText()).replace(/\s+/g, ' ');
    assert(l1.includes('Retail Pharmacy-2') && l1.includes('(Retail-2)') && !l1.includes('⭐') && !l1.includes('3.3'), 'line 1: ' + l1);
    const l2txt = (await row(0).locator('.qa-l2').innerText()).replace(/\s+/g, ' ');
    assert(l2txt.includes('⭐') && l2txt.includes('3.3'), 'line 2 carries feedback + audit: ' + l2txt);
    const l2tops = await row(0).locator('.qa-l2 > *').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    assert(Math.max(...l2tops) - Math.min(...l2tops) < 12, 'badges and flags sit on ONE line: ' + l2tops);
    assert.equal(await row(1).locator('.qa-sh').count(), 0, 'no "(-)" when there is no short title');
    // the short title is a repeat of the full one (any case, template suffix ignored) → shown once
    const dup = await page.evaluate(() => [generateRow({ id: 'q3', title: 'CPA0910-2025-E4/DRSP', shortTitle: 'cpa0910-2025-e4/drsp ', quizType: 'graded', questions: [] }), generateRow({ id: 'q4', title: 'Abx (Template)', shortTitle: 'Abx', isTemplate: true, quizType: 'graded', questions: [] })]);
    assert(dup.every(h => !h.includes('qa-sh')), 'same short title is not repeated');

    // line 2: every flag is an icon-only chip
    const chips1 = row(0).locator('.qa-l2 .qa-fi');
    assert.equal(await chips1.count(), 5, 'graded, one-time, group, notify (milestone), category');
    assert.equal(await row(0).locator('.qa-l2 .badge').count(), 0, 'no wordy badge left');
    assert.doesNotMatch((await row(0).locator('.qa-l2').innerText()).replace(/\s+/g, ''), /[A-Za-z]/, 'no words on line 2');
    const titles1 = await chips1.evaluateAll(els => els.map(e => e.title));
    for (const w of ['GRADED', 'ONE-TIME', 'Target group: Public', 'MILESTONE', 'Other']) assert(titles1.some(t => t.includes(w)), w + ' is in a tooltip: ' + titles1.join(' | '));
    assert((await chips1.evaluateAll(els => els.every(e => e.getAttribute('aria-label')))), 'every chip has an aria-label');
    assert.match(await row(0).locator('.qa-l2 .qa-fi[title*="MILESTONE"]').getAttribute('onclick'), /toggleQuizNotify\('q1', false\)/, 'notify chip still toggles');
    assert.match(await row(0).locator('.qa-l2 .qa-fi[title*="Other"]').getAttribute('onclick'), /openQuizCoverageList\('other', 'q1'\)/, 'category chip still opens the list');
    const tops = await chips1.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    assert(Math.max(...tops) - Math.min(...tops) <= 2, 'flags share one line: ' + tops);

    // row 2: template / unlock / materials / clicks / exam style / poll / learning — numbers survive, handlers survive
    const chips2 = row(1).locator('.qa-l2 .qa-fi');
    const t2 = await chips2.evaluateAll(els => els.map(e => e.title + '=>' + (e.querySelector('.qa-fi-n') || {}).textContent));
    assert(t2.some(x => /Hidden from interns/.test(x) && x.endsWith('=>20')), 'unlock keeps its number: ' + t2.join(' | '));
    assert(t2.some(x => /documents/i.test(x) && x.endsWith('=>2')), 'materials keep their count');
    assert(t2.some(x => /opened 5 times/.test(x) && x.endsWith('=>5')), 'click count kept');
    assert(t2.some(x => /^Template/.test(x)) && t2.some(x => /Exam style: open-book/.test(x)) && t2.some(x => /EVERY/.test(x)) && t2.some(x => /POLL/.test(x)) && t2.some(x => /LEARNING/.test(x)), 'template / exam style / EVERY / poll / learning present: ' + t2.join(' | '));
    assert.match(await row(1).locator('.qa-l2 .qa-fi[title^="Template"]').getAttribute('onclick'), /toggleTemplateStatus\('q2', true\)/);
    assert.match(await row(1).locator('.qa-l2 .qa-fi[title*="documents"]').first().getAttribute('onclick'), /adminOpenQuizMaterials\('q2'\)/);

    // Items + pts: one cell, inline, stepper wired
    const met = (await row(0).locator('.qa-met').innerText()).replace(/\s+/g, ' ');
    assert(/15\s*items/.test(met) && /1\.5\s*pts/.test(met), 'items and pts inline: ' + met);
    assert.equal(await row(0).locator('.qa-met .qa-stp button').count(), 2);
    assert.match(await row(0).locator('.qa-met .qa-stp button').first().getAttribute('onclick'), /adjustQuizPoints\('q1', 0\.1\)/);
    assert.equal(await row(0).locator('.qa-met br').count(), 0, 'no stacked label under the numbers');

    // height: the whole row is two lines (≈ title line + one chip line), two lines; the old three-line row measured ~150px in the user screenshot
    const h = await row(0).evaluate(n => Math.round(n.getBoundingClientRect().height));
    assert(h <= 100, 'row height ' + h);
    assert.deepEqual(pageErrors, []);
    console.log('PASS: quiz row lean + inline — 3 columns, icon-only flags with tooltips/handlers, inline items·pts, row height ' + h + 'px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
