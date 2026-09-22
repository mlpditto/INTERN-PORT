// V101.07: harness for the quiz-tag normaliser + autocomplete. Extracts the real
// code VERBATIM from public/admin.html (computeQuizTagHygiene, the V101.07 helpers,
// manualAddTag / removeTagChip / refreshTagChips / editTagChip / autoTagQuizAI) and
// drives it with a DOM stub.
//   node scripts/quiz-tag-normalize-check.cjs
const fs = require('fs');
const path = require('path');

// Git checks admin.html out with CRLF on Windows (autocrlf); the markers below are LF.
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function slice(startMarker, endMarker) {
    const a = html.indexOf(startMarker);
    const b = html.indexOf(endMarker, a);
    if (a < 0 || b < 0) { console.error(`marker not found: ${startMarker} … ${endMarker}`); process.exit(1); }
    return html.slice(a, b);
}
const hygieneSrc = slice('window.computeQuizTagHygiene = function', '\n        };\n') + '\n        };';
const editorSrc = slice('        const QUIZ_TAG_MAX = 20;', '        window.regenerateSingleAiSuggestion = async function');

const els = {};
const mk = id => els[id] || (els[id] = { id, innerHTML: '', value: '', dataset: {}, disabled: false });
const document = { getElementById: mk };
const window = {};
const toasts = [];
const alerts = [];
const quizzesData = [
    { id: 'A', tags: 'Headache, Pharmacotherapy' },
    { id: 'B', tags: 'Headache, Drug Interaction' },
    { id: 'C', tags: 'headache, AI_VARIANT' }
];
window.CASE_SYSTEMS = [{ key: 'neuro', label: { en: 'Neurological' }, symptoms: ['Headache', 'Dizziness'] }];
window.LP_ALL_TAGS = ['cough', 'headache'];
let promptAnswer = null;
const ctx = {
    window, document, quizzesData,
    escapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    showToast: m => toasts.push(m),
    alert: m => alerts.push(m),
    prompt: () => promptAnswer,
    confirm: () => { throw new Error('confirm() must not be called any more'); },
    getQuizFormData: () => ({ title: 'T', questions: [{ q: 'q1' }] }),
    triggerAutoSave: () => {}
};
// refreshTagChips / editTagChip are called bare inside the block; expose after load.
const names = Object.keys(ctx);
new Function(...names, hygieneSrc + '\n' + editorSrc + '\nrefreshTagChips = window.refreshTagChips; editTagChip = window.editTagChip;')(...names.map(n => ctx[n]));

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// normaliser
check('trim/collapse/dedupe/canonical casing', window.normalizeQuizTagString(' headache ,HEADACHE, Drug   Interaction,, ,pharmacotherapy'), 'Headache, Drug Interaction, Pharmacotherapy');
check('unknown tag keeps typed casing', window.normalizeQuizTagString('Vaginal Candidiasis'), 'Vaginal Candidiasis');
check('cap at 20', window.normalizeQuizTagList(Array.from({ length: 25 }, (_, i) => `t${i}`)).length, 20);
check('empty → empty', window.normalizeQuizTagString(''), '');

// manualAddTag: comma paste + case-insensitive merge
mk('quiz-tags').value = 'Headache';
window.manualAddTag('fever, HEADACHE , Fever');
check('manualAddTag merges a paste', mk('quiz-tags').value, 'Headache, fever');
window.manualAddTag('FEVER');
check('manualAddTag rejects a case variant', mk('quiz-tags').value, 'Headache, fever');
check('…and says so', toasts[toasts.length - 1], 'Tag already present');
check('chips rendered', (mk('quiz-tag-chips-container').innerHTML.match(/fa-circle-xmark/g) || []).length, 2);

// autocomplete: existing tags first (canonical, by count), then systems/symptoms, then LP; current tags excluded
const opts = [...mk('quiz-tag-suggestions').innerHTML.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(m => [m[1], m[2]]);
check('suggestions exclude tags already on the quiz', opts.some(o => o[0].toLowerCase() === 'headache' || o[0].toLowerCase() === 'fever'), false);
check('suggestions start with existing tags (ties alphabetical)', opts[0].join('|'), 'Drug Interaction|1 quiz');
check('machine markers are never suggested', opts.some(o => /^ai_/i.test(o[0])), false);
check('suggestions include system label + symptom + LP tag', ['Neurological', 'Dizziness', 'cough'].every(v => opts.some(o => o[0] === v)), true);

// editTagChip: edited value is normalised to the canonical spelling
promptAnswer = ' DRUG INTERACTION ';
window.editTagChip(1);
check('editTagChip canonicalises', mk('quiz-tags').value, 'Headache, Drug Interaction');

// autoTagQuizAI: merges instead of replacing, never calls confirm()
window.callUniversalAI = async () => ({ text: 'Tags: Migraine, headache\nDrug interaction, Pediatric Dosing' });
const btn = { innerHTML: 'AI Suggest', disabled: false };
window.autoTagQuizAI(btn).then(() => {
    check('AI Suggest merges + de-dupes', mk('quiz-tags').value, 'Headache, Drug Interaction, Migraine, Pediatric Dosing');
    check('AI Suggest toast counts new tags', toasts[toasts.length - 1], '✅ AI added 2 new tag(s)');
    check('button restored', `${btn.disabled}|${btn.innerHTML}`, 'false|AI Suggest');
    check('no alerts', alerts.length, 0);

    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
});
