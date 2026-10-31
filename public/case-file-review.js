// V102.547: Admin ▸ Cases ▸ Review: the PDF the intern attached. Gemini read it after Send (functions/case-file-read.js), so this shows the result:
// the file row, ✨ how many lines to check, Compare (the page beside the text), and a warning when the reader saw a patient identifier.
// The admin scores: nothing here touches the score. The file goes when the case is reviewed or deleted (window.caseFileReview.purge).
(function () {
    const STALE_MS = 2 * 60 * 1000;
    const KIND = { hn: 'an HN', name: 'a patient name', id: 'an ID number', address: 'an address', phone: 'a phone number' };
    let stop = null, current = null, wide = false, url = '';

    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const mb = n => (Number(n || 0) / 1048576).toFixed(1) + ' MB';
    const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
    const FV = () => firebase.firestore.FieldValue;

    function statusHtml(read) {
        if (!read) return '<div class="crf-done"><span>Gemini has not read this file</span><button type="button" class="crf-btn" data-a="retry">Read now</button></div>';
        if (read.status === 'reading' && Date.now() - ms(read.at) < STALE_MS) return '<div class="crf-done"><span><i class="crai-dot"></i>Gemini is reading…</span></div>';
        if (read.status !== 'done') return '<div class="crf-done bad"><span>Gemini could not read this file. You can still open it.</span><button type="button" class="crf-btn" data-a="retry">Try again</button></div>';
        const n = (read.rows || []).filter(r => r.unsure).length;
        return '<div class="crf-done"><span>✨ Read by Gemini · ' + (n ? n + (n === 1 ? ' line' : ' lines') + ' to check' : 'nothing marked unsure') + '</span><button type="button" class="crf-btn" data-a="compare" aria-pressed="' + wide + '">Compare</button></div>';
    }
    function flagHtml(c, read) {
        const marks = (read && read.identifiers) || [];
        if (!marks.length || read.identifiersCleared) return '';
        const m = marks[0];
        return '<div class="crf-flag"><b>🛑 This file may show ' + esc(KIND[m.kind] || KIND.name) + '</b><span>Page ' + Number(m.page) + (marks.length > 1 ? ' and ' + (marks.length - 1) + ' more' : '') + '. Delete the file and ask the intern to send it again?</span>'
            + '<div><button type="button" class="crf-del" data-a="delete">🗑 Delete file</button><button type="button" class="crf-keep" data-a="clear">Not an identifier</button></div></div>';
    }
    function compareHtml(read) {
        const rows = (read.rows || []).map(r => '<tr class="' + (r.unsure ? 'low' : '') + '"><th>' + esc(r.label) + '</th><td>' + esc(r.text) + (r.unsure ? '<em>Unsure · check the page</em>' : '') + '</td></tr>').join('');
        return '<div class="crf-two"><iframe class="crf-page" title="The intern\'s PDF" src="' + esc(url) + '"></iframe><div class="crf-text"><div class="crf-tl"><span>Text read</span><span class="crf-of">Gemini · ' + Number(read.pages || 1) + (read.pages > 1 ? ' pages' : ' page') + '</span></div><table>' + rows + '</table><div class="crf-warn">⚠️ <span>Check each line against the page.</span></div></div></div>';
    }
    function render() {
        const box = $('case-file-box'), shell = box && box.closest('.case-score-modal-shell');
        if (!box) return;
        const c = current, f = c && c.caseFile;
        if (shell) shell.classList.toggle('crf-wide', !!(f && wide));
        box.hidden = !f;
        if (!f) { box.innerHTML = ''; return; }
        box.innerHTML = '<div class="crf-file"><span aria-hidden="true">📄</span><div class="crf-name"><b>PDF</b><small>' + (c.caseFileRead && c.caseFileRead.pages ? Number(c.caseFileRead.pages) + ' pages · ' : '') + mb(f.size) + ' · from the intern</small></div><button type="button" class="crf-open" data-a="open">Open</button></div>'
            + flagHtml(c, c.caseFileRead) + statusHtml(c.caseFileRead) + (wide && c.caseFileRead && c.caseFileRead.status === 'done' ? compareHtml(c.caseFileRead) : '');
    }

    async function getUrl() {
        if (!url) url = await adminApp.storage().ref(current.caseFile.path).getDownloadURL();
        return url;
    }
    async function removeFile(id, path) {
        await adminApp.storage().ref(path).delete().catch(e => { if (e && e.code !== 'storage/object-not-found') throw e; });
        await db.collection('cases').doc(id).update({ caseFile: FV().delete(), caseFileRead: FV().delete() });
    }
    async function act(a) {
        const c = current; if (!c) return;
        if (a === 'open') window.open(await getUrl(), '_blank', 'noopener');
        else if (a === 'compare') { if (!wide) await getUrl(); wide = !wide; render(); }
        else if (a === 'retry') {
            c.caseFileRead = { status: 'reading', at: { toMillis: () => Date.now() } }; render();
            adminApp.functions().httpsCallable('readCaseFile')({ caseDocId: c.id, retry: true }).catch(e => console.warn('readCaseFile', e));
        } else if (a === 'clear') await db.collection('cases').doc(c.id).update({ 'caseFileRead.identifiersCleared': true });
        else if (a === 'delete') {
            if (!confirm('Delete this PDF? The case and its score stay.')) return;
            await removeFile(c.id, c.caseFile.path);
            c.caseFile = null; render();
            if (typeof showToast === 'function') showToast('File deleted', 'success');
        }
    }

    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('#case-file-box [data-a]');
        if (!b) return;
        act(b.dataset.a).catch(err => { console.warn('caseFile', err); if (typeof showToast === 'function') showToast('Could not finish: ' + err.message, 'error'); });
    });

    window.caseFileReview = {
        start(caseItem) {
            this.stop();
            if (!caseItem || !caseItem.id) return;
            current = { id: caseItem.id, caseFile: caseItem.caseFile || null, caseFileRead: caseItem.caseFileRead || null };
            render();
            if (!current.caseFile) return;
            stop = db.collection('cases').doc(caseItem.id).onSnapshot(s => {
                if (!current || current.id !== caseItem.id) return;
                const d = s.data() || {};
                current.caseFile = d.caseFile || null; current.caseFileRead = d.caseFileRead || null;
                render();
            }, e => console.warn('caseFile watch', e));
        },
        stop() {
            if (stop) stop();
            stop = null; current = null; wide = false; url = '';
            render();
        },
        // after a review or a delete: the file must not outlive it. A failure never blocks the admin's save; it stays listed on the case.
        async purge(caseItem, caseDeleted) {
            const path = caseItem && caseItem.caseFile && caseItem.caseFile.path;
            if (!path) return;
            try {
                if (caseDeleted) await adminApp.storage().ref(path).delete();
                else await removeFile(caseItem.id, path);
            } catch (e) { console.warn('caseFile purge', e); }
        }
    };
})();
