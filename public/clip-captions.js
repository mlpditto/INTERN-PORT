// V102.353 · Thai captions for Grand Line clips (owner's pick: a bottom band, mockup 2026-10-21).
// One caption text per episode (the episode's Thai caption, editable in ✏️ — no re-render) is cut into 1–2-line
// chunks timed across the clip. In the app the band follows the player (CC on/off, remembered); "⬇ MP4 + ซับ" burns
// the same band into a new file in the browser: the clip plays once into a canvas (+ its own audio), MediaRecorder
// writes MP4 where the browser can, WebM otherwise. Nothing is uploaded; the saved clip is untouched.
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
        if (!video || !band) return;
        const paint = () => { const t = ccOn() ? cueAt(list, video.currentTime || 0) : ''; band.textContent = t; band.hidden = !t; };
        ['timeupdate', 'seeked', 'loadedmetadata', 'play'].forEach(ev => video.addEventListener(ev, paint));
        if (ccBtn) {
            const mark = () => { const on = ccOn(); ccBtn.classList.toggle('on', on); ccBtn.setAttribute('aria-pressed', String(on)); };
            ccBtn.onclick = () => { setCc(!ccOn()); mark(); paint(); };
            mark();
        }
        paint();
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

    // ⬇ MP4 + ซับ: play the clip once into a canvas with the band, record it with the clip's own audio
    async function burn(src, list, fileBase, onProgress) {
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
        let ac = null;
        try {   // the clip's audio goes to the recording only (not the speakers)
            ac = new (window.AudioContext || window.webkitAudioContext)();
            const dest = ac.createMediaStreamDestination();
            ac.createMediaElementSource(v).connect(dest);
            dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (e) { ac = null; }
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
        step();
        await new Promise(r => { v.onended = r; });
        drawFrame(g, v, W, H, cueAt(list, (v.duration || 0) - 0.01));
        await new Promise(r => setTimeout(r, 120));
        rec.stop();
        await stopped;
        if (ac) ac.close().catch(() => {});
        if (made) URL.revokeObjectURL(made);
        const blob = new Blob(parts, { type: (rec.mimeType || type || 'video/webm').split(';')[0] });
        const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (fileBase || 'clip') + '-th.' + ext;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return { ext, size: blob.size, width: W, height: H };
    }

    // the gallery's ▶: a player inside the app with the same band + CC + ⬇ MP4 + ซับ
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
            + (list.length ? '<div class="glc-player-ft"><button type="button" class="glc-cc" aria-pressed="true" title="Thai captions on / off">CC ไทย</button><button type="button" class="glc-burn" title="Download the MP4 with the Thai captions burned in (for LINE / TikTok)">⬇ MP4 + ซับ</button><small class="glc-burn-st" role="status"></small></div>' : '')
            + '</div>';
        m.hidden = false;
        const video = m.querySelector('video');
        attach(video, m.querySelector('.glc-cc-band'), list, m.querySelector('.glc-cc'));
        const b = m.querySelector('.glc-burn');
        if (b) b.onclick = () => burnButton(b, m.querySelector('.glc-burn-st'), item.url, list, item.fileBase);
        m.querySelector('.x').onclick = close;
        function close() { video.pause(); m.hidden = true; m.innerHTML = ''; }
        return m;
    }

    // shared button behaviour: busy text with progress, a result line, the button back
    async function burnButton(btn, statusEl, src, list, fileBase) {
        if (btn.disabled) return;
        const label = btn.textContent;
        btn.disabled = true;
        try {
            const r = await burn(src, list, fileBase, (t, d) => { btn.textContent = '⏳ ' + Math.min(Math.round(t), Math.round(d)) + ' / ' + Math.round(d) + ' s'; });
            if (statusEl) statusEl.textContent = '✓ ' + r.ext.toUpperCase() + ' · ' + (r.size / 1048576).toFixed(1) + ' MB' + (r.ext === 'webm' ? ' (this browser records WebM)' : '');
        } catch (e) {
            if (statusEl) statusEl.textContent = '⚠️ ' + ((e && e.message) || e);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    window.GlcCaptions = { cues, cueAt, attach, drawFrame, burn, burnButton, openPlayer, recType, ensureFont, ccOn, setCc };
})();
