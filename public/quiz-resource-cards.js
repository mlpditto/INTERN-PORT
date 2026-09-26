/* Quiz-level resources retain the existing materials [{name,url,desc}] schema.
   V102.03: one lean row per resource — site icon · inline title · domain chip that opens the link in one click ·
   ✎ edit link · 💬 note · 🗑. No field labels; a new card starts as "paste a link"; the note shows under the row
   when it has text (textarea, so multi-line notes keep their line breaks). */
window.quizResourceCards = (() => {
    let originals = [];
    const grid = () => document.getElementById('quiz-resource-grid');
    const count = () => grid().querySelectorAll('article').length;
    // Colour + icon by destination (hostname only — nothing is sent anywhere).
    const SITES = [
        [h => /(^|\.)1drv\.ms$|(^|\.)onedrive\.live\.com$|(^|\.)sharepoint\.com$/.test(h), 'OneDrive', '#0364b8', 'fa-solid fa-cloud'],
        [h => /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h), 'YouTube', '#dc2626', 'fa-brands fa-youtube'],
        [h => /(^|\.)(drive|docs)\.google\.com$/.test(h), 'Google Drive', '#1e8e3e', 'fa-brands fa-google-drive'],
        [h => /(^|\.)canva\.com$/.test(h), 'Canva', '#7d2ae8', 'fa-solid fa-palette'],
        [h => /(^|\.)wikipedia\.org$/.test(h), 'Wikipedia', '#475569', 'fa-brands fa-wikipedia-w']
    ];
    function parse(value) {
        try {
            const u = new URL(String(value || '').trim());
            if (!['http:', 'https:'].includes(u.protocol)) return null;
            return u;
        } catch (_) { return null; }
    }
    function site(u) {
        if (!u) return { name: '', color: '#334155', icon: 'fa-solid fa-link' };
        const host = u.hostname.replace(/^www\./, '');
        const hit = SITES.find(s => s[0](host));
        if (hit) return { name: hit[1], color: hit[2], icon: hit[3] };
        if (/\.pdf$/i.test(u.pathname)) return { name: 'PDF', color: '#b91c1c', icon: 'fa-solid fa-file-pdf' };
        return { name: 'Link', color: '#4338ca', icon: 'fa-solid fa-link' };
    }
    function update() {
        document.getElementById('quiz-resource-count').textContent = count();
        if (!count()) {
            const empty = document.createElement('p');
            empty.className = 'resource-empty';
            empty.textContent = 'No materials yet. Add a link to slides, a video, or a reference.';
            grid().replaceChildren(empty);
        }
    }
    function fitNote(note) { note.style.height = 'auto'; note.style.height = note.scrollHeight + 'px'; }
    // Row state: a valid link not being edited shows the chip; otherwise the URL field.
    function paint(card) {
        const url = card.querySelector('[data-field="url"]'), u = parse(url.value);
        const editing = card.dataset.editing === '1' || !u, s = site(u);
        const dot = card.querySelector('.res-dot'), go = card.querySelector('.res-go');
        dot.style.background = s.color;
        dot.innerHTML = `<i class="${s.icon}" aria-hidden="true"></i>`;
        dot.title = s.name;
        url.hidden = !editing;
        go.hidden = editing;
        card.querySelector('.res-edit').hidden = editing;
        if (u) {
            const host = u.hostname.replace(/^www\./, '');
            go.href = u.href;
            go.style.borderColor = s.color;
            go.querySelector('span').textContent = host;
            go.title = 'เปิดในแท็บใหม่ · ' + u.href;
            go.setAttribute('aria-label', 'Open ' + host + ' in a new tab');
        }
    }
    function add(material = {}) {
        grid().querySelector('.resource-empty')?.remove();
        const card = document.createElement('article');
        card.className = 'res-row';
        card.innerHTML = '<div class="res-line">'
            + '<span class="res-dot" aria-hidden="true"></span>'
            + '<input data-field="name" class="res-title" placeholder="Title" aria-label="Title">'
            + '<input data-field="url" type="url" class="res-url" placeholder="paste a link" aria-label="Link URL">'
            + '<a class="res-go" target="_blank" rel="noopener noreferrer" hidden><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span></span></a>'
            + '<button type="button" class="res-icon res-edit" title="แก้ลิงก์" aria-label="Edit link" hidden><i class="fa-solid fa-pen" aria-hidden="true"></i></button>'
            + '<button type="button" class="res-icon res-note-btn" title="โน้ตถึงผู้เรียน" aria-label="Note for learners"><i class="fa-regular fa-comment" aria-hidden="true"></i></button>'
            + '<button type="button" class="res-icon res-del" title="ลบ" aria-label="Remove resource"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>'
            + '</div>'
            + '<div class="res-note" hidden><textarea data-field="desc" rows="1" placeholder="note for learners" aria-label="Note for learners"></textarea></div>';
        card._original = { ...material };
        for (const field of card.querySelectorAll('[data-field]')) field.value = material[field.dataset.field] || '';
        const url = card.querySelector('[data-field="url"]'), note = card.querySelector('[data-field="desc"]');
        const noteRow = card.querySelector('.res-note'), noteBtn = card.querySelector('.res-note-btn');
        const settle = () => { if (parse(url.value)) { card.dataset.editing = '0'; paint(card); } };
        url.addEventListener('input', () => url.setCustomValidity(''));
        url.addEventListener('paste', () => setTimeout(settle, 0));
        url.addEventListener('change', settle);
        url.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); settle(); } });
        card.querySelector('.res-edit').onclick = () => { card.dataset.editing = '1'; paint(card); url.focus(); url.select(); };
        const showNote = on => { noteRow.hidden = !on; noteBtn.classList.toggle('on', !!note.value.trim()); if (on) fitNote(note); };
        noteBtn.onclick = () => { showNote(true); note.focus(); };
        note.addEventListener('input', () => { fitNote(note); noteBtn.classList.toggle('on', !!note.value.trim()); });
        note.addEventListener('blur', () => { if (!note.value.trim()) showNote(false); });
        card.querySelector('.res-del').onclick = () => { card.remove(); update(); };
        grid().append(card);
        paint(card);
        showNote(!!note.value.trim());
        update();
        if (!material.url) url.focus();
    }
    function validUrl(input) {
        const valid = !!parse(input.value);
        input.setCustomValidity(valid ? '' : 'Enter a valid http:// or https:// link.');
        if (!valid) {
            const card = input.closest('article');
            if (card) { card.dataset.editing = '1'; paint(card); } // a hidden field cannot show its message
            input.reportValidity();
        }
        return valid;
    }
    function read() {
        return Array.from(grid().querySelectorAll('article'), card => {
            const input = card.querySelector('[data-field="url"]');
            if (!validUrl(input)) throw new Error('Please check the URL in Materials before saving.');
            const material = { ...card._original };
            for (const field of card.querySelectorAll('[data-field]')) material[field.dataset.field] = field.value.trim();
            if (!material.desc) delete material.desc;
            return material;
        });
    }
    function load(materials) {
        originals = Array.isArray(materials) ? materials : [];
        grid().replaceChildren();
        originals.forEach(material => add(material));
        update();
    }
    return { load, add, read, count };
})();
