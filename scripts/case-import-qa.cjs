// V102.560: Import PDF in Chromium with a fake pdf.js page: bars are burnt into a new JPEG, only that goes out, a warning blocks the card, sensitive lines stay out by default, the card has no points. 1024 and 390 px.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const css = fs.readFileSync('public/case-import.css', 'utf8'), js = fs.readFileSync('public/case-import.js', 'utf8');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1024, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } }), errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${css}</style><button id="alabasta-status-rejected">x</button>` }));
            await page.goto('https://qa.test/a.html');
            await page.evaluate(() => {
                window.ALLOWED_EMAIL = 'a@x'; window.__toast = []; window.showToast = m => window.__toast.push(m); window.__sent = []; window.__docs = [];
                window.__read = { title: 'Annual check', basics: { age: '40', sex: '', heightCm: '', weightKg: '', bmi: '', bp: '118/76', pulse: '' }, labs: [{ test: 'LDL', value: '142', unit: 'mg/dL', range: '<130', flag: 'high' }], notes: ['CXR normal'], sensitive: ['Pap smear: negative'], warnings: [] };
                window.pdfjsLib = { getDocument: () => ({ promise: Promise.resolve({ numPages: window.__pages || 2, destroy() { window.__destroyed = true; }, getPage: async () => ({ getViewport: () => ({ width: 400, height: 500 }), render: ({ canvasContext: x }) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 500); return { promise: Promise.resolve() }; } }) }) }) };
                window.adminApp = { functions: () => ({ httpsCallable: n => async d => { window.__sent.push([n, d]); return { data: { read: window.__read } }; } }) };
                window.firebase = { auth: () => ({ currentUser: { uid: 'admin1' } }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
                window.db = { collection: n => ({ add: async d => { window.__docs.push([n, d]); return { id: 'x' }; } }) };
            });
            await page.addScriptTag({ content: js });
            await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
            assert.equal(await page.locator('#alabasta-import-pdf').innerText(), '📄 Import PDF');

            await page.click('#alabasta-import-pdf');
            await page.setInputFiles('#cim-file', { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
            await page.waitForSelector('#cim-stage');
            assert.match(await page.locator('#cim-box').innerText(), /hospital name[\s\S]*stamp/, 'the two the owner named');
            assert.equal(await page.evaluate(() => window.__destroyed), true, 'the PDF object is gone once drawn');

            const stage = await page.locator('#cim-stage').boundingBox();
            const drag = async (x0, y0, x1, y1) => { await page.mouse.move(stage.x + stage.width * x0, stage.y + stage.height * y0); await page.mouse.down(); await page.mouse.move(stage.x + stage.width * x1, stage.y + stage.height * y1, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(30); };
            await drag(0.1, 0.1, 0.6, 0.3);
            assert.equal(await page.locator('.cim-bar').count(), 1);
            await drag(0.1, 0.5, 0.6, 0.7); assert.equal(await page.locator('.cim-bar').count(), 2);
            await page.locator('.cim-bar').nth(1).click(); assert.equal(await page.locator('.cim-bar').count(), 1, 'tap removes');
            await page.click('#cim-next'); await drag(0.1, 0.1, 0.5, 0.2);
            assert.match(await page.locator('.cim-pg').innerText(), /Page 2 \/ 2[\s\S]*2 bars/);
            assert.ok(await page.locator('#cim-box').evaluate(b => b.scrollWidth <= b.clientWidth + 1), 'fits @' + width);

            await page.click('#cim-send');
            await page.waitForSelector('#cim-title');
            const sent = await page.evaluate(() => window.__sent);
            assert.equal(sent.length, 1); assert.equal(sent[0][0], 'importCaseRead');
            assert.deepEqual(Object.keys(sent[0][1]), ['images'], 'images and nothing else');
            assert.equal(sent[0][1].images.length, 2); assert.ok(sent[0][1].images.every(s => s.startsWith('/9j/')), 'JPEG only');
            // the first page: dark inside the bar, white outside
            const px = await page.evaluate(b64 => new Promise(ok => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); ok([x.getImageData(i.width * .3, i.height * .2, 1, 1).data[0], x.getImageData(i.width * .3, i.height * .8, 1, 1).data[0]]); }; i.src = 'data:image/jpeg;base64,' + b64; }), sent[0][1].images[0]);
            assert.ok(px[0] < 20 && px[1] > 235, 'the bar is burnt in: ' + px);

            const t = await page.locator('#cim-box').innerText();
            assert.match(t, /LDL[\s\S]*142 mg\/dL[\s\S]*▲ High/); assert.match(t, /Flags come from the printed range/); assert.match(t, /No name, HN/);
            assert.ok(!/Pap smear/.test(t), 'a sensitive finding is not shown until chosen');
            await page.click('#cim-make'); await page.waitForFunction(() => window.__docs.length === 1);
            const [n, d] = (await page.evaluate(() => window.__docs))[0];
            assert.equal(n, 'cases'); assert.equal(d.authUid, 'admin1'); assert.equal(d.status, 'reviewed'); assert.equal(d.adminBonus, 0); assert.equal(d.importedFrom, 'pdf');
            assert.ok(d.note.includes('LDL: 142 mg/dL (normal <130) ▲ High') && !d.note.includes('Pap'));
            assert.deepEqual(await page.evaluate(() => window.__toast), ['Case card created: Annual check']);
            assert.equal(await page.locator('#cim-box').evaluate(b => b.open), false);

            // a warning blocks the card
            await page.evaluate(() => { window.__read = Object.assign({}, window.__read, { warnings: ['place'] }); });
            await page.click('#alabasta-import-pdf');
            await page.setInputFiles('#cim-file', { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
            await page.waitForSelector('#cim-stage'); await page.evaluate(() => { window.confirm = () => true; });
            await page.click('#cim-send'); await page.waitForSelector('#cim-title');
            assert.match(await page.locator('.cim-warn').innerText(), /a hospital or clinic name/);
            assert.equal(await page.locator('#cim-make').isDisabled(), true);
            await page.click('.cim-x');
            // too long
            await page.evaluate(() => { window.__pages = 7; });
            await page.click('#alabasta-import-pdf');
            await page.setInputFiles('#cim-file', { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
            await page.waitForFunction(() => /The limit is 6/.test(document.getElementById('cim-box').textContent));
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('PASS case-import-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
