/* V101.267: Journal tour — four short scenes that tell an intern what the Journal (today) is and what a 🎓 Note (one lesson to keep,
   graded by an admin, kept in My Notes) is. Mockup pick 2026-11-05: Thai first with a small English line, shown once per device the first
   time Mission ▸ Journal is on screen (existing interns too), replayed from a quiet "?" next to the date. CSS-only animation; with
   prefers-reduced-motion the scenes are still cards. Reads nothing and writes nothing but its own localStorage flag. */
(function () {
    'use strict';
    var SEEN_KEY = 'journalTourSeen', seenThisLoad = false;
    function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return seenThisLoad; } }
    function markSeen() { seenThisLoad = true; try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* storage may be blocked (LIFF) */ } }

    var css = ''
        + '.jt-replay{flex:none;width:20px;height:20px;min-width:0;min-height:0;margin:0 0 0 6px;padding:0;border:1px solid #e9e2f3;border-radius:50%;background:transparent;color:#b6a8cc;font-weight:700;font-size:11px;line-height:18px;font-family:inherit;text-align:center;cursor:pointer;box-shadow:none;opacity:.8}'
        + '.jt-replay:hover,.jt-replay:focus-visible{color:#6b21a8;border-color:#c4b5fd;opacity:1}'
        + '#journalTour{position:fixed;inset:0;z-index:140000;font-family:inherit}'
        + '#journalTour .jt-ring{position:fixed;border-radius:14px;box-shadow:0 0 0 2px #a78bfa,0 0 0 4000px rgba(30,16,60,.58);transition:all .25s ease;animation:jt-pulse 1.6s ease-in-out infinite;pointer-events:none}'
        + '@keyframes jt-pulse{0%,100%{box-shadow:0 0 0 2px #a78bfa,0 0 0 4000px rgba(30,16,60,.58)}50%{box-shadow:0 0 0 5px #c4b5fd,0 0 0 4000px rgba(30,16,60,.58)}}'
        + '#journalTour .jt-tip{position:fixed;left:10px;right:10px;max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:12px 14px 10px;box-shadow:0 12px 32px rgba(30,16,60,.35);color:#2e1065;animation:jt-in .3s ease-out both}'
        + '@keyframes jt-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
        + '#journalTour .jt-tip::before{content:"";position:absolute;left:var(--ax,40px);width:14px;height:14px;background:#fff;transform:rotate(45deg)}'
        + '#journalTour .jt-tip.up::before{top:-6px}#journalTour .jt-tip.down::before{bottom:-6px}#journalTour .jt-tip.over::before{display:none}'
        + '#journalTour .jt-step{font-size:11px;font-weight:800;letter-spacing:.06em;color:#8b5cf6;text-transform:uppercase}'
        + '#journalTour .jt-t{margin:2px 0 4px;font-size:16px;font-weight:800;color:#4c1d95}'
        + '#journalTour .jt-b{margin:0;font-size:13.5px;line-height:1.55;color:#3f3355}'
        + '#journalTour .jt-en{margin:4px 0 0;font-size:11.5px;color:#8a7fa3}'
        + '#journalTour .jt-vs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 2px;font-size:12px;line-height:1.35}'
        + '#journalTour .jt-vs div{border-radius:10px;padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155}'
        + '#journalTour .jt-vs div.on{background:#faf5ff;border-color:#d8b4fe;color:#4c1d95}'
        + '#journalTour .jt-vs b{display:block;font-size:13px}'
        + '#journalTour .jt-foot{display:flex;align-items:center;gap:8px;margin-top:10px}'
        + '#journalTour .jt-dots{display:flex;gap:5px;flex:1}'
        + '#journalTour .jt-dots i{width:6px;height:6px;border-radius:50%;background:#ddd6fe}'
        + '#journalTour .jt-dots i.on{width:16px;border-radius:4px;background:#7c3aed}'
        + '#journalTour button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#journalTour .jt-skip{border:none;background:none;color:#8a7fa3;font-weight:700;font-size:13px;padding:6px 8px}'
        + '#journalTour .jt-back{border:none;background:none;color:#7c3aed;font-weight:800;font-size:13px;padding:6px 6px}'
        + '#journalTour button:focus{outline:none}#journalTour button:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}'
        + '#journalTour .jt-next{border:none;background:#7c3aed;color:#fff;font-weight:800;font-size:13px;padding:8px 16px;border-radius:999px}'
        + '#journalTour .jt-finger{position:fixed;font-size:26px;pointer-events:none;animation:jt-tap 1.4s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}'
        + '@keyframes jt-tap{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-4px,-6px) scale(.92)}55%{transform:translate(-4px,-6px) scale(.85)}}'
        + '#journalTour .jt-admin{display:flex;align-items:center;gap:8px;margin:8px 0 4px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}'
        + '#journalTour .jt-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;flex:none}'
        + '#journalTour .jt-pts{display:flex;gap:4px;flex-wrap:wrap}'
        + '#journalTour .jt-pts span{border:1.5px solid #a78bfa;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:800;color:#6d28d9;background:#fff}'
        + '#journalTour .jt-pts span.on{animation:jt-pick 2.4s ease-in-out infinite}'
        + '@keyframes jt-pick{0%,45%{background:#fff;color:#6d28d9}55%,100%{background:#7c3aed;color:#fff}}'
        + '#journalTour .jt-stars{color:#f59e0b;font-size:14px;letter-spacing:1px;white-space:nowrap}'
        + '#journalTour .jt-stars i{font-style:normal;animation:jt-star 2.4s steps(1) infinite}'
        + '#journalTour .jt-stars i:nth-child(2){animation-delay:.15s}#journalTour .jt-stars i:nth-child(3){animation-delay:.3s}#journalTour .jt-stars i:nth-child(4){animation-delay:.45s}'
        + '@keyframes jt-star{0%,50%{color:#e5e7eb}51%,100%{color:#f59e0b}}'
        + '#journalTour .jt-sample{display:inline-block;margin-left:auto;font-size:10px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:6px;padding:0 5px;align-self:flex-start}'
        + '#journalTour .jt-notes{display:flex;flex-direction:column;gap:5px;margin:8px 0 4px}'
        + '#journalTour .jt-notes div{display:flex;align-items:center;gap:6px;padding:6px 9px;border-radius:10px;background:#faf5ff;border:1px solid #e9d5ff;font-size:12px;font-weight:700;color:#4c1d95;animation:jt-slide 2.8s ease-out infinite both}'
        + '#journalTour .jt-notes div:nth-child(2){animation-delay:.2s}#journalTour .jt-notes div:nth-child(3){animation-delay:.4s}'
        + '#journalTour .jt-notes small{margin-left:auto;font-size:10px;font-weight:700;color:#be123c;background:#fff1f2;border-radius:99px;padding:0 6px}'
        + '@keyframes jt-slide{0%{opacity:0;transform:translateX(-10px)}15%,100%{opacity:1;transform:none}}'
        + '@media (prefers-reduced-motion: reduce){#journalTour *,#journalTour *::before{animation:none!important;transition:none!important}#journalTour .jt-finger{display:none}#journalTour .jt-pts span.on{background:#7c3aed;color:#fff}}';

    var dots = function (n) { var h = '<div class="jt-dots" aria-hidden="true">'; for (var i = 1; i <= 4; i++) h += '<i class="' + (i === n ? 'on' : '') + '"></i>'; return h + '</div>'; };
    // Each scene: what to ring (first match that is on screen), and the card. Numbers here are the code's (+0.1 daily, 90 notes).
    var SCENES = [
        { ring: ['#dc-hero', '#dc-day'], html: '<div class="jt-step">1 / 4 · Journal</div><p class="jt-t" id="jt-title">📝 บันทึกวันนี้</p>'
            + '<p class="jt-b">เลือกอารมณ์ แล้วเล่าสั้น ๆ ว่าวันนี้ <b>ได้เรียนอะไร · ติดอะไร · จะทำอะไรต่อ</b> ส่งได้วันละครั้ง ได้ <b>+0.1</b></p>'
            + '<p class="jt-en">Today’s diary — once a day.</p>' },
        { ring: ['#dc-note'], finger: true, html: '<div class="jt-step">2 / 4 · Note</div><p class="jt-t" id="jt-title">🎓 จด 1 เรื่องที่อยากจำ</p>'
            + '<p class="jt-b">แถวนี้ไม่ใช่บันทึกประจำวัน ใช้จด<b>เรื่องเดียว</b>ที่อยากเก็บไว้อ่านซ้ำ แตะแล้วตั้ง<b>หัวข้อ</b>และ<b>แท็ก</b>ได้</p>'
            + '<div class="jt-vs"><div><b>📝 Learned</b>วันนี้ทำอะไรมา</div><div class="on"><b>🎓 Note</b>เรื่องที่อยากจำ</div></div>'
            + '<p class="jt-en">One lesson worth keeping — give it a title and tags.</p>' },
        { ring: ['#dc-note'], html: '<div class="jt-step">3 / 4 · Review</div><p class="jt-t" id="jt-title">👩‍⚕️ แอดมินอ่านและให้คะแนน</p>'
            + '<div class="jt-admin"><span class="jt-av" aria-hidden="true">🧑‍🏫</span><div><div class="jt-pts"><span>0.2</span><span class="on">0.5</span><span>1.0</span></div>'
            + '<div class="jt-stars" aria-hidden="true"><i>★</i><i>★</i><i>★</i><i>★</i>☆</div></div><span class="jt-sample">ตัวอย่าง</span></div>'
            + '<p class="jt-b">ได้ <b>+0.1</b> ทันทีถ้าวันนั้นยังไม่ได้ส่งอะไร ส่วนคะแนนเพิ่มจะได้<b>หลังแอดมินตรวจ</b> ยิ่งเขียนชัดและมีเหตุผล ยิ่งได้มาก</p>'
            + '<p class="jt-en">An admin reads every note and may add points.</p>' },
        { ring: ['#dc-note'], html: '<div class="jt-step">4 / 4 · My Notes</div><p class="jt-t" id="jt-title">📚 โน้ตเก็บไว้ใน My Notes</p>'
            + '<div class="jt-notes" aria-hidden="true"><div>🎓 Cold chain วัคซีน <small>Vaccine</small></div><div>🎓 Paracetamol เด็ก <small>Dose</small></div><div>🎓 จัดเก็บยาตาม FEFO <small>Storage</small></div></div>'
            + '<p class="jt-b">แตะแถว 🎓 แล้วเลื่อนลง จะเห็นโน้ตทั้งหมด กรองตามแท็กได้ เก็บได้สูงสุด <b>90 โน้ต</b></p>'
            + '<p class="jt-en">ดูซ้ำได้ที่ปุ่ม ? เล็ก ๆ ข้างวันที่ · Replay with the ? by the date.</p>' }
    ];

    var root = null, cur = 0, lastFocus = null, raf = 0;
    function shown(el) { if (!el || el.closest('[hidden]')) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function targetRect(sc) {
        var els = sc.ring.map(function (s) { return document.querySelector(s); }).filter(shown);
        if (!els.length) return null;
        var rs = els.map(function (e) { return e.getBoundingClientRect(); });
        return { l: Math.min.apply(null, rs.map(function (r) { return r.left; })), t: Math.min.apply(null, rs.map(function (r) { return r.top; })),
                 r: Math.max.apply(null, rs.map(function (r) { return r.right; })), b: Math.max.apply(null, rs.map(function (r) { return r.bottom; })) };
    }
    function place() {
        raf = 0;
        if (!root) return;
        var sc = SCENES[cur], r = targetRect(sc), ring = root.querySelector('.jt-ring'), tip = root.querySelector('.jt-tip'), finger = root.querySelector('.jt-finger');
        var vh = window.innerHeight, vw = window.innerWidth, pad = 4;
        if (!r) { ring.style.display = 'none'; setSide(tip, 'over'); tip.style.top = Math.max(16, (vh - tip.offsetHeight) / 2) + 'px'; tip.style.bottom = ''; return; }
        ring.style.display = '';
        ring.style.left = (r.l - pad) + 'px'; ring.style.top = (r.t - pad) + 'px'; ring.style.width = (r.r - r.l + pad * 2) + 'px'; ring.style.height = (r.b - r.t + pad * 2) + 'px';
        var th = tip.offsetHeight, gap = 14, below = vh - r.b - gap, above = r.t - gap;
        if (below >= th + 8) { setSide(tip, 'up'); tip.style.top = (r.b + gap) + 'px'; tip.style.bottom = ''; }
        else if (above >= th + 8) { setSide(tip, 'down'); tip.style.top = (r.t - gap - th) + 'px'; tip.style.bottom = ''; }
        else { setSide(tip, 'over'); tip.style.top = ''; tip.style.bottom = '12px'; }
        var tl = tip.getBoundingClientRect().left;
        tip.style.setProperty('--ax', Math.max(18, Math.min(tip.offsetWidth - 32, (r.l + r.r) / 2 - tl - 7)) + 'px');
        if (finger) { finger.style.left = Math.min(vw - 40, r.l + (r.r - r.l) * 0.55) + 'px'; finger.style.top = (r.t + Math.min(30, (r.b - r.t) / 2)) + 'px'; }
    }
    function setSide(tip, side) { tip.classList.remove('up', 'down', 'over'); tip.classList.add(side); }
    function schedule() { if (!raf) raf = requestAnimationFrame(place); }
    function render() {
        var sc = SCENES[cur], last = cur === SCENES.length - 1;
        root.innerHTML = '<div class="jt-ring" aria-hidden="true"></div>' + (sc.finger ? '<div class="jt-finger" aria-hidden="true">👆</div>' : '')
            + '<div class="jt-tip" role="dialog" aria-modal="true" aria-labelledby="jt-title" aria-live="polite">' + sc.html
            + '<div class="jt-foot">' + dots(cur + 1)
            + (cur > 0 ? '<button type="button" class="jt-back" data-jt="back" aria-label="ย้อนกลับ">‹</button>' : '')
            + (last ? '' : '<button type="button" class="jt-skip" data-jt="skip">ข้าม</button>')
            + '<button type="button" class="jt-next" data-jt="next">' + (last ? 'เข้าใจแล้ว ✓' : 'ถัดไป ›') + '</button></div></div>';
        var t = document.querySelector(sc.ring[0]);
        var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (t && shown(t)) {
            var b = t.getBoundingClientRect();
            if (b.top < 60 || b.bottom > window.innerHeight - 200) t.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        }
        place();
        setTimeout(place, reduce ? 0 : 400);   // after a smooth scroll settles
        var next = root.querySelector('.jt-next'); if (next) next.focus({ preventScroll: true });
    }
    function close() {
        if (!root) return;
        root.remove(); root = null;
        window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function onKey(e) {
        if (!root) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (e.key === 'Tab') {   // keep focus inside the card
            var f = [].slice.call(root.querySelectorAll('button')); if (!f.length) return;
            var i = f.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
    }
    function go(d) { var n = cur + d; if (n < 0) return; if (n >= SCENES.length) return close(); cur = n; render(); }
    function open() {
        if (root) return;
        if (!document.getElementById('dc-note')) return;
        markSeen();
        if (!document.getElementById('jt-style')) { var st = document.createElement('style'); st.id = 'jt-style'; st.textContent = css; document.head.appendChild(st); }
        lastFocus = document.activeElement; cur = 0;
        root = document.createElement('div'); root.id = 'journalTour'; root.className = 'lang-no-toggle';   // lang-toggle.js would wrap the Thai in .lang-th and hide it in EN mode
        root.addEventListener('click', function (e) { var b = e.target.closest('[data-jt]'); if (!b) return; var a = b.getAttribute('data-jt'); if (a === 'skip') close(); else go(a === 'back' ? -1 : 1); });
        document.body.appendChild(root);
        window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true); document.addEventListener('keydown', onKey, true);
        render();
    }
    window.openJournalTour = open;

    // never stack on another popup: the intern guide, the 🧭 Know thyself sheet, the article popup — anything showing as a modal dialog
    function guideOpen() {
        var g = document.getElementById('internGuideOverlay'); if (g && g.classList.contains('open')) return true;
        if (['art-back', 'fbr-back', 'cm-back', 'kt-back', 'ord-back'].some(function (id) { return document.getElementById(id); })) return true;   // the same popups knowthyself-nudge.js waits for
        return [].some.call(document.querySelectorAll('[aria-modal="true"], #kt-sheet'), function (d) { return !d.closest('#journalTour') && shown(d); });
    }
    function appShown() { var m = document.getElementById('main-app'); return !!m && getComputedStyle(m).display !== 'none'; }
    function init() {
        var pane = document.getElementById('rl-reflection-pane'), date = pane && pane.querySelector('#dc-hero .dc-date');
        if (!pane || !date) return;   // daily-canvas.js did not build the Journal
        if (!document.getElementById('jt-style')) { var st = document.createElement('style'); st.id = 'jt-style'; st.textContent = css; document.head.appendChild(st); }
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'jt-replay'; btn.id = 'jt-replay'; btn.textContent = '?';
        btn.title = 'วิธีใช้ Journal และ Note · How Journal works'; btn.setAttribute('aria-label', 'วิธีใช้ Journal และ Note');
        btn.onclick = open;
        date.after(btn);
        if (seen() || !('IntersectionObserver' in window)) return;
        var timer = 0;
        var io = new IntersectionObserver(function (entries) {
            var vis = entries.some(function (en) { return en.isIntersecting; });
            clearTimeout(timer);
            if (!vis) return;
            // wait a moment so a quick scroll past does not trigger it, and never on top of the guide or before the app shows
            timer = setTimeout(function () {
                if (seen()) { io.disconnect(); return; }
                if (!appShown() || guideOpen() || document.hidden || !shown(document.getElementById('dc-note'))) return;
                io.disconnect(); open();
            }, 900);
        }, { threshold: 0.5 });
        io.observe(document.getElementById('dc-note'));
        // the guide closing while the Journal is already on screen: look again
        var recheck = function () {
            if (seen()) { document.removeEventListener('click', recheck, true); return; }
            if (!root) setTimeout(function () { var n = document.getElementById('dc-note'); io.unobserve(n); io.observe(n); }, 300);
        };
        document.addEventListener('click', recheck, true);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
    else setTimeout(init, 0);
})();
