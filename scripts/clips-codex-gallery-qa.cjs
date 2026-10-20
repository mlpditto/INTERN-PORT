// V102.345: every rendered clip is kept in Codex Gallery at once, and can be deleted later (owner's mockup pick).
// The REAL admin.html in Chromium (network stubbed; Firestore + Storage stubbed, nothing leaves the page):
// render → upload + clip_series write by itself → card shows ✓ In gallery, 🗑 asks inside the card · gallery chips
// (All · 🩺 Disease · 💊 Drug · 🎬 Clips) instead of a dropdown · one clip tile per kept episode · 🗑 asks inside the tile,
// then deletes the MP4 + resets the episode to planned · a failed upload leaves ↻ Retry save.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (u.startsWith('https://storage.test/')) return r.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(16) });
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.glcRenderEpisode === 'function' && typeof mgwLoadCodexGallery === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });

        // ---- stubs: an in-page Firestore (3 collections) + Storage that records put / delete
        await page.evaluate(() => {
            const v = document.getElementById('hub-view-design');
            for (let a = v; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', a === v ? 'flex' : 'block', 'important');
            const io = window.__io = { puts: [], dels: [], sets: [], toasts: [] };
            const store = window.__store = {
                disease_codex: { d1: { diseaseName: 'Hypertension', pathoVisual: { downloadUrl: 'https://img.test/d1.png', style: 'clay', model: 'as/x' } } },
                drug_codex: { g1: { genericName: 'Metformin', pkVisual: { downloadUrl: 'https://img.test/g1.png', style: 'clay', model: 'as/x' } } },
                clip_series: { OLD: { topic: 'Elobixibat', clipModel: 'google/veo-3.1-lite', episodes: [
                    { n: 1, title: 'Elobixibat for Chronic Constipation', captionTh: 'อีโลบิกซิแบท <ยาใหม่>', status: 'done', seconds: 8, costUsd: 0.4, clipUrl: 'https://storage.test/teach-clips/OLD/EP01.mp4', storagePath: 'teach-clips/OLD/EP01.mp4', renderedAt: '2026-10-20T10:00:00Z' },
                    { n: 2, title: 'Not rendered', status: 'planned' }] } },
            };
            const snapOf = (name) => ({ forEach: fn => Object.entries(store[name] || {}).forEach(([id, d]) => fn({ id, data: () => JSON.parse(JSON.stringify(d)) })) });
            window.db = { collection: name => ({
                get: async () => snapOf(name),
                doc: id => { id = id || 'S1'; return { id,
                    get: async () => ({ exists: !!(store[name] || {})[id], data: () => JSON.parse(JSON.stringify(store[name][id])) }),
                    set: async (d, o) => { io.sets.push({ name, id, merge: !!(o && o.merge) }); store[name] = store[name] || {}; store[name][id] = { ...(o && o.merge ? store[name][id] : {}), ...JSON.parse(JSON.stringify(d)) }; } }; } }) };
            window.adminApp = null;
            window.firebase = { app: () => ({ storage: () => ({ ref: p => ({
                put: async (blob, meta) => { if (window.__failPut) throw new Error('offline'); io.puts.push(p); return { ref: { getDownloadURL: async () => 'https://storage.test/' + p } }; },
                delete: async () => { io.dels.push(p); } }) }) }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            const t0 = window.showToast; window.showToast = (m, k) => { io.toasts.push(m); };
        });

        dialogs.length = 0;   // the boot-time email-link prompt (stubbed Firebase) is not this feature
        // ---- gallery: chips + one clip tile per kept episode
        const g = await page.evaluate(async () => {
            await mgwLoadCodexGallery();
            const grid = document.getElementById('mgw-gallery-grid'), count = () => document.getElementById('mgw-gallery-count').textContent;
            const tile = grid.querySelector('.mgw-clip-tile');
            const out = {
                select: !!document.querySelector('select#mgw-gallery-filter'),
                chips: [...document.querySelectorAll('#mgw-gallery-filter [data-filter]')].map(b => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
                count: count(), firstIsClip: grid.firstElementChild === tile, tiles: grid.children.length,
                name: tile.querySelector('.nm').textContent, cap: tile.querySelector('.cap').innerHTML, video: tile.querySelector('video').getAttribute('src'),
                link: [tile.querySelector('a.pv').target, tile.querySelector('a.pv').rel], dur: tile.querySelector('.dur').textContent, meta: tile.querySelector('.meta').textContent,
            };
            document.querySelector('#mgw-gallery-filter [data-filter="clip"]').click();
            out.clipOnly = [grid.querySelectorAll('.mgw-clip-tile').length, grid.children.length, count(), document.querySelector('#mgw-gallery-filter [data-filter="clip"]').getAttribute('aria-pressed')];
            document.querySelector('#mgw-gallery-filter [data-filter="disease"]').click();
            out.disease = [grid.children.length, count(), !!grid.querySelector('.mgw-clip-tile')];
            document.querySelector('#mgw-gallery-filter [data-filter="all"]').click();
            return out;
        });
        assert.equal(g.select, false, 'no dropdown any more');
        assert.deepEqual(g.chips, ['All*', '🩺 Disease', '💊 Drug', '🎬 Clips'], 'filter chips, All on');
        assert.deepEqual([g.count, g.firstIsClip, g.tiles], ['2 images · 1 clip', true, 3], 'the kept clip leads; EP02 (no clipUrl) has no tile');
        assert.equal(g.name, 'EP01 · Elobixibat for Chronic Constipation');
        assert.equal(g.cap, 'อีโลบิกซิแบท &lt;ยาใหม่&gt;', 'Thai caption, escaped');
        assert.equal(g.video, 'https://storage.test/teach-clips/OLD/EP01.mp4#t=0.1', 'first frame from the MP4');
        assert.deepEqual(g.link, ['_blank', 'noopener noreferrer'], '▶ plays in a new tab');
        assert.equal(g.dur, '0:08'); assert.equal(g.meta, 'veo-3.1-lite · 8 s · $0.40 · 20 Oct');
        assert.deepEqual(g.clipOnly, [1, 1, '1 clip', 'true'], '🎬 Clips shows only clips');
        assert.deepEqual(g.disease, [1, '1 image', false], '🩺 Disease hides clips');

        // ---- gallery 🗑: asks inside the tile; Cancel keeps it; Delete removes the MP4 + resets EP01 to planned
        const del = await page.evaluate(async () => {
            const io = window.__io, tile = () => document.querySelector('#mgw-gallery-grid .mgw-clip-tile');
            tile().querySelector('button.del').click();
            const out = { ask: tile().querySelector('.glc-confirm b').textContent };
            tile().querySelector('.glc-confirm [data-cancel]').click();
            out.cancelled = [!tile().querySelector('.glc-confirm'), io.dels.length];
            tile().querySelector('button.del').click();
            tile().querySelector('.glc-confirm [data-go]').click();
            await new Promise(r => setTimeout(r, 50));
            const ep = window.__store.clip_series.OLD.episodes[0];
            out.after = { dels: io.dels.slice(), ep: [ep.status, 'clipUrl' in ep, 'storagePath' in ep, ep.seconds, ep.costUsd, ep.title], tiles: document.querySelectorAll('#mgw-gallery-grid .mgw-clip-tile').length, count: document.getElementById('mgw-gallery-count').textContent, toast: io.toasts.slice(-1)[0] };
            return out;
        });
        assert.equal(del.ask, 'Delete EP01 for good?');
        assert.deepEqual(del.cancelled, [true, 0], 'Cancel deletes nothing');
        assert.deepEqual(del.after.dels, ['teach-clips/OLD/EP01.mp4'], 'the MP4 is deleted');
        assert.deepEqual(del.after.ep, ['planned', false, false, 0, 0, 'Elobixibat for Chronic Constipation'], 'EP01 back to planned, title kept');
        assert.deepEqual([del.after.tiles, del.after.count], [0, '2 images']);
        assert.match(del.after.toast, /EP01 deleted/);

        // ---- render → saved by itself → card ✓ In gallery; gallery refreshed; 🗑 asks inside the card
        const r = await page.evaluate(async () => {
            const io = window.__io;
            window._glcPollMs = 1;
            window._glcSeries = { id: '', topic: 'Warfarin', style: 'clay', model: 'm', episodes: [{ n: 1, title: 'Missed dose', captionTh: 'ลืมกินยา', status: 'planned' }, { n: 2, title: 'Two', status: 'planned' }] };
            window.callUniversalAI = async () => ({ text: '', raw: { videoDataUrl: 'data:video/mp4;base64,AAAAAAAA', seconds: 8, costUsd: 0.4, model: 'google/veo-3.1-lite' } });
            await window.glcRenderEpisode(1);
            await new Promise(r => setTimeout(r, 50));
            const card = document.getElementById('glc-clip-actions');
            const out = { puts: io.puts.slice(), saved: document.getElementById('glc-save-btn').textContent, chipIsButton: document.getElementById('glc-save-btn').tagName === 'BUTTON',
                delTitle: card.querySelector('[onclick="glcDiscardClip()"]').title, toast: io.toasts.find(t => /saved to Codex Gallery/.test(t)) || '',
                galleryTiles: [...document.querySelectorAll('#mgw-gallery-grid .mgw-clip-tile .nm')].map(e => e.textContent) };
            window.glcDiscardClip();
            out.ask = card.querySelector('.glc-confirm b') ? card.querySelector('.glc-confirm b').textContent : '';
            card.querySelector('.glc-confirm button').click();   // Cancel → card back
            out.backAfterCancel = !!document.querySelector('#glc-clip-actions .glc-saved');
            // a failed upload leaves ↻ Retry save and the episode unsaved
            window.__failPut = true;
            await window.glcRenderEpisode(2);
            await new Promise(r => setTimeout(r, 50));
            out.failed = [document.getElementById('glc-save-btn').textContent, document.getElementById('glc-save-btn').tagName, window.glcUnsaved().join(','), io.toasts.slice(-1)[0]];
            window.__failPut = false;
            await window.glcSaveClip(2);
            out.retried = [document.getElementById('glc-save-btn').textContent, window.glcUnsaved().length];
            return out;
        });
        assert.deepEqual(r.puts, ['teach-clips/S1/EP01.mp4'], 'the render uploaded by itself');
        assert.deepEqual([r.saved, r.chipIsButton], ['✓ In gallery', false], 'card: a chip, not a Save button');
        assert.equal(r.delTitle, 'Delete this clip — MP4 + gallery entry (asks first)');
        assert.equal(r.toast, '🎬 EP01 saved to Codex Gallery · $0.40');
        assert.deepEqual(r.galleryTiles, ['EP01 · Missed dose'], 'an open gallery shows the new clip without another Load');
        assert.equal(r.ask, 'Delete EP01 for good?', 'card 🗑 asks inside the card');
        assert.equal(r.backAfterCancel, true);
        assert.deepEqual(r.failed.slice(0, 3), ['↻ Retry save', 'BUTTON', '2'], 'a failed upload: Retry button, EP02 unsaved');
        assert.match(r.failed[3], /Not saved to Codex Gallery: offline — press ↻ Retry save/);
        assert.deepEqual(r.retried, ['✓ In gallery', 0], 'Retry saves it');

        assert.deepEqual(dialogs, [], 'no native dialog');
        assert.deepEqual(errs, []);
        console.log('PASS: clips → Codex Gallery — render saves itself (✓ In gallery, toast, gallery refresh), ↻ Retry save on a failed upload, chips All · Disease · Drug · Clips, clip tile (first frame, ▶ new tab, 0:08, EP · title · Thai caption), 🗑 asks in the tile / card, delete = MP4 + episode back to planned');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
