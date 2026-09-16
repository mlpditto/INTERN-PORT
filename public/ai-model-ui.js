// Shared catalog for text tasks, Settings and saved preferences.
(function () {
    const models = window.TEXT_AI_MODELS = [
        { id: 'as/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', hint: 'Gemini รุ่นประหยัด สำหรับงานสั้น' },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', hint: 'Gemini สำหรับวิเคราะห์และสรุปข้อมูล' },
        { id: 'gpt-5.6-luna', label: 'GPT 5.6 Luna', hint: 'GPT รุ่นประหยัด ค่าเริ่มต้นสำหรับงานทั่วไป' },
        { id: 'gpt-5.6-terra', label: 'GPT 5.6 Terra', hint: 'GPT สำหรับงานวิเคราะห์ที่ซับซ้อนขึ้น' },
        { id: 'gpt-5.6-sol', label: 'GPT 5.6 Sol', hint: 'GPT สำหรับงานที่ต้องการรายละเอียดมากขึ้น' },
        { id: 'gpt-6-astra', label: 'GPT 6 Astra', hint: 'GPT รุ่นใหญ่ ใช้เมื่อต้องการความสามารถสูง' },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'Claude รุ่นประหยัด สำหรับงานสั้น' },
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', hint: 'Claude สำหรับงานเขียนและวิเคราะห์' },
        { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', hint: 'Claude สำหรับงานที่ต้องการรายละเอียดมากขึ้น' }
    ];
    window.normalizeTextAIModel = value => models.some(m => m.id === value) ? value : 'gpt-5.6-luna';
    window.textAIModel = id => window.normalizeTextAIModel(document.getElementById(id)?.value);
    window.selectStoredTextAIModel = (button, key) => {
        localStorage.setItem(key, button.dataset.value);
        button.parentElement.querySelectorAll('button').forEach(b => {
            b.classList.toggle('active', b === button);
            b.setAttribute('aria-pressed', String(b === button));
        });
    };
    const bindings = new Map();
    const preferences = {
        'toolbar-ai-translate-model': ['default-translate-model', 'ai_default_translate_model'],
        'ai-analyzer-model-val': ['default-analyzer-model', 'ai_default_analyzer_model'],
        'ai-model-review': ['default-review-model', 'ai_default_review_model'],
        'ai-model-selector': ['default-qfp-model', 'ai_default_qfp_model']
    };
    function options(select) {
        const value = window.normalizeTextAIModel(select.value);
        select.replaceChildren(...models.map(m => new Option(m.label, m.id)));
        select.value = value;
    }
    window.textAIChipContents = (value, action = '') => models.map((m, i) => {
        const provider = m.label.split(' ')[0];
        const heading = i === 0 || models[i - 1].label.split(' ')[0] !== provider
            ? `<span class="text-ai-provider" data-provider="${provider}">${provider}</span>` : '';
        const label = m.label.slice(provider.length + 1).replace('Flash-Lite', 'Lite');
        return `${heading}<button type="button" class="glass-toggle-item${m.id === value ? ' active' : ''}" data-value="${m.id}" aria-label="${m.label}" aria-pressed="${m.id === value}" title="${m.label} — ${m.hint}"${action ? ` onclick="${action}"` : ''}>${label}</button>`;
    }).join('');
    window.textAIChipsHtml = (id, value, action) => `<div class="text-ai-chips lang-no-toggle" role="group" aria-label="AI model"${id ? ` id="${id}"` : ''}>${window.textAIChipContents(value, action)}</div>`;
    window.syncRegistryModelSelect = function (id) {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = window.normalizeTextAIModel(input.value);
        const binding = bindings.get(id);
        binding?.rail.querySelectorAll('[data-value]').forEach(b => {
            const on = b.dataset.value === input.value;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        const pref = preferences[id];
        if (pref) {
            const select = document.getElementById(pref[0]);
            if (select) select.value = input.value;
            bindings.get(pref[0])?.rail.querySelectorAll('[data-value]').forEach(b => {
                b.classList.toggle('active', b.dataset.value === input.value);
                b.setAttribute('aria-pressed', String(b.dataset.value === input.value));
            });
            localStorage.setItem(pref[1], input.value);
        }
        if (binding?.key) localStorage.setItem(binding.key, input.value);
    };
    function bind(id, host, key) {
        const input = document.getElementById(id);
        if (!input || bindings.has(id)) return;
        if (input.tagName === 'SELECT') options(input);
        const pref = preferences[id];
        key = key || pref?.[1];
        input.value = window.normalizeTextAIModel((key && localStorage.getItem(key)) || input.value);
        // Compact controls keep the catalog and persisted preference without a chip rail.
        if (input.hasAttribute('data-native-model')) {
            bindings.set(id, { rail: input, key });
            input.addEventListener('change', () => window.syncRegistryModelSelect(id));
            window.syncRegistryModelSelect(id);
            return;
        }
        if (!host) { host = document.createElement('div'); input.after(host); }
        host.className = 'text-ai-chips lang-no-toggle';
        host.removeAttribute('style');
        host.setAttribute('role', 'group');
        host.setAttribute('aria-label', 'AI model');
        host.dataset.modelInput = id;
        host.parentElement.classList.add('text-ai-row');
        host.parentElement.parentElement?.classList.add('text-ai-row');
        if (id === 'tts-polish-model' && input.previousElementSibling?.matches('i.fa-robot')) input.previousElementSibling.hidden = true;
        host.innerHTML = window.textAIChipContents(input.value);
        host.querySelectorAll('button').forEach(button => {
            button.onclick = () => {
                input.value = button.dataset.value;
                if (pref) window.syncModelDefault(id, input.value);
                window.syncRegistryModelSelect(id);
                input.dispatchEvent(new Event('change', { bubbles: true }));
                if (id === 'laughtale-ai-model' || id === 'storyteller-model-select') {
                    ['laughtale-ai-model', 'storyteller-model-select'].forEach(window.syncRegistryModelSelect);
                }
            };
        });
        if (input.tagName === 'SELECT') input.style.display = 'none';
        bindings.set(id, { rail: host, key });
        input.addEventListener('change', () => window.syncRegistryModelSelect(id));
        window.syncRegistryModelSelect(id);
    }
    window.initRegistryModelSelectors = function () {
        Object.values(preferences).forEach(([id]) => {
            const select = document.getElementById(id);
            if (select) options(select);
        });
        const controls = [
            ['ai-analyzer-model-val', '#ai-analyze-model-toggle'],
            ['toolbar-ai-translate-model', '#ai-translate-model-toggle'],
            ['ai-tagging-model-val', '#unused-tag-rail', 'ai_default_tagging_model'],
            ['ai-model-design-enhancer', '[aria-label="Step 1 enhancer model"]', 'ai_default_design_enhancer_model'],
            ['ai-model-grammar', '.reflective-grammar-model-chip', 'ai_default_grammar_model'],
            ['dxa-ai-model-val', '#dxa-ai-chip-rail', 'ai_default_disease_codex_model'],
            ['alabasta-case-card-refine-model', '.alabasta-casecard-tools-chip-rail', 'ai_default_casecard_refine_model']
        ];
        controls.forEach(([id, selector, key]) => {
            let host = document.querySelector(selector) || document.querySelector(`[onclick*="'${id}'"][data-value]`)?.parentElement;
            if (host?.matches('button')) host = host.parentElement;
            bind(id, host, key);
        });
        const review = document.querySelector('.reflective-model-dd');
        if (review && !bindings.has('ai-model-review')) {
            const host = document.createElement('div'); review.replaceWith(host);
            bind('ai-model-review', host);
        }
        ['research-model-select', 'tts-polish-model', 'laughtale-ai-model', 'storyteller-model-select', 'lp-ai-model', 'apd-model-a', 'apd-model-b', 'case-note-ai-model', 'bp-ai-model'].forEach(id => bind(id, null, 'ai_text_' + id));
        const qfp = document.getElementById('ai-model-selector');
        if (qfp) window.syncModelDefault('ai-model-selector', localStorage.getItem('ai_default_qfp_model') || qfp.value);
        Object.values(preferences).forEach(([id, key]) => bind(id, null, key));
        const description = document.getElementById('model-desc-box');
        if (description) description.hidden = true;
    };
    document.addEventListener('DOMContentLoaded', window.initRegistryModelSelectors);
})();
