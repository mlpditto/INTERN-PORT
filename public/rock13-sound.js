/* V101.382 🪨 Carry 13 sound (owner 2026-11-27: "อยากได้แบบคลอไปเบาๆ สำหรับตาคนเล่น" → pick A2 "music box in a minor key + a
   heartbeat", "ความยาว 13 วิ รันให้เป็น loop ต่อเนื่องได้แบบไล่รอยต่อ"). The loop is built in the phone (Web Audio, no file): 13 s,
   20 bell notes 0.65 s apart (A minor, the last bar leads back to the first note) over a heartbeat every 1.625 s; a note that rings
   past 13 s is written back onto the start, so the loop has no seam. It plays softly only on your turn (fade in / out). Cues: a
   stone put down, stones falling 💥, ⏭, your turn, the end. 🔊/🔇 kept as r13Sound. Every sound follows a tap (iPhone / LINE).
   loopSamples() is pure, so scripts can render the same loop. window.R13Sound */
(function (root, factory) {
    var api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.R13Sound = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var LEN = 13, STEP = 0.65, BEAT = 1.625, VOL = 0.55;
    var MEL = [69, 72, 76, 81, 80, 76, 72, 71, 69, 72, 76, 79, 77, 76, 72, 68, 64, 68, 71, 68];   // 20 × 0.65 s = 13 s
    function N(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    /** the 13 s loop as samples; the tails wrap onto the start */
    function loopSamples(sr) {
        var len = Math.round(LEN * sr), buf = new Float32Array(len);
        function add(t, f, d, type, vol) {
            var s0 = Math.round(t * sr), n = Math.round(d * 1.6 * sr);
            for (var i = 0; i < n; i++) {
                var x = i / sr, ph = 2 * Math.PI * f * x;
                var w = type === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph) + 0.25 * Math.sin(2 * ph);
                var env = x < 0.005 ? x / 0.005 : Math.exp(-(x - 0.005) / (d / 4));
                buf[(s0 + i) % len] += w * env * vol;
            }
        }
        MEL.forEach(function (m, i) { add(i * STEP, N(m), 1.8, 'sine', 0.055); });
        for (var k = 0; k < LEN / BEAT; k++) { add(k * BEAT, 82, 0.16, 'tri', 0.112); add(k * BEAT + 0.22, 73, 0.2, 'tri', 0.088); }
        return buf;
    }
    if (typeof window === 'undefined') return { loopSamples: loopSamples, LEN: LEN };

    var ac = null, loopBuf = null, src = null, gain = null;
    function on() { try { return localStorage.getItem('r13Sound') !== 'off'; } catch (_) { return true; } }
    function ctx() {
        if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (_) { return null; } }
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return ac;
    }
    function tone(a, t, f, d, type, vol, f2) {
        var o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.05);
    }
    var CUES = {
        put: function (a, t) { tone(a, t, 150, 0.22, 'triangle', 0.3, 90); },                                                   // a stone down
        fall: function (a, t) { for (var k = 0; k < 6; k++) tone(a, t + k * 0.09, 170 - k * 14, 0.2, 'triangle', 0.26, 80); },  // 💥 stones fall
        pass: function (a, t) { tone(a, t, 900, 0.25, 'sine', 0.05, 300); },                                                    // ⏭ a soft whoosh
        turn: function (a, t) { tone(a, t, N(76), 0.6, 'sine', 0.1); tone(a, t + 0.18, N(83), 0.8, 'sine', 0.1); },            // your turn
        win: function (a, t) { [72, 76, 79, 84].forEach(function (m, i) { tone(a, t + i * 0.12, N(m), 0.5, 'sine', 0.12); }); },
        lose: function (a, t) { [69, 68, 67, 64].forEach(function (m, i) { tone(a, t + i * 0.2, N(m), 0.5, 'sine', 0.1); }); },
        pick: function (a, t) { tone(a, t, 1200, 0.04, 'sine', 0.05); }
    };
    var api = {
        LEN: LEN, loopSamples: loopSamples, on: on, log: [], playing: false,
        toggle: function () { try { localStorage.setItem('r13Sound', on() ? 'off' : 'on'); } catch (_) { } if (!on()) api.music(false); return on(); },
        play: function (k) { api.log.push(k); if (!on() || !CUES[k]) return; var a = ctx(); if (a) try { CUES[k](a, a.currentTime + 0.01); } catch (_) { } },
        /** the soft loop: true = fade in (your turn), false = fade out */
        music: function (want) {
            want = !!want && on();
            if (want === api.playing) return; api.playing = want; api.log.push(want ? 'music+' : 'music-');
            var a = ctx(); if (!a) return;
            try {
                var t = a.currentTime;
                if (want) {
                    if (!loopBuf) { loopBuf = a.createBuffer(1, Math.round(LEN * a.sampleRate), a.sampleRate); loopBuf.getChannelData(0).set(loopSamples(a.sampleRate)); }
                    gain = a.createGain(); gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(VOL, t + 1.2); gain.connect(a.destination);
                    src = a.createBufferSource(); src.buffer = loopBuf; src.loop = true; src.connect(gain); src.start(t);
                } else if (src) {
                    var s = src, g = gain; src = null; gain = null;
                    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value || VOL, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); s.stop(t + 0.9);
                }
            } catch (_) { }
        }
    };
    return api;
});
