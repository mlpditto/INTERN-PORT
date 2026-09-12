document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('drugCodexAdminModal');
    if (!modal) return;
    const byId = id => document.getElementById(id);
    modal.classList.add('drug-compact');
    const content = modal.querySelector('.modal-content'), heading = content.querySelector('h3');
    heading.nextElementSibling.hidden = true;
    const header = document.createElement('div'); header.className = 'dt-header'; heading.before(header);
    header.append(heading, modal.querySelector('.dca-view-tabs'));
    const summary = byId('dca-published-summary'); byId('dca-view-published').prepend(summary);
    byId('dca-view-drafts').firstElementChild.hidden = true;
    const draftTab = modal.querySelector('[data-view="drafts"]');
    [...draftTab.childNodes].filter(n => n.nodeType === 3).forEach(n => n.textContent = n.textContent.replace('Pending Drafts', 'Drafts'));
    const toolbar = document.createElement('div'); toolbar.className = 'dt-ai-toolbar lang-no-toggle';
    const rail = document.createElement('div'); rail.id = 'dt-models'; rail.className = 'dt-models'; rail.setAttribute('role', 'group'); rail.setAttribute('aria-label', 'AI model for Fill and Review');
    toolbar.append(rail);
    const titleRow = byId('dca-form-mode-label').parentElement.parentElement;
    titleRow.after(toolbar);
    ['dca-form-ai-fill-btn', 'dca-form-ai-review-btn', 'dca-form-copy-btn'].forEach(id => toolbar.append(byId(id)));
    const provenance = document.createElement('details'); provenance.className = 'dt-provenance lang-no-toggle';
    provenance.innerHTML = '<summary>ⓘ AI history &amp; document</summary>';
    provenance.append(byId('dca-form-ai-badge'), byId('dca-form-ai-subtitle'), byId('dca-form-doc-id'));
    toolbar.after(provenance);
    const primary = ['gemini-3.8-flash', 'gpt-6-astra', 'gpt-5.6-terra'];
    const models = primary.map(id => window.AI_MODEL_REGISTRY?.models.find(m => m.id === id && m.selectable)).filter(Boolean);
    const oldRail = byId('dca-ai-chip-rail');
    const legacy = [...oldRail.querySelectorAll('[data-value]')].map(el => ({ id: el.dataset.value, label: dcaFormatModelLabel(el.dataset.value) }));
    const choices = [...models, ...legacy.filter(m => !primary.includes(m.id))];
    const rails = [rail, oldRail];
    function render(selected) {
        rails.forEach(host => {
            host.replaceChildren();
            choices.forEach(m => {
                const button = document.createElement('button'); button.type = 'button'; button.dataset.value = m.id;
                button.className = 'glass-toggle-item'; button.classList.toggle('active', selected === m.id);
                button.setAttribute('aria-pressed', String(selected === m.id)); button.textContent = m.label;
                button.onclick = () => window.dcaSelectAutoDraftModel(button);
                // Keep older choices accessible without crowding the primary rail.
                if (primary.includes(m.id) || selected === m.id) host.append(button);
                else {
                    let more = host.querySelector('details');
                    if (!more) { more = document.createElement('details'); more.innerHTML = '<summary>More</summary>'; host.append(more); }
                    more.append(button);
                }
            });
        });
    }
    window.dcaSelectedToolbarModel = () => byId('dca-ai-model-val').value || DCA_AI_FALLBACK_MODEL;
    window.dcaSelectAutoDraftModel = el => {
        byId('dca-ai-model-val').value = el.dataset.value;
        try { localStorage.setItem(DCA_AI_LS_KEY, el.dataset.value); } catch (_) {}
        render(el.dataset.value);
    };
    window.dcaSyncAutoDraftChipFromStorage = () => {
        let saved;
        try { saved = localStorage.getItem(DCA_AI_LS_KEY); } catch (_) {}
        const selected = choices.some(m => m.id === saved) ? saved : (models[0]?.id || DCA_AI_FALLBACK_MODEL);
        byId('dca-ai-model-val').value = selected; render(selected);
    };
    dcaSyncAutoDraftChipFromStorage();
    // The section header already supplies this label.
    byId('dca-f-references').previousElementSibling.classList.add('dt-sr-label');
});
