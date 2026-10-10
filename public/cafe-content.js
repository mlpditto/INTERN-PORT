/* Content Creator division (called CAFE until it was renamed) — Social media content.
   Members of that division (getMyDivision() is 'Content Creator', or the old 'CAFE') get a Content card instead of Mission + DD Codex, and the round ＋ button opens a
   content sheet instead of the generic Submit New. Admin moves a group into the division (Groups & Divisions) and the UI follows.
   Data (no new collection, no rules change):
   · Ideas / Drafts  → users/{uid}.socialDrafts  (array, max 30, owner-writable like the rest of the user doc)
   · Posted          → works/{id} with kind:'social' (+ a unified `submissions` mirror, same dual write as submitWork). The admin reviews it in the
                       existing Work queue and sets the score; this card reads status/score back. Likes / reach live on the works doc (owner may update it).
   Images reuse the product photo path (resizeProductPhoto → uploadProductPhoto, JPEG ≤2 MB, content-addressed).
   Globals used from index.html: db, userId, userProfile, usersWorksCache, getMyDivision, ensureFirebaseAuthReady, showToast,
   resizeProductPhoto, uploadProductPhoto, openUnifiedModal, getBangkokDateTimeParts. */
(function () {
    'use strict';
    var MAX_DRAFTS = 30, MAX_IMAGES = 3;
    var PLATFORMS = [['ig', 'IG', 'fa-brands fa-instagram'], ['fb', 'FB', 'fa-brands fa-facebook'], ['tt', 'TikTok', 'fa-brands fa-tiktok'], ['yt', 'YouTube', 'fa-brands fa-youtube'], ['line', 'LINE', 'fa-brands fa-line']];
    var TYPES = { post: ['Post', 'โพสต์'], reel: ['Reel', 'รีล'], story: ['Story', 'สตอรี่'], video: ['Video', 'วิดีโอ'] };
    var T = {
        en: { title: 'Content', viewList: 'List view', viewMonth: 'Month view', planDay: 'Plan', emptyDay: 'Nothing on this day yet.', pickDay: 'Tap a day to see or plan content.', plan: 'Plan date (optional)', ideas: 'Ideas', drafts: 'Drafts', posted: 'Posted', platforms: 'Platforms', reviewed: 'Reviewed', pending: 'Pending review', add: 'New content', addNum: 'Add numbers',
            emptyIdeas: 'No ideas yet. Jot one down before you forget it.', emptyDrafts: 'No drafts yet.', emptyPosted: 'Nothing posted yet. Share your first piece.',
            sheet: 'Submit content', edit: 'Edit content', stage: 'Stage', idea: 'Idea', draft: 'Draft', platform: 'Platform', type: 'Type', caption: 'Caption or idea', capPh: 'What is this content about?',
            images: 'Images', addImg: 'Add', link: 'Post link', date: 'Post date', send: 'Send for review', save: 'Save', saving: 'Saving…', other: 'Case, Work, Event… (other submissions)', del: 'Delete this draft', delAsk: 'Delete this draft?',
            hintPosted: 'Posted content is reviewed by the admin. Add numbers later from the card.', hintLocal: 'Saved for you only until you mark it Posted.',
            needCap: 'Write a caption or idea first.', needLink: 'Paste the post link (starting with http).', needDate: 'Pick the post date.', full: 'You already have 30 saved. Delete one first.', fail: 'Could not save. Please try again.', noimg: 'That image could not be read.',
            numTitle: 'Add numbers', likes: 'Likes', reach: 'Reach', numHint: 'Update any time — the latest numbers are what the admin sees.', saveNum: 'Save numbers', badNum: 'Enter whole numbers, zero or more.', likeReach: 'Likes cannot be higher than reach.', savedNum: 'Saved.', sentToast: 'Sent for review', savedToast: 'Saved' },
        th: { title: 'คอนเทนต์', viewList: 'มุมมองรายการ', viewMonth: 'มุมมองปฏิทิน', planDay: 'วางแผน', emptyDay: 'วันนี้ยังไม่มีอะไร', pickDay: 'แตะวันที่เพื่อดูหรือวางแผนคอนเทนต์', plan: 'วันที่วางแผน (ไม่บังคับ)', ideas: 'ไอเดีย', drafts: 'ฉบับร่าง', posted: 'โพสต์แล้ว', platforms: 'แพลตฟอร์ม', reviewed: 'ตรวจแล้ว', pending: 'รอตรวจ', add: 'เพิ่มคอนเทนต์', addNum: 'เพิ่มตัวเลข',
            emptyIdeas: 'ยังไม่มีไอเดีย จดไว้ก่อนลืมนะ', emptyDrafts: 'ยังไม่มีฉบับร่าง', emptyPosted: 'ยังไม่มีงานที่โพสต์ ลองส่งชิ้นแรกดู',
            sheet: 'ส่งคอนเทนต์', edit: 'แก้คอนเทนต์', stage: 'ขั้นตอน', idea: 'ไอเดีย', draft: 'ร่าง', platform: 'แพลตฟอร์ม', type: 'ประเภท', caption: 'แคปชั่นหรือไอเดีย', capPh: 'คอนเทนต์นี้เกี่ยวกับอะไร',
            images: 'รูปภาพ', addImg: 'เพิ่ม', link: 'ลิงก์โพสต์', date: 'วันที่โพสต์', send: 'ส่งให้ตรวจ', save: 'บันทึก', saving: 'กำลังบันทึก…', other: 'Case, Work, Event… (งานประเภทอื่น)', del: 'ลบฉบับร่างนี้', delAsk: 'ลบฉบับร่างนี้ใช่ไหม',
            hintPosted: 'งานที่โพสต์แล้วแอดมินจะตรวจ ใส่ตัวเลขทีหลังได้จากการ์ด', hintLocal: 'เห็นเฉพาะคุณ จนกว่าจะเลือก โพสต์แล้ว',
            needCap: 'เขียนแคปชั่นหรือไอเดียก่อน', needLink: 'วางลิงก์โพสต์ (ขึ้นต้นด้วย http)', needDate: 'เลือกวันที่โพสต์', full: 'บันทึกครบ 30 รายการแล้ว ลบอันเก่าก่อน', fail: 'บันทึกไม่สำเร็จ ลองอีกครั้ง', noimg: 'อ่านรูปนี้ไม่ได้',
            numTitle: 'เพิ่มตัวเลข', likes: 'ถูกใจ', reach: 'เข้าถึง', numHint: 'อัปเดตได้ทุกเมื่อ แอดมินจะเห็นตัวเลขล่าสุด', saveNum: 'บันทึกตัวเลข', badNum: 'ใส่จำนวนเต็ม 0 ขึ้นไป', likeReach: 'ถูกใจต้องไม่เกินจำนวนเข้าถึง', savedNum: 'บันทึกแล้ว', sentToast: 'ส่งให้ตรวจแล้ว', savedToast: 'บันทึกแล้ว' }
    };
    var DIVISIONS = ['content creator', 'cafe'];   // the division's name, lower-cased; 'cafe' = what it was called first
    var on = false, host = null, overlay = null, drafts = [], filter = 'posted', unsub = null, listenUid = '', sheet = null, busy = false;

    function lang() { try { return localStorage.getItem('uiLangTH') === '1' ? 'th' : 'en'; } catch (_) { return 'en'; } }
    function L() { return T[lang()]; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function plat(k) { for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i][0] === k) return PLATFORMS[i]; return PLATFORMS[0]; }
    function typeLabel(k) { return (TYPES[k] || TYPES.post)[lang() === 'th' ? 1 : 0]; }
    function todayKey() { try { return getBangkokDateTimeParts().dateKey; } catch (_) { return new Date().toISOString().slice(0, 10); } }
    function dayLabel(key) { var d = new Date(String(key) + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
    function isCafe() { try { return typeof getMyDivision === 'function' && DIVISIONS.indexOf(String(getMyDivision() || '').replace(/\s+/g, ' ').trim().toLowerCase()) >= 0; } catch (_) { return false; } }
    function myWorks() { try { return (typeof usersWorksCache !== 'undefined' && usersWorksCache) || []; } catch (_) { return []; } }
    function postedList() {
        return myWorks().filter(function (w) { return w && w.kind === 'social'; }).sort(function (a, b) {
            var da = String(b.postDate || ''), db_ = String(a.postDate || '');
            if (da !== db_) return da < db_ ? -1 : 1;
            return ((b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0) - (a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0));
        });
    }
    function isReviewed(w) { return w.status && w.status !== 'รอตรวจ'; }
    function fmtScore(n) { n = Number(n) || 0; return (Math.round(n * 100) / 100).toString(); }
    function fmtNum(n) { n = Number(n); return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n); }

    // ---------- home card ----------
    var PLAT_COLOR = { ig: '#e1306c', fb: '#1877f2', tt: '#111827', yt: '#ef4444', line: '#06c755' };
    var WEEK = { en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] };
    var view = (function () { try { return localStorage.getItem('cafeContentView') === 'month' ? 'month' : 'list'; } catch (_) { return 'list'; } })();
    var viewMonth = '', selDay = '';
    function monthShift(key, delta) { var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + delta; var d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7); }
    function setView(v) { view = v; try { localStorage.setItem('cafeContentView', v); } catch (_) { /* storage may be blocked */ } if (v === 'month' && !viewMonth) viewMonth = todayKey().slice(0, 7); render(); }

    function thumb(p, img) { return '<div class="cc-th">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<i class="' + p[2] + '"></i>') + '</div>'; }
    function postedRow(w, t) {
        var p = plat(w.platform), m = w.metrics && (w.metrics.likes != null || w.metrics.reach != null) ? w.metrics : null;
        var metric = m ? '<span><i class="fa-solid fa-heart"></i> ' + esc(fmtNum(m.likes || 0)) + '</span><span><i class="fa-solid fa-eye"></i> ' + esc(fmtNum(m.reach || 0)) + '</span>'
            : '<button type="button" class="cc-chip" data-act="metrics" data-id="' + esc(w.id) + '"><i class="fa-solid fa-plus"></i> ' + t.addNum + '</button>';
        var st = isReviewed(w) ? '<span class="cc-pill done">' + t.reviewed + (Number(w.score) ? ' +' + esc(fmtScore(w.score)) : '') + '</span>' : '<span class="cc-pill pending">' + t.pending + '</span>';
        return '<div class="cc-row" data-act="metrics" data-id="' + esc(w.id) + '">' + thumb(p, w.images && w.images[0]) + '<div class="cc-main">' +
            '<div class="cc-meta"><span class="cc-pill">' + esc(typeLabel(w.ctype)) + '</span><span>' + esc(p[1]) + ' · ' + esc(dayLabel(w.postDate)) + '</span></div>' +
            '<div class="cc-cap">' + esc(w.caption || w.title) + '</div><div class="cc-foot">' + metric + st + '</div></div></div>';
    }
    function draftRow(d, t) {
        var p = plat(d.platform);
        return '<div class="cc-row" data-act="draft" data-id="' + esc(d.id) + '">' + thumb(p, d.images && d.images[0]) + '<div class="cc-main">' +
            '<div class="cc-meta"><span class="cc-pill">' + esc(typeLabel(d.ctype)) + '</span><span>' + esc(p[1]) + (d.plannedDate ? ' · ' + esc(dayLabel(d.plannedDate)) : '') + '</span><span class="cc-pill plan">' + (d.stage === 'idea' ? t.idea : t.draft) + '</span></div>' +
            '<div class="cc-cap">' + esc(d.caption) + '</div></div></div>';
    }

    function monthHtml(t, posted) {
        var y = +viewMonth.slice(0, 4), m = +viewMonth.slice(5, 7), first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate(), today = todayKey();
        var byDay = {};
        posted.forEach(function (w) { if (String(w.postDate || '').slice(0, 7) === viewMonth) (byDay[w.postDate] = byDay[w.postDate] || { p: [], d: [] }).p.push(w); });
        drafts.forEach(function (d) { if (d.plannedDate && String(d.plannedDate).slice(0, 7) === viewMonth) (byDay[d.plannedDate] = byDay[d.plannedDate] || { p: [], d: [] }).d.push(d); });
        var monthName = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        var h = '<div class="cc-calnav"><button type="button" class="cc-chip" data-cal="-1" aria-label="Previous month">&lsaquo;</button><b>' + esc(monthName) + '</b><button type="button" class="cc-chip" data-cal="1" aria-label="Next month">&rsaquo;</button></div>';
        h += '<div class="cc-grid">' + WEEK[lang()].map(function (w) { return '<span class="cc-wd">' + w + '</span>'; }).join('');
        for (var i = 0; i < first; i++) h += '<span></span>';
        for (var d = 1; d <= days; d++) {
            var key = viewMonth + '-' + String(d).padStart(2, '0'), it = byDay[key], dots = '';
            if (it) {
                var all = it.p.map(function (w) { return ['f', w.platform]; }).concat(it.d.map(function (x) { return ['h', x.platform]; }));
                dots = all.slice(0, 3).map(function (x) { var c = PLAT_COLOR[x[1]] || '#64748b'; return x[0] === 'f' ? '<b style="background:' + c + '"></b>' : '<b class="hol" style="border-color:' + c + '"></b>'; }).join('') + (all.length > 3 ? '<small>+' + (all.length - 3) + '</small>' : '');
            }
            h += '<button type="button" class="cc-day' + (key === today ? ' today' : '') + (key === selDay ? ' sel' : '') + '" data-day="' + key + '" aria-label="' + esc(dayLabel(key)) + (it ? ', ' + (it.p.length + it.d.length) : '') + '"><span>' + d + '</span><i>' + dots + '</i></button>';
        }
        h += '</div>';
        if (selDay && selDay.slice(0, 7) === viewMonth) {
            var s = byDay[selDay] || { p: [], d: [] };
            h += '<div class="cc-dayhead"><b>' + esc(dayLabel(selDay)) + '</b><button type="button" class="cc-chip" data-act="plan" data-day="' + selDay + '"><i class="fa-solid fa-plus"></i> ' + t.planDay + '</button></div>' +
                (s.p.length + s.d.length ? s.p.map(function (w) { return postedRow(w, t); }).join('') + s.d.map(function (x) { return draftRow(x, t); }).join('') : '<div class="cc-empty">' + t.emptyDay + '</div>');
        } else h += '<div class="cc-empty">' + t.pickDay + '</div>';
        return h;
    }

    function render() {
        if (!host || !on) return;
        var t = L(), posted = postedList(), ideas = drafts.filter(function (d) { return d.stage === 'idea'; }), dr = drafts.filter(function (d) { return d.stage === 'draft'; });
        if (!viewMonth) viewMonth = todayKey().slice(0, 7);
        var month = view === 'month' ? viewMonth : todayKey().slice(0, 7), mp = posted.filter(function (w) { return String(w.postDate || '').slice(0, 7) === month; });
        var plats = {}; mp.forEach(function (w) { plats[w.platform] = 1; });
        var rev = mp.filter(isReviewed).length, body = '';
        if (view === 'month') body = monthHtml(t, posted);
        else {
            var rows = filter === 'posted' ? posted.map(function (w) { return postedRow(w, t); }).join('') : (filter === 'ideas' ? ideas : dr).map(function (d) { return draftRow(d, t); }).join('');
            if (!rows) rows = '<div class="cc-empty">' + (filter === 'ideas' ? t.emptyIdeas : filter === 'drafts' ? t.emptyDrafts : t.emptyPosted) + '</div>';
            body = '<div class="cc-rail" role="group">' + [['ideas', t.ideas, ideas.length], ['drafts', t.drafts, dr.length], ['posted', t.posted, posted.length]].map(function (c) {
                return '<button type="button" class="cc-chip" data-filter="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '">' + c[1] + ' ' + c[2] + '</button>';
            }).join('') + '</div>' + rows;
        }
        var monthName = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 15)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
        host.innerHTML = '<div class="cc-card"><div class="cc-head"><i class="fa-solid fa-camera"></i> ' + t.title + '<span class="cc-month">' + esc(monthName) + '</span>' +
            '<span class="cc-view" role="group" aria-label="View"><button type="button" data-view="list" aria-pressed="' + (view === 'list') + '" aria-label="' + t.viewList + '"><i class="fa-solid fa-list"></i></button><button type="button" data-view="month" aria-pressed="' + (view === 'month') + '" aria-label="' + t.viewMonth + '"><i class="fa-solid fa-calendar-days"></i></button></span></div>' +
            '<div class="cc-stats"><div class="cc-stat"><span>' + t.posted + '</span><b>' + mp.length + '</b></div><div class="cc-stat"><span>' + t.platforms + '</span><b>' + Object.keys(plats).length + '</b></div><div class="cc-stat"><span>' + t.reviewed + '</span><b>' + rev + '/' + mp.length + '</b></div></div>' +
            body + '<div class="cc-add"><button type="button" class="cc-chip" data-act="new"><i class="fa-solid fa-plus"></i> ' + t.add + '</button></div></div>';
    }

    // ---------- drafts (users/{uid}.socialDrafts) ----------
    function listen() {
        if (!on || !userId || (unsub && listenUid === userId)) return;
        if (unsub) { unsub(); unsub = null; }
        listenUid = userId;
        ensureFirebaseAuthReady(10000).then(function (u) {
            if (!u || !on || listenUid !== userId) return;
            unsub = db.collection('users').doc(userId).onSnapshot(function (s) {
                var a = s.exists ? (s.data() || {}).socialDrafts : null;
                drafts = Array.isArray(a) ? a.filter(function (d) { return d && d.id && (d.stage === 'idea' || d.stage === 'draft'); }) : [];
                render();
            }, function (e) { console.warn('[cafe] drafts listener', e); });
        });
    }
    function saveDrafts(arr) {
        return db.collection('users').doc(userId).set({ socialDrafts: arr }, { merge: true }).then(function () { drafts = arr; });
    }

    // ---------- sheet ----------
    function ensureOverlay() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.id = 'ccOverlay'; overlay.className = 'lang-no-toggle';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
        document.body.appendChild(overlay);
        overlay.addEventListener('click', onSheetClick);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeSheet(); });
    }
    function closeSheet() { if (overlay) overlay.classList.remove('open'); sheet = null; }
    function chips(group, items, cur) {
        return '<div class="cc-rail" style="padding:0" data-group="' + group + '">' + items.map(function (i) {
            return '<button type="button" class="cc-chip" data-group="' + group + '" data-v="' + i[0] + '" aria-pressed="' + (cur === i[0]) + '">' + (i[2] ? '<i class="' + i[2] + '"></i>' : '') + esc(i[1]) + '</button>';
        }).join('') + '</div>';
    }
    function openSheet(d, preset) {
        ensureOverlay();
        var t = L();
        sheet = { id: d ? d.id : '', stage: d ? d.stage : preset ? 'idea' : 'posted', platform: d ? d.platform : 'ig', ctype: d ? d.ctype : 'post', images: (d && d.images ? d.images : []).map(function (u) { return { url: u }; }) };
        overlay.innerHTML = '<div class="cc-box"><div class="cc-bh"><i class="fa-solid fa-camera"></i> ' + (d ? t.edit : t.sheet) + '<button type="button" class="cc-x" data-act="close" aria-label="Close">&times;</button></div>' +
            '<span class="cc-lbl">' + t.stage + '</span>' + chips('stage', [['idea', t.idea], ['draft', t.draft], ['posted', t.posted]], sheet.stage) +
            '<span class="cc-lbl">' + t.platform + '</span>' + chips('platform', PLATFORMS, sheet.platform) +
            '<span class="cc-lbl">' + t.type + '</span>' + chips('ctype', Object.keys(TYPES).map(function (k) { return [k, TYPES[k][lang() === 'th' ? 1 : 0]]; }), sheet.ctype) +
            '<span class="cc-lbl">' + t.caption + '</span><textarea id="ccCap" rows="3" maxlength="1000" placeholder="' + esc(t.capPh) + '">' + esc(d ? d.caption : '') + '</textarea>' +
            '<span class="cc-lbl">' + t.images + '</span><div class="cc-imgs" id="ccImgs"></div>' +
            '<div id="ccPlan"><span class="cc-lbl">' + t.plan + '</span><input type="date" id="ccPlanDate" value="' + esc((d && d.plannedDate) || (preset && preset.plannedDate) || '') + '"></div>' +
            '<div id="ccPosted"><span class="cc-lbl">' + t.link + '</span><input type="text" id="ccLink" maxlength="500" placeholder="https://…"><span class="cc-lbl">' + t.date + '</span><input type="date" id="ccDate" value="' + esc(todayKey()) + '" max="' + esc(todayKey()) + '"></div>' +
            '<div class="cc-err" id="ccErr" role="status"></div><button type="button" class="cc-go" id="ccGo" data-act="save"></button>' +
            '<div class="cc-err" style="color:#64748b;text-align:center" id="ccHint"></div>' +
            (d ? '<button type="button" class="cc-link danger" data-act="del">' + t.del + '</button>' : '<button type="button" class="cc-link" data-act="other">' + t.other + '</button>') + '</div>';
        paintImages(); paintStage();
        overlay.classList.add('open');
    }
    function paintStage() {
        var t = L(), posted = sheet.stage === 'posted';
        overlay.querySelector('#ccPosted').style.display = posted ? 'block' : 'none';
        overlay.querySelector('#ccPlan').style.display = posted ? 'none' : 'block';
        overlay.querySelector('#ccGo').textContent = posted ? t.send : t.save;
        overlay.querySelector('#ccHint').textContent = posted ? t.hintPosted : t.hintLocal;
    }
    function paintImages() {
        var t = L(), h = sheet.images.map(function (im, i) { return '<div class="cc-th"><img src="' + esc(im.preview || im.url) + '" alt=""><button type="button" data-act="rmimg" data-i="' + i + '" aria-label="Remove">&times;</button></div>'; }).join('');
        if (sheet.images.length < MAX_IMAGES) h += '<label class="cc-chip" style="cursor:pointer"><i class="fa-solid fa-image"></i> ' + t.addImg + '<input type="file" id="ccFile" accept="image/*" multiple hidden></label>';
        var box = overlay.querySelector('#ccImgs'); box.innerHTML = h;
        var f = box.querySelector('#ccFile'); if (f) f.onchange = onFiles;
    }
    function onFiles() {
        var files = Array.prototype.slice.call(this.files || []).slice(0, MAX_IMAGES - sheet.images.length), err = overlay.querySelector('#ccErr');
        err.className = 'cc-err'; err.textContent = '';
        Promise.all(files.map(function (f) { return resizeProductPhoto(f).then(function (r) { return { blob: r.blob, preview: URL.createObjectURL(r.blob) }; }); }))
            .then(function (ims) { if (sheet) { sheet.images = sheet.images.concat(ims); paintImages(); } })
            .catch(function () { err.textContent = L().noimg; });
    }
    function setErr(msg, ok) { var e = overlay.querySelector('#ccErr'); e.className = 'cc-err' + (ok ? ' ok' : ''); e.textContent = msg || ''; }

    function onSheetClick(e) {
        if (e.target === overlay) return closeSheet();
        var chip = e.target.closest('.cc-chip[data-group]');
        if (chip && sheet) {
            sheet[chip.dataset.group] = chip.dataset.v;
            overlay.querySelectorAll('.cc-chip[data-group="' + chip.dataset.group + '"]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
            if (chip.dataset.group === 'stage') paintStage();
            return;
        }
        var a = e.target.closest('[data-act]'); if (!a) return;
        var act = a.dataset.act;
        if (act === 'close') closeSheet();
        else if (act === 'rmimg') { sheet.images.splice(+a.dataset.i, 1); paintImages(); }
        else if (act === 'other') { closeSheet(); if (typeof openUnifiedModal === 'function') openUnifiedModal(); }
        else if (act === 'save') save();
        else if (act === 'del') del();
        else if (act === 'savenum') saveNumbers(a.dataset.id);
    }

    function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    async function save() {
        if (busy || !sheet) return;
        var t = L(), cap = overlay.querySelector('#ccCap').value.trim(), posted = sheet.stage === 'posted', link = '', date = '';
        if (!cap) return setErr(t.needCap);
        if (posted) {
            link = overlay.querySelector('#ccLink').value.trim(); date = overlay.querySelector('#ccDate').value;
            if (!/^https?:\/\/\S+$/i.test(link)) return setErr(t.needLink);
            if (!date) return setErr(t.needDate);
        } else if (!sheet.id && drafts.length >= MAX_DRAFTS) return setErr(t.full);
        busy = true; var go = overlay.querySelector('#ccGo'); go.disabled = true; setErr(t.saving, true);
        try {
            var auth = await ensureFirebaseAuthReady(10000);
            if (!auth) throw new Error('Sign in required');
            var urls = [];
            for (var i = 0; i < sheet.images.length; i++) urls.push(sheet.images[i].url || (await uploadProductPhoto(sheet.images[i].blob)).url);
            var rest = drafts.filter(function (d) { return d.id !== sheet.id; });
            if (posted) {
                await createPosted(auth, { cap: cap, link: link, date: date, urls: urls });
                if (sheet.id) await saveDrafts(rest);
                filter = 'posted';
                if (typeof showToast === 'function') showToast(t.sentToast);
            } else {
                var plan = overlay.querySelector('#ccPlanDate').value, item = { id: sheet.id || newId(), stage: sheet.stage, platform: sheet.platform, ctype: sheet.ctype, caption: cap, images: urls, updatedAt: Date.now() };
                if (/^\d{4}-\d{2}-\d{2}$/.test(plan)) { item.plannedDate = plan; viewMonth = plan.slice(0, 7); selDay = plan; }
                rest.unshift(item);
                await saveDrafts(rest);
                filter = sheet.stage === 'idea' ? 'ideas' : 'drafts';
                if (typeof showToast === 'function') showToast(t.savedToast);
            }
            closeSheet(); render();
        } catch (e) { console.error('[cafe] save failed', e); if (overlay.classList.contains('open')) setErr(t.fail); }
        finally { busy = false; var g = overlay && overlay.querySelector('#ccGo'); if (g) g.disabled = false; }
    }
    async function createPosted(auth, f) {
        var p = plat(sheet.platform), title = '[' + p[1] + ' · ' + (TYPES[sheet.ctype] || TYPES.post)[0] + '] ' + f.cap.replace(/\s+/g, ' ').slice(0, 80);
        var base = { authUid: auth.uid, userId: userId, displayName: userProfile.displayName, pictureUrl: userProfile.pictureUrl || '', title: title, score: 0, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
        var ref = await db.collection('works').add(Object.assign({}, base, {
            link: f.link, status: 'รอตรวจ', kind: 'social', platform: sheet.platform, ctype: sheet.ctype, caption: f.cap, postDate: f.date, images: f.urls, metrics: null
        }));
        try {
            await db.collection('submissions').add(Object.assign({}, base, {
                submissionType: 'work', description: f.link, status: 'pending', adminComment: '', adminBonus: 0,
                metadata: { link: f.link, sourceType: 'works', sourceId: ref.id, kind: 'social_content', platform: sheet.platform, ctype: sheet.ctype },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(), pointsAwarded: false, pointsAmount: 0
            }));
        } catch (e) { console.warn('[cafe] unified mirror failed (non-critical)', e); }
    }
    function del() {
        if (!sheet || !sheet.id || !confirm(L().delAsk)) return;
        var id = sheet.id;
        saveDrafts(drafts.filter(function (d) { return d.id !== id; })).then(function () { closeSheet(); render(); }).catch(function () { setErr(L().fail); });
    }

    // ---------- numbers ----------
    function openNumbers(id) {
        var w = postedList().filter(function (x) { return x.id === id; })[0]; if (!w) return;
        ensureOverlay(); var t = L(), p = plat(w.platform), m = w.metrics || {};
        sheet = { numbers: id };
        overlay.innerHTML = '<div class="cc-box"><div class="cc-bh"><i class="fa-solid fa-chart-simple"></i> ' + t.numTitle + '<button type="button" class="cc-x" data-act="close" aria-label="Close">&times;</button></div>' +
            '<div class="cc-row" style="padding:12px 0;cursor:default"><div class="cc-th"><i class="' + p[2] + '"></i></div><div class="cc-main"><div class="cc-cap">' + esc(w.caption || w.title) + '</div><div class="cc-meta">' + esc(p[1]) + ' · ' + esc(typeLabel(w.ctype)) + ' · ' + esc(dayLabel(w.postDate)) + '</div>' +
            (/^https?:\/\//i.test(w.link || '') ? '<a href="' + esc(w.link) + '" target="_blank" rel="noopener" style="font-size:.78em">' + esc(w.link.replace(/^https?:\/\//, '').slice(0, 40)) + '</a>' : '') + '</div></div>' +
            '<div style="display:flex;gap:10px"><div style="flex:1"><span class="cc-lbl" style="margin-top:0">' + t.likes + '</span><input type="number" id="ccLikes" min="0" step="1" value="' + (m.likes != null ? esc(m.likes) : '') + '"></div>' +
            '<div style="flex:1"><span class="cc-lbl" style="margin-top:0">' + t.reach + '</span><input type="number" id="ccReach" min="0" step="1" value="' + (m.reach != null ? esc(m.reach) : '') + '"></div></div>' +
            '<div class="cc-err" style="color:#64748b">' + t.numHint + '</div><div class="cc-err" id="ccErr" role="status"></div><button type="button" class="cc-go" id="ccGo" data-act="savenum" data-id="' + esc(id) + '">' + t.saveNum + '</button></div>';
        overlay.classList.add('open');
    }
    async function saveNumbers(id) {
        if (busy) return;
        var t = L(), lk = overlay.querySelector('#ccLikes').value.trim(), rc = overlay.querySelector('#ccReach').value.trim();
        var l = lk === '' ? null : Number(lk), r = rc === '' ? null : Number(rc);
        if ((l !== null && (!Number.isInteger(l) || l < 0)) || (r !== null && (!Number.isInteger(r) || r < 0))) return setErr(t.badNum);
        if (l !== null && r !== null && r > 0 && l > r) return setErr(t.likeReach);
        busy = true; var go = overlay.querySelector('#ccGo'); go.disabled = true;
        try {
            var auth = await ensureFirebaseAuthReady(10000);
            if (!auth) throw new Error('Sign in required');
            await db.collection('works').doc(id).update({ metrics: { likes: l, reach: r }, metricsAt: firebase.firestore.FieldValue.serverTimestamp() });
            setErr(t.savedNum, true); render();
            setTimeout(function () { if (sheet && sheet.numbers === id) closeSheet(); }, 600);
        } catch (e) { console.error('[cafe] numbers failed', e); setErr(t.fail); }
        finally { busy = false; go.disabled = false; }
    }

    // ---------- wiring ----------
    function onHostClick(e) {
        var f = e.target.closest('[data-filter]'); if (f) { filter = f.dataset.filter; return render(); }
        var vw = e.target.closest('[data-view]'); if (vw) return setView(vw.dataset.view);
        var cal = e.target.closest('[data-cal]'); if (cal) { viewMonth = monthShift(viewMonth, +cal.dataset.cal); selDay = ''; return render(); }
        var dy = e.target.closest('[data-day]'); if (dy && !dy.dataset.act) { selDay = selDay === dy.dataset.day ? '' : dy.dataset.day; return render(); }
        var a = e.target.closest('[data-act]'); if (!a) return;
        e.stopPropagation();
        if (a.dataset.act === 'new') openSheet(null);
        else if (a.dataset.act === 'plan') openSheet(null, { plannedDate: a.dataset.day });
        else if (a.dataset.act === 'draft') openSheet(drafts.filter(function (d) { return d.id === a.dataset.id; })[0] || null);
        else if (a.dataset.act === 'metrics') openNumbers(a.dataset.id);
    }
    function sync() {
        try {
            var now = isCafe();
            if (now === on && (host || !now)) { if (now) listen(); return; }
            on = now;
            document.body.classList.toggle('cafe-mode', on);
            if (on) ['achievementUnlockModal', 'achievementsModal'].forEach(function (id) { var m = document.getElementById(id); if (m) m.style.display = 'none'; });   // a badge popup that opened before the division loaded
            if (on) {
                if (!host) {
                    host = document.getElementById('section-cafe-content');
                    if (host) host.addEventListener('click', onHostClick);
                }
                if (host) host.hidden = false;
                listen(); render();
            } else if (host) { host.hidden = true; host.innerHTML = ''; }
        } catch (e) { console.warn('[cafe] sync failed', e); }
    }
    // The Content Creator division has no badge system: index.html's achievement / badge code asks this (live, not via body.cafe-mode, so it is right
    // even before the first sync) and does nothing when it is true.
    window.isContentCreator = isCafe;
    window.cafeContentSync = sync;
    window.cafeContentRender = render;
    // The round ＋ opens the content sheet for CAFE members and the usual Submit New for everyone else.
    window.openSubmitFab = function () { if (on) openSheet(null); else if (typeof openUnifiedModal === 'function') openUnifiedModal(); };
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#lang-toggle-cycle')) setTimeout(render, 60); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
})();
