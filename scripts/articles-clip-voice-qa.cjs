// V102.626 (owner: "ยังไม่มีเสียงไทย") — 📰 Articles ▸ 🎬 Clip ▸ ▶ Play speaks with the AI voice (Gemini TTS, the Laboon Interactions request and key):
// one request per line, all sent at once, 🙋 = Kore, 🧑‍⚕️ / 💡 = Puck, the chat steps on when each line's audio ends; a second Play reuses the cached
// audio; a failed line falls back to this computer's voice with a note; no Gemini key = the computer's voice (as before). The REAL admin.html +
// articles-admin.js; fetch and Audio stubbed (nothing leaves the page).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => {
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase });
            // Gemini Interactions stub: records each request, answers with a tiny WAV (or a 400 for text containing FAIL)
            window.__tts = [];
            const realFetch = window.fetch;
            window.fetch = async (url, o) => {
                if (!/interactions/.test(String(url))) return realFetch(url, o);
                const body = JSON.parse(o.body); window.__tts.push({ key: o.headers['x-goog-api-key'], model: body.model, text: body.input[0].content[0].text, voice: body.generation_config.speech_config[0].voice });
                if (/FAIL/.test(body.input[0].content[0].text)) return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 400 });
                return new Response(JSON.stringify({ outputs: [{ type: 'audio', mime_type: 'audio/wav', data: btoa('RIFF0000WAVEfmt ') }] }), { status: 200 });
            };
            // Audio stub: "plays" for 60 ms
            window.__played = [];
            window.Audio = function (src) { this.src = src; this.play = () => { window.__played.push(src); setTimeout(() => this.onended && this.onended(), 60); return Promise.resolve(); }; this.pause = () => {}; };
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: null });
        });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');

        const open = (key) => page.evaluate((key) => {
            try { if (key) localStorage.setItem('ai_gemini_key', key); else localStorage.removeItem('ai_gemini_key'); } catch (e) { /* none */ }
            window.GEMINI_API_KEY = '';
            const S = Articles._S, now = Date.now();
            S.list = [{ id: 'a1', title: { th: 'บุสโคแพน', en: 'Buscopan' }, body: { th: 'เนื้อหา', en: 'Body' }, cover: { emoji: '💊' }, status: 'draft', startAt: now, endAt: now + 864e5,
                audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null,
                clip: { th: [{ w: 'q', t: 'หมอสั่ง Buscopan คู่ Motilium ต้านกันไหม' }, { w: 'rx', t: 'กลไกต้านกันจริง' }, { w: 'key', t: 'แยกเวลากิน' }] } }];
            S.loaded = true; S.loading = false; Articles.open(); Articles.edit('a1'); Articles.lang('th'); if (!S.clipOpen) Articles.clip(); else Articles.lang('th');
            window.__tts.length = 0; window.__played.length = 0;
            return document.querySelector('#art-body .clp-note').textContent;
        }, key);

        // 1. with a key: the note says AI voice; ▶ Play sends every line at once with the speaker's voice, then plays them in order
        let note = await open('AIza-test');
        assert.match(note, /AI voice \(Gemini TTS\)/);
        await page.evaluate(() => Articles.clipPlay());
        await page.waitForFunction(() => !Articles._S.clipPlaying, null, { timeout: 8000 });
        const r1 = await page.evaluate(() => ({ tts: window.__tts, played: window.__played.length }));
        assert.deepEqual(r1.tts.map(t => [t.voice, t.text, t.key, t.model]), [
            ['Kore', 'หมอสั่ง Buscopan คู่ Motilium ต้านกันไหม', 'AIza-test', 'gemini-3.8-flash-tts'],
            ['Puck', 'กลไกต้านกันจริง', 'AIza-test', 'gemini-3.8-flash-tts'],
            ['Puck', 'แยกเวลากิน', 'AIza-test', 'gemini-3.8-flash-tts']], 'one Gemini TTS request per line, 🙋 Kore · 🧑‍⚕️ / 💡 Puck: ' + JSON.stringify(r1.tts));
        assert.equal(r1.played, 3, 'each line plays, then the next');

        // 2. Play again: cached, no new request
        await page.evaluate(() => { window.__tts.length = 0; window.__played.length = 0; Articles.clipPlay(); });
        await page.waitForFunction(() => !Articles._S.clipPlaying, null, { timeout: 8000 });
        assert.deepEqual(await page.evaluate(() => [window.__tts.length, window.__played.length]), [0, 3], 'second Play reuses the audio');

        // 3. a line that fails → note + this computer's voice (timed here), the chat still finishes
        await page.evaluate(() => { const S = Articles._S; S.cur.clip.th[1].t = 'FAIL line'; window.__tts.length = 0; window.__played.length = 0; Articles.clipPlay(); });
        await page.waitForFunction(() => !Articles._S.clipPlaying, null, { timeout: 12000 });
        const r3 = await page.evaluate(() => ({ played: window.__played.length, err: Articles._S.clipVoiceErr }));
        assert.equal(r3.played, 2, 'the two good lines play');
        assert.match(r3.err, /AI voice: quota — this computer's voice instead/);

        // 4. no key → the computer's voice, no request
        note = await open('');
        assert.match(note, /This computer's voice — add a Gemini key/);
        await page.evaluate(() => Articles.clipPlay());
        await page.waitForTimeout(300);
        assert.deepEqual(await page.evaluate(() => [window.__tts.length, Articles._S.clipPlaying]), [0, true], 'no key: no Gemini call');
        await page.evaluate(() => Articles.clipStop());

        assert.deepEqual(errors.filter(e => !/ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: 🎬 Clip AI voice (V102.626) — Gemini TTS per line (Kore / Puck), all sent at once, played in order, cached on replay, a failed line falls back with a note, no key = computer voice');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
