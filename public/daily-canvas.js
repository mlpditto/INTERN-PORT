// Independent in-page drafts. Original mood and save handlers stay in use.
document.addEventListener('DOMContentLoaded', function () {
    const byId = id => document.getElementById(id);
    const pane = byId('rl-reflection-pane');
    if (!pane) return;
    pane.classList.add('daily-canvas');
    const day = document.createElement('section');
    day.id = 'dc-day'; day.className = 'dc-panel';
    while (pane.firstChild) day.append(pane.firstChild);
    pane.innerHTML = '<header class="dc-header lang-no-toggle"><strong>🔥 Journal</strong><span></span></header><div class="dc-tabs lang-no-toggle" role="tablist" aria-label="Journal"><button type="button" id="dc-tab-day" role="tab" aria-controls="dc-day" aria-selected="true">🌤 Daily Canvas</button><button type="button" id="dc-tab-note" role="tab" aria-controls="dc-note" aria-selected="false" tabindex="-1">🎓 Learning Note</button><button type="button" id="dc-tab-feedback" role="tab" aria-controls="dc-feedback" aria-selected="false" tabindex="-1">💬 Feedback</button></div>';
    pane.querySelector('.dc-header span').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date());
    pane.append(day);
    const note = document.createElement('section');
    note.id = 'dc-note'; note.className = 'dc-panel'; note.hidden = true;
    note.append(byId('rl-note-fields'));
    // Attach before looking up the moved fields by ID.
    pane.append(note);
    note.insertAdjacentHTML('beforeend', '<label for="dc-note-content" class="dc-label">Note</label><textarea id="dc-note-content" rows="6" placeholder="เก็บความรู้ วิธีคิด หรือบทเรียนที่อยากกลับมาทบทวน…"></textarea><div class="dc-footer lang-no-toggle"><span class="dc-meta">Admin review</span><button type="button" id="dc-note-submit" class="dc-submit">🎓 Save note</button></div>');
    byId('rl-note-fields').style.display = 'block';
    byId('rl-note-fold').hidden = true;
    byId('lp-note-title').setAttribute('aria-label', 'Note title');
    byId('lp-note-tag-input').setAttribute('aria-label', 'Add note tag');
    note.querySelector('.dc-footer').prepend(byId('ln-counter'));
    if (byId('ln-history')) note.append(byId('ln-history'));
    const feedback = document.createElement('section');
    feedback.id = 'dc-feedback'; feedback.className = 'dc-panel lang-no-toggle'; feedback.hidden = true;
    feedback.innerHTML = '<label for="dc-feedback-message" class="dc-label">To Admin</label><textarea id="dc-feedback-message" rows="5" maxlength="4000" placeholder="อยากให้ช่วยเรื่องไหน หรืออยากเสนออะไร…"></textarea><label class="dc-feedback-label"><input type="checkbox" id="dc-feedback-attach"> 📎 Include Daily Canvas draft</label><p class="dc-meta">ส่งเฉพาะข้อความนี้ และข้อความพร้อมอารมณ์จาก Daily Canvas เมื่อเลือกแนบ</p><div class="dc-footer"><button type="button" id="dc-feedback-submit" class="dc-submit">↗ Send feedback</button></div><p id="dc-feedback-status" role="status"></p>';
    pane.append(feedback);
    const panels = [day, note, feedback], tabs = [...pane.querySelectorAll('[role="tab"]')];
    panels.forEach(p => { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'dc-tab-' + p.id.slice(3)); });
    window.selectJournalTab = key => {
        panels.forEach(p => { p.hidden = p.id !== 'dc-' + key; });
        tabs.forEach(t => { const active = t.id === 'dc-tab-' + key; t.setAttribute('aria-selected', String(active)); t.tabIndex = active ? 0 : -1; });
    };
    tabs.forEach((t, index) => {
        t.onclick = () => selectJournalTab(t.id.slice(7));
        t.onkeydown = e => {
            let next;
            if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            if (e.key === 'Home') next = 0;
            if (e.key === 'End') next = tabs.length - 1;
            if (next === undefined) return;
            e.preventDefault(); tabs[next].click(); tabs[next].focus();
        };
    });
    const content = byId('rl-content'), editor = document.createElement('div');
    editor.className = 'dc-editor'; content.before(editor); editor.append(content);
    content.setAttribute('aria-label', 'Daily journal');
    const toolbar = document.createElement('div'); toolbar.className = 'dc-toolbar'; editor.append(toolbar);
    const summarize = byId('rl-summarize-btn'), oldSummaryRow = summarize.parentElement;
    toolbar.append(summarize, pane.querySelector('.char-counter')); oldSummaryRow.remove();
    const submit = byId('rl-submit-btn'), footer = submit.parentElement;
    footer.classList.add('dc-footer');
    const tools = byId('rl-tools-toggle-btn'); tools.querySelector('span').textContent = '🧰 Tools'; footer.prepend(tools);
    byId('dc-note-submit').onclick = () => submitLpNoteOnly();
    // Daily completion must never disable the other tabs.
    byId('rl-form-area').style.opacity = '1'; byId('rl-form-area').style.pointerEvents = 'auto';
    if (typeof renderDRStatus === 'function') renderDRStatus();
    if (typeof renderLnCounter === 'function') renderLnCounter();
    byId('dc-feedback-submit').onclick = async function () {
        if (this.disabled) return;
        const status = byId('dc-feedback-status'), message = byId('dc-feedback-message').value.trim();
        const attached = byId('dc-feedback-attach').checked;
        const attachment = attached ? { content: content.value.trim(), mood: byId('rl-mood').value, moodSecondary: byId('rl-mood-secondary').value } : null;
        if (!message || message.length > 4000) { status.textContent = 'Please enter feedback (up to 4,000 characters).'; return; }
        if (attached && (!attachment.content || attachment.content.length > 20000)) { status.textContent = 'Attached journal must contain 1–20,000 characters.'; return; }
        this.disabled = true; status.textContent = 'Sending…';
        try {
            const authUser = await ensureFirebaseAuthReady(10000);
            if (!authUser) throw new Error('Sign in required');
            await db.collection('admin_notifications').add({ type: 'journal_feedback', authUid: authUser.uid, userId, userName: userProfile.displayName || '', message, attachment, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            status.textContent = '✓ Sent to Admin';
            if (byId('dc-feedback-message').value.trim() === message) byId('dc-feedback-message').value = '';
            if (byId('dc-feedback-attach').checked === attached) byId('dc-feedback-attach').checked = false;
        } catch (e) { console.error('Journal feedback', e); status.textContent = 'Could not send. Your draft is retained — please retry.'; }
        finally { this.disabled = false; }
    };
});
