/* V101.375 🏆 Top 3 line under each game's title (owner pick B, mockup-game-top3/): 🏆 + three faces with 🥇🥈🥉 and wins (🧊 นับไว:
   best time with 5/5) + "คุณ #n". A tap opens the board in place: สัปดาห์นี้ │ ตลอดกาล, the three rows and your place; tap again folds
   it. Data = the gameTop callable (functions/game-top-rank.js over game_plays), asked at most every 2 minutes and after each finished
   game; nothing shows until it answers or when it fails. Each game's lobby calls GameTop.line(game, dark). window.GameTop. */
(function () {
    'use strict';
    var data = null, at = 0, busy = false, open = {}, per = 'week', dirty = 0;
    var MED = ['🥇', '🥈', '🥉'];
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fmt(game, v) { if (game === 'secret') return v + '🎫'; if (game !== 'count') return String(v); v = Math.round(v); return Math.floor(v / 60) + ':' + ('0' + (v % 60)).slice(-2); }
    function av(p) { return p.pic ? '<img class="gtop-av" src="' + esc(p.pic) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="gtop-av">' + esc((p.name || '?').slice(0, 1)) + '</span>'; }
    function css() {
        if (document.getElementById('gtop-css')) return;
        var s = document.createElement('style'); s.id = 'gtop-css';
        s.textContent = '.gtop{display:flex;flex-direction:column;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;font-size:12px;font-weight:800;color:#0f172a}'
            + '.gtop.dk{color:#e9d5ff}.gtop-l{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:center}'
            + '.gtop-c{display:inline-flex;align-items:center;gap:2px;padding:2px 6px 2px 2px;border-radius:999px;background:#f1f5f9}.gtop.dk .gtop-c{background:#1d1a3d}'
            + '.gtop-av{width:20px;height:20px;border-radius:50%;object-fit:cover;background:#e2e8f0;color:#475569;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex:none}'
            + '.gtop-me{color:#7c3aed}.gtop.dk .gtop-me{color:#a78bfa}.gtop-e{opacity:.7;font-weight:700}'
            + '.gtop-b{display:flex;flex-direction:column;gap:5px;border:1px solid #e2e8f0;border-radius:14px;padding:8px}.gtop.dk .gtop-b{border-color:#3f3a74}'
            + '.gtop-rail{display:flex;gap:6px;justify-content:center}.gtop-rail button{font:inherit;font-size:12px;width:auto;min-height:0;margin:0;padding:4px 12px;border-radius:999px;border:1px solid #e2e8f0;background:none;color:inherit;box-shadow:none}'
            + '.gtop.dk .gtop-rail button{border-color:#3f3a74}.gtop-rail button.on{background:#7c3aed;border-color:#7c3aed;color:#fff}.gtop.dk .gtop-rail button.on{background:#a78bfa;border-color:#a78bfa;color:#1a1733}'
            + '.gtop-r{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:10px;background:#f8fafc}.gtop.dk .gtop-r{background:#1d1a3d}.gtop-r .nm{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
        document.head.appendChild(s);
    }
    function load(force) {
        if (busy || (!force && data && Date.now() - at < 120000)) return;
        try {
            if (!window.firebase || !firebase.functions || typeof userId !== 'string' || !userId) return;
            busy = true;
            firebase.functions().httpsCallable('gameTop')({ userId: userId }).then(function (r) {
                busy = false; data = r && r.data && r.data.games ? r.data.games : null; at = Date.now(); paint();
            }, function () { busy = false; at = Date.now(); });
        } catch (e) { busy = false; }
    }
    function inner(game) {
        var b = data && data[game] && data[game][per]; if (!b) return '';
        var unit = game === 'count' || game === 'secret' ? '' : ' ชนะ', me = b.me ? '<span class="gtop-me">คุณ #' + b.me.r + '</span>' : '';
        if (!open[game]) {
            if (!b.top.length) return '<div class="gtop-l">🏆 <span class="gtop-e">' + (per === 'week' ? 'สัปดาห์นี้' : '') + 'ยังว่าง · ชนะก่อนได้ 🥇</span></div>';
            return '<div class="gtop-l">🏆 ' + b.top.map(function (p, i) { return '<span class="gtop-c">' + av(p) + MED[i] + fmt(game, p.v) + '</span>'; }).join('') + me + '</div>';
        }
        return '<div class="gtop-b"><div class="gtop-rail" role="group" aria-label="Period">' + [['week', 'สัปดาห์นี้'], ['all', 'ตลอดกาล']].map(function (k) {
            return '<button type="button" class="' + (per === k[0] ? 'on' : '') + '" aria-pressed="' + (per === k[0]) + '" onclick="event.stopPropagation();GameTop.per(\'' + k[0] + '\')">' + k[1] + '</button>';
        }).join('') + '</div>'
            + (game === 'count' ? '<div class="gtop-e" style="text-align:center">🥄🥄🥄 ยาก · ✓ 5/5 เวลาดีสุด</div>' : game === 'secret' ? '<div class="gtop-e" style="text-align:center">🧠 ไม่มีตัวช่วย · 🎫 น้อยสุด</div>' : '')   // V101.375 the board counts ยาก only
            + (b.top.length ? b.top.map(function (p, i) { return '<div class="gtop-r"><b>' + MED[i] + '</b>' + av(p) + '<span class="nm">' + esc(p.name) + '</span><b>' + fmt(game, p.v) + unit + '</b></div>'; }).join('') : '<div class="gtop-e" style="text-align:center">ยังว่าง · ชนะก่อนได้ 🥇</div>')
            + (b.me ? '<div class="gtop-me" style="text-align:center">คุณ #' + b.me.r + ' · ' + fmt(game, b.me.v) + unit + '</div>' : '') + '</div>';
    }
    function paint() { document.querySelectorAll('[data-gtop]').forEach(function (el) { el.innerHTML = inner(el.getAttribute('data-gtop')); }); }
    window.GameTop = {
        /** the line for a lobby: an empty div until the board arrives */
        line: function (game, dark) {
            css(); load(dirty > at);
            return '<div class="gtop lang-no-toggle' + (dark ? ' dk' : '') + '" data-gtop="' + game + '" role="button" tabindex="0" aria-label="Top 3" onclick="GameTop.toggle(\'' + game + '\')">' + inner(game) + '</div>';
        },
        toggle: function (game) { open[game] = !open[game]; paint(); },
        per: function (k) { per = k === 'all' ? 'all' : 'week'; paint(); },
        /** a game just ended: ask again next time a lobby shows */
        played: function () { dirty = Date.now(); },
        _set: function (d) { data = d; at = Date.now(); paint(); }
    };
})();
