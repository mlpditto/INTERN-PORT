// V102.266 — the exact badge counts admin reads for the export must be the SAME numbers the intern app computes. The REAL index.html functions
// (collectAchievementMetrics, collectReflectiveMetrics, schLoadCheckinDays, quizTagList, …) run in a vm on a fixture; the REAL admin.html
// badgeCountsFromData runs in Chromium on the same fixture; every number is compared. Also: a failed read leaves its badges out (never 0),
// the export label shows the exact number (singular for 1) or nothing but the name (no "N+" guess), and the dialog says which.
const fs = require('node:fs'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const grab = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, 'found ' + head); let d = 0, k = src.indexOf('{', i); for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; } return src.slice(i, k + 1); };

const H = 3600000, D = 86400000, base = Date.UTC(2026, 9, 5, 0, 0, 0);   // 5 Oct 2026 00:00 UTC = 07:00 Bangkok
const ts = ms => ({ __ts: ms });
const q = (id, extra) => Object.assign({ id, title: id, questions: Array.from({ length: 10 }, () => ({ timer: 30 })) }, extra);
const FIX = {
  quizzes: [q('q1', { tags: 'Asthma, AI_VARIANT' }), q('q2', { tagList: ['COPD', 'asthma'] }), q('q3', { tags: 'Pharmcamp, Diabetes' }), q('q4', { tags: 'Hypertension' }), q('q5', { timerMode: 'total_time', totalTimer: 600, tags: '' })],
  attempts: [
    { id: 'q2_u1', quizId: 'q2', status: 'approved', totalQuestions: 3, correctCount: 1, timestamp: ts(base) },                 // overwritten by the later q2 doc (one attempt per quiz)
    { id: 'q1_u1', quizId: 'q1', status: 'approved', totalQuestions: 10, correctCount: 10, durations: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], timestamp: ts(base) },   // perfect + fast (100 s × 2 < 300 s)
    { id: 'q2b', quizId: 'q2', status: 'approved', totalQuestions: 10, correctCount: 7, timestamp: ts(base) },
    { id: 'q3_u1', quizId: 'q3', status: 'pending', totalQuestions: 5, correctCount: 5, timestamp: ts(base) },                  // pending counts; perfect; no durations
    { id: 'q4_u1', quizId: 'q4', status: 'practice_done', totalQuestions: 8, correctCount: 8, timestamp: ts(base) },             // not graded → ignored (also its tag)
    { id: 'q5_u1', quizId: 'q5', status: 'completed', totalQuestions: 4, correctCount: 4, durations: [125, 125, 125, 125], timestamp: ts(base) }   // perfect, not fast (500 s of 600 s)
  ],
  logs: [
    { id: 'l1', timestamp: ts(base), adminComment: 'good' }, { id: 'l2', timestamp: ts(base + D), adminBonus: 0.5 }, { id: 'l3', timestamp: ts(base + 2 * D), adminBonus: 0 },
    { id: 'l4', timestamp: ts(base + 3 * D) }, { id: 'l5', adminComment: 'no timestamp — the app skips it for "reviewed"' }
  ],
  subs: [{ id: 's1', questId: 'a', status: 'submitted' }, { id: 's1b', questId: 'a', status: 'received' }, { id: 's2', questId: 'b', status: 'submitted' }, { id: 's3', questId: 'c', status: 'submitted' }, { id: 's4', questId: 'd', status: 'received' }],
  checkins: [
    { id: 'c1', type: 'daily_checkin', timestamp: ts(Date.UTC(2026, 9, 4, 22, 0)) },    // 05:00 Bangkok → early
    { id: 'c2', type: 'daily_checkin', timestamp: ts(Date.UTC(2026, 9, 5, 4, 59)) },    // 11:59 Bangkok → early
    { id: 'c3', type: 'daily_checkin', timestamp: ts(Date.UTC(2026, 9, 5, 5, 0)) },     // 12:00 → not
    { id: 'c4', type: 'daily_checkin' },                                                // no timestamp
    { id: 'c5', type: 'streak_bonus', timestamp: ts(Date.UTC(2026, 9, 4, 23, 0)) }      // other type
  ],
  stamps: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
  // V102.586 Case Hunter: c3 is found only through the linked login A1 (legacy userId); c4 is card 2 of a split PDF (counted once, via c5);
  // c5 has the pre-V94.79 field diseaseSystem; c6 has no system; c7 is someone else's
  cases: [
    { id: 'c1', userId: 'u1', authUid: 'A1', diseaseSystemKey: 'cardio' }, { id: 'c2', userId: 'u1', diseaseSystemKey: 'cardio' },
    { id: 'c3', userId: 'legacy', authUid: 'A1', diseaseSystemKey: 'resp' }, { id: 'c4', userId: 'u1', caseGroup: { index: 2, total: 3 }, diseaseSystemKey: 'gi' },
    { id: 'c5', userId: 'u1', caseGroup: { index: 1, total: 3 }, diseaseSystem: 'renal' }, { id: 'c6', userId: 'u1' }, { id: 'c7', userId: 'x', authUid: 'Z', diseaseSystemKey: 'neuro' }
  ],
  links: [{ id: 'A1', authUid: 'A1', effectiveUserId: 'u1', rawLiffUserId: 'u1' }, { id: 'Z', authUid: 'Z', effectiveUserId: 'x' }]
};
const revive = (v) => JSON.parse(JSON.stringify(v), (k, x) => (x && typeof x === 'object' && '__ts' in x) ? { toDate: () => new Date(x.__ts), toMillis: () => x.__ts } : x);

