// V101.292 (owner): Info ▸ Persona — 0.1 to the score for each field that holds something (Health not paid), nothing said on screen;
// emptying a field takes its 0.1 back; only registered interns. The REAL index.html (its own infoPointsDelta / infoFieldPoints), fake Firestore.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
      const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
      window.__fake = { collection: () => ({ doc: () => ({}), where: () => chain }), runTransaction: f => window.__tx(f) };
      window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => window.__fake, { FieldValue }) : chain, apply: () => chain });
    });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof infoFieldPoints === 'function');
    const o = await page.evaluate(async () => {
      let doc = {};
      const ups = [];
      window.__tx = async f => f({ get: async () => ({ exists: true, data: () => JSON.parse(JSON.stringify(doc)) }), update: (r, v) => { ups.push(JSON.parse(JSON.stringify(v))); doc.infoPts = v.infoPts; } });
      userId = 'U1'; window.myRegistered = true;
      const out = {};
      out.fields = INFO_POINT_FIELDS.length;
      // 3 filled + health (not paid) + a blank-only one
      doc = { firstName: 'สมชาย', lastName: 'ใจดี', 'socials': { line: 'somchai', facebook: '  ' }, health: { allergies: 'Penicillin' }, nickName: '' };
      await infoFieldPoints(); out.first = ups.slice();
      ups.length = 0; await infoFieldPoints(); out.again = ups.length;   // nothing changed → no write
      doc.lastName = ''; doc.startDate = '2026-09-01'; doc.endDate = '2027-03-31'; doc.socials.instagram = 'x';
      await infoFieldPoints(); out.second = ups.slice();   // +3 −1
      ups.length = 0; doc = { infoPts: doc.infoPts };     // everything emptied
      await infoFieldPoints(); out.cleared = ups.slice();
      ups.length = 0; window.myRegistered = false; doc = { firstName: 'a' };
      await infoFieldPoints(); out.unreg = ups.length;
      return out;
    });
    assert.equal(o.fields, 27, '27 fields (Health left out)');
    assert.deepEqual(o.first, [{ infoPts: { firstName: true, lastName: true, 'socials.line': true }, score: { inc: 0.3 } }], '3 filled → +0.3; health / blanks not paid');
    assert.equal(o.again, 0, 'Save again with nothing new: no write');
    assert.deepEqual(o.second[0].score, { inc: 0.2 }, '+3 −1 → +0.2');
    assert.deepEqual(Object.keys(o.second[0].infoPts).sort(), ['endDate', 'firstName', 'socials.instagram', 'socials.line', 'startDate']);
    assert.deepEqual(o.cleared, [{ infoPts: {}, score: { inc: -0.5 } }], 'all emptied → every 0.1 back');
    assert.equal(o.unreg, 0, 'not registered: nothing written');
    assert.deepEqual(errors.filter(e => /info|INFO_POINT/.test(e)), []);
    console.log('PASS: Info fields — +0.1 per filled field (27, no Health), −0.1 when emptied, no write when nothing changed, registered only');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
