// V101.68: opening the intern app checks the intern in. Source guards + the REAL tryDailyCheckin() run against a stub
// Firestore transaction for each source ('open' / manual / 'activity') — no browser.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return html.slice(i, j); };

// trigger sits in the users/{uid} listener, after myCheckin is read, guarded on preview / once per load / not today
const listener = slice('                    myCheckin = {\n                        currentStreak: da.checkinCurrentStreak || 0,', '                    // V95.46: total check-in counter');
assert.ok(listener.includes("if (!isPreview && !window._autoCheckinTried && myCheckin.lastDate !== getBangkokDateTimeParts().dateKey) {"), 'guards: not Preview, once per page load, not already today');
assert.ok(listener.includes("window._autoCheckinTried = true;\n                        tryDailyCheckin('open');"), "fires tryDailyCheckin('open') exactly once");
assert.equal((html.match(/tryDailyCheckin\('open'\)/g) || []).length, 1, 'one auto caller');

// the function itself
const fnSrc = slice('        async function tryDailyCheckin(source) {', '        function collectReflectiveMetrics(logs) {');
assert.ok(fnSrc.includes("const btn = (source == null || source === 'manual') ? document.getElementById('daily-checkin-btn') : null;"), "'open' never touches the chip");
assert.ok(fnSrc.includes("source: source === 'open' ? 'open' : (isManual ? 'manual' : 'activity')"), "checkin_logs.source = 'open'");
assert.ok(fnSrc.includes("if (source === 'open') showToast("), 'toast only for the auto path');

(async () => {
    // run the real function three times against a stub transaction
    const runs = [];
    const mk = (exists) => {
        const ctx = {
            userId: 'u1', userProfile: { displayName: 'Joey' },
            CHECKIN_DAILY_AMOUNT: 0.01, myCheckin: { lastDate: '' }, schActivityDays: new Set(), toasts: [], buttonTouched: false,
            document: { getElementById: id => id === 'daily-checkin-btn' ? { set disabled(v) { ctx.buttonTouched = true; }, set textContent(v) { ctx.buttonTouched = true; } } : null },
            ensureFirebaseAuthReady: async () => ({ uid: 'u1' }),
            getBangkokDateTimeParts: (d) => ({ dateKey: (d ? '2026-10-07' : '2026-10-08') }),
            renderDailyCheckinCard: () => {}, showToast: m => ctx.toasts.push(m), console,
            firebase: { firestore: { FieldValue: { serverTimestamp: () => 'ts', increment: n => ({ inc: n }) } } },
            db: { collection: name => ({ doc: id => ({ name, id }) }), runTransaction: async fn => fn({
                get: async ref => ref.name === 'checkin_logs' ? { exists } : { exists: true, data: () => ({ checkinLastDate: '2026-10-07', checkinCurrentStreak: 4, checkinBestStreak: 9 }) },
                set: (ref, data) => { runs.push(data); }
            }) }
        };
        return ctx;
    };
    for (const [source, wantSource, wantButton] of [['open', 'open', false], [undefined, 'manual', true], ['activity', 'activity', false]]) {
        runs.length = 0;
        const ctx = mk(false);
        vm.createContext(ctx);
        vm.runInContext(fnSrc + '\n;this.__fn = tryDailyCheckin;', ctx);
        await ctx.__fn(source);
        const log = runs.find(r => r.type === 'daily_checkin');
        assert.ok(log, source + ': log written');
        assert.equal(log.source, wantSource, source + ': source');
        assert.equal(log.streak, 5, source + ': yesterday 4 → 5');
        assert.equal(ctx.buttonTouched, wantButton, source + ': chip touched = ' + wantButton);
        assert.equal(ctx.toasts.length, source === 'open' ? 1 : 0, source + ': toast only on open');
        assert.equal(ctx.schActivityDays.has('2026-10-08'), source === 'activity', source + ': only a submission feeds the engagement streak');
    }
    // already checked in today → the transaction returns 'already', nothing written, no toast
    runs.length = 0;
    const ctx = mk(true); vm.createContext(ctx); vm.runInContext(fnSrc + '\n;this.__fn = tryDailyCheckin;', ctx);
    await ctx.__fn('open');
    assert.equal(runs.length, 0, 'second open of the day writes nothing'); assert.equal(ctx.toasts.length, 0);
    console.log("PASS: auto check-in on open — listener guard (not Preview, once per load, not today), 'open' logs source=open, toasts once, never touches the chip or the engagement streak; manual/activity unchanged; already-today is a no-op");
})().catch(e => { console.error(e); process.exit(1); });
