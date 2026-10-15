// V100.84: harness for the intern Browse tag chips. Extracts the REAL
// qbTagIndex / qbTagRailHtml / qbSetTagFilter / qbRenderList / qbRowHtml from
// public/index.html and drives them with a DOM stub.
//   node scripts/quiz-browse-tags-check.cjs
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
function slice(startMarker, endMarker) {
    const a = html.indexOf(startMarker);
    const b = html.indexOf(endMarker, a);
    if (a < 0 || b < 0) { console.error(`marker not found: ${startMarker}`); process.exit(1); }
    return html.slice(a, b);
}
const listSrc = slice('        function quizTagList(q) {', "        // V95.97: a material's display name."); // V100.85: starts at the shared reader
const rowSrc = slice('        function qbCategoryColor(q) {', '        async function qbRequestQuiz(quizId) {');

const els = {};
const mk = id => els[id] || (els[id] = { id, innerHTML: '', value: '' });
const quizzesCache = [
    { id: 'A', title: 'Alpha', isActive: true, tags: 'Headache, Pharmacotherapy, Ibuprofen, Migraine, Fever' },
    { id: 'B', title: 'Beta', isActive: true, tags: 'headache, AI_VARIANT' },
    { id: 'C', title: 'Gamma', isActive: true, tags: 'Fever, PharmCamp' },
    { id: 'D', title: 'Poll', isActive: true, isPoll: true, tags: 'Headache' },
    { id: 'E', title: 'Off', isActive: false, tags: 'Headache' },
    { id: 'P1', title: 'PRETEST-1.1', isActive: false, isTemplate: true, questions: [{ q: 'x' }], tags: 'Pretest' },
    { id: 'P2', title: 'PRETEST-2', isActive: false, questions: [{ q: 'y' }] },
    { id: 'P4', title: 'Alpha (old draft)', isActive: false, questions: [{ q: 'w' }] },
    { id: 'P3', title: 'PRETEST-locked', isActive: false, questions: [{ q: 'z' }], unlockScore: 999 },
    { id: '--divisions-config--', title: 'PRETEST config', isActive: false, questions: [{ q: 'c' }] }
];
const ctx = {
    document: { getElementById: mk },
    quizzesCache, quizAttemptsCache: {}, myScore: 100, _qbTakerCounts: {},
    qbIsAvailableToMe: q => q.id !== 'NA',
    QuizCover: { adminThumbnail: () => '' },
    escapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
};
const names = Object.keys(ctx);
const api = new Function(...names, listSrc + '\n' + rowSrc + '\nreturn { qbRenderList, qbSetTagFilter, qbRowHtml, get filter() { return qbTagFilter; } };')(...names.map(n => ctx[n]));

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);
const chips = htmlStr => [...htmlStr.matchAll(/<span class="qb-tag([^"]*)"[^>]*data-key="([^"]*)"[^>]*>([^<]*)(?:<small>(\d+)<\/small>)?/g)].map(m => ({ active: /active/.test(m[1]), key: m[2], label: m[3].trim(), count: m[4] || '' }));
const rowTitles = () => [...mk('qb-list').innerHTML.matchAll(/text-overflow:ellipsis;" title="[^"]*">([^<]*)<\/div>/g)].map(m => m[1]);

api.qbRenderList();
let rail = chips(mk('qb-tag-rail').innerHTML);
check('rail: All first, then tags by count, ties alphabetical', rail.map(c => `${c.label}${c.count ? ':' + c.count : ''}`).join('|'), 'All|Fever:2|Headache:2|Ibuprofen:1|Migraine:1|Pharmacotherapy:1');
check('rail: markers never shown', rail.some(c => /ai_variant|pharmcamp/i.test(c.key)), false);
check('rail: polls and inactive quizzes not counted', rail.find(c => c.key === 'headache').count, '2');
check('rail: All active when no filter', rail[0].active, true);
check('list: all 3 visible quizzes', rowTitles().join(','), 'Alpha,Beta,Gamma');

api.qbSetTagFilter('headache');
check('filter: only quizzes with that exact tag (case-insensitive)', rowTitles().join(','), 'Alpha,Beta');
rail = chips(mk('qb-tag-rail').innerHTML);
check('filter: chip marked active, All not', `${rail.find(c => c.key === 'headache').active}|${rail[0].active}`, 'true|false');
check('filter: rail counts unchanged while filtering', rail.find(c => c.key === 'fever').count, '2');

mk('qb-search').value = 'pharm';
api.qbRenderList();
check('filter AND search', rowTitles().join(','), 'Alpha');
mk('qb-search').value = 'zzz';
api.qbRenderList();
check('empty state mentions no match', /No quizzes match your search/.test(mk('qb-list').innerHTML), true);
mk('qb-search').value = '';

api.qbSetTagFilter('headache');
check('tap the active chip again → cleared', api.filter, '');
check('cleared → all rows back', rowTitles().join(','), 'Alpha,Beta,Gamma');

api.qbSetTagFilter('');
mk('qb-search').value = 'pre';
api.qbRenderList();
check('search reaches paused quizzes (title match, open ones first)', rowTitles().join(','), 'PRETEST-1.1,PRETEST-2');
check('paused: no Request button, "Not open yet" badge', (mk('qb-list').innerHTML.match(/Not open yet/g) || []).length === 2 && !/qbRequestQuiz\('P/.test(mk('qb-list').innerHTML), true);
check('score-locked + config docs stay hidden', /PRETEST-locked|PRETEST config/.test(mk('qb-list').innerHTML), false);
mk('qb-search').value = 'alpha';
api.qbRenderList();
check('open quizzes sort before paused ones', rowTitles().join(','), 'Alpha,Alpha (old draft)');
mk('qb-search').value = '';
api.qbRenderList();
check('no search → paused quizzes are NOT listed', rowTitles().join(','), 'Alpha,Beta,Gamma');

const rowA = api.qbRowHtml(quizzesCache[0]);
const pillsA = chips(rowA);
check('row pills: first 3 tags as #pills', pillsA.map(c => c.label).join('|'), '#Headache|#Pharmacotherapy|#Ibuprofen');
check('row pills: +N for the rest', /class="qb-tag" style="cursor:default; border-style:dashed;">\+2</.test(rowA), true);
check('row pills: tags no longer in the meta text', /Headache, Pharmacotherapy/.test(rowA), false);
const startA = api.qbRowHtml(quizzesCache[0]);
check('V101.157: an open quiz found in Browse is a round ▶ Start (no request)', /onclick="qbCloseBrowse\(\);confirmRunQuiz\(&quot;A&quot;\)"/.test(startA) && />▶<\/button>/.test(startA) && /Start this quiz now — no request needed/.test(startA), true);
check('V101.157: no "Ready — in Mission" label any more', /Ready — in Mission/.test(startA), false);
check('V101.157: the Start button is finger-sized', /width:44px; min-width:44px; height:44px/.test(startA), true);
check('V101.157: a quiz not open to me (other group / not started) still offers Request', /qbRequestQuiz\('NA'\)/.test(api.qbRowHtml({ id: 'NA', title: 'Closed', isActive: true })) && !/confirmRunQuiz/.test(api.qbRowHtml({ id: 'NA', title: 'Closed', isActive: true })), true);
check('V101.157: a paused quiz has no Start and no Request', /Not open yet/.test(api.qbRowHtml({ id: 'P9', title: 'Paused', isActive: false })) && !/confirmRunQuiz|qbRequestQuiz/.test(api.qbRowHtml({ id: 'P9', title: 'Paused', isActive: false })), true);
const rowC = api.qbRowHtml(quizzesCache[2]);
check('row pills: marker tag hidden', chips(rowC).map(c => c.label).join('|'), '#Fever');
check('row pills: click stops row propagation', /event\.stopPropagation\(\); qbSetTagFilter\(this\.dataset\.key\)/.test(rowA), true);

check('open Browse clears the tag filter', /if \(s\) s\.value = '';\n\s*qbTagFilter = ''; \/\/ V100\.84/.test(html), true);
check('Browse modal is lang-no-toggle (Thai tags survive)', /<div id="quizBrowseModal" class="modal lang-no-toggle">/.test(html), true);

let fail = 0;
checks.forEach(([name, got, want]) => {
    const ok = String(got) === String(want);
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
});
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
