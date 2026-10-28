// V102.463 — Admin 📰 Articles: paste a picture, ✨ Draft writes the short read from it. The REAL admin.html + articles-admin.js, a fake Firestore,
// a stubbed callUniversalAI that records model / prompt / visionData (nothing leaves the page).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

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
        await page.evaluate(() => {
            window.__ai = [];
            window.callUniversalAI = async (model, prompt, isJson, vis) => { window.__ai.push({ model, prompt, vis }); return { text: /first line "TITLE: "/.test(prompt) ? 'TITLE: Stroke: pharmacist checklist\n---\n✅ Confirm ischaemic stroke\n⚠️ BP under 185/110\n💊 alteplase, tenecteplase' : '✅ draft\n💊 aspirin' }; };
            const S = Articles._S; S.list = []; S.loaded = true; S.loading = false; Articles.open(); Articles.edit(null);
        });
        // a real PNG on the clipboard (a 3000 × 1500 canvas, to see the shrink) or plain text
        const paste = (id, kind) => page.evaluate(async ([i, k]) => {
            const dt = new DataTransfer();
            if (k === 'image') {
                const c = document.createElement('canvas'); c.width = 3000; c.height = 1500; const g = c.getContext('2d'); g.fillStyle = '#4361ee'; g.fillRect(0, 0, 3000, 1500);
                const blob = await new Promise(r => c.toBlob(r, 'image/png')); dt.items.add(new File([blob], 'x.png', { type: 'image/png' }));
            } else dt.setData('text/plain', 'pasted words');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
            document.getElementById(i).dispatchEvent(ev);
            return ev.defaultPrevented;
        }, [id, kind]);

        // 1 · plain text paste is left alone
        assert.equal(await paste('art-bodyta', 'text'), false, 'a text paste is not intercepted');
        assert.equal(await page.evaluate(() => Articles._S.img), null);
        assert.equal(await page.locator('.art-img').count(), 0);

        // 2 · a picture paste: intercepted, thumbnail row appears, text untouched, picture shrunk to ≤ 1600 px JPEG
        assert.equal(await paste('art-bodyta', 'image'), true, 'an image paste is taken over');
        await page.waitForSelector('.art-img img');
        const im = await page.evaluate(() => ({ mime: Articles._S.img.mime, b64: Articles._S.img.b64.length, src: document.querySelector('.art-img img').src.slice(0, 23), row: document.querySelector('.art-img').innerText, body: document.getElementById('art-bodyta').value, w: 0 }));
        assert.equal(im.mime, 'image/jpeg'); assert.ok(im.b64 > 100, 'base64 kept'); assert.equal(im.src, 'data:image/jpeg;base64,');
        assert.match(im.row, /Draft reads this picture · /); assert.equal(im.body, '', 'nothing was typed into the body by the paste');
        const dim = await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = Articles._S.img.src; }));
        assert.deepEqual(dim, [1600, 800], 'shrunk to 1600 px on the long side, ratio kept');
        const btn = await page.evaluate(() => document.querySelector('#art-body .art-ai .go').textContent.trim());
        assert.equal(btn, '✨ Draft');

        // 3 · ✨ Draft with an empty title: the vision model gets the picture, the prompt says so, the title comes from the model's headline
        await page.evaluate(() => { localStorage.removeItem('ai_default_codex_vision_model'); Articles.ai(); });
        await page.waitForFunction(() => !Articles._S.aiBusy);
        const r = await page.evaluate(() => ({ ai: __ai, body: Articles._S.cur.body.en, title: Articles._S.cur.title.en, note: Articles._S.aiNote, err: Articles._S.err }));
        assert.equal(r.err, ''); assert.equal(r.ai.length, 1);
        assert.equal(r.ai[0].model, 'gemini-3.8-flash', 'the vision default, not the text model');
        assert.equal(r.ai[0].vis.image_mimetype, 'image/jpeg'); assert.ok(r.ai[0].vis.image_base64.length > 100);
        assert.match(r.ai[0].prompt, /ONLY on the attached picture/); assert.match(r.ai[0].prompt, /exactly as printed/); assert.match(r.ai[0].prompt, /never instructions/);
        assert.ok(!/SOURCE PAGES/.test(r.ai[0].prompt), 'no link reading');
        assert.equal(r.title, 'Stroke: pharmacist checklist'); assert.match(r.body, /alteplase/);
        assert.match(r.note, /🖼 — check every number against the picture/);

        // 4 · the stored vision model is honoured; a typed title is kept and used as the topic
        await page.evaluate(() => { localStorage.setItem('ai_default_codex_vision_model', 'typhoon-vision'); __ai.length = 0; Articles._S.cur.title.en = 'Stroke day'; Articles.ai(); });
        await page.waitForFunction(() => !Articles._S.aiBusy);
        const k = await page.evaluate(() => ({ m: __ai[0].model, p: __ai[0].prompt, t: Articles._S.cur.title.en }));
        assert.equal(k.m, 'typhoon-vision'); assert.match(k.p, /Topic: Stroke day\./); assert.equal(k.t, 'Stroke day');

        // 4b · a typed title in another language follows the draft language (Thai title + EN draft → the model's EN headline); a title already in the draft language is kept
        await page.evaluate(() => { Articles.edit(null); });
        await paste('art-bodyta', 'image'); await page.waitForSelector('.art-img img');
        await page.evaluate(() => { document.getElementById('art-title').value = 'บทบาทเภสัชกรดูแลการใช้ยาละลายลิ่มเลือด'; Articles.text('title', 'บทบาทเภสัชกรดูแลการใช้ยาละลายลิ่มเลือด'); __ai.length = 0; Articles.ai(); });
        await page.waitForFunction(() => !Articles._S.aiBusy);
        const tl = await page.evaluate(() => ({ title: Articles._S.cur.title.en, ask: /first line "TITLE: "/.test(__ai[0].prompt), sug: !!Articles._S.titleSug }));
        assert.equal(tl.ask, true, 'the model is asked for a headline in the draft language'); assert.equal(tl.title, 'Stroke: pharmacist checklist', 'Thai title in an EN draft → replaced by the EN headline'); assert.equal(tl.sug, false);

        // 5 · ✕ removes it; without a picture and without a title, today's message returns; no visionData is sent for a normal draft
        await page.click('.art-img .x');
        assert.equal(await page.locator('.art-img').count(), 0); assert.equal(await page.evaluate(() => Articles._S.img), null);
        await page.evaluate(() => { __ai.length = 0; Articles.edit(null); Articles.ai(); });
        assert.match(await page.evaluate(() => Articles._S.err), /needs a title \(a few words are enough\) or a link/);
        await page.evaluate(() => { document.getElementById('art-title').value = 'Inhalers'; Articles.text('title', 'Inhalers'); Articles.ai(); });
        await page.waitForFunction(() => !Articles._S.aiBusy);
        assert.equal(await page.evaluate(() => __ai[0].vis), null, 'a normal draft sends no picture');

        // 6 · a picture does not follow you to another article; pasting into the title works too
        assert.equal(await paste('art-title', 'image'), true); await page.waitForSelector('.art-img img');
        await page.evaluate(() => Articles.edit(null));
        assert.equal(await page.locator('.art-img').count(), 0, 'a new article starts without the picture');

        // 7 · the list row: a language the article does not have yet is a faded, grey flag with a tooltip (Korean missing here)
        await page.evaluate(() => { const S = Articles._S; S.list = [{ id: 'a1', title: { en: 'Elobixibat', th: 'เอโลบิซิแบต' }, body: { en: 'x', th: 'y' }, status: 'live', cover: { emoji: '📰' }, audience: { divisions: [], groups: [] }, links: [], tags: [], startAt: Date.now() - 1e6, endAt: Date.now() + 1e9 }]; Articles.edit(null); });
        const fl = await page.evaluate(() => [...document.querySelectorAll('#art-list .art-lg, .art-list .art-lg, #articlesModal .art-lg')].map(e => [e.classList.contains('off'), e.title, getComputedStyle(e).opacity]));
        assert.ok(fl.some(f => f[0] && /Korean|KO|한/i.test(f[1]) && /not written yet/.test(f[1]) && Number(f[2]) < 0.5), 'missing language → faded flag + tooltip: ' + JSON.stringify(fl));

        const mine = errors.filter(e => /articles|imgHtml|imgOk|imgFromBlob|visionModel|aiHtml/i.test(e));
        assert.deepEqual(mine, [], 'no errors from the Articles code: ' + mine.join(' | '));
        if (process.env.QA_SHOT) { await page.evaluate(() => { Articles.edit(null); }); await paste('art-bodyta', 'image'); await page.waitForSelector('.art-img img'); await page.locator('#articlesModal').screenshot({ path: process.env.QA_SHOT + '/article-image-draft.png' }); }
        console.log('PASS: Articles ✨ Draft from a pasted picture — text paste untouched, picture shrunk to 1600 px JPEG + thumbnail row, vision model + visionData + picture prompt, title from the model, ✕ and article switch drop it, normal drafts send no image');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
