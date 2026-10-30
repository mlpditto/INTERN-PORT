// V101.211: Journal design C (mockup pick 2026-10-26) — no folds, one Send. The REAL public/index.html + daily-canvas.js on a touch
// phone (file://, network blocked, Firebase stubbed; writes are recorded, never sent). A warm hero (title · 🔥 · date · mood), then
// Learned · Hard · Next · 🎓 Note · ✉️ Message admin as borderless rows; Send appears once something is filled and sends only that;
// today's entry then shows in the hero as a quote with green mood discs; 💬 timeline with the mentor's reply + 🎁 to collect.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8'), js = fs.readFileSync('public/daily-canvas.js', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(!/role="tab"|dc-tabs|createElement\('details'\)/.test(js), 'no tabs, no folds in daily-canvas.js');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        await page.clock.setFixedTime(new Date('2026-10-26T10:00:00+07:00'));
        const errors = [], dialogs = []; page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
        await page.addInitScript(() => {
            window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(INDEX, { waitUntil: 'load' });
        await page.evaluate(() => {
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.getElementById('kanban-content').style.display = 'block';
            if (typeof switchMissionTab === 'function') switchMissionTab('reflection');
            // a recording Firestore: adds are kept in window.__writes; a reflective log also lands in the caches, as the listener would
            window.__writes = []; window.__fail = {};
            const now = () => ({ toDate: () => new Date() });
            db.collection = name => ({
                add: data => {
                    if (window.__fail[name]) return Promise.reject(new Error('offline'));
                    window.__writes.push([name, data]);
                    if (name === 'reflective_logs') { const log = { id: 'today', ...data, timestamp: now() }; reflectiveLogsCache = reflectiveLogsCache.concat([log]); window.myReflectiveLogsCache = (window.myReflectiveLogsCache || []).concat([log]); renderReflectiveLogs(); }
                    return Promise.resolve({ id: name + window.__writes.length });
                },
                doc: id => ({ id: id || name + '-' + (window.__writes.length + 1), __col: name, update: () => Promise.resolve(), get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve() }),
                where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }),
            });
            // V101.247: the Message goes out as one batch (admin's doc + the intern's own copy) — recorded like the adds, with the doc id; a failing collection fails the whole batch
            db.batch = () => { const ops = []; return { set: (ref, data) => { ops.push([ref.__col, data, ref.id]); }, commit: () => { const bad = ops.find(o => window.__fail[o[0]]); if (bad) return Promise.reject(Object.assign(new Error(window.__fail[bad[0]] === 'denied' ? 'Missing or insufficient permissions.' : 'offline'), window.__fail[bad[0]] === 'denied' ? { code: 'permission-denied' } : {})); ops.forEach(o => window.__writes.push(o)); return Promise.resolve(); } }; };
            ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' });
            requireRegistered = () => true;
            tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
            userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
            reflectiveLogsCache = []; window.myReflectiveLogsCache = []; window.myLpEntriesCache = [];
            renderReflectiveLogs(); renderDRStatus();
        });
        await page.waitForTimeout(300);
        const state = () => page.evaluate(() => {
            const vis = el => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
            const send = document.getElementById('dc-send');
            return { bar: vis(send), send: send.textContent, disabled: send.disabled, what: document.querySelector('.dc-what').textContent,
                need: document.getElementById('mood-picker').classList.contains('dc-need'), day: vis(document.getElementById('dc-day')),
                done: document.getElementById('dc-hero').classList.contains('dc-done'), ask: vis(document.querySelector('.dc-ask')) };
        });

        // ---- 1. one page, no folds, in order
        const layout = await page.evaluate(() => {
            const pane = document.getElementById('rl-reflection-pane');
            return { kids: [...pane.children].map(e => e.id || e.className), folds: pane.querySelectorAll('details:not(#rl-note-fields details)').length, tabs: pane.querySelectorAll('[role="tab"]').length,
                title: pane.querySelector('.dc-title') ? 'has .dc-title' : pane.querySelector('.dc-bar .dc-ask').textContent, labels: [...pane.querySelectorAll('.dc-lb')].map(l => l.textContent),
                pickerInHero: !!document.getElementById('mood-picker').closest('#dc-hero'), date: pane.querySelector('.dc-date').textContent };
        });
        assert.deepEqual(layout.kids, ['dc-hero', 'dc-day', 'dc-note', 'dc-feedback', 'dc-sendbar lang-no-toggle', 'dc-feed'], 'hero · Today · Note · Message · Send · 💬: ' + layout.kids);
        assert.deepEqual([layout.folds, layout.tabs, layout.title], [0, 0, 'How do you feel today?'], 'no folds, no tabs; no second "Journal" title — the mood question is the bar title (V101.215)');
        assert.deepEqual(layout.labels, ['Learned', 'Hard', 'Next']);
        const lean = await page.evaluate(() => {
            const vis = el => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
            return { ph: ['dc-t-learned', 'dc-t-hard', 'dc-t-next', 'dc-feedback-message'].map(id => document.getElementById(id).placeholder), labelVisible: [...document.querySelectorAll('.dc-lb')].some(l => l.getBoundingClientRect().width > 2),
                feed: vis(document.getElementById('dc-feed')), counter: vis(document.getElementById('ln-counter')) };
        });
        assert.deepEqual(lean.ph, ['Learned · ได้เรียนรู้อะไร', 'Hard · ติดอะไร', 'Next · จะทำอะไรต่อ', 'Help or an idea?'], 'one text per row: the label rides in the placeholder (V101.215)');
        assert.equal(lean.labelVisible, false, 'no label column (the <label> stays for screen readers)');
        assert.equal(lean.feed, false, 'an empty 💬 section is not drawn'); assert.equal(lean.counter, false, '0/90 hidden while the Note row is idle');
        await page.focus('#dc-note-content');
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('ln-counter')).display !== 'none'), true, '0/90 shows while the Note row is in use');
        await page.evaluate(() => document.activeElement.blur());
        assert.ok(layout.pickerInHero, 'the mood circles sit in the hero');
        assert.equal(layout.date, 'Mon 26 Oct');
        let s = await state();
        assert.deepEqual([s.bar, s.ask, s.day, s.done], [false, true, true, false], 'empty: no Send at all, "How do you feel today?" shows');

        // ---- 2. Today without a mood → "Pick a mood"; a mood → "Send 1"; + a Note → "Send 2 📝🎓"
        await page.fill('#dc-t-learned', 'คำนวณขนาดยาเด็กตามน้ำหนัก');
        await page.fill('#dc-t-hard', 'การปัดเศษ mL');
        s = await state();
        assert.deepEqual([s.bar, s.send, s.disabled, s.need], [true, 'Pick a mood', true, true], 'Today filled, no mood → Send waits for one');
        await page.click('#mood-picker .mood-btn[title="Tired"]');
        await page.click('#mood-picker .mood-btn[title="Happy"]');
        await page.waitForTimeout(50);
        s = await state();
        assert.deepEqual([s.send, s.disabled, s.need, s.what, s.ask], ['Send 1 ↗', false, false, '📝', false], 'mood picked → Send 1, the question goes away');
        await page.fill('#dc-note-content', 'Paracetamol syrup 10–15 mg/kg q4–6h');
        s = await state();
        assert.deepEqual([s.send, s.what], ['Send 2 ↗', '📝🎓'], 'Today + Note → Send 2, both named');
        assert.ok(await page.locator('#lp-note-title').isVisible(), 'the Note title · tags open under the Note row while it is in use');
        if (process.env.QA_SHOT) await page.locator('#rl-reflection-pane').screenshot({ path: process.env.QA_SHOT + '/journal-c2.png' });

        // ---- 3. Send: Today first (+0.1), then the Note (no second +0.1); the hero turns into today's quote with green discs
        await page.click('#dc-send');
        await page.waitForFunction(() => !document.getElementById('dc-send').disabled || document.querySelector('.dc-sendbar').hidden);
        await page.waitForTimeout(100);
        const sent = await page.evaluate(() => window.__writes.map(([c, d]) => [c, d.content || d.description || d.message || '', d.mood || '', d.moodSecondary || '', d.pointsAmount]));
        const log = sent.find(w => w[0] === 'reflective_logs');
        assert.deepEqual(log.slice(1, 4), ['Learned: คำนวณขนาดยาเด็กตามน้ำหนัก\nHard: การปัดเศษ mL', '😓', '😊'], 'Today saved as one entry, labelled lines, both moods');
        assert.ok(sent.some(w => w[0] === 'learning_path_entries'), 'the Note saved');
        const noteSub = sent.find(w => w[0] === 'submissions' && w[1].startsWith('Paracetamol'));
        assert.equal(noteSub[4], 0, 'the Note sent with today’s entry does not earn a second +0.1');
        assert.ok(!sent.some(w => w[0] === 'admin_notifications'), 'an empty Message is not sent');
        const hero = await page.evaluate(() => ({ discs: [...document.querySelectorAll('.dc-mdd i')].map(i => i.textContent), quote: document.querySelector('.dc-quote').innerText,
            bold: [...document.querySelectorAll('.dc-quote b')].map(b => b.textContent), ring: getComputedStyle(document.querySelector('.dc-mdd i')).boxShadow,
            rows: ['dc-t-learned', 'dc-t-hard', 'dc-note-content'].map(id => document.getElementById(id).value) }));
        s = await state();
        assert.deepEqual([s.done, s.day, s.bar], [true, false, false], 'today done: Today rows + mood circles give way to the quote, nothing left to send');
        assert.deepEqual(hero.discs, ['😓', '😊']);
        assert.match(hero.ring, /rgb\(74, 222, 128\)/, 'the discs carry the green (no separate ✓)');
        assert.deepEqual(hero.bold, ['Learned', 'Hard']); assert.match(hero.quote, /คำนวณขนาดยาเด็ก/);
        assert.deepEqual(hero.rows, ['', '', ''], 'sent parts are cleared');
        if (process.env.QA_SHOT) await page.locator('#rl-reflection-pane').screenshot({ path: process.env.QA_SHOT + '/journal-c3.png' });

        // ---- 4. Message admin with 📎 today's entry; then a failed send keeps the text and turns the row red
        await page.fill('#dc-feedback-message', 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ');
        await page.click('.dc-clip');
        s = await state();
        assert.deepEqual([s.send, s.what], ['Send 1 ↗', '✉️']);
        // V101.239: the one Send sits inline in the Message row, right of the 📎 (not on a row of its own below)
        const inl = await page.evaluate(() => { const c = document.querySelector('.dc-clip').getBoundingClientRect(), b = document.getElementById('dc-send').getBoundingClientRect(), row = document.querySelector('#dc-feedback .dc-row').getBoundingClientRect(); return { inRow: !!document.getElementById('dc-send').closest('#dc-feedback .dc-row'), right: b.left >= c.right - 1, sameLine: Math.abs((b.top + b.height / 2) - (c.top + c.height / 2)) < 20, fits: b.right <= row.right + 1 && document.documentElement.scrollWidth <= innerWidth + 1 }; });
        assert.deepEqual(inl, { inRow: true, right: true, sameLine: true, fits: true }, 'Send is inline beside the 📎: ' + JSON.stringify(inl));
        // V101.234: the 📎 toggle reads as ON (solid violet), not a barely different lavender
        assert.equal(await page.$eval('.dc-clip', e => [e.classList.contains('on'), getComputedStyle(e).backgroundColor]).then(x => x.join('|')), 'true|rgb(109, 40, 217)', '📎 on = solid violet');
        await page.click('#dc-send');
        await page.waitForFunction(() => document.querySelector('.dc-sendbar').hidden);
        await page.waitForTimeout(500);   // the rows transition their background
        // V101.241: after a send — the ✉️ counter reads 1, a one-word toast in the app language, no pale status line (the full phrase is screen-reader only); the row tints briefly
        const fx = await page.evaluate(() => ({ cnt: document.querySelector('#dc-feedback .dc-cnt').textContent, cntHidden: document.querySelector('#dc-feedback .dc-cnt').hidden, toast: (document.querySelector('.dc-toast') || {}).textContent, status: document.getElementById('dc-feedback-status').textContent, sr: document.getElementById('dc-sent-sr').textContent, tinted: document.getElementById('dc-feedback').classList.contains('dc-sent') }));
        assert.deepEqual([fx.cnt, fx.cntHidden, fx.toast, fx.status, fx.sr, fx.tinted], ['1', false, '✓ Sent', '', 'Sent to Admin', true], 'sent feedback: ' + JSON.stringify(fx));
        assert.deepEqual(await page.evaluate(() => { const b = document.body, r = []; for (const [kr, th] of [[1, 0], [0, 1], [1, 1], [0, 0]]) { b.classList.toggle('lang-kr-on', !!kr); b.classList.toggle('lang-th-on', !!th); r.push(dcSentWord()); } return r; }), ['전송됨', 'ส่งแล้ว', '전송됨 · ส่งแล้ว', 'Sent'], 'the toast word follows the app language (KR · TH · both · EN)');
        const msg = await page.evaluate(() => window.__writes.filter(w => w[0] === 'admin_notifications').map(w => w[1]));
        assert.equal(msg.length, 1); assert.equal(msg[0].type, 'journal_feedback'); assert.match(msg[0].attachment.content, /^Learned: /, '📎 attaches today’s entry');
        // V101.247: the intern's own copy — same doc id, one batch, no name and no attachment text in it, status 'sent' (never pending)
        const pair = await page.evaluate(() => { const a = window.__writes.find(w => w[0] === 'admin_notifications'), c = window.__writes.filter(w => w[0] === 'intern_messages'); return { n: c.length, same: !!a && c[0] && a[2] === c[0][2], copy: c[0] && c[0][1] }; });
        assert.deepEqual([pair.n, pair.same], [1, true], 'one copy, same id as the admin’s doc');
        assert.deepEqual(pair.copy, { authUid: 'auth-u1', userId: 'u1', message: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ', attached: true, status: 'sent', createdAt: 0 }, 'the copy carries only the rule’s six fields');
        await page.evaluate(() => { window.__fail.admin_notifications = true; });
        await page.fill('#dc-feedback-message', 'ลองอีกครั้ง');
        assert.equal(await page.evaluate(() => document.getElementById('dc-feedback').classList.contains('dc-sent')), false, 'typing again clears the sent state');
        await page.click('#dc-send');
        await page.waitForFunction(() => !document.getElementById('dc-send').disabled);
        const failed = await page.evaluate(() => ({ err: document.getElementById('dc-feedback').classList.contains('dc-err'), kept: document.getElementById('dc-feedback-message').value, status: document.getElementById('dc-feedback-status').textContent }));
        assert.deepEqual([failed.err, failed.kept], [true, 'ลองอีกครั้ง'], 'not sent → red row, draft kept');
        assert.ok(!(await page.evaluate(() => window.__writes.some(w => w[0] === 'intern_messages' && w[1].message === 'ลองอีกครั้ง'))), 'V101.247: a failed send writes no copy either — one batch');
        assert.match(failed.status, /retained/);
        assert.equal(await page.evaluate(() => document.querySelector('#dc-feedback .dc-cnt').textContent), '1', 'a failed send is not counted');
        // V101.247: the copy refused by the rules (not deployed yet) → the admin's doc still goes out the old way; the intern sees a normal send
        await page.evaluate(() => { window.__fail = { intern_messages: 'denied' }; });
        await page.fill('#dc-feedback-message', 'ส่งแบบไม่มีสำเนา');
        await page.click('#dc-send');
        await page.waitForFunction(() => document.querySelector('.dc-sendbar').hidden || !document.getElementById('dc-send').disabled);
        await page.waitForTimeout(200);
        const fb = await page.evaluate(() => ({ adm: window.__writes.filter(w => w[0] === 'admin_notifications' && w[1].message === 'ส่งแบบไม่มีสำเนา').length, copy: window.__writes.filter(w => w[0] === 'intern_messages' && w[1].message === 'ส่งแบบไม่มีสำเนา').length, err: document.getElementById('dc-feedback').classList.contains('dc-err'), kept: document.getElementById('dc-feedback-message').value, cnt: document.querySelector('#dc-feedback .dc-cnt').textContent }));
        assert.deepEqual(fb, { adm: 1, copy: 0, err: false, kept: '', cnt: '2' }, 'rules not live: admin doc sent via add, no copy, no red row, counted as sent: ' + JSON.stringify(fb));
        await page.evaluate(() => { window.__fail = {}; });

        // ---- 5. 💬 timeline: mentor reply as a bubble, 🎁 to collect (one / all), quiet ✓ once collected
        await page.evaluate(() => {
            const ts = d => ({ toDate: () => new Date(Date.now() - d * 86400000) });
            reflectiveLogsCache = reflectiveLogsCache.concat([{ id: 'r1', content: 'ได้ฝึกซักประวัติผู้ป่วยเบาหวาน', mood: '😊', timestamp: ts(2), adminComment: 'ดีมาก ลองเพิ่มเรื่องการปรับยา', adminBonus: 0.2, pointsClaimed: false }]);
            renderReflectiveLogs();
        });
        const feed = await page.evaluate(() => {
            const area = document.getElementById('rl-history-area'), btn = [...area.querySelectorAll('button.rl-pill')].find(b => /รับ/.test(b.innerText));
            btn.scrollIntoView({ block: 'center' });
            const r = btn.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { inFeed: !!area.closest('#dc-feed'), btn: btn.innerText.trim(), clickable: btn.contains(hit), bubble: (area.querySelector('.rl-bub') || {}).innerText || '',
                all: (document.getElementById('rl-claim-all') || {}).innerText, dot: (document.getElementById('rl-claim-dot') || {}).innerText, glow: !!area.querySelector('.rl-glow') };
        });
        assert.ok(feed.inFeed && feed.clickable, '🎁 รับ sits in 💬 and can be tapped');
        assert.equal(feed.btn, '🎁 รับ'); assert.match(feed.bubble, /ดีมาก ลองเพิ่มเรื่องการปรับยา/, 'the mentor reply is a bubble');
        assert.deepEqual([feed.all, feed.dot, feed.glow], ['🎁 +0.2 · รับ · 받기', '🎁 +0.2', true]);
        await page.evaluate(() => { reflectiveLogsCache = reflectiveLogsCache.concat([{ id: 'r2', content: 'x', mood: '😐', timestamp: { toDate: () => new Date(Date.now() - 3 * 86400000) }, adminComment: 'ok', adminBonus: 0.1, pointsClaimed: false }]); renderReflectiveLogs(); });
        assert.equal(await page.evaluate(() => document.getElementById('rl-claim-all').innerText), '🎁 +0.3 · รับทั้งหมด · 모두 받기');
        await page.evaluate(() => { reflectiveLogsCache.forEach(l => { if (l.adminBonus) l.pointsClaimed = true; }); renderReflectiveLogs(); });
        const after = await page.evaluate(() => ({ chip: !!document.getElementById('rl-claim-all'), pills: document.querySelectorAll('#rl-history-list .rl-pill').length, ok: document.querySelectorAll('#rl-history-list .rl-ok').length, dot: getComputedStyle(document.getElementById('rl-claim-dot')).display }));
        assert.deepEqual(after, { chip: false, pills: 0, ok: 2, dot: 'none' }, 'collected: ✓ +x on each, nothing left to press');

        // ---- 6. a day whose +0.1 came from a Note alone: Today is closed (unchanged rule) and the hero says why
        await page.evaluate(() => { reflectiveLogsCache = []; window.myReflectiveLogsCache = []; window.myLpEntriesCache = [{ id: 'n1', title: 'x', createdAt: { toDate: () => new Date() } }]; renderReflectiveLogs(); renderDRStatus(); });
        s = await state();
        const lock = await page.evaluate(() => getComputedStyle(document.querySelector('.dc-lock')).display);
        assert.deepEqual([s.day, s.done, lock !== 'none'], [false, false, true], 'note-only day: Today closed, the hero says the +0.1 came from the Note');
        await page.evaluate(() => { window.myLpEntriesCache = []; renderReflectiveLogs(); renderDRStatus(); });
        s = await state();
        assert.deepEqual([s.day, s.done, s.ask], [true, false, false], 'back to an open day (the mood picked earlier is kept)');

        // ---- 7. old callers + kept ids
        await page.evaluate(() => toggleJournalNoteFields());
        assert.equal(await page.evaluate(() => document.activeElement.id), 'dc-note-content', 'the Note fold button / selectJournalTab("note") focuses the Note row');
        await page.evaluate(() => selectJournalTab('feedback'));
        assert.equal(await page.evaluate(() => document.activeElement.id), 'dc-feedback-message');
        for (const id of ['lp-note-title', 'dc-note-content', 'dc-note-submit', 'dc-feedback-message', 'dc-feedback-attach', 'dc-feedback-submit', 'rl-submit-btn', 'rl-content', 'rl-mood', 'rl-summarize-btn'])
            assert.equal(await page.locator('#' + id).count(), 1, 'kept: #' + id);

        // ---- 8. phone width: nothing sticks out
        assert.ok(await page.evaluate(() => { const p = document.getElementById('rl-reflection-pane'); return p.scrollWidth <= p.clientWidth + 1; }), 'no sideways overflow at 390 px');
        if (process.env.QA_SHOT) { await page.evaluate(() => document.activeElement.blur()); await page.locator('#rl-reflection-pane').screenshot({ path: process.env.QA_SHOT + '/journal-c1.png' }); }
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        await ctx.close();
        console.log('journal-one-page-qa: all checks passed' + (dialogs.length ? ' (dialogs: ' + dialogs.join(' | ') + ')' : ''));
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
