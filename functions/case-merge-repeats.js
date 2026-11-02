'use strict';
// V102.569: Jev marks the words of a merged note that only repeat the other note. It answers yes or no per short phrase and never writes text; the admin presses ✓ per phrase.
// Only scrubbed text goes out and the provider is always Jev AI. A phrase the scrub changed is never asked, and a phrase with a number, a drug or a dose word the base note does not have word for word is never asked.
const jev = require('./jev');
const { scrubNote } = require('./case-system-suggest');

const MAX_WORDS = 30, MAX_PHRASES = 60, MAX_LEN = 3, MIN_CHARS = 5, MAX_NOTE = 1200, SURE_AT = 0.8;
const EXACT_ONLY = /[A-Za-z0-9๐-๙×]|มก|มล|เม็ด|ช้อน|ครั้ง/;
const wordsOf = (note) => String(note || '').trim().split(/\s+/).filter(Boolean);
const scrubBoth = (text, a, b) => scrubNote(scrubNote(text, a), b);

// the phrases worth asking: 1 to MAX_LEN words side by side, longest first
function phrasesOf(base, other, at) {
    const words = wordsOf(other.note), baseWords = new Set(wordsOf(base.note)), open = new Set((Array.isArray(at) ? at : []).filter(Number.isInteger).slice(0, MAX_WORDS));
    const out = [];
    open.forEach(i => {
        for (let len = 1; len <= MAX_LEN; len++) {
            const part = words.slice(i, i + len);
            if (part.length < len || !part.every((_, k) => open.has(i + k))) break;
            const text = part.join(' ');
            if (text.length < MIN_CHARS || scrubBoth(text, base, other) !== text) continue;
            if (part.some(w => EXACT_ONLY.test(w) && !baseWords.has(w))) continue;
            out.push({ at: i, len, text });
        }
    });
    return out.sort((x, y) => y.len - x.len || x.at - y.at).slice(0, MAX_PHRASES);
}

// the longest sure phrases that do not overlap
function pick(phrases, answers) {
    const taken = new Set(), out = [];
    phrases.forEach((p, i) => {
        const a = answers && answers['p' + i], n = a && a.noul, spots = Array.from({ length: p.len }, (_, k) => p.at + k);
        if (typeof n === 'number' && n >= SURE_AT && !spots.some(s => taken.has(s))) { spots.forEach(s => taken.add(s)); out.push(p); }
    });
    return out;
}

// deps: { apiKey, fetch }
async function matchRepeats(base, other, at, deps) {
    const phrases = phrasesOf(base, other, at);
    if (!phrases.length) return { ranges: [], inputTokens: 0 };
    const state = { note: scrubBoth(base.note, base, other).slice(0, MAX_NOTE) }, questions = {};
    phrases.forEach((p, i) => {
        state['p' + i] = p.text;
        questions['p' + i] = {
            type: 'noul',
            instructions: `Pharmacy case note in Thai and English. Does the note already state everything in phrase p${i}, with the same meaning? Different wording counts as the same. A negated fact and the positive fact are different. A fragment that is not a full fact does not count.`,
            criteria: { true: 'The note already says this, so the phrase adds nothing.', false: 'The phrase adds something, differs in any detail, or is only a fragment.' },
        };
    });
    const json = await jev.askJevRaw(state, questions, deps.apiKey, deps.fetch, 'jev');
    return { ranges: pick(phrases, json && json.answers), inputTokens: Number(json && json.usage && json.usage.input_tokens) || 0 };
}

module.exports = { phrasesOf, pick, matchRepeats, wordsOf, MAX_WORDS, SURE_AT };
