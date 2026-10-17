// Admin Holidays (V102.272): the 🎌 panel beside the Event form (pick country + year, load the list, tick, 💾 ring = save to holidays/<CC>_<year>) and the 🗓 strip on the
// Dashboard (3 days back … 14 ahead, ✓ = shown to interns, health / cat days approved one by one in holidays/OBS_<year>). The REAL public/holidays-admin.js inside the REAL
// admin.html, with a fake Firestore and a stubbed fetch (Nager.Date + the two JSON files). Also: the HTML wiring and the Firestore rule.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n'), rules = fs.readFileSync('firestore.rules', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(/<script src="holidays-admin\.js\?v=V102\.\d+"><\/script>/.test(html), 'the module is loaded');
assert.ok(/<div class="hol-grid"><div class="hol-left">\s*<h2 style="margin-top:0;">📣 New Event<\/h2>/.test(html) && /<\/div><div class="hol-right" id="hol-panel"><\/div><\/div>\s*<\/div>\s*<!-- 1\. Kanban Task Form -->/.test(html), 'Event form left, Holidays panel right, no switch');
assert.ok(/Holidays\.init\(\);/.test(html) && /Holidays\.boot\(\);/.test(html), 'init with the Event tab, boot after login');
assert.ok(/match \/holidays\/\{holidayId\} \{\s*allow read: if isSignedIn\(\);\s*allow write: if isAdmin\(\);\s*\}/.test(rules), 'rule: read = signed in, write = admin');
const TH = JSON.parse(fs.readFileSync('public/th-holidays.json', 'utf8')), OBS = JSON.parse(fs.readFileSync('public/observances.json', 'utf8'));
assert.ok(OBS.items.length >= 15 && OBS.items.every(o => /^\d\d-\d\d$/.test(o.md) && 'mc'.includes(o.k) && o.en), 'observances.json is well formed');
const NAGER_JP = [{ date: '2026-02-11', name: 'Foundation Day', localName: '建国記念の日' }, { date: '2026-01-01', name: "New Year's Day", localName: '元日' }, { date: '2026-05-04', name: 'Greenery Day', localName: 'みどりの日' }, { date: '2026-03-20', name: 'Vernal Equinox Day', localName: 'Vernal Equinox Day' }];

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => window.Holidays && document.getElementById('hol-panel'));
    const r = await page.evaluate(async ({ TH, OBS, NAGER_JP }) => {
      const out = {}, writes = [];
      let failWrites = false;
      const dayStr = n => { const d = new Date(Date.parse(Holidays_today() + 'T00:00:00Z') + n * 86400000); return d.toISOString().slice(0, 10); };
      function Holidays_today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()); }
      const year = Number(Holidays_today().slice(0, 4));
      const thYear = TH.years[Object.keys(TH.years)[0]]; const thY = Object.keys(TH.years)[0];
      window.fetch = (url) => {
        url = String(url);
        if (url.endsWith('th-holidays.json')) return Promise.resolve({ ok: true, status: 200, json: async () => TH });
        if (url.endsWith('observances.json')) return Promise.resolve({ ok: true, status: 200, json: async () => OBS });
        if (/date\.nager\.at.*\/JP$/.test(url)) return Promise.resolve({ ok: true, status: 200, json: async () => NAGER_JP });
        if (/date\.nager\.at.*\/KR$/.test(url)) return Promise.resolve({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      };
      const docs = { ['SG_' + year]: { items: [{ d: year + '-12-25', en: 'Christmas Day', local: '' }], country: 'SG', year } };
      window.db = { collection: name => ({ get: async () => ({ docs: Object.keys(docs).map(id => ({ id, data: () => docs[id] })) }), doc: id => ({ set: async (v) => { if (failWrites) throw new Error('permission-denied'); writes.push([name, id, JSON.parse(JSON.stringify(v))]); docs[id] = v; } }) }) };
      db = window.db;
      const S = Holidays._S;
      await Holidays.init();
      const q = sel => document.querySelector('#hol-panel ' + sel), qa = sel => [...document.querySelectorAll('#hol-panel ' + sel)];
      out.chips = qa('.hol-chips .hol-chip').map(b => b.getAttribute('aria-label') || b.textContent.trim());
      out.sgSaved = qa('.hol-chip').find(b => b.getAttribute('aria-label') === 'Singapore').textContent;
      out.emptyFab = q('.hol-fab').disabled;
      // Thailand: 📄 loads the list kept in the app for the year that file has
      S.year = Number(thY); Holidays.pick('TH'); await Holidays.load();
      out.thRows = qa('.hol-list tr').length; out.thFab = q('.hol-fab').dataset.state;
      Holidays.tick(0, false); Holidays.tick(1, false);
      out.dirty = [q('.hol-fab').dataset.state, !!q('.hol-chip[aria-pressed="true"] .hol-dot'), qa('.hol-list input:checked').length];
      await Holidays.save();
      const w = writes[writes.length - 1];
      out.save = { path: w[0] + '/' + w[1], n: w[2].items.length, country: w[2].country, year: w[2].year, ts: w[2].updatedAt, sorted: JSON.stringify(w[2].items.map(i => i.d)) === JSON.stringify(w[2].items.map(i => i.d).sort()), firstDay: w[2].items[0].d, keys: Object.keys(w[2].items[0]) };
      out.afterSave = [q('.hol-fab').dataset.state, qa('.hol-chip').find(b => b.getAttribute('aria-label') === 'Thailand').textContent.includes('✓ 20')];
      await new Promise(r => setTimeout(r, 2200)); out.settled = q('.hol-fab').dataset.state;
      // Japan from Nager.Date: sorted, the local name is dropped when it equals the English one
      S.year = year; Holidays.pick('JP'); await Holidays.load();
      out.jp = qa('.hol-list tr').map(tr => tr.querySelector('td.d').textContent + ' ' + tr.textContent.replace(/\s+/g, ' ').trim());
      // Korea answers 204 (no list) → an empty list, no error
      Holidays.pick('KR'); await Holidays.load(); out.kr = [qa('.hol-list tr').length, S.state];
      // a failing save
      Holidays.pick('JP'); await Holidays.load(); failWrites = true; await Holidays.save(); out.err = [q('.hol-fab').dataset.state, q('.hol-fab').title]; failWrites = false;
      // saved JP is shown again when the chip is picked (ticked rows) and re-loading keeps the ticks
      Holidays.tickAll(false); Holidays.tick(1, true); await Holidays.save();
      Holidays.pick('TH'); Holidays.pick('JP'); out.jpSaved = [qa('.hol-list tr').length, qa('.hol-list input:checked').length, S.from];
      await Holidays.load(); out.jpReload = [qa('.hol-list tr').length, qa('.hol-list input:checked').length];
      // ---- the Dashboard strip: saved holidays + health / cat days around TODAY
      const t = n => dayStr(n);
      S.saved['TH_' + year] = [{ d: t(-1), en: 'Yesterday Holiday', local: '' }, { d: t(5), en: 'Soon Holiday', local: '' }, { d: t(20), en: 'Far Holiday', local: '' }, { d: t(-4), en: 'Too Old Holiday', local: '' }];
      S.obsList = [{ md: t(2).slice(5), k: 'm', en: 'Health Day' }, { md: t(2).slice(5), k: 'c', en: 'Cat Day' }, { md: t(14).slice(5), k: 'm', en: 'Edge Day' }, { md: t(15).slice(5), k: 'm', en: 'Beyond Day' }];
      S.obs = {}; S.obs[t(2).slice(0, 4)] = [{ d: t(2), k: 'c', en: 'Cat Day' }];
      Holidays.renderStrip();
      const strip = () => document.getElementById('hol-strip'), pills = () => [...strip().querySelectorAll('.hol-pill')].map(p => ({ title: p.title, text: p.textContent.replace(/\s+/g, ' ').trim(), op: p.style.opacity, ok: p.querySelector('.hol-ok').classList.contains('on'), fixed: p.querySelector('.hol-ok').classList.contains('fixed') }));
      out.strip = pills(); out.stripHost = strip().parentElement.id;
      // approve the health day, hide the cat kind, then break a write and see it roll back
      strip().querySelectorAll('.hol-ok')[1].click(); await new Promise(r => setTimeout(r, 50));
      out.obsWrite = (() => { const w2 = writes[writes.length - 1]; return [w2[1], w2[2].items.map(i => i.k + ':' + i.en).sort()]; })();
      Holidays.toggleKind('c'); out.noCat = pills().map(p => p.title === 'Cat Day').includes(true); Holidays.toggleKind('c');
      failWrites = true; const before = pills().filter(p => p.ok).length; strip().querySelectorAll('.hol-ok')[4].click(); await new Promise(r => setTimeout(r, 50)); out.rollback = [before, pills().filter(p => p.ok).length]; failWrites = false;
      S.saved = {}; S.obsList = []; Holidays.renderStrip(); out.emptyHidden = strip().hidden;
      return out;
    }, { TH, OBS, NAGER_JP });
    const nth = (JSON.parse(fs.readFileSync('public/th-holidays.json', 'utf8')).years); const thN = nth[Object.keys(nth)[0]].length;
    assert.deepEqual(r.chips, ['Thailand', 'Japan', 'South Korea', 'Singapore', String(new Date().getFullYear()), String(new Date().getFullYear() + 1)].slice(0, 4).concat(r.chips.slice(4)), 'four flag chips + two year chips: ' + r.chips);
    assert.ok(r.sgSaved.includes('✓ 1'), 'a country with a saved document shows ✓ n on its flag'); assert.equal(r.emptyFab, true, 'nothing to save yet → the ring is disabled');
    assert.equal(r.thRows, thN, '📄 loads all the Thai days'); assert.equal(r.thFab, 'idle', 'loaded, nothing changed = quiet');
    assert.deepEqual(r.dirty, ['dirty', true, thN - 2], 'two unticked → the ring is "dirty", the flag chip has the amber dot');
    assert.equal(r.save.path, 'holidays/TH_' + Object.keys(nth)[0], 'one document per country and year'); assert.equal(r.save.n, thN - 2, 'only the ticked days'); assert.equal(r.save.country, 'TH'); assert.equal(r.save.ts, 'TS');
    assert.ok(r.save.sorted && JSON.stringify(r.save.keys) === JSON.stringify(['d', 'en', 'local']), 'sorted, { d, en, local }');
    assert.deepEqual(r.afterSave, ['saved', true], 'saved → the ring turns "saved" and the flag shows ✓ n'); assert.equal(r.settled, 'idle', 'two seconds later it is quiet again');
    assert.deepEqual(r.jp.map(x => x.slice(0, 5)), ['01-01', '02-11', '03-20', '05-04'], 'Nager.Date is sorted by date: ' + r.jp);
    assert.ok(r.jp[0].includes('元日') && !/Vernal Equinox Day Vernal/.test(r.jp[2]), 'the local name is shown, but not twice when it equals the English one');
    assert.deepEqual(r.kr, [0, 'idle'], '204 = an empty list, not an error');
    assert.equal(r.err[0], 'error'); assert.match(r.err[1], /permission-denied/, 'a failed save shows the error on the ring (tooltip)');
    assert.deepEqual(r.jpSaved, [1, 1, 'saved'], 'a saved calendar comes back as ticked rows'); assert.deepEqual(r.jpReload, [4, 1], 're-loading the source list keeps the saved ticks');
    const pills = r.strip;
    assert.deepEqual(pills.map(p => p.title), ['Yesterday Holiday', 'Health Day', 'Cat Day', 'Soon Holiday', 'Edge Day'], 'window: 3 days back … 14 ahead (4 days old, 15 and 20 ahead are out): ' + JSON.stringify(pills.map(p => p.text)));
    assert.equal(pills[0].op, '0.5', 'a day that is past is faded'); assert.ok(pills[0].fixed && pills[0].ok && pills[3].fixed, 'public holidays are ✓ (ticked in the panel), not switchable here');
    assert.deepEqual(pills.filter(p => !p.fixed).map(p => p.ok), [false, true, false], 'health / cat days need an approval: only the Cat Day is approved'); assert.equal(r.stripHost, 'tab-sidequest', 'the strip sits at the top of the Dashboard');
    assert.equal(r.obsWrite[0].startsWith('OBS_'), true, 'approvals are saved in holidays/OBS_<year>'); assert.deepEqual(r.obsWrite[1], ['c:Cat Day', 'm:Health Day'], 'approving the health day keeps the cat day');
    assert.equal(r.noCat, false, 'the kind switch hides the cat days'); assert.deepEqual(r.rollback, [r.rollback[0], r.rollback[0]], 'a failed write rolls the ✓ back'); assert.equal(r.emptyHidden, true, 'nothing in the window → the strip is hidden');
    console.log('PASS: admin Holidays — panel beside the Event form (load / tick / ring save → holidays/<CC>_<year>), Dashboard strip (−3…+14 days, ✓ approvals in OBS_<year>, rollback), rule + wiring');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
