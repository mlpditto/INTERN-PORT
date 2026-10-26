// V101.212 📰 Article ▸ 💬 Any Q? (mockup-article-questions.html + mockup-complete-credits.html): the REAL public/articles.js +
// complete-moments.js inside the REAL index.html on a 390 px touch phone, Firestore faked (writes recorded, nothing leaves the page).
// 👍 Got it = read at once → 💬 Any Q? for 7 s (shrinking line) → the sheet closes by itself; a tap opens the form (❓ / ⚠️ / 💡, ≤ 300 chars),
// Send writes article_questions/{id} with exactly the fields the rules allow, then a 3 s "Complete" moment (A 55 · B 35 · C 10, never the
// same twice in a row, tap closes it). A failed send keeps the text.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8'), rules = fs.readFileSync('firestore.rules', 'utf8');
assert.ok(/<script src="complete-moments\.js\?v=V101\.\d+" defer><\/script>\s*<script src="articles\.js\?v=V101\.\d+" defer><\/script>/.test(html), 'complete-moments.js loads before articles.js');
// the client writes exactly the field list the rule allows (the emulator test, rules-article-questions.emu.cjs, checks the rule itself)
const ruleKeys = (rules.match(/match \/article_questions\/\{questionId\}[\s\S]*?hasOnly\(\[([^\]]+)\]\)/) || [])[1];
assert.ok(ruleKeys, 'firestore.rules has the article_questions block');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            const facade = { collection: n => window.__fake.collection(n), runTransaction: f => Promise.resolve(f({ get: async () => ({ exists: false }), set: () => {} })) };
            const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
            const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
            window.firebase = new Proxy(function () {}, {
                get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } })
                    : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain,
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
            window.liff = window.liff || {};   // the network is blocked, so the LINE SDK never loads — without this the page reloads itself after 15 s
            window.__writes = []; window.__adds = []; window.__failAdd = false;
            window.__fake = {
                collection: n => ({
                    doc: id => ({ id, set: async (v) => { window.__writes.push([n, id, JSON.parse(JSON.stringify(v))]); } }),
                    add: async v => { if (window.__failAdd) throw new Error('offline'); window.__adds.push([n, JSON.parse(JSON.stringify(v))]); return { id: 'q' + window.__adds.length }; },
                    where: () => ({ get: async () => ({ docs: [] }) })
                })
            };
            window.ensureFirebaseAuthReady = async () => ({ uid: 'auth-1' });
            window.requireRegistered = () => true;
            userId = 'U1'; window.myRegistered = true;
            window.myUserDoc = { id: 'U1', group: 'EXTERN', articleSeen: {} };
            window.__art = { id: 'a1', status: 'scheduled', title: { en: 'Psittacosis', th: 'ไข้นกแก้ว' }, body: { en: 'Ask about contact with parrots, macaws, pigeons.', th: 'ถามเรื่องการสัมผัสนก' }, cover: { emoji: '🦜' }, links: [] };
        });
        const st = () => page.evaluate(() => {
            const sh = document.getElementById('art-sheet'), q = document.getElementById('art-q');
            return { open: !!sh, anyq: !!(sh && sh.querySelector('.foot .anyq')), read: sh && sh.querySelector('.rd') ? sh.querySelector('.rd').textContent : '', form: !!q,
                act: ((window.myUserDoc.articleSeen || {}).a1 || {}).act || '', moment: (document.getElementById('cm-card') || {}).dataset ? document.getElementById('cm-card').dataset.moment : '' };
        });

        // ---- 1. Got it = read at once, the button becomes 💬 Any Q? with a 7 s shrinking line, then the sheet closes by itself
        await page.evaluate(() => internArticles._show({ a: window.__art, kind: 'live' }));
        await page.click('#art-sheet .ok');
        let s = await st();
        assert.deepEqual([s.open, s.anyq, s.read, s.act], [true, true, '✓ Read', 'ok'], 'Got it: read now, ✓ Read + 💬 Any Q? in its place: ' + JSON.stringify(s));
        const uw = await page.evaluate(() => window.__writes.filter(x => x[0] === 'users').map(x => x[2]));
        assert.ok(uw.some(v => v && v.articleSeen && v.articleSeen.a1 && v.articleSeen.a1.act === 'ok'), 'the read is written to users/{uid} at once: ' + JSON.stringify(uw));
        const line = await page.$eval('#art-sheet .foot .anyq', b => { const a = getComputedStyle(b, '::after'); return [a.animationName, a.animationDuration, a.height, getComputedStyle(b).backgroundColor]; });
        assert.deepEqual(line, ['artShrink', '7s', '3px', 'rgb(79, 70, 229)'], 'indigo button, a 3 px line shrinking over 7 s');
        assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('anyq')), true, 'focus moves to 💬 Any Q?');
        await page.waitForTimeout(6500);
        assert.equal((await st()).open, true, 'still there at 6.5 s');
        await page.waitForTimeout(800);
        s = await st();
        assert.deepEqual([s.open, s.act], [false, 'ok'], 'closed by itself after 7 s, still read');

        // ---- 2. the form: three kinds, the placeholder follows the kind, a counter, Send only with text
        await page.evaluate(() => { window.myUserDoc.articleSeen = {}; internArticles._show({ a: window.__art, kind: 'live' }); });
        await page.click('#art-sheet .ok');
        await page.click('#art-sheet .foot .anyq');
        let f = await page.evaluate(() => ({ kinds: [...document.querySelectorAll('#art-sheet .aq-k button')].map(b => [b.dataset.k, b.getAttribute('aria-pressed'), b.textContent.trim()]),
            ph: document.getElementById('art-q').placeholder, max: document.getElementById('art-q').maxLength, n: document.getElementById('art-qn').textContent, send: document.getElementById('art-qs').disabled,
            sub: document.querySelector('#art-sheet .aq-sub').textContent, hint: document.querySelector('#art-sheet .aq-f span').textContent, focus: document.activeElement.id }));
        assert.deepEqual(f.kinds, [['ask', 'true', '❓ A question'], ['wrong', 'false', '⚠️ Wrong / out of date'], ['add', 'false', '💡 Please add']], 'three kinds, ❓ first: ' + JSON.stringify(f.kinds));
        assert.deepEqual([f.ph, f.max, f.n, f.send, f.focus], ['What would you like to ask?', 300, '0 / 300', true, 'art-q'], 'empty: Send waits, the box has focus');
        assert.match(f.sub, /name is not shown/); assert.match(f.hint, /History/);
        await page.click('#art-sheet .aq-k [data-k="wrong"]');
        assert.equal(await page.$eval('#art-q', t => t.placeholder), 'Which part looks wrong or out of date?', 'the placeholder follows the kind');
        assert.equal(await page.$eval('#art-sheet .aq-k [data-k="wrong"]', b => getComputedStyle(b).backgroundColor), 'rgb(255, 251, 235)', '⚠️ is amber');
        await page.fill('#art-q', '  Severe cases are uncommon with early doxycycline?  ');
        f = await page.evaluate(() => ({ n: document.getElementById('art-qn').textContent, send: document.getElementById('art-qs').disabled }));
        assert.deepEqual(f, { n: '53 / 300', send: false }, 'the counter counts, Send is on');
        await page.waitForTimeout(7300);
        assert.equal((await st()).form, true, 'the form does not close on the 7 s timer');
        assert.ok(await page.evaluate(() => { const sh = document.getElementById('art-sheet'); return sh.scrollWidth <= sh.clientWidth + 1; }), 'no sideways overflow at 390 px');
        if (process.env.QA_SHOT) await page.locator('#art-sheet').screenshot({ path: process.env.QA_SHOT + '/anyq-form.png' });

        // ---- 3. a failed send keeps the text and says so
        await page.evaluate(() => { window.__failAdd = true; });
        await page.click('#art-qs');
        await page.waitForFunction(() => document.getElementById('art-qe') && document.getElementById('art-qe').textContent);
        f = await page.evaluate(() => ({ text: document.getElementById('art-q').value, err: document.getElementById('art-qe').textContent, kind: document.querySelector('#art-sheet .aq-k [aria-pressed="true"]').dataset.k, send: document.getElementById('art-qs').disabled }));
        assert.deepEqual(f, { text: '  Severe cases are uncommon with early doxycycline?  ', err: 'Could not send — your text is kept. Try again.', kind: 'wrong', send: false }, 'failure: text + kind kept, Send again');

        // ---- 4. Send: exactly the allowed fields, then the sheet closes and a Complete moment plays (tap closes it)
        await page.evaluate(() => { window.__failAdd = false; });
        await page.click('#art-qs');
        await page.waitForFunction(() => document.getElementById('cm-card'));
        const add = await page.evaluate(() => window.__adds[0]);
        assert.equal(add[0], 'article_questions');
        assert.deepEqual(Object.keys(add[1]).sort(), ruleKeys.split(',').map(k => k.trim().replace(/'/g, '')).sort(), 'the write has exactly the fields the rule allows');
        assert.deepEqual(add[1], { articleId: 'a1', articleTitle: 'Psittacosis', kind: 'wrong', text: 'Severe cases are uncommon with early doxycycline?', lang: 'en', authUid: 'auth-1', userId: 'U1', status: 'open', createdAt: 'TS' });
        s = await st();
        assert.deepEqual([s.open, !!s.moment], [false, true], 'sheet closed, Complete is playing: ' + s.moment);
        const first = s.moment;
        await page.click('#cm-card');
        assert.equal(await page.evaluate(() => !!document.getElementById('cm-back')), false, 'a tap closes it');

        // ---- 5. Complete: A 55 · B 35 · C 10, never the same twice in a row, closes by itself after 3 s, rare scene says nothing about rarity
        const ch = await page.evaluate(() => { const c = window.completeMoment._choose; const r = []; for (let i = 0; i < 40; i++) r.push(c(0.1, 'a1'), c(0.6, 'b5a'), c(0.95, 'c1')); return r; });
        for (let i = 0; i < ch.length; i += 3) {
            assert.ok(/^a[23]$/.test(ch[i]) && /^b(5b|6|7)$/.test(ch[i + 1]) && ch[i + 2] === 'c2', 'pools by roll, last one excluded: ' + ch.slice(i, i + 3));
        }
        let prev = first;
        for (let i = 0; i < 30; i++) {
            const k = await page.evaluate(() => { window.completeMoment(); return document.getElementById('cm-card').dataset.moment; });
            assert.notEqual(k, prev, 'never twice in a row: ' + prev + ' → ' + k); prev = k;
            await page.click('#cm-card');
        }
        for (const k of ['c1', 'c2']) {
            const txt = await page.evaluate(k => { window.completeMoment(k); const t = document.getElementById('cm-card').innerText; document.getElementById('cm-back').click(); return t; }, k);
            assert.ok(!/rare|post-credit|หายาก/i.test(txt), k + ' never says it is rare: ' + txt);
        }
        await page.evaluate(() => window.completeMoment('b6'));
        await page.waitForTimeout(3200);
        assert.equal(await page.evaluate(() => !!document.getElementById('cm-back')), false, 'gone by itself after 3 s');

        // ---- 6. Thai UI: Thai labels, never hidden by lang-toggle
        await page.evaluate(() => { document.body.classList.add('lang-th-on'); window.myUserDoc.articleSeen = {}; internArticles._show({ a: window.__art, kind: 'live' }); });
        await page.click('#art-sheet .ok');
        await page.click('#art-sheet .foot .anyq');
        const th = await page.evaluate(() => ({ kinds: [...document.querySelectorAll('#art-sheet .aq-k button')].map(b => b.innerText.trim()), noToggle: document.getElementById('art-sheet').classList.contains('lang-no-toggle'), sub: document.querySelector('#art-sheet .aq-sub').innerText }));
        assert.deepEqual(th.kinds, ['❓ สงสัย', '⚠️ ข้อมูลผิด/ล้าสมัย', '💡 อยากให้เพิ่ม']); assert.ok(th.noToggle); assert.match(th.sub, /ไม่แสดงชื่อ/);
        await page.evaluate(() => internArticles.close('ok'));

        // ---- 7. reduced motion: only ✓ + a message
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const rm = await page.evaluate(() => [0.6, 0.95, 0.1].map(r => window.completeMoment._choose(r, '')));
        assert.ok(rm.every(k => /^a\d$/.test(k)), 'reduce motion → messages only: ' + rm);

        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Article 💬 Any Q? — Got it = read → 💬 for 7 s (auto-close), form ❓/⚠️/💡 ≤ 300 with counter, failure keeps text, write = exactly the rule fields, Complete moment (A/B/C pools, no repeat, 3 s, tap closes, rare never says so, reduce-motion = message), Thai, 390 px');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
