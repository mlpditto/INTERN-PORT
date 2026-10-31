// V102.547: Admin ▸ Cases ▸ Review: the PDF the intern attached. Gemini read it after Send (functions/case-file-read.js), so this shows the result:
// the file row, ✨ how many lines to check, Compare (the page beside the text), and a warning when the reader saw a patient identifier.
// The admin scores: nothing here touches the score. The file goes when the case is reviewed or deleted (window.caseFileReview.purge).
// V102.548: a file holding several cases is split into cards (caseGroup): Compare draws only that card's pages, Fix the split changes the ranges.
(function () {
    const STALE_MS = 5 * 60 * 1000;
    // V102.550: a retry can ask another reader. One press reads, and the file then goes to that vendor; the read after Send stays Gemini.
    const READERS = { 'gemini-3.8-flash': 'Gemini', 'claude-opus-5-5': 'Opus 5.5', 'gpt-6-sol': 'Sol 6' }, OTHERS = [['claude-opus-5-5', 'Anthropic'], ['gpt-6-sol', 'OpenAI']];
    const KIND = { hn: 'an HN', name: 'a patient name', id: 'an ID number', address: 'an address', phone: 'a phone number' };
    let stop = null, current = null, wide = false, url = '', boxId = 'case-file-box';

    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const mb = n => (Number(n || 0) / 1048576).toFixed(1) + ' MB';
    const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
    const FV = () => firebase.firestore.FieldValue;
    const range = g => (g.from === g.to ? 'Page ' + g.from : 'Pages ' + g.from + '–' + g.to);
    const toast = (m, k) => { if (typeof showToast === 'function') showToast(m, k); };
    const groupDocs = id => db.collection('cases').where('caseGroup.id', '==', id).get();

    const reader = read => (read && READERS[read.model]) || 'Gemini';
    const others = cls => OTHERS.map(([m, who]) => '<button type="button" class="' + cls + '" data-a="retry" data-m="' + m + '" title="Read with ' + READERS[m] + '. The file goes to ' + who + '.">' + READERS[m] + '</button>').join('');
    // V102.550: the admin corrects each line and its heading here; Copy all puts the same lines under their headings.
    const HEADS = ['CC', 'HPI', 'PMH', 'U/D', 'MH', 'ALL', 'DRPs', 'Plan', 'Assessment'];
    const headOpts = label => [...new Set([...HEADS, 'Note', label])].map(h => '<option' + (h === label ? ' selected' : '') + '>' + esc(h) + '</option>').join('');
    const fit = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    function copyText(read) {
        const rows = (read.rows || []).filter(r => r.text);
        return [...new Set([...HEADS, ...rows.map(r => r.label), 'Note'])].map(h => {
            const lines = rows.filter(r => r.label === h).map(r => r.text);
            return lines.length ? h + ':\n' + lines.join('\n') : '';
        }).filter(Boolean).join('\n\n');
    }
    function statusHtml(read) {
        if (!read) return '<div class="crf-done"><span>Gemini has not read this file</span><div class="crf-acts"><button type="button" class="crf-btn" data-a="retry">Read now</button>' + others('crf-btn') + '</div></div>';
        if (read.status === 'reading' && Date.now() - ms(read.at) < STALE_MS) return '<div class="crf-done"><span><i class="crai-dot"></i>' + reader(read) + ' is reading…</span></div>';
        if (read.status !== 'done') return '<div class="crf-done bad"><span>' + reader(read) + ' could not read this file. You can still open it.</span><div class="crf-acts"><button type="button" class="crf-btn" data-a="retry">Try again</button>' + others('crf-btn') + '</div></div>';
        const n = (read.rows || []).filter(r => r.unsure).length;
        return '<div class="crf-done"><span>✨ Read by ' + reader(read) + ' · ' + (n ? n + (n === 1 ? ' line' : ' lines') + ' to check' : 'nothing marked unsure') + '</span><button type="button" class="crf-btn" data-a="compare" aria-pressed="' + wide + '">Compare</button></div>';
    }
    function flagHtml(read) {
        const marks = (read && read.identifiers) || [];
        if (!marks.length || read.identifiersCleared) return '';
        const m = marks[0];
        return '<div class="crf-flag"><b>🛑 This file may show ' + esc(KIND[m.kind] || KIND.name) + '</b><span>Page ' + Number(m.page) + (marks.length > 1 ? ' and ' + (marks.length - 1) + ' more' : '') + '. Delete the file and ask the intern to send it again?</span>'
            + '<div><button type="button" class="crf-del" data-a="delete">🗑 Delete file</button><button type="button" class="crf-keep" data-a="clear">Not an identifier</button></div></div>';
    }
    function unsplitHtml(read) {
        if (!read || !read.unsplit) return '';
        return '<div class="crf-flag"><b>❔ This file was not split</b><span>Ask a model to try, or split it yourself.</span><div><button type="button" class="crf-keep" data-a="retry">✨ Try to split</button>' + others('crf-keep') + '<button type="button" class="crf-keep" data-a="fix">Split it myself</button></div></div>';
    }
    function compareHtml(c) {
        const read = c.caseFileRead, g = c.caseGroup;
        const rows = (read.rows || []).map((r, i) => '<tr class="' + (r.unsure ? 'low' : '') + '" data-i="' + i + '"><th><select class="crf-head" aria-label="Heading">' + headOpts(r.label) + '</select></th><td><textarea class="crf-line" rows="1" aria-label="' + esc(r.label) + ' text">' + esc(r.text) + '</textarea>' + (r.unsure ? '<em>Unsure · check the page</em>' : '') + '</td></tr>').join('');
        const left = g ? '<div class="crf-page crf-pages" id="crf-pages"><div class="crf-of">Drawing the pages…</div></div>' : '<iframe class="crf-page" title="The intern\'s PDF" src="' + esc(url) + '"></iframe>';
        const where = g ? 'case ' + g.index + ' of ' + g.total + ' · ' + range(g).toLowerCase() : Number(read.pages || 1) + (read.pages > 1 ? ' pages' : ' page');
        return '<div class="crf-two">' + left + '<div class="crf-text"><div class="crf-tl"><span>Text read <button type="button" class="crf-btn" data-a="copy" title="Copy this case, sorted by heading">⧉ Copy all</button></span><span class="crf-of">' + reader(read) + ' · ' + where + '</span></div><table>' + rows + '</table><div class="crf-warn">⚠️ <span>Check each line against the page.</span></div></div></div>';
    }
    // only this card's pages; the browser's PDF viewer cannot be held to a range
    async function drawPages(c) {
        const box = $('crf-pages'), g = c.caseGroup;
        if (!box || !window.pdfjsLib) return;
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument({ url }).promise;
            box.innerHTML = '';
            for (let n = g.from; n <= g.to && n <= pdf.numPages; n++) {
                const page = await pdf.getPage(n), width = box.clientWidth - 2, base = page.getViewport({ scale: 1 }), view = page.getViewport({ scale: Math.max(.5, width / base.width) * (window.devicePixelRatio || 1) });
                const cv = document.createElement('canvas');
                cv.width = view.width; cv.height = view.height; cv.style.width = '100%';
                box.append(cv);
                await page.render({ canvasContext: cv.getContext('2d'), viewport: view }).promise;
            }
        } catch (e) {
            console.warn('caseFile pages', e);
            box.innerHTML = '<iframe class="crf-page" title="The intern\'s PDF" src="' + esc(url) + '#page=' + Number(g.from) + '"></iframe>';
        }
    }
    function fileRow(c) {
        const f = c.caseFile, g = c.caseGroup, read = c.caseFileRead;
        if (g) return '<div class="crf-file"><span aria-hidden="true">📄</span><div class="crf-name"><b>Case ' + g.index + ' of ' + g.total + '</b><small>' + range(g) + ' of ' + Number(g.filePages || 0) + ' · from the intern</small></div>'
            + '<button type="button" class="crf-open" data-a="prev"' + (g.index > 1 ? '' : ' disabled') + '>Previous</button><button type="button" class="crf-open" data-a="next"' + (g.index < g.total ? '' : ' disabled') + '>Next</button></div>';
        return '<div class="crf-file"><span aria-hidden="true">📄</span><div class="crf-name"><b>PDF</b><small>' + (read && read.pages ? Number(read.pages) + ' pages · ' : '') + mb(f.size) + ' · from the intern</small></div><button type="button" class="crf-open" data-a="open">Open</button></div>';
    }
    function render() {
        const box = $(boxId), shell = box && box.closest('.case-score-modal-shell');
        if (!box) return;
        const c = current, f = c && c.caseFile;
        if (shell) shell.classList.toggle('crf-wide', !!(f && wide));
        box.hidden = !f;
        if (!f) { box.innerHTML = ''; return; }
        const showCompare = wide && c.caseFileRead && c.caseFileRead.status === 'done';
        box.innerHTML = fileRow(c) + flagHtml(c.caseFileRead) + unsplitHtml(c.caseFileRead) + statusHtml(c.caseFileRead) + (showCompare ? compareHtml(c) : '');
        if (showCompare) box.querySelectorAll('.crf-line').forEach(fit);
        if (showCompare && c.caseGroup) drawPages(c);
    }

    async function getUrl() {
        if (!url) url = await adminApp.storage().ref(current.caseFile.path).getDownloadURL();
        return url;
    }
    async function removeFile(id, path) {
        await adminApp.storage().ref(path).delete().catch(e => { if (e && e.code !== 'storage/object-not-found') throw e; });
        await db.collection('cases').doc(id).update({ caseFile: FV().delete(), caseFileRead: FV().delete() });
    }
    // the identifier warning: the file goes from every card of the split
    async function removeWholeFile(c) {
        await adminApp.storage().ref(c.caseFile.path).delete().catch(e => { if (e && e.code !== 'storage/object-not-found') throw e; });
        const snap = await groupDocs(c.caseGroup.id), batch = db.batch();
        snap.forEach(d => { if (d.data().caseFile) batch.update(d.ref, { caseFile: FV().delete(), caseFileRead: FV().delete() }); });
        await batch.commit();
    }
    // another card of the same file: the review modal is a promise per case, so close this one first
    function go(delta) {
        const g = current && current.caseGroup; if (!g) return;
        const next = (casesData || []).find(x => x.caseGroup && x.caseGroup.id === g.id && x.caseGroup.index === g.index + delta);
        if (!next) return toast('That case is already closed', 'info');
        closeCaseReviewScoreModal(false);
        if ((next.status || 'pending') === 'pending') updateCaseStatus(next.id, 'reviewed'); else editCaseNote(next.id);
    }

    async function saveRow(el) {
        const c = current, tr = el.closest('tr'), r = c && c.caseFileRead && (c.caseFileRead.rows || [])[+tr.dataset.i];
        if (!r) return;
        if (el.matches('select')) r.label = el.value;
        else { r.text = el.value.trim(); r.unsure = false; tr.classList.remove('low'); const em = tr.querySelector('em'); if (em) em.remove(); }
        $(boxId).querySelector('.crf-done').outerHTML = statusHtml(c.caseFileRead);
        await db.collection('cases').doc(c.id).update({ 'caseFileRead.rows': c.caseFileRead.rows });
    }

    async function act(a, model) {
        const c = current; if (!c) return;
        if (a === 'open') window.open(await getUrl(), '_blank', 'noopener');
        else if (a === 'compare') { if (!wide) await getUrl(); wide = !wide; render(); }
        else if (a === 'copy') { await navigator.clipboard.writeText(copyText(c.caseFileRead)); toast('Copied', 'success'); }
        else if (a === 'prev') go(-1);
        else if (a === 'next') go(1);
        else if (a === 'fix') openFix(c);
        else if (a === 'retry') {
            c.caseFileRead = { status: 'reading', model, at: { toMillis: () => Date.now() } }; render();
            adminApp.functions().httpsCallable('readCaseFile')({ caseDocId: c.id, retry: true, ...(model ? { model } : {}) }).catch(e => console.warn('readCaseFile', e));
        } else if (a === 'clear') await db.collection('cases').doc(c.id).update({ 'caseFileRead.identifiersCleared': true });
        else if (a === 'delete') {
            if (!confirm('Delete this PDF? The case and its score stay.')) return;
            if (c.caseGroup) await removeWholeFile(c); else await removeFile(c.id, c.caseFile.path);
            c.caseFile = null; render();
            toast('File deleted', 'success');
        }
    }

    // ---- Fix the split ------------------------------------------------------------------------------------------------------------------------
    function parseRange(v) {
        const m = /^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/.exec(String(v || ''));
        return m ? { from: +m[1], to: +(m[2] || m[1]) } : null;
    }
    function fixRows(parts, pages) {
        return parts.map((p, i) => '<div class="crf-fx" data-i="' + i + '"><i>' + (i + 1) + '</i><input type="text" class="crf-fx-t" maxlength="60" aria-label="Case ' + (i + 1) + ' title" placeholder="Title" value="' + esc(p.title) + '">'
            + '<input type="text" class="crf-fx-p" aria-label="Case ' + (i + 1) + ' pages" value="' + esc(p.from === p.to ? p.from : p.from + '-' + p.to) + '">'
            + (i < parts.length - 1 ? '<button type="button" class="crf-fx-b" data-fx="merge">Merge</button>' : '') + (parts.length > 1 ? '<button type="button" class="crf-fx-x" data-fx="drop" aria-label="Remove case ' + (i + 1) + '">×</button>' : '') + '</div>').join('')
            + '<button type="button" class="crf-fx-b" data-fx="add">＋ Add case</button>';
    }
    async function openFix(c) {
        if ($('crf-fix')) return;
        const g = c.caseGroup;
        let parts, pages;
        if (g) {
            parts = (await groupDocs(g.id)).docs.map(d => d.data().caseGroup).sort((a, b) => a.index - b.index).map(x => ({ title: x.title || '', from: x.from, to: x.to }));
            pages = g.filePages;
        } else { pages = Number(c.caseFileRead && c.caseFileRead.pages) || 1; parts = [{ title: '', from: 1, to: pages }]; }
        const d = document.createElement('dialog');
        d.id = 'crf-fix'; d.className = 'crf-fix lang-no-toggle';
        d.innerHTML = '<div class="crf-fx-h"><b>Fix the split</b><button type="button" class="csr-x" aria-label="Close">&times;</button></div><p>Cases run in order. Two cases can share a page. Reviewed cards keep their score.</p><div id="crf-fx-list"></div>'
            + '<div class="crf-fx-foot"><span id="crf-fx-used"></span><button type="button" class="csr-save" data-fx="apply">Apply</button></div>';
        const read = () => { d.querySelectorAll('.crf-fx').forEach(r => { const p = parts[+r.dataset.i], x = parseRange(r.querySelector('.crf-fx-p').value); p.title = r.querySelector('.crf-fx-t').value.trim(); if (x) Object.assign(p, x); else p.bad = true; }); };
        const used = () => {
            const ok = parts.every(p => !p.bad) && parts.every((p, i) => (i ? p.from === parts[i - 1].to || p.from === parts[i - 1].to + 1 : p.from === 1) && p.to >= p.from) && parts[parts.length - 1].to === pages;
            $('crf-fx-used').textContent = ok ? pages + ' of ' + pages + ' pages used' : 'Pages must run 1 to ' + pages + ' with no gap';
            d.querySelector('[data-fx="apply"]').disabled = !ok;
        };
        const paint = () => { $('crf-fx-list').innerHTML = fixRows(parts, pages); used(); };
        d.addEventListener('input', () => { parts.forEach(p => delete p.bad); read(); used(); });
        d.addEventListener('click', async e => {
            if (e.target.closest('.csr-x')) return d.close();
            const b = e.target.closest('[data-fx]'); if (!b) return;
            parts.forEach(p => delete p.bad); read();
            const i = +(b.closest('.crf-fx') || {dataset: {}}).dataset.i;
            if (b.dataset.fx === 'merge') { parts[i].to = parts[i + 1].to; parts.splice(i + 1, 1); }
            else if (b.dataset.fx === 'drop') { const gone = parts.splice(i, 1)[0]; if (parts[i - 1]) parts[i - 1].to = gone.to; else parts[0].from = gone.from; }
            else if (b.dataset.fx === 'add') { const last = parts[parts.length - 1]; if (last.to > last.from) { parts.push({ title: '', from: last.to, to: last.to }); last.to -= 1; } }
            else if (b.dataset.fx === 'apply') {
                b.disabled = true;
                try {
                    await adminApp.functions().httpsCallable('applyCaseSplit')({ caseDocId: c.id, parts });
                    d.close(); toast('Split saved', 'success');
                    if ($('caseReviewScoreModal') && typeof closeCaseReviewScoreModal === 'function') closeCaseReviewScoreModal(false);
                } catch (err) { b.disabled = false; toast(err.message, 'error'); }
                return;
            }
            paint();
        });
        d.addEventListener('close', () => d.remove());
        document.body.append(d); paint(); d.showModal();
    }

    document.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('crf-line')) fit(e.target); });
    document.addEventListener('change', e => {
        if (!e.target.matches || !e.target.matches('.crf-line, .crf-head')) return;
        saveRow(e.target).catch(err => { console.warn('caseFile row', err); toast('Could not save: ' + err.message, 'error'); });
    });
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('#case-file-box [data-a], #edit-case-file-box [data-a]');
        if (!b) return;
        act(b.dataset.a, b.dataset.m).catch(err => { console.warn('caseFile', err); toast('Could not finish: ' + err.message, 'error'); });
    });

    window.caseFileReview = {
        start(caseItem, box) {
            this.stop();
            boxId = box || 'case-file-box';
            if (!caseItem || !caseItem.id) return;
            const pick = d => ({ id: caseItem.id, caseFile: d.caseFile || null, caseFileRead: d.caseFileRead || null, caseGroup: d.caseGroup || null });
            current = pick(caseItem);
            render();
            if (!current.caseFile) return;
            stop = db.collection('cases').doc(caseItem.id).onSnapshot(s => {
                if (!current || current.id !== caseItem.id) return;
                const next = pick(s.data() || {}), same = wide && JSON.stringify(next.caseFileRead) === JSON.stringify(current.caseFileRead);
                current = next;
                if (!same) render();   // an edit comes back as the same read: keep the pages and the scroll
            }, e => console.warn('caseFile watch', e));
        },
        stop() {
            if (stop) stop();
            stop = null; current = null; wide = false; url = '';
            render();
        },
        // the waiting list: one line above the first card of a split file
        groupHead(c, seen) {
            const g = c.caseGroup;
            if (!g || seen.has(g.id)) return '';
            seen.add(g.id);
            return '<div class="crf-ghead"><span>📄 <b>1 PDF · ' + Number(g.total) + ' cases</b> · ' + Number(g.filePages || 0) + ' pages · Gemini split this file, check it</span><button type="button" class="crf-btn" onclick="caseFileReview.fix(\'' + esc(c.id) + '\')">Fix the split</button></div>';
        },
        fix(id) {
            const c = (casesData || []).find(x => x.id === id);
            if (c) openFix(c).catch(e => toast(e.message, 'error'));
        },
        // after a review or a delete: the file must not outlive it. A failure never blocks the admin's save; it stays listed on the case.
        // A split file goes with its last open card.
        async purge(caseItem, caseDeleted) {
            const path = caseItem && caseItem.caseFile && caseItem.caseFile.path, g = caseItem && caseItem.caseGroup;
            if (!path) return;
            try {
                if (g) {
                    const open = (await groupDocs(g.id)).docs.filter(d => d.id !== caseItem.id && (d.data().status || 'pending') === 'pending');
                    if (!caseDeleted) await db.collection('cases').doc(caseItem.id).update({ caseFile: FV().delete(), caseFileRead: FV().delete() });
                    if (!open.length) await adminApp.storage().ref(path).delete();
                } else if (caseDeleted) await adminApp.storage().ref(path).delete();
                else await removeFile(caseItem.id, path);
            } catch (e) { console.warn('caseFile purge', e); }
        }
    };
})();
