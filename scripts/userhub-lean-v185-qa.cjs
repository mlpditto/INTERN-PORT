// V102.185 — User Hub lean pass: History collapses runs of "No check-in" decay rows, Activity says what the
// colours mean (+ average line, richer tooltip), "How to read this" is an ⓘ, Radar has full-name tooltips,
// Backlog drops its zero pills when nothing is assigned, and "Google connected" is the official G.
// Runs the REAL functions from public/admin.html in a vm with stubbed globals.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

// cut a function by its marker: first `{` after the parameter list's closing `)`, then brace matching
function grab(marker) {
    const start = html.indexOf(marker);
    assert.ok(start >= 0, 'marker not found: ' + marker);
    let i = html.indexOf('(', start + marker.length - 1 > start ? start + marker.indexOf('(') : start);
    let depth = 0;
    for (; i < html.length; i++) { if (html[i] === '(') depth++; else if (html[i] === ')') { depth--; if (!depth) break; } }
    let j = html.indexOf('{', i), b = 0, k = j;
    for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
    return html.slice(start, k + 1);
}

// ---- static contract ----
assert.ok(/id="qi-how-btn"[^>]*aria-expanded="false"/.test(html) && /<p id="qi-how" hidden/.test(html), 'How to read this = ⓘ button + hidden paragraph');
assert.ok(!/<details><summary[^>]*>How to read this<\/summary>/.test(html), 'the long "How to read this" details block is gone');
assert.ok(!html.includes('aria-label="Google connected" style="font-size:0.85em;">🌐'), 'the Users row no longer shows a generic 🌐 for Google');
assert.ok(html.includes('googleGSvg(11)'), 'the Users row uses the official Google G');

// ---- Google G ----
{
    const ctx = vm.createContext({});
    vm.runInContext(grab('function googleGSvg(px)'), ctx);
    const svg = ctx.googleGSvg(11);
    assert.equal((svg.match(/<path /g) || []).length, 4, 'four official G paths');
    for (const c of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) assert.ok(svg.includes(c), 'Google colour ' + c);
}

// ---- tiny DOM stand-in ----
function el(id) {
    return { id, style: {}, _html: '', children: [], dataset: {}, parentNode: null, className: '', title: '',
        set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
        set innerText(v) { this._html = v; }, get innerText() { return this._html; },
        appendChild(c) { this.children.push(c); return c; },
        insertBefore(c) { this.children.push(c); return c; } };
}

// ---- History: 9 decay days + 1 manual → one collapsed run ----
{
    const dom = {};
    ['hub-history-list', 'hub-history-pagination', 'hub-history-summary'].forEach(i => dom[i] = el(i));
    const ctx = vm.createContext({
        document: { getElementById: i => dom[i] || null },
        window: {}, historyPage: 1,
        escapeHtml: s => String(s),
        HUB_LOG_STYLE: new Proxy({}, { get: () => ({ accent: '#000', tint: '#fff' }) }),
        console
    });
    ctx.window._fmtDate = d => String(d);
    ctx.window._hubHistoryFilter = 'all';
    const decays = Array.from({ length: 9 }, (_, i) => ({ type: 'daily_decay', text: 'No check-in on day ' + i, score: -0.1, t: new Date(2026, 9, 11 - i), source: 'checkin_logs', docId: 'd' + i }));
    const manual = { type: 'manual_adjust', text: 'Manual +0.08', score: 0.08, t: new Date(2026, 8, 11), docId: 'm1' };
    ctx.historyCache = [...decays, manual];
    vm.runInContext(grab('window.hubBucketOf = function(e)') + ';\n'
        + grab('function getHubFilteredHistory()') + '\n'
        + grab('function groupHubHistoryCategories(logs)') + '\n'
        + grab('window.renderHubHistoryPage = function()') + ';', ctx);
    ctx.window.renderHubHistoryPage();
    const out = dom['hub-history-list'].innerHTML;
    assert.equal((out.match(/class="hub-decay-run"/g) || []).length, 1, 'nine decay rows → ONE collapsed run');
    assert.ok(/9 days/.test(out), 'the run says how many days');
    assert.ok(/-0\.90/.test(out), 'the run carries the summed points');
    assert.equal((out.match(/No check-in on day/g) || []).length, 9, 'every day is still inside the run (one click away)');
    assert.ok(/Manual \+0\.08/.test(out), 'the manual row stays its own row');
    // fewer than 3 in a row stays as plain rows
    ctx.historyCache = [decays[0], decays[1], manual];
    ctx.window.renderHubHistoryPage();
    assert.ok(!/hub-decay-run/.test(dom['hub-history-list'].innerHTML.replace(/\.hub-decay-run/g, '')) || (dom['hub-history-list'].innerHTML.match(/class="hub-decay-run"/g) || []).length === 0, 'two decay rows are not collapsed');
}

