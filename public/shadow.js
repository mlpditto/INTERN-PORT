/* V101.365 ⚫⚪ ไพ่เงา — a hidden-number duel vs 🤖 (owner pick C + 🧠 at 🥄🥄🥄, mockup-black-white/bw-ABC.png, 2026-11-25).
   Each side holds 0–8 once: evens ⚫ (0 2 4 6 8), odds ⚪ (1 3 5 7). The leader puts a tile face down, the other answers; each sees only the
   other's COLOUR. The higher number takes the round (equal = nobody); the round's winner leads next (a draw keeps the leader). 9 rounds,
   or first to 5. Numbers are never shown until the game ends (then every 🤖 tile is opened so the player can look back).
   Pick C: a 3×3 hand + 📓 notebook (my tile · 🤖 colour · result) and how many ⚫ / ⚪ the 🤖 still holds. 🥄🥄🥄 = 🧠 memory mode, as
   the original: used tiles look unused (a tap says so) and the notebook hides my numbers. The bot infers my possible tiles from
   every colour and result so far (all consistent histories). Reads and writes nothing but localStorage shadowStats. window.BW, bwOpen.
   V101.366 (owner pick B + end screen, mockup-black-white/looks/): a dark popup, the 🤖 tile glows in its colour; the 📓 is one bar
   (📓 n ตา · 🤖 เหลือ ⚫ · ⚪ ▴) that pulls up a sheet; the end screen opens the 🤖 tiles one by one (at once with reduced motion), and
   📤 LINE shares the result (shareTargetPicker → OS share → clipboard, like Cereal); the card's button opens ?bw=1.
   V101.374 (owner pick A, mockup-shadow-tutorial/tutorial-ABC.png): ❓ วิธีเล่น — 4 scenes inside the popup (tiles 0–8 · colour only ·
   higher wins, first to 5 · 📓 + 🥄 levels), each read aloud in Thai (public/shadow-voice/t1…t4.mp3, Paxa foithong, made once; only
   with the game's 🔊 on). Plays on the first open (bwTourSeen) and from ❓ in the lobby; ข้าม / ▸ เริ่ม / ✕ end it and stop the voice. */
