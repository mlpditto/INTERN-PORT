// V101.298 🔎 search plan on a reviewed Learning Note (owner pick C, mockup-lnr-plan.html, 2026-11-09).
// The admin sends it from Learning Note Review (admin lnr-ai.js → submissions.searchPlan [{k,t}]). Here, in Work ▸ History,
// the note's detail shows it as a checklist: tick each step as you go (kept on this device), 🧭 Nika asks the library with the
// question, ↗ PubMed opens the query, and ✏️ Update note (lit at n/n) opens a new Learning Note with the old one + what to add.
(function () {
    'use strict';
    var E = { q: '❓', lib: '📚', guide: '📘', pubmed: '🔬', write: '✍️' };
    var KEY = 'lnPlan:';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function steps(s) { return (Array.isArray(s && s.searchPlan) ? s.searchPlan : []).filter(function (x) { return x && E[x.k] && String(x.t || '').trim(); }); }
    function done(id) { try { var v = JSON.parse(localStorage.getItem(KEY + id) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function save(id, v) { try { localStorage.setItem(KEY + id, JSON.stringify(v)); } catch (e) { } }
    function find(id) { return (typeof unifiedSubmissionsCache !== 'undefined' && Array.isArray(unifiedSubmissionsCache) ? unifiedSubmissionsCache : []).find(function (x) { return x.id === id; }); }

    function html(s) {
        var st = steps(s); if (!st.length) return '';
        var d = done(s.id), n = st.filter(function (x, i) { return d.indexOf(i) >= 0; }).length, all = n === st.length;
        var q = (st.find(function (x) { return x.k === 'q'; }) || {}).t || '';
        var rows = st.map(function (x, i) {
            var on = d.indexOf(i) >= 0, go = '';
            if (x.k === 'lib') go = '<button type="button" class="lnp-go" data-act="nika" title="Ask Nika · ถาม Nika">🧭 Nika</button>';
            if (x.k === 'pubmed') go = '<a class="lnp-go" href="https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(x.t) + '" target="_blank" rel="noopener noreferrer" title="Open in PubMed">↗ PubMed</a>';
            return '<div class="lnp-st' + (on ? ' on' : '') + '"><label><input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + ' aria-label="Done: ' + esc(x.t) + '"><b aria-hidden="true">' + E[x.k] + '</b><span>' + (x.k === 'pubmed' ? '<code>' + esc(x.t) + '</code>' : esc(x.t)) + '</span></label>' + go + '</div>';
        }).join('');
        return '<div class="lnp lang-no-toggle" data-id="' + esc(s.id) + '" data-q="' + esc(q) + '" onclick="event.stopPropagation(); lnPlan._click(event)">' +
            '<div class="lnp-h">🔎 Plan <small>' + n + '/' + st.length + '</small></div>' + rows +
            '<div class="lnp-f"><span class="lnp-bar" aria-hidden="true"><i style="width:' + Math.round(n / st.length * 100) + '%"></i></span>' +
            '<button type="button" class="lnp-go lnp-up" data-act="update"' + (all ? '' : ' disabled') + ' title="' + (all ? 'Write the note again with what you found' : 'Tick every step first') + '">✏️ Update note</button></div></div>';
    }

    function repaint(box) {
        var s = find(box.dataset.id); if (!s) return;
        var t = document.createElement('div'); t.innerHTML = html(s);
        if (t.firstChild) box.replaceWith(t.firstChild);
    }

    function askNika(q) {
        if (typeof window.ddSwitchType !== 'function') return;
        var body = document.getElementById('dd-section-content');
        if (body && body.style.display === 'none' && typeof window.toggleDDCodex === 'function') window.toggleDDCodex();
        window.ddSwitchType('nika');
        var tries = 0;
        (function fill() {
            var ta = document.getElementById('nk-question');
            if (!ta) { if (++tries < 40) setTimeout(fill, 100); return; }
            if (!ta.value.trim()) ta.value = q;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.scrollIntoView({ block: 'center' }); ta.focus({ preventScroll: true });
        })();
    }

    function updateNote(s) {
        var st = steps(s), write = (st.find(function (x) { return x.k === 'write'; }) || {}).t || '';
        var text = String(s.description || (s.metadata && s.metadata.content) || '').trim();
        // each step on its own: one that fails (a card not drawn yet) must not stop the note from opening
        var kanban = document.getElementById('kanban-content');
        [function () { window.selectJournalTab('day'); },
         function () { if (kanban && kanban.style.display === 'none') window.toggleKanban(); },
         function () { window.switchMissionTab('reflection'); },
         function () { window.toggleJournalNoteFields(true); }
        ].forEach(function (f) { try { f(); } catch (e) { console.warn('[ln-plan] open note', e && e.message); } });
        setTimeout(function () {
            var title = document.getElementById('lp-note-title'), ta = document.getElementById('dc-note-content') || document.getElementById('rl-content');
            if (title && !title.value.trim()) title.value = '↻ ' + String(s.title || '').replace(/^↻\s*/, '').slice(0, 180);
            if (ta && !ta.value.trim()) ta.value = text + (write ? '\n\n✍️ ' + write + '\n' : '');
            [title, ta].forEach(function (e) { if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
            if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus({ preventScroll: true }); }
        }, 80);
    }

    document.addEventListener('change', function (e) {
        var c = e.target.closest && e.target.closest('.lnp input[data-i]'); if (!c) return;
        var box = c.closest('.lnp'), id = box.dataset.id, d = done(id), i = Number(c.dataset.i);
        d = c.checked ? d.concat(d.indexOf(i) < 0 ? [i] : []) : d.filter(function (x) { return x !== i; });
        save(id, d); repaint(box);
    });
    function onClick(e) {
        var b = e.target.closest && e.target.closest('.lnp [data-act]'); if (!b) return;
        var box = b.closest('.lnp');
        if (b.dataset.act === 'nika') askNika(box.dataset.q);
        if (b.dataset.act === 'update' && !b.disabled) { var s = find(box.dataset.id); if (s) updateNote(s); }
    }

    window.lnPlan = { html: html, _click: onClick, _steps: steps };
})();
