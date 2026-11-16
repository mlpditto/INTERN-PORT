// V101.312 🧠 PK flash cards (public/pk-deck.js): the 🧠 n button beside the DD Codex drug search counts the LISTED drugs that have card lines
// (pkCard first, else pkVisual.labels) and is hidden at 0; the sheet shows the lines covered — on the ADMET picture (C) or in five slots (A),
// a picture that fails to load falls back to slots; tap opens one, 👁 opens all; 🔁 Again / ✓ Got it move on and are kept in localStorage only;
// the end shows the two counts and deals the Again ones once more. The REAL public/index.html on a phone (file://, network blocked, Firebase stubbed).
// SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8'), js = fs.readFileSync('public/pk-deck.js', 'utf8');
const ver = (idx.match(/<title>Internship Portfolio \((V101\.\d+)\)<\/title>/) || [])[1];
assert.ok(ver, 'intern version present');
assert.ok(/<script src="pk-deck\.js\?v=V101\.\d+"><\/script>/.test(idx), 'pk-deck.js is loaded');
assert.ok(!/firestore|\.update\(|\.set\(/.test(js), 'the deck writes nothing to Firestore');
js.split('\n').forEach((l, i) => { if (/[฀-๿]/.test(l) && !/^\s*\/\//.test(l)) assert.ok(/[가-힯]/.test(l), 'Thai without Korean on pk-deck.js line ' + (i + 1)); });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
const SHOT = process.env.SHOT; const shot = async (page, n) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); } };
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), onSnapshot: () => () => {} }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
        });
        await page.route('**/*', r => { const u = r.request().url(); return u.startsWith('file:') ? r.continue() : u.startsWith('https://pic.test/ok') ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : r.abort(); });
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        });
        await page.waitForTimeout(900);
        const seed = withCards => page.evaluate(withCards => {
            localStorage.removeItem('pkDeck1');
            const five = n => ({ a: 'Oral · Tmax ~' + n + ' h', d: 'Protein binding ' + n + '0%', m: 'Liver · CYP3A4', e: 'Urine ' + n + '0%', t: 't½ ~' + n + ' h' });
            const codex = [
                { _id: 'a1', genericName: 'Aclidinium', class: 'LAMA' },
                { _id: 'a2', genericName: 'Amoxicillin', class: 'Penicillin', pkCard: five(1) },
                { _id: 'b1', genericName: 'Budesonide', class: 'ICS', pkVisual: { downloadUrl: 'https://pic.test/dead.png', labels: { a: 'Inhaled', t: 't½ 2–3 h' } } },
                { _id: 'p1', genericName: 'Procaterol', class: 'β2 agonist', pkVisual: { downloadUrl: 'https://pic.test/ok.png', labels: five(9) }, pkCard: Object.assign(five(2), { a: 'กิน · Tmax ~2 ชม. <b>' }) },
                { _id: 's1', genericName: 'Salbutamol', class: 'SABA', pkCard: { a: 'Inhaled · onset 5 min', d: '', m: 'Liver', e: 'Urine', t: '' } },
                { _id: 's2', genericName: 'Sertraline', class: 'SSRI', pkCard: { a: ' ', d: '' } }
            ].map(d => Object.assign({ brandNames: [], status: 'published' }, withCards ? d : { _id: d._id, genericName: d.genericName, class: d.class }));
            dcState.codex = codex; dcState.loaded = true; dcState.activeLetter = 'all';
            dxState.codex = []; dxState.loaded = true; dcMyDraftsState.drafts = []; dxMyDraftsState.drafts = [];
            if (document.getElementById('dd-codex-header').getClientRects().length === 0 || !document.getElementById('dc-list').getClientRects().length) toggleDDCodex();
            document.getElementById('dc-search-input').value = '';
            dcRenderList();
        }, withCards);
        const btn = () => page.evaluate(() => { const b = document.getElementById('dc-pk-deck-btn'), i = document.getElementById('dc-search-input').getBoundingClientRect(), r = b.getBoundingClientRect(); return { shown: b.getClientRects().length > 0, n: b.querySelector('b').textContent, sameRow: Math.abs((r.top + r.bottom) / 2 - (i.top + i.bottom) / 2) < 3, right: r.left >= i.right, h: Math.round(r.height), fits: r.right <= innerWidth, noScroll: document.documentElement.scrollWidth <= innerWidth }; });
        const card = () => page.evaluate(() => { const s = document.querySelector('#pkdeck .sheet'); if (!s) return null; const cells = [...s.querySelectorAll('[data-act="k"]')]; const r = s.getBoundingClientRect();
            return { n: s.querySelector('.top .n').textContent, name: (s.querySelector('.name') || {}).firstChild ? s.querySelector('.name').firstChild.textContent : null, pic: !!s.querySelector('.pic'), keys: cells.map(c => c.dataset.k).join(''), text: cells.map(c => c.querySelector('span').textContent), shut: cells.filter(c => c.classList.contains('shut')).length,
                hint: (s.querySelector('.hint') || {}).textContent, html: s.innerHTML, inView: r.bottom <= innerHeight + 1 && r.top >= 0, minTap: Math.min(...[...s.querySelectorAll('.foot button')].map(b => b.getBoundingClientRect().height)), thaiShown: [...s.querySelectorAll('.foot button')].every(b => b.getClientRects().length > 0),
                labsInside: (() => { const p = s.querySelector('.pic'); if (!p) return true; const pr = p.getBoundingClientRect(); return cells.every(c => { const q = c.getBoundingClientRect(); return q.left >= pr.left - 1 && q.right <= pr.right + 1 && q.top >= pr.top - 1 && q.bottom <= pr.bottom + 1; }); })() }; });
        const tap = sel => page.locator('#pkdeck ' + sel).first().click();

        console.log('no card lines yet');
        await seed(false);
        let b = await btn();
        ok(!b.shown, 'no drug has card lines → the 🧠 button is not drawn');
        ok(await page.evaluate(() => { PkDeck.open(); return !document.getElementById('pkdeck'); }), 'open() with no cards does nothing');

        console.log('the button');
        await seed(true);
        b = await btn();
        ok(b.shown && b.n === '4', '🧠 4 — drugs with lines (pkCard, or picture labels); blank lines and no lines do not count: ' + JSON.stringify(b));
        ok(b.sameRow && b.right && b.fits && b.noScroll && b.h >= 36, 'beside the search box on one row, inside 390 px, tappable');
        await shot(page, 'deck-entry');
        await page.fill('#dc-search-input', 'sal'); await page.waitForTimeout(50);
        ok((await btn()).n === '1', 'follows the search: "sal" → 🧠 1');
        await page.fill('#dc-search-input', 'acl'); await page.waitForTimeout(50);
        ok(!(await btn()).shown, 'a search that lists only drugs without lines hides it');
        await page.evaluate(() => dcSelectLetter('S')); await page.waitForTimeout(50);
        ok((await btn()).n === '1', 'follows the letter page: S → 🧠 1 (Sertraline has only blank lines)');
        await page.evaluate(() => dcSelectLetter('all')); await page.waitForTimeout(50);

        console.log('card A — slots');
        await page.click('#dc-pk-deck-btn');
        let c = await card();
        ok(c && c.n === '1 / 4' && c.name === 'Amoxicillin' && !c.pic && c.keys === 'admet' && c.shut === 5, 'first card: Amoxicillin, five covered slots, 1 / 4');
        ok(c.text.every(t => t === '?') && !c.html.includes('Tmax'), 'covered lines are not in the DOM');
        ok(c.inView && c.minTap >= 44 && c.thaiShown, 'sheet inside the screen, buttons ≥ 44 px');
        await tap('[data-k="m"]'); c = await card();
        ok(c.shut === 4 && c.text[2] === 'Liver · CYP3A4' && /1 \/ 5/.test(c.hint), 'tap M opens only M · hint 1 / 5');
        await shot(page, 'deck-cardA');
        await tap('[data-act="all"]'); c = await card();
        ok(c.shut === 0 && c.text[0] === 'Oral · Tmax ~1 h', '👁 opens all five');
        await tap('[data-act="got"]'); c = await card();

        console.log('picture that fails → slots; partial lines');
        ok(c.n === '2 / 4' && c.name === 'Budesonide' && c.shut === c.text.length, 'next card starts covered: ' + c.name);
        await page.waitForTimeout(300); c = await card();
        ok(!c.pic && c.keys === 'at', 'dead picture → slots; only the lines that exist (A, T)');
        await tap('[data-act="again"]'); await page.waitForTimeout(300); c = await card();

        console.log('card C — on the picture');
        ok(c.n === '3 / 4' && c.name === 'Procaterol' && c.pic && c.keys === 'admet' && c.shut === 5, 'Procaterol: labels on the ADMET picture, covered');
        ok(c.labsInside, 'the five labels sit inside the picture');
        await tap('[data-k="a"]'); c = await card();
        ok(c.text[0] === 'กิน · Tmax ~2 ชม. <b>' && !c.html.includes('<b>กิน') && !/<b>\s*<\/span>/.test(c.html), 'pkCard wins over the picture labels; text is escaped; Thai shows');
        await shot(page, 'deck-cardC');
        await tap('[data-act="again"]'); c = await card();
        ok(c.n === '4 / 4' && c.name === 'Salbutamol' && c.keys === 'ame', 'Salbutamol: three lines → three slots');
        await tap('[data-act="got"]');

        console.log('end of the deck');
        const end = await page.evaluate(() => { const s = document.querySelector('#pkdeck .sheet'); return { g: s.querySelector('.end .g b').textContent, r: s.querySelector('.end .r b').textContent, more: (s.querySelector('[data-act="rest"]') || {}).textContent, store: JSON.parse(localStorage.getItem('pkDeck1')) }; });
        ok(end.g === '2' && end.r === '2' && /2/.test(end.more), 'end: 2 got · 2 again · one button for the 2 left');
        ok(JSON.stringify(end.store) === JSON.stringify({ a2: 'g', b1: 'a', p1: 'a', s1: 'g' }), 'kept on the device: ' + JSON.stringify(end.store));
        await shot(page, 'deck-done');
        await tap('[data-act="rest"]'); await page.waitForTimeout(300); c = await card();
        ok(c.n === '1 / 2' && c.name === 'Budesonide', 'the Again ones are dealt once more');
        await tap('[data-act="got"]'); await tap('[data-act="got"]');
        ok(await page.evaluate(() => !document.querySelector('#pkdeck [data-act="rest"]') && document.querySelector('#pkdeck .end .g b').textContent === '2'), 'all got → only Close');
        await tap('.foot [data-act="x"]');
        ok(await page.evaluate(() => !document.getElementById('pkdeck')), 'Close removes the sheet');

        console.log('next time');
        await page.evaluate(() => localStorage.setItem('pkDeck1', JSON.stringify({ a2: 'g', b1: 'g', p1: 'a', s1: 'g' })));
        await page.click('#dc-pk-deck-btn'); c = await card();
        ok(c.name === 'Procaterol' && c.n === '1 / 4', 'reopened: the one not yet got comes first');
        await page.keyboard.press('Escape');
        ok(await page.evaluate(() => !document.getElementById('pkdeck')), 'Escape closes');
        await page.evaluate(() => { document.body.classList.add('lang-th-on'); }); await page.click('#dc-pk-deck-btn');
        ok(await page.evaluate(() => /จำได้/.test(document.querySelector('#pkdeck .ok').textContent) && document.querySelector('#pkdeck .ok').getClientRects().length > 0), 'Thai UI on → Thai buttons, visible');
        await page.evaluate(() => { localStorage.setItem = () => { throw new Error('blocked'); }; }); await tap('[data-act="got"]');
        ok((await card()).n === '2 / 4', 'storage blocked → the deck still moves on');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        console.log('\npk-deck-qa: ' + pass + ' checks passed (' + ver + ')');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
