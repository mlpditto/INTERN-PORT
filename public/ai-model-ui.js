// Shared catalog for text tasks, Settings and saved preferences.
(function () {
    const models = window.TEXT_AI_MODELS = [
        // V101.49: `short` = chip text (name + version). `label` stays the full official name —
        // it is shown elsewhere and the audit toolbar filters on its first word.
        { id: 'as/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', short: 'Lite 3.5', hint: 'Gemini รุ่นประหยัด สำหรับงานสั้น' },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', short: 'Flash 3.8', hint: 'Gemini สำหรับวิเคราะห์และสรุปข้อมูล' },
        // V102.365: Gemini 4 Argon (GA 2026-10-13) via AI Studio — intro $2/$10 per MTok to 2026-11-30, then $4/$20; the proxy sends thinkingLevel low.
        { id: 'as/gemini-4-argon', label: 'Gemini 4 Argon', short: 'Argon 4', hint: 'Gemini รุ่นใหญ่ล่าสุด สำหรับงานวิเคราะห์ซับซ้อน (ราคาแนะนำตัวถึง 30 พ.ย.) · 최신 대형 Gemini, 복잡한 분석용' },
        // V102.242: Gemma 4 26B A4B (Google open weights, MoE with 4B active) via OpenRouter — grouped under the Gemini tab (the tab = the first word of `label`),
        // billed by OpenRouter (isGoogleBilledModel is false for or/google/). Phase 0 probe 2026-10-15: Thai from an image exact, JSON + Thai quiz JSON + Thai translation pass, ~4 s, ~$0.00005 per quiz item.
        { id: 'or/google/gemma-4-26b-a4b-it', label: 'Gemini Gemma 4 26B A4B', short: 'Gemma 4 26B', hint: 'Gemma 4 ของ Google เร็วและประหยัดมาก อ่านภาษาไทยจากรูปได้ ผ่าน OpenRouter 구글 Gemma 4, 매우 빠르고 저렴, OpenRouter 경유' },
        { id: 'gpt-6-luna', label: 'GPT 6 Luna', short: 'Luna 6', hint: 'GPT รุ่นประหยัด ค่าเริ่มต้นสำหรับงานทั่วไป' },
        { id: 'gpt-5.6-terra', label: 'GPT 5.6 Terra', short: 'Terra 5.6', hint: 'GPT สำหรับงานวิเคราะห์ที่ซับซ้อนขึ้น' },
        { id: 'gpt-6.1-sol', label: 'GPT 6.1 Sol', short: 'Sol 6.1', hint: 'GPT สำหรับงานที่ต้องการรายละเอียดมากขึ้น' },
        { id: 'gpt-6-astra', label: 'GPT 6 Astra', short: 'Astra 6', hint: 'GPT รุ่นใหญ่ ใช้เมื่อต้องการความสามารถสูง' },
        { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', short: 'Haiku 5.5', hint: 'Claude รุ่นประหยัด สำหรับงานสั้น' },
        // V102.61: Sonnet 5.5 replaces Sonnet 5 (same price, $2/$10 per MTok); saved Sonnet 5 picks move to it.
        { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', short: 'Sonnet 5.5', hint: 'Claude สำหรับงานเขียนและวิเคราะห์' },
        { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', short: 'Opus 5.5', hint: 'Claude รุ่นใหญ่ ถูกกว่า Fable สำหรับงานวิเคราะห์ที่ซับซ้อน' },
        { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', short: 'Fable 5.1', hint: 'Claude สำหรับงานที่ต้องการรายละเอียดมากขึ้น' },
        { id: 'or/qwen/qwen3.8-flash', label: 'Qwen 3.8 Flash', short: 'Qwen Flash 3.8', hint: 'Qwen รุ่นประหยัด ภาษาไทยดี ผ่าน OpenRouter' },
        { id: 'or/qwen/qwen3.8-max-0902', label: 'Qwen 3.8 Max', short: 'Qwen Max 3.8', hint: 'Qwen รุ่นใหญ่ ภาษาไทยดี สำหรับคัดและเปรียบเทียบข้อสอบ ผ่าน OpenRouter' },
        { id: 'or/deepseek/deepseek-v4.1-flash-1017', label: 'DeepSeek V4.1 Flash', short: 'DeepSeek Flash V4.1', hint: 'DeepSeek รุ่นประหยัด ผ่าน OpenRouter' },
        { id: 'or/deepseek/deepseek-v4-pro-0813', label: 'DeepSeek V4 Pro', short: 'DeepSeek Pro V4', hint: 'DeepSeek รุ่นใหญ่ เหมาะกับงานวิเคราะห์ ผ่าน OpenRouter' },
        // V102.268: Meta Muse Spark Open (open weights, 1M context; text / image / video / audio in, text out) via OpenRouter — its own Muse tab, drawn with the Meta mark.
        { id: 'or/meta/muse-spark-open', label: 'Muse Spark Open', short: 'Muse Spark Open', hint: 'Muse Spark Open ของ Meta (open weights, บริบท 1M) ผ่าน OpenRouter รับภาพ วิดีโอ เสียง เหมาะกับงานโค้ดและงาน agent 메타 Muse Spark Open (오픈 웨이트, 컨텍스트 1M), OpenRouter 경유, 이미지·영상·음성 입력, 코드·에이전트 작업에 적합' }
    ];
    // Official marks (assets/logos, from openai.com/brand and anthropic.com/press-kit). Owners
    // without a small official mark (Qwen, DeepSeek) carry their name in `short` instead.
    // V101.55: Gemini spark (colour mark, via @lobehub/icons-static-svg, MIT). V101.59: the spark names
    // the owner, so Gemini's `short` drops the word like GPT / Claude.
    // V102.11: Qwen / DeepSeek / Grok marks (assets/logos, already on the provider tabs) on every chip too — their
    // `short` keeps the name, since aiModelShortName shows it where no logo is drawn.
    const LOGO_OWNERS = { GPT: 'openai', Claude: 'claude', Gemini: 'gemini', Qwen: 'qwen', DeepSeek: 'deepseek', Grok: 'grok', Muse: 'meta', Kimi: 'kimi' };
    // V101.52: opt-in trial models. Only the audit toolbar offers them; they are NOT in
    // TEXT_AI_MODELS, so no other rail, select, Settings default or normaliser sees them.
    // Grok 4.7 trial (GROK_OPENROUTER_INTEGRATION_PLAN.md step C, 2026-09-24): Audit + Analyze.
    const trialModels = window.TEXT_AI_TRIAL_MODELS = [
        { id: 'or/x-ai/grok-4.7', label: 'Grok 4.7', short: 'Grok 4.7', hint: 'Grok 4.7 (SpaceXAI) รุ่นทดลอง สำหรับ Audit / Analyze ผ่าน OpenRouter' },
        // V102.432: Kimi K3.1 Pro (Moonshot AI, open-weight reasoning, 1M context, text / image / video in) via OpenRouter — $2/$10 per MTok; trial like Grok, so only the audit toolbar offers it.
        { id: 'or/moonshotai/kimi-k3.1-pro', label: 'Kimi K3.1 Pro', short: 'Kimi K3.1 Pro', hint: 'Kimi K3.1 Pro ของ Moonshot AI รุ่นทดลอง (reasoning, บริบท 1M, รับภาพ) ผ่าน OpenRouter Moonshot AI Kimi K3.1 Pro, 실험용 추론 모델, OpenRouter 경유' },
        // V102.76: Ollama on the admin's own computer (ollama-local.js; the browser calls localhost:11434 directly).
        { id: 'ol/local', label: 'Ollama local', short: 'Ollama', hint: 'Ollama บนเครื่องนี้ (localhost:11434) รุ่นทดลอง ใช้ได้เมื่อ Ollama เปิดอยู่และอนุญาตเว็บนี้ใน OLLAMA_ORIGINS — ไม่คิดค่าใช้จ่าย ช้ากว่าโมเดลออนไลน์' }
    ];
    // V101.57: Gemini called directly (Vertex, or AI Studio `as/`) is billed to the Google Cloud
    // billing account; `or/google/…` is billed by OpenRouter. The chip shows it (text-ai-chips.css).
    // V102.463: the chips that READ THAI IN A PICTURE get a Thai-flag border (text-ai-chips.css). Only models measured with Thai image text
    // (2026-09-25 smoke: exact Thai transcription incl. a hard set; Gemma 4 probe 2026-10-15) — an untested model stays plain, and Luna 6 invents Thai (0/3).
    window.THAI_IMAGE_OK = ['gemini-3.8-flash', 'as/gemini-3.5-flash-lite', 'or/google/gemma-4-26b-a4b-it', 'claude-opus-5-5'];
    window.readsThaiImage = id => window.THAI_IMAGE_OK.indexOf(String(id || '')) >= 0;
    window.isGoogleBilledModel = id => /^(gemini-|as\/)/.test(String(id || ''));
    // V101.70: DeepSeek V4 Pro takes text only (OpenRouter input_modalities ["text"]), so image features hide it.
    // V4.1 Flash lists ["text","image"] and read Thai 2/3 in the 2026-09-25 smoke — it stays.
    window.isTextOnlyAIModel = id => /^(or\/deepseek\/deepseek-v4-pro|ol\/)/.test(String(id || ''));   // V102.76: + local Ollama (text only here)
    // V101.64: GPT-6 Luna/Sol replace 5.6, DeepSeek V4 Pro moves to its 0813 GA snapshot — saved picks move to their successor, not to the default.
    // V102.61: Claude Sonnet 5 → Sonnet 5.5.
    const RETIRED_TEXT_AI_MODELS = { 'gpt-5.6-luna': 'gpt-6-luna', 'gpt-5.6-sol': 'gpt-6.1-sol', 'or/deepseek/deepseek-v4-pro': 'or/deepseek/deepseek-v4-pro-0813', 'claude-sonnet-5': 'claude-sonnet-5-5',
        'claude-haiku-4-5': 'claude-haiku-5-5', 'gpt-6-sol': 'gpt-6.1-sol', 'or/deepseek/deepseek-v4.1-flash': 'or/deepseek/deepseek-v4.1-flash-1017' };   // V102.365: Haiku 4.5 → 5.5 · Sol 6 → 6.1 · DeepSeek Flash → the 1017 snapshot
    window.normalizeTextAIModel = value => { value = RETIRED_TEXT_AI_MODELS[value] || value; return models.some(m => m.id === value) ? value : 'gpt-6-luna'; };
    // A trial id stays as-is where a caller explicitly picked it; anything else normalises as before.
    window.resolveTrialTextAIModel = value => trialModels.some(m => m.id === value) ? value : window.normalizeTextAIModel(value);
    window.isTrialTextAIModel = value => trialModels.some(m => m.id === value);
    window.textAIModelInfo = id => models.find(m => m.id === id) || trialModels.find(m => m.id === id);
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
    // V101.20: optional `filter(model)` narrows the rail (e.g. vision-capable chips only).
    // V101.49: lean inline chips — [owner logo] name version; no provider headings. The OpenRouter
    // route shows as the chip border (text-ai-chips.css) and in the tooltip.
    // V101.52: `extra` appends opt-in trial models (audit toolbar only).
    window.textAIChipContents = (value, action = '', filter = null, extra = []) => [...(filter ? models.filter(filter) : models), ...extra].map(m => {
        const owner = LOGO_OWNERS[m.label.split(' ')[0]];
        const logo = owner ? `<span class="text-ai-logo" data-owner="${owner}" aria-hidden="true"></span>` : '';
        const google = window.isGoogleBilledModel(m.id), thai = window.readsThaiImage(m.id);
        return `<button type="button" class="glass-toggle-item${m.id === value ? ' active' : ''}" data-value="${m.id}"${owner ? ` data-vendor="${owner}"` : ''}${google ? ' data-bill="google"' : ''}${thai ? ' data-thai="1"' : ''} aria-label="${m.label}" aria-pressed="${m.id === value}" title="${m.label} · ${m.id}${thai ? ' · พื้นสีธงไทย = อ่านภาษาไทยในรูปได้ (ทดสอบแล้ว)' : ''}${google ? ' · จุดสีฟ้า = ค่าใช้จ่ายเรียกเก็บผ่านบัญชี Google Cloud' : ''} — ${m.hint}"${action ? ` onclick="${action}"` : ''}>${logo}${m.short}</button>`;
    }).join('');
    window.textAIChipsHtml = (id, value, action, extra = []) => `<div class="text-ai-chips lang-no-toggle" role="group" aria-label="AI model"${id ? ` id="${id}"` : ''}>${window.textAIChipContents(value, action, null, extra)}</div>`;
    // V102.487 vendor-first rail: vendor icons first, only that vendor's models below (the other chips stay in the DOM, hidden).
    // Rails that already carry their own provider tabs (.audit-providers / .cmp-vendors) and the AI Settings modal keep their layout.
    const vendorOf = b => (b.getAttribute('aria-label') || '').split(' ')[0];
    function showVendor(rail, vendor) {
        rail.querySelectorAll('.mr-vendor').forEach(v => v.setAttribute('aria-pressed', String(v.dataset.provider === vendor)));
        rail.querySelectorAll(':scope > button').forEach(b => { b.hidden = vendorOf(b) !== vendor; });
    }
    function vendorFirst(rail) {
        const chips = [...rail.querySelectorAll(':scope > button')];
        const vendors = [...new Set(chips.map(vendorOf))];
        const logo = {}; chips.forEach(b => { const o = b.dataset.vendor; if (o && !logo[vendorOf(b)]) logo[vendorOf(b)] = o; });
        const bar = document.createElement('span');
        bar.className = 'mr-vendors'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Model vendor');
        bar.innerHTML = vendors.map(v => `<button type="button" class="mr-vendor" data-provider="${v}" aria-pressed="false" aria-label="${v}" title="${v}">${logo[v] ? `<span class="text-ai-logo" data-owner="${logo[v]}" aria-hidden="true"></span>` : v}</button>`).join('');
        bar.addEventListener('click', e => { const v = e.target.closest('.mr-vendor'); if (v) showVendor(rail, v.dataset.provider); });
        rail.prepend(bar);
        rail.dataset.vendorFirst = '1';
    }
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
        if (binding?.rail.dataset?.vendorFirst) showVendor(binding.rail, vendorOf(binding.rail.querySelector('[data-value="' + input.value + '"]') || document.body));
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
        if (!host.parentElement.querySelector('.audit-providers, .cmp-vendors') && !host.closest('#aiKeysModal')) vendorFirst(host);
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
            ['ai-model-grammar', '.reflective-grammar-model-chip', 'ai_default_grammar_model'],
            ['dxa-ai-model-val', '#dxa-ai-chip-rail', 'ai_default_disease_codex_model'],
            ['alabasta-case-card-refine-model', '.alabasta-casecard-tools-chip-rail', 'ai_default_casecard_refine_model']
        ];
        controls.forEach(([id, selector, key]) => {
            let host = document.querySelector(selector) || document.querySelector(`[onclick*="'${id}'"][data-value]`)?.parentElement;
            if (host?.matches('button')) host = host.parentElement;
            bind(id, host, key);
        });
        // V102.118: Reflective Review's rail is built after its hidden select inside #rr-model-row (admin.html
        // rrInitModelRow adds the provider tabs); the V95.46 dropdown shell it used to replace is gone.
        bind('ai-model-review', null);
        ['research-model-select', 'tts-polish-model', 'laughtale-ai-model', 'storyteller-model-select', 'lp-ai-model', 'case-note-ai-model', 'bp-ai-model'].forEach(id => bind(id, null, 'ai_text_' + id));
        const qfp = document.getElementById('ai-model-selector');
        if (qfp) window.syncModelDefault('ai-model-selector', localStorage.getItem('ai_default_qfp_model') || qfp.value);
        Object.values(preferences).forEach(([id, key]) => bind(id, null, key));
        const description = document.getElementById('model-desc-box');
        if (description) description.hidden = true;
    };
    // V102.508: a rail built after load (the Review 📰 panel) gets the same bound, vendor-first rail as the page's own inputs.
    window.bindRegistryModelInput = (id, key) => bind(id, null, key);
    document.addEventListener('DOMContentLoaded', window.initRegistryModelSelectors);
})();
