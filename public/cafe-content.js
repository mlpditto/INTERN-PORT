/* Content Creator division (called CAFE until it was renamed) — Social media content.
   Members of that division (getMyDivision() is 'Content Creator', or the old 'CAFE') get a Content card instead of Mission + DD Codex, and the round ＋ button opens a
   content sheet instead of the generic Submit New. Admin moves a group into the division (Groups & Divisions) and the UI follows.
   Data (no new collection, no rules change):
   · Ideas / Drafts  → users/{uid}.socialDrafts  (array, max 30, owner-writable like the rest of the user doc)
   · Posted          → works/{id} with kind:'social' (+ a unified `submissions` mirror, same dual write as submitWork). The admin reviews it in the
                       existing Work queue and sets the score; this card reads status/score back. Likes / reach live on the works doc (owner may update it).
   Audit (a reviewer group) also gets a Review view: the others' posts waiting for review, each answered with a RECOMMENDATION (verdict, suggested
   bonus, comment) filed in admin_notifications {type:'content_review'} — the admin still gives the final score in the Work queue. Reviewers cannot
   write scores: users/{uid} is owner-writable, so who counts as a reviewer is a UI choice, never a permission.
   Images reuse the product photo path (resizeProductPhoto → uploadProductPhoto, JPEG ≤2 MB, content-addressed).
   Globals used from index.html: db, userId, userProfile, usersWorksCache, getMyDivision, ensureFirebaseAuthReady, showToast,
   resizeProductPhoto, uploadProductPhoto, openUnifiedModal, getBangkokDateTimeParts. */
