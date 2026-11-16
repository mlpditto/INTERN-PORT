// V101.313 🎬 Watch first (owner pick A 2026-11-16, mockup-watch-first/): a quiz that carries a short film (`watchFirst.url`, set in the
// Quiz Editor) opens on ONE page before question 1 — the film, the quiz's topics, then the quiz. 📖 Read first of each question follows as before.
// Nothing is counted while this page is up (it sits where Read first sits: before the timer). The film can be skipped. Shown once per run
// (the flag rides on the runner's `primerSeen`, which is reset for every run).
// V101.314 (owner: "บันทึกว่าใครดู"): leaving the page stamps the intern's own attempt (quiz_attempts/{quizId}_{userId}, merge) with
// `watchFirst: { at, seconds, ended, skipped, failed }` — seconds = the furthest point reached. Not in practice mode, and only when the
// run has its started attempt, so no stray document is made. A failed write never holds the quiz back.
// V101.315 (owner pick C1, mockup-watch-first/c.html): a quiz with no film link but a STORY (`watchFirst.story.lines`, written in the Quiz Editor
// from its own Read first notes) plays it here as a chat — an intern asks, a pharmacist answers, 💡 key lines — one line at a time, muted with
// its text; a tap turns the phone's voice on. No video file. A film link wins when a quiz has both.
(function () {
    'use strict';
    var T = {
        head: { en: 'Watch first', th: 'ดูก่อนทำ', ko: '먼저 보기', ja: 'まず見る', zh: '先看' },
        sub: { en: 'before question 1', th: 'ก่อนข้อ 1', ko: '1번 문항 전', ja: '問1の前', zh: '第1题之前' },
        note: { en: 'A short film on what this quiz asks. Tap ▶ for sound.', th: 'หนังสั้นปูพื้นเรื่องที่ควิซนี้ถาม แตะ ▶ เพื่อเปิดเสียง', ko: '이 퀴즈가 묻는 내용을 담은 짧은 영상입니다. ▶ 를 누르면 소리가 납니다.', ja: 'このクイズの内容を短い映像で。▶ で音声。', zh: '本测验内容的短片。点 ▶ 播放声音。' },
        watch: { en: '▶ Watch', th: '▶ ดูหนัง', ko: '▶ 보기', ja: '▶ 見る', zh: '▶ 观看' },
        go: { en: 'Start the quiz ▸', th: 'เริ่มทำควิซ ▸', ko: '퀴즈 시작 ▸', ja: 'クイズ開始 ▸', zh: '开始测验 ▸' },
        skip: { en: 'Skip the film', th: 'ข้ามหนัง', ko: '영상 건너뛰기', ja: '映像をスキップ', zh: '跳过短片' },
        snote: { en: 'A short story from this quiz\'s Read first notes.', th: 'เรื่องเล่าสั้นจาก Read first ของควิซนี้', ko: '이 퀴즈의 Read first 내용을 담은 짧은 이야기', ja: 'このクイズの Read first からの短い話', zh: '来自本测验 Read first 的小故事' },
        sound: { en: 'Tap for sound', th: 'แตะเพื่อเปิดเสียง', ko: '눌러서 소리 켜기', ja: 'タップで音声', zh: '点击开启声音' },
        who: { en: 'Intern', th: 'น้องฝึกงาน', ko: '인턴', ja: '実習生', zh: '实习生' },
        rx: { en: 'Pharmacist', th: 'เภสัชกร', ko: '약사', ja: '薬剤師', zh: '药师' },
        fail: { en: 'The film could not load — you can start the quiz.', th: 'โหลดหนังไม่ได้ — เริ่มทำควิซได้เลย', ko: '영상을 불러오지 못했습니다 — 퀴즈를 시작할 수 있습니다.', ja: '映像を読み込めません — クイズを開始できます。', zh: '短片无法加载 — 可以开始测验。' }
    };
    var STYLE = '.qwf{padding:2px 0 4px}.qwf-h{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;font-weight:800;font-size:1.05em;color:#1e293b}.qwf-h small{font-weight:600;font-size:.76em;color:#64748b}' +
        '.qwf-v{display:block;width:100%;aspect-ratio:16/9;border-radius:14px;background:#0f172a;margin:0 0 8px}' +
        '.qwf-n{font-size:.8em;color:#64748b;line-height:1.5;margin:0}.qwf-n.bad{color:#b45309;font-weight:700}' +
        '.qwf-t{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}.qwf-t span{font-size:.74em;font-weight:700;border-radius:999px;padding:3px 9px;background:#eef2ff;color:#3730a3}' +
        '.qwf-go{display:block;width:100%;min-height:48px;margin:14px 0 0;border:0;border-radius:12px;background:var(--primary,#4361ee);color:#fff;font:inherit;font-size:1em;font-weight:800;cursor:pointer}' +
        '.qwf-skip{display:block;width:auto;min-height:44px;margin:4px auto 0;padding:0 12px;border:0;background:none;color:#64748b;font:inherit;font-size:.82em;text-decoration:underline;cursor:pointer}.qwf-skip[hidden]{display:none}' +
        // the story — the look of the article clips (articles.js .clp-*)
        '.qws{display:flex;flex-direction:column;height:min(46vh,340px);margin:0 0 8px;background:#e9edf5;border-radius:16px;padding:10px 10px 8px;box-sizing:border-box}' +
        '.qws-top{display:flex;align-items:center;gap:8px}.qws-t{flex:1;min-width:0;font:800 13px/1.3 Kanit,sans-serif;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.qws-snd{flex:none;width:auto;min-height:36px;margin:0;padding:0 12px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font:800 12px/1 Kanit,sans-serif;cursor:pointer}.qws-snd[aria-pressed="true"]{background:#4361ee}' +
        '.qws-prog{display:flex;gap:3px;margin:8px 2px 6px}.qws-prog i{flex:1;height:3px;border-radius:2px;background:#cbd5e1}.qws-prog i.on{background:#4361ee}' +
        '.qws-chat{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:7px;overflow:hidden}' +
        '.qws-who{font:800 11px/1 Kanit,sans-serif;color:#64748b;margin:4px 6px 0}.qws-who.rx{align-self:flex-end}' +
        '.qws-m{max-width:82%;padding:9px 13px;border-radius:16px;font:600 15px/1.4 Kanit,sans-serif;overflow-wrap:anywhere}' +
        '.qws-m.q{align-self:flex-start;background:#fff;color:#1e293b;border-bottom-left-radius:4px}.qws-m.rx{align-self:flex-end;background:#4361ee;color:#fff;border-bottom-right-radius:4px}' +
        '.qws-key{align-self:center;max-width:90%;background:#fef3c7;color:#92400e;border-radius:999px;padding:7px 14px;font:800 14px/1.35 Kanit,sans-serif;text-align:center}' +
        '.qws-m.now,.qws-key.now{box-shadow:0 0 0 2px #facc15}';

    function lang() {
        try {
            var sel = typeof qtGetSelectedLang === 'function' ? qtGetSelectedLang() : 'orig';
            return sel === 'orig' && typeof qtQuizSourceLang === 'function' ? qtQuizSourceLang() : sel;
        } catch (e) { return 'en'; }
    }
    function L(o) { return o[lang()] || o.en; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    // the film of a quiz: an https link only (anything else is treated as "no film")
    function urlOf(q) { var u = q && q.watchFirst && typeof q.watchFirst.url === 'string' ? q.watchFirst.url.trim() : ''; return /^https:\/\/\S+$/i.test(u) ? u : ''; }

    // the story of a quiz: text lines only, each said by q (the intern), rx (the pharmacist) or key (a point to remember)
    function storyOf(q) {
        var st = q && q.watchFirst && q.watchFirst.story, ls = st && Array.isArray(st.lines) ? st.lines.filter(function (x) { return x && /^(q|rx|key)$/.test(x.w) && typeof x.t === 'string' && x.t.trim(); }).slice(0, 24) : [];
        return ls.length ? { lang: /^(th|en|ko)$/.test(st.lang) ? st.lang : 'en', lines: ls } : null;
    }
    function muted() { try { return localStorage.getItem('qwsMute') === '1'; } catch (e) { return false; } }
    var play = null;   // the story being played: { i, sound, done, t0, timer, n }
    function voiceUrl(x) { return x && typeof x.a === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/\S+$/.test(x.a) ? x.a : ''; }
    function stopStory() { if (play) { clearTimeout(play.timer); play.n++; if (play.au) { try { play.au.pause(); } catch (e) { /* not playing */ } play.au = null; } } if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* nothing speaking */ } } }

    var seen = null;   // what this page saw of the film: { max, played, ended, failed }
    function record() {
        try {
            var q = currentQuiz, s = seen || {};
            if (!q || typeof userId === 'undefined' || !userId || typeof db === 'undefined') return;
            if (typeof isPracticeMode !== 'undefined' && isPracticeMode) return;
            var att = typeof quizAttemptsCache !== 'undefined' && quizAttemptsCache ? quizAttemptsCache[q.id] : null;
            if (!att || att.status !== 'started') return;
            if (play) { s.max = (Date.now() - play.t0) / 1000; s.played = play.i >= 1; s.ended = play.done; }   // a story: time on the page; "watched" = went past its first line
            var data = { at: Date.now(), seconds: Math.max(0, Math.round(s.max || 0)), ended: !!s.ended, skipped: !s.played, failed: !!s.failed };
            if (play) data.kind = 'story';
            quizAttemptsCache[q.id] = Object.assign({}, att, { watchFirst: data });
            var w = db.collection('quiz_attempts').doc(q.id + '_' + userId).set({ watchFirst: data }, { merge: true });
            if (w && typeof w.catch === 'function') w.catch(function (e) { console.warn('[qzWatch] not recorded', e && e.message); });
        } catch (e) { console.warn('[qzWatch] not recorded', e && e.message); }
    }
    function done() {
        record(); stopStory(); play = null;
        try { primerSeen.watch = true; stepStartTimestamp = Date.now(); } catch (e) { /* the runner's own state */ }
        var v = document.querySelector('.qwf-v'); if (v) { try { v.pause(); } catch (e) { /* not playing */ } }
        renderQuizStep(currentQuiz.timerMode === 'total_time');
    }

    // called by renderQuizStep right before its 📖 Read first page; true = this page is on screen, the runner stops there
    function onStep(box) {
        var q = typeof currentQuiz !== 'undefined' ? currentQuiz : null, url = urlOf(q), story = url ? null : storyOf(q);
        if ((!url && !story) || !box || typeof currentStep === 'undefined' || currentStep !== 0) return false;
        if (typeof primerSeen === 'undefined' || !primerSeen || primerSeen.watch) return false;
        if (!document.getElementById('qwf-css')) { var s = document.createElement('style'); s.id = 'qwf-css'; s.textContent = STYLE; document.head.appendChild(s); }
        var tags = (Array.isArray(q.tagList) ? q.tagList : []).filter(function (t) { return typeof t === 'string' && t.trim(); }).slice(0, 4);
        var qtm = document.getElementById('quiz-q-timer'); if (qtm) { qtm.innerText = ''; qtm.style.color = ''; }
        var bdg = document.getElementById('quiz-q-type-badge'); if (bdg) { bdg.innerText = '🎬'; bdg.title = L(T.head); }
        ['btn-quiz-prev', 'btn-quiz-next', 'btn-quiz-submit', 'btn-quiz-primer-start', 'btn-quiz-break'].forEach(function (id) { var b = document.getElementById(id); if (b) b.style.display = 'none'; });
        if (story) return storyPage(box, q, story);
        stopStory(); play = null;
        box.innerHTML = '<div class="lang-no-toggle qwf"><div class="qwf-h">🎬 ' + esc(L(T.head)) + '<small>· ' + esc(L(T.sub)) + '</small></div>' +
            '<video class="qwf-v" playsinline controls preload="metadata" src="' + esc(url) + '"></video>' +
            '<p class="qwf-n">' + esc(L(T.note)) + '</p>' +
            (tags.length ? '<div class="qwf-t">' + tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
            '<button type="button" class="qwf-go" data-state="watch">' + esc(L(T.watch)) + '</button>' +
            '<button type="button" class="qwf-skip">' + esc(L(T.skip)) + '</button></div>';
        var v = box.querySelector('.qwf-v'), go = box.querySelector('.qwf-go'), skip = box.querySelector('.qwf-skip'), note = box.querySelector('.qwf-n');
        var ready = function () { go.dataset.state = 'go'; go.textContent = L(T.go); skip.hidden = true; };
        seen = { max: 0, played: false, ended: false, failed: false };
        v.addEventListener('play', function () { seen.played = true; ready(); });     // also when the intern uses the player's own ▶
        v.addEventListener('timeupdate', function () { if (v.currentTime > seen.max) seen.max = v.currentTime; });
        v.addEventListener('ended', function () { seen.ended = true; if (v.duration && isFinite(v.duration)) seen.max = Math.max(seen.max, v.duration); });
        v.addEventListener('error', function () { seen.failed = true; note.textContent = L(T.fail); note.classList.add('bad'); ready(); });
        go.onclick = function () {
            if (go.dataset.state === 'go') return done();
            var p; try { p = v.play(); } catch (e) { p = null; }
            if (p && typeof p.catch === 'function') p.catch(function () { /* the error event says why */ });
            ready();
        };
        skip.onclick = done;
        return true;
    }

    // V101.315: the story page — lines appear one by one (muted: timed by their length; with sound: when the voice has said them)
    // V101.316: the voice is ON when the page opens (owner 2026-11-16) unless this phone's intern muted it before
    function storyPage(box, q, story) {
        stopStory();
        var can = !!(window.speechSynthesis && window.SpeechSynthesisUtterance) || story.lines.some(voiceUrl), on = can && !muted();
        var k = play = { i: -1, sound: on, auto: on, done: false, t0: Date.now(), timer: null, n: 0 }, ls = story.lines;
        seen = { max: 0, played: false, ended: false, failed: false };
        box.innerHTML = '<div class="lang-no-toggle qwf"><div class="qwf-h">🎬 ' + esc(L(T.head)) + '<small>· ' + esc(L(T.sub)) + '</small></div>' +
            '<div class="qws"><div class="qws-top"><span class="qws-t">🎬 ' + esc(q.title || '') + '</span><button type="button" class="qws-snd" aria-pressed="' + on + '">' + (on ? '🔊' : '🔇 ' + esc(L(T.sound))) + '</button></div>' +
            '<div class="qws-prog">' + ls.map(function () { return '<i></i>'; }).join('') + '</div><div class="qws-chat" aria-live="polite"></div></div>' +
            '<p class="qwf-n">' + esc(L(T.snote)) + '</p><button type="button" class="qwf-go" data-state="go">' + esc(L(T.go)) + '</button></div>';
        var chat = box.querySelector('.qws-chat'), snd = box.querySelector('.qws-snd'), dots = box.querySelectorAll('.qws-prog i');
        var paint = function () {
            chat.innerHTML = ls.slice(0, k.i + 1).map(function (x, i, all) {
                var now = i === k.i && !k.done ? ' now' : '';
                if (x.w === 'key') return '<div class="qws-key' + now + '">💡 ' + esc(x.t) + '</div>';
                var w = x.w === 'q' ? 'q' : 'rx';
                return (i === 0 || all[i - 1].w !== x.w ? '<span class="qws-who ' + w + '">' + (w === 'q' ? '🙋 ' + esc(L(T.who)) : '🧑‍⚕️ ' + esc(L(T.rx))) + '</span>' : '') + '<div class="qws-m ' + w + now + '">' + esc(x.t) + '</div>';
            }).join('');
            for (var d = 0; d < dots.length; d++) dots[d].className = d <= k.i ? 'on' : '';
        };
        var step = function () {
            if (play !== k || !document.body.contains(chat)) return stopStory();   // the page is gone (quiz closed)
            if (k.i >= ls.length - 1) { k.done = true; return paint(); }
            k.i++; paint();
            var n = k.n, ms = 1100 + ls[k.i].t.length * 60, fired = false;
            var next = function () { if (fired || play !== k || k.n !== n) return; fired = true; clearTimeout(k.timer); step(); };
            var heard = false, quiet = function () {
                if (fired || play !== k || k.n !== n) return;
                k.sound = k.auto = false; face(); stopStory(); k.timer = setTimeout(function () { step(); }, Math.max(300, ms - 1500));
            };
            // V101.317: a line the admin voiced with AI (`a`, a Storage link) is played as that sound; a sound that will not load → the phone voice says it.
            var src = k.sound ? voiceUrl(ls[k.i]) : '';
            if (src && typeof Audio === 'function') {
                try {
                    var au = k.au = new Audio(src), fell = false, fall = function () { if (fell || fired || play !== k || k.n !== n) return; fell = true; clearTimeout(k.timer); if (k.auto) quiet(); else if (!say()) k.timer = setTimeout(next, ms); };
                    au.onended = function () { heard = true; k.auto = false; k.timer = setTimeout(next, 250); };
                    au.onerror = fall;
                    var pr = au.play(); k.timer = setTimeout(next, ms + 15000);
                    if (pr && typeof pr.then === 'function') pr.then(function () { heard = true; k.auto = false; }, fall);
                    return;
                } catch (e) { /* no player: the phone voice */ }
            }
            if (k.sound && say()) return;
            k.timer = setTimeout(next, ms);
            function say() {
                if (!(window.speechSynthesis && window.SpeechSynthesisUtterance)) return false;
                try {
                    var u = new SpeechSynthesisUtterance(ls[k.i].t); u.lang = { th: 'th-TH', en: 'en-US', ko: 'ko-KR' }[story.lang] || 'en-US';
                    // V101.316: the voice starts by itself. A phone that refuses a voice nobody tapped for (or has none) says nothing —
                    // then the page goes quiet: 🔇 Tap for sound, lines timed by their length, as before.
                    u.onstart = function () { heard = true; k.auto = false; };
                    u.onend = function () { heard = true; k.auto = false; k.timer = setTimeout(next, 250); };
                    u.onerror = function () { if (k.auto) quiet(); else next(); };
                    window.speechSynthesis.speak(u); k.timer = setTimeout(next, ms + 5000);
                    if (k.auto) setTimeout(function () { if (!heard && k.auto) quiet(); }, 1500);
                    return true;
                } catch (e) { return false; }
            }
        };
        var face = function () { snd.setAttribute('aria-pressed', String(k.sound)); snd.textContent = (k.sound ? '🔊' : '🔇 ' + L(T.sound)); };
        snd.onclick = function () {
            k.sound = !k.sound; k.auto = false; face();
            try { if (k.sound) localStorage.removeItem('qwsMute'); else localStorage.setItem('qwsMute', '1'); } catch (e) { /* private window */ }   // a tap is remembered on this phone
            stopStory();
            if (k.sound) { if (k.done) { k.done = false; k.i = -1; } else if (k.i > -1) k.i--; step(); }   // say the line on screen (from the top once it has ended)
            else if (!k.done) k.timer = setTimeout(function () { step(); }, 900);
        };
        box.querySelector('.qwf-go').onclick = done;
        step();
        return true;
    }

    window.qzWatch = { onStep: onStep, urlOf: urlOf, storyOf: storyOf };
})();
