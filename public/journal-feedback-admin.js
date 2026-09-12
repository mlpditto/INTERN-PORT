document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('dashboard-work');
    if (!host) return;
    const section = document.createElement('details');
    section.className = 'lr-admin lang-no-toggle';
    section.innerHTML = '<summary>💬 Journal feedback</summary><div></div><p role="status"></p>';
    host.prepend(section);
    const list = section.querySelector('div'), status = section.querySelector('p');
    let unsubscribe;
    section.addEventListener('toggle', () => {
        if (!section.open) { unsubscribe?.(); unsubscribe = null; return; }
        if (unsubscribe) return;
        unsubscribe = db.collection('admin_notifications').where('type', '==', 'journal_feedback').onSnapshot(snap => {
            const open = new Set([...list.querySelectorAll('details[open]')].map(d => d.dataset.id));
            list.replaceChildren();
            snap.docs.sort((a, b) => (b.data().timestamp?.toMillis?.() || 0) - (a.data().timestamp?.toMillis?.() || 0)).forEach(doc => {
                const data = doc.data(), row = document.createElement('details');
                row.className = 'lr-request'; row.dataset.id = doc.id; row.open = open.has(doc.id);
                const summary = document.createElement('summary');
                summary.textContent = (data.read ? '✅ Read' : '💬 New') + ' · ' + (data.userName || data.userId);
                row.append(summary);
                const message = document.createElement('p'); message.style.whiteSpace = 'pre-wrap'; message.textContent = data.message; row.append(message);
                if (data.attachment) {
                    const attachment = document.createElement('details');
                    const label = document.createElement('summary'); label.textContent = '📎 Daily Canvas · ' + (data.attachment.mood || '') + ' ' + (data.attachment.moodSecondary || '');
                    const content = document.createElement('p'); content.style.whiteSpace = 'pre-wrap'; content.textContent = data.attachment.content;
                    attachment.append(label, content); row.append(attachment);
                }
                const date = document.createElement('small'); date.textContent = data.timestamp?.toDate?.().toLocaleString() || ''; row.append(date);
                if (!data.read) {
                    const button = document.createElement('button'); button.textContent = '✓ Mark read';
                    button.onclick = async () => {
                        button.disabled = true;
                        try { await doc.ref.update({ read: true }); status.textContent = 'Marked read'; }
                        catch (e) { status.textContent = 'Could not update. Please retry.'; button.disabled = false; }
                    };
                    row.append(button);
                }
                list.append(row);
            });
            if (!snap.size) list.textContent = 'No journal feedback yet.';
        }, () => { unsubscribe = null; status.textContent = 'Could not load. Close and reopen to retry.'; });
    });
});
