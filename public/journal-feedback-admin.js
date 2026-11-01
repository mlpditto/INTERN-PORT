document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('dashboard-work');
    if (!host) return;
    const section = document.createElement('details');
    section.id = 'jf-panel'; section.className = 'lr-admin lang-no-toggle';
    section.innerHTML = '<summary>💬 Journal feedback <b class="jf-count" hidden></b></summary><div class="jf-tabs" role="group" aria-label="Filter"></div><div class="jf-list"></div><p role="status"></p>';
    host.prepend(section);
    const list = section.querySelector('.jf-list'), status = section.querySelector('p'), count = section.querySelector('.jf-count'), tabs = section.querySelector('.jf-tabs');
    let unsubscribe, unsubCopies, snapDocs = [], copies = {}, copiesLoaded = false, seen = null, filter = 'all';
    const backfilled = new Set();
    const drafts = {};   // V102.526: a reply being typed survives the re-render a snapshot causes
    const when = ts => ts?.toDate?.().toLocaleString() || '';
    function ago(ts) {
        const ms = ts?.toMillis?.(); if (!ms) return '';
        const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
        return m < 1 ? 'now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
    }
    const isReplied = id => { const c = copies[id]; return !!(c && c.status === 'answered' && c.reply); };
    const MATCH = { all: () => true, unread: d => !d.data().read, needs: d => !isReplied(d.id), replied: d => isReplied(d.id) };
    const LABEL = { all: 'All', unread: 'Unread', needs: 'Needs reply', replied: 'Replied' };
    const initials = name => [...String(name || '?').trim()].slice(0, 2).join('').toUpperCase();
    const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    function rowHead(summary, data, id) {
        const name = data.userName || data.userId, replied = isReplied(id);
        const av = document.createElement('span'); av.className = 'jf-av'; av.textContent = initials(name); av.style.background = `hsl(${hue(name)} 55% 92%)`; av.style.color = `hsl(${hue(name)} 45% 32%)`;
        const main = document.createElement('span'); main.className = 'jf-main';
        const top = document.createElement('span'); top.className = 'jf-top';
        const who = document.createElement('b'); who.textContent = name;
        const pill = document.createElement('span'); pill.className = 'jf-st ' + (replied ? 'replied' : data.read ? 'read' : 'new'); pill.textContent = replied ? '↩ Replied' : data.read ? '✓ Read' : 'New';
        top.append(who, pill);
        if (drafts[id]) { const d = document.createElement('span'); d.className = 'jf-st draft'; d.textContent = 'Draft'; top.append(d); }
        const line = document.createElement('span'); line.className = 'jf-pv'; line.textContent = String(data.message || '').replace(/\s+/g, ' ');
        main.append(top, line);
        const side = document.createElement('span'); side.className = 'jf-side';
        const t = document.createElement('time'); t.textContent = ago(data.timestamp); t.title = when(data.timestamp); side.append(t);
        if (data.attachment) { const a = document.createElement('span'); a.className = 'jf-att'; a.title = 'Daily Canvas attached'; a.textContent = '📎 ' + (data.attachment.mood || ''); side.append(a); }
        summary.append(av, main, side);
    }
    // V102.553: a message sent before V101.247 has no intern copy, so it never reached History. The admin may create it; once per load.
    function backfill() {
        if (!copiesLoaded) return;
        snapDocs.forEach(doc => {
            const d = doc.data();
            if (copies[doc.id] || backfilled.has(doc.id) || !d.authUid || !d.userId) return;
            backfilled.add(doc.id);
            db.collection('intern_messages').doc(doc.id).set({ authUid: d.authUid, userId: d.userId, message: d.message, attached: !!d.attachment, status: 'sent', createdAt: d.timestamp }, { merge: true })
                .catch(e => console.warn('intern_messages backfill:', e && e.message));
        });
    }
    function paintTabs() {
        tabs.replaceChildren(...Object.keys(LABEL).map(k => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'jf-tab'; b.setAttribute('aria-pressed', String(filter === k));
            b.textContent = LABEL[k] + ' ' + snapDocs.filter(MATCH[k]).length;
            b.onclick = () => { filter = k; paint(); };
            return b;
        }));
    }
    function paint() {
        const unread = snapDocs.filter(doc => !doc.data().read).length;
        section.classList.toggle('queue-empty', !unread);
        count.hidden = !unread; count.textContent = unread;
        paintTabs();
        const open = new Set([...list.querySelectorAll('details[open]')].map(d => d.dataset.id));
        list.replaceChildren();
        snapDocs.filter(MATCH[filter]).sort((a, b) => (b.data().timestamp?.toMillis?.() || 0) - (a.data().timestamp?.toMillis?.() || 0)).forEach(doc => {
            const data = doc.data(), row = document.createElement('details');
            row.className = 'lr-request'; row.dataset.id = doc.id; row.open = open.has(doc.id);
            row.addEventListener('toggle', () => { if (row.open && row.isConnected) list.querySelectorAll('details.lr-request[open]').forEach(o => { if (o !== row) o.open = false; }); });   // one open at a time
            const copy = copies[doc.id], replied = isReplied(doc.id);
            const summary = document.createElement('summary');
            rowHead(summary, data, doc.id);
            row.append(summary);
            const message = document.createElement('p'); message.className = 'jf-msg'; message.style.whiteSpace = 'pre-wrap'; message.textContent = data.message; row.append(message);
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
            ta.value = drafts[doc.id] || '';
            const left = document.createElement('small'); left.className = 'jf-len'; left.textContent = ta.value.length + '/2000';
            ta.oninput = () => {
                const had = !!drafts[doc.id];
                if (ta.value) drafts[doc.id] = ta.value; else delete drafts[doc.id];
                left.textContent = ta.value.length + '/2000';
                if (had !== !!drafts[doc.id]) { const top = summary.querySelector('.jf-top'), d = top.querySelector('.draft'); if (d) d.remove(); else { const c = document.createElement('span'); c.className = 'jf-st draft'; c.textContent = 'Draft'; top.append(c); } }
            };
            ta.onkeydown = e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go.click(); }
                if (e.key === 'Escape') { e.stopPropagation(); row.open = false; summary.focus(); }
            };
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
            acts.append(left);
            box.append(ta, acts); row.append(box);
            list.append(row);
        });
        if (!list.firstChild) { const none = document.createElement('p'); none.className = 'jf-none'; none.textContent = snapDocs.length ? 'Nothing here. Well done.' : 'No journal feedback yet.'; list.append(none); }
    }
    function listen() {
        if (unsubscribe || !db.app.auth().currentUser) return;
        unsubscribe = db.collection('admin_notifications').where('type', '==', 'journal_feedback').onSnapshot(snap => {
            // a message that arrives while the Dashboard is open says so once; the first load does not
            const fresh = seen ? snap.docs.filter(d => !seen.has(d.id) && !d.data().read) : [];
            seen = new Set(snap.docs.map(d => d.id));
            if (fresh.length && typeof showToast === 'function') showToast('💬 New Journal feedback from ' + (fresh[0].data().userName || 'an intern'));
            snapDocs = snap.docs; paint(); backfill();
        }, () => { section.classList.remove('queue-empty'); unsubscribe = null; status.textContent = 'Could not load. Close and reopen to retry.'; });
        // V102.526: the interns' copies carry the replies — read alongside (admins read all); missing or denied = no reply shown, nothing else changes
        if (!unsubCopies) unsubCopies = db.collection('intern_messages').onSnapshot(snap => {
            copies = {}; snap.docs.forEach(d => { copies[d.id] = d.data(); }); copiesLoaded = true; paint(); backfill();
        }, e => { console.warn('intern_messages:', e && e.message); unsubCopies = null; });
    }
    section.addEventListener('toggle', () => { if (section.open) listen(); });
    db.app.auth().onAuthStateChanged(user => {
        unsubscribe?.(); unsubscribe = null; unsubCopies?.(); unsubCopies = null; copies = {}; snapDocs = []; copiesLoaded = false; seen = null;
        section.classList.remove('queue-empty');
        if (user) listen();
    });
});
