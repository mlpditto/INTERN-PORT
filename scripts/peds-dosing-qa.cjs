// Paediatric dosing (public/peds-dosing.js): data shape, Medscape references, formula-vs-printed-table, calculator, age cells, intern markup + handler,
// and the admin "👶 Peds import" logic (real functions extracted from admin.html, fake Firestore). Node only.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const P = require('../public/peds-dosing.js');
const indexHtml = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const adminHtml = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const fn = (html, marker) => {
    const a = html.indexOf(marker);
    assert.ok(a >= 0, 'missing ' + marker);
    let i = html.indexOf('{', a), d = 0;
    for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) break; } }
    return html.slice(a, i + 1);
};
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

// ---- 1. data shape ----
const forms = P.DATA.flatMap(d => d.forms.map(f => ({ d, f })));
assert.equal(P.DATA.length, 76); assert.equal(forms.length, 78);
const nMode = m => forms.filter(x => x.f.mode === m).length;
assert.deepEqual([nMode('weight'), nMode('age'), nMode('mgkg'), nMode('bands')], [19, 5, 37, 17]);
assert.equal(new Set(P.DATA.map(d => d.key)).size, 76, 'unique keys');
for (const { d, f } of forms) {
    assert.ok(d.genericName && d.aliases.length, d.key);
    if (f.mode === 'weight') {
        assert.deepEqual(Object.keys(f.table).map(Number), [5, 10, 15, 20, 25], d.key + ' table weights');
        assert.ok(f.strength.amount > 0 && ['mg', 'mcg'].includes(f.strength.unit), d.key + ' strength');
        assert.ok(f.basis.min > 0 && f.basis.max >= f.basis.min && f.timesPerDay.min >= 1 && f.timesPerDay.max >= f.timesPerDay.min, d.key + ' basis');
    } else if (f.mode === 'age') {
        for (let i = 1; i < f.segments.length; i++) assert.ok(f.segments[i].from > f.segments[i - 1].to, d.key + ' age segments ascend');
        assert.equal(f.segments[0].from, 0); assert.equal(f.segments[f.segments.length - 1].to, 12);
    } else if (f.mode === 'mgkg') {
        assert.ok(f.lines.length >= 1, d.key);
        for (const l of f.lines) {
            assert.ok(l.basis.min > 0 && l.basis.max >= l.basis.min && ['day', 'dose'].includes(l.basis.per) && ['mg/kg', 'ml/kg', 'g/kg', 'mcg/kg'].includes(l.basis.unit), d.key + ' mg/kg basis');
            if (l.interval) assert.ok(l.interval.min >= 1 && l.interval.max >= l.interval.min && l.interval.text, d.key + ' interval');
            if (l.usual) assert.ok(l.usual >= l.basis.min && l.usual <= l.basis.max, d.key + ' usual dose inside the range');
        }
    } else {
        assert.equal(f.mode, 'bands', d.key);
        for (const b of f.bands) {
            assert.ok(['age', 'weight', 'any'].includes(b.by) && b.text, d.key + ' band');
            assert.ok([b.mg, b.ml, b.basis].filter(Boolean).length <= 1, d.key + ' band has at most one amount (none = tablet / sachet kept as printed text)');
            if (b.by === 'age') assert.ok(Array.isArray(b.ages) && b.ages.every(a => a >= 0 && a <= 12), d.key + ' band ages inside 0-12');
            if (b.by === 'weight') assert.ok(b.kg && (b.kg.lo != null || b.kg.hi != null), d.key + ' weight bounds');
        }
    }
}

// ---- 2. formula vs the printed table: only the known source deviations may differ (> max(0.2 ml, 10 %)) ----
const KNOWN = {   // `${drug key} ${form label} ${kg}` → why the printed cell and the formula disagree (all are in the source, not in the data entry)
    'amoxicillin 125 mg/5 ml 10': 'printed lower bound 3, formula 2.67 (rounded up)',
    'amoxicillin 250 mg/5 ml 5': 'printed a single "1" where the formula gives 0.67–1.67',
    'cpm 2 mg/5 ml 10': 'printed lower bound 2.5, formula 2.19',
    'erythromycin 125 mg/5 ml 10': 'printed lower bound 2, formula 3 (likely a typo)',
    'pseudoephedrine 30 mg/5 ml 10': 'printed 2, formula 2.22',
    'pseudoephedrine 30 mg/5 ml 15': 'printed 4, formula 3.33 (likely a typo)'
};
const off = [];
for (const { d, f } of forms.filter(x => x.f.mode === 'weight')) for (const kg of [5, 10, 15, 20, 25]) {
    const c = P.calcWeight(f, kg), t = P.parseTable(f.table[kg]), pr = t.length === 1 ? [t[0], t[0]] : t;
    const bad = (x, ref) => Math.abs(x) > Math.max(0.2, 0.1 * ref);
    if (bad(pr[0] - c.mlMin, c.mlMin) || bad(pr[1] - c.mlMax, c.mlMax) || (t.length === 1 && f.basis.min !== f.basis.max)) off.push(`${d.key} ${f.label} ${kg}`);
}
assert.deepEqual(off.sort(), Object.keys(KNOWN).sort(), 'formula vs table: an unlisted cell disagrees (typo in peds-dosing.js, or a new source quirk to list)');
for (const k of Object.keys(KNOWN)) { const [key] = k.split(' '); assert.ok(P.DATA.find(d => d.key === key).forms.some(f => f.notes.length) || key === 'cpm' || key === 'amoxicillin', 'note present for ' + k); }

