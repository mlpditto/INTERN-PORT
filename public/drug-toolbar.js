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

    // V102.131: lean form header — ONE row: name · status chip · AI badge · short doc id · [🤖 🔍 📋 · model ▾ · ⓘ].
    // The model rail (provider logos + that provider's chips) opens under the row from the model chip; Updated /
    // Contributors / AI history live behind ⓘ. Same ids as before, so AI fill / Review / Copy keep working.
    const modeLabel = byId('dca-form-mode-label'), titleRow = modeLabel.parentElement.parentElement;
    const head = document.createElement('div'); head.className = 'dt-head lang-no-toggle';
    const actions = document.createElement('div'); actions.className = 'dt-actions';
    modeLabel.classList.add('dt-name');
    const docId = byId('dca-form-doc-id'); docId.classList.add('dt-docid'); docId.title = 'Click to copy the document id';
    docId.addEventListener('click', () => {
        const id = docId.textContent.replace(/^doc:\s*/, '').trim();
        if (id && navigator.clipboard) navigator.clipboard.writeText(id).then(() => { docId.title = 'Copied ✓'; setTimeout(() => { docId.title = 'Click to copy the document id'; }, 1500); }).catch(() => {});
    });
    const model = document.createElement('button'); model.type = 'button'; model.id = 'dt-model-toggle'; model.className = 'dt-model';
    model.setAttribute('aria-expanded', 'false'); model.setAttribute('aria-controls', 'dt-models'); model.title = 'Text model for AI fill and AI Review — click to change';
    model.innerHTML = '<span class="dt-model-logo" aria-hidden="true"></span><span id="dt-model-name"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    const info = document.createElement('button'); info.type = 'button'; info.id = 'dt-info-toggle'; info.className = 'dt-info';
    info.setAttribute('aria-expanded', 'false'); info.setAttribute('aria-controls', 'dt-more'); info.title = 'Updated · contributors · AI history'; info.textContent = 'ⓘ';
    actions.append(byId('dca-form-ai-fill-btn'), byId('dca-form-ai-review-btn'), byId('dca-form-copy-btn'), model, info);
    head.append(modeLabel, byId('dca-form-status-chip'), byId('dca-form-ai-badge'), docId, actions);
    titleRow.replaceWith(head);
    const rail = document.createElement('div'); rail.id = 'dt-models'; rail.className = 'dt-rail audit-toolbar lang-no-toggle'; rail.hidden = true;
    rail.setAttribute('role', 'group'); rail.setAttribute('aria-label', 'AI model for Fill and Review');
    const more = document.createElement('div'); more.id = 'dt-more'; more.className = 'dt-more lang-no-toggle'; more.hidden = true;
    const meta = byId('dca-form-meta');
    more.append(meta, byId('dca-form-ai-subtitle'));
    head.after(rail, more);
    const toggle = (panel, button, force) => {
        const open = typeof force === 'boolean' ? force : panel.hidden;
        panel.hidden = !open; button.setAttribute('aria-expanded', String(open));
    };
    model.addEventListener('click', () => toggle(rail, model));
    info.addEventListener('click', () => toggle(more, info));
    // The per-field authorship key (intern green / admin blue) rides inside the meta strip: open ⓘ once when it
    // shows up, close it again when the strip is redrawn for another drug.
    let keyShown = false;
    new MutationObserver(records => {
        if (records.some(r => r.type === 'childList' && r.target === meta)) { keyShown = false; toggle(more, info, false); }
        const key = byId('dca-prov-inline-key');
        if (!keyShown && key && key.style.display !== 'none') { keyShown = true; toggle(more, info, true); }
    }).observe(meta, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

    const choices = window.TEXT_AI_MODELS;
    const oldRail = byId('dca-ai-chip-rail');
    function drawRail(selected) {
        const action = 'dcaSelectAutoDraftModel(this)';
        rail.innerHTML = window.providerModelRailHtml
            ? window.providerModelRailHtml('dt-model-pick', selected, action)
            : '<div class="text-ai-chips" role="group" aria-label="AI model">' + window.textAIChipContents(selected, action) + '</div>';
    }
    function render(selected) {
        // V101.50: same lean chips as every other text rail (ai-model-ui.js generator).
        oldRail.classList.add('text-ai-chips');
        oldRail.innerHTML = window.textAIChipContents(selected, 'dcaSelectAutoDraftModel(this)');
        drawRail(selected);
        const chosen = choices.find(m => m.id === selected);
        byId('dt-model-name').textContent = chosen ? (chosen.short || chosen.label) : selected;
        model.querySelector('.dt-model-logo').innerHTML = window.aiModelLogoHtml ? window.aiModelLogoHtml(selected) : '';
    }
    window.dcaSelectedToolbarModel = () => byId('dca-ai-model-val').value || DCA_AI_FALLBACK_MODEL;
    window.dcaSelectAutoDraftModel = el => {
        byId('dca-ai-model-val').value = el.dataset.value;
        try { localStorage.setItem(DCA_AI_LS_KEY, el.dataset.value); } catch (_) {}
        render(el.dataset.value);
        toggle(rail, model, false);   // a pick closes the rail
    };
    window.dcaSyncAutoDraftChipFromStorage = () => {
        let saved;
        try { saved = localStorage.getItem(DCA_AI_LS_KEY); } catch (_) {}
        const selected = choices.some(m => m.id === saved) ? saved : 'gpt-6-luna';
        byId('dca-ai-model-val').value = selected; localStorage.setItem(DCA_AI_LS_KEY, selected); render(selected);
    };
    dcaSyncAutoDraftChipFromStorage();
    // The section header already supplies this label.
    byId('dca-f-references').previousElementSibling.classList.add('dt-sr-label');
});
