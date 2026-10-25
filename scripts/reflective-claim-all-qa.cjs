// V101.208: claimReflectivePoints takes one id OR many — ONE batch: a log update + a checkin_logs row per entry, a single score increment for the sum.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const i = html.indexOf('async function claimReflectivePoints(idOrIds) {'); assert.ok(i > 0, 'new signature');
const src = html.slice(i, html.indexOf('function checkExpiry()', i));

const run = async (ids, logs) => {
    const ops = [], alerts = []; let committed = 0;
    const batch = { update: (r, d) => ops.push(['update', r.p, d]), set: (r, d) => ops.push(['set', r.p, d]), commit: async () => { committed++; } };
    const db = { batch: () => batch, collection: c => ({ doc: id => ({ p: c + '/' + (id || 'auto') }) }) };
    const ctx = { db, userId: 'U1', alert: m => alerts.push(m), document: { getElementById: () => null }, console,
        firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS', increment: n => ({ inc: n }) } } }, window: { myReflectiveLogsCache: logs } };
    vm.createContext(ctx); vm.runInContext(src + '; this.claim = claimReflectivePoints;', ctx);
    await ctx.claim(ids);
    return { ops, alerts, committed };
};
const L = (id, b, o) => Object.assign({ id, adminBonus: b, adminComment: 'nice', pointsClaimed: false }, o || {});
(async () => {
    // one id (the per-entry 🎁 รับ pill and the modal button)
    let r = await run('a', [L('a', 0.2), L('b', 0.1)]);
    assert.equal(r.committed, 1);
    assert.deepEqual([...r.ops.map(o => o[0] + ' ' + o[1])], ['update reflective_logs/a', 'set checkin_logs/auto', 'update users/U1']);
    assert.deepEqual(JSON.parse(JSON.stringify(r.ops[2][2])), { score: { inc: 0.2 } }); assert.equal(r.ops[0][2].pointsClaimed, true); assert.equal(r.ops[1][2].amount, 0.2);
    assert.deepEqual([...r.alerts], ['✨ +0.2 points claimed']);
    // many (รับทั้งหมด): one batch, the score bumped ONCE by the sum (no float drift), each entry marked + logged
    r = await run(['a', 'b', 'c'], [L('a', 0.2), L('b', 0.1), L('c', 0.1)]);
    assert.equal(r.committed, 1);
    assert.deepEqual(r.ops.filter(o => o[1] === 'users/U1').map(o => JSON.parse(JSON.stringify(o[2]))), [{ score: { inc: 0.4 } }], 'one increment for 0.2 + 0.1 + 0.1');
    assert.equal(r.ops.filter(o => o[1].startsWith('reflective_logs/')).length, 3); assert.equal(r.ops.filter(o => o[1].startsWith('checkin_logs/')).length, 3);
    assert.deepEqual([...r.alerts], ['✨ +0.4 points claimed']);
    // an already-collected entry is skipped, never counted twice; nothing left → says so and writes nothing
    r = await run(['a', 'b'], [L('a', 0.2, { pointsClaimed: true }), L('b', 0.1)]);
    assert.deepEqual(r.ops.filter(o => o[1] === 'users/U1').map(o => JSON.parse(JSON.stringify(o[2]))), [{ score: { inc: 0.1 } }]);
    r = await run('a', [L('a', 0.2, { pointsClaimed: true })]);
    assert.deepEqual([r.committed, [...r.alerts]], [0, ['Points already claimed.']]);
    // an unknown id → refresh message, nothing written
    r = await run(['zzz'], [L('a', 0.2)]);
    assert.deepEqual([r.committed, r.alerts.length], [0, 1]);
    console.log('PASS: claimReflectivePoints — one id or many in ONE batch, a single score increment for the sum, claimed entries skipped, nothing written when nothing is left.');
})().catch(e => { console.error(e); process.exitCode = 1; });
