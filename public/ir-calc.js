// V101.323 (owner pick A, mockup-ir-calculator/): 🧮 insulin-resistance calculator, first section of every diabetes drug (ATC A10) in the
// Drug Codex — the 👶 pattern. Five boxes (FBS · HbA1c · TG · HDL · fasting insulin); each result shows as soon as its inputs are there.
// Everything is worked out on the phone: nothing is saved or sent. Values are kept across drugs for this visit only.
// UMD so the QA can require() it.
(function (root, factory) {
    const m = factory();
    if (typeof module === 'object' && module.exports) module.exports = m; else root.IrCalc = m;
})(typeof self !== 'undefined' ? self : this, function () {
    // Cut-offs. FBS / HbA1c are the ADA diagnostic bands. TyG, HOMA-IR and TG/HDL have no single agreed cut-off (they move with the
    // population studied); these are the commonly used ones, named in each chip's note — change them here and the QA follows.
    const CUT = { fbs: [100, 126], a1c: [5.7, 6.5], tyg: 8.5, homa: 2.5, tghdl: 3.0 };
    const SRC = {
        fbs: 'ADA Standards of Care: < 100 normal · 100–125 prediabetes · ≥ 126 diabetes (mg/dL)',
        a1c: 'ADA Standards of Care: < 5.7 normal · 5.7–6.4 prediabetes · ≥ 6.5 diabetes (%)',
        tyg: 'TyG = ln(TG × FBS ÷ 2), mg/dL (Simental-Mendía 2008) · ≥ 8.5 suggests insulin resistance — the cut-off varies by population',
        homa: 'HOMA-IR = FBS (mg/dL) × fasting insulin (µU/mL) ÷ 405 (Matthews 1985) · ≥ 2.5 suggests insulin resistance — the cut-off varies by population',
        tghdl: 'TG ÷ HDL, mg/dL (McLaughlin 2003) · ≥ 3.0 suggests insulin resistance — lower cut-offs are used for women and some Asian groups'
    };
    const FIELDS = [['fbs', 'FBS', 'mg/dL'], ['a1c', 'HbA1c', '%'], ['tg', 'TG', 'mg/dL'], ['hdl', 'HDL', 'mg/dL'], ['ins', 'Insulin', 'µU/mL']];
    const RANGE = { fbs: [20, 600], a1c: [3, 20], tg: [10, 5000], hdl: [5, 200], ins: [0.5, 300] };   // outside = a typo, ignored
    const state = { fbs: null, a1c: null, tg: null, hdl: null, ins: null };

    function applies(drug) { return /^A10/i.test(String((drug && drug.atcCode) || '').trim()); }
    function num(k, v) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); const r = RANGE[k]; return Number.isFinite(n) && n >= r[0] && n <= r[1] ? n : null; }
    function set(k, v) { if (k in state) state[k] = num(k, v); }

    // [{ k, label, value, tag, level }] — level g = normal · a = borderline / prediabetes · r = diabetes / insulin resistance
    function results(s) {
        const out = [], band = (v, [lo, hi]) => v < lo ? ['g', ''] : v < hi ? ['a', 'Pre-DM'] : ['r', 'DM'];
        if (s.fbs != null) { const [l, t] = band(s.fbs, CUT.fbs); out.push({ k: 'fbs', label: 'FBS', value: String(s.fbs), tag: t, level: l }); }
        if (s.a1c != null) { const [l, t] = band(s.a1c, CUT.a1c); out.push({ k: 'a1c', label: 'A1c', value: s.a1c.toFixed(1), tag: t, level: l }); }
        if (s.tg != null && s.fbs != null) { const v = Math.log(s.tg * s.fbs / 2); out.push({ k: 'tyg', label: 'TyG', value: v.toFixed(2), tag: v >= CUT.tyg ? 'IR' : '', level: v >= CUT.tyg ? 'r' : 'g' }); }
        if (s.ins != null && s.fbs != null) { const v = s.fbs * s.ins / 405; out.push({ k: 'homa', label: 'HOMA-IR', value: v.toFixed(1), tag: v >= CUT.homa ? 'IR' : '', level: v >= CUT.homa ? 'r' : 'g' }); }
        if (s.tg != null && s.hdl != null) { const v = s.tg / s.hdl; out.push({ k: 'tghdl', label: 'TG/HDL', value: v.toFixed(1), tag: v >= CUT.tghdl ? 'IR' : '', level: v >= CUT.tghdl ? 'r' : 'g' }); }
        return out;
    }
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function resultsHtml(s) {
        const rs = results(s);
        return rs.map(r => `<button type="button" class="dc-ir-c ${r.level}" data-k="${r.k}" onclick="dcIrWhy(this)" title="${esc(SRC[r.k])}">${r.label} ${r.value}${r.tag ? `<small>${r.tag}</small>` : ''}</button>`).join('');
    }
    // lang: 'th' | 'ko' | anything else = English
    function sectionBodyHtml(s, lang) {
        const note = lang === 'th' ? 'คำนวณในเครื่อง ไม่บันทึก ไม่ส่งออก · แตะผลเพื่อดูสูตรและเกณฑ์' : lang === 'ko' ? '이 기기에서만 계산 · 저장·전송 없음 · 결과를 누르면 공식과 기준' : 'Worked out on this phone — nothing is saved or sent · tap a result for its formula and cut-off';
        return `<div class="dc-ir">
            <div class="dc-ir-g">${FIELDS.map(([k, l, u]) => `<label class="dc-ir-f">${l}<input class="dc-ir-in" data-k="${k}" type="number" inputmode="decimal" step="any" value="${s[k] == null ? '' : s[k]}" placeholder="${u}" oninput="dcIrInput(this)" aria-label="${l} (${u})"></label>`).join('')}</div>
            <div class="dc-ir-res" aria-live="polite">${resultsHtml(s)}</div>
            <div class="dc-ir-why" hidden></div>
            <div class="dc-ir-note">${note}</div></div>`;
    }
    return { CUT, SRC, FIELDS, state, applies, set, results, resultsHtml, sectionBodyHtml };
});
