// V102.488 Phase 2: one table of image-model prices for the chips (Case Card rail, Quiz cover rail).
// Chip text = model name · faint price on the same line. A model with no known price shows nothing.
// `est` = derived from the per-token price, not a billed figure (the chip tooltip says so).
// The Case Card rail is vendor-first: vendor logos, then only that vendor's models (the other chips stay in the DOM, hidden).
(function () {
    const PRICES = {
        'as/gemini-nano-banana-2.1': { shown: '$0.03', note: '$0.034 ต่อรูป 1K (หน้าราคา Google AI Studio)' },
        'as/gemini-3.1-flash-lite-image': { shown: '≈$0.04', est: true, note: 'ประมาณจากราคาต่อ token ใน OpenRouter' },
        'as/gemini-3-pro-image': { shown: '≈$0.13', est: true, note: 'ประมาณจากราคาต่อ token ใน OpenRouter' },
        'gpt-image-2.5-sunburst': { shown: '≈$0.04–0.08', est: true, note: 'ประมาณตามเรตของ Image 2' },
        'or/openai/gpt-5.4-image-2': { shown: '$0.04–0.08', note: 'GPT-5.4 Image 2' }
        // no entry = price not known yet (GPT Image 2.5 Flare, Grok Imagine 2.0, Seedream 5.0 Lite): the chip shows no price
    };
    const VENDORS = [['gemini', 'Gemini', /gemini/], ['openai', 'OpenAI', /gpt-/], ['grok', 'Grok', /grok/]];
    const vendorOf = id => (VENDORS.find(v => v[2].test(id)) || [])[0];
    window.IMAGE_MODEL_PRICES = PRICES;
    window.imagePriceHtml = id => {
        const p = PRICES[id];
        return p ? `<i class="gm-price">${p.shown}</i>` : '';
    };
    window.imagePriceTitle = id => {
        const p = PRICES[id];
        return p ? ` · ${p.shown} ต่อรูป${p.est ? ' (ประมาณ)' : ''} — ${p.note}` : '';
    };
    function showVendor(rail, owner) {
        rail.querySelectorAll('.gm-vendor').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vendor === owner)));
        rail.querySelectorAll('button[data-value]').forEach(b => { b.hidden = vendorOf(b.dataset.value) !== owner; });
    }
    // Case Card rail chips are static markup: add the price from the table and fold the rail into vendor logos first.
    window.paintImageChips = () => {
        const rail = document.getElementById('alabasta-case-card-quick-rail');
        if (!rail || rail.dataset.priced) return;
        rail.dataset.priced = '1';
        const chips = [...rail.querySelectorAll('button[data-value]')];
        chips.forEach(b => {
            b.insertAdjacentHTML('beforeend', window.imagePriceHtml(b.dataset.value));
            b.title += window.imagePriceTitle(b.dataset.value);
        });
        const owners = VENDORS.filter(v => chips.some(b => vendorOf(b.dataset.value) === v[0]));
        const bar = document.createElement('span');
        bar.className = 'gm-vendors'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Image model vendor');
        bar.innerHTML = owners.map(([owner, name]) => `<button type="button" class="gm-vendor" data-vendor="${owner}" aria-pressed="false" aria-label="${name}" title="${name}"><span class="text-ai-logo" data-owner="${owner}" aria-hidden="true"></span></button>`).join('');
        bar.addEventListener('click', e => { const v = e.target.closest('.gm-vendor'); if (v) showVendor(rail, v.dataset.vendor); });
        const label = rail.querySelector('.alabasta-genmage-quick-label');
        if (label) label.after(bar); else rail.prepend(bar);
        const follow = () => { const on = rail.querySelector('button[data-value].active'); showVendor(rail, on ? vendorOf(on.dataset.value) : owners[0][0]); };
        follow();
        // syncAlabastaCaseCardQuickRail() moves `.active` from outside: the vendor tab follows the picked model
        new MutationObserver(follow).observe(rail, { subtree: true, attributes: true, attributeFilter: ['class'] });
    };
    document.addEventListener('DOMContentLoaded', () => window.paintImageChips());
})();