// ---- 3. calculator spot checks ----
const form = (key, i = 0) => P.DATA.find(d => d.key === key).forms[i];
let c = P.calcWeight(form('amoxicillin'), 10); near(c.mlMin, 2.667); near(c.mlMax, 6.667); near(c.mgMin, 66.67, 0.01); near(c.perDayMax, 500);
c = P.calcWeight(form('cpm'), 5); near(c.mlMin, 1.094, 0.001); near(c.mlMax, 1.458, 0.001);          // 0.35 MKD ÷ 4 doses … ÷ 3 doses
c = P.calcWeight(form('cefdinir'), 20); near(c.mlMin, 11.2); near(c.mlMax, 11.2);                       // 14 mg/kg once a day, 25 mg/ml
c = P.calcWeight(form('procaterol'), 10); near(c.mlMin, 2.5); assert.equal(c.unit, 'mcg');             // 1.25 mcg/kg → 12.5 mcg ÷ 5 mcg/ml
c = P.calcWeight(form('ketotifen'), 10); near(c.mlMin, 1.25);                                          // per dose, matches the printed 1.25
c = P.calcWeight(form('augmentin'), 10); near(c.mlMin, 3.125); near(c.mlMax, 5.625);                    // amoxicillin 200 mg/5 ml
c = P.calcWeight(form('paracetamol'), 12); near(c.mlMin, 5); near(c.mlMax, 7.5);                        // 10–15 mg/kg/dose ÷ 24 mg/ml
assert.equal(P.calcWeight(form('amoxicillin'), 0), null); assert.equal(P.calcWeight(form('bromhexine'), 10), null);
assert.deepEqual(P.tableNear(form('amoxicillin'), 10), [{ kg: 10, text: '3-6.5' }]);
assert.deepEqual(P.tableNear(form('amoxicillin'), 12), [{ kg: 10, text: '3-6.5' }, { kg: 15, text: '4-10' }]);
assert.deepEqual(P.tableNear(form('amoxicillin'), 30), [{ kg: 25, text: '7-16' }]);
assert.equal(P.timesText(form('dicloxacillin')), '4× ac'); assert.equal(P.timesText(form('cpm')), '3-4×');

// ---- 4. by age ----
const seg = (key, age) => { const r = P.calcAge(form(key), age); return r && { amb: r.ambiguous, t: r.segments.map(s => s.text) }; };
assert.deepEqual(seg('bromhexine', 0), { amb: false, t: ['1.25 ml'] }); assert.deepEqual(seg('bromhexine', 4), { amb: false, t: ['½ ช้อนชา'] });
assert.deepEqual(seg('bromhexine', 5), { amb: true, t: ['½ ช้อนชา', '1 ช้อนชา'] }, 'age 5 sits on a half-cut pill');
assert.deepEqual(seg('bromhexine', 6), { amb: false, t: ['1 ช้อนชา'] }); assert.deepEqual(seg('bromhexine', 12), { amb: false, t: ['2 ช้อนชา'] });
assert.deepEqual(seg('glyceryl-guaiacolate', 5), { amb: true, t: ['½-1 ช้อนชา', '1-2 ช้อนชา'] });
assert.deepEqual(seg('hyoscine', 2), { amb: false, t: ['1 ช้อนชา'] }); assert.equal(seg('hyoscine', 3).amb, true); assert.equal(seg('hyoscine', 6).amb, true);
assert.deepEqual(seg('hyoscine', 4), { amb: false, t: ['1-2 ช้อนชา'] }); assert.deepEqual(seg('hyoscine', 7), { amb: false, t: ['2-4 ช้อนชา'] });
assert.deepEqual(seg('mom', 5), { amb: false, t: ['5-15 ml/day'] }); assert.deepEqual(seg('multivitamin', 6), { amb: false, t: ['1 ช้อนชา'] }); assert.deepEqual(seg('multivitamin', 7), { amb: false, t: ['1-2 ช้อนชา'] });
assert.equal(P.calcAge(form('bromhexine'), 13), null); assert.equal(P.calcAge(form('amoxicillin'), 3), null);
const gg = form('glyceryl-guaiacolate');
const mkd = P.ageSegmentMl(gg, gg.segments[0], 12); near(mkd.min, 1.8); near(mkd.max, 2.4);              // 12 MKD × 12 kg ÷ 4…3 doses ÷ 20 mg/ml
assert.equal(P.ageSegmentMl(gg, gg.segments[0], 0), null, 'MKD needs a weight');
assert.equal(P.ageSegmentMl(form('mom'), form('mom').segments[0], 8), null, 'MOM 0.5 MKD has no strength/unit — never computed');
assert.deepEqual(P.ageSegmentMl(form('bromhexine'), form('bromhexine').segments[2], 0), { min: 5, max: 5 });

