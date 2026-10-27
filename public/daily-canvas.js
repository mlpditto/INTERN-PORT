// Independent in-page drafts. Original mood and save handlers stay in use.
document.addEventListener('DOMContentLoaded', function () {
    const byId = id => document.getElementById(id);
    const pane = byId('rl-reflection-pane');
    if (!pane) return;
    pane.classList.add('daily-canvas');
    const day = document.createElement('section');
    day.id = 'dc-day'; day.className = 'dc-panel';
    while (pane.firstChild) day.append(pane.firstChild);
    // V101.211 (design C, mockup pick 2026-10-26): no folds. One warm hero (title · streak · mood) and borderless rows below it:
    // Today = Learned · Hard · Next, 🎓 Note, ✉️ Message admin. Fill any of them; ONE Send sends only the filled parts (Today →
    // reflective_logs, Note → learning_path_entries, Message → admin_notifications) and names them. Once today's entry is in,
    // the hero shows it as a quote with the mood discs turned green. Save handlers, ids and rules are unchanged.
    const hero = document.createElement('div');
    hero.id = 'dc-hero'; hero.className = 'dc-hero lang-no-toggle';
    // V101.215 (lean): no second "Journal" title (the Mission tab says it) — the mood question is the bar's title, until a mood is picked
    hero.innerHTML = '<div class="dc-bar"><p class="dc-ask">How do you feel today?</p><span class="dc-fire" hidden></span><span class="dc-mdd" title="Today sent · ส่งแล้ววันนี้" hidden></span><span class="dc-date"></span></div>'
        + '<div class="dc-quote" hidden></div><p class="dc-lock" hidden>🎓 Today’s +0.1 came from your Note · ส่ง Journal ได้อีกครั้งพรุ่งนี้</p><span class="dc-pts" hidden>+0.1</span>';
    // "Mon 26 Oct" built from parts: ICU builds differ on the comma (Linux Chromium / LINE WebView give "Mon, 26 Oct")
    const dp = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).formatToParts(new Date()).map(p => [p.type, p.value]));
    hero.querySelector('.dc-date').textContent = dp.weekday + ' ' + dp.day + ' ' + dp.month;
    pane.append(hero, day);
    const picker = byId('mood-picker');
    hero.querySelector('.dc-quote').before(picker);

    // ---- Today: three one-line rows, joined into #rl-content on send ("Learned: … / Hard: … / Next: …")
    const row = (cls, html) => { const r = document.createElement('div'); r.className = 'dc-row ' + cls; r.innerHTML = html; return r; };
    const grow = ta => { ta.style.height = 'auto'; if (ta.value && ta.scrollHeight) ta.style.height = ta.scrollHeight + 'px'; };   // empty or hidden → natural one row
    const PARTS = [['learned', 'Learned', 'ได้เรียนรู้อะไร'], ['hard', 'Hard', 'ติดอะไร'], ['next', 'Next', 'จะทำอะไรต่อ']];
    const rows = document.createElement('div'); rows.className = 'dc-rows lang-no-toggle';
    PARTS.forEach(([k, label, ph]) => rows.append(row('dc-t', '<label class="dc-lb" for="dc-t-' + k + '">' + label + '</label><textarea id="dc-t-' + k + '" rows="1" placeholder="' + label + ' · ' + ph + '"></textarea>')));
    day.prepend(rows);
    const today = PARTS.map(([k]) => byId('dc-t-' + k));
    const content = byId('rl-content');
    const compose = () => PARTS.map(([, label], i) => today[i].value.trim() ? label + ': ' + today[i].value.trim() : '').filter(Boolean).join('\n');
    const summarize = document.createElement('button');
    summarize.type = 'button'; summarize.className = 'dc-ib dc-spark'; summarize.textContent = '✨';
    summarize.title = 'Summarize today’s quizzes and cases · สรุปกิจกรรมวันนี้'; summarize.setAttribute('aria-label', 'Summarize today');
    today[0].after(summarize);
    // ✨ reuses insertTodayReflectionSummary(): run it on an empty #rl-content, keep only its "• …" activity lines for Learned
    summarize.onclick = () => {
        const keep = content.value; content.value = '';
        insertTodayReflectionSummary();
        const lines = content.value.split('\n').filter(l => l.startsWith('•'));
        content.value = keep; updateCharCount();
        if (!lines.length) return;
        today[0].value = (today[0].value.trim() ? today[0].value.trim() + '\n' : '') + lines.join('\n');
        grow(today[0]); refresh(); today[0].focus();
    };
    const toolsBtn = document.createElement('button');
    toolsBtn.type = 'button'; toolsBtn.className = 'dc-ib'; toolsBtn.textContent = '🧰';
    toolsBtn.title = 'Learning tools (optional) · เครื่องมือที่ใช้'; toolsBtn.setAttribute('aria-label', 'Learning tools');
    toolsBtn.onclick = () => { toggleLearningToolsPanel(); toolsBtn.classList.toggle('on', byId('rl-tools-body').style.display !== 'none'); };
    today[2].after(toolsBtn);
    const prompt = byId('rl-personality-prompt');
    if (prompt) rows.before(prompt);
    rows.after(byId('rl-tools-body'));
    // the old controls stay in the DOM (callers and save paths read them) but out of sight
    const stash = document.createElement('div'); stash.className = 'dc-stash'; stash.hidden = true;
    stash.append(byId('rl-mood-row'), byId('rl-summarize-btn').parentElement, content.parentElement, byId('rl-learning-tools'));
    day.append(stash);

    // ---- 🎓 Note: one row; title · tags · My Notes open under it while it is in use
    const note = document.createElement('section');
    note.id = 'dc-note'; note.className = 'dc-panel';
    pane.append(note);   // each part is attached before its moved fields are looked up by ID
    note.append(row('dc-ic', '<span class="dc-i" aria-hidden="true">🎓</span><textarea id="dc-note-content" rows="1" aria-label="Note" placeholder="A lesson worth keeping…" title="Reviewed by admin · แอดมินตรวจ"></textarea>'));
    note.querySelector('.dc-row').append(byId('ln-counter'));
    byId('ln-counter').title = 'Notes saved · max 90';
    const noteMore = document.createElement('div'); noteMore.className = 'dc-more';
    noteMore.append(byId('rl-note-fields'));
    if (byId('ln-history')) noteMore.append(byId('ln-history'));
    note.append(noteMore);
    byId('rl-note-fields').style.display = 'block';
    byId('rl-note-fold').hidden = true;
    byId('lp-note-title').setAttribute('aria-label', 'Note title');
    byId('lp-note-tag-input').setAttribute('aria-label', 'Add note tag');
    byId('lp-note-tag-input').placeholder = 'Add tag · Enter';
    const noteTa = byId('dc-note-content');

    // ---- ✉️ Message admin: one row with a 📎 "attach today's entry" toggle
    const msg = document.createElement('section');
    msg.id = 'dc-feedback'; msg.className = 'dc-panel lang-no-toggle';
    pane.append(msg);
    msg.append(row('dc-ic', '<span class="dc-i" aria-hidden="true">✉️</span><textarea id="dc-feedback-message" rows="1" maxlength="4000" aria-label="Message to admin" placeholder="Help or an idea?"></textarea>'
        + '<label class="dc-ib dc-clip" title="Attach today’s entry · แนบบันทึกวันนี้"><input type="checkbox" id="dc-feedback-attach" aria-label="Attach today’s entry">📎</label>'));
    msg.insertAdjacentHTML('beforeend', '<p id="dc-feedback-status" role="status"></p>');
    const msgTa = byId('dc-feedback-message'), attach = byId('dc-feedback-attach');

    // ---- the one Send, then 💬 entries + mentor feedback
    const bar = document.createElement('div');
    bar.className = 'dc-sendbar lang-no-toggle'; bar.hidden = true;
    pane.append(bar);
    bar.innerHTML = '<span class="dc-what"></span><button type="button" id="dc-send" class="dc-go"></button>'
        + '<button type="button" id="dc-note-submit" class="dc-ghost" tabindex="-1" aria-hidden="true">Save note</button><button type="button" id="dc-feedback-submit" class="dc-ghost" tabindex="-1" aria-hidden="true">Send</button>';
    const submitBtn = byId('rl-submit-btn'); submitBtn.classList.add('dc-ghost'); submitBtn.tabIndex = -1; bar.append(submitBtn);   // the +0.1 float rises from here
    const send = byId('dc-send');
    const feed = document.createElement('section');
    feed.id = 'dc-feed'; feed.className = 'dc-panel dc-feed lang-no-toggle';   // entries + the กดรับ button are Thai
    feed.innerHTML = '<div class="dc-sec-t" title="Feedback"><span aria-hidden="true">💬</span></div>';
    const historyArea = byId('rl-history-area');
    if (historyArea) { feed.append(historyArea); historyArea.style.display = 'block'; }
    pane.append(feed);

    // Callers still ask for a "tab" (Know thyself → 'day', the Note fold button → 'note'): bring that row into view.
    window.selectJournalTab = key => {
        const target = { day: today[0], note: noteTa, feedback: msgTa }[key];
        if (!target) return;
        const shown = !(key === 'day' && day.hidden);
        (shown ? target : hero).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (shown) target.focus({ preventScroll: true });
    };

    // ---- state: what is filled, what Send will do, and whether today's entry is already in
    const mood = () => byId('rl-mood').value;
    const filled = () => ({ today: !day.hidden && today.some(t => t.value.trim()), note: !!noteTa.value.trim(), msg: !!msgTa.value.trim() });
    let busy = false;
    function refresh() {
        const f = filled(), n = f.today + f.note + f.msg;
        rows.querySelectorAll('.dc-row').forEach((r, i) => r.classList.toggle('on', !!today[i].value.trim()));
        note.classList.toggle('on', f.note || note.contains(document.activeElement) || !!byId('lp-note-title').value.trim() || (window._lpNoteTags || []).length > 0);
        msg.classList.toggle('on', f.msg);
        attach.parentElement.classList.toggle('on', attach.checked);
        bar.hidden = n === 0 && !busy;
        const needMood = f.today && !mood();
        picker.classList.toggle('dc-need', needMood);
        const what = bar.querySelector('.dc-what');
        what.textContent = (f.today ? '📝' : '') + (f.note ? '🎓' : '') + (f.msg ? '✉️' : '');
        what.title = [f.today && 'Today', f.note && 'Note', f.msg && 'Message admin'].filter(Boolean).join(' + ');
        if (!busy) send.textContent = needMood ? 'Pick a mood' : 'Send ' + n + ' ↗';
        send.disabled = busy || needMood;
    }
    const logs = () => (typeof reflectiveLogsCache !== 'undefined' ? reflectiveLogsCache : window.myReflectiveLogsCache) || [];
    const todaysLog = () => logs().find(l => l && l.timestamp && l.timestamp.toDate && toDateKey(l.timestamp.toDate()) === toDateKey(new Date()));
    function sync() {
        const log = todaysLog(), noteDay = !log && typeof hasSubmittedDRToday === 'function' && hasSubmittedDRToday();
        hero.classList.toggle('dc-done', !!log);
        day.hidden = !!log || noteDay;
        feed.hidden = !byId('rl-history-list').children.length;   // V101.215: nothing to show yet → no empty 💬 section
        picker.hidden = day.hidden;
        hero.querySelector('.dc-ask').hidden = day.hidden || !!mood();
        hero.querySelector('.dc-lock').hidden = !noteDay;
        hero.querySelector('.dc-pts').hidden = !log;
        const mdd = hero.querySelector('.dc-mdd'), quote = hero.querySelector('.dc-quote');
        mdd.hidden = quote.hidden = !log;
        mdd.textContent = ''; quote.textContent = '';
        if (log) {
            [log.mood, log.moodSecondary].filter(Boolean).forEach(m => { const i = document.createElement('i'); i.textContent = m; mdd.append(i); });
            String(log.content || '').split('\n').forEach((line, i) => {
                if (i) quote.append(document.createElement('br'));
                const m = line.match(/^(Learned|Hard|Next): (.*)$/);
                if (m) { const b = document.createElement('b'); b.textContent = m[1]; quote.append(b, m[2]); } else quote.append(line);
            });
        }
        const badge = byId('rl-streak-badge'), n = ((badge || {}).textContent || '').match(/\d+/), fire = hero.querySelector('.dc-fire');
        fire.hidden = !(n && badge.style.display !== 'none');
        fire.textContent = n ? '🔥 ' + n[0] : '';
        refresh();
    }

    async function sendMessage() {
        const status = byId('dc-feedback-status'), message = msgTa.value.trim();
        const attached = attach.checked, log = todaysLog();
        const attachment = attached ? { content: compose() || (log && log.content) || '', mood: mood() || (log && log.mood) || '', moodSecondary: byId('rl-mood-secondary').value || (log && log.moodSecondary) || '' } : null;
        if (!message || message.length > 4000) { status.textContent = 'Please enter feedback (up to 4,000 characters).'; return false; }
        if (attached && (!attachment.content || attachment.content.length > 20000)) { status.textContent = 'Attached journal must contain 1–20,000 characters.'; return false; }
        status.textContent = 'Sending…';
        try {
            const authUser = await ensureFirebaseAuthReady(10000);
            if (!authUser) throw new Error('Sign in required');
            await db.collection('admin_notifications').add({ type: 'journal_feedback', authUid: authUser.uid, userId, userName: userProfile.displayName || '', message, attachment, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            status.textContent = '✓ Sent to Admin';
            if (msgTa.value.trim() === message) msgTa.value = '';
            if (attach.checked === attached) attach.checked = false;
            return true;
        } catch (e) { console.error('Journal feedback', e); status.textContent = 'Could not send. Your draft is retained — please retry.'; return false; }
    }
    byId('dc-note-submit').onclick = () => submitLpNoteOnly();
    byId('dc-feedback-submit').onclick = () => sendMessage();

    // Send: Today first (so a Note sent with it does not take the day's +0.1 twice), then Note, then Message. A part that did not
    // go through keeps its text and its row turns red; the parts that did are cleared and never sent again.
    send.onclick = async () => {
        if (busy) return;
        const f = filled();
        if (f.today && !mood()) return;
        if (!requireRegistered()) return;
        busy = true; send.textContent = 'Sending…'; refresh();
        [day, note, msg].forEach(p => p.classList.remove('dc-err'));
        try {
            if (f.today) {
                content.value = compose(); updateCharCount();
                await submitReflectiveLog();
                const ok = !content.value;   // submitReflectiveLog empties #rl-content only once the log is saved
                if (ok) today.forEach(t => { t.value = ''; grow(t); }); else { content.value = ''; updateCharCount(); }
                day.classList.toggle('dc-err', !ok);
            }
            if (f.note) { await submitLpNoteOnly(); note.classList.toggle('dc-err', !!noteTa.value.trim()); grow(noteTa); }
            if (f.msg) { msg.classList.toggle('dc-err', !(await sendMessage())); grow(msgTa); }
        } finally { busy = false; sync(); }
    };

    [...today, noteTa, msgTa].forEach(t => t.addEventListener('input', () => { grow(t); refresh(); }));
    note.addEventListener('focusin', refresh);
    note.addEventListener('focusout', () => setTimeout(refresh, 150));
    attach.addEventListener('change', refresh);
    picker.addEventListener('click', () => setTimeout(() => { hero.querySelector('.dc-ask').hidden = day.hidden || !!mood(); refresh(); }));
    // re-read today's state whenever the entries list or the daily status is redrawn (both follow the Firestore listeners)
    new MutationObserver(sync).observe(byId('rl-history-list') || feed, { childList: true });
    const drStatus = window.renderDRStatus;
    window.renderDRStatus = function () { const r = drStatus.apply(this, arguments); sync(); return r; };

    // Daily completion must never disable the other parts.
    byId('rl-form-area').style.opacity = '1'; byId('rl-form-area').style.pointerEvents = 'auto';
    if (typeof renderDRStatus === 'function') renderDRStatus();
    if (typeof renderLnCounter === 'function') renderLnCounter();
    sync();
});
