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
            if (primers.length) { localStorage.setItem('praTab', 'watch'); _qPrimerReviewAll(); }   // V102.670: the Watch first block lives in the 📖 │ 🎬 window's Watch first tab
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
        ok(/Write 8 to 12 lines/.test(call.prompt) && /must TEACH one concrete fact/.test(call.prompt) && /Never write a line that only names a topic/.test(call.prompt) && /ending with a question mark/.test(call.prompt) && /The last line is a KEY line/.test(call.prompt), 'two notes → 8 to 12 lines; every answer must teach a fact, questions are real questions, it ends on a KEY (V102.667)');
        ok(/OPEN like a real conversation: the FIRST line is a Q line where the intern greets the pharmacist, says they are about to do the quiz on "Modern Menopause" and asks where to start/.test(call.prompt) && /The opening adds no patient, no number and no fact/.test(call.prompt) && call.prompt.indexOf('OPEN like') < call.prompt.indexOf('NOTE 1'), 'the story opens with a greeting + the quiz title, and the opening may not add facts (V102.671, owner pick A)');
        ok(await page.evaluate(() => { const el = document.getElementById('quiz-title'), keep = el.value; el.value = ' He said "hi"\nthere '; const a = QuizWatchStory._prompt([{ n: 1, q: 'q', primer: 'p' }], 'en'); el.value = ''; const b = QuizWatchStory._prompt([{ n: 1, q: 'q', primer: 'p' }], 'en'); el.value = keep; return a.includes('the quiz on "He said hi there"') && b.includes('about to do this quiz and asks'); }), 'quotes and line breaks in the title are dropped; no title → "this quiz"');
        ok(await page.evaluate(() => { const ns = n => Array.from({ length: n }, (_, i) => ({ n: i + 1, q: 'q', primer: 'p' })); const P = n => QuizWatchStory._prompt(ns(n), 'th'); return /Write 16 to 20 lines/.test(P(10)) && P(10).includes('(3 to 5 of these)') && /Write 20 to 24 lines/.test(P(15)) && QuizWatchStory._parse(Array.from({ length: 30 }, (_, i) => 'RX [1]: line ' + i).join(String.fromCharCode(10))).length === 24; }), 'ten notes → 16 to 20 lines with 3 to 5 KEY; never more than 24, in the prompt or kept from the reply');
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
        console.log('🗣 AI voices (V102.668)');
        await page.evaluate(() => {
            window.__tts = []; window.__puts = []; window.__have = {}; window.__ttsFail = 0;
            window.callTtsProxy = p => { window.__tts.push(p); return window.__ttsFail === window.__tts.length ? Promise.reject(new Error('quota')) : Promise.resolve({ audioContent: btoa('snd' + window.__tts.length), mimeType: 'audio/mpeg' }); };
            window._sha256Hex = () => Promise.resolve('h' + window.__tts.length);
            const link = p => 'https://firebasestorage.googleapis.com/v0/b/x/o/' + encodeURIComponent(p) + '?alt=media&token=t';
            window.adminApp = { storage: () => ({ ref: p => ({ getDownloadURL: () => window.__have[p] ? Promise.resolve(link(p)) : Promise.reject({ code: 'storage/object-not-found' }), put: (b, m) => { window.__puts.push([p, m.contentType, b.size]); window.__have[p] = 1; return Promise.resolve({ ref: { getDownloadURL: () => Promise.resolve(link(p)) } }); } }) }) };
        });
        const vv = () => page.evaluate(() => { const b = document.getElementById('qws-voice'); return { n: b ? b.querySelector('.qws-vn').textContent : null, all: !!b && b.classList.contains('all'), notes: document.querySelectorAll('#qws-box .qws-a').length, err: (document.querySelector('#qws-box .qws-err') || {}).textContent || '', tts: window.__tts.map(p => [p.provider, p.voice, p.style, p.text, p.feature].join('|')), puts: window.__puts, a: ((getQuizFormData().watchFirst || {}).story || { lines: [] }).lines.map(x => x.a || '') }; });
        let w = await vv();
        ok(w.n === '0/2' && !w.all && w.notes === 0, 'a 🗣 button in the story header counts the voiced lines: 0/2');
        await page.click('#qws-voice'); await page.waitForFunction(() => document.querySelector('#qws-voice .qws-vn').textContent === '2/2'); w = await vv();
        ok(w.tts.join(' ; ') === 'iapp_tts|kaimook|friendly|ถามอะไร|quiz_watch_voice ; iapp_tts|kaitom|calm|จำไว้|quiz_watch_voice', 'one Chinda call a line: the intern = Kaimook friendly, the key line = Kaitom calm');
        ok(w.puts.length === 2 && w.puts.every(p => /^watch-voices\/h\d\.mp3$/.test(p[0]) && p[1] === 'audio/mpeg' && p[2] > 0), 'each sound is stored once at watch-voices/<hash>.mp3: ' + w.puts.map(p => p[0]).join(', '));
        ok(w.a.length === 2 && w.a.every(u => /^https:\/\/firebasestorage\.googleapis\.com\//.test(u)) && w.all && w.notes === 2 && v.auto < (await view()).auto, 'the link rides on each line (`a`), saved with the quiz; ♪ on both lines, the button turns green');
        await page.fill('#qws-box .qws-l input', 'ถามใหม่'); w = await vv();
        ok(w.n === '1/2' && !w.all && w.notes === 1 && w.a[0] === '' && w.a[1] !== '', 'retyping a line drops its sound (it no longer says the line): 1/2');
        await page.click('#qws-voice'); await page.waitForFunction(() => document.querySelector('#qws-voice .qws-vn').textContent === '2/2'); w = await vv();
        ok(w.tts.length === 3 && /\|ถามใหม่\|/.test(w.tts[2]), '🗣 again voices only the line that has none');
        await page.click('#qws-voice'); await page.waitForSelector('#qws-box .qws-err'); w = await vv();
        ok(w.tts.length === 3 && /already has its voice/.test(w.err), 'all voiced → no call, it says so');
        await page.evaluate(() => { window.__ttsFail = 5; QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'หนึ่ง', q: [1] }, { w: 'rx', t: 'สอง', q: [1] }, { w: 'key', t: 'สาม', q: [1] }] }); });
        await page.click('#qws-voice'); await page.waitForSelector('#qws-box .qws-err'); w = await vv();
        ok(/stopped at line 2 of 3: quota/.test(w.err) && w.n === '1/3' && w.a[0] !== '' && w.a[1] === '' && w.a[2] === '', 'a failed call stops there and says which line; the line already voiced is kept: ' + w.err.slice(0, 60));
        await page.evaluate(() => QuizWatchStory.set({ lang: 'en', lines: [{ w: 'q', t: 'Why?', q: [1] }] })); await page.click('#qws-voice'); await page.waitForSelector('#qws-box .qws-err'); w = await vv();
        ok(/Thai stories only/.test(w.err) && w.tts.length === 5, 'an English story: no call — Thai only for now, it says so');
        await page.evaluate(() => QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ก', q: [1], a: 'https://evil.test/x.mp3' }, { w: 'rx', t: 'ข', q: [1], a: 'https://firebasestorage.googleapis.com/v0/b/x/o/ok.mp3?alt=media' }] })); w = await vv();
        ok(w.a[0] === '' && /ok\.mp3/.test(w.a[1]) && w.n === '1/2', 'a saved story keeps only Storage links as sounds');
        const rules = fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8').replace(/\r\n/g, '\n');
        ok(/match \/watch-voices\/\{fileName\} \{\n\s+allow read, delete: if isAdmin\(\);\n\s+allow create, update: if isAdmin\(\)\n\s+&& request\.resource\.size < 2 \* 1024 \* 1024\n\s+&& request\.resource\.contentType\.matches\('audio\/\.\*'\);/.test(rules), 'storage.rules: watch-voices/ is admin-only, audio, under 2 MB');
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
