/* Intern guide modal — renders intern-guide.en.md / intern-guide.md (TH) one section at a time behind a chip rail; EN is the default,
   the EN | TH chips in the header switch language (remembered per browser). Both files keep the same ## sections in the same order.
   Opened by the 📖 Guide button in Settings (openInternGuide) and once automatically the first time the main app shows.
   Standalone overlay (z-index 150000) so it stays above any open editor modal. */
(function () {
    'use strict';
    var SEEN_KEY = 'internGuideSeen', LANG_KEY = 'internGuideLang', MD_URL = { en: 'intern-guide.en.md', th: 'intern-guide.md' };
    var T = { en: { title: '📖 Guide', fail: 'Could not load the guide' }, th: { title: '📖 คู่มือการใช้งาน', fail: 'โหลดคู่มือไม่สำเร็จ' } };
    var docs = { en: null, th: null }, sections = [], lang = getLang(), cur = 0, opened = false, loading = {}, overlay = null;

    // own choice wins; otherwise follow the app's language toggle (TH on = Thai guide), else EN-first
    function getLang() { try { var v = localStorage.getItem(LANG_KEY); if (v === 'th' || v === 'en') return v; return localStorage.getItem('uiLangTH') === '1' ? 'th' : 'en'; } catch (_) { return 'en'; } }
    function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return false; } }
    function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* storage may be blocked */ } }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    var css = '#internGuideOverlay{position:fixed;inset:0;z-index:150000;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:16px}' +
        '#internGuideOverlay.open{display:flex}' +
        '#internGuideOverlay .ig-box{background:var(--bg-card,#fff);color:var(--text-main,#1e293b);width:100%;max-width:760px;max-height:calc(100vh - 32px);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}' +
        '#internGuideOverlay .ig-head{display:flex;align-items:center;gap:10px;padding:12px 18px 4px}' +
        '#internGuideOverlay .ig-title{flex:1;margin:0;font-size:1.1em;font-weight:900}' +
        '#internGuideOverlay .ig-close{width:auto;min-height:0;border:none;background:transparent;color:var(--text-sub,#64748b);font-size:20px;line-height:1;cursor:pointer;padding:0 4px}' +
        '#internGuideOverlay .ig-head,#internGuideOverlay .ig-rail{flex:0 0 auto}' +
        '#internGuideOverlay .ig-lang{display:flex;gap:4px}' +
        '#internGuideOverlay .ig-l{width:auto;min-height:0;border:1px solid var(--border-color,#e2e8f0);border-color:color-mix(in srgb,var(--text-sub,#64748b) 45%,transparent);background:transparent;color:var(--text-sub,#64748b);border-radius:999px;padding:2px 9px;font-size:.72em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#internGuideOverlay .ig-l[aria-pressed="true"]{background:var(--text-main,#1e293b);border-color:var(--text-main,#1e293b);color:var(--bg-card,#fff)}' +
        '#internGuideOverlay .ig-rail.ig-scrolled{box-shadow:0 1px 0 var(--border-color,#e2e8f0)}' +
        '#internGuideOverlay .ig-rail{display:flex;gap:6px;overflow-x:auto;padding:2px 18px 8px}' +
        '#internGuideOverlay .ig-chip{width:auto;min-height:0;flex:0 0 auto;white-space:nowrap;border:1px solid var(--border-color,#e2e8f0);border-color:color-mix(in srgb,var(--text-sub,#64748b) 45%,transparent);background:transparent;color:var(--text-sub,#64748b);border-radius:999px;padding:5px 12px;font-size:.8em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#internGuideOverlay .ig-chip[aria-pressed="true"]{background:var(--primary,#4361ee);border-color:var(--primary,#4361ee);color:#fff}' +
        '#internGuideOverlay .ig-body{overflow-y:auto;padding:6px 18px 18px;font-size:.9em;line-height:1.55}' +
        '#internGuideOverlay .ig-body h2{display:none}' +
        '#internGuideOverlay .ig-body h3{margin:16px 0 6px;font-size:1em}' +
        '#internGuideOverlay .ig-body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:.92em}' +
        '#internGuideOverlay .ig-body th,#internGuideOverlay .ig-body td{border:1px solid var(--border-color,#e2e8f0);padding:6px 8px;text-align:left;vertical-align:top}' +
        '#internGuideOverlay .ig-body th{background:var(--col-bg,#f1f5f9)}' +
        '#internGuideOverlay .ig-body code{background:var(--col-bg,#f1f5f9);padding:1px 5px;border-radius:5px}' +
        '#internGuideOverlay .ig-body blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--primary,#4361ee);color:var(--text-sub,#64748b)}' +
        '#internGuideOverlay .ig-body hr{display:none}' +
        '#internGuideOverlay .ig-nav{display:flex;justify-content:space-between;gap:8px;margin-top:18px;padding-top:12px;border-top:1px solid var(--border-color,#e2e8f0)}' +
        '#internGuideOverlay .ig-go{width:auto;min-height:0;white-space:nowrap;border:1px solid var(--primary,#4361ee);background:transparent;color:var(--primary,#4361ee);border-radius:999px;padding:6px 14px;font-size:.85em;line-height:1.4;font-weight:800;cursor:pointer}' +
        '#internGuideOverlay .ig-go.next{margin-left:auto}';

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
        if (docs[l]) return Promise.resolve();
        if (loading[l]) return loading[l];
        var v = (document.title.match(/V\d+\.\d+/) || [''])[0];
        loading[l] = fetch(MD_URL[l] + (v ? '?v=' + v : '')).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (t) { docs[l] = parse(t); }).finally(function () { loading[l] = null; });
        return loading[l];
    }

    function build() {
        if (overlay) return;
        var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        overlay = document.createElement('div');
        overlay.id = 'internGuideOverlay';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Guide');
        overlay.innerHTML = '<div class="ig-box lang-no-toggle"><div class="ig-head"><h2 class="ig-title"></h2>' +
            '<div class="ig-lang" role="group" aria-label="Language"><button type="button" class="ig-l" data-l="en">EN</button><button type="button" class="ig-l" data-l="th">TH</button></div>' +
            '<button type="button" class="ig-close" aria-label="Close">&times;</button></div>' +
            '<div class="ig-rail"></div><div class="ig-body lang-no-toggle"></div></div>';
        document.body.appendChild(overlay);
        paintLang();
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target.closest('.ig-close')) return close();
            var l = e.target.closest('.ig-l'); if (l) setLang(l.dataset.l);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
        overlay.querySelector('.ig-rail').addEventListener('click', function (e) {
            var b = e.target.closest('.ig-chip'); if (b) show(+b.dataset.i);
        });
        var bodyEl = overlay.querySelector('.ig-body');
        bodyEl.addEventListener('click', function (e) {
            var g = e.target.closest('.ig-go'); if (g) show(+g.dataset.go);
        });
        // the rail's divider only shows once the content has scrolled under it
        bodyEl.addEventListener('scroll', function () {
            overlay.querySelector('.ig-rail').classList.toggle('ig-scrolled', bodyEl.scrollTop > 0);
        });
    }

    function paintLang() {
        overlay.querySelector('.ig-title').textContent = T[lang].title;
        overlay.setAttribute('aria-label', lang === 'th' ? 'คู่มือการใช้งาน' : 'Guide');
        overlay.querySelectorAll('.ig-l').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.l === lang)); });
    }

    function fail(e) { overlay.querySelector('.ig-body').textContent = T[lang].fail + ' (' + e.message + ').'; }

    function setLang(l) {
        if (l === lang) return;
        lang = l;
        try { localStorage.setItem(LANG_KEY, l); } catch (_) { /* storage may be blocked */ }
        paintLang();
        load(l).then(function () { sections = docs[l]; show(Math.min(cur, sections.length - 1)); }).catch(fail);
    }

    function show(i) {
        cur = i;
        overlay.querySelector('.ig-rail').innerHTML = sections.map(function (s, k) {
            return '<button type="button" class="ig-chip" data-i="' + k + '" aria-pressed="' + (k === i) + '">' + esc(s.chip) + '</button>';
        }).join('');
        var body = overlay.querySelector('.ig-body');
        var on = overlay.querySelector('.ig-chip[aria-pressed="true"]');
        if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
        var nav = '<div class="ig-nav">' +
            (i > 0 ? '<button type="button" class="ig-go" data-go="' + (i - 1) + '">&lsaquo; ' + esc(sections[i - 1].chip) + '</button>' : '') +
            (i < sections.length - 1 ? '<button type="button" class="ig-go next" data-go="' + (i + 1) + '">' + esc(sections[i + 1].chip) + ' &rsaquo;</button>' : '') + '</div>';
        body.innerHTML = html(sections[i].md) + nav;
        body.scrollTop = 0;
        overlay.querySelector('.ig-rail').classList.remove('ig-scrolled');
    }

    function open() {
        build();
        overlay.classList.add('open');
        overlay.querySelector('.ig-body').textContent = '…';
        load(lang).then(function () {
            sections = docs[lang];
            show(opened ? cur : 0);
            opened = true;
        }).catch(fail);
    }

    function close() { if (overlay) overlay.classList.remove('open'); markSeen(); }

    window.openInternGuide = open;

    // First visit: #main-app loses its `hidden` class once login succeeds.
    function maybeAutoOpen() {
        var d = document.getElementById('main-app');
        if (d && !d.classList.contains('hidden') && !seen()) { markSeen(); setTimeout(open, 1200); return true; }
        return false;
    }
    function watch() {
        var d = document.getElementById('main-app');
        if (!d || seen() || maybeAutoOpen()) return;
        var mo = new MutationObserver(function () { if (maybeAutoOpen()) mo.disconnect(); });
        mo.observe(d, { attributes: true, attributeFilter: ['class'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
