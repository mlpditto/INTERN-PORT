// V102.431 📰 💬 Any Q? — AI (PR 3 of 3). The REAL admin.html + articles-admin.js, Firestore and the AI faked (nothing leaves the page).
// Model row (Ollama · local default · ⚡ Haiku · 🎯 Sonnet, remembered); ✨ Group similar → one card per group with an editable AI draft,
// "Reply to all n" = ONE batch (all or nothing); 🔎 Check on a ⚠️ report → the article sentence, a suggested fix, where to verify and a
// reply draft ("Use as reply"). The prompts carry only the article + the questions' text — never authUid / userId / doc ids. The AI never
// writes to Firestore and never changes the article.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<script src="articles-admin\.js\?v=V102\.\d+"><\/script>/.test(html));

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
        // the stubbed Firebase makes other admin modules throw while booting — only errors from articles-admin.js count
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
            window.__art = { title: { en: 'Psittacosis' }, body: { en: 'Psittacosis is caught from bird droppings. Severe cases may involve respiratory failure.', th: 'ไข้นกแก้วติดจากมูลนก' }, cover: { emoji: '🦜' }, status: 'scheduled', startAt: ts(now - D), endAt: ts(now + D), audience: { divisions: [], groups: [] }, links: [], rerun: 'any' };
            const who = i => ({ authUid: 'AUTH-SECRET-' + i, userId: 'U-SECRET-' + i, lang: 'th' });
            window.__qs = {
                qa: Object.assign({ articleId: 'a1', kind: 'ask', text: 'Can it spread person to person?', status: 'open', createdAt: ts(now - 5 * 3600e3) }, who(1)),
                qb: Object.assign({ articleId: 'a1', kind: 'add', text: 'Please add the incubation period', status: 'open', createdAt: ts(now - 4 * 3600e3) }, who(2)),
                qc: Object.assign({ articleId: 'a1', kind: 'ask', text: 'Do patients need isolation from other people?', status: 'open', createdAt: ts(now - 3 * 3600e3) }, who(3)),
                qw: Object.assign({ articleId: 'a1', kind: 'wrong', text: 'Mortality is low with early doxycycline', status: 'open', createdAt: ts(now - 2 * 3600e3) }, who(4))
            };
            window.__writes = []; window.__ai = []; window.__aiReply = null; window.__failBatch = false;
            const snap = () => ({ docs: Object.keys(window.__qs).map(id => ({ id, data: () => window.__qs[id] })) });
            window.db = {
                collection: name => ({
                    get: async () => ({ docs: name === 'articles' ? [{ id: 'a1', data: () => window.__art }] : [] }),
                    onSnapshot: ok => { ok(snap()); return () => {}; },
                    doc: id => ({ path: name + '/' + id, update: async v => { window.__writes.push(['update', name, id, JSON.parse(JSON.stringify(v))]); Object.assign(window.__qs[id], v); } })
                }),
                batch: () => { const ops = []; return { update: (ref, v) => ops.push([ref.path, JSON.parse(JSON.stringify(v))]), commit: async () => { if (window.__failBatch) throw new Error('offline'); window.__writes.push(['batch', ops]); ops.forEach(([p, v]) => Object.assign(window.__qs[p.split('/')[1]], v)); } }; }
            };
            db = window.db;
            window.callUniversalAI = async (model, prompt, isJson, v, sys, opts) => { window.__ai.push({ model, prompt, isJson, feature: opts && opts.feature }); const r = window.__aiReply; if (r instanceof Error) throw r; return { text: typeof r === 'string' ? r : JSON.stringify(r) }; };
            localStorage.removeItem('articleQModel');
        });
        await page.evaluate(() => Articles.boot());
        await page.evaluate(() => { Articles.open(); });
        await page.waitForFunction(() => document.querySelectorAll('#articlesModal .art-row').length === 1);
        await page.evaluate(() => Articles.qs('a1'));
        const noSecret = s => !/SECRET|\bq[abcw]\b/.test(s);

        // ---- 1. the model row: Ollama · local by default, a pick is remembered
        let m = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#art-qs .art-qai [data-qm]')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')), grp: document.querySelector('#art-qs .art-qai .grp').disabled }));
        assert.deepEqual(m.chips, ['Ollama · local:true', '⚡ Haiku:false', '🎯 Sonnet:false'], 'three models, local first and on');
        assert.equal(m.grp, false, '✨ Group similar is on with 3 open ❓/💡 questions');
        await page.click('#art-qs .art-qai [data-qm="claude-haiku-5-5"]');
        assert.equal(await page.evaluate(() => localStorage.getItem('articleQModel')), 'claude-haiku-5-5', 'the pick is remembered');

        // ---- 2. ✨ Group similar: the prompt, the cards, bad items dropped
        await page.evaluate(() => { window.__aiReply = { groups: [{ items: [1, 3, 3, 9], topic: 'Person-to-person spread', reply: 'It rarely spreads between people; standard precautions are enough.' }, { items: [2], topic: 'alone', reply: 'x' }] }; });
        await page.click('#art-qs .art-qai .grp');
        await page.waitForFunction(() => document.querySelector('#art-qs .art-qg'));
        let call = await page.evaluate(() => window.__ai[0]);
        assert.equal(call.model, 'claude-haiku-5-5', 'runs on the picked model'); assert.equal(call.isJson, true); assert.equal(call.feature, 'article_questions');
        assert.ok(/Can it spread person to person\?/.test(call.prompt) && /incubation period/.test(call.prompt) && /isolation/.test(call.prompt) && /bird droppings/.test(call.prompt), 'the questions + the article are in the prompt');
        assert.ok(!/Mortality is low/.test(call.prompt), '⚠️ reports are not grouped');
        assert.ok(noSecret(call.prompt), 'no authUid / userId / doc id in the prompt');
        let g = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#art-qs .art-qg')].map(c => c.querySelector('.kd').textContent + '|' + c.querySelector('.tm').textContent + '|' + [...c.querySelectorAll('.tx')].map(t => t.textContent).join(' / ')),
            draft: document.getElementById('art-qg-0').value, single: [...document.querySelectorAll('#art-qs .art-q:not(.art-qg)')].map(c => c.dataset.q), btn: document.querySelector('#art-qs .art-qg .go').textContent }));
        assert.deepEqual(g.cards, ['👥 2 asked the same thing|Person-to-person spread|❓ “Can it spread person to person?” / ❓ “Do patients need isolation from other people?”'], 'one group of 2 (the duplicate / out-of-range / single-item ones dropped): ' + g.cards);
        assert.deepEqual([g.draft, g.btn], ['It rarely spreads between people; standard precautions are enough.', '↩ Reply to all 2'], 'the AI draft is in the box');
        assert.deepEqual(g.single, ['qw', 'qb'], 'the rest stay as single cards (⚠️ first)');
        assert.equal(await page.evaluate(() => window.__writes.length), 0, 'the AI wrote nothing');

        // ---- 3. Reply to all: one batch, the edited text; a failed batch keeps the text
        await page.fill('#art-qg-0', 'Very rarely — mostly from birds. Standard precautions are enough.');
        await page.evaluate(() => { window.__failBatch = true; });
        await page.click('#art-qs .art-qg .go');
        await page.waitForFunction(() => /Not saved/.test((document.querySelector('#art-qs .art-warn') || {}).textContent || ''));
        assert.equal(await page.inputValue('#art-qg-0'), 'Very rarely — mostly from birds. Standard precautions are enough.', 'a failed save keeps the edited text');
        await page.evaluate(() => { window.__failBatch = false; });
        await page.click('#art-qs .art-qg .go');
        await page.waitForFunction(() => window.__writes.length === 1);
        const b = await page.evaluate(() => window.__writes[0]);
        assert.deepEqual(b, ['batch', [['article_questions/qa', { status: 'answered', reply: 'Very rarely — mostly from birds. Standard precautions are enough.', repliedAt: 'TS', repliedBy: 'admin' }], ['article_questions/qc', { status: 'answered', reply: 'Very rarely — mostly from birds. Standard precautions are enough.', repliedAt: 'TS', repliedBy: 'admin' }]]], 'one batch, both questions, the edited reply');
        g = await page.evaluate(() => ({ groups: document.querySelectorAll('#art-qs .art-qg').length, open: [...document.querySelectorAll('#art-qs .art-q')].map(c => c.dataset.q), chip: document.getElementById('stat-artq-count').textContent }));
        assert.deepEqual(g, { groups: 0, open: ['qw', 'qb'], chip: '2' }, 'answered: the group leaves the Open list');
        assert.equal(await page.evaluate(() => document.querySelector('#art-qs .art-qai .grp').disabled), true, 'only one ❓/💡 left → nothing to group');

        // ---- 4. 🔎 Check a ⚠️ report: prompt, the result box, Use as reply; nothing written, the article unchanged
        await page.click('#art-qs .art-qai [data-qm="claude-sonnet-5-5"]');
        await page.evaluate(() => { window.__aiReply = { quote: 'Severe cases may involve respiratory failure.', verdict: 'partly', fix: 'Severe cases (uncommon with early doxycycline) may involve respiratory failure.', source: 'CDC Psittacosis clinical page', reply: 'ขอบคุณค่ะ เพิ่มแล้วว่าอาการรุนแรงพบน้อยถ้าได้ doxycycline เร็ว' }; });
        await page.click('#art-qs .art-q[data-q="qw"] .qa .ai');
        await page.waitForFunction(() => document.querySelector('#art-qs .art-qck'));
        call = await page.evaluate(() => window.__ai[1]);
        assert.equal(call.model, 'claude-sonnet-5-5');
        assert.ok(/REPORT: Mortality is low with early doxycycline/.test(call.prompt) && /ไข้นกแก้วติดจากมูลนก/.test(call.prompt), 'the report + the article in the reporter’s language (th)');
        assert.ok(noSecret(call.prompt), 'no authUid / userId / doc id in the prompt');
        const ck = await page.evaluate(() => { const c = document.querySelector('#art-qs .art-qck'); return { v: c.querySelector('.v').textContent, rows: [...c.querySelectorAll('.r')].map(r => r.textContent), btns: [...c.querySelectorAll('button')].map(x => x.textContent) }; });
        assert.deepEqual(ck, { v: '🔎 Partly right', rows: ['In the article“Severe cases may involve respiratory failure.”', 'Suggested fixSevere cases (uncommon with early doxycycline) may involve respiratory failure.', 'Check withCDC Psittacosis clinical page'], btns: ['✍️ Use as reply', '✏️ Edit article'] });
        await page.click('#art-qs .art-qck button');
        assert.equal(await page.inputValue('#art-qr-qw'), 'ขอบคุณค่ะ เพิ่มแล้วว่าอาการรุนแรงพบน้อยถ้าได้ doxycycline เร็ว', 'Use as reply fills the box — the admin still presses ↩ Reply');
        assert.equal(await page.evaluate(() => window.__writes.length), 1, 'the check wrote nothing');
        if (process.env.QA_SHOT) await page.locator('#articlesModal').screenshot({ path: process.env.QA_SHOT + '/anyq-ai.png' });

        // ---- 5. AI failures: a message, nothing stuck
        await page.evaluate(() => { window.__aiReply = new Error('Ollama is not running'); });
        await page.click('#art-qs .art-q[data-q="qw"] .qa .ai');
        await page.waitForFunction(() => /Ollama is not running/.test((document.querySelector('#art-qs .art-qai + .art-warn') || {}).textContent || ''));
        await page.evaluate(() => { window.__aiReply = 'Sorry, I cannot help with that.'; });
        await page.click('#art-qs .art-q[data-q="qw"] .qa .ai');
        await page.waitForFunction(() => /did not return JSON/.test((document.querySelector('#art-qs .art-qai + .art-warn') || {}).textContent || ''));
        assert.equal(await page.evaluate(() => document.querySelector('#art-qs .art-q[data-q="qw"] .qa .ai').disabled), false, 'not stuck in ⏳');
        assert.ok(await page.evaluate(() => !/SECRET/.test(document.getElementById('articlesModal').innerHTML)), 'still no names on screen');
        assert.ok(await page.evaluate(() => window.__writes.every(w => w[1] !== 'articles' && !(w[0] === 'batch' && w[1].some(o => /^articles\//.test(o[0]))))), 'the article itself is never written');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Article 💬 Any Q? AI — model row (local first, remembered), ✨ Group similar (prompt = article + question text only, bad items dropped, one card per group with an editable draft, Reply to all = one batch, failure keeps text), 🔎 Check ⚠️ (reporter’s language, quote / fix / source / Use as reply), AI never writes, errors shown');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
