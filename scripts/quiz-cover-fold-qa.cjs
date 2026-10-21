// V101.181 — Mission ▸ Quiz cards: a not-started quiz gets a corner fold on its cover (coral; gold + ★ when nobody has
// done it yet) and a ▶ that pulses twice on first view; at most two nobody-yet quizzes (nearest deadline) also get the
// gold frame. Real index.html QuizCover.decorate() + populateQuizAvatarStacks() at phone width against a fake db.
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
            // fresh1: three people did it; every other quiz: nobody yet
            const ATT = { fresh1: ['Ua', 'Ub', 'Uc'] };
            const query = (name, filters = []) => ({
                where: (f, op, v) => query(name, filters.concat([[f, op, v]])),
                limit: () => query(name, filters), orderBy: () => query(name, filters),
                get: async () => {
                    const qid = (filters.find(f => f[0] === 'quizId') || [])[2];
                    const docs = name === 'quiz_attempts' ? (ATT[qid] || []).map((u, i) => ({ id: qid + i, data: () => ({ quizId: qid, userId: u, status: 'approved' }) })) : [];
                    return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
                },
                onSnapshot: () => () => {},
                doc: (id) => ({ get: async () => ({ exists: false, id, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: (n) => query(n) }),
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
        await page.goto(INDEX);
        await page.waitForTimeout(500);
        const r = await page.evaluate(async () => {
            userId = 'Ume';
            const host = document.createElement('div');
            host.id = 'qa-host';
            host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:16px;overflow:auto';
            // Same shape as the real card: the not-started branch renders the 👥 stack; an attempted quiz (pure late request) does not.
            const H = 3600e3, now = Date.now();
            const card = (id, fresh, dueH) => `<div class="assignment-card lang-no-toggle" data-qa="${id}">
                <div class="assign-header"><div class="assign-icon" style="width:42px;height:42px">🧠</div>
                    <div class="assign-info"><h4>${id}</h4><div class="quiz-mission-meta"><span>10 items · 1 pts</span>${fresh ? `<span class="quiz-avatar-stack" data-quiz-id="${id}"></span>` : ''}</div></div></div>
                <div class="assign-body"></div>
                <div class="assign-footer"><button class="btn-primary btn-quiz-cta" onclick="confirmRunQuiz('${id}')">🚀 Start Quiz${dueH ? ` <span class="quiz-cta-countdown" data-dead="${now + dueH * H}"></span>` : ''}</button></div></div>`;
            host.innerHTML = card('fresh1', true, 30) + card('fresh0a', true, 50) + card('fresh0b', true, 5) + card('fresh0c', true, 20) + card('requested', false);
            document.body.appendChild(host);
            host.querySelectorAll('.assignment-card').forEach(c => QuizCover.decorate(c, { title: c.dataset.qa }, false));
            const before = getComputedStyle(host.querySelector('.quiz-cover-fold')).opacity;
            await populateQuizAvatarStacks();
            await new Promise(res => setTimeout(res, 400));
            const out = {};
            host.querySelectorAll('.assignment-card').forEach(c => {
                const cover = c.querySelector('.quiz-cover-thumb'), fold = c.querySelector('.quiz-cover-fold'), play = c.querySelector('.quiz-cover-play');
                out[c.dataset.qa] = {
                    fold: !!fold, foldColor: fold ? getComputedStyle(fold).backgroundColor : '', foldW: fold ? fold.getBoundingClientRect().width : 0,
                    foldOpacity: fold ? getComputedStyle(fold).opacity : '', star: fold ? getComputedStyle(fold, '::after').content : '',
                    pulse: getComputedStyle(play).animationName, pulseCount: getComputedStyle(play).animationIterationCount,
                    glow: getComputedStyle(cover).boxShadow,
                    first: c.classList.contains('quiz-first'), challenge: c.classList.contains('quiz-first-challenge'),
                    title: cover.title, th: cover.dataset.thTitle || '', kr: cover.dataset.krTitle || '', aria: cover.getAttribute('aria-label') || '',
                };
            });
            return { before, out };
        });
        await page.screenshot({ path: process.env.QA_SHOT || path.join(require('os').tmpdir(), 'quiz-cover-fold-qa.png') });
        const o = r.out;
        assert.equal(r.before, '0', 'fold hidden until the 👥 count is known (never seen changing colour)');
        for (const id of ['fresh1', 'fresh0a', 'fresh0b', 'fresh0c']) {
            assert.ok(o[id].fold && o[id].foldOpacity === '1', id + ': fold shown once settled');
            assert.equal(o[id].foldW, 28, id + ': 28px fold');
            assert.equal(o[id].pulse, 'quizPlayPulse', id + ': ▶ pulses on first view');
            assert.equal(o[id].pulseCount, '2', id + ': pulse runs twice, never loops');
        }
        assert.equal(o.requested.fold, false, 'an attempted quiz gets no fold');
        assert.equal(o.requested.pulse, 'none', 'attempted ▶ stays still');
        assert.equal(o.fresh1.foldColor, 'rgb(249, 115, 22)', 'someone did it → coral fold');
        assert.equal(o.fresh1.star, 'none', 'no ★ on the coral fold');
        assert.equal(o.fresh1.glow, 'none');
        assert.equal(o.fresh1.title, 'New · not started', 'EN-first tooltip');
        assert.ok(o.fresh1.th && o.fresh1.kr, 'TH + KR tooltips');
        assert.ok(o.fresh1.aria.endsWith('— New · not started'), 'VoiceOver hears the state: ' + o.fresh1.aria);
        for (const id of ['fresh0a', 'fresh0b', 'fresh0c']) {
            assert.ok(o[id].first, id + ': nobody did it');
            assert.equal(o[id].foldColor, 'rgb(245, 158, 11)', id + ': gold fold');
            assert.equal(o[id].star, '"★"', id + ': ★ on the gold fold');
            assert.ok(o[id].aria.endsWith('— Be the first to clear this'), id + ': ' + o[id].aria);
        }
        assert.ok(o.fresh0b.challenge && o.fresh0c.challenge, 'the two nearest deadlines get the gold frame');
        assert.ok(o.fresh0b.glow.includes('rgb(217, 119, 6) 0px 0px 0px 2px'), '2px solid gold ring: ' + o.fresh0b.glow);
        assert.ok(!o.fresh0a.challenge && o.fresh0a.glow === 'none', 'third nobody-yet quiz: gold fold + ★ only, no frame');
        assert.ok(!o.fresh1.challenge && !o.requested.challenge);

        // Reduce Motion → no pulse
        const rm = await browser.newContext({ viewport: { width: 363, height: 700 }, reducedMotion: 'reduce' });
        const p2 = await rm.newPage();
        await p2.route('**/*', x => x.request().url().startsWith('file:') ? x.continue() : x.abort());
        p2.on('pageerror', () => {});
        await p2.goto(INDEX);
        await p2.waitForTimeout(300);
        const still = await p2.evaluate(() => {
            const el = document.createElement('span'); el.className = 'quiz-cover-pulse'; document.body.appendChild(el);
            return getComputedStyle(el).animationName;
        });
        assert.equal(still, 'none', 'Reduce Motion → ▶ does not pulse');
        await rm.close();
        console.log('PASS: Quiz cover fold — 28px fold hidden until 👥 settles, coral when someone did it, gold + ★ when nobody did, gold frame on the 2 nearest deadlines only, ▶ pulses twice on first view (none with Reduce Motion), state in aria-label');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
