// V101.60: `gemini` provider requests for Gemini 3.x are served by callAIProxy through the Gemini API
// (GEMINI_API_KEY) and recorded in ai_usage as `gemini-aistudio`, instead of a 404 that sent the
// browser to its own localStorage key. Runs the real handler source with a stubbed network.
//   node scripts/gemini-api-route-check.cjs
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const backend = fs.readFileSync('functions/index.js', 'utf8');
const cut = (from, to) => { const a = backend.indexOf(from); assert.ok(a >= 0, 'missing ' + from); return backend.slice(a, backend.indexOf(to, a)); };
const helper = cut('function resolveGoogleGeminiModel(model) {', '\n// V95.95');
const start = backend.indexOf('exports.callAIProxy =');
const handler = backend.slice(start, backend.indexOf('\n});', start) + 4);
let request, usage, vertexAuth;
const ctx = {
    aiModelRegistry: { models: [] }, runModernAI: null,
    exports: {}, onRequest: (_, fn) => fn, process: { env: { GEMINI_API_KEY: 'test-only' } },
    verifyIdTokenFromHeader: async () => ({}), isAdminToken: () => true,
    recordAiUsage: (...args) => { usage = args; },
    GoogleAuth: function () { vertexAuth = true; this.getClient = async () => ({ getAccessToken: async () => ({ token: 't' }) }); },
    postWithRetry: async (url, body) => { request = { url, body }; return { data: {
        modelVersion: 'x', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 } } }; },
    sanitizeProxyErrorMessage: () => 'err', getSafeProviderError: () => ({}), console, REGION: 'us-central1', PROJECT_ID: 'p'
};
vm.createContext(ctx); vm.runInContext(helper + '\n' + handler, ctx);
async function call(body) {
    request = usage = vertexAuth = null;
    const res = { code: 200, status(n) { this.code = n; return this; }, json(d) { this.data = d; return this; } };
    await ctx.exports.callAIProxy({ body: { prompt: 'synthetic', isJson: true, ...body } }, res);
    return res;
}
(async () => {
    for (const [model, want] of [['gemini-3.5-flash', 'gemini-3.5-flash'], ['gemini-3.6-flash', 'gemini-3.6-flash'], ['gemini-pro', 'gemini-3.6-flash'], ['multimodal', 'gemini-3.5-flash'], ['', 'gemini-3.5-flash']]) {
        const r = await call({ provider: 'gemini', model });
        assert.equal(r.code, 200, model + ' served');
        assert.equal(request.url, `https://generativelanguage.googleapis.com/v1beta/models/${want}:generateContent?key=test-only`, model + ' → Gemini API');
        assert.equal(vertexAuth, null, model + ' never touches Vertex');
        assert.equal(usage[0], 'gemini-aistudio', model + ' recorded as gemini-aistudio');
        assert.equal(r.data.text, '{"ok":true}');
    }
    // vision data rides along as inlineData
    await call({ provider: 'gemini', model: 'gemini-3.5-flash', visionData: { image_base64: 'data:image/png;base64,QUJD', image_mimetype: 'image/png' } });
    assert.equal(JSON.stringify(request.body.contents[0].parts[1]), '{"inlineData":{"mimeType":"image/png","data":"QUJD"}}');
    // unchanged routes
    await call({ provider: 'gemini-aistudio', model: 'gemini-3.8-flash' }); assert.equal(usage[0], 'gemini-aistudio');
    await call({ provider: 'gemini', model: 'gemini-3.8-flash' }); assert.equal(usage[0], 'gemini', '3.8 trial keeps its provider tag');
    assert.match(request.url, /gemini-3\.8-flash:generateContent/);
    console.log('PASS: gemini 3.x (and legacy aliases) served via the Gemini API, recorded as gemini-aistudio, vision kept, 3.8 unchanged');
})().catch(e => { console.error(e); process.exitCode = 1; });
