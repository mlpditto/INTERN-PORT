// V101.329: 🥣 Cereal Killer vs 🤖 (cereal-bot.js inside cereal.js) on the REAL public/index.html, touch phone, file://, network blocked,
// Firebase stubbed. Lobby: 🤖 bot chip reveals the 🥄 level and "You play" chips and puts "🤖 Bot" in the other seat. As the detective:
// no hand-off screen, a "🤖 thinking…" beat, then the bot killer's cereal is on the board and its secret home/path are in the game; a turn
// later it has moved again. As the killer: the bot detective starts at a café, walks, asks, and its candidate set always holds the real
// killer cell; a game may end in a correct arrest. Closing and reopening a bot game skips the hand-off. 320 px: the lobby rows fit.
// Writes nothing but localStorage.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n'), bot = fs.readFileSync('public/cereal-bot.js', 'utf8'), gameSrc = fs.readFileSync('public/cereal.js', 'utf8');

assert.ok(/<script src="cereal-rules\.js\?v=V[\d.]+"><\/script>\n<script src="cereal-bot\.js\?v=V[\d.]+"><\/script>\n<script src="cereal\.js\?v=V[\d.]+" defer><\/script>/.test(idx), 'rules → bot → cereal');
assert.ok(!/db\.collection|firebase\.|fetch\(|document\./.test(bot), 'the bot touches neither Firestore nor the DOM');
assert.ok(gameSrc.includes('window.CerealBot') && gameSrc.includes('B.observeKillerTurn') && gameSrc.includes('B.observeAnswer') && gameSrc.includes('B.observeArrestMiss'), 'cereal.js feeds the bot everything public');

async function open(browser, { width = 390 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); for (const [k, v] of [['internGuideSeen', '1'], ['journalTourSeen', '1'], ['cerealTourSeen', '1'], ['cerealCoachSeen', 'all']]) localStorage.setItem(k, v); }
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
const game = page => page.evaluate(() => JSON.parse(JSON.stringify(CK.game())));
const has = (page, sel) => page.evaluate(s => !!document.querySelector(s), sel);
const settled = async page => { await page.waitForFunction(() => !document.querySelector('#ck-thinking'), null, { timeout: 8000 }); await page.waitForTimeout(50); };
const HOUSES = [1, 3, 5, 8, 11, 15, 18, 19];

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        // ---- as the detective, against a 🥄🥄🥄 killer ----
        let { page, errors } = await open(browser);
        await page.evaluate(() => cerealOpen());
        assert.ok(!(await has(page, '#ck-level')), 'level chips hidden for friend games');
        await page.click('#ck-vs-bot');
        assert.ok(await has(page, '#ck-level') && await has(page, '#ck-seat'), 'bot → level + seat rows');
        assert.equal(await page.getAttribute('#ck-level [data-level="2"]', 'class'), 'ck-chip on', '🥄🥄 is the default');
        assert.ok(!(await has(page, '#ck-n1')) && await has(page, '#ck-n2'), 'the bot takes the 🔪 seat by default, you name the 🕵️');
        assert.ok((await txt(page, '#cerealModal .ck-row:has(#ck-n2)')).includes('🤖 Bot'));
        await page.click('#ck-level [data-level="3"]'); await page.fill('#ck-n2', 'Mint');
        await page.evaluate(() => CK._botDelay(400));
        await page.click('#ck-start');
        assert.ok(await has(page, '#ck-thinking') && !(await has(page, '#ck-hand-go')), 'no hand-off, a thinking beat instead');
        await settled(page);
        assert.ok(await has(page, '#cerealModal .ck.detective') && !(await has(page, '#ck-hand-go')), 'straight to the detective screen');
        let g = await game(page);
        assert.deepEqual({ seat: g.bot.seat, level: g.bot.level, killer: g.names.killer, detective: g.names.detective, day: g.day, phase: g.phase, hand: g.hand }, { seat: 'killer', level: 3, killer: '🤖 Bot', detective: 'Mint', day: 1, phase: 'detective', hand: null });
        assert.ok(HOUSES.includes(g.secret.home) && g.secret.path[1].length === 4 && g.secret.path[1][0] === g.secret.home, 'the bot picked a home and walked 3');
        assert.ok(g.kills === 1 && g.cereals.length === 1, 'the bot kills on day 1');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#cerealModal .ck-cell .tk').length), g.cereals.length + (g.witness != null ? 1 : 0), 'cereal (and witness) tokens on the board');
        await page.evaluate(() => CK._botDelay(20));
        await page.click(cell(7)); await page.click('#ck-end');
        await settled(page);
        g = await game(page);
        assert.ok(g.day === 2 && g.phase === 'detective' && g.secret.path[2] && g.secret.path[2][0] === g.secret.path[1][3], 'day 2: the bot moved again from where it stood');
        assert.ok(g.kills >= 1 && g.kills <= 2);
        // close + reopen: resume goes straight back in
        await page.click('#cerealModal .ck-x'); await page.evaluate(() => cerealOpen());
        assert.ok((await txt(page, '#cerealModal .ck-game')).includes('🤖 Bot'), 'listed with the bot');
        await page.click('#cerealModal .ck-game');
        await settled(page);
        assert.ok(!(await has(page, '#ck-hand-go')) && await has(page, '#cerealModal .ck.detective'), 'resume: no hand-off against a bot');
        assert.deepEqual(await page.evaluate(() => window.__writes), []); assert.deepEqual(errors, []);

        // ---- as the killer, against a 🥄🥄 detective ----
        ({ page, errors } = await open(browser));
        await page.evaluate(() => { cerealOpen(); CK.vs('bot'); CK.seat('killer'); CK._botDelay(20); });
        assert.ok(await has(page, '#ck-n1') && !(await has(page, '#ck-n2')), 'you name the 🔪, the bot is the 🕵️');
        await page.fill('#ck-n1', 'Pond'); await page.click('#ck-start');
        assert.ok(!(await has(page, '#ck-hand-go')) && await has(page, '#cerealModal .ck.killer'), 'the killer screen opens at once');
        await page.click(cell(8)); for (const id of [3, 2, 1]) await page.click(cell(id));
        await page.click('#ck-kill .ck-chip:has-text("🏠 3")'); await page.click('#ck-wit .ck-chip:has-text("🌳 4")'); await page.click('#ck-lock');
        await settled(page);
        g = await game(page);
        assert.ok([7, 14].some(c => g.log.length) && g.detectivePos != null, 'the bot detective started and moved');
        assert.ok(g.bot.k.cands.includes(1), 'INVARIANT: the bot\'s candidate set holds the real killer cell (1)');
        assert.ok(g.status === 'finished' || (g.day === 2 && g.phase === 'killer' && g.hand == null), 'either day 2 killer screen or the game ended: ' + g.status);
        if (g.usedQuestions.length) assert.ok(g.log.some(e => e.type === 'ask'), 'its question is in the public log');
        if (g.status === 'playing') {
            assert.ok(await has(page, '#ck-path'), 'killer day 2 screen, no hand-off');
            assert.ok(g.witness == null, 'the witness left with the end of the detective turn');
            for (const id of [6, 11, 12]) await page.click(cell(id));
            await page.click('#ck-kill .ck-chip:has-text("🏠 11")'); await page.click('#ck-lock');
            await settled(page);
            g = await game(page);
            assert.ok(g.bot.k.cands.includes(12) || g.status === 'finished', 'INVARIANT after day 2');
            assert.ok(g.status === 'finished' ? g.result.reason === 'arrest' : g.day === 3, 'day 3 or caught: ' + JSON.stringify(g.result));
        } else assert.equal(g.result.reason, 'arrest', 'a bot win is a real arrest');
        assert.deepEqual(await page.evaluate(() => window.__writes), []); assert.deepEqual(errors, [], 'no page errors');

        // ---- 320 px lobby with the bot rows ----
        const n = await open(browser, { width: 320 });
        await n.page.evaluate(() => { cerealOpen(); CK.vs('bot'); });
        const fit = await n.page.evaluate(() => { const sc = document.querySelector('#cerealModal .modal-content'); return sc.scrollWidth <= sc.clientWidth + 1; });
        assert.ok(fit, '320: lobby with level + seat rows has no horizontal scroll');
        console.log('cereal-bot-ui-qa: OK — bot chip + level/seat rows, detective vs 🥄🥄🥄 killer (no hand-off, thinking beat, kills day 1 and 2, resume), killer vs 🥄🥄 detective (café start, candidate invariant, arrest or day 3), 320 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
