const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const admin = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
function extract(text, start, end) {
    const from = text.indexOf(start);
    assert.ok(from >= 0, 'Missing routing start');
    const to = text.indexOf(end, from);
    assert.ok(to > from, 'Missing routing end');
    return text.slice(from, to);
}
const front = new Function('modelName', extract(admin,
    '            const googleModelAliases =',
    '            // V99.24: the Audit trial') + '; return {model:modelName, provider:proxyProvider};');
const back = new Function('provider', 'input', 'const req={body:{model:input}};' + extract(backend,
    '        let { model } = req.body;',
    '        if (!provider') + '; return model;');
assert.ok(!admin.includes('value="as/gemini-2.5-flash-image"'));
assert.ok(!admin.includes('value="as/gemini-3.1-flash-image-preview"'));
assert.ok(backend.includes('const asModel = geminiApiModel || model || "gemini-3.1-flash-image";')); // V101.60: rerouted gemini 3.x first
for (const [old, next] of Object.entries({
 'gemini-2.5-flash':'gemini-3.5-flash',
 'gemini-2.5-flash-lite':'gemini-3.5-flash',
 'gemini-2.5-flash-image':'gemini-3.1-flash-image',
 'gemini-2.5-flash-image-preview':'gemini-3.1-flash-image',
 'gemini-3.1-flash-image-preview':'gemini-3.1-flash-image'
})) {
 assert.equal(front(old).model,next);
 assert.deepEqual(front('as/'+old),{model:next,provider:'gemini-aistudio'});
 for(const provider of ['gemini','gemini-aistudio']) assert.equal(back(provider,old),next);
 assert.equal(back('openrouter',old),old);
}
for(const id of ['gemini-2.5-flash-preview-tts','gemini-2.5-pro-preview-tts','gemini-3.5-flash','gemini-3.6-flash']) {
 assert.equal(front(id).model,id); assert.equal(back('gemini-aistudio',id),id);
}
assert.deepEqual(front('or/google/gemini-3.1-flash-image-preview'),{model:'google/gemini-3.1-flash-image-preview',provider:'openrouter'});
console.log('PASS: legacy aliases, AI Studio routing, TTS and OpenRouter isolation');
