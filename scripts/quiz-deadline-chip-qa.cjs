// V101.227 — intern quiz deadline countdown chip: red under 24 h ("⏰ Closes in 5 h 20 m"), amber 24–72 h ("⏳ Closes in 2 d 4 h"), nothing beyond 3 days;
// words follow the UI language (EN / ไทย / 한국어); text rewritten only when it changed; card gets a left stripe in the same tier; the preview sheet chip ticks too.
// Real index.html qzCountdownInfo + checkExpiry on a 390px touch phone with the real quiz-cover.css; fake db.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.addInitScript(() => {
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        window.firebase = any;
    });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(INDEX); await page.waitForTimeout(500);
    const r = await page.evaluate(async () => {
        const H = 3600e3, D = 24 * H, out = {};
        const info = ms => qzCountdownInfo(ms);
        out.none = [info(3 * D + 1).tier, info(0).tier, info(-5).tier];
        out.edge72 = info(3 * D).tier;
        out.amber = info(2 * D + 4 * H + 30000);
        out.amberEdge = info(D).tier;
        out.red = info(5 * H + 20 * 60000 + 10000);
        out.redEdge = info(D - 1).tier;
        out.pulse = [info(3 * H).pulse, info(3 * H + 1).pulse, info(50 * 60000).pulse, info(D - 1).pulse];
        out.minutes = info(7 * 60000 + 5000).text;
        out.lt1 = info(30000).text;
        // language
        out.langNow = window.uiLang();
        // DOM: three cards (red, amber, far) + an expired one, then tick
        const host = document.createElement('div'); host.id = 'qa-host'; host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;padding:12px;overflow:auto';
        const now = Date.now();
        const card = (id, dueMs) => `<div class="assignment-card lang-no-toggle" data-qa="${id}"><div class="assign-icon" style="width:42px;height:42px">🧠</div><div class="assign-header"><div class="assign-info"><h4>${id}</h4><div class="quiz-mission-meta"><span>15 items</span></div></div></div>
            <div class="assign-footer"><button class="btn-primary btn-quiz-cta" onclick="confirmRunQuiz('${id}')">🚀 Start <span class="quiz-cta-countdown" data-dead="${now + dueMs}"></span></button></div></div>`;
        host.innerHTML = card('red', 5 * H + 20 * 60000 + 30000) + card('amber', 2 * D + 4 * H + 30000) + card('far', 5 * D) + card('late', -1000);
        document.body.appendChild(host);
        host.querySelectorAll('.assignment-card').forEach(c => QuizCover.decorate(c, { title: c.dataset.qa }, false));
        checkExpiry();
        const q = (id) => host.querySelector(`[data-qa="${id}"] .quiz-cover-deadline, [data-qa="${id}"] .quiz-cta-countdown`);
        const snap = id => { const el = q(id); const cs = getComputedStyle(el); return { text: el.textContent, tier: el.dataset.tier || '', hidden: cs.display === 'none', bg: cs.backgroundColor, aria: el.getAttribute('aria-label') || '', stripe: el.closest('.assignment-card').style.boxShadow }; };
        out.red = Object.assign(out.red, {}); out.dom = { red: snap('red'), amber: snap('amber'), far: snap('far'), late: snap('late') };
        // text is not rewritten while unchanged
        const el = q('red'); let writes = 0; const mo = new MutationObserver(m => { writes += m.length; }); mo.observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
        checkExpiry(); checkExpiry(); await new Promise(res => setTimeout(res, 30)); mo.disconnect(); out.writesWhenSame = writes;
        // language switch is picked up on the next tick
        const prev = window.uiLang; window.uiLang = () => 'th'; window.uiText = (s) => String(s).split('|')[1] || String(s).split('|')[0];
        checkExpiry(); out.th = q('red').textContent; out.thAmber = q('amber').textContent;
        window.uiText = (s) => String(s).split('|')[2] || String(s).split('|')[0]; window.uiLang = () => 'ko'; checkExpiry(); out.ko = q('red').textContent;
        window.uiLang = prev;
        return out;
    });
    assert.deepEqual(r.none, ['none', 'none', 'none']);
    assert.equal(r.edge72, 'amber', 'exactly 72 h is still amber');
    assert.equal(r.amberEdge, 'amber', 'exactly 24 h flips to amber, under it to red');
    assert.equal(r.redEdge, 'red');
    assert.equal(r.amber.tier, 'amber'); assert.match(r.amber.text, /^⏳ .*2 d 4 h$/); assert.equal(r.amber.pulse, false);
    assert.equal(r.red.tier, 'red'); assert.match(r.red.text, /^⏰ .*5 h 20 m$/);
    assert.deepEqual(r.pulse, [true, false, true, false], 'pulse only within the last 3 h');
    assert.match(r.minutes, /7 m$/); assert.match(r.lt1, /<1 m$/);
    assert.equal(r.dom.red.tier, 'red'); assert.equal(r.dom.red.hidden, false); assert.equal(r.dom.red.bg, 'rgb(220, 38, 38)'); assert.match(r.dom.red.aria, /5 hours 20 minutes/); assert.match(r.dom.red.stripe, /rgb\(220, 38, 38\)/);
    assert.equal(r.dom.amber.tier, 'amber'); assert.equal(r.dom.amber.hidden, false); assert.equal(r.dom.amber.bg, 'rgb(254, 243, 199)'); assert.match(r.dom.amber.stripe, /rgb\(245, 158, 11\)/);
    assert.equal(r.dom.far.tier, 'none'); assert.equal(r.dom.far.hidden, true, 'beyond 3 days: no chip at all'); assert.equal(r.dom.far.stripe, '');
    assert.match(r.dom.late.text, /Late/); assert.equal(r.dom.late.stripe, '');
    assert.equal(r.writesWhenSame, 0, 'unchanged tick must not touch the DOM');
    assert.match(r.th, /เหลือ 5 ชม\. 20 น\./); assert.match(r.thAmber, /เหลือ 2 วัน 4 ชม\./); assert.match(r.ko, /5시간 20분 남음/);
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    await browser.close();
    console.log('PASS: quiz deadline chip — red <24 h with pulse only in the last 3 h, amber 24–72 h, none beyond 3 days, EN/ไทย/한국어 on the next tick, no DOM writes while unchanged, card stripe follows the tier, expired → Late');
})().catch(e => { console.error(e); process.exit(1); });
