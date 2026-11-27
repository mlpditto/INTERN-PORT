/* V102.711 🧪 Tester codes on the admin (owner 2026-11-27, pick B = its own 🧪 in the User Hub bar; lean · inline · less text ·
   English only, mockup-tester-code/tester-lean.png). One row makes a group code: Group · 👥 5/10/20 · ⏳ 3/7/14 d · ＋ →
   tester_codes/TEST-nnnn. Each code: TEST-nnnn · group · used/max · →end, 📤 copies the LINE link (?tester=) and opens LINE share,
   ⏸/▶ pauses. Under them, everyone who joined with their device (from claimTester). Live while open. window.testerAdmin */
(function () {
    'use strict';
    var LIFF = '2008959998-yjcNpaGt', MAXS = [5, 10, 20], DAYS = [3, 7, 14];
    var st = { max: 10, days: 7, codes: [], un: null, msg: '' };
    var ICON = { android: '🤖', ios: '🍎', pc: '💻', other: '📱' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function day(ms) { return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }); }
    function link(code) { return 'https://liff.line.me/' + LIFF + '?tester=' + code; }
    function dev(d) { d = d || {}; return (ICON[d.os] || '📱') + ' ' + esc(d.model || d.modelCode || ({ android: 'Android', ios: 'iOS', pc: 'PC' }[d.os] || '')); }
    var CSS = '#taModal .modal-content{max-width:420px;padding:10px;border-radius:14px}#taModal .ta{display:flex;flex-direction:column;gap:5px;font-size:13px;color:#0f172a}'
        + '#taModal button{font-family:inherit;margin:0;min-height:0;box-shadow:none;cursor:pointer;width:auto}'
        + '#taModal .ta-r{display:flex;gap:4px;align-items:center}#taModal .ta-m{color:#64748b;font-size:11px;font-weight:700;white-space:nowrap}'
        + '#taModal .ta-c{border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:800;background:#fff;color:#0f172a;white-space:nowrap}'
        + '#taModal .ta-in{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:8px;padding:3px 7px;font-size:13px}'
        + '#taModal .ta-b{border:0;border-radius:8px;padding:3px 9px;font-weight:900;background:#7c3aed;color:#fff}'
        + '#taModal .ta-code{display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:8px;background:#faf5ff;border:1px dashed #a78bfa}#taModal .ta-code.off{opacity:.5}'
        + '#taModal .ta-code b{font-family:ui-monospace,monospace;font-size:14px;letter-spacing:1px}#taModal .ta-f{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}'
        + '#taModal .ta-i{width:24px;height:24px;border-radius:7px;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;padding:0}#taModal .ta-i.g{background:#06c755;border-color:#06c755}'
        + '#taModal .ta-u{display:flex;align-items:center;gap:5px;font-size:12px;padding:1px 4px}#taModal .ta-u img,#taModal .ta-av{width:18px;height:18px;border-radius:50%;object-fit:cover;background:#c7d2fe;flex:none}'
        + '#taModal .ta-u .n{flex:1;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#taModal .ta-tag{font-size:10px;font-weight:900;padding:1px 6px;border-radius:999px;background:#ede9fe;color:#6d28d9}'
        + '#taModal .ta-sep{height:1px;background:#e2e8f0}#taModal .ta-x{margin-left:auto;background:none;border:0;color:#94a3b8;font-size:16px}#taModal .ta-err{color:#b91c1c;font-weight:800;font-size:12px}';
    function root() {
        var m = document.getElementById('taModal');
        if (!m) {
            if (!document.getElementById('ta-css')) { var s = document.createElement('style'); s.id = 'ta-css'; s.textContent = CSS; document.head.appendChild(s); }
            m = document.createElement('div'); m.id = 'taModal'; m.className = 'modal lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Tester codes');
            m.innerHTML = '<div class="modal-content"><div id="ta-body"></div></div>';
            m.addEventListener('click', function (e) { if (e.target === m) testerAdmin.close(); });
            document.body.appendChild(m);
        }
        return m;
    }
    function html() {
        var now = Date.now(), live = st.codes.filter(function (c) { return c.untilMs > now; }), ppl = 0;
        st.codes.forEach(function (c) { ppl += (c.testers || []).length; });
        var h = '<div class="ta"><div class="ta-r"><b>🧪 Tester</b><span class="ta-m" id="ta-sum">' + live.length + ' open · ' + ppl + ' testers</span><button type="button" class="ta-x" onclick="testerAdmin.close()" aria-label="Close">✕</button></div>'
            + '<div class="ta-r"><input class="ta-in" id="ta-label" maxlength="40" placeholder="Group" aria-label="Group">'
            + '<button type="button" class="ta-c" id="ta-max" onclick="testerAdmin.cycle(\'max\')" title="How many people">👥 ' + st.max + '</button>'
            + '<button type="button" class="ta-c" id="ta-days" onclick="testerAdmin.cycle(\'days\')" title="How long">⏳ ' + st.days + 'd</button>'
            + '<button type="button" class="ta-b" id="ta-new" onclick="testerAdmin.create()" aria-label="New tester code">＋</button></div>'
            + (st.msg ? '<div class="ta-err" id="ta-msg">' + esc(st.msg) + '</div>' : '');
        var rows = st.codes.slice().sort(function (a, b) { return (b.untilMs > now) - (a.untilMs > now) || (b.createdMs || 0) - (a.createdMs || 0); });
        h += rows.map(function (c) {
            var off = c.untilMs <= now || c.paused;
            return '<div class="ta-code' + (off ? ' off' : '') + '" data-code="' + c.id + '"><b>' + c.id + '</b><span class="ta-m ta-f">' + esc(c.label || '') + ' · ' + (c.used || 0) + '/' + c.max + ' · ' + (c.untilMs <= now ? 'ended' : '→' + day(c.untilMs)) + '</span>'
                + (c.untilMs > now ? '<button type="button" class="ta-i g" onclick="testerAdmin.share(\'' + c.id + '\')" title="Copy the link · LINE" aria-label="Share ' + c.id + '">📤</button>'
                    + '<button type="button" class="ta-i" onclick="testerAdmin.pause(\'' + c.id + '\')" title="' + (c.paused ? 'Resume' : 'Pause') + '" aria-label="' + (c.paused ? 'Resume' : 'Pause') + ' ' + c.id + '">' + (c.paused ? '▶' : '⏸') + '</button>' : '') + '</div>';
        }).join('');
        var people = [];
        st.codes.forEach(function (c) { (c.testers || []).forEach(function (t) { people.push(Object.assign({ code: c.id }, t)); }); });
        people.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        if (people.length) h += '<div class="ta-sep"></div>' + people.map(function (t) {
            return '<div class="ta-u">' + (t.pic ? '<img src="' + esc(t.pic) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ta-av"></span>') + '<span class="n">' + esc(t.name) + '</span><span class="ta-m">' + dev(t.device) + '</span><span class="ta-tag">' + t.code.slice(5) + '</span></div>';
        }).join('');
        return h + '</div>';
    }
    function render() { var m = document.getElementById('taModal'); if (m && m.style.display !== 'none') document.getElementById('ta-body').innerHTML = html(); }
    window.testerAdmin = {
        open: function () {
            var m = root(); m.style.display = 'block'; st.msg = ''; render();
            if (!st.un && typeof db !== 'undefined') st.un = db.collection('tester_codes').onSnapshot(function (s) {
                st.codes = s.docs.map(function (d) { var x = d.data(); return Object.assign({ id: d.id, createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 }, x); }); render();
            }, function () { st.msg = 'Could not load codes'; render(); });
        },
        close: function () { var m = document.getElementById('taModal'); if (m) m.style.display = 'none'; if (st.un) { st.un(); st.un = null; } },
        cycle: function (k) { var L = k === 'max' ? MAXS : DAYS, i = L.indexOf(st[k]); st[k] = L[(i + 1) % L.length]; render(); },
        create: function () {
            var label = ((document.getElementById('ta-label') || {}).value || '').trim().slice(0, 40) || 'Tester';
            function tryOne(n) {
                var code = 'TEST-' + ('000' + Math.floor(Math.random() * 10000)).slice(-4), ref = db.collection('tester_codes').doc(code);
                return ref.get().then(function (s) {
                    if (s.exists) { if (n > 5) throw new Error('busy'); return tryOne(n + 1); }
                    return ref.set({ label: label, max: st.max, used: 0, untilMs: Date.now() + st.days * 864e5, paused: false, testers: [], createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function () { return code; });
                });
            }
            st.msg = '';
            return tryOne(0).then(function (code) { var el = document.getElementById('ta-label'); if (el) el.value = ''; return code; }, function () { st.msg = 'Could not make a code'; render(); });
        },
        share: function (code) {
            var url = link(code), text = '🧪 Join the test: ' + url;
            try { if (navigator.clipboard) navigator.clipboard.writeText(url); } catch (_) { }
            try { window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener'); } catch (_) { }
            if (typeof showToast === 'function') showToast('📋 Link copied');
            return url;
        },
        pause: function (code) { var c = st.codes.filter(function (x) { return x.id === code; })[0]; if (c) return db.collection('tester_codes').doc(code).update({ paused: !c.paused }); },
        _link: link
    };
})();
