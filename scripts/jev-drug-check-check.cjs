// V102.638: functions/jev-drug-check.js — Jev's two yes/no checks for the Drug Codex verify gate, with a fake fetch (no network):
// one on_topic question per tab (known tab keys only), one same_meaning per Education field with BOTH English and Thai, cache hits skip the call,
// scores → ok / look / bad with the quiz thresholds, the reply says it is not calibrated, a failed call leaves that item out and counts an error.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { planDrugCheck, checkDrug } = require(path.join(__dirname, '../functions/jev-drug-check.js'));

(async () => {
    const input = { name: 'gabapentin', sections: { clinical: 'Dosing: 1,800 mg once daily with dinner', pk: 'Absorption: saturable L-amino acid transport', edu: 'Pearls: never mg-for-mg', bogus: 'x', moa: '' },
        langs: { patientCounseling: { en: 'Take with the evening meal', th: 'กินพร้อมมื้อเย็น' }, pearls: { en: 'x', th: '' }, junk: { en: 'a', th: 'b' } } };
    const plan = planDrugCheck(input);
    assert.deepEqual(plan.items.map(i => i.kind + ':' + i.id), ['topic:clinical', 'topic:pk', 'topic:edu', 'lang:patientCounseling'], 'known tabs with text + fields with both languages');
    assert.equal(planDrugCheck({ sections: { clinical: 'x' } }).items.length, 0, 'no name → nothing asked');

    const sent = [];
    const scores = { clinical: 0.92, pk: 0.5, edu: 0.1, patientCounseling: 0.2 };
    const fakeFetch = async (url, opts) => {
        const body = JSON.parse(opts.body); sent.push(body);
        const q = Object.keys(body.questions)[0];
        const id = body.state.section_title || 'patientCounseling';
        if (id === 'pk' && sent.filter(b => b.state.section_title === 'pk').length === 1 && process.env.__FAILPK) throw new Error('down');
        return { ok: true, status: 200, json: async () => ({ answers: { [q]: { noul: scores[id] } }, usage: { input_tokens: 10 } }) };
    };
    let written = [];
    const cache = {};
    const deps = { apiKey: 'k', provider: 'jev', fetch: fakeFetch, readCache: async keys => Object.fromEntries(keys.filter(k => k in cache).map(k => [k, cache[k]])), writeCache: async e => { written = e; e.forEach(x => { cache[x.key] = x.score; }); } };
    const out = await checkDrug(input, deps);
    assert.equal(sent.length, 4);
    assert.ok(sent.every(b => b.model === 'jev-latest'));
    assert.deepEqual(sent.map(b => Object.keys(b.questions)[0]), ['on_topic', 'on_topic', 'on_topic', 'same_meaning']);
    assert.deepEqual(sent[0].state, { drug: 'gabapentin', section_title: 'clinical', section: 'Dosing: 1,800 mg once daily with dinner' });
    assert.deepEqual(sent[3].state, { source: 'Take with the evening meal', translation: 'กินพร้อมมื้อเย็น' });
    assert.deepEqual(out.sections, { clinical: { score: 0.92, verdict: 'ok' }, pk: { score: 0.5, verdict: 'look' }, edu: { score: 0.1, verdict: 'bad' } });
    assert.deepEqual(out.langs, { patientCounseling: { score: 0.2, verdict: 'bad' } });
    assert.deepEqual([out.calls, out.inputTokens, out.errors, out.calibrated], [4, 40, 0, false]);
    assert.equal(written.length, 4);

    // second run: all cached → no call
    sent.length = 0;
    const again = await checkDrug(input, deps);
    assert.deepEqual([sent.length, again.calls, again.sections.edu.verdict], [0, 0, 'bad']);

    // a failing call: that tab is left out, the rest come back
    const failing = Object.assign({}, deps, { readCache: async () => ({}), fetch: async (u, o) => { const b = JSON.parse(o.body); if (b.state.section_title === 'pk') return { ok: false, status: 500, json: async () => ({}) }; return fakeFetch(u, o); } });
    const part = await checkDrug(input, failing);
    assert.ok(!('pk' in part.sections) && part.errors === 1 && part.sections.clinical.verdict === 'ok');

    // the callable is admin-only and suggest-only
    const idx = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    const fn = idx.slice(idx.indexOf('exports.jevCheckDrug'), idx.indexOf('exports.jevCheckQuiz'));
    assert.match(fn, /requireAdminCallable\(request\)/);
    assert.ok(!/collection\("drug_codex/.test(fn), 'never touches the drug');
    console.log('PASS: jevCheckDrug — on_topic per known tab, same_meaning per Education field with EN + TH, cached, ok/look/bad, not calibrated, a failed call drops only that tab, admin-only, writes nothing to the drug');
})().catch(e => { console.error(e); process.exit(1); });
