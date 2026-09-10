const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

assert.ok(html.includes('id="pp-ai-btn"') && html.includes('onclick="cleanupProductPhotoWithAI()"'), 'AI button wired');
assert.ok(html.includes('onclick="undoProductPhotoAI()"'), 'Undo AI wired');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('        const PRODUCT_PHOTO_AI_MODEL'), html.indexOf('        async function ppBlobToVision(')), ctx);
vm.runInContext('this.model = PRODUCT_PHOTO_AI_MODEL;', ctx);

assert.equal(ctx.model, 'as/gemini-3.1-flash-image-preview', 'goes through the AI Studio image branch');

const prompt = ctx.buildProductPhotoCleanupPrompt();
for (const must of ['square 1:1', '#FFFFFF', 'every word, number and symbol', 'Do not add, remove, translate, retype or invent any text', 'watermarks', 'leave it cut off']) {
    assert.ok(prompt.includes(must), 'prompt keeps the rule: ' + must);
}

const pick = ctx.buildProductPhotoCleanupPrompt && ctx.pickAiImageFromResponse;
assert.equal(pick({ imageDataUrl: 'data:image/png;base64,AAA', text: 'Here is your image' }), 'data:image/png;base64,AAA', 'image wins over text');
assert.equal(pick({ raw: { imageDataUrl: 'data:image/jpeg;base64,BBB' } }), 'data:image/jpeg;base64,BBB');
assert.equal(pick({ raw: { data: [{ b64_json: 'CCC' }] } }), 'data:image/png;base64,CCC');
assert.equal(pick({ text: 'https://cdn.example/x.png' }), 'https://cdn.example/x.png');
assert.equal(pick({ text: 'I cannot edit images of medicine.' }), '', 'a refusal is not an image');
assert.equal(pick({ text: 'http://insecure/x.png' }), '', 'http is rejected');
assert.equal(pick(null), '');

console.log('PASS: model, prompt rules, image picked over text, refusals rejected, buttons wired');
