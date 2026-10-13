// V101.88: the ⋯ menu on the Submit New type rail (Drug / Disease / Product). Closes on an outside click, on Esc, after a pick, and whenever the modal (re)opens.
(function () {
    const pop = () => document.getElementById('u-more-pop'), btn = () => document.getElementById('u-more-btn');
    function setOpen(open) {
        const p = pop(), b = btn();
        if (!p || !b) return;
        p.hidden = !open;
        b.setAttribute('aria-expanded', String(open));
    }
    window.closeSubmitMore = () => setOpen(false);
    document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('#u-more-btn')) { const p = pop(); setOpen(!!p && p.hidden); return; }
        setOpen(false);   // a menu item, a chip, or anywhere else
    });
    document.addEventListener('keydown', e => {
        const p = pop();
        if (e.key === 'Escape' && p && !p.hidden) { setOpen(false); btn() && btn().focus(); }
    });
})();
