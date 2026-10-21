// V102.353 · Thai captions for Grand Line clips (owner's pick: a bottom band, mockup 2026-10-21).
// One caption text per episode (the episode's Thai caption, editable in ✏️ — no re-render) is cut into 1–2-line
// chunks timed across the clip. In the app the band follows the player (CC on/off, remembered); "⬇ MP4 + ซับ" burns
// the same band into a new file in the browser: the clip plays once into a canvas (+ its own audio), MediaRecorder
// writes MP4 where the browser can, WebM otherwise. Nothing is uploaded; the saved clip is untouched.
// V102.354 · 🔊 Thai voice: Gemini TTS (the proxy's cloud_tts — Google Cloud Text-to-Speech, th-TH) reads the same Thai
// caption; it replaces the clip's own audio in the app (in sync with the player) and in the export. A voice longer than
// the clip is sped up to ×1.35 at most (pitch kept); the caption cues follow the voice's length.
(function () {
    'use strict';
    const CC_KEY = 'glc_cc';
    const MAX_CHARS = 46;            // ≈ two lines on a 9:16 frame (the band shrinks its font if not)
    const FONT = 'Sarabun, "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif';
    let fontLink = null;

    function ensureFont() {
        if (!fontLink && typeof document !== 'undefined' && document.head) {
            fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@600&display=swap';
            document.head.appendChild(fontLink);
        }
        return document.fonts && document.fonts.load ? document.fonts.load('600 40px Sarabun').catch(() => null) : Promise.resolve();
    }

    // words that may not be split (Thai has no spaces between words — the browser's segmenter finds them)
    function pieces(text) {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (!t) return [];
        if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(t), s => s.segment);
        return t.split(/(\s+)/);
    }

    // a phrase longer than MAX_CHARS → about-equal parts, cut only between words
    function splitPhrase(phrase) {
        if (phrase.length <= MAX_CHARS) return [phrase];
        const words = pieces(phrase), n = Math.ceil(phrase.length / MAX_CHARS), target = phrase.length / n, out = [];
        let cur = '';
        words.forEach(w => { if (cur && (cur + w).length > target) { out.push(cur); cur = w; } else cur += w; });
        if (cur) out.push(cur);
        return out;
    }
    // [{start, end, text}] across `seconds`: cut at the spaces between phrases first (Thai writes a space there),
    // a too-long phrase in about-equal word-safe parts; each chunk ≤ MAX_CHARS where a word allows; time ∝ length
    function cues(text, seconds) {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (!t) return [];
        const phrases = [].concat(...t.split(' ').map(splitPhrase));
        const chunks = [];
        let cur = '';
        phrases.forEach(p => {
            const next = cur ? cur + ' ' + p : p;
            if (next.length > MAX_CHARS && cur) { chunks.push(cur); cur = p; }
            else cur = next;
        });
        if (cur) chunks.push(cur);
        const dur = Math.max(1, Number(seconds) || 8), total = chunks.reduce((a, c) => a + c.length, 0);
        let at = 0;
        return chunks.map((c, i) => {
            const start = at, end = i === chunks.length - 1 ? dur : at + dur * c.length / total;
            at = end;
            return { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text: c };
        });
    }
    const cueAt = (list, t) => { const c = (list || []).find(x => t >= x.start && t < x.end); return c ? c.text : ''; };

    function ccOn() { try { return localStorage.getItem(CC_KEY) !== '0'; } catch (e) { return true; } }
    function setCc(on) { try { localStorage.setItem(CC_KEY, on ? '1' : '0'); } catch (e) {} }

    // the in-app band: follows the player; CC toggles it (remembered)
    function attach(video, band, list, ccBtn) {
        if (!video || !band) return null;
        const get = typeof list === 'function' ? list : () => list;
        const paint = () => { const t = ccOn() ? cueAt(get(), video.currentTime || 0) : ''; band.textContent = t; band.hidden = !t; };
        ['timeupdate', 'seeked', 'loadedmetadata', 'play'].forEach(ev => video.addEventListener(ev, paint));
        if (ccBtn) {
            const mark = () => { const on = ccOn(); ccBtn.classList.toggle('on', on); ccBtn.setAttribute('aria-pressed', String(on)); };
            ccBtn.onclick = () => { setCc(!ccOn()); mark(); paint(); };
            mark();
        }
        paint();
        return { paint };
    }

    // wrap lines inside `maxW` without splitting a word
    function wrap(g, text, maxW) {
        const lines = [];
        let cur = '';
        pieces(text).forEach(p => {
            const next = cur + p;
            if (g.measureText(next.trim()).width > maxW && cur.trim()) { lines.push(cur.trim()); cur = p.trimStart(); }
            else cur = next;
        });
        if (cur.trim()) lines.push(cur.trim());
        return lines;
    }
    // one frame: the picture, then the bottom band (dark, white Sarabun, ≤ 2 lines, ~9% above the bottom edge)
    function drawFrame(g, src, W, H, text) {
        g.drawImage(src, 0, 0, W, H);
        if (!text) return null;
        let size = Math.round(H * 0.033), lines;
        for (let k = 0; k < 3; k++) {
            g.font = '600 ' + size + 'px ' + FONT;
            lines = wrap(g, text, W * 0.88);
            if (lines.length <= 2) break;
            size = Math.round(size * 0.86);
        }
        const lh = Math.round(size * 1.45), pad = Math.round(size * 0.55), bandH = lines.length * lh + pad * 2, y0 = Math.round(H - H * 0.09 - bandH);
        g.fillStyle = 'rgba(15,23,42,0.72)';
        g.fillRect(0, y0, W, bandH);
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        lines.forEach((l, i) => g.fillText(l, W / 2, y0 + pad + lh / 2 + i * lh));
        return { lines, size, y0, bandH };
    }

    function recType() {
        if (typeof MediaRecorder === 'undefined') return null;
        const want = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
        return want.find(t => MediaRecorder.isTypeSupported(t)) || '';
    }

    // ⬇ MP4 + ซับ: play the clip once into a canvas with the band, record it with the clip's own audio — or, with
    // `voice` ({url, rate}), with the Thai voice instead
    async function burn(src, list, fileBase, onProgress, voice) {
        if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record video — try Chrome or Edge on a computer');
        let url = src, made = null;
        if (!/^(data|blob):/.test(String(src))) {   // a Storage URL: same-origin blob, so the canvas is not tainted
            const r = await fetch(src);
            if (!r.ok) throw new Error('Could not read the clip (' + r.status + ')');
            url = made = URL.createObjectURL(await r.blob());
        }
        await ensureFont();
        const v = document.createElement('video');
        v.src = url; v.playsInline = true; v.preload = 'auto';
        await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('Could not open the clip')); });
        const W = v.videoWidth || 720, H = v.videoHeight || 1280;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const g = canvas.getContext('2d');
        const stream = canvas.captureStream(30);
        let ac = null, va = null;
        if (voice && voice.url) {
            va = new Audio(); va.src = voice.url; va.preload = 'auto'; va.playbackRate = voice.rate || 1; va.preservesPitch = true;
            await new Promise((res, rej) => { va.onloadedmetadata = res; va.onerror = () => rej(new Error('Could not read the Thai voice')); });
        }
        try {   // the chosen audio goes to the recording only (not the speakers)
            ac = new (window.AudioContext || window.webkitAudioContext)();
            const dest = ac.createMediaStreamDestination();
            ac.createMediaElementSource(va || v).connect(dest);
            dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (e) { ac = null; }
        if (va) v.muted = true;
        const type = recType();
        const rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 6000000 }, type ? { mimeType: type } : {}));
        const parts = [];
        rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
        const stopped = new Promise(r => { rec.onstop = r; });
        const step = () => {
            drawFrame(g, v, W, H, cueAt(list, v.currentTime));
            if (onProgress) onProgress(v.currentTime, v.duration || 0);
            if (!v.ended) (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(step) : requestAnimationFrame(step));
        };
        drawFrame(g, v, W, H, cueAt(list, 0));
        rec.start(250);
        await v.play();
        if (va) va.play().catch(() => {});
        step();
        await new Promise(r => { v.onended = r; });
        drawFrame(g, v, W, H, cueAt(list, (v.duration || 0) - 0.01));
        await new Promise(r => setTimeout(r, 120));
        rec.stop();
        await stopped;
        if (va) va.pause();
        if (ac) ac.close().catch(() => {});
        if (made) URL.revokeObjectURL(made);
        const blob = new Blob(parts, { type: (rec.mimeType || type || 'video/webm').split(';')[0] });
        const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (fileBase || 'clip') + (voice ? '-th-voice.' : '-th.') + ext;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return { ext, size: blob.size, width: W, height: H };
    }

    // ---- 🔊 Thai voice: Gemini TTS through the proxy's cloud_tts (server-side, admin-only), cached per caption text
    const VOICE = { model: 'gemini-2.5-flash-tts', name: 'Kore', prompt: 'อ่านด้วยน้ำเสียงอบอุ่น เป็นกันเอง ชัดเจน แบบเภสัชกรอธิบายผู้ป่วย จังหวะกระชับ' };
    const MAX_RATE = 1.35;
    const voiceCache = new Map();
    function makeVoice(text) {
        const key = String(text || '').trim();
        if (!key) return Promise.reject(new Error('No Thai caption to read'));
        if (voiceCache.has(key)) return voiceCache.get(key);
        const p = (async () => {
            if (typeof window.callTtsProxy !== 'function') throw new Error('Thai voice needs the admin AI proxy');
            const r = await window.callTtsProxy({ provider: 'cloud_tts', model: VOICE.model, ttsConfig: {
                input: { prompt: VOICE.prompt, text: key },
                voice: { languageCode: 'th-TH', name: VOICE.name, modelName: VOICE.model },
                audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 } } });
            if (!r || !r.audioContent) throw new Error('No audio came back from Cloud Text-to-Speech');
            const bin = atob(r.audioContent), bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
            const a = new Audio(); a.preload = 'metadata'; a.src = url;
            await new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => rej(new Error('Could not read the Thai voice')); });
            return { url, duration: a.duration };
        })();
        voiceCache.set(key, p);
        p.catch(() => voiceCache.delete(key));
        return p;
    }
    // speed a voice up (pitch kept) only when it is longer than the clip; never past MAX_RATE
    const fitRate = (voiceSec, clipSec) => Math.min(MAX_RATE, Math.max(1, Number(voiceSec) / Math.max(1, Number(clipSec) - 0.15)));

    // one controller for a player: CC band, 🔊 Thai voice (preview in sync, clip muted), ⬇ MP4 + ซับ (+ 🔊)
    function mount(o) {
        const st = { on: false, voice: null, rate: 1, audio: null };
        const clipSec = () => (o.video && o.video.duration && isFinite(o.video.duration) ? o.video.duration : (Number(o.seconds) || 8));
        let list = cues(o.caption, o.seconds);
        const band = attach(o.video, o.band, () => list, o.ccBtn);
        const say = t => { if (o.statusEl) o.statusEl.textContent = t; };
        const mark = () => {
            if (o.voiceBtn) { o.voiceBtn.classList.toggle('on', st.on); o.voiceBtn.setAttribute('aria-pressed', String(st.on)); }
            if (o.burnBtn && !o.burnBtn.disabled) o.burnBtn.textContent = st.on ? '⬇ MP4 + ซับ + 🔊' : '⬇ MP4 + ซับ';
        };
        const sync = () => {   // the voice follows the player: play / pause / seek
            if (!st.on || !st.audio) return;
            st.audio.playbackRate = st.rate; st.audio.preservesPitch = true;
            const want = (o.video.currentTime || 0) * st.rate;
            if (want >= (st.audio.duration || 0)) { st.audio.pause(); return; }
            if (Math.abs(st.audio.currentTime - want) > 0.25) st.audio.currentTime = want;
            if (!o.video.paused && st.audio.paused) st.audio.play().catch(() => {});
        };
        if (o.video) {
            ['play', 'seeked', 'timeupdate'].forEach(ev => o.video.addEventListener(ev, sync));
            ['pause', 'ended'].forEach(ev => o.video.addEventListener(ev, () => { if (st.audio) st.audio.pause(); }));
        }
        if (o.voiceBtn) o.voiceBtn.onclick = async () => {
            if (o.voiceBtn.disabled) return;
            if (st.on) { st.on = false; if (st.audio) st.audio.pause(); o.video.muted = false; list = cues(o.caption, o.seconds); if (band) band.paint(); say(''); mark(); return; }
            o.voiceBtn.disabled = true;
            const label = o.voiceBtn.textContent;
            o.voiceBtn.textContent = '⏳ เสียงไทย…';
            try {
                st.voice = await makeVoice(o.caption);
                st.rate = fitRate(st.voice.duration, clipSec());
                if (!st.audio || st.audio.src !== st.voice.url) { if (st.audio) st.audio.pause(); st.audio = new Audio(st.voice.url); }
                list = cues(o.caption, Math.min(clipSec(), st.voice.duration / st.rate));
                st.on = true; o.video.muted = true;
                const tooLong = st.voice.duration / MAX_RATE > clipSec() + 0.05;
                say('🔊 Thai voice ' + st.voice.duration.toFixed(1) + ' s' + (st.rate > 1.001 ? ' · ×' + st.rate.toFixed(2) : '') + (tooLong ? ' · longer than the clip — shorten the Thai caption in ✏️' : ''));
                if (band) band.paint();
                sync();
            } catch (e) {
                say('⚠️ ' + ((e && e.message) || e));
            } finally {
                o.voiceBtn.disabled = false;
                o.voiceBtn.textContent = label;
                mark();
            }
        };
        if (o.burnBtn) o.burnBtn.onclick = () => burnButton(o.burnBtn, o.statusEl, o.src, list, o.fileBase, st.on && st.voice ? { url: st.voice.url, rate: st.rate } : null).then(mark);
        mark();
        return { state: st, cues: () => list };
    }

    // the gallery's ▶: a player inside the app with the same band + CC + 🔊 + ⬇ MP4 + ซับ
    function openPlayer(item) {
        const list = cues(item.caption, item.seconds);
        let m = document.getElementById('glc-player');
        if (!m) {
            m = document.createElement('div');
            m.id = 'glc-player';
            m.className = 'glc-player lang-no-toggle';
            m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
            document.body.appendChild(m);
            m.addEventListener('click', e => { if (e.target === m) close(); });
        }
        const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        m.innerHTML = '<div class="glc-player-box"><div class="glc-player-hd"><b>' + esc(item.name) + '</b><button type="button" class="x" aria-label="Close">✕</button></div>'
            + '<span class="glc-vwrap"><video class="glc-video" controls playsinline autoplay src="' + esc(item.url) + '"></video><div class="glc-cc-band" hidden></div></span>'
            + (list.length ? '<div class="glc-player-ft"><button type="button" class="glc-cc" aria-pressed="true" title="Thai captions on / off">CC ไทย</button><button type="button" class="glc-voice" aria-pressed="false" title="Thai voice (Gemini TTS) instead of the clip\'s own audio">🔊 เสียงไทย</button><button type="button" class="glc-burn" title="Download the MP4 with the Thai captions burned in (for LINE / TikTok)">⬇ MP4 + ซับ</button><small class="glc-burn-st" role="status"></small></div>' : '')
            + '</div>';
        m.hidden = false;
        const video = m.querySelector('video');
        const ctl = mount({ video, band: m.querySelector('.glc-cc-band'), ccBtn: m.querySelector('.glc-cc'), voiceBtn: m.querySelector('.glc-voice'), burnBtn: m.querySelector('.glc-burn'),
            statusEl: m.querySelector('.glc-burn-st'), src: item.url, caption: item.caption, seconds: item.seconds, fileBase: item.fileBase });
        m.querySelector('.x').onclick = close;
        function close() { video.pause(); if (ctl.state.audio) ctl.state.audio.pause(); m.hidden = true; m.innerHTML = ''; }
        return m;
    }

    // shared button behaviour: busy text with progress, a result line, the button back
    async function burnButton(btn, statusEl, src, list, fileBase, voice) {
        if (btn.disabled) return;
        const label = btn.textContent;
        btn.disabled = true;
        try {
            const r = await burn(src, list, fileBase, (t, d) => { btn.textContent = '⏳ ' + Math.min(Math.round(t), Math.round(d)) + ' / ' + Math.round(d) + ' s'; }, voice);
            if (statusEl) statusEl.textContent = '✓ ' + r.ext.toUpperCase() + ' · ' + (r.size / 1048576).toFixed(1) + ' MB' + (r.ext === 'webm' ? ' (this browser records WebM)' : '');
        } catch (e) {
            if (statusEl) statusEl.textContent = '⚠️ ' + ((e && e.message) || e);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    window.GlcCaptions = { cues, cueAt, attach, mount, makeVoice, fitRate, drawFrame, burn, burnButton, openPlayer, recType, ensureFont, ccOn, setCc };
})();
