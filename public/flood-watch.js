/* V101.27 Flood watch — nearby flood risk for the training site, the intern's
 * home and "near me".
 *
 * Data: BKK FloodWatch 2026 (canals) + Floodboard (roads, CC BY 4.0, V101.30) via floodPointCheck.
 * FloodWatch: (https://flood.autobahn.bot, github.com/bejranonda/flood2026,
 * MIT) through the floodPointCheck callable (the API sends no CORS headers).
 * The hourly checkFloodAlerts function pushes LINE when the home rises to
 * High; this file is the in-app view and the opt-in.
 *
 * UI (no new rows): the 🌊 circle in the profile rail (#fw-btn, colour = site,
 * dot = home), water behind #section-profile-combined (V101.32: sloping from the
 * home level on the left to the site level on the right), and a popup anchored under
 * the button on tap (V101.28).
 *
 * Writes only users/{userId}.floodWatch = { optIn, home: { lat, lon }, updatedAt }
 * (coordinates rounded to 3 dp, ~100 m). Uses the page globals db / userId.
 */
(function () {
    // Keep in sync with FLOOD_SITE in functions/index.js.
    var SITE = { lat: 13.8099, lon: 100.6223 };
    var STALE_MS = 10 * 60 * 1000;
    var RANK = { low: 1, moderate: 2, high: 3 };

    var places = { site: {}, home: {}, near: {} };   // { data, at, err, loading, lat, lon }
    var fw = {};                                      // users/{id}.floodWatch
    var tab = 'site';
    var sheet = null, scrim = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function riskOf(p) { return p && p.data && RANK[p.data.risk] ? p.data.risk : null; }
    function homeSet() { return !!(fw && fw.home && isFinite(fw.home.lat) && isFinite(fw.home.lon)); }

    // V101.33: weather + air quality from Open-Meteo (free, keyless, CORS *; CC BY 4.0).
    // Called straight from the page — coordinates rounded to 2 dp (~1 km): weather needs
    // no more, and the home pin never leaves the device at full precision.
    var WX_TTL = 15 * 60 * 1000;
    function loadWeather(key, lat, lon) {
        var p = places[key];
        if (p.wx && p.wxAt && Date.now() - p.wxAt < WX_TTL && p.wxLat === lat && p.wxLon === lon) return;
        var ll = 'latitude=' + lat.toFixed(2) + '&longitude=' + lon.toFixed(2) + '&timezone=Asia%2FBangkok';
        var get = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
        Promise.all([
            get('https://api.open-meteo.com/v1/forecast?' + ll + '&current=temperature_2m,apparent_temperature,weather_code,is_day,precipitation&hourly=precipitation_probability&forecast_hours=7'),
            get('https://air-quality-api.open-meteo.com/v1/air-quality?' + ll + '&current=pm2_5,us_aqi')
        ]).then(function (res) {
            var w = res[0], q = res[1];
            if (!w || !w.current) return;
            var c = w.current, h = w.hourly || {}, peak = { pop: 0, at: '' };
            (h.precipitation_probability || []).forEach(function (v, i) {
                if (v > peak.pop) peak = { pop: v, at: String((h.time || [])[i] || '').slice(11, 16) };
            });
            p.wx = {
                code: c.weather_code, day: c.is_day === 1, temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
                rainMm: c.precipitation || 0, pop: peak.pop, popAt: peak.at,
                aqi: q && q.current && q.current.us_aqi != null ? Math.round(q.current.us_aqi) : null,
                pm25: q && q.current ? q.current.pm2_5 : null
            };
            p.wxAt = Date.now(); p.wxLat = lat; p.wxLon = lon;
            paint(); render();
        });
    }
    // WMO weather code → sky + icon.
    function wxKind(wx) {
        var c = wx.code;
        if (c >= 95) return 'storm';
        if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
        if (c === 45 || c === 48) return 'fog';
        if (c >= 2) return 'cloud';
        return 'clear';
    }
    function wxIcon(wx) {
        return { storm: '⛈️', rain: '🌧️', fog: '🌫️', cloud: wx.code === 2 ? (wx.day ? '⛅' : '☁️') : '☁️', clear: wx.day ? '☀️' : '🌙' }[wxKind(wx)];
    }
    function aqiClass(v) { return v <= 50 ? 'good' : v <= 100 ? 'mod' : v <= 150 ? 'usg' : 'bad'; }

    // A · the sky above the card water: mood only, no text. Site weather.
    function skyHtml(wx) {
        if (!wx) return '';
        var k = wxKind(wx), out = '<div class="fw-sky' + (wx.day ? '' : ' night') + (k === 'rain' || k === 'storm' ? ' wet' : '') + '" aria-hidden="true">';
        if (k === 'clear' && wx.day) out += '<div class="fw-sun"></div>';
        if (k === 'clear' && !wx.day) out += '<div class="fw-moon"></div>';
        if (k !== 'clear') out += '<div class="fw-cloud c1"></div><div class="fw-cloud c2"></div><div class="fw-cloud c3"></div>';
        if (k === 'rain' || k === 'storm') {
            var n = k === 'storm' || wx.rainMm >= 5 ? 34 : 18;
            for (var i = 0; i < n; i++) {
                out += '<i class="fw-drop" style="left:' + ((i * 2.97 + (i % 3) * 1.1) % 100).toFixed(1) + '%;animation-delay:-' + ((i * 0.137) % 1.1).toFixed(2) +
                    's;animation-duration:' + (0.9 + (i % 4) * 0.12).toFixed(2) + 's"></i>';
            }
        }
        return out + '</div>';
    }
    // C + D · one row in the popup: now, rain chance in the next 6 h, air quality.
    function wxRow(wx) {
        if (!wx) return '';
        return '<div class="fw-wx" title="Weather · Open-Meteo">' +
            '<span title="Now · feels like ' + wx.feels + '°">' + wxIcon(wx) + ' <b>' + wx.temp + '°</b><small>/' + wx.feels + '°</small></span>' +
            '<span title="Chance of rain, next 6 h (peak)"><i class="fa-solid fa-umbrella" style="color:#3b82f6"></i><b>' + wx.pop + '%</b>' + (wx.pop >= 30 && wx.popAt ? ' ' + wx.popAt : '') + '</span>' +
            (wx.aqi != null ? '<span title="PM2.5 ' + (wx.pm25 != null ? wx.pm25 : '?') + ' µg/m³ · US AQI ' + wx.aqi + '">😷 <span class="fw-aqi ' + aqiClass(wx.aqi) + '">' + wx.aqi + '</span></span>' : '') +
            '</div>';
    }

    function load(key, lat, lon) {
        var p = places[key];
        p.lat = lat; p.lon = lon; p.loading = true; p.err = null;
        render();
        loadWeather(key, lat, lon);
        return firebase.functions().httpsCallable('floodPointCheck')({ lat: lat, lon: lon })
            .then(function (r) { p.data = r.data; p.at = Date.now(); })
            .catch(function (e) { p.err = (e && e.message) || 'unavailable'; console.warn('[flood] ' + key, e); })
            .then(function () { p.loading = false; paint(); render(); });
    }

    // Rail button + card water.
    function paint() {
        var btn = document.getElementById('fw-btn');
        var site = riskOf(places.site);
        var home = homeSet() ? riskOf(places.home) : null;
        if (btn) {
            btn.className = 'btn-sm fw-tb' + (site ? ' fw-r-' + site : '') + (home ? ' fw-h-' + home : '');
            btn.setAttribute('aria-label', 'Flood watch: site ' + (site || '—') + (home ? ', home ' + home : ''));
        }
        var water = document.getElementById('fw-water');
        if (water) water.innerHTML = skyHtml(places.site.wx) + slopeWater(home, site);
    }

    // V101.32: the card water shows BOTH places — one surface sloping from home (left)
    // to the training site (right), each side at its own height and colour family
    // (home blue, site teal, red when High). Without a home it is flat at the site.
    var LEVEL = { low: 16, moderate: 34, high: 55 };   // % of the card height
    var HOME_C = { low: ['#dbeafe', '#93c5fd'], moderate: ['#bfdbfe', '#60a5fa'], high: ['#fee2e2', '#f87171'] };
    var SITE_C = { low: ['#dcfaf3', '#99f6e4'], moderate: ['#b8f3e6', '#5eead4'], high: ['#fee2e2', '#f87171'] };
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Wavy top edge in a 1000×100 box, y = % from the bottom, smoothstep slope yL → yR.
    function surface(yL, yR, phase) {
        var d = 'M0,100';
        for (var x = 0; x <= 1000; x += 10) {
            var t = x / 1000, y = yL + (yR - yL) * (t * t * (3 - 2 * t));
            d += ' L' + x + ',' + (100 - y + 1.6 * Math.sin((x + phase) / 38)).toFixed(2);
        }
        return d + ' L1000,100 Z';
    }
    // One layer; the wave drifts by morphing between two phases (SMIL works in LINE's WebView).
    function layer(yL, yR, phase, fill, extra) {
        var a = surface(yL, yR, phase), b = surface(yL, yR, phase + 119);
        return '<path d="' + a + '" fill="' + fill + '"' + (extra || '') + '>' +
            (still ? '' : '<animate attributeName="d" dur="7s" repeatCount="indefinite" values="' + a + ';' + b + ';' + a + '"/>') + '</path>';
    }
    function slopeWater(home, site) {
        if (!home && !site) return '';
        var L = home || site, R = site || home;
        var lc = (home ? HOME_C : SITE_C)[L], rc = (site ? SITE_C : HOME_C)[R];
        var grad = function (id, i) {
            return '<linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="' + lc[i] + '"/><stop offset=".35" stop-color="' + lc[i] +
                '"/><stop offset=".65" stop-color="' + rc[i] + '"/><stop offset="1" stop-color="' + rc[i] + '"/></linearGradient>';
        };
        var fill = '<div class="fw-fill" style="background:linear-gradient(to right,' + lc[0] + ' 35%,' + rc[0] + ' 65%)"></div>';
        var svg = fill + '<svg class="fw-slope" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><defs>' + grad('fwgFront', 0) + grad('fwgBack', 1) + '</defs>' +
            layer(LEVEL[L] + 1.5, LEVEL[R] + 1.5, 20, 'url(#fwgBack)', ' opacity=".55"') + layer(LEVEL[L], LEVEL[R], 0, 'url(#fwgFront)') + '</svg>';
        // Which side is which: only needed once there are two places.
        // V101.33: larger glass markers with a ring in the side's risk colour.
        var RING = { low: null, moderate: '#f97316', high: '#dc2626' };
        var marker = function (side, emoji, level, risk, def, title) {
            return '<span class="fw-side" style="' + side + ':-13px;top:calc(var(--fw-base, 100%) * ' + (1 - level / 100) + ' - 13px);border-color:' + (RING[risk] || def) +
                '" title="' + title + ': ' + risk + '">' + emoji + '</span>';
        };
        var icons = home && site
            ? marker('left', '🏠', LEVEL[L], L, '#60a5fa', 'Home') + marker('right', '🏥', LEVEL[R], R, '#2dd4bf', 'Training site')
            : '';
        return svg + icons;
    }

    function stats(d) {
        var out = [];
        var c = d.canal;
        var r = RANK[d.risk] ? d.risk : 'low';
        var col = { low: '#0284c7', moderate: '#ea580c', high: '#dc2626' }[r];
        if (c && c.freeboardM != null) {
            var cm = Math.round(Math.abs(c.freeboardM) * 100);
            out.push('<span title="Canal vs bank" style="color:' + col + '"><i class="fa-solid fa-water"></i><b>' +
                (c.freeboardM >= 0 ? '−' : '+') + cm + ' cm</b></span>');
        }
        if (c && c.change24cm != null) {
            var up = c.change24cm > 0;
            out.push('<span title="Last 24 h"><i class="fa-solid fa-arrow-' + (up ? 'up' : 'down') +
                '" style="color:' + (up ? '#dc2626' : '#16a34a') + '"></i>' + Math.abs(c.change24cm) + ' cm</span>');
        }
        // V101.30: nearest flooded road within 500 m (Floodboard), coloured by the
        // motorbike verdict; name, distance and verdicts are in the title.
        var r = d.road && d.road.nearest;
        if (r) {
            var rc = r.closed || r.motorbike === 'blocked' ? '#dc2626' : r.motorbike === 'risky' ? '#ea580c' : '#ca8a04';
            out.push('<span title="Flooded road: ' + esc(r.name || '—') + ' · ' + r.m + ' m · motorbike ' + esc(r.motorbike || '?') +
                ', sedan ' + esc(r.sedan || '?') + (r.sensor ? ' · BMA sensor' : '') + '" style="color:' + rc + '"><i class="fa-solid fa-road"></i><b>' +
                (r.closed ? 'closed' : r.depthCm != null ? r.depthCm + ' cm' : 'wet') + '</b> ' + r.m + ' m</span>');
        } else if (d.road) {
            out.push('<span title="No flooded road within 500 m" style="color:#16a34a"><i class="fa-solid fa-road"></i>0</span>');
        }
        if (d.rain24mm != null) {
            out.push('<span title="Rain next 24 h"><i class="fa-solid fa-cloud-rain" style="color:#64748b"></i>' + d.rain24mm + ' mm</span>');
        }
        if (d.traffy6h) {
            out.push('<span title="Traffy flood reports ≤ 1 km, 6 h"><i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i>' + d.traffy6h + '</span>');
        }
        return out.join('');
    }

    function render() {
        if (!sheet) return;
        var p = places[tab];
        var d = p.data;
        var risk = riskOf(p);
        var home = homeSet();
        var top =
            '<button class="fw-ic' + (tab === 'site' ? ' on' : '') + '" onclick="fwTab(\'site\')" title="Training site" aria-label="Training site">🏥</button>' +
            '<button class="fw-ic' + (tab === 'home' ? ' on' : '') + '" onclick="fwTab(\'home\')" title="' + (home ? 'Home' : 'Set home') + '" aria-label="Home">🏠' + (home ? '' : '<span class="fw-plus">+</span>') + '</button>' +
            '<button class="fw-ic' + (tab === 'near' ? ' on' : '') + '" onclick="fwTab(\'near\')" title="Near me" aria-label="Near me">📍</button>' +
            '<span class="fw-sp"></span>' +
            (tab === 'home' && home
                ? '<button class="fw-ic' + (fw.optIn ? ' bell-on' : '') + '" onclick="fwBell()" title="LINE alert when High (max 1/day)" aria-label="LINE alert when High" aria-pressed="' + !!fw.optIn + '"><i class="fa-solid fa-bell"></i></button>' +
                  '<button class="fw-ic" onclick="fwRemoveHome()" title="Remove home" aria-label="Remove home"><i class="fa-solid fa-xmark" style="color:#94a3b8"></i></button>'
                : '') +
            (p.lat != null ? '<button class="fw-ic" onclick="fwMap()" title="Map" aria-label="Map"><i class="fa-solid fa-map-location-dot" style="color:#0369a1"></i></button>' : '');

        var body;
        if (p.loading) body = '<div class="fw-h"><span class="fw-dot"></span>…</div>';
        else if (p.err) body = '<div class="fw-h"><span class="fw-dot"></span>—</div><div class="fw-meta">' + esc(p.err) + '</div>';
        else if (!d) body = '<div class="fw-h"><span class="fw-dot"></span>—</div>';
        else {
            var t = p.at ? new Date(p.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '';
            var meta = [d.canal ? esc(d.canal.name) + (d.canal.km != null ? ' · ' + d.canal.km + ' km' : '') : '', t,
                'BKK FloodWatch' + (d.road ? ' · Floodboard (CC BY 4.0)' : '') + (p.wx ? ' · Open-Meteo (CC BY 4.0)' : '')]
                .filter(Boolean).join(' · ');
            body = '<div class="fw-h"><span class="fw-dot' + (risk ? ' fw-' + risk : '') + '"></span>' + esc(d.title || '—') + '</div>' +
                '<div class="fw-stats">' + stats(d) + '</div>' + wxRow(p.wx) + '<div class="fw-meta">' + meta + '</div>';
        }
        // Flood data can fail on its own (FloodWatch is flaky); the weather row still shows.
        if (!d && p.wx && !p.loading) body += wxRow(p.wx);
        sheet.innerHTML = '<div class="fw-water' + (risk ? ' fw-' + risk : '') + '" aria-hidden="true"></div>' +
            '<div class="fw-top">' + top + '</div>' + body;
    }

    // Anchor the popup under the rail button, kept inside the viewport.
    function place() {
        var btn = document.getElementById('fw-btn');
        if (!sheet || !btn) return;
        var r = btn.getBoundingClientRect();
        var w = sheet.offsetWidth, vw = document.documentElement.clientWidth;
        var left = Math.min(Math.max(12, r.right - w), vw - w - 12);
        sheet.style.top = (r.bottom + window.scrollY + 10) + 'px';
        sheet.style.left = (left + window.scrollX) + 'px';
        sheet.style.setProperty('--ax', Math.round(r.left + r.width / 2 - left) + 'px');
    }

    function getPosition() {
        return new Promise(function (resolve, reject) {
            if (!navigator.geolocation) return reject(new Error('Location not available'));
            navigator.geolocation.getCurrentPosition(
                function (pos) { resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
                function (e) { reject(new Error(e && e.message || 'Location denied')); },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 });
        });
    }
    function round3(x) { return Math.round(x * 1000) / 1000; }

    function close() {
        if (sheet) sheet.remove();
        if (scrim) scrim.remove();
        sheet = scrim = null;
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', place);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    // V101.36: the surface keeps its collapsed-card height. Levels are % of --fw-base (the card
    // without the opened activity details); the .fw-fill below carries the same water down.
    function fit() {
        var card = document.getElementById('section-profile-combined');
        if (!card) return;
        var det = document.getElementById('activity-details');
        var open = det && !det.hidden && det.offsetHeight > 0;
        var wt = document.getElementById('fw-water');
        if (wt) wt.classList.toggle('fw-open', !!open);
        card.style.setProperty('--fw-base', (card.offsetHeight - (open ? det.offsetHeight + 8 : 0)) + 'px');
    }

    window.fwInit = function () {
        var card = document.getElementById('section-profile-combined');
        if (card && !document.getElementById('fw-water')) {
            card.classList.add('fw-bg');
            var w = document.createElement('div');
            w.id = 'fw-water';
            w.className = 'fw-card-water';
            w.setAttribute('aria-hidden', 'true');
            card.insertBefore(w, card.firstChild);
        }
        if (card && window.ResizeObserver) new ResizeObserver(fit).observe(card);
        window.addEventListener('resize', fit);
        fit();
        load('site', SITE.lat, SITE.lon);
    };

    // Called from the users/{userId} listener on every snapshot.
    window.fwOnUserDoc = function (next) {
        var prev = fw;
        fw = next || {};
        var h = fw.home, ph = prev && prev.home;
        if (homeSet()) {
            if (!ph || ph.lat !== h.lat || ph.lon !== h.lon) load('home', h.lat, h.lon);
        } else {
            places.home = {};
        }
        paint();
        render();
    };

    window.fwOpen = function () {
        if (sheet) return close();   // the rail button toggles
        scrim = document.createElement('div');
        scrim.className = 'fw-scrim';
        scrim.onclick = close;
        sheet = document.createElement('div');
        sheet.className = 'fw-sheet lang-no-toggle';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-label', 'Flood watch');
        document.body.appendChild(scrim);
        document.body.appendChild(sheet);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', place);
        tab = homeSet() && riskOf(places.home) === 'high' ? 'home' : 'site';
        render();
        place();
        var p = places[tab];
        if (p.lat != null && !p.loading && (!p.at || Date.now() - p.at > STALE_MS)) load(tab, p.lat, p.lon);
    };

    window.fwTab = function (next) {
        if (next === 'home' && !homeSet()) return fwSetHome();
        tab = next;
        if (next === 'near') {
            places.near = { loading: true };
            render();
            getPosition()
                .then(function (pos) { return load('near', pos.lat, pos.lon); })
                .catch(function (e) { places.near = { err: e.message }; render(); });
            return;
        }
        var p = places[next];
        if (p.lat != null && !p.loading && (!p.at || Date.now() - p.at > STALE_MS)) load(next, p.lat, p.lon);
        render();
    };

    window.fwSetHome = function () {
        if (!userId || !db) return;
        if (!confirm('Pin where you are now as home?\nRounded to ~100 m. You get a LINE message if flood risk there turns High (max 1/day).')) return;
        tab = 'home';
        places.home = { loading: true };
        render();
        getPosition()
            .then(function (pos) {
                return db.collection('users').doc(userId).set({
                    floodWatch: {
                        optIn: true,
                        home: { lat: round3(pos.lat), lon: round3(pos.lon) },
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                }, { merge: true });
            })
            .catch(function (e) { places.home = { err: e.message }; render(); });
        // The users listener calls fwOnUserDoc, which loads the home check.
    };

    window.fwBell = function () {
        if (!userId || !db || !homeSet()) return;
        db.collection('users').doc(userId).update({ 'floodWatch.optIn': !fw.optIn })
            .catch(function (e) { console.warn('[flood] optIn write failed', e); });
    };

    window.fwRemoveHome = function () {
        if (!userId || !db) return;
        if (!confirm('Remove your home location and stop flood alerts?')) return;
        tab = 'site';
        db.collection('users').doc(userId).update({ floodWatch: firebase.firestore.FieldValue.delete() })
            .catch(function (e) { console.warn('[flood] remove failed', e); });
    };

    window.fwMap = function () {
        var p = places[tab];
        if (p.lat == null) return;
        var url = 'https://flood.autobahn.bot/#p=' + p.lat.toFixed(4) + ',' + p.lon.toFixed(4);
        if (window.liff && liff.isInClient && liff.isInClient()) liff.openWindow({ url: url, external: true });
        else window.open(url, '_blank', 'noopener');
    };
})();
