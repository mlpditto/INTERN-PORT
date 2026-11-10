// V101.304 (owner: kidney screening idea from the CPA Thailand site, pick A lean + tiles T2) — Case form: the six optional tiles show icons only
// and the open one shows its short word; 🫘 Kidney = who gets a microalbumin kit (any chip), the Thai-CKD Risk Score (🎂 age 0/2/4 · 🩺 SBP 0–5 ·
// 📏 waist 0/2 · 🍬 DM +3), modifiers only at 3–6, one verdict line (score · band · ✅ Kit / — No kit), the strip result; saved as `kidney` only
// when touched; reset clears it. The REAL index.html + case-extras.js/css on a 412 px phone (Firebase stubbed). OUTDIR=… saves screenshots.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 1100 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });
        await page.waitForTimeout(500);
        await page.evaluate(() => { try { openUnifiedModal(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; } });
        await page.waitForTimeout(400);

        // 1. tiles: six, icons only; tapping one shows its short word and opens its block; titles carry the full names
        const tiles = await page.evaluate(() => {
            const all = [...document.querySelectorAll('#u-case-opt .u-opt-tiles .u-opt-tile')], word = t => { const s = t.querySelector('span:not(.u-opt-ico)'); return getComputedStyle(s).display === 'none' ? '' : s.textContent; };
            const before = all.map(word), titles = all.map(t => t.title);
            const row = document.querySelector('#u-case-opt .u-opt-tiles').getBoundingClientRect(), last = all[5].getBoundingClientRect();
            all[5].click();
            return { ids: all.map(t => t.dataset.opt), before, titles, after: all.map(word), open: !document.getElementById('u-opt-kidney').hidden, fits: last.right <= row.right + 1 };
        });
        assert.deepEqual(tiles.ids, ['meds', 'labs', 'rights', 'appt', 'adr', 'kidney']);
        assert.deepEqual(tiles.before, ['', '', '', '', '', ''], 'icons only');
        assert.deepEqual(tiles.after, ['', '', '', '', '', 'Kidney'], 'the open tile shows its short word');
        assert.deepEqual(tiles.titles, ['Medications', 'Lab results', 'Treatment rights', 'Appointment', 'ADR · Naranjo', 'Kidney screening · Thai-CKD']);
        assert.ok(tiles.open && tiles.fits, '🫘 opens its block; six tiles fit in one row');

        const st = () => page.evaluate(() => {
            const v = document.getElementById('u-kd-verdict'), b = document.querySelector('.u-opt-tile[data-opt="kidney"] .u-opt-n');
            return { score: v.querySelector('em').textContent, pct: v.querySelector('.pct').textContent, kit: v.querySelector('.kit').textContent, data: v.dataset.kit,
                mods: !document.querySelector('#u-opt-kidney .u-kd-mod').hidden, badge: b.hidden ? '' : b.textContent, collect: (caseExtrasCollect() || {}).kidney || null };
        });
        const tap = sel => page.click('#u-opt-kidney ' + sel);
        let s = await st();
        assert.deepEqual([s.score, s.kit, s.badge, s.collect], ['–', '', '', null], 'untouched: nothing shown, nothing saved');

        // 2. the sample: age 45–54 (+2), SBP 130s (+2), waist OK, 🍬 DM (+3) = 7 → 10–20%, ✅ Kit; result negative
        await tap('.u-kd-seg[data-s="age"] [data-v="1"]'); await tap('.u-kd-seg[data-s="sbp"] [data-v="2"]'); await tap('.u-kd-seg[data-s="waist"] [data-v="0"]');
        s = await st();
        assert.deepEqual([s.score, s.pct, s.kit, s.data, s.mods], ['4', '5–10%', '— No kit', 'no', true], '4 points, no criterion, no modifier → no kit; modifiers show at 3–6');
        await tap('[data-m="smoke"]');
        s = await st(); assert.deepEqual([s.kit, s.collect.mods], ['✅ Kit', ['smoke']], '3–6 + a modifier → kit');
        await tap('[data-m="smoke"]'); await tap('[data-c="dm"]');
        s = await st();
        assert.deepEqual([s.score, s.pct, s.kit, s.mods, s.badge], ['7', '10–20%', '✅ Kit', false, '7'], '🍬 DM adds +3 → 7, kit; modifiers hide above 6; the tile badge is the score');
        await tap('[data-r="neg"]');
        s = await st();
        assert.deepEqual(s.collect, { crit: ['dm'], age: 1, sbp: 2, waist: 0, score: 7, band: '10–20%', kit: true, result: 'neg' }, 'saved: only what was picked: ' + JSON.stringify(s.collect));
        if (process.env.OUTDIR) await page.waitForTimeout(700);   // let the colour transitions finish
        if (process.env.OUTDIR) await page.locator('#u-case-opt').screenshot({ path: path.join(process.env.OUTDIR, 'case-kidney.png') });

        // 3. a criterion alone gives a kit; a second tap clears; ≥ 7 from the rows alone
        await page.evaluate(() => caseExtrasReset());
        s = await st(); assert.deepEqual([s.score, s.kit, s.badge, s.collect], ['–', '', '', null], 'reset clears it');
        await page.evaluate(() => document.querySelector('.u-opt-tile[data-opt="kidney"]').click());
        await tap('[data-c="nsaid"]');
        s = await st(); assert.deepEqual([s.score, s.kit, s.badge, s.collect], ['–', '✅ Kit', '✓', { crit: ['nsaid'], kit: true }], 'NSAIDs alone → kit, no score yet');
        await tap('[data-c="nsaid"]');
        s = await st(); assert.equal(s.collect, null, 'second tap clears');
        await tap('.u-kd-seg[data-s="age"] [data-v="2"]'); await tap('.u-kd-seg[data-s="sbp"] [data-v="3"]');
        s = await st(); assert.deepEqual([s.score, s.kit], ['7', '✅ Kit'], 'age ≥ 55 (+4) + SBP 140s (+3) = 7 → kit before waist is picked');
        await tap('.u-kd-seg[data-s="sbp"] [data-v="3"]');
        s = await st(); assert.deepEqual([s.score, s.kit], ['4', ''], 'tap again clears the SBP; not all rows answered → no verdict yet');
        await tap('[data-r="pos"]');
        s = await st(); assert.equal(s.collect.result, 'pos');
        await page.evaluate(() => caseExtrasReset());
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Case 🫘 Kidney tile (V101.304) — icons-only tiles (short word when open), Thai-CKD score (age · SBP · waist · DM +3), kit rules (criterion / ≥7 / 3–6 + modifier), result, saved only when touched, reset');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
