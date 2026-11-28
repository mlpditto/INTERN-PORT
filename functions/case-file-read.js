// V102.547: the PDF an intern attaches to a Case. Gemini reads it right after Send, so the admin opens Review with the text ready.
// Text only: never a score, never a verdict. The pages go to Google; the patient's identifiers must not come back into Firestore.
// V102.550: only an admin's retry can pick another reader, and only then do the pages go to that vendor.
// V102.713 (owner 2026-11-28): the read after Send is iApp OpenThai OCR (Thai print, tables) → Gemini on the TEXT only, with the same rules: it
// sorts the lines under their headings and writes [hidden] for any patient identifier, so the raw OCR text (which still has names) is never
// stored. Too little text from iApp (handwriting) → Gemini reads the page itself, as before. A case file may now be a photo (JPEG / PNG / WebP).
const axios = require('axios');
const { extractJson } = require('./modern-ai');

const MODEL = 'gemini-3.8-flash', IAPP = 'iapp-gemini';
const READERS = { [IAPP]: 'iapp', [MODEL]: 'gemini-aistudio', 'claude-opus-5-5': 'anthropic', 'gpt-6-sol': 'openai' };   // Thai hard-word test 3/3 on 2026-09-25
const TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const THIN = 40;   // fewer letters than this per page from iApp = probably handwriting → Gemini reads the page
const LIM = { rows: 240, label: 60, text: 1000, marks: 20, parts: 20 };
const MAX_OUT = 32000, TIMEOUT = 270000;
const KINDS = ['hn', 'name', 'id', 'address', 'phone'];

const PROMPT = 'This PDF is a pharmacy intern\'s case log, typed, scanned or handwritten, in Thai and English. Copy what is written, line by line, in reading order, in the same language. '
    + 'Do not correct, translate, summarise or judge it. Use the printed heading as the label when there is one (CC, HPI, PMH, U/D, MH, ALL, DRPs, Plan, Assessment), otherwise "Note". '
    + 'Set unsure true on a line when you cannot read it with confidence. '
    + 'NEVER copy a patient name, HN, national ID number, address or phone number: write [hidden] in its place and add one entry to identifiers with its page and kind. '
    + 'A black bar or a covered area is not an identifier. Do not guess a covered value. '
    + 'One file can hold several patient cases. A case often starts halfway down a page and runs onto the next. List every case in cases, in reading order, with a short clinical title (never an identifier) and pageFrom, pageTo: two cases can share a page. Give every row its case number, starting at 1. Always give your best split: the admin checks it.';
// the same job on iApp's text: no page is sent, only what iApp read (it still holds names — they must not come back)
const TEXT_PROMPT = 'Below is the OCR text (Markdown, tables as HTML) of a pharmacy intern\'s case log, in Thai and English, page by page after "=== page N ===". ' + PROMPT.replace(/^This PDF is a pharmacy intern\'s case log, typed, scanned or handwritten, in Thai and English\. /, '')
    + ' Set unsure true on a line whose OCR text looks broken or garbled.';
const SYSTEM = 'Answer ONLY with JSON of the form {"pages":3,"rows":[{"page":1,"case":1,"label":"CC","text":"...","unsure":false}],"identifiers":[{"page":1,"kind":"hn"}],"cases":[{"title":"COPD exacerbation","pageFrom":1,"pageTo":3}]}. kind is one of hn, name, id, address, phone.';

function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max); }

// only this intern's own folder, one flat file name: the path comes from a field the intern wrote
function allowedPath(path, authUid) {
    return !!authUid && typeof path === 'string' && path.startsWith('case-files/' + authUid + '/') && /^case-files\/[^/]+\/[A-Za-z0-9_-]+\.(pdf|jpg|png|webp)$/.test(path);
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
            caseFileRead: { status: 'done', model: read.model || MODEL, at: stamp, ...partRead(read, part) }
        };
        if (doc) { batch.update(doc.ref, fields); return; }
        const { authUid, userId, displayName, pictureUrl, customer, customerTel, disease, diseaseSystemKey, diseaseSystemLabel, timestamp } = first;
        batch.set(db.collection('cases').doc(), { authUid, userId, displayName, pictureUrl, customer, customerTel, disease, diseaseSystemKey, diseaseSystemLabel, symptomTags: [], note: '', status: 'pending', timestamp, ...fields });
    });
    await batch.commit();
    return parts.length;
}

