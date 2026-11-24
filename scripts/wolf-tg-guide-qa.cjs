// V101.360 (owner pick B, mockup-werewolf-telegram-guide/) — the ✈️ "play with friends on Telegram" guide in the Werewolf lobby, on the
// REAL index.html, 390×844 touch phone. Proves: one light-blue row under ▸ เริ่ม, folded at first (▾); a tap opens the guide in place
// (▴): 4 steps with an icon each, ➕ เพิ่มบอทเข้ากลุ่ม + 💬 เปิดแชทบอท side by side, same size, not clipped; the note names @NikaWerewolf_bot once;
// ➕ opens t.me/NikaWerewolf_bot?startgroup=…, 💬 opens t.me/NikaWerewolf_bot (outside LINE: window.open, new tab); a tap on the row
// folds it; the game list stays below; nothing scrolls sideways at 320 px; no token or secret in the page.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all');
    window.__open = []; window.open = (u, t, f) => { window.__open.push([u, t, f]); return null; };
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); WW._rng(Math.random); WW.set('n', 5); WW.start(); WW.back(); wolfOpen(); });

  const row = await page.$eval('#ww-tgrow', (r) => ({ prev: r.previousElementSibling.id, txt: r.textContent, exp: r.getAttribute('aria-expanded'), bg: getComputedStyle(r).backgroundColor }));
  assert.equal(row.prev, 'ww-start', 'the row sits right under ▸ เริ่ม');
  assert.equal(row.txt, '✈️เล่นกับเพื่อนใน Telegram · ไม่มีบอท▾'); assert.equal(row.exp, 'false'); assert.equal(row.bg, 'rgb(240, 249, 255)', 'light blue, visible while folded');
  assert.equal(await page.$('#ww-tg'), null, 'folded at first');

  await page.click('#ww-tgrow');
  const g = await page.evaluate(() => {
    const t = document.getElementById('ww-tg'), add = document.getElementById('ww-tg-add').getBoundingClientRect(), chat = document.getElementById('ww-tg-chat').getBoundingClientRect();
    return { steps: [...t.querySelectorAll('ol li')].map((l) => l.querySelector('i').textContent), stepTxt: t.querySelector('ol').innerText, arrow: document.querySelector('#ww-tgrow .ar').textContent,
      sameRow: Math.abs(add.top - chat.top) < 2, sameW: Math.abs(add.width - chat.width) < 2, chat: document.getElementById('ww-tg-chat').textContent, note: t.querySelector('.ww-tgnote').innerText,
      liKids: [...t.querySelectorAll('ol li')].map((l) => l.children.length + ':' + l.lastElementChild.tagName), clipped: [...t.querySelectorAll('.ww-tgb button')].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.id),
      listBelow: !document.querySelector('#wolfModal .ww-game') || document.querySelector('#wolfModal .ww-game').getBoundingClientRect().top > t.getBoundingClientRect().bottom };
  });
  assert.deepEqual(g.steps, ['➕', '⌨️', '👥', '🌙'], 'an icon per step'); assert.match(g.stepTxt, /\/werewolf/); assert.match(g.stepTxt, /Start/);
  assert.equal(g.arrow, '▴'); assert.ok(g.sameRow && g.sameW, '➕ and 💬 side by side, the same size'); assert.equal(g.chat, '💬 เปิดแชทบอท');
  assert.deepEqual(g.liKids, ['2:SPAN', '2:SPAN', '2:SPAN', '2:SPAN'], 'each step = icon + one text span (bold words wrap inline, not as flex columns)');
  assert.deepEqual(g.clipped, [], 'neither button cuts off its text');
  assert.match(g.note, /@NikaWerewolf_bot/, 'the bot name once, in the note');
  assert.match(g.note, /เปิด Telegram ให้เลือกกลุ่ม/); assert.ok(g.listBelow, 'the game list stays below the guide');

  await page.click('#ww-tg-add'); await page.click('#ww-tg-chat');
  assert.deepEqual(await page.evaluate(() => window.__open.map((x) => x[0])), ['https://t.me/NikaWerewolf_bot?startgroup=werewolf', 'https://t.me/NikaWerewolf_bot'], '➕ = startgroup, 💬 = the bot');

  await page.setViewportSize({ width: 320, height: 700 });
  assert.ok(await page.$eval('#wolfModal .modal-content', (c) => c.scrollWidth <= c.clientWidth + 1), 'no sideways scroll at 320 px with the guide open');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#ww-tgrow'); assert.equal(await page.$('#ww-tg'), null, 'a tap on the row folds it');

  const src = fs.readFileSync('public/wolf.js', 'utf8');
  assert.ok(!/\d{8,10}:[A-Za-z0-9_-]{30,}/.test(src), 'no bot token in the page source');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('wolf-tg-guide-qa: OK — row under ▸ เริ่ม, folded → guide (4 icon steps, ➕ / 💬 same size, note), startgroup + chat links, folds back, 320 px');
})().catch((e) => { console.error(e); process.exit(1); });
