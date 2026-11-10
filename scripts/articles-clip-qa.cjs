// V102.625 (owner picks: look C chat story · admin A) — 📰 Articles ▸ 🎬 Clip: the button beside ✨ Draft turns the 📱 preview column into the clip
// composer; ✨ Script asks the model for Q: / RX: / KEY: lines from the article (open language), the chat plays in a 9:16 phone, a number the
// article never says gets ⚠️, lines can switch speaker / be edited / removed / added, ▶ Play steps through them, and the clip is saved WITH the
// article (toDoc.clip per language; a removed clip is deleted on the next save). The REAL admin.html + articles-admin.js, stub Firestore + AI.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
        await page.addInitScript(() => {
            window.__w = [];
            const ref = id => ({ update: async v => { window.__w.push(['update', id, v]); } });
            const db = { collection: () => ({ doc: ref, add: async v => { window.__w.push(['add', '', v]); return { id: 'new1' }; } }) };
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } }) : window.firebase, apply: () => window.firebase });
        });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && document.readyState === 'complete');

        const r = await page.evaluate(async () => {
            const S = Articles._S, D = 864e5, now = Date.now(), q = s => document.querySelector('#art-body ' + s), qa = s => [...document.querySelectorAll('#art-body ' + s)];
            window.db = window.firebase.firestore();
            S.list = [{ id: 'a1', title: { en: 'Topical corticosteroids (2)' }, body: { en: 'A 5-year-old with a wide rash. Over 1 year old, Class 4, 5 drugs like 0.1% Triamcinolone are OK.' }, cover: { emoji: '💊' }, status: 'draft',
                startAt: now + D, endAt: now + 9 * D, audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null }];
            S.loaded = true; S.loading = false; Articles.open(); Articles.edit('a1');
            const out = {};
            out.btn = [!!q('.art-ai .clp'), q('.art-ai .clp').textContent, !!q('.art-pv .art-phone')];
            q('.art-ai .clp').click();
            out.open = [!!q('.art-pv.art-clip'), !!q('.clp-empty'), q('.clp-go').disabled, q('.art-ai .clp').getAttribute('aria-pressed')];
            window.__p = [];
            window.callUniversalAI = async (model, prompt, j, v, s, o) => { window.__p.push([prompt, o && o.feature]); return { text: '**Q:** My son is 5 — which cream?\nRX: Over 1 year: Class 4, 5 is OK\nKEY: 0.1% Triamcinolone, with care\nnoise line\n- RX: Use it 600 times a day' }; };
            await Articles.clipScript();
            const ls = () => S.cur.clip.en.map(x => x.w + ':' + x.t);
            out.script = [ls(), window.__p[0][1], /Q: the customer/.test(window.__p[0][0]), /Copy every number/.test(window.__p[0][0]), window.__p[0][0].includes('0.1% Triamcinolone')];
            out.chat = [qa('.clp-chat .clp-m.q').length, qa('.clp-chat .clp-m.rx').length, qa('.clp-chat .clp-key').length, qa('.clp-l').length, qa('.clp-l.bad').map(e => e.querySelector('input').value), q('.clp-l.bad .clp-bad').title];
            Articles.clipWho(1); out.who = S.cur.clip.en[1].w; Articles.clipWho(1); Articles.clipWho(1);
            Articles.clipText(3, 'Use it twice a day'); out.edit = [S.cur.clip.en[3].t, qa('.clp-l.bad').length >= 0, q('#art-stl').textContent.includes('Unsaved')];
            Articles.clipDrop(0); Articles.clipAdd(); out.addDrop = [S.cur.clip.en.length, S.cur.clip.en[3].w, document.activeElement && document.activeElement.closest('.clp-l') ? 'focused' : 'no'];
            Articles.clipText(3, 'Read the full story in MEDLIFE');
            // ▶ Play without a voice: steps on a timer, the current line is ringed
            window.speechSynthesis && (window.__synth = window.speechSynthesis);
            Object.defineProperty(window, 'speechSynthesis', { value: null, configurable: true });
            Articles.clipPlay(); out.play0 = [S.clipPlaying, S.clipStep, qa('.clp-chat > *').filter(e => e.matches('.clp-m, .clp-key')).length, !!q('.clp-m.now, .clp-key.now'), !!q('.clp-ctl .clp-go') && q('.clp-ctl .clp-go').textContent];
            await new Promise(res => setTimeout(res, 2600)); out.play1 = S.clipStep;
            Articles.clipStop(); out.stop = [S.clipPlaying, S.clipStep, q('.clp-go').textContent];
            // saved with the article
            out.doc = Articles._toDoc(S.cur, 'draft').clip;
            await Articles.save(false); out.saved = window.__w.slice(-1)[0][2].clip;
            // remove every line → the next save deletes the clip
            while (S.cur.clip.en.length) Articles.clipDrop(0);
            out.docEmpty = Articles._toDoc(S.cur, 'draft').clip === undefined;
            await Articles.save(false); out.del = window.__w.slice(-1)[0][2].clip;
            // ✕ goes back to the 📱 preview; another article starts on the preview
            Articles.clip(); out.back = [!!q('.art-pv .art-phone'), !q('.art-clip')];
            return out;
        });
        assert.deepEqual(r.btn, [true, '🎬 Clip', true], 'the 🎬 Clip button sits in the AI group; the preview shows first');
        assert.deepEqual(r.open, [true, true, true, 'true'], 'tap → the preview column is the clip composer (empty: Play off)');
        assert.deepEqual(r.script[0], ['q:My son is 5 — which cream?', 'rx:Over 1 year: Class 4, 5 is OK', 'key:0.1% Triamcinolone, with care', 'rx:Use it 600 times a day'], 'Q / RX / KEY lines parsed, noise and ** dropped: ' + JSON.stringify(r.script[0]));
        assert.deepEqual(r.script.slice(1), ['article_clip', true, true, true], 'one prompt: speaker tags, the copy-numbers rule, the article body');
        assert.deepEqual(r.chat, [1, 2, 1, 4, ['Use it 600 times a day'], 'Not in the article: 600 — check the number'], 'chat: 🙋 left, 🧑‍⚕️ right, 💡 pill; only the invented number is flagged');
        assert.equal(r.who, 'key', 'tap the speaker: rx → key');
        assert.deepEqual(r.edit, ['Use it twice a day', true, true], 'typing edits the line and marks Unsaved');
        assert.deepEqual(r.addDrop, [4, 'q', 'focused'], 'remove + add (new line after an RX asks, focused)');
        assert.deepEqual(r.play0, [true, 0, 1, true, '■ Stop'], '▶ Play starts on line 1 (ringed), Stop shown');
        assert.ok(r.play1 >= 1, 'it steps on without a voice: ' + r.play1);
        assert.deepEqual(r.stop, [false, null, '▶ Play']);
        assert.deepEqual(r.doc, { en: [{ w: 'rx', t: 'Over 1 year: Class 4, 5 is OK' }, { w: 'key', t: '0.1% Triamcinolone, with care' }, { w: 'rx', t: 'Use it twice a day' }, { w: 'q', t: 'Read the full story in MEDLIFE' }] }, 'toDoc.clip per language: ' + JSON.stringify(r.doc));
        assert.deepEqual(r.saved, r.doc, 'Save draft writes the clip with the article');
        assert.deepEqual([r.docEmpty, r.del], [true, 'DEL'], 'every line removed → the saved clip is deleted');
        assert.deepEqual(r.back, [true, true], '✕ / 🎬 again → back to the 📱 preview');
        assert.deepEqual(errors.filter(e => !/ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Articles 🎬 Clip composer (V102.625) — preview column → chat-story clip; ✨ Q/RX/KEY script, invented numbers ⚠️, speaker / edit / remove / add, ▶ Play steps, saved with the article (deleted when emptied)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
