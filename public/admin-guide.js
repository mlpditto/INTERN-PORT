/* Admin guide modal — renders admin-guide.en.md / admin-guide.md (TH) / admin-guide.ko.md one section at a time behind a chip rail; EN is the default,
   the EN | TH | KO chips in the header switch language (remembered per browser). Both files keep the same ## sections in the same order.
   Opened by the 📖 header button (openAdminGuide) and once automatically after the first admin login.
   Standalone overlay (z-index 150000) so it stays above any open editor modal. */
(function () {
    'use strict';
    // V102.301: the same overlay serves two guide SETS — 'admin' (📖 header button, auto-opens once) and 'deck' (the 🏴‍☠️ Grand Line Deck
    // badge: images · video · audio · research). Each set has its own three markdown files, title, first section and cursor.
    var SETS = {
        admin: { md: { en: 'admin-guide.en.md', th: 'admin-guide.md', ko: 'admin-guide.ko.md' }, title: { en: '📖 Admin guide', th: '📖 คู่มือ Admin', ko: '📖 관리자 가이드' }, aria: { en: 'Admin guide', th: 'คู่มือ Admin', ko: '관리자 가이드' }, first: 2 },
        deck: { md: { en: 'grand-line-guide.en.md', th: 'grand-line-guide.md', ko: 'grand-line-guide.ko.md' }, title: { en: '🏴‍☠️ Grand Line Deck — how to', th: '🏴‍☠️ วิธีใช้ Grand Line Deck', ko: '🏴‍☠️ Grand Line Deck 사용법' }, aria: { en: 'Grand Line Deck guide', th: 'คู่มือ Grand Line Deck', ko: 'Grand Line Deck 안내' }, first: 0 }
    };
    var set = 'admin', docsBySet = { admin: { en: null, th: null, ko: null }, deck: { en: null, th: null, ko: null } }, curBySet = { admin: 0, deck: 0 }, openedBySet = { admin: false, deck: false };
    var SEEN_KEY = 'adminGuideSeen', LANG_KEY = 'adminGuideLang';
    var T = { en: { fail: 'Could not load the guide' }, th: { fail: 'โหลดคู่มือไม่สำเร็จ' }, ko: { title: '📖 관리자 가이드', fail: '가이드를 불러오지 못했습니다' } };
    var sections = [], lang = getLang(), cur = 0, loading = {}, overlay = null;

    function getLang() { try { var l = localStorage.getItem(LANG_KEY); return l === 'th' || l === 'ko' ? l : 'en'; } catch (_) { return 'en'; } }
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
        '#adminGuideOverlay .ag-lang{display:flex;gap:4px}' +
        '#adminGuideOverlay .ag-l{width:auto;min-height:0;border:1px solid var(--border-color,#e2e8f0);border-color:color-mix(in srgb,var(--text-sub,#64748b) 45%,transparent);background:transparent;color:var(--text-sub,#64748b);border-radius:999px;padding:2px 9px;font-size:.72em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#adminGuideOverlay .ag-l[aria-pressed="true"]{background:var(--text-main,#1e293b);border-color:var(--text-main,#1e293b);color:var(--bg-card,#fff)}' +
        '#adminGuideOverlay .ag-rail.ag-scrolled{box-shadow:0 1px 0 var(--border-color,#e2e8f0)}' +
        '#adminGuideOverlay .ag-rail{display:flex;gap:6px;overflow-x:auto;padding:2px 18px 8px}' +
        '#adminGuideOverlay .ag-chip{width:auto;min-height:0;flex:0 0 auto;white-space:nowrap;border:1px solid var(--border-color,#e2e8f0);border-color:color-mix(in srgb,var(--text-sub,#64748b) 45%,transparent);background:transparent;color:var(--text-sub,#64748b);border-radius:999px;padding:5px 12px;font-size:.8em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#adminGuideOverlay .ag-chip[aria-pressed="true"]{background:var(--primary,#4361ee);border-color:var(--primary,#4361ee);color:#fff}' +
        '#adminGuideOverlay .ag-body{overflow-y:auto;padding:6px 18px 18px;font-size:.9em;line-height:1.55}' +
        '#adminGuideOverlay .ag-body h2{display:none}' +
        '#adminGuideOverlay .ag-body h3{margin:16px 0 6px;font-size:1em}' +
        // V102.529 (owner): a long section (tab map, Jev) must not need scrolling — every ### block folds under its heading, one open at a time
        '#adminGuideOverlay .ag-folds{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}' +
        '#adminGuideOverlay .ag-fold{border:1px solid var(--border-color,#e2e8f0);border-radius:10px;margin:0;padding:0 10px;min-width:0}' +
        '#adminGuideOverlay .ag-fold[open]{grid-column:1 / -1}' +
        '@media (max-width:600px){#adminGuideOverlay .ag-folds{grid-template-columns:1fr}}' +
        '#adminGuideOverlay .ag-fold[open]{padding-bottom:6px}' +
        '#adminGuideOverlay .ag-fold>summary{cursor:pointer;font-weight:800;padding:6px 0;list-style:none;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#adminGuideOverlay .ag-fold>summary::-webkit-details-marker{display:none}' +
        '#adminGuideOverlay .ag-fold>summary::before{content:"\\203A";display:inline-block;width:10px;color:var(--text-sub,#64748b);transition:transform .15s}' +
        '#adminGuideOverlay .ag-fold[open]>summary::before{transform:rotate(90deg)}' +
        '#adminGuideOverlay .ag-body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:.92em}' +
        '#adminGuideOverlay .ag-body img{display:block;max-width:100%;height:auto;margin:10px 0;border:1px solid var(--border-color,#e2e8f0);border-radius:10px}' +
        '#adminGuideOverlay .ag-body th,#adminGuideOverlay .ag-body td{border:1px solid var(--border-color,#e2e8f0);padding:4px 8px;text-align:left;vertical-align:top}' +   /* V102.529: 4px rows — the tab map must fit beside its folds */
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

    function load(l) {
        var key = set + ':' + l, docs = docsBySet[set];
        if (docs[l]) return Promise.resolve();
        if (loading[key]) return loading[key];
        var v = (document.title.match(/V\d+\.\d+/) || [''])[0];
        loading[key] = fetch(SETS[set].md[l] + (v ? '?v=' + v : '')).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (t) { docs[l] = parse(t); }).finally(function () { loading[key] = null; });
        return loading[key];
    }

    function build() {
        if (overlay) return;
        var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        overlay = document.createElement('div');
        overlay.id = 'adminGuideOverlay';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Admin guide');
        overlay.innerHTML = '<div class="ag-box lang-no-toggle"><div class="ag-head"><h2 class="ag-title"></h2>' +
            '<div class="ag-lang" role="group" aria-label="Language"><button type="button" class="ag-l" data-l="en">EN</button><button type="button" class="ag-l" data-l="th">TH</button><button type="button" class="ag-l" data-l="ko">KO</button></div>' +
            '<button type="button" class="ag-close" aria-label="Close">&times;</button></div>' +
            '<div class="ag-rail"></div><div class="ag-body lang-no-toggle"></div></div>';
        document.body.appendChild(overlay);
        paintLang();
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target.closest('.ag-close')) return close();
            var l = e.target.closest('.ag-l'); if (l) setLang(l.dataset.l);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
        overlay.querySelector('.ag-rail').addEventListener('click', function (e) {
            var b = e.target.closest('.ag-chip'); if (b) show(+b.dataset.i);
        });
        var bodyEl = overlay.querySelector('.ag-body');
        bodyEl.addEventListener('click', function (e) {
            var g = e.target.closest('.ag-go'); if (g) show(+g.dataset.go);
            // V102.529: opening one fold closes the others (the click itself toggles the one tapped)
            var sm = e.target.closest('.ag-fold > summary');
            if (sm && !sm.parentElement.open) bodyEl.querySelectorAll('.ag-fold[open]').forEach(function (d) { if (d !== sm.parentElement) d.open = false; });
        });
        // the rail's divider only shows once the content has scrolled under it
        bodyEl.addEventListener('scroll', function () {
            overlay.querySelector('.ag-rail').classList.toggle('ag-scrolled', bodyEl.scrollTop > 0);
        });
    }

    function paintLang() {
        overlay.querySelector('.ag-title').textContent = SETS[set].title[lang];
        overlay.setAttribute('aria-label', SETS[set].aria[lang]);
        overlay.dataset.set = set;
        overlay.querySelectorAll('.ag-l').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.l === lang)); });
    }

    function fail(e) { overlay.querySelector('.ag-body').textContent = T[lang].fail + ' (' + e.message + ').'; }

    function setLang(l) {
        if (l === lang) return;
        lang = l;
        try { localStorage.setItem(LANG_KEY, l); } catch (_) { /* storage may be blocked */ }
        paintLang();
        load(l).then(function () { sections = docsBySet[set][l]; show(Math.min(cur, sections.length - 1)); }).catch(fail);
    }

    function show(i) {
        cur = i; curBySet[set] = i;
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
        fold(body);
        body.scrollTop = 0;
        overlay.querySelector('.ag-rail').classList.remove('ag-scrolled');
    }

    // V102.529: wrap each <h3> and what follows it (up to the next <h3> / the ‹ › nav) in a closed <details class="ag-fold"> — the table and intro above the first heading stay in view
    function fold(body) {
        var d = null, grid = null;
        Array.prototype.slice.call(body.childNodes).forEach(function (n) {
            var el = n.nodeType === 1 ? n : null;
            if (el && el.tagName === 'H3') {
                d = document.createElement('details'); d.className = 'ag-fold';
                var sm = document.createElement('summary'); sm.innerHTML = el.innerHTML; sm.title = el.textContent; d.appendChild(sm);
                if (!grid) { grid = document.createElement('div'); grid.className = 'ag-folds'; body.insertBefore(grid, el); }   // consecutive folds share one two-column grid (an open one spans both)
                grid.appendChild(d); el.parentNode.removeChild(el); return;
            }
            if (el && el.classList.contains('ag-nav')) { d = null; grid = null; return; }
            if (d) d.appendChild(n);
        });
    }

    function open(which) {
        build();
        set = SETS[which] ? which : 'admin';
        cur = curBySet[set];
        paintLang();
        overlay.querySelector('.ag-rail').innerHTML = '';
        overlay.classList.add('open');
        overlay.querySelector('.ag-body').textContent = '…';
        load(lang).then(function () {
            sections = docsBySet[set][lang];
            show(openedBySet[set] ? Math.min(cur, sections.length - 1) : Math.min(SETS[set].first, sections.length - 1));   // admin: first open lands on section 2 = the tab map
            openedBySet[set] = true;
        }).catch(fail);
    }

    function close() { if (overlay) overlay.classList.remove('open'); if (set === 'admin') markSeen(); }

    window.openAdminGuide = function () { open('admin'); };
    window.openDeckGuide = function () { open('deck'); };   // V102.301

    // First login: the dashboard container flips from hidden to shown once auth succeeds.
    function maybeAutoOpen() {
        var d = document.getElementById('dashboard-container');
        if (d && getComputedStyle(d).display !== 'none' && !seen()) { markSeen(); setTimeout(function () { open('admin'); }, 600); return true; }
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
