// V101.213 📰 💬 Any Q? — the intern sees their own questions + the admin's replies under the article in History (PR 2 of 3).
// The REAL index.html + articles.js on a 390 px phone, Firestore faked. The query must be article_questions where authUid == me (the rule
// lets an intern read only their own); a reply moves the article row up to the reply time and lights the row's "new" dot for a day.
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
        await page.waitForFunction(() => window.internArticles && typeof renderUnifiedHistory === 'function');
        const r = await page.evaluate(async () => {
            window.liff = window.liff || {};   // the network is blocked, so the LINE SDK never loads — without this the page reloads itself after 15 s
            const out = {}, now = Date.now(), D = 864e5, ts = ms => ({ toMillis: () => ms }), wait = ms => new Promise(res => setTimeout(res, ms));
            const arts = {
                a1: { status: 'scheduled', title: { en: 'Psittacosis' }, body: { en: 'Ask about birds.' }, cover: { emoji: '🦜' }, startAt: ts(now - 3 * D), endAt: ts(now + D), audience: { divisions: [], groups: [] }, links: [] },
                a2: { status: 'scheduled', title: { en: 'Legionnaires' }, body: { en: 'Cooling towers.' }, cover: { emoji: '🦠' }, startAt: ts(now - 2 * D), endAt: ts(now + D), audience: { divisions: [], groups: [] }, links: [] }
            };
            let push = null;
            window.__fake = {
                collection: n => ({
                    where: (f, op, v) => ({
                        get: async () => ({ docs: n === 'articles' ? Object.keys(arts).map(id => ({ id, data: () => arts[id] })) : [] }),
                        onSnapshot: (ok) => { out.query = [n, f, op, v]; push = docs => ok({ docs: docs.map(d => ({ id: d.id, data: () => d })) }); return () => {}; }
                    }),
                    doc: id => ({ set: async () => {} })
                })
            };
            window.ensureFirebaseAuthReady = async () => ({ uid: 'auth-1' });
            userId = 'U1'; window.myRegistered = true;
            window.myUserDoc = { id: 'U1', group: 'EXTERN', articleSeen: { a1: { act: 'ok', at: ts(now - 2 * D) }, a2: { act: 'ok', at: ts(now - D) } }, articlePopDay: internArticles._bkkDay(now) };
            internArticles.onUserDoc();
            await wait(2800);
            const row = id => internArticles.historyItems().find(i => i.id === 'art_' + id);
            out.before = [row('a1').metadata.qa.length, !!row('a1').reviewedAt];
            push([
                { id: 'q1', articleId: 'a1', kind: 'ask', text: 'Can it spread person to person?', status: 'answered', reply: 'Very rarely — mostly from birds.', repliedAt: ts(now - 3600e3), createdAt: ts(now - 5 * 3600e3), authUid: 'auth-1' },
                { id: 'q2', articleId: 'a1', kind: 'wrong', text: 'Mortality is low with doxycycline', status: 'open', createdAt: ts(now - 4 * 3600e3), authUid: 'auth-1' },
                { id: 'q3', articleId: 'a2', kind: 'add', text: 'Add the urine antigen test', status: 'closed', createdAt: ts(now - 6 * 3600e3), authUid: 'auth-1' }
            ]);
            const a1 = row('a1'), a2 = row('a2');
            out.a1 = { qa: a1.metadata.qa, newDot: typeof isRecentlyReviewed === 'function' ? isRecentlyReviewed(a1) : null, top: a1.timestamp.toMillis() === now - 3600e3, adminComment: a1.adminComment };
            out.a2 = { qa: a2.metadata.qa.map(q => q.status), newDot: typeof isRecentlyReviewed === 'function' ? isRecentlyReviewed(a2) : null, time: a2.timestamp.toMillis() === now - D };
            const box = document.createElement('div'); box.innerHTML = internArticles.detailHtml(a1); document.body.appendChild(box);
            out.detail = [...box.querySelectorAll('.art-qa .q')].map(q => q.innerText.replace(/\s+/g, ' ').trim());
            out.head = box.querySelector('.art-qa > b').textContent;
            out.bubble = getComputedStyle(box.querySelector('.art-qa .r')).backgroundColor;
            box.remove();
            const box2 = document.createElement('div'); box2.innerHTML = internArticles.detailHtml(a2); document.body.appendChild(box2);
            out.detail2 = box2.querySelector('.art-qa .q').innerText.replace(/\s+/g, ' ').trim(); box2.remove();
            // escaping: the intern's own text never turns into markup
            push([{ id: 'q9', articleId: 'a1', kind: 'ask', text: '<img src=x onerror=alert(1)>', status: 'answered', reply: '<b>hi</b>', repliedAt: ts(now), createdAt: ts(now), authUid: 'auth-1' }]);
            const box3 = document.createElement('div'); box3.innerHTML = internArticles.detailHtml(row('a1'));
            out.escaped = [box3.querySelectorAll('.art-qa img, .art-qa b:not(:first-child)').length, box3.querySelector('.art-qa .q').innerText.includes('<img')];
            return out;
        });
        assert.deepEqual(r.query, ['article_questions', 'authUid', '==', 'auth-1'], 'only my own questions are read (the rule needs this filter)');
        assert.deepEqual(r.before, [0, false], 'no questions yet → a plain article row');
        assert.deepEqual(r.a1.qa, [{ kind: 'ask', text: 'Can it spread person to person?', status: 'answered', reply: 'Very rarely — mostly from birds.' }, { kind: 'wrong', text: 'Mortality is low with doxycycline', status: 'open', reply: '' }], 'my questions on the article, oldest first');
        assert.deepEqual([r.a1.newDot, r.a1.top, r.a1.adminComment], [true, true, undefined], 'a reply: new dot for a day, the row moves to the reply time, no duplicate 💬 line');
        assert.deepEqual([r.a2.qa, r.a2.newDot, r.a2.time], [['closed'], false, true], 'closed without a reply: listed, no new dot, no move');
        assert.deepEqual(r.detail, ['❓ Can it spread person to person? ↩ Very rarely — mostly from birds.', '⚠️ Mortality is low with doxycycline ⏳ Waiting for a reply'], 'the questions + reply under the article');
        assert.equal(r.head, '💬 Your questions'); assert.equal(r.bubble, 'rgb(236, 253, 245)', 'the reply is a green bubble');
        assert.equal(r.detail2, '💡 Add the urine antigen test Closed');
        assert.deepEqual(r.escaped, [0, true], 'question and reply text are escaped');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Article 💬 Any Q? History — own questions only (authUid == me), listed under the article with the reply (green) / waiting / closed, a reply = new dot + row moves up, escaped');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
