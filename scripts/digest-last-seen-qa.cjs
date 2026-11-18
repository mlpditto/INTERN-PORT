// QA — Daily Quiz Digest 👀 Last seen (2026-11-18, owner pick B + Telegram).
// Group bubble: 💤 only tracked users away 3 d+. Telegram (admin): every tracked user with a time.
// Admin ▸ LINE card: chip row saved to _meta/digest_seen.uids.
// Run: node scripts/digest-last-seen-qa.cjs   (needs Playwright via PLAYWRIGHT_MODULE or NODE_PATH)
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const fn = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
const adm = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

// --- 1. labels: slice the real helpers and run them -------------------------------------------
const grab = (src, start, endMark) => { const i = src.indexOf(start); assert.ok(i >= 0, 'missing ' + start); const j = src.indexOf(endMark, i); return src.slice(i, j); };
// bkkDayKey → bkkDayGap → the 👀 helpers sit together, right above digestDueLabel's comment
const helpers = grab(fn, 'function bkkDayKey(ms)', '// How a deadline is phrased');
ok(helpers.includes('function bkkDayGap') && helpers.includes('function digestSeenLabel'), 'helpers sliced from functions/index.js');
const H = new Function(helpers + '\nreturn { digestSeenLabel, digestSeenDate, DIGEST_SEEN_AWAY_DAYS };')();
const now = Date.parse('2026-11-15T16:00:00Z');          // Sun 15 Nov 23:00 Bangkok
ok(H.DIGEST_SEEN_AWAY_DAYS === 3, 'away threshold is 3 days');
ok(H.digestSeenLabel(Date.parse('2026-11-15T02:12:00Z'), now) === 'today 09:12', 'same Bangkok day → today HH:MM');
ok(H.digestSeenLabel(Date.parse('2026-11-14T14:40:00Z'), now) === 'yesterday 21:40', 'previous Bangkok day → yesterday HH:MM');
ok(H.digestSeenLabel(Date.parse('2026-11-10T05:00:00Z'), now) === '5 d (10 Nov)', 'older → n d (date)');
ok(H.digestSeenLabel(NaN, now) === 'never' && H.digestSeenDate(NaN) === 'never', 'no lastSeen → never');
ok(H.digestSeenDate(Date.parse('2026-11-09T18:30:00Z')) === '10 Nov', 'date is Bangkok, not UTC');

// --- 2. wiring in runQuizDigest / pushLineFlex -------------------------------------------------
ok(/async function pushLineFlex\(tag, targets, buildFlex, logSuffix, telegramExtra\)/.test(fn), 'pushLineFlex takes telegramExtra');
ok(fn.includes("sendTelegram(tag, (f.altText || f.text || '') + (telegramExtra || ''))"), 'Telegram gets altText + the extra lines; LINE message unchanged');
ok(fn.includes("db.collection('_meta').doc('digest_seen').get()"), 'tracked list read from _meta/digest_seen');
ok(fn.includes('lastSeenMs: Number.isFinite(lastSeenMs) ? lastSeenMs : null'), 'users keep lastSeenMs');
const sec = grab(fn, '// 💤 Only tracked users away', '// V97.76: the Behind tally');
ok(/if \(awayRows\.length\)/.test(sec), 'group section only when someone is away');
ok(!/withScores/.test(sec), 'section does not depend on the admin copy');
ok(/cohort=\$\{activeUsers\.length\}\/\$\{users\.length\}`, seenTelegram\);/.test(fn), 'real push passes seenTelegram');
ok(/telegram: seenTelegram,/.test(fn), 'preview returns the Telegram lines');
const flexIdx = fn.indexOf('const buildFlex = (target) =>', fn.indexOf('async function runQuizDigest'));
ok(fn.indexOf('const seenTelegram') > 0 && fn.indexOf('const seenTelegram') < flexIdx, 'seen list built once per run, before buildFlex');

// --- 3. admin chip row in a real browser ------------------------------------------------------
ok(adm.includes('id="digest-seen-row"') && adm.includes('id="digest-seen-add"'), 'chip row + ＋ Add in the LINE card');
ok(/panel\.style\.display = 'block';\s*loadDigestSeen\(\);/.test(adm), 'loads when the LINE card draws');
ok(/\/\/ V\d+\.\d+|Nika Admin \(V102\.681\)/.test(adm) && adm.includes('<title>Nika Admin (V102.681)</title>'), 'admin title V102.681');
const block = grab(adm, '// 👀 Last seen in digest (2026-11-18)', '// V97.64: digest preview.');
const row = grab(adm, '<div id="digest-seen-row"', '</select>') + '</select></div>';

(async () => {
  const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><body>' + row + '</body>');
  await page.evaluate((code) => {
    window.__writes = [];
    window.__doc = { uids: ['u2'] };
    window.usersData = [
      { id: 'u1', displayName: 'Ploy', lastSeen: { toMillis: () => Date.now() } },
      { id: 'u2', displayName: 'Nida <b>', lastSeen: { toMillis: () => Date.now() - 5 * 864e5 } },
      { id: 'u3', displayName: 'Hidden', isIgnored: true },
    ];
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    window.db = { collection: (c) => ({ doc: (d) => ({
      get: async () => ({ exists: true, data: () => window.__doc }),
      set: async (v, o) => { window.__writes.push({ c, d, v, o }); window.__doc = Object.assign({}, window.__doc, v); },
    }) }) };
    (0, eval)(code);
  }, block);
  await page.evaluate(() => loadDigestSeen());
  await page.waitForTimeout(50);
  const chips = await page.$$eval('.digest-seen-chip', els => els.map(e => [e.dataset.uid, e.textContent, e.title]));
  ok(chips.length === 1 && chips[0][0] === 'u2' && chips[0][1].startsWith('Nida <b>') && chips[0][2] === 'seen 5 d ago', 'saved uid renders as a chip, name escaped, last seen in the tooltip');
  const opts = await page.$$eval('#digest-seen-add option', els => els.map(e => e.value));
  ok(JSON.stringify(opts) === JSON.stringify(['', 'u1']), '＋ Add lists active users not yet tracked (ignored + picked left out)');
  await page.selectOption('#digest-seen-add', 'u1');
  await page.waitForTimeout(50);
  let w = await page.evaluate(() => window.__writes);
  ok(w.length === 1 && w[0].c === '_meta' && w[0].d === 'digest_seen' && JSON.stringify(w[0].v.uids) === '["u2","u1"]' && w[0].o.merge === true, 'Add saves the uid list to _meta/digest_seen (merge)');
  ok((await page.$$('.digest-seen-chip')).length === 2 && (await page.$eval('#digest-seen-add', s => s.value)) === '', 'chip appears, select resets to ＋ Add');
  await page.click('.digest-seen-chip[data-uid="u2"] button');
  await page.waitForTimeout(50);
  w = await page.evaluate(() => window.__writes);
  ok(w.length === 2 && JSON.stringify(w[1].v.uids) === '["u1"]', '✕ removes and saves');
  await browser.close();
  console.log(`\nPASS ${pass}`);
})().catch(e => { console.error('FAIL', e && e.message); process.exit(1); });
