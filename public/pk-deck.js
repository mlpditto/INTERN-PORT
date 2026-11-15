// V101.312 🧠 PK flash cards (owner picks 2026-11-15, mockup-pk-deck/: C + A, opened from the DD Codex drug list).
// The 🧠 n button beside the drug search shows how many of the LISTED drugs (letter page / search) have card lines; it stays hidden at 0.
// A card shows the drug's five short A·D·M·E·T lines covered: on the saved ADMET picture when the drug has one (C), in five fixed slots
// otherwise (A). Tap a label to open it, 👁 opens all, then 🔁 Again or ✓ Got it. Lines come from `pkCard` (admin 🧠 Card lines), else from
// `pkVisual.labels`. Again / Got it is kept on this device only (localStorage `pkDeck1`) — nothing is written to Firestore.
(function () {
    'use strict';
    var KEYS = ['a', 'd', 'm', 'e', 't'], STORE = 'pkDeck1';
    var T = {
        title: { en: 'PK cards', th: 'การ์ด PK', ko: 'PK 카드' },
        hint: { en: '👆 Tap a label to open', th: '👆 แตะป้ายเพื่อเปิด', ko: '👆 라벨을 눌러 열기' },
        all: { en: 'Open all', th: 'เปิดทั้งหมด', ko: '모두 열기' },
        again: { en: '🔁 Again', th: '🔁 อีกรอบ', ko: '🔁 다시' },
        got: { en: '✓ Got it', th: '✓ จำได้', ko: '✓ 외웠어요' },
        gotN: { en: '✓ Got it', th: '✓ จำได้', ko: '✓ 외움' },
        againN: { en: '🔁 Again', th: '🔁 อีกรอบ', ko: '🔁 다시' },
        close: { en: 'Close', th: 'ปิด', ko: '닫기' },
        rest: { en: '🔁 Review {n}', th: '🔁 ท่องอีก {n}', ko: '🔁 복습 {n}' }
    };
    var STYLE = '.dc-toolbar{display:flex;gap:8px;align-items:center}.dc-toolbar input[type="text"]{flex:1;min-width:0}' +
        '#dc-pk-deck-btn{flex:none;width:auto;margin:0;color:inherit;display:inline-flex;align-items:center;gap:5px;min-height:38px;padding:0 10px;border:1.5px solid #ddd6fe;border-radius:10px;background:#f5f3ff;font:inherit;font-size:1em;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
        '#dc-pk-deck-btn[hidden]{display:none}#dc-pk-deck-btn b{background:#4f46e5;color:#fff;border-radius:9px;padding:1px 7px;font-size:.72em;font-weight:800}' +
        '#pkdeck{position:fixed;inset:0;z-index:10060;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center}' +
        '#pkdeck .sheet{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#fff;border-radius:18px 18px 0 0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));box-sizing:border-box;color:#0f172a}' +
        '#pkdeck .top{display:flex;align-items:center;gap:8px;font-weight:800;font-size:.9em}#pkdeck .top .n{margin-left:auto;font-size:.82em;color:#64748b;font-weight:700}' +
        '#pkdeck .x{border:0;background:#f1f5f9;border-radius:50%;width:32px!important;height:32px;min-height:0;padding:0;flex:none;font-size:1em;cursor:pointer;color:#334155}' +
        '#pkdeck .bar{height:4px;background:#e2e8f0;border-radius:3px;margin:8px 0 10px;overflow:hidden}#pkdeck .bar i{display:block;height:100%;background:#4f46e5;border-radius:3px}' +
        '#pkdeck .name{font-weight:800;font-size:1.08em;color:#1e3a8a;display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px}' +
        '#pkdeck .cls{font-size:.62em;font-weight:700;background:#dcfce7;color:#166534;border-radius:8px;padding:2px 7px}' +
        '#pkdeck .pic{position:relative;border-radius:12px;overflow:hidden;background:#eef2ff;min-height:220px}#pkdeck .pic img{display:block;width:100%;height:auto}' +
        '#pkdeck button{margin:0;width:auto}#pkdeck .lab{position:absolute;max-width:46%;border:1px solid #c7d2fe;border-radius:8px;background:rgba(255,255,255,.96);padding:5px 8px;min-height:30px;font:inherit;font-size:.72em;font-weight:700;line-height:1.3;text-align:left;color:#0f172a;cursor:pointer}' +
        '#pkdeck .lab i,#pkdeck .slot i{font-style:normal;font-weight:800}#pkdeck .lab i{color:#7c3aed;margin-right:4px}' +
        '#pkdeck .lab.a{left:2%;top:3%}#pkdeck .lab.d{left:2%;top:42%}#pkdeck .lab.t{left:2%;bottom:3%}#pkdeck .lab.m{right:2%;top:3%}#pkdeck .lab.e{right:2%;bottom:14%}' +
        '#pkdeck .slot{display:flex;align-items:center;justify-content:flex-start;gap:9px;width:100%;min-height:44px;margin:0 0 7px;padding:6px 10px;border:0;border-radius:10px;background:#f1f5f9;font:inherit;font-size:.86em;font-weight:700;line-height:1.3;text-align:left;color:#0f172a;cursor:pointer;box-sizing:border-box}' +
        '#pkdeck .slot i{flex:none;width:26px;height:26px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8em}' +
        '#pkdeck .slot.a i{background:#0ea5e9}#pkdeck .slot.d i{background:#8b5cf6}#pkdeck .slot.m i{background:#f59e0b}#pkdeck .slot.e i{background:#10b981}#pkdeck .slot.t i{background:#ef4444}' +
        '#pkdeck .slot.shut{background:repeating-linear-gradient(135deg,#f1f5f9 0 8px,#e2e8f0 8px 16px);color:#64748b}#pkdeck .lab.shut{color:#64748b}' +
        '#pkdeck .hint{text-align:center;font-size:.72em;color:#64748b;margin:8px 0}' +
        '#pkdeck .foot{display:flex;gap:8px}#pkdeck .foot button{min-height:44px;border-radius:10px;font:inherit;font-weight:800;font-size:.9em;cursor:pointer;border:1.5px solid #e2e8f0;background:#fff;color:#1e293b;flex:1}' +
        '#pkdeck .foot .eye{flex:none;width:52px;background:#f1f5f9;border-color:#f1f5f9}#pkdeck .foot .ok{background:#16a34a;border-color:#16a34a;color:#fff}#pkdeck .foot .more{background:#4f46e5;border-color:#4f46e5;color:#fff}' +
        '#pkdeck .end{display:flex;gap:8px;margin:4px 0 10px}#pkdeck .end div{flex:1;border-radius:12px;padding:10px;text-align:center;font-size:.78em;font-weight:700}#pkdeck .end b{display:block;font-size:1.7em}' +
        '#pkdeck .end .g{background:#dcfce7;color:#166534}#pkdeck .end .r{background:#fef3c7;color:#92400e}';

    var st = null;   // { cards:[{d, lines, keys}], i, open:{}, noPic:{}, got, again:[] }

    function lang() { var c = document.body.classList; return c.contains('lang-th-on') ? 'th' : c.contains('lang-kr-on') ? 'ko' : 'en'; }
    function L(o, n) { return (o[lang()] || o.en).split('{n}').join(n); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function read() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } }
    function mark(id, v) { try { var m = read(); m[id] = v; localStorage.setItem(STORE, JSON.stringify(m)); } catch (e) { /* private window: the deck still works */ } }

    // the five short lines of a drug, or null: admin-checked `pkCard` first, else the labels saved with the ADMET picture
    function lines(d) {
        var src = [d && d.pkCard, d && d.pkVisual && d.pkVisual.labels], i, k, out;
        for (i = 0; i < src.length; i++) {
            if (!src[i] || typeof src[i] !== 'object') continue;
            out = {};
            for (k = 0; k < KEYS.length; k++) { var t = String(src[i][KEYS[k]] || '').trim(); if (t) out[KEYS[k]] = t; }
            if (Object.keys(out).length) return out;
        }
        return null;
    }
    function listed() {
        var ds = (window.dcState && (dcState.listed || [])) || [];
        return ds.map(function (d) { var l = lines(d); return l ? { d: d, lines: l, keys: KEYS.filter(function (k) { return l[k]; }) } : null; }).filter(Boolean);
    }
    function refresh() {
        var b = document.getElementById('dc-pk-deck-btn'); if (!b) return;
        var n = listed().length;
        b.hidden = !n; b.querySelector('b').textContent = String(n);
    }

    function close() { var el = document.getElementById('pkdeck'); if (el) el.remove(); document.removeEventListener('keydown', onKey); st = null; }
    function onKey(e) { if (e.key === 'Escape') close(); }

    function open(cards) {
        if (!cards) {   // not yet "got" on this device first, same A–Z order inside each half
            var m = read(), all = listed();
            cards = all.filter(function (c) { return m[c.d._id] !== 'g'; }).concat(all.filter(function (c) { return m[c.d._id] === 'g'; }));
        }
        if (!cards.length) return;
        close();
        st = { cards: cards, i: 0, open: {}, noPic: {}, got: 0, again: [] };
        if (!document.getElementById('pkdeck-css')) { var s = document.createElement('style'); s.id = 'pkdeck-css'; s.textContent = STYLE; document.head.appendChild(s); }
        var el = document.createElement('div'); el.id = 'pkdeck'; el.className = 'lang-no-toggle'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.innerHTML = '<div class="sheet"></div>';
        el.addEventListener('click', function (e) {
            if (e.target === el) return close();
            var b = e.target.closest('[data-act]'); if (!b || !st) return;
            var act = b.dataset.act, c = st.cards[st.i];
            if (act === 'x') return close();
            if (act === 'k') st.open[b.dataset.k] = true;
            else if (act === 'all') c.keys.forEach(function (k) { st.open[k] = true; });
            else if (act === 'got' || act === 'again') {
                if (act === 'got') st.got++; else st.again.push(c);
                mark(c.d._id, act === 'got' ? 'g' : 'a');
                st.i++; st.open = {};
            } else if (act === 'rest') return open(st.again);
            paint();
        });
        document.body.appendChild(el);
        document.addEventListener('keydown', onKey);
        paint();
    }

    function paint() {
        var sheet = document.querySelector('#pkdeck .sheet'); if (!sheet || !st) return;
        var N = st.cards.length, done = st.i >= N, c = st.cards[st.i];
        var head = '<div class="top">🧠 ' + esc(L(T.title)) + '<span class="n">' + Math.min(st.i + 1, N) + ' / ' + N + '</span>' +
            '<button type="button" class="x" data-act="x" aria-label="' + esc(L(T.close)) + '">✕</button></div>' +
            '<div class="bar"><i style="width:' + Math.round((done ? N : st.i) / N * 100) + '%"></i></div>';
        if (done) {
            sheet.innerHTML = head + '<div class="end"><div class="g"><b>' + st.got + '</b>' + esc(L(T.gotN)) + '</div><div class="r"><b>' + st.again.length + '</b>' + esc(L(T.againN)) + '</div></div>' +
                '<div class="foot"><button type="button" data-act="x">' + esc(L(T.close)) + '</button>' +
                (st.again.length ? '<button type="button" class="more" data-act="rest">' + esc(L(T.rest, st.again.length)) + '</button>' : '') + '</div>';
            return;
        }
        var d = c.d, url = d.pkVisual && String(d.pkVisual.downloadUrl || ''), pic = /^https?:\/\//i.test(url) && !st.noPic[d._id];
        var cell = function (k) {
            var shut = !st.open[k];
            return '<button type="button" class="' + (pic ? 'lab ' : 'slot ') + k + (shut ? ' shut' : '') + '" data-act="k" data-k="' + k + '" aria-label="' + k.toUpperCase() + '"><i>' + k.toUpperCase() + '</i>' +
                '<span>' + (shut ? '?' : esc(c.lines[k])) + '</span></button>';
        };
        var body = pic ? '<div class="pic"><img src="' + esc(url) + '" alt="">' + c.keys.map(cell).join('') + '</div>' : c.keys.map(cell).join('');
        var opened = c.keys.filter(function (k) { return st.open[k]; }).length;
        sheet.innerHTML = head + '<div class="name">' + esc(d.genericName || '') + (d.class ? '<span class="cls">' + esc(d.class) + '</span>' : '') + '</div>' + body +
            '<div class="hint">' + esc(L(T.hint)) + ' · ' + opened + ' / ' + c.keys.length + '</div>' +
            '<div class="foot"><button type="button" class="eye" data-act="all" aria-label="' + esc(L(T.all)) + '" title="' + esc(L(T.all)) + '">👁</button>' +
            '<button type="button" data-act="again">' + esc(L(T.again)) + '</button><button type="button" class="ok" data-act="got">' + esc(L(T.got)) + '</button></div>';
        var img = sheet.querySelector('.pic img');   // a picture that does not load → the five slots (A)
        if (img) img.addEventListener('error', function () { if (st) { st.noPic[d._id] = true; paint(); } });
    }

    var s0 = document.createElement('style'); s0.id = 'pkdeck-css'; s0.textContent = STYLE; document.head.appendChild(s0);
    window.PkDeck = { open: function () { open(); }, refresh: refresh, lines: lines, listed: listed, close: close };
})();
