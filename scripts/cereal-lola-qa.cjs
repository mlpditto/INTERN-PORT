// V101.346 Phase 3 — 🐕 Lola on one phone (owner picks: lobby A = "🐕 3 คน" chip shows her card, the map chip cycles the 4 printed
// pairs; her turn = whole board with short cells + abilities as a rail like ❓ ถาม, mockup-cereal-lola/). Plays a real 3-player game
// on the REAL index.html: the suburb under the city, 🔪 → 🐕 → 🕵️, Lola blocks the killer, sniff / bark / bite, her answers never on
// another seat's screen, the 6th card 🏡, no horizontal scroll at 320 px. Nothing leaves the page.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const cell = id => '#cerealModal .ck-cell[data-id="' + id + '"]';
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); localStorage.setItem('cerealTourSeen', '1'); localStorage.setItem('cerealCoachSeen', 'all'); localStorage.setItem('cerealSound', 'off');
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
        const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
      });
      await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
      await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
      await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const o = document.getElementById('loading-overlay'); if (o) o.style.setProperty('display', 'none', 'important'); cerealOpen(); CK.tab('local'); CK.vs('friend'); });
      const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
      const noHScroll = () => page.evaluate(() => { const m = document.querySelector('#cerealModal .modal-content'); return m.scrollWidth <= m.clientWidth + 1; });

      // ---- lobby: 🐕 3 คน shows Lola's card; the map chip cycles the 4 pairs
      assert.equal(await page.$('#ck-n3'), null, '2 players by default: no Lola card');
      await page.fill('#ck-n1', 'Pond'); await page.fill('#ck-n2', 'Mint');
      await page.click('#ck-lola');
      assert.ok(await page.isVisible('#ck-n3'), '🐕 3 คน shows her card');
      assert.equal(await page.inputValue('#ck-n1'), 'Pond', 'names survive the toggle');
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-seat')].map(s => s.className.replace('ck-seat ', '').replace(' on', ''))), ['killer', 'lola', 'detective'], 'seats 🔪 🐕 🕵️');
      assert.equal(await page.$('#ck-side-A'), null, '3 players: the A | B chips give way to the pair chip');
      assert.equal(await txt('#ck-pair'), '🗺 🥄🥄', 'default pair = Skilled killer (A + A)');
      await page.click('#ck-pair'); assert.equal(await txt('#ck-pair'), '🗺 🥄🥄🥄');
      await page.click('#ck-pair'); await page.click('#ck-pair'); assert.equal(await txt('#ck-pair'), '🗺 🥄', 'cycles 4 → 1');
      await page.click('#ck-pair'); assert.equal(await txt('#ck-pair'), '🗺 🥄🥄');
      assert.ok(await noHScroll(), width + ': lobby fits');
      await page.fill('#ck-n3', 'Doggo');
      if (process.env.QA_SHOTS) await (await page.$('#cerealModal .modal-content')).screenshot({ path: process.env.QA_SHOTS + '/lola-lobby-' + width + '.png' });
      await page.click('#ck-start');

      // ---- day 1 killer: the tall board, Lola on the bowl blocks
      assert.ok((await txt('#cerealModal .ck-hand')).includes('Pond'));
      await page.click('#ck-hand-go');
      const board = await page.evaluate(() => ({ n: document.querySelectorAll('#cerealModal .ck-cell').length, tall: !!document.querySelector('#cerealModal .ck-board.tall'), seam: !!document.querySelector('#cerealModal .ck-seam'), dog: (document.querySelector('#cerealModal .ck-cell[data-id="22"] .tk') || {}).textContent }));
      assert.deepEqual(board, { n: 36, tall: true, seam: true, dog: '🐕' }, 'city + suburb A, seam line, 🐕 on the bowl (22)');
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#cerealModal .ck-cell[data-id="35"]')).gridRowStart), '9', 'suburb row 4 sits under the seam (holes kept)');
      await page.click(cell(1)); for (const id of [2, 3, 8]) await page.click(cell(id));
      await page.click('#ck-kill .ck-chip:has-text("🏠 3")'); await page.click('#ck-wit .ck-chip:has-text("🌳 4")');
      await page.click('#ck-lock');

      // ---- Lola's turn: hand-off to her, walk 22 › 17 › 18 › 13, sniff 8 = 🎯
      assert.ok((await txt('#cerealModal .ck-hand')).includes('Doggo'), 'the phone goes to Lola after the killer');
      await page.click('#ck-hand-go');
      assert.ok(await page.$('#cerealModal .ck.lola'), 'Lola screen');
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#ck-lola-ab .ck-q')].map(b => b.dataset.ab)), ['sniff', 'bark', 'bite'], 'abilities as a rail');
      assert.equal(await txt('#cerealModal .ck-top .ck-pill.acc'), '👣 4');
      assert.equal(await page.isDisabled(cell(16)), true, 'Lola never steps onto the subway from 17');
      // V101.348: her first-turn hints, one at a time: walk → ability → the answer is yours alone
      const coach = () => page.evaluate(() => { const c = document.getElementById('cerealCoach'); return c ? c.getAttribute('data-key') : null; });
      await page.evaluate(() => { localStorage.setItem('cerealCoachSeen', JSON.stringify({ home: 1, path: 1, chips: 1, lock: 1, cafe: 1, move: 1, ask: 1, arrest: 1 })); CK._.render(); });
      assert.equal(await coach(), 'lwalk', 'hint 1: walk');
      await page.click('#cerealCoach [data-ct="ok"]');
      await page.click(cell(17));
      assert.equal(await coach(), 'lab', 'hint 2 after the first step: one ability');
      await page.click('#cerealCoach [data-ct="ok"]');
      for (const id of [18, 13]) await page.click(cell(id));
      assert.equal(await txt('#cerealModal .ck-top .ck-pill.acc'), '👣 1');
      await page.click('#ck-lola-ab [data-ab="sniff"]');
      assert.equal(await page.isDisabled('#ck-lola-end'), true, 'pick a cell first (or ✕)');
      assert.equal(await page.isDisabled(cell(7)), true, 'sniff: own or next cell only');
      await page.click(cell(8));
      assert.equal(await coach(), 'lend', 'hint 3 with the answer: yours alone');
      await page.click('#cerealCoach [data-ct="ok"]');
      await page.evaluate(() => localStorage.setItem('cerealCoachSeen', 'all'));
      const ans = await txt('#ck-lola-ans');
      assert.ok(ans.includes('8') && ans.includes('อยู่ช่องนี้') && ans.includes('🔒'), 'private answer: ' + ans);
      assert.ok(/สมุด lola/i.test(await txt('#cerealModal .ck.lola')), 'her notebook');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#ck-lola-ab .ck-q')].every(b => b.disabled)), true, 'one ability a turn');
      if (process.env.QA_SHOTS) await (await page.$('#cerealModal .modal-content')).screenshot({ path: process.env.QA_SHOTS + '/lola-turn-' + width + '.png' });
      await page.click('#ck-lola-end');

      // ---- detective: sees "🐕 👃 ดมช่อง 8" but never the answer; 6 cards with 🏡; Lola at 13
      const handD = await txt('#cerealModal .ck-hand');
      assert.ok(handD.includes('Mint') && !/อยู่ช่องนี้|🎯/.test(handD), 'hand-off to the detective shows no answer');
      await page.click('#ck-hand-go');
      const det = await txt('#cerealModal .ck.detective');
      assert.ok(det.includes('🐕 👃 ดมช่อง 8'), 'the case log names the sniff');
      assert.ok(!/อยู่ช่องนี้|🎯|สมุด lola/i.test(det), 'the answer and her notebook are not on the detective screen');
      assert.equal(await page.evaluate(() => (document.querySelector('#cerealModal .ck-cell[data-id="13"] .tk') || {}).textContent), '🐕');
      await page.click(cell(7));   // café start
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#ck-ask .ck-q')].map(b => b.dataset.q)), ['dir', 'row', 'col', 'building', 'parity', 'area'], 'six cards on the 3-player map');
      if (process.env.QA_SHOTS) await (await page.$('#cerealModal .modal-content')).screenshot({ path: process.env.QA_SHOTS + '/lola-detective-' + width + '.png' });
      await page.click('#ck-end');

      // ---- day 2 killer: Lola (13) and the detective (7) block
      await page.click('#ck-hand-go');
      assert.equal(await page.isDisabled(cell(13)), true, 'the killer may not step onto Lola');
      await page.click(cell(9)); await page.click(cell(10)); await page.click(cell(16));
      await page.click('#ck-kill .ck-chip:has-text("ไม่")').catch(() => {});
      const lk = await page.evaluate(() => { const b = document.getElementById('ck-lock'); return b && !b.disabled; });
      if (!lk) { await page.evaluate(() => CK.kill('skip')); }
      await page.click('#ck-lock');

      // ---- day 2 Lola: 👃 rests (🦴), bark answers, then a wrong bite next day is tested via API
      await page.click('#ck-hand-go');
      const rail = await page.evaluate(() => [...document.querySelectorAll('#ck-lola-ab .ck-q')].map(b => [b.dataset.ab, b.disabled, b.innerText.includes('🦴')]));
      assert.deepEqual(rail, [['sniff', true, true], ['bark', false, false], ['bite', false, false]], 'last turn\'s ability rests with a 🦴');
      await page.click('#ck-lola-ab [data-ab="bite"]');
      const kp = await page.evaluate(() => { const g = CK.game(); const d = Object.keys(g.secret.path).map(Number).sort((a, b) => b - a)[0]; return g.secret.path[d].slice(-1)[0]; });
      const wrong = await page.evaluate((kp) => [...document.querySelectorAll('#cerealModal .ck-cell.pick')].map(c => +c.dataset.id).find(id => id !== kp), kp);
      await page.click(cell(wrong));
      assert.ok((await txt('#ck-confirm')).includes('🦷 กัดที่ ' + wrong), 'bite asks first');
      await page.click('#ck-confirm .yes');
      const g = await page.evaluate(() => { const x = CK.game(); return { arrests: x.arrestsLeft, phase: x.phase, hand: x.hand, last: x.lola.last }; });
      assert.deepEqual(g, { arrests: 3, phase: 'detective', hand: 'detective', last: 'bite' }, 'a wrong bite costs a shared 🛡️ and ends her turn');
      assert.ok(await noHScroll(), width + ': game fits');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    console.log('cereal-lola-qa: OK — 🐕 3 คน chip shows her card, pair chip cycles 4 maps, city + suburb board with seam (holes kept), 🔪 → 🐕 → 🕵️ hand-offs, Lola starts on the bowl, never rides S, blocks the killer, sniff 🎯 private + notebook, log names the sniff only, 6th card 🏡, ability rests with 🦴, wrong bite shares 🛡️, her 3 first-turn hints (390 + 320)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
