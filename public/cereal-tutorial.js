/* V101.329 — 🥣 Cereal Killer tutorial, two layers in the Journal-tour shape (violet card, Thai first with a small English line, 👆 finger,
   CSS-only animation, reduced motion = still cards, once per device, replay from the lobby's ?). Owner 2026-11-20: 8 scenes, advance on ถัดไป
   by default with a ▶ auto toggle the players may switch on (every 6 s), Thai first like the Journal tour.
   (1) How to play — 8 scenes on a demo board (side A) that animates by itself; opens the first time the 🥣 sheet opens.
   (2) Coach marks — one hint at a time on the REAL first killer / detective turn (home · 3 cells · chips · lock · café · move · ask · arrest),
       each shown once; "ข้ามคำใบ้" stops them all. cereal.js calls CKTour.coach(key) after every render.
   Reads and writes nothing but localStorage cerealTourSeen / cerealCoachSeen / cerealTourAuto.
   V101.343 (owner, voice Foi Thong · mockup-cereal-voice/): each How to play card reads itself aloud — public/cereal-voice/s1…s9.mp3, made once
   with Paxa TTS (no call at play time). 🔊 / 🔇 in the card header is the game's own sound switch (CKSound, localStorage cerealSound).
   A clip starts on the tap that opened the tour or turned the card; when the phone refuses (no tap yet) the 🔊 chip pulses and a tap plays it.
   Close / ข้าม / a new card stop it. With ▶ auto on, the card turns 0.8 s after its clip ends instead of every 6 s.
   Each first-turn coach mark reads itself too (cereal-voice/c-<key>.mp3, same voice); it stops when the hint closes. */
