/* Admin ▸ Dashboard ▸ "📖 Guide feedback": notes interns send from the bottom of each intern-guide section ("Not clear? Tell us what confused you").
   Reads admin_notifications where type == 'guide_feedback' — same inbox and same panel shape as journal-feedback-admin.js. Hidden while nothing is unread. */
document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('dashboard-work');
    if (!host) return;
    const section = document.createElement('details');
    section.className = 'lr-admin lang-no-toggle';
    section.innerHTML = '<summary>📖 Guide feedback</summary><div></div><p role="status"></p>';
    host.prepend(section);
    const list = section.querySelector('div'), status = section.querySelector('p');
    let unsubscribe;
    function listen() {
        if (unsubscribe || !db.app.auth().currentUser) return;
        unsubscribe = db.collection('admin_notifications').where('type', '==', 'guide_feedback').onSnapshot(snap => {
            section.classList.toggle('queue-empty', !snap.docs.some(doc => !doc.data().read));
            const open = new Set([...list.querySelectorAll('details[open]')].map(d => d.dataset.id));
            list.replaceChildren();
            snap.docs.sort((a, b) => (b.data().timestamp?.toMillis?.() || 0) - (a.data().timestamp?.toMillis?.() || 0)).forEach(doc => {
                const data = doc.data(), row = document.createElement('details');
                row.className = 'lr-request'; row.dataset.id = doc.id; row.open = open.has(doc.id);
                const summary = document.createElement('summary');
                summary.textContent = (data.read ? '✅ Read' : '💬 New') + ' · ' + (data.userName || data.userId) + ' · ' + (data.section || '?') + (data.lang ? ' (' + String(data.lang).toUpperCase() + ')' : '');
                row.append(summary);
                const message = document.createElement('p'); message.style.whiteSpace = 'pre-wrap'; message.textContent = data.message; row.append(message);
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
            if (!snap.size) list.textContent = 'No guide feedback yet.';
        }, () => { section.classList.remove('queue-empty'); unsubscribe = null; status.textContent = 'Could not load. Close and reopen to retry.'; });
    }
    section.addEventListener('toggle', () => { if (section.open) listen(); });
    db.app.auth().onAuthStateChanged(user => {
        unsubscribe?.(); unsubscribe = null;
        section.classList.remove('queue-empty');
        if (user) listen();
    });
});
