// V101.307 (owner pick A) — 💭 think questions on the intern side (nika-think.js): 🌅 today's question = a card on top of Nika with 🔥 n
// (days in a row answered); 💭 general ones = purple chips (tap → its card, ✕ back to today's); 📰 an article's question = a box under the
// article after 👍 Got it (and the sheet then stays open). Answering writes nika_think_answers/{qid}_{authUid} with exactly the fields the
// rule allows; the card then shows ✓ your answer, and the admin's 👍 / 💬 reply. The REAL index.html + nika-think.js + nika-ask.js +
// articles.js; a fake Firestore. OUTDIR=… saves screenshots.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            const day = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10), now = Date.now();
            window.__day = day;
            window.__writes = [];
            window.__items = [
                { id: 'd1', q: 'ถ้าผู้ป่วย CKD stage 4 ขอซื้อ NSAID คุณจะคุยอย่างไร?', kind: 'day', day: day(now) },
                { id: 'old', q: 'An old day question', kind: 'day', day: day(now - 864e5) },
                { id: 'g1', q: 'ทำไม INR สูงหลังเริ่ม antibiotic?', kind: 'general' },
                { id: 'a1', q: 'Why test the first morning urine?', kind: 'article', articleId: 'Art9' }];
            // answered the day questions of the 2 days before today → 🔥 2 (today still open)
            window.__answers = [{ qid: 'p1', kind: 'day', day: day(now - 864e5), answer: 'x' }, { qid: 'p2', kind: 'day', day: day(now - 2 * 864e5), answer: 'y' }];
            const snap = list => ({ docs: list.map(d => ({ id: d.qid, data: () => d })) });
            window.db = { collection: n => ({
                doc: id => ({ id, get: async () => n === 'app_settings' && id === 'nika_think' ? { exists: true, data: () => ({ items: window.__items }) } : { exists: false, data: () => ({}) },
                    set: async d => { if (window.__fail) throw new Error('permission-denied'); window.__writes.push([n, id, d]); } }),
                where: (f, op, v) => ({ get: async () => { window.__where = [n, f, op, v]; return snap(window.__answers); } }),
                add: async () => ({ id: 'x' }) }) };
            window.__asked = [];
            const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
            window.firebase = new Proxy(function () {}, {
                get: (t, k) => k === 'firestore' ? Object.assign(() => window.db, { FieldValue: { serverTimestamp: () => 'TS', delete: () => 0, increment: n => n, arrayUnion: (...a) => a } })
                    : k === 'functions' ? () => ({ httpsCallable: () => d => { window.__asked.push(d); return Promise.resolve({ data: { left: 10 } }); } }) : chain,
                apply: () => chain
            });
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.NikaThink && window.nikaAsk && window.internArticles);
        const nika = () => page.evaluate(() => {
            document.body.classList.add('lang-th-on');
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            let n = document.getElementById('dd-codex-card');
            for (; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).display === 'none') n.style.setProperty('display', 'block', 'important');
            document.getElementById('dd-section-content').style.display = 'block';
            userId = 'U1'; window.myRegistered = true; window.ensureFirebaseAuthReady = async () => ({ uid: 'auth1' });
            document.querySelector('[data-ddtype="nika"]').click();
        }).then(() => page.waitForTimeout(300));
        const card = () => page.evaluate(() => { const c = document.querySelector('#nika-section-content .nk-think .nt-card'); return c ? { cls: c.className, h: c.querySelector('.nt-h').textContent.trim(), q: c.querySelector('.nt-q').textContent,
            input: !!c.querySelector('textarea'), mine: c.querySelector('.nt-mine') ? c.querySelector('.nt-mine').textContent : '', rep: c.querySelector('.nt-rep') ? c.querySelector('.nt-rep').textContent : '', like: !!c.querySelector('.nt-like'),
            first: document.querySelector('#nika-section-content .nk-body').firstElementChild.className } : null; });
        const chips = () => page.evaluate(() => [...document.querySelectorAll('#nika-section-content .nk-chip')].map(b => (b.classList.contains('nk-think-c') ? 'T:' : '') + b.textContent));

        // 1. 🌅 today's question on top, 🔥 2; the 💭 general one is a chip; nothing else answered
        await nika();
        let c = await card();
        assert.deepEqual([c.first, c.cls, c.h, c.q, c.input], ['nk-think', 'nt-card nt-day', '🌅 คำถามวันนี้🔥 2', 'ถ้าผู้ป่วย CKD stage 4 ขอซื้อ NSAID คุณจะคุยอย่างไร?', true], 'today\'s card first: ' + JSON.stringify(c));
        assert.deepEqual(await page.evaluate(() => window.__where), ['nika_think_answers', 'authUid', '==', 'auth1'], 'reads only my own answers');
        assert.deepEqual((await chips()).slice(0, 1), ['T:💭 ทำไม INR สูงหลังเริ่ม antibiotic?'], '💭 chip: ' + await chips());
        if (process.env.OUTDIR) await page.locator('#dd-codex-card').screenshot({ path: process.env.OUTDIR + '/nika-think-day.png' });

        // 2. a failed send keeps the text and says so; then it sends: one doc, id = qid_authUid, the rule's 8 fields
        await page.fill('.nk-think textarea', '  ไม่ขาย แนะนำ paracetamol  ');
        await page.evaluate(() => { window.__fail = true; });
        await page.click('.nk-think .nt-go'); await page.waitForTimeout(150);
        assert.deepEqual(await page.evaluate(() => [document.querySelector('.nk-think .nt-e').textContent, document.querySelector('.nk-think textarea').value]), ['ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', '  ไม่ขาย แนะนำ paracetamol  '], 'failed: message + text kept');
        await page.evaluate(() => { window.__fail = false; });
        await page.click('.nk-think .nt-go'); await page.waitForTimeout(150);
        const w = await page.evaluate(() => window.__writes);
        assert.equal(w.length, 1);
        assert.deepEqual([w[0][0], w[0][1], Object.keys(w[0][2]).sort()], ['nika_think_answers', 'd1_auth1', ['answer', 'authUid', 'createdAt', 'day', 'kind', 'qid', 'question', 'userId']]);
        assert.deepEqual([w[0][2].answer, w[0][2].authUid, w[0][2].userId, w[0][2].kind, w[0][2].createdAt, w[0][2].day === await page.evaluate(() => window.__day(Date.now()))], ['ไม่ขาย แนะนำ paracetamol', 'auth1', 'U1', 'day', 'TS', true]);
        c = await card();
        assert.deepEqual([c.input, c.mine, c.h], [false, '✓ คำตอบของคุณ ไม่ขาย แนะนำ paracetamol', '🌅 คำถามวันนี้🔥 3'], 'answered: ✓ mine, 🔥 3: ' + JSON.stringify(c));

        // 3. 💭 chip → its card with ✕; ✕ = back to today's
        await page.click('.nk-chip.nk-think-c'); await page.waitForTimeout(100);
        c = await card();
        assert.deepEqual([c.cls, c.h, c.q], ['nt-card nt-think', '💭 ลองคิดต่อ✕', 'ทำไม INR สูงหลังเริ่ม antibiotic?']);
        assert.ok(!(await chips()).some(x => x.startsWith('T:')), 'the open one leaves the chip row');
        await page.click('.nk-think .nt-x'); await page.waitForTimeout(100);
        assert.equal((await card()).cls, 'nt-card nt-day nt-done');

        // 4. the admin's 👍 + reply show on the card (fresh load)
        await page.evaluate(() => { window.__answers.push({ qid: 'g1', kind: 'general', day: '2026-01-01', answer: 'Drug interaction', liked: true, reply: 'ดีมาก — ลองดู CYP2C9 ด้วย' }); return NikaThink.load(true); });
        await nika();
        assert.ok(!(await chips()).some(x => x.startsWith('T:')), 'answered general = no chip');
        const rep = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = NikaThink.cardHtml(NikaThink._S.items.find(x => x.id === 'g1')); return [d.querySelector('.nt-like').textContent, d.querySelector('.nt-rep').textContent, !!d.querySelector('textarea')]; });
        assert.deepEqual(rep, ['👍 Admin กด 👍', '💬 Admin ดีมาก — ลองดู CYP2C9 ด้วย', false], 'reply + like shown: ' + rep);

        // 5. article: 👍 Got it → the 💭 box under the footer, and the sheet does not close itself
        await page.evaluate(() => {
            window.myUserDoc = { id: 'U1', group: 'EXTERN', articleSeen: {} };
            internArticles._show({ a: { id: 'Art9', status: 'scheduled', title: { en: 'Microalbumin' }, body: { en: 'Short.' }, cover: { emoji: '🫘' }, audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 1 }, kind: 'live' });
        });
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => !!document.querySelector('#art-sheet .nt-card')), false, 'no box before Got it');
        await page.click('#art-sheet .ok'); await page.waitForTimeout(150);
        const art = await page.evaluate(() => { const c = document.querySelector('#art-sheet .nt-card'); return c && { h: c.querySelector('.nt-h').textContent, q: c.querySelector('.nt-q').textContent, after: c.previousElementSibling.className }; });
        assert.deepEqual(art, { h: '💭 ลองคิดต่อ', q: 'Why test the first morning urine?', after: 'foot' }, 'article box: ' + JSON.stringify(art));
        if (process.env.OUTDIR) await page.locator('#art-sheet').screenshot({ path: process.env.OUTDIR + '/nika-think-article.png' });
        await page.fill('#art-sheet .nt-card textarea', 'Concentrated, less variation');
        await page.click('#art-sheet .nt-go'); await page.waitForTimeout(150);
        assert.deepEqual(await page.evaluate(() => { const w = window.__writes.pop(); return [w[1], w[2].kind, document.querySelector('#art-sheet .nt-mine').textContent]; }), ['a1_auth1', 'article', '✓ คำตอบของคุณ Concentrated, less variation']);
        await page.waitForTimeout(7600);
        assert.ok(await page.evaluate(() => !!document.getElementById('art-sheet')), 'with a 💭 box the sheet stays open past 7 s');

        assert.deepEqual(errors.filter(e => !/firebase.(firestore|auth) is not a function/.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: 💭 think questions, intern (V101.307) — 🌅 card on top of Nika with 🔥 streak, 💭 chips → card ✕, 📰 box after Got it (sheet stays), one answer = qid_authUid with the rule\'s 8 fields, failed send keeps text, ✓ mine shown');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
