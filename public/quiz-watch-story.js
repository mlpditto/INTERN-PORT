// V102.666 🎬 Watch first ▸ ✨ From Read first (owner pick C + C1, mockup-watch-first/c.html). Quiz Editor ▸ ⚙ ▸ 🎬 Watch first:
// one AI call turns the 📖 Read first notes of every question into a short CHAT STORY (an intern asks, a pharmacist answers, 💡 key lines) —
// the same Q: / RX: / KEY: lines the article clips use. Every line can be edited; a number the Read first notes never say is flagged ⚠️.
// The story rides on the quiz as `watchFirst.story = { lang, lines: [{ w, t, q }] }` (text only — no video file); the intern's Watch first
// page (quiz-watch-first.js) plays it. A video link in the box beside it wins when both are set.
(function () {
    'use strict';
    // V102.667 (owner 2026-11-16, after the first real run came back as a table of contents): about two lines a note (12 to 24), and every
    // answer / key line must carry a fact from its note.
    var MAX = 24, LEN = 90, WHO = { q: ['🙋', 'Q'], rx: ['🧑‍⚕️', 'RX'], key: ['💡', 'KEY'] }, ORDER = ['q', 'rx', 'key'];
    var S = { story: null, busy: false, err: '', t0: 0, play: -1, timer: null, voicing: null, au: null };
    // V102.668 (owner 2026-11-16: "AI voices, two people") — 🗣 voices every line with iApp Chinda through callTtsProxy (the key stays on the server):
    // the intern = Kaimook friendly, the pharmacist and the key lines = Kaitom calm (the article clips' pair). One sound file per line in Storage
    // (watch-voices/<sha256>.mp3, admin-only rule; interns play it through the download token kept on the line as `a`). Thai stories only for now.
    var VOICE = { q: 'kaimook', rx: 'kaitom', key: 'kaitom' }, VSTYLE = { q: 'friendly', rx: 'calm', key: 'calm' };
    function okUrl(u) { return typeof u === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/\S+$/.test(u); }
    function voiced() { return S.story ? S.story.lines.filter(function (x) { return okUrl(x.a); }).length : 0; }
    function blobOf(b64, mime) { var bin = atob(b64), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: mime }); }
    function store(blob, mime) {
        var app = window.adminApp || window.firebase.app('admin');
        return window._sha256Hex(blob).then(function (h) {
            var ref = app.storage().ref('watch-voices/' + h + (/mpeg|mp3/.test(mime) ? '.mp3' : '.wav'));
            return ref.getDownloadURL().catch(function (e) {   // the same sound already stored — reuse
                if (e && e.code !== 'storage/object-not-found') throw e;
                return ref.put(blob, { contentType: mime }).then(function (snap) { return snap.ref.getDownloadURL(); });
            });
        });
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function box() { return document.getElementById('qws-box'); }
    function notes() { return (typeof window._praRead === 'function' ? window._praRead() : []).map(function (x, i) { return { n: i + 1, q: String(x.q || ''), primer: String(x.primer || '').trim() }; }); }
    function langOf(text) { return /[฀-๿]/.test(text) ? 'th' : /[가-힯]/.test(text) ? 'ko' : 'en'; }
    function nums(t) { return String(t || '').match(/\d+(?:[.,]\d+)?/g) || []; }
    // numbers in a line that no Read first note says
    function bad(t) { var all = notes().map(function (x) { return x.primer; }).join(' '); return nums(t).filter(function (n) { return all.indexOf(n) < 0; }); }
    function secs(ls) { return ls.reduce(function (s, x) { return s + 1 + Math.ceil(x.t.length / 14); }, 0); }
    function clean(story) {
        if (!story || !Array.isArray(story.lines)) return null;
        var ls = story.lines.map(function (x) { return x && ORDER.indexOf(x.w) > -1 && String(x.t || '').trim() ? Object.assign({ w: x.w, t: String(x.t).trim().slice(0, LEN), q: (Array.isArray(x.q) ? x.q : []).filter(function (n) { return Number.isInteger(n) && n > 0; }).slice(0, 6) }, okUrl(x.a) ? { a: x.a } : {}) : null; }).filter(Boolean).slice(0, MAX);
        return ls.length ? { lang: /^(th|en|ko)$/.test(story.lang) ? story.lang : langOf(ls.map(function (x) { return x.t; }).join(' ')), lines: ls } : null;
    }
    function want(n) { return Math.max(12, Math.min(MAX, n * 2)); }
    function prompt(ns, L) {
        var NAME = { en: 'English', th: 'Thai', ko: 'Korean' }, N = want(ns.length);
        return 'These are the "Read first" notes pharmacy interns see before each question of one quiz. Turn them into ONE short CHAT STORY that prepares the intern for the whole quiz, in ' + NAME[L] + '.\n' +
            'Write ' + (N - 4) + ' to ' + N + ' lines, one per line, each starting with a speaker tag and the note number(s) it comes from in square brackets:\n' +
            'Q [1]: a pharmacy intern asks\nRX [1]: the pharmacist answers\nKEY [1,2]: one key point to remember (' + Math.round(N / 6) + ' to ' + Math.round(N / 4) + ' of these)\n' +
            'Rules: follow the order of the notes; cover every note that has content. Keep each line short (under 80 characters; under 60 for Thai or Korean). ' +
            'Every RX and KEY line must TEACH one concrete fact taken from its note — a drug name, a number, a rule, a reason. Never write a line that only names a topic or says something should be reviewed, checked or understood. ' +
            'Every Q line is a real question an intern would ask, ending with a question mark. The last line is a KEY line. ' +
            'Copy every number, dose, strength and drug name EXACTLY as the notes write it — never add a number or a fact the notes do not say. ' +
            'Do not give away which choice is correct in any question. No markdown, no emoji at the start, nothing else.\n\n' +
            ns.map(function (x) { return 'NOTE ' + x.n + ' (question: ' + x.q.slice(0, 140) + ')\n' + x.primer.slice(0, 900); }).join('\n\n');
    }
    function parse(txt) {
        return String(txt || '').split(/\n+/).map(function (x) {
            var m = x.match(/^[\s\-*•_]*(Q|RX|KEY)\s*\**\s*(?:\[([\d,\s]*)\])?\s*\**\s*[:：]\s*\**\s*(.+)$/i); if (!m) return null;
            var w = m[1].toLowerCase() === 'q' ? 'q' : m[1].toLowerCase() === 'key' ? 'key' : 'rx';
            return { w: w, t: m[3].replace(/\*\*/g, '').trim().slice(0, LEN), q: (m[2] || '').split(',').map(function (n) { return parseInt(n, 10); }).filter(function (n) { return n > 0; }).slice(0, 6) };
        }).filter(function (x) { return x && x.t; }).slice(0, MAX);
    }
    function touch() { if (typeof window.triggerAutoSave === 'function') { try { window.triggerAutoSave(); } catch (e) { /* the editor's own business */ } } }
    function stop() { clearTimeout(S.timer); S.play = -1; if (S.au) { try { S.au.pause(); } catch (e) { /* not playing */ } S.au = null; } }
    function paint() {
        if (typeof window._qeWatchChip === 'function') window._qeWatchChip();   // V102.670: the 🎬 half of the chip beside Review follows the story
        var el = box(), btn = document.getElementById('qws-make'); if (!el) return;
        if (btn) { btn.disabled = S.busy; btn.textContent = S.busy && !S.voicing ? '✨ ' + Math.floor((Date.now() - S.t0) / 1000) + ' s' : '✨ From Read first'; }
        var st = S.story;
        if (!st && !S.err) { el.hidden = true; el.innerHTML = ''; return; }
        el.hidden = false;
        if (!st) { el.innerHTML = '<div class="qws-err" role="alert">' + esc(S.err) + '</div>'; return; }
        var flagged = st.lines.reduce(function (n, x) { return n + bad(x.t).length; }, 0);
        el.innerHTML = '<div class="qws-h"><b>🎬 from Read first</b><small>' + st.lines.length + ' lines · ~' + secs(st.lines) + ' s · ' + st.lang.toUpperCase() + '</small>' +
            '<span class="' + (flagged ? 'qws-warn' : 'qws-ok') + '">' + (flagged ? '⚠️ ' + flagged + ' number' + (flagged > 1 ? 's' : '') + ' not in Read first' : '✓ every number is in Read first') + '</span>' +
            '<button type="button" class="qws-b qws-v' + (voiced() && voiced() === st.lines.length ? ' all' : '') + '" id="qws-voice" onclick="QuizWatchStory.voices()"' + (S.busy ? ' disabled' : '') + ' aria-label="AI voices" title="AI voices (Chinda): intern = Kaimook, pharmacist = Kaitom. One sound file per line, kept with the quiz — interns hear these instead of the phone voice. Thai stories only. Each line is one paid voice call.">🗣 <span class="qws-vn">' + (S.voicing ? S.voicing.done + '/' + S.voicing.total + ' …' : voiced() + '/' + st.lines.length) + '</span></button>' +
            '<button type="button" class="qws-b" onclick="QuizWatchStory.play()" aria-label="' + (S.play > -1 ? 'Stop' : 'Play') + '" title="Play the story here">' + (S.play > -1 ? '⏹' : '▶') + '</button>' +
            '<button type="button" class="qws-b" onclick="QuizWatchStory.make()" aria-label="Write again" title="Write the story again from Read first">↻</button>' +
            '<button type="button" class="qws-b" onclick="QuizWatchStory.clear()" aria-label="Remove the story" title="Remove the story">🗑</button></div>' +
            (S.err ? '<div class="qws-err" role="alert">' + esc(S.err) + '</div>' : '') +
            st.lines.map(function (x, i) {
                var b = bad(x.t);
                return '<div class="qws-l' + (x.w === 'key' ? ' k' : '') + (i === S.play ? ' now' : '') + '"><button type="button" class="qws-w" onclick="QuizWatchStory.who(' + i + ')" title="Who says it — tap to change" aria-label="Speaker: ' + WHO[x.w][1] + '">' + WHO[x.w][0] + ' ' + WHO[x.w][1] + '</button>' +
                    '<input type="text" maxlength="' + LEN + '" value="' + esc(x.t) + '" oninput="QuizWatchStory.edit(' + i + ', this.value)" aria-label="Line ' + (i + 1) + '">' +
                    (b.length ? '<span class="qws-warn" title="Not in any Read first note: ' + esc(b.join(', ')) + '">⚠️ ' + esc(b.join(', ')) + '</span>' : '') +
                    (okUrl(x.a) ? '<i class="qws-a" title="AI voice ready">♪</i>' : '') +
                    '<em>' + (x.q.length ? 'Q' + x.q.join(' · ') : '') + '</em>' +
                    '<button type="button" class="qws-x" onclick="QuizWatchStory.del(' + i + ')" aria-label="Remove line ' + (i + 1) + '">×</button></div>';
            }).join('') +
            (st.lines.length < MAX ? '<button type="button" class="qws-add" onclick="QuizWatchStory.add()">＋ line</button>' : '');
    }
    var api = {
        get: function () { return clean(S.story); },
        set: function (story) { stop(); S.story = clean(story); S.err = ''; S.busy = false; paint(); },
        make: function () {
            if (S.busy) return Promise.resolve();
            var ns = notes().filter(function (x) { return x.primer; });
            if (!ns.length) { S.err = 'Write 📖 Read first for at least one question — the story is made from those notes.'; paint(); return Promise.resolve(); }
            if (typeof window.callUniversalAI !== 'function') { S.err = 'AI is not available on this page.'; paint(); return Promise.resolve(); }
            var L = langOf(ns.map(function (x) { return x.primer; }).join(' ')), model = typeof window.textAIModel === 'function' ? window.textAIModel('ai-analyzer-model-val') : 'gemini-3.8-flash';
            stop(); S.busy = true; S.err = ''; S.t0 = Date.now(); paint();
            var tick = setInterval(function () { if (S.busy) paint(); }, 1000);
            return window.callUniversalAI(model, prompt(ns, L), false, null, '', { feature: 'quiz_watch_story' }).then(function (r) {
                var resp = r && r.resp !== undefined ? r.resp : r, txt = String(resp && typeof resp === 'object' ? (resp.text || resp.outputText || resp.response || '') : (resp || ''));
                var ls = parse(txt);
                if (!ls.length) throw new Error('the model sent no Q: / RX: / KEY: lines — try ✨ again or another model. It said: ' + txt.slice(0, 80));
                S.story = { lang: L, lines: ls }; touch();
            }).catch(function (e) { S.err = '✨ ' + (e && e.message || e); })
              .then(function () { clearInterval(tick); S.busy = false; paint(); });
        },
        edit: function (i, v) {   // no repaint: the caret stays where it is
            var x = S.story && S.story.lines[i]; if (!x) return; x.t = String(v).slice(0, LEN);
            if (x.a) {   // new words: the old sound no longer says this line
                delete x.a; var row = box().querySelectorAll('.qws-l')[i], a = row && row.querySelector('.qws-a'), n = box().querySelector('.qws-vn'), b = document.getElementById('qws-voice');
                if (a) a.remove(); if (n) n.textContent = voiced() + '/' + S.story.lines.length; if (b) b.classList.remove('all');
            }
            touch();
        },
        voices: function () {
            if (S.busy || !S.story) return Promise.resolve();
            var fail = function (m) { S.err = '🗣 ' + m; paint(); return Promise.resolve(); };
            if (S.story.lang !== 'th') return fail('AI voices are for Thai stories only for now — other languages use the phone voice.');
            if (typeof window.callTtsProxy !== 'function' || typeof window._sha256Hex !== 'function') return fail('the voice service is not loaded on this page.');
            var todo = S.story.lines.filter(function (x) { return x.t.trim() && !okUrl(x.a); });
            if (!todo.length) return fail('every line already has its voice. Edit a line to voice it again.');
            stop(); S.busy = true; S.err = ''; S.voicing = { done: 0, total: todo.length }; paint();
            var one = function (x) {
                var said = x.t;
                return window.callTtsProxy({ provider: 'iapp_tts', text: said, voice: VOICE[x.w], style: VSTYLE[x.w], feature: 'quiz_watch_voice' }).then(function (r) {
                    if (!r || !r.audioContent) throw new Error('no audio came back');
                    var mime = r.mimeType || 'audio/mpeg'; return store(blobOf(r.audioContent, mime), mime);
                }).then(function (url) { if (x.t === said && okUrl(url)) x.a = url; S.voicing.done++; paint(); });
            };
            return todo.reduce(function (p, x) { return p.then(function () { return one(x); }); }, Promise.resolve())
                .catch(function (e) { S.err = '🗣 stopped at line ' + (S.voicing.done + 1) + ' of ' + S.voicing.total + ': ' + (e && e.message || e) + ' — the lines already voiced are kept; tap 🗣 to go on.'; })
                .then(function () { S.busy = false; S.voicing = null; touch(); paint(); });
        },
        who: function (i) { var x = S.story && S.story.lines[i]; if (!x) return; x.w = ORDER[(ORDER.indexOf(x.w) + 1) % ORDER.length]; touch(); paint(); },
        del: function (i) { if (!S.story) return; stop(); S.story.lines.splice(i, 1); if (!S.story.lines.length) S.story = null; touch(); paint(); },
        add: function () { if (!S.story || S.story.lines.length >= MAX) return; S.story.lines.push({ w: 'rx', t: '', q: [] }); paint(); var ins = box().querySelectorAll('.qws-l input'); if (ins.length) ins[ins.length - 1].focus(); },
        clear: function () { stop(); S.story = null; S.err = ''; touch(); paint(); },
        play: function () {
            if (!S.story) return;
            if (S.play > -1) { stop(); return paint(); }
            var step = function (i) {
                if (!S.story || i >= S.story.lines.length) { stop(); return paint(); }
                S.play = i; paint();
                var x = S.story.lines[i], went = false, next = function () { if (went || S.play !== i) return; went = true; clearTimeout(S.timer); step(i + 1); };
                if (okUrl(x.a)) {   // hear the stored voice
                    try { var au = S.au = new Audio(x.a); au.onended = function () { S.timer = setTimeout(next, 250); }; au.onerror = next; var pr = au.play(); if (pr && pr.catch) pr.catch(next); S.timer = setTimeout(next, 20000); return; } catch (e) { /* no player: the timer */ }
                }
                S.timer = setTimeout(next, 900 + x.t.length * 55);
            };
            step(0);
        },
        _prompt: prompt, _parse: parse, _bad: bad, _S: S, _okUrl: okUrl
    };
    window.QuizWatchStory = api;
})();
