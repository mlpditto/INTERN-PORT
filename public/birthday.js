// V101.295 (owner 2026-11-08, pick C): 🎂 birthdays. getBirthdays (functions/birthdays.js) lists today's and in-3-days birthdays of active
// members — nickname + month-day, never the year, nobody who hid theirs (Info ▸ DOB ▸ 🙈). On a birthday everyone gets confetti instead
// of the snow; once a day per device a toast says "🎂 อีก 3 วัน (DD MONTH) วันเกิด USER" / "🎉 วันนี้วันเกิด USER". The birthday person
// gets gold-heavier confetti, 🎂 after their name, "Happy birthday" and a Happy Birthday music box from their first tap, all day (V101.296).
(function () {
    'use strict';
    var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var COLORS = ['#f472b6', '#facc15', '#60a5fa', '#34d399', '#a78bfa', '#fb923c'], GOLD = ['#f59e0b', '#fbbf24', '#fde68a'];
    var box = null, ran = '';

    function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
    function dm(md) { return Number(md.slice(3)) + ' ' + TH_M[Number(md.slice(0, 2)) - 1]; }
    function names(list) { return list.map(function (x) { return x.name; }).join(', '); }

    function confetti(on, me) {
        if (box) { box.remove(); box = null; }
        if (!on) return;
        box = document.createElement('div');
        box.className = 'bd-confetti';
        box.setAttribute('aria-hidden', 'true');
        var n = me ? 46 : 30, html = '';
        for (var i = 0; i < n; i++) {
            var c = me && i % 2 ? GOLD[i % 3] : COLORS[i % 6], d = (6 + Math.random() * 6).toFixed(1);
            html += '<b style="background:' + c + ';left:' + (Math.random() * 100).toFixed(1) + '%;--d:' + d + 's;--dl:-' + (Math.random() * d).toFixed(1)
                + 's;--x:' + Math.round(Math.random() * 60 - 30) + 'px;--r:' + Math.round(360 + Math.random() * 540) + 'deg"></b>';
        }
        box.innerHTML = html;
        document.body.appendChild(box);
    }

    // the toasts: one line, once a day per device. The birthday person never gets told about themselves "in 3 days".
    function messages(items, me) {
        var mine = items.filter(function (x) { return x.days === 0 && x.id === me; })[0];
        var today = items.filter(function (x) { return x.days === 0 && x.id !== me; });
        var soon = items.filter(function (x) { return x.days === 3 && x.id !== me; });
        var out = [];
        if (mine) out.push('🎂 Happy birthday ' + mine.name + '! สุขสันต์วันเกิด');
        if (today.length) out.push('🎉 วันนี้วันเกิด ' + names(today));
        if (soon.length) out.push('🎂 อีก 3 วัน (' + dm(soon[0].md) + ') วันเกิด ' + names(soon));
        return out;
    }

    // Happy Birthday (traditional, public domain) as a soft music box, synthesized — no file
    var TUNE = [[67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2], [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
        [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2], [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 2.5]];
    // V101.296 (owner): on your birthday the song loops all day (a 4 s rest between rounds) — no Christmas music that day (christmas.js
    // stays quiet on html.bd-me). It starts at the first tap (phones need one), stops while a quiz is open or the app is in the background
    // and comes back at the next tap. Hold your photo 0.6 s = song off / on, remembered for the day.
    var ac = null, playing = false, loopT = 0, mine = false;
    function muted() { return store('bd_mute_' + ran) === '1'; }
    function inQuiz() { var q = document.getElementById('quizModal'); return !!(q && getComputedStyle(q).display !== 'none'); }
    function pass() {   // one round on the open AudioContext; returns its length in seconds
        var t = ac.currentTime + 0.05, t0 = t, beat = 0.42;
        TUNE.forEach(function (n) {
            var f = 440 * Math.pow(2, (n[0] - 69) / 12);
            [[1, 0.22], [2, 0.06]].forEach(function (h) {
                var o = ac.createOscillator(), g = ac.createGain();
                o.type = 'sine'; o.frequency.value = f * h[0];
                g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(h[1], t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.5, n[1] * beat * 1.6));
                o.connect(g).connect(ac.destination); o.start(t); o.stop(t + n[1] * beat * 1.7);
            });
            t += n[1] * beat;
        });
        return t - t0;
    }
    function loop() {
        if (!playing) return;
        if (inQuiz() || document.hidden) { stopTune(); return; }
        loopT = setTimeout(loop, (pass() + 4) * 1000);
    }
    function startTune() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || playing || !mine || muted() || inQuiz() || document.hidden) return false;
        if (window.xmMusic) window.xmMusic.pause();
        ac = new AC(); playing = true;
        if (ac.resume) ac.resume();
        loop();
        return true;
    }
    function stopTune() {
        playing = false; clearTimeout(loopT);
        if (ac) { try { ac.close(); } catch (e) { /* already closed */ } ac = null; }
    }
    function onGesture() { startTune(); }
    ['touchend', 'click', 'keydown'].forEach(function (t) { document.addEventListener(t, onGesture, { capture: true, passive: true }); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopTune(); });
    // hold the profile photo = song off / on (christmas.js leaves the hold alone on html.bd-me)
    function bindHold() {
        var img = document.getElementById('u-img');
        if (!img || img.dataset.bdHold) return;
        img.dataset.bdHold = '1';
        var timer = 0, held = false;
        img.addEventListener('pointerdown', function () {
            if (!mine) return;
            held = false;
            timer = setTimeout(function () {
                held = true;
                if (muted()) { store('bd_mute_' + ran, '0'); startTune(); if (typeof showToast === 'function') showToast('🎂 Birthday song on · เปิดเพลงวันเกิด'); }
                else { store('bd_mute_' + ran, '1'); stopTune(); if (typeof showToast === 'function') showToast('🔇 Birthday song off · ปิดเพลงวันเกิด (hold the photo to turn it on)'); }
                if (navigator.vibrate) navigator.vibrate(20);
            }, 600);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { img.addEventListener(t, function () { clearTimeout(timer); }); });
        img.addEventListener('click', function (e) { if (held) { held = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    }

    // items = getBirthdays().items, me = this intern's users id, day = Bangkok 'YYYY-MM-DD'
    function apply(items, me, day) {
        items = Array.isArray(items) ? items : [];
        var anyToday = items.some(function (x) { return x.days === 0; });
        mine = items.some(function (x) { return x.days === 0 && x.id === me; });
        document.documentElement.classList.toggle('bd', anyToday);
        document.documentElement.classList.toggle('bd-me', mine);
        confetti(anyToday, mine);
        ran = day;
        var msg = messages(items, me);
        if (msg.length && store('bd_toast_' + day) !== '1' && typeof showToast === 'function') { store('bd_toast_' + day, '1'); showToast(msg.join(' · ')); }
        if (!mine) stopTune(); else bindHold();
    }

    // once per day per page: called from the user-doc listener (index.html), which runs again on every change
    function sync() {
        var me = window.myUserDoc && window.myUserDoc.id;
        if (!me || !window.firebase || typeof firebase.functions !== 'function') return;
        var day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
        if (ran === day) return;
        ran = day;
        firebase.functions().httpsCallable('getBirthdays')({}).then(function (r) {
            var d = (r && r.data) || {};
            apply(d.items, me, d.today || day);
        }).catch(function () { ran = ''; /* try again on the next user-doc change */ });
    }

    window.bdBirthdays = { sync: sync, apply: apply, messages: messages, isPlaying: function () { return playing; } };
    sync();   // the user doc may have arrived before this deferred file ran
})();
