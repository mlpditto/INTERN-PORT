// V102.687 🎬 Watch first ▸ 🪄 fix lines with AI (owner pick B + C, mockups/watch-first-line-fix.html): 🪄 on a line opens a panel right under it
// (model rail · 🔢 ✂ 💬 · own words · 🪄 Go); tapping Q tags picks several lines and the panel sits on top as a bar. One call for the picked lines,
// with only their own Read first notes; each answer waits under its line until tapped (then that line's voices go); ↩️ keeps the old line.
// The REAL public/admin.html in Chromium (network stubbed), callUniversalAI stubbed. SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
{
    const js = fs.readFileSync('public/quiz-watch-story.js', 'utf8');
    ok((js.match(/\.collection\(/g) || []).length === 1, 'still one Firestore write in the composer (the watchFirst auto-save) — 🪄 adds none');
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
            ['25(OH)D is the main store marker', 'Deficiency is under 20 ng/mL', 'Rickets in children'].forEach((p, i) => addQuestionUI({ q: 'Question ' + (i + 1), type: 'choice', options: ['a', 'b'], correct: [0], primer: p }));
            document.getElementById('quiz-watch-first').value = ''; QuizWatchStory.set(null);
            localStorage.setItem('praTab', 'watch'); _qPrimerReviewAll();
            window.__ai = []; window.__reply = ''; window.callUniversalAI = (model, prompt, isJson, a, b, opts) => { window.__ai.push({ model, prompt, feature: opts && opts.feature }); return Promise.resolve({ text: window.__reply }); };
        });
        await page.evaluate(() => { window.__U = n => 'https://firebasestorage.googleapis.com/v0/b/x/o/' + n + '.mp3?alt=media'; window.__load = () => { QuizWatchStory.set({ lang: 'en', lines: [
            { w: 'q', t: 'Where do I start?', q: [1], a: __U('a0') },
            { w: 'rx', t: '25(OH)D is the main store marker', q: [1], a: __U('a1'), b: __U('b1') },
            { w: 'rx', t: 'Deficiency is under 27 ng/mL', q: [2], a: __U('a2'), b: __U('b2') },
            { w: 'key', t: 'Rickets in children', q: [3], a: __U('a3'), b: __U('b3') }] }); window.__auto = 0; window.__ai = []; }; });
        const view = () => page.evaluate(() => { const b = document.getElementById('qws-box'), f = document.getElementById('qws-fix'), rows = [...b.querySelectorAll('.qws-l')], vis = e => !!e && e.getClientRects().length > 0;
            return { fx: rows.map(r => { const x = r.querySelector('.qws-fx'); return x ? (x.classList.contains('dim') ? 'dim' : 'on') : '-'; }), tags: rows.map(r => r.querySelector('em').getAttribute('role') + ':' + r.querySelector('em').getAttribute('aria-pressed')),
                panel: vis(f), after: f && f.previousElementSibling && f.previousElementSibling.classList.contains('qws-l') ? rows.indexOf(f.previousElementSibling) : -1, top: !!f && f.classList.contains('top') && f.nextElementSibling === rows[0],
                label: f ? f.querySelector('.qws-fn').textContent : '', asks: f ? [...f.querySelectorAll('.qws-qk')].map(k => k.textContent + (k.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' | ') : '',
                rail: f ? f.querySelectorAll('.text-ai-chips button').length : 0, sug: [...b.querySelectorAll('.qws-sug')].map(s => (rows.indexOf(s.previousElementSibling) + 1) + ':' + s.querySelector('.qws-sn').textContent + (s.querySelector('.qws-warn') ? ' ' + s.querySelector('.qws-warn').textContent : '')),
                lines: QuizWatchStory.get().lines.map(x => x.t), voiced: QuizWatchStory.get().lines.map(x => (x.a ? 'a' : '') + (x.b ? 'b' : '')).join(','), saved: JSON.stringify(QuizWatchStory.get()), err: (b.querySelector('.qws-err') || {}).textContent || '', ai: window.__ai, auto: window.__auto }; });
        const shot = async n => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); const r = await page.evaluate(() => { const a = document.getElementById('qws-box').getBoundingClientRect(); return { x: a.left - 8, y: a.top - 8, w: a.width + 16, h: a.height + 16 }; }); await page.screenshot({ path: path.join(SHOT, n + '.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h } }); };

        console.log('every line');
        await page.evaluate(() => __load()); let v = await view();
        ok(v.fx.join() === 'dim,dim,on,dim', 'every line has 🪄 — bright on the ⚠️ line (27 is not in Read first), faint on the rest');
        ok(v.tags.every(t => t === 'button:false') && !v.panel, 'every Q tag is a button (not pressed); no panel yet');

        console.log('B · 🪄 on one line');
        await page.locator('#qws-box .qws-fx').nth(2).click(); v = await view();
        ok(v.panel && v.after === 2 && v.label === '', 'tap 🪄 → the panel opens right under that line (no "n lines" label)');
        ok(v.asks === '🔢 fix numbers* | ✂ shorter | 💬 plainer', 'the line has ⚠️ → 🔢 fix numbers is picked for you');
        ok(v.rail > 0, 'the house model rail is in the panel: ' + v.rail + ' buttons');
        const chip = await page.evaluate(() => { const c = [...document.querySelectorAll('#qws-fix .text-ai-chips button[data-value]')].find(b => b.dataset.value === 'claude-sonnet-5-5') || document.querySelector('#qws-fix .text-ai-chips button[data-value]'); c.click(); return c.dataset.value; });
        ok(await page.evaluate(c => localStorage.getItem('ai_watch_fix_model') === c && document.getElementById('qws-fix-model').value === c, chip), 'a model chip → kept in ai_watch_fix_model: ' + chip);
        await shot('fix-panel');
        await page.evaluate(() => { window.__reply = 'Sure!\nL3: Deficiency is under 20 ng/mL\n'; });
        await page.click('#qws-fix .qws-go'); await page.waitForSelector('#qws-box .qws-sug'); v = await view();
        const c1 = v.ai[0];
        ok(v.ai.length === 1 && c1.feature === 'quiz_watch_fix' && c1.model === chip, 'one call, labelled quiz_watch_fix, with the picked model');
        ok(/^L3 \(RX\): Deficiency is under 27 ng\/mL\nNOTE 2: Deficiency is under 20 ng\/mL$/m.test(c1.prompt) && !/NOTE 1|NOTE 3|L1 |L2 |L4 /.test(c1.prompt), 'only that line and ITS note go to the model (not the other lines or notes)');
        ok(/Fix every number its note does not say/.test(c1.prompt) && /never add a number or a fact its note does not say/.test(c1.prompt) && /Do not give away which choice is correct/.test(c1.prompt) && /as L<number>: the new text/.test(c1.prompt), 'the prompt carries the ask, the number rule, no answers, and the reply shape');
        ok(v.sug.join() === '3:🪄 Deficiency is under 20 ng/mL' && !v.panel, 'the answer waits under line 3; the panel closes');
        ok(v.lines[2] === 'Deficiency is under 27 ng/mL' && v.voiced === 'a,ab,ab,ab' && v.auto === 0 && !/_s|_p/.test(v.saved), 'nothing changed yet: same text, voices kept, no save; the suggestion is not in the saved story');
        await shot('fix-suggestion');
        await page.click('#qws-box .qws-sn'); v = await view();
        ok(v.lines[2] === 'Deficiency is under 20 ng/mL' && v.voiced === 'a,ab,,ab' && v.sug.length === 0 && v.auto > 0 && v.fx[2] === 'dim', 'tap it → the line takes it, only ITS voices go, the story saves; ⚠️ gone');

        console.log('↩️ and own words');
        await page.locator('#qws-box .qws-fx').nth(3).click(); v = await view();
        ok(v.after === 3 && v.asks === '🔢 fix numbers | ✂ shorter | 💬 plainer', 'no ⚠️ on that line → no ask picked for you');
        await page.click('#qws-fix .qws-qk[data-ask="short"]'); await page.fill('#qws-fix .qws-fh', 'say "vitamin D"');
        await page.evaluate(() => { window.__reply = 'L4: Low vitamin D causes rickets in children'; window.__ai = []; });
        await page.press('#qws-fix .qws-fh', 'Enter'); await page.waitForSelector('#qws-box .qws-sug'); v = await view();
        ok(/Make each line shorter/.test(v.ai[0].prompt) && /The editor asks: "say vitamin D"/.test(v.ai[0].prompt) && !/Fix every number/.test(v.ai[0].prompt), '✂ + own words go in the prompt (quotes dropped); Enter = Go');
        await page.click('#qws-box .qws-sug .qws-x'); v = await view();
        ok(v.sug.length === 0 && v.lines[3] === 'Rickets in children' && v.voiced === 'a,ab,,ab', '↩️ keeps the old line and its voices');
        await page.locator('#qws-box .qws-fx').nth(1).click(); await page.locator('#qws-box .qws-fx').nth(1).click(); v = await view();
        ok(!v.panel, '🪄 again on the same line closes the panel');

        console.log('C · pick several lines');
        await page.locator('#qws-box .qws-l em').nth(0).click(); await page.locator('#qws-box .qws-l em').nth(1).click(); v = await view();
        ok(v.panel && v.top && v.label === '🪄 2 lines' && v.tags.slice(0, 2).join() === 'button:true,button:true', 'tap two Q tags → both pressed; the panel sits on top as a bar: 🪄 2 lines');
        ok(v.rail > 0 && await page.evaluate(c => document.getElementById('qws-fix-model').value === c, chip), 'the same rail, still on the picked model (moved, not rebuilt)');
        await shot('fix-bar');
        await page.evaluate(() => { window.__reply = '**L1:** Hi! Where do I start with vitamin D?\nL2: 25(OH)D is the main store marker 99'; window.__ai = []; });
        await page.click('#qws-fix .qws-go'); await page.waitForFunction(() => document.querySelectorAll('#qws-box .qws-sug').length === 2); v = await view();
        ok(v.ai.length === 1 && /^L1 \(Q\): /m.test(v.ai[0].prompt) && /^L2 \(RX\): /m.test(v.ai[0].prompt) && !/^L3 /m.test(v.ai[0].prompt), 'ONE call for both picked lines');
        ok(v.sug.join(' ; ') === '1:🪄 Hi! Where do I start with vitamin D? ; 2:🪄 25(OH)D is the main store marker 99 ⚠️ 99', 'each answer waits under its own line; a new number no note says is flagged on the answer');
        await page.locator('#qws-box .qws-sn').nth(0).click(); v = await view();
        ok(v.lines[0] === 'Hi! Where do I start with vitamin D?' && v.sug.length === 1 && v.voiced === ',ab,,ab', 'use one, the other still waits');
        await page.locator('#qws-box .qws-l em').nth(3).click(); await page.locator('#qws-box .qws-l em').nth(3).click(); v = await view();
        ok(!v.panel, 'unpick the last line → the bar goes');

        console.log('failure');
        await page.locator('#qws-box .qws-fx').nth(2).click(); await page.evaluate(() => { window.__reply = 'I cannot help.'; });
        await page.click('#qws-fix .qws-go'); await page.waitForFunction(() => /no new line came back/.test(document.getElementById('qws-box').textContent)); v = await view();
        ok(v.panel && v.lines[2] === 'Deficiency is under 20 ng/mL', 'a reply with no L-lines says so; the panel stays, nothing changes');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nwatch-line-fix-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
