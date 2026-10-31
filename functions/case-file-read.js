// V102.547: the PDF an intern attaches to a Case. Gemini reads it right after Send, so the admin opens Review with the text ready.
// Text only: never a score, never a verdict. The pages go to Google; the patient's identifiers must not come back into Firestore.
const axios = require('axios');

const MODEL = 'gemini-3.8-flash';
const MAX_BYTES = 5 * 1024 * 1024;
const LIM = { rows: 240, label: 40, text: 1000, marks: 20 };
const KINDS = ['hn', 'name', 'id', 'address', 'phone'];

const PROMPT = 'This PDF is a pharmacy intern\'s case log, typed, scanned or handwritten, in Thai and English. Copy what is written, line by line, in reading order, in the same language. '
    + 'Do not correct, translate, summarise or judge it. Use the printed heading as the label when there is one (CC, HPI, PMH, U/D, MH, ALL, DRPs, Plan, Assessment), otherwise "Note". '
    + 'Set unsure true on a line when you cannot read it with confidence. '
    + 'NEVER copy a patient name, HN, national ID number, address or phone number: write [hidden] in its place and add one entry to identifiers with its page and kind. '
    + 'A black bar or a covered area is not an identifier. Do not guess a covered value.';
const SYSTEM = 'Answer ONLY with JSON of the form {"pages":3,"rows":[{"page":1,"label":"CC","text":"...","unsure":false}],"identifiers":[{"page":1,"kind":"hn"}]}. kind is one of hn, name, id, address, phone.';

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
    const rows = j.rows.slice(0, LIM.rows).map(r => ({ page: page(r && r.page), label: clean(r && r.label, LIM.label) || 'Note', text: clean(r && r.text, LIM.text), unsure: !!(r && r.unsure) })).filter(r => r.text);
    const identifiers = (Array.isArray(j.identifiers) ? j.identifiers : []).slice(0, LIM.marks).map(m => ({ page: page(m && m.page), kind: KINDS.includes(m && m.kind) ? m.kind : 'name' }));
    if (!rows.length && !identifiers.length) return null;
    const pages = Math.max(page(j.pages), ...rows.map(r => r.page), ...identifiers.map(m => m.page));
    return { pages, rows, identifiers };
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

module.exports = { MODEL, MAX_BYTES, allowedPath, parseRead, readPdf };
