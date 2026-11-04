// V101.267: Journal tour (journal-tour.js) on the REAL public/index.html + daily-canvas.js, touch phone, file://, network blocked,
// Firebase stubbed (writes recorded, never sent). Opens once by itself when the 🎓 Note row is on screen (existing interns too), never on
// top of the intern guide; four scenes, Thai first; ring + card stay on screen at 320/390 px; ข้าม / Esc / เข้าใจแล้ว close it; the quiet
// "?" next to the date replays it; reduced motion = still cards; it writes nothing but localStorage.journalTourSeen.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n'), js = fs.readFileSync('public/journal-tour.js', 'utf8');
assert.ok(/<script src="knowthyself-nudge\.js\?v=V\d+\.\d+"><\/script>\n<script src="journal-tour\.js\?v=V\d+\.\d+" defer><\/script>/.test(idx) && idx.indexOf('daily-canvas.js?v=') < idx.indexOf('journal-tour.js?v='),
    'journal-tour.js loads after daily-canvas.js + knowthyself-nudge.js (that pair must stay adjacent)');
assert.ok(!/db\.collection|firebase\.|fetch\(/.test(js), 'the tour reads and writes nothing in Firestore');
assert.ok(/const LN_LIFETIME_CAP = 90;/.test(idx) && js.includes('<b>90 โน้ต</b>'), 'the 90-note number is the code’s');
assert.ok(!/3 วัน|My Path/.test(js), 'no 3-day review promise (that queue is admin-only)');
assert.ok(fs.readFileSync('public/knowthyself-nudge.js', 'utf8').includes("document.getElementById('journalTour')"), 'the 🧭 Know thyself sheet waits for the tour (and the tour waits for it)');

async function open(browser, { width = 390, guideOpen = false, reducedMotion = 'no-preference', storage = {} } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok', reducedMotion });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.dismiss());
    await page.addInitScript((storage) => {
        if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('internGuideSeen', '1'); for (const k in storage) localStorage.setItem(k, storage[k]); }
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
    }, storage);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate((guideOpen) => {
        if (guideOpen === 'kt') { const k = document.createElement('div'); k.id = 'kt-sheet'; k.setAttribute('role', 'dialog'); k.setAttribute('aria-modal', 'true'); k.textContent = 'Know yourself'; k.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:120px;background:#fff'; document.body.append(k); }
        else if (guideOpen) { const g = document.createElement('div'); g.id = 'internGuideOverlay'; g.className = 'open'; document.body.append(g); }
        window.__writes = [];
        db.collection = name => ({ add: d => { window.__writes.push(name); return Promise.resolve({ id: 'x' }); }, doc: () => ({ update: () => { window.__writes.push(name); return Promise.resolve(); }, set: () => { window.__writes.push(name); return Promise.resolve(); }, get: () => Promise.resolve({ exists: false, data: () => ({}) }) }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }) });
        ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' }); requireRegistered = () => true;
        tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
        userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
        reflectiveLogsCache = []; window.myReflectiveLogsCache = []; window.myLpEntriesCache = [];
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        document.getElementById('kanban-content').style.display = 'block';
        switchMissionTab('reflection');
        renderReflectiveLogs(); renderDRStatus();
        document.getElementById('dc-note').scrollIntoView({ block: 'center' });
    }, guideOpen);
    return { ctx, page, errors };
}
const state = page => page.evaluate(() => {
    const t = document.getElementById('journalTour');
    if (!t) return { open: false };
    const tip = t.querySelector('.jt-tip').getBoundingClientRect(), ring = t.querySelector('.jt-ring').getBoundingClientRect(), note = document.getElementById('dc-note').getBoundingClientRect();
    // innerText, not textContent: lang-toggle.js hides wrapped Thai (.lang-th) in EN mode while textContent still has it
    return { open: true, step: t.querySelector('.jt-step').textContent, title: t.querySelector('.jt-t').innerText, next: t.querySelector('.jt-next').innerText, wrapped: t.querySelectorAll('.lang-th,.lang-kr').length,
        body: [...t.querySelectorAll('.jt-b')].map(e => e.innerText).join(' '), skipText: t.querySelector('.jt-skip') && t.querySelector('.jt-skip').innerText,
        skip: !!t.querySelector('.jt-skip'), focus: document.activeElement && document.activeElement.className,
        tip: { l: tip.left, r: tip.right, t: tip.top, b: tip.bottom }, vw: innerWidth, vh: innerHeight,
        ringHasNote: ring.left <= note.left + 1 && ring.right >= note.right - 1 && ring.top <= note.top + 1 && ring.bottom >= note.bottom - 1,
        overlap: !(tip.bottom <= ring.top + 2 || tip.top >= ring.bottom - 2),
        anim: getComputedStyle(t.querySelector('.jt-ring')).animationName, finger: !!t.querySelector('.jt-finger') && getComputedStyle(t.querySelector('.jt-finger')).display !== 'none' };
});

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const width of [320, 390]) {
            const tag = ' @' + width;
            const { ctx, page, errors } = await open(browser, { width });
            // ---- 1. opens by itself once the Note row is on screen (no journalTourSeen yet = an existing intern sees it too)
            await page.waitForSelector('#journalTour', { timeout: 4000 });
            await page.waitForTimeout(500);
            assert.equal(await page.evaluate(() => localStorage.getItem('journalTourSeen')), '1', 'marked seen as soon as it opens' + tag);
            const want = [['1 / 4 · Journal', '📝 บันทึกวันนี้'], ['2 / 4 · Note', '🎓 จด 1 เรื่องที่อยากจำ'], ['3 / 4 · Review', '👩‍⚕️ แอดมินอ่านและให้คะแนน'], ['4 / 4 · My Notes', '📚 โน้ตเก็บไว้ใน My Notes']];
            for (let i = 0; i < 4; i++) {
                await page.waitForTimeout(450);
                const s = await state(page);
                assert.deepEqual([s.step, s.title], want[i], 'scene ' + (i + 1) + tag);
                assert.equal(s.wrapped, 0, 'no Thai hidden by the EN/TH toggle, scene ' + (i + 1) + tag);
                assert.ok(/[฀-๿]{6,}/.test(s.body), 'the Thai body text is visible, scene ' + (i + 1) + tag + ': ' + s.body);
                if (i < 3) assert.equal(s.skipText, 'ข้าม', 'ข้าม is readable' + tag);
                assert.ok(s.tip.l >= 0 && s.tip.r <= s.vw && s.tip.t >= 0 && s.tip.b <= s.vh + 1, 'card on screen, scene ' + (i + 1) + tag + ': ' + JSON.stringify(s.tip));
                if (i > 0) assert.ok(s.ringHasNote, 'scene ' + (i + 1) + ' rings the Note row' + tag);
                assert.equal(s.overlap, false, 'card does not cover the ringed row, scene ' + (i + 1) + tag);
                assert.equal(s.focus, 'jt-next', 'focus on the main button' + tag);
                assert.equal(s.next, i === 3 ? 'เข้าใจแล้ว ✓' : 'ถัดไป ›');
                assert.equal(s.skip, i < 3, 'ข้าม on every scene but the last' + tag);
                if (i === 1) assert.equal(s.finger, true, '👆 on the Note scene');
                if (i === 2) { await page.locator('#journalTour .jt-back').click(); assert.equal((await state(page)).step, want[1][0], '‹ goes back' + tag); await page.locator('#journalTour .jt-next').click(); }
                await page.locator('#journalTour .jt-next').click();
            }
            assert.equal((await state(page)).open, false, 'เข้าใจแล้ว closes it' + tag);
            // ---- 2. the quiet replay: "?" right after the date in the hero bar
            const rp = await page.evaluate(() => { const b = document.getElementById('jt-replay'), cs = getComputedStyle(b), r = b.getBoundingClientRect();
                return { prev: b.previousElementSibling && b.previousElementSibling.className, w: Math.round(r.width), text: b.textContent, label: b.getAttribute('aria-label'), bar: !!b.closest('#dc-hero .dc-bar'), bg: cs.backgroundColor }; });
            assert.deepEqual([rp.prev, rp.text, rp.bar, rp.label], ['dc-date', '?', true, 'วิธีใช้ Journal และ Note'], 'a small ? after the date: ' + JSON.stringify(rp));
            assert.ok(rp.w <= 24 && rp.bg === 'rgba(0, 0, 0, 0)', 'quiet: ≤24px, no fill ' + JSON.stringify(rp));
            await page.locator('#jt-replay').click();
            assert.equal((await state(page)).step, '1 / 4 · Journal', '? replays from scene 1' + tag);
            await page.keyboard.press('Escape');
            assert.equal((await state(page)).open, false, 'Esc closes' + tag);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'jt-replay', 'focus goes back to ?' + tag);
            await page.locator('#jt-replay').click(); await page.locator('#journalTour .jt-skip').click();
            assert.equal((await state(page)).open, false, 'ข้าม closes' + tag);
            // ---- 3. seen → a reload does not open it again
            await page.reload({ waitUntil: 'load' });
            await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); document.getElementById('kanban-content').style.display = 'block'; switchMissionTab('reflection'); document.getElementById('dc-note').scrollIntoView({ block: 'center' }); });
            await page.waitForTimeout(2000);
            assert.equal((await state(page)).open, false, 'once only' + tag);
            assert.deepEqual(await page.evaluate(() => window.__writes || []), [], 'no Firestore writes' + tag);
            assert.ok(errors.every(e => /firebase\.|is not a function|Cannot read properties of undefined/.test(e)), 'only the known Firebase-stub errors' + tag + ': ' + errors.join(' | '));
            await ctx.close();
        }
        // ---- 4. never on top of the intern guide; opens once the guide is gone
        {
            const { ctx, page } = await open(browser, { guideOpen: true });
            await page.waitForTimeout(2200);
            assert.equal((await state(page)).open, false, 'waits while the guide is open');
            await page.evaluate(() => document.getElementById('internGuideOverlay').classList.remove('open'));
            await page.mouse.click(5, 5);
            await page.waitForSelector('#journalTour', { timeout: 4000 });
            await ctx.close();
        }
        // ---- 4b. nor on top of another dialog (🧭 Know thyself sheet)
        {
            const { ctx, page } = await open(browser, { guideOpen: 'kt' });
            await page.waitForTimeout(2200);
            assert.equal((await state(page)).open, false, 'waits while the Know thyself sheet is open');
            await page.evaluate(() => document.getElementById('kt-sheet').remove());
            await page.mouse.click(5, 5);
            await page.waitForSelector('#journalTour', { timeout: 4000 });
            await ctx.close();
        }
        // ---- 5. reduced motion: still cards, no 👆
        {
            const { ctx, page } = await open(browser, { reducedMotion: 'reduce' });
            await page.waitForSelector('#journalTour', { timeout: 4000 });
            await page.locator('#journalTour .jt-next').click(); await page.waitForTimeout(200);
            const s = await state(page);
            assert.deepEqual([s.anim, s.finger], ['none', false], 'reduced motion: no animation, no finger');
            await ctx.close();
        }
        // ---- 6. an intern who already saw it
        {
            const { ctx, page } = await open(browser, { storage: { journalTourSeen: '1' } });
            await page.waitForTimeout(2000);
            assert.equal((await state(page)).open, false, 'not shown again');
            assert.equal(await page.locator('#jt-replay').count(), 1, '? is still there');
            await ctx.close();
        }
        console.log('journal-tour-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
