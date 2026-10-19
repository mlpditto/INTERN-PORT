// Move existing controls, keeping their IDs, values and event handlers intact.
document.addEventListener('DOMContentLoaded', function () {
    const actions = document.getElementById('quiz-editor-review-actions');
    const mode = document.getElementById('quiz-type-toggle');
    const type = document.getElementById('toolbar-q-type-toggle');
    const nav = document.getElementById('quiz-q-nav');
    if (!actions || !mode || !type || !nav) return;
    const shell = actions.parentElement;
    shell.classList.add('quiz-compact-toolbar');
    const oldRow = mode.parentElement;
    actions.prepend(mode);
    shell.prepend(actions);
    oldRow.querySelectorAll(':scope > span').forEach(el => {
        if (el.textContent.trim() === '|') el.remove();
    });
    const navRow = nav.parentElement;
    navRow.classList.add('quiz-compact-navigation');
    oldRow.prepend(navRow);
    // V102.317 (lean A): the Answer type chips open the tool strip, ahead of the this-question buttons.
    const bar = document.getElementById('quiz-editor-toolbar');
    type.setAttribute('aria-label', 'Answer type');
    if (bar) bar.prepend(type);
    else oldRow.append(type);
    const names = {choice:'Multiple choice',short_answer:'Short answer',ordering:'Ordering',flashcard:'Flashcard'};
    document.querySelectorAll('.qe-timer-mode [data-value]').forEach(el => {
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        });
    });
    type.querySelectorAll('[data-value]').forEach(el => {
        el.textContent = names[el.dataset.value] || el.title;
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        });
    });
    ['quiz-editor-ai', 'quiz-editor-tools'].forEach((id, index) => {
        const details = document.getElementById(id);
        if (!details) return;
        shell.append(details);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-compact-tool-button lang-no-toggle';
        button.textContent = index ? 'More tools' : 'AI tools';
        button.setAttribute('aria-controls', id);
        const sync = () => button.setAttribute('aria-expanded', String(details.open));
        button.onclick = () => { details.open = !details.open; sync(); };
        details.addEventListener('toggle', sync);
        sync();
        actions.append(button);
    });
    navRow.querySelectorAll('button[title]').forEach(button => {
        button.setAttribute('aria-label', button.title);
        if (button.getAttribute('onclick') === 'addQuestionUI()') button.append(' Add');
        if (button.getAttribute('onclick') === 'openBulkTagModal()') button.append(' Tags');
    });
});
