// V102.696 (owner 2026-11-20, mockup-drug-fda-save/): Drug Codex editor — less clutter.
//  · 🇹🇭 Indication (Thai FDA) and 🚩 Red flags: the label is the icon only (the words overflowed the narrow label column and covered the box);
//    the words are in the box's placeholder.
//  · ONE 💾 (pick A): 🧠 Card lines have no 💾 / "✓ saved" of their own; a change puts a dot on 💾 Save Drug, and Save Drug writes pkCard in the
//    same update as the drug. The step strip's last step is "🖼 Picture on the page" (no second 💾).
//  · The ADMET words sit in a strip UNDER the picture (pick P1) — admin preview + saved thumbnail; index.html does the same for interns.
// The REAL admin.html in Chromium; Firestore is stubbed (writes captured).
const path = require('node:path'), fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAEklEQVR4nGP4z8BAEmIY1TByNQAAH9mPcQ0FOT4AAAAASUVORK5CYII=';
{
    const idx = fs.readFileSync('public/index.html', 'utf8');
    ok(/\.dc-pkv-l \{ position: static;/.test(idx) && /class="dc-pkv-strip"/.test(idx) && !/\.dc-pkv-d \{ left: 2%; top: 42%; \}/.test(idx), 'intern page: the words are a strip under the picture (no slot over it)');
}
(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaFillForm === 'function' && typeof dcaSaveForm === 'function' && typeof dcaPkSteps === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(png => {
            window.__w = []; window.showToast = () => {}; window.recordAiEval = () => {};
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'NOW', delete: () => 'DELETE', arrayUnion: (...a) => a } } };
            window.db = { collection: c => ({ doc: id => ({ update: async p => { window.__w.push([c, id, JSON.parse(JSON.stringify(p))]); } }), add: async p => { window.__w.push([c, 'new', p]); } }) };
            window.auth = { currentUser: { email: 'admin@test' } };
            window.dcaSwitchView = () => {};
            const d = { _id: 'g1', genericName: 'EGb761', absorption: 'Tmax 2-3 h', distribution: 'Wide', metabolism: 'Glucuronidation', excretion: 'Urine', toxicity: 'Mild',
                pkCard: { a: 'Old A', d: 'Old D', lang: 'th' }, pkVisual: { downloadUrl: png, style: 'infographic', model: 'x', labels: { a: 'Tmax 2-3 ชม.', d: 'ข้าม BBB ได้', m: 'glucuronidation', e: 'ปัสสาวะ', t: 'ไร้ antidote' }, labelLang: 'th' } };
            dcaState.codex = [d]; dcaState.editingId = 'g1'; dcaState.isDraftEdit = false; dcaState.pkVisual = d.pkVisual; dcaState.formAiDrafted = false;
            document.getElementById('drugCodexAdminModal').style.display = 'flex';
            const f = document.getElementById('dca-view-form'); if (f) f.style.display = 'block';
            const l = document.getElementById('dca-view-published'); if (l) l.style.display = 'none';
            dcaFillForm(d);
        }, PNG);

        console.log('🇹🇭 / 🚩 rows');
        await page.evaluate(() => dcaSwitchSection('clinical'));
        const lab = await page.evaluate(() => ['dca-f-indicationThFda', 'dca-f-redFlags'].map(id => { const l = document.querySelector('label[for="' + id + '"]'), t = document.getElementById(id), a = l.getBoundingClientRect(), b = t.getBoundingClientRect();
            return { text: l.textContent.trim(), fits: a.right <= b.left + 1, tall: Math.round(a.height), ph: t.placeholder }; }));
        ok(lab[0].text === '🇹🇭' && lab[1].text === '🚩', 'the labels are the icons only: ' + lab.map(x => x.text).join(' '));
        ok(lab.every(x => x.fits && x.tall <= 32), 'nothing reaches into the box, one line each: ' + JSON.stringify(lab.map(x => [x.fits, x.tall])));
        ok(/Indication \(Thai FDA\)/.test(lab[0].ph) && /Red flags/.test(lab[1].ph), 'the words are in the boxes: ' + lab.map(x => x.ph).join(' | '));

        console.log('one 💾');
        await page.evaluate(() => dcaSwitchSection('pk'));
        const v0 = await page.evaluate(() => ({ own: (b => !!b && b.getClientRects().length > 0)(document.getElementById('dca-pkc-save')), words: document.getElementById('dca-pkc-state').textContent, dot: document.getElementById('dca-form-save-btn').classList.contains('dca-dirty') }));
        ok(!v0.own && v0.words === '' && !v0.dot, 'Card lines have no 💾 and no "✓ saved" of their own; Save Drug has no dot yet');
        await page.fill('#dca-pkc-a', 'กิน Tmax 2-3 ชม. ดูดซึม 79-88%');
        const v1 = await page.evaluate(() => ({ dot: document.getElementById('dca-form-save-btn').classList.contains('dca-dirty'), after: getComputedStyle(document.getElementById('dca-form-save-btn'), '::after').backgroundColor, pulse: document.getElementById('dca-form-save-btn').classList.contains('dca-pulse'),
            steps: [...document.querySelectorAll('#dca-pk-steps span')].map(s => s.textContent).join(' › ') }));
        ok(v1.dot && v1.after === 'rgb(245, 158, 11)' && v1.pulse, 'a changed line → an amber dot on 💾 Save Drug, and it pulses as the next step');
        ok(/🖼 Picture on the page/.test(v1.steps) && !/💾/.test(v1.steps), 'the strip names no second 💾: ' + v1.steps);
        await page.evaluate(() => dcaSaveForm());
        await page.waitForFunction(() => window.__w.length >= 1);
        const w = await page.evaluate(() => window.__w);
        ok(w.length === 1 && w[0][0] === 'drug_codex' && w[0][1] === 'g1', 'Save Drug = ONE write to the drug');
        ok(w[0][2].pkCard && w[0][2].pkCard.a === 'กิน Tmax 2-3 ชม. ดูดซึม 79-88%' && w[0][2].pkCard.d === 'Old D' && w[0][2].pkCard.lang === 'th' && w[0][2].pkCard.by === 'admin@test', 'the Card lines ride in that write: ' + JSON.stringify(w[0][2].pkCard));
        ok(!(await page.evaluate(() => document.getElementById('dca-form-save-btn').classList.contains('dca-dirty'))), 'saved → the dot is gone');
        // an unchanged card is not rewritten
        await page.evaluate(() => { window.__w = []; dcaState.editingId = 'g1'; dcaFillForm(dcaState.codex[0]); });
        await page.evaluate(() => dcaSaveForm()); await page.waitForFunction(() => window.__w.length >= 1);
        ok(!('pkCard' in (await page.evaluate(() => window.__w[0][2]))), 'no change in the lines → Save Drug leaves pkCard alone');

        console.log('words under the picture');
        await page.evaluate(() => { dcaState.editingId = 'g1'; dcaFillForm(dcaState.codex[0]); dcaSwitchSection('pk'); });
        await page.waitForFunction(() => document.querySelectorAll('#dca-pk-visual-current-labels .pv-l').length === 5);
        const th = await page.evaluate(() => { const img = document.getElementById('dca-pk-visual-current-img').getBoundingClientRect(); return [...document.querySelectorAll('#dca-pk-visual-current-labels .pv-l')].map(s => Math.round(s.getBoundingClientRect().top - img.bottom)); });
        ok(th.every(d => d >= 0), 'saved thumbnail: every word is under the picture (px below: ' + th.join(',') + ')');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\ndrug-one-save-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
