'use strict';
// V102.562: Jev suggests the Disease System of a waiting case. One Choice question per case, on a button, admin-only and suggest-only: the page shows it and the admin presses ✓.
// Only the scrubbed note goes out, nothing is cached or logged, and the provider is always Jev AI (the owner's OK covers Jev, not the OpenRouter way back).
// Names cannot all be found by a pattern: a name typed with no title and no matching field still goes through. SURE_AT comes from the shop category probe, not from cases.
const jev = require('./jev');

const MAX_CASES = 30, SURE_AT = 0.8, MIN_NOTE = 20, MAX_NOTE = 1200;
const MONTH = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม';
const TITLE = 'นางสาว|น\\.ส\\.|นาย|นาง|คุณ|ด\\.ช\\.|ด\\.ญ\\.|เด็กชาย|เด็กหญิง|Mr\\.?|Mrs\\.?|Ms\\.?|Miss';
const FIELDS = ['caseId', 'caseIdPrev', 'customer', 'customerTel', 'displayName', 'userId', 'email', 'phone'];

// The same rules as scrubAlabastaCaseIdentifiers on the page, always without dates, plus titles, a stated name, places and spaced phone numbers.
function scrubNote(text, c = {}) {
    let s = String(text || '');
    FIELDS.map(k => String(c[k] || '').trim()).filter(v => v.length >= 2).forEach(v => {
        s = s.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[redacted]');
    });
    return s
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(new RegExp('(?:' + TITLE + ')\\s*(?!อายุ)[^\\s,]+(?:\\s+(?!อายุ)[^\\s,]+)?', 'gi'), '[name]')
        .replace(/ชื่อ(?!ยา)\s*[^\s,]+(?:\s+[^\s,]+)?/g, '[name]')
        .replace(/(?:โรงพยาบาล|รพ\.?|คลินิก|บริษัท|Hospital|Clinic)\s*[^\s,]*/gi, '[place]')
        .replace(/(?:^|\s)\d{1,3}\s*[.)]\s*Case\b/gi, ' ')
        .replace(/\b\d{1,2}\s*[/.-]\s*\d{1,2}(?:\s*[/.-]\s*\d{2,4})?\b/g, '[date]')
        .replace(new RegExp('\\d{1,2}\\s*(?:' + MONTH + ')(?:\\s*\\d{2,4})?', 'gi'), '[date]')
        .replace(/\b(?:HN|Ref|Case\s*No\.?)\s*[:#-]?\s*[A-Z0-9-]{3,}/gi, '[ref]')
        .replace(/\+?\d[\d\s-]{7,}\d/g, '[number]')
        .replace(/\b\d{4,}\b/g, '[number]')
        .replace(/\s+/g, ' ').trim();
}

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
function criteriaOf(systems) {
    const out = {};
    (Array.isArray(systems) ? systems : []).slice(0, 30).forEach(s => {
        const key = clip(s && s.key, 40);
        if (key && /^[\w-]+$/.test(key)) out[key] = clip(s.label, 60) + (Array.isArray(s.symptoms) && s.symptoms.length ? ': ' + s.symptoms.slice(0, 12).map(x => clip(x, 40)).join(', ') : '');
    });
    return out;
}

// cases: the Firestore docs with an id; systems: [{ key, label, symptoms }]; deps: { apiKey, fetch }
async function suggestSystems(cases, systems, deps) {
    const criteria = criteriaOf(systems), list = (Array.isArray(cases) ? cases : []).slice(0, MAX_CASES);
    const suggestions = [];
    let next = 0, checked = 0, skipped = 0, errors = 0, inputTokens = 0;
    const worker = async () => {
        while (next < list.length) {
            const c = list[next++], note = scrubNote(c.note, c).slice(0, MAX_NOTE);
            if (note.length < MIN_NOTE) { skipped++; continue; }
            try {
                const json = await jev.askJevRaw({ case_note: note }, { system: { type: 'choice', instructions: 'A pharmacy case note, with identifiers removed. Which body system is the main problem the patient came for?', criteria } }, deps.apiKey, deps.fetch, 'jev');
                const a = json && json.answers && json.answers.system;
                inputTokens += Number(json && json.usage && json.usage.input_tokens) || 0;
                if (!a || !criteria[a.choice]) { errors++; continue; }
                checked++;
                if (a.choice !== 'other' && a.choice !== c.diseaseSystemKey && typeof a.confidence === 'number' && a.confidence >= SURE_AT) suggestions.push({ id: c.id, key: a.choice });
            } catch (e) { errors++; }
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
    return { suggestions, checked, skipped, errors, inputTokens };
}

module.exports = { scrubNote, criteriaOf, suggestSystems, MAX_CASES, SURE_AT, MIN_NOTE };
