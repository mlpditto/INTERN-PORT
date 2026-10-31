// 🌞 Nika: what interns may search = published Drug Codex, Disease Codex and Articles, as text. A list of fields, so who wrote an entry never reaches the search store.
// One search document per section: the answer step reads only part of a long document, so a whole drug page answered "no information" about what it did hold.
const LABEL = {
    class: 'Class', brandNames: 'Brand names', indication: 'Indication', mechanism: 'Mechanism', dosing: 'Dosing', pedsDosing: 'Pediatric dosing', contraindication: 'Contraindications',
    sideEffects: 'Side effects', interactions: 'Interactions', monitoring: 'Monitoring', patientCounseling: 'Patient counseling', pearls: 'Pearls', absorption: 'Absorption', distribution: 'Distribution',
    metabolism: 'Metabolism', excretion: 'Excretion', toxicity: 'Toxicity', thaiName: 'Thai name', synonyms: 'Synonyms', category: 'Category', epidemiology: 'Epidemiology', etiology: 'Etiology',
    pathophysiology: 'Pathophysiology', symptoms: 'Symptoms', signs: 'Signs', diagnosis: 'Diagnosis', investigations: 'Investigations', differential: 'Differential', treatment: 'Treatment',
    nonPharm: 'Non-drug care', complications: 'Complications', prognosis: 'Prognosis', redFlags: 'Red flags', relatedDrugs: 'Related drugs'
};
const DRUG = ['class', 'brandNames', 'indication', 'mechanism', 'dosing', 'pedsDosing', 'contraindication', 'sideEffects', 'interactions', 'monitoring', 'patientCounseling', 'pearls', 'absorption', 'distribution', 'metabolism', 'excretion', 'toxicity'];
const DISEASE = ['thaiName', 'synonyms', 'category', 'epidemiology', 'etiology', 'pathophysiology', 'symptoms', 'signs', 'diagnosis', 'investigations', 'differential', 'treatment', 'nonPharm', 'complications', 'prognosis', 'redFlags', 'patientCounseling', 'pearls', 'relatedDrugs'];
const MAX_TEXT = 12000;

function flat(v) {
    if (v == null || typeof v === 'boolean') return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join('\n');
    if (typeof v === 'object') return Object.values(v).map(flat).filter(Boolean).join(' · ');
    return '';
}
function safeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60); }
function doc(kind, id, section, title, label, text) {
    return {
        id: [kind, safeId(id), section].filter(Boolean).join('-'),
        structData: { title, kind, sourceId: id, section: label, audience: 'intern' },
        content: { mimeType: 'text/plain', rawBytes: Buffer.from('# ' + title + (label ? ' · ' + label : '') + '\n\n' + text.slice(0, MAX_TEXT), 'utf8').toString('base64') }
    };
}
function sectionDocs(kind, id, title, d, fields) {
    if (!title) return [];
    return fields.map(f => { const t = flat(d[f]); return t ? doc(kind, id, f, title, LABEL[f], t) : null; }).filter(Boolean);
}
function drugDocs(id, d) { return sectionDocs('drug', id, flat(d.genericName), d, DRUG); }
function diseaseDocs(id, d) { return sectionDocs('disease', id, flat(d.diseaseName), d, DISEASE); }
// the Article screen's own gate: published and started
function articleDocs(id, a, now) {
    const start = a.startAt ? new Date(a.startAt.toMillis ? a.startAt.toMillis() : a.startAt).getTime() : 0;
    const title = flat(a.title), body = flat(a.body);
    if (a.status !== 'scheduled' || !start || start > now || !title || !body) return [];
    const parts = body.split(/\n{2,}/), out = [];
    let chunk = '';
    parts.forEach(p => { if (chunk && (chunk + p).length > 2500) { out.push(chunk); chunk = ''; } chunk += (chunk ? '\n\n' : '') + p; });
    if (chunk) out.push(chunk);
    return out.map((t, i) => doc('article', id, 'p' + (i + 1), title, '', t));
}

const STORE = 'https://discoveryengine.googleapis.com/v1/projects/intern-port-edfa7/locations/global/collections/default_collection/dataStores/nika-content/branches/default_branch/documents';

// Nightly: import what is published now, then remove what no longer is.
async function syncAll(db, axios, token, now = Date.now()) {
    const read = async name => (await db.collection(name).get()).docs.map(d => [d.id, d.data()]);
    const docs = [
        ...(await read('drug_codex')).flatMap(([id, d]) => drugDocs(id, d)),
        ...(await read('disease_codex')).flatMap(([id, d]) => diseaseDocs(id, d)),
        ...(await read('articles')).flatMap(([id, a]) => articleDocs(id, a, now))
    ];
    const headers = { Authorization: 'Bearer ' + token, 'x-goog-user-project': 'intern-port-edfa7' };
    for (let i = 0; i < docs.length; i += 100) {
        await axios.post(STORE + ':import', { inlineSource: { documents: docs.slice(i, i + 100) }, reconciliationMode: 'INCREMENTAL' }, { headers, timeout: 60000 });
    }
    const keep = new Set(docs.map(d => d.id));
    let removed = 0, pageToken = '';
    do {
        const r = await axios.get(STORE, { headers, timeout: 60000, params: { pageSize: 1000, ...(pageToken ? { pageToken } : {}) } });
        for (const d of r.data.documents || []) {
            if (!keep.has(d.id)) { await axios.delete('https://discoveryengine.googleapis.com/v1/' + d.name, { headers, timeout: 30000 }); removed++; }
        }
        pageToken = r.data.nextPageToken || '';
    } while (pageToken);
    return { imported: docs.length, removed };
}

module.exports = { drugDocs, diseaseDocs, articleDocs, flat, syncAll, DRUG, DISEASE };
