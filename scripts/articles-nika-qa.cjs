// V101.306 (owner pick 1A) — 🌞 in the article sheet's footer: asks Nika about THIS article (askNika gets articleId → the server searches only it),
// answered in the sheet. 📝 Summary / 🎯 Key points ask at once with the title in the reading language; ❓ opens a one-line box; not found = "Not in
// this article"; paused / limit / busy / error notes; the count left. The footer still fits on a 360 px phone. The REAL index.html + articles.js,
// a fake Firestore, the callable stubbed (records what it was sent). OUTDIR=… saves a screenshot.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            const facade = { collection: n => window.__fake.collection(n), runTransaction: f => Promise.resolve(f({ get: async () => ({ exists: false }), set: () => {} })) };
            const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
            const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
            window.__sent = []; window.__reply = { left: 9, answer: '* Avoid all three together\n* Check **SCr** in 1–2 weeks', sources: [] };
            window.firebase = new Proxy(function () {}, {
                get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } })
                    : k === 'functions' ? () => ({ httpsCallable: name => d => { window.__sent.push([name, d]); return window.__reply === 'throw' ? Promise.reject(new Error('net')) : Promise.resolve({ data: window.__reply }); } }) : chain,
                apply: () => chain
            });
        });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.internArticles && window.completeMoment);
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            window.__fake = { collection: n => ({ doc: id => ({ id, set: async () => {} }), add: async () => ({ id: 'x' }), where: () => ({ get: async () => ({ docs: [] }) }) }) };
            userId = 'U1'; window.myRegistered = true; window.ensureFirebaseAuthReady = async () => ({ uid: 'a' });
            window.myUserDoc = { id: 'U1', group: 'EXTERN', articleSeen: {} };
            internArticles._show({ a: { id: 'Art9', status: 'scheduled', title: { en: 'Triple whammy', th: 'Triple whammy: NSAID + ACEI/ARB + diuretic' }, body: { en: 'Three drugs…', th: 'ยา 3 กลุ่มนี้…' },
                cover: { emoji: '💊' }, audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 2 }, kind: 'live' });
        });
        const st = () => page.evaluate(() => {
            const sh = document.getElementById('art-sheet'), nk = sh.querySelector('#art-nk'), b = sh.querySelector('.foot .nkb');
            return { on: b.getAttribute('aria-pressed'), strip: !!nk, chips: nk ? [...nk.querySelectorAll('.nk-c button')].map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')) : [],
                box: !!(nk && nk.querySelector('#art-nk-q')), ans: nk && nk.querySelector('.nk-a') ? [...nk.querySelectorAll('.nk-a li')].map(x => x.innerHTML) : null,
                note: nk && nk.querySelector('.nk-n') ? nk.querySelector('.nk-n').textContent : '', left: nk && nk.querySelector('.nk-l') ? nk.querySelector('.nk-l').textContent : '' };
        });
        const last = () => page.evaluate(() => window.__sent[window.__sent.length - 1]);

        // 1. Thai sheet: 🌞 sits in the footer after 🔕; the footer still fits at 360 px
        const foot = await page.evaluate(() => { const f = document.querySelector('#art-sheet .foot'), r = f.getBoundingClientRect();
            return { btns: [...f.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 2)), fits: [...f.children].every(x => x.getBoundingClientRect().right <= r.right + 1), w: [...f.children].map(x => Math.round(x.getBoundingClientRect().width)), fw: Math.round(r.width), scroll: f.scrollWidth <= f.clientWidth + 1, title: f.querySelector('.nkb').title }; });
        assert.equal(foot.btns[3], '🌞', '🌞 after 🔖 🔕 📰: ' + foot.btns);
        assert.ok(foot.fits && foot.scroll, 'the footer fits a 360 px phone: ' + JSON.stringify(foot));
        assert.equal(foot.title, 'ถาม Nika เรื่องบทความนี้');
        let s = await st(); assert.deepEqual([s.on, s.strip], ['false', false], 'closed at first');

        // 2. 🌞 opens the strip; 📝 asks at once with the title, sends the article id; the answer is bullets (escaped, **bold**)
        await page.click('#art-sheet .nkb');
        s = await st(); assert.deepEqual([s.on, s.chips], ['true', ['📝 สรุป 3 บรรทัด', '🎯 ต้องจำอะไร', '❓ ถามเอง']]);
        await page.click('#art-nk [data-k="sum"]'); await page.waitForTimeout(150);
        assert.deepEqual(await last(), ['askNika', { question: 'สรุป "Triple whammy: NSAID + ACEI/ARB + diuretic" เป็น 3 ข้อสั้นๆ', articleId: 'Art9' }]);
        s = await st();
        assert.deepEqual([s.chips[0], s.ans, s.left], ['📝 สรุป 3 บรรทัด*', ['Avoid all three together', 'Check <b>SCr</b> in 1–2 weeks'], 'เหลือ 9 คำถามวันนี้'], JSON.stringify(s));
        if (process.env.OUTDIR) await page.locator('#art-sheet').screenshot({ path: process.env.OUTDIR + '/article-nika.png' });

        // 3. ❓ opens a box; Enter sends what was typed; not found = "Not in this article"; HTML in an answer stays text
        await page.click('#art-nk [data-k="own"]');
        s = await st(); assert.deepEqual([s.box, s.ans], [true, null], '❓ = a box, the old answer goes');
        await page.evaluate(() => { window.__reply = { left: 8, notFound: true }; });
        await page.fill('#art-nk-q', 'ใช้ furosemide ต้องหยุด NSAID ไหม'); await page.press('#art-nk-q', 'Enter'); await page.waitForTimeout(150);
        assert.deepEqual(await last(), ['askNika', { question: 'ใช้ furosemide ต้องหยุด NSAID ไหม', articleId: 'Art9' }]);
        s = await st(); assert.deepEqual([s.note, s.left, s.box], ['❔ ไม่มีในบทความนี้', 'เหลือ 8 คำถามวันนี้', true]);
        await page.evaluate(() => { window.__reply = { left: 7, answer: '<img src=x onerror=alert(1)> ok' }; });
        await page.click('#art-nk .nk-i button'); await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.querySelector('#art-nk .nk-a img')), null, 'answer HTML is escaped');

        // 4. English + the other outcomes
        const n0 = (await page.evaluate(() => window.__sent.length));
        await page.evaluate(() => internArticles.lang('en'));
        await page.click('#art-nk [data-k="key"]'); await page.waitForTimeout(150);
        assert.deepEqual(await last(), ['askNika', { question: '"Triple whammy": what should I remember or monitor?', articleId: 'Art9' }]);
        for (const [reply, note] of [[{ paused: true }, '⏸ Nika is paused during your quiz'], [{ limit: true, left: 0 }, "🌙 That's all for today — back tomorrow"], [{ busy: true, left: 7 }, '☕ Nika is busy — try again in a minute'], ['throw', '⚠️ Could not reach Nika. Try again.']]) {
            await page.evaluate(r => { window.__reply = r; }, reply);
            await page.click('#art-nk [data-k="sum"]'); await page.waitForTimeout(150);
            s = await st(); assert.equal(s.note, note, JSON.stringify(reply));
        }
        assert.equal((await page.evaluate(() => window.__sent.length)) - n0, 5);
        // 5. 🌞 again closes the strip; closing the sheet forgets it
        await page.click('#art-sheet .nkb'); s = await st(); assert.deepEqual([s.on, s.strip], ['false', false]);
        assert.deepEqual(errors, [], 'no page errors: ' + errors);
        console.log('PASS: 🌞 Ask Nika about this article (V101.306) — footer button fits 360 px, 📝/🎯 ask at once with the title + articleId, ❓ box, not in this article, paused/limit/busy/error, escaped, TH/EN');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
