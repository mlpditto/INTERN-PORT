'use strict';
// Chao Phraya discharge (m³/s) at the three stations the flood table talks about:
//   C.2  Nakhon Sawan (upstream), C.13 below Chao Phraya Dam, C.29B Bang Sai (Bangkok's doorstep).
//
// Four sources, tried in this order per station (refreshRiverDischarge picks the best one):
//   1. ThaiWater API   — RID/HII telemetry, every ~10-60 min. Has C.2 and C.13; no C.29B (checked 2026-10-03).
//   2. RID daily PDF   — "สถานการณ์ลุ่มน้ำเจ้าพระยา (D mon.YY) .pdf", published ~06:00, an infographic whose
//                        gauges read `current(%)/capacity`. The capacity is unique per station, so a regex
//                        anchored on it finds the value without caring where the text sits on the page.
//   3. AI reads the PDF — only when the regex finds nothing (layout changed); values are range-checked.
//   4. Rating curve    — level → discharge, learned from the (level, discharge) pairs source 1 delivers;
//                        used only when a station reports a level but no discharge. Marked "est".
// Output lands in flood_status/_discharge (Admin SDK only); floodPointCheck hands it to the intern popup.
const axios = require('axios');

const UA = 'INTERN-PORT flood-watch (github.com/mlpditto/INTERN-PORT)';
const THAIWATER = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load';
const RID_NEWS = 'https://water.rid.go.th/flood/news/';
// cap = the "/capacity" printed beside each gauge in the RID infographic (m³/s) — also its anchor.
const STATIONS = [
    { code: 'C.2', name: 'ค่ายจิรประวัติ', place: 'นครสวรรค์', cap: 3735 },
    { code: 'C.13', name: 'ท้ายเขื่อนเจ้าพระยา', place: 'ชัยนาท', cap: 2720 },
    { code: 'C.29B', name: 'อ.บางไทร', place: 'อยุธยา', cap: 3600 }
];
const TW_FRESH_MS = 3 * 3600e3;     // a telemetry reading older than this is "stale"
const RID_FRESH_MS = 30 * 3600e3;   // the PDF is daily
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const plausible = (st, q) => Number.isFinite(q) && q >= 0 && q <= st.cap * 1.6;
const toNum = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return v == null || v === '' ? null : n; };
const bangkokYMD = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);   // Bangkok calendar day of an instant

// ---- 1 · ThaiWater ----
async function fromThaiWater() {
    const res = await axios.get(THAIWATER, { headers: { 'User-Agent': UA }, timeout: 30000 });
    const rows = (res.data && res.data.waterlevel_data && res.data.waterlevel_data.data) || [];
    const out = {};
    for (const st of STATIONS) {
        const r = rows.find(x => x.station && x.station.tele_station_oldcode === st.code);
        if (!r) continue;
        const at = Date.parse(String(r.waterlevel_datetime).replace(' ', 'T') + ':00+07:00');
        const q = toNum(r.discharge), level = toNum(r.waterlevel_msl);
        out[st.code] = { q: plausible(st, q) ? q : null, level: Number.isFinite(level) ? level : null, at: Number.isFinite(at) ? at : null };
    }
    return out;
}

// ---- 2 · RID daily PDF ----
function ridFileUrl(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return RID_NEWS + encodeURIComponent(`สถานการณ์ลุ่มน้ำเจ้าพระยา (${d} ${THAI_SHORT[m - 1]}${String((y + 543) % 100).padStart(2, '0')}) .pdf`);
}

