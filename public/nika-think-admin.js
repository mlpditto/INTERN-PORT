// 💭 Think questions — admin side (V102.632, owner pick A). Lives in 📰 Articles: the "💭 n" chip next to ❔ opens the panel
// (n = answers not yet 👍'd or replied). Write a question as 🌅 a day's question, 📰 for the article open in the editor, or 💭 general;
// ✨ drafts 3 from the open article. Each row opens its answers: 👍 and 💬 reply go back to the intern (nika_think_answers).
// Questions: app_settings/nika_think { items: [{ id, q, kind, day?, articleId?, articleTitle?, at }] } — interns read it, only admins write.
(function () {
    var BKK = 7 * 3600e3;
    var T = { open: false, items: [], answers: [], loaded: false, kind: 'day', day: '', text: '', sug: [], busy: '', err: '', q: '', reply: {} }, C = null;
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function bkkDay(ms) { return new Date(ms + BKK).toISOString().slice(0, 10); }
    function msOf(x) { return !x ? 0 : typeof x === 'number' ? x : x.toMillis ? x.toMillis() : (x.seconds || 0) * 1000; }
    function when(ms) { return ms ? new Date(ms + BKK).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) : ''; }
    function paint() { if (C && C.render) C.render(); }
    function hasDb() { return typeof db !== 'undefined' && db && typeof db.collection === 'function'; }
    function fresh(a) { return !a.liked && !a.reply; }
    function answersOf(id) { return T.answers.filter(function (a) { return a.qid === id; }); }
    function userOf(id) { var list = typeof usersData !== 'undefined' && Array.isArray(usersData) ? usersData : []; return list.find(function (u) { return u && u.id === id; }) || null; }
    function css() {
        if (document.getElementById('nt-admin-css')) return;
        var st = document.createElement('style'); st.id = 'nt-admin-css';
        st.textContent = '.art-think{margin:0!important;width:auto!important;min-height:0!important;background:#f5f3ff;color:#5b21b6;border:1px solid #c4b5fd;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer}.art-think[aria-expanded="true"]{background:#7c3aed;color:#fff;border-color:#7c3aed}' +
            '.nt-ad{border:1px solid #c4b5fd;background:#faf5ff;border-radius:12px;padding:8px 10px;margin:-4px 0 12px}' +
            '.nt-add{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.nt-add input[type=text]{flex:1 1 260px;min-width:0;margin:0;padding:7px 10px;border:1px solid #ddd6fe;border-radius:10px;font:inherit;font-size:13.5px;background:#fff}' +
            '.nt-add input[type=date]{margin:0;padding:3px 6px;border:1px solid #ddd6fe;border-radius:8px;font:inherit;font-size:12px;width:auto}' +
            '.nt-k{display:inline-flex;gap:3px;background:#ede9fe;border-radius:999px;padding:3px}.nt-k button{min-height:0;margin:0;width:auto;border:0;background:transparent;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#5b21b6;cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nt-k button[aria-pressed="true"]{background:#7c3aed;color:#fff}.nt-k button:disabled{opacity:.45;cursor:default}' +
            '.nt-b{min-height:0!important;margin:0!important;width:auto!important;padding:6px 12px;border-radius:10px;border:1px solid #c4b5fd;background:#fff;color:#5b21b6;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap}.nt-b.p{background:#7c3aed;color:#fff;border-color:#7c3aed}.nt-b:disabled{opacity:.55;cursor:default}' +
            '.nt-err{color:#b91c1c;font-size:12.5px;margin-top:4px}.nt-sug{display:flex;align-items:center;gap:8px;margin-top:6px;padding:5px 8px;border:1px dashed #c4b5fd;border-radius:10px;background:#fff;font-size:13px}.nt-sug span{flex:1;min-width:0}' +
            '.nt-list{margin-top:6px;max-height:340px;overflow:auto}.nt-r{display:flex;align-items:center;gap:8px;min-height:38px;border-top:1px solid #ede9fe;cursor:pointer}.nt-r .tg{flex:none;font-size:11px;font-weight:700;border-radius:6px;padding:1px 6px;background:#f1f5f9;color:#475569;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nt-r .tg.day{background:#fef3c7;color:#92400e}.nt-r .tg.article{background:#e0f2fe;color:#075985}' +
            '.nt-r .t{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nt-r .n{flex:none;font-size:12px;color:#64748b}.nt-r .n b{color:#7c3aed}.nt-r .del{min-height:0;margin:0;width:28px;height:28px;padding:0;border:0;background:none;cursor:pointer;flex:none}' +
            '.nt-as{padding:2px 0 8px 10px;border-left:3px solid #ddd6fe;margin:0 0 6px 6px}.nt-a{padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.nt-a .w{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#64748b}.nt-a .w b{color:#1e293b;font-size:12.5px}.nt-a .w .tm{margin-left:auto}' +
            '.nt-a .tx{margin:3px 0 5px;white-space:pre-wrap;overflow-wrap:anywhere;color:#1e293b}.nt-a .ac{display:flex;gap:6px;align-items:center}.nt-a .ac input{flex:1;min-width:0;margin:0;padding:5px 9px;border:1px solid #e2e8f0;border-radius:9px;font:inherit;font-size:12.5px}' +
            '.nt-a .lk{min-height:0;margin:0;width:auto;padding:4px 9px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;cursor:pointer}.nt-a .lk[aria-pressed="true"]{background:#dcfce7;border-color:#86efac}.nt-a .rp{font-size:12.5px;color:#4361ee}.nt-none{font-size:12.5px;color:#94a3b8;padding:6px 0}';
        document.head.appendChild(st);
    }

    function load(force) {
        if ((T.loaded && !force) || !hasDb()) return Promise.resolve();
        T.loaded = true;
        return Promise.resolve().then(function () {
            return Promise.all([
                db.collection('app_settings').doc('nika_think').get().catch(function () { return null; }),
                db.collection('nika_think_answers').orderBy('createdAt', 'desc').limit(500).get().catch(function () { return null; })
            ]);
        }).then(function (r) {
            var d = r[0] && r[0].exists ? r[0].data() || {} : {};
            T.items = Array.isArray(d.items) ? d.items.filter(function (x) { return x && x.id && x.q; }) : [];
            T.answers = r[1] ? r[1].docs.map(function (doc) { return Object.assign({ _id: doc.id }, doc.data() || {}); }) : [];
            paint();
        }).catch(function (e) { T.loaded = false; console.warn('[nika think admin]', e && e.message); });
    }
    function saveItems(items) {
        T.busy = 'save'; T.err = ''; paint();
        return db.collection('app_settings').doc('nika_think').set({ items: items }, { merge: true })
            .then(function () { T.items = items; return true; })
            .catch(function (e) { T.err = 'Not saved: ' + ((e && e.message) || 'error'); return false; })
            .then(function (ok) { T.busy = ''; paint(); return ok; });
    }
    function newId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }

    function chip() {
        var n = T.answers.filter(fresh).length;
        return '<button type="button" class="art-think" aria-expanded="' + T.open + '" onclick="NikaThinkAdmin.toggle()" title="💭 Think questions — shown in Nika; n = answers waiting for 👍 or a reply">💭' + (n ? ' ' + n : '') + '</button>';
    }
    function tagOf(x) {
        if (x.kind === 'day') return '<span class="tg day">🌅 ' + esc(x.day || '') + '</span>';
        if (x.kind === 'article') return '<span class="tg article" title="' + esc(x.articleTitle || '') + '">📰 ' + esc(x.articleTitle || 'Article') + '</span>';
        return '<span class="tg">💭 General</span>';
    }
    function answersHtml(x) {
        var list = answersOf(x.id);
        if (!list.length) return '<div class="nt-as"><div class="nt-none">No answers yet.</div></div>';
        return '<div class="nt-as">' + list.map(function (a) {
            var u = userOf(a.userId), nm = u ? (u.displayName || u.fullName || a.userId) : String(a.userId || '').slice(0, 8);
            return '<div class="nt-a"><div class="w"><b>' + esc(nm) + '</b><span class="tm">' + when(msOf(a.createdAt)) + '</span></div><div class="tx">' + esc(a.answer) + '</div>' +
                (a.reply ? '<div class="rp">💬 ' + esc(a.reply) + '</div>' : '') +
                '<div class="ac"><button type="button" class="lk" aria-pressed="' + !!a.liked + '" onclick="NikaThinkAdmin.like(\'' + esc(a._id) + '\')" title="👍 the intern sees it" aria-label="Like">👍</button>' +
                '<input type="text" maxlength="500" placeholder="💬 Reply — the intern sees it in Nika" value="' + esc(T.reply[a._id] != null ? T.reply[a._id] : '') + '" oninput="NikaThinkAdmin.draft(\'' + esc(a._id) + '\',this.value)" onkeydown="if(event.key===\'Enter\')NikaThinkAdmin.sendReply(\'' + esc(a._id) + '\')">' +
                '<button type="button" class="nt-b" onclick="NikaThinkAdmin.sendReply(\'' + esc(a._id) + '\')"' + (T.busy === a._id ? ' disabled' : '') + '>↵</button></div></div>';
        }).join('') + '</div>';
    }
    function panel() {
        if (!T.open) return '';
        var cur = C && C.cur ? C.cur() : null, curT = cur ? (C.title ? C.title(cur) : cur.id) : '';
        if (T.kind === 'article' && !cur) T.kind = 'day';
        if (!T.day) T.day = bkkDay(Date.now());
        var K = [['day', '🌅 Day'], ['article', '📰 ' + (cur ? curT : 'Open an article')], ['general', '💭 General']];
        var rows = T.items.slice().reverse();
        return '<div class="nt-ad" id="nt-ad"><div class="nt-add">' +
            '<input type="text" id="nt-new" maxlength="500" placeholder="💭 A question that makes interns think…" value="' + esc(T.text) + '" oninput="NikaThinkAdmin.text(this.value)" onkeydown="if(event.key===\'Enter\')NikaThinkAdmin.add()">' +
            '<span class="nt-k" role="group" aria-label="Where it shows">' + K.map(function (k) {
                return '<button type="button" data-k="' + k[0] + '" aria-pressed="' + (T.kind === k[0]) + '"' + (k[0] === 'article' && !cur ? ' disabled' : '') + ' onclick="NikaThinkAdmin.kind(\'' + k[0] + '\')" title="' + esc(k[0] === 'day' ? 'On top of Nika on this day' : k[0] === 'article' ? 'Under this article after 👍 Got it' : 'A 💭 chip in Nika') + '">' + esc(k[1]) + '</button>';
            }).join('') + '</span>' +
            (T.kind === 'day' ? '<input type="date" value="' + esc(T.day) + '" onchange="NikaThinkAdmin.day(this.value)" aria-label="Day">' : '') +
            '<button type="button" class="nt-b p" onclick="NikaThinkAdmin.add()"' + (T.busy ? ' disabled' : '') + '>＋ Add</button>' +
            (cur ? '<button type="button" class="nt-b" onclick="NikaThinkAdmin.ai()"' + (T.busy ? ' disabled' : '') + ' title="3 questions from this article">' + (T.busy === 'ai' ? '✨ …' : '✨ From this article') + '</button>' : '') + '</div>' +
            (T.err ? '<div class="nt-err">⚠️ ' + esc(T.err) + '</div>' : '') +
            T.sug.map(function (s, i) { return '<div class="nt-sug"><span>✨ ' + esc(s) + '</span><button type="button" class="nt-b" onclick="NikaThinkAdmin.useSug(' + i + ')">＋ 📰</button></div>'; }).join('') +
            '<div class="nt-list">' + (rows.length ? rows.map(function (x) {
                var all = answersOf(x.id), nw = all.filter(fresh).length;
                return '<div class="nt-r" onclick="NikaThinkAdmin.openQ(\'' + esc(x.id) + '\')">' + tagOf(x) + '<span class="t" title="' + esc(x.q) + '">' + esc(x.q) + '</span><span class="n">💬 ' + all.length + (nw ? ' · <b>' + nw + ' new</b>' : '') + '</span>' +
                    '<button type="button" class="del" onclick="event.stopPropagation();NikaThinkAdmin.del(\'' + esc(x.id) + '\')" title="Remove (answers are kept)" aria-label="Remove">🗑</button></div>' + (T.q === x.id ? answersHtml(x) : '');
            }).join('') : '<div class="nt-none">No questions yet — write one above.</div>') + '</div></div>';
    }

    function add(textIn, kindIn) {
        var q = String(textIn != null ? textIn : T.text).trim().slice(0, 500), kind = kindIn || T.kind, cur = C && C.cur ? C.cur() : null;
        if (!q) { var el = document.getElementById('nt-new'); if (el) el.focus(); return Promise.resolve(false); }
        var item = { id: newId(), q: q, kind: kind, at: Date.now() };
        if (kind === 'day') item.day = T.day || bkkDay(Date.now());
        if (kind === 'article') { if (!cur || !cur.id) return Promise.resolve(false); item.articleId = cur.id; item.articleTitle = String(C.title ? C.title(cur) : '').slice(0, 200); }
        return saveItems(T.items.concat([item])).then(function (ok) { if (ok && textIn == null) T.text = ''; paint(); return ok; });
    }
    function aiPrompt(a) {
        return ['ROLE: you write questions that make pharmacy interns think further after reading a short article.',
            'Write 3 open questions: no single right answer, each about using the article with a real patient or at the counter, at most 25 words each, in the language the article is written in.',
            'Reply with PURE JSON only: {"questions":["...","...","..."]}',
            'ARTICLE TITLE: ' + (C.title ? C.title(a) : ''), 'ARTICLE:', C.body ? C.body(a) : ''].join('\n');
    }

    window.NikaThinkAdmin = {
        attach: function (ctx) { C = ctx; css(); return load(); },
        load: load, chip: chip, panel: panel,
        toggle: function () { T.open = !T.open; if (T.open) load(); paint(); },
        text: function (v) { T.text = v; },
        kind: function (k) { T.kind = k; paint(); },
        day: function (v) { T.day = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : T.day; },
        add: function () { return add(); },
        del: function (id) {
            if (typeof confirm === 'function' && !confirm('Remove this question? Answers already sent are kept.')) return Promise.resolve(false);
            return saveItems(T.items.filter(function (x) { return x.id !== id; }));
        },
        openQ: function (id) { T.q = T.q === id ? '' : id; paint(); },
        like: function (aid) {
            var a = T.answers.find(function (x) { return x._id === aid; }); if (!a) return Promise.resolve(false);
            var v = !a.liked;
            return db.collection('nika_think_answers').doc(aid).update({ liked: v }).then(function () { a.liked = v; paint(); return true; })
                .catch(function (e) { T.err = 'Not saved: ' + ((e && e.message) || 'error'); paint(); return false; });
        },
        draft: function (aid, v) { T.reply[aid] = v; },
        sendReply: function (aid) {
            var a = T.answers.find(function (x) { return x._id === aid; }), text = String(T.reply[aid] || '').trim().slice(0, 500);
            if (!a || !text || T.busy) return Promise.resolve(false);
            T.busy = aid; paint();
            return db.collection('nika_think_answers').doc(aid).update({ reply: text, repliedAt: firebase.firestore.FieldValue.serverTimestamp() })
                .then(function () { a.reply = text; delete T.reply[aid]; return true; })
                .catch(function (e) { T.err = 'Not saved: ' + ((e && e.message) || 'error') + ' — your reply is kept.'; return false; })
                .then(function (ok) { T.busy = ''; paint(); return ok; });
        },
        ai: function () {
            var cur = C && C.cur ? C.cur() : null; if (!cur || T.busy || !C.ai) return Promise.resolve(false);
            T.busy = 'ai'; T.err = ''; paint();
            return C.ai(aiPrompt(cur)).then(function (d) {
                T.sug = (Array.isArray(d.questions) ? d.questions : []).map(function (s) { return String(s || '').trim(); }).filter(Boolean).slice(0, 3);
                if (!T.sug.length) T.err = 'No questions came back — try again.';
            }).catch(function (e) { T.err = '✨ ' + ((e && e.message) || 'failed'); }).then(function () { T.busy = ''; paint(); return !!T.sug.length; });
        },
        useSug: function (i) {
            var s = T.sug[i]; if (!s) return Promise.resolve(false);
            return add(s, 'article').then(function (ok) { if (ok) { T.sug.splice(i, 1); paint(); } return ok; });
        },
        _T: T
    };
})();
