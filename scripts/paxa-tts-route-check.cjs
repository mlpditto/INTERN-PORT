// V102.674 (owner pick A, mockup-watch-first-paxa/): callAIProxy's paxa_tts route — Paxa Labs TTS, the optional third voice of a 🎬 Watch first story.
// The real branch from the functions source runs in a vm with postWithRetry stubbed: the key goes only in the Authorization header (secret PAXA_API_KEY),
// the model is fixed (paxa-tts-flash-v2), the voice must look like a Paxa voice id, 1–1200 characters, MP3 comes back as base64 with the credits charged;
// the route needs no prompt, sits behind the admin gate and is in the secrets list.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r/g, '');

assert.match(src, /exports\.callAIProxy = onRequest\(\{ cors: true, secrets: \[[^\]]*"PAXA_API_KEY"[^\]]*\]/, 'PAXA_API_KEY is one of callAIProxy\'s secrets');
assert.match(src, /provider !== "paxa_tts" && provider !== "jev" && !prompt/, 'paxa_tts needs no prompt');
assert.ok(src.indexOf('if (!callerIsAdmin && provider !== "typhoon")') < src.indexOf('if (provider === "paxa_tts")'), 'the admin gate runs before the route');
const a = src.indexOf('        if (provider === "paxa_tts") {'), b = src.indexOf('\n        }\n', a) + 10;
const branch = src.slice(a, b);
assert.ok(a > 0 && /return res\.json/.test(branch));

const run = async (body, key = 'KEY-test', fail, headers = { 'x-credits-charged': '0.42' }) => {
    const calls = [], out = {};
    const res = { status(c) { out.status = c; return res; }, json(p) { out.json = p; out.status = out.status || 200; return res; } };
    const ctx = { req: { body: Object.assign({ provider: 'paxa_tts' }, body) }, res, provider: 'paxa_tts', Buffer, String, Number,
        process: { env: key ? { PAXA_API_KEY: key } : {} },
        postWithRetry: async (url, data, cfg) => { calls.push({ url, data, cfg }); if (fail) throw new Error('boom'); return { data: new Uint8Array(Buffer.from('ID3mp3')), headers }; } };
    vm.createContext(ctx);
    await vm.runInContext('(async () => {' + branch + '})()', ctx);
    return JSON.parse(JSON.stringify({ out, calls }));
};

(async () => {
    let r = await run({ text: ' เริ่มจากคำถามแรก ', voice: 'KhanomKrok' });
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, 'https://api.paxalabs.com/v1/tts');
    assert.deepEqual(r.calls[0].data, { text: 'เริ่มจากคำถามแรก', voice: 'khanomkrok', model: 'paxa-tts-flash-v2', format: 'mp3' }, 'trimmed text, lower-case voice id, the fixed model, MP3');
    assert.deepEqual([r.calls[0].cfg.headers.Authorization, r.calls[0].cfg.responseType], ['Bearer KEY-test', 'arraybuffer']);
    assert.ok(!JSON.stringify(r.calls[0].data).includes('KEY-test'), 'the key is never in the body');
    assert.deepEqual(r.out.json, { audioContent: Buffer.from('ID3mp3').toString('base64'), mimeType: 'audio/mpeg', model: 'paxa-tts-flash-v2', provider: 'paxa_tts', usage: { characters: 16, credits: 0.42 } });
    assert.ok(!JSON.stringify(r.out.json).includes('KEY-test'), 'the key never goes back to the browser');

    r = await run({ text: 'hi', voice: 'nomyen' }, 'KEY-test', false, {});
    assert.equal(r.out.json.usage.credits, null, 'no credits header → null, not NaN');
    for (const [body, msg] of [[{ text: '', voice: 'nomyen' }, /1-1200/], [{ text: 'x'.repeat(1201), voice: 'nomyen' }, /1-1200/], [{ text: 'hi' }, /voice/], [{ text: 'hi', voice: 'no/such voice' }, /voice/], [{ text: 'hi', voice: 'x'.repeat(61) }, /voice/]]) {
        r = await run(body);
        assert.deepEqual([r.out.status, r.calls.length], [400, 0]); assert.match(r.out.json.error, msg);
    }
    r = await run({ text: 'hi', voice: 'nomyen' }, '');
    assert.deepEqual([r.out.status, r.out.json.error, r.calls.length], [500, 'Paxa key unavailable', 0]);
    await assert.rejects(run({ text: 'hi', voice: 'nomyen' }, 'KEY-test', true), /boom/, 'a Paxa failure reaches the proxy\'s own error handler');
    console.log('PASS: paxa_tts route — admin-gated, PAXA_API_KEY as a Bearer header only, fixed model, voice id shape, 1–1200 chars, MP3 → base64 + credits, no key = 500');
})().catch(e => { console.error(e); process.exit(1); });
