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
    var S = { list: [], loaded: false, loading: false, err: '', filter: 'all', cur: null, lang: 'en', saving: false, del: false, pick: '', q: '', codex: null };
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
    function blank(now) {
        var w = defaultWindow(now);
        return { id: null, title: {}, body: {}, cover: { emoji: '📰' }, status: 'draft', startAt: w.start, endAt: w.end, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
    }
    function fromDoc(id, d) {
        return { id: id, title: Object.assign({}, d.title), body: Object.assign({}, d.body), cover: Object.assign({ emoji: '📰' }, d.cover), status: d.status === 'scheduled' ? 'scheduled' : 'draft',
            startAt: msOf(d.startAt), endAt: msOf(d.endAt), audience: { divisions: ((d.audience || {}).divisions || []).slice(), groups: ((d.audience || {}).groups || []).slice() },
            links: (d.links || []).slice(), rerun: d.rerun === 'off' ? 'off' : 'any', createdAt: msOf(d.createdAt) };
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
            a.status = st;
            var i = S.list.findIndex(function (x) { return x.id === a.id; });
            var copy = fromDoc(a.id, Object.assign({}, doc, { startAt: a.startAt, endAt: a.endAt }));
            if (i >= 0) S.list[i] = copy; else S.list.push(copy);
            if (typeof showToast === 'function') showToast(schedule ? '📅 Scheduled' : '💾 Saved as draft');
        }).catch(function (e) { S.err = (e && e.message) || 'Save failed.'; }).then(function () { S.saving = false; render(); });
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
    function openPick(kind) {
        S.pick = S.pick === kind ? '' : kind; S.q = ''; render();
        if (kind === 'codex' && !codex().length && S.codex == null) {
            S.codex = [];
            db.collection('drug_codex').get().then(function (snap) { S.codex = snap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); }); render(); }).catch(function () { S.codex = null; });
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
            '.art-new{margin:0 0 0 auto!important;width:auto!important;min-height:0!important;background:#4361ee;color:#fff;border:0;border-radius:12px;padding:8px 14px;font-weight:800;cursor:pointer}' +
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
            '.art-pv{display:flex;flex-direction:column;gap:8px;position:sticky;top:0}.art-pvh{display:flex;align-items:center;gap:6px;font-weight:800;font-size:12.5px;color:#475569}' +
            '.art-phone{width:270px;height:500px;border-radius:30px;border:7px solid #1e293b;background:#eef1f6;position:relative;overflow:hidden;align-self:center}.art-phone .home{padding:14px 10px;opacity:.55;filter:blur(1px)}.art-phone .home div{height:42px;border-radius:12px;background:#fff;margin-bottom:9px}.art-phone .home div:first-child{height:76px}' +
            '.art-sh{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;padding:8px 13px 12px;box-shadow:0 -8px 20px rgba(15,23,42,.15);max-height:84%;overflow:hidden}.art-sh .g{width:32px;height:4px;border-radius:9px;background:#e2e8f0;margin:0 auto 8px}' +
            '.art-sh .k{font-size:10px;font-weight:700;color:#4361ee}.art-sh .tt{font-size:14px;font-weight:800;line-height:1.3;margin:5px 0;color:#1e293b;word-break:keep-all;overflow-wrap:anywhere}.art-sh .b{font-size:11.5px;line-height:1.5;color:#334155;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;overflow-wrap:anywhere}' +
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
        return '<button type="button" class="art-row' + (S.cur && S.cur.id === a.id ? ' sel' : '') + (st === 'ended' ? ' ended' : '') + '" onclick="Articles.edit(\'' + esc(a.id) + '\')">' +
            '<span class="art-tile">' + esc(a.cover.emoji) + '</span><span style="min-width:0"><span class="art-t">' + esc(title(a)) + '</span><span class="art-meta"><span class="art-st ' + st + '">' + esc(stLabel(a, now)) + '</span>' +
            LANGS.map(function (l) { return '<span class="art-lg' + (have.indexOf(l[0]) < 0 ? ' off' : '') + '">' + l[1] + '</span>'; }).join('') +
            (aud.length ? '<span title="Audience">' + esc(aud.join(' · ')) + '</span>' : '') + (a.rerun === 'off' ? '' : '<span title="Also sent to interns who join later">🔁</span>') + '</span></span></button>';
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
        var src = S.pick === 'quiz' ? quizzes() : codex();
        var opts = src.filter(function (o) { return have.indexOf(o.kind + ':' + o.id) < 0 && (!q || o.label.toLowerCase().indexOf(q) >= 0); }).slice(0, 40);
        var empty = S.pick === 'codex' && S.codex && !S.codex.length && !codex().length ? 'Loading DD Codex…' : 'Nothing matches.';
        return '<div class="art-pk"><input type="search" id="art-pk-q" placeholder="' + (S.pick === 'quiz' ? '🧪 Find a quiz…' : '💊 Find a drug…') + '" value="' + esc(S.q) + '" oninput="Articles.pickQ(this.value)">' +
            '<div class="opts">' + (opts.length ? opts.map(function (o) { return '<button type="button" onclick="Articles.addLink(\'' + o.kind + '\',' + esc(JSON.stringify(o.id)) + ')">' + (o.kind === 'quiz' ? '🧪 ' : '💊 ') + esc(o.label) + '</button>'; }).join('') : '<span style="color:#94a3b8;font-size:12.5px;padding:4px 8px">' + empty + '</span>') + '</div></div>';
    }
    function editorHtml(now) {
        var a = S.cur, L = S.lang, t = (a.title || {})[L] || '', b = (a.body || {})[L] || '', have = langsOf(a), st = status(a, now);
        var lines = [
            '<div class="art-ln"><span class="art-ml">Cover</span>' + COVERS.map(function (e) { return '<button type="button" class="art-emo' + (a.cover.emoji === e ? ' on' : '') + '" onclick="Articles.cover(\'' + e + '\')" aria-label="Cover ' + e + '">' + e + '</button>'; }).join('') + '</div>',
            '<div class="art-ln"><span class="art-ml">Language</span>' + LANGS.map(function (l) { return chip('<i class="d' + (have.indexOf(l[0]) >= 0 ? ' ok' : '') + '"></i>' + l[1], L === l[0], 'Articles.lang(\'' + l[0] + '\')', ' title="' + (l[0] === 'en' ? 'Required to schedule' : 'Optional — interns see EN when this is empty') + '"'); }).join('') + '</div>',
            '<input class="art-in" id="art-title" maxlength="' + MAX_TITLE + '" placeholder="Title (' + L.toUpperCase() + ')" value="' + esc(t) + '" oninput="Articles.text(\'title\',this.value)">',
            '<div class="art-md"><div class="art-tb"><button type="button" title="Bold" onclick="Articles.wrap(\'**\',\'**\')">B</button><button type="button" title="Italic" onclick="Articles.wrap(\'*\',\'*\')"><i>I</i></button>' +
            '<button type="button" title="Bullet list" onclick="Articles.wrap(\'\\n- \',\'\')">•</button><button type="button" title="Numbered list" onclick="Articles.wrap(\'\\n1. \',\'\')">1.</button><button type="button" title="Link" onclick="Articles.wrap(\'[\',\'](https://)\')">🔗</button></div>' +
            '<textarea class="art-ta" id="art-bodyta" placeholder="A short read: 3–5 lines. Markdown works." oninput="Articles.text(\'body\',this.value)">' + esc(b) + '</textarea>' +
            '<div class="art-ft"><span>Markdown</span><span id="art-count" style="margin-left:auto"' + (b.length > MAX_BODY ? ' class="over"' : '') + '>' + b.length + ' / ' + MAX_BODY + ' · ~' + readMin(b) + ' min</span></div></div>',
            '<div class="art-ln"><span class="art-ml">Window</span><input type="datetime-local" class="art-dt" id="art-start" value="' + (a.startAt != null ? toLocal(a.startAt) : '') + '" onchange="Articles.when(\'startAt\',this.value)"> → <input type="datetime-local" class="art-dt" id="art-end" value="' + (a.endAt != null ? toLocal(a.endAt) : '') + '" onchange="Articles.when(\'endAt\',this.value)"><span style="font-size:11.5px;color:#94a3b8">Bangkok time</span></div>',
            '<div class="art-ln"><span class="art-ml">🔁 Later</span>' + RERUN.map(function (r) { return chip(r[1], a.rerun === r[0], 'Articles.rerun(\'' + r[0] + '\')', ' title="' + esc(r[2]) + '"'); }).join('') + '</div>',
            '<div class="art-ln"><span class="art-ml">Audience</span>' + audienceHtml(a) + '</div>',
            '<div class="art-ln"><span class="art-ml">Links</span>' + (a.links || []).map(function (l, i) { return '<span class="art-lk ' + l.kind + '">' + (l.kind === 'quiz' ? '🧪 ' : '💊 ') + esc(l.label) + '<button type="button" aria-label="Remove link" onclick="Articles.dropLink(' + i + ')">✕</button></span>'; }).join('') +
            chip('＋ Quiz', S.pick === 'quiz', 'Articles.openPick(\'quiz\')', '', ' art-add') + chip('＋ Codex', S.pick === 'codex', 'Articles.openPick(\'codex\')', '', ' art-add') + '</div>' + pickerHtml(),
            S.err ? '<div class="art-err" role="alert">⚠️ ' + esc(S.err) + '</div>' : '',
            '<div class="art-btns"><button type="button" class="del' + (S.del ? ' arm' : '') + '" onclick="Articles.remove()">' + (S.del ? 'Delete?' : (a.id ? '🗑' : 'Discard')) + '</button>' +
            (a.status === 'scheduled' ? '<button type="button" onclick="Articles.save(false)"' + (S.saving ? ' disabled' : '') + '>↩ Back to draft</button>' : '<button type="button" onclick="Articles.save(false)"' + (S.saving ? ' disabled' : '') + '>Save draft</button>') +
            '<button type="button" class="p" onclick="Articles.save(true)"' + (S.saving ? ' disabled' : '') + '>' + (S.saving ? 'Saving…' : a.status === 'scheduled' ? '💾 Save' : '📅 Schedule') + '</button></div>'
        ];
        return '<div class="art-ed" data-status="' + st + '">' + lines.join('') + '</div>';
    }
    function previewHtml() {
        var a = S.cur, L = S.lang, t = (a.title || {})[L] || (a.title || {}).en || '', b = (a.body || {})[L] || (a.body || {}).en || '';
        var md = typeof window.renderMd === 'function' ? window.renderMd(b) : esc(b);
        return '<div class="art-pv"><div class="art-pvh">📱 Preview <span style="font-weight:600;color:#94a3b8">' + L.toUpperCase() + ((a.title || {})[L] ? '' : ' → EN') + '</span></div>' +
            '<div class="art-phone"><div class="home"><div></div><div></div><div></div><div></div></div><div class="art-sh" id="art-sheet"><div class="g"></div>' +
            '<div style="display:flex;gap:8px;align-items:center"><span class="art-tile" style="width:32px;height:32px;font-size:17px">' + esc(a.cover.emoji) + '</span><span class="k">📰 Article · ' + readMin(b) + ' min</span></div>' +
            '<div class="tt">' + esc(t || 'Title') + '</div><div class="b">' + (md || '<span style="color:#94a3b8">The body shows here.</span>') + '</div><div class="m">Read more ▾</div>' +
            ((a.links || []).length ? '<div class="lks">' + a.links.map(function (l) { return '<span>' + (l.kind === 'quiz' ? '🧪 ' : '💊 ') + esc(l.label) + (l.kind === 'quiz' ? ' · 🪙 +1' : '') + '</span>'; }).join('') + '</div>' : '') +
            '<div style="display:flex;gap:6px"><span class="bm">🔖</span><span class="ok">✓ Got it</span></div></div></div></div>';
    }
    function render() {
        var host = document.getElementById('art-body'); if (!host) return;
        var now = Date.now(), counts = { all: S.list.length };
        S.list.forEach(function (a) { var st = status(a, now); counts[st] = (counts[st] || 0) + 1; });
        var list = sorted(now);
        var head = '<div class="art-h"><h2>📰 Articles</h2><div class="art-rail" role="group" aria-label="Filter by status">' + FILTERS.map(function (f) {
            return '<button type="button" class="' + (S.filter === f[0] ? 'on' : '') + '" aria-pressed="' + (S.filter === f[0]) + '" data-filter="' + f[0] + '" onclick="Articles.filter(\'' + f[0] + '\')">' + f[1] + '<b>' + (counts[f[0]] || 0) + '</b></button>';
        }).join('') + '</div><button type="button" class="art-new" onclick="Articles.edit(null)">＋ New</button></div>';
        var left = '<div class="art-list">' + (S.loading && !S.loaded ? '<div class="art-empty">Loading…</div>' : list.length ? list.map(function (a) { return rowHtml(a, now); }).join('') : '<div class="art-empty">' + (S.list.length ? 'Nothing here.' : 'No articles yet — ＋ New') + '</div>') + '</div>';
        var mid = S.cur ? editorHtml(now) : '<div class="art-empty">' + (S.err && !S.loaded ? '⚠️ ' + esc(S.err) : 'Pick an article, or ＋ New.') + '</div>';
        host.innerHTML = head + '<div class="art-g">' + left + mid + (S.cur ? previewHtml() : '<div class="art-pv"></div>') + '</div>';
    }
    // typing repaints only the preview + counter, so the caret stays where it is
    function paintLive() {
        var a = S.cur; if (!a) return;
        var b = (a.body || {})[S.lang] || '', c = document.getElementById('art-count');
        if (c) { c.textContent = b.length + ' / ' + MAX_BODY + ' · ~' + readMin(b) + ' min'; c.className = b.length > MAX_BODY ? 'over' : ''; }
        var pv = document.querySelector('#art-body .art-pv'); if (pv) pv.outerHTML = previewHtml();
        var dots = document.querySelectorAll('#art-body .art-ed .art-ln:nth-child(2) i.d'), have = langsOf(a);
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
        S.lang = 'en'; S.err = ''; S.del = false; S.pick = '';
        render();
    }
    var api = {
        open: open, close: close, edit: edit, load: load, save: save, remove: remove, openPick: openPick,
        filter: function (f) { S.filter = f; render(); },
        lang: function (l) { S.lang = l; S.del = false; render(); },
        text: function (k, v) { S.cur[k][S.lang] = v; paintLive(); },
        cover: function (e) { S.cur.cover = { emoji: e }; render(); },
        when: function (k, v) { S.cur[k] = fromLocal(v); S.err = ''; render(); },
        rerun: function (r) { S.cur.rerun = r; render(); },
        aud: function (kind, name) { var l = S.cur.audience[kind], i = l.indexOf(name); if (i >= 0) l.splice(i, 1); else l.push(name); render(); },
        audAll: function () { S.cur.audience = { divisions: [], groups: [] }; render(); },
        pickQ: function (v) { S.q = v; render(); var i = document.getElementById('art-pk-q'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } },
        addLink: function (kind, id) { var o = (kind === 'quiz' ? quizzes() : codex()).find(function (x) { return x.id === id; }); if (o) S.cur.links.push(o); S.pick = ''; render(); },
        dropLink: function (i) { S.cur.links.splice(i, 1); render(); },
        wrap: function (pre, post) {
            var ta = document.getElementById('art-bodyta'); if (!ta) return;
            var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
            ta.value = v.slice(0, s) + pre + v.slice(s, e) + post + v.slice(e);
            ta.focus(); ta.setSelectionRange(s + pre.length, e + pre.length);
            api.text('body', ta.value);
        },
        _S: S, _status: status, _defaultWindow: defaultWindow, _validate: validate, _toDoc: toDoc, _toLocal: toLocal, _fromLocal: fromLocal, _readMin: readMin, _langsOf: langsOf
    };
    window.Articles = api;
})();
