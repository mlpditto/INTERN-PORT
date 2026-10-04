// Paediatric liquid-medicine dosing: the data (24 formulations, 23 drugs) and the calculator.
// Source: the Pharmtutors infographics "ขนาดยาที่ใช้ในเด็กตามน้ำหนัก / ตามอายุ" (3 pages). The numbers were typed twice
// independently and compared (scripts/peds-dosing-qa.cjs keeps the formula-vs-table check). It is shared by the intern page
// (calculator in the Drug Codex detail), the admin page (import into drug_codex) and the QA script (Node: module.exports).
//
// Shape of one drug:  { key, genericName, aliases[], forms[] }   — stored on drug_codex/{id}.pedsDosing as { v:1, source, forms }
//   weight form: { mode:'weight', label, strength:{amount,unit} (per 5 ml), timesPerDay:{min,max}, timing:'ac'|null,
//                  basis:{per:'day'|'dose', unit:'mg/kg'|'mcg/kg', min, max}, printed (the text under "วันละ (ครั้ง)"),
//                  table:{5,10,15,20,25 → printed ml per dose}, notes[] }
//   age form:    { mode:'age', label, strength, timesPerDay, timing, printed, segments:[{from,to,fuzzy[],text,amount}], notes[] }
//                 `fuzzy` = ages whose pill the printed cell edge cuts in half — they may belong to this segment or its neighbour.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PedsDosing = api;
})(typeof self !== 'undefined' ? self : this, function () {
    // Where the NUMBERS come from (shown to admins on import); interns see the reference links (MEDSCAPE) instead.
    const SOURCE = 'ตัวเลขจากอินโฟกราฟิก Pharmtutors "ขนาดยาที่ใช้ในเด็ก"; ลิงก์อ้างอิง: Medscape Drug Reference';
    const W = (a, b, c, d, e) => ({ 5: a, 10: b, 15: c, 20: d, 25: e });
    const weight = (label, amount, unit, times, timing, basis, printed, table, notes) =>
        ({ mode: 'weight', label, strength: { amount, unit }, timesPerDay: { min: times[0], max: times[times.length - 1] }, timing, basis, printed, table, notes: notes || [] });
    const day = (min, max) => ({ per: 'day', unit: 'mg/kg', min, max: max == null ? min : max });
    const dose = (min, max, unit) => ({ per: 'dose', unit: unit || 'mg/kg', min, max: max == null ? min : max });

    const DATA = [
        { key: 'amoxicillin', genericName: 'Amoxicillin', aliases: ['amoxicillin', 'amoxycillin'], forms: [
            weight('125 mg/5 ml', 125, 'mg', [3], null, day(20, 50), '3 (20-50 MKD)', W('1.5-3', '3-6.5', '4-10', '5-13', '7-16')),
            weight('250 mg/5 ml', 250, 'mg', [3], null, day(20, 50), '3 (20-50 MKD)', W('1', '1.5-3', '2-5', '2.5-6.5', '3.5-8'),
                ['ต้นฉบับพิมพ์ “1” ที่ 5 kg (ที่น้ำหนักอื่นเป็นช่วง) — สูตร 20–50 MKD ให้ ≈ 0.7–1.7 ml'])] },
        { key: 'augmentin', genericName: 'Amoxicillin/Clavulanic acid', aliases: ['amoxicillin/clavulanic acid', 'amoxicillin clavulanic acid', 'amoxicillin-clavulanate', 'amoxicillin/clavulanate', 'augmentin', 'co-amoxiclav'], forms: [
            weight('228.5 mg/5 ml (amoxicillin 200 + clavulanate 28.5)', 200, 'mg', [2], null, day(25, 45), '2 (25-45 MKD)', W('1.4-3', '3-5.5', '4.5-8.5', '6-11', '8-14'),
                ['ใช้ amoxicillin 200 mg/5 ml เป็นความเข้มข้นในการคำนวณ (228.5 mg คือน้ำหนักรวมกับ clavulanate) — ตารางต้นฉบับตรงกับค่านี้ ยกเว้นขอบล่างที่ 5 kg (1.4) ซึ่งสูตรให้ 1.6']) ] },
        { key: 'azithromycin', genericName: 'Azithromycin', aliases: ['azithromycin'], forms: [
            weight('200 mg/5 ml', 200, 'mg', [1], null, day(10), '1 (10 MKD)', W('1.25', '2.5', '3.8', '5', '6.3')) ] },
        { key: 'cefaclor', genericName: 'Cefaclor', aliases: ['cefaclor'], forms: [
            weight('125 mg/5 ml', 125, 'mg', [3], null, day(20, 40), '3 (20-40 MKD)', W('1.5-2.5', '2.5-5', '4-8', '5.5-10', '6.5-13')) ] },
        { key: 'cefdinir', genericName: 'Cefdinir', aliases: ['cefdinir'], forms: [
            weight('125 mg/5 ml', 125, 'mg', [1], null, dose(14), '1 (14 MK)', W('3', '6', '8.4', '11', '14'),
                ['วันละครั้ง จึง 14 mg/kg/dose = 14 mg/kg/day']) ] },
        { key: 'cotrimoxazole', genericName: 'Sulfamethoxazole/Trimethoprim', aliases: ['sulfamethoxazole/trimethoprim', 'cotrimoxazole', 'co-trimoxazole', 'trimethoprim/sulfamethoxazole', 'bactrim'], forms: [
            weight('TMP 40 + SMX 200 mg/5 ml', 40, 'mg', [2], null, day(6, 12), '2 (6-12 MKD)', W('1.9-3.75', '3.8-7.5', '5.7-11.25', '7.6-15', '9.5-18.75'),
                ['ต้นฉบับไม่ระบุความเข้มข้น — คำนวณย้อนจากตารางว่า MKD เป็นของ trimethoprim 40 mg/5 ml (ตรงกับทุกช่อง)']) ] },
        { key: 'cpm', genericName: 'Chlorpheniramine', aliases: ['chlorpheniramine', 'cpm', 'chlorpheniramine maleate'], forms: [
            weight('2 mg/5 ml', 2, 'mg', [3, 4], null, day(0.35), '3-4 (0.35 MKD)', W('1.1-1.5', '2.5-3', '3.5-4.5', '4.5-6', '5.5-7')) ] },
        { key: 'dicloxacillin', genericName: 'Dicloxacillin', aliases: ['dicloxacillin'], forms: [
            weight('62.5 mg/5 ml', 62.5, 'mg', [4], 'ac', day(12.5, 25), '4 ac (12.5-25 MKD)', W('1.3-2.5', '2.5-5', '4-7.5', '5-10', '6.5-12')) ] },
        { key: 'domperidone', genericName: 'Domperidone', aliases: ['domperidone'], forms: [
            weight('5 mg/5 ml', 5, 'mg', [3], 'ac', dose(0.2, 0.4), '3 ac (0.2-0.4 MK)', W('1-2', '2-4', '3-6', '4-8', '5-10')) ] },
        { key: 'erythromycin', genericName: 'Erythromycin', aliases: ['erythromycin'], forms: [
            weight('125 mg/5 ml', 125, 'mg', [4], null, day(30, 50), '4 (30-50 MKD)', W('1.5-2.5', '2-5', '4.5-7.5', '6-10', '7.5-12'),
                ['ต้นฉบับที่ 10 kg พิมพ์ 2-5 แต่สูตร 30-50 MKD ให้ 3-5 ml']) ] },
        { key: 'hydroxyzine', genericName: 'Hydroxyzine', aliases: ['hydroxyzine'], forms: [
            weight('10 mg/5 ml', 10, 'mg', [3, 4], null, day(2), '3-4 (2 MKD)', W('1.3-1.5', '2.5-3.5', '4-5', '5-6.5', '6.5-8')) ] },
        { key: 'ibuprofen', genericName: 'Ibuprofen', aliases: ['ibuprofen'], forms: [
            weight('100 mg/5 ml', 100, 'mg', [3, 4], null, dose(5, 10), '3-4 (5-10 MK)', W('1.3-2.5', '2.5-5', '3.8-7.5', '5-10', '6.3-12')) ] },
        { key: 'ketotifen', genericName: 'Ketotifen', aliases: ['ketotifen'], forms: [
            weight('1 mg/5 ml', 1, 'mg', [2], null, dose(0.025), '2 (0.025 MKD)', W('0.6', '1.25', '1.8', '2.5', '3'),
                ['ต้นฉบับพิมพ์ “0.025 MKD” แต่ตัวเลขในตารางตรงกับ 0.025 mg/kg ต่อครั้ง (MK) — คำนวณเป็นต่อครั้ง']) ] },
        { key: 'paracetamol', genericName: 'Paracetamol', aliases: ['paracetamol', 'acetaminophen'], forms: [
            weight('120 mg/5 ml', 120, 'mg', [4, 5, 6], null, dose(10, 15), '4-6 (10-15 MK)', W('2-3', '4-6.3', '6.3-9', '8.5-12', '10-15')) ] },
        { key: 'penicillin-v', genericName: 'Penicillin V', aliases: ['penicillin v', 'penicillinv', 'phenoxymethylpenicillin'], forms: [
            weight('125 mg/5 ml', 125, 'mg', [4], 'ac', day(25, 50), '4 ac (25-50 MKD)', W('1.3-2.5', '2.5-5', '3.8-7.5', '5-10', '6.3-12')) ] },
        { key: 'procaterol', genericName: 'Procaterol', aliases: ['procaterol'], forms: [
            weight('25 mcg/5 ml', 25, 'mcg', [2], null, dose(1.25, 1.25, 'mcg/kg'), '2 (1.25 mcg/kg/dose)', W('1.25', '2.5', '3.75', '5', '6.25')) ] },
        { key: 'pseudoephedrine', genericName: 'Pseudoephedrine', aliases: ['pseudoephedrine'], forms: [
            weight('30 mg/5 ml', 30, 'mg', [3], null, day(4), '3 (4 MKD)', W('1', '2', '4', '4.5', '5.5'),
                ['ต้นฉบับที่ 15 kg พิมพ์ 4 แต่สูตร 4 MKD ให้ 3.3 ml (10 kg พิมพ์ 2, สูตรให้ 2.2)']) ] },
        { key: 'salbutamol', genericName: 'Salbutamol', aliases: ['salbutamol', 'albuterol'], forms: [
            weight('2 mg/5 ml', 2, 'mg', [4], null, dose(0.1), '4 (0.1 MK)', W('1.3', '2.5', '3.8', '5', '6.3')) ] },
        // ---- by age (0-12 years) ----
        { key: 'bromhexine', genericName: 'Bromhexine', aliases: ['bromhexine'], forms: [{
            mode: 'age', label: '4 mg/5 ml', strength: { amount: 4, unit: 'mg' }, timesPerDay: { min: 3, max: 4 }, timing: null, printed: '3-4', notes: [],
            segments: [
                { from: 0, to: 1, fuzzy: [], text: '1.25 ml', amount: { kind: 'ml', min: 1.25, max: 1.25 } },
                { from: 2, to: 4, fuzzy: [5], text: '½ ช้อนชา', amount: { kind: 'tsp', min: 0.5, max: 0.5 } },
                { from: 6, to: 10, fuzzy: [5], text: '1 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 1 } },
                { from: 11, to: 12, fuzzy: [], text: '2 ช้อนชา', amount: { kind: 'tsp', min: 2, max: 2 } }] }] },
        { key: 'glyceryl-guaiacolate', genericName: 'Glyceryl guaiacolate', aliases: ['glyceryl guaiacolate', 'guaifenesin', 'glyceryl guaiacolate (guaifenesin)'], forms: [{
            mode: 'age', label: '100 mg/5 ml', strength: { amount: 100, unit: 'mg' }, timesPerDay: { min: 3, max: 4 }, timing: null, printed: '3-4', notes: [],
            segments: [
                { from: 0, to: 1, fuzzy: [], text: '12 MKD', amount: { kind: 'mkd', min: 12, max: 12 } },
                { from: 2, to: 4, fuzzy: [5], text: '½-1 ช้อนชา', amount: { kind: 'tsp', min: 0.5, max: 1 } },
                { from: 6, to: 12, fuzzy: [5], text: '1-2 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 2 } }] }] },
        { key: 'hyoscine', genericName: 'Hyoscine', aliases: ['hyoscine', 'hyoscine butylbromide', 'scopolamine butylbromide'], forms: [{
            mode: 'age', label: '5 mg/5 ml', strength: { amount: 5, unit: 'mg' }, timesPerDay: { min: 3, max: 3 }, timing: null, printed: '3', notes: [],
            segments: [
                { from: 0, to: 2, fuzzy: [3], text: '1 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 1 } },
                { from: 4, to: 5, fuzzy: [3, 6], text: '1-2 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 2 } },
                { from: 7, to: 12, fuzzy: [6], text: '2-4 ช้อนชา', amount: { kind: 'tsp', min: 2, max: 4 } }] }] },
        { key: 'mom', genericName: 'Magnesium hydroxide (Milk of magnesia)', aliases: ['magnesium hydroxide', 'milk of magnesia', 'mom', 'mom for laxative'], forms: [{
            mode: 'age', label: 'MOM (laxative)', strength: null, timesPerDay: { min: 1, max: 1 }, timing: null, printed: 'วันละครั้ง หรือแบ่งให้เป็นมื้อ',
            notes: ['ต้นฉบับไม่ระบุความเข้มข้นและหน่วยของ “0.5 MKD” (ช่อง 0 ปี) — แสดงตามที่พิมพ์ ไม่คำนวณ'],
            segments: [
                { from: 0, to: 1, fuzzy: [], text: '0.5 MKD', amount: { kind: 'mkd', min: 0.5, max: 0.5, uncomputable: true } },
                { from: 2, to: 5, fuzzy: [], text: '5-15 ml/day', amount: { kind: 'mlday', min: 5, max: 15 } },
                { from: 6, to: 12, fuzzy: [], text: '15-30 ml/day', amount: { kind: 'mlday', min: 15, max: 30 } }] }] },
        { key: 'multivitamin', genericName: 'Multivitamin', aliases: ['multivitamin', 'mtv', 'multivitamin (mtv)'], forms: [{
            mode: 'age', label: 'MTV', strength: null, timesPerDay: { min: 1, max: 1 }, timing: null, printed: '1', notes: [],
            segments: [
                { from: 0, to: 6, fuzzy: [], text: '1 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 1 } },
                { from: 7, to: 12, fuzzy: [], text: '1-2 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 2 } }] }] }
    ];

    // International references: the Medscape monograph of each drug, taken from web-search results on 2026-10-04.
    // The pages themselves could NOT be opened by the tool that looked (HTTP 402), so a link means "this is Medscape's page for the
    // drug", not "every number was re-checked against it". No entry = Medscape has no page for it (not US-marketed, or a vitamin mix):
    // ketotifen, procaterol, bromhexine, hyoscine, multivitamin.
    const MEDSCAPE = {
        'amoxicillin': 'https://reference.medscape.com/drug/amoxil-amoxicillin-342473',
        'augmentin': 'https://reference.medscape.com/drug/augmentin-amoxicillin-clavulanate-342474',
        'azithromycin': 'https://reference.medscape.com/drug/zithromax-zmax-azithromycin-342523',
        'cefaclor': 'https://reference.medscape.com/drug/cefaclor-342494',
        'cefdinir': 'https://reference.medscape.com/drug/cefdinir-342502',
        'cotrimoxazole': 'https://reference.medscape.com/drug/bactrim-trimethoprim-sulfamethoxazole-342543',
        'cpm': 'https://reference.medscape.com/drug/chlortrimeton-chlorpheniramine-343386',
        'dicloxacillin': 'https://reference.medscape.com/drug/dicloxacillin-342477',
        'domperidone': 'https://reference.medscape.com/drug/domperidone-4000456',
        'erythromycin': 'https://reference.medscape.com/drug/ees-eryped-erythromycin-ethylsuccinate-999596',
        'hydroxyzine': 'https://reference.medscape.com/drug/atarax-vistaril-hydroxyzine-343395',
        'ibuprofen': 'https://reference.medscape.com/drug/advil-motrin-ibuprofen-343289',
        'paracetamol': 'https://reference.medscape.com/drug/tylenol-acetaminophen-343346',
        'penicillin-v': 'https://reference.medscape.com/drug/pen-vee-k-penicillin-v-penicillin-vk-342483',
        'pseudoephedrine': 'https://reference.medscape.com/drug/sudafed-nexafed-pseudoephedrine-343412',
        'salbutamol': 'https://reference.medscape.com/drug/proventil-hfa-ventolin-hfa-albuterol-343426',
        'glyceryl-guaiacolate': 'https://reference.medscape.com/drug/mucinex-organidin-nr-guaifenesin-343403',
        'mom': 'https://reference.medscape.com/drug/milk-of-magnesia-magnesium-hydroxide-342018'
    };
    // Where Medscape's search text disagreed with the table (indicative; shown under the calculator). Others: no claim is made.
    const CHECK = {
        'amoxicillin': 'Medscape (US): 20 mg/kg/day แบ่งทุก 8 ชม. หรือ 25 mg/kg/day ทุก 12 ชม. สำหรับติดเชื้อทั่วไป และ 80–90 mg/kg/day แบ่งทุก 12 ชม. สำหรับหูชั้นกลางอักเสบ — ตารางนี้ใช้ 20–50 mg/kg/day ทุก 8 ชม. (ตามอินโฟกราฟิก)',
        'penicillin-v': 'Medscape: 50–75 mg/kg/day แบ่งทุก 6–8 ชม. สำหรับติดเชื้อทั่วร่างกาย (สูงสุด 3 g/day) — ตารางนี้ใช้ 25–50 mg/kg/day',
        'paracetamol': 'Medscape: ให้ได้ไม่เกิน 5 ครั้ง/วัน และไม่เกิน 75 mg/kg/day — ตารางนี้ 10–15 mg/kg ได้ถึง 6 ครั้ง (สูงสุด 90 mg/kg/day) ระวังไม่ให้เกินเพดาน',
        'mom': 'Medscape: ยังไม่ยืนยันความปลอดภัยต่ำกว่า 2 ปี — ช่วง 0–1 ปีในตารางไม่มีใน Medscape (ช่วง 2–5 และ 6–12 ปีตรงกัน)'
    };
    const refsFor = d => (MEDSCAPE[d.key] ? [{ label: 'Medscape', url: MEDSCAPE[d.key] }] : []);
    const refUrls = d => refsFor(d).map(r => r.url);

    // ---- calculator ----
    const TSP_ML = 5;
    const round = (v, d) => { const k = Math.pow(10, d); return Math.round((v + Number.EPSILON) * k) / k; };
    // 1.3 · 2.55 · 0.6 — up to 2 decimals, trailing zeros dropped
    const fmt = v => String(round(v, 2));
    const parseTable = s => String(s).split('-').map(Number);
    const mlPerMg = form => (form.strength ? 5 / form.strength.amount : null);   // ml per mg (or per mcg)

    // By weight: the dose per administration as mg and ml, a range. A "per day" basis is split over the number of doses a day
    // (fewest doses → the larger dose, most doses → the smaller dose); a "per dose" basis is already per administration.
    function calcWeight(form, kg) {
        if (!form || form.mode !== 'weight' || !(kg > 0)) return null;
        const b = form.basis, t = form.timesPerDay;
        const lo = b.per === 'day' ? b.min * kg / t.max : b.min * kg;
        const hi = b.per === 'day' ? b.max * kg / t.min : b.max * kg;
        const unit = form.strength.unit;
        const k = mlPerMg(form);
        return { unit, mgMin: lo, mgMax: hi, mlMin: lo * k, mlMax: hi * k, perDayMin: b.per === 'day' ? b.min * kg : lo * t.min, perDayMax: b.per === 'day' ? b.max * kg : hi * t.max };
    }
    // Source table value (printed) for the weights around kg: exact when kg is a listed weight, else the one below and above.
    function tableNear(form, kg) {
        const ws = Object.keys(form.table).map(Number).sort((a, b) => a - b);
        const exact = ws.find(w => w === kg);
        if (exact != null) return [{ kg: exact, text: form.table[exact] }];
        const below = ws.filter(w => w < kg).pop(), above = ws.find(w => w > kg);
        return [below, above].filter(w => w != null).map(w => ({ kg: w, text: form.table[w] }));
    }
    // By age (whole years): the printed segment. An age on a printed cell edge that cuts its pill in half returns BOTH
    // neighbouring segments with ambiguous:true — the calculator never picks one silently.
    function calcAge(form, age) {
        if (!form || form.mode !== 'age' || !(age >= 0)) return null;
        const sure = form.segments.filter(s => age >= s.from && age <= s.to);
        if (sure.length) return { ambiguous: false, segments: sure };
        const fuzzy = form.segments.filter(s => (s.fuzzy || []).includes(age));
        if (fuzzy.length === 1) return { ambiguous: false, segments: fuzzy };
        return fuzzy.length ? { ambiguous: true, segments: fuzzy } : null;
    }
    // A by-age segment as ml per dose when it can be computed: ml / tsp amounts directly; "MKD" needs the weight and a strength.
    function ageSegmentMl(form, seg, kg) {
        const a = seg.amount;
        if (a.kind === 'ml') return { min: a.min, max: a.max };
        if (a.kind === 'tsp') return { min: a.min * TSP_ML, max: a.max * TSP_ML };
        if (a.kind === 'mkd' && !a.uncomputable && kg > 0 && form.strength) {
            const t = form.timesPerDay, k = mlPerMg(form);
            return { min: a.min * kg / t.max * k, max: a.max * kg / t.min * k };
        }
        return null;
    }
    const timesText = form => (form.timesPerDay.min === form.timesPerDay.max ? String(form.timesPerDay.min) : form.timesPerDay.min + '-' + form.timesPerDay.max) + '×' + (form.timing === 'ac' ? ' ac' : '');

    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
    // Which seed drug a drug_codex genericName / brand belongs to (exact normalised match on name or alias).
    function findSeed(genericName) {
        const n = norm(genericName);
        return DATA.find(d => norm(d.genericName) === n || d.aliases.some(a => norm(a) === n)) || null;
    }
    // The plain-text line for the drug_codex `dosing` field of a newly created doc.
    function dosingText(d) {
        return d.forms.map(f => f.mode === 'weight'
            ? `${d.genericName} ${f.label} — วันละ ${f.printed.replace(/\s*\(.*$/, '')} ครั้ง (${f.basis.min === f.basis.max ? f.basis.min : f.basis.min + '–' + f.basis.max} ${f.basis.unit}/${f.basis.per})`
            : `${d.genericName} ${f.label} — ตามอายุ: ` + f.segments.map(s => `${s.from === s.to ? s.from : s.from + '–' + s.to} ปี ${s.text}`).join(', ')).join('\n');
    }
    const forDoc = d => ({ v: 1, source: SOURCE, refs: refsFor(d), checks: CHECK[d.key] ? [CHECK[d.key]] : [], forms: d.forms });


    // ---- intern UI: the "👶 Pediatric dose" section of the Drug Codex detail (markup only; handlers live in index.html) ----
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = { kg: null, age: null };   // shared across drugs, so the weight typed once stays while browsing
    const range = (lo, hi, d) => (round(lo, d == null ? 2 : d) === round(hi, d == null ? 2 : d) ? fmt(lo) : fmt(lo) + '–' + fmt(hi));
    const basisText = f => `${f.basis.min === f.basis.max ? fmt(f.basis.min) : fmt(f.basis.min) + '–' + fmt(f.basis.max)} ${f.basis.unit}/${f.basis.per}`;
    const note = t => `<div class="dc-peds-note">ℹ️ ${esc(t)}</div>`;

    function weightFormHtml(f, kg) {
        const head = `<div class="dc-peds-head"><b>${esc(f.label)}</b><span>${esc(timesText(f))} · ${esc(basisText(f))}</span></div>`;
        const notes = f.notes.map(note).join('');
        if (!(kg > 0)) return `<div class="dc-peds-form">${head}<div class="dc-peds-res dc-peds-hint">⚖️ kg</div>${notes}</div>`;
        const c = calcWeight(f, kg);
        const mg = range(c.mgMin, c.mgMax, 1) + ' ' + c.unit;
        const tx = tableNear(f, kg).map(t => `${t.kg} kg ${esc(t.text)}`).join(' · ');
        const out = kg < 5 || kg > 25 ? '<div class="dc-peds-note">⚠️ ต้นฉบับมีตารางเฉพาะ 5–25 kg — ค่านี้คำนวณจากสูตร</div>' : '';
        return `<div class="dc-peds-form">${head}<div class="dc-peds-res">👶 <b>${range(c.mlMin, c.mlMax)} ml</b><small>${mg} /dose · ${esc(timesText(f))}/day</small></div>` +
            `<div class="dc-peds-ref" title="Source table (ml per dose)">📋 ${tx}</div>${out}${notes}</div>`;
    }
    function ageFormHtml(f, age, kg) {
        const head = `<div class="dc-peds-head"><b>${esc(f.label)}</b><span>${esc(f.printed)}${f.timing === 'ac' ? ' ac' : ''}</span></div>`;
        const notes = f.notes.map(note).join('');
        if (!(age >= 0)) return `<div class="dc-peds-form">${head}<div class="dc-peds-res dc-peds-hint">🎂 0–12</div>${notes}</div>`;
        const r = calcAge(f, age);
        if (!r) return `<div class="dc-peds-form">${head}<div class="dc-peds-note">⚠️ ต้นฉบับมีตารางเฉพาะอายุ 0–12 ปี</div>${notes}</div>`;
        const line = seg => {
            const ml = ageSegmentMl(f, seg, kg);
            const mlText = seg.amount.kind === 'tsp' && ml ? ` <small>= ${range(ml.min, ml.max)} ml</small>`
                : seg.amount.kind === 'mkd' && ml ? ` <small>= ${range(ml.min, ml.max)} ml /dose · ${esc(timesText(f))}/day</small>`
                : seg.amount.kind === 'mkd' && !seg.amount.uncomputable && !(kg > 0) ? ' <small>⚖️ kg</small>' : '';
            return `<div class="dc-peds-res">👶 <b>${esc(seg.text)}</b>${mlText}</div>`;
        };
        const warn = r.ambiguous ? `<div class="dc-peds-note">⚠️ ${age} ปี อยู่ตรงขอบเซลล์ของต้นฉบับ — อาจเป็นช่วงใดช่วงหนึ่ง ตรวจสอบกับเภสัชกร</div>` : '';
        return `<div class="dc-peds-form">${head}${r.segments.map(line).join('')}${warn}${notes}</div>`;
    }
    function formsHtml(doc, st) {
        return (doc.forms || []).map(f => f.mode === 'weight' ? weightFormHtml(f, st.kg) : ageFormHtml(f, st.age, st.kg)).join('');
    }
    // Inputs depend on the forms: kg for weight forms (and for age cells in "MKD"), a 0-12 age pick for age forms.
    function sectionBodyHtml(drugId, doc, st) {
        const forms = doc.forms || [];
        const needKg = forms.some(f => f.mode === 'weight' || (f.segments || []).some(s => s.amount.kind === 'mkd' && !s.amount.uncomputable));
        const needAge = forms.some(f => f.mode === 'age');
        const ages = Array.from({ length: 13 }, (_, i) => `<option value="${i}"${st.age === i ? ' selected' : ''}>${i}</option>`).join('');
        const inputs = '<div class="dc-peds-inputs lang-no-toggle">' +
            (needKg ? `<label title="Body weight (kg)" data-th-title="น้ำหนักตัว (กก.)">⚖️ <input type="number" class="dc-peds-kg" inputmode="decimal" min="0.5" max="150" step="0.1" placeholder="kg" value="${st.kg > 0 ? esc(st.kg) : ''}" oninput="dcPedsInput(this)"> kg</label>` : '') +
            (needAge ? `<label title="Age in whole years" data-th-title="อายุ (ปีเต็ม)">🎂 <select class="dc-peds-age" onchange="dcPedsInput(this)"><option value=""${st.age == null ? ' selected' : ''}>—</option>${ages}</select> ปี</label>` : '') + '</div>';
        const refs = (doc.refs || []).filter(r => r && /^https:\/\//.test(r.url || ''))
            .map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label || 'Reference')} ↗</a>`).join(' · ');
        const checks = (doc.checks || []).map(c => `<div class="dc-peds-note">⚠️ ${esc(c)}</div>`).join('');
        return `<div class="dc-peds lang-no-toggle" data-drug-id="${esc(drugId)}">${inputs}<div class="dc-peds-forms">${formsHtml(doc, st)}</div>${checks}` +
            `<div class="dc-peds-foot">อ้างอิง: ${refs || '—'} · ขนาดยาอาจเปลี่ยนแปลงได้ตามโรค ควรปรึกษาแพทย์หรือเภสัชกรทุกครั้งก่อนใช้ยา</div></div>`;
    }
    const hasPeds = d => !!(d && d.pedsDosing && Array.isArray(d.pedsDosing.forms) && d.pedsDosing.forms.length);

    return { DATA, SOURCE, TSP_ML, calcWeight, tableNear, calcAge, ageSegmentMl, parseTable, fmt, round, timesText, findSeed, dosingText, forDoc, norm, state, formsHtml, sectionBodyHtml, hasPeds, MEDSCAPE, CHECK, refsFor, refUrls };
});
