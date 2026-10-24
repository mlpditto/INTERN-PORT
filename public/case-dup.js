// Admin ▸ Alabasta ▸ New Cases: a Case an intern sent twice. The newer card gets a chip "⚠️ maybe a duplicate of 26956 · 1 hr earlier"; a tap opens the
// original beside two buttons — "ยุบ (ซ้ำ)" folds the new one away (kept, never deleted, no points, an Undo toast; reopening it also clears the mark) and
// "ไม่ซ้ำ" dismisses the chip. Same HN with a very different note is a follow-up, not a duplicate: a quiet grey chip, no buttons.
// Rule: same intern + same HN + the earlier case no more than 7 days older + notes ≥ 90% alike (bigram Dice). Never automatic.
(function () {
    const DAY = 86400000, WINDOW = 7 * DAY, FOLLOW_WINDOW = 30 * DAY, SAME = 0.9;
    const ms = (t) => (t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));
    const normHn = (s) => String(s == null ? '' : s).trim().toLowerCase();
    const normNote = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s​]+/g, ' ').replace(/[^\p{L}\p{M}\p{N} ]/gu, '').trim();
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));
    const dismissKey = (id) => 'caseDupNo:' + id;
    const open = new Set();
    const cases = () => window.casesData || (typeof casesData !== 'undefined' ? casesData : []);

    function bigrams(s) { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
    function similarity(a, b) {
        a = normNote(a); b = normNote(b);
        if (!a || !b) return 0;
        if (a === b) return 1;
        const A = bigrams(a), B = bigrams(b); let hit = 0, na = 0, nb = 0;
        A.forEach((n, g) => { na += n; hit += Math.min(n, B.get(g) || 0); }); B.forEach(n => { nb += n; });
        return na + nb ? (2 * hit) / (na + nb) : 0;
    }

    // → { kind: 'dup' | 'follow', orig, sim } for a pending case c, looking back through `all` (any status); null when nothing earlier fits
    function find(c, all) {
        if (!c || !normHn(c.caseId) || !c.userId) return null;
        const t = ms(c.timestamp);
        let best = null;
        (all || []).forEach(o => {
            if (!o || o.id === c.id || o.userId !== c.userId || normHn(o.caseId) !== normHn(c.caseId) || o.duplicateOf || o.status === 'rejected') return;
            const ot = ms(o.timestamp);
            if (!ot || !t || ot >= t || t - ot > FOLLOW_WINDOW) return;
            const sim = similarity(c.note, o.note);
            const kind = sim >= SAME && t - ot <= WINDOW ? 'dup' : 'follow';
            if (!best || (kind === 'dup' && best.kind !== 'dup') || (kind === best.kind && ot > ms(best.orig.timestamp))) best = { kind, orig: o, sim };
        });
        return best;
    }

    const ago = (t) => (typeof alabastaAgo === 'function' ? alabastaAgo(t) : '');
    function statusOf(o) {
        if (o.isArchived || o.status === 'reviewed') { const b = parseFloat(o.adminBonus) || 0; return 'reviewed' + (b > 0 ? ' +' + b.toFixed(2) : ''); }
        return 'waiting';
    }
    function html(c) {
        let hit = null;
        try { hit = find(c, cases()); } catch (_) { hit = null; }
        if (!hit) return '';
        if (hit.kind === 'follow') return `<span class="cdup-chip soft" title="Same HN as ${esc(hit.orig.caseId)}, different note — a follow-up, not a duplicate · HN เดียวกัน อาการต่างกัน">↺ HN ${esc(hit.orig.caseId)} · follow-up?</span>`;
        let dismissed = false; try { dismissed = localStorage.getItem(dismissKey(c.id)) === '1'; } catch (_) { /* private mode */ }
        if (dismissed) return '';
        const chip = `<button type="button" class="cdup-chip" onclick="caseDup.toggle('${esc(c.id)}')" aria-expanded="${open.has(c.id)}" title="Looks like the case sent earlier · อาจซ้ำกับเคสก่อนหน้า">⚠️ maybe a duplicate · ${esc(hit.orig.caseId)} · ${esc(ago(hit.orig.timestamp))} earlier <i>${open.has(c.id) ? '‹' : '›'}</i></button>`;
        if (!open.has(c.id)) return chip;
        const note = String(hit.orig.note || '').replace(/\s+/g, ' ').slice(0, 70);
        return chip + `<div class="cdup-panel"><div class="cdup-orig"><b>Earlier</b> · ${esc(ago(hit.orig.timestamp))} · ${esc(hit.orig.caseId)} · ${esc(statusOf(hit.orig))}<br><span>${esc(note)}${String(hit.orig.note || '').length > 70 ? '…' : ''}</span><em>${Math.round(hit.sim * 100)}% same note · same intern · same HN</em></div>`
            + `<div class="cdup-act"><button type="button" class="cdup-yes" onclick="caseDup.fold('${esc(c.id)}', '${esc(hit.orig.id)}')">ยุบ (ซ้ำ)</button><button type="button" class="cdup-no" onclick="caseDup.dismiss('${esc(c.id)}')">ไม่ซ้ำ</button></div></div>`;
    }

    function repaint() { if (typeof renderAlabastaInbox === 'function') renderAlabastaInbox(); }
    function toast(msg, undoId) {
        if (typeof showToast === 'function') showToast(msg);
        const x = document.getElementById('toast'); if (!x || !undoId) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-undo'; b.textContent = '↩ Undo';
        b.onclick = () => { x.classList.remove('show'); undo(undoId); };
        x.insertBefore(b, x.querySelector('.toast-close'));
        clearTimeout(toast._t); toast._t = setTimeout(() => x.classList.remove('show'), 10000);
    }

    // folded = reviewed with 0 points + duplicateOf; the intern's submissions mirror follows (the same pair the Review button writes)
    async function fold(id, origId) {
        try {
            const ts = firebase.firestore.FieldValue.serverTimestamp(), batch = db.batch(), ref = db.collection('cases').doc(id);
            batch.update(ref, { status: 'reviewed', isArchived: true, archivedAt: ts, reviewedAt: ts, adminBonus: 0, adminUpdatedAt: ts, adminReviewedBy: (typeof ALLOWED_EMAIL !== 'undefined' && ALLOWED_EMAIL) || 'admin', duplicateOf: origId, duplicateMarkedAt: ts });
            if (typeof stageSubmissionMirror === 'function') await stageSubmissionMirror(batch, id, typeof submissionReviewedFields === 'function' ? submissionReviewedFields(0) : { status: 'reviewed', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
            await batch.commit();
            open.delete(id);
            toast('⤵ Folded into ' + ((cases().find(c => c.id === origId)) || {}).caseId + ' — kept, no points', id);
        } catch (e) { console.error('[case-dup] fold failed', e); if (typeof showToast === 'function') showToast('Could not fold: ' + (e && e.message ? e.message : 'error')); }
    }
    async function undo(id) {
        try {
            const D = firebase.firestore.FieldValue, batch = db.batch();
            batch.update(db.collection('cases').doc(id), { status: 'pending', isArchived: false, adminBonus: 0, adminUpdatedAt: D.serverTimestamp(), duplicateOf: D.delete(), duplicateMarkedAt: D.delete() });
            if (typeof stageSubmissionMirror === 'function') await stageSubmissionMirror(batch, id, { status: 'pending', score: 0, adminBonus: 0, pointsAwarded: false, pointsAmount: 0 });
            await batch.commit();
            if (typeof showToast === 'function') showToast('↩ Back in the queue');
        } catch (e) { console.error('[case-dup] undo failed', e); if (typeof showToast === 'function') showToast('Could not undo: ' + (e && e.message ? e.message : 'error')); }
    }
    function dismiss(id) { try { localStorage.setItem(dismissKey(id), '1'); } catch (_) { /* private mode */ } open.delete(id); repaint(); }
    function toggle(id) { if (open.has(id)) open.delete(id); else open.add(id); repaint(); }

    window.caseDup = { find, similarity, html, fold, undo, dismiss, toggle };
})();
