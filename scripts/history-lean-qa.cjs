// Work ▸ History rows (history-lean.js): real functions from index.html + the real module in a vm — no browser needed.
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
const ctx = { console, Date, Math, JSON, Map, Set, Array, Object, String, Number, parseFloat, parseInt, isNaN, Intl };
ctx.window = ctx; ctx.addEventListener = () => {};
ctx.document = { getElementById: id => id === 'unified-timeline' ? ctx.__box : null };
ctx.__box = { innerHTML: '' };
vm.createContext(ctx);
const run = code => vm.runInContext(code, ctx);
run(`
${thai}
const REVIEW_LINK_TYPE_ICON = { line_man: '🛍️', youtube: '▶️', other: '🔗' };
const UNIFIED_PAGE_SIZE = 10; let unifiedRenderedCount = 10, userId = 'u1';
const day = 86400000, ago = d => ({ toMillis: () => Date.now() - d * day, toDate: () => new Date(Date.now() - d * day) });
let reviewLinksCache = [{ id: 'L1', title: 'Khao Don', url: 'https://shop.example/khao', logoUrl: 'https://dl.example/khao.webp' }];
let quizzesCache = [
  { id: 'q1', title: 'Vitamin B', shortTitle: 'Vit B', coverUrl: 'https://dl.example/c.webp', quizType: 'standard', materials: [{ name: 'Slides', url: 'https://example.com/a.pdf' }, { name: 'Bad', url: 'javascript:alert(1)' }] },
  { id: 'q2', title: 'Allergen', coverUrl: 'http://insecure.example/c.webp', quizType: 'standard', materials: [{ name: 'A', url: 'https://1drv.ms/x' }, { name: 'B', url: 'https://drive.google.com/y' }] },
  { id: 'q3', title: 'Practice', quizType: 'standard' }];
let quizAttemptsCache = {
  q1: { quizId: 'q1', status: 'approved', score: 0.4, correctCount: 2, totalQuestions: 5, timestamp: ago(1) },
  q2: { quizId: 'q2', status: 'approved', score: 1.2, timestamp: ago(5) },
  q3: { quizId: 'q3', status: 'pending', score: 0, timestamp: ago(40) } };
let myLinkSuggestionsCache = [
  { id: 's1', title: 'Khao Don', status: 'approved', url: 'https://shop.example/khao', createdAt: ago(3) },
  { id: 's2', title: '<img src=x onerror=alert(1)>', status: 'rejected', url: 'javascript:alert(1)', createdAt: ago(9) }];
let unifiedSubmissionsCache = [
  { id: 'c1', submissionType: 'case', score: 0, adminBonus: 0.1, status: 'approved', timestamp: ago(2), adminComment: 'Well done <b>', metadata: { caseId: '10482', diseaseSystemKey: 'gi', customer: 'Somchai', symptoms: 'Nausea' } },
  { id: 'c2', submissionType: 'case', score: 0, adminBonus: 0, status: 'pending', timestamp: ago(8), metadata: { caseId: '10477', diseaseSystemKey: 'neuro' } },
  { id: 'c3', submissionType: 'case', score: 0, adminBonus: 0.1, status: 'approved', timestamp: ago(50), metadata: { caseId: '10311', disease: 'GI', diseaseSystemKey: 'gi' } },
  { id: 'r1', submissionType: 'reflective', score: 0, adminBonus: 0, status: 'approved', timestamp: ago(0), metadata: { mood: 'Happy', moodEmoji: '😊', content: 'Learned a lot' } },
  { id: 'w1', submissionType: 'work', title: 'Deck', score: 0, adminBonus: 0, status: 'approved', timestamp: ago(12), metadata: { link: 'https://example.com/deck' } }];
window.caseTaxonomyCatalog = [{ key: 'gi', label: 'GI' }, { key: 'neuro', label: 'Neurological' }, { key: 'other', label: 'Other' }];
window.CASE_SYSTEM_EMOJI = { gi: '🍽️', neuro: '🧠', other: '📋' };
window.activityRewards = { beriFor: id => id === 'q1_u1' ? 5 : 0 };
${names.map(fn).join('\n')}
`);
run(fs.readFileSync('public/history-lean.js', 'utf8'));

assert.equal(run('getUnifiedAllItems().length'), 10);

run('window.historyLean.render(getUnifiedAllItems().sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()))');
const out = ctx.__box.innerHTML;
const row = id => { const a = out.indexOf('data-delete-item="' + id + '"'); assert.ok(a >= 0, 'row ' + id); const b = out.indexOf('data-delete-item=', a + 10); return out.slice(a, b < 0 ? out.length : b); };

