// V102.321: Quiz Editor toolbar, lean A (owner's mockup pick). The REAL admin.html in Chromium (network stubbed):
// rows 3+4 became one strip — Answer type | this question (📑 🐑 ☑️ 🗑️) | whole quiz on the right (Per Q|Total chips, − 60 s +, ✓, 📄, ✂️);
// 📋P 🖼️ 📥 sit next to + Add; + Add is the only amber; icon-only buttons carry EN · TH · KO tooltips;
// on a phone the 1–10 pager is one sideways-scrolling line and the current number is kept in view.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('id="quiz-editor-toolbar" class="lang-no-toggle qe-lean-row"'), 'the tool strip is the lean row');
assert.ok(!fs.readFileSync('public/quiz-compact-toolbar.js', 'utf8').includes("'Answer type'; typeRow"), 'no separate Answer type row');
const PUB = path.resolve('public').replace(/\\/g, '/');

async function open(browser, width, n) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
    await page.route('**/*', r => {
        const u = r.request().url();
        if (u.startsWith('file:')) return r.continue();
        if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
        return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
    });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto('file:///' + PUB + '/admin.html');
    await page.waitForFunction(() => typeof addQuestionUI === 'function' && typeof window.setQuizTimerMode === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
    await page.waitForTimeout(400);
    await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });   // the guide popup would take the clicks
    await page.evaluate(n => {
        const m = document.getElementById('quizManageModal');
        m.style.setProperty('display', 'block', 'important');
        for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
        window.showToast = () => {}; window.triggerAutoSave = () => {};
        for (let i = 0; i < n; i++) addQuestionUI({ q: 'Question ' + (i + 1), type: 'choice', options: ['A', 'B', 'C', 'D'], correct: [0], timer: 60 });
        quizQPageIndex = 0; updateQuizPagination();
    }, n);
    return { page, errs };
}
const cy = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        // ---- desktop
        let { page, errs } = await open(browser, 1440, 10);
        const layout = await page.evaluate(() => {
            const bar = document.getElementById('quiz-editor-toolbar');
            const add = document.querySelector('.quiz-compact-navigation button[onclick="addQuestionUI()"]');
            const after = []; for (let b = add.nextElementSibling; b; b = b.nextElementSibling) after.push(b.getAttribute('onclick'));
            const cy = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
            const strip = [...bar.querySelectorAll('.qe-ib, #toolbar-q-type-toggle, .qe-timer-mode, .qe-step')].filter(e => e.offsetParent).map(cy);
            return {
                first: bar.firstElementChild.id,
                answerRow: !!document.querySelector('.quiz-compact-answer-type'),
                after,
                spread: Math.max(...strip) - Math.min(...strip),
                thisQ: [...document.querySelectorAll('#qe-this-q button')].filter(b => b.offsetParent).map(b => b.getAttribute('onclick')),
                whole: [...document.querySelectorAll('#qe-whole-quiz button.qe-ib')].map(b => b.getAttribute('onclick')),
                selectShown: getComputedStyle(document.getElementById('quiz-timer-mode')).display,
            };
        });
        assert.equal(layout.first, 'toolbar-q-type-toggle', 'Answer type opens the tool strip');
        assert.equal(layout.answerRow, false, 'no separate Answer type row');
        assert.deepEqual(layout.after, ['openBulkPasteModal()', 'openImageQuizModal()', 'openImportQuizModal()', 'openBulkTagModal()'], 'the add-question tools sit right after + Add, then Tags');
        assert.ok(layout.spread <= 8, 'the tool strip is ONE line on desktop: ' + layout.spread);
        assert.deepEqual(layout.thisQ, ['toolbarCopyQ(this)', 'toolbarCloneQ(this)', 'toggleQuizSelectMode()', 'toolbarDeleteQ()'], 'this-question group');
        assert.deepEqual(layout.whole, ['setAllQuestionTimers()', 'openExportQuizPdfModal()', 'openBulkExportModal()'], 'whole-quiz group');
        assert.equal(layout.selectShown, 'none', 'the timer select is a hidden value holder');

        // only one amber button in the editor toolbar
        const amber = await page.evaluate(() => [...document.querySelectorAll('#quizManageModal .quiz-compact-toolbar button')].filter(b => b.offsetParent)
            .filter(b => { const cs = getComputedStyle(b); return /245, 158, 11|217, 119, 6/.test(cs.backgroundImage + cs.backgroundColor); }).map(b => b.getAttribute('onclick')));
        assert.deepEqual(amber, ['addQuestionUI()'], 'only + Add is amber: ' + JSON.stringify(amber));

        // icon-only buttons: EN title, TH, KO, aria-label
        const tips = await page.$$eval('#quizManageModal .qe-ib', bs => bs.map(b => ({ o: b.getAttribute('onclick'), t: !!b.title, th: !!b.dataset.thTitle, kr: !!b.dataset.krTitle, a: !!b.getAttribute('aria-label') })));
        assert.equal(tips.length, 10, '10 icon-only tiles (3 add · 4 this question · ✓ 📄 ✂️)');
        for (const t of tips) assert.ok(t.t && t.th && t.kr && t.a, 'tooltip EN · TH · KO + aria-label: ' + t.o);
        const tile = await page.$eval('#qe-this-q .qe-ib', b => { const cs = getComputedStyle(b); return [cs.width, cs.height, cs.backgroundColor]; });
        assert.deepEqual(tile, ['34px', '34px', 'rgb(24, 35, 53)'], 'quiet slate tile');

        // timer chips ⇄ hidden select
        await page.click('.qe-timer-mode [data-value="total_time"]');
        let t = await page.evaluate(() => ({ v: document.getElementById('quiz-timer-mode').value, total: getComputedStyle(document.getElementById('timer-total-area')).display, perq: getComputedStyle(document.getElementById('timer-perq-area')).display, act: document.querySelector('.qe-timer-mode .active').dataset.value }));
        assert.deepEqual(t, { v: 'total_time', total: 'flex', perq: 'none', act: 'total_time' }, 'Total chip');
        await page.evaluate(() => { document.getElementById('quiz-timer-mode').value = 'per_question'; toggleTimerModeUI(); });
        assert.equal(await page.$eval('.qe-timer-mode .active', e => e.dataset.value), 'per_question', 'a loaded quiz syncs the chips');
        await page.focus('.qe-timer-mode [data-value="total_time"]'); await page.keyboard.press('Enter');
        assert.equal(await page.inputValue('#quiz-timer-mode'), 'total_time', 'chips work from the keyboard');
        await page.click('.qe-timer-mode [data-value="per_question"]');

        // stepper + ✓
        await page.click('#timer-perq-area .qe-step button:last-child');
        await page.click('#timer-perq-area .qe-step button:last-child');
        await page.click('#timer-perq-area .qe-step button:first-child');
        assert.equal(await page.inputValue('#quiz-set-all-timer'), '70', '− / + step by 10 s');
        await page.click('#qe-whole-quiz button[onclick="setAllQuestionTimers()"]');
        assert.deepEqual([...new Set(await page.$$eval('.q-timer', es => es.map(e => e.value)))], ['70'], '✓ applies to every question');

        // select mode still paints its inline state over the slate tile
        await page.click('#quiz-select-toggle');
        // the tile animates its background for .15s — wait for the end colour
        await page.waitForFunction(() => getComputedStyle(document.getElementById('quiz-select-toggle')).backgroundColor === 'rgb(67, 97, 238)', null, { timeout: 2000 }).catch(() => {});
        assert.equal(await page.$eval('#quiz-select-toggle', b => getComputedStyle(b).backgroundColor), 'rgb(67, 97, 238)', 'select mode on = blue');
        await page.click('#quiz-select-toggle');

        // answer type chip still sets the current question
        await page.click('#toolbar-q-type-toggle [data-value="ordering"]');
        assert.equal(await page.$eval('.quiz-q-item .q-type', e => e.value), 'ordering', 'answer type → current question');

        // V102.323 (toolbar D): emoji on every chip, the word only on the chosen one; quiet AI tools icon-only; + and 🏷 without words
        const words = sel => page.$$eval(sel, es => es.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(await words('#quiz-type-toggle .glass-toggle-item'), ['🎯 MCQ', '📖', '🩺'], 'quiz type: word on the chosen chip only');
        assert.deepEqual(await words('#toolbar-q-type-toggle .glass-toggle-item'), ['✅', '📝', '🔢 Order', '⚡'], 'answer type: word on the chosen chip only');
        assert.deepEqual(await words('.qe-timer-mode .glass-toggle-item'), ['⏱ Per Q', '⏲️'], 'timer: word on the chosen chip only');
        assert.deepEqual(await page.$$eval('#toolbar-q-type-toggle .glass-toggle-item', es => es.map(e => e.getAttribute('aria-label'))), ['Multiple choice', 'Short answer', 'Ordering', 'Flashcard'], 'answer type chips keep their names for screen readers');
        // V102.358: the quiet tools show their word again (owner: the row has room) — still slate, name also in aria-label
        const quiet = await page.$$eval('#quiz-editor-review-actions .qe-tool.qe-quiet', bs => bs.map(b => [b.innerText.replace(/\s+/g, ' ').trim(), parseFloat(getComputedStyle(b).width) > 40, b.getAttribute('aria-label')]));
        assert.deepEqual(quiet, [['PDF', true, 'Import from PDF'], ['Generate', true, 'Generate more questions'], ['Curate', true, 'Curate a new set'], ['Translate', true, 'Translate this question']], 'quiet tools icon + word: ' + JSON.stringify(quiet));
        // V102.344: Curate is a funnel icon (✦ read as a twin of 🪄 Generate more)
        assert.equal(await page.$eval('#quiz-editor-review-actions .qe-tool-curate > i', i => i.className), 'fa-solid fa-filter', 'Curate = funnel');
        assert.equal(await page.$eval('#quiz-editor-review-actions .qe-tool-review', b => b.innerText.trim()), 'Review', 'Review keeps its word (the one accent)');
        assert.deepEqual(await page.$$eval('.quiz-compact-navigation button[onclick="addQuestionUI()"], .quiz-compact-navigation button[onclick="openBulkTagModal()"]', bs => bs.map(b => b.innerText.trim())), ['', ''], '+ and 🏷 have no words');
        // V102.323 (H2): one header row — ✍️ · quiz name · 👥 group · ⭐ points · ⚙️ · ×; ⚙️ opens the settings fields
        await page.evaluate(() => { document.getElementById('quiz-editor-settings').open = false; document.getElementById('quiz-title').value = 'Lenacapavir ความหวังใหม่ในการกำจัด HIV'; document.getElementById('quiz-total-points').value = '2'; updateQuizEditorSummary(); });
        const head = await page.evaluate(() => {
            const cy = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
            const parts = ['.qe-head-ic', '#quiz-manage-title', '#qe-head-group', '#qe-head-points', '#qe-head-settings', '.qe-head-x'].map(s => document.querySelector('#quizManageModal ' + s));
            const d = document.getElementById('quiz-editor-settings');
            return { name: parts[1].textContent, tip: parts[1].title, group: parts[2].textContent, pts: parts[3].textContent, ys: parts.map(cy),
                     closed: getComputedStyle(d).display, summary: getComputedStyle(d.querySelector('summary')).display, oldTitle: /Quiz Editor/.test(document.querySelector('#quizManageModal .qe-head').innerText) };
        });
        assert.equal(head.name, 'Lenacapavir ความหวังใหม่ในการกำจัด HIV', 'the quiz name is the title');
        assert.equal(head.tip, head.name, 'full name in the tooltip');
        assert.ok(/^👥 \S/.test(head.group) && head.pts === '⭐ 2', 'group + points chips: ' + head.group + ' / ' + head.pts);
        assert.ok(Math.max(...head.ys) - Math.min(...head.ys) <= 6, 'header is ONE row: ' + head.ys);
        assert.equal(head.oldTitle, false, 'no "Quiz Editor" title row');
        assert.deepEqual([head.closed, head.summary], ['none', 'none'], 'settings fold hidden while closed; its summary bar is gone');
        if (process.env.QA_SHOT) await page.locator('#quizManageModal .modal-content').screenshot({ path: process.env.QA_SHOT + '/qe-desktop.png', clip: undefined });
        await page.click('#qe-head-settings');
        await page.waitForFunction(() => document.getElementById('qe-head-settings').getAttribute('aria-expanded') === 'true');
        assert.equal(await page.$eval('#quiz-editor-settings', d => d.open && getComputedStyle(d).display !== 'none'), true, '⚙️ opens the settings fields');
        await page.click('#qe-head-settings');
        await page.waitForFunction(() => document.getElementById('qe-head-settings').getAttribute('aria-expanded') === 'false');
        assert.equal(await page.$eval('#quiz-editor-settings', d => d.open), false, '⚙️ again closes them');
        assert.deepEqual(errs, [], 'no page errors');
        await page.close();

        // ---- phone width
        ({ page, errs } = await open(browser, 560, 20));
        const phone = await page.evaluate(() => {
            const nav = document.getElementById('quiz-q-nav');
            const row = nav.parentElement;
            const prev = row.querySelector('button[onclick="moveQuizQ(-1)"]'), next = row.querySelector('button[onclick="moveQuizQ(1)"]');
            const cy = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
            quizQPageIndex = 17; updateQuizPagination();
            const nr = nav.getBoundingClientRect(), cr = nav.querySelector('button.active').getBoundingClientRect();
            return { line: [cy(prev), cy(nav), cy(next)], scrolls: nav.scrollWidth > nav.clientWidth, inView: cr.left >= nr.left - 1 && cr.right <= nr.right + 1 };
        });
        assert.ok(Math.max(...phone.line) - Math.min(...phone.line) <= 6, '‹ pager › on one line: ' + phone.line);
        assert.ok(phone.scrolls, 'the pager scrolls sideways');
        assert.ok(phone.inView, 'Q18 is scrolled into view');
        const bar = await page.$eval('#quiz-editor-toolbar', e => e.scrollWidth <= e.clientWidth + 1);
        assert.ok(bar, 'the tool strip wraps instead of overflowing');
        const phoneHead = await page.evaluate(() => {
            const cy = el => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
            const h = document.querySelector('#quizManageModal .qe-head');
            return { ys: ['.qe-head-ic', '#quiz-manage-title', '#qe-head-settings', '.qe-head-x'].map(s => cy(h.querySelector(s))), fits: h.scrollWidth <= h.clientWidth + 1 };
        });
        assert.ok(Math.max(...phoneHead.ys) - Math.min(...phoneHead.ys) <= 6 && phoneHead.fits, 'header stays one row on a phone: ' + JSON.stringify(phoneHead));
        if (process.env.QA_SHOT) await page.locator('#quizManageModal .modal-content').screenshot({ path: process.env.QA_SHOT + '/qe-phone.png' });
        assert.deepEqual(errs, [], 'no page errors (phone)');
        console.log('quiz-editor-toolbar-lean-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
