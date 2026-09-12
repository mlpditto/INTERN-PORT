/* Learning requests: History context and owner-scoped progress. */
(() => {
    const topics = { behavior: '✨ Overview', quiz: '🎯 Quiz', time: '⏱ Time', improvement: '🌱 Improve', recommendation: '📚 Content' };
    const states = { pending: '⏳ Pending', reviewing: '🔎 Reviewing', ready: '✅ Ready' };
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let topic = 'behavior', manualTopic = false, unsubscribe, listeningUid;
    const byId = id => document.getElementById(id);
    const dates = () => ({ start: byId('lr-start')?.value || '', end: byId('lr-end')?.value || '' });
    const scope = () => ({ category: unifiedCurrentFilter, status: unifiedCurrentStatus, query: unifiedSearchQuery, ...dates() });
    const scopeLabel = s => `${s.category} · ${!s.start && !s.end ? 'All time' : `${s.start || 'Any start'} → ${s.end || 'Any end'}`} · ${s.status}${s.query ? ' · Search: ' + s.query : ''}`;
    const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
    const validDates = () => { const d = dates(); return !d.start || !d.end || d.start <= d.end; };

    window.filterReviewDates = items => {
        const d = dates();
        if (!d.start && !d.end) return items;
        if (!validDates()) return [];
        return items.filter(item => {
            const date = item.timestamp?.toDate?.();
            if (!date) return false;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return (!d.start || key >= d.start) && (!d.end || key <= d.end);
        });
    };
    window.syncReviewContext = () => {
        if (!byId('lr-scope')) return;
        if (!manualTopic) topic = unifiedCurrentFilter === 'quiz' ? 'quiz' : 'behavior';
        byId('lr-scope').textContent = scopeLabel(scope());
        byId('lr-date-error').textContent = validDates() ? '' : 'End date must be on or after start date';
        byId('lr-topics').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === topic)));
    };
    window.toggleHistoryReview = () => {
        const panel = byId('lr-panel');
        panel.hidden = !panel.hidden;
        byId('lr-toggle').setAttribute('aria-expanded', String(!panel.hidden));
        syncReviewContext();
        if (!panel.hidden) listenRequests();
    };
    window.loadLearningAnalytics = () => { if (byId('lr-panel')?.hidden) toggleHistoryReview(); };

    async function listenRequests() {
        try {
            await ensureFirebaseAuthReady(10000);
            const uid = firebase.auth().currentUser.uid;
            if (listeningUid === uid) return;
            unsubscribe?.();
            listeningUid = uid;
            unsubscribe = db.collection('learning_reviews').where('authUid', '==', uid).onSnapshot(snap => {
                const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                byId('lr-requests').innerHTML = rows.length ? `<details><summary>Review requests (${rows.length}) · Latest: ${esc(states[rows[0].status])}</summary>${rows.map(r => `<details class="lr-request"><summary>${esc(topics[r.analysisType])} · ${esc(states[r.status])}</summary><p>${esc(scopeLabel(r.scope))}</p><p>${esc(r.note)}</p><small>${esc(r.updatedAt?.toDate?.().toLocaleString() || '')}</small>${r.status === 'ready' ? `<p class="lr-result">${esc(r.result)}</p>` : ''}</details>`).join('')}</details>` : '';
            }, () => { listeningUid = null; byId('lr-requests').textContent = 'Could not load requests. Reopen Review to retry.'; });
        } catch (e) { byId('lr-requests').textContent = 'Sign in to load review requests.'; }
    }

    async function send() {
        const button = byId('lr-send'), status = byId('lr-message');
        if (button.disabled) return;
        if (!validDates()) { status.textContent = 'Check the date range first.'; return; }
        button.disabled = true;
        const context = scope(), selectedTopic = topic, note = byId('lr-note').value.trim();
        try {
            await ensureFirebaseAuthReady(10000);
            const uid = firebase.auth().currentUser.uid;
            const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([selectedTopic, context])));
            const key = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
            const lock = db.collection('learning_review_locks').doc(uid + '_' + key);
            const ref = db.collection('learning_reviews').doc();
            const notification = db.collection('admin_notifications').doc();
            const created = await db.runTransaction(async tx => {
                const previous = await tx.get(lock);
                if (previous.exists) {
                    const old = await tx.get(db.collection('learning_reviews').doc(previous.data().requestId));
                    if (old.exists && old.data().status !== 'ready') return false;
                }
                tx.set(ref, { authUid: uid, userId, userName: userProfile.displayName || '', analysisType: selectedTopic, scope: context, note, status: 'pending', result: '', createdAt: stamp(), updatedAt: stamp() });
                tx.set(lock, { authUid: uid, requestId: ref.id });
                tx.set(notification, { type: 'learning_analytics_request', userId, userName: userProfile.displayName || '', message: 'Learning review requested', requestId: ref.id, timestamp: stamp(), read: false });
                return true;
            });
            status.textContent = created ? '✓ Request sent · Awaiting admin' : '⏳ A request for this topic and scope is already pending.';
            if (created && byId('lr-note').value.trim() === note) byId('lr-note').value = '';
            listenRequests();
        } catch (e) { console.error('Learning review request', e); status.textContent = 'Could not send request. Your note is retained — please retry.'; }
        finally { button.disabled = false; }
    }

    function userUI() {
        const history = byId('work-pane-history');
        if (!history) return;
        document.querySelector('#work-section-content .work-tabs-bar')?.remove();
        byId('work-pane-analytics')?.remove();
        history.classList.add('active');
        history.querySelector('.work-pane-shell').insertAdjacentHTML('afterbegin', `
            <div class="lr-header"><h3>↶ History</h3><button id="lr-toggle" aria-expanded="false" aria-controls="lr-panel">📈 Review ▾</button></div>
            <div class="lr-dates"><label>From <input id="lr-start" type="date"></label><label>To <input id="lr-end" type="date"></label><span id="lr-date-error" role="alert"></span></div>
            <section id="lr-panel" class="learning-review" hidden>
                <div class="learning-review-row"><h3>Learning Review</h3><span class="learning-review-meta">Admin review</span></div>
                <p id="lr-scope"></p><div class="learning-review-topics" id="lr-topics" role="group" aria-label="Analysis topic">${Object.entries(topics).map(([key, label]) => `<button type="button" data-topic="${key}" aria-pressed="${key === topic}">${label}</button>`).join('')}</div>
                <div class="learning-review-row learning-review-actions"><details><summary>✏️ Add note</summary><textarea id="lr-note" maxlength="4000" aria-label="Review note" placeholder="What should we focus on?"></textarea></details><button id="lr-send" class="learning-review-send">Send request ↗</button></div><p id="lr-message" role="status"></p>
            </section><div id="lr-requests" aria-live="polite"></div>`);
        byId('lr-toggle').onclick = toggleHistoryReview;
        byId('lr-send').onclick = send;
        byId('lr-topics').onclick = e => { const b = e.target.closest('[data-topic]'); if (b) { topic = b.dataset.topic; manualTopic = true; syncReviewContext(); } };
        ['lr-start', 'lr-end'].forEach(id => byId(id).onchange = () => { syncReviewContext(); unifiedRenderedCount = UNIFIED_PAGE_SIZE; renderUnifiedHistory(); });
        firebase.auth().onAuthStateChanged(user => {
            unsubscribe?.(); unsubscribe = null; listeningUid = null;
            byId('lr-requests').textContent = '';
            if (user) listenRequests();
        });
    }

    function adminUI() {
        const host = byId('dashboard-work');
        if (!host) return;
        const section = document.createElement('details');
        section.className = 'lr-admin';
        section.innerHTML = '<summary>📈 Learning review requests</summary><div class="lr-admin-list"></div><p role="status" class="lr-admin-message"></p>';
        host.prepend(section);
        const list = section.querySelector('.lr-admin-list'), message = section.querySelector('.lr-admin-message');
        let unsubscribe;
        function listen() {
            if (unsubscribe || !db.app.auth().currentUser) return;
            unsubscribe = db.collection('learning_reviews').onSnapshot(snap => {
                section.classList.toggle('queue-empty', !snap.docs.some(doc => ['pending', 'reviewing'].includes(doc.data().status)));
                // Preserve an in-progress admin draft during live status updates.
                const drafts = new Map([...list.querySelectorAll('textarea')].map(e => [e.dataset.id, e.value]));
                const openIds = new Set([...list.querySelectorAll('details[open]')].map(e => e.dataset.id));
                list.replaceChildren();
                const rows = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
                rows.forEach(doc => {
                    const r = doc.data(), card = document.createElement('details');
                    card.className = 'lr-request';
                    card.dataset.id = doc.id;
                    card.open = openIds.has(doc.id);
                    card.innerHTML = `<summary>${esc(r.userName)} · ${esc(topics[r.analysisType])} · ${esc(states[r.status])}</summary><p>${esc(scopeLabel(r.scope))}</p><p>${esc(r.note)}</p><label>Review result<textarea maxlength="12000" data-id="${esc(doc.id)}"></textarea></label><div class="lr-header"><button data-action="reviewing">Start review</button><button data-action="ready">Save result · Ready</button></div>`;
                    card.querySelector('textarea').value = drafts.get(doc.id) ?? r.result ?? '';
                    card.querySelector('[data-action="reviewing"]').disabled = r.status !== 'pending';
                    card.querySelectorAll('button').forEach(button => button.onclick = async () => {
                        const next = button.dataset.action, result = card.querySelector('textarea').value.trim();
                        if (next === 'ready' && !result) { message.textContent = 'Enter the review result before marking Ready.'; return; }
                        button.disabled = true;
                        try { await doc.ref.update({ status: next, ...(next === 'ready' ? { result } : {}), updatedAt: stamp() }); message.textContent = 'Saved'; }
                        catch (e) { message.textContent = 'Could not save. Please retry.'; button.disabled = false; }
                    });
                    list.append(card);
                });
                if (!rows.length) list.textContent = 'No requests yet. Earlier requests remain in Backlog.';
            }, () => { section.classList.remove('queue-empty'); unsubscribe = null; message.textContent = 'Could not load requests. Close and reopen to retry.'; });
        }
        section.addEventListener('toggle', () => { if (section.open) listen(); });
        db.app.auth().onAuthStateChanged(user => {
            unsubscribe?.(); unsubscribe = null;
            section.classList.remove('queue-empty');
            if (user) listen();
        });
    }
    document.addEventListener('DOMContentLoaded', () => { userUI(); adminUI(); });
})();
