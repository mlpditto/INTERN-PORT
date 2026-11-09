// Jev's check of the questions on screen, saved or not, from the Review tabs: explanation vs marked answer, translation vs source. It only points; nothing is changed.
(function () {
    const LANG = { th: 'Thai', ko: 'Korean', ja: 'Japanese', zh: 'Chinese' };
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let box, repeatsShown = [];
    function label(f) {
        if (f.kind === 'key') return f.verdict === 'bad' ? 'Explanation points away from the marked answer' : 'Explanation only partly supports the marked answer';
        if (f.kind === 'stale') return LANG[f.lang] + ' translation is older than this question';
        return LANG[f.lang] + (f.verdict === 'bad' ? ' translation differs' : ' translation may differ');
    }
    function repeat(r, i) {
        return `<li class="jqc-${r.score >= 0.8 ? 'bad' : 'look'}"><b>Q${r.q + 1}</b><span>Same fact as <b>${esc(r.title)}</b> Q${r.otherQ + 1} <small>${Number(r.score).toFixed(2)}</small></span><button type="button" class="jqc-cmp" data-i="${i}" aria-expanded="false">Compare</button></li><li class="jqc-pair" data-i="${i}" hidden><p>${esc(r.stem)}</p><p>${esc(r.otherStem)}</p></li>`;
    }
    // V102.590 (owner): Compare = the two questions in full, side by side (stem · options with the ✓ answer · explanation).
    // This quiz = what is on screen (getQuizFormData); the other quiz is read from Firestore, read-only. 🗑 only on this quiz's side (owner's pick):
    // it removes the question from the editor like the Scorecard delete — nothing is saved until Save Quiz.
    function full(q, head, del) {
        if (!q) return `<div class="jqc-col"><h4>${head}</h4><p class="jqc-n">Could not load this question.</p></div>`;
        const ok = new Set([].concat(q.correct == null ? [] : q.correct).map(Number));
        const opts = (q.options || []).map((o, k) => `<li class="${ok.has(k) ? 'ok' : ''}"><b>${String.fromCharCode(65 + k)}</b><span>${esc(o)}</span>${ok.has(k) ? '<i aria-label="answer">✓</i>' : ''}</li>`).join('');
        return `<div class="jqc-col"><h4>${head}</h4><p class="jqc-stem">${esc(q.q || '')}</p>${opts ? `<ol class="jqc-opts">${opts}</ol>` : ''}${q.explanation ? `<p class="jqc-exp">💡 ${esc(q.explanation)}</p>` : ''}${del || ''}</div>`;
    }
    async function sideBySide(li, r) {
        const mine = (getQuizFormData().questions || [])[r.q];
        const del = `<div class="jqc-del"><button type="button" class="jqc-del-b" title="Remove Q${r.q + 1} from this quiz — saved when you press Save Quiz" aria-label="Delete Q${r.q + 1} from this quiz">🗑 Delete Q${r.q + 1}</button></div>`;
        li.innerHTML = `<div class="jqc-sbs">${full(mine, `This quiz · Q${r.q + 1}`, del)}<div class="jqc-col"><h4>${esc(r.title)} · Q${r.otherQ + 1}</h4><p class="jqc-n">Loading…</p></div></div>`;
        let other = null;
        try { const d = await db.collection('quizzes').doc(r.quizId).get(); other = ((d.exists && d.data().questions) || [])[r.otherQ] || null; } catch (e) { console.warn('jev compare', e && e.message); }
        li.querySelector('.jqc-col:last-child').outerHTML = other ? full(other, `${esc(r.title)} · Q${r.otherQ + 1}`) : `<div class="jqc-col"><h4>${esc(r.title)} · Q${r.otherQ + 1}</h4><p class="jqc-stem">${esc(r.otherStem || '')}</p><p class="jqc-n">Could not load the full question.</p></div>`;
        const wrap = li.querySelector('.jqc-del');
        const idle = () => { wrap.classList.remove('asking'); wrap.innerHTML = del.replace(/^<div class="jqc-del">|<\/div>$/g, ''); wrap.querySelector('.jqc-del-b').onclick = ask; };
        const ask = () => {
            const stem = String((mine && mine.q) || '').trim(), quote = stem.length > 70 ? stem.slice(0, 70) + '…' : stem;
            wrap.classList.add('asking');
            wrap.innerHTML = `<span>Delete Q${r.q + 1} “${esc(quote)}” from this quiz? It is saved when you press Save Quiz.</span><button type="button" class="jqc-del-no">Cancel</button><button type="button" class="jqc-del-yes">🗑 Delete</button>`;
            wrap.querySelector('.jqc-del-no').onclick = () => { idle(); wrap.querySelector('.jqc-del-b').focus(); };
            wrap.querySelector('.jqc-del-yes').onclick = () => remove(r.q);
            wrap.querySelector('.jqc-del-no').focus();
        };
        if (wrap) wrap.querySelector('.jqc-del-b').onclick = ask;
    }
    function remove(i) {
        const items = document.querySelectorAll('.quiz-q-item');
        if (items.length <= 1) { if (window.showToast) showToast('A quiz needs at least 1 question.'); return; }
        const item = items[i]; if (!item) return;
        item.remove();
        box.close();
        if (window.closeQuizReview) closeQuizReview();   // the open Scorecard numbered the old list
        if (typeof updateQuizPagination === 'function') updateQuizPagination();
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
        if (window.showToast) showToast(`🗑️ Q${i + 1} removed — press Save Quiz to keep it`);
    }
    // V102.619 (owner pick C): one matrix instead of one row per question × language — questions down, 💡 + each language across.
    // ✓ ok · ≠ differs · ≈ may differ · 🕒 translation older than the question · – not checked. Tap Qn = open that question.
    const ORDER = ['th', 'ko', 'ja', 'zh'];
    function matrix(r, qs) {
        const flags = r.flags || [], n = Math.max(Number(r.questions) || 0, qs.length);
        const langs = [...new Set([...(Array.isArray(r.langs) ? r.langs : []), ...flags.filter(f => f.lang).map(f => f.lang)])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
        const skip = new Set(r.unchecked || []);
        const hasOpts = i => ((qs[i] || {}).options || []).some(o => String(o == null ? '' : o).trim());
        const marked = i => [].concat((qs[i] || {}).correct == null ? [] : qs[i].correct).length > 0;
        const tip = f => esc(label(f) + (f.score != null ? ' · ' + Number(f.score).toFixed(2) : ''));
        const flagCell = f => f.kind === 'stale' ? `<td class="jqc-old" title="${tip(f)}">🕒</td>` : `<td class="jqc-${f.verdict === 'bad' ? 'diff' : 'may'}" title="${tip(f)}">${f.verdict === 'bad' ? '≠' : '≈'}</td>`;
        const none = t => `<td class="jqc-na" title="${t}">–</td>`, ok = '<td class="jqc-y">✓</td>';
        const rows = Array.from({ length: n }, (_, i) => {
            const key = flags.find(f => f.kind === 'key' && f.q === i);
            const c0 = key ? flagCell(key) : skip.has(i) ? none('No explanation, not checked') : hasOpts(i) && marked(i) ? ok : none('Not a choice question');
            const cs = langs.map(l => { const f = flags.find(x => x.lang === l && (x.q === i || (x.q == null && x.kind === 'stale'))); return f ? flagCell(f) : hasOpts(i) ? ok : none('Not a choice question'); });
            return `<tr><th scope="row"><button type="button" class="jqc-go" data-q="${i}">Q${i + 1}</button></th>${c0}${cs.join('')}</tr>`;
        }).join('');
        return `<table class="jqc-m"><thead><tr><th></th><th title="Explanation vs marked answer">💡</th>${langs.map(l => `<th title="${LANG[l]}">${l.toUpperCase()}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
            + '<p class="jqc-key">✓ ok · ≠ differs · ≈ may differ · 🕒 older · – not checked</p>';
    }
    function open(html) {
        if (!box) { box = document.createElement('dialog'); box.id = 'jqc-box'; box.className = 'lang-no-toggle'; document.body.append(box); }
        box.innerHTML = `<div class="jqc-h"><span>${window.jevMarkHtml ? window.jevMarkHtml(20) : ''} Jev check</span><button type="button" class="jqc-x" aria-label="Close">×</button></div>${html}`;
        box.querySelector('.jqc-x').onclick = () => box.close();
        box.querySelectorAll('.jqc-go').forEach(b => { b.onclick = () => { box.close(); window.jevQuizCheck.goTo(Number(b.dataset.q)); }; });
        box.querySelectorAll('.jqc-cmp').forEach(b => { b.onclick = () => { const p = box.querySelector(`.jqc-pair[data-i="${b.dataset.i}"]`); p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); box.classList.toggle('jqc-wide', !!box.querySelector('.jqc-pair:not([hidden])')); if (!p.hidden && !p.dataset.full) { p.dataset.full = '1'; sideBySide(p, repeatsShown[b.dataset.i]); } }; });
        if (!box.open) box.showModal();
    }
    // V102.590 (owner): reading is shown INLINE — the J tab turns into a small pill with a running timer (J 00:07), like the Review button
    // while it runs; no dialog until there is something to read. Looked up by id each second, so a toolbar redraw keeps the timer.
    let tick = null;
    function busy(on) {
        clearInterval(tick); tick = null;
        const tab = () => document.getElementById('jev-quiz-check');
        if (!on) { const b = tab(); if (b) { b.classList.remove('jqc-busy'); b.removeAttribute('data-t'); b.removeAttribute('aria-busy'); b.setAttribute('aria-label', 'Jev check'); } return; }
        const t0 = Date.now();
        const paint = () => {
            const b = tab(); if (!b) return;
            const s = Math.floor((Date.now() - t0) / 1000), t = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
            b.classList.add('jqc-busy'); b.dataset.t = t; b.setAttribute('aria-busy', 'true'); b.setAttribute('aria-label', 'Jev is reading this quiz · ' + t);
        };
        paint(); tick = setInterval(paint, 1000);
    }
    window.jevQuizCheck = {
        goTo(i) { if (window.closeQuizReview) closeQuizReview(); quizQPageIndex = i; updateQuizPagination(); },
        async run(btn) {
            const quizId = document.getElementById('edit-quiz-id').value;   // V102.619 (owner): '' = never saved — Jev still checks 💡; translations wait for Save
            const questions = getQuizFormData().questions.map(({ q, content, type, options, correct, explanation }) => ({ q, content, type, options, correct, explanation }));   // V102.557: what the admin sees, not what was last saved
            btn.disabled = true;
            busy(true);
            try {
                const r = (await adminApp.functions().httpsCallable('jevCheckQuiz')({ quizId, questions })).data || {};
                if (r.enabled === false) return open('<p class="jqc-n">Jev is switched off.</p>');
                const list = r.flags || [];
                const repeats = repeatsShown = r.repeats || [], unchecked = r.unchecked || [], scored = list.filter(f => f.score != null).length, ok = Math.max(0, r.checked - scored);
                const pills = `<div class="jqc-p"><i class="g">${ok} OK</i>${unchecked.length ? `<i class="a">${unchecked.length} not checked</i>` : ''}${repeats.length ? `<i class="r">${repeats.length} repeat${repeats.length > 1 ? 's' : ''}</i>` : ''}${quizId ? '' : '<i class="a" title="Translations are checked once the quiz is saved">🌐 after Save</i>'}</div>`;
                const clean = !list.length && !repeats.length && !unchecked.length;
                const note = 'Jev reads the questions on screen and changes nothing. Check the book before you edit.' + (r.errors ? ` ${r.errors} could not be checked.` : '') + (r.repeatsFailed ? ' The check against other quizzes did not run.' : r.compared ? ` Compared ${r.compared} likely pairs in other quizzes.` : '');
                open(pills + (clean ? '<p class="jqc-ok">✓ Nothing to look at</p>' : '')
                    + (list.length || unchecked.length ? matrix(r, questions) : '')
                    + (repeats.length ? `<ul class="jqc-list">${repeats.map(repeat).join('')}</ul>` : '')
                    + `<p class="jqc-n">${esc(note)}</p>`);
            } catch (e) {
                console.warn('jevCheckQuiz', e && e.message);
                // until the V102.619 function is deployed, a never-saved quiz is refused up front (no AI call, nothing spent)
                if (!quizId && /invalid-argument/.test(String(e && e.code))) return open('<p class="jqc-n">Save the quiz first. Jev needs its translations.</p>');
                open('<p class="jqc-n">Could not reach Jev. Please try again.</p>');
            } finally { busy(false); btn.disabled = false; }
        }
    };
})();