// ---- 4b. mg/kg lines (second infographic) ----
const line = (key, i = 0, j = 0) => form(key, i).lines[j];
let m = P.calcMgkg(line('clarithromycin'), 15, 125);                 // 15 mg/kg/day ÷ 2 = 7.5 mg/kg per dose
near(m.doseLo, 112.5); near(m.doseHi, 112.5); near(m.dayLo, 225); near(m.mlLo, 4.5); assert.equal(m.unit, 'mg'); assert.equal(m.capped, false);
m = P.calcMgkg(line('clarithromycin'), 15, null); assert.equal(m.mlLo, null, 'no strength typed → no ml');
m = P.calcMgkg(line('isoniazid'), 20, null); near(m.doseLo, 200); near(m.doseHi, 300); assert.equal(m.capped, false);
m = P.calcMgkg(line('isoniazid'), 40, null); near(m.doseHi, 300); near(m.dayHi, 300); assert.equal(m.capped, true, 'max 300 mg caps the top');
m = P.calcMgkg(line('pyrazinamide'), 60, null); near(m.dayHi, 2000); assert.equal(m.capped, true);
m = P.calcMgkg(line('lactulose'), 10, 125); assert.equal(m.unit, 'ml'); near(m.doseLo, 5); near(m.doseHi, 30); assert.equal(m.mlLo, null, 'already in ml');   // 10–30 ml/day over 2…1 doses
m = P.calcMgkg(line('ranitidine'), 10, null); near(m.dayLo, 20); near(m.dayHi, 40); near(m.doseLo, 5); near(m.doseHi, 20);                          // BID / q6-8 hr → 2…4 doses
m = P.calcMgkg(line('levetiracetam'), 10, null); near(m.dayLo, 200); near(m.dayHi, 800); assert.equal(m.doseLo, null, 'interval not printed → daily amount only');
m = P.calcMgkg(line('carbocysteine', 0), 12, null); near(m.dayLo, 240); near(m.dayHi, 360); near(m.doseLo, 120); near(m.doseHi, 360);               // 20–30 mg/kg/day, OD–BID
assert.equal(P.calcMgkg(line('clarithromycin'), 0, 125), null);

// ---- 4c. bands: weight gaps, half-cut ages, several infant bands ----
const bf = key => form(key);
const hit = (key, kg, age) => { const r = P.matchBands(bf(key), kg, age); return { age: r.age && r.age.bands.map(b => b.text), ageAmb: r.age && r.age.ambiguous, kg: r.weight && r.weight.bands.map(b => b.text), kgAmb: r.weight && r.weight.ambiguous }; };
assert.deepEqual(hit('oseltamivir', 14, null).kg, ['< 15 kg']); assert.equal(hit('oseltamivir', 14, null).kgAmb, false);
assert.deepEqual(hit('oseltamivir', 15, null).kg, ['< 15 kg', '16-23 kg']); assert.equal(hit('oseltamivir', 15, null).kgAmb, true);
assert.deepEqual(hit('oseltamivir', 15.5, null).kg, ['< 15 kg', '16-23 kg']);
assert.deepEqual(hit('oseltamivir', 20, null).kg, ['16-23 kg']); assert.deepEqual(hit('oseltamivir', 23.5, null).kg, ['16-23 kg', '24-44 kg']);
assert.deepEqual(hit('oseltamivir', 45, null).kg, ['24-44 kg', '> 45 kg'], '45 kg is neither "24-44" nor "> 45"'); assert.deepEqual(hit('oseltamivir', 50, null).kg, ['> 45 kg']);
assert.deepEqual(hit('oseltamivir', null, 0).age, ['< 3 mo', '3-6 mo', '6-12 mo']); assert.equal(hit('oseltamivir', null, 0).ageAmb, true, 'a whole-year age 0 spans three month bands');
assert.equal(hit('oseltamivir', null, 3).age, null, 'age 3 has no infant band');
assert.deepEqual(hit('cetirizine', null, 1).age, ['6 mo-2 yr']); assert.equal(hit('cetirizine', null, 1).ageAmb, false);
assert.deepEqual(hit('cetirizine', null, 0).age, ['6 mo-2 yr']); assert.deepEqual(hit('cetirizine', null, 5).age, ['2-5 yr']);
assert.deepEqual(hit('cetirizine', null, 6).age, ['2-5 yr', '> 6 yr']); assert.equal(hit('cetirizine', null, 6).ageAmb, true, 'age 6 is in the gap of "2-5" / "> 6"');
assert.deepEqual(hit('cetirizine', null, 8).age, ['> 6 yr']);
assert.deepEqual(hit('simethicone', null, 0).age, ['< 1 yr']); assert.deepEqual(hit('simethicone', null, 12).age, ['1-12 yr']);
{ const r = P.matchBands(P.DATA.find(d => d.key === 'carbocysteine').forms[1], null, 3); assert.deepEqual(r.age.bands.map(b => b.text), ['2-5 yr']); }
assert.equal(P.matchBands(bf('albendazole'), null, null).any.length, 1, 'a single printed dose is always shown');
let ba = P.bandAmount(bf('cetirizine').bands[0], null, 5); near(ba.lo, 2.5); near(ba.ml[0], 2.5);               // 2.5 mg at 5 mg/5 ml = 2.5 ml
assert.equal(P.bandAmount(bf('cetirizine').bands[0], null, null).ml, null);
ba = P.bandAmount(bf('phenobarbital').bands[1], 10, null); assert.equal(ba.kind, 'mgday'); near(ba.lo, 40); near(ba.hi, 80);
assert.equal(P.bandAmount(bf('phenobarbital').bands[1], null, null).kind, 'needkg');
ba = P.bandAmount(bf('alum-milk').bands[0], null, null); assert.equal(ba.kind, 'ml'); near(ba.lo, 5); near(ba.hi, 15);
assert.equal(P.dosingText(P.DATA.find(d => d.key === 'isoniazid')), 'Isoniazid oral — 10–15 mg/kg/day (usual 10), max 300 mg HS');
assert.match(P.dosingText(P.DATA.find(d => d.key === 'oseltamivir')), /< 3 mo 12 mg, 3-6 mo 20 mg, 6-12 mo 25 mg, < 15 kg 30 mg.*> 45 kg 75 mg BID x 5 days/);

