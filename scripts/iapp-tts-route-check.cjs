// V102.636 (owner pick C+): callAIProxy's iapp_tts route — iApp Chinda TTS for the Thai voice of the 🎬 article clip.
// The real branch from functions/index.js runs in a vm with postWithRetry stubbed: the key goes only in the apikey header (secret IAPP_API_KEY),
// only the 3 voices / 8 styles / 1–1200 characters pass, MP3 comes back as base64; the route needs no prompt and is in the secrets list.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../functions/index.js'), 'utf8').replace(/\r/g, '');

assert.match(src, /exports\.callAIProxy = onRequest\(\{ cors: true, secrets: \[[^\]]*"IAPP_API_KEY"[^\]]*\]/, 'IAPP_API_KEY is one of callAIProxy\'s secrets');
assert.match(src, /provider !== "cloud_tts" && provider !== "iapp_tts" && provider !== "jev" && !prompt/, 'iapp_tts needs no prompt');
assert.ok(src.indexOf('if (!callerIsAdmin && provider !== "typhoon")') < src.indexOf('if (provider === "iapp_tts")'), 'the admin gate runs before the route');
const a = src.indexOf('        if (provider === "iapp_tts") {'), b = src.indexOf('\n        }\n', a) + 10;
const branch = src.slice(a, b);
assert.ok(a > 0 && /return res\.json/.test(branch));

const run = async (body, key = 'KEY-test', fail) => {
    const calls = [], out = {};
    const res = { status(c) { out.status = c; return res; }, json(p) { out.json = p; out.status = out.status || 200; return res; } };
    const ctx = { req: { body: Object.assign({ provider: 'iapp_tts' }, body) }, res, provider: 'iapp_tts', Buffer, String,
        process: { env: key ? { IAPP_API_KEY: key } : {} },
        postWithRetry: async (url, data, cfg) => { calls.push({ url, data, cfg }); if (fail) throw new Error('boom'); return { data: new Uint8Array(Buffer.from('ID3mp3')) }; } };
    vm.createContext(ctx);
    await vm.runInContext('(async () => {' + branch + '})()', ctx);
    return JSON.parse(JSON.stringify({ out, calls }));
};

(async () => {
    let r = await run({ text: ' สวัสดีครับ ', voice: 'kaimook', style: 'friendly' });
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, 'https://api.iapp.co.th/v3/store/audio/tts');
    assert.deepEqual(r.calls[0].data, { text: 'สวัสดีครับ', voice: 'kaimook', style: 'friendly', format: 'mp3' });
    assert.deepEqual([r.calls[0].cfg.headers.apikey, r.calls[0].cfg.responseType], ['KEY-test', 'arraybuffer']);
    assert.ok(!JSON.stringify(r.calls[0].data).includes('KEY-test'), 'the key is never in the body');
    assert.deepEqual(r.out.json, { audioContent: Buffer.from('ID3mp3').toString('base64'), mimeType: 'audio/mpeg', model: 'chinda-tts', provider: 'iapp_tts', usage: { characters: 10 } });
    assert.ok(!JSON.stringify(r.out.json).includes('KEY-test'), 'the key never goes back to the browser');

    r = await run({ text: 'ทดสอบ' });
    assert.deepEqual([r.calls[0].data.voice, r.calls[0].data.style], ['kaitom', 'neutral'], 'defaults');
    for (const [body, msg] of [[{ text: '' }, /1-1200/], [{ text: 'x'.repeat(1201) }, /1-1200/], [{ text: 'hi', voice: 'Kore' }, /voice/], [{ text: 'hi', style: 'angry' }, /style/]]) {
        r = await run(body);
        assert.deepEqual([r.out.status, r.calls.length], [400, 0]); assert.match(r.out.json.error, msg);
    }
    r = await run({ text: 'hi' }, '');
    assert.deepEqual([r.out.status, r.out.json.error, r.calls.length], [500, 'iApp key unavailable', 0]);
    await assert.rejects(run({ text: 'hi' }, 'KEY-test', true), /boom/, 'an iApp failure reaches the proxy\'s own error handler');
    console.log('PASS: iapp_tts route — admin-gated, IAPP_API_KEY in the apikey header only, 3 voices / 8 styles / 1–1200 chars, MP3 → base64, no key = 500');
})().catch(e => { console.error(e); process.exit(1); });
