// V101.175: "Read denied for quest submissions listener" toast in desktop Firefox, now and then; a reload clears it.
// The REAL public/index.html (file://, network blocked, Firebase stubbed). Firebase Auth has no user when the
// quest_submissions listener attaches (sign-in still restoring, or a short gap while the session changes), so the
// first onSnapshot fails with permission-denied; the user arrives a moment later.
// 1. auth late → the listener attaches again once there is a user: data loads, no toast.
// 2. a user is there and the read is still denied (a real rule denial) → one retry, then the toast, as before.
// 3. no user ever → the toast, as before.
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const TOAST = /Read denied for quest submissions listener/;

async function open(browser, mode) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((mode) => {
        const authListeners = new Set();
        const auth = {
            currentUser: null,
            onAuthStateChanged(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
            signInAnonymously: () => Promise.reject(new Error('stub: offline')),
        };
        window.__subListens = 0;
        window.__authArrives = () => { auth.currentUser = { uid: 'anon1', isAnonymous: true }; authListeners.forEach(cb => cb(auth.currentUser)); };
        const snap = (docs) => ({ docs, empty: !docs.length, size: docs.length, forEach: f => docs.forEach(f), docChanges: () => [] });
        const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
        const query = (name) => {
            const q = {
                where: () => q, orderBy: () => q, limit: () => q,
                get: () => Promise.resolve(snap([])),
                doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }),
                onSnapshot(ok, fail) {
                    if (name !== 'quest_submissions') return () => {};
                    window.__subListens++;
                    const allowed = auth.currentUser && mode !== 'rule-denies';
                    setTimeout(() => allowed
                        ? ok(snap([{ id: 's1', data: () => ({ questId: 'q1', userId: 'U1', status: 'approved' }) }]))
                        : fail(denied()), 20);
                    return () => {};
                },
            };
            return q;
        };
        window.firebase = {
            auth: () => auth,
            functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }),
            firestore: Object.assign(() => ({ collection: query }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }),
        };
    }, mode);
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.evaluate((mode) => {
        window.userId = 'U1'; userId = 'U1';
        mySubmissionsCache = {};
        const toast = document.getElementById('toast'); toast.innerHTML = ''; toast.className = '';
        window.__toasts = [];
        const show = showToast; showToast = (m) => { window.__toasts.push(m); return show(m); };
        if (mode === 'rule-denies') window.__authArrives();
        loadMySubmissions();
        if (mode === 'late') setTimeout(() => window.__authArrives(), 400);
    }, mode);
    await page.waitForTimeout(mode === 'never' ? 12000 : 1500);
    const out = await page.evaluate(() => ({ toasts: window.__toasts, listens: window.__subListens, cache: Object.keys(mySubmissionsCache) }));
    await ctx.close();
    return { ...out, errors };
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        let r = await open(browser, 'late');
        assert.equal(r.toasts.filter(t => TOAST.test(t)).length, 0, 'auth late → no "Read denied" toast: ' + JSON.stringify(r.toasts));
        assert.deepEqual(r.cache, ['q1'], 'auth late → the listener attaches again and the submission loads');
        assert.equal(r.listens, 2, 'one retry: ' + r.listens);
        assert.deepEqual(r.errors, [], 'no page errors: ' + r.errors.join(' | '));

        r = await open(browser, 'rule-denies');
        assert.equal(r.toasts.filter(t => TOAST.test(t)).length, 1, 'a real denial still shows the toast once: ' + JSON.stringify(r.toasts));
        assert.equal(r.listens, 2, 'retried once, not in a loop: ' + r.listens);
        assert.deepEqual(r.errors, [], 'no page errors: ' + r.errors.join(' | '));

        r = await open(browser, 'never');
        assert.equal(r.toasts.filter(t => TOAST.test(t)).length, 1, 'no user ever → the toast: ' + JSON.stringify(r.toasts));
        assert.equal(r.listens, 1, 'no user → nothing to retry with: ' + r.listens);
        assert.deepEqual(r.errors, [], 'no page errors: ' + r.errors.join(' | '));
        console.log('PASS listener-auth-race-qa');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
