document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('dashboard-work');
    if (!host) return;
    const section = document.createElement('details');
    section.className = 'lr-admin lang-no-toggle';
    section.innerHTML = '<summary>💬 Journal feedback</summary><div></div><p role="status"></p>';
    host.prepend(section);
    const list = section.querySelector('div'), status = section.querySelector('p');
    let unsubscribe, unsubCopies, snapDocs = [], copies = {};
    const drafts = {};   // V102.526: a reply being typed survives the re-render a snapshot causes
    const when = ts => ts?.toDate?.().toLocaleString() || '';
    function paint() {
        section.classList.toggle('queue-empty', !snapDocs.some(doc => !doc.data().read));
        const open = new Set([...list.querySelectorAll('details[open]')].map(d => d.dataset.id));
        list.replaceChildren();
        snapDocs.slice().sort((a, b) => (b.data().timestamp?.toMillis?.() || 0) - (a.data().timestamp?.toMillis?.() || 0)).forEach(doc => {
            const data = doc.data(), row = document.createElement('details');
            row.className = 'lr-request'; row.dataset.id = doc.id; row.open = open.has(doc.id);
            const copy = copies[doc.id], replied = !!(copy && copy.status === 'answered' && copy.reply);
            const summary = document.createElement('summary');
            summary.textContent = (replied ? '↩ Replied' : data.read ? '✅ Read' : '💬 New') + ' · ' + (data.userName || data.userId);
            row.append(summary);
            const message = document.createElement('p'); message.style.whiteSpace = 'pre-wrap'; message.textContent = data.message; row.append(message);
            if (data.attachment) {
                const attachment = document.createElement('details');
                const label = document.createElement('summary'); label.textContent = '📎 Daily Canvas · ' + (data.attachment.mood || '') + ' ' + (data.attachment.moodSecondary || '');
                const content = document.createElement('p'); content.style.whiteSpace = 'pre-wrap'; content.textContent = data.attachment.content;
                attachment.append(label, content); row.append(attachment);
            }
            const date = document.createElement('small'); date.textContent = when(data.timestamp); row.append(date);
            // V102.526: ↩ Reply — written to the intern's own copy (intern_messages/{same id}); the intern reads it in History under the message.
            // A copy that does not exist yet (a message sent before V101.247) is backfilled from this doc in the same set (merge).
            const box = document.createElement('div'); box.className = 'jf-reply'; box.style.cssText = 'margin-top:8px; display:grid; gap:6px;';
            if (replied) {
                const have = document.createElement('p'); have.className = 'jf-have'; have.style.cssText = 'margin:0; padding:8px 10px; border-left:3px solid #86efac; background:#f0fdf4; border-radius:0 8px 8px 0; white-space:pre-wrap;';
                have.textContent = '↩ ' + copy.reply;
                const at = document.createElement('small'); at.style.cssText = 'display:block; color:#64748b; margin-top:4px;'; at.textContent = when(copy.repliedAt) + (copy.repliedBy ? ' · ' + copy.repliedBy : ''); have.append(at);
                box.append(have);
            }
            const ta = document.createElement('textarea'); ta.rows = 2; ta.maxLength = 2000; ta.style.minHeight = '56px';
            ta.placeholder = replied ? 'Edit the reply — the intern sees the new text' : 'Reply to the intern — shows in their History under this message (**bold** = highlighted)';
            ta.setAttribute('aria-label', 'Reply to ' + (data.userName || 'the intern'));
            ta.value = drafts[doc.id] || ''; ta.oninput = () => { drafts[doc.id] = ta.value; };
            const acts = document.createElement('div'); acts.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;';
            const go = document.createElement('button'); go.type = 'button'; go.className = 'jf-send'; go.textContent = replied ? '↩ Update reply' : '↩ Reply';
            go.onclick = async () => {
                const text = ta.value.trim();
                if (!text) { status.textContent = 'Write a reply first.'; ta.focus(); return; }
                go.disabled = true; status.textContent = 'Sending reply…';
                try {
                    await db.collection('intern_messages').doc(doc.id).set({
                        authUid: data.authUid, userId: data.userId, message: data.message, attached: !!data.attachment, createdAt: data.timestamp,
                        status: 'answered', reply: text, repliedAt: firebase.firestore.FieldValue.serverTimestamp(), repliedBy: (db.app.auth().currentUser || {}).email || 'admin'
                    }, { merge: true });
                    if (!data.read) await doc.ref.update({ read: true });
                    delete drafts[doc.id]; status.textContent = 'Reply sent — the intern sees it in History.';
                } catch (e) { console.error('Journal feedback reply', e); status.textContent = 'Could not send the reply. Your text is kept — please retry.'; go.disabled = false; }
            };
            acts.append(go);
            if (!data.read) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = '✓ Mark read';
                button.onclick = async () => {
                    button.disabled = true;
                    try { await doc.ref.update({ read: true }); status.textContent = 'Marked read'; }
                    catch (e) { status.textContent = 'Could not update. Please retry.'; button.disabled = false; }
                };
                acts.append(button);
            }
            box.append(ta, acts); row.append(box);
            list.append(row);
        });
        if (!snapDocs.length) list.textContent = 'No journal feedback yet.';
    }
    function listen() {
        if (unsubscribe || !db.app.auth().currentUser) return;
        unsubscribe = db.collection('admin_notifications').where('type', '==', 'journal_feedback').onSnapshot(snap => {
            snapDocs = snap.docs; paint();
        }, () => { section.classList.remove('queue-empty'); unsubscribe = null; status.textContent = 'Could not load. Close and reopen to retry.'; });
        // V102.526: the interns' copies carry the replies — read alongside (admins read all); missing or denied = no reply shown, nothing else changes
        if (!unsubCopies) unsubCopies = db.collection('intern_messages').onSnapshot(snap => {
            copies = {}; snap.docs.forEach(d => { copies[d.id] = d.data(); }); paint();
        }, e => { console.warn('intern_messages:', e && e.message); unsubCopies = null; });
    }
    section.addEventListener('toggle', () => { if (section.open) listen(); });
    db.app.auth().onAuthStateChanged(user => {
        unsubscribe?.(); unsubscribe = null; unsubCopies?.(); unsubCopies = null; copies = {}; snapDocs = [];
        section.classList.remove('queue-empty');
        if (user) listen();
    });
});
