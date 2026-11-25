// V101.327: 🥣 Cereal Killer Phase 1 (cereal.js + cereal.css on the REAL public/index.html, touch phone, file://, network blocked, Firebase
// stubbed). The 🥣 button beside 💰 FIN opens the lobby; a full scripted pass-and-play game is played through real taps — killer picks a
// home and the rulebook path 8›3›2›1, kills at 3 with the witness at 4, locks; the hand-off screen carries nothing of that turn; the
// detective starts at a café, walks next to the witness, asks one card and gets the engine's truthful answer, misses an arrest (🛡️ 4→3,
// turn ends); the game survives a reload; day 2 ends in a correct arrest and the reveal shows the notebook. 320 px: no horizontal
// scroll, cells ≥ 44 px. Writes nothing but localStorage cereal_v1_<userId>.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n'), js = fs.readFileSync('public/cereal.js', 'utf8');

// ---- static ----
const ver = (/<title>Internship Portfolio \((V\d+\.\d+)\)<\/title>/.exec(idx) || [])[1];
assert.ok(ver, 'title version');
assert.ok(idx.includes('<link rel="stylesheet" href="cereal.css?v='), 'cereal.css is linked');
assert.ok(/<script src="cereal-maps\.js\?v=V[\d.]+"><\/script>\n<script src="cereal-rules\.js\?v=V[\d.]+"><\/script>\n<script src="cereal-bot\.js\?v=V[\d.]+"><\/script>\n<script src="cereal-sound\.js\?v=V[\d.]+"><\/script>\n<script src="cereal\.js\?v=V[\d.]+" defer><\/script>/.test(idx), 'maps → rules → bot → sound → cereal (defer), adjacent');
assert.ok(/id="sch-cereal-btn" class="u-game" onclick="cerealOpen\(\)"[^>]*data-th-title=/.test(idx), 'the 🥣 button (V101.368: in the games row under History) with a Thai title');
assert.ok(idx.indexOf('id="u-games-row"') < idx.indexOf('id="sch-cereal-btn"') && idx.indexOf('id="sch-cereal-btn"') < idx.indexOf('id="intern-footer-line"'), '🥣 is in the games row above the version');
assert.ok(!/db\.collection|firebase\.|fetch\(|httpsCallable/.test(js), 'cereal.js reads and writes nothing in Firestore');
assert.ok(js.includes("'cereal_v1_'"), 'state key');
assert.ok(!/✓|✅/.test(js), 'no check marks (house rule)');

async function open(browser, { width = 390 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); localStorage.setItem('cerealTourSeen', '1'); localStorage.setItem('cerealCoachSeen', 'all'); }   // the tutorial has its own QA
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        window.__writes = [];
        db.collection = name => ({ add: () => { window.__writes.push(name); return Promise.resolve({ id: 'x' }); }, doc: () => ({ update: () => { window.__writes.push(name); return Promise.resolve(); }, set: () => { window.__writes.push(name); return Promise.resolve(); }, get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }) });
        ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' }); requireRegistered = () => true;
        tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
        userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    return { ctx, page, errors };
}
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const enabledCells = page => page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-cell:not([disabled])')].map(b => +b.dataset.id));
const cls = (page, id) => page.evaluate(id => document.querySelector(`#cerealModal .ck-cell[data-id="${id}"]`).className, id);
const game = page => page.evaluate(() => JSON.parse(JSON.stringify(CK.game())));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('cereal_v1_u1') || 'null'));

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { page, errors } = await open(browser);
        // the entry: the 🥣 button beside 💰 on Schedule, same round shape
        const btn = await page.evaluate(() => { const b = document.getElementById('sch-cereal-btn'); return { text: b.textContent.trim(), onclick: b.getAttribute('onclick'), row: b.parentElement.id }; });
        assert.deepEqual(btn, { text: '🥣Cereal', onclick: 'cerealOpen()', row: 'u-games-row' }, 'V101.368: a short card with its name in the games row');

        // lobby
        await page.evaluate(() => cerealOpen());
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('cerealModal')).display), 'flex', 'modal shown');
        assert.ok((await txt(page, '#cerealModal .ck-top h3')).includes('Cereal Killer'));
        assert.equal(await page.evaluate(() => document.querySelectorAll('#cerealModal .ck-game').length), 0, 'no games yet');
        await page.fill('#ck-n1', 'Pond'); await page.fill('#ck-n2', 'Mint');
        await page.click('#ck-side-B');
        assert.ok((await page.getAttribute('#ck-side-B', 'class')).includes('on') && !(await page.getAttribute('#ck-side-A', 'class')).includes('on'), 'side chip toggles');
        await page.click('#ck-side-A');   // side chips keep the typed names
        assert.equal(await page.inputValue('#ck-n1'), 'Pond', 'names survive a re-render');
        await page.click('#ck-start');

        // hand-off to the killer, then the killer's day 1
        assert.ok((await txt(page, '#cerealModal .ck-hand h4')).includes('Pond') && (await txt(page, '#ck-hand-go')).includes('🔪'), 'phone goes to the killer first');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#cerealModal .ck-cell').length), 0, 'no board on the hand-off screen');
        await page.click('#ck-hand-go');
        assert.deepEqual(await enabledCells(page), [1, 3, 5, 8, 11, 15, 18, 19], 'day 1: only houses can be the home');
        await page.click(cell(8));
        assert.equal(await txt(page, '#ck-path'), '8 › _ › _ › _');
        assert.ok((await cls(page, 8)).includes('ring'), 'home ring');
        assert.deepEqual((await enabledCells(page)).sort((a, b) => a - b), [3, 7, 9, 13], 'legal first steps from 8');
        for (const id of [3, 2, 1]) await page.click(cell(id));
        assert.equal(await txt(page, '#ck-path'), '8 › 3 › 2 › 1', 'the rulebook path');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#cerealModal .ck-cell:not([disabled])').length), 0, 'no 4th step');
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#ck-kill .ck-chip')].map(b => b.textContent.trim())), ['🏠 8', '🏠 3', '🏠 1', '⏭ เว้น'], 'kill chips = the houses on the path + skip');
        assert.ok(await page.isDisabled('#ck-lock'), 'lock waits for the kill choice');
        await page.click('#ck-kill .ck-chip:has-text("🏠 3")');
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#ck-wit .ck-chip')].map(b => b.textContent.trim())), ['🌳 2', '🌳 4'], 'witness parks next to 3');
        assert.ok(await page.isDisabled('#ck-lock'), 'lock waits for the witness');
        await page.click('#ck-wit .ck-chip:has-text("🌳 4")');
        assert.ok(!(await page.isDisabled('#ck-lock')));
        await page.click('#ck-lock');

        // hand-off to the detective: nothing of the killer's turn on screen
        const hand = await txt(page, '#cerealModal');
        assert.ok(/ส่งมือถือให้\s+Mint/.test(hand) && hand.includes('👁️ ที่ 4') && hand.includes('🥣 1/6'), 'public state on the hand-off: ' + hand);
        assert.ok(!hand.includes('8 › 3') && !hand.includes('home'), 'the path and home are not on the hand-off screen');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#cerealModal .ck-cell, #cerealModal .ck-nb').length), 0, 'no board, no notebook');
        let g = await game(page);
        assert.deepEqual({ home: g.secret.home, path: g.secret.path[1], cereals: g.cereals, witness: g.witness, kills: g.kills, hand: g.hand }, { home: 8, path: [8, 3, 2, 1], cereals: [3], witness: 4, kills: 1, hand: 'detective' });
        assert.equal((await stored(page)).games[0].id, g.id, 'saved to localStorage');

        // detective day 1: café start, walk, ask, miss an arrest
        await page.click('#ck-hand-go');
        assert.deepEqual(await enabledCells(page), [7, 14], 'start at a café');
        await page.click(cell(7));
        assert.equal(await txt(page, '#cerealModal .ck-pill.acc'), '👣 3');
        assert.deepEqual((await enabledCells(page)).sort((a, b) => a - b), [2, 6, 8, 12], 'steps from 7');
        assert.ok(await page.isDisabled('#ck-ask [data-q="building"]'), 'not next to the witness yet');
        await page.click(cell(8)); await page.click(cell(9));
        assert.equal(await txt(page, '#cerealModal .ck-pill.acc'), '👣 1', 'two steps used, no bonus for starting on the café');
        assert.ok(!(await page.isDisabled('#ck-ask [data-q="building"]')), 'next to 👁️ 4 → may ask');
        await page.click('#ck-ask [data-q="building"]');
        assert.ok((await txt(page, '#ck-answer')).includes('→ ใช่'), 'killer stands on house 1 → in a building');
        assert.ok(await page.isDisabled('#ck-ask [data-q="dir"]'), 'one card per witness');
        assert.ok((await txt(page, '#cerealModal .ck-nb')).includes('❓ 🏠 → ใช่'), 'answer in the public log');
        await page.click('#ck-arrest');
        assert.deepEqual((await enabledCells(page)).sort((a, b) => a - b), [4, 8, 9, 10, 14], 'arrest = own cell or a neighbour');
        assert.ok(await page.isDisabled('#ck-end'), 'cannot end the turn mid-arrest');
        await page.click(cell(4));
        assert.ok((await txt(page, '#ck-confirm')).includes('จับที่ 4') && (await txt(page, '#ck-confirm')).includes('4 → 3'), 'quoted confirm with the cost');
        await page.click('#ck-confirm .yes');
        g = await game(page);
        assert.deepEqual({ arrests: g.arrestsLeft, day: g.day, phase: g.phase, hand: g.hand, pos: g.detectivePos, witness: g.witness, used: g.usedQuestions }, { arrests: 3, day: 2, phase: 'killer', hand: 'killer', pos: 9, witness: null, used: ['building'] }, 'a wrong arrest ends the turn');
        assert.ok(g.log.some(e => e.text.includes('🛡️ 4 ✗')));
        assert.deepEqual(await page.evaluate(() => window.__writes), [], 'nothing went to Firestore');

        // survives a reload: the lobby lists the game and resumes through the hand-off
        await page.reload({ waitUntil: 'load' });
        await page.evaluate(() => { userId = 'u1'; document.getElementById('main-app').style.setProperty('display', 'block', 'important'); cerealOpen(); });
        assert.equal(await txt(page, '#cerealModal .ck-game'), 'D2 🔪 Pond vs 🕵️ Mint 🥣 1/6 · 🛡️ 3 ▸');   // V101.344: one pill, "vs"
        await page.click('#cerealModal .ck-game');
        assert.ok((await txt(page, '#cerealModal .ck-hand h4')).includes('Pond') && (await txt(page, '#ck-hand-go')).includes('🔪'));
        await page.click('#ck-hand-go');
        assert.ok((await txt(page, '#cerealModal .ck-nb')).includes('8 › 3 › 2 › 1'), 'the killer sees his notebook again');
        assert.ok((await cls(page, 9)).includes('r') && (await txt(page, cell(9))).includes('🕵️'), 'the detective token is public');
        assert.deepEqual((await enabledCells(page)).sort((a, b) => a - b), [2, 6], 'steps from 1');
        for (const id of [6, 11, 12]) await page.click(cell(id));
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#ck-kill .ck-chip')].map(b => b.textContent.trim() + (b.disabled ? '×' : ''))), ['🏠 1', '🏠 11', '⏭ เว้น'], 'the start house 1 (no cereal yet) and 11 are both legal on 1›6›11›12');
        await page.click('#ck-kill .ck-chip:has-text("🏠 11")');
        assert.ok((await txt(page, '#ck-wit')).includes('ไม่มีสวนติดบ้าน 11'), 'no witness when no park touches the house');
        await page.click('#ck-lock');
        await page.click('#ck-hand-go');
        assert.ok((await txt(page, '#ck-ask')).length && await page.isDisabled('#ck-ask [data-q="dir"]'), 'no witness → nothing to ask');
        await page.click(cell(14)); await page.click(cell(13));
        await page.click('#ck-arrest'); await page.click(cell(12)); await page.click('#ck-confirm .yes');

        // reveal
        assert.ok((await txt(page, '#cerealModal .ck-win .t')).includes('Mint caught Pond at 12'), 'correct arrest ends the game');
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-days button')].map(b => (b.disabled ? '-' : '') + b.textContent)), ['ทั้งหมด', 'D1', 'D2', '-D3', '-D4', '-D5', '-D6', '-D7', '▶'], 'V101.333: the rail opens on ทั้งหมด (every day\'s route) · V101.363: ▶ walks a day');
        assert.ok((await cls(page, 12)).includes('caught') && (await cls(page, 8)).includes('home'), 'caught cell + home ring');
        assert.ok((await txt(page, cell(13))).includes('🕵️'), 'the detective is drawn where the arrest was made from (13), not where the turn began');
        const nb = await txt(page, '#cerealModal .ck-nb');
        assert.ok(nb.includes('8 › 3 › 2 › 1') && nb.includes('1 › 6 › 11 › 12') && nb.includes('🏠 ใช่'), 'the notebook is revealed with the answers: ' + nb);
        await page.click('#cerealModal .ck-days button:has-text("D1")');
        assert.ok((await cls(page, 1)).includes('on') && (await txt(page, cell(1))).includes('🔪'), 'day rail replays day 1');
        g = await game(page);
        assert.deepEqual({ status: g.status, winner: g.result.winner, reason: g.result.reason, cell: g.result.cell }, { status: 'finished', winner: 'good', reason: 'arrest', cell: 12 });
        await page.click('#cerealModal .ck-primary');   // 🆕 swap roles
        assert.equal(await page.inputValue('#ck-n1'), 'Mint', 'roles swapped for the rematch');
        assert.match(await txt(page, '#cerealModal .ck-game .ck-res'), /^🕵️ ชนะ · D\d$/, 'finished game listed with who won (V101.364: no 🏁)');
        assert.deepEqual(errors, [], 'no page errors');

        // 320 px: everything fits, cells stay tappable
        const n = await open(browser, { width: 320 });
        await n.page.evaluate(() => cerealOpen());
        await n.page.click('#ck-start'); await n.page.click('#ck-hand-go'); await n.page.click(cell(8));
        const fit = await n.page.evaluate(() => { const sc = document.querySelector('#cerealModal .modal-content'), c = document.querySelector('#cerealModal .ck-cell').getBoundingClientRect(); return { fits: sc.scrollWidth <= sc.clientWidth + 1, cell: c.width, top: document.querySelector('#cerealModal .ck-top').scrollWidth <= sc.clientWidth }; });
        assert.ok(fit.fits && fit.top, '320: no horizontal scroll');
        assert.ok(fit.cell >= 44, '320: cell ' + fit.cell + 'px');
        assert.deepEqual(n.errors, [], 'no page errors at 320');
        console.log('cereal-board-qa: OK — 🥣 button, lobby, killer day 1 (home · 8›3›2›1 · kill 3 · witness 4 · lock), hand-off hides the turn, detective café/walk/ask/miss, reload + resume, day 2 kill without park, correct arrest → reveal, 320 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
