// V100.87 / V101.19: harness for "Fill from image" on the Disease / Drug submit
// forms. Extracts the REAL dd* helpers from public/index.html and drives them with
// a DOM stub; checks the submit wiring, storage.rules and the admin review side
// statically.
//   node scripts/codex-image-fill-check.cjs
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const index = read('public/index.html');
const admin = read('public/admin.html');
const rules = read('storage.rules');

const a = index.indexOf('        const DD_IMAGE_FORMS = {');
const b = index.indexOf('        function ddCountChanged(snapshot, current) {', a);
if (a < 0 || b < 0) { console.error('dd image helpers not found'); process.exit(1); }

const els = {};
const mk = id => els[id] || (els[id] = { id, value: '', hidden: false, textContent: '', className: '', src: '', disabled: false, files: null, _cls: new Set(),
    classList: { add(c) { els[id]._cls.add(c); }, remove(c) { els[id]._cls.delete(c); }, contains(c) { return els[id]._cls.has(c); } },
    getAttribute(n) { return n === 'maxlength' ? (id === 'dx-s-icd10' ? '20' : null) : null; }, addEventListener() {} });
const dxSubmitState = {}, dcSubmitState = {};
const toasts = [];
const ctx = {
    document: { getElementById: mk }, dxSubmitState, dcSubmitState, URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    PRODUCT_PHOTO_MAX_INPUT: 12 * 1024 * 1024, PRODUCT_PHOTO_MAX_UPLOAD: 2 * 1024 * 1024, PRODUCT_AI_PROXY_URL: 'https://proxy',
    showToast: m => toasts.push(m), _productSha256Hex: async () => 'abc123', firebase: { storage: null },
    resizeProductPhoto: async () => ({ blob: { size: 1000 }, width: 10, height: 10 }), blobToBase64: async () => 'b64', ensureFirebaseAuthReady: async () => ({ getIdToken: async () => 't' }), fetch: null
};
const names = Object.keys(ctx);
const api = new Function(...names, index.slice(a, b) + '\nreturn { DD_IMAGE_FORMS, ddBuildVisionPrompt, ddParseVisionLines, ddApplyVisionFields, ddSourceImageFields, ddSetSourceImageFromDraft, ddImageClear };')(...names.map(n => ctx[n]));

const checks = [];
const check = (name, got, want) => checks.push([name, got, want]);

// prompt
const p = api.ddBuildVisionPrompt('dx');
check('disease prompt lists every field key + UNSURE', ['NAME_EN:', 'NAME_TH:', 'ICD10:', 'CATEGORY:', 'SYMPTOMS:', 'DIAGNOSIS:', 'TREATMENT:', 'UNSURE:'].every(k => p.includes(k)), true);
check('prompt forbids invented codes', /Never invent codes, doses or facts/.test(p) && /ONLY if it is printed/.test(p), true);
check('drug prompt has BRANDS / ATC / DOSING', /BRANDS:[\s\S]*ATC:[\s\S]*DOSING:/.test(api.ddBuildVisionPrompt('dc')), true);

// parser
const keys = Object.keys(api.DD_IMAGE_FORMS.dx.fields);
const reply = '```\nNAME_EN: Anxiety disorders\nNAME_TH: โรควิตกกังวล\nICD10: -\nCATEGORY: Psychiatry\nSYMPTOMS: excessive worry ≥6 months; restlessness;\n fatigue; sleep problems\nDIAGNOSIS: DSM criteria\nTREATMENT: CBT; mindfulness; lifestyle\nUNSURE: -\nNAME_EN: duplicate should be ignored\n```';
const parsed = api.ddParseVisionLines(reply, keys);
check('parse: values by key, "-" → null', `${parsed.NAME_EN}|${parsed.NAME_TH}|${parsed.ICD10}|${parsed.CATEGORY}`, 'Anxiety disorders|โรควิตกกังวล|null|Psychiatry');
check('parse: wrapped line continues the previous key', parsed.SYMPTOMS, 'excessive worry ≥6 months; restlessness; fatigue; sleep problems');
check('parse: first occurrence wins', parsed.NAME_EN, 'Anxiety disorders');
check('parse: bullet-prefixed keys accepted', api.ddParseVisionLines('- NAME_EN: X\n* NAME_TH: Y', keys).NAME_TH, 'Y');
check('parse: empty reply → all null', Object.values(api.ddParseVisionLines('', keys)).every(v => v === null), true);

