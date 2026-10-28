// V101.228 — the quiz-card deadline chip IS the Start button (Aurora Pastel liquid glass, slim 32px pill + 24px ▶ orb, 44px hit area).
// Real index.html + quiz-cover.js decorate + quiz-cover.css on a 390px touch phone. Covers every tier (calm 📅 · amber · red · "Start" plain · ⏱ Late),
// the chip as the only ▶ on single-button cards, cards that keep their footer (ORANGE ▶ stays, no chip), tap / hit-area size, one line in EN + ไทย,
// click → start without bubbling, Reduce Motion, backdrop-filter fallback, sheen only while on screen, and AA contrast at the worst gradient stop.
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

const CARDS = `
    const H = 3600e3, D = 24 * H, now = Date.now();
    const card = (id, dueMs, footerExtra) => '<div class="assignment-card lang-no-toggle" data-qa="' + id + '">' +
        '<div class="assign-header"><div class="assign-icon" style="width:42px;height:42px">🧠</div>' +
        '<div class="assign-info"><h4>' + id + '</h4><div class="quiz-mission-meta"><span>10 items · 1 pts</span></div></div></div><div class="assign-body"></div>' +
        '<div class="assign-footer"><button class="btn-primary btn-quiz-cta" onclick="confirmRunQuiz(\\'' + id + '\\')">🚀 Start Quiz' +
        (dueMs ? ' <span class="quiz-cta-countdown" data-dead="' + (now + dueMs) + '"></span>' : '') + '</button>' + (footerExtra || '') + '</div></div>';
`;

