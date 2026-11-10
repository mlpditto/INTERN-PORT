// V101.302 (owner pick C) — intern 📰 article popup with a 🎬 clip: it opens ON the clip (muted, the chat bubbles are the captions, one line at a
// time), 🔇 / tapping the chat = sound (the phone's own voice), ✕ / ⌃ / a swipe up = the article text (👍 Got it etc. as before). The clip follows
// the reading language (Thai first), falls back to EN; an article without a clip opens on the text as before. The REAL index.html + articles.js on
// a 390 px touch phone, a fake Firestore, speechSynthesis stubbed (records what it would say). OUTDIR=… saves screenshots.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

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
            // the phone's voice, stubbed: records each line, "speaks" for 300 ms
            window.__said = [];
            window.SpeechSynthesisUtterance = function (t) { this.text = t; };
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { window.__said.push([u.text, u.lang]); setTimeout(() => u.onend && u.onend(), 300); }, cancel: () => {} } });
        });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.internArticles && window.completeMoment);
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            window.liff = window.liff || {};
            window.__writes = [];
            window.__fake = { collection: n => ({ doc: id => ({ id, set: async v => { window.__writes.push([n, id]); } }), add: async () => ({ id: 'x' }), where: () => ({ get: async () => ({ docs: [] }) }) }) };
            userId = 'U1'; window.myRegistered = true;
            window.myUserDoc = { id: 'U1', group: 'EXTERN', articleSeen: {} };
            window.__art = { id: 'a1', status: 'scheduled', title: { en: 'Topical corticosteroids (2)', th: 'ยาทาสเตียรอยด์ (2)' }, body: { en: 'The next day…', th: 'วันต่อมา…' }, cover: { emoji: '💊' },
                audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 2,
                clip: { th: [{ w: 'q', t: 'ลูกชาย 5 ขวบ ผื่นทั้งตัว ใช้ครีมตัวไหนดี?' }, { w: 'rx', t: 'อายุเกิน 1 ปี ใช้กลุ่ม 4, 5 ได้ อย่างระวัง' }, { w: 'key', t: '0.1% Triamcinolone · Mometasone' }],
                        en: [{ w: 'q', t: 'My son is 5 — which cream?' }, { w: 'rx', t: 'Over 1 year: Class 4, 5 is OK' }] } };
        });
        const st = () => page.evaluate(() => {
            const sh = document.getElementById('art-sheet'), c = sh && sh.querySelector('#art-clip');
            return { open: !!sh, clip: !!c, bubbles: c ? [...c.querySelectorAll('.clp-m, .clp-key')].map(e => e.textContent) : [], now: c && c.querySelector('.now') ? c.querySelector('.now').textContent : '',
                snd: c ? c.querySelector('.clp-snd').textContent : '', read: c ? c.querySelector('.clp-read').textContent : '', text: !!(sh && sh.querySelector('#art-text')), ok: !!(sh && sh.querySelector('.foot .ok')) };
        });

        // 1. opens on the clip, Thai, muted: line 1 only, its own captions; lines come one at a time
        await page.evaluate(() => internArticles._show({ a: window.__art, kind: 'live' }));
        let s = await st();
        assert.deepEqual([s.open, s.clip, s.bubbles, s.now, s.snd, s.text], [true, true, ['ลูกชาย 5 ขวบ ผื่นทั้งตัว ใช้ครีมตัวไหนดี?'], 'ลูกชาย 5 ขวบ ผื่นทั้งตัว ใช้ครีมตัวไหนดี?', '🔇 แตะเพื่อฟังเสียง', false], 'opens on the Thai clip, muted, line 1: ' + JSON.stringify(s));
        assert.match(s.read, /ปัดขึ้นเพื่ออ่าน/);
        if (process.env.OUTDIR) await page.screenshot({ path: process.env.OUTDIR + '/intern-clip-1.png' });
        assert.deepEqual(await page.evaluate(() => window.__said), [], 'muted: nothing spoken');
        await page.waitForFunction(() => document.querySelectorAll('#art-clip .clp-m, #art-clip .clp-key').length >= 2, null, { timeout: 6000 });
        s = await st(); assert.equal(s.bubbles.length, 2, 'line 2 arrives on its own (reading time)');

        // 2. tap the chat = sound: the current line is read by the phone (th-TH), then the next one
        await page.click('#art-clip .clp-chat');
        await page.waitForFunction(() => window.__said.length >= 2, null, { timeout: 6000 });
        const said = await page.evaluate(() => window.__said);
        assert.deepEqual(said.slice(0, 2), [['อายุเกิน 1 ปี ใช้กลุ่ม 4, 5 ได้ อย่างระวัง', 'th-TH'], ['0.1% Triamcinolone · Mometasone', 'th-TH']], 'sound on: the phone reads each line: ' + JSON.stringify(said));
        await page.waitForFunction(() => document.querySelector('#art-clip .clp-read.end'), null, { timeout: 6000 });
        s = await st(); assert.deepEqual([s.bubbles.length, s.snd, /อ่านบทความ/.test(s.read), s.now], [3, '🔊', true, ''], 'the end: all lines, "⌃ อ่านบทความ" nudges');
        if (process.env.OUTDIR) await page.screenshot({ path: process.env.OUTDIR + '/intern-clip-2.png' });

        // 3. ⌃ → the article text with 👍 Got it, nothing marked read yet
        await page.evaluate(() => document.querySelector('#art-clip .clp-read').click());   // it bobs (animation), so no pointer-stability wait
        s = await st(); assert.deepEqual([s.open, s.clip, s.text, s.ok], [true, false, true, true], '⌃ = the article text');
        assert.equal(await page.evaluate(() => ((window.myUserDoc.articleSeen || {}).a1 || {}).act || ''), '', 'reading the clip does not mark the article read');
        await page.evaluate(() => internArticles.close('x'));

        // 4. a swipe up skips too; ✕ skips; English reader gets the EN clip; no clip = the text as before
        await page.evaluate(() => { window.myUserDoc.articleSeen = {}; internArticles._S.cl = 'en'; internArticles._show({ a: window.__art, kind: 'live' }); });
        s = await st(); assert.deepEqual([s.clip, s.bubbles, s.snd], [true, ['My son is 5 — which cream?'], '🔇 Tap for sound'], 'EN reader → EN clip');
        await page.evaluate(() => { const el = document.getElementById('art-clip'), T = (y) => [{ clientX: 100, clientY: y }];
            el.dispatchEvent(Object.assign(new Event('touchstart'), { touches: T(600) })); el.dispatchEvent(Object.assign(new Event('touchend'), { changedTouches: T(480) })); });
        s = await st(); assert.deepEqual([s.clip, s.text], [false, true], 'swipe up = the text');
        await page.evaluate(() => internArticles.close('x'));
        await page.evaluate(() => { window.myUserDoc.articleSeen = {}; internArticles._S.cl = 'ko'; internArticles._show({ a: window.__art, kind: 'live' }); });
        s = await st(); assert.equal(s.bubbles[0], 'My son is 5 — which cream?', 'no Korean clip → EN');
        await page.click('#art-sheet .clp-top .x');
        s = await st(); assert.deepEqual([s.clip, s.text], [false, true], '✕ = the text (the sheet stays)');
        await page.evaluate(() => internArticles.close('x'));
        await page.evaluate(() => { window.myUserDoc.articleSeen = {}; internArticles._S.cl = 'th'; const a = Object.assign({}, window.__art); delete a.clip; internArticles._show({ a, kind: 'live' }); });
        s = await st(); assert.deepEqual([s.clip, s.text, s.ok], [false, true, true], 'no clip → the text, as before');
        await page.evaluate(() => internArticles.close('x'));
        assert.deepEqual(await page.evaluate(() => [internArticles._clipFor({ clip: { th: [{ w: 'q', t: ' ' }] } }, 'th'), internArticles._clipFor({}, 'th')]), [null, null], 'empty lines = no clip');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: intern 🎬 article clip (V101.302) — opens on the clip muted with captions, one line at a time; tap = the phone reads it (th-TH); ⌃ / ✕ / swipe up = the text; TH → EN fallback; no clip = as before');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
