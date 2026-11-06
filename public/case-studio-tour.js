/* V102.597 Case Card Studio tour (owner 2026-11-06: "animation สอนที่หน้านี้ แบบ step by step"). The same look as the Journal tour
   (journal-tour.js, owner-approved): a pulsing ring on the part being explained, a card that slides in, a 👆 tapping where you press,
   dots + ‹ ข้าม ถัดไป ›, Thai first with a small English line. Shown once per browser the first time the Studio opens; replayed from
   the "?" beside the title. CSS-only animation (still cards with reduced motion). Reads and writes nothing but its own localStorage flag. */
(function () {
    'use strict';
    var SEEN_KEY = 'caseStudioTourSeen', seenThisLoad = false;
    function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return seenThisLoad; } }
    function markSeen() { seenThisLoad = true; try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* storage blocked */ } }

    var css = ''
        + '.ct-replay{flex:none;width:22px;height:22px;min-width:0;min-height:0;margin:0 0 0 6px;padding:0;border:1px solid #e9e2f3;border-radius:50%;background:transparent;color:#b6a8cc;font-weight:800;font-size:12px;line-height:1;cursor:pointer;opacity:.85}'
        + '.ct-replay:hover,.ct-replay:focus-visible{color:#6b21a8;border-color:#c4b5fd;opacity:1}'
        + '#caseStudioTour{position:fixed;inset:0;z-index:2147483000;font-family:inherit}'
        + '#caseStudioTour .ct-ring{position:fixed;border-radius:14px;box-shadow:0 0 0 2px #f59e0b,0 0 0 4000px rgba(30,16,40,.55);transition:all .3s ease;animation:ct-pulse 1.6s ease-in-out infinite;pointer-events:none}'
        + '@keyframes ct-pulse{0%,100%{box-shadow:0 0 0 2px #f59e0b,0 0 0 4000px rgba(30,16,40,.55)}50%{box-shadow:0 0 0 6px #fcd34d,0 0 0 4000px rgba(30,16,40,.55)}}'
        + '#caseStudioTour .ct-tip{position:fixed;width:min(400px,calc(100vw - 20px));background:#fff;border-radius:16px;padding:12px 14px 10px;box-shadow:0 12px 32px rgba(30,16,40,.35);color:#2d2235;animation:ct-in .3s ease}'
        + '@keyframes ct-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
        + '#caseStudioTour .ct-step{font-size:11px;font-weight:800;letter-spacing:.06em;color:#d97706;text-transform:uppercase}'
        + '#caseStudioTour .ct-t{margin:2px 0 4px;font-size:16px;font-weight:800;color:#7c2d12}'
        + '#caseStudioTour .ct-b{margin:0;font-size:13.5px;line-height:1.55;color:#3f3345}'
        + '#caseStudioTour .ct-en{margin:4px 0 0;font-size:11.5px;color:#8a7f93}'
        + '#caseStudioTour .ct-demo{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0 2px;font-size:12px}'
        + '#caseStudioTour .ct-demo span{border:1.5px solid #e2e8f0;border-radius:999px;padding:2px 9px;background:#fff;color:#334155;font-weight:700}'
        + '#caseStudioTour .ct-demo span.on{animation:ct-pick 2.4s ease-in-out infinite}'
        + '@keyframes ct-pick{0%,45%{background:#fff;color:#334155;border-color:#e2e8f0}55%,100%{background:#1f1726;color:#fff;border-color:#1f1726}}'
        + '#caseStudioTour .ct-demo i{font-style:normal;animation:ct-slide 2.4s ease-in-out infinite;opacity:0}'
        + '#caseStudioTour .ct-demo i:nth-of-type(2){animation-delay:.25s}#caseStudioTour .ct-demo i:nth-of-type(3){animation-delay:.5s}'
        + '@keyframes ct-slide{0%{opacity:0;transform:translateX(-8px)}20%,90%{opacity:1;transform:none}100%{opacity:0}}'
        + '#caseStudioTour .ct-bar{height:6px;border-radius:999px;background:#fde68a;overflow:hidden;margin:8px 0 2px}#caseStudioTour .ct-bar b{display:block;height:100%;width:0;background:#f59e0b;animation:ct-fill 3s ease-in-out infinite}'
        + '@keyframes ct-fill{0%{width:0}80%,100%{width:100%}}'
        + '#caseStudioTour .ct-foot{display:flex;align-items:center;gap:8px;margin-top:10px}'
        + '#caseStudioTour .ct-dots{display:flex;gap:5px;flex:1}#caseStudioTour .ct-dots i{width:6px;height:6px;border-radius:50%;background:#fde68a}#caseStudioTour .ct-dots i.on{width:16px;border-radius:4px;background:#d97706}'
        + '#caseStudioTour button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#caseStudioTour .ct-skip{border:none;background:none;color:#8a7f93;font-weight:700;font-size:13px;padding:6px 8px}'
        + '#caseStudioTour .ct-back{border:none;background:none;color:#d97706;font-weight:800;font-size:13px;padding:6px 6px}'
        + '#caseStudioTour button:focus{outline:none}#caseStudioTour button:focus-visible{outline:2px solid #fcd34d;outline-offset:2px}'
        + '#caseStudioTour .ct-next{border:none;background:#f59e0b;color:#fff;font-weight:800;font-size:13px;padding:8px 16px;border-radius:999px}'
        + '#caseStudioTour .ct-finger{position:fixed;font-size:26px;pointer-events:none;animation:ct-tap 1.4s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}'
        + '@keyframes ct-tap{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-4px,-6px) scale(.92)}55%{transform:translate(-4px,-6px) scale(.85)}}'
        + '@media (prefers-reduced-motion: reduce){#caseStudioTour *{animation:none!important;transition:none!important}#caseStudioTour .ct-finger{display:none}#caseStudioTour .ct-demo i{opacity:1}#caseStudioTour .ct-bar b{width:100%}}';

    // Each step: what to ring (first one on screen wins), whether a 👆 taps it, and the card.
    var STEPS = [
        { ring: ['#alabasta-case-card-step-1 .alabasta-casecard-textarea', '#alabasta-case-card-safe-summary'], t: '① ตรวจสรุปเคส',
          b: 'ระบบลบชื่อ · HN · วันที่ ออกให้แล้ว อ่านทวนอีกรอบ <b>แก้คำได้ทันที</b> ถ้ายังมีอะไรที่บอกตัวผู้ป่วยได้ให้ลบออก', en: 'Check the anonymized summary — edit it freely.' },
        { ring: ['#alabastaCaseCardModal .cs-consent'], finger: true, t: '🛡 ผู้ป่วยยินยอมหรือยัง',
          b: 'ติ๊ก<b>เฉพาะเมื่อผู้ป่วยยินยอม</b> จะใส่ชื่อร้าน/วันที่ได้ และเลขเคสขึ้นที่หัว ไม่แน่ใจ = ไม่ต้องติ๊ก', en: 'Tick only when the patient agreed.' },
        { ring: ['#alabastaCaseCardModal .cs-disp'], t: '💊 ยาที่จ่าย (ไม่ใส่ก็ได้)',
          b: 'พิมพ์ชื่อสามัญ + ความแรง เช่น <b>omeprazole 20 mg</b> จะเขียนบนการ์ดหนึ่งบรรทัด', en: 'The medicine dispensed — optional, one line on the card.' },
        { ring: ['#cs-layout-lbl + .cs-seg'], finger: true, t: '🖼️ เลือกแบบการ์ด',
          demo: '<div class="ct-demo"><span>📊 Case</span><span class="on">🧍 Symptoms</span><span>✅ Self-care</span></div>',
          b: 'แต่ละแบบเล่าคนละมุม: เคสเต็ม · ไลฟ์สไตล์ · อาการบนร่างกาย · ดูแลตัวเอง · มินิมอล', en: 'Pick the template.' },
        { ring: ['#cs-model-lbl + .cs-seg'], finger: true, t: '🤖 เลือก model วาดภาพ',
          b: 'โลโก้ = บริษัท แตะชื่อรุ่นที่อยู่ข้างโลโก้ <b>★ = แนะนำสำหรับแบบที่เลือก</b> ชี้ค้างที่ชื่อรุ่นเพื่อดูคำอธิบาย', en: 'Pick the image model — ★ is the suggestion for this template.' },
        { ring: ['#cs-ask'], finger: true, t: '❓ Ask next (ไม่ใส่ก็ได้)',
          demo: '<div class="ct-demo"><i>🚩 Red flag</i><i>❓ ถามต่อ</i><i>📍 หมุดบนร่างกาย</i></div>',
          b: 'เปิดแล้วกด <b>❓ Draft</b> ให้ AI ร่างคำถามที่ยังต้องถามเพิ่ม แก้ได้ทุกแถว ติ๊ก <b>On the card</b> ถ้าอยากให้ขึ้นบนภาพ (ภาษาอังกฤษ)', en: 'Optional: questions still to ask — AI drafts, you edit.' },
        { ring: ['#alabasta-case-card-generate-btn'], finger: true, t: '✨ สร้างภาพ',
          demo: '<div class="ct-bar" aria-hidden="true"><b></b></div>',
          b: 'กด <b>Generate image</b> รอราว 15–60 วินาที ถ้าแก้อะไรหลังสร้างแล้ว ปุ่มจะเปลี่ยนเป็น Regenerate', en: 'Generate — about 15–60 s.' },
        { ring: ['#alabastaCaseCardModal .case-studio-preview'], t: '✅ ตรวจ แล้วเก็บ',
          demo: '<div class="ct-demo"><span>👍</span><span>👎</span><span class="on">⬇ PNG</span><span>📱 9:16</span><span>📄 PDF</span></div>',
          b: 'ดูภาพให้ถูกต้องก่อน · 👍/👎 ช่วยให้ระบบรู้ว่า model ไหนเหมาะ · ⬇ ดาวน์โหลด · <b>Save draft</b> เก็บไว้ในเคส', en: 'Check it, rate it, download or save. Replay with the ? by the title.' }
    ];

    var root = null, cur = 0, lastFocus = null, raf = 0;
    function shown(el) { if (!el || el.closest('[hidden]')) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function target(st) { for (var i = 0; i < st.ring.length; i++) { var e = document.querySelector(st.ring[i]); if (shown(e)) return e; } return null; }
    function dots(n) { var h = '<div class="ct-dots" aria-hidden="true">'; for (var i = 1; i <= STEPS.length; i++) h += '<i class="' + (i === n ? 'on' : '') + '"></i>'; return h + '</div>'; }
    function place() {
        raf = 0; if (!root) return;
        var st = STEPS[cur], el = target(st), ring = root.querySelector('.ct-ring'), tip = root.querySelector('.ct-tip'), finger = root.querySelector('.ct-finger');
        var vw = window.innerWidth, vh = window.innerHeight, pad = 5, tw = tip.offsetWidth, th = tip.offsetHeight;
        if (!el) { ring.style.display = 'none'; if (finger) finger.style.display = 'none'; tip.style.left = Math.max(10, (vw - tw) / 2) + 'px'; tip.style.top = Math.max(16, (vh - th) / 2) + 'px'; return; }
        var r = el.getBoundingClientRect();
        ring.style.display = ''; ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px'; ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
        // beside the target when there is room (desktop Studio), else below / above, else bottom
        var gap = 16, left, top;
        if (vw - r.right - gap >= tw + 10) { left = r.right + gap; top = Math.min(Math.max(10, r.top), vh - th - 10); }
        else if (r.left - gap >= tw + 10) { left = r.left - gap - tw; top = Math.min(Math.max(10, r.top), vh - th - 10); }
        else if (vh - r.bottom - gap >= th + 10) { left = Math.min(Math.max(10, r.left), vw - tw - 10); top = r.bottom + gap; }
        else if (r.top - gap >= th + 10) { left = Math.min(Math.max(10, r.left), vw - tw - 10); top = r.top - gap - th; }
        else { left = (vw - tw) / 2; top = vh - th - 12; }
        tip.style.left = left + 'px'; tip.style.top = top + 'px';
        if (finger) { finger.style.display = ''; finger.style.left = Math.min(vw - 40, r.left + Math.min(r.width * 0.5, 160)) + 'px'; finger.style.top = (r.top + Math.min(28, r.height / 2)) + 'px'; }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(place); }
    function render() {
        var st = STEPS[cur], last = cur === STEPS.length - 1;
        root.innerHTML = '<div class="ct-ring" aria-hidden="true"></div>' + (st.finger ? '<div class="ct-finger" aria-hidden="true">👆</div>' : '')
            + '<div class="ct-tip" role="dialog" aria-modal="true" aria-labelledby="ct-title" aria-live="polite">'
            + '<div class="ct-step">' + (cur + 1) + ' / ' + STEPS.length + ' · Case Card Studio</div><p class="ct-t" id="ct-title">' + st.t + '</p>'
            + (st.demo || '') + '<p class="ct-b">' + st.b + '</p><p class="ct-en">' + st.en + '</p>'
            + '<div class="ct-foot">' + dots(cur + 1)
            + (cur > 0 ? '<button type="button" class="ct-back" data-ct="back" aria-label="ย้อนกลับ">‹</button>' : '')
            + (last ? '' : '<button type="button" class="ct-skip" data-ct="skip">ข้าม</button>')
            + '<button type="button" class="ct-next" data-ct="next">' + (last ? 'เข้าใจแล้ว ✓' : 'ถัดไป ›') + '</button></div></div>';
        var el = target(st), reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (el) { var b = el.getBoundingClientRect(); if (b.top < 40 || b.bottom > window.innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
        place(); setTimeout(place, reduce ? 0 : 400);
        var n = root.querySelector('.ct-next'); if (n) n.focus({ preventScroll: true });
    }
    function close() {
        if (!root) return;
        root.remove(); root = null;
        window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function onKey(e) {
        if (!root) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }   // stop: Escape must not also close the Studio
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (e.key === 'Tab') {
            var f = [].slice.call(root.querySelectorAll('button')); if (!f.length) return;
            var i = f.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
    }
    function go(d) { var n = cur + d; if (n < 0) return; if (n >= STEPS.length) return close(); cur = n; render(); }
    function style() { if (!document.getElementById('ct-style')) { var s = document.createElement('style'); s.id = 'ct-style'; s.textContent = css; document.head.appendChild(s); } }
    function open() {
        if (root || !studioOpen()) return;
        markSeen(); style();
        lastFocus = document.activeElement; cur = 0;
        root = document.createElement('div'); root.id = 'caseStudioTour'; root.className = 'lang-no-toggle';   // lang-toggle.js would hide the Thai
        root.addEventListener('click', function (e) { var b = e.target.closest('[data-ct]'); if (!b) return; var a = b.getAttribute('data-ct'); if (a === 'skip') close(); else go(a === 'back' ? -1 : 1); });
        document.body.appendChild(root);
        window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true); document.addEventListener('keydown', onKey, true);
        render();
    }
    window.openCaseStudioTour = open;
    function studioOpen() { var m = document.getElementById('alabastaCaseCardModal'); return !!m && shown(m) && getComputedStyle(m).display !== 'none'; }
    function init() {
        var m = document.getElementById('alabastaCaseCardModal'), title = m && m.querySelector('.alabasta-casecard-title');
        if (!m || !title || document.getElementById('ct-replay')) return;
        style();
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'ct-replay'; btn.id = 'ct-replay'; btn.textContent = '?';
        btn.title = 'วิธีใช้ Case Card Studio · How it works'; btn.setAttribute('aria-label', 'วิธีใช้ Case Card Studio');
        btn.onclick = open;
        title.appendChild(btn);
        // the first time the Studio shows on this browser, after it has drawn its rails
        var timer = 0;
        var watch = new MutationObserver(function () {
            if (seen()) { watch.disconnect(); return; }
            clearTimeout(timer);
            timer = setTimeout(function () { if (!seen() && studioOpen() && !root) { watch.disconnect(); open(); } }, 700);
        });
        watch.observe(m, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    // after case-studio-steps.js / case-card-ask-next.js arranged the Studio
    if (document.readyState === 'complete') setTimeout(init, 0); else document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
})();
