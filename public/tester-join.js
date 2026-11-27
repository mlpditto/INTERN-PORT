/* V101.384 🧪 Tester join on the phone (owner 2026-11-27, pick B + C, lean · inline · less text · English only,
   mockup-tester-code/tester-lean.png). A tester code TEST-nnnn typed in Register, or the LINE link ?tester=TEST-nnnn, opens this
   instead of the full form: 🧪 group · →end date, then ✓ Allow device info (we ask in the app; the web has no system prompt for
   this) or Skip → 🤖 · 🍎 · 💻. Allowed, the page reads what the phone already tells it — OS and version, the Android model
   (its code turned into a sales name for common phones), the LINE version and the screen size; an iPhone never tells its model,
   so the screen size gives a family (≈ iPhone 12–14). ▸ Start → claimTester (functions/tester-claim.js) creates the account and
   the app opens by itself (the users listener). A tester whose code has ended sees 🧪 Test ended. window.TesterJoin */
(function () {
    'use strict';
    var st = { code: '', label: '', until: 0, dev: null, msg: '', busy: false };
    // Android model codes → sales names (common in Thailand); unknown codes are shown as they are
    var ANDROID = { 'SM-A546': 'Galaxy A54', 'SM-A556': 'Galaxy A55', 'SM-A356': 'Galaxy A35', 'SM-A256': 'Galaxy A25', 'SM-A155': 'Galaxy A15', 'SM-A057': 'Galaxy A05s',
        'SM-S911': 'Galaxy S23', 'SM-S918': 'Galaxy S23 Ultra', 'SM-S921': 'Galaxy S24', 'SM-S928': 'Galaxy S24 Ultra', 'SM-S931': 'Galaxy S25', 'SM-S938': 'Galaxy S25 Ultra',
        'V2250': 'vivo V29', 'V2318': 'vivo V30', 'V2403': 'vivo V40', 'V2333': 'vivo Y28', 'CPH2591': 'OPPO Reno11', 'CPH2629': 'OPPO Reno12', 'CPH2565': 'OPPO A79',
        'RMX3830': 'realme C67', '2312DRA50G': 'Redmi Note 13 Pro', '23129RAA4G': 'Redmi Note 13', 'Pixel 8': 'Pixel 8', 'Pixel 9': 'Pixel 9' };
    // iPhone screen (CSS px, portrait) → family
    var IPHONE = { '375x667': 'iPhone SE / 8', '375x812': 'iPhone X–13 mini', '414x896': 'iPhone XR / 11', '390x844': 'iPhone 12–14', '428x926': 'iPhone 12–14 Max',
        '393x852': 'iPhone 14 Pro–16', '430x932': 'iPhone 14 Pro Max–16 Plus', '402x874': 'iPhone 16 Pro', '440x956': 'iPhone 16 Pro Max' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function day(ms) { return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }) : ''; }

    /** what the phone tells the page; nothing is typed */
    function read(ua, scr, hints) {
        ua = ua || ''; var d = { os: 'other', osVer: '', model: '', modelCode: '', line: '', screen: '', read: true };
        var w = Math.min(scr.w, scr.h), h = Math.max(scr.w, scr.h); d.screen = w + 'x' + h;
        var ln = ua.match(/\bLine\/([\d.]+)/i); if (ln) d.line = ln[1];
        var an = ua.match(/Android ([\d.]+);\s*([^;)]*?)(?:\s+Build\/|\))/);
        if (/iPhone|iPad|iPod/.test(ua)) {
            d.os = 'ios'; var v = ua.match(/OS (\d+(?:_\d+)*) like Mac/); d.osVer = v ? v[1].replace(/_/g, '.') : '';
            d.model = /iPad/.test(ua) ? 'iPad' : (IPHONE[d.screen] || 'iPhone');
        } else if (/Android/.test(ua)) {
            d.os = 'android'; d.osVer = an ? an[1] : '';
            var code = (hints && hints.model) || (an && an[2] !== 'K' ? an[2] : '') || '';
            d.modelCode = code; d.model = '';
            Object.keys(ANDROID).forEach(function (k) { if (!d.model && code.indexOf(k) === 0) d.model = ANDROID[k]; });
            if (hints && hints.platformVersion && !d.osVer) d.osVer = hints.platformVersion.split('.')[0];
        } else if (/Windows|Macintosh|Linux|CrOS/.test(ua)) { d.os = 'pc'; d.model = /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : 'Linux'; }
        return d;
    }
    function readHere() {
        var hi = navigator.userAgentData && navigator.userAgentData.getHighEntropyValues ? navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']).catch(function () { return null; }) : Promise.resolve(null);
        return hi.then(function (h) { return read(navigator.userAgent, { w: screen.width, h: screen.height }, h); });
    }
    function call(data) {
        return Promise.resolve(window.ensureAuthLink && ensureAuthLink()).then(function () { return firebase.functions().httpsCallable('claimTester')(data); }).then(function (r) { return r.data || {}; });
    }
    function err(e) {
        var c = (e && e.details && e.details.code) || (e && e.code) || '';
        return { 'no-code': 'Code not found', paused: 'This code is paused', expired: 'This code has ended', full: 'This code is full', 'has-account': 'You already have an account',
            'permission-denied': 'Open the app from LINE first', 'functions/permission-denied': 'Open the app from LINE first' }[c] || 'Could not join — try again';
    }

    var ICON = { android: '🤖', ios: '🍎', pc: '💻', other: '📱' }, NAME = { android: 'Android', ios: 'iOS', pc: 'PC', other: 'Other' };
    var CSS = '#tjModal{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
        + '#tjModal .tj{background:#fff;border-radius:16px;padding:10px;width:100%;max-width:300px;display:flex;flex-direction:column;gap:6px;color:#0f172a;font-size:13px;font-family:inherit}'
        + '#tjModal .tj-r{display:flex;gap:6px;align-items:center}#tjModal .tj-m{color:#64748b;font-size:11px;font-weight:700}#tjModal b{font-weight:900}'
        + '#tjModal button{font-family:inherit;margin:0;min-height:0;box-shadow:none;cursor:pointer;width:auto}'
        + '#tjModal .tj-go{border:0;border-radius:10px;padding:10px;font-weight:900;font-size:14px;background:#7c3aed;color:#fff}#tjModal .tj-go:disabled{opacity:.5}'
        + '#tjModal .tj-os{display:flex;gap:6px;justify-content:center;align-items:center}#tjModal .tj-os button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:3px 10px;font-size:14px}'
        + '#tjModal .tj-kv{display:flex;gap:6px;font-weight:800;font-size:12px}#tjModal .tj-kv span:first-child{width:18px}#tjModal .tj-err{color:#b91c1c;font-weight:800;font-size:12px;text-align:center}'
        + '#tjModal .tj-x{margin-left:auto;background:none;border:0;color:#94a3b8;font-size:16px;padding:0 2px}';
    function root() {
        var m = document.getElementById('tjModal');
        if (!m) {
            if (!document.getElementById('tj-css')) { var s = document.createElement('style'); s.id = 'tj-css'; s.textContent = CSS; document.head.appendChild(s); }
            m = document.createElement('div'); m.id = 'tjModal'; m.className = 'lang-no-toggle'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Tester');
            document.body.appendChild(m);
        }
        return m;
    }
    function html() {
        var h = '<div class="tj"><div class="tj-r"><b id="tj-label">🧪 ' + esc(st.label || st.code) + '</b>' + (st.until ? '<span class="tj-m">→' + day(st.until) + '</span>' : '')
            + '<button type="button" class="tj-x" onclick="TesterJoin.close()" aria-label="Close">✕</button></div>';
        if (st.ended) return h + '<div class="tj-err" id="tj-ended">🧪 Test ended · thanks!</div></div>';
        if (!st.dev) {
            h += '<button type="button" class="tj-go" id="tj-allow" onclick="TesterJoin.allow()"' + (st.busy || !st.label ? ' disabled' : '') + '>✓ Allow device info</button>'
                + '<div class="tj-os"><span class="tj-m">Skip →</span>' + ['android', 'ios', 'pc'].map(function (o) { return '<button type="button" id="tj-os-' + o + '" onclick="TesterJoin.pick(\'' + o + '\')" aria-label="' + NAME[o] + '"' + (st.label ? '' : ' disabled') + '>' + ICON[o] + '</button>'; }).join('') + '</div>';
        } else {
            var d = st.dev;
            h += '<div class="tj-kv" id="tj-os"><span>' + ICON[d.os] + '</span><span>' + NAME[d.os] + (d.osVer ? ' ' + esc(d.osVer) : '') + '</span></div>'
                + (d.model || d.modelCode ? '<div class="tj-kv" id="tj-model"><span>📱</span><span>' + esc(d.model || d.modelCode) + '</span>' + (d.model && d.modelCode ? '<span class="tj-m">' + esc(d.modelCode) + '</span>' : '') + '</div>' : '')
                + (d.read ? '<div class="tj-kv"><span>💬</span><span>' + (d.line ? 'LINE ' + esc(d.line) : '—') + '</span><span class="tj-m">' + esc(d.screen) + '</span></div>' : '')
                + '<button type="button" class="tj-go" id="tj-start" onclick="TesterJoin.start()"' + (st.busy ? ' disabled' : '') + '>▸ Start</button>';
        }
        return h + (st.msg ? '<div class="tj-err" id="tj-err">' + esc(st.msg) + '</div>' : '') + '</div>';
    }
    function render() { var m = root(); m.innerHTML = html(); m.style.display = 'flex'; }

    window.TesterJoin = {
        isCode: function (c) { return /^TEST-\d{4}$/.test(String(c || '').trim().toUpperCase()); },
        open: function (code) {
            st = { code: String(code).trim().toUpperCase(), label: '', until: 0, dev: null, msg: '', busy: true };
            var en = document.getElementById('enrollModal'); if (en) en.style.display = 'none';
            render();
            call({ code: st.code, peek: true }).then(function (r) { st.busy = false; st.label = r.label || 'Tester'; st.until = r.untilMs; render(); },
                function (e) { st.busy = false; st.msg = err(e); render(); });
        },
        allow: function () { st.busy = true; render(); return readHere().then(function (d) { st.busy = false; st.dev = d; render(); }); },
        pick: function (os) { st.dev = { os: os, osVer: '', model: '', modelCode: '', line: '', screen: '', read: false }; render(); },
        start: function () {
            if (st.busy || !st.dev) return; st.busy = true; st.msg = ''; render();
            return call({ code: st.code, device: st.dev }).then(function () { st.joined = true; TesterJoin.close(); if (typeof showToast === 'function') showToast('🧪 Welcome, tester'); },
                function (e) { st.busy = false; st.msg = err(e); render(); });
        },
        close: function () {
            var m = document.getElementById('tjModal'); if (m) m.style.display = 'none';
            if (!st.ended && !st.joined && typeof showEnrollmentModal === 'function') showEnrollmentModal(false, true);   // back to Register
        },
        /** called with the user doc: a tester whose code has ended is stopped here */
        check: function (u) {
            if (!u || !u.isTester || !(u.testerUntil < Date.now())) return false;
            st = { code: u.testerCode || '', label: 'Tester', until: u.testerUntil, dev: null, msg: '', busy: false, ended: true }; render();
            var x = document.querySelector('#tjModal .tj-x'); if (x) x.remove();
            return true;
        },
        _read: read
    };
})();