async function readClaude(data, key, model, mime = 'application/pdf') {
    const file = mime === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: mime, data } } : { type: 'image', source: { type: 'base64', media_type: mime, data } };
    const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model, max_tokens: MAX_OUT, output_config: { effort: 'low' }, system: SYSTEM, fallbacks: 'default',
        messages: [{ role: 'user', content: [file, { type: 'text', text: PROMPT }] }]
    }, { timeout: TIMEOUT, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'Content-Type': 'application/json' } });
    const u = res.data.usage || {}, text = (res.data.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('');
    return { read: parseRead(extractJson(text)), inputTokens: u.input_tokens || 0, outputTokens: u.output_tokens || 0, tokens: (u.input_tokens || 0) + (u.output_tokens || 0) };
}

async function readOpenAI(data, key, model, mime = 'application/pdf') {
    const file = mime === 'application/pdf' ? { type: 'input_file', filename: 'case.pdf', file_data: 'data:application/pdf;base64,' + data } : { type: 'input_image', image_url: 'data:' + mime + ';base64,' + data };
    const res = await axios.post('https://api.openai.com/v1/responses', {
        model, store: false, reasoning: { effort: 'low' }, instructions: SYSTEM, text: { format: { type: 'json_object' } }, max_output_tokens: MAX_OUT,
        input: [{ role: 'user', content: [file, { type: 'input_text', text: PROMPT }] }]
    }, { timeout: TIMEOUT, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
    const u = res.data.usage || {}, text = (res.data.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text || '').join('');
    return { read: parseRead(extractJson(text)), inputTokens: u.input_tokens || 0, outputTokens: u.output_tokens || 0, tokens: u.total_tokens || 0 };
}

async function readGemini(part, key) {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
        contents: [{ role: 'user', parts: [part.inlineData ? part : { text: part.text }, { text: part.inlineData ? PROMPT : TEXT_PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: { parts: [{ text: SYSTEM }] }
    }, { timeout: TIMEOUT });
    const parts = (((res.data.candidates || [])[0] || {}).content || {}).parts;
    const usage = res.data.usageMetadata || {};
    return { read: parseRead((parts || []).map(p => p.text || '').join('')), inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0, tokens: usage.totalTokenCount || 0 };
}

// iApp OpenThai OCR Markdown: the file → "=== page N ===" sections. Never stored, never logged: it still holds the patient's details.
async function iappText(buf, mime, key) {
    const form = new FormData();
    form.append('file', new Blob([buf], { type: mime }), 'case.' + TYPES[mime]);
    const res = await axios.post('https://api.iapp.co.th/v3/store/ocr/document/markdown', form, { headers: { apikey: key }, timeout: 150000, maxBodyLength: Infinity, maxContentLength: Infinity });
    const d = res.data || {}, pages = Array.isArray(d.pages) && d.pages.length ? d.pages : [{ page: 1, markdown: String(d.markdown || '') }];
    const text = pages.map((p, i) => '=== page ' + (Number(p.page) || i + 1) + ' ===\n' + String(p.markdown || '')).join('\n\n');
    const letters = pages.reduce((n, p) => n + String(p.markdown || '').replace(/<[^>]+>|[\s#*|>_-]/g, '').length, 0);
    return { text, pages: (d.iapp && Number(d.iapp.page)) || pages.length, thin: letters / pages.length < THIN };
}

// out.model = the reader that really answered: iApp → Gemini text, or Gemini on the page when iApp's text was too thin or iApp failed
async function readFile(buf, keys, model = IAPP, mime = 'application/pdf') {
    const data = buf.toString('base64');
    if (READERS[model] === 'anthropic') return { ...(await readClaude(data, keys.anthropic, model, mime)), model };
    if (READERS[model] === 'openai') return { ...(await readOpenAI(data, keys.openai, model, mime)), model };
    if (READERS[model] === 'iapp' && keys.iapp) {
        let ocr = null;
        try { ocr = await iappText(buf, mime, keys.iapp); } catch (e) { console.warn('[case-file-read] iApp', e.response ? e.response.status : e.message); }
        if (ocr && !ocr.thin) return { ...(await readGemini({ text: ocr.text }, keys.gemini)), model: IAPP, iappPages: ocr.pages };
    }
    return { ...(await readGemini({ inlineData: { mimeType: mime, data } }, keys.gemini)), model: MODEL };
}
const readPdf = (buf, keys, model) => readFile(buf, keys, model || MODEL, 'application/pdf');   // the old name, for anything still calling it

module.exports = { MODEL, IAPP, READERS, TYPES, MAX_BYTES, THIN, TEXT_PROMPT, allowedPath, parseRead, readFile, readPdf, validParts, partRead, applySplit };
