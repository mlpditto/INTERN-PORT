// V101.95: the quiz feedback sheet ("How was this quiz?") is lean + inline with a language capsule EN | 한 | ไทย — header = icon + question + capsule over the quiz name + score/time pill;
// 6 + 5 rating chips tinted red → green; topic chips (not a dropdown); labels screen-reader only; one-line comment box; sticky Skip / Submit. The REAL public/index.html on a touch phone
// (file://, network blocked, Firebase stubbed). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx), 'intern version present');
assert.ok(idx.includes('quiz-feedback-lang.js?v=') && idx.includes('class="modal-content lang-no-toggle"'), 'language file loaded, sheet shielded from lang-toggle.js');
const sheet = idx.slice(idx.indexOf('<div id="quizFeedbackModal"'), idx.indexOf('Reflective Feedback Modal (V86.33)'));
for (const gone of ['Maybe later', 'Feedback is optional.', 'Choose a suggested topic', 'fa-comment-heart', 'Your rating helps improve this quiz.', 'Time used ', '<h4>', '<select']) assert.ok(!sheet.includes(gone), 'removed from the sheet: ' + gone);
assert.ok(!idx.includes('Time used ${mins}'), 'the live path no longer builds its own "Time used" text');

async function open(browser, w, h) {
    const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        quizzesCache = [{ id: 'q1', title: 'Allergic Rhinitis — full long official title of the quiz', shortTitle: 'Allergic Rhinitis-2', tags: 'Cardiology,Renal,Pharmacology,cardiology' }, { id: 'q2', title: 'Plain title only', tags: '' }];
        window.openSheet = (id, pts, sec) => { fbPrepare(id, pts, sec); setFbRating(null); document.getElementById('fb-next-topic').value = ''; document.getElementById('fb-comment').value = ''; updateFeedbackCommentCounter(); renderFeedbackTopicChips(); document.getElementById('quizFeedbackModal').style.display = 'flex'; };
    });
    await page.waitForTimeout(500);
    return { page, errors, ctx };
}
const vis = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const txt = (page, sel) => page.evaluate(sel => (document.querySelector(sel).textContent || '').replace(/\s+/g, ' ').trim(), sel);

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors, ctx } = await open(browser);
        await page.evaluate(() => openSheet('q1', 1.2, 252));
        await page.waitForTimeout(250);

        // ---- header: icon + question + capsule, then quiz name + score / time pill
        const h = await page.evaluate(() => {
            const r = s => document.querySelector(s).getBoundingClientRect(), t = r('#fb-title'), cap = r('.fb-lang'), x = r('#quizFeedbackModal .close-modal'), name = r('#fb-quiz-title'), pill = r('#feedback-score-display'), h3 = document.querySelector('#quizFeedbackModal h3');
            return { title: document.getElementById('fb-title').textContent, name: document.getElementById('fb-quiz-title').textContent, nameTip: document.getElementById('fb-quiz-title').title, score: document.getElementById('feedback-score-val').textContent, time: document.getElementById('feedback-time-val').textContent,
                sameRow: Math.abs((t.top + t.height / 2) - (cap.top + cap.height / 2)) < 14, capBeforeX: cap.right <= x.left + 2, nameSameRow: Math.abs((name.top + name.height / 2) - (pill.top + pill.height / 2)) < 14, noOverlap: t.right <= cap.left + 1, titleOverflow: h3.scrollWidth - h3.clientWidth,
                iconWidth: Math.round(document.querySelector('#quizFeedbackModal h3 i').getBoundingClientRect().width) };
        });
        assert.equal(h.title, 'How was this quiz?');
        assert.equal(h.name, 'Allergic Rhinitis-2', 'the short title is shown');
        assert.ok(/full long official title/.test(h.nameTip), 'the full title is the tooltip');
        assert.equal(h.score, '1.20'); assert.equal(h.time, '🕒 4:12');
        assert.ok(h.sameRow && h.capBeforeX && h.nameSameRow && h.noOverlap && h.titleOverflow <= 0, 'header layout: ' + JSON.stringify(h));
        await page.evaluate(() => openSheet('q2', 0, 0));
        assert.equal(await txt(page, '#fb-quiz-title'), 'Plain title only', 'no short title → the title');
        assert.equal(await vis(page, '#feedback-time-val'), false, 'unknown time is hidden, not "0:00"');
        await page.evaluate(() => openSheet('zzz', 0.5, 61));
        assert.equal(await vis(page, '#fb-quiz-title'), false, 'unknown quiz → no name line');
        // a second open must not keep the first one's numbers (the "give feedback later" path used to show stale 0.00 / 00:00)
        await page.evaluate(() => openSheet('q1', 2.5, 75));
        assert.deepEqual([await txt(page, '#feedback-score-val'), await txt(page, '#feedback-time-val')], ['2.50', '🕒 1:15']);

        // ---- the language capsule
        const labels = await page.evaluate(() => [...document.querySelectorAll('.fb-lang button')].map(b => ({ l: b.dataset.l, t: b.textContent, visible: b.getClientRects().length > 0 && getComputedStyle(b).display !== 'none', h: Math.round(b.getBoundingClientRect().height), tap: Math.round(b.getBoundingClientRect().height + 16), w: Math.round(b.getBoundingClientRect().width), pressed: b.getAttribute('aria-pressed') })));
        assert.deepEqual(labels.map(b => b.t), ['EN', '한', 'ไทย'], 'capsule EN | 한 | ไทย (walker did not hide the Hangul / Thai)');
        assert.ok(labels.every(b => b.visible && b.w >= 28), 'capsule segments visible: ' + JSON.stringify(labels));
        assert.equal(labels.find(b => b.l === 'en').pressed, 'true', 'opens in English when the app is English');
        const strings = async () => page.evaluate(() => ({ title: document.getElementById('fb-title').textContent, topic: document.getElementById('fb-next-topic').placeholder, comment: document.getElementById('fb-comment').placeholder, skip: document.getElementById('fb-skip').textContent, submit: document.getElementById('fb-submit').textContent, rate7: document.querySelector('#fb-rating-stars button[data-val="7"]').title, lo: document.querySelector('.fb-face-lo').title, lang: document.documentElement.lang, sheetLang: document.getElementById('quizFeedbackModal').lang }));
        await page.locator('.fb-lang button[data-l="ko"]').click();
        let s = await strings();
        assert.deepEqual([s.title, s.skip, s.submit], ['이 퀴즈 어땠나요?', '건너뛰기', '제출 →'], 'Korean: ' + JSON.stringify(s));
        assert.ok(/7점/.test(s.rate7) && s.topic.includes('다음 주제') && /좋았던/.test(s.comment) && s.lo === '도움 안 됨' && s.sheetLang === 'ko', 'Korean attributes: ' + JSON.stringify(s));
        assert.equal(await vis(page, '#fb-title'), true, 'Korean title is not hidden by lang-toggle');
        await page.locator('.fb-lang button[data-l="th"]').click();
        s = await strings();
        assert.deepEqual([s.title, s.skip, s.submit], ['แบบทดสอบนี้ดีไหม?', 'ข้าม', 'ส่ง →'], 'Thai: ' + JSON.stringify(s));
        assert.equal(await vis(page, '#fb-title'), true, 'Thai title is not hidden by lang-toggle');
        assert.equal(await page.locator('#quizFeedbackModal .lang-th, #quizFeedbackModal .lang-kr').count(), 0, 'the walker wrapped nothing inside the sheet');
        await page.locator('.fb-lang button[data-l="en"]').click();
        assert.equal((await strings()).title, 'How was this quiz?');
        // the capsule is per sheet: the next open follows the APP language again (KR on → Korean; TH on wins over KR)
        await page.locator('.fb-lang button[data-l="th"]').click();
        await page.evaluate(() => { document.body.classList.add('lang-kr-on'); openSheet('q1', 1, 30); });
        assert.equal((await strings()).title, '이 퀴즈 어땠나요?', 'KR app → Korean sheet; the earlier ไทย pick was a one-off');
        await page.evaluate(() => { document.body.classList.add('lang-th-on'); openSheet('q1', 1, 30); });
        assert.equal((await strings()).title, 'แบบทดสอบนี้ดีไหม?', 'TH wins when both are on');
        await page.evaluate(() => { document.body.classList.remove('lang-kr-on', 'lang-th-on'); openSheet('q1', 1.2, 252); });
        assert.equal((await strings()).title, 'How was this quiz?');

        // ---- rating chips: 6 + 5 grid, red → green, the picked one saturated, status line screen-reader only
        const g = await page.evaluate(() => {
            const bs = [...document.querySelectorAll('#fb-rating-stars button')], tops = [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))].sort((a, b) => a - b);
            const rows = tops.map(t => bs.filter(b => Math.round(b.getBoundingClientRect().top) === t).length), bg = i => getComputedStyle(bs[i]).backgroundColor;
            return { n: bs.length, rows, minH: Math.min(...bs.map(b => b.getBoundingClientRect().height)), minW: Math.min(...bs.map(b => b.getBoundingClientRect().width)), bg0: bg(0), bg5: bg(5), bg10: bg(10), num: (() => { const e = document.getElementById('fb-rating-num').getBoundingClientRect(); return { w: Math.round(e.width), h: Math.round(e.height) }; })() };
        });
        assert.deepEqual([g.n, g.rows], [11, [6, 5]], 'rating grid 6 + 5: ' + JSON.stringify(g));
        assert.ok(g.minH >= 44 && g.minW >= 40, 'chips ≥ 44px tall: ' + JSON.stringify(g));
        assert.ok(g.bg0 !== g.bg5 && g.bg5 !== g.bg10 && g.bg0 !== g.bg10, 'tint ramp 0 / 5 / 10 differ: ' + [g.bg0, g.bg5, g.bg10]);
        assert.ok(g.num.w <= 2 && g.num.h <= 2, 'the "Not rated" line is screen-reader only: ' + JSON.stringify(g.num));
        assert.equal(await txt(page, '#fb-rating-num'), 'Not rated');
        await page.locator('#fb-rating-stars button[data-val="7"]').click();
        assert.equal(await page.locator('#fb-rating').inputValue(), '7');
        assert.equal(await txt(page, '#fb-rating-num'), '7 / 10');
        const picked = await page.evaluate(() => { const b = document.querySelector('#fb-rating-stars button[data-val="7"]'), o = document.querySelector('#fb-rating-stars button[data-val="6"]'); return { on: b.getAttribute('aria-pressed'), bgOn: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color, bgOff: getComputedStyle(o).backgroundColor }; });
        assert.ok(picked.on === 'true' && picked.color === 'rgb(255, 255, 255)' && picked.bgOn !== picked.bgOff, 'picked chip is saturated + white text: ' + JSON.stringify(picked));
        await page.locator('.fb-lang button[data-l="ko"]').click();
        assert.equal(await page.locator('#fb-rating').inputValue(), '7', 'switching language keeps the pick');
        await page.locator('.fb-lang button[data-l="en"]').click();

        // ---- topic chips (not a dropdown); tap = fill, tap again = clear, typing un-presses
        assert.equal(await page.locator('#fb-topic-chip-rail select').count(), 0, 'no dropdown');
        assert.deepEqual(await page.locator('#fb-topic-chip-rail .fb-tchip').allTextContents(), ['Cardiology', 'Pharmacology', 'Renal'], 'popular tags, duplicates folded');
        const chipH = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.fb-tchip')].map(c => c.getBoundingClientRect().height)));
        assert.ok(chipH >= 36, 'topic chips ≥ 36px: ' + chipH);
        await page.locator('.fb-tchip', { hasText: 'Renal' }).click();
        assert.equal(await page.locator('#fb-next-topic').inputValue(), 'Renal');
        assert.equal(await page.locator('.fb-tchip[aria-pressed="true"]').count(), 1);
        await page.locator('.fb-tchip', { hasText: 'Renal' }).click();
        assert.equal(await page.locator('#fb-next-topic').inputValue(), '', 'tap again clears');
        await page.locator('.fb-tchip', { hasText: 'Renal' }).click();
        await page.locator('#fb-next-topic').fill('My own topic');
        assert.equal(await page.locator('.fb-tchip[aria-pressed="true"]').count(), 0, 'typing un-presses the chips');
        await page.locator('#fb-next-topic').fill('cardiology');
        assert.equal(await page.locator('.fb-tchip[aria-pressed="true"]').count(), 1, 'typing a chip’s text presses it');
        await page.evaluate(() => { document.getElementById('fb-next-topic').value = ''; fbSyncTopicChips(); });
        await page.evaluate(() => { quizzesCache = []; renderFeedbackTopicChips(); });
        assert.equal(await vis(page, '#fb-topic-chip-rail'), false, 'no tags in the catalogue → no rail');
        await page.evaluate(() => { quizzesCache = [{ id: 'q1', title: 'Allergic Rhinitis — full long official title of the quiz', shortTitle: 'Allergic Rhinitis-2', tags: 'Cardiology,Renal,Pharmacology,cardiology' }]; renderFeedbackTopicChips(); });

        // ---- comment box: one line when empty; opens on focus / text; the counter only when there is text
        const ta = () => page.evaluate(() => { const t = document.getElementById('fb-comment'); return { h: Math.round(t.getBoundingClientRect().height), count: getComputedStyle(document.getElementById('fb-comment-count')).display, text: document.getElementById('fb-comment-count').textContent }; });
        let c = await ta();
        assert.ok(c.h <= 48 && c.count === 'none', 'empty comment = one line, no counter: ' + JSON.stringify(c));
        await page.locator('#fb-comment').focus();
        await page.waitForTimeout(100);
        assert.ok((await ta()).h >= 96, 'focus opens the comment box');
        await page.locator('#fb-comment').fill('Good examples');
        await page.locator('#fb-next-topic').focus();
        c = await ta();
        assert.ok(c.h >= 96 && c.count !== 'none' && c.text === '13 chars', 'text keeps it open + shows the count: ' + JSON.stringify(c));
        await page.locator('.fb-lang button[data-l="ko"]').click();
        assert.equal((await ta()).text, '13자', 'the counter follows the language');
        await page.locator('.fb-lang button[data-l="en"]').click();
        await page.evaluate(() => { document.getElementById('fb-comment').value = ''; updateFeedbackCommentCounter(); });

        // ---- footer: Skip + Submit only, in view on a phone; the sheet fits
        const f = await page.evaluate(() => { const sb = document.getElementById('fb-submit').getBoundingClientRect(), sk = document.getElementById('fb-skip').getBoundingClientRect(), foot = document.querySelector('.fb-review-footer'); return { buttons: foot.querySelectorAll('button').length, extra: foot.textContent.replace(/\s+/g, ' ').trim(), submitBottom: Math.round(sb.bottom), vh: innerHeight, skipH: Math.round(sk.height), submitH: Math.round(sb.height), sticky: getComputedStyle(foot).position }; });
        assert.ok(f.buttons === 2 && f.extra === 'Skip Submit →' && f.sticky === 'sticky', 'footer = Skip + Submit, sticky: ' + JSON.stringify(f));
        assert.ok(f.submitBottom <= f.vh && f.skipH >= 44 && f.submitH >= 44, 'Submit is in view on a 390×780 phone and ≥ 44px: ' + JSON.stringify(f));
        // a short screen: the sheet scrolls, Submit stays in view at the top AND after scrolling
        await page.setViewportSize({ width: 390, height: 400 });
        await page.waitForTimeout(200);
        const stick = async top => page.evaluate(top => { const mc = document.querySelector('#quizFeedbackModal > .modal-content'); mc.scrollTop = top ? 0 : mc.scrollHeight; const sb = document.getElementById('fb-submit').getBoundingClientRect(), r = mc.getBoundingClientRect(); return { scrolls: mc.scrollHeight > mc.clientHeight + 4, inView: sb.bottom <= r.bottom + 1 && sb.top >= r.top }; }, top);
        const st1 = await stick(true), st2 = await stick(false);
        assert.ok(st1.scrolls && st1.inView && st2.inView, 'on a 400px screen the sheet scrolls but Submit stays in view (top / bottom): ' + JSON.stringify([st1, st2]));
        await page.setViewportSize({ width: 390, height: 780 });

        // ---- reward card speaks the sheet's language
        await page.locator('.fb-lang button[data-l="ko"]').click();
        await page.evaluate(() => { const real = closeFeedbackModal; window.closeFeedbackModal = () => {}; showFeedbackReward(3); window.closeFeedbackModal = real; });
        const reward = await page.evaluate(() => ({ t: document.getElementById('fb-reward-title').textContent, s: document.getElementById('fb-reward-streak-line').textContent, k: document.getElementById('fb-reward-keep').textContent, formHidden: document.getElementById('fb-form-content').style.display === 'none' }));
        assert.ok(reward.t === '의견 감사합니다!' && /3회/.test(reward.s) && reward.formHidden, 'Korean reward card: ' + JSON.stringify(reward));
        assert.ok(!/ขอบคุณ|Thanks/.test(reward.t + reward.s + reward.k), 'one language at a time (the old card showed EN + TH together)');

        if (process.env.SHOT) {
            for (const [lang, name] of [['en', 'en'], ['th', 'th'], ['ko', 'ko']]) {
                await page.evaluate(() => { document.getElementById('fb-form-content').style.display = ''; document.getElementById('fb-reward-card').style.display = 'none'; openSheet('q1', 1.2, 252); document.querySelector('#fb-rating-stars button[data-val="8"]').click(); });
                await page.locator('.fb-lang button[data-l="' + lang + '"]').click();
                await page.waitForTimeout(200);
                await page.screenshot({ path: path.join(process.env.SHOT, `feedback_${name}.png`) });
            }
        }
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();

        // ---- widths: nothing overflows; the title is whole at 390 / 360 / 320 in all three languages
        for (const w of [390, 360, 320]) {
            const { page: p, ctx: c2 } = await open(browser, w, 740);
            for (const lang of ['en', 'ko', 'th']) {
                await p.evaluate(() => openSheet('q1', 1.2, 252));
                await p.locator('.fb-lang button[data-l="' + lang + '"]').click();
                const m = await p.evaluate(() => { const mc = document.querySelector('#quizFeedbackModal > .modal-content'), h3 = document.querySelector('#quizFeedbackModal h3'), cap = document.querySelector('.fb-lang').getBoundingClientRect(), t = h3.getBoundingClientRect(); return { sx: mc.scrollWidth - mc.clientWidth, titleOverflow: h3.scrollWidth - h3.clientWidth, titleVsCap: t.right <= cap.left + 1 || t.bottom <= cap.top + 2, left: Math.round(mc.getBoundingClientRect().left), right: Math.round(mc.getBoundingClientRect().right) }; });
                assert.ok(m.sx <= 1 && m.left >= 0 && m.right <= w, `no sideways scroll @${w}/${lang}: ` + JSON.stringify(m));
                assert.ok(m.titleOverflow <= (w >= 390 ? 0 : 0) && m.titleVsCap, `title whole and clear of the capsule @${w}/${lang}: ` + JSON.stringify(m));
            }
            await c2.close();
        }
        console.log('PASS: feedback sheet — lean header (icon + question + EN|한|ไทย capsule, quiz short title, score/time pill, fresh each open), 6+5 tinted rating chips, topic chips, one-line comment, sticky Skip/Submit, per-sheet language that follows the app, reward card in one language, fits 390/360/320');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
