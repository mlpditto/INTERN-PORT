// findShopLogo: ONE cheap web-search call picks the shop's official page → the guarded fetcher reads its picture → the page title is compared with the shop name.
// Offline, injected fetch + findLogo.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const s = require('../functions/shop-logo-search.js');
const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const lite = fs.readFileSync(path.join(__dirname, '..', 'functions', 'link-logo.js'), 'utf8');

// ---- acceptPage: a shop's own page only
const acc = u => { const r = s.acceptPage(u); return r && r.site + ' ' + r.url; };
assert.strictEqual(acc('https://m.facebook.com/chatramue/'), 'facebook https://www.facebook.com/chatramue/', 'mobile host → www, path kept');
assert.strictEqual(acc('https://facebook.com/112638931623884'), 'facebook https://www.facebook.com/112638931623884');
assert.strictEqual(acc('https://www.facebook.com/share/17JE9x7cqb/?mibextid=x'), 'facebook https://www.facebook.com/share/17JE9x7cqb/', 'tracking query dropped');
assert.strictEqual(acc('https://www.cha-thai.com/'), 'website https://www.cha-thai.com/');
assert.strictEqual(acc('https://www.kfc.co.th'), 'website https://www.kfc.co.th/');
for (const bad of ['https://www.facebook.com/chatramue/posts/123', 'https://www.facebook.com/groups/foodlovers', 'https://www.wongnai.com/chains/chatramue', 'https://exa.ai/library/place/x',
    'https://intravel.net/bangkok/x', 'https://www.google.com/maps/x', 'https://www.openrice.com/en/bangkok/r-x', 'https://shop.line.me/@x', 'https://www.instagram.com/x', 'ftp://x.com/a', 'javascript:alert(1)', 'not a url', '', null, 'http://127.0.0.1/x', 'https://localhost/x'])
    assert.strictEqual(s.acceptPage(bad), null, 'refused: ' + bad);

// ---- nameMatches
assert.ok(s.nameMatches('ชาตรามือ', 'ชาตรามือ | Cha Tra Mue'), 'whole Thai name');
assert.ok(s.nameMatches('Captains Corner Burgers', 'Captains Corner Burgers & Kebabs - Home'), 'whole English name, case / spaces ignored');
assert.ok(s.nameMatches('SOOS\'s เส้นหมี่ไก่ฉีก', 'SOOS Thai chicken noodle'), 'longest word ≥ 4 letters');
assert.ok(!s.nameMatches('Emily', 'Facebook'), 'a generic title does not match');
assert.ok(!s.nameMatches('PRE&PRO PnP', 'ครัว P&P'), 'a different shop does not match');
assert.ok(!s.nameMatches('Solsot', ''));

