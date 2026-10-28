// V101.232: the intern's own Journal progress card — the owner's final pick: "A + C + check" all INSIDE one heatmap (mockup "Heatmap all-in-one v1", 8 weeks).
// • Each heatmap cell holds the DAY NUMBER, the MOOD emoji and the mentor's WRITING CHECK (ตรวจภาษา: a coloured bar along the bottom — ดี green / พอใช้ amber /
//   ควรปรับ calm indigo, never red). The tint is the words written that day. There is no separate mood strip and no separate grade strip.
//   Rules: two entries on one day → the mood of the latest entry, the words added up, the best grade; no mood → a neutral "·"; no grade → nothing drawn (the
//   bars appear only once ≥2 entries have been graded); an empty weekend day is a 6 px strip with no number, a weekend day with an entry is a 16 px cell.
//   A month label sits above the first column and above the column holding the 1st (the "1" is bold + underlined); today has an amber outline; tapping a cell
//   selects it (dark outline) and its detail goes in ONE inline line (no modal).
// • Collapsed (default): chips + the last 4 weeks at 34 px cells with the detail line + legend beside the grid. Tap the header (≥40 px): 8 weeks + the old stats.
// • STREAK SKIPS WEEKENDS (owner): Sat / Sun never break it and never extend it by being empty; a weekend entry still counts as a written day (+1).
//   Fri → Mon is consecutive. Today not written yet keeps the streak alive until midnight Bangkok (a weekday only — a bare weekend day is just skipped).
//   This is a NEW helper for the card; getReflectiveStreak (History) and the Daily Streak (collectActivityDates → badges / Beri) are untouched.
// • The month chip is monthlyProgress.summary()'s own Journal row (same n and target as Schedule ▸ Goals): target set → "5/12" (green frame + ✓ at the target),
//   no target → just "5" (no default target); tapping it opens monthlyProgress.edit(). Weekend entries count in it.
// • The writing check (owner: "intern เห็นแนวโน้มเกรดไวยากรณ์"): the admin's latestGrammarGrade (ดี / พอใช้ / ควรปรับ, written by persistGrammarGrade in admin.html on the
//   reflective_logs doc) of the intern's own entries. Hidden under 2 graded entries; the one-line "mostly X" needs 3, its direction ("getting better") needs 6.
//   Read-only: the intern already receives these docs (where userId == me), no rules change.
// Pure part (streak / day map / heatmap / grades) is exposed for scripts/writing-progress-qa.cjs; the DOM part only fills #mwp-body.
(function () {
    'use strict';
    var GRADE = { 'ดี': 3, 'พอใช้': 2, 'ควรปรับ': 1 };
    var GRADE_KEY = { 3: 'good', 2: 'fair', 1: 'needs' };
    var MONTHS = {
        th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    };
    var DOW = { th: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ko: ['일', '월', '화', '수', '목', '금', '토'] };
    var ROWS = { th: ['จ', 'อ', 'พ', 'พฤ', 'ศ'], en: ['M', 'T', 'W', 'T', 'F'], ko: ['월', '화', '수', '목', '금'] };
    var D = {
        th: {
            title: 'พัฒนาการการเขียน', more: 'ดูรายละเอียด', less: 'ย่อ', streak: function (n) { return n + ' วัน'; }, best: function (n) { return 'ดีสุด ' + n; },
            fresh: 'เขียนวันละบันทึก — สัปดาห์แรกจะเริ่มเติมปฏิทิน', fresh2: 'เริ่มต้นดี! เขียนต่อทุกวันทำการ แล้วปฏิทินจะเติมขึ้นเรื่อยๆ',
            today: 'วันนี้', monthTip: 'ตั้งเป้าหมายรายเดือน', words: 'คำทั้งหมด', avg: 'เฉลี่ย', max: 'สูงสุด', days: 'วันที่เขียน', lang: 'ภาษา', mood: 'อารมณ์', chk: 'ตรวจภาษา',
            grade: { good: 'ดี', fair: 'พอใช้', needs: 'ควรปรับ' }, darker: 'สีเข้ม = คำมาก', bar: 'แถบล่าง = ตรวจภาษา', none: 'ไม่มีบันทึก',
            w: function (n) { return n + ' คำ'; }, entries: function (n) { return n + ' บันทึก'; }, date: function (w, d, m) { return DOW.th[w] + ' ' + d + ' ' + MONTHS.th[m]; },
            mostly: function (g) { return 'ผลตรวจล่าสุดส่วนใหญ่ ' + g; }, up: 'ดีขึ้นเรื่อยๆ', down: 'ช่วงนี้ต่ำลงเล็กน้อย', steady: 'คงที่'
        },
        en: {
            title: 'Writing progress', more: 'Details', less: 'Less', streak: function (n) { return n + 'd'; }, best: function (n) { return 'best ' + n; },
            fresh: 'Write once a day — your first week starts filling the calendar', fresh2: 'Good start! Keep writing on weekdays and the calendar fills up',
            today: 'Today', monthTip: 'Set a monthly goal', words: 'Total words', avg: 'avg', max: 'max', days: 'Active days', lang: 'Language', mood: 'Mood', chk: 'Writing check',
            grade: { good: 'Good', fair: 'Fair', needs: 'Needs work' }, darker: 'darker = more words', bar: 'bottom bar = writing check', none: 'no entry',
            w: function (n) { return n + (n === 1 ? ' word' : ' words'); }, entries: function (n) { return n + ' entries'; }, date: function (w, d, m) { return DOW.en[w] + ' ' + d + ' ' + MONTHS.en[m]; },
            mostly: function (g) { return 'Recent checks mostly ' + g; }, up: 'getting better', down: 'a little lower lately', steady: 'steady'
        },
        ko: {
            title: '글쓰기 현황', more: '자세히', less: '접기', streak: function (n) { return n + '일'; }, best: function (n) { return '최고 ' + n; },
            fresh: '하루에 한 편씩 써 보세요 — 첫 주부터 달력이 채워져요', fresh2: '좋은 시작이에요! 평일마다 쓰면 달력이 채워져요',
            today: '오늘', monthTip: '월간 목표 설정', words: '전체 단어', avg: '평균', max: '최대', days: '쓴 날', lang: '언어', mood: '기분', chk: '문법 점검',
            grade: { good: '좋음', fair: '보통', needs: '개선 필요' }, darker: '진할수록 단어 많음', bar: '아래 막대 = 문법 점검', none: '기록 없음',
            w: function (n) { return n + '단어'; }, entries: function (n) { return n + '건'; }, date: function (w, d, m) { return MONTHS.ko[m] + ' ' + d + '일 (' + DOW.ko[w] + ')'; },
            mostly: function (g) { return '최근 점검은 대부분 ' + g; }, up: '점점 좋아지고 있어요', down: '요즘 조금 낮아요', steady: '꾸준해요'
        }
    };
    var CSS = '.wp{color:#334155}.wp *{box-sizing:border-box}'
        + '.wp-head{display:flex;align-items:center;gap:8px;min-height:40px;width:100%;background:none;border:0;padding:0;text-align:left;cursor:pointer;font:inherit;color:inherit}'
        + '.wp-head b{font-size:.9em;font-weight:900;flex:1}.wp-head .wp-more{font-size:.72em;font-weight:800;color:#64748b;min-height:40px;display:flex;align-items:center;padding:0 2px}'
        + '.wp-chips{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 8px}'
        + '.wp-chip{font:inherit;font-size:11.5px;font-weight:800;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;white-space:nowrap;width:auto;min-height:0;line-height:1.5}'
        + 'button.wp-chip{cursor:pointer;position:relative}button.wp-chip::after{content:"";position:absolute;inset:-10px -3px;z-index:1}'
        + '.wp-chip.fire{background:#fff7ed;color:#9a3412;border-color:#fed7aa}.wp-chip.ok{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.wp-chip.todo{background:#fffbeb;color:#92400e;border-color:#fde68a}'
        + '.wp-note{font-size:.76em;font-weight:700;color:#64748b;line-height:1.4}'
        // the heatmap (mockup "Heatmap all-in-one v1")
        + '.hm{display:grid;gap:3px;align-items:stretch}.hm-wrap{position:relative}'
        + '.hm-m{font-size:9px;font-weight:800;color:#64748b;line-height:1;height:11px;white-space:nowrap;overflow:visible}'
        + '.hm-dow{font-size:9px;font-weight:800;color:#94a3b8;display:flex;align-items:center;justify-content:flex-end;padding-right:3px}'
        + '.hm-c{min-height:0;width:auto;position:relative;display:flex;align-items:center;justify-content:center;border:0;padding:0;margin:0;font:inherit;border-radius:5px;background:#f1f5f9;cursor:pointer;overflow:hidden;min-width:0;gap:2px}'
        + '.hm-c.wd{height:36px}.hm-c.we{height:16px;border-radius:4px}'
        + '.hm-c.l0{background:#fff;border:1px dashed #e2e8f0}.hm-c.we.l0{background:#f1f5f9;border:0;height:6px;align-self:center;opacity:.7;pointer-events:none}'
        + '.hm-c.l1{background:#e0e7ff}.hm-c.l2{background:#a5b4fc}.hm-c.l3{background:#4f46e5}.hm-c.fu{background:transparent;border:0;pointer-events:none}'
        + '.hm-c.t{outline:2px solid #f59e0b;outline-offset:1px;z-index:1}.hm-c.sel{box-shadow:0 0 0 1.5px #1e293b}'
        + '.hm-n{font-style:normal;font-size:9px;font-weight:600;line-height:1;color:#334155}.hm-c.l2 .hm-n{color:#1e293b}.hm-c.l0 .hm-n{color:#64748b}.hm-c.l3 .hm-n{color:#fff}'
        + '.hm-c.d1 .hm-n{font-weight:900;text-decoration:underline;color:#2f45c4}.hm-c.d1.l3 .hm-n{color:#fff}'
        + '.hm-e{font-style:normal;font-weight:400;line-height:1}'
        + '.hm .wd .hm-n{position:absolute;top:2px;left:3px}.hm .wd .hm-e{font-size:15px;transform:translateY(3px)}.hm .we .hm-n{font-size:8px}.hm .we .hm-e{font-size:10px}'
        + '.hm-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:#059669}.hm .we .hm-bar{height:2px}'
        + '.hm-c.g1 .hm-bar{background:#6b6fb0}.hm-c.g2 .hm-bar{background:#d97706}.hm-c.g3 .hm-bar{background:#059669}'
        + '.hm-detail{font-size:.74em;font-weight:800;color:#334155;margin:7px 0 2px;min-height:1.4em;line-height:1.4}'
        + '.hm-leg{font-size:.64em;font-weight:700;color:#64748b;display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:3px;align-items:center}'
        + '.hm-lg{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:3px;vertical-align:-1px}'
        + '.hm-flex{display:flex;gap:10px;align-items:flex-start}.hm-side{flex:1;min-width:0}.hm-side .hm-detail{margin-top:0}'
        + '.wp-det{border-top:1px solid #f1f5f9;margin-top:8px;padding-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;font-size:.74em;font-weight:800;color:#475569}'
        + '.wp-det small{display:block;font-size:.88em;color:#94a3b8;font-weight:800}.wp-det b{font-size:1.15em;color:#4361ee}'
        + '.wp-bar{display:flex;height:9px;border-radius:5px;overflow:hidden;background:#f1f5f9;margin-top:4px}';

    // ---- pure helpers -------------------------------------------------------------------------------------------------------------------------------
    function bkk(d) { return new Date((d || new Date()).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
    function addDay(key, n) { var t = new Date(key + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
    function dow(key) { return new Date(key + 'T00:00:00Z').getUTCDay(); }               // 0 Sun … 6 Sat
    function weekend(key) { var w = dow(key); return w === 0 || w === 6; }
    function tsDate(x) {                                                                    // Firestore Timestamp | Date | ms | ISO → Date | null (pending serverTimestamp / junk → null)
        if (!x) return null;
        var d = typeof x.toDate === 'function' ? x.toDate() : new Date(x);
        return d && !isNaN(d.getTime()) ? d : null;
    }
    // Set of Bangkok day keys that have at least one entry
    function dayKeys(entries) {
        var s = {}; (entries || []).forEach(function (e) { var d = tsDate(e && (e.timestamp || e.createdAt)); if (d) s[bkk(d)] = 1; });
        return s;
    }
    // Weekday-aware streak. days = {key:1}; today = Bangkok key → { cur, best }
    function streak(days, today) {
        var keys = Object.keys(days || {}).sort(), cur = 0, best = 0, run = 0, c, guard = 0;
        if (keys.length) {
            for (var d = keys[0], last = keys[keys.length - 1]; d <= last && guard < 5000; d = addDay(d, 1), guard++) {
                if (days[d]) { run++; if (run > best) best = run; } else if (!weekend(d)) run = 0;
            }
        }
        c = today; if (!days[c] && !weekend(c)) c = addDay(c, -1);                          // a weekday not written yet stays alive until midnight
        guard = 0;
        while (guard++ < 5000) { if (days[c]) { cur++; c = addDay(c, -1); } else if (weekend(c)) c = addDay(c, -1); else break; }
        return { cur: cur, best: Math.max(best, cur) };
    }
    function monthOf(key) { return key.slice(0, 7); }
    // reflective logs with text, oldest → newest, each { d, key, w }
    function wordedLogs(logs, wc) {
        return (logs || []).filter(function (l) { return l && l.content; }).map(function (l) { var d = tsDate(l.timestamp); return d ? { l: l, d: d, key: bkk(d), w: wc(l.content) } : null; })
            .filter(Boolean).sort(function (a, b) { return a.d - b.d; });
    }
    function avgWords(arr) { return arr.length ? Math.round(arr.reduce(function (s, x) { return s + x.w; }, 0) / arr.length) : 0; }
    function gradeOf(l) { return l && typeof l.latestGrammarGrade === 'string' ? (GRADE[l.latestGrammarGrade.trim()] || 0) : 0; }
    // Per-day facts for the heatmap. combined = every entry (Daily Reflection + Learning Note) → the entry count; logs = reflective logs → words, mood, grade.
    // Two entries on one day: the mood of the LATEST entry, the words added up, the BEST grade.
    function dayMap(logs, combined, wc) {
        var m = {};
        (combined && combined.length ? combined : logs || []).forEach(function (e) {
            var d = tsDate(e && (e.timestamp || e.createdAt)); if (!d) return; var k = bkk(d);
            (m[k] = m[k] || { count: 0, words: 0, mood: '', grade: 0, latest: 0 }).count++;
        });
        (logs || []).forEach(function (l) {
            var d = l && tsDate(l.timestamp); if (!d) return; var x = m[bkk(d)]; if (!x) return;
            if (l.content) x.words += wc(l.content);
            if (d.getTime() >= x.latest) { x.latest = d.getTime(); x.mood = l.mood || ''; }
            var g = gradeOf(l); if (g > x.grade) x.grade = g;
        });
        return m;
    }
    // heatmap: `weeks` columns (Mon-first, the current week last); cell { key, row (0 Mon … 6 Sun), dom, future, today, weekend, has, count, words, level 0-3, mood, grade 0-3, d1 }
    function heat(map, today, weeks, showGrades) {
        var mon = addDay(today, -((dow(today) + 6) % 7)), cols = [];
        for (var i = 0; i < weeks; i++) {
            var ws = addDay(mon, (i - (weeks - 1)) * 7), col = [];
            for (var r = 0; r < 7; r++) {
                var k = addDay(ws, r), x = map[k], has = !!x, w = has ? x.words : 0;
                col.push({ key: k, row: r, dom: Number(k.slice(8)), future: k > today, today: k === today, weekend: r > 4, has: has, count: has ? x.count : 0, words: w,
                    level: !has ? 0 : (w >= 60 ? 3 : w >= 30 ? 2 : 1), mood: has ? x.mood : '', grade: has && showGrades ? x.grade : 0, d1: k.slice(8) === '01' });
            }
            cols.push(col);
        }
        return cols;
    }
    // month label above the first column and above every column that holds a 1st → { column index: month index }
    function monthLabels(cols) {
        var out = {};
        cols.forEach(function (col, i) { var one = col.filter(function (c) { return c.d1; })[0]; if (one) out[i] = Number(one.key.slice(5, 7)) - 1; else if (i === 0) out[i] = Number(col[0].key.slice(5, 7)) - 1; });
        return out;
    }
    // graded entries (stored Thai grade strings; anything else is ignored). Hidden under 2; "mostly X" from 3; the direction from 6 (last 3 vs the 3 before)
    function grades(logs) {
        var g = (logs || []).map(function (l) {
            var v = gradeOf(l); if (!v) return null;
            var d = tsDate(l.latestGrammarTs) || tsDate(l.timestamp); return { v: v, t: d ? d.getTime() : 0 };
        }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });
        var out = { items: g.slice(-8).map(function (x) { return GRADE_KEY[x.v]; }), n: g.length, show: g.length >= 2, caption: null };
        if (g.length >= 3) {
            var recent = g.slice(-3), cnt = {}; recent.forEach(function (x) { cnt[x.v] = (cnt[x.v] || 0) + 1; });
            var top = recent[2].v; Object.keys(cnt).forEach(function (k) { if (cnt[k] > cnt[top]) top = Number(k); });      // most frequent of the last 3, a tie goes to the latest
            var dir = null;
            if (g.length >= 6) {
                var mean = function (a) { return a.reduce(function (s, x) { return s + x.v; }, 0) / a.length; }, delta = mean(recent) - mean(g.slice(-6, -3));
                dir = delta >= 0.3 ? 'up' : delta <= -0.3 ? 'down' : 'steady';
            }
            out.caption = { grade: GRADE_KEY[top], dir: dir };
        }
        return out;
    }
    // the whole card's numbers. input { logs, combined, month: {n,target}|null, now, wordCount }
    function model(inp) {
        var now = inp.now || new Date(), today = bkk(now), wc = inp.wordCount || function (t) { return String(t).split(/\s+/).filter(Boolean).length; };
        var days = dayKeys(inp.combined && inp.combined.length ? inp.combined : inp.logs), logs = wordedLogs(inp.logs, wc);
        var st = streak(days, today), month = monthOf(today), map = dayMap(inp.logs, inp.combined, wc), gr = grades(inp.logs);
        var ownN = (inp.combined || inp.logs || []).filter(function (e) { var d = tsDate(e && (e.timestamp || e.createdAt)); return d && monthOf(bkk(d)) === month; }).length;
        var chipN = inp.month && typeof inp.month.n === 'number' ? inp.month.n : null;
        var total = logs.reduce(function (s, x) { return s + x.w; }, 0), th = 0, en = 0, moods = {};
        logs.forEach(function (x) { var t = String(x.l.content); th += (t.match(/[฀-๿]/g) || []).length; en += (t.match(/[a-zA-Z]/g) || []).length; var m = x.l.mood || 'unknown'; moods[m] = (moods[m] || 0) + 1; });
        var thPct = th + en ? Math.round(th / (th + en) * 100) : 0;
        return {
            today: today, days: days, dayCount: Object.keys(days).length, cur: st.cur, best: st.best, written: !!days[today], isWeekend: weekend(today),
            monthN: chipN !== null ? chipN : ownN, target: inp.month && inp.month.target > 0 ? inp.month.target : 0, haveMonthRow: chipN !== null,
            map: map, showGrades: gr.show, heat8: heat(map, today, 8, gr.show), heat4: heat(map, today, 4, gr.show), grades: gr,
            totals: { entries: logs.length, words: total, avg: avgWords(logs), max: logs.reduce(function (m, x) { return Math.max(m, x.w); }, 0), thPct: thPct, enPct: th + en ? 100 - thPct : 0,
                moods: Object.keys(moods).map(function (k) { return [k, moods[k]]; }).sort(function (a, b) { return b[1] - a[1]; }) },
            fresh: Object.keys(days).length <= 2
        };
    }

    // ---- DOM ----------------------------------------------------------------------------------------------------------------------------------------
    var open = false, selKey = '';
    function lang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    // "Tue 27 Oct · 😓 · Writing check: Good · 69 words · 2 entries"
    function detailText(c, L) {
        var p = [L.date(dow(c.key), c.dom, Number(c.key.slice(5, 7)) - 1)];
        if (!c.has) { p.push(L.none); return p.join(' · '); }
        p.push(c.mood || '·');
        if (c.grade) p.push(L.chk + ': ' + L.grade[GRADE_KEY[c.grade]]);
        if (c.words) p.push(L.w(c.words));
        if (c.count > 1) p.push(L.entries(c.count));
        return p.join(' · ');
    }
    function cellHtml(c, L, sel) {
        var kind = c.weekend ? 'we' : 'wd';
        if (c.future) return '<span class="hm-c fu ' + kind + '"></span>';
        if (c.weekend && !c.has) return '<span class="hm-c we l0" aria-hidden="true"></span>';
        var t = esc(detailText(c, L)), cls = 'hm-c ' + kind + ' l' + c.level + (c.grade ? ' g' + c.grade : '') + (c.d1 ? ' d1' : '') + (c.today ? ' t' : '') + (c.key === sel ? ' sel' : '');
        return '<button type="button" class="' + cls + '" data-s="' + c.key + '" aria-label="' + t + '"><i class="hm-n">' + c.dom + '</i>' + (c.has ? '<b class="hm-e">' + esc(c.mood || '·') + '</b>' : '') + (c.grade ? '<u class="hm-bar"></u>' : '') + '</button>';
    }
    function gridHtml(cols, L, lg, sel, fixed) {
        var ml = monthLabels(cols), tpl = fixed ? '12px repeat(' + cols.length + ',34px)' : '12px repeat(' + cols.length + ',minmax(0,1fr))', g = '<span></span>';
        cols.forEach(function (c, i) { g += '<span class="hm-m">' + (ml[i] !== undefined ? MONTHS[lg][ml[i]] : '') + '</span>'; });
        for (var r = 0; r < 7; r++) {
            g += r < 5 ? '<span class="hm-dow">' + ROWS[lg][r] + '</span>' : '<span></span>';
            cols.forEach(function (col) { g += cellHtml(col[r], L, sel); });
        }
        return '<div class="hm-wrap"><div class="hm h1" role="group" style="grid-template-columns:' + tpl + '">' + g + '</div></div>';
    }
    function legendHtml(m, L) {
        var g = m.showGrades ? '<span>' + L.bar + '</span><span><i class="hm-lg" style="background:#059669"></i>' + L.grade.good + '</span><span><i class="hm-lg" style="background:#d97706"></i>' + L.grade.fair + '</span><span><i class="hm-lg" style="background:#6b6fb0"></i>' + L.grade.needs + '</span>' : '';
        return '<div class="hm-leg"><span>' + L.darker + '</span>' + g + '</div>';
    }
    function html(m, L, lg) {
        var chips = '';
        if (m.cur > 0) chips += '<span class="wp-chip fire">🔥 ' + L.streak(m.cur) + (m.best > m.cur ? ' · ' + L.best(m.best) : '') + '</span>';
        var mon = MONTHS[lg][Number(m.today.slice(5, 7)) - 1];
        if (!m.fresh) {
            var hit = m.target > 0 && m.monthN >= m.target, txt = '📅 ' + (hit ? '✓ ' : '') + m.monthN + (m.target > 0 ? '/' + m.target : '') + ' ' + mon;
            chips += '<button type="button" class="wp-chip' + (hit ? ' ok' : '') + '" data-wp="goal" title="' + esc(L.monthTip) + '" aria-label="' + esc(L.monthTip + ' · ' + txt) + '">' + txt + '</button>';
        }
        if (!m.written && !m.isWeekend) chips += '<span class="wp-chip todo">○ ' + L.today + '</span>';
        var body = '<div class="wp-chips">' + chips + '</div>';
        if (m.fresh) body += '<div class="wp-note">' + (m.dayCount <= 1 ? L.fresh : L.fresh2) + '</div>';
        else {
            var cols = open ? m.heat8 : m.heat4, vis = {}; cols.forEach(function (col) { col.forEach(function (c) { vis[c.key] = c; }); });
            if (!selKey || !vis[selKey]) { selKey = ''; Object.keys(vis).sort().forEach(function (k) { if (vis[k].has && !vis[k].future) selKey = k; }); }      // the latest day with an entry
            var detail = '<div class="hm-detail" aria-live="polite">' + (selKey ? esc(detailText(vis[selKey], L)) : '') + '</div>', leg = legendHtml(m, L), grid = gridHtml(cols, L, lg, selKey, !open);
            body += open ? grid + detail + leg : '<div class="hm-flex">' + grid + '<div class="hm-side">' + detail + leg + '</div></div>';
        }
        var t = m.totals, moods = t.moods.slice(0, 5).map(function (x) { return (x[0] === 'unknown' ? '❓' : esc(x[0])) + ' ' + x[1]; }), cp = m.grades.caption, ct = '';
        if (cp) ct = L.mostly(L.grade[cp.grade]) + (cp.dir ? ' · ' + L[cp.dir] : '');
        var det = open ? '<div class="wp-det"><div><small>📝 ' + L.words + '</small><b id="mwp-total-words">' + t.words.toLocaleString() + '</b> <span id="mwp-words-sub">' + L.avg + ' ' + t.avg + ' · ' + L.max + ' ' + t.max + '</span></div>'
            + '<div><small>📅 ' + L.days + '</small><b id="mwp-active-days">' + m.dayCount + '</b> <span id="mwp-streak-sub">' + L.best(m.best) + '</span></div>'
            + '<div><small>🌐 ' + L.lang + '</small><span id="mwp-lang-sub">TH ' + t.thPct + '% · EN ' + t.enPct + '%</span><div class="wp-bar" id="mwp-lang-bar"><span style="width:' + t.thPct + '%;background:#4361ee"></span><span style="width:' + t.enPct + '%;background:#10b981"></span></div></div>'
            + '<div><small>😊 ' + L.mood + '</small><b id="mwp-mood-top">' + (moods[0] || '-') + '</b> <span id="mwp-mood-rest">' + (moods.slice(1).join(' · ') || '-') + '</span></div>'
            + (ct ? '<div style="grid-column:1/-1"><small>🩺 ' + L.chk + '</small><span id="mwp-check">' + esc(ct) + '</span></div>' : '') + '</div>' : '';
        return '<style>' + CSS + '</style><div class="wp"><button type="button" class="wp-head" id="wp-tog" aria-expanded="' + open + '"><b>✍️ ' + L.title + '</b><span class="wp-more">' + (open ? L.less + ' ▴' : L.more + ' ▾') + '</span></button>' + body + det + '</div>';
    }
    // inp = { logs, combined, month, now, wordCount, editGoal } → fills #mwp-body inside the card; hides the card when nothing has been written
    function render(card, inp) {
        if (!card) return null;
        var m = model(inp), host = card.querySelector('#mwp-body');
        if (!host || m.dayCount === 0) { card.style.display = 'none'; return m; }
        card.style.display = 'block'; var lg = lang();
        host.innerHTML = html(m, D[lg], lg);
        var tog = host.querySelector('#wp-tog'); if (tog) tog.onclick = function () { open = !open; render(card, inp); };
        var goal = host.querySelector('[data-wp="goal"]'); if (goal) goal.onclick = function () { if (typeof inp.editGoal === 'function') inp.editGoal(); };
        var cells = host.querySelectorAll('.hm-c[data-s]'), det = host.querySelector('.hm-detail');
        for (var i = 0; i < cells.length; i++) cells[i].onclick = function () {                  // tap a day → its detail in the one inline line (no modal)
            selKey = this.getAttribute('data-s');
            for (var j = 0; j < cells.length; j++) cells[j].classList.toggle('sel', cells[j] === this);
            if (det) det.textContent = this.getAttribute('aria-label');
        };
        return m;
    }
    if (typeof document !== 'undefined') document.addEventListener('lang-changed', function () { try { if (typeof window.renderMyWritingProfile === 'function') window.renderMyWritingProfile(); } catch (e) { /* card is optional */ } });
    var api = { model: model, streak: streak, dayKeys: dayKeys, dayMap: dayMap, heat: heat, monthLabels: monthLabels, grades: grades, detailText: detailText, render: render, bkk: bkk, addDay: addDay, D: D,
        setOpen: function (v) { open = !!v; }, setSel: function (k) { selKey = k || ''; } };
    if (typeof window !== 'undefined') window.WritingProgress = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
