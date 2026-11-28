// V101.393 (owner 2026-11-28: "ปรับชื่อเกมเป็นภาษาอังกฤษ แล้ว hover เป็นภาษาไทย กับ เกาหลี") on the REAL index.html.
// The game names show in English — phone row (short): Cereal · Wolf · Count · Shadow · Secret · Carry 13 · Memory; PC 🎮 menu (full): Werewolf ·
// Count Fast · Shadow tiles · Secret number; the popup titles the same. Hover (title) = a Thai line + a Korean line, whatever the
// language button says (no data-th-title / data-kr-title on them, so lang-toggle.js does not rewrite it). All six names fit 320 px.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TIPS = [
  'Cereal Killer · เกมนักสืบ 2 คน\nCereal Killer · 2인 추리 게임',
  'มนุษย์หมาป่า · เล่นกับบอท\n늑대인간 · 봇과 대결',
  'นับไว · นับสี่เหลี่ยม นับลูกบาศก์\n빨리 세기 · 사각형과 큐브',
  'ไพ่เงา · ดวลเลขลับกับบอท\n그림자 패 · 봇과 숫자 대결',
  'เลขลับ · ทายเลขของบอท 1–100\n비밀 숫자 · 봇의 1–100 맞히기',
  'Carry 13 · ห้ามแบกถึง 13\n돌 나르기 13 · 13을 넘기지 마세요',
  'Memory Fracture · จำชั้นยา หาจุดที่เปลี่ยน\nMemory Fracture · 선반을 기억하고 바뀐 곳 찾기',
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of ['internGuideSeen', 'journalTourSeen', 'cerealTourSeen', 'wolfTourSeen', 'bwTourSeen', 'countTourSeen', 'snTourSeen', 'r13TourSeen']) localStorage.setItem(k, '1'); localStorage.setItem('wolfCoachSeen', 'all'); localStorage.setItem('cerealCoachSeen', 'all');
    window.firebase = { auth: () => ({ currentUser: { uid: 'u1' }, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 0 } }) };
    const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 15000) return 0; return st.call(this, fn, ms, ...a); };
  });
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => { document.getElementById('main-app').style.setProperty('display', 'block', 'important'); const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important'); });

  const read = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((b) => {
    const s = b.querySelector('small');
    return { name: b.innerText.replace(/\s+/g, ' ').trim(), tip: b.title, aria: b.getAttribute('aria-label'), swap: b.hasAttribute('data-th-title') || b.hasAttribute('data-kr-title'), cut: s.scrollWidth > s.clientWidth, h: Math.round(b.getBoundingClientRect().height) };
  }), sel);

  // phone row: short English names, Thai + Korean on hover
  let r = await read('#u-games-row button');
  assert.deepEqual(r.map((x) => x.name), ['🥣 Cereal', '🐺 Wolf', '🧊 Count', '⚫ Shadow', '🔢 Secret', '🪨 Carry 13', '🪞 Memory'], 'phone row: English names');
  assert.deepEqual(r.map((x) => x.tip), TIPS, 'phone row: hover = a Thai line + a Korean line');
  assert.deepEqual(r.map((x) => x.aria), ['Cereal Killer game', 'Werewolf game', 'Count Fast game', 'Shadow tiles game', 'Secret number game', 'Carry 13 game', 'Memory Fracture game'], 'the English name stays for screen readers');
  assert.ok(r.every((x) => !x.swap), 'no data-th-title / data-kr-title: the language button cannot rewrite the hover');
  for (const w of [390, 360, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    assert.deepEqual((await read('#u-games-row button')).filter((x) => x.cut).map((x) => x.name), [], w + ' px: no name is cut');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // the language button (EN → KR → TH → K·T) leaves the names and the hover alone
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.cycleLang());
    r = await read('#u-games-row button');
    assert.deepEqual(r.map((x) => x.tip), TIPS, 'language state ' + (i + 1) + ': the hover is the same');
    assert.deepEqual(r.map((x) => x.name), ['🥣 Cereal', '🐺 Wolf', '🧊 Count', '⚫ Shadow', '🔢 Secret', '🪨 Carry 13', '🪞 Memory']);
  }
  await page.evaluate(() => window.cycleLang());   // back to EN

  // popup titles: English, the Thai · Korean name on hover
  for (const [id, modal, name, tip] of [['sch-wolf-btn', 'wolfModal', '🐺 Werewolf', 'มนุษย์หมาป่า · 늑대인간'], ['sch-count-btn', 'countModal', '🧊 Count Fast', 'นับไว · 빨리 세기'], ['sch-bw-btn', 'bwModal', '⚫⚪ Shadow tiles', 'ไพ่เงา · 그림자 패'], ['sch-sn-btn', 'snModal', '🔢 Secret number', 'เลขลับ · 비밀 숫자']]) {
    await page.click('#' + id);
    const t = await page.$eval('#' + modal + ' h3', (h) => ({ name: h.innerText.trim(), tip: h.title || (h.querySelector('[title]') || {}).title || '' }));
    assert.deepEqual(t, { name, tip }, modal + ': English title, Thai · Korean on hover');
    await page.evaluate((m) => { document.getElementById(m).style.display = 'none'; }, modal);
  }

  // PC 🎮 menu: full English names, one line each
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.click('#u-games-chip');
  r = await read('#u-games-menu button');
  assert.deepEqual(r.map((x) => x.name), ['🥣 Cereal 2-player detective', '🐺 Werewolf vs bots', '🧊 Count Fast count shapes', '⚫ Shadow tiles number duel', '🔢 Secret number guess 1–100', '🪨 Carry 13 stay under 13', '🪞 Memory Fracture spot changes'], 'PC menu: English names and English subtitles (V101.394)');
  assert.deepEqual(r.map((x) => x.tip), TIPS, 'PC menu: hover = a Thai line + a Korean line');
  assert.ok(r.every((x) => x.h <= 44 && x.h === r[0].h && !x.swap), 'PC menu: every row stays one line (40 px, 44 px on a touch screen) ' + JSON.stringify(r.map((x) => x.h)));

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('game-names-qa: OK — phone row Cereal · Wolf · Count · Shadow · Secret · Carry 13 · Memory (none cut at 320 px); PC menu Werewolf · Count Fast · Shadow tiles · Secret number on one line each; popup titles in English; hover = Thai + Korean in every language state');
})().catch((e) => { console.error(e); process.exit(1); });
