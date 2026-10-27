// V102.407 / V102.409: the Case Card poster text. Two layouts: 'infographic' (default; real short text, NO person drawn, no age / sex /
// occupation as text) and 'minimal' (the earlier icon-only card: the category title only). English only, never Thai / Korean glyphs.
// The REAL helper + prompt builders + rebuild function are cut from public/admin.html.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, a); return html.slice(i, html.indexOf(b, i)); };
const ctx = { layout: 'infographic', translated: null, els: {} }; vm.createContext(ctx);
ctx.getCaseCardLayout = () => ctx.layout;
ctx.document = { getElementById: id => ctx.els[id] || null };
ctx.translateAlabastaSummaryToEnglish = async s => s;
vm.runInContext(cut('        function alabastaEnglishOnly(', '        function buildSafeAlabastaCaseVisualPayload(')
    + cut('        function buildAlabastaCaseCardPrompt(', '        // V92.48: localStorage key')
    + cut('        // V102.438 (owner): the medicine dispensed', '        async function refineAlabastaCaseCardPromptWithSelectedModel(')
    + '\nthis.eo = alabastaEnglishOnly; this.build = buildAlabastaCaseCardPrompt; this.rebuild = rebuildAlabastaCaseCardPromptFromInputs;', ctx);

assert.equal(ctx.eo('GI / ระบบทางเดินอาหาร'), 'GI');
assert.equal(ctx.eo('Skin 피부'), 'Skin');
assert.equal(ctx.eo('Heme/Immune โลหิต/ภูมิคุ้มกัน'), 'Heme/Immune');
assert.equal(ctx.eo('Other'), 'Other');
assert.equal(ctx.eo('ปวดท้อง'), '');
assert.equal(ctx.eo(null), '');

// the payload builder feeds the title / tags through it
assert.ok(/const systemEn = alabastaEnglishOnly\(taxonomy\.primarySystemLabel\);\s*\n\s*const title = systemEn && systemEn !== 'Other' \? `\$\{systemEn\} Case Brief` : 'Medical Case Brief';/.test(html), 'title = English category');
assert.ok(/const tagsEn = taxonomy\.symptomTags\.map\(alabastaEnglishOnly\)\.filter\(Boolean\);/.test(html), 'subtitle = English tags');

const payload = { primarySystemLabel: 'GI', symptomTags: ['Abdominal Pain', 'Diarrhea'], safeSummary: 'A man in his late 40s taking magnesium, with 2-3 days of abdominal discomfort.', textContent: { title: 'GI Case Brief', subtitle: 'Abdominal Pain / Diarrhea' }, imageBrief: {}, visualRequirements: [], negativePrompt: [] };

