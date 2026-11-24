// V102.702 (owner pick A, mockup-quiz-drilldown/A-lean.png) — the Quiz Insight tag drill-down, lean. The REAL admin.html in Chromium,
// Firebase stubbed. Proves: the header shows the score once ("9/10 ✓", the % in its tooltip) and the co-occurring tag as a 🏷 chip (no
// "+1 co-occurring", no "1 attempt"); ❌ n; a wrong question folded with its answer inline "✗ 1 → ✓ 2"; 🧭 Practice n with ONE 📤 ส่งทั้งหมด
// (no LINE button per row) that opens the LINE reminder with every title as a bullet; no 🎓 icon; m/n only on a partial match; the first 3
// rows + "＋2 more ▾"; ＋ Quest writes one side_quests doc and turns ✓ Added (disabled), still ✓ after a re-render; 🔁 Retake rows show the
// previous %; no Close button (✕ stays) and the window is only as tall as its content; Thai titles are visible.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(pathToFileURL(path.resolve('public/index.html').replace('index.html', 'admin.html')).href);
    await page.waitForFunction(() => typeof renderTagDrillDownContent === 'function' && document.readyState === 'complete');
    const D = {
      group: { tags: ['Migraine & Headache', 'Vaginal candidiasis'], correct: 9, total: 10, avg: 90, attempts: 1 },
      wrong: [{ question: { q: 'A female patient, 26 years old, presents with thick white discharge. First-line?', type: 'choice', options: ['Metronidazole', 'Clotrimazole', 'Doxycycline', 'Ceftriaxone'], correct: 1 }, userAnswer: 0, qIdx: 5, quizTitle: 'Migraine & Headache', timestamp: Date.now() }],
      practice: [
        { id: 'p1', title: 'Imidazole', matchCount: 15, questionCount: 15 },
        { id: 'p2', title: 'Enhancing Everyday Practice in Women’s Infection Care', matchCount: 10, questionCount: 10 },
        { id: 'p3', title: 'การเลือกใช้และการส่งมอบยาคุมกำเนิดชนิดฮอร์โมนเดี่ยว', matchCount: 10, questionCount: 10 },
        { id: 'p4', title: 'แนวทางการวินิจฉัยและดูแลรักษาภาวะตกขาวจากเชื้อรา', matchCount: 10, questionCount: 10 },
        { id: 'p5', title: 'ไมเกรน', matchCount: 10, questionCount: 15 }],
      retake: [{ id: 'r1', title: 'Headache red flags', matchCount: 4, questionCount: 8, prevScore: 55 }],
    };
    const r = await page.evaluate(async (D) => {
      document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
      window.__adds = []; window.confirm = () => true; window.showToast = () => {};
      window.db = { collection: (n) => ({ add: async (v) => { window.__adds.push([n, v.title, v.sourceQuizId]); return { id: 'sq' }; } }) }; db = window.db;
      try { usersData = [{ id: 'U1', displayName: 'Joey' }]; } catch (e) { window.usersData = [{ id: 'U1', displayName: 'Joey' }]; }
      window._quizInsightCtx = { userId: 'U1', groups: [] };
      const render = () => renderTagDrillDownContent(D.group, D.wrong, D.practice, D.retake);
      render(); const m = document.getElementById('tagDrillDownModal'); m.style.display = 'flex';
      const q = (s) => m.querySelector(s), qa = (s) => [...m.querySelectorAll(s)];
      const out = {};
      out.stats = q('#drilldown-stats').textContent.trim(); out.pctTip = q('#drilldown-stats .dd-pill').title;
      out.closeBtn = qa('button').some((b) => b.textContent.trim() === 'Close'); out.x = !!q('.close-modal');
      out.secs = qa('.dd-sec').map((s) => s.textContent.replace(/\s+/g, ' ').trim());
      out.inline = q('.dd-q summary .dd-ans').textContent;
      out.rowLine = qa('.dd-sug .dd-line').length; out.cap = qa('#drilldown-body .fa-graduation-cap').length;
      const rows = () => qa('.dd-sug:not(.rt)');
      const shown = (x) => x.getBoundingClientRect().height > 0;   // on screen, not just the hidden attribute (display:flex once beat it)
      out.visible = rows().filter(shown).length; out.partial = rows().map((x) => (x.querySelector('.dd-part') || {}).textContent || '');
      out.thaiVisible = rows()[2].querySelector('.t').getBoundingClientRect().width > 50;
      out.more = q('.dd-more').textContent; q('.dd-more').click(); out.visibleAfter = rows().filter(shown).length; out.moreGone = !q('.dd-more');
      out.retake = qa('.dd-sug.rt').map((x) => x.textContent.replace(/\s+/g, ' ').trim());
      out.height = Math.round(q('.modal-content').getBoundingClientRect().height);
      // 📤 ส่งทั้งหมด → the LINE reminder with every practice title
      q('.dd-sec .dd-line-all').click();
      out.lineText = (document.getElementById('line-reminder-textarea') || {}).value || '';
      try { closeLineReminderModal(); } catch (e) {}
      // ＋ Quest → ✓ Added, and it stays after a re-render
      await invokeAssignAction(0, rows()[0].querySelector('.dd-add'));
      out.added = [rows()[0].querySelector('.dd-add').textContent, rows()[0].querySelector('.dd-add').disabled, window.__adds.slice()];
      render(); out.afterRender = [rows()[0].querySelector('.dd-add').textContent, rows()[1].querySelector('.dd-add').textContent];
      return out;
    }, D);

    assert.equal(r.stats, '9/10 ✓🏷 Vaginal candidiasis', 'score once + the co-occurring tag: ' + r.stats);
    assert.equal(r.pctTip, '90.0%', 'the % is the tooltip');
    assert.equal(r.closeBtn, false, 'no Close button'); assert.ok(r.x, '✕ stays');
    assert.deepEqual(r.secs.map((s) => s.replace(/ ส่งทั้งหมด$/, '')), ['❌ 1', '🧭 Practice 5', '🔁 Retake 1'], JSON.stringify(r.secs));
    assert.equal(r.inline, '✗ 1 → ✓ 2', 'the answer inline');
    assert.equal(r.rowLine, 0, 'no LINE button per suggestion'); assert.equal(r.cap, 0, 'no 🎓 icon');
    assert.equal(r.visible, 3, 'the first 3'); assert.equal(r.more, '＋2 more ▾'); assert.equal(r.visibleAfter, 5); assert.ok(r.moreGone);
    assert.deepEqual(r.partial, ['', '', '', '', '10/15'], 'm/n only on a partial match');
    assert.ok(r.thaiVisible, 'Thai titles are visible');
    assert.equal(r.retake.length, 1); assert.equal(r.retake[0], 'Headache red flags' + '4/8' + '55%' + '＋ Quest','retake: title · 4/8 · previous 55% · ＋ Quest');
    assert.ok(r.height < 700, 'the window fits its content: ' + r.height);
    for (const t of ['Imidazole', 'ไมเกรน', 'แนวทางการวินิจฉัย']) assert.ok(r.lineText.includes('• ' + t), '📤 sends every title: ' + r.lineText);
    assert.match(r.lineText, /^📚 แอดมินแนะนำ quiz\n/); assert.match(r.lineText, /Tag: Migraine & Headache/);
    assert.deepEqual(r.added, ['✓ Added', true, [['side_quests', '📚 Practice: Imidazole', 'p1']]], '＋ Quest → one side quest + ✓ Added');
    assert.deepEqual(r.afterRender, ['✓ Added', '＋ Quest'], 'still ✓ after a re-render; the others unchanged');
    assert.deepEqual(errors.filter((e) => !/ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase|Cannot read properties of undefined/.test(e)), [], 'no page errors: ' + errors);
    console.log('tag-drilldown-lean-qa: OK — score once + tag chip, ✗ → ✓ inline, one 📤 for the list, top 3 + more, m/n partial only, ✓ Added kept, no Close, fits content');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
