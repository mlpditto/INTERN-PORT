// QA — 🎬 Watch first story: each line names its voices + auto-save of watchFirst (V102.683, owner pick A, mockup-watch-voice-names/).
// Real admin.html in Chromium; firebase is a proxy, `db` is replaced by a recorder.
// Run: node scripts/watch-voice-names-qa.cjs   (Playwright via PLAYWRIGHT_MODULE or NODE_PATH)
const path = require('node:path'), assert = require('node:assert');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ✓ ' + m); };
const U = k => 'https://firebasestorage.googleapis.com/v0/b/x/o/' + k + '.mp3?alt=media&token=t';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => { if (!/ServiceWorkerRegistration|mermaid is not defined/.test(e.message)) errors.push(e.message); });   // offline file:// noise (no SW, no CDN)
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(r.request().url()) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }));
  await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
  await page.goto(require('url').pathToFileURL(path.join(root, 'public/admin.html')).href);
  await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && window.QuizWatchStory && document.readyState === 'complete'; } catch (_) { return false; } });
  await page.evaluate(() => {
    window.showToast = () => {};
    document.getElementById('quizManageModal').style.display = 'block';
    const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
    addQuestionUI({ q: 'Q1', type: 'choice', options: ['a', 'b'], correct: [0], primer: '**25(OH)D** — storage form' });
    _qPrimerReviewAll(); _praTab('watch', true);   // the 🎬 tab of the 📖 window holds the real Watch first block
    window.__writes = []; window.__fail = false;
    window.db = { collection: c => ({ doc: d => ({ update: v => { window.__writes.push({ c, d, v: JSON.parse(JSON.stringify(v)) }); return window.__fail ? Promise.reject(new Error('permission-denied')) : Promise.resolve(); } }) }) };
  });
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#qws-box .qws-l')].map(r => [...r.querySelectorAll('.qws-vnm')].map(m => m.textContent + (m.classList.contains('ok') ? '+' : '-') + (m.classList.contains('px') ? 'P' : '')).join(' ')));
  const sv = () => page.evaluate(() => { const s = document.querySelector('#qws-box .qws-sv'); return s ? s.className + '|' + s.textContent : ''; });

  console.log('names on each line');
  await page.evaluate(([a, b, c]) => {
    document.getElementById('edit-quiz-id').value = 'quizA';
    QuizWatchStory.set({ lang: 'th', pv: { id: 'khanomkrok', name: 'Khanom Krok' }, lines: [
      { w: 'q', t: 'ถามอะไร', q: [1], a: a }, { w: 'rx', t: 'ตอบ', q: [1], a: a, b: b, c: c }, { w: 'key', t: 'จำไว้', q: [1], a: a }] });
  }, [U('a'), U('b'), U('c')]);
  let r = await rows();
  ok(r[0] === 'Kaimook+', 'a Q line names Kaimook (green: its sound is there)');
  ok(r[1] === 'Kaitom+ Kaidang+ Khanom Krok+P', 'an RX line names Kaitom · Kaidang · the Paxa voice (magenta) — all ready');
  ok(r[2] === 'Kaitom+ Kaidang- Khanom Krok-P', 'a KEY line shows which voices are still missing (grey)');
  ok(!(await page.$('#qws-box .qws-a')), 'the bare ♪ is gone — the names say it');
  await page.waitForTimeout(1300);
  ok((await page.evaluate(() => window.__writes.length)) === 0 && (await sv()) === '', 'loading a quiz (set) writes nothing and shows no save state');

  console.log('auto-save');
  await page.locator('#qws-box .qws-l input').nth(2).fill('จำไว้ใหม่');
  r = await rows();
  ok(r[2] === 'Kaitom- Kaidang- Khanom Krok-P', 'retyping a line greys its names (its sounds no longer say it)');
  await page.locator('#qws-box .qws-l input').nth(2).press('End'); await page.keyboard.type('ๆ');
  ok((await page.evaluate(() => window.__writes.length)) === 0, 'nothing is written while typing (1 s debounce)');
  await page.waitForFunction(() => window.__writes.length === 1); await page.waitForTimeout(100);
  let w = await page.evaluate(() => window.__writes);
  ok(w.length === 1 && w[0].c === 'quizzes' && w[0].d === 'quizA' && JSON.stringify(Object.keys(w[0].v)) === '["watchFirst"]', 'one write to quizzes/<this quiz> with ONLY watchFirst');
  ok(w[0].v.watchFirst.story.lines[2].t === 'จำไว้ใหม่ๆ' && !('a' in w[0].v.watchFirst.story.lines[2]) && w[0].v.watchFirst.story.lines[1].c === U('c') && w[0].v.watchFirst.story.pv.id === 'khanomkrok' && !('url' in w[0].v.watchFirst), 'the saved story is the cleaned one: new words without the old sound, other lines keep theirs, the Paxa pick rides along');
  ok(/^qws-sv ok\|☁ saved \d\d:\d\d$/.test(await sv()), 'the header says ☁ saved hh:mm');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('#qws-box .qws-l input')), 'saving does not repaint the lines — the caret stays in the box');

  await page.evaluate(() => { document.getElementById('quiz-watch-first').value = 'https://example.com/film.mp4'; QuizWatchStory.del(0); });
  await page.waitForFunction(() => window.__writes.length === 2);
  w = await page.evaluate(() => window.__writes[1].v.watchFirst);
  ok(w.url === 'https://example.com/film.mp4' && w.story.lines.length === 2, 'the film link in the box rides along, as the Save button would write it');
  await page.evaluate(() => { document.getElementById('quiz-watch-first').value = ''; QuizWatchStory.clear(); });
  await page.waitForFunction(() => window.__writes.length === 3);
  ok((await page.evaluate(() => window.__writes[2].v.watchFirst)) === null, '🗑 the story (and no link) → watchFirst null on the quiz');

  await page.evaluate(() => { window.__fail = true; QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ก', q: [1] }] }); QuizWatchStory.edit(0, 'กข'); });
  await page.waitForFunction(() => window.__writes.length === 4); await page.waitForTimeout(50);
  ok(/^qws-sv err\|⚠️ not saved$/.test(await sv()) && /permission-denied/.test(await page.$eval('#qws-box .qws-sv', s => s.title)), 'a refused write says ⚠️ not saved (the reason on hover)');

  await page.evaluate(() => { window.__fail = false; document.getElementById('edit-quiz-id').value = ''; QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ก', q: [1] }] }); QuizWatchStory.edit(0, 'ข'); });
  await page.waitForFunction(() => document.querySelector('#qws-box .qws-sv'));
  ok(/^qws-sv new\|💾 save the quiz once$/.test(await sv()) && (await page.evaluate(() => window.__writes.length)) === 4, 'a quiz never saved (no id): no write, the header asks for one Save first');

  console.log('✨ button while Paxa voices (V102.685)');
  await page.evaluate(() => { const S = QuizWatchStory._S; S.t0 = 0; S.busy = true; S.pxing = { done: 1, total: 4 }; QuizWatchStory.paxaFilter(''); });
  ok((await page.$eval('#qws-make', b => b.textContent)) === '✨ From Read first', 'a Paxa run is not a story being written — ✨ keeps its name (it showed seconds since 1970)');
  await page.evaluate(() => { const S = QuizWatchStory._S; S.busy = false; S.pxing = null; QuizWatchStory.paxaFilter(''); });

  console.log('other languages');
  await page.evaluate(() => QuizWatchStory.set({ lang: 'en', lines: [{ w: 'q', t: 'Why?', q: [1] }, { w: 'rx', t: 'Because.', q: [1] }] }));
  ok((await rows()).every(x => x === ''), 'an English story names no AI voice (the phone voice reads it)');
  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  console.log(`\nwatch-voice-names-qa: ${n} checks passed`);
})().catch(e => { console.error('FAIL', e && e.message); process.exit(1); });
