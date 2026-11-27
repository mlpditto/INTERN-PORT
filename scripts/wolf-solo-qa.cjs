// 🐺 Werewolf solo vs 🤖 (V101.353, owner pick B, mockup-werewolf-solo/) on the real public/index.html, 390×844 touch phone,
// network blocked. Plays whole games by tapping, seeded, until "me" has held every role (🐺 🔮 🛡️ 🧪 👤). Proves: the 🐺 button
// sits beside 🥣 on Schedule; the lobby has 5/7/9 + 🥄 levels + the deck; ▸ เริ่ม shows my role card (a wolf sees its mates);
// the night is dark and asks my power (🔮 shows the answer before ☀️, 🧪 sees who was bitten); by day every living bot has a
// tag or stays quiet, tapping a seat offers 🤨 / 👍 / 🔮, my tag lands on my seat; the vote shows the bots' counts on the seats
// and ⏭; the dead show their role; the end lists every player and goes back to a lobby row with a green / red bar; the game
// survives a close + reopen (wolf_v1_<user>); nothing scrolls sideways at 320 px; no page errors.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });   // V101.357: motion on, so the card flip-in is checked (wolf-tutorial-qa checks reduce = none)
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen']) localStorage.setItem(k, '1');
    localStorage.setItem('wolfTourSeen', '1'); localStorage.setItem('wolfCoachSeen', 'all');   // V101.357: the tour / hints are tested in wolf-tutorial-qa
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important');
    const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
  });

  // the entry sits beside 🥣
  const entry = await page.$eval('#sch-wolf-btn', (b) => ({ txt: b.textContent, prev: b.previousElementSibling && b.previousElementSibling.id, on: b.getAttribute('onclick') }));
  assert.deepEqual(entry, { txt: '🐺หมาป่า', prev: 'sch-cereal-btn', on: 'wolfOpen()' }, 'the 🐺 button is right after 🥣 (V101.368: in the games row, with its name)');

  // phone: 🐺 lives in Schedule, not the top rail; PC (≥ 768 px): 🐺 sits just left of 🥣 in the rail (🥣 stays next to 📅)
  const vis = (sel) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none');
  assert.equal(await page.isVisible('#u-wolf-chip'), false, 'no rail 🐺 on a phone');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#u-games-chip');   // V101.378: on PC the games sit in the 🎮 menu (owner pick A)
  assert.equal(await page.isVisible('#u-wolf-chip'), true, '🐺 in the 🎮 menu on PC');
  assert.equal(await page.$eval('#u-wolf-chip', (b) => b.previousElementSibling.id), 'u-cereal-chip', '🐺 right under 🥣');
  await page.keyboard.press('Escape');
  assert.equal(await vis('#sch-wolf-btn'), false, 'Schedule 🐺 hidden on PC');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => wolfOpen());
  const lobby = await page.$eval('#wolfModal', (m) => ({ shown: getComputedStyle(m).display, txt: m.textContent, empty: !!m.querySelector('#ww-empty') }));
  assert.equal(lobby.shown, 'flex'); assert.ok(lobby.empty, 'no games → the empty line');
  // V101.355 (owner picks B + L4): role tiles with a short name + count, a one-line tip under the tapped tile, three nights for the bot level
  assert.match(lobby.txt, /👥 คน5678910/);
  const tiles = () => page.$$eval('#ww-roles .ww-tile', (t) => t.map((x) => [x.dataset.role, x.textContent, x.getAttribute('aria-pressed')]));
  assert.deepEqual(await tiles(), [['wolf', '🐺หมาป่า2', 'true'], ['seer', '🔮ผู้หยั่งรู้1', 'false'], ['guard', '🛡️การ์ด1', 'false'], ['witch', '🧪แม่มด1', 'false'], ['villager', '👤ชาวบ้าน2', 'false']], '7 players: 5 tiles, 🐺 tip open by default');
  assert.match(await page.textContent('#ww-tip'), /^🐺 หมาป่า กัด 1 คนทุกคืน/);
  await page.click('#ww-roles .ww-tile[data-role="guard"]');
  assert.match(await page.textContent('#ww-tip'), /^🛡️ การ์ด คุ้มกัน 1 คนทุกคืน · ห้ามคนเดิม 2 คืนติด$/, 'tap a tile = its tip, inline');
  await page.click('#ww-roles .ww-tile[data-role="guard"]');
  assert.equal(await page.$('#ww-tip'), null, 'tap it again = the tip closes');
  assert.deepEqual(await page.$$eval('#ww-levels button', (b) => b.map((x) => [x.textContent, x.getAttribute('aria-pressed')])), [['🌆หัวค่ำง่าย', 'false'], ['🌙เที่ยงคืนกลาง', 'true'], ['🌕คืนเดือนเพ็ญยาก', 'false']], 'three nights, เที่ยงคืน by default');
  assert.equal(await page.$eval('#ww-levels button.on', (b) => getComputedStyle(b).backgroundColor), 'rgb(49, 46, 129)', 'night tiles are dark');
  await page.click('#ww-levels button:has-text("คืนเดือนเพ็ญ")');
  assert.equal(await page.evaluate(() => WW._game ? null : null), null); assert.match(await page.$eval('#ww-levels button.on', (b) => b.textContent), /คืนเดือนเพ็ญ/, 'tap a night = that level');
  await page.click('#ww-levels button:has-text("เที่ยงคืน")');
  assert.equal(await page.textContent('#ww-start'), '▸ เริ่มเกม · สุ่มบท');
  // V101.359 (pick C): the chosen night says what the bots do, one line under the row, and it follows the pick
  assert.match(await page.textContent('#ww-lvtip'), /^🌙 เที่ยงคืน บอทจำว่าใครพูดอะไร/);
  await page.click('#ww-levels button:has-text("หัวค่ำ")'); assert.match(await page.textContent('#ww-lvtip'), /^🌆 หัวค่ำ บอทเดาเกือบสุ่ม/);
  await page.click('#ww-levels button:has-text("คืนเดือนเพ็ญ")'); assert.match(await page.textContent('#ww-lvtip'), /^🌕 คืนเดือนเพ็ญ บอทหลอกเก่ง/);
  await page.click('#ww-levels button:has-text("เที่ยงคืน")');
  assert.match(await page.$eval('#ww-levels button.on', (b) => getComputedStyle(b).boxShadow), /251, 191, 36/, 'the chosen night glows gold');
  // V101.387: every table size 5–10 (was 5 / 7 / 9); 10 = 🐺 3 and a 4-column table of 3 rows, no sideways scroll
  assert.deepEqual(await page.$$eval('#wolfModal .ww-row .ww-chip', (c) => c.map((x) => x.textContent)), ['5', '6', '7', '8', '9', '10'], 'the 👥 row');
  await page.click('#wolfModal button.ww-chip:has-text("10")');
  assert.deepEqual((await tiles()).map((t) => t[1]), ['🐺หมาป่า3', '🔮ผู้หยั่งรู้1', '🛡️การ์ด1', '🧪แม่มด1', '👤ชาวบ้าน4'], '10 players → 🐺 3, 👤 4');
  await page.evaluate(() => { WW.start(); WW.night(); });   // the role card, then the table
  assert.equal(await page.$$eval('#wolfModal .ww-seat', (s) => s.length), 10, '10 seats');
  assert.equal(await page.$eval('#wolfModal .ww-seats', (el) => new Set([...el.children].map((c) => c.offsetTop)).size), 3, '10 seats = 3 rows of the 4-column table');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 10 seats');
  await page.evaluate(() => WW.back());
  await page.click('#wolfModal button.ww-chip:has-text("7")');   // back to the default size before the bump test below
  await page.click('#wolfModal button.ww-chip:has-text("5")');
  assert.deepEqual(await page.$$eval('#ww-roles .ww-tile.bump', (t) => t.map((x) => x.dataset.role)), ['wolf'], '7 → 5: only the changed count bumps');
  assert.deepEqual((await tiles()).map((t) => t[1]), ['🐺หมาป่า1', '🔮ผู้หยั่งรู้1', '🛡️การ์ด1', '👤ชาวบ้าน2'], '5 players → 4 tiles, 🐺 1');

  const roles = new Set(); const seen = { mates: 0, seerAnswer: 0, witchBite: 0, myTag: 0, voteCounts: 0, deadRole: 0, quietOrTag: 0 };
  let seed = 1, games = 0;
  while (roles.size < 5 && seed < 80) {
    const n = [5, 7, 9][seed % 3];
    await page.evaluate(([s, n]) => {
      let a = s * 9973; WW._rng(() => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; });
      WW.set('n', n); WW.start();
    }, [seed, n]);
    seed++;
    const my = await page.evaluate(() => WW._game().st.roles.p1);
    if (roles.has(my) && roles.size < 5 && seed > 6) { await page.evaluate(() => WW.back()); continue; }
    roles.add(my); games++;
    // role card
    const card = await page.$eval('#wolfModal .ww-card', (c) => c.textContent);
    assert.match(card, /มนุษย์หมาป่า|ผู้หยั่งรู้|บอดี้การ์ด|แม่มด|ชาวบ้าน/);
    if (my === 'wolf' && n >= 7) { assert.match(card, /เพื่อน:/, 'a wolf sees its mates'); seen.mates++; }
    const cardInfo = await page.evaluate(() => { const c = document.getElementById('ww-card'); return { cls: c.className, sp: !!c.querySelector('.sp'), me: (document.querySelector('#ww-cnt span.me') || {}).textContent || '', vil: !!document.getElementById('ww-vil'), border: getComputedStyle(c).borderTopColor, anim: getComputedStyle(c).animationName }; });
    assert.ok(cardInfo.cls.includes('r-' + my) && cardInfo.cls.includes('flip'), 'V101.357 pick A: the card carries its role colour and turns in: ' + cardInfo.cls);
    assert.equal(cardInfo.sp, my !== 'villager', '✨ บทพิเศษ above a power role only'); assert.equal(cardInfo.vil, my === 'villager', 'the villager line for villagers only');
    assert.match(cardInfo.me, { wolf: /หมาป่า/, seer: /ผู้หยั่งรู้/, guard: /การ์ด/, witch: /แม่มด/, villager: /ชาวบ้าน/ }[my], 'your role is framed in the icon row');
    assert.equal(cardInfo.border, { wolf: 'rgb(190, 18, 60)', seer: 'rgb(124, 58, 237)', guard: 'rgb(37, 99, 235)', witch: 'rgb(22, 163, 74)', villager: 'rgb(180, 83, 9)' }[my], 'role colour: ' + my);
    assert.equal(cardInfo.anim, 'ww-flip', 'the flip-in runs (motion allowed)');
    assert.equal(await page.textContent('#ww-goal'), my === 'wolf' ? '🏆 ชนะเมื่อ 🐺 เท่ากับคนที่เหลือ' : '🏆 ชนะเมื่อ 🐺 ออกครบ', 'V101.355: the side\'s goal on the card');
    await page.click('#ww-go');
    for (let step = 0; step < 60; step++) {
      const ph = await page.evaluate(() => { const g = WW._game(); return g ? g.phase : 'lobby'; });
      if (ph === 'over') break;
      if (ph === 'night') {
        assert.ok(await page.$eval('#wolfModal', (m) => m.classList.contains('dark')), 'night is dark');
        const alive = await page.evaluate(() => !!WW._game().st.alive.p1);
        const pick = await page.$('#wolfModal .ww-seat.pick');
        if (alive && my === 'witch' && await page.$('#ww-night-note')) { if (/คืนนี้กัด|ไม่มีใครถูกกัด/.test(await page.textContent('#ww-night-note'))) seen.witchBite++; }
        if (alive && pick && ['wolf', 'seer', 'guard'].includes(my)) {
          await pick.click();
          if (my === 'seer') { await page.click('#ww-night-go'); assert.match(await page.textContent('#wolfModal .ww-top'), /= (🐺 หมาป่า|👤 ไม่ใช่หมาป่า)/, '🔮 answer before ☀️'); seen.seerAnswer++; }
        }
        assert.equal(await page.$eval('#ww-night-go', (b) => b.disabled), false, 'the night button is ready: ' + await page.evaluate(() => { const g = WW._game(); return JSON.stringify({ me: g.st.roles.p1, alive: g.st.alive, draft: g.draft, last: g.st.lastGuard, checks: g.checks.p1, ask: document.querySelector('#wolfModal .ww-top').textContent, picks: document.querySelectorAll('#wolfModal .ww-seat.pick').length }); }));
        await page.click('#ww-night-go');
        continue;
      }
      if (ph === 'day') {
        if (!seen.peek && await page.$('#ww-me')) {   // V101.355: tap 👤 คุณ = the role card again, ↩ back to the same day
          await page.click('#ww-me'); assert.equal(await page.textContent('#ww-goal') !== '', true); assert.ok(await page.$('#ww-peek-back'));
          assert.equal(await page.$eval('#ww-card', (c) => c.classList.contains('flip')), false, 'the peek does not turn the card again');
          await page.click('#ww-peek-back'); assert.ok(await page.$('#ww-to-vote'), 'back on the day'); seen.peek = 1;
        }
        const tags = await page.evaluate(() => { const g = WW._game(); return g.ids.filter((id) => id !== 'p1' && g.st.alive[id]).map((id) => [!!g.tags[id], !!document.querySelector('#wolfModal .ww-seat[data-id="' + id + '"] .tag')]); });
        tags.forEach(([has]) => assert.ok(has, 'every living bot has a tag entry (maybe quiet)')); seen.quietOrTag += tags.length;
        const deadRole = await page.$$eval('#wolfModal .ww-seat.dead .tag', (t) => t.map((x) => x.textContent));
        if (deadRole.length) { assert.ok(deadRole.every((x) => /[🐺🔮🛡🧪👤]/u.test(x)), 'the dead show their role'); seen.deadRole++; }
        if (await page.evaluate(() => !!WW._game().st.alive.p1)) {
          await page.click('#wolfModal .ww-seat.pick');
          const chips = await page.$$eval('#ww-say button', (b) => b.map((x) => x.textContent.slice(0, 2)));
          assert.equal(chips.length, 4, '🤨 👍 🔮🐺 🔮👤');
          const claimTxt = await page.$$eval('#ww-say button', (b) => b.slice(2).map((x) => x.textContent));
          assert.ok(claimTxt.every((t) => /^🔮 อ้าง .+ (🐺|👤)$/.test(t)), 'V101.356: the 🔮 chips say they are a claim: ' + claimTxt);
          await page.click('#ww-say button:first-child');
          assert.match(await page.$eval('#wolfModal .ww-seat.me .tag', (t) => t.textContent), /^🤨 /, 'my tag lands on my seat'); seen.myTag++;
        }
        await page.click('#ww-to-vote');
        continue;
      }
      if (ph === 'vote') {
        const { want, shown } = await page.evaluate(() => { const g = WW._game(); const want = Object.values(g.botVotes).filter((t) => t !== 'skip').length; const shown = [...document.querySelectorAll('#wolfModal .ww-seat .vc')].reduce((s, e) => s + Number(e.textContent), 0); return { want, shown }; });
        assert.equal(shown, want, 'the bots\' votes are on the seats'); seen.voteCounts++;
        if (await page.evaluate(() => !!WW._game().st.alive.p1)) {
          assert.equal(await page.$eval('#ww-vote', (b) => b.disabled), true, 'vote needs a pick');
          if (seed % 2) await page.click('#ww-skip'); else await page.click('#wolfModal .ww-seat.pick');
        }
        await page.click('#ww-vote');
        continue;
      }
      throw new Error('unexpected phase ' + ph);
    }
    // the end
    const res = await page.$$eval('#ww-res .r', (r) => r.length);
    assert.equal(res, n, 'every player is listed at the end');
    assert.match(await page.textContent('#wolfModal .ww-top'), /ชนะ/);
    // close + reopen keeps it; the lobby row has a green / red bar
    await page.evaluate(() => { WW.close(); wolfOpen(); });
    const row = await page.$eval('#wolfModal .ww-game', (r) => r.className);
    assert.match(row, /r-w|r-l/, 'a finished game row has a result bar: ' + row);
    // V101.359 (pick C): the result once in words (ชนะ green / แพ้ red, no 🏆 / 💀), 👁 = see the result
    const rr = await page.$eval('#wolfModal .ww-game', (r) => ({ cls: r.className, res: (r.querySelector('.res') || {}).textContent, resCls: (r.querySelector('.res') || {}).className, go: r.querySelector('.go').textContent, txt: r.textContent }));
    assert.equal(rr.res, rr.cls.includes('r-w') ? 'ชนะ' : 'แพ้'); assert.match(rr.resCls, rr.cls.includes('r-w') ? / w$/ : / l$/);
    assert.equal(rr.go, '👁'); assert.ok(!/🏆|💀/.test(rr.txt), 'no 🏆 / 💀 in the row: ' + rr.txt);
  }
  assert.equal(roles.size, 5, 'played as every role: ' + [...roles]);
  // a wolf at 9 players sees both mates on the card and a 🐺 corner on their seats at night
  for (let s = 100; s < 160 && !seen.mates; s++) {
    const wolf = await page.evaluate((s) => { let a = s * 9973; WW._rng(() => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }); WW.set('n', 9); WW.start(); return WW._game().st.roles.p1 === 'wolf'; }, s);
    if (!wolf) { await page.evaluate(() => WW.back()); continue; }
    assert.equal((await page.textContent('#wolfModal .ww-card .mates')).split('·').length, 2, 'two mates named');
    await page.click('#ww-go');
    assert.equal(await page.$$eval('#wolfModal .ww-seat .mk', (m) => m.filter((x) => x.textContent === '🐺').length), 2, '🐺 corner on both mates');
    assert.equal(await page.$$eval('#wolfModal .ww-seat.pick', (p) => p.length), 6, 'a wolf can bite only the 6 non-wolves');
    seen.mates++; await page.evaluate(() => WW.back());
  }
  assert.ok(seen.mates, 'covered a wolf with mates');
  assert.ok(seen.seerAnswer && seen.myTag && seen.voteCounts && seen.deadRole && seen.peek, JSON.stringify(seen));

  // V101.356: the guard's "last night you covered X" disappears once X is dead
  {
    for (let s = 300; s < 420; s++) {
      const guard = await page.evaluate((s) => { let a = s * 7; WW._rng(() => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }); WW.set('n', 5); WW.start(); return WW._game().st.roles.p1 === 'guard'; }, s);
      if (!guard) { await page.evaluate(() => WW.back()); continue; }
      const notes = await page.evaluate(() => {
        WW.night(); const g = WW._game(), other = g.ids.find((id) => id !== g.me);
        g.st.lastGuard = other; WW.tap(other); WW.tap(other);   // re-render with a last guard that is alive
        const alive = (document.getElementById('ww-night-note') || {}).textContent || '';
        g.st.alive[other] = false; g.draft = {}; WW.tap(g.me);
        const dead = (document.getElementById('ww-night-note') || {}).textContent || '';
        return [alive, dead];
      });
      if (!/เมื่อคืนคุ้มกัน/.test(notes[0])) throw new Error('setup: the alive note is missing: ' + notes[0]);
      if (/เมื่อคืนคุ้มกัน/.test(notes[1])) throw new Error('the note still names a dead player: ' + notes[1]);
      await page.evaluate(() => WW.back());
      break;
    }
  }
  // V101.358 (owner pick A + D on 🌕): a 🐺 player sees the bot mates' wish as a tag on the seat; 🌕 adds why + how many; the bite stays yours
  for (const level of [2, 3]) {
    for (let s = 700; s < 900; s++) {
      const ok = await page.evaluate(([s, level]) => { let a = s * 19; WW._rng(() => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }); WW.set('n', 9); WW.set('level', level); WW.start(); const g = WW._game(); return g.st.roles.p1 === 'wolf'; }, [s, level]);
      if (!ok) { await page.evaluate(() => WW.back()); continue; }
      const r = await page.evaluate(() => {
        const g = WW._game();
        if (g.level === 3) { const v = g.ids.filter((id) => g.st.roles[id] !== 'wolf'); g.claims.push({ by: v[0], day: 1, t: v[1], wolf: false }); }   // a 🔮 claim to give 🌕 a reason
        WW.night();
        const mates = g.draft.mates || {}, want = {}; Object.keys(mates).forEach((m) => { (want[mates[m]] = want[mates[m]] || []).push(g.names[m]); });
        const seatsOut = Object.keys(want).map((t) => { const s = document.querySelector('#wolfModal .ww-seat[data-id="' + t + '"]'); return { t, names: want[t], tag: (s.querySelector('.ww-want') || {}).textContent || '', why: (s.querySelector('.ww-why') || {}).textContent || '', count: (s.querySelector('.ww-wc') || {}).textContent || '', exp: window.WolfAI.wolfWhy(g, t) || '' }; });
        const other = g.ids.find((id) => id !== 'p1' && g.st.roles[id] !== 'wolf' && !want[id]);
        WW.tap(other);
        return { pill: document.querySelector('#wolfModal .ww-pill').textContent, seatsOut, tags: document.querySelectorAll('#wolfModal .ww-want').length, bite: g.draft.bite === other, level: g.level };
      });
      assert.match(r.pill, /เพื่อนเลือกแล้ว/, 'the pill says the mates chose');
      assert.ok(r.seatsOut.length >= 1 && r.tags === r.seatsOut.length, 'one tag per wanted seat: ' + JSON.stringify(r));
      for (const x of r.seatsOut) {
        assert.ok(x.names.every((n) => x.tag.includes(n)), 'the tag names the mates');
        if (level === 2) { assert.equal(x.tag, '🐺 ' + x.names.join(' · '), 'just the names (fits the seat)'); assert.equal(x.why, ''); assert.equal(x.count, '', 'no why / count below 🌕'); }
        else { if (x.names.length > 1) assert.equal(x.count, String(x.names.length), '🌕: how many agree'); assert.equal(x.why, x.exp, '🌕: the shown reason is the bot\'s own'); }
      }
      assert.ok(r.bite, 'tapping another seat = your bite (the mates only suggest)');
      await page.evaluate(() => WW.back());
      break;
    }
  }
  // V101.356: a 🔮 who has checked everyone alive can still end the night (the button used to stay disabled for good)
  for (let s = 500; s < 640; s++) {
    const seer = await page.evaluate((s) => { let a = s * 11; WW._rng(() => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }); WW.set('n', 5); WW.start(); return WW._game().st.roles.p1 === 'seer'; }, s);
    if (!seer) { await page.evaluate(() => WW.back()); continue; }
    const r = await page.evaluate(() => { WW.night(); const g = WW._game(); g.checks.p1 = {}; g.ids.forEach((id) => { if (id !== 'p1') g.checks.p1[id] = g.st.roles[id] === 'wolf'; }); WW.tap('p1');
      return [document.querySelector('#wolfModal .ww-top').textContent, document.getElementById('ww-night-go').disabled]; });
    assert.match(r[0], /ส่องครบทุกคนแล้ว/); assert.equal(r[1], false, 'the night button works when nobody is left to check');
    await page.evaluate(() => WW.back()); break;
  }
  // an unfinished game: framed, ▸, back on reopen
  await page.evaluate(() => { WW.set('n', 7); WW.start(); WW.night(); WW.close(); wolfOpen(); });
  const cur = await page.$eval('#wolfModal .ww-game.cur', (r) => ({ go: r.querySelector('.go').textContent, cls: r.className }));
  assert.equal(cur.go, '▸ เล่นต่อ', 'V101.359: the unfinished game says ▸ เล่นต่อ'); assert.match(cur.cls, /r-p/);
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('wolf_v1_')).map((k) => JSON.parse(localStorage.getItem(k)).games.length));
  assert.ok(stored.length && stored[0] >= 2, 'games are in wolf_v1_<user>');
  await page.click('#wolfModal .ww-game.cur');
  assert.equal(await page.evaluate(() => WW._game().phase), 'night');

  // 320 px: nothing scrolls sideways (night, day, vote)
  await page.setViewportSize({ width: 320, height: 700 });
  for (const go of [null, '#ww-night-go', '#ww-to-vote']) {
    if (go) {
      const p = await page.$('#wolfModal .ww-seat.pick'); if (p && go === '#ww-night-go') await p.click();
      await page.click(go);
      if (go === '#ww-night-go' && await page.evaluate(() => WW._game().phase === 'night')) await page.click(go);   // 🔮: answer first, then ☀️
    }
    const over = await page.$eval('#wolfModal .modal-content', (c) => c.scrollWidth - c.clientWidth);
    assert.ok(over <= 1, 'no sideways scroll at 320 px (' + over + ')');
  }

  assert.deepEqual(errors, [], 'no page errors');
  await browser.close();
  console.log('wolf-solo-qa: OK — ' + games + ' games, roles ' + [...roles].join(' ') + ', ' + JSON.stringify(seen));
})().catch((e) => { console.error(e); process.exit(1); });
