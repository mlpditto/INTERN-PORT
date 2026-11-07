// V101.288 🚩 Flag a sentence for the admin (owner picks 2026-11-07: "2 + 3", card V2, tutorial T3 — mockup-quiz-flag-report.html /
// mockup-quiz-flag-tutorial.html). During a quiz: 🚩 in the header → tap a sentence on 📖 Read first, in the question or in a choice → it turns
// yellow and a small card offers a reason (❌ ✏️ ❓ 🕰) + a note. Nothing is saved until the quiz ends: the feedback form lists the flags and
// they ride the quiz_feedback doc (`flags`), or a flags-only doc when the form is skipped. The clock keeps running; answers are untouched.
// A 5 s how-to bubble under 🚩 shows on every Read first page until "don't show again in this quiz" is ticked (per quiz run).
(function () {
    'use strict';
    var L = function (o) { return o[lang()] || o.en; };
    var T = {
        tut: { en: 'Something looks wrong? Tap 🚩 → tap the sentence → pick a reason', th: 'เจอจุดผิด? แตะ 🚩 → แตะประโยค → เลือกเหตุผล', ko: '틀린 곳이 있나요? 🚩 → 문장 탭 → 이유 선택', ja: '間違いを見つけたら 🚩 → 文をタップ → 理由を選択', zh: '发现错误？点 🚩 → 点句子 → 选原因' },
        tick: { en: "Don't show again in this quiz", th: 'ไม่ต้องสอนอีกจนจบ quiz นี้', ko: '이 퀴즈에서는 다시 보지 않기', ja: 'このクイズでは表示しない', zh: '本测验内不再显示' },
        note: { en: 'Note (optional)', th: 'โน้ต (ไม่ต้องก็ได้)', ko: '메모 (선택)', ja: 'メモ (任意)', zh: '备注（可选）' },
        done: { en: 'Done', th: 'เสร็จ', ko: '완료', ja: '完了', zh: '完成' },
        bar: { en: 'tap a sentence', th: 'แตะประโยคที่สงสัย', ko: '문장을 탭하세요', ja: '文をタップ', zh: '点一下句子' },
        btn: { en: 'Flag a mistake', th: 'แจ้งจุดที่อาจผิด', ko: '오류 신고', ja: '誤りを報告', zh: '报告错误' },
        list: { en: 'Flagged', th: 'จุดที่แจ้ง', ko: '신고한 곳', ja: '報告した箇所', zh: '已报告' },
        primer: { en: 'Read first', th: 'อ่านก่อน', ko: '먼저 읽기', ja: '先に読む', zh: '先读' },
        q: { en: 'Q', th: 'ข้อ', ko: '문항', ja: '問', zh: '题' },
        opt: { en: 'choice', th: 'ตัวเลือก', ko: '보기', ja: '選択肢', zh: '选项' }
    };
    var REASONS = [
        ['wrong', '❌', { en: 'Wrong', th: 'ผิด', ko: '오류', ja: '誤り', zh: '错误' }],
        ['unclear', '❓', { en: 'Unclear', th: 'ไม่ชัด', ko: '불명확', ja: '不明瞭', zh: '不清楚' }],
        ['typo', '✏️', { en: 'Typo', th: 'พิมพ์ผิด', ko: '오타', ja: '誤字', zh: '错字' }],
        ['outdated', '🕰', { en: 'Outdated', th: 'ล้าสมัย', ko: '구식', ja: '古い', zh: '过时' }]
    ];
    // what can be flagged: a list item, a paragraph, the question line, a choice's text, a heading
    var SEL = '.qt-choice-list label > span, li, p, .qzh-ask, .qzh-ref, h1, h2, h3, h4';
    var SEL_ALL = SEL + ', .md-render';   // a .md-render without paragraphs (the plain-text fallback renderer) is a block of its own

    var flags = [], quizRef = null, mode = false, tutOff = false, openCard = null;

    function lang() {
        try {
            if (document.getElementById('quizFeedbackModal') && document.getElementById('quizFeedbackModal').style.display === 'flex' && window.fbLang && fbLang.current) return fbLang.current();
            var sel = typeof qtGetSelectedLang === 'function' ? qtGetSelectedLang() : 'orig';
            return sel === 'orig' && typeof qtQuizSourceLang === 'function' ? qtQuizSourceLang() : sel;
        } catch (e) { return 'en'; }
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function cq() { return typeof currentQuiz !== 'undefined' ? currentQuiz : null; }
    function step() { return typeof currentStep !== 'undefined' ? currentStep : 0; }
    // only where the feedback form follows the quiz (standard, not the one-time practice run) — that is where the flags are sent
    function allowed() {
        var q = cq();
        return !!(q && q.questions && (q.quizType === 'standard' || !q.quizType) && !(typeof isPracticeMode !== 'undefined' && isPracticeMode));
    }
    function box() { return document.getElementById('quiz-run-container'); }
    function modal() { return document.getElementById('quizModal'); }
    function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

    // ---- header button + bottom bar
    function ensureUi() {
        var head = document.querySelector('#quizModal .quiz-focus-header');
        if (head && !document.getElementById('qz-flag-btn')) {
            var b = document.createElement('button');
            b.type = 'button'; b.id = 'qz-flag-btn'; b.className = 'qzf-btn'; b.textContent = '🚩';
            b.setAttribute('aria-pressed', 'false');
            b.onclick = function (e) { e.stopPropagation(); setMode(!mode); };
            head.insertBefore(b, head.querySelector('.quiz-focus-close'));
        }
        var foot = document.getElementById('quiz-run-footer');
        if (foot && !document.getElementById('qzf-bar')) {
            var bar = document.createElement('div');
            bar.id = 'qzf-bar'; bar.className = 'qzf-bar lang-no-toggle'; bar.hidden = true;
            bar.innerHTML = '<span class="qzf-n"></span><button type="button" class="qzf-done">✓</button>';
            bar.querySelector('.qzf-done').onclick = function () { setMode(false); };
            foot.parentNode.insertBefore(bar, foot);
        }
        var c = box();
        if (c && !c.dataset.qzf) {
            c.dataset.qzf = '1';
            c.addEventListener('click', onTap, true);
        }
    }
    function paintUi() {
        var b = document.getElementById('qz-flag-btn'), bar = document.getElementById('qzf-bar');
        if (b) {
            b.hidden = !allowed();
            b.classList.toggle('on', mode); b.setAttribute('aria-pressed', String(mode));
            b.title = L(T.btn); b.setAttribute('aria-label', L(T.btn));
            var n = flags.length; b.dataset.n = n ? String(n) : '';
        }
        if (bar) {
            bar.hidden = !mode;
            bar.querySelector('.qzf-n').textContent = '🚩 ' + flags.length + ' · ' + L(T.bar);
            bar.querySelector('.qzf-done').textContent = '✓ ' + L(T.done);
        }
        var m = modal(); if (m) m.classList.toggle('qzf-on', mode);
    }
    function setMode(on) {
        mode = !!on && allowed();
        hideTut(); closeCard();
        paintUi(); draw();
    }

    // ---- where a tap lands: the block, its part, its index, and the character offset inside it
    function blocksOf(part) {
        var c = box(); if (!c) return [];
        return Array.prototype.filter.call(c.querySelectorAll(SEL_ALL), function (el) {
            if (el.closest('.qzf-card, .qzf-layer')) return false;
            if (el.matches('li, p') && el.querySelector('li, p')) return false;   // the innermost block only
            if (el.matches('.md-render') && el.querySelector('p, li, h1, h2, h3, h4')) return false;
            return partOf(el) === part;
        });
    }
    function partOf(el) {
        if (el.closest('.quiz-primer')) return 'primer';
        if (el.closest('.qt-choice-list')) return 'opt';
        return 'q';
    }
    function blockFor(target) {
        var c = box(); if (!c || !target || !target.closest) return null;
        var el = target.closest(SEL);
        if (!el || !c.contains(el) || el.closest('.qzf-card')) {
            var lab = target.closest('.qt-choice-list label');
            if (lab) el = lab.querySelector(':scope > span');
            else { var md = target.closest('.md-render'); el = md && c.contains(md) ? md : null; }
        }
        return el;
    }
    function textNodes(el) {
        var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        while (w.nextNode()) out.push(w.currentNode);
        return out;
    }
    function offsetAt(e, el) {
        var r = null;
        try {
            if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
            else if (document.caretPositionFromPoint) { var p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
        } catch (_) { r = null; }
        if (!r || !el.contains(r.startContainer)) return 0;
        var n = 0, nodes = textNodes(el);
        for (var i = 0; i < nodes.length; i++) { if (nodes[i] === r.startContainer) return n + r.startOffset; n += nodes[i].nodeValue.length; }
        return 0;
    }
    // the sentence around an offset: ., ?, ! (ASCII / full width) + space, or a line break; a very long Thai run is cut to ~160 chars around the tap
    function sentence(text, off) {
        var cuts = [0], re = /[.!?。！？](?=\s)|\n/g, m;
        while ((m = re.exec(text))) cuts.push(m.index + 1);
        cuts.push(text.length);
        var s = 0, e = text.length;
        for (var i = 0; i < cuts.length - 1; i++) if (off >= cuts[i] && off <= cuts[i + 1]) { s = cuts[i]; e = cuts[i + 1]; break; }
        if (e - s > 220) {
            var a = Math.max(s, off - 80), b = Math.min(e, off + 80);
            var ls = text.lastIndexOf(' ', a); if (ls >= s && a - ls < 40) a = ls + 1;
            var ns = text.indexOf(' ', b); if (ns > 0 && ns <= e && ns - b < 40) b = ns;
            s = a; e = b;
        }
        while (s < e && /\s/.test(text[s])) s++;
        while (e > s && /\s/.test(text[e - 1])) e--;
        return { s: s, e: e };
    }
    function optIndex(el) {
        var lab = el.closest('label'), list = el.closest('.qt-choice-list');
        if (!lab || !list) return null;
        var d = Array.prototype.indexOf.call(list.querySelectorAll('label'), lab);
        var map = typeof shuffleMap !== 'undefined' && shuffleMap[step()];
        return map ? map[d] : d;
    }

    function onTap(e) {
        if (!mode) return;
        if (e.target.closest && e.target.closest('.qzf-card')) return;
        e.preventDefault(); e.stopPropagation();
        var el = blockFor(e.target); if (!el) { closeCard(); return; }
        var part = partOf(el), list = blocksOf(part), bi = list.indexOf(el);
        if (bi < 0) { closeCard(); return; }
        var text = el.textContent, off = offsetAt(e, el), st = step();
        var hit = flags.filter(function (f) { return f.step === st && f.part === part && f.bi === bi && off >= f.s && off <= f.e; })[0];
        if (!hit) {
            var r = part === 'opt' ? { s: 0, e: text.trim().length } : sentence(text, off);
            if (part === 'opt') { r.s = text.length - text.replace(/^\s+/, '').length; r.e = r.s + text.trim().length; }
            if (r.e <= r.s) return;
            hit = { step: st, part: part, bi: bi, s: r.s, e: r.e, quote: text.slice(r.s, r.e).slice(0, 300), opt: part === 'opt' ? optIndex(el) : null, reason: null, note: '' };
            flags.push(hit);
        }
        paintUi(); draw(); showCard(hit);
    }

    // ---- yellow marks: an overlay drawn from the text offsets (the term highlighter's spans stay untouched)
    function rangeFor(el, s, e) {
        var nodes = textNodes(el), n = 0, r = document.createRange(), started = false;
        for (var i = 0; i < nodes.length; i++) {
            var len = nodes[i].nodeValue.length;
            if (!started && s <= n + len) { r.setStart(nodes[i], Math.max(0, s - n)); started = true; }
            if (started && e <= n + len) { r.setEnd(nodes[i], Math.max(0, e - n)); return r; }
            n += len;
        }
        return started ? r : null;
    }
    function draw() {
        var c = box(); if (!c) return;
        var old = c.querySelector('.qzf-layer'); if (old) old.remove();
        var mine = flags.filter(function (f) { return f.step === step(); });
        if (!mine.length) return;
        var layer = document.createElement('div'); layer.className = 'qzf-layer'; layer.setAttribute('aria-hidden', 'true');
        c.appendChild(layer);
        var base = c.getBoundingClientRect();
        mine.forEach(function (f) {
            var el = blocksOf(f.part)[f.bi]; if (!el) return;
            var r = rangeFor(el, f.s, f.e); if (!r) return;
            var rects = Array.prototype.filter.call(r.getClientRects(), function (x) { return x.width > 1; });
            rects.forEach(function (x, i) {
                var m = document.createElement('i'); m.className = 'qzf-mark' + (i === rects.length - 1 ? ' end' : '');
                m.style.cssText = 'left:' + (x.left - base.left) + 'px;top:' + (x.top - base.top) + 'px;width:' + x.width + 'px;height:' + x.height + 'px';
                layer.appendChild(m);
            });
        });
    }

    // ---- the V2 card: reason chips + note + 🗑
    function closeCard() { if (openCard) { openCard.remove(); openCard = null; } }
    function showCard(f) {
        closeCard();
        var c = box(), el = blocksOf(f.part)[f.bi]; if (!c || !el) return;
        var r = rangeFor(el, f.s, f.e), rects = r ? r.getClientRects() : [], last = rects[rects.length - 1] || el.getBoundingClientRect(), base = c.getBoundingClientRect();
        var card = document.createElement('div'); card.className = 'qzf-card lang-no-toggle';
        card.innerHTML = '<q>' + esc(f.quote.length > 90 ? f.quote.slice(0, 88) + '…' : f.quote) + '</q><div class="qzf-chips">'
            + REASONS.map(function (x) { return '<button type="button" data-r="' + x[0] + '" aria-pressed="' + (f.reason === x[0]) + '">' + x[1] + ' ' + esc(L(x[2])) + '</button>'; }).join('')
            + '</div><div class="qzf-row"><input type="text" maxlength="300" placeholder="✍️ ' + esc(L(T.note)) + '" value="' + esc(f.note) + '"><button type="button" class="qzf-del" title="🗑">🗑</button><button type="button" class="qzf-ok">✓</button></div>';
        card.style.top = (last.bottom - base.top + 6) + 'px';
        c.appendChild(card); openCard = card;
        card.querySelectorAll('.qzf-chips button').forEach(function (b) {
            b.onclick = function () { f.reason = f.reason === b.dataset.r ? null : b.dataset.r; card.querySelectorAll('.qzf-chips button').forEach(function (x) { x.setAttribute('aria-pressed', String(f.reason === x.dataset.r)); }); };
        });
        var inp = card.querySelector('input');
        inp.oninput = function () { f.note = inp.value.slice(0, 300); };
        card.querySelector('.qzf-del').onclick = function () { flags.splice(flags.indexOf(f), 1); closeCard(); paintUi(); draw(); };
        card.querySelector('.qzf-ok').onclick = function () { closeCard(); };
    }

    // ---- T3: the how-to bubble under 🚩 on every Read first page, until ticked for this quiz
    var tutEl = null;
    function hideTut() { if (tutEl) { tutEl.remove(); tutEl = null; } }
    function showTut() {
        hideTut();
        var b = document.getElementById('qz-flag-btn'), mc = document.querySelector('#quizModal > .modal-content');
        if (!b || b.hidden || !mc || tutOff) return;
        var t = document.createElement('div'); t.className = 'qzf-tut lang-no-toggle' + (reducedMotion() ? ' still' : ''); t.setAttribute('role', 'status');
        t.innerHTML = '<b>🚩 ' + esc(L(T.tut)) + '</b><span class="qzf-mini" aria-hidden="true"><i class="l1"></i><i class="l2"></i><i class="l3"></i><em>👆</em></span>'
            + '<label class="qzf-tick"><input type="checkbox"> ' + esc(L(T.tick)) + '</label>';
        var br = b.getBoundingClientRect(), mr = mc.getBoundingClientRect();
        t.style.top = (br.bottom - mr.top + mc.scrollTop + 8) + 'px';
        t.style.right = Math.max(8, mr.right - br.right - 30) + 'px';
        mc.appendChild(t); tutEl = t;
        t.querySelector('input').onchange = function (e) { if (e.target.checked) { tutOff = true; hideTut(); } };
        b.classList.add('pulse');
    }
    document.addEventListener('pointerdown', function (e) {
        if (tutEl && !(e.target.closest && e.target.closest('.qzf-tut'))) hideTut();
        var b = document.getElementById('qz-flag-btn'); if (b && !tutEl) b.classList.remove('pulse');
    }, true);

    // ---- called by renderQuizStep after each page (kind = 'primer' | 'q')
    function onRender(kind) {
        var q = cq();
        if (q !== quizRef) { quizRef = q; flags = []; tutOff = false; }
        ensureUi();
        mode = false; closeCard(); hideTut();
        paintUi(); draw();
        if (kind === 'primer' && allowed()) showTut();
    }
    window.addEventListener('resize', function () { if (flags.length) draw(); });

    // ---- the end: the list in the feedback form, the payload, the flags-only doc when the form is skipped
    function where(f) {
        if (f.part === 'primer') return '📖 ' + L(T.primer) + ' · ' + L(T.q) + ' ' + (f.step + 1);
        if (f.part === 'opt') return L(T.q) + ' ' + (f.step + 1) + ' · ' + L(T.opt) + ' ' + (f.opt == null ? '' : String.fromCharCode(65 + f.opt));
        return L(T.q) + ' ' + (f.step + 1);
    }
    function renderFeedback() {
        var el = document.getElementById('fb-flags'); if (!el) return;
        el.hidden = !flags.length;
        if (!flags.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<h4>🚩 ' + esc(L(T.list)) + ' · ' + flags.length + '</h4>' + flags.map(function (f, i) {
            var rs = REASONS.filter(function (x) { return x[0] === f.reason; })[0];
            return '<div class="qzf-item" data-i="' + i + '"><span class="w">' + esc(where(f)) + (rs ? ' · ' + rs[1] + ' ' + esc(L(rs[2])) : '') + '</span><q>' + esc(f.quote) + '</q>'
                + '<div class="qzf-row"><input type="text" maxlength="300" placeholder="✍️ ' + esc(L(T.note)) + '" value="' + esc(f.note) + '"><button type="button" class="qzf-del" title="🗑">🗑</button></div></div>';
        }).join('');
        el.querySelectorAll('.qzf-item').forEach(function (it) {
            var f = flags[Number(it.dataset.i)];
            it.querySelector('input').oninput = function (e) { f.note = e.target.value.slice(0, 300); };
            it.querySelector('.qzf-del').onclick = function () { flags.splice(flags.indexOf(f), 1); renderFeedback(); };
        });
    }
    function payload() {
        return flags.map(function (f) { return { part: f.part, step: f.step, opt: f.opt, quote: f.quote, reason: f.reason || null, note: (f.note || '').trim() }; });
    }
    // Skip / × on the form: the flags still reach the admin, alone (flagsOnly), never counted as feedback given
    function saveOrphans(base) {
        if (!flags.length || !base || !base.quizId || typeof db === 'undefined') return Promise.resolve(false);
        var doc = Object.assign({ rating: null, ratingProvided: false, nextTopic: '', comment: '', flagsOnly: true, flags: payload(), timestamp: firebase.firestore.FieldValue.serverTimestamp() }, base);
        flags = [];
        return db.collection('quiz_feedback').add(doc).then(function () { return true; }, function (e) { console.warn('[qzFlag] flags-only save failed:', e && e.message); return false; });
    }
    window.qzFlag = {
        onRender: onRender, allowed: allowed, renderFeedback: renderFeedback, payload: payload, saveOrphans: saveOrphans,
        count: function () { return flags.length; }, clear: function () { flags = []; }, setMode: setMode,
        _state: function () { return { flags: flags.slice(), mode: mode, tutOff: tutOff, tut: !!tutEl }; }   // QA
    };
})();
