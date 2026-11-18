// V102.686 🎬 Watch first ▸ ❓ how-to tour (owner pick A, mockups/watch-first-howto.html). The ❓ beside ✨ From Read first dims the
// screen and walks five steps on the real panel — ✨ write · ⚠️ fix a number · 🙋 change the speaker · 🗣 voices · ▶ play — with a 👆 hand
// and a yellow bubble (‹ › ✕, ← → Esc). It never calls a model, a voice or Firestore and never touches the story's state: with a story it
// only points at it (the ▶ ring is a class it removes); with none it shows a SAMPLE story in the box and takes it away at the end.
(function () {
    'use strict';
    var SAMPLE = [['q', '🙋 Q', 'Hi! I am about to do this quiz — where do I start?', 'Q1'],
        ['rx', '🧑‍⚕️ RX', 'Start with the key terms in the first note.', 'Q1'],
        ['key', '💡 KEY', 'Copy every dose exactly as the note writes it: 75 mg', 'Q2'],
        ['q', '🙋 Q', 'When should it be started?', 'Q3'],
        ['key', '💡 KEY', 'Within 10 years, before age 60', 'Q3']];
    var STEPS = [
        { at: '#qws-make', cap: '✨ AI writes a chat story from every Read first note' },
        { at: '.qws-l .qws-warn', or: '.qws-l input', cap: '⚠️ = a number Read first never says — type in the line to fix it' },
        { at: '.qws-l .qws-w', cap: '🙋 tap the speaker: Q → RX → 💡 KEY' },
        { at: '#qws-voice', cap: '🗣 AI voices every line — green when all are ready' },
        { at: '.qws-b[aria-label="Play"]', cap: '▶ play it here — what the intern sees before question 1' }];
    var T = null, RUN = 0, CSS = '#qws-box .qws-l{transition:opacity .25s}.qwt-dim{position:fixed;inset:0;z-index:100000;cursor:default}' +
        '.qwt-spot{position:fixed;z-index:100001;border-radius:10px;box-shadow:0 0 0 2px #facc15,0 0 0 9999px rgba(2,6,23,.62);transition:all .45s ease;pointer-events:none}' +
        '.qwt-hand{position:fixed;left:0;top:0;z-index:100003;font-size:22px;pointer-events:none;transition:transform .7s cubic-bezier(.4,.1,.2,1);filter:drop-shadow(0 2px 2px #000)}' +
        '.qwt-hand.tap::after{content:"";position:absolute;left:-6px;top:-6px;width:22px;height:22px;border-radius:50%;border:2px solid #facc15;animation:qwtTap .45s ease-out}' +
        '@keyframes qwtTap{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}' +
        '.qwt-bub{position:fixed;z-index:100002;max-width:320px;display:flex;align-items:center;gap:8px;background:#facc15;color:#1c1917;font:700 12.5px/1.4 Inter,Kanit,sans-serif;padding:7px 8px 7px 11px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.4);transition:left .45s ease,top .45s ease}' +
        '.qwt-bub b{opacity:.6} .qwt-bub button{flex:none;width:26px;height:26px;min-height:0;margin:0;padding:0;border:0;border-radius:7px;background:rgba(0,0,0,.12);color:#1c1917;font:800 14px/1 sans-serif;cursor:pointer}' +
        '.qwt-bub button:disabled{opacity:.35;cursor:default} .qwt-nav{display:flex;gap:4px;margin-left:auto}' +
        '@media (pointer:coarse){.qwt-bub button{width:44px;height:44px}}' +
        '@media (prefers-reduced-motion:reduce){.qwt-spot,.qwt-hand,.qwt-bub{transition:none}.qwt-hand.tap::after{animation:none}}';
    function wait(ms) { return new Promise(function (ok) { setTimeout(ok, T && T.fast ? 0 : ms); }); }
    function box() { return document.getElementById('qws-box'); }
    function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; }
    function sampleHtml() {
        return '<div class="qws-h"><b>🎬 from Read first</b><small>' + SAMPLE.length + ' lines · sample</small><span class="qws-warn">⚠️ 1 number not in Read first</span>' +
            '<button type="button" class="qws-b qws-v" id="qws-voice" tabindex="-1">🗣 <span class="qws-vn">0/8</span></button><button type="button" class="qws-b" aria-label="Play" tabindex="-1">▶</button></div>' +
            SAMPLE.map(function (x, i) { return '<div class="qws-l' + (x[0] === 'key' ? ' k' : '') + '"><button type="button" class="qws-w" tabindex="-1">' + x[1] + '</button><input type="text" readonly tabindex="-1" value="' + x[2] + '">' + (i === 2 ? '<span class="qws-warn">⚠️ 75</span>' : '') + '<em>' + x[3] + '</em></div>'; }).join('');
    }
    function target(s) { var b = box(), q = function (sel) { return sel.charAt(0) === '#' ? document.querySelector(sel) : b && b.querySelector(sel); }; return q(s.at) || (s.or && q(s.or)); }
    function tap() { if (!T) return; T.hand.classList.remove('tap'); void T.hand.offsetWidth; T.hand.classList.add('tap'); }
    // what a step shows: on the sample it acts the step out; on a real story it only points (nothing of the story changes)
    function act(i, t, run) {
        var b = box(), live = function () { return T && T.run === run; };
        if (i === 0) {
            tap();
            if (!T.sample) return wait(300);
            var ls = b.querySelectorAll('.qws-l');
            return [].reduce.call(ls, function (p, l) { return p.then(function () { return wait(160).then(function () { if (live()) l.style.opacity = ''; }); }); }, wait(200));
        }
        if (i === 1 && T.sample) {
            var inp = b.querySelectorAll('.qws-l input')[2]; tap();
            return [0, 1, 2, 3, 4, 5, 6].reduce(function (p) { return p.then(function () { if (live()) inp.value = inp.value.slice(0, -1); return wait(110); }); }, wait(200))
                .then(function () { if (live()) b.querySelectorAll('.qws-warn').forEach(function (w) { w.style.visibility = 'hidden'; }); });
        }
        if (i === 2 && T.sample) { tap(); var w = t; return wait(500).then(function () { if (live()) { w.textContent = '🧑‍⚕️ RX'; tap(); } return wait(500); }).then(function () { if (live()) w.textContent = '💡 KEY'; }); }
        if (i === 3 && T.sample) { tap(); var n = t.querySelector('.qws-vn'); return [1, 2, 3, 4, 5, 6, 7, 8].reduce(function (p, k) { return p.then(function () { if (live()) n.textContent = k + '/8'; return wait(110); }); }, Promise.resolve()).then(function () { if (live()) t.classList.add('all'); }); }
        if (i === 4) {
            tap(); var rows = b.querySelectorAll('.qws-l');
            return [].reduce.call(rows, function (p, l) { return p.then(function () { if (!live()) return; l.classList.add('now'); return wait(420).then(function () { l.classList.remove('now'); }); }); }, wait(200));
        }
        tap(); return wait(300);
    }
    function place(t) {
        t.scrollIntoView({ block: 'nearest' });
        var r = t.getBoundingClientRect(), p = 5, s = T.spot.style, bub = T.bub;
        s.left = r.left - p + 'px'; s.top = r.top - p + 'px'; s.width = r.width + 2 * p + 'px'; s.height = r.height + 2 * p + 'px';
        T.hand.style.transform = 'translate(' + (r.left + r.width / 2 - 4) + 'px,' + (r.top + r.height / 2 - 2) + 'px)';
        var bx = Math.min(Math.max(8, r.left + r.width / 2 - bub.offsetWidth / 2), innerWidth - bub.offsetWidth - 8), by = r.bottom + 12;
        if (by + bub.offsetHeight > innerHeight - 8) by = Math.max(8, r.top - bub.offsetHeight - 12);
        bub.style.left = bx + 'px'; bub.style.top = by + 'px';
    }
    function go(i) {
        if (!T) return;
        if (i < 0) i = 0; if (i >= STEPS.length) return end();
        var run = T.run = ++RUN; T.i = i;
        var t = target(STEPS[i]); if (!t) return go(i + 1);
        if (T.sample && i > 0) box().querySelectorAll('.qws-l').forEach(function (l) { l.style.opacity = ''; });   // › pressed before the lines came in
        T.bub.querySelector('.qwt-c').innerHTML = '<b>' + (i + 1) + '/' + STEPS.length + '</b> ' + STEPS[i].cap;
        T.bub.querySelector('[data-k="prev"]').disabled = i === 0;
        place(t);
        wait(750).then(function () { return T && T.run === run ? act(i, t, run) : null; })
            .then(function () { return wait(1400); })
            .then(function () { if (T && T.run === run && T.auto) go(i + 1); });
    }
    function key(e) {
        if (!T) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); T.auto = false; go(T.i + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); T.auto = false; go(T.i - 1); }
    }
    function end() {
        if (!T) return;
        var b = box(), t = T; T = null;
        document.removeEventListener('keydown', key, true);
        [t.dim, t.spot, t.hand, t.bub].forEach(function (e) { e.remove(); });
        if (b) { b.querySelectorAll('.qws-l.now').forEach(function (l) { l.classList.remove('now'); }); if (t.sample) { b.innerHTML = t.was.html; b.hidden = t.was.hidden; } }
        var h = document.getElementById('qws-help'); if (h) h.focus();
    }
    window.QuizWatchTour = {
        start: function (opts) {
            if (T) return;
            var b = box(), S = window.QuizWatchStory && QuizWatchStory._S; if (!b || (S && S.busy)) return;
            if (!document.getElementById('qwt-css')) { var st = document.createElement('style'); st.id = 'qwt-css'; st.textContent = CSS; document.head.appendChild(st); }
            T = { i: 0, run: 0, auto: true, fast: !!(opts && opts.fast), sample: !(window.QuizWatchStory && QuizWatchStory.get()), was: { html: b.innerHTML, hidden: b.hidden } };
            if (T.sample) b.innerHTML = sampleHtml();   // as if ✨ had written it
            T.dim = el('div', 'qwt-dim'); T.spot = el('div', 'qwt-spot'); T.hand = el('div', 'qwt-hand', '👆');
            T.bub = el('div', 'qwt-bub', '<span class="qwt-c" aria-live="polite"></span><span class="qwt-nav"><button type="button" data-k="prev" aria-label="Back" title="Back (←)">‹</button><button type="button" data-k="next" aria-label="Next" title="Next (→)">›</button><button type="button" data-k="end" aria-label="Close the tour" title="Close (Esc)">✕</button></span>');
            T.bub.setAttribute('role', 'dialog'); T.bub.setAttribute('aria-label', 'How to use Watch first');
            T.bub.addEventListener('click', function (e) { var k = e.target && e.target.getAttribute('data-k'); if (!k || !T) return; if (k === 'end') return end(); T.auto = false; go(T.i + (k === 'next' ? 1 : -1)); });
            T.dim.addEventListener('click', function (e) { e.stopPropagation(); });
            [T.dim, T.spot, T.hand, T.bub].forEach(function (e) { document.body.appendChild(e); });
            document.addEventListener('keydown', key, true);
            if (T.sample) { b.hidden = false; b.querySelectorAll('.qws-l').forEach(function (l) { l.style.opacity = 0; }); }   // the empty box; act(0) brings the lines in one by one
            T.bub.querySelector('[data-k="next"]').focus();
            go(0);
        },
        end: end,
        _on: function () { return !!T; }
    };
})();
