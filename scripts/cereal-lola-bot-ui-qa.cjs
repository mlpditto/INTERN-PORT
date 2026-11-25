// V101.347 🐕 vs 🤖 with 3 players on the REAL index.html: the 🐕 3 คน chip works in 🤖 mode too, three seat buttons
// (🔪 ฉัน · 🐕 ฉัน · 🕵️ ฉัน), the bot plays the other two seats one after the other with a ▸ between them, the 🐕 bot's
// answers never reach the human's screen, and a human Lola plays between two bots. Nothing leaves the page.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const cell = id => '#cerealModal .ck-cell[data-id="' + id + '"]';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('internGuideSeen', '1'); localStorage.setItem('journalTourSeen', '1'); localStorage.setItem('cerealTourSeen', '1'); localStorage.setItem('cerealCoachSeen', 'all'); localStorage.setItem('cerealSound', 'off');
      window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
      const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
    await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const o = document.getElementById('loading-overlay'); if (o) o.style.setProperty('display', 'none', 'important'); cerealOpen(); CK.tab('local'); CK.botDelay(60); });
    const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
    const beatDone = () => page.waitForFunction(() => !!document.getElementById('ck-bot-ok'), null, { timeout: 8000 });
    const game = () => page.evaluate(() => { const g = CK.game(); return { phase: g.phase, status: g.status, bot: g.bot, me: g.me, day: g.day, hand: g.hand }; });

    // ---- lobby vs 🤖: 🐕 3 คน gives three seat buttons
    await page.click('#ck-vs-bot');
    assert.ok(await page.$('#ck-lola'), '🐕 chip in 🤖 mode too');
    await page.click('#ck-lola');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#cerealModal .ck-seat')].map(b => b.id + ':' + b.innerText.replace(/\s+/g, ' ').trim())), ['ck-me-killer:🔪 ฆาตกร ฉัน', 'ck-me-lola:🐕 Lola', 'ck-me-detective:🕵️ นักสืบ'], 'three seats (V101.364: icon · role · ฉัน on mine)');
    assert.ok(await page.$('#ck-pair'), 'the pair chip');
    const fit = await page.evaluate(() => { const m = document.querySelector('#cerealModal .modal-content'); return m.scrollWidth <= m.clientWidth + 1; });
    assert.ok(fit, 'lobby fits');

    // ---- I am the detective: bot killer → ▸ ต่อ · 🤖 🐕 → bot Lola → ▸ ตาคุณ · 🕵️
    await page.click('#ck-me-detective'); await page.click('#cerealModal .ck-gorow .ck-lv[data-lv="1"]');
    await page.click('#ck-start');
    let g = await game();
    assert.deepEqual([g.me, g.bot.seats, g.bot.level], ['detective', ['killer', 'lola'], 1], 'the bot takes 🔪 and 🐕');
    await beatDone();
    assert.ok((await txt('#ck-beat')).startsWith('🤖 🔪'), 'the killer bot moved first');
    assert.ok((await txt('#ck-bot-ok')).includes('ต่อ') && (await txt('#ck-bot-ok')).includes('🐕'), '▸ ต่อ · 🤖 🐕 between two bots');
    await page.click('#ck-bot-ok');
    await beatDone();
    const lb = await txt('#ck-beat');
    assert.ok(lb.startsWith('🤖 🐕'), 'then the Lola bot: ' + lb);
    assert.ok(!/🎯|อยู่ช่องนี้|ไม่อยู่รอบตัว|อยู่รอบตัว|ไม่ได้ผ่าน/.test(lb), 'her answer is not in the beat');
    assert.ok((await txt('#ck-bot-ok')).includes('ตาคุณ'), '▸ ตาคุณ · 🕵️');
    await page.click('#ck-bot-ok');
    g = await game();
    if (g.status === 'playing') {
      assert.equal(g.phase, 'detective');
      const det = await txt('#cerealModal .ck.detective');
      assert.ok(!/สมุด lola|🎯|อยู่ช่องนี้/i.test(det), 'no Lola notebook / answer on the detective screen');
      await page.click('#cerealModal .ck-cell.c:not([disabled])');   // café start
      assert.equal(await page.evaluate(() => document.querySelectorAll('#ck-ask .ck-q').length), 6, 'six cards');
    }

    // ---- I am Lola, between two bots
    await page.evaluate(() => { CK.close(); cerealOpen(); CK.tab('local'); CK.vs('bot'); });
    await page.click('#ck-me-lola');
    await page.click('#ck-start');
    g = await game();
    assert.deepEqual([g.me, g.bot.seats], ['lola', ['killer', 'detective']]);
    await beatDone();
    assert.ok((await txt('#ck-bot-ok')).includes('ตาคุณ') && (await txt('#ck-bot-ok')).includes('🐕'), 'my turn as Lola');
    await page.click('#ck-bot-ok');
    assert.ok(await page.$('#cerealModal .ck.lola'), 'Lola screen for the human');
    await page.click('#ck-lola-ab [data-ab="bark"]');
    assert.ok((await txt('#ck-lola-ans')).includes('🔒'), 'my own answer');
    await page.click('#ck-lola-end');
    await beatDone();
    assert.ok((await txt('#ck-beat')).startsWith('🤖 🕵️'), 'the detective bot moves after me');
    g = await game();
    if (g.status === 'playing') {
      assert.ok((await txt('#ck-bot-ok')).includes('ต่อ'), 'then ▸ ต่อ to the killer bot');
      await page.click('#ck-bot-ok');
      await beatDone();
      assert.ok((await txt('#ck-beat')).startsWith('🤖 🔪'));
      g = await game();
      assert.equal(g.day, 2);
    }
    assert.deepEqual(errors, []);
    console.log('cereal-lola-bot-ui-qa: OK — 🐕 3 คน in 🤖 mode, 🔪 / 🐕 / 🕵️ ฉัน, two bots in a row with ▸ ต่อ, the 🐕 bot\'s answers never on my screen, six cards, a human Lola between two bots');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
