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
            // V101.316: the story voice starts by itself. Here speak() is silent (a phone that refuses a voice nobody tapped for) until a test swaps it.
            window.__spoke = 0; window.SpeechSynthesisUtterance = function (t) { this.text = t; };
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: { speak: () => { window.__spoke++; }, cancel: () => {} } });
            HTMLMediaElement.prototype.play = function () { window.__plays++; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
            HTMLMediaElement.prototype.pause = function () {};
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        // index.html reloads itself 15 s after load when the LIFF SDK is missing ("SDK Failed to Load") — in this harness that wipes the page mid-test
        await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = function (f, ms) { if (ms === 15000 && /location\.reload/.test(String(f))) return 0; return st.apply(this, arguments); }; });
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
            dots: w ? [...w.querySelectorAll('.qws-prog i')].map(i => i.className === 'on' ? 1 : 0).join('') : '', snd: w && w.querySelector('.qws-snd') ? w.querySelector('.qws-snd').getAttribute('aria-pressed') : null, sndText: w && w.querySelector('.qws-snd') ? w.querySelector('.qws-snd').textContent : '', go: w && w.querySelector('.qwf-go') ? w.querySelector('.qwf-go').textContent : '', skip: !!(w && w.querySelector('.qwf-skip')), html: c ? c.innerHTML : '', read: w && w.querySelector('.qwf-read') ? w.querySelector('.qwf-read').textContent + '|' + w.querySelector('.qwf-read').getAttribute('aria-pressed') : '', lean: !!w && !w.querySelector('.qwf-h, .qws-t, .qwf-n'), scroll: c ? getComputedStyle(c).overflowY : '', sndVis: !!(w && w.querySelector('.qws-snd') && w.querySelector('.qws-snd').getClientRects().length), overflow: document.documentElement.scrollWidth > innerWidth + 1, h: w ? Math.round(w.getBoundingClientRect().height) : 0 }; });
        await page.evaluate(() => localStorage.removeItem('qwsMute'));
        await start({ watchFirst: { story: STORY } }); let st = await sv();
        ok(st.snd === 'true' && await page.evaluate(() => window.__spoke === 1), 'the voice is ON when the page opens: the first line is sent to the voice (V101.316)');
        await page.waitForFunction(() => document.querySelector('#quizModal .qws-snd').getAttribute('aria-pressed') === 'false', null, { timeout: 4000 }); st = await sv();
        ok(/^🔇/.test(st.sndText) && st.lines.length === 1 && await page.evaluate(() => localStorage.getItem('qwsMute') === null), 'the phone said nothing for 1.5 s → the page goes quiet by itself (🔇 Tap for sound), still on line 1; nothing is remembered');
        ok(st.story && !st.video && st.lines.length === 1 && st.lines[0] === 'q:What is body-identical?' && st.dots === '100', 'no film link but a story → the chat plays here: first line on screen, 3 valid lines (bad ones dropped)');
        ok(st.go === 'Start the quiz ▸' && !st.skip && st.snd === 'false' && !st.overflow, 'quiet with its text; Start the quiz can be pressed at any time');
        ok(st.lean && st.read === '📖 Read it|false' && await page.evaluate(() => { const r = document.querySelector('#quizModal .qwf-read').getBoundingClientRect(), g = document.querySelector('#quizModal .qwf-go').getBoundingClientRect(), p = document.querySelector('#quizModal .qws-prog').getBoundingClientRect(), s = document.querySelector('#quizModal .qws-snd').getBoundingClientRect(); return Math.abs(r.top - g.top) < 2 && r.right <= g.left && r.height >= 44 && g.width > r.width && p.right <= s.left + 1 && p.bottom > s.top && p.top < s.bottom; }), 'lean (V101.318, owner pick C): no heading, no title in the card, no caption; progress and 🔊 on one row; 📖 Read it beside Start the quiz');
        await tap('.qwf-read'); st = await sv();
        ok(st.read === '🎬 Play|true' && st.lines.length === 3 && st.dots === '111' && st.scroll === 'auto' && !st.sndVis && !/ now/.test(st.html) && !st.overflow, '📖 Read it → every line at once, scrollable, no 🔊, nothing highlighted; the button becomes 🎬 Play');
        await shot('watch-story-read');
        await page.waitForTimeout(700); ok((await sv()).lines.length === 3 && await page.evaluate(() => window.__spoke === 1), 'while reading nothing is spoken and nothing moves');
        await tap('.qwf-read'); st = await sv();
        ok(st.read === '📖 Read it|false' && st.lines.length === 1 && st.dots === '100' && st.sndVis, '🎬 Play → the story starts again from its first line');
        await page.waitForFunction(() => document.querySelectorAll('#quizModal .qws-chat .qws-m, #quizModal .qws-chat .qws-key').length === 3, null, { timeout: 15000 }); st = await sv();
        ok(st.lines.join(' | ') === 'q:What is body-identical? | rx:The same molecule the ovary makes. | key:💡 Start within 10 years <b>' && st.dots === '111' && !/<b>/.test(st.html), 'the lines come one by one, in order; text is escaped: ' + st.lines.length);
        ok(st.who.join('|') === '🙋 Intern|🧑‍⚕️ Pharmacist', 'who speaks is named once per turn');
        await shot('watch-story-built');
        await page.waitForTimeout(2600); await tap('.qwf-go'); v = await view();
        ok(!v.film && v.primer && v.last.d.watchFirst.kind === 'story' && v.last.d.watchFirst.ended === true && v.last.d.watchFirst.skipped === false && v.last.d.watchFirst.seconds >= 2, 'watched to the end → recorded as a story, ended: ' + JSON.stringify(v.last.d.watchFirst));
        await start({ watchFirst: { story: STORY } }); await tap('.qwf-go'); v = await view();
        ok(v.last.d.watchFirst.kind === 'story' && v.last.d.watchFirst.skipped === true && v.last.d.watchFirst.ended === false, 'Start the quiz on the first line → recorded as skipped');
        ok(v.last.d.watchFirst.read === undefined, 'no `read` flag when 📖 was not used');
        await start({ watchFirst: { story: STORY } }); await tap('.qwf-read'); await tap('.qwf-go'); v = await view();
        ok(v.last.d.watchFirst.kind === 'story' && v.last.d.watchFirst.read === true && v.last.d.watchFirst.skipped === false && v.last.d.watchFirst.ended === false, '📖 Read it then Start → recorded as read: true, not skipped, not "ended": ' + JSON.stringify(v.last.d.watchFirst));
        const said = await page.evaluate(() => { window.__said = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { window.__said.push([u.text, u.lang]); setTimeout(() => u.onend && u.onend(), 30); }, cancel: () => {} } }); return Array.isArray(window.__said); });
        await start({ watchFirst: { story: Object.assign({}, STORY, { lang: 'ko' }) } });   // V101.319: a Thai story needs its AI voices; the phone voice reads the other languages
        await page.waitForFunction(() => (window.__said || []).length >= 3, null, { timeout: 8000 }); st = await sv();
        ok(said && st.snd === 'true' && st.sndText === '🔊' && await page.evaluate(() => __said[0][0] === 'What is body-identical?' && __said[0][1] === 'ko-KR' && __said[2][0] === 'Start within 10 years <b>'), 'a phone that does speak: every line is spoken by itself in the story language, no tap');
        await tap('.qws-snd'); st = await sv();
        ok(st.snd === 'false' && await page.evaluate(() => localStorage.getItem('qwsMute') === '1'), 'a tap on 🔊 mutes it and this phone remembers');
        await tap('.qwf-go'); await start({ watchFirst: { story: STORY } }); st = await sv(); const n0 = await page.evaluate(() => __said.length);
        ok(st.snd === 'false' && /^🔇/.test(st.sndText), 'next time it opens quiet');
        await tap('.qws-snd'); await page.waitForFunction(n => __said.length > n, n0, { timeout: 8000 }); st = await sv();
        ok(st.snd === 'true' && await page.evaluate(() => localStorage.getItem('qwsMute') === null), 'a tap turns the voice back on (and that is remembered too)');
        const LONG = { lang: 'en', lines: Array.from({ length: 30 }, (_, i) => ({ w: i % 2 ? 'rx' : 'q', t: 'Line ' + (i + 1), q: [1] })) };
        ok(await page.evaluate(s => qzWatch.storyOf({ watchFirst: { story: s } }).lines.length, LONG) === 24, 'a story may be 24 lines long (was 12)');
        console.log('AI voices kept on the lines (V101.317)');
        await page.evaluate(() => { window.__au = []; window.__auMode = 'ok'; window.Audio = function (src) { const a = this; a.src = src; window.__au.push(src); a.pause = () => {}; a.play = () => { if (window.__auMode === 'block') return Promise.reject(new Error('NotAllowedError')); setTimeout(() => { const f = window.__auMode === 'bad' ? a.onerror : a.onended; if (f) f(); }, 40); return Promise.resolve(); }; }; });
        const A0 = 'https://firebasestorage.googleapis.com/v0/b/x/o/watch-voices%2Fa0.mp3?alt=media&token=t', A1 = A0.replace('a0', 'a1'), A2 = A0.replace('a0', 'a2'), B1 = A0.replace('a0', 'b1'), B2 = A0.replace('a0', 'b2');
        // V101.319 (owner pick A): a Thai story is complete when every line has `a` and every RX / KEY line also `b` (the second pharmacist voice)
        const VO = { lang: 'th', lines: [{ w: 'q', t: 'What is body-identical?', q: [1], a: A0 }, { w: 'rx', t: 'The same molecule the ovary makes.', q: [1], a: A1, b: B1 }, { w: 'key', t: 'Start within 10 years', q: [2], a: A2, b: B2 }] };
        const three = () => page.waitForFunction(() => document.querySelectorAll('#quizModal .qws-chat .qws-m, #quizModal .qws-chat .qws-key').length === 3 && !document.querySelector('#quizModal .qws-chat .now'), null, { timeout: 15000 });
        const rail = () => page.evaluate(() => [...document.querySelectorAll('#quizModal .qws-rail button')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' | '));
        const railOff = () => page.waitForFunction(() => { const b = document.querySelector('#quizModal .qws-rail [data-v="off"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; }, null, { timeout: 4000 });
        await tap('.qwf-go'); let s0 = await page.evaluate(() => { localStorage.removeItem('qwsVoice'); return __said.length; });
        ok(await page.evaluate(([vo, a0]) => { const S = st => qzWatch.storyOf({ watchFirst: { story: st } }), cut = JSON.parse(JSON.stringify(vo)); delete cut.lines[2].b; const none = JSON.parse(JSON.stringify(vo)); none.lines.forEach(x => { delete x.a; delete x.b; });
            return !!S(vo) && S(vo).pick === true && S(cut) === null && S(none) === null && S({ lang: 'th', lines: [{ w: 'q', t: 'Only this', q: [1], a: 'https://evil.test/x.mp3' }] }) === null && !!S(Object.assign({}, none, { lang: 'en' })) && !S(Object.assign({}, none, { lang: 'en' })).pick; }, [VO, A0]),
            'a Thai story is a story only when every line has its AI voice(s): one sound missing, none at all, or a link that is not a Storage link → no story; an English story still plays (phone voice)');
        await start({ watchFirst: { story: (() => { const c = JSON.parse(JSON.stringify(VO)); delete c.lines[1].b; return c; })() } }); v = await view();
        ok(!v.film && v.primer, 'a Thai story with a sound missing → no Watch first page: the quiz opens on Read first as before');
        await start({ watchFirst: { story: VO } }); await three(); st = await sv();
        ok(st.snd === null && await rail() === '🔇 | 🗣 Kaitom* | 🗣 Kaidang' && await page.evaluate(([a, b, c, n]) => __au.join() === [a, b, c].join() && __said.length === n, [A0, A1, A2, s0]), 'a voiced Thai story: the voice rail 🔇 │ 🗣 Kaitom │ 🗣 Kaidang replaces 🔊; Kaitom by default; every line plays its stored sound, the phone voice says nothing');
        await shot('watch-story-voices');
        await tap('.qws-rail [data-v="b"]'); await page.waitForFunction(() => __au.length === 6, null, { timeout: 15000 }); await three();
        ok(await rail() === '🔇 | 🗣 Kaitom | 🗣 Kaidang*' && await page.evaluate(([a, b, c]) => __au.slice(3).join() === [a, b, c].join() && localStorage.getItem('qwsVoice') === 'b', [A0, B1, B2]), '🗣 Kaidang → the story plays again with the second pharmacist voice (the intern line keeps its own); the pick is kept on this phone');
        await tap('.qwf-go'); await page.evaluate(() => { window.__au = []; });
        await start({ watchFirst: { story: VO } }); await three();
        ok(await rail() === '🔇 | 🗣 Kaitom | 🗣 Kaidang*' && await page.evaluate(([a, b, c]) => __au.join() === [a, b, c].join(), [A0, B1, B2]), 'next time it opens on the voice picked last');
        await tap('.qws-rail [data-v="off"]');
        ok(await rail() === '🔇* | 🗣 Kaitom | 🗣 Kaidang' && await page.evaluate(() => localStorage.getItem('qwsMute') === '1' && localStorage.getItem('qwsVoice') === 'b'), '🔇 mutes (remembered); the picked voice is kept for next time');
        await tap('.qws-rail [data-v="a"]'); await page.evaluate(() => { localStorage.removeItem('qwsVoice'); });
        ok(await rail() === '🔇 | 🗣 Kaitom* | 🗣 Kaidang' && await page.evaluate(() => localStorage.getItem('qwsMute') === null), 'a tap on a voice turns the sound back on');
        await tap('.qwf-go'); await page.evaluate(() => { window.__au = []; window.__auMode = 'block'; });
        await start({ watchFirst: { story: VO } }); await railOff(); st = await sv();
        ok(st.lines.length === 1 && await page.evaluate(() => __au.length === 1), 'the phone refuses a sound nobody tapped for → quiet by itself (🔇 lit), still on line 1');
        await page.evaluate(() => { window.__auMode = 'ok'; }); await tap('.qws-rail [data-v="a"]'); await three();
        ok(await page.evaluate(([a, b, c]) => __au.slice(1).join() === [a, b, c].join(), [A0, A1, A2]), 'a tap on a voice → the stored sounds play from the line on screen');
        await tap('.qwf-go'); s0 = await page.evaluate(() => { window.__au = []; window.__auMode = 'bad'; return __said.length; });
        await start({ watchFirst: { story: VO } }); await three();
        ok(await page.evaluate(n => __au.length === 3 && __said.slice(n).map(x => x[0]).join(' | ') === 'What is body-identical? | The same molecule the ovary makes. | Start within 10 years', s0), 'a sound that will not load → the phone voice says that line instead');
        await page.evaluate(() => { window.__au = []; window.__auMode = 'ok'; });
        // V101.321 (owner pick A, mockup-watch-first-paxa/): an optional third pharmacist voice from Paxa — story.pv + `c` on every RX / KEY line
        const C1 = A0.replace('a0', 'c1'), C2 = A0.replace('a0', 'c2'), VP = JSON.parse(JSON.stringify(VO)); VP.pv = { id: 'nomyen', name: 'Nom Yen' }; VP.lines[1].c = C1; VP.lines[2].c = C2;
        ok(await page.evaluate(vp => { const S = st => qzWatch.storyOf({ watchFirst: { story: st } }), cut = JSON.parse(JSON.stringify(vp)); delete cut.lines[2].c; const nopv = JSON.parse(JSON.stringify(vp)); delete nopv.pv; return S(vp).third === 'Nom Yen' && S(cut).third === '' && !!S(cut) && S(nopv).third === ''; }, VP), 'the third voice shows only when the admin picked one AND every pharmacist line has its sound — a missing one does not hide the story, only the chip');
        await tap('.qwf-go'); await start({ watchFirst: { story: VP } }); await three(); st = await sv();
        ok(await rail() === '🔇 | 🗣 Kaitom* | 🗣 Kaidang | 🗣 Nom Yen' && !st.overflow && await page.evaluate(([a, b, c]) => __au.join() === [a, b, c].join(), [A0, A1, A2]), 'a story with Paxa sounds: a third chip with the voice\'s name; Kaitom still the default; nothing overflows at 390 px');
        await shot('watch-story-paxa');
        await tap('.qws-rail [data-v="c"]'); await page.waitForFunction(() => __au.length === 6, null, { timeout: 15000 }); await three();
        ok(await rail() === '🔇 | 🗣 Kaitom | 🗣 Kaidang | 🗣 Nom Yen*' && await page.evaluate(([a, b, c]) => __au.slice(3).join() === [a, b, c].join() && localStorage.getItem('qwsVoice') === 'c', [A0, C1, C2]), '🗣 Nom Yen → the pharmacist lines play the Paxa sounds (the intern line keeps its own); kept on this phone');
        await tap('.qwf-go'); await page.evaluate(() => { window.__au = []; }); await start({ watchFirst: { story: VO } }); await three();
        ok(await rail() === '🔇 | 🗣 Kaitom* | 🗣 Kaidang' && await page.evaluate(([a, b, c]) => __au.join() === [a, b, c].join() && localStorage.getItem('qwsVoice') === 'c', [A0, A1, A2]), 'a story with no Paxa voice, on a phone that picked it: Kaitom plays; the pick is kept for stories that have it');
        await page.evaluate(() => { localStorage.removeItem('qwsVoice'); window.__au = []; });
        // V101.326 (owner 2026-11-20): new voices — Q `k` Kaitom, pharmacist `d` Kaimook (first) + `b` Kaidang. A story with all of them plays them;
        // a story still voiced the old way keeps playing the old set until every new sound is there.
        const K0 = A0.replace('a0', 'k0'), D1 = A0.replace('a0', 'd1'), D2 = A0.replace('a0', 'd2');
        const NV = { lang: 'th', lines: [{ w: 'q', t: 'What is body-identical?', q: [1], k: K0 }, { w: 'rx', t: 'The same molecule the ovary makes.', q: [1], d: D1, b: B1 }, { w: 'key', t: 'Start within 10 years', q: [2], d: D2, b: B2 }] };
        await tap('.qwf-go'); await start({ watchFirst: { story: NV } }); await three();
        ok(await rail() === '🔇 | 🗣 Kaimook* | 🗣 Kaidang' && await page.evaluate(([a, b, c]) => __au.join() === [a, b, c].join(), [K0, D1, D2]), 'new voices: the rail is 🗣 Kaimook (first) │ 🗣 Kaidang; Q plays Kaitom (k), the pharmacist Kaimook (d)'); await shot('watch-story-kaimook');
        const MIX = JSON.parse(JSON.stringify(VO)); MIX.lines[0].k = K0; MIX.lines[1].d = D1;   // the new set half made: Q k + one d, the KEY line has no d yet
        await page.evaluate(() => { window.__au = []; }); await tap('.qwf-go'); await start({ watchFirst: { story: MIX } }); await three();
        ok(await rail() === '🔇 | 🗣 Kaitom* | 🗣 Kaidang' && await page.evaluate(([a, b, c]) => __au.join() === [a, b, c].join(), [A0, A1, A2]), 'old voices complete, new ones half made → the old set still plays (never a mix)');
        const BOTH = JSON.parse(JSON.stringify(MIX)); BOTH.lines[2].d = D2;
        await page.evaluate(() => { window.__au = []; }); await tap('.qwf-go'); await start({ watchFirst: { story: BOTH } }); await three();
        ok(await rail() === '🔇 | 🗣 Kaimook* | 🗣 Kaidang' && await page.evaluate(([a, b, c]) => __au.join() === [a, b, c].join(), [K0, D1, D2]), 'both sets complete → the new voices win');
        await page.evaluate(() => { localStorage.removeItem('qwsVoice'); window.__au = []; });
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
