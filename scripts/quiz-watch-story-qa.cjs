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
    ok((js.match(/\.collection\(/g) || []).length === 1 && /db\.collection\('quizzes'\)\.doc\(id\)\.update\(\{ watchFirst: watchFirstNow\(\) \}\)/.test(js), 'V102.683: the composer auto-saves ONLY watchFirst on this quiz — nothing else of the form');
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
        const vv = () => page.evaluate(() => { const b = document.getElementById('qws-voice'); return { n: b ? b.querySelector('.qws-vn').textContent : null, all: !!b && b.classList.contains('all'), notes: [...document.querySelectorAll('#qws-box .qws-l')].filter(r => { const m = r.querySelectorAll('.qws-vnm:not(.px)'); return m.length && [...m].every(x => x.classList.contains('ok')); }).length, err: (document.querySelector('#qws-box .qws-err') || {}).textContent || '', tts: window.__tts.map(p => [p.provider, p.voice, p.style, p.text, p.feature].join('|')), puts: window.__puts, a: ((getQuizFormData().watchFirst || {}).story || { lines: [] }).lines.map(x => (x.w === 'q' ? x.k : x.d) || ''), old: ((getQuizFormData().watchFirst || {}).story || { lines: [] }).lines.map(x => x.a || ''), b: ((getQuizFormData().watchFirst || {}).story || { lines: [] }).lines.map(x => x.b || ''), chip: (W => W.label + '|' + W.on + '|' + !!W.wait)(_qeWatchState()), chipTip: _qeWatchState().title }; });
        let w = await vv();
        ok(w.n === '0/3' && !w.all && w.notes === 0, 'a 🗣 button in the story header counts the sounds: 0/3 — the intern line needs one, the key line two (V102.672, owner pick A)');
        ok(w.chip === '🗣 0/3|false|true' && /Interns do not see it until every line is voiced/.test(w.chipTip), 'a Thai story with sounds missing → the chip beside Review is amber 🗣 0/3: interns do not see it yet');
        await page.click('#qws-voice'); await page.waitForFunction(() => document.querySelector('#qws-voice .qws-vn').textContent === '3/3'); w = await vv();
        ok(w.tts.join(' ; ') === 'iapp_tts|kaitom|friendly|ถามอะไร|quiz_watch_voice ; iapp_tts|kaimook|calm|จำไว้|quiz_watch_voice ; iapp_tts|kaidang|calm|จำไว้|quiz_watch_voice', 'V102.697 (owner): the intern = Kaitom friendly; the key line is voiced twice — Kaimook (the main voice) and Kaidang, calm — so the intern can pick');
        ok(w.puts.length === 3 && w.puts.every(p => /^watch-voices\/h\d\.mp3$/.test(p[0]) && p[1] === 'audio/mpeg' && p[2] > 0), 'each sound is stored once at watch-voices/<hash>.mp3: ' + w.puts.map(p => p[0]).join(', '));
        ok(w.a.length === 2 && w.a.every(u => /^https:\/\/firebasestorage\.googleapis\.com\//.test(u)) && w.b[0] === '' && /^https:\/\/firebasestorage\.googleapis\.com\//.test(w.b[1]) && w.b[1] !== w.a[1] && w.all && w.notes === 2 && v.auto < (await view()).auto, 'the links ride on each line (`k` on Q, `d` + `b` on the key line), saved with the quiz; every voice chip on both lines turns green, the button turns green');
        ok(w.chip === '2|true|false' && /every line voiced/.test(w.chipTip), 'every sound ready → the chip is magenta 🎬 2: interns see the story');
        await page.fill('#qws-box .qws-l input', 'ถามใหม่'); w = await vv();
        ok(w.n === '2/3' && !w.all && w.notes === 1 && w.a[0] === '' && w.a[1] !== '' && w.chip === '🗣 2/3|false|true', 'retyping a line drops its sound (it no longer says the line): 2/3, and the chip goes amber again');
        await page.click('#qws-voice'); await page.waitForFunction(() => document.querySelector('#qws-voice .qws-vn').textContent === '3/3'); w = await vv();
        ok(w.tts.length === 4 && /\|ถามใหม่\|/.test(w.tts[3]), '🗣 again voices only the sound that is missing');
        await page.click('#qws-voice'); await page.waitForSelector('#qws-box .qws-err'); w = await vv();
        ok(w.tts.length === 4 && /already has its voice/.test(w.err), 'all voiced → no call, it says so');
        await page.click('#qws-box .qws-l:nth-of-type(2) .qws-w, #qws-box .qws-l.k .qws-w'); w = await vv();
        ok(w.a[1] === '' && w.b[1] === '' && w.n === '1/2', 'another speaker on a line = another voice: its sounds are dropped (KEY → Q needs one sound)');
        await page.evaluate(() => { window.__ttsFail = 6; QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'หนึ่ง', q: [1] }, { w: 'rx', t: 'สอง', q: [1] }, { w: 'key', t: 'สาม', q: [1] }] }); });
        await page.click('#qws-voice'); await page.waitForSelector('#qws-box .qws-err'); w = await vv();
        ok(/stopped at sound 2 of 5: quota/.test(w.err) && w.n === '1/5' && w.a[0] !== '' && w.a[1] === '' && w.a[2] === '', 'a failed call stops there and says which sound; the one already made is kept: ' + w.err.slice(0, 60));
        await page.evaluate(() => QuizWatchStory.set({ lang: 'en', lines: [{ w: 'q', t: 'Why?', q: [1] }] })); await page.click('#qws-voice'); await page.waitForSelector('#qws-box .qws-err'); w = await vv();
        ok(/Thai stories only/.test(w.err) && w.tts.length === 6 && w.chip === '1|true|false', 'an English story: no call — Thai only for now, it says so; its chip is not held back (the phone voice reads it)');
        await page.evaluate(() => QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ก', q: [1], k: 'https://evil.test/x.mp3' }, { w: 'rx', t: 'ข', q: [1], d: 'https://firebasestorage.googleapis.com/v0/b/x/o/ok.mp3?alt=media' }] })); w = await vv();
        ok(w.a[0] === '' && /ok\.mp3/.test(w.a[1]) && w.n === '1/3', 'a saved story keeps only Storage links as sounds');
        // V102.697: a story voiced before (old set: Q `a` Kaimook, RX `a` Kaitom + `b` Kaidang) keeps its sounds and stays on for interns; 🗣 counts the NEW set
        await page.evaluate(() => { const L = n => 'https://firebasestorage.googleapis.com/v0/b/x/o/' + n + '.mp3?alt=media'; QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ก', q: [1], a: L('q') }, { w: 'rx', t: 'ข', q: [1], a: L('rx'), b: L('rxb') }] }); }); w = await vv();
        ok(w.n === '1/3' && w.old.every(Boolean) && w.chip === '2|true|false' && /OLD voices/.test(w.chipTip), 'old-voiced story: the old sounds are kept, the chip stays on (interns hear the old voices), its title says so, 🗣 1/3 (Kaidang is shared): ' + w.chip + ' · ' + w.n);
        console.log('🗣 Paxa — the optional third pharmacist voice (V102.674)');
        await page.evaluate(() => {
            window.__vf = 0; window.__t0 = window.__tts.length;
            window.fetch = async u => { window.__vf++; if (String(u) !== 'https://api.paxalabs.com/v1/voices') throw new Error('unexpected fetch ' + u);
                return { ok: true, json: async () => ({ voices: [{ id: 'khanomkrok', name: 'Khanom Krok', gender: 'm', model: 'paxa-tts-flash-v1', description: 'the v1 twin' }, { id: 'khanomkrok', name: 'Khanom Krok', gender: 'm', model: 'paxa-tts-flash-v2', description: 'Calm elder voice' },
                    { id: 'nomyen', name: 'Nom Yen', gender: 'f', model: 'paxa-tts-flash-v2', description: 'Bright young voice' }, { id: 'bad id', name: 'Bad', gender: 'f', model: 'paxa-tts-flash-v2' }, { id: 'testy', name: 'Testy', gender: 'm', model: 'paxa-tts-flash-v2', experimental: true }] }) }; };
            QuizWatchStory._S.pxGap = 10; QuizWatchStory._S.pxVoices = null;
            window.__played = []; window.Audio = function (u) { const a = this; a.src = u; a.play = () => { window.__played.push(u); window.__au = a; return Promise.resolve(); }; a.pause = () => { a.paused = true; }; };   // headless: no real sound
            QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ถาม', q: [1] }, { w: 'rx', t: 'ตอบ', q: [1] }, { w: 'key', t: 'จำ', q: [1] }] });
        });
        const px = () => page.evaluate(() => { const b = document.getElementById('qws-paxa'), st = (getQuizFormData().watchFirst || {}).story || { lines: [] };
            return { btn: b ? b.textContent.replace(/\s+/g, ' ').trim() : null, all: !!b && b.classList.contains('all'), open: !!document.getElementById('qws-pxp'), names: [...document.querySelectorAll('#qws-pxp .qws-pxl button')].map(x => x.textContent.trim() + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')),
                tips: [...document.querySelectorAll('#qws-pxp .qws-pxl button')].map(x => x.title), filt: [...document.querySelectorAll('#qws-pxp .qws-pxf button')].map(x => x.textContent.trim()), pv: st.pv || null, c: st.lines.map(x => x.c ? 1 : 0).join(''), err: (document.querySelector('#qws-box .qws-err') || {}).textContent || '',
                tts: window.__tts.slice(window.__t0).map(p => [p.provider, p.voice, p.text, p.feature].join('|')), vf: window.__vf, v: QuizWatchStory.voice(), wide: (e => !!e && e.scrollWidth > e.clientWidth + 1)(document.querySelector('#praOverlay .pra')) }; });
        let p = await px();
        ok(p.btn === '＋ Paxa' && !p.open && p.pv === null && p.vf === 0 && p.v.px === null, 'a Thai story has a ＋ Paxa button beside 🗣; nothing is fetched until it is tapped');
        await page.click('#qws-paxa'); await page.waitForSelector('#qws-pxp .qws-pxl button'); p = await px();
        ok(p.vf === 1 && p.names.join(' | ') === '♂ Khanom Krok | ♀ Nom Yen' && p.tips[0] === 'Calm elder voice — tap to hear it' && p.filt.join(' | ') === 'All 2 | ♀ 1 | ♂ 1', 'tap → every Paxa v2 voice from Paxa\'s public list, as chips with what each sounds like (the v1 twin, a bad id and an experimental voice are left out)');
        await page.click('#qws-pxp .qws-pxf button:nth-child(2)'); p = await px();
        ok(p.names.join() === '♀ Nom Yen', 'the ♀ / ♂ filter narrows the chips');
        // V102.694 (owner pick B): a chip tap only PLAYS a sample; ✓ Use picks
        const ear = () => page.evaluate(() => ({ puts: window.__puts.filter(x => /sample-/.test(x[0])).map(x => x[0] + '|' + x[1]), played: window.__played.length, use: (document.querySelector('#qws-pxp .qws-use') || {}).textContent || '', earCls: [...document.querySelectorAll('#qws-pxp .qws-pxl button.ear')].map(x => x.textContent.trim()) }));
        await page.click('#qws-pxp .qws-pxl button'); await page.waitForFunction(() => window.__played.length === 1); p = await px(); let e = await ear();
        ok(p.open && p.pv === null && p.tts.join() === 'paxa_tts|nomyen|สวัสดีค่ะ ทานยาหลังอาหารนะคะ|paxa_voice_sample' && e.puts.join() === 'watch-voices/sample-nomyen.mp3|audio/mpeg' && e.earCls.join() === '▮▮▮♀ Nom Yen' && e.use === '✓ Use Nom Yen', 'tap a chip → it plays a ♀ sample (one paxa_tts call, fixed text — ค่ะ for ♀), kept at watch-voices/sample-nomyen.mp3; the chip is outlined and playing; ✓ Use Nom Yen appears; nothing is picked');
        await page.click('#qws-pxp .qws-pxl button.ear'); e = await ear();
        ok(e.earCls.join() === '♀ Nom Yen' && await page.evaluate(() => window.__au.paused === true), 'tap the playing chip again → it stops');
        await page.click('#qws-pxp .qws-pxl button'); await page.waitForFunction(() => window.__played.length === 2); p = await px();
        ok(p.tts.length === 1, 'hear it again → the stored sample plays, no second paid call');
        await page.evaluate(() => { QuizWatchStory._S.pxUrls = {}; }); await page.click('#qws-pxp .qws-pxl button'); await page.click('#qws-pxp .qws-pxl button'); await page.waitForFunction(() => window.__played.length === 3); p = await px();
        ok(p.tts.length === 1, 'a fresh page finds the sample already in Storage → still no paid call (made once, for every admin)');
        await page.evaluate(() => { window.__t0 = window.__tts.length; });
        await page.click('#qws-pxp .qws-use'); p = await px();
        ok(p.v.need === 5 && p.v.have === 0 && p.v.px.need === 2, 'Paxa is not part of the "all voiced" count (Chinda still needs 5 sounds)');
        await page.click('#qws-paxa'); await page.waitForFunction(() => /2\/2$/.test(document.getElementById('qws-paxa').textContent.trim()) && !QuizWatchStory._S.busy); p = await px();
        ok(p.tts.join(' ; ') === 'paxa_tts|nomyen|ตอบ|quiz_watch_voice ; paxa_tts|nomyen|จำ|quiz_watch_voice' && p.c === '011' && p.all && !p.err, 'tap again → one paxa_tts call per pharmacist line with the picked voice; the sounds ride on the lines as `c`; the button fills');
        await page.click('#qws-paxa'); await page.waitForSelector('#qws-box .qws-err'); p = await px();
        ok(p.tts.length === 2 && /already has its Nom Yen sound/.test(p.err), 'all made → no call, it says so');
        await page.fill('#qws-box .qws-l:nth-of-type(2) input, #qws-box .qws-l + .qws-l input', 'ตอบใหม่'); p = await px();
        ok(p.c === '001' && p.btn === '🗣 Nom Yen 1/2' && !p.all, 'retyping a pharmacist line drops its Paxa sound too');
        await page.click('#qws-paxa-pick'); await page.waitForSelector('#qws-pxp .qws-pxl button'); p = await px();
        ok(p.vf === 1 && p.names.join(' | ') === '♂ Khanom Krok | ♀ Nom Yen*', '▾ reopens the list (kept, not fetched again) with the picked voice lit');
        await page.click('#qws-pxp .qws-pxl button'); await page.waitForSelector('#qws-pxp .qws-use'); p = await px();
        ok(p.pv.id === 'nomyen' && p.c === '001' && p.tts.slice(-1)[0] === 'paxa_tts|khanomkrok|สวัสดีครับ ทานยาหลังอาหารนะครับ|paxa_voice_sample', 'hearing another voice (♂ → ครับ) leaves the picked voice and its sounds alone');
        ok(/the Nom Yen sounds are made again/.test(await page.getAttribute('#qws-pxp .qws-use', 'title')), '✓ Use says the old voice\'s sounds will be made again');
        await page.click('#qws-pxp .qws-use'); p = await px();
        ok(p.pv.id === 'khanomkrok' && p.c === '000' && p.btn === '🗣 Khanom Krok 0/2', 'another voice → the old voice\'s sounds are dropped');
        ok(await page.evaluate(() => { const U = 'https://firebasestorage.googleapis.com/v0/b/x/o/c.mp3?alt=media'; QuizWatchStory.set({ lang: 'th', lines: [{ w: 'rx', t: 'ข', q: [1], c: U }] }); const a = QuizWatchStory.get().lines[0].c; QuizWatchStory.set({ lang: 'th', pv: { id: 'nomyen', name: 'Nom <b>Yen' }, lines: [{ w: 'rx', t: 'ข', q: [1], c: U }, { w: 'q', t: 'ก', q: [1], c: U }] }); const g = QuizWatchStory.get(); QuizWatchStory.set({ lang: 'en', lines: [{ w: 'rx', t: 'Why', q: [1] }] }); const en = !document.getElementById('qws-paxa'); QuizWatchStory.set({ lang: 'th', lines: [{ w: 'q', t: 'ก', q: [1] }] }); return a === undefined && g.lines[0].c === U && g.lines[1].c === undefined && g.pv.name === 'Nom bYen' && en; }),
            'a saved story keeps `c` only with a picked voice and only on pharmacist lines; the name is cleaned; an English story has no Paxa button');
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