(function () {
    'use strict';
    var ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8], WIN_AT = 5, rng = Math.random, g = null, lvl = 2, toast = null, nb = false, shown = 9, revT = null, sent = '';
    // VV101.376 (owner "ทำให้ user เล่น 2 คน", pick A of A+B+C, mockup-shadow-2p/): 📱 2 คน เครื่องเดียว — 1️⃣ and 2️⃣ pass the phone; a cover
    // screen hides the last hand between turns, the round shows colours only, the end opens every number. Not in the 🏆 board (2️⃣ has no login).
    var two = false, P = { me: '1️⃣', bot: '2️⃣' };
    // V101.377 (owner "ควรให้ตั้งชื่อได้ กรณีเล่น 1 เครื่อง"): the two people type their names in the lobby (kept in localStorage bwNames);
    // a name stands in for its 1️⃣ / 2️⃣ everywhere, an empty box keeps the number. 10 chars, escaped (it all goes through innerHTML).
    function clean(x) { return String(x || '').replace(/\s+/g, ' ').trim().slice(0, 10); }
    function esc(x) { return x.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var N = (function () { try { var v = JSON.parse(localStorage.getItem('bwNames') || '{}') || {}; return { me: clean(v.me), bot: clean(v.bot) }; } catch (e) { return { me: '', bot: '' }; } })();
    function nm(x) { return N[x] ? esc(N[x]) : P[x]; }
    function val(id) { var el = document.getElementById(id); return el ? el.value : null; }
    var net = null;   // V101.379 🌐 'online' (with a friend through LINE) · 🔢 'live' (a live room) — shadow-online.js draws them
    function other(s) { return s === 'me' ? 'bot' : 'me'; }
    function side() { return g.lt == null ? g.lead : other(g.lead); }   // whose hand is out now
    var col = function (n) { return n % 2 ? 'w' : 'b'; };
    function S(k, d) { if (window.BWSound) BWSound.play(k, d); }   // V101.369 sounds (shadow-sound.js, pick C) — only from a tap
    function endKey() { return g.sc.me > g.sc.bot ? 'endW' : g.sc.me < g.sc.bot ? 'endL' : 'endD'; }
    function botSays() { if (g && !g.end && g.lead === 'bot' && g.botTile != null) { S('think'); S(col(g.botTile), 0.45); } }   // the colour only
    var CE = { b: '⚫', w: '⚪' };
    // ---- V101.374 ❓ the tour: 4 scenes, each with its Thai clip ----------------------------------------------------------------------
    var tour = -1, aud = null;
    function seen() { try { return !!localStorage.getItem('bwTourSeen'); } catch (e) { return true; } }
    function vOn() { return !window.BWSound || BWSound.on(); }
    function hush() { if (aud) { try { aud.pause(); } catch (e) { } aud = null; } }
    function say(i) { hush(); if (!vOn()) return; try { aud = new Audio('shadow-voice/t' + (i + 1) + '.mp3'); var p = aud.play(); if (p && p.catch) p.catch(function () { /* the phone wants a tap first */ }); } catch (e) { aud = null; } }
    function tourHtml() {
        var i = tour, fig, cap, en;
        if (i === 0) { cap = 'คุณมีไพ่ 0–8 ใช้ได้ใบละครั้ง<br>เลขคู่ ⚫ · เลขคี่ ⚪'; en = 'Tiles 0–8, once each. Even ⚫, odd ⚪.';
            fig = '<div class="bw-hand" aria-hidden="true">' + ALL.map(function (n) { return '<button type="button" tabindex="-1" disabled class="' + col(n) + (n === 6 ? ' sel' : '') + '">' + n + '</button>'; }).join('') + '</div>'; }
        else if (i === 1) { cap = 'ลงคว่ำทีละใบ · อีกฝั่งเห็นแค่ <b>สี</b>'; en = 'Face down: the other side sees only the colour.';
            fig = '<div class="bw-table"><div class="bw-pair"><div>' + t(6, 'huge') + '<small>คุณ</small></div><div>' + back('w', 'huge') + '<small>🤖</small></div></div><div class="bw-note">🤖 ลง ⚪ → เป็น 1 3 5 หรือ 7</div></div>'; }
        else if (i === 2) { cap = 'เลขสูงกว่าได้ตานั้น · ชนะตาไหนลงก่อนตาถัดไป<br>9 ตา · ถึง 5 ก่อนชนะ'; en = 'Higher wins the round · first to 5.';
            fig = '<div class="bw-table"><div class="bw-pair"><div>' + t(6, 'huge') + '<small>คุณ</small></div><div>' + t(3, 'huge') + '<small>🤖</small></div></div><div class="bw-res win">' + RW.win + '</div></div>'; }
        else { cap = '📓 จดให้ว่า 🤖 เหลือ ⚫ กี่ใบ ⚪ กี่ใบ<br>🥄 ง่าย · 🥄🥄 กลาง · 🥄🥄🥄 🧠 จำเอง'; en = 'The notebook counts 🤖 colours left · pick a level.';
            fig = '<div class="bw-bar" aria-hidden="true">📓 1 ตา<span>🤖 เหลือ ⚫ 5 · ⚪ 3</span></div>'; }
        return '<div class="bw bw-tour" id="bw-tour"><div class="bw-top"><h3>❓ วิธีเล่น</h3><span class="bw-pill">' + (i + 1) + '/4</span>' + snd()
            + '<button type="button" class="bw-x" onclick="BW.tourEnd()" aria-label="Close the tour">✕</button></div>'
            + '<div class="bw-say" id="bw-tcap">' + cap + '<small>' + en + '</small></div>' + fig
            + '<div class="bw-tnav"><button type="button" class="bw-tskip" onclick="BW.tourEnd()">ข้าม</button><div class="bw-tdots">' + [0, 1, 2, 3].map(function (n) { return '<i class="' + (n === i ? 'on' : '') + '"></i>'; }).join('') + '</div>'
            + '<button type="button" class="bw-go" id="bw-tnext" onclick="BW.tourNext()">' + (i === 3 ? '▸ เริ่ม' : 'ถัดไป ▸') + '</button></div></div>';
    }
    function get() { try { return JSON.parse(localStorage.getItem('shadowStats') || '{}') || {}; } catch (e) { return {}; } }
    function put(s) { try { localStorage.setItem('shadowStats', JSON.stringify(s)); } catch (e) { } }
    function cmp(a, b) { return a > b ? 'win' : a < b ? 'lose' : 'draw'; }   // from the first argument's side

    // ---- the bot ---------------------------------------------------------------------------------------------------------------
    // Every assignment of numbers to my past colours that agrees with each result vs the bot's (known to it) tiles → how often each
    // number is still in my hand. Small: at most 9 rounds over 5 / 4 numbers.
    function myOdds() {   // every assignment of numbers to my past colours that agrees with each result → the hands I may hold now
        var cnt = {}, hands = [], total = 0; ALL.forEach(function (n) { cnt[n] = 0; });
        (function walk(k, used) {
            if (total > 3000) return;
            if (k === g.hist.length) { total++; var h = ALL.filter(function (n) { return !used[n]; }); hands.push(h); h.forEach(function (n) { cnt[n]++; }); return; }
            var r = g.hist[k];
            ALL.forEach(function (n) { if (!used[n] && col(n) === r.mc && cmp(n, r.b) === r.res) { used[n] = 1; walk(k + 1, used); used[n] = 0; } });
        })(0, {});
        if (!total) { hands.push(g.me.slice()); g.me.forEach(function (n) { cnt[n] = 1; }); total = 1; }
        return { cnt: cnt, total: total, hands: hands };
    }
    // the rest of the game played out at random from a state: 1 = the bot wins, .5 = a draw
    function rollout(me, bot, sm, sb, lead) {
        me = me.slice(); bot = bot.slice();
        while (me.length && sm < WIN_AT && sb < WIN_AT) {
            // me at random; the bot answers with its smallest tile that wins, else its lowest (it sees my tile here — an optimistic playout
            // that values keeping big tiles); when it leads, a random tile
            var x = me.splice(Math.floor(rng() * me.length), 1)[0], y;
            if (lead === 'me') { var up = bot.filter(function (n) { return n > x; }); y = up.length ? Math.min.apply(null, up) : Math.min.apply(null, bot); }
            else y = bot[Math.floor(rng() * bot.length)];
            bot.splice(bot.indexOf(y), 1);
            if (x > y) { sm++; lead = 'me'; } else if (y > x) { sb++; lead = 'bot'; }
        }
        return sb > sm ? 1 : sb === sm ? 0.5 : 0;
    }
    // V101.386 (owner "ทั้งสาม"): 🥄 looks at my colour only — no memory, no maths: it guesses one tile of that colour and answers with
    // its smallest tile above it, else its lowest (half the time just any tile; it leads at random). 🥄🥄 / 🥄🥄🥄: when no tile wins the
    // round 1 time in 3 against the tiles I may hold of that colour it throws its lowest (h.dump, shown on the end card); when a tile wins for sure
    // it uses the smallest such. Otherwise, for each tile, sample hands I may hold (and, when I led, my tile of the colour I showed),
    // play the round and the rest out many times, keep the tile that wins most (🥄🥄 fewer samples + a little noise). 🥄🥄🥄 bluffs:
    // any tile within a hair of the best may come out (more room when it leads), so its colours cannot be read off a pattern.
    var dump = false;
    function lowest(h) { return Math.min.apply(null, h); }
    function botPick(myColour) {
        var hand = g.bot.slice(); dump = false;
        if (hand.length === 1) return hand[0];
        if (lvl === 1) {
            if (!myColour || rng() < 0.5) return hand[Math.floor(rng() * hand.length)];
            var ofC = ALL.filter(function (n) { return col(n) === myColour; }), guess = ofC[Math.floor(rng() * ofC.length)];
            var up1 = hand.filter(function (n) { return n > guess; });
            return up1.length ? lowest(up1) : lowest(hand);
        }
        var o = myOdds(), N = lvl === 3 ? 60 : 14, best = null, bestV = -1, vals = [];
        if (myColour) {
            var may = [], wt = {}, sw = 0; o.hands.forEach(function (h) { var p = h.filter(function (n) { return col(n) === myColour; }); p.forEach(function (n) { if (may.indexOf(n) < 0) may.push(n); wt[n] = (wt[n] || 0) + 1 / p.length; sw += 1 / p.length; }); });
            if (may.length) {
                var lo = lowest(may), hi = Math.max.apply(null, may), sure = hand.filter(function (n) { return n > hi; });
                var pw = function (t) { var a = 0; may.forEach(function (n) { if (n < t) a += wt[n]; }); return a / sw; };
                if (Math.max.apply(null, hand.map(pw)) < 0.35) { dump = true; return lowest(hand); }   // (almost) beaten whatever it plays
                if (sure.length) return lowest(sure);                                                    // a sure win, as cheap as it gets
            }
        }
        hand.forEach(function (t) {
            var v = 0, k = 0;
            for (var i = 0; i < N * 3 && k < N; i++) {
                var h = o.hands[Math.floor(rng() * o.hands.length)], pool = myColour ? h.filter(function (n) { return col(n) === myColour; }) : h;
                if (!pool.length) continue;
                var m = pool[Math.floor(rng() * pool.length)], sm = g.sc.me, sb = g.sc.bot;
                if (m > t) sm++; else if (t > m) sb++;
                v += sm >= WIN_AT ? 0 : sb >= WIN_AT ? 1 : rollout(h.filter(function (n) { return n !== m; }), hand.filter(function (n) { return n !== t; }), sm, sb, m > t ? 'me' : t > m ? 'bot' : g.lead); k++;
            }
            v = k ? v / k : 0; if (lvl === 2) v += (rng() - 0.5) * 0.15;
            vals.push([t, v]); if (v > bestV) { bestV = v; best = t; }
        });
        if (lvl === 3) {   // bluff: any tile this close to the best
            var near = vals.filter(function (x) { return x[1] >= bestV - (myColour ? 0.03 : 0.06); });
            best = near[Math.floor(rng() * near.length)][0];
        }
        return best;
    }

    // ---- game ------------------------------------------------------------------------------------------------------------------
    function newGame(level) {
        lvl = level; g = { me: ALL.slice(), bot: ALL.slice(), hist: [], sc: { me: 0, bot: 0 }, lead: rng() < 0.5 ? 'me' : 'bot', sel: null, botTile: null, last: null, end: false, mem: level === 3 && !two, two: two, lt: null, cover: two };
        if (g.lead === 'bot' && !two) g.botTile = botPick(null);
    }
    function play(n, given) {
        if (!g || g.end || g.last || g.me.indexOf(n) < 0) return;
        dump = false;
        var b = given != null ? given : g.lead === 'bot' ? g.botTile : botPick(col(n)), res = cmp(n, b);
        g.me.splice(g.me.indexOf(n), 1); g.bot.splice(g.bot.indexOf(b), 1);
        g.hist.push({ m: n, b: b, mc: col(n), bc: col(b), res: res, lead: g.lead, dump: dump && given == null && !g.two });
        if (res === 'win') g.sc.me++; else if (res === 'lose') g.sc.bot++;
        g.last = g.hist[g.hist.length - 1]; g.sel = null; g.botTile = null;
        if (res !== 'draw') g.lead = res === 'win' ? 'me' : 'bot';
        if (g.sc.me >= WIN_AT || g.sc.bot >= WIN_AT || g.hist.length === 9) finish();
    }
    function next() {
        if (!g || g.end || !g.last) return;
        g.last = null; if (g.two) g.cover = true; else if (g.lead === 'bot') g.botTile = botPick(null); render();
    }
    function finish() {
        g.end = true; var s = get(), k = 'l' + lvl, r = g.sc.me > g.sc.bot ? 'w' : g.sc.me < g.sc.bot ? 'l' : 'd';
        if (!g.two) { s[k] = s[k] || { w: 0, l: 0, d: 0 }; s[k][r]++; put(s); }
        nb = false; sent = ''; clearInterval(revT); var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        shown = still ? g.hist.length : 0;   // §9.3: no motion → every tile at once
        // V101.369: each 🤖 tile sounds its number as it opens (the only time a number has a sound), then the end tune
        if (!still) revT = setInterval(function () { if (!g || !g.end) return clearInterval(revT); shown++; S('n' + g.hist[shown - 1].b); if (shown >= g.hist.length) { clearInterval(revT); S(endKey(), 0.3); } render(); }, 450);
    }

    // ---- drawing ---------------------------------------------------------------------------------------------------------------
    var CSS = '#bwModal{z-index:10000}#bwModal .modal-content{text-align:left;padding:18px 18px calc(20px + env(safe-area-inset-bottom));width:calc(100% - 20px);max-width:440px;max-height:92vh;box-sizing:border-box;overflow:auto}'
        + '#bwModal .bw{display:flex;flex-direction:column;gap:12px;color:#0f172a;font-variant-numeric:tabular-nums}#bwModal .bw button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#bwModal .bw button:focus-visible{outline:3px solid #f97316;outline-offset:2px}'
        + '.bw-top{display:flex;align-items:center;gap:6px}.bw-top h3{margin:0;flex:1;font-size:1.05em;font-weight:900;white-space:nowrap}.bw-pill{border-radius:999px;padding:3px 9px;font-weight:800;font-size:.82em;background:#f1f5f9;white-space:nowrap}.bw-pill.sc{background:#fef3c7}'
        + '#bwModal .bw-x{background:none;border:0;color:#94a3b8;font-size:1.1em;padding:2px 4px}#bwModal .bw-snd{background:none;border:0;font-size:1em;padding:2px 4px;min-width:30px}'
        + '.bw-t{display:inline-flex;align-items:center;justify-content:center;width:30px;height:40px;border-radius:7px;font-weight:900;font-size:17px;box-sizing:border-box;flex:0 0 auto;vertical-align:middle}'
        + '.bw-t.b{background:#0f172a;color:#fff}.bw-t.w{background:#fff;color:#0f172a;border:2px solid #0f172a}'
        + '.bw-t.back{color:transparent;background-image:repeating-linear-gradient(45deg,transparent 0 5px,rgba(148,163,184,.35) 5px 7px)}.bw-t.back.b{background-color:#0f172a}.bw-t.back.w{background-color:#fff}'
        + '.bw-t.mini{width:22px;height:28px;font-size:13px;border-radius:5px}.bw-t.huge{width:74px;height:100px;font-size:40px;border-radius:12px}'
        + '.bw-dots{display:flex;gap:6px;justify-content:center}.bw-dots i{width:18px;height:18px;border-radius:50%;background:#e2e8f0;box-sizing:border-box;display:block}'
        + '.bw-dots i.win{background:#16a34a}.bw-dots i.lose{background:#dc2626}.bw-dots i.draw{background:#94a3b8}.bw-dots i.b{box-shadow:inset 0 0 0 4px #0f172a}.bw-dots i.w{box-shadow:inset 0 0 0 4px #fff,0 0 0 1px #0f172a}.bw-dots i.now{background:#fff;border:2px dashed #f97316}'
        + '.bw-table{display:flex;flex-direction:column;align-items:center;gap:8px;background:#f8fafc;border-radius:14px;padding:12px;min-height:128px;justify-content:center}.bw-pair{display:flex;align-items:center;gap:14px}.bw-pair small{display:block;text-align:center;font-size:11px;color:#64748b;font-weight:700;margin-top:3px}'
        + '.bw-note{font-size:.85em;font-weight:800;color:#475569;text-align:center}.bw-res{font-weight:900;border-radius:12px;padding:6px 14px}.bw-res.win{background:#dcfce7;color:#166534}.bw-res.lose{background:#fee2e2;color:#991b1b}.bw-res.draw{background:#f1f5f9;color:#334155}'
        + '.bw-hand{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#bwModal .bw-hand button{height:48px;border-radius:10px;font-size:22px;font-weight:900;padding:0}#bwModal .bw-hand button.b{background:#0f172a;color:#fff;border:0}#bwModal .bw-hand button.w{background:#fff;color:#0f172a;border:2px solid #0f172a}'
        + '#bwModal .bw-hand button.used{opacity:.18}#bwModal .bw-hand button.sel{outline:3px solid #f97316;outline-offset:2px}#bwModal .bw-hand button:disabled{cursor:default}'
        + '#bwModal .bw-go{border:0;border-radius:14px;background:#0f172a;color:#fff;font-weight:900;font-size:1.05em;padding:11px;display:flex;align-items:center;justify-content:center;gap:8px}#bwModal .bw-go:disabled{opacity:.4}#bwModal .bw-go.alt{background:#f1f5f9;color:#0f172a}'
        + '.bw-nb{border-top:1px solid #e2e8f0;padding-top:8px;display:flex;flex-direction:column;gap:4px}.bw-lbl{font-size:12px;font-weight:900;color:#64748b;display:flex;gap:6px;align-items:center}.bw-lbl span{margin-left:auto;color:#0f172a}'
        + '.bw-r{display:flex;align-items:center;gap:6px;font-size:13px;color:#64748b}.bw-r .d{font-weight:900;width:14px}.bw-r .rs{margin-left:auto;font-weight:900;font-size:12px}.bw-r .rs.win{color:#166534}.bw-r .rs.lose{color:#991b1b}'
        // V101.366 pick B: dark — the 🤖 tile glows violet (⚫) / white (⚪); the 📓 is a bar that pulls up a sheet
        + '#bwModal .modal-content{background:#14122b;color:#e2e8f0;box-shadow:inset 0 0 0 1px #2e2a5a}#bwModal .bw{color:#e2e8f0}#bwModal .bw-top h3{color:#e9d5ff;min-width:0;overflow:hidden;text-overflow:ellipsis}'
        + '#bwModal .bw-pill{background:#25224a;color:#c4b5fd}#bwModal .bw-pill.sc{background:#3b2f12;color:#fcd34d}#bwModal .bw-x{color:#6b7280}'
        + '#bwModal .bw-table{background:radial-gradient(circle at 50% 40%,#2a2457 0,#14122b 70%)}#bwModal .bw-note,#bwModal .bw-rule{color:#a5b4fc}'
        + '#bwModal .bw-table .bw-t.huge.back.b{background-color:#0b0a1a;box-shadow:0 0 0 1px #6d28d9,0 0 22px 4px rgba(139,92,246,.55)}#bwModal .bw-table .bw-t.huge.back.w{box-shadow:0 0 0 1px #e2e8f0,0 0 22px 4px rgba(226,232,240,.45)}'
        + '#bwModal .bw-t.b{background:#0b0a1a;box-shadow:inset 0 0 0 1px #3f3a74}#bwModal .bw-t.w{background:#ece9ff;border-color:#ece9ff}'
        + '#bwModal .bw-hand button.b{background:#0b0a1a;border:1px solid #3f3a74;color:#e9d5ff}#bwModal .bw-hand button.w{background:#ece9ff;border:2px solid #ece9ff;color:#14122b}'
        + '#bwModal .bw-hand button.sel{outline:3px solid #f59e0b;box-shadow:0 0 14px rgba(245,158,11,.6)}#bwModal .bw-go{background:#6d28d9}#bwModal .bw-go:disabled{opacity:.35}#bwModal .bw-go.alt{background:#25224a;color:#e9d5ff}'
        + '#bwModal .bw-dots i{background:#25224a}#bwModal .bw-dots i.win{background:#22c55e}#bwModal .bw-dots i.lose{background:#ef4444}#bwModal .bw-dots i.draw{background:#64748b}#bwModal .bw-dots i.now{background:transparent}#bwModal .bw-dots i.b{box-shadow:inset 0 0 0 4px #7c3aed}#bwModal .bw-dots i.w{box-shadow:inset 0 0 0 4px #e2e8f0}'
        + '#bwModal .bw-res.win{background:#1c3a2a;color:#86efac}#bwModal .bw-res.lose{background:#3a1c1c;color:#fca5a5}#bwModal .bw-res.draw{background:#25224a;color:#e2e8f0}'
        + '#bwModal .bw-nb{border-color:#2e2a5a}#bwModal .bw-lbl,#bwModal .bw-lbl span{color:#a5b4fc}#bwModal .bw-r{color:#94a3b8}#bwModal .bw-r.now{background:rgba(139,92,246,.18);border-radius:8px}'
        + '#bwModal .bw .bw-lvs button{background:#1d1a3d;border-color:#2e2a5a;color:#e9d5ff}#bwModal .bw .bw-lvs button.on{background:#6d28d9;border-color:#6d28d9;color:#fff}'
        + '#bwModal .bw-bar{display:flex;align-items:center;gap:6px;border:1px solid #2e2a5a;border-radius:12px;padding:8px 10px;background:none;color:#a5b4fc;font-weight:900;font-size:12px;width:100%}#bwModal .bw-bar span{margin-left:auto}'
        + '#bwModal .bw-sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:400px;max-height:70vh;overflow:auto;background:#1d1a3d;border-radius:18px 18px 0 0;padding:12px 14px calc(18px + env(safe-area-inset-bottom));z-index:10001;box-shadow:0 -10px 30px rgba(0,0,0,.5);box-sizing:border-box}'
        + '#bwModal .bw-top .bw-fin{border-radius:999px;padding:3px 10px;white-space:nowrap}.bw-t.mid{width:26px;height:34px;font-size:16px;border-radius:6px}@media (min-width:360px){.bw-t.mid{width:30px;height:40px;font-size:18px}}'
        + '#bwModal .bw-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;cursor:pointer}#bwModal .bw-card{position:relative;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:12px;padding:16px 2px 10px;background:#1d1a3d;box-shadow:inset 4px 0 0 #3f3a74;font-size:11px;color:#94a3b8}'
        + '#bwModal .bw-card .d{position:absolute;top:3px;left:9px;font-size:10px;font-weight:900;color:#6b7280}#bwModal .bw-card.win{background:#17302a;box-shadow:inset 4px 0 0 #22c55e}#bwModal .bw-card.lose{background:#2e1a24;box-shadow:inset 4px 0 0 #ef4444}#bwModal .bw-card.draw{box-shadow:inset 4px 0 0 #94a3b8}#bwModal .bw-card.now{outline:2px solid #a78bfa}#bwModal .bw-card.dump::after{content:"🏳";position:absolute;top:2px;right:6px;font-size:11px}'
        + '#bwModal .bw-act{display:flex;gap:8px}#bwModal .bw-act #bw-again{flex:1}#bwModal .bw-act .ic{flex:0 0 58px;padding:0}#bwModal .bw-act .done{color:#86efac}'
        + '.bw-lvs{display:flex;gap:6px;justify-content:center}#bwModal .bw-lvs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 12px;font-weight:800}#bwModal .bw-lvs button.on{border-color:#0f172a;background:#0f172a;color:#fff}'
        + '.bw-rule{font-size:.85em;color:#475569;text-align:center;line-height:1.6}.bw-toast{text-align:center;font-size:.85em;font-weight:800;color:#b45309}'
        + '#bwModal .bw-names{display:flex;gap:8px}#bwModal .bw-names input{flex:1;min-width:0;width:0;padding:10px 12px;border-radius:12px;border:1px solid #2e2a5a;background:#1d1a3d;color:#f5f3ff;font:inherit;font-size:16px;font-weight:800;text-align:center}#bwModal .bw-names input::placeholder{color:#8b87c9;font-weight:600}'   // V101.377 names
        + '#bwModal .bw-who{flex-wrap:nowrap}#bwModal .bw-who button{flex:1;min-width:0;padding-left:4px;padding-right:4px;white-space:nowrap;font-size:.85em}'   // V101.379
        + '#bwModal .bw-cover{min-height:440px;text-align:center}#bwModal .bw-cv{font-size:54px;margin-top:auto}#bwModal .bw-cvt{font-size:1.3em;font-weight:900;color:#e9d5ff}#bwModal .bw-cover .bw-go{margin-top:auto}'   // VV101.376 📱 2 คน
        // V101.374 ❓ tour — fixed height so ถัดไป ▸ never moves
        + '#bwModal .bw-tour{min-height:440px}#bwModal .bw-say{background:#1d1a3d;border:1px solid #3f3a74;border-radius:14px;padding:10px 12px;font-weight:800;line-height:1.5;color:#e9d5ff}'
        + '#bwModal .bw-say small{display:block;font-size:.72em;font-weight:600;color:#8b87c9;margin-top:2px}#bwModal .bw-tour .bw-hand button:disabled{cursor:default}'
        + '#bwModal .bw-tnav{display:flex;align-items:center;gap:8px;margin-top:auto}#bwModal .bw-tnav .bw-go{padding:11px 18px}#bwModal .bw-tskip{background:none;border:0;color:#8b87c9;font-weight:800;padding:6px 4px}'
        + '#bwModal .bw-tdots{flex:1;display:flex;gap:4px;justify-content:center}#bwModal .bw-tdots i{width:6px;height:6px;border-radius:9px;background:#3f3a74;display:block}#bwModal .bw-tdots i.on{width:16px;background:#a78bfa}';
    function root() {
        var m = document.getElementById('bwModal');
        if (!m) {
            if (!document.getElementById('bw-css')) { var st = document.createElement('style'); st.id = 'bw-css'; st.textContent = CSS; document.head.appendChild(st); }
            m = document.createElement('div'); m.id = 'bwModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Shadow tiles');
            m.innerHTML = '<div class="modal-content"><div id="bw-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) BW.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function t(n, cls) { return '<span class="bw-t ' + col(n) + (cls ? ' ' + cls : '') + '">' + n + '</span>'; }
    function back(c, cls) { return '<span class="bw-t back ' + c + (cls ? ' ' + cls : '') + '" aria-label="' + (c === 'b' ? 'black' : 'white') + ' tile">?</span>'; }
    function snd() { var o = !window.BWSound || BWSound.on(); return '<button type="button" class="bw-snd" id="bw-snd" onclick="BW.sound()" aria-label="Sound" aria-pressed="' + o + '">' + (o ? '🔊' : '🔇') + '</button>'; }
    var X = '<button type="button" class="bw-x" onclick="BW.close()" aria-label="Close">✕</button>';
    var RW = { win: '🏆 ชนะ', lose: '😞 แพ้', draw: '🤝 เสมอ' };
    function lobbyHtml() {
        var s = get();
        return '<div class="bw"><div class="bw-top"><h3>⚫⚪ ไพ่เงา</h3><button type="button" class="bw-snd" id="bw-help" onclick="BW.tour()" aria-label="How to play" title="How to play" data-th-title="วิธีเล่น">❓</button>' + snd() + X + '</div>'
            + (window.GameTop ? GameTop.line('bw', true) : '')   // V101.375 🏆 Top 3 (game-top.js)
            + '<div class="bw-rule">ไพ่ 0–8 คนละชุด · คู่ ⚫ คี่ ⚪<br>เห็นแค่สีของอีกฝั่ง · เลขสูงกว่าชนะตานั้น<br>9 ตา · ถึง 5 ก่อนชนะ</div>'
            + '<div class="bw-lvs bw-who" role="group" aria-label="Who">' + [['bot', '🤖 บอท'], ['two', '📱 2 คน'], ['online', '🌐 เพื่อน'], ['live', '🔢 ห้องสด']].filter(function (k) { return k[0] === 'bot' || k[0] === 'two' || window.BWOnline; }).map(function (k) { var on = k[0] === 'bot' ? !two && !net : k[0] === 'two' ? two : net === k[0]; return '<button type="button" id="bw-who-' + k[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="BW.who(\'' + k[0] + '\')">' + k[1] + '</button>'; }).join('') + '</div>'
            + (net && window.BWOnline ? BWOnline.lobbyHtml(net === 'live') + '</div>' : '')
            + (net && window.BWOnline ? '' : two ? '<div class="bw-names"><input id="bw-n1" maxlength="10" placeholder="1️⃣ ชื่อ" value="' + esc(N.me) + '" aria-label="Player 1 name" autocomplete="off"><input id="bw-n2" maxlength="10" placeholder="2️⃣ ชื่อ" value="' + esc(N.bot) + '" aria-label="Player 2 name" autocomplete="off"></div><div class="bw-note" id="bw-two-note">ส่งเครื่องให้กันทีละตา · ไม่ต้องใช้เน็ต</div>' : '<div class="bw-lvs">' + [1, 2, 3].map(function (n) { var r = s['l' + n]; return '<button type="button" class="' + (lvl === n ? 'on' : '') + '" id="bw-lv' + n + '" onclick="BW.level(' + n + ')" title="' + ['', 'ง่าย', 'กลาง', 'ยาก · 🧠 จำเอง'][n] + '">' + '🥄'.repeat(n) + (n === 3 ? ' 🧠' : '') + (r ? ' · ' + r.w + '/' + (r.w + r.l + r.d) : '') + '</button>'; }).join('') + '</div>')
            + (net && window.BWOnline ? '' : (lvl === 3 && !two ? '<div class="bw-note">🧠 ไพ่ที่ลงแล้วไม่จาง · สมุดไม่บอกเลขคุณ</div>' : '')
            + '<button type="button" class="bw-go" id="bw-start" onclick="BW.start()">▸ เริ่ม</button></div>');
    }
    function dots() {
        var h = '<div class="bw-dots" aria-label="Rounds">';
        for (var i = 0; i < 9; i++) { var r = g.hist[i]; h += '<i class="' + (r ? r.res + ' ' + r.bc : i === g.hist.length && !g.end ? 'now' : '') + '"></i>'; }
        return h + '</div>';
    }
    function botLeft() { var b = g.bot.filter(function (n) { return col(n) === 'b'; }).length - (g.botTile != null && col(g.botTile) === 'b' ? 1 : 0), w = g.bot.length - (g.botTile != null ? 1 : 0) - b; return '🤖 เหลือ ⚫ ' + b + ' · ⚪ ' + w; }
    function play2Html() {   // VV101.376 📱 2 คน
        var L = g.last, a = side(), top = '<div class="bw-top"><h3>⚫⚪ ไพ่เงา</h3><span class="bw-pill">' + Math.min(9, g.hist.length + (L ? 0 : 1)) + '/9</span><span class="bw-pill sc" id="bw-score">' + nm('me') + ' ' + g.sc.me + ' : ' + g.sc.bot + ' ' + nm('bot') + '</span>' + snd() + X + '</div>';
        if (g.cover) return '<div class="bw bw-cover" id="bw-cover">' + top + '<div class="bw-cv">📱🔁</div><div class="bw-cvt" id="bw-cvt">ส่งเครื่องให้ ' + nm(a) + '</div>'
            + '<div class="bw-note">' + (g.lt != null ? nm(g.lead) + ' ลงแล้ว · ' + nm(a) + ' จะเห็นแค่ ' + CE[col(g.lt)] : g.hist.length ? 'ไพ่ของ ' + nm(other(a)) + ' ซ่อนแล้ว' : nm(a) + ' ลงก่อน') + '</div>'
            + '<button type="button" class="bw-go" id="bw-ready" onclick="BW.ready()">👆 ' + nm(a) + ' แตะเมื่อพร้อม</button></div>';
        var h = '<div class="bw">' + top + dots() + '<div class="bw-table" id="bw-table">';
        if (L) h += '<div class="bw-pair"><div>' + back(L.mc, 'huge') + '<small>' + nm('me') + '</small></div><div>' + back(L.bc, 'huge') + '<small>' + nm('bot') + '</small></div></div><div class="bw-res ' + L.res + '" id="bw-res">' + (L.res === 'draw' ? RW.draw : '🏆 ' + nm(L.res === 'win' ? 'me' : 'bot') + ' ชนะตานี้') + '</div>';
        else if (g.lt != null) h += back(col(g.lt), 'huge') + '<div class="bw-note" id="bw-say">' + nm(g.lead) + ' ลง ' + CE[col(g.lt)] + ' · ตา ' + nm(a) + '</div>';
        else h += '<div class="bw-note" id="bw-say">' + nm(a) + ' ลงก่อน · อีกฝั่งเห็นแค่สี</div>';
        h += '</div>';
        if (L) h += '<button type="button" class="bw-go" id="bw-next" onclick="BW.next()">▸ ต่อ</button>';
        else {
            var hand = g[a];
            h += '<div class="bw-hand" id="bw-hand">' + ALL.map(function (n) { var used = hand.indexOf(n) < 0; return '<button type="button" class="' + col(n) + (used ? ' used' : '') + (g.sel === n ? ' sel' : '') + '" data-n="' + n + '" onclick="BW.pick(' + n + ')"' + (used ? ' disabled' : '') + '>' + n + '</button>'; }).join('') + '</div>'
                + '<button type="button" class="bw-go" id="bw-play" onclick="BW.play()"' + (g.sel == null ? ' disabled' : '') + '>▸ ' + nm(a) + ' ลง' + (g.sel != null ? ' ' + t(g.sel, 'mini') : '') + '</button>';
        }
        if (g.hist.length) {   // 📓: colours only — both people read this phone
            var left = function (s) { var b = g[s].filter(function (n) { return col(n) === 'b'; }).length; return nm(s) + ' ⚫ ' + b + ' · ⚪ ' + (g[s].length - b); };
            var bar = '<button type="button" class="bw-bar" id="bw-nb" aria-expanded="' + nb + '" onclick="BW.nb()">📓 ' + g.hist.length + ' ตา<span id="bw-left">' + left('me') + '  ' + left('bot') + ' ' + (nb ? '▾' : '▴') + '</span></button>';
            h += nb ? '<div class="bw-sheet" id="bw-sheet">' + bar + '<div class="bw-nb">' + g.hist.map(function (r, i) {
                return '<div class="bw-r"><span class="d">' + (i + 1) + '</span>' + back(r.mc, 'mini') + ' vs ' + back(r.bc, 'mini') + '<span class="rs ' + r.res + '">' + (r.res === 'draw' ? RW.draw : nm(r.res === 'win' ? 'me' : 'bot')) + '</span></div>';
            }).join('') + '</div></div>' : bar;
        }
        return h + '</div>';
    }
    function playHtml() {
        if (g.two) return play2Html();
        var L = g.last, h = '<div class="bw"><div class="bw-top"><h3>⚫⚪ ไพ่เงา</h3><span class="bw-pill">' + Math.min(9, g.hist.length + (L ? 0 : 1)) + '/9</span><span class="bw-pill sc" id="bw-score">คุณ ' + g.sc.me + ' : ' + g.sc.bot + ' 🤖</span>' + snd() + X + '</div>' + dots();
        h += '<div class="bw-table" id="bw-table">';
        if (L) h += '<div class="bw-pair"><div>' + t(L.m, 'huge') + '<small>คุณ</small></div><div>' + back(L.bc, 'huge') + '<small>🤖</small></div></div><div class="bw-res ' + L.res + '" id="bw-res">' + RW[L.res] + '</div>';
        else if (g.lead === 'bot') h += back(col(g.botTile), 'huge') + '<div class="bw-note" id="bw-say">🤖 ลง ' + CE[col(g.botTile)] + ' · ตาคุณ</div>';
        else h += '<div class="bw-note" id="bw-say">คุณลงก่อน · 🤖 จะเห็นแค่สี</div>';
        h += '</div>';
        if (L) h += '<button type="button" class="bw-go" id="bw-next" onclick="BW.next()">▸ ต่อ</button>';
        else {
            h += '<div class="bw-hand" id="bw-hand">' + ALL.map(function (n) {
                var used = g.me.indexOf(n) < 0;
                return '<button type="button" class="' + col(n) + (used && !g.mem ? ' used' : '') + (g.sel === n ? ' sel' : '') + '" data-n="' + n + '" onclick="BW.pick(' + n + ')"' + (used && !g.mem ? ' disabled' : '') + '>' + n + '</button>';
            }).join('') + '</div>' + (toast ? '<div class="bw-toast" id="bw-toast">' + toast + '</div>' : '')
                + '<button type="button" class="bw-go" id="bw-play" onclick="BW.play()"' + (g.sel == null ? ' disabled' : '') + '>▸ ลง' + (g.sel != null ? ' ' + t(g.sel, 'mini') : '') + '</button>';
        }
        // V101.366 pick B: one bar; a tap pulls the 📓 up from the bottom (hidden until the first round is played — §2.2)
        if (g.hist.length) {
            var bar = '<button type="button" class="bw-bar" id="bw-nb" aria-expanded="' + nb + '" onclick="BW.nb()">📓 ' + g.hist.length + ' ตา<span id="bw-left">' + botLeft() + ' ' + (nb ? '▾' : '▴') + '</span></button>';
            h += nb ? '<div class="bw-sheet" id="bw-sheet">' + bar + '<div class="bw-nb">' + g.hist.map(function (r, i) {
                return '<div class="bw-r"><span class="d">' + (i + 1) + '</span>' + (g.mem ? back(r.mc, 'mini') : t(r.m, 'mini')) + ' vs ' + back(r.bc, 'mini') + '<span class="rs ' + r.res + '">' + RW[r.res] + '</span></div>';
            }).join('') + '</div></div>' : bar;
        }
        return h + '</div>';
    }
    // V101.369 (owner: "lean + inline", pick B · การ์ด 3×3, mockup-bw-end-lean/): the result sits in the header line, no dots row, a card a
    // round (my tile vs the 🤖 tile, the left bar = its result, still opening one by one), one action row ↺ อีกตา · 📤 (✓ once sent) · 🥄
    function endHtml() {
        var r = g.sc.me > g.sc.bot ? 'win' : g.sc.me < g.sc.bot ? 'lose' : 'draw';
        return '<div class="bw"><div class="bw-top"><h3>⚫⚪ จบเกม</h3><span class="bw-res bw-fin ' + (g.two ? (r === 'draw' ? 'draw' : 'win') : r) + '" id="bw-final">' + (g.two ? (r === 'draw' ? '🤝 ' : '🏆 ' + nm(r === 'win' ? 'me' : 'bot') + ' ') + nm('me') + ' ' + g.sc.me + ' : ' + g.sc.bot + ' ' + nm('bot') : { win: '🏆', lose: '😞', draw: '🤝' }[r] + ' ' + g.sc.me + ' : ' + g.sc.bot) + '</span>' + snd() + X + '</div>'
            + '<div class="bw-cards" id="bw-reveal" onclick="BW.showAll()" aria-label="Rounds">' + g.hist.map(function (x, i) {
                var open = i < shown;   // V101.366: one by one; a tap opens the rest
                return '<div class="bw-card' + (open ? ' ' + x.res + (x.dump ? ' dump' : '') : '') + (i === shown - 1 && shown < g.hist.length ? ' now' : '') + '"><span class="d">' + (i + 1) + '</span>' + t(x.m, 'mid') + '<small>vs</small>' + (open ? t(x.b, 'mid') : back(x.bc, 'mid')) + '</div>';
            }).join('') + '</div>'
            + '<div class="bw-act"><button type="button" class="bw-go" id="bw-again" onclick="BW.start()">↺ อีกตา</button>'
            + (g.two ? '' : '<button type="button" class="bw-go alt ic' + (sent ? ' done' : '') + '" id="bw-share" onclick="BW.share()" title="Share in LINE" data-th-title="แชร์ผลใน LINE" aria-label="' + (sent || 'Share in LINE') + '">' + (sent ? '✓' : '📤') + '</button>')
            + '<button type="button" class="bw-go alt ic" id="bw-lvl" onclick="BW.lobby()" title="Change level" data-th-title="เปลี่ยนระดับ" aria-label="เปลี่ยนระดับ">' + (g.two ? '📱' : '🥄'.repeat(lvl)) + '</button></div></div>';
    }
    function render() { var m = root(); document.getElementById('bw-body').innerHTML = tour >= 0 ? tourHtml() : window.BWOnline && BWOnline.active() ? BWOnline.html() : !g ? lobbyHtml() : g.end ? endHtml() : playHtml(); m.style.display = 'flex';
        if (g && tour < 0 && !(window.BWOnline && BWOnline.active()) && window.GameLog) GameLog.see('bw', { id: g.gid || (g.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), n: g.hist.length, done: g.end, mode: g.two ? 'two' : 'l' + lvl, win: g.two ? null : g.sc.me > g.sc.bot ? 'w' : g.sc.me < g.sc.bot ? 'l' : 'd', score: g.sc.me + ':' + g.sc.bot, res: g.hist.map(function (h) { return h.res; }) });   // V101.370 🎮 game time for the admin (game-log.js)
    }

    window.BW = {
        open: function () { g = null; toast = null; if (!seen()) return BW.tour(); render(); },
        tour: function () { tour = 0; render(); say(0); },   // V101.374 ❓
        tourNext: function () { if (tour < 0) return; if (tour < 3) { tour++; render(); say(tour); } else BW.tourEnd(); },
        tourEnd: function () { hush(); tour = -1; try { localStorage.setItem('bwTourSeen', '1'); } catch (e) { } render(); },
        lobby: function () { clearInterval(revT); g = null; nb = false; render(); },
        nb: function () { nb = !nb; render(); },
        showAll: function () { if (g && g.end && shown < g.hist.length) { clearInterval(revT); shown = g.hist.length; S(endKey()); render(); } },
        sound: function () { if (window.BWSound && BWSound.toggle()) S('pick'); if (tour >= 0) { if (vOn()) say(tour); else hush(); } render(); },
        share: function () {   // V101.366: a Flex card via shareTargetPicker → the OS share sheet → the clipboard (as Cereal)
            if (!g || !g.end) return;
            var r = g.sc.me > g.sc.bot ? 'win' : g.sc.me < g.sc.bot ? 'lose' : 'draw', head = (r === 'win' ? '🏆 ชนะ ' : r === 'lose' ? '😞 แพ้ ' : '🤝 เสมอ ') + g.sc.me + ' : ' + g.sc.bot;
            var uri = 'https://liff.line.me/' + (typeof USER_LIFF_ID !== 'undefined' ? USER_LIFF_ID : '') + '?bw=1', alt = '⚫⚪ ไพ่เงา · ' + head + ' vs 🤖 ' + '🥄'.repeat(lvl);
            var dots = g.hist.map(function (h) { return h.res === 'win' ? '🟢' : h.res === 'lose' ? '🔴' : '⚪'; }).join('');
            var card = { type: 'flex', altText: alt, contents: { type: 'bubble', size: 'kilo',
                header: { type: 'box', layout: 'vertical', backgroundColor: '#14122b', paddingAll: '16px', contents: [
                    { type: 'text', text: '⚫⚪ ไพ่เงา', color: '#c4b5fd', size: 'xs', weight: 'bold' }, { type: 'text', text: head, color: '#ffffff', size: 'xl', weight: 'bold' }] },
                body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'text', text: 'vs 🤖 ' + '🥄'.repeat(lvl), size: 'sm', color: '#3c3c3c' }, { type: 'text', text: dots, size: 'sm', wrap: true }] },
                footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#6d28d9', height: 'sm', action: { type: 'uri', label: '⚫ เล่นบ้าง', uri: uri } }] } } };
            var text = alt + '\n' + uri, done = function (ok) { if (ok) { sent = '📤 ส่งแล้ว'; render(); } };
            var viaLine = window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker') && (!liff.isLoggedIn || liff.isLoggedIn()) ? Promise.resolve(liff.shareTargetPicker([card])).then(function (x) { return x ? 'sent' : 'closed'; }, function () { return null; }) : Promise.resolve(null);
            return viaLine.then(function (x) {
                if (x === 'sent') return done(true); if (x === 'closed') return;
                if (navigator.share) return navigator.share({ text: text }).then(function () { done(true); }, function () { });
                try { navigator.clipboard.writeText(text).then(function () { sent = '📋 คัดลอกแล้ว'; render(); }, function () { }); } catch (e) { }
            });
        },
        level: function (n) { lvl = n; render(); },
        who: function (k) { two = k === 'two'; net = k === 'online' || k === 'live' ? k : null; g = null; render(); },
        online: function () { two = false; net = 'online'; g = null; render(); },   // V101.379 ?bw=<code> from an invite card
        _render: function () { if (document.getElementById('bwModal') && document.getElementById('bwModal').style.display === 'flex') render(); },   // VV101.376 🤖 │ 📱 2 คน
        ready: function () { if (g && g.two && g.cover) { g.cover = false; S('pick'); render(); } },
        start: function () {
            if (two && val('bw-n1') !== null) { N.me = clean(val('bw-n1')); N.bot = clean(val('bw-n2')); try { localStorage.setItem('bwNames', JSON.stringify(N)); } catch (e) { } }   // V101.377
            clearInterval(revT); toast = null; nb = false; newGame(lvl); if (!two) botSays(); render();
        },
        pick: function (n) { if (!g || g.end || g.last || g.cover) return; toast = null; if (g.two) { if (g[side()].indexOf(n) >= 0) { g.sel = n; S('pick'); render(); } return; } if (g.me.indexOf(n) < 0) { toast = '🧠 ' + n + ' ลงไปแล้ว'; g.sel = null; S('oops'); } else { g.sel = n; S('pick'); } render(); },
        play: function () {
            if (!g || g.sel == null || g.cover) return;
            if (g.two) {   // 📱 the leader's tile waits face down; the follower's resolves the round
                if (g.lt == null) { g.lt = g.sel; g.sel = null; g.cover = true; S('place'); return render(); }
                var f = g.sel, lt = g.lt; g.lt = null; if (g.lead === 'me') play(lt, f); else play(f, lt);
                S('place'); S(g.hist[g.hist.length - 1].res, 0.3); if (g.end && shown >= g.hist.length) S(endKey(), 0.6); return render();
            }
            var led = g.lead; play(g.sel); var L = g.hist[g.hist.length - 1], at = 0.25; S('place');
            if (!g.end && led === 'me') { S('think', at); S(L.bc, at += 0.45); }   // I led: 🤖 answers with a colour
            S(L.res, g.end ? 0.2 : at + 0.35);
            if (g.end && shown >= g.hist.length) S(endKey(), 0.6);   // reduced motion: every tile opens at once → the tune now
            render();
        },
        next: function () { var was = g && g.last; next(); if (was && !(g && g.two)) botSays(); },
        close: function () { if (window.BWOnline) BWOnline.close(); clearInterval(revT); hush(); tour = -1; g = null; nb = false; var m = document.getElementById('bwModal'); if (m) m.style.display = 'none'; },
        // for scripts/shadow-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _odds: function () { return myOdds(); }, _botPick: function (c) { return botPick(c); }
    };
    window.bwOpen = function () { BW.open(); };
})();
