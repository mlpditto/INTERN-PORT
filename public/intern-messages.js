/* V101.247 — Journal ▸ Message to admin: the intern's own copy. The send writes two docs with ONE id in one batch — the admin's
   admin_notifications doc (unchanged) and intern_messages/{id} = { authUid, userId, message, attached, status:'sent', createdAt }.
   This module reads only the intern's own copies (the rule needs authUid == me in the query) and turns them into ✉️ rows in
   Work ▸ History, with the admin's reply (status 'answered' + reply / repliedAt, written by the admin) as the 💬 line.
   A message is NOT a submission: score 0, status 'sent' / 'answered' (never pending), noDelete — so points, the 🔥 streak
   (reflective logs only), the ⏳ chip, the Schedule heatmap and the admin's review queue never see it. */
window.internMessages = (() => {
    let unsub = null, docs = [], sig = '', armed = false;
    const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (typeof t === 'number' ? t : 0);
    const stamp = n => ({ toMillis: () => n, toDate: () => new Date(n), seconds: Math.floor(n / 1000) });
    const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const firstLine = m => { const l = String(m || '').replace(/\s+/g, ' ').trim(); return l.length > 70 ? l.slice(0, 67).trimEnd() + '…' : l; };

    function historyItems() {
        return docs.map(d => {
            const sent = ms(d.createdAt) || Date.now(), answered = d.status === 'answered' && String(d.reply || '').trim() !== '';
            const rep = answered ? (ms(d.repliedAt) || sent) : 0;
            // a reply moves the row up to the reply time (the sent time stays in the detail) and lights the row's "new" dot for a day
            return Object.assign({
                id: 'msg_' + d.id, submissionType: 'message', title: firstLine(d.message) || 'Message to admin', status: answered ? 'answered' : 'sent',
                score: 0, adminBonus: 0, noDelete: true, timestamp: stamp(Math.max(sent, rep)), adminComment: answered ? String(d.reply) : '',
                metadata: { message: String(d.message || ''), attached: !!d.attached, sentAt: sent, repliedAt: rep }
            }, rep ? { reviewedAt: stamp(rep) } : {});
        });
    }
    function detailHtml(s) {
        const m = s.metadata || {};
        const when = typeof formatThaiDate === 'function' ? formatThaiDate(stamp(m.sentAt), { time: true }) : new Date(m.sentAt).toLocaleString();
        return '<div class="hl-msg"><div class="hl-msg-tx">' + esc(m.message) + '</div><small class="hl-msg-mt">✉️ ' + esc(when) + (m.attached ? ' · 📎' : '') + '</small></div>';
    }
    function pillHtml(s) { return s.status === 'answered' ? '<span class="hl-pill hl-rep">↩ Replied</span>' : ''; }

    function refresh() {
        const s = JSON.stringify(docs.map(d => d.id + ':' + d.status + ':' + String(d.reply || '').length + ':' + ms(d.repliedAt)));
        if (s === sig) return;
        sig = s;
        if (typeof renderUnifiedHistory === 'function' && document.getElementById('unified-timeline')) { try { renderUnifiedHistory(); } catch (e) { /* history not ready yet */ } }
    }
    function listen() {
        if (unsub || !window.db) return;
        const ready = typeof ensureFirebaseAuthReady === 'function' ? ensureFirebaseAuthReady(10000) : Promise.resolve(window.firebase && firebase.auth && firebase.auth().currentUser);
        Promise.resolve(ready).then(u => {
            if (!u || unsub) return;
            unsub = window.db.collection('intern_messages').where('authUid', '==', u.uid).onSnapshot(snap => {
                docs = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
                refresh();
            }, e => console.warn('intern messages:', e && e.message));
        }).catch(e => console.warn('intern messages:', e && e.message));
    }
    return {
        // called from the users/{uid} snapshot in index.html — arms once (auth is ready by then)
        onUserDoc() { if (!armed) { armed = true; setTimeout(listen, 1500); } },
        historyItems, detailHtml, pillHtml
    };
})();
