// V101.212: "Complete" — a short closing moment after the intern sends something (first used by 📰 Articles ▸ 💬 Any Q?).
// Mockup pick 2026-10-26 (mockup-complete-credits.html): a ✓ draws itself, then one of three kinds, picked at random:
//   A · a message 55 % (thank-you in another language, a pharmacy saying, a tiny fact) · B · an animation 35 % · C · a rare scene 10 %.
// Every moment lasts 3 s and a tap closes it. The same moment never plays twice in a row. The rare scene earns nothing and never says
// it is rare. With "reduce motion" on, only the ✓ + a message is shown. No brand names or logos.
(function () {
    'use strict';
    var THANKS = [['감사합니다', 'Korean'], ['ありがとう', 'Japanese'], ['谢谢', 'Chinese'], ['Gracias', 'Spanish'], ['Merci', 'French'], ['Danke', 'German'], ['Obrigado', 'Portuguese'], ['Grazie', 'Italian'], ['Terima kasih', 'Malay / Indonesian'], ['Cảm ơn', 'Vietnamese'], ['धन्यवाद', 'Hindi'], ['شكراً', 'Arabic'], ['Спасибо', 'Russian'], ['Tak', 'Danish'], ['Dziękuję', 'Polish'], ['Teşekkürler', 'Turkish']];
    var QUOTES = ['First, do no harm.', 'The dose makes the poison.', 'Ask once, save a life.', 'Every question is a safety check.', 'Right drug, right patient, right dose.'];
    var FACTS = ['Penicillin was found by accident.', 'Aspirin comes from willow bark.', 'Insulin was first used in 1922.', 'Foxglove gave us digoxin.', 'Your liver makes about 1 L of bile a day.'];
    var MS = 3000, KEY = 'cmLast';
    var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var esc = function (v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var CK = function (small) { return '<svg class="ck' + (small ? ' sm' : '') + '" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><path d="M28 52 L44 68 L74 34"/></svg>'; };
    var cap = function (t, style) { return '<div class="cap"' + (style ? ' style="' + style + '"' : '') + '>' + t + '</div>'; };
    function spark() {
        var s = '';
        for (var i = 0; i < 10; i++) { var a = i / 10 * 6.283, r = 60 + Math.random() * 30; s += '<i style="--x:' + Math.round(Math.cos(a) * r) + 'px;--y:' + Math.round(Math.sin(a) * r) + 'px;animation-delay:' + (0.35 + Math.random() * 0.15).toFixed(2) + 's">' + pick(['✨', '✦', '✧', '·']) + '</i>'; }
        return s;
    }
    var M = {
        a1: function () { var t = pick(THANKS); return { h: CK(1) + cap('Complete', 'font-size:.9rem') + '<div class="big">' + esc(t[0]) + '</div><div class="txt" style="margin-top:2px"><small>' + esc(t[1]) + '</small></div>' }; },
        a2: function () { return { h: CK(1) + cap('Complete', 'font-size:.9rem') + '<div class="txt">“' + esc(pick(QUOTES)) + '”</div>' }; },
        a3: function () { return { h: CK(1) + cap('Complete', 'font-size:.9rem') + '<div class="txt"><small>Did you know?</small>' + esc(pick(FACTS)) + '</div>' }; },
        b5a: function () { return { h: '<div class="rel">' + CK() + '<span class="cap5"></span></div>' + cap('Complete') }; },
        b5b: function () { return { h: CK() + cap('Complete') + '<svg class="ecg" viewBox="0 0 260 60" aria-hidden="true"><path d="M0 34 H70 L82 34 L92 8 L106 56 L118 34 H150 L160 28 L170 34 H260"/></svg>' }; },
        b6: function () { return { h: '<div class="env">✉️</div><div class="trail"><i style="--x:30px;--y:-40px;animation-delay:.5s"></i><i style="--x:60px;--y:-80px;animation-delay:.6s"></i><i style="--x:90px;--y:-120px;animation-delay:.7s"></i></div>' + cap('Sent ✓ Complete', 'animation:cmUp .4s .8s both') }; },
        b7: function () { return { h: '<div class="sp">' + CK() + spark() + '</div>' + cap('Complete') }; },
        c1: function () {
            var stars = ''; for (var i = 0; i < 14; i++) stars += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 60).toFixed(1) + '%;animation-delay:' + Math.random().toFixed(2) + 's"></i>';
            return { dark: 1, h: '<div class="stars">' + stars + '</div><div class="cat">🐱<span class="wave">👋</span></div><div class="txt" style="animation-delay:.9s">…and they lived pharmaceutically ever after.</div>' };
        },
        c2: function () { return { dark: 1, h: '<div class="roll"><div>Question by<br><b>You</b><br><br>Read by<br><b>Admin</b><br><br>Starring<br><b>Every pharmacist who asked</b><br><br>Coming next<br><b class="gold">Your answer</b></div></div>' }; }
    };
    var POOLS = { a: ['a1', 'a2', 'a3'], b: ['b5a', 'b5b', 'b6', 'b7'], c: ['c1', 'c2'] };
    function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
    // which moment: A 55 · B 35 · C 10, never the one played last time (remembered on this device)
    function choose(rnd, last) {
        rnd = rnd == null ? Math.random() : rnd;
        var pool = reduced() ? POOLS.a : rnd < 0.55 ? POOLS.a : rnd < 0.9 ? POOLS.b : POOLS.c;
        var opts = pool.filter(function (k) { return k !== last; });
        return pick(opts.length ? opts : pool);
    }
    function css() {
        if (document.getElementById('cm-css')) return;
        var s = document.createElement('style'); s.id = 'cm-css';
        s.textContent = '#cm-back{position:fixed;inset:0;z-index:10060;background:rgba(15,23,42,.45);display:grid;place-items:center;animation:cmFade .15s ease-out}' +
            '#cm-card{width:min(320px,calc(100vw - 32px));height:300px;border-radius:26px;background:#fff;box-shadow:0 14px 40px rgba(15,23,42,.25);position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Kanit,sans-serif;cursor:pointer;padding:0 18px;box-sizing:border-box}' +
            '#cm-card.dark{background:radial-gradient(circle at 50% 30%,#312e81,#0f172a)}#cm-card.dark .txt{color:#e0e7ff}' +
            '#cm-card .ck{width:92px;height:92px;flex:none}#cm-card .ck.sm{width:64px;height:64px}#cm-card .ck circle{fill:none;stroke:#16a34a;stroke-width:6;stroke-dasharray:289;stroke-dashoffset:289;animation:cmDraw .45s ease-out forwards}' +
            '#cm-card .ck path{fill:none;stroke:#16a34a;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60;animation:cmDraw .3s .35s ease-out forwards}' +
            '#cm-card .cap{font-weight:900;color:#15803d;margin-top:8px;font-size:1.05rem;text-align:center}' +
            '#cm-card .txt{margin-top:10px;text-align:center;color:#334155;font-weight:700;line-height:1.35;animation:cmUp .4s .5s both}#cm-card .txt small{display:block;color:#94a3b8;font-weight:600;font-size:.72em;margin-top:3px}' +
            '#cm-card .big{font-size:1.9rem;color:#4c1d95;font-weight:900;animation:cmUp .4s .2s both;text-align:center}' +
            '#cm-card .rel{position:relative;display:grid;place-items:center}#cm-card .cap5{position:absolute;width:36px;height:14px;border-radius:99px;background:linear-gradient(90deg,#f43f5e 50%,#fff 50%);border:2px solid #be123c;top:-26px;left:50%;margin-left:-18px;animation:cmSpin 1s .5s ease-in-out both}' +
            '#cm-card .ecg{width:240px;height:60px;margin-top:10px}#cm-card .ecg path{fill:none;stroke:#ef4444;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:420;stroke-dashoffset:420;animation:cmDraw 1s .3s ease-out forwards}' +
            '#cm-card .env{font-size:3.6rem;animation:cmFly 1.1s ease-in forwards}#cm-card .trail{position:absolute;left:50%;top:45%}#cm-card .trail i{position:absolute;width:6px;height:6px;border-radius:50%;background:#a5b4fc;opacity:0;animation:cmTr 1s ease-out forwards}' +
            '#cm-card .sp{position:relative;width:92px;height:92px}#cm-card .sp i{position:absolute;left:50%;top:50%;font-style:normal;font-size:1.1rem;animation:cmBurst .9s .35s ease-out both}' +
            '#cm-card .stars i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;animation:cmTw 1.4s infinite alternate}' +
            '#cm-card .cat{font-size:4.4rem;animation:cmPeek .6s ease-out both;transform-origin:50% 100%}#cm-card .cat .wave{display:inline-block;animation:cmWave .5s .6s 4 alternate ease-in-out}' +
            '#cm-card .roll{position:absolute;inset:20px 0;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 20%,#000 80%,transparent);mask-image:linear-gradient(transparent,#000 20%,#000 80%,transparent)}' +
            '#cm-card .roll>div{position:absolute;left:0;right:0;text-align:center;color:#e0e7ff;font-weight:700;line-height:2.1;animation:cmRoll 2.9s linear forwards}#cm-card .roll b{color:#fff}#cm-card .roll b.gold{color:#fbbf24}' +
            '@keyframes cmDraw{to{stroke-dashoffset:0}}@keyframes cmUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes cmFade{from{opacity:0}to{opacity:1}}' +
            '@keyframes cmSpin{from{transform:translateY(-60px) rotate(0);opacity:0}30%{opacity:1}to{transform:translateY(0) rotate(720deg);opacity:1}}' +
            '@keyframes cmFly{0%{transform:scale(.4) rotate(-10deg);opacity:0}25%{transform:scale(1) rotate(0);opacity:1}60%{transform:translate(0,0) scale(1)}100%{transform:translate(120px,-160px) scale(.3) rotate(18deg);opacity:0}}' +
            '@keyframes cmTr{from{opacity:.9;transform:translate(0,0)}to{opacity:0;transform:translate(var(--x),var(--y))}}' +
            '@keyframes cmBurst{from{opacity:0;transform:translate(-50%,-50%) scale(.2)}30%{opacity:1}to{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(1.1)}}' +
            '@keyframes cmTw{from{opacity:.2}to{opacity:1}}@keyframes cmPeek{from{transform:translateY(110px) scale(.8)}to{transform:none}}@keyframes cmWave{from{transform:rotate(-14deg)}to{transform:rotate(18deg)}}@keyframes cmRoll{from{top:240px}to{top:-170px}}' +
            '@media (prefers-reduced-motion: reduce){#cm-back,#cm-card *{animation-duration:.01s!important;animation-delay:0s!important}}';
        document.head.appendChild(s);
    }
    // plays one moment; resolves when it closes (after 3 s, or on a tap / any key)
    function play(key) {
        var last = ''; try { last = localStorage.getItem(KEY) || ''; } catch (e) { /* private mode */ }
        var k = M[key] ? key : choose(null, last);
        try { localStorage.setItem(KEY, k); } catch (e) { /* private mode */ }
        css();
        var m = M[k](), old = document.getElementById('cm-back'); if (old) old.remove();
        var back = document.createElement('div'); back.id = 'cm-back'; back.className = 'lang-no-toggle';
        back.innerHTML = '<div id="cm-card" role="status" aria-live="polite" data-moment="' + k + '"' + (m.dark ? ' class="dark"' : '') + '>' + m.h + '</div>';
        document.body.appendChild(back);
        return new Promise(function (resolve) {
            var t = setTimeout(done, MS);
            function done() { clearTimeout(t); document.removeEventListener('keydown', done, true); if (back.parentNode) back.remove(); resolve(k); }
            back.addEventListener('click', done);
            document.addEventListener('keydown', done, true);
        });
    }
    window.completeMoment = play;
    window.completeMoment._choose = choose;
    window.completeMoment._keys = Object.keys(M);
})();