// ---- 5. matching + doc payloads ----
assert.equal(P.findSeed('Chlorpheniramine maleate').key, 'cpm'); assert.equal(P.findSeed('co-trimoxazole').key, 'cotrimoxazole');
assert.equal(P.findSeed('Amoxicillin').key, 'amoxicillin'); assert.equal(P.findSeed('Amoxicillin/Clavulanic acid').key, 'augmentin');
assert.equal(P.findSeed('GLYCERYL GUAIACOLATE (Guaifenesin)').key, 'glyceryl-guaiacolate'); assert.equal(P.findSeed('Metformin'), null);
assert.deepEqual(['Rifampin', 'Aciclovir', 'Sodium valproate', 'Aluminum hydroxide', 'Phenobarbitone', 'Carbocisteine', 'INH'].map(n => P.findSeed(n).key), ['rifampicin', 'acyclovir', 'valproic-acid', 'alum-milk', 'phenobarbital', 'carbocysteine', 'isoniazid']);
assert.match(P.dosingText(P.DATA[0]), /Amoxicillin 125 mg\/5 ml — วันละ 3 ครั้ง \(20–50 mg\/kg\/day\)\nAmoxicillin 250/);
assert.deepEqual(Object.keys(P.forDoc(P.DATA[0])), ['v', 'source', 'refs', 'checks', 'alt', 'alts', 'forms']);