// ---- the intern app's numbers
const ctx = { console, window: { myCasesCache: [], myReflectiveLogsCache: [], myLpEntriesCache: [] }, Intl, Date, Set, Math, Number, Object, Array, String, Promise, JSON };
vm.createContext(ctx);
const F = revive(FIX);
ctx.userId = 'u1';
ctx.quizzesCache = F.quizzes; ctx.quizAttemptsCache = {}; F.attempts.forEach(a => { ctx.quizAttemptsCache[a.quizId] = a; });
ctx.reflectiveLogsCache = F.logs; ctx.mySubmissionsCache = {}; F.subs.forEach(s => { ctx.mySubmissionsCache[s.questId] = s; });
ctx.myEventStamps = F.stamps; ctx.evStampsLoaded = true; ctx.achCodexApproved = null;
ctx.myOwnRow = () => ({}); ctx.collectActivityDates = () => new Set(); ctx.computeEngagementStreak = () => ({ streak: 0 }); ctx._longestDateRun = () => 0;
ctx.schParseDay = () => null; ctx.achTeamJournals = () => null; ctx.renderDailyCheckinCard = () => {};
ctx.db = { collection: name => ({ where: () => ({ limit: () => ({ get: async () => ({ forEach: cb => F.checkins.forEach(c => cb({ data: () => c })) }) }) }) }) };
// V102.586: the app's own case set = loadMyCases (authUid == the login, userId == the LINE id, merged by id, a split PDF's later cards dropped)
// and its per-system count = renderCaseSystemCards; both rules are pinned to the source so a change there fails here
assert.ok(idx.includes('const ownCases = cases.filter(x => !(x.caseGroup && x.caseGroup.index > 1));'), 'loadMyCases still drops the later cards of a split PDF');
assert.ok(idx.includes('const k = c.diseaseSystemKey || c.diseaseSystem;'), 'renderCaseSystemCards still keys on diseaseSystemKey || diseaseSystem');
assert.ok(idx.includes('cases: (window.myCasesCache || []).length'), 'Case Hunter = myCasesCache.length');
{
  const merged = new Map(); F.cases.filter(c => c.authUid === 'A1' || c.userId === 'u1').forEach(c => { if (!merged.has(c.id)) merged.set(c.id, c); });
  ctx.window.myCasesCache = [...merged.values()].filter(x => !(x.caseGroup && x.caseGroup.index > 1));
}
vm.runInContext([
  grab(idx, 'function toDateKey('), grab(idx, 'function getBangkokDateTimeParts('), grab(idx, 'function quizTagList('), idx.split('\n').find(l => l.includes('const QB_MARKER_TAG')),
  grab(idx, 'function collectReflectiveMetrics('), grab(idx, 'function collectAchievementMetrics('),
  'let schCheckinDays = null, schCheckinLoading = null, schEarlyCheckins = null, schActivityDays = null;', grab(idx, 'function schLoadCheckinDays(')
].join('\n'), ctx);
(async () => {
  await vm.runInContext('schLoadCheckinDays()', ctx);
  const m = vm.runInContext('collectAchievementMetrics()', ctx);
  const appSystems = new Set(ctx.window.myCasesCache.map(c => c.diseaseSystemKey || c.diseaseSystem).filter(Boolean)).size;
  const app = { case_hunter: m.cases, case_systems: appSystems, quiz_master: m.quizQuestions, perfectionist: m.perfectQuizzes, speedrunner: m.fastPerfect, explorer: m.quizTopics, reflective_mind: m.reflectiveLogs, mentor_feedback: m.reviewedLogs, quest_finisher: m.questsDone, early_bird: m.earlyCheckins, social_butterfly: m.eventStamps };
  assert.deepEqual(app, { case_hunter: 5, case_systems: 3, quiz_master: 29, perfectionist: 3, speedrunner: 1, explorer: 3, reflective_mind: 5, mentor_feedback: 2, quest_finisher: 2, early_bird: 2, social_butterfly: 3 }, 'sanity: the fixture exercises every rule in the app: ' + JSON.stringify(app));

  // ---- admin
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    const r = await page.evaluate(async (fix) => {
      const rev = v => JSON.parse(JSON.stringify(v), (k, x) => (x && typeof x === 'object' && '__ts' in x) ? { toDate: () => new Date(x.__ts), toMillis: () => x.__ts } : x);
      const f = rev(fix), out = {};
      out.admin = badgeCountsFromData(Object.assign({}, f, { cases: f.cases.filter(c => c.userId === 'u1' || c.authUid === 'A1') }));   // the reads already narrow cases to this person
      out.noLogs = badgeCountsFromData(Object.assign({}, f, { logs: null }));
      out.noQuizzes = badgeCountsFromData(Object.assign({}, f, { quizzes: [] }));
      out.nothing = badgeCountsFromData({});
      // badgeLiveCounts: one read rejects → only its badges are missing; every read resolves → all nine
      const docs = arr => ({ docs: arr.map(({ id, ...d }) => ({ id, data: () => d })) });
      const coll = { quiz_attempts: f.attempts, reflective_logs: f.logs, quest_submissions: f.subs, checkin_logs: f.checkins, event_stamps: f.stamps, cases: f.cases, user_auth_links: f.links };
      // cases and user_auth_links honour their where() (the others are already one person's docs in the fixture)
      const mk = (failName) => ({ collection: name => { const conds = []; const w = { where: (k, op, v) => { conds.push([k, v]); return w; }, limit: () => w, get: async () => {
        if (name === failName) throw new Error('boom');
        const all = coll[name] || [];
        return docs(name === 'cases' || name === 'user_auth_links' ? all.filter(x => conds.every(([k, v]) => x[k] === v)) : all);
      } }; return w; } });
      window.quizzesData = f.quizzes;
      db = mk(null); out.live = await badgeLiveCounts('u1');
      db = mk('reflective_logs'); out.liveNoLogs = await badgeLiveCounts('u1');
      db = mk('cases'); out.liveNoCases = await badgeLiveCounts('u1');
      db = mk('user_auth_links'); out.liveNoLinks = await badgeLiveCounts('u1');
      // the export label
      const badges = {}; BADGE_STATS_DEFS.forEach(d => { badges[d.id] = { level: d.steps === 1 ? 1 : 2 }; });
      const items = BADGE_STATS_DEFS.map(d => ({ id: d.id, t: d.steps === 1 ? (d.oneOff || 3) : 2 }));
      const st = { kind: 'board', items, person: 'nt', sub: '', score: 1, avatar: 'none', layout: 'story', labels: 'full' };
      const texts = s => [...new DOMParser().parseFromString(badgeBoardSvg(s, 'story', 400), 'image/svg+xml').querySelectorAll('text')].map(t => t.textContent);
      out.labelCases = texts(Object.assign({}, st, { counts: { case_hunter: 5, case_systems: 3 } }));
      out.labelCase1 = texts(Object.assign({}, st, { counts: { case_hunter: 1, case_systems: 1 } }));
      out.labelCasesNoSys = texts(Object.assign({}, st, { counts: { case_hunter: 4, case_systems: 0 } }));
      out.labelCasesCard = [...new DOMParser().parseFromString(badgeBoardSvg(Object.assign({}, st, { counts: { case_hunter: 12, case_systems: 4 } }), 'card', 400), 'image/svg+xml').querySelectorAll('text')].map(t => t.textContent);
      out.labelNone = texts(st); out.labelLive = texts(Object.assign({}, st, { counts: { social_butterfly: 1, quiz_master: 29, early_bird: 0 } }));
      return out;
    }, FIX);
    assert.deepEqual(r.admin, app, 'admin = app, number for number');
    assert.ok(!('mentor_feedback' in r.noLogs) && !('reflective_mind' in r.noLogs) && r.noLogs.quiz_master === 29, 'a failed source leaves only its badges out');
    assert.ok(!('speedrunner' in r.noQuizzes) && !('explorer' in r.noQuizzes) && r.noQuizzes.quiz_master === 29 && r.noQuizzes.perfectionist === 3, 'no quiz list → no Speedrunner / Explorer, the rest stays');
    assert.deepEqual(r.nothing, {}, 'nothing loaded → no numbers at all (never zeros)');
    assert.deepEqual(r.live, app, 'badgeLiveCounts reads the five collections and gives the same numbers');
    assert.ok(!('reflective_mind' in r.liveNoLogs) && !('mentor_feedback' in r.liveNoLogs) && r.liveNoLogs.early_bird === 2, 'a rejected read is skipped, the others stay');
    assert.ok(!('case_hunter' in r.liveNoCases) && !('case_systems' in r.liveNoCases) && r.liveNoCases.quiz_master === 29, 'cases read failed → Case Hunter left out, never a short count');
    assert.deepEqual([r.liveNoLinks.case_hunter, r.liveNoLinks.case_systems], [4, 2], 'login links unreadable → the LINE id’s own cases still count (c3 is missed, never invented)');
    // V102.586 (mockup pick B): Case Hunter = "5 cases" + a 3rd line "3 systems"; a badge with no exact number shows its tier name (never a guess)
    assert.ok(r.labelCases.includes('5 cases') && r.labelCases.includes('3 systems'), 'Case Hunter says cases and systems: ' + r.labelCases.filter(x => /case|system/.test(x)));
    assert.ok(r.labelCase1.includes('1 case') && r.labelCase1.includes('1 system'), 'singular for both');
    assert.ok(r.labelCasesNoSys.includes('4 cases') && !r.labelCasesNoSys.some(x => /system/.test(x)), 'no system recorded → the cases alone');
    assert.ok(r.labelCasesCard.includes('12 cases') && r.labelCasesCard.includes('4 systems'), 'card layout too: ' + r.labelCasesCard.filter(x => /case|system/.test(x)));
    assert.ok(r.labelNone.includes('Silver') && r.labelNone.includes('Gold'), 'no exact number → the tier name (Silver for the tier-2 fixture, Gold for the one-offs)');
    assert.ok(r.labelNone.includes('Quiz Master') && !r.labelNone.some(x => /^\d+ \S+$|\d\+ /.test(x)), 'no counts → the names only, no number and no "N+" guess');
    assert.ok(r.labelLive.includes('29 questions'), 'a read number is written');
    assert.ok(r.labelLive.includes('1 event') && !r.labelLive.includes('1 events'), 'singular for 1');
    assert.ok(r.labelLive.includes('0 check-ins'), 'a real 0 is shown as 0 (only "unknown" falls back)');
    assert.ok(r.labelLive.includes('Reflective Mind') && !r.labelLive.some(x => /logs$/.test(x)) && !r.labelLive.some(x => /\d\+ /.test(x)), 'a badge without a read number keeps its name only');
    console.log('PASS: badge live counts — admin numbers equal the app\'s on one fixture (10 badges incl. Case Hunter + systems), failed / missing sources are skipped (never 0), label shows the number (singular, real 0) or the milestone');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
