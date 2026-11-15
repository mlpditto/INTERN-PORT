// Admin ▸ Drug Codex ▸ 📥 ▸ 🧠 Card lines: the batch sheet for the intern PK flash cards (step 1b, V102.654).
// Lists published drugs that HAVE pharmacokinetics text but no card lines yet, ten at a time. 🤖 Shorten asks the model once per drug
// (the same prompt as the single-drug block in the 📊 tab — dcaPkVisualMakeLabels), every line stays editable, and nothing is written
// until the admin ticks a row (✓ = "I read it") and presses 💾: then only drug_codex/{id}.pkCard (+ updatedAt) is written, row by row.
// Uses admin.html globals: dcaState, dcaPkVisualMakeLabels, dcaBatchModelLabel, db, auth, firebase, showToast.
(function () {
    const PAGE = 10, MAX = 60;
    const KEYS = [['a', 'absorption', '#0ea5e9'], ['d', 'distribution', '#8b5cf6'], ['m', 'metabolism', '#f59e0b'], ['e', 'excretion', '#10b981'], ['t', 'toxicity', '#ef4444']];
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
    const hasPk = (d) => KEYS.some(([, f]) => d[f] && String(d[f]).trim());
    const hasCard = (d) => !!d.pkCard && KEYS.some(([k]) => d.pkCard[k]);
    const hasLines = (r) => KEYS.some(([k]) => String(r.lines[k] || '').trim());
    const codex = () => (typeof dcaState !== 'undefined' && Array.isArray(dcaState.codex) ? dcaState.codex : []);
    const todo = () => codex().filter(d => hasPk(d) && !hasCard(d)).sort((a, b) => String(a.genericName || '').localeCompare(String(b.genericName || '')));
    let st = null;

    const STYLE = `
#pkcb{position:fixed;inset:0;z-index:100040;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif}
#pkcb .sh{background:#fff;width:96vw;max-width:1180px;max-height:90vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.3)}
#pkcb .hd{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #eef2f7;flex-wrap:wrap}
#pkcb .hd b{font-size:1em;color:#4338ca}#pkcb .hd .n{font-size:.8em;font-weight:700;color:#64748b;margin-right:auto}
#pkcb button{width:auto;min-height:30px;margin:0;padding:0 12px;border:1px solid #c7d2fe;border-radius:999px;background:#eef2ff;color:#3730a3;font:inherit;font-size:.8em;font-weight:800;cursor:pointer}
#pkcb button.go{background:#16a34a;border-color:#16a34a;color:#fff}#pkcb button.x{border-color:#e2e8f0;background:#f8fafc;color:#475569;padding:0 10px}
#pkcb button:disabled{opacity:.45;cursor:default}
#pkcb .lang{display:inline-flex;border:1px solid #c7d2fe;border-radius:999px;overflow:hidden}#pkcb .lang button{border:none;border-radius:0;background:#fff;min-height:28px}#pkcb .lang button[aria-pressed="true"]{background:#4f46e5;color:#fff}
#pkcb .bd{overflow:auto;padding:6px 14px 12px}
#pkcb .row,#pkcb .cols{display:grid;grid-template-columns:30px minmax(110px,1.1fr) repeat(5,minmax(0,1.6fr)) 22px;gap:6px;align-items:center}
#pkcb .cols{position:sticky;top:0;background:#fff;padding:4px 0;font-size:.72em;font-weight:800;color:#64748b;z-index:1}
#pkcb .cols i{display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;font-style:normal;color:#fff;margin-right:4px}
#pkcb .row{padding:4px 0;border-top:1px solid #f1f5f9}
#pkcb .row .nm{font-weight:800;font-size:.82em;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pkcb .row textarea{width:100%;min-width:0;min-height:0;box-sizing:border-box;margin:0;padding:4px 7px;border:1px solid #e2e8f0;border-radius:8px;font:inherit;font-size:.78em;line-height:1.3;resize:none;overflow:hidden;display:block}
#pkcb .row textarea:disabled{background:#f8fafc;color:#94a3b8}
#pkcb .row input[type=checkbox]{width:18px;height:18px;margin:0 auto;display:block}
#pkcb .row .s{font-size:.85em;text-align:center}#pkcb .row[data-state="bad"] .nm{color:#b91c1c}
#pkcb .empty{padding:28px 0;text-align:center;color:#64748b;font-weight:700}
#pkcb .ft{padding:8px 14px;border-top:1px solid #eef2f7;font-size:.74em;color:#64748b;font-weight:600}`;

    function rowHtml(r) {
        const locked = r.state === 'busy' || st.saving;
        const mark = r.state === 'busy' ? '⏳' : r.state === 'bad' ? '⚠️' : '';
        return `<div class="row" data-row="${esc(r.id)}" data-state="${r.state}">`
            + `<input type="checkbox" data-ok ${r.ok ? 'checked' : ''} ${hasLines(r) && !locked ? '' : 'disabled'} title="Tick when you have read this drug's lines — only ticked rows are saved" aria-label="Checked ${esc(r.name)}">`
            + `<span class="nm" title="${esc(r.name)}${r.err ? ' — ' + esc(r.err) : ''}">${esc(r.name)}</span>`
            + KEYS.map(([k, f]) => `<textarea data-k="${k}" rows="2" maxlength="${MAX}" ${locked ? 'disabled' : ''} aria-label="${esc(r.name)} ${f}">${esc(r.lines[k] || '')}</textarea>`).join('')
            + `<span class="s" title="${esc(r.err || '')}">${mark}</span></div>`;
    }
    function counts() { return { blank: st.rows.filter(r => !hasLines(r)).length, ticked: st.rows.filter(r => r.ok && hasLines(r)).length }; }
    function draw() {
        let el = document.getElementById('pkcb');
        if (!st) { if (el) el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.id = 'pkcb'; el.className = 'lang-no-toggle'; document.body.appendChild(el); el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onInput); }
        if (!document.getElementById('pkcb-css')) { const s = document.createElement('style'); s.id = 'pkcb-css'; s.textContent = STYLE; document.head.appendChild(s); }
        const c = counts(), busy = st.running || st.saving;
        const model = typeof dcaBatchModelLabel === 'function' ? dcaBatchModelLabel() : '';
        el.innerHTML = `<div class="sh" role="dialog" aria-label="Card lines"><div class="hd"><b>🧠 Card lines</b>`
            + `<span class="n" title="Published drugs with pharmacokinetics text and no card lines yet">${st.total} to do${st.rows.length < st.total ? ' · showing ' + st.rows.length : ''}</span>`
            + `<span class="lang"><button type="button" data-act="lang" data-v="th" aria-pressed="${st.lang === 'th'}" ${busy ? 'disabled' : ''} title="Lines in Thai">🇹🇭</button><button type="button" data-act="lang" data-v="en" aria-pressed="${st.lang === 'en'}" ${busy ? 'disabled' : ''} title="Lines in English">EN</button></span>`
            + (st.running ? `<button type="button" data-act="stop">⏹ Stop</button>` : `<button type="button" data-act="run" ${c.blank && !busy ? '' : 'disabled'} title="One AI call per drug${model ? ' · ' + esc(model) : ''} — fills the empty rows, writes nothing">🤖 Shorten ${c.blank}</button>`)
            + `<button type="button" data-act="all" ${busy || !st.rows.some(hasLines) ? 'disabled' : ''} title="Tick every row that has lines">✓ all</button>`
            + `<button type="button" class="go" data-act="save" ${c.ticked && !busy ? '' : 'disabled'} title="Save the ticked rows on their drugs">💾 Save ${c.ticked}</button>`
            + `<button type="button" class="x" data-act="close" aria-label="Close">✕</button></div>`
            + `<div class="bd">` + (st.rows.length
                ? `<div class="cols"><span></span><span>Drug</span>${KEYS.map(([k, f, col]) => `<span><i style="background:${col}">${k.toUpperCase()}</i>${f[0].toUpperCase() + f.slice(1)}</span>`).join('')}<span></span></div>` + st.rows.map(rowHtml).join('')
                : `<div class="empty">✓ Every drug with pharmacokinetics text has card lines.</div>`)
            + `</div><div class="ft">AI-shortened from each drug's own PK fields · ≤ ${MAX} characters · read a row, tick it, then 💾 — only ticked rows are saved${model ? ' · model: ' + esc(model) : ''}</div></div>`;
    }
    function paintRow(r) { const el = [...document.querySelectorAll('#pkcb .row')].find(x => x.dataset.row === r.id); if (el) el.outerHTML = rowHtml(r); }
    function paintHead() {   // counts on the buttons without redrawing the rows (keeps the caret where the admin is typing)
        const c = counts(), q = (a) => document.querySelector('#pkcb [data-act="' + a + '"]');
        const run = q('run'), save = q('save'), all = q('all'), busy = st.running || st.saving;
        if (run) { run.textContent = '🤖 Shorten ' + c.blank; run.disabled = !c.blank || busy; }
        if (save) { save.textContent = '💾 Save ' + c.ticked; save.disabled = !c.ticked || busy; }
        if (all) all.disabled = busy || !st.rows.some(hasLines);
    }
    function load() {
        const all = todo();
        st.total = all.length;
        st.rows = all.slice(0, PAGE).map(d => ({ id: d._id, name: d.genericName || d._id, lines: {}, state: '', ok: false, err: '' }));
    }
    function open() { st = { total: 0, rows: [], lang: 'th', running: false, stop: false, saving: false }; load(); draw(); }
    function close() {
        if (st && (st.running || st.saving)) return;
        if (st && st.rows.some(hasLines) && !confirm('Close without saving?\n\nLines that are not saved are lost.')) return;
        st = null; draw();
    }
    function onInput(e) {
        const row = e.target.closest && e.target.closest('.row'); if (!row || !st) return;
        const r = st.rows.find(x => x.id === row.dataset.row); if (!r) return;
        if (e.target.dataset.k) {
            r.lines[e.target.dataset.k] = e.target.value.replace(/\n/g, ' ');
            const box = row.querySelector('[data-ok]'); if (box) { box.disabled = !hasLines(r); if (!hasLines(r)) { box.checked = false; r.ok = false; } }
        } else if (e.target.hasAttribute('data-ok')) r.ok = e.target.checked;
        paintHead();
    }
    async function run() {
        if (typeof dcaPkVisualMakeLabels !== 'function') { toast('🧠 AI is not ready yet — try again in a moment.'); return; }
        st.running = true; st.stop = false; draw();
        for (const r of st.rows.slice()) {
            if (!st || st.stop) break;
            if (hasLines(r)) continue;
            const d = codex().find(x => x._id === r.id); if (!d) continue;
            r.state = 'busy'; r.err = ''; paintRow(r);
            try {
                const L = await dcaPkVisualMakeLabels(d, st.lang);
                if (!L) throw new Error('the model returned no lines');
                KEYS.forEach(([k]) => { r.lines[k] = String(L[k] || '').slice(0, MAX); });
                r.state = 'new';
            } catch (e) { r.state = 'bad'; r.err = (e && e.message) || 'failed'; }
            if (!st) return;
            paintRow(r); paintHead();
        }
        if (!st) return;
        st.running = false; draw();
    }
    async function save() {
        const rows = st.rows.filter(r => r.ok && hasLines(r)); if (!rows.length) return;
        st.saving = true; draw();
        const lang = st.lang, by = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) || 'admin-ui';
        let done = 0, bad = 0;
        for (const r of rows) {
            const card = {};
            KEYS.forEach(([k]) => { const v = String(r.lines[k] || '').replace(/\s+/g, ' ').trim(); if (v) card[k] = v.slice(0, MAX); });
            card.lang = lang;
            const nowTs = firebase.firestore.FieldValue.serverTimestamp();
            try {
                await db.collection('drug_codex').doc(r.id).update({ pkCard: Object.assign({ at: nowTs, by }, card), updatedAt: nowTs });
                const d = codex().find(x => x._id === r.id); if (d) d.pkCard = Object.assign({}, card);
                st.rows = st.rows.filter(x => x !== r); done++;
            } catch (e) { r.state = 'bad'; r.err = (e && e.message) || 'save failed'; bad++; }
        }
        st.saving = false;
        if (!st.rows.length) load(); else st.total = todo().length;   // the next ten, once this page is done
        draw();
        toast('🧠 Card lines saved for ' + done + ' drug' + (done === 1 ? '' : 's') + (bad ? ' · ' + bad + ' failed' : ''));
    }
    function onClick(e) {
        if (e.target.id === 'pkcb') { close(); return; }
        const b = e.target.closest && e.target.closest('#pkcb [data-act]'); if (!b || !st || b.disabled) return;
        const act = b.dataset.act;
        if (act === 'close') close();
        else if (act === 'lang') { st.lang = b.dataset.v === 'en' ? 'en' : 'th'; draw(); }
        else if (act === 'run') run();
        else if (act === 'stop') { st.stop = true; b.disabled = true; }
        else if (act === 'all') { st.rows.forEach(r => { if (hasLines(r)) r.ok = true; }); draw(); }
        else if (act === 'save') save();
    }
    window.PkCardBatch = { open, todo: () => todo().length };
})();
