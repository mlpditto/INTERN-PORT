// V100.88 / V101.20: harness for the shared CodexVision contract and the admin
// "Re-extract from image" review tool. Runs the REAL public/codex-vision.js and the
// real dda* functions from admin.html with DOM / fetch / FileReader stubs.
//   node scripts/codex-vision-shared-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const shared = read('public/codex-vision.js');
const admin = read('public/admin.html');
const index = read('public/index.html');
const ui = read('public/ai-model-ui.js');

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// --- shared contract ---
const w = {};
new Function('window', shared)(w);
const CV = w.CodexVision;
check('specs: disease + drug with 7 keys each', `${Object.keys(CV.specs.disease.keys).length}|${Object.keys(CV.specs.drug.keys).length}`, '7|7');
check('replyKeys order matches spec', CV.replyKeys('disease').join(','), 'NAME_EN,NAME_TH,ICD10,CATEGORY,SYMPTOMS,DIAGNOSIS,TREATMENT');
check('prompt: every key line + UNSURE + no-invent rule', ['NAME_EN:', 'TREATMENT:', 'UNSURE:', 'Never invent codes, doses or facts', 'ONLY if it is printed'].every(t => CV.buildPrompt('disease').includes(t)), true);
check('prompt: drug subject', /about a drug/.test(CV.buildPrompt('drug')) && /SIDE_EFFECTS:/.test(CV.buildPrompt('drug')), true);
let threw = ''; try { CV.buildPrompt('nope'); } catch (e) { threw = e.message; }
check('prompt: unknown subject throws', /unknown subject/.test(threw), true);
const parsed = CV.parseLines('```\nNAME_EN: Anxiety disorders\nNAME_TH: โรควิตกกังวล\nICD10: -\nCATEGORY: Psychiatry\nSYMPTOMS: worry;\n restlessness\nDIAGNOSIS: DSM\nTREATMENT: CBT\nUNSURE: -\nNAME_EN: dup\n```', CV.replyKeys('disease'));
check('parse: digits in keys (ICD10) recognised, "-" → null', `${parsed.NAME_TH}|${parsed.ICD10}|${parsed.CATEGORY}`, 'โรควิตกกังวล|null|Psychiatry');
check('parse: continuation + first-wins', `${parsed.SYMPTOMS}|${parsed.NAME_EN}`, 'worry; restlessness|Anxiety disorders');
check('parse: bullets + em-dash empty', JSON.stringify(CV.parseLines('- GENERIC: Metformin\n* ATC: —', CV.replyKeys('drug'))).includes('"GENERIC":"Metformin","BRANDS":null,"ATC":null'), true);

// --- admin re-extract (real code, stubs) ---
const a = admin.indexOf('        const DDA_REEXTRACT = {');
const b = admin.indexOf('        function dcaShowInternNotesBanner(draft) {', a);
if (a < 0 || b < 0) { console.error('dda re-extract block not found'); process.exit(1); }
const els = {}; const events = [];
const mk = id => els[id] || (els[id] = { id, value: '', innerHTML: '', textContent: '', dataset: {}, querySelector: () => ({ dataset: { value: 'claude-sonnet-5' } }), dispatchEvent(e) { events.push(id + ':' + e.type); return true; } });
const toasts = [];
const dcaState = { editingId: 'D1', drafts: [{ _id: 'D1', sourceImageUrl: 'https://storage/x.jpg' }] };
const dxaState = { editingId: 'X1', drafts: [{ _id: 'X1' }] };
const aiCalls = [];
class FileReaderStub { readAsDataURL() { this.result = 'data:image/jpeg;base64,QUJD'; this.onload(); } }
class EventStub { constructor(type, init) { this.type = type; this.bubbles = !!(init && init.bubbles); } }
const ctx = {
    window: w, document: { getElementById: mk }, dcaState, dxaState, localStorage: { getItem: () => null },
    dcaEscapeHtml: v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    dxaEscapeHtml: v => String(v),
    showToast: m => toasts.push(m), FileReader: FileReaderStub, Event: EventStub,
    fetch: async url => ({ ok: true, blob: async () => ({ type: 'image/jpeg', url }) }),
    callUniversalAI: async (model, prompt, isJson, vision, key, opts) => { aiCalls.push({ model, isJson, vision, opts, prompt }); return { text: 'GENERIC: Metformin\nBRANDS: Glucophage, Diaformin\nATC: A10BA02\nCLASS: Biguanide\nINDICATION: T2DM\nDOSING: 500 mg bid\nSIDE_EFFECTS: GI upset\nUNSURE: label partly cut', model: 'claude-sonnet-5' }; }
};
const names = Object.keys(ctx);
new Function(...names, admin.slice(a, b))(...names.map(n => ctx[n]));

