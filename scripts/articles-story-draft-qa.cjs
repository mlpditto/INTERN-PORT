// V102.511 — Admin 📰 Articles ✨ Draft tells a SHORT STORY (up to MAX_BODY = 2000) instead of 3–5 emoji lines; when the material does not fit, the model
// ends episode 1 with a "➡️ Next: …" line and ✨ Episode 2 drafts the next article from the same source. The REAL admin.html + articles-admin.js,
// a fake Firestore, a stubbed callUniversalAI that records the prompt (nothing leaves the page).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const aj = fs.readFileSync('public/articles-admin.js', 'utf8'), admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(!aj.includes('(under 700 characters)') && !aj.includes('3 to 5 short lines, each starting with one fitting emoji'), 'the old 3–5 emoji-line / 700-character prompt is gone');
assert.match(admin, /<script src="articles-admin\.js\?v=V102\.(51[1-9]|5[2-9]\d|[6-9]\d\d)"><\/script>/, 'articles-admin.js cache-busted');

const NOTES = 'ช่วงนี้มีข่าวเห็ดเข็มทองปนเปื้อน Listeria ... ceftriaxone monotherapy ... ampicillin for Listeria risk (age > 50, pregnancy) ... cefotaxime in neonates ... meropenem step-up ... duration: Listeria 21 days';
const EP1 = '🍄 A news item about contaminated enoki mushrooms lands on the ward group chat...\n\n💡 **Ceftriaxone** alone covers the usual pathogens.\n\n⚠️ Over 50, pregnant or immunocompromised → add **ampicillin** for *Listeria*.\n\n💊 ceftriaxone, ampicillin, cefotaxime, meropenem\n➡️ Next: neonates, the 48–72 h step-up and how long to treat';
const EP2 = '👶 Under one month old the story changes...\n\n✅ **Cefotaxime + ampicillin**; step up to **meropenem** when nothing improves in 48–72 h.\n\n💊 cefotaxime, ampicillin, meropenem';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => window.Articles && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');

        await page.evaluate(([EP1, EP2]) => {
            window.__ai = []; window.__reply = EP1;
            window.callUniversalAI = async (model, prompt) => { window.__ai.push(prompt); await new Promise(r => setTimeout(r, 30)); return { text: /first line "TITLE: "/.test(prompt) ? 'TITLE: Enoki, Listeria and meningitis\n---\n' + window.__reply : window.__reply }; };
            const S = Articles._S; S.list = []; S.loaded = true; S.loading = false;
            Articles.open(); Articles.edit(null);
        }, [EP1, EP2]);
        const set = (id, v) => page.evaluate(([i, x]) => { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('input')); }, [id, v]);
        const chip = () => page.locator('#art-body .art-ft .art-ep');

        // 1 · pasted notes + a typed title → ONE story prompt: scene, order, practice; the hard limit; the episode rule
        await set('art-title', 'Enoki mushrooms and meningitis'); await set('art-bodyta', NOTES);
        assert.equal(await chip().count(), 0, 'no episode chip before a draft');
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        let r = await page.evaluate(() => ({ ai: __ai, body: Articles._S.cur.body.en, title: Articles._S.cur.title.en, note: Articles._S.aiNote, err: Articles._S.err, ep: Articles._S.epSrc && { n: Articles._S.epSrc.n, next: Articles._S.epSrc.next, prev: Articles._S.epSrc.prev.length } }));
        assert.equal(r.ai.length, 1); const p1 = r.ai[0];
        for (const s of ['Tell it as a SHORT STORY', 'open with one concrete scene', 'in the order it happens', 'the one thing to do in practice', 'never a bare list of facts', 'Build on these notes: ' + NOTES,
            'at most 2000 characters including the markdown — a hard limit', 'write ONLY episode 1 as a complete, usable story', '"➡️ Next: "', 'when everything fits, add no such line', 'drug names in English', 'one line starting with 💊', 'no headings; a list only where the material really is a list'])
            assert.ok(p1.includes(s), 'the prompt says: ' + s);
        for (const s of ['under 700 characters', '3 to 5 short lines', 'fits a phone line', 'EPISODE']) assert.ok(!p1.includes(s), 'the prompt no longer says: ' + s);
        assert.equal(r.body, EP1, 'the story replaces the notes'); assert.equal(r.title, 'Enoki mushrooms and meningitis', 'a typed title is kept'); assert.equal(r.err, '');
        assert.deepEqual(r.ep, { n: 1, next: 'neonates, the 48–72 h step-up and how long to treat', prev: 0 }, 'the "➡️ Next:" line is remembered as the hand-off');
        assert.match(r.note, /the story continues: save, then ✨ Episode 2$/, 'the note says what to do next');
        assert.equal(await chip().count(), 1); assert.equal((await chip().innerText()).trim(), '✨ Episode 2', 'the footer offers episode 2');

        // 2 · unsaved → the chip refuses and says so; nothing drafted
        await page.evaluate(() => Articles.episode()); await page.waitForTimeout(80);
        r = await page.evaluate(() => ({ n: __ai.length, err: Articles._S.err, title: Articles._S.cur.title.en }));
        assert.equal(r.n, 1, 'no draft while episode 1 is unsaved'); assert.match(r.err, /Save this episode first/); assert.equal(r.title, 'Enoki mushrooms and meningitis', 'still on episode 1');

        // 3 · saved (id + clean) + two pictures on it → ✨ Episode 2 = a NEW article: title "(2)", same cover / audience / tags / pictures, the earlier episode in the prompt, continuing from the hand-off
        await page.evaluate(([EP2]) => {
            const S = Articles._S, a = S.cur; a.id = 'a1'; a.cover = { emoji: '🍄' }; a.audience = { divisions: ['RSU'], groups: [] }; a.tags = ['id']; a.rerun = 'any'; S.base = JSON.stringify(a); S.err = '';
            const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';   // a real 1×1 PNG so the stitch can load it
            S.imgs = [{ a: a, b64: PNG, src: 'data:image/png;base64,' + PNG, mime: 'image/png' }, { a: a, b64: PNG, src: 'data:image/png;base64,' + PNG, mime: 'image/png' }];
            window.__reply = EP2; window.__imgsBefore = S.imgs.slice();
            return Articles.episode();
        }, [EP2]);
        await page.waitForFunction(() => !Articles._S.aiBusy);
        r = await page.evaluate(() => { const S = Articles._S, a = S.cur; return { n: __ai.length, p: __ai[1], id: a.id, title: a.title.en, body: a.body.en, cover: a.cover.emoji, div: a.audience.divisions, tags: a.tags, lang: S.lang,
            imgs: (S.imgs || []).filter(i => i.a === a).map(i => i.b64), oldImgs: (S.imgs || []).filter(i => i.a === window.__imgsBefore[0].a).length, ep: S.ep && { n: S.ep.n, prev: S.ep.prev.length }, src: S.epSrc, err: S.err, note: S.aiNote, chip: !!document.querySelector('#art-body .art-ft .art-ep'), listLen: S.list.length }; });
        assert.equal(r.n, 2, 'one more AI call'); assert.equal(r.id, null, 'a NEW article'); assert.equal(r.title, 'Enoki mushrooms and meningitis (2)', 'the title carries the episode number');
        assert.deepEqual([r.cover, r.div, r.tags, r.lang], ['🍄', ['RSU'], ['id'], 'en'], 'cover / audience / tags / language follow');
        assert.equal(r.imgs.length, 2, 'the pictures are copied onto the new article'); assert.equal(r.oldImgs, 0, 'and no longer tied to the old one');
        assert.ok(r.p.includes('ONLY on the attached picture'), 'episode 2 reads the same pictures');
        for (const s of ['This is EPISODE 2 of that story', '[episode 1] 🍄 A news item about contaminated enoki', 'do not repeat it', 'Continue exactly where it stopped: neonates, the 48–72 h step-up and how long to treat', 'Build on these notes: ' + NOTES, 'write ONLY this episode as a complete, usable story'])
            assert.ok(r.p.includes(s), 'episode 2 prompt says: ' + s);
        assert.ok(!r.p.includes('➡️ Next: neonates'), 'the hand-off line of episode 1 is not pasted as story text'); assert.ok(!/first line "TITLE: "/.test(r.p), 'no headline asked — the title is set');
        assert.equal(r.body, EP2, 'episode 2 drafted'); assert.equal(r.ep, null, 'the episode context is cleared after the draft'); assert.equal(r.src, null, 'nothing more to continue'); assert.equal(r.chip, false, 'no chip when the story fits'); assert.equal(r.err, '');
        assert.ok(!/Episode 3/.test(r.note)); assert.equal(r.listLen, 0, 'nothing was saved by the AI');

        // 4 · a story that fits from the start → no hand-off, no chip
        await page.evaluate(([EP2]) => { window.__reply = EP2; Articles.edit(null); }, [EP2]);
        await set('art-title', 'Short one'); await set('art-bodyta', 'notes');
        await page.evaluate(() => Articles.ai()); await page.waitForFunction(() => !Articles._S.aiBusy);
        assert.equal(await page.evaluate(() => Articles._S.epSrc), null); assert.equal(await chip().count(), 0);
        assert.match(await page.locator('#art-bodyta').getAttribute('placeholder'), /A short story the reader can picture/, 'the box says what a draft is now');

        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: Articles ✨ Draft = a short story (scene → decision → practice, ≤ 2000 hard limit, 💊 line kept); "➡️ Next:" → ✨ Episode 2 chip, refused until saved, then a NEW article "(2)" with cover / audience / tags / pictures and the earlier episode in the prompt; a fitting story shows no chip');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
