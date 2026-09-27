// V101.11 (intern): lean quiz-start card — quiz name header, a random quote card that IS the read-aloud button
// (bars move while speaking, 🔀 = another quote), one rule beside Cancel / Start. Real markup + CSS + function.
// V101.12: device-voice fallback prefers a young bright female voice. V101.13: each quote plays its recorded clip
// (Google Chirp 3 HD "Aoede", public/assets/quotes/<slug>.mp3); the device voice only when the clip cannot play.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r/g, '');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('slice: ' + a); return html.slice(i, j); };
const modal = slice('    <div id="quizStartConfirmModal"', '    <div id="quizModal" class="modal">');
const js = slice('        const QUIZ_START_I18N = {', '        async function confirmRunQuiz(quizId) {');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

// every quote has its clip, and no clip is left without a quote
const quotes = new Function(slice('        const QUIZ_START_QUOTES = [', '        // V101.12:') + ' return QUIZ_START_QUOTES;')();
const dir = path.join('public', 'assets', 'quotes');
for (const [, , slug] of quotes) {
    const f = path.join(dir, slug + '.mp3');
    assert.ok(fs.existsSync(f) && fs.statSync(f).size > 5000, 'clip for ' + slug);
}
assert.deepEqual(fs.readdirSync(dir).filter(f => f.endsWith('.mp3')).sort(), quotes.map(q => q[2] + '.mp3').sort(), 'no orphan clips');

