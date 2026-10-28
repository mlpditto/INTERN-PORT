// Admin 📰 Articles (V102.341 PR 3: read counts, 👥 who read it + CSV, User Hub 📰 chip, ✨ AI draft / translate, one-line model rail; V102.335; V102.338 editor blend — status line, wrong-language warning, folds, sticky bar): ➕ Create ▸ Article opens the Articles modal — status chips (All · Draft · Scheduled · Live · Ended), the editor
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
assert.ok(/_qjcHtml \+ \(window\.Articles \? Articles\.userChip\(d\) : ''\)/.test(html), 'User Hub rows carry the 📰 chip');
assert.ok(/if \(window\.Articles\) Articles\.boot\(\);/.test(html), 'the list loads after sign-in (for the chips)');
assert.ok(/match \/articles\/\{articleId\} \{\s*allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && resource\.data\.status == 'scheduled'\);\s*allow write: if isAdmin\(\);\s*\}/.test(rules), 'rule: interns read scheduled only, admin writes');

const H = 3600e3, D = 24 * H, BKK = 7 * H;
const bkk = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi || 0) - BKK;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      // admin's module script (providerModelRailHtml, renderMd) only runs when its importmap target resolves
      if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Articles && typeof openCreateMenu === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete');

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
      // V102.397: a strikethrough button (GFM ~~text~~ — the renderer the interns' sheet uses) beside B / I
      const tb = qa('.art-tb button').map(b => b.title + ':' + b.textContent.trim());
      ta.focus(); ta.setSelectionRange(ta.value.indexOf('patients'), ta.value.indexOf('patients') + 'patients'.length);
      qa('.art-tb button').find(b => b.title === 'Strikethrough').click();
      out.strike = [tb.slice(0, 3), q('#art-bodyta').value];
      { const t2 = q('#art-bodyta'); t2.value = 'Most patients **shake** it'; t2.dispatchEvent(new Event('input')); }   // back to the text the next checks expect
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
      out.afterSave = q('#art-stl').textContent;
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
      // ---- V102.338 editor blend
      Articles.edit('a1');
      out.edge = qa('.art-row').map(b => (b.className.match(/st-(\w+)/) || [])[1]);
      out.stLive = q('#art-stl').textContent;
      out.secs = qa('details.art-sec').map(d => d.querySelector('summary b').textContent + ':' + d.open);
      out.whenSum = qa('details.art-sec')[0].querySelector('summary').textContent;
      out.coverFold = [qa('.art-emo').length]; Articles.coverPick(); out.coverFold.push(qa('.art-emo').length); Articles.cover('🦠'); out.coverFold.push(qa('.art-emo').length, Articles._S.cur.cover.emoji);
      out.dirty = q('#art-stl').textContent.includes('● Unsaved');
      out.pvBadge = q('.art-pvb').textContent;
      // wrong language: Thai typed into EN → warning + Move to TH
      Articles.edit(null);
      out.newSecs = qa('details.art-sec').map(d => d.open);
      out.stNew = q('#art-stl').textContent; out.pvNew = q('.art-pvb').textContent;
      out.fb = qa('.art-ed > .art-ln:nth-child(2) .art-c').map(b => b.textContent.trim());
      const t3 = q('#art-title'); t3.value = '“อดทนคืออวดตัว”'; t3.dispatchEvent(new Event('input'));
      const b3 = q('#art-bodyta'); b3.value = 'ปัจจุบันคำว่า “อดทน (がまん)” ใช้ทั่วไปในความหมายว่า ทน อดกลั้น'; b3.dispatchEvent(new Event('input'));
      out.warn = [q('#art-warn').textContent, !!q('#art-warn button'), q('#art-stl').textContent.includes('● Unsaved')];
      q('#art-warn button').click();
      out.moved = [Articles._S.lang, Articles._S.cur.title.en, Articles._S.cur.title.th, (Articles._S.cur.body.th || '').startsWith('ปัจจุบัน'), q('#art-warn').textContent, q('#art-title').value];
      Articles.lang('en'); const t4 = q('#art-title'); t4.value = 'Patience is pride'; t4.dispatchEvent(new Event('input'));
      out.enOk = q('#art-warn').textContent;
      Articles.close(); out.closed = document.getElementById('articlesModal').style.display;
      return out;
    }, { D });
    assert.equal(r.rowAfterEvent, true, 'the Article row sits right after Event');
    assert.deepEqual(r.open, ['none', 'block'], 'tapping it closes ➕ Create and opens 📰 Articles');
    assert.deepEqual(r.counts, ['all:3', 'draft:1', 'scheduled:0', 'live:1', 'ended:1'], 'status chips with counts: ' + r.counts);
    assert.deepEqual(r.rows, ['live:Live one', 'draft:Draft one', 'ended:Old one'], 'list order: live → scheduled → draft → ended');
    assert.equal(r.langsLive, 1, 'the missing KO version is struck through');
    assert.deepEqual(r.liveOnly, ['Live one'], 'the Live chip filters');
    assert.deepEqual(r.def.slice(0, 2), [true, true], '＋ New fills a window'); assert.deepEqual(r.def[2], ['🗑', 'Save draft', '📅 Schedule'], 'V102.338: 🗑 is a quiet icon (two taps), Schedule is the primary');
    assert.equal(r.preview[0], '3 inhaler mistakes', 'the preview follows the title'); assert.ok(r.preview[1], 'and renders the markdown body'); assert.match(r.preview[2], /^26 \/ 2000 · ~1 min$/);
    assert.ok(r.caretKept, 'typing does not re-render the textarea (the caret stays)');
    assert.deepEqual(r.strike, [['Bold:B', 'Italic:I', 'Strikethrough:S'], 'Most ~~patients~~ **shake** it'], 'V102.397: the toolbar has a Strikethrough button that wraps the selection in ~~ ~~');
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
    assert.equal(r.afterAdd[0], 'new1'); assert.match(r.afterSave, /Saved/, 'after 📅 Schedule the status line says Saved: ' + r.afterSave); assert.equal(r.afterAdd[1], 4, 'the new article joins the list'); assert.deepEqual(r.afterAdd[2], ['🗑', '↩ Back to draft', '✓ Saved'], 'after Schedule the pressed button reads ✓ Saved (green) until the next edit');
    assert.deepEqual(r.update, ['update', 'new1', 'draft', false], '↩ Back to draft updates the same doc (createdAt untouched)');
    assert.deepEqual(r.thDraft, { en: 'Draft one', th: 'ร่าง' }, 'a draft may be saved with any language');
    assert.deepEqual(r.armed, ['Delete?', true], 'the first 🗑 tap only arms the button'); assert.deepEqual(r.deleted, ['delete', 'a3', false, false], 'the second deletes and closes the editor');
    assert.match(r.fail[0] || '', /permission-denied/, 'a failed save shows the error'); assert.equal(r.fail[1], true, 'and keeps the editor open');
    assert.equal(r.closed, 'none');
    // V102.338 editor blend
    assert.deepEqual([...new Set(r.edge)].sort(), ['draft', 'ended', 'live'], 'list rows are edged by status: ' + r.edge);
    assert.match(r.stLive, /^Live\s*Showing now · ends /, 'one status line: Live + what happens next: ' + r.stLive);
    assert.deepEqual(r.secs, ['When & who:false', 'Links:false'], 'an existing article folds When & who and an empty Links');
    assert.match(r.whenSum, /📅 .+ · 🔁 new interns · 👥 RSU ~1/, 'the fold says when, 🔁, who and how many: ' + r.whenSum);
    assert.deepEqual(r.coverFold, [1, 10, 1, '🦠'], 'the cover is one chip; a tap opens the ten, a pick folds it again');
    assert.ok(r.dirty, 'a change shows ● Unsaved');
    assert.match(r.pvBadge, /^Live\s*Interns see it /, 'the preview says when interns see it');
    assert.deepEqual(r.newSecs, [true, false], 'a new article opens When & who');
    assert.match(r.stNew, /^Draft\s*Not live yet · 📅 Schedule when ready/); assert.match(r.pvNew, /Interns do not see drafts/);
    assert.deepEqual(r.fb, ['🇬🇧', '🇹🇭 → 🇬🇧', '🇰🇷 → 🇬🇧'], 'empty TH / KO say they fall back to EN');
    assert.match(r.warn[0], /looks like Thai, not English/, 'Thai typed into EN is flagged inline'); assert.ok(r.warn[1], 'with a Move to TH button'); assert.ok(r.warn[2], 'and the status line says ● Unsaved');
    assert.deepEqual(r.moved, ['th', '', '“อดทนคืออวดตัว”', true, '', '“อดทนคืออวดตัว”'], 'Move to TH moves title + body into TH and switches to it');
    assert.equal(r.enOk, '', 'English in EN = no warning');
    assert.match(r.afterSave || 'Saved', /Saved/);
    // ---- V102.341 PR 3: readers, chip, ✨
    const r3 = await page.evaluate(async ({ D }) => {
      const out = {}, writes = [], now = Date.now(), wait = ms => new Promise(res => setTimeout(res, ms));
      const T = ms => ({ toMillis: () => ms });
      const docs = {
        b1: { title: { en: 'Inhaler mistakes' }, body: { en: 'Shake it.' }, cover: { emoji: '🫁' }, status: 'scheduled', startAt: T(now - D), endAt: T(now + D), audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
        b2: { title: { en: 'Old one' }, body: { en: 'Old.' }, cover: { emoji: '🦠' }, status: 'scheduled', startAt: T(now - 30 * D), endAt: T(now - 20 * D), audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
        b3: { title: { en: 'Old, no rerun' }, body: { en: 'Old.' }, cover: { emoji: '🧊' }, status: 'scheduled', startAt: T(now - 30 * D), endAt: T(now - 20 * D), audience: { divisions: [], groups: [] }, links: [], rerun: 'off' }
      };
      window.db = { collection: name => ({ get: async () => ({ docs: Object.keys(docs).map(id => ({ id, data: () => docs[id] })) }), add: async v => { writes.push(['add', v]); return { id: 'n' }; }, doc: id => ({ update: async v => { writes.push(['update', id, v]); }, delete: async () => { writes.push(['delete', id]); } }) }) };
      db = window.db;
      const day = d => new Date(now + d * D + 7 * 3600e3).toISOString().slice(0, 10);
      usersData = [
        { id: 'v1', displayName: 'Patra', group: 'EXTERN', division: 'RSU', startDate: day(-60), articleSeen: { b1: { act: 'ok', at: T(now - 3600e3), saved: true } } },
        { id: 'v2', displayName: 'NATT', group: 'EXTERN', division: 'RSU', startDate: day(-60), articleSeen: { b1: { act: 'x', at: T(now - 7200e3) } } },
        { id: 'v3', displayName: 'Gap', group: 'EXTERN', division: 'RSU', startDate: day(-60), articleSeen: {} },
        { id: 'v4', displayName: 'Ploy', group: 'EXTERN', division: 'RSU', startDate: day(-5), articleSeen: { b1: { act: 'quiz', at: T(now - 600e3) } } },
        { id: 'v5', displayName: 'Hidden', group: 'EXTERN', division: 'RSU', startDate: day(-60), isIgnored: true, articleSeen: { b1: { act: 'ok' } } }
      ];
      const S = Articles._S; S.loaded = false; S.loading = false; S.list = [];
      await Articles.boot();
      out.loaded = [S.loaded, S.list.length];
      const st = Articles._stats(S.list.find(a => a.id === 'b1'), now);
      out.stats = [st.n, st.read, st.closed, st.wait, st.saved, st.quiz, st.rerun];
      const b2 = S.list.find(a => a.id === 'b2'), b3 = S.list.find(a => a.id === 'b3');
      out.forUser = [Articles._forUser(b2, usersData[3], now), Articles._forUser(b2, usersData[0], now), Articles._forUser(b3, usersData[3], now)];
      out.chips = usersData.slice(0, 4).map(u => (Articles.userChip(u).match(/class="u-art (\w+)"[^>]*>📰 ([\d/]+)/) || []).slice(1).join(' '));
      out.noChip = Articles.userChip({ id: 'z', group: 'EXTERN', startDate: day(-60), articleSeen: {} }) !== '' ;
      // the modal: counts under the preview, who read it, CSV
      Articles.open(); await wait(50); Articles.edit('b1');
      const q = sel => document.querySelector('#articlesModal ' + sel), qa = sel => [...document.querySelectorAll('#articlesModal ' + sel)];
      out.card = q('#art-stats') && q('#art-stats').textContent.replace(/\s+/g, ' ');
      out.previewG4 = [!!q('#art-sheet .ok2'), q('#art-sheet .ok2') && q('#art-sheet .ok2').textContent];
      // V102.346: the preview's Read more really opens the body (and stays open while typing); a short body hides it
      {
        const t = q('textarea'), sheet = () => q('#art-sheet'), bh = () => Math.round(q('#art-sheet .b').getBoundingClientRect().height), btn = () => q('#art-pv-more');
        t.value = Array.from({ length: 14 }, (_, i) => 'Line ' + (i + 1) + ' of a long body that needs Read more.').join('\n\n'); t.dispatchEvent(new Event('input', { bubbles: true }));
        const closedH = bh();
        btn().click();
        const open = [sheet().classList.contains('more'), btn().textContent, btn().getAttribute('aria-expanded'), bh() > closedH * 2];
        t.value += '\n\nOne more.'; t.dispatchEvent(new Event('input', { bubbles: true }));
        const typed = [sheet().classList.contains('more'), btn().textContent];
        btn().click();
        const closed = [sheet().classList.contains('more'), btn().textContent, bh() === closedH];
        t.value = 'Short.'; t.dispatchEvent(new Event('input', { bubbles: true }));
        out.readMore = { open, typed, closed, shortHidden: btn().style.visibility };
        Articles.edit('b1');
      }
      Articles.who(true);
      out.who = [qa('.art-wr').length, qa('.art-wr .pill').map(p => p.textContent), qa('[data-who]').map(b => b.dataset.who + ':' + b.querySelector('b').textContent)];
      Articles.whoF('closed'); out.closedOnly = qa('.art-wr b').map(b => b.textContent);
      Articles.whoF('all');
      let csv = ''; const oc = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(t => { csv = t; }); b.arrayBuffer().then(x => { out.bom = [...new Uint8Array(x).slice(0, 3)]; }); return 'blob:x'; };
      Articles.csv(); await wait(50); URL.createObjectURL = oc;
      out.csv = csv.split('\n').map(l => l.split(',').slice(0, 4).join(','));
      Articles.who(false); out.back = !!q('.art-ed');
      // ✨ translate EN → TH, then draft in EN; never writes
      const calls = []; let reply = 'หัวข้อไทย\n---\nเขย่าก่อนใช้ **ทุกครั้ง**';
      window.callUniversalAI = async (...a) => { calls.push(a); return { text: reply }; };
      Articles.lang('th');
      out.trBtn = q('.art-ai .go').textContent;
      await Articles.ai();
      out.tr = [S.cur.title.th, S.cur.body.th, S.aiNote.includes('read it, then save'), calls[0][2], calls[0][5] && calls[0][5].feature, /Translate .* into Thai/.test(calls[0][1]), q('#art-stl').textContent.includes('● Unsaved')];
      Articles.lang('en'); out.drBtn = q('.art-ai .go').textContent;
      reply = '```markdown\n**Shake** the inhaler first.\n```';
      await Articles.ai();
      out.dr = [S.cur.body.en, /Write a short article .* in English/.test(calls[1][1]) && /Topic: Inhaler mistakes/.test(calls[1][1]), /under 700 characters/.test(calls[1][1]) && /each starting with one fitting emoji instead of a label/.test(calls[1][1]) && /one line starting with 💊 that lists 2 to 4 related drug names/.test(calls[1][1]) && !/one practical point, one example/.test(calls[1][1]) && /fits a phone line without wrapping: at most about 60 characters in English, 45 in Thai or Korean/.test(calls[1][1])];   // V102.363: emoji-led lines + 💊 drugs line · V102.385: one short sentence per line
      window.callUniversalAI = async () => { throw new Error('quota'); };
      await Articles.ai(); out.err = q('.art-err') && q('.art-err').textContent;
      out.writes = writes.length;
      // ---- V102.362: 🌐 Translate all — the header button before ＋ New; every missing TH / KO from EN, saved as title.<L> / body.<L>
      Articles.close();
      S.list = [
        { id: 'a1', title: { en: 'Acromegaly: Spotting the Subtle Signs 🔍' }, body: { en: 'Body one' }, cover: { emoji: '📰' }, status: 'scheduled', startAt: Date.now(), endAt: Date.now() + 864e5, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
        { id: 'a2', title: { en: 'Two', th: 'สอง' }, body: { en: 'Body two', th: 'เนื้อสอง' }, cover: { emoji: '📰' }, status: 'scheduled', startAt: Date.now(), endAt: Date.now() + 864e5, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
        { id: 'a3', title: { en: 'Three', th: 'สาม', ko: '셋' }, body: { en: 'B3', th: 'B3', ko: 'B3' }, cover: { emoji: '📰' }, status: 'draft', startAt: 0, endAt: 0, audience: { divisions: [], groups: [] }, links: [], rerun: 'any' },
      ];
      S.cur = null; Articles.filter('all');
      const hd = qa('.art-h > *').map(e => e.className.split(' ')[0]);
      out.trHead = [hd.indexOf('art-tr-all') > -1 && hd.indexOf('art-tr-all') < hd.indexOf('art-new'), q('.art-tr-all').textContent.replace(/\s+/g, ' ').trim(), q('.art-tr-all').disabled];
      const trCalls = []; window.callUniversalAI = async (...a) => { trCalls.push(a); const L = /into Korean/.test(a[1]) ? 'ko' : 'th'; return { text: (L === 'ko' ? '제목' : 'หัวข้อ') + '\n---\n' + (L === 'ko' ? '본문' : 'เนื้อหา') }; };
      const toasts = []; window.showToast = m => toasts.push(m);
      window.confirm = () => false; await Articles.translateAll(); out.trCancel = [trCalls.length, writes.length];
      out.trHead2 = [q('.art-tr-all').textContent.replace(/\s+/g, ' ').trim(), S.list.map(a => a.id + ':' + Object.keys(a.body).sort().join('')).join(' ')];
      window.confirm = msg => { if (!out.trConfirm) out.trConfirm = msg; return true; };   // the stop test below confirms again
      const w0 = writes.length; await Articles.translateAll();
      out.trJobs = trCalls.map(a => (a[1].match(/into (\w+)\./) || [])[1] + ':' + (a[1].split('\n\n')[1] || '').split('\n')[0]);
      out.trWrites = writes.slice(w0).map(w => [w[0], w[1], Object.keys(w[2]).sort().join(','), w[2]['body.th'] || w[2]['body.ko'], w[2]['title.th'] || w[2]['title.ko']]);
      out.trList = S.list.map(a => a.id + ':' + Object.keys(a.body).sort().join(''));
      out.trAfter = [q('.art-tr-all').textContent.replace(/\s+/g, ' ').trim(), q('.art-tr-all').disabled, toasts[toasts.length - 1]];
      // a second click while running = stop after the current one
      S.list[0].body = { en: 'Body one' }; S.list[0].title = { en: 'Acromegaly: Spotting the Subtle Signs 🔍' }; Articles.filter('all');
      let during = null; window.callUniversalAI = async (...a) => { if (!during) { during = q('.art-tr-all').textContent.replace(/\s+/g, ' ').trim(); Articles.translateAll(); } return { text: 'x\n---\ny' }; };
      const w1 = writes.length; await Articles.translateAll(); out.trStop = [during, writes.length - w1, /stopped/.test(toasts[toasts.length - 1])];
      // ---- 🩺 Disease Codex (V102.371): the saved article → an AI Pending Draft through dxaDraftFromArticle (the full flow is in articles-codex-draft-qa); an unsaved edit is refused
      const dxCalls = []; window.dxaDraftFromArticle = async a => { dxCalls.push(a.name); return { draftId: 'd9', model: 'm' }; };
      Articles.edit('a1'); out.dxChip = !!qa('.art-c.art-add').find(b => /🩺 Disease Codex/.test(b.textContent));
      S.cur.title.en = 'Acromegaly: edited'; Articles.toCodex(); out.dxDirty = [q('.art-err') && q('.art-err').textContent, dxCalls.length];
      S.cur.title.en = 'Acromegaly: Spotting the Subtle Signs 🔍'; S.base = JSON.stringify(S.cur); Articles.toCodex(); await wait(100);
      out.dx = [dxCalls, S.cur.dx && S.cur.dx.draftId, (qa('.art-c.art-add').find(b => /🩺/.test(b.textContent)) || {}).textContent];
      Articles.open(); Articles.edit('a1');
      // the one-line model rail
      Articles.modelPick();
      const chips = qa('.art-mrail .text-ai-chips > button'), shown = chips.filter(b => getComputedStyle(b).display !== 'none');
      const tops = shown.concat(qa('.art-mrail .audit-provider')).map(b => Math.round(b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2));
      out.rail = [chips.length, shown.length, Math.max(...tops) - Math.min(...tops), shown.every(b => /^GPT /.test(b.getAttribute('aria-label')))];
      Articles.model(shown[1].dataset.value); out.picked = [q('.art-ai .mdl').textContent.trim(), localStorage.getItem('articleDraftModel'), !q('.art-mrail')];
      Articles.close();
      return out;
    }, { D });
    assert.deepEqual(r3.loaded, [true, 3], 'boot() loads the list quietly');
    assert.deepEqual(r3.stats, [4, 2, 1, 1, 1, 1, 0], 'b1: 4 for (the hidden one does not count) · ✓2 👁1 ⏳1 · 🔖1 🧪1: ' + r3.stats);
    assert.deepEqual(r3.forUser, ['rerun', 'live', ''], 'an old article reaches an intern who joined after it ended (rerun any), not when rerun is off');
    assert.deepEqual(r3.chips, ['bad 1/3', 'bad 0/3', 'bad 0/3', 'warn 1/2'], 'User Hub chip: read / for them (old articles count for interns who were here; a newcomer gets only the re-runs), coloured by how many are left: ' + r3.chips);
    assert.equal(r3.noChip, true, 'an intern with articles for them gets a chip');
    assert.match(r3.card || '', /Read\s*2 \/ 4 · 50%\s*✓ 2\s*👁 1\s*⏳ 1\s*🔖 1\s*🧪 1\s*👥 Who read it/, 'the read card under the preview: ' + r3.card);
    assert.deepEqual(r3.previewG4, [true, '👍 Got it'], 'the preview is the V101.177 intern sheet');
    assert.deepEqual(r3.readMore.open, [true, 'Show less ▴', 'true', true], 'preview Read more opens the whole body');
    assert.deepEqual(r3.readMore.typed, [true, 'Show less ▴'], 'typing keeps it open');
    assert.deepEqual(r3.readMore.closed, [false, 'Read more ▾', true], 'Show less closes it');
    assert.equal(r3.readMore.shortHidden, 'hidden', 'a short body needs no Read more');
    assert.deepEqual(r3.who[0], 4, 'who read it lists everyone it is for'); assert.deepEqual(r3.who[1], ['✓ Read', '✓ Read', '👁 Closed', '⏳ Not yet'], 'read first, then closed, then not yet');
    assert.deepEqual(r3.who[2], ['all:4', 'read:2', 'closed:1', 'wait:1'], 'filters with counts (no 🔁 chip when nobody is a re-run)');
    assert.deepEqual(r3.closedOnly, ['NATT'], 'the 👁 filter');
    assert.deepEqual(r3.csv.slice(0, 2), ['name,division,group,state', 'Ploy,RSU,EXTERN,read'], 'CSV export: ' + r3.csv.slice(0, 2)); assert.equal(r3.csv.length, 5);
    assert.deepEqual(r3.bom, [239, 187, 191], 'with a UTF-8 BOM so Excel reads Thai names');
    assert.equal(r3.back, true, '✕ goes back to the editor');
    assert.equal(r3.trBtn, '✨ From EN', 'an empty TH next to a filled EN offers a translation');
    // V102.362
    assert.deepEqual(r3.trHead, [true, '🌐 Translate all 3', false], '🌐 sits before ＋ New and counts the missing versions (a1 th+ko, a2 ko): ' + JSON.stringify(r3.trHead));
    assert.deepEqual(r3.trCancel, [0, 0], 'Cancel on the confirm sends nothing');
    assert.match(r3.trConfirm, /Translate 3 missing version\(s\) of 2 article\(s\)/, 'the confirm counts versions and articles: ' + r3.trConfirm + ' | ' + JSON.stringify(r3.trHead2));
    assert.deepEqual(r3.trJobs, ['Thai:Acromegaly: Spotting the Subtle Signs 🔍', 'Korean:Acromegaly: Spotting the Subtle Signs 🔍', 'Korean:Two'], 'one prompt per missing version, from the EN title: ' + JSON.stringify(r3.trJobs));
    assert.deepEqual(r3.trWrites, [['update', 'a1', 'body.th,title.th,updatedAt,updatedBy', 'เนื้อหา', 'หัวข้อ'], ['update', 'a1', 'body.ko,title.ko,updatedAt,updatedBy', '본문', '제목'], ['update', 'a2', 'body.ko,title.ko,updatedAt,updatedBy', '본문', '제목']], 'each version is saved on its own, only that language: ' + JSON.stringify(r3.trWrites));
    assert.deepEqual(r3.trList, ['a1:enkoth', 'a2:enkoth', 'a3:enkoth'], 'the list rows pick up the new languages');
    assert.deepEqual(r3.trAfter, ['🌐 Translate all', true, '🌐 Translated 3/3'], 'afterwards the button has nothing left to do: ' + JSON.stringify(r3.trAfter));
    assert.deepEqual(r3.trStop, ['🌐 1/2 · stop', 1, true], 'a second click stops after the current one: ' + JSON.stringify(r3.trStop));
    assert.equal(r3.dxChip, true, '🩺 Disease Codex chip in the Links line');
    assert.deepEqual(r3.dxDirty, ['⚠️ 🩺 Save the article first, then send it to the Disease Codex.', 0], 'an unsaved edit is refused (the error line carries the ⚠️)');
    assert.deepEqual(r3.dx, [['Acromegaly'], 'd9', '🩺 Codex draft pending'], 'the bare topic goes to dxaDraftFromArticle, the article remembers the draft, the chip says pending: ' + JSON.stringify(r3.dx));
    assert.deepEqual(r3.tr, ['หัวข้อไทย', 'เขย่าก่อนใช้ **ทุกครั้ง**', true, false, 'article_draft', true, true], 'translation fills TH title + body, notes the model, logs feature article_draft, leaves it unsaved');
    assert.equal(r3.drBtn, '✨ Draft');
    assert.deepEqual(r3.dr, ['**Shake** the inhaler first.', true, true], 'a draft writes the body from the title (code fences stripped); V102.363 prompt: emoji-led lines, 💊 drug names, under 700');
    assert.match(r3.err || '', /✨ quota/, 'an AI error shows in the editor');
    assert.equal(r3.writes, 0, '✨ never saves — nothing was written');
    assert.ok(r3.rail[0] >= 10 && r3.rail[1] >= 1 && r3.rail[1] < r3.rail[0] && r3.rail[3], 'the model rail shows only the picked vendor’s models: ' + r3.rail);
    assert.ok(r3.rail[2] <= 3, 'logos and chips sit on one line (centres within 3 px), got ' + r3.rail[2]);
    assert.ok(r3.picked[0] && r3.picked[1] && r3.picked[2], 'picking a model folds the rail and remembers it: ' + r3.picked);
    const bad = errors.filter(e => /Articles|articles-admin|art-/.test(e));
    assert.deepEqual(bad, [], 'no page errors from the module: ' + bad.join(' | '));
    console.log('PASS: admin 📰 Articles — Create ▸ Article row, status chips + list, editor (EN/TH/KO, markdown, window, 🔁, audience, quiz/Codex links), 📱 preview, draft / schedule / back to draft / two-tap delete → articles/{id}, rule');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
