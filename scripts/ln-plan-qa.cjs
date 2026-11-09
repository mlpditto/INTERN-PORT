// V101.298 🔎 search plan on a reviewed Learning Note (owner pick C, mockup-lnr-plan.html). The REAL public/index.html on a phone
// (file://, network blocked, Firebase stubbed — profile-card-river-qa recipe). Work ▸ History: the note's detail shows the admin's plan
// as a checklist; ticks stay on this device; 🧭 Nika fills the Ask box with the question; ↗ PubMed links the query; ✏️ Update note
// is off until every step is ticked, then opens a new Learning Note holding the old text + what to add.
//   node scripts/ln-plan-qa.cjs
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

const NOTE = {
    id: 'sub1', submissionType: 'learning_note', userId: 'U1', title: 'การประเมิน centor score', description: 'การประเมิน centor score',
    status: 'reviewed', adminComment: 'สรุปช่วงคะแนนได้ตรง 👍', pointsAmount: 0.2,
    searchPlan: [{ k: 'q', t: 'Centor 4: antibiotics now or test first?' }, { k: 'lib', t: 'Pharyngitis · Amoxicillin' }, { k: 'pubmed', t: '"Centor" AND "rapid antigen test"' }, { k: 'write', t: '4 criteria · next step at 4' }, { k: 'bogus', t: 'dropped' }]
};

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.firebase = { functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: { left: 5 } }) }), firestore: { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } } };
            try { localStorage.clear(); } catch (e) { }
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.evaluate((n) => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            window.ensureFirebaseAuthReady = () => Promise.resolve();
            n.timestamp = { toDate: () => new Date() };
            unifiedSubmissionsCache = [n];
            renderUnifiedHistory();
        }, NOTE);

        // a plan only on a note that has one; 4 steps (an unknown kind is dropped), nothing ticked, Update off
        const row = page.locator('.hl-row[data-delete-item="sub1"]');
        assert.equal(await row.count(), 1, 'the note is in History');
        await page.evaluate(() => { const r = document.querySelector('.hl-row[data-delete-item="sub1"]'); r.closest('[style*="display: none"]')?.style.setProperty('display', 'block'); const d = r.querySelector('.card-detail'); d.style.display = 'block'; });
        const box = row.locator('.lnp');
        assert.equal(await box.count(), 1, 'plan under the comment');
        assert.equal(await row.locator('.hl-comment + .lnp').count(), 1, 'right after the 💬 comment');
        assert.equal(await box.locator('.lnp-st').count(), 4);
        assert.equal(await box.locator('.lnp-h').innerText(), '🔎 Plan 0/4');
        assert.equal(await box.locator('.lnp-up').isDisabled(), true, 'Update note waits for every step');
        assert.equal(await box.locator('a.lnp-go').getAttribute('href'), 'https://pubmed.ncbi.nlm.nih.gov/?term=%22Centor%22%20AND%20%22rapid%20antigen%20test%22');
        assert.equal(await box.locator('a.lnp-go').getAttribute('rel'), 'noopener noreferrer');

        // tick: kept on this device, the row does not fold, the bar fills
        await page.locator('.lnp input[data-i="0"]').check();
        assert.equal(await page.locator('.hl-row[data-delete-item="sub1"] .card-detail').evaluate(d => d.style.display), 'block', 'a tick does not fold the row');
        assert.equal(await page.locator('.lnp .lnp-h').innerText(), '🔎 Plan 1/4');
        assert.equal(await page.evaluate(() => localStorage.getItem('lnPlan:sub1')), '[0]');
        assert.equal(await page.locator('.lnp .lnp-st.on span').first().evaluate(e => getComputedStyle(e).textDecorationLine), 'line-through');
        for (const i of [1, 2, 3]) await page.locator('.lnp input[data-i="' + i + '"]').check();
        assert.equal(await page.locator('.lnp .lnp-h').innerText(), '🔎 Plan 4/4');
        assert.equal(await page.locator('.lnp .lnp-up').isDisabled(), false);
        assert.equal(await page.locator('.lnp .lnp-bar i').evaluate(e => e.style.width), '100%');
        // a redraw (new snapshot) keeps the ticks
        await page.evaluate(() => { renderUnifiedHistory(); document.querySelector('.hl-row[data-delete-item="sub1"] .card-detail').style.display = 'block'; });
        assert.equal(await page.locator('.lnp .lnp-h').innerText(), '🔎 Plan 4/4', 'ticks survive a redraw');

        // 🧭 Nika: the DD Codex Ask box gets the question
        await page.locator('.lnp [data-act="nika"]').click();
        await page.waitForFunction(() => (document.getElementById('nk-question') || {}).value === 'Centor 4: antibiotics now or test first?', null, { timeout: 5000 });
        assert.equal(await page.evaluate(() => document.getElementById('nika-section-content').style.display), 'block', 'Nika tab open');

        // ✏️ Update note: a new Learning Note with the old text + what to add
        // opening DD Codex folds the Work card (one card open at a time) — the intern comes back to History for the next step
        await page.evaluate(() => { document.getElementById('work-section-content').style.display = 'block'; document.querySelector('.hl-row[data-delete-item="sub1"] .card-detail').style.display = 'block'; });
        await page.locator('.lnp .lnp-up').click();
        await page.waitForFunction(() => { const t = document.getElementById('dc-note-content') || document.getElementById('rl-content'); return t && t.value; }, null, { timeout: 5000 });
        const form = await page.evaluate(() => ({ title: document.getElementById('lp-note-title').value, text: (document.getElementById('dc-note-content') || document.getElementById('rl-content')).value }));
        assert.equal(form.title, '↻ การประเมิน centor score');
        assert.equal(form.text, 'การประเมิน centor score\n\n✍️ 4 criteria · next step at 4\n');

        // a note without a plan shows none
        await page.evaluate(() => { const n = Object.assign({}, unifiedSubmissionsCache[0], { id: 'sub2', searchPlan: undefined }); unifiedSubmissionsCache = [n]; renderUnifiedHistory(); });
        assert.equal(await page.locator('.hl-row[data-delete-item="sub2"] .lnp').count(), 0);

        const bad = errors.filter(e => !/firebase\.|db is not defined|Cannot read properties of undefined \(reading 'collection'\)/.test(e));
        assert.deepEqual(bad, [], 'no page errors');
        await ctx.close();
        console.log('PASS ln-plan-qa: 🔎 plan in Work ▸ History under the comment — 4 steps (unknown kind dropped), ticks on this device survive a redraw, bar fills, 🧭 Nika fills the Ask box, ↗ PubMed query link, ✏️ Update note only at 4/4 → new note with the old text + what to add; none without a plan');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
