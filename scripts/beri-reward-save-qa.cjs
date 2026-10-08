// V102.123: Beri Reward modal behaviour — the REAL modal markup + CSS + brGenImage / saveBeriReward from admin.html, with the network
// stubbed by promises the test controls. (1) Save closes the modal BEFORE the image upload and shows a Saving… toast; success → "Reward
// saved!". (2) An upload failure reopens the form with its values and says why. (3) A second Save while one is running is ignored.
// (4) While Grok draws, the well shimmers (class gen) and a seconds counter runs; it is cleaned up after, also on failure.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return html.slice(i, j); };
const modal = slice('        <div id="beriRewardModal" class="modal"', '\n            </div>\n        </div>\n') + '\n            </div>\n        </div>\n';
const helpers = slice("        let brPendingFile = null, brImageUrl = '', brSaving = false;", '        function brPreviewOff() {');
const save = slice('        async function saveBeriReward() {', '        async function toggleBeriRewardActive');
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent(`${styles}<style>body{margin:0}</style>${modal}`);
        await page.addScriptTag({ content: `
            window.log = []; window.pending = {};
            const defer = k => new Promise((res, rej) => { window.pending[k] = { res, rej }; });
            window.toasts = []; window.showToast = m => toasts.push(m);
            window.forceHideModal = id => { document.getElementById(id).style.display = 'none'; log.push('hide'); };
            window.forceShowModal = id => { document.getElementById(id).style.display = 'block'; log.push('show'); };
            window.alert = m => log.push('alert:' + m);
            window.resizeAdminProductPhoto = f => { log.push('resize'); return Promise.resolve({ blob: f }); };
            window.uploadAdminProductPhoto = b => { log.push('upload'); return defer('upload'); };
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } };
            window.db = { collection: () => ({ add: d => { log.push('add'); window.added = d; return Promise.resolve(); }, doc: () => ({ update: d => { log.push('update'); window.added = d; return Promise.resolve(); } }) }) };
            window.callUniversalAI = () => defer('ai');
            ${helpers}
            ${save}
            window.brShow = () => document.getElementById('beriRewardModal').style.display = 'block';
        ` });
        const fill = () => page.evaluate(() => {
            document.getElementById('beriRewardModal').style.display = 'block';
            document.getElementById('br-edit-id').value = ''; document.getElementById('br-name').value = 'SUPER BEAR'; document.getElementById('br-desc').value = 'Bear House';
            document.getElementById('br-cost').value = '2450'; document.getElementById('br-list').value = '3000'; document.getElementById('br-stock').value = '2';
            document.getElementById('br-active').checked = true;
            brPendingFile = new File([new Blob(['x'], { type: 'image/png' })], 'p.png', { type: 'image/png' }); window.log.length = 0; window.toasts.length = 0; delete window.added;
        });
        const shown = () => page.evaluate(() => document.getElementById('beriRewardModal').style.display !== 'none');

        // (1) save closes first
        await fill();
        const done = page.evaluate(() => saveBeriReward());
        await page.waitForTimeout(100);
        assert.equal(await shown(), false, 'modal is already closed while the image is still uploading');
        assert.deepEqual(await page.evaluate(() => log), ['hide', 'resize', 'upload'], 'order: hide → resize → upload');
        assert.deepEqual(await page.evaluate(() => toasts), ['⏳ Saving…']);
        await page.evaluate(() => pending.upload.res({ url: 'https://x/p.jpg' }));
        await done;
        assert.equal(await page.evaluate(() => added.imageUrl), 'https://x/p.jpg'); assert.equal(await page.evaluate(() => added.listCost), 3000);
        assert.deepEqual(await page.evaluate(() => toasts), ['⏳ Saving…', 'Reward saved!']);

        // (2) failure reopens with the typed values
        await fill();
        const failing = page.evaluate(() => saveBeriReward());
        await page.waitForTimeout(100);
        await page.evaluate(() => pending.upload.rej(new Error('network down')));
        await failing;
        assert.equal(await shown(), true, 'form is back after a failure');
        assert.equal(await page.locator('#br-name').inputValue(), 'SUPER BEAR'); assert.equal(await page.locator('#br-cost').inputValue(), '2450');
        assert.ok((await page.evaluate(() => toasts)).pop().startsWith('Not saved — Image upload failed: network down'));

        // (3) double save is ignored
        await fill();
        const first = page.evaluate(() => saveBeriReward());
        await page.waitForTimeout(100);
        await page.evaluate(() => saveBeriReward());
        assert.equal(await page.evaluate(() => log.filter(l => l === 'resize').length), 1, 'second Save while saving does nothing');
        await page.evaluate(() => pending.upload.res({ url: 'https://x/p.jpg' })); await first;
        assert.equal(await page.evaluate(() => log.filter(l => l === 'add').length), 1);

        // (4) generating animation
        await page.evaluate(() => { document.getElementById('beriRewardModal').style.display = 'block'; });
        const gen = page.evaluate(async () => { window.URL.createObjectURL = () => 'blob:x'; return brGenImage(); });
        await page.waitForTimeout(1300);
        assert.equal(await page.locator('#br-pic.gen').count(), 1, 'well shimmers while generating');
        assert.equal(await page.locator('#br-pic-ai.spin').count(), 1, '✨ spins'); assert.equal(await page.locator('#br-pic-ai').isDisabled(), true);
        const sec = await page.evaluate(() => Number(document.getElementById('br-pic').dataset.sec));
        assert.ok(sec >= 1, 'seconds counter is running: ' + sec);
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('br-pic'), '::after').content), `"${sec}s"`, 'counter is drawn in the well');
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('br-pic'), '::before').animationName), 'none', 'shimmer animation runs');
        await page.evaluate(() => pending.ai.res({ imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));
        await gen;
        assert.equal(await page.locator('#br-pic.gen').count(), 0, 'animation cleaned up'); assert.equal(await page.locator('#br-pic-ai.spin').count(), 0);
        assert.equal(await page.evaluate(() => brPendingFile && brPendingFile.name), 'grok-imagine.png', 'result is the pending file');
        // failure path also cleans up
        const gen2 = page.evaluate(() => brGenImage());
        await page.waitForTimeout(200);
        await page.evaluate(() => pending.ai.rej(new Error('boom'))); await gen2;
        assert.equal(await page.locator('#br-pic.gen').count(), 0, 'cleaned up after a failure too');
        assert.equal(await page.locator('#br-pic-ai').isDisabled(), false);

        assert.deepEqual(errors, []);
        console.log('PASS: beri reward — Save closes the modal before the upload (Saving… toast), failure reopens it with the typed values, double Save ignored; Grok generating shows shimmer + spinning ✨ + seconds counter and cleans up on success and failure');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
