// V102.443: ai_usage keeps the REAL cost (USD) when the provider reported one — and adds nothing when it did not.
// Also: the Case Card Studio pill appends it ("Ready · 0:25 · $0.04").
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const a = source.indexOf('async function recordAiUsage('), b = source.indexOf('\n// V95.97', a);
assert.ok(a > 0 && b > a, 'recordAiUsage found');
let record;
const admin = { firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ set: async v => { record = v; } }) }) }), { FieldValue: { increment: n => n, serverTimestamp: () => 1 } }) };
const ctx = { admin, Buffer, console }; vm.createContext(ctx); vm.runInContext(source.slice(a, b), ctx);
const plain = o => JSON.parse(JSON.stringify(o));

(async () => {
    await ctx.recordAiUsage('openrouter', 'x-ai/grok-imagine-image-quality', 0, true, 'casecard_image', { costUsd: 0.042 });
    let r = plain(record), m = Object.values(r.models)[0];
    assert.equal(r.totalCostUsd, 0.042, 'the day total');
    assert.equal(m.costUsd, 0.042, 'per model');
    assert.equal(r.features.casecard_image.costUsd, 0.042, 'per feature');
    assert.equal(r.providers.openrouter.costUsd, 0.042, 'per provider');
    assert.equal(Object.values(r.hours)[0].features.casecard_image.costUsd, 0.042, 'per hour');

    for (const bad of [null, undefined, 'x', NaN, -1, {}]) {   // null is what the proxy sends when OpenRouter gave no cost: it must not become $0
        await ctx.recordAiUsage('openrouter', 'm', 5, true, 'f', { costUsd: bad });
        r = plain(record); m = Object.values(r.models)[0];
        assert.ok(!('totalCostUsd' in r) && !('costUsd' in m) && !('costUsd' in r.features.f), 'no cost field for ' + String(bad));
    }
    await ctx.recordAiUsage('openai', 'm', 5, true, 'f');
    assert.ok(!('totalCostUsd' in plain(record)), 'no usage argument at all still works');
    await ctx.recordAiUsage('openrouter', 'm', 5, true, 'f', { costUsd: 0 });
    assert.equal(plain(record).totalCostUsd, 0, 'a real $0 is kept');

    // Clips Phase 5: an ESTIMATE (Omni video) is booked in its own field, never as the real cost
    await ctx.recordAiUsage('gemini-aistudio', 'gemini-omni-1.1-flash', 47527, true, 'clip_video', { estCostUsd: 0.8 });
    r = plain(record); m = Object.values(r.models)[0];
    assert.equal(r.totalEstCostUsd, 0.8, 'est: the day total'); assert.equal(m.estCostUsd, 0.8, 'est: per model'); assert.equal(r.features.clip_video.estCostUsd, 0.8, 'est: per feature'); assert.equal(r.providers['gemini-aistudio'].estCostUsd, 0.8, 'est: per provider');
    assert.ok(!('totalCostUsd' in r) && !('costUsd' in m) && !('costUsd' in r.features.clip_video), 'an estimate never shows up as the real cost');
    for (const bad of [null, undefined, 'x', NaN, -1]) { await ctx.recordAiUsage('gemini-aistudio', 'm', 5, true, 'f', { estCostUsd: bad }); assert.ok(!('totalEstCostUsd' in plain(record)), 'no est field for ' + String(bad)); }
    // the proxy: OpenRouter video hands its real cost to the ledger, Omni its seconds × price as an estimate
    assert.ok(/usage: \{ inputTokens: null, outputTokens: null, totalTokens: null, costUsd: Number\.isFinite\(cost\) \? cost : null \}/.test(source), 'OpenRouter video → usage.costUsd');
    assert.ok(/const OMNI_USD_PER_SECOND = 0\.10;/.test(source) && /estCostUsd: Math\.round\(omniSeconds \* OMNI_USD_PER_SECOND \* 10000\) \/ 10000/.test(source), 'Omni video → usage.estCostUsd');

    // the proxy hands the cost over on the OpenRouter chat paths (text + image)
    assert.ok(/thinkingTokens: orThink, totalTokens: response\.data\.usage\?\.total_tokens \?\? null, costUsd: response\.data\.usage\?\.cost \?\? null/.test(source), 'text path');
    assert.ok(/usage: \{ costUsd: response\.data\.usage\?\.cost \?\? null, totalTokens: response\.data\.usage\?\.total_tokens \?\? null \}   \/\/ V102\.443/.test(source), 'chat image path');

    // the pill (admin.html source — the generate flow)
    const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
    assert.ok(/imageResponse\.raw\.usage\.costUsd;\n\s*const costPill = document\.getElementById\('alabasta-case-card-image-status'\);\n\s*if \(costPill && typeof imgCost === 'number'/.test(html), 'the pill reads raw.usage.costUsd');
    assert.ok(/String\(Number\(imgCost\.toFixed\(3\)\)\)/.test(html) && /class="cc-gen-cost"/.test(html), 'shown to 3 decimals at most');
    console.log('ai-usage-cost-qa: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
