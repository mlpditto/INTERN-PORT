// Jev "same fact?" scoring for the Compare modal: batching, content-hash cache, symmetry, verdict bands, failure isolation.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const jev = require('../functions/jev.js');
const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');

const side = (stem, options) => ({ quiz: 'Q', stem, options: options || ['a', 'b'] });
const mkFetch = (answers, log) => async (url, opts) => {
    const body = JSON.parse(opts.body);
    log.push({ url, auth: opts.headers.Authorization, body });
    const a = body.state.question_a.stem + '|' + body.state.question_b.stem;
    const r = answers(a, log.length);
    if (r.status) return { ok: false, status: r.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ model: 'typesafe/jev-1.14-20261014', answers: { same_fact: { noul: r.sf }, same_topic: { noul: r.st == null ? 0.9 : r.st } }, usage: { input_tokens: 100, cost: 0.0000042 } }) };
};
const memCache = () => { const m = {}; return { m, readCache: async keys => Object.fromEntries(keys.filter(k => m[k]).map(k => [k, m[k]])), writeCache: async es => es.forEach(e => { m[e.key] = { sameFact: e.sameFact, sameTopic: e.sameTopic }; }) }; };

(async () => {
    // symmetric key, title-independent, content-dependent
    const k1 = jev.normalizePair({ a: side('X?'), b: side('Y?') }).key;
    assert.strictEqual(k1, jev.normalizePair({ a: side('Y?'), b: side('X?') }).key, 'order does not matter');
    assert.strictEqual(k1, jev.normalizePair({ a: { ...side('X?'), quiz: 'renamed' }, b: side('Y?') }).key, 'quiz title is not part of the key');
    assert.notStrictEqual(k1, jev.normalizePair({ a: side('X!'), b: side('Y?') }).key, 'changed wording → new key');

    // verdict bands
    assert.deepStrictEqual([0.92, 0.65, 0.5, 0.35, 0.02, null].map(jev.verdictOf), ['dup', 'dup', 'unsure', 'different', 'different', 'unsure']);

    // batching + cache: second call asks nothing
    const log = [], c = memCache();
    const pairs = [{ a: side('dup1'), b: side('dup2') }, { a: side('x'), b: side('y') }, { a: side('dup2'), b: side('dup1') }];   // 3rd = 1st reversed
    const deps = { apiKey: 'SECRET-KEY', provider: 'openrouter', fetch: mkFetch(a => ({ sf: /dup/.test(a) ? 0.92 : 0.02 }), log), ...c };
    const r1 = await jev.compareBatch(pairs, deps);
    assert.strictEqual(log.length, 2, 'duplicate pair (reversed) is asked once: ' + log.length);
    assert.deepStrictEqual(r1.results.map(r => r.verdict), ['dup', 'different', 'dup']);
    assert.ok(r1.results.every(r => !r.cached) && r1.inputTokens === 200 && r1.calls === 2);
    const r2 = await jev.compareBatch(pairs, deps);
    assert.strictEqual(log.length, 2, 'cached: no new API call');
    assert.ok(r2.results.every(r => r.cached), 'all from cache');
    assert.ok(log.every(l => l.auth === 'Bearer SECRET-KEY' && l.url === 'https://openrouter.ai/api/v1/systemone' && l.body.model === 'jev-latest'), 'OpenRouter still works as a transport (the way back)');
    assert.ok(Math.abs(r1.cost - 0.0000084) < 1e-12, 'usage.cost summed from the response: ' + r1.cost);
    assert.ok(!JSON.stringify(r1).includes('SECRET-KEY'), 'the key never appears in a result');

    // transports: same body, different URL; unknown / missing provider falls back to Jev AI's own API (V102.449); the model that served is cached
    const logT = [];
    const cT = memCache();
    const rT = await jev.compareBatch([{ a: side('t1'), b: side('t2') }], { apiKey: 'K2', provider: 'typesafe', fetch: mkFetch(() => ({ sf: 0.9 }), logT), ...cT });
    assert.strictEqual(logT[0].url, 'https://api.typesafe.ai/v1/systemone'); assert.strictEqual(rT.provider, 'typesafe');
    assert.strictEqual(Object.values(cT.m)[0] && Object.keys(cT.m).length, 1);
    const logD = [];
    await jev.compareBatch([{ a: side('d1'), b: side('d2') }], { apiKey: 'K3', provider: 'nonsense', fetch: mkFetch(() => ({ sf: 0.9 }), logD), ...memCache() });
    assert.strictEqual(logD[0].url, 'https://jev-ai.pro/api/v1/systemone', 'unknown provider → Jev AI (the default since V102.449)');
    assert.strictEqual(logD[0].auth, 'Bearer K3');
    assert.strictEqual(jev.providerOf(undefined), 'jev'); assert.strictEqual(jev.providerOf('jev'), 'jev'); assert.strictEqual(jev.providerOf('openrouter'), 'openrouter', 'the way back is one config value');
    assert.strictEqual(Object.keys(logT[0].body).sort().join(), Object.keys(logD[0].body).sort().join(), 'the two transports send the same body shape');

    // one pair failing does not sink the batch, and an error is not cached
    const c3 = memCache(), log3 = [];
    const r3 = await jev.compareBatch([{ a: side('ok1'), b: side('ok2') }, { a: side('bad1'), b: side('bad2') }, { a: side(''), b: side('empty') }],
        { apiKey: 'k', provider: 'openrouter', fetch: mkFetch(a => (/bad/.test(a) ? { status: 500 } : { sf: 0.9 }), log3), ...c3 });
    assert.deepStrictEqual(r3.results.map(r => !!r.error), [false, true, true], 'bad pair + empty stem → error entries');
    assert.strictEqual(Object.keys(c3.m).length, 1, 'only the good answer is cached');

    // 429 backs off then succeeds
    let n429 = 0;
    const r4 = await jev.compareBatch([{ a: side('p'), b: side('q') }], { apiKey: 'k', fetch: async () => (n429++ < 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ answers: { same_fact: { noul: 0.4 } }, usage: {} }) }), ...memCache() });
    assert.strictEqual(r4.results[0].verdict, 'unsure'); assert.strictEqual(n429, 2);

    // limits
    await assert.rejects(() => jev.compareBatch(Array.from({ length: jev.MAX_PAIRS + 1 }, () => ({ a: side('a'), b: side('b') })), deps), /too many/);
    assert.deepStrictEqual((await jev.compareBatch([], deps)).results, []);

    // wiring in index.js: admin only, secret, kill switch, usage log, cache collection
    assert.ok(/exports\.jevCompare = onCall\(\{ secrets: \["OPENROUTER_API_KEY", "JEV_AI_API_KEY"\]/.test(idx), 'callable declares the OpenRouter + Jev AI secrets (both exist; a missing JEV_API_KEY would fail the deploy)');
    assert.ok(/function jevApiKey\(provider\) \{ return provider === "typesafe" \? process\.env\.JEV_API_KEY : provider === "jev" \? process\.env\.JEV_AI_API_KEY : process\.env\.OPENROUTER_API_KEY; \}/.test(idx), 'each provider reads its own key');
    const fnSrc = idx.slice(idx.indexOf('exports.jevCompare'));
    assert.ok(fnSrc.indexOf('requireAdminCallable(request)') > 0 && fnSrc.indexOf('requireAdminCallable(request)') < fnSrc.indexOf('compareBatch'), 'admin gate before any work');
    assert.ok(/quiz_dup_scores"\)\.doc\("_config"\)/.test(fnSrc) && /enabled === false/.test(fnSrc), 'kill switch');
    assert.ok(/recordAiUsage\(provider, jev\.JEV_MODEL/.test(fnSrc) && /providerOf\(cfg\.exists \? cfg\.data\(\)\.provider : null\)/.test(fnSrc), 'usage is logged under the provider that served; provider comes from the config doc');
    console.log('PASS: jev-compare — symmetric content-hash cache, verdict bands, failure isolation, 429 backoff, admin-only + secret + kill switch wiring');
})().catch(e => { console.error(e); process.exit(1); });
