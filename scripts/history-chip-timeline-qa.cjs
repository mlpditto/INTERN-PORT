// V102.342 — User Hub ▸ History = chip rail (count + sum + filter) + one timeline by day (owner pick B).
// Runs the REAL functions from public/admin.html in a vm with a tiny DOM stand-in.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

// cut `marker ... { ... }` by brace matching from the first `{` after the marker
function grab(marker) {
    const start = html.indexOf(marker);
    assert.ok(start >= 0, 'marker not found: ' + marker);
    let k = html.indexOf('{', start + marker.length - 1), b = 0;
    for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
    return html.slice(start, k + 1);
}

// ---- static contract ----
assert.ok(!html.includes('class="hub-log-category"') && !html.includes('.hub-log-category'), 'category accordions are gone');
assert.ok(html.includes('id="hub-history-rail"'), 'chip rail container');
assert.ok(!html.includes('id="hub-filter-all"'), 'the lone All button row is gone (the rail chip toggles back, ✕ clears)');
assert.ok(/id="hub-log-overview"/.test(html) && /getElementById\('hub-log-overview'\)/.test(html), 'Overview opens from the header row');
assert.ok(/class="hub-log-tools"[\s\S]{0,900}openHubUploadDocuments\(\)/.test(html), '📎 Upload file lives under ⋯ Tools');

// ---- tiny DOM stand-in ----
function el(id) {
    return { id, style: {}, _html: '', children: [],
        set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
        set innerText(v) { this._html = v; }, get innerText() { return this._html; },
        appendChild(c) { this.children.push(c); return c; } };
}
const dom = {};
['hub-history-list', 'hub-history-pagination', 'hub-history-summary', 'hub-history-rail'].forEach(i => dom[i] = el(i));
const ctx = vm.createContext({
    document: { getElementById: i => dom[i] || null, createElement: () => el('btn') },
    window: { _currentPopupUser: 'bew', _wpWordCount: s => String(s).trim().split(/\s+/).length },
    usersData: [{ id: 'bew', score: 2.15 }],
    historyPage: 1, console
});
vm.runInContext('var historyCache = [];\n'
    + grab('const HUB_LOG_STYLE = {') + ';\nthis.HUB_LOG_STYLE = HUB_LOG_STYLE;\n'
    + grab('window.hubBucketOf = function(e)') + ';\n'
    + grab('function getHubFilteredHistory()') + '\n'
    + grab('function groupHubHistoryCategories(logs)') + '\n'
    + grab('window.renderHubHistoryPage = function()') + ';\n'
    + 'this.setCache = c => { historyCache = c; };', ctx);

const VmDate = vm.runInContext("Date", ctx);   // instanceof Date must hold inside the vm
const now = Date.now(), H = 3600e3, D = 86400e3, t = ms => new VmDate(now - ms);
// Shaped like Bew's 15 logs on 2026-10-20 (sample, not real data)
const logs = [
    { t: t(3 * H - 60e3), type: 'beri', beriAmount: 5, text: '⏱️ Beat deadline (48h+) · PRETEST-1.3' },
    { t: t(3 * H), type: 'quiz', score: 1.5, source: 'checkin_logs', docId: 'q3', text: 'Quiz Approved (Actual): 15/15 - PRETEST-1.3' },
    { t: t(10 * H), type: 'daily_checkin', score: 0.01, source: 'checkin_logs', docId: 'c5', text: '📍 Daily check-in' },
    { t: t(D + 2 * H), type: 'reflective_log', isReflective: true, score: 0.3, source: 'checkin_logs', docId: 'r2', mood: '😊', text: '📓 Daily Reflection', fullContent: 'paracetamol <dose> by weight' },
    { t: t(D + 9 * H), type: 'daily_checkin', score: 0.01, source: 'checkin_logs', docId: 'c4', text: '📍 Daily check-in' },
    { t: t(2 * D + 9 * H), type: 'daily_checkin', score: 0.01, source: 'checkin_logs', docId: 'c3', text: '📍 Daily check-in' },
    { t: t(2 * D + 11 * H), type: 'manual_adjust', score: -0.5, source: 'checkin_logs', docId: 'm2', text: 'Late homework' },
    { t: t(3 * D + 9 * H), type: 'daily_checkin', score: 0.01, source: 'checkin_logs', docId: 'c2', text: '📍 Daily check-in' },
    { t: t(4 * D - 60e3), type: 'beri', beriAmount: 5, text: '⏱️ Beat deadline (48h+) · PRETEST-1.2' },
    { t: t(4 * D), type: 'quiz', score: 0.5, source: 'checkin_logs', docId: 'q2', text: 'Quiz Approved (Actual): 5/10 - PRETEST-1.2' },
    { t: t(4 * D + 5 * H), type: 'reflective_log', isReflective: true, score: 0.3, source: 'checkin_logs', docId: 'r1', mood: '🙂', text: '📓 Daily Reflection', fullContent: 'First week' },
    { t: t(4 * D + 9 * H), type: 'daily_checkin', score: 0.01, source: 'checkin_logs', docId: 'c1', text: '📍 Daily check-in' },
    { t: t(5 * D), type: 'quiz', score: 0.9, source: 'checkin_logs', docId: 'q1', text: 'Quiz Approved (Actual): 9/10 - PRETEST-1.1' },
    { t: t(5 * D + 3 * H), type: 'manual_adjust', score: -0.5, source: 'checkin_logs', docId: 'm1', text: 'Missed orientation task' },
    { t: t(5 * D + 6 * H), type: 'doc', preUserId: 'pre1', docId: 'd1', text: '📎 Document received · CV.pdf' },
];
ctx.setCache(logs);
const render = mode => { ctx.window._hubHistoryFilter = mode; ctx.window.renderHubHistoryPage(); };
const rows = () => (dom['hub-history-list'].innerHTML.match(/class="hub-tl-row"/g) || []).length;

