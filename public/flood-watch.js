/* V101.27 Flood watch — nearby flood risk for the training site, the intern's
 * home and "near me". V101.65: lean popup (status · คลอง/ถนน lines · ฝน 7 วัน · เขต 2554/2569 · details).
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
            get('https://api.open-meteo.com/v1/forecast?' + ll + '&current=temperature_2m,apparent_temperature,weather_code,is_day,precipitation&hourly=precipitation_probability&forecast_hours=7&daily=precipitation_sum,precipitation_probability_max&past_days=3&forecast_days=4'),
            get('https://air-quality-api.open-meteo.com/v1/air-quality?' + ll + '&current=pm2_5,us_aqi')
        ]).then(function (res) {
            var w = res[0], q = res[1];
            if (!w || !w.current) return;
            var c = w.current, h = w.hourly || {}, peak = { pop: 0, at: '' };
            (h.precipitation_probability || []).forEach(function (v, i) {
                if (v > peak.pop) peak = { pop: v, at: String((h.time || [])[i] || '').slice(11, 16) };
            });
            // V101.65: 7 days of rain — 3 back (measured), today, 3 ahead (with the day's max chance).
            var dl = w.daily || {}, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }), days = [];
            (dl.time || []).forEach(function (dstr, i) {
                days.push({ d: dstr, mm: (dl.precipitation_sum || [])[i], pop: (dl.precipitation_probability_max || [])[i], past: dstr < today, today: dstr === today });
            });
            p.wx = {
                days: days,
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

    // The sky above the card water: mood only, no text. Site weather. (V101.65: the popup's weather is one line under รายละเอียด.)
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
        if (water) water.innerHTML = skyHtml(places.site.wx) + slopeWater(home, site) + riverWater(places.site.data && places.site.data.river, home, site);
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

    // V101.56: river flow at C.2 → C.13 → C.29B on the card water — a compact capsule per gauge on the surface
    // (dot = tier, ▲▼ = change vs ~24 h) and a soft tint of the same surface, amber / red, where the flow is high.
    // Tiers (m³/s, same for all three): green < 1,500 · amber 1,500–2,200 · red > 2,200. No tint when all are green.
    var RV_LIMIT = 2200;   // m³/s — the owner's line for "say so on the front" (2,500 on 2026-10-08, 2,200 the next morning)
    var RV_X = [0.2, 0.5, 0.8], RV_COL = { ok: '#22c55e', warn: '#f59e0b', red: '#ef4444' }, RV_TINT = { ok: ['#22c55e', 0], warn: ['#fbbf24', .16], red: ['#f87171', .22] };
    function rvTier(q) { return q > RV_LIMIT ? 'red' : q >= 1500 ? 'warn' : 'ok'; }   // V101.65: red = over the line the popup alerts on (V101.69: 2,200)
    function riverWater(rv, home, site) {
        if (!rv || !rv.stations || (!home && !site)) return '';
        var L = home || site, R = site || home;
        var st = rv.stations.map(function (r) { return r && r.q != null && r.at && Date.now() - r.at < 36 * 3600e3 ? r : null; });
        if (!st.some(Boolean)) return '';
        var smooth = function (t) { return t * t * (3 - 2 * t); };
        var stops = st.map(function (r, i) {
            var t = RV_TINT[r ? rvTier(r.q) : 'ok'];
            return '<stop offset="' + RV_X[i] + '" stop-color="' + t[0] + '" stop-opacity="' + t[1] + '"/>';
        }).join('');
        var out = '';
        if (st.some(function (r) { return r && rvTier(r.q) !== 'ok'; })) {
            out += '<svg class="fw-slope" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="fwgRiver" x1="0" x2="1">' + stops + '</linearGradient></defs>' +
                layer(LEVEL[L], LEVEL[R], 0, 'url(#fwgRiver)') + '</svg>';
        }
        return out;
    }

    // V101.63: river flow as ONE strip (was under the pts row on the card; V101.71: moved into the popup, under คลอง/ถนน) instead of capsules floating on the card water — those were
    // positioned once from a snapshot of the layout, so they landed on the buttons / the date nudge whenever a row shifted. The water keeps its tint.
    function riverStrip(rv, dup) {
        var none = { html: '', label: '' };
        if (!rv || !rv.stations) return none;
        var parts = [], labels = [], worst = 'ok';
        rv.stations.forEach(function (r) {
            if (!r || r.q == null || !r.at || Date.now() - r.at >= 36 * 3600e3) return;
            var ar = r.d24 == null || Math.abs(r.d24) < 30 ? '' : '<i class="fw-ar ' + (r.d24 > 0 ? 'up' : 'down') + '">' + (r.d24 > 0 ? '▲' : '▼') + '</i>';
            var k = (r.q / 1000).toFixed(1) + 'k', over = r.q > RV_LIMIT;
            // V101.76: the gauge the card above already names (the one over the line) shows its share of capacity here instead of repeating the same flow number.
            var pct = r.pct != null ? r.pct : r.cap ? Math.round(r.q / r.cap * 100) : null, share = !!dup && r.code === dup && pct != null;
            if (r.q > 2500) worst = 'crit'; else if (over && worst === 'ok') worst = 'warn';
            // V101.72: over the line = a ⚠️ in place of the tier dot (the dot colour stays for the other tiers).
            parts.push('<span class="fw-rs' + (over ? ' over' : '') + '" data-tip="' + esc(r.code + ' ' + (RV_PLACE[r.code] || r.place || '') + ' · ' + Math.round(r.q).toLocaleString('en-US') + ' m³/s' + (over ? ' · สูงกว่าเกณฑ์ ' + fmtQ(RV_LIMIT) : '') + (share ? ' · ' + pct + '% ของความจุ' + (r.cap ? ' ' + fmtQ(r.cap) : '') : '')) + '" title="' + esc(r.code) + ' · ' + Math.round(r.q).toLocaleString('en-US') + ' m³/s"><small class="fw-rl">' + esc(r.code) + '</small><span class="fw-rv">' +
                (over ? '<span class="fw-rw">⚠️</span>' : '<i class="fw-rd" style="background:' + RV_COL[rvTier(r.q)] + '"></i>') + (share ? pct + '%<small class="fw-rp">ของความจุ</small>' : k) + ar + '</span></span>');
            labels.push(r.code + ' ' + (share ? pct + '% ของความจุ' : k));
        });
        if (!parts.length) return none;
        return { html: emo('🌊', worst) + parts.join(''), label: 'River flow ' + labels.join(', ') + ' — open flood watch' };
    }

    // V101.65 · the popup body, rebuilt around what a person actually asks — ตอนนี้ปลอดภัยไหม · ถนนแถวบ้านท่วมไหม ·
    // ฝนจะมาไหม — plus the district's 2554 / 2569 record. Every number appears once; the gauges, river, weather and
    // sources fold under "รายละเอียด". Replaces stats / trendHtml / rainHtml / nearHtml / riverHtml / wxRow / srcDots.
    var LV = { ok: 'ok', warn: 'warn', crit: 'crit' };
    var RISK_TH = { low: 'ปกติ', moderate: 'เฝ้าระวัง', high: 'เสี่ยงสูง', info: 'ไม่มีข้อมูล' };
    var RV_PLACE = { 'C.2': 'นครสวรรค์', 'C.13': 'ชัยนาท', 'C.29B': 'อยุธยา' };
    // V101.69: colour = data source (the owner's pick "B": a 3 px bar on each row's left edge, two colours when two
    // sources agree, a dot legend instead of the source paragraph). Kept away from the state colours green/orange/red.
    // The POPNIX / Floodboard / Open-Meteo labels are their required attributions.
    var SRC = {
        fw: ['#0284c7', 'BKK FloodWatch'], pop: ['#0d9488', 'ข้อมูล: สำนักการระบายน้ำ กรุงเทพมหานคร ผ่าน POPNIX Flood'], fb: ['#d97706', 'Floodboard (CC BY 4.0)'],
        rid: ['#4f46e5', 'ThaiWater · กรมชลประทาน'], om: ['#a21caf', 'Open-Meteo (CC BY 4.0)'], hist: ['#e11d48', '2569 ประกาศ กทม. 29 ก.ย. · 2554 รายงานข่าว (Rocket Media Lab)'], osm: ['#64748b', 'เขตจาก OpenStreetMap (Nominatim)']
    };
    // Appends to a class attribute: `class="fw-tile ok` + srcBar(['fb']) + `"` → fw-sb + the bar colour + a title naming the source(s).
    function srcBar(keys, desc) {
        var col = keys.length === 1 ? SRC[keys[0]][0] : 'linear-gradient(' + SRC[keys[0]][0] + ' 50%,' + SRC[keys[1]][0] + ' 50%)';
        return ' fw-sb" style="--sb:' + col + '" data-src="' + keys.join('+') + '"' + (desc ? ' data-tip="' + esc(desc) + '"' : '') + ' title="' + (desc ? esc(desc) + ' — ' : '') + keys.map(function (k) { return esc(SRC[k][1]); }).join(' + ');
    }
    function srcLegend(keys) {
        return '<div class="fw-lg" title="สีแถบ = แหล่งข้อมูล · สองสี = สองแหล่งที่สอดคล้องกัน">' + keys.map(function (k) { return '<span><i style="background:' + SRC[k][0] + '"></i>' + esc(SRC[k][1]) + '</span>'; }).join('') + '</div>';
    }
    var RV_SRC = { thaiwater: 'ThaiWater (RID telemetry)', rid: 'RID daily report', ai: 'RID daily report, read by AI', est: 'estimated from the water level' };
    function m2(v) { return v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2); }
    function fresh(r) { return r && r.q != null && r.at && Date.now() - r.at < 36 * 3600e3; }
    function fmtQ(q) { return Math.round(q).toLocaleString('en-US'); }

    // The Chao Phraya station over the limit (highest first), or null.
    function riverAlert(rv) {
        if (!rv || !rv.stations) return null;
        var over = rv.stations.filter(function (r) { return fresh(r) && r.q > RV_LIMIT; }).sort(function (a, b) { return b.q - a.q; });
        return over[0] || null;
    }

    // V101.72 · blend design. Three severities drive the size AND colour of every emoji (ok small green, warn medium amber, crit large red);
    // ok shows no warning sign. The canal "scene" appears only when the status is not ok and carries the status, the river number, the canal
    // level and the road in one picture. No data = nothing drawn (no "—", no "ไม่มีข้อมูล").
    var SEV_EM = { ok: '🌊', warn: '⚠️', crit: '⛔' }, SEV_TH = { ok: 'ปกติ', warn: 'เฝ้าระวัง', crit: 'เสี่ยงสูง' };
    function emo(e, lv, cls) { return '<span class="fw-e ' + lv + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + e + '</span>'; }
    function sevLevels(d, alert) {
        var c = d.canal, r = d.road && d.road.nearest;
        var canal = c && c.freeboardM != null ? (c.freeboardM < 0 || d.canalRisk === 'high' ? 'crit' : d.canalRisk === 'moderate' ? 'warn' : 'ok') : null;
        var road = r ? (r.closed || r.motorbike === 'blocked' ? 'crit' : 'warn') : d.road ? 'ok' : null;
        var river = alert ? (alert.q > 2500 ? 'crit' : 'warn') : null;
        var base = d.risk === 'high' ? 'crit' : d.risk === 'moderate' ? 'warn' : d.risk === 'low' ? 'ok' : null;
        var overall = base === 'ok' && alert ? 'warn' : base;   // a river over the line lifts "ok" to เฝ้าระวัง
        if (!overall && (canal || road)) overall = 'ok';
        return { overall: overall, canal: canal, road: road, river: river };
    }
    function pillHtml(lv) {
        return '<div class="fw-stat"><span class="fw-pill ' + lv + '"><span class="fw-pe" aria-hidden="true">' + SEV_EM[lv] + '</span>' + SEV_TH[lv] + '</span></div>';
    }
    function keyHtml(alert, lv, inScene) {
        if (!alert) return '';
        var desc = 'แม่น้ำเจ้าพระยา ' + alert.code + ' ' + (RV_PLACE[alert.code] || alert.place || '') + ' สูงกว่าเกณฑ์ ' + fmtQ(RV_LIMIT) + ' m³/s';
        return '<div class="fw-key' + (inScene ? '" data-tip="' + esc(desc) + '" title="' + esc(desc) : srcBar(['rid'], desc)) + '" role="alert">' + emo('⚠️', lv) + '<div class="fw-kt"><b>' + esc(alert.code) + ' ' + esc(RV_PLACE[alert.code] || alert.place || '') +
            '</b></div><div class="fw-kv ' + lv + '">' + fmtQ(alert.q) + '<small>m³/s</small></div></div>';
    }
    function canalArrow(c) {
        return c.change24cm == null || c.change24cm === 0 ? '' : '<i class="fw-ar ' + (c.change24cm > 0 ? 'up' : 'down') + '">' + (c.change24cm > 0 ? '▲' : '▼') + '</i>' + Math.abs(c.change24cm);
    }
    // V101.72: the wording moved out of the rows into hover (title) / tap (data-tip) text.
    function canalDesc(c) {
        var cm = Math.round(Math.abs(c.freeboardM) * 100);
        return 'น้ำในคลอง' + (c.freeboardM < 0 ? 'เกินตลิ่ง ' : 'ต่ำกว่าตลิ่ง ') + cm + ' ซม.' +
            (c.change24cm ? ' · ' + (c.change24cm > 0 ? 'เพิ่มขึ้น ' : 'ลดลง ') + Math.abs(c.change24cm) + ' ซม. ใน 24 ชม.' : '') + (c.name ? ' · ' + c.name + (c.km != null ? ' · ' + c.km + ' กม.' : '') : '');
    }
    function roadDesc(r) {
        if (!r) return 'ไม่มีถนนท่วมในรัศมี 500 ม.';
        return 'ถนนท่วม ' + (r.closed ? 'ปิดการจราจร' : r.depthCm != null ? r.depthCm + ' ซม.' : '') + ' · ' + (r.name || '—') + ' · ห่าง ' + r.m + ' ม. · มอเตอร์ไซค์ ' + (r.motorbike || '?') + ' · รถเก๋ง ' + (r.sedan || '?') + (r.sensor ? ' · เซนเซอร์ กทม.' : '');
    }
    function roadValue(r) { return r.closed ? 'ปิด' : r.depthCm != null ? r.depthCm + '<small>cm</small>' : 'มีน้ำ'; }
    function rowsHtml(d, lv) {
        var out = '', c = d.canal, r = d.road && d.road.nearest;
        if (lv.canal) {
            var cm = Math.round(Math.abs(c.freeboardM) * 100), over = c.freeboardM < 0;
            out += '<div class="fw-r2' + srcBar(['fw'], canalDesc(c)) + '">' + emo('💧', lv.canal) + '<b class="fw-v2 ' + lv.canal + '">' + (over ? '+' : '') + cm +
                '<small>cm</small></b>' + (canalArrow(c) ? '<span class="fw-n2">' + canalArrow(c) + '</span>' : '') + '</div>';
        }
        if (lv.road) {
            out += '<div class="fw-r2' + srcBar(['fb'], roadDesc(r)) + '">' + emo('🛣️', lv.road) + (r
                ? '<b class="fw-v2 ' + lv.road + '">' + roadValue(r) + '</b>'
                : '<b class="fw-v2 ok">ไม่ท่วม</b>') + '</div>';
        }
        return out ? '<div class="fw-rows2">' + out + '</div>' : '';
    }
    // Canal cross-section drawn in SVG: the water stands as high as the real freeboard says (150 cm below the bank = empty), 💦 when over the bank.
    function sceneHtml(d, lv, alert) {
        var c = d.canal, f = c.freeboardM, cm = Math.round(Math.abs(f) * 100), over = f < 0, r = d.road && d.road.nearest;
        var frac = Math.max(0.05, Math.min(1.12, 1 - f * 100 / 150)), tH = 54, wy = 14 + tH * (1 - Math.min(frac, 1)) - (frac > 1 ? 8 : 0);
        var crit = lv.overall === 'crit', sky = crit ? ['#fbc4c4', '#fff1f1'] : ['#fde7bd', '#fffaf2'], water = crit ? '#1d6fb8' : '#2b8fd8';
        var svg = '<svg viewBox="0 0 330 78" preserveAspectRatio="none" class="fw-sc-svg" aria-hidden="true"><path d="M0 14 H150 L162 ' + (14 + tH) + ' H318 L330 14 V78 H0Z" fill="#b39a80"/>' +
            '<path d="M0 14 H150 L162 ' + (14 + tH) + ' H318 L330 14" fill="none" stroke="#8d7459" stroke-width="2.5"/><clipPath id="fwScClip"><path d="M150 14 L162 ' + (14 + tH) + ' H318 L330 14 Z"/></clipPath>' +
            '<g clip-path="url(#fwScClip)"><rect x="140" y="' + wy + '" width="200" height="70" fill="' + water + '" opacity=".92"/><path d="M140 ' + wy + ' q12 -7 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 V' + (wy + 8) + ' H140Z" fill="#7dd3fc" opacity=".85"/></g></svg>';
        var label = 'น้ำในคลอง' + (over ? 'เกินตลิ่ง ' : 'ต่ำกว่าตลิ่ง ') + cm + ' ซม.' + (r ? ' · ถนนท่วม ' + (r.closed ? 'ปิด' : r.depthCm != null ? r.depthCm + ' ซม.' : '') : '');
        return '<div class="fw-scene" role="img" aria-label="' + esc(SEV_TH[lv.overall] + ' · ' + label) + '" data-tip="' + esc(SEV_TH[lv.overall] + ' · ' + label) + '" title="' + esc(SEV_TH[lv.overall] + ' · ' + label) + '"><span class="fw-sc-sky" style="background:linear-gradient(' + sky[0] + ',' + sky[1] + ')"></span>' + svg +
            '<div class="fw-sc-top">' + pillHtml(lv.overall) + keyHtml(alert, lv.river, true) + '</div><span class="fw-sc-house" aria-hidden="true">🏠</span>' +
            (lv.road ? '<span class="fw-sc-road" data-tip="' + esc(roadDesc(r)) + '" title="' + esc(roadDesc(r)) + '">' + emo('🛣️', lv.road) + (r ? '<b class="' + lv.road + '">' + roadValue(r) + '</b>' : '') + '</span>' : '') + (over ? '<span class="fw-sc-spill" aria-hidden="true">💦</span>' : '') +
            '<span class="fw-sc-lvl" data-tip="' + esc(canalDesc(c)) + '" title="' + esc(canalDesc(c)) + '">' + emo('💧', lv.canal) + '<b>' + (over ? '+' : '') + cm + '</b><small>cm</small>' + canalArrow(c) + '</span></div>';
    }
    function statusBlock(d, alert) {
        var lv = sevLevels(d, alert);
        if (!lv.overall) return '';
        if ((lv.overall === 'warn' || lv.overall === 'crit') && lv.canal) return sceneHtml(d, lv, alert);
        return pillHtml(lv.overall) + keyHtml(alert, lv.river, false) + rowsHtml(d, lv);
    }

    // 7 days of rain: 3 back (measured), today, 3 ahead (forecast with its chance) — Open-Meteo daily, see loadWeather.
    var DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    // V101.71: the C.2 → C.13 → C.29B strip on the popup's front (the owner: "River flow ย้ายไปแสดงใน Flood watch").
    function riverRowHtml(rv, dup) {
        var sh = riverStrip(rv, dup);
        if (!sh.html) return '';
        return '<div class="fw-river-row' + srcBar(['rid']) + ' · ' + esc(sh.label) + '">' + sh.html + '</div>';
    }

    function rain7Html(wx) {
        var days = wx && wx.days;
        if (!days || !days.length) return '';
        var max = Math.max(10, Math.max.apply(null, days.map(function (x) { return x.mm || 0; })));
        var cells = days.map(function (x) {
            var dt = new Date(x.d + 'T12:00:00+07:00');
            var h = Math.max(4, Math.round((x.mm || 0) / max * 100));
            var under = x.today || x.past ? '' : (x.pop != null ? x.pop + '%' : '');   // V101.72
            return '<div class="fw-day' + (x.today ? ' today' : x.past ? '' : ' fc') + '" title="' + x.d + ' · ' + (x.mm == null ? '—' : x.mm + ' mm') + (x.past || x.today ? '' : ' · โอกาสฝน ' + (x.pop == null ? '—' : x.pop + '%')) + '"><b>' +
                (x.mm == null ? '—' : (Math.round(x.mm * 10) / 10)) + '</b><div class="fw-bar"><i style="height:' + h + '%"></i></div><span>' + (x.today ? 'วันนี้' : DOW[dt.getDay()]) + '</span><small>' + under + '</small></div>';
        }).join('');
        // V101.67: header is the icon + unit only (the owner cut "ฝน 7 วัน · 3 วันก่อน → 3 วันหน้า"); the title still explains.
        return '<div class="fw-rain7' + srcBar(['om']) + ' · ฝน 7 วัน · 3 วันก่อน → วันนี้ → 3 วันหน้า (mm)"><div class="fw-k"><i class="fa-solid fa-cloud-rain"></i><small>mm</small></div><div class="fw-days">' + cells + '</div></div>';
    }

    // เขต… · 2554 · 2569 (floodPointCheck → d.district / d.history; sources in the titles and the details line).
    var HIST = { high: ['crit', 'สูง'], moderate: ['warn', 'ปานกลาง'], none: ['unk', 'ไม่กระทบ'] };
    // V101.72: the district line IS the summary of the details fold: 📍 name · 2554 sign · 2569 sign ┆ 📋 ▸. A sign per year (⛔ / ⚠️ / 💧), word in the tooltip.
    var HIST_E = { high: ['crit', '⛔'], moderate: ['warn', '⚠️'], none: ['ok', '💧'] };
    function footHtml(d) {
        var h = d.history, s = '';
        if (d.district && h) {
            var yr = function (lv, y, why) {
                var e = HIST_E[lv] || HIST_E.none, label = y === 2569 && lv === 'none' ? 'สิ้นสุด' : (HIST[lv] || HIST.none)[1];
                return '<span class="fw-yr" data-tip="น้ำท่วมปี ' + y + ' · ' + label + ' · ' + why + '" title="น้ำท่วมปี ' + y + ' · ' + label + ' · ' + why + '"><b>' + y + '</b><span class="fw-e bare ' + e[0] + '" role="img" aria-label="' + label + '" title="' + label + '">' + e[1] + '</span></span>';
            };
            s = '<span class="fw-pin" aria-hidden="true">📍</span><span class="fw-dn">' + esc(d.district) + '</span>' +
                yr(h.y2554, 2554, 'จากรายงานข่าว (Rocket Media Lab)') + yr(h.y2569, 2569, 'ประกาศ กทม. 29 ก.ย. 2569 (สิ้นสุด = สิ้นสุดสถานะภัยพิบัติ)');
        } else s = '<span class="fw-dn"></span>';
        return s + '<span class="fw-tg" aria-hidden="true">📋<i></i></span>';
    }

    function line(icon, label, value, small, keys) {
        return '<div class="fw-dl' + srcBar(keys || ['fw']) + '"><i class="fa-solid ' + icon + '"></i><span>' + label + '</span><b>' + value + '</b>' + (small ? '<small>' + small + '</small>' : '') + '</div>';
    }
    function moreHtml(d, p, alert) {
        var rows = [];
        var pop = d.pop;
        (pop && pop.canals || []).forEach(function (c, i) {
            var rate = i === 0 && c.deltaCm != null ? ' · ' + (c.deltaCm > 0 ? '▲ +' : '▼ ') + c.deltaCm + ' cm/ชม.' : '';
            rows.push(line('fa-water', esc(c.name), m2(c.wl) + ' m <span class="fw-lv ' + (LV[c.level] || 'unk') + '">' + (c.level === 'crit' ? 'วิกฤต' : c.level === 'warn' ? 'เฝ้าระวัง' : c.level === 'ok' ? 'ปกติ' : '?') + '</span>', c.km + ' km' + esc(rate), ['pop']));
        });
        var roads = pop && pop.roads || [];
        if (roads.length) {
            var wet = roads.filter(function (r) { return r.level !== 'dry'; });
            rows.push(line('fa-road', roads.map(function (r) { return esc(r.name); }).join(' · '), wet.length ? wet.map(function (r) { return (r.depthCm == null ? 'มีน้ำ' : r.depthCm + ' cm'); }).join(', ') : 'แห้ง', roads.map(function (r) { return r.km; }).sort().filter(function (v, i, a) { return i === 0 || i === a.length - 1; }).join('–') + ' km', d.road ? ['pop', 'fb'] : ['pop']));
        }
        if (d.traffy6h) rows.push(line('fa-triangle-exclamation', 'รายงานน้ำท่วมจากประชาชน (Traffy)', d.traffy6h, '≤1 km · 6 ชม.', ['fw']));
        var rv = d.river && d.river.stations ? d.river.stations.filter(fresh) : [];   // V101.71: shown on the front (riverRowHtml); kept here for the legend
        var wx = p.wx;
        if (wx) rows.push(line('fa-cloud-sun', wxIcon(wx) + ' ' + wx.temp + '° (รู้สึก ' + wx.feels + '°) · ฝน 6 ชม. ' + wx.pop + '%', wx.aqi != null ? 'AQI <span class="fw-aqi ' + aqiClass(wx.aqi) + '">' + wx.aqi + '</span>' : '', wx.pm25 != null ? 'PM2.5 ' + wx.pm25 : '', ['om']));
        var t = p.at ? new Date(p.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '';
        // V101.69: the sources are the bar colours — list them once as a dot legend, then only time · nearest gauge.
        var used = [];
        if (d.src ? d.src.fw : d.canal) used.push('fw');
        if (pop) used.push('pop');
        if (d.road) used.push('fb');
        if (rv.length) used.push('rid');
        if (wx) used.push('om');
        if (d.district && d.history) used.push('hist', 'osm');
        var src = [t, d.canal ? esc(d.canal.name) + (d.canal.km != null ? ' · ' + d.canal.km + ' km' : '') : ''].filter(Boolean).join(' · ');
        return '<details class="fw-more"><summary class="fw-foot' + (d.district && d.history ? srcBar(['hist', 'osm']) : '') + '" aria-label="รายละเอียด · สถานีใกล้เคียง · แม่น้ำ · อากาศ">' + footHtml(d) + '</summary><div class="fw-dls">' + rows.join('') + srcLegend(used) + '<div class="fw-meta">' + src + '</div></div></details>';
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
            var alert = riverAlert(d.river);
            body = statusBlock(d, alert) + riverRowHtml(d.river, alert && alert.code) + rain7Html(p.wx) + moreHtml(d, p, alert);
        }
        // Flood data can fail on its own (FloodWatch is flaky); the 7-day rain still shows.
        if (!d && p.wx && !p.loading) body += rain7Html(p.wx);
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

    // V101.72: descriptions live in data-tip (+ title for desktop hover). A tap shows the same text as a small bubble that fades after 4 s;
    // a tap anywhere else hides it. render() rebuilds the sheet, which also clears it.
    var tipTimer = null;
    function showTip(e) {
        var old = sheet && sheet.querySelector('.fw-tip');
        if (old) old.remove();
        var t = e.target.closest && e.target.closest('[data-tip]');
        if (!sheet || !t || !sheet.contains(t)) return;
        var r = t.getBoundingClientRect(), sr = sheet.getBoundingClientRect(), b = document.createElement('div');
        b.className = 'fw-tip'; b.setAttribute('role', 'status'); b.textContent = t.getAttribute('data-tip');
        sheet.appendChild(b);
        b.style.top = Math.round(r.bottom - sr.top + 6) + 'px';
        b.style.left = Math.round(Math.max(8, Math.min(r.left - sr.left, sr.width - b.offsetWidth - 8))) + 'px';
        clearTimeout(tipTimer);
        tipTimer = setTimeout(function () { var x = sheet && sheet.querySelector('.fw-tip'); if (x) x.remove(); }, 4000);
    }
    window.fwOpen = function () {
        if (sheet) return close();   // the rail button toggles
        scrim = document.createElement('div');
        scrim.className = 'fw-scrim';
        scrim.onclick = close;
        sheet = document.createElement('div');
        sheet.className = 'fw-sheet lang-no-toggle';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-label', 'Flood watch');
        sheet.addEventListener('click', showTip);
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
