// V102.518 — Gemini 3.8 Flash TTS in Laboon: the REAL request / response helpers sliced from public/admin.html (no browser, no network).
// Checks: the 3.8 model is the Gemini TTS backend's first (default) model; the Interactions request shape for a single narrator (text +
// speech_metadata style, speech_config [{voice}], audio/wav) and for a dialogue ("Speaker 1:" / "Speaker 2:" lines → turns with speaker
// annotations, speech_config {speakers}); an unlabelled dialogue transcript = one turn; the audio block is found in steps[].content[] (last
// model_output audio) or outputs[]; the engine branch calls /v1beta/interactions only for gemini-3.8-* and keeps generateContent for the rest.
const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const grab = marker => { const i = admin.indexOf(marker); assert.ok(i >= 0, marker); let d = 0, k = admin.indexOf('{', admin.indexOf(')', i)); for (; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}' && --d === 0) return admin.slice(i, k + 1) + ';'; } throw new Error('unbalanced ' + marker); };
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(grab('window.laboonGeminiTtsBody = function') + '\n' + grab('window.laboonGeminiTtsAudio = function'), ctx);
const plain = x => JSON.parse(JSON.stringify(x));   // vm realm objects are not reference-equal to ours — compare by value
const body = (...a) => plain(ctx.window.laboonGeminiTtsBody(...a)), audio = (...a) => { const r = ctx.window.laboonGeminiTtsAudio(...a); return r === null ? null : plain(r); };

// the model list + the engine branch
const models = admin.slice(admin.indexOf('gemini_api: {'), admin.indexOf('cloud_tts: {'));
assert.ok(/models: \[\s*(\/\/[^\n]*\n\s*)*\{ value: 'gemini-3\.8-flash-tts'/.test(models), '3.8 Flash TTS is the first (default) Gemini TTS model');
assert.ok(models.includes("'gemini-2.5-flash-preview-tts'") && models.includes("'gemini-3.1-flash-tts-preview'"), 'the preview models stay');
const branch = admin.slice(admin.indexOf("else if (selectedEngine === 'gemini') {"), admin.indexOf("} else if (selectedEngine === 'omnivoice') {"));
assert.ok(/if \(\/\^gemini-3\\\.8-\/\.test\(selectedModel\)\) \{/.test(branch), 'the 3.8 branch is keyed on the model id');
assert.ok(branch.includes("https://generativelanguage.googleapis.com/v1beta/interactions") && branch.includes("'x-goog-api-key': geminiKey"), '3.8 → Interactions API with the admin key');
assert.ok(branch.includes(':generateContent?key=') && branch.includes("generationConfig: { responseModalities: ['AUDIO'], speechConfig }"), 'the 2.5 / 3.1 path is untouched');
assert.ok(branch.indexOf('/v1beta/interactions') < branch.indexOf(':generateContent?key='), 'the 3.8 branch comes first, then the legacy one in its else');

// single narrator
const one = body('gemini-3.8-flash-tts', '  สวัสดีค่ะ วันนี้เรามาคุยเรื่องยาคุมกำเนิด  ', { style: 'warm, slow', voice: 'Kore' });
assert.deepEqual(one, { model: 'gemini-3.8-flash-tts', input: [{ type: 'user_input', content: [{ type: 'text', text: 'สวัสดีค่ะ วันนี้เรามาคุยเรื่องยาคุมกำเนิด', annotations: [{ type: 'speech_metadata', style: 'warm, slow' }] }] }],
    response_format: { type: 'audio', mime_type: 'audio/wav' }, generation_config: { speech_config: [{ voice: 'Kore' }] } });
assert.deepEqual(body('gemini-3.8-flash-tts', 'x', { voice: 'Puck' }).input[0].content[0].annotations, [{ type: 'speech_metadata' }], 'no style → bare annotation');
// dialogue
const two = body('gemini-3.8-flash-tts', 'Speaker 1: How is it going?\nSpeaker 2: Not bad.\nStill testing.\nspeaker 1 : Great.', { dialogue: true, style: 'cheerful', voice1: 'Kore', voice2: 'Puck' });
assert.deepEqual(two.input[0].content, [
    { type: 'text', text: 'How is it going?', annotations: [{ type: 'speech_metadata', style: 'cheerful', speaker: 'Speaker 1' }] },
    { type: 'text', text: 'Not bad.\nStill testing.', annotations: [{ type: 'speech_metadata', style: 'cheerful', speaker: 'Speaker 2' }] },
    { type: 'text', text: 'Great.', annotations: [{ type: 'speech_metadata', style: 'cheerful', speaker: 'Speaker 1' }] },
], 'labelled lines become turns, continuation lines join the turn, the label is normalised');
assert.deepEqual(two.generation_config, { speech_config: { speakers: [{ speaker: 'Speaker 1', voice: 'Kore' }, { speaker: 'Speaker 2', voice: 'Puck' }] } });
assert.deepEqual(body('gemini-3.8-flash-tts', 'no labels here', { dialogue: true }).input[0].content.map(c => c.annotations[0].speaker), ['Speaker 1'], 'an unlabelled dialogue transcript is one turn');
// the reply
assert.deepEqual(audio({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'ok' }, { type: 'audio', data: 'UklGRg==', mime_type: 'audio/wav' }] }] }), { data: 'UklGRg==', mimeType: 'audio/wav' });
assert.deepEqual(audio({ outputs: [{ type: 'audio', data: 'AAAA' }] }), { data: 'AAAA', mimeType: 'audio/wav' }, 'outputs[] and a missing mime default to wav');
assert.equal(audio({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'nothing' }] }] }), null);
console.log('PASS: Gemini 3.8 Flash TTS — default Gemini TTS model, Interactions request (single + dialogue turns, style / speaker annotations, audio/wav), audio block found in steps / outputs, 2.5 / 3.1 generateContent path kept');
