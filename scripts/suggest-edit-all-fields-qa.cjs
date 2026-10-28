// V101.226 — Suggest edit / New entry / Edit pending / Resubmit cover EVERY topic of a Drug and a Disease entry (the REAL public/index.html on a phone,
// Firebase stubbed), and the admin review forms load a draft that carries all those keys (the REAL public/admin.html).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href, ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

const DRUG = { _id: 'x', genericName: 'Itraconazole', brandNames: ['Sporal', 'Sporanox'], atcCode: 'J02AC02', class: 'Azoles', indication: 'Fungal infections', dosing: 'Tinea: 100 mg daily', contraindication: 'Heart failure', sideEffects: 'Nausea', interactions: 'Warfarin; simvastatin', mechanism: 'Inhibits ergosterol synthesis', absorption: 'Improves with food', distribution: 'Vd 11 L/kg', metabolism: 'CYP3A4', excretion: 'Half-life 21 h', toxicity: 'QT prolongation', monitoring: 'LFT', patientCounseling: 'Take after a meal', pearls: 'Capsules need acid', references: ['https://example.com/a', 'PubMed 123'], status: 'published' };
const DISEASE = { _id: 'y', diseaseName: 'Dengue Fever', thaiName: 'ไข้เลือดออก', synonyms: ['Breakbone fever', 'DHF'], icd10: 'A90', category: 'Infectious', epidemiology: 'Tropical', etiology: 'Flavivirus', pathophysiology: 'Plasma leakage', symptoms: 'Fever, myalgia', signs: 'Positive tourniquet test', diagnosis: 'NS1', investigations: 'CBC, Hct', differential: 'Influenza', treatment: 'Fluids', nonPharm: 'Rest', complications: 'Shock', prognosis: 'Good', patientCounseling: 'Avoid NSAIDs', redFlags: 'Bleeding', pearls: 'Watch day 3–5', references: ['https://example.com/d'], status: 'published' };
const DC_KEYS = ['genericName', 'brandNames', 'atcCode', 'class', 'indication', 'dosing', 'contraindication', 'sideEffects', 'interactions', 'mechanism', 'absorption', 'distribution', 'metabolism', 'excretion', 'toxicity', 'monitoring', 'patientCounseling', 'pearls', 'references', 'internNotes'];
const DX_KEYS = ['diseaseName', 'thaiName', 'synonyms', 'icd10', 'category', 'epidemiology', 'etiology', 'pathophysiology', 'symptoms', 'signs', 'diagnosis', 'investigations', 'differential', 'treatment', 'nonPharm', 'complications', 'prognosis', 'patientCounseling', 'redFlags', 'pearls', 'references', 'internNotes'];
const expectText = (v) => Array.isArray(v) ? v.join(v.some(x => /^https?:|PubMed/.test(x)) ? '\n' : ', ') : String(v == null ? '' : v);

const initFirebase = () => {
    window.__adds = []; window.__updates = [];
    const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
    const coll = name => new Proxy({}, { get: (t, k) => k === 'add' ? async v => { window.__adds.push([name, v]); return { id: 'n1' }; } : k === 'doc' ? (id) => new Proxy({}, { get: (t2, k2) => k2 === 'update' ? async v => { window.__updates.push([name, id, v]); } : any }) : any });
    const fdb = new Proxy(function () {}, { get: (t, k) => k === 'collection' ? coll : (k === 'then' ? undefined : any), apply: () => any });
    const fs = () => fdb; fs.FieldValue = { serverTimestamp: () => 'TS', increment: n => n, arrayUnion: (...a) => a, delete: () => null };
    window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? fs : (k === 'then' ? undefined : any), apply: () => any });
};

const initAdmin = () => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); };
async function open(browser, url, width, init) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(init || initFirebase);
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.abort(); });
    await page.goto(url); await page.waitForTimeout(700);
    return { page, ctx, errors };
}

