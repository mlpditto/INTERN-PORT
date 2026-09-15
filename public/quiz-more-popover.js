/* Keep row actions above table overflow boundaries without moving their handlers. */
(() => {
    let active;
    function place() {
        if (!active) return;
        const { menu, panel, trigger } = active;
        if (!menu.isConnected) { panel.hidePopover(); active = null; return; }
        const rect = trigger.getBoundingClientRect(), gap = 8;
        const width = Math.min(280, window.innerWidth - gap * 2);
        panel.style.width = width + 'px';
        panel.style.maxHeight = Math.max(44, window.innerHeight - gap * 2) + 'px';
        const height = panel.getBoundingClientRect().height;
        const below = rect.bottom + 5;
        const top = below + height <= window.innerHeight - gap ? below : Math.max(gap, rect.top - height - 5);
        panel.style.left = Math.max(gap, Math.min(rect.right - width, window.innerWidth - width - gap)) + 'px';
        panel.style.top = Math.min(top, Math.max(gap, window.innerHeight - height - gap)) + 'px';
    }
    document.addEventListener('toggle', event => {
        const menu = event.target;
        if (!menu.matches?.('details.quiz-more-menu')) return;
        const panel = menu.querySelector('.quiz-more-menu-body'), trigger = menu.querySelector('summary');
        if (!panel || !panel.showPopover) return;
        trigger.setAttribute('aria-expanded', String(menu.open));
        if (!menu.open) { panel.hidePopover(); if (active?.menu === menu) active = null; return; }
        if (active && active.menu !== menu) { active.panel.hidePopover(); active.menu.open = false; }
        panel.setAttribute('popover', 'manual');
        panel.classList.add('quiz-actions-popover');
        panel.showPopover(); active = { menu, panel, trigger }; place();
    }, true);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && active) { const {menu, trigger} = active; menu.open = false; trigger.focus(); event.preventDefault(); }
    });
})();
