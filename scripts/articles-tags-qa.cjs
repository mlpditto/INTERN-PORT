// V102.382: 🏷 tags on Articles — article.tags[] (lowercase, de-duplicated, ≤ 8 × ≤ 24 chars), an editor chip field (⏎ / comma adds,
// ✕ removes, datalist suggestions = tags in use + this article's link names), rows show up to 3 chips (+n), tapping a chip filters the
// list (head shows "🏷 tag ✕", status counts follow). The REAL admin.html + articles-admin.js with a fake Firestore (nothing leaves the page).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8'), aj = fs.readFileSync('public/articles-admin.js', 'utf8');
assert.match(html, /<title>Nika Admin \(V102\.(?:38[2-9]|39\d|[4-9]\d\d)\)<\/title>/, 'admin V102.382+');
assert.match(html, /<script src="articles-admin\.js\?v=V102\.(?:38[2-9]|39\d|[4-9]\d\d)"><\/script>/, 'articles-admin.js cache-busted');
assert.ok(aj.includes('function tagsFieldHtml(a) {') && aj.includes('function rowTagsHtml(a) {') && aj.includes("tags: tagsOf(a.tags), rerun:"), 'tags field, row chips, toDoc');
assert.ok(fs.readFileSync('docs/features/articles.md', 'utf8').includes('`articles-tags-qa`'), 'the feature map names this script');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => { if (!/ServiceWorker|mermaid|reading 'auth'|db\.collection is not a function/.test(e.message)) errors.push(e.message); });
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => a } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof window.Articles.tag === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');
    const r = await page.evaluate(async () => {
      const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
      const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
      window.showToast = () => {};
      const writes = [];
      const now = Date.now(), D = 864e5;
      const docs = [
        { id: 'a1', d: { title: { en: 'Dengue fever' }, body: { en: 'x' }, cover: { emoji: '📰' }, status: 'scheduled', startAt: new Date(now - D), endAt: new Date(now + 9 * D), audience: { divisions: [], groups: [] }, links: [{ kind: 'disease', id: 'd1', label: 'Dengue' }], rerun: 'any', tags: ['Infection', ' fever ', 'infection', 'Red Flag', '#tropical'] } },
        { id: 'a2', d: { title: { en: 'Hordeolum' }, body: { en: 'x' }, cover: { emoji: '📰' }, status: 'draft', audience: { divisions: [], groups: [] }, links: [], rerun: 'any', tags: ['eye', 'infection', 'a', 'b', 'c'] } },
        { id: 'a3', d: { title: { en: 'No tags yet' }, body: { en: 'x' }, cover: { emoji: '📰' }, status: 'draft', audience: { divisions: [], groups: [] }, links: [], rerun: 'any' } }
      ];
      window.db = { collection: () => ({ get: async () => ({ docs: docs.map(x => ({ id: x.id, data: () => x.d })) }), doc: id => ({ update: async d => { writes.push(['update', id, d]); } }), add: async d => { writes.push(['add', d]); return { id: 'n1' }; }, where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) }) };
      const S = Articles._S; S.loaded = false; S.list = [];
      await Articles.load();
      const out = {};
      out.norm = [S.list.find(a => a.id === 'a1').tags, S.list.find(a => a.id === 'a3').tags, Articles._tagsOf(['x', 'x', '', 'a very long tag name that goes past twenty four', ...'defghij'.split('')])];
      Articles.open();
      const row = id => qa('#art-body .art-row').find(r => r.getAttribute('onclick').includes("'" + id + "'"));
      const chips = id => [...row(id).querySelectorAll('.art-tg')].map(c => c.textContent);
      out.rows = [chips('a1'), chips('a2'), chips('a3'), row('a2').querySelector('.art-tg.more').title];
      // tap a chip → filter + head chip + counts
      row('a1').querySelector('.art-tg').click();
      out.filtered = [S.tag, qa('#art-body .art-row').length, (q('.art-tagf') || {}).textContent, [...qa('#art-body .art-rail button')].map(b => b.textContent).slice(0, 2), qa('#art-body .art-tg.on').length];
      Articles.tag('infection');   // same tag again = clear
      out.cleared = [S.tag, qa('#art-body .art-row').length, !!q('.art-tagf')];
      Articles.tag('eye'); out.eye = [qa('#art-body .art-row').length]; q('.art-tagf').click(); out.eyeCleared = [S.tag, qa('#art-body .art-row').length];
      // editor: field, suggestions, add / drop
      Articles.edit('a1');
      const field = () => q('#art-body .art-tags');
      const mine = () => [...field().querySelectorAll('.art-lk.tag')].map(x => x.firstChild.textContent);
      const sug = () => [...q('#art-tag-dl').options].map(o => o.value);
      out.field = [mine(), sug(), field().previousElementSibling && field().previousElementSibling.id, !!field().nextElementSibling.querySelector('details, .art-sec, button')];
      const input = q('#art-tag-in'); input.value = ' Mosquito, #Dengue '; Articles.tagKey({ type: 'keydown', key: 'Enter', target: input, preventDefault: () => {} });
      out.added = [mine(), q('#art-tag-in').value, document.activeElement && document.activeElement.id];
      Articles.tagKey({ type: 'keydown', key: 'a', target: q('#art-tag-in'), preventDefault: () => { throw new Error('must not prevent plain keys'); } });
      Articles.dropTag(0);
      out.dropped = mine();
      // save → tags in the document, normalised
      await Articles.save(false);
      const upd = writes.find(w => w[0] === 'update');
      out.saved = [upd && upd[1], upd && upd[2].tags, JSON.stringify(Articles._toDoc(S.cur, 'draft').tags)];
      // the cap: 8
      Articles.addTag('t1,t2,t3,t4,t5,t6,t7,t8,t9'); out.cap = [S.cur.tags.length, !!q('#art-tag-in'), (field().querySelector('.art-ml:last-child') || {}).textContent];
      // a new article starts with no tags and the field present
      Articles.edit(null); out.blank = [S.cur.tags, !!q('#art-tag-in')];
      return out;
    });
    assert.deepEqual(r.norm, [['infection', 'fever', 'red flag', 'tropical'], [], ['x', 'a very long tag name tha', 'd', 'e', 'f', 'g', 'h', 'i']], 'tags normalise: lowercase, trimmed, de-duplicated, # dropped, ≤ 24 chars, ≤ 8: ' + JSON.stringify(r.norm));
    assert.deepEqual(r.rows, [['infection', 'fever', 'red flag', '+1'], ['eye', 'infection', 'a', '+2'], [], 'b · c'], 'rows show up to 3 chips then +n with the rest in the tooltip: ' + JSON.stringify(r.rows));
    assert.deepEqual(r.filtered, ['infection', 2, '🏷 infection ✕', ['All2', 'Draft1'], 2], 'tapping a chip filters the list, the head shows the tag, counts follow: ' + JSON.stringify(r.filtered));
    assert.deepEqual(r.cleared, ['', 3, false], 'the same tag again clears the filter');
    assert.deepEqual([r.eye, r.eyeCleared], [[1], ['', 3]], 'another tag filters to one; the head ✕ clears');
    assert.deepEqual(r.field, [['infection', 'fever', 'red flag', 'tropical'], ['a', 'b', 'c', 'eye', 'dengue'], 'art-warn', true], 'the editor field: own chips, suggestions = other tags in use + link names, sits between the warnings and When & who: ' + JSON.stringify(r.field));
    assert.deepEqual(r.added, [['infection', 'fever', 'red flag', 'tropical', 'mosquito', 'dengue'], '', 'art-tag-in'], '⏎ adds (comma-split, normalised), clears and refocuses the input: ' + JSON.stringify(r.added));
    assert.deepEqual(r.dropped, ['fever', 'red flag', 'tropical', 'mosquito', 'dengue'], '✕ drops one');
    assert.deepEqual(r.saved, ['a1', ['fever', 'red flag', 'tropical', 'mosquito', 'dengue'], '["fever","red flag","tropical","mosquito","dengue"]'], 'Save writes tags[] and toDoc carries them: ' + JSON.stringify(r.saved));
    assert.deepEqual(r.cap, [8, false, 'max 8'], 'at 8 the input gives way to "max 8": ' + JSON.stringify(r.cap));
    assert.deepEqual(r.blank, [[], true], 'a new article: no tags, field present');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: 🏷 Articles tags — normalised tags[], editor chip field with suggestions, row chips (3 + n), tap-to-filter with head chip + counts, Save');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
