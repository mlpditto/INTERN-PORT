// V101.215 — History: a mentor bonus on a Journal row waits as a 🎁 pill (tap = claim in place) and is NOT in the pt until claimed.
// Real functions from index.html + the real history-lean.js in a vm (same harness as history-lean-qa.cjs).
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const fn = marker => {
    const a = html.indexOf(marker);
    assert.ok(a >= 0, 'missing ' + marker);
    let i = html.indexOf('{', a), d = 0;
    for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) break; } }
    return html.slice(a, i + 1);
};
const thai = html.match(/const THAI_MONTHS_SHORT = \[[^\]]*\];/)[0];
const names = ['function escapeUnifiedHtml(s)', 'function escapeHtml(s)', 'function explLogoHtml(link, size)', 'function looksLikeOpaqueMaterialName(s)', 'function materialDisplayName(m, i)', 'function materialKind(url)',
    'function formatQuizCount(n)', 'function formatThaiDate(dateObj, opts)', 'function isRecentlyReviewed(sub)', 'function groupByDateBucket(items)', 'function renderTypeDetailHtml(sub)',
    'function renderReflectiveDetailHtml(sub, m)', 'function renderQuestDetailHtml(sub, m)', 'function renderGenericDetailHtml(sub, m)', 'function mapQuizAttemptsToUnified()',
    'function mapLinkSuggestionsToUnified()', 'function getUnifiedAllItems()', 'function computeAttemptScore(attempt, totalPoints)'];
const ctx = { console, Date, Math, JSON, Map, Set, Array, Object, String, Number, parseFloat, parseInt, isNaN, Intl, URL };
ctx.__ls = {}; ctx.localStorage = { getItem: k => (k in ctx.__ls ? ctx.__ls[k] : null), setItem: (k, v) => { ctx.__ls[k] = String(v); }, removeItem: k => { delete ctx.__ls[k]; } };
ctx.window = ctx; ctx.__listeners = {}; ctx.addEventListener = (n, f) => { (ctx.__listeners[n] = ctx.__listeners[n] || []).push(f); };
ctx.__box = { innerHTML: '' };
ctx.document = { getElementById: id => id === 'unified-timeline' ? ctx.__box : null };
vm.createContext(ctx);
const run = code => vm.runInContext(code, ctx);
run(`
${thai}
const REVIEW_LINK_TYPE_ICON = { line_man: '🛍️', youtube: '▶️', other: '🔗' };
const UNIFIED_PAGE_SIZE = 10; let unifiedRenderedCount = 10, userId = 'u1';
const day = 86400000, ago = d => ({ toMillis: () => Date.now() - d * day, toDate: () => new Date(Date.now() - d * day) });
let reviewLinksCache = []; let quizzesCache = []; let quizAttemptsCache = {}; let myLinkSuggestionsCache = [];
let unifiedSubmissionsCache = [
  { id: 'w', submissionType: 'reflective', score: 0, adminBonus: 0.2, status: 'approved', timestamp: ago(0), adminComment: 'Nice', metadata: { moodEmoji: '😊', content: 'a', sourceId: 'LW' } },
  { id: 'k', submissionType: 'reflective', score: 0, adminBonus: 0.1, status: 'approved', timestamp: ago(1), adminComment: 'Good', metadata: { moodEmoji: '😐', content: 'b', sourceId: 'LK' } },
  { id: 'n', submissionType: 'reflective', score: 0, adminBonus: 0, status: 'approved', timestamp: ago(2), metadata: { moodEmoji: '😊', content: 'c', sourceId: 'LN' } },
  { id: 'x', submissionType: 'reflective', score: 0, adminBonus: 0.3, status: 'approved', timestamp: ago(3), adminComment: 'Hm', metadata: { moodEmoji: '😊', content: 'd' } },
  { id: 'c1', submissionType: 'case', score: 0, adminBonus: 0.1, status: 'approved', timestamp: ago(4), metadata: { caseId: '1', diseaseSystemKey: 'gi' } }];
window.myReflectiveLogsCache = [
  { id: 'LW', adminBonus: 0.2, adminComment: 'Nice', pointsClaimed: false },
  { id: 'LK', adminBonus: 0.1, adminComment: 'Good', pointsClaimed: true },
  { id: 'LN', adminBonus: 0, pointsClaimed: false }];
window.caseTaxonomyCatalog = [{ key: 'gi', label: 'GI' }]; window.CASE_SYSTEM_EMOJI = { gi: '🍽️' };
window.activityRewards = { beriFor: () => 0 };
${names.map(fn).join('\n')}
`);
run(fs.readFileSync('public/history-lean.js', 'utf8'));
run('window.historyLean.render(getUnifiedAllItems().sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()))');
const out = ctx.__box.innerHTML;
const row = id => { const a = out.indexOf('data-delete-item="' + id + '"'); assert.ok(a >= 0, 'row ' + id); const b = out.indexOf('data-delete-item=', a + 10); return out.slice(a, b < 0 ? out.length : b); };

const w = row('w');
assert.ok(/class="hl-claim"/.test(w) && /claimReflectivePoints\('LW'\)/.test(w) && />🎁 \+0\.20</.test(w), 'a waiting bonus is a 🎁 pill that claims the Journal log id');
assert.ok(/event\.stopPropagation\(\)/.test(w), 'tapping the pill does not also open the row');
assert.ok(!/class="hl-pt"/.test(w), 'a waiting bonus is not counted in the row pt');
const k = row('k');
assert.ok(!/hl-claim/.test(k) && /class="hl-pt"[^>]*>\+0\.10/.test(k), 'a claimed bonus is plain +pt, no pill');
assert.ok(!/hl-claim/.test(row('n')), 'no bonus → no pill');
assert.ok(!/hl-claim/.test(row('x')) && /class="hl-pt"[^>]*>\+0\.30/.test(row('x')), 'a row whose Journal log is not loaded keeps today\'s behaviour (counts, no pill)');
assert.ok(!/hl-claim/.test(row('c1')) && /\+0\.10/.test(row('c1')), 'cases are untouched');
assert.ok((ctx.__listeners['reflective-logs-updated'] || []).length === 1, 'History repaints when the Journal logs change');

console.log('PASS: History 🎁 claim pill — waiting bonus = pill + claim handler + not in pt; claimed / none / unloaded / cases unchanged; repaints on logs-updated');
