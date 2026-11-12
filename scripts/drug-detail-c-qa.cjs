// V101.309 (owner pick C, mockup-drug-detail-lean): the intern Drug Codex entry is grouped by the questions asked at the counter —
// 💊 How to give · ⛔ Who must not · ⚠️ What to watch · 🗣 Tell the patient · 🧬 Why it works · 🔗 References (+ 👶 first when there is a peds dose).
// Same fields, only regrouped: interactions / side effects / monitoring / toxicity under ⚠️, counselling + pearls under 🗣, mechanism + ADMET under 🧬.
// On a Thai page the titles and field names are Thai. The REAL public/index.html (network blocked, Firebase stubbed).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const DRUG = { _id: 'ag', genericName: 'Agomelatine', atcCode: 'N06AX22', class: 'Melatonergic antidepressant', brandNames: ['Valdoxan'],
    indication: 'Major depression', dosing: '25 mg at bedtime', contraindication: 'Hepatic impairment', sideEffects: 'Dizziness', interactions: 'Fluvoxamine: avoid',
    mechanism: 'MT1/MT2 agonist + 5-HT2C antagonist', absorption: 'Rapid', distribution: '95% bound', metabolism: 'CYP1A2', excretion: 'Urine', toxicity: 'Hepatotoxicity',
    monitoring: 'LFT at 0, 6, 12 weeks', patientCounseling: 'Take at bedtime', pearls: 'Low sexual dysfunction', references: ['MIMS'], status: 'published' };

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 420, height: 900 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX); await page.waitForTimeout(600);
        const read = () => page.evaluate(() => [...document.querySelectorAll('#dc-detail-body .dc-detail-section')].filter(s => s.dataset.sectionKey !== 'discussion').map(s => {
            const sum = s.querySelector('summary').cloneNode(true); sum.querySelectorAll('.dc-sec-copy').forEach(x => x.remove());
            return [s.dataset.sectionKey, sum.textContent.replace(/\s+/g, ' ').trim(), [...s.querySelectorAll('.dc-detail-field-label')].map(l => l.textContent.trim())];
        }));
        await page.evaluate(d => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            dcState.codex = [d]; dcLangState.selectedLang = 'orig'; dcOpenDetail('ag');
        }, DRUG);
        await page.waitForTimeout(300);
        assert.deepEqual(await read(), [
            ['give', '💊 How to give', ['Indication', 'Dosing']],
            ['avoid', '⛔ Who must not', ['Contraindication']],
            ['watch', '⚠️ What to watch', ['Interactions', 'Side Effects', 'Monitoring', 'Toxicity']],
            ['tell', '🗣 Tell the patient', ['Patient Counseling', 'Clinical Pearls']],
            ['why', '🧬 Why it works', ['Mechanism', 'Absorption', 'Distribution', 'Metabolism', 'Excretion']],
            ['refs', '🔗 References', []]]);
        assert.deepEqual(await page.$$eval('#drugCodexDetailModal .dc-sec-chip', cs => cs.map(c => c.textContent.trim())).then(a => a.slice(0, 5)), ['💊 How to give', '⛔ Who must not', '⚠️ What to watch', '🗣 Tell the patient', '🧬 Why it works'], 'the rail asks the same questions');

        // a Thai page: Thai titles and field names (the values come from the cached translation; here the original text is fine)
        await page.evaluate(() => { dcLangState.selectedLang = 'th'; dcRenderDetail(dcState.codex[0]); });
        await page.waitForTimeout(200);
        const th = await read();
        assert.deepEqual(th.map(x => x[1]), ['💊 ให้ยังไง', '⛔ ห้ามใคร', '⚠️ ระวังอะไร', '🗣 บอกผู้ป่วยว่า', '🧬 ทำไมได้ผล', '🔗 อ้างอิง']);
        assert.deepEqual(th[2][2], ['ยาตีกัน', 'ผลข้างเคียง', 'การติดตาม', 'พิษ · ได้รับเกินขนาด']);
        assert.deepEqual(th[4][2], ['กลไก', 'การดูดซึม', 'การกระจาย', 'การเปลี่ยนแปลง', 'การขับออก']);

        // an empty question is left out (no contraindication → no ⛔)
        await page.evaluate(() => { dcLangState.selectedLang = 'orig'; const d = Object.assign({}, dcState.codex[0], { _id: 'n', contraindication: '' }); dcState.codex.push(d); dcOpenDetail('n'); });
        await page.waitForTimeout(300);
        assert.ok(!(await read()).some(x => x[0] === 'avoid'), 'no ⛔ when nothing is written');
        if (process.env.OUTDIR) await page.screenshot({ path: process.env.OUTDIR + '/drug-detail-c.png' });
        assert.deepEqual(errors.filter(e => /dc|Codex/i.test(e)), [], errors.join(' | '));
        console.log('PASS: intern drug entry pick C — 💊 How to give · ⛔ Who must not · ⚠️ What to watch · 🗣 Tell the patient · 🧬 Why it works · 🔗; same fields regrouped; Thai titles + labels on a Thai page; an empty question is left out');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
