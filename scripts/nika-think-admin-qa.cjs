// V102.632 (owner pick A) — 💭 think questions, admin side (nika-think-admin.js inside 📰 Articles): the "💭 n" chip next to ❔ (n = answers
// with no 👍 and no reply) opens the panel: write a question as 🌅 a day's (date), 📰 the open article's, or 💭 general → app_settings/nika_think
// items (merge); ✨ drafts 3 from the open article (＋ 📰 adds one); 🗑 removes a question; a row opens its answers with the intern's name,
// 👍 toggles liked, ↵ writes the reply. The REAL admin.html + articles-admin.js, a stub Firestore. OUTDIR=… saves a shot.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && window.NikaThinkAdmin && document.readyState === 'complete');

        const r = await page.evaluate(async () => {
            const out = {}, W = window.__w = [];
            const answers = [
                { qid: 'q1', userId: 'U1', answer: 'ไม่ขาย NSAID', createdAt: { toMillis: () => Date.now() - 3600e3 } },
                { qid: 'q1', userId: 'U2', answer: 'Paracetamol แทน', liked: true, createdAt: { toMillis: () => Date.now() - 7200e3 } }];
            window.usersData = [{ id: 'U1', displayName: 'Intern One' }, { id: 'U2', displayName: 'Intern Two' }];
            window.db = { collection: n => ({
                doc: id => ({ get: async () => ({ exists: true, data: () => ({ items: [{ id: 'q1', q: 'CKD 4 + NSAID?', kind: 'day', day: '2026-11-11' }] }) }),
                    set: async (d, o) => { W.push(['set', n, id, d, o]); }, update: async d => { W.push(['update', n, id, d]); } }),
                orderBy: () => ({ limit: () => ({ get: async () => ({ docs: answers.map((a, i) => ({ id: 'q1_auth' + i, data: () => a })) }) }) }) }) };
            const S = Articles._S;
            S.list = [{ id: 'Art9', title: { en: 'Microalbumin' }, body: { en: 'Albumin in urine…' }, status: 'draft', audience: { divisions: [], groups: [] }, cover: { emoji: '🫘' } }]; S.loaded = true; S.loading = false;
            Articles.open(); await new Promise(r => setTimeout(r, 50)); Articles.filter('all');
            const chip = () => document.querySelector('#articlesModal .art-think');
            out.chip = [chip().textContent, chip().getAttribute('aria-expanded'), !document.getElementById('nt-ad')];
            NikaThinkAdmin.toggle();
            const rows = () => [...document.querySelectorAll('#nt-ad .nt-r')].map(x => [x.querySelector('.tg').textContent, x.querySelector('.t').textContent, x.querySelector('.n').textContent]);
            out.rows = rows();
            out.kinds = [...document.querySelectorAll('#nt-ad .nt-k button')].map(b => b.textContent + (b.disabled ? '(off)' : '') + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''));
            out.noAi = !document.querySelector('#nt-ad [onclick="NikaThinkAdmin.ai()"]');
            // a general question
            NikaThinkAdmin.kind('general'); NikaThinkAdmin.text('Why does INR rise after an antibiotic?'); await NikaThinkAdmin.add();
            out.saved = W.pop(); out.rows2 = rows();
            // open the article → 📰 is on, ✨ shows; ✨ → 3 suggestions → ＋ 📰
            Articles.edit('Art9'); await new Promise(r => setTimeout(r, 30));
            if (!document.getElementById('nt-ad')) NikaThinkAdmin.toggle();
            out.kinds2 = [...document.querySelectorAll('#nt-ad .nt-k button')].map(b => b.textContent + (b.disabled ? '(off)' : ''));
            window.callUniversalAI = async (m, p) => { out.prompt = p; return { text: JSON.stringify({ questions: ['Why first morning urine?', 'What if it is positive once?', 'Who should be screened?', 'extra'] }) }; };
            await NikaThinkAdmin.ai();
            out.sug = [...document.querySelectorAll('#nt-ad .nt-sug span')].map(x => x.textContent);
            await NikaThinkAdmin.useSug(0);
            out.art = W.pop()[3].items.slice(-1)[0];
            out.sug2 = document.querySelectorAll('#nt-ad .nt-sug').length;
            // answers: names, 👍, reply
            NikaThinkAdmin.openQ('q1');
            out.ans = [...document.querySelectorAll('#nt-ad .nt-a')].map(a => [a.querySelector('.w b').textContent, a.querySelector('.tx').textContent, a.querySelector('.lk').getAttribute('aria-pressed')]);
            await NikaThinkAdmin.like('q1_auth0'); out.like = W.pop();
            NikaThinkAdmin.draft('q1_auth0', '  ดีมาก  '); await NikaThinkAdmin.sendReply('q1_auth0'); out.reply = W.pop();
            out.chip2 = chip().textContent;
            out.rp = document.querySelector('#nt-ad .nt-a .rp').textContent;
            window.confirm = () => true; await NikaThinkAdmin.del('q1'); out.del = W.pop()[3].items.map(x => x.id).includes('q1');
            return out;
        });
        assert.deepEqual(r.chip, ['💭 1', 'false', true], 'chip: 1 answer waiting (the other is 👍\'d): ' + r.chip);
        assert.deepEqual(r.rows, [['🌅 2026-11-11', 'CKD 4 + NSAID?', '💬 2 · 1 new']]);
        assert.deepEqual(r.kinds, ['🌅 Day*', '📰 Open an article(off)', '💭 General'], 'no article open: 📰 off: ' + r.kinds);
        assert.ok(r.noAi, 'no ✨ without an open article');
        assert.deepEqual([r.saved[0], r.saved[1], r.saved[2], r.saved[4], r.saved[3].items.length, r.saved[3].items[1].q, r.saved[3].items[1].kind], ['set', 'app_settings', 'nika_think', { merge: true }, 2, 'Why does INR rise after an antibiotic?', 'general']);
        assert.match(r.saved[3].items[1].id, /^[A-Za-z0-9-]{1,40}$/, 'id fits the rule');
        assert.deepEqual(r.rows2.map(x => x[0]), ['💭 General', '🌅 2026-11-11'], 'newest first');
        assert.deepEqual(r.kinds2, ['🌅 Day', '📰 Microalbumin', '💭 General']);
        assert.match(r.prompt, /3 open questions[\s\S]*Microalbumin[\s\S]*Albumin in urine/);
        assert.deepEqual(r.sug, ['✨ Why first morning urine?', '✨ What if it is positive once?', '✨ Who should be screened?'], 'three at most');
        assert.deepEqual([r.art.kind, r.art.articleId, r.art.articleTitle, r.art.q, r.sug2], ['article', 'Art9', 'Microalbumin', 'Why first morning urine?', 2]);
        assert.deepEqual(r.ans, [['Intern One', 'ไม่ขาย NSAID', 'false'], ['Intern Two', 'Paracetamol แทน', 'true']]);
        assert.deepEqual(r.like, ['update', 'nika_think_answers', 'q1_auth0', { liked: true }]);
        assert.deepEqual(r.reply, ['update', 'nika_think_answers', 'q1_auth0', { reply: 'ดีมาก', repliedAt: 'TS' }]);
        assert.deepEqual([r.chip2, r.rp], ['💭', '💬 ดีมาก'], 'nothing waiting → plain 💭');
        assert.equal(r.del, false, '🗑 removes the question');
        if (process.env.OUTDIR) {
            await page.evaluate(() => { NikaThinkAdmin._T.items.push({ id: 'q1', q: 'CKD 4 + NSAID?', kind: 'day', day: '2026-11-11' }); NikaThinkAdmin.openQ('q1'); NikaThinkAdmin.openQ('q1'); });
            await page.locator('#nt-ad').screenshot({ path: process.env.OUTDIR + '/nika-think-admin.png' });
        }
        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db.collection|firebase/.test(e);
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: 💭 think questions, admin (V102.632) — 💭 n chip (waiting answers), 🌅/📰/💭 add → app_settings/nika_think merge, ✨ 3 from the open article, answers with names, 👍 / reply update, 🗑');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
