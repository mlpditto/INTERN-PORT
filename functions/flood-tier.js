// functions/flood-tier.js — four-step alert for the canal gauge nearest the training site, planned around a ~6 h lead time.
// Pure functions (no I/O) so scripts/flood-tier-check.cjs can run them with injected readings.
//   tier 1  heads-up   the gauge would reach its watch mark in <= 12 h at the current rate of rise
//   tier 2  prepare    ... in <= 6 h                         (the planning step: move things up, pick the route)
//   tier 3  watch      the gauge is AT / over its watch mark
//   tier 4  act        critical mark reached, a road within 500 m is closed / >= 30 cm deep, or FloodWatch says High
// The rate comes from the hourly readings the job keeps (about 3 h apart); with no history yet it falls back to the
// gauge's own 1 h change. A gauge that fell in the last hour is never "rising". Noise guard: >= 1 cm/h.
const LEAD_H = { 1: 12, 2: 6 };
const MIN_RATE_CM_H = 1;
const KEEP_H = 12;       // readings kept per place
const NEAR_KM = 3;       // a gauge further than this says nothing about the site

// Append the current reading, drop anything older than KEEP_H, return the new list ([{ t, wl }], t in ms).
function pushReading(history, now, wl) {
    const keep = (Array.isArray(history) ? history : []).filter(h => h && typeof h.t === 'number' && typeof h.wl === 'number' && now - h.t < KEEP_H * 3600e3 && h.t < now);
    if (typeof wl === 'number' && isFinite(wl)) keep.push({ t: now, wl: Math.round(wl * 100) / 100 });
    return keep;
}

// cm per hour: against the reading closest to 3 h ago (1.5 - 4.5 h old), else the gauge's own 1 h change.
function gaugeRate(c, history, now) {
    let best = null;
    for (const h of history || []) {
        const ageH = (now - h.t) / 3600e3;
        if (ageH < 1.5 || ageH > 4.5) continue;
        if (!best || Math.abs(ageH - 3) < Math.abs(best.ageH - 3)) best = { ageH, wl: h.wl };
    }
    if (best) return { rate: Math.round((c.wl - best.wl) * 100 / best.ageH * 10) / 10, basis: Math.round(best.ageH * 10) / 10 + ' h' };
    if (c.deltaCm != null) return { rate: c.deltaCm, basis: '1 h' };
    return { rate: null, basis: null };
}

function floodTier(s, history, now) {
    const c = s && s.pop && s.pop.canals && s.pop.canals[0];
    const rd = s && s.road && s.road.nearest;
    const roadCut = !!(rd && rd.m <= 500 && (rd.closed || (rd.depthCm || 0) >= 30));
    const out = { tier: 0, c: null, leftCm: null, rate: null, basis: null, etaH: null, roadCut };
    const usable = c && c.km <= NEAR_KM && c.wl != null && c.warn != null && c.level !== 'unk';
    if (usable) {
        out.c = c; out.leftCm = Math.round((c.warn - c.wl) * 100);
        const g = gaugeRate(c, history, now); out.rate = g.rate; out.basis = g.basis;
        const rising = g.rate != null && g.rate >= MIN_RATE_CM_H && !(c.deltaCm != null && c.deltaCm < 0);
        if (out.leftCm > 0 && rising) out.etaH = Math.round(out.leftCm / g.rate * 10) / 10;
        if (c.level === 'crit') out.tier = 4;
        else if (c.level === 'warn' || out.leftCm <= 0) out.tier = 3;
        else if (out.etaH != null && out.etaH <= LEAD_H[2]) out.tier = 2;
        else if (out.etaH != null && out.etaH <= LEAD_H[1]) out.tier = 1;
    }
    if (roadCut || (s && s.risk === 'high')) out.tier = 4;
    return out;
}

module.exports = { floodTier, gaugeRate, pushReading, LEAD_H, MIN_RATE_CM_H, KEEP_H, NEAR_KM };
