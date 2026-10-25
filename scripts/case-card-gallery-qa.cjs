// V102.426: a generated Case Card is kept in the Codex Gallery at once — real saveCaseCardToGallery + the real gallery loader / renderer cut from public/admin.html.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); return admin.slice(i, admin.indexOf(b, i)); };
const saver = cut('        async function saveCaseCardToGallery(', '        async function _renderCaseCardHtmlComposite(');
const gallery = cut('        async function mgwLoadCodexGallery()', '        // V102.345: a kept clip');
const dl = cut('        async function mgwDownloadGalleryItem(', '        // =====');

// static: generate hands the stamped PNG to the saver and reports the outcome
const gen = cut('        async function generateAlabastaCaseCardImage()', '        function buildAlabastaPoneglyphDraft');
assert.ok(gen.includes('saveCaseCardToGallery(caseDocId, caseItem, stampedUrl, model || selectedModel, getCaseCardLayout())'), 'generate → saver with the stamped PNG');
assert.ok(gen.includes("' · saved to gallery ✓'") && gen.includes("' · gallery save failed'"), 'the outcome is shown');
assert.ok(admin.includes('data-filter="case"') && /data-filter="case"[^>]*>📋 Cases</.test(admin), '📋 Cases chip');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        // https → a secure context (crypto.subtle exists, like the real admin page)
        await page.route('https://qa.test/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="mgw-gallery-grid"></div><span id="mgw-gallery-count"></span><button id="mgw-gallery-load-btn"></button>' }));
        await page.goto('https://qa.test/');
        await page.evaluate(() => {
            window.log = []; window.failPut = false; window.exists = new Set(); window.oldDeleted = [];
            window.ALLOWED_EMAIL = 'me@x.com';
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
            window.adminApp = { storage: () => ({ ref: p => ({
                getDownloadURL: async () => { if (window.exists.has(p)) return 'https://dl/' + p; const e = new Error('nf'); e.code = 'storage/object-not-found'; throw e; },
                put: async () => { if (window.failPut) throw new Error('quota'); window.log.push('put ' + p); return { ref: { getDownloadURL: async () => 'https://dl/' + p } }; },
                delete: async () => { window.oldDeleted.push(p); } }) }) };
            window.db = { collection: c => ({ doc: id => ({ update: async d => { window.log.push('update ' + c + '/' + id); window.lastUpdate = d; } }) }) };
            window.syncAlabastaCaseBridgeMarker = (id, u) => { window.bridge = [id, u]; };
        });
        await page.addScriptTag({ content: saver + '; window.saveCaseCardToGallery = saveCaseCardToGallery;' });
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        // 1. saved: content-addressed under patho-visuals/case-, the case doc gets caseCardImage, the previous file goes
        let ok = await page.evaluate(async png => saveCaseCardToGallery('doc1', { caseId: '26955', disease: 'GERD', caseCardImage: { storagePath: 'patho-visuals/case-old.png' } }, png, 'gemini-3-pro-image', 'infographic'), png);
        assert.equal(ok, true);
        const r1 = await page.evaluate(() => ({ log: window.log, u: window.lastUpdate.caseCardImage, del: window.oldDeleted, bridge: window.bridge[0] }));
        assert.match(r1.u.storagePath, /^patho-visuals\/case-[0-9a-f]{64}\.png$/); assert.equal(r1.u.downloadUrl, 'https://dl/' + r1.u.storagePath);
        assert.deepEqual([r1.u.caseId, r1.u.disease, r1.u.model, r1.u.template, r1.u.savedBy, r1.u.savedAt], ['26955', 'GERD', 'gemini-3-pro-image', 'infographic', 'me@x.com', 'TS']);
        assert.deepEqual(r1.log, ['put ' + r1.u.storagePath, 'update cases/doc1']); assert.deepEqual(r1.del, ['patho-visuals/case-old.png'], 'the old card file is replaced'); assert.equal(r1.bridge, 'doc1');
        // 2. same image again → no second upload (already in Storage), nothing deleted
        await page.evaluate(p => { window.exists.add(p); window.log = []; window.oldDeleted = []; }, r1.u.storagePath);
        await page.evaluate(async png => saveCaseCardToGallery('doc1', { caseId: '26955', caseCardImage: { storagePath: 'x' } }, png, 'm', 't'), png);
        assert.deepEqual(await page.evaluate(() => window.log), ['update cases/doc1'], 'no re-upload'); assert.deepEqual(await page.evaluate(() => window.oldDeleted), [], 'an unrelated old path is never deleted');
        // 3. upload fails → false, no case doc written, never throws
        await page.evaluate(() => { window.failPut = true; window.exists = new Set(); window.log = []; });
        assert.equal(await page.evaluate(async png => saveCaseCardToGallery('doc2', { caseId: '1' }, png + 'A', 'm', 't'), png), false);
        assert.deepEqual(await page.evaluate(() => window.log), [], 'nothing written on failure');

        // 4. the gallery lists Case Cards (newest first, ahead of the images), 📋 badge, #id · disease, its own filter, download name case-<id>
        await page.evaluate(() => {
            window.dxaEscapeHtml = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
            const snap = rows => ({ forEach: f => rows.forEach(r => f({ id: r.id, data: () => r.d })) });
            const cases = [{ id: 'docA', d: { caseId: '26955', disease: 'GERD', caseCardImage: { downloadUrl: 'https://dl/a.png', template: 'infographic', model: 'as/gemini-3-pro-image', caseId: '26955', disease: 'GERD' } } },
                           { id: 'docB', d: { caseId: '2', caseCardImage: { downloadUrl: 'https://dl/b.png' } } }, { id: 'docC', d: { caseCardImage: {} } }];
            window.db = { collection: c => c === 'cases'
                ? { orderBy: (f, dir) => { window.q = [f, dir]; return { limit: n => ({ get: async () => snap(cases) }) }; } }
                : { get: async () => snap(c === 'drug_codex' ? [{ id: 'd1', d: { genericName: 'Zed', pkVisual: { downloadUrl: 'https://dl/d.png' } } }] : []) } };
        });
        await page.addScriptTag({ content: gallery + '; window.mgwLoadCodexGallery = mgwLoadCodexGallery; window.mgwSetGalleryFilter = mgwSetGalleryFilter; window.mgwRenderCodexGallery = mgwRenderCodexGallery;' });
        await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="mgw-gallery-filter"></div>'); return mgwLoadCodexGallery(); });
        const g = await page.evaluate(() => ({ q: window.q, names: [...document.querySelectorAll('#mgw-gallery-grid img')].map(i => i.alt), badges: [...document.querySelectorAll('#mgw-gallery-grid span')].map(s => s.textContent).filter(t => /Case|Drug/.test(t)), count: document.getElementById('mgw-gallery-count').textContent }));
        assert.deepEqual(g.q, ['caseCardImage.savedAt', 'desc']); assert.deepEqual(g.names, ['#26955 · GERD', '#2', 'Zed'], 'cases first (newest first), then the images; an empty caseCardImage is skipped');
        assert.deepEqual(g.badges, ['📋 Case', '📋 Case', '💊 Drug']); assert.equal(g.count, '3 images');
        await page.evaluate(() => mgwSetGalleryFilter('case'));
        assert.equal(await page.evaluate(() => document.querySelectorAll('#mgw-gallery-grid img').length), 2, 'filter 📋 Cases');
        // 5. a failing cases query only hides the cards — the rest of the gallery still loads
        await page.evaluate(() => { const old = window.db.collection; window.db.collection = c => c === 'cases' ? { orderBy: () => ({ limit: () => ({ get: async () => { throw new Error('index'); } }) }) } : old(c); window._mgwGalleryFilter = 'all'; return mgwLoadCodexGallery(); });
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#mgw-gallery-grid img')].map(i => i.alt)), ['Zed']);
        // 6. the download name is the case id
        await page.evaluate(() => { window._mgwGalleryRendered = [{ type: 'case', name: '#26955 · GERD', fileBase: 'case-26955', url: 'https://dl/a.png' }]; window.showToast = t => { window.toast = t; }; window.fetch = async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) }); URL.createObjectURL = () => 'blob:x'; });
        await page.addScriptTag({ content: dl + '; window.mgwDownloadGalleryItem = mgwDownloadGalleryItem;' });
        await page.evaluate(() => mgwDownloadGalleryItem(0));
        assert.match(await page.evaluate(() => window.toast), /case-26955\.png/);
        console.log('PASS: Case Card gallery — saved on generate (content-addressed, old file replaced, no re-upload, failure harmless), 📋 Cases in the Codex Gallery, newest first, downloads as case-<id>.png.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
