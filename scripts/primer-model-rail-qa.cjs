// V102.631 (owner pick B + C; was V102.509's rail in each question's label row) — Read first, lean: the question row is the box alone (📖 in its
// placeholder), ✨ and this question's model LOGO in its corner. The strip above the questions is always there: n/N · the model for every
// question ▾ · ⚡ m (empty ones) · 📖 All. Tapping a row's logo opens the vendor-first rail under that box; a pick there is that question's own
// (amber ring, not remembered); a strip pick is every question's again and is remembered (ai_primer_model). ✨ and ⚡ send each question's model.
// The 📖 All popup has no ✨ All / model rail any more. The REAL admin.html + ai-model-ui.js (file://, network blocked, Firebase = Proxy).
// OUTDIR=… saves a screenshot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(!/<select class="q-primer-model"/.test(admin), 'no <select>');
assert.ok(/<input type="hidden" class="q-primer-model" id="q-primer-model-/.test(admin), 'a hidden input.q-primer-model per row');
assert.ok(!admin.includes("window.bindRegistryModelInput(mi.id, 'ai_primer_model')"), 'no rail bound in each row any more');
assert.ok(!/class="pra-all"/.test(admin) && !/_praModelRail/.test(admin), 'the 📖 All popup has no ✨ All / model rail');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(r.request().url()) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && typeof window._qpRowPaint === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);

        const r = await page.evaluate(async () => {
            const out = {};
            localStorage.removeItem('ai_primer_model');
            window.updateQuizPagination = () => {}; window.showToast = () => {};
            const m = document.getElementById('quizManageModal'); m.style.display = 'flex';
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            addQuestionUI({ q: 'First?', type: 'choice', options: ['a', 'b'], correct: [0] }); addQuestionUI({ q: 'Second?', type: 'choice', options: ['a', 'b'], correct: [0] });
            addQuestionUI({ q: 'Third?', type: 'choice', options: ['a', 'b'], correct: [0], primer: '**Term** — background.' });
            window._qPrimerStrip();
            const rows = () => [...document.querySelectorAll('.quiz-q-item .q-primer-row')];
            const row = el => ({ value: el.querySelector('input.q-primer-model').value, label: !!el.querySelector('label'), rail: !el.querySelector('.qp-rail').hidden, chips: !!el.querySelector('.audit-providers'),
                corner: [...el.querySelectorAll('.qp-act > button')].map(b => b.className.split(' ')[0]), logo: !!el.querySelector('.qp-mdl .text-ai-logo'), own: el.querySelector('.qp-mdl').classList.contains('own'),
                ph: el.querySelector('.q-primer').placeholder.slice(0, 13) });
            const strip = () => { const s = document.getElementById('q-primer-strip'); return { hidden: s.hidden, text: s.textContent.replace(/\s+/g, ' ').trim(), go: !!s.querySelector('.qps-go'), all: !!s.querySelector('.qps-rev') }; };
            out.r1 = row(rows()[0]); out.strip = strip();
            // a row pick = that question only, amber ring, not remembered
            rows()[0].querySelector('.qp-mdl').click();
            out.open = row(rows()[0]);
            const rail = rows()[0].querySelector('.qp-rail');
            [...rail.querySelectorAll('.audit-provider')].find(t => /claude/i.test(t.textContent + t.outerHTML)).click();
            const chip = rail.querySelector('button[data-value^="claude-"]:not([hidden])'); out.picked = chip.dataset.value; chip.click();
            out.afterPick = row(rows()[0]); out.row2 = row(rows()[1]); out.remembered = localStorage.getItem('ai_primer_model');
            // ✨ sends the row's model; ⚡ sends each question's own
            const models = []; window.callUniversalAI = async (mm, p) => { models.push(mm); return { text: JSON.stringify({ primer: '**X** — y.' }) }; };
            await window._qPrimerDraft(rows()[0].querySelector('.q-primer-ai'), 'full');
            out.one = models.slice(); models.length = 0;
            rows()[0].querySelector('.q-primer').value = '';
            await window._qPrimerDraftAll(document.querySelector('#q-primer-strip .qps-go'));
            out.all = models.slice();
            out.stripDone = strip();
            // the strip pick = every question again, remembered
            window._praPickModel('claude-sonnet-5-5');
            out.afterStrip = rows().map(x => [row(x).value, row(x).own]); out.remembered2 = localStorage.getItem('ai_primer_model');
            return out;
        });
        assert.deepEqual([r.r1.label, r.r1.chips, r.r1.rail, r.r1.corner, r.r1.logo, r.r1.own, r.r1.ph], [false, false, false, ['qp-mdl', 'q-primer-ai'], true, false, '📖 Read first'], 'row: no label row, no rail, ✨ + logo in the corner: ' + JSON.stringify(r.r1));
        assert.equal(r.r1.value, 'gpt-6-luna', 'first time = the (normalised) toolbar model');
        assert.deepEqual([r.strip.hidden, r.strip.go, r.strip.all], [false, true, true], 'the strip: shown, ⚡ + 📖 All');
        assert.match(r.strip.text, /📖 Read first ?1\/3 .*▾ 2 ?📖 All$/, 'n/N · model ▾ · ⚡ 2 · 📖 All: ' + r.strip.text);
        assert.deepEqual([r.open.rail, r.open.chips], [true, true], 'the logo opens the rail under the box');
        assert.deepEqual([r.afterPick.value, r.afterPick.own, r.afterPick.rail], [r.picked, true, false], 'a row pick: that question\'s model, amber ring, rail closes');
        assert.deepEqual([r.row2.value, r.row2.own], ['gpt-6-luna', false], 'other rows keep the strip model');
        assert.equal(r.remembered, null, 'a row pick is not remembered');
        assert.deepEqual(r.one, [r.picked], '✨ sends the row\'s model');
        assert.deepEqual(r.all, [r.picked, 'gpt-6-luna'], '⚡ drafts the 2 empty ones, each with its own model');
        assert.match(r.stripDone.text, /3\/3 ✓/, 'all filled: n/n ✓: ' + r.stripDone.text);
        assert.equal(r.stripDone.go, false, 'no ⚡ when nothing is empty');
        assert.deepEqual(r.afterStrip, [['claude-sonnet-5-5', false], ['claude-sonnet-5-5', false], ['claude-sonnet-5-5', false]], 'a strip pick = every question, rings gone');
        assert.equal(r.remembered2, 'claude-sonnet-5-5', 'the strip pick is remembered');
        if (process.env.OUTDIR) {
            await page.evaluate(() => { const rows = document.querySelectorAll('.quiz-q-item .q-primer-row'); rows[1].querySelector('.q-primer').value = ''; rows[0].querySelector('.q-primer-model').value = 'gemini-3.8-flash'; window._qpRowPaint(rows[0]); window._qPrimerStrip(); });
            await page.evaluate(() => {   // the editor modal is not laid out offline: show a copy of the strip + the first two questions' Read first
                const box = document.createElement('div'); box.id = 'rf-shot'; box.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:999999;width:760px;padding:14px;background:#fff';
                box.append(document.getElementById('q-primer-strip').cloneNode(true));
                [...document.querySelectorAll('.quiz-q-item .q-primer-row')].slice(0, 2).forEach((r, i) => { const q = document.createElement('div'); q.style.cssText = 'margin-top:10px;font-weight:700;font-size:14px'; q.textContent = (i + 1) + '. ' + document.querySelectorAll('.quiz-q-item .q-text')[i].value; box.append(q, r.cloneNode(true)); });
                document.body.append(box);
            });
            await page.locator('#rf-shot').screenshot({ path: process.env.OUTDIR + '/rf-lean.png' });
        }
        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Read first lean (V102.631) — row = box + ✨ + model logo in the corner; strip n/N · model · ⚡ m · 📖 All always; row pick = that question (amber, not remembered), strip pick = all + remembered; ✨/⚡ send each question\'s model; no ✨ All / rail in 📖 All');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
