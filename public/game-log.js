/* V101.370 — 🎮 game time for the admin (owner 2026-11-25: "เก็บ stat ให้ ADMIN ทราบว่าแต่ละเกม user ใช้เวลามาก-น้อย แต่ละตา",
   all 4 games, admin view pick B = a table per person, mockup-game-time-admin/). Each game calls GameLog.see(game, state) from its
   render; one game_plays doc is written when a game ends: who, which game, the mode, seconds per round, the result. Only time spent
   in the game counts: the clock moves between taps / renders, and a gap of more than 3 minutes (popup closed, phone away, app in
   the background) counts as 3 minutes. A game left unfinished writes nothing. Rules: an intern creates only their own; admins read.
   window.GameLog. */
(function () {
    'use strict';
    var CAP = 180000, cur = null, sent = {}, VER = 'V101.370';
    function now() { return Date.now(); }
    function tick() {   // add the time since the last touch to the round in progress
        if (!cur) return;
        var t = now(); cur.ms += Math.min(CAP, Math.max(0, t - cur.last)); cur.last = t;
    }
    ['pointerdown', 'keydown'].forEach(function (e) { document.addEventListener(e, tick, { capture: true, passive: true }); });
    document.addEventListener('visibilitychange', function () { if (!cur) return; if (document.hidden) tick(); else cur.last = now(); });
    function write(doc) {
        try {
            var u = window.firebase && firebase.auth && firebase.auth().currentUser;
            if (typeof db === 'undefined' || !u || typeof userId !== 'string' || !userId) return null;
            doc.userId = userId; doc.authUid = u.uid; doc.v = VER; doc.at = firebase.firestore.FieldValue.serverTimestamp();
            if (window.GameTop) GameTop.played();   // V101.375 🏆 the Top 3 asks again
            return db.collection('game_plays').add(doc).catch(function () { /* offline / rules: the game goes on */ });
        } catch (e) { return null; }
    }
    /** s = { id, n: rounds finished so far, done, mode, win: 'w'|'l'|'d'|null, score, res: [per-round 'ok'|'no'|…] } */
    function see(game, s) {
        if (!s || !s.id) return;
        if (!cur || cur.game !== game || cur.id !== s.id) {
            if (sent[game + s.id]) return;
            cur = { game: game, id: s.id, start: now(), last: now(), ms: 0, n: s.n || 0, from: s.n || 0, rounds: [] };
            if (s.done) { cur = null; return; }   // opened on a finished game (a saved one): nothing to time
        }
        tick();
        while (cur.n < (s.n || 0)) { cur.rounds.push(Math.round(cur.ms / 100) / 10); cur.ms = 0; cur.n++; }   // seconds, 0.1 s
        if (s.done) {
            sent[game + s.id] = 1;
            var r = cur.rounds, doc = { game: game, mode: String(s.mode || ''), rounds: r.slice(0, 40), from: cur.from,
                sec: Math.round(r.reduce(function (a, b) { return a + b; }, 0)), win: s.win || null, score: String(s.score || ''),
                res: (s.res || []).slice(0, 40).map(String), startedAt: cur.start, endedAt: now() };
            cur = null;
            if (r.length) return write(doc);
        }
    }
    window.GameLog = { see: see, _cur: function () { return cur; }, CAP: CAP };
})();
