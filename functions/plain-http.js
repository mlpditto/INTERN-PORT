// No Brotli for pages the admin points us at.
//
// CVE-2026-111497 (the October 2026 "Node2Shell" release) is an out-of-bounds write in the Brotli
// decoder bundled with Node, reached whenever a response body with `content-encoding: br` is
// decompressed. axios does that automatically, and the two link readers (fetchLinkText, the
// link-logo fetcher behind fetchLinkLogo and the shop-logo search) download whatever URL the admin
// typed, so a hostile site could answer with a crafted br body. The Cloud Run base image is patched
// by Google, but these readers never needed compression in the first place:
//   - ask for `identity` and tell axios not to decompress anything (PLAIN),
//   - unpack only gzip / deflate ourselves with zlib (not Brotli), with an output cap,
//   - refuse any other encoding instead of handing bytes to a decoder.
'use strict';
const zlib = require('zlib');

// Spread into the axios options of a reader that fetches an admin-typed URL.
const PLAIN = { decompress: false, headers: { 'Accept-Encoding': 'identity' } };

// The decoded body as a Buffer. `maxBytes` caps the unpacked size (a gzip bomb stays small on the
// wire, so the download cap alone does not protect memory).
function plainBody(res, maxBytes) {
    const enc = String((res.headers && res.headers['content-encoding']) || '').toLowerCase().trim();
    const buf = Buffer.from(res.data || []);
    const opt = { maxOutputLength: maxBytes || 3 * 1024 * 1024 };
    if (!enc || enc === 'identity') return buf;
    if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(buf, opt);
    if (enc === 'deflate') { try { return zlib.inflateSync(buf, opt); } catch (e) { return zlib.inflateRawSync(buf, opt); } }
    const e = new Error('The site answered with ' + enc + ' compression, which this reader does not accept.');
    e.code = 'ENCODING_REFUSED';
    throw e;
}

module.exports = { PLAIN, plainBody };
