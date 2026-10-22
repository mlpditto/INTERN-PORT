// V102.374 (owner's pick 4): after Save, an article whose title / body names a published disease (name, Thai name or a synonym of 4+
// characters) gets a "… is in the Disease Codex — link this article to it?" banner; Link adds the ＋ Disease link and saves again; "Not this
// one" is remembered for the session; no banner when the article already has a disease link or a Codex draft, or nothing matches.
// The REAL admin.html + articles-admin.js with a fake Firestore (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const aj = fs.readFileSync('public/articles-admin.js', 'utf8');
assert.ok(aj.includes('function findHint(a) {') && aj.includes('function hintHtml() {') && aj.includes("'<div id=\"art-warn\">' + hintHtml() +"), 'the hint is computed after Save and drawn in the warn slot');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      const writes = [], reads = []; window.showToast = () => {};
      window.adminApp = { auth: () => ({ currentUser: { uid: 'admin1', email: 'a@x.test' } }) };
      const DZ = [{ id: 'h1', data: () => ({ diseaseName: 'Hordeolum', thaiName: 'กุ้งยิง', icd10: 'H00.0', category: 'Ophthalmology', synonyms: ['Stye', 'External hordeolum'] }) }, { id: 'n1', data: () => ({ diseaseName: 'Neuropathic Pain', icd10: 'M79.2', category: 'Neurology', synonyms: ['Nerve pain'] }) }, { id: 'x1', data: () => ({ diseaseName: 'Flu', synonyms: ['Cold'] }) }];
      window.db = { collection: coll => ({ get: async () => { reads.push(coll); return { docs: coll === 'disease_codex' ? DZ : [] }; }, doc: id => ({ update: async d => { writes.push(['update', coll, id, JSON.parse(JSON.stringify(d))]); } }), add: async d => { writes.push(['add', coll, JSON.parse(JSON.stringify(d))]); return { id: 'new1' }; } }) };
      const S = Articles._S; S.loaded = true; S.loading = false; S.dz = null;
      const now = Date.now(), D = 864e5;
      const art = (id, en, body, o) => Object.assign({ id, title: { en }, body: { en: body }, cover: { emoji: '📰' }, status: 'scheduled', startAt: now - D, endAt: now + 9 * D, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' }, o || {});
      S.list = [art('a2', 'Hordeolum: the 3-day rule', 'Warm compress 10 min x 4/day.'), art('a3', 'Brucellosis', 'A zoonosis.'), art('a1', 'Acromegaly', 'GH excess.', { dx: { draftId: 'd1', publishedId: '', name: 'Acromegaly' } }), art('a4', 'Eyelid lumps', 'A stye is the common one; also chalazion.'), art('a5', 'Red eye', 'Many causes.', { links: [{ kind: 'disease', id: 'h1', label: 'Hordeolum · กุ้งยิง' }] }), art('a6', 'A cold day', 'Flu season tips; wash hands.'), art('a7', 'Scolding the cat', 'No disease here, just scolding.')];
      const out = {}, banner = () => q('#art-warn .art-hint');
      Articles.open(); Articles.edit('a2');
      out.before = [!!banner(), reads.length];
      await Articles.save(true); await wait(120);
      out.saved = [!!banner(), banner() && banner().textContent.replace(/\s+/g, ' ').trim(), reads.filter(c => c === 'disease_codex').length, S.hint && S.hint.term];
      // Link → the ＋ Disease link lands in the Links line and the article is saved again; the banner goes
      const w0 = writes.length; Articles.hintLink(); await wait(150);
      out.linked = [S.cur.links, writes.slice(w0).map(w => [w[0], w[2], w[3] && w[3].links]), !!banner(), qa('.art-lk').map(x => x.textContent.replace('✕', '').trim())];
      // a synonym match, then "Not this one" — remembered for the session
      Articles.edit('a4'); await Articles.save(true); await wait(120);
      out.syn = [banner() && banner().textContent.replace(/\s+/g, ' ').trim(), S.hint && S.hint.term];
      Articles.hintDismiss(); out.dismissed = [!!banner(), S.hintOff.a4];
      await Articles.save(true); await wait(120); out.dismissedAgain = !!banner();
      // no match · already linked · already drafted → no banner
      Articles.edit('a3'); await Articles.save(true); await wait(120); out.none = !!banner();
      Articles.edit('a5'); await Articles.save(true); await wait(120); out.linkedAlready = !!banner();
      Articles.edit('a1'); await Articles.save(true); await wait(120); out.drafted = !!banner();
      // a short term (< 4 chars) never matches, a longer one does
      Articles.edit('a6'); await Articles.save(true); await wait(120); out.short = [!!banner(), S.hint && S.hint.term];
      Articles.edit('a7'); await Articles.save(true); await wait(120); out.inside = !!banner();   // "cold" inside "scolding" is not a word
      out.reads = reads.filter(c => c === 'disease_codex').length;
      Articles.close();
      return out;
    });
    assert.deepEqual(r.before, [false, 0], 'nothing before a save');
    assert.deepEqual([r.saved[0], r.saved[2], r.saved[3]], [true, 1, 'Hordeolum'], 'after Save: the banner, one disease_codex read, the matched term: ' + JSON.stringify(r.saved));
    assert.match(r.saved[1], /^🩺 Saved · Hordeolum is in the Disease Codex \(H00\.0 · Ophthalmology\) — link this article to it\?Link 🩺Not this one$/, 'the banner text: ' + r.saved[1]);
    assert.deepEqual(r.linked[0], [{ kind: 'disease', id: 'h1', label: 'Hordeolum · กุ้งยิง' }], 'Link adds the ＋ Disease link');
    assert.deepEqual(r.linked[1], [['update', 'a2', [{ kind: 'disease', id: 'h1', label: 'Hordeolum · กุ้งยิง' }]]], 'and saves the article again with it: ' + JSON.stringify(r.linked[1]));
    assert.deepEqual([r.linked[2], r.linked[3]], [false, ['🩺 Hordeolum · กุ้งยิง']], 'banner gone, the link in the Links line');
    assert.deepEqual(r.syn, ['🩺 Saved · Hordeolum is in the Disease Codex (H00.0 · Ophthalmology) — link this article to it?Link 🩺Not this one', 'Stye'], 'a synonym matches: ' + JSON.stringify(r.syn));
    assert.deepEqual([r.dismissed, r.dismissedAgain], [[false, true], false], 'Not this one hides it and a later save does not bring it back');
    assert.deepEqual([r.none, r.linkedAlready, r.drafted], [false, false, false], 'no banner: no match · already linked · already drafted');
    assert.deepEqual(r.short, [true, 'Cold'], '"Flu" (3 chars) never matches; the 4-char synonym "Cold" matches the whole word in "A cold day": ' + JSON.stringify(r.short));
    assert.equal(r.inside, false, 'a Latin term inside another word does not match');
    assert.equal(r.reads, 1, 'the disease list is read once per session');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: link hint after Save — banner on a name / Thai name / synonym match, Link adds the ＋ Disease link and re-saves, Not this one is remembered, silent when linked, drafted or no match');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
