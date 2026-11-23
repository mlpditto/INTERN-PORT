// V101.330: 🥣 Cereal Killer Phase 1 PR 3 polish (owner picked all four, 2026-11-22) on the REAL public/index.html, touch phone, file://,
// network blocked, Firebase stubbed: ✕ / ↺ / cancel ✕ are 30 px squares (`.ck button { width:auto }` used to out-rank them → a tall thin pill),
// the Game over header fits with its ✕ on screen, kill / witness / ask rows are one-line chip rails, the five ask chips carry a Thai word,
// the screens are Thai first with a small English line on the main buttons and the hand-off, and the hand-off has no meta lines.
// 390 px and 320 px.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const css = fs.readFileSync('public/cereal.css', 'utf8');
assert.ok(/#cerealModal \.ck \.ck-x \{ width: 30px;/.test(css) && /#cerealModal \.ck \.ck-undo \{ width: 30px;/.test(css), '✕ / ↺ rules out-rank `.ck button`');

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
    });
    return { page, errors };
}
const cell = id => `#cerealModal .ck-cell[data-id="${id}"]`;
const box = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), l: r.left, r: r.right }; }, sel);
// one line = every chip's vertical centre within 4 px (a Thai-font chip can be a pixel taller on Linux, so tops alone differ)
const oneLine = (page, sel) => page.evaluate(s => { const mids = [...document.querySelectorAll(s + ' .ck-chip')].map(b => { const r = b.getBoundingClientRect(); return (r.top + r.bottom) / 2; }); return mids.length > 0 && Math.max(...mids) - Math.min(...mids) <= 4; }, sel);
const fitsTop = page => page.evaluate(() => { const m = document.querySelector('#cerealModal .modal-content').getBoundingClientRect(), x = document.querySelector('#cerealModal .ck-x').getBoundingClientRect(); return x.right <= m.right + 0.5 && x.left >= m.left; });
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const width of [390, 320]) {
            const { page, errors } = await open(browser, width);
            await page.evaluate(() => cerealOpen());
            let x = await box(page, '#cerealModal .ck-x');
            const xs = width < 360 ? 26 : 30;   // V101.333: under 360 px ✕ and 🔊 are 26 px so the killer header fits
            assert.ok(x.w === xs && x.h === xs, width + ' lobby ✕ is a ' + xs + ' px square: ' + JSON.stringify(x));
            assert.equal(await txt(page, '#ck-start'), '▸ เริ่ม', 'Start: one word, no English line (V101.344 owner: ลด text ซ้ำซ้อน)');
            assert.ok(!/ผู้เล่น|เล่นกับ|แผนที่|Start/.test(await txt(page, '#cerealModal .ck.lobby')) && (await txt(page, '#cerealModal .ck.lobby')).includes('👤 เพื่อน'), 'lobby: Thai chips, no row labels (V101.344)');
            await page.fill('#ck-n1', 'Pond'); await page.fill('#ck-n2', 'Mint');
            await page.click('#ck-start');
            const hand = await txt(page, '#cerealModal .ck-hand');
            assert.ok(/ส่งมือถือให้\s+Pond/.test(hand) && !hand.includes('Pass the phone') && (hand.match(/Pond/g) || []).length === 1, 'hand-off: the name once (V101.341): ' + hand);
            assert.ok(!/nothing of that turn|opens only after/.test(hand), 'no meta lines on the hand-off');
            await page.click('#ck-hand-go');
            await page.click(cell(8)); for (const id of [3, 2, 1]) await page.click(cell(id));
            x = await box(page, '#cerealModal .ck-undo');
            assert.ok(x.w === 30 && x.h === 30, width + ' ↺ is a 30 px square: ' + JSON.stringify(x));
            assert.ok(await oneLine(page, '#ck-kill'), width + ' kill row (3 houses + ⏭ เว้น) is one line');
            await page.click('#ck-kill .ck-chip:has-text("🏠 3")');
            assert.ok(await oneLine(page, '#ck-wit'), width + ' witness row is one line');
            await page.click('#ck-wit .ck-chip:has-text("🌳 4")');
            assert.ok((await txt(page, '#ck-lock')).includes('ล็อกวันที่ 1') && (await txt(page, '#ck-lock')).includes('Lock day 1'), 'Lock: Thai + English');
            await page.click('#ck-lock'); await page.click('#ck-hand-go');
            await page.click(cell(7)); await page.click(cell(8)); await page.click(cell(9));
            assert.ok(await oneLine(page, '#ck-ask'), width + ' ask rail is one line');
            const words = await page.evaluate(() => [...document.querySelectorAll('#ck-ask .ck-chip .qw')].map(e => e.textContent));
            assert.deepEqual(words, ['ทิศ', 'แถว', 'คอลัมน์', 'อาคาร', 'คู่/คี่'], 'each ask chip has its word');
            const askVisible = await page.evaluate(() => { const r = document.querySelector('#ck-ask').getBoundingClientRect(); return [...document.querySelectorAll('#ck-ask .ck-chip')].every(b => { const c = b.getBoundingClientRect(); return c.right <= r.right + 0.5; }); });
            if (width === 390) assert.ok(askVisible, '390: all five ask chips are on screen without scrolling the rail');
            await page.click('#ck-ask [data-q="building"]');
            assert.ok((await txt(page, '#ck-answer')).includes('อยู่ในอาคารไหม') && (await txt(page, '#ck-answer')).includes('→ ใช่'), 'answer in Thai');
            await page.click('#ck-arrest'); await page.click(cell(4));
            x = await box(page, '#ck-confirm .no');
            assert.ok(x.w === 30 && x.h === 30, width + ' cancel ✕ is a 30 px square');
            await page.click('#ck-confirm .no');
            assert.ok((await txt(page, '#ck-end')).includes('จบเทิร์น'), 'End turn in Thai');
            await page.click('#ck-end'); await page.click('#ck-hand-go');
            for (const id of [6, 11, 12]) await page.click(cell(id));
            await page.click('#ck-kill .ck-chip:has-text("🏠 11")'); await page.click('#ck-lock'); await page.click('#ck-hand-go');
            await page.click(cell(14)); await page.click(cell(13));
            await page.click('#ck-arrest'); await page.click(cell(12)); await page.click('#ck-confirm .yes');
            // reveal: header fits, ✕ on screen, day said once (in the sub line)
            assert.ok(await fitsTop(page), width + ' Game over ✕ is inside the card');
            x = await box(page, '#cerealModal .ck-x'); assert.ok(x.w === xs && x.h === xs, width + ' reveal ✕ square');
            const top = await txt(page, '#cerealModal .ck-top');
            assert.ok(top.includes('จบเกม') && !/Day \d/.test(top), 'reveal header: จบเกม, no Day pill: ' + top);
            const win = await txt(page, '#cerealModal .ck-win');
            assert.ok(win.includes('Mint จับ Pond ได้ที่ 12') && win.includes('Mint caught Pond at 12') && win.includes('วันที่ 2'), 'reveal title Thai + English: ' + win);
            const fit = await page.evaluate(() => { const sc = document.querySelector('#cerealModal .modal-content'); return sc.scrollWidth <= sc.clientWidth + 1; });
            assert.ok(fit, width + ': no horizontal scroll on the reveal');
            if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/reveal-' + width + '.png' });
            assert.deepEqual(errors, [], 'no page errors');
        }
        console.log('cereal-polish-qa: OK — ✕ / ↺ / cancel are 30 px squares, Game over header fits, kill / witness / ask are one-line rails, ask chips labelled, Thai first with small English, lean hand-off (390 + 320)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
