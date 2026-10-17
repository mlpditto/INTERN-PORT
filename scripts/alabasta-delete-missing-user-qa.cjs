// Alabasta ▸ Bulk Delete used to fail completely ("No document to update: …/users/U5c7…") when ONE selected case belonged to a userId whose users/{id} document no longer
// exists: batch.update() on a missing document fails the whole batch. V102.273: points are reverted only where the user exists; the cases are deleted either way and the
// toast says how many users were gone. The REAL bulkAlabastaDelete in the real admin.html with a fake Firestore batch; the single-case path is checked in the source.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/const userAlive = bonus > 0 && caseItem\.userId \? \(await alabastaExistingUsers\(\[caseItem\.userId\]\)\)\.has\(caseItem\.userId\) : false;\s*\n\s*if \(bonus > 0 && caseItem\.userId && userAlive\) \{/.test(html), 'the single-case delete checks the user too');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { increment: n => ({ inc: n }), serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => typeof bulkAlabastaDelete === 'function');
    const run = async (cases, existing) => page.evaluate(async ({ cases, existing }) => {
      const ops = []; let commits = 0, toast = '', alerts = [];
      const ref = (c, id) => ({ c, id });
      window.db = { collection: c => ({ doc: id => ({ _r: ref(c, id), get: async () => ({ exists: c === 'users' ? existing.includes(id) : true }) }) }), batch: () => ({ delete: r => ops.push(['delete', r._r.c, r._r.id]), update: (r, v) => { if (r._r.c === 'users' && !existing.includes(r._r.id)) throw new Error('No document to update: users/' + r._r.id); ops.push(['update', r._r.c, r._r.id, v]); }, commit: async () => { commits++; } }) };
      db = window.db;
      window.confirm = () => true; window.alert = m => alerts.push(m); window.showToast = m => { toast = m; };
      window.stageSubmissionMirrorDelete = async () => 0; window.renderAlabastaCases = () => {}; window.clearAlabastaSelection = () => {};
      casesData = cases; window.alabastaSelectedIds = new Set(cases.map(c => c.id));
      await bulkAlabastaDelete();
      return { ops, commits, toast, alerts };
    }, { cases, existing });
    const C = (id, userId, adminBonus) => ({ id, userId, adminBonus });
    // 1 · a gone user in the selection no longer breaks the delete
    let r = await run([C('c1', 'U_alive', 0.5), C('c2', 'U_gone', 0.6), C('c3', 'U_alive', 0)], ['U_alive']);
    assert.deepEqual(r.alerts, [], 'no error: ' + r.alerts); assert.equal(r.commits, 1, 'one batch commit');
    assert.deepEqual(r.ops.filter(o => o[0] === 'delete').map(o => o[2]).sort(), ['c1', 'c2', 'c3'], 'all three cases are deleted');
    assert.deepEqual(r.ops.filter(o => o[0] === 'update').map(o => [o[2], o[3].score.inc]), [['U_alive', -0.5]], 'points are reverted only for the user that exists');
    assert.match(r.toast, /reverted 0\.50 pts/); assert.match(r.toast, /1 user\(s\) no longer exist — no points to revert/);
    // 2 · every user exists → as before
    r = await run([C('c1', 'U_alive', 0.5), C('c2', 'U_alive', 0.25)], ['U_alive']);
    assert.deepEqual(r.ops.filter(o => o[0] === 'update').map(o => o[3].score.inc), [-0.5, -0.25]); assert.match(r.toast, /reverted 0\.75 pts/); assert.ok(!/no longer exist/.test(r.toast));
    // 3 · only gone users → the cases still go, nothing is reverted
    r = await run([C('c1', 'U_gone', 0.5)], []);
    assert.deepEqual(r.alerts, []); assert.equal(r.ops.filter(o => o[0] === 'update').length, 0); assert.ok(r.ops.some(o => o[0] === 'delete' && o[2] === 'c1'));
    assert.ok(!/reverted/.test(r.toast) && /1 user\(s\) no longer exist/.test(r.toast), 'toast: ' + r.toast);
    // 4 · no bonus at all → no user reads or writes
    r = await run([C('c1', 'U_gone', 0)], []); assert.equal(r.ops.filter(o => o[0] === 'update').length, 0); assert.ok(!/no longer exist/.test(r.toast));
    console.log('PASS: Alabasta bulk delete — a case of a vanished user no longer breaks the whole batch (cases deleted, points reverted only where the user exists, toast says how many were gone)');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