// ---- 5a. third source (Toxic Version) ----
const dd = k => P.DATA.find(d => d.key === k);
assert.equal(Object.keys(P.ALT3).length, 42 + 28, 'ALT3: 42 shared drugs + 28 new');
assert.deepEqual(P.forDoc(dd('amoxicillin')).alts.map(a => a.label), ['Toxic Version (Mar 2020)']);
assert.equal(P.forDoc(dd('salbutamol')).alts.length, 0, 'salbutamol is a nebuliser in the Toxic Version → no third-source line');
assert.ok(P.forDoc(dd('amoxicillin')).alt && P.forDoc(dd('amoxicillin')).alts.length === 1, 'both second and third source kept');
{   // each source is its own dashed line
    const h = P.formsHtml(P.forDoc(dd('amoxicillin')), { kg: 12, age: null });
    assert.equal((h.match(/class="dc-peds-alt"/g) || []).length, 2); assert.ok(h.includes('Ped-in-a-page') && h.includes('Toxic Version (Mar 2020)') && h.includes('MAX 4 g/day'));
    // a doc imported before this source existed has no `alts` — still renders
    const old = P.forDoc(dd('amoxicillin')); delete old.alts;
    assert.equal((P.formsHtml(old, { kg: 12, age: null }).match(/class="dc-peds-alt"/g) || []).length, 1);
}
// "MAX 60 mg/dose" (levodropropizine) caps each administration, not the day
{
    const ln0 = dd('levodropropizine').forms[0].lines[0];
    const c = P.calcMgkg(ln0, 20, null); near(c.doseLo, 20); near(c.doseHi, 20); assert.equal(c.capped, false);
    const big = P.calcMgkg(ln0, 70, null); near(big.doseHi, 60); assert.equal(big.capped, true); near(big.dayHi, 60 * 3);
}
// g/kg (PEG) and mcg/kg (ivermectin) keep their unit, never ask for mg/5 ml; a per-dose basis with no printed interval must render (no crash)
{
    const peg = P.calcMgkg(dd('peg').forms[0].lines[0], 10, null); assert.equal(peg.unit, 'g'); near(peg.dayLo, 10); near(peg.doseLo, 10 / 3); near(peg.doseHi, 5);
    const iv = P.calcMgkg(dd('ivermectin').forms[0].lines[0], 15, null); assert.equal(iv.unit, 'mcg'); near(iv.doseLo, 3000); assert.equal(iv.dayLo, null);
    for (const k of ['peg', 'ivermectin']) assert.ok(!P.sectionBodyHtml('x', P.forDoc(dd(k)), { kg: 15, age: null }).includes('dc-peds-conc'), k + ': no mg/5 ml box');
    const h = P.sectionBodyHtml('x', P.forDoc(dd('ivermectin')), { kg: 15, age: null });
    assert.ok(h.includes('3000 mcg') && h.includes('× 2 (Day 0 + Day 7'), 'ivermectin renders per dose + schedule');
    const d = P.sectionBodyHtml('x', P.forDoc(dd('diazepam')), { kg: 10, age: null }); assert.ok(d.includes('3 mg'), 'diazepam 0.3 mg/kg × 10 kg');
}
// every drug (old and new) renders for kg / age combinations without throwing and without printing "undefined" / "NaN"
for (const d of P.DATA) for (const st of [{ kg: null, age: null }, { kg: 12, age: 3 }, { kg: 0.8, age: 0 }, { kg: 70, age: 12 }]) {
    const h = P.sectionBodyHtml(d.key, P.forDoc(d), st); assert.ok(!/undefined|NaN|\[object/.test(h), d.key + ' ' + JSON.stringify(st));
}
// the new age / weight bands
{
    const m = (k, kg, age) => P.matchBands(dd(k).forms[0], kg, age);
    assert.deepEqual(m('racecadotril', 30, null).weight.bands.map(b => b.text), ['3 mo-30 kg: ½ sachet', '30 kg-16 yr: 1 sachet'], '30 kg is on both printed edges');
    assert.deepEqual(m('racecadotril', 10, null).weight.bands.map(b => b.text), ['3 mo-30 kg: ½ sachet']);
    assert.deepEqual(m('montelukast', null, 3).age.bands.map(b => b.text), ['6 mo-5 yr: 4 mg']); assert.equal(m('montelukast', null, 0).age.ambiguous, false); assert.equal(m('montelukast', null, 0).age.bands.length, 1);
    assert.deepEqual(m('diosmectite', null, 0).age.bands.map(b => b.text), ['< 1 yr: ½ sachet']); assert.deepEqual(m('folic-acid', null, 4).age.bands.map(b => b.text), ['> 1 yr: 1 tab']);
}

// ---- 5b. international references (Medscape) ----
const NO_MEDSCAPE = ['acetylcysteine', 'bromhexine', 'carbocysteine', 'chloral-hydrate', 'ciprofloxacin', 'cloxacillin', 'diosmectite', 'folic-acid', 'griseofulvin', 'hyoscine', 'ketotifen', 'lactobacillus-bifidobacterium', 'lactobacillus-reuteri', 'levodropropizine', 'multivitamin', 'norfloxacin', 'phenobarbital', 'phenylephrine', 'procaterol', 'racecadotril', 'saccharomyces-boulardii'];   // no Medscape page: not US-marketed / a vitamin mix / only an IV product
assert.deepEqual(P.DATA.filter(d => !P.MEDSCAPE[d.key]).map(d => d.key).sort(), NO_MEDSCAPE, 'which drugs have no Medscape page');
assert.equal(Object.keys(P.MEDSCAPE).length, 55);
for (const [k, u] of Object.entries(P.MEDSCAPE)) {
    assert.ok(P.DATA.some(d => d.key === k), 'MEDSCAPE key ' + k);
    assert.match(u, /^https:\/\/(reference|emedicine)\.medscape\.com\/(drug\/[a-z0-9-]+-\d+|article\/\d+-overview)$/, 'Medscape URL shape: ' + k);
}
for (const k of Object.keys(P.CHECK)) assert.ok(P.DATA.some(d => d.key === k), 'CHECK key ' + k);
assert.deepEqual(Object.keys(P.CHECK).sort(), ['acyclovir', 'amoxicillin', 'cetirizine', 'ethambutol', 'levetiracetam', 'mom', 'omeprazole', 'oseltamivir', 'paracetamol', 'penicillin-v', 'pyrazinamide', 'ranitidine', 'simethicone'], 'drugs where Medscape disagreed');
// the second source printed beside our primary one, for the 14 drugs both infographics list
assert.deepEqual(Object.keys(P.ALT).sort(), ['amoxicillin', 'azithromycin', 'bromhexine', 'cefdinir', 'cotrimoxazole', 'cpm', 'dicloxacillin', 'domperidone', 'erythromycin', 'hydroxyzine', 'ibuprofen', 'paracetamol', 'pseudoephedrine', 'salbutamol']);
for (const k of Object.keys(P.ALT)) assert.ok(P.DATA.findIndex(d => d.key === k) < 23, k + ': a second-source line only for a drug the first source already has');
assert.deepEqual(P.forDoc(P.DATA.find(d => d.key === 'dicloxacillin')).alt, { label: 'Ped-in-a-page', lines: ['25-50 mkday QID'] });
assert.equal(P.forDoc(P.DATA.find(d => d.key === 'clarithromycin')).alt, null);
assert.deepEqual(P.forDoc(P.DATA.find(d => d.key === 'ibuprofen')).refs, [{ label: 'Medscape', url: P.MEDSCAPE.ibuprofen }]);
assert.deepEqual(P.forDoc(P.DATA.find(d => d.key === 'ketotifen')).refs, []);
assert.equal(P.refUrls(P.DATA.find(d => d.key === 'ketotifen')).length, 0);

// ---- 6. intern markup ----
const st = { kg: 12, age: 5 };
let h = P.sectionBodyHtml('x"><b>', P.forDoc(P.DATA[0]), st);
assert.ok(!h.includes('x"><b>') && h.includes('x&quot;&gt;&lt;b&gt;'), 'drug id escaped');
assert.ok(h.includes('dc-peds-kg') && !h.includes('dc-peds-age'), 'weight forms: kg input only');
assert.ok(h.includes('3.2–8 ml') && h.includes('1.6–4 ml'), 'amoxicillin 12 kg');
h = P.sectionBodyHtml('a', P.forDoc(P.DATA.find(d => d.key === 'hyoscine')), st);
assert.ok(h.includes('dc-peds-age') && !h.includes('dc-peds-kg'), 'age-only form: no kg input');
assert.ok(!h.includes('ตรวจสอบกับเภสัชกร'), 'age 5 is not on a half-cut Hyoscine boundary');
assert.ok(P.sectionBodyHtml('a', P.forDoc(P.DATA.find(d => d.key === 'hyoscine')), { kg: null, age: 3 }).includes('ตรวจสอบกับเภสัชกร'), 'age 3 is');
h = P.sectionBodyHtml('a', P.forDoc(P.DATA.find(d => d.key === 'glyceryl-guaiacolate')), { kg: null, age: 0 });
assert.ok(h.includes('dc-peds-kg') && h.includes('dc-peds-age') && h.includes('⚖️ kg'), 'MKD cell asks for the weight');
assert.ok(P.sectionBodyHtml('a', P.forDoc(P.DATA[0]), { kg: 3, age: null }).includes('ตารางเฉพาะ 5–25 kg'), 'outside the table range is said so');
assert.ok(P.hasPeds({ pedsDosing: P.forDoc(P.DATA[0]) }) && !P.hasPeds({}) && !P.hasPeds({ pedsDosing: { forms: [] } }));
// the foot shows the international reference (a link), the cross-check warnings where Medscape disagreed, and nothing from Pharmtutors
h = P.sectionBodyHtml('a', P.forDoc(P.DATA[0]), { kg: 10, age: null });
assert.ok(h.includes('href="https://reference.medscape.com/drug/amoxil-amoxicillin-342473"') && h.includes('rel="noopener noreferrer"') && h.includes('Medscape ↗'), 'amoxicillin: Medscape link');
assert.ok(h.includes('⚠️ Medscape (US): 20 mg/kg/day'), 'amoxicillin: cross-check note');
assert.ok(!/Pharmtutors/.test(h), 'the intern view no longer names the infographic');
h = P.sectionBodyHtml('a', P.forDoc(P.DATA.find(d => d.key === 'ketotifen')), { kg: 10, age: null });
assert.ok(h.includes('อ้างอิง: — ') && !h.includes('⚠️ Medscape'), 'a drug without a Medscape page shows no link and no claim');
h = P.sectionBodyHtml('a', { forms: [], refs: [{ label: 'x', url: 'javascript:alert(1)' }, { label: 'y', url: 'https://example.org/p?a=1&b=2' }] }, { kg: null, age: null });
assert.ok(!h.includes('javascript:') && h.includes('https://example.org/p?a=1&amp;b=2'), 'only https links are rendered, and escaped');

// the new modes in the markup: strength box only where mg can become ml, caps and gaps warned, second source shown, strength remembered per drug
P.state.kg = null; P.state.age = null;
const html = (key, kg, age, id = 'x-' + key) => P.sectionBodyHtml(id, P.forDoc(P.DATA.find(d => d.key === key)), { kg, age, conc: {} });
h = html('clarithromycin', 15, null);
assert.ok(h.includes('dc-peds-kg') && h.includes('dc-peds-conc') && !h.includes('dc-peds-age'), 'mg/kg liquid: kg + strength inputs');
assert.ok(h.includes('112.5 mg') && h.includes('225 mg/day') && !h.includes('🧪 <b>'), 'no strength typed → mg only');
P.setConc('x-clarithromycin', 125);
assert.equal(store['peds_conc_x-clarithromycin'], '125'); assert.equal(P.getConc('x-clarithromycin'), 125);
h = html('clarithromycin', 15, null);
assert.ok(h.includes('🧪 <b>4.5 ml</b>') && h.includes('value="125"'), 'strength typed → ml per dose, box pre-filled');
P.setConc('x-clarithromycin', -3); assert.equal(P.getConc('x-clarithromycin'), null); assert.ok(!('peds_conc_x-clarithromycin' in store), 'an invalid strength is forgotten');
P.setConc('x-clarithromycin', 1e9); assert.equal(P.getConc('x-clarithromycin'), null);
assert.ok(!html('lactulose', 10, null).includes('dc-peds-conc'), 'a dose already in ml needs no strength');
assert.ok(html('lactulose', 10, null).includes('5–30 ml'));
assert.ok(html('isoniazid', 40, null).includes('ถึงขนาดสูงสุดที่ต้นฉบับกำหนด (300 mg)'), 'the printed cap is announced');
assert.ok(!html('isoniazid', 20, null).includes('ถึงขนาดสูงสุด'));
assert.ok(html('levetiracetam', 10, null).includes('200–800 mg/day') && html('levetiracetam', 10, null).includes('ไม่ระบุความถี่'));
h = html('oseltamivir', 14, null);
assert.ok(/dc-peds-band on">&lt; 15 kg <b>30 mg<\/b>/.test(h) && !/dc-peds-band on">16-23 kg/.test(h), 'the band that fits 14 kg is highlighted, the others are not');
assert.ok(!h.includes('อยู่ตรงขอบหรือระหว่างช่วง'));
h = html('oseltamivir', 15, null);
assert.ok(/dc-peds-band on">&lt; 15 kg/.test(h) && /dc-peds-band on">16-23 kg/.test(h) && h.includes('อยู่ตรงขอบหรือระหว่างช่วง'), '15 kg: both neighbours + warning');
h = html('oseltamivir', null, 0);
assert.equal((h.match(/dc-peds-band on/g) || []).length, 3, 'age 0: the three infant bands');
assert.ok(html('cetirizine', null, 6).includes('อยู่ตรงขอบหรือระหว่างช่วง') && !html('cetirizine', null, 8).includes('อยู่ตรงขอบหรือระหว่างช่วง'));
assert.ok(html('cetirizine', null, 3).includes('dc-peds-age') && html('cetirizine', null, 3).includes('dc-peds-conc') && !html('cetirizine', null, 3).includes('dc-peds-kg'));
assert.ok(html('phenobarbital', 10, 3).includes('40–80 mg/day'), 'phenobarbital age 3 × 10 kg');
assert.ok(html('phenobarbital', null, 3).includes('⚖️ kg'));
assert.ok(html('albendazole', null, null).includes('dc-peds-band on">400 mg/dose'), 'a single printed dose needs no input');
assert.ok(html('dicloxacillin', 10, null).includes('Ped-in-a-page: 25-50 mkday QID'), 'the second source is printed beside the first');
assert.ok(!html('ketotifen', 10, null).includes('Ped-in-a-page'));
h = html('pyrazinamide', 20, null);
assert.ok(h.includes('⚠️ Medscape: 15–30 mg/kg/day') && h.includes('https://reference.medscape.com/drug/pyrazinamide-342678'));
P.state.kg = null; P.state.age = null;

// ---- 7. wiring in the pages ----
assert.match(indexHtml, /<script src="peds-dosing\.js\?v=V\d+\.\d+"><\/script>/); assert.match(adminHtml, /<script src="peds-dosing\.js\?v=V\d+\.\d+"><\/script>/);
assert.ok(indexHtml.includes("pedsSection,\n                {\n                    key: 'clinical'"), 'peds section comes first (the rail opens it)');
assert.ok(indexHtml.includes("PedsDosing.sectionBodyHtml(drug._id, sec.peds, PedsDosing.state)") && indexHtml.includes('class="dc-row-peds"'));
assert.match(adminHtml, /onclick="dcaPedsImportOpen\(\)"/);

// dcPedsInput with a fake box: remembers kg / age, repaints the results
{
    const drug = { _id: 'd1', pedsDosing: P.forDoc(P.DATA[0]) };
    const forms = { innerHTML: '' }, kgEl = { value: '12' }, ageEl = null, concEl = { value: '125' };
    const box = { dataset: { drugId: 'd1' }, querySelector: s => ({ '.dc-peds-kg': kgEl, '.dc-peds-age': ageEl, '.dc-peds-conc': concEl, '.dc-peds-forms': forms })[s] };
    const ctx = { window: {}, PedsDosing: P, dcState: { codex: [drug] } };
    ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fn(indexHtml, 'window.dcPedsInput = function'), ctx);
    P.state.kg = null; P.state.age = null; P.state.conc = {};
    ctx.window.dcPedsInput({ closest: () => box });
    assert.equal(P.getConc('d1'), 125, 'the strength box is read and kept per drug'); concEl.value = '';
    ctx.window.dcPedsInput({ closest: () => box }); assert.equal(P.getConc('d1'), null, 'an empty strength box clears it');
    assert.equal(P.state.kg, 12); assert.ok(forms.innerHTML.includes('3.2–8 ml'));
    kgEl.value = '-4'; ctx.window.dcPedsInput({ closest: () => box });
    assert.equal(P.state.kg, null, 'a non-positive weight clears the result'); assert.ok(forms.innerHTML.includes('⚖️ kg'));
    kgEl.value = '900'; ctx.window.dcPedsInput({ closest: () => box });
    assert.equal(P.state.kg, null, 'an absurd weight is ignored');
    P.state.kg = null; P.state.age = null;
}

