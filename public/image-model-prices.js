// V102.488 Phase 2: one table of image-model prices for the chips (Case Card rail, Quiz cover rail).
// Chip text = [vendor logo] model name · faint price on the same line. A model with no known price shows nothing.
// `est` = derived from the per-token price, not a billed figure (the chip tooltip says so).
(function () {
    const PRICES = {
        'as/gemini-nano-banana-2.1': { shown: '$0.03', note: '$0.034 ต่อรูป 1K (หน้าราคา Google AI Studio)' },
        'as/gemini-3.1-flash-lite-image': { shown: '≈$0.04', est: true, note: 'ประมาณจากราคาต่อ token ใน OpenRouter' },
        'as/gemini-3-pro-image': { shown: '≈$0.13', est: true, note: 'ประมาณจากราคาต่อ token ใน OpenRouter' },
        'gpt-image-2.5-sunburst': { shown: '≈$0.04–0.08', est: true, note: 'ประมาณตามเรตของ Image 2' },
        'or/openai/gpt-5.4-image-2': { shown: '$0.04–0.08', note: 'GPT-5.4 Image 2' }
        // no entry = price not known yet (GPT Image 2.5 Flare, Grok Imagine 2.0, Seedream 5.0 Lite): the chip shows no price
    };
    const LOGO = [[/gemini/, 'gemini'], [/gpt-/, 'openai'], [/grok/, 'grok']];
    window.IMAGE_MODEL_PRICES = PRICES;
    window.imagePriceHtml = id => {
        const p = PRICES[id];
        return p ? `<i class="gm-price">${p.shown}</i>` : '';
    };
    window.imagePriceTitle = id => {
        const p = PRICES[id];
        return p ? ` · ${p.shown} ต่อรูป${p.est ? ' (ประมาณ)' : ''} — ${p.note}` : '';
    };
    // Case Card rail chips are static markup: add the vendor logo and the price from the table.
    window.paintImageChips = root => {
        (root || document).querySelectorAll('#alabasta-case-card-quick-rail button[data-value]').forEach(b => {
            if (b.dataset.priced) return;
            b.dataset.priced = '1';
            const id = b.dataset.value, owner = (LOGO.find(([re]) => re.test(id)) || [])[1];
            if (owner) b.insertAdjacentHTML('afterbegin', `<span class="text-ai-logo" data-owner="${owner}" aria-hidden="true"></span>`);
            b.insertAdjacentHTML('beforeend', window.imagePriceHtml(id));
            b.title += window.imagePriceTitle(id);
        });
    };
    document.addEventListener('DOMContentLoaded', () => window.paintImageChips());
})();