// Today's report, else yesterday's (it is not out before ~06:00). Returns { ymd, buf } or null.
async function fetchRidPdf(nowMs, skipYmd) {
    for (const back of [0, 1]) {
        const ymd = bangkokYMD(nowMs - back * 86400e3);
        if (ymd === skipYmd) return null;   // already parsed this one
        try {
            const r = await axios.get(ridFileUrl(ymd), { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 8e6, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; INTERN-PORT)' } });
            const buf = Buffer.from(r.data);
            if (buf.slice(0, 4).toString() === '%PDF') return { ymd, buf };
        } catch (e) {
            if (!(e.response && e.response.status === 404)) throw e;
        }
    }
    return null;
}

async function pdfText(buf) {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');   // not the package root: its index.js runs a debug self-test
    return (await pdfParse(buf)).text;
}

// "วันที่3ตุลาคม2569 เวลา 06.00 น." → epoch ms, or null.
function ridReportTime(text) {
    const m = text.match(/วันที่\s*(\d{1,2})\s*([ก-๙]+)\s*(\d{4})\s*เวลา\s*(\d{1,2})[.:](\d{2})/);
    const mo = m && THAI_MONTHS.indexOf(m[2]);
    if (!m || mo < 0) return null;
    return Date.parse(`${Number(m[3]) - 543}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5]}:00+07:00`);
}

// "2,382(66%)/3,600" — the capacity pins the station. Two different values for one capacity = ambiguous → no answer.
function parseRidText(text) {
    const out = {};
    for (const st of STATIONS) {
        const cap = st.cap.toLocaleString('en-US');
        const vals = new Set();
        const re = new RegExp(`([\\d,]+)\\(\\s*-?\\d+\\s*%\\)\\s*/\\s*${cap}(?![\\d,])`, 'g');
        for (let m; (m = re.exec(text));) vals.add(toNum(m[1]));
        const q = vals.size === 1 ? [...vals][0] : null;
        if (plausible(st, q)) out[st.code] = q;
    }
    return out;
}

// ---- 3 · AI reads the PDF (fallback) ----
async function aiReadPdf(buf, apiKey, missing) {
    if (!apiKey || !missing.length) return {};
    const model = 'gemini-3.8-flash';
    const want = missing.map(s => `${s.code} (capacity ${s.cap})`).join(', ');
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } },
            { text: 'This is the Thai Royal Irrigation Department Chao Phraya basin situation infographic. Each river gauge is labelled with its code and a figure written current(percent)/capacity in m3/s. ' +
                `For these gauges: ${want} — return the CURRENT value (the number before the parenthesis, m3/s) exactly as printed. Use null if you cannot read it. Do not guess.` }
        ] }],
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: { parts: [{ text: 'Answer ONLY with JSON of the form {"stations":[{"code":"C.2","q":123}]}.' }] }
    }, { timeout: 60000 });
    const txt = (((res.data.candidates || [])[0] || {}).content || {}).parts;
    const raw = (txt || []).map(p => p.text || '').join('');
    let j; try { j = JSON.parse(raw.replace(/^```json\s*|```$/g, '').trim()); } catch (e) { return {}; }
    const out = {};
    for (const s of (j && j.stations) || []) {
        const st = missing.find(x => x.code === s.code), q = toNum(s.q);
        if (st && plausible(st, q) && q !== st.cap) out[st.code] = q;
    }
    return out;
}

// ---- 4 · rating curve learned from the pairs ThaiWater gives ----
// buckets: { "<level in 0.1 m>": [q, epochMin] }. Estimate = linear between the two neighbouring
// buckets, never extrapolated and never across a gap wider than 0.5 m.
const RATING_MAX = 400;
function learnRating(buckets, level, q) {
    if (level == null || q == null) return buckets;
    buckets[String(Math.round(level * 10))] = [Math.round(q), Math.round(Date.now() / 60000)];
    const keys = Object.keys(buckets);
    if (keys.length > RATING_MAX) {
        keys.sort((a, b) => buckets[a][1] - buckets[b][1]).slice(0, keys.length - RATING_MAX).forEach(k => delete buckets[k]);
    }
    return buckets;
}
function estimateFromRating(buckets, level) {
    if (level == null) return null;
    const ks = Object.keys(buckets || {}).map(Number).sort((a, b) => a - b);
    const x = level * 10;
    const lo = [...ks].reverse().find(k => k <= x), hi = ks.find(k => k >= x);
    if (lo == null || hi == null || (hi - lo) > 5) return null;
    const ql = buckets[lo][0], qh = buckets[hi][0];
    return Math.round(hi === lo ? ql : ql + (qh - ql) * (x - lo) / (hi - lo));
}

// ---- pick + store ----
const DOC = 'flood_status/_discharge';
const HIST_SLOT_MS = 6 * 3600e3, HIST_KEEP = 8;   // 8 × 6 h = 48 h of history for the 24 h trend

