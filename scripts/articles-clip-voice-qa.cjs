// V102.626 (owner: "ยังไม่มีเสียงไทย") — 📰 Articles ▸ 🎬 Clip ▸ ▶ Play speaks each line with an AI voice, all requests sent at once, the chat steps on when
// each line's audio ends, a replay reuses the cache.
// V102.636 (owner pick C+): the language picks the voice — a Thai clip = iApp Chinda through callAIProxy (iapp_tts: 🙋 ไข่มุก friendly · 🧑‍⚕️ / 💡 ไข่ต้ม calm),
// EN / KO = Gemini TTS as before (🙋 Kore · 🧑‍⚕️ / 💡 Puck). Two chips under ▶: tap = next voice of that family (remembered per article + as the next start),
// hold = hear that side's first line; the speaking side's chip pulses; Chinda fails → Gemini goes on with one line saying so → this computer's voice;
// ▶'s hover = ≈ IC · characters.
// V102.639 (owner pick 1 + A): lines in a row by one speaker (🧑‍⚕️ + 💡 = one voice) are ONE request; a Thai clip's English words get a Thai reading
// once (AI, kept on the article as clipReading) that only the voice uses; 🔤 n shows / fixes them (a fixed one is marked e).
// The REAL admin.html + articles-admin.js; callTtsProxy, callUniversalAI, fetch and Audio stubbed (nothing leaves the page).
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
                if (/GEMFAIL/.test(body.input[0].content[0].text)) return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 400 });
                return new Response(JSON.stringify({ outputs: [{ type: 'audio', mime_type: 'audio/wav', data: btoa('RIFF0000WAVEfmt ') }] }), { status: 200 });
            };
            // Audio stub: "plays" for 60 ms
            window.__played = [];
            window.Audio = function (src) { this.src = src; this.play = () => { window.__played.push(src); setTimeout(() => this.onended && this.onended(), 60); return Promise.resolve(); }; this.pause = () => {}; };
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: null });
        });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');
        // the proxy (iapp_tts) stub: records each request; text with CHINDAFAIL → a 502
        await page.evaluate(() => {
            window.__chinda = [];
            window.__readAsk = [];
            window.callUniversalAI = async (model, prompt, json, v, s2, o) => { window.__readAsk.push([o && o.feature, (prompt.match(/WORDS: (.*)$/m) || [])[1]]); return { text: JSON.stringify({ Buscopan: 'บุสโคแพน', Motilium: 'โมทีเลียม' }) }; };
            window.callTtsProxy = async (p) => { window.__chinda.push(p); if (/CHINDAFAIL/.test(p.text)) throw new Error('iapp_tts proxy failed with status 502'); return { audioContent: btoa('ID3mp3'), mimeType: 'audio/mpeg', provider: 'iapp_tts' }; };
            try { Object.keys(localStorage).filter(k => /^clp_v_/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* none */ }
        });

        const open = (key, lang) => page.evaluate(([key, lang]) => {
            try { if (key) localStorage.setItem('ai_gemini_key', key); else localStorage.removeItem('ai_gemini_key'); } catch (e) { /* none */ }
            window.GEMINI_API_KEY = '';
            const S = Articles._S, now = Date.now();
            S.list = [{ id: 'a1', title: { th: 'บุสโคแพน', en: 'Buscopan' }, body: { th: 'เนื้อหา', en: 'Body' }, cover: { emoji: '💊' }, status: 'draft', startAt: now, endAt: now + 864e5,
                audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null,
                clip: { th: [{ w: 'q', t: 'หมอสั่ง Buscopan คู่ Motilium ต้านกันไหม' }, { w: 'rx', t: 'กลไกต้านกันจริง' }, { w: 'key', t: 'แยกเวลากิน' }],
                        en: [{ w: 'q', t: 'Buscopan with Motilium?' }, { w: 'rx', t: 'They work against each other.' }] } }];
            S.loaded = true; S.loading = false; Articles.open(); Articles.edit('a1'); Articles.lang(lang); if (!S.clipOpen) Articles.clip(); else Articles.lang(lang);
            window.__tts.length = 0; window.__played.length = 0; window.__chinda.length = 0;
            return document.querySelector('#art-body .clp-note').textContent;
        }, [key, lang]);
        const chips = () => page.$$eval('#art-body .clp-vc:not(.rd)', bs => bs.map(b => b.className.replace('clp-vc ', '') + ':' + b.textContent));
        const play = async () => { await page.evaluate(() => { window.__tts.length = 0; window.__played.length = 0; window.__chinda.length = 0; Articles.clipPlay(); }); await page.waitForFunction(() => !Articles._S.clipPlaying, null, { timeout: 12000 }); };

        // 1. Thai clip: Chinda through the proxy, no engine words on screen, two chips, ▶ hover = ≈ IC · characters
        let note = await open('AIza-test', 'th');
        assert.doesNotMatch(note, /Gemini|Chinda|AI voice/, 'the note does not name the voice: ' + note);
        assert.deepEqual(await chips(), ['th:🙋 ไข่มุก', 'th:🧑‍⚕️ ไข่ต้ม']);
        assert.match(await page.$eval('#art-body .clp-go', b => b.title), /^Plays the chat in the Thai voice · ≈ 0\.06 IC · \d+ characters$/);
        await page.evaluate(() => { window.__talk = 0; const t = setInterval(() => { if (document.querySelector('#art-body .clp-vc.talk')) window.__talk++; if (!Articles._S.clipPlaying) clearInterval(t); }, 10); });
        await play();
        assert.deepEqual(await page.evaluate(() => window.__chinda.map(p => [p.provider, p.voice, p.style, p.text])), [
            ['iapp_tts', 'kaimook', 'friendly', 'หมอสั่ง บุสโคแพน คู่ โมทีเลียม ต้านกันไหม'],
            ['iapp_tts', 'kaitom', 'calm', 'กลไกต้านกันจริง แยกเวลากิน']], 'V102.639: 🧑‍⚕️ + 💡 in a row = ONE request; English words read in Thai');
        assert.deepEqual(await page.evaluate(() => [window.__tts.length, window.__played.length]), [0, 2], 'no Gemini call; each group plays');
        assert.deepEqual(await page.evaluate(() => window.__readAsk), [['clip_reading', 'Buscopan, Motilium']], 'one reading call for the clip\'s English words');
        assert.deepEqual(await page.evaluate(() => Articles._S.cur.clipReading), { Buscopan: { r: 'บุสโคแพน' }, Motilium: { r: 'โมทีเลียม' } }, 'kept on the article');
        assert.equal(await page.$eval('#art-body .clp-vc.rd', b => b.textContent), '🔤 2');
        assert.match(await page.$eval('#art-body .clp-m.q', e => e.textContent), /Buscopan/, 'the caption keeps English');
        assert.ok(await page.evaluate(() => window.__talk) > 0, 'the speaking side\'s chip pulses while playing');

        // 2. Play again: cached
        await play();
        assert.deepEqual(await page.evaluate(() => [window.__chinda.length, window.__played.length, window.__readAsk.length]), [0, 2, 1], 'replay reuses the audio and the readings');

        // 3. Chinda fails on a line → Gemini (Puck) reads it, the clip goes on, one line says so
        await page.evaluate(() => { Articles._S.cur.clip.th[1].t = 'CHINDAFAIL line'; });
        await play();
        assert.deepEqual(await page.evaluate(() => [window.__chinda.length, window.__tts.map(t => t.voice + ':' + t.text), window.__played.length, Articles._S.clipVoiceErr]),
            [1, ['Puck:CHINDAFAIL line แยกเวลากิน'], 2, '🔊 Thai voice failed — Gemini instead']);
        assert.match(await page.$eval('#art-body .clp-note', n => n.textContent), /Thai voice failed — Gemini instead/);

        // 3b. Chinda fails and no Gemini key → this computer's voice for that line (timed here)
        await open('', 'th');
        await page.evaluate(() => { Articles._S.cur.clip.th[1].t = 'CHINDAFAIL again'; });
        await play();
        assert.deepEqual(await page.evaluate(() => [window.__tts.length, window.__played.length]), [0, 1], 'no key: the failed group is not sent to Gemini');
        assert.match(await page.evaluate(() => Articles._S.clipVoiceErr), /502 — this computer's voice instead/);
        await page.evaluate(() => { Articles._S.cur.clip.th[1].t = 'กลไกต้านกันจริง'; });

        // 3c. 🔤 → fix Motilium → the next Play says it; the word is marked as fixed and saved with the article
        const asked = await page.evaluate(() => window.__readAsk.length);
        await page.click('#art-body .clp-vc.rd');
        await page.fill('#art-body .clp-rd input[data-k="Motilium"]', 'โมติเลียม'); await page.press('#art-body .clp-rd input[data-k="Motilium"]', 'Tab');
        assert.deepEqual(await page.evaluate(() => Articles._S.cur.clipReading.Motilium), { r: 'โมติเลียม', e: true });
        await play();
        assert.match(await page.evaluate(() => window.__chinda[0].text), /โมติเลียม/);
        if (process.env.OUTDIR) { const pv = await page.$('#art-body .art-clip'); if (pv) await pv.screenshot({ path: process.env.OUTDIR + '/clip-reading.png' }); }
        assert.equal(await page.evaluate(() => window.__readAsk.length), asked, 'no new reading call: every word has one (a word with no Thai reading is kept as written)');

        // 4. tap 🙋 → ไข่ต้ม → ไข่แดง: remembered for this article and as the next Thai start; the next Play uses it
        await page.click('#art-body .clp-vc[data-w="q"]'); await page.click('#art-body .clp-vc[data-w="q"]');
        assert.deepEqual(await chips(), ['th:🙋 ไข่แดง', 'th:🧑‍⚕️ ไข่ต้ม']);
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('clp_v_th_a1'), localStorage.getItem('clp_v_th')]), ['{"q":"kaidang","rx":"kaitom"}', '{"q":"kaidang","rx":"kaitom"}']);
        await play();
        assert.equal(await page.evaluate(() => window.__chinda[0].voice), 'kaidang');
        await page.click('#art-body .clp-vc[data-w="q"]');
        assert.deepEqual(await chips(), ['th:🙋 ไข่มุก', 'th:🧑‍⚕️ ไข่ต้ม'], 'back round to the first');

        // 5. hold 🧑‍⚕️ ≈ 0.8 s → hear its first line only (the clip does not start); the click after the hold changes nothing
        await page.evaluate(() => { window.__chinda.length = 0; window.__played.length = 0; });
        const b = await page.$('#art-body .clp-vc[data-w="rx"]'), box = await b.boundingBox();
        await page.mouse.move(box.x + 10, box.y + 8); await page.mouse.down(); await page.waitForTimeout(950); await page.mouse.up();
        await page.waitForFunction(() => !Articles._S.clipHear);
        assert.deepEqual(await page.evaluate(() => [window.__played.length, Articles._S.clipPlaying || false]), [1, false], 'one line heard, no clip');
        assert.deepEqual(await chips(), ['th:🙋 ไข่มุก', 'th:🧑‍⚕️ ไข่ต้ม'], 'the hold did not switch the voice');

        // 6. keyboard: Tab to a chip, Space = next voice
        await page.waitForTimeout(1600);   // past the hold's click guard
        await page.focus('#art-body .clp-vc[data-w="rx"]'); await page.keyboard.press('Space');
        assert.deepEqual(await chips(), ['th:🙋 ไข่มุก', 'th:🧑‍⚕️ ไข่แดง']);

        // 7. English clip: Gemini as before (violet chips, Kore / Puck); no key → the computer's voice
        await open('AIza-test', 'en');
        assert.deepEqual(await chips(), ['gm:🙋 Kore', 'gm:🧑‍⚕️ Puck']);
        assert.equal(await page.$eval('#art-body .clp-go', b => b.title), 'Plays the chat and reads each line aloud');
        await play();
        assert.deepEqual(await page.evaluate(() => [window.__chinda.length, window.__tts.map(t => [t.voice, t.key, t.model])]), [0, [['Kore', 'AIza-test', 'gemini-3.8-flash-tts'], ['Puck', 'AIza-test', 'gemini-3.8-flash-tts']]]);
        note = await open('', 'en');
        assert.match(note, /This computer's voice — add a Gemini key/);
        await page.evaluate(() => Articles.clipPlay());
        await page.waitForTimeout(300);
        assert.deepEqual(await page.evaluate(() => [window.__tts.length, window.__chinda.length, Articles._S.clipPlaying]), [0, 0, true], 'no key: no AI call');
        await page.evaluate(() => Articles.clipStop());

        if (process.env.OUTDIR) { await open('AIza-test', 'th'); const pv = await page.$('#art-body .art-clip'); if (pv) await pv.screenshot({ path: process.env.OUTDIR + '/clip-voice-cplus.png' }); }
        assert.deepEqual(errors.filter(e => !/ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: 🎬 Clip voice C+ (V102.636) — TH = Chinda via iapp_tts (ไข่มุก friendly / ไข่ต้ม calm), EN = Gemini (Kore / Puck), tap = next voice remembered, hold = hear one line, pulse while speaking, Chinda fail → Gemini → computer voice, ≈ IC on ▶ hover, cached replay');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
