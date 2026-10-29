// V102.509 — the Read first model picker is the page's vendor-first rail, not a <select> (#1784): the REAL admin.html + ai-model-ui.js (file://, network
// blocked, Firebase = Proxy). addQuestionUI() renders a hidden input.q-primer-model per question and binds it with bindRegistryModelInput →
// vendor icons (.mr-vendors) then only that vendor's chips, in the Read first label row. A pick is remembered under ai_primer_model, the input's
// value follows it, and _qPrimerDraft sends that model. Rows are independent; the next row opens on the remembered pick.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(!/<select class="q-primer-model"/.test(admin), 'the Read first <select> is gone');
assert.ok(/<input type="hidden" class="q-primer-model" id="q-primer-model-/.test(admin), 'a hidden input.q-primer-model per row');
assert.ok(admin.includes("window.bindRegistryModelInput(mi.id, 'ai_primer_model')"), 'addQuestionUI binds the row\'s input to the registry rail');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        // the Read first helpers live in the <script type="module"> that imports @google/generative-ai — stub that import so the module runs offline
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(r.request().url()) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && typeof bindRegistryModelInput === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);

        const r = await page.evaluate(async () => {
            const out = {};
            localStorage.removeItem('ai_primer_model');
            window.updateQuizPagination = () => {}; window.showToast = () => {};
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            addQuestionUI(null); addQuestionUI({ q: 'Second?', type: 'choice', options: ['a', 'b'], correct: [0] });
            const rows = [...document.querySelectorAll('.quiz-q-item .q-primer-row')];
            out.rows = rows.length;
            const read = row => {
                const input = row.querySelector('input.q-primer-model'), rail = row.querySelector('.text-ai-chips');
                const vendors = [...rail.querySelectorAll('.mr-vendors .mr-vendor')].map(v => [v.dataset.provider, v.getAttribute('aria-pressed')]);
                const shown = [...rail.querySelectorAll(':scope > button:not([hidden])')].map(b => [b.getAttribute('aria-label').split(' ')[0], b.dataset.value, b.classList.contains('active')]);
                const hidden = rail.querySelectorAll(':scope > button[hidden]').length;
                return { value: input.value, inRow: !!row.querySelector('label .text-ai-chips'), vendors, shown, hidden, select: !!row.querySelector('select') };
            };
            out.r1 = read(rows[0]); out.r2 = read(rows[1]);
            // pick another vendor, then its first chip, in row 1
            const rail1 = rows[0].querySelector('.text-ai-chips');
            const other = [...rail1.querySelectorAll('.mr-vendor')].find(v => v.getAttribute('aria-pressed') !== 'true');
            other.click();
            const chip = rail1.querySelector(':scope > button:not([hidden])'); chip.click();
            out.picked = chip.dataset.value; out.afterPick = read(rows[0]); out.remembered = localStorage.getItem('ai_primer_model'); out.row2Untouched = read(rows[1]).value;
            // the draft sends the row's model
            const models = []; window.callUniversalAI = async m => { models.push(m); return { text: JSON.stringify({ primer: 'Background.' }) }; };
            rows[0].closest('.quiz-q-item').querySelector('.q-text').value = 'Which drug?';
            await window._qPrimerDraft(rows[0].querySelector('.q-primer-ai'), 'full');
            out.draftModel = models[0];
            // a third row opens on the remembered pick
            addQuestionUI(null); out.r3 = read(document.querySelectorAll('.quiz-q-item .q-primer-row')[2]).value;
            return out;
        });
        assert.equal(r.rows, 2);
        for (const k of ['r1', 'r2']) {
            const x = r[k];
            assert.equal(x.select, false, k + ': no <select>'); assert.equal(x.inRow, true, k + ': the rail sits in the Read first label row');
            assert.equal(x.value, 'gpt-6-luna', k + ': first time = the (normalised) toolbar model');
            assert(x.vendors.length >= 5, k + ': vendor icons: ' + JSON.stringify(x.vendors));
            assert.equal(x.vendors.filter(v => v[1] === 'true').length, 1, k + ': one vendor pressed');
            const v = x.vendors.find(v => v[1] === 'true')[0];
            assert(x.shown.length >= 1 && x.shown.every(c => c[0] === v), k + ': only that vendor\'s chips show: ' + JSON.stringify(x.shown));
            assert.equal(x.shown.filter(c => c[2]).map(c => c[1]).join(), 'gpt-6-luna', k + ': the active chip = the input value');
            assert(x.hidden > 0, k + ': the other chips are hidden, not removed');
        }
        assert.equal(r.afterPick.value, r.picked, 'the row input follows the chip');
        assert.equal(r.remembered, r.picked, 'the pick is remembered under ai_primer_model');
        assert.equal(r.afterPick.shown.filter(c => c[2]).map(c => c[1]).join(), r.picked, 'the picked chip is active');
        assert.equal(r.row2Untouched, 'gpt-6-luna', 'the other row keeps its own value');
        assert.equal(r.draftModel, r.picked, '✨ sends the row\'s model');
        assert.equal(r.r3, r.picked, 'a new row opens on the remembered pick');
        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);   // offline-only: no CDN
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Read first model = vendor-first rail per question — hidden input bound by addQuestionUI, vendor icons then that vendor\'s chips, pick remembered + sent by ✨, rows independent, no <select>');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
