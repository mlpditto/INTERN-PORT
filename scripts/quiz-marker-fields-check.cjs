// V101.10: harness for "markers out of tags". Extracts the REAL helpers from
// public/admin.html (quizLegacyMarkers / quizCampaign / stripQuizMarkerTags /
// populateQuizCampaignChips / migrateQuizMarkerTags / quizSystemFieldsFromEditor
// and pharmCampDateRange) and drives them with DOM + Firestore stubs.
//   node scripts/quiz-marker-fields-check.cjs
const fs = require('fs');
const path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
function slice(startMarker, endMarker) {
    const a = admin.indexOf(startMarker);
    const b = admin.indexOf(endMarker, a);
    if (a < 0 || b < 0) { console.error(`marker not found: ${startMarker}`); process.exit(1); }
    return admin.slice(a, b);
}
const helpers = slice('        window.quizTagList = q =>', '        const QUIZ_TAG_MAX = 20;');
const dateRange = slice('        function pharmCampDateRange() {', '\n        }\n') + '\n        }\n';

const DELETE = { sentinel: 'FieldValue.delete()' };
const els = {};
const mk = id => els[id] || (els[id] = { id, innerHTML: '', _value: '', dataset: {}, get value() { return this._value; }, set value(v) { this._value = v; } });
const writes = [];
const db = { batch: () => ({ update: (ref, data) => writes.push({ id: ref.id, data }), commit: async () => {} }), collection: () => ({ doc: id => ({ id }) }) };
const toDate = d => ({ toDate: () => new Date(d) });
const quizzesData = [
    { id: 'A', tags: 'Headache, AI_FROM_CASE', startTime: toDate('2026-03-03') },
    { id: 'B', tags: 'pharmcamp, Fever', startTime: toDate('2026-03-01') },
    { id: 'C', campaign: 'PharmCamp', tags: 'Cough', startTime: toDate('2026-03-05') },
    { id: 'D', tags: 'PharmCampX, Old', startTime: toDate('2020-01-01') },
    { id: 'E', tags: 'AI_VARIANT', source: 'manual', isHistoryRevision: true },
    { id: 'F', campaign: 'Camp2', tags: 'PharmCamp' }
];
const toasts = [];
const ctx = {
    window: { CASE_SYSTEMS: [] }, document: { getElementById: mk }, quizzesData, db,
    escapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    firebase: { firestore: { FieldValue: { delete: () => DELETE } } },
    confirm: () => true, prompt: () => ' Winter  Camp ', alert: m => { throw new Error('alert: ' + m); },
    showToast: m => toasts.push(m), refreshTagChips: () => {}
};
const names = Object.keys(ctx);
new Function(...names, helpers + '\n' + dateRange + '\nwindow.pharmCampDateRange = pharmCampDateRange;')(...names.map(n => ctx[n]));
const w = ctx.window;

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);
const j = v => JSON.stringify(v, (k, x) => x === DELETE ? '<DELETE>' : x);

// legacy detection
check('legacy: AI_FROM_CASE → source', j(w.quizLegacyMarkers(quizzesData[0])), '{"source":"ai_from_case","campaign":"","found":true}');
check('legacy: pharmcamp (any case) → campaign', w.quizLegacyMarkers(quizzesData[1]).campaign, 'PharmCamp');
check('legacy: substring PharmCampX is NOT a marker', w.quizLegacyMarkers(quizzesData[3]).found, false);
check('campaign: field wins over legacy tag', w.quizCampaign(quizzesData[5]), 'Camp2');
check('source: field wins over legacy tag', w.quizSource(quizzesData[4]), 'manual');
check('strip keeps real tags', w.stripQuizMarkerTags('Headache, AI_FROM_CASE, PharmCamp , Fever').join('|'), 'Headache|Fever');

// cert gate: field first, exact legacy, no substring
check('pharmCampDateRange uses B (legacy) + C (field), not D (substring)', j(w.pharmCampDateRange()), '{"start":"2026-03-01","end":"2026-03-05"}');

// campaign chips
w.populateQuizCampaignChips('PharmCamp');
const rail = mk('quiz-campaign-chips').innerHTML;
check('chips: None + known campaigns + New', [...rail.matchAll(/>([^<]+)<\/div>/g)].map(m => m[1]).join('|'), 'None|Camp2|PharmCamp|+ New');
check('chips: active = current', /class="glass-toggle-item active" data-value="PharmCamp"/.test(rail), true);
check('chips: hidden value set', mk('quiz-campaign').value, 'PharmCamp');
w.selectQuizCampaign({ dataset: { value: '' } });
check('chips: None clears hidden', mk('quiz-campaign').value, '');
w.selectQuizCampaign(null, true);
check('chips: + New takes a trimmed name', mk('quiz-campaign').value, 'Winter Camp');
check('chips: new name becomes a chip', /data-value="Winter Camp"/.test(mk('quiz-campaign-chips').innerHTML), true);

// side fields merged into every save
mk('quiz-system-select').value = '';
w._quizEditorLegacySource = 'ai_from_case';
check('save (update): campaign + legacy source written', j(w.quizSystemFieldsFromEditor(true)), '{"coverageSystem":"<DELETE>","diseaseSystemKey":"<DELETE>","campaign":"Winter Camp","source":"ai_from_case"}');
w._quizEditorLegacySource = '';
mk('quiz-campaign').value = '';
check('save (update): empty campaign deletes the field', j(w.quizSystemFieldsFromEditor(true)), '{"coverageSystem":"<DELETE>","diseaseSystemKey":"<DELETE>","campaign":"<DELETE>"}');
check('save (add): empty campaign writes nothing', j(w.quizSystemFieldsFromEditor(false)), '{}');

// migration
w.migrateQuizMarkerTags().then(() => {
    check('migrate: only docs with legacy markers, history skipped', writes.map(x => x.id).join(','), 'A,B,F');
    check('migrate: A gets source, tags stripped', j(writes[0].data), '{"tags":"Headache","source":"ai_from_case"}');
    check('migrate: B gets campaign, tags stripped', j(writes[1].data), '{"tags":"Fever","campaign":"PharmCamp"}');
    check('migrate: F keeps its own campaign, only tags stripped', j(writes[2].data), '{"tags":""}');
    check('migrate: toast', toasts[toasts.length - 1], '✅ Moved markers on 3 quiz(zes)');

    // static wiring
    check('case→quiz no longer tags AI_FROM_CASE', admin.includes("tags: 'AI_FROM_CASE'"), false);
    check('case→quiz writes source', admin.includes("source: 'ai_from_case'"), true);
    check('cert gate no longer substring-matches tags', admin.includes(".includes('PharmCamp')"), false);
    check('getQuizFormData strips markers', /const tags = window\.normalizeQuizTagList\(window\.stripQuizMarkerTags\(/.test(admin), true);
    check('hygiene panel offers migration', admin.includes('onclick="migrateQuizMarkerTags()"'), true);

    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
});
