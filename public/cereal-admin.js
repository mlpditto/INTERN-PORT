/* V102.700 — 🥣 Cereal Killer on the admin Dashboard (owner pick A, mockup-cereal-admin/): one read-only line above #quiz-dash —
   🎮 playing · 🏁 finished · 👥 people · 🚪 rooms waiting for a friend, over the games touched in the last 7 days. One query
   (cereal_games updatedAt ≥ now − 7 d; admins read cereal_games under the existing rules), at most every 5 minutes, refreshed with the
   quiz list like 🚀 Up next. No names, no buttons; hidden when every number is 0 or the read fails. window.cerealAdmin. */
(function () {
    'use strict';
    var WEEK = 7 * 864e5, last = 0;
    /** { playing, done, lobby, people } from game docs; cancelled rooms count for nothing. */
    function count(list) {
        var c = { playing: 0, done: 0, lobby: 0, people: 0 }, ppl = {};
        (list || []).forEach(function (g) {
            var k = g.status === 'playing' ? 'playing' : g.status === 'finished' ? 'done' : g.status === 'lobby' ? 'lobby' : null;
            if (!k) return;
            c[k]++;
            Object.keys(g.players || {}).forEach(function (r) { var p = g.players[r]; if (p && p.uid) ppl[p.uid] = 1; });
        });
        c.people = Object.keys(ppl).length;
        return c;
    }
    function html(c) {
        var chip = function (ic, n, th) { return '<span class="c">' + ic + ' <b>' + n + '</b> ' + th + '</span>'; };
        return '<span class="t" title="Cereal Killer · games touched in the last 7 days">🥣 Cereal</span>' + chip('🎮', c.playing, 'เล่นอยู่') + chip('🏁', c.done, 'จบ · 7 วัน')
            + chip('👥', c.people, 'คน') + (c.lobby ? chip('🚪', c.lobby, 'ห้องรอเพื่อน') : '');
    }
    function render(c) {
        var host = document.getElementById('ck-admin-strip');
        if (!host) return;
        var any = c && (c.playing || c.done || c.lobby);
        host.hidden = !any;
        host.innerHTML = any ? html(c) : '';
    }
    function refresh(force) {
        if (typeof db === 'undefined' || !document.getElementById('ck-admin-strip')) return;
        if (!force && Date.now() - last < 5 * 60000) return;
        last = Date.now();
        db.collection('cereal_games').where('updatedAt', '>=', Date.now() - WEEK).get()
            .then(function (s) { render(count(s.docs.map(function (d) { return d.data(); }))); })
            .catch(function () { render(null); });
    }
    window.cerealAdmin = { refresh: refresh, count: count, render: render };
})();
