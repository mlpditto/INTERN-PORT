// V102.552: the Jev check button in the real admin.html with a stubbed callable: unsaved quiz, results, Open jumps to the question, a clean quiz, an error, phone width.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage();
      await page.addInitScript(() => {
        const P = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : (k === 'then' ? () => P : P)), apply: () => P, construct: () => P });
        window.firebase = P; window.mermaid = P;
      });
      await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
      await page.goto(ADMIN, { waitUntil: 'load' }); await page.waitForTimeout(400);
      await page.evaluate(() => {
        const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
        window.__calls = []; window.__reply = null;
        window.adminApp = { functions: () => ({ httpsCallable: n => async d => { window.__calls.push([n, d]); if (window.__reply instanceof Error) throw window.__reply; return { data: window.__reply }; } }) };
        window.updateQuizPagination = () => { window.__page = quizQPageIndex; }; window.__closed = 0; window.closeQuizReview = () => { window.__closed++; }; window.__jevBtn = document.createElement('button');
        window.getQuizFormData = () => ({ questions: [{ q: 'on screen', content: '', type: 'choice', options: ['a'], correct: [0], explanation: 'e', timer: 60, tags: [], primer: 'not sent' }] });
      });
      const btn = () => page.evaluate(() => { document.getElementById('edit-quiz-id').value = window.__id || ''; window.jevQuizCheck.run(window.__jevBtn); });
      const box = () => page.locator('#jqc-box').innerText();

      { const html = require('node:fs').readFileSync('public/admin.html', 'utf8'); assert.ok(html.includes('id="jev-quiz-check" class="review-tab" aria-label="Jev check" onclick="jevQuizCheck.run(this)"') && html.includes('${items}${jev}'), 'V102.558: a tab beside Scorecard and Rewrites'); assert.equal(await page.locator('#jev-quiz-check').count(), 0, 'no longer in the editor toolbar'); }
      // V102.619 (owner): a never-saved quiz runs too — 💡 is checked, translations wait for Save
      await page.evaluate(() => { window.__reply = { enabled: true, questions: 1, checked: 1, errors: 0, noExplanation: 0, flags: [], langs: [] }; });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /🌐 after Save/); assert.match(await box(), /Nothing to look at/);
      assert.equal((await page.evaluate(() => window.__calls)).at(-1)[1].quizId, '', 'sent without an id, with the questions on screen');
      await page.click('.jqc-x');
      // until the new function is deployed it refuses up front (invalid-argument, nothing spent) → the old note
      await page.evaluate(() => { const e = new Error('quizId required'); e.code = 'functions/invalid-argument'; window.__reply = e; });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /Save the quiz first/);
      await page.click('.jqc-x');

      await page.evaluate(() => { window.__id = 'quiz1'; window.__reply = { enabled: true, questions: 15, checked: 40, errors: 1, noExplanation: 2, flags: [
        { kind: 'stale', lang: 'ko', q: null, verdict: 'bad' }, { kind: 'key', q: 2, score: 0.05, verdict: 'bad' }, { kind: 'lang', lang: 'th', q: 7, score: 0.5, verdict: 'look' }] }; });
      await btn(); await page.waitForTimeout(100);
      const t = await box();
      // V102.619 (owner pick C): one matrix — questions down, 💡 + TH + KO across; the whole-quiz Korean note fills its column
      const mx = await page.evaluate(() => ({ head: [...document.querySelectorAll('.jqc-m thead th')].map(c => c.textContent), rows: document.querySelectorAll('.jqc-m tbody tr').length,
        q3: [...document.querySelectorAll('.jqc-m tbody tr')[2].querySelectorAll('td')].map(c => c.textContent + '|' + (c.title || '')), q8: [...document.querySelectorAll('.jqc-m tbody tr')[7].querySelectorAll('td')].map(c => c.textContent),
        ko: [...document.querySelectorAll('.jqc-m tbody tr td:nth-of-type(3)')].every(c => c.textContent === '🕒' && /Korean translation is older/.test(c.title)) }));
      assert.deepEqual(mx.head, ['', '💡', 'TH', 'KO'], 'columns: ' + mx.head);
      assert.equal(mx.rows, 15, 'one row per question');
      assert.ok(/^≠\|Explanation points away from the marked answer · 0\.05$/.test(mx.q3[0]), 'Q3 💡 ≠ with the reason + score in the tooltip: ' + mx.q3[0]);
      assert.deepEqual(mx.q8.slice(1), ['≈', '🕒'], 'Q8: TH may differ, KO older: ' + mx.q8);
      assert.ok(mx.ko, 'the KO column is 🕒 all the way down');
      assert.ok(!/translation is older than this question/.test(t), 'no sentences in the box — they live in the tooltips');
      assert.match(t, /38 OK/); assert.match(t, /1 could not be checked/); assert.ok(!/not checked/.test(await page.locator('.jqc-p').innerText()), 'no pill for an empty list');
      assert.deepEqual((await page.evaluate(() => window.__calls)).at(-1), ['jevCheckQuiz', { quizId: 'quiz1', questions: [{ q: 'on screen', content: '', type: 'choice', options: ['a'], correct: [0], explanation: 'e' }] }], 'V102.557: the questions on screen go, unsaved edits included');
      assert.equal(await page.locator('.jqc-list').count(), 0, 'no row-per-flag list any more');
      const r = await page.locator('#jqc-box').boundingBox();
      assert.ok(r.x >= 0 && r.x + r.width <= width, 'the box fits @' + width);
      await page.locator('.jqc-m .jqc-go[data-q="2"]').click();
      assert.equal(await page.evaluate(() => window.__page), 2, 'Open goes to Q3'); assert.equal(await page.evaluate(() => window.__closed), 1, 'and closes the Review');
      assert.equal(await page.locator('#jqc-box').isVisible(), false);

      // V102.561: skipped questions are chips, repeats come first with both stems one tap away, and skipped questions are never called clean
      await page.evaluate(() => { window.__reply = { enabled: true, questions: 5, checked: 2, errors: 0, noExplanation: 2, unchecked: [3, 4], compared: 9, flags: [], repeats: [{ q: 1, quizId: 'b', title: 'Eye 2', otherQ: 2, score: 0.91, stem: 'first stem', otherStem: 'other stem' }] }; });
      await btn(); await page.waitForTimeout(100);
      { const u = await box(); assert.match(u, /2 OK/); assert.match(u, /2 not checked/); assert.match(u, /1 repeat/); assert.match(u, /Q2[\s\S]*Same fact as Eye 2 Q3[\s\S]*0\.91/); assert.match(u, /Compared 9 likely pairs/); assert.ok(!/Nothing to look at/.test(u)); }
      assert.equal(await page.locator('.jqc-pair').isVisible(), false);
      // V102.590 (owner): Compare = both questions in full, side by side; the other quiz is read from Firestore; 🗑 only on this quiz's side
      await page.evaluate(() => {
        window.__formQs = [{ q: 'zero', options: ['a', 'b'], correct: [0], explanation: '' }, { q: 'first stem', options: ['keep me', 'right one'], correct: [1], explanation: 'mine because' }];
        window.getQuizFormData = () => ({ questions: window.__formQs.map(x => Object.assign({ content: '', type: 'choice' }, x)) });
        window.__dbReads = [];
        window.db = { collection: c => ({ doc: id => ({ get: async () => { window.__dbReads.push(c + '/' + id); return { exists: true, data: () => ({ questions: [{}, {}, { q: 'other stem', options: ['x', 'y <b>'], correct: [1], explanation: 'why' }] }) }; } }) }) };
      });
      await page.click('.jqc-cmp'); await page.waitForTimeout(150);
      const sbs = await page.evaluate(() => { const cols = [...document.querySelectorAll('.jqc-pair .jqc-col')]; return { n: cols.length, heads: cols.map(c => c.querySelector('h4').textContent), stems: cols.map(c => c.querySelector('.jqc-stem').textContent), ok: cols.map(c => [...c.querySelectorAll('.jqc-opts li.ok span')].map(x => x.textContent)), exp: cols.map(c => (c.querySelector('.jqc-exp') || {}).textContent || ''), del: cols.map(c => c.querySelectorAll('.jqc-del-b').length), wide: document.getElementById('jqc-box').classList.contains('jqc-wide'), reads: window.__dbReads, raw: cols[1].innerHTML.includes('<b>') && !cols[1].querySelector('.jqc-opts b + span b') }; });
      assert.deepEqual(sbs, { n: 2, heads: ['This quiz · Q2', 'Eye 2 · Q3'], stems: ['first stem', 'other stem'], ok: [['right one'], ['y <b>']], exp: ['💡 mine because', '💡 why'], del: [1, 0], wide: true, reads: ['quizzes/b'], raw: true }, 'side by side in full, escaped, 🗑 on this side only: ' + JSON.stringify(sbs));
      if (width < 500) assert.ok(await page.evaluate(() => { const c = document.querySelectorAll('.jqc-pair .jqc-col'); return c[1].getBoundingClientRect().top > c[0].getBoundingClientRect().bottom - 1; }), 'phone: the two stack');
      else assert.ok(await page.evaluate(() => { const c = document.querySelectorAll('.jqc-pair .jqc-col'); return Math.abs(c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().top) < 2; }), 'desktop: side by side');
      // 🗑 asks in place (Cancel first, quotes the stem), Cancel writes nothing
      await page.click('.jqc-del-b');
      assert.match(await page.locator('.jqc-del.asking').innerText(), /Delete Q2 “first stem” from this quiz\? It is saved when you press Save Quiz\./);
      assert.equal(await page.evaluate(() => document.activeElement.className), 'jqc-del-no', 'Cancel is focused');
      await page.click('.jqc-del-no');
      assert.equal(await page.locator('.jqc-del.asking').count(), 0, 'Cancel goes back');
      assert.deepEqual(await page.evaluate(() => [3, 4].map(i => document.querySelectorAll('.jqc-m tbody tr')[i].querySelector('td').textContent)), ['–', '–'], 'no explanation → – in the 💡 column');
      await page.locator('.jqc-m .jqc-go[data-q="4"]').click(); assert.equal(await page.evaluate(() => window.__page), 4, 'a row opens that question');
      // 🗑 Delete removes that question from the editor (not saved until Save Quiz), closes Jev + the Review, re-pages, autosaves
      await page.evaluate(() => { document.querySelectorAll('.quiz-q-item').forEach(n => n.remove()); const host = document.createElement('div'); host.id = 'jqc-test-qs'; host.innerHTML = '<div class="quiz-q-item" data-k="0"></div><div class="quiz-q-item" data-k="1"></div>'; document.body.append(host); window.__auto = 0; window.triggerAutoSave = () => { window.__auto++; }; window.__closedBefore = window.__closed; });
      await btn(); await page.waitForTimeout(100); await page.click('.jqc-cmp'); await page.waitForTimeout(150);
      await page.click('.jqc-del-b'); await page.click('.jqc-del-yes'); await page.waitForTimeout(50);
      const gone = await page.evaluate(() => ({ left: [...document.querySelectorAll('#jqc-test-qs .quiz-q-item')].map(n => n.dataset.k), open: document.getElementById('jqc-box').open, review: window.__closed - window.__closedBefore, auto: window.__auto }));
      assert.deepEqual(gone, { left: ['0'], open: false, review: 1, auto: 1 }, 'Q2 removed from the form only: ' + JSON.stringify(gone));
      await page.evaluate(() => document.getElementById('jqc-test-qs').remove());
      // the other quiz cannot be read → its stem from Jev + a note, still 🗑 on this side
      await page.evaluate(() => { window.db = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('denied'); } }) }) }; });
      await btn(); await page.waitForTimeout(100); await page.click('.jqc-cmp'); await page.waitForTimeout(150);
      assert.match(await page.locator('.jqc-pair .jqc-col').nth(1).innerText(), /other stem[\s\S]*Could not load the full question/);
      await page.click('.jqc-x');

      await page.evaluate(() => { window.__reply = { enabled: true, questions: 5, checked: 5, errors: 0, noExplanation: 0, flags: [] }; });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /Nothing to look at/); await page.click('.jqc-x');

      await page.evaluate(() => { window.__reply = { enabled: false }; });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /switched off/); await page.click('.jqc-x');

      await page.evaluate(() => { window.__reply = new Error('down'); });
      await btn(); await page.waitForTimeout(100);
      assert.match(await box(), /Could not reach Jev/);
      assert.equal(await page.evaluate(() => window.__jevBtn.disabled), false, 'can try again');
      await page.click('.jqc-x');
      // V102.590 (owner): reading is INLINE — no dialog; the J tab pulses and counts (J 00:01); the result opens when Jev answers
      await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<div class="review-tabs"><button type="button" id="jev-quiz-check" class="review-tab" aria-label="Jev check">Jev check</button></div>');
        window.__jevBtn = document.getElementById('jev-quiz-check');
        window.__reply = { enabled: true, questions: 1, checked: 1, errors: 0, noExplanation: 0, flags: [] };
        window.adminApp = { functions: () => ({ httpsCallable: () => () => new Promise(r => { window.__release = () => r({ data: window.__reply }); }) }) };
      });
      await btn(); await page.waitForTimeout(1250);
      const run = await page.evaluate(() => { const b = document.getElementById('jev-quiz-check'); return { dlg: !!document.querySelector('#jqc-box[open]'), busy: b.classList.contains('jqc-busy'), t: b.dataset.t, after: getComputedStyle(b, '::after').content, label: b.getAttribute('aria-label'), wide: b.getBoundingClientRect().width > 40, off: b.disabled }; });
      assert.deepEqual(run, { dlg: false, busy: true, t: '00:01', after: '"00:01"', label: 'Jev is reading this quiz · 00:01', wide: true, off: true }, 'inline while reading: ' + JSON.stringify(run));
      await page.evaluate(() => window.__release()); await page.waitForTimeout(150);
      const done = await page.evaluate(() => { const b = document.getElementById('jev-quiz-check'); return { busy: b.classList.contains('jqc-busy'), t: b.dataset.t || '', label: b.getAttribute('aria-label'), off: b.disabled }; });
      assert.deepEqual(done, { busy: false, t: '', label: 'Jev check', off: false }, 'back to the J tab when Jev answers');
      assert.match(await box(), /Nothing to look at/, 'then the result opens');
      await page.context().close();
    }
    console.log('PASS: Jev check — reading inline on the J tab with a timer + Compare side by side in full with 🗑 on this quiz’s side (V102.590), whole-quiz button, unsaved quiz, flags in order, Open jumps, clean, off, error, 390 px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
