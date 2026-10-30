// V101.179 — Mission ▸ Quiz cards: "👥 n" people who did the quiz (+ your own avatar when you are one of them).
// Real index.html populateQuizAvatarStacks() at phone width against a fake db that applies the live `users` rule
// (an intern may read only their own users doc). Other people's profiles must never be requested.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 363, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await page.addInitScript(() => {
            // q1: three other people (one twice); q2: me + two others; q3: nobody; q4: 100 attempts (query cap)
            const ATT = { q1: ['Ua', 'Ub', 'Uc', 'Ua'], q2: ['Ume', 'Ua', 'Ub'], q3: [], q4: Array.from({ length: 100 }, (_, i) => 'U' + (i % 40)) };
            window.__userReads = [];
            const query = (name, filters = []) => ({
                where: (f, op, v) => query(name, filters.concat([[f, op, v]])),
                limit: () => query(name, filters), orderBy: () => query(name, filters),
                get: async () => {
                    const qid = (filters.find(f => f[0] === 'quizId') || [])[2];
                    const docs = name === 'quiz_attempts' ? (ATT[qid] || []).map((u, i) => ({ id: qid + i, data: () => ({ quizId: qid, userId: u, status: 'approved' }) })) : [];
                    return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
                },
                onSnapshot: () => () => {},
                doc: (id) => ({
                    get: async () => {
                        if (name === 'users') {
                            window.__userReads.push(id);
                            if (id !== 'Ume') { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; }
                        }
                        return { exists: false, id, data: () => null };
                    },
                    onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: (n) => query(n),
                }),
            });
            const fakeDb = { collection: (n) => query(n), batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            window.firebase = new Proxy(function () {}, {
                get: (t, k) => {
                    if (k === 'firestore') { const f = () => fakeDb; f.FieldValue = any; f.Timestamp = any; return f; }
                    return k === 'then' ? undefined : any;
                }, apply: () => any,
            });
        });
        page.on('pageerror', () => {});
        await page.goto(require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href);
        await page.waitForTimeout(500);
        const r = await page.evaluate(async () => {
            userId = 'Ume';
            userProfile = { displayName: 'Me', pictureUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14" fill="#e91e63"/></svg>') };
            const host = document.createElement('div');
            host.id = 'qa-host';
            host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:16px';
            host.innerHTML = ['q1', 'q2', 'q3', 'q4'].map(q => `<div class="quiz-mission-meta" style="display:flex;gap:4px;margin:8px 0;align-items:center"><span>10 items · 1 pts</span><span class="quiz-avatar-stack" data-quiz-id="${q}" style="display:inline-flex;align-items:center"></span></div>`).join('');
            document.body.appendChild(host);
            await populateQuizAvatarStacks();
            const out = {};
            document.querySelectorAll('#qa-host .quiz-avatar-stack').forEach(s => {
                const c = s.querySelector('.quiz-done-count'), img = s.querySelector('img');
                out[s.dataset.quizId] = { count: c ? c.textContent.trim() : '', title: c ? c.title : '', me: !!(img && img.classList.contains('quiz-done-me')), imgs: s.querySelectorAll('img').length, html: s.innerHTML.trim(),
                    h: Math.round(s.getBoundingClientRect().height) };
            });
            return { out, userReads: window.__userReads };
        });
        assert.deepEqual(r.userReads, [], 'no users/{id} reads at all (other people\'s docs are permission-denied): ' + r.userReads);
        assert.equal(r.out.q1.count, '👥 3', 'q1: three distinct people (one did it twice)');
        assert.equal(r.out.q1.imgs, 0, 'q1: no faces of other people on the card (V101.252: the Start popup shows them, from data-faces)');
        assert.equal(r.out.q1.title, '3 people have done this quiz');
        assert.equal(r.out.q2.count, '👥 3', 'q2: me + two others = 3');
        assert.ok(r.out.q2.me && r.out.q2.imgs === 1, 'q2: my own avatar, and only mine');
        assert.equal(r.out.q3.html, '', 'q3: nobody yet → nothing rendered');
        assert.equal(r.out.q4.count, '👥 40+', 'q4: the 100-attempt cap shows n+');
        assert.ok(r.out.q2.h <= 26, 'q2: chip + avatar stay one short row: ' + r.out.q2.h);
        console.log('PASS: Quiz card 👥 count — distinct people, own avatar only when you did it, nothing when nobody did, n+ at the 100 cap, zero users/{id} reads');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
