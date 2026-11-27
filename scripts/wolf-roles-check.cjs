// 🐺 Werewolf 🎲 row B + 😈 🃏 🧱 (2026-11-27) — functions/wolf-bot.js on a fake Telegram + tiny Firestore + fake Tasks, no network.
// Proves: the 🎲 row ticks each role (host only) and the lobby line says what the seats get (😈 🧱 need 7, the 🧱 pair needs two 👤,
// the mode chip = ใส่ทุกบท / สุ่ม 1); an old room's g.extra = 'random' reads as 🏹 ✓ 💘 ✓ + สุ่ม; ▸ เริ่ม deals every ticked role that
// fits (deck line) and the cards: 😈 names the wolves (the wolves' cards do not name it), each 🧱 names the other, 🃏 its own;
// 🔮 sees 😈 / 🧱 as not a wolf; 😈 🃏 🧱 have no night menu; a 🃏 voted out ends the game with 🃏 คนบ้าชนะ! · X; a 🃏 bitten
// is just dead and the game goes on; 😈 counts as everyone else (2 🐺 vs 😈 + 1 = wolves win, 😈 shown alive at the end);
// 1 human + 9 bots with everything ticked plays to the end on the clock alone with a legal winner; nothing ever sent to a bot id.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));
assert.deepEqual(Object.keys(B.EXTRAS), ['hunter', 'cupid', 'minion', 'jester', 'mason']);
assert.deepEqual(B.EXTRA_MIN, { hunter: 6, cupid: 6, minion: 7, jester: 6, mason: 7 });
assert.match(B.ROLE_CARD.minion, /^😈 คุณคือ สมุนรับใช้\n/); assert.match(B.ROLE_CARD.jester, /^🃏 คุณคือ คนบ้า\n/); assert.match(B.ROLE_CARD.mason, /^🧱 คุณคือ ช่างก่ออิฐ\n/);
assert.match(B.RULES, /😈 สมุน รู้จัก 🐺 ชนะกับ 🐺 · 🧱 ช่าง 2 คนรู้จักกัน \(7 คนขึ้นไป\) · 🃏 คนบ้า ชนะคนเดียวถ้าถูกโหวตออก/);
assert.ok(B.RULES.length < 1000, 'rules stay one short message: ' + B.RULES.length);

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
let seed = 27;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const T0 = 1_800_000_000_000;
const deps = (now) => ({ db, tg, botName: async () => 'NikaWolfBot', now, rng, tasks });
const NAMES = ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice'];
const user = (n) => ({ id: 500 + n, is_bot: false, first_name: NAMES[n - 1] });
const say = (from, chat, text, now = T0) => B.handle({ message: { message_id: 1, from, chat, text } }, deps(now));
const dm = (n, text, now = T0) => say(user(n), { id: 500 + n, type: 'private' }, text, now);
const press = (n, data, now = T0) => B.handle({ callback_query: { id: 'q' + n, from: user(n), data, message: { chat: { id: 500 + n }, message_id: 7 } } }, deps(now));
const take = () => { const s = sent; sent = []; return s; };
const takeQ = () => { const q = queue; queue = []; return q; };
const G = (code) => store.get('wolf_games/' + code), SP = (code) => 'wolf_games/' + code + '/secret/state', S = (code) => store.get(SP(code));
const alertOf = (out) => (out.find((x) => x.method === 'answerCallbackQuery') || { body: {} }).body.text;
const group = (out, chat) => out.filter((x) => x.body && x.body.chat_id === chat);
const lastEdit = (out) => out.filter((x) => x.method === 'editMessageText').pop();
const card = (out, id) => out.find((x) => x.method === 'sendMessage' && x.body.chat_id === id && /🤫 อย่าบอกใคร/.test(x.body.text)).body.text;
function forceRoles(code, roles) {
  const st = S(code);
  st.roles = roles; st.alive = {}; Object.keys(roles).forEach((id) => { st.alive[id] = true; });
  store.set(SP(code), st);
}
async function openRoom(host, chatId, n, ticks) {
  await say(user(host), { id: chatId, type: 'supergroup' }, '/werewolf');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let k = 1; k <= n; k++) await dm(k, '/start ' + code);
  for (const r of ticks || []) await press(host, 'x:' + r + ':' + code);
  take();
  return code;
}
/* The usual 7-table night 1: both wolves bite `bite`, the 🔮 looks at `look`, the 🛡️ covers `cover`, the 🧪 presses ⏭. */
async function night1(code, { bite, look, cover, seer, guard, witch, t }) {
  await press(1, 'n:' + code + ':1:wolf:' + bite); await press(2, 'n:' + code + ':1:wolf:' + bite);
  await press(seer, 'n:' + code + ':1:seer:' + look); const seen = lastEdit(take()).body.text;
  await press(guard, 'n:' + code + ':1:guard:' + cover); take();
  await press(witch, 'n:' + code + ':1:done:0', t); const out = take(); takeQ();
  return { seen, out };
}

