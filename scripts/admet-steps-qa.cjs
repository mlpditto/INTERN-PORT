// V102.676 (owner pick C, mockup-admet-steps/): Drug Codex ▸ a published drug ▸ 📊 tab.
// A step strip — 🧠 Card lines › 🎨 Visual › 💾 Save the picture — says what to press next: done steps are green, the next one is blue and its REAL
// button pulses (a ring; still under prefers-reduced-motion); the strip is gone once all three are done. The picture's words are the 🧠 Card lines
// (no second AI shortening), and the "Saved ADMET Visual" thumbnail draws those words over the picture — a picture made without text no longer
// looks as if it had none. The REAL admin.html in Chromium; AI, Storage and Firestore are stubbed.
//   node scripts/admet-steps-qa.cjs      SHOT=<dir> writes PNGs
const path = require('node:path'), fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAEklEQVR4nGP4z8BAEmIY1TByNQAAH9mPcQ0FOT4AAAAASUVORK5CYII=';
{
    const a = fs.readFileSync('public/admin.html', 'utf8');
    ok(a.indexOf('id="dca-pk-steps"') > a.indexOf('id="dca-f-toxicity"') && a.indexOf('id="dca-pk-steps"') < a.indexOf('id="dca-pk-card"') && /@media \(prefers-reduced-motion: reduce\) \{ \.dca-pulse \{ animation: none;/.test(a), 'the strip sits under the PK fields, right above 🧠 Card lines; the pulse has a still version');
}
(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: SHOT ? 1.5 : 1 });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaPkSteps === 'function' && typeof dcaPkCardPaint === 'function' && typeof dcaFillForm === 'function' && typeof dcaOpenPkVisualModal === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(png => {
            const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450; const g = cv.getContext('2d');
            const gr = g.createLinearGradient(0, 0, 800, 0); gr.addColorStop(0, '#fef3c7'); gr.addColorStop(1, '#e0f2fe'); g.fillStyle = gr; g.fillRect(0, 0, 800, 450);
            [['#fdba74', 200, 150, 60], ['#93c5fd', 400, 220, 90], ['#86efac', 590, 170, 55], ['#f0abfc', 620, 350, 50]].forEach(([c, x, y, r]) => { g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2); });
            window.__png = cv.toDataURL('image/png');
            window.__w = []; window.__ai = []; window.__toast = [];
            window.showToast = m => window.__toast.push(String(m));
            window.recordAiEval = () => {};
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'NOW', delete: () => 'DELETE', arrayUnion: (...a) => a } } };
            window.db = { collection: c => ({ doc: id => ({ update: async p => { window.__w.push([c, id, JSON.parse(JSON.stringify(p))]); } }) }) };
            window.auth = { currentUser: { email: 'admin@test' } };
            const ref = { getDownloadURL: async () => { const e = new Error('nf'); e.code = 'storage/object-not-found'; throw e; }, put: async () => ({ ref: { getDownloadURL: async () => window.__png } }) };
            adminApp = { storage: () => ({ ref: () => ref }), auth: () => ({ currentUser: { email: 'admin@test' } }) };
            window.callUniversalAI = async (model, prompt, isJson) => { window.__ai.push(isJson ? 'json' : 'image'); if (isJson) return { text: window.__answer }; return { imageDataUrl: window.__png }; };
            window.__answer = JSON.stringify({ a: 'Fast oral uptake, Tmax 1.6-1.9 h', d: 'Crosses the BBB, protein >70%', m: 'Liver, inactive metabolites', e: 'Urine 70-80% in 24 h', t: 'Overdose: sedation, low BP ' + 'x'.repeat(60) });
            const pk = { absorption: 'Rapidly absorbed from the gastrointestinal tract. Tmax about 1.6 to 1.9 hours.', distribution: 'Widely distributed. Protein binding high.', metabolism: 'Extensively metabolized in the liver.', excretion: 'Excreted primarily via the kidneys.', toxicity: 'Overdose manifests as extreme somnolence.' };
            dcaState.codex = [Object.assign({ _id: 'p1', genericName: 'Tolperisone' }, pk), Object.assign({ _id: 'p2', genericName: 'Has card', pkCard: { a: 'Old A', e: 'Old E', lang: 'en' } }, pk),
                Object.assign({ _id: 'p3', genericName: 'Has picture', pkVisual: { downloadUrl: window.__png, style: 'infographic', model: 'as/gemini-nano-banana-2.1', labels: { a: 'Saved A <b>', m: 'Saved M' }, labelLang: 'en' } }, pk),
                Object.assign({ _id: 'p4', genericName: 'Old picture', pkVisual: { downloadUrl: window.__png, style: 'diagram', model: 'x' } }, pk)];
            window.__open = (id, draft) => { dcaState.editingId = id; dcaState.isDraftEdit = !!draft; const d = dcaState.codex.find(x => x._id === id) || {}; dcaState.pkVisual = d.pkVisual || null; if (typeof dcaPkVisualState !== 'undefined') { dcaPkVisualState.lastImageDataUrl = ''; dcaPkVisualState.fromSaved = false; } dcaFillForm(d); };
            document.getElementById('drugCodexAdminModal').style.display = 'flex';
            const f = document.getElementById('dca-view-form'); if (f) f.style.display = 'block';
            const l = document.getElementById('dca-view-published'); if (l) l.style.display = 'none';
            window.__open('p1');
            if (typeof dcaSwitchSection === 'function') dcaSwitchSection('pk');
        }, PNG);
        const view = () => page.evaluate(() => { const el = document.getElementById('dca-pk-steps'), vis = e => !!e && e.getClientRects().length > 0, wrap = document.getElementById('dca-pk-visual-current');
            return { shown: vis(el), steps: el ? [...el.querySelectorAll('span')].map(s => s.textContent + (s.classList.contains('done') ? '✓' : s.classList.contains('next') ? '*' : '')).join(' › ') : '',
                pulse: ['dca-pkc-ai', 'dca-pkc-save', 'dca-pk-visual-open', 'dcaPkVisualGenerateBtn', 'dcaPkVisualSaveBtn'].filter(id => { const b = document.getElementById(id); return !!b && b.classList.contains('dca-pulse'); }).join(' '),
                anim: (b => b ? getComputedStyle(b).animationName : '')(document.querySelector('.dca-pulse')), state: (document.getElementById('dca-pkc-state') || {}).textContent || '',
                thumb: vis(wrap), words: wrap ? [...wrap.querySelectorAll('#dca-pk-visual-current-labels .pv-l')].map(s => s.textContent) : [], rawB: wrap ? /<b>/.test(document.getElementById('dca-pk-visual-current-labels').innerHTML) : false, meta: (document.getElementById('dca-pk-visual-current-meta') || {}).textContent || '',
                inPic: wrap ? [...wrap.querySelectorAll('#dca-pk-visual-current-labels .pv-l')].every(s => { const a = s.getBoundingClientRect(), b = document.getElementById('dca-pk-visual-current-img').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1; }) : true,
                ai: window.__ai.join(','), labels: typeof dcaPkVisualState !== 'undefined' && dcaPkVisualState.labels ? JSON.parse(JSON.stringify(dcaPkVisualState.labels)) : null, lang: (document.getElementById('dca-pv-lang-btn') || {}).textContent }; });
        const shot = async n => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); };

        console.log('the step strip');
        let v = await view();
        ok(v.shown && v.steps === '1 🧠 Card lines* › 2 🎨 Visual › 3 💾 Save the picture' && v.pulse === 'dca-pkc-ai' && v.anim === 'dcaPulse' && !v.thumb, 'a published drug with nothing yet: three steps, the first is next, and 🤖 Shorten pulses');
        await page.evaluate(() => document.getElementById('dca-pk-steps').scrollIntoView({ block: 'center' })); await shot('steps-1');
        await page.click('#dca-pkc-ai'); await page.waitForFunction(() => document.getElementById('dca-pkc-a').value.length > 0); v = await view();
        ok(v.state === '● not saved' && v.pulse === 'dca-pkc-save' && /Card lines\*/.test(v.steps), 'lines written → the pulse moves to 💾 beside them (still step 1)');
        await page.click('#dca-pkc-save'); await page.waitForFunction(() => window.__w.length === 1); v = await view();
        ok(v.steps === '✓ 🧠 Card lines✓ › 2 🎨 Visual* › 3 💾 Save the picture' && v.pulse === 'dca-pk-visual-open dcaPkVisualGenerateBtn' && v.ai === 'json', 'saved → step 1 is green ✓, step 2 is next and the 🎨 Visual button pulses (and Generate, inside its window)');
        await shot('steps-2');

        console.log('the picture takes the Card lines as its words');
        await page.click('#dca-pk-visual-open'); await page.waitForFunction(() => getComputedStyle(document.getElementById('dcaPkVisualModal')).display === 'flex'); v = await view();
        ok(v.pulse === 'dca-pk-visual-open dcaPkVisualGenerateBtn', 'in the window, Generate pulses');
        await page.click('#dcaPkVisualGenerateBtn'); await page.waitForFunction(() => document.querySelector('#dcaPkVisualLabels [data-k="a"]') && !dcaPkVisualState.generating); await page.waitForTimeout(250); v = await view();
        ok(v.ai === 'json,image' && v.labels.a === 'Fast oral uptake, Tmax 1.6-1.9 h' && v.labels.e === 'Urine 70-80% in 24 h' && v.labels.t.length === 60 && Object.keys(v.labels).length === 5, 'one image call and NO second shortening call: the five Card lines are the words over the picture');
        ok(v.steps === '✓ 🧠 Card lines✓ › ✓ 🎨 Visual✓ › 3 💾 Save the picture*' && v.pulse === 'dca-pk-visual-open dcaPkVisualSaveBtn', 'a picture exists → step 3 is next and 💾 Save pulses (Generate no longer does)');
        await shot('steps-3');
        await page.click('#dcaPkVisualSaveBtn'); await page.waitForFunction(() => window.__w.length === 2); await page.waitForTimeout(200);
        const upd = await page.evaluate(() => window.__w[1][2].pkVisual); v = await view();
        ok(upd.labels.a === 'Fast oral uptake, Tmax 1.6-1.9 h' && upd.labelLang === 'th' && Object.keys(upd.labels).length === 5, 'Save stores those words with the picture (pkVisual.labels)');

        console.log('the saved-picture thumbnail');
        await page.evaluate(() => { if (typeof dcaClosePkVisualModal === 'function') dcaClosePkVisualModal(); document.getElementById('dca-pk-visual-current').scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(150); v = await view();
        ok(v.thumb && v.words.length === 5 && v.words[0] === 'AFast oral uptake, Tmax 1.6-1.9 h' && v.inPic && /🔤 5 words over it/.test(v.meta), 'the thumbnail draws the five words over the picture, inside it; the caption says so: ' + v.meta);
        ok(!v.shown && v.pulse === '', 'all three steps done → the strip is gone and nothing pulses');
        await shot('steps-done');
        await page.evaluate(() => window.__open('p3')); v = await view();
        ok(v.words.join('|') === 'ASaved A <b>|MSaved M' && !v.rawB && /🔤 2 words over it/.test(v.meta), 'a picture saved earlier with words shows them too; the text is escaped');
        ok(v.shown && v.steps === '1 🧠 Card lines* › ✓ 🎨 Visual✓ › ✓ 💾 Save the picture✓' && v.pulse === 'dca-pkc-ai', 'it has no Card lines yet → only step 1 is left');
        await page.evaluate(() => window.__open('p4')); v = await view();
        ok(v.thumb && v.words.length === 0 && !/🔤/.test(v.meta) && /Generated · diagram/.test(v.meta), 'an old picture with its own text (no saved words): the thumbnail is the picture alone, as before');
        await page.evaluate(() => window.__open('p2')); v = await view();
        ok(v.steps === '✓ 🧠 Card lines✓ › 2 🎨 Visual* › 3 💾 Save the picture' && !v.thumb, 'a drug that already has Card lines opens on step 2');
        await page.evaluate(() => window.__open('p1', true)); v = await view();
        ok(!v.shown && v.pulse === '', 'a draft: no strip, nothing pulses (Card lines are for published drugs)');
        await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => window.__open('p2')); v = await view();
        ok(v.anim === 'none' && await page.evaluate(() => getComputedStyle(document.querySelector('.dca-pulse')).boxShadow !== 'none'), 'reduce-motion: a still ring instead of the pulse');
        ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
        console.log('\nadmet-steps-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
