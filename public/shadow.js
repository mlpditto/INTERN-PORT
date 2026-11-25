/* V101.365 ⚫⚪ ไพ่เงา — a hidden-number duel vs 🤖 (owner pick C + 🧠 at 🥄🥄🥄, mockup-black-white/bw-ABC.png, 2026-11-25).
   Each side holds 0–8 once: evens ⚫ (0 2 4 6 8), odds ⚪ (1 3 5 7). The leader puts a tile face down, the other answers; each sees only the
   other's COLOUR. The higher number takes the round (equal = nobody); the round's winner leads next (a draw keeps the leader). 9 rounds,
   or first to 5. Numbers are never shown until the game ends (then every 🤖 tile is opened so the player can look back).
   Pick C: a 3×3 hand + 📓 notebook (my tile · 🤖 colour · result) and how many ⚫ / ⚪ the 🤖 still holds. 🥄🥄🥄 = 🧠 memory mode, as
   the original: used tiles look unused (a tap says so) and the notebook hides my numbers. The bot infers my possible tiles from
   every colour and result so far (all consistent histories). Reads and writes nothing but localStorage shadowStats. window.BW, bwOpen. */
(function () {
    'use strict';
    var ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8], WIN_AT = 5, rng = Math.random, g = null, lvl = 2, toast = null;
    var col = function (n) { return n % 2 ? 'w' : 'b'; };
    var CE = { b: '⚫', w: '⚪' };
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
    // 🥄 random · 🥄🥄 / 🥄🥄🥄: for each tile, sample hands I may hold (and, when I led, my tile of the colour I showed), play the
    // round and the rest out many times, keep the tile that wins most (🥄🥄 fewer samples + a little noise)
    function botPick(myColour) {
        var hand = g.bot.slice();
        if (lvl === 1 || hand.length === 1) return hand[Math.floor(rng() * hand.length)];
        var o = myOdds(), N = lvl === 3 ? 60 : 14, best = null, bestV = -1;
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
            if (v > bestV) { bestV = v; best = t; }
        });
        return best;
    }

    // ---- game ------------------------------------------------------------------------------------------------------------------
    function newGame(level) {
        lvl = level; g = { me: ALL.slice(), bot: ALL.slice(), hist: [], sc: { me: 0, bot: 0 }, lead: rng() < 0.5 ? 'me' : 'bot', sel: null, botTile: null, last: null, end: false, mem: level === 3 };
        if (g.lead === 'bot') g.botTile = botPick(null);
    }
    function play(n) {
        if (!g || g.end || g.last || g.me.indexOf(n) < 0) return;
        var b = g.lead === 'bot' ? g.botTile : botPick(col(n)), res = cmp(n, b);
        g.me.splice(g.me.indexOf(n), 1); g.bot.splice(g.bot.indexOf(b), 1);
        g.hist.push({ m: n, b: b, mc: col(n), bc: col(b), res: res, lead: g.lead });
        if (res === 'win') g.sc.me++; else if (res === 'lose') g.sc.bot++;
        g.last = g.hist[g.hist.length - 1]; g.sel = null; g.botTile = null;
        if (res !== 'draw') g.lead = res === 'win' ? 'me' : 'bot';
        if (g.sc.me >= WIN_AT || g.sc.bot >= WIN_AT || g.hist.length === 9) finish();
    }
    function next() {
        if (!g || g.end || !g.last) return;
        g.last = null; if (g.lead === 'bot') g.botTile = botPick(null); render();
    }
    function finish() {
        g.end = true; var s = get(), k = 'l' + lvl, r = g.sc.me > g.sc.bot ? 'w' : g.sc.me < g.sc.bot ? 'l' : 'd';
        s[k] = s[k] || { w: 0, l: 0, d: 0 }; s[k][r]++; put(s);
    }

    // ---- drawing ---------------------------------------------------------------------------------------------------------------
    var CSS = '#bwModal{z-index:10000}#bwModal .modal-content{text-align:left;padding:14px 14px calc(16px + env(safe-area-inset-bottom));max-width:400px;max-height:92vh;overflow:auto}'
        + '#bwModal .bw{display:flex;flex-direction:column;gap:10px;color:#0f172a;font-variant-numeric:tabular-nums}#bwModal .bw button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '#bwModal .bw button:focus-visible{outline:3px solid #f97316;outline-offset:2px}'
        + '.bw-top{display:flex;align-items:center;gap:6px}.bw-top h3{margin:0;flex:1;font-size:1.05em;font-weight:900;white-space:nowrap}.bw-pill{border-radius:999px;padding:3px 9px;font-weight:800;font-size:.82em;background:#f1f5f9;white-space:nowrap}.bw-pill.sc{background:#fef3c7}'
        + '#bwModal .bw-x{background:none;border:0;color:#94a3b8;font-size:1.1em;padding:2px 4px}'
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
        + '.bw-lvs{display:flex;gap:6px;justify-content:center}#bwModal .bw-lvs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 12px;font-weight:800}#bwModal .bw-lvs button.on{border-color:#0f172a;background:#0f172a;color:#fff}'
        + '.bw-rule{font-size:.85em;color:#475569;text-align:center;line-height:1.6}.bw-toast{text-align:center;font-size:.85em;font-weight:800;color:#b45309}.bw-win{text-align:center;font-size:1.2em;font-weight:900;border-radius:14px;padding:10px;background:#dcfce7;color:#166534}.bw-win.lose{background:#fee2e2;color:#991b1b}.bw-win.draw{background:#f1f5f9;color:#334155}';
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
    var X = '<button type="button" class="bw-x" onclick="BW.close()" aria-label="Close">✕</button>';
    var RW = { win: '🏆 ชนะ', lose: '😞 แพ้', draw: '🤝 เสมอ' };
    function lobbyHtml() {
        var s = get();
        return '<div class="bw"><div class="bw-top"><h3>⚫⚪ ไพ่เงา</h3>' + X + '</div>'
            + '<div class="bw-rule">ไพ่ 0–8 คนละชุด · คู่ ⚫ คี่ ⚪<br>เห็นแค่สีของอีกฝั่ง · เลขสูงกว่าชนะตานั้น<br>9 ตา · ถึง 5 ก่อนชนะ</div>'
            + '<div class="bw-lvs">' + [1, 2, 3].map(function (n) { var r = s['l' + n]; return '<button type="button" class="' + (lvl === n ? 'on' : '') + '" id="bw-lv' + n + '" onclick="BW.level(' + n + ')" title="' + ['', 'ง่าย', 'กลาง', 'ยาก · 🧠 จำเอง'][n] + '">' + '🥄'.repeat(n) + (n === 3 ? ' 🧠' : '') + (r ? ' · ' + r.w + '/' + (r.w + r.l + r.d) : '') + '</button>'; }).join('') + '</div>'
            + (lvl === 3 ? '<div class="bw-note">🧠 ไพ่ที่ลงแล้วไม่จาง · สมุดไม่บอกเลขคุณ</div>' : '')
            + '<button type="button" class="bw-go" id="bw-start" onclick="BW.start()">▸ เริ่ม</button></div>';
    }
    function dots() {
        var h = '<div class="bw-dots" aria-label="Rounds">';
        for (var i = 0; i < 9; i++) { var r = g.hist[i]; h += '<i class="' + (r ? r.res + ' ' + r.bc : i === g.hist.length && !g.end ? 'now' : '') + '"></i>'; }
        return h + '</div>';
    }
    function botLeft() { var b = g.bot.filter(function (n) { return col(n) === 'b'; }).length - (g.botTile != null && col(g.botTile) === 'b' ? 1 : 0), w = g.bot.length - (g.botTile != null ? 1 : 0) - b; return '🤖 เหลือ ⚫ ' + b + ' · ⚪ ' + w; }
    function playHtml() {
        var L = g.last, h = '<div class="bw"><div class="bw-top"><h3>⚫⚪ ไพ่เงา</h3><span class="bw-pill">' + Math.min(9, g.hist.length + (L ? 0 : 1)) + '/9</span><span class="bw-pill sc" id="bw-score">คุณ ' + g.sc.me + ' : ' + g.sc.bot + ' 🤖</span>' + X + '</div>' + dots();
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
        h += '<div class="bw-nb"><div class="bw-lbl">📓 สมุดจด<span id="bw-left">' + botLeft() + '</span></div>' + g.hist.map(function (r, i) {
            return '<div class="bw-r"><span class="d">' + (i + 1) + '</span>' + (g.mem ? back(r.mc, 'mini') : t(r.m, 'mini')) + ' vs ' + back(r.bc, 'mini') + '<span class="rs ' + r.res + '">' + RW[r.res] + '</span></div>';
        }).join('') + '</div>';
        return h + '</div>';
    }
    function endHtml() {
        var r = g.sc.me > g.sc.bot ? 'win' : g.sc.me < g.sc.bot ? 'lose' : 'draw';
        return '<div class="bw"><div class="bw-top"><h3>⚫⚪ จบเกม</h3>' + X + '</div>'
            + '<div class="bw-win ' + r + '" id="bw-final">' + (r === 'win' ? '🏆 คุณชนะ ' : r === 'lose' ? '😞 🤖 ชนะ ' : '🤝 เสมอ ') + g.sc.me + ' : ' + g.sc.bot + '</div>' + dots()
            + '<div class="bw-nb"><div class="bw-lbl">ทุกตา · เปิดไพ่ 🤖</div>' + g.hist.map(function (x, i) { return '<div class="bw-r"><span class="d">' + (i + 1) + '</span>' + t(x.m, 'mini') + ' vs ' + t(x.b, 'mini') + '<span class="rs ' + x.res + '">' + RW[x.res] + '</span></div>'; }).join('') + '</div>'
            + '<button type="button" class="bw-go" id="bw-again" onclick="BW.start()">↺ อีกตา</button><button type="button" class="bw-go alt" onclick="BW.lobby()">' + '🥄'.repeat(lvl) + ' เปลี่ยนระดับ</button></div>';
    }
    function render() { var m = root(); document.getElementById('bw-body').innerHTML = !g ? lobbyHtml() : g.end ? endHtml() : playHtml(); m.style.display = 'flex'; }

    window.BW = {
        open: function () { g = null; toast = null; render(); },
        lobby: function () { g = null; render(); },
        level: function (n) { lvl = n; render(); },
        start: function () { toast = null; newGame(lvl); render(); },
        pick: function (n) { if (!g || g.end || g.last) return; toast = null; if (g.me.indexOf(n) < 0) { toast = '🧠 ' + n + ' ลงไปแล้ว'; g.sel = null; } else g.sel = n; render(); },
        play: function () { if (g && g.sel != null) { play(g.sel); render(); } },
        next: function () { next(); },
        close: function () { g = null; var m = document.getElementById('bwModal'); if (m) m.style.display = 'none'; },
        // for scripts/shadow-qa.cjs
        _g: function () { return g; }, _rng: function (f) { rng = f; }, _odds: function () { return myOdds(); }, _botPick: function (c) { return botPick(c); }
    };
    window.bwOpen = function () { BW.open(); };
})();
