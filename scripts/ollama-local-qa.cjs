// Local Ollama trial model (public/ollama-local.js): the real module against a mock Ollama HTTP server — no real Ollama needed.
const fs = require('fs');
const vm = require('vm');
const http = require('http');
const assert = require('node:assert/strict');

const src = fs.readFileSync('public/ollama-local.js', 'utf8');
let mode = {};           // per-test behaviour of the mock
let seen = [];           // requests the mock received
let closed = 0;           // connections the client dropped while the mock was hanging

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
        seen.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
        const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(obj == null ? '' : JSON.stringify(obj)); };
        if (mode.status403) return send(403, null);
        if (req.url === '/api/tags') return send(200, { models: mode.models || [{ name: 'nimble:latest' }, { name: 'other:1b' }] });
        if (req.url === '/api/ps') return send(200, { models: [{ name: 'nimble:latest', context_length: mode.ctx || 8194 }, { name: 'other:1b', context_length: mode.ctx || 8194 }] });
        if (req.url === '/api/chat' && mode.hang) { res.on('close', () => { closed += 1; }); return; }   // never answers; counts a dropped connection
        if (req.url === '/api/chat') {
            if (mode.chatError) return send(500, { error: mode.chatError });
            return send(200, { model: body && JSON.parse(body).model, message: { role: 'assistant', content: mode.text ?? 'ok' }, done: true, done_reason: mode.doneReason || 'stop', prompt_eval_count: mode.promptTokens ?? 120, eval_count: mode.evalTokens ?? 30 });
        }
        send(404, null);
    });
});

function load(url, store = {}) {
    const ctx = { console, fetch, AbortController, setTimeout, clearTimeout, JSON, Error, Promise, String, location: { origin: 'https://mlpditto.github.io' },
        localStorage: { getItem: k => (k === 'OLLAMA_LOCAL_URL' ? url : store[k] ?? null) } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return ctx.window;
}
const chatBody = () => seen.filter(r => r.url === '/api/chat').pop().body;

(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + server.address().port;
    const w = load(url);

    // model resolution: `local` = first installed; stored choice; explicit name; unknown name
    mode = {}; seen = [];
    let out = await w.callOllamaLocal('ol/local', 'hi', false, null, null);
    assert.equal(chatBody().model, 'nimble:latest', 'ol/local → first installed model');
    out = await load(url, { OLLAMA_LOCAL_MODEL: 'other:1b' }).callOllamaLocal('ol/local', 'hi', false, null, null);
    assert.equal(chatBody().model, 'other:1b', 'ol/local → stored model');
    await w.callOllamaLocal('ol/other:1b', 'hi', false, null, null);
    assert.equal(chatBody().model, 'other:1b', 'ol/<name> → that model');
    await assert.rejects(() => w.callOllamaLocal('ol/missing:7b', 'hi', false, null, null), /no model "missing:7b".*nimble:latest, other:1b/);

    // request shape + result shape
    mode = { text: 'hello', promptTokens: 100, evalTokens: 25 }; seen = [];
    out = await w.callOllamaLocal('ol/local', 'the prompt', false, null, null);
    let b = chatBody();
    assert.deepEqual(b.messages, [{ role: 'user', content: 'the prompt' }]);
    assert.equal(b.stream, false); assert.equal(b.think, false);
    assert.equal(b.format, undefined, 'no JSON mode unless asked');
    assert.equal(b.options.temperature, 0.4); assert.equal(b.options.num_predict, 4096);
    assert.deepEqual([out.text, out.tokens, out.model, out.raw.finishReason], ['hello', 125, 'ollama/nimble:latest', 'stop']);
    mode = { text: '{"a":1}' };
    await w.callOllamaLocal('ol/local', 'p', true, null, { temperature: 0.1, maxTokens: 500 });
    b = chatBody();
    assert.equal(b.format, 'json'); assert.equal(b.options.temperature, 0.1); assert.equal(b.options.num_predict, 500);

    // guards: JSON that does not parse, output cut off, prompt longer than the context, image input
    mode = { text: 'not json' };
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', true, null, null), /does not parse/);
    mode = { text: '{"a":', doneReason: 'length' };
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', true, null, null), /cut off/);
    mode = { promptTokens: 8190, ctx: 8194 };
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', false, null, null), /filled Ollama's 8194-token context/);
    mode = {};
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', false, { image_base64: 'x' }, null), /text-only/);
    mode = { chatError: 'model requires more memory' };
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', false, null, null), /Ollama: model requires more memory/);
    mode = { models: [] };
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', false, null, null), /No model is installed/);

    // origin refused (Ollama's 403) and nothing listening — both tell the admin how to fix it
    mode = { status403: true };
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', false, null, null), /refused this site \(403\).*OLLAMA_ORIGINS=https:\/\/mlpditto\.github\.io/);
    mode = {};
    const dead = load('http://127.0.0.1:9');
    await assert.rejects(() => dead.callOllamaLocal('ol/local', 'p', false, null, null), /is not reachable.*OLLAMA_ORIGINS=https:\/\/mlpditto\.github\.io/);

    // Stop button: an AbortSignal in generationOptions cuts the in-flight request (Ollama stops generating when the connection closes)
    mode = { hang: true }; closed = 0;
    const ctl = new AbortController();
    const hung = w.callOllamaLocal('ol/local', 'p', false, null, { signal: ctl.signal });
    await new Promise(r => setTimeout(r, 150));
    ctl.abort();
    await assert.rejects(() => hung, e => e.reviewCancelled === true && e.message === 'Stopped');
    await new Promise(r => setTimeout(r, 150));
    assert.equal(closed, 1, 'the connection to Ollama was closed');
    const pre = new AbortController(); pre.abort();
    await assert.rejects(() => w.callOllamaLocal('ol/local', 'p', false, null, { signal: pre.signal }), e => e.reviewCancelled === true);
    mode = {};

    // wiring: catalog (after Grok, trial only), text-only, admin routes ol/ before any provider, script included
    const ui = fs.readFileSync('public/ai-model-ui.js', 'utf8'), admin = fs.readFileSync('public/admin.html', 'utf8');
    assert.match(ui, /id: 'or\/x-ai\/grok-4\.7'[^\n]*\n[\s\S]*?id: 'ol\/local'/, 'Ollama follows Grok in TEXT_AI_TRIAL_MODELS');
    assert.ok(!/TEXT_AI_MODELS = \[[\s\S]*?'ol\/local'[\s\S]*?\];\s*\/\/ Official marks/.test(ui), 'not in TEXT_AI_MODELS');
    assert.match(ui, /isTextOnlyAIModel = id => \/\^\(or\\\/deepseek\\\/deepseek-v4-pro\|ol\\\/\)\//);
    assert.ok(admin.indexOf("modelName.startsWith('ol/')") > 0 && admin.indexOf("modelName.startsWith('ol/')") < admin.indexOf('let proxyProvider = ""'), 'admin routes ol/ before the provider chain');
    assert.match(admin, /<script src="ollama-local\.js\?v=V\d+\.\d+"><\/script>/);
    server.close();
    console.log('PASS: ollama-local — model pick (first / stored / named / unknown), request + result shape, JSON mode, cut-off + context + image + server-error guards, 403 and unreachable messages, catalog after Grok (trial only), admin routing + script tag');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
