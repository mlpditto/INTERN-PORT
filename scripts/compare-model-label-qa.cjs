// V102.486: the Compare modal's model badge names trial models (Kimi, Grok, Ollama) instead of the generic "AI".
// Node-only: slices _compareModelMeta out of admin.html and textAIModelInfo's catalog out of ai-model-ui.js.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', 'public');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'ai-model-ui.js'), 'utf8');

const start = admin.indexOf('window._compareModelMeta = function(modelId) {');
assert(start > 0, '_compareModelMeta not found');
const end = admin.indexOf('window._compareModelB = function', start);
assert(end > start, 'end of _compareModelMeta not found');
const fnSrc = admin.slice(start, end);

const sandbox = { window: {}, document: { addEventListener() {}, getElementById() { return null; } }, localStorage: { getItem() { return null; }, setItem() {} } };
new Function('window', 'document', 'localStorage', ui)(sandbox.window, sandbox.document, sandbox.localStorage);
new Function('window', fnSrc)(sandbox.window);
const meta = id => sandbox.window._compareModelMeta(id);

assert.strictEqual(meta('or/moonshotai/kimi-k3.1-pro').label, 'Kimi K3.1 Pro', 'Kimi trial model keeps its name');
assert.strictEqual(meta('or/x-ai/grok-4.7').label, 'Grok 4.7', 'Grok trial model keeps its name');
assert.strictEqual(meta('ol/local').label, 'Ollama local', 'Ollama trial model keeps its name');
assert.strictEqual(meta('gpt-6.1-sol').label, 'GPT 6.1 Sol', 'catalog model unchanged');
// the proxy echoes the provider's own name (Gemini modelVersion), not the catalogue id
assert.strictEqual(meta('gemini-4-argon').label, 'Gemini 4 Argon', 'Argon echoed without its as/ prefix');
assert.strictEqual(meta('gemini-4-argon-001').label, 'Gemini 4 Argon', 'Argon with a version suffix');
assert.strictEqual(meta('gemini-3.5-flash-lite-002').label, 'Gemini 3.5 Flash-Lite', 'longest catalogue id wins (Flash-Lite, not Flash)');
assert.strictEqual(meta('gemini-3.5-flash').label, 'Flash', 'a legacy id outside the catalogue keeps its old label');
assert.strictEqual(meta('some-unknown-model').label, 'AI', 'unknown ids still fall back to AI');
assert.strictEqual(meta(undefined).label, 'AI', 'no id falls back to AI');
console.log('compare-model-label-qa: PASS');
