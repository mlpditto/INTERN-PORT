// V102.641 / V101.311 (owner pick A + B, mockup-admet-visual-lean): Generate ADMET Visual is one header row (model ▾), one chip row,
// A D M E T dots with "n empty · 🤖 Fill", Generate in the middle of the picture, ⬇ / 💾 only once there is a picture. With 🔤 on (default)
// the picture is asked for with NO text and the PK words are laid over it — quick words first, the AI's short ones replace them, a tap
// edits one in place, and Save stores them on pkVisual.labels; the intern drug page draws them in the same slots. The REAL admin.html +
// index.html in Chromium; AI, Storage and Firestore are stubbed.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAEklEQVR4nGP4z8BAEmIY1TByNQAAH9mPcQ0FOT4AAAAASUVORK5CYII=';

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        // ---------------- admin ----------------
        const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof dcaOpenPkVisualModal === 'function' && typeof dcaPkVisualRenderLabels === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        await page.evaluate(png => {
            // a 16:9 stand-in picture (no text) so the label slots can be seen in the screenshot
            const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450; const g = cv.getContext('2d');
            const gr = g.createLinearGradient(0, 0, 800, 0); gr.addColorStop(0, '#ede9fe'); gr.addColorStop(1, '#e0f2fe'); g.fillStyle = gr; g.fillRect(0, 0, 800, 450);
            [['#fca5a5', 380, 130, 50], ['#fdba74', 400, 260, 70], ['#a78bfa', 350, 380, 22], ['#a78bfa', 450, 380, 22]].forEach(([c, x, y, r]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
            png = cv.toDataURL('image/png'); window.__png = png;
            window.dcaCollectForm = () => ({ genericName: 'gabapentin', absorption: 'Saturable absorption in the proximal small intestine. Bioavailability falls as the dose rises.', class: 'Gabapentinoid' });
            dcaState.codex = []; dcaState.editingId = null; dcaState.isDraftEdit = false;
            window.__calls = [];
            window.callUniversalAI = async (model, prompt, isJson, vision, key, opts) => {
                window.__calls.push({ model, prompt, isJson, opts });
                if (isJson) { await new Promise(r => setTimeout(r, 150)); return { text: '{"a":"ดูดซึมที่ลำไส้เล็กส่วนต้น · F ลดเมื่อขนาดสูง","d":"","m":"","e":"","t":""}' }; }
                return { imageDataUrl: png };
            };
            window.recordAiEval = (...a) => { (window.__eval = window.__eval || []).push(a.join('|')); };
            dcaOpenPkVisualModal();
        }, PNG);
        const open = await page.evaluate(() => ({
            shown: getComputedStyle(document.getElementById('dcaPkVisualModal')).display,
            dots: [...document.querySelectorAll('#dcaPkVisualAdmet b')].map(b => b.textContent + (b.classList.contains('e') ? '○' : '●')).join(''),
            warn: (document.querySelector('#dcaPkVisualAdmet .pv-warn') || {}).textContent,
            fill: !!document.querySelector('#dcaPkVisualAdmet .pv-fill'),
            gen: !!document.querySelector('#dcaPkVisualPlaceholder #dcaPkVisualGenerateBtn') && getComputedStyle(document.getElementById('dcaPkVisualPlaceholder')).display !== 'none',
            foot: ['dcaPkVisualRegenBtn', 'dcaPkVisualDownloadBtn', 'dcaPkVisualSaveBtn'].map(id => document.getElementById(id).hidden),
            model: document.getElementById('dcaPkVisualModelBtn').textContent, menu: document.getElementById('dcaPkVisualModelRail').hidden,
            extra: document.getElementById('dca-pv-extra-box').hidden, overlay: document.getElementById('dca-pv-overlay').checked,
            meta: document.getElementById('dcaPkVisualMeta').textContent, oldText: /Phase 2|Generates an ADMET infographic/.test(document.getElementById('dcaPkVisualModal').textContent),
        }));
        assert.equal(open.shown, 'flex');
        assert.equal(open.dots, 'A●D○M○E○T○'); assert.equal(open.warn, '4 empty'); assert.ok(open.fill, '🤖 Fill offered for the empty fields');
        assert.ok(open.gen, 'Generate sits in the middle of the empty picture'); assert.deepEqual(open.foot, [true, true, true], '🔁 ⬇ 💾 wait for a picture');
        assert.equal(open.model, '🍌 Nano Banana ▾'); assert.equal(open.menu, true); assert.equal(open.extra, true); assert.equal(open.overlay, true, '🔤 on by default');
        assert.equal(open.meta, '~15 s'); assert.equal(open.oldText, false, 'no developer badge / 3-line description');

        // model ▾ → GPT Image 2.6
        await page.click('#dcaPkVisualModelBtn');
        assert.equal(await page.evaluate(() => document.getElementById('dcaPkVisualModelRail').hidden), false);
        await page.click('#dcaPkVisualModelRail [data-value="or/openai/gpt-image-2.6-sunburst"]');
        assert.deepEqual(await page.evaluate(() => [document.getElementById('dcaPkVisualModelBtn').textContent, document.getElementById('dcaPkVisualModelRail').hidden, dcaPkVisualState.model]),
            ['☀️ GPT Image 2.6 ▾', true, 'or/openai/gpt-image-2.6-sunburst']);
        // +Class chip is a checkbox behind a chip
        await page.click('label:has(#dca-pv-inc-class)');
        assert.equal(await page.evaluate(() => document.getElementById('dca-pv-inc-class').checked), true);

        // Generate → picture with no text, quick words at once, AI words after
        await page.click('#dcaPkVisualGenerateBtn');
        await page.waitForFunction(() => document.querySelector('#dcaPkVisualLabels [data-k="a"]'));
        const quick = await page.$eval('#dcaPkVisualLabels [data-k="a"]', e => e.textContent);
        assert.equal(quick, 'Saturable absorption in the proximal small intestine', 'quick words = first sentence of the field');
        await page.waitForFunction(() => /ดูดซึม/.test((document.querySelector('#dcaPkVisualLabels [data-k="a"]') || {}).textContent || ''));
        const gen = await page.evaluate(() => ({
            img: __calls.find(c => !c.isJson), txt: __calls.find(c => c.isJson),
            labels: [...document.querySelectorAll('#dcaPkVisualLabels .pv-l')].map(l => l.className),
            foot: ['dcaPkVisualRegenBtn', 'dcaPkVisualDownloadBtn', 'dcaPkVisualSaveBtn'].map(id => document.getElementById(id).hidden),
            meta: document.getElementById('dcaPkVisualMeta').textContent,
        }));
        assert.match(gen.img.prompt, /NO TEXT AT ALL/); assert.match(gen.img.prompt, /CLASS: Gabapentinoid/); assert.doesNotMatch(gen.img.prompt, /English labels only/);
        assert.equal(gen.img.model, 'or/openai/gpt-image-2.6-sunburst'); assert.equal(gen.img.opts.imageApi, true, 'GPT Image goes through the Image API like the Design hub');
        assert.match(gen.txt.prompt, /Write in Thai/); assert.match(gen.txt.prompt, /a \(absorption\): Saturable/); assert.doesNotMatch(gen.txt.prompt, /d \(distribution\)/);
        assert.deepEqual(gen.labels, ['pv-l pv-l-a'], 'only fields that have words get a label');
        assert.deepEqual(gen.foot, [false, false, false]); assert.equal(gen.meta, '✏️ Tap a label to change it');

        // tap a label and change it — no new picture
        const before = await page.evaluate(() => __calls.length);
        await page.evaluate(() => { const e = document.querySelector('#dcaPkVisualLabels [data-k="a"]'); e.textContent = 'ดูดซึมที่ลำไส้เล็กส่วนต้น  (อิ่มตัวได้)'; e.dispatchEvent(new Event('input', { bubbles: true })); });
        assert.equal(await page.evaluate(() => dcaPkVisualState.labels.a), 'ดูดซึมที่ลำไส้เล็กส่วนต้น (อิ่มตัวได้)');
        assert.equal(await page.evaluate(() => __calls.length), before, 'editing words calls no AI');
        if (process.env.OUTDIR) { await page.waitForTimeout(3500); await page.evaluate(() => document.querySelectorAll('.toast,#toast').forEach(e => e.remove())); } // blocked web fonts hide text for ~3 s
        if (process.env.OUTDIR) await page.locator('#dcaPkVisualModal .modal-content').screenshot({ path: process.env.OUTDIR + '/admet-visual-lean.png' });

        // Save → pkVisual.labels + labelLang
        await page.evaluate(() => {
            dcaState.editingId = 'g1'; dcaState.codex = [{ _id: 'g1', genericName: 'gabapentin' }];
            window.__upd = null;
            const ref = { getDownloadURL: async () => { const e = new Error('nf'); e.code = 'storage/object-not-found'; throw e; }, put: async () => ({ ref: { getDownloadURL: async () => 'https://dl/pk.png' } }) };
            adminApp = { storage: () => ({ ref: () => ref }) };
            db = { collection: () => ({ doc: () => ({ update: async d => { window.__upd = d; } }) }) };
            auth = { currentUser: { email: 'a@x' } };
            firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: x => [x] } } };
        });
        await page.click('#dcaPkVisualSaveBtn');
        await page.waitForFunction(() => window.__upd);
        const upd = await page.evaluate(() => window.__upd.pkVisual);
        assert.deepEqual([upd.downloadUrl, upd.labels, upd.labelLang, upd.style], ['https://dl/pk.png', { a: 'ดูดซึมที่ลำไส้เล็กส่วนต้น (อิ่มตัวได้)' }, 'th', 'infographic']);
        assert.ok((await page.evaluate(() => window.__eval || [])).includes('pk_visual|or/openai/gpt-image-2.6-sunburst|kept'));

        // reopen: the saved picture comes back WITH its words, ready to edit; a re-save is not counted as "kept" again
        await page.evaluate(() => { dcaState.codex[0].pkVisual = window.__upd.pkVisual; window.__eval = []; dcaOpenPkVisualModal(); });
        const re = await page.evaluate(() => ({ src: document.getElementById('dcaPkVisualPreviewImg').getAttribute('src'), a: (document.querySelector('#dcaPkVisualLabels [data-k="a"]') || {}).textContent, save: document.getElementById('dcaPkVisualSaveBtn').hidden }));
        assert.deepEqual(re, { src: 'https://dl/pk.png', a: 'ดูดซึมที่ลำไส้เล็กส่วนต้น (อิ่มตัวได้)', save: false });

        // 🔤 off → no words over the picture, the prompt asks for the picture's own Thai labels
        await page.evaluate(() => { window.__calls = []; const o = document.getElementById('dca-pv-overlay'); o.checked = false; o.dispatchEvent(new Event('change')); });
        assert.equal(await page.$$eval('#dcaPkVisualLabels .pv-l', l => l.length), 0);
        await page.click('#dcaPkVisualRegenBtn');
        await page.waitForFunction(() => __calls.length >= 1 && !dcaPkVisualState.generating);
        const off = await page.evaluate(() => ({ p: __calls[0].prompt, n: __calls.length, labels: dcaPkVisualState.labels }));
        assert.match(off.p, /Use Thai labels/); assert.doesNotMatch(off.p, /NO TEXT AT ALL/); assert.equal(off.n, 1, 'no label call with 🔤 off'); assert.equal(off.labels, null);
        assert.deepEqual(errs, [], errs.join(' | '));
        await page.close();

        // ---------------- intern drug page ----------------
        const ip = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const ierrs = []; ip.on('pageerror', e => ierrs.push(e.message));
        await ip.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await ip.route('**/*', r => (r.request().url().startsWith('file:') || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
        await ip.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await ip.waitForFunction(() => typeof window.dcRenderDetail === 'function' || typeof dcRenderDetail === 'function', null, { timeout: 30000 });
        const html = await ip.evaluate(png => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const host = document.getElementById('dc-detail-body') || (() => { const d = document.createElement('div'); d.id = 'dc-detail-body'; document.body.appendChild(d); return d; })();
            const drug = { _id: 'g1', genericName: 'gabapentin', absorption: 'Saturable', pkVisual: { downloadUrl: png, style: 'anatomical', labels: { a: 'ดูดซึม <ต้น>', e: 'ไต · t½ 5–7 ชม.' }, labelLang: 'th' } };
            try { dcRenderDetail(drug); } catch (e) { return 'ERR ' + e.message; }
            const sec = host.querySelector('[data-section-key="pkvisual"]');
            return sec ? sec.querySelector('.dc-pkv-frame').innerHTML : 'no section';
        }, PNG);
        assert.match(html, /<span class="dc-pkv-l dc-pkv-a"><i>A<\/i>ดูดซึม &lt;ต้น&gt;<\/span>/, html);
        assert.match(html, /dc-pkv-l dc-pkv-e"><i>E<\/i>ไต · t½ 5–7 ชม\./);
        assert.doesNotMatch(html, /dc-pkv-d|dc-pkv-m|dc-pkv-t/);
        assert.deepEqual(ierrs.filter(e => /pkv|dcRender/i.test(e)), [], ierrs.join(' | '));
        console.log('PASS: ADMET Visual lean — one header row (model ▾ incl. GPT Image 2.6 via the Image API), one chip row, A D M E T dots + 🤖 Fill, Generate in the picture, ⬇/💾 after; 🔤 = picture with no text + quick then AI words laid over, tap to edit, saved on pkVisual.labels, reopened with them; intern page draws the words in the same slots');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
