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
    var S = { list: null, loading: false, armed: false, tries: 0, cur: null, cl: 'th', lang: 'en', more: false, sig: '', qs: [], qsUnsub: null };
    // V101.302 (owner pick C): 🎬 an article with a clip opens on it — the chat plays muted with its own captions; tap = sound, ✕ / ⌃ / swipe up = the text
    var CLIPT = {
        en: { sound: 'Tap for sound', read: 'Swipe up to read', skip: 'Read the article', rx: 'Pharmacist', q: 'Asks' },
        th: { sound: 'แตะเพื่อฟังเสียง', read: 'ปัดขึ้นเพื่ออ่าน', skip: 'อ่านบทความ', rx: 'เภสัชกร', q: 'ถาม' },
        ko: { sound: '탭하면 소리', read: '위로 밀어 읽기', skip: '기사 읽기', rx: '약사', q: '질문' }
    };
    var T = {
        en: { source: 'Source', kicker: 'Article', min: 'min', more: 'Read more', less: 'Show less', got: 'Got it', save: 'Save', saved: 'Saved', mute: 'Don’t pop up articles', hist: 'All articles in History', rerun: 'For new interns', close: 'Close',
            read: 'Read', anyq: 'Any Q?', askSub: 'Goes to the article’s author · your name is not shown', ask: 'A question', wrong: 'Wrong / out of date', add: 'Please add',
            phAsk: 'What would you like to ask?', phWrong: 'Which part looks wrong or out of date?', phAdd: 'What should the article add?', hint: 'Replies show up in History', send: 'Send', sending: 'Sending…', fail: 'Could not send — your text is kept. Try again.' },
        th: { source: 'ที่มา', kicker: 'บทความ', min: 'นาที', more: 'อ่านต่อ', less: 'ย่อ', got: 'รับทราบ', save: 'เก็บไว้', saved: 'เก็บแล้ว', mute: 'ไม่ต้องเด้งบทความ', hist: 'บทความทั้งหมด ใน History', rerun: 'สำหรับน้องใหม่', close: 'ปิด',
            read: 'อ่านแล้ว', anyq: 'Any Q?', askSub: 'ส่งถึงผู้เขียนบทความ · ไม่แสดงชื่อคุณ', ask: 'สงสัย', wrong: 'ข้อมูลผิด/ล้าสมัย', add: 'อยากให้เพิ่ม',
            phAsk: 'อยากถามอะไร?', phWrong: 'ส่วนไหนดูผิดหรือล้าสมัย?', phAdd: 'อยากให้บทความเพิ่มเรื่องอะไร?', hint: 'ตอบกลับดูได้ใน History', send: 'ส่ง', sending: 'กำลังส่ง…', fail: 'ส่งไม่สำเร็จ ข้อความยังอยู่ ลองอีกครั้ง' },
        ko: { source: '출처', kicker: '아티클', min: '분', more: '더 보기', less: '접기', got: '확인', save: '저장', saved: '저장됨', mute: '아티클 팝업 끄기', hist: 'History의 모든 아티클', rerun: '신규 인턴용', close: '닫기',
            read: '읽음', anyq: 'Any Q?', askSub: '글쓴이에게 전달 · 이름은 표시되지 않아요', ask: '질문', wrong: '틀림/오래됨', add: '추가 요청',
            phAsk: '무엇이 궁금한가요?', phWrong: '어느 부분이 틀리거나 오래되었나요?', phAdd: '어떤 내용을 더하면 좋을까요?', hint: '답변은 History에서 볼 수 있어요', send: '보내기', sending: '보내는 중…', fail: '보내지 못했어요. 글은 남아 있어요. 다시 시도하세요.' }
    };
    // V101.212 (owner's pick, mockup-article-questions.html): 👍 Got it = read at once, and the button turns into 💬 Any Q? for 7 s (a thin line
    // under it shrinks); a tap opens a small form — ❓ a question · ⚠️ wrong / out of date · 💡 please add, up to 300 characters — that writes
    // article_questions/{id}. The admin side never shows who asked (the uid is kept only to send the reply back). Then a "Complete" moment.
    var ANYQ_MS = 7000, QMAX = 300, KINDS = [['ask', '❓'], ['wrong', '⚠️'], ['add', '💡']];
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
    // V101.228: every article this intern still has to read (live first, newest; then the old ones for new interns, oldest first) — the 'still to do' sheet lists them; null until the list has loaded; muted = none
    function owed(list, me, now) {
        if (!list || !me) return null;
        if (me.articlesMuted) return [];
        var seen = me.articleSeen || {}, live = [], rerun = [];
        list.forEach(function (a) { if (isDone(seen[a.id])) return; var k = kindOf(a, me, now); if (k === 'live') live.push(a); else if (k === 'rerun') rerun.push(a); });
        live.sort(function (x, y) { return msOf(y.startAt) - msOf(x.startAt); });
        rerun.sort(function (x, y) { return msOf(x.startAt) - msOf(y.startAt); });
        return live.concat(rerun).map(function (a) { return { id: a.id, title: textOf(a, S.cl).title }; });
    }
    function langs(a) { return ['en', 'th', 'ko'].filter(function (l) { return String((a.title || {})[l] || '').trim() && String((a.body || {})[l] || '').trim(); }); }
    function textOf(a, lang) {
        var have = langs(a), l = have.indexOf(lang) >= 0 ? lang : have.indexOf('th') >= 0 ? 'th' : have.indexOf('en') >= 0 ? 'en' : (have[0] || 'en');
        return { lang: l, title: (a.title || {})[l] || (a.title || {}).en || '', body: (a.body || {})[l] || (a.body || {}).en || '' };
    }
    // V101.202 (owner): one language pill, like the app's EN / KR / TH button — it shows the language on screen; a tap moves to the next one the article has
    function nextLang(have, l) { return have[(have.indexOf(l) + 1) % have.length]; }
    // V101.268 (owner): the pill is the country flag (🇬🇧 / 🇹🇭 / 🇰🇷), like the 💬 Any Q? chip; the name is in title + aria-label
    function langBtn(have, l, onclick, cls) { return '<button type="button" class="lng fl' + (cls ? ' ' + cls : '') + '" data-lang="' + l + '" title="' + LNAME[l] + '" aria-label="Language: ' + LNAME[l] + ' (tap for ' + LNAME[nextLang(have, l)] + ')" onclick="' + onclick + '">' + FLAGS[l] + '</button>'; }
    // V101.217 (owner): the 💬 Any Q? form carries one flag chip too (🇬🇧 → 🇹🇭 → 🇰🇷), like the Guide — its labels exist in all three languages whatever the article has
    var FLAGS = { en: '🇬🇧', th: '🇹🇭', ko: '🇰🇷' }, LNAME = { en: 'English', th: 'ไทย', ko: '한국어' }, LORDER = ['en', 'th', 'ko'];
    function flagBtn(l) { var n = LORDER[(LORDER.indexOf(l) + 1) % LORDER.length]; return '<button type="button" class="lng fl" data-lang="' + l + '" title="' + LNAME[l] + '" aria-label="Language: ' + LNAME[l] + ' (tap for ' + LNAME[n] + ')" onclick="internArticles.askLang()">' + FLAGS[l] + '</button>'; }
    function uiLang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    // V101.301 (owner): an article opens in Thai — S.cl, falls back to English when it has no Thai; the flag still steps to the others. Labels in History follow the app language.
    // History rows: every article this intern can see now (live / rerun) or has already seen
    // V101.213: + the intern's own 💬 Any Q? questions on it (qs = their article_questions docs). A reply moves the row up to the reply's time
    // and lights the row's "new" dot for a day (reviewedAt); the questions + replies are listed under the article when it is opened.
    function historyItems(list, me, now, qs) {
        var seen = (me && me.articleSeen) || {}, out = [];
        (list || []).forEach(function (a) {
            var s = seen[a.id], k = kindOf(a, me || {}, now), qa = (qs || []).filter(function (q) { return q.articleId === a.id; }).sort(function (x, y) { return (msOf(x.createdAt) || 0) - (msOf(y.createdAt) || 0); });
            if (!k && !s && !qa.length) return;
            var st = isDone(s) ? 'read' : s && s.act === 'x' ? 'closed' : 'new';
            var t = (s && msOf(s.at)) || (k === 'rerun' ? Math.max(msOf(a.startAt), joinedMs(me) || 0) : msOf(a.startAt));
            var rep = qa.reduce(function (m, q) { return q.status === 'answered' ? Math.max(m, msOf(q.repliedAt) || 0) : m; }, 0);
            if (rep > t) t = rep;
            var stamp = function (ms) { return { toMillis: function () { return ms; }, toDate: function () { return new Date(ms); }, seconds: Math.floor(ms / 1000) }; };
            out.push(Object.assign({ id: 'art_' + a.id, submissionType: 'article', title: textOf(a, S.cl).title || 'Article', status: 'article', score: 0, noDelete: true, timestamp: stamp(t),
                metadata: { articleId: a.id, emoji: (a.cover && a.cover.emoji) || '📰', state: st, saved: !!(s && s.saved), qa: qa.map(function (q) { return { kind: q.kind, text: q.text, status: q.status, reply: q.reply || '' }; }) } },
                rep ? { reviewedAt: stamp(rep) } : {}));
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
    // V101.197/198: the articles "about" a Codex entry (pred) that this intern can see now, or has read; newest first
    function aboutCodex(pred) {
        var m = me(), now = Date.now(), seen = m.articleSeen || {}, L = S.cl;
        return (S.list || []).filter(function (a) { return pred(a) && (kindOf(a, m, now) || isDone(seen[a.id])); })
            .sort(function (x, y) { return msOf(y.startAt) - msOf(x.startAt); })
            .map(function (a) { return { id: a.id, title: textOf(a, L).title, read: isDone(seen[a.id]) }; });
    }

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
            '#art-sheet .lng,.art-hist .lng{min-height:0;margin:0;width:auto;border:1px solid #c7d2fe;background:#eef2ff;color:#4361ee;font:800 11px/1 Kanit,sans-serif;padding:6px 10px;border-radius:999px;cursor:pointer}' +
            '#art-sheet h3{font:800 19px/1.3 Kanit,sans-serif;color:#1e293b;margin:6px 0 8px;word-break:keep-all;overflow-wrap:anywhere}' +
            '.art-md{font:400 14.5px/1.6 Kanit,sans-serif;color:#334155;word-break:keep-all;overflow-wrap:anywhere}.art-md p,.art-md ul,.art-md ol{margin:0 0 8px}.art-md ul,.art-md ol{padding-left:20px}.art-md a{color:#4361ee}' +
            '#art-sheet .art-md.clamp{max-height:6.4em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 65%,transparent);mask-image:linear-gradient(#000 65%,transparent)}' +   // 4 lines × 1.6; line-clamp left half a line showing when the body has several paragraphs
            '#art-sheet .more{min-height:0;margin:0 0 0 auto;width:auto;border:0;background:none;font:700 13px/1 Kanit,sans-serif;color:#4361ee;padding:12px 4px;cursor:pointer;white-space:nowrap}' +
            '.art-src{margin:0 0 10px;font:400 12.5px/1.4 Kanit,sans-serif;color:#64748b}.art-src button{display:inline;width:auto;min-height:0;margin:0;padding:4px 2px;border:0;background:none;box-shadow:none;color:#4361ee;font:600 12.5px/1.4 Kanit,sans-serif;text-decoration:underline;cursor:pointer}' +
            '.art-links{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 12px}.art-link{min-height:0;margin:0;width:auto;display:inline-flex;align-items:center;gap:6px;font:600 12.5px/1 Kanit,sans-serif;padding:8px 11px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;cursor:pointer}' +
            '.art-link.codex{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}.art-link b{font-weight:800;color:#b45309}' +
            '#art-sheet .foot{display:flex;align-items:center;gap:8px;margin-top:6px}#art-sheet .bm{width:44px;height:44px;min-height:0;margin:0;padding:0;border-radius:12px;border:0;background:#f1f5f9;font-size:17px;cursor:pointer;flex:none}#art-sheet .bm[aria-pressed="true"]{background:#fef3c7}#art-sheet .bm.mute{opacity:.8}' +
            '#art-sheet .ok{flex:none;width:auto;height:44px;min-height:0;margin:0;padding:0 18px;border-radius:999px;border:0;background:#16a34a;color:#fff;font:800 14px/1 Kanit,sans-serif;cursor:pointer;box-shadow:0 4px 10px rgba(22,163,74,.25);white-space:nowrap}#art-sheet button:focus{outline:none}#art-sheet button:focus-visible{outline:2px solid #a5b4fc;outline-offset:2px}' +
            // V101.212: after Got it — "✓ Read" + the indigo 💬 Any Q? whose bottom line shrinks over 7 s
            '#art-sheet .rd{flex:none;font:800 13px/1 Kanit,sans-serif;color:#16a34a;white-space:nowrap}' +
            '#art-sheet .anyq{position:relative;overflow:hidden;flex:none;width:auto;height:44px;min-height:0;margin:0;padding:0 18px;border-radius:999px;border:0;background:#4f46e5;color:#fff;font:800 14px/1 Kanit,sans-serif;cursor:pointer;box-shadow:0 4px 10px rgba(79,70,229,.28);white-space:nowrap;animation:artPop .2s ease-out}' +
            '#art-sheet .anyq::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.75);transform-origin:left;animation:artShrink ' + ANYQ_MS + 'ms linear forwards}' +
            '@keyframes artShrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}@keyframes artPop{from{transform:scale(.9);opacity:.4}to{transform:none;opacity:1}}' +
            // the Any Q? form
            '#art-sheet .lng.fl,.art-hist .lng.fl{font-size:16px;padding:4px 8px}' +
            '@media (max-width:400px){#art-sheet .foot{gap:6px}#art-sheet .bm{width:38px}#art-sheet .ok{padding:0 14px}}#art-sheet .bm.hist{position:relative}#art-sheet .bm.hist i{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:999px;background:#4361ee;color:#fff;font:700 10.5px/18px Kanit,sans-serif;font-style:normal}' +
            '#art-sheet .aq-h{display:flex;align-items:center;gap:10px;margin:2px 0 2px}#art-sheet .aq-h .lng{font-size:16px;padding:5px 9px}#art-sheet .aq-h b{flex:1;font:800 19px/1.3 Kanit,sans-serif;color:#1e293b}#art-sheet .aq-sub{font:400 12.5px/1.4 Kanit,sans-serif;color:#94a3b8;margin:0 0 12px}' +
            '#art-sheet .aq-k{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}#art-sheet .aq-k button{min-height:0;margin:0;width:auto;border:1.5px solid #e2e8f0;background:#fff;color:#475569;font:700 13px/1 Kanit,sans-serif;padding:9px 12px;border-radius:999px;cursor:pointer}' +
            '#art-sheet .aq-k button[aria-pressed="true"]{border-color:#818cf8;background:#eef2ff;color:#3730a3}#art-sheet .aq-k button[data-k="wrong"][aria-pressed="true"]{border-color:#f59e0b;background:#fffbeb;color:#92400e}' +
            '#art-sheet .aq-t{position:relative}#art-sheet .aq-t textarea{display:block;width:100%;box-sizing:border-box;min-height:96px;margin:0;padding:12px 12px 22px;border:1.5px solid #e2e8f0;border-radius:14px;font:400 16px/1.5 Kanit,sans-serif;color:#1e293b;resize:vertical}' +
            '#art-sheet .aq-t textarea:focus{outline:none;border-color:#818cf8}#art-sheet .aq-n{position:absolute;right:10px;bottom:6px;font:600 11px/1 Kanit,sans-serif;color:#94a3b8;pointer-events:none}' +
            '#art-sheet .aq-f{display:flex;align-items:center;gap:8px;margin-top:10px}#art-sheet .aq-f span{flex:1;font:400 12px/1.3 Kanit,sans-serif;color:#94a3b8}#art-sheet .aq-f .anyq{animation:none}#art-sheet .aq-f .anyq::after{display:none}#art-sheet .aq-f .anyq:disabled{background:#c7d2fe;box-shadow:none;cursor:default}' +
            '#art-sheet .aq-e{margin:8px 0 0;font:600 12.5px/1.4 Kanit,sans-serif;color:#b91c1c}#art-sheet .aq-e:empty{display:none}' +
            '@media (prefers-reduced-motion: reduce){#art-sheet .anyq{animation:none}}' +
            // V101.306 🌞 Ask Nika about this article
            '#art-sheet .bm.nkb{background:linear-gradient(135deg,#fff7ed,#fde68a)}#art-sheet .bm.nkb[aria-pressed="true"]{box-shadow:inset 0 0 0 2px #f59e0b}' +
            '#art-sheet .art-nk{margin:4px 0 8px;padding:10px 0 0;border-top:1.5px dashed #fcd34d}#art-sheet .nk-c{display:flex;flex-wrap:wrap;gap:6px}' +
            '#art-sheet .nk-c button{min-height:0;margin:0;width:auto;border:1px solid #fcd34d;background:#fffbeb;color:#92400e;font:700 12.5px/1 Kanit,sans-serif;padding:8px 11px;border-radius:999px;cursor:pointer}' +
            '#art-sheet .nk-c button[aria-pressed="true"]{background:#f59e0b;border-color:#f59e0b;color:#fff}#art-sheet .nk-c button:disabled{opacity:.6;cursor:default}' +
            '#art-sheet .nk-i{display:flex;gap:6px;margin-top:8px}#art-sheet .nk-i input{flex:1;min-width:0;margin:0;border:1.5px solid #e2e8f0;border-radius:12px;padding:9px 11px;font:400 16px/1.3 Kanit,sans-serif}' +
            '#art-sheet .nk-i button{width:auto;min-height:0;margin:0;border:0;border-radius:12px;background:#4361ee;color:#fff;padding:0 14px;font:800 13px/1 Kanit,sans-serif;cursor:pointer}' +
            '#art-sheet .nk-a{font:400 13.5px/1.55 Kanit,sans-serif;color:#334155;margin-top:8px}#art-sheet .nk-a ul{margin:0;padding-left:18px}#art-sheet .nk-a p{margin:0 0 4px}' +
            '#art-sheet .nk-w,#art-sheet .nk-n{margin:8px 0 0;font:600 13px/1.4 Kanit,sans-serif;color:#64748b}#art-sheet .nk-l{margin:6px 0 0;text-align:right;font:400 11.5px/1 Kanit,sans-serif;color:#94a3b8}' +
            '@media (max-width:400px){#art-sheet .foot{gap:4px}#art-sheet .bm{width:32px}#art-sheet .more{padding:12px 0}#art-sheet .ok{padding:0 12px}}' +

            '.art-hist .art-md{font-size:13.5px;line-height:1.55}.art-hist .art-md p{margin:0 0 6px}.art-hist .art-md.art-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:6;overflow:hidden}' +
            '.art-hist .art-more-h{display:inline-block;width:auto;min-height:0;margin:2px 0 6px;padding:2px 0;border:0;background:none;box-shadow:none;color:#4361ee;font:700 13px/1 Kanit,sans-serif;cursor:pointer}.art-hist .art-more-h[hidden]{display:none}' +
            '@media (min-width:1100px){.art-hist .art-md{columns:2;column-gap:36px}.art-hist .art-md.art-clamp{display:block;-webkit-line-clamp:unset;overflow:visible}.art-hist .art-more-h{display:none}}' +
            '.hl-pill.art-ok{background:#dcfce7;color:#166534}.hl-pill.art-new{background:#eef2ff;color:#4361ee}.art-hist{padding:0 0 6px}.hl-row .art-tfl{display:none}.hl-row[aria-expanded="true"] .art-tfl{display:inline-block;vertical-align:middle;margin:0 0 0 8px;padding:3px 8px;min-height:0;width:auto;border:1px solid #c7d2fe;background:#eef2ff;color:#4361ee;font:800 11px/1.2 Kanit,sans-serif;border-radius:999px;box-shadow:none;cursor:pointer}.art-sh{display:inline-flex;align-items:center;gap:5px;margin-left:6px;vertical-align:middle}.art-sh i{font-style:normal;color:#cbd5e1;margin-right:1px}.art-src .art-sh button{display:inline-flex;align-items:center;justify-content:center;height:24px;min-width:24px;min-height:0;margin:0;padding:0 6px;border-radius:7px;border:0;box-shadow:none;color:#fff;font:900 10px/1 Arial,sans-serif;text-decoration:none;cursor:pointer}.art-src .art-sh .ln{background:#06c755}.art-src .art-sh .fb{background:#1877f2;font-size:15px;padding:0 8px}.art-src .art-sh button.on{background:linear-gradient(135deg,#0461c4,#3ea6ef);box-shadow:0 0 0 2px #d0ebfb}.art-hist .art-links{margin:8px 0 2px}' +
            // V101.213: the intern's 💬 questions under the article in History, the admin's reply as a green bubble
            '.art-qa{margin:10px 0 2px;padding-top:8px;border-top:1px dashed #e2e8f0;font:400 13px/1.45 Kanit,sans-serif;color:#334155}.art-qa>b{display:block;font-weight:800;font-size:12.5px;color:#4338ca;margin-bottom:4px}' +
            '.art-qa .q{padding:5px 0;overflow-wrap:anywhere}.art-qa .q small{display:block;color:#94a3b8;font-size:11.5px}.art-qa .r{margin-top:4px;background:#ecfdf5;color:#065f46;border-radius:4px 12px 12px 12px;padding:5px 10px;white-space:pre-wrap}';
        // V101.302 🎬 the clip view (chat story)
        s.textContent += '#art-sheet .clp-in{display:flex;flex-direction:column;height:min(68vh,560px);margin:-4px -8px 0;background:#e9edf5;border-radius:16px;padding:10px 10px 8px;box-sizing:border-box;position:relative}' +
            '#art-sheet .clp-top{display:flex;align-items:center;gap:8px}#art-sheet .clp-t{flex:1;min-width:0;font:800 13px/1.3 Kanit,sans-serif;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '#art-sheet .clp-snd{flex:none;width:auto;min-height:0;margin:0;padding:6px 11px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font:800 12px/1 Kanit,sans-serif;cursor:pointer}#art-sheet .clp-snd[aria-pressed="true"]{background:#4361ee}' +
            '#art-sheet .clp-prog{display:flex;gap:3px;margin:8px 2px 6px}#art-sheet .clp-prog i{flex:1;height:3px;border-radius:2px;background:#cbd5e1}#art-sheet .clp-prog i.on{background:#4361ee}' +
            '#art-sheet .clp-chat{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:7px;overflow:hidden;cursor:pointer}' +
            '#art-sheet .clp-who{font:800 11px/1 Kanit,sans-serif;color:#64748b;margin:4px 6px 0}#art-sheet .clp-who.rx{align-self:flex-end}' +
            '#art-sheet .clp-m{max-width:82%;padding:9px 13px;border-radius:16px;font:600 15px/1.4 Kanit,sans-serif;overflow-wrap:anywhere}' +
            '#art-sheet .clp-m.q{align-self:flex-start;background:#fff;color:#1e293b;border-bottom-left-radius:4px}#art-sheet .clp-m.rx{align-self:flex-end;background:#4361ee;color:#fff;border-bottom-right-radius:4px}' +
            '#art-sheet .clp-key{align-self:center;max-width:90%;background:#fef3c7;color:#92400e;border-radius:999px;padding:7px 14px;font:800 14px/1.35 Kanit,sans-serif;text-align:center}#art-sheet .clp-in .fresh{animation:clpIn .28s ease-out}' +
            '#art-sheet .clp-m.now,#art-sheet .clp-key.now{box-shadow:0 0 0 2px #facc15}@keyframes clpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
            '#art-sheet .clp-read{align-self:center;width:auto;min-height:0;margin:8px 0 0;padding:8px 16px;border:0;border-radius:999px;background:#fff;color:#4361ee;font:800 13px/1 Kanit,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.12)}' +
            '#art-sheet .clp-read.end{background:#4361ee;color:#fff;animation:clpNudge 1.4s ease-in-out infinite}@keyframes clpNudge{50%{transform:translateY(-4px)}}' +
            '@media (prefers-reduced-motion: reduce){#art-sheet .clp-in .fresh,#art-sheet .clp-read.end{animation:none}}';
        document.head.appendChild(s);
    }
    function busy() {
        if (document.getElementById('art-back') || document.getElementById('fbr-back') || document.getElementById('cm-back') || document.getElementById('ord-back')) return true;
        var g = document.getElementById('internGuideOverlay'); if (g && g.classList.contains('open')) return true;
        return Array.prototype.some.call(document.querySelectorAll('.modal'), function (m) { var d = m.style.display; return d === 'flex' || d === 'block' || m.classList.contains('open') || m.classList.contains('show'); });
    }
    // V101.264: the page the article came from (articles/{id}.source), opened outside the app
    function srcHtml(a, lang) {
        var u = a.source && a.source.url;
        if (!/^https?:\/\//i.test(u || '')) return '';
        return '<div class="art-src">' + (T[lang] || T.en).source + ': <button type="button" onclick="internArticles.openSrc(' + esc(JSON.stringify(u)) + ')">' + esc(a.source.site || u) + ' ↗</button></div>';
    }
    function linksHtml(a) {
        // V101.301 (owner): a Codex entry named like the article itself just repeated the title on a pill — call it by its kind then
        var heads = ['en', 'th', 'ko'].map(function (l) { return String((a.title || {})[l] || '').trim().toLowerCase(); }).filter(Boolean);
        var name = function (n, kind) { n = String(n || '').trim(); return !n || heads.indexOf(n.toLowerCase()) >= 0 ? kind : n; };
        // V101.196: the Disease Codex entry drafted from this article (articles/{id}.dx.publishedId, set when the admin approves it)
        var dx = a.dx && a.dx.publishedId ? '<button type="button" class="art-link codex" onclick="internArticles.openDx(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(a.dx.publishedId)) + ')">🩺 ' + esc(name(a.dx.name, 'Disease Codex')) + '</button>' : '';
        // V101.200: the Drug Codex entry drafted from this article (articles/{id}.dc.publishedId) — same handler as a ＋ Codex link
        var dc = a.dc && a.dc.publishedId ? '<button type="button" class="art-link codex" onclick="internArticles.openCodex(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(a.dc.publishedId)) + ')">💊 ' + esc(name(a.dc.name, 'Drug Codex')) + '</button>' : '';
        return ((a.links || []).length || dx || dc) ? '<div class="art-links">' + dx + dc + (a.links || []).map(function (l) {
            return l.kind === 'quiz' ? '<button type="button" class="art-link" onclick="internArticles.openQuiz(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(l.id)) + ')">🧪 ' + esc(l.label) + ' <b>🪙 +1</b></button>'
                : l.kind === 'disease' ? '<button type="button" class="art-link codex" onclick="internArticles.openDx(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(l.id)) + ')">🩺 ' + esc(name(l.label, 'Disease Codex')) + '</button>'   // V101.197: ＋ Disease link
                : '<button type="button" class="art-link codex" onclick="internArticles.openCodex(' + esc(JSON.stringify(a.id)) + ',' + esc(JSON.stringify(l.id)) + ')">💊 ' + esc(name(l.label, 'Drug Codex')) + '</button>';
        }).join('') + '</div>' : '';
    }
    // V101.269 (owner pick A, mockups/article-history-link-mockup.html): 📰 in the footer = every article in History; the badge = how many
    function histBtn(t) {
        var n = historyItems(S.list, me(), Date.now(), S.qs).length;
        return '<button type="button" class="bm hist" onclick="internArticles.toHistory()" title="' + t.hist + '" aria-label="' + t.hist + ' (' + n + ')">📰' + (n > 1 ? '<i>' + n + '</i>' : '') + '</button>';
    }
    // the clip in the reading language, else EN, else any; null when the article has none
    function clipFor(a, L) {
        var c = (a && a.clip) || {}, ok = function (k) { return Array.isArray(c[k]) && c[k].some(function (x) { return x && String(x.t || '').trim(); }); };
        var lang = ok(L) ? L : ok('en') ? 'en' : ['th', 'ko'].filter(ok)[0];
        return lang ? { lang: lang, lines: c[lang].filter(function (x) { return x && String(x.t || '').trim(); }).slice(0, 12), i: 0, sound: false, done: false } : null;
    }
    function clipStopSpeak() { clearTimeout(S.clipT); S.clipN = (S.clipN || 0) + 1; if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* nothing speaking */ } } }
    function renderClip(sh) {
        var k = S.clip, w = CLIPT[k.lang] || CLIPT.en, a = S.cur.a, tx = textOf(a, k.lang);
        sh.innerHTML = '<div class="clp-in" id="art-clip"><div class="clp-top"><span class="clp-t" id="art-title">' + esc((a.cover && a.cover.emoji) || '📰') + ' ' + esc(tx.title) + '</span>' +
            '<button type="button" class="clp-snd" onclick="internArticles.clipSound()" aria-pressed="' + k.sound + '" aria-label="' + esc(w.sound) + '">' + (k.sound ? '🔊' : '🔇 ' + esc(w.sound)) + '</button>' +
            '<button type="button" class="x" onclick="internArticles.clipSkip()" aria-label="' + esc(w.skip) + '" title="' + esc(w.skip) + '">✕</button></div>' +
            '<div class="clp-prog">' + k.lines.map(function (x, i) { return '<i' + (i <= k.i ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' +
            '<div class="clp-chat" onclick="internArticles.clipSound()">' + k.lines.slice(0, k.i + 1).map(function (x, i, all) {
                var now = i === k.i && !k.done ? ' now fresh' : '';
                if (x.w === 'key') return '<div class="clp-key' + now + '">💡 ' + esc(x.t) + '</div>';
                var w2 = x.w === 'q' ? 'q' : 'rx';
                return (i === 0 || all[i - 1].w !== x.w ? '<span class="clp-who ' + w2 + '">' + (w2 === 'q' ? '🙋 ' + esc(w.q) : '🧑‍⚕️ ' + esc(w.rx)) + '</span>' : '') + '<div class="clp-m ' + w2 + now + '">' + esc(x.t) + '</div>';
            }).join('') + '</div>' +
            '<button type="button" class="clp-read' + (k.done ? ' end' : '') + '" onclick="internArticles.clipSkip()">⌃ ' + esc(k.done ? w.skip : w.read) + '</button></div>';
        var el = document.getElementById('art-clip'), y0 = null;
        if (el) {
            el.addEventListener('touchstart', function (e) { y0 = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
            el.addEventListener('touchend', function (e) { var t = e.changedTouches && e.changedTouches[0]; if (y0 != null && t && y0 - t.clientY > 40) api.clipSkip(); y0 = null; }, { passive: true });
        }
    }
    // one line at a time: the voice's end (sound on) or a reading-time timer (muted) moves on; the last line stays with "⌃ Read the article"
    function clipStep() {
        var k = S.clip; if (!k) return;
        clipStopSpeak(); var n = S.clipN;
        render();
        var x = k.lines[k.i]; if (!x) return;
        var fired = false, next = function () { if (fired || S.clip !== k || S.clipN !== n) return; fired = true; clearTimeout(S.clipT); if (k.i < k.lines.length - 1) { k.i++; clipStep(); } else { k.done = true; render(); } };
        var ms = 1100 + String(x.t).length * 60, synth = window.speechSynthesis;
        if (k.sound && synth && window.SpeechSynthesisUtterance) {
            try {
                var u = new SpeechSynthesisUtterance(x.t); u.lang = { en: 'en-US', th: 'th-TH', ko: 'ko-KR' }[k.lang] || 'en-US'; u.pitch = x.w === 'q' ? 1.2 : 0.95;
                u.onend = function () { S.clipT = setTimeout(next, 250); }; u.onerror = next;
                synth.speak(u); S.clipT = setTimeout(next, ms + 5000); return;
            } catch (e) { /* no voice: timed */ }
        }
        S.clipT = setTimeout(next, ms);
    }
    // V101.306 (owner pick 1A): 🌞 in the footer asks Nika about THIS article (askNika with articleId = searched in it only), answered in the sheet
    var NKT = {
        en: { nk: 'Ask Nika about this article', sum: '📝 Summary', key: '🎯 Key points', own: '❓ Ask', ph: 'Ask about this article', go: 'Ask', wait: 'Reading the article…',
            none: 'Not in this article', left: function (n) { return n + ' questions left today'; }, pause: 'Nika is paused during your quiz', limit: "That's all for today — back tomorrow",
            busy: 'Nika is busy — try again in a minute', fail: 'Could not reach Nika. Try again.',
            qSum: function (x) { return 'Summarize "' + x + '" in 3 short points'; }, qKey: function (x) { return '"' + x + '": what should I remember or monitor?'; } },
        th: { nk: 'ถาม Nika เรื่องบทความนี้', sum: '📝 สรุป 3 บรรทัด', key: '🎯 ต้องจำอะไร', own: '❓ ถามเอง', ph: 'ถามเรื่องในบทความนี้', go: 'ถาม', wait: 'กำลังอ่านบทความ…',
            none: 'ไม่มีในบทความนี้', left: function (n) { return 'เหลือ ' + n + ' คำถามวันนี้'; }, pause: 'Nika พักระหว่างทำ Quiz', limit: 'วันนี้ครบแล้ว พรุ่งนี้กลับมาใหม่',
            busy: 'Nika ไม่ว่าง ลองใหม่อีกสักครู่', fail: 'ติดต่อ Nika ไม่ได้ ลองใหม่อีกครั้ง',
            qSum: function (x) { return 'สรุป "' + x + '" เป็น 3 ข้อสั้นๆ'; }, qKey: function (x) { return '"' + x + '": ต้องจำหรือ monitor อะไรบ้าง'; } },
        ko: { nk: '이 기사에 대해 Nika에게 질문', sum: '📝 3줄 요약', key: '🎯 핵심', own: '❓ 질문', ph: '이 기사에 대해 질문', go: '질문', wait: '기사를 읽는 중…',
            none: '이 기사에는 없어요', left: function (n) { return '오늘 ' + n + '개 남음'; }, pause: '퀴즈 중에는 Nika가 쉬어요', limit: '오늘은 끝 — 내일 다시',
            busy: 'Nika가 바빠요. 잠시 후 다시', fail: 'Nika에 연결하지 못했어요. 다시 시도하세요.',
            qSum: function (x) { return '"' + x + '"을(를) 3가지로 요약'; }, qKey: function (x) { return '"' + x + '": 꼭 기억하거나 모니터링할 것은?'; } }
    };
    function nkBold(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
    function nkAnswer(text) {
        var html = '', open = false;
        String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) {
            var m = /^[*\-•]\s+(.*)$/.exec(l);
            if (m && !open) { html += '<ul>'; open = true; }
            if (!m && open) { html += '</ul>'; open = false; }
            html += m ? '<li>' + nkBold(m[1]) + '</li>' : '<p>' + nkBold(l) + '</p>';
        });
        return html + (open ? '</ul>' : '');
    }
    function nkHtml() {
        var k = S.nk, w = NKT[S.lang] || NKT.en, r = k.r || {}, out = '';
        if (k.busy) out = '<p class="nk-w" role="status">' + esc(w.wait) + '</p>';
        else if (k.err) out = '<p class="nk-n">⚠️ ' + esc(w.fail) + '</p>';
        else if (r.paused) out = '<p class="nk-n">⏸ ' + esc(w.pause) + '</p>';
        else if (r.limit) out = '<p class="nk-n">🌙 ' + esc(w.limit) + '</p>';
        else if (r.busy) out = '<p class="nk-n">☕ ' + esc(w.busy) + '</p>';
        else if (r.notFound) out = '<p class="nk-n">❔ ' + esc(w.none) + '</p>';
        else if (r.answer) out = '<div class="nk-a">' + nkAnswer(r.answer) + '</div>';
        return '<div class="art-nk" id="art-nk"><div class="nk-c" role="group" aria-label="' + esc(w.nk) + '">' + ['sum', 'key', 'own'].map(function (x) {
            return '<button type="button" data-k="' + x + '" aria-pressed="' + (k.k === x) + '"' + (k.busy ? ' disabled' : '') + ' onclick="internArticles.nkAsk(\'' + x + '\')">' + esc(w[x]) + '</button>';
        }).join('') + '</div>' +
            (k.k === 'own' ? '<div class="nk-i"><input id="art-nk-q" maxlength="250" placeholder="' + esc(w.ph) + '" aria-label="' + esc(w.ph) + '" value="' + esc(k.text || '') + '" oninput="internArticles.nkType(this.value)" onkeydown="if(event.key===\'Enter\')internArticles.nkSend()"><button type="button" onclick="internArticles.nkSend()"' + (k.busy ? ' disabled' : '') + '>' + esc(w.go) + '</button></div>' : '') +
            out + (k.left != null ? '<p class="nk-l">' + esc(w.left(k.left)) + '</p>' : '') + '</div>';
    }
    function nkCall(question) {
        var c = S.cur, k = S.nk; if (!c || !k || k.busy) return Promise.resolve(false);
        if (typeof requireRegistered === 'function' && !requireRegistered()) return Promise.resolve(false);
        k.busy = true; k.err = false; k.r = null; render();
        var ready = typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : Promise.resolve();
        return Promise.resolve(ready).then(function () {
            return firebase.functions().httpsCallable('askNika')({ question: question.slice(0, 300), articleId: c.a.id });
        }).then(function (res) { var r = (res && res.data) || {}; k.r = r; if (r.left != null) k.left = r.left; return true; })
            .catch(function (e) { console.warn('article nika:', e && e.message); k.err = true; return false; })
            .then(function (ok) { k.busy = false; if (S.nk === k && S.cur === c) render(); return ok; });
    }
    function md(text) { return typeof window.renderMd === 'function' ? window.renderMd(text) : esc(text).replace(/\n/g, '<br>'); }
    function render() {
        var c = S.cur, a = c.a, tx = textOf(a, S.lang), t = T[S.lang] || T.en, have = langs(a), saved = !!((me().articleSeen || {})[a.id] || {}).saved;
        var sh = document.getElementById('art-sheet'); if (!sh) return;
        if (S.clip) return renderClip(sh);
        if (S.ask) return renderAsk(sh, t);
        var info = (c.kind === 'rerun' ? '🔁 ' + t.rerun : t.kicker) + ' · ' + (a.readMin || 1) + ' ' + t.min;
        sh.innerHTML = '<div class="band"><span class="cov" title="' + esc(info) + '" aria-label="' + esc(info) + '">' + esc((a.cover && a.cover.emoji) || '📰') + (c.kind === 'rerun' ? '<small>🔁</small>' : '') + '</span>' +
            (have.length > 1 ? langBtn(have, tx.lang, 'internArticles.lang()') : '') +
            '<button type="button" class="x" onclick="internArticles.close(\'x\')" aria-label="' + t.close + '">✕</button></div>' +
            '<h3 id="art-title">' + esc(tx.title) + '</h3><div class="art-md' + (S.more ? '' : ' clamp') + '" id="art-text">' + md(tx.body) + '</div>' +
            srcHtml(a, S.lang) + linksHtml(a) + (S.nk ? nkHtml() : '') +
            '<div class="foot"><button type="button" class="bm" onclick="internArticles.save()" aria-pressed="' + saved + '" title="' + (saved ? t.saved : t.save) + '" aria-label="' + (saved ? t.saved : t.save) + '">🔖</button>' +
            '<button type="button" class="bm mute" onclick="internArticles.mute()" title="' + t.mute + '" aria-label="' + t.mute + '">🔕</button>' +
            (S.got ? '' : histBtn(t)) +   // V101.269: not in the 7 s ✓ Read · 💬 moment (the sheet closes itself; that row is full)
            '<button type="button" class="bm nkb" onclick="internArticles.nika()" aria-pressed="' + !!S.nk + '" title="' + esc((NKT[S.lang] || NKT.en).nk) + '" aria-label="' + esc((NKT[S.lang] || NKT.en).nk) + '">🌞</button>' +
            '<button type="button" class="more" id="art-more" onclick="internArticles.toggleMore()">' + (S.more ? t.less + ' ▴' : t.more + ' ▾') + '</button>' +
            (S.got ? '<span class="rd">✓ ' + t.read + '</span><button type="button" class="anyq" onclick="internArticles.anyQ()">💬 ' + t.anyq + '</button>'
                : '<button type="button" class="ok" onclick="internArticles.gotIt()">👍 ' + t.got + '</button>') + '</div>';
        // a short body needs no "Read more"
        var el = document.getElementById('art-text'), mb = document.getElementById('art-more');
        if (el && mb && !S.more && el.scrollHeight <= el.clientHeight + 2) mb.style.visibility = 'hidden';
    }
    function renderAsk(sh, t) {
        var q = S.ask, ph = { ask: t.phAsk, wrong: t.phWrong, add: t.phAdd }[q.kind];
        sh.innerHTML = '<div class="aq-h"><b id="art-title">💬 ' + t.anyq + '</b>' + flagBtn(S.lang) + '<button type="button" class="x" onclick="internArticles.close(\'ok\')" aria-label="' + t.close + '">✕</button></div>' +
            '<p class="aq-sub">' + t.askSub + '</p>' +
            '<div class="aq-k" role="group">' + KINDS.map(function (k) { return '<button type="button" data-k="' + k[0] + '" aria-pressed="' + (q.kind === k[0]) + '" onclick="internArticles.askKind(\'' + k[0] + '\')">' + k[1] + ' ' + t[k[0]] + '</button>'; }).join('') + '</div>' +
            '<div class="aq-t"><textarea id="art-q" maxlength="' + QMAX + '" rows="3" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '"></textarea><span class="aq-n" id="art-qn"></span></div>' +
            '<div class="aq-f"><span>' + t.hint + '</span><button type="button" class="anyq" id="art-qs" onclick="internArticles.askSend()">💬 ' + (q.busy ? t.sending : t.send) + '</button></div>' +
            '<p class="aq-e" id="art-qe" role="alert">' + (q.err ? esc(t.fail) : '') + '</p>';
        var ta = document.getElementById('art-q');
        ta.value = q.text;
        ta.oninput = function () { q.text = ta.value; q.err = false; askCount(); var e = document.getElementById('art-qe'); if (e) e.textContent = ''; };
        askCount();
        ta.focus();
    }
    function askCount() {
        var q = S.ask, n = document.getElementById('art-qn'), b = document.getElementById('art-qs'); if (!q) return;
        if (n) n.textContent = q.text.length + ' / ' + QMAX;
        if (b) b.disabled = q.busy || !q.text.trim();
    }
    // 👍 Got it: read now; the button becomes 💬 Any Q? for 7 s, then the sheet closes by itself (unless the form was opened)
    function gotIt() {
        var c = S.cur; if (!c || S.got) return;
        S.got = true;
        markRead(c.a.id, 'ok');
        render();
        var b = document.querySelector('#art-sheet .anyq'); if (b) b.focus();
        S.gotTimer = setTimeout(function () { if (S.cur === c && !S.ask) close('ok'); }, ANYQ_MS);
    }
    function anyQ() {
        if (!S.cur) return;
        clearTimeout(S.gotTimer);
        S.ask = { kind: 'ask', text: '', busy: false, err: false };
        render();
    }
    function askSend() {
        var c = S.cur, q = S.ask, text = q ? q.text.trim() : '';
        if (!c || !q || q.busy || !text) return Promise.resolve(false);
        if (typeof requireRegistered === 'function' && !requireRegistered()) return Promise.resolve(false);
        q.busy = true; q.err = false; render();
        var authReady = typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : Promise.resolve(window.firebase && firebase.auth && firebase.auth().currentUser);
        return Promise.resolve(authReady).then(function (u) {
            if (!u || !window.db || blocked()) throw new Error('not signed in');
            return window.db.collection('article_questions').add({
                articleId: c.a.id, articleTitle: String(textOf(c.a, 'en').title || '').slice(0, 300), kind: q.kind, text: text.slice(0, QMAX), lang: S.lang,
                authUid: u.uid, userId: uid(), status: 'open', createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }).then(function () {
            if (S.cur === c) close('ok');
            if (typeof window.completeMoment === 'function') window.completeMoment();
            else if (typeof showToast === 'function') showToast('✓ Complete');
            return true;
        }).catch(function (e) {
            console.warn('article question:', e && e.message);
            if (S.ask === q) { q.busy = false; q.err = true; render(); }
            return false;
        });
    }
    function show(c) {
        css();
        S.cur = c; S.lang = S.cl; S.more = false; S.got = false; S.ask = null; S.nk = null; S.clip = clipFor(c.a, S.cl);
        var back = document.createElement('div'); back.id = 'art-back'; back.onclick = function () { close('x'); };
        var sh = document.createElement('div'); sh.id = 'art-sheet'; sh.className = 'lang-no-toggle'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-labelledby', 'art-title');
        document.body.appendChild(back); document.body.appendChild(sh);
        if (S.clip) clipStep(); else render();
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
        S.cur = null; clearTimeout(S.gotTimer); S.got = false; S.ask = null; S.nk = null; if (S.clip) { S.clip = null; clipStopSpeak(); }
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
        if (window.owedRemind && owedRemind.holds()) return;   // V101.228: the 'still to do' sheet has today's popup slot — this article is a row in it
        if (busy()) { if (S.tries++ < 30) setTimeout(later, 2000); return; }
        show(c);
    }

    // ---- History
    function sig() { return JSON.stringify(historyItems(S.list, me(), Date.now(), S.qs).map(function (i) { return i.id + i.metadata.state + i.metadata.saved + i.metadata.qa.map(function (q) { return q.status + q.reply.length; }).join(','); })); }
    // V101.213: the intern's own questions (the rules let them read only these, so the query must say authUid == me)
    function listenMine() {
        if (S.qsUnsub || blocked() || !window.db) return;
        var ready = typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : Promise.resolve(window.firebase && firebase.auth && firebase.auth().currentUser);
        Promise.resolve(ready).then(function (u) {
            if (!u || S.qsUnsub) return;
            S.qsUnsub = window.db.collection('article_questions').where('authUid', '==', u.uid).onSnapshot(function (snap) {
                S.qs = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
                refreshHistory(false);
            }, function (e) { console.warn('article questions:', e && e.message); });
        }).catch(function (e) { console.warn('article questions:', e && e.message); });
    }
    var QK = { ask: '❓', wrong: '⚠️', add: '💡' };
    function qaHtml(s) {
        var qa = (s.metadata || {}).qa || []; if (!qa.length) return '';
        var L = { en: ['Your questions', 'Waiting for a reply', 'Closed'], th: ['คำถามของคุณ', 'รอคำตอบ', 'ปิดแล้ว'], ko: ['내 질문', '답변 대기 중', '닫힘'] }[uiLang()];
        return '<div class="art-qa"><b>💬 ' + L[0] + '</b>' + qa.map(function (q) {
            return '<div class="q"><span>' + (QK[q.kind] || '❓') + ' ' + esc(q.text) + '</span>' + (q.status === 'answered' ? '<div class="r">↩ ' + esc(q.reply) + '</div>' : '<small>' + (q.status === 'closed' ? L[2] : '⏳ ' + L[1]) + '</small>') + '</div>';
        }).join('') + '</div>';
    }
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
    // V101.206 (owner's pick "2 · one point = the icon disc"): in History an article's icon disc is its ONE control — green ring = read, a small
    // reading-time badge, tap = read it aloud with the browser's own voice (nothing is sent anywhere); while it speaks the ring fills, bars move in the
    // middle and the badge counts down. Tapping the row still opens the article in place (the disc is a <button>, which the row handlers skip).
    function plain(md) { return String(md || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>`~|]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function secs(text) { var th = (text.match(/[\u0E00-\u0E7F]/g) || []).length, w = (text.replace(/[\u0E00-\u0E7F]/g, ' ').match(/\S+/g) || []).length; return Math.max(30, Math.round((w + th / 5) / 160 * 60)); }
    function fmt(n) { return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }
    function discCss() {
        if (document.getElementById('art-disc-css')) return;
        var s = document.createElement('style'); s.id = 'art-disc-css';
        s.textContent = '.history-compact .hl-disc.art-d{position:relative;padding:0;margin:0;min-height:0;font:inherit;cursor:pointer;background:#e0e7ff;border:1px solid #c7d2fe;overflow:visible}' +
            '.hl-disc.art-d.art-read{border:2.5px solid #22c55e;background:#f0fdf4}' +
            '.hl-disc.art-d.art-new::after{content:"";position:absolute;right:-2px;top:-2px;width:10px;height:10px;border-radius:50%;background:#6366f1;border:2px solid #fff}' +
            '.hl-disc.art-d .art-tm{position:absolute;right:-10px;bottom:-6px;font-style:normal;font-size:.58rem;font-weight:800;color:#64748b;background:#fff;border:1.5px solid #cbd5e1;border-radius:999px;padding:0 5px;line-height:1.5;white-space:nowrap}' +
            '.hl-disc.art-d.art-read .art-tm{border-color:#22c55e;color:#15803d}' +
            '.hl-disc.art-d .art-bars{display:none;align-items:flex-end;gap:2px;height:14px;position:relative}.hl-disc.art-d .art-bars i{width:3px;height:4px;border-radius:2px;background:#16a34a;animation:artBar 1s ease-in-out infinite}' +
            '.hl-disc.art-d .art-bars i:nth-child(2){animation-delay:.15s}.hl-disc.art-d .art-bars i:nth-child(3){animation-delay:.3s}.hl-disc.art-d .art-bars i:nth-child(4){animation-delay:.45s}' +
            '.hl-disc.art-d.playing{border:none;background:conic-gradient(#22c55e calc(var(--p,0) * 1%),#dcfce7 0);animation:artPulse 1.6s ease-out infinite}' +
            '.hl-disc.art-d.playing::before{content:"";position:absolute;inset:3px;border-radius:50%;background:#f0fdf4}.hl-disc.art-d.playing::after{display:none}' +
            '.hl-disc.art-d.playing .g{display:none}.hl-disc.art-d.playing .art-bars{display:inline-flex}.hl-disc.art-d.playing .art-tm{border-color:#22c55e;color:#15803d}' +
            '@keyframes artBar{0%,100%{height:4px}50%{height:14px}}@keyframes artPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%,100%{box-shadow:0 0 0 9px rgba(34,197,94,0)}}' +
            '@media (prefers-reduced-motion: reduce){.hl-disc.art-d.playing,.hl-disc.art-d .art-bars i{animation:none}.hl-disc.art-d .art-bars i{height:10px}}';
        document.head.appendChild(s);
    }
    function discHtml(s) {
        discCss();
        var m = s.metadata || {}, a = find(m.articleId), st = m.state === 'read' ? 'read' : m.state === 'closed' ? 'closed' : 'new';
        var tx = a ? textOf(a, S.cl) : null, sec = tx ? secs(plain(tx.title + '. ' + tx.body)) : 0, mn = sec ? Math.max(1, Math.round(sec / 60)) : 0;
        var T = { en: 'Listen', th: 'ฟัง', ko: '듣기' }[uiLang()];
        return '<span class="hl-lead"><button type="button" class="hl-disc art-d art-' + st + '" data-art-listen="' + esc(m.articleId || '') + '" aria-pressed="false" aria-label="' + T + (mn ? ' · ' + mn + ' min' : '') + '" title="' + T + '">'
            + '<span class="g">' + esc(m.emoji || '📰') + '</span><span class="art-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + (mn ? '<i class="art-tm" data-t="' + mn + 'm">' + mn + 'm</i>' : '') + '</button></span>';
    }
    var LS = { btn: null, tok: null };
    function stopListen() {
        if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* nothing speaking */ } }
        var b = LS.btn; LS = { btn: null, tok: null };
        if (!b) return;
        b.classList.remove('playing'); b.setAttribute('aria-pressed', 'false'); b.style.removeProperty('--p');
        var t = b.querySelector('.art-tm'); if (t && t.dataset.t) t.textContent = t.dataset.t;
    }
    function listen(btn) {
        var synth = window.speechSynthesis;
        if (!btn || !synth || typeof SpeechSynthesisUtterance !== 'function') return;
        var was = LS.btn === btn; stopListen(); if (was) return;
        var id = btn.getAttribute('data-art-listen'), a = find(id); if (!a) return;
        var tx = textOf(a, S.cl), text = plain(tx.title + '. ' + tx.body); if (!text) return;
        var pieces = text.match(/[^.!?。\n]+[.!?。]?\s*/g) || [text], chunks = [], cur = '';
        pieces.forEach(function (p) { if ((cur + p).length > 220 && cur) { chunks.push(cur); cur = p; } else cur += p; });
        if (cur) chunks.push(cur);
        var total = text.length, total_s = secs(text), done = 0, tok = {}, lang = { en: 'en-US', th: 'th-TH', ko: 'ko-KR' }[tx.lang] || 'en-US';
        var voice = (synth.getVoices() || []).filter(function (v) { return String(v.lang || '').toLowerCase().indexOf(tx.lang) === 0; })[0];
        LS = { btn: btn, tok: tok };
        btn.classList.add('playing'); btn.setAttribute('aria-pressed', 'true');
        function paint(n) {
            if (LS.tok !== tok) return;
            if (!document.contains(btn)) { stopListen(); return; }   // the row was re-drawn
            var p = Math.min(100, Math.round(n / total * 100)); btn.style.setProperty('--p', p);
            var t = btn.querySelector('.art-tm'); if (t) t.textContent = fmt(Math.max(0, Math.round(total_s * (1 - p / 100))));
        }
        paint(0);
        chunks.forEach(function (c, i) {
            var u = new SpeechSynthesisUtterance(c); u.lang = lang; if (voice) u.voice = voice;
            u.onboundary = function (e) { paint(done + (e.charIndex || 0)); };
            u.onend = function () {
                if (LS.tok !== tok) return;
                done += c.length; paint(done);
                if (i === chunks.length - 1) {   // heard to the end = read
                    var b = btn; stopListen();
                    markRead(id, 'hist').then(function () { b.classList.remove('art-new', 'art-closed'); b.classList.add('art-read'); });
                }
            };
            u.onerror = function () { if (LS.tok === tok) stopListen(); };
            synth.speak(u);
        });
    }
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-art-listen]'); if (b) { e.stopPropagation(); listen(b); } });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopListen(); });
    function detailHtml(s) {
        var a = find((s.metadata || {}).articleId); if (!a) return '';
        css();
        var tx = textOf(a, S.cl);
        // V101.291 (owner pick C): the language pill moved into the title (flagHtml, history-lean.js); · 📤 LINE f at the end of the Source line
        var src = srcHtml(a, uiLang()), sh = shareHtml(a);
        src = src ? src.replace(/<\/div>$/, sh + '</div>') : '<div class="art-src">' + sh + '</div>';
        // V101.270: the first 6 lines + Read more (hidden when it all fits); ≥1100 px the whole body in two columns
        var t = T[uiLang()] || T.en;
        return '<div class="art-hist lang-no-toggle" data-art="' + esc(a.id) + '"><div class="art-md art-clamp">' + md(tx.body) + '</div><button type="button" class="art-more-h" onclick="internArticles.histMore(this)">' + t.more + ' ▾</button>' + src + linksHtml(a) + qaHtml(s) + '</div>';
    }
    // V101.270: Read more only when the 6 lines hide something (the row's toggle has already shown the detail by now)
    function fitMore(box) {
        var m = box.querySelector('.art-hist .art-md'), b = box.querySelector('.art-hist .art-more-h');
        if (m && b) b.hidden = m.classList.contains('art-clamp') && m.scrollHeight <= m.clientHeight + 2;
    }
    function histMore(btn) {
        var box = btn.closest('.art-hist'), m = box && box.querySelector('.art-md'), t = T[uiLang()] || T.en; if (!m) return;
        var open = m.classList.toggle('art-clamp') === false;
        btn.textContent = open ? t.less + ' ▴' : t.more + ' ▾';
    }
    function histLang(btn, l) {
        var row = btn.closest('.hl-row'), box = row && row.querySelector('.art-hist'), a = box && find(box.dataset.art); if (!a) return;
        var have = langs(a), tx = textOf(a, l || nextLang(have, btn.dataset.lang));
        box.querySelector('.art-md').innerHTML = md(tx.body); fitMore(row);
        btn.outerHTML = langBtn(have, tx.lang, 'internArticles.histLang(this)', 'art-tfl');
    }
    // V101.291: the History row's language pill, after the title (shown only while the row is open) — when the article has more than one language
    function flagHtml(s) {
        var a = find((s.metadata || {}).articleId); if (!a) return '';
        var have = langs(a); return have.length > 1 ? langBtn(have, textOf(a, S.cl).lang, 'internArticles.histLang(this)', 'art-tfl') : '';
    }
    // ---- 📤 share (V101.291, owner pick C): LINE always, Facebook only with a Source link (it needs a URL). The first share of an article
    // adds 0.1 to the score once (not said on screen); the icon tapped turns wave blue. articleSeen[id].shared = ['line', 'fb'] tells the admin.
    function srcUrl(a) { return a.source && /^https?:\/\//i.test(a.source.url || '') ? a.source.url : ''; }
    // shared = ['line', 'fb'] (an older single string is read as one)
    function sharedOf(s) { var v = (s || {}).shared; return Array.isArray(v) ? v : v ? [v] : []; }
    function shareHtml(a) {
        var on = sharedOf((me().articleSeen || {})[a.id]), id = esc(JSON.stringify(a.id));
        var b = function (k, cls, label, txt) { return '<button type="button" class="' + cls + (on.indexOf(k) >= 0 ? ' on' : '') + '" data-sh="' + k + '" aria-label="Share on ' + label + '" title="' + label + '" onclick="internArticles.share(' + id + ',\'' + k + '\')">' + txt + '</button>'; };
        return '<span class="art-sh"><i>·</i>📤 ' + b('line', 'ln', 'LINE', 'LINE') + (srcUrl(a) ? b('fb', 'fb', 'Facebook', 'f') : '') + '</span>';
    }
    function shareText(a) {
        var tx = textOf(a, S.cl), u = srcUrl(a);
        if (u) return tx.title + '\n' + u;
        var first = String(tx.body || '').split('\n').map(function (l) { return l.replace(/[*_#>`]/g, '').trim(); }).filter(Boolean)[0] || '';
        return '📰 ' + tx.title + (first ? '\n' + first.slice(0, 160) : '');
    }
    function markShared(id, where) {
        var m = window.myUserDoc = window.myUserDoc || {}; m.articleSeen = m.articleSeen || {};
        var had = sharedOf(m.articleSeen[id]);
        m.articleSeen[id] = Object.assign({}, m.articleSeen[id], { shared: had.indexOf(where) >= 0 ? had : had.concat(where) });   // keeps `at` (the read time)
        document.querySelectorAll('.art-hist[data-art="' + id.replace(/"/g, '') + '"] .art-sh [data-sh="' + where + '"]').forEach(function (e) { e.classList.add('on'); });   // only the icon tapped
        if (blocked() || !window.db || !window.myRegistered) return Promise.resolve(false);
        var ref = window.db.collection('users').doc(uid());
        return window.db.runTransaction(function (tx) {
            return tx.get(ref).then(function (snap) {
                var had = sharedOf((((snap.exists && snap.data()) || {}).articleSeen || {})[id]), w = {};
                w[id] = { shared: had.indexOf(where) >= 0 ? had : had.concat(where), sharedAt: firebase.firestore.FieldValue.serverTimestamp() };
                var f = { articleSeen: w };
                if (!had.length) f.score = firebase.firestore.FieldValue.increment(0.1);   // once per article
                tx.set(ref, f, { merge: true });
                return !had.length;
            });
        }).catch(function (e) { console.warn('articles share:', e && e.message); return false; });
    }
    function share(id, where) {
        var a = find(id); if (!a) return Promise.resolve(false);
        var u = srcUrl(a), text = shareText(a);
        if (where === 'fb' && !u) return Promise.resolve(false);
        var go = where === 'fb' ? 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u) : 'https://line.me/R/share?text=' + encodeURIComponent(text);
        var open = function () { internArticles.openSrc(go); return true; };
        // in LINE: the friend / group picker (like 🏅 badges); a cancel is not a share
        var p = where === 'line' && window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')
            ? Promise.resolve().then(function () { return liff.shareTargetPicker([{ type: 'text', text: text }]); }).then(function (r) { return !!r; }, open)
            : Promise.resolve(open());
        return p.then(function (ok) { return ok ? markShared(id, where) : false; });
    }
    // tapping an article row open in History = read (the row stays open: the pill is patched in place, no re-render)
    document.addEventListener('click', function (e) {
        var row = e.target.closest && e.target.closest('[data-delete-type="article"]');
        if (!row || e.target.closest('a, button')) return;
        fitMore(row);
        var id = String(row.dataset.deleteItem || '').replace(/^art_/, ''), s = (me().articleSeen || {})[id];
        if (!find(id) || isDone(s)) return;
        markRead(id, 'hist').then(function () { });
        var disc = row.querySelector('.art-d'); if (disc) { disc.classList.remove('art-new', 'art-closed'); disc.classList.add('art-read'); }   // V101.206: the disc carries the state
        var pill = row.querySelector('.hl-pill'); if (pill) pill.outerHTML = pillHtml({ metadata: { state: 'read', saved: !!(s && s.saved) } });
    });

    var api = window.internArticles = {
        // called from the users/{uid} snapshot in index.html
        onUserDoc: function () {
            if (!S.armed) { S.armed = true; if (!blocked()) setTimeout(function () { load(); listenMine(); }, 2500); }
            else refreshHistory(false);
        },
        historyItems: function () { return historyItems(S.list, me(), Date.now(), S.qs); },
        histMore: histMore, flagHtml: flagHtml, share: share,
        owed: function () { return owed(S.list, me(), Date.now()); },
        detailHtml: detailHtml, pillHtml: pillHtml, discHtml: discHtml, listen: listen, stopListen: stopListen, close: close, histLang: histLang,
        gotIt: gotIt, anyQ: anyQ, askSend: askSend,
        // V101.306 🌞 Ask Nika about this article: 🌞 opens / closes the strip; 📝 and 🎯 ask at once, ❓ opens a one-line box
        nika: function () { if (!S.cur) return; S.nk = S.nk ? null : { k: '', text: '', busy: false, err: false, r: null, left: null }; render(); var b = document.querySelector('#art-nk .nk-c button'); if (b) b.focus(); },
        nkAsk: function (x) {
            var k = S.nk, c = S.cur; if (!k || !c || k.busy) return Promise.resolve(false);
            var w = NKT[S.lang] || NKT.en, title = String(textOf(c.a, S.lang).title || '').slice(0, 200);
            k.k = x;
            if (x === 'own') { k.r = null; k.err = false; render(); var i = document.getElementById('art-nk-q'); if (i) i.focus(); return Promise.resolve(true); }
            return nkCall(x === 'sum' ? w.qSum(title) : w.qKey(title));
        },
        nkType: function (v) { if (S.nk) S.nk.text = v; },
        nkSend: function () { var k = S.nk, q = k ? String(k.text || '').trim() : ''; if (!k || q.length < 3) return Promise.resolve(false); return nkCall(q); },
        askLang: function () { if (!S.ask || S.ask.busy) return; S.lang = LORDER[(LORDER.indexOf(S.lang) + 1) % LORDER.length]; render(); },
        askKind: function (k) { if (!S.ask || S.ask.busy) return; S.ask.kind = k; render(); },
        lang: function (l) { var a = S.cur && S.cur.a, have = a ? langs(a) : []; S.lang = l || (have.length ? nextLang(have, textOf(a, S.lang).lang) : S.lang); render(); },
        toggleMore: function () { S.more = !S.more; render(); },
        // V101.302 🎬 clip: tap = sound on / off (from the top once it has ended); ✕ / ⌃ / swipe up = the article text
        clipSound: function () { var k = S.clip; if (!k) return; k.sound = !k.sound; if (k.sound && k.done) { k.i = 0; k.done = false; } if (k.sound || !k.done) clipStep(); else { clipStopSpeak(); render(); } },
        clipSkip: function () { if (!S.clip) return; S.clip = null; clipStopSpeak(); render(); var ok = document.querySelector('#art-sheet .ok'); if (ok) ok.focus(); },
        // V101.269: close the sheet (not read: it stays in History as closed) → Work ▸ History with the 📰 chip on, like the ?tab=history deep link
        toHistory: function () {
            close('x');
            var w = document.getElementById('work-section-content');
            if (w && w.style.display === 'none' && typeof toggleWorkSection === 'function') toggleWorkSection();
            if (typeof switchWorkTab === 'function') switchWorkTab('history');
            if (typeof filterUnifiedHistory === 'function') filterUnifiedHistory('article');
            var sec = document.getElementById('section-general-work'); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        save: function () {
            var c = S.cur; if (!c) return;
            var s = (me().articleSeen || {})[c.a.id] || {};
            setSeen(c.a.id, { saved: !s.saved }); render(); refreshHistory(false);
        },
        mute: function () { if (window.myUserDoc) window.myUserDoc.articlesMuted = true; write({ articlesMuted: true }); close('x'); if (typeof showToast === 'function') showToast('🔕 Articles stay in History'); },
        // from the popup (closes it, = read) or from a History row (= read)
        openSrc: function (url) {
            if (window.liff && liff.isInClient && liff.isInClient()) liff.openWindow({ url: url, external: true });
            else window.open(url, '_blank', 'noopener');
        },
        openQuiz: function (articleId, quizId) {
            if (S.cur) close('quiz'); else markRead(articleId, 'quiz');
            awardQuizBeri(articleId);
            if (typeof applyTabDeepLink === 'function') applyTabDeepLink(new URLSearchParams({ quiz: String(quizId) }));
        },
        // V101.197 (owner's pick 2): the articles about a Disease Codex entry — drafted from it (dx.publishedId) or linked by hand (＋ Disease) —
        // that this intern can see now, or has already read; newest first
        forDisease: function (diseaseId) {
            return aboutCodex(function (a) { return (a.dx && a.dx.publishedId === diseaseId) || (a.links || []).some(function (l) { return l.kind === 'disease' && l.id === diseaseId; }); });
        },
        // V101.198: the articles linked to a Drug Codex entry with ＋ Codex (links[kind=codex])
        forDrug: function (drugId) {
            return aboutCodex(function (a) { return (a.links || []).some(function (l) { return l.kind === 'codex' && l.id === drugId; }); });
        },
        openArticle: function (id) {   // from a Codex entry: the sheet opens on top; closing it = read, as always
            var a = find(id); if (!a || S.cur) return;
            if (typeof dxCloseDetail === 'function') dxCloseDetail();
            if (typeof dcCloseDetail === 'function') dcCloseDetail();   // V101.198: the Drug Codex entry too
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
        _S: S, _clipFor: clipFor, _pick: pick, _owed: owed, _kindOf: kindOf, _audienceOk: audienceOk, _historyItems: historyItems, _textOf: textOf, _linksHtml: linksHtml, _bkkDay: bkkDay, _isDone: isDone, _later: later, _show: show, _award: awardQuizBeri
    };
})();
