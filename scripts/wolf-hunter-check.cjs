// 🐺 Werewolf 🎲 extra role · 🏹 hunter (owner pick 4A, 2026-11-26) — functions/wolf-bot.js on a fake Telegram + tiny Firestore +
// fake Cloud Tasks, no network. Proves: the host's 🎲 chip toggles (others refused), the lobby says 6 seats are needed, at 5 the
// deck is unchanged, at 6 the deck line shows 🏹 1 and one 👤 less and the hunter gets the 🏹 card; a human hunter bitten at
// night → status 'shot' for 30 s: the group sees who the hunter was + ⏳ (clock-armed), the hunter gets a menu of the living,
// wrong presser / dead target / wrong round refused; the shot kills, the shot message turns into the ☀️ message with its 🗳
// button, the day goes on; a hunter voted out → the result, then 'shot', the deadline (via wolfPhase) = no shot, night 2; a bot
// hunter shoots at once with no pause; nothing is ever sent to a bot id.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));
assert.equal(B.SHOT_SEC, 30);
assert.match(B.ROLE_CARD.hunter, /^🏹 คุณคือ นักล่า\n/);
assert.match(B.RULES, /🏹 นักล่า ตายแล้วยิง 1 คนทันที/);

// ---- tiny Firestore ------------------------------------------------------------------------------------------------------
const store = new Map();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function docRef(p) {
  return {
    id: p.split('/').pop(), path: p,
    get: async () => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)) }),
    set: async (v, o) => { store.set(p, o && o.merge && store.has(p) ? Object.assign(clone(store.get(p)), clone(v)) : clone(v)); },
    update: async (v) => { assert.ok(store.has(p), 'update of a missing doc ' + p); store.set(p, Object.assign(clone(store.get(p)), clone(v))); },
    collection: (n) => colRef(p + '/' + n),
  };
}
const colRef = (p) => ({
  doc: (id) => docRef(p + '/' + id),
  where: (f, op, v) => ({ get: async () => ({ docs: [...store.keys()].filter((k) => k.startsWith(p + '/') && k.split('/').length === 2 && store.get(k)[f] != null && store.get(k)[f] <= v).map((k) => ({ id: k.split('/').pop(), data: () => clone(store.get(k)) })) }) }),
});
const db = {
  collection: colRef,
  runTransaction: async (fn) => {
    const writes = [];
    const tx = {
      get: (ref) => { assert.equal(writes.length, 0, 'transaction read after a write (' + ref.path + ')'); return ref.get(); },
      set: (ref, v, o) => writes.push(() => ref.set(v, o)),
      update: (ref, v) => writes.push(() => ref.update(v)),
    };
    const out = await fn(tx);
    for (const w of writes) await w();
    return out;
  },
};

