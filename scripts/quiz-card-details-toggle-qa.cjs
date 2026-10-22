// V101.188 — intern quiz card: (1) the two nobody-yet challenge cards carry a "✦ Be the first" call in the meta row whose shadow
// breathes (never under Reduce Motion); (2) "Details" is no longer a text line — a ▾ button at the bottom of the side column
// (🔗 · ☁️ · ▾, or 🔗 · ▾ with nothing to download) toggles the same <details>, whose <summary> is hidden. Real index.html
// QuizCover.decorate + attachQuizMaterialRibbon + attachQuizDetailsToggle + populateQuizAvatarStacks at phone width, fake db.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

async function open(browser, reduced) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.addInitScript(() => {
        const ATT = { done1: ['Ua', 'Ub'] };
        const query = (name, filters = []) => ({
            where: (f, op, v) => query(name, filters.concat([[f, op, v]])), limit: () => query(name, filters), orderBy: () => query(name, filters),
            get: async () => { const qid = (filters.find(f => f[0] === 'quizId') || [])[2]; const docs = name === 'quiz_attempts' ? (ATT[qid] || []).map((u, i) => ({ id: qid + i, data: () => ({ quizId: qid, userId: u, status: 'approved' }) })) : []; return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) }; },
            onSnapshot: () => () => {}, doc: id => ({ get: async () => ({ exists: false, id, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: n => query(n) }),
        });
        const fakeDb = { collection: n => query(n), batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => fakeDb; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(INDEX);
    await page.waitForTimeout(500);
    const r = await page.evaluate(async () => {
        userId = 'Ume';
        const host = document.createElement('div'); host.id = 'qa-host';
        host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:12px;overflow:auto';
        const H = 3600e3, now = Date.now();
        const share = id => `<button onclick="event.stopPropagation(); qzShareLink('${id}')" title="Share link" style="width:32px;height:32px;padding:0;">🔗</button>`;
        const card = (id, desc, dueH) => `<div class="assignment-card lang-no-toggle" data-qa="${id}">
            <div class="assign-header" style="display:flex;align-items:flex-start;gap:10px;"><div class="assign-icon" style="width:42px;height:42px">🧠</div>
                <div class="assign-info" style="flex:1;min-width:0;"><h4>${id}</h4><div class="quiz-mission-meta" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;"><span>15 items · 1.5 pts</span><span class="quiz-avatar-stack" data-quiz-id="${id}"></span></div></div>${share(id)}</div>
            <div class="assign-body">${desc ? `<details class="quiz-mission-details"><summary>Details</summary><div class="qa-desc">${desc}</div></details>` : ''}</div>
            <div class="assign-footer"><button class="btn-primary btn-quiz-cta" onclick="confirmRunQuiz('${id}')">🚀 Start <span class="quiz-cta-countdown" data-dead="${now + dueH * H}"></span></button></div></div>`;
        const Q = { first1: { id: 'first1', title: 'first1', materials: [{ name: 'a', url: 'https://x.test/a.pdf' }, { name: 'b', url: 'https://x.test/b.pdf' }] }, first2: { id: 'first2', title: 'first2', materials: [] }, first3: { id: 'first3', title: 'first3', materials: [] }, done1: { id: 'done1', title: 'done1', materials: [] } };
        host.innerHTML = card('first1', 'desc one', 65) + card('first2', 'desc two', 134) + card('first3', 'desc three', 4) + card('done1', '', 162);   // first3 is 4 h out → the two challenge cards are first3 + first1
        document.body.appendChild(host);
        host.querySelectorAll('.assignment-card').forEach(c => { const q = Q[c.dataset.qa]; QuizCover.decorate(c, { title: q.title }, false); const rib = quizMaterialActionsHtml(q); if (rib) attachQuizMaterialRibbon(c, rib); attachQuizDetailsToggle(c); });
        await populateQuizAvatarStacks();
        await new Promise(res => setTimeout(res, 450));
        const $ = (id, s) => host.querySelector(`[data-qa="${id}"] ${s}`);
        const out = {};
        out.calls = [...host.querySelectorAll('.quiz-first-call')].map(e => e.closest('.assignment-card').dataset.qa);
        const call = $('first1', '.quiz-first-call'); const cs = call && getComputedStyle(call);
        out.callText = call && call.textContent; out.callAnim = cs && cs.animationName; out.callIter = cs && cs.animationIterationCount; out.callTitleTh = call && call.dataset.thTitle;
        out.periods = ['first1', 'first3'].map(id => id + ':' + getComputedStyle($(id, '.quiz-first-call')).animationDuration);   // 65 h → 2 s, 4 h → 0.7 s
        out.callInMeta = !!$('first1', '.quiz-mission-meta > .quiz-first-call');
        out.sides = ['first1', 'first2', 'done1'].map(id => id + ':' + [...($(id, '.quiz-side') || { children: [] }).children].map(x => x.classList.contains('quiz-details-toggle') ? '▾' : x.classList.contains('quiz-mat-box') ? '☁' : (x.tagName === 'BUTTON' ? '🔗' : x.tagName)).join(' '));
        out.summaryDisplay = getComputedStyle($('first1', '.quiz-mission-details > summary')).display;
        const d = $('first1', '.quiz-mission-details'), t = $('first1', '.quiz-details-toggle');
        out.closedHidden = !$('first1', '.qa-desc').checkVisibility(); out.ariaBefore = t.getAttribute('aria-expanded');   // a closed <details> hides its content via content-visibility — computed display and client rects both stay
        t.click(); out.openAfter = d.open; out.ariaAfter = t.getAttribute('aria-expanded'); out.openShown = $('first1', '.qa-desc').checkVisibility();
        t.click(); out.closedAgain = !d.open && t.getAttribute('aria-expanded') === 'false';
        out.toggleTitleTh = t.dataset.thTitle; out.toggleSize = Math.round(t.getBoundingClientRect().width) + 'x' + Math.round(t.getBoundingClientRect().height);
        return out;
    });
    await ctx.close();
    return { r, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        const { r, errors } = await open(browser, false);
        assert.deepEqual(r.calls, ['first1', 'first3'], 'the call sits on the two nearest-deadline nobody-yet cards only: ' + r.calls);
        assert.equal(r.callText, '✦ Be the first'); assert.equal(r.callAnim, 'quizCallBlink', 'faint ↔ bright blink'); assert.equal(r.callIter, 'infinite');
        assert.deepEqual(r.periods, ['first1:2s', 'first3:0.7s'], 'the blink quickens as the deadline nears: ' + r.periods);
        assert.ok(r.callTitleTh && r.callInMeta, 'TH tooltip + it lives in the meta row');
        assert.deepEqual(r.sides, ['first1:🔗 ☁ ▾', 'first2:🔗 ▾', 'done1:'], 'side column order 🔗 · ☁️ · ▾; a card with nothing to download and no description keeps its bare 🔗 (no column): ' + JSON.stringify(r.sides));
        assert.equal(r.summaryDisplay, 'none', 'the "Details" text line is gone');
        assert.equal(r.closedHidden, true, 'description hidden while closed'); assert.equal(r.ariaBefore, 'false');
        assert.equal(r.openAfter, true); assert.equal(r.ariaAfter, 'true'); assert.equal(r.openShown, true, '▾ opens the description in the body');
        assert.equal(r.closedAgain, true, 'second tap closes it');
        assert.ok(r.toggleTitleTh, 'TH tooltip on ▾'); assert.equal(r.toggleSize, '32x32', 'same tile as 🔗 / ☁️: ' + r.toggleSize);
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        const still = await open(browser, true);
        assert.equal(still.r.callAnim, 'none', 'Reduce Motion → the call does not animate');
        console.log('PASS: quiz card — ✦ Be the first (breathing shadow, 2 cards, meta row, TH tooltip, still under Reduce Motion); Details = ▾ under ☁️ / 🔗 (summary hidden, toggles the body, aria-expanded)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
