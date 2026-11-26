// V102.704 🎮 game time on the admin Dashboard (owner pick B, mockup-game-time-admin/). admin.html wiring checked as text (card under
// the 🥣 line, the script, the refresh beside cerealAdmin's, the version); the REAL game-admin.js run on a page with a fake db + users:
// one query on game_plays endedAt ≥ now − 7 d; a chip per game that has plays, the first on; a row per person, slowest first; ⌛ = the
// average seconds per round over all their rounds; 🐢 / ⚡ against the others' median (3+ people); the last game's bars with its longest
// round 🟧; 🏆 wins / games (นับไว: ✓ average / 5); a chip tap switches the table; hidden with no plays or a failed read; 5-min throttle.
// firestore.rules: game_plays read = admin only, create = own (authUid + linked userId), no update.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const admin = fs.readFileSync('public/admin.html', 'utf8');
const ver = (admin.match(/<title>Nika Admin \((V102\.\d+)\)<\/title>/) || [])[1];
assert.ok(/<div id="gt-admin" class="lang-no-toggle" hidden><\/div>/.test(admin) && admin.indexOf('id="ck-admin-strip"') < admin.indexOf('id="gt-admin"') && admin.indexOf('id="gt-admin"') < admin.indexOf('id="quiz-dash"'), 'the card sits under the 🥣 line, above #quiz-dash');
assert.ok(admin.includes(`<script src="game-admin.js?v=${ver}"></script>`), 'script tag with the admin version');
assert.ok(/if \(window\.cerealAdmin\) window\.cerealAdmin\.refresh\(\);[^\n]*\n\s*if \(window\.gameAdmin\) window\.gameAdmin\.refresh\(\);/.test(admin), 'refreshed with the 🥣 line');
const rules = fs.readFileSync('firestore.rules', 'utf8'), m = rules.match(/match \/game_plays\/\{playId\} \{([\s\S]*?)\n    \}/);
assert.ok(m, 'game_plays rules'); const r = m[1];
assert.ok(/allow read: if isAdmin\(\);/.test(r) && /request\.resource\.data\.authUid == request\.auth\.uid/.test(r) && /isSelfOrLinked\(request\.resource\.data\.userId\)/.test(r) && /allow update: if false;/.test(r) && /hasOnly\(/.test(r), 'admin reads; own create; no update');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const NOW = 1.8e12, D = 864e5;
  await page.setContent('<meta charset="utf-8"><div id="gt-admin" hidden></div>');
  await page.evaluate(({ NOW, D }) => {
    Date.now = () => NOW; window.__q = []; window.__fail = false;
    const S = (u, game, rounds, win, score, ago) => ({ userId: u, game, rounds, win, score, endedAt: NOW - ago });
    window.__docs = [
      S('a', 'bw', [10, 20, 60, 10], 'w', '5:3', 1000), S('a', 'bw', [30, 30], 'l', '2:5', 5000),           // a: 160 / 6 ≈ 26.7 → 🐢
      S('b', 'bw', [12, 14, 13], 'w', '5:1', 2000), S('c', 'bw', [15, 15], 'd', '4:4', 3000), S('d', 'bw', [4, 4, 4], 'l', '0:5', 4000),   // d ⚡
      S('a', 'count', [3, 5, 7, 2, 3], null, '4/5', 1000), S('b', 'count', [10, 10, 10, 10, 10], null, '2/5', 1000), S('b', 'count', [8, 8, 8, 8, 8], null, '3/5', 9000),
    ];
    window.usersData = [{ id: 'a', nickname: 'มายด์', pictureUrl: 'x.png' }, { id: 'b', displayName: 'ต้นข้าว' }, { id: 'c', displayName: 'ปอนด์' }, { id: 'd', nickname: 'เฟิร์น' }];
    window.db = { collection: (n) => ({ where: (f, op, v) => ({ get: () => { window.__q.push([n, f, op, v]); return window.__fail ? Promise.reject(new Error('x')) : Promise.resolve({ docs: window.__docs.filter((d) => d.endedAt >= v).map((d) => ({ data: () => d })) }); } }) }) };
  }, { NOW, D });
  await page.addScriptTag({ path: path.resolve('public/game-admin.js') });
  await page.evaluate(() => gameAdmin.refresh());
  await page.waitForFunction(() => !document.getElementById('gt-admin').hidden);
  assert.deepEqual(await page.evaluate(() => window.__q), [['game_plays', 'endedAt', '>=', NOW - 7 * D]], 'one query, last 7 days');
  const read = () => page.evaluate(() => ({
    chips: [...document.querySelectorAll('#gt-admin [aria-label="Game"] .gt-chip')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')),
    head: [...document.querySelectorAll('#gt-admin th')].map((t) => t.textContent),
    rows: [...document.querySelectorAll('#gt-admin tbody tr')].map((tr) => [...tr.cells].map((c, i) => (i === 3 ? [...c.querySelectorAll('i')].map((x) => (x.classList.contains('hi') ? 'H' : '.')).join('') : c.textContent.trim()))),
  }));
  let v = await read();
  assert.deepEqual(v.chips, ['⚫ ไพ่เงา*', '🧊 นับไว'], 'chips only for games with plays; the first on');
  assert.deepEqual(v.head, ['คน', '🎮', '⌛ วิ/ตา', 'เกมล่าสุด', '🏆']);
  assert.deepEqual(v.rows, [['มายด์', '2', '27 🐢', '..H.', '1/2'], ['ปอนด์', '1', '15', 'H.', '0/1'], ['ต้นข้าว', '1', '13', '.H.', '1/1'], ['เฟิร์น', '1', '4 ⚡', 'H..', '0/1']], 'per person, slowest first, flags, last game bars, wins');
  await page.click('#gt-admin [aria-label="Game"] .gt-chip:nth-child(2)');
  v = await read();
  assert.deepEqual(v.chips, ['⚫ ไพ่เงา', '🧊 นับไว*']); assert.equal(v.head[2], '⌛ วิ/ข้อ'); assert.equal(v.head[4], '✓');
  assert.deepEqual(v.rows, [['ต้นข้าว', '2', '9', 'H....', '2.5/5'], ['มายด์', '1', '4', '..H..', '4.0/5']], 'นับไว: ✓ average, no flags under 3 people');
  assert.equal(await page.$$eval('#gt-admin img.av', (e) => e.length), 1, 'a photo when the user has one');
  // throttle, then a failed read hides it; no plays hides it
  await page.evaluate(() => gameAdmin.refresh()); assert.equal(await page.evaluate(() => window.__q.length), 1, 'at most every 5 min');
  await page.evaluate(() => { window.__fail = true; return gameAdmin.refresh(true); }); await page.waitForTimeout(50);
  assert.equal(await page.$eval('#gt-admin', (e) => e.hidden), true, 'a failed read hides it');
  await page.evaluate(() => { window.__fail = false; window.__docs = []; return gameAdmin.refresh(true); }); await page.waitForTimeout(50);
  assert.equal(await page.$eval('#gt-admin', (e) => e.hidden), true, 'no plays: hidden');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('game-admin-qa: OK — card under 🥣, one 7-day query, chips per game, per person slowest first, 🐢/⚡, last-game bars 🟧, wins / ✓ avg, chip switch, throttle, hidden on fail/empty; rules admin-read own-create');
})().catch((e) => { console.error(e); process.exit(1); });