(async () => {
    const browser = await chromium.launch();
    const open = async (opts, lang) => {
        const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, opts));
        const page = await ctx.newPage();
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(INDEX); await page.waitForTimeout(500);
        await page.evaluate(`(function () {
            ${CARDS}
            const host = document.createElement('div'); host.id = 'qa-host'; host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:12px;overflow:auto';
            window.__cardClicks = 0; window.confirmRunQuiz = id => { window.__started = id; };
            host.innerHTML = card('calm', 87 * H + 33 * 60000) + card('amber', 2 * D + 4 * H + 30000) + card('red', 5 * H + 20 * 60000 + 30000) + card('hot', 2 * H + 30000)
                + card('plain', 0) + card('late', 0) + card('footer2', 10 * H, '<button class="btn-secondary">Details</button>');
            document.body.appendChild(host);
            host.querySelectorAll('.assignment-card').forEach(c => { c.addEventListener('click', () => { window.__cardClicks++; });
                QuizCover.decorate(c, { title: c.dataset.qa, deadline: c.dataset.qa === 'late' ? { toDate: () => new Date(Date.now() - 1000) } : null }, false); });
            checkExpiry();
        })()`);
        if (lang === 'th') await page.evaluate(() => { window.uiLang = () => 'th'; window.uiText = s => String(s).split('|')[1] || String(s).split('|')[0]; checkExpiry(); });
        return { ctx, page, errors };
    };
    const geo = (page, id) => page.evaluate(id => {
        const c = document.querySelector('[data-qa="' + id + '"]'), el = c.querySelector('.quiz-cover-deadline'), play = c.querySelector('.quiz-cover-play');
        const r = el && el.getBoundingClientRect(), cs = el && getComputedStyle(el), before = el && getComputedStyle(el, '::before'), after = el && getComputedStyle(el, '::after');
        const cardR = c.getBoundingClientRect();
        let above = null, below = null;
        if (el) { const x = r.left + r.width / 2; above = document.elementFromPoint(x, r.top - 5) === el; below = document.elementFromPoint(x, r.bottom + 5) === el; }
        return {
            chip: !!el, play: !!play, text: el ? el.textContent : '', tier: el ? el.dataset.tier || '' : '', hidden: el ? cs.display === 'none' : null,
            h: r ? Math.round(r.height * 10) / 10 : 0, w: r ? r.width : 0, insideCard: r ? r.right <= cardR.right + 0.5 && r.left >= cardR.left - 0.5 : null,
            orbW: before ? before.width : '', orbContent: before ? before.content : '', afterInset: after ? [after.top, after.left, after.width, after.height] : null,
            hitAbove: above, hitBelow: below, bf: el ? (cs.backdropFilter || cs.webkitBackdropFilter) : '', anim: el ? cs.animationName : '', ink: el ? cs.color : '',
            pulse: el ? el.dataset.pulse || '' : '', footerShown: getComputedStyle(c.querySelector('.assign-footer')).display !== 'none',
        };
    }, id);

    // ── 1 · EN, normal motion ─────────────────────────────────────────────────────────────────────────────────────────────────────────
    const en = await open({}, 'en');
    const g = {}; for (const id of ['calm', 'amber', 'red', 'hot', 'plain', 'late', 'footer2']) g[id] = await geo(en.page, id);
    // tiers + words
    assert.equal(g.calm.tier, 'calm'); assert.match(g.calm.text, /^📅 Closes in 3 d 15 h$/);
    assert.equal(g.amber.tier, 'amber'); assert.match(g.amber.text, /^⏳ /);
    assert.equal(g.red.tier, 'red'); assert.match(g.red.text, /^⏰ /); assert.equal(g.red.pulse, '');
    assert.equal(g.hot.pulse, '1', 'pulse only in the last 3 h');
    assert.equal(g.plain.tier, 'plain'); assert.equal(g.plain.text, 'Start', 'no deadline → plain Start pill');
    assert.equal(g.late.tier, ''); assert.match(g.late.text, /Late/);
    for (const id of ['calm', 'amber', 'red', 'hot', 'plain', 'late']) {
        const x = g[id];
        assert.ok(x.chip && !x.hidden, id + ': chip visible');
        assert.equal(x.play, false, id + ': the orange cover ▶ is gone — the chip carries the ▶');
        assert.equal(x.footerShown, false, id + ': footer stays hidden');
        assert.equal(x.orbContent, '"▶"', id + ': ▶ orb is the chip ::before (survives the per-tick text rewrite)');
        assert.equal(x.orbW, '24px', id + ': orb 24px');
        assert.ok(x.h >= 31.5 && x.h <= 33, id + ': slim pill ≈ 32px tall, got ' + x.h);
        assert.ok(x.insideCard, id + ': one line, inside the card at 390px (width ' + x.w + ')');
        assert.deepEqual(x.afterInset.slice(0, 2), ['-6px', '-4px'], id + ': invisible hit area reaches 6px above / 4px beside');
        assert.ok(parseFloat(x.afterInset[3]) >= 44 && parseFloat(x.afterInset[3]) <= 46, id + ': hit area ≥ 44px tall, got ' + x.afterInset[3]);
        assert.ok(parseFloat(x.afterInset[2]) >= 44, id + ': hit area ≥ 44px wide');
        assert.equal(x.hitAbove, true, id + ': a tap 5px above the pill lands on the chip'); assert.equal(x.hitBelow, true, id + ': a tap 5px below the pill lands on the chip');
        assert.match(x.bf, /blur\(6px\)/, id + ': one small backdrop-filter');
    }
    // cards that keep their footer: orange ▶ on the cover, no chip, footer button visible (today's behaviour exactly)
    assert.deepEqual([g.footer2.chip, g.footer2.play, g.footer2.footerShown], [false, true, true], 'footer2: no chip, ▶ stays on the cover');
    // animation: sheen only for chips on screen (≥60%) — all are visible in this 1000px host
    await en.page.waitForTimeout(250);
    const sw = await en.page.evaluate(() => [...document.querySelectorAll('.quiz-cover-deadline')].map(e => [e.closest('.assignment-card').dataset.qa, e.classList.contains('qcc-in'), getComputedStyle(e).animationName]));
    const swm = Object.fromEntries(sw.map(([id, inn, an]) => [id, [inn, an]]));
    assert.deepEqual(swm.calm, [true, 'qzSgSweep']); assert.deepEqual(swm.plain, [true, 'qzSgSweep']); assert.deepEqual(swm.amber, [true, 'qzSgSweep']);
    assert.equal(swm.red[1], 'none', 'red has no sheen (keeps white ink AA)'); assert.equal(swm.hot[1], 'qzSgPulse', 'last-3h chip pulses its glow');
    assert.equal(await en.page.evaluate(() => getComputedStyle(document.querySelector('[data-qa="calm"] .quiz-cover-deadline')).animationIterationCount), '3', 'sheen runs 3 sweeps, never loops');
    // scrolled out of view → no sheen class
    await en.page.evaluate(() => { const h = document.getElementById('qa-host'); h.insertAdjacentHTML('beforeend', '<div style="height:2000px"></div>'); });
    await en.page.evaluate(() => { document.getElementById('qa-host').scrollTop = 2000; });
    await en.page.waitForTimeout(300);
    assert.equal(await en.page.evaluate(() => document.querySelector('[data-qa="calm"] .quiz-cover-deadline').classList.contains('qcc-in')), false, 'offscreen chip stops sweeping');
    await en.page.evaluate(() => { document.getElementById('qa-host').scrollTop = 0; });
    // click: chip starts the quiz and does not reach the card
    for (const id of ['calm', 'red', 'plain', 'late']) {
        await en.page.evaluate(() => { window.__started = ''; window.__cardClicks = 0; });
        await en.page.locator('[data-qa="' + id + '"] .quiz-cover-deadline').tap();
        assert.equal(await en.page.evaluate(() => window.__started), id, id + ': tapping the chip starts the quiz');
        assert.equal(await en.page.evaluate(() => window.__cardClicks), 1, id + ': only the one programmatic Start click reaches the card — same as the cover (the chip tap itself is stopped)');
    }
    // a tap in the 6px outside the pill also starts it (the invisible hit area)
    await en.page.evaluate(() => { window.__started = ''; });
    const box = await en.page.locator('[data-qa="amber"] .quiz-cover-deadline').boundingBox();
    await en.page.touchscreen.tap(box.x + box.width / 2, box.y - 4);
    assert.equal(await en.page.evaluate(() => window.__started), 'amber', 'tap 4px above the pill (hit area) starts the quiz');
    // the cover button still starts it (keyboard / screen reader path) and is unchanged
    await en.page.evaluate(() => { window.__started = ''; });
    await en.page.locator('[data-qa="calm"] .quiz-cover-thumb').tap();
    assert.equal(await en.page.evaluate(() => window.__started), 'calm', 'cover still starts the quiz');
    // the per-second tick rewrites the text but keeps the orb (::before) and the tier
    const tick = await en.page.evaluate(() => { checkExpiry(); const e = document.querySelector('[data-qa="red"] .quiz-cover-deadline'); return [e.textContent, getComputedStyle(e, '::before').content, e.dataset.tier]; });
    assert.equal(tick[1], '"▶"'); assert.equal(tick[2], 'red');
    // expiry while open: tier attribute dropped → ⏱ Late glass (no tier = late tokens), still tappable
    const exp = await en.page.evaluate(() => { const e = document.querySelector('[data-qa="hot"] .quiz-cover-deadline'); e.dataset.dead = String(Date.now() - 1); checkExpiry(); return [e.textContent, e.dataset.tier || '', getComputedStyle(e).display]; });
    assert.deepEqual(exp, ['⏱ Late', '', 'inline-flex']);
    if (process.env.QA_SHOT) await en.page.screenshot({ path: process.env.QA_SHOT });
    assert.deepEqual(en.errors, [], 'no page errors: ' + en.errors.join(' | '));
    await en.ctx.close();

    // ── 2 · ไทย: same one-line chips ─────────────────────────────────────────────────────────────────────────────────────────────────
    const th = await open({}, 'th');
    for (const id of ['calm', 'amber', 'red', 'plain', 'late']) {
        const x = await geo(th.page, id);
        assert.ok(x.h >= 31.5 && x.h <= 33 && x.insideCard, 'TH ' + id + ': one line, inside the card (h ' + x.h + ', w ' + x.w + ')');
    }
    assert.match((await geo(th.page, 'calm')).text, /^📅 เหลือ 3 วัน 15 ชม\.$/);
    await th.ctx.close();

    // ── 3 · Reduce Motion: nothing moves ────────────────────────────────────────────────────────────────────────────────────────────
    const rm = await open({ reducedMotion: 'reduce' }, 'en');
    const rmA = await rm.page.evaluate(() => [...document.querySelectorAll('.quiz-cover-deadline')].map(e => getComputedStyle(e).animationName));
    assert.ok(rmA.every(a => a === 'none'), 'Reduce Motion: no sheen, no pulse, no first-view pulse → ' + rmA.join(','));
    await rm.ctx.close();

    // ── 4 · stylesheet: solid fallback where backdrop-filter is missing; orange ▶ rule kept for footer cards ─────────────────────
    const css = fs.readFileSync('public/quiz-cover.css', 'utf8');
    assert.match(css, /@supports not \(\(backdrop-filter:blur\(1px\)\) or \(-webkit-backdrop-filter:blur\(1px\)\)\)\{\.quiz-cover-startable \.quiz-cover-deadline\{background:var\(--sg-solid\)\}\}/, 'solid background fallback');
    assert.match(css, /-webkit-backdrop-filter:blur\(6px\)/, 'WebKit prefix for LINE iOS');
    assert.match(css, /\.quiz-cover-play\{position:absolute/, 'footer cards keep the orange ▶');

    // ── 5 · contrast: ink on the worst gradient stop of every tier ≥ 4.5:1 (stops composited over the white card) ───────────────────────
    const c2 = await open({}, 'en');
    const toks = await c2.page.evaluate(() => {
        const out = {}; for (const id of ['calm', 'amber', 'red', 'plain', 'late']) {
            const cs = getComputedStyle(document.querySelector('[data-qa="' + id + '"] .quiz-cover-deadline'));
            out[id] = { g: ['--g1', '--g2', '--g3'].map(k => cs.getPropertyValue(k).trim()), ink: cs.getPropertyValue('--ink').trim(), gloss: cs.getPropertyValue('--gloss').trim() };
        } return out;
    });
    await c2.ctx.close();
    const rgba = s => { s = s.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3'); const m = s.match(/^#([0-9a-f]{6})$/i); if (m) return [1, 3, 5].map(i => parseInt(m[1].slice(i - 1, i + 1), 16)).concat(1); const n = s.match(/[\d.]+/g).map(Number); return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; };
    const lum = c => { const f = v => (v /= 255) <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const rep = [];
    for (const [tier, t] of Object.entries(toks)) {
        const ink = rgba(t.ink).slice(0, 3);
        t.g.filter(Boolean).forEach((s, i) => { const [r, g2, b, a] = rgba(s); const stop = [r, g2, b].map(v => Math.round(v * a + 255 * (1 - a))); const cr = ratio(ink, stop); rep.push(tier + ' g' + (i + 1) + ' ' + cr.toFixed(2)); assert.ok(cr >= 4.5, tier + ' g' + (i + 1) + ': contrast ' + cr.toFixed(2) + ' < 4.5'); });
    }
    assert.equal(toks.red.gloss, '0', 'red has no white gloss over white ink');
    console.log('PASS: start chip — Aurora Pastel pill 32px + 24px ▶ orb with a 44px hit area; calm 📅 · amber · red (pulse only <3 h) · plain Start · ⏱ Late all start the quiz; footer cards keep the orange ▶; EN/ไทย one line; sheen only on screen (3 sweeps), none under Reduce Motion; solid fallback; AA at every stop (' + rep.join(', ') + ')');
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
