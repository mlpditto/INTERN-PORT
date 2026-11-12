// V102.640 (owner pick 2, mockup-codex-batch-review): Drug Codex — review many AI drafts in ONE sheet. The REAL admin.html (network stubbed;
// Firestore batch, AI Review and the jevCheckDrug callable stubbed and recorded):
// · the batch bar's 📋 Review n opens the sheet; "One by one" keeps the old form path;
// · ⚡ Short fields: ATC / Class / Brands only for drugs that had them EMPTY; ticked by default; a bad ATC shape comes unticked + amber;
//   a cell can be edited; "Save n ticked" writes only those fields (+ aiDrafted, the drafter model) in one batch and drops them from the draft;
// · 🩺 Clinical: 🔍 runs AI Review on a model from ANOTHER provider + Jev per drug; clean = no safety / factual / consistency finding and Jev ok
//   (ticked); ⚠ n opens the full form; "Save n ticked" writes the clean drugs' fields; Thai-primary Education fields go to educationI18n too.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: v => ({ union: v }) } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaSheetOpen === 'function' && typeof dcaRenderPublishedList === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(() => {
            const empty = Object.fromEntries(DCA_FIELD_KEYS.map(k => [k, DCA_ARRAY_FIELDS[k] ? [] : '']));
            const at = ms => ({ toMillis: () => ms, toDate: () => new Date(ms), seconds: ms / 1000 });
            dcaState.codex = [
                Object.assign({}, empty, { _id: 'hyo', genericName: 'Hyoscine', createdAt: at(1e12), updatedAt: at(1e12) }),
                Object.assign({}, empty, { _id: 'phe', genericName: 'Phenobarbital', createdAt: at(1e12), updatedAt: at(1e12) }),
                Object.assign({}, empty, { _id: 'mvt', genericName: 'Multivitamin', brandNames: ['Berocca'], createdAt: at(1e12), updatedAt: at(1e12) }),
            ];
            const full = (atc, cls, br) => ({ atcCode: atc, class: cls, brandNames: br, indication: 'Ind', dosing: 'Dose', patientCounseling: 'บอกผู้ป่วย', pearls: 'Pearl' });
            dcaBatch.results = { hyo: { fill: full('A04AD01', 'Antimuscarinic', ['Buscopan']), edu: [], model: 'gpt-6-luna', name: 'Hyoscine' },
                phe: { fill: full('N03AA02', 'Barbiturate', ['Gardenal']), edu: [], model: 'gpt-6-luna', name: 'Phenobarbital' },
                mvt: { fill: full('A11BA', 'Vitamin', ['Other']), edu: [], model: 'gpt-6-luna', name: 'Multivitamin' } };
            dcaBatch.status = { hyo: 'ok', phe: 'ok', mvt: 'ok' };
            window.__writes = []; window.__commits = 0;
            window.db = { collection: c => ({ doc: id => ({ c, id }) }), batch: () => ({ update: (ref, data) => __writes.push([ref.c, ref.id, JSON.parse(JSON.stringify(data))]), commit: async () => { window.__commits++; } }) };
            window.auth = { currentUser: { email: 'admin@test' } };
            window.showToast = () => {};
            window.__ai = []; window.__jev = [];
            window.callUniversalAI = async (model, prompt) => { const name = (prompt.match(/Phenobarbital|Hyoscine|Multivitamin/) || [''])[0]; window.__ai.push([model, name]);
                return { text: JSON.stringify({ findings: name === 'Phenobarbital' ? [{ field: 'dosing', severity: 'safety', issue: 'Dose too high' }] : [{ field: 'pearls', severity: 'suggestion', issue: 'Could add more' }], overallNote: '' }) }; };
            window.adminApp = { functions: () => ({ httpsCallable: n => async d => { window.__jev.push([n, d.name, Object.keys(d.sections)]); return { data: { enabled: true, sections: { clinical: { verdict: 'ok' } }, langs: {} } }; } }) };
            window.__opened = []; window.dcaBatchReview = id => __opened.push(id);
            const m = document.getElementById('drugCodexAdminModal'); m.style.setProperty('display', 'block', 'important');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            dcaSwitchView('published'); dcaRenderPublishedList(); dcaBatchRenderBar();
        });

        // the bar: 📋 Review 3 + One by one
        assert.deepEqual(await page.$$eval('#dca-batch-bar button', bs => bs.map(b => b.textContent.trim())), ['📋 Review 3', 'One by one']);
        await page.click('#dca-batch-bar button:has-text("📋 Review 3")');
        const S = '#dca-sheet';
        assert.deepEqual(await page.$$eval(S + ' .dca-rs-tabs button', bs => bs.map(b => b.textContent.trim())), ['⚡ Short fields 3', '🩺 Clinical 3', '✕']);

        // ⚡ table: only empty fields; Multivitamin had brands → "—"; its ATC A11BA is the wrong shape → unticked + amber
        const rows = await page.$$eval(S + ' .dca-rs-t tr', trs => trs.slice(1).map(tr => [tr.querySelector('.nm').textContent, tr.querySelector('input[type=checkbox]').checked, [...tr.querySelectorAll('td')].slice(2).map(td => { const i = td.querySelector('input'); return i ? i.value + (i.classList.contains('bad') ? '!' : '') : td.textContent; })]));
        assert.deepEqual(rows, [['Hyoscine', true, ['A04AD01', 'Antimuscarinic', 'Buscopan']], ['Phenobarbital', true, ['N03AA02', 'Barbiturate', 'Gardenal']], ['Multivitamin', false, ['A11BA!', 'Vitamin', '—']]]);
        if (process.env.OUTDIR) await page.locator(S + ' .dca-rs').screenshot({ path: process.env.OUTDIR + '/review-sheet-short.png' });
        // edit Phenobarbital's class, then save the 2 ticked
        await page.fill(S + ' input[aria-label="class for Phenobarbital"]', 'Barbiturate anticonvulsant'); await page.press(S + ' input[aria-label="class for Phenobarbital"]', 'Tab');
        await page.click(S + ' .dca-rs-foot .go');
        await page.waitForFunction(() => window.__commits === 1);
        const w1 = await page.evaluate(() => __writes.splice(0));
        assert.deepEqual(w1.map(w => [w[1], w[2].atcCode, w[2].class, w[2].brandNames, w[2].aiDrafted, w[2].aiDraftedModel, w[2].contributors]), [
            ['hyo', 'A04AD01', 'Antimuscarinic', ['Buscopan'], true, 'gpt-6-luna', { union: 'admin:admin@test' }],
            ['phe', 'N03AA02', 'Barbiturate anticonvulsant', ['Gardenal'], true, 'gpt-6-luna', { union: 'admin:admin@test' }]]);
        assert.ok(w1.every(w => !('indication' in w[2])), 'the short save writes only ATC / Class / Brands');
        assert.deepEqual(await page.evaluate(() => Object.keys(dcaBatch.results.hyo.fill).sort()), ['dosing', 'indication', 'patientCounseling', 'pearls'], 'saved short fields leave the draft');
        assert.equal(await page.$$eval(S + ' .dca-rs-t tr', t => t.length - 1), 1, 'Multivitamin (unticked) stays');

        // 🩺 Clinical: check all → AI Review on another provider + Jev; Phenobarbital ⚠ 1, the others clean + ticked
        await page.click(S + ' .dca-rs-tabs button:has-text("Clinical")');
        await page.click(S + ' .dca-rs-foot .chk');
        await page.waitForFunction(() => !document.querySelector('#dca-sheet .dca-rs-foot .chk') || !/Checking/.test(document.querySelector('#dca-sheet .dca-rs-foot .chk').textContent));
        await page.waitForFunction(() => document.querySelectorAll('#dca-sheet .dca-rs-p.ok, #dca-sheet .dca-rs-p.bad').length === 3);
        const ai = await page.evaluate(() => window.__ai);
        assert.equal(ai.length, 3); assert.ok(ai.every(([m]) => !/luna|gpt/i.test(m)), 'review model is from another provider than the drafter: ' + ai.map(a => a[0]));
        assert.deepEqual((await page.evaluate(() => window.__jev)).map(j => j[0] + ':' + j[1]).sort(), ['jevCheckDrug:Hyoscine', 'jevCheckDrug:Multivitamin', 'jevCheckDrug:Phenobarbital']);
        const cl = await page.$$eval(S + ' .dca-rs-row', rs => rs.map(r => [r.querySelector('.nm').textContent, r.querySelector('.dca-rs-p').textContent.trim(), !!(r.querySelector('input') && r.querySelector('input').checked)]));
        assert.deepEqual(cl, [['Hyoscine', '✓ clean', true], ['Phenobarbital', '⚠ 1', false], ['Multivitamin', '✓ clean', true]], 'a suggestion does not block; a safety finding does');
        await page.click(S + ' .dca-rs-p.bad');
        assert.deepEqual(await page.evaluate(() => __opened), ['phe'], '⚠ opens the full form');
        assert.equal(await page.isVisible(S), false);
        await page.click('#dca-batch-bar button:has-text("📋 Review")'); await page.click(S + ' .dca-rs-tabs button:has-text("Clinical")');
        await page.click(S + ' .dca-rs-foot .go');
        await page.waitForFunction(() => window.__commits === 2);
        const w2 = await page.evaluate(() => __writes.splice(0));
        assert.deepEqual(w2.map(w => w[1]), ['hyo', 'mvt']);
        assert.deepEqual(Object.keys(w2[0][2]).filter(k => !['updatedAt', 'contributors', 'aiDrafted', 'aiDraftedModel'].includes(k)).sort(), ['dosing', 'educationI18n.patientCounseling.th', 'educationI18n.pearls.en', 'indication', 'patientCounseling', 'pearls']);
        assert.ok(!('atcCode' in w2[0][2]), 'already-saved short fields are not written again');
        assert.ok('atcCode' in w2[1][2] === false || w2[1][2].atcCode === undefined, 'Multivitamin\'s unticked ATC is not slipped in by the clinical save');
        assert.equal(await page.evaluate(() => dcaBatch.results.hyo), undefined, 'a fully saved draft is done');
        if (process.env.OUTDIR) { await page.click(S + ' .dca-rs-tabs button:has-text("Short")'); await page.locator(S + ' .dca-rs').screenshot({ path: process.env.OUTDIR + '/review-sheet.png' }); }
        assert.deepEqual(errs.filter(e => /dca|Codex|sheet/i.test(e)), [], errs.join(' | '));
        console.log('PASS: Drug Codex review sheet — 📋 Review n, ⚡ short fields (empty only, bad ATC unticked, editable, one batch, aiDrafted kept), 🩺 clinical (AI Review on another provider + Jev, suggestion ≠ block, ⚠ opens the form, clean saved with Edu i18n)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