// apply: only empty fields, highlight, notes line
mk('dx-s-diseaseName').value = 'Already typed';
mk('dx-s-internNotes').value = 'my note';
const filled = api.ddApplyVisionFields('dx', parsed);
check('apply: typed field untouched', mk('dx-s-diseaseName').value, 'Already typed');
check('apply: empty fields filled', `${mk('dx-s-thaiName').value}|${mk('dx-s-category').value}|${mk('dx-s-icd10').value}`, 'โรควิตกกังวล|Psychiatry|');
check('apply: filled list excludes typed + null fields', filled.join(','), 'NAME_TH,CATEGORY,SYMPTOMS,DIAGNOSIS,TREATMENT');
check('apply: filled fields highlighted, typed one not', mk('dx-s-thaiName').classList.contains('dc-submit-ai-filled') && !mk('dx-s-diseaseName').classList.contains('dc-submit-ai-filled'), true);
check('apply: note to admin appended once, keeps existing note', mk('dx-s-internNotes').value, 'my note\n📷 AI pre-filled from an image (Typhoon vision): NAME_TH, CATEGORY, SYMPTOMS, DIAGNOSIS, TREATMENT. Please verify against the source image.');
api.ddApplyVisionFields('dx', parsed);
check('apply: second run does not duplicate the note', (mk('dx-s-internNotes').value.match(/AI pre-filled/g) || []).length, 1);
check('apply: maxlength respected', (() => { mk('dx-s-icd10').value = ''; api.ddApplyVisionFields('dx', { ICD10: 'X'.repeat(50) }); return mk('dx-s-icd10').value.length; })(), 20);

// source image fields
(async () => {
    check('fields: no image → {}', JSON.stringify(await api.ddSourceImageFields('dx', 'u1')), '{}');
    api.ddSetSourceImageFromDraft('dx', { sourceImageUrl: 'https://s/x.jpg', sourceImagePath: 'codex-sources/u1/abc.jpg' });
    check('fields: existing image on the draft is kept as is', JSON.stringify(await api.ddSourceImageFields('dx', 'u1')), '{"sourceImageUrl":"https://s/x.jpg","sourceImagePath":"codex-sources/u1/abc.jpg"}');
    check('preview shows the existing image', mk('dx-image-thumb').src + '|' + mk('dx-image-preview').hidden, 'https://s/x.jpg|false');
    api.ddImageClear('dx');
    check('clear resets state + preview', `${dxSubmitState.sourceImage}|${mk('dx-image-preview').hidden}`, 'null|true');
    dxSubmitState.sourceImage = { blob: { size: 5 }, existing: false };
    check('fields: fresh image with Storage unavailable → toast + {}', JSON.stringify(await api.ddSourceImageFields('dx', 'u1')) + '|' + /could not be attached/.test(toasts[toasts.length - 1]), '{}|true');

    // static wiring
    check('submit: image fields merged at all 4 draft writes', (index.match(/Object\.assign\((updateData|draftData), await ddSourceImageFields\('(dx|dc)', authUser\.uid\)\);/g) || []).length, 4);
    check('open: both forms clear the image; edit-pending restores it', /ddImageClear\('dx'\); \/\/ V100\.87/.test(index) && /ddImageClear\('dc'\); \/\/ V100\.87/.test(index) && /ddSetSourceImageFromDraft\('dx', draft\)/.test(index) && /ddSetSourceImageFromDraft\('dc', draft\)/.test(index), true);
    check('markup: image row + file input on both forms', ['dx', 'dc'].every(k => index.includes(`id="${k}-image-input" accept="image/jpeg,image/png,image/webp" hidden onchange="ddImagePicked(event, '${k}')"`)), true);
    check('upload path is content-addressed under the uid', /'codex-sources\/' \+ uid \+ '\/' \+ hash \+ '\.jpg'/.test(index), true);
    check('AI call: typhoon, visionData, feature tags', /provider: 'typhoon', prompt: ddBuildVisionPrompt\(kind\), isJson: false,/.test(index) && /intern_disease_vision/.test(index) && /intern_drug_vision/.test(index), true);
    check('storage.rules: codex-sources block (owner create ≤2MB image, admin read)', /match \/codex-sources\/\{ownerUid\}\/\{fileName\} \{\n\s*allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && request\.auth\.uid == ownerUid\);\n\s*allow create: if isSignedIn\(\) && request\.auth\.uid == ownerUid\n\s*&& request\.resource\.size < 2 \* 1024 \* 1024\n\s*&& request\.resource\.contentType\.matches\('image\/\(jpeg\|png\|webp\)'\);\n\s*allow update, delete: if isAdmin\(\);/.test(rules), true);
    check('admin: both review banners show the image and do not early-return on it', (admin.match(/if \(!hasNotes && !hasTarget && !hasImage\)/g) || []).length === 2 && (admin.match(/parts\.push\(ddaSourceImageHtml\(draft\.sourceImageUrl, d[cx]aEscapeHtml\)\)/g) || []).length === 2, true);
    check('admin: both queues show the 📷 chip', (admin.match(/📷 Source image attached/g) || []).length, 2);
    check('admin: approve copies only field keys (image never published)', !/sourceImageUrl/.test(admin.slice(admin.indexOf('function dcaApproveDraft'), admin.indexOf('function dcaApproveDraft') + 4000)) && !/sourceImageUrl/.test(admin.slice(admin.indexOf('function dxaApproveDraft'), admin.indexOf('function dxaApproveDraft') + 4000)), true);
    check('titles bumped', /Internship Portfolio \(V100\.87\)/.test(index) && /Nika Admin \(V101\.19\)/.test(admin), true);

    let fail = 0;
    checks.forEach(([name, got, want]) => {
        const ok = String(got) === String(want);
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
    });
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
})();
