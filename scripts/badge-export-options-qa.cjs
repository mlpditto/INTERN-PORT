// V102.265 — Export badges: more options. ⭐ Score on/off (the line under the name), Labels = Name + count / Name / None, Corners = Clear
// (see-through) / White (rounded card on a white square). Real admin.html functions + the real dialog in Chromium; the PNG corner pixel is read back.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(fs.readFileSync('public/admin.html', 'utf8')));
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    const r = await page.evaluate(async () => {
      const out = {};
      const badges = {}; BADGE_STATS_DEFS.slice(0, 5).forEach((d, i) => { badges[d.id] = { level: Math.min(i + 1, 3) }; });
      usersData = [{ id: 'u1', displayName: 'nt', division: 'Hospital', group: 'PRETEST', score: 3.31, badges }];
      eventStampsCache = [];
      document.body.insertAdjacentHTML('beforeend', '<button id="trig" type="button">x</button>');
      openUserBadgesPop({ stopPropagation() {}, currentTarget: document.getElementById('trig') }, 'u1', false);
      document.querySelector('#user-badges-pop button[aria-label="Export badge board"]').click();
      const st = badgeExportState;
      out.defaults = [st.showName, st.showScore, st.labels, st.bg];
      const texts = (l, extra) => { const s = badgeBoardSvg(Object.assign({}, st, { layout: l }, extra), l, 600); return [...new DOMParser().parseFromString(s, 'image/svg+xml').querySelectorAll('text')].map(t => t.textContent); };
      const geom = (l, extra) => { const g = badgeBoardGeom(Object.assign({}, st, { layout: l }, extra), l); return [g.row, g.h]; };
      out.t = {};
      for (const l of ['card', 'banner', 'story']) {
        out.t[l] = { full: texts(l), name: texts(l, { labels: 'name' }), none: texts(l, { labels: 'none' }), noScore: texts(l, { showScore: false }), noName: texts(l, { showName: false }) };
        out.t[l].file = [badgeExportFileName(Object.assign({}, st, { layout: l })), badgeExportFileName(Object.assign({}, st, { layout: l, showName: false }))];
        out.t[l].geom = { full: geom(l), name: geom(l, { labels: 'name' }), none: geom(l, { labels: 'none' }) };
      }
      // the dialog
      out.dialog = document.getElementById('badge-export-dialog').innerText;
      // chips really change the state and re-render
      const click = txt => { const b = [...document.querySelectorAll('#badge-export-dialog button')].find(x => x.textContent.trim() === txt); b.click(); };
      click('Name'); out.afterName = badgeExportState.labels;
      // corners: read the PNG's corner pixel
      const corner = async bg => {
        const blob = await badgeExportPng(Object.assign({}, st, { layout: 'card', avatar: 'none', bg }));
        const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
        return [...x.getImageData(2, 2, 1, 1).data];
      };
      out.cornerClear = await corner('clear'); out.cornerWhite = await corner('white');
      return out;
    });
    assert.deepEqual(r.defaults, [true, true, 'full', 'clear'], 'defaults = today\'s look');
    for (const l of ['card', 'banner', 'story']) {
      const T = r.t[l];
      assert.ok(T.full.some(x => /^\d+\+ /.test(x)), l + ': full has the milestone lines');
      assert.ok(!T.name.some(x => /^\d+\+ /.test(x)) && T.name.includes('On Fire'), l + ': Name = titles only');
      assert.ok(!T.none.includes('On Fire') && !T.none.some(x => /^\d+\+ /.test(x)), l + ': None = no labels');
      assert.ok(T.geom.none[0] < T.geom.name[0] && T.geom.name[0] < T.geom.full[0] && T.geom.none[1] < T.geom.name[1] && T.geom.name[1] < T.geom.full[1], l + ': the image shrinks with the labels ' + JSON.stringify(T.geom));
    }
    assert.deepEqual([r.t.card.geom.none[0], r.t.banner.geom.none[0], r.t.story.geom.none[0]], [54, 62, 72], 'no labels = the pre-label geometry exactly');
    assert.ok(r.t.card.full.includes('⭐ 3.31') && r.t.story.full.includes('⭐ 3.31') && !r.t.card.noScore.includes('⭐ 3.31') && !r.t.story.noScore.some(x => x.includes('⭐')), 'score off: card / story drop the ⭐ line');
    assert.ok(r.t.banner.full.includes('Hospital › PRETEST') && !r.t.banner.noScore.includes('Hospital › PRETEST'), 'score off: the banner drops the line under the name too');
    assert.ok(r.t.card.noScore.includes('nt'), 'the name stays');
    for (const l of ['card', 'banner', 'story']) {
      assert.ok(r.t[l].full.includes('nt') && !r.t[l].noName.includes('nt'), l + ': Person Hide removes the name from the picture');
      assert.ok(r.t[l].noName.some(x => /^\d+\+ /.test(x)) && r.t[l].noName.includes('On Fire'), l + ': the badge labels stay');
      assert.deepEqual(r.t[l].file, ['badges-nt-' + l + '.png', 'badges-' + l + '.png'], l + ': the file name drops the name too');
    }
    assert.ok(r.t.card.noName.includes('⭐ 3.31'), 'Person Hide leaves the score (a separate switch)');
    for (const w of ['Person', 'Score', 'Labels', 'Name + count', 'Corners', 'Transparent', 'White']) assert.ok(r.dialog.includes(w), 'dialog offers ' + w);
    assert.equal(r.afterName, 'name', 'the Name chip sets labels');
    assert.equal(r.cornerClear[3], 0, 'Transparent: the corner pixel is see-through');
    assert.deepEqual(r.cornerWhite, [255, 255, 255, 255], 'White: the corner pixel is opaque white');
    console.log('PASS: badge export options — Score on/off, Labels (name + count / name / none), Corners (clear / white), image shrinks with the labels, PNG corner pixel read back');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
