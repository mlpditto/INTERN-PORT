'use strict';
// Find a shop's logo when its LINE MAN page has none. ONE cheap call (Gemma + OpenRouter's web-search plugin, ≈ $0.007) is asked which result is the
// shop's OFFICIAL Facebook page / own website; the picture is then read from THAT page by the SSRF-guarded fetcher in link-logo.js (the model never
// supplies an image address), and the page's own title is compared with the shop name so the admin can see whether it is really the same shop.
// Admin-only; nothing is stored until the admin ticks it.
// Probed 2026-10-15 (memory project_shop_logo_search): Muse Spark's own agentic search cost $0.07–$0.155 and 17–33 s per shop with poor results; the web
// plugin never returns Facebook pages by itself and Wongnai pages give food photos / Wongnai's own banner, so only the page the model picks as official is read.
const SEARCH_MODEL = 'google/gemma-4-26b-a4b-it';

const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f"<>\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

// Pages whose picture is a LOGO of the shop: its Facebook page or its own site. Directories / review / delivery / map / news hosts are refused,
// and so are Facebook posts, groups, photos and share-less deep links.
const REFUSED_HOST = /(^|\.)(wongnai|google|yandex|openrice|tripadvisor|trip|grab|foodpanda|lineman|line|shopee|lazada|youtube|instagram|twitter|x|tiktok|linkedin|threads|wikipedia|exa|globuya|directmap|restaurants10|intravel|aseannow|bangkokpost|mgronline|topnews|thailandtv|franzbiz|centralpattana|cpn|eatingoutmap|motdang|foodcovery)\.[a-z.]+$/i;
function acceptPage(raw) {
    let u; try { u = new URL(String(raw || '')); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^www\.|^m\./i, '').toLowerCase();
    if (!host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.me') {
        const p = u.pathname.replace(/\/+$/, '');
        if (/\/(posts|photos?|videos?|reels?|groups|events|watch|marketplace|login|permalink)(\/|$)/i.test(p)) return null;
        return { url: 'https://www.facebook.com' + (u.pathname === '/' ? '' : u.pathname) + (/^\/profile\.php$/.test(u.pathname) ? u.search : ''), site: 'facebook' };
    }
    if (REFUSED_HOST.test(host)) return null;
    return { url: u.protocol + '//' + u.hostname + (u.pathname === '/' ? '/' : u.pathname), site: 'website' };
}

// Does the page call itself by (a word of) the shop's name? Both sides are lower-cased with punctuation / spaces removed; Thai has no spaces, so a name
// matches when the whole name, or its longest word of ≥ 4 letters, appears in the page title + description.
function nameMatches(shop, ...texts) {
    const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const hay = norm(texts.join(' '));
    if (!hay) return false;
    const whole = norm(shop);
    if (whole && hay.includes(whole)) return true;
    const words = String(shop || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).map(norm).filter(w => w.length >= 4).sort((a, b) => b.length - a.length);
    return words.length > 0 && hay.includes(words[0]);
}

async function askOfficial(name, deps) {
    const q = 'Which URL is the OFFICIAL Facebook page or the shop\'s OWN website (not a directory, review site, delivery app, news or map listing) of the Thai shop "' + name + '" (restaurant / cafe / drinks, ordered via LINE MAN, mostly Bangkok)? Pick only from the search results you were given. Reply with JSON only: {"official":"https://…"} or {"official":null} if none of the results is clearly the shop\'s own page.';
    const res = await deps.fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + deps.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: SEARCH_MODEL, messages: [{ role: 'user', content: q }], plugins: [{ id: 'web', max_results: 6, search_prompt: name + ' ร้าน official website facebook' }], max_tokens: 120, temperature: 0, response_format: { type: 'json_object' } }),
    });
    if (!res.ok) throw new Error('search HTTP ' + res.status);
    const j = await res.json();
    const msg = j && j.choices && j.choices[0] && j.choices[0].message;
    let official = null;
    try { const m = String((msg && msg.content) || '').match(/\{[\s\S]*\}/); official = m ? JSON.parse(m[0]).official : null; } catch (e) { official = null; }
    const cited = ((msg && msg.annotations) || []).map(a => a && a.url_citation && a.url_citation.url).filter(u => typeof u === 'string');
    return { official: typeof official === 'string' ? official : null, cited, cost: Number(j && j.usage && j.usage.cost) || 0, tokens: Number(j && j.usage && j.usage.total_tokens) || 0 };
}

// One tiny vision call on the picture we fetched: a LOGO / brand mark, a photo of PEOPLE, FOOD or something else. A page's picture is often the owner's own
// photo (probed: a family photo came back for a shop with a verified name), so a picture of people is never offered; the rest is labelled for the admin.
async function classifyPicture(dataUrl, deps) {
    try {
        const res = await deps.fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + deps.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: SEARCH_MODEL, messages: [{ role: 'user', content: [{ type: 'text', text: 'What is this picture? Reply with JSON only: {"kind":"logo"} for a logo / brand mark / shop sign, {"kind":"people"} if it shows people or a face, {"kind":"food"} for food or drinks, {"kind":"other"} otherwise.' }, { type: 'image_url', image_url: { url: dataUrl } }] }], max_tokens: 30, temperature: 0, response_format: { type: 'json_object' } }),
        });
        if (!res.ok) return { kind: 'unknown', cost: 0 };
        const j = await res.json();
        const m = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').match(/\{[\s\S]*\}/);
        const kind = m ? String(JSON.parse(m[0]).kind || '') : '';
        return { kind: ['logo', 'people', 'food', 'other'].includes(kind) ? kind : 'unknown', cost: Number(j && j.usage && j.usage.cost) || 0 };
    } catch (e) { return { kind: 'unknown', cost: 0 }; }
}

// deps: { apiKey, fetch, findLogo(url) → link-logo result }.
// → { found, pageUrl, site, pageTitle, verified, source, contentType, bytes, dataUrl, cost, tokens } | { found:false, reason, … }
async function findShopLogo(title, deps) {
    const name = clean(title);
    if (!name) throw new Error('title is required');
    const a = await askOfficial(name, deps);
    const page = acceptPage(a.official);
    const base = { cost: a.cost, tokens: a.tokens, searched: a.cited.length };
    if (!page) return { found: false, reason: a.official ? 'the page it picked is not a shop page' : 'no official page found', ...base };
    let r;
    try { r = await deps.findLogo(page.url); }
    catch (e) { return { found: false, reason: (e && e.message) || 'could not read the page', pageUrl: page.url, site: page.site, ...base }; }
    const pageTitle = (r && r.pageTitle) || '';
    const verified = nameMatches(name, pageTitle, r && r.pageDescription);
    if (!r || !r.found) return { found: false, reason: 'no usable picture on that page', pageUrl: page.url, site: page.site, pageTitle, verified, ...base };
    const c = await classifyPicture(r.dataUrl, deps);
    base.cost += c.cost;
    if (c.kind === 'people') return { found: false, reason: 'the picture on that page shows people, not a logo', pageUrl: page.url, site: page.site, pageTitle, verified, ...base };
    return { found: true, pageUrl: page.url, site: page.site, pageTitle, verified, kind: c.kind, source: r.source, contentType: r.contentType, bytes: r.bytes, dataUrl: r.dataUrl, ...base };
}

module.exports = { findShopLogo, acceptPage, nameMatches, askOfficial, classifyPicture, SEARCH_MODEL };
