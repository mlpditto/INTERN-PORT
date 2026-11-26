// V101.365 ⚫⚪ ไพ่เงา (owner pick C + 🧠 at 🥄🥄🥄, mockup-black-white/) on the REAL index.html, 390×844 touch phone + a 1024 PC.
// Proves the rules over 300 seeded bot-vs-bot games driven through the real module (each tile once a side, higher wins, a draw scores
// nobody, the winner leads / a draw keeps the leader, the game stops at 5 or after 9; the bot's guess of my hand always keeps my real
// tiles possible); the doorways (phone: Schedule row after 🧊, PC: header left of 🧊); a 🤖 number never reaches the page before the
// end (only its colour); pick → ▸ ลง → result → ▸ ต่อ; the 📓 shows my number + 🤖 colour; 🥄🥄🥄 🧠: used tiles look unused, a tap
// says so, the 📓 hides my numbers; the end screen opens every 🤖 tile and keeps the record; nothing scrolls sideways at 320 px.
// V101.366 (pick B + end screen): a dark popup, the 🤖 tile glows in its colour; the 📓 is one bar (none before round 1) that pulls a sheet
// up and folds it again; with motion allowed the end screen opens the 🤖 tiles one by one (a tap opens the rest); 📤 LINE falls back to
// the clipboard outside LINE; ?bw=1 (the card's button) opens the game.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'bwTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    let q = 7; Math.random = () => ((q = (q * 16807) % 2147483647) / 2147483647);   // every run the same games
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); let s = 3; BW._rng(() => ((s = (s * 16807) % 2147483647) / 2147483647)); });

  // ---- rules: 300 games, "me" played by a random hand through BW.pick / BW.play, all three bot levels ----
  const rules = await page.evaluate(() => {
    const bad = []; let games = 0, early = 0;
    for (let i = 0; i < 300; i++) {
      BW.level(1 + (i % 3)); BW.start(); const g = BW._g(); let lead = g.lead;
      while (!g.end) {
        const mine = g.me.slice(), before = g.hist.length, odds = BW._odds();
        if (g.hist.length && mine.some((n) => odds.cnt[n] === 0)) bad.push('bot ruled out a tile I still hold');
        const n = mine[Math.floor(Math.random() * mine.length)]; BW.pick(n); BW.play();
        const h = g.hist[before]; if (!h || h.m !== n) { bad.push('no round'); break; }
        if (h.res !== (h.m > h.b ? 'win' : h.m < h.b ? 'lose' : 'draw')) bad.push('result');
        if (h.lead !== lead) bad.push('leader');
        if (h.res !== 'draw') lead = h.res === 'win' ? 'me' : 'bot';
        if (!g.end) BW.next();
      }
      const ms = g.hist.map((h) => h.m), bs = g.hist.map((h) => h.b);
      if (new Set(ms).size !== ms.length || new Set(bs).size !== bs.length) bad.push('a tile used twice');
      const w = g.hist.filter((h) => h.res === 'win').length, l = g.hist.filter((h) => h.res === 'lose').length;
      if (w !== g.sc.me || l !== g.sc.bot) bad.push('score');
      if (!(g.hist.length === 9 || Math.max(w, l) === 5) || (g.hist.length < 9 && Math.max(w, l) !== 5)) bad.push('end ' + g.hist.length + ' ' + w + ':' + l);
      if (g.hist.length < 9) early++; games++;
    }
    BW.close(); return { bad: [...new Set(bad)], games, early };
  });
  assert.deepEqual(rules.bad, [], 'rules hold over ' + rules.games + ' games'); assert.ok(rules.early > 0, 'some games end early at 5');
  // the levels are ordered: vs a random hand (seeded, 400 games — the same every run), 🥄🥄🥄 wins clearly more than it loses
  const st = await page.evaluate(() => { let w = 0, l = 0, z = 11; const R = () => ((z = (z * 48271) % 2147483647) / 2147483647); for (let i = 0; i < 400; i++) { BW.level(3); BW.start(); const g = BW._g(); while (!g.end) { if (g.last) BW.next(); else { BW.pick(g.me[Math.floor(R() * g.me.length)]); BW.play(); } } if (g.sc.bot > g.sc.me) w++; else if (g.sc.bot < g.sc.me) l++; } BW.close(); return { w, l }; });
  assert.ok(st.w > st.l * 1.3, '🥄🥄🥄 beats a random hand ' + JSON.stringify(st));

  // ---- phone doorway → lobby → a game ----
  assert.equal(await page.isVisible('#u-bw-chip'), false, 'phone: no header chip');
  assert.equal(await page.$eval('#sch-bw-btn', (e) => e.previousElementSibling.id), 'sch-count-btn', 'phone: after 🧊 in the Schedule games row');
  await page.evaluate(() => { localStorage.removeItem('shadowStats'); document.getElementById('sch-bw-btn').click(); });
  assert.equal(await page.$eval('#bwModal', (e) => getComputedStyle(e).display + e.classList.contains('lang-no-toggle')), 'flextrue');
  await page.click('#bw-lv2'); await page.click('#bw-start');
  // make the 🤖 lead so its tile is on the table
  await page.evaluate(() => { const g = BW._g(); if (g.lead !== 'bot') { g.lead = 'bot'; g.botTile = BW._botPick(null); } });
  await page.evaluate(() => { const g = BW._g(); document.getElementById('bw-body') && (BW.pick(g.me[0]), BW.pick(g.me[0])); });
  const hidden = await page.evaluate(() => { const g = BW._g(), tb = document.getElementById('bw-table'); return { colour: tb.querySelector('.bw-t.back').classList.contains(g.botTile % 2 ? 'w' : 'b'), digits: /\d/.test(tb.textContent), say: document.getElementById('bw-say').textContent }; });
  assert.equal(hidden.colour, true, 'the 🤖 tile shows its colour');
  const look = await page.evaluate(() => { const g = BW._g(), t = document.querySelector('#bw-table .bw-t.huge'); return { bg: getComputedStyle(document.querySelector('#bwModal .modal-content')).backgroundColor, glow: getComputedStyle(t).boxShadow.includes(g.botTile % 2 ? 'rgba(226, 232, 240' : 'rgba(139, 92, 246'), bar: !!document.getElementById('bw-nb') }; });
  assert.deepEqual(look, { bg: 'rgb(20, 18, 43)', glow: true, bar: false }, 'dark popup, the 🤖 tile glows in its colour, no 📓 bar before round 1'); assert.equal(hidden.digits, false, 'no 🤖 number on the table'); assert.match(hidden.say, /^🤖 ลง [⚫⚪] · ตาคุณ$/);
  assert.equal(await page.$eval('#bw-play', (b) => b.disabled), false);
  const n0 = await page.evaluate(() => BW._g().sel);
  await page.click('#bw-play');
  const r1 = await page.evaluate(() => { const g = BW._g(), h = g.hist[0]; return { res: document.getElementById('bw-res').textContent, want: { win: '🏆 ชนะ', lose: '😞 แพ้', draw: '🤝 เสมอ' }[h.res], score: document.getElementById('bw-score').textContent, sc: g.sc, botNum: [...document.querySelectorAll('#bwModal .bw-t:not(.back)')].some((e) => +e.textContent === h.b && e.closest('.bw-pair') && e.nextElementSibling && e.nextElementSibling.textContent === '🤖'), bar: document.getElementById('bw-nb').textContent, rows: document.querySelectorAll('#bwModal .bw-r').length }; });
  assert.equal(r1.res, r1.want); assert.equal(r1.score, 'คุณ ' + r1.sc.me + ' : ' + r1.sc.bot + ' 🤖'); assert.equal(r1.botNum, false, 'after the round the 🤖 number stays hidden');
  assert.match(r1.bar, /^📓 1 ตา🤖 เหลือ ⚫ \d · ⚪ \d ▴$/, '📓 folded to one bar'); assert.equal(r1.rows, 0, 'rows hidden while folded');
  await page.click('#bw-nb');
  const sheet = await page.evaluate(() => { const sh = document.getElementById('bw-sheet'), r = sh && sh.getBoundingClientRect(); return { pos: sh && getComputedStyle(sh).position, bottom: r && Math.round(r.bottom), h: innerHeight, row: sh && sh.querySelector('.bw-r').textContent, exp: document.getElementById('bw-nb').getAttribute('aria-expanded') }; });
  assert.equal(sheet.pos, 'fixed'); assert.equal(sheet.bottom, sheet.h, 'the sheet sits on the bottom edge'); assert.equal(sheet.exp, 'true');
  assert.ok(sheet.row.startsWith('1' + n0 + ' vs ?'), '📓: my number vs the 🤖 colour ' + sheet.row);
  await page.click('#bw-nb'); assert.equal(await page.$('#bw-sheet'), null, 'a second tap folds it');
  await page.click('#bw-next');
  assert.equal(await page.$eval(`#bw-hand button[data-n="${n0}"]`, (b) => b.disabled && b.classList.contains('used')), true, '🥄🥄: a used tile is dim and off');

  // ---- 🥄🥄🥄 🧠 memory mode ----
  await page.evaluate(() => BW.lobby()); await page.click('#bw-lv3');
  assert.match(await page.textContent('#bwModal .bw-note'), /🧠/);
  await page.click('#bw-start');
  await page.evaluate(() => { const g = BW._g(); if (g.lead === 'bot') { BW.pick(g.me[0]); BW.play(); BW.next(); } else { BW.pick(g.me[0]); BW.play(); BW.next(); } });
  const used = await page.evaluate(() => BW._g().hist[0].m);
  assert.equal(await page.$eval(`#bw-hand button[data-n="${used}"]`, (b) => b.disabled || b.classList.contains('used')), false, '🧠: a used tile looks unused');
  await page.click(`#bw-hand button[data-n="${used}"]`);
  assert.equal(await page.textContent('#bw-toast'), '🧠 ' + used + ' ลงไปแล้ว'); assert.equal(await page.$eval('#bw-play', (b) => b.disabled), true, 'and cannot be played');
  await page.click('#bw-nb');
  assert.equal(await page.$$eval('#bw-sheet .bw-t:not(.back)', (e) => e.length), 0, '🧠: the 📓 hides my numbers');
  assert.ok((await page.$$eval('#bw-sheet .bw-r', (e) => e.length)) >= 1);
  await page.click('#bw-nb');

  // ---- the end: every 🤖 tile opened, the record kept ----
  await page.evaluate(() => { const g = BW._g(); while (!g.end) { if (g.last) BW.next(); else { BW.pick(g.me[0]); BW.play(); } } });
  const end = await page.evaluate(() => { const g = BW._g(); return { rows: [...document.querySelectorAll('#bw-reveal .bw-card')].map((r) => [...r.querySelectorAll('.bw-t')].map((x) => +x.textContent)), hist: g.hist.map((h) => [h.m, h.b]), fin: document.getElementById('bw-final').textContent, sc: g.sc, stats: JSON.parse(localStorage.getItem('shadowStats')) }; });
  assert.deepEqual(end.rows, end.hist, 'every round opened: mine vs 🤖');
  assert.ok(end.fin.endsWith(end.sc.me + ' : ' + end.sc.bot));
  // V101.369 (owner: "lean + inline", pick B · การ์ด 3×3, "ขยาย popup ให้ดูไม่แออัด"): the result in the header line, no dots row, a card a round
  // (3 a row, the left bar = its result), one action row ↺ · 📤 · 🥄; the popup roomier (18 px inside, 34 px tiles in the cards)
  const lean = await page.evaluate(() => { const g = BW._g(), cs = [...document.querySelectorAll('#bw-reveal .bw-card')], acts = ['bw-again', 'bw-share', 'bw-lvl'].map((id) => document.getElementById(id));
    return { inTop: !!document.querySelector('#bwModal .bw-top #bw-final'), dots: document.querySelectorAll('#bwModal .bw-dots').length, words: /ชนะ|แพ้|เสมอ/.test(document.getElementById('bw-reveal').textContent),
      res: cs.map((c) => ['win', 'lose', 'draw'].find((k) => c.classList.contains(k))), want: g.hist.map((h) => h.res), perRow: new Set(cs.slice(0, 3).map((c) => Math.round(c.getBoundingClientRect().top))).size === 1 && (cs.length < 4 || Math.round(cs[3].getBoundingClientRect().top) > Math.round(cs[0].getBoundingClientRect().top)),
      oneRow: acts.every(Boolean) && new Set(acts.map((b) => Math.round(b.getBoundingClientRect().top))).size === 1, lvl: acts[2] && acts[2].getAttribute('onclick'),
      pad: parseFloat(getComputedStyle(document.querySelector('#bwModal .modal-content')).paddingLeft), tileH: Math.round(document.querySelector('#bw-reveal .bw-card .bw-t').getBoundingClientRect().height) }; });
  assert.deepEqual({ inTop: lean.inTop, dots: lean.dots, words: lean.words, res: lean.res, perRow: lean.perRow, oneRow: lean.oneRow, lvl: lean.lvl }, { inTop: true, dots: 0, words: false, res: lean.want, perRow: true, oneRow: true, lvl: 'BW.lobby()' }, 'end screen pick B');
  assert.ok(lean.pad >= 18 && lean.tileH >= 34, 'roomier popup ' + JSON.stringify(lean)); assert.equal(Object.values(end.stats.l3).reduce((a, b) => a + b, 0), 1, 'the 🥄🥄🥄 record counts the game');

  // ---- 320 px, PC doorway ----
  await page.setViewportSize({ width: 320, height: 640 }); await page.click('#bw-again');
  assert.ok(await page.$eval('#bwModal .modal-content', (e) => e.scrollWidth <= e.clientWidth + 1), 'no sideways scroll at 320 px');
  await page.evaluate(() => BW.close());
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.click('#u-games-chip');   // V101.378: on PC the games sit in the 🎮 menu (owner pick A)
  assert.equal(await page.$eval('#u-bw-chip', (e) => [e.previousElementSibling.id, e.nextElementSibling.id].join()), 'u-count-chip,u-sn-chip', 'PC: ⚫ in the 🎮 menu between 🧊 and 🔢');
  // ?bw=1 (the 📤 card's button) opens the game
  await page.evaluate(() => BW.close()); await page.evaluate(() => applyTabDeepLink(new URLSearchParams('bw=1'))); await page.waitForSelector('#bw-start', { timeout: 2000 });
  await page.evaluate(() => BW.close());
  await page.click('#u-bw-chip'); assert.ok(await page.isVisible('#bw-start'));

  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.addInitScript(() => { localStorage.setItem('bwTourSeen', '1'); window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    window.__clip = null; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true }); });
  await p2.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await p2.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await p2.evaluate(() => { bwOpen(); BW.start(); const g = BW._g(); while (!g.end) { if (g.last) BW.next(); else { BW.pick(g.me[0]); BW.play(); } } });
  const open0 = await p2.$$eval('#bw-reveal .bw-card', (rs) => rs.filter((r) => !r.querySelectorAll('.bw-t')[1].classList.contains('back')).length);
  assert.equal(open0, 0, 'motion allowed: the 🤖 tiles start face down');
  await p2.waitForFunction(() => [...document.querySelectorAll('#bw-reveal .bw-card')].filter((r) => !r.querySelectorAll('.bw-t')[1].classList.contains('back')).length === 2, null, { timeout: 3000 });
  assert.equal(await p2.$$eval('#bw-reveal .bw-card.now', (e) => e.length), 1, 'the card just opened is lit');
  await p2.click('#bw-reveal');
  assert.equal(await p2.$$eval('#bw-reveal .bw-t.back', (e) => e.length), 0, 'a tap opens the rest');
  await p2.click('#bw-share'); await p2.waitForSelector('#bw-share.done');
  const clip = await p2.evaluate(() => ({ clip: window.__clip, sent: document.getElementById('bw-share').getAttribute('aria-label') + ' ' + document.getElementById('bw-share').textContent, sc: BW._g().sc }));
  assert.equal(clip.sent, '📋 คัดลอกแล้ว ✓', 'V101.369: the 📤 button turns ✓ (no extra line)'); assert.match(clip.clip, /^⚫⚪ ไพ่เงา · (🏆 ชนะ|😞 แพ้|🤝 เสมอ) \d : \d vs 🤖 🥄🥄\nhttps:\/\/liff\.line\.me\/.*\?bw=1$/, '📤 outside LINE: the text + ?bw=1 link to the clipboard');
  await p2.close();

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('shadow-qa: OK — rules over ' + rules.games + ' games (' + rules.early + ' ended at 5), bot keeps my real tiles possible, doorways, 🤖 number hidden till the end, 📓, 🧠 mode, end reveal + record, 320 px, PC chip');
})().catch((e) => { console.error(e); process.exit(1); });
