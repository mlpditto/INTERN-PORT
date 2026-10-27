// Jev suggests an Explore shop's category: one Choice question per shop, page identity added when readable, failures isolated, suggest-only wiring.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const sc = require('../functions/shop-category.js');
const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const adm = fs.existsSync(path.join(__dirname, '..', 'public', 'admin.html')) ? fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8') : '';

// the seven categories are the ones the intern tiles and the admin chips know
const keysAdm = [...adm.match(/const RL_CATEGORIES = \[(.*)\];/)[1].matchAll(/\['(\w+)'/g)].map(m => m[1]);
assert.deepStrictEqual([...sc.KEYS].sort(), [...keysAdm].sort(), 'categories = admin RL_CATEGORIES');

const log = [];
const mkFetch = (answerFor) => async (url, opts) => {
    const body = JSON.parse(opts.body);
    log.push({ url, auth: opts.headers.Authorization, body });
    const a = answerFor(body.state);
    if (a.status) return { ok: false, status: a.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ model: 'typesafe/jev-1.14', answers: { category: a.answer }, usage: { input_tokens: 500, cost: 0.00002 } }) };
};
const ans = (choice, probs, conf) => ({ answer: { type: 'choice', choice, probabilities: probs, confidence: conf } });

(async () => {
    const shops = [{ id: 'a', title: 'สุกี้แห้ง 100 ปี', url: 'https://lin.ee/a' }, { id: 'b', title: 'Emily', url: 'https://lin.ee/b' }, { id: 'c', title: 'Boom', url: '' }, { id: 'd', title: '', url: '' }, { id: 'e', title: 'Weird', url: '' }];
    const deps = {
        apiKey: 'SECRET', provider: 'openrouter',
        fetch: mkFetch(st => (st.shop_name === 'สุกี้แห้ง 100 ปี' ? ans('noodle', { noodle: 1, rice: 0, meat: 0, sweet: 0, drink: 0, health: 0, fast: 0 }, 1)
            : st.shop_name === 'Emily' ? ans('drink', { drink: 0.47, sweet: 0.3, rice: 0.1, meat: 0.05, noodle: 0.04, health: 0.02, fast: 0.02 }, 0.38)
                : st.shop_name === 'Boom' ? { status: 500 } : ans('pizza', {}, 1))),
        readIdentity: async url => { if (/lin\.ee\/b/.test(url)) throw new Error('403'); return { title: 'สุกี้แห้ง 100 ปี | LINE MAN', description: 'สุกี้แห้งต้นตำรับ' }; },
    };
    const r = await sc.classifyShops(shops, deps);
    assert.strictEqual(r.results.length, 5);
    const by = id => r.results.find(x => x.id === id);
    assert.ok(by('a').ok && by('a').category === 'noodle' && by('a').confidence === 1 && by('a').usedPage === true, 'confident answer, page identity used');
    assert.ok(by('b').ok && by('b').category === 'drink' && Math.abs(by('b').confidence - 0.38) < 1e-9 && by('b').usedPage === false, 'low confidence passes through; an unreadable page falls back to the name alone');
    assert.deepStrictEqual(by('b').options.map(o => o.key), ['drink', 'sweet', 'rice'], 'top 3 options by probability');
    assert.ok(!by('c').ok && !by('d').ok && !by('e').ok, 'HTTP error, empty title, unknown category → not ok, nothing thrown');
    assert.strictEqual(log.filter(l => l.body.state.shop_name === '').length, 0, 'an empty title never reaches Jev');
    const first = log.find(l => l.body.state.shop_name === 'สุกี้แห้ง 100 ปี');
    assert.ok(first.url === 'https://openrouter.ai/api/v1/systemone' && first.auth === 'Bearer SECRET' && first.body.model === 'jev-latest', 'Jev through OpenRouter');
    assert.ok(first.body.state.page_title && first.body.state.page_description && /LINE MAN/.test(first.body.state.context), 'state = name + context + page');
    const q = first.body.questions.category;
    assert.ok(q.type === 'choice' && Object.keys(q.criteria).sort().join() === [...sc.KEYS].sort().join(), 'one Choice question with the seven described categories');
    assert.ok(r.inputTokens === 1000 && Math.abs(r.cost - 0.00004) < 1e-12, 'usage summed');
    assert.ok(!JSON.stringify(r).includes('SECRET'));

    // limits
    await assert.rejects(() => sc.classifyShops(Array.from({ length: sc.MAX_SHOPS + 1 }, (_, i) => ({ id: 'x' + i, title: 't' })), deps), /too many/);
    assert.deepStrictEqual((await sc.classifyShops([], deps)).results, []);
    // a non-http url is never read
    let reads = 0;
    await sc.classifyShops([{ id: 'z', title: 'Z', url: 'file:///etc/passwd' }, { id: 'y', title: 'Y', url: 'javascript:alert(1)' }], { ...deps, readIdentity: async () => { reads++; return {}; }, fetch: mkFetch(() => ans('rice', {}, 1)) });
    assert.strictEqual(reads, 0, 'only http(s) links are read');

    // wiring
    const fn = idx.slice(idx.indexOf('exports.jevClassifyShops'));
    assert.ok(/exports\.jevClassifyShops = onCall\(\{ secrets: \['OPENROUTER_API_KEY', 'JEV_AI_API_KEY'\]/.test(idx), 'declares the OpenRouter + Jev AI secrets');
    assert.ok(fn.indexOf('requireAdminCallable(request)') > 0 && fn.indexOf('requireAdminCallable(request)') < fn.indexOf('classifyShops('), 'admin gate first');
    assert.ok(/enabled === false/.test(fn) && /readIdentity: require\('\.\/link-logo'\)\.readPageIdentity/.test(fn) && /recordAiUsage\(provider, jevMod\.JEV_MODEL/.test(fn) && /providerOf\(cfg\.exists \? cfg\.data\(\)\.provider : null\)/.test(fn) && /apiKey: jevApiKey\(provider\)/.test(fn), 'kill switch, guarded page reader, usage logged under the provider that served (default Jev AI)');
    console.log('PASS: shop-category — one Choice per shop, page identity best-effort, low confidence passed through, failures isolated, admin-only wiring');
})().catch(e => { console.error(e); process.exit(1); });
