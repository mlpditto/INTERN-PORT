// 🌞 Nika sync: the real functions/nika-sync.js with a stubbed Firestore and HTTP. Only listed fields reach the store, one document per section, stale documents go.
const assert = require('node:assert/strict');
const { drugDocs, diseaseDocs, articleDocs, syncAll } = require('../functions/nika-sync.js');
const text = d => Buffer.from(d.content.rawBytes, 'base64').toString();

const drug = { genericName: 'Amlodipine', sideEffects: 'Edema', dosing: ['5 mg', { note: 'daily' }], mechanism: '  ', submittedByName: 'Somchai', submittedByUserId: 'U123', contributors: [{ name: 'Somchai' }], reviewedBy: 'x@gmail.com', pearls: null };
const docs = drugDocs('d/1', drug);
assert.deepEqual(docs.map(d => d.id), ['drug-d_1-dosing', 'drug-d_1-sideEffects'], 'one document per filled section, a safe id');
assert.ok(docs.every(d => /^[a-zA-Z0-9_-]+$/.test(d.id)));
assert.match(text(docs[1]), /^# Amlodipine · Side effects\n\nEdema/);
assert.equal(docs[0].structData.sourceId, 'd/1', 'keeps the link back to the Codex');
assert.ok(!docs.some(d => /Somchai|U123|gmail/.test(text(d) + JSON.stringify(d.structData))), 'who wrote it never reaches the store');
assert.deepEqual(drugDocs('x', { dosing: '5 mg' }), [], 'no name, no document');
assert.equal(diseaseDocs('a', { diseaseName: 'Psittacosis', treatment: 'Doxycycline', redFlags: '' }).length, 1);

const now = Date.parse('2026-10-31T00:00:00Z'), past = { toMillis: () => now - 1000 }, future = { toMillis: () => now + 1000 };
assert.deepEqual(articleDocs('a', { status: 'draft', startAt: past, title: 'T', body: 'B' }, now), [], 'unpublished');
assert.deepEqual(articleDocs('a', { status: 'scheduled', startAt: future, title: 'T', body: 'B' }, now), [], 'not started');
const long = articleDocs('a', { status: 'scheduled', startAt: past, title: 'T', body: 'x'.repeat(2000) + '\n\n' + 'y'.repeat(2000) }, now);
assert.equal(long.length, 2, 'a long article splits at a paragraph');

(async () => {
    const sets = { drug_codex: [['d1', { genericName: 'A', dosing: '1' }]], disease_codex: [], articles: [] };
    const db = { collection: n => ({ get: async () => ({ docs: sets[n].map(([id, d]) => ({ id, data: () => d })) }) }) };
    const calls = [];
    const axios = {
        post: async (u, b) => { calls.push(['import', b.inlineSource.documents.length, b.reconciliationMode]); return { data: {} }; },
        get: async () => ({ data: { documents: [{ id: 'drug-d1-dosing', name: 'n/keep' }, { id: 'old-doc', name: 'n/old' }] } }),
        delete: async u => { calls.push(['delete', u]); return { data: {} }; }
    };
    const out = await syncAll(db, axios, 't', now);
    assert.deepEqual(out, { imported: 1, removed: 1 });
    assert.deepEqual(calls, [['import', 1, 'INCREMENTAL'], ['delete', 'https://discoveryengine.googleapis.com/v1/n/old']], 'imports, then removes only what is gone');
    console.log('PASS: Nika sync — listed fields only, per section, published articles, stale documents removed');
})().catch(e => { console.error(e); process.exit(1); });
