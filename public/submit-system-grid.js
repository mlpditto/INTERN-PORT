window.renderSubmitSystemGrid = function() {
    const select = document.getElementById('u-case-system');
    const grid = document.getElementById('u-case-system-grid');
    if (!select || !grid) return;
    grid.replaceChildren();
    Array.from(select.options).filter(option => option.value).forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        const chosen = select.value === option.value;
        button.textContent = (chosen ? '✓ ' : '') + option.textContent;
        button.dataset.system = option.value;
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
