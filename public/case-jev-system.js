// V102.562 (owner, A): the Jev logo button on the Inbox banner (V102.565, owner D: logo only). Jev only suggests in the system line of a card; ✓ saves, ✕ hides it for this session. Cases whose system Jev agrees with show nothing.
(function () {
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const picks = new Map(), hidden = new Set(), done = new Set();
    const waiting = () => (window.casesData || []).filter(c => !c.isArchived && (c.status || 'pending') === 'pending');
    const pickOf = c => (picks.has(c.id) && !hidden.has(c.id) && picks.get(c.id) !== c.diseaseSystemKey ? picks.get(c.id) : null);
    const entryOf = key => (window.alabastaTaxonomyCatalog || []).find(s => s.key === key);
    const chipOf = (c, key) => {
        const name = window.caseSystemShort(key), emoji = window.CASE_SYSTEM_EMOJI[key] || '';
        return (c.diseaseSystemKeys || []).includes(key) ? `${emoji} ${esc(name)} first` : `${emoji} ${esc(name)}`;
    };

    function sub(c, html) {
        const key = pickOf(c);
        if (!key) return html;
        const id = esc(c.id);
        return `<span class="cjs-old">${html}</span><span class="cjs-inl" title="Jev suggests this. Nothing changes until you press ✓">${window.jevMarkHtml ? window.jevMarkHtml(14) : ''} → ${chipOf(c, key)} <button type="button" class="cjs-y" onclick="caseJevSystem.use('${id}')" title="Use" aria-label="Use this system">✓</button><button type="button" class="cjs-n" onclick="caseJevSystem.hide('${id}')" title="Dismiss" aria-label="Dismiss">✕</button></span>`;
    }
    const cls = c => (done.has(c.id) ? ' cjs-done' : '');
    function hide(id) { hidden.add(id); renderAlabastaInbox(); }

    async function use(id) {
        const c = (window.casesData || []).find(x => x.id === id), key = picks.get(id), entry = entryOf(key);
        if (!c || !entry) return;
        const label = `${entry.label} / ${entry.thaiLabel || entry.label}`;
        const head = s => String(s || '').split('/')[0].trim();
        const fields = { diseaseSystemKey: key, diseaseSystemLabel: label };
        if (head(c.disease) === head(c.diseaseSystemLabel)) fields.disease = label;   // a title that only repeats the old system follows it
        if (Array.isArray(c.diseaseSystemKeys)) {   // a system already on the case moves first; a new one replaces the old primary
            const keep = c.diseaseSystemKeys.includes(key) ? c.diseaseSystemKeys : c.diseaseSystemKeys.filter(k => k !== c.diseaseSystemKey);
            fields.diseaseSystemKeys = [key, ...keep.filter(k => k !== key)];
        }
        try {
            const batch = db.batch();
            batch.update(db.collection('cases').doc(id), { ...fields, adminTaggedBy: ALLOWED_EMAIL || 'admin', adminTaggedAt: firebase.firestore.FieldValue.serverTimestamp(), adminUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            if (fields.disease && c.caseId) await stageSubmissionMirror(batch, id, { title: c.caseId + ' - ' + fields.disease });
            await batch.commit();
            Object.assign(c, fields);
            picks.delete(id); done.add(id);
            renderAlabastaCases();
        } catch (e) {
            console.error('[caseJevSystem]', e);
            showToast('Could not save: ' + (e && e.message ? e.message : 'error'));
        }
    }

    async function run(btn) {
        const list = waiting().slice(0, 30);
        if (!list.length || btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('is-run');
        try {
            const systems = (window.alabastaTaxonomyCatalog || []).map(s => ({ key: s.key, label: s.label, symptoms: s.symptoms }));
            const r = (await adminApp.functions().httpsCallable('jevSuggestCaseSystems')({ caseIds: list.map(c => c.id), systems })).data || {};
            if (r.enabled === false) { showToast('Jev is switched off'); return; }
            (r.suggestions || []).forEach(s => { picks.set(s.id, s.key); hidden.delete(s.id); });
            window.alabastaInboxOpen = true;
            renderAlabastaInbox();
            const n = (r.suggestions || []).length, tail = (r.errors ? ` · ${r.errors} failed` : '') + (r.skipped ? ` · ${r.skipped} note too short` : '');
            showToast((n ? `Jev: ${n} to check` : `Jev: nothing to change in ${r.checked || 0}`) + tail);
        } catch (e) {
            console.warn('jevSuggestCaseSystems', e && e.message);
            showToast('Jev could not check: ' + (e && e.message ? e.message : 'error'));
        } finally {
            btn.disabled = false;
            btn.classList.remove('is-run');
        }
    }

    window.caseJevSystem = { run, sub, cls, use, hide };
})();
