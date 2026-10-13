// V102.208 — Quiz Engine: the Active / Pause / Templates chips became LIVE / PAUSED / TEMPLATES filter pills with counts, and the header row is gone.
// Static: no chips, no header row, Translate Missing sits in the toolbar grid, pills are in order. Real quizStatusOf + quizMatchesFilter run in a vm.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

assert.ok(!/stat-(active|inactive|template)-count/.test(html), 'the old status chips and their counters are gone');
assert.ok(!html.includes('Jump to Inactive / Templates'), 'no scroll-to chips left');
const gridAt = html.indexOf('display:flex; gap:8px; align-items:center; margin-bottom:10px;');
const searchAt = html.indexOf('id="quiz-search-global"');
const translateAt = html.indexOf('id="btn-translate-all-missing"');
const pillsAt = html.indexOf('id="quiz-filter-pills"');
assert.ok(gridAt > 0 && gridAt < searchAt && searchAt < html.indexOf('id="qcov-pill"') && html.indexOf('id="qcov-pill"') < html.indexOf('id="quiz-sort-btn"') && html.indexOf('id="quiz-sort-btn"') < translateAt && translateAt < pillsAt, 'toolbar row (V102.229): search, 🩺 Coverage pill, sort, then the 🌐 Translate Missing icon, above the pills');
const order = ['all', 'live', 'paused', 'template', 'graded', 'onetime'].map(f => html.indexOf(`data-filter="${f}" onclick="setQuizFilter('${f}')"`));
assert.ok(order.every((n, i) => n > pillsAt && (!i || n > order[i - 1])), 'pills in order: All, LIVE, PAUSED, TEMPLATES, GRADED, ONE-TIME: ' + order);

function grabFn(marker, open = '{') {
    const start = html.indexOf(marker);
    assert.ok(start >= 0, 'marker not found: ' + marker);
    let k = html.indexOf(open, start), b = 0;
    for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
    return html.slice(start, k + 1) + (marker.startsWith('window.') ? ';' : '');
}
const ctx = vm.createContext({ window: { currentQuizFilter: 'all' }, getSafeDate: t => t || null });
ctx.window.quizNeedsAudit = () => false;
ctx.window.quizTagCompleteness = () => ({ complete: true });
vm.runInContext(grabFn('window.quizStatusOf = function'), ctx);
vm.runInContext(grabFn('function quizMatchesFilter(q)'), ctx);

const future = new Date(Date.now() + 86400000), past = new Date(Date.now() - 86400000);
const quizzes = {
    live: { isActive: true },
    liveDeadlineAhead: { isActive: true, deadline: future },
    pausedOff: { isActive: false },
    pausedExpired: { isActive: true, deadline: past },
    template: { isTemplate: true, isActive: true },
    templateOff: { isTemplate: true, isActive: false },
};
const status = k => ctx.window.quizStatusOf(quizzes[k]);
assert.equal(status('live'), 'live');
assert.equal(status('liveDeadlineAhead'), 'live');
assert.equal(status('pausedOff'), 'paused');
assert.equal(status('pausedExpired'), 'paused', 'past its deadline = paused');
assert.equal(status('template'), 'template', 'a template is a template even when active — the three groups never overlap');
assert.equal(status('templateOff'), 'template');
const pick = f => { ctx.window.currentQuizFilter = f; return Object.keys(quizzes).filter(k => ctx.quizMatchesFilter(quizzes[k])); };
assert.deepEqual(pick('live'), ['live', 'liveDeadlineAhead']);
assert.deepEqual(pick('paused'), ['pausedOff', 'pausedExpired']);
assert.deepEqual(pick('template'), ['template', 'templateOff']);
assert.equal(pick('all').length, 6);
console.log('PASS: quiz status pills — chips gone, Translate Missing in the toolbar, LIVE / PAUSED / TEMPLATES partition every quiz and filter without overlap');
