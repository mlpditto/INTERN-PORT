// V102.186 — Quiz Insight reads a user's approved attempts from the in-memory quiz_attempts listener cache instead of
// re-querying Firestore on every open / window click. Runs the REAL helper from public/admin.html.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

const start = html.indexOf('async function hubApprovedAttemptsSnap(userId)');
assert.ok(start >= 0, 'helper exists');
let i = html.indexOf('{', start), b = 0, k = i;
for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
const helperSrc = html.slice(start, k + 1);

// renderQuizInsight goes through the helper and no longer queries on its own
const rq = html.indexOf('async function renderQuizInsight(userId)');
const rqBody = html.slice(rq, rq + 1500);
assert.ok(rqBody.includes('await hubApprovedAttemptsSnap(userId)'), 'renderQuizInsight uses the helper');
assert.ok(!rqBody.includes('db.collection("quiz_attempts")'), 'renderQuizInsight no longer queries Firestore itself');

(async () => {
    let queries = 0;
    const db = { collection: () => ({ where() { return this; }, get: async () => { queries++; return { docs: [], empty: true, fromQuery: true }; } }) };
    const ts = ms => ({ toMillis: () => ms });
    const cache = [
        { id: 'a1', userId: 'u1', status: 'approved', timestamp: ts(2), isQuiz: true },
        { id: 'a2', userId: 'u1', status: 'pending', timestamp: ts(3) },
        { id: 'a3', userId: 'u2', status: 'approved', timestamp: ts(4) },
        { id: 'a4', userId: 'u1', status: 'approved', timestamp: ts(1) }
    ];
    const ctx = vm.createContext({ db, quizAttemptsAllCache: cache });
    vm.runInContext(helperSrc, ctx);

    const snap = await ctx.hubApprovedAttemptsSnap('u1');
    assert.equal(queries, 0, 'no Firestore query while the listener cache is loaded');
    assert.equal(snap.empty, false);
    assert.deepEqual(snap.docs.map(d => d.id), ['a1', 'a4'], 'only this user, only approved');
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));   // exactly what renderQuizInsight does with it
    assert.equal(rows[0].timestamp.toMillis(), 2, 'attempt fields (Timestamp) survive');

    const none = await ctx.hubApprovedAttemptsSnap('nobody');
    assert.equal(none.empty, true, 'a user without approved attempts → empty (still no query)');
    assert.equal(queries, 0);

    // listener not delivered yet → fall back to the query
    ctx.quizAttemptsAllCache = [];
    const fb = await ctx.hubApprovedAttemptsSnap('u1');
    assert.equal(queries, 1, 'empty cache → one fallback query');
    assert.equal(fb.fromQuery, true);

    console.log('PASS: Quiz Insight reads approved attempts from the live cache (no query), filters user + status, falls back to the query only before the listener delivers');
})().catch(e => { console.error(e); process.exit(1); });
