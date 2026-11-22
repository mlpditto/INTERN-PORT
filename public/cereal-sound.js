/* V101.333 — 🥣 Cereal Killer sounds (owner 2026-11-22: all 12 from mockup-cereal-ux/, on at first, "ดังขึ้น นานขึ้นเล็กน้อย").
   Made with Web Audio in the phone — no sound files. The killer's sounds are low and dark, the detective's clear and bright.
   🔊/🔇 in the game header, remembered on this phone (localStorage cerealSound = 'off'). Nothing plays before the player's first
   tap (iPhone / LINE rule): every cue is triggered from a tap, or from the bot's turn that a tap started. window.CKSound. */
(function () {
    'use strict';
    var VOL = 1.6, DUR = 1.4;                          // owner: louder and a little longer than the mockup
    var ac = null, log = [];
    function on() { try { return localStorage.getItem('cerealSound') !== 'off'; } catch (_) { return true; } }
    function set(v) { try { localStorage.setItem('cerealSound', v ? 'on' : 'off'); } catch (_) { /* blocked storage */ } }
    function ctx() {
        if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ac = new C(); } catch (_) { return null; } }
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return ac;
    }
    function tone(a, at, f, dur, type, vol, f2) {
        var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at, d = dur * DUR, v = Math.min(0.9, (vol || 0.3) * VOL);
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.05);
    }
    function noise(a, at, dur, vol, hp) {
        var d = dur * DUR, n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
        for (var i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
        var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        s.buffer = b; f.type = 'highpass'; f.frequency.value = hp || 1000; g.gain.value = Math.min(0.9, (vol || 0.3) * VOL);
        s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + at);
    }
    var CUES = {
        heartbeat: function (a, t) { tone(a, t, 60, 0.18, 'sine', 0.7, 40); tone(a, t + 0.3, 55, 0.2, 'sine', 0.55, 38); },          // 🔪 your turn
        step: function (a, t) { tone(a, t, 140, 0.07, 'triangle', 0.35, 90); },                                                      // 🔪 one cell
        crunch: function (a, t) { noise(a, t, 0.16, 0.5, 1800); noise(a, t + 0.05, 0.1, 0.35, 3000); tone(a, t, 70, 0.3, 'sine', 0.6, 45); },   // 🥣 victim
        gasp: function (a, t) { tone(a, t, 300, 0.25, 'sine', 0.25, 900); },                                                         // 👁️ witness
        whoosh: function (a, t) { noise(a, t, 0.45, 0.25, 600); },                                                                    // 📱 pass the phone
        tick: function (a, t) { for (var i = 0; i < 4; i++) tone(a, t + i * 0.3, 1800, 0.03, 'square', 0.12); },                     // 🕵️ your turn
        stepD: function (a, t) { tone(a, t, 520, 0.06, 'triangle', 0.25, 420); },                                                    // 🕵️ one cell
        ding: function (a, t) { tone(a, t, 880, 0.35, 'sine', 0.3); tone(a, t + 0.15, 1320, 0.45, 'sine', 0.25); },                  // ❓ answer
        buzz: function (a, t) { tone(a, t, 110, 0.35, 'sawtooth', 0.25, 90); },                                                     // 🛡️ wrong
        siren: function (a, t) { tone(a, t, 600, 0.35, 'triangle', 0.25, 900); tone(a, t + 0.5, 900, 0.35, 'triangle', 0.25, 600); [523, 659, 784].forEach(function (f) { tone(a, t + 1.05, f, 0.6, 'sine', 0.18); }); },   // 🛡️ caught / 🕵️ wins
        typing: function (a, t) { for (var i = 0; i < 5; i++) tone(a, t + i * 0.12, 2400 + Math.random() * 400, 0.02, 'square', 0.06); },   // 🤖 thinking
        lose: function (a, t) { [392, 349, 311, 262].forEach(function (f, i) { tone(a, t + i * 0.3, f, 0.3, 'triangle', 0.22); }); }   // 🔪 wins
    };
    window.CKSound = {
        KEYS: Object.keys(CUES),
        on: on,
        toggle: function () { set(!on()); return on(); },
        /** Play a cue now or `delay` seconds later. log keeps what was asked to play while sound is on (read by cereal-ux-qa). */
        play: function (key, delay) {
            if (!CUES[key] || !on()) return;
            log.push(key);
            var a = ctx(); if (!a) return;
            try { CUES[key](a, delay || 0); } catch (_) { /* a phone without Web Audio stays silent */ }
        },
        log: log
    };
})();
