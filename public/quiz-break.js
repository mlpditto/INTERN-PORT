// V101.289 ⏸ Break during a quiz (owner picks 2026-11-07, mockup-quiz-break.html: P1 = "⏸ พัก" beside ▶ on 📖 Read first, recommended settings,
// past the deadline = ก auto-submit). Only on a quiz whose admin turned on ⏸ Break (`allowBreak`), never in practice / polls / learning sets.
// At most 2 breaks per attempt, and only before the deadline. The break is taken on a Read first page, where no clock runs, so nothing is
// counted while away; the answers already given are saved and the next question is not shown until ▶.
// Storage: the attempt keeps status 'started' and gains `pausedAt` (null again on resume), `breaks` [{at, step, reason, back}] and
// `breakState` (the runner's clocks + the choice order). runQuiz resumes a paused attempt instead of bricking it; once the deadline
// passes while still paused, what was answered is submitted (`breakAutoSubmitted`).
(function () {
    'use strict';
    var MAX = 2;
    var T = {
        btn: { en: 'Break', th: 'พัก', ko: '휴식', ja: '休憩', zh: '休息' },
        head: { en: 'Break before question {n}', th: 'พักก่อนทำข้อ {n}', ko: '{n}번 문항 전 휴식', ja: '問{n}の前に休憩', zh: '第{n}题前休息' },
        left: { en: '⏸ {n} left after this', th: '⏸ เหลือ {n} ครั้งหลังจากนี้', ko: '⏸ 이후 {n}회 남음', ja: '⏸ この後 残り{n}回', zh: '⏸ 之后还剩{n}次' },
        clock: { en: '⏱ {s}s left, stopped', th: '⏱ เวลาคงเหลือ {s}s หยุดไว้', ko: '⏱ 남은 {s}초 정지', ja: '⏱ 残り{s}秒 停止', zh: '⏱ 剩余{s}秒 暂停' },
        clock0: { en: '⏱ The clock is stopped', th: '⏱ เวลาหยุดไว้', ko: '⏱ 시간 정지', ja: '⏱ 時間停止', zh: '⏱ 计时暂停' },
        due: { en: '📅 Back before {d}', th: '📅 กลับมาก่อน {d}', ko: '📅 {d} 전까지 복귀', ja: '📅 {d}までに再開', zh: '📅 {d}前回来' },
        cancel: { en: 'Cancel', th: 'ยกเลิก', ko: '취소', ja: 'キャンセル', zh: '取消' },
        go: { en: '⏸ Take a break', th: '⏸ พักเลย', ko: '⏸ 휴식하기', ja: '⏸ 休憩する', zh: '⏸ 休息' },
        saved: { en: '⏸ Saved — tap ▶ Resume on the quiz card to go on', th: '⏸ พักแล้ว — กด ▶ ทำต่อ ที่การ์ด quiz', ko: '⏸ 저장됨 — 퀴즈 카드에서 ▶ 계속', ja: '⏸ 保存しました — カードの ▶ で再開', zh: '⏸ 已保存 — 在卡片上点 ▶ 继续' },
        fail: { en: "Couldn't save the break — check your connection and try again.", th: 'บันทึกการพักไม่สำเร็จ ลองใหม่อีกครั้ง', ko: '저장하지 못했습니다. 다시 시도하세요.', ja: '保存できませんでした。もう一度お試しください。', zh: '保存失败，请重试。' }
    };
    var REASONS = [
        ['work', '🏥', { en: 'Work came up', th: 'งานเข้า', ko: '업무', ja: '仕事', zh: '有工作' }],
        ['meal', '🍱', { en: 'Meal', th: 'พักกิน', ko: '식사', ja: '食事', zh: '吃饭' }],
        ['net', '📶', { en: 'Bad signal', th: 'เน็ตไม่ดี', ko: '인터넷 불량', ja: '電波が悪い', zh: '网络差' }],
        ['other', '✍️', { en: 'Other', th: 'อื่น ๆ', ko: '기타', ja: 'その他', zh: '其他' }]
    ];
    var REASON_ICON = { work: '🏥', meal: '🍱', net: '📶', other: '✍️' };

    function lang() {
        try {
            var sel = typeof qtGetSelectedLang === 'function' ? qtGetSelectedLang() : 'orig';
            return sel === 'orig' && typeof qtQuizSourceLang === 'function' ? qtQuizSourceLang() : sel;
        } catch (e) { return 'en'; }
    }
    function L(o, vars) {
        var s = o[lang()] || o.en;
        Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
        return s;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function toDate(t) { return !t ? null : (t instanceof Date ? t : (typeof t.toDate === 'function' ? t.toDate() : new Date(t))); }
    function dueOf(q) { return q ? toDate(q.deadline) : null; }
    function pastDue(q, now) { var d = dueOf(q); return !!(d && (now || Date.now()) > d.getTime()); }
    function fmtDate(d) {
        if (!d) return '';
        try { return typeof formatThaiDate === 'function' ? formatThaiDate(d, { time: true }) : d.toLocaleString(); } catch (e) { return d.toLocaleString(); }
    }

    // ---- what the attempt says
    function isPaused(att) { return !!(att && att.status === 'started' && att.pausedAt); }
    function used(att) { return att && Array.isArray(att.breaks) ? att.breaks.length : 0; }

    // a break is offered only on a ⏸-enabled graded quiz, before the deadline, with breaks left
    function allowed() {
        var q = typeof currentQuiz !== 'undefined' ? currentQuiz : null;
        if (!q || q.allowBreak !== true || !q.questions) return false;
        if (typeof isPracticeMode !== 'undefined' && isPracticeMode) return false;
        if (q.quizType === 'read_only' || q.isPoll === true) return false;
        if (pastDue(q)) return false;
        var att = typeof quizAttemptsCache !== 'undefined' ? quizAttemptsCache[q.id] : null;
        return used(att) < MAX;
    }

    // ---- 📖 Read first: the ⏸ button beside ▶ (P1)
    function onPrimer() {
        var start = document.getElementById('btn-quiz-primer-start');
        if (!start) return;
        var b = document.getElementById('btn-quiz-break');
        if (!b) {
            b = document.createElement('button');
            b.type = 'button'; b.id = 'btn-quiz-break'; b.className = 'btn-sm qzb-btn lang-no-toggle';
            b.onclick = openSheet;
            start.parentNode.insertBefore(b, start);
        }
        b.textContent = '⏸ ' + L(T.btn);
        b.hidden = !allowed();
    }
    function hide() { var b = document.getElementById('btn-quiz-break'); if (b) b.hidden = true; closeSheet(); }

    // ---- the sheet: reason (optional) + what is left, then confirm
    var picked = '';
    function closeSheet() { var s = document.getElementById('qzb-sheet'); if (s) s.remove(); }
    function openSheet() {
        if (!allowed()) return;
        closeSheet(); picked = '';
        var q = currentQuiz, att = quizAttemptsCache[q.id], n = currentStep + 1;
        var tt = q.timerMode === 'total_time';
        var meta = ['<span>' + esc(L(T.left, { n: MAX - used(att) - 1 })) + '</span>',
            '<span>' + esc(tt ? L(T.clock, { s: Math.max(0, timeLeftForStep | 0) }) : L(T.clock0)) + '</span>'];
        if (dueOf(q)) meta.push('<span>' + esc(L(T.due, { d: fmtDate(dueOf(q)) })) + '</span>');
        var wrap = document.createElement('div');
        wrap.id = 'qzb-sheet'; wrap.className = 'qzb-bd lang-no-toggle';
        wrap.innerHTML = '<div class="qzb-sheet" role="dialog" aria-modal="true" aria-labelledby="qzb-h"><b id="qzb-h">⏸ ' + esc(L(T.head, { n: n })) + '</b>' +
            '<div class="qzb-chips">' + REASONS.map(function (r) { return '<button type="button" data-r="' + r[0] + '" aria-pressed="false">' + r[1] + ' ' + esc(L(r[2])) + '</button>'; }).join('') + '</div>' +
            '<div class="qzb-meta">' + meta.join('') + '</div>' +
            '<div class="qzb-row"><button type="button" class="qzb-no">' + esc(L(T.cancel)) + '</button><button type="button" class="qzb-go">' + esc(L(T.go)) + '</button></div></div>';
        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) return closeSheet();
            var c = e.target.closest('[data-r]');
            if (c) {
                picked = picked === c.dataset.r ? '' : c.dataset.r;
                wrap.querySelectorAll('[data-r]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.r === picked)); });
                return;
            }
            if (e.target.closest('.qzb-no')) return closeSheet();
            if (e.target.closest('.qzb-go')) take(e.target.closest('.qzb-go'));
        });
        document.body.appendChild(wrap);
    }

    // the runner's clocks + choice order, so ▶ ทำต่อ picks up exactly here (Firestore holds no nested arrays → the order is a string)
    function snapshot() {
        return {
            step: currentStep,
            timeLeft: typeof timeLeftForStep === 'number' ? timeLeftForStep : null,
            accumulatedTime: accumulatedTime || 0,
            stepTimeRemaining: (stepTimeRemaining || []).map(function (v) { return v == null ? null : v; }),
            durations: (durationsPerQuestion || []).map(function (v) { return v || 0; }),
            primerSeen: currentQuiz.questions.map(function (_, i) { return !!primerSeen[i]; }),
            shuffle: (shuffleMap || []).map(function (m) { return Array.isArray(m) ? m.join(',') : null; })
        };
    }
    function packAnswers() {
        return userAnswers.map(function (a) { return a === undefined ? null : (Array.isArray(a) ? a.join('\n---\n') : a); });
    }

    async function take(btn) {
        var q = currentQuiz, att = quizAttemptsCache[q.id] || {};
        if (!allowed()) return closeSheet();
        btn.disabled = true;
        var now = Date.now();
        var breaks = (Array.isArray(att.breaks) ? att.breaks.slice() : []).concat([{ at: now, step: currentStep, reason: picked || '', back: null }]);
        var data = {
            pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
            breaks: breaks,
            breakState: snapshot(),
            answers: packAnswers(),
            currentStep: currentStep,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('quiz_attempts').doc(q.id + '_' + userId).set(data, { merge: true });
        } catch (e) {
            console.warn('[qzBreak] save failed', e);
            btn.disabled = false;
            alert(L(T.fail));
            return;
        }
        quizAttemptsCache[q.id] = Object.assign({}, att, data, { status: 'started', pausedAt: new Date(now) });
        var msg = L(T.saved);   // before currentQuiz goes: the quiz's own language
        closeSheet();
        clearInterval(quizTimerInterval);
        if (typeof stopCheatDetector === 'function') stopCheatDetector();
        if (window.qzFlag && qzFlag.setMode) qzFlag.setMode(false);
        document.getElementById('quizModal').style.display = 'none';   // closed first, so pagehide / beforeunload no longer marks it abandoned
        currentQuiz = null;
        if (typeof renderAssignments === 'function') renderAssignments();
        if (typeof showToast === 'function') showToast(msg);
    }

    // ---- back from a break: put the runner where it stopped (runQuiz calls this instead of the 🚫 brick)
    function unpackAnswers(arr, n) {
        var out = (Array.isArray(arr) ? arr : []).map(function (a) {
            return (typeof a === 'string' && a.indexOf('\n---\n') >= 0)
                ? a.split('\n---\n').map(function (x) { var v = Number(x); return Number.isNaN(v) ? x : v; })
                : a;
        });
        while (out.length < n) out.push(null);
        return out;
    }
    function restore(att) {
        var q = currentQuiz, n = q.questions.length, s = att.breakState || {};
        isPracticeMode = false;
        currentStep = Math.min(Math.max(0, s.step != null ? s.step : (att.currentStep || 0)), n - 1);
        accumulatedTime = s.accumulatedTime || 0;
        stepTimeRemaining = new Array(n).fill(null).map(function (_, i) { return Array.isArray(s.stepTimeRemaining) && s.stepTimeRemaining[i] != null ? s.stepTimeRemaining[i] : null; });
        durationsPerQuestion = new Array(n).fill(0).map(function (_, i) { return Array.isArray(s.durations) ? (s.durations[i] || 0) : 0; });
        primerSeen = new Array(n).fill(false).map(function (_, i) { return Array.isArray(s.primerSeen) ? !!s.primerSeen[i] && i !== currentStep : false; });
        answerChecked = [];
        userAnswers = unpackAnswers(att.answers, n);
        timeLeftForStep = q.timerMode === 'total_time'
            ? (typeof s.timeLeft === 'number' ? s.timeLeft : (q.totalTimer || 300))
            : (q.questions[currentStep].timer || 60);
        stepStartTimestamp = Date.now();
    }
    // the saved choice order, applied after runQuiz drew a fresh one (only where the question still has that many options)
    function restoreShuffle(att) {
        var s = (att && att.breakState) || {};
        if (!Array.isArray(s.shuffle)) return;
        currentQuiz.questions.forEach(function (qq, i) {
            var m = s.shuffle[i];
            if (typeof m !== 'string' || !m) return;
            var arr = m.split(',').map(Number);
            if (qq.options && arr.length === qq.options.length && arr.every(function (v) { return v >= 0 && v < arr.length; })) shuffleMap[i] = arr;
        });
    }
    function resumeData(att) {
        var breaks = (Array.isArray(att.breaks) ? att.breaks.slice() : []);
        if (breaks.length && breaks[breaks.length - 1] && breaks[breaks.length - 1].back == null) breaks[breaks.length - 1] = Object.assign({}, breaks[breaks.length - 1], { back: Date.now() });
        return { pausedAt: null, breaks: breaks, lastActive: firebase.firestore.FieldValue.serverTimestamp() };
    }

    // ---- the deadline passed during the break → send what was answered (ก)
    var dueBusy = {};
    function checkDue() {
        if (typeof quizzesCache === 'undefined' || typeof quizAttemptsCache === 'undefined' || !quizzesCache.length) return;
        var m = document.getElementById('quizModal');
        if ((m && m.style.display === 'flex') || (typeof isSubmittingQuiz !== 'undefined' && isSubmittingQuiz)) return;
        var hit = null;
        Object.keys(quizAttemptsCache).some(function (id) {
            var att = quizAttemptsCache[id];
            if (!isPaused(att) || dueBusy[id]) return false;
            var q = quizzesCache.find(function (x) { return x.id === id; });
            if (q && q.questions && pastDue(q)) { hit = { q: q, att: att }; return true; }
            return false;
        });
        if (!hit) return;
        dueBusy[hit.q.id] = true;
        autoSubmit(hit.q, hit.att);
    }
    async function autoSubmit(q, att) {
        currentQuiz = typeof quizForAttempt === 'function' ? quizForAttempt(q, att, quizzesCache) : q;
        if (!currentQuiz) return;
        restore(att);
        currentQuizMultiplier = typeof attemptScoreMultiplier === 'function' ? attemptScoreMultiplier(att) : 1;
        quizTotalStartTime = new Date();
        var done = userAnswers.filter(function (a) { return a != null && !(Array.isArray(a) && !a.length); }).length;
        try { await db.collection('quiz_attempts').doc(q.id + '_' + userId).set(Object.assign(resumeData(att), { breakAutoSubmitted: true }), { merge: true }); } catch (e) { console.warn('[qzBreak] auto-submit mark failed', e); }
        alert('⏸ ' + (q.shortTitle || q.title || 'Quiz') + '\n' +
            'The deadline passed during your break — your answers (' + done + '/' + currentQuiz.questions.length + ') are sent now.\n' +
            'หมดเวลาระหว่างพัก — ส่งคำตอบที่ทำไว้ (' + done + '/' + currentQuiz.questions.length + ') ให้แล้ว');
        await submitQuiz({ breakAuto: true });
    }

    // ---- the home card / Browse row
    function cardInfo(q, att) {
        if (!isPaused(att)) return null;
        var n = q && Array.isArray(q.questions) ? q.questions.length : 0, s = att.breakState || {};
        var step = (s.step != null ? s.step : (att.currentStep || 0)) + 1;
        var due = dueOf(q);
        return { step: step, total: n, due: due ? fmtDate(due) : '', left: MAX - used(att) };
    }

    // ---- admin + review: "⏸ 2 · 35m · 🏥 🍱"
    function summary(att) {
        var b = att && Array.isArray(att.breaks) ? att.breaks : [];
        if (!b.length) return null;
        var ms = b.reduce(function (t, x) { return t + (x && x.back && x.at ? Math.max(0, x.back - x.at) : 0); }, 0);
        return { count: b.length, ms: ms, icons: b.map(function (x) { return REASON_ICON[x && x.reason] || ''; }).filter(Boolean).join(' ') };
    }

    window.qzBreak = { allowed: allowed, onPrimer: onPrimer, hide: hide, isPaused: isPaused, restore: restore, restoreShuffle: restoreShuffle, resumeData: resumeData, checkDue: checkDue, cardInfo: cardInfo, summary: summary, MAX: MAX, _openSheet: openSheet };
})();