(async () => {
    mk('dca-f-genericName').value = 'Metformin';   // same as extracted → "= form"
    mk('dca-f-dosing').value = '850 mg';            // differs → Apply offered
    await w.ddaReextract('dca');
    const call = aiCalls[0];
    check('reextract: fetches the image, sends visionData through callUniversalAI', !!call && call.vision.image_base64 === 'QUJD' && call.vision.image_mimetype === 'image/jpeg' && call.isJson === false, true);
    check('reextract: model from the active chip, feature tagged', `${call.model}|${call.opts.feature}`, 'claude-sonnet-5|admin_codex_vision');
    check('reextract: prompt is the shared drug contract', call.prompt === CV.buildPrompt('drug'), true);
    const html = mk('dda-reextract-result-dca').innerHTML;
    check('render: model + unsure line', /Extracted by claude-sonnet-5<\/strong> · unsure: label partly cut/.test(html), true);
    check('render: equal field marked "= form", differing field gets Apply', /GENERIC[\s\S]*?= form/.test(html) && /DOSING[\s\S]*?ddaApplyReextract\('dca','DOSING'\)/.test(html), true);
    check('render: brand names html-escaped', /Glucophage, Diaformin/.test(html), true);
    check('render: empty-only + overwrite buttons', /'__empty'\)/.test(html) && /'__all'\)/.test(html), true);

    w.ddaApplyReextract('dca', 'DOSING');
    check('apply one: field set + input event bubbled', `${mk('dca-f-dosing').value}|${events.includes('dca-f-dosing:input')}`, '500 mg bid|true');
    mk('dca-f-class').value = 'typed';
    w.ddaApplyReextract('dca', '__empty');
    check('apply empty: fills blanks, keeps typed', `${mk('dca-f-atcCode').value}|${mk('dca-f-class').value}|${mk('dca-f-indication').value}`, 'A10BA02|typed|T2DM');
    w.ddaApplyReextract('dca', '__all');
    check('apply all: overwrites', mk('dca-f-class').value, 'Biguanide');
    check('toasts count applied fields', toasts.some(t => /Applied 1 field from the image/.test(t)) && toasts.some(t => /Applied \d+ fields/.test(t)), true);

    const s0 = mk('dda-reextract-status-dxa');
    await w.ddaReextract('dxa');
    check('no image on the draft → status says so, no AI call', `${s0.textContent}|${aiCalls.length}`, 'No source image on this draft.|1');

    // --- static wiring ---
    check('admin loads codex-vision.js + bumped ai-model-ui', /<script src="codex-vision\.js\?v=V\d+\.\d+"><\/script>/.test(admin) && /ai-model-ui\.js\?v=V\d+\.\d+/.test(admin), true);
    check('banners pass the kind', /ddaSourceImageHtml\(draft\.sourceImageUrl, dcaEscapeHtml, 'dca'\)/.test(admin) && /ddaSourceImageHtml\(draft\.sourceImageUrl, dxaEscapeHtml, 'dxa'\)/.test(admin), true);
    check('chip rail excludes OpenRouter (text-only) models', /m => !m\.id\.startsWith\('or\/'\)/.test(admin), true);
    // V101.36: the chip click goes through ddaPickVisionModel (which also closes the rail), and
    // that is where the choice is stored — check both links of the chain.
    check('chip choice persisted under its own key', /ddaPickVisionModel\(this,'\$\{kind\}'\)/.test(admin) && /function ddaPickVisionModel\(btn, kind\) \{\s*selectStoredTextAIModel\(btn, 'ai_default_codex_vision_model'\)/.test(admin), true);
    check('ai-model-ui: filter param, headings over the filtered list', /\(value, action = '', filter = null\) => \(filter \? models\.filter\(filter\) : models\)\.map\(\(m, i, list\)/.test(ui) && /list\[i - 1\]\.label/.test(ui), true);
    check('intern delegates to the shared file', /window\.CodexVision\.buildPrompt\(DD_IMAGE_FORMS\[kind\]\.subject\)/.test(index) && /<script src="codex-vision\.js\?v=V\d+\.\d+"><\/script>/.test(index), true);
    check('intern no longer carries its own key lines', !/'ICD10: <ICD-10 code ONLY if it is printed in the image, otherwise ->'/.test(index), true);

    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
})();