(function () {
    'use strict';
    var MAX_DRAFTS = 30, MAX_IMAGES = 3, MAX_BRIEF = 1500, MAX_STEPS = 15, MAX_LINKS = 5;
    var PLATFORMS = [['ig', 'IG', 'fa-brands fa-instagram'], ['fb', 'FB', 'fa-brands fa-facebook'], ['tt', 'TikTok', 'fa-brands fa-tiktok'], ['yt', 'YouTube', 'fa-brands fa-youtube'], ['line', 'LINE', 'fa-brands fa-line']];
    var TYPES = { post: ['Post', 'โพสต์'], reel: ['Reel', 'รีล'], story: ['Story', 'สตอรี่'], video: ['Video', 'วิดีโอ'] };
    // Pipeline for ideas / drafts kept on users/{uid}.socialDrafts. 'draft' is the id that already existed (now the Script step); Posted is a works doc, not a stage here.
    var STAGES = [['idea', 'Idea', 'ไอเดีย'], ['draft', 'Script', 'สคริปต์'], ['film', 'Filming', 'ถ่ายทำ'], ['edit', 'Editing', 'ตัดต่อ'], ['sched', 'Scheduled', 'ตั้งโพสต์']];
    var STAGE_IDS = STAGES.map(function (s) { return s[0]; });
    var T = {
        en: { review: 'Review', revTodo: 'To review', revMine: 'Reviewed by me', revEmpty: 'Nothing is waiting for review.', revMineEmpty: 'You have not reviewed anything yet.', revOpen: 'Review', revTitle: 'Review content', revVerdict: 'Verdict', revOk: 'Looks good', revFix: 'Needs changes', revScore: 'Suggested bonus (pts)', revComment: 'Comment', revCommentPh: 'What did you check? What should change?', revSend: 'Send to admin', revHint: 'Your review is a recommendation — the admin gives the final score.', revNeedVerdict: 'Choose a verdict first.', revNeedScore: 'Pick a suggested bonus.', revNeedComment: 'Say what needs to change.', revSent: 'Review sent', revYou: 'You suggested', title: 'Content', viewAs: 'View as', modeIntern: 'Intern', modeContent: 'Content', viewList: 'List view', viewMonth: 'Calendar view', calMonth: 'Month', calWeek: 'Week', calDay: 'Day', viewBoard: 'Board view', brief: 'Brief / script', briefPh: 'Outline, hook, script, shot list…', steps: 'Checklist', stepPh: 'Add a step', stepAdd: 'Add', stepTpl: 'Use standard steps', links: 'Links (Drive, footage, thumbnail…)', badLink: 'Links must start with http:// or https://', tooMany: 'Up to 15 steps and 5 links.', movePrev: 'Move back a step', moveNext: 'Move to the next step', planDay: 'Plan', emptyDay: 'Nothing on this day yet.', pickDay: 'Tap a day to see or plan content.', plan: 'Due date (optional)', ideas: 'Ideas', drafts: 'Drafts', posted: 'Posted', platforms: 'Platforms', reviewed: 'Reviewed', pending: 'Pending review', add: 'New content', addNum: 'Add numbers',
            emptyIdeas: 'No ideas yet. Jot one down before you forget it.', emptyDrafts: 'No drafts yet.', emptyPosted: 'Nothing posted yet. Share your first piece.',
            sheet: 'Submit content', edit: 'Edit content', stage: 'Stage', platform: 'Platform', type: 'Type', caption: 'Caption or idea', capPh: 'What is this content about?',
            images: 'Images', addImg: 'Add', link: 'Post link', date: 'Post date', send: 'Send for review', save: 'Save', saving: 'Saving…', other: 'Case, Work, Event… (other submissions)', del: 'Delete this draft', delAsk: 'Delete this draft?',
            hintPosted: 'Posted content is reviewed by the admin. Add numbers later from the card.', hintLocal: 'Saved for you only until you mark it Posted.',
            needCap: 'Write a caption or idea first.', needLink: 'Paste the post link (starting with http).', needDate: 'Pick the post date.', full: 'You already have 30 saved. Delete one first.', fail: 'Could not save. Please try again.', noimg: 'That image could not be read.',
            numTitle: 'Add numbers', likes: 'Likes', reach: 'Reach', numHint: 'Update any time — the latest numbers are what the admin sees.', saveNum: 'Save numbers', badNum: 'Enter whole numbers, zero or more.', likeReach: 'Likes cannot be higher than reach.', savedNum: 'Saved.', sentToast: 'Sent for review', savedToast: 'Saved' },
        th: { review: 'ตรวจงาน', revTodo: 'รอตรวจ', revMine: 'ที่ฉันตรวจแล้ว', revEmpty: 'ยังไม่มีงานรอตรวจ', revMineEmpty: 'ยังไม่ได้ตรวจงานชิ้นไหน', revOpen: 'ตรวจ', revTitle: 'ตรวจคอนเทนต์', revVerdict: 'ผลตรวจ', revOk: 'ผ่าน', revFix: 'ต้องแก้', revScore: 'โบนัสที่แนะนำ (pts)', revComment: 'ความเห็น', revCommentPh: 'ตรวจอะไรไปบ้าง ต้องแก้ตรงไหน', revSend: 'ส่งให้แอดมิน', revHint: 'ผลตรวจของคุณเป็นข้อเสนอ แอดมินเป็นคนให้คะแนนจริง', revNeedVerdict: 'เลือกผลตรวจก่อน', revNeedScore: 'เลือกโบนัสที่แนะนำ', revNeedComment: 'บอกหน่อยว่าต้องแก้อะไร', revSent: 'ส่งผลตรวจแล้ว', revYou: 'คุณแนะนำ', title: 'คอนเทนต์', viewAs: 'มุมมอง', modeIntern: 'Intern', modeContent: 'คอนเทนต์', viewList: 'มุมมองรายการ', viewMonth: 'มุมมองปฏิทิน', calMonth: 'เดือน', calWeek: 'สัปดาห์', calDay: 'วัน', viewBoard: 'มุมมองบอร์ด', brief: 'บรีฟ / สคริปต์', briefPh: 'โครงเรื่อง ฮุค สคริปต์ รายการช็อต…', steps: 'เช็กลิสต์', stepPh: 'เพิ่มขั้นตอน', stepAdd: 'เพิ่ม', stepTpl: 'ใช้ขั้นตอนมาตรฐาน', links: 'ลิงก์ (Drive ฟุตเทจ ภาพปก…)', badLink: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', tooMany: 'ได้สูงสุด 15 ขั้นตอนและ 5 ลิงก์', movePrev: 'ย้อนกลับหนึ่งขั้น', moveNext: 'ไปขั้นถัดไป', planDay: 'วางแผน', emptyDay: 'วันนี้ยังไม่มีอะไร', pickDay: 'แตะวันที่เพื่อดูหรือวางแผนคอนเทนต์', plan: 'กำหนดส่ง (ไม่บังคับ)', ideas: 'ไอเดีย', drafts: 'ฉบับร่าง', posted: 'โพสต์แล้ว', platforms: 'แพลตฟอร์ม', reviewed: 'ตรวจแล้ว', pending: 'รอตรวจ', add: 'เพิ่มคอนเทนต์', addNum: 'เพิ่มตัวเลข',
            emptyIdeas: 'ยังไม่มีไอเดีย จดไว้ก่อนลืมนะ', emptyDrafts: 'ยังไม่มีฉบับร่าง', emptyPosted: 'ยังไม่มีงานที่โพสต์ ลองส่งชิ้นแรกดู',
            sheet: 'ส่งคอนเทนต์', edit: 'แก้คอนเทนต์', stage: 'ขั้นตอน', platform: 'แพลตฟอร์ม', type: 'ประเภท', caption: 'แคปชั่นหรือไอเดีย', capPh: 'คอนเทนต์นี้เกี่ยวกับอะไร',
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
    function stageLabel(id) { var s = STAGES[STAGE_IDS.indexOf(id)] || STAGES[0]; return s[lang() === 'th' ? 2 : 1]; }
    function typeLabel(k) { return (TYPES[k] || TYPES.post)[lang() === 'th' ? 1 : 0]; }
    function todayKey() { try { return getBangkokDateTimeParts().dateKey; } catch (_) { return new Date().toISOString().slice(0, 10); } }
    function dayLabel(key) { var d = new Date(String(key) + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
    // ---------- who sees which UI ----------
    // A user has ONE primary group (users.group — rules, leaderboard, quizzes and events all follow it) and, set by an admin only, optional
    // extra groups (users.extraGroups) that decide nothing but which UI(s) they may open. A group inside the Content Creator division opens the
    // Content UI; a user who also has a group outside it can flip between the two (Intern | Content), remembered per user in this browser.
    function divisionOfGroup(g) {
        try {
            var cfg = typeof divisionConfig !== 'undefined' && divisionConfig ? divisionConfig : {}, key = String(g || '').trim().toLowerCase();
            for (var d in cfg) if ((cfg[d] || []).some(function (x) { return String(x).trim().toLowerCase() === key; })) return d;
        } catch (_) { /* config not loaded yet */ }
        return '';
    }
    function isCreatorDivision(name) { return DIVISIONS.indexOf(String(name || '').replace(/\s+/g, ' ').trim().toLowerCase()) >= 0; }
    function memberships() {
        var primary = typeof myGroup !== 'undefined' ? myGroup : '', extras = Array.isArray(window.myExtraGroups) ? window.myExtraGroups : [];
        var pc = isCreatorDivision(divisionOfGroup(primary)), ec = extras.some(function (g) { return isCreatorDivision(divisionOfGroup(g)); });
        var internSide = !pc || extras.some(function (g) { return g && !isCreatorDivision(divisionOfGroup(g)); });
        return { creator: pc || ec, both: (pc || ec) && internSide, primaryCreator: pc };
    }
    function modeKey() { return 'contentViewMode:' + (typeof userId !== 'undefined' ? userId : ''); }
    function getMode(m) { try { var v = localStorage.getItem(modeKey()); if (v === 'content' || v === 'intern') return v; } catch (_) { /* storage may be blocked */ } return m.primaryCreator ? 'content' : 'intern'; }
    function isCafe() { try { var m = memberships(); return m.creator && (!m.both || getMode(m) === 'content'); } catch (_) { return false; } }
    var switchSig = '';
    function paintSwitch() {
        var el = document.getElementById('cafe-view-switch'); if (!el) return;
        var m = memberships(), mode = m.both ? getMode(m) : '', sig = m.both + '|' + mode + '|' + lang();
        if (sig === switchSig) return;
        switchSig = sig;
        if (!m.both) { el.hidden = true; el.innerHTML = ''; return; }
        var t = L();
        el.innerHTML = '<div class="cc-switch" role="group" aria-label="' + esc(t.viewAs) + '"><span>' + esc(t.viewAs) + '</span>' +
            '<button type="button" data-mode="intern" aria-pressed="' + (mode === 'intern') + '">' + esc(t.modeIntern) + '</button><button type="button" data-mode="content" aria-pressed="' + (mode === 'content') + '">' + esc(t.modeContent) + '</button></div>';
        el.hidden = false;
        if (!el.dataset.wired) { el.dataset.wired = '1'; el.addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (!b) return; try { localStorage.setItem(modeKey(), b.dataset.mode); } catch (_) { /* storage may be blocked */ } sync(); }); }
    }
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
    var view = (function () { try { var v = localStorage.getItem('cafeContentView'); return v === 'month' || v === 'board' ? v : 'list'; } catch (_) { return 'list'; } })();
    var viewMonth = '', selDay = '', anchor = '';
    // The calendar view has three modes (Month grid, Week, Day); Week and Day are read around `anchor`.
    var calMode = (function () { try { var v = localStorage.getItem('cafeContentCal'); return v === 'week' || v === 'day' ? v : 'month'; } catch (_) { return 'month'; } })();
    var allPosts = [], unsubAll = null, myReviews = {}, revFilter = 'todo';
    var REVIEWER_GROUPS = ['audit'];   // a group (primary or extra) named like this gets the Review view — a UI choice, not a permission
    function isReviewer() {
        try {
            var gs = [typeof myGroup !== 'undefined' ? myGroup : ''].concat(Array.isArray(window.myExtraGroups) ? window.myExtraGroups : []);
            return gs.some(function (g) { return REVIEWER_GROUPS.indexOf(String(g || '').trim().toLowerCase()) >= 0; });
        } catch (_) { return false; }
    }
    function monthShift(key, delta) { var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + delta; var d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7); }
    function setView(v) {
        view = v;
        if (v !== 'review') { try { localStorage.setItem('cafeContentView', v); } catch (_) { /* storage may be blocked */ } }   // Review is never the remembered view
        if (v === 'month' && !viewMonth) viewMonth = todayKey().slice(0, 7);
        if (v === 'review') listenAll();
        render();
    }

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
            '<div class="cc-meta"><span class="cc-pill">' + esc(typeLabel(d.ctype)) + '</span><span>' + esc(p[1]) + (d.plannedDate ? ' · ' + esc(dayLabel(d.plannedDate)) : '') + '</span><span class="cc-pill plan">' + esc(stageLabel(d.stage)) + '</span></div>' +
            '<div class="cc-cap">' + esc(d.caption) + '</div>' + detailBits(d) + '</div></div>';
    }

    // ---------- board (one column per stage; Posted is read-only, from works) ----------
    function dueChip(d) {
        if (!d.plannedDate) return '';
        var today = todayKey(), cls = d.plannedDate < today ? ' late' : d.plannedDate === today ? ' now' : '';
        return '<span class="cc-due' + cls + '"><i class="fa-regular fa-clock"></i> ' + esc(dayLabel(d.plannedDate)) + '</span>';
    }
    function detailBits(d) {
        var ck = d.checklist || [], done = ck.filter(function (c) { return c.d; }).length, h = '';
        if (ck.length) h += '<span class="cc-bit' + (done === ck.length ? ' full' : '') + '"><i class="fa-solid fa-list-check"></i> ' + done + '/' + ck.length + '</span>';
        if (d.links && d.links.length) h += '<span class="cc-bit"><i class="fa-solid fa-link"></i> ' + d.links.length + '</span>';
        if (d.brief) h += '<span class="cc-bit"><i class="fa-solid fa-align-left"></i></span>';
        return h ? '<div class="cc-foot">' + h + '</div>' : '';
    }
    function boardCard(d, i, t) {
        var p = plat(d.platform);
        return '<div class="cc-kc" data-act="draft" data-id="' + esc(d.id) + '"><div class="cc-meta"><i class="' + p[2] + '" style="color:' + (PLAT_COLOR[d.platform] || '#64748b') + '"></i><span class="cc-pill">' + esc(typeLabel(d.ctype)) + '</span>' + dueChip(d) + '</div>' +
            '<div class="cc-cap">' + esc(d.caption) + '</div>' + detailBits(d) + '<div class="cc-kmv">' +
            (i > 0 ? '<button type="button" data-act="mv" data-d="-1" data-id="' + esc(d.id) + '" aria-label="' + t.movePrev + '">&lsaquo;</button>' : '<span></span>') +
            '<button type="button" data-act="mv" data-d="1" data-id="' + esc(d.id) + '" aria-label="' + t.moveNext + '">&rsaquo;</button></div></div>';
    }
    function boardHtml(t, posted) {
        var cols = STAGES.map(function (s, i) {
            var items = drafts.filter(function (d) { return d.stage === s[0]; }).sort(function (a, b) { return String(a.plannedDate || '9999').localeCompare(String(b.plannedDate || '9999')) || (b.updatedAt || 0) - (a.updatedAt || 0); });
            return '<section class="cc-col"><div class="cc-colh"><b>' + esc(s[lang() === 'th' ? 2 : 1]) + '</b><span>' + items.length + '</span></div>' + items.map(function (d) { return boardCard(d, i, t); }).join('') +
                '<button type="button" class="cc-chip cc-colbtn" data-act="newin" data-stage="' + s[0] + '" aria-label="' + esc(t.add) + '"><i class="fa-solid fa-plus"></i></button></section>';
        }).join('');
        var last = posted.slice(0, 10).map(function (w) {
            var p = plat(w.platform);
            return '<div class="cc-kc" data-act="metrics" data-id="' + esc(w.id) + '"><div class="cc-meta"><i class="' + p[2] + '" style="color:' + (PLAT_COLOR[w.platform] || '#64748b') + '"></i><span class="cc-pill">' + esc(typeLabel(w.ctype)) + '</span><span>' + esc(dayLabel(w.postDate)) + '</span></div>' +
                '<div class="cc-cap">' + esc(w.caption || w.title) + '</div><div class="cc-foot">' + (isReviewed(w) ? '<span class="cc-pill done">' + t.reviewed + (Number(w.score) ? ' +' + esc(fmtScore(w.score)) : '') + '</span>' : '<span class="cc-pill pending">' + t.pending + '</span>') + '</div></div>';
        }).join('');
        return '<div class="cc-board">' + cols + '<section class="cc-col"><div class="cc-colh"><b>' + t.posted + '</b><span>' + posted.length + '</span></div>' + last + '</section></div>';
    }
    function moveStage(id, dir) {
        var d = drafts.filter(function (x) { return x.id === id; })[0], j = d ? STAGE_IDS.indexOf(d.stage) + dir : -1;
        if (!d || busy || j < 0) return;
        if (j >= STAGE_IDS.length) return openSheet(d, { stage: 'posted' });   // past Scheduled = Posted, which needs the link + date
        busy = true;
        saveDrafts(drafts.map(function (x) { return x.id === id ? Object.assign({}, x, { stage: STAGE_IDS[j], updatedAt: Date.now() }) : x; }))
            .then(render).catch(function (e) { console.warn('[cafe] move failed', e); if (typeof showToast === 'function') showToast(L().fail); })
            .then(function () { busy = false; });
    }

    function sentLine(w, t) {
        var r = myReviews[w.id];
        return r ? '<div class="cc-sent">' + esc(t.revYou) + ' ' + (r.verdict === 'approve' ? '✅ +' + esc(fmtScore(r.score)) : '↩ ' + esc(t.revFix)) + '</div>' : '';
    }
    function reviewRow(w, t) {
        var p = plat(w.platform), m = w.metrics && (w.metrics.likes != null || w.metrics.reach != null) ? w.metrics : null;
        var imgs = (w.images || []).slice(0, 3).map(function (u) { return '<img src="' + esc(u) + '" alt="">'; }).join('');
        return '<div class="cc-row cc-rv" data-act="review" data-id="' + esc(w.id) + '">' + thumb(p, w.images && w.images[0]) + '<div class="cc-main">' +
            '<div class="cc-meta"><b>' + esc(w.displayName || '') + '</b><span class="cc-pill">' + esc(typeLabel(w.ctype)) + '</span><span>' + esc(p[1]) + ' · ' + esc(dayLabel(w.postDate)) + '</span></div>' +
            '<div class="cc-cap">' + esc(w.caption || w.title) + '</div>' + (imgs ? '<div class="cc-mini">' + imgs + '</div>' : '') +
            '<div class="cc-foot">' + (m ? '<span><i class="fa-solid fa-heart"></i> ' + esc(fmtNum(m.likes || 0)) + '</span><span><i class="fa-solid fa-eye"></i> ' + esc(fmtNum(m.reach || 0)) + '</span>' : '') +
            '<span class="cc-pill pending" style="margin-left:auto">' + esc(t.revOpen) + ' ›</span></div>' + sentLine(w, t) + '</div></div>';
    }
    function reviewHtml(t) {
        var others = allPosts.filter(function (w) { return w.userId !== userId; });
        var todo = others.filter(function (w) { return !isReviewed(w) && !myReviews[w.id]; }), mine = others.filter(function (w) { return myReviews[w.id]; });
        var list = revFilter === 'mine' ? mine : todo;
        return '<div class="cc-rail" role="group">' + [['todo', t.revTodo, todo.length], ['mine', t.revMine, mine.length]].map(function (c) {
            return '<button type="button" class="cc-chip" data-rvf="' + c[0] + '" aria-pressed="' + (revFilter === c[0]) + '">' + c[1] + ' ' + c[2] + '</button>';
        }).join('') + '</div>' + (list.length ? list.map(function (w) { return reviewRow(w, t); }).join('') : '<div class="cc-empty">' + (revFilter === 'mine' ? t.revMineEmpty : t.revEmpty) + '</div>');
    }

    function dateAdd(key, n) { var d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function dayFull(key) { return new Date(key + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); }
    function calRail(t) {
        return '<div class="cc-rail" role="group">' + [['month', t.calMonth], ['week', t.calWeek], ['day', t.calDay]].map(function (c) {
            return '<button type="button" class="cc-chip" data-cm="' + c[0] + '" aria-pressed="' + (calMode === c[0]) + '">' + c[1] + '</button>';
        }).join('') + '</div>';
    }
    // Week (Sun–Sat, like the month grid) or a single Day: each day is a header with its own Plan button, then that day's posts and planned cards.
    function rangeHtml(t, posted) {
        if (!anchor) anchor = selDay || todayKey();
        var one = calMode === 'day', start = one ? anchor : dateAdd(anchor, -new Date(anchor + 'T12:00:00Z').getUTCDay()), today = todayKey();
        var h = '<div class="cc-calnav"><button type="button" class="cc-chip" data-wk="-1" aria-label="' + (one ? 'Previous day' : 'Previous week') + '">&lsaquo;</button><b>' + esc(one ? dayFull(start) : dayLabel(start) + ' – ' + dayLabel(dateAdd(start, 6))) +
            '</b><button type="button" class="cc-chip" data-wk="1" aria-label="' + (one ? 'Next day' : 'Next week') + '">&rsaquo;</button></div>';
        for (var i = 0; i < (one ? 1 : 7); i++) {
            var key = dateAdd(start, i);
            var rows = posted.filter(function (w) { return w.postDate === key; }).map(function (w) { return postedRow(w, t); }).join('') +
                drafts.filter(function (d) { return d.plannedDate === key; }).map(function (d) { return draftRow(d, t); }).join('');
            h += '<div class="cc-dayhead' + (key === today ? ' today' : '') + '"><b>' + esc(dayFull(key)) + '</b><button type="button" class="cc-chip" data-act="plan" data-day="' + key + '"><i class="fa-solid fa-plus"></i> ' + t.planDay + '</button></div>' +
                (rows || (one ? '<div class="cc-empty">' + t.emptyDay + '</div>' : ''));
        }
        return h;
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
        if (view === 'review' && !isReviewer()) view = 'list';
        var t = L(), posted = postedList(), ideas = drafts.filter(function (d) { return d.stage === 'idea'; }), dr = drafts.filter(function (d) { return d.stage !== 'idea'; });
        if (!viewMonth) viewMonth = todayKey().slice(0, 7);
        var month = view === 'month' ? viewMonth : todayKey().slice(0, 7), mp = posted.filter(function (w) { return String(w.postDate || '').slice(0, 7) === month; });
        var plats = {}; mp.forEach(function (w) { plats[w.platform] = 1; });
        var rev = mp.filter(isReviewed).length, body = '';
        if (view === 'review') body = reviewHtml(t);
        else if (view === 'month') body = calRail(t) + (calMode === 'month' ? monthHtml(t, posted) : rangeHtml(t, posted));
        else if (view === 'board') body = boardHtml(t, posted);
        else {
            var rows = filter === 'posted' ? posted.map(function (w) { return postedRow(w, t); }).join('') : (filter === 'ideas' ? ideas : dr).map(function (d) { return draftRow(d, t); }).join('');
            if (!rows) rows = '<div class="cc-empty">' + (filter === 'ideas' ? t.emptyIdeas : filter === 'drafts' ? t.emptyDrafts : t.emptyPosted) + '</div>';
            body = '<div class="cc-rail" role="group">' + [['ideas', t.ideas, ideas.length], ['drafts', t.drafts, dr.length], ['posted', t.posted, posted.length]].map(function (c) {
                return '<button type="button" class="cc-chip" data-filter="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '">' + c[1] + ' ' + c[2] + '</button>';
            }).join('') + '</div>' + rows;
        }
        var monthName = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 15)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
        host.innerHTML = '<div class="cc-card"><div class="cc-head"><i class="fa-solid fa-camera"></i> ' + t.title + '<span class="cc-month">' + esc(monthName) + '</span>' +
            '<span class="cc-view" role="group" aria-label="View"><button type="button" data-view="list" aria-pressed="' + (view === 'list') + '" aria-label="' + t.viewList + '"><i class="fa-solid fa-list"></i></button><button type="button" data-view="month" aria-pressed="' + (view === 'month') + '" aria-label="' + t.viewMonth + '"><i class="fa-solid fa-calendar-days"></i></button><button type="button" data-view="board" aria-pressed="' + (view === 'board') + '" aria-label="' + t.viewBoard + '"><i class="fa-solid fa-table-columns"></i></button>' +
            (isReviewer() ? '<button type="button" data-view="review" aria-pressed="' + (view === 'review') + '" aria-label="' + t.review + '" title="' + t.review + '"><i class="fa-solid fa-clipboard-check"></i></button>' : '') + '</span></div>' +
            (view === 'review' ? '' : '<div class="cc-stats"><div class="cc-stat"><span>' + t.posted + '</span><b>' + mp.length + '</b></div><div class="cc-stat"><span>' + t.platforms + '</span><b>' + Object.keys(plats).length + '</b></div><div class="cc-stat"><span>' + t.reviewed + '</span><b>' + rev + '/' + mp.length + '</b></div></div>') +
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
                myReviews = (s.exists && (s.data() || {}).contentReviews) || {};
                drafts = Array.isArray(a) ? a.filter(function (d) { return d && d.id && STAGE_IDS.indexOf(d.stage) >= 0; }) : [];
                render();
            }, function (e) { console.warn('[cafe] drafts listener', e); });
        });
    }
    // Reviewers see every member's posts (works are readable by any signed-in user, as before).
    function listenAll() {
        if (unsubAll || !isReviewer() || !on || !userId) return;
        ensureFirebaseAuthReady(10000).then(function (u) {
            if (!u || unsubAll) return;
            unsubAll = db.collection('works').where('kind', '==', 'social').onSnapshot(function (snap) {
                allPosts = snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }).sort(function (a, b) { return String(b.postDate || '').localeCompare(String(a.postDate || '')); });
                render();
            }, function (e) { unsubAll = null; console.warn('[cafe] review listener', e); });
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
        overlay.addEventListener('keydown', function (e) { if (e.key === 'Enter' && sheet && e.target && (e.target.id === 'ccCkNew' || e.target.id === 'ccLnNew')) { e.preventDefault(); setErr(takePending()); } });
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
        sheet = { id: d ? d.id : '', stage: (preset && preset.stage) || (d ? d.stage : preset ? 'idea' : 'posted'), platform: d ? d.platform : 'ig', ctype: d ? d.ctype : 'post', images: (d && d.images ? d.images : []).map(function (u) { return { url: u }; }),
            checklist: (d && d.checklist ? d.checklist : []).map(function (c) { return { t: c.t, d: !!c.d }; }), links: (d && d.links ? d.links : []).slice() };
        overlay.innerHTML = '<div class="cc-box"><div class="cc-bh"><i class="fa-solid fa-camera"></i> ' + (d ? t.edit : t.sheet) + '<button type="button" class="cc-x" data-act="close" aria-label="Close">&times;</button></div>' +
            '<span class="cc-lbl">' + t.stage + '</span>' + chips('stage', STAGES.map(function (s) { return [s[0], s[lang() === 'th' ? 2 : 1]]; }).concat([['posted', t.posted]]), sheet.stage) +
            '<span class="cc-lbl">' + t.platform + '</span>' + chips('platform', PLATFORMS, sheet.platform) +
            '<span class="cc-lbl">' + t.type + '</span>' + chips('ctype', Object.keys(TYPES).map(function (k) { return [k, TYPES[k][lang() === 'th' ? 1 : 0]]; }), sheet.ctype) +
            '<span class="cc-lbl">' + t.caption + '</span><textarea id="ccCap" rows="3" maxlength="1000" placeholder="' + esc(t.capPh) + '">' + esc(d ? d.caption : '') + '</textarea>' +
            '<span class="cc-lbl">' + t.images + '</span><div class="cc-imgs" id="ccImgs"></div>' +
            '<div id="ccDetail"><span class="cc-lbl">' + t.brief + '</span><textarea id="ccBrief" rows="3" maxlength="' + MAX_BRIEF + '" placeholder="' + esc(t.briefPh) + '">' + esc((d && d.brief) || '') + '</textarea>' +
            '<span class="cc-lbl">' + t.steps + '</span><div id="ccSteps"></div><div class="cc-add2"><input type="text" id="ccCkNew" maxlength="80" placeholder="' + esc(t.stepPh) + '"><button type="button" class="cc-chip" data-act="ckadd">' + t.stepAdd + '</button></div>' +
            '<span class="cc-lbl">' + t.links + '</span><div id="ccLinks"></div><div class="cc-add2"><input type="text" id="ccLnNew" maxlength="300" placeholder="https://…"><button type="button" class="cc-chip" data-act="lnadd">' + t.stepAdd + '</button></div></div>' +
            '<div id="ccPlan"><span class="cc-lbl">' + t.plan + '</span><input type="date" id="ccPlanDate" value="' + esc((d && d.plannedDate) || (preset && preset.plannedDate) || '') + '"></div>' +
            '<div id="ccPosted"><span class="cc-lbl">' + t.link + '</span><input type="text" id="ccLink" maxlength="500" placeholder="https://…"><span class="cc-lbl">' + t.date + '</span><input type="date" id="ccDate" value="' + esc(todayKey()) + '" max="' + esc(todayKey()) + '"></div>' +
            '<div class="cc-err" id="ccErr" role="status"></div><button type="button" class="cc-go" id="ccGo" data-act="save"></button>' +
            '<div class="cc-err" style="color:#64748b;text-align:center" id="ccHint"></div>' +
            (d ? '<button type="button" class="cc-link danger" data-act="del">' + t.del + '</button>' : '<button type="button" class="cc-link" data-act="other">' + t.other + '</button>') + '</div>';
        paintImages(); paintDetail(); paintStage();
        overlay.classList.add('open');
    }
    function paintDetail() {
        var t = L(), steps = sheet.checklist.map(function (c, i) {
            return '<label class="cc-step' + (c.d ? ' done' : '') + '"><input type="checkbox" data-act="ckdone" data-i="' + i + '"' + (c.d ? ' checked' : '') + '><span>' + esc(c.t) + '</span><button type="button" data-act="ckdel" data-i="' + i + '" aria-label="Remove">&times;</button></label>';
        }).join('');
        if (!sheet.checklist.length) steps = '<button type="button" class="cc-chip" data-act="cktpl">' + t.stepTpl + '</button>';
        overlay.querySelector('#ccSteps').innerHTML = steps;
        overlay.querySelector('#ccLinks').innerHTML = sheet.links.map(function (u, i) {
            return '<div class="cc-step"><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//i, '').slice(0, 48)) + '</a><button type="button" data-act="lndel" data-i="' + i + '" aria-label="Remove">&times;</button></div>';
        }).join('');
    }
    // Typed but not yet added: Save must not lose it. Returns an error message, or '' when everything pending was taken in.
    function takePending() {
        var t = L(), ck = overlay.querySelector('#ccCkNew'), ln = overlay.querySelector('#ccLnNew'), s = ck.value.trim(), u = ln.value.trim();
        if (s) { if (sheet.checklist.length >= MAX_STEPS) return t.tooMany; sheet.checklist.push({ t: s.slice(0, 80), d: false }); ck.value = ''; }
        if (u) { if (!/^https?:\/\/\S+$/i.test(u)) return t.badLink; if (sheet.links.length >= MAX_LINKS) return t.tooMany; sheet.links.push(u.slice(0, 300)); ln.value = ''; }
        paintDetail();
        return '';
    }
    function paintStage() {
        var t = L(), posted = sheet.stage === 'posted';
        overlay.querySelector('#ccDetail').style.display = posted ? 'none' : 'block';
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
            if (chip.dataset.group === 'rvverdict') paintReview();
            return;
        }
        var a = e.target.closest('[data-act]'); if (!a) return;
        var act = a.dataset.act;
        if (act === 'close') closeSheet();
        else if (act === 'rmimg') { sheet.images.splice(+a.dataset.i, 1); paintImages(); }
        else if (act === 'other') { closeSheet(); if (typeof openUnifiedModal === 'function') openUnifiedModal(); }
        else if (act === 'ckadd' || act === 'lnadd') setErr(takePending());
        else if (act === 'ckdel') { sheet.checklist.splice(+a.dataset.i, 1); paintDetail(); }
        else if (act === 'lndel') { sheet.links.splice(+a.dataset.i, 1); paintDetail(); }
        else if (act === 'ckdone') { var c = sheet.checklist[+a.dataset.i]; if (c) { c.d = a.checked; a.closest('.cc-step').classList.toggle('done', c.d); } }
        else if (act === 'cktpl') { sheet.checklist = (lang() === 'th' ? ['สคริปต์', 'ถ่ายทำ', 'ตัดต่อ', 'ภาพปก', 'แคปชั่นและแฮชแท็ก'] : ['Script', 'Shoot', 'Edit', 'Thumbnail', 'Caption & hashtags']).map(function (s) { return { t: s, d: false }; }); paintDetail(); }
        else if (act === 'save') save();
        else if (act === 'del') del();
        else if (act === 'savenum') saveNumbers(a.dataset.id);
        else if (act === 'rvsend') sendReview();
    }

    function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    async function save() {
        if (busy || !sheet) return;
        var t = L(), cap = overlay.querySelector('#ccCap').value.trim(), posted = sheet.stage === 'posted', link = '', date = '';
        if (!cap) return setErr(t.needCap);
        if (!posted) { var pend = takePending(); if (pend) return setErr(pend); }
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
                var brief = overlay.querySelector('#ccBrief').value.trim();   // empty detail is left off so a plain card stays as small as before
                if (brief) item.brief = brief.slice(0, MAX_BRIEF);
                if (sheet.checklist.length) item.checklist = sheet.checklist;
                if (sheet.links.length) item.links = sheet.links;
                if (/^\d{4}-\d{2}-\d{2}$/.test(plan)) { item.plannedDate = plan; viewMonth = plan.slice(0, 7); selDay = plan; anchor = plan; }
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

    // ---------- review (Audit) ----------
    function openReview(id) {
        var w = allPosts.filter(function (x) { return x.id === id; })[0]; if (!w || w.userId === userId) return;
        ensureOverlay(); var t = L(), p = plat(w.platform), m = w.metrics || {}, prev = myReviews[id] || null;
        sheet = { review: id, rvverdict: prev ? prev.verdict : '', rvscore: prev && prev.verdict === 'approve' ? String(prev.score) : '' };
        var imgs = (w.images || []).map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt=""></a>'; }).join('');
        overlay.innerHTML = '<div class="cc-box"><div class="cc-bh"><i class="fa-solid fa-clipboard-check"></i> ' + t.revTitle + '<button type="button" class="cc-x" data-act="close" aria-label="Close">&times;</button></div>' +
            '<div class="cc-row" style="padding:12px 0;cursor:default">' + thumb(p, null) + '<div class="cc-main"><div class="cc-meta"><b>' + esc(w.displayName || '') + '</b><span class="cc-pill">' + esc(typeLabel(w.ctype)) + '</span><span>' + esc(p[1]) + ' · ' + esc(dayLabel(w.postDate)) + '</span></div>' +
            '<div class="cc-cap" style="-webkit-line-clamp:unset">' + esc(w.caption || w.title) + '</div>' +
            (/^https?:\/\//i.test(w.link || '') ? '<a href="' + esc(w.link) + '" target="_blank" rel="noopener" style="font-size:.78em;word-break:break-all">' + esc(w.link) + '</a>' : '') +
            (m.likes != null || m.reach != null ? '<div class="cc-foot"><span><i class="fa-solid fa-heart"></i> ' + esc(fmtNum(m.likes || 0)) + '</span><span><i class="fa-solid fa-eye"></i> ' + esc(fmtNum(m.reach || 0)) + '</span></div>' : '') +
            (imgs ? '<div class="cc-mini">' + imgs + '</div>' : '') + '</div></div>' +
            '<span class="cc-lbl">' + t.revVerdict + '</span>' + chips('rvverdict', [['approve', t.revOk], ['changes', t.revFix]], sheet.rvverdict) +
            '<div id="rvScoreBox"><span class="cc-lbl">' + t.revScore + '</span>' + chips('rvscore', [['0', '0'], ['0.1', '0.1'], ['0.2', '0.2'], ['0.3', '0.3']], sheet.rvscore) + '</div>' +
            '<span class="cc-lbl">' + t.revComment + '</span><textarea id="rvComment" rows="3" maxlength="500" placeholder="' + esc(t.revCommentPh) + '">' + esc(prev && prev.comment ? prev.comment : '') + '</textarea>' +
            '<div class="cc-err" id="ccErr" role="status"></div><button type="button" class="cc-go" id="ccGo" data-act="rvsend">' + t.revSend + '</button>' +
            '<div class="cc-err" style="color:#64748b;text-align:center">' + t.revHint + '</div></div>';
        paintReview();
        overlay.classList.add('open');
    }
    function paintReview() { overlay.querySelector('#rvScoreBox').style.display = sheet.rvverdict === 'approve' ? 'block' : 'none'; }
    async function sendReview() {
        if (busy || !sheet || !sheet.review) return;
        var t = L(), id = sheet.review, w = allPosts.filter(function (x) { return x.id === id; })[0], verdict = sheet.rvverdict, comment = overlay.querySelector('#rvComment').value.trim();
        if (!w) return;
        if (!verdict) return setErr(t.revNeedVerdict);
        if (verdict === 'approve' && sheet.rvscore === '') return setErr(t.revNeedScore);
        if (verdict === 'changes' && comment.length < 3) return setErr(t.revNeedComment);
        var score = verdict === 'approve' ? Number(sheet.rvscore) : 0;
        busy = true; var go = overlay.querySelector('#ccGo'); go.disabled = true; setErr(t.saving, true);
        try {
            var auth = await ensureFirebaseAuthReady(10000);
            if (!auth) throw new Error('Sign in required');
            await db.collection('admin_notifications').add({
                type: 'content_review', authUid: auth.uid, workId: id, workTitle: String(w.title || '').slice(0, 200), ownerId: w.userId || '', ownerName: w.displayName || '',
                reviewerId: userId, reviewerName: (typeof userProfile !== 'undefined' && userProfile && userProfile.displayName) || '',
                verdict: verdict, suggestedScore: score, comment: comment.slice(0, 500), read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            var upd = {}; upd['contentReviews.' + id] = { verdict: verdict, score: score, comment: comment.slice(0, 500), at: Date.now() };
            await db.collection('users').doc(userId).update(upd);   // update, not set-merge: must never re-create a deleted user's doc
            myReviews[id] = upd['contentReviews.' + id];
            if (typeof showToast === 'function') showToast(t.revSent);
            closeSheet(); render();
        } catch (e) { console.error('[cafe] review failed', e); if (overlay.classList.contains('open')) setErr(t.fail); }
        finally { busy = false; var g = overlay && overlay.querySelector('#ccGo'); if (g) g.disabled = false; }
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
        var rf = e.target.closest('[data-rvf]'); if (rf) { revFilter = rf.dataset.rvf; return render(); }
        var cm = e.target.closest('[data-cm]');
        if (cm) {
            calMode = cm.dataset.cm; anchor = selDay || anchor || todayKey();
            if (calMode === 'month') { viewMonth = anchor.slice(0, 7); selDay = anchor; }
            try { localStorage.setItem('cafeContentCal', calMode); } catch (_) { /* storage may be blocked */ }
            return render();
        }
        var wk = e.target.closest('[data-wk]'); if (wk) { anchor = dateAdd(anchor || todayKey(), +wk.dataset.wk * (calMode === 'day' ? 1 : 7)); viewMonth = anchor.slice(0, 7); return render(); }
        var cal = e.target.closest('[data-cal]'); if (cal) { viewMonth = monthShift(viewMonth, +cal.dataset.cal); selDay = ''; return render(); }
        var dy = e.target.closest('[data-day]'); if (dy && !dy.dataset.act) { selDay = selDay === dy.dataset.day ? '' : dy.dataset.day; return render(); }
        var a = e.target.closest('[data-act]'); if (!a) return;
        e.stopPropagation();
        if (a.dataset.act === 'new') openSheet(null);
        else if (a.dataset.act === 'plan') openSheet(null, { plannedDate: a.dataset.day });
        else if (a.dataset.act === 'newin') openSheet(null, { stage: a.dataset.stage });
        else if (a.dataset.act === 'mv') moveStage(a.dataset.id, +a.dataset.d);
        else if (a.dataset.act === 'draft') openSheet(drafts.filter(function (d) { return d.id === a.dataset.id; })[0] || null);
        else if (a.dataset.act === 'metrics') openNumbers(a.dataset.id);
        else if (a.dataset.act === 'review') openReview(a.dataset.id);
    }
    function sync() {
        try {
            var now = isCafe();
            paintSwitch();
            if (now === on && (host || !now)) { if (now) listen(); return; }
            var was = on;
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
            if (was && !on && typeof updateEarnedBadgesBar === 'function') updateEarnedBadgesBar();   // flipped back to the Intern UI: the badge row returns
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
