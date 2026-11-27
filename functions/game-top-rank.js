/* V101.375 🏆 Top 3 per game (owner 2026-11-26: "แต่ละเกม ให้เก็บคะแนนผู้ชนะไว้ด้วย ประกาศ Top 3 แต่ละเกม ให้แต่ละ user ทราบ ส่วน ADMIN
   จะทราบทั้งหมด"; picks: count wins · this week + all time · line B, mockup-game-top3/). Ranks game_plays (game-log.js writes one
   per finished game): 🥣 🐺 ⚫⚪ 🪨 (V101.382) = games won (win 'w'); 🔢 เลขลับ (V101.378) = the fewest 🎫 of a 🧠 (mode h4) game; 🔢🌐 'secretOn' (V101.381, owner "Yes, add a board") = เลขลับ หลายคน games won (mode online | live), its own board; 🧊 นับไว = the best total seconds of a 🥄🥄🥄 (mode ' l3') game with all 5 right. A tie goes to
   who got there first. The week starts Monday 00:00 Bangkok. Pure; the same file runs in the gameTop callable (functions/) and on
   the admin page (public/, window.GameTopRank) — scripts/game-top-qa.cjs checks the two copies are the same. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GameTopRank = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var GAMES = ['cereal', 'wolf', 'count', 'bw', 'secret', 'secretOn', 'rock13'], BKK = 7 * 3600e3;

    /** Monday 00:00 Bangkok of the week holding `now`, as epoch ms */
    function weekStart(now) {
        var d = new Date(now + BKK), day = (d.getUTCDay() + 6) % 7;   // Monday = 0
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - BKK;
    }
    function multi(p) { var m = String(p.mode || ''); return m === 'online' || m === 'live'; }
    /** does play p belong to board g ('secretOn' = เลขลับ หลายคน, 'secret' = practice only) */
    function is(p, g) { return g === 'secretOn' ? p.game === 'secret' && multi(p) : p.game === g && !(g === 'secret' && multi(p)); }
    /** one play's value, or null when it does not count */
    function value(p, g) {
        if (g === 'secretOn') return p.win === 'w' ? 1 : null;
        if (p.game === 'count') {
            var s = String(p.score || '').split('/'), right = +s[0], of = +s[1];
            return right > 0 && right === of && p.sec > 0 && / l3\b/.test(String(p.mode || '')) ? p.sec : null;   // ยาก only (owner pick)
        }
        if (p.game === 'secret') { var t = +p.score; return p.win === 'w' && t > 0 && String(p.mode || '') === 'h4' ? t : null; }   // 🧠 only
        return p.win === 'w' ? 1 : null;
    }
    /** [{ userId, v, at, n }] best first for one game (n = games played in the period); keepZero (the admin) also lists who played
        and never counted (v null, last) */
    function board(plays, game, skip, keepZero) {
        var by = {}, asc = game === 'count' || game === 'secret';
        plays.forEach(function (p) {
            if (!is(p, game) || !p.userId || (skip && skip(p.userId))) return;
            var r = by[p.userId] || (by[p.userId] = { userId: p.userId, v: null, at: 0, n: 0 }), v = value(p, game), at = +p.endedAt || 0;
            r.n++;
            if (v == null) return;
            if (asc) { if (r.v == null || v < r.v || (v === r.v && at < r.at)) { r.v = v; r.at = at; } }
            else { r.v = (r.v || 0) + v; r.at = Math.max(r.at, at); }   // wins: the tie goes to the earlier last win
        });
        function key(r) { return r.v == null ? (asc ? Infinity : -1) : r.v; }
        return Object.keys(by).map(function (k) { return by[k]; }).filter(function (r) { return keepZero || r.v != null; })
            .sort(function (a, b) { var d = asc ? key(a) - key(b) : key(b) - key(a); return (d === d ? d : 0) || (a.v == null ? b.n - a.n : a.at - b.at); });
    }
    /** { week: ms, boards: { game: { week: [...], all: [...] } } } — full ordered lists */
    function rank(plays, now, skip) {
        var ws = weekStart(now), wk = plays.filter(function (p) { return (+p.endedAt || 0) >= ws; }), boards = {};
        GAMES.forEach(function (g) { boards[g] = { week: board(wk, g, skip), all: board(plays, g, skip) }; });
        return { week: ws, boards: boards };
    }
    /** what an intern sees: top 3 with who(userId) = { name, pic }, and their own place (r 1-based) or null */
    function forIntern(ranked, me, who) {
        var out = {};
        GAMES.forEach(function (g) {
            out[g] = {};
            ['week', 'all'].forEach(function (k) {
                var list = ranked.boards[g][k], i = -1;
                list.forEach(function (r, j) { if (i < 0 && r.userId === me) i = j; });
                out[g][k] = { top: list.slice(0, 3).map(function (r) { var w = who(r.userId) || {}; return { v: r.v, name: w.name || '…', pic: w.pic || '' }; }),
                    me: i < 0 ? null : { r: i + 1, v: list[i].v } };
            });
        });
        return out;
    }
    return { GAMES: GAMES, is: is, weekStart: weekStart, value: value, board: board, rank: rank, forIntern: forIntern };
});
