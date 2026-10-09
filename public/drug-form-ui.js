// V102.134: Drug Codex edit/review form, emoji-first (drug-form-ui.css). DOM + paint only — it reads the form, never changes what is saved.
//  · tab pill colour = share of that tab's fields that have a value; red = a required field is missing
//  · on an AI-drafted form the pill border says whether the admin confirmed the tab (dashed = no, solid = yes); tapping the open tab again toggles it
//  · field labels become an emoji (full name in the tooltip), ← sits in the name row, the AI badge / title shrink, one floating 💾
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('drugCodexAdminModal'), form = document.getElementById('dca-view-form'), tabs = document.getElementById('dca-form-tabs');
    if (!modal || !form || !tabs) return;
    const byId = id => document.getElementById(id);

    // share filled → colour step (0 grey · 1 orange <40 · 2 yellow <75 · 3 light green <90 · 4 dark green ≥90)
    const STEP_AT = [1, 40, 75, 90];
    const stepOf = pct => pct <= 0 ? 0 : 1 + STEP_AT.slice(1).filter(t => pct >= t).length;
    const EMOJI = { genericName: '💊', brandNames: '🏷️', atcCode: '🧬', class: '🗂️', indication: '🎯', dosing: '💉', contraindication: '⛔', sideEffects: '⚠️', interactions: '🔀',
        mechanism: '⚙️', absorption: '📥', distribution: '🫀', metabolism: '🧪', excretion: '💧', toxicity: '☠️', monitoring: '📈', patientCounseling: '🗣️', pearls: '💎', references: '📚' };

    // ── tabs: emoji + a label shown only on the open tab ──
    const tabLabel = {};
    tabs.querySelectorAll('.dca-form-tab-btn[data-section]').forEach(btn => {
        const n = [...btn.childNodes].find(x => x.nodeType === 3 && x.textContent.trim());
        if (!n) return;
        const parts = n.textContent.trim().split(/\s+/), e = parts.shift(), t = parts.join(' ');
        tabLabel[btn.dataset.section] = t;
        const wrap = document.createElement('span'); wrap.className = 'dfu-te'; wrap.innerHTML = '<span class="dfu-e"></span><span class="dfu-t"></span>';
        wrap.firstChild.textContent = e; wrap.lastChild.textContent = t;
        btn.replaceChild(wrap, n);
    });

    // ── labels → emoji ──
    Object.entries(EMOJI).forEach(([key, emoji]) => {
        const l = form.querySelector('label[for="dca-f-' + key + '"]');
        if (!l || l.classList.contains('dfu-lbl')) return;
        const name = l.textContent.replace(/\s+/g, ' ').trim();
        l.classList.remove('dt-sr-label');   // the references label was screen-reader-only because the section title named it; the title is hidden now
        l.classList.add('dfu-lbl'); l.title = name; l.setAttribute('aria-label', name);
        l.innerHTML = '<span class="dfu-e" aria-hidden="true"></span>'; l.firstChild.textContent = emoji;
    });

    // ── header: ← in the name row, shorter title, compact AI badge, floating save ──
    const head = form.querySelector('.dt-head'), label = byId('dca-form-mode-label'), badge = byId('dca-form-ai-badge');
    if (head && label) {
        const back = document.createElement('button'); back.type = 'button'; back.className = 'dfu-back'; back.textContent = '←'; back.title = 'Back to list'; back.setAttribute('aria-label', 'Back to list');
        back.addEventListener('click', () => { if (typeof dcaBackToList === 'function') dcaBackToList(); });
        head.insertBefore(back, head.firstChild);
    }
    const TITLE = [[/^Review Draft\s*·\s*/, '📝 '], [/^Edit\s*·\s*/, '✏️ ']];
    function compactTitle() {
        if (!label || label.dataset.dfu === label.textContent) return;
        const raw = label.textContent; let out = raw;
        for (const [re, rep] of TITLE) if (re.test(raw)) { out = raw.replace(re, rep); break; }
        label.title = raw; label.dataset.dfu = out; label.textContent = out;
    }
    function compactBadge() {
        if (!badge || badge.querySelector('.dfu-ai')) return;
        const raw = badge.textContent.trim(); if (!raw) return;
        const m = /AI-drafted(?: by ([^·]+?))?\s*·/.exec(raw), id = m && m[1] ? m[1].trim() : '';
        const model = id && (window.TEXT_AI_MODELS || []).find(x => x.id === id);
        const logo = id && window.aiModelLogoHtml ? window.aiModelLogoHtml(id) : '';
        badge.title = raw;
        badge.innerHTML = '<span class="dfu-ai">' + (logo || '🤖') + '<span class="dfu-ai-n"></span></span>';
        badge.querySelector('.dfu-ai-n').textContent = model ? (model.short || model.label) : (id || 'AI');
    }
    if (label) new MutationObserver(compactTitle).observe(label, { childList: true, characterData: true, subtree: true });
    if (badge) new MutationObserver(compactBadge).observe(badge, { childList: true, characterData: true, subtree: true });
    compactTitle(); compactBadge();
    const save = byId('dca-form-save-btn');
    if (save) { save.parentElement.classList.add('dfu-foot'); save.title = 'Save drug'; save.setAttribute('aria-label', 'Save drug'); }

    // ── the form view hides the Published / Drafts tabs; the open section tints the wash ──
    const syncView = () => modal.classList.toggle('dfu-form-open', form.style.display === 'block');
    new MutationObserver(syncView).observe(form, { attributes: true, attributeFilter: ['style'] }); syncView();
    const syncSection = () => { const a = tabs.querySelector('.dca-form-tab-btn.active'); modal.dataset.dfuSec = a ? a.dataset.section : 'core'; };
    new MutationObserver(syncSection).observe(tabs, { attributes: true, attributeFilter: ['class'], subtree: true }); syncSection();

    // ── paint: colour step, red when a required field is empty, border = confirmation ──
    const val = k => { const el = byId('dca-f-' + k); return el ? String(el.value || '').trim() : ''; };
    function paint() {
        if (typeof DCA_SECTION_DEFS === 'undefined') return;
        const ai = typeof dcaState !== 'undefined' && !!dcaState.formAiDrafted;
        DCA_SECTION_DEFS.forEach(def => {
            const btn = tabs.querySelector('.dca-form-tab-btn[data-section="' + def.key + '"]'); if (!btn) return;
            const total = def.fields.length, filled = def.fields.filter(k => val(k)).length, pct = total ? Math.round(filled / total * 100) : 0;
            const reqMissing = (def.required || []).some(k => !val(k)), ver = ai && filled > 0 && !!dcaState.verified[def.key];
            btn.className = btn.className.replace(/\bdfu-(s\d|err|unv|ver)\b/g, '').replace(/\s+/g, ' ').trim();
            btn.classList.add(reqMissing ? 'dfu-err' : 'dfu-s' + stepOf(pct));
            if (ai && filled > 0) btn.classList.add(ver ? 'dfu-ver' : 'dfu-unv');
            const name = tabLabel[def.key] || def.key;
            const tip = name + ' · ' + pct + '% (' + filled + '/' + total + ')' + (reqMissing ? ' · required field missing' : '') + (ai && filled > 0 ? (ver ? ' · confirmed — tap to undo' : ' · AI-drafted, not confirmed — tap this tab again to confirm') : '');
            btn.title = tip; btn.setAttribute('aria-label', tip);
        });
    }
    let queued = false;
    const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; paint(); }); };
    form.addEventListener('input', later, true);
    const orig = window.dcaUpdateSectionBadges;
    if (typeof orig === 'function') window.dcaUpdateSectionBadges = function () { const r = orig.apply(this, arguments); paint(); return r; };
    new MutationObserver(later).observe(form, { attributes: true, attributeFilter: ['style'] });
    paint();

    // ── tap the open tab again = confirm / undo (AI-drafted, tab has data) — replaces the old strip button ──
    tabs.addEventListener('click', e => {
        const btn = e.target.closest('.dca-form-tab-btn[data-section]');
        if (!btn || !btn.classList.contains('active') || typeof dcaState === 'undefined' || !dcaState.formAiDrafted) return;
        const def = DCA_SECTION_DEFS.find(d => d.key === btn.dataset.section);
        if (!def || !def.fields.some(k => val(k))) return;
        e.preventDefault(); e.stopPropagation();
        if (typeof dcaToggleVerifyCurrent === 'function') dcaToggleVerifyCurrent();
        paint();
    }, true);
});
