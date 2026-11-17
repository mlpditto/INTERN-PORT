// V102.673 / V101.320 (owner pick B, mockup-article-sequel/): a sequel names its previous part.
// Admin — Articles editor: a ⏪ chip in the title box opens a picker (the article with the same title minus "(n)" comes first); the picked part and a
// one-line recap (per language, 120 characters, ✨ writes it from the previous part) sit under the title; saved as articles/{id}.prev = { id, title, recap }.
// ✨ Ep n+1 sets it by itself. Intern — the article popup shows ONE ⏪ line under the title (the recap, else the previous part's title); a tap shows the
// previous part in the same sheet (a look: no Got it, nothing written) with ‹ Back.
// The REAL public/admin.html + articles-admin.js and public/index.html + articles.js in Chromium (network stubbed). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };
const shot = async (page, n) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); };
{
    const h = fs.readFileSync('public/admin.html', 'utf8'), i = fs.readFileSync('public/index.html', 'utf8'), rules = fs.readFileSync('firestore.rules', 'utf8').replace(/\r\n/g, '\n');
    const av = (h.match(/<title>Nika Admin \((V102\.\d+)\)/) || [])[1], iv = (i.match(/<title>Internship Portfolio \((V101\.\d+)\)/) || [])[1];
    ok(/articles-admin\.js\?v=V102\.(\d+)/.test(h) && +RegExp.$1 >= 673 && /articles\.js\?v=V101\.(\d+)/.test(i) && +RegExp.$1 >= 320 && !!av && !!iv, 'both article scripts are cache-busted at or after the version that added ⏪');
    ok(/match \/articles\/\{articleId\} \{\n\s+allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && resource\.data\.status == 'scheduled'\);\n\s+allow write: if isAdmin\(\);/.test(rules), 'firestore.rules: articles unchanged — interns read scheduled ones, only admins write (prev rides on the article)');
}
(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        console.log('admin: the Articles editor');
        const page = await (await browser.newContext({ viewport: { width: 1360, height: 950 }, deviceScaleFactor: SHOT ? 1.5 : 1 })).newPage();
        const errs = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a, delete: () => 'DEL' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(pathToFileURL(path.resolve('public/admin.html')).href);
        await page.waitForFunction(() => window.Articles && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.evaluate(() => {
            const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
            window.__w = []; window.__ai = []; window.showToast = () => {};
            window.adminApp = { auth: () => ({ currentUser: { uid: 'admin1', email: 'a@x.test' } }) }; window.auth = window.adminApp.auth();
            window.callUniversalAI = async (model, prompt, json, img, sys, opt) => { window.__ai.push({ prompt, feature: opt && opt.feature }); return { text: window.__aiText }; };
            window.db = { collection: coll => ({ add: async d => { window.__w.push(['add', coll, JSON.parse(JSON.stringify(d))]); return { id: 'new1' }; }, doc: id => ({ id, update: async d => { window.__w.push(['update', coll, id, JSON.parse(JSON.stringify(d))]); } }),
                get: async () => ({ docs: coll === 'articles' ? Articles._S.list.map(a => ({ id: a.id, data: () => Object.assign({}, a) })) : [] }) }) };
            const S = Articles._S; S.loaded = true; S.loading = false;
            const D = 864e5, now = Date.now(), base = { cover: { emoji: '📰' }, status: 'scheduled', audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
            S.list = [
                Object.assign({ id: 'a1', title: { en: 'Inclisiran twice a year — does it shrink plaque?', th: 'Inclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม' }, body: { en: 'An uncle with high LDL asks whether a twice-yearly injection can shrink plaque.\n\n➡️ Next: what it costs', th: 'ลุงที่ไขมันสูงถามว่ายาฉีดปีละ 2 เข็มยุบพลัคได้ไหม' }, startAt: now - 9 * D, endAt: now - 2 * D }, base),
                Object.assign({ id: 'a2', title: { en: 'Inclisiran twice a year — does it shrink plaque? (2)', th: 'Inclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม (2)' }, body: { en: 'The uncle nods and asks at once: how much is one shot?', th: 'ลุงพยักหน้า แล้วถามต่อทันที' }, startAt: now + D, endAt: now + 7 * D }, base),
                Object.assign({ id: 'a3', title: { en: 'Metformin and B12' }, body: { en: 'Long-term metformin lowers B12.' }, startAt: now + 3 * D, endAt: now + 9 * D }, base)];
            Articles.open(); Articles.edit('a2');
        });
        const ed = () => page.evaluate(() => { const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)], S = Articles._S, pv = q('#art-pp'), ti = q('#art-title');
            return { chips: qa('.art-tw .art-xc').map(b => b.textContent.trim() + (b.classList.contains('ring') ? '*' : '')), pad: getComputedStyle(ti).paddingRight, fits: q('.art-tw .art-xr').getBoundingClientRect().left >= ti.getBoundingClientRect().right - parseFloat(getComputedStyle(ti).paddingRight) - 1,
                pv: pv ? pv.textContent.replace(/\s+/g, ' ').trim() : null, opts: qa('#art-pp .o').map(b => b.textContent.trim()), name: (q('#art-pp b') || {}).textContent || '', recap: q('#art-recap') ? q('#art-recap').value : null, ph: q('#art-recap') ? q('#art-recap').placeholder : '', n: (q('#art-recap-n') || {}).textContent || '',
                pvp: (q('#art-body .art-pv .pvp') || {}).textContent || '', prev: S.cur.prev ? JSON.parse(JSON.stringify(S.cur.prev)) : null, dirty: JSON.stringify(S.cur) !== S.base, err: S.err || '', wide: document.documentElement.scrollWidth > innerWidth + 1 }; });
        let e = await ed();
        ok(e.chips.join(' ') === '⏪ 🩺 💊 🔗' && e.pad === '160px' && e.fits && e.pv === null && e.prev === null && !e.dirty, 'a ⏪ chip leads the 🩺 💊 🔗 chips in the title box (no ring yet); the title text stops before the chips; nothing under the title');
        await page.click('.art-tw .art-xc[aria-label="Previous part"]'); e = await ed();
        ok(e.opts.length === 2 && /^📰 Inclisiran twice a year — does it shrink plaque\?$/.test(e.opts[0]) && /Metformin/.test(e.opts[1]), 'tap ⏪ → a picker; the article with the same title minus "(2)" comes first, before a newer one; the article itself is not offered');
        await page.fill('#art-pv-q', 'metf'); e = await ed();
        ok(e.opts.length === 1 && /Metformin/.test(e.opts[0]) && await page.evaluate(() => document.activeElement.id === 'art-pv-q'), 'the box filters the list and keeps the caret');
        await page.fill('#art-pv-q', ''); await shot(page, 'sequel-admin-picker');
        await page.click('#art-pp .o'); e = await ed();
        ok(e.chips[0] === '⏪*' && e.name === 'Inclisiran twice a year — does it shrink plaque?' && e.recap === '' && e.n === '0/120' && /\(EN\)/.test(e.ph) && e.prev.id === 'a1' && e.prev.title.th && e.dirty, 'picked → ⏪ is ringed; under the title: the previous part, an empty recap box (EN), 0/120; the article is unsaved');
        const same = await page.evaluate(() => { const i = document.getElementById('art-recap'); i.__mark = 1; return true; });
        await page.fill('#art-recap', 'An uncle asks about a twice-yearly shot'); e = await ed();
        ok(same && e.n === '39/120' && e.prev.recap.en === 'An uncle asks about a twice-yearly shot' && await page.evaluate(() => document.getElementById('art-recap').__mark === 1), 'typing counts the characters and does not repaint the box (the caret stays)');
        ok(e.pvp === '⏪An uncle asks about a twice-yearly shot', 'the 📱 Preview shows the ⏪ line as it is typed');
        await page.evaluate(() => { window.__aiText = '"An uncle with high LDL asks if a twice-yearly injection can shrink plaque."\nSecond line the model should not have sent'; });
        await page.click('#art-recap-ai'); await page.waitForFunction(() => !Articles._S.recapBusy && document.getElementById('art-recap').value.indexOf('high LDL') > 0); e = await ed();
        const ai = await page.evaluate(() => window.__ai.map(x => ({ f: x.feature, a1: /An uncle with high LDL asks whether/.test(x.prompt), en: /ONE sentence in English/.test(x.prompt), rule: /no new fact, no number the text does not have/.test(x.prompt), own: /nods and asks at once/.test(x.prompt) })));
        ok(ai.length === 1 && ai[0].f === 'article_recap' && ai[0].a1 && ai[0].en && ai[0].rule && !ai[0].own, '✨ = one AI call (article_recap) that reads the PREVIOUS part only, in the language being edited, told to add no fact');
        ok(e.recap === 'An uncle with high LDL asks if a twice-yearly injection can shrink plaque.' && e.n === '74/120' && !e.err, 'the first line of the reply fills the box, without its quotation marks: ' + e.recap);
        await shot(page, 'sequel-admin-recap');
        await page.evaluate(() => Articles.lang('th')); e = await ed();
        ok(e.name === 'Inclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม' && e.recap === '' && /\(TH\)/.test(e.ph), 'the recap is per language: on TH the previous part shows its Thai title and the box is empty');
        await page.fill('#art-recap', 'ลุงถามว่ายาฉีดปีละ 2 เข็มยุบพลัคได้ไหม'); await page.evaluate(() => Articles.save(false)); await page.waitForFunction(() => window.__w.length === 1);
        let w = await page.evaluate(() => window.__w[0]);
        ok(w[0] === 'update' && w[2] === 'a2' && w[3].prev.id === 'a1' && w[3].prev.title.en === 'Inclisiran twice a year — does it shrink plaque?' && w[3].prev.title.th && w[3].prev.recap.en.indexOf('high LDL') > 0 && w[3].prev.recap.th === 'ลุงถามว่ายาฉีดปีละ 2 เข็มยุบพลัคได้ไหม' && Object.keys(w[3].prev).sort().join() === 'id,recap,title', 'Save → articles/a2.prev = { id, title (a copy of the previous part\'s titles), recap (per language) }');
        await page.click('#art-pp button[aria-label="Remove the previous part"]'); e = await ed();
        ok(e.prev === null && e.pv === null && e.chips[0] === '⏪' && e.dirty, '✕ → not a sequel any more');
        await page.evaluate(() => Articles.save(false)); await page.waitForFunction(() => window.__w.length === 2); w = await page.evaluate(() => window.__w[1]);
        ok(w[3].prev === null, 'saved as prev: null');
        await page.evaluate(() => { window.__aiText = 'Title: Costs (2)\n\nBody of episode two.'; Articles.edit('a1'); Articles.episode(); });
        const ep = await page.evaluate(() => { const c = Articles._S.cur; return { id: c.id, prev: c.prev && c.prev.id, title: c.title.en, t: c.prev && c.prev.title.en }; });
        ok(ep.id === null && ep.prev === 'a1' && /\(2\)$/.test(ep.title) && /shrink plaque\?$/.test(ep.t), '✨ Ep 2 from a saved episode: the new article already names episode 1 as its previous part');
        ok(await page.evaluate(() => { Articles.edit('a3'); return Articles._S.cur.prev === null && JSON.stringify(Articles._S.cur) === Articles._S.base; }), 'an article saved before this feature opens with no previous part and is not "unsaved"');
        ok(errs.length === 0, 'no page errors (admin): ' + errs.join(' | '));

        console.log('intern: the article popup');
        const ip = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 })).newPage(); const ierr = []; ip.on('pageerror', x => ierr.push(x.message));
        await ip.addInitScript(() => { const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any }); window.firebase = any; });
        await ip.addInitScript(() => { window.marked = { parse: src => String(src).split(/\n{2,}/).map(b => '<p>' + b.replace(/\n/g, '<br>') + '</p>').join('') }; window.DOMPurify = { sanitize: h => h }; });
        // index.html reloads itself 15 s after load when the LIFF SDK is missing — keep the page
        await ip.addInitScript(() => { const st = window.setTimeout; window.setTimeout = function (f, ms) { if (ms === 15000 && /location\.reload/.test(String(f))) return 0; return st.apply(this, arguments); }; });
        await ip.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await ip.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await ip.waitForFunction(() => window.internArticles && typeof window.renderMd === 'function');
        const open = (id) => ip.evaluate(id => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            window.myUserDoc = window.myUserDoc || {}; window.myUserDoc.articleSeen = {};
            const D = 864e5, now = Date.now(), b = { status: 'scheduled', audience: { divisions: [], groups: [] }, cover: { emoji: '💉' } }, S = internArticles._S;
            if (S.cur) internArticles.close('x');
            const P = { id: 'p1', title: { th: 'Inclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม', en: 'Inclisiran twice a year' } };
            S.list = [
                Object.assign({ id: 'p1', title: P.title, body: { th: 'ลุงที่ไขมันสูงถามว่ายาฉีดปีละ 2 เข็มยุบพลัคได้ไหม\n\nเรื่องเริ่มที่ร้านยา' }, startAt: now - 9 * D, endAt: now - 2 * D }, b),
                Object.assign({ id: 'p2', title: { th: 'Inclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม (2)' }, body: { th: 'ลุงพยักหน้า แล้วถามต่อทันที "แล้วเข็มละเท่าไหร่ครับ?"' }, startAt: now - D, endAt: now + D, prev: { id: 'p1', title: P.title, recap: { th: 'ลุงถามว่ายาฉีดปีละ 2 เข็มยุบพลัคได้จริงไหม' } } }, b),
                Object.assign({ id: 'p3', title: { th: 'ภาคสาม' }, body: { th: 'เนื้อหาภาคสาม' }, startAt: now - D, endAt: now + D, prev: { id: 'p1', title: P.title, recap: { en: 'An uncle asks about the shot' } } }, b),
                Object.assign({ id: 'p4', title: { th: 'ภาคต่อของบทความที่หายไป' }, body: { th: 'เนื้อหา' }, startAt: now - D, endAt: now + D, prev: { id: 'gone', title: { th: 'บทความร่างที่ intern อ่านไม่ได้' }, recap: {} } }, b),
                Object.assign({ id: 'p5', title: { th: 'บทความเดี่ยว' }, body: { th: 'ไม่มีภาคก่อน' }, startAt: now - D, endAt: now + D }, b)];
            S.cl = 'th'; internArticles._show({ a: S.list.find(x => x.id === id), kind: 'live' });
        }, id);
        const iv = () => ip.evaluate(() => { const sh = document.getElementById('art-sheet'), p = sh && sh.querySelector('.art-prev'), S = internArticles._S, kids = sh ? [...sh.children].map(c => c.id || c.className.split(' ')[0]) : [];
            return { tag: p ? p.tagName : '', text: p ? p.textContent.replace(/\s+/g, ' ').trim() : '', order: kids.join('>'), title: sh ? sh.querySelector('#art-title').textContent : '', body: sh ? sh.querySelector('#art-text').textContent.trim().slice(0, 40) : '',
                foot: sh ? [...sh.querySelectorAll('.foot button')].map(b => b.textContent.trim()).join('|') : '', cur: S.cur && S.cur.a.id, peek: S.peek && S.peek.id, seen: Object.keys((window.myUserDoc || {}).articleSeen || {}).join(), wide: document.documentElement.scrollWidth > innerWidth + 1, clamp: !!(sh && sh.querySelector('.art-md.clamp')) }; });
        await open('p2'); await ip.waitForSelector('#art-sheet #art-text'); let v = await iv();
        ok(v.tag === 'BUTTON' && v.text === '⏪ ภาคก่อนลุงถามว่ายาฉีดปีละ 2 เข็มยุบพลัคได้จริงไหม›' && /^band>art-title>art-prev>art-text/.test(v.order) && !v.wide, 'a sequel shows ONE ⏪ line under its title: the recap in the reader\'s language, with › (it can be opened)');
        await shot(ip, 'sequel-intern');
        await ip.click('#art-sheet .art-prev'); v = await iv();
        ok(v.peek === 'p1' && v.cur === 'p2' && v.title === 'Inclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม' && /^ลุงที่ไขมันสูง/.test(v.body) && !v.clamp && v.foot === '‹ กลับ' && v.tag === '', 'a tap shows the previous part in the same sheet — whole text, one button ‹ Back, no Got it / save / mute');
        await shot(ip, 'sequel-intern-peek');
        ok(await ip.evaluate(() => { const s = (window.myUserDoc || {}).articleSeen || {}; return !s.p1; }), 'looking at the previous part marks nothing as read');
        await ip.click('#art-sheet .foot .ok'); v = await iv();
        ok(v.peek === null && v.cur === 'p2' && v.tag === 'BUTTON' && /รับทราบ/.test(v.foot), '‹ Back → the sequel again, as it was');
        await ip.click('#art-sheet .art-prev'); await ip.evaluate(() => internArticles.close('x'));
        ok(await ip.evaluate(() => internArticles._S.peek === null && !document.getElementById('art-sheet')), 'closing the sheet while looking closes everything');
        await open('p3'); v = await iv();
        ok(v.text === '⏪ ภาคก่อนInclisiran ปีละ 2 เข็ม ยุบพลัคได้จริงไหม›', 'no recap in the reader\'s language → the previous part\'s title in that language (not another language\'s recap)');
        await open('p4'); v = await iv();
        ok(v.tag === 'DIV' && v.text === '⏪ ภาคก่อนบทความร่างที่ intern อ่านไม่ได้', 'a previous part the intern may not read (not scheduled) → the line is plain text, no ›');
        await open('p5'); v = await iv();
        ok(v.tag === '' && /^band>art-title>art-text/.test(v.order), 'an article with no previous part looks as before');
        ok(ierr.length === 0, 'no page errors (intern): ' + ierr.join(' | '));
        console.log('\narticles-sequel-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