async function open(browser, { speech = true, audio = true } = {}) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://intern.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
    await page.goto('https://intern.test/');
    await page.addStyleTag({ content: styles });
    await page.evaluate(([m, speech, audio]) => {
        document.body.insertAdjacentHTML('beforeend', m);
        window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.spoken = []; window.cancels = 0; window.audios = []; window.audioFails = false;
        if (speech) {
            window.SpeechSynthesisUtterance = function (text) { this.text = text; };
            // the real speechSynthesis is a read-only accessor — replace it on the instance
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { spoken.push(u); window.lastU = u; }, cancel: () => { cancels++; }, getVoices: () => (window.testVoices || [{ lang: 'en-US', name: 'Test' }]) } });
        } else { delete Window.prototype.speechSynthesis; delete window.SpeechSynthesisUtterance; }
        if (audio) {
            window.Audio = function (src) {
                this.src = src; this.paused = true; audios.push(this); window.lastA = this;
                this.play = () => { if (window.audioFails) return Promise.reject(new Error('NotAllowedError')); this.paused = false; return Promise.resolve(); };
                this.pause = () => { this.paused = true; };
            };
        } else delete window.Audio;
    }, [modal, speech, audio]);
    await page.addScriptTag({ content: js + '\nwindow.quizStartConfirm = quizStartConfirm; window.QUIZ_START_QUOTES = QUIZ_START_QUOTES;' });
    await page.evaluate(() => { window.result = null; quizStartConfirm('Central Neuropathic Pain').then(v => { window.result = v; }); });
    return { page, errors };
}
const tick = page => page.evaluate(() => new Promise(r => setTimeout(r, 0)));

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors } = await open(browser);
        // lean: name header, no duplicate title / bullet, one rule with its Thai + full text in the hover
        assert.equal(await page.locator('#qsc-quizname').innerText(), 'Central Neuropathic Pain');
        assert.equal(await page.locator('#qsc-title, #qsc-rules').count(), 0, 'duplicate title + bullet removed');
        assert.equal((await page.locator('#qsc-key').innerText()).replace(/\s+/g, ' ').trim(), "🚫 Don't leave or refresh");
        assert.equal(await page.locator('#qsc-key').getAttribute('title'), 'ออกจากหน้านี้ หรือรีเฟรช = ระบบยุติการทำทันที');
        assert.equal(await page.locator('#qsc-key').getAttribute('aria-label'), 'Leaving or refreshing ends your attempt.');
        // a random quote from the list
        const q1 = await page.evaluate(() => [document.getElementById('qsc-quote-text').textContent, document.getElementById('qsc-quote-author').textContent]);
        const slug1 = await page.evaluate(q => (QUIZ_START_QUOTES.find(([t, a]) => t === q[0] && '— ' + a === q[1]) || [])[2], q1);
        assert.ok(slug1, 'quote + author from the list');
        // the card is the play button; a soundwave line (5 bars) — still at rest, moving while playing
        const card = page.locator('#qsc-quote');
        assert.equal(await card.getAttribute('role'), 'button');
        assert.notEqual(await card.locator('.qsc-voice').evaluate(e => getComputedStyle(e).display), 'none', 'soundwave shown');
        assert.equal(await card.locator('.qsc-voice b i').count(), 5);
        assert.equal(await card.locator('.qsc-voice b i').first().evaluate(i => getComputedStyle(i).animationName), 'none', 'still at rest');
        // V101.13: tap = the recorded clip for this quote, not the device voice
        await card.click();
        assert.equal(await page.evaluate(() => lastA.src), 'assets/quotes/' + slug1 + '.mp3');
        assert.equal(await page.evaluate(() => [lastA.paused, spoken.length].join('|')), 'false|0', 'clip plays, device voice unused');
        assert.equal(await card.locator('.qsc-voice b i').first().evaluate(i => getComputedStyle(i).animationName), 'qsc-wave', 'moves while playing');
        await card.click();
        assert.equal(await page.evaluate(() => lastA.paused), true, 'tap again stops the clip');
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/);
        await card.click(); await page.evaluate(() => lastA.onended());
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/, 'ends by itself');
        // the clip cannot play (offline / blocked) → the device voice reads it, young bright female first
        await page.evaluate(() => { window.audioFails = true; });
        await card.click(); await tick(page);
        assert.equal(await page.evaluate(() => spoken.length), 1, 'falls back to the device voice');
        assert.equal(await page.evaluate(() => [lastU.text, lastU.lang, lastU.voice.lang].join('|')), q1[0] + ' — ' + q1[1].slice(2) + '|en-US|en-US');
        assert.deepEqual(await page.evaluate(() => [lastU.rate, lastU.pitch]), [1.05, 1.15]);
        assert.match(await card.getAttribute('class'), /speaking/);
        await page.evaluate(() => lastU.onend());
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/);
        const pickFrom = list => page.evaluate(async l => { window.testVoices = l; const c = document.getElementById('qsc-quote'); c.click(); await new Promise(r => setTimeout(r, 0)); const n = lastU.voice && lastU.voice.name; c.click(); return n; }, list);
        assert.equal(await pickFrom([{ lang: 'en-US', name: 'Microsoft David' }, { lang: 'en-US', name: 'Microsoft Jenny Online (Natural)' }, { lang: 'en-GB', name: 'Samantha' }]), 'Microsoft Jenny Online (Natural)');
        assert.equal(await pickFrom([{ lang: 'en-US', name: 'Samantha' }, { lang: 'en-US', name: 'Zoe (Premium)' }]), 'Zoe (Premium)', 'Zoe before Samantha');
        assert.equal(await pickFrom([{ lang: 'th-TH', name: 'Kanya' }, { lang: 'en-US', name: 'Google US English' }]), 'Google US English');
        assert.equal(await pickFrom([{ lang: 'en-us', name: 'English United States', voiceURI: 'en-us-x-sfg-local' }, { lang: 'en-us', name: 'English United States', voiceURI: 'en-us-x-iom-local' }]), 'English United States');
        assert.equal(await pickFrom([{ lang: 'en-US', name: 'Fred' }]), 'Fred', 'otherwise any en-US voice');
        await page.evaluate(() => { window.testVoices = null; window.audioFails = false; });
        // 🔀 = another quote, never plays, stops what is playing
        await card.click();
        const before = await page.evaluate(() => [audios.length, spoken.length].join('|'));
        await page.locator('#qsc-shuffle').click();
        assert.notEqual(await page.evaluate(() => document.getElementById('qsc-quote-text').textContent), q1[0], 'a different quote');
        assert.equal(await page.evaluate(() => [audios.length, spoken.length].join('|')), before, 'shuffle does not play');
        assert.equal(await page.evaluate(() => lastA.paused), true, 'shuffle stops the clip');
        assert.doesNotMatch(await card.getAttribute('class'), /speaking/);
        // Korean toggle repaints the rule + buttons
        await page.locator('#qsc-lang-chips button').click();
        assert.match(await page.locator('#qsc-key').innerText(), /나가기·새로고침 금지/);
        assert.equal(await page.locator('#qsc-confirm').innerText(), '▶ 시작');
        // rule + buttons fit at 390 px
        const foot = await page.evaluate(() => { const f = document.querySelector('.qsc-foot'), c = document.querySelector('#quizStartConfirmModal .modal-content').getBoundingClientRect(); const ys = [...f.children].map(e => Math.round(e.getBoundingClientRect().top)); return { rows: new Set(ys.map(y => Math.round(y / 20))).size <= 2, fits: [...f.children].every(e => e.getBoundingClientRect().right <= c.right + 1) }; });
        assert.deepEqual(foot, { rows: true, fits: true });
        // Start resolves true and stops the clip
        await card.click();
        await page.locator('#qsc-confirm').click();
        await page.waitForFunction(() => window.result === true);
        assert.equal(await page.evaluate(() => lastA.paused), true, 'clip stopped on start');
        assert.deepEqual(errors, []);
        await page.close();

        // no device speech (some LINE Android WebViews): the recorded clip still plays
        const { page: p2, errors: e2 } = await open(browser, { speech: false });
        assert.equal(await p2.locator('#qsc-quote').getAttribute('role'), 'button');
        await p2.locator('#qsc-quote').click();
        assert.match(await p2.evaluate(() => lastA.src), /^assets\/quotes\/[a-z-]+\.mp3$/);
        await p2.locator('#qsc-cancel').click();
        await p2.waitForFunction(() => window.result === false);
        assert.deepEqual(e2, []);
        await p2.close();

        // neither clips nor speech: plain text, no soundwave, no role
        const { page: p3, errors: e3 } = await open(browser, { speech: false, audio: false });
        assert.equal(await p3.locator('#qsc-quote').getAttribute('role'), null);
        assert.equal(await p3.locator('#qsc-quote .qsc-voice').evaluate(e => getComputedStyle(e).display), 'none');
        assert.ok((await p3.locator('#qsc-quote-text').innerText()).length > 10, 'the quote still shows');
        assert.deepEqual(e3, []);
        console.log('PASS: quiz start card — name header, one rule, random quote, tap = recorded Aoede clip (play/stop/end), device-voice fallback (young female first), 🔀 stops + new quote, KR toggle, start stops audio, no-speech phones still hear the clip, 16 clips on disk, 390 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
