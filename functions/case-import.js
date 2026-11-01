'use strict';
// V102.560: the admin's Import PDF for Alabasta. The page covers names, HN, hospital and stamp in the browser and sends flattened JPEGs only: no PDF, no text layer.
// Nothing is stored here. High / Low come from the printed range by code, never from the AI. A text check runs on the answer as a second net.

const MODEL = 'gemini-3.8-flash';
const MAX_PAGES = 6, MAX_B64 = 2 * 1024 * 1024, TIMEOUT = 120000;
const LIM = { title: 80, field: 40, test: 60, unit: 20, range: 30, note: 400, labs: 80, notes: 20 };

const PROMPT = 'These images are pages of a medical report, in Thai and English, with black bars covering private details. Copy what is printed; do not interpret it. '
    + 'title: a short clinical title such as "Annual health check", never a name or a place. basics: age, sex, heightCm, weightKg, bmi, bp, pulse when printed, otherwise empty. '
    + 'labs: one row per result with test, value, unit and the printed normal range, exactly as printed; leave an empty row out; never invent a value. '
    + 'notes: other findings as short lines. sensitive: findings about sexual or reproductive health or infection status, such as Pap smear or HIV, go here and not in notes. '
    + 'NEVER write a patient, doctor or staff name, HN, ID number, address, phone, e-mail, hospital or clinic name, or the text of a stamp. A black bar is not a value: do not guess under it.';
const SYSTEM = 'Answer ONLY with JSON: {"title":"","basics":{"age":"","sex":"","heightCm":"","weightKg":"","bmi":"","bp":"","pulse":""},"labs":[{"test":"","value":"","unit":"","range":"","page":1}],"notes":[""],"sensitive":[""]}';

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// "12-16", "0.55 - 1.02", "<130", "≤ 5.6", ">40" → { low, high }; anything else is no range
function parseRange(text) {
    const s = clean(text, LIM.range).replace(/,/g, '');
    let m = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
    if (m) return { low: Number(m[1]), high: Number(m[2]) };
    m = s.match(/^[<≤]\s*=?\s*(\d+(?:\.\d+)?)/);
    if (m) return { high: Number(m[1]), strict: s[0] === '<' };
    m = s.match(/^[>≥]\s*=?\s*(\d+(?:\.\d+)?)/);
    if (m) return { low: Number(m[1]), strict: s[0] === '>' };
    return null;
}

// '' | 'high' | 'low' | 'limit': only ever from the printed range
function flagOf(value, range) {
    const v = Number(clean(value, LIM.field).replace(/,/g, '')), r = parseRange(range);
    if (!r || !Number.isFinite(v)) return '';
    if (r.high != null && (v === r.high) && r.strict) return 'limit';
    if (r.low != null && (v === r.low) && r.strict) return 'limit';
    if (r.high != null && v > r.high) return 'high';
    if (r.low != null && v < r.low) return 'low';
    return '';
}

// The second net: what should never be in the text. Kinds only; the matched text is not returned or logged.
function textWarnings(text) {
    const s = String(text || ''), out = [];
    if (/\bHN\b\s*[:#.]?\s*\d|\bH\.N\.|\bAN\b\s*[:#.]?\s*\d/i.test(s)) out.push('hn');
    if (/(^|\D)\d(?:[\s-]?\d){12}(\D|$)/.test(s)) out.push('id');
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) out.push('email');
    if (/(^|\D)0\d{1,2}[\s-]?\d{3}[\s-]?\d{4}(\D|$)/.test(s)) out.push('phone');
    if (/(นาย|นาง|นางสาว|น\.ส\.|นพ\.|พญ\.|ด\.ช\.|ด\.ญ\.)\s*[ก-๙]{2}/.test(s) || /\b(Mr|Mrs|Ms|Dr)\.?\s+[A-Z]/.test(s)) out.push('name');
    if (/โรงพยาบาล|รพ\.|คลินิก|\bhospital\b|\bclinic\b/i.test(s)) out.push('place');
    return out;
}

// null = not usable; never throws
function parseRead(raw) {
    let j;
    try { j = JSON.parse(String(raw || '').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')); } catch (e) { return null; }
    if (!j || typeof j !== 'object') return null;
    const b = j.basics || {};
    const basics = {};
    ['age', 'sex', 'heightCm', 'weightKg', 'bmi', 'bp', 'pulse'].forEach(k => { basics[k] = clean(b[k], LIM.field); });
    const labs = (Array.isArray(j.labs) ? j.labs : []).slice(0, LIM.labs).map(r => {
        const row = { test: clean(r && r.test, LIM.test), value: clean(r && r.value, LIM.field), unit: clean(r && r.unit, LIM.unit), range: clean(r && r.range, LIM.range) };
        return { ...row, flag: flagOf(row.value, row.range) };
    }).filter(r => r.test && r.value);
    const lines = v => (Array.isArray(v) ? v : []).slice(0, LIM.notes).map(x => clean(x, LIM.note)).filter(Boolean);
    const notes = lines(j.notes), sensitive = lines(j.sensitive);
    if (!labs.length && !notes.length) return null;
    const title = clean(j.title, LIM.title) || 'Imported case';
    const warnings = textWarnings([title, Object.values(basics).join(' '), labs.map(r => r.test + ' ' + r.value).join(' '), notes.join(' '), sensitive.join(' ')].join(' '));
    return { title, basics, labs, notes, sensitive, warnings };
}

function validImages(images) {
    return Array.isArray(images) && images.length >= 1 && images.length <= MAX_PAGES
        && images.every(s => typeof s === 'string' && s.length > 100 && s.length <= MAX_B64 && /^\/9j\//.test(s));   // JPEG only: a PDF cannot come through here
}

async function readImages(images, key, post = (...args) => require('axios').post(...args)) {
    const res = await post(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
        contents: [{ role: 'user', parts: images.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })).concat([{ text: PROMPT }]) }],
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: { parts: [{ text: SYSTEM }] }
    }, { timeout: TIMEOUT });
    const parts = (((res.data.candidates || [])[0] || {}).content || {}).parts;
    const u = res.data.usageMetadata || {};
    return { read: parseRead((parts || []).map(p => p.text || '').join('')), inputTokens: u.promptTokenCount || 0, outputTokens: u.candidatesTokenCount || 0, tokens: u.totalTokenCount || 0 };
}

module.exports = { MODEL, MAX_PAGES, PROMPT, parseRange, flagOf, textWarnings, parseRead, validImages, readImages };
