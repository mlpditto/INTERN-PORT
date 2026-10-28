// V101.232: the intern's Journal progress card (public/writing-progress.js) — the owner's pick "A + C + check" all inside ONE heatmap (mockup "Heatmap all-in-one v1", 8 weeks).
// Pure: weekday-aware streak (Sat / Sun never break it, Fri → Mon is consecutive, a weekend entry counts, today not written keeps it alive), the per-day map (latest mood, words
// added up, best grade, entry count), the heatmap (Mon-first columns, today, future, weekend rows, day numbers, tint levels, month labels), the writing-check grades (tolerant mapping,
// hidden under 2, "mostly" from 3, direction from 6, calm colours only), the detail line (TH / EN / KO). Page: the REAL index.html on a 390 px phone (Bangkok clock fixed, Wed 28 Oct
// 2026 10:00) — collapsed = last 4 weeks at 34 px cells + detail + legend beside it, expanded = 8 weeks + the old stats, every cell carries number + emoji + grade bar, no separate mood
// strip / grade strip, tap a day → one inline detail line, the month chip = monthlyProgress.summary() (target → n/target + green ✓, none → just n, tap = goal editor), EN / TH / KO,
// new-intern short view, 40 px header + chip hit areas, repaint on lang-changed, no console errors.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const W = require('../public/writing-progress.js');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html));
assert.ok(/<script defer src="writing-progress\.js\?v=V101\.\d+"><\/script>/.test(html), 'index.html loads the card module');
assert.ok(/<div id="mwp-body" class="lang-no-toggle"><\/div>/.test(html), 'the card has one host, wrapped lang-no-toggle');
assert.ok(!/id="mwp-dr-status"/.test(html), 'the old header status line is gone (renderDRStatus is null-safe)');

