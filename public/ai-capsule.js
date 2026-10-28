// V102.475: busy / done states for the AI capsule segments (🤖 fill, 🔍 review) on the Drug and Disease Codex forms.
//   aiCapBusy(btn, title)       — before the call: disables the segment, shows a flipping ⏳ + the elapsed time, marks the capsule running
//   aiCapEnd(btn, icon, errEl)  — in `finally`: back to the icon; when the form's error box (errEl) is not showing, the capsule flashes ✓ green for ~1.6 s first
// No Stop button: the AI call itself cannot be cancelled.
(function () {
    'use strict';
    var T = new WeakMap();   // button → { iv, to, t0, title }
    var capOf = function (b) { return b && b.closest ? b.closest('.ai-cap') : null; };
    var fmt = function (s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    function clear(b) { var s = T.get(b); if (s) { clearInterval(s.iv); clearTimeout(s.to); } T.delete(b); }
    function rest(b, icon) {
        var cap = capOf(b);
        b.textContent = icon; delete b.dataset.aiState;
        if (cap) delete cap.dataset.aiState;
    }
    window.aiCapBusy = function (btn, title) {
        if (!btn) return;
        var prev = T.get(btn);
        clear(btn);
        if (!btn.dataset.aiIcon) btn.dataset.aiIcon = btn.textContent.trim();
        var st = { t0: Date.now(), title: prev && prev.title != null ? prev.title : btn.title };
        btn.disabled = true; btn.dataset.aiState = 'run';
        btn.innerHTML = '<span class="aic-flip" aria-hidden="true">⏳</span><span class="aic-tm">0:00</span>';
        if (title) btn.title = title;
        var cap = capOf(btn); if (cap) cap.dataset.aiState = 'run';
        st.iv = setInterval(function () { var tm = btn.querySelector('.aic-tm'); if (tm) tm.textContent = fmt(Math.round((Date.now() - st.t0) / 1000)); }, 1000);
        T.set(btn, st);
    };
    window.aiCapEnd = function (btn, icon, errEl) {
        if (!btn) return;
        var st = T.get(btn);
        clear(btn);
        if (st && st.title != null) btn.title = st.title;
        btn.disabled = false;
        icon = icon || btn.dataset.aiIcon || '';
        var failed = !!(errEl && errEl.style.display !== 'none' && String(errEl.textContent || '').trim());
        if (!st || failed) { rest(btn, icon); return; }
        btn.dataset.aiState = 'done'; btn.innerHTML = '<span aria-hidden="true">✓</span>';
        var cap = capOf(btn); if (cap) cap.dataset.aiState = 'done';
        T.set(btn, { to: setTimeout(function () { if (btn.dataset.aiState === 'done') rest(btn, icon); T.delete(btn); }, 1600) });
    };
})();
