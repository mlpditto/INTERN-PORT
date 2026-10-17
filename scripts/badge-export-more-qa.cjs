// V102.269 — Export badges: (1) the header closes up when the name / score line is off (no big gap), (2) leave single badges out (🏅), (3) an optional bottom line:
// 📚 questions · ⭐ perfect quizzes · 🧭 topics (counts that were read, for the badges shown) and 🆕 the latest badge date. Real admin.html in Chromium.
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
      const ts = ms => ({ toDate: () => new Date(ms), toMillis: () => ms });
      const badges = {}; ['on_fire', 'quiz_master', 'perfectionist', 'explorer', 'social_butterfly'].forEach((id, i) => { badges[id] = { level: 2, earnedAt: ts(Date.UTC(2026, 9, 1 + i * 3, 5)) }; });   // explorer = 10 Oct, social_butterfly = 13 Oct (latest)
      usersData = [{ id: 'u1', displayName: 'nt', division: 'H', group: 'P', score: 3.31, pictureUrl: 'https://example.com/p.png', badges }];
      eventStampsCache = []; window.badgeLiveCounts = async () => ({});
      document.body.insertAdjacentHTML('beforeend', '<button id="trig" type="button">x</button>');
      openUserBadgesPop({ stopPropagation() {}, currentTarget: document.getElementById('trig') }, 'u1', false);
      document.querySelector('#user-badges-pop button[aria-label="Export badge board"]').click();
      const st = badgeExportState; await st.countsPromise; st.avatar = 'photo'; st.photo64 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
      st.counts = { quiz_master: 261, perfectionist: 11, explorer: 58, on_fire: 4 };
      const mk = extra => Object.assign({}, st, extra);
      const y0 = (l, extra) => badgeBoardGeom(mk(Object.assign({ layout: l }, extra)), l).y0;
      out.y0 = { story: [y0('story', {}), y0('story', { showName: false }), y0('story', { showScore: false }), y0('story', { showName: false, showScore: false })], card: [y0('card', {}), y0('card', { showName: false, showScore: false })] };
      const texts = (l, extra) => [...new DOMParser().parseFromString(badgeBoardSvg(mk(Object.assign({ layout: l }, extra)), l, 400), 'image/svg+xml').querySelectorAll('text')].map(t => t.textContent);
      // the score line sits right under the name, or in the name's place when the name is off
      const pos = (l, extra) => { const d = new DOMParser().parseFromString(badgeBoardSvg(mk(Object.assign({ layout: l }, extra)), l, 400), 'image/svg+xml'); return [...d.querySelectorAll('text')].filter(t => /3\.31/.test(t.textContent)).map(t => Number(t.getAttribute('y'))); };
      out.scoreY = { both: pos('story', {}), noName: pos('story', { showName: false }) };
      out.tiles = ['card', 'story', 'banner'].map(l => [badgeBoardGeom(mk({ layout: l }), l).items.filter(i => i.t).length, badgeBoardGeom(mk({ layout: l, hide: ['on_fire'] }), l).items.filter(i => i.t).length]);
      out.foot = {}; for (const l of ['card', 'story', 'banner']) {
        out.foot[l] = { none: badgeBoardGeom(mk({ layout: l }), l).h, totals: badgeBoardGeom(mk({ layout: l, showTotals: true }), l).h, text: texts(l, { showTotals: true, showLatest: true }).filter(x => /[📚🆕]/u.test(x)) };
      }
      out.footTxt = badgeBoardFoot(mk({ showTotals: true, showLatest: true }), badgeBoardGeom(mk({ layout: 'card' }), 'card').items.filter(i => i.t));
      out.footHide = badgeBoardFoot(mk({ showTotals: true, showLatest: true, hide: ['quiz_master', 'social_butterfly'] }), badgeBoardGeom(mk({ layout: 'card', hide: ['quiz_master', 'social_butterfly'] }), 'card').items.filter(i => i.t));
      out.footNoCounts = badgeBoardFoot(mk({ showTotals: true, showLatest: true, counts: null }), badgeBoardGeom(mk({ layout: 'card' }), 'card').items.filter(i => i.t));
      out.footOff = badgeBoardFoot(mk({}), badgeBoardGeom(mk({ layout: 'card' }), 'card').items.filter(i => i.t));
      // dialog: one 🏅 button per earned badge, toggling leaves one out; the Σ chips
      const dlg = () => document.getElementById('badge-export-dialog');
      out.pickBtns = dlg().querySelectorAll('button[onclick^="badgeExportToggle"]').length;
      out.sigma = /📚⭐🧭/.test(dlg().innerText) && /🆕/.test(dlg().innerText);
      dlg().querySelector('button[onclick="badgeExportToggle(\'on_fire\')"]').click();
      out.afterToggle = [badgeExportState.hide.slice(), dlg().querySelector('button[onclick="badgeExportToggle(\'on_fire\')"]').getAttribute('aria-pressed')];
      Object.assign(badgeExportState, { showTotals: true, showLatest: true, layout: 'story' }); const blob = await badgeExportPng(badgeExportState); out.png = { type: blob.type, ok: blob.size > 2000 };
      return out;
    });
    assert.deepEqual(r.y0.story, [268, 238, 244, 214], 'story: both lines 268 → name only 238 → score only 244 → neither 214 (the old gap was 268)');
    assert.deepEqual(r.y0.card, [142, 102], 'card: 142 → 102 with neither');
    assert.deepEqual(r.scoreY.noName, [r.scoreY.both[0] - 24], 'with the name off the score takes the name\'s place: ' + JSON.stringify(r.scoreY));
    r.tiles.forEach(t => assert.equal(t[0] - t[1], 1, 'hiding a badge removes exactly one tile: ' + JSON.stringify(r.tiles)));
    assert.deepEqual([r.foot.card.totals - r.foot.card.none, r.foot.story.totals - r.foot.story.none, r.foot.banner.totals - r.foot.banner.none], [26, 34, 24], 'the footer line adds its own room');
    for (const l of ['card', 'story', 'banner']) assert.ok(r.foot[l].text.length === 1 && /📚 261/.test(r.foot[l].text[0]) && /🆕/.test(r.foot[l].text[0]), l + ': the line is drawn: ' + r.foot[l].text);
    assert.equal(r.footTxt, '📚 261   ·   ⭐ 11   ·   🧭 58   ·   🆕 13 Oct', 'totals + latest date');
    assert.equal(r.footHide, '⭐ 11   ·   🧭 58   ·   🆕 10 Oct', 'a hidden badge takes its total and its date out');
    assert.equal(r.footNoCounts, '🆕 13 Oct', 'no counts read → no totals (never zeros)');
    assert.equal(r.footOff, '', 'off by default');
    assert.equal(r.pickBtns, 5, 'one 🏅 button per earned badge'); assert.ok(r.sigma, 'Σ chips');
    assert.deepEqual(r.afterToggle, [['on_fire'], 'false'], 'the toggle leaves a badge out and re-renders');
    assert.deepEqual(r.png, { type: 'image/png', ok: true }, 'PNG with the footer encodes');
    console.log('PASS: badge export more — header closes up when name/score are off, single badges can be left out, optional 📚⭐🧭 + 🆕 line (counts read only, hidden badges excluded)');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
