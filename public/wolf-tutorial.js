/* V101.357 — 🐺 Werewolf solo tutorial, owner pick A + B (mockup-werewolf-tutorial-sound/tutorial.png), in the 🥣 Cereal tour shape.
   (A) 📖 How to play — 6 scenes (roles & sides · night · morning · day tags · vote · ready), Thai first with a small English line, a 👆
       finger tapping a seat, ▶ auto (every 6 s), ข้าม / ถัดไป; opens the first time the 🐺 sheet opens, ❓ in the lobby replays it.
   (B) Coach marks — one purple bubble at a time on the REAL first night (per role), first day and first vote, each shown once;
       "ข้ามคำใบ้" stops them all. wolf.js calls WWTour.coach(key) after every render.
   Voice: each scene / hint can read itself (public/wolf-voice/s1…s6.mp3, c-<key>.mp3, made once with Paxa — VOICE stays false until
   the files exist, so nothing is requested before then). 🔊 / 🔇 = the game's own sound switch (WWSound).
   Reads and writes nothing but localStorage wolfTourSeen / wolfCoachSeen / wolfTourAuto. window.WWTour. */
(function () {
    'use strict';
    var SEEN = 'wolfTourSeen', COACH = 'wolfCoachSeen', AUTO = 'wolfTourAuto', INTERVAL = 6000, VOICE = false;
    var mem = {};
    function get(k) { try { return localStorage.getItem(k); } catch (_) { return mem[k] || null; } }
    function set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (_) { /* storage may be blocked (LIFF) */ } }
    function reduce() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

    var css = ''
        + '#wolfTour{position:fixed;inset:0;z-index:10001;background:#f8fafc;font-family:inherit;color:#0f172a;overflow:auto;-webkit-overflow-scrolling:touch}'
        + '#wolfTour .wt{max-width:430px;margin:0 auto;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:14px 14px calc(18px + env(safe-area-inset-bottom))}'
        + '#wolfTour.dark{background:#1e1b4b;color:#e0e7ff}'
        + '#wolfTour button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#wolfTour .wt-top{display:flex;align-items:center;gap:6px}#wolfTour .wt-top h3{margin:0;font-size:1.05em;font-weight:900;color:#6d28d9;white-space:nowrap}#wolfTour.dark .wt-top h3{color:#c4b5fd}'
        + '#wolfTour .wt-pill{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:2px 9px;font-size:.72em;font-weight:800;color:#475569}#wolfTour.dark .wt-pill{background:transparent;border-color:#4338ca;color:#c7d2fe}'
        + '#wolfTour .wt-ib{width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;padding:0;font-size:14px;line-height:1}#wolfTour .wt-ib.first{margin-left:auto}#wolfTour .wt-ib+.wt-ib{margin-left:6px}'
        + '#wolfTour.dark .wt-ib{background:transparent;border-color:#4338ca;color:#c7d2fe}'
        + '#wolfTour .wt-say{background:#fff;border:1px solid #ddd6fe;border-radius:14px;padding:10px 12px;font-size:.95em;font-weight:800;line-height:1.5;color:#1e293b}'
        + '#wolfTour.dark .wt-say{background:#312e81;border-color:#4338ca;color:#e0e7ff}'
        + '#wolfTour .wt-say small{display:block;font-size:.72em;font-weight:600;color:#94a3b8;margin-top:2px}#wolfTour.dark .wt-say small{color:#a5b4fc}'
        + '#wolfTour .wt-dots{display:flex;gap:4px;justify-content:center}#wolfTour .wt-dots i{width:6px;height:6px;border-radius:50%;background:#cbd5e1}#wolfTour .wt-dots i.on{background:#7c3aed;width:16px;border-radius:9px}'
        + '#wolfTour .wt-nav{display:flex;gap:8px;align-items:center;margin-top:auto}'
        + '#wolfTour .wt-auto{font-size:.75em;font-weight:800;color:#6d28d9;border:1px solid #ddd6fe;border-radius:999px;padding:5px 11px;background:#fff}#wolfTour .wt-auto.on{background:#7c3aed;color:#fff;border-color:#7c3aed}'
        + '#wolfTour .wt-skip{font-size:.8em;color:#94a3b8;font-weight:700;border:0;background:none;padding:4px}'
        + '#wolfTour .wt-next{margin-left:auto;background:#7c3aed;color:#fff;border:0;border-radius:12px;padding:11px 20px;font-weight:900;font-size:.9em}'
        + '#wolfTour .wt-seats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;position:relative}'
        + '#wolfTour .wt-seat{position:relative;border:2px solid #e2e8f0;border-radius:12px;padding:7px 2px 5px;text-align:center;background:#fff;font-size:.75em;font-weight:800;color:#334155}'
        + '#wolfTour .wt-seat .f{font-size:1.8em;display:block;line-height:1.2}#wolfTour .wt-seat.me{border-color:#b45309;background:#fffbeb}#wolfTour .wt-seat.dead{opacity:.5}'
        + '#wolfTour .wt-seat .tag{display:block;margin-top:2px;font-size:.82em;border-radius:6px;padding:1px 2px;white-space:nowrap;overflow:hidden}'
        + '#wolfTour .tag.r{color:#b91c1c;background:#fee2e2}#wolfTour .tag.g{color:#047857;background:#dcfce7}#wolfTour .tag.v{color:#4338ca;background:#e0e7ff}#wolfTour .tag.o{color:#92400e;background:#fef3c7}'
        + '#wolfTour .wt-seat .vc{position:absolute;top:2px;right:4px;background:#b91c1c;color:#fff;border-radius:999px;font-size:.8em;min-width:15px;height:15px;line-height:15px}'
        + '#wolfTour.dark .wt-seat{background:#312e81;border-color:#4338ca;color:#e0e7ff}#wolfTour.dark .wt-seat.pick{outline:2px dashed #a5b4fc;outline-offset:-2px}'
        + '#wolfTour .wt-seat.tap{animation:wt-tap 2.4s ease-in-out infinite}@keyframes wt-tap{0%,35%{box-shadow:none}45%,85%{box-shadow:0 0 0 3px #be123c inset}100%{box-shadow:none}}'
        + '#wolfTour.dark .wt-seat.tap{animation-name:wt-tapd}@keyframes wt-tapd{0%,35%{border-color:#4338ca}45%,85%{border-color:#fbbf24}100%{border-color:#4338ca}}'
        + '#wolfTour .wt-fing{position:absolute;font-size:1.6em;pointer-events:none;animation:wt-f 2.4s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}'
        + '@keyframes wt-f{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-4px,-6px) scale(.88)}55%{transform:translate(-4px,-6px) scale(.82)}}'
        + '#wolfTour .wt-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}#wolfTour .wt-cards span{border-radius:11px;background:#fff;border:1px solid #e2e8f0;text-align:center;font-size:.72em;font-weight:800;padding:6px 0}#wolfTour .wt-cards span i{display:block;font-style:normal;font-size:1.7em}'
        + '#wolfTour .wt-side{display:flex;gap:6px}#wolfTour .wt-side div{flex:1;border-radius:12px;padding:9px;font-size:.8em;font-weight:800;text-align:center;line-height:1.4}#wolfTour .wt-side .v{background:#f0fdf4;color:#15803d}#wolfTour .wt-side .w{background:#fff1f2;color:#be123c}'
        + '#wolfTour .wt-chips{display:flex;gap:5px;flex-wrap:wrap}#wolfTour .wt-chips span{border:1px solid #e2e8f0;border-radius:999px;padding:5px 10px;font-size:.75em;font-weight:800;color:#475569;background:#fff}'
        + '@media (prefers-reduced-motion: reduce){#wolfTour *{animation:none!important}}'
        // coach marks inside the game sheet
        + '#wolfModal .ww-coach{position:relative;background:#6d28d9;color:#fff;border-radius:14px;padding:9px 12px;font-size:.82em;font-weight:800;line-height:1.45}'
        + '#wolfModal .ww-coach:after{content:"";position:absolute;left:28px;top:-7px;border:7px solid transparent;border-top:0;border-bottom-color:#6d28d9}'
        + '#wolfModal .ww-coach small{display:block;font-weight:600;opacity:.8;font-size:.82em}'
        + '#wolfModal .ww .ww-coach .sk{float:right;border:0;background:none;color:#fff;opacity:.85;text-decoration:underline;font-size:.82em;font-weight:700;padding:0 0 0 8px}';

    function seat(f, n, o) { o = o || {}; return '<div class="wt-seat' + (o.cls ? ' ' + o.cls : '') + '"><span class="f">' + f + '</span>' + n + (o.tag ? '<span class="tag ' + o.tag[0] + '">' + o.tag[1] + '</span>' : '') + (o.vc ? '<span class="vc">' + o.vc + '</span>' : '') + '</div>'; }
    var SCENES = [
        { t: '📖 วิธีเล่น', body: function () {
            return '<div class="wt-cards"><span><i>🐺</i>หมาป่า</span><span><i>🔮</i>ผู้หยั่งรู้</span><span><i>🛡️</i>การ์ด</span><span><i>🧪</i>แม่มด</span><span><i>👤</i>ชาวบ้าน</span></div>'
                + '<div class="wt-side"><div class="v">🏘️ ฝั่งชาวบ้าน<br>ชนะเมื่อ 🐺 ออกครบ</div><div class="w">🐺 ฝั่งหมาป่า<br>ชนะเมื่อเท่ากับคนที่เหลือ</div></div>'; },
          say: 'ทุกคนได้บทลับ 1 ใบ · ไม่มีใครรู้บทคนอื่น', en: 'Everyone gets one secret role.' },
        { t: '🌙 คืน 1', dark: true, pill: '🐺 กัดใคร?', body: function () {
            return '<div class="wt-seats">' + seat('🙂', 'คุณ') + seat('🦊', 'ต้น', { cls: 'pick tap' }) + seat('🐰', 'ใบ', { cls: 'pick' }) + seat('🐱', 'ฟ้า', { cls: 'pick' }) + '<span class="wt-fing" style="left:32%;top:40%">👆</span></div>'; },
          say: '🐺 กัด · 🔮 ส่อง · 🛡️ คุ้มกัน · 🧪 ใช้ยา<br>ชาวบ้านหลับตา 😴', en: 'Each power picks a seat at night.' },
        { t: '☀️ เช้าวันที่ 1', body: function () {
            return '<div class="wt-seats">' + seat('🙂', 'คุณ', { cls: 'me' }) + seat('💀', 'ต้น', { cls: 'dead', tag: ['o', '🔮 ผู้หยั่งรู้'] }) + seat('🐰', 'ใบ') + seat('🐱', 'ฟ้า') + '</div>'; },
          say: 'เมื่อคืน 💀 ต้นถูกกัด · เป็น 🔮<br>ถ้า 🛡️ หรือ 💊 ช่วยทัน = คืนสงบ', en: 'Who died shows their role.' },
        { t: '☀️ วัน 1', body: function () {
            return '<div class="wt-seats">' + seat('🙂', 'คุณ', { cls: 'me' }) + seat('🐰', 'ใบ', { tag: ['v', '🔮 ฟ้า 👤'] }) + seat('🐱', 'ฟ้า', { tag: ['g', '👍 ใบ'] }) + seat('🐻', 'นนท์', { cls: 'tap', tag: ['r', '🤨 ใบ'] }) + '<span class="wt-fing" style="left:82%;top:42%">👆</span></div>'
                + '<div class="wt-chips"><span>🤨 สงสัย นนท์</span><span>👍 เชื่อ นนท์</span><span>🔮 อ้าง นนท์ 🐺</span></div>'; },
          say: '🤨 สงสัย · 👍 เชื่อ · 🔮 อ้างผลส่อง<br>หมาป่าโกหกได้นะ 🤥', en: 'Read the tags, say yours.' },
        { t: '🗳 โหวต', body: function () {
            return '<div class="wt-seats">' + seat('🙂', 'คุณ', { cls: 'me' }) + seat('🐰', 'ใบ', { vc: 1 }) + seat('🐱', 'ฟ้า') + seat('🐻', 'นนท์', { cls: 'tap', vc: 2 }) + '<span class="wt-fing" style="left:82%;top:40%">👆</span></div>'; },
          say: 'มากสุดออก · ⏭ ข้ามได้<br>เสมอ = ไม่มีใครออก', en: 'Most votes leaves. A tie: nobody.' },
        { t: '📖 พร้อมแล้ว', body: function () { return ''; },
          say: '💡 ครั้งแรกลอง 👥 7 · 🌙 เที่ยงคืน<br>ฟัง 🔮 ให้ดี · หมาป่ามักกล่าวหาคนอื่นก่อน', en: 'Try 7 players, midnight bots. ❓ in the lobby replays this.' }
    ];
    var st = { i: 0, timer: null, audio: null };
    function auto() { return get(AUTO) === 'on'; }
    function voice(name) {
        stopVoice();
        if (!VOICE || !window.WWSound || !WWSound.on()) return;
        try { st.audio = new Audio('wolf-voice/' + name + '.mp3'); var p = st.audio.play(); if (p && p.catch) p.catch(function () { /* the phone wants a tap first */ }); } catch (_) { /* no audio */ }
    }
    function stopVoice() { if (st.audio) { try { st.audio.pause(); } catch (_) {} st.audio = null; } }
    function ensureCss() { if (document.getElementById('wolfTourCss')) return; var s = document.createElement('style'); s.id = 'wolfTourCss'; s.textContent = css; document.head.appendChild(s); }
    function draw() {
        var el = document.getElementById('wolfTour'), sc = SCENES[st.i], last = st.i === SCENES.length - 1, on = window.WWSound ? WWSound.on() : true;
        el.className = 'lang-no-toggle' + (sc.dark ? ' dark' : '');
        el.innerHTML = '<div class="wt"><div class="wt-top"><h3>' + sc.t + '</h3>' + (sc.pill ? '<span class="wt-pill">' + sc.pill + '</span>' : '') + '<span class="wt-pill">' + (st.i + 1) + '/' + SCENES.length + '</span>'
            + '<button type="button" class="wt-ib first" id="wt-snd" onclick="WWTour.sound()" aria-label="Sound">' + (on ? '🔊' : '🔇') + '</button><button type="button" class="wt-ib" onclick="WWTour.close()" aria-label="Close">✕</button></div>'
            + sc.body() + '<div class="wt-say" id="wt-say">' + sc.say + '<small>' + sc.en + '</small></div>'
            + '<div class="wt-dots">' + SCENES.map(function (x, i) { return '<i' + (i === st.i ? ' class="on"' : '') + '></i>'; }).join('') + '</div>'
            + '<div class="wt-nav">' + (last ? '<button type="button" class="wt-skip" onclick="WWTour.go(0)">↺ ดูใหม่</button><button type="button" class="wt-next" id="wt-next" onclick="WWTour.close()">▸ เริ่มเกม</button>'
                : '<button type="button" class="wt-auto' + (auto() ? ' on' : '') + '" id="wt-auto" onclick="WWTour.auto()">▶ auto</button><button type="button" class="wt-skip" onclick="WWTour.close()">ข้าม</button><button type="button" class="wt-next" id="wt-next" onclick="WWTour.next()">ถัดไป ▸</button>')
            + '</div></div>';
        clearTimeout(st.timer);
        if (auto() && !last && !reduce()) st.timer = setTimeout(function () { WWTour.next(); }, INTERVAL);
        voice('s' + (st.i + 1));
    }
    function coachSeen() { var v = get(COACH) || ''; return v === 'all' ? null : v.split(',').filter(Boolean); }
    var COACH_TEXT = {
        'night-wolf': ['👆 แตะคนที่จะกัด · 🐺 ที่มุม = เพื่อนหมาป่า', 'Tap who to bite. 🐺 in a corner = your mates.'],
        'night-seer': ['👆 แตะคนที่จะส่อง · ผลขึ้นทันที', 'Tap who to check — the answer shows at once.'],
        'night-guard': ['👆 แตะคนที่จะคุ้มกัน · ห้ามคนเดิม 2 คืนติด', 'Tap who to guard. Not the same one twice in a row.'],
        'night-witch': ['🧪 💊 ชุบคนถูกกัด หรือ ☠️ วางยา · อย่างละครั้งทั้งเกม', 'Heal the bitten or poison someone — once each.'],
        'night-villager': ['😴 ชาวบ้านไม่มีพลังกลางคืน · กด ☀️ ไปเช้า', 'Villagers sleep. Tap ☀️ to go on.'],
        day: ['ป้ายใต้ชื่อ = บอทพูดอะไรวันนี้ · แตะที่นั่งเพื่อพูดบ้าง', 'Tags are what the bots said today. Tap a seat to speak.'],
        vote: ['เลขแดง = บอทโหวตแล้ว · โหวตของคุณอาจชี้ขาด', "Red numbers are the bots' votes. Yours may decide."]
    };
    window.WWTour = {
        seen: function () { return !!get(SEEN); },
        open: function () {
            ensureCss();
            var el = document.getElementById('wolfTour');
            if (!el) { el = document.createElement('div'); el.id = 'wolfTour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'How to play'); el.className = ''; document.body.appendChild(el); }
            el.style.display = 'block'; st.i = 0; draw();   // draw() keeps lang-no-toggle: lang-toggle.js hides Thai outside it
        },
        close: function () { clearTimeout(st.timer); stopVoice(); set(SEEN, '1'); var el = document.getElementById('wolfTour'); if (el) el.style.display = 'none'; },
        next: function () { if (st.i < SCENES.length - 1) { st.i++; draw(); } },
        go: function (i) { st.i = i; draw(); },
        auto: function () { set(AUTO, auto() ? 'off' : 'on'); draw(); },
        sound: function () { if (window.WWSound) WWSound.toggle(); draw(); },
        /** One hint for this moment of the real game (night-<role> · day · vote), once each. null = clear. */
        coach: function (k) {
            ensureCss();
            var old = document.getElementById('ww-coach'); if (old) old.remove();
            var seen = coachSeen(); if (!k || !seen || seen.indexOf(k) >= 0 || !COACH_TEXT[k]) return;
            var anchor = document.querySelector('#wolfModal .ww-seats'); if (!anchor) return;
            anchor.insertAdjacentHTML('afterend', '<div class="ww-coach" id="ww-coach"><button type="button" class="sk" onclick="WWTour.skipCoach()">ข้ามคำใบ้</button>' + COACH_TEXT[k][0] + '<small>' + COACH_TEXT[k][1] + '</small></div>');
            seen.push(k); set(COACH, seen.join(','));
            voice('c-' + k);
        },
        skipCoach: function () { set(COACH, 'all'); var old = document.getElementById('ww-coach'); if (old) old.remove(); stopVoice(); },
        _scenes: SCENES.length
    };
})();
