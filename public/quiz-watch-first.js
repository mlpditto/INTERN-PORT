// V101.313 🎬 Watch first (owner pick A 2026-11-16, mockup-watch-first/): a quiz that carries a short film (`watchFirst.url`, set in the
// Quiz Editor) opens on ONE page before question 1 — the film, the quiz's topics, then the quiz. 📖 Read first of each question follows as before.
// Nothing is counted while this page is up (it sits where Read first sits: before the timer). The film can be skipped. Shown once per run
// (the flag rides on the runner's `primerSeen`, which is reset for every run). Nothing is written to Firestore.
(function () {
    'use strict';
    var T = {
        head: { en: 'Watch first', th: 'ดูก่อนทำ', ko: '먼저 보기', ja: 'まず見る', zh: '先看' },
        sub: { en: 'before question 1', th: 'ก่อนข้อ 1', ko: '1번 문항 전', ja: '問1の前', zh: '第1题之前' },
        note: { en: 'A short film on what this quiz asks. Tap ▶ for sound.', th: 'หนังสั้นปูพื้นเรื่องที่ควิซนี้ถาม แตะ ▶ เพื่อเปิดเสียง', ko: '이 퀴즈가 묻는 내용을 담은 짧은 영상입니다. ▶ 를 누르면 소리가 납니다.', ja: 'このクイズの内容を短い映像で。▶ で音声。', zh: '本测验内容的短片。点 ▶ 播放声音。' },
        watch: { en: '▶ Watch', th: '▶ ดูหนัง', ko: '▶ 보기', ja: '▶ 見る', zh: '▶ 观看' },
        go: { en: 'Start the quiz ▸', th: 'เริ่มทำควิซ ▸', ko: '퀴즈 시작 ▸', ja: 'クイズ開始 ▸', zh: '开始测验 ▸' },
        skip: { en: 'Skip the film', th: 'ข้ามหนัง', ko: '영상 건너뛰기', ja: '映像をスキップ', zh: '跳过短片' },
        fail: { en: 'The film could not load — you can start the quiz.', th: 'โหลดหนังไม่ได้ — เริ่มทำควิซได้เลย', ko: '영상을 불러오지 못했습니다 — 퀴즈를 시작할 수 있습니다.', ja: '映像を読み込めません — クイズを開始できます。', zh: '短片无法加载 — 可以开始测验。' }
    };
    var STYLE = '.qwf{padding:2px 0 4px}.qwf-h{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;font-weight:800;font-size:1.05em;color:#1e293b}.qwf-h small{font-weight:600;font-size:.76em;color:#64748b}' +
        '.qwf-v{display:block;width:100%;aspect-ratio:16/9;border-radius:14px;background:#0f172a;margin:0 0 8px}' +
        '.qwf-n{font-size:.8em;color:#64748b;line-height:1.5;margin:0}.qwf-n.bad{color:#b45309;font-weight:700}' +
        '.qwf-t{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}.qwf-t span{font-size:.74em;font-weight:700;border-radius:999px;padding:3px 9px;background:#eef2ff;color:#3730a3}' +
        '.qwf-go{display:block;width:100%;min-height:48px;margin:14px 0 0;border:0;border-radius:12px;background:var(--primary,#4361ee);color:#fff;font:inherit;font-size:1em;font-weight:800;cursor:pointer}' +
        '.qwf-skip{display:block;width:auto;min-height:44px;margin:4px auto 0;padding:0 12px;border:0;background:none;color:#64748b;font:inherit;font-size:.82em;text-decoration:underline;cursor:pointer}.qwf-skip[hidden]{display:none}';

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

    function done() {
        try { primerSeen.watch = true; stepStartTimestamp = Date.now(); } catch (e) { /* the runner's own state */ }
        var v = document.querySelector('.qwf-v'); if (v) { try { v.pause(); } catch (e) { /* not playing */ } }
        renderQuizStep(currentQuiz.timerMode === 'total_time');
    }

    // called by renderQuizStep right before its 📖 Read first page; true = this page is on screen, the runner stops there
    function onStep(box) {
        var q = typeof currentQuiz !== 'undefined' ? currentQuiz : null, url = urlOf(q);
        if (!url || !box || typeof currentStep === 'undefined' || currentStep !== 0) return false;
        if (typeof primerSeen === 'undefined' || !primerSeen || primerSeen.watch) return false;
        if (!document.getElementById('qwf-css')) { var s = document.createElement('style'); s.id = 'qwf-css'; s.textContent = STYLE; document.head.appendChild(s); }
        var tags = (Array.isArray(q.tagList) ? q.tagList : []).filter(function (t) { return typeof t === 'string' && t.trim(); }).slice(0, 4);
        var qtm = document.getElementById('quiz-q-timer'); if (qtm) { qtm.innerText = ''; qtm.style.color = ''; }
        var bdg = document.getElementById('quiz-q-type-badge'); if (bdg) { bdg.innerText = '🎬'; bdg.title = L(T.head); }
        ['btn-quiz-prev', 'btn-quiz-next', 'btn-quiz-submit', 'btn-quiz-primer-start', 'btn-quiz-break'].forEach(function (id) { var b = document.getElementById(id); if (b) b.style.display = 'none'; });
        box.innerHTML = '<div class="lang-no-toggle qwf"><div class="qwf-h">🎬 ' + esc(L(T.head)) + '<small>· ' + esc(L(T.sub)) + '</small></div>' +
            '<video class="qwf-v" playsinline controls preload="metadata" src="' + esc(url) + '"></video>' +
            '<p class="qwf-n">' + esc(L(T.note)) + '</p>' +
            (tags.length ? '<div class="qwf-t">' + tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
            '<button type="button" class="qwf-go" data-state="watch">' + esc(L(T.watch)) + '</button>' +
            '<button type="button" class="qwf-skip">' + esc(L(T.skip)) + '</button></div>';
        var v = box.querySelector('.qwf-v'), go = box.querySelector('.qwf-go'), skip = box.querySelector('.qwf-skip'), note = box.querySelector('.qwf-n');
        var ready = function () { go.dataset.state = 'go'; go.textContent = L(T.go); skip.hidden = true; };
        v.addEventListener('play', ready);     // also when the intern uses the player's own ▶
        v.addEventListener('error', function () { note.textContent = L(T.fail); note.classList.add('bad'); ready(); });
        go.onclick = function () {
            if (go.dataset.state === 'go') return done();
            var p; try { p = v.play(); } catch (e) { p = null; }
            if (p && typeof p.catch === 'function') p.catch(function () { /* the error event says why */ });
            ready();
        };
        skip.onclick = done;
        return true;
    }

    window.qzWatch = { onStep: onStep, urlOf: urlOf };
})();
