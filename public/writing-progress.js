// V101.232: the intern's own Journal progress card (owner's pick: A writing calendar + C mood strip; B's weekly bars and insight line were dropped).
// • Collapsed by default (owner's final pick: A + C): chips (🔥 streak · this month · ○ Today), a 10-week calendar (Mon–Fri full cells, Sat/Sun slim rows, today ringed),
//   C's mood strip (the last 14 entries as emoji, newest on the right, words-per-entry mini bars under them) and a small strip of the mentor's writing-check grades. Tap the header (≥40 px) for the old stats (words, active days, language bar, moods).
// • STREAK SKIPS WEEKENDS (owner): Sat / Sun never break it and never extend it by being empty; a weekend entry still counts as a written day (+1).
//   Fri → Mon is consecutive. Today not written yet keeps the streak alive until midnight Bangkok (a weekday only — a bare weekend day is just skipped).
//   This is a NEW helper for the card; getReflectiveStreak (History) and the Daily Streak (collectActivityDates → badges / Beri) are untouched.
// • The month chip is monthlyProgress.summary()'s own Journal row (same n and target as Schedule ▸ Goals): target set → "5/12" (green frame + ✓ at the target),
//   no target → just "5" (no default target); tapping it opens monthlyProgress.edit(). Weekend entries count in it.
// • Grade strip (owner: "intern เห็นแนวโน้มเกรดไวยากรณ์"): the admin's latestGrammarGrade (ดี / พอใช้ / ควรปรับ, written by persistGrammarGrade in admin.html on the
//   reflective_logs doc) of the last ≤8 graded entries, oldest → newest. Calm colours only (green / amber / indigo — never red); hidden under 2 graded entries;
//   a one-line caption from 3 graded entries. Read-only: the intern already receives these docs (where userId == me), no rules change.
// Pure part (streak / days / calendar / mood strip / grades) is exposed for scripts/writing-progress-qa.cjs; the DOM part only fills #mwp-body.
(function () {
    'use strict';
    var GRADE = { 'ดี': 3, 'พอใช้': 2, 'ควรปรับ': 1 };
    var GRADE_KEY = { 3: 'good', 2: 'fair', 1: 'needs' };
    var MONTHS = {
        th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    };
    var D = {
        th: {
            title: 'พัฒนาการการเขียน', more: 'ดูรายละเอียด', less: 'ย่อ', streak: function (n) { return n + ' วัน'; }, best: function (n) { return 'ดีสุด ' + n; },
            cal: 'ปฏิทินการเขียน · 10 สัปดาห์', moodCap: 'อารมณ์ 14 บันทึกล่าสุด · แท่ง = จำนวนคำ', noMood: 'ไม่ได้เลือกอารมณ์', fresh: 'เขียนวันละบันทึก — สัปดาห์แรกจะเริ่มเติมปฏิทิน', fresh2: 'เริ่มต้นดี! เขียนต่อทุกวันทำการ แล้วปฏิทินจะเติมขึ้นเรื่อยๆ',
            today: 'วันนี้', todayDone: 'วันนี้', monthTip: 'ตั้งเป้าหมายรายเดือน', words: 'คำทั้งหมด', avg: 'เฉลี่ย', max: 'สูงสุด', days: 'วันที่เขียน', lang: 'ภาษา', mood: 'อารมณ์',
            chk: 'ตรวจการเขียน', grade: { good: 'ดี', fair: 'พอใช้', needs: 'ควรปรับ' }, mostly: function (g) { return 'ล่าสุดส่วนใหญ่ ' + g; }, up: 'ดีขึ้นเรื่อยๆ', down: 'ช่วงนี้ต่ำลงเล็กน้อย — ค่อยๆ ปรับไปด้วยกัน', steady: 'คงที่ดี',
            cell: function (d, w) { return d + (w ? ' · ' + w + ' คำ' : ''); }, entry: function (w) { return w + ' คำ'; }, aria: function (n) { return 'ปฏิทินการเขียน 10 สัปดาห์ เขียนแล้ว ' + n + ' วัน'; }
        },
        en: {
            title: 'Writing progress', more: 'Details', less: 'Less', streak: function (n) { return n + 'd'; }, best: function (n) { return 'best ' + n; },
            cal: 'Writing calendar · 10 weeks', moodCap: 'Mood of the last 14 entries · bars = words', noMood: 'No mood picked', fresh: 'Write once a day — your first week starts filling the calendar', fresh2: 'Good start! Keep writing on weekdays and the calendar fills up',
            today: 'Today', todayDone: 'Today', monthTip: 'Set a monthly goal', words: 'Total words', avg: 'avg', max: 'max', days: 'Active days', lang: 'Language', mood: 'Mood',
            chk: 'Writing check', grade: { good: 'Good', fair: 'Fair', needs: 'Needs work' }, mostly: function (g) { return 'Recently mostly ' + g; }, up: 'Getting better', down: 'A little lower lately — keep tuning it', steady: 'Steady',
            cell: function (d, w) { return d + (w ? ' · ' + w + ' words' : ''); }, entry: function (w) { return w + ' words'; }, aria: function (n) { return 'Writing calendar, 10 weeks, ' + n + ' days written'; }
        },
        ko: {
            title: '글쓰기 현황', more: '자세히', less: '접기', streak: function (n) { return n + '일'; }, best: function (n) { return '최고 ' + n; },
            cal: '글쓰기 달력 · 10주', moodCap: '최근 14건의 기분 · 막대 = 단어 수', noMood: '기분 미선택', fresh: '하루에 한 편씩 써 보세요 — 첫 주부터 달력이 채워져요', fresh2: '좋은 시작이에요! 평일마다 쓰면 달력이 채워져요',
            today: '오늘', todayDone: '오늘', monthTip: '월간 목표 설정', words: '전체 단어', avg: '평균', max: '최대', days: '쓴 날', lang: '언어', mood: '기분',
            chk: '글쓰기 점검', grade: { good: '좋음', fair: '보통', needs: '보완 필요' }, mostly: function (g) { return '최근 대부분 ' + g; }, up: '점점 좋아지고 있어요', down: '요즘 조금 낮아요 — 천천히 다듬어 봐요', steady: '꾸준해요',
            cell: function (d, w) { return d + (w ? ' · ' + w + '단어' : ''); }, entry: function (w) { return w + '단어'; }, aria: function (n) { return '글쓰기 달력 10주, ' + n + '일 작성'; }
        }
    };
    var CSS = '.wp{color:#334155}.wp *{box-sizing:border-box}'
        + '.wp-head{display:flex;align-items:center;gap:8px;min-height:40px;width:100%;background:none;border:0;padding:0;text-align:left;cursor:pointer;font:inherit;color:inherit}'
        + '.wp-head b{font-size:.9em;font-weight:900;flex:1}.wp-head .wp-more{font-size:.72em;font-weight:800;color:#64748b;min-height:40px;display:flex;align-items:center;padding:0 2px}'
        + '.wp-chips{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 8px}'
        + '.wp-chip{font:inherit;font-size:11.5px;font-weight:800;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;white-space:nowrap;width:auto;min-height:0;line-height:1.5}'
        + 'button.wp-chip{cursor:pointer;position:relative}button.wp-chip::after{content:"";position:absolute;inset:-10px -3px}'
        + '.wp-chip.fire{background:#fff7ed;color:#9a3412;border-color:#fed7aa}.wp-chip.ok{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.wp-chip.todo{background:#fffbeb;color:#92400e;border-color:#fde68a}'
        + '.wp-note{font-size:.76em;font-weight:700;color:#64748b;line-height:1.4}.wp-ins{font-size:.78em;font-weight:800;color:#334155;margin:2px 0 6px}'
        + '.wp-grid{display:grid;grid-template-columns:auto repeat(10,1fr);gap:3px;align-items:center;margin:2px 0 4px}'
        + '.wp-dow{font-size:9px;font-weight:800;color:#94a3b8;text-align:right;padding-right:3px}'
        + '.wp-c{border-radius:4px;height:15px;background:#f1f5f9}.wp-c.we{height:7px;opacity:.7}.wp-c.x{background:#fff;border:1px dashed #e2e8f0}'
        + '.wp-c.l1{background:#c7d2fe}.wp-c.l2{background:#818cf8}.wp-c.l3{background:#4361ee}.wp-c.t{outline:2px solid #f59e0b;outline-offset:1px}.wp-c.fu{background:transparent}'
        + '.wp-cap{font-size:.68em;font-weight:700;color:#94a3b8;margin-top:2px}'
        + '.wp-mood{display:grid;grid-template-columns:repeat(14,1fr);gap:1px;margin:8px 0 2px;font-size:14px;line-height:1.1;text-align:center}.wp-mood span{position:relative;min-height:18px}.wp-mood .none{color:#cbd5e1;font-weight:900}.wp-mood sup{position:absolute;right:-1px;bottom:-3px;font-size:8px;line-height:1}'
        + '.wp-mbars{display:grid;grid-template-columns:repeat(14,1fr);gap:2px;align-items:end;height:26px}.wp-mbars i{display:block;background:#818cf8;border-radius:2px 2px 0 0;min-height:2px}.wp-mbars i.pad{visibility:hidden}'
        + '.wp-chk{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:.72em;font-weight:800;color:#64748b}'
        + '.wp-dots{display:inline-flex;gap:4px;align-items:center}.wp-g{width:12px;height:12px;border-radius:50%;display:inline-block}'
        + '.wp-g.good{background:#10b981}.wp-g.fair{background:#f59e0b}.wp-g.needs{background:#818cf8}'
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
    // C's mood strip: the last 14 worded entries, oldest → newest (newest on the right); a missing mood is a neutral dot; the bar is the words, capped so one long entry cannot flatten the rest
    var MOOD_CAP = 150;
    function moods14(logs) {
        var last = logs.slice(-14), top = Math.max(40, Math.min(MOOD_CAP, last.reduce(function (m, x) { return Math.max(m, x.w); }, 0)));
        return last.map(function (x) { return { mood: x.l.mood || '', mood2: x.l.moodSecondary || '', w: x.w, pct: Math.max(8, Math.round(Math.min(x.w, top) / top * 100)) }; });
    }
    // calendar: 10 week columns (Mon-first, current week last); cell { key, row (0 Mon … 6 Sun), level 0-3, future, today, weekend }
    function calendar(days, words, today) {
        var mon = addDay(today, -((dow(today) + 6) % 7)), cols = [];
        for (var i = 0; i < 10; i++) {
            var ws = addDay(mon, (i - 9) * 7), col = [];
            for (var r = 0; r < 7; r++) {
                var k = addDay(ws, r), w = words[k] || 0, has = !!days[k];
                col.push({ key: k, row: r, future: k > today, today: k === today, weekend: r > 4, has: has, words: w, level: !has ? 0 : (w >= 60 ? 3 : w >= 30 ? 2 : 1) });
            }
            cols.push(col);
        }
        return cols;
    }
    // graded entries (stored Thai grade strings; anything else is ignored) → last ≤8, oldest → newest, with the caption kind
    function grades(logs) {
        var g = (logs || []).map(function (l) {
            var v = l && typeof l.latestGrammarGrade === 'string' ? GRADE[l.latestGrammarGrade.trim()] : 0; if (!v) return null;
            var d = tsDate(l.latestGrammarTs) || tsDate(l.timestamp); return { v: v, t: d ? d.getTime() : 0 };
        }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });
        var last = g.slice(-8), out = { items: last.map(function (x) { return GRADE_KEY[x.v]; }), n: g.length, show: g.length >= 2, caption: null };
        if (g.length >= 3) {
            var recent = g.slice(-3), earlier = g.slice(-6, -3), mean = function (a) { return a.reduce(function (s, x) { return s + x.v; }, 0) / a.length; }, delta = earlier.length >= 1 && g.length >= 4 ? mean(recent) - mean(earlier) : 0;
            if (delta >= 0.3) out.caption = { kind: 'up' }; else if (delta <= -0.3) out.caption = { kind: 'down' };
            else {                                                                             // most frequent of the last 3, a tie goes to the latest
                var cnt = {}; recent.forEach(function (x) { cnt[x.v] = (cnt[x.v] || 0) + 1; });
                var top = recent[2].v; Object.keys(cnt).forEach(function (k) { if (cnt[k] > cnt[top]) top = Number(k); });
                out.caption = { kind: g.length >= 4 && Math.abs(delta) < 0.3 && cnt[top] === 3 ? 'steady' : 'mostly', grade: GRADE_KEY[top] };
            }
        }
        return out;
    }
    // the whole card's numbers. input { logs, combined, month: {n,target}|null, now, wordCount }
    function model(inp) {
        var now = inp.now || new Date(), today = bkk(now), wc = inp.wordCount || function (t) { return String(t).split(/\s+/).filter(Boolean).length; };
        var days = dayKeys(inp.combined && inp.combined.length ? inp.combined : inp.logs), logs = wordedLogs(inp.logs, wc);
        var st = streak(days, today), words = {}, month = monthOf(today);
        logs.forEach(function (x) { words[x.key] = (words[x.key] || 0) + x.w; });
        var ownN = (inp.combined || inp.logs || []).filter(function (e) { var d = tsDate(e && (e.timestamp || e.createdAt)); return d && monthOf(bkk(d)) === month; }).length;
        var chipN = inp.month && typeof inp.month.n === 'number' ? inp.month.n : null;
        var total = logs.reduce(function (s, x) { return s + x.w; }, 0), th = 0, en = 0, moods = {};
        logs.forEach(function (x) { var t = String(x.l.content); th += (t.match(/[฀-๿]/g) || []).length; en += (t.match(/[a-zA-Z]/g) || []).length; var m = x.l.mood || 'unknown'; moods[m] = (moods[m] || 0) + 1; });
        var thPct = th + en ? Math.round(th / (th + en) * 100) : 0;
        return {
            today: today, days: days, dayCount: Object.keys(days).length, cur: st.cur, best: st.best, written: !!days[today], isWeekend: weekend(today),
            monthN: chipN !== null ? chipN : ownN, target: inp.month && inp.month.target > 0 ? inp.month.target : 0, haveMonthRow: chipN !== null,
            moods: moods14(logs),
            cal: calendar(days, words, today), grades: grades(inp.logs),
            totals: { entries: logs.length, words: total, avg: avgWords(logs), max: logs.reduce(function (m, x) { return Math.max(m, x.w); }, 0), thPct: thPct, enPct: th + en ? 100 - thPct : 0,
                moods: Object.keys(moods).map(function (k) { return [k, moods[k]]; }).sort(function (a, b) { return b[1] - a[1]; }) },
            fresh: Object.keys(days).length <= 2
        };
    }

    // ---- DOM ----------------------------------------------------------------------------------------------------------------------------------------
    var open = false;
    function lang() { var b = document.body; return b && b.classList.contains('lang-th-on') ? 'th' : b && b.classList.contains('lang-kr-on') ? 'ko' : 'en'; }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function html(m, L, lg, now) {
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
            var names = lg === 'th' ? ['จ', 'อ', 'พ', 'พฤ', 'ศ'] : lg === 'ko' ? ['월', '화', '수', '목', '금'] : ['M', 'T', 'W', 'T', 'F'], g = '';
            for (var r = 0; r < 7; r++) {
                g += '<div class="wp-dow">' + (r < 5 ? names[r] : '') + '</div>';
                m.cal.forEach(function (col) {
                    var c = col[r];
                    if (c.future) { g += '<div class="wp-c fu' + (c.weekend ? ' we' : '') + '"></div>'; return; }
                    g += '<div class="wp-c ' + (c.weekend ? 'we ' : '') + (c.has ? 'l' + c.level : (c.weekend ? '' : 'x')) + (c.today ? ' t' : '') + '" title="' + esc(L.cell(c.key, c.words)) + '"></div>';
                });
            }
            body += '<div class="wp-grid" role="img" aria-label="' + esc(L.aria(m.dayCount)) + '">' + g + '</div><div class="wp-cap">' + L.cal + '</div>';
            if (m.moods.length) {
                var pad = 14 - m.moods.length, cells = '', bars = '', i;
                for (i = 0; i < pad; i++) { cells += '<span></span>'; bars += '<i class="pad" style="height:8%"></i>'; }
                m.moods.forEach(function (x) {
                    cells += x.mood ? '<span title="' + esc(L.entry(x.w)) + '">' + esc(x.mood) + (x.mood2 ? '<sup>' + esc(x.mood2) + '</sup>' : '') + '</span>' : '<span class="none" title="' + esc(L.noMood + ' · ' + L.entry(x.w)) + '">·</span>';
                    bars += '<i style="height:' + x.pct + '%" title="' + esc(L.entry(x.w)) + '"></i>';
                });
                body += '<div class="wp-mood">' + cells + '</div><div class="wp-mbars">' + bars + '</div><div class="wp-cap">' + L.moodCap + '</div>';
            }
            if (m.grades.show) {
                var dots = m.grades.items.map(function (k) { return '<i class="wp-g ' + k + '" title="' + esc(L.grade[k]) + '"></i>'; }).join(''), cp = m.grades.caption, ct = '';
                if (cp) ct = cp.kind === 'up' ? L.up : cp.kind === 'down' ? L.down : cp.kind === 'steady' ? L.steady : L.mostly(L.grade[cp.grade]);
                body += '<div class="wp-chk"><span>🩺 ' + L.chk + '</span><span class="wp-dots" role="img" aria-label="' + esc(m.grades.items.map(function (k) { return L.grade[k]; }).join(' → ')) + '">' + dots + '</span>' + (ct ? '<span>' + esc(ct) + '</span>' : '') + '</div>';
            }
        }
        var t = m.totals, moods = t.moods.map(function (x) { return (x[0] === 'unknown' ? '❓' : esc(x[0])) + ' ' + x[1]; });
        var det = open ? '<div class="wp-det"><div><small>📝 ' + L.words + '</small><b id="mwp-total-words">' + t.words.toLocaleString() + '</b> <span id="mwp-words-sub">' + L.avg + ' ' + t.avg + ' · ' + L.max + ' ' + t.max + '</span></div>'
            + '<div><small>📅 ' + L.days + '</small><b id="mwp-active-days">' + m.dayCount + '</b> <span id="mwp-streak-sub">' + L.best(m.best) + '</span></div>'
            + '<div><small>🌐 ' + L.lang + '</small><span id="mwp-lang-sub">TH ' + t.thPct + '% · EN ' + t.enPct + '%</span><div class="wp-bar" id="mwp-lang-bar"><span style="width:' + t.thPct + '%;background:#4361ee"></span><span style="width:' + t.enPct + '%;background:#10b981"></span></div></div>'
            + '<div><small>😊 ' + L.mood + '</small><b id="mwp-mood-top">' + (moods[0] || '-') + '</b> <span id="mwp-mood-rest">' + (moods.slice(1).join('  ') || '-') + '</span></div></div>' : '';
        return '<style>' + CSS + '</style><div class="wp"><button type="button" class="wp-head" id="wp-tog" aria-expanded="' + open + '"><b>✍️ ' + L.title + '</b><span class="wp-more">' + (open ? L.less + ' ▴' : L.more + ' ▾') + '</span></button>' + body + det + '</div>';
    }
    // inp = { logs, combined, month, now, wordCount, editGoal } → fills #mwp-body inside the card; hides the card when nothing has been written
    function render(card, inp) {
        if (!card) return null;
        var m = model(inp), host = card.querySelector('#mwp-body');
        if (!host || m.dayCount === 0) { card.style.display = 'none'; return m; }
        card.style.display = 'block'; var lg = lang();
        host.innerHTML = html(m, D[lg], lg, inp.now || new Date());
        var tog = host.querySelector('#wp-tog'); if (tog) tog.onclick = function () { open = !open; render(card, inp); };
        var goal = host.querySelector('[data-wp="goal"]'); if (goal) goal.onclick = function () { if (typeof inp.editGoal === 'function') inp.editGoal(); };
        return m;
    }
    if (typeof document !== 'undefined') document.addEventListener('lang-changed', function () { try { if (typeof window.renderMyWritingProfile === 'function') window.renderMyWritingProfile(); } catch (e) { /* card is optional */ } });
    var api = { model: model, streak: streak, dayKeys: dayKeys, calendar: calendar, grades: grades, render: render, bkk: bkk, addDay: addDay, D: D, setOpen: function (v) { open = !!v; } };
    if (typeof window !== 'undefined') window.WritingProgress = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
