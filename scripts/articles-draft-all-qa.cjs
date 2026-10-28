// V102.375 (owner's pick 3): 🩺 Draft all beside 🌐 Translate all — a Disease Codex draft (dxaDraftFromArticle) from every saved article in
// neither Codex and linked to neither, one at a time, press again to stop; skips (a refused name) do not stop the run. The REAL admin.html +
// articles-admin.js with a fake draft function and a fake Firestore (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const aj = fs.readFileSync('public/articles-admin.js', 'utf8');
assert.ok(aj.includes("var DA = { busy: false, stop: false, prog: '' };") && aj.includes('function daJobs() {') && aj.includes("trAllHtml() + daAllHtml() +"), 'Draft all sits beside Translate all');

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
      const toasts = []; window.showToast = m => toasts.push(m);
      window.db = { collection: () => ({ get: async () => ({ docs: [] }), doc: () => ({ update: async () => {} }) }) };
      const S = Articles._S; S.loaded = true; S.loading = false;
      const now = Date.now(), D = 864e5;
      const art = (id, en, body, o) => Object.assign({ id, title: { en }, body: { en: body }, cover: { emoji: '📰' }, status: 'scheduled', startAt: now - D, endAt: now + 9 * D, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' }, o || {});
      S.list = [
        art('a1', 'Hordeolum: the 3-day rule 👁️', 'Warm compress.'),
        art('a2', 'Acromegaly', 'GH.', { dx: { draftId: 'd1', publishedId: '', name: 'Acromegaly' } }),
        art('a3', 'Red eye', 'Causes.', { links: [{ kind: 'disease', id: 'h1', label: 'Hordeolum' }] }),
        art('a4', 'Dengue (part 2)', 'Fever.'),
        art('a5', 'Elobixibat', 'IBAT.', { links: [{ kind: 'codex', id: 'e1', label: 'Elobixibat' }] }),
        art('a6', '', 'No title.'),
        art('a7', 'Salbutamol tips', 'MDI.', { dc: { draftId: 'c1', publishedId: '', name: 'Salbutamol' } })
      ];
      const out = {};
      out.names = [Articles._codexNameOf(S.list[0]), Articles._codexNameOf(S.list[3]), Articles._codexNameOf(S.list[5])];
      out.jobs = Articles._daJobs().map(a => a.id);
      Articles.open();
      const btn = () => q('.art-da-all');
      const hd = q('.art-h').innerHTML;
      out.head = [!!btn(), btn().textContent.replace(/\s+/g, ' ').trim(), btn().disabled, hd.indexOf('art-tr-all') < hd.indexOf('art-da-all') && hd.indexOf('art-da-all') < hd.indexOf('art-new'), btn().getAttribute('title')];
      // V102.489: the two buttons sit side by side (the shared .art-tr-all auto margin used to float Translate all to the middle)
      { const t = q('.art-tr-all:not(.art-da-all)').getBoundingClientRect(), d = btn().getBoundingClientRect(); out.gap = [Math.round(d.left - t.right), Math.round(t.height) === Math.round(d.height)]; }
      // cancel at the confirm → nothing
      const calls = []; window.dxaDraftFromArticle = async a => { calls.push(a.name); await wait(20); if (a.name === 'Dengue') throw new Error('"Dengue" is already in the Codex'); return { draftId: 'dx_' + a.id, model: 'm' }; };
      window.confirm = () => false; await Articles.draftAll(); out.cancel = [calls.length];
      // run: a1 drafted, a4 refused (skipped), order = list order, progress label while busy
      window.confirm = () => true;
      let during = null; const p = Articles.draftAll(); await wait(5); during = [btn().textContent.replace(/\s+/g, ' ').trim(), btn().classList.contains('busy')]; await p;
      out.run = [calls.slice(), during, S.list[0].dx, S.list[3].dx || null, toasts[toasts.length - 1], btn().textContent.replace(/\s+/g, ' ').trim(), Articles._daJobs().map(a => a.id)];
      // the open editor follows: a1 drafted while open → its chip says pending, not dirty
      S.list[0].dx = null; Articles.edit('a1'); const p2 = Articles.draftAll(); await p2;
      out.editor = [S.cur.dx && S.cur.dx.draftId, JSON.stringify(S.cur) === S.base, (qa('.art-c.art-add').find(b => /🩺/.test(b.textContent)) || {}).textContent];
      Articles.open();
      // press again while running = stop after the current one
      S.list[0].dx = null; calls.length = 0; let stopped = null;
      window.dxaDraftFromArticle = async a => { calls.push(a.name); if (calls.length === 1) { Articles.draftAll(); stopped = btn().textContent.replace(/\s+/g, ' ').trim(); } await wait(20); return { draftId: 'dx_' + a.id, model: 'm' }; };
      await Articles.draftAll(); out.stop = [calls, /stopped/.test(toasts[toasts.length - 1]), toasts[toasts.length - 1], stopped];
      // nothing left → disabled
      S.list[3].links = [{ kind: 'disease', id: 'x', label: 'Dengue' }]; Articles.open(); out.none = [btn().textContent.replace(/\s+/g, ' ').trim(), btn().disabled, btn().getAttribute('title')];
      Articles.close();
      return out;
    });
    assert.deepEqual(r.names, ['Hordeolum', 'Dengue', ''], 'the bare topic: before ":" / "(", emoji stripped: ' + JSON.stringify(r.names));
    assert.deepEqual(r.jobs, ['a1', 'a4'], 'candidates: saved + titled + in neither Codex + linked to neither (dx, 🩺 link, 💊 link, dc, no title are skipped): ' + JSON.stringify(r.jobs));
    assert.deepEqual(r.head.slice(0, 4), [true, '🩺 Draft all 2', false, true], 'the button sits between Translate all and ＋ New with the count: ' + JSON.stringify(r.head));
    assert.match(r.head[4], /^Draft a Disease Codex entry from each of the 2 article\(s\)/);
    assert.ok(r.gap[0] >= 0 && r.gap[0] <= 20, 'Translate all and Draft all are next to each other (flex gap 10 + margin 8): ' + JSON.stringify(r.gap));
    assert.deepEqual(r.cancel, [0], 'cancelling the confirm drafts nothing');
    assert.deepEqual(r.run[0], ['Hordeolum', 'Dengue'], 'one at a time, list order: ' + JSON.stringify(r.run));
    assert.deepEqual(r.run[1], ['🩺 1/2 · stop', true], 'progress label while busy: ' + JSON.stringify(r.run[1]));
    assert.deepEqual([r.run[2], r.run[3]], [{ draftId: 'dx_a1', publishedId: '', name: 'Hordeolum' }, null], 'the drafted article remembers its draft; the refused one does not');
    assert.equal(r.run[4], '🩺 Drafted 1/2 (1 skipped) — approve them in Disease Codex ▸ Pending Drafts', 'the toast: ' + r.run[4]);
    assert.deepEqual([r.run[5], r.run[6]], ['🩺 Draft all 1', ['a4']], 'afterwards only the refused one is still a candidate');
    assert.deepEqual(r.editor, ['dx_a1', true, '🩺 Codex draft pending'], 'an open editor follows the run (dx set, not dirty, chip pending): ' + JSON.stringify(r.editor));
    assert.deepEqual([r.stop[0], r.stop[1], r.stop[3]], [['Hordeolum'], true, '🩺 1/2 · stop'], 'pressing again stops after the current one: ' + JSON.stringify(r.stop));
    assert.deepEqual(r.none, ['🩺 Draft all', true, 'Every article is already in a Codex or linked to one'], 'nothing left → disabled with a reason');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: 🩺 Draft all — candidates in neither Codex, confirm, one at a time in list order with a progress label, refusals skipped, the open editor follows, press again to stop, disabled when nothing is left');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
