// Admin ▸ Drug Codex form: which AI model filled the entry (🤖) and which models checked it (🔍), kept on the saved entry
// (drug_codex.aiDraftedModel / aiReviewedModels) — and a one-tap "check again with another model" in the AI Review panel.
// The 🔁 picks a model from a DIFFERENT provider than the one that filled / already checked (a second opinion from the same family is not one).
(function () {
    const state = { fill: null, review: [] };
    const MAX_REVIEWS = 4;
    const bare = (id) => String(id || '').replace(/^(as|or)\//, '').trim();
    const models = () => (Array.isArray(window.TEXT_AI_MODELS) ? window.TEXT_AI_MODELS : []);
    const entry = (id) => { const b = bare(id); return models().find(m => m.id === id) || models().find(m => bare(m.id) === b) || null; };
    const label = (id) => { const m = entry(id); return m ? (m.short || m.label) : bare(id); };
    const full = (id) => { const m = entry(id); return m ? m.label : bare(id); };
    const provider = (id) => { const m = entry(id); return m ? String(m.label).split(' ')[0] : bare(id).split(/[-/]/)[0]; };
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));
    const same = (a, b) => !!a && !!b && bare(a) === bare(b);

    function render() {
        const el = document.getElementById('dca-form-ai-trail');
        if (!el) return;
        if (!state.fill && !state.review.length) { el.hidden = true; el.innerHTML = ''; return; }
        el.hidden = false;
        const chips = [];
        if (state.fill) chips.push(`<span class="at-chip" title="Filled by ${esc(full(state.fill))} · เติมโดย AI">🤖 ${esc(label(state.fill))}</span>`);
        state.review.forEach(id => {
            const dup = same(id, state.fill);
            chips.push(`<span class="at-chip${dup ? ' warn' : ''}" title="${dup ? 'Same model that filled this — use another to cross-check · ตรวจด้วยโมเดลเดียวกับที่เติม' : 'Checked by ' + esc(full(id)) + ' · ตรวจโดย AI'}">🔍 ${esc(label(id))}${dup ? ' ⚠' : ''}</span>`);
        });
        el.innerHTML = chips.join('');
    }

    // a model that shares no provider with the filler or any earlier checker; else any unused one; else null
    function other() {
        const used = [state.fill].concat(state.review).filter(Boolean);
        const free = models().filter(m => !used.some(u => same(u, m.id)));
        const seenProviders = new Set(used.map(provider));
        const fresh = free.find(m => !seenProviders.has(String(m.label).split(' ')[0]));
        return (fresh || free[0] || {}).id || null;
    }

    window.dcaAiTrail = {
        // the form was filled from a saved entry / a draft / a merge: read what it carries
        load(data) {
            state.fill = (data && data.aiDraftedModel) ? String(data.aiDraftedModel) : null;
            state.review = Array.isArray(data && data.aiReviewedModels) ? data.aiReviewedModels.map(String).filter(Boolean).slice(0, MAX_REVIEWS) : [];
            render();
        },
        addReview(id) {
            if (!id) return;
            state.review = state.review.filter(x => !same(x, id)).concat(String(id)).slice(-MAX_REVIEWS);
            render();
        },
        state: () => ({ fill: state.fill, review: state.review.slice() }),
        // fields to keep on the saved entry (nothing new when no AI touched it)
        payload() {
            const p = {};
            if (state.fill) p.aiDraftedModel = state.fill;
            if (state.review.length) p.aiReviewedModels = state.review.slice();
            return p;
        },
        other, label, render,
        // the review panel's model name + 🔁 (the model it was checked with is the last one added)
        panelHtml() {
            const last = state.review[state.review.length - 1];
            const dup = same(last, state.fill);
            return '<span class="dca-review-disclaimer" title="' + (dup ? 'Same model that filled this — try another' : '') + '">by ' + esc(label(last)) + (dup ? ' ⚠' : '') + '</span>'
                + '<button type="button" class="dca-at-other" onclick="dcaAiReviewDraft({ other: true })" title="Check again with another model · ตรวจซ้ำด้วยโมเดลอื่น" aria-label="Check again with another model">🔁</button>';
        }
    };
})();
