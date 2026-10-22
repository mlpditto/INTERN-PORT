// V102.341 (PR 3): 👥 who read it — Read r/n · ✓ 👁 ⏳ 🔖 🧪 🔁 under the preview + a readers panel (filters, CSV); 📰 r/n chip per intern in the User Hub (userChip);
// ✨ AI draft in the toolbar (draft from the title in this language, or translate EN → TH/KO; fills the editor, never saves) via callUniversalAI.
// The preview now matches the intern sheet (V101.177: cover emoji header, 🔖 🔕, Read more, green 👍 Got it).
// V102.338: editor blend (owner pick) — one status line (Draft · Scheduled · Live · Ended + what happens next, ● Unsaved / Saved n min ago), ⚠️ wrong-language warning with
// one-tap Move to TH/KO, TH/KO show "→ EN" when empty, the cover folds to one chip, When & who / Links fold into summary lines (with ~reach), sticky action bar,
// list rows edged by status, preview says when interns see it. Same data, same writes.
// V102.335: 📰 Articles — admin side (V102.336: the modal is lang-no-toggle so Thai shows in EN mode; bodies up to 2000 characters). A short read that pops up once a day when an intern opens the app (the intern popup is a later PR).
// ➕ Create ▸ Article opens one modal: the list (status chips All · Draft · Scheduled · Live · Ended) on the left, the editor in the middle
// (cover emoji · EN/TH/KO · title · markdown body · window · 🔁 new interns · audience chips · quiz / DD Codex links), and a 📱 preview of the
// intern popup (bottom sheet) on the right. Firestore: articles/{id} (admin writes; interns read status 'scheduled' only — see firestore.rules).
// Live / Ended are not stored: they follow from startAt / endAt. EN is required to schedule; TH / KO fall back to EN in the app.
(function () {
    'use strict';
    var LANGS = [['en', 'EN'], ['th', 'TH'], ['ko', 'KO']];
    var COVERS = ['📰', '🫁', '💊', '🧪', '🩺', '🦠', '🧊', '🌡️', '⚠️', '💡'];
    var FILTERS = [['all', 'All'], ['draft', 'Draft'], ['scheduled', 'Scheduled'], ['live', 'Live'], ['ended', 'Ended']];
    var RERUN = [['off', 'Off', 'Interns who join after it ends never get it'], ['any', 'All new interns', 'Interns who join after it ends get it too, oldest first, one a day']];
    var MAX_BODY = 2000, MAX_TITLE = 90, BKK = 7 * 3600e3;
    var S = { list: [], loaded: false, loading: false, err: '', filter: 'all', cur: null, lang: 'en', saving: false, del: false, pick: '', q: '', codex: null, base: '', savedAt: 0, open: {}, who: false, whoF: 'all', model: '', modelOpen: false, aiBusy: false, aiNote: '' };
    var DONE = ['ok', 'quiz', 'codex', 'hist'];   // what counts as read (articles.js); 'x' = closed without reading
    // V102.362: 🌐 Translate all — one click fills every missing TH / KO from the EN version and saves, one at a time
    var TR = { busy: false, stop: false, prog: '' };
    var DA = { busy: false, stop: false, prog: '' };   // V102.375: 🩺 Draft all — the Disease Codex twin of Translate all
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var msOf = function (t) { return t == null ? null : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : Date.parse(t) || null; };

    // ---- pure helpers (also used by the test)
    // Thailand has no daylight saving, so Bangkok time = UTC+7 all year.
    function toLocal(ms) { return new Date(ms + BKK).toISOString().slice(0, 16); }            // for <input type="datetime-local">
    function fromLocal(s) { var t = Date.parse(String(s || '') + ':00+07:00'); return isNaN(t) ? null : t; }
    // "Article of the week": the coming Monday 08:00 → Sunday 23:59 (Bangkok). On a Monday before 08:00 that is today.
    function defaultWindow(now) {
        var d = new Date(now + BKK), dow = (d.getUTCDay() + 6) % 7;                              // 0 = Monday
        var mon8 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow, 8) - BKK;
        var start = mon8 > now ? mon8 : mon8 + 7 * 864e5;
        return { start: start, end: start + 6 * 864e5 + 15 * 3600e3 + 59 * 60e3 };
    }
    function status(a, now) {
        if (!a || a.status !== 'scheduled') return 'draft';
        var s = msOf(a.startAt), e = msOf(a.endAt);
        return s != null && now < s ? 'scheduled' : e != null && now > e ? 'ended' : 'live';
    }
    function readMin(text) { return Math.max(1, Math.round(String(text || '').length / 700)); }
    function langsOf(a) { return LANGS.filter(function (l) { return String((a.title || {})[l[0]] || '').trim() && String((a.body || {})[l[0]] || '').trim(); }).map(function (l) { return l[0]; }); }
    // '' = ok. A draft only needs some title; scheduling needs the EN version, a sane window and bodies within the limit.
    function validate(a, schedule) {
        var t = a.title || {}, b = a.body || {};
        if (!LANGS.some(function (l) { return String(t[l[0]] || '').trim(); })) return 'Give it a title first.';
        for (var i = 0; i < LANGS.length; i++) {
            var k = LANGS[i][0];
            if (String(b[k] || '').length > MAX_BODY) return LANGS[i][1] + ' body is longer than ' + MAX_BODY + ' characters.';
            if (String(t[k] || '').length > MAX_TITLE) return LANGS[i][1] + ' title is longer than ' + MAX_TITLE + ' characters.';
        }
        if (!schedule) return '';
        if (!String(t.en || '').trim() || !String(b.en || '').trim()) return 'Schedule needs the EN title and body (TH / KO are optional).';
        if (msOf(a.startAt) == null || msOf(a.endAt) == null) return 'Pick when it starts and ends.';
        if (msOf(a.endAt) <= msOf(a.startAt)) return 'The end must be after the start.';
        return '';
    }
    // The Firestore document (dates as Date → Timestamp). Empty languages are left out, so "missing" = no key.
    function toDoc(a, st) {
        var pick = function (o) { var r = {}; LANGS.forEach(function (l) { var v = String((o || {})[l[0]] || '').trim(); if (v) r[l[0]] = v; }); return r; };
        var body = pick(a.body);
        return {
            title: pick(a.title), body: body, cover: { emoji: (a.cover && a.cover.emoji) || '📰' }, status: st,
            startAt: new Date(msOf(a.startAt)), endAt: new Date(msOf(a.endAt)),
            audience: { divisions: (a.audience && a.audience.divisions || []).slice(), groups: (a.audience && a.audience.groups || []).slice() },
            links: (a.links || []).map(function (l) { return { kind: l.kind, id: l.id, label: l.label }; }),
            rerun: a.rerun === 'off' ? 'off' : 'any', readMin: readMin(body.en || body.th || body.ko || '')
        };
    }
    // which script a text is mostly written in (Thai · Hangul · Latin) — catches Thai typed into the EN slot
    function scriptOf(t) {
        t = String(t || '');
        var th = (t.match(/[\u0E00-\u0E7F]/g) || []).length, ko = (t.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length, la = (t.match(/[A-Za-z]/g) || []).length;
        var top = Math.max(th, ko, la);
        return top < 8 ? '' : top === th ? 'th' : top === ko ? 'ko' : 'en';
    }
    function mismatch(a, lang) {
        var sc = scriptOf(((a.title || {})[lang] || '') + ' ' + ((a.body || {})[lang] || ''));
        return sc && sc !== lang ? sc : '';
    }
    // interns this audience reaches now (active only), via admin.html's userInScope
    function reach(a) {
        var us = (typeof usersData !== 'undefined' && Array.isArray(usersData)) ? usersData.filter(function (u) { return !u.isIgnored; }) : [];
        var keys = (a.audience.divisions || []).concat(a.audience.groups || []);
        if (!keys.length) return us.length;
        return us.filter(function (u) { return keys.some(function (k) { try { return typeof userInScope === 'function' ? userInScope(u, k) : false; } catch (e) { return false; } }); }).length;
    }
    function activeUsers() { return (typeof usersData !== 'undefined' && Array.isArray(usersData)) ? usersData.filter(function (u) { return u && !u.isIgnored; }) : []; }
    function joinedMs(u) { var t = Date.parse(String(u.startDate || '').slice(0, 10) + 'T00:00:00+07:00'); return isNaN(t) ? msOf(u.createdAt) : t; }
    function audienceHas(a, u) {
        var keys = (a.audience.divisions || []).concat(a.audience.groups || []);
        if (!keys.length) return true;
        return keys.some(function (k) { try { return typeof userInScope === 'function' && userInScope(u, k); } catch (e) { return false; } });
    }
    // is this published article meant for this intern: '' · 'live' (joined before it ended) · 'rerun' (joined after, rerun on) — same rule as articles.js
    function forUser(a, u, now) {
        var st = status(a, now);
        if (st === 'draft' || st === 'scheduled' || !audienceHas(a, u)) return '';
        var j = joinedMs(u);
        if (j == null || j <= a.endAt) return 'live';
        return a.rerun === 'off' ? '' : 'rerun';
    }
    function readers(a, now) {
        return activeUsers().map(function (u) {
            var k = forUser(a, u, now); if (!k) return null;
            var sn = (u.articleSeen || {})[a.id] || null;
            return { u: u, kind: k, s: sn, st: sn && DONE.indexOf(sn.act) >= 0 ? 'read' : sn && sn.act === 'x' ? 'closed' : 'wait' };
        }).filter(Boolean);
    }
    function stats(a, now) {
        var c = { n: 0, read: 0, closed: 0, wait: 0, saved: 0, quiz: 0, rerun: 0 };
        readers(a, now).forEach(function (x) { c.n++; c[x.st]++; if (x.s && x.s.saved) c.saved++; if (x.s && x.s.act === 'quiz') c.quiz++; if (x.kind === 'rerun') c.rerun++; });
        return c;
    }
    // User Hub: 📰 read/for-them per intern; nothing when no published article is for them (no data = no chip)
    function userChip(u) {
        if (!S.loaded || !u) return '';
        var now = Date.now(), n = 0, r = 0, cl = 0;
        S.list.forEach(function (a) { if (!forUser(a, u, now)) return; n++; var sn = (u.articleSeen || {})[a.id]; if (sn && DONE.indexOf(sn.act) >= 0) r++; else if (sn && sn.act === 'x') cl++; });
        if (!n) return '';
        var w = n - r, cls = !w ? 'ok' : w >= 2 ? 'bad' : 'warn';
        return '<span class="u-art ' + cls + '" title="📰 Articles: read ' + r + ' of ' + n + (cl ? ' · closed ' + cl + ' without reading' : '') + (w - cl > 0 ? ' · ' + (w - cl) + ' not seen yet' : '') + '" aria-label="Articles read ' + r + ' of ' + n + '">📰 ' + r + '/' + n + '</span>';
    }
    function blank(now) {
        var w = defaultWindow(now);
        return { id: null, title: {}, body: {}, cover: { emoji: '📰' }, status: 'draft', startAt: w.start, endAt: w.end, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
    }
    function fromDoc(id, d) {
        return { id: id, title: Object.assign({}, d.title), body: Object.assign({}, d.body), cover: Object.assign({ emoji: '📰' }, d.cover), status: d.status === 'scheduled' ? 'scheduled' : 'draft',
            startAt: msOf(d.startAt), endAt: msOf(d.endAt), audience: { divisions: ((d.audience || {}).divisions || []).slice(), groups: ((d.audience || {}).groups || []).slice() },
            links: (d.links || []).slice(), rerun: d.rerun === 'off' ? 'off' : 'any', createdAt: msOf(d.createdAt), dx: d.dx || null, dc: d.dc || null };   // V102.374: dc = the Drug Codex twin of dx   // V102.371: dx = {draftId, publishedId, name} once sent to the Disease Codex
    }

    // ---- data
    function load() {
        if (S.loading) return Promise.resolve();
        S.loading = true; S.err = ''; render();
        return db.collection('articles').get().then(function (snap) {
            S.list = snap.docs.map(function (d) { return fromDoc(d.id, d.data()); });
            S.loaded = true;
        }).catch(function (e) { S.err = (e && e.message) || 'Could not load the articles.'; }).then(function () { S.loading = false; render(); });
    }
    function sorted(now) {
        var rank = { live: 0, scheduled: 1, draft: 2, ended: 3 };
        return S.list.filter(function (a) { return S.filter === 'all' || status(a, now) === S.filter; }).sort(function (x, y) {
            var a = status(x, now), b = status(y, now);
            return rank[a] - rank[b] || (a === 'ended' ? (y.endAt || 0) - (x.endAt || 0) : (x.startAt || 0) - (y.startAt || 0));
        });
    }
    function editorEmail() {
        try { var u = (window.adminApp && window.adminApp.auth().currentUser) || (firebase.auth && firebase.auth().currentUser); return (u && typeof u.email === 'string') ? u.email : ''; } catch (e) { return ''; }
    }
    function save(schedule) {
        var a = S.cur; if (!a || S.saving) return Promise.resolve();
        var st = schedule ? 'scheduled' : 'draft', err = validate(a, schedule);
        if (err) { S.err = err; render(); return Promise.resolve(); }
        var doc = toDoc(a, st), ts = firebase.firestore.FieldValue.serverTimestamp();
        doc.updatedAt = ts; doc.updatedBy = editorEmail();
        S.saving = true; S.err = ''; render();
        var p = a.id ? db.collection('articles').doc(a.id).update(doc) : (doc.createdAt = ts, doc.createdBy = doc.updatedBy, db.collection('articles').add(doc));
        return p.then(function (ref) {
            if (!a.id && ref) a.id = ref.id;
            a.status = st; S.base = JSON.stringify(a); S.savedAt = Date.now();
            var i = S.list.findIndex(function (x) { return x.id === a.id; });
            var copy = fromDoc(a.id, Object.assign({}, doc, { startAt: a.startAt, endAt: a.endAt, dx: a.dx, dc: a.dc }));
            if (i >= 0) S.list[i] = copy; else S.list.push(copy);
            if (typeof showToast === 'function') showToast(schedule ? '📅 Scheduled' : '💾 Saved as draft');
            if (!S.hintOff[a.id]) loadDz().then(function () { if (S.cur === a) { S.hint = findHint(a); if (S.hint) render(); } });   // V102.374: "… is in the Disease Codex — link it?"
        }).catch(function (e) { S.err = (e && e.message) || 'Save failed.'; }).then(function () { S.saving = false; render(); });
    }
    // V102.374 (owner's pick 4): after Save, if the article's title or body names a published disease (name, Thai name or a synonym of
    // 4+ characters) and the article is not linked to or drafted into the Disease Codex yet, a banner offers the link — no AI, no click
    // needed to find it. "Not this one" is remembered for the session.
    function dzDocs() { return (typeof dxaState !== 'undefined' && dxaState && Array.isArray(dxaState.codex) && dxaState.codex.length) ? dxaState.codex : (S.dz || []); }
    function loadDz() {
        if (dzDocs().length || S.dz != null) return Promise.resolve();
        S.dz = [];
        return db.collection('disease_codex').get().then(function (snap) { S.dz = snap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); }); }).catch(function () { S.dz = null; });
    }
    function findHint(a) {
        if (!a || (a.links || []).some(function (l) { return l.kind === 'disease'; }) || (a.dx && (a.dx.draftId || a.dx.publishedId))) return null;
        var t = (a.title || {}), b = (a.body || {}), text = [t.en, t.th, t.ko, b.en, b.th, b.ko].filter(Boolean).join(' ').toLowerCase();
        if (!text.trim()) return null;
        var best = null;
        dzDocs().forEach(function (d) {
            if (!d || !d.diseaseName) return;
            [d.diseaseName, d.thaiName].concat(Array.isArray(d.synonyms) ? d.synonyms : []).forEach(function (term) {
                term = String(term || '').trim();
                if (term.length < 4) return;
                var lo = term.toLowerCase(), latin = /^[a-z0-9 .'-]+$/i.test(term);
                var hit = latin ? new RegExp('(^|[^a-z0-9])' + lo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^a-z0-9]|$)').test(text) : text.indexOf(lo) >= 0;   // Latin terms match whole words only
                if (!hit) return;
                if (!best || term.length > best.term.length) best = { id: d._id || d.id, name: String(d.diseaseName), label: String(d.diseaseName) + (d.thaiName ? ' · ' + d.thaiName : ''), meta: [d.icd10, d.category].filter(Boolean).join(' · '), term: term };
            });
        });
        return best;
    }
    function hintHtml() {
        if (!S.hint) return '';
        return '<div class="art-warn art-hint" role="status" style="background:#eef2ff;color:#3730a3;border-color:#c7d2fe">🩺 Saved · <b>' + esc(S.hint.name) + '</b> is in the Disease Codex' + (S.hint.meta ? ' (' + esc(S.hint.meta) + ')' : '') + ' — link this article to it?<button type="button" onclick="Articles.hintLink()">Link 🩺</button><button type="button" style="background:#fff;color:#64748b" onclick="Articles.hintDismiss()">Not this one</button></div>';
    }
    // Two taps: 🗑 arms the button, the second tap deletes (no confirm() — it is blocked after awaits in some browsers).
    function remove() {
        var a = S.cur; if (!a || !a.id) { S.cur = null; render(); return Promise.resolve(); }
        if (!S.del) { S.del = true; render(); return Promise.resolve(); }
        S.del = false;
        return db.collection('articles').doc(a.id).delete().then(function () {
            S.list = S.list.filter(function (x) { return x.id !== a.id; }); S.cur = null;
            if (typeof showToast === 'function') showToast('🗑 Deleted');
        }).catch(function (e) { S.err = (e && e.message) || 'Delete failed.'; }).then(render);
    }

    // ---- audience + links sources (admin.html globals)
    function divisions() { return (typeof divisionConfig !== 'undefined' && divisionConfig) ? Object.keys(divisionConfig).sort() : []; }
    // groups with nobody active are hidden (no data = no chip), unless this article already targets them
    function groups(picked) {
        var all = []; try { all = typeof getGlobalGroups === 'function' ? getGlobalGroups() : []; } catch (e) { /* none */ }
        return all.filter(function (g) { return (picked || []).indexOf(g) >= 0 || typeof groupActiveCount !== 'function' || groupActiveCount(g) > 0; });
    }
    function quizzes() {
        var list = (typeof quizzesData !== 'undefined' && Array.isArray(quizzesData)) ? quizzesData : [];
        return list.filter(function (q) { return q && q.id && String(q.id).indexOf('--') !== 0 && !q.isTemplate && !q.isHistoryRevision && q.title; })
            .map(function (q) { return { kind: 'quiz', id: q.id, label: String(q.title) }; });
    }
    function codex() {
        var live = (typeof dcaState !== 'undefined' && dcaState && Array.isArray(dcaState.codex) && dcaState.codex.length) ? dcaState.codex : S.codex;
        return (live || []).filter(function (d) { return d && d.genericName; }).map(function (d) { return { kind: 'codex', id: d._id || d.id, label: String(d.genericName) }; });
    }
    // V102.372 (owner's pick 1): ＋ Disease = a published Disease Codex entry, picked by hand (no AI); the intern gets the same 🩺 button as a drafted one
    function diseases() {
        var live = (typeof dxaState !== 'undefined' && dxaState && Array.isArray(dxaState.codex) && dxaState.codex.length) ? dxaState.codex : S.dz;
        return (live || []).filter(function (d) { return d && d.diseaseName; }).map(function (d) { return { kind: 'disease', id: d._id || d.id, label: String(d.diseaseName) + (d.thaiName ? ' · ' + d.thaiName : '') }; });
    }
    function linkSrc(kind) { return kind === 'quiz' ? quizzes() : kind === 'disease' ? diseases() : codex(); }
    var LINK_ICON = { quiz: '🧪 ', codex: '💊 ', disease: '🩺 ' };
    function openPick(kind) {
        S.pick = S.pick === kind ? '' : kind; S.q = ''; render();
        if (kind === 'codex' && !codex().length && S.codex == null) {
            S.codex = [];
            db.collection('drug_codex').get().then(function (snap) { S.codex = snap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); }); render(); }).catch(function () { S.codex = null; });
        }
        if (kind === 'disease' && !diseases().length && S.dz == null) {
            S.dz = [];
            db.collection('disease_codex').get().then(function (snap) { S.dz = snap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); }); render(); }).catch(function () { S.dz = null; });
        }
    }

    // ---- view
    function css() {
        if (document.getElementById('art-css')) return;
        var s = document.createElement('style'); s.id = 'art-css';
        s.textContent = '#articlesModal .modal-content{max-width:1240px;width:96%;padding:16px 18px;max-height:92vh}' +
            '.art-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 34px 12px 0}.art-h h2{margin:0;font-size:1.25em}' +
            '.art-rail{display:inline-flex;gap:3px;background:#f1f5f9;border-radius:999px;padding:3px;flex-wrap:wrap}.art-rail button{min-height:0;margin:0;width:auto;border:0;background:transparent;padding:5px 11px;border-radius:999px;font-size:12.5px;font-weight:700;color:#475569;cursor:pointer}' +
            '.art-rail button b{opacity:.65;margin-left:4px}.art-rail button.on{background:#4361ee;color:#fff}' +
            '.art-new{margin:0 0 0 6px!important;width:auto!important;min-height:0!important;background:#4361ee;color:#fff;border:0;border-radius:12px;padding:8px 14px;font-weight:800;cursor:pointer}' +
            '.art-da-all{margin-left:8px!important;background:#fff7ed!important;color:#c2410c!important;border-color:#fdba74!important}' +
            '.art-tr-all{margin:0 0 0 auto!important;width:auto!important;min-height:0!important;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:12px;padding:8px 12px;font-weight:800;cursor:pointer;white-space:nowrap}.art-tr-all:disabled{opacity:.6;cursor:not-allowed}.art-tr-all.busy{background:#fef3c7;color:#92400e;border-color:#fde68a}' +
            '.art-g{display:grid;grid-template-columns:300px minmax(0,1fr) 290px;gap:14px;align-items:start}@media(max-width:1100px){.art-g{grid-template-columns:260px minmax(0,1fr)}.art-g>.art-pv{display:none}}@media(max-width:760px){.art-g{grid-template-columns:1fr}}' +
            '.art-list{display:flex;flex-direction:column;gap:6px;max-height:70vh;overflow:auto}.art-row{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid #e2e8f0;border-radius:14px;padding:9px 10px;display:grid;grid-template-columns:36px 1fr;gap:8px;background:#fff}' +
            '.art-row:hover{border-color:#c7d2fe}.art-row.sel{border-color:#4361ee;box-shadow:0 0 0 2px rgba(67,97,238,.15);background:#f8faff}.art-row.ended{opacity:.6}' +
            '.art-tile{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#dbeafe,#e0f2fe);display:grid;place-items:center;font-size:19px}.art-t{font-weight:800;font-size:13.5px;line-height:1.3;color:#1e293b;word-break:break-word}' +
            '.art-meta{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px;font-size:11.5px;color:#64748b}' +
            '.art-st{padding:1px 8px;border-radius:999px;font-weight:800;font-size:11px}.art-st.live{background:#dcfce7;color:#166534}.art-st.scheduled{background:#eff6ff;color:#1d4ed8}.art-st.draft{background:#f1f5f9;color:#475569}.art-st.ended{background:#f8fafc;color:#94a3b8;border:1px solid #e2e8f0}' +
            '.art-lg{font-weight:800;font-size:10px;padding:1px 5px;border-radius:5px;background:#eef2ff;color:#4338ca}.art-lg.off{background:#f8fafc;color:#cbd5e1;text-decoration:line-through}' +
            '.art-ed{border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:9px;min-width:0}.art-empty{color:#94a3b8;text-align:center;padding:40px 10px;border:1px dashed #e2e8f0;border-radius:16px}' +
            '.art-ln{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.art-ml{font-size:11px;font-weight:800;color:#94a3b8;min-width:64px}' +
            '.art-c{min-height:0!important;margin:0!important;width:auto!important;padding:5px 10px;border-radius:999px;border:1px solid #e2e8f0;font-size:12px;font-weight:800;color:#64748b;background:#fff;display:inline-flex;gap:5px;align-items:center;cursor:pointer}' +
            '.art-c.on{background:#4361ee;color:#fff;border-color:#4361ee}.art-c i.d{width:7px;height:7px;border-radius:50%;background:#e2e8f0;display:inline-block}.art-c i.d.ok{background:#22c55e}' +
            '.art-emo{min-height:0!important;margin:0!important;width:34px!important;height:34px;padding:0;border-radius:10px;border:1px solid #e2e8f0;display:grid;place-items:center;font-size:18px;background:#fff;cursor:pointer}.art-emo.on{border:2px solid #4361ee;background:#eef2ff}' +
            '.art-in{flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font:inherit;font-size:15px;font-weight:700;color:#1e293b;margin:0}' +
            '.art-md{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.art-tb{display:flex;align-items:center;gap:2px;padding:4px 6px;border-bottom:1px solid #e2e8f0;background:#f8fafc}' +
            '.art-tb button{min-height:0;margin:0;width:28px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:#475569;font-weight:800;cursor:pointer}.art-tb button:hover{background:#e2e8f0}' +
            '.art-ta{display:block;width:100%;box-sizing:border-box;border:0;margin:0;padding:10px 12px;font:12.5px/1.55 ui-monospace,Consolas,monospace;color:#334155;min-height:160px;resize:vertical}' +
            '.art-ft{display:flex;gap:6px;padding:4px 10px;border-top:1px solid #e2e8f0;background:#fcfcfd;font-size:11.5px;color:#94a3b8}.art-ft .over{color:#dc2626;font-weight:800}' +
            '.art-dt{border:1px solid #e2e8f0;border-radius:9px;padding:5px 8px;font:inherit;font-size:12.5px;font-weight:700;color:#334155;margin:0;width:auto}' +
            '.art-lk{display:inline-flex;align-items:center;gap:5px;padding:4px 6px 4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe}.art-lk.codex{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}' +
            '.art-lk button{min-height:0;margin:0;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer}.art-add{border-style:dashed!important}' +
            '.art-pk{border:1px solid #e2e8f0;border-radius:12px;padding:8px;background:#fff}.art-pk input{width:100%;box-sizing:border-box;margin:0 0 6px;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;font:inherit}' +
            '.art-pk .opts{max-height:170px;overflow:auto;display:flex;flex-direction:column}.art-pk .opts button{all:unset;cursor:pointer;padding:5px 8px;border-radius:7px;font-size:13px}.art-pk .opts button:hover{background:#eef2ff}' +
            '.art-err{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:6px 10px;font-size:12.5px;font-weight:700}' +
            '.art-btns{display:flex;gap:8px;align-items:center}.art-btns button{min-height:0;margin:0;width:auto;padding:8px 14px;border-radius:12px;font-weight:800;font-size:13px;border:1px solid #e2e8f0;color:#475569;background:#fff;cursor:pointer}' +
            '.art-btns .p{background:#4361ee;color:#fff;border-color:#4361ee}.art-btns .del{margin-right:auto;color:#b91c1c}.art-btns .del.arm{background:#dc2626;color:#fff;border-color:#dc2626}.art-btns button:disabled{opacity:.55;cursor:default}' +
            '.art-row{border-left-width:4px}.art-row.st-live{border-left-color:#22c55e}.art-row.st-scheduled{border-left-color:#3b82f6}.art-row.st-draft{border-left-color:#cbd5e1}.art-row.st-ended{border-left-color:#e2e8f0}.art-rr{font-size:14px}' +
            '.art-stl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 0 4px;font-size:12.5px;color:#475569}.art-stl .art-st{font-size:12.5px;padding:3px 11px}.art-save{margin-left:auto;font-size:11.5px;color:#94a3b8}.art-save.dirty{color:#b45309;font-weight:800}' +
            '.art-fb{font-size:10.5px;color:#94a3b8;font-weight:600}.art-c.on .art-fb{color:#e0e7ff}' +
            '.art-warn{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:5px 8px}.art-warn button{min-height:0;margin:0 0 0 auto;width:auto;padding:4px 10px;border-radius:8px;border:1px solid #f59e0b;background:#fff;color:#92400e;font-weight:800;font-size:12px;cursor:pointer}' +
            '.art-sec{border-top:1px solid #f1f5f9;padding-top:6px}.art-sec>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#334155;padding:3px 0}.art-sec>summary::-webkit-details-marker{display:none}' +
            '.art-sec>summary b{font-size:11px;color:#94a3b8;min-width:64px;font-weight:800}.art-sec>summary .chev{margin-left:auto;color:#94a3b8;transition:transform .15s}.art-sec[open]>summary .chev{transform:rotate(180deg)}.art-sec>.in{display:flex;flex-direction:column;gap:9px;padding:6px 0 2px}' +
            '.art-btns{position:sticky;bottom:-16px;background:#fff;border-top:1px solid #f1f5f9;margin:4px -14px -12px;padding:10px 14px 12px;border-radius:0 0 16px 16px;z-index:2}.art-btns .del{flex:none;width:36px!important;height:36px;padding:0!important;border-color:#fecaca!important;background:#fff5f5!important;opacity:1;font-size:17px}.art-btns .del:hover{background:#fee2e2!important}.art-btns .del.arm{width:auto!important;padding:8px 12px!important;opacity:1;background:#dc2626!important;border-color:#dc2626!important;font-size:13px}' +
            '.art-pvb{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#64748b}' +
            '.u-art{display:inline-flex;align-items:center;padding:0 6px;border-radius:6px;font-weight:800;font-size:.92em;line-height:1.5;white-space:nowrap;margin-left:4px;background:#f1f5f9;color:#64748b}.u-art.ok{background:#dcfce7;color:#166534}.u-art.warn{background:#fef3c7;color:#92400e}.u-art.bad{background:#fee2e2;color:#991b1b}' +
            '.art-stats{border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;font-size:12.5px}.art-stats .hd{display:flex;justify-content:space-between;font-weight:800}.art-stats .bar{height:8px;border-radius:9px;background:#f1f5f9;overflow:hidden;margin:6px 0 8px}.art-stats .bar i{display:block;height:100%;background:#22c55e}' +
            '.art-stats .n{display:flex;gap:12px;flex-wrap:wrap;color:#475569;font-weight:700}.art-stats .who{all:unset;cursor:pointer;display:block;margin-top:8px;color:#4361ee;font-weight:800;font-size:12.5px}' +
            '.art-whop{border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;min-width:0;grid-column:2 / -1}.art-x{min-height:0;margin:0;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:#f1f5f9;color:#64748b;cursor:pointer;flex:none}.art-whop .h{display:flex;align-items:center;gap:8px;margin-bottom:8px}.art-whop .h b{font-size:15px}.art-whop .h .sub{font-size:12px;color:#64748b;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '.art-wr{display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid #f1f5f9}.art-wr .av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12px;color:#334155;flex:none;overflow:hidden;background:#e2e8f0}.art-wr .av img{width:100%;height:100%;object-fit:cover}' +
            '.art-wr .nm{flex:1;min-width:0}.art-wr .nm b{font-size:13px}.art-wr .nm small{display:block;font-size:11.5px;color:#64748b}.art-wr .pill{padding:2px 9px;border-radius:999px;font-weight:800;font-size:12px;white-space:nowrap}.art-wr .pill.read{background:#dcfce7;color:#166534}.art-wr .pill.closed{background:#fef3c7;color:#92400e}.art-wr .pill.wait{background:#f1f5f9;color:#64748b}.art-wr .tm{font-size:11px;color:#94a3b8;text-align:right;min-width:86px}' +
            '.art-wl{max-height:56vh;overflow:auto}.art-ai{margin-left:auto;display:inline-flex;align-items:center;gap:4px}.art-tb .art-ai button{width:auto;padding:0 9px;font-size:12px}.art-tb .art-ai .go{background:#fef3c7;color:#92400e}.art-tb .art-ai .go:disabled{opacity:.6}.art-tb .art-ai .mdl{color:#64748b;font-weight:700}' +
            '.art-mrail{padding:6px 8px;border-bottom:1px solid #e2e8f0;background:#fcfcfd}.art-mrail .audit-model-row{margin:0;padding:0;border:0;gap:6px;flex-wrap:nowrap;overflow-x:auto}.art-mrail .audit-providers{flex-wrap:nowrap;gap:4px;padding-right:6px;border-right:1px solid #e2e8f0}.art-mrail .text-ai-chips{display:flex;flex-wrap:nowrap;gap:4px}.art-mrail .text-ai-chips>button[hidden]{display:none!important}.art-mrail .audit-provider{width:30px;height:30px;min-height:0;margin:0;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;box-shadow:none;display:grid;place-items:center;cursor:pointer}.art-mrail .audit-provider[aria-pressed="true"]{background:#eef2ff;border-color:#c7d2fe}.art-mrail .text-ai-chips>button{min-height:0;margin:0;padding:4px 10px;font-size:12px}' +   // V102.341: only the picked vendor's models show (the shared rail marks the rest [hidden]); one line
            '.art-ft .ai{color:#b45309;font-weight:700}' +
            '.art-sh .cv{font-size:20px;line-height:1}.art-sh .x2{width:22px;height:22px;border-radius:50%;background:#f1f5f9;display:grid;place-items:center;font-size:10px;color:#64748b}.art-sh .gb{width:30px;height:30px;border-radius:9px;background:#f1f5f9;display:grid;place-items:center;font-size:12px}.art-sh .rm{margin-left:auto;font-size:10.5px;color:#4361ee;font-weight:700;border:none;background:none;padding:2px 0;font-family:inherit;cursor:pointer}.art-sh.more{overflow:auto}.art-sh.more .b{max-height:none;-webkit-mask-image:none;mask-image:none}.art-sh .ok2{height:30px;padding:0 12px;border-radius:999px;background:#16a34a;color:#fff;font-weight:800;font-size:11.5px;display:grid;place-items:center}' +
            '.art-pv{display:flex;flex-direction:column;gap:8px;position:sticky;top:0}.art-pvh{display:flex;align-items:center;gap:6px;font-weight:800;font-size:12.5px;color:#475569}' +
            '.art-phone{width:270px;height:500px;border-radius:30px;border:7px solid #1e293b;background:#eef1f6;position:relative;overflow:hidden;align-self:center}.art-phone .home{padding:14px 10px;opacity:.55;filter:blur(1px)}.art-phone .home div{height:42px;border-radius:12px;background:#fff;margin-bottom:9px}.art-phone .home div:first-child{height:76px}' +
            '.art-sh{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;padding:8px 13px 12px;box-shadow:0 -8px 20px rgba(15,23,42,.15);max-height:84%;overflow:hidden}.art-sh .g{width:32px;height:4px;border-radius:9px;background:#e2e8f0;margin:0 auto 8px}' +
            '.art-sh .k{font-size:10px;font-weight:700;color:#4361ee}.art-sh .tt{font-size:14px;font-weight:800;line-height:1.3;margin:5px 0;color:#1e293b;word-break:keep-all;overflow-wrap:anywhere}.art-sh .b{font-size:11.5px;line-height:1.5;color:#334155;max-height:6em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 65%,transparent);mask-image:linear-gradient(#000 65%,transparent);word-break:keep-all;overflow-wrap:anywhere}' +
            '.art-sh .b p,.art-sh .b ul,.art-sh .b ol{margin:0 0 4px}.art-sh .m{font-size:11px;color:#4361ee;font-weight:700;margin:5px 0 7px}.art-sh .ok{height:34px;border-radius:11px;background:#4361ee;color:#fff;font-weight:800;font-size:12.5px;display:grid;place-items:center;flex:1}' +
            '.art-sh .bm{width:34px;height:34px;border-radius:11px;border:1px solid #e2e8f0;display:grid;place-items:center}.art-sh .lks{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}.art-sh .lks span{font-size:10px;padding:3px 7px;border-radius:999px;background:#eef2ff;color:#3730a3;font-weight:600}';
        document.head.appendChild(s);
    }
    function shell() {
        var m = document.getElementById('articlesModal');
        if (m) return m;
        m = document.createElement('div'); m.id = 'articlesModal'; m.className = 'modal lang-no-toggle';   // V102.336: Thai / Korean text must never be hidden by the EN-mode language switch here
        m.innerHTML = '<div class="modal-content"><span class="close-modal" onclick="Articles.close()">&times;</span><div id="art-body"></div></div>';
        document.body.appendChild(m);
        return m;
    }
    function shortDate(ms) { return ms == null ? '' : new Date(ms + BKK).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
    function title(a) { var t = a.title || {}; return t.en || t.th || t.ko || 'Untitled'; }
    function stLabel(a, now) {
        var st = status(a, now);
        return { live: 'Live · ' + shortDate(a.startAt) + '–' + shortDate(a.endAt), scheduled: 'Scheduled · ' + shortDate(a.startAt), draft: 'Draft', ended: 'Ended · ' + shortDate(a.endAt) }[st];
    }
    function rowHtml(a, now) {
        var st = status(a, now), have = langsOf(a), aud = (a.audience.divisions || []).concat(a.audience.groups || []);
        return '<button type="button" class="art-row st-' + st + (S.cur && S.cur.id === a.id ? ' sel' : '') + (st === 'ended' ? ' ended' : '') + '" onclick="Articles.edit(\'' + esc(a.id) + '\')">' +
            '<span class="art-tile">' + esc(a.cover.emoji) + '</span><span style="min-width:0"><span class="art-t">' + esc(title(a)) + '</span><span class="art-meta"><span class="art-st ' + st + '">' + esc(stLabel(a, now)) + '</span>' +
            LANGS.map(function (l) { return '<span class="art-lg' + (have.indexOf(l[0]) < 0 ? ' off' : '') + '">' + l[1] + '</span>'; }).join('') +
            (aud.length ? '<span title="Audience">' + esc(aud.join(' · ')) + '</span>' : '') + (a.rerun === 'off' ? '' : '<span class="art-rr" title="Also sent to interns who join later">🔁</span>') + '</span></span></button>';
    }
    // V102.371: the 🩺 chip says where the article stands in the Disease Codex
    function dxChipHtml(a) {
        var dx = a.dx || {};
        if (S.dxBusy) return chip('⏳ Drafting Codex entry…', false, '', ' disabled', ' art-add');
        if (dx.publishedId) return chip('🩺 In Disease Codex', true, 'Articles.toCodex()', ' title="Published in the Disease Codex — open it"', ' art-add');
        if (dx.draftId) return chip('🩺 Codex draft pending', false, 'Articles.toCodex()', ' title="Waiting in the Disease Codex ▸ Pending Drafts — open it"', ' art-add');
        return chip('🩺 Disease Codex', false, 'Articles.toCodex()', ' title="Draft a Disease Codex entry from this article with AI → Pending Drafts (save the article first)"', ' art-add');
    }
    // V102.374: the 💊 chip — the Drug Codex twin of dxChipHtml
    function dcChipHtml(a) {
        var dc = a.dc || {};
        if (S.dcBusy) return chip('⏳ Drafting Drug Codex entry…', false, '', ' disabled', ' art-add');
        if (dc.publishedId) return chip('💊 In Drug Codex', true, 'Articles.toDrug()', ' title="Published in the Drug Codex — open it"', ' art-add');
        if (dc.draftId) return chip('💊 Drug draft pending', false, 'Articles.toDrug()', ' title="Waiting in the Drug Codex ▸ Pending Drafts — open it"', ' art-add');
        return chip('💊 Drug Codex', false, 'Articles.toDrug()', ' title="Draft a Drug Codex entry from this article with AI → Pending Drafts (save the article first)"', ' art-add');
    }
    function chip(label, on, click, extra, cls) { return '<button type="button" class="art-c' + (cls || '') + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" onclick="' + click + '"' + (extra || '') + '>' + label + '</button>'; }
    function audienceHtml(a) {
        var dv = divisions(), gs = groups(a.audience.groups), all = !a.audience.divisions.length && !a.audience.groups.length;
        var gchip = function (name, kind) {
            var on = a.audience[kind].indexOf(name) >= 0, attrs = 'onclick="Articles.aud(\'' + kind + '\',' + esc(JSON.stringify(name)) + ')"';
            if (typeof groupChipHtml === 'function') {
                try {
                    var o = { on: on, attrs: attrs };
                    if (kind === 'divisions') {
                        if (typeof divColor === 'function') o.color = divColor(name);
                        if (typeof divChipLook === 'function') Object.assign(o, divChipLook(name));
                        var us = (typeof usersData !== 'undefined' && usersData) || [];
                        o.active = us.filter(function (u) { return !u.isIgnored && typeof userInDivision === 'function' && userInDivision(u, name); }).length; o.total = o.active;
                    }
                    return groupChipHtml(name, o);
                } catch (e) { /* fall back to a plain chip */ }
            }
            return chip(esc(name), on, 'Articles.aud(\'' + kind + '\',' + esc(JSON.stringify(name)) + ')');
        };
        return chip('Everyone', all, 'Articles.audAll()') + dv.map(function (d) { return gchip(d, 'divisions'); }).join('') + (dv.length && gs.length ? '<span style="color:#cbd5e1">|</span>' : '') + gs.map(function (g) { return gchip(g, 'groups'); }).join('');
    }
    function pickerHtml() {
        if (!S.pick) return '';
        var q = S.q.trim().toLowerCase(), have = (S.cur.links || []).map(function (l) { return l.kind + ':' + l.id; });
        var src = linkSrc(S.pick);
        var opts = src.filter(function (o) { return have.indexOf(o.kind + ':' + o.id) < 0 && (!q || o.label.toLowerCase().indexOf(q) >= 0); }).slice(0, 40);
        var empty = S.pick === 'codex' && S.codex && !S.codex.length && !codex().length ? 'Loading DD Codex…' : S.pick === 'disease' && S.dz && !S.dz.length && !diseases().length ? 'Loading Disease Codex…' : 'Nothing matches.';
        return '<div class="art-pk"><input type="search" id="art-pk-q" placeholder="' + (S.pick === 'quiz' ? '🧪 Find a quiz…' : S.pick === 'disease' ? '🩺 Find a disease…' : '💊 Find a drug…') + '" value="' + esc(S.q) + '" oninput="Articles.pickQ(this.value)">' +
            '<div class="opts">' + (opts.length ? opts.map(function (o) { return '<button type="button" onclick="Articles.addLink(\'' + o.kind + '\',' + esc(JSON.stringify(o.id)) + ')">' + (LINK_ICON[o.kind] || '') + esc(o.label) + '</button>'; }).join('') : '<span style="color:#94a3b8;font-size:12.5px;padding:4px 8px">' + empty + '</span>') + '</div></div>';
    }
    function dateLong(ms) { return ms == null ? '' : new Date(ms + BKK).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
    function statusLine(a, now) {
        var st = status(a, now), dirty = JSON.stringify(a) !== S.base;
        var msg = { draft: 'Not live yet · 📅 Schedule when ready', scheduled: 'Goes live ' + dateLong(a.startAt), live: 'Showing now · ends ' + dateLong(a.endAt), ended: 'Ended ' + dateLong(a.endAt) + (a.rerun === 'off' ? '' : ' · 🔁 still reaches new interns') }[st];
        var mins = S.savedAt ? Math.max(0, Math.round((now - S.savedAt) / 60000)) : -1;
        var save = dirty ? '<span class="art-save dirty">● Unsaved</span>' : mins >= 0 ? '<span class="art-save">Saved' + (mins ? ' · ' + mins + ' min ago' : '') + '</span>' : '';
        return '<div class="art-stl" id="art-stl"><span class="art-st ' + st + '">' + { draft: 'Draft', scheduled: 'Scheduled', live: 'Live', ended: 'Ended' }[st] + '</span><span>' + msg + '</span>' + save + '</div>';
    }
    function whenWhoSummary(a) {
        var aud = a.audience.divisions.concat(a.audience.groups);
        return '📅 ' + dateLong(a.startAt) + ' – ' + dateLong(a.endAt) + ' · ' + (a.rerun === 'off' ? '🔁 off' : '🔁 new interns') + ' · 👥 ' + (aud.length ? esc(aud.join(', ')) : 'Everyone') + ' <span style="color:#94a3b8">~' + reach(a) + '</span>';
    }
    function linksSummary(a) {
        var q = (a.links || []).filter(function (l) { return l.kind === 'quiz'; }).length, c = (a.links || []).length - q;
        return (q || c) ? (q ? '🧪 ' + q : '') + (q && c ? ' · ' : '') + (c ? '💊 ' + c : '') : '<span style="color:#94a3b8">＋ quiz or drug</span>';
    }
    function sec(key, label, summary, inner, openByDefault) {
        var open = S.open[key] != null ? S.open[key] : openByDefault;
        return '<details class="art-sec"' + (open ? ' open' : '') + ' ontoggle="Articles.sec(\'' + key + '\', this.open)"><summary><b>' + label + '</b><span>' + summary + '</span><span class="chev">▾</span></summary><div class="in">' + inner + '</div></details>';
    }
    // ---- ✨ AI draft
    function modelId() {
        if (S.model) return S.model;
        var m = ''; try { m = localStorage.getItem('articleDraftModel') || ''; } catch (e) { /* none */ }
        var sel = document.getElementById('ai-model-selector');
        if (!m && sel) m = sel.value;
        return (m && window.textAIModelInfo && window.textAIModelInfo(m)) ? m : 'gpt-6-luna';
    }
    function modelName(id) { var i = window.textAIModelInfo ? window.textAIModelInfo(id) : null; return (i && (i.short || i.label)) || id; }
    function modelRail() { try { return window.providerModelRailHtml('art-model-pick', modelId(), 'Articles.model(this.dataset.value)'); } catch (e) { return ''; } }
    function aiMode(a) { var L = S.lang; return L !== 'en' && String((a.body || {}).en || '').trim() && !String((a.body || {})[L] || '').trim() ? 'translate' : 'draft'; }
    var NAMES = { en: 'English', th: 'Thai', ko: 'Korean' };
    function trPrompt(a, L) {
        return 'Translate this short article for pharmacy interns into ' + NAMES[L] + '. Keep the markdown, emoji, line breaks and drug names (keep drug names in English). Reply with the translated title on the first line, then a line with only ---, then the translated article. Nothing else.\n\n' + String(a.title.en || '').trim() + '\n---\n' + String(a.body.en || '').trim();
    }
    function trParse(txt) { var m = txt.match(/^([^\n]*)\n\s*-{3,}\s*\n([\s\S]*)$/); return m ? { title: m[1].replace(/^#+\s*/, '').trim(), body: m[2].trim() } : { title: '', body: txt }; }
    function aiText(resp) { return String(resp && typeof resp === 'object' ? (resp.text || resp.outputText || resp.response || '') : (resp || '')).replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim(); }
    // every (article, language) still missing: EN present, TH / KO empty — only saved articles (an unsaved ＋ New has no id)
    function trJobs() {
        var jobs = [];
        S.list.forEach(function (a) {
            if (!a.id || !String((a.body || {}).en || '').trim()) return;
            ['th', 'ko'].forEach(function (L) { if (!String((a.body || {})[L] || '').trim()) jobs.push({ a: a, L: L }); });
        });
        return jobs;
    }
    // V102.375 (owner's pick 3): the bare topic of an article (the title before ":" / "–" / "(", emoji stripped) — the Codex entry name
    function codexNameOf(a) { return String((a.title || {}).en || (a.title || {}).th || (a.title || {}).ko || '').replace(/[\p{Extended_Pictographic}️]/gu, '').split(/[:–—(]/)[0].trim(); }
    // the articles 🩺 Draft all would send: saved, titled, in neither Codex (no dx / dc draft or entry) and linked to neither (no 🩺 / 💊 link)
    function daJobs() {
        return (S.list || []).filter(function (a) {
            if (!a.id || !codexNameOf(a)) return false;
            if (a.dx && (a.dx.draftId || a.dx.publishedId)) return false;
            if (a.dc && (a.dc.draftId || a.dc.publishedId)) return false;
            return !(a.links || []).some(function (l) { return l.kind === 'disease' || l.kind === 'codex'; });
        });
    }
    function daAllHtml() {
        var n = daJobs().length;
        if (DA.busy) return '<button type="button" class="art-tr-all art-da-all busy" onclick="Articles.draftAll()" title="Drafting — press to stop after the current one">🩺 ' + esc(DA.prog) + ' · stop</button>';
        if (!S.list.length) return '';
        return '<button type="button" class="art-tr-all art-da-all" onclick="Articles.draftAll()"' + (n ? '' : ' disabled') + ' title="' + (n ? 'Draft a Disease Codex entry from each of the ' + n + ' article(s) in neither Codex (AI, one at a time) → Pending Drafts' : 'Every article is already in a Codex or linked to one') + '">🩺 Draft all' + (n ? ' <b>' + n + '</b>' : '') + '</button>';
    }
    function trAllHtml() {
        var n = trJobs().length;
        if (TR.busy) return '<button type="button" class="art-tr-all busy" onclick="Articles.translateAll()" title="Translating — press to stop after the current one">🌐 ' + esc(TR.prog) + ' · stop</button>';
        if (!S.list.length) return '';
        return '<button type="button" class="art-tr-all" onclick="Articles.translateAll()"' + (n ? '' : ' disabled') + ' title="' + (n ? 'Translate the ' + n + ' missing TH / KO version(s) from EN with ' + esc(modelName(modelId())) + ' and save them — one at a time' : 'Every article already has EN, TH and KO') + '">🌐 Translate all' + (n ? ' <b>' + n + '</b>' : '') + '</button>';
    }
    function aiHtml(a) {
        var tr = aiMode(a) === 'translate';
        return '<span class="art-ai"><button type="button" class="go" onclick="Articles.ai()"' + (S.aiBusy ? ' disabled' : '') + ' title="' + (tr ? 'Translate the EN version into ' + S.lang.toUpperCase() + ' (fills the editor — check, then save)' : 'Draft the body from the title in ' + S.lang.toUpperCase() + ' (fills the editor — check, then save)') + '">' + (S.aiBusy ? '✨ …' : tr ? '✨ From EN' : '✨ Draft') + '</button>' +
            '<button type="button" class="mdl" onclick="Articles.modelPick()" title="AI model — tap to change">' + esc(modelName(modelId())) + ' ' + (S.modelOpen ? '▴' : '▾') + '</button></span>';
    }
    function editorHtml(now) {
        var a = S.cur, L = S.lang, t = (a.title || {})[L] || '', b = (a.body || {})[L] || '', have = langsOf(a), st = status(a, now), mm = mismatch(a, L);
        var NAME = { en: 'English', th: 'Thai', ko: 'Korean' };
        var lines = [
            statusLine(a, now),
            '<div class="art-ln">' + LANGS.map(function (l) { var ok = have.indexOf(l[0]) >= 0; return chip('<i class="d' + (ok ? ' ok' : '') + '"></i>' + l[1] + (!ok && l[0] !== 'en' ? ' <span class="art-fb">→ EN</span>' : ''), L === l[0], 'Articles.lang(\'' + l[0] + '\')', ' title="' + (l[0] === 'en' ? 'Required to schedule' : ok ? NAME[l[0]] + ' version' : 'Empty — interns see EN') + '"'); }).join('') +
                '<span style="margin-left:auto;display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">' + (S.coverOpen ? COVERS.map(function (e) { return '<button type="button" class="art-emo' + (a.cover.emoji === e ? ' on' : '') + '" onclick="Articles.cover(\'' + e + '\')" aria-label="Cover ' + e + '" title="Cover">' + e + '</button>'; }).join('')
                    : '<button type="button" class="art-emo on" onclick="Articles.coverPick()" aria-label="Change the cover" title="Cover · tap to change">' + esc(a.cover.emoji) + '</button>') + '</span></div>',
            '<input class="art-in" id="art-title" maxlength="' + MAX_TITLE + '" placeholder="Title (' + L.toUpperCase() + ')" value="' + esc(t) + '" oninput="Articles.text(\'title\',this.value)">',
            '<div class="art-md"><div class="art-tb"><button type="button" title="Bold" onclick="Articles.wrap(\'**\',\'**\')">B</button><button type="button" title="Italic" onclick="Articles.wrap(\'*\',\'*\')"><i>I</i></button>' +
            '<button type="button" title="Bullet list" onclick="Articles.wrap(\'\\n- \',\'\')">•</button><button type="button" title="Numbered list" onclick="Articles.wrap(\'\\n1. \',\'\')">1.</button><button type="button" title="Link" onclick="Articles.wrap(\'[\',\'](https://)\')">🔗</button>' + aiHtml(a) + '</div>' + (S.modelOpen ? '<div class="art-mrail">' + modelRail() + '</div>' : '') +
            '<textarea class="art-ta" id="art-bodyta" placeholder="A short read: 3–5 lines. Markdown works." oninput="Articles.text(\'body\',this.value)">' + esc(b) + '</textarea>' +
            '<div class="art-ft">' + (S.aiNote ? '<span class="ai">' + esc(S.aiNote) + '</span>' : '<span>Markdown</span>') + '<span id="art-count" style="margin-left:auto"' + (b.length > MAX_BODY ? ' class="over"' : '') + '>' + b.length + ' / ' + MAX_BODY + ' · ~' + readMin(b) + ' min</span></div></div>',
            '<div id="art-warn">' + hintHtml() + (mm ? '<div class="art-warn" role="status">⚠️ This looks like ' + NAME[mm] + ', not ' + NAME[L] + (((a.title || {})[mm] || (a.body || {})[mm]) ? '' : '<button type="button" onclick="Articles.moveLang(\'' + L + '\',\'' + mm + '\')">Move to ' + mm.toUpperCase() + '</button>') + '</div>' : '') + '</div>',
            sec('when', 'When & who', whenWhoSummary(a),
                '<div class="art-ln"><span class="art-ml">Window</span><input type="datetime-local" class="art-dt" id="art-start" value="' + (a.startAt != null ? toLocal(a.startAt) : '') + '" onchange="Articles.when(\'startAt\',this.value)"> → <input type="datetime-local" class="art-dt" id="art-end" value="' + (a.endAt != null ? toLocal(a.endAt) : '') + '" onchange="Articles.when(\'endAt\',this.value)"><span style="font-size:11.5px;color:#94a3b8">Bangkok time</span></div>' +
                '<div class="art-ln"><span class="art-ml">🔁 Later</span>' + RERUN.map(function (r) { return chip(r[1], a.rerun === r[0], 'Articles.rerun(\'' + r[0] + '\')', ' title="' + esc(r[2]) + '"'); }).join('') + '</div>' +
                '<div class="art-ln"><span class="art-ml">Audience</span>' + audienceHtml(a) + '</div>', !a.id),
            sec('links', 'Links', linksSummary(a),
                '<div class="art-ln">' + (a.links || []).map(function (l, i) { return '<span class="art-lk ' + l.kind + '">' + (LINK_ICON[l.kind] || '💊 ') + esc(l.label) + '<button type="button" aria-label="Remove link" onclick="Articles.dropLink(' + i + ')">✕</button></span>'; }).join('') +
                chip('＋ Quiz', S.pick === 'quiz', 'Articles.openPick(\'quiz\')', '', ' art-add') + chip('＋ Codex', S.pick === 'codex', 'Articles.openPick(\'codex\')', '', ' art-add') + chip('＋ Disease', S.pick === 'disease', 'Articles.openPick(\'disease\')', ' title="Link a published Disease Codex entry"', ' art-add') + dxChipHtml(a) + dcChipHtml(a) + '</div>' + pickerHtml(), (a.links || []).length > 0 || !!S.pick),
            S.err ? '<div class="art-err" role="alert">⚠️ ' + esc(S.err) + '</div>' : '',
            '<div class="art-btns"><button type="button" class="del' + (S.del ? ' arm' : '') + '" onclick="Articles.remove()" title="' + (a.id ? 'Delete (tap twice)' : 'Discard') + '" aria-label="Delete">' + (S.del ? 'Delete?' : '🗑') + '</button>' +
            (a.status === 'scheduled' ? '<button type="button" onclick="Articles.save(false)"' + (S.saving ? ' disabled' : '') + '>↩ Back to draft</button>' : '<button type="button" onclick="Articles.save(false)"' + (S.saving ? ' disabled' : '') + '>Save draft</button>') +
            '<button type="button" class="p" onclick="Articles.save(true)"' + (S.saving ? ' disabled' : '') + '>' + (S.saving ? 'Saving…' : a.status === 'scheduled' ? '💾 Save' : '📅 Schedule') + '</button></div>'
        ];
        return '<div class="art-ed" data-status="' + st + '">' + lines.join('') + '</div>';
    }
    function previewHtml() {
        var a = S.cur, L = S.lang, t = (a.title || {})[L] || (a.title || {}).en || '', b = (a.body || {})[L] || (a.body || {}).en || '';
        var md = typeof window.renderMd === 'function' ? window.renderMd(b) : esc(b);
        var st = status(a, Date.now());
        return '<div class="art-pv"><div class="art-pvh">📱 Preview <span style="font-weight:600;color:#94a3b8">' + L.toUpperCase() + ((a.title || {})[L] ? '' : ' → EN') + '</span></div>' +
            '<div class="art-pvb"><span class="art-st ' + st + '">' + { draft: 'Draft', scheduled: 'Scheduled', live: 'Live', ended: 'Ended' }[st] + '</span>' + (st === 'draft' ? 'Interns do not see drafts' : 'Interns see it ' + dateLong(a.startAt) + ' – ' + dateLong(a.endAt)) + '</div>' +
            '<div class="art-phone"><div class="home"><div></div><div></div><div></div><div></div></div><div class="art-sh' + (S.pvMore ? ' more' : '') + '" id="art-sheet">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><span class="cv" title="Article · ' + readMin(b) + ' min">' + esc(a.cover.emoji) + '</span><span class="x2" style="margin-left:auto">✕</span></div>' +
            '<div class="tt">' + esc(t || 'Title') + '</div><div class="b">' + (md || '<span style="color:#94a3b8">The body shows here.</span>') + '</div>' +
            ((a.links || []).length ? '<div class="lks">' + a.links.map(function (l) { return '<span>' + (l.kind === 'quiz' ? '🧪 ' : '💊 ') + esc(l.label) + (l.kind === 'quiz' ? ' · 🪙 +1' : '') + '</span>'; }).join('') + '</div>' : '') +
            '<div style="display:flex;gap:5px;align-items:center;margin-top:6px"><span class="gb">🔖</span><span class="gb">🔕</span><button type="button" class="rm" id="art-pv-more" onclick="Articles.pvMore()" aria-expanded="' + !!S.pvMore + '">' + (S.pvMore ? 'Show less ▴' : 'Read more ▾') + '</button><span class="ok2">👍 Got it</span></div></div></div>' + statsHtml(a) + '</div>';
    }
    // 👥 read counts under the preview (published articles only)
    function statsHtml(a) {
        var now = Date.now(), st = status(a, now);
        if (!a.id || st === 'draft' || st === 'scheduled') return '';
        var c = stats(a, now), pct = c.n ? Math.round(c.read * 100 / c.n) : 0;
        return '<div class="art-stats" id="art-stats"><div class="hd"><span>Read</span><span>' + c.read + ' / ' + c.n + ' · ' + pct + '%</span></div><div class="bar"><i style="width:' + pct + '%"></i></div>' +
            '<div class="n"><span title="Read">✓ ' + c.read + '</span><span title="Closed without reading">👁 ' + c.closed + '</span><span title="Not seen yet">⏳ ' + c.wait + '</span>' +
            (c.saved ? '<span title="Saved 🔖">🔖 ' + c.saved + '</span>' : '') + (c.quiz ? '<span title="Opened the quiz">🧪 ' + c.quiz + '</span>' : '') + (c.rerun ? '<span title="New interns (re-run)">🔁 ' + c.rerun + '</span>' : '') + '</div>' +
            '<button type="button" class="who" onclick="Articles.who(true)">👥 Who read it ›</button></div>';
    }
    var ACT = { ok: 'Got it', quiz: '🧪 opened the quiz', codex: '💊 opened Codex', hist: 'read in History', x: 'closed ✕ without reading' };
    function whenStr(ms) { return ms == null ? '' : new Date(ms + BKK).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }); }
    function whoRows(a) {
        var rank = { read: 0, closed: 1, wait: 2 };
        return readers(a, Date.now()).filter(function (x) { return S.whoF === 'all' || (S.whoF === 'rerun' ? x.kind === 'rerun' : x.st === S.whoF); })
            .sort(function (x, y) { return rank[x.st] - rank[y.st] || ((msOf(y.s && y.s.at) || 0) - (msOf(x.s && x.s.at) || 0)) || String(x.u.displayName || '').localeCompare(String(y.u.displayName || '')); });
    }
    function whoHtml(a) {
        var c = stats(a, Date.now()), rows = whoRows(a);
        var F = [['all', 'All', c.n], ['read', '✓', c.read], ['closed', '👁', c.closed], ['wait', '⏳', c.wait]].concat(c.rerun ? [['rerun', '🔁', c.rerun]] : []);
        var name = function (u) { return u.displayName || u.fullName || u.id; };
        return '<div class="art-whop" id="art-who"><div class="h"><b>👥 Who read it</b><span class="sub">' + esc(title(a)) + '</span><button type="button" class="art-x" onclick="Articles.who(false)" aria-label="Back to the editor" title="Back">✕</button></div>' +
            '<div class="art-rail" role="group" aria-label="Filter readers" style="margin-bottom:8px">' + F.map(function (f) { return '<button type="button" class="' + (S.whoF === f[0] ? 'on' : '') + '" aria-pressed="' + (S.whoF === f[0]) + '" data-who="' + f[0] + '" onclick="Articles.whoF(\'' + f[0] + '\')">' + f[1] + '<b>' + f[2] + '</b></button>'; }).join('') + '</div>' +
            '<div class="art-wl">' + (rows.length ? rows.map(function (x) {
                var u = x.u, pic = u.pictureUrl && /^https:\/\//.test(u.pictureUrl) ? '<img src="' + esc(u.pictureUrl) + '" alt="" referrerpolicy="no-referrer">' : esc(String(name(u)).charAt(0).toUpperCase());
                var div = typeof userDivisionOf === 'function' ? userDivisionOf(u) : u.division;
                var how = x.s && x.s.act ? ACT[x.s.act] || x.s.act : x.s ? 'popup waiting' : 'not opened the app since it went live';
                return '<div class="art-wr" data-st="' + x.st + '"' + (typeof openUserHub === 'function' ? ' style="cursor:pointer" onclick="Articles.close();openUserHub(\'' + esc(u.id) + '\')"' : '') + '><span class="av">' + pic + '</span>' +
                    '<span class="nm"><b>' + esc(name(u)) + '</b>' + (div ? ' <span style="font-size:11px;color:#64748b">· ' + esc(div) + '</span>' : '') + '<small>' + (x.kind === 'rerun' ? '🔁 ' : '') + esc(how) + (x.s && x.s.saved ? ' · 🔖' : '') + '</small></span>' +
                    '<span class="pill ' + x.st + '">' + { read: '✓ Read', closed: '👁 Closed', wait: '⏳ Not yet' }[x.st] + '</span><span class="tm">' + (x.s && x.s.at ? whenStr(msOf(x.s.at)) : '') + '</span></div>';
            }).join('') : '<div class="art-empty">Nobody here.</div>') + '</div>' +
            '<div class="art-btns" style="position:static;margin:8px 0 0;padding:8px 0 0"><button type="button" onclick="Articles.csv()">⬇ CSV</button></div></div>';
    }
    function render() {
        var host = document.getElementById('art-body'); if (!host) return;
        var now = Date.now(), counts = { all: S.list.length };
        S.list.forEach(function (a) { var st = status(a, now); counts[st] = (counts[st] || 0) + 1; });
        var list = sorted(now);
        var head = '<div class="art-h"><h2>📰 Articles</h2><div class="art-rail" role="group" aria-label="Filter by status">' + FILTERS.map(function (f) {
            return '<button type="button" class="' + (S.filter === f[0] ? 'on' : '') + '" aria-pressed="' + (S.filter === f[0]) + '" data-filter="' + f[0] + '" onclick="Articles.filter(\'' + f[0] + '\')">' + f[1] + '<b>' + (counts[f[0]] || 0) + '</b></button>';
        }).join('') + '</div>' + trAllHtml() + daAllHtml() + '<button type="button" class="art-new" onclick="Articles.edit(null)">＋ New</button></div>';
        var left = '<div class="art-list">' + (S.loading && !S.loaded ? '<div class="art-empty">Loading…</div>' : list.length ? list.map(function (a) { return rowHtml(a, now); }).join('') : '<div class="art-empty">' + (S.list.length ? 'Nothing here.' : 'No articles yet — ＋ New') + '</div>') + '</div>';
        var mid = S.cur ? editorHtml(now) : '<div class="art-empty">' + (S.err && !S.loaded ? '⚠️ ' + esc(S.err) : 'Pick an article, or ＋ New.') + '</div>';
        host.innerHTML = head + '<div class="art-g">' + left + (S.cur && S.who ? whoHtml(S.cur) : mid + (S.cur ? previewHtml() : '<div class="art-pv"></div>')) + '</div>';
        fitPv();
    }
    // V102.346: like the intern sheet, a body that fits needs no Read more
    function fitPv() {
        var b = document.querySelector('#art-sheet .b'), m = document.getElementById('art-pv-more');
        if (b && m && !S.pvMore) m.style.visibility = b.scrollHeight <= b.clientHeight + 2 ? 'hidden' : '';
    }
    function pvMore() { S.pvMore = !S.pvMore; var pv = document.querySelector('#art-body .art-pv'); if (pv) pv.outerHTML = previewHtml(); fitPv(); }
    // typing repaints only the preview + counter, so the caret stays where it is
    function paintLive() {
        var a = S.cur; if (!a) return;
        var b = (a.body || {})[S.lang] || '', c = document.getElementById('art-count');
        if (c) { c.textContent = b.length + ' / ' + MAX_BODY + ' · ~' + readMin(b) + ' min'; c.className = b.length > MAX_BODY ? 'over' : ''; }
        var pv = document.querySelector('#art-body .art-pv'); if (pv) pv.outerHTML = previewHtml();
        fitPv();
        var sl = document.getElementById('art-stl'); if (sl) sl.outerHTML = statusLine(a, Date.now());
        var w = document.getElementById('art-warn'); if (w) { var mm = mismatch(a, S.lang), NAME = { en: 'English', th: 'Thai', ko: 'Korean' }; w.innerHTML = mm ? '<div class="art-warn" role="status">⚠️ This looks like ' + NAME[mm] + ', not ' + NAME[S.lang] + (((a.title || {})[mm] || (a.body || {})[mm]) ? '' : '<button type="button" onclick="Articles.moveLang(\'' + S.lang + '\',\'' + mm + '\')">Move to ' + mm.toUpperCase() + '</button>') + '</div>' : ''; }
        var dots = document.querySelectorAll('#art-body .art-ed > .art-ln:nth-child(2) i.d'), have = langsOf(a);
        LANGS.forEach(function (l, i) { if (dots[i]) dots[i].className = 'd' + (have.indexOf(l[0]) >= 0 ? ' ok' : ''); });
    }

    // ---- actions
    function open() {
        css(); shell().style.display = 'block';
        render();
        if (!S.loaded) load();
    }
    function close() { var m = document.getElementById('articlesModal'); if (m) m.style.display = 'none'; S.pick = ''; S.del = false; }
    function edit(id) {
        var a = id ? S.list.find(function (x) { return x.id === id; }) : null;
        S.cur = a ? fromDoc(a.id, Object.assign({}, a)) : blank(Date.now());
        S.lang = 'en'; S.err = ''; S.del = false; S.pick = ''; S.base = JSON.stringify(S.cur); S.savedAt = 0; S.hint = null; S.hintOff = S.hintOff || {}; S.open = {}; S.who = false; S.whoF = 'all'; S.aiNote = ''; S.modelOpen = false; S.pvMore = false;
        render();
    }
    var api = {
        open: open, close: close, edit: edit, pvMore: pvMore, load: load, save: save, remove: remove, openPick: openPick, userChip: userChip,
        // after admin sign-in: load the list quietly so the User Hub 📰 chips have data, then repaint the Users table once if it is open
        boot: function () {
            css();
            if (S.loaded || S.loading) return Promise.resolve();
            return load().then(function () {
                var t = document.getElementById('tab-users');
                if (t && t.classList.contains('active') && typeof renderTable === 'function') { try { renderTable('users'); } catch (e) { /* the table repaints on its own next time */ } }
            });
        },
        filter: function (f) { S.filter = f; render(); },
        who: function (on) { S.who = !!on; render(); },
        whoF: function (f) { S.whoF = f; render(); },
        csv: function () {
            var a = S.cur; if (!a) return;
            var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
            var lines = [['name', 'division', 'group', 'state', 'how', 'when (Bangkok)', 'saved', 'new intern (re-run)'].join(',')].concat(whoRows(Object.assign({}, a)).map(function (x) {
                return [x.u.displayName || x.u.fullName || x.u.id, typeof userDivisionOf === 'function' ? userDivisionOf(x.u) : x.u.division, x.u.group || '', x.st, x.s && x.s.act ? x.s.act : '', x.s && x.s.at ? whenStr(msOf(x.s.at)) : '', x.s && x.s.saved ? 'yes' : '', x.kind === 'rerun' ? 'yes' : ''].map(q).join(',');
            }));
            var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), el = document.createElement('a');
            el.href = url; el.download = 'article-readers-' + (a.id || 'new') + '.csv'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        },
        modelPick: function () { S.modelOpen = !S.modelOpen; render(); },
        model: function (id) { S.model = id; S.modelOpen = false; try { localStorage.setItem('articleDraftModel', id); } catch (e) { /* none */ } render(); },
        // ✨ fills the editor only — the admin reads it and saves; never published by the AI
        ai: function () {
            var a = S.cur; if (!a || S.aiBusy) return Promise.resolve();
            var L = S.lang, NAME = { en: 'English', th: 'Thai', ko: 'Korean' }, tr = aiMode(a) === 'translate', model = modelId();
            var topic = String(a.title[L] || a.title.en || '').trim(), notes = String(a.body[L] || '').trim();
            if (!tr && !topic) { S.err = '✨ needs a title (a few words are enough) to draft from.'; render(); return Promise.resolve(); }
            var prompt = tr
                ? 'Translate this short article for pharmacy interns into ' + NAME[L] + '. Keep the markdown, emoji, line breaks and drug names (keep drug names in English). Reply with the translated title on the first line, then a line with only ---, then the translated article. Nothing else.\n\n' + String(a.title.en || '').trim() + '\n---\n' + String(a.body.en || '').trim()
                // V102.363 (owner): emoji carry the meaning so the words stay few; a closing 💊 line names the drugs to read up on
                : 'Write a short article for pharmacy interns in Thailand, in ' + NAME[L] + ', to show as a popup when they open the app (under 700 characters). Topic: ' + topic + '. ' + (notes ? 'Build on these notes: ' + notes + '. ' : '') + '3 to 5 short lines, each starting with one fitting emoji instead of a label (for example 💡 the practical point, 🏪 a pharmacy-counter example, ⚠️ a red flag, ✅ the takeaway) — the emoji says what the line is, so keep the words few. End with one line starting with 💊 that lists 2 to 4 related drug names to read up on (generic names in English, comma-separated). Markdown: **bold** on the key words only, no headings, no numbered lists. Reply with the article only.';
            S.aiBusy = true; S.err = ''; S.aiNote = ''; render();
            var t0 = Date.now();
            return Promise.resolve().then(function () {
                if (typeof window.callUniversalAI !== 'function') throw new Error('AI is not available on this page.');
                return window.callUniversalAI(model, prompt, false, null, '', { feature: 'article_draft' });
            }).then(function (resp) {
                var txt = String(resp && typeof resp === 'object' ? (resp.text || resp.outputText || resp.response || '') : (resp || '')).replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim();
                if (!txt) throw new Error('the model sent back nothing.');
                if (tr) {
                    var m = txt.match(/^([^\n]*)\n\s*-{3,}\s*\n([\s\S]*)$/);
                    if (m) { a.title[L] = m[1].replace(/^#+\s*/, '').trim(); a.body[L] = m[2].trim(); } else a.body[L] = txt;
                } else a.body[L] = txt;
                S.aiNote = '✨ ' + modelName(model) + ' · ' + Math.max(1, Math.round((Date.now() - t0) / 1000)) + ' s — read it, then save';
            }).catch(function (e) { S.err = '✨ ' + ((e && e.message) || 'AI draft failed'); }).then(function () { S.aiBusy = false; render(); });
        },
        // 🌐 one click: every missing TH / KO from EN, saved straight into articles/{id} (title.<L> + body.<L>); a second click stops after the current one
        // 🩺 V102.375: Draft all — dxaDraftFromArticle (#1982) for every article in neither Codex, one at a time; press again to stop
        draftAll: function () {
            if (DA.busy) { DA.stop = true; render(); return Promise.resolve(); }
            var jobs = daJobs(); if (!jobs.length) return Promise.resolve();
            if (!confirm('Draft Disease Codex entries from ' + jobs.length + ' article(s) with AI → Pending Drafts?\n\nOne at a time — keep this window open. Press the button again to stop. Articles about a drug or about a disease already in the Codex are skipped automatically.')) return Promise.resolve();
            if (typeof window.dxaDraftFromArticle !== 'function') { S.err = '🩺 The Disease Codex is not available on this page.'; render(); return Promise.resolve(); }
            DA.busy = true; DA.stop = false; var done = 0, skipped = 0, i = 0;
            var step = function () {
                if (i >= jobs.length || DA.stop) return Promise.resolve();
                var a = jobs[i], name = codexNameOf(a), title = a.title.en || a.title.th || a.title.ko || name, body = a.body.en || a.body.th || a.body.ko || '';
                DA.prog = (i + 1) + '/' + jobs.length; render();
                return Promise.resolve().then(function () { return window.dxaDraftFromArticle({ id: a.id, name: name, title: title, source: 'Title: ' + title + '\n' + body }); }).then(function (r) {
                    a.dx = { draftId: r.draftId, publishedId: '', name: name };
                    if (S.cur && S.cur.id === a.id) { S.cur.dx = a.dx; S.base = JSON.stringify(S.cur); }
                    done++;
                }).catch(function () { skipped++; }).then(function () { i++; return step(); });
            };
            return step().then(function () {
                DA.busy = false; DA.stop = false; DA.prog = '';
                var msg = '🩺 Drafted ' + done + '/' + jobs.length + (skipped ? ' (' + skipped + ' skipped)' : '') + (i < jobs.length ? ' — stopped' : '') + (done ? ' — approve them in Disease Codex ▸ Pending Drafts' : '');
                if (typeof showToast === 'function') showToast(msg); else S.err = msg;
                render();
            });
        },
        translateAll: function () {
            if (TR.busy) { TR.stop = true; render(); return Promise.resolve(); }
            var jobs = trJobs(); if (!jobs.length) return Promise.resolve();
            var arts = {}; jobs.forEach(function (j) { arts[j.a.id] = 1; });
            var model = modelId();
            if (!confirm('Translate ' + jobs.length + ' missing version(s) of ' + Object.keys(arts).length + ' article(s) into TH / KO with ' + modelName(model) + ' and save them?\n\nOne at a time — keep this window open. Press the button again to stop.')) return Promise.resolve();
            if (typeof window.callUniversalAI !== 'function') { S.err = '🌐 AI is not available on this page.'; render(); return Promise.resolve(); }
            TR.busy = true; TR.stop = false; var done = 0, failed = 0, i = 0;
            var step = function () {
                if (i >= jobs.length || TR.stop) return Promise.resolve();
                var j = jobs[i], a = j.a, L = j.L; TR.prog = (i + 1) + '/' + jobs.length; render();
                return Promise.resolve().then(function () { return window.callUniversalAI(model, trPrompt(a, L), false, null, '', { feature: 'article_draft' }); }).then(function (resp) {
                    var t = trParse(aiText(resp)); if (!t.body) throw new Error('empty');
                    var doc = {}; doc['title.' + L] = t.title || String(a.title.en || ''); doc['body.' + L] = t.body;
                    doc.updatedAt = firebase.firestore.FieldValue.serverTimestamp(); doc.updatedBy = editorEmail();
                    return db.collection('articles').doc(a.id).update(doc).then(function () {
                        a.title[L] = doc['title.' + L]; a.body[L] = t.body;
                        if (S.cur && S.cur.id === a.id) { S.cur.title[L] = a.title[L]; S.cur.body[L] = t.body; S.base = JSON.stringify(S.cur); }
                        done++;
                    });
                }).catch(function () { failed++; }).then(function () { i++; return step(); });
            };
            return step().then(function () {
                TR.busy = false; TR.stop = false; TR.prog = '';
                var msg = '🌐 Translated ' + done + '/' + jobs.length + (failed ? ' (' + failed + ' failed)' : '') + (i < jobs.length ? ' — stopped' : '');
                if (typeof showToast === 'function') showToast(msg); else S.err = msg;
                render();
            });
        },
        // 🩺 V102.371 (owner: "ทำแบบ 2 + 3"): the saved article becomes a Disease Codex PENDING draft — AI Auto-Draft with the article as the
        // source (window.dxaDraftFromArticle in admin.html) — and the article remembers it in `dx`. Once linked, the chip opens it in the Codex.
        toCodex: function () {
            var a = S.cur; if (!a || S.dxBusy) return;
            if (JSON.stringify(a) !== S.base) { S.err = '🩺 Save the article first, then send it to the Disease Codex.'; render(); return; }
            var dx = a.dx || {};
            if (dx.publishedId || dx.draftId) {
                if (typeof openDiseaseCodexAdmin !== 'function') { S.err = '🩺 The Disease Codex is not available on this page.'; render(); return; }
                api.close(); openDiseaseCodexAdmin();
                setTimeout(function () { if (dx.publishedId && typeof dxaEdit === 'function') dxaEdit(dx.publishedId); else if (typeof dxaSwitchView === 'function') dxaSwitchView('drafts'); }, 150);
                return;
            }
            if (typeof window.dxaDraftFromArticle !== 'function') { S.err = '🩺 The Disease Codex is not available on this page.'; render(); return; }
            var name = String(a.title.en || a.title[S.lang] || '').replace(/[\p{Extended_Pictographic}️]/gu, '').split(/[:–—(]/)[0].trim();
            if (!name) { S.err = '🩺 Give the article a title first.'; render(); return; }
            var title = a.title.en || a.title.th || a.title.ko || name, body = a.body.en || a.body.th || a.body.ko || '';
            S.dxBusy = true; S.err = ''; S.aiNote = '🩺 Drafting a Disease Codex entry from this article…'; render();
            window.dxaDraftFromArticle({ id: a.id, name: name, title: title, source: 'Title: ' + title + '\n' + body }).then(function (r) {
                a.dx = { draftId: r.draftId, publishedId: '', name: name }; S.base = JSON.stringify(a);
                var i = S.list.findIndex(function (x) { return x.id === a.id; }); if (i >= 0) S.list[i].dx = a.dx;
                S.aiNote = '🩺 "' + name + '" is in the Disease Codex ▸ Pending Drafts' + (r.model ? ' · ' + r.model : '') + ' — approve it there';
                if (typeof showToast === 'function') showToast('🩺 Codex draft created · pending approval');
            }).catch(function (e) { S.err = '🩺 ' + ((e && e.message) || 'Could not draft the Codex entry.'); S.aiNote = ''; }).then(function () { S.dxBusy = false; render(); });
        },
        // 💊 V102.374: the drug twin of toCodex — dcaDraftFromArticle in admin.html, the article remembers it in `dc`
        toDrug: function () {
            var a = S.cur; if (!a || S.dcBusy) return;
            if (JSON.stringify(a) !== S.base) { S.err = '💊 Save the article first, then send it to the Drug Codex.'; render(); return; }
            var dc = a.dc || {};
            if (dc.publishedId || dc.draftId) {
                if (typeof openDrugCodexAdmin !== 'function') { S.err = '💊 The Drug Codex is not available on this page.'; render(); return; }
                api.close(); openDrugCodexAdmin();
                setTimeout(function () { if (dc.publishedId && typeof dcaEdit === 'function') dcaEdit(dc.publishedId); else if (typeof dcaSwitchView === 'function') dcaSwitchView('drafts'); }, 150);
                return;
            }
            if (typeof window.dcaDraftFromArticle !== 'function') { S.err = '💊 The Drug Codex is not available on this page.'; render(); return; }
            var name = String(a.title.en || a.title[S.lang] || '').replace(/[\p{Extended_Pictographic}️]/gu, '').split(/[:–—(]/)[0].trim();
            if (!name) { S.err = '💊 Give the article a title first.'; render(); return; }
            var title = a.title.en || a.title.th || a.title.ko || name, body = a.body.en || a.body.th || a.body.ko || '';
            S.dcBusy = true; S.err = ''; S.aiNote = '💊 Drafting a Drug Codex entry from this article…'; render();
            window.dcaDraftFromArticle({ id: a.id, name: name, title: title, source: 'Title: ' + title + '\n' + body }).then(function (r) {
                a.dc = { draftId: r.draftId, publishedId: '', name: name }; S.base = JSON.stringify(a);
                var i = S.list.findIndex(function (x) { return x.id === a.id; }); if (i >= 0) S.list[i].dc = a.dc;
                S.aiNote = '💊 "' + name + '" is in the Drug Codex ▸ Pending Drafts' + (r.model ? ' · ' + r.model : '') + ' — approve it there';
                if (typeof showToast === 'function') showToast('💊 Drug Codex draft created · pending approval');
            }).catch(function (e) { S.err = '💊 ' + ((e && e.message) || 'Could not draft the Drug Codex entry.'); S.aiNote = ''; }).then(function () { S.dcBusy = false; render(); });
        },
        // V102.374: the hint after Save
        hintLink: function () { var a = S.cur, h = S.hint; if (!a || !h) return; S.hint = null; a.links.push({ kind: 'disease', id: h.id, label: h.label }); save(a.status === 'scheduled'); },
        hintDismiss: function () { var a = S.cur; if (a && a.id) S.hintOff[a.id] = true; S.hint = null; render(); },
        sec: function (k, open) { S.open[k] = open; },
        // ⚠️ "Move to TH": the text typed into one language slot goes to the slot it is written in
        moveLang: function (from, to) {
            var a = S.cur; ['title', 'body'].forEach(function (k) { a[k][to] = a[k][from] || ''; a[k][from] = ''; });
            S.lang = to; render();
        },
        lang: function (l) { S.lang = l; S.del = false; S.aiNote = ''; render(); },
        text: function (k, v) { S.cur[k][S.lang] = v; paintLive(); },
        cover: function (e) { S.cur.cover = { emoji: e }; S.coverOpen = false; render(); },
        coverPick: function () { S.coverOpen = true; render(); },
        when: function (k, v) { S.cur[k] = fromLocal(v); S.err = ''; render(); },
        rerun: function (r) { S.cur.rerun = r; render(); },
        aud: function (kind, name) { var l = S.cur.audience[kind], i = l.indexOf(name); if (i >= 0) l.splice(i, 1); else l.push(name); render(); },
        audAll: function () { S.cur.audience = { divisions: [], groups: [] }; render(); },
        pickQ: function (v) { S.q = v; render(); var i = document.getElementById('art-pk-q'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } },
        addLink: function (kind, id) { var o = linkSrc(kind).find(function (x) { return x.id === id; }); if (o) S.cur.links.push({ kind: o.kind, id: o.id, label: o.label }); S.pick = ''; render(); },
        dropLink: function (i) { S.cur.links.splice(i, 1); render(); },
        wrap: function (pre, post) {
            var ta = document.getElementById('art-bodyta'); if (!ta) return;
            var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
            ta.value = v.slice(0, s) + pre + v.slice(s, e) + post + v.slice(e);
            ta.focus(); ta.setSelectionRange(s + pre.length, e + pre.length);
            api.text('body', ta.value);
        },
        _S: S, _daJobs: daJobs, _codexNameOf: codexNameOf, _stats: stats, _forUser: forUser, _status: status, _defaultWindow: defaultWindow, _validate: validate, _toDoc: toDoc, _toLocal: toLocal, _fromLocal: fromLocal, _readMin: readMin, _langsOf: langsOf
    };
    window.Articles = api;
})();
