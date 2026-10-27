// V102.381 — Reflective Review PR 3 (owner's ideas 3 + 4): the two model rows say what they are for ("Analysis model" over the Writing
// Analysis rail, "Reply model" over the reply rail, tooltips on both) and the FOCUS count badge explains itself (pill tooltip + badge
// aria-label "n× in this intern's last 5 reflections"), surviving the TH / EN relabel. The REAL admin.html with a fixture log.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.match(html, /<title>Nika Admin \(V102\.(?:379|38\d|39\d|[4-9]\d\d)\)<\/title>/, 'admin V102.379+ (bumped down from 381 when merged third)');
assert.ok(html.includes('<span class="rr-mini-label" title="The model that writes the reply — the Writing Analysis column picks its own">Reply model</span>'), 'the reply row label');
// V102.454 (lean A, owner's pick): the Writing Analysis card drops its "Analysis model" caption — the card title says it; the row keeps it as a tooltip
assert.ok(!html.includes('>Analysis model</span>'), 'no "Analysis model" caption');
assert.ok(html.includes('id="rr-grammar-model-row" title="Analysis model — analyses the intern\'s writing, separate from the reply model"'), 'the analysis row tooltip');
assert.ok(!html.includes('<span class="rr-mini-label">Model</span>'), 'the bare "Model" label is gone');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.reviewReflective === 'function' && typeof window.updateFocusPillBadges === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate(async () => {
            const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
            const q = s => document.querySelector(s);
            reflectiveLogsCache = [{ id: 'r1', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: { toDate: () => new Date(2026, 9, 22, 18, 6) }, content: 'วันนี้ได้เรียนรู้การจ่ายยาให้คนไข้เบาหวาน' }];
            window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }), where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) };
            await reviewReflective('r1'); await new Promise(res => setTimeout(res, 200));
            const out = {};
            const reply = q('#rr-model-row').previousElementSibling, analysis = q('#rr-grammar-model-row');
            out.labels = [reply && reply.className, reply && reply.textContent, reply && reply.title.slice(0, 32), analysis.previousElementSibling, analysis.title.slice(0, 32)];
            // the reply label sits on the same line as its rail
            const lr = reply.getBoundingClientRect(), rr = q('#rr-model-row').getBoundingClientRect();
            out.sameLine = Math.abs((lr.top + lr.height / 2) - (rr.top + rr.height / 2)) < Math.max(lr.height, rr.height);
            const probe = () => q('#reflective-focus-pills .reflective-focus-pill[data-value="probe"]');
            updateFocusPillBadges({ probe: 2, growth: 1 });
            const b = probe().querySelector('.focus-pill-badge');
            out.badge = [b && b.textContent, b && b.getAttribute('aria-label'), probe().title, q('.reflective-focus-pill[data-value="encourage"]').hasAttribute('title')];
            applyReflectiveFocusLanguage('Thai');
            const b2 = probe().querySelector('.focus-pill-badge');
            out.afterLang = [b2 && b2.textContent, probe().title === out.badge[2], probe().textContent.startsWith('🔍 ถามเจาะลึก')];
            updateFocusPillBadges({});
            out.cleared = [!!probe().querySelector('.focus-pill-badge'), probe().hasAttribute('title')];
            return out;
        });
        assert.deepEqual(r.labels, ['rr-mini-label', 'Reply model', 'The model that writes the reply ', null, 'Analysis model — analyses the in'], 'reply row: caption + tooltip; analysis row: tooltip only (V102.454): ' + JSON.stringify(r.labels));
        assert.equal(r.sameLine, true, 'the reply caption stays on its rail\'s line');
        assert.deepEqual(r.badge, ['2', '2× in this intern\'s last 5 reflections — try another focus for variety', '2× in this intern\'s last 5 reflections — try another focus for variety', false], 'the badge explains itself; a pill without a count has no tooltip: ' + JSON.stringify(r.badge));
        assert.deepEqual(r.afterLang, ['2', true, true], 'the relabel keeps the badge + tooltip: ' + JSON.stringify(r.afterLang));
        assert.deepEqual(r.cleared, [false, false], 'no count → no badge, no tooltip');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Reflective Review PR 3 — "Reply model" caption + tooltip, "Analysis model" as the row tooltip (V102.454); the FOCUS count badge says what it counts and survives the relabel');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
