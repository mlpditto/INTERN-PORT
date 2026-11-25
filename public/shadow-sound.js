/* V101.369 — ⚫⚪ ไพ่เงา sounds (owner 2026-11-25 picked C · เกมตู้ from mockup-shadow-sound/): short 8-bit blips, Web Audio in the
   phone, no sound files. ⚫ sounds low and ⚪ high, so the 🤖 colour can be heard; a number has a pitch (0 low → 8 high) only when the
   🤖 tiles are opened at the end, so a sound never tells a number during play. 🔊/🔇 in the game header, kept on this phone
   (localStorage shadowSound = 'off'). Every cue follows a tap (iPhone / LINE rule). window.BWSound — same shape as CKSound. */
(function () {
    'use strict';
    var VOL = 1.6, ac = null, log = [];
    var PITCH = [196, 220, 262, 294, 330, 392, 440, 523, 587];   // 0..8
    function on() { try { return localStorage.getItem('shadowSound') !== 'off'; } catch (_) { return true; } }
    function set(v) { try { localStorage.setItem('shadowSound', v ? 'on' : 'off'); } catch (_) { /* blocked storage */ } }
    function ctx() {
        if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (_) { return null; } }
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return ac;
    }
    function tone(a, at, f, d, type, vol, f2) {
        var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at, v = Math.min(0.9, (vol || 0.3) * VOL);
        o.type = type || 'square'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.05);
    }
    function seq(a, t, fs, step, d, vol) { fs.forEach(function (f, i) { tone(a, t + i * step, f, d, 'square', vol); }); }
    var CUES = {
        think: function (a, t) { [0, 0.12, 0.24].forEach(function (x) { tone(a, t + x, 1400 + Math.random() * 600, 0.03, 'square', 0.07); }); },   // 🤖 thinking
        b: function (a, t) { tone(a, t, 220, 0.12, 'square', 0.15); },             // 🤖 puts down ⚫ (low)
        w: function (a, t) { tone(a, t, 880, 0.12, 'square', 0.12); },             // 🤖 puts down ⚪ (high)
        pick: function (a, t) { tone(a, t, 1200, 0.03, 'square', 0.08); },         // 👆 a tile chosen
        place: function (a, t) { tone(a, t, 400, 0.07, 'square', 0.12, 200); },    // 🂠 ▸ ลง
        oops: function (a, t) { tone(a, t, 150, 0.12, 'square', 0.1); },           // 🧠 already played
        win: function (a, t) { seq(a, t, [660, 880, 1320], 0.07, 0.07, 0.12); },
        lose: function (a, t) { tone(a, t, 440, 0.35, 'sawtooth', 0.12, 110); },
        draw: function (a, t) { seq(a, t, [660, 660], 0.12, 0.07, 0.1); },
        endW: function (a, t) { seq(a, t, [523, 659, 784, 1047, 784, 1047], 0.1, 0.1, 0.12); },
        endL: function (a, t) { seq(a, t, [392, 370, 349, 330], 0.18, 0.18, 0.11); },
        endD: function (a, t) { seq(a, t, [523, 523, 659], 0.12, 0.1, 0.1); }
    };
    for (var n = 0; n < 9; n++) (function (n) { CUES['n' + n] = function (a, t) { tone(a, t, PITCH[n] * 2, 0.1, n % 2 ? 'square' : 'triangle', 0.13); }; })(n);   // end reveal
    window.BWSound = {
        on: on,
        toggle: function () { set(!on()); return on(); },
        /** Play a cue now or `delay` seconds later. log keeps what was asked to play while sound is on (read by shadow-sound-qa). */
        play: function (key, delay) {
            if (!CUES[key] || !on()) return;
            log.push(key);
            var a = ctx(); if (!a) return;
            try { CUES[key](a, delay || 0); } catch (_) { /* a phone without Web Audio stays silent */ }
        },
        log: log
    };
})();