// ---------- pure ----------
const days = a => Object.fromEntries(a.map(k => [k, 1]));
// 2026-10-26 Mon · 27 Tue · 28 Wed · 23 Fri · 24 Sat · 25 Sun · 22 Thu
assert.deepEqual(W.streak(days(['2026-10-23', '2026-10-26']), '2026-10-26'), { cur: 2, best: 2 }, 'Fri → Mon is consecutive');
assert.deepEqual(W.streak(days(['2026-10-26', '2026-10-27']), '2026-10-28'), { cur: 2, best: 2 }, 'today (a weekday) not written yet: alive until midnight');
assert.deepEqual(W.streak(days(['2026-10-23', '2026-10-27']), '2026-10-28'), { cur: 1, best: 1 }, 'a missed weekday (Mon) breaks it');
assert.deepEqual(W.streak(days(['2026-10-23', '2026-10-25', '2026-10-26']), '2026-10-26'), { cur: 3, best: 3 }, 'a weekend entry counts as a written day');
assert.deepEqual(W.streak(days(['2026-10-22', '2026-10-23']), '2026-10-24'), { cur: 2, best: 2 }, 'today is Saturday and empty: nothing breaks');
assert.deepEqual(W.streak(days(['2026-10-22', '2026-10-23']), '2026-10-25'), { cur: 2, best: 2 }, 'Sunday too');
assert.deepEqual(W.streak(days(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-27']), '2026-10-27'), { cur: 3, best: 3 }, 'Thu 22 was missed: the run is Fri 23, Mon 26, Tue 27');
assert.deepEqual(W.streak({}, '2026-10-28'), { cur: 0, best: 0 });
assert.equal(W.streak(days(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-14']), '2026-10-28').best, 6, 'best run Mon 5 … Fri 9 + Mon 12 (weekend skipped) = 6, Wed 14 is a new run');
assert.equal(W.streak(days(['2026-10-05', '2026-10-06', '2026-10-07']), '2026-10-28').cur, 0, 'an old run is not current');

const ts = (key, h) => ({ toDate: () => new Date(new Date(key + 'T00:00:00+07:00').getTime() + (h || 18) * 3600e3) });
const wc = t => String(t).split(/\s+/).filter(Boolean).length;
const NOW = new Date('2026-10-28T10:00:00+07:00');
const log = (key, n, extra) => Object.assign({ id: 'l' + key, content: Array.from({ length: n }, (_, i) => 'w' + i).join(' '), mood: '😊', timestamp: ts(key), status: 'approved' }, extra || {});
const g = (grade, key, h) => ({ latestGrammarGrade: grade, latestGrammarTs: ts(key, h) });
let m = W.model({ logs: [log('2026-10-27', 40), log('2026-10-26', 20), log('2026-10-24', 10), log('2026-09-29', 30), { id: 'p', content: 'x y', timestamp: null }], now: NOW, wordCount: wc });
assert.equal(m.today, '2026-10-28'); assert.equal(m.dayCount, 4, 'a pending / missing timestamp is skipped');
assert.equal(m.cur, 3, 'Tue + Mon + the Saturday entry (Sun skipped); Fri 23 was missed');
assert.equal(m.monthN, 3, 'this month = 3 entries (own count, no month row yet)'); assert.equal(m.haveMonthRow, false);
m = W.model({ logs: [log('2026-10-27', 40)], month: { n: 7, target: 12 }, now: NOW, wordCount: wc });
assert.equal(m.monthN, 7, 'the chip number is the monthlyProgress row\'s own'); assert.equal(m.target, 12);
m = W.model({ logs: [log('2026-10-27', 40)], month: { n: 7, target: 0 }, now: NOW, wordCount: wc }); assert.equal(m.target, 0, 'no target → none (no default)');
m = W.model({ logs: [], combined: [{ timestamp: ts('2026-10-27') }, { timestamp: ts('2026-10-26') }, { timestamp: ts('2026-10-23') }], now: NOW, wordCount: wc });
assert.equal(m.dayCount, 3, 'Learning Notes (combined cache) count as written days'); assert.equal(m.totals.words, 0, '… but not as words'); assert.equal(m.fresh, false);
m = W.model({ logs: [log('2026-10-27', 5)], now: NOW, wordCount: wc }); assert.equal(m.fresh, true, '1–2 written days = the short new-intern view');

// the day map: the mood of the LATEST entry, words added up, the BEST grade, the entry count (Learning Notes count as entries)
const e1 = log('2026-10-27', 30, Object.assign({ id: 'a', mood: '😴', timestamp: ts('2026-10-27', 9) }, g('พอใช้', '2026-10-27', 10)));
const e2 = log('2026-10-27', 40, Object.assign({ id: 'b', mood: '🔥', timestamp: ts('2026-10-27', 20) }, g('ดี', '2026-10-27', 21)));
const e3 = log('2026-10-26', 10, { mood: '' });
const dm = W.dayMap([e1, e2, e3], [e1, e2, e3, { timestamp: ts('2026-10-27', 12) }, { timestamp: ts('2026-10-23') }], wc);
assert.deepEqual([dm['2026-10-27'].count, dm['2026-10-27'].words, dm['2026-10-27'].mood, dm['2026-10-27'].grade], [3, 70, '🔥', 3], 'two entries + a note on one day: 3 entries, 70 words, the latest mood 🔥, the best grade ดี');
assert.deepEqual([dm['2026-10-26'].mood, dm['2026-10-26'].grade, dm['2026-10-26'].words], ['', 0, 10], 'no mood → empty (drawn as "·"), no grade → 0');
assert.deepEqual([dm['2026-10-23'].count, dm['2026-10-23'].words, dm['2026-10-23'].mood], [1, 0, ''], 'a Learning-Note-only day: an entry with no words / mood');

// heatmap
const cal8 = W.heat(dm, '2026-10-28', 8, true), cal4 = W.heat(dm, '2026-10-28', 4, true);
assert.equal(cal8.length, 8, '8 week columns'); assert.equal(cal4.length, 4, 'collapsed = last 4'); assert.ok(cal8.every(c => c.length === 7));
assert.equal(cal8[7][0].key, '2026-10-26', 'the current week starts on Monday and is the last column'); assert.equal(cal8[0][0].key, W.addDay('2026-10-26', -49));
assert.equal(cal8[7][2].today, true, 'Wed 28 is today (row 2)'); assert.equal(cal8[7][3].future, true); assert.equal(cal8[7][1].dom, 27, 'the day number'); assert.equal(cal8[7][1].mood, '🔥'); assert.equal(cal8[7][1].grade, 3);
assert.equal(cal8[7][1].level, 3, '70 words → darkest tint'); assert.equal(cal8[7][0].level, 1, '10 words → lightest'); assert.equal(cal8[6][4].level, 1, 'Fri 23: a note-only day is lit lightly'); assert.equal(cal8[6][5].has, false);
assert.equal(cal8[7][5].weekend, true); assert.equal(W.heat(dm, '2026-10-28', 8, false)[7][1].grade, 0, 'grades hidden → no bars');
assert.equal(W.heat({ '2026-10-24': { count: 1, words: 5, mood: '😊', grade: 0 } }, '2026-10-28', 8, true)[6][5].has, true, 'a weekend entry lights its Saturday cell');
assert.equal(cal8.flat().filter(c => c.d1).length, 2, 'the 1st of Oct and the 1st of Nov (a future Sunday) are flagged'); assert.equal(cal4.flat().filter(c => c.d1).length, 1);
const ml = W.monthLabels(cal8); assert.deepEqual(ml, { 0: 8, 3: 9, 7: 10 }, 'month label over the first column (Sep), over the column holding 1 Oct and over the one holding 1 Nov: ' + JSON.stringify(ml));
// the detail line
const Dd = W.D;
assert.equal(W.detailText(cal8[7][1], Dd.en), 'Tue 27 Oct · 🔥 · Writing check: Good · 70 words · 3 entries');
assert.equal(W.detailText(cal8[7][1], Dd.th), 'อ. 27 ต.ค. · 🔥 · ตรวจภาษา: ดี · 70 คำ · 3 บันทึก'); assert.equal(W.detailText(cal8[7][1], Dd.ko), '10월 27일 (화) · 🔥 · 문법 점검: 좋음 · 70단어 · 3건');
assert.equal(W.detailText(cal8[7][0], Dd.en), 'Mon 26 Oct · · · 10 words', 'no mood → a neutral dot');
assert.equal(W.detailText(cal8[6][0], Dd.en), 'Mon 19 Oct · no entry'); assert.equal(W.detailText(cal8[6][0], Dd.th), 'จ. 19 ต.ค. · ไม่มีบันทึก'); assert.equal(W.detailText(cal8[6][0], Dd.ko), '10월 19일 (월) · 기록 없음');
// grades
let gr = W.grades([log('2026-10-01', 5, g('ดี', '2026-10-02'))]); assert.equal(gr.show, false, 'under 2 graded: hidden');
gr = W.grades([log('2026-10-01', 5, g('ดี', '2026-10-02')), log('2026-10-03', 5, g('พอใช้', '2026-10-04')), log('2026-10-05', 5)]); assert.equal(gr.show, true); assert.deepEqual(gr.items, ['good', 'fair']); assert.equal(gr.caption, null, '2 graded: no sentence');
gr = W.grades([log('2026-10-01', 5, g('ดี', '2026-10-02')), log('2026-10-03', 5, g('ดี', '2026-10-04')), log('2026-10-05', 5, g('พอใช้', '2026-10-06'))]); assert.deepEqual(gr.caption, { grade: 'good', dir: null }, '3 graded: mostly ดี, no direction yet');
const seq = a => W.grades(a.map((x, i) => log('2026-09-' + String(i + 1).padStart(2, '0'), 5, g(x, '2026-09-' + String(i + 1).padStart(2, '0')))));
assert.equal(seq(['ดี', 'ดี', 'ดี', 'พอใช้', 'ควรปรับ']).caption.dir, null, 'under 6 graded: no direction');
assert.deepEqual(seq(['ควรปรับ', 'ควรปรับ', 'พอใช้', 'ดี', 'ดี', 'ดี']).caption, { grade: 'good', dir: 'up' }, 'getting better');
assert.equal(seq(['ดี', 'ดี', 'ดี', 'พอใช้', 'ควรปรับ', 'ควรปรับ']).caption.dir, 'down', 'a gentle "a little lower" (never alarmed)');
assert.equal(seq(['ดี', 'ดี', 'ดี', 'ดี', 'ดี', 'ดี']).caption.dir, 'steady');
const nine = seq(['ดี', 'พอใช้', 'ดี', 'ควรปรับ', 'ดี', 'ดี', 'พอใช้', 'ดี', 'ควรปรับ']); assert.equal(nine.items.length, 8, 'last 8 only'); assert.equal(nine.n, 9);
assert.deepEqual(W.grades([log('2026-10-01', 5, { latestGrammarGrade: 'ดี ', latestGrammarTs: ts('2026-10-02') }), log('2026-10-02', 5, { latestGrammarGrade: 'excellent', latestGrammarTs: ts('2026-10-03') }), log('2026-10-03', 5, { latestGrammarGrade: null }), log('2026-10-04', 5, { latestGrammarGrade: 'พอใช้', latestGrammarTs: ts('2026-10-05') })]).items, ['good', 'fair'], 'tolerant: trims, ignores unknown / missing grades');
assert.deepEqual(W.grades([log('2026-10-01', 5, g('พอใช้', '2026-10-09')), log('2026-10-02', 5, g('ดี', '2026-10-03'))]).items, ['good', 'fair'], 'ordered by the grade time, oldest → newest');
const js = fs.readFileSync('public/writing-progress.js', 'utf8');
assert.ok(!/#(?:dc2626|ef4444|f87171|b91c1c)/i.test(js), 'no alarm red anywhere in the card');
assert.ok(!/["'\s.]wp-(?:mood|mbars|chk|dots)\b/.test(js), 'no separate mood strip / grade strip left');
for (const k of ['th', 'en', 'ko']) { const L = W.D[k]; for (const f of ['title', 'streak', 'best', 'fresh', 'fresh2', 'today', 'chk', 'darker', 'bar', 'none', 'w', 'entries', 'date', 'mostly', 'up', 'down', 'steady']) assert.ok(L[f], k + '.' + f); assert.ok(L.grade.good && L.grade.fair && L.grade.needs, k + ' grade names'); }

// ---------- page ----------
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
function weekdays(n, mk) { const out = []; for (let i = 1; i <= 60 && out.length < n; i++) { const k = W.addDay('2026-10-28', -i), dw = new Date(k + 'T00:00:00Z').getUTCDay(); if (dw === 0 || dw === 6) continue; out.push(mk(k, out.length)); } return out; }
const THAI = 'วันนี้ได้ฝึกคำนวณขนาดยาเด็กและทบทวนการเตรียมยาน้ำ '.repeat(2);
const MID = weekdays(22, (k, i) => ({ id: 'm' + i, content: i % 3 ? THAI : 'Counselled a patient on inhaler technique today and reviewed spacer fit', mood: ['😊', '😐', '🔥'][i % 3], timestamp: ts(k, 18), status: 'approved' })).filter((_, i) => i % 4 !== 3);
const GRADED = n => MID.map((l, i) => i < n ? Object.assign({}, l, { latestGrammarGrade: ['ดี', 'พอใช้', 'ควรปรับ'][i % 3], latestGrammarTs: ts(W.addDay('2026-10-27', -i), 20) }) : l);

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(NOW);
    await page.addInitScript(() => {
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => chain, { FieldValue: { serverTimestamp: () => 'TS', increment: n => n, delete: () => 'DEL' } }) : chain, apply: () => chain });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' }); await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.getElementById('main-app').style.setProperty('display', 'block', 'important');
      const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
      document.getElementById('kanban-content').style.display = 'block'; switchMissionTab('reflection');
      userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
    });
    const seed2 = async (rows, targets, lang, open) => {
      await page.evaluate(([rows, targets, lang, open]) => {
        const T = x => x ? { toDate: () => new Date(x) } : undefined;
        window.myReflectiveLogsCache = rows.map(l => ({ ...l, timestamp: T(l.ts), latestGrammarTs: T(l.gts) })); window.myLpEntriesCache = [];
        document.body.classList.toggle('lang-th-on', lang === 'th'); document.body.classList.toggle('lang-kr-on', lang === 'ko');
        window.WritingProgress.setOpen(!!open); window.WritingProgress.setSel('');
        window.monthlyProgress.update({ logs: _combinedLogCache(), cases: [], targets: targets || {}, save: async () => {} });
        renderMyWritingProfile();
      }, [rows.map(l => ({ ...l, ts: l.timestamp.toDate().toISOString(), gts: l.latestGrammarTs ? l.latestGrammarTs.toDate().toISOString() : undefined, timestamp: undefined, latestGrammarTs: undefined })), targets, lang || 'en', open]);
      await page.waitForTimeout(120);
    };
    const info = () => page.evaluate(() => {
      const c = document.getElementById('my-writing-profile'); const vis = c.offsetParent !== null; if (!vis) return { vis };
      const q = s => c.querySelector(s), qa = s => [...c.querySelectorAll(s)];
      const cell = q('.hm-c.wd[data-s]'); const cr = cell && cell.getBoundingClientRect(), st = q('.hm-c.we.l0');
      return { vis, h: Math.round(c.getBoundingClientRect().height), chips: qa('.wp-chip').map(x => x.textContent.trim()), cells: qa('.hm-c').length, lit: qa('.hm-c.l1,.hm-c.l2,.hm-c.l3').length, today: qa('.hm-c.t').length,
        sel: qa('.hm-c.sel').map(x => x.dataset.s), detail: (q('.hm-detail') || {}).textContent, legend: (q('.hm-leg') || {}).textContent, side: !!q('.hm-flex .hm-side'), months: qa('.hm-m').map(x => x.textContent).filter(Boolean),
        nums: qa('.hm-c.wd[data-s] .hm-n').length, emoji: qa('.hm-c[data-s] .hm-e').length, bars: qa('.hm-bar').length,
        old: ['.wp-mood', '.wp-mbars', '.wp-chk', '.wp-dots', '.wp-grid', '.wp-ins'].filter(s => q(s)), note: (q('.wp-note') || {}).textContent, det: !!q('.wp-det'), headH: Math.round(q('#wp-tog').getBoundingClientRect().height),
        cellW: cr ? Math.round(cr.width) : 0, cellH: cr ? Math.round(cr.height) : 0, strip: st ? Math.round(st.getBoundingClientRect().height) : 0, w: Math.round(c.getBoundingClientRect().width), sw: c.scrollWidth,
        check: (q('#mwp-check') || {}).textContent };
    });

    // mid, EN, no target, collapsed
    await seed2(MID, {}, 'en'); let r = await info();
    assert.ok(r.vis && r.cells >= 28 && r.cells <= 40, 'collapsed: 4 week columns × 7 rows of cells (+ strips): ' + r.cells); assert.deepEqual(r.old, [], 'no separate mood strip / grade strip / old calendar / insight line');
    assert.ok(r.side && r.detail && /Oct/.test(r.detail), 'the detail line + legend sit beside the grid: ' + r.detail); assert.match(r.legend, /darker = more words/); assert.ok(!/bottom bar/.test(r.legend), 'no grades yet → no bar legend');
    assert.equal(r.today, 1, 'today is ringed'); assert.ok(r.lit >= 5); assert.ok(r.nums >= 10 && r.emoji >= 5 && r.bars === 0, 'day numbers + emoji in the cells, no grade bars without ≥2 graded entries');
    assert.equal(r.cellW, 34, 'collapsed cells are 34 px wide'); assert.equal(r.cellH, 36); assert.ok(r.months.length >= 1 && r.months.length <= 2, 'month labels: ' + r.months);
    assert.match(r.chips.join(' | '), /🔥 \d+d/); assert.ok(r.chips.some(c => /^📅 \d+ Oct$/.test(c)), 'no target → just the number: ' + r.chips); assert.ok(r.chips.some(c => /^○ Today$/.test(c)), 'Wed 10:00, nothing written today');
    assert.ok(!r.det, 'collapsed by default'); assert.ok(r.h <= 360, 'collapsed card is lean (mockup v1 = 346 px): ' + r.h); assert.ok(r.headH >= 40, 'header ≥ 40 px'); assert.ok(r.sw <= r.w + 1, 'no horizontal overflow at 390 px');
    // the month chip IS monthlyProgress.summary()'s Journal number
    const sum = await page.evaluate(() => window.monthlyProgress.summary().find(x => x.k === 'j'));
    assert.equal(Number(r.chips.find(c => /^📅/.test(c)).match(/\d+/)[0]), sum.n, 'chip n = monthlyProgress.summary() Journal n'); assert.equal(sum.target, 0);
    await seed2(MID, { log: 50 }, 'en'); r = await info(); assert.ok(r.chips.some(c => new RegExp('^📅 ' + sum.n + '/50 Oct$').test(c)), 'target → n/target: ' + r.chips);
    await seed2(MID, { log: 1 }, 'en'); r = await info(); assert.ok(r.chips.some(c => /^📅 ✓ \d+\/1 Oct$/.test(c)), 'at the target → ✓: ' + r.chips);
    assert.equal(await page.evaluate(() => document.querySelector('[data-wp="goal"]').classList.contains('ok')), true, 'green frame (ok state)');
    await page.evaluate(() => { window.__edit = 0; const e = window.monthlyProgress.edit; window.monthlyProgress.edit = () => { window.__edit++; return e && e(); }; });
    await page.locator('[data-wp="goal"]').click(); assert.equal(await page.evaluate(() => window.__edit), 1, 'tapping the month chip opens the monthly editor');
    await page.evaluate(() => { document.querySelectorAll('dialog[open],[role=dialog]').forEach(d => d.remove()); });
    const hit = await page.evaluate(() => { const b = document.querySelector('[data-wp="goal"]'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2; return [r.top - 8, r.bottom + 8].map(y => document.elementFromPoint(x, y) === b); });
    assert.deepEqual(hit, [true, true], 'chip hit area reaches ≥ 8 px beyond the pill on both sides (≥ 40 px tall in all)');
    // TH + KO
    await seed2(MID, { log: 20 }, 'th'); r = await info(); assert.match(r.legend, /สีเข้ม = คำมาก/); assert.ok(r.chips.some(c => /ต\.ค\./.test(c))); assert.match(r.detail, /ต\.ค\./);
    await seed2(MID, { log: 20 }, 'ko'); r = await info(); assert.match(r.legend, /진할수록 단어 많음/); assert.ok(r.chips.some(c => /10월/.test(c))); assert.match(r.detail, /10월/);
    await page.evaluate(() => { document.body.classList.remove('lang-kr-on'); document.body.classList.add('lang-th-on'); document.dispatchEvent(new CustomEvent('lang-changed')); }); await page.waitForTimeout(80);
    r = await info(); assert.match(r.legend, /สีเข้ม = คำมาก/, 'the card repaints when the language toggles');
    // tap a day → one inline detail line, the dark outline moves
    await seed2(MID, {}, 'en'); const before = (await info()).sel[0];
    const target = await page.evaluate(b => { const c = [...document.querySelectorAll('.hm-c.wd[data-s]')].find(x => x.dataset.s !== b && !x.classList.contains('l0')); return c && c.dataset.s; }, before);
    await page.locator('.hm-c[data-s="' + target + '"]').click(); r = await info(); assert.deepEqual(r.sel, [target], 'the tapped day is selected'); assert.ok(r.detail.includes(Number(target.slice(8)) + ' Oct'), 'its detail is in the inline line: ' + r.detail);
    const emptyDay = await page.evaluate(() => { const c = document.querySelector('.hm-c.wd.l0[data-s]'); return c && c.dataset.s; });
    if (emptyDay) { await page.locator('.hm-c[data-s="' + emptyDay + '"]').click(); assert.match((await info()).detail, /no entry$/, 'an empty weekday says "no entry"'); }
    // expand → 8 weeks + the old stats (ids kept); collapse again
    await seed2(MID, {}, 'en'); const collapsedH = (await info()).h; await page.locator('#wp-tog').click(); await page.waitForTimeout(80);
    r = await info(); assert.ok(r.cells >= 56, 'expanded: 8 week columns: ' + r.cells); assert.ok(r.det && r.h > collapsedH); assert.ok(!r.side, 'expanded: detail + legend sit under the grid');
    const open = await page.evaluate(() => ['mwp-total-words', 'mwp-words-sub', 'mwp-active-days', 'mwp-streak-sub', 'mwp-lang-bar', 'mwp-lang-sub', 'mwp-mood-top', 'mwp-mood-rest'].map(id => !!document.getElementById(id)));
    assert.ok(open.every(Boolean), 'the old stat ids are back when expanded'); assert.ok(r.cellW >= 28, 'expanded cells are wide enough for number + emoji: ' + r.cellW); assert.equal(r.strip, 6, 'empty weekend day = 6 px strip');
    await page.locator('#wp-tog').click(); await page.waitForTimeout(60); assert.equal((await info()).det, false);
    // the writing check lives INSIDE the cells: bars only from 2 graded entries, calm colours, legend + the one-line sentence in the expanded stats
    await seed2(GRADED(0), {}, 'en'); assert.equal((await info()).bars, 0, '0 graded → no bars');
    await seed2(GRADED(1), {}, 'en'); assert.equal((await info()).bars, 0, '1 graded → still hidden');
    await seed2(GRADED(2), {}, 'en'); r = await info(); assert.equal(r.bars, 2, '2 graded → 2 bars'); assert.match(r.legend, /bottom bar = writing check/); assert.match(r.legend, /Good.*Fair.*Needs work/);
    await seed2(GRADED(8), {}, 'en', true); r = await info(); assert.equal(r.bars, 8, '8 graded entries → 8 bars (expanded 8 weeks)'); assert.match(r.check, /^Recent checks mostly (Good|Fair|Needs work) · (getting better|a little lower lately|steady)$/, 'sentence from 3 graded, direction from 6: ' + r.check);
    const colors = await page.evaluate(() => [...document.querySelectorAll('.hm-bar')].map(d => getComputedStyle(d).backgroundColor)); assert.ok(colors.length === 8 && colors.every(c => /rgb\((5, 150, 105|217, 119, 6|107, 111, 176)\)/.test(c)), 'bars use the calm green / amber / indigo only: ' + colors);
    await seed2(GRADED(3), {}, 'en', true); r = await info(); assert.match(r.check, /^Recent checks mostly \S+( \S+)?$/, '3 graded: the sentence without a direction: ' + r.check);
    await seed2(GRADED(8), {}, 'th', true); r = await info(); assert.match(r.legend, /แถบล่าง = ตรวจภาษา/); assert.match(r.check, /ผลตรวจล่าสุดส่วนใหญ่/);
    await seed2(GRADED(8), {}, 'ko', true); r = await info(); assert.match(r.legend, /아래 막대 = 문법 점검/); assert.match(r.check, /최근 점검은 대부분/);
    // a graded day: number + emoji + bar inside ONE cell, and its detail names the check
    await seed2(GRADED(8), {}, 'en', true);
    const one = await page.evaluate(() => { const c = document.querySelector('.hm-c.g3, .hm-c.g2, .hm-c.g1'); return { n: !!c.querySelector('.hm-n'), e: !!c.querySelector('.hm-e'), b: !!c.querySelector('.hm-bar'), label: c.getAttribute('aria-label') }; });
    assert.deepEqual([one.n, one.e, one.b], [true, true, true], 'number + emoji + grade bar in one cell'); assert.match(one.label, /Writing check: (Good|Fair|Needs work)/);
    // a weekend entry is a 16 px cell with number + emoji
    const sat = Object.assign({}, MID[0], { id: 'sat', timestamp: ts('2026-10-24', 10) });
    await seed2([sat].concat(MID), {}, 'en', true);
    const satCell = await page.evaluate(() => { const c = document.querySelector('.hm-c.we[data-s="2026-10-24"]'); return c && { h: Math.round(c.getBoundingClientRect().height), n: !!c.querySelector('.hm-n'), e: !!c.querySelector('.hm-e') }; });
    assert.deepEqual(satCell, { h: 16, n: true, e: true }, 'weekend entry: 16 px cell with number + emoji');
    // new intern: 2 written days → short view
    await seed2(MID.slice(0, 2), {}, 'en'); r = await info(); assert.equal(r.cells, 0, 'no heatmap yet'); assert.ok(r.note && /Keep writing|Good start/.test(r.note), r.note); assert.ok(r.h < 150, 'short view: ' + r.h);
    assert.ok(!r.chips.some(c => /^📅/.test(c)), 'no month chip in the short view');
    // nothing written → the card hides
    await seed2([], {}, 'en'); assert.equal((await info()).vis, false, 'hidden with nothing written');
    // today written → no "○ Today"
    const todayRow = Object.assign({}, MID[0], { id: 'td', timestamp: ts('2026-10-28', 8) });
    await seed2([todayRow].concat(MID), {}, 'en'); r = await info(); assert.ok(!r.chips.some(c => /○ Today/.test(c)), 'written today → no "○ Today" chip'); assert.ok(/🔥 \d+d/.test(r.chips.join(' ')));
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('PASS writing-progress-qa');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
