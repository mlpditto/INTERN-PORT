'use strict';
// Jev (System One, a decision model) suggests an Explore shop's CATEGORY — one Choice question per shop, ≈ $0.00002 each. Admin-only and suggest-only: the page
// shows a lavender "Jev" chip and the admin ticks what to save. Keys are the same as RL_CATEGORIES (admin.html) / EXPLORE_CATS (index.html).
// Live probe 2026-10-15 on the 18 Explore shops with the NAME alone: confident answers (≥ 0.8) were right; Emily / BEARHOUSE / PRE&PRO / Bincho came back at 0.29–0.39 —
// so a page title + description (read from the shop's own link, best effort) is added to the state, and low confidence is shown unticked.
const jev = require('./jev');

const CRITERIA = {
    meat: 'Grilled / barbecue / steak / meat-focused restaurants (yakiniku, BBQ, grill)',
    noodle: 'Noodle shops: noodle soups, dry noodles, pasta, ramen, suki',
    rice: 'Rice dishes: chicken rice, rice bowls and toppings, fried rice, curry on rice, set meals',
    sweet: 'Desserts, cakes, chocolate, ice cream, bakery, snacks',
    drink: 'Tea, coffee, bubble tea, juice, smoothies, drink-only shops',
    health: 'Healthy food: salad, clean food, vegan, bowls, protein meals',
    fast: 'Fast food and burgers: fried chicken, burgers, pizza, kebabs, sandwiches',
};
const KEYS = Object.keys(CRITERIA);
const MAX_SHOPS = 40;
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

// shops: [{ id, title, url }]; deps: { apiKey, fetch, provider, readIdentity(url) → { title, description } }
// → { results: [{ id, ok, category, confidence, options:[{ key, p }] }], inputTokens, cost }
async function classifyShops(shops, deps) {
    if (!Array.isArray(shops) || !shops.length) return { results: [], inputTokens: 0, cost: 0 };
    if (shops.length > MAX_SHOPS) throw new Error('too many shops');
    const provider = jev.providerOf(deps.provider);
    const results = new Array(shops.length);
    let next = 0, inputTokens = 0, cost = 0;
    const worker = async () => {
        while (next < shops.length) {
            const i = next++;
            const sh = shops[i] || {};
            const id = String(sh.id || ''), name = clip(sh.title, 120);
            if (!id || !name) { results[i] = { id, ok: false }; continue; }
            let page = {};
            if (deps.readIdentity && /^https?:\/\//i.test(String(sh.url || ''))) {
                try { page = (await deps.readIdentity(String(sh.url))) || {}; } catch (e) { page = {}; }   // best effort: the name alone is enough
            }
            const state = { shop_name: name, context: 'A food or drink shop in Thailand sold through the LINE MAN delivery app' };
            if (page.title) state.page_title = clip(page.title, 160);
            if (page.description) state.page_description = clip(page.description, 300);
            try {
                const json = await jev.askJevRaw(state, { category: { type: 'choice', instructions: 'Which category best describes what this shop mainly sells?', criteria: CRITERIA } }, deps.apiKey, deps.fetch, provider);
                const a = json && json.answers && json.answers.category;
                if (!a || !KEYS.includes(a.choice)) { results[i] = { id, ok: false }; continue; }
                const probs = a.probabilities && typeof a.probabilities === 'object' ? a.probabilities : {};
                const options = KEYS.map(key => ({ key, p: Number(probs[key]) || 0 })).sort((x, y) => y.p - x.p).slice(0, 3);
                inputTokens += Number(json.usage && json.usage.input_tokens) || 0;
                cost += Number(json.usage && json.usage.cost) || 0;
                results[i] = { id, ok: true, category: a.choice, confidence: typeof a.confidence === 'number' ? a.confidence : null, options, usedPage: !!(page.title || page.description) };
            } catch (e) { results[i] = { id, ok: false }; }
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, shops.length) }, worker));
    return { results, inputTokens, cost };
}

module.exports = { classifyShops, CRITERIA, KEYS, MAX_SHOPS };
