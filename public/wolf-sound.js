/* V101.357 — 🐺 Werewolf solo sounds, owner pick B ("ดราม่า", mockup-werewolf-tutorial-sound/sound-board.html): a howl at nightfall, a
   snap for the bite, bells in the morning, drums for the vote. Made with Web Audio in the phone — no sound files. 🔊 / 🔇 in the game
   header, remembered on this phone (localStorage wolfSound = 'off'), on at first. Nothing plays before the player's first tap (iPhone /
   LINE rule): every cue comes from a tap. window.WWSound: play(key) · on() · toggle() · _log (for scripts/wolf-tutorial-qa.cjs). */
(function () {
    'use strict';
    var ac = null, log = [];
    function on() { try { return localStorage.getItem('wolfSound') !== 'off'; } catch (_) { return true; } }
    function set(v) { try { localStorage.setItem('wolfSound', v ? 'on' : 'off'); } catch (_) { /* blocked storage */ } }
    function ctx() {
        if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (_) { return null; } }
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return ac;
    }
    function tone(a, at, f, dur, type, vol, f2) {
        var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(a, at, dur, vol, type, freq, q, f2) {
        var n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
        for (var i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
        var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t0 = a.currentTime + at;
        s.buffer = b; f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 800, t0); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur); f.Q.value = q || 1; g.gain.value = vol || 0.3;
        s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0);
    }
    function howl(a, at, base, dur, vol) {
        var o = a.createOscillator(), l = a.createOscillator(), lg = a.createGain(), g = a.createGain(), f = a.createBiquadFilter(), t0 = a.currentTime + at;
        o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t0); o.frequency.linearRampToValueAtTime(base * 1.9, t0 + dur * 0.35); o.frequency.linearRampToValueAtTime(base * 1.5, t0 + dur);
        l.frequency.value = 5.5; lg.gain.value = base * 0.03; l.connect(lg); lg.connect(o.frequency);
        f.type = 'bandpass'; f.frequency.value = base * 3; f.Q.value = 2;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.25); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(f); f.connect(g); g.connect(a.destination); o.start(t0); l.start(t0); o.stop(t0 + dur + 0.1); l.stop(t0 + dur + 0.1);
    }
    var CUES = {
        night: function (a) { howl(a, 0, 220, 2.2, 0.22); noise(a, 0, 2.2, 0.08, 'lowpass', 500, 1, 200); },
        bite: function (a) { noise(a, 0, 0.22, 0.45, 'bandpass', 1400, 2, 500); tone(a, 0.02, 110, 0.35, 'sawtooth', 0.25, 55); },
        seeGood: function (a) { [784, 988, 1175, 1568].forEach(function (f, i) { tone(a, i * 0.09, f, 0.6, 'triangle', 0.15); }); },
        seeWolf: function (a) { tone(a, 0, 233, 0.9, 'sawtooth', 0.18, 220); tone(a, 0, 247, 0.9, 'sawtooth', 0.18, 233); noise(a, 0.05, 0.5, 0.15, 'highpass', 3000); },
        guard: function (a) { tone(a, 0, 1200, 0.9, 'triangle', 0.18, 1150); tone(a, 0, 1805, 0.9, 'sine', 0.08); noise(a, 0, 0.08, 0.3, 'highpass', 4000); },
        heal: function (a) { for (var i = 0; i < 7; i++) tone(a, i * 0.06, 400 + Math.random() * 500, 0.12, 'sine', 0.16); tone(a, 0.45, 1047, 0.6, 'sine', 0.16); },
        poison: function (a) { for (var i = 0; i < 5; i++) tone(a, i * 0.09, 180 - i * 15, 0.16, 'sine', 0.2); tone(a, 0.5, 90, 0.8, 'sawtooth', 0.14, 50); },
        morning: function (a) { [0, 0.6].forEach(function (t) { tone(a, t, 392, 1.6, 'sine', 0.22); tone(a, t, 784, 1.2, 'sine', 0.08); tone(a, t, 1176, 0.8, 'sine', 0.05); }); },
        death: function (a) { tone(a, 0, 110, 1.4, 'sine', 0.35, 55); noise(a, 0, 0.3, 0.3, 'lowpass', 300); tone(a, 0.1, 147, 1.2, 'triangle', 0.12, 73); },
        vote: function (a) { [0, 0.22, 0.44].forEach(function (t, i) { noise(a, t, 0.18, 0.4, 'lowpass', 180); tone(a, t, 70 + i * 6, 0.2, 'sine', 0.35, 50); }); },
        out: function (a) { noise(a, 0, 0.45, 0.4, 'lowpass', 220, 1, 80); tone(a, 0, 82, 0.9, 'sine', 0.4, 41); },
        win: function (a) { [392, 523, 659, 784].forEach(function (f, i) { tone(a, i * 0.16, f, 0.5, 'sawtooth', 0.1); tone(a, i * 0.16, f / 2, 0.5, 'sine', 0.15); }); tone(a, 0.7, 1047, 1.2, 'triangle', 0.2); },
        lose: function (a) { howl(a, 0, 196, 1.8, 0.2); tone(a, 0.6, 98, 1.4, 'sawtooth', 0.12, 49); }
    };
    window.WWSound = {
        on: on,
        toggle: function () { set(!on()); return on(); },
        play: function (k) {
            log.push(k);
            if (!on() || !CUES[k]) return;
            var a = ctx(); if (!a) return;
            try { CUES[k](a); } catch (_) { /* a phone without Web Audio stays quiet */ }
        },
        keys: Object.keys(CUES),
        _log: log
    };
})();
