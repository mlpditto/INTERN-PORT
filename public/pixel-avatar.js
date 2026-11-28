/* V101.392 🧑‍🎨 My pixel — an intern's own pixel character, the face in the games (owner 2026-11-28 after seeing a pixel-people
   web game: "อยากให้ user สร้าง pixel character ได้"; picks: where = the game faces, how = pick parts, layout D + A,
   mockup-pixel-avatar/builder.png). Our own 16×16 head + shoulders, drawn in code from 7 digits — skin · hair · hair colour · eyes ·
   outfit · outfit colour · extra — kept as users.pixel (no image file, no AI). D: each game lobby shows your face + ✏️; the first
   time it makes a 🎲 one for you, so nobody plays faceless. A: ✏️ opens one sheet, a chip rail per part showing the part on you,
   🎲 + 💾 Save. The online rooms copy users.pixel into the room (roomAct `me()` → players[x].px) and 🏆 Top 3 gets it from gameTop;
   every face helper draws the pixel first, then the LINE photo, then the initial. window.PixelAvatar. */
(function () {
    'use strict';
    var SKIN = ['#ffe0c2', '#f6c99f', '#e2a878', '#c68653', '#8d5a3b'];
    var HAIRC = ['#2b1d12', '#5b3417', '#a0652b', '#e3b55b', '#9ca3af', '#7c3aed'];
    var OUTC = ['#0d9488', '#2563eb', '#db2777', '#f59e0b', '#475569'];
    var N = [5, 6, 6, 3, 4, 5, 6];   // choices per digit
    var BASE = ['................', '................', '................', '.....SSSSSS.....', '....SSSSSSSS....', '....SSSSSSSS....', '...SSSSSSSSSS...', '....SSSSSSSS....', '....SSSSSSSS....', '.....SSSSSS.....', '......SSSS......', '...OOOOOOOOOO...', '..OOOOOOOOOOOO..', '.OOOOOOOOOOOOOO.', '.OOOOOOOOOOOOOO.', '.OOOOOOOOOOOOOO.'];
    var HAIR = [   // short · side part · long · bun · curly · buzz
        { 2: '.....HHHHHH.....', 3: '....HHHHHHHH....', 4: '....HHHHHHHH....', 5: '....H......H....' },
        { 2: '.....HHHHHHH....', 3: '....HHHHHHHHH...', 4: '....HHHHHH.HH...', 5: '....HH.....H....' },
        { 2: '.....HHHHHH.....', 3: '....HHHHHHHH....', 4: '...HHHHHHHHHH...', 5: '...HH......HH...', 6: '...H........H...', 7: '...HH......HH...', 8: '...HH......HH...', 9: '...HHH....HHH...', 10: '....HH....HH....' },
        { 0: '......HHHH......', 1: '......HHHH......', 2: '.....HHHHHH.....', 3: '....HHHHHHHH....', 4: '....HHHHHHHH....', 5: '....H......H....' },
        { 1: '....H.HH.HH.....', 2: '...HHHHHHHHHH...', 3: '...HHHHHHHHHH...', 4: '...HHHHHHHHHH...', 5: '...HH......HH...', 6: '...H........H...' },
        { 3: '....HHHHHHHH....', 4: '....H.H.H.H.....' }
    ];
    var EYES = [{ 6: '......E..E......', 8: '.......MM.......' }, { 6: '......E..E......', 8: '......M..M......', 9: '.......MM.......' }, { 6: '.....EE..EE.....', 8: '.......MM.......' }];
    var OUTFIT = [   // 🩺 scrubs · 🥼 white coat · polo · hoodie
        { 11: '...OOOSSOOOO....', 12: '..OOOOSSOOOOOO..' },
        { 11: '...WWWOOWWW.....', 12: '..WWWWOOWWWWWW..', 13: '.WWWWWOOWWWWWWW.', 14: '.WWWWWOOWWWWWWW.', 15: '.WWWWWOOWWWWWWW.' },
        { 11: '...OOWWWWOOO....', 12: '..OOOOWWOOOOOO..' },
        { 10: '....OO....OO....', 11: '...OOOOOOOOOO...', 12: '..OOOOO..OOOOO..' }
    ];
    var EXTRA = [{}, { 6: '.....KKKKKK.....', 7: '.....K.K.K.K....' }, { 7: '....BBBBBBBB....', 8: '....BBBBBBBB....', 9: '.....BBBBBB.....' },
        { 1: '.....WWWWWW.....', 2: '....WWWRRWWW....', 3: '....WWWWWWWW....' },
        { 11: '....G......G....', 12: '....G......G....', 13: '.....G....G.....', 14: '......GGGG......', 15: '......GXXG......' }, { 4: '....RRRRRRRR....' }];
    var COL = { E: '#1e293b', M: '#b45309', W: '#f8fafc', K: '#111827', B: '#bae6fd', R: '#dc2626', G: '#64748b', X: '#cbd5e1' };

    function ok(code) { return /^\d{7}$/.test(String(code || '')) && String(code).split('').every(function (x, i) { return +x < N[i]; }); }
    // its own dice (crypto), so a 🎲 pixel never takes numbers from the games' Math.random (their QA replays seeded games)
    function rnd() { try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } }
    function random() { return N.map(function (n, i) { return i === 6 && rnd() < .4 ? 0 : Math.floor(rnd() * n); }).join(''); }
    /** the SVG for a code (16 × 16 crisp pixels) */
    function svg(code, px) {
        if (!ok(code)) return '';
        var d = String(code).split('').map(Number), g = BASE.map(function (r) { return r.split(''); });
        function lay(L) { Object.keys(L).forEach(function (y) { L[y].split('').forEach(function (ch, x) { if (ch !== '.') g[y][x] = ch; }); }); }
        lay(HAIR[d[1]]); lay(OUTFIT[d[4]]); lay(EYES[d[3]]); lay(EXTRA[d[6]]);
        if (d[6] === 2) { g[8][7] = 'B'; g[8][8] = 'B'; g[9][7] = 'B'; }   // the mask covers the mouth
        var C = Object.assign({ S: SKIN[d[0]], H: HAIRC[d[2]], O: OUTC[d[5]] }, COL), s = '<svg class="pxa-svg" viewBox="0 0 16 16" width="' + px + '" height="' + px + '" shape-rendering="crispEdges" aria-hidden="true">';
        g.forEach(function (r, y) { var x = 0; while (x < 16) { var ch = r[x], w = 1; while (x + w < 16 && r[x + w] === ch) w++; if (C[ch]) s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + C[ch] + '"/>'; x += w; } });
        return s + '</svg>';
    }
    /** a face for the game helpers: <span class="cls pxa"> round, light tint, the pixel inside — or '' when there is no pixel */
    function face(code, sz, cls) { return ok(code) ? '<span class="' + (cls ? cls + ' ' : '') + 'pxa" style="width:' + sz + 'px;height:' + sz + 'px">' + svg(code, Math.round(sz * .92)) + '</span>' : ''; }

    // ---- mine: users.pixel; made for you (🎲) the first time a lobby asks --------------------------------------------------------
    function doc() { return window.myUserDoc || null; }
    function mine() { var d = doc(); return d && ok(d.pixel) ? d.pixel : ''; }
    function save(code) {
        var d = doc(); if (d) d.pixel = code;
        try { localStorage.setItem('pxMine', code); } catch (e) { }
        try { if (typeof userId === 'string' && userId && typeof db !== 'undefined' && !(typeof isPreview !== 'undefined' && isPreview)) db.collection('users').doc(userId).update({ pixel: code }).catch(function (e) { console.warn('Pixel not saved:', e && e.message); }); } catch (e) { }   // update: never re-create a deleted user
    }
    var fresh = false;
    function ensure() {
        var m = mine(); if (m) return m;
        try { var l = localStorage.getItem('pxMine'); if (ok(l)) { if (doc()) doc().pixel = l; return l; } } catch (e) { }
        m = random(); save(m); fresh = true; return m;
    }
    /** D: the row in a game lobby — your face, your name, ✏️; the first time: "🎲 Your pixel is ready" */
    function lobbyRow() {
        var m = ensure(), nm = (doc() && (doc().nickName || doc().firstName || doc().displayName)) || 'You', was = fresh; fresh = false;
        return '<div class="pxa-row' + (was ? ' new' : '') + '" id="pxa-row">' + face(m, 52, '') + '<div class="pxa-who"><b>' + (was ? '🎲 Your pixel is ready' : esc(nm)) + '</b><small>' + (was ? 'keep it or ✏️ make your own' : 'your face in the games') + '</small></div>'
            + '<button type="button" class="pxa-edit" id="pxa-edit" onclick="PixelAvatar.edit()" aria-label="Edit my pixel">✏️</button></div>';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // ---- A: the builder, one sheet, a rail per part ------------------------------------------------------------------------------
    var draft = null, after = null;
    var RAILS = [['Skin', 0, SKIN], ['Hair', 1], ['Hair colour', 2, HAIRC], ['Eyes', 3], ['Outfit', 4], ['Outfit colour', 5, OUTC], ['Extra', 6]];
    function sheet() {
        return '<div class="pxa-sh"><div class="pxa-top"><h3>🧑‍🎨 My pixel</h3><button type="button" class="pxa-x" onclick="PixelAvatar.close()" aria-label="Close">✕</button></div>'
            + '<div class="pxa-prev" id="pxa-prev">' + svg(draft, 120) + '</div>'
            + RAILS.map(function (r) {
                var k = r[1], cur = +draft[k], items = '';
                for (var i = 0; i < N[k]; i++) {
                    var on = i === cur, c = draft.split(''); c[k] = i;
                    items += r[2] ? '<button type="button" class="pxa-sw' + (on ? ' on' : '') + '" aria-label="' + r[0] + ' ' + (i + 1) + '" aria-pressed="' + on + '" onclick="PixelAvatar.set(' + k + ',' + i + ')"><i style="background:' + r[2][i] + '"></i></button>'
                        : '<button type="button" class="pxa-c' + (on ? ' on' : '') + '" aria-label="' + r[0] + ' ' + (i + 1) + '" aria-pressed="' + on + '" onclick="PixelAvatar.set(' + k + ',' + i + ')">' + svg(c.join(''), 34) + '</button>';
                }
                return '<div class="pxa-rl">' + r[0] + '</div><div class="pxa-rail" role="group" aria-label="' + r[0] + '" data-k="' + k + '">' + items + '</div>';
            }).join('')
            + '<div class="pxa-foot"><button type="button" class="pxa-dice" id="pxa-dice" onclick="PixelAvatar.dice()" aria-label="Random">🎲</button><button type="button" class="pxa-go" id="pxa-save" onclick="PixelAvatar.save()">💾 Save</button></div></div>';
    }
    var CSS = '.pxa{display:inline-flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:50%;background:#e0e7ff;flex:none;vertical-align:middle}.pxa .pxa-svg{display:block;image-rendering:pixelated}'
        + '.pxa-row{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;background:#fff;text-align:left}.pxa-row.new{border-color:#7c3aed;background:#f5f3ff}'
        + '.pxa-who{flex:1;min-width:0;display:flex;flex-direction:column}.pxa-who b{font-size:.95em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pxa-who small{font-size:.75em;color:#64748b;font-weight:700}'
        + '.pxa-edit{background:#f5f3ff!important;border:1px solid #ddd6fe!important;border-radius:12px!important;min-width:44px;min-height:44px!important;font-size:1.1em;padding:0!important;margin:0!important;box-shadow:none!important;width:auto!important;cursor:pointer}'
        + '#pxModal{z-index:10050}#pxModal .modal-content{max-width:400px;padding:12px;border-radius:20px;max-height:92dvh;overflow:auto}'
        + '#pxModal button{font-family:inherit;width:auto;min-height:0;margin:0;box-shadow:none;cursor:pointer}'
        + '.pxa-sh{display:flex;flex-direction:column;gap:4px;color:#0f172a;text-align:left}.pxa-top{display:flex;align-items:center}.pxa-top h3{flex:1;margin:0;font-size:1.05em;color:#4c1d95}.pxa-x{background:none;border:0;font-size:1.15em;color:#94a3b8;min-width:36px;min-height:36px}'
        + '.pxa-prev{display:flex;justify-content:center;padding:6px;border-radius:16px;background:repeating-conic-gradient(#f1f5f9 0 25%,#fff 0 50%) 0 0/16px 16px}.pxa-prev svg{image-rendering:pixelated}'
        + '.pxa-rl{font-size:.7em;font-weight:900;color:#64748b;margin-top:2px}.pxa-rail{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px}.pxa-rail::-webkit-scrollbar{display:none}'
        + '.pxa-c{flex:none;border:2px solid #e2e8f0;border-radius:12px;background:#fff;display:grid;place-items:center;width:44px;height:44px;padding:0}.pxa-c.on{border-color:#7c3aed;background:#f5f3ff}.pxa-c svg{image-rendering:pixelated}'
        + '#pxModal .pxa-sw{flex:none;width:44px!important;height:44px!important;min-width:44px;border:0!important;background:none!important;padding:0!important;display:grid;place-items:center;border-radius:50%}'
        + '#pxModal .pxa-sw i{display:block;width:30px;height:30px;border-radius:50%;box-shadow:0 0 0 3px #fff,0 0 0 5px #e2e8f0}#pxModal .pxa-sw.on i{box-shadow:0 0 0 3px #fff,0 0 0 5px #7c3aed}'
        + '.pxa-foot{display:flex;gap:8px;margin-top:6px}.pxa-dice{background:#f5f3ff;border:0;border-radius:14px;min-width:52px;min-height:48px;font-size:1.3em}.pxa-go{flex:1;background:#7c3aed;color:#fff;border:0;border-radius:14px;min-height:48px;font-weight:900;font-size:1.05em}';
    function root() {
        var m = document.getElementById('pxModal');
        if (!m) {
            m = document.createElement('div'); m.id = 'pxModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'My pixel');
            m.innerHTML = '<div class="modal-content"><div id="pxa-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) PixelAvatar.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function render() { var m = root(), keep = {}; m.querySelectorAll('.pxa-rail').forEach(function (r) { keep[r.getAttribute('data-k')] = r.scrollLeft; }); document.getElementById('pxa-body').innerHTML = sheet(); m.querySelectorAll('.pxa-rail').forEach(function (r) { r.scrollLeft = keep[r.getAttribute('data-k')] || 0; }); m.style.display = 'flex'; }
    if (!document.getElementById('pxa-css')) { var st = document.createElement('style'); st.id = 'pxa-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }

    window.PixelAvatar = {
        svg: svg, face: face, ok: ok, random: random, mine: mine, lobbyRow: lobbyRow,
        /** ✏️ open the builder; `done` runs after 💾 (the game redraws its lobby) */
        edit: function (done) { draft = ensure(); after = typeof done === 'function' ? done : null; render(); },
        set: function (k, i) { if (!draft || k < 0 || k > 6 || i < 0 || i >= N[k]) return; var c = draft.split(''); c[k] = i; draft = c.join(''); render(); },
        dice: function () { draft = random(); render(); },
        save: function () {
            if (!ok(draft)) return; save(draft); PixelAvatar.close();
            var row = document.getElementById('pxa-row'); if (row) row.outerHTML = lobbyRow();
            if (after) after(draft);
        },
        close: function () { var m = document.getElementById('pxModal'); if (m) m.style.display = 'none'; },
        _draft: function () { return draft; }
    };
})();
