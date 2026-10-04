// Paediatric dosing (public/peds-dosing.js): data shape, Medscape references, formula-vs-printed-table, calculator, age cells, intern markup + handler,
// and the admin "👶 Peds import" logic (real functions extracted from admin.html, fake Firestore). Node only.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
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
assert.equal(P.DATA.length, 23); assert.equal(forms.length, 24);
assert.equal(forms.filter(x => x.f.mode === 'weight').length, 19); assert.equal(forms.filter(x => x.f.mode === 'age').length, 5);
assert.equal(new Set(P.DATA.map(d => d.key)).size, 23, 'unique keys');
for (const { d, f } of forms) {
    assert.ok(d.genericName && d.aliases.length, d.key);
    if (f.mode === 'weight') {
        assert.deepEqual(Object.keys(f.table).map(Number), [5, 10, 15, 20, 25], d.key + ' table weights');
        assert.ok(f.strength.amount > 0 && ['mg', 'mcg'].includes(f.strength.unit), d.key + ' strength');
        assert.ok(f.basis.min > 0 && f.basis.max >= f.basis.min && f.timesPerDay.min >= 1 && f.timesPerDay.max >= f.timesPerDay.min, d.key + ' basis');
    } else {
        for (let i = 1; i < f.segments.length; i++) assert.ok(f.segments[i].from > f.segments[i - 1].to, d.key + ' age segments ascend');
        assert.equal(f.segments[0].from, 0); assert.equal(f.segments[f.segments.length - 1].to, 12);
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

// ---- 5. matching + doc payloads ----
assert.equal(P.findSeed('Chlorpheniramine maleate').key, 'cpm'); assert.equal(P.findSeed('co-trimoxazole').key, 'cotrimoxazole');
assert.equal(P.findSeed('Amoxicillin').key, 'amoxicillin'); assert.equal(P.findSeed('Amoxicillin/Clavulanic acid').key, 'augmentin');
assert.equal(P.findSeed('GLYCERYL GUAIACOLATE (Guaifenesin)').key, 'glyceryl-guaiacolate'); assert.equal(P.findSeed('Metformin'), null);
assert.match(P.dosingText(P.DATA[0]), /Amoxicillin 125 mg\/5 ml — วันละ 3 ครั้ง \(20–50 mg\/kg\/day\)\nAmoxicillin 250/);
assert.deepEqual(Object.keys(P.forDoc(P.DATA[0])), ['v', 'source', 'refs', 'checks', 'forms']);

// ---- 5b. international references (Medscape) ----
const NO_MEDSCAPE = ['bromhexine', 'hyoscine', 'ketotifen', 'multivitamin', 'procaterol'];   // no Medscape page: not US-marketed / a vitamin mix
assert.deepEqual(P.DATA.filter(d => !P.MEDSCAPE[d.key]).map(d => d.key).sort(), NO_MEDSCAPE, 'which drugs have no Medscape page');
assert.equal(Object.keys(P.MEDSCAPE).length, 18);
for (const [k, u] of Object.entries(P.MEDSCAPE)) {
    assert.ok(P.DATA.some(d => d.key === k), 'MEDSCAPE key ' + k);
    assert.match(u, /^https:\/\/(reference|emedicine)\.medscape\.com\/(drug\/[a-z0-9-]+-\d+|article\/\d+-overview)$/, 'Medscape URL shape: ' + k);
}
for (const k of Object.keys(P.CHECK)) assert.ok(P.DATA.some(d => d.key === k), 'CHECK key ' + k);
assert.deepEqual(Object.keys(P.CHECK).sort(), ['amoxicillin', 'mom', 'paracetamol', 'penicillin-v'], 'drugs where Medscape disagreed');
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

// ---- 7. wiring in the pages ----
assert.match(indexHtml, /<script src="peds-dosing\.js\?v=V\d+\.\d+"><\/script>/); assert.match(adminHtml, /<script src="peds-dosing\.js\?v=V\d+\.\d+"><\/script>/);
assert.ok(indexHtml.includes("pedsSection,\n                {\n                    key: 'clinical'"), 'peds section comes first (the rail opens it)');
assert.ok(indexHtml.includes("PedsDosing.sectionBodyHtml(drug._id, sec.peds, PedsDosing.state)") && indexHtml.includes('class="dc-row-peds"'));
assert.match(adminHtml, /onclick="dcaPedsImportOpen\(\)"/);

// dcPedsInput with a fake box: remembers kg / age, repaints the results
{
    const drug = { _id: 'd1', pedsDosing: P.forDoc(P.DATA[0]) };
    const forms = { innerHTML: '' }, kgEl = { value: '12' }, ageEl = null;
    const box = { dataset: { drugId: 'd1' }, querySelector: s => ({ '.dc-peds-kg': kgEl, '.dc-peds-age': ageEl, '.dc-peds-forms': forms })[s] };
    const ctx = { window: {}, PedsDosing: P, dcState: { codex: [drug] } };
    ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fn(indexHtml, 'window.dcPedsInput = function'), ctx);
    P.state.kg = null; P.state.age = null;
    ctx.window.dcPedsInput({ closest: () => box });
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
    assert.equal(Object.values(planOf([])).filter(x => x === 'create').length, 23);

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
    assert.match(t.overlay.innerHTML, /Import 22/);
    assert.match(t.overlay.innerHTML, /19 new · 2 add to existing · 1 replace · 1 already imported/);
    writes.length = 0;
    t.click('go'); await flush();
    assert.equal(writes.length, 22);
    const upd = writes.filter(w => w.op === 'update'), set = writes.filter(w => w.op === 'set');
    assert.deepEqual(upd.map(w => w.ref).sort(), ['drug_codex/A', 'drug_codex/C', 'drug_codex/P']);
    for (const u of upd) assert.deepEqual(Object.keys(u.data).sort(), ['pedsDosing', 'updatedAt'], 'existing docs: nothing but pedsDosing + updatedAt');
    assert.equal(set.length, 19);
    assert.deepEqual(set.find(w => w.data.genericName === 'Ketotifen').data.references, [], 'no Medscape page → no reference invented');
    const s0 = set.find(w => w.data.genericName === 'Salbutamol').data;
    assert.equal(JSON.stringify([s0.aiDrafted, s0.contributors, s0.references, s0.indication, s0.createdAt]), JSON.stringify([false, ['admin:owner@example.com'], [P.MEDSCAPE.salbutamol], '', 'TS'])); // JSON: arrays built inside the vm have another prototype
    assert.ok(s0.dosing.includes('Salbutamol 2 mg/5 ml') && s0.pedsDosing.forms.length === 1, 'new doc: dosing line + peds data');
    assert.ok(!('reviewedBy' in s0) && !('lastReviewedAt' in s0), 'a new doc is not marked as reviewed by the admin');
    assert.ok(t.toast().includes('19 new, 3 updated') && t.overlay.removed, 'toast + dialog closed');

    // a failing commit leaves the dialog open, the button usable, and says why
    const f = makeCtx(codex, true);
    f.ctx.dcaPedsImportOpen(); f.click('go'); await flush();
    assert.ok(/Peds import failed: permission-denied/.test(f.toast()));
    assert.ok(!f.overlay.removed && f.goBtn.disabled === false && f.goBtn.textContent === 'Import 22');

    // cancel writes nothing; everything already imported → nothing to do, button disabled
    writes.length = 0;
    const c2 = makeCtx(codex); c2.ctx.dcaPedsImportOpen(); c2.click('cancel');
    assert.ok(c2.overlay.removed && writes.length === 0);
    const all = P.DATA.map((d, i) => ({ _id: 'X' + i, genericName: d.genericName, pedsDosing: reorder(P.forDoc(d)) }));
    const c3 = makeCtx(all); c3.ctx.dcaPedsImportOpen();
    assert.ok(/data-act="go" disabled/.test(c3.overlay.innerHTML) && /Import 0/.test(c3.overlay.innerHTML));

    console.log('PASS: peds-dosing — 23 drugs / 24 forms (19 by weight, 5 by age); formula matches the printed table except the 6 listed source quirks; calculator spot checks (mg/kg/day split over the doses, per dose, mcg, MKD at age 0); the 4 half-cut age boundaries return both candidates; intern markup + dcPedsInput; admin import plan (create / add / replace / same, alias match) writes only pedsDosing+updatedAt to existing docs and survives failure / cancel / nothing-to-do');
})().catch(e => { console.error(e); process.exit(1); });
