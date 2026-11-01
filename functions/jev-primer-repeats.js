'use strict';
// V102.563: Jev looks for the same content under different terms across a quiz's Read first notes. The word check in 📖 All already finds the same term, so those pairs are left out.
// Measured 2026-11-01: whole notes top out at 0.19, term lines work: different term 6/600 at 0.5, about $0.00002 a pair. Suggest-only: it writes nothing to the quiz.
const REPEAT_AT = 0.5, MAX_PRIMERS = 200, MAX_PAIRS = 800, BATCH = 60;
const LINE = /^\s*(?:[-•*]\s*)?\*\*([^*\n]{2,80}?)\*\*\s*[—–:-]?\s*(\S.{8,})$/;
const norm = s => String(s || '').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const wordsOf = s => {   // Thai has no spaces, so its runs count as 4-letter pieces
    const out = new Set(norm(s).match(/[a-z][a-z-]{3,}/g) || []);
    (norm(s).match(/[฀-๿]{4,}/g) || []).forEach(r => { for (let i = 0; i + 4 <= r.length; i++) out.add(r.slice(i, i + 4)); });
    return out;
};

function termLines(primer) {
    return String(primer || '').split('\n').flatMap(ln => {
        const m = ln.trim().match(LINE);
        return m ? [{ term: m[1].trim(), text: norm(ln).slice(0, 500) }] : [];
    });
}

// Every pair across two questions, most shared words first, so a large quiz keeps the likeliest pairs.
function pairsOf(primers) {
    const lines = (Array.isArray(primers) ? primers : []).slice(0, MAX_PRIMERS).flatMap((p, q) => termLines(p).map(l => ({ ...l, q, words: wordsOf(l.text) })));
    const out = [];
    lines.forEach((a, i) => lines.slice(i + 1).forEach(b => {
        if (a.q === b.q || norm(a.term) === norm(b.term) || a.text === b.text) return;
        out.push({ a, b, n: [...a.words].filter(w => b.words.has(w)).length });
    }));
    const total = out.length;
    return { total, pairs: out.sort((x, y) => y.n - x.n).slice(0, MAX_PAIRS) };
}

// compare(pairs) -> { results: [{ sameFact } | { error }] }. A failed batch counts as errors; the rest carry on.
async function findRepeats(primers, compare) {
    const { total, pairs } = pairsOf(primers), repeats = [];
    let errors = 0, inputTokens = 0, calls = 0;
    for (let i = 0; i < pairs.length; i += BATCH) {
        const part = pairs.slice(i, i + BATCH);
        try {
            const out = await compare(part.map(p => ({ a: { stem: p.a.text }, b: { stem: p.b.text } })));
            inputTokens += out.inputTokens || 0; calls += out.calls || 0;
            part.forEach((p, j) => {
                const r = out.results[j];
                if (!r || r.error) errors++;
                else if (r.sameFact >= REPEAT_AT) repeats.push({ q: p.a.q, otherQ: p.b.q, term: p.a.term, otherTerm: p.b.term, score: Math.round(r.sameFact * 100) / 100 });
            });
        } catch (e) { errors += part.length; }
    }
    return { repeats: repeats.sort((x, y) => y.score - x.score), compared: pairs.length, left: total - pairs.length, errors, inputTokens, calls };
}

module.exports = { termLines, pairsOf, findRepeats, REPEAT_AT, MAX_PRIMERS, MAX_PAIRS };
