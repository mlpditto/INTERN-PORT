// V102.670 (owner pick A2, mockup-watch-first-access/): 📖 Read first and 🎬 Watch first share ONE chip beside 🛡 Review and ONE window
// with two tabs. The chip says the state by colour (no ✓): 📖 amber → green when every question has a Read first; 🎬 grey ＋ → magenta
// when a story or a film is set. The Watch first block left ⚙ — it is parked hidden and moved into the window's 🎬 tab while it is open.
// The REAL public/admin.html in Chromium (network stubbed), callUniversalAI stubbed. SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
{
    const a = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
    const i = a.indexOf('<div id="qe-watch-home" hidden><div id="qe-watch-block">'), j = a.indexOf('id="quiz-watch-first"'), k = a.indexOf('id="qws-box"');
    ok(i > 0 && j > i && k > j && a.indexOf('</div></div>', k) - k < 120, 'the Watch first block (link · ✨ · story box) is wrapped and parked hidden — it keeps its ids');
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
        await page.waitForFunction(() => typeof updateQuizEditorSummary === 'function' && typeof addQuestionUI === 'function' && !!window.QuizWatchStory && typeof _qPrimerReviewAll === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        const setup = primers => page.evaluate(primers => {
            const m = document.getElementById('quizManageModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            window.showToast = () => {}; window.triggerAutoSave = () => {};
            if (typeof _praClose === 'function') _praClose(); localStorage.removeItem('praTab');
            document.getElementById('quiz-title').value = 'Modern Menopause';
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            primers.forEach((p, i) => addQuestionUI({ q: 'Question ' + (i + 1) + ' text', type: 'choice', options: ['a', 'b'], correct: [0], primer: p }));
            document.getElementById('quiz-watch-first').value = ''; QuizWatchStory.set(null);
            window.callUniversalAI = () => Promise.resolve({ text: 'Q [1]: What is body-identical?\nRX [1]: The same molecule as 17β-estradiol.\nRX [2]: A gel on the skin skips the liver.\nKEY [1,2]: Uterus present = add a progestogen' });
            window._qPrimerStrip();
        }, primers);
        const chip = () => page.evaluate(() => { const c = document.getElementById('qe-rf-chip'), w = c.querySelector('.rf-w'), vis = e => !!e && e.getClientRects().length > 0;
            return { text: c.textContent.replace(/\s+/g, ' ').trim(), ok: c.classList.contains('ok'), color: getComputedStyle(c).color, w: w ? w.textContent : '', on: !!w && w.classList.contains('on'), wColor: w ? getComputedStyle(w).color : '', tip: w ? w.title : '',
                inGear: vis(document.getElementById('quiz-watch-first')) || vis(document.getElementById('qws-make')), home: document.getElementById('qe-watch-block').parentElement.id }; });
        const win = () => page.evaluate(() => { const ov = document.getElementById('praOverlay'); if (!ov) return null; const vis = e => !!e && e.getClientRects().length > 0, pra = ov.querySelector('.pra');
            return { tabs: [...ov.querySelectorAll('.pra-tab')].map(b => b.textContent.trim() + (b.getAttribute('aria-selected') === 'true' ? '*' : '')), read: vis(ov.querySelector('.pra-body')) || vis(ov.querySelector('.pra-hd')), watch: vis(ov.querySelector('#pra-watch')),
                link: vis(document.getElementById('quiz-watch-first')), make: vis(document.getElementById('qws-make')), lines: ov.querySelectorAll('#pra-watch .qws-l').length, x: [...ov.querySelectorAll('.pra-x')].filter(vis).length,
                wide: pra.scrollWidth > pra.clientWidth + 1, saved: localStorage.getItem('praTab'), wColor: getComputedStyle(ov.querySelector('.pra-tab[data-t="watch"] .rf-w')).color }; });
        const shot = async n => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); };
        const GREEN = 'rgb(22, 101, 52)', AMBER = 'rgb(146, 64, 14)', GREY = 'rgb(148, 163, 184)', MAGENTA = 'rgb(162, 28, 175)';

        console.log('the chip');
        await setup(['**Estradiol** note', '']); let c = await chip();
        ok(/^📖 1\/2 · 1🎬 ＋$/.test(c.text) && !c.ok && c.color === AMBER, 'one question has no Read first → 📖 1/2 · ⚡ 1 in amber: ' + c.text);
        ok(c.w === '🎬 ＋' && !c.on && c.wColor === GREY && /No Watch first yet/.test(c.tip), 'no story, no film → the 🎬 half is grey ＋');
        ok(!c.inGear && c.home === 'qe-watch-home', 'the Watch first block is no longer in ⚙ (parked, hidden)');
        await setup(['**Estradiol** note', '**Gel** note']); c = await chip();
        ok(c.text === '📖 2/2🎬 ＋' && c.ok && c.color === GREEN && !/✓/.test(c.text), 'every question has one → green, and no ✓ (the colour says it): ' + c.text);
        await shot('chip-green-grey');

        console.log('one window, two tabs');
        await page.click('#qe-rf-chip'); let w = await win();
        ok(w && w.tabs.join(' | ') === '📖 Read first* | 🎬 Watch first' && w.read && !w.watch && !w.link, 'the chip opens the window on 📖 Read first; 🎬 Watch first is the second tab');
        ok(w.x === 1 && !w.wide && w.wColor === GREY, 'one ✕, nothing overflows, the 🎬 tab is grey while there is no Watch first');
        await shot('tab-read');
        await page.click('#praOverlay .pra-tab[data-t="watch"]'); w = await win();
        ok(w.tabs.join(' | ') === '📖 Read first | 🎬 Watch first*' && !w.read && w.watch && w.link && w.make && w.x === 1 && w.saved === 'watch', 'tap 🎬 → only the Watch first block shows (link box · ✨ From Read first), with its own ✕');
        await page.click('#qws-make'); await page.waitForSelector('#pra-watch .qws-l'); w = await win(); c = await chip();
        ok(w.lines === 4 && w.tabs[1] === '🎬 Watch first · 4*' && w.wColor === MAGENTA && !w.wide, '✨ writes the story in the tab; the tab says 🎬 Watch first · 4 in magenta');
        ok(c.text === '📖 2/2🎬 4' && c.on && c.wColor === MAGENTA && /story of 4 lines/.test(c.tip), 'the chip follows at once: 🎬 4 in magenta');
        await shot('tab-watch-story');
        await page.keyboard.press('Escape'); c = await chip();
        ok(await win() === null && c.home === 'qe-watch-home' && c.text === '📖 2/2🎬 4', 'Esc closes; the block goes back to its parking place; the chip keeps the state');
        ok(await page.evaluate(() => { const f = getQuizFormData().watchFirst; return !!f && f.story.lines.length === 4; }), 'the story is still saved with the quiz while the window is closed');
        await shot('chip-green-magenta');
        await page.click('#qe-rf-chip'); w = await win();
        ok(w.tabs[1] === '🎬 Watch first · 4*' && w.watch && w.lines === 4, 'the window reopens on the tab used last, with the story');
        await page.fill('#quiz-watch-first', 'https://example.org/film.mp4'); w = await win(); c = await chip();
        ok(w.tabs[1] === '🎬 Watch first · ▶*' && c.w === '🎬 ▶' && /film link/.test(c.tip), 'a film link → 🎬 ▶ on the tab and the chip');
        await page.click('#praOverlay .pra-tab[data-t="read"]'); w = await win();
        ok(w.read && !w.watch && w.saved === 'read', 'back to 📖 Read first');
        await page.locator('#praOverlay .pra-hd .pra-x').click(); c = await chip();
        ok(await win() === null && c.home === 'qe-watch-home' && await page.evaluate(() => getQuizFormData().watchFirst.url === 'https://example.org/film.mp4'), '✕ closes; the link is saved with the quiz');
        await page.evaluate(() => { document.getElementById('quiz-watch-first').value = ''; QuizWatchStory.set(null); }); c = await chip();
        ok(c.w === '🎬 ＋' && !c.on, 'story and link removed → grey ＋ again');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nbefore-quiz-chip-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
