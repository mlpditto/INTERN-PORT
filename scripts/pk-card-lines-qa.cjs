// Drug Codex ▸ edit a published drug ▸ 📊 tab ▸ "🧠 Card lines" (V102.652, step 1 of the intern PK flash cards): five one-line facts
// A D M E T. 🤖 Shorten asks the model once (the same prompt as the ADMET picture labels), the admin edits, 💾 writes
// drug_codex/{id}.pkCard on its own. Hidden on a draft and on Add. The REAL admin.html in Chromium; AI and Firestore are stubbed.
//   node scripts/pk-card-lines-qa.cjs      SHOT=<dir> writes a PNG
const path = require('node:path'), fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(admin));
assert.ok(admin.indexOf('id="dca-pk-card"') > admin.indexOf('id="dca-f-toxicity"') && admin.indexOf('id="dca-pk-card"') < admin.indexOf('id="dca-pk-visual-current"'), 'the block sits under the five PK fields, above the saved picture');
assert.ok(/id="dca-pk-card" class="dca-pkc lang-no-toggle" hidden/.test(admin), 'hidden until a published drug is open; Thai lines are not hidden by lang-toggle');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaPkCardPaint === 'function' && typeof dcaFillForm === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        // a published drug open on the PK tab; Firestore + AI recorded
        await page.evaluate(() => {
            window.__w = []; window.__ai = []; window.__toast = [];
            window.showToast = m => window.__toast.push(String(m));
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'NOW', delete: () => 'DELETE', arrayUnion: (...a) => a } } };
            window.db = { collection: c => ({ doc: id => ({ update: async p => { if (window.__fail) throw new Error('offline'); window.__w.push([c, id, JSON.parse(JSON.stringify(p))]); } }) }) };
            window.auth = { currentUser: { email: 'admin@test' } };
            window.callUniversalAI = async (model, prompt) => { window.__ai.push(prompt); return { text: window.__answer }; };
            window.__answer = JSON.stringify({ a: 'กิน · F ~x% · Tmax x ชม.', d: 'จับโปรตีน x%', m: 'ตับ · CYP3A4', e: 'ปัสสาวะ · t½ x ชม.', t: 'มือสั่น · ใจสั่น · K↓ ' + 'ยาว'.repeat(30) });
            const drug = { _id: 'p1', genericName: 'Procaterol', absorption: 'Well absorbed orally. Tmax about x h.', distribution: 'Protein binding x%.', metabolism: 'Hepatic, CYP3A4.', excretion: 'Urine. Half-life x h.', toxicity: 'Tremor, palpitations, hypokalaemia.' };
            dcaState.codex = [drug, { _id: 'p2', genericName: 'Empty', pkCard: { a: 'เดิม A', e: 'เดิม E', lang: 'en' } }];
            window.__open = (id, draft) => { dcaState.editingId = id; dcaState.isDraftEdit = !!draft; dcaFillForm(dcaState.codex.find(d => d._id === id) || {}); };
            document.getElementById('drugCodexAdminModal').style.display = 'flex';
            const f = document.getElementById('dca-view-form'); if (f) f.style.display = 'block';
            const l = document.getElementById('dca-view-published'); if (l) l.style.display = 'none';
            window.__open('p1');
            if (typeof dcaSwitchSection === 'function') dcaSwitchSection('pk');
        });
        await page.waitForTimeout(200);
        const ui = () => page.evaluate(() => ({ hidden: document.getElementById('dca-pk-card').hidden, vals: ['a', 'd', 'm', 'e', 't'].map(k => document.getElementById('dca-pkc-' + k).value), lang: document.querySelector('input[name="dca-pkc-lang"]:checked').value, state: document.getElementById('dca-pkc-state').textContent, counts: [...document.querySelectorAll('#dca-pk-card .dca-pkc-row small')].map(s => s.textContent) }));

        // 1. empty on a drug with no lines; visible; one head row
        let u = await ui();
        assert.deepEqual([u.hidden, u.vals, u.lang, u.state], [false, ['', '', '', '', ''], 'th', ''], JSON.stringify(u));
        const geo = await page.evaluate(() => { const h = document.querySelector('#dca-pk-card .dca-pkc-head'), tops = new Set([...h.children].map(c => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2))); const rows = [...document.querySelectorAll('#dca-pk-card .dca-pkc-row')].map(r => Math.round(r.getBoundingClientRect().height)); return { visible: h.getBoundingClientRect().width > 0, spread: Math.max(...tops) - Math.min(...tops), rows, letters: [...document.querySelectorAll('#dca-pk-card .dca-pkc-row i')].map(i => i.textContent).join('') }; });
        assert.ok(geo.visible && geo.spread <= 6 && geo.letters === 'ADMET' && geo.rows.every(h => h <= 40), 'one head row, five slim rows A D M E T: ' + JSON.stringify(geo));
        if (process.env.SHOT) await page.locator('.dca-form-section[data-tab="pk"]').screenshot({ path: path.join(process.env.SHOT, 'pk-card-empty.png') });

        // 2. 🤖 Shorten: one call, the PK fields in the prompt, Thai asked for, lines ≤ 60 chars, marked not saved, nothing written
        await page.click('#dca-pkc-ai');
        await page.waitForFunction(() => document.getElementById('dca-pkc-state').dataset.s === 'dirty');
        u = await ui();
        assert.deepEqual(u.vals.slice(0, 4), ['กิน · F ~x% · Tmax x ชม.', 'จับโปรตีน x%', 'ตับ · CYP3A4', 'ปัสสาวะ · t½ x ชม.']);
        assert.ok(u.vals[4].length === 60 && u.state === '● not saved' && u.counts[4] === '60', 'a long line is cut at 60 and counted: ' + JSON.stringify(u));
        const ai = await page.evaluate(() => window.__ai);
        assert.equal(ai.length, 1); assert.match(ai[0], /Write in Thai/); assert.match(ai[0], /a \(absorption\): Well absorbed orally/); assert.match(ai[0], /Do not add facts that are not in the field/);
        assert.deepEqual(await page.evaluate(() => window.__w), [], 'shortening writes nothing');
        if (process.env.SHOT) await page.locator('.dca-form-section[data-tab="pk"]').screenshot({ path: path.join(process.env.SHOT, 'pk-card-filled.png') });

        // 3. edit one line, 💾: only pkCard + updatedAt go to drug_codex/p1; the list copy follows; state = saved
        await page.fill('#dca-pkc-t', '  มือสั่น ·   ใจสั่น  ');
        await page.click('#dca-pkc-save');
        await page.waitForFunction(() => document.getElementById('dca-pkc-state').dataset.s === 'saved');
        const w = await page.evaluate(() => window.__w);
        assert.deepEqual(w, [['drug_codex', 'p1', { pkCard: { at: 'NOW', by: 'admin@test', a: 'กิน · F ~x% · Tmax x ชม.', d: 'จับโปรตีน x%', m: 'ตับ · CYP3A4', e: 'ปัสสาวะ · t½ x ชม.', t: 'มือสั่น · ใจสั่น', lang: 'th' }, updatedAt: 'NOW' }]], JSON.stringify(w));
        assert.deepEqual(await page.evaluate(() => dcaState.codex[0].pkCard), { a: 'กิน · F ~x% · Tmax x ชม.', d: 'จับโปรตีน x%', m: 'ตับ · CYP3A4', e: 'ปัสสาวะ · t½ x ชม.', t: 'มือสั่น · ใจสั่น', lang: 'th' });
        // refilling the form from a merged AI draft (no pkCard on the object) keeps the saved lines
        await page.evaluate(() => dcaFillForm({ genericName: 'Procaterol', absorption: 'x' }));
        assert.equal((await ui()).vals[0], 'กิน · F ~x% · Tmax x ชม.', 'a refill without pkCard falls back to the list copy');

        // 4. a drug with saved lines opens with them (and its language); clearing all five + 💾 removes the field
        await page.evaluate(() => window.__open('p2'));
        u = await ui();
        assert.deepEqual([u.vals, u.lang, u.state], [['เดิม A', '', '', 'เดิม E', ''], 'en', '✓ saved']);
        await page.evaluate(() => { window.__w.length = 0; ['a', 'e'].forEach(k => { document.getElementById('dca-pkc-' + k).value = ''; }); });
        await page.click('#dca-pkc-save');
        await page.waitForFunction(() => window.__w.length === 1);
        assert.deepEqual(await page.evaluate(() => [window.__w[0][2], 'pkCard' in dcaState.codex[1]]), [{ pkCard: 'DELETE', updatedAt: 'NOW' }, false]);

        // 5. failures: no PK text → no AI call; the model answers nothing → toast, fields untouched; a failed write stays "not saved"
        await page.evaluate(() => { window.__ai.length = 0; window.__toast.length = 0; });
        await page.click('#dca-pkc-ai');
        await page.waitForTimeout(100);
        assert.deepEqual(await page.evaluate(() => [window.__ai.length, /Fill the PK fields first/.test(window.__toast.join())]), [0, true]);
        await page.evaluate(() => { window.__open('p1'); window.__answer = 'not json'; window.__toast.length = 0; });
        await page.click('#dca-pkc-ai');
        await page.waitForFunction(() => window.__toast.some(t => /Could not shorten/.test(t)));
        assert.equal((await ui()).vals[0], 'กิน · F ~x% · Tmax x ชม.', 'a bad answer leaves the lines as they were');
        await page.evaluate(() => { window.__fail = true; window.__toast.length = 0; document.getElementById('dca-pkc-a').value = 'ใหม่'; });
        await page.click('#dca-pkc-save');
        await page.waitForFunction(() => window.__toast.some(t => /Save failed: offline/.test(t)));
        assert.equal((await ui()).state, '● not saved');

        // 6. a draft under review and the Add form do not show the block; 💾 refuses
        await page.evaluate(() => { window.__fail = false; window.__w.length = 0; window.__open('p1', true); });
        assert.equal((await ui()).hidden, true, 'hidden on a draft');
        await page.evaluate(() => dcaPkCardSave());
        assert.deepEqual(await page.evaluate(() => window.__w), [], 'no write for a draft');
        await page.evaluate(() => { dcaState.editingId = null; dcaState.isDraftEdit = false; dcaFillForm({}); });
        assert.equal((await ui()).hidden, true, 'hidden on Add');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Drug Codex 🧠 Card lines (V102.652) — five one-line A D M E T facts under the PK fields on a published drug; 🤖 Shorten = one AI call (Thai / EN, ≤ 60 chars, nothing written); 💾 writes only pkCard; saved lines reopen; clearing removes the field; hidden on drafts and Add');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
