// Independent in-page drafts. Original mood and save handlers stay in use.
document.addEventListener('DOMContentLoaded', function () {
    const byId = id => document.getElementById(id);
    const pane = byId('rl-reflection-pane');
    if (!pane) return;
    pane.classList.add('daily-canvas');
    const day = document.createElement('section');
    day.id = 'dc-day'; day.className = 'dc-panel';
    while (pane.firstChild) day.append(pane.firstChild);
    // V101.171 (design A, mockup pick): no tabs — ONE page, top to bottom: today's entry · 🎓 Note (a fold with its own form) ·
    // 💬 recent entries + mentor feedback (always visible) · ✉️ Message admin (a fold). Faint .dc-hint lines say what each part
    // is for (EN · TH, shielded from lang-toggle). Save handlers, ids and rules are unchanged.
    const hint = (en, th) => '<p class="dc-hint lang-no-toggle">' + en + ' · ' + th + '</p>';
    pane.innerHTML = '<div class="dc-bar lang-no-toggle"><span class="dc-title">📓 Journal</span><span class="dc-fire" aria-hidden="true">🔥</span><span class="dc-date"></span></div>';
    pane.querySelector('.dc-date').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date());
    pane.append(day);
    const note = document.createElement('details');
    note.id = 'dc-note'; note.className = 'dc-panel dc-fold';
    note.innerHTML = '<summary class="lang-no-toggle"><span class="dc-fold-t">🎓 Note</span><span class="dc-fold-s">title · tags</span></summary>'
        + hint('A lesson worth keeping — a drug, a guideline, a case pearl — with a title and tags to review later. Reviewed by admin', 'บทเรียนที่อยากเก็บไว้ทบทวน มีชื่อและแท็ก · แอดมินตรวจ');
    note.append(byId('rl-note-fields'));
    // Attach before looking up the moved fields by ID.
    pane.append(note);
    note.insertAdjacentHTML('beforeend', '<textarea id="dc-note-content" rows="6" aria-label="Note" placeholder="What did you learn? Key ideas, reasoning, lessons to revisit…"></textarea><div class="dc-footer lang-no-toggle"><span class="dc-meta">Reviewed by admin</span><button type="button" id="dc-note-submit" class="dc-submit">Save note</button></div>');
    byId('rl-note-fields').style.display = 'block';
    byId('rl-note-fold').hidden = true;
    byId('lp-note-title').setAttribute('aria-label', 'Note title');
    byId('lp-note-tag-input').setAttribute('aria-label', 'Add note tag');
    byId('lp-note-tag-input').placeholder = 'Add tag · Enter';
    byId('ln-counter').title = 'Notes saved · max 90';
    note.querySelector('.dc-footer').prepend(byId('ln-counter'));
    if (byId('ln-history')) note.append(byId('ln-history'));
    // 💬 recent entries + mentor feedback: the reflection history (Admin: … · กดรับ +X) used to sit INSIDE the day panel, which is
    // dimmed and click-blocked once today's entry is done, and it stayed hidden until a submit in that visit. Its own section now.
    const feed = document.createElement('section');
    feed.id = 'dc-feed'; feed.className = 'dc-panel dc-feed lang-no-toggle';   // entries + the กดรับ button are Thai
    feed.innerHTML = '<div class="dc-sec-t lang-no-toggle">💬 Feedback</div>'
        + hint('Your last 7 entries. Your mentor’s comments appear under each one — tap “กดรับ” to collect a bonus', 'ความเห็นพี่เลี้ยงขึ้นใต้บันทึก · มีโบนัสกดรับได้');
    const historyArea = byId('rl-history-area');
    if (historyArea) { feed.append(historyArea); historyArea.style.display = 'block'; }
    pane.append(feed);
    const feedback = document.createElement('details');
    feedback.id = 'dc-feedback'; feedback.className = 'dc-panel dc-fold lang-no-toggle';
    feedback.innerHTML = '<summary><span class="dc-fold-t">✉️ Message admin</span><span class="dc-fold-s">help · suggestion</span></summary>'
        + hint('Ask for help or suggest something. Tick the box to attach today’s entry', 'ขอความช่วยเหลือหรือเสนอแนะ · แนบบันทึกวันนี้ได้')
        + '<textarea id="dc-feedback-message" rows="5" maxlength="4000" aria-label="Message to admin" placeholder="Need help with something, or have a suggestion?"></textarea><label class="dc-feedback-label"><input type="checkbox" id="dc-feedback-attach"> 📎 Attach today&#39;s Daily Canvas (text + mood)</label><div class="dc-footer"><button type="button" id="dc-feedback-submit" class="dc-submit">↗ Send to Admin</button></div><p id="dc-feedback-status" role="status"></p>';
    pane.append(feedback);
    // Callers still ask for a "tab" (Know thyself → 'day', the Note fold button → 'note'): open that part and bring it into view.
    window.selectJournalTab = key => {
        const target = { day, note, feedback }[key];
        if (!target) return;
        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const picker = byId('mood-picker');
    if (picker) picker.insertAdjacentHTML('beforebegin', hint('Pick today’s mood — tap a second one for a mixed day', 'เลือกอารมณ์วันนี้ · แตะอีกอันเป็นอารมณ์รอง'));
    const content = byId('rl-content'), editor = document.createElement('div');
    editor.className = 'dc-editor'; content.before(editor); editor.append(content);
    editor.insertAdjacentHTML('afterend', hint('Write 3 things: what you learned, what was hard, what you’ll do next. ✨ Summarize adds today’s quizzes and cases. Once a day, +0.1', 'เขียน 3 เรื่อง: ได้เรียนรู้อะไร · ติดอะไร · จะทำอะไรต่อ · วันละครั้ง +0.1'));
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
