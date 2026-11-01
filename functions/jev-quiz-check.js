'use strict';
// Jev reads a saved quiz for the admin: does each explanation support the marked answer, and does each translation say the same thing?
// Suggest-only: it returns verdicts and writes nothing to the quiz. Thresholds from a run on 2026-11-01 on 30 real questions, stored key vs key moved to
// another option: stored 0.41-0.99, moved 0.02-0.13, so below 0.35 caught 30/30 with no false alarm. A translation that no longer fits the source needs no AI.
const crypto = require('crypto');
const { askJevRaw, JEV_MODEL, providerOf } = require('./jev');

const BAD_BELOW = 0.35, LOOK_BELOW = 0.7;
const MAX_ITEMS = 120, LANGS = ['th', 'ko', 'ja', 'zh'];
const QUESTIONS = {
    key: { key_fits: { type: 'noul', instructions: 'A quiz question is given with its options, the option marked as the answer, and the written explanation. Does the explanation support the marked answer, rather than a different option?', criteria: { true: 'The explanation supports the marked answer.', false: 'The explanation points to a different option or contradicts the marked answer.' } } },
    lang: { same_meaning: { type: 'noul', instructions: 'source and translation are the same quiz question in two languages. Does the translation keep the same meaning in the question and in every option, in the same order?', criteria: { true: 'Same meaning, same option order.', false: 'A meaning, a number, a drug name or the option order differs.' } } },
};

const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const opts = o => (Array.isArray(o) ? o : []).slice(0, 8).map(v => clean(v, 300));
const hash = (kind, state) => 'qc' + crypto.createHash('sha1').update(JEV_MODEL + '|' + kind + '|' + JSON.stringify(state)).digest('hex');
function verdictOf(score) { return typeof score !== 'number' || !isFinite(score) ? 'unsure' : score < BAD_BELOW ? 'bad' : score < LOOK_BELOW ? 'look' : 'ok'; }

// the same signature admin.html and index.html stamp on a translation (qtSrcSig)
function srcSig(q) {
    const s = [(q && q.q) || '', ...((q && q.options) || []), (q && q.content) || ''].join('\u0001');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

// What to ask, and what is already known without asking.
function planCheck(quiz) {
    const questions = Array.isArray(quiz && quiz.questions) ? quiz.questions : [];
    const items = [], found = [];
    let noExplanation = 0;
    questions.forEach((q, i) => {
        const options = opts(q.options), marks = (Array.isArray(q.correct) ? q.correct : []).filter(n => options[n]);
        if (!options.length || !marks.length) return;   // short answer, poll, or no key: the save check owns that
        const explanation = clean(q.explanation, 1500);
        if (!explanation) { noExplanation++; return; }
        const state = { question: clean(q.q, 800), options, explanation, marked_answer: marks.map(n => options[n]).join(' + ') };
        items.push({ kind: 'key', q: i, state, key: hash('key', state) });
    });
    LANGS.forEach(lang => {
        const list = quiz && quiz.translations && quiz.translations[lang] && quiz.translations[lang].questions;
        if (!Array.isArray(list)) return;
        if (list.length !== questions.length) { found.push({ kind: 'stale', lang, q: null, verdict: 'bad' }); return; }
        list.forEach((t, i) => {
            const q = questions[i];
            if (t.src && t.src !== srcSig(q)) { found.push({ kind: 'stale', lang, q: i, verdict: 'bad' }); return; }
            if (!opts(q.options).length) return;
            const state = { source: { question: clean(q.q, 800), options: opts(q.options) }, translation: { question: clean(t.q, 800), options: opts(t.options) } };
            items.push({ kind: 'lang', lang, q: i, state, key: hash('lang', state) });
        });
    });
    return { items, found, noExplanation, questions: questions.length };
}

// deps: { apiKey, provider, fetch, readCache(keys) -> { key: score }, writeCache([{ key, score }]) }
async function checkQuiz(quiz, deps) {
    const plan = planCheck(quiz), provider = providerOf(deps.provider);
    if (plan.items.length > MAX_ITEMS) plan.items.length = MAX_ITEMS;
    const cache = (await deps.readCache([...new Set(plan.items.map(i => i.key))])) || {};
    const fresh = new Map(), todo = [...new Map(plan.items.filter(i => cache[i.key] == null).map(i => [i.key, i])).values()];
    let next = 0, inputTokens = 0;
    const worker = async () => {
        while (next < todo.length) {
            const it = todo[next++];
            try {
                const json = await askJevRaw(it.state, QUESTIONS[it.kind], deps.apiKey, deps.fetch, provider);
                const a = (json && json.answers) || {}, v = a[Object.keys(QUESTIONS[it.kind])[0]];
                inputTokens += Number(json && json.usage && json.usage.input_tokens) || 0;
                if (v && typeof v.noul === 'number') fresh.set(it.key, v.noul);
            } catch (e) { /* this item stays unchecked; the rest carry on */ }
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
    if (fresh.size) await deps.writeCache([...fresh].map(([key, score]) => ({ key, score })));
    let errors = 0;
    const results = plan.items.flatMap(it => {
        const score = cache[it.key] != null ? cache[it.key] : fresh.get(it.key);
        if (score == null) { errors++; return []; }
        const verdict = verdictOf(score);
        return verdict === 'ok' ? [] : [{ kind: it.kind, lang: it.lang || null, q: it.q, score: Math.round(score * 100) / 100, verdict }];
    });
    const order = { bad: 0, look: 1, unsure: 2 };
    const flags = [...plan.found, ...results].sort((a, b) => order[a.verdict] - order[b.verdict] || (a.q == null ? -1 : a.q) - (b.q == null ? -1 : b.q));
    return { flags, checked: plan.items.length - errors, errors, noExplanation: plan.noExplanation, questions: plan.questions, calls: todo.length, inputTokens, provider };
}

module.exports = { checkQuiz, planCheck, verdictOf, srcSig, BAD_BELOW, LOOK_BELOW, MAX_ITEMS };
