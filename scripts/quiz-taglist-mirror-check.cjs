// V101.15 / intern V100.85: harness for the tagList array mirror. Runs the REAL
// readers from both pages, the backfill with a fake Firestore, and asserts that no
// consumer still parses quiz tags on its own.
//   node scripts/quiz-taglist-mirror-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8').replace(/\r\n/g, '\n');
const admin = read('admin.html');
const index = read('index.html');

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// --- admin reader + backfill ---
const readerSrc = admin.slice(admin.indexOf('        const splitTagCsv = s =>'), admin.indexOf('        window.isQuizMarkerTag = t =>'));
const backfillSrc = admin.slice(admin.indexOf('        window.quizTagListBackfillTodo = function () {'), admin.indexOf('        window.populateQuizSystemSelect = function (value) {'));
const writes = [];
const quizzesData = [
    { id: 'A', tags: 'Headache,  Drug   Interaction , ' },                 // CSV only → needs mirror
    { id: 'B', tags: 'Fever', tagList: ['Fever'] },                          // in sync
    { id: 'C', tags: 'Fever, Cough', tagList: ['Fever'] },                   // stale mirror
    { id: 'D', tags: '', tagList: [] },                                      // empty, in sync
    { id: 'E', tags: '' },                                                   // empty, mirror missing → writes []
    { id: 'F', tagList: ['Array', 'Only'] },                                 // array-only doc (future writer) → not touched
    { id: 'G', tags: 'Skip', isHistoryRevision: true }
];
const ctx = {
    window: {}, quizzesData,
    db: { batch: () => ({ update: (ref, data) => writes.push({ id: ref.id, data }), commit: async () => {} }), collection: () => ({ doc: id => ({ id }) }) },
    confirm: () => true, alert: m => { throw new Error('alert: ' + m); }, showToast: () => {}
};
new Function(...Object.keys(ctx), readerSrc + '\n' + backfillSrc)(...Object.values(ctx));
const w = ctx.window;

check('CSV: trim, collapse whitespace, drop empties', w.quizTagList(quizzesData[0]).join('|'), 'Headache|Drug Interaction');
check('stage 2: the array wins when present (even if the text differs)', w.quizTagList(quizzesData[2]).join('|'), 'Fever');
check('stage 2: in-sync doc reads the same either way', w.quizTagList(quizzesData[1]).join('|'), 'Fever');
check('stage 2: array entries are trimmed / whitespace-collapsed / empties dropped', w.quizTagList({ tags: 'x', tagList: [' A  B ', '', null, 'c'] }).join('|'), 'A B|c');
check('array-only doc reads tagList', w.quizTagList(quizzesData[5]).join('|'), 'Array|Only');
check('empty CSV with array → array', w.quizTagList({ tags: '', tagList: ['X'] }).join('|'), 'X');
check('no array → CSV fallback', w.quizTagList({ tags: 'Only, Text' }).join('|'), 'Only|Text');
check('null / missing → []', `${w.quizTagList(null).length}|${w.quizTagList({}).length}`, '0|0');
check('quizTagsCsv joins with ", "', w.quizTagsCsv(quizzesData[0]), 'Headache, Drug Interaction');
check('questionTagList parses per-question CSV', w.questionTagList({ tags: ' a ,b' }).join('|'), 'a|b');

check('backfill todo = missing or stale mirrors, CSV docs only (stale still detected after the flip)', w.quizTagListBackfillTodo().map(q => q.id).join(','), 'A,C,E');
w.backfillQuizTagList().then(() => {
    check('backfill writes ONLY tagList', writes.map(x => `${x.id}:${JSON.stringify(x.data)}`).join(' '), 'A:{"tagList":["Headache","Drug Interaction"]} C:{"tagList":["Fever","Cough"]} E:{"tagList":[]}');

    // --- intern reader (same semantics) ---
    const internSrc = index.slice(index.indexOf('        function quizTagList(q) {'), index.indexOf("        let qbTagFilter = '';"));
    const intern = new Function(internSrc + '\nreturn { quizTagList, quizTagsCsv };')();
    check('intern reader: array wins, CSV fallback with whitespace collapsed', intern.quizTagList(quizzesData[2]).join('|') + ' / ' + intern.quizTagList(quizzesData[0]).join('|'), 'Fever / Headache|Drug Interaction');
    check('intern reader: array-only doc', intern.quizTagsCsv(quizzesData[5]), 'Array, Only');

    // --- writers ---
    check('getQuizFormData derives tagList from the normalised CSV', /const tagList = window\.quizTagList\(\{ tags \}\);/.test(admin) && /description, tags, tagList, materials,/.test(admin), true);
    check('main save payload writes tagList', /tagList: Array\.isArray\(formData\.tagList\) \? formData\.tagList : \[\], \/\/ V101\.15/.test(admin), true);
    check('case→quiz writes tagList', /tags: '',\n\s*tagList: \[\], \/\/ V101\.15/.test(admin), true);
    check('marker migration writes the mirror', /const update = \{ tags: kept\.join\(', '\), tagList: kept \};/.test(admin), true);
    check('template / go-live spread formData (so tagList rides along)', (admin.match(/\.\.\.formData,/g) || []).length >= 2, true);

    // --- no consumer parses tags on its own any more ---
    const stray = [
        ['admin split(q.tags)', admin, /split\(q\.tags\)/g],
        ['admin q.tags.split', admin, /q\.tags\.split\(/g],
        ['admin String(q.tags', admin, /String\(q\.tags\)/g],
        ['admin String(qData.tags', admin, /String\(qData\.tags\)/g],
        ['admin String(qd.tags', admin, /String\(qd\.tags\)/g],
        ['admin push(q.tags)', admin, /push\(q\.tags\)/g],
        ['admin add(q.tags)', admin, /add\(q\.tags\)/g],
        ['admin (q.tags || "")', admin, /\(q\.tags \|\| ""\)/g],
        ['index String((q && q.tags)', index, /String\(\(q && q\.tags\) \|\| ''\)/g],
        ['index String(q.tags', index, /String\(q\.tags/g],
        ['index q.tags in hay', index, /\[q\.title, q\.shortTitle, q\.tags,/g]
    ];
    stray.forEach(([name, src, re]) => check(`no stray parser: ${name}`, (src.match(re) || []).length, 0));
    check('editor still loads through the reader', /getElementById\('quiz-tags'\)\.value = window\.quizTagsCsv\(q\);/.test(admin), true);
    check('backfill derives the array from the CSV, not from the reader', /\{ tagList: splitTagCsv\(q\.tags\) \}/.test(admin) && !/\{ tagList: window\.quizTagList\(q\) \}/.test(admin), true);
    check('backfill todo compares against the CSV', /!== JSON\.stringify\(splitTagCsv\(q\.tags\)\)/.test(admin), true);

    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
});
