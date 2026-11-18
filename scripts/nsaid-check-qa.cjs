// V101.324 (owner pick C + A, mockup-nsaid-allergy): NSAID hypersensitivity (EAACI 2013) in the intern Drug Codex.
//  · public/nsaid-check.js: 7 chemical groups, drug → group by name, answers → phenotype (NERD · NECD · NIUA · SNIUAA · SNIDR / severe), copy text;
//  · A: "⚠️ แพ้ NSAIDs?" first section on drugs of those groups only; chips repaint the card; the result card + 📋 text has no patient name;
//  · C: 🧪 in the Codex toolbar and the group badge open the 7-group map; a drug with a page opens it; nothing is saved or sent.
const path = require('node:path'), assert = require('node:assert/strict'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const N = require(path.resolve('public/nsaid-check.js'));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ✓ ' + m); };

// --- 1. data + rules ---
ok(N.GROUPS.length === 7 && N.GROUPS.map(g => g.n).join() === '1,2,3,4,5,6,7', 'seven EAACI chemical groups');
const g = name => (N.groupOf(name) || { g: { n: 0 } }).g.n;
ok(g('Ibuprofen') === 3 && g('Diclofenac sodium') === 4 && g('PIROXICAM') === 5 && g('Paracetamol') === 2 && g('Mefenamic acid') === 6 && g('Celecoxib') === 7 && g('Aspirin') === 1, 'Codex names map to their group (case and salt ignored)');
ok(g('Tramadol + Paracetamol') === 0 && g('metformin') === 0, 'a combination led by another drug, or a non-NSAID, gets no card');
ok(N.groupOf('Meloxicam').cox === 'p' && N.groupOf('Piroxicam').cox === 's', 'meloxicam = preferential COX-2 inside the oxicams');
const ib = N.groupOf('Ibuprofen'), ph = a => (N.phenotype(a, ib) || { code: null }).code;
ok(ph({ when: 'acute', what: 'airway_asthma' }) === 'NERD' && ph({ when: 'acute', what: 'hives_csu' }) === 'NECD', 'acute airway + asthma → NERD · hives in chronic urticaria → NECD');
ok(ph({ when: 'acute', what: 'hives' }) === null && ph({ when: 'acute', what: 'hives', other: 'yes' }) === 'NIUA' && ph({ when: 'acute', what: 'hives', other: 'no' }) === 'SNIUAA', 'hives in a healthy person waits for "other groups?" → NIUA or SNIUAA');
ok(ph({ when: 'late', what: 'mild' }) === 'SNIDR' && /🚩/.test(ph({ when: 'late', what: 'severe' })), 'delayed: mild → SNIDR · severe → 🚩 refer');
const niua = N.phenotype({ when: 'acute', what: 'hives', other: 'yes' }, ib), sni = N.phenotype({ when: 'acute', what: 'hives', other: 'no' }, ib);
ok(niua.cross && /1 · 3 · 4 · 5 · 6/.test(niua.avoid) && /paracetamol < 1,000/.test(niua.use), 'cross-reactive: avoid every strong COX-1 group; paracetamol < 1,000 mg / tested coxib');
ok(!sni.cross && /Ibuprofen/.test(sni.avoid) && /Propionic/.test(sni.avoid) && /กลุ่มเคมีอื่น/.test(sni.use), 'single-reactor: avoid the drug and its own group; other groups may be used');
const sev = N.phenotype({ when: 'late', what: 'severe' }, ib);
ok(/ทันที/.test(sev.refer) && /ห้ามลองยาเอง/.test(sev.use), 'severe delayed: refer now, never re-try');
const note = N.noteText(ib, niua);
ok(/^แพ้ยา: Ibuprofen \(Propionic acid derivatives\)/.test(note) && /EAACI 2013/.test(note) && !/HN|ชื่อผู้ป่วย:/.test(note), 'the copy text names the drug, phenotype, avoid / use and EAACI — no patient name');
ok(!/firestore|fetch\(|localStorage|XMLHttpRequest/.test(fs.readFileSync('public/nsaid-check.js', 'utf8')), 'nsaid-check.js writes and sends nothing');

// --- 2. the real intern page ---
const IBU = { _id: 'ibu', genericName: 'Ibuprofen', atcCode: 'M01AE01', class: 'NSAID', indication: 'Pain', dosing: '400 mg', status: 'published' };
const DIC = { _id: 'dic', genericName: 'Diclofenac sodium', atcCode: 'M01AB05', class: 'NSAID', indication: 'Pain', dosing: '50 mg', status: 'published' };
const MET = { _id: 'met', genericName: 'metformin', atcCode: 'A10BA02', class: 'Biguanide', indication: 'T2DM', dosing: '500 mg', status: 'published' };
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href); await page.waitForTimeout(600);
        ok(await page.evaluate(() => !!window.NsaidCheck && typeof dcNsaidPick === 'function' && typeof NsaidCheck.openMap === 'function'), 'nsaid-check.js is loaded and wired');
        await page.evaluate(ds => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            dcState.codex = ds; dcLangState.selectedLang = 'orig'; window.copied = null; window.dcCopyText = t => { window.copied = t; };
        }, [IBU, DIC, MET]);
        await page.evaluate(() => dcOpenDetail('met')); await page.waitForTimeout(200);
        ok(!(await page.$('#dc-detail-body [data-section-key="nsaid"]')), 'metformin: no NSAID card');
        await page.evaluate(() => dcOpenDetail('ibu')); await page.waitForTimeout(300);
        const keys = await page.$$eval('#dc-detail-body .dc-detail-section', s => s.map(x => x.dataset.sectionKey));
        ok(keys[0] === 'nsaid' && await page.$eval('#dc-detail-body [data-section-key="nsaid"]', d => d.open), 'ibuprofen: ⚠️ is the first section and the rail opens it');
        ok(/3 · Propionic/.test(await page.$eval('#dc-detail-body .nx-b.g', b => b.textContent)) && /Strong COX-1/.test(await page.$eval('#dc-detail-body .nx-grp', b => b.textContent)), 'group + COX badge');
        const qs = () => page.$$eval('#dc-detail-body .nx-q', q => q.map(x => x.textContent.slice(0, 1)).join(''));
        ok(await qs() === '1' && !(await page.$('#dc-detail-body .nx-res')), 'starts with question 1 only, no result');
        await page.click('#dc-detail-body .nx-c[data-v="acute"]'); ok(await qs() === '12', 'acute → question 2 (acute symptoms)');
        await page.click('#dc-detail-body .nx-c[data-v="hives"]'); ok(await qs() === '123' && !(await page.$('#dc-detail-body .nx-res')), 'hives → question 3 (other groups?), still no result');
        await page.click('#dc-detail-body .nx-c[data-v="yes"]');
        ok(/^NIUA/.test(await page.$eval('#dc-detail-body .nx-res', r => r.textContent.trim())), 'yes → NIUA result card');
        await page.click('#dc-detail-body .nx-act button');
        ok(/^แพ้ยา: Ibuprofen/.test(await page.evaluate(() => window.copied)), '📋 copies the allergy note');
        await page.click('#dc-detail-body .nx-c[data-v="late"]');
        ok(await qs() === '12' && !(await page.$('#dc-detail-body .nx-res')), 'changing question 1 clears the later answers');
        await page.click('#dc-detail-body .nx-c[data-v="severe"]');
        ok(await page.$('#dc-detail-body .nx-res.red') !== null, 'severe delayed → red card');
        await page.evaluate(() => dcOpenDetail('dic')); await page.waitForTimeout(250);
        ok(!(await page.$('#dc-detail-body .nx-res')) && /4 · Acetic/.test(await page.$eval('#dc-detail-body .nx-b.g', b => b.textContent)), 'another drug starts again, with its own group');
        await page.click('#dc-detail-body .nx-b.g');
        ok(await page.$eval('#nx-map', m => !m.hidden && m.querySelectorAll('.nx-g').length === 7), 'the group badge opens the 7-group map');
        ok(await page.$eval('#nx-map .nx-d.here', d => d.textContent) === 'Diclofenac', 'the drug it came from is marked');
        ok(await page.$$eval('#nx-map .nx-d.no', d => d.some(x => x.textContent === 'Naproxen')), 'a drug without a Codex page is dashed');
        await page.click('#nx-map button.nx-d >> text=Ibuprofen'); await page.waitForTimeout(250);
        ok(await page.$eval('#nx-map', m => m.hidden) && /3 · Propionic/.test(await page.$eval('#dc-detail-body .nx-b.g', b => b.textContent)), 'tapping Ibuprofen closes the map and opens its page');
        ok(await page.$('#dc-nsaid-map-btn') !== null, '🧪 button in the Codex toolbar');
        await page.evaluate(() => NsaidCheck.openMap()); ok(await page.$eval('#nx-map', m => !m.hidden && !m.querySelector('.nx-d.here')), 'the toolbar opens the map with nothing marked');
        await page.click('#nx-map .nx-map-h button'); ok(await page.$eval('#nx-map', m => m.hidden), '✕ closes the map');
        ok(errors.filter(e => /nsaid|Nsaid|nx|dc/i.test(e)).length === 0, 'no page errors: ' + errors.join(' | '));
        console.log(`\nnsaid-check-qa: ${n} checks passed`);
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e && e.message); process.exit(1); });
