// V102.353: Thai captions for Grand Line clips (owner's pick: a bottom band). The REAL public/clip-captions.js + admin.html:
// cue splitting (phrases first, word-safe, time ∝ length), the band follows the playhead, CC on/off is remembered,
// the result card and the gallery player carry CC + ⬇ MP4 + ซับ, and the export frame draws the band at the bottom.
// The recording itself (MediaRecorder on an H.264 clip) needs Google Chrome — it was run by hand on the owner's clip
// (720×1280 MP4 + AAC, 9 s); Playwright's bundled Chromium cannot decode H.264, so it is not part of this script.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<script src="clip-captions\.js\?v=V102\.\d+"><\/script>/.test(html), 'admin loads clip-captions.js');

// ---- cue splitting (node vm, no DOM needed)
const ctx = vm.createContext({ window: {}, document: { head: null }, Intl, localStorage: { getItem: () => null, setItem() {} } });
vm.runInContext(fs.readFileSync('public/clip-captions.js', 'utf8'), ctx);
const C = ctx.window.GlcCaptions;
const plain = x => JSON.parse(JSON.stringify(x));
const th = plain(C.cues('ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ', 8));
assert.deepEqual(th.map(c => c.text), ['ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', 'ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ'], 'cut at the space between phrases');
assert.equal(th[0].start, 0); assert.equal(th[th.length - 1].end, 8); assert.ok(th[0].end > 3 && th[0].end < 4.5, 'time ∝ length: ' + th[0].end);
assert.deepEqual(plain(C.cues('รู้จักกลไกยาแก้ท้องผูก Elobixibat', 8)).length, 1, 'a short caption is one cue');
assert.deepEqual(plain(C.cues('', 8)), [], 'no caption → no cues');
const long = plain(C.cues('ปกติร่างกายจะดูดน้ำดีกลับที่ปลายลำไส้เล็กยานี้ช่วยให้น้ำดีไหลไปถึงลำไส้ใหญ่มากขึ้นน้ำดีจะดึงน้ำเข้าลำไส้ทำให้อุจจาระนุ่ม', 8));
assert.ok(long.length >= 2 && long.every(c => c.text.length <= 46), 'a space-less run is cut word-safe into ≤ 46-char parts: ' + long.map(c => c.text.length));
assert.equal(long.map(c => c.text).join(''), 'ปกติร่างกายจะดูดน้ำดีกลับที่ปลายลำไส้เล็กยานี้ช่วยให้น้ำดีไหลไปถึงลำไส้ใหญ่มากขึ้นน้ำดีจะดึงน้ำเข้าลำไส้ทำให้อุจจาระนุ่ม', 'nothing lost or doubled');
assert.equal(C.cueAt(th, 1), th[0].text); assert.equal(C.cueAt(th, 6), th[1].text); assert.equal(C.cueAt(th, 9), '');
// V102.354: a voice is sped up only when longer than the clip, never past ×1.35
assert.equal(C.fitRate(7.8, 8), 1, 'a voice that fits plays at ×1');
assert.ok(Math.abs(C.fitRate(9.5, 8) - 9.5 / 7.85) < 1e-9, 'a slightly long voice is sped up just enough');
assert.equal(C.fitRate(20, 8), 1.35, 'never faster than ×1.35');
// V102.366: readings for the voice only · ≈ seconds · three voices (Kore by default)
assert.equal(C.speechText('Warfarin สามมิลลิกรัม INR สองถึงสาม', 'Warfarin=วอร์ฟาริน, INR = ไอเอ็นอาร์'), 'วอร์ฟาริน สามมิลลิกรัม ไอเอ็นอาร์ สองถึงสาม', 'readings replace the English names in the spoken text only');
assert.equal(C.speechText('ทานยา Elobixibat', ''), 'ทานยา Elobixibat', 'no readings → unchanged');
assert.equal(C.speechText('warfarin 3 mg', 'Warfarin=วอร์ฟาริน'), 'วอร์ฟาริน 3 mg', 'case does not matter');
assert.ok(Math.abs(C.estimate('ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ') - 7.8) < 0.4, '≈ 10.5 characters a second (7.8 s measured for 84 characters): ' + C.estimate('ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ'));
assert.equal(C.estimate(''), 0);
assert.deepEqual(plain(C.VOICES.map(v => v.id)), ['Kore', 'Charon', 'Achird']); assert.equal(C.voiceName(), 'Kore', 'nothing remembered → Kore');
const VOICE_B64 = fs.readFileSync('scripts/fixtures/thai-voice-sample.mp3').toString('base64');   // real Gemini TTS output, 7.8 s

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/fonts\.googleapis/.test(u)) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => window.GlcCaptions && typeof window.glcShowClip === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        // ---- the band follows the playhead; CC toggles it and is remembered
        const band = await page.evaluate(() => {
            localStorage.removeItem('glc_cc');
            const handlers = {}, video = { currentTime: 0, addEventListener: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); } };
            const fire = ev => (handlers[ev] || []).forEach(fn => fn());
            const b = document.createElement('div'), btn = document.createElement('button');
            document.body.append(b, btn);
            const list = GlcCaptions.cues('ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ', 8);
            GlcCaptions.attach(video, b, list, btn);
            const out = { t0: b.textContent, btnOn: btn.classList.contains('on') };
            video.currentTime = 6; fire('timeupdate'); out.t6 = b.textContent;
            btn.click(); out.off = [b.hidden, b.textContent, localStorage.getItem('glc_cc'), btn.getAttribute('aria-pressed')];
            btn.click(); out.on = [b.hidden, b.textContent, localStorage.getItem('glc_cc')];
            video.currentTime = 8.5; fire('timeupdate'); out.after = [b.hidden, b.textContent];
            b.remove(); btn.remove();
            return out;
        });
        assert.deepEqual([band.t0, band.btnOn], ['ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', true], 'starts on with the first cue');
        assert.equal(band.t6, 'ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ', 'follows the playhead');
        assert.deepEqual(band.off, [true, '', '0', 'false'], 'CC off hides it and is remembered');
        assert.deepEqual(band.on, [false, 'ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ', '1'], 'CC on brings it back');
        assert.deepEqual(band.after, [true, ''], 'past the last cue: nothing');

        // ---- the result card: band + CC + ⬇ MP4 + ซับ only when the episode has a Thai caption
        const card = await page.evaluate(() => {
            const v = document.getElementById('hub-view-design');
            for (let a = v; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', a === v ? 'flex' : 'block', 'important');
            window._glcSeries = { id: 'S1', episodes: [{ n: 1, title: 'T', captionTh: 'ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', status: 'done', costUsd: 0.4, clipUrl: 'https://x/a.mp4' }, { n: 2, title: 'U', status: 'done', costUsd: 0.4 }] };
            window._glcClips = { 1: { n: 1, dataUrl: 'data:video/mp4;base64,AAAA', seconds: 8, model: 'google/veo-3.1-lite', ms: 70000 }, 2: { n: 2, dataUrl: 'data:video/mp4;base64,AAAA', seconds: 8, model: 'google/veo-3.1-lite', ms: 70000 } };
            glcShowClip(1);
            const q = s => document.querySelector('#design-preview-container ' + s);
            const out = { wrap: !!q('.glc-vwrap #generated-clip'), band: q('#glc-cc-band') && q('#glc-cc-band').textContent, cc: q('#glc-cc-btn') && q('#glc-cc-btn').textContent, voice: q('#glc-voice-btn') && q('#glc-voice-btn').textContent, burn: q('#glc-burn-btn') && q('#glc-burn-btn').textContent, st: !!q('#glc-burn-st'),
                bandPos: (() => { const b = q('#glc-cc-band'), w = q('.glc-vwrap'); if (!b || !w) return null; const rb = b.getBoundingClientRect(), rw = w.getBoundingClientRect(); return Math.round(rw.bottom - rb.bottom); })() };
            glcShowClip(2);
            out.noCaption = [!!q('#glc-cc-btn'), !!q('#glc-burn-btn'), !!q('#glc-cc-band'), !!q('#glc-voice-btn')];
            glcShowClip(1);
            return out;
        });
        assert.deepEqual([card.wrap, card.band, card.cc, card.voice, card.burn, card.st], [true, 'ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', 'CC ไทย', '🔊 เสียงไทย', '⬇ MP4 + ซับ', true], 'card: band over the player, CC, 🔊 เสียงไทย, ⬇ MP4 + ซับ');
        assert.ok(card.bandPos >= 40 && card.bandPos <= 70, 'band sits above the player controls: ' + card.bandPos);
        assert.deepEqual(card.noCaption, [false, false, true, false], 'no Thai caption → no CC / 🔊 / ⬇ MP4 + ซับ buttons (the band stays empty)');
const rail = await page.evaluate(() => [...document.querySelectorAll('#glc-voice-rail .glc-vchip')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')));
        assert.deepEqual(rail, ['Kore:true', 'Charon:false', 'Achird:false'], 'V102.366: three voice chips beside 🔊, Kore picked');

        // ---- V102.354: 🔊 Thai voice on the card — one cloud_tts call (th-TH, the caption), clip muted, export gets + 🔊; off again
        const voice = await page.evaluate(async b64 => {
            const calls = [];
            window.callTtsProxy = async p => { calls.push(p); return { audioContent: b64, mimeType: 'audio/mpeg' }; };
            const q = id => document.getElementById(id);
            const v = q('generated-clip'), btn = q('glc-voice-btn');
            btn.click();
            for (let i = 0; i < 60 && !btn.classList.contains('on'); i++) await new Promise(r => setTimeout(r, 50));
            const on = { on: btn.classList.contains('on'), pressed: btn.getAttribute('aria-pressed'), muted: v.muted, burn: q('glc-burn-btn').textContent, st: q('glc-burn-st').textContent };
            btn.click();
            const off = { on: btn.classList.contains('on'), muted: v.muted, burn: q('glc-burn-btn').textContent, st: q('glc-burn-st').textContent };
            btn.click();
            for (let i = 0; i < 60 && !btn.classList.contains('on'); i++) await new Promise(r => setTimeout(r, 50));
            return { calls: calls.map(c => ({ provider: c.provider, model: c.model, lang: c.ttsConfig.voice.languageCode, name: c.ttsConfig.voice.name, text: c.ttsConfig.input.text, enc: c.ttsConfig.audioConfig.audioEncoding })), on, off, again: btn.classList.contains('on') };
        }, VOICE_B64);
        assert.deepEqual(voice.calls, [{ provider: 'cloud_tts', model: 'gemini-2.5-flash-tts', lang: 'th-TH', name: 'Kore', text: 'ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', enc: 'MP3' }], 'one Cloud TTS call with the Thai caption (the second "on" reuses it)');
        assert.deepEqual([voice.on.on, voice.on.pressed, voice.on.muted, voice.on.burn], [true, 'true', true, '⬇ MP4 + ซับ + 🔊'], 'voice on: the clip is muted, the export carries the voice');
        assert.match(voice.on.st, /^🔊 Thai voice 7\.8 s · Kore$/, 'status says how long the voice is and which voice (V102.366): ' + voice.on.st);
        assert.deepEqual([voice.off.on, voice.off.muted, voice.off.burn, voice.off.st], [false, false, '⬇ MP4 + ซับ', ''], 'voice off: the clip\'s own audio is back');
        assert.equal(voice.again, true, 'on again (cached, no second call)');

        // ---- V102.366: pick Charon while the voice is on → made again with Charon (one call), remembered; readings reach the voice only
        const pick = await page.evaluate(async b64 => {
            const calls = [];
            window.callTtsProxy = async p => { calls.push(p); return { audioContent: b64, mimeType: 'audio/mpeg' }; };
            const q = id => document.getElementById(id), btn = q('glc-voice-btn');
            q('glc-voice-rail').querySelector('[data-v="Charon"]').click();
            for (let i = 0; i < 80 && !(btn.classList.contains('on') && /Charon/.test(q('glc-burn-st').textContent)); i++) await new Promise(r => setTimeout(r, 50));
            const out = { charon: [calls.length, calls[0] && calls[0].ttsConfig.voice.name, q('glc-burn-st').textContent, localStorage.getItem('glc_voice'), [...q('glc-voice-rail').querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.v)] };
            window._glcSeries.episodes[0].readingTh = 'Elobixibat=อีโลบิซิแบต';
            glcShowClip(1);
            const b2 = q('glc-voice-btn'); b2.click();
            for (let i = 0; i < 80 && !b2.classList.contains('on'); i++) await new Promise(r => setTimeout(r, 50));
            out.reading = [calls.length, calls[1] && calls[1].ttsConfig.input.text, calls[1] && calls[1].ttsConfig.voice.name, q('glc-cc-band').textContent, /ทับศัพท์/.test(calls[1] && calls[1].ttsConfig.input.prompt)];
            localStorage.removeItem('glc_voice');
            return out;
        }, VOICE_B64);
        assert.deepEqual(pick.charon, [1, 'Charon', '🔊 Thai voice 7.8 s · Charon', 'Charon', ['Charon']], 'picking a voice while on makes it again with that voice and remembers it: ' + JSON.stringify(pick.charon));
        assert.deepEqual(pick.reading, [2, 'ทานยา อีโลบิซิแบต วันละครั้งก่อนอาหารเช้า', 'Charon', 'ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', true], 'readings go to the voice only; the prompt says how to read English names: ' + JSON.stringify(pick.reading));

        // ---- V102.366: ✏️ shows ≈ seconds under the Thai caption, amber when even ×1.35 cannot fit the clip; the readings field sits beside it
        const edit = await page.evaluate(() => {
            glcRenderEpisodes();
            glcToggleEdit(1);
            const row = document.getElementById('glc-ep-1'), inp = row.querySelector('[data-f="captionTh"]'), cnt = row.querySelector('.glc-cap-count'), rd = row.querySelector('[data-f="readingTh"]');
            const fire = () => inp.dispatchEvent(new Event('input', { bubbles: true }));
            const out = { init: cnt.textContent, warn0: cnt.classList.contains('warn'), readingField: !!rd && /Warfarin=วอร์ฟาริน/.test(rd.placeholder), readingValue: rd && rd.value };
            inp.value = 'ก'.repeat(130); fire(); out.long = [cnt.textContent, cnt.classList.contains('warn')];
            inp.value = 'ก'.repeat(90); fire(); out.mid = [cnt.textContent, cnt.classList.contains('warn')];
            inp.value = ''; fire(); out.empty = cnt.textContent;
            glcToggleEdit(1);
            return out;
        });
        assert.match(edit.init, /^🔊 ≈ 3\.6 s \(38 ตัวอักษร\) · คลิป 8 s — พอดี$/, 'the counter opens with the caption: ' + edit.init); assert.equal(edit.warn0, false);
        assert.deepEqual([edit.readingField, edit.readingValue], [true, 'Elobixibat=อีโลบิซิแบต'], 'the readings field carries the episode value');
        assert.ok(/^🔊 ≈ 12\.4 s \(130 ตัวอักษร\) · คลิป 8 s — ยาวเกิน 10\.8 s แม้เร่ง ×1\.35/.test(edit.long[0]) && edit.long[1] === true, 'too long even at ×1.35 → amber: ' + edit.long[0]);
        assert.ok(/^🔊 ≈ 8\.6 s \(90 ตัวอักษร\) · คลิป 8 s — จะเร่ง ×1\.10$/.test(edit.mid[0]) && edit.mid[1] === false, 'a little long → says the rate: ' + edit.mid[0]);
        assert.equal(edit.empty, '', 'empty caption → no counter');

        // ---- the export frame: the band is drawn at the bottom, ≤ 2 lines
        const frame = await page.evaluate(() => {
            const src = document.createElement('canvas'); src.width = 720; src.height = 1280; const s = src.getContext('2d'); s.fillStyle = '#e2e8f0'; s.fillRect(0, 0, 720, 1280);
            const c = document.createElement('canvas'); c.width = 720; c.height = 1280; const g = c.getContext('2d');
            const r = GlcCaptions.drawFrame(g, src, 720, 1280, 'ช่วยให้น้ำดีกระตุ้นการขับถ่ายอย่างเป็นธรรมชาติ');
            const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
            return { lines: r.lines.length, bottomGap: 1280 - (r.y0 + r.bandH), bandPx: px(8, r.y0 + 4), topPx: px(8, 8), none: GlcCaptions.drawFrame(g, src, 720, 1280, '') };
        });
        assert.ok(frame.lines >= 1 && frame.lines <= 2, 'at most 2 lines: ' + frame.lines);
        assert.ok(Math.abs(frame.bottomGap - Math.round(1280 * 0.09)) <= 2, 'band ~9% above the bottom edge: ' + frame.bottomGap);
        assert.ok(frame.bandPx[0] < 120 && frame.topPx[0] > 200, 'band is dark over the picture, the picture elsewhere untouched: ' + frame.bandPx + ' / ' + frame.topPx);
        assert.equal(frame.none, null, 'no text → picture only');

        // ---- the gallery's ▶: in-app player with band + CC + ⬇ MP4 + ซับ; ctrl-click keeps the new tab
        const pl = await page.evaluate(() => {
            window._mgwGalleryRendered = [{ type: 'clip', id: 'S1#1', seriesId: 'S1', n: 1, name: 'EP01 · T', url: 'https://storage.test/EP01.mp4', caption: 'ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', seconds: 8 }];
            const keepTab = mgwPlayClip({ ctrlKey: true }, 0);
            const r = mgwPlayClip({}, 0);
            const m = document.getElementById('glc-player');
            const out = { keepTab, r, shown: !!m && !m.hidden, src: m.querySelector('video').getAttribute('src'), name: m.querySelector('.glc-player-hd b').textContent, cc: !!m.querySelector('.glc-cc'), voice: !!m.querySelector('.glc-voice'), burn: !!m.querySelector('.glc-burn'), band: m.querySelector('.glc-cc-band').textContent };
            m.querySelector('.x').click(); out.closed = m.hidden;
            return out;
        });
        assert.deepEqual([pl.keepTab, pl.r, pl.shown], [true, false, true], '▶ opens the in-app player (ctrl-click keeps the new tab)');
        assert.deepEqual([pl.src, pl.name, pl.cc, pl.voice, pl.burn, pl.band, pl.closed], ['https://storage.test/EP01.mp4', 'EP01 · T', true, true, true, 'ทานยา Elobixibat วันละครั้งก่อนอาหารเช้า', true], 'player: the clip, its name, CC, 🔊, ⬇ MP4 + ซับ, the band; ✕ closes');

        assert.deepEqual(errs, []);
        console.log('PASS: Thai captions + 🔊 Thai voice (one cached cloud_tts call, clip muted, export + 🔊, ×1.35 cap; V102.366: voice chips, readings for the voice, ≈ s counter in ✏️) — phrase-first cues (word-safe, ≤ 46 chars, time ∝ length), band follows the playhead, CC remembered, card + gallery player carry CC + ⬇ MP4 + ซับ, export frame band at the bottom (≤ 2 lines)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
