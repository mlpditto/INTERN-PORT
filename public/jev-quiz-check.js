// Jev's check of the questions on screen, saved or not, from the Review tabs: explanation vs marked answer, translation vs source. It only points; nothing is changed.
(function () {
    const LANG = { th: 'Thai', ko: 'Korean', ja: 'Japanese', zh: 'Chinese' };
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let box;
    function label(f) {
        if (f.kind === 'key') return f.verdict === 'bad' ? 'Explanation points away from the marked answer' : 'Explanation only partly supports the marked answer';
        if (f.kind === 'stale') return LANG[f.lang] + ' translation is older than this question';
        return LANG[f.lang] + (f.verdict === 'bad' ? ' translation differs' : ' translation may differ');
    }
    function chips(list) {
        return `<div class="jqc-qs">${list.map(q => `<button type="button" class="jqc-go" data-q="${q}">Q${q + 1}</button>`).join('')}</div>`;
    }
    function repeat(r, i) {
        return `<li class="jqc-${r.score >= 0.8 ? 'bad' : 'look'}"><b>Q${r.q + 1}</b><span>Same fact as <b>${esc(r.title)}</b> Q${r.otherQ + 1} <small>${Number(r.score).toFixed(2)}</small></span><button type="button" class="jqc-cmp" data-i="${i}" aria-expanded="false">Compare</button></li><li class="jqc-pair" data-i="${i}" hidden><p>${esc(r.stem)}</p><p>${esc(r.otherStem)}</p></li>`;
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
        box.querySelectorAll('.jqc-cmp').forEach(b => { b.onclick = () => { const p = box.querySelector(`.jqc-pair[data-i="${b.dataset.i}"]`); p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); }; });
        if (!box.open) box.showModal();
    }
    window.jevQuizCheck = {
        goTo(i) { if (window.closeQuizReview) closeQuizReview(); quizQPageIndex = i; updateQuizPagination(); },
        async run(btn) {
            const quizId = document.getElementById('edit-quiz-id').value;
            if (!quizId) return open('<p class="jqc-n">Save the quiz first. Jev needs its translations.</p>');
            const questions = getQuizFormData().questions.map(({ q, content, type, options, correct, explanation }) => ({ q, content, type, options, correct, explanation }));   // V102.557: what the admin sees, not what was last saved
            btn.disabled = true;
            open('<p class="jqc-n" role="status">Jev is reading this quiz…</p>');
            try {
                const r = (await adminApp.functions().httpsCallable('jevCheckQuiz')({ quizId, questions })).data || {};
                if (r.enabled === false) return open('<p class="jqc-n">Jev is switched off.</p>');
                const list = r.flags || [];
                const repeats = r.repeats || [], unchecked = r.unchecked || [], scored = list.filter(f => f.score != null).length, ok = Math.max(0, r.checked - scored);
                const pills = `<div class="jqc-p"><i class="g">${ok} OK</i>${unchecked.length ? `<i class="a">${unchecked.length} not checked</i>` : ''}${repeats.length ? `<i class="r">${repeats.length} repeat${repeats.length > 1 ? 's' : ''}</i>` : ''}</div>`;
                const clean = !list.length && !repeats.length && !unchecked.length;
                const note = 'Jev reads the questions on screen and changes nothing. Check the book before you edit.' + (r.errors ? ` ${r.errors} could not be checked.` : '') + (r.repeatsFailed ? ' The check against other quizzes did not run.' : r.compared ? ` Compared ${r.compared} likely pairs in other quizzes.` : '');
                open(pills + (clean ? '<p class="jqc-ok">✓ Nothing to look at</p>' : '')
                    + (repeats.length || list.length ? `<ul class="jqc-list">${repeats.map(repeat).join('')}${list.map(row).join('')}</ul>` : '')
                    + (unchecked.length ? `<p class="jqc-u">No explanation, not checked</p>${chips(unchecked)}` : '')
                    + `<p class="jqc-n">${esc(note)}</p>`);
            } catch (e) {
                console.warn('jevCheckQuiz', e && e.message);
                open('<p class="jqc-n">Could not reach Jev. Please try again.</p>');
            } finally { btn.disabled = false; }
        }
    };
})();