(function () {
    'use strict';
    var R = window.CerealRules, M = window.CEREAL_MAPS;
    if (!R || !M) return;
    var SEEN = 'cerealTourSeen', COACH = 'cerealCoachSeen', AUTO = 'cerealTourAuto', INTERVAL = 6000;
    var mem = {};
    function get(k) { try { return localStorage.getItem(k); } catch (_) { return mem[k] || null; } }
    function set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (_) { /* storage may be blocked (LIFF) */ } }
    function reduce() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

    var css = ''
        + '#cerealTour{position:fixed;inset:0;z-index:10001;background:#f8fafc;font-family:inherit;color:#0f172a;overflow:auto;-webkit-overflow-scrolling:touch}'
        + '#cerealTour .ct{max-width:430px;margin:0 auto;min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:14px 14px calc(18px + env(safe-area-inset-bottom))}'
        + '#cerealTour button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#cerealTour .ct-top{display:flex;align-items:center;gap:6px}'
        + '#cerealTour .ct-top h3{margin:0;font-size:1.05em;font-weight:900;color:#6d28d9;white-space:nowrap}'
        + '#cerealTour .ct-pill{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:3px 9px;font-size:.72em;font-weight:800;color:#475569;white-space:nowrap}'
        + '#cerealTour .ct-voice{margin-left:auto;width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:0;font-size:15px;line-height:1}'
        + '#cerealTour .ct-voice.wait{border-color:#a78bfa;box-shadow:0 0 0 3px #ede9fe;animation:ct-vwait 1.2s ease-in-out infinite}@keyframes ct-vwait{50%{box-shadow:0 0 0 6px #ddd6fe}}#cerealTour .ct-voice+.ct-x{margin-left:6px}'
        + '#cerealTour .ct-x{width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;margin-left:auto;padding:0}'
        + '#cerealTour .ct-board{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;position:relative;--acc:#be123c}'
        + '#cerealTour .ct-board.det{--acc:#4338ca}'
        + '#cerealTour .ct-cell{position:relative;aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.35em;background:#e8edf3;border:2px solid transparent;box-sizing:border-box;line-height:1}'
        + '#cerealTour .ct-cell.h{background:#fdf1e7}#cerealTour .ct-cell.p{background:#dcfce7}#cerealTour .ct-cell.c{background:#fef3c7}#cerealTour .ct-cell.s{background:#e0e7ff}'
        + '#cerealTour .ct-cell .n{position:absolute;top:3px;left:5px;font-size:.5em;font-weight:900;color:#64748b}'
        + '#cerealTour .ct-cell .tk{position:absolute;bottom:2px;right:3px;font-size:.6em;line-height:1}'
        + '#cerealTour .ct-cell .gh{position:absolute;left:4px;bottom:2px;font-size:.62em;line-height:1;opacity:0}'
        + '#cerealTour .ct-cell .st{position:absolute;top:2px;right:4px;font-size:.5em;font-weight:900;color:#fff;background:var(--acc);border-radius:999px;min-width:14px;height:14px;line-height:14px;text-align:center;padding:0 3px;opacity:0}'
        /* walking: cells 0..3 light up in turn, the ghost hops along, then it all resets and loops */
        + '#cerealTour .ct-cell.w{animation:ct-step 4.2s ease-in-out infinite}'
        + '#cerealTour .ct-cell.w .gh{animation:ct-gh 4.2s ease-in-out infinite}#cerealTour .ct-cell.w .st{animation:ct-st 4.2s ease-in-out infinite}'
        + '#cerealTour .ct-cell.w1,#cerealTour .ct-cell.w1 .gh,#cerealTour .ct-cell.w1 .st{animation-delay:.7s}'
        + '#cerealTour .ct-cell.w2,#cerealTour .ct-cell.w2 .gh,#cerealTour .ct-cell.w2 .st{animation-delay:1.4s}'
        + '#cerealTour .ct-cell.w3,#cerealTour .ct-cell.w3 .gh,#cerealTour .ct-cell.w3 .st{animation-delay:2.1s}'
        + '@keyframes ct-step{0%{border-color:transparent}6%,62%{border-color:var(--acc)}72%,100%{border-color:transparent}}'
        + '@keyframes ct-gh{0%{opacity:0}6%,18%{opacity:1}24%,100%{opacity:0}}'
        + '@keyframes ct-st{0%{opacity:0}6%,62%{opacity:1}72%,100%{opacity:0}}'
        + '#cerealTour .tk.drop{animation:ct-drop 4.2s ease-out infinite}@keyframes ct-drop{0%,58%{opacity:0;transform:translateY(-12px) scale(.5)}66%,92%{opacity:1;transform:none}100%{opacity:0}}'
        + '#cerealTour .tk.pop{animation:ct-pop 4.2s ease-out infinite}@keyframes ct-pop{0%,70%{opacity:0;transform:scale(.3)}78%,92%{opacity:1;transform:scale(1)}100%{opacity:0}}'
        + '#cerealTour .ct-cell.hide .gh{animation:ct-hide 3s steps(1) infinite}#cerealTour .ct-cell.hide2 .gh{animation:ct-hide 3s steps(1) infinite;animation-delay:1s}#cerealTour .ct-cell.hide3 .gh{animation:ct-hide 3s steps(1) infinite;animation-delay:2s}'
        + '@keyframes ct-hide{0%,30%{opacity:1}31%,100%{opacity:0}}'
        + '#cerealTour .ct-cell.ring{animation:ct-ring 1.4s ease-in-out infinite}@keyframes ct-ring{0%,100%{box-shadow:0 0 0 2px #b91c1c inset}50%{box-shadow:0 0 0 5px #b91c1c inset}}'
        + '#cerealTour .ct-cell.ok{box-shadow:0 0 0 3px #16a34a inset}'
        + '#cerealTour .ct-cell.blk::after{content:"✕";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1em;font-weight:900;color:#b91c1c;opacity:.75}'
        + '#cerealTour .ct-cell.sub{animation:ct-sub 2.4s ease-in-out infinite}#cerealTour .ct-cell.sub.b{animation-delay:.6s}@keyframes ct-sub{0%,100%{box-shadow:none}30%,60%{box-shadow:0 0 0 3px #4338ca inset}}'
        + '#cerealTour .ct-fing{position:absolute;left:38%;top:14%;font-size:1.6em;pointer-events:none;animation:jt-tap 1.4s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}'
        + '@keyframes jt-tap{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-4px,-6px) scale(.9)}55%{transform:translate(-4px,-6px) scale(.84)}}'
        /* small widgets under the board */
        + '#cerealTour .ct-wid{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:34px}'
        + '#cerealTour .ct-cal{display:flex;gap:4px;flex:1}'
        + '#cerealTour .ct-cal span{flex:1;text-align:center;font-size:.62em;font-weight:900;color:#94a3b8;border-radius:999px;padding:4px 0;background:#f1f5f9;animation:ct-cal 5.6s steps(1) infinite;white-space:nowrap}'
        + '#cerealTour .ct-cal span:nth-child(2){animation-delay:.6s}#cerealTour .ct-cal span:nth-child(3){animation-delay:1.2s}#cerealTour .ct-cal span:nth-child(4){animation-delay:1.8s}#cerealTour .ct-cal span:nth-child(5){animation-delay:2.4s}#cerealTour .ct-cal span:nth-child(6){animation-delay:3s}#cerealTour .ct-cal span:nth-child(7){animation-delay:3.6s}'
        + '@keyframes ct-cal{0%,8%{background:#f1f5f9;color:#94a3b8}9%,85%{background:#fff1f2;color:#be123c}86%,100%{background:#f1f5f9;color:#94a3b8}}'
        + '#cerealTour .ct-cal span.min{outline:1.5px dashed #f59e0b;outline-offset:-1.5px}'
        + '#cerealTour .ct-chip{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:6px 12px;font-size:.8em;font-weight:800;color:#475569;min-height:32px;box-sizing:border-box;display:inline-flex;align-items:center;gap:5px}'
        + '#cerealTour .ct-chip.pulse{animation:ct-chip 4.2s ease-in-out infinite}@keyframes ct-chip{0%,40%{border-color:#e2e8f0;color:#475569;background:#fff}50%,100%{border-color:#4338ca;color:#4338ca;background:#eef2ff}}'
        + '#cerealTour .ct-chip.red{border-color:#fecaca;color:#b91c1c;background:#fef2f2}'
        + '#cerealTour .ct-ans{font-size:.8em;font-weight:900;color:#4338ca;background:#eef2ff;border-radius:999px;padding:5px 12px;opacity:0;animation:ct-ans 4.2s ease-out infinite}@keyframes ct-ans{0%,62%{opacity:0;transform:translateY(6px)}70%,100%{opacity:1;transform:none}}'
        + '#cerealTour .ct-cnt{font-size:.8em;font-weight:900;color:#b91c1c;display:inline-flex;gap:4px;align-items:center}#cerealTour .ct-cnt i{font-style:normal;animation:ct-cnt 2.8s steps(1) infinite}@keyframes ct-cnt{0%,45%{opacity:1}46%,100%{opacity:.25;text-decoration:line-through}}'
        + '#cerealTour .ct-phone{position:relative;width:56px;height:88px;border-radius:12px;background:#fff1f2;border:2px solid #fecdd3;display:flex;align-items:center;justify-content:center;font-size:1.7em;animation:ct-flip 3.2s ease-in-out infinite}'
        + '@keyframes ct-flip{0%,35%{transform:rotateY(0);background:#fff1f2;border-color:#fecdd3}50%{transform:rotateY(90deg)}65%,100%{transform:rotateY(0);background:#eef2ff;border-color:#c7d2fe}}'
        + '#cerealTour .ct-phone .k,#cerealTour .ct-phone .d{position:absolute}#cerealTour .ct-phone .k{animation:ct-face 3.2s steps(1) infinite}#cerealTour .ct-phone .d{opacity:0;animation:ct-face2 3.2s steps(1) infinite}'
        + '@keyframes ct-face{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes ct-face2{0%,49%{opacity:0}50%,100%{opacity:1}}'
        + '#cerealTour .ct-arrow{font-size:1.3em;color:#94a3b8;font-weight:900}#cerealTour .ct-lock{font-size:.75em;font-weight:800;color:#be123c;border:1px solid #fecdd3;border-radius:999px;padding:4px 10px;background:#fff}'
        /* the tip card — the Journal tour's jt-tip */
        + '#cerealTour .ct-tip,#cerealCoach .ct-tip{background:#fff;border-radius:16px;padding:12px 14px 10px;box-shadow:0 12px 32px rgba(30,16,60,.18);color:#2e1065;border:1px solid #ede9fe;animation:jt-in .3s ease-out both}'
        + '#cerealTour .ct-tip{margin-top:auto}'
        // V101.332 (owner screenshot 2026-11-22): on a big screen the card sat at the bottom edge, far from the board — center the pair there; phones keep the card in thumb reach
        + '@media (min-width:600px) and (min-height:1000px){#cerealTour .ct{justify-content:center}#cerealTour .ct-tip{margin-top:6px}}'
        + '@media (min-width:600px){#cerealTour .ct{max-width:560px}#cerealTour .ct-cell{font-size:1.7em}}'   // V101.333: same width as the game
        + '@keyframes jt-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
        + '.ct-tip .k{font-size:11px;font-weight:800;letter-spacing:.06em;color:#8b5cf6;text-transform:uppercase}'
        + '.ct-tip .t{margin:2px 0 4px;font-size:16px;font-weight:800;color:#4c1d95}'
        + '.ct-tip .b{margin:0;font-size:13.5px;line-height:1.55;color:#3f3355}'
        + '.ct-tip .en{margin:4px 0 0;font-size:11.5px;color:#8a7fa3}'
        + '.ct-tip .f{display:flex;align-items:center;gap:6px;margin-top:10px}'
        + '.ct-tip .dots{display:flex;gap:5px;flex:1}.ct-tip .dots i{width:6px;height:6px;border-radius:50%;background:#ddd6fe}.ct-tip .dots i.on{width:16px;border-radius:4px;background:#7c3aed}'
        + '.ct-tip .skip{border:0;background:none;color:#8a7fa3;font-weight:700;font-size:13px;padding:6px 8px}'
        + '.ct-tip .back{border:0;background:none;color:#7c3aed;font-weight:800;font-size:13px;padding:6px 6px}'
        + '.ct-tip .try{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 4px}'
        + '.ct-tip .try button{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;border-radius:14px;padding:10px 6px;color:#fff;font-weight:800;font-size:13px}'
        + '.ct-tip .try .tk{background:#be123c}.ct-tip .try .td{background:#4338ca}.ct-tip .try small{font-weight:600;font-size:11px;opacity:.85}'
        + '.ct-tip .next{border:0;background:#7c3aed;color:#fff;font-weight:800;font-size:13px;padding:8px 16px;border-radius:999px;display:inline-flex;align-items:center}'
        + '.ct-tip .auto{border:1px solid #ddd6fe;background:#fff;color:#7c3aed;font-weight:800;font-size:12px;padding:5px 9px;border-radius:999px}'
        + '.ct-tip .auto[aria-pressed="true"]{background:#7c3aed;color:#fff;border-color:#7c3aed}'
        + '#cerealTour button:focus{outline:none}#cerealTour button:focus-visible,#cerealCoach button:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}'
        /* coach marks: a pulsing ring on the real element and a floating card; the game underneath stays tappable */
        + '#cerealCoach{position:fixed;inset:0;z-index:10002;pointer-events:none;font-family:inherit}'
        + '#cerealCoach .ct-ring{position:fixed;border-radius:14px;box-shadow:0 0 0 2px #a78bfa;animation:ct-cring 1.6s ease-in-out infinite;transition:all .25s ease}'
        + '@keyframes ct-cring{0%,100%{box-shadow:0 0 0 2px #a78bfa}50%{box-shadow:0 0 0 5px #c4b5fd}}'
        + '#cerealCoach .ct-tip{position:fixed;left:10px;right:10px;max-width:430px;margin:0 auto;pointer-events:auto;box-shadow:0 12px 32px rgba(30,16,60,.35)}'
        + '#cerealCoach .ct-tip::before{content:"";position:absolute;left:40px;width:14px;height:14px;background:#fff;transform:rotate(45deg)}'
        + '#cerealCoach .ct-tip.up::before{top:-6px}#cerealCoach .ct-tip.down::before{bottom:-6px}'
        + '#cerealCoach .ct-fing{position:fixed;font-size:1.6em;pointer-events:none;animation:jt-tap 1.4s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}'
        + '@media (prefers-reduced-motion: reduce){#cerealTour *,#cerealTour *::before,#cerealCoach *{animation:none!important;transition:none!important}#cerealTour .ct-fing,#cerealCoach .ct-fing{display:none}'
        + '#cerealTour .ct-cell.w{border-color:var(--acc)}#cerealTour .ct-cell.w .st,#cerealTour .tk.drop,#cerealTour .tk.pop,#cerealTour .ct-ans{opacity:1!important}#cerealTour .ct-cal span{background:#fff1f2;color:#be123c}}';

    // ---- the demo board (side A) ----------------------------------------------------------------------------
    var ICON = { H: '🏠', P: '🌳', C: '☕', S: '🚇', '.': '' }, CLS = { H: 'h', P: 'p', C: 'c', S: 's', '.': 'r' };
    var mapA = R.buildMap(M, 'A', null);
    function board(extra, det) {
        var h = '<div class="ct-board' + (det ? ' det' : '') + '" aria-hidden="true">';
        mapA.ids.forEach(function (id) {
            var c = mapA.cells[id], e = extra[id] || {};
            h += '<div class="ct-cell ' + CLS[c.t] + (e.cls ? ' ' + e.cls : '') + '"><span class="n">' + id + '</span><span class="ic">' + ICON[c.t] + '</span>'
                + (e.st ? '<span class="st">' + e.st + '</span>' : '') + (e.gh ? '<span class="gh">' + e.gh + '</span>' : '') + (e.tk ? '<span class="tk' + (e.tkc ? ' ' + e.tkc : '') + '">' + e.tk + '</span>' : '') + '</div>';
        });
        return h + '</div>';
    }
    // Each scene: board overlays (cls = animation classes, gh = ghost on the hop, st = step badge, tk + tkc = token and its arrival), a widget, the card.
    var SCENES = [
        { ex: { 3: { tk: '🥣' }, 4: { tk: '👁️' }, 11: { tk: '🥣' }, 14: { tk: '🕵️' }, 8: { cls: 'hide', gh: '🔪' }, 12: { cls: 'hide2', gh: '🔪' }, 19: { cls: 'hide3', gh: '🔪' } },
          k: '1 / 8 · เป้าหมาย', t: '🔪 ฆ่าให้ครบ 6 ใน 7 วัน · 🕵️ จับให้ได้ก่อน', b: 'ฆาตกรเดินแบบซ่อนตัว ไม่มีตัวหมากบนกระดาน นักสืบเห็นแค่ร่องรอย: ซีเรียล 🥣 กับพยาน 👁️', en: 'The killer moves unseen; the detective sees only cereal and witnesses.' },
        { ex: { 8: { cls: 'w', gh: '🔪' }, 3: { cls: 'w w1', gh: '🔪', st: '1' }, 2: { cls: 'w w2', gh: '🔪', st: '2' }, 1: { cls: 'w w3', gh: '🔪', st: '3' }, 9: { cls: 'blk', tk: '🕵️' } }, finger: true,
          k: '2 / 8 · ฆาตกรเดิน', t: 'เดิน 3 ช่องพอดีทุกวัน', b: 'ขึ้น ลง ซ้าย ขวา เท่านั้น ห้ามทแยง เดินย้อนได้ แต่ห้ามเข้าช่องที่นักสืบยืนอยู่', en: 'Exactly 3 orthogonal steps, backtracking allowed, never through the detective.' },
        { ex: { 8: { cls: 'w', gh: '🔪' }, 3: { cls: 'w w1', gh: '🔪', st: '1', tk: '🥣', tkc: 'drop' }, 2: { cls: 'w w2', gh: '🔪', st: '2' }, 1: { cls: 'w w3', gh: '🔪', st: '3' }, 4: { tk: '👁️', tkc: 'pop' } }, finger: true,
          k: '3 / 8 · ลงมือ', t: 'วาง 🥣 ที่บ้านบนเส้นทาง · 👁️ ไปยืนที่สวนข้าง ๆ', b: 'วันละ 1 ราย ข้ามได้ 1 วันทั้งเกม ถ้าบ้านติด 2 สวน ฆาตกรเลือกเอง และห้ามจบเทิร์นบนสวนนั้น', en: 'One kill a day on a house you touched; the witness takes an adjacent park.' },
        { ex: { 3: { tk: '🥣' }, 11: { tk: '🥣' }, 8: { tk: '🥣' }, 15: { tk: '🥣' }, 18: { tk: '🥣' }, 19: { tk: '🥣' } },
          wid: '<div class="ct-cal"><span>D1</span><span class="min">D2 ≥1</span><span>D3</span><span class="min">D4 ≥3</span><span>D5</span><span>D6</span><span class="min">D7 6</span></div>',
          k: '4 / 8 · ปฏิทิน', t: 'จบวัน 2 ต้องมี 1 · วัน 4 ต้องมี 3 · วัน 7 ครบ 6', b: 'ไม่ถึงเมื่อไร นักสืบชนะทันที', en: 'Miss a minimum and the detective wins at once.' },
        { ex: { 3: { tk: '🥣' }, 4: { tk: '👁️' } },
          wid: '<span class="ct-lock">🔒 Day 1 locked</span><span class="ct-arrow">→</span><div class="ct-phone"><span class="k">🔪</span><span class="d">🕵️</span></div><span class="ct-arrow">→</span><span class="ct-pill">👆 แตะเมื่อถึงมือคุณ</span>',
          k: '5 / 8 · ส่งมือถือ', t: 'ล็อก 🔒 แล้วส่งมือถือให้อีกฝ่าย', b: 'จอถัดไปเปิดหลังอีกฝ่ายแตะเท่านั้น สมุดของฆาตกรไม่มีวันโผล่บนจอนักสืบ', en: 'Lock your turn, pass the phone; the next screen opens only on their tap.' },
        { ex: { 3: { tk: '🥣' }, 4: { tk: '👁️', cls: 'ok' }, 7: { cls: 'w', gh: '🕵️' }, 8: { cls: 'w w1', gh: '🕵️', st: '1' }, 9: { cls: 'w w2', gh: '🕵️', st: '2' } }, det: true,
          wid: '<span class="ct-chip pulse">🧭</span><span class="ct-chip">↔</span><span class="ct-chip">↕</span><span class="ct-chip">🏠</span><span class="ct-chip">2·1</span><span class="ct-ans">→ N</span>',
          k: '6 / 8 · นักสืบ', t: 'เดินได้ถึง 3 ช่อง (+1 ถ้าผ่าน ☕) · ยืนติด 👁️ แล้วถาม 1 ใบ', b: 'แอปตอบแทนฆาตกรตามความจริงเสมอ การ์ดแต่ละใบใช้ได้ครั้งเดียวทั้งเกม', en: 'Stand on or next to the witness and spend one of five question cards.' },
        { ex: { 3: { tk: '🥣', cls: 'ring' }, 4: { tk: '👁️' }, 9: { tk: '🕵️' } }, det: true,
          wid: '<span class="ct-chip red">🛡️ อยู่ช่อง 3 ใช่ไหม?</span><span class="ct-cnt">🛡️ <i>4</i> 3 2 1</span>',
          k: '7 / 8 · จับกุม', t: '🛡️ ชี้ช่องที่ยืนหรือช่องติดกัน ได้ 4 ครั้ง', b: 'ถูก = ชนะทันที · ผิด = จบเทิร์น และโอกาสลดลง 1', en: 'Right = you win; wrong = turn ends and one of four tries is gone.' },
        { ex: { 10: { cls: 'sub' }, 16: { cls: 'sub b' }, 1: { gh: '🔪', cls: 'ring hide' }, 2: { tk: '🕵️' }, 6: { tk: '🥣' } },
          wid: '<span class="ct-chip">🚇 10 ↔ 16 = 1 ก้าว</span><span class="ct-chip red">ถูกต้อนที่ 1 = แพ้</span>',
          k: '8 / 8 · ทางลัด และทางตัน', t: '🚇 เข้า S ออกอีก S นับ 1 ก้าว', b: 'ใช้ได้ทั้งสองฝ่าย ส่วนฆาตกรที่ถูกต้อนจนเดินไม่ครบ 3 ช่อง แพ้ทันที', en: 'Subway is one step for both; a cornered killer loses.' },
        { ex: { 3: { tk: '🥣' }, 4: { tk: '👁️' }, 14: { tk: '🕵️' } }, last: true,
          k: 'พร้อมแล้ว', t: 'เริ่มวันที่ 1 ได้เลย', b: 'ดูซ้ำได้ทุกเมื่อจาก ? ใน lobby และในเทิร์นแรกจะมีคำใบ้ชี้ปุ่มให้บนจอจริง', en: 'Replay any time from ? — your first turn also gets on-screen hints.' }
    ];

    var root = null, cur = 0, timer = 0, lastFocus = null;
    // ---- 🔊 voice (V101.343) ----
    var VOICE_V = 'V101.343', au = null, voiceBlocked = false;
    function voiceOn() { return window.CKSound ? CKSound.on() : get('cerealSound') !== 'off'; }
    function stopVoice() { if (au) { au.onended = null; try { au.pause(); } catch (_) { /* not started */ } } }
    function playVoice() {
        stopVoice();
        if (!voiceOn() || !root) return;
        if (!au) { try { au = new Audio(); } catch (_) { return; } au.preload = 'auto'; }
        au.src = 'cereal-voice/s' + (cur + 1) + '.mp3?v=' + VOICE_V;
        au.onended = function () { if (root && autoOn() && !SCENES[cur].last) { clearTimeout(timer); timer = setTimeout(function () { go(1); }, 800); } };
        var p; try { p = au.play(); } catch (_) { p = null; }
        voiceBlocked = false; paintVoice();
        if (p && p.catch) p.catch(function () { voiceBlocked = true; paintVoice(); arm(); });   // no tap yet (iPhone / LINE): the chip pulses, a tap plays
        au.onerror = function () { arm(); };   // a clip that cannot load never holds ▶ auto
    }
    function paintVoice() {
        var b = root && root.querySelector('.ct-voice'); if (!b) return;
        var on = voiceOn();
        b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('wait', on && voiceBlocked);
    }
    function style() { if (!document.getElementById('ct-style')) { var st = document.createElement('style'); st.id = 'ct-style'; st.textContent = css; document.head.appendChild(st); } }
    function dots(n) { var h = '<div class="dots" aria-hidden="true">'; for (var i = 1; i <= 8; i++) h += '<i class="' + (i === n ? 'on' : '') + '"></i>'; return h + '</div>'; }
    function autoOn() { return get(AUTO) === '1'; }
    function arm() { clearTimeout(timer); timer = 0; if (root && autoOn() && !SCENES[cur].last && !(voiceOn() && au && !voiceBlocked && !au.error)) timer = setTimeout(function () { go(1); }, INTERVAL); }   // a clip that plays turns the card at its end; refused / failed → the 6 s timer
    function render() {
        var sc = SCENES[cur];
        root.innerHTML = '<div class="ct"><div class="ct-top"><h3>🥣 How to play</h3><span class="ct-pill">' + (sc.last ? '🏁' : (cur + 1) + ' / 8') + '</span>'
            + '<button type="button" class="ct-voice" data-ct="voice" aria-label="Voice" title="เสียงบรรยาย · voice">🔊</button>'
            + '<button type="button" class="ct-x" data-ct="skip" title="ปิด · กด ? ใน lobby ดูซ้ำได้" aria-label="ปิด">✕</button></div>'
            + '<div style="position:relative">' + board(sc.ex, sc.det) + (sc.finger ? '<span class="ct-fing" aria-hidden="true">👆</span>' : '') + '</div>'
            + '<div class="ct-wid">' + (sc.wid || '') + '</div>'
            + '<div class="ct-tip" role="dialog" aria-modal="true" aria-labelledby="ct-title" aria-live="polite"><div class="k">' + sc.k + '</div><p class="t" id="ct-title">' + sc.t + '</p><p class="b">' + sc.b + '</p><p class="en">' + sc.en + '</p>'
            // V101.339 (owner pick B, mockup-cereal-tour-bot/): the last card starts a first round vs the easiest 🤖 🥄 in the seat picked here
            + (sc.last && window.CK ? '<div class="try"><button type="button" class="tk" data-ct="bot-killer">🔪 เป็นฆาตกร<small>vs 🤖 🥄</small></button><button type="button" class="td" data-ct="bot-detective">🕵️ เป็นนักสืบ<small>vs 🤖 🥄</small></button></div>' : '')
            + '<div class="f">' + dots(Math.min(cur + 1, 8))
            + (sc.last ? '' : '<button type="button" class="auto" data-ct="auto" aria-pressed="' + (autoOn() ? 'true' : 'false') + '" title="เลื่อนฉากเองทุก 6 วินาที · auto-advance">▶ auto</button>')
            + (cur > 0 && !sc.last ? '<button type="button" class="back" data-ct="back" aria-label="ย้อนกลับ">‹</button>' : '')
            + (sc.last ? '' : '<button type="button" class="skip" data-ct="skip">ข้าม</button>')
            + (sc.last ? '<button type="button" class="skip" data-ct="close">ปิด</button>' : '<button type="button" class="next" data-ct="next">ถัดไป ›</button>')
            + '</div></div></div>';
        root.scrollTop = 0;
        var next = root.querySelector('.next'); if (next) next.focus({ preventScroll: true });
        playVoice(); arm();
    }
    function go(d) { var n = cur + d; if (n < 0 || n >= SCENES.length) return; cur = n; render(); }
    function close() {
        if (!root) return;
        clearTimeout(timer); timer = 0; stopVoice();
        root.remove(); root = null;
        document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function onKey(e) {
        if (!root) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    }
    function open() {
        if (root) return;
        set(SEEN, '1'); style();
        lastFocus = document.activeElement; cur = 0;
        root = document.createElement('div'); root.id = 'cerealTour'; root.className = 'lang-no-toggle';   // lang-toggle.js would wrap the Thai in .lang-th and hide it in EN mode
        root.addEventListener('click', function (e) {
            var b = e.target.closest('[data-ct]'); if (!b) return;
            var a = b.getAttribute('data-ct');
            if (a === 'skip' || a === 'close') close();
            else if (a === 'bot-killer' || a === 'bot-detective') { close(); var me = a.slice(4); CK.tab('local'); CK.vs('bot'); CK.level(me, 1); CK.start(); }
            else if (a === 'auto') { set(AUTO, autoOn() ? '0' : '1'); arm(); var ab = root.querySelector('[data-ct="auto"]'); if (ab) ab.setAttribute('aria-pressed', autoOn() ? 'true' : 'false'); }   // V101.343: no re-render, the clip keeps playing
            else if (a === 'voice') {
                if (voiceOn() && voiceBlocked) { playVoice(); return; }   // the first tap that the phone allows
                if (window.CKSound) CKSound.toggle(); else set('cerealSound', voiceOn() ? 'off' : 'on');
                if (voiceOn()) playVoice(); else { stopVoice(); paintVoice(); }
                arm();
            }
            else go(a === 'back' ? -1 : 1);
        });
        document.body.appendChild(root);
        document.addEventListener('keydown', onKey, true);
        render();
    }

    // ---- coach marks on the real turn -----------------------------------------------------------------------------
    var COACHES = {
        home: { ring: '#cerealModal .ck-board', finger: true, k: 'เทิร์นแรกของคุณ · 1 / 4', t: 'แตะบ้าน 1 หลังเป็นที่ซ่อนตัว', b: 'บ้านนี้คือจุดเริ่มลับของคุณ นักสืบไม่เห็น เลือกแล้วเปลี่ยนได้ด้วย ↺ ก่อนล็อกวัน', en: 'Tap a house: your secret home.' },
        path: { ring: '#cerealModal .ck-board', finger: true, k: 'เทิร์นแรกของคุณ · 2 / 4', t: 'แตะ 3 ช่องติดกัน', b: 'จุดสีแดงคือช่องที่ก้าวไปได้ แตะผิดกดถอย ↺ เดินย้อนได้ 🚇 เข้า S ออกอีก S นับ 1 ก้าว', en: 'Tap 3 adjacent cells; the dots show legal steps.' },
        chips: { ring: '#ck-kill, #ck-wit', k: 'เทิร์นแรกของคุณ · 3 / 4', t: 'เลือกบ้านที่จะวาง 🥣 แล้วเลือกสวนให้ 👁️', b: 'ฆ่าได้เฉพาะบ้านที่อยู่บนเส้นทางวันนี้ ถ้ามีสวนติดบ้าน พยานต้องไปยืน ข้ามได้ 1 วันทั้งเกม', en: 'Pick the house for the cereal, then the park for the witness.' },
        lock: { ring: '#ck-lock', k: 'เทิร์นแรกของคุณ · 4 / 4', t: 'ล็อก 🔒 แล้วส่งมือถือ', b: 'หลังล็อกจะแก้ไม่ได้ จอถัดไปคือหน้าส่งมือถือ ไม่มีอะไรของเทิร์นนี้โผล่ให้นักสืบเห็น', en: 'Lock the day, then pass the phone.' },
        cafe: { ring: '#cerealModal .ck-board', finger: true, k: 'เทิร์นแรกของคุณ · 1 / 4', t: 'แตะร้านกาแฟ ☕ ที่จะเริ่ม', b: 'นักสืบเริ่มที่ร้านกาแฟเสมอ วันต่อ ๆ ไปเดินต่อจากที่ยืนอยู่', en: 'Tap a café to start.' },
        move: { ring: '#cerealModal .ck-board', finger: true, k: 'เทิร์นแรกของคุณ · 2 / 4', t: 'เดินได้ถึง 3 ช่อง (+1 ถ้าผ่าน ☕)', b: 'จุดสีน้ำเงินคือช่องที่ไปได้ จะหยุดก่อนครบก็ได้ ไปยืนติด 👁️ แล้วจะถามได้', en: 'Up to 3 steps; stand on or next to the witness to ask.' },
        ask: { ring: '#ck-ask', k: 'เทิร์นแรกของคุณ · 3 / 4', t: 'ถามพยานได้ 1 ใบ', b: 'แอปตอบตามความจริงแทนฆาตกร ใบที่ใช้แล้วใช้ซ้ำไม่ได้ทั้งเกม', en: 'Spend one question card; the app answers truthfully.' },
        arrest: { ring: '#ck-arrest, #ck-end', k: 'เทิร์นแรกของคุณ · 4 / 4', t: '🛡️ จับกุม หรือ ▸ จบเทิร์น', b: 'จับได้เฉพาะช่องที่ยืนหรือช่องติดกัน ผิดเสีย 1 ใน 4 ครั้งและจบเทิร์นทันที', en: 'Arrest your cell or a neighbour, or end the turn.' }
    };
    var croot = null, ckey = null, raf = 0, cau = null;
    function stopCoachVoice() { if (cau) { try { cau.pause(); } catch (_) { /* not started */ } } }
    function playCoachVoice(key) {   // V101.343: the hint reads itself; coach() runs after a tap re-rendered the game, so the phone allows it
        stopCoachVoice(); if (!voiceOn()) return;
        if (!cau) { try { cau = new Audio(); } catch (_) { return; } }
        cau.src = 'cereal-voice/c-' + key + '.mp3?v=' + VOICE_V;
        var p; try { p = cau.play(); } catch (_) { p = null; }
        if (p && p.catch) p.catch(function () { /* refused: the text is on screen */ });
    }
    function coachSeen() { var v = get(COACH); if (v === 'all') return { all: true }; try { return JSON.parse(v || '{}') || {}; } catch (_) { return {}; } }
    function markCoach(key) { var s = coachSeen(); if (s.all) return; s[key] = 1; set(COACH, JSON.stringify(s)); }
    function shown(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function place() {
        raf = 0; if (!croot || !ckey) return;
        var c = COACHES[ckey], ring = croot.querySelector('.ct-ring'), tip = croot.querySelector('.ct-tip'), fing = croot.querySelector('.ct-fing');
        // the ring wraps every listed element that is on screen (kill row + witness row, arrest chip + end button), so the card never sits on the next thing to tap
        var els = [].slice.call(document.querySelectorAll(c.ring)).filter(shown);
        if (!els.length) { croot.style.display = 'none'; return; }
        croot.style.display = '';
        var rs = els.map(function (e) { return e.getBoundingClientRect(); }), vh = window.innerHeight;
        var r = { left: Math.min.apply(null, rs.map(function (b) { return b.left; })), top: Math.min.apply(null, rs.map(function (b) { return b.top; })), right: Math.max.apply(null, rs.map(function (b) { return b.right; })), bottom: Math.max.apply(null, rs.map(function (b) { return b.bottom; })) };
        r.width = r.right - r.left; r.height = r.bottom - r.top;
        ring.style.left = (r.left - 4) + 'px'; ring.style.top = (r.top - 4) + 'px'; ring.style.width = (r.width + 8) + 'px'; ring.style.height = (r.height + 8) + 'px';
        var th = tip.offsetHeight, below = r.bottom + 14 + th <= vh - 8;
        tip.classList.remove('up', 'down'); tip.classList.add(below ? 'up' : 'down');
        tip.style.top = (below ? r.bottom + 14 : Math.max(8, r.top - 14 - th)) + 'px';
        if (fing) { fing.style.left = (r.left + r.width * 0.55) + 'px'; fing.style.top = (r.top + Math.min(30, r.height / 2)) + 'px'; }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(place); }
    /* On scroll the card moves in the same tick (a one-frame lag leaves the stale card over whatever just scrolled under it). */
    function onScroll() { if (raf) { cancelAnimationFrame(raf); raf = 0; } place(); }
    function hideCoach() {
        if (!croot) return;
        stopCoachVoice();
        croot.remove(); croot = null; ckey = null;
        window.removeEventListener('resize', schedule); window.removeEventListener('scroll', onScroll, true);
    }
    /* cereal.js calls this after every render with the step the player is on (null = nothing to coach). */
    function coach(key) {
        if (!key || !COACHES[key] || coachSeen().all || coachSeen()[key] && key !== ckey) { if (key !== ckey) hideCoach(); else place(); return; }
        if (key === ckey) { place(); return; }   // same step, new DOM (a row appeared): move the ring and card now, not a frame later
        style(); hideCoach(); ckey = key; markCoach(key);
        var c = COACHES[key];
        croot = document.createElement('div'); croot.id = 'cerealCoach'; croot.className = 'lang-no-toggle'; croot.setAttribute('data-key', key);
        croot.innerHTML = '<div class="ct-ring" aria-hidden="true"></div>' + (c.finger ? '<div class="ct-fing" aria-hidden="true">👆</div>' : '')
            + '<div class="ct-tip up" role="status"><div class="k">' + c.k + '</div><p class="t">' + c.t + '</p><p class="b">' + c.b + '</p><p class="en">' + c.en + '</p>'
            + '<div class="f"><span style="flex:1"></span><button type="button" class="skip" data-ct="skipall">ข้ามคำใบ้</button><button type="button" class="next" data-ct="ok">เข้าใจแล้ว</button></div></div>';
        croot.addEventListener('click', function (e) {
            var b = e.target.closest('[data-ct]'); if (!b) return;
            if (b.getAttribute('data-ct') === 'skipall') set(COACH, 'all');
            hideCoach();
        });
        document.body.appendChild(croot);
        window.addEventListener('resize', schedule); window.addEventListener('scroll', onScroll, true);
        place(); setTimeout(place, 50);
        playCoachVoice(key);
    }

    window.CKTour = {
        open: open, close: close, seen: function () { return get(SEEN) === '1'; },
        _voice: function () { return au ? { src: au.src, paused: au.paused, blocked: voiceBlocked } : null; },   // QA hook
        _end: function () { if (au && au.onended) au.onended(); },   // QA hook: the clip ends
        coach: coach, hideCoach: hideCoach,
        _interval: function (ms) { INTERVAL = ms; }   // QA hook: shorten the auto-advance
    };
})();
