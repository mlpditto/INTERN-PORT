// V102.666 🎬 Watch first ▸ ✨ From Read first (owner pick C + C1, mockup-watch-first/c.html) — Quiz Editor ▸ ⚙:
// one AI call writes a chat story (Q: / RX: / KEY: lines) from the Read first notes of every question; the lines can be edited;
// a number no note says is flagged; the story rides on the quiz as watchFirst.story (text only); a video link wins on the intern side.
// The REAL public/admin.html in Chromium (network stubbed), callUniversalAI stubbed (records the prompt). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
{
    const js = fs.readFileSync('public/quiz-watch-story.js', 'utf8'), a = fs.readFileSync('public/admin.html', 'utf8');
    ok(/<script src="quiz-watch-story\.js\?v=V102\.\d+"><\/script>/.test(a), 'quiz-watch-story.js is loaded');
    ok(!/firestore|\.collection\(/.test(js), 'the composer itself writes nothing — the story is saved with the quiz');
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
        await page.waitForFunction(() => typeof updateQuizEditorSummary === 'function' && typeof addQuestionUI === 'function' && !!window.QuizWatchStory && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        const setup = primers => page.evaluate(primers => {
            const m = document.getElementById('quizManageModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.showToast = () => {}; window.__auto = 0; window.triggerAutoSave = () => { window.__auto++; };
            document.getElementById('quiz-title').value = 'Modern Menopause'; document.getElementById('quiz-editor-settings').open = true;
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            primers.forEach((p, i) => addQuestionUI({ q: 'Question ' + (i + 1) + ' text', type: 'choice', options: ['a', 'b'], correct: [0], primer: p }));
            document.getElementById('quiz-watch-first').value = ''; QuizWatchStory.set(null);
            window.__ai = []; window.__reply = 'Q [1]: What is body-identical?\nRX [1]: The same molecule as 17β-estradiol.\n**KEY [1,2]:** Start within 10 years, before age 60\nnoise line\nRX [2]: Use 75 mg daily\n';
            window.callUniversalAI = (model, prompt, isJson, a, b, opts) => { window.__ai.push({ model, prompt, isJson, feature: opts && opts.feature }); return window.__fail ? Promise.reject(new Error('boom')) : Promise.resolve({ text: window.__reply }); };
        }, primers);
        const view = () => page.evaluate(() => { const b = document.getElementById('qws-box'), mk = document.getElementById('qws-make'), vis = e => !!e && e.getClientRects().length > 0;
            return { box: vis(b), make: vis(mk) ? mk.textContent : null, head: (b.querySelector('.qws-h') || {}).textContent || '', lines: [...b.querySelectorAll('.qws-l')].map(l => l.querySelector('.qws-w').textContent.trim() + ' | ' + l.querySelector('input').value + ' | ' + l.querySelector('em').textContent + (l.querySelector('.qws-warn') ? ' | ' + l.querySelector('.qws-warn').textContent : '')),
                err: (b.querySelector('.qws-err') || {}).textContent || '', ok: !!b.querySelector('.qws-ok'), warn: (b.querySelector('.qws-h .qws-warn') || {}).textContent || '', sameRow: (() => { const i = document.getElementById('quiz-watch-first').getBoundingClientRect(), m = mk.getBoundingClientRect(); return Math.abs((i.top + i.bottom) / 2 - (m.top + m.bottom) / 2) < 4 && m.left >= i.right; })(),
                form: getQuizFormData().watchFirst, auto: window.__auto, ai: window.__ai.length }; });
        const shot = async n => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); const r = await page.evaluate(() => { const a = document.getElementById('quiz-watch-first').parentElement.getBoundingClientRect(), b = document.getElementById('qws-box').getBoundingClientRect(); return { x: a.left - 10, y: a.top - 10, w: a.width + 20, h: (b.height ? b.bottom : a.bottom) - a.top + 20 }; }); await page.screenshot({ path: path.join(SHOT, n + '.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h } }); };
        const NOTES = ['**Key terms**\n- Body-identical = same molecule as 17β-estradiol', 'Start within 10 years of menopause or before age 60', ''];

        console.log('the button');
        await setup(NOTES); let v = await view();
        ok(v.make === '✨ From Read first' && v.sameRow && !v.box && v.form === null, '✨ From Read first sits beside the link box; nothing else until it is used; the quiz has no film');
        await setup(['', '']); await page.click('#qws-make'); v = await view();
        ok(v.ai === 0 && /Read first for at least one question/.test(v.err) && v.form === null, 'no Read first notes → it says so and calls no model');

        console.log('writing the story');
        await setup(NOTES); await page.click('#qws-make'); await page.waitForSelector('#qws-box .qws-l'); v = await view();
        const call = await page.evaluate(() => window.__ai[0]);
        ok(v.ai === 1 && call.feature === 'quiz_watch_story' && call.isJson === false, 'one AI call, labelled quiz_watch_story, plain text');
        ok(/NOTE 1 \(question: Question 1 text\)/.test(call.prompt) && /17β-estradiol/.test(call.prompt) && /NOTE 2/.test(call.prompt) && !/NOTE 3/.test(call.prompt) && /in English/.test(call.prompt), 'the prompt carries every note that has text (not the empty one), in the notes\' language');
        ok(/never add a number or a fact the notes do not say/.test(call.prompt) && /Do not give away which choice is correct/.test(call.prompt), 'it is told to copy numbers exactly and not to give answers away');
        ok(v.lines.length === 4 && v.lines[0] === '🙋 Q | What is body-identical? | Q1' && v.lines[2].startsWith('💡 KEY | Start within 10 years, before age 60 | Q1 · 2'), 'Q / RX / KEY lines with the question they come from; markdown stars and noise dropped: ' + v.lines.length);
        ok(/4 lines/.test(v.head) && /EN/.test(v.head) && /1 number not in Read first/.test(v.warn) && /⚠️ 75/.test(v.lines[3]), 'a number no note says (75) is flagged on its line and in the header');
        ok(JSON.stringify(v.form) === JSON.stringify({ story: { lang: 'en', lines: [{ w: 'q', t: 'What is body-identical?', q: [1] }, { w: 'rx', t: 'The same molecule as 17β-estradiol.', q: [1] }, { w: 'key', t: 'Start within 10 years, before age 60', q: [1, 2] }, { w: 'rx', t: 'Use 75 mg daily', q: [2] }] } }) && v.auto >= 1, 'the form now carries watchFirst.story (and autosave was nudged)');
        await shot('story-admin-flagged');

        console.log('editing');
        await page.locator('#qws-box .qws-l input').nth(3).fill('Use it daily'); await page.locator('#qws-box .qws-l input').nth(0).focus(); v = await view();
        ok(v.form.story.lines[3].t === 'Use it daily', 'a line can be retyped (saved as typed)');
        await page.locator('#qws-box .qws-w').nth(3).click(); v = await view();
        ok(v.lines[3].startsWith('💡 KEY | Use it daily') && v.ok && !v.warn, 'tap the speaker → Q → RX → KEY; with 75 gone: ✓ every number is in Read first');
        await page.locator('#qws-box .qws-x').nth(3).click(); v = await view();
        ok(v.lines.length === 3 && v.form.story.lines.length === 3, '× removes a line');
        await page.click('#qws-box .qws-add'); await page.keyboard.type('Ask the pharmacist'); v = await view();
        ok(v.lines.length === 4 && v.form.story.lines[3].t === 'Ask the pharmacist' && v.form.story.lines[3].w === 'rx', '＋ line adds one, ready to type');
        await shot('story-admin');
        await page.click('#qws-box .qws-b[aria-label="Play"]');
        ok(await page.evaluate(() => document.querySelectorAll('#qws-box .qws-l.now').length === 1 && !!document.querySelector('#qws-box .qws-b[aria-label="Stop"]')), '▶ walks the lines (the one being said is ringed); ⏹ stops');
        await page.click('#qws-box .qws-b[aria-label="Stop"]');

        console.log('with a link · load · reset · failure');
        await page.fill('#quiz-watch-first', 'https://film.test/a.mp4'); v = await view();
        ok(v.form.url === 'https://film.test/a.mp4' && v.form.story.lines.length === 4, 'a link and a story can both be kept (the intern sees the film)');
        await page.fill('#quiz-watch-first', 'not a link'); v = await view();
        ok(!('url' in v.form) && v.form.story.lines.length === 4 && await page.evaluate(() => document.getElementById('quiz-watch-first').style.borderColor) === 'rgb(239, 68, 68)', 'a bad link is not saved (red box); the story still is');
        await page.fill('#quiz-watch-first', '');
        await page.evaluate(() => QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ถามอะไร', q: [1] }, { w: 'zzz', t: 'bad' }, { w: 'key', t: 'จำไว้', q: ['x', 2] }] })); v = await view();
        ok(v.lines.length === 2 && /TH/.test(v.head) && JSON.stringify(v.form.story.lines[1]) === JSON.stringify({ w: 'key', t: 'จำไว้', q: [2] }) && await page.evaluate(() => document.querySelector('#qws-box .qws-l input').getClientRects().length > 0 && document.querySelector('#qws-box .qws-l input').value === 'ถามอะไร'), 'a saved story loads back (bad lines dropped; Thai shows)');
        await page.click('#qws-box .qws-b[aria-label="Remove the story"]'); v = await view();
        ok(!v.box && v.form === null, '🗑 removes the story → the quiz has no film again');
        await page.evaluate(() => { window.__fail = true; }); await page.click('#qws-make'); await page.waitForSelector('#qws-box .qws-err'); v = await view();
        ok(/boom/.test(v.err) && v.form === null && v.make === '✨ From Read first', 'a failed call says why and leaves nothing behind');
        await page.evaluate(() => { window.__fail = false; window.__reply = 'I cannot do that.'; }); await page.click('#qws-make'); await page.waitForFunction(() => /no Q: \/ RX: \/ KEY: lines/.test(document.getElementById('qws-box').textContent)); v = await view();
        ok(v.form === null, 'a reply with no tagged lines is refused, with the model\'s first words');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nquiz-watch-story-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
