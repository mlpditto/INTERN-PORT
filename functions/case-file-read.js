// V102.547: the PDF an intern attaches to a Case. Gemini reads it right after Send, so the admin opens Review with the text ready.
// Text only: never a score, never a verdict. The pages go to Google; the patient's identifiers must not come back into Firestore.
const axios = require('axios');

const MODEL = 'gemini-3.8-flash';
const MAX_BYTES = 5 * 1024 * 1024;
const LIM = { rows: 240, label: 60, text: 1000, marks: 20, parts: 20 };
const KINDS = ['hn', 'name', 'id', 'address', 'phone'];

const PROMPT = 'This PDF is a pharmacy intern\'s case log, typed, scanned or handwritten, in Thai and English. Copy what is written, line by line, in reading order, in the same language. '
    + 'Do not correct, translate, summarise or judge it. Use the printed heading as the label when there is one (CC, HPI, PMH, U/D, MH, ALL, DRPs, Plan, Assessment), otherwise "Note". '
    + 'Set unsure true on a line when you cannot read it with confidence. '
    + 'NEVER copy a patient name, HN, national ID number, address or phone number: write [hidden] in its place and add one entry to identifiers with its page and kind. '
    + 'A black bar or a covered area is not an identifier. Do not guess a covered value. '
    + 'One file can hold several patient cases. A case often starts halfway down a page and runs onto the next. List every case in cases, in reading order, with a short clinical title (never an identifier) and pageFrom, pageTo: two cases can share a page. Give every row its case number, starting at 1. Always give your best split: the admin checks it.';
const SYSTEM = 'Answer ONLY with JSON of the form {"pages":3,"rows":[{"page":1,"case":1,"label":"CC","text":"...","unsure":false}],"identifiers":[{"page":1,"kind":"hn"}],"cases":[{"title":"COPD exacerbation","pageFrom":1,"pageTo":3}]}. kind is one of hn, name, id, address, phone.';

function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }

// only this intern's own folder, one flat file name: the path comes from a field the intern wrote
function allowedPath(path, authUid) {
    return !!authUid && typeof path === 'string' && path.startsWith('case-files/' + authUid + '/') && /^case-files\/[^/]+\/[A-Za-z0-9_-]+\.pdf$/.test(path);
}

// null = not usable; never throws
function parseRead(raw) {
    let j;
    try { j = JSON.parse(String(raw || '').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')); } catch (e) { return null; }
    if (!j || !Array.isArray(j.rows)) return null;
    const page = v => { const n = Math.floor(Number(v)); return n >= 1 && n <= 999 ? n : 1; };
    const rows = j.rows.slice(0, LIM.rows).map(r => ({ page: page(r && r.page), ...(Number.isInteger(r && r.case) && r.case > 0 ? { case: r.case } : {}), label: clean(r && r.label, LIM.label) || 'Note', text: clean(r && r.text, LIM.text), unsure: !!(r && r.unsure) })).filter(r => r.text);
    const identifiers = (Array.isArray(j.identifiers) ? j.identifiers : []).slice(0, LIM.marks).map(m => ({ page: page(m && m.page), kind: KINDS.includes(m && m.kind) ? m.kind : 'name' }));
    if (!rows.length && !identifiers.length) return null;
    const pages = Math.max(page(j.pages), ...rows.map(r => r.page), ...identifiers.map(m => m.page));
    const found = (Array.isArray(j.cases) ? j.cases : []).slice(0, LIM.parts).map((c, i) => ({ no: i + 1, title: clean(c && c.title, LIM.label), from: page(c && c.pageFrom), to: page(c && c.pageTo) }));
    const many = found.length > 1, usable = many && validParts(found, pages);   // the admin checks every split, so Gemini's best try goes through
    return { pages, rows, identifiers, parts: usable ? found : [], ...(many && !usable ? { unsplit: true } : {}) };
}

// in order, no page left out; the next case may start on the page the last one ended on
function validParts(parts, pages) {
    if (!Array.isArray(parts) || !parts.length || parts.length > LIM.parts) return false;
    let end = 0;
    for (const p of parts) {
        if (!p || !Number.isInteger(p.from) || !Number.isInteger(p.to) || p.to < p.from) return false;
        if (end ? p.from !== end && p.from !== end + 1 : p.from !== 1) return false;
        end = p.to;
    }
    return end === pages;
}

function partRead(read, part) {
    const inside = x => x.page >= part.from && x.page <= part.to;
    const own = r => (part.no && r.case ? r.case === part.no : inside(r));   // the reader's own case number; a page can hold two cases
    return { pages: part.to - part.from + 1, rows: read.rows.filter(own), identifiers: read.identifiers.filter(inside) };
}

// One real Case per part: the sent case stays as the first card, so its +0.1 and mirror are untouched. Reviewed cards are never removed.
async function applySplit(db, ref, c, parts, read, FieldValue) {
    const groupId = (c.caseGroup && c.caseGroup.id) || ref.id, base = (c.caseGroup && c.caseGroup.base) || c.caseId;
    const snap = await db.collection('cases').where('caseGroup.id', '==', groupId).get();
    const docs = snap.empty ? [{ ref, data: c }] : snap.docs.map(d => ({ ref: d.ref, data: d.data() })).sort((a, b) => a.data.caseGroup.index - b.data.caseGroup.index);
    if (docs.slice(parts.length).some(d => (d.data.status || 'pending') !== 'pending')) throw new Error('reviewed card');
    const first = docs[0].data, stamp = FieldValue.serverTimestamp(), batch = db.batch();
    docs.slice(parts.length).forEach(d => batch.delete(d.ref));
    parts.forEach((part, i) => {
        const doc = docs[i], total = parts.length;
        const fields = {
            caseId: total > 1 ? `${base} · ${i + 1}/${total}` : base,
            caseGroup: total > 1 ? { id: groupId, base, index: i + 1, total, from: part.from, to: part.to, title: part.title, filePages: read.pages } : FieldValue.delete(),
            caseFile: first.caseFile,
            caseFileRead: { status: 'done', model: MODEL, at: stamp, ...partRead(read, part) }
        };
        if (doc) { batch.update(doc.ref, fields); return; }
        const { authUid, userId, displayName, pictureUrl, customer, customerTel, disease, diseaseSystemKey, diseaseSystemLabel, timestamp } = first;
        batch.set(db.collection('cases').doc(), { authUid, userId, displayName, pictureUrl, customer, customerTel, disease, diseaseSystemKey, diseaseSystemLabel, symptomTags: [], note: '', status: 'pending', timestamp, ...fields });
    });
    await batch.commit();
    return parts.length;
}

async function readPdf(buf, apiKey) {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: { parts: [{ text: SYSTEM }] }
    }, { timeout: 100000 });
    const parts = (((res.data.candidates || [])[0] || {}).content || {}).parts;
    const usage = res.data.usageMetadata || {};
    return { read: parseRead((parts || []).map(p => p.text || '').join('')), inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0, tokens: usage.totalTokenCount || 0 };
}

module.exports = { MODEL, MAX_BYTES, allowedPath, parseRead, readPdf, validParts, partRead, applySplit };
