// V102.407: the Case Card's poster text is the CATEGORY only (English): title "GI Case Brief" + the symptom tags — never age / sex / occupation,
// never Thai / Korean glyphs. The REAL helper + prompt builder are cut from public/admin.html.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, a); return html.slice(i, html.indexOf(b, i)); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext(cut('        function alabastaEnglishOnly(', '        function buildSafeAlabastaCaseVisualPayload(') + cut('        function buildAlabastaCaseCardPrompt(', '        // V92.48: localStorage key') + '\nthis.eo = alabastaEnglishOnly; this.build = buildAlabastaCaseCardPrompt;', ctx);

assert.equal(ctx.eo('GI / ระบบทางเดินอาหาร'), 'GI');
assert.equal(ctx.eo('Skin 피부'), 'Skin');
assert.equal(ctx.eo('Heme/Immune โลหิต/ภูมิคุ้มกัน'), 'Heme/Immune');
assert.equal(ctx.eo('Other'), 'Other');
assert.equal(ctx.eo('ปวดท้อง'), '');
assert.equal(ctx.eo(null), '');

// the payload builder feeds the title / tags through it
assert.ok(/const systemEn = alabastaEnglishOnly\(taxonomy\.primarySystemLabel\);\s*\n\s*const title = systemEn && systemEn !== 'Other' \? `\$\{systemEn\} Case Brief` : 'Medical Case Brief';/.test(html), 'title = English category');
assert.ok(/const tagsEn = taxonomy\.symptomTags\.map\(alabastaEnglishOnly\)\.filter\(Boolean\);/.test(html), 'subtitle = English tags');

const p = ctx.build({ primarySystemLabel: 'GI', symptomTags: ['Abdominal Pain', 'Diarrhea'], safeSummary: 'A 50-year-old male driver reports cramping.', textContent: { title: 'GI Case Brief', subtitle: 'Abdominal Pain / Diarrhea' }, imageBrief: {}, visualRequirements: [], negativePrompt: [] });
assert.ok(p.includes('The ONLY text allowed on the poster, written exactly as given: title "GI Case Brief" and subtitle "Abdominal Pain / Diarrhea". Write nothing else.'), 'the allowed text is named');
assert.ok(/NEVER write the patient's age, sex, occupation, nationality/.test(p) && /no "50yo male driver"/.test(p), 'personal descriptors are banned as text');
assert.ok(p.indexOf('The ONLY text allowed') < p.indexOf('Reference content'), 'the rule comes before the reference content (weaker models read the top first)');
assert.ok(p.includes('Case context: A 50-year-old male driver'), 'the summary still informs the illustration');
assert.ok(!ctx.build({ primarySystemLabel: 'x', symptomTags: [], safeSummary: 's', textContent: { title: 'Medical Case Brief', subtitle: '' } }).includes(' and subtitle'), 'no subtitle → no subtitle clause');
console.log('PASS: Case Card poster text = English category only; age / occupation banned as text.');
