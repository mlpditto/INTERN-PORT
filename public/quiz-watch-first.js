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
// V101.318 (owner pick C 2026-11-17, mockup-watch-first-choice/): the story page is lean — the 🎬 chip in the runner's header already says what
// this page is, so its own heading, the quiz title in the card and the caption under it are gone. A second button, 📖 Read it, shows the whole
// story at once (no voice, no waiting); 🎬 Play goes back. The attempt stamp says `read: true` when the intern used it.
// V101.319 (owner pick A 2026-11-17, mockup-watch-first-voices/): the intern picks the pharmacist's voice — 🔇 │ 🗣 Kaitom │ 🗣 Kaidang, kept on this
// phone. A THAI story is shown only when every line has its AI voice (`a`; RX / KEY lines also `b`) — until the admin has voiced it all there is
// no Watch first page. Other languages have no AI voice and play with the phone voice as before.
// V101.321 (owner pick A, mockup-watch-first-paxa/): an OPTIONAL third pharmacist voice from Paxa Labs — when the admin picked one (`story.pv`
// = { id, name }) and every RX / KEY line carries its sound (`c`), the rail gains a third chip with that voice's name. Not part of the gate.
(function () {
    'use strict';
    var T = {
        head: { en: 'Watch first', th: 'ดูก่อนทำ', ko: '먼저 보기', ja: 'まず見る', zh: '先看' },
        sub: { en: 'before question 1', th: 'ก่อนข้อ 1', ko: '1번 문항 전', ja: '問1の前', zh: '第1题之前' },
        note: { en: 'A short film on what this quiz asks. Tap ▶ for sound.', th: 'หนังสั้นปูพื้นเรื่องที่ควิซนี้ถาม แตะ ▶ เพื่อเปิดเสียง', ko: '이 퀴즈가 묻는 내용을 담은 짧은 영상입니다. ▶ 를 누르면 소리가 납니다.', ja: 'このクイズの内容を短い映像で。▶ で音声。', zh: '本测验内容的短片。点 ▶ 播放声音。' },
        watch: { en: '▶ Watch', th: '▶ ดูหนัง', ko: '▶ 보기', ja: '▶ 見る', zh: '▶ 观看' },
        go: { en: 'Start the quiz ▸', th: 'เริ่มทำควิซ ▸', ko: '퀴즈 시작 ▸', ja: 'クイズ開始 ▸', zh: '开始测验 ▸' },
        skip: { en: 'Skip the film', th: 'ข้ามหนัง', ko: '영상 건너뛰기', ja: '映像をスキップ', zh: '跳过短片' },
        read: { en: '📖 Read it', th: '📖 อ่านเอง', ko: '📖 직접 읽기', ja: '📖 自分で読む', zh: '📖 自己读' },
        va: { en: 'Kaitom', th: 'ไข่ต้ม', ko: '카이톰', ja: 'カイトム', zh: 'Kaitom' }, vm: { en: 'Kaimook', th: 'ไข่มุก', ko: '카이묵', ja: 'カイムック', zh: 'Kaimook' }, vb: { en: 'Kaidang', th: 'ไข่แดง', ko: '카이댕', ja: 'カイデーン', zh: 'Kaidang' },
        play: { en: '🎬 Play', th: '🎬 ดูเรื่อง', ko: '🎬 재생', ja: '🎬 再生', zh: '🎬 播放' },
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
        '.qws{display:flex;flex-direction:column;height:min(54vh,410px);margin:0 0 8px;background:#e9edf5;border-radius:16px;padding:10px 10px 8px;box-sizing:border-box}' +
        '.qws-top{display:flex;align-items:center;gap:8px}.qws-t{flex:1;min-width:0;font:800 13px/1.3 Kanit,sans-serif;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.qws-snd{flex:none;width:auto;min-height:36px;margin:0;padding:0 12px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font:800 12px/1 Kanit,sans-serif;cursor:pointer}.qws-snd[aria-pressed="true"]{background:#4361ee}' +
        '.qws-prog{display:flex;gap:3px;margin:8px 2px 6px}.qws-prog i{flex:1;height:3px;border-radius:2px;background:#cbd5e1}.qws-prog i.on{background:#4361ee}' +
        '.qws-chat{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:7px;overflow:hidden}' +
        '.qws-who{font:800 11px/1 Kanit,sans-serif;color:#64748b;margin:4px 6px 0}.qws-who.rx{align-self:flex-end}' +
        '.qws-m{max-width:82%;padding:9px 13px;border-radius:16px;font:600 15px/1.4 Kanit,sans-serif;overflow-wrap:anywhere}' +
        '.qws-m.q{align-self:flex-start;background:#fff;color:#1e293b;border-bottom-left-radius:4px}.qws-m.rx{align-self:flex-end;background:#4361ee;color:#fff;border-bottom-right-radius:4px}' +
        '.qws-key{align-self:center;max-width:90%;background:#fef3c7;color:#92400e;border-radius:999px;padding:7px 14px;font:800 14px/1.35 Kanit,sans-serif;text-align:center}' +
        '.qws-m.now,.qws-key.now{box-shadow:0 0 0 2px #facc15}' +
        // V101.318: progress and 🔊 share one row; 📖 Read it beside Start the quiz; reading = every line, scrollable
        '.qws-top{min-height:36px}.qws-top .qws-prog{flex:1;margin:0 2px}' +
        '.qwf-two{display:flex;gap:8px;margin:14px 0 0}.qwf-two .qwf-go{flex:1;width:auto;margin:0}' +
        '.qwf-read{flex:none;width:auto;min-height:48px;margin:0;padding:0 14px;border:0;border-radius:12px;background:#eef2ff;color:#3730a3;font:inherit;font-size:.95em;font-weight:800;cursor:pointer;white-space:nowrap}' +
        '.qws.read .qws-chat{justify-content:flex-start;overflow-y:auto;-webkit-overflow-scrolling:touch}.qws.read .qws-chat>*{flex:none}.qws.read .qws-snd{display:none}' +
        // V101.319: the voice rail
        '.qws-rail{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}.qws-rail button{flex:none;width:auto;min-height:36px;margin:0;padding:0 12px;border:0;border-radius:999px;background:#fff;color:#475569;font:800 12px/1 Kanit,sans-serif;cursor:pointer}' +
        '.qws-rail button[aria-pressed="true"]{background:#4361ee;color:#fff}.qws.read .qws-rail{display:none}';

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
        var lg = ls.length ? (/^(th|en|ko)$/.test(st.lang) ? st.lang : 'en') : '';
        // V101.326 (owner 2026-11-20): new voices — Q `k` Kaitom, pharmacist `d` Kaimook (first) + `b` Kaidang. When every line has them they take the
        // a / b slots below (so the player is unchanged); otherwise the old set plays (Q `a` Kaimook, pharmacist `a` Kaitom + `b` Kaidang).
        var nv = lg === 'th' && ls.every(function (x) { return x.w === 'q' ? voiceUrl(x, 'k') : voiceUrl(x, 'd') && voiceUrl(x, 'b'); });
        if (nv) ls = ls.map(function (x) { return Object.assign({}, x, { a: x.w === 'q' ? x.k : x.d }); });
        if (lg === 'th' && !ls.every(function (x) { return voiceUrl(x) && (x.w === 'q' || voiceUrl(x, 'b')); })) return null;   // V101.319: a Thai story waits for all its AI voices
        var pv = st && st.pv && typeof st.pv.name === 'string' && st.pv.name.trim() ? st.pv.name.trim().slice(0, 40) : '';
        var third = lg === 'th' && !!pv && ls.every(function (x) { return x.w === 'q' || voiceUrl(x, 'c'); }) && ls.some(function (x) { return x.w !== 'q'; });
        return ls.length ? { lang: lg, lines: ls, pick: lg === 'th', third: third ? pv : '', nv: nv } : null;
    }
    function muted() { try { return localStorage.getItem('qwsMute') === '1'; } catch (e) { return false; } }
    var play = null;   // the story being played: { i, sound, done, t0, timer, n }
    function voiceUrl(x, f) { var u = x && x[f || 'a']; return typeof u === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/\S+$/.test(u) ? u : ''; }
    function voicePick() { try { var v = localStorage.getItem('qwsVoice'); return v === 'b' || v === 'c' ? v : 'a'; } catch (e) { return 'a'; } }
    function stopStory() { if (play) { clearTimeout(play.timer); play.n++; if (play.au) { try { play.au.pause(); } catch (e) { /* not playing */ } play.au = null; } } if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* nothing speaking */ } } }

    var seen = null;   // what this page saw of the film: { max, played, ended, failed }
    function record() {
        try {
            var q = currentQuiz, s = seen || {};
            if (!q || typeof userId === 'undefined' || !userId || typeof db === 'undefined') return;
            if (typeof isPracticeMode !== 'undefined' && isPracticeMode) return;
            var att = typeof quizAttemptsCache !== 'undefined' && quizAttemptsCache ? quizAttemptsCache[q.id] : null;
            if (!att || att.status !== 'started') return;
            if (play) { s.max = (Date.now() - play.t0) / 1000; s.played = play.i >= 1 || !!play.readUsed; s.ended = play.done; }   // a story: time on the page; "watched" = went past its first line
            var data = { at: Date.now(), seconds: Math.max(0, Math.round(s.max || 0)), ended: !!s.ended, skipped: !s.played, failed: !!s.failed };
            if (play) { data.kind = 'story'; if (play.readUsed) data.read = true; }
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
        var can = !!(window.speechSynthesis && window.SpeechSynthesisUtterance) || story.lines.some(function (x) { return voiceUrl(x); }), on = can && !muted();
        var k = play = { i: -1, sound: on, auto: on, done: false, t0: Date.now(), timer: null, n: 0, vf: voicePick() }, ls = story.lines;
        if (k.vf === 'c' && !story.third) k.vf = 'a';   // V101.321: this story has no Paxa voice
        var vb = function (v, label) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (v === 'off' ? !on : on && k.vf === v) + '">' + label + '</button>'; };
        seen = { max: 0, played: false, ended: false, failed: false };
        box.innerHTML = '<div class="lang-no-toggle qwf">' +
            '<div class="qws"><div class="qws-top"><div class="qws-prog">' + ls.map(function () { return '<i></i>'; }).join('') + '</div>' + (story.pick ? '' : '<button type="button" class="qws-snd" aria-pressed="' + on + '">' + (on ? '🔊' : '🔇 ' + esc(L(T.sound))) + '</button>') + '</div>' +
            (story.pick ? '<div class="qws-rail" role="group" aria-label="Voice">' + vb('off', '🔇') + vb('a', '🗣 ' + esc(L(story.nv ? T.vm : T.va))) + vb('b', '🗣 ' + esc(L(T.vb))) + (story.third ? vb('c', '🗣 ' + esc(story.third)) : '') + '</div>' : '') +
            '<div class="qws-chat" aria-live="polite"></div></div>' +
            '<div class="qwf-two"><button type="button" class="qwf-read" aria-pressed="false">' + esc(L(T.read)) + '</button><button type="button" class="qwf-go" data-state="go">' + esc(L(T.go)) + '</button></div></div>';
        var chat = box.querySelector('.qws-chat'), snd = box.querySelector('.qws-snd'), dots = box.querySelectorAll('.qws-prog i'), card = box.querySelector('.qws'), rd = box.querySelector('.qwf-read');
        var paint = function () {
            chat.innerHTML = ls.slice(0, k.read ? ls.length : k.i + 1).map(function (x, i, all) {
                var now = i === k.i && !k.done && !k.read ? ' now' : '';
                if (x.w === 'key') return '<div class="qws-key' + now + '">💡 ' + esc(x.t) + '</div>';
                var w = x.w === 'q' ? 'q' : 'rx';
                return (i === 0 || all[i - 1].w !== x.w ? '<span class="qws-who ' + w + '">' + (w === 'q' ? '🙋 ' + esc(L(T.who)) : '🧑‍⚕️ ' + esc(L(T.rx))) + '</span>' : '') + '<div class="qws-m ' + w + now + '">' + esc(x.t) + '</div>';
            }).join('');
            for (var d = 0; d < dots.length; d++) dots[d].className = k.read || d <= k.i ? 'on' : '';
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
            var src = k.sound ? (ls[k.i].w !== 'q' && k.vf !== 'a' && voiceUrl(ls[k.i], k.vf)) || voiceUrl(ls[k.i]) : '';
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
        var rail = box.querySelectorAll('.qws-rail button');
        var face = function () {
            if (snd) { snd.setAttribute('aria-pressed', String(k.sound)); snd.textContent = (k.sound ? '🔊' : '🔇 ' + L(T.sound)); }
            for (var r = 0; r < rail.length; r++) { var v = rail[r].getAttribute('data-v'); rail[r].setAttribute('aria-pressed', String(v === 'off' ? !k.sound : k.sound && k.vf === v)); }
        };
        var setSound = function (want) {
            k.sound = want; k.auto = false; face();
            try { if (k.sound) localStorage.removeItem('qwsMute'); else localStorage.setItem('qwsMute', '1'); } catch (e) { /* private window */ }   // a tap is remembered on this phone
            stopStory();
            if (k.sound) { if (k.done) { k.done = false; k.i = -1; } else if (k.i > -1) k.i--; step(); }   // say the line on screen (from the top once it has ended)
            else if (!k.done) k.timer = setTimeout(function () { step(); }, 900);
        };
        if (snd) snd.onclick = function () { setSound(!k.sound); };
        for (var ri = 0; ri < rail.length; ri++) rail[ri].onclick = function () {   // V101.319: 🔇 │ 🗣 Kaitom │ 🗣 Kaidang — the pick is kept on this phone
            var v = this.getAttribute('data-v'); if (v === 'off') return setSound(false);
            k.vf = v; try { localStorage.setItem('qwsVoice', v); } catch (e) { /* private window */ }
            setSound(true);
        };
        // V101.318 📖 Read it: the whole story at once, no voice; 🎬 Play starts the story again from its first line
        rd.onclick = function () {
            k.read = !k.read; k.auto = false; stopStory();
            card.classList.toggle('read', k.read); rd.setAttribute('aria-pressed', String(k.read)); rd.textContent = L(k.read ? T.play : T.read);
            if (k.read) { k.readUsed = true; paint(); chat.scrollTop = 0; }
            else { k.done = false; k.i = -1; step(); }
        };
        box.querySelector('.qwf-go').onclick = done;
        step();
        return true;
    }

    window.qzWatch = { onStep: onStep, urlOf: urlOf, storyOf: storyOf };
})();
