// V101.218: tap a quiz card = a SUMMARY sheet first (counts, time, points, files, tags, how many did it, your result) — never the
// questions. The cover / ▶ still starts at once. Real index.html functions (attachQuizPreview / qzPreview) at phone width.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 363, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await page.addInitScript(() => {
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            const q = () => ({ where: () => q(), limit: () => q(), orderBy: () => q(), get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {} }) });
            const db = { collection: () => q(), batch: () => ({ set() {}, update() {}, commit: async () => {} }), enablePersistence: async () => {}, settings() {} };
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => db, { FieldValue: any, Timestamp: any }) : k === 'then' ? undefined : any, apply: () => any });
        });
        page.on('pageerror', () => {});
        await page.goto(INDEX); await page.waitForTimeout(500);
        const r = await page.evaluate(() => {
            window.__starts = [];
            window.confirmRunQuiz = id => { window.__starts.push(id); };
            const Q = (id, extra) => Object.assign({ id, title: 'Patient Interview-' + id, description: 'การจ่ายยาให้ผู้ป่วย', totalPoints: 5, tagList: ['dispensing', 'ai_variant'],
                questions: [{ q: 'SECRET-STEM-ONE', timer: 60 }, { q: 'SECRET-STEM-TWO', timer: 60 }, { q: 'SECRET-STEM-THREE', timer: 60 }],
                materials: [{ url: 'https://example.com/a.pdf', name: 'a.pdf' }], deadline: { toDate: () => new Date(2026, 10, 5) } }, extra || {});
            quizzesCache = [Q('1'), Q('2', { timerMode: 'total_time', totalTimer: 300 }), Q('3')];
            quizAttemptsCache = { 3: { status: 'approved', correctCount: 4, totalQuestions: 5 } };
            const host = document.createElement('div'); host.id = 'qa-host'; host.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#f8fafc;padding:12px;overflow:auto'; document.body.appendChild(host);
            const card = (id, startable, withCount) => `<div class="assignment-card lang-no-toggle" data-qa="${id}"><div class="assign-header"><div class="assign-icon" style="width:42px;height:42px">💬</div><div class="assign-info"><h4>Patient Interview-${id}</h4><div class="quiz-mission-meta">${withCount ? '<span class="quiz-avatar-stack" data-quiz-id="' + id + '"><span class="quiz-done-count">👥 7</span></span>' : ''}</div></div></div><div class="assign-body"><p class="body-text">body</p></div><div class="assign-footer">${startable ? `<button class="btn-primary btn-quiz-cta" onclick="confirmRunQuiz('${id}')">🚀 Start Quiz</button>` : '<span>Done</span>'}</div></div>`;
            host.innerHTML = card('1', true, true) + card('2', true, false) + card('3', false, false);
            host.querySelectorAll('.assignment-card').forEach(c => { const id = c.dataset.qa; if (c.querySelector('.btn-quiz-cta')) QuizCover.decorate(c, { title: 'Q' + id }, false); attachQuizPreview(c, quizzesCache.find(x => x.id === id)); });
            const sheet = () => document.getElementById('quizPreviewSheet');
            const txt = () => sheet().innerText.replace(/\s+/g, ' ');
            const out = {};
            // 1 · tap the body of card 1
            host.querySelector('[data-qa="1"] .body-text').click();
            out.open1 = sheet().classList.contains('open'); out.t1 = txt(); out.html1 = sheet().innerHTML; out.startBtn1 = !!sheet().querySelector('.qzp-start');
            // 2 · ▶ Start inside the sheet = the card's own button, once; the sheet closes
            sheet().querySelector('.qzp-start').click(); out.afterStart = { open: sheet().classList.contains('open'), starts: window.__starts.slice() };
            // 3 · the cover starts at once and does NOT open the sheet
            host.querySelector('[data-qa="2"] .quiz-cover-thumb').click(); out.afterCover = { open: sheet().classList.contains('open'), starts: window.__starts.slice() };
            // 4 · card 2 (total-time quiz, nobody count absent) ; Esc closes; backdrop closes
            host.querySelector('[data-qa="2"] h4').click(); out.t2 = txt(); out.open2 = sheet().classList.contains('open');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); out.afterEsc = sheet().classList.contains('open');
            host.querySelector('[data-qa="2"] h4').click(); sheet().click(); out.afterBackdrop = sheet().classList.contains('open');
            // 5 · a done card: summary + your result, no Start
            host.querySelector('[data-qa="3"] h4').click(); out.t3 = txt(); out.startBtn3 = !!sheet().querySelector('.qzp-start'); out.mine3 = !!sheet().querySelector('.qzp-chip.mine');
            // 6 · taps on buttons / the footer never open it
            qzPreviewClose(); host.querySelector('[data-qa="3"] .assign-footer span').click(); out.footerTap = sheet().classList.contains('open');
            return out;
        });
        assert.equal(r.open1, true, 'tap on the card body opens the sheet');
        assert.ok(/Patient Interview-1/.test(r.t1) && /“การจ่ายยาให้ผู้ป่วย”/.test(r.t1), 'title + the description quote');
        assert.ok(/3 questions/.test(r.t1) && /⏱ 3 min/.test(r.t1) && /🎯 5 pts/.test(r.t1) && /📎 1 file/.test(r.t1) && /#dispensing/.test(r.t1) && /👥 7/.test(r.t1) && /⏰ 5 Nov/.test(r.t1), 'questions · time · points · files · tag · people · deadline: ' + r.t1);
        assert.ok(!/ai_variant/.test(r.t1), 'internal marker tags are not shown');
        assert.ok(!/SECRET-STEM/.test(r.html1), 'the questions are NEVER in the summary');
        assert.ok(/The questions appear when you start/.test(r.t1), 'the sheet says so');
        assert.equal(r.startBtn1, true);
        assert.deepEqual(r.afterStart, { open: false, starts: ['1'] }, 'Start = the card button, once, sheet closed');
        assert.deepEqual(r.afterCover, { open: false, starts: ['1', '2'] }, 'the cover still starts at once and does not open the sheet');
        assert.ok(r.open2 && /⏱ 5 min/.test(r.t2) && !/👥/.test(r.t2), 'a total-time quiz: its total; no people chip when the card has none');
        assert.equal(r.afterEsc, false, 'Esc closes'); assert.equal(r.afterBackdrop, false, 'a tap outside closes');
        assert.ok(/✓ 80%/.test(r.t3) && r.mine3 && r.startBtn3 === false, 'a done quiz: your result, no Start button');
        assert.equal(r.footerTap, false, 'the footer is not a preview tap');
        console.log('quiz-card-preview-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
