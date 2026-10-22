// V101.177: lean sheet (owner pick) — the header is the cover emoji ("Article · n min" moved into its tooltip), no grab handle; one footer row:
// 🔖 🔕 small grey on the left, Read more + a green 👍 Got it on the right (design G4).
// V101.176: 📰 Articles — intern side. Admins write them in admin ➕ Create ▸ Article (articles-admin.js); this file shows them.
// • Popup (bottom sheet, the owner's pick "A") when the app opens: at most ONE article a day, and the same article comes back on a later day
//   until it is read (✓ Got it, a link opened, or read in History). ✕ / backdrop / Esc = closed without reading.
// • Which one: a live article first (inside its window, audience matches), then — for interns who joined after an article ended and the
//   article says rerun 'any' — the old ones, oldest first. 🔕 turns the popup off; History still lists everything.
// • Waits for its turn: never on top of another popup (Register, Guide, badge unlock …); the feedback reminder runs right after it closes.
// • State on the intern's own users/{uid}: articleSeen.<id> = { act, at, day, saved? }, articlePopDay (Bangkok date), articlesMuted.
// • Opening the linked quiz pays +1 Beri once per article (beri_ledger article_quiz__<articleId>_<uid> is the dedupe record).
// • History: rows of type 'article' (📰 chip) via historyItems() / detailHtml() / pillHtml(), read in place = read.
(function () {
    'use strict';
    var BKK = 7 * 3600e3, DONE = ['ok', 'quiz', 'codex', 'hist'];
    var S = { list: null, loading: false, armed: false, tries: 0, cur: null, lang: 'en', more: false, sig: '' };
    var T = {
        en: { kicker: 'Article', min: 'min', more: 'Read more', less: 'Show less', got: 'Got it', save: 'Save', saved: 'Saved', mute: 'Don’t pop up articles', rerun: 'For new interns', close: 'Close' },
        th: { kicker: 'บทความ', min: 'นาที', more: 'อ่านต่อ', less: 'ย่อ', got: 'รับทราบ', save: 'เก็บไว้', saved: 'เก็บแล้ว', mute: 'ไม่ต้องเด้งบทความ', rerun: 'สำหรับน้องใหม่', close: 'ปิด' },
        ko: { kicker: '아티클', min: '분', more: '더 보기', less: '접기', got: '확인', save: '저장', saved: '저장됨', mute: '아티클 팝업 끄기', rerun: '신규 인턴용', close: '닫기' }
    };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var msOf = function (t) { return t == null ? null : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : (Date.parse(t) || null); };

    // ---- pure helpers (also used by the test)
    function bkkDay(ms) { return new Date(ms + BKK).toISOString().slice(0, 10); }
    function dayStart(d) { var t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00+07:00'); return isNaN(t) ? null : t; }
    function up(x) { return String(x || '').trim().toUpperCase(); }
    // empty audience = everyone; otherwise the intern's division OR group (primary or a membership) must be listed
    function audienceOk(a, me) {
        var au = a.audience || {}, dv = (au.divisions || []).map(up), gr = (au.groups || []).map(up);
        if (!dv.length && !gr.length) return true;
        var div = typeof window.userDivisionOf === 'function' ? window.userDivisionOf(me) : me.division;
        var pairs = [{ d: div, g: me.group || 'Public' }].concat((me.memberships || []).map(function (m) { return { d: m.division, g: m.group }; }));
        return pairs.some(function (p) { return (p.d && dv.indexOf(up(p.d)) >= 0) || (p.g && gr.indexOf(up(p.g)) >= 0); });
    }
    function joinedMs(me) { return dayStart(me.startDate) || msOf(me.createdAt); }
    // 'live' (inside its window) · 'rerun' (ended before this intern joined, rerun 'any') · '' (not for this intern now)
    function kindOf(a, me, now) {
        if (!a || a.status !== 'scheduled' || !audienceOk(a, me)) return '';
        var s = msOf(a.startAt), e = msOf(a.endAt);
        if (s == null || e == null || now < s) return '';
        if (now <= e) return 'live';
        var j = joinedMs(me);
        return a.rerun !== 'off' && j != null && j > e ? 'rerun' : '';
    }
    function isDone(seen) { return !!seen && DONE.indexOf(seen.act) >= 0; }
    // the one article to pop up now, or null
    function pick(list, me, now) {
        if (!list || !me || me.articlesMuted || me.articlePopDay === bkkDay(now)) return null;
        var seen = me.articleSeen || {}, live = [], rerun = [];
        list.forEach(function (a) { if (isDone(seen[a.id])) return; var k = kindOf(a, me, now); if (k === 'live') live.push(a); else if (k === 'rerun') rerun.push(a); });
        live.sort(function (x, y) { return msOf(y.startAt) - msOf(x.startAt); });      // the newest live one
        rerun.sort(function (x, y) { return msOf(x.startAt) - msOf(y.startAt); });     // old ones: oldest first
        var a = live[0] || rerun[0];
        return a ? { a: a, kind: live[0] ? 'live' : 'rerun' } : null;
    }
    function langs(a) { return ['en', 'th', 'ko'].filter(function (l) { return String((a.title || {})[l] || '').trim() && String((a.body || {})[l] || '').trim(); }); }
    function textOf(a, lang) {
        var have = langs(a), l = have.indexOf(lang) >= 0 ? lang : have.indexOf('en') >= 0 ? 'en' : (have[0] || 'en');
        return { lang: l, title: (a.title || {})[l] || (a.title || {}).en || '', body: (a.body || {})[l] || (a.body || {}).en || '' };
    }
    function uiLang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    // History rows: every article this intern can see now (live / rerun) or has already seen
    function historyItems(list, me, now) {
        var seen = (me && me.articleSeen) || {}, out = [];
        (list || []).forEach(function (a) {
            var s = seen[a.id], k = kindOf(a, me || {}, now);
            if (!k && !s) return;
            var st = isDone(s) ? 'read' : s && s.act === 'x' ? 'closed' : 'new';
            var t = (s && msOf(s.at)) || (k === 'rerun' ? Math.max(msOf(a.startAt), joinedMs(me) || 0) : msOf(a.startAt));
            out.push({ id: 'art_' + a.id, submissionType: 'article', title: textOf(a, uiLang()).title || 'Article', status: 'article', score: 0, noDelete: true,
                timestamp: { toMillis: function () { return t; }, toDate: function () { return new Date(t); }, seconds: Math.floor(t / 1000) },
                metadata: { articleId: a.id, emoji: (a.cover && a.cover.emoji) || '📰', state: st, saved: !!(s && s.saved) } });
        });
        return out;
    }

    // ---- data
    function me() { return (window.myUserDoc) || {}; }
    function uid() { return typeof userId !== 'undefined' ? userId : ''; }
    function blocked() { return !uid() || uid() === 'preview-admin' || (typeof isPreview !== 'undefined' && isPreview); }
    function load() {
        if (S.list || S.loading || !window.db) return;
        S.loading = true;
        // rules: interns may read status 'scheduled' only, so the query must say so (rules are not filters)
        window.db.collection('articles').where('status', '==', 'scheduled').get().then(function (snap) {
            S.list = snap.docs.map(function (d) { var x = d.data(); return Object.assign({ id: d.id }, x, { startAt: msOf(x.startAt), endAt: msOf(x.endAt) }); });
            refreshHistory(true);
            later();
        }).catch(function (e) { console.warn('articles:', e && e.message); }).then(function () { S.loading = false; });
    }
    function write(fields) {
        if (blocked() || !window.db) return Promise.resolve();
        return window.db.collection('users').doc(uid()).set(fields, { merge: true }).catch(function (e) { console.warn('articles write:', e && e.message); });
    }
    // local copy first, so the UI does not wait for the snapshot (and History does not re-render under the reader's finger)
    function setSeen(id, patch) {
        var m = window.myUserDoc = window.myUserDoc || {};
        m.articleSeen = m.articleSeen || {};
        m.articleSeen[id] = Object.assign({}, m.articleSeen[id], patch, { at: Date.now() });
        var w = {}; w[id] = Object.assign({}, patch, { at: firebase.firestore.FieldValue.serverTimestamp() });
        S.sig = sig();
        return write({ articleSeen: w });
    }
    function markRead(id, act) {
        var s = (me().articleSeen || {})[id];
        if (isDone(s)) return Promise.resolve();
        return setSeen(id, { act: act });
    }
    function find(id) { return (S.list || []).find(function (a) { return a.id === id; }); }

    // ---- +1 Beri for opening the linked quiz (once per article; the deterministic ledger id is the dedupe)
    function awardQuizBeri(articleId) {
        if (blocked() || typeof beriLedgerEntry !== 'function' || !window.db) return Promise.resolve(false);
        if (typeof requireRegistered === 'function' && !requireRegistered()) return Promise.resolve(false);
        var a = find(articleId), bl = beriLedgerEntry({ userId: uid(), amount: 1, source: 'article_quiz', refId: articleId + '_' + uid(), note: '📰 ' + ((a && textOf(a, 'en').title) || articleId) });
        var userRef = window.db.collection('users').doc(uid());
        return window.db.runTransaction(function (tx) {
            return tx.get(bl.ref).then(function (snap) {
                if (snap.exists) return false;
                tx.set(userRef, { beri: firebase.firestore.FieldValue.increment(1) }, { merge: true });
                tx.set(bl.ref, bl.data);
                return true;
            });
        }).then(function (ok) { if (ok && typeof showToast === 'function') showToast('🪙 +1 Beri'); return ok; })
            .catch(function (e) { console.warn('articles beri:', e && e.message); return false; });
    }

    // ---- popup
    function css() {
        if (document.getElementById('art-css')) return;
        var s = document.createElement('style'); s.id = 'art-css';
        s.textContent = '#art-back{position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:10040;animation:artFade .15s ease-out}' +
            '#art-sheet{position:fixed;left:0;right:0;bottom:0;z-index:10041;max-width:560px;margin:0 auto;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(15,23,42,.18);padding:14px 18px calc(14px + env(safe-area-inset-bottom));max-height:86vh;overflow:auto;box-sizing:border-box;font-family:Kanit,sans-serif;text-align:left;animation:artUp .2s ease-out}' +
            '@keyframes artUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}@keyframes artFade{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){#art-sheet,#art-back{animation:none}}' +
            '#art-sheet .band{display:flex;align-items:center;gap:10px;margin:2px 0 2px}#art-sheet .cov{flex:1;min-width:0;font-size:26px;line-height:1}#art-sheet .cov small{font-size:13px;margin-left:4px;vertical-align:middle}' +
            '#art-sheet .x{width:34px;height:34px;min-height:0;margin:0;padding:0;border:0;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:15px;cursor:pointer;flex:none}' +
            '#art-sheet .lng,.art-hist .lng{display:inline-flex;gap:2px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:2px}#art-sheet .lng button,.art-hist .lng button{min-height:0;margin:0;width:auto;border:0;background:transparent;font:800 11px/1 Kanit,sans-serif;color:#64748b;padding:6px 9px;border-radius:999px;cursor:pointer}#art-sheet .lng button.on,.art-hist .lng button.on{background:#4361ee;color:#fff}' +
            '#art-sheet h3{font:800 19px/1.3 Kanit,sans-serif;color:#1e293b;margin:6px 0 8px;word-break:keep-all;overflow-wrap:anywhere}' +
            '.art-md{font:400 14.5px/1.6 Kanit,sans-serif;color:#334155;word-break:keep-all;overflow-wrap:anywhere}.art-md p,.art-md ul,.art-md ol{margin:0 0 8px}.art-md ul,.art-md ol{padding-left:20px}.art-md a{color:#4361ee}' +
            '#art-sheet .art-md.clamp{max-height:6.4em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 65%,transparent);mask-image:linear-gradient(#000 65%,transparent)}' +   // 4 lines × 1.6; line-clamp left half a line showing when the body has several paragraphs
            '#art-sheet .more{min-height:0;margin:0 0 0 auto;width:auto;border:0;background:none;font:700 13px/1 Kanit,sans-serif;color:#4361ee;padding:12px 4px;cursor:pointer;white-space:nowrap}' +
            '.art-links{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 12px}.art-link{min-height:0;margin:0;width:auto;display:inline-flex;align-items:center;gap:6px;font:600 12.5px/1 Kanit,sans-serif;padding:8px 11px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;cursor:pointer}' +
            '.art-link.codex{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}.art-link b{font-weight:800;color:#b45309}' +
            '#art-sheet .foot{display:flex;align-items:center;gap:8px;margin-top:6px}#art-sheet .bm{width:44px;height:44px;min-height:0;margin:0;padding:0;border-radius:12px;border:0;background:#f1f5f9;font-size:17px;cursor:pointer;flex:none}#art-sheet .bm[aria-pressed="true"]{background:#fef3c7}#art-sheet .bm.mute{opacity:.8}' +
            '#art-sheet .ok{flex:none;width:auto;height:44px;min-height:0;margin:0;padding:0 18px;border-radius:999px;border:0;background:#16a34a;color:#fff;font:800 14px/1 Kanit,sans-serif;cursor:pointer;box-shadow:0 4px 10px rgba(22,163,74,.25);white-space:nowrap}#art-sheet button:focus{outline:none}#art-sheet button:focus-visible{outline:2px solid #a5b4fc;outline-offset:2px}' +
            
            '.hl-pill.art-ok{background:#dcfce7;color:#166534}.hl-pill.art-new{background:#eef2ff;color:#4361ee}.art-hist{padding:2px 0 6px}.art-hist .art-top{display:flex;justify-content:flex-end;margin:0 0 6px}.art-hist .art-links{margin:8px 0 2px}';
        document.head.appendChild(s);
    }
    function busy() {
        if (document.getElementById('art-back') || document.getElementById('fbr-back')) return true;
        var g = document.getElementById('internGuideOverlay'); if (g && g.classList.contains('open')) return true;
        return Array.prototype.some.call(document.querySelectorAll('.modal'), function (m) { var d = m.style.display; return d === 'flex' || d === 'block' || m.classList.contains('open') || m.classList.contains('show'); });
    }
    function linksHtml(a) {
        // V101.196: the Disease Codex entry drafted from this article (articles/{id}.dx.publishedId, set when the admin approves it)
        var dx = a.dx && a.dx.publishedId ? '<button type="button" class="art-link codex" onclick="internArticles.openDx(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(a.dx.publishedId)) + ')">🩺 ' + esc(a.dx.name || 'Disease Codex') + '</button>' : '';
        return ((a.links || []).length || dx) ? '<div class="art-links">' + dx + (a.links || []).map(function (l) {
            return l.kind === 'quiz' ? '<button type="button" class="art-link" onclick="internArticles.openQuiz(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(l.id)) + ')">🧪 ' + esc(l.label) + ' <b>🪙 +1</b></button>'
                : l.kind === 'disease' ? '<button type="button" class="art-link codex" onclick="internArticles.openDx(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(l.id)) + ')">🩺 ' + esc(l.label) + '</button>'   // V101.197: ＋ Disease link
                : '<button type="button" class="art-link codex" onclick="internArticles.openCodex(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(l.id)) + ')">💊 ' + esc(l.label) + '</button>';
        }).join('') + '</div>' : '';
    }
    function md(text) { return typeof window.renderMd === 'function' ? window.renderMd(text) : esc(text).replace(/\n/g, '<br>'); }
    function render() {
        var c = S.cur, a = c.a, tx = textOf(a, S.lang), t = T[S.lang] || T.en, have = langs(a), saved = !!((me().articleSeen || {})[a.id] || {}).saved;
        var sh = document.getElementById('art-sheet'); if (!sh) return;
        var info = (c.kind === 'rerun' ? '🔁 ' + t.rerun : t.kicker) + ' · ' + (a.readMin || 1) + ' ' + t.min;
        sh.innerHTML = '<div class="band"><span class="cov" title="' + esc(info) + '" aria-label="' + esc(info) + '">' + esc((a.cover && a.cover.emoji) || '📰') + (c.kind === 'rerun' ? '<small>🔁</small>' : '') + '</span>' +
            (have.length > 1 ? '<span class="lng" role="group" aria-label="Language">' + have.map(function (l) { return '<button type="button" class="' + (l === tx.lang ? 'on' : '') + '" aria-pressed="' + (l === tx.lang) + '" onclick="internArticles.lang(\'' + l + '\')">' + l.toUpperCase() + '</button>'; }).join('') + '</span>' : '') +
            '<button type="button" class="x" onclick="internArticles.close(\'x\')" aria-label="' + t.close + '">✕</button></div>' +
            '<h3 id="art-title">' + esc(tx.title) + '</h3><div class="art-md' + (S.more ? '' : ' clamp') + '" id="art-text">' + md(tx.body) + '</div>' +
            linksHtml(a) +
            '<div class="foot"><button type="button" class="bm" onclick="internArticles.save()" aria-pressed="' + saved + '" title="' + (saved ? t.saved : t.save) + '" aria-label="' + (saved ? t.saved : t.save) + '">🔖</button>' +
            '<button type="button" class="bm mute" onclick="internArticles.mute()" title="' + t.mute + '" aria-label="' + t.mute + '">🔕</button>' +
            '<button type="button" class="more" id="art-more" onclick="internArticles.toggleMore()">' + (S.more ? t.less + ' ▴' : t.more + ' ▾') + '</button>' +
            '<button type="button" class="ok" onclick="internArticles.close(\'ok\')">👍 ' + t.got + '</button></div>';
        // a short body needs no "Read more"
        var el = document.getElementById('art-text'), mb = document.getElementById('art-more');
        if (el && mb && !S.more && el.scrollHeight <= el.clientHeight + 2) mb.style.visibility = 'hidden';
    }
    function show(c) {
        css();
        S.cur = c; S.lang = uiLang(); S.more = false;
        var back = document.createElement('div'); back.id = 'art-back'; back.onclick = function () { close('x'); };
        var sh = document.createElement('div'); sh.id = 'art-sheet'; sh.className = 'lang-no-toggle'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-labelledby', 'art-title');
        document.body.appendChild(back); document.body.appendChild(sh);
        render();
        document.addEventListener('keydown', onKey);
        var today = bkkDay(Date.now());
        if (window.myUserDoc) window.myUserDoc.articlePopDay = today;
        var w = { articlePopDay: today, articleSeen: {} }; w.articleSeen[c.a.id] = { day: today };
        write(w);
        var ok = sh.querySelector('.ok'); if (ok) ok.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close('x'); }
    function close(act) {
        var c = S.cur; if (!c) return Promise.resolve();
        S.cur = null;
        ['art-back', 'art-sheet'].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
        document.removeEventListener('keydown', onKey);
        var p = act === 'x' ? (isDone((me().articleSeen || {})[c.a.id]) ? Promise.resolve() : setSeen(c.a.id, { act: 'x' })) : markRead(c.a.id, act);
        refreshHistory(false);
        // the feedback reminder skipped its turn while this was open — give it the turn now
        setTimeout(function () { if (window.fbRemind && typeof fbRemind.check === 'function') fbRemind.check(); }, 400);
        return p;
    }
    function later() {
        if (blocked() || S.cur) return;
        var c = pick(S.list, me(), Date.now());
        if (!c) return;
        if (busy()) { if (S.tries++ < 30) setTimeout(later, 2000); return; }
        show(c);
    }

    // ---- History
    function sig() { return JSON.stringify(historyItems(S.list, me(), Date.now()).map(function (i) { return i.id + i.metadata.state + i.metadata.saved; })); }
    function refreshHistory(force) {
        var s = sig();
        if (!force && s === S.sig) return;
        S.sig = s;
        if (typeof renderUnifiedHistory === 'function' && document.getElementById('unified-timeline')) { try { renderUnifiedHistory(); } catch (e) { /* history not ready yet */ } }
    }
    function pillHtml(s) {
        var m = s.metadata || {};
        var P = { en: { read: 'Read', closed: 'Closed', fresh: 'New' }, th: { read: 'อ่านแล้ว', closed: 'ปิดไป', fresh: 'ใหม่' }, ko: { read: '읽음', closed: '닫음', fresh: '새 글' } }[uiLang()];   // V101.189
        return m.state === 'read' ? '<span class="hl-pill art-ok">✓ ' + P.read + (m.saved ? ' · 🔖' : '') + '</span>' : m.state === 'closed' ? '<span class="hl-pill">👁 ' + P.closed + (m.saved ? ' · 🔖' : '') + '</span>' : '<span class="hl-pill art-new">📰 ' + P.fresh + '</span>';
    }
    function detailHtml(s) {
        var a = find((s.metadata || {}).articleId); if (!a) return '';
        css();
        var tx = textOf(a, uiLang()), have = langs(a);
        // V101.193: the sheet's EN / TH / KO chips here too when the article has more than one language — a tap swaps the body in place
        var lng = have.length > 1 ? '<div class="art-top"><span class="lng" role="group" aria-label="Language">' + have.map(function (l) { return '<button type="button" class="' + (l === tx.lang ? 'on' : '') + '" aria-pressed="' + (l === tx.lang) + '" onclick="internArticles.histLang(this, \'' + l + '\')">' + l.toUpperCase() + '</button>'; }).join('') + '</span></div>' : '';
        return '<div class="art-hist lang-no-toggle" data-art="' + esc(a.id) + '">' + lng + '<div class="art-md">' + md(tx.body) + '</div>' + linksHtml(a) + '</div>';
    }
    function histLang(btn, l) {
        var box = btn.closest('.art-hist'), a = box && find(box.dataset.art); if (!a) return;
        box.querySelector('.art-md').innerHTML = md(textOf(a, l).body);
        box.querySelectorAll('.lng button').forEach(function (b) { var on = b.textContent === l.toUpperCase(); b.className = on ? 'on' : ''; b.setAttribute('aria-pressed', String(on)); });
    }
    // tapping an article row open in History = read (the row stays open: the pill is patched in place, no re-render)
    document.addEventListener('click', function (e) {
        var row = e.target.closest && e.target.closest('[data-delete-type="article"]');
        if (!row || e.target.closest('a, button')) return;
        var id = String(row.dataset.deleteItem || '').replace(/^art_/, ''), s = (me().articleSeen || {})[id];
        if (!find(id) || isDone(s)) return;
        markRead(id, 'hist').then(function () { });
        var pill = row.querySelector('.hl-pill'); if (pill) pill.outerHTML = pillHtml({ metadata: { state: 'read', saved: !!(s && s.saved) } });
    });

    window.internArticles = {
        // called from the users/{uid} snapshot in index.html
        onUserDoc: function () {
            if (!S.armed) { S.armed = true; if (!blocked()) setTimeout(load, 2500); }
            else refreshHistory(false);
        },
        historyItems: function () { return historyItems(S.list, me(), Date.now()); },
        detailHtml: detailHtml, pillHtml: pillHtml, close: close, histLang: histLang,
        lang: function (l) { S.lang = l; render(); },
        toggleMore: function () { S.more = !S.more; render(); },
        save: function () {
            var c = S.cur; if (!c) return;
            var s = (me().articleSeen || {})[c.a.id] || {};
            setSeen(c.a.id, { saved: !s.saved }); render(); refreshHistory(false);
        },
        mute: function () { if (window.myUserDoc) window.myUserDoc.articlesMuted = true; write({ articlesMuted: true }); close('x'); if (typeof showToast === 'function') showToast('🔕 Articles stay in History'); },
        // from the popup (closes it, = read) or from a History row (= read)
        openQuiz: function (articleId, quizId) {
            if (S.cur) close('quiz'); else markRead(articleId, 'quiz');
            awardQuizBeri(articleId);
            if (typeof applyTabDeepLink === 'function') applyTabDeepLink(new URLSearchParams({ quiz: String(quizId) }));
        },
        // V101.197 (owner's pick 2): the articles about a Disease Codex entry — drafted from it (dx.publishedId) or linked by hand (＋ Disease) —
        // that this intern can see now, or has already read; newest first
        forDisease: function (diseaseId) {
            var m = me(), now = Date.now(), seen = m.articleSeen || {}, L = uiLang();
            return (S.list || []).filter(function (a) {
                var about = (a.dx && a.dx.publishedId === diseaseId) || (a.links || []).some(function (l) { return l.kind === 'disease' && l.id === diseaseId; });
                return about && (kindOf(a, m, now) || isDone(seen[a.id]));
            }).sort(function (x, y) { return msOf(y.startAt) - msOf(x.startAt); })
                .map(function (a) { return { id: a.id, title: textOf(a, L).title, read: isDone(seen[a.id]) }; });
        },
        openArticle: function (id) {   // from the Disease Codex entry: the sheet opens on top; closing it = read, as always
            var a = find(id); if (!a || S.cur) return;
            if (typeof dxCloseDetail === 'function') dxCloseDetail();
            show({ a: a, kind: kindOf(a, me(), Date.now()) || 'rerun' });
        },
        openDx: function (articleId, diseaseId) {   // V101.196: the 🩺 Disease Codex entry
            if (S.cur) close('codex'); else markRead(articleId, 'codex');
            if (typeof dxOpenDetail === 'function') dxOpenDetail(diseaseId);
        },
        openCodex: function (articleId, drugId) {
            if (S.cur) close('codex'); else markRead(articleId, 'codex');
            if (typeof dxOpenLinkedDrug === 'function') dxOpenLinkedDrug(drugId);
        },
        _S: S, _pick: pick, _kindOf: kindOf, _audienceOk: audienceOk, _historyItems: historyItems, _textOf: textOf, _bkkDay: bkkDay, _isDone: isDone, _later: later, _show: show, _award: awardQuizBeri
    };
})();