// cases: HN title, system picture with nth badge (oldest = 1), no "GI" text in the row
const c1 = row('c1'), c3 = row('c3'), c2 = row('c2');
assert.match(c1, /HN 10482/); assert.match(c1, /class="hl-nb">2</); assert.match(c3, /class="hl-nb">1</); assert.match(c2, /class="hl-nb">1</);
assert.match(c1, /🍽️/); assert.match(c1, /title="GI · case 2"/);
assert.doesNotMatch(c1.slice(0, c1.indexOf('card-detail')), /(^|>)GI(<|\s)/);
assert.match(c1, /\+0\.10<small>pt/);
assert.match(c1, /hl-facts[\s\S]*Somchai[\s\S]*Nausea/);
assert.match(c1, /Well done &lt;b&gt;/);                        // admin comment escaped
assert.match(c2, /hl-pill hl-warn">⏳ Pending/);               // pending is the only status that shows

// quizzes: cover only when https, pt + Beri colours, correct/total only in the expanded date, actions by condition
const q1 = row('q1_u1'), q2 = row('q2_u1'), q3 = row('q3_u1');
assert.match(q1, /<img class="hl-cover"[^>]*src="https:\/\/dl\.example\/c\.webp"/);
assert.doesNotMatch(q2, /hl-cover/);                            // http cover rejected → emoji disc
assert.match(q1, /class="hl-pt" title="Points">\+0\.40/); assert.match(q1, /class="hl-br" title="Beri">🪙 <b>\+5/);
assert.doesNotMatch(q2, /class="hl-br"/);
assert.match(q1, /hl-more-t"> · \d\d:\d\d · 2\/5/);
assert.match(q1, /viewQuizAnswers\('q1'\)/); assert.match(q1, /openFeedbackForPastAttempt\('q1'\)/);
assert.doesNotMatch(q3, /viewQuizAnswers/);                      // pending → no answers / feedback
// one file → a direct, logged download link (the javascript: one is dropped); several → a counted list
assert.equal((q1.match(/href="https:\/\/example\.com\/a\.pdf"/g) || []).length, 2);   // inline + expanded
assert.match(q1, /onclick="event\.stopPropagation\(\); qzLogMaterialClick\(this\)"/); assert.match(q1, /data-quiz-id="q1"/);
assert.doesNotMatch(q1, /javascript:/);
assert.match(q2, /<details class="hl-matpick"[\s\S]*<i>2<\/i>/); assert.equal((q2.match(/class="hl-matitem"/g) || []).length, 4);

// explore links: logo of the matching approved shop, no pt/Beri, ↗ only for http(s), escaped title
const s1 = row('s1'), s2 = row('s2');
assert.match(s1, /dl\.example\/khao\.webp/); assert.doesNotMatch(s1, /class="hl-val"/); assert.match(s1, /class="hl-ib hl-go" href="https:\/\/shop\.example\/khao"/);
assert.doesNotMatch(s2, /href="javascript:/); assert.doesNotMatch(s2, /<img src=x/); assert.match(s2, /hl-pill hl-bad">✕ Rejected/);

// others keep their own detail; every row stays addressable for delete requests
assert.match(row('r1'), /Learned a lot/); assert.match(row('w1'), /class="hl-ib hl-go" href="https:\/\/example\.com\/deck"/);
['c1', 'c2', 'c3', 'r1', 'w1', 'q1_u1', 'q2_u1', 'q3_u1', 's1', 's2'].forEach(id => assert.match(row(id), /data-delete-type="[a-z_]+"/));
assert.match(out, /class="hl-lbl lang-no-toggle">Today/);
assert.doesNotMatch(out, /hl-loadmore/);

// "N more" appears past one page and counts the rest
run('for (let i = 0; i < 6; i++) unifiedSubmissionsCache.push({ id: "x" + i, submissionType: "work", title: "Extra " + i, score: 0, adminBonus: 0, status: "approved", timestamp: ago(90 + i), metadata: {} }); unifiedRenderedCount = 10;');
run('window.historyLean.render(getUnifiedAllItems().sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()))');
assert.match(ctx.__box.innerHTML, /class="hl-loadmore" onclick="loadMoreUnifiedHistory\(\)">6 more</);
// V101.84: a quiz with a short title shows it; the full title is the hover text and the tapped-row text. No short title (q2) = the full title only.
run('window.historyLean.render(getUnifiedAllItems().sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()))');
assert.match(row('q1_u1'), /<div class="hl-tt" title="Vitamin B"><span class="hl-st">Vit B<\/span><span class="hl-ft">Vitamin B<\/span>/);
assert.match(row('q2_u1'), /<div class="hl-tt" title="Allergen">Allergen<\/div>/);
assert.doesNotMatch(row('q2_u1'), /hl-st|hl-ft/);
run("quizzesCache[0].shortTitle = 'Vitamin B'");   // same as the full title → no duplicate spans
run('window.historyLean.render(getUnifiedAllItems().sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()))');
assert.doesNotMatch(ctx.__box.innerHTML.split('data-delete-item="q1_u1"')[1].split('data-delete-item=')[0], /hl-st/);   // row() reads the first render, so slice the fresh one
console.log('PASS: history-lean rows — case picture + nth, quiz cover/pt/Beri, files, link logo, pending only, escaping, more, quiz short title');
