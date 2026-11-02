/* V102.141: AI API Settings — Model Defaults rows show only the chosen chip; tap it (or ▾) to open the full rail.
   ai-model-ui.js owns the chips and their click handlers; this only opens / closes the row. */
(function () {
    'use strict';
    // V102.571: one tab at a time, so nothing scrolls. Every id stays where it was: this only sorts the existing rows into tabs. Local, Vertex and
    // Usage are the old disclosure rows, opened once through toggleAiAccordion (it lazy-loads Usage); their head row stays for the pill and today's total.
    var TABS = [['keys', '🔑', 'Keys'], ['models', '🎚️', 'Models'], ['local', '🖥️', 'Local'], ['vertex', '☁️', 'Vertex'], ['usage', '📈', 'Usage']];
    var KEY_IDS = ['gemini', 'openai', 'anthropic', 'typhoon', 'llama', 'openrouter'];
    function initTabs(modal) {
        var scroll = modal.querySelector('.ais-scroll'), head = scroll.querySelector('.ais-head'), cur = 'keys';
        Array.prototype.forEach.call(scroll.children, function (el) {
            if (el === head) return;
            if (el.classList.contains('ais-sec') && el.querySelector('.fa-sliders')) cur = 'models';
            var acc = el.classList.contains('ais-acc') && el.querySelector('div[id^="acc-"]');
            el.dataset.aisTab = acc ? acc.id.slice(4) : cur;
        });
        // V102.573 (owner's pick C): Keys and Models side by side on a wide screen; a phone keeps them as tabs (the columns are display:contents there)
        var cols = document.createElement('div'), left = document.createElement('div'), right = document.createElement('div');
        cols.className = 'ais-cols'; left.className = right.className = 'ais-col';
        cols.append(left, right);
        var wide = window.matchMedia('(min-width:900px)'), first = scroll.querySelector('[data-ais-tab="keys"]'), tabNow = 'keys';
        first.before(cols);
        Array.prototype.slice.call(scroll.children).forEach(function (el) {
            if (el.dataset.aisTab === 'keys') left.append(el); else if (el.dataset.aisTab === 'models') right.append(el);
        });
        var bar = document.createElement('div');
        bar.className = 'ais-tabs'; bar.setAttribute('role', 'tablist');
        bar.innerHTML = TABS.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '">' + t[1] + ' ' + t[2] + (t[0] === 'keys' ? ' <b></b>' : '') + '</button>'; }).join('');
        head.after(bar);
        scroll.classList.add('ais-tabbed');
        function count() {
            var n = KEY_IDS.filter(function (k) { var i = document.getElementById('local-' + k + '-key'); return i && i.value.trim(); }).length;
            bar.querySelector('b').textContent = n + '/' + KEY_IDS.length;
        }
        function show(tab) {
            if (tab === 'models' && wide.matches) tab = 'keys';
            tabNow = tab;
            var both = tab === 'keys' && wide.matches;
            scroll.querySelectorAll('[data-ais-tab]').forEach(function (el) { el.classList.toggle('ais-off', el.dataset.aisTab !== tab && !(both && el.dataset.aisTab === 'models')); });
            Array.prototype.forEach.call(bar.children, function (b) { var on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
            var body = document.getElementById('acc-' + tab);
            if (body && body.style.display === 'none' && typeof window.toggleAiAccordion === 'function') window.toggleAiAccordion('acc-' + tab);
            scroll.scrollTop = 0; count();
        }
        bar.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
        wide.addEventListener('change', function () { show(tabNow); });
        modal.addEventListener('input', count);
        modal.querySelector('.ais-go').addEventListener('click', function () { setTimeout(count, 0); });   // Quick Paste fills the fields without an input event
        // every open starts on Keys, with the saved keys counted
        new MutationObserver(function () { if (modal.style.display !== 'none') show('keys'); }).observe(modal, { attributes: true, attributeFilter: ['style'] });
        show('keys');
    }
    function init() {
        var modal = document.getElementById('aiKeysModal');
        if (!modal) return;
        initTabs(modal);
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
