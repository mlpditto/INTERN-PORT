// V101.247 ✉️ Journal ▸ Message to admin — the intern's own copy in Work ▸ History, with the admin's reply.
// The REAL index.html + intern-messages.js + history-lean.js on a 390 px phone, Firestore faked. The query must be
// intern_messages where authUid == me (the rule lets an intern read only their own). A message is NOT a submission: the
// row carries no pt, never a ⏳ pill, never counts in the streak / activity days / Schedule heatmap, offers no 🗑; a reply
// shows as the 💬 line (** → highlighted), adds the ↩ Replied pill, lights the "new" dot for a day and moves the row up.
const path = require('node:path'), assert = require('node:assert/strict');
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
        });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.internMessages && window.historyLean && typeof renderUnifiedHistory === 'function');
        const r = await page.evaluate(async () => {
            window.liff = window.liff || {};   // the network is blocked, so the LINE SDK never loads — without this the page reloads itself after 15 s
            const out = {}, now = Date.now(), D = 864e5, H = 3600e3, ts = ms => ({ toMillis: () => ms, toDate: () => new Date(ms) }), wait = ms => new Promise(res => setTimeout(res, ms));
            let push = null;
            window.__fake = { collection: n => ({
                where: (f, op, v) => ({ get: async () => ({ docs: [] }), onSnapshot: ok => { if (n === 'intern_messages') { out.query = [n, f, op, v]; push = docs => ok({ docs: docs.map(d => ({ id: d.id, data: () => d })) }); } return () => {}; } }),
                doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }),
                get: async () => ({ docs: [] }), orderBy: () => ({ get: async () => ({ docs: [] }) })
            }) };
            window.ensureFirebaseAuthReady = async () => ({ uid: 'auth-1' });
            userId = 'U1'; window.myRegistered = true; userProfile = { displayName: 'Intern A' };
            unifiedSubmissionsCache = []; quizAttemptsCache = {}; myLinkSuggestionsCache = []; reflectiveLogsCache = []; window.myReflectiveLogsCache = [];
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            const host = document.getElementById('work-pane-history') || document.getElementById('unified-timeline');
            for (let a = host; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            internMessages.onUserDoc();
            await wait(1800);
            out.listening = typeof push === 'function';
            out.before = internMessages.historyItems().length;
            push([
                { id: 'm1', authUid: 'auth-1', userId: 'U1', message: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ\nบรรทัดสอง', attached: true, status: 'sent', createdAt: ts(now - 2 * D) },
                { id: 'm2', authUid: 'auth-1', userId: 'U1', message: 'Where is the ONE-TIME box?', attached: false, status: 'answered', reply: 'Under **Settings ▸ Quiz** — the second card.', repliedAt: ts(now - H), repliedBy: 'admin', createdAt: ts(now - 5 * D) },
                { id: 'm3', authUid: 'auth-1', userId: 'U1', message: '<img src=x onerror=alert(1)> hi', attached: false, status: 'sent', createdAt: ts(now - 9 * D) }
            ]);
            await wait(300);
            const items = internMessages.historyItems(), by = id => items.find(i => i.id === 'msg_' + id);
            out.shape = items.map(i => [i.id, i.submissionType, i.status, i.score, i.adminBonus, i.noDelete === true]);
            out.m1 = { title: by('m1').title, top: by('m1').timestamp.toMillis() === now - 2 * D, fresh: isRecentlyReviewed(by('m1')), comment: by('m1').adminComment };
            out.m2 = { title: by('m2').title, movedUp: by('m2').timestamp.toMillis() === now - H, fresh: isRecentlyReviewed(by('m2')), comment: by('m2').adminComment, sentAt: by('m2').metadata.sentAt === now - 5 * D };
            // not activity, not a submission
            out.counts = getUnifiedTypeCounts();
            out.streak = getReflectiveStreak();
            out.actDays = collectActivityDates().size;
            out.pendingChip = getUnifiedAllItems().filter(s => s.status === 'pending' || s.status === 'รอตรวจ').length;
            out.oldestPending = getOldestPending();
            out.heat = typeof schBuildDayMap === 'function' ? Object.keys(schBuildDayMap()).length : 0;
            out.spark = getPointsSparkline().reduce((a, b) => a + b, 0);
            // the rows
            unifiedCurrentFilter = 'all'; unifiedSearchQuery = ''; renderUnifiedHistory();
            await wait(200);
            const rows = [...document.querySelectorAll('#unified-timeline .hl-row[data-delete-type="message"]')];
            const row = id => rows.find(x => x.dataset.deleteItem === 'msg_' + id);
            out.rows = rows.map(x => x.dataset.deleteItem);
            out.lead = rows.map(x => (x.querySelector('.hl-disc') || {}).textContent);
            out.vals = rows.map(x => x.querySelector('.hl-val').textContent.trim());
            out.pills = rows.map(x => [...x.querySelectorAll('.hl-pill')].map(p => p.textContent.trim()));
            out.warn = rows.filter(x => x.querySelector('.hl-pill.hl-warn')).length;
            out.newDot = rows.map(x => !!x.querySelector('.hl-new'));
            out.bins = rows.filter(x => x.querySelector('.dr-menu')).length;
            out.title1 = row('m1').querySelector('.hl-tt').getAttribute('title');
            out.detail1 = row('m1').querySelector('.card-detail').innerText.replace(/\s+/g, ' ').trim();
            out.detail2 = { text: row('m2').querySelector('.card-detail').innerText.replace(/\s+/g, ' ').trim(), key: [...row('m2').querySelectorAll('.hl-comment strong.adm-key')].map(b => b.textContent), ws: getComputedStyle(row('m2').querySelector('.hl-comment')).whiteSpace };
            out.escaped = row('m3').querySelectorAll('img').length;
            const chip = document.querySelector('#unified-type-filters .hl-chip[data-filter="message"]');
            out.chip = chip ? [chip.getAttribute('title'), chip.textContent.replace(/\s+/g, ' ').trim()] : null;
            out.headPt = (document.querySelector('.hc-summary .hl-tp') || {}).textContent;
            out.allChip = (document.querySelector('#unified-type-filters .hl-chip[data-filter="all"]') || {}).textContent;
            // the filter chip + search find them
            unifiedCurrentFilter = 'message'; out.onlyMine = getFilteredUnifiedItems().map(i => i.id);
            unifiedCurrentFilter = 'all'; unifiedSearchQuery = 'โจทย์'; out.found = getFilteredUnifiedItems().map(i => i.id); unifiedSearchQuery = '';
            // a reply arriving later re-renders the list on its own (the module calls renderUnifiedHistory)
            push([{ id: 'm1', authUid: 'auth-1', userId: 'U1', message: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ\nบรรทัดสอง', attached: true, status: 'answered', reply: 'เพิ่มให้แล้ว 10 ข้อ', repliedAt: ts(now), createdAt: ts(now - 2 * D) }]);
            await wait(300);
            const r1 = document.querySelector('#unified-timeline .hl-row[data-delete-item="msg_m1"]');
            out.live = r1 ? [[...r1.querySelectorAll('.hl-pill')].map(p => p.textContent.trim()), !!r1.querySelector('.hl-new'), r1.querySelector('.hl-comment').innerText.trim()] : null;
            return out;
        });
        assert.deepEqual(r.query, ['intern_messages', 'authUid', '==', 'auth-1'], 'reads only my own copies (the rule needs this filter)');
        assert.deepEqual([r.listening, r.before], [true, 0], 'listener armed from the user doc; nothing before the snapshot');
        assert.deepEqual(r.shape, [['msg_m1', 'message', 'sent', 0, 0, true], ['msg_m2', 'message', 'answered', 0, 0, true], ['msg_m3', 'message', 'sent', 0, 0, true]], 'rows: type message, score 0, sent / answered, noDelete');
        assert.deepEqual(r.m1, { title: 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ บรรทัดสอง', top: true, fresh: false, comment: '' }, 'sent: the first words as the title, at the send time, no dot, no 💬');
        assert.deepEqual(r.m2, { title: 'Where is the ONE-TIME box?', movedUp: true, fresh: true, comment: 'Under **Settings ▸ Quiz** — the second card.', sentAt: true }, 'answered: the row moves to the reply time, new dot, the reply is the 💬 line');
        assert.equal(r.counts.message, 3); assert.equal(r.counts.all, 3);
        assert.deepEqual([r.streak.current, r.streak.longest, r.actDays, r.pendingChip, r.oldestPending, r.heat, r.spark], [0, 0, 0, 0, null, 0, 0], 'NOT activity: no streak, no activity day, no ⏳, no pending banner, no heatmap cell, no points');
        assert.deepEqual(r.rows, ['msg_m2', 'msg_m1', 'msg_m3'], 'newest first — the replied one leads because the reply is newer');
        assert.deepEqual(r.lead, ['✉️', '✉️', '✉️']);
        assert.deepEqual(r.vals, ['', '', ''], 'no pt, no beri on any of them');
        assert.deepEqual([r.pills, r.warn, r.newDot, r.bins], [[['↩ Replied'], [], []], 0, [true, false, false], 0], '↩ Replied only on the answered one, never ⏳, new dot only there, no 🗑');
        assert.equal(r.title1, 'อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ บรรทัดสอง');
        assert.match(r.detail1, /อยากได้โจทย์คำนวณยาเด็กเพิ่มครับ บรรทัดสอง\s*✉️ .+ · 📎/, 'detail = the message as sent + when + 📎 when the entry was attached: ' + r.detail1);
        assert.match(r.detail2.text, /Where is the ONE-TIME box\?\s*✉️ .+\s*💬 Under Settings ▸ Quiz — the second card\./, 'detail = message, sent time, then the reply: ' + r.detail2.text);
        assert.deepEqual([r.detail2.key, r.detail2.ws], [['Settings ▸ Quiz'], 'pre-wrap'], '**…** in the reply is the highlighted phrase, line breaks kept');
        assert.equal(r.escaped, 0, 'the message text is escaped');
        assert.deepEqual(r.chip, ['To admin', '✉️ 3'], 'the chip rail has an ✉️ To admin chip');
        assert.equal(r.headPt, '0.0pt', 'header total stays 0.0 pt');
        assert.deepEqual([r.onlyMine, r.found], [['msg_m2', 'msg_m1', 'msg_m3'], ['msg_m1']], 'the chip filters to them; search finds the message text');
        assert.deepEqual(r.live, [['↩ Replied'], true, '💬 เพิ่มให้แล้ว 10 ข้อ'], 'a reply arriving later repaints the row on its own');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: ✉️ To admin History rows (V101.247) — own copies only (authUid == me), ✉️ chip, no pt / streak / activity day / ⏳ / heatmap / 🗑, message + sent time in the detail, reply = 💬 line with **highlight** + ↩ Replied + new dot + row moves up, escaped, live repaint');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
