// V102.712 (owner pick B): callAIProxy's iapp_ocr route — iApp OpenThai OCR Markdown for the Drug Codex 📄 leaflet reader.
// The real branch from functions/index.js runs in a vm with axios stubbed: admin-gated, the key only in the apikey header (IAPP_API_KEY),
// the file goes as multipart "file" with its own type, only PDF / JPEG / PNG / WebP under 7 MB pass, only the Markdown + page count come back,
// iApp errors become readable messages (4xx → 400, the rest → 502), and the route needs no prompt.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../functions/index.js'), 'utf8').replace(/\r/g, '');

assert.match(src, /provider !== "iapp_ocr" && provider !== "paxa_tts" && provider !== "jev" && !prompt/, 'iapp_ocr needs no prompt');
assert.ok(src.indexOf('if (!callerIsAdmin && provider !== "typhoon")') < src.indexOf('if (provider === "iapp_ocr")'), 'the admin gate runs before the route');
const a = src.indexOf('        if (provider === "iapp_ocr") {'), b = src.indexOf('\n        }\n', a) + 10;
const branch = src.slice(a, b);
assert.ok(a > 0 && /return res\.json/.test(branch));
new vm.Script('(async () => {' + branch + '})', { filename: 'iapp_ocr-branch.js' });   // the branch parses

const run = async (body, key = 'KEY-test', reply) => {
    const calls = [], out = {};
    const res = { status(c) { out.status = c; return res; }, json(p) { out.json = p; out.status = out.status || 200; return res; } };
    const ctx = { req: { body: Object.assign({ provider: 'iapp_ocr' }, body) }, res, provider: 'iapp_ocr', Buffer, String, Number, Array, FormData, Blob,
        process: { env: key ? { IAPP_API_KEY: key } : {} },
        axios: { post: async (url, form, cfg) => {
            const f = form.get('file'); calls.push({ url, cfg, name: f && f.name, type: f && f.type, bytes: f ? Buffer.from(await f.arrayBuffer()).toString() : '' });
            if (reply instanceof Error) throw reply;
            return { data: reply || { markdown: '## ข้อบ่งใช้\nบรรเทาปวด', pages: [{ page: 1 }], version: 'v2.2', iapp: { page: 1, char: 20 } } };
        } } };
    vm.createContext(ctx);
    await vm.runInContext('(async () => {' + branch + '})()', ctx);
    return JSON.parse(JSON.stringify({ out, calls }));
};
const b64 = s => Buffer.from(s).toString('base64');

(async () => {
    let r = await run({ fileBase64: b64('%PDF-1.4 leaflet'), mimeType: 'application/pdf' });
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, 'https://api.iapp.co.th/v3/store/ocr/document/markdown');
    assert.deepEqual([r.calls[0].cfg.headers.apikey, r.calls[0].name, r.calls[0].type, r.calls[0].bytes], ['KEY-test', 'leaflet.pdf', 'application/pdf', '%PDF-1.4 leaflet'], 'multipart "file", its own type, the bytes as sent');
    assert.deepEqual(r.out.json, { markdown: '## ข้อบ่งใช้\nบรรเทาปวด', pages: 1, version: 'v2.2', model: 'openthai-ocr-markdown', provider: 'iapp_ocr', usage: { pages: 1 } });
    assert.ok(!JSON.stringify(r.out).includes('KEY-test'), 'the key never goes back to the browser');

    r = await run({ fileBase64: b64('jpg'), mimeType: 'image/jpeg' });
    assert.deepEqual([r.calls[0].name, r.calls[0].type], ['leaflet.jpg', 'image/jpeg'], 'a photo goes as a photo');
    for (const [body, msg] of [[{ fileBase64: b64('x'), mimeType: 'text/html' }, /PDF, JPEG, PNG or WebP/], [{ fileBase64: '', mimeType: 'application/pdf' }, /7 MB/], [{ fileBase64: 'A'.repeat(9600001), mimeType: 'application/pdf' }, /7 MB/]]) {
        r = await run(body);
        assert.deepEqual([r.out.status, r.calls.length], [400, 0]); assert.match(r.out.json.error, msg);
    }
    r = await run({ fileBase64: b64('x'), mimeType: 'application/pdf' }, '');
    assert.deepEqual([r.out.status, r.out.json.error, r.calls.length], [500, 'iApp key unavailable', 0]);
    const err = st => Object.assign(new Error('iapp ' + st), { response: { status: st } });
    r = await run({ fileBase64: b64('x'), mimeType: 'application/pdf' }, 'KEY-test', err(422));
    assert.deepEqual([r.out.status, r.out.json.error], [400, 'iApp could not read any page of this file']);
    r = await run({ fileBase64: b64('x'), mimeType: 'application/pdf' }, 'KEY-test', err(503));
    assert.deepEqual([r.out.status, r.out.json.error], [502, 'iApp is busy — try again in a minute']);
    r = await run({ fileBase64: b64('x'), mimeType: 'application/pdf' }, 'KEY-test', new Error('socket hang up'));
    assert.deepEqual([r.out.status, r.out.json.error], [502, 'iApp OCR failed']);
    console.log('PASS: iapp_ocr route — admin-gated, IAPP_API_KEY in the apikey header only, multipart file, PDF/JPEG/PNG/WebP ≤ 7 MB, Markdown + pages back, readable iApp errors');
})().catch(e => { console.error(e); process.exit(1); });
