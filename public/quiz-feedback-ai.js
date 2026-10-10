// V101.96: AI suggests the "next quiz topic" chips on the feedback sheet (#quizFeedbackModal), in the language the sheet is showing.
// Topics need NOT exist as active quizzes — what the intern taps lands in `nextTopic` like any typed topic (admin reads it as demand).
// Never blocks the sheet: skeleton chips while waiting; on any failure / slow answer / wrong language the popular-tag chips (renderFeedbackTopicChips) come back.
// Interns may only use provider "typhoon" at the proxy (functions/index.js), so this is a Typhoon text call, tagged feature `intern_quiz_next_topics` for the ai_usage stats.
// Sent: quiz title, its tags, the score %, and the intern's weakest tags. NOT sent: names, ids, comments.
(function () {
    'use strict';
    var PROXY = 'https://us-central1-intern-port-edfa7.cloudfunctions.net/callAIProxy';
    var MODEL = 'typhoon-v2.5-30b-a3b-instruct';
    var FEATURE = 'intern_quiz_next_topics';
    var LANG_NAME = { en: 'English', ko: 'Korean', th: 'Thai' };
    var cache = {};          // quizId|lang → [topics]
    var token = 0;           // a newer request (or a close) makes older answers stale
    var lastQuizId = null;
    var api = { timeoutMs: 8000, enabled: true };

    // quizzesCache / quizAttemptsCache are top-level `let`s of index.html — reachable by name from here, NOT as window properties
    function quizzes() { try { return quizzesCache || []; } catch (e) { return []; } }
    function attempts() { try { return quizAttemptsCache || {}; } catch (e) { return {}; } }
    function el(id) { return document.getElementById(id); }
    function rail() { return el('fb-topic-chip-rail'); }
    function sheetOpen() { var m = el('quizFeedbackModal'); return !!m && m.style.display !== 'none' && getComputedStyle(m).display !== 'none'; }
    function lang() { return window.fbLang ? window.fbLang.current() : 'en'; }

    function tagsOf(q) { return (q && typeof window.quizTagList === 'function') ? window.quizTagList(q) : []; }
    function pctOf(a) { return a && a.totalQuestions > 0 && typeof a.correctCount === 'number' ? Math.round(a.correctCount / a.totalQuestions * 100) : null; }

    // the intern's weakest tags: those of finished quizzes scored under 60 %, most frequent first
    function weakTags(exceptId) {
        var counts = {}, labels = {}, att = attempts(), all = quizzes();
        Object.keys(att).forEach(function (id) {
            var p = pctOf(att[id]);
            if (p === null || p >= 60) return;
            var q = all.find(function (x) { return x && x.id === id; });
            tagsOf(q).forEach(function (t) { var k = t.toLocaleLowerCase(); counts[k] = (counts[k] || 0) + 1; labels[k] = labels[k] || t; });
        });
        return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 3).map(function (k) { return labels[k]; });
    }

    function buildPrompt(quizId, l) {
        var q = quizzes().find(function (x) { return x && x.id === quizId; }) || {};
        var title = String(q.shortTitle || q.title || '').slice(0, 120);
        var p = pctOf(attempts()[quizId]);
        var weak = weakTags(quizId);
        return [
            'You suggest topics for the NEXT quiz of a medical intern (pharmacy / medicine).',
            'The intern just finished a quiz.',
            'Quiz: ' + (title || '(untitled)'),
            'Tags: ' + (tagsOf(q).join(', ') || '(none)'),
            p === null ? '' : 'Score: ' + p + '%',
            weak.length ? 'Weak areas: ' + weak.join(', ') : '',
            '',
            'Reply with exactly 4 lines. One topic per line, at most 28 characters each, no numbering, no bullets, no explanation.',
            'Mix: one follow-up on this quiz, one weak area (if any), two related topics worth learning next. A topic does NOT have to match an existing quiz.',
            'Do not repeat the quiz title. Write the topics in ' + LANG_NAME[l] + '.'
        ].filter(function (x) { return x !== ''; }).join('\n');
    }

    // lines → clean topics; null when the answer is unusable
    function parse(text, l, quizTitle) {
        var seen = {}, out = [];
        String(text || '').replace(/```[a-z]*/gi, '').split(/\r?\n/).forEach(function (line) {
            var t = line.replace(/^\s*(?:[-*•·]+|\d+[.)])\s*/, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/[.。]+$/, '').trim();
            if (!t || t.length > 32 || /[:：]\s*$/.test(t)) return;
            var k = t.toLocaleLowerCase();
            if (seen[k] || (quizTitle && k === quizTitle.toLocaleLowerCase())) return;
            seen[k] = 1; out.push(t);
        });
        out = out.slice(0, 4);
        if (out.length < 2) return null;
        // the answer must be in the requested script (Korean needs Hangul, Thai needs Thai; English must not be mostly non-Latin)
        var right = out.filter(function (t) { return l === 'ko' ? /[가-힣]/.test(t) : l === 'th' ? /[฀-๿]/.test(t) : !/[가-힣฀-๿]/.test(t); }).length;
        return right >= Math.ceil(out.length / 2) ? out : null;
    }

    function skeleton() {
        var r = rail(); if (!r) return;
        r.style.display = 'flex'; r.textContent = '';
        r.appendChild(mark('…'));
        [96, 128, 108, 84].forEach(function (w) { var s = document.createElement('span'); s.className = 'fb-skel'; s.style.width = w + 'px'; r.appendChild(s); });
    }
    function mark() {
        var m = document.createElement('span'); m.className = 'fb-mark'; m.textContent = '✨';
        m.title = window.fbT ? window.fbT('aiHint') : 'Suggested for you';
        return m;
    }
    function show(topics) {
        var r = rail(); if (!r) return;
        r.style.display = 'flex'; r.textContent = '';
        r.appendChild(mark());
        topics.forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'fb-tchip'; b.setAttribute('aria-pressed', 'false'); b.dataset.topic = t; b.textContent = t;
            b.onclick = function () { window.fbPickTopic(b); };
            r.appendChild(b);
        });
        if (typeof window.fbSyncTopicChips === 'function') window.fbSyncTopicChips();
    }
    function fallback() { if (typeof window.renderFeedbackTopicChips === 'function') window.renderFeedbackTopicChips(); if (typeof window.fbSyncTopicChips === 'function') window.fbSyncTopicChips(); }

    async function request(quizId, l, my) {
        var user = typeof window.ensureFirebaseAuthReady === 'function' ? await window.ensureFirebaseAuthReady(6000) : null;
        if (!user) throw new Error('no auth');
        var idToken = await user.getIdToken();
        var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, api.timeoutMs);
        try {
            var resp = await fetch(PROXY, {
                method: 'POST', signal: ctl.signal,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
                body: JSON.stringify({ provider: 'typhoon', model: MODEL, prompt: buildPrompt(quizId, l), isJson: false, feature: FEATURE })
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (data.error) throw new Error(String(data.error));
            return String(data.text || '');
        } finally { clearTimeout(timer); }
    }

    // start (or restart in another language) for the sheet that is open now
    async function start(quizId) {
        if (!api.enabled) return;
        if (quizId) lastQuizId = quizId;
        if (!lastQuizId) return;
        var my = ++token, l = lang(), qid = lastQuizId, key = qid + '|' + l;
        if (cache[key]) { show(cache[key]); return; }
        skeleton();
        try {
            var q = quizzes().find(function (x) { return x && x.id === qid; }) || {};
            var topics = parse(await request(qid, l, my), l, String(q.shortTitle || q.title || ''));
            if (my !== token || !sheetOpen()) return;          // closed or superseded meanwhile
            if (!topics) { fallback(); return; }
            cache[key] = topics;
            show(topics);
        } catch (e) {
            if (my !== token || !sheetOpen()) return;
            console.warn('[fb-ai] next-topic suggestions unavailable:', e && e.message);
            fallback();
        }
    }
    function cancel() { token++; }

    api.start = start; api.cancel = cancel; api.parse = parse; api.buildPrompt = buildPrompt; api.weakTags = weakTags;
    window.fbAi = api;
})();
