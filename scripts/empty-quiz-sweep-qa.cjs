// V102.275: blank quizzes older than 12 h are deleted once per admin session, with an admin_logs entry. The REAL code block is cut out of public/admin.html and run in a vm
// with a fake Firestore: what is deleted (blank + 12 h+), what is NOT (config docs "--…", a title / questions / any content, younger than 12 h, no createdAt, already taken), the log goes
// before the delete (no log → no delete), the sweep runs once, and the snapshot handler calls it.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
const a = html.indexOf('const EMPTY_QUIZ_MAX_AGE_MS'), b = html.indexOf('db.collection("quizzes").onSnapshot(s => {\n                quizzesData');
assert.ok(a > 0 && b > a, 'sweep block found');
assert.ok(/renderQuizzes\(\);[\s\S]{0,200}window\.sweepEmptyQuizzes\(\);/.test(html.slice(b, b + 500)), 'the quizzes snapshot calls the sweep');
const code = html.slice(a, b);
const H = 3600 * 1000, NOW = Date.UTC(2026, 9, 17, 12), ts = ms => ({ toMillis: () => ms });
function run(docs, { attempts = [], failLog = false } = {}) {
  const calls = [];
  const win = {};
  const db = { collection: name => ({
    where: (f, op, v) => ({ limit: () => ({ get: async () => ({ empty: !attempts.includes(v) }) }) }),
    add: async d => { if (failLog) throw new Error('rules'); calls.push(['log', d]); },
    doc: id => ({ delete: async () => { calls.push(['delete', id]); } })
  }) };
  const ctx = { window: win, db, quizzesData: docs, firebase: { auth: () => ({ currentUser: { uid: 'u', email: 'a@x' } }), firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }, console: { info() {}, warn() {} }, Date: { now: () => NOW } };
  vm.runInNewContext(code, ctx);
  return { win, calls, go: () => win.sweepEmptyQuizzes() };
}
const old = ts(NOW - 13 * H);
const docs = [
  { id: 'blankOld', title: '', createdAt: old },
  { id: 'blankNoField', createdAt: old, isActive: false, isTemplate: true },
  { id: '--divisions-config--', createdAt: old },
  { id: '--group-settings--', createdAt: old },
  { id: 'titled', title: 'Metformin', createdAt: old },
  { id: 'short', shortTitle: 'M', createdAt: old },
  { id: 'hasQ', questions: [{ q: 1 }], createdAt: old },
  { id: 'hasMat', materials: [{ url: 'x' }], createdAt: old },
  { id: 'hasCover', coverUrl: 'https://x/y.png', createdAt: old },
  { id: 'hasUsers', assignedUsers: ['u1'], createdAt: old },
  { id: 'young', createdAt: ts(NOW - 11 * H) },
  { id: 'noCreated' },
  { id: 'pendingTs', createdAt: null },
  { id: 'taken', createdAt: old }
];
(async () => {
  const r = run(docs, { attempts: ['taken'] });
  const flags = Object.fromEntries(docs.map(d => [d.id, r.win.isEmptyQuizDoc(d, NOW)]));
  assert.deepEqual(Object.keys(flags).filter(k => flags[k]).sort(), ['blankNoField', 'blankOld', 'taken'].sort(), 'only blank + 12 h+ docs qualify: ' + JSON.stringify(flags));
  await r.go();
  assert.deepEqual(r.calls.filter(c => c[0] === 'delete').map(c => c[1]).sort(), ['blankNoField', 'blankOld'], 'deleted: the two blank ones; the taken one stays');
  assert.deepEqual(r.calls.map(c => c[0]), ['log', 'delete', 'log', 'delete'], 'each log comes right before its delete');
  const log = r.calls[0][1];
  assert.equal(log.action, 'quiz_auto_deleted_empty'); assert.equal(log.details.quizId, 'blankOld'); assert.equal(log.createdByEmail, 'a@x'); assert.ok(log.timestamp === 'TS' && log.reason);
  const n = r.calls.length; await r.go(); assert.equal(r.calls.length, n, 'runs once per session');
  const r2 = run([{ id: 'blankOld', createdAt: old }], { failLog: true }); await r2.go();
  assert.deepEqual(r2.calls, [], 'log failed → nothing deleted');
  const r3 = run([{ id: 'blankOld', createdAt: old }]); assert.equal(r3.win.isEmptyQuizDoc({ id: 'blankOld', createdAt: ts(NOW - 12 * H) }, NOW), true, 'exactly 12 h counts');
  console.log('empty-quiz-sweep-qa: PASS');
})().catch(e => { console.error(e); process.exit(1); });
