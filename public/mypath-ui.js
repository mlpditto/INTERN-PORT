// V102.137: Poneglyph → My Path. The four zero-counters become a QUEUE of what to do today; "＋ New" gets "from a drug / disease / memory" chips that
// prefill the entry; the empty editor invites a first note; the AI model rail folds behind one chip. Read-only over existing data
// (window._lp.entries, dcaState.codex / drug_codex, disease_codex, casesData, eventsCache) — the only write is the normal "Save entry".
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var today = function () { return new Date().toISOString().split('T')[0]; };   // same day key as computeLpStats
    var drugs = null, diseases = null, loading = {};

    function once(key, col, setter) {
        if (loading[key]) return; loading[key] = true;
        if (typeof db === 'undefined' || !db) { setter([]); return; }
        db.collection(col).get().then(function (s) { setter(s.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); })); })
            .catch(function () { setter([]); }).then(function () { renderAll(); });
    }
    function drugList() {
        if (typeof dcaState !== 'undefined' && dcaState.codex && dcaState.codex.length) return dcaState.codex;
        if (drugs === null) once('drugs', 'drug_codex', function (a) { drugs = a; });
        return drugs;   // null while loading
    }
    function diseaseList() {
        if (typeof dxaState !== 'undefined' && dxaState.codex && dxaState.codex.length) return dxaState.codex;
        if (diseases === null) once('diseases', 'disease_codex', function (a) { diseases = a; });
        return diseases;
    }
    var pctOf = function (d) { try { return dcaCompletenessScore(d).pct; } catch (_) { return 0; } };
    var chip = function (pct) { var c = typeof dcaCompletenessColor === 'function' ? dcaCompletenessColor(pct) : { bg: '#eef2f7', fg: '#64748b', bd: '#cbd5e1' }; return '<span class="lpn-pc" style="background:' + c.bg + ';color:' + c.fg + ';border-color:' + c.bd + '">' + pct + '%</span>'; };

    // ---------- data for the cards ----------
    function dueList() { var t = today(); return ((window._lp && window._lp.entries) || []).filter(function (e) { return e.nextReviewDate && e.nextReviewDate <= t; }).sort(function (a, b) { return a.nextReviewDate > b.nextReviewDate ? 1 : -1; }); }
    function pendingCases() { return (typeof casesData !== 'undefined' ? casesData || [] : []).filter(function (c) { return !c.isArchived && (c.status || 'pending') === 'pending'; }); }
    function memories() {
        var pm = window._pm && window._pm.loaded ? window._pm.items : null;
        if (pm) return pm.slice();
        var t = today();
        return (typeof eventsCache !== 'undefined' ? eventsCache || [] : []).filter(function (e) { return e.badge && e.eventDate && e.eventDate <= t; })
            .map(function (e) { return { id: e.id, title: e.title, eventDate: e.eventDate }; }).sort(function (a, b) { return String(b.eventDate).localeCompare(String(a.eventDate)); });
    }
    var daysLate = function (d) { return Math.round((new Date(today()) - new Date(d)) / 86400000); };

    // ---------- the queue ----------
    function card(cls, label, big, sub, btn, act) {
        return '<div class="lpq-c ' + cls + '"><small>' + label + '</small><b>' + big + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + (btn ? '<button type="button" class="lpq-b" data-act="' + act + '">' + btn + '</button>' : '') + '</div>';
    }
    function renderQueue() {
        var strip = $('lp-stats-strip'); if (!strip) return;
        var q = $('lp-queue'); if (!q) { q = document.createElement('div'); q.id = 'lp-queue'; strip.insertBefore(q, strip.firstChild); }
        var cards = [], due = dueList(), dl = drugList(), cases = pendingCases(), mem = memories()[0];
        if (due.length) { var late = daysLate(due[0].nextReviewDate); cards.push(card('hot', '📖 Review today', due.length + ' due', 'oldest: ' + esc((due[0].title || '(untitled)').slice(0, 38)) + (late > 0 ? ' · ' + late + ' d late' : ''), 'Start review', 'review')); }
        else cards.push('<div class="lpq-ok" title="No entry is due for review today">📖 Review today · ✓ nothing due</div>');
        if (dl === null) cards.push(card('', '💊 Fill the gaps', '…', '', '', ''));
        else {
            var inc = dl.map(function (d) { return { d: d, p: pctOf(d) }; }).filter(function (x) { return x.p < 90; }).sort(function (a, b) { return a.p - b.p; });
            if (inc.length) cards.push(card('', '💊 Fill the gaps', inc.length + ' incomplete', 'lowest: ' + esc(inc[0].d.genericName || '') + ' ' + inc[0].p + '%', 'Open list', 'drugs'));
            else if (dl.length) cards.push('<div class="lpq-ok">💊 Drug Codex · ✓ every drug ≥ 90%</div>');
        }
        if (cases.length) cards.push(card('', '📥 New cases', cases.length + ' waiting', 'for review in Alabasta', 'Open inbox', 'cases'));
        else cards.push('<div class="lpq-ok">📥 Cases · ✓ none waiting</div>');
        if (mem) cards.push(card('', '🎟️ Latest memory', esc(String(mem.title || '').slice(0, 26)) || '—', esc(mem.eventDate || ''), 'View', 'memories'));
        var g = function (id) { var e = $(id); return e ? e.textContent : '0'; };
        q.innerHTML = '<div class="lpq-top"><span>🔥 ' + g('lp-stat-streak') + ' day streak</span><span>' + g('lp-stat-total') + ' entries</span><span>' + g('lp-stat-weeks') + ' weeks active</span></div><div class="lpq-row">' + cards.join('') + '</div>';
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest('#lp-queue [data-act]'); if (!b) return;
        var a = b.dataset.act;
        if (a === 'review') { var d = dueList()[0]; if (d && typeof selectLpEntry === 'function') selectLpEntry(d.id); }
        else if (a === 'drugs' && typeof openDrugCodexAdmin === 'function') openDrugCodexAdmin();
        else if (a === 'cases' && typeof openAlabastaInbox === 'function') openAlabastaInbox();
        else if (a === 'memories' && typeof lpSetView === 'function') lpSetView('memories');
    });

    // ---------- "＋ New" → from a drug / disease / memory ----------
    var SOURCES = {
        drug: { label: '💊 Drug', list: drugList, name: function (x) { return x.genericName || ''; }, sub: function (x) { return [x.atcCode, x.class].filter(Boolean).join(' · '); }, pct: pctOf,
            entry: function (x) { return { title: (x.genericName || '') + ' — ', tags: 'drug, ' + (x.genericName || ''), body: '## ' + (x.genericName || '') + '\n- ATC: ' + (x.atcCode || '—') + '\n- Class: ' + (x.class || '—') + '\n- Brands: ' + ((x.brandNames || []).join(', ') || '—') + '\n\n' }; } },
        disease: { label: '🩺 Disease', list: diseaseList, name: function (x) { return x.diseaseName || ''; }, sub: function (x) { return [x.icd10, x.category].filter(Boolean).join(' · '); },
            entry: function (x) { return { title: (x.diseaseName || '') + ' — ', tags: 'disease, ' + (x.diseaseName || ''), body: '## ' + (x.diseaseName || '') + (x.thaiName ? ' (' + x.thaiName + ')' : '') + '\n- ICD-10: ' + (x.icd10 || '—') + '\n- Category: ' + (x.category || '—') + '\n\n' }; } },
        memory: { label: '🎟️ Memory', list: function () { return memories(); }, name: function (x) { return x.title || ''; }, sub: function (x) { return x.eventDate || ''; },
            entry: function (x) { return { title: (x.title || 'Event') + ' — what I took away', tags: 'memory', body: '## ' + (x.title || '') + '\n- Date: ' + (x.eventDate || '—') + '\n\n' }; } }
    };
    function startEntry(kind, x) {
        if (typeof createLpEntry !== 'function') return;
        createLpEntry();
        var e = SOURCES[kind].entry(x), set = function (id, v) { var el = $(id); if (el) el.value = v; };
        set('lp-entry-title', e.title); set('lp-entry-tags', e.tags); set('lp-entry-content', e.body);
        var st = $('lp-save-status'); if (st) st.textContent = 'New entry · from ' + kind;
        var t = $('lp-entry-title'); if (t && t.focus) { t.focus(); var n = t.value.length; if (t.setSelectionRange) t.setSelectionRange(n, n); }
        closePick();
    }
    function ensureNewRow() {
        var col = $('lp-feed-col'); if (!col || $('lp-newrow')) return;
        var row = document.createElement('div'); row.id = 'lp-newrow';
        row.innerHTML = '<small>＋ New from</small>' + Object.keys(SOURCES).map(function (k) { return '<button type="button" class="lpn-chip" data-from="' + k + '">' + SOURCES[k].label + '</button>'; }).join('') + '<div id="lp-pick" hidden><input type="text" placeholder="Search…" autocomplete="off"><div class="lpn-list"></div></div>';
        var head = col.firstElementChild; head.after(row);
    }
    var pickKind = null;
    function closePick() { var p = $('lp-pick'); if (p) p.hidden = true; pickKind = null; document.querySelectorAll('#lp-newrow .lpn-chip').forEach(function (c) { c.classList.remove('on'); }); }
    function paintPick() {
        var p = $('lp-pick'); if (!p || !pickKind) return;
        var S = SOURCES[pickKind], list = S.list(), q = p.querySelector('input').value.trim().toLowerCase(), box = p.querySelector('.lpn-list');
        if (list === null) { box.innerHTML = '<div class="lpn-empty">Loading…</div>'; return; }
        var rows = list.filter(function (x) { return !q || (S.name(x) + ' ' + S.sub(x)).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
        box._rows = rows;
        box.innerHTML = rows.length ? rows.map(function (x, i) { return '<button type="button" class="lpn-item" data-i="' + i + '"><b>' + esc(S.name(x)) + '</b><small>' + esc(S.sub(x)) + '</small>' + (S.pct ? chip(S.pct(x)) : '') + '</button>'; }).join('') : '<div class="lpn-empty">Nothing matches.</div>';
    }
    document.addEventListener('click', function (e) {
        var c = e.target.closest('#lp-newrow .lpn-chip');
        if (c) { var k = c.dataset.from; if (pickKind === k) { closePick(); return; } closePick(); pickKind = k; c.classList.add('on'); var p = $('lp-pick'); p.hidden = false; p.querySelector('input').value = ''; paintPick(); p.querySelector('input').focus(); return; }
        var it = e.target.closest('#lp-pick .lpn-item');
        if (it) { var box = it.parentElement; startEntry(pickKind, box._rows[+it.dataset.i]); return; }
        if (!e.target.closest('#lp-pick')) closePick();
    });
    document.addEventListener('input', function (e) { if (e.target.closest('#lp-pick')) paintPick(); });
    document.addEventListener('keydown', function (e) {
        if (!pickKind) return;
        if (e.key === 'Escape') closePick();
        else if (e.key === 'Enter' && e.target.closest('#lp-pick')) { var box = $('lp-pick').querySelector('.lpn-list'); if (box._rows && box._rows[0]) startEntry(pickKind, box._rows[0]); }
    });

    // ---------- the empty editor invites a first note ----------
    function renderInvites() {
        var box = $('lp-editor-empty'); if (!box) return;
        var dl = drugList(), dz = diseaseList(), mem = memories()[0], inv = [];
        if (dl && dl.length) { var low = dl.map(function (d) { return { d: d, p: pctOf(d) }; }).sort(function (a, b) { return a.p - b.p; })[0]; inv.push(['drug', low.d, '💊 ' + esc(low.d.genericName || ''), low.p + '% complete', 'Add what you know, then log what you learned']); }
        if (dz && dz.length) { var z = dz.slice().sort(function (a, b) { var f = function (x) { var t = x.updatedAt; return t && t.toMillis ? t.toMillis() : 0; }; return f(b) - f(a); })[0]; inv.push(['disease', z, '🩺 ' + esc(z.diseaseName || ''), 'in Codex', 'Start a note from the disease page']); }
        if (mem) inv.push(['memory', mem, '🎟️ ' + esc(mem.title || ''), esc(mem.eventDate || ''), 'Reflect on what you took away']);
        if (!inv.length) return;
        box.classList.add('lpn-invites'); box._inv = inv;
        box.innerHTML = '<div class="lpn-h">📖 Select an entry — or start one</div>' + inv.map(function (v, i) { return '<div class="lpn-inv"><b>' + v[2] + ' <span>' + v[3] + '</span></b><small>' + v[4] + '</small><button type="button" class="lpq-b" data-inv="' + i + '">＋ Log</button></div>'; }).join('');
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest('#lp-editor-empty [data-inv]'); if (!b) return;
        var v = $('lp-editor-empty')._inv[+b.dataset.inv]; if (v) startEntry(v[0], v[1]);
    });

    // ---------- the AI model rail folds behind one chip ----------
    function modelChip() {
        var strip = $('lp-path-strip'), acts = strip && strip.querySelector('.lp-strip-actions'), input = $('lp-ai-model'); if (!acts || !input) return;
        var b = $('lpn-model'); if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'lpn-model'; b.className = 'lp-act sec'; b.setAttribute('aria-expanded', 'false'); b.title = 'AI model for the path — click to change'; acts.insertBefore(b, acts.firstChild); }
        var id = input.value, name = window.aiModelShortName ? window.aiModelShortName(id) : id;
        b.innerHTML = (window.aiModelLogoHtml ? window.aiModelLogoHtml(id) : '✨') + '<span></span>'; b.lastChild.textContent = name || '';
    }
    document.addEventListener('click', function (e) {
        var strip = $('lp-path-strip'); if (!strip) return;
        if (e.target.closest('#lpn-model')) { var open = strip.classList.toggle('lpn-models-open'); $('lpn-model').setAttribute('aria-expanded', String(open)); return; }
        if (e.target.closest('#lp-model-row .text-ai-chips button')) setTimeout(function () { modelChip(); strip.classList.remove('lpn-models-open'); var m = $('lpn-model'); if (m) m.setAttribute('aria-expanded', 'false'); }, 0);
    });

    function renderAll() { renderQueue(); renderInvites(); modelChip(); }
    function init() {
        ensureNewRow();
        var orig = window.computeLpStats;
        if (typeof orig === 'function') window.computeLpStats = function () { var r = orig.apply(this, arguments); renderAll(); return r; };
        var tab = $('tab-poneglyph');
        if (tab && window.MutationObserver) new MutationObserver(function () { if (tab.classList.contains('active')) renderAll(); }).observe(tab, { attributes: true, attributeFilter: ['class'] });
        renderAll(); setTimeout(modelChip, 600);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.lpQueueRefresh = renderAll;
})();