(async () => {
    const browser = await chromium.launch();
    try {
        let { page, ctx, errors } = await open(browser, INDEX, 390);
        await page.evaluate(([d, z]) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            window.__toasts = []; showToast = m => window.__toasts.push(m);
            ensureFirebaseAuthReady = async () => ({ uid: 'u1' }); userId = 'U1'; userProfile = { displayName: 'Bew', pictureUrl: '' };
            dcState.codex = [d]; dcState.currentDrug = d; dxState.codex = [z]; dxState.currentDisease = z;
        }, [DRUG, DISEASE]);
        const vals = (p, keys) => page.evaluate(([p, keys]) => Object.fromEntries(keys.map(k => [k, (document.getElementById(p + '-s-' + k) || {}).value])), [p, keys]);
        const groups = modal => page.evaluate(m => [...document.querySelectorAll('#' + m + ' details.dc-submit-group')].map(g => [g.dataset.grp, g.open, g.querySelector('.dc-submit-count').textContent, g.querySelector('.dc-submit-count').classList.contains('on')]), modal);

        // ---- DRUG · Suggest edit pre-fills every topic from the published doc
        await page.evaluate(d => dcOpenSubmit('suggest-edit', { drug: d }), DRUG); await page.waitForTimeout(150);
        let v = await vals('dc', DC_KEYS);
        DC_KEYS.filter(k => k !== 'internNotes').forEach(k => assert.equal(v[k], expectText(DRUG[k]), 'drug pre-fill ' + k));
        assert.equal(v.internNotes, '', 'the note starts empty'); assert.equal(v.references, 'https://example.com/a\nPubMed 123', 'references → one per line'); assert.equal(v.brandNames, 'Sporal, Sporanox');
        assert.deepEqual(await groups('drugCodexSubmitModal'), [['clinical', true, '5/5', true], ['moa', true, '1/1', true], ['pk', true, '5/5', true], ['edu', true, '3/3', true], ['refs', true, '1/1', true]], 'all five groups open with their counts');
        assert.equal(await page.evaluate(() => document.getElementById('dc-s-pk-legacy').hidden), true, 'no legacy note when ADMET is filled');
        assert.ok(await page.evaluate(() => /Suggest edit/.test(document.getElementById('dc-submit-mode-pill').textContent)));
        // typing changes a count, the payload carries every key with arrays back as arrays, a Suggest edit draft carries its target
        await page.fill('#dc-s-contraindication', ''); assert.equal((await groups('drugCodexSubmitModal'))[0][2], '4/5', 'clearing a field lowers the count');
        await page.fill('#dc-s-contraindication', 'Heart failure; liver disease'); await page.fill('#dc-s-references', 'https://example.com/a\n\nhttps://example.com/b\n');
        const pay = await page.evaluate(() => dcCollectSubmitForm());
        assert.deepEqual(Object.keys(pay), DC_KEYS, 'the payload has every key, in order'); assert.deepEqual(pay.references, ['https://example.com/a', 'https://example.com/b'], 'blank lines dropped'); assert.deepEqual(pay.brandNames, ['Sporal', 'Sporanox']);
        await page.evaluate(() => { window.__adds.length = 0; }); await page.click('#dc-submit-save-btn'); await page.waitForTimeout(250);
        const add = await page.evaluate(() => window.__adds.slice());
        assert.equal(add.length, 1, 'one draft written'); assert.equal(add[0][0], 'drug_codex_drafts'); assert.equal(add[0][1].targetDrugId, 'x'); assert.equal(add[0][1].status, 'pending'); assert.equal(add[0][1].contraindication, 'Heart failure; liver disease'); assert.deepEqual(add[0][1].references, ['https://example.com/a', 'https://example.com/b']);
        DC_KEYS.forEach(k => assert.ok(k in add[0][1], 'draft key ' + k));
        // required name still enforced
        await page.evaluate(d => dcOpenSubmit('suggest-edit', { drug: d }), DRUG); await page.fill('#dc-s-genericName', '  '); await page.evaluate(() => { window.__adds.length = 0; }); await page.click('#dc-submit-save-btn'); await page.waitForTimeout(150);
        assert.deepEqual([await page.evaluate(() => window.__adds.length), await page.evaluate(() => document.getElementById('dc-submit-error').textContent)], [0, 'Generic Name ห้ามว่าง']);

        // ---- DRUG · a sparse entry: groups with content open + the first empty one; the legacy single PK text is shown read-only, never copied
        const OLD = { _id: 'old', genericName: 'Old drug', indication: 'Only this', pharmacokinetics: 'Old combined PK text', status: 'published' };
        await page.evaluate(d => { dcState.codex.push(d); dcOpenSubmit('suggest-edit', { drug: d }); }, OLD); await page.waitForTimeout(150);
        assert.deepEqual(await groups('drugCodexSubmitModal'), [['clinical', true, '1/5', true], ['moa', true, '0/1', false], ['pk', false, '0/5', false], ['edu', false, '0/3', false], ['refs', false, '0/1', false]], 'content opens, then only the first empty group');
        const lg = await page.evaluate(() => { const e = document.getElementById('dc-s-pk-legacy'); return [e.hidden, e.textContent]; });
        assert.equal(lg[0], false); assert.match(lg[1], /Old combined PK text/); assert.equal((await vals('dc', ['absorption'])).absorption, '', 'the legacy text is not copied into a field');
        await page.evaluate(() => dcOpenSubmit('new', { from: 'drafts' })); assert.equal(await page.evaluate(() => document.getElementById('dc-s-pk-legacy').hidden), true, 'the note is gone for a new entry');
        assert.deepEqual((await groups('drugCodexSubmitModal')).map(g => g[1]), [true, false, false, false, false], 'a blank form opens only the first group');

        // ---- DRUG · draft round-trip: edit pending, resubmit
        const DRAFT = Object.assign({}, DRUG, { _id: 'd1', status: 'pending', targetDrugId: 'x', internNotes: 'check the dose' });
        await page.evaluate(d => { dcMyDraftsState.drafts = [d]; dcOpenSubmit('edit-pending', { draftId: 'd1' }); }, DRAFT); await page.waitForTimeout(150);
        v = await vals('dc', DC_KEYS); DC_KEYS.forEach(k => assert.equal(v[k], expectText(DRAFT[k]), 'edit-pending fills ' + k));
        await page.fill('#dc-s-toxicity', 'QT prolongation; CHF'); await page.evaluate(() => { window.__updates.length = 0; }); await page.click('#dc-submit-save-btn'); await page.waitForTimeout(250);
        const upd = await page.evaluate(() => window.__updates.slice()); assert.equal(upd.length, 1); assert.deepEqual(upd[0].slice(0, 2), ['drug_codex_drafts', 'd1']); assert.equal(upd[0][2].toxicity, 'QT prolongation; CHF'); assert.equal(upd[0][2].targetDrugId, 'x'); assert.equal(upd[0][2].status, 'pending');
        await page.evaluate(d => { dcMyDraftsState.drafts = [Object.assign({}, d, { status: 'rejected' })]; dcResubmit('d1'); }, DRAFT); await page.waitForTimeout(150);
        v = await vals('dc', DC_KEYS); DC_KEYS.forEach(k => assert.equal(v[k], expectText(DRAFT[k]), 'resubmit fills ' + k));
        // closing an unchanged prefilled form does not ask (dirty tracking sees all keys); an edit to a new field does
        assert.equal(await page.evaluate(() => ddCountChanged(dcSubmitState.snapshot, dcCollectSubmitForm())), 0); await page.fill('#dc-s-pearls', 'changed'); assert.equal(await page.evaluate(() => ddCountChanged(dcSubmitState.snapshot, dcCollectSubmitForm())), 1);

        // ---- DISEASE · same
        await page.evaluate(() => dcCloseSubmit());
        await page.evaluate(z => dxOpenSubmit('suggest-edit', { disease: z }), DISEASE); await page.waitForTimeout(150);
        v = await vals('dx', DX_KEYS); DX_KEYS.filter(k => k !== 'internNotes').forEach(k => assert.equal(v[k], expectText(DISEASE[k]), 'disease pre-fill ' + k));
        assert.equal(v.synonyms, 'Breakbone fever, DHF'); assert.equal(v.references, 'https://example.com/d');
        assert.deepEqual(await groups('diseaseCodexSubmitModal'), [['etio', true, '3/3', true], ['clinical', true, '2/2', true], ['dx', true, '3/3', true], ['mgmt', true, '7/7', true], ['refs', true, '1/1', true]]);
        await page.fill('#dx-s-redFlags', 'Bleeding; lethargy'); await page.fill('#dx-s-synonyms', 'Breakbone fever, DHF, Dengue');
        const dpay = await page.evaluate(() => dxCollectSubmitForm()); assert.deepEqual(Object.keys(dpay), DX_KEYS); assert.deepEqual(dpay.synonyms, ['Breakbone fever', 'DHF', 'Dengue']); assert.deepEqual(dpay.references, ['https://example.com/d']);
        await page.evaluate(() => { window.__adds.length = 0; }); await page.click('#dx-submit-save-btn'); await page.waitForTimeout(250);
        const dadd = await page.evaluate(() => window.__adds.slice()); assert.equal(dadd.length, 1); assert.equal(dadd[0][0], 'disease_codex_drafts'); assert.equal(dadd[0][1].targetDiseaseId, 'y'); assert.equal(dadd[0][1].redFlags, 'Bleeding; lethargy'); DX_KEYS.forEach(k => assert.ok(k in dadd[0][1], 'disease draft key ' + k));
        await page.evaluate(z => dxOpenSubmit('suggest-edit', { disease: z }), DISEASE); await page.fill('#dx-s-diseaseName', ''); await page.evaluate(() => { window.__adds.length = 0; }); await page.click('#dx-submit-save-btn'); await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => window.__adds.length), 0, 'a disease needs its name');
        await page.evaluate(() => dxOpenSubmit('new', { from: 'drafts' })); assert.deepEqual((await groups('diseaseCodexSubmitModal')).map(g => g[1]), [true, false, false, false, false]);
        await page.screenshot({ path: (process.env.QA_SHOT || process.env.TEMP) + '/shots/se_disease_new.png', fullPage: false }).catch(() => {});
        if (process.env.QA_SHOT) {
            await page.evaluate(d => dcOpenSubmit('suggest-edit', { drug: d }), OLD); await page.waitForTimeout(200); await page.evaluate(() => document.querySelector('#drugCodexSubmitModal .dc-submit-body').scrollTo(0, 260)); await page.screenshot({ path: process.env.QA_SHOT + '/se_drug_sparse.png' });
        }
        const mine = errors.filter(e => /dcFill|dcCollect|dxFill|dxCollect|ddSyncSubmitGroups|dcOpenSubmit|dxOpenSubmit/.test(e)); assert.deepEqual(mine, [], mine.join(' | ')); await ctx.close();

        // ---- admin: the review forms load a draft that carries every one of those keys
        ({ page, ctx, errors } = await open(browser, ADMIN, 1200, initAdmin));
        await page.waitForFunction(() => typeof dcaFillForm === 'function' && typeof dxaFillForm === 'function', null, { timeout: 30000 });
        const loaded = await page.evaluate(([d, z]) => {
            const out = { dc: {}, dx: {} };
            dcaFillForm(d); DCA_FIELD_KEYS.forEach(k => { const e = document.getElementById('dca-f-' + k); out.dc[k] = e ? e.value : '(no field)'; if (DCA_EDU_I18N_FIELDS.includes(k)) { const s = (dcaEduI18nState.data[k] || {})[DCA_EDU_I18N_PRIMARY[k]]; out.dc[k] = s == null ? '' : s; } });   // the three Education fields live in the language bundle: the root value is the PRIMARY-language text (Monitoring EN · Patient Counseling TH · Pearls EN)
            dxaFillForm(z); DXA_FIELD_KEYS.forEach(k => { const e = document.getElementById('dxa-f-' + k); out.dx[k] = e ? e.value : '(no field)'; if (DXA_EDU_I18N_FIELDS.includes(k)) { const s = (dxaEduI18nState.data[k] || {})[DXA_EDU_I18N_PRIMARY[k]]; out.dx[k] = s == null ? '' : s; } });
            out.dcKeys = DCA_FIELD_KEYS.slice(); out.dxKeys = DXA_FIELD_KEYS.slice(); return out;
        }, [Object.assign({}, DRUG, { internNotes: 'n' }), Object.assign({}, DISEASE, { internNotes: 'n' })]);
        const adminDc = loaded.dcKeys, adminDx = loaded.dxKeys;
        assert.deepEqual(DC_KEYS.filter(k => k !== 'internNotes').sort(), adminDc.slice().sort(), 'the intern Drug form has exactly the admin fields');
        assert.deepEqual(DX_KEYS.filter(k => k !== 'internNotes').sort(), adminDx.slice().sort(), 'the intern Disease form has exactly the admin fields');
        adminDc.forEach(k => { assert.notEqual(loaded.dc[k], '(no field)', 'admin has dca-f-' + k); assert.equal(loaded.dc[k], expectText(DRUG[k]), 'admin loads ' + k); });
        adminDx.forEach(k => { assert.notEqual(loaded.dx[k], '(no field)', 'admin has dxa-f-' + k); assert.equal(loaded.dx[k], expectText(DISEASE[k]), 'admin loads ' + k); });
        await ctx.close();
        console.log('PASS: Suggest edit / New / Edit pending / Resubmit cover every topic — Drug (19 fields) and Disease (21): full pre-fill from the published doc, groups with counts and open rule, legacy PK shown read-only, payload with every key (arrays back to arrays), name still required, dirty tracking, and the admin review forms load the same keys');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
