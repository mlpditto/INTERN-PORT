/* Admin guide modal — renders admin-guide.md (single source) one section at a time behind a chip rail.
   Opened by the ❓ header button (openAdminGuide) and once automatically after the first admin login.
   Standalone overlay (z-index 150000) so it stays above any open editor modal. */
(function () {
    'use strict';
    var SEEN_KEY = 'adminGuideSeen', MD_URL = 'admin-guide.md';
    var sections = [], cur = 0, opened = false, loading = null, overlay = null;

    function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return false; } }
    function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* storage may be blocked */ } }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    var css = '#adminGuideOverlay{position:fixed;inset:0;z-index:150000;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:16px}' +
        '#adminGuideOverlay.open{display:flex}' +
        '#adminGuideOverlay .ag-box{background:var(--bg-card,#fff);color:var(--text-main,#1e293b);width:100%;max-width:760px;max-height:calc(100vh - 32px);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}' +
        '#adminGuideOverlay .ag-head{display:flex;align-items:center;gap:10px;padding:12px 18px 4px}' +
        '#adminGuideOverlay .ag-title{flex:1;margin:0;font-size:1.1em;font-weight:900}' +
        '#adminGuideOverlay .ag-close{width:auto;min-height:0;border:none;background:transparent;color:var(--text-sub,#64748b);font-size:20px;line-height:1;cursor:pointer;padding:0 4px}' +
        '#adminGuideOverlay .ag-head,#adminGuideOverlay .ag-rail{flex:0 0 auto}' +
        '#adminGuideOverlay .ag-rail.ag-scrolled{box-shadow:0 1px 0 var(--border-color,#e2e8f0)}' +
        '#adminGuideOverlay .ag-rail{display:flex;gap:6px;overflow-x:auto;padding:2px 18px 8px}' +
        '#adminGuideOverlay .ag-chip{width:auto;min-height:0;flex:0 0 auto;white-space:nowrap;border:1px solid var(--border-color,#e2e8f0);border-color:color-mix(in srgb,var(--text-sub,#64748b) 45%,transparent);background:transparent;color:var(--text-sub,#64748b);border-radius:999px;padding:5px 12px;font-size:.8em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#adminGuideOverlay .ag-chip[aria-pressed="true"]{background:var(--primary,#4361ee);border-color:var(--primary,#4361ee);color:#fff}' +
        '#adminGuideOverlay .ag-body{overflow-y:auto;padding:6px 18px 18px;font-size:.9em;line-height:1.55}' +
        '#adminGuideOverlay .ag-body h2{display:none}' +
        '#adminGuideOverlay .ag-body h3{margin:16px 0 6px;font-size:1em}' +
        '#adminGuideOverlay .ag-body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:.92em}' +
        '#adminGuideOverlay .ag-body th,#adminGuideOverlay .ag-body td{border:1px solid var(--border-color,#e2e8f0);padding:6px 8px;text-align:left;vertical-align:top}' +
        '#adminGuideOverlay .ag-body th{background:var(--col-bg,#f1f5f9)}' +
        '#adminGuideOverlay .ag-body code{background:var(--col-bg,#f1f5f9);padding:1px 5px;border-radius:5px}' +
        '#adminGuideOverlay .ag-body blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--primary,#4361ee);color:var(--text-sub,#64748b)}' +
        '#adminGuideOverlay .ag-body hr{display:none}' +
        '#adminGuideOverlay .ag-nav{display:flex;justify-content:space-between;gap:8px;margin-top:18px;padding-top:12px;border-top:1px solid var(--border-color,#e2e8f0)}' +
        '#adminGuideOverlay .ag-go{width:auto;min-height:0;white-space:nowrap;border:1px solid var(--primary,#4361ee);background:transparent;color:var(--primary,#4361ee);border-radius:999px;padding:6px 14px;font-size:.85em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#adminGuideOverlay .ag-go.next{margin-left:auto}';

    function parse(md) {
        var out = [], c = null;
        md.split(/\r?\n/).forEach(function (line) {
            var m = /^## (.+)/.exec(line);
            if (m) { c = { title: m[1], lines: [] }; out.push(c); }
            else if (c) c.lines.push(line);
        });
        return out.map(function (s) {
            return { chip: s.title.replace(/^\d+\.\s*/, '').replace(/\s*[—(].*$/, '').trim() || s.title, md: s.lines.join('\n') };
        });
    }

    function html(md) {
        if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(md));
        return '<pre style="white-space:pre-wrap">' + esc(md) + '</pre>';
    }

    function load() {
        if (sections.length) return Promise.resolve();
        if (loading) return loading;
        var v = (document.title.match(/V\d+\.\d+/) || [''])[0];
        loading = fetch(MD_URL + (v ? '?v=' + v : '')).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (t) { sections = parse(t); }).finally(function () { loading = null; });
        return loading;
    }

    function build() {
        if (overlay) return;
        var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        overlay = document.createElement('div');
        overlay.id = 'adminGuideOverlay';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Admin guide');
        overlay.innerHTML = '<div class="ag-box lang-no-toggle"><div class="ag-head"><h2 class="ag-title">❓ คู่มือ Admin</h2>' +
            '<button type="button" class="ag-close" aria-label="Close">&times;</button></div>' +
            '<div class="ag-rail"></div><div class="ag-body lang-no-toggle"></div></div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target.closest('.ag-close')) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
        overlay.querySelector('.ag-rail').addEventListener('click', function (e) {
            var b = e.target.closest('.ag-chip'); if (b) show(+b.dataset.i);
        });
        var bodyEl = overlay.querySelector('.ag-body');
        bodyEl.addEventListener('click', function (e) {
            var g = e.target.closest('.ag-go'); if (g) show(+g.dataset.go);
        });
        // the rail's divider only shows once the content has scrolled under it
        bodyEl.addEventListener('scroll', function () {
            overlay.querySelector('.ag-rail').classList.toggle('ag-scrolled', bodyEl.scrollTop > 0);
        });
    }

    function show(i) {
        cur = i;
        overlay.querySelector('.ag-rail').innerHTML = sections.map(function (s, k) {
            return '<button type="button" class="ag-chip" data-i="' + k + '" aria-pressed="' + (k === i) + '">' + esc(s.chip) + '</button>';
        }).join('');
        var body = overlay.querySelector('.ag-body');
        var on = overlay.querySelector('.ag-chip[aria-pressed="true"]');
        if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
        var nav = '<div class="ag-nav">' +
            (i > 0 ? '<button type="button" class="ag-go" data-go="' + (i - 1) + '">&lsaquo; ' + esc(sections[i - 1].chip) + '</button>' : '') +
            (i < sections.length - 1 ? '<button type="button" class="ag-go next" data-go="' + (i + 1) + '">' + esc(sections[i + 1].chip) + ' &rsaquo;</button>' : '') + '</div>';
        body.innerHTML = html(sections[i].md) + nav;
        body.scrollTop = 0;
        overlay.querySelector('.ag-rail').classList.remove('ag-scrolled');
    }

    function open() {
        build();
        overlay.classList.add('open');
        overlay.querySelector('.ag-body').textContent = '…';
        load().then(function () {
            var map = sections.findIndex(function (s) { return /แผนที่แท็บ/.test(s.chip); });
            show(opened ? cur : (map > -1 ? map : 0));
            opened = true;
        }).catch(function (e) {
            overlay.querySelector('.ag-body').textContent = 'Could not load the guide (' + e.message + ').';
        });
    }

    function close() { if (overlay) overlay.classList.remove('open'); markSeen(); }

    window.openAdminGuide = open;

    // First login: the dashboard container flips from hidden to shown once auth succeeds.
    function maybeAutoOpen() {
        var d = document.getElementById('dashboard-container');
        if (d && getComputedStyle(d).display !== 'none' && !seen()) { markSeen(); setTimeout(open, 600); return true; }
        return false;
    }
    function watch() {
        var d = document.getElementById('dashboard-container');
        if (!d || seen() || maybeAutoOpen()) return;
        var mo = new MutationObserver(function () { if (maybeAutoOpen()) mo.disconnect(); });
        mo.observe(d, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
