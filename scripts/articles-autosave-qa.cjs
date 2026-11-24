// V102.701 (owner 2026-11-24 "ปรับให้ auto save") — the 📰 Articles editor saves a DRAFT by itself 2 s after the last edit.
// REAL admin.html + articles-admin.js, a stub Firestore that records writes. Proves: typing a title in ＋ New makes ONE add() after
// the pause, as a draft (never scheduled), with no toast and the caret still in the field; a burst of typing = one update(); a draft
// without a title is not saved and the bar says why; a chip change (render path) also auto-saves; a scheduled article is NOT
// auto-saved ("● Unsaved" until 💾); closing / opening another article saves a dirty draft at once; a failed auto-save says
// "⚠️ Not saved · tap Save draft"; ✨ next episode no longer stops a dirty draft with "Save this episode first".
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && document.readyState === 'complete');
    await page.evaluate(() => {
      window.__w = []; window.__fail = false; window.__toasts = [];
      window.showToast = (t) => window.__toasts.push(t);
      window.db = { collection: () => ({
        get: async () => ({ docs: [] }),
        add: async (v) => { if (window.__fail) throw new Error('offline'); window.__w.push(['add', v.status]); return { id: 'new1' }; },
        doc: (id) => ({ update: async (v) => { if (window.__fail) throw new Error('offline'); window.__w.push(['update', id, v.status]); }, delete: async () => {}, get: async () => ({ exists: false }) }) }) };
      db = window.db;
      const S = Articles._S, D = 864e5, now = Date.now();
      S.list = [{ id: 's1', title: { en: 'Scheduled one' }, body: { en: 'Body' }, cover: { emoji: '💊' }, status: 'scheduled', startAt: now + D, endAt: now + 9 * D, audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null },
        { id: 'd1', title: { en: 'Old draft' }, body: { en: 'Body' }, cover: { emoji: '📰' }, status: 'draft', startAt: now + D, endAt: now + 9 * D, audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null }];
      S.loaded = true; S.loading = false; Articles.open();
    });
    const bar = () => page.$eval('#art-stl .art-save', (e) => e.textContent).catch(() => '');
    const W = () => page.evaluate(() => window.__w.slice());

    // ＋ New: no title yet → nothing saved, the bar says why
    await page.evaluate(() => Articles.edit(null));
    await page.fill('#art-bodyta', 'Body first, no title');
    assert.match(await bar(), /Give it a title first/, 'the bar says why it cannot save');
    await page.waitForTimeout(2400);
    assert.deepEqual(await W(), [], 'a draft without a title is not saved');

    // a title → one add() after the pause, as a draft, quietly, caret kept
    await page.click('#art-title');
    await page.keyboard.type('Autosave test', { delay: 30 });
    assert.match(await bar(), /Unsaved · ⏳ auto-saves/);
    await page.waitForTimeout(2500);
    assert.deepEqual(await W(), [['add', 'draft']], 'one add, as a draft');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'art-title', 'the caret stays in the title');
    assert.match(await bar(), /^Saved/);
    assert.deepEqual(await page.evaluate(() => window.__toasts), [], 'no toast for an auto-save');
    assert.equal(await page.evaluate(() => Articles._S.cur.id), 'new1');
    assert.ok(!(await page.$eval('#art-btns', (e) => e.innerHTML)).includes('✓ Saved'), 'no button turns green for an auto-save');

    // a burst of typing in the body = one update
    await page.click('#art-bodyta');
    await page.keyboard.type(' more words', { delay: 40 });
    await page.waitForTimeout(2500);
    assert.deepEqual((await W()).slice(1), [['update', 'new1', 'draft']], 'one update after a burst');

    // a chip / render-path edit (tag) also saves
    await page.evaluate(() => { const S = Articles._S; S.cur.rerun = 'off'; Articles.modelPick(); Articles.modelPick(); });
    await page.waitForTimeout(2500);
    assert.equal((await W()).length, 3, 'an edit through render() auto-saves too');

    // close with a dirty draft → saved at once
    await page.fill('#art-bodyta', 'changed right before closing');
    await page.evaluate(() => Articles.close());
    await page.waitForTimeout(200);
    assert.deepEqual((await W())[3], ['update', 'new1', 'draft'], 'closing saves the draft at once');
    await page.evaluate(() => Articles.open());

    // opening another article saves the dirty one first, and does not mix their state
    await page.evaluate(() => Articles.edit('d1'));
    await page.fill('#art-bodyta', 'draft d1 edited');
    await page.evaluate(() => Articles.edit('s1'));
    await page.waitForTimeout(200);
    assert.deepEqual((await W())[4], ['update', 'd1', 'draft'], 'opening another article saves the dirty draft');
    assert.equal(await page.evaluate(() => Articles._S.cur.id), 's1');
    assert.equal(await page.evaluate(() => JSON.stringify(Articles._S.cur) === Articles._S.base), true, 'the new article is clean');

    // a scheduled article is never auto-saved
    await page.fill('#art-bodyta', 'edit to a scheduled article');
    await page.waitForTimeout(2500);
    assert.equal((await W()).length, 5, 'scheduled: no auto-save');
    assert.equal(await bar(), '● Unsaved', 'scheduled: plain Unsaved, no auto-save promise');

    // a failed auto-save says so
    await page.evaluate(() => { window.__fail = true; Articles.edit('d1'); });
    await page.fill('#art-bodyta', 'this will fail');
    await page.waitForTimeout(2600);
    assert.match(await bar(), /Not saved · tap Save draft/, 'a failed auto-save is shown');
    await page.evaluate(() => { window.__fail = false; });

    // ✨ next episode: the old "save this episode first" stop is gone for a dirty draft (it saves, then goes on)
    const src = await page.evaluate(() => { const t = Articles.episode.toString(), i = t.indexOf('autoOk(a)'), j = t.indexOf('Save this episode first'); return i > 0 && j > i; });
    assert.ok(src, 'episode saves a dirty draft before the old stop');

    assert.deepEqual(errors.filter((e) => !/ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e)), [], 'no page errors: ' + errors);   // admin.html boot noise without Firebase, as in articles-editor-lean-qa
    console.log('articles-autosave-qa: OK — add once, quiet, caret kept, burst = 1 update, render path, close + switch flush, scheduled manual, failure shown');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
