// V102.136: the ⋯ menu on a Drug Codex row is a plain <details> — close it when something else is clicked, when one of its actions runs, or on Esc.
document.addEventListener('click', e => {
    document.querySelectorAll('#dca-list details.dca-more[open]').forEach(d => {
        if (!d.contains(e.target) || e.target.closest('.dca-more-menu button')) d.open = false;
    });
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('#dca-list details.dca-more[open]').forEach(d => { d.open = false; });
});
