// V101.171: Journal design A (mockup pick 2026-10-19) — no tabs. The REAL public/index.html + daily-canvas.js on a touch phone
// (file://, network blocked, Firebase stubbed). One page top to bottom: today's entry · 🎓 Note fold · 💬 recent entries with the
// mentor's comments (always visible, outside the panel that dims once today is done) · ✉️ Message admin fold; faint EN · TH hints.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8'), js = fs.readFileSync('public/daily-canvas.js', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(!/role="tab"|dc-tabs/.test(js), 'no tab bar in daily-canvas.js');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        await page.clock.setFixedTime(new Date('2026-10-22T10:00:00+07:00'));
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.getElementById('kanban-content').style.display = 'block';
            if (typeof switchMissionTab === 'function') switchMissionTab('reflection');
        });
        await page.waitForTimeout(500);

        // ---- 1. one page, in order, no tabs
        const layout = await page.evaluate(() => {
            const pane = document.getElementById('rl-reflection-pane');
            return { kids: [...pane.children].map(e => e.id || e.className), tabs: pane.querySelectorAll('[role="tab"]').length,
                title: pane.querySelector('.dc-title').textContent, noteOpen: document.getElementById('dc-note').open, msgOpen: document.getElementById('dc-feedback').open,
                hidden: ['dc-day', 'dc-note', 'dc-feed', 'dc-feedback'].filter(id => document.getElementById(id).hidden) };
        });
        assert.deepEqual(layout.kids, ['dc-bar lang-no-toggle', 'dc-day', 'dc-note', 'dc-feed', 'dc-feedback'], 'entry · Note · Feedback · Message admin, top to bottom: ' + layout.kids);
        assert.equal(layout.tabs, 0, 'no tabs');
        assert.equal(layout.title, '📓 Journal');
        assert.deepEqual([layout.noteOpen, layout.msgOpen, layout.hidden], [false, false, []], 'both folds start closed, no part is hidden');

        // ---- 2. the shadow hints: one per part, EN · TH, Thai NOT hidden by lang-toggle (page is EN)
        await page.evaluate(() => { document.getElementById('dc-note').open = true; document.getElementById('dc-feedback').open = true; });   // a closed fold renders nothing
        const hints = await page.$$eval('#rl-reflection-pane .dc-hint', es => es.map(e => ({ t: e.innerText.trim(), c: getComputedStyle(e).color, part: e.closest('[id^="dc-"]').id })));
        assert.deepEqual(hints.map(h => h.part), ['dc-day', 'dc-day', 'dc-note', 'dc-feedback'], 'mood · writing · Note · Message admin (Feedback has no hint line — V101.208)');
        for (const h of hints) assert.ok(/ · /.test(h.t) && /[฀-๿]/.test(h.t), 'hint shows EN · TH (Thai visible): ' + h.t);
        assert.match(hints[1].t, /what you learned, what was hard, what you’ll do next/);
        assert.equal(await page.locator('#rl-reflection-pane .dc-hint .lang-th').count(), 0, 'no Thai run wrapped by lang-toggle');
        await page.evaluate(() => { document.getElementById('dc-note').open = false; document.getElementById('dc-feedback').open = false; });

        // ---- 3. the mentor's comment + กดรับ show without a submit, and stay clickable after today's entry is done
        await page.evaluate(() => {
            const ts = d => ({ toDate: () => new Date(Date.now() - d * 86400000) });
            reflectiveLogsCache = [
                { id: 'r1', content: 'ได้ฝึกซักประวัติผู้ป่วยเบาหวาน', mood: 'happy', timestamp: ts(1), adminComment: 'ดีมาก ลองเพิ่มเรื่องการปรับยา', adminBonus: 0.2, pointsClaimed: false },
                { id: 'r0', content: 'วันนี้ฝึก inhaler', mood: 'happy', timestamp: ts(0) },   // today → the day panel dims
            ];
            renderReflectiveLogs();
        });
        const feed = await page.evaluate(() => {
            const area = document.getElementById('rl-history-area'), btn = [...area.querySelectorAll('button.rl-pill')].find(b => /รับ/.test(b.innerText));
            btn.scrollIntoView({ block: 'center' });
            const r = btn.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { inFeed: !!area.closest('#dc-feed'), inDay: !!area.closest('#dc-day'), shown: getComputedStyle(area).display, btn: btn.innerText.trim(), clickable: btn.contains(hit),
                     comment: /ดีมาก ลองเพิ่มเรื่องการปรับยา/.test(area.innerText), dayDim: document.getElementById('dc-day').style.opacity };
        });
        assert.deepEqual([feed.inFeed, feed.inDay, feed.shown], [true, false, 'block'], 'history lives in 💬 Feedback, visible without a submit');
        assert.ok(feed.comment && /^🎁 รับ$/.test(feed.btn), 'mentor comment + the inline 🎁 รับ pill (Thai visible): ' + feed.btn);
        const chip = await page.evaluate(() => ({ all: (document.getElementById('rl-claim-all') || {}).innerText, foot: document.querySelector('#rl-history-list .rl-ft').innerText.replace(/\s+/g, ' '), full: !!document.querySelector('#rl-history-list button:not(.rl-pill)'), glow: !!document.querySelector('#rl-history-list .rl-glow'), dot: (document.getElementById('rl-claim-dot') || {}).innerText }));
        assert.equal(chip.all, '🎁 +0.2 · รับ · 받기', 'one waiting → the title chip says the amount'); assert.match(chip.foot, /\+0\.2/); assert.equal(chip.full, false, 'no full-width button any more'); assert.equal(chip.glow, true);
        assert.equal(chip.dot, '🎁 +0.2', 'the Mission header cue');
        assert.equal(feed.dayDim, '0.5', 'today done → the entry panel dims (unchanged rule)');
        assert.ok(feed.clickable, 'the 🎁 รับ pill is NOT under the dimmed, click-blocked panel');
        // two waiting → "รับทั้งหมด" with the SUM; collected → a quiet ✓, the chip and the cue are gone
        await page.evaluate(() => { reflectiveLogsCache = reflectiveLogsCache.concat([{ id: 'r2', content: 'x', mood: 'happy', timestamp: { toDate: () => new Date(Date.now() - 2 * 86400000) }, adminComment: 'ok', adminBonus: 0.1, pointsClaimed: false }]); renderReflectiveLogs(); });
        assert.equal(await page.evaluate(() => document.getElementById('rl-claim-all').innerText), '🎁 +0.3 · รับทั้งหมด · 모두 받기');
        if (process.env.QA_SHOT) await page.locator('#dc-feed').screenshot({ path: process.env.QA_SHOT + '/journal-bonus.png' });
        await page.evaluate(() => { reflectiveLogsCache.forEach(l => { if (l.adminBonus) l.pointsClaimed = true; }); renderReflectiveLogs(); });
        const after = await page.evaluate(() => ({ chip: !!document.getElementById('rl-claim-all'), pills: document.querySelectorAll('#rl-history-list .rl-pill').length, ok: document.querySelectorAll('#rl-history-list .rl-ok').length, dot: getComputedStyle(document.getElementById('rl-claim-dot')).display }));
        assert.deepEqual(after, { chip: false, pills: 0, ok: 2, dot: 'none' }, 'collected: ✓ +x on each, nothing left to press');

        // ---- 4. the old "tab" callers open the matching fold
        await page.evaluate(() => toggleJournalNoteFields());
        assert.equal(await page.evaluate(() => document.getElementById('dc-note').open), true, 'the Note fold button / selectJournalTab("note") opens 🎓 Note');
        await page.evaluate(() => selectJournalTab('feedback'));
        assert.equal(await page.evaluate(() => document.getElementById('dc-feedback').open), true, 'selectJournalTab("feedback") opens ✉️ Message admin');
        for (const id of ['lp-note-title', 'dc-note-content', 'dc-note-submit', 'dc-feedback-message', 'dc-feedback-attach', 'dc-feedback-submit', 'rl-submit-btn', 'rl-content'])
            assert.equal(await page.locator('#' + id).count(), 1, 'kept: #' + id);
        assert.ok(await page.locator('#dc-note-submit').isVisible() && await page.locator('#dc-feedback-submit').isVisible(), 'Save note and Send to Admin reachable once their fold is open');

        // ---- 5. phone width: nothing sticks out
        assert.ok(await page.evaluate(() => { const p = document.getElementById('rl-reflection-pane'); return p.scrollWidth <= p.clientWidth + 1; }), 'no sideways overflow at 412 px');
        if (process.env.QA_SHOT) {
            await page.evaluate(() => { document.getElementById('dc-note').open = false; document.getElementById('dc-feedback').open = false; document.getElementById('dc-day').style.opacity = '1'; });
            await page.locator('#rl-reflection-pane').screenshot({ path: process.env.QA_SHOT + '/journal-a.png' });
        }
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();
        console.log('journal-one-page-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
