// Admin ▸ Alabasta ▸ Cases: the two "make something from this case" buttons, icon only — 🖼️ Case Card (purple, the main one) and 📰 Article (blue).
// 📰 asks the model to condense the case into a 3–5 line teaching article (EN / TH / KO) and saves it as an Articles DRAFT (nothing is scheduled), the case
// remembers it (cases.articleId) and the Articles editor opens on it for review. Same recipe as 📰 Write article on a Disease Codex entry.
// The prompt carries only the clinical note + disease + system — never the HN, the intern's name or the patient's initials.
(function () {
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));
    const str = (v) => (v == null ? '' : String(v)).trim();

    function prompt(c) {
        return [
            'ROLE: medical educator writing a SHORT teaching article for Thai pharmacy / medical interns, condensed from the real case note below.',
            '',
            'FORMAT CONTRACT — RESPOND WITH PURE JSON ONLY. NO MARKDOWN FENCE. NO PROSE OUTSIDE JSON.',
            'Root object with EXACTLY these keys:',
            '{',
            '  "title": { "en": "<<<teaching title · English · at most 60 characters · may end with one emoji>>>", "th": "<<<the same title in Thai>>>", "ko": "<<<the same title in Korean>>>" },',
            '  "body":  { "en": "<<<3 to 5 short lines · English · markdown · one idea per line · **bold** the key term once · no heading>>>", "th": "<<<the same article in Thai · ภาษาไทย>>>", "ko": "<<<the same article in Korean · 한국어>>>" },',
            '  "emoji": "<<<one emoji for the cover that fits the problem>>>"',
            '}',
            '',
            'LANGUAGE RULE: body.en English only · body.th Thai only (drug and disease names may stay in English) · body.ko Korean only.',
            'CONTENT RULE: turn the case into a lesson — the red flag to ask about, the first-line advice, one pearl; no line longer than 25 words; no patient-identifying content at all (no names, ages with places, workplaces, HN); do not retell the case.',
            '',
            'PROBLEM: ' + (str(c.disease) || '(not stated)') + (c.diseaseSystemLabel ? ' · ' + str(c.diseaseSystemLabel) : ''),
            'CASE NOTE:',
            str(c.note).slice(0, 1500) || '(no note — write from general knowledge, conservatively)',
            '',
            'SELF-CHECK before answering: title.en ≤ 60 characters · each body has 3–5 lines · each slot in its own language · valid JSON.'
        ].join('\n');
    }

    function modelId() {
        let m = ''; try { m = localStorage.getItem('articleDraftModel') || ''; } catch (_) { /* none */ }
        return (m && window.textAIModelInfo && window.textAIModelInfo(m)) ? m : 'gpt-6-luna';   // the Articles editor's own default
    }
    const parse = (t) => { try { return typeof window.safeJsonParse === 'function' ? window.safeJsonParse(t) : JSON.parse(t); } catch (_) { return null; } };
    const openArticle = (id) => { if (window.Articles) Promise.resolve(Articles.load()).then(() => { Articles.open(); Articles.edit(id); }); };

    // the two buttons for one case (a case row / an inbox card); 📰 gets a green ring once the case has an article
    function btns(c) {
        const id = esc(c.id), done = !!c.articleId;
        return `<button type="button" class="btn-sm alabasta-action-btn is-case-card" onclick="openAlabastaCaseCard('${id}')" title="Case card" aria-label="Case card"><span class="alabasta-emoji">🖼️</span></button>`
            + `<button type="button" class="btn-sm alabasta-action-btn is-case-article${done ? ' is-done' : ''}" onclick="writeArticleFromCase('${id}', this)" title="${done ? 'Article — open / write another' : 'Article from this case'}" aria-label="Article from this case"><span class="alabasta-emoji">📰</span></button>`;
    }

    async function write(id, btn) {
        const c = typeof getAlabastaCaseById === 'function' ? getAlabastaCaseById(id) : null;
        if (!c) return;
        if (typeof window.callUniversalAI !== 'function') { if (typeof showToast === 'function') showToast('AI core not loaded yet — try again in a moment.'); return; }
        if (!str(c.note)) { if (typeof showToast === 'function') showToast('📰 This case has no note to write from.'); return; }
        if (c.articleId) { if (!confirm('This case already has an article (“' + (c.articleTitle || '') + '”). Write another one?\n\nCancel opens the existing article.')) { openArticle(c.articleId); return; } }
        else if (!confirm('Write a short teaching article from this case with AI?\n\nOnly the clinical note is sent — no HN or names. It is saved as a DRAFT in Articles (nothing is scheduled) and opens for review.')) return;
        const model = modelId(), old = btn ? btn.innerHTML : '';
        try {
            if (btn) { btn.disabled = true; btn.innerHTML = '⏳'; }
            const ask = async () => { const r = await window.callUniversalAI(model, prompt(c), true, null, '', { feature: 'case_article' }); return [r, parse((r && r.text) ? r.text : (typeof r === 'string' ? r : ''))]; };
            const ok = x => x && x.title && x.body && typeof x.title === 'object' && typeof x.body === 'object';
            let [resp, parsed] = await ask();
            if (!ok(parsed)) { [resp, parsed] = await ask(); if (!ok(parsed)) throw new Error('AI returned invalid JSON after retry.'); }
            const title = { en: str(parsed.title.en) || str(c.disease) || 'Case lesson', th: str(parsed.title.th), ko: str(parsed.title.ko) };
            const body = { en: str(parsed.body.en), th: str(parsed.body.th), ko: str(parsed.body.ko) };
            if (!body.en && !body.th) throw new Error('AI returned an empty article.');
            Object.keys(title).forEach(k => { if (!title[k]) delete title[k]; }); Object.keys(body).forEach(k => { if (!body[k]) delete body[k]; });
            const user = (window.adminApp && window.adminApp.auth && window.adminApp.auth().currentUser) || (typeof auth !== 'undefined' && auth && auth.currentUser) || null;
            const email = (user && user.email) || 'admin';
            const win = (window.Articles && typeof Articles._defaultWindow === 'function') ? Articles._defaultWindow(Date.now()) : { start: Date.now() + 864e5, end: Date.now() + 7 * 864e5 };
            const ts = firebase.firestore.FieldValue.serverTimestamp();
            const doc = {
                title, body, cover: { emoji: str(parsed.emoji) || '🩺' }, status: 'draft',
                startAt: new Date(win.start), endAt: new Date(win.end), audience: { divisions: [], groups: [] }, rerun: 'any',
                readMin: Math.max(1, Math.round(String(body.en || body.th || '').length / 700)), links: [],
                aiDrafted: true, aiDraftedModel: (resp && resp.model) || model, caseSource: 'cases/' + id,
                createdAt: ts, updatedAt: ts, createdBy: email, updatedBy: email
            };
            const ref = await db.collection('articles').add(doc);
            await db.collection('cases').doc(id).update({ articleId: ref.id, articleTitle: title.en || str(c.disease) });
            c.articleId = ref.id; c.articleTitle = title.en || str(c.disease);
            if (typeof showToast === 'function') showToast('📰 Draft article “' + c.articleTitle + '” — review it in Articles, then schedule');
            openArticle(ref.id);
        } catch (e) {
            if (typeof showToast === 'function') showToast('📰 ' + ((e && e.message) || 'Could not write the article'));
        } finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
    }

    window.writeArticleFromCase = write;
    window.caseArticle = { btns, prompt, write };
})();
