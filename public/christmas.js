// V101.273 Christmas add-on (owner picks 2026-11-06): light snow over the whole page (snow A) + a soft music-box loop (S2, an original tune
// synthesized for this app, assets/sounds/xm-musicbox.mp3). Only while the Christmas theme is on (html.xm: 1–31 Dec Bangkok, or an admin sets it).
// Music is on by default and starts at the first tap / key on the page (phones and LINE block sound before a gesture). Long-press the profile
// photo (0.6 s) to turn it off / on again; a normal tap keeps its job (in LINE it opens the app in the browser). The choice is remembered.
(function () {
    'use strict';
    var KEY = 'xm_music', HOLD = 600, FLAKES = 26;
    var audio = null, started = false, snow = null;
    function on() { return document.documentElement.classList.contains('xm'); }
    function wanted() { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } }
    function remember(v) { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* storage blocked */ } }
    function toast(t) { if (typeof showToast === 'function') showToast(t); }

    function paintSnow() {
        if (!on()) { if (snow) { snow.remove(); snow = null; } return; }
        if (snow) return;
        snow = document.createElement('div');
        snow.className = 'xm-snow';
        snow.setAttribute('aria-hidden', 'true');
        var html = '';
        for (var i = 0; i < FLAKES; i++) {
            var s = (4 + Math.random() * 5).toFixed(1), d = (7 + Math.random() * 6).toFixed(1);
            html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;width:' + s + 'px;height:' + s + 'px;--d:' + d + 's;--dl:-' + (Math.random() * d).toFixed(1)
                + 's;--x:' + Math.round(Math.random() * 50 - 25) + 'px;--o:' + (0.55 + Math.random() * 0.4).toFixed(2) + '"></i>';
        }
        snow.innerHTML = html;
        document.body.appendChild(snow);
    }

    function player() {
        if (!audio) { audio = new Audio('assets/sounds/xm-musicbox.mp3'); audio.loop = true; audio.volume = 0.35; audio.preload = 'auto'; }
        return audio;
    }
    function play() { if (!on()) return; var p = player().play(); started = true; if (p && p.catch) p.catch(function () { started = false; }); }
    function pause() { if (audio) audio.pause(); }

    // the first gesture anywhere starts the music (when it is wanted)
    function firstGesture() {
        if (started || !on() || !wanted()) return;
        play();
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, firstGesture, { capture: true, passive: true }); });
    document.addEventListener('visibilitychange', function () {
        if (!audio) return;
        if (document.hidden) audio.pause(); else if (started && wanted() && on()) audio.play().catch(function () { /* needs a new gesture */ });
    });

    // long-press the profile photo = music off / on; the click that follows a long-press is swallowed so LINE does not open the browser
    function bindPhoto() {
        var img = document.getElementById('u-img');
        if (!img || img.dataset.xmHold) return;
        img.dataset.xmHold = '1';
        var timer = 0, held = false;
        function start() {
            if (!on()) return;
            held = false;
            timer = setTimeout(function () {
                held = true;
                var next = !(wanted() && audio && !audio.paused);
                remember(next);
                if (next) { play(); toast('🎵 Music on · เปิดเพลง'); } else { pause(); toast('🔇 Music off · ปิดเพลง (hold the photo to turn it on)'); }
                if (navigator.vibrate) navigator.vibrate(20);
            }, HOLD);
        }
        function stop() { clearTimeout(timer); }
        img.addEventListener('pointerdown', start);
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { img.addEventListener(t, stop); });
        img.addEventListener('click', function (e) { if (held) { held = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
        img.addEventListener('contextmenu', function (e) { if (on()) e.preventDefault(); });   // no "save image" sheet on a long-press
        if (on()) img.title = (img.title ? img.title + ' · ' : '') + 'Hold for music on / off';
    }

    function apply() { paintSnow(); bindPhoto(); if (!on()) pause(); }
    // the theme can switch after load (app_settings/theme is read later), so follow the <html> class
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    window.xmMusic = { play: play, pause: pause, isOn: function () { return !!(audio && !audio.paused); } };   // for the QA script
})();