// ---- end to end with fakes
const mkFetch = (answer, log) => async (url, opts) => {
    const body = JSON.parse(opts.body);
    log.push({ url, auth: opts.headers.Authorization, body });
    if (Array.isArray(body.messages[0].content)) {   // the picture check (vision call)
        if (answer.kindStatus) return { ok: false, status: answer.kindStatus, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ kind: answer.kind || 'logo' }) } }], usage: { cost: 0.0005 } }) };
    }
    if (answer.status) return { ok: false, status: answer.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: answer.content, annotations: (answer.cited || []).map(u => ({ type: 'url_citation', url_citation: { url: u } })) } }], usage: { cost: 0.007, total_tokens: 900 } }) };
};
const logoOk = (title, desc) => async () => ({ found: true, source: 'og:image', contentType: 'image/png', bytes: 5000, dataUrl: 'data:image/png;base64,AAAA', pageTitle: title, pageDescription: desc });
(async () => {
    const log = [];
    const r = await s.findShopLogo('ชาตรามือ', { apiKey: 'SECRET', fetch: mkFetch({ content: '{"official":"https://www.cha-thai.com/"}', cited: ['a', 'b'] }, log), findLogo: logoOk('ชาตรามือ - ChaTraMue', '') });
    assert.ok(r.found && r.verified && r.site === 'website' && r.pageUrl === 'https://www.cha-thai.com/' && r.dataUrl.startsWith('data:image/'), JSON.stringify(r).slice(0, 240));
    assert.strictEqual(log.length, 2, 'ONE search call + ONE picture check per shop');
    assert.ok(r.kind === 'logo' && Array.isArray(log[1].body.messages[0].content) && log[1].body.messages[0].content[1].image_url.url.startsWith('data:image/'), 'the fetched picture is checked: logo / people / food');
    const b = log[0].body;
    assert.ok(log[0].url === 'https://openrouter.ai/api/v1/chat/completions' && log[0].auth === 'Bearer SECRET' && b.model === s.SEARCH_MODEL && b.plugins[0].id === 'web' && b.max_tokens <= 120 && b.response_format.type === 'json_object', 'cheap model + web plugin + JSON, tiny output');
    assert.ok(b.messages[0].content.includes('"ชาตรามือ"') && /OFFICIAL/.test(b.messages[0].content));
    assert.ok(Math.abs(r.cost - 0.0075) < 1e-9 && r.searched === 2, 'cost = search + picture check: ' + r.cost);
    assert.ok(!JSON.stringify(r).includes('SECRET'));

    // a page that is NOT the shop → still returned (the admin decides) but verified:false
    const r2 = await s.findShopLogo('Emily', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://www.facebook.com/someoneelse"}' }, []), findLogo: logoOk('Facebook', 'Log in') });
    assert.ok(r2.found && r2.verified === false && r2.site === 'facebook');

    // a picture of PEOPLE is never offered; food / other are labelled; a failing picture check does not block
    const rp = await s.findShopLogo('Captains Corner Burgers', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://www.facebook.com/captains"}', kind: 'people' }, []), findLogo: logoOk('Captains Corner Burgers And Kebabs', '') });
    assert.ok(!rp.found && /shows people/.test(rp.reason) && rp.verified === true && !('dataUrl' in rp), JSON.stringify(rp).slice(0, 200));
    const rf = await s.findShopLogo('Afterchoc', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://www.facebook.com/a"}', kind: 'food' }, []), findLogo: logoOk('Afterchoc', '') });
    assert.ok(rf.found && rf.kind === 'food');
    const ru = await s.findShopLogo('Afterchoc', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://www.facebook.com/a"}', kindStatus: 500 }, []), findLogo: logoOk('Afterchoc', '') });
    assert.ok(ru.found && ru.kind === 'unknown', 'a failing picture check leaves it for the admin to judge');

    // refused / missing official pages never reach the fetcher
    let reads = 0;
    const noRead = async () => { reads++; return { found: true }; };
    const r3 = await s.findShopLogo('X', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://www.wongnai.com/chains/x"}' }, []), findLogo: noRead });
    assert.ok(!r3.found && /not a shop page/.test(r3.reason) && reads === 0);
    const r4 = await s.findShopLogo('X', { apiKey: 'k', fetch: mkFetch({ content: '{"official":null}' }, []), findLogo: noRead });
    assert.ok(!r4.found && /no official page/.test(r4.reason) && reads === 0);
    const r5 = await s.findShopLogo('X', { apiKey: 'k', fetch: mkFetch({ content: 'I could not find it, sorry' }, []), findLogo: noRead });
    assert.ok(!r5.found && reads === 0, 'prose instead of JSON = not found, no throw');

    // fetcher failures / no picture are reported
    const r6 = await s.findShopLogo('X', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://x-shop.com/"}' }, []), findLogo: async () => { throw new Error('The page answered 403'); } });
    assert.ok(!r6.found && /403/.test(r6.reason) && r6.pageUrl === 'https://x-shop.com/');
    const r7 = await s.findShopLogo('X', { apiKey: 'k', fetch: mkFetch({ content: '{"official":"https://x-shop.com/"}' }, []), findLogo: async () => ({ found: false, pageTitle: 'X shop' }) });
    assert.ok(!r7.found && /no usable picture/.test(r7.reason) && r7.verified === true);

    // search HTTP error → throws (the callable turns it into an error row); empty title refused; names cleaned
    await assert.rejects(() => s.findShopLogo('X', { apiKey: 'k', fetch: mkFetch({ status: 429 }, []), findLogo: noRead }), /search HTTP 429/);
    await assert.rejects(() => s.findShopLogo('   ', { apiKey: 'k', fetch: mkFetch({ content: '{}' }, []), findLogo: noRead }), /title is required/);
    const log8 = [];
    await s.findShopLogo('Evil "name"\n<script>', { apiKey: 'k', fetch: mkFetch({ content: '{"official":null}' }, log8), findLogo: noRead });
    assert.ok(!/"name"|<script>|\n"/.test(log8[0].body.messages[0].content.split('Thai shop')[1].slice(0, 40)), 'the name is cleaned before it reaches the prompt');

    // wiring
    const fn = idx.slice(idx.indexOf('exports.findShopLogo'));
    assert.ok(/exports\.findShopLogo = onCall\(\{ secrets: \['OPENROUTER_API_KEY'\]/.test(idx), 'declares the OpenRouter secret');
    assert.ok(fn.indexOf('requireAdminCallable(request)') > 0 && fn.indexOf('requireAdminCallable(request)') < fn.indexOf('search.findShopLogo'), 'admin gate before any call');
    assert.ok(/findLogo: require\('\.\/link-logo'\)\.findLinkLogo/.test(fn), 'pictures are read only by the SSRF-guarded fetcher');
    assert.ok(/pageIdentity/.test(lite) && /pageTitle: identity\.title/.test(lite), 'link-logo returns the page identity');
    console.log('PASS: shop-logo-search — one search call, official page only, guarded picture read, name check, refusals, admin-only wiring');
})().catch(e => { console.error(e); process.exit(1); });
