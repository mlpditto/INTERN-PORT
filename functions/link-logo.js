'use strict';
// Find a shop logo for an Explore link: read the page, pick og:image / twitter:image / touch icon,
// download the first one that is a real raster image. Admin-only caller (fetchLinkLogo in index.js);
// the admin sees the result and approves it before anything is stored.
//
// The URL is admin-typed, but this is still a server-side fetch of an arbitrary URL, so it is
// SSRF-guarded: http(s) only, private / loopback / link-local / metadata addresses refused at CONNECT
// time (custom DNS lookup, so a DNS rebind cannot swap the address after a check), IP-literal hosts
// checked directly, redirects followed by hand (<= 3 hops, every hop re-checked), hard size and
// time caps. No cookies are sent.
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const axios = require('axios');

const UA = 'Mozilla/5.0 (compatible; INTERN-PORT-logo-fetch/1.0; +https://github.com/mlpditto/INTERN-PORT)';
const MAX_HTML = 1.5 * 1024 * 1024;
const MAX_IMAGE = 2.5 * 1024 * 1024;
const OK_IMAGE = /^image\/(jpeg|png|webp|gif)$/i;

function isPrivateIp(ip) {
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        if (v === '::1' || v === '::') return true;
        if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));   // IPv4-mapped
        if (/^f[cd]/.test(v)) return true;                              // fc00::/7 unique local
        if (/^fe[89ab]/.test(v)) return true;                           // fe80::/10 link-local
        return false;
    }
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255))) return true;
    const [a, b] = p;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

// Used as the agents' `lookup`: resolves, then refuses private answers, so the check and the
// connection use the very same address.
function guardedLookup(hostname, options, cb) {
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) return cb(err);
        const list = Array.isArray(address) ? address : [{ address, family }];
        if (list.some(a => isPrivateIp(a.address))) return cb(new Error('Blocked address'));
        return Array.isArray(address) ? cb(null, address) : cb(null, address, family);
    });
}
const httpAgent = new http.Agent({ lookup: guardedLookup });
const httpsAgent = new https.Agent({ lookup: guardedLookup });

function assertPublicUrl(raw) {
    let u;
    try { u = new URL(raw); } catch (e) { throw new Error('Not a valid URL'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) links are supported');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && isPrivateIp(host)) throw new Error('Blocked address');
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('Blocked address');
    return u;
}

// GET with manual redirects; returns { buf, type, url }. maxBytes aborts the download early.
async function getBytes(raw, maxBytes) {
    let current = raw;
    for (let hop = 0; hop <= 3; hop++) {
        const u = assertPublicUrl(current);
        const res = await axios.get(u.toString(), {
            responseType: 'arraybuffer', timeout: 10000, maxRedirects: 0, maxContentLength: maxBytes, maxBodyLength: maxBytes,
            validateStatus: () => true, httpAgent, httpsAgent, headers: { 'User-Agent': UA, Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.location) {
            current = new URL(res.headers.location, u).toString();
            continue;
        }
        if (res.status < 200 || res.status >= 300) throw new Error('The page answered ' + res.status);
        return { buf: Buffer.from(res.data), type: String(res.headers['content-type'] || '').split(';')[0].trim(), url: u.toString() };
    }
    throw new Error('Too many redirects');
}

function attr(tag, name) {
    const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
    return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : '';
}
const unescapeHtml = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Candidate image URLs in preference order, absolute.
function logoCandidates(html, pageUrl) {
    const out = [];
    const add = (src, source) => {
        const v = unescapeHtml(src).trim();
        if (!v || v.startsWith('data:')) return;
        try { out.push({ url: new URL(v, pageUrl).toString(), source }); } catch (e) { /* skip */ }
    };
    const metas = (html.match(/<meta\b[^>]*>/gi) || []).map(t => ({ key: (attr(t, 'property') || attr(t, 'name')).toLowerCase(), val: attr(t, 'content') }));
    for (const k of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
        metas.filter(m => m.key === k).forEach(m => add(m.val, k));
    }
    const links = (html.match(/<link\b[^>]*>/gi) || []).map(t => ({ rel: attr(t, 'rel').toLowerCase(), href: attr(t, 'href'), sizes: attr(t, 'sizes') }));
    const size = l => parseInt(String(l.sizes).split('x')[0], 10) || 0;
    links.filter(l => /apple-touch-icon/.test(l.rel)).sort((a, b) => size(b) - size(a)).forEach(l => add(l.href, 'apple-touch-icon'));
    links.filter(l => /\bicon\b/.test(l.rel) && !/apple/.test(l.rel) && /\.(png|jpe?g|webp)(\?|$)/i.test(l.href)).sort((a, b) => size(b) - size(a)).forEach(l => add(l.href, 'icon'));
    const seen = new Set();
    return out.filter(c => (seen.has(c.url) ? false : seen.add(c.url)));
}

async function findLinkLogo(rawUrl) {
    const page = await getBytes(String(rawUrl || ''), MAX_HTML);
    const html = page.buf.toString('utf8');
    const candidates = logoCandidates(html, page.url);
    const tried = [];
    for (const c of candidates.slice(0, 5)) {
        try {
            const img = await getBytes(c.url, MAX_IMAGE);
            if (!OK_IMAGE.test(img.type)) { tried.push(c.source + ': not a raster image'); continue; }
            if (img.buf.length < 200) { tried.push(c.source + ': too small'); continue; }
            return { found: true, source: c.source, from: c.url, contentType: img.type, bytes: img.buf.length, dataUrl: 'data:' + img.type + ';base64,' + img.buf.toString('base64') };
        } catch (e) {
            tried.push(c.source + ': ' + (e && e.message ? e.message : 'failed'));
        }
    }
    return { found: false, candidates: candidates.length, tried };
}

module.exports = { findLinkLogo, logoCandidates, isPrivateIp, assertPublicUrl };