// ---- Activity: legend, average line, tooltips ----
{
    const dom = {};
    ['lb-popup-chart', 'lb-popup-stats', 'lb-popup-footer'].forEach(i => dom[i] = el(i));
    dom['lb-popup-chart'].parentNode = el('parent');
    const created = [];
    const ctx = vm.createContext({
        document: { getElementById: i => dom[i] || null, createElement: () => { const e = el('new'); created.push(e); e.style = {}; return e; } },
        window: {
            _hubUserCache: { u1: { pointsMap: { '2026-09-10': 0.2, '2026-09-11': 4.11, '2026-09-12': 1.2, '2026-09-13': 0.01 }, detailsMap: { '2026-09-11': [{ type: 'quiz', amount: 1 }, { type: 'quiz', amount: 1 }, { type: 'reflective_log', amount: 1 }] }, user: { startDate: '2026-09-07', endDate: '2026-10-16' } } },
            hubBucketOf: null
        }, console
    });
    vm.runInContext(grab('window.hubBucketOf = function(e)') + ';', ctx);
    vm.runInContext(grab('function hubBarTip(dateStr, score, detailsMap)') + '\n' + grab('function renderActivityTab(userId)'), ctx);
    ctx.renderActivityTab('u1');
    const legend = created.find(e => e.id === 'lb-popup-legend');
    assert.ok(legend && /Best day/.test(legend.innerHTML) && /Lowest day/.test(legend.innerHTML) && /Other days/.test(legend.innerHTML) && /Average active day/.test(legend.innerHTML), 'legend names the colours and the average line');
    const avg = dom['lb-popup-chart'].children.find(c => /dashed #f59e0b/.test(c.style.cssText || ''));
    assert.ok(avg && /avg 1\.38/.test(avg.innerHTML), 'average active day line (5.52/4 = 1.38)');
    const best = dom['lb-popup-chart'].children.find(c => /quiz ×2/.test(c.title || ''));
    assert.ok(best && /2026-09-11 · \+4\.11 pts/.test(best.title) && /reflection ×1/.test(best.title), 'bar tooltip = date + points + what the day was made of');
    const stats = dom['lb-popup-stats'].innerHTML;
    assert.ok(/title="Lowest score on a day that had activity/.test(stats) && /Active Days ⓘ/.test(stats), 'stat labels explain themselves');
    // a single active day → no legend, no average line
    dom['lb-popup-legend'] = legend;   // the real page finds it again by id on the next render
    const ctx2 = vm.createContext({ document: ctx.document, window: ctx.window, console });
    vm.runInContext(grab('window.hubBucketOf = function(e)') + ';\n' + grab('function hubBarTip(dateStr, score, detailsMap)') + '\n' + grab('function renderActivityTab(userId)'), ctx2);
    ctx.window._hubUserCache.u2 = { pointsMap: { '2026-09-11': 0.5 }, detailsMap: {}, user: { startDate: '2026-09-07', endDate: '2026-10-16' } };
    dom['lb-popup-chart'].children.length = 0;
    ctx2.renderActivityTab('u2');
    assert.equal(legend.innerHTML, '', 'one active day → no legend');
    assert.ok(!dom['lb-popup-chart'].children.some(c => /dashed #f59e0b/.test(c.style.cssText || '')), 'one active day → no average line');
}

// ---- Radar: full name + cohort on hover ----
{
    const ctx = vm.createContext({ escapeHtml: s => String(s) });
    vm.runInContext(grab('function drawQuizSpiderChart(groups, myGroupName)'), ctx);
    const groups = ['Pharmacotherapy', 'Allergic Conjunctivitis', 'Osteoarthritis'].map((n, i) => ({ tags: [n], avg: 90 - i * 5, correct: 9, total: 10, cohortAvg: 80 }));
    const svg = ctx.drawQuizSpiderChart(groups, 'EXTERN');
    assert.ok(/<title>Allergic Conjunctivitis · 85\.0%<\/title>Allergic Conj…/.test(svg), 'the cut axis label carries the full name + %');
    assert.ok(/Cohort 80\.0%/.test(svg) && /r="11" fill="transparent"/.test(svg), 'the dot has a roomy hover target with the cohort value');
}

// ---- Backlog: nothing assigned → no zero pills ----
{
    const dom = {};
    ['hub-backlog-list', 'hub-backlog-summary', 'hub-backlog-toolbar', 'hub-backlog-search', 'hub-backlog-sort', 'hub-backlog-compact-btn'].forEach(i => dom[i] = el(i));
    const ctx = vm.createContext({
        document: { getElementById: i => dom[i] || null }, window: {},
        usersData: [{ id: 'u1' }], questsCache: [], questsSubList: [],
        isQuestAssignedToUser: () => true, getQuestLifecycleStatus: () => 'backlog', toHubDate: () => null, console
    });
    vm.runInContext(grab('function renderHubBacklog(userId)'), ctx);
    ctx.renderHubBacklog('u1');
    assert.equal(dom['hub-backlog-summary'].style.display, 'none', 'zero pills hidden when nothing is assigned');
    assert.equal(dom['hub-backlog-toolbar'].style.display, 'none', 'search/sort hidden when nothing is assigned');
    assert.ok(/Nothing assigned yet/.test(dom['hub-backlog-list'].innerHTML), 'short empty state');
    // with a quest they come back
    ctx.questsCache = [{ id: 'q1', question: 'Q', createdAt: null }];
    vm.runInContext('questsCache = [{ id: "q1", question: "Q" }];', ctx);
    try { ctx.renderHubBacklog('u1'); } catch (e) { /* card rendering needs more globals; only the toggle matters here */ }
    assert.equal(dom['hub-backlog-summary'].style.display, 'flex', 'pills are back once something is assigned');
    assert.equal(dom['hub-backlog-toolbar'].style.display, 'flex', 'toolbar is back once something is assigned');
}

console.log('PASS: User Hub lean pass — decay runs collapse (days one click away), Activity legend + average + tooltips, ⓘ how-to-read, radar hover, empty Backlog, official Google G');