// ---- infographic (default)
ctx.layout = 'infographic';
let p = ctx.build(payload);
assert.ok(p.includes('Main title: "Patient Presentation". Subtitle under it: "Abdominal Pain / Diarrhea".') && !p.includes('GI Case Brief'), 'title + tags-only subtitle; no "GI Case Brief" line');
assert.ok(p.includes('NO REPEATED TEXT'), 'each fact appears once');
assert.ok(ctx.build({ ...payload, textContent: { title: 'Medical Case Brief', subtitle: '' } }).includes('No subtitle.'), 'no tags -> no subtitle, never "Medical Case Brief"');
assert.ok(/History of Presenting Illness/.test(p) && /"Symptoms"/.test(p) && /"Recommendations"/.test(p) && /educational purposes only/.test(p), 'the infographic sections');
assert.ok(/NEVER draw a portrait, a face, a photograph or an avatar of any person/.test(p), 'no person drawn');
assert.ok(/faceless human body silhouette/.test(p), 'a faceless body is allowed');
assert.ok(/Do NOT write the patient's name, sex, nationality/.test(p) && /no "man", "woman", "male"/.test(p), 'sex / name / nationality are banned as text');
assert.ok(/FIRST History bullet may state the age \(or age band\) and the occupation, for example "Late 40s, car mechanic"/.test(p), 'age + occupation may sit in the first History bullet');
assert.ok(/Do not write a workplace \/ employer name or the day and month of any date/.test(p), 'no workplace / day+month without consent');
assert.ok(/The patient agreed to share details: a workplace name and exact dates/.test(ctx.build({ ...payload, allowDetails: true })) && !/Do not write a workplace/.test(ctx.build({ ...payload, allowDetails: true })), 'with consent the workplace / dates may appear');
assert.ok(/Case context: A man in his late 40s/.test(p), 'the summary still informs the case');
assert.ok(!/≤ 12 words/.test(p), 'the icon-only word cap is not in the infographic');
assert.ok(p.indexOf('### TEXT') < p.indexOf('Case context (the ONLY source of facts)'), 'the text rules come first');

// ---- the three new templates: tiles come FROM THE CASE; teal / amber on white; no person; no personal descriptors at all
for (const kind of ['lifestyle', 'symptoms', 'selfcare']) {
    ctx.layout = kind;
    const t = ctx.build(payload);
    assert.ok(/flat vector illustration style, suitable for editing in Canva and PowerPoint\. Landscape 16:9/.test(t), kind + ': Canva / 16:9');
    assert.ok(t.includes('Small subtitle: "GI Case Brief: Abdominal Pain / Diarrhea".'), kind + ': the real heading');
    assert.ok(/muted teal \(#0D9488\), warm gray, soft amber\/orange accent \(#F59E0B\), white or very light background; colour-blind safe; no alarming red/.test(t), kind + ': the template palette');
    assert.ok(/NEVER draw a person, portrait, face, photograph or avatar\. Do NOT write the patient's age, sex, occupation, nationality or any personal descriptor\./.test(t), kind + ': nothing personal');
    assert.ok(/workplace name or date anywhere/.test(t), kind + ': no workplace / date');
    assert.ok(/Case context \(the ONLY source of facts\):[\s\S]*Case context: A man in his late 40s/.test(t), kind + ': the summary is the only source');
    assert.ok(!/Patient Presentation|History of Presenting Illness/.test(t), kind + ': not the infographic');
}
ctx.layout = 'lifestyle';
let t = ctx.build(payload);
assert.ok(/Title: "Lifestyle triggers"/.test(t) && /4 tiles in a 2x2 grid, or 5-6 tiles in a 3x2 grid/.test(t) && /ONLY the triggers and lifestyle factors the case context names/.test(t) && /never invent one/.test(t), 'lifestyle: tiles from the case, 2x2 / 3x2');
ctx.layout = 'symptoms';
t = ctx.build(payload);
assert.ok(/Title: "Symptoms"/.test(t) && /faceless torso silhouette/.test(t) && /one per symptom named in the case context/.test(t) && /right third of the canvas EMPTY/.test(t), 'symptoms: body focus, callouts, empty right third');
ctx.layout = 'selfcare';
t = ctx.build(payload);
assert.ok(/Title: "What can help"/.test(t) && /Six equal tiles in a 3x2 grid/.test(t) && /general counselling only/.test(t) && /"See a doctor if it persists"/.test(t), 'self-care: 3x2, general counselling, doctor tile');
ctx.layout = 'infographic';

// ---- V102.422: no invented slogans / logos / brand marks — in the case infographic AND in the three templates
for (const kind of ['infographic', 'lifestyle', 'symptoms', 'selfcare']) {
    ctx.layout = kind;
    const t = ctx.build(payload);
    assert.ok(/NO slogans, taglines, logos or brand marks anywhere \(no invented mottos, app \/ clinic \/ hospital names or logo-like badges\)\. Only the text listed/.test(t), kind + ': the rule in the text block');
    assert.ok(/- Slogans, taglines, logos, brand marks, invented organisation names/.test(t), kind + ': and in the avoid list');
}
ctx.layout = 'infographic';

// ---- minimal (the earlier card)
ctx.layout = 'minimal';
p = ctx.build(payload);
assert.ok(p.includes('The ONLY text allowed on the poster, written exactly as given: title "GI Case Brief" and subtitle "Abdominal Pain / Diarrhea". Write nothing else.'), 'minimal: the allowed text is named');
assert.ok(/NEVER write the patient's age, sex, occupation, nationality/.test(p) && /no "50yo male driver"/.test(p), 'minimal: descriptors banned as text');
assert.ok(p.indexOf('The ONLY text allowed') < p.indexOf('Reference content'), 'minimal: the rule precedes the reference');
assert.ok(!ctx.build({ ...payload, textContent: { title: 'Medical Case Brief', subtitle: '' } }).includes(' and subtitle'), 'no subtitle → no subtitle clause');

// ---- the REAL rebuild path: "GI 소화기 - Abdominal Pain, Diarrhea" → English system + tags, title / subtitle built from them
(async () => {
    ctx.els = { 'alabasta-case-card-safe-summary': { value: payload.safeSummary, dataset: {} }, 'alabasta-case-card-taxonomy': { value: 'GI 소화기 - Abdominal Pain, Diarrhea, ปวดท้อง' }, 'alabasta-case-card-prompt': { value: '' }, 'alabasta-case-card-meta': { textContent: '' } };
    ctx.layout = 'infographic';
    const out = await ctx.rebuild({ quiet: true });
    assert.equal(out, ctx.els['alabasta-case-card-prompt'].value, 'the prompt box is filled');
    assert.ok(out.includes('Subtitle under it: "Abdominal Pain / Diarrhea"'), 'rebuild: tags-only subtitle (English tags only): ' + out.split('\n').find(l => /Subtitle under it/.test(l)));
    assert.ok(!/[฀-๿가-힣]/.test(out), 'no Thai / Korean glyph reaches the prompt');
    ctx.layout = 'minimal';
    assert.ok((await ctx.rebuild({ quiet: true })).includes('title "GI Case Brief" and subtitle "Abdominal Pain / Diarrhea"'), 'rebuild: minimal layout too');
    // wiring
    assert.ok(/function getCaseCardLayout\(\) \{\s*\n\s*if \(getCaseCardCompositeMode\(\) === 'html-overlay'\) return 'minimal';/.test(html), 'the HTML-overlay mode is always minimal');
    assert.ok(html.includes('grok-imagine/.test(selectedModel)') && html.includes("aspectRatio: _CASECARD_WIDE.includes(getCaseCardLayout()) ? '16:9' : '4:3'"), 'Grok Imagine goes through the Image API: 16:9 for the wide templates, 4:3 otherwise');
    assert.ok(html.includes("const _CASECARD_WIDE = ['lifestyle', 'symptoms', 'selfcare'];") && html.includes("const _CASECARD_TEMPLATES = ['infographic', 'lifestyle', 'symptoms', 'selfcare', 'minimal'];"), 'the template lists');
    // V102.438: the dispensed medicine is written onto the prompt, sanitised (no quotes / line breaks), and absent when empty
    const els0 = ctx.els;
    ctx.els = { ...els0, 'alabasta-case-card-dispensed': { value: '  ibuprofen "400"\n mg  ' } };
    const withDisp = await ctx.rebuild({ quiet: true });
    assert.ok(withDisp.includes('line "Dispensed: ibuprofen 400 mg"') && /no brand, no price, no pharmacy name/.test(withDisp), 'the prompt carries one clean Dispensed line');
    ctx.els = { ...els0, 'alabasta-case-card-dispensed': { value: '' } };
    assert.ok(!/DISPENSED MEDICINE/.test(await ctx.rebuild({ quiet: true })), 'nothing is added when the field is empty');
    ctx.els = els0;
    assert.ok(html.includes('data-value="or/x-ai/grok-imagine-image-2.0"') && html.includes("'gpt-image-2.5-sunburst', 'or/x-ai/grok-imagine-image-2.0']"), 'the Grok chip is a valid saved model');
    console.log('PASS: Case Card — infographic (default) / minimal; no person, no age / occupation text, English only; the real rebuild path; Grok Imagine wiring.');
})().catch(e => { console.error(e); process.exit(1); });
