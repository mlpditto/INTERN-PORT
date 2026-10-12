// V102.200 — CAFE points are their own balance: scoring a content post (works.kind 'social') adds to users.cafePts, any other work to users.score;
// the User Hub header shows a 🌸 chip only when the user has CAFE points. The real admin.html in Chromium; Firestore stubbed.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/id="gs-user-cafe-box"[^>]*hidden/.test(html), 'the 🌸 chip is hidden by default');
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        const run = await page.evaluate(async () => {
            const writes = [], works = { w1: { kind: 'social' }, w2: {}, w3: { kind: 'social' }, w4: { kind: 'social', cafeBeriAwarded: true } };
            const reviews = [{ workId: 'w1', verdict: 'approve' }, { workId: 'w3', verdict: 'changes' }, { workId: 'w4', verdict: 'approve' }];
            const inc = n => ({ inc: n });
            window.firebase = { firestore: { FieldValue: { increment: inc } } };
            const q = (filters) => ({ where: (f, o, v) => q(filters.concat([[f, v]])), limit: () => q(filters),
                get: async () => { const hit = reviews.filter(r => filters.every(([f, v]) => (f === 'type' ? v === 'content_review' : r[f] === v))); return { empty: !hit.length }; } });
            db = { collection: n => Object.assign(q([]), { doc: id => ({
                get: async () => ({ exists: !!works[id], data: () => works[id] }),
                update: async d => { writes.push([n, id, d]); } }) }), batch: () => ({}) };
            window.stageSubmissionMirror = async () => false; window.submissionReviewedFields = () => ({}); window.showToast = () => {};
            window.prompt = () => '0.5';
            for (const [id, uid] of [['w1', 'uA'], ['w2', 'uB'], ['w3', 'uC'], ['w4', 'uD']]) await svSc(id, uid);
            return writes.filter(w => w[0] !== 'works' || w[2].cafeBeriAwarded);
        });
        assert.deepEqual(run, [
            ['users', 'uA', { cafePts: { inc: 0.5 } }], ['users', 'uA', { cafeBeri: { inc: 1 } }], ['works', 'w1', { cafeBeriAwarded: true }],
            ['users', 'uB', { score: { inc: 0.5 } }],
            ['users', 'uC', { cafePts: { inc: 0.5 } }],
            ['users', 'uD', { cafePts: { inc: 0.5 } }]
        ], 'a social work → cafePts; with an Ⓐ (approve) +1 cafeBeri once; changes-only / already awarded → no Beri; an ordinary work → score');
        // User Hub chip
        const chip = await page.evaluate(() => {
            const box = document.getElementById('gs-user-cafe-box'), set = u => { const el = document.getElementById('gs-user-score'); el.innerText = parseFloat((u.score || 0).toFixed(2)); const cp = parseFloat((u.cafePts || 0).toFixed(2)); box.hidden = !cp; document.getElementById('gs-user-cafe').innerText = cp; return [box.hidden, document.getElementById('gs-user-cafe').innerText]; };
            return [set({ score: 12.1 }), set({ score: 12.1, cafePts: 4.5 })];
        });
        assert.deepEqual(chip, [[true, '0'], [false, '4.5']], 'chip only with CAFE points');
        assert.ok(/\{ const _cp = parseFloat\(\(user\?\.cafePts \|\| 0\)\.toFixed\(2\)\)/.test(html), 'the real User Hub code paints it');
        assert.deepEqual(errs.filter(e => /svSc|cafePts/.test(e)), [], 'no page errors from this feature');
        console.log('PASS: CAFE points — a content post scores into users.cafePts, other work into users.score; the User Hub shows 🌸 only when there are CAFE points');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