async function refreshRiverDischarge(db, FieldValue, opts) {
    const now = Date.now();
    const ref = db.doc(DOC);
    const prev = (await ref.get()).data() || {};
    const ok = { tw: false, rid: false, ai: false };
    const log = [];

    let tw = {};
    try { tw = await fromThaiWater(); ok.tw = true; } catch (e) { log.push('thaiwater: ' + (e && e.message)); }

    // The PDF is the only source for C.29B, and the fallback for the rest: fetch it unless today's is already parsed.
    let rid = {}, ridAt = null, ridYmd = prev.ridYmd || null, ai = {};
    try {
        const pdf = await fetchRidPdf(now, prev.ridYmd === bangkokYMD(now) ? prev.ridYmd : null);
        if (!pdf && prev.ridYmd === bangkokYMD(now)) { ok.rid = !!(prev.ok && prev.ok.rid); ok.ai = !!(prev.ok && prev.ok.ai); }   // today's already parsed
        if (pdf) {
            const text = await pdfText(pdf.buf);
            rid = parseRidText(text);
            ridAt = ridReportTime(text) || Date.parse(pdf.ymd + 'T06:00:00+07:00');
            ok.rid = Object.keys(rid).length > 0;
            ridYmd = pdf.ymd;
            const missing = STATIONS.filter(s => rid[s.code] == null);
            if (missing.length) {
                try { ai = await aiReadPdf(pdf.buf, opts && opts.geminiKey, missing); ok.ai = Object.keys(ai).length > 0; } catch (e) { log.push('ai: ' + (e && e.message)); }
            }
        }
    } catch (e) { log.push('rid: ' + (e && e.message)); }

    const rating = prev.rating || {}, hist = prev.hist || {}, stations = [];
    for (const st of STATIONS) {
        const t = tw[st.code] || {};
        const buckets = rating[st.code] || {};
        if (t.q != null && t.level != null) learnRating(buckets, t.level, t.q);
        rating[st.code] = buckets;

        const fresh = (at, ms) => at != null && now - at <= ms;
        const est = t.q == null && fresh(t.at, TW_FRESH_MS) ? estimateFromRating(buckets, t.level) : null;
        const c = [
            t.q != null && fresh(t.at, TW_FRESH_MS) && { q: t.q, at: t.at, src: 'thaiwater' },
            rid[st.code] != null && fresh(ridAt, RID_FRESH_MS) && { q: rid[st.code], at: ridAt, src: 'rid' },
            ai[st.code] != null && fresh(ridAt, RID_FRESH_MS) && { q: ai[st.code], at: ridAt, src: 'ai' },
            est != null && { q: est, at: t.at, src: 'est' },
            t.q != null && { q: t.q, at: t.at, src: 'thaiwater' },   // stale, but better than nothing
            rid[st.code] != null && { q: rid[st.code], at: ridAt, src: 'rid' }
        ].find(Boolean);
        const keep = (prev.stations || []).find(s => s.code === st.code);
        const pick = c || (keep && keep.q != null ? { q: keep.q, at: keep.at, src: keep.src } : null);
        const h = (hist[st.code] || []).slice();
        if (pick && pick.src !== 'est' && (!h.length || now - h[h.length - 1].t >= HIST_SLOT_MS)) {
            h.push({ t: now, q: pick.q }); while (h.length > HIST_KEEP) h.shift();
        }
        hist[st.code] = h;
        // 24 h change: vs the newest history point that is at least 20 h old.
        const old = [...h].reverse().find(p => now - p.t >= 20 * 3600e3);
        stations.push({
            code: st.code, name: st.name, place: st.place, cap: st.cap,
            q: pick ? pick.q : null, pct: pick ? Math.round(pick.q / st.cap * 100) : null,
            at: pick ? pick.at : null, src: pick ? pick.src : null,
            level: t.level == null ? null : t.level,
            d24: pick && old ? Math.round(pick.q - old.q) : null
        });
    }
    await ref.set({ stations, rating, hist, ridYmd, ok, updatedAt: FieldValue.serverTimestamp() });
    return { stations, ok, log };
}

// What the intern popup gets (floodPointCheck → d.river). Never throws.
async function readRiverDischarge(db) {
    try {
        const d = (await db.doc(DOC).get()).data();
        if (!d || !Array.isArray(d.stations)) return null;
        return { stations: d.stations, updatedAt: d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : null };
    } catch (e) { return null; }
}

module.exports = { STATIONS, aiReadPdf, refreshRiverDischarge, readRiverDischarge, parseRidText, ridReportTime, ridFileUrl, learnRating, estimateFromRating };
