// Registry-backed choices; saved legacy IDs remain explicit and are never remapped here.
(function () {
    const targets = {
        'ai-analyze-model-toggle': ['ai-analyzer-model-val', 'AI / PDF / Expand model'],
        'ai-translate-model-toggle': ['toolbar-ai-translate-model', 'Translation model']
    };
    function addModels(select) {
        const group = document.createElement('optgroup');
        group.label = 'Verified models · manual selection';
        (window.AI_MODEL_REGISTRY?.models || []).filter(m => m.selectable).forEach(m => {
            if (Array.from(select.options).some(o => o.value === m.id)) return;
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.label + (m.id === 'claude-sonnet-5' ? ' · trial: JSON failures observed' : '');
            group.appendChild(option);
        });
        select.appendChild(group);
    }
    window.syncRegistryModelSelect = function (hiddenId) {
        const hidden = document.getElementById(hiddenId);
        const select = document.getElementById(hiddenId + '-registry');
        if (!hidden || !select) return;
        if (!Array.from(select.options).some(o => o.value === hidden.value)) {
            const option = document.createElement('option');
            option.value = hidden.value;
            option.textContent = hidden.value + ' · saved selection';
            select.appendChild(option);
        }
        select.value = hidden.value;
    };
    window.initRegistryModelSelectors = function () {
        Object.entries(targets).forEach(([containerId, [hiddenId, label]]) => {
            const container = document.getElementById(containerId);
            if (!container || document.getElementById(hiddenId + '-registry')) return;
            const select = document.createElement('select');
            select.id = hiddenId + '-registry';
            select.setAttribute('aria-label', label);
            select.style.cssText = 'width:100%;min-width:0;min-height:36px;border-radius:8px;background:#182235;color:#e2e8f0;border:1px solid #475569;padding:4px 8px;font-size:13px;';
            addModels(select);
            const legacy = document.createElement('optgroup');
            legacy.label = 'Existing routes (legacy IDs / specialist models)';
            container.querySelectorAll('[data-value]').forEach(chip => {
                if (Array.from(select.options).some(o => o.value === chip.dataset.value)) return;
                const option = document.createElement('option');
                option.value = chip.dataset.value;
                option.textContent = chip.dataset.value;
                legacy.appendChild(option);
            });
            select.appendChild(legacy);
            select.onchange = () => { document.getElementById(hiddenId).value = select.value; };
            container.replaceChildren(select);
            container.style.cssText = 'margin:0;display:block;min-width:0;width:100%;max-width:360px;height:auto;';
            window.syncRegistryModelSelect(hiddenId);
        });
        ['default-translate-model', 'default-analyzer-model', 'default-review-model', 'default-qfp-model', 'ai-model-review'].forEach(id => {
            const select = document.getElementById(id);
            if (!select || select.dataset.registryReady) return;
            const value = select.value;
            Array.from(select.options).forEach(o => {
                const model = window.AI_MODEL_REGISTRY?.models.find(m => m.id === o.value);
                o.textContent = model ? model.label : o.value + ' · existing route';
            });
            addModels(select);
            select.value = value;
            select.dataset.registryReady = 'true';
        });
    };
    document.addEventListener('DOMContentLoaded', window.initRegistryModelSelectors);
})();