// ---- fake Telegram + Tasks -----------------------------------------------------------------------------------------------
let sent = [], nextMsg = 100, all = [], queue = [];
const tg = async (method, body) => {
  sent.push({ method, body: clone(body) }); all.push({ method, body: clone(body) });
  if (method === 'sendMessage') return { message_id: ++nextMsg };
  return true;
};
const tasks = async (name, delaySec, body) => { queue.push({ name, delaySec, body: clone(body) }); };
let seed = 5;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const T0 = 1_800_000_000_000;
const deps = (now) => ({ db, tg, botName: async () => 'NikaWolfBot', now, rng, tasks });
const user = (n) => ({ id: 500 + n, is_bot: false, first_name: ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice'][n - 1] });
const say = (from, chat, text, now = T0) => B.handle({ message: { message_id: 1, from, chat, text } }, deps(now));
const dm = (n, text, now = T0) => say(user(n), { id: 500 + n, type: 'private' }, text, now);
const press = (n, data, now = T0) => B.handle({ callback_query: { id: 'q' + n, from: user(n), data, message: { chat: { id: 500 + n }, message_id: 7 } } }, deps(now));
const take = () => { const s = sent; sent = []; return s; };
const takeQ = () => { const q = queue; queue = []; return q; };
const G = (code) => store.get('wolf_games/' + code), SP = (code) => 'wolf_games/' + code + '/secret/state';
const alertOf = (out) => (out.find((x) => x.method === 'answerCallbackQuery') || { body: {} }).body.text;
const group = (out, chat) => out.filter((x) => x.body && x.body.chat_id === chat);
/* Force the deal so the script knows who is who (the menus already sent do not matter: every press is checked against state). */
function forceRoles(code, roles, picks) {
  const st = store.get(SP(code));
  st.roles = roles; st.alive = {}; Object.keys(roles).forEach((id) => { st.alive[id] = true; });
  if (picks) st.picks = Object.assign({ wolf: {}, bite: null, seer: null, guard: null, heal: false, poison: null, witchDone: true }, picks);
  store.set(SP(code), st);
}
async function openRoom(host, chatId, n) {
  await say(user(host), { id: chatId, type: 'supergroup' }, '/werewolf');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let k = 1; k <= n; k++) await dm(k, '/start ' + code);
  take();
  return code;
}

(async () => {
  // ---- room A: the chip, the deck, a hunter bitten at night, the shot, the day ---------------------------------------------
  const A = '-3001';
  const a = await openRoom(1, A, 5);
  await press(2, 'x:hunter:' + a); assert.match(alertOf(take()), /เฉพาะหัวห้อง/, 'only the host ticks 🎲');
  await press(1, 'x:hunter:' + a);
  let out = take(), lob = out.find((x) => x.method === 'editMessageText').body;
  assert.match(lob.text, /\n🎲 🏹 ต้อง 6 ที่\n/, '5 seats: the note says what the 🏹 needs');
  assert.deepEqual(lob.reply_markup.inline_keyboard[2].map((b) => b.text), ['🏹 ✓', '💘', '😈', '🃏', '🧱'], 'row B: a toggle per role');
  assert.equal(lob.reply_markup.inline_keyboard[2][0].callback_data, 'x:hunter:' + a);
  assert.equal(lob.reply_markup.inline_keyboard[3][0].callback_data, 'start:' + a, 'one tick: no mode row');
  assert.deepEqual(G(a).extras, ['hunter']);
  await press(1, 'x:cupid:' + a); assert.deepEqual(G(a).extras, ['hunter', 'cupid']); await press(1, 'xm:' + a); assert.equal(G(a).extraMode, 'one');   // (💘 check covers the labels)
  await press(1, 'x:hunter:' + a); await press(1, 'x:cupid:' + a); assert.match(take().find((x) => x.method === 'editMessageText').body.text, /\n⏳ อีก|✅ ครบแล้ว/); assert.deepEqual(G(a).extras, []);
  await press(1, 'x:hunter:' + a); take();
  // at 5 seats the deck is the default one
  await press(1, 'start:' + a); out = take();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🐺 1 · 🔮 1 · 🛡️ 1 · 👤 2$/, '5 seats: no 🏹 even with 🎲 on');
  assert.equal(G(a).counts.hunter, 0);
  await press(1, 'cancel:' + a); take(); takeQ();

  // 6 seats: the deck line shows 🏹 1, one 👤 less, the hunter gets the card
  const b = await openRoom(1, A, 6);
  await press(1, 'x:hunter:' + b);
  out = take(); assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🎲 🏹 แทน 👤 1 คน\n✅ ครบแล้ว/, 'the 6-seat note has no warning');
  await press(1, 'start:' + b); out = take(); takeQ();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🐺 2 · 🔮 1 · 🛡️ 1 · 🏹 1 · 👤 1$/, '6 seats: 🏹 in the deck line (pick 4A)');
  assert.deepEqual(G(b).counts, { wolf: 2, seer: 1, guard: 1, witch: 0, hunter: 1, cupid: 0, minion: 0, jester: 0, mason: 0, villager: 1 });
  const dealt = store.get(SP(b)).roles, hunterDealt = Object.keys(dealt).find((id) => dealt[id] === 'hunter');
  assert.ok(out.some((x) => x.body.chat_id === hunterDealt && x.body.text.startsWith(B.ROLE_CARD.hunter)), 'the hunter gets the 🏹 card');
  // now a known table: 501 🐺 502 🐺 503 🏹 504 🔮 505 🛡️ 506 👤
  forceRoles(b, { 501: 'wolf', 502: 'wolf', 503: 'hunter', 504: 'seer', 505: 'guard', 506: 'villager' });
  await press(1, 'n:' + b + ':1:wolf:503'); await press(2, 'n:' + b + ':1:wolf:503');
  await press(4, 'n:' + b + ':1:seer:501'); take();
  await press(5, 'n:' + b + ':1:guard:506', T0 + 10_000);   // the last press ends the night early
  out = take(); let q = takeQ();
  let g = G(b);
  assert.equal(g.status, 'shot', 'the hunter died: the game pauses for the shot');
  assert.equal(g.deadline, T0 + 10_000 + 30_000); assert.deepEqual(g.shot, { who: '503', then: 'day', lead: 'เมื่อคืน 💀 Beam ตาย · ขอเงียบในกลุ่มจนจบเกมนะ 🤐' });
  const shotMsg = group(out, A).find((x) => x.method === 'sendMessage');
  assert.equal(shotMsg.body.text, '☀️ เช้าวันที่ 1 · เมื่อคืน 💀 Beam ตาย · ขอเงียบในกลุ่มจนจบเกมนะ 🤐\n🏹 Beam เป็นนักล่า · เล็งปืนอยู่ ⏳ 0:30');
  assert.ok(g.phaseMsgId, 'the shot message is the phase message');
  const menu = out.find((x) => x.body.chat_id === '503' && /ยิงใครก่อนไป/.test(x.body.text));
  assert.deepEqual(menu.body.reply_markup.inline_keyboard.flat().map((x) => x.callback_data.split(':').pop()).sort(), ['501', '502', '504', '505', '506'], 'the menu lists the living');
  assert.deepEqual(q.map((t) => t.name), ['w-' + b + '-shot-1-30'], 'the clock arms the 30 s');
  assert.ok(!group(out, A).some((x) => /💬 คุย/.test(x.body.text)), 'no day yet');
  // refusals
  await press(4, 'h:' + b + ':1:501'); assert.match(alertOf(take()), /ไม่ใช่ตาคุณ/);
  await press(3, 'h:' + b + ':1:503'); assert.match(alertOf(take()), /ยิงคนนี้ไม่ได้/, 'self = dead = refused');
  await press(3, 'h:' + b + ':2:501'); assert.match(alertOf(take()), /หมดเวลายิงแล้ว/, 'wrong round');
  assert.equal(G(b).status, 'shot');
  // the shot: a wolf dies, the shot message becomes the ☀️ message, the day starts
  await press(3, 'h:' + b + ':1:501', T0 + 20_000); out = take(); q = takeQ();
  g = G(b);
  assert.equal(g.status, 'day'); assert.equal(g.round, 1); assert.equal(g.shot, null);
  assert.equal(g.players['501'].alive, false); assert.equal(store.get(SP(b)).alive['501'], false);
  assert.ok(out.some((x) => x.method === 'editMessageText' && x.body.chat_id === 500 + 3 && x.body.text === '🏹 คุณยิง Pond'), 'the DM says who was shot');
  const day = out.find((x) => x.method === 'editMessageText' && x.body.chat_id === A);
  assert.equal(day.body.message_id, g.phaseMsgId, 'the same group message');
  assert.equal(day.body.text, '☀️ เช้าวันที่ 1 · เมื่อคืน 💀 Beam ตาย · ขอเงียบในกลุ่มจนจบเกมนะ 🤐\n🏹 Beam ยิง Pond 💀\n👥 4 · 💬 คุย 3:00');
  assert.equal(day.body.reply_markup.inline_keyboard[0][0].callback_data, 'talk:' + b + ':1', 'the 🗳 button is there');
  assert.ok(!group(out, A).some((x) => x.method === 'sendMessage'), 'no second group message');
  assert.equal(q.length, 6, 'the day is clock-armed'); assert.equal(g.clock, 'day:1');
  // the rest: the last wolf is voted out → village
  await press(1, 'talk:' + b + ':1'); take(); takeQ();
  for (const n of [4, 5, 6]) await press(n, 'v:' + b + ':1:502');
  await press(2, 'v:' + b + ':1:skip');   // the 4th living voter closes the vote early
  out = take();
  g = G(b); assert.equal(g.status, 'over'); assert.equal(g.winner, 'village');
  const end = group(out, A).find((x) => /ชนะ/.test(x.body.text)).body.text;
  assert.match(end, /🏹 Beam 💀/); assert.match(end, /🐺 Pond 💀/);

  // ---- room B: a hunter voted out, the clock ends the shot with nobody shot, night 2 ---------------------------------------
  const Bc = '-3002';
  const c = await openRoom(1, Bc, 6);
  await press(1, 'x:hunter:' + c); take();
  await press(1, 'start:' + c); take(); takeQ();
  forceRoles(c, { 501: 'wolf', 502: 'wolf', 503: 'hunter', 504: 'seer', 505: 'guard', 506: 'villager' });
  await press(1, 'n:' + c + ':1:wolf:506'); await press(2, 'n:' + c + ':1:wolf:506'); await press(4, 'n:' + c + ':1:seer:502'); take();
  await press(5, 'n:' + c + ':1:guard:506', T0 + 5_000); out = take(); takeQ();   // the guard saves the bitten: a quiet night, 6 alive
  g = G(c); assert.equal(g.status, 'day', 'nobody died: no shot');
  assert.match(group(out, Bc).find((x) => x.method === 'sendMessage').body.text, /คืนสงบ ไม่มีใครตาย/);
  await press(1, 'talk:' + c + ':1', T0 + 30_000); take(); takeQ();
  for (const n of [1, 2, 4, 6]) await press(n, 'v:' + c + ':1:503', T0 + 40_000);
  await press(3, 'v:' + c + ':1:skip', T0 + 40_000); take();
  await press(5, 'v:' + c + ':1:503', T0 + 41_000);   // everyone voted → the vote closes early; 2 🐺 vs 3 left, the game goes on
  out = take(); q = takeQ();
  g = G(c);
  assert.equal(g.status, 'shot'); assert.deepEqual(g.shot, { who: '503', then: 'night', lead: '' }); assert.equal(g.deadline, T0 + 41_000 + 30_000);
  const txts = group(out, Bc).filter((x) => x.method === 'sendMessage').map((x) => x.body.text);
  assert.match(txts[0], /🗳 ผลโหวต วันที่ 1\nBeam 5 · ⏭ ข้าม 1\n👋 Beam ออกจากหมู่บ้าน/);
  assert.equal(txts[1], '🏹 Beam เป็นนักล่า · เล็งปืนอยู่ ⏳ 0:30');
  assert.ok(!txts.some((t) => /🌙 คืนที่ 2/.test(t)), 'night 2 waits for the shot');
  assert.deepEqual(q.map((t) => t.name), ['w-' + c + '-shot-1-30']);
  // the clock (wolfPhase) at the deadline: no shot, on to night 2
  const res = await B.phase(q[0].body, deps(T0 + 71_000)); out = take(); q = takeQ();
  assert.ok(res && !res.step);
  g = G(c); assert.equal(g.status, 'night'); assert.equal(g.round, 2); assert.equal(g.shot, null);
  assert.ok(out.some((x) => x.method === 'editMessageText' && x.body.chat_id === Bc && x.body.text === '🏹 Beam ไม่ได้ยิงใคร'), 'the shot message says nobody was shot');
  assert.ok(group(out, Bc).some((x) => x.method === 'sendMessage' && /🌙 คืนที่ 2 · ⏳ 1:30/.test(x.body.text)));
  assert.equal(Object.values(store.get(SP(c)).alive).filter(Boolean).length, 5, 'nobody else died');
  assert.equal(q[0].name, 'w-' + c + '-night-2-30');
  // a late press is refused
  await press(3, 'h:' + c + ':1:501'); assert.match(alertOf(take()), /หมดเวลายิงแล้ว/);

  await press(1, 'cancel:' + c); take(); takeQ();   // free the players for room C

  // ---- room C: a bot hunter shoots at once, no pause ----------------------------------------------------------------------
  const Cc = '-3003';
  await say(user(1), { id: Cc, type: 'supergroup' }, '/werewolf');
  const d = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let k = 1; k <= 3; k++) await dm(k, '/start ' + d);
  for (let k = 0; k < 4; k++) await press(1, 'bot:+:' + d);   // 7 seats: whoever the bot shoots, 2 🐺 vs 3 keeps the game going
  await press(1, 'x:hunter:' + d); take();
  await press(1, 'start:' + d); out = take(); takeQ();
  assert.equal(G(d).status, 'night', 'room C started (3 humans + 4 bots)');
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🏹 1/);
  forceRoles(d, { 501: 'wolf', 502: 'wolf', bot1: 'hunter', 503: 'seer', bot2: 'guard', bot3: 'villager', bot4: 'villager' }, { guard: 'bot3' });
  await press(1, 'n:' + d + ':1:wolf:bot1'); await press(2, 'n:' + d + ':1:wolf:bot1'); take();
  await press(3, 'n:' + d + ':1:seer:501', T0 + 3_000); out = take(); takeQ();
  g = G(d);
  assert.equal(g.status, 'day', 'a bot hunter does not pause the game');
  const morning = group(out, Cc).find((x) => x.method === 'sendMessage').body.text;
  const m = /🏹 ต้น 🤖 ยิง (.+?) 💀/.exec(morning);
  assert.ok(m, 'the morning line carries the bot\'s shot: ' + morning);
  assert.match(morning, /^☀️ เช้าวันที่ 1 · เมื่อคืน 💀 ต้น 🤖 ตาย/);
  const victim = Object.keys(g.players).find((id) => m[1] === g.players[id].name + (/^bot/.test(id) ? ' 🤖' : ''));
  assert.equal(store.get(SP(d)).alive[victim], false, 'the shot victim is dead');
  assert.notEqual(victim, 'bot1');

  assert.ok(!all.some((x) => x.body && /^bot\d$/.test(String(x.body.chat_id))), 'nothing was ever sent to a bot id');
  console.log('wolf-hunter-check: OK (🎲 chip host-only + 6-seat note, deck line 🏹 1 at 6, 🏹 card, night death → 30 s shot with menu + clock, refusals, shot kills and the ☀️ message keeps its button, vote death → shot → clock = no shot → night 2, bot hunter at once)');
})().catch((e) => { console.error(e); process.exit(1); });
