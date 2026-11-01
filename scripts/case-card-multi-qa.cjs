// V102.564: the multi Case Card sheet in Chromium: what starts unticked, edits reach the prompt, two at a time, one failure stops nothing and retries alone, Stop leaves the rest.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const css = fs.readFileSync('public/case-card-multi.css', 'utf8'), js = fs.readFileSync('public/case-card-multi.js', 'utf8');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(html.indexOf('id="alabasta-bulk-toolbar"') < html.indexOf('id="alabasta-inbox-section"'), 'the bar is above the Inbox cards');
assert.ok(html.includes('onclick="caseCardMulti.open()"'));
assert.ok(/async function generateAlabastaCaseCardImage[\s\S]{0,5000}await alabastaCaseCardMakeImage\(caseItem, prompt, selectedModel, compositeMode, metaEl\)/.test(html), 'the single card uses the same core');

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1024, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 800 } }), errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${css}</style>` }));
            await page.goto('https://qa.test/a.html');
            await page.evaluate(() => {
                const mk = (id, hn, note, extra) => ({ id, caseId: hn, note, diseaseSystemLabel: 'GI / ระบบทางเดินอาหาร', ...extra });
                const long = 'ผู้ป่วยชาย อายุ 40 ปี ท้องเสียสองวัน ไม่มีไข้ ดื่มน้ำได้ดี';
                window.cases = [mk('a', '1', long), mk('b', '2', long + ' b', { caseVisualDispensed: 'ORS', privacyConsent: { details: true } }), mk('c', '3', 'งูสวัด'), mk('d', '1', long + ' d'), mk('e', '5', long + ' e', { caseCardImage: { downloadUrl: 'x' } })];
                window.alabastaSelectedIds = new Set(cases.map(c => c.id));
                window.getAlabastaCaseById = id => cases.find(c => c.id === id);
                window.buildSafeAlabastaCaseVisualPayload = c => ({ taxonomySummary: 'GI - Diarrhea', safeSummary: 'Educational case summary: ' + c.note });
                window.translateAlabastaSummaryToEnglish = async (s, t, consent) => { (window.__tr = window.__tr || []).push(consent); return 'EN ' + s; };
                window.alabastaEnglishOnly = s => String(s).replace(/[^\x00-\x7F]+/g, ' ').replace(/[\/\s]+$/, '').trim();
                window.alabastaCaseCardPromptFor = (s, t, consent, disp) => JSON.stringify({ s, disp, consent });
                window.getCaseCardLayout = () => window.__layout || 'infographic'; window.selectCaseCardLayout = l => { window.__layout = l; };
                window.getCaseCardCompositeMode = () => 'ai'; window._appendNoTextPromptSuffix = p => p;
                window.ALABASTA_CASECARD_MODEL_PREF_KEY = 'k';
                window.__active = 0; window.__peak = 0; window.__made = []; window.__failOnce = new Set(); window.__gate = null;
                window.alabastaCaseCardMakeImage = async (c, prompt, model) => {
                    window.__active++; window.__peak = Math.max(window.__peak, window.__active); window.__made.push({ id: c.id, prompt: JSON.parse(prompt), model });
                    await (window.__gate || new Promise(r => setTimeout(r, 20)));
                    window.__active--;
                    if (window.__failOnce.delete(c.id)) throw new Error('Provider timed out');
                    return { model, finalDataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
                };
                window.stampCaseIdOnImage = async u => u; window.saveCaseCardToGallery = async () => true;
                window.syncAlabastaCaseBridgeMarker = () => {}; window.__docs = [];
                window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } }; window.ALLOWED_EMAIL = 'a@x';
                window.db = { collection: () => ({ doc: id => ({ update: async f => window.__docs.push([id, f]) }) }) };
                window.showToast = () => {}; window.clearAlabastaSelection = () => { window.__cleared = true; };
            });
            await page.addScriptTag({ content: js });
            await page.evaluate(() => caseCardMulti.open());
            await page.waitForFunction(() => document.querySelector('.ccm-row textarea').value.startsWith('EN '));
            const rows = page.locator('.ccm-row');
            assert.deepEqual(await rows.evaluateAll(r => r.map(x => x.querySelector('input').checked)), [true, true, false, false, false], 'short note, same HN and existing card start unticked');
            assert.equal(await page.evaluate(() => window.__tr.length), 2, 'only ticked rows are translated');
            assert.equal(await page.evaluate(() => window.__tr[1]), true, 'each case keeps its own consent');
            assert.ok((await rows.nth(2).innerText()).includes('Note is short'));
            assert.equal(await page.locator('.ccm-go').innerText(), 'Generate 2 cards');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no side scroll');

            await rows.nth(0).locator('textarea').fill('edited by admin');
            await page.locator('.ccm-chip', { hasText: 'NB Pro' }).click();
            await page.locator('.ccm-chip', { hasText: 'Minimal' }).click();
            assert.equal(await page.evaluate(() => window.__layout), 'minimal');
            await page.evaluate(() => { window.__failOnce.add('b'); });
            await page.click('.ccm-go');
            await page.waitForSelector('.ccm-res.bad');
            await page.waitForSelector('.ccm-res.ok');
            await page.waitForFunction(() => window.__active === 0 && !document.querySelector('.ccm-row'));
            let made = await page.evaluate(() => window.__made);
            assert.equal(made.length, 2);
            assert.equal(made.find(m => m.id === 'a').prompt.s, 'edited by admin', 'the edited text goes out');
            assert.deepEqual([made.find(m => m.id === 'b').prompt.disp, made.find(m => m.id === 'b').prompt.consent, made[0].model], ['ORS', true, 'as/gemini-3-pro-image']);
            assert.ok((await page.locator('.ccm-res.bad').innerText()).includes('Provider timed out'));
            assert.equal(await page.locator('.ccm-count').innerText(), '1 ready · 1 failed');
            assert.deepEqual(await page.evaluate(() => window.__docs.map(d => d[0])), ['a'], 'a failed card marks nothing');
            await page.click('.ccm-res.bad .ccm-ghost');
            await page.waitForFunction(() => document.querySelectorAll('.ccm-res.ok').length === 2);
            assert.equal(await page.evaluate(() => window.__made.filter(m => m.id === 'a').length), 1, 'Retry makes only the failed card');
            await page.click('.ccm-x');
            assert.equal(await page.evaluate(() => !!window.__cleared && !document.getElementById('ccm-overlay')), true);

            // two at a time, and Stop leaves what has not started
            await page.evaluate(() => {
                window.cases = Array.from({ length: 5 }, (_, i) => ({ id: 'n' + i, caseId: 'H' + i, note: 'ผู้ป่วยชาย อายุ 40 ปี ท้องเสียสองวัน ไม่มีไข้ ' + i, diseaseSystemLabel: 'GI' }));
                window.alabastaSelectedIds = new Set(cases.map(c => c.id));
                window.__peak = 0; window.__made = []; let go; window.__gate = new Promise(r => { go = r; }); window.__go = go;
                caseCardMulti.open();
            });
            await page.click('.ccm-go');
            await page.waitForFunction(() => window.__active === 2);
            await page.click('.ccm-ghost');
            await page.evaluate(() => window.__go());
            await page.waitForFunction(() => window.__active === 0 && !!document.querySelector('.ccm-go, .ccm-count') && !document.querySelector('.ccm-ghost[disabled]'));
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => window.__peak), 2, 'never over two');
            assert.equal(await page.evaluate(() => window.__made.length), 2, 'Stop starts nothing new');
            assert.deepEqual(errs, []);
            await page.close();
        }
        console.log('case-card-multi-qa OK');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
