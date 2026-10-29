// V102.356: Reflective Review — Bonus lives in the footer beside Save (the Bonus card under the editor is gone); the AI pick is
// the ringed 💡 chip (auto-applied while the admin has not picked) with its reason beside the chips; Translate = a 🌐 icon in the
// reflection card's corner whose state lives in aria-label / aria-pressed; Focus count badge is slate; rewrite chips hide while
// they are all disabled; Orphan images is an icon. The REAL public/admin.html (file://, network blocked, Firebase stubbed).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = pathToFileURL(path.resolve('public/admin.html')).href;

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 1526, height: 900 }, timezoneId: 'Asia/Bangkok' });
        const page = await ctx.newPage();
        await page.addInitScript(() => {
            const ts = d => ({ toDate: () => d, toMillis: () => +d, seconds: Math.floor(d / 1000) });
            const docs = l => ({ docs: [], size: 0, empty: true, forEach: () => {} });
            const q = () => ({ where: q, orderBy: q, limit: q, startAfter: q, get: async () => docs([]), onSnapshot: () => () => {},
                doc: id => ({ get: async () => ({ exists: false, id, data: () => null }), set: async () => {}, update: async () => {}, onSnapshot: () => () => {}, collection: q }) });
            const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, settings() {}, enablePersistence: async () => {} };
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            window.firebase = new Proxy(function () {}, { get: (t, k) => {
                if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = { fromDate: d => ts(d), now: () => ts(new Date()) }; return f; }
                if (k === 'auth') return () => ({ currentUser: { uid: 'admin', getIdToken: async () => 'x' }, onAuthStateChanged: cb => { setTimeout(() => cb({ uid: 'admin' }), 0); return () => {}; }, signInAnonymously: async () => ({}) });
                return k === 'then' ? undefined : any; }, apply: () => any });
            window.__logs = [
                { id: 'L1', userId: 'U1', userName: 'Sample', mood: 'happy', content: 'ได้ลงมือปฏิบัติมากขึ้น ยังติดปัญหาเรื่องจำขั้นตอนไม่ได้', timestamp: ts(new Date(Date.now() - 3600e3)) },
                { id: 'p1', userId: 'U1', content: 'a', mood: 'happy', reviewStatus: 'reviewed', adminBonus: 0.2, feedbackPreset: 'encourage', timestamp: ts(new Date(Date.now() - 3 * 864e5)) },
            ];
        });
        // network blocked; the page's one ES-module import (esm.run @google/generative-ai) and its CDN scripts get inert stand-ins
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (u.includes('esm.run/@google/generative-ai')) return r.fulfill({ contentType: 'text/javascript', body: 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' });
            if (r.request().resourceType() === 'script') return r.fulfill({ contentType: 'text/javascript', body: 'window.mermaid = window.mermaid || { initialize() {}, run() {} };' });
            return r.abort();
        });
        page.on('pageerror', () => {});
        await page.goto(ADMIN, { waitUntil: 'load' });
        await page.waitForTimeout(800);
        await page.evaluate(async () => { reflectiveLogsCache = window.reflectiveLogsCache = window.__logs; await reviewReflective('L1'); });
        await page.waitForTimeout(400);

        const r = await page.evaluate(async () => {
            const m = document.getElementById('reflectiveReviewModal'), cs = e => getComputedStyle(e);
            window._rrBonusTouched = false;
            showReflectiveBonusSuggestion(0.2, 'names a concrete problem');
            await new Promise(res => setTimeout(res, 350));   // the chips transition box-shadow (0.15 s)
            const chips = [...m.querySelectorAll('#reflective-bonus-chips .reflective-bonus-chip')];
            const ai = chips.find(c => c.classList.contains('ai-pick'));
            const badge = m.querySelector('.focus-pill-badge');
            const tr = m.querySelector('.rr-translate'), orph = m.querySelector('.reflective-review-overflow-btn');
            return {
                inFooter: !!m.querySelector('.reflective-review-footer .rr-foot-bonus #reflective-bonus-chips') && !!m.querySelector('.reflective-review-footer #reflective-review-bonus'),
                panel: m.querySelectorAll('.reflective-review-bonus-panel, .rr-bonus-line, .suggestion-apply').length,
                value: document.getElementById('reflective-review-bonus').value,
                ai: ai && [ai.dataset.value, ai.classList.contains('active'), getComputedStyle(ai, '::after').content, getComputedStyle(ai).boxShadow.includes('249, 115, 22')],
                reason: [cs(m.querySelector('#reflective-bonus-suggestion')).display, m.querySelector('#reflective-bonus-suggestion').textContent.replace(/\s+/g, ' ').trim()],
                rewrite: cs(m.querySelector('#reflective-rewrite-chips')).display,
                badge: badge && cs(badge).backgroundColor,
                tr: tr && [tr.textContent, tr.getAttribute('aria-label'), cs(tr).position, !!tr.closest('.rr-log-focus')],
                orph: [orph.textContent.trim(), orph.getAttribute('aria-label')],
                sameRowAsSave: Math.abs(m.querySelector('#reflective-bonus-chips').getBoundingClientRect().top - m.querySelector('.reflective-review-save-btn').getBoundingClientRect().top) < 30,
            };
        });
        assert.ok(r.inFooter && r.panel === 0, 'bonus chips + number sit in the footer; no Bonus card / Apply button: ' + JSON.stringify(r));
        assert.ok(r.sameRowAsSave, 'bonus is on the Save row at 1526 px');
        assert.equal(r.value, '0.2', 'AI pick auto-applied while the admin has not picked');
        assert.deepEqual(r.ai, ['0.2', true, 'none', true], 'V102.496: the AI chip is active and ringed (no badge — the 💡 beside the control carries the reason): ' + JSON.stringify(r.ai));
        assert.deepEqual(r.reason, ['flex', '💡 0.2 · names a concrete problem'], 'reason beside the chips');
        assert.equal(r.rewrite, 'none', 'rewrite chips hidden while all disabled (empty editor)');
        assert.equal(r.badge, 'rgb(100, 116, 139)', 'Focus count badge is slate, not red');
        assert.deepEqual(r.tr, ['🌐', 'Translate', 'absolute', true], '🌐 icon in the reflection card corner');
        assert.deepEqual(r.orph, ['', 'Orphan images'], 'Orphan images is icon-only, named by aria-label');

        // V102.496: the bar lives in the header row — segmented Bonus, 💡 reason popover, Save & Score = ✅ icon, no Cancel button (✕ closes)
        const d = await page.evaluate(() => {
            const m = document.getElementById('reflectiveReviewModal'), cs = e => getComputedStyle(e), hdr = m.querySelector('.reflective-liquid-header');
            const save = m.querySelector('.reflective-review-save-btn'), sug = m.querySelector('#reflective-bonus-suggestion'), txt = sug.querySelector('.suggestion-text'), x = m.querySelector('.reflective-close-btn');
            const before = cs(txt).display; sug.focus(); const focused = cs(txt).display; sug.blur();
            const chips = m.querySelector('#reflective-bonus-chips');
            return { inHeader: !!hdr.querySelector('.reflective-review-footer #reflective-bonus-chips') && !!hdr.querySelector('#reflective-review-bonus') && !!hdr.querySelector('.reflective-review-save-btn'),
                footerBelow: !!m.querySelector('.reflective-review-shell ~ .reflective-review-footer'),
                save: [save.textContent.trim(), save.getAttribute('aria-label'), save.title], cancel: m.querySelectorAll('.reflective-review-cancel-btn').length,
                x: [x.getAttribute('aria-label'), x.title], pop: [before, focused], seg: [cs(chips).gap, cs(chips).borderTopWidth], hdrH: Math.round(hdr.getBoundingClientRect().height) };
        });
        assert.ok(d.inHeader && !d.footerBelow, 'bonus + Save sit in the header row, nothing is left below: ' + JSON.stringify(d));
        assert.deepEqual(d.save, ['✅', 'Save & Score', 'Save & Score (Ctrl/⌘ + Enter)'], 'Save & Score is an icon, named by aria-label / tooltip');
        assert.equal(d.cancel, 0, 'no Cancel button — the ✕ is Cancel'); assert.deepEqual(d.x, ['Close review modal', 'Cancel (Esc)']);
        assert.deepEqual(d.pop, ['none', 'block'], 'the AI reason is a popover on the 💡 (hidden until hover / focus / tap)');
        assert.deepEqual(d.seg, ['0px', '1px'], 'the chips form one segmented control');
        assert.ok(d.hdrH <= 70, 'one header row at 1526 px: ' + d.hdrH);

        // chips: tap 0.5 = the admin's pick, tap the AI chip = apply it
        const vals = await page.evaluate(() => { const c = v => document.querySelector('#reflective-bonus-chips [data-value="' + v + '"]'); c('0.5').click(); const a = document.getElementById('reflective-review-bonus').value; c('0.2').click(); return [a, document.getElementById('reflective-review-bonus').value]; });
        assert.deepEqual(vals, ['0.5', '0.2'], 'chips set the bonus');
        // once the admin picked, a new AI suggestion does not overwrite it
        assert.equal(await page.evaluate(() => { document.querySelector('#reflective-bonus-chips [data-value="0.5"]').click(); showReflectiveBonusSuggestion(0.3, 'x'); return document.getElementById('reflective-review-bonus').value; }), '0.5', 'a later AI suggestion never overrides the admin');

        // Translate keeps the icon; its state is in aria-label / aria-pressed
        const tr = await page.evaluate(async () => {
            window.qtTranslateText = async () => ({ text: 'I practised more.' });
            const b = document.querySelector('#reflectiveReviewModal .rr-translate'), s = [];
            await translateReflectiveLogContent(b); s.push([b.textContent, b.getAttribute('aria-label'), b.getAttribute('aria-pressed'), document.getElementById('reflective-log-translation').hidden]);
            await translateReflectiveLogContent(b); s.push([b.textContent, b.getAttribute('aria-label'), b.getAttribute('aria-pressed'), document.getElementById('reflective-log-translation').hidden]);
            return s;
        });
        assert.deepEqual(tr, [['🌐', 'Hide translation', 'true', false], ['🌐', 'Show translation', 'false', true]], 'translate toggles by state, icon stays: ' + JSON.stringify(tr));

        // a narrow window: the footer wraps, nothing scrolls sideways
        await page.setViewportSize({ width: 760, height: 900 }); await page.waitForTimeout(200);
        assert.ok(await page.evaluate(() => { const c = document.querySelector('#reflectiveReviewModal .modal-content'); return c.scrollWidth - c.clientWidth <= 1; }), 'no sideways scroll at 760 px');
        console.log('PASS: Reflective Review bonus footer — chips + number beside Save, ringed 💡 AI pick (auto-applied, never over the admin), reason inline, 🌐 icon translate, slate badges, rewrite chips hidden while empty, icon-only Orphan images');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
