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
    const SOURCE = 'ตัวเลขจากอินโฟกราฟิก Pharmtutors "ขนาดยาที่ใช้ในเด็ก" และ Ped-in-a-page "Common drug use in pediatrics"; ลิงก์อ้างอิง: Medscape Drug Reference';
    const W = (a, b, c, d, e) => ({ 5: a, 10: b, 15: c, 20: d, 25: e });
    const weight = (label, amount, unit, times, timing, basis, printed, table, notes) =>
        ({ mode: 'weight', label, strength: { amount, unit }, timesPerDay: { min: times[0], max: times[times.length - 1] }, timing, basis, printed, table, notes: notes || [] });
    const day = (min, max) => ({ per: 'day', unit: 'mg/kg', min, max: max == null ? min : max });
    const dose = (min, max, unit) => ({ per: 'dose', unit: unit || 'mg/kg', min, max: max == null ? min : max });

    // ---- second infographic: Ped-in-a-page "Common drug use in pediatrics" — only the rows with the orange O (oral form) ----
    // It gives mg/kg and an interval but no strength (mg/5 ml): those drugs get a "mgkg" / "bands" form and the reader may type the
    // strength to get ml. Doses per day from the printed interval:
    const IV = { 'OD': [1, 1], 'BID': [2, 2], 'TID': [3, 3], 'QID': [4, 4], 'HS': [1, 1], 'OD-BID': [1, 2], 'BID-TID': [2, 3], 'TID-QID': [3, 4],
        'q 6 hr': [4, 4], 'q 8 hr': [3, 3], 'q 12 hr': [2, 2], 'q 4-6 hr': [4, 6], 'q 4-8 hr': [3, 6], 'q 6-8 hr': [3, 4], 'q 12-24 hr': [1, 2], 'BID / q 6-8 hr': [2, 4] };
    const itv = t => (t ? { text: t, min: IV[t][0], max: IV[t][1] } : null);
    const R = (a, b) => ({ min: a, max: b == null ? a : b });
    const seq = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    // mg/kg lines: ln(label, min, max, 'day'|'dose', 'mg/kg'|'ml/kg', interval, { usual, cap:{amount,unit}, printed, duration })
    const mgkg = (label, lines, notes) => ({ mode: 'mgkg', label, lines, notes: notes || [] });
    const ln = (label, min, max, per, unit, interval, extra) => Object.assign({ label, basis: { per, unit, min, max: max == null ? min : max }, interval: itv(interval) }, extra || {});
    // bands: a list of printed age / weight / any rows, each with { mg:R() } (per dose), { ml:R() } (per dose) or { basis:R() } (mg/kg/day)
    const bandForm = (label, interval, duration, list, notes) => ({ mode: 'bands', label, interval: itv(interval), duration: duration || null, bands: list, notes: notes || [] });
    const ageBand = (text, ages, fuzzy, amount) => Object.assign({ by: 'age', text, ages, fuzzy }, amount);
    const kgBand = (text, kg, amount) => Object.assign({ by: 'weight', text, kg }, amount);
    const anyBand = (text, amount) => Object.assign({ by: 'any', text }, amount);

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
                { from: 7, to: 12, fuzzy: [], text: '1-2 ช้อนชา', amount: { kind: 'tsp', min: 1, max: 2 } }] }] },

        // ---- Ped-in-a-page (oral rows not already above) ----
        { key: 'clarithromycin', genericName: 'Clarithromycin', aliases: ['clarithromycin'], forms: [mgkg('oral', [ln('', 15, 15, 'day', 'mg/kg', 'BID')])] },
        { key: 'cefixime', genericName: 'Cefixime', aliases: ['cefixime'], forms: [mgkg('oral', [ln('', 8, 8, 'day', 'mg/kg', 'BID')])] },
        { key: 'metronidazole', genericName: 'Metronidazole', aliases: ['metronidazole'], forms: [mgkg('oral', [ln('', 30, 40, 'day', 'mg/kg', 'q 8 hr')])] },
        { key: 'doxycycline', genericName: 'Doxycycline', aliases: ['doxycycline'], forms: [mgkg('oral', [ln('', 2, 5, 'day', 'mg/kg', 'BID')])] },
        { key: 'oseltamivir', genericName: 'Oseltamivir', aliases: ['oseltamivir'], forms: [bandForm('oral', 'BID', 'x 5 days', [
            ageBand('< 3 mo', [0], [], { mg: R(12) }), ageBand('3-6 mo', [0], [], { mg: R(20) }), ageBand('6-12 mo', [0], [], { mg: R(25) }),
            kgBand('< 15 kg', { hi: 15, hiOpen: true }, { mg: R(30) }), kgBand('16-23 kg', { lo: 16, hi: 23 }, { mg: R(45) }),
            kgBand('24-44 kg', { lo: 24, hi: 44 }, { mg: R(60) }), kgBand('> 45 kg', { lo: 45, loOpen: true }, { mg: R(75) })],
            ['ต้นฉบับแบ่งช่วงเดือน (< 1 ปี) และช่วงน้ำหนัก; น้ำหนัก 15-16, 23-24, 44-45 kg อยู่ระหว่างช่วงที่พิมพ์ (แสดงทั้งสองช่วงข้างเคียง)'])] },
        { key: 'acyclovir', genericName: 'Acyclovir', aliases: ['acyclovir', 'aciclovir'], forms: [mgkg('oral', [ln('', 30, 30, 'day', 'mg/kg', 'q 4-8 hr')])] },
        { key: 'ketoconazole', genericName: 'Ketoconazole', aliases: ['ketoconazole'], forms: [mgkg('oral', [ln('', 3.3, 6.6, 'day', 'mg/kg', 'OD')])] },
        { key: 'albendazole', genericName: 'Albendazole', aliases: ['albendazole'], forms: [bandForm('oral', 'OD', 'x 3 days', [anyBand('400 mg/dose', { mg: R(400) })])] },
        { key: 'isoniazid', genericName: 'Isoniazid', aliases: ['isoniazid', 'inh'], forms: [mgkg('oral', [ln('', 10, 15, 'day', 'mg/kg', 'HS', { usual: 10, cap: { amount: 300, unit: 'mg' }, printed: '10 (10-15) max 300' })])] },
        { key: 'rifampicin', genericName: 'Rifampicin', aliases: ['rifampicin', 'rifampin'], forms: [mgkg('oral', [ln('', 10, 20, 'day', 'mg/kg', 'HS', { usual: 15, cap: { amount: 600, unit: 'mg' }, printed: '15 (10-20) max 600' })])] },
        { key: 'pyrazinamide', genericName: 'Pyrazinamide', aliases: ['pyrazinamide'], forms: [mgkg('oral', [ln('', 30, 40, 'day', 'mg/kg', 'HS', { usual: 35, cap: { amount: 2000, unit: 'mg' }, printed: '35 (30-40) max 2 g' })])] },
        { key: 'ethambutol', genericName: 'Ethambutol', aliases: ['ethambutol'], forms: [mgkg('oral', [ln('', 15, 25, 'day', 'mg/kg', 'HS', { usual: 20, cap: { amount: 1200, unit: 'mg' }, printed: '20 (15-25) max 1.2 g' })])] },
        { key: 'omeprazole', genericName: 'Omeprazole', aliases: ['omeprazole'], forms: [mgkg('oral', [ln('', 1, 2, 'day', 'mg/kg', 'q 12-24 hr')])] },
        { key: 'ranitidine', genericName: 'Ranitidine', aliases: ['ranitidine'], forms: [mgkg('oral', [ln('', 2, 4, 'day', 'mg/kg', 'BID / q 6-8 hr')])] },
        { key: 'dimenhydrinate', genericName: 'Dimenhydrinate', aliases: ['dimenhydrinate'], forms: [mgkg('oral', [ln('', 5, 5, 'day', 'mg/kg', 'q 6 hr')])] },
        { key: 'bisacodyl', genericName: 'Bisacodyl', aliases: ['bisacodyl'], forms: [mgkg('oral', [ln('', 0.3, 0.3, 'day', 'mg/kg', 'HS')])] },
        { key: 'lactulose', genericName: 'Lactulose', aliases: ['lactulose'], forms: [mgkg('oral', [ln('', 1, 3, 'day', 'ml/kg', 'OD-BID')])] },
        { key: 'alum-milk', genericName: 'Aluminium hydroxide (alum milk)', aliases: ['aluminium hydroxide', 'aluminum hydroxide', 'alum milk', 'aluminium hydroxide (alum milk)'], forms: [bandForm('oral', 'q 6-8 hr', null, [anyBand('5-15 ml/dose', { ml: R(5, 15) })])] },
        { key: 'simethicone', genericName: 'Simethicone', aliases: ['simethicone', 'simeticone'], forms: [bandForm('oral', 'QID', null, [
            ageBand('< 1 yr', [0], [], { mg: R(20) }), ageBand('1-12 yr', seq(1, 12), [], { mg: R(40) }), ageBand('> 12 yr', [], [], { mg: R(40, 1200) })],
            ['ต้นฉบับพิมพ์ "> 12 yr: 40-1200 mg" — สูงผิดปกติ น่าจะพิมพ์ผิด (อาจเป็น 40-120); แสดงตามที่พิมพ์ ตรวจสอบกับเภสัชกร'])] },
        { key: 'carbocysteine', genericName: 'Carbocysteine', aliases: ['carbocysteine', 'carbocisteine'], forms: [
            mgkg('> 1 month', [ln('> 1 mo', 20, 30, 'day', 'mg/kg', 'OD-BID')]),
            bandForm('2-12 yr', 'TID', null, [ageBand('2-5 yr', seq(2, 5), [], { mg: R(62.5, 125) }), ageBand('6-12 yr', seq(6, 12), [], { mg: R(100, 250) })])] },
        { key: 'cetirizine', genericName: 'Cetirizine', aliases: ['cetirizine'], forms: [bandForm('oral', 'OD', null, [
            ageBand('6 mo-2 yr', [1], [0], { mg: R(2.5) }), ageBand('2-5 yr', seq(2, 5), [6], { mg: R(2.5, 5) }), ageBand('> 6 yr', seq(7, 12), [6], { mg: R(5, 10) })],
            ['ต้นฉบับแบ่ง "2-5 yr" และ "> 6 yr" ทำให้อายุ 6 ปีอยู่ระหว่างช่วง (แสดงทั้งสองช่วง); "6 mo-2 yr" ใช้กับอายุ 6 เดือนขึ้นไปเท่านั้น'])] },
        { key: 'phenytoin', genericName: 'Phenytoin', aliases: ['phenytoin'], forms: [mgkg('maintenance', [ln('maintenance', 5, 10, 'day', 'mg/kg', 'BID-TID')])] },
        { key: 'phenobarbital', genericName: 'Phenobarbital', aliases: ['phenobarbital', 'phenobarbitone'], forms: [bandForm('maintenance', null, null, [
            ageBand('NB-infant', [0], [], { basis: R(3, 5) }), ageBand('1-5 yr', seq(1, 5), [], { basis: R(4, 8) }),
            ageBand('6-12 yr', seq(6, 12), [], { basis: R(4, 6) }), ageBand('> 12 yr', [], [], { basis: R(1, 3) })],
            ['ต้นฉบับไม่ระบุความถี่ของขนาดบำรุงรักษา — แสดงเป็น mg/วัน'])] },
        { key: 'valproic-acid', genericName: 'Valproic acid', aliases: ['valproic acid', 'valproate', 'sodium valproate'], forms: [mgkg('maintenance', [ln('maintenance', 20, 60, 'day', 'mg/kg', 'BID-TID')])] },
        { key: 'levetiracetam', genericName: 'Levetiracetam', aliases: ['levetiracetam'], forms: [mgkg('maintenance', [ln('maintenance', 20, 80, 'day', 'mg/kg', null)], ['ต้นฉบับไม่ระบุความถี่ — แสดงเป็น mg/วัน'])] }
    ];

    // The same drug in the second infographic where our first source already has it — printed as is, shown beside the result.
    const ALT_LABEL = 'Ped-in-a-page';
    const ALT = {
        'amoxicillin': ['25-50 mkday TID', '80-90 mkday (high dose) BID'],
        'erythromycin': ['20-50 mkday TID'],
        'azithromycin': ['10 mkday OD x 5 days'],
        'dicloxacillin': ['25-50 mkday QID'],
        'cefdinir': ['14 mkday BID'],
        'cotrimoxazole': ['8-12 mkday (mild infection) q 12 hr', '20 mkday (severe infection) q 12 hr', '2-4 mkday (UTI prophylaxis) HS'],
        'domperidone': ['0.1-0.2 mkdose TID'],
        'paracetamol': ['10-15 mkdose PRN q 4-6 hr'],
        'ibuprofen': ['5-10 mkdose PRN q 6-8 hr'],
        'salbutamol': ['0.1 mkdose q 4-6 hr'],
        'cpm': ['0.35 mkday TID-QID'],
        'hydroxyzine': ['2 mkday TID-QID'],
        'pseudoephedrine': ['4 mkday QID'],
        'bromhexine': ['2-4 mkday TID']
    };

    // International references: the Medscape monograph of each drug, taken from web-search results on 2026-10-04.
    // The pages themselves could NOT be opened by the tool that looked (HTTP 402), so a link means "this is Medscape's page for the
    // drug", not "every number was re-checked against it". No entry = Medscape has no page for it (not US-marketed, a vitamin mix, or only an IV product):
    // ketotifen, procaterol, bromhexine, hyoscine, multivitamin, carbocysteine, phenobarbital.
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
        'mom': 'https://reference.medscape.com/drug/milk-of-magnesia-magnesium-hydroxide-342018',
        'clarithromycin': 'https://reference.medscape.com/drug/clarithromycin-342524',
        'cefixime': 'https://reference.medscape.com/drug/suprax-cefixime-342503',
        'metronidazole': 'https://reference.medscape.com/drug/flagyl-metronidazole-342566',
        'doxycycline': 'https://reference.medscape.com/drug/vibramycin-doryx-doxycycline-342548',
        'oseltamivir': 'https://reference.medscape.com/drug/tamiflu-oseltamivir-342618',
        'acyclovir': 'https://reference.medscape.com/drug/zovirax-acyclovir-342601',
        'ketoconazole': 'https://reference.medscape.com/drug/nizoral-ketoconazole-342592',
        'albendazole': 'https://reference.medscape.com/drug/albendazole-342648',
        'isoniazid': 'https://reference.medscape.com/drug/isoniazid-342564',
        'rifampicin': 'https://reference.medscape.com/drug/rifadin-rimactane-rifampin-342570',
        'pyrazinamide': 'https://reference.medscape.com/drug/pyrazinamide-342678',
        'ethambutol': 'https://reference.medscape.com/drug/myambutol-ethambutol-342677',
        'omeprazole': 'https://reference.medscape.com/drug/prilosec-omeprazole-341997',
        'ranitidine': 'https://reference.medscape.com/drug/zantac-ranitidine-342003',
        'dimenhydrinate': 'https://reference.medscape.com/drug/dramamine-dimenhydrinate-342045',
        'bisacodyl': 'https://reference.medscape.com/drug/dulcolax-correctol-bisacodyl-342008',
        'lactulose': 'https://reference.medscape.com/drug/enulose-kristalose-lactulose-342016',
        'alum-milk': 'https://reference.medscape.com/drug/alternagel-amphojel-aluminum-hydroxide-341981',
        'simethicone': 'https://reference.medscape.com/drug/mylicon-phazyme-simethicone-342005',
        'cetirizine': 'https://reference.medscape.com/drug/quzyttir-zyrtec-cetirizine-343384',
        'phenytoin': 'https://reference.medscape.com/drug/dilantin-phenytek-phenytoin-343019',
        'valproic-acid': 'https://reference.medscape.com/drug/valproic-acid-343024',
        'levetiracetam': 'https://reference.medscape.com/drug/keppra-spritam-levetiracetam-343013'
    };
    // Where Medscape's search text disagreed with the table (indicative; shown under the calculator). Others: no claim is made.
    const CHECK = {
        'amoxicillin': 'Medscape (US): 20 mg/kg/day แบ่งทุก 8 ชม. หรือ 25 mg/kg/day ทุก 12 ชม. สำหรับติดเชื้อทั่วไป และ 80–90 mg/kg/day แบ่งทุก 12 ชม. สำหรับหูชั้นกลางอักเสบ — ตารางนี้ใช้ 20–50 mg/kg/day ทุก 8 ชม. (ตามอินโฟกราฟิก)',
        'penicillin-v': 'Medscape: 50–75 mg/kg/day แบ่งทุก 6–8 ชม. สำหรับติดเชื้อทั่วร่างกาย (สูงสุด 3 g/day) — ตารางนี้ใช้ 25–50 mg/kg/day',
        'paracetamol': 'Medscape: ให้ได้ไม่เกิน 5 ครั้ง/วัน และไม่เกิน 75 mg/kg/day — ตารางนี้ 10–15 mg/kg ได้ถึง 6 ครั้ง (สูงสุด 90 mg/kg/day) ระวังไม่ให้เกินเพดาน',
        'pyrazinamide': 'Medscape: 15–30 mg/kg/day (สูงสุด 2 g/วัน) — ตารางนี้ 30–40 (ปกติ 35) mg/kg/day',
        'ethambutol': 'Medscape: สูงสุด 1 g/วัน — ตารางนี้สูงสุด 1.2 g (ช่วง 15–25 mg/kg/day ตรงกัน)',
        'omeprazole': 'Medscape: ขนาดคงที่วันละครั้งตามช่วงน้ำหนัก (ประมาณ 0.5–1 mg/kg) — ตารางนี้ 1–2 mg/kg/day',
        'ranitidine': 'Medscape: 2–4 mg/kg ต่อครั้ง ทุก 12 ชม. (4–8 mg/kg/day) — ตารางนี้ 2–4 mg/kg/day',
        'simethicone': 'Medscape: > 12 ปี 40–360 mg ต่อครั้ง สูงสุด 500 mg/วัน — "40-1200 mg" ในตารางนี้น่าจะพิมพ์ผิด',
        'cetirizine': 'Medscape: ยากินเริ่มที่อายุ 2 ปีขึ้นไป — ช่วง 6 เดือน–2 ปีในตารางนี้ไม่มีใน Medscape (ช่วงอื่นตรงกัน)',
        'levetiracetam': 'Medscape: เป้าหมาย 60 mg/kg/day (สูงสุด 3,000 mg/วัน) — ตารางนี้สูงถึง 80 mg/kg/day',
        'oseltamivir': 'Medscape: ทารกให้ 3 mg/kg ต่อครั้ง และแบ่งช่วงน้ำหนัก 23–40 / > 40 kg — ตารางนี้ใช้ขนาดคงที่ตามเดือนอายุและช่วง 24–44 / > 45 kg',
        'acyclovir': 'Medscape (อีสุกอีใส): 80 mg/kg/day แบ่งทุก 6 ชม. — ตารางนี้ 30 mg/kg/day (ขึ้นกับข้อบ่งใช้)',
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

    // mg/kg lines (second infographic). A per-day basis is split over the printed doses a day; a cap ("max 300") limits the top.
    // `interval` may be unprinted (null) — then only the daily amount exists. mg → ml needs the strength (mg per 5 ml) typed by the reader.
    function calcMgkg(line, kg, conc) {
        if (!line || !(kg > 0)) return null;
        const b = line.basis, t = line.interval;
        const unit = b.unit.indexOf('ml') === 0 ? 'ml' : 'mg';
        let dayLo = b.per === 'day' ? b.min * kg : (t ? b.min * kg * t.min : null);
        let dayHi = b.per === 'day' ? b.max * kg : (t ? b.max * kg * t.max : null);
        let doseLo = b.per === 'dose' ? b.min * kg : (t ? b.min * kg / t.max : null);
        let doseHi = b.per === 'dose' ? b.max * kg : (t ? b.max * kg / t.min : null);
        let capped = false;
        if (line.cap && unit === 'mg') {
            const c = line.cap.amount;
            if (dayHi != null && dayHi > c) { dayHi = c; capped = true; }
            if (dayLo != null && dayLo > c) dayLo = c;
            if (doseHi != null && doseHi > c / (t ? t.min : 1)) { doseHi = c / (t ? t.min : 1); capped = true; }
            if (doseLo != null && doseLo > doseHi) doseLo = doseHi;
        }
        const ml = v => (unit === 'mg' && conc > 0 && v != null ? v * 5 / conc : null);
        return { unit, doseLo, doseHi, dayLo, dayHi, capped, mlLo: ml(doseLo), mlHi: ml(doseHi) };
    }
    const within = (v, b) => (b.lo == null || (b.loOpen ? v > b.lo : v >= b.lo)) && (b.hi == null || (b.hiOpen ? v < b.hi : v <= b.hi));
    // Which printed band(s) fit the typed weight / age. A weight in a gap between printed bands, an age on a half-cut cell, or several
    // bands for one age (infant months) return every candidate with ambiguous:true — never one picked silently.
    function matchBands(form, kg, age) {
        const out = { age: null, weight: null, any: form.bands.filter(b => b.by === 'any') };
        const ab = form.bands.filter(b => b.by === 'age');
        if (ab.length && age >= 0) {
            const sure = ab.filter(b => b.ages.includes(age));
            const all = sure.concat(ab.filter(b => !sure.includes(b) && (b.fuzzy || []).includes(age)));
            out.age = all.length ? { bands: all, ambiguous: all.length > 1 } : null;
        }
        const wb = form.bands.filter(b => b.by === 'weight');
        if (wb.length && kg > 0) {
            const inside = wb.filter(b => within(kg, b.kg));
            if (inside.length) out.weight = { bands: inside, ambiguous: inside.length > 1 };
            else {
                const below = wb.filter(b => b.kg.hi != null && b.kg.hi <= kg).sort((x, y) => y.kg.hi - x.kg.hi)[0];
                const above = wb.filter(b => b.kg.lo != null && b.kg.lo >= kg).sort((x, y) => x.kg.lo - y.kg.lo)[0];
                const nb = [below, above].filter(Boolean);
                out.weight = nb.length ? { bands: nb, ambiguous: nb.length > 1 } : null;
            }
        }
        return out;
    }
    // One band's amount: per dose in mg or ml (+ ml from a typed strength), or mg/day from a mg/kg/day basis.
    function bandAmount(band, kg, conc) {
        if (band.mg) return { kind: 'mg', lo: band.mg.min, hi: band.mg.max, ml: conc > 0 ? [band.mg.min * 5 / conc, band.mg.max * 5 / conc] : null };
        if (band.ml) return { kind: 'ml', lo: band.ml.min, hi: band.ml.max, ml: null };
        if (band.basis) return kg > 0 ? { kind: 'mgday', lo: band.basis.min * kg, hi: band.basis.max * kg, ml: null } : { kind: 'needkg' };
        return null;
    }

    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
    // Which seed drug a drug_codex genericName / brand belongs to (exact normalised match on name or alias).
    function findSeed(genericName) {
        const n = norm(genericName);
        return DATA.find(d => norm(d.genericName) === n || d.aliases.some(a => norm(a) === n)) || null;
    }
    // The plain-text line for the drug_codex `dosing` field of a newly created doc.
    function dosingText(d) {
        return d.forms.map(f => f.mode === 'mgkg'
            ? `${d.genericName} ${f.label} — ` + f.lines.map(l => `${l.label ? l.label + ': ' : ''}${l.basis.min === l.basis.max ? l.basis.min : l.basis.min + '–' + l.basis.max} ${l.basis.unit}/${l.basis.per}${l.usual ? ` (usual ${l.usual})` : ''}${l.cap ? `, max ${l.cap.amount} ${l.cap.unit}` : ''}${l.interval ? ' ' + l.interval.text : ''}`).join('; ')
            : f.mode === 'bands'
            ? `${d.genericName} ${f.label} — ` + f.bands.map(b => b.text + (b.by === 'any' ? '' : b.mg ? ' ' + (b.mg.min === b.mg.max ? b.mg.min : b.mg.min + '–' + b.mg.max) + ' mg' : b.ml ? ' ' + (b.ml.min === b.ml.max ? b.ml.min : b.ml.min + '–' + b.ml.max) + ' ml' : b.basis ? ' ' + b.basis.min + '–' + b.basis.max + ' mg/kg/day' : '')).join(', ') + (f.interval ? ` ${f.interval.text}` : '') + (f.duration ? ` ${f.duration}` : '')
            : f.mode === 'weight'
            ? `${d.genericName} ${f.label} — วันละ ${f.printed.replace(/\s*\(.*$/, '')} ครั้ง (${f.basis.min === f.basis.max ? f.basis.min : f.basis.min + '–' + f.basis.max} ${f.basis.unit}/${f.basis.per})`
            : `${d.genericName} ${f.label} — ตามอายุ: ` + f.segments.map(s => `${s.from === s.to ? s.from : s.from + '–' + s.to} ปี ${s.text}`).join(', ')).join('\n');
    }
    const forDoc = d => ({ v: 1, source: SOURCE, refs: refsFor(d), checks: CHECK[d.key] ? [CHECK[d.key]] : [], alt: ALT[d.key] ? { label: ALT_LABEL, lines: ALT[d.key] } : null, forms: d.forms });


    // ---- intern UI: the "👶 Pediatric dose" section of the Drug Codex detail (markup only; handlers live in index.html) ----
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = { kg: null, age: null, conc: {} };   // kg / age are shared across drugs, so what was typed once stays while browsing; conc = mg per 5 ml, per drug
    const concKey = id => 'peds_conc_' + id;
    function getConc(id) {
        if (state.conc[id] === undefined) { let v = null; try { v = parseFloat(localStorage.getItem(concKey(id))); } catch (e) { /* storage may be blocked */ } state.conc[id] = v > 0 ? v : null; }
        return state.conc[id];
    }
    function setConc(id, v) {
        state.conc[id] = v > 0 && v <= 100000 ? v : null;
        try { if (state.conc[id]) localStorage.setItem(concKey(id), String(state.conc[id])); else localStorage.removeItem(concKey(id)); } catch (e) { /* storage may be blocked */ }
    }
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
    const intervalText = it => (it ? it.text : '');
    // mg/kg forms: dose per administration + per day (+ ml from a typed strength). An unprinted interval leaves only the daily amount.
    function mgkgFormHtml(f, kg, conc) {
        const notes = f.notes.map(note).join('');
        const rows = f.lines.map(l => {
            const head = `<div class="dc-peds-head"><b>${esc(l.label || f.label)}</b><span>${esc(basisText(l))}${l.usual ? ` · usual ${fmt(l.usual)}` : ''}${l.cap ? ` · max ${fmt(l.cap.amount)} ${esc(l.cap.unit)}` : ''}${l.interval ? ' · ' + esc(intervalText(l.interval)) : ''}</span></div>`;
            if (!(kg > 0)) return `<div class="dc-peds-form">${head}<div class="dc-peds-res dc-peds-hint">⚖️ kg</div></div>`;
            const c = calcMgkg(l, kg, conc);
            const u = c.unit;
            const dose = c.doseLo != null ? `<div class="dc-peds-res">👶 <b>${range(c.doseLo, c.doseHi, 1)} ${u}</b><small>/dose · ${l.interval.min === l.interval.max ? l.interval.min : l.interval.min + '-' + l.interval.max}×/day${l.duration ? ' ' + esc(l.duration) : ''}</small></div>` : '';
            const day = c.dayLo != null ? `<div class="${c.doseLo != null ? 'dc-peds-ref' : 'dc-peds-res'}">${c.doseLo != null ? '📋 ' : '👶 '}${c.doseLo != null ? '' : '<b>'}${range(c.dayLo, c.dayHi, 1)} ${u}/day${c.doseLo != null ? '' : '</b>'}</div>` : '';
            const ml = c.mlLo != null ? `<div class="dc-peds-res">🧪 <b>${range(c.mlLo, c.mlHi)} ml</b><small>/dose · ${fmt(conc)} mg/5 ml</small></div>` : '';
            const cap = c.capped ? `<div class="dc-peds-note">⚠️ ถึงขนาดสูงสุดที่ต้นฉบับกำหนด (${fmt(l.cap.amount)} ${esc(l.cap.unit)}) — ใช้ค่าสูงสุดแทน</div>` : '';
            return `<div class="dc-peds-form">${head}${dose}${day}${ml}${cap}</div>`;
        });
        return rows.join('') + (notes ? `<div class="dc-peds-formnotes">${notes}</div>` : '');
    }
    // Bands (age / weight / any): the printed list stays visible; the band(s) that fit what was typed are highlighted and calculated.
    function bandText(b, f, kg, conc) {
        const a = bandAmount(b, kg, conc);
        if (!a) return esc(b.text);
        if (a.kind === 'needkg') return `${esc(b.text)} <b>${fmt(b.basis.min)}–${fmt(b.basis.max)} mg/kg/day</b> <small>⚖️ kg</small>`;
        const unit = a.kind === 'ml' ? 'ml' : a.kind === 'mgday' ? 'mg/day' : 'mg';
        const times = a.kind === 'mg' && f.interval ? ` · ${f.interval.min === f.interval.max ? f.interval.min : f.interval.min + '-' + f.interval.max}×/day` : '';
        const ml = a.ml ? ` <small>= ${range(a.ml[0], a.ml[1])} ml</small>` : '';
        return `${esc(b.text)} <b>${range(a.lo, a.hi, 1)} ${unit}</b>${ml}<small>${times}${a.kind === 'mg' && f.duration ? ' ' + esc(f.duration) : ''}</small>`;
    }
    function bandsFormHtml(f, st, conc) {
        const head = `<div class="dc-peds-head"><b>${esc(f.label)}</b><span>${esc(intervalText(f.interval))}${f.duration ? ' ' + esc(f.duration) : ''}</span></div>`;
        const m = matchBands(f, st.kg, st.age);
        const hits = new Set([].concat((m.age && m.age.bands) || [], (m.weight && m.weight.bands) || [], m.any));
        const list = f.bands.map(b => `<div class="dc-peds-band${hits.has(b) ? ' on' : ''}">${bandText(b, f, st.kg, conc)}</div>`).join('');
        const pick = [m.age, m.weight].filter(Boolean);
        const warn = pick.some(x => x.ambiguous) ? '<div class="dc-peds-note">⚠️ อายุ/น้ำหนักนี้อยู่ตรงขอบหรือระหว่างช่วงที่ต้นฉบับพิมพ์ — แสดงทุกช่วงที่ใกล้เคียง ตรวจสอบกับเภสัชกร</div>' : '';
        const none = ((f.bands.some(b => b.by === 'age') && st.age >= 0 && !m.age) || (f.bands.some(b => b.by === 'weight') && st.kg > 0 && !m.weight)) && !pick.length
            ? '<div class="dc-peds-note">⚠️ อายุ/น้ำหนักนี้อยู่นอกช่วงที่ต้นฉบับพิมพ์</div>' : '';
        const notes = f.notes.map(note).join('');
        return `<div class="dc-peds-form">${head}${list}${warn}${none}${notes}</div>`;
    }
    function formsHtml(doc, st, drugId) {
        const conc = drugId ? getConc(drugId) : null;
        const body = (doc.forms || []).map(f => f.mode === 'weight' ? weightFormHtml(f, st.kg)
            : f.mode === 'age' ? ageFormHtml(f, st.age, st.kg)
            : f.mode === 'mgkg' ? mgkgFormHtml(f, st.kg, conc)
            : f.mode === 'bands' ? bandsFormHtml(f, st, conc) : '').join('');
        const alt = doc.alt && doc.alt.lines && doc.alt.lines.length
            ? `<div class="dc-peds-alt" title="The same drug in a second source, printed as is">📋 ${esc(doc.alt.label || 'Other source')}: ${doc.alt.lines.map(esc).join(' · ')}</div>` : '';
        return body + alt;
    }
    // Inputs depend on the forms: kg for weight forms (and for age cells in "MKD"), a 0-12 age pick for age forms.
    function sectionBodyHtml(drugId, doc, st) {
        const forms = doc.forms || [];
        const needKg = forms.some(f => f.mode === 'weight' || f.mode === 'mgkg' || (f.bands || []).some(b => b.by === 'weight' || b.basis) || (f.segments || []).some(s => s.amount.kind === 'mkd' && !s.amount.uncomputable));
        const needAge = forms.some(f => f.mode === 'age' || (f.bands || []).some(b => b.by === 'age'));
        const needConc = forms.some(f => (f.mode === 'mgkg' && f.lines.some(l => l.basis.unit.indexOf('ml') !== 0)) || (f.mode === 'bands' && f.bands.some(b => b.mg)));
        const conc = needConc ? getConc(drugId) : null;
        const ages = Array.from({ length: 13 }, (_, i) => `<option value="${i}"${st.age === i ? ' selected' : ''}>${i}</option>`).join('');
        const inputs = '<div class="dc-peds-inputs lang-no-toggle">' +
            (needKg ? `<label title="Body weight (kg)" data-th-title="น้ำหนักตัว (กก.)">⚖️ <input type="number" class="dc-peds-kg" inputmode="decimal" min="0.5" max="150" step="0.1" placeholder="kg" value="${st.kg > 0 ? esc(st.kg) : ''}" oninput="dcPedsInput(this)"> kg</label>` : '') +
            (needConc ? `<label title="Strength of the product in mg per 5 ml (liquids) — type it to get ml" data-th-title="ความเข้มข้นของยา mg ต่อ 5 ml (ยาน้ำ) พิมพ์เพื่อให้ได้ ml">🧪 <input type="number" class="dc-peds-conc" inputmode="decimal" min="0" step="any" placeholder="mg/5 ml" value="${conc > 0 ? esc(conc) : ''}" oninput="dcPedsInput(this)"></label>` : '') +
            (needAge ? `<label title="Age in whole years" data-th-title="อายุ (ปีเต็ม)">🎂 <select class="dc-peds-age" onchange="dcPedsInput(this)"><option value=""${st.age == null ? ' selected' : ''}>—</option>${ages}</select> ปี</label>` : '') + '</div>';
        const refs = (doc.refs || []).filter(r => r && /^https:\/\//.test(r.url || ''))
            .map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label || 'Reference')} ↗</a>`).join(' · ');
        const checks = (doc.checks || []).map(c => `<div class="dc-peds-note">⚠️ ${esc(c)}</div>`).join('');
        return `<div class="dc-peds lang-no-toggle" data-drug-id="${esc(drugId)}">${inputs}<div class="dc-peds-forms">${formsHtml(doc, st, drugId)}</div>${checks}` +
            `<div class="dc-peds-foot">อ้างอิง: ${refs || '—'} · ขนาดยาอาจเปลี่ยนแปลงได้ตามโรค ควรปรึกษาแพทย์หรือเภสัชกรทุกครั้งก่อนใช้ยา</div></div>`;
    }
    const hasPeds = d => !!(d && d.pedsDosing && Array.isArray(d.pedsDosing.forms) && d.pedsDosing.forms.length);

    return { DATA, SOURCE, TSP_ML, calcWeight, tableNear, calcAge, ageSegmentMl, parseTable, fmt, round, timesText, findSeed, dosingText, forDoc, norm, state, formsHtml, sectionBodyHtml, hasPeds, MEDSCAPE, CHECK, ALT, refsFor, refUrls, calcMgkg, matchBands, bandAmount, getConc, setConc };
});
