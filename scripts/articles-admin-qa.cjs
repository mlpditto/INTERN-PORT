// Admin 📰 Articles (V102.335): ➕ Create ▸ Article opens the Articles modal — status chips (All · Draft · Scheduled · Live · Ended), the editor
// (cover · EN/TH/KO · title · markdown body · window · 🔁 later · audience chips · quiz / Codex links), the 📱 preview, and the save paths
// (draft / schedule / back to draft / two-tap delete) into articles/{id}. The REAL public/articles-admin.js inside the REAL admin.html, with a fake
// Firestore (nothing leaves the page). Also: the HTML wiring and the Firestore rule.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n'), rules = fs.readFileSync('firestore.rules', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/<script src="articles-admin\.js\?v=V102\.\d+"><\/script>/.test(html), 'the module is loaded');
assert.ok(/onclick="createMenuPick\(\(\) => Articles\.open\(\)\)" class="create-menu-row"/.test(html), 'the ➕ Create menu has an Article row');
assert.ok(/match \/articles\/\{articleId\} \{\s*allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && resource\.data\.status == 'scheduled'\);\s*allow write: if isAdmin\(\);\s*\}/.test(rules), 'rule: interns read scheduled only, admin writes');

const H = 3600e3, D = 24 * H, BKK = 7 * H;
const bkk = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi || 0) - BKK;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof openCreateMenu === 'function' && document.readyState === 'complete');

    // ---- pure helpers
    const p = await page.evaluate(({ H, D, BKK }) => {
      const bkk = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi || 0) - BKK;
      const A = Articles, now = bkk(2026, 10, 21, 10);   // a Wednesday
      const w = A._defaultWindow(now), wMon = A._defaultWindow(bkk(2026, 10, 26, 7, 30)), wMon9 = A._defaultWindow(bkk(2026, 10, 26, 9));
      const sched = { status: 'scheduled', startAt: bkk(2026, 10, 20, 8), endAt: bkk(2026, 10, 26, 23, 59) };
      const ok = { title: { en: 'T' }, body: { en: 'B' }, startAt: now, endAt: now + D };
      const doc = A._toDoc({ title: { en: ' Hi ', th: '', ko: 'K' }, body: { en: 'x'.repeat(1400), th: '  ' }, cover: { emoji: '🫁' }, startAt: now, endAt: now + D, audience: { divisions: ['RSU'], groups: [] }, links: [{ kind: 'quiz', id: 'q1', label: 'Q', extra: 1 }], rerun: 'weird' }, 'scheduled');
      return {
        w: [w.start === bkk(2026, 10, 26, 8), w.end === bkk(2026, 11, 1, 23, 59)], mon: [wMon.start === bkk(2026, 10, 26, 8), wMon9.start === bkk(2026, 11, 2, 8)],
        st: [A._status(sched, bkk(2026, 10, 19, 12)), A._status(sched, bkk(2026, 10, 22, 12)), A._status(sched, bkk(2026, 10, 27, 0, 1)), A._status(Object.assign({}, sched, { status: 'draft' }), bkk(2026, 10, 22, 12)), A._status({}, now)],
        local: [A._toLocal(bkk(2026, 10, 26, 8)), A._fromLocal('2026-10-26T08:00') === bkk(2026, 10, 26, 8), A._fromLocal('')],
        v: [A._validate({ title: {}, body: {} }, false), A._validate({ title: { th: 'ไทย' }, body: {} }, false), A._validate({ title: { th: 'ไทย' }, body: { th: 'x' } }, true),
          A._validate(Object.assign({}, ok, { endAt: now - 1 }), true), A._validate(Object.assign({}, ok, { body: { en: 'x'.repeat(2001) } }), false), A._validate(ok, true)],
        doc: { title: doc.title, bodyKeys: Object.keys(doc.body), date: doc.startAt instanceof Date && doc.startAt.getTime() === now, rerun: doc.rerun, links: doc.links, read: doc.readMin, cover: doc.cover, st: doc.status },
        langs: A._langsOf({ title: { en: 'a', th: 'b' }, body: { en: 'x', ko: 'y' } }), readMin: [A._readMin(''), A._readMin('x'.repeat(2000))]
      };
    }, { H, D, BKK });
    assert.deepEqual(p.w, [true, true], 'default window from a Wednesday = the coming Monday 08:00 → Sunday 23:59 (Bangkok)');
    assert.deepEqual(p.mon, [true, true], 'on a Monday before 08:00 it is today; after 08:00 it is next Monday');
    assert.deepEqual(p.st, ['scheduled', 'live', 'ended', 'draft', 'draft'], 'status: before → scheduled · inside → live · after → ended · not published → draft');
    assert.deepEqual(p.local, ['2026-10-26T08:00', true, null], 'datetime-local is Bangkok time');
    assert.match(p.v[0], /title/); assert.equal(p.v[1], '', 'a draft needs only some title (any language)');
    assert.match(p.v[2], /EN/, 'scheduling needs the EN version'); assert.match(p.v[3], /after the start/); assert.match(p.v[4], /2000/, 'bodies up to 2000 characters (V102.336)'); assert.equal(p.v[5], '');
    assert.deepEqual(p.doc.title, { en: 'Hi', ko: 'K' }, 'empty languages are left out, text is trimmed'); assert.deepEqual(p.doc.bodyKeys, ['en']);
    assert.ok(p.doc.date, 'dates go to Firestore as Date (→ Timestamp)'); assert.equal(p.doc.rerun, 'any', 'rerun is off | any'); assert.deepEqual(p.doc.links, [{ kind: 'quiz', id: 'q1', label: 'Q' }]);
    assert.equal(p.doc.read, 2); assert.deepEqual(p.doc.cover, { emoji: '🫁' }); assert.equal(p.doc.st, 'scheduled');
    assert.deepEqual(p.langs, ['en'], 'a language counts when it has both a title and a body'); assert.deepEqual(p.readMin, [1, 3]);

    // ---- the modal, with a fake Firestore
    const r = await page.evaluate(async ({ D }) => {
      const out = {}, writes = [], now = Date.now(), wait = ms => new Promise(res => setTimeout(res, ms));
      const docs = {
        a1: { title: { en: 'Live one', th: 'ไทย' }, body: { en: 'Body', th: 'เนื้อ' }, cover: { emoji: '🫁' }, status: 'scheduled', startAt: { toMillis: () => now - D }, endAt: { toMillis: () => now + D }, audience: { divisions: ['RSU'], groups: [] }, links: [], rerun: 'any' },
        a2: { title: { en: 'Old one' }, body: { en: 'Body' }, cover: { emoji: '🦠' }, status: 'scheduled', startAt: { toMillis: () => now - 9 * D }, endAt: { toMillis: () => now - 3 * D }, audience: { divisions: [], groups: [] }, links: [], rerun: 'off' },
        a3: { title: { en: 'Draft one' }, body: {}, cover: { emoji: '🧊' }, status: 'draft', startAt: { toMillis: () => now + 5 * D }, endAt: { toMillis: () => now + 11 * D }, audience: { divisions: [], groups: [] }, links: [] }
      };
      let n = 0;
      window.db = { collection: name => ({
        get: async () => ({ docs: name === 'articles' ? Object.keys(docs).map(id => ({ id, data: () => docs[id] })) : [{ id: 'd1', data: () => ({ genericName: 'Salbutamol' }) }] }),
        add: async v => { const id = 'new' + (++n); writes.push(['add', name, id, v]); docs[id] = v; return { id }; },
        doc: id => ({ update: async v => { writes.push(['update', name, id, v]); docs[id] = v; }, delete: async () => { writes.push(['delete', name, id]); delete docs[id]; } })
      }) };
      db = window.db;
      quizzesData = [{ id: 'q1', title: 'Bronchodilators' }, { id: '--group-style--', title: 'x' }, { id: 'q2', title: 'Template', isTemplate: true }, { id: 'q3', title: 'Antibiotics' }];
      try { divisionConfig = { RSU: ['EXTERN'], CU: ['INTERN 1'] }; } catch (e) {}
      try { usersData = [{ id: 'u1', group: 'EXTERN', division: 'RSU' }, { id: 'u2', group: 'INTERN 1', division: 'CU' }]; } catch (e) {}
      const q = s => document.querySelector('#articlesModal ' + s), qa = s => [...document.querySelectorAll('#articlesModal ' + s)];
      openCreateMenu();
      const row = [...document.querySelectorAll('#createMenuModal .create-menu-row')].find(b => /Article/.test(b.textContent));
      out.rowAfterEvent = row && /Event/.test(row.previousElementSibling.textContent);
      row.click(); await wait(50);
      out.open = [document.getElementById('createMenuModal').style.display, document.getElementById('articlesModal').style.display];
      out.counts = qa('.art-rail button').map(b => b.dataset.filter + ':' + b.querySelector('b').textContent);
      out.rows = qa('.art-row').map(b => b.querySelector('.art-st').className.replace('art-st ', '') + ':' + b.querySelector('.art-t').textContent);
      out.langsLive = qa('.art-row')[0].querySelectorAll('.art-lg.off').length;
      Articles.filter('live'); out.liveOnly = qa('.art-row').map(b => b.querySelector('.art-t').textContent); Articles.filter('all');
      // new article: defaults, typing, preview
      q('.art-new').click();
      out.def = [q('#art-start').value.length === 16, q('#art-end').value > q('#art-start').value, qa('.art-btns button').map(b => b.textContent.trim())];
      const ti = q('#art-title'); ti.value = '3 inhaler mistakes'; ti.dispatchEvent(new Event('input'));
      const ta = q('#art-bodyta'); ta.value = 'Most patients **shake** it'; ta.dispatchEvent(new Event('input'));
      out.preview = [q('#art-sheet .tt').textContent, q('#art-sheet .b').innerHTML.includes('<strong>shake</strong>') || q('#art-sheet .b').textContent.includes('shake'), q('#art-count').textContent];
      out.caretKept = q('#art-bodyta') === ta && q('#art-title') === ti;
      // V102.336: Thai typed in the editor stays visible in the preview while the admin UI is in EN mode (the language switch must not wrap / hide it)
      const keep = [ti.value, ta.value];
      ti.value = '“อดทนคืออวดตัว”'; ti.dispatchEvent(new Event('input')); ta.value = 'ปัจจุบันคำว่า “อดทน (がまん)”'; ta.dispatchEvent(new Event('input'));
      await wait(150);
      out.thaiShown = [q('#art-sheet .tt').innerText, q('#art-sheet .b').innerText.includes('ปัจจุบัน'), document.querySelectorAll('#articlesModal .lang-th, #articlesModal .lang-kr').length, document.getElementById('articlesModal').classList.contains('lang-no-toggle'), document.body.classList.contains('lang-th-on')];
      ti.value = keep[0]; ti.dispatchEvent(new Event('input')); ta.value = keep[1]; ta.dispatchEvent(new Event('input'));
      // TH empty → preview falls back to EN
      Articles.lang('th'); out.thFallback = [q('#art-title').value, q('#art-sheet .tt').textContent, q('.art-pvh').textContent.includes('→ EN')];
      Articles.lang('en');
      // audience + cover + rerun + links
      const dv = qa('.art-ln').find(l => /Audience/.test(l.textContent));
      out.audChips = [...dv.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      Articles.aud('divisions', 'RSU'); Articles.aud('groups', 'INTERN 1'); Articles.cover('🫁'); Articles.rerun('off'); Articles.rerun('any');
      Articles.openPick('quiz'); out.quizOpts = qa('.art-pk .opts button').map(b => b.textContent);
      Articles.pickQ('bron'); out.quizFiltered = qa('.art-pk .opts button').length;
      Articles.addLink('quiz', 'q1');
      Articles.openPick('codex'); await wait(30); out.codexOpts = qa('.art-pk .opts button').map(b => b.textContent);
      Articles.addLink('codex', 'd1');
      out.links = qa('.art-lk').map(l => l.textContent.replace('✕', '').trim());
      out.previewLinks = qa('#art-sheet .lks span').map(s => s.textContent);
      // schedule fails without a body in EN? (it has one) — break the window first
      Articles.when('endAt', '2000-01-01T00:00'); await Articles.save(true);
      out.badWindow = [q('.art-err') && q('.art-err').textContent, writes.length];
      const w = Articles._defaultWindow(Date.now()); Articles.when('endAt', Articles._toLocal(w.end));
      await Articles.save(true);
      const add = writes[writes.length - 1];
      out.add = [add[0], add[1], add[3].status, add[3].title, add[3].audience, add[3].links.map(l => l.kind + ':' + l.id), add[3].rerun, add[3].startAt instanceof Date, add[3].createdAt, add[3].updatedAt, add[3].cover];
      out.afterAdd = [Articles._S.cur.id, qa('.art-row').length, qa('.art-btns button').map(b => b.textContent.trim())];
      // back to draft = update, same doc
      await Articles.save(false);
      const up = writes[writes.length - 1];
      out.update = [up[0], up[2], up[3].status, 'createdAt' in up[3]];
      // draft with only a Thai title is allowed; delete takes two taps
      Articles.edit('a3'); Articles.lang('th'); const t2 = q('#art-title'); t2.value = 'ร่าง'; t2.dispatchEvent(new Event('input'));
      await Articles.save(false); out.thDraft = writes[writes.length - 1][3].title;
      const before = writes.length; await Articles.remove(); out.armed = [q('.art-btns .del').textContent, writes.length === before];
      await Articles.remove(); out.deleted = [writes[writes.length - 1][0], writes[writes.length - 1][2], qa('.art-row').some(b => /Draft one|ร่าง/.test(b.textContent)), !!q('.art-ed')];
      // a failed save shows the reason and keeps the editor
      Articles.edit('a1'); window.db.collection = () => ({ doc: () => ({ update: async () => { throw new Error('permission-denied'); } }) });
      await Articles.save(true); out.fail = [q('.art-err') && q('.art-err').textContent, !!q('.art-ed')];
      Articles.close(); out.closed = document.getElementById('articlesModal').style.display;
      return out;
    }, { D });
    assert.equal(r.rowAfterEvent, true, 'the Article row sits right after Event');
    assert.deepEqual(r.open, ['none', 'block'], 'tapping it closes ➕ Create and opens 📰 Articles');
    assert.deepEqual(r.counts, ['all:3', 'draft:1', 'scheduled:0', 'live:1', 'ended:1'], 'status chips with counts: ' + r.counts);
    assert.deepEqual(r.rows, ['live:Live one', 'draft:Draft one', 'ended:Old one'], 'list order: live → scheduled → draft → ended');
    assert.equal(r.langsLive, 1, 'the missing KO version is struck through');
    assert.deepEqual(r.liveOnly, ['Live one'], 'the Live chip filters');
    assert.deepEqual(r.def.slice(0, 2), [true, true], '＋ New fills a window'); assert.deepEqual(r.def[2], ['Discard', 'Save draft', '📅 Schedule']);
    assert.equal(r.preview[0], '3 inhaler mistakes', 'the preview follows the title'); assert.ok(r.preview[1], 'and renders the markdown body'); assert.match(r.preview[2], /^26 \/ 2000 · ~1 min$/);
    assert.ok(r.caretKept, 'typing does not re-render the textarea (the caret stays)');
    assert.deepEqual(r.thaiShown, ['“อดทนคืออวดตัว”', true, 0, true, false], 'Thai in the preview is not hidden by the EN-mode language switch: ' + JSON.stringify(r.thaiShown));
    assert.deepEqual(r.thFallback, ['', '3 inhaler mistakes', true], 'an empty TH shows EN in the preview, marked "→ EN"');
    assert.ok(r.audChips[0] === 'Everyone' && r.audChips.some(c => /RSU/.test(c)) && r.audChips.some(c => /INTERN 1/.test(c)), 'audience = Everyone + division chips + group chips: ' + r.audChips);
    assert.deepEqual(r.quizOpts, ['🧪 Bronchodilators', '🧪 Antibiotics'], 'the quiz picker skips templates and the --group-style-- doc'); assert.equal(r.quizFiltered, 1, 'and searches');
    assert.deepEqual(r.codexOpts, ['💊 Salbutamol'], 'the Codex picker loads drug_codex once when the Codex tab has not');
    assert.deepEqual(r.links, ['🧪 Bronchodilators', '💊 Salbutamol']); assert.deepEqual(r.previewLinks, ['🧪 Bronchodilators · 🪙 +1', '💊 Salbutamol'], 'the preview shows the links, the quiz with its +1 Beri');
    assert.match(r.badWindow[0] || '', /after the start/, 'a bad window is refused with a reason'); assert.equal(r.badWindow[1], 0, 'and nothing is written');
    assert.deepEqual(r.add.slice(0, 3), ['add', 'articles', 'scheduled'], '📅 Schedule adds an articles doc with status scheduled');
    assert.deepEqual(r.add[3], { en: '3 inhaler mistakes' }); assert.deepEqual(r.add[4], { divisions: ['RSU'], groups: ['INTERN 1'] }); assert.deepEqual(r.add[5], ['quiz:q1', 'codex:d1']);
    assert.equal(r.add[6], 'any'); assert.equal(r.add[7], true); assert.deepEqual([r.add[8], r.add[9]], ['TS', 'TS'], 'createdAt + updatedAt are server timestamps'); assert.deepEqual(r.add[10], { emoji: '🫁' });
    assert.equal(r.afterAdd[0], 'new1'); assert.equal(r.afterAdd[1], 4, 'the new article joins the list'); assert.deepEqual(r.afterAdd[2], ['🗑', '↩ Back to draft', '💾 Save']);
    assert.deepEqual(r.update, ['update', 'new1', 'draft', false], '↩ Back to draft updates the same doc (createdAt untouched)');
    assert.deepEqual(r.thDraft, { en: 'Draft one', th: 'ร่าง' }, 'a draft may be saved with any language');
    assert.deepEqual(r.armed, ['Delete?', true], 'the first 🗑 tap only arms the button'); assert.deepEqual(r.deleted, ['delete', 'a3', false, false], 'the second deletes and closes the editor');
    assert.match(r.fail[0] || '', /permission-denied/, 'a failed save shows the error'); assert.equal(r.fail[1], true, 'and keeps the editor open');
    assert.equal(r.closed, 'none');
    const bad = errors.filter(e => /Articles|articles-admin|art-/.test(e));
    assert.deepEqual(bad, [], 'no page errors from the module: ' + bad.join(' | '));
    console.log('PASS: admin 📰 Articles — Create ▸ Article row, status chips + list, editor (EN/TH/KO, markdown, window, 🔁, audience, quiz/Codex links), 📱 preview, draft / schedule / back to draft / two-tap delete → articles/{id}, rule');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
