// Jev's check of the saved quiz, in the editor's whole-quiz tools: explanation vs marked answer, translation vs source. It only points; nothing is changed.
(function () {
    const LANG = { th: 'Thai', ko: 'Korean', ja: 'Japanese', zh: 'Chinese' };
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let box;
    function label(f) {
        if (f.kind === 'key') return f.verdict === 'bad' ? 'Explanation points away from the marked answer' : 'Explanation only partly supports the marked answer';
        if (f.kind === 'stale') return LANG[f.lang] + ' translation is older than this question';
        return LANG[f.lang] + (f.verdict === 'bad' ? ' translation differs' : ' translation may differ');
    }
    function row(f) {
        const where = f.q == null ? 'Quiz' : 'Q' + (f.q + 1), go = f.q == null ? '' : `<button type="button" class="jqc-go" data-q="${f.q}">Open</button>`;
        return `<li class="jqc-${esc(f.verdict)}"><b>${where}</b><span>${esc(label(f))}${f.score != null ? ` <small>${Number(f.score).toFixed(2)}</small>` : ''}</span>${go}</li>`;
    }
    function open(html) {
        if (!box) { box = document.createElement('dialog'); box.id = 'jqc-box'; box.className = 'lang-no-toggle'; document.body.append(box); }
        box.innerHTML = `<div class="jqc-h"><span>${window.jevMarkHtml ? window.jevMarkHtml(20) : ''} Jev check</span><button type="button" class="jqc-x" aria-label="Close">×</button></div>${html}`;
        box.querySelector('.jqc-x').onclick = () => box.close();
        box.querySelectorAll('.jqc-go').forEach(b => { b.onclick = () => { box.close(); window.jevQuizCheck.goTo(Number(b.dataset.q)); }; });
        if (!box.open) box.showModal();
    }
    window.jevQuizCheck = {
        goTo(i) { quizQPageIndex = i; updateQuizPagination(); },
        async run(btn) {
            const quizId = document.getElementById('edit-quiz-id').value;
            if (!quizId) return open('<p class="jqc-n">Save the quiz first. Jev reads the saved version.</p>');
            btn.disabled = true;
            open('<p class="jqc-n" role="status">Jev is reading this quiz…</p>');
            try {
                const r = (await adminApp.functions().httpsCallable('jevCheckQuiz')({ quizId })).data || {};
                if (r.enabled === false) return open('<p class="jqc-n">Jev is switched off.</p>');
                const list = r.flags || [];
                const sum = `${r.checked} checks on ${r.questions} questions` + (r.noExplanation ? ` · ${r.noExplanation} without an explanation` : '') + (r.errors ? ` · ${r.errors} could not be checked` : '');
                open((list.length ? `<ul class="jqc-list">${list.map(row).join('')}</ul>` : '<p class="jqc-ok">✓ Nothing to look at</p>')
                    + `<p class="jqc-n">${esc(sum)}. Jev reads the saved version and changes nothing. Check the book before you edit.</p>`);
            } catch (e) {
                console.warn('jevCheckQuiz', e && e.message);
                open('<p class="jqc-n">Could not reach Jev. Please try again.</p>');
            } finally { btn.disabled = false; }
        }
    };
})();
