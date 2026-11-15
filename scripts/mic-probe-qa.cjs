// 🎤 Case by voice, step 0 — public/mic-probe.html (temporary): the page a phone opens inside LINE to see whether it can record the
// microphone. The REAL page in Chromium with a fake microphone: it reports the environment, records 5 s with MediaRecorder, shows the
// type / size / loudest level and a playable clip, 📋 copies the report; a refused microphone and a browser without getUserMedia each say
// FAIL with the reason; and the page never makes a network request (nothing is uploaded). OUTDIR=… saves a screenshot.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = pathToFileURL(path.resolve('public/mic-probe.html')).href;

(async () => {
    const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    try {
        const text = page => page.locator('#mp-out').textContent();
        const open = async (opts = {}, init = null) => {
            const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, ...opts });
            const page = await ctx.newPage();
            page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
            page.requests = []; page.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) page.requests.push(r.url()); });
            if (init) await page.addInitScript(init);
            await page.goto(url, { waitUntil: 'load' });
            return page;
        };

        // 1. the environment report is there before any tap; LINE is told apart by the user agent
        let page = await open({ permissions: ['microphone'], userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/15.9.0 LIFF' });
        let t = await text(page);
        assert.match(t, /^probe: mic-probe 1 · \d{4}-\d\d-\d\dT/, 'first line names the probe and the time');
        assert.match(t, /app: LINE · LIFF · iOS/, 'LINE + LIFF + iOS read from the user agent: ' + t);
        assert.match(t, /getUserMedia: true/); assert.match(t, /MediaRecorder: true/);
        assert.match(t, /types: .*audio\/webm/, 'Chromium records webm: ' + t);
        assert.equal(await page.locator('#mp-audio').isHidden(), true, 'no player before a recording');
        assert.equal(await page.evaluate(() => document.characterSet), 'UTF-8');

        // 2. tap 🎤 → 5 s with the fake microphone → type, size, loudest level, a playable clip
        await page.click('#mp-rec');
        await page.waitForFunction(() => /🔴 \d s/.test(document.getElementById('mp-rec').textContent), null, { timeout: 5000 });
        assert.equal(await page.locator('#mp-rec').getAttribute('aria-busy'), 'true', 'busy while recording');
        await page.waitForFunction(() => /\nresult: /.test(document.getElementById('mp-out').textContent), null, { timeout: 15000 });
        t = await text(page);
        assert.match(t, /permission: granted after \d+ ms/);
        const rec = /recorded: (\S+) · (\d+) bytes · (\d+) chunk/.exec(t);
        assert.ok(rec && /^audio\//.test(rec[1]) && Number(rec[2]) > 1000, 'an audio clip with real bytes: ' + t);
        // a CI runner has no audio output, so the meter can read 0% or stay suspended there — either a level or an honest "not measured"
        assert.match(t, /loudest: (\d+%|not measured \(meter \w+\))/, 'a level, or "not measured": ' + t);
        assert.match(t, /result: OK · play it back below/);
        assert.equal(await page.locator('#mp-audio').isVisible(), true, 'the clip can be played back');
        assert.match(await page.locator('#mp-audio').getAttribute('src'), /^blob:/, 'the clip lives in memory only');
        assert.equal(await page.locator('#mp-rec').getAttribute('aria-busy'), 'false', 'ready for another try');
        assert.equal(await page.evaluate(() => navigator.mediaDevices.enumerateDevices().then(() => true)), true);
        // 3. 📋 copies the whole report (clipboard missing → execCommand fallback → otherwise it says to select the text)
        await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: s => { window.__copied = s; return Promise.resolve(); } } }); });
        await page.click('#mp-copy');
        assert.equal(await page.evaluate(() => window.__copied), t, 'the copied text is the report on screen');
        assert.match(await page.locator('#mp-copied').textContent(), /copied/);
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); document.execCommand = () => false; });
        await page.click('#mp-copy');
        assert.match(await page.locator('#mp-copied').textContent(), /Select the text below/, 'no clipboard at all → says how to copy by hand');
        assert.deepEqual(page.requests, [], 'nothing leaves the phone: no network request');
        assert.deepEqual(page.errors, [], 'no page errors: ' + page.errors.join(' | '));
        if (process.env.OUTDIR) await page.screenshot({ path: path.join(process.env.OUTDIR, 'mic-probe.png') });
        await page.context().close();

        // 4. the microphone is refused → FAIL with the browser's reason, button usable again
        page = await open({}, () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })); });
        await page.click('#mp-rec');
        await page.waitForFunction(() => /\nresult: /.test(document.getElementById('mp-out').textContent));
        t = await text(page);
        assert.match(t, /permission: refused after \d+ ms/); assert.match(t, /result: FAIL · NotAllowedError · Permission denied/);
        assert.match(t, /app: not LINE/, 'a plain browser is not called LINE');
        assert.equal(await page.locator('#mp-rec').getAttribute('aria-busy'), 'false');
        assert.equal(await page.locator('#mp-audio').isHidden(), true);
        await page.context().close();

        // 5. a WebView without getUserMedia / MediaRecorder → says so, without throwing
        page = await open({}, () => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }); window.MediaRecorder = undefined; });
        t = await text(page);
        assert.match(t, /getUserMedia: false/); assert.match(t, /MediaRecorder: false/); assert.match(t, /types: none/);
        await page.click('#mp-rec');
        assert.match(await text(page), /result: FAIL · no getUserMedia in this browser/);
        assert.deepEqual(page.errors, [], 'no page errors: ' + page.errors.join(' | '));
        await page.context().close();

        console.log('PASS: mic probe — environment report (LINE / LIFF / iOS from the UA), 5 s recording with a fake microphone → type · bytes · loudest level · playable blob, 📋 copy with fallbacks, refused microphone and missing APIs say FAIL with the reason, no network request');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
