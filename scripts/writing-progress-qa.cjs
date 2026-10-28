// V101.232: the intern's Journal progress card (public/writing-progress.js) — pure rules + the REAL index.html on a 390 px phone (Bangkok clock fixed, Wed 28 Oct 2026 10:00).
// Pure: weekday-aware streak (Sat / Sun never break it, Fri → Mon is consecutive, a weekend entry counts, today not written keeps it alive), the 10-week calendar,
// the month numbers, C's mood strip (last 14 entries, newest right, neutral dot when no mood, bars scaled by words with a cap, hidden at 0), the mentor-grade strip (tolerant mapping, hidden under 2, caption from 3, calm colours only). Page: collapsed card (chips · insight · calendar · grades),
// new-intern short view, EN / TH / KO, the month chip = monthlyProgress.summary() (target → n/target, green ✓ at the target, none → just n, tap opens the editor), expand for the
// old stats (ids kept), 40 px header + chip hit areas, repaint on lang-changed, no console errors.
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
let m = W.model({ logs: [log('2026-10-27', 40), log('2026-10-26', 20), log('2026-10-24', 10), log('2026-09-29', 30), { id: 'p', content: 'x y', timestamp: null }], now: NOW, wordCount: wc });
assert.equal(m.today, '2026-10-28'); assert.equal(m.dayCount, 4, 'a pending / missing timestamp is skipped');
assert.equal(m.cur, 3, 'Tue + Mon + the Saturday entry (Sun skipped); Fri 23 was missed');
assert.equal(m.monthN, 3, 'this month = 3 entries (own count, no month row yet)'); assert.equal(m.haveMonthRow, false); assert.ok(!('insight' in m), 'B\'s insight line is gone');
m = W.model({ logs: [log('2026-10-27', 40)], month: { n: 7, target: 12 }, now: NOW, wordCount: wc });
assert.equal(m.monthN, 7, 'the chip number is the monthlyProgress row\'s own'); assert.equal(m.target, 12);
m = W.model({ logs: [log('2026-10-27', 40)], month: { n: 7, target: 0 }, now: NOW, wordCount: wc }); assert.equal(m.target, 0, 'no target → none (no default)');
m = W.model({ logs: [], combined: [{ timestamp: ts('2026-10-27') }, { timestamp: ts('2026-10-26') }, { timestamp: ts('2026-10-23') }], now: NOW, wordCount: wc });
assert.equal(m.dayCount, 3, 'Learning Notes (combined cache) count as written days'); assert.equal(m.totals.words, 0, '… but not as words'); assert.equal(m.fresh, false);
m = W.model({ logs: [log('2026-10-27', 5)], now: NOW, wordCount: wc }); assert.equal(m.fresh, true, '1–2 written days = the short new-intern view');
// mood strip
const many = Array.from({ length: 20 }, (_, i) => log(W.addDay('2026-10-01', i), 10 + i * 10, i === 19 ? { mood: '', moodSecondary: '' } : i === 18 ? { mood: '🔥', moodSecondary: '😴' } : {}));
m = W.model({ logs: many, now: NOW, wordCount: wc }); assert.equal(m.moods.length, 14, 'the 14 newest entries'); assert.equal(m.moods[13].mood, '', 'newest is last (right)'); assert.equal(m.moods[13].w, 200, 'words of the newest entry');
assert.equal(m.moods[12].mood, '🔥'); assert.equal(m.moods[12].mood2, '😴', 'the second emoji is kept'); assert.equal(m.moods[0].w, 70, 'oldest of the 14 = entry #7 (10 + 6 × 10 words)');
assert.ok(m.moods.every(x => x.pct >= 8 && x.pct <= 100), 'bars are 8–100 %'); assert.equal(m.moods[13].pct, 100, 'a long entry is the full bar'); assert.equal(m.moods[12].pct, 100, '190 words is past the 150 cap too'); assert.equal(m.moods[0].pct, 47, '70 words = 47 % of the cap');
const capped = W.model({ logs: [log('2026-10-26', 600), log('2026-10-27', 75)], now: NOW, wordCount: wc }).moods; assert.equal(capped[0].pct, 100); assert.equal(capped[1].pct, 50, 'the cap (150 words) keeps one long entry from flattening the rest');
assert.deepEqual(W.model({ logs: [], combined: [{ timestamp: ts('2026-10-27') }, { timestamp: ts('2026-10-26') }, { timestamp: ts('2026-10-23') }], now: NOW, wordCount: wc }).moods, [], 'no worded entries → no strip');
// calendar
const cal = W.model({ logs: [log('2026-10-27', 70), log('2026-10-26', 35), log('2026-10-24', 5)], now: NOW, wordCount: wc }).cal;
assert.equal(cal.length, 10, '10 week columns'); assert.ok(cal.every(c => c.length === 7)); assert.equal(cal[9][0].key, '2026-10-26', 'the current week starts on Monday and is the last column');
assert.equal(cal[9][2].today, true, 'Wed 28 is today (row 2)'); assert.equal(cal[9][3].future, true); assert.equal(cal[9][1].level, 3); assert.equal(cal[9][0].level, 2); assert.equal(cal[8][5].level, 1, 'Sat 24 entry lights the slim Saturday cell');
assert.ok(cal[0][0].key === W.addDay('2026-10-26', -63));
// grades
const g = (grade, key) => ({ latestGrammarGrade: grade, latestGrammarTs: ts(key) });
let gr = W.grades([log('2026-10-01', 5, g('ดี', '2026-10-02'))]); assert.equal(gr.show, false, 'under 2 graded: hidden');
gr = W.grades([log('2026-10-01', 5, g('ดี', '2026-10-02')), log('2026-10-03', 5, g('พอใช้', '2026-10-04')), log('2026-10-05', 5)]); assert.equal(gr.show, true); assert.deepEqual(gr.items, ['good', 'fair']); assert.equal(gr.caption, null, '2 graded: dots only');
gr = W.grades([log('2026-10-01', 5, g('ดี', '2026-10-02')), log('2026-10-03', 5, g('ดี', '2026-10-04')), log('2026-10-05', 5, g('พอใช้', '2026-10-06'))]); assert.deepEqual(gr.caption, { kind: 'mostly', grade: 'good' }, '3 graded: mostly ดี');
const seq = a => W.grades(a.map((x, i) => log('2026-09-' + String(i + 1).padStart(2, '0'), 5, g(x, '2026-09-' + String(i + 1).padStart(2, '0')))));
assert.equal(seq(['ควรปรับ', 'ควรปรับ', 'พอใช้', 'ดี', 'ดี', 'ดี']).caption.kind, 'up', 'getting better');
assert.equal(seq(['ดี', 'ดี', 'ดี', 'พอใช้', 'ควรปรับ', 'ควรปรับ']).caption.kind, 'down', 'a gentle "a little lower" (never alarmed)');
assert.equal(seq(['ดี', 'ดี', 'ดี', 'ดี', 'ดี', 'ดี']).caption.kind, 'steady');
const nine = seq(['ดี', 'พอใช้', 'ดี', 'ควรปรับ', 'ดี', 'ดี', 'พอใช้', 'ดี', 'ควรปรับ']); assert.equal(nine.items.length, 8, 'last 8 only'); assert.equal(nine.n, 9);
assert.deepEqual(W.grades([log('2026-10-01', 5, { latestGrammarGrade: 'ดี ', latestGrammarTs: ts('2026-10-02') }), log('2026-10-02', 5, { latestGrammarGrade: 'excellent', latestGrammarTs: ts('2026-10-03') }), log('2026-10-03', 5, { latestGrammarGrade: null }), log('2026-10-04', 5, { latestGrammarGrade: 'พอใช้', latestGrammarTs: ts('2026-10-05') })]).items, ['good', 'fair'], 'tolerant: trims, ignores unknown / missing grades');
assert.deepEqual(W.grades([log('2026-10-01', 5, g('พอใช้', '2026-10-09')), log('2026-10-02', 5, g('ดี', '2026-10-03'))]).items, ['good', 'fair'], 'ordered by the grade time, oldest → newest');
const js = fs.readFileSync('public/writing-progress.js', 'utf8');
assert.ok(!/\.wp-g\.[a-z]+\{background:#(?:dc2626|ef4444|f87171|b91c1c)/i.test(js), 'no alarm red on the grade dots');
for (const k of ['th', 'en', 'ko']) { const L = W.D[k]; for (const f of ['title', 'streak', 'best', 'moodCap', 'noMood', 'entry', 'cal', 'fresh', 'fresh2', 'today', 'chk', 'mostly', 'up', 'down', 'steady', 'cell', 'aria']) assert.ok(L[f], k + '.' + f); assert.ok(L.grade.good && L.grade.fair && L.grade.needs, k + ' grade names'); }

// ---------- page ----------
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
function weekdays(n, mk) { const out = []; for (let i = 1; i <= 60 && out.length < n; i++) { const k = W.addDay('2026-10-28', -i), dw = new Date(k + 'T00:00:00Z').getUTCDay(); if (dw === 0 || dw === 6) continue; out.push(mk(k, out.length)); } return out; }
const THAI = 'วันนี้ได้ฝึกคำนวณขนาดยาเด็กและทบทวนการเตรียมยาน้ำ ' .repeat(2);
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
    // latestGrammarTs needs toDate too: re-seed through a helper that rebuilds both timestamps
    const seed2 = async (rows, targets, lang) => {
      await page.evaluate(([rows, targets, lang]) => {
        const T = x => x ? { toDate: () => new Date(x) } : undefined;
        window.myReflectiveLogsCache = rows.map(l => ({ ...l, timestamp: T(l.ts), latestGrammarTs: T(l.gts) })); window.myLpEntriesCache = [];
        document.body.classList.toggle('lang-th-on', lang === 'th'); document.body.classList.toggle('lang-kr-on', lang === 'ko');
        window.WritingProgress.setOpen(false);
        window.monthlyProgress.update({ logs: _combinedLogCache(), cases: [], targets: targets || {}, save: async () => {} });
        renderMyWritingProfile();
      }, [rows.map(l => ({ ...l, ts: l.timestamp.toDate().toISOString(), gts: l.latestGrammarTs ? l.latestGrammarTs.toDate().toISOString() : undefined, timestamp: undefined, latestGrammarTs: undefined })), targets, lang || 'en']);
      await page.waitForTimeout(120);
    };
    const info = () => page.evaluate(() => {
      const c = document.getElementById('my-writing-profile'); const vis = c.offsetParent !== null; if (!vis) return { vis };
      const q = s => c.querySelector(s);
      return { vis, h: Math.round(c.getBoundingClientRect().height), chips: [...c.querySelectorAll('.wp-chip')].map(x => x.textContent.trim()), ins: (q('.wp-ins') || {}).textContent, moodCells: c.querySelectorAll('.wp-mood > span').length, moodBars: c.querySelectorAll('.wp-mbars > i').length, moodNow: ((c.querySelectorAll('.wp-mood > span')[13] || {}).textContent || ''), moodCap: [...c.querySelectorAll('.wp-cap')].map(x => x.textContent).join('|'), cells: c.querySelectorAll('.wp-grid .wp-c').length,
        lit: c.querySelectorAll('.wp-grid .wp-c.l1,.wp-grid .wp-c.l2,.wp-grid .wp-c.l3').length, today: c.querySelectorAll('.wp-c.t').length, grid: !!q('.wp-grid'), note: (q('.wp-note') || {}).textContent, dots: [...c.querySelectorAll('.wp-g')].map(d => d.className.replace('wp-g ', '')),
        chk: (q('.wp-chk') || {}).textContent, det: !!q('.wp-det'), headH: Math.round(q('#wp-tog').getBoundingClientRect().height), text: c.innerText, w: Math.round(c.getBoundingClientRect().width), sw: c.scrollWidth };
    });

    // mid, EN, no target
    await seed2(MID, {}, 'en'); let r = await info();
    assert.ok(r.vis && r.grid && r.cells === 70, 'calendar 10 × 7 cells'); assert.ok(r.lit >= 10, 'days are lit'); assert.equal(r.today, 1, 'today is ringed');
    assert.match(r.chips.join(' | '), /🔥 \d+d/); assert.ok(r.chips.some(c => /^📅 \d+ Oct$/.test(c)), 'no target → just the number: ' + r.chips); assert.ok(r.chips.some(c => /^○ Today$/.test(c)), 'Wed 10:00, nothing written today');
    assert.equal(r.ins, undefined, 'no insight line'); assert.equal(r.moodCells, 14, 'C: 14 mood cells'); assert.equal(r.moodBars, 14, '… and 14 bars'); assert.ok(r.moodNow.length > 0, 'newest emoji on the right'); assert.ok(!r.det, 'collapsed by default'); assert.ok(r.h < 300, 'collapsed card is lean: ' + r.h); assert.ok(r.headH >= 40, 'header ≥ 40 px'); assert.equal(r.dots.length, 0, 'no grades → no strip');
    assert.ok(r.sw <= r.w + 1, 'no horizontal overflow at 390 px');
    // the month chip IS monthlyProgress.summary()'s Journal number
    const sum = await page.evaluate(() => window.monthlyProgress.summary().find(x => x.k === 'j'));
    assert.equal(Number(r.chips.find(c => /^📅/.test(c)).match(/\d+/)[0]), sum.n, 'chip n = monthlyProgress.summary() Journal n'); assert.equal(sum.target, 0);
    // target set → n/target; at the target → green ✓
    await seed2(MID, { log: 50 }, 'en'); r = await info(); assert.ok(r.chips.some(c => new RegExp('^📅 ' + sum.n + '/50 Oct$').test(c)), 'target → n/target: ' + r.chips);
    await seed2(MID, { log: 1 }, 'en'); r = await info(); assert.ok(r.chips.some(c => /^📅 ✓ \d+\/1 Oct$/.test(c)), 'at the target → ✓: ' + r.chips);
    assert.equal(await page.evaluate(() => document.querySelector('[data-wp="goal"]').classList.contains('ok')), true, 'green frame (ok state)');
    // tap the chip → the monthlyProgress editor opens
    await page.evaluate(() => { window.__edit = 0; const e = window.monthlyProgress.edit; window.monthlyProgress.edit = () => { window.__edit++; return e && e(); }; });
    await page.locator('[data-wp="goal"]').click(); assert.equal(await page.evaluate(() => window.__edit), 1, 'tapping the month chip opens the monthly editor');
    await page.evaluate(() => { document.querySelectorAll('dialog[open],[role=dialog]').forEach(d => d.remove()); });
    // chip hit area ≥ 40 px (the invisible ::after)
    const hit = await page.evaluate(() => { const b = document.querySelector('[data-wp="goal"]'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2; return [r.top - 8, r.bottom + 8].map(y => document.elementFromPoint(x, y) === b); });
    assert.deepEqual(hit, [true, true], 'chip hit area reaches ≥ 8 px beyond the pill on both sides (≥ 40 px tall in all)');
    // TH + KO
    await seed2(MID, { log: 20 }, 'th'); r = await info(); assert.match(r.moodCap, /อารมณ์ 14/); assert.ok(r.chips.some(c => /ต\.ค\./.test(c)));
    await seed2(MID, { log: 20 }, 'ko'); r = await info(); assert.match(r.moodCap, /최근 14건/); assert.ok(r.chips.some(c => /10월/.test(c)));
    // repaint on lang-changed
    await page.evaluate(() => { document.body.classList.remove('lang-kr-on'); document.body.classList.add('lang-th-on'); document.dispatchEvent(new CustomEvent('lang-changed')); }); await page.waitForTimeout(80);
    r = await info(); assert.match(r.moodCap, /อารมณ์ 14/, 'the card repaints when the language toggles');
    // expand → the old stats, ids kept; collapse again
    await seed2(MID, {}, 'en'); await page.locator('#wp-tog').click(); await page.waitForTimeout(80);
    const open = await page.evaluate(() => ['mwp-total-words', 'mwp-words-sub', 'mwp-active-days', 'mwp-streak-sub', 'mwp-lang-bar', 'mwp-lang-sub', 'mwp-mood-top', 'mwp-mood-rest'].map(id => !!document.getElementById(id)));
    assert.ok(open.every(Boolean), 'the old stat ids are back when expanded'); assert.ok((await info()).h > r.h);
    await page.locator('#wp-tog').click(); await page.waitForTimeout(60); assert.equal((await info()).det, false);
    // grade strip: 0, 2 and 8 graded
    await seed2(GRADED(0), {}, 'en'); assert.equal((await info()).dots.length, 0, '0 graded → hidden');
    await seed2(GRADED(1), {}, 'en'); assert.equal((await info()).dots.length, 0, '1 graded → hidden');
    await seed2(GRADED(2), {}, 'en'); r = await info(); assert.equal(r.dots.length, 2, '2 graded → dots'); assert.ok(!/mostly|better|lower/i.test(r.chk), 'no caption under 3');
    await seed2(GRADED(8), {}, 'en'); r = await info(); assert.equal(r.dots.length, 8); assert.match(r.chk, /Writing check/); assert.match(r.chk, /(Recently mostly|Getting better|A little lower|Steady)/, r.chk);
    assert.ok(r.dots.every(d => ['good', 'fair', 'needs'].includes(d)));
    const colors = await page.evaluate(() => [...document.querySelectorAll('.wp-g')].map(d => getComputedStyle(d).backgroundColor)); assert.ok(!colors.some(c => /rgb\((220|239|248|185), ?(38|68|113|28)/.test(c)), 'no red dots: ' + colors);
    await seed2(GRADED(8), {}, 'th'); r = await info(); assert.match(r.chk, /ตรวจการเขียน/);
    await seed2(GRADED(8), {}, 'ko'); r = await info(); assert.match(r.chk, /글쓰기 점검/);
    // new intern: 2 written days → short view
    await seed2(MID.slice(0, 2), {}, 'en'); r = await info(); assert.equal(r.grid, false, 'no calendar yet'); assert.ok(r.note && /Keep writing|Good start/.test(r.note), r.note); assert.ok(r.h < 150, 'short view: ' + r.h);
    assert.ok(!r.chips.some(c => /^📅/.test(c)), 'no month chip in the short view');
    // an entry without a mood shows a neutral dot; the short view has no strip; two emoji keep the second one small
    await seed2([Object.assign({}, MID[0], { id: 'nm', mood: '' })].concat(MID.slice(1, 6)), {}, 'en'); r = await info(); assert.equal(await page.evaluate(() => document.querySelectorAll('.wp-mood .none').length), 1, 'no mood → neutral dot');
    await seed2([Object.assign({}, MID[0], { moodSecondary: '😴' })].concat(MID.slice(1, 6)), {}, 'en'); assert.equal(await page.evaluate(() => document.querySelectorAll('.wp-mood sup').length), 1, 'moodSecondary rides small');
    await seed2(MID.slice(0, 2), {}, 'en'); assert.equal((await info()).moodCells, 0, 'short view: no mood strip');
    // nothing written → the card hides
    await seed2([], {}, 'en'); assert.equal((await info()).vis, false, 'hidden with nothing written');
    // today written → ✓ / no "○ Today"
    const todayRow = Object.assign({}, MID[0], { id: 'td', timestamp: ts('2026-10-28', 8) });
    await seed2([todayRow].concat(MID), {}, 'en'); r = await info(); assert.ok(!r.chips.some(c => /○ Today/.test(c)), 'written today → no "○ Today" chip'); assert.ok(/🔥 \d+d/.test(r.chips.join(' ')));
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('PASS writing-progress-qa');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