// ---- 8. admin import (real functions from admin.html, fake DOM + fake Firestore) ----
(async () => {
    const writes = [];
    const flush = () => new Promise(r => setImmediate(r));
    const makeCtx = (codex, failCommit) => {
        let handler = null, toast = '';
        const goBtn = { disabled: false, textContent: '' };
        const overlay = { style: {}, innerHTML: '', removed: false, addEventListener: (t, h) => { handler = h; }, remove() { this.removed = true; } };
        const ctx = {
            PedsDosing: P, dcaState: { codex },
            DCA_FIELD_KEYS: ['genericName', 'brandNames', 'atcCode', 'class', 'indication', 'dosing', 'contraindication', 'sideEffects', 'interactions', 'mechanism', 'absorption', 'distribution', 'metabolism', 'excretion', 'toxicity', 'monitoring', 'patientCounseling', 'pearls', 'references'],
            escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
            showToast: m => { toast = m; },
            document: { createElement: () => overlay, body: { appendChild() {} } },
            auth: { currentUser: { email: 'owner@example.com' } },
            firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } },
            db: {
                collection: name => ({ doc: id => ({ _ref: name + '/' + (id || 'NEW') }) }),
                batch: () => {
                    const ops = [];
                    return {
                        update: (ref, data) => ops.push({ op: 'update', ref: ref._ref, data }),
                        set: (ref, data) => ops.push({ op: 'set', ref: ref._ref, data }),
                        commit: async () => { if (failCommit) throw new Error('permission-denied'); writes.push(...ops); }
                    };
                }
            },
            console: { error() {}, log() {} }, JSON, Object, Array, String   // the failing-commit case logs on purpose
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        for (const m of ['function dcaPedsCanon(', 'function dcaPedsPlan(', 'function dcaPedsNewDoc(', 'function dcaPedsImportOpen(']) vm.runInContext(fn(adminHtml, m), ctx);
        const target = kind => kind === 'go' ? { closest: s => (s.includes('"go"') ? goBtn : null) }
            : kind === 'cancel' ? { closest: s => (s.includes('"cancel"') ? {} : null) } : overlay;
        return { ctx, overlay, goBtn, click: kind => handler({ target: target(kind) }), toast: () => toast };
    };
    const planOf = codex => makeCtx(codex).ctx.dcaPedsPlan().reduce((o, x) => { o[x.seed.key] = x.action; return o; }, {});
    // Firestore returns maps in its own key order — the "already imported" test must not depend on it
    const reorder = o => Array.isArray(o) ? o.map(reorder) : (o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).reverse().map(k => [k, reorder(o[k])])) : o);

    // empty codex: every drug is created
    assert.equal(Object.values(planOf([])).filter(x => x === 'create').length, 76);

    // matching: no peds yet → add; identical peds (keys shuffled) → same; different → replace; alias → add; unrelated drug untouched
    const codex = [
        { _id: 'A', genericName: 'Amoxicillin', dosing: 'keep me' },
        { _id: 'I', genericName: 'Ibuprofen', pedsDosing: reorder(P.forDoc(P.DATA.find(d => d.key === 'ibuprofen'))) },
        { _id: 'P', genericName: 'Paracetamol', pedsDosing: { v: 1, source: 'old', forms: [] } },
        { _id: 'C', genericName: 'Chlorpheniramine maleate' },
        { _id: 'M', genericName: 'Metformin' }];
    const a = planOf(codex);
    assert.deepEqual([a.amoxicillin, a.ibuprofen, a.paracetamol, a.cpm, a.salbutamol], ['add', 'same', 'replace', 'add', 'create']);

    // confirm: existing docs get ONLY pedsDosing + updatedAt; new docs are complete; 'same' and unrelated docs are not written
    const t = makeCtx(codex);
    t.ctx.dcaPedsImportOpen();
    assert.match(t.overlay.innerHTML, /Import 75/);
    assert.match(t.overlay.innerHTML, /72 new · 2 add to existing · 1 replace · 1 already imported/);
    writes.length = 0;
    t.click('go'); await flush();
    assert.equal(writes.length, 75);
    const upd = writes.filter(w => w.op === 'update'), set = writes.filter(w => w.op === 'set');
    assert.deepEqual(upd.map(w => w.ref).sort(), ['drug_codex/A', 'drug_codex/C', 'drug_codex/P']);
    for (const u of upd) assert.deepEqual(Object.keys(u.data).sort(), ['pedsDosing', 'updatedAt'], 'existing docs: nothing but pedsDosing + updatedAt');
    assert.equal(set.length, 72);
    assert.deepEqual(set.find(w => w.data.genericName === 'Ketotifen').data.references, [], 'no Medscape page → no reference invented');
    const s0 = set.find(w => w.data.genericName === 'Salbutamol').data;
    assert.equal(JSON.stringify([s0.aiDrafted, s0.contributors, s0.references, s0.indication, s0.createdAt]), JSON.stringify([false, ['admin:owner@example.com'], [P.MEDSCAPE.salbutamol], '', 'TS'])); // JSON: arrays built inside the vm have another prototype
    assert.ok(s0.dosing.includes('Salbutamol 2 mg/5 ml') && s0.pedsDosing.forms.length === 1, 'new doc: dosing line + peds data');
    assert.ok(!('reviewedBy' in s0) && !('lastReviewedAt' in s0), 'a new doc is not marked as reviewed by the admin');
    assert.ok(t.toast().includes('72 new, 3 updated') && t.overlay.removed, 'toast + dialog closed');

    // a failing commit leaves the dialog open, the button usable, and says why
    const f = makeCtx(codex, true);
    f.ctx.dcaPedsImportOpen(); f.click('go'); await flush();
    assert.ok(/Peds import failed: permission-denied/.test(f.toast()));
    assert.ok(!f.overlay.removed && f.goBtn.disabled === false && f.goBtn.textContent === 'Import 75');

    // cancel writes nothing; everything already imported → nothing to do, button disabled
    writes.length = 0;
    const c2 = makeCtx(codex); c2.ctx.dcaPedsImportOpen(); c2.click('cancel');
    assert.ok(c2.overlay.removed && writes.length === 0);
    const all = P.DATA.map((d, i) => ({ _id: 'X' + i, genericName: d.genericName, pedsDosing: reorder(P.forDoc(d)) }));
    const c3 = makeCtx(all); c3.ctx.dcaPedsImportOpen();
    assert.ok(/data-act="go" disabled/.test(c3.overlay.innerHTML) && /Import 0/.test(c3.overlay.innerHTML));

    console.log('PASS: peds-dosing — 76 drugs / 78 forms (19 by weight, 5 by age, 37 mg/kg, 17 bands); formula matches the printed table except the 6 listed source quirks; calculator spot checks (mg/kg/day split over the doses, per dose, mcg, MKD at age 0); the 4 half-cut age boundaries return both candidates; intern markup + dcPedsInput; admin import plan (create / add / replace / same, alias match) writes only pedsDosing+updatedAt to existing docs and survives failure / cancel / nothing-to-do');
})().catch(e => { console.error(e); process.exit(1); });
