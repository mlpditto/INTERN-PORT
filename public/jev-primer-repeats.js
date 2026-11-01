// V102.563: Jev repeats in 📖 All. Jev compares the term lines of the notes on screen, unsaved edits included, and lists the same content under different terms. It only points; ✎ opens the note.
(function () {
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const go = (q, term) => `<button type="button" class="pra-tchip jpr-go" onclick="_praOpen(${q}, true)" title="Open Q${q + 1}"><b>Q${q + 1}</b> ${esc(term)}</button>`;

    function render(box, r) {
        const list = r.repeats || [];
        const note = (r.left ? ` · ${r.left} pairs not checked` : '') + (r.errors ? ` · ${r.errors} failed` : '');
        const rows = list.slice(0, 40).map(x => `<div class="jpr-row">${go(x.q, x.term)}<span>≈</span>${go(x.otherQ, x.otherTerm)}<small>${Number(x.score).toFixed(2)}</small></div>`).join('');
        box.innerHTML = `<div class="jpr-h">${list.length ? `Jev · ${list.length} to check` : 'Jev · no repeats under other terms'}<small>${r.compared || 0} pairs${esc(note)}</small></div>${rows}`;
        box.hidden = false;
    }

    async function run(btn) {
        if (btn.disabled) return;
        const box = document.getElementById('pra-jev');
        const primers = window._praRead().map(x => x.primer);
        btn.disabled = true;
        const text = btn.textContent;
        btn.textContent = 'Checking…';
        try {
            const r = (await adminApp.functions().httpsCallable('jevPrimerRepeats')({ primers })).data || {};
            if (r.enabled === false) { showToast('Jev is switched off'); return; }
            render(box, r);
        } catch (e) {
            console.warn('jevPrimerRepeats', e && e.message);
            showToast('Jev could not check: ' + (e && e.message ? e.message : 'error'));
        } finally {
            btn.disabled = false;
            btn.textContent = text;
        }
    }

    window.jevPrimerRepeats = { run };
})();
