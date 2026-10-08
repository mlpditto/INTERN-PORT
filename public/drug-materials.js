/* V102.129: Drug Codex download files — drug_codex/{id}.materials = [{name, url}], the same shape as a quiz's
   materials (interns open them from the Codex list / detail). This file is the admin form's editor: one lean row per
   file — type dot · title · link · 🗑 — plus the pop-up list behind the 📎 chip on the admin drug list. */
window.drugMaterials = (() => {
    // Colour + icon by destination (hostname / extension only) — same palette as quiz-resource-cards.js and index.html materialKind.
    function kind(u) {
        const host = u ? u.hostname.replace(/^www\./, '') : '';
        if (/(^|\.)1drv\.ms$|(^|\.)onedrive\.live\.com$|(^|\.)sharepoint\.com$/.test(host)) return { name: 'OneDrive', color: '#0364b8', icon: 'fa-solid fa-cloud' };
        if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return { name: 'YouTube', color: '#dc2626', icon: 'fa-brands fa-youtube' };
        if (/(^|\.)(drive|docs)\.google\.com$/.test(host)) return { name: 'Google Drive', color: '#1e8e3e', icon: 'fa-brands fa-google-drive' };
        if (/(^|\.)canva\.com$/.test(host)) return { name: 'Canva', color: '#7d2ae8', icon: 'fa-solid fa-palette' };
        if (u && /\.pdf$/i.test(u.pathname)) return { name: 'PDF', color: '#dc2626', icon: 'fa-solid fa-file-pdf' };
        return { name: 'Link', color: '#6d28d9', icon: 'fa-solid fa-file-arrow-down' };
    }
    function parse(value) {
        try {
            const u = new URL(String(value || '').trim());
            return ['http:', 'https:'].includes(u.protocol) ? u : null;
        } catch (_) { return null; }
    }
    // The count label is named on the list (data-count); the Drug form's keeps its original id as the default.
    function recount(list) {
        const el = document.getElementById(list.dataset.count || 'dca-mat-count');
        if (el) el.textContent = list.querySelectorAll('.dm-row').length || '';
    }
    function paintRow(row) {
        const url = row.querySelector('.dm-url'), u = parse(url.value), k = kind(u);
        const dot = row.querySelector('.dm-dot');
        dot.style.background = u ? k.color : '#94a3b8';
        dot.innerHTML = '<i class="' + (u ? k.icon : 'fa-solid fa-link') + '" aria-hidden="true"></i>';
        dot.title = u ? k.name : '';
        url.classList.toggle('dm-bad', !!url.value.trim() && !u);
    }
    function add(list, material = {}) {
        const row = document.createElement('div');
        row.className = 'dm-row';
        row.innerHTML = '<span class="dm-dot" aria-hidden="true"></span>'
            + '<input class="dm-name" type="text" placeholder="Title" aria-label="File title" maxlength="120">'
            + '<input class="dm-url" type="url" placeholder="paste a link" aria-label="File link">'
            + '<button type="button" class="dm-del" title="Remove" aria-label="Remove file"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>';
        row.querySelector('.dm-name').value = material.name || '';
        row.querySelector('.dm-url').value = material.url || '';
        row.querySelector('.dm-url').addEventListener('input', () => paintRow(row));
        row.querySelector('.dm-del').onclick = () => { row.remove(); recount(list); };
        list.append(row);
        paintRow(row);
        recount(list);
        if (!material.url) row.querySelector('.dm-url').focus();
        return row;
    }
    // Fill the editor from a saved doc (an old doc / a draft has none → empty).
    function paint(list, materials) {
        list.replaceChildren();
        (Array.isArray(materials) ? materials : []).filter(m => m && parse(m.url)).forEach(m => {
            const row = add(list, m);
            row.querySelector('.dm-url').blur();
        });
        recount(list);
    }
    // What gets saved: rows with a valid http(s) link, trimmed. A row with only a title is dropped.
    function read(list) {
        return Array.from(list.querySelectorAll('.dm-row'), row => ({
            name: row.querySelector('.dm-name').value.trim(),
            url: row.querySelector('.dm-url').value.trim()
        })).filter(m => parse(m.url));
    }
    // Pop-up behind the 📎 n chip on an admin list row: the valid files as links (new tab) + ✎ Edit files.
    // V102.130: shared by the Drug and Disease lists — the caller supplies the title and what ✎ does.
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    function openPopup({ title, materials, onEdit }) {
        const mats = (Array.isArray(materials) ? materials : []).filter(m => m && parse(m.url));
        if (!mats.length) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:100050;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
        const rows = mats.map(m => {
            const u = parse(m.url), k = kind(u);
            const name = String(m.name || '').trim() || u.hostname.replace(/^www\./, '');
            return `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" title="${esc(m.url)}" style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-weight:800;text-decoration:none;"><i class="${k.icon}" style="color:${k.color};" aria-hidden="true"></i><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</span></a>`;
        }).join('');
        overlay.innerHTML = `<div class="lang-no-toggle" style="background:#fff;width:100%;max-width:440px;max-height:86vh;overflow:auto;border-radius:18px;padding:18px 18px 16px;box-shadow:0 25px 50px rgba(0,0,0,0.3);">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;"><h3 style="flex:1;margin:0;font-size:1.02em;color:#0f172a;word-break:break-word;">📎 ${esc(title)} (${mats.length})</h3>
                <button type="button" data-act="close" aria-label="Close" style="width:auto;min-height:0;padding:0 6px;border:0;background:transparent;font-size:1.4em;color:#64748b;cursor:pointer;">&times;</button></div>
            <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
            <div style="display:flex;justify-content:flex-end;margin-top:12px;"><button type="button" data-act="edit" style="width:auto;min-height:0;padding:7px 14px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;color:#c2410c;font-weight:800;cursor:pointer;">✎ Edit files</button></div></div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => {
            if (e.target === overlay || e.target.closest('[data-act="close"]')) return overlay.remove();
            if (e.target.closest('[data-act="edit"]')) { overlay.remove(); if (onEdit) onEdit(); }
        });
    }
    return { kind, parse, add, paint, read, openPopup };
})();
