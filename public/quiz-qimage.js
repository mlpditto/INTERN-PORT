/* V101.03: per-question images for the Quiz Editor — v1 = PubChem 2D structure by
   drug name, or an uploaded file. The image is inserted into the stem as Markdown
   `![alt](url)`; both the admin preview (renderMdInline) and the intern quiz screen
   (renderMd) already turn that into <img>, so no schema or player change is needed.
   Uploads reuse the admin-only `editor-images/` Storage folder that quiz covers use. */
window.QuizQImage = (() => {
    const PUBCHEM = name => 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + encodeURIComponent(name) + '/PNG?image_size=500x500';
    const BTN = 'width:auto; min-height:0; background:#0f172a; color:#f1f5f9; border:1px solid #334155; border-radius:6px; padding:4px 9px; font-size:0.78em; cursor:pointer; white-space:nowrap;';
    let busy = false;

    function panelFor(button) {
        const item = button.closest('.quiz-q-item');
        const toolbar = button.closest('.md-toolbar');
        const textarea = item && item.querySelector('.q-text');
        if (!item || !toolbar || !textarea) return null;
        let panel = toolbar.nextElementSibling;
        if (panel && panel.classList.contains('qimg-panel')) return panel;
        panel = document.createElement('div');
        panel.className = 'qimg-panel';
        panel.innerHTML = `
            <div class="qimg-row">
                <input type="text" class="qimg-name" placeholder="Drug name · e.g. diazepam" title="ชื่อยา / สารเคมี (ภาษาอังกฤษ) — ดึงโครงสร้าง 2D จาก PubChem">
                <button type="button" class="qimg-pubchem" style="${BTN}">🧪 PubChem</button>
                <button type="button" class="qimg-upload" style="${BTN}" title="อัปโหลดรูปเอง — PNG, JPG หรือ WebP ไม่เกิน 10 MB">📁 Upload</button>
                <button type="button" class="qimg-close" style="${BTN}" title="ปิด">✕</button>
            </div>
            <div class="qimg-status" role="status"></div>
            <div class="qimg-preview" hidden>
                <img alt="">
                <div class="qimg-row">
                    <input type="text" class="qimg-alt" placeholder="Caption / alt text" title="คำบรรยายรูป (แสดงเมื่อโหลดรูปไม่ได้)">
                    <button type="button" class="qimg-insert" style="${BTN} background:#22c55e; border-color:#22c55e; color:#fff; font-weight:800;">Insert</button>
                </div>
            </div>`;
        toolbar.insertAdjacentElement('afterend', panel);
        const status = panel.querySelector('.qimg-status');
        const nameInput = panel.querySelector('.qimg-name');
        let candidate = null; // { blob, url } — blob to upload, or a direct url when the blob could not be fetched

        function showPreview(src, alt) {
            const preview = panel.querySelector('.qimg-preview');
            preview.querySelector('img').src = src;
            panel.querySelector('.qimg-alt').value = alt;
            preview.hidden = false;
        }
        function clearPreview() {
            candidate = null;
            const preview = panel.querySelector('.qimg-preview');
            preview.hidden = true; preview.querySelector('img').removeAttribute('src');
        }
        function setBusy(on) { busy = on; panel.querySelectorAll('button').forEach(b => b.disabled = on); }

        panel.querySelector('.qimg-close').onclick = () => { clearPreview(); panel.remove(); };
        nameInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); panel.querySelector('.qimg-pubchem').click(); } };

        panel.querySelector('.qimg-pubchem').onclick = async () => {
            if (busy) return;
            const name = nameInput.value.trim();
            if (!name) { status.textContent = 'Type a drug name first'; nameInput.focus(); return; }
            const url = PUBCHEM(name);
            clearPreview(); setBusy(true); status.textContent = 'Fetching structure from PubChem…';
            try {
                const res = await fetch(url);
                if (res.status === 404) throw new Error('PubChem has no compound named "' + name + '" — try the generic (INN) name');
                if (!res.ok) throw new Error('PubChem error ' + res.status);
                const blob = await res.blob();
                candidate = { blob, url: '' };
                showPreview(URL.createObjectURL(blob), 'Structure of ' + name);
                status.textContent = 'Check the structure, then Insert';
            } catch (error) {
                if (error instanceof TypeError) {
                    // Network / CORS failure: still usable by linking PubChem directly
                    candidate = { blob: null, url };
                    showPreview(url, 'Structure of ' + name);
                    status.textContent = 'Could not download — the image will be linked from PubChem directly';
                } else {
                    status.textContent = error.message || 'PubChem lookup failed';
                }
            } finally { setBusy(false); }
        };

        panel.querySelector('.qimg-upload').onclick = () => {
            if (busy) return;
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.hidden = true;
            document.body.append(input);
            input.oncancel = () => input.remove();
            input.onchange = () => {
                const file = input.files[0]; input.remove();
                if (!file) return;
                if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { status.textContent = 'Use PNG, JPG or WebP up to 10 MB'; return; }
                clearPreview();
                candidate = { blob: file, url: '' };
                showPreview(URL.createObjectURL(file), file.name.replace(/\.[a-z0-9]+$/i, ''));
                status.textContent = 'Check the image, then Insert';
            };
            input.click();
        };

        panel.querySelector('.qimg-insert').onclick = async () => {
            if (busy || !candidate) return;
            setBusy(true);
            try {
                let url = candidate.url;
                if (candidate.blob) { status.textContent = 'Uploading…'; url = await upload(candidate.blob); }
                const alt = panel.querySelector('.qimg-alt').value.trim().replace(/[\[\]]/g, '') || 'image';
                insertMarkdown(textarea, '![' + alt + '](' + url + ')');
                clearPreview();
                status.textContent = 'Inserted — make sure the image does not give away the answer';
                if (typeof triggerAutoSave === 'function') triggerAutoSave();
            } catch (error) {
                console.error('Question image:', error);
                status.textContent = 'Insert failed: ' + (error.message || 'please retry');
            } finally { setBusy(false); }
        };
        return panel;
    }

    async function upload(file) {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // flatten transparency (structure PNGs) onto white
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
        if (!blob) throw new Error('Could not process image');
        const ref = adminApp.storage().ref(`editor-images/quiz-q-${Date.now()}-${crypto.randomUUID()}.webp`);
        await ref.put(blob, { contentType: 'image/webp' });
        return ref.getDownloadURL();
    }

    // Insert on its own line at the cursor, then re-render the preview via the input event.
    // An untouched textarea reports the cursor at 0 — there, append after the stem instead.
    function insertMarkdown(textarea, md) {
        let start = textarea.selectionStart, end = textarea.selectionEnd;
        if (start === 0 && end === 0 && textarea.value) start = end = textarea.value.length;
        const before = textarea.value.substring(0, start), after = textarea.value.substring(end);
        const lead = before && !before.endsWith('\n') ? '\n\n' : (before ? '\n' : '');
        const trail = after && !after.startsWith('\n') ? '\n' : '';
        textarea.value = before + lead + md + trail + after;
        const pos = (before + lead + md).length;
        textarea.focus(); textarea.setSelectionRange(pos, pos);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function toggle(button) {
        const toolbar = button.closest('.md-toolbar');
        const existing = toolbar && toolbar.nextElementSibling;
        if (existing && existing.classList.contains('qimg-panel')) { existing.querySelector('.qimg-close').click(); return; }
        const panel = panelFor(button);
        if (panel) panel.querySelector('.qimg-name').focus();
    }

    return { toggle, insertMarkdown };
})();
