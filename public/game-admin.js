/* V102.704 — 🎮 game time on the admin Dashboard (owner pick B, mockup-game-time-admin/): one card under the 🥣 line — a chip per
   game (⚫ ไพ่เงา · 🧊 นับไว · 🥣 Cereal · 🐺 หมาป่า) and a table per person over the last 7 days: 🎮 games, ⌛ seconds per round
   (🐢 much slower / ⚡ much faster than the others in that game), the last game's rounds as small bars (🟧 = its longest round) and
   🏆 wins / games (นับไว: ✓ on average). One query (game_plays endedAt ≥ now − 7 d, written by game-log.js on the intern page), at most
   every 5 minutes; hidden when nobody played or the read fails. window.gameAdmin.
   V102.705 (owner 2026-11-26 "ADMIN จะทราบทั้งหมด"): ⏱ เวลา │ 🏆 อันดับ — every player of the game ranked like the interns' Top 3
   (game-top-rank.js: wins, 🧊 best 5/5 time), สัปดาห์นี้ (from Monday) │ ตลอดกาล (all game_plays, read once when asked, 5 min). */
(function () {
    'use strict';
    var WEEK = 7 * 864e5, last = 0, plays = [], pick = null, view = 'time', per = 'week', all = null, allAt = 0;
    var GAMES = [['bw', '⚫', 'ไพ่เงา'], ['count', '🧊', 'นับไว'], ['cereal', '🥣', 'Cereal'], ['wolf', '🐺', 'หมาป่า'], ['secret', '🔢', 'เลขลับ'], ['secretOn', '🔢🌐', 'เลขลับ หลายคน'], ['rock13', '🪨', 'Carry 13'], ['spot', '🪞', 'Memory']];
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function is(p, g) { return window.GameTopRank ? GameTopRank.is(p, g) : p.game === g; }   // V102.708 🔢🌐 its own chip
    function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
    function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), k = b.length >> 1; return b.length ? (b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2) : 0; }
    function fmt(s) { s = Math.round(s); return s >= 60 ? Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) : String(s); }
    /** rows for one game: [{ userId, games, perRound, last: [s…], wins, score }], slowest first, with flag 'slow' | 'fast' | '' */
    function rows(list, game) {
        var by = {};
        list.filter(function (p) { return is(p, game) && p.userId && p.rounds && p.rounds.length; }).forEach(function (p) { (by[p.userId] = by[p.userId] || []).push(p); });
        var out = Object.keys(by).map(function (u) {
            var ps = by[u].sort(function (a, b) { return (b.endedAt || 0) - (a.endedAt || 0); }), all = [];
            ps.forEach(function (p) { all = all.concat(p.rounds); });
            var r = { userId: u, games: ps.length, perRound: avg(all), last: ps[0].rounds, wins: ps.filter(function (p) { return p.win === 'w'; }).length };
            if (game === 'count') r.right = avg(ps.map(function (p) { return +(String(p.score).split('/')[0]) || 0; }));
            return r;
        });
        var mid = median(out.map(function (r) { return r.perRound; }));
        out.forEach(function (r) { r.flag = out.length >= 3 && r.perRound >= mid * 1.5 ? 'slow' : out.length >= 3 && r.perRound <= mid * 0.6 ? 'fast' : ''; });
        return out.sort(function (a, b) { return b.perRound - a.perRound; });
    }
    function who(id) {
        var u = (typeof usersData !== 'undefined' ? usersData : []).find(function (x) { return x.id === id; }) || {};
        var name = u.nickname || u.displayName || u.name || '…';
        return (u.pictureUrl ? '<img class="av" src="' + esc(u.pictureUrl) + '" alt="" loading="lazy">' : '<span class="av"></span>') + '<span class="nm">' + esc(name) + '</span>';
    }
    function spark(r) {
        var mx = Math.max.apply(null, r.concat([1])), hi = r.indexOf(mx);
        return '<span class="sp" title="' + r.map(fmt).join(' · ') + ' วิ">' + r.map(function (s, i) { return '<i' + (i === hi ? ' class="hi"' : '') + ' style="height:' + Math.max(15, Math.round(s / mx * 100)) + '%"></i>'; }).join('') + '</span>';
    }
    function chip(on, js, label) { return '<button type="button" class="gt-chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="' + js + '">' + label + '</button>'; }
    function rankHtml(src) {   // V102.705 🏆 everyone, best first
        var R = window.GameTopRank; if (!R) return '';
        if (per === 'week') { var ws = R.weekStart(Date.now()); src = src.filter(function (p) { return (+p.endedAt || 0) >= ws; }); }
        var skip = function (id) { var u = (typeof usersData !== 'undefined' ? usersData : []).find(function (x) { return x.id === id; }); return !!(u && u.isIgnored); };
        var rs = R.board(src, pick, skip, true), cnt = pick === 'count';
        if (!rs.length) return '<div class="gt-k">ยังไม่มีใครเล่น' + (per === 'week' ? 'สัปดาห์นี้' : '') + '</div>';
        return '<table class="gt-t" id="gt-rank"><thead><tr><th class="n">#</th><th>คน</th><th class="n">' + (pick === 'secret' ? '🎫 น้อยสุด 🧠' : cnt ? '⏱ ดีสุด 5/5' : '🏆 ชนะ') + '</th><th class="n">🎮</th></tr></thead><tbody>'
            + rs.map(function (r, i) { return '<tr><td class="n">' + (r.v == null ? '' : i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) + '</td><td>' + who(r.userId) + '</td><td class="n">' + (r.v == null ? (cnt || pick === 'secret' ? '—' : '0') : cnt ? fmt(r.v) : r.v) + '</td><td class="n">' + r.n + '</td></tr>'; }).join('')
            + '</tbody></table>';
    }
    function html() {
        var src = view === 'rank' && per === 'all' ? (all || []) : plays;
        var have = GAMES.filter(function (g) { return src.some(function (p) { return is(p, g[0]); }); });
        if (!have.length) return '';
        if (!pick || !have.some(function (g) { return g[0] === pick; })) pick = have[0][0];
        var rs = rows(plays, pick), unit = pick === 'count' ? 'ข้อ' : pick === 'bw' ? 'ตา' : pick === 'secret' ? '🎫' : pick === 'rock13' || pick === 'spot' ? 'รอบ' : 'วัน';
        var top = '<div class="gt-chips" role="group" aria-label="View">' + chip(view === 'time', "gameAdmin.view('time')", '⏱ เวลา') + chip(view === 'rank', "gameAdmin.view('rank')", '🏆 อันดับ')
            + (view === 'rank' ? '<span style="width:8px"></span>' + chip(per === 'week', "gameAdmin.per('week')", 'สัปดาห์นี้') + chip(per === 'all', "gameAdmin.per('all')", 'ตลอดกาล') : '') + '</div>';
        var games = '<div class="gt-chips" role="group" aria-label="Game">' + have.map(function (g) {
            return '<button type="button" class="gt-chip' + (g[0] === pick ? ' on' : '') + '" aria-pressed="' + (g[0] === pick) + '" onclick="gameAdmin.pick(\'' + g[0] + '\')">' + g[1] + ' ' + g[2] + '</button>';
        }).join('') + '</div>';
        if (view === 'rank') return top + games + rankHtml(src);
        return top + games
            + '<table class="gt-t"><thead><tr><th>คน</th><th class="n">🎮</th><th class="n">⌛ วิ/' + unit + '</th><th>เกมล่าสุด</th><th class="n">' + (pick === 'count' ? '✓' : '🏆') + '</th></tr></thead><tbody>'
            + rs.map(function (r) {
                return '<tr><td>' + who(r.userId) + '</td><td class="n">' + r.games + '</td><td class="n">' + fmt(r.perRound) + (r.flag === 'slow' ? ' 🐢' : r.flag === 'fast' ? ' ⚡' : '') + '</td><td>' + spark(r.last) + '</td>'
                    + '<td class="n">' + (pick === 'count' ? r.right.toFixed(1) + '/5' : r.wins + '/' + r.games) + '</td></tr>';
            }).join('') + '</tbody></table>'
            + '<div class="gt-k">🐢 ช้ากว่าคนอื่นมาก · ⚡ เร็วกว่ามาก · 🟧 ' + unit + 'ที่นานสุด · 7 วันล่าสุด</div>';
    }
    function render() {
        var host = document.getElementById('gt-admin'); if (!host) return;
        var h = html(); host.hidden = !h; host.innerHTML = h ? '<div class="gt-h">🎮 เวลาเล่นเกม</div>' + h : '';
    }
    function refresh(force) {
        if (typeof db === 'undefined' || !document.getElementById('gt-admin')) return;
        if (!force && Date.now() - last < 5 * 60000) return;
        last = Date.now();
        db.collection('game_plays').where('endedAt', '>=', Date.now() - WEEK).get()
            .then(function (s) { plays = s.docs.map(function (d) { return d.data(); }); render(); })
            .catch(function () { plays = []; render(); });
    }
    function loadAll() {   // V102.705 ตลอดกาล: every game_plays doc, at most every 5 minutes
        if (typeof db === 'undefined' || (all && Date.now() - allAt < 5 * 60000)) return render();
        allAt = Date.now();
        db.collection('game_plays').get().then(function (s) { all = s.docs.map(function (d) { return d.data(); }); render(); }, function () { all = all || []; render(); });
    }
    window.gameAdmin = { refresh: refresh, rows: rows, pick: function (g) { pick = g; render(); }, _set: function (l) { plays = l || []; render(); },
        view: function (v) { view = v === 'rank' ? 'rank' : 'time'; if (view === 'rank' && per === 'all') loadAll(); else render(); },
        per: function (k) { per = k === 'all' ? 'all' : 'week'; if (per === 'all') loadAll(); else render(); },
        _setAll: function (l) { all = l || []; allAt = Date.now(); render(); } };
})();
