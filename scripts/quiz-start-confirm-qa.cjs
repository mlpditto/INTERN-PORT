// V101.11 (intern): lean quiz-start card — quiz name header, a random quote card that IS the read-aloud button
// (bars move while speaking, 🔀 = another quote), one rule beside Cancel / Start. Real markup + CSS + function.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r/g, '');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('slice: ' + a); return html.slice(i, j); };
const modal = slice('    <div id="quizStartConfirmModal"', '    <div id="quizModal" class="modal">');
const js = slice('        const QUIZ_START_I18N = {', '        async function confirmRunQuiz(quizId) {');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

async function open(browser, withSpeech) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://intern.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
    await page.goto('https://intern.test/');
    await page.addStyleTag({ content: styles });
    await page.evaluate(([m, speech]) => {
        document.body.insertAdjacentHTML('beforeend', m);
        window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.spoken = []; window.cancels = 0;
        if (speech) {
            window.SpeechSynthesisUtterance = function (text) { this.text = text; };
            // the real speechSynthesis is a read-only accessor — replace it on the instance
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { spoken.push(u); window.lastU = u; }, cancel: () => { cancels++; }, getVoices: () => [{ lang: 'en-US', name: 'Test' }] } });
        } else { delete Window.prototype.speechSynthesis; delete window.SpeechSynthesisUtterance; }
    }, [modal, withSpeech]);
    await page.addScriptTag({ content: js + '\nwindow.quizStartConfirm = quizStartConfirm; window.QUIZ_START_QUOTES = QUIZ_START_QUOTES;' });
    await page.evaluate(() => { window.result = null; quizStartConfirm('Central Neuropathic Pain').then(v => { window.result = v; }); });
    return { page, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors } = await open(browser, true);
        // lean: name header, no duplicate title / bullet, one rule with its Thai + full text in the hover
        assert.equal(await page.locator('#qsc-quizname').innerText(), 'Central Neuropathic Pain');
        assert.equal(await page.locator('#qsc-title, #qsc-rules').count(), 0, 'duplicate title + bullet removed');
        assert.equal((await page.locator('#qsc-key').innerText()).replace(/\s+/g, ' ').trim(), "🚫 Don't leave or refresh");
        assert.equal(await page.locator('#qsc-key').getAttribute('title'), 'ออกจากหน้านี้ หรือรีเฟรช = ระบบยุติการทำทันที');
        assert.equal(await page.locator('#qsc-key').getAttribute('aria-label'), 'Leaving or refreshing ends your attempt.');
        // a random quote from the list
        const q1 = await page.evaluate(() => [document.getElementById('qsc-quote-text').textContent, document.getElementById('qsc-quote-author').textContent]);
        assert.ok(await page.evaluate(q => QUIZ_START_QUOTES.some(([t, a]) => t === q[0] && '— ' + a === q[1]), q1), 'quote + author from the list');
        // the card is the play button
        const card = page.locator('#qsc-quote');
        assert.equal(await card.getAttribute('role'), 'button');
        assert.notEqual(await card.locator('.qsc-voice').evaluate(e => getComputedStyle(e).display), 'none', 'speaker shown');
        // V101.11: a soundwave line (5 bars) instead of a speaker — still at rest, moving while speaking
        assert.equal(await card.locator('.qsc-voice b i').count(), 5);
        assert.equal(await card.locator('.qsc-voice .fa-volume-high').count(), 0, 'no speaker icon');
        assert.equal(await card.locator('.qsc-voice b i').first().evaluate(i => getComputedStyle(i).animationName), 'none', 'still at rest');
        await card.click();
        assert.equal(await card.locator('.qsc-voice b i').first().evaluate(i => getComputedStyle(i).animationName), 'qsc-wave', 'moves while speaking');
        assert.equal(await page.evaluate(() => spoken.length), 1);
        assert.equal(await page.evaluate(() => [lastU.text, lastU.lang, lastU.voice.lang].join('|')), q1[0] + ' — ' + q1[1].slice(2) + '|en-US|en-US');
        assert.match(await card.getAttribute('class'), /speaking/);
                await card.click();
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/, 'tap again stops');
        await page.evaluate(() => { document.getElementById('qsc-quote').click(); lastU.onend(); });
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/, 'ends by itself');
        // 🔀 = another quote, never speaks, stops any speech
        await card.click();
        await page.locator('#qsc-shuffle').click();
        const q2 = await page.evaluate(() => document.getElementById('qsc-quote-text').textContent);
        assert.notEqual(q2, q1[0], 'a different quote');
        assert.equal(await page.evaluate(() => spoken.length), 3, 'shuffle does not speak');
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/);
        // Korean toggle repaints the rule + buttons
        await page.locator('#qsc-lang-chips button').click();
        assert.match(await page.locator('#qsc-key').innerText(), /나가기·새로고침 금지/);
        assert.equal(await page.locator('#qsc-confirm').innerText(), '▶ 시작');
        // one row of rule + buttons at 390 px, nothing overflows
        const foot = await page.evaluate(() => { const f = document.querySelector('.qsc-foot'), c = document.querySelector('#quizStartConfirmModal .modal-content').getBoundingClientRect(); const ys = [...f.children].map(e => Math.round(e.getBoundingClientRect().top)); return { rows: new Set(ys.map(y => Math.round(y / 20))).size <= 2, fits: [...f.children].every(e => e.getBoundingClientRect().right <= c.right + 1) }; });
        assert.deepEqual(foot, { rows: true, fits: true });
        // Start resolves true and silences any speech
        await card.click();
        const before = await page.evaluate(() => cancels);
        await page.locator('#qsc-confirm').click();
        await page.waitForFunction(() => window.result === true);
        assert.ok(await page.evaluate(b => cancels > b, before), 'speech stopped on start');
        assert.deepEqual(errors, []);
        await page.close();

        // no speech on this device (some LINE Android WebViews): plain text, no speaker, no role
        const { page: p2, errors: e2 } = await open(browser, false);
        assert.equal(await p2.locator('#qsc-quote').getAttribute('role'), null);
        assert.equal(await p2.locator('#qsc-quote .qsc-voice').evaluate(e => getComputedStyle(e).display), 'none', 'no speaker');
        assert.ok((await p2.locator('#qsc-quote-text').innerText()).length > 10, 'the quote still shows');
        await p2.locator('#qsc-shuffle').click();
        await p2.locator('#qsc-cancel').click();
        await p2.waitForFunction(() => window.result === false);
        assert.deepEqual(e2, []);
        console.log('PASS: quiz start card — name header, one rule (Thai/full text in hover), random quote, tap card = read aloud / stop, bars while speaking, 🔀 new quote, KR toggle, start stops speech, no-speech devices degrade, 390 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
