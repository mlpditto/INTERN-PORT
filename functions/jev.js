'use strict';
// TypeSafe "Jev" (a System One decision model): does question A test the SAME fact as question B?
// Server-side only: the API key (secret JEV_API_KEY) never reaches the page. Jev only SUGGESTS — callers
// show the answer next to the n-gram score and never write anything because of it.
// Evaluation + prompts: memory project_typesafe_jev_eval (2026-09-22: smoke 6/6, control 16/16).
const crypto = require('crypto');

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const JEV_MODEL = 'jev-latest';
const MAX_PAIRS = 60;
const DUP_AT = 0.65, DIFFERENT_AT = 0.35;   // between = unsure (the eval treated ±0.15 around 0.5 as "unsure")

// Same wording as the live "AI Deep Compare": sharing a drug / disease name is NOT redundancy.
const QUESTIONS = {
    same_fact: {
        type: 'noul',
        instructions: 'Do question_a and question_b test the SAME underlying clinical fact or decision point, such that a learner who can answer one already knows the answer to the other? Different wording, a clinical vignette versus a direct question, or Thai versus English still count as the same fact. Judge the fact being tested, not the surface text.',
        criteria: { true: 'Same fact or decision point — answering one gives away the other.', false: 'Different facts, even if the same drug, disease or topic is mentioned.' },
    },
    same_topic: {
        type: 'noul',
        instructions: 'Are question_a and question_b about the SAME specific drug (or the same drug class) or the SAME specific disease, regardless of whether they test the same fact? Two different drugs that merely both treat chronic conditions do NOT count.',
        criteria: { true: 'Same specific drug, drug class, or disease.', false: 'Different drugs and different diseases, even if both are medical.' },
    },
};

const clean = s => String(s == null ? '' : s).replace(/[​‌‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
function sideOf(x) {
    const o = x || {};
    return {
        quiz: clean(o.quiz).slice(0, 120),
        stem: clean(o.stem).slice(0, 600),
        options: (Array.isArray(o.options) ? o.options : []).slice(0, 6).map(v => clean(v).slice(0, 200)),
    };
}
const contentKey = s => JSON.stringify([s.stem, s.options]);

// Symmetric: (a, b) and (b, a) are one pair, and a quiz title change does not invalidate a cached answer.
function normalizePair(pair) {
    const a = sideOf(pair && pair.a), b = sideOf(pair && pair.b);
    const [first, second] = contentKey(a) <= contentKey(b) ? [a, b] : [b, a];
    const key = crypto.createHash('sha1').update(JEV_MODEL + '|' + contentKey(first) + '|' + contentKey(second)).digest('hex');
    return { key, state: { question_a: first, question_b: second }, valid: !!(a.stem && b.stem) };
}

function verdictOf(sameFact) {
    if (typeof sameFact !== 'number' || !isFinite(sameFact)) return 'unsure';
    return sameFact >= DUP_AT ? 'dup' : sameFact <= DIFFERENT_AT ? 'different' : 'unsure';
}

async function askJev(state, apiKey, fetchImpl, attempt = 1) {
    const res = await fetchImpl(JEV_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: JEV_MODEL, state, questions: QUESTIONS }),
    });
    if ((res.status === 429 || res.status === 529) && attempt <= 3) {
        await new Promise(r => setTimeout(r, 400 * 2 ** attempt));   // docs: exponential backoff on 429 / 529
        return askJev(state, apiKey, fetchImpl, attempt + 1);
    }
    if (!res.ok) throw new Error('Jev HTTP ' + res.status);
    const json = await res.json();
    const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    return {
        sameFact: num(json && json.answers && json.answers.same_fact && json.answers.same_fact.noul),
        sameTopic: num(json && json.answers && json.answers.same_topic && json.answers.same_topic.noul),
        inputTokens: num(json && json.usage && json.usage.input_tokens) || 0,
    };
}

// deps: { apiKey, fetch, readCache(keys) → { key: {sameFact, sameTopic} }, writeCache(entries) }
// Returns one entry per input pair, in order: { key, sameFact, sameTopic, verdict, cached } or { key, error: true }.
async function compareBatch(pairs, deps) {
    if (!Array.isArray(pairs) || !pairs.length) return { results: [], inputTokens: 0, calls: 0 };
    if (pairs.length > MAX_PAIRS) throw new Error('too many pairs');
    const norm = pairs.map(normalizePair);
    const cache = (await deps.readCache([...new Set(norm.filter(n => n.valid).map(n => n.key))])) || {};
    const fresh = new Map();
    const todo = [...new Map(norm.filter(n => n.valid && !cache[n.key]).map(n => [n.key, n])).values()];
    let inputTokens = 0, next = 0;
    const worker = async () => {
        while (next < todo.length) {
            const n = todo[next++];
            try {
                const a = await askJev(n.state, deps.apiKey, deps.fetch);
                inputTokens += a.inputTokens;
                if (a.sameFact != null) fresh.set(n.key, { sameFact: a.sameFact, sameTopic: a.sameTopic });
            } catch (e) { /* this pair stays an error entry; the others carry on */ }
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
    if (fresh.size) await deps.writeCache([...fresh].map(([key, v]) => ({ key, ...v, model: JEV_MODEL })));
    const results = norm.map(n => {
        const hit = cache[n.key] || fresh.get(n.key);
        if (!n.valid || !hit) return { key: n.key, error: true };
        return { key: n.key, sameFact: hit.sameFact, sameTopic: hit.sameTopic == null ? null : hit.sameTopic, verdict: verdictOf(hit.sameFact), cached: !!cache[n.key] };
    });
    return { results, inputTokens, calls: todo.length };
}

module.exports = { compareBatch, normalizePair, verdictOf, MAX_PAIRS, JEV_MODEL, DUP_AT, DIFFERENT_AT };
