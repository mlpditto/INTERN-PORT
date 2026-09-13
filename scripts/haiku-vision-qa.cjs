const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const backend = fs.readFileSync('functions/index.js', 'utf8');
const start = backend.indexOf('exports.callAIProxy =');
let request, admin = true;
const context = {
    exports: {}, onRequest: (_, fn) => fn, aiModelRegistry: { models: [] },
    process: { env: { ANTHROPIC_API_KEY: 'test' } },
    postWithRetry: async (url, body) => { request = body; return { data: { content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 2, output_tokens: 3 } } }; },
    recordAiUsage() {}, verifyIdTokenFromHeader: async () => ({}), isAdminToken: () => admin,
    console, sanitizeProxyErrorMessage: e => e, getSafeProviderError: () => ({})
};
vm.createContext(context);
vm.runInContext(backend.slice(start, backend.indexOf('\n});', start) + 4), context);
(async () => {
    const call = async visionData => {
        const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
        await context.exports.callAIProxy({ body: { provider: 'anthropic', model: 'claude-haiku-4-5', prompt: 'Read image', isJson: true, visionData } }, res);
        return res;
    };
    for (const vision of [{ image_base64: 'data:image/png;base64,YWJj', image_mimetype: 'image/png' }, { base64: 'YWJj', mimeType: 'image/jpeg' }]) {
        const res = await call(vision);
        assert(!res.data.error, JSON.stringify(res.data));
        assert.equal(request.model, 'claude-haiku-4-5');
        assert.equal(request.messages[0].content[1].source.data, 'YWJj');
        assert.equal(request.messages[0].content[1].source.media_type, vision.image_mimetype || vision.mimeType);
    }
    await call(null); assert.equal(typeof request.messages[0].content, 'string');
    admin = false; assert.equal((await call(null)).code, 403);
    console.log('PASS: Haiku forwards both image payload shapes, strips data URL, preserves text and denies non-admin access');
})().catch(error => { console.error(error); process.exitCode = 1; });
