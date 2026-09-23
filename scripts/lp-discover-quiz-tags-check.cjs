// V101.11: harness for Tag promotion Discover scanning quiz tags. Extracts the
// REAL lptEditorBuildKnownTagsSet + lptEditorScanCustomTags from public/admin.html
// and runs them with a fake Firestore snapshot, lptEditorState and quizzesData.
//   node scripts/lp-discover-quiz-tags-check.cjs
const fs = require('fs');
const path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const a = admin.indexOf('        function lptEditorBuildKnownTagsSet() {');
const b = admin.indexOf('        async function lptEditorPromoteTag(idx) {', a);
if (a < 0 || b < 0) { console.error('discover functions not found'); process.exit(1); }

const els = {};
const mk = id => els[id] || (els[id] = { id, innerHTML: '' });
const lpDocs = [
    { userId: 'u1', tags: ['Cough', 'Presentation', 'Headache'] },
    { userId: 'u2', tags: ['cough', 'Negotiation'] },
    { userId: 'u3', tags: ['Ibuprofen'] }
];
const snap = { size: lpDocs.length, forEach: fn => lpDocs.forEach(d => fn({ data: () => d })) };
const quizzesData = [
    { id: 'Q1', tags: 'Headache, Ibuprofen, AI_VARIANT, ibuprofen', questions: [{ tags: 'Pediatric Dosing' }, { tags: 'Headache' }] },
    { id: 'Q2', tags: 'Ibuprofen, PharmCamp' },
    { id: 'Q3', tags: 'cough', isHistoryRevision: true }
];
const ctx = {
    document: { getElementById: mk },
    db: { collection: () => ({ limit: () => ({ get: async () => snap }) }) },
    lptEditorState: { systems: { medical: [{ key: 'respiratory', label: { en: 'Respiratory' }, tags: ['COUGH'] }], skill: [], tool: [] } },
    quizzesData,
    window: { isQuizMarkerTag: t => /^(ai_variant|ai_from_case|pharmcamp)$/i.test(String(t || '').trim()) },
    escapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    console
};
const names = Object.keys(ctx);
const api = new Function(...names, admin.slice(a, b) + '\nreturn { lptEditorScanCustomTags };')(...names.map(n => ctx[n]));

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

api.lptEditorScanCustomTags().then(() => {
    const r = ctx.window._lptDiscoverResults;
    const row = d => r.find(x => x.display.toLowerCase() === d.toLowerCase());
    check('known taxonomy tag (any case) excluded', row('cough'), undefined);
    check('marker tags excluded', r.some(x => /ai_variant|pharmcamp/i.test(x.display)), false);
    check('history revision skipped', r.every(x => !x.quizIds.has('Q3')), true);
    check('sorted by total count, then users (LP tags before quiz-only ties), then name', r.map(x => `${x.display}:${x.count}`).join('|'), 'Ibuprofen:3|Headache:2|Negotiation:1|Presentation:1|Pediatric Dosing:1');
    check('Ibuprofen: LP 1 user + 2 quizzes (Q1 counted once despite two spellings)', `${row('Ibuprofen').lp}|${row('Ibuprofen').users.size}|${row('Ibuprofen').quiz}|${[...row('Ibuprofen').quizIds].join(',')}`, '1|1|2|Q1,Q2');
    check('Headache: quiz-level + per-question on the same quiz counts once', `${row('Headache').quiz}|${[...row('Headache').quizIds].join(',')}`, '1|Q1');
    check('per-question-only tag discovered', row('Pediatric Dosing').quiz, 1);
    check('LP-only tag keeps its user count', `${row('Negotiation').lp}|${row('Negotiation').users.size}|${row('Negotiation').quiz}`, '1|1|0');
    const status = mk('lpt-discover-status').innerHTML;
    check('status names both sources', /from 3 LP entries and 2 quizzes \(3 on quizzes\)/.test(status), true);
    const rows = mk('lpt-discover-rows').innerHTML;
    check('row meta shows the breakdown', /Ibuprofen[\s\S]*?3 uses · LP 1 \(1 user\) · 2 quizzes/.test(rows), true);
    check('row meta for a quiz-only tag', /Pediatric Dosing[\s\S]*?1 use · no LP use · 1 quiz</.test(rows), true);
    check('promote buttons rendered for every row', (rows.match(/lptEditorPromoteTag\(\d+\)/g) || []).length, r.length);

    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
});
