// V101.323 (owner pick A, mockup-ir-calculator): 🧮 insulin-resistance calculator in the intern Drug Codex.
//  · public/ir-calc.js: TyG = ln(TG × FBS / 2) · HOMA-IR = FBS × insulin / 405 · TG/HDL; ADA bands for FBS / HbA1c; each result only when its inputs are there;
//  · shown first (like 👶) on drugs whose ATC starts with A10, nowhere else; typing repaints the chips only; tapping a chip shows its formula + source;
//  · nothing is written anywhere (no Firestore, no fetch).
// The REAL public/index.html (network blocked, Firebase stubbed).
const path = require('node:path'), assert = require('node:assert/strict'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const IR = require(path.resolve('public/ir-calc.js'));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ✓ ' + m); };

// --- 1. the maths (pure) ---
const S = (o) => Object.assign({ fbs: null, a1c: null, tg: null, hdl: null, ins: null }, o);
const r1 = IR.results(S({ fbs: 108, a1c: 5.9, tg: 180, hdl: 38, ins: 12 }));
ok(JSON.stringify(r1.map(r => [r.label, r.value, r.tag, r.level])) === JSON.stringify([['FBS', '108', 'Pre-DM', 'a'], ['A1c', '5.9', 'Pre-DM', 'a'], ['TyG', '9.18', 'IR', 'r'], ['HOMA-IR', '3.2', 'IR', 'r'], ['TG/HDL', '4.7', 'IR', 'r']]), 'worked example: FBS 108 · A1c 5.9 · TyG 9.18 · HOMA-IR 3.2 · TG/HDL 4.7');
ok(Math.abs(Math.log(180 * 108 / 2) - 9.18) < 0.005 && Math.abs(108 * 12 / 405 - 3.2) < 0.05, 'TyG = ln(TG × FBS / 2), HOMA-IR = FBS × insulin / 405');
const lv = (o, k) => (IR.results(S(o)).find(r => r.k === k) || {}).level;
ok(lv({ fbs: 99 }, 'fbs') === 'g' && lv({ fbs: 100 }, 'fbs') === 'a' && lv({ fbs: 125 }, 'fbs') === 'a' && lv({ fbs: 126 }, 'fbs') === 'r', 'FBS ADA bands: < 100 · 100–125 · ≥ 126');
ok(lv({ a1c: 5.6 }, 'a1c') === 'g' && lv({ a1c: 5.7 }, 'a1c') === 'a' && lv({ a1c: 6.5 }, 'a1c') === 'r', 'HbA1c ADA bands: < 5.7 · 5.7–6.4 · ≥ 6.5');
ok(lv({ fbs: 90, ins: 11 }, 'homa') === 'g' && lv({ fbs: 90, ins: 12 }, 'homa') === 'r', 'HOMA-IR cut-off 2.5 (90×11/405 = 2.44 · 90×12/405 = 2.67)');
ok(lv({ tg: 89, hdl: 30 }, 'tghdl') === 'g' && lv({ tg: 90, hdl: 30 }, 'tghdl') === 'r', 'TG/HDL cut-off 3.0');
ok(IR.results(S({ tg: 150 })).length === 0 && IR.results(S({ tg: 150, hdl: 50 })).map(r => r.k).join() === 'tghdl', 'a result appears only when its inputs are there');
IR.set('fbs', '9999'); ok(IR.state.fbs === null, 'a typo outside the range is ignored');
ok(IR.applies({ atcCode: 'A10BA02' }) && IR.applies({ atcCode: ' a10bh01' }) && !IR.applies({ atcCode: 'M03BX09' }) && !IR.applies({}), 'only ATC A10 drugs');
ok(Object.keys(IR.SRC).every(k => /\d/.test(IR.SRC[k])), 'every chip has a formula / cut-off note');
ok(!/firestore|fetch\(|localStorage|XMLHttpRequest/.test(fs.readFileSync('public/ir-calc.js', 'utf8')), 'ir-calc.js writes and sends nothing');

// --- 2. the real intern page ---
const MET = { _id: 'met', genericName: 'metformin', atcCode: 'A10BA02', class: 'Biguanide', brandNames: ['Glucophage'], indication: 'Type 2 diabetes', dosing: '500 mg twice daily', status: 'published' };
const EPE = { _id: 'ep', genericName: 'Eperisone', atcCode: 'M03BX09', class: 'Muscle relaxant', indication: 'Spasticity', dosing: '50 mg tid', status: 'published' };
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href); await page.waitForTimeout(600);
        ok(await page.evaluate(() => !!window.IrCalc && typeof dcIrInput === 'function'), 'ir-calc.js is loaded on the intern page');
        await page.evaluate(ds => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            dcState.codex = ds; dcLangState.selectedLang = 'orig';
        }, [MET, EPE]);
        await page.evaluate(() => dcOpenDetail('ep')); await page.waitForTimeout(250);
        ok(!(await page.$('#dc-detail-body [data-section-key="ir"]')), 'a non-diabetes drug has no 🧮');
        await page.evaluate(() => dcOpenDetail('met')); await page.waitForTimeout(300);
        const keys = await page.$$eval('#dc-detail-body .dc-detail-section', s => s.map(x => x.dataset.sectionKey));
        ok(keys[0] === 'ir', 'metformin: 🧮 is the first section: ' + keys.slice(0, 3).join(' '));
        ok(await page.$$eval('#drugCodexDetailModal .dc-sec-chip', cs => /Insulin resistance/.test(cs[0] && cs[0].textContent)), 'the rail starts with 🧮 Insulin resistance');
        ok(await page.$eval('#dc-detail-body [data-section-key="ir"]', d => d.open), 'the rail opens it, like 👶');
        ok((await page.$$('#dc-detail-body .dc-ir-in')).length === 5 && (await page.$$('#dc-detail-body .dc-ir-c')).length === 0, 'five empty boxes, no chips yet');
        for (const [k, v] of [['fbs', '108'], ['a1c', '5.9'], ['tg', '180'], ['hdl', '38'], ['ins', '12']]) await page.fill(`#dc-detail-body .dc-ir-in[data-k="${k}"]`, v);
        const chips = await page.$$eval('#dc-detail-body .dc-ir-c', cs => cs.map(c => c.className.replace('dc-ir-c ', '') + ':' + c.textContent));
        ok(chips.join(' | ') === 'a:FBS 108Pre-DM | a:A1c 5.9Pre-DM | r:TyG 9.18IR | r:HOMA-IR 3.2IR | r:TG/HDL 4.7IR', 'chips appear as you type: ' + chips.join(' | '));
        ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('.dc-ir-in[data-k="ins"]')), 'typing keeps the caret in the box (only the chips repaint)');
        await page.click('#dc-detail-body .dc-ir-c[data-k="homa"]');
        ok(/405/.test(await page.$eval('#dc-detail-body .dc-ir-why', w => w.hidden ? '' : w.textContent)), 'tap HOMA-IR → its formula and source under the chips');
        await page.click('#dc-detail-body .dc-ir-c[data-k="homa"]');
        ok(await page.$eval('#dc-detail-body .dc-ir-why', w => w.hidden), 'tap again → hidden');
        await page.evaluate(() => { if (typeof dcCloseDetail === 'function') dcCloseDetail(); dcOpenDetail('met'); }); await page.waitForTimeout(250);
        ok(await page.$eval('#dc-detail-body .dc-ir-in[data-k="fbs"]', i => i.value) === '108' && (await page.$$('#dc-detail-body .dc-ir-c')).length === 5, 'reopening keeps the numbers for this visit');
        await page.evaluate(() => { dcLangState.selectedLang = 'th'; dcRenderDetail(dcState.codex[0]); }); await page.waitForTimeout(200);
        ok(/ไม่ส่งออก/.test(await page.$eval('#dc-detail-body .dc-ir-note', d => d.textContent)), 'Thai page → Thai note');
        ok(errors.filter(e => /ir|dc|Codex/i.test(e)).length === 0, 'no page errors: ' + errors.join(' | '));
        console.log(`\nir-calculator-qa: ${n} checks passed`);
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e && e.message); process.exit(1); });
