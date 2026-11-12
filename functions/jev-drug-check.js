'use strict';
// V102.638 (owner pick: AI Review + Jev in the Drug Codex "tabs unverified" gate). Jev answers two narrow yes/no questions for the admin:
//   on_topic     — is this tab's text about THIS drug (or its own class), with nothing that belongs to another drug?  (a paste / AI mix-up)
//   same_meaning — does the Thai Education text say the same as the English one (doses, numbers, warnings)?
// Suggest-only: it returns scores and writes nothing to the drug. Jev gives no reasons — the AI Review beside it does.
// The thresholds are borrowed from the quiz check (BAD_BELOW / LOOK_BELOW) and are NOT calibrated on drug text yet.
const crypto = require('crypto');
const { askJevRaw, JEV_MODEL, providerOf } = require('./jev');
const { verdictOf, BAD_BELOW, LOOK_BELOW } = require('./jev-quiz-check');

const MAX_SECTIONS = 8, MAX_LANGS = 3, MAX_TEXT = 2000;
const SECTION_KEYS = ['core', 'clinical', 'moa', 'pk', 'edu', 'refs'];
const LANG_FIELDS = ['monitoring', 'patientCounseling', 'pearls'];
const QUESTIONS = {
    topic: { on_topic: { type: 'noul', instructions: 'drug is the name of a medicine and section is one tab of that medicine\'s reference entry (for example clinical use, pharmacokinetics or patient education). Is all of the section about this drug or its own drug class, with nothing in it that describes a different drug?', criteria: { true: 'All of it is about this drug (or its own class).', false: 'Some or all of it describes a different drug.' } } },
    lang: { same_meaning: { type: 'noul', instructions: 'source (English) and translation (Thai) are the same drug-education text for one medicine. Does the translation keep the same meaning, with no point added, dropped or changed — especially doses, numbers, timings and warnings?', criteria: { true: 'Same meaning.', false: 'A point is added, dropped or changed.' } } },
};

const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const hash = (kind, state) => 'dc' + crypto.createHash('sha1').update(JEV_MODEL + '|' + kind + '|' + JSON.stringify(state)).digest('hex');

// input: { name, sections: { core|clinical|...: text }, langs: { patientCounseling|pearls|monitoring: { en, th } } }
function planDrugCheck(input) {
    const drug = clean(input && input.name, 120), items = [];
    if (!drug) return { items, drug };
    const sections = (input && typeof input.sections === 'object' && input.sections) || {};
    Object.keys(sections).filter(k => SECTION_KEYS.includes(k)).slice(0, MAX_SECTIONS).forEach(k => {
        const section = clean(sections[k], MAX_TEXT);
        if (!section) return;
        const state = { drug, section_title: k, section };
        items.push({ kind: 'topic', key: hash('topic', state), id: k, state });
    });
    const langs = (input && typeof input.langs === 'object' && input.langs) || {};
    Object.keys(langs).filter(k => LANG_FIELDS.includes(k)).slice(0, MAX_LANGS).forEach(k => {
        const en = clean(langs[k] && langs[k].en, MAX_TEXT), th = clean(langs[k] && langs[k].th, MAX_TEXT);
        if (!en || !th) return;
        const state = { source: en, translation: th };
        items.push({ kind: 'lang', key: hash('lang', state), id: k, state });
    });
    return { items, drug };
}

// deps: { apiKey, provider, fetch, readCache(keys) -> { key: score }, writeCache([{ key, score }]) }
async function checkDrug(input, deps) {
    const plan = planDrugCheck(input), provider = providerOf(deps.provider);
    if (!plan.items.length) return { sections: {}, langs: {}, calls: 0, inputTokens: 0, errors: 0, provider, calibrated: false };
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
    if (fresh.size && deps.writeCache) await deps.writeCache([...fresh].map(([key, score]) => ({ key, score })));
    const out = { sections: {}, langs: {}, calls: todo.length, inputTokens, errors: 0, provider, calibrated: false };
    plan.items.forEach(it => {
        const score = cache[it.key] != null ? cache[it.key] : fresh.get(it.key);
        if (score == null) { out.errors++; return; }
        (it.kind === 'topic' ? out.sections : out.langs)[it.id] = { score: Math.round(score * 100) / 100, verdict: verdictOf(score) };
    });
    return out;
}

module.exports = { planDrugCheck, checkDrug, QUESTIONS, SECTION_KEYS, LANG_FIELDS, BAD_BELOW, LOOK_BELOW };
