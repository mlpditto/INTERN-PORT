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
    // V102.672 (owner pick A 2026-11-17, mockup-watch-first-voices/): the intern picks the pharmacist's voice, so every RX / KEY line carries TWO
    // sounds — `a` Kaitom and `b` Kaidang; a Q line has one (`a` Kaimook). A Thai story reaches interns only when every sound is there.
    var VOICE = { q: 'kaimook', rx: 'kaitom', key: 'kaitom' }, VOICE2 = 'kaidang', VSTYLE = { q: 'friendly', rx: 'calm', key: 'calm' };
    function fields(x) { return x.w === 'q' ? ['a'] : ['a', 'b']; }
    // V102.674 (owner pick A + "every Paxa voice can be picked", mockup-watch-first-paxa/): Paxa Labs = an OPTIONAL third pharmacist voice.
    // The admin picks ONE of Paxa's voices for the story (`pv` = { id, name }, from Paxa's public GET /v1/voices — no key, nothing of ours is sent);
    // ＋ Paxa voices every RX / KEY line with it (`c`, through callTtsProxy provider paxa_tts — the key stays on the server). It is not part of
    // the "all voiced" gate: a story with no Paxa sounds still reaches interns; the intern's rail shows the Paxa chip only when every `c` is there.
    var PX_ID = /^[a-z0-9_]{1,60}$/, PX_GAP = 6500;   // the free plan allows 10 requests a minute
    function pvOf(st) { var p = st && st.pv; return p && typeof p.id === 'string' && PX_ID.test(p.id) ? { id: p.id, name: String(p.name || p.id).replace(/[<>]/g, '').trim().slice(0, 40) || p.id } : null; }
    function pxLines() { return S.story ? S.story.lines.filter(function (x) { return x.w !== 'q' && x.t.trim(); }) : []; }
    function pxHave() { return pxLines().filter(function (x) { return okUrl(x.c); }).length; }
    function needed() { return S.story ? S.story.lines.reduce(function (n, x) { return n + fields(x).length; }, 0) : 0; }
    function lineDone(x) { return fields(x).every(function (f) { return okUrl(x[f]); }); }
    function okUrl(u) { return typeof u === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/\S+$/.test(u); }
    function voiced() { return S.story ? S.story.lines.reduce(function (n, x) { return n + fields(x).filter(function (f) { return okUrl(x[f]); }).length; }, 0) : 0; }
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
        var ls = story.lines.map(function (x) { return x && ORDER.indexOf(x.w) > -1 && String(x.t || '').trim() ? Object.assign({ w: x.w, t: String(x.t).trim().slice(0, LEN), q: (Array.isArray(x.q) ? x.q : []).filter(function (n) { return Number.isInteger(n) && n > 0; }).slice(0, 6) }, okUrl(x.a) ? { a: x.a } : {}, x.w !== 'q' && okUrl(x.b) ? { b: x.b } : {}, x.w !== 'q' && okUrl(x.c) && pvOf(story) ? { c: x.c } : {}) : null; }).filter(Boolean).slice(0, MAX);
        return ls.length ? Object.assign({ lang: /^(th|en|ko)$/.test(story.lang) ? story.lang : langOf(ls.map(function (x) { return x.t; }).join(' ')), lines: ls }, pvOf(story) ? { pv: pvOf(story) } : {}) : null;
    }
    function want(n) { return Math.max(12, Math.min(MAX, n * 2)); }
    function prompt(ns, L) {
        var NAME = { en: 'English', th: 'Thai', ko: 'Korean' }, N = want(ns.length);
        // V102.671 (owner pick A): the story used to start in the middle of note 1 — it now opens like a conversation: a greeting + the quiz topic
        var title = String((document.getElementById('quiz-title') || {}).value || '').replace(/[\s"]+/g, ' ').trim().slice(0, 80);
        return 'These are the "Read first" notes pharmacy interns see before each question of one quiz. Turn them into ONE short CHAT STORY that prepares the intern for the whole quiz, in ' + NAME[L] + '.\n' +
            'Write ' + (N - 4) + ' to ' + N + ' lines, one per line, each starting with a speaker tag and the note number(s) it comes from in square brackets:\n' +
            'Q [1]: a pharmacy intern asks\nRX [1]: the pharmacist answers\nKEY [1,2]: one key point to remember (' + Math.round(N / 6) + ' to ' + Math.round(N / 4) + ' of these)\n' +
            'Rules: follow the order of the notes; cover every note that has content. Keep each line short (under 80 characters; under 60 for Thai or Korean). ' +
            'Every RX and KEY line must TEACH one concrete fact taken from its note — a drug name, a number, a rule, a reason. Never write a line that only names a topic or says something should be reviewed, checked or understood. ' +
            'Every Q line is a real question an intern would ask, ending with a question mark. The last line is a KEY line. ' +
            'OPEN like a real conversation: the FIRST line is a Q line where the intern greets the pharmacist, says they are about to do ' + (title ? 'the quiz on "' + title + '"' : 'this quiz') + ' and asks where to start (tag it with the first note\'s number); ' +
            'the SECOND line is the RX reply that leads into the first note. The opening adds no patient, no number and no fact that the notes do not say. ' +
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
            '<button type="button" class="qws-b qws-v' + (voiced() && voiced() === needed() ? ' all' : '') + '" id="qws-voice" onclick="QuizWatchStory.voices()"' + (S.busy ? ' disabled' : '') + ' aria-label="AI voices" title="AI voices (Chinda): intern = Kaimook; pharmacist = Kaitom AND Kaidang — the intern picks which one to hear. Interns see a Thai story only when every sound is ready. Each sound is one paid voice call.">🗣 <span class="qws-vn">' + (S.voicing ? S.voicing.done + '/' + S.voicing.total + ' …' : voiced() + '/' + needed()) + '</span></button>' +
            pxBtnHtml(st) +
            '<button type="button" class="qws-b" onclick="QuizWatchStory.play()" aria-label="' + (S.play > -1 ? 'Stop' : 'Play') + '" title="Play the story here">' + (S.play > -1 ? '⏹' : '▶') + '</button>' +
            '<button type="button" class="qws-b" onclick="QuizWatchStory.make()" aria-label="Write again" title="Write the story again from Read first">↻</button>' +
            '<button type="button" class="qws-b" onclick="QuizWatchStory.clear()" aria-label="Remove the story" title="Remove the story">🗑</button></div>' +
            (S.err ? '<div class="qws-err" role="alert">' + esc(S.err) + '</div>' : '') + pxPickHtml(st) +
            st.lines.map(function (x, i) {
                var b = bad(x.t);
                return '<div class="qws-l' + (x.w === 'key' ? ' k' : '') + (i === S.play ? ' now' : '') + '"><button type="button" class="qws-w" onclick="QuizWatchStory.who(' + i + ')" title="Who says it — tap to change" aria-label="Speaker: ' + WHO[x.w][1] + '">' + WHO[x.w][0] + ' ' + WHO[x.w][1] + '</button>' +
                    '<input type="text" maxlength="' + LEN + '" value="' + esc(x.t) + '" oninput="QuizWatchStory.edit(' + i + ', this.value)" aria-label="Line ' + (i + 1) + '">' +
                    (b.length ? '<span class="qws-warn" title="Not in any Read first note: ' + esc(b.join(', ')) + '">⚠️ ' + esc(b.join(', ')) + '</span>' : '') +
                    (lineDone(x) ? '<i class="qws-a" title="AI voice ready">♪</i>' : '') +
                    '<em>' + (x.q.length ? 'Q' + x.q.join(' · ') : '') + '</em>' +
                    '<button type="button" class="qws-x" onclick="QuizWatchStory.del(' + i + ')" aria-label="Remove line ' + (i + 1) + '">×</button></div>';
            }).join('') +
            (st.lines.length < MAX ? '<button type="button" class="qws-add" onclick="QuizWatchStory.add()">＋ line</button>' : '');
    }
    // V102.674 the Paxa button(s): no voice yet → "＋ Paxa" opens the picker; with a voice → "<name> n/m" voices what is missing, ▾ changes the voice
    function pxBtnHtml(st) {
        if (st.lang !== 'th') return '';
        var pv = pvOf(st), need = pxLines().length, have = pxHave(), dis = S.busy ? ' disabled' : '';
        if (!pv) return '<button type="button" class="qws-b qws-v qws-px" id="qws-paxa" onclick="QuizWatchStory.paxaPick()"' + dis + ' aria-expanded="' + !!S.pxOpen + '" title="Optional: a third pharmacist voice from Paxa Labs. Pick one of its voices, then voice the pharmacist lines with it — interns get one more chip on their voice rail. Paid by Paxa credits.">＋ Paxa</button>';
        return '<button type="button" class="qws-b qws-v qws-px' + (need && have === need ? ' all' : '') + '" id="qws-paxa" onclick="QuizWatchStory.paxa()"' + dis + ' title="Paxa voice ' + esc(pv.name) + ' for the pharmacist lines (optional third voice). Each sound is one paid Paxa call; one call every ' + Math.round(PX_GAP / 100) / 10 + ' s (the plan limit).">🗣 ' + esc(pv.name) + ' <span class="qws-pn">' + (S.pxing ? S.pxing.done + '/' + S.pxing.total + ' …' : have + '/' + need) + '</span></button>' +
            '<button type="button" class="qws-b qws-px" id="qws-paxa-pick" onclick="QuizWatchStory.paxaPick()"' + dis + ' aria-expanded="' + !!S.pxOpen + '" aria-label="Change the Paxa voice" title="Change the Paxa voice (its sounds are made again)">' + (S.pxOpen ? '▴' : '▾') + '</button>';
    }
    function pxPickHtml(st) {
        if (!S.pxOpen || st.lang !== 'th') return '';
        var pv = pvOf(st), vs = S.pxVoices, g = S.pxG || '';
        var body = !vs ? '<small>' + (S.pxErr ? '⚠️ ' + esc(S.pxErr) : 'Loading the Paxa voices…') + '</small>'
            : '<div class="qws-pxf" role="group" aria-label="Filter">' + [['', 'All ' + vs.length], ['f', '♀ ' + vs.filter(function (v) { return v.g === 'f'; }).length], ['m', '♂ ' + vs.filter(function (v) { return v.g === 'm'; }).length]].map(function (o) { return '<button type="button" aria-pressed="' + (g === o[0]) + '" onclick="QuizWatchStory.paxaFilter(' + String.fromCharCode(39) + o[0] + String.fromCharCode(39) + ')">' + o[1] + '</button>'; }).join('') + '</div>' +
              '<div class="qws-pxl" role="group" aria-label="Paxa voices">' + vs.filter(function (v) { return !g || v.g === g; }).map(function (v) { return '<button type="button" aria-pressed="' + !!(pv && pv.id === v.id) + '" title="' + esc(v.d) + '" onclick="QuizWatchStory.paxaVoice(' + String.fromCharCode(39) + v.id + String.fromCharCode(39) + ')">' + (v.g === 'f' ? '♀ ' : v.g === 'm' ? '♂ ' : '') + esc(v.n) + '</button>'; }).join('') + '</div>';
        return '<div class="qws-pxp" id="qws-pxp"><small>Paxa Labs · pick ONE voice for the pharmacist lines (hover a name for what it sounds like; listen at paxalabs.com ▸ Speech). Interns get it as a third chip beside Kaitom / Kaidang.</small>' + body + '</div>';
    }
    function pxLoad() {
        if (S.pxVoices || S.pxLoading) return Promise.resolve();
        S.pxLoading = true; S.pxErr = '';
        return fetch('https://api.paxalabs.com/v1/voices').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
            var vs = (j && Array.isArray(j.voices) ? j.voices : []).filter(function (v) { return v && v.model === 'paxa-tts-flash-v2' && typeof v.id === 'string' && PX_ID.test(v.id) && !v.experimental; })
                .map(function (v) { return { id: v.id, n: String(v.name || v.id).replace(/[<>]/g, '').slice(0, 40), g: v.gender === 'f' || v.gender === 'm' ? v.gender : '', d: String(v.description || '').slice(0, 200) }; });
            if (!vs.length) throw new Error('the list came back empty');
            S.pxVoices = vs;
        }).catch(function (e) { S.pxErr = 'Could not load the Paxa voices (' + (e && e.message || e) + ') — close and open ▾ to try again.'; })
          .then(function () { S.pxLoading = false; paint(); });
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
            if (x.a || x.b || x.c) {   // new words: the old sounds no longer say this line
                var hadC = !!x.c; delete x.a; delete x.b; delete x.c; if (hadC) { var pn = box().querySelector('.qws-pn'), pb = document.getElementById('qws-paxa'); if (pn) pn.textContent = pxHave() + '/' + pxLines().length; if (pb) pb.classList.remove('all'); }
                var row = box().querySelectorAll('.qws-l')[i], a = row && row.querySelector('.qws-a'), n = box().querySelector('.qws-vn'), b = document.getElementById('qws-voice');
                if (a) a.remove(); if (n) n.textContent = voiced() + '/' + needed(); if (b) b.classList.remove('all');
                if (typeof window._qeWatchChip === 'function') window._qeWatchChip();
            }
            touch();
        },
        voices: function () {
            if (S.busy || !S.story) return Promise.resolve();
            var fail = function (m) { S.err = '🗣 ' + m; paint(); return Promise.resolve(); };
            if (S.story.lang !== 'th') return fail('AI voices are for Thai stories only for now — other languages use the phone voice.');
            if (typeof window.callTtsProxy !== 'function' || typeof window._sha256Hex !== 'function') return fail('the voice service is not loaded on this page.');
            var todo = []; S.story.lines.forEach(function (x) { if (x.t.trim()) fields(x).forEach(function (f) { if (!okUrl(x[f])) todo.push({ x: x, f: f }); }); });
            if (!todo.length) return fail('every line already has its voice. Edit a line to voice it again.');
            stop(); S.busy = true; S.err = ''; S.voicing = { done: 0, total: todo.length }; paint();
            var one = function (job) {
                var x = job.x, said = x.t, w = x.w;
                return window.callTtsProxy({ provider: 'iapp_tts', text: said, voice: job.f === 'b' ? VOICE2 : VOICE[w], style: VSTYLE[w], feature: 'quiz_watch_voice' }).then(function (r) {
                    if (!r || !r.audioContent) throw new Error('no audio came back');
                    var mime = r.mimeType || 'audio/mpeg'; return store(blobOf(r.audioContent, mime), mime);
                }).then(function (url) { if (x.t === said && x.w === w && okUrl(url)) x[job.f] = url; S.voicing.done++; paint(); });
            };
            return todo.reduce(function (p, x) { return p.then(function () { return one(x); }); }, Promise.resolve())
                .catch(function (e) { S.err = '🗣 stopped at sound ' + (S.voicing.done + 1) + ' of ' + S.voicing.total + ': ' + (e && e.message || e) + ' — the sounds already made are kept; tap 🗣 to go on.'; })
                .then(function () { S.busy = false; S.voicing = null; touch(); paint(); });
        },
        // V102.674 Paxa — the optional third pharmacist voice
        paxaPick: function () { if (S.busy || !S.story) return; S.pxOpen = !S.pxOpen; S.pxG = ''; if (S.pxOpen && !S.pxVoices) { S.pxErr = ''; pxLoad(); } paint(); },
        paxaFilter: function (g) { S.pxG = g === 'f' || g === 'm' ? g : ''; paint(); },
        paxaVoice: function (id) {
            var v = (S.pxVoices || []).find(function (x) { return x.id === id; }); if (!v || !S.story || S.busy) return;
            var was = pvOf(S.story);
            if (!was || was.id !== v.id) { S.story.lines.forEach(function (x) { delete x.c; }); S.story.pv = { id: v.id, name: v.n }; touch(); }   // another voice: the old sounds are not it
            S.pxOpen = false; S.err = ''; paint();
        },
        paxaDrop: function () { if (!S.story || S.busy) return; S.story.lines.forEach(function (x) { delete x.c; }); delete S.story.pv; S.pxOpen = false; touch(); paint(); },
        paxa: function () {
            if (S.busy || !S.story) return Promise.resolve();
            var fail = function (m) { S.err = '🗣 Paxa: ' + m; paint(); return Promise.resolve(); }, pv = pvOf(S.story);
            if (!pv) return fail('pick a voice first (＋ Paxa).');
            if (typeof window.callTtsProxy !== 'function' || typeof window._sha256Hex !== 'function') return fail('the voice service is not loaded on this page.');
            var todo = pxLines().filter(function (x) { return !okUrl(x.c); });
            if (!todo.length) return fail('every pharmacist line already has its ' + pv.name + ' sound. Edit a line, or pick another voice with ▾.');
            stop(); S.busy = true; S.err = ''; S.pxOpen = false; S.pxing = { done: 0, total: todo.length }; paint();
            var gap = typeof S.pxGap === 'number' ? S.pxGap : PX_GAP;
            var one = function (x, first) {
                var said = x.t, w = x.w;
                return (first ? Promise.resolve() : new Promise(function (ok) { setTimeout(ok, gap); })).then(function () {
                    return window.callTtsProxy({ provider: 'paxa_tts', text: said, voice: pv.id, feature: 'quiz_watch_voice' });
                }).then(function (r) {
                    if (!r || !r.audioContent) throw new Error('no audio came back');
                    var mime = r.mimeType || 'audio/mpeg'; return store(blobOf(r.audioContent, mime), mime);
                }).then(function (url) { var now = pvOf(S.story); if (x.t === said && x.w === w && now && now.id === pv.id && okUrl(url)) x.c = url; S.pxing.done++; paint(); });
            };
            return todo.reduce(function (p, x, i) { return p.then(function () { return one(x, i === 0); }); }, Promise.resolve())
                .catch(function (e) { S.err = '🗣 Paxa stopped at sound ' + (S.pxing.done + 1) + ' of ' + S.pxing.total + ': ' + (e && e.message || e) + ' — the sounds already made are kept; tap the Paxa button to go on.'; })
                .then(function () { S.busy = false; S.pxing = null; touch(); paint(); });
        },
        who: function (i) { var x = S.story && S.story.lines[i]; if (!x) return; x.w = ORDER[(ORDER.indexOf(x.w) + 1) % ORDER.length]; delete x.a; delete x.b; delete x.c; touch(); paint(); },   // V102.672: another speaker = another voice
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
        voice: function () { return { th: !!S.story && S.story.lang === 'th', have: voiced(), need: needed(), px: pvOf(S.story) ? { name: pvOf(S.story).name, have: pxHave(), need: pxLines().length } : null }; },   // V102.672: for the chip beside Review
        _prompt: prompt, _parse: parse, _bad: bad, _S: S, _okUrl: okUrl
    };
    window.QuizWatchStory = api;
})();
