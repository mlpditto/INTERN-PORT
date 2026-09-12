// Daily Canvas keeps the original mood picker, note routing and save handlers.
window.dailyCanvasContent = function (content) {
    const enabled = document.getElementById('dc-feedback-check')?.checked;
    const question = document.getElementById('dc-feedback-question')?.value.trim();
    return enabled && question ? content + '\n\n💬 Feedback requested — To Admin\n' + question : content;
};
window.resetDailyCanvasFeedback = function () {
    const check = document.getElementById('dc-feedback-check');
    if (!check) return;
    check.checked = false;
    document.getElementById('dc-feedback-question').value = '';
    document.getElementById('dc-feedback-fields').hidden = true;
};
document.addEventListener('DOMContentLoaded', function () {
    const pane = document.getElementById('rl-reflection-pane');
    if (!pane) return;
    pane.classList.add('daily-canvas');
    const header = document.createElement('div');
    header.className = 'dc-header lang-no-toggle';
    header.innerHTML = '<strong>🌤 Daily Canvas</strong><span>Daily Journal · Admin review</span>';
    pane.prepend(header);
    const content = document.getElementById('rl-content');
    const editor = document.createElement('div');
    editor.className = 'dc-editor';
    content.before(editor);
    editor.append(content);
    const toolbar = document.createElement('div');
    toolbar.className = 'dc-toolbar';
    editor.append(toolbar);
    const summarize = document.getElementById('rl-summarize-btn');
    const oldSummaryRow = summarize.parentElement;
    toolbar.append(summarize, pane.querySelector('.char-counter'));
    oldSummaryRow.remove();
    const noteFold = document.getElementById('rl-note-fold');
    const feedback = document.createElement('div');
    feedback.className = 'dc-feedback lang-no-toggle';
    feedback.innerHTML = '<label class="dc-feedback-label"><input type="checkbox" id="dc-feedback-check" aria-controls="dc-feedback-fields"> 💬 Ask for feedback</label><div id="dc-feedback-fields" hidden><label for="dc-feedback-question">Question for Admin</label><textarea id="dc-feedback-question" rows="2" maxlength="1000" placeholder="อยากให้ช่วยแนะนำเรื่องไหน…"></textarea><small>คำถามจะแนบกับบันทึกนี้ให้ Admin review</small></div>';
    noteFold.after(feedback);
    document.getElementById('dc-feedback-check').addEventListener('change', function () {
        document.getElementById('dc-feedback-fields').hidden = !this.checked;
    });
    const submit = document.getElementById('rl-submit-btn');
    const footer = submit.parentElement;
    footer.classList.add('dc-footer');
    const tools = document.getElementById('rl-tools-toggle-btn');
    tools.querySelector('span').textContent = '🧰 Tools';
    footer.prepend(tools);
    toggleJournalNoteFields(false);
});
