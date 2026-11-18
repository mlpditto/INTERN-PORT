// V102.686 🎬 Watch first ▸ ❓ tour (owner pick A, mockups/watch-first-howto.html): the ❓ beside ✨ From Read first dims the screen and walks
// 5 steps (✨ ⚠️ 🙋 🗣 ▶) on the panel with a 👆 hand and a yellow bubble (‹ › ✕ / ← → Esc). It must never call a model, write, or change the story.
// The REAL public/admin.html in Chromium (network stubbed), callUniversalAI stubbed. SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
{
    const js = fs.readFileSync('public/quiz-watch-tour.js', 'utf8'), a = fs.readFileSync('public/admin.html', 'utf8');
    ok(/<script src="quiz-watch-tour\.js\?v=V102\.\d+"><\/script>/.test(a), 'quiz-watch-tour.js is loaded');
    ok(!/callUniversalAI|callTtsProxy|\.collection\(|triggerAutoSave|\.storage\(/.test(js), 'the tour has no model, voice, Firestore, Storage or autosave call in it');
}
(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: SHOT ? 1.5 : 1 })).newPage();
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof addQuestionUI === 'function' && !!window.QuizWatchStory && !!window.QuizWatchTour && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(() => {
            const m = document.getElementById('quizManageModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.showToast = () => {}; window.__auto = 0; window.triggerAutoSave = () => { window.__auto++; };
            document.getElementById('quiz-title').value = 'Vitamin D'; document.getElementById('quiz-editor-settings').open = true;
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            ['25(OH)D is the main store marker', 'Deficiency is under 20 ng/mL'].forEach((p, i) => addQuestionUI({ q: 'Question ' + (i + 1), type: 'choice', options: ['a', 'b'], correct: [0], primer: p }));
            document.getElementById('quiz-watch-first').value = ''; QuizWatchStory.set(null);
            localStorage.setItem('praTab', 'watch'); _qPrimerReviewAll();
            window.__ai = 0; window.callUniversalAI = () => { window.__ai++; return Promise.resolve({ text: 'Q [1]: Where do I start?\nRX [1]: 25(OH)D is the main store marker\nKEY [2]: Deficiency is under 27 ng/mL\n' }); };
        });
        const tour = () => page.evaluate(() => { const b = document.querySelector('.qwt-bub'), box = document.getElementById('qws-box'), sp = document.querySelector('.qwt-spot');
            return { on: QuizWatchTour._on(), cap: b ? b.querySelector('.qwt-c').textContent : '', dim: !!document.querySelector('.qwt-dim'), hand: !!document.querySelector('.qwt-hand'),
                spot: sp ? sp.getBoundingClientRect().width > 0 : false, boxShown: !box.hidden, lines: box.querySelectorAll('.qws-l').length, sample: /sample/.test(box.textContent), story: JSON.stringify(QuizWatchStory.get()),
                ai: window.__ai, auto: window.__auto, now: box.querySelectorAll('.qws-l.now').length, prev: b ? b.querySelector('[data-k="prev"]').disabled : null, focus: document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.id) }; });
        const shot = async n => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); } };

        console.log('the ❓ button');
        const btn = await page.evaluate(() => { const h = document.getElementById('qws-help'), m = document.getElementById('qws-make'), a = h.getBoundingClientRect(), b = m.getBoundingClientRect();
            return { vis: a.width > 0, row: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 4, after: a.left >= b.right - 1, label: h.getAttribute('aria-label'), title: h.title, text: h.textContent }; });
        ok(btn.vis && btn.row && btn.after && btn.text === '❓', '❓ sits right after ✨ From Read first on the same row');
        ok(btn.label === 'How to use Watch first' && /animated tour/.test(btn.title), '❓ carries a name (aria-label) and a tooltip');

        console.log('no story yet → a sample story');
        await page.click('#qws-help'); await page.waitForTimeout(100); let t = await tour();
        ok(t.on && t.dim && t.hand && t.spot && /^1\/5 ✨ AI writes a chat story/.test(t.cap) && t.prev === true, 'tap → dimmed screen, spotlight, 👆 hand, bubble 1/5 ✨ (‹ off on step 1)');
        ok(t.focus === 'Next', 'focus goes to › in the bubble');
        ok(t.boxShown && t.sample && t.lines === 5, 'with no story the box shows a SAMPLE story of 5 lines');
        await shot('tour-1');
        await page.waitForFunction(() => /^2\/5/.test(document.querySelector('.qwt-c').textContent), null, { timeout: 15000 }); t = await tour();
        ok(/⚠️ = a number Read first never says/.test(t.cap), 'it moves on by itself → 2/5 ⚠️');
        await shot('tour-2');
        await page.click('.qwt-bub [data-k="next"]'); t = await tour();
        ok(/^3\/5 🙋 tap the speaker/.test(t.cap) && t.prev === false, '› → 3/5 🙋 speaker');
        await page.keyboard.press('ArrowRight'); t = await tour();
        ok(/^4\/5 🗣 AI voices/.test(t.cap), '→ key → 4/5 🗣 voices');
        await page.keyboard.press('ArrowLeft'); t = await tour();
        ok(/^3\/5/.test(t.cap), '← key → back to 3/5');
        await page.click('.qwt-dim', { force: true }); t = await tour();
        ok(t.on, 'a click on the dimmed page does nothing (the tour stays)');
        await page.keyboard.press('Escape'); t = await tour();
        ok(!t.on && !t.dim && !t.hand && !t.boxShown && t.lines === 0 && t.story === 'null', 'Esc → everything gone; the box is empty and hidden again; still no story');
        ok(t.ai === 0 && t.auto === 0 && t.focus === 'How to use Watch first', 'no model call, no autosave; focus back on ❓');

        console.log('with a story → points at it, changes nothing');
        await page.click('#qws-make'); await page.waitForSelector('#qws-box .qws-l'); const before = await tour();
        ok(before.lines === 3 && before.ai === 1, 'a story of 3 lines (one model call)');
        const auto0 = before.auto;
        await page.evaluate(() => QuizWatchTour.start({ fast: true }));
        await page.waitForFunction(() => !QuizWatchTour._on(), null, { timeout: 15000 }); t = await tour();
        ok(t.story === before.story && t.ai === 1 && t.auto === auto0 && t.now === 0 && !t.sample && t.lines === 3, 'the whole tour runs on the real story: same story after, no call, no autosave, no ▶ ring left');
        await page.click('#qws-help'); await page.click('.qwt-bub [data-k="next"]'); await page.waitForTimeout(600); t = await tour();
        const spot = await page.evaluate(() => { const s = document.querySelector('.qwt-spot').getBoundingClientRect(), we = document.querySelector('#qws-box .qws-l .qws-warn'), w = we.getBoundingClientRect(); return getComputedStyle(we).visibility === 'visible' && s.left <= w.left && s.right >= w.right && s.top <= w.top && s.bottom >= w.bottom; });
        ok(/^2\/5/.test(t.cap) && spot, '2/5 rings the real ⚠️ (27 is not in Read first), still shown — an earlier tour\'s timers do not reach this one');
        await shot('tour-story-2');
        await page.click('.qwt-bub [data-k="end"]'); t = await tour();
        ok(!t.on && t.story === before.story, '✕ closes; the story is as it was');
        await page.evaluate(() => { QuizWatchStory._S.busy = true; QuizWatchTour.start(); }); t = await tour();
        ok(!t.on, 'no tour while the panel is busy (writing or voicing)');
        await page.evaluate(() => { QuizWatchStory._S.busy = false; });
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nquiz-watch-tour-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
