// V102.124: the ¥→฿ helpers from admin.html (beriLoadRate / beriBaht / beriBahtTitle) run in a vm with a scripted fetch + localStorage:
// fresh cache = no network; the source chain falls through on failure / non-200 / garbage; every source down → last cached rate, else ¥1≈฿0.21.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const i = html.indexOf('        let beriRate = {'), j = html.indexOf('        function beriPaintBaht()', i);
assert(i > 0 && j > i, 'helpers found');
const block = html.slice(i, html.indexOf('\n', j) + 1);
const sources = (block.match(/url: '([^']+)'/g) || []).map(x => x.slice(6, -1));
assert.deepEqual(sources.map(u => new URL(u).hostname), ['api.frankfurter.dev', 'open.er-api.com', 'cdn.jsdelivr.net', 'latest.currency-api.pages.dev'], 'chain: ECB/Frankfurter → er-api → jsDelivr → Cloudflare mirror');
assert.ok(/beri_jpy_thb/.test(block) && /12 \* 3600e3/.test(block), 'cached 12 h in localStorage');
assert.ok(html.includes("if (!beriRateTried) { beriRateTried = true; beriLoadRate(); }"), 'loaded once when the catalog first renders');

const mk = ({ store = {}, responses = {} } = {}) => {
    const calls = [];
    const ctx = {
        localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
        AbortController, setTimeout, clearTimeout, Date, JSON, Math, Number, console, painted: 0,
        renderBeriRewardsAdmin: () => { ctx.painted++; }, brPreviewOff: () => {},
        fetch: async (url) => { calls.push(new URL(url).hostname); const r = responses[new URL(url).hostname]; if (r === 'throw') throw new Error('network'); return r || { ok: false, json: async () => ({}) }; }
    };
    vm.createContext(ctx);
    vm.runInContext(block + '\n;this.__api = { load: beriLoadRate, baht: beriBaht, title: beriBahtTitle, rate: () => beriRate };', ctx);
    return { ctx, calls, store };
};
const ok = d => ({ ok: true, json: async () => d });
(async () => {
    // 1) happy path: Frankfurter answers, cached, painted, rounding + title
    let t = mk({ responses: { 'api.frankfurter.dev': ok({ date: '2026-10-07', rates: { THB: 0.21295 } }) } });
    await t.ctx.__api.load();
    assert.deepEqual(t.calls, ['api.frankfurter.dev']); assert.equal(t.ctx.__api.baht(2450), '฿522'); assert.equal(t.ctx.__api.baht(500), '฿106'); assert.equal(t.ctx.__api.baht(0), '฿0');
    assert.equal(t.ctx.__api.title(), '¥1 ≈ ฿0.213 · ECB · Frankfurter · 2026-10-07'); assert.equal(t.ctx.painted, 1, 'UI repainted once the rate arrived');
    assert.ok(JSON.parse(t.store.beri_jpy_thb).r === 0.21295);
    // 2) a fresh cache means no network at all
    const fresh = mk({ store: { beri_jpy_thb: JSON.stringify({ r: 0.2, day: 'd', src: 'x', at: Date.now() - 3600e3 }) } });
    await fresh.ctx.__api.load(); assert.deepEqual(fresh.calls, []); assert.equal(fresh.ctx.__api.rate().r, 0.2);
    // 3) chain: throw → 500 → garbage → good (the Cloudflare mirror)
    t = mk({ responses: { 'api.frankfurter.dev': 'throw', 'open.er-api.com': { ok: false, json: async () => ({}) }, 'cdn.jsdelivr.net': ok({ jpy: { thb: 5 } }), 'latest.currency-api.pages.dev': ok({ date: '2026-10-07', jpy: { thb: 0.21258643 } }) } });
    await t.ctx.__api.load();
    assert.deepEqual(t.calls, ['api.frankfurter.dev', 'open.er-api.com', 'cdn.jsdelivr.net', 'latest.currency-api.pages.dev'], 'fell through every failure incl. a bad payload (5 ≠ a yen rate)');
    assert.equal(t.ctx.__api.rate().src, 'currency-api · Cloudflare');
    // 4) every source down + a stale cache → last good rate, labelled cached
    t = mk({ store: { beri_jpy_thb: JSON.stringify({ r: 0.2111, day: '2026-10-01', src: 'ECB · Frankfurter', at: Date.now() - 30 * 3600e3 }) }, responses: {} });
    await t.ctx.__api.load();
    assert.equal(t.ctx.__api.rate().r, 0.2111); assert.ok(t.ctx.__api.title().includes('(cached)'), t.ctx.__api.title());
    // 5) nothing at all → ¥1 ≈ ฿0.21, said to be approximate
    t = mk(); await t.ctx.__api.load();
    assert.equal(t.ctx.__api.rate().r, 0.21); assert.equal(t.ctx.__api.baht(500), '฿105'); assert.ok(t.ctx.__api.title().includes('approx.'));
    console.log('PASS: ¥→฿ — chain Frankfurter → er-api → jsDelivr → Cloudflare mirror (falls through errors, non-200, bad payload), 12 h localStorage cache, stale-cache then ¥1≈฿0.21 fallback, rounding, hover title carries the rate');
})().catch(e => { console.error(e); process.exit(1); });
