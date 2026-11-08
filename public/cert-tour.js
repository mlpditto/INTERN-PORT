/* V101.294: Certificate how-to (owner pick A) — the first time the 🏅 ring turns into the 🎓 request button (points gate reached, or the
   last day of the internship), two short scenes: ⋯ opens the details, then 🎓 in the gold ring sends the request. Once per device;
   never on top of another popup. Reads nothing and writes nothing but its own localStorage flag. index.html calls window.certTourMaybe(). */
(function () {
    'use strict';
    var SEEN_KEY = 'certTourSeen', seenThisLoad = false;
    function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return seenThisLoad; } }
    function markSeen() { seenThisLoad = true; try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* storage may be blocked (LIFF) */ } }

    var css = ''
        + '#certTour{position:fixed;inset:0;z-index:140000;font-family:inherit}'
        + '#certTour .ct-ring{position:fixed;border-radius:999px;box-shadow:0 0 0 3px #fbbf24,0 0 0 4000px rgba(15,23,42,.58);transition:all .25s ease;animation:ct-pulse 1.6s ease-in-out infinite;pointer-events:none}'
        + '@keyframes ct-pulse{0%,100%{box-shadow:0 0 0 3px #fbbf24,0 0 0 4000px rgba(15,23,42,.58)}50%{box-shadow:0 0 0 6px #fde68a,0 0 0 4000px rgba(15,23,42,.58)}}'
        + '#certTour .ct-tip{position:fixed;left:10px;right:10px;max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:11px 14px 10px;box-shadow:0 12px 32px rgba(15,23,42,.35);color:#1e293b;animation:ct-in .25s ease}'
        + '@keyframes ct-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
        + '#certTour .ct-t{margin:0 0 3px;font-size:15.5px;font-weight:800;color:#92400e}'
        + '#certTour .ct-b{margin:0;font-size:13.5px;line-height:1.5}'
        + '#certTour .ct-en{margin:3px 0 0;font-size:11.5px;color:#94a3b8}'
        + '#certTour .ct-foot{display:flex;align-items:center;gap:8px;margin-top:9px}'
        + '#certTour .ct-n{flex:1;font-size:11px;font-weight:800;color:#d97706}'
        + '#certTour button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#certTour .ct-skip{border:none;background:none;color:#94a3b8;font-weight:700;font-size:13px;padding:6px 8px}'
        + '#certTour .ct-next{border:none;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#fff;font-weight:800;font-size:13px;padding:8px 16px;border-radius:999px}'
        + '#certTour button:focus{outline:none}#certTour button:focus-visible{outline:2px solid #fbbf24;outline-offset:2px}'
        + '#certTour .ct-finger{position:fixed;font-size:26px;pointer-events:none;animation:ct-tap 1.3s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}'
        + '@keyframes ct-tap{0%,100%{transform:none}45%{transform:translate(-3px,-5px) scale(.88)}}'
        + '@media (prefers-reduced-motion: reduce){#certTour *{animation:none!important;transition:none!important}}';

    var SCENES = [
        { ring: '#activity-more', html: '<p class="ct-t" id="ct-title">🎓 ขอใบ Cert ได้แล้ว!</p><p class="ct-b">แตะ <b>⋯</b> เพื่อเปิดรายละเอียด</p>'
            + '<p class="ct-en">You can request your certificate — tap ⋯</p>' },
        { ring: '#badge-cert', open: true, html: '<p class="ct-t" id="ct-title">แตะ 🎓 ในวงทอง</p><p class="ct-b">ส่งคำขอใบ Cert · แอดมินได้รับแจ้งทันที แล้ววงจะเป็น ⏳</p>'
            + '<p class="ct-en">Tap 🎓 to request — the admin is told at once.</p>' }
    ];

    var root = null, cur = 0, raf = 0, lastFocus = null;
    function shown(el) { if (!el || el.closest('[hidden]')) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function place() {
        raf = 0;
        if (!root) return;
        var el = document.querySelector(SCENES[cur].ring), ring = root.querySelector('.ct-ring'), tip = root.querySelector('.ct-tip'), fin = root.querySelector('.ct-finger');
        var vh = window.innerHeight, pad = 5;
        if (!shown(el)) { ring.style.display = 'none'; fin.style.display = 'none'; tip.style.top = Math.max(16, (vh - tip.offsetHeight) / 2) + 'px'; return; }
        var r = el.getBoundingClientRect();
        ring.style.display = ''; fin.style.display = '';
        ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px'; ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
        var th = tip.offsetHeight, gap = 16;
        tip.style.top = (vh - r.bottom - gap >= th + 8 ? r.bottom + gap : Math.max(8, r.top - gap - th)) + 'px';
        fin.style.left = Math.min(window.innerWidth - 36, r.left + r.width * 0.55) + 'px'; fin.style.top = (r.top + r.height * 0.55) + 'px';
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(place); }
    function render() {
        var sc = SCENES[cur], last = cur === SCENES.length - 1;
        if (sc.open) {   // scene 2 needs the details panel open — open it the way a tap on ⋯ does
            var more = document.getElementById('activity-more');
            if (more && more.getAttribute('aria-expanded') !== 'true') more.click();
        }
        root.innerHTML = '<div class="ct-ring" aria-hidden="true"></div><div class="ct-finger" aria-hidden="true">👆</div>'
            + '<div class="ct-tip" role="dialog" aria-modal="true" aria-labelledby="ct-title">' + sc.html
            + '<div class="ct-foot"><span class="ct-n">' + (cur + 1) + ' / ' + SCENES.length + '</span>'
            + (last ? '' : '<button type="button" class="ct-skip" data-ct="skip">ข้าม</button>')
            + '<button type="button" class="ct-next" data-ct="next">' + (last ? 'เข้าใจแล้ว ✓' : 'ถัดไป ›') + '</button></div></div>';
        var t = document.querySelector(sc.ring);
        if (t && shown(t)) { var b = t.getBoundingClientRect(); if (b.top < 60 || b.bottom > window.innerHeight - 180) t.scrollIntoView({ block: 'center' }); }
        place(); setTimeout(place, 350);
        var n = root.querySelector('.ct-next'); if (n) n.focus({ preventScroll: true });
    }
    function close() {
        if (!root) return;
        root.remove(); root = null;
        window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function onKey(e) { if (!root) return; if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(); } }
    function go() { if (cur >= SCENES.length - 1) return close(); cur++; render(); }
    function open() {
        if (root) return;
        markSeen();
        if (!document.getElementById('ct-style')) { var st = document.createElement('style'); st.id = 'ct-style'; st.textContent = css; document.head.appendChild(st); }
        lastFocus = document.activeElement; cur = 0;
        root = document.createElement('div'); root.id = 'certTour'; root.className = 'lang-no-toggle';
        root.addEventListener('click', function (e) { var b = e.target.closest('[data-ct]'); if (!b) return; if (b.getAttribute('data-ct') === 'skip') close(); else go(); });
        document.body.appendChild(root);
        window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true); document.addEventListener('keydown', onKey, true);
        render();
    }

    // never on top of another popup, never before the app shows, never in a background tab — try again a little later
    function busy() {
        var m = document.getElementById('main-app'); if (!m || getComputedStyle(m).display === 'none') return true;
        var g = document.getElementById('internGuideOverlay'); if (g && g.classList.contains('open')) return true;
        if (['art-back', 'fbr-back', 'cm-back', 'kt-back', 'ord-back', 'journalTour'].some(function (id) { return document.getElementById(id); })) return true;
        return document.hidden || [].some.call(document.querySelectorAll('[aria-modal="true"], #kt-sheet'), function (d) { return !d.closest('#certTour') && shown(d); });
    }
    var waiting = 0;
    window.certTourMaybe = function () {
        if (seen() || root || waiting) return;
        var tries = 0;
        (function attempt() {
            waiting = 0;
            if (seen() || root) return;
            if (!busy() && shown(document.getElementById('activity-more'))) return open();
            if (++tries < 40) waiting = setTimeout(attempt, 1500);
        })();
    };
    window.openCertTour = open;
})();
