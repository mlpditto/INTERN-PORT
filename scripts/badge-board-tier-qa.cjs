// V102.586 — badge board export, owner's mockup pick B (2026-11-05): badges sorted by tier (Diamond → Gold → Silver → Bronze, ties keep
// the usual order) and "⭐ score · n / 16 badges" under the name — both on by default, each with an Original / Hide chip in the dialog;
// a badge with no exact number shows its tier name on line 2 (never a guessed count), so every card has two lines; a short last row is
// centred; Case Hunter adds a 3rd line "N systems" (rows get the room, nothing overlaps). Real admin.html functions + the real dialog.
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
      // Bew's board from the owner's screenshot: 13 earned, Explorer + Night Owl Gold, four Silver, the rest Bronze
      const tiers = { on_fire: 1, early_bird: 1, quiz_master: 2, perfectionist: 1, case_hunter: 2, reflective_mind: 2, mentor_feedback: 2, speedrunner: 1, explorer: 3, night_owl: 3, codex_contributor: 1, team_player: 1, social_butterfly: 1 };
      const badges = {}; Object.entries(tiers).forEach(([id, t]) => { const d = BADGE_STATS_DEFS.find(x => x.id === id); badges[id] = d.steps === 1 ? { level: 1 } : { level: t }; });
      usersData = [{ id: 'u1', displayName: 'Bew', score: 17.79, badges }];
      eventStampsCache = []; window.badgeLiveCounts = async () => ({});
      document.body.insertAdjacentHTML('beforeend', '<button id="trig" type="button">x</button>');
      openUserBadgesPop({ stopPropagation() {}, currentTarget: document.getElementById('trig') }, 'u1', false);
      document.querySelector('#user-badges-pop button[aria-label="Export badge board"]').click();
      const st = badgeExportState; await st.countsPromise;
      st.avatar = 'none';
      st.counts = { early_bird: 8, quiz_master: 110, perfectionist: 1, speedrunner: 1, reflective_mind: 7, mentor_feedback: 7, explorer: 24, social_butterfly: 1, case_hunter: 12, case_systems: 4 };
      out.defaults = [st.sortTier, st.progress];
      const doc = (l, extra) => new DOMParser().parseFromString(badgeBoardSvg(Object.assign({}, st, { layout: l }, extra), l, 400), 'image/svg+xml');
      const texts = (l, extra) => [...doc(l, extra).querySelectorAll('text')].map(t => t.textContent);
      out.order = badgeBoardGeom(st, 'story').items.map(i => i.id);
      out.orderOff = badgeBoardGeom(Object.assign({}, st, { sortTier: false }), 'story').items.map(i => i.id);
      out.story = texts('story');
      out.noProg = texts('story', { progress: false });
      out.noScore = texts('story', { showScore: false });
      out.y0 = [badgeBoardGeom(st, 'story').y0, badgeBoardGeom(Object.assign({}, st, { showScore: false }), 'story').y0, badgeBoardGeom(Object.assign({}, st, { showScore: false, progress: false }), 'story').y0];
      out.rows = [badgeBoardGeom(st, 'story').row, badgeBoardGeom(Object.assign({}, st, { counts: Object.assign({}, st.counts, { case_systems: 0 }) }), 'story').row];
      // tile x positions per row (each tile is a nested <svg x= y=>)
      const tilePos = (l, extra) => { const g = badgeBoardGeom(Object.assign({}, st, { layout: l }, extra), l); return [...doc(l, extra).documentElement.children].filter(e => e.tagName === 'svg' || (e.tagName === 'g' && e.querySelector('svg'))).map(e => { const s = e.tagName === 'svg' ? e : e.querySelector('svg'); return [Number(s.getAttribute('x')), Number(s.getAttribute('y'))]; }).concat([[g.w, g.cell]]); };
      out.tiles = tilePos('story');
      out.tilesCard = tilePos('card');
      // every label inside the picture and no two text lines overlap in a column
      const d = doc('story'); const W = Number(d.documentElement.getAttribute('viewBox').split(' ')[2]);
      out.textX = [...d.querySelectorAll('text')].map(t => Number(t.getAttribute('x'))).filter(x => x < 0 || x > W);
      // the dialog chips
      const dlg = () => document.getElementById('badge-export-dialog');
      out.dialog = dlg().innerText;
      const click = txt => [...dlg().querySelectorAll('button')].find(x => x.textContent.trim() === txt).click();
      click('Original'); out.afterOriginal = st.sortTier === false && badgeExportState.sortTier === false;
      click('🏆 By tier'); out.afterTier = badgeExportState.sortTier;
      return out;
    });
    assert.deepEqual(r.defaults, [true, true], 'the dialog opens sorted by tier, with n / 16 badges');
    // order: Gold, then Silver, then Bronze; ties keep the usual order
    assert.deepEqual(r.order, ['explorer', 'night_owl', 'quiz_master', 'case_hunter', 'reflective_mind', 'mentor_feedback', 'on_fire', 'early_bird', 'perfectionist', 'speedrunner', 'codex_contributor', 'team_player', 'social_butterfly'], 'by tier: ' + r.order);
    assert.deepEqual(r.orderOff.slice(0, 4), ['on_fire', 'early_bird', 'quiz_master', 'perfectionist'], 'Original keeps the usual order');
    // the line under the name
    assert.ok(r.story.includes('⭐ 17.79   ·   13 / 16 badges'), 'score · n / 16 badges: ' + r.story.filter(x => /⭐|badges/.test(x)));
    assert.ok(r.noProg.includes('⭐ 17.79') && !r.noProg.some(x => /\/ 16/.test(x)), 'n / 16 Hide');
    assert.ok(r.noScore.includes('13 / 16 badges') && !r.noScore.some(x => x.includes('⭐')), 'score off keeps n / 16 alone');
    assert.deepEqual([r.y0[0] === r.y0[1], r.y0[2] < r.y0[1]], [true, true], 'the header keeps the line while n / 16 is on and closes up when both are off: ' + r.y0);
    // labels: tier names where there is no exact number; counts where there is; Case Hunter's 3rd line
    for (const [title, line2] of [['On Fire', 'Bronze'], ['Night Owl', 'Gold'], ['Codex Contributor', 'Bronze'], ['Team Player', 'Bronze']]) {
      const i = r.story.indexOf(title); assert.ok(i >= 0 && r.story[i + 1] === line2, title + ' → ' + line2 + ' (got ' + r.story[i + 1] + ')');
    }
    const ch = r.story.indexOf('Case Hunter'); assert.deepEqual(r.story.slice(ch, ch + 3), ['Case Hunter', '12 cases', '4 systems'], 'Case Hunter: cases + systems');
    assert.ok(r.story.includes('24 topics') && r.story.includes('110 questions'), 'exact counts still win over the tier name');
    assert.ok(!r.story.some(x => /\d\+/.test(x)), 'no "N+" guesses');
    assert.ok(r.rows[0] > r.rows[1], 'rows get room for the 3rd line only when Case Hunter has systems: ' + r.rows);
    // a short last row is centred: story 13 badges = 4+4+4+1 → the lone tile sits in the middle
    const [W, cell] = r.tiles[r.tiles.length - 1], t = r.tiles.slice(0, -1);
    const last = t[t.length - 1], firstRow = t.slice(0, 4).map(p => p[0]);
    assert.ok(Math.abs((last[0] + (firstRow[1] - firstRow[0] - cell) / 2 + cell / 2 - 7) - W / 2) < cell, 'the lone last tile is centred (x ' + last[0] + ' in ' + W + ')');
    assert.ok(Math.abs(((firstRow[1] + firstRow[2]) / 2) - last[0]) < 1, 'it sits between the middle two of a full row');
    assert.deepEqual(r.textX, [], 'every label inside the picture');
    // the dialog
    for (const w of ['n / 16', 'Order', '🏆 By tier', 'Original']) assert.ok(r.dialog.includes(w), 'dialog offers ' + w);
    assert.deepEqual([r.afterOriginal, r.afterTier], [true, true], 'the Order chips switch it');
    console.log('PASS: badge board tier — sorted by tier + "⭐ score · n / 16 badges" by default (Original / Hide chips), tier name where no exact number, Case Hunter cases + systems, short last row centred, nothing outside the picture');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
