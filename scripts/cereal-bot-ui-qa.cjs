// V101.331: 🥣 Cereal Killer Phase 1½ PR 2 — play against the bot (owner pick C, mockup-cereal-bot/) on the REAL public/index.html,
// touch phone, file://, network blocked, Firebase stubbed. Lobby: 👤 เพื่อน / 🤖 บอท chips; 🤖 shows two cards (🔪 vs 🤖 · 🕵️ vs 🤖)
// with 🥄 levels inside, and hides the names row. A solo game never shows the hand-off screen; the bot's seat shows a "🤖 …กำลังคิด"
// beat, then what the bot did (public facts only) and ▸ ตาคุณ. As the detective, the bot killer's path is never in the DOM or the
// beat until the reveal. Every bot move goes through the same state as a human move (log, cereals, witness, arrests). 390 + 320 px.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

async function open(browser, width) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); localStorage.setItem('cerealTourSeen', '1'); localStorage.setItem('cerealCoachSeen', 'all'); }
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' }); requireRegistered = () => true;
        tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
        userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        window.__writes = 0; const c = db.collection; db.collection = n => { window.__writes++; return c.call(db, n); };
    });
    return { page, errors };
}
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const game = page => page.evaluate(() => JSON.parse(JSON.stringify(CK.game())));
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const enabled = page => page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-cell:not([disabled])')].map(b => +b.dataset.id));
async function waitBeatDone(page) { await page.waitForSelector('#ck-bot-ok, #cerealModal .ck-win', { timeout: 5000 }); }

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const width of [390, 320]) {
            const { page, errors } = await open(browser, width);
            await page.evaluate(() => cerealOpen());
            // lobby: friend by default, names row; 🤖 swaps in the two cards
            assert.ok(await page.isVisible('#ck-n1'), 'friend game: names row');
            await page.click('#ck-vs-bot');
            assert.ok(!(await page.isVisible('#ck-n1')), 'vs bot: no names row');
            const cards = await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-solo')].map(c => ({ id: c.id, on: c.classList.contains('on'), lv: c.querySelectorAll('.ck-lv').length, t: c.innerText.replace(/\s+/g, ' ') })));
            assert.equal(cards.length, 2); assert.ok(cards[0].t.includes('คุณซ่อน · บอทไล่จับ') && cards[1].t.includes('คุณไล่จับ · บอทซ่อน'), 'card words');
            assert.ok(cards.every(c => c.lv === 3), 'three 🥄 levels in each card');
            const fit = await page.evaluate(() => { const sc = document.querySelector('#cerealModal .modal-content'); return sc.scrollWidth <= sc.clientWidth + 1; });
            assert.ok(fit, width + ': lobby has no horizontal scroll');
            // ---- solo 1: I am the killer, the bot (🥄🥄🥄) hunts
            await page.click('#ck-me-killer .ck-lv[data-lv="3"]');
            assert.ok((await txt(page, '#ck-start')).includes('🔪 vs 🤖 🥄🥄🥄'), 'start names the pick: ' + await txt(page, '#ck-start'));
            await page.evaluate(() => CK.botDelay(120));
            await page.click('#ck-start');
            assert.equal(await page.$('#ck-hand-go'), null, 'no hand-off screen in a solo game');
            let g = await game(page);
            assert.deepEqual(g.bot, { seat: 'detective', level: 3 });
            await page.click(cell(8)); for (const id of [3, 2, 1]) await page.click(cell(id));
            await page.click('#ck-kill .ck-chip:has-text("🏠 3")'); await page.click('#ck-wit .ck-chip:has-text("🌳 4")');
            await page.click('#ck-lock');
            assert.ok((await txt(page, '#ck-beat')).includes('กำลังคิด'), 'the thinking beat shows first');
            assert.equal(await page.$('#ck-hand-go'), null, 'still no hand-off');
            await waitBeatDone(page);
            g = await game(page);
            if (g.status === 'playing') {
                const beat = await txt(page, '#ck-beat');
                assert.ok(beat.startsWith('🤖 🕵️') && /เดิน|อยู่ที่/.test(beat), 'beat says what the bot did: ' + beat);
                assert.equal(g.phase, 'killer'); assert.equal(g.day, 2); assert.ok(g.detectivePos != null, 'bot detective stands somewhere');
                assert.ok(g.log.some(e => e.day === 1 && e.type === 'kill'), 'the log has day 1');
                assert.ok(g.pubDays.length === 1 && g.pubDays[0].kill === 3 && g.pubDays[0].witness === 4 && g.pubDays[0].det === null, 'public day log');
                await page.click('#ck-bot-ok');
                assert.ok((await enabled(page)).length > 0, 'my killer turn: legal cells are tappable');
                assert.ok(!(await enabled(page)).includes(g.detectivePos), 'the bot detective blocks its cell');
            }
            if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/bot-killer-' + width + '.png' });
            // ---- solo 2: I am the detective, the bot killer hides
            await page.evaluate(() => { CK.close(); cerealOpen(); });
            await page.click('#ck-vs-bot'); await page.click('#ck-me-detective');
            await page.click('#ck-start');
            assert.ok((await txt(page, '#ck-beat')).includes('ฆาตกรกำลังคิด'), 'the bot killer moves first');
            await waitBeatDone(page);
            g = await game(page);
            assert.equal(g.bot.seat, 'killer'); assert.equal(g.phase, 'detective');
            const secret = g.secret.path[1].join(' › ');
            const dom = await page.evaluate(() => document.getElementById('cerealModal').innerText);
            assert.ok(!dom.includes(secret), 'the bot killer path is not on screen: ' + secret);
            assert.ok(!(await page.evaluate(() => document.querySelector('#cerealModal .ck-cell .me'))), 'no 🔪 mark on the board for the hidden killer');
            assert.ok((await txt(page, '#ck-beat')).includes('🤖 🔪'), 'beat: public cereal / witness');
            await page.click('#ck-bot-ok');
            assert.deepEqual((await enabled(page)).sort((a, b) => a - b), [7, 14], 'my detective turn starts at a café');
            // walk, then arrest the bot right where it is (the harness peeks) → reveal shows the bot's notebook
            await page.click(cell(7));
            const k = g.secret.path[1][g.secret.path[1].length - 1];
            const reach = await page.evaluate(([k]) => { const R = window.CerealRules, m = R.buildMap(window.CEREAL_MAPS, CK.game().citySide, null); return R.arrestValid(m, 7, k); }, [k]);
            if (reach) {
                await page.click('#ck-arrest'); await page.click(cell(k)); await page.click('#ck-confirm .yes');
                assert.ok((await txt(page, '#cerealModal .ck-win')).includes('จับ'), 'caught the bot');
                assert.ok((await txt(page, '#cerealModal .ck-nb')).includes(secret), 'reveal shows the bot notebook');
            } else {
                await page.click('#ck-end');
                assert.ok((await txt(page, '#ck-beat')).includes('กำลังคิด'), 'my end turn hands straight to the bot');
                await waitBeatDone(page);
                const g2 = await game(page);
                if (g2.status === 'playing') {
                    const dom2 = await page.evaluate(() => document.getElementById('cerealModal').innerText);
                    assert.ok(!dom2.includes(g2.secret.path[2].join(' › ')), 'day 2 path hidden too');
                }
            }
            // a finished or running solo game is listed with the bot's level
            await page.evaluate(() => { CK.close(); cerealOpen(); });
            assert.ok((await txt(page, '#cerealModal .ck-nb')).includes('🤖'), 'my games list the bot');
            assert.equal(await page.evaluate(() => window.__writes), 0, 'nothing went to Firestore');
            assert.deepEqual(errors, [], 'no page errors');
        }
        console.log('cereal-bot-ui-qa: OK — 👤 / 🤖 chips, pick C cards with 🥄 levels, no hand-off vs 🤖, thinking beat → what the bot did → ▸ ตาคุณ, bot detective blocks its cell, bot killer path never on screen before the reveal (390 + 320)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
