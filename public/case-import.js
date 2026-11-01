// V102.560: Import PDF into Alabasta. The file stays in this browser: the admin draws bars, the pages are flattened to new JPEGs, and only those go to be read.
// Nothing is kept but the text the admin approves. The card has no intern, so it is written as reviewed and carries no points.
(function () {
    const MAX_PAGES = 6, SCALE = 1.6, QUALITY = 0.82;
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const WARN = { hn: 'an HN', id: 'an ID number', email: 'an e-mail', phone: 'a phone number', name: 'a name', place: 'a hospital or clinic name' };
    const FLAG = { high: '▲ High', low: '▼ Low', limit: '● At limit' };
    let box, st = null;

    function shell(html) {
        if (!box) { box = document.createElement('dialog'); box.id = 'cim-box'; box.className = 'lang-no-toggle'; box.addEventListener('close', wipe); document.body.append(box); }
        box.innerHTML = `<div class="cim-h"><b>📄 Import PDF</b><button type="button" class="cim-x" aria-label="Close">×</button></div>${html}`;
        box.querySelector('.cim-x').onclick = () => box.close();
        if (!box.open) box.showModal();
    }
    function wipe() {   // the pages leave memory with the box
        if (st) st.pages.forEach(p => { p.canvas.width = p.canvas.height = 0; });
        st = null;
    }
    function start() {
        shell('<p class="cim-n">Pick a PDF. It stays in this browser. You cover private details next, and only the covered pages are sent.</p><input type="file" id="cim-file" accept="application/pdf">');
        box.querySelector('#cim-file').onchange = e => { if (e.target.files[0]) load(e.target.files[0]); };
    }
    async function load(file) {
        shell('<p class="cim-n" role="status">Opening the PDF…</p>');
        try {
            const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
            if (pdf.numPages > MAX_PAGES) { pdf.destroy(); return shell(`<p class="cim-n">This PDF has ${pdf.numPages} pages. The limit is ${MAX_PAGES}.</p>`); }
            const pages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i), vp = page.getViewport({ scale: SCALE }), canvas = document.createElement('canvas');
                canvas.width = vp.width; canvas.height = vp.height;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
                pages.push({ canvas, bars: [] });
            }
            pdf.destroy();
            st = { pages, at: 0 };
            cover();
        } catch (e) { console.warn('case import', e && e.message); shell('<p class="cim-n">Could not open this PDF.</p>'); }
    }
    function cover() {
        const p = st.pages[st.at], n = st.pages.length, bars = st.pages.reduce((a, x) => a + x.bars.length, 0);
        shell(`<p class="cim-n">Drag to cover: name, HN, address, phone, doctor, signature, <b>hospital name</b> and <b>stamp</b>. Tap a bar to remove it.</p>
            <div class="cim-pg"><button type="button" id="cim-prev" aria-label="Previous page"${st.at ? '' : ' disabled'}>‹</button><span>Page ${st.at + 1} / ${n}</span><button type="button" id="cim-next" aria-label="Next page"${st.at < n - 1 ? '' : ' disabled'}>›</button><small>${bars} bars</small></div>
            <div class="cim-stage" id="cim-stage"></div>
            <div class="cim-a"><button type="button" class="cim-go" id="cim-send">Send covered pages</button></div>`);
        const stage = box.querySelector('#cim-stage');
        p.canvas.className = 'cim-page'; stage.append(p.canvas);
        paintBars(stage, p);
        const rel = e => { const r = p.canvas.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
        let from = null, live = null;
        stage.onpointerdown = e => {
            if (e.target.closest('.cim-bar')) return;
            e.preventDefault(); from = rel(e); live = { x: from.x, y: from.y, w: 0, h: 0 };
            stage.setPointerCapture(e.pointerId);
        };
        stage.onpointermove = e => {
            if (!from) return;
            const at = rel(e);
            live = { x: Math.min(from.x, at.x), y: Math.min(from.y, at.y), w: Math.abs(at.x - from.x), h: Math.abs(at.y - from.y) };
            paintBars(stage, p, live);
        };
        stage.onpointerup = () => {
            if (!from) return;   // a tap on a bar: its own click removes it
            if (live.w > 0.01 && live.h > 0.005) p.bars.push(live);
            from = null; live = null;
            cover();
        };
        box.querySelector('#cim-prev').onclick = () => { st.at--; cover(); };
        box.querySelector('#cim-next').onclick = () => { st.at++; cover(); };
        box.querySelector('#cim-send').onclick = send;
    }
    function paintBars(stage, p, live) {
        stage.querySelectorAll('.cim-bar').forEach(b => b.remove());
        p.bars.concat(live ? [live] : []).forEach((b, i) => {
            const el = document.createElement('button');
            el.type = 'button'; el.className = 'cim-bar'; el.setAttribute('aria-label', 'Remove this bar');
            el.style.cssText = `left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%`;
            el.onclick = () => { p.bars.splice(i, 1); cover(); };
            stage.append(el);
        });
    }
    // a new canvas: the bars are burnt in, and a JPEG has no text layer to read under them
    function flatten(p) {
        const c = document.createElement('canvas'), x = c.getContext('2d');
        c.width = p.canvas.width; c.height = p.canvas.height;
        x.drawImage(p.canvas, 0, 0);
        x.fillStyle = '#000';
        p.bars.forEach(b => x.fillRect(b.x * c.width, b.y * c.height, b.w * c.width, b.h * c.height));
        return c.toDataURL('image/jpeg', QUALITY).split(',')[1];
    }
    async function send() {
        const bare = st.pages.map((p, i) => (p.bars.length ? 0 : i + 1)).filter(Boolean);
        if (bare.length && !confirm(`Page ${bare.join(', ')} has no bars. Send anyway?`)) return;
        const images = st.pages.map(flatten);
        shell('<p class="cim-n" role="status">Reading the covered pages…</p>');
        try {
            const r = (await adminApp.functions().httpsCallable('importCaseRead', { timeout: 150000 })({ images })).data || {};
            if (!r.read) { st.at = 0; return cover(); }
            st.read = r.read; review();
        } catch (e) {
            console.warn('importCaseRead', e && e.message);
            shell('<p class="cim-n">The pages could not be read. Please try again.</p>');
        }
    }
    function review() {
        const r = st.read, b = r.basics;
        const bits = [b.age && b.age + ' y', b.sex, b.heightCm && b.heightCm + ' cm', b.weightKg && b.weightKg + ' kg', b.bmi && 'BMI ' + b.bmi, b.bp && 'BP ' + b.bp, b.pulse && b.pulse + ' /min'].filter(Boolean);
        const warn = r.warnings.length ? `<p class="cim-warn">⚠️ This text may contain ${r.warnings.map(w => WARN[w] || w).join(', ')}. Go back and cover more; this card cannot be created.</p>` : '<p class="cim-ok">✓ No name, HN, ID, phone, e-mail or hospital found in the text.</p>';
        shell(`<label class="cim-t"><span>Title</span><input id="cim-title" maxlength="80" value="${esc(r.title)}"></label>
            <p class="cim-b">${esc(bits.join(' · '))}</p>
            ${r.labs.length ? `<table class="cim-lab"><thead><tr><th>Test</th><th>Result</th><th>Normal</th><th></th></tr></thead><tbody>${r.labs.map(l => `<tr class="cim-f-${esc(l.flag)}"><td>${esc(l.test)}</td><td>${esc(l.value)} ${esc(l.unit)}</td><td>${esc(l.range)}</td><td>${esc(FLAG[l.flag] || '')}</td></tr>`).join('')}</tbody></table><p class="cim-n">Flags come from the printed range, not from AI.</p>` : ''}
            ${r.notes.length ? `<ul class="cim-ul">${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
            ${r.sensitive.length ? `<label class="cim-s"><input type="checkbox" id="cim-sens"> Add ${r.sensitive.length} sensitive finding${r.sensitive.length > 1 ? 's' : ''} to the card (left out by default)</label>` : ''}
            ${warn}
            <div class="cim-a"><button type="button" id="cim-back">‹ Cover more</button><button type="button" class="cim-go" id="cim-make"${r.warnings.length ? ' disabled' : ''}>Create case card</button></div>`);
        box.querySelector('#cim-back').onclick = () => { st.at = 0; cover(); };
        box.querySelector('#cim-make').onclick = make;
    }
    function noteOf(r, withSensitive) {
        const b = r.basics, head = [b.age && 'Age ' + b.age, b.sex, b.heightCm && b.heightCm + ' cm', b.weightKg && b.weightKg + ' kg', b.bmi && 'BMI ' + b.bmi, b.bp && 'BP ' + b.bp, b.pulse && 'Pulse ' + b.pulse].filter(Boolean).join(' · ');
        const labs = r.labs.map(l => `${l.test}: ${l.value}${l.unit ? ' ' + l.unit : ''}${l.range ? ' (normal ' + l.range + ')' : ''}${FLAG[l.flag] ? ' ' + FLAG[l.flag] : ''}`);
        return [head].concat(labs, r.notes, withSensitive ? r.sensitive : []).filter(Boolean).join('\n');
    }
    async function make() {
        const r = st.read, btn = box.querySelector('#cim-make'), title = (box.querySelector('#cim-title').value || '').trim() || r.title;
        const sens = !!(box.querySelector('#cim-sens') || {}).checked;
        btn.disabled = true;
        try {
            const ts = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('cases').add({
                authUid: firebase.auth().currentUser.uid, userId: 'case-import', displayName: 'Imported case', pictureUrl: '',
                caseId: 'IMP-' + Date.now().toString(36).toUpperCase(), customer: '', customerTel: '',
                disease: title, diseaseSystemKey: null, diseaseSystemLabel: title, symptomTags: [],
                note: noteOf(r, sens), caseLabs: r.labs, importedFrom: 'pdf', importedBy: ALLOWED_EMAIL || 'admin',
                status: 'reviewed', isArchived: false, adminBonus: 0, timestamp: ts, reviewedAt: ts
            });
            box.close();
            if (typeof showToast === 'function') showToast('Case card created: ' + title);
        } catch (e) { console.warn('case import save', e && e.message); btn.disabled = false; alert('Could not save the card.'); }
    }
    window.caseImport = { start, noteOf };
    document.addEventListener('DOMContentLoaded', () => {
        const near = document.getElementById('alabasta-status-rejected');
        if (!near) return;
        const b = document.createElement('button');
        b.type = 'button'; b.id = 'alabasta-import-pdf'; b.className = 'alabasta-filter-pill'; b.textContent = '📄 Import PDF'; b.title = 'Import a report as a case card. Private details are covered in this browser first.';
        b.onclick = start;
        near.after(b);
    });
})();