(async () => {
  // ---- room A: the row at 7 seats, the deck, the cards, a 🃏 voted out wins ------------------------------------------------
  const A = '-6001';
  const a = await openRoom(1, A, 7, ['minion', 'mason']);
  let lob = store.get('wolf_games/' + a); assert.deepEqual(lob.extras, ['minion', 'mason']); assert.equal(lob.extraMode, 'all');
  await press(2, 'x:jester:' + a); assert.match(alertOf(take()), /เฉพาะหัวห้อง/, 'only the host ticks');
  await press(1, 'x:jester:' + a);
  let out = take(), kb = lastEdit(out).body.reply_markup.inline_keyboard, text = lastEdit(out).body.text;
  assert.deepEqual(kb[2].map((b) => b.text), ['🏹', '💘', '😈 ✓', '🃏 ✓', '🧱 ✓'], 'ticks in row order');
  assert.equal(kb[3][0].text, '🎲 ใส่ทุกบทที่ติ๊ก'); assert.equal(kb[4][0].callback_data, 'start:' + a);
  assert.match(text, /\n🎲 😈 🃏 แทน 👤 2 คน · 🧱🧱 👤 ไม่พอ\n✅ ครบแล้ว/, '7 seats have two 👤: 😈 🃏 fit, the 🧱 pair does not');
  assert.deepEqual(G(a).extras, ['minion', 'jester', 'mason'], 'kept in row order whatever the tick order');
  await press(1, 'x:jester:' + a); assert.match(lastEdit(take()).body.text, /\n🎲 😈 แทน 👤 1 คน · 🧱🧱 👤 ไม่พอ\n/);
  await press(1, 'x:minion:' + a); assert.match(lastEdit(take()).body.text, /\n🎲 🧱🧱 แทน 👤 2 คน\n/, 'the pair alone fits');
  await press(1, 'x:mason:' + a); assert.ok(!/🎲/.test(lastEdit(take()).body.text), 'nothing ticked: no 🎲 line'); assert.deepEqual(G(a).extras, []);
  await press(1, 'x:minion:' + a); await press(1, 'x:jester:' + a); take();
  await press(1, 'start:' + a); out = take(); takeQ();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🐺 2 · 🔮 1 · 🛡️ 1 · 🧪 1 · 😈 1 · 🃏 1$/, 'the deck line (no 👤 left)');
  const dealt = S(a).roles, by = (r) => Object.keys(dealt).filter((id) => dealt[id] === r);
  const minion = by('minion')[0], jester = by('jester')[0], wolves = by('wolf');
  assert.ok(card(out, minion).startsWith(B.ROLE_CARD.minion));
  assert.match(card(out, minion), new RegExp('\n🐺 หมาป่าในเกมนี้: ' + wolves.map((id) => G(a).players[id].name).join(', ') + '\nไม่มีพลังกลางคืน'), 'the 😈 card names the wolves');
  for (const w of wolves) { assert.ok(!card(out, w).includes(G(a).players[minion].name), 'a wolf card does not name the minion'); assert.ok(!/😈/.test(card(out, w))); }
  assert.ok(card(out, jester).startsWith(B.ROLE_CARD.jester));
  const asked = out.filter((x) => x.method === 'sendMessage' && /คืนนี้/.test(x.body.text)).map((x) => x.body.chat_id);
  assert.ok(!asked.includes(minion) && !asked.includes(jester), '😈 🃏 get no night menu');
  // a known table: 501 🐺 502 🐺 503 😈 504 🃏 505 🔮 506 🛡️ 507 🧪
  forceRoles(a, { 501: 'wolf', 502: 'wolf', 503: 'minion', 504: 'jester', 505: 'seer', 506: 'guard', 507: 'witch' });
  await press(3, 'n:' + a + ':1:wolf:505'); assert.match(alertOf(take()), /เลือกคนนี้ไม่ได้/, 'the minion cannot bite');
  let n1 = await night1(a, { bite: '506', look: '503', cover: '505', seer: 5, guard: 6, witch: 7, t: T0 + 10_000 });
  assert.equal(n1.seen, '🔮 Beam = ไม่ใช่หมาป่า', '🔮 sees the minion as not a wolf');
  assert.equal(G(a).status, 'day'); assert.match(group(n1.out, A).find((x) => x.method === 'sendMessage').body.text, /💀 Nam ตาย · ขอเงียบ/);
  await press(1, 'talk:' + a + ':1', T0 + 20_000); take(); takeQ();
  for (const n of [1, 2, 3, 5, 7]) await press(n, 'v:' + a + ':1:504', T0 + 30_000);
  await press(4, 'v:' + a + ':1:skip', T0 + 31_000); out = take(); takeQ();
  assert.equal(G(a).status, 'over'); assert.equal(G(a).winner, 'jester'); assert.equal(S(a).jesterWin, '504');
  const endA = group(out, A).find((x) => /ชนะ/.test(x.body.text)).body.text;
  assert.match(endA, /🗳 ผลโหวต วันที่ 1\nFah 5 · ⏭ ข้าม 1\n👋 Fah ออกจากหมู่บ้าน/, 'the vote result leads');
  assert.match(endA, /\n\n🃏 คนบ้าชนะ! · Fah หลอกทุกคนได้\n/);
  assert.match(endA, /\n😈 Beam\n/); assert.match(endA, /\n🃏 Fah 💀\n/); assert.match(endA, /\n🛡️ Nam 💀\n/);
  assert.equal(store.get('wolf_chats/' + A).game, null, 'the chat is free again');

  // ---- room B: a 🃏 bitten at night is just dead -------------------------------------------------------------------------
  const Bc = '-6002';
  const b = await openRoom(1, Bc, 7, ['jester']);
  await press(1, 'start:' + b); take(); takeQ();
  forceRoles(b, { 501: 'wolf', 502: 'wolf', 503: 'jester', 504: 'seer', 505: 'guard', 506: 'villager', 507: 'witch' });
  n1 = await night1(b, { bite: '503', look: '502', cover: '506', seer: 4, guard: 5, witch: 7, t: T0 + 10_000 });
  assert.equal(G(b).status, 'day', 'the game goes on'); assert.ok(!G(b).winner); assert.equal(S(b).jesterWin, null);
  assert.equal(S(b).alive['503'], false);
  assert.match(group(n1.out, Bc).find((x) => x.method === 'sendMessage').body.text, /💀 Beam ตาย · ขอเงียบ/);
  await press(1, 'cancel:' + b); take(); takeQ();

  // ---- room C: 😈 counts as everyone else and wins with the wolves ------------------------------------------------------
  const Cc = '-6003';
  const c = await openRoom(1, Cc, 7, ['minion']);
  await press(1, 'start:' + c); out = take(); takeQ();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🐺 2 · 🔮 1 · 🛡️ 1 · 🧪 1 · 😈 1 · 👤 1$/);
  forceRoles(c, { 501: 'wolf', 502: 'wolf', 503: 'minion', 504: 'seer', 505: 'guard', 506: 'villager', 507: 'witch' });
  n1 = await night1(c, { bite: '506', look: '501', cover: '507', seer: 4, guard: 5, witch: 7, t: T0 + 10_000 });
  assert.equal(n1.seen, '🔮 Pond = 🐺 หมาป่า!');
  assert.equal(G(c).status, 'day');   // 501 502 503 504 505 507
  await press(1, 'talk:' + c + ':1', T0 + 20_000); take(); takeQ();
  for (const n of [1, 2, 3, 5, 7]) await press(n, 'v:' + c + ':1:504', T0 + 30_000);
  await press(4, 'v:' + c + ':1:501', T0 + 31_000); take(); takeQ();
  assert.equal(G(c).status, 'night'); assert.equal(G(c).round, 2, '2 🐺 vs 😈 🛡️ 🧪 = the game goes on');
  await press(1, 'n:' + c + ':2:wolf:507'); await press(2, 'n:' + c + ':2:wolf:507'); take();
  await press(7, 'n:' + c + ':2:done:0'); take();
  await press(5, 'n:' + c + ':2:guard:503', T0 + 60_000); out = take(); takeQ();
  assert.equal(G(c).status, 'over'); assert.equal(G(c).winner, 'wolf', '2 🐺 vs 😈 + 🛡️ = wolves (the minion is everyone else)');
  const endC = group(out, Cc).find((x) => /ชนะ/.test(x.body.text)).body.text;
  assert.match(endC, /\n🐺 หมาป่าชนะ!\n/); assert.match(endC, /\n😈 Beam\n/, 'the minion is alive and on the winning side');

  // ---- room D: the 🧱 pair know each other, 🔮 sees them as villagers ---------------------------------------------------
  const Dc = '-6004';
  const d = await openRoom(1, Dc, 7, ['mason']);
  await press(1, 'start:' + d); out = take(); takeQ();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🐺 2 · 🔮 1 · 🛡️ 1 · 🧪 1 · 🧱 2$/);
  const dr = S(d).roles, masons = Object.keys(dr).filter((id) => dr[id] === 'mason');
  assert.equal(masons.length, 2);
  assert.ok(card(out, masons[0]).includes('\n🧱 อีกคน: ' + G(d).players[masons[1]].name + ' · ไว้ใจกันได้ 100%\n'));
  assert.ok(card(out, masons[1]).includes('\n🧱 อีกคน: ' + G(d).players[masons[0]].name + ' · ไว้ใจกันได้ 100%\n'));
  forceRoles(d, { 501: 'wolf', 502: 'wolf', 503: 'mason', 504: 'mason', 505: 'seer', 506: 'guard', 507: 'witch' });
  await press(5, 'n:' + d + ':1:seer:503'); assert.equal(lastEdit(take()).body.text, '🔮 Beam = ไม่ใช่หมาป่า');
  await press(3, 'n:' + d + ':1:wolf:505'); assert.match(alertOf(take()), /เลือกคนนี้ไม่ได้/, 'a mason has no night pick');
  await press(1, 'cancel:' + d); take(); takeQ();

  // ---- room E: bots — the line at 7 and 10 seats, an old room's g.extra, สุ่ม, then whole games on the clock -----------------
  const Ec = '-6005';
  await say(user(1), { id: Ec, type: 'supergroup' }, '/werewolf');
  const e = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  await dm(1, '/start ' + e);
  for (let k = 0; k < 6; k++) await press(1, 'bot:+:' + e);
  take();
  { const g = G(e); delete g.extras; delete g.extraMode; g.extra = 'random'; store.set('wolf_games/' + e, g); }   // a room from before the row
  await press(1, 'extra:' + e); out = take(); kb = lastEdit(out).body.reply_markup.inline_keyboard;
  assert.deepEqual(kb[2].map((x) => x.text), ['🏹 ✓', '💘 ✓', '😈', '🃏', '🧱'], 'old random = 🏹 💘 ticked');
  assert.equal(kb[3][0].text, '🎲 สุ่ม 1 จากที่ติ๊ก'); assert.match(lastEdit(out).body.text, /\n🎲 สุ่ม 1 จาก 🏹 💘\n/);
  assert.deepEqual(G(e).extras, ['hunter', 'cupid']); assert.equal(G(e).extraMode, 'one');
  for (const r of ['minion', 'jester', 'mason']) await press(1, 'x:' + r + ':' + e);
  assert.match(lastEdit(take()).body.text, /\n🎲 สุ่ม 1 จาก 🏹 💘 😈 🃏 🧱🧱\n/, '7 seats: every role fits alone (the pair takes both 👤)');
  await press(1, 'xm:' + e);
  assert.match(lastEdit(take()).body.text, /\n🎲 🏹 💘 แทน 👤 2 คน · 😈 👤 ไม่พอ · 🃏 👤 ไม่พอ · 🧱🧱 👤 ไม่พอ\n/, 'ใส่ทุกบท at 7: the first two 👤 go in row order');
  for (let k = 0; k < 3; k++) await press(1, 'bot:+:' + e);
  text = lastEdit(take()).body.text;
  assert.match(text, /👥 1\/10/); assert.match(text, /\n🎲 🏹 💘 😈 🃏 แทน 👤 4 คน · 🧱🧱 👤 ไม่พอ\n/, '10 seats: four 👤 to swap');
  await press(1, 'xm:' + e); assert.match(lastEdit(take()).body.text, /\n🎲 สุ่ม 1 จาก 🏹 💘 😈 🃏 🧱🧱\n/, 'at 10 every role fits alone'); await press(1, 'xm:' + e); take();
  await press(1, 'start:' + e); out = take(); takeQ();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /10 คน\n.*🐺 3 · 🔮 1 · 🛡️ 1 · 🧪 1 · 🏹 1 · 💘 1 · 😈 1 · 🃏 1$/);
  const cnt = G(e).counts; assert.equal(cnt.villager, 0); assert.equal(cnt.mason, 0);
  const LIVE = ['night', 'day', 'vote', 'shot'];
  async function runOut(code) {
    for (let i = 0; i < 300 && LIVE.includes(G(code).status); i++) { const g = G(code); await B.tick(deps(g.deadline + 1000)); take(); takeQ(); }
    assert.equal(G(code).status, 'over', code + ' ended');
    return G(code).winner;
  }
  const winners = { [await runOut(e)]: 1 };
  for (let i = 0; i < 9; i++) {
    const chat = '-7000' + i;
    await say(user(1), { id: chat, type: 'supergroup' }, '/werewolf');
    const k = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
    await dm(1, '/start ' + k);
    for (let j = 0; j < (i % 2 ? 9 : 6); j++) await press(1, 'bot:+:' + k);   // 10 or 7 seats
    for (const r of Object.keys(B.EXTRAS)) await press(1, 'x:' + r + ':' + k);
    if (i % 3 === 0) await press(1, 'xm:' + k);
    take();
    await press(1, 'start:' + k); take(); takeQ();
    assert.equal(W.countsError(G(k).counts, Object.keys(G(k).players).length), null, 'a legal deck');
    const w = await runOut(k);
    assert.ok(['wolf', 'village', 'lovers', 'jester'].includes(w), 'winner ' + w);
    winners[w] = (winners[w] || 0) + 1;
    const end = all.filter((x) => x.body && x.body.chat_id === chat && /ชนะ/.test(x.body.text)).pop().body.text;
    if (w === 'jester') assert.match(end, /🃏 คนบ้าชนะ! · .+ หลอกทุกคนได้/);
    assert.equal(W.winner(S(k)), w, 'the message matches the engine');
  }
  assert.ok(!all.some((x) => x.body && /^bot\d$/.test(String(x.body.chat_id))), 'nothing was ever sent to a bot id');
  console.log('wolf-roles-check: OK (🎲 row ticks + lobby line at 7/10, old g.extra read, สุ่ม 1, deck line + 😈 🃏 🧱 cards, no night menu, 🔮 sees them as villagers, 🃏 voted out wins / bitten just dies, 😈 parity + wins with 🐺, 10 clock games ' + JSON.stringify(winners) + ')');
})().catch((e) => { console.error(e); process.exit(1); });
