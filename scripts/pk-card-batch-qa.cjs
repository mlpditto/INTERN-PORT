// Drug Codex ▸ 📥 ▸ 🧠 Card lines (V102.654, step 1b of the intern PK flash cards): public/pk-card-batch.js. A sheet of the published drugs
// that have PK text and no pkCard, ten at a time. 🤖 Shorten = one AI call per empty row (the 📊-tab prompt), lines stay editable, a row is
// saved only when it is ticked, 💾 writes only drug_codex/{id}.pkCard (+ updatedAt). The REAL admin.html in Chromium; AI + Firestore stubbed.
//   node scripts/pk-card-batch-qa.cjs      SHOT=<dir> writes a PNG
const path = require('node:path'), fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const admin = fs.readFileSync('public/admin.html', 'utf8'), js = fs.readFileSync('public/pk-card-batch.js', 'utf8');
assert.ok(/<script src="pk-card-batch\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(/class="dca-import-menu">[\s\S]{0,1600}PkCardBatch\.open\(\)[^>]*>🧠 Card lines<\/button>/.test(admin), 'the entry is the third item under 📥 (no new button on the toolbar line)');
assert.ok(!/[฀-๿]/.test(js), 'no Thai in the companion file (the Korean-gap ratchet counts those lines)');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|generative-ai|GoogleGenerativeAI/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => window.PkCardBatch && typeof dcaPkVisualMakeLabels === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        // 14 published drugs: 12 with PK text and no lines (→ 10 on the first page), 1 with lines already, 1 with no PK text
        await page.evaluate(() => {
            window.__w = []; window.__ai = []; window.__toast = []; window.__confirm = [];
            window.showToast = m => window.__toast.push(String(m));
            window.confirm = m => { window.__confirm.push(String(m)); return window.__yes !== false; };
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'NOW' } } };
            window.db = { collection: c => ({ doc: id => ({ update: async p => { if (window.__failId === id) throw new Error('offline'); window.__w.push([c, id, JSON.parse(JSON.stringify(p))]); } }) }) };
            window.auth = { currentUser: { email: 'admin@test' } };
            window.callUniversalAI = async (model, prompt) => {
                const name = (/of the drug (\S+) into/.exec(prompt) || [])[1] || '?'; window.__ai.push(name + (/Write in Thai/.test(prompt) ? ':th' : ':en'));
                if (name === 'Drug03') return { text: 'not json' };
                return { text: JSON.stringify({ a: name + ' oral · Tmax x h', d: 'PB x%', m: 'liver', e: 'urine · t½ x h', t: 'x'.repeat(80) }) };
            };
            const pk = n => ({ absorption: n + ' absorbed.', distribution: 'Bound x%.', metabolism: 'Hepatic.', excretion: 'Renal.', toxicity: 'Tremor.' });
            dcaState.codex = Array.from({ length: 12 }, (_, i) => Object.assign({ _id: 'd' + (i + 1), genericName: 'Drug' + String(12 - i).padStart(2, '0') }, pk('x')))
                .concat([Object.assign({ _id: 'has', genericName: 'Aaa-has-lines', pkCard: { a: 'kept' } }, pk('x')), { _id: 'nopk', genericName: 'Aaa-no-pk' }]);
        });
        assert.equal(await page.evaluate(() => PkCardBatch.todo()), 12, 'only drugs with PK text and no lines count');
        await page.evaluate(() => PkCardBatch.open());
        const ui = () => page.evaluate(() => ({
            n: document.querySelector('#pkcb .n').textContent, names: [...document.querySelectorAll('#pkcb .row .nm')].map(e => e.textContent),
            run: (b => b ? [b.textContent, b.disabled] : null)(document.querySelector('#pkcb [data-act="run"]')), save: (b => [b.textContent, b.disabled])(document.querySelector('#pkcb [data-act="save"]')),
            ticks: [...document.querySelectorAll('#pkcb [data-ok]')].map(b => (b.checked ? 'x' : '-') + (b.disabled ? 'd' : '')).join(' '),
            first: [...document.querySelectorAll('#pkcb .row')[0].querySelectorAll('textarea')].map(i => i.value), marks: [...document.querySelectorAll('#pkcb .row .s')].map(e => e.textContent).join('|') }));

        // 1. ten rows, A–Z, nothing filled, nothing ticked, nothing to save
        let u = await ui();
        assert.equal(u.n, '12 to do · showing 10'); assert.deepEqual(u.names, ['Drug01', 'Drug02', 'Drug03', 'Drug04', 'Drug05', 'Drug06', 'Drug07', 'Drug08', 'Drug09', 'Drug10']);
        assert.deepEqual([u.run, u.save, u.ticks], [['🤖 Shorten 10', false], ['💾 Save 0', true], '-d -d -d -d -d -d -d -d -d -d'], JSON.stringify(u));
        const geo = await page.evaluate(() => { const sh = document.querySelector('#pkcb .sh').getBoundingClientRect(), r = document.querySelector('#pkcb .row'); return { fits: sh.right <= innerWidth && sh.bottom <= innerHeight, rowH: Math.round(r.getBoundingClientRect().height), oneLine: new Set([...r.children].map(c => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2))).size <= 2, heads: [...document.querySelectorAll('#pkcb .cols i')].map(i => i.textContent).join(''), sx: document.querySelector('#pkcb .bd').scrollWidth <= document.querySelector('#pkcb .bd').clientWidth + 1 }; });
        assert.ok(geo.fits && geo.rowH <= 56 && geo.oneLine && geo.heads === 'ADMET' && geo.sx, 'one slim row per drug (two-line cells), A D M E T columns, no sideways scroll: ' + JSON.stringify(geo));

        // 2. 🤖 Shorten: one call per empty row, Thai, ≤ 60 chars; a bad answer marks only that row; nothing written, nothing ticked
        await page.click('#pkcb [data-act="run"]');
        await page.waitForFunction(() => { const b = document.querySelector('#pkcb [data-act="run"]'); return b && b.textContent === '🤖 Shorten 1'; });
        u = await ui();
        assert.deepEqual(await page.evaluate(() => window.__ai), ['Drug01:th', 'Drug02:th', 'Drug03:th', 'Drug04:th', 'Drug05:th', 'Drug06:th', 'Drug07:th', 'Drug08:th', 'Drug09:th', 'Drug10:th']);
        assert.deepEqual(u.first.slice(0, 4), ['Drug01 oral · Tmax x h', 'PB x%', 'liver', 'urine · t½ x h']); assert.equal(u.first[4].length, 60);
        assert.equal(u.marks, '||⚠️|||||||', 'the row whose answer was unusable is marked');
        assert.deepEqual([u.save, u.ticks, await page.evaluate(() => window.__w.length)], [['💾 Save 0', true], '- - -d - - - - - - -', 0], 'filled rows can be ticked; nothing is ticked or written for the admin');
        if (process.env.SHOT) await page.locator('#pkcb .sh').screenshot({ path: path.join(process.env.SHOT, 'pk-card-batch.png') });

        // 3. edit a line, tick two rows, 💾: exactly those two drugs get pkCard; they leave the sheet; the list copy follows
        const row = n => page.locator('#pkcb .row').nth(n);
        await row(0).locator('[data-k="t"]').fill('  tremor ·   palpitations ');
        await row(0).locator('[data-ok]').check(); await row(1).locator('[data-ok]').check();
        assert.deepEqual((await ui()).save, ['💾 Save 2', false]);
        await page.click('#pkcb [data-act="save"]');
        await page.waitForFunction(() => window.__w.length === 2);
        const w = await page.evaluate(() => window.__w);
        assert.deepEqual(w[0], ['drug_codex', 'd12', { pkCard: { at: 'NOW', by: 'admin@test', a: 'Drug01 oral · Tmax x h', d: 'PB x%', m: 'liver', e: 'urine · t½ x h', t: 'tremor · palpitations', lang: 'th' }, updatedAt: 'NOW' }], JSON.stringify(w[0]));
        assert.equal(w[1][1], 'd11');
        await page.waitForFunction(() => document.querySelectorAll('#pkcb .row').length === 8);
        u = await ui();
        assert.equal(u.n, '10 to do · showing 8'); assert.ok(!u.names.includes('Drug01') && !u.names.includes('Drug02'));
        assert.deepEqual(await page.evaluate(() => [dcaState.codex.find(d => d._id === 'd12').pkCard.t, window.__toast.pop()]), ['tremor · palpitations', '🧠 Card lines saved for 2 drugs']);

        // 4. clearing a row's lines unticks it; ✓ all ticks every row with lines; a failed write keeps its row, the rest go; then the next page loads
        await row(1).locator('[data-ok]').check();
        for (const k of ['a', 'd', 'm', 'e', 't']) await row(1).locator('[data-k="' + k + '"]').fill('');
        assert.equal((await ui()).ticks.split(' ')[1], '-d', 'an emptied row cannot stay ticked');
        await page.click('#pkcb [data-act="all"]');
        u = await ui();
        assert.deepEqual(u.save, ['💾 Save 6', false], '8 rows − the bad one − the emptied one: ' + JSON.stringify(u));
        await page.evaluate(() => { window.__w.length = 0; window.__failId = 'd8'; });   // Drug05
        await page.click('#pkcb [data-act="save"]');
        await page.waitForFunction(() => window.__toast.some(t => /saved for 5 drugs · 1 failed/.test(t)));
        u = await ui();
        assert.deepEqual(u.names, ['Drug03', 'Drug04', 'Drug05'], 'left: the unusable answer, the emptied row, the failed write');
        assert.equal(u.n, '5 to do · showing 3');
        // 5. EN: the next Shorten asks in English and only for the empty rows
        await page.evaluate(() => { window.__ai.length = 0; window.__failId = null; });
        await page.click('#pkcb [data-act="lang"][data-v="en"]');
        await page.click('#pkcb [data-act="run"]');
        await page.waitForFunction(() => window.__ai.length === 2);
        assert.deepEqual(await page.evaluate(() => window.__ai), ['Drug03:en', 'Drug04:en'], 'rows that already have lines are not asked again');
        // 6. closing with unsaved lines asks first; ✕ after "no" keeps the sheet
        await page.waitForFunction(() => !!document.querySelector('#pkcb [data-act="run"]'));
        await page.evaluate(() => { window.__yes = false; });
        await page.click('#pkcb [data-act="close"]');
        assert.ok(await page.$('#pkcb') && (await page.evaluate(() => window.__confirm.length)) === 1, 'unsaved lines → confirm, "no" keeps it open');
        await page.evaluate(() => { window.__yes = true; });
        await page.click('#pkcb [data-act="close"]');
        assert.equal(await page.$('#pkcb'), null);
        // 7. nothing to do → says so
        await page.evaluate(() => { dcaState.codex.forEach(d => { if (d.absorption) d.pkCard = { a: 'x' }; }); PkCardBatch.open(); });
        assert.match(await page.$eval('#pkcb .empty', e => e.textContent), /Every drug with pharmacokinetics text has card lines/);
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Drug Codex 🧠 Card lines sheet (V102.654) — PK text + no lines, ten at a time A–Z; 🤖 Shorten = one call per empty row (TH / EN, ≤ 60), bad answer marks its row; only ticked rows are saved (pkCard + updatedAt), saved rows leave, a failed write stays; close asks when lines are unsaved');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
