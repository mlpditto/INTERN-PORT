// V101.313 / V102.662 🎬 Watch first (owner pick A, mockup-watch-first/): a quiz with a film (`watchFirst.url`) opens on ONE page before
// question 1 — the film, the quiz's topics, ▶ Watch → Start the quiz, or Skip — then 📖 Read first and the questions as before.
// V101.314 / V102.663: leaving the page records watchFirst { at, seconds, ended, skipped, failed } on the intern's own attempt; the admin's attempt row shows it.
// The REAL public/index.html + quiz-watch-first.js on a phone (file://, network blocked, Firebase stubbed); admin.html wiring checked as text.
// SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

console.log('admin: the Quiz Editor field');
{
    const a = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
    ok(/<input type="url" id="quiz-watch-first"[^>]*placeholder="https:\/\/… \.mp4 — plays before question 1"/.test(a) && a.includes('<label for="quiz-watch-first"'), 'one 🎬 Watch first link box under Description');
    ok(a.includes("wf.value = (q.watchFirst && q.watchFirst.url) || '';"), 'loaded from the quiz');
    ok(a.includes("if (wf) { wf.value = ''; wf.style.borderColor = '#334155'; } }"), 'emptied for a new quiz');
    ok(a.includes("const wfUrl = /^https:\\/\\/\\S+$/i.test(wfRaw) ? wfRaw : '';") && a.includes("const watchFirst = wfUrl || wfStory ? { ...(wfUrl ? { url: wfUrl } : {}), ...(wfStory ? { story: wfStory } : {}) } : null;"), 'read as { url } for an https link and / or { story }, null when neither (V102.666)');
    ok(a.includes('notifyDeadline, quizType, watchFirst,'), 'returned by the form (so Save, Launch and templates carry it)');
    ok(a.includes('watchFirst: formData.watchFirst || null,'), 'saved on the quiz');
    const js = fs.readFileSync('public/quiz-watch-first.js', 'utf8');
    ok((js.match(/\.set\(/g) || []).length === 1 && /\.set\(\{ watchFirst: data \}, \{ merge: true \}\)/.test(js) && !/\.update\(|\.delete\(/.test(js) && (js.match(/\.collection\(/g) || []).length === 1, 'V101.314: the intern page writes ONE thing — watchFirst on its own attempt, merged');
    ok(a.includes('${watchNote}${oohNote}${retakeNote}${breakNote}') && a.includes("_wf.failed ? 'did not load' : _wf.skipped ? 'skipped'"), 'the admin\'s attempt row shows 🎬 time ✓ / skipped / did not load');
    js.split('\n').forEach((l, i) => { if (/[฀-๿]/.test(l) && !/^\s*\/\//.test(l)) assert.ok(/[가-힯]/.test(l), 'Thai without Korean on quiz-watch-first.js line ' + (i + 1)); });
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: SHOT ? 2 : 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.__sets = [];
            const doc = (col, id) => ({ id, get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: (d, o) => { window.__sets.push({ col, id, d: JSON.parse(JSON.stringify(d)), merge: !!(o && o.merge) }); return Promise.resolve(); }, update: d => { window.__sets.push(col); return Promise.resolve(); }, onSnapshot: () => () => {} });
            const q = (col) => ({ doc: (id) => doc(col, id), where: () => q(col), orderBy: () => q(col), limit: () => q(col), get: () => Promise.resolve({ docs: [], size: 0, empty: true, forEach: () => {} }), onSnapshot: () => () => {}, add: () => { window.__sets.push(col); return Promise.resolve({ id: 'x' }); } });
            const fsx = () => ({ collection: q, runTransaction: () => Promise.resolve({ status: 'skip' }), batch: () => ({ set() {}, update() {}, commit: () => Promise.resolve() }) });
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(fsx, { FieldValue: { serverTimestamp: () => 'TS', delete: () => 0, increment: () => 0, arrayUnion: () => 0 }, Timestamp: { now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }), fromDate: d => ({ toDate: () => d, toMillis: () => d.getTime() }) } }) };
            // no network: a film never loads here. play() is recorded and answers like a player that started.
            window.__plays = 0;
            HTMLMediaElement.prototype.play = function () { window.__plays++; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
            HTMLMediaElement.prototype.pause = function () {};
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.qzWatch);
        const start = (o) => page.evaluate((o) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            userId = 'U1'; userProfile = { displayName: 'NATT' };
            currentQuiz = Object.assign({ id: 'meno', title: 'Modern Menopause', quizType: 'standard', timerMode: 'per_question', isActive: true, tagList: ['Menopause', 'Hormone Therapy', 'Patient Counseling', 'Women Health', 'Fifth tag'],
                watchFirst: { url: 'https://film.test/meno.mp4' },
                questions: [
                    { type: 'choice', primer: 'Body-identical = the same molecule the ovary makes.', q: 'What does body-identical mean?', options: ['Same molecule', 'Plant extract'], correct: 0, timer: 60 },
                    { type: 'choice', primer: 'Start within 10 years of menopause.', q: 'When is the window of opportunity?', options: ['Within 10 years', 'After 65'], correct: 0, timer: 60 }
                ], deadline: { toDate: () => new Date(Date.now() + 3 * 864e5) } }, o || {});
            quizzesCache = [currentQuiz]; quizAttemptsCache = { meno: { quizId: 'meno', userId: 'U1', status: 'started' } };
            isPracticeMode = false; currentStep = 0; shuffleMap = [null, null]; primerSeen = []; answerChecked = [];
            userAnswers = new Array(2).fill(null); stepTimeRemaining = new Array(2).fill(null); durationsPerQuestion = new Array(2).fill(0); accumulatedTime = 0;
            document.getElementById('quizModal').style.display = 'flex';
            renderQuizStep();
            if (o && o.__quiet) { const fv = document.querySelector('.qwf-v'); if (fv) fv.addEventListener('error', e => e.stopImmediatePropagation(), true); }   // keep the page in its first state: here no film can load
            [...document.querySelectorAll('body *')].filter(e => e.textContent.length < 160 && /เจอจุดผิด|Something looks wrong/.test(e.textContent) && getComputedStyle(e).position !== 'static').forEach(e => e.remove());   // the 🚩 how-to bubble
        }, o || null);
        const view = () => page.evaluate(() => {
            const w = document.querySelector('#quizModal .qwf'), vis = id => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; };
            const v = w && w.querySelector('.qwf-v'), go = w && w.querySelector('.qwf-go'), skip = w && w.querySelector('.qwf-skip');
            return { film: !!w, primer: !!document.querySelector('#quizModal .quiz-primer'), options: document.querySelectorAll('#quiz-run-container input[type=radio], #quiz-run-container .quiz-option, #quiz-run-container label').length,
                src: v ? v.getAttribute('src') : null, attrs: v ? [v.hasAttribute('playsinline'), v.hasAttribute('controls'), v.autoplay] : null, head: w ? w.querySelector('.qwf-h').textContent : '', go: go ? go.textContent : '', goH: go ? Math.round(go.getBoundingClientRect().height) : 0, skip: !!skip && !skip.hidden, skipH: skip ? Math.round(skip.getBoundingClientRect().height) : 0,
                tags: w ? [...w.querySelectorAll('.qwf-t span')].map(s => s.textContent) : [], note: w ? w.querySelector('.qwf-n').textContent : '', bad: !!(w && w.querySelector('.qwf-n.bad')),
                badge: (document.getElementById('quiz-q-type-badge') || {}).innerText || '', timer: (document.getElementById('quiz-q-timer') || {}).innerText || '', startBtn: vis('btn-quiz-primer-start'), nav: ['btn-quiz-prev', 'btn-quiz-next', 'btn-quiz-submit'].filter(vis).join(),
                seen: !!primerSeen.watch, overflow: document.documentElement.scrollWidth > innerWidth + 1, plays: window.__plays, sets: window.__sets.length, last: window.__sets[window.__sets.length - 1] || null };
        });
        const tap = sel => page.locator('#quizModal ' + sel).click();
        const shot = async n => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); } };

        console.log('a quiz without a film');
        await start({ watchFirst: null });
        let v = await view();
        ok(!v.film && v.primer && v.startBtn, 'no film → 📖 Read first of question 1, exactly as before');
        await start({ watchFirst: { url: 'http://film.test/a.mp4' } }); v = await view();
        ok(!v.film && v.primer, 'a link that is not https is not a film');
        await start({ watchFirst: { url: 'javascript:alert(1)' } }); v = await view();
        ok(!v.film, 'nor is a script link');

        console.log('the Watch first page');
        await start({ __quiet: true }); v = await view();
        ok(v.film && !v.primer && v.options === 0, 'a quiz with a film opens on 🎬 Watch first, before Read first and before any question');
        ok(v.src === 'https://film.test/meno.mp4' && v.attrs.join() === 'true,true,false', 'the film: in-page player, its own controls, never starts by itself');
        ok(/Watch first/.test(v.head) && /before question 1/.test(v.head) && v.badge === '🎬' && v.timer === '', 'header says so; the timer shows nothing');
        ok(v.tags.join('|') === 'Menopause|Hormone Therapy|Patient Counseling|Women Health', 'the quiz\'s first four tags as topic chips');
        ok(v.go === '▶ Watch' && v.goH >= 44 && v.skip && v.skipH >= 44 && !v.startBtn && v.nav === '', 'one big ▶ Watch + Skip the film; no ▶ ⏱ / Next / Submit: [' + v.nav + ']');
        ok(!v.overflow, 'no sideways scroll at 390 px');
        await shot('watch-built');
        await start(); await page.waitForTimeout(400); v = await view();
        ok(v.bad && /could not load/.test(v.note) && v.go === 'Start the quiz ▸', 'a film that cannot load says so and the quiz can start (the network is blocked here)');
        await tap('.qwf-go'); v = await view();
        ok(v.last && v.last.d.watchFirst.failed === true && v.last.d.watchFirst.skipped === true && v.last.d.watchFirst.seconds === 0, 'recorded: the film did not load');

        console.log('watch, then start');
        await start({ __quiet: true });
        await tap('.qwf-go'); v = await view();
        ok(v.plays === 1 && v.film && v.go === 'Start the quiz ▸' && !v.skip, '▶ Watch plays the film; the button becomes Start the quiz, Skip goes away');
        await shot('watch-built-playing');
        await tap('.qwf-go'); v = await view();
        ok(!v.film && v.primer && v.seen && v.startBtn, 'Start the quiz → 📖 Read first of question 1');
        ok(v.last.col === 'quiz_attempts' && v.last.id === 'meno_U1' && v.last.merge === true && Object.keys(v.last.d).join() === 'watchFirst', 'V101.314: one merged write to the intern\'s own attempt, watchFirst only: ' + JSON.stringify(v.last));
        ok(JSON.stringify([v.last.d.watchFirst.skipped, v.last.d.watchFirst.failed, v.last.d.watchFirst.ended, v.last.d.watchFirst.seconds]) === '[false,false,false,0]' && v.last.d.watchFirst.at > 0, 'pressed ▶ Watch and went on at once → watched, 0 s');
        await start({ __quiet: true });
        await page.evaluate(() => { const f = document.querySelector('.qwf-v'); f.dispatchEvent(new Event('play')); Object.defineProperty(f, 'currentTime', { value: 72.4, configurable: true }); f.dispatchEvent(new Event('timeupdate')); Object.defineProperty(f, 'currentTime', { value: 30, configurable: true }); f.dispatchEvent(new Event('timeupdate')); });
        await tap('.qwf-go'); v = await view();
        ok(v.last.d.watchFirst.seconds === 72 && !v.last.d.watchFirst.ended, 'the furthest point reached is kept (72 s), not where the bar was left');
        await start({ __quiet: true });
        await page.evaluate(() => { const f = document.querySelector('.qwf-v'); f.dispatchEvent(new Event('play')); Object.defineProperty(f, 'duration', { value: 92, configurable: true }); f.dispatchEvent(new Event('ended')); });
        await tap('.qwf-go'); v = await view();
        ok(v.last.d.watchFirst.ended === true && v.last.d.watchFirst.seconds === 92, 'watched to the end → ended, 92 s');
        await page.evaluate(() => startQuizQuestionAfterPrimer()); v = await view();
        ok(!v.film && !v.primer && v.options > 0, '▶ → question 1');
        await page.evaluate(() => { currentStep = 1; renderQuizStep(); }); v = await view();
        ok(!v.film && v.primer, 'question 2 opens on its own Read first — the film is not shown again');
        await page.evaluate(() => { currentStep = 0; renderQuizStep(); }); v = await view();
        ok(!v.film, 'back on question 1 in the same run: no film again');

        console.log('a story instead of a film (V101.315)');
        const STORY = { lang: 'en', lines: [{ w: 'q', t: 'What is body-identical?', q: [1] }, { w: 'rx', t: 'The same molecule the ovary makes.', q: [1] }, { w: 'key', t: 'Start within 10 years <b>', q: [2] }, { w: 'bad', t: 'dropped' }, { w: 'rx', t: '  ' }] };
        const sv = () => page.evaluate(() => { const w = document.querySelector('#quizModal .qwf'), c = w && w.querySelector('.qws-chat'); return { story: !!c, video: !!(w && w.querySelector('video')), lines: c ? [...c.querySelectorAll('.qws-m, .qws-key')].map(e => (e.classList.contains('qws-key') ? 'key:' : e.classList.contains('q') ? 'q:' : 'rx:') + e.textContent) : [], who: c ? [...c.querySelectorAll('.qws-who')].map(e => e.textContent) : [],
            dots: w ? [...w.querySelectorAll('.qws-prog i')].map(i => i.className === 'on' ? 1 : 0).join('') : '', snd: w && w.querySelector('.qws-snd') ? w.querySelector('.qws-snd').getAttribute('aria-pressed') : null, go: w && w.querySelector('.qwf-go') ? w.querySelector('.qwf-go').textContent : '', skip: !!(w && w.querySelector('.qwf-skip')), html: c ? c.innerHTML : '', overflow: document.documentElement.scrollWidth > innerWidth + 1, h: w ? Math.round(w.getBoundingClientRect().height) : 0 }; });
        await start({ watchFirst: { story: STORY } }); let st = await sv();
        ok(st.story && !st.video && st.lines.length === 1 && st.lines[0] === 'q:What is body-identical?' && st.dots === '100', 'no film link but a story → the chat plays here: first line on screen, 3 valid lines (bad ones dropped)');
        ok(st.go === 'Start the quiz ▸' && !st.skip && st.snd === 'false' && !st.overflow, 'muted with its text; one button — Start the quiz (it can be pressed at any time)');
        await page.waitForFunction(() => document.querySelectorAll('#quizModal .qws-chat .qws-m, #quizModal .qws-chat .qws-key').length === 3, null, { timeout: 15000 }); st = await sv();
        ok(st.lines.join(' | ') === 'q:What is body-identical? | rx:The same molecule the ovary makes. | key:💡 Start within 10 years <b>' && st.dots === '111' && !/<b>/.test(st.html), 'the lines come one by one, in order; text is escaped: ' + st.lines.length);
        ok(st.who.join('|') === '🙋 Intern|🧑‍⚕️ Pharmacist', 'who speaks is named once per turn');
        await shot('watch-story-built');
        await page.waitForTimeout(2600); await tap('.qwf-go'); v = await view();
        ok(!v.film && v.primer && v.last.d.watchFirst.kind === 'story' && v.last.d.watchFirst.ended === true && v.last.d.watchFirst.skipped === false && v.last.d.watchFirst.seconds >= 2, 'watched to the end → recorded as a story, ended: ' + JSON.stringify(v.last.d.watchFirst));
        await start({ watchFirst: { story: STORY } }); await tap('.qwf-go'); v = await view();
        ok(v.last.d.watchFirst.kind === 'story' && v.last.d.watchFirst.skipped === true && v.last.d.watchFirst.ended === false, 'Start the quiz on the first line → recorded as skipped');
        const said = await page.evaluate(() => { window.__said = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { window.__said.push([u.text, u.lang]); setTimeout(() => u.onend && u.onend(), 30); }, cancel: () => {} } }); return Array.isArray(window.__said); });
        await start({ watchFirst: { story: Object.assign({}, STORY, { lang: 'th' }) } }); await tap('.qws-snd');
        await page.waitForFunction(() => (window.__said || []).length >= 2, null, { timeout: 8000 }); st = await sv();
        ok(said && st.snd === 'true' && await page.evaluate(() => __said[0][0] === 'What is body-identical?' && __said[0][1] === 'th-TH'), 'a tap turns the voice on: the line on screen is spoken in the story language, then the next');
        await tap('.qwf-go');
        await start({ watchFirst: { url: 'https://film.test/meno.mp4', story: STORY }, __quiet: true }); st = await sv();
        ok(st.video && !st.story, 'a quiz with both: the film link wins');
        await tap('.qwf-skip');
        await start({ watchFirst: { story: { lines: [{ w: 'rx', t: '' }] } } }); v = await view();
        ok(!v.film && v.primer, 'a story with no usable line is no story — Read first as before');

        console.log('skip · no Read first · other languages');
        await start({ __quiet: true }); await tap('.qwf-skip'); v = await view();
        ok(!v.film && v.primer && v.plays === 1, 'Skip the film → Read first, nothing played');
        ok(v.last.d.watchFirst.skipped === true && v.last.d.watchFirst.seconds === 0 && !v.last.d.watchFirst.failed, 'recorded as skipped');
        const nBefore = v.sets;
        await start({ __quiet: true }); await page.evaluate(() => { isPracticeMode = true; }); await tap('.qwf-skip'); v = await view();
        ok(v.sets === nBefore, 'practice mode: nothing recorded');
        await page.evaluate(() => { isPracticeMode = false; });
        await start({ __quiet: true }); await page.evaluate(() => { quizAttemptsCache = {}; }); await tap('.qwf-skip'); v = await view();
        ok(v.sets === nBefore && !v.film, 'no started attempt → nothing recorded (no stray document), the quiz goes on');
        await start({ __quiet: true, questions: [{ type: 'choice', q: 'No primer here?', options: ['A', 'B'], correct: 0, timer: 60 }] });
        const t0 = Date.now(); await tap('.qwf-skip'); v = await view();
        ok(!v.film && !v.primer && v.options > 0 && await page.evaluate(t => stepStartTimestamp >= t, t0), 'question 1 has no Read first → the question opens and its clock starts then');
        await page.evaluate(() => { window.qtGetSelectedLang = () => 'th'; }); await start({ __quiet: true }); v = await view();
        ok(/ดูก่อนทำ/.test(v.head) && v.go === '▶ ดูหนัง', 'Thai quiz language → Thai page: ' + v.go);
        await page.evaluate(() => { window.qtGetSelectedLang = () => 'ko'; }); await start({ __quiet: true }); v = await view();
        ok(/먼저 보기/.test(v.head), 'Korean too');
        ok(await page.evaluate(() => window.__sets.every(x => x.col === 'quiz_attempts' && x.merge && Object.keys(x.d).join() === 'watchFirst')), 'every write in this run was watchFirst on the attempt, merged');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        console.log('\nquiz-watch-first-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
