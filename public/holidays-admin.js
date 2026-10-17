// V102.272: admin Holidays — (1) the 🎌 panel beside the Event form (pick a country + year, load its list, tick the days interns should see, save one Firestore
// document per country and year: holidays/<CC>_<year>), and (2) the 🗓 "coming up" strip on the Dashboard (3 days back … 14 days ahead; health 🩺 and cat 🐱 days
// are shown to interns only after an admin approves them: holidays/OBS_<year>). Lists: Thailand = public/th-holidays.json, Japan / Korea / Singapore = Nager.Date
// (fetched from this browser), health + cat days = public/observances.json. Interns read the saved documents only — they never call Nager.Date.
(function () {
    'use strict';
    var COUNTRIES = [['TH', '🇹🇭', 'Thailand'], ['JP', '🇯🇵', 'Japan'], ['KR', '🇰🇷', 'South Korea'], ['SG', '🇸🇬', 'Singapore']];
    var KIND = { h: { bg: '#fff1f2', bd: '#fecdd3', fg: '#9f1239', ic: '🎌', name: 'Public holidays' }, m: { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#065f46', ic: '🩺', name: 'Health days' }, c: { bg: '#fffbeb', bd: '#fde68a', fg: '#92400e', ic: '🐱', name: 'Cat days' } };
    var BACK = 3, AHEAD = 14;
    var S = { cc: 'TH', year: 0, list: [], ticked: [], from: '', dirty: false, state: 'idle', err: '', saved: {}, obs: {}, obsList: [], loaded: false, loading: false, hide: {} };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var bkkToday = function () { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()); };
    var dayNum = function (d) { return Math.round(Date.parse(d + 'T00:00:00Z') / 86400000); };
    var shortDate = function (d) { return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); };
    var docId = function (cc, y) { return cc + '_' + y; };
    var flagOf = function (cc) { var c = COUNTRIES.find(function (x) { return x[0] === cc; }); return c ? c[1] : cc; };
    S.year = Number(bkkToday().slice(0, 4));

    // ---- pure helpers (also used by the test)
    function expandObs(obsList, years) { var out = []; years.forEach(function (y) { obsList.forEach(function (o) { out.push({ d: y + '-' + o.md, k: o.k, t: o.en }); }); }); return out; }
    // everything dated between today−BACK and today+AHEAD: the saved public holidays (always "approved": they were ticked), and the health / cat days with their approval
    function windowItems(saved, obsList, obsApproved, today) {
        var t = dayNum(today), lo = t - BACK, hi = t + AHEAD, years = [Number(today.slice(0, 4)), Number(new Date((hi) * 86400000).toISOString().slice(0, 4)), Number(new Date(lo * 86400000).toISOString().slice(0, 4))].filter(function (y, i, a) { return a.indexOf(y) === i; });
        var items = [];
        Object.keys(saved).forEach(function (id) { var cc = id.split('_')[0]; (saved[id] || []).forEach(function (h) { items.push({ d: h.d, k: 'h', f: flagOf(cc), t: h.en, on: true, cc: cc }); }); });
        expandObs(obsList, years).forEach(function (o) { var a = (obsApproved[o.d.slice(0, 4)] || []).some(function (x) { return x.d === o.d && x.k === o.k; }); items.push({ d: o.d, k: o.k, f: KIND[o.k].ic, t: o.t, on: a }); });
        return items.filter(function (i) { var n = dayNum(i.d); return n >= lo && n <= hi; }).sort(function (a, b) { return a.d.localeCompare(b.d) || 'hmc'.indexOf(a.k) - 'hmc'.indexOf(b.k); });
    }

    // ---- data
    function css() {
        if (document.getElementById('hol-css')) return;
        var s = document.createElement('style'); s.id = 'hol-css';
        s.textContent = '.hol-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}.hol-right{border-left:1px solid #f1f5f9;padding-left:18px;min-width:0;position:relative}' +
            '@media(max-width:860px){.hol-grid{grid-template-columns:1fr}.hol-right{border-left:0;padding-left:0;border-top:1px solid #f1f5f9;padding-top:14px}}' +
            '.hol-chips{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px}.hol-chip{position:relative;width:auto;min-height:0;margin:0;padding:4px 11px;border-radius:999px;font-size:14px;font-weight:700;cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#475569}' +
            '.hol-chip[aria-pressed="true"]{border-color:#c4b5fd;background:#ede9fe;color:#5b21b6}.hol-chip .hol-n{font-size:12px;color:#15803d;margin-left:4px}.hol-dot{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff}' +
            '.hol-src{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12.5px;color:#64748b}.hol-ib{width:32px;min-height:0;height:32px;padding:0;margin:0;border-radius:8px;border:1px solid #e2e8f0;background:#fff;cursor:pointer}' +
            '.hol-list{max-height:300px;overflow:auto;border:1px solid #f1f5f9;border-radius:10px;margin-bottom:60px}.hol-list table{width:100%;border-collapse:collapse}.hol-list td{padding:4px 6px;border-bottom:1px solid #f1f5f9;font-size:13.5px}.hol-list td.d{color:#64748b;white-space:nowrap;font-variant-numeric:tabular-nums;font-size:12.5px;width:48px}.hol-list td.c{width:26px}.hol-list input{width:auto;margin:0}.hol-list small{color:#94a3b8}' +
            '.hol-fab{position:absolute;right:20px;bottom:6px;width:48px;height:48px;min-height:0;padding:0;margin:0;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 12px rgba(15,23,42,.2);transition:background .3s}.hol-fab i{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#fff;font-style:normal;font-size:18px}' +
            '.hol-fab[data-state="saving"] i{animation:holSpin 1s linear infinite}@keyframes holSpin{to{transform:rotate(360deg)}}.hol-fab[data-state="saved"] i{color:#16a34a;font-weight:900}.hol-fab[data-state="error"] i{color:#dc2626}' +
            '#hol-strip{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 10px;padding:6px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:12px}#hol-strip[hidden]{display:none}.hol-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 6px 4px 10px;border-radius:999px;border:1px solid;font-size:12.5px;font-weight:700;white-space:nowrap}.hol-pill em{font-style:normal;font-weight:800;opacity:.7}' +
            '.hol-ok{display:inline-grid;place-items:center;width:20px;height:20px;min-height:0;padding:0;margin:0 0 0 2px;border-radius:50%;font-size:12px;font-weight:900;cursor:pointer;border:1.5px dashed #cbd5e1;background:#fff;color:#94a3b8}.hol-ok.on{background:#16a34a;color:#fff;border:0}.hol-ok.fixed{cursor:default}' +
            '.hol-kinds{display:inline-flex;gap:4px;margin-left:auto}.hol-kinds button{width:auto;min-height:0;margin:0;padding:2px 9px;border-radius:999px;font-size:15px;cursor:pointer;border:1px solid}.hol-kinds button[aria-pressed="false"]{opacity:.35}';
        document.head.appendChild(s);
    }
    function loadDocs() {
        if (S.loading || S.loaded) return Promise.resolve();
        S.loading = true;
        var obsFile = fetch('observances.json').then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (j) { S.obsList = (j.items || []).map(function (o) { return { md: o.md, k: o.k, en: o.en }; }); }).catch(function () { S.obsList = []; });
        var docs = db.collection('holidays').get().then(function (snap) {
            snap.docs.forEach(function (d) { var x = d.data() || {}, id = d.id; if (id.indexOf('OBS_') === 0) S.obs[id.slice(4)] = x.items || []; else S.saved[id] = x.items || []; });
        }).catch(function (e) { S.err = (e && e.message) || 'read failed'; });
        return Promise.all([obsFile, docs]).then(function () { S.loaded = true; S.loading = false; });
    }
    function sourceList(cc, year) {
        if (cc === 'TH') return fetch('th-holidays.json').then(function (r) { if (!r.ok) throw new Error('th-holidays.json ' + r.status); return r.json(); }).then(function (j) { return ((j.years || {})[year] || []).map(function (h) { return { d: h.d, en: h.en, local: h.th }; }); });
        return fetch('https://date.nager.at/api/v3/PublicHolidays/' + year + '/' + cc).then(function (r) { if (r.status === 204) return []; if (!r.ok) throw new Error('Nager.Date ' + r.status); return r.json(); })
            .then(function (a) { return a.map(function (h) { return { d: h.date, en: h.name, local: h.localName === h.name ? '' : h.localName }; }); });
    }
    function applyList(list, from) {
        list = list.slice().sort(function (a, b) { return a.d.localeCompare(b.d); });
        var saved = S.saved[docId(S.cc, S.year)], have = saved ? new Set(saved.map(function (h) { return h.d; })) : null;
        S.list = list; S.ticked = list.map(function (h) { return have ? have.has(h.d) : true; }); S.from = from; S.dirty = false; S.state = 'idle'; S.err = '';
    }
    function showSaved() {   // what is saved for this country + year, shown as ticked rows (the source list is one tap away)
        var saved = S.saved[docId(S.cc, S.year)];
        if (saved) { S.list = saved.slice(); S.ticked = saved.map(function () { return true; }); S.from = 'saved'; } else { S.list = []; S.ticked = []; S.from = ''; }
        S.dirty = false; S.state = 'idle';
    }

    // ---- the panel
    function render() {
        var box = document.getElementById('hol-panel'); if (!box) return;
        var n = S.ticked.filter(Boolean).length, total = S.list.length, pct = total ? Math.round(100 * n / total) : 0;
        var ring = S.state === 'saved' ? '#16a34a' : S.state === 'saving' ? '#7c3aed' : S.state === 'error' ? '#dc2626' : '#f59e0b';
        var glyph = S.state === 'saved' ? '✓' : S.state === 'saving' ? '⏳' : S.state === 'error' ? '⚠️' : '💾';
        var idle = S.state === 'idle' && !S.dirty;
        var chips = COUNTRIES.map(function (c) {
            var saved = S.saved[docId(c[0], S.year)], on = c[0] === S.cc;
            return '<button type="button" class="hol-chip" aria-pressed="' + on + '" aria-label="' + esc(c[2]) + '" title="' + esc(c[2]) + '" onclick="Holidays.pick(\'' + c[0] + '\')">' + c[1] + (saved ? '<span class="hol-n">✓ ' + saved.length + '</span>' : '') + (on && S.dirty ? '<span class="hol-dot"></span>' : '') + '</button>';
        }).join('');
        var years = [S.year0, S.year0 + 1].map(function (y) { return '<button type="button" class="hol-chip" aria-pressed="' + (y === S.year) + '" onclick="Holidays.setYear(' + y + ')">' + y + '</button>'; }).join('');
        var src = S.cc === 'TH' ? '<button type="button" class="hol-ib" onclick="Holidays.load()" title="Load the list kept in the app" aria-label="Load list">📄</button>' : '<button type="button" class="hol-ib" onclick="Holidays.load()" title="Fetch from Nager.Date" aria-label="Fetch list">⬇</button>';
        var note = S.state === 'error' ? esc(S.err) : S.from === 'saved' ? 'saved' : S.from === 'loading' ? '…' : S.from ? (S.cc === 'TH' ? 'from the app' : 'just now') : '';
        var rows = S.list.map(function (h, i) { return '<tr><td class="c"><input type="checkbox" ' + (S.ticked[i] ? 'checked' : '') + ' onchange="Holidays.tick(' + i + ',this.checked)" aria-label="' + esc(h.en) + '"></td><td class="d">' + h.d.slice(5) + '</td><td>' + esc(h.en) + (h.local ? ' <small>' + esc(h.local) + '</small>' : '') + '</td></tr>'; }).join('');
        box.innerHTML = '<h2 style="margin-top:0;">🎌 Holidays</h2><div class="hol-chips">' + chips + '<span style="flex:1"></span>' + years + '</div>' +
            '<div class="hol-src">' + src + '<span>' + note + '</span><span style="flex:1"></span><button type="button" class="hol-ib" onclick="Holidays.tickAll(true)" title="Tick all" aria-label="Tick all">☑</button><button type="button" class="hol-ib" onclick="Holidays.tickAll(false)" title="Clear all" aria-label="Clear all">☐</button></div>' +
            '<div class="hol-list"><table>' + rows + '</table></div>' +
            '<button type="button" class="hol-fab" data-state="' + (idle ? 'idle' : S.state === 'idle' ? 'dirty' : S.state) + '" onclick="Holidays.save()" ' + (!total ? 'disabled ' : '') + 'title="' + (S.state === 'error' ? esc(S.err) : 'Save ' + n + ' of ' + total + ' days') + '" aria-label="Save" style="background:' + (idle ? '#e2e8f0' : 'conic-gradient(' + ring + ' ' + (S.state === 'saved' || S.state === 'saving' ? 100 : pct) + '%, #e2e8f0 0)') + '"><i>' + glyph + '</i></button>';
    }
    function init() {
        css(); S.year0 = Number(bkkToday().slice(0, 4)); if (!S.year) S.year = S.year0;
        render();
        return loadDocs().then(function () { if (S.from === '') showSaved(); render(); renderStrip(); });
    }
    function pick(cc) { S.cc = cc; showSaved(); render(); }
    function setYear(y) { S.year = y; showSaved(); render(); }
    function load() {
        S.from = 'loading'; render();
        return sourceList(S.cc, S.year).then(function (l) { applyList(l, 'src'); render(); }).catch(function (e) { S.from = ''; S.state = 'error'; S.err = (e && e.message) || 'load failed'; render(); });
    }
    function tick(i, on) { S.ticked[i] = !!on; S.dirty = true; S.state = 'idle'; render(); }
    function tickAll(on) { S.ticked = S.list.map(function () { return !!on; }); S.dirty = true; S.state = 'idle'; render(); }
    function save() {
        if (S.state === 'saving' || !S.list.length) return Promise.resolve();
        var items = S.list.filter(function (h, i) { return S.ticked[i]; }).map(function (h) { return { d: h.d, en: h.en, local: h.local || '' }; }), id = docId(S.cc, S.year);
        S.state = 'saving'; render();
        return db.collection('holidays').doc(id).set({ country: S.cc, year: S.year, items: items, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function () {
            S.saved[id] = items; S.dirty = false; S.state = 'saved'; S.from = 'saved'; render(); renderStrip();
            setTimeout(function () { if (S.state === 'saved') { S.state = 'idle'; render(); } }, 2000);
        }).catch(function (e) { S.state = 'error'; S.err = (e && e.message) || 'save failed'; render(); });
    }

    // ---- the Dashboard strip
    function renderStrip() {
        var host = document.getElementById('tab-sidequest'); if (!host || !S.loaded) return;
        var el = document.getElementById('hol-strip');
        if (!el) { el = document.createElement('div'); el.id = 'hol-strip'; el.className = 'lang-no-toggle'; host.insertBefore(el, host.firstChild); }
        var today = bkkToday(), all = windowItems(S.saved, S.obsList, S.obs, today), items = all.filter(function (i) { return !S.hide[i.k]; });
        if (!all.length) { el.hidden = true; return; }
        el.hidden = false;
        var pills = items.slice(0, 12).map(function (i) {
            var k = KIND[i.k], diff = dayNum(i.d) - dayNum(today), tail = diff === 0 ? 'today' : diff > 0 ? '+' + diff : String(diff);
            var ok = i.k === 'h' ? '<span class="hol-ok on fixed" title="Interns see this day (ticked in 🎌 Holidays)">✓</span>' : '<button type="button" class="hol-ok' + (i.on ? ' on' : '') + '" onclick="Holidays.toggleObs(\'' + i.d + '\',\'' + i.k + '\')" aria-pressed="' + !!i.on + '" title="' + (i.on ? 'Shown to interns — tap to hide' : 'Not shown to interns — tap to show') + '">' + (i.on ? '✓' : '👁') + '</button>';
            return '<span class="hol-pill" style="background:' + k.bg + ';border-color:' + k.bd + ';color:' + k.fg + ';opacity:' + (diff < 0 ? 0.5 : 1) + '" title="' + esc(i.t) + '">' + i.f + ' ' + shortDate(i.d) + ' <span style="font-weight:600;opacity:.85">' + esc(i.t.length > 24 ? i.t.slice(0, 23) + '…' : i.t) + '</span> <em>' + tail + '</em>' + ok + '</span>';
        }).join('');
        var kinds = ['h', 'm', 'c'].map(function (k) { var x = KIND[k]; return '<button type="button" aria-pressed="' + !S.hide[k] + '" title="' + x.name + '" style="background:' + x.bg + ';border-color:' + x.bd + '" onclick="Holidays.toggleKind(\'' + k + '\')">' + x.ic + '</button>'; }).join('');
        el.innerHTML = '<span title="Coming up" style="font-size:18px">🗓</span>' + pills + '<span class="hol-kinds">' + kinds + '</span>';
    }
    function toggleKind(k) { S.hide[k] = !S.hide[k]; renderStrip(); }
    function toggleObs(d, k) {
        var y = d.slice(0, 4), items = (S.obs[y] || []).slice(), at = items.findIndex(function (x) { return x.d === d && x.k === k; });
        if (at >= 0) items.splice(at, 1); else { var o = S.obsList.find(function (x) { return y + '-' + x.md === d && x.k === k; }); items.push({ d: d, k: k, en: o ? o.en : '' }); }
        items.sort(function (a, b) { return a.d.localeCompare(b.d); });
        var before = S.obs[y]; S.obs[y] = items; renderStrip();
        return db.collection('holidays').doc('OBS_' + y).set({ kind: 'obs', year: Number(y), items: items, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function (e) { S.obs[y] = before || []; renderStrip(); if (typeof showToast === 'function') showToast('⚠️ ' + ((e && e.message) || 'save failed')); });
    }
    function boot() { css(); return loadDocs().then(renderStrip); }
    window.Holidays = { init: init, boot: boot, pick: pick, setYear: setYear, load: load, tick: tick, tickAll: tickAll, save: save, toggleKind: toggleKind, toggleObs: toggleObs, renderStrip: renderStrip, _S: S, _windowItems: windowItems, _expandObs: expandObs };
})();
