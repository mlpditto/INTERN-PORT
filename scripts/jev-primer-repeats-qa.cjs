// V102.563: Jev repeats in Chromium: the notes on screen go out, the list renders, a term opens its question, an empty result says so.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const js = fs.readFileSync('public/jev-primer-repeats.js', 'utf8'), css = fs.readFileSync('public/jev-primer-repeats.css', 'utf8');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1024, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 700 } }), errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${css}</style><button id="b">Jev repeats</button><div id="pra-jev" class="jpr-box" hidden></div>` }));
            await page.goto('https://qa.test/a.html');
            await page.addScriptTag({ content: js });
            await page.evaluate(() => {
                window.__calls = []; window.__open = []; window.__next = { enabled: true, repeats: [{ q: 0, otherQ: 2, term: 'COC <x>', otherTerm: 'Combined pill', score: .72 }], compared: 12, left: 3, errors: 1 };
                window._praRead = () => [{ primer: 'on screen 1' }, { primer: '' }, { primer: 'on screen 3' }];
                window._praOpen = (i, f) => window.__open.push([i, f]);
                window.showToast = () => {};
                window.adminApp = { functions: () => ({ httpsCallable: n => async d => { window.__calls.push([n, d]); return { data: window.__next }; } }) };
                document.getElementById('b').onclick = e => jevPrimerRepeats.run(e.target);
            });
            await page.click('#b');
            await page.waitForSelector('.jpr-row');
            assert.deepEqual((await page.evaluate(() => window.__calls))[0], ['jevPrimerRepeats', { primers: ['on screen 1', '', 'on screen 3'] }]);
            const text = await page.locator('#pra-jev').innerText();
            assert.ok(text.includes('1 to check') && text.includes('3 pairs not checked') && text.includes('1 failed') && text.includes('COC <x>') && text.includes('0.72'), text);
            await page.locator('.jpr-go').nth(1).click();
            assert.deepEqual(await page.evaluate(() => window.__open), [[2, true]]);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no side scroll');
            assert.equal(await page.locator('#b').textContent(), 'Jev repeats');
            await page.evaluate(() => { window.__next = { enabled: true, repeats: [], compared: 5, left: 0, errors: 0 }; });
            await page.click('#b');
            await page.waitForFunction(() => document.getElementById('pra-jev').innerText.includes('no repeats'));
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('jev-primer-repeats-qa OK');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
