/* V102.141: AI API Settings — Model Defaults rows show only the chosen chip; tap it (or ▾) to open the full rail.
   ai-model-ui.js owns the chips and their click handlers; this only opens / closes the row. */
(function () {
    'use strict';
    function init() {
        var modal = document.getElementById('aiKeysModal');
        if (!modal) return;
        modal.querySelectorAll('.ais-mrow').forEach(function (row) {
            var wasActive = false;
            // capture runs before the chip's own onclick, which flips .active — so remember the state it had
            row.addEventListener('click', function (e) {
                var chip = e.target.closest('.text-ai-chips > button');
                wasActive = !!chip && chip.classList.contains('active');
            }, true);
            row.addEventListener('click', function (e) {
                if (e.target.closest('.ais-more')) { row.classList.toggle('open'); return; }
                if (!e.target.closest('.text-ai-chips > button')) return;
                row.classList.toggle('open', wasActive ? !row.classList.contains('open') : false);
            });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