// ---- All ----
render('all');
const rail = dom['hub-history-rail'].innerHTML, list = dom['hub-history-list'].innerHTML, sum = dom['hub-history-summary'].innerHTML;
const chipNames = [...rail.matchAll(/<i><\/i>([^<]+?) <small>/g)].map(m => m[1]);
assert.deepEqual(chipNames, ['Quizzes', 'Check-ins', 'Reflections', 'Adjustments', 'Coins', 'Files'], 'chips: score groups by recency, then Coins, then Files');
assert.ok(/Quizzes <small>3<\/small> <b class="">\+2\.90<\/b>/.test(rail), 'Quizzes chip = count + sum');
assert.ok(/Adjustments <small>2<\/small> <b class="neg">-1\.00<\/b>/.test(rail), 'negative sum in red');
assert.ok(/Coins <small>2<\/small> <b class="coin">🪙 \+10<\/b>/.test(rail), 'Coins chip in coins, not pts');
assert.ok(/Files <small>1<\/small> <\/button>/.test(rail), 'Files chip has no amount');
assert.ok(!/class="hub-tl-chip on"/.test(rail), 'no chip is on under All');
assert.ok(/15 logs/.test(sum) && /hub-tl-sum off/.test(sum) && /Σ 2\.55 pts ≠ Now 2\.15/.test(sum), 'Σ of score rows vs the header score, amber when they differ');
assert.ok(!/hub-tl-clear/.test(sum), 'no ✕ under All');
assert.equal(rows(), 10, '15 logs − 5 check-ins folded into their day lines = 10 rows');
assert.equal((list.match(/class="hub-tl-ci"/g) || []).length, 5, 'one 📍 pill per check-in day');
assert.ok(!/Daily check-in<\/span>/.test(list), 'no check-in rows under All');
assert.ok(/<span>Today<\/span>/.test(list) && /<span>Yesterday<\/span>/.test(list), 'day lines say Today / Yesterday');
assert.ok(list.includes('📝 PRETEST-1.3 · 15/15') && !list.includes('Quiz Approved'), 'quiz row = title · score, no "Quiz Approved (Actual):"');
assert.ok(list.includes('✎ Late homework'), 'icon leads when the text has none');
assert.ok(list.includes('paracetamol &lt;dose&gt; by weight') && list.includes(' 😊 '), 'reflection preview inline, escaped, with mood');
assert.ok(/🪙 \+5<\/b>/.test(list) && /—<\/span><\/b>/.test(list), 'coin rows in coins, file row has no score');
assert.ok(/onclick="event\.stopPropagation\(\); deleteHubHistoryLog\('q3', 1\.5\)"/.test(list), '🗑 does not also open the quiz behind it');
assert.ok(list.indexOf('PRETEST-1.3 · 15/15') < list.indexOf('PRETEST-1.1 · 9/10'), 'newest first');

// ---- header score agrees → green ✓ ----
ctx.usersData[0].score = 2.55; render('all');
assert.ok(/hub-tl-sum ok/.test(dom['hub-history-summary'].innerHTML) && /2\.55 pts ✓/.test(dom['hub-history-summary'].innerHTML), 'green ✓ when Σ = Now');
ctx.usersData[0].score = 2.15;

// ---- filter = Quizzes ----
render('quizzes');
assert.equal(rows(), 3, 'three quiz rows');
assert.ok(/class="hub-tl-chip on"[^>]*onclick="setHubHistoryFilter\('all'\)"><i><\/i>Quizzes/.test(dom['hub-history-rail'].innerHTML), 'the chosen chip is on and tapping it again = All');
assert.ok(/Quizzes 3\/15 ✕/.test(dom['hub-history-summary'].innerHTML), '✕ chip shows n/total and clears');
assert.equal((dom['hub-history-rail'].innerHTML.match(/class="hub-tl-chip"/g) || []).length, 5, 'other chips stay visible with their All sums');

// ---- filter = Check-ins: rows again, so they can be deleted ----
render('checkin');
assert.equal(rows(), 5, 'check-ins are rows when filtered');
assert.equal((dom['hub-history-list'].innerHTML.match(/class="hub-tl-ci"/g) || []).length, 0, 'no folded pills when filtered');

// ---- empty ----
ctx.setCache([]); render('all');
assert.ok(/No activity yet\./.test(dom['hub-history-list'].innerHTML) && dom['hub-history-rail'].innerHTML === '', 'empty user: one line, no chips');

console.log('PASS: History chip rail (count + sum + filter), Σ vs Now, one timeline by day, check-ins folded, one-line rows');
