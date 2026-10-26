// V102.430 📰 💬 Any Q? — admin side (PR 2 of 3). The REAL admin.html + articles-admin.js with a fake Firestore that pushes live
// article_questions snapshots (nothing leaves the page). Rows carry 💬 n / ⚠️ n for OPEN questions; a chip opens the article on its
// Questions panel (open first, ⚠️ first); ↩ Reply writes status 'answered' + reply + repliedAt + repliedBy; Close writes 'closed';
// a failed write keeps the draft; a snapshot never wipes a reply being typed; the Dashboard chip counts open ones and jumps to the oldest.
// Names are NEVER shown: the asker's authUid / userId appear nowhere in the modal or the chip.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<script src="articles-admin\.js\?v=V102\.\d+"><\/script>/.test(html));
assert.ok(/<div id="chip-artq" class="stat-badge"[^>]*display:none[^>]*onclick="if \(window\.Articles\) Articles\.inbox\(\)"/.test(html), 'Dashboard chip, hidden until there is an open question, opens the inbox');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
        // the stubbed Firebase makes other admin modules throw while booting — only errors from articles-admin.js count (as in articles-admin-qa.cjs)
        const errors = []; page.on('pageerror', e => { if (/articles-admin|Articles/.test(String(e.stack) + e.message)) errors.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');

        await page.evaluate(() => {
            const now = Date.now(), D = 864e5, ts = ms => ({ toMillis: () => ms });
            const docs = {
                a1: { title: { en: 'Psittacosis' }, body: { en: 'Body' }, cover: { emoji: '🦜' }, status: 'scheduled', startAt: ts(now - D), endAt: ts(now + D), audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
                a2: { title: { en: 'Legionnaires' }, body: { en: 'Body' }, cover: { emoji: '🦠' }, status: 'scheduled', startAt: ts(now - 2 * D), endAt: ts(now + D), audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
                a3: { title: { en: 'Bronchiolitis' }, body: { en: 'Body' }, cover: { emoji: '🫁' }, status: 'scheduled', startAt: ts(now - 3 * D), endAt: ts(now + D), audience: { divisions: [], groups: [] }, links: [], rerun: 'any' }
            };
            const who = { authUid: 'AUTH-SECRET-1', userId: 'U-SECRET-1', lang: 'th' };
            window.__qs = {
                q1: Object.assign({ articleId: 'a1', articleTitle: 'Psittacosis', kind: 'ask', text: 'Can it spread person to person?', status: 'open', createdAt: ts(now - 3 * 3600e3) }, who),
                q2: Object.assign({ articleId: 'a1', articleTitle: 'Psittacosis', kind: 'wrong', text: 'Mortality is low with early doxycycline', status: 'open', createdAt: ts(now - 2 * 3600e3) }, who),
                q3: Object.assign({ articleId: 'a1', articleTitle: 'Psittacosis', kind: 'add', text: 'Add the incubation period', status: 'answered', reply: 'Added: 5–14 days.', repliedAt: ts(now - 3600e3), createdAt: ts(now - 5 * 3600e3) }, who),
                q4: Object.assign({ articleId: 'a2', articleTitle: 'Legionnaires', kind: 'ask', text: 'Old one', status: 'closed', closedAt: ts(now - D), createdAt: ts(now - 2 * D) }, who),
                q5: Object.assign({ articleId: 'a3', articleTitle: 'Bronchiolitis', kind: 'ask', text: 'Oldest open question', status: 'open', createdAt: ts(now - 5 * D) }, who)
            };
            window.__writes = []; window.__fail = false; window.__push = null;
            const snap = () => ({ docs: Object.keys(window.__qs).map(id => ({ id, data: () => window.__qs[id] })) });
            window.db = { collection: name => ({
                get: async () => ({ docs: name === 'articles' ? Object.keys(docs).map(id => ({ id, data: () => docs[id] })) : [] }),
                onSnapshot: (ok) => { window.__push = () => ok(snap()); ok(snap()); return () => {}; },
                doc: id => ({ update: async v => { if (window.__fail) throw new Error('offline'); window.__writes.push([name, id, JSON.parse(JSON.stringify(v))]); Object.assign(window.__qs[id], v); } })
            }) };
            db = window.db;
        });
        await page.evaluate(() => Articles.boot());
        const chip = await page.evaluate(() => ({ n: document.getElementById('stat-artq-count').textContent, shown: document.getElementById('chip-artq').style.display }));
        assert.deepEqual(chip, { n: '3', shown: 'flex' }, 'Dashboard chip: 3 open questions');

        // ---- rows: 💬 n (open ❓ + 💡) · ⚠️ n (open ⚠️); nothing for closed / answered only
        await page.evaluate(() => Articles.open());
        await page.waitForFunction(() => document.querySelectorAll('#articlesModal .art-row').length === 3);
        const rows = await page.evaluate(() => [...document.querySelectorAll('#articlesModal .art-row')].map(r => r.querySelector('.art-t').textContent + ':' + [...r.querySelectorAll('.art-qc')].map(c => c.textContent).join('|')));
        assert.deepEqual(rows.sort(), ['Bronchiolitis:💬 1', 'Legionnaires:', 'Psittacosis:💬 1|⚠️ 1'], 'row chips count OPEN only: ' + rows);

        // ---- the ⚠️ chip opens the article on its Questions panel: open first, ⚠️ first, no names anywhere
        await page.click('#articlesModal .art-row .art-qc.w');
        let p = await page.evaluate(() => ({ panel: !!document.getElementById('art-qs'), cur: Articles._S.cur && Articles._S.cur.id, rail: [...document.querySelectorAll('#art-qs [data-qf]')].map(b => b.dataset.qf + ':' + b.querySelector('b').textContent + ':' + b.getAttribute('aria-pressed')),
            cards: [...document.querySelectorAll('#art-qs .art-q')].map(c => c.dataset.q), wrongBorder: getComputedStyle(document.querySelector('#art-qs .art-q.k-wrong')).borderLeftColor, sub: document.querySelector('#art-qs .sub').textContent }));
        assert.deepEqual([p.panel, p.cur], [true, 'a1']);
        assert.deepEqual(p.rail, ['open:2:true', 'answered:1:false', 'closed:0:false', 'all:3:false'], 'filter rail with counts, Open first');
        assert.deepEqual(p.cards, ['q2', 'q1'], '⚠️ before ❓ among the open ones');
        assert.equal(p.wrongBorder, 'rgb(245, 158, 11)', '⚠️ card has an amber edge');
        assert.match(p.sub, /names are never shown/);
        const noNames = () => page.evaluate(() => { const h = document.getElementById('articlesModal').innerHTML + document.getElementById('chip-artq').outerHTML; return !/SECRET/.test(h); });
        assert.ok(await noNames(), 'the asker’s authUid / userId appear nowhere');

        // ---- Reply: empty is refused; a typed reply survives a live snapshot; failure keeps it; success writes the answer
        await page.click('#art-qs .art-q[data-q="q2"] .qa .go');
        assert.match(await page.textContent('#art-qs .art-warn'), /Write a reply first/);
        assert.equal(await page.evaluate(() => window.__writes.length), 0, 'nothing written for an empty reply');
        await page.fill('#art-qr-q2', 'Thanks — we added that severe cases are uncommon with early doxycycline.');
        await page.focus('#art-qr-q2');
        await page.evaluate(() => { window.__qs.q6 = { articleId: 'a2', kind: 'ask', text: 'new one', status: 'open', createdAt: { toMillis: () => Date.now() }, authUid: 'AUTH-SECRET-2', userId: 'U-SECRET-2', lang: 'en' }; window.__push(); });
        assert.equal(await page.inputValue('#art-qr-q2'), 'Thanks — we added that severe cases are uncommon with early doxycycline.', 'a live snapshot does not wipe the reply being typed');
        assert.equal(await page.evaluate(() => document.getElementById('stat-artq-count').textContent), '4', 'the Dashboard count follows the snapshot');
        await page.evaluate(() => { window.__fail = true; });
        await page.click('#art-qs .art-q[data-q="q2"] .qa .go');
        await page.waitForFunction(() => /Not saved/.test((document.querySelector('#art-qs .art-warn') || {}).textContent || ''));
        assert.equal(await page.inputValue('#art-qr-q2'), 'Thanks — we added that severe cases are uncommon with early doxycycline.', 'a failed save keeps the reply');
        await page.evaluate(() => { window.__fail = false; });
        await page.click('#art-qs .art-q[data-q="q2"] .qa .go');
        await page.waitForFunction(() => window.__writes.length === 1);
        const w = await page.evaluate(() => window.__writes[0]);
        assert.deepEqual(w, ['article_questions', 'q2', { status: 'answered', reply: 'Thanks — we added that severe cases are uncommon with early doxycycline.', repliedAt: 'TS', repliedBy: 'admin' }], 'the reply write');
        p = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#art-qs .art-q')].map(c => c.dataset.q), n: document.getElementById('stat-artq-count').textContent }));
        assert.deepEqual(p, { cards: ['q1'], n: '3' }, 'answered: leaves the Open list, the count drops');

        // ---- Close without a reply
        await page.click('#art-qs .art-q[data-q="q1"] .qa button:not(.go)');
        await page.waitForFunction(() => window.__writes.length === 2);
        assert.deepEqual(await page.evaluate(() => window.__writes[1]), ['article_questions', 'q1', { status: 'closed', closedAt: 'TS', closedBy: 'admin' }]);
        await page.click('#art-qs [data-qf="all"]');
        p = await page.evaluate(() => [...document.querySelectorAll('#art-qs .art-q')].map(c => c.dataset.q + ':' + (c.querySelector('.rp') ? c.querySelector('.rp').firstChild.textContent.trim() : 'open')));
        assert.deepEqual(p, ['q2:↩ Thanks — we added that severe cases are uncommon with early doxycycline.', 'q3:↩ Added: 5–14 days.', 'q1:Closed without a reply'], 'All: answered (with the replies) before closed');
        if (process.env.QA_SHOT) await page.locator('#articlesModal').screenshot({ path: process.env.QA_SHOT + '/anyq-admin.png' });

        // ---- back to the editor; the stats button; the Dashboard chip jumps to the oldest open question
        await page.click('#art-qs .art-x');
        assert.equal(await page.evaluate(() => !!document.getElementById('art-qs') || !document.getElementById('art-title')), false, '✕ = back to the editor');
        await page.evaluate(() => Articles.close());
        await page.evaluate(() => Articles.inbox());
        await page.waitForFunction(() => document.getElementById('art-qs'));
        p = await page.evaluate(() => ({ cur: Articles._S.cur.id, cards: [...document.querySelectorAll('#art-qs .art-q')].map(c => c.dataset.q) }));
        assert.deepEqual(p, { cur: 'a3', cards: ['q5'] }, 'the Dashboard chip opens the article with the oldest open question');
        assert.ok(await noNames(), 'still no names');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Article 💬 Any Q? admin — Dashboard chip (live count, oldest first), row 💬/⚠️ for open only, Questions panel (rail, ⚠️ first, amber), Reply / Close writes, empty refused, failed save keeps text, live snapshot keeps typing, names never shown');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
