// The two admin link readers never decode Brotli (CVE-2026-111497, Node.js October 2026).
// 1) functions/plain-http.js: identity + decompress:false, gzip/deflate unpacked by zlib with an output cap, br refused.
// 2) Both axios call sites (fetchLinkText in functions/index.js, getBytes in functions/link-logo.js) carry the
//    PLAIN options and hand the body to plainBody — checked on the source, so a refactor cannot quietly drop it.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

const fn = path.join(__dirname, '..', 'functions');
const { PLAIN, plainBody } = require(path.join(fn, 'plain-http.js'));

assert.deepEqual(PLAIN, { decompress: false, headers: { 'Accept-Encoding': 'identity' } }, 'PLAIN = no auto-decompress + identity');

const text = Buffer.from('<html><title>t</title><p>hello</p></html>');
const res = (enc, data) => ({ headers: enc ? { 'content-encoding': enc } : {}, data });
assert.equal(plainBody(res('', text)).toString(), text.toString(), 'no encoding → bytes as they came');
assert.equal(plainBody(res('identity', text)).toString(), text.toString(), 'identity → as they came');
assert.equal(plainBody(res('gzip', zlib.gzipSync(text))).toString(), text.toString(), 'gzip unpacked by zlib');
assert.equal(plainBody(res('x-gzip', zlib.gzipSync(text))).toString(), text.toString(), 'x-gzip unpacked');
assert.equal(plainBody(res('deflate', zlib.deflateSync(text))).toString(), text.toString(), 'deflate (zlib-wrapped) unpacked');
assert.equal(plainBody(res('deflate', zlib.deflateRawSync(text))).toString(), text.toString(), 'deflate (raw, as some servers send) unpacked');
assert.equal(plainBody(res('GZIP ', zlib.gzipSync(text))).toString(), text.toString(), 'encoding name is trimmed and case-folded');
assert.ok(Buffer.isBuffer(plainBody(res('', new Uint8Array(text)))), 'an arraybuffer/typed array comes back as a Buffer');

assert.throws(() => plainBody(res('br', zlib.brotliCompressSync(text))), e => e.code === 'ENCODING_REFUSED' && /br compression/.test(e.message), 'br is refused, never decoded');
assert.throws(() => plainBody(res('zstd', text)), e => e.code === 'ENCODING_REFUSED', 'any other encoding is refused');
const bomb = zlib.gzipSync(Buffer.alloc(200000, 97));   // 200 kB of "a" → a few hundred bytes gzipped
assert.throws(() => plainBody(res('gzip', bomb), 100000), e => e.code === 'ERR_BUFFER_TOO_LARGE', 'unpacked size is capped by maxBytes (gzip bomb)');
assert.equal(plainBody(res('gzip', bomb), 300000).length, 200000, 'under the cap it unpacks fully');

const idx = fs.readFileSync(path.join(fn, 'index.js'), 'utf8');
const logo = fs.readFileSync(path.join(fn, 'link-logo.js'), 'utf8');
const a = idx.indexOf('exports.fetchLinkText = '), b = idx.indexOf('\n});', a);
const flt = idx.slice(a, b);
assert.ok(/decompress: PLAIN\.decompress/.test(flt) && /\.\.\.PLAIN\.headers/.test(flt), 'fetchLinkText: axios gets PLAIN (decompress:false + identity)');
assert.ok(/plainBody\(resp, 3 \* 1024 \* 1024\)/.test(flt), 'fetchLinkText: the body goes through plainBody with the 3 MB cap');
assert.ok(/ENCODING_REFUSED/.test(flt), 'fetchLinkText: a refused encoding is reported to the admin (415), not a bare 502');
assert.ok(/require\("\.\/plain-http"\)/.test(idx), 'index.js requires plain-http');
const g = logo.indexOf('async function getBytes('), h = logo.indexOf('\n}', g);
const gb = logo.slice(g, h);
assert.ok(/decompress: PLAIN\.decompress/.test(gb) && /\.\.\.PLAIN\.headers/.test(gb), 'link-logo getBytes: axios gets PLAIN');
assert.ok(/buf: plainBody\(res, maxBytes\)/.test(gb), 'link-logo getBytes: the body goes through plainBody with its byte cap');
assert.ok(!/Buffer\.from\(res\.data\)/.test(gb), 'link-logo getBytes: no raw res.data left');

console.log('PASS: plain-http — admin link readers never decode Brotli: identity + decompress:false at both axios call sites, gzip/deflate via zlib with an output cap, br/zstd refused (ENCODING_REFUSED → 415 in fetchLinkText)');
