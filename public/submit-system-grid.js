// V101.85: how many cases the intern has sent per disease system (History's own caseKey; rejected ones do not count) -> a 0-3 level that colours the button
function sgCaseCounts() {
    const out = {};
    try {
        const keyOf = window.historyLean && window.historyLean.caseKey;
        if (!keyOf || typeof getUnifiedAllItems !== 'function') return out;
        getUnifiedAllItems().forEach(s => { if (s.submissionType === 'case' && s.status !== 'rejected') { const k = keyOf(s); out[k] = (out[k] || 0) + 1; } });
    } catch (_) { /* grid still renders, all grey */ }
    return out;
}
const sgLevel = n => (n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);

window.renderSubmitSystemGrid = function() {
    const select = document.getElementById('u-case-system');
    const grid = document.getElementById('u-case-system-grid');
    if (!select || !grid) return;
    grid.replaceChildren();
    const counts = sgCaseCounts();
    Array.from(select.options).filter(option => option.value).forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        const chosen = select.value === option.value;
        button.textContent = (chosen ? '✓ ' : '') + option.textContent;
        button.dataset.system = option.value;
        const n = counts[option.value] || 0;
        button.dataset.lv = String(sgLevel(n));
        button.title = n ? n + (n === 1 ? ' case sent' : ' cases sent') : 'none yet';
        if (n) { const badge = document.createElement('b'); badge.className = 'sg-n'; badge.textContent = String(n); button.append(badge); }
        button.setAttribute('aria-pressed', String(chosen));
        button.onclick = () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            renderSubmitSystemGrid();
            Array.from(grid.children).find(item => item.dataset.system === option.value)?.focus();
        };
        grid.append(button);
    });
};
document.addEventListener('DOMContentLoaded', () => {
    renderSubmitSystemGrid();
    const select = document.getElementById('u-case-system');
    if (select) new MutationObserver(renderSubmitSystemGrid).observe(select, { childList: true, subtree: true });
});
