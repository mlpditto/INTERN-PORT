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
    const countEl = () => document.getElementById('dca-mat-count');
    function recount(list) {
        const el = countEl();
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
    return { kind, parse, add, paint, read };
})();
