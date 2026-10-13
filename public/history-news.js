// V101.134 · History's right rail, news card: the latest headlines of the Mahidol Pharmacy Drug Information Center "ข่าวยา" list, each a link back to
// the DIC page (new tab). Headlines only — no words around them. The getDrugNews callable fetches the list (the site has no CORS), the list is
// kept in localStorage for 3 hours, × closes the card for today (the same list stays closed, a new headline brings it back). Nothing is drawn when
// the callable is missing or fails. The rail itself (position, wide screens only) is in flood-watch.css; the flood card shares it (#hfr-flood).
(function () {
    'use strict';
    var KEY = 'hnNews', OFF = 'hnOff', TTL = 3 * 3600e3, SHOW = 5;
    var items = [];

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function day() {
        try { return typeof getBangkokDateTimeParts === 'function' ? getBangkokDateTimeParts().dateKey : new Date().toISOString().slice(0, 10); } catch (e) { return ''; }
    }
    function sig() { return day() + '|' + (items[0] ? items[0].id : ''); }
    function valid(list) {
        return (Array.isArray(list) ? list : []).filter(function (x) {
            return x && /^\d{1,7}$/.test(String(x.id)) && typeof x.title === 'string' && x.title.trim() &&
                typeof x.url === 'string' && x.url.indexOf('https://pharmacy.mahidol.ac.th/dic/news_week_full.php?id=') === 0;
        }).slice(0, SHOW);
    }

    function paint() {
        var host = document.getElementById('hfr-news');
        if (!host) return;
        var closed = false;
        try { closed = items.length && localStorage.getItem(OFF) === sig(); } catch (e) { /* storage blocked: it just shows */ }
        if (!items.length || closed) { host.innerHTML = ''; return; }
        host.innerHTML = '<div class="hfr-card news"><button type="button" class="hfr-x" onclick="hnClose()" aria-label="Close">×</button><ul class="hfr-nl">' +
            items.map(function (x) {
                return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc((x.week ? x.week + ' · ' : '') + 'Drug Information Center, Mahidol Pharmacy') + '">' + esc(x.title) + '</a></li>';
            }).join('') + '</ul></div>';
    }
    window.hnClose = function () {
        try { localStorage.setItem(OFF, sig()); } catch (e) { /* ignore */ }
        paint();
    };

    window.hnInit = function () {
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { cached = null; }
        if (cached && Date.now() - cached.at < TTL && valid(cached.items).length) { items = valid(cached.items); paint(); return; }
        if (!(window.firebase && firebase.functions)) return;
        firebase.functions().httpsCallable('getDrugNews')({}).then(function (r) {
            items = valid(r && r.data && r.data.items);
            if (items.length) { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items: items })); } catch (e) { /* ignore */ } }
            paint();
        }).catch(function (e) { console.warn('[news] getDrugNews', e && e.message); });
    };
})();
