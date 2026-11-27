// 🐺 Werewolf 🎲 extra role · 💘 cupid (2026-11-26) — functions/wolf-bot.js on a fake Telegram + tiny Firestore + fake Tasks, no
// network. Proves: the 🎲 row (2026-11-27 pick B) ticks 🏹 / 💘 with the mode chip from two ticks; 💘 at 6 seats shows in the deck line and the cupid
// gets the card; the cupid pairs by two DM presses (self allowed, the second keyboard drops the first pick, a repeat refused),
// both lovers get a DM, the night does not end before the pair is set; a lover voted out takes the other (💔 in the result);
// a mixed pair alone wins (💘 คู่รักชนะ! and 💘 marks in the list); a lover bitten at night takes the other (💔 in the morning);
// the clock pairs at random when the cupid never presses; a bot cupid pairs at once with no DM to a bot; สุ่ม deals one of the two.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));
assert.match(B.ROLE_CARD.cupid, /^💘 คุณคือ กามเทพ\n/);
assert.match(B.RULES, /💘 กามเทพ คืนแรกจับคู่รัก/);
assert.deepEqual(Object.keys(B.EXTRAS), ['hunter', 'cupid', 'minion', 'jester', 'mason']);

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
let seed = 9;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const T0 = 1_800_000_000_000;
const deps = (now) => ({ db, tg, botName: async () => 'NikaWolfBot', now, rng, tasks });
const user = (n) => ({ id: 500 + n, is_bot: false, first_name: ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice'][n - 1] });
const say = (from, chat, text, now = T0) => B.handle({ message: { message_id: 1, from, chat, text } }, deps(now));
const dm = (n, text, now = T0) => say(user(n), { id: 500 + n, type: 'private' }, text, now);
const press = (n, data, now = T0) => B.handle({ callback_query: { id: 'q' + n, from: user(n), data, message: { chat: { id: 500 + n }, message_id: 7 } } }, deps(now));
const take = () => { const s = sent; sent = []; return s; };
const takeQ = () => { const q = queue; queue = []; return q; };
const G = (code) => store.get('wolf_games/' + code), SP = (code) => 'wolf_games/' + code + '/secret/state', S = (code) => store.get(SP(code));
const alertOf = (out) => (out.find((x) => x.method === 'answerCallbackQuery') || { body: {} }).body.text;
const group = (out, chat) => out.filter((x) => x.body && x.body.chat_id === chat);
const lastEdit = (out) => out.filter((x) => x.method === 'editMessageText').pop();
function forceRoles(code, roles, extra) {
  const st = S(code);
  st.roles = roles; st.alive = {}; Object.keys(roles).forEach((id) => { st.alive[id] = true; });
  Object.assign(st, extra || {});
  store.set(SP(code), st);
}
async function openRoom(host, chatId, n, presses) {
  await say(user(host), { id: chatId, type: 'supergroup' }, '/werewolf');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let k = 1; k <= n; k++) await dm(k, '/start ' + code);
  for (const p of presses || []) await press(host, p(code));
  take();
  return code;
}
const ROLES6 = { 501: 'wolf', 502: 'wolf', 503: 'cupid', 504: 'seer', 505: 'guard', 506: 'villager' };

(async () => {
  // ---- the 🎲 row: toggles, the mode chip from two ticks ------------------------------------------------------------------
  const A = '-4001';
  const a = await openRoom(1, A, 6);
  const labels = [];
  await press(1, 'x:hunter:' + a); let kb = lastEdit(take()).body.reply_markup.inline_keyboard; labels.push(kb[2].map((b) => b.text).join(' ')); assert.equal(kb[3][0].callback_data, 'start:' + a, 'one tick: no mode row');
  await press(1, 'x:cupid:' + a); kb = lastEdit(take()).body.reply_markup.inline_keyboard; labels.push(kb[2].map((b) => b.text).join(' ')); labels.push(kb[3][0].text); assert.equal(kb[3][0].callback_data, 'xm:' + a);
  await press(1, 'xm:' + a); kb = lastEdit(take()).body.reply_markup.inline_keyboard; labels.push(kb[3][0].text); assert.equal(kb[4][0].callback_data, 'start:' + a, 'the mode row sits above ▸ เริ่ม');
  assert.deepEqual(labels, ['🏹 ✓ 💘 😈 🃏 🧱', '🏹 ✓ 💘 ✓ 😈 🃏 🧱', '🎲 ใส่ทุกบทที่ติ๊ก', '🎲 สุ่ม 1 จากที่ติ๊ก']);
  assert.match(lastEdit([{ method: 'editMessageText', body: { text: G(a).code } }]).body.text, /^[A-Z0-9]{6}$/);
  await press(1, 'x:hunter:' + a);   // 💘 alone again (the mode stays 'one', one role = that role)
  assert.match(lastEdit(take()).body.text, /🎲 💘 แทน 👤 1 คน\n✅ ครบแล้ว/);
  assert.deepEqual(G(a).extras, ['cupid']);
  // start: 💘 in the deck line, the card
  await press(1, 'start:' + a); let out = take(); takeQ();
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /🐺 2 · 🔮 1 · 🛡️ 1 · 💘 1 · 👤 1$/);
  const dealt = S(a).roles, cupidDealt = Object.keys(dealt).find((id) => dealt[id] === 'cupid');
  assert.ok(out.some((x) => x.body.chat_id === cupidDealt && x.body.text.startsWith(B.ROLE_CARD.cupid)), 'the cupid gets the 💘 card');
  assert.ok(out.some((x) => x.body.chat_id === cupidDealt && /เลือกคู่รักคนแรก/.test(x.body.text)), 'the cupid gets the first menu');
  assert.ok(out.find((x) => x.body.chat_id === cupidDealt && /เลือกคู่รักคนแรก/.test(x.body.text)).body.reply_markup.inline_keyboard.flat().some((b) => b.callback_data.endsWith(':' + cupidDealt)), 'self is on the menu');
  // a known table: 501 🐺 502 🐺 503 💘 504 🔮 505 🛡️ 506 👤
  forceRoles(a, ROLES6);
  await press(4, 'n:' + a + ':1:cupid:501'); assert.match(alertOf(take()), /ไม่ใช่บทของคุณ/);
  await press(3, 'n:' + a + ':1:cupid:501'); out = take();
  const second = lastEdit(out).body;
  assert.equal(second.text, '💘 คนแรก Pond · เลือกคนที่สอง');
  assert.deepEqual(second.reply_markup.inline_keyboard.flat().map((b) => b.callback_data.split(':').pop()).sort(), ['502', '503', '504', '505', '506'], 'the first pick is off the second keyboard');
  assert.equal(S(a).picks.cupid1, '501'); assert.equal(S(a).lovers, null);
  await press(3, 'n:' + a + ':1:cupid:501'); assert.match(alertOf(take()), /เลือกซ้ำ/);
  await press(3, 'n:' + a + ':1:cupid:506'); out = take();
  assert.deepEqual(S(a).lovers, ['501', '506']);
  assert.ok(out.some((x) => x.method === 'editMessageText' && x.body.text === '💘 จับคู่ Pond ❤ Nam แล้ว'));
  for (const id of ['501', '506']) assert.ok(out.some((x) => x.method === 'sendMessage' && x.body.chat_id === id && /💘 คุณกับ (Nam|Pond) เป็นคู่รัก/.test(x.body.text)), id + ' hears it');
  await press(3, 'n:' + a + ':1:cupid:502'); assert.match(alertOf(take()), /จับคู่ไปแล้ว/);
  assert.equal(G(a).status, 'night', 'the others still have to press');
  // the night: the wolves bite the seer; a quiet guard; morning; vote the villager lover out → the wolf lover dies too
  await press(1, 'n:' + a + ':1:wolf:504'); await press(2, 'n:' + a + ':1:wolf:504'); await press(4, 'n:' + a + ':1:seer:502'); take();
  await press(5, 'n:' + a + ':1:guard:503', T0 + 10_000); out = take(); takeQ();
  assert.equal(G(a).status, 'day'); assert.match(group(out, A).find((x) => x.method === 'sendMessage').body.text, /💀 Fah ตาย · ขอเงียบ/);
  await press(1, 'talk:' + a + ':1', T0 + 20_000); take(); takeQ();
  for (const n of [1, 2, 3, 5]) await press(n, 'v:' + a + ':1:506', T0 + 30_000);
  await press(6, 'v:' + a + ':1:skip', T0 + 31_000); out = take(); takeQ();
  const res = group(out, A).find((x) => x.method === 'sendMessage' && /ผลโหวต/.test(x.body.text)).body.text;
  assert.match(res, /👋 Nam ออกจากหมู่บ้าน · 💔 Pond ตายตาม/);
  assert.equal(S(a).alive['501'], false); assert.equal(G(a).players['501'].alive, false);
  assert.equal(G(a).status, 'night'); assert.equal(G(a).round, 2, '1 🐺 vs 2: the game goes on');
  await press(1, 'cancel:' + a); take(); takeQ();

  // ---- room B: a mixed pair alone wins -----------------------------------------------------------------------------------
  const Bc = '-4002';
  const b = await openRoom(1, Bc, 6, [(k) => 'x:cupid:' + k]);
  await press(1, 'start:' + b); take(); takeQ();
  forceRoles(b, ROLES6);
  await press(3, 'n:' + b + ':1:cupid:503'); await press(3, 'n:' + b + ':1:cupid:501'); take();   // the cupid loves the wolf
  assert.deepEqual(S(b).lovers, ['503', '501']);
  await press(1, 'n:' + b + ':1:wolf:506'); await press(2, 'n:' + b + ':1:wolf:506'); await press(4, 'n:' + b + ':1:seer:502'); take();
  await press(5, 'n:' + b + ':1:guard:505', T0 + 5_000); take(); takeQ();
  assert.equal(G(b).status, 'day');
  await press(1, 'talk:' + b + ':1', T0 + 10_000); take(); takeQ();
  for (const n of [1, 3, 4, 5]) await press(n, 'v:' + b + ':1:502', T0 + 20_000);
  await press(2, 'v:' + b + ':1:skip', T0 + 21_000); take(); takeQ();
  assert.equal(G(b).status, 'night'); assert.equal(G(b).round, 2);   // 501 🐺 503 💘 504 🔮 505 🛡️
  await press(1, 'n:' + b + ':2:wolf:504'); await press(4, 'n:' + b + ':2:seer:501'); take();
  await press(5, 'n:' + b + ':2:guard:503', T0 + 40_000); take(); takeQ();
  assert.equal(G(b).status, 'day'); assert.equal(G(b).round, 2);   // 501 503 505
  await press(1, 'talk:' + b + ':2', T0 + 50_000); take(); takeQ();
  await press(1, 'v:' + b + ':2:505', T0 + 60_000); await press(3, 'v:' + b + ':2:505', T0 + 60_000);
  await press(5, 'v:' + b + ':2:501', T0 + 61_000); out = take(); takeQ();
  assert.equal(G(b).status, 'over'); assert.equal(G(b).winner, 'lovers');
  const end = group(out, Bc).find((x) => /ชนะ/.test(x.body.text)).body.text;
  assert.match(end, /\n💘 คู่รักชนะ!\n/); assert.match(end, /🐺 Pond 💘\n/); assert.match(end, /💘 Beam 💘\n/);
  assert.match(end, /🛡️ Ton 💀/);

  // ---- room C: a lover bitten at night takes the other; the clock pairs when the cupid never presses ----------------------
  const Cc = '-4003';
  const c = await openRoom(1, Cc, 6, [(k) => 'x:cupid:' + k]);
  await press(1, 'start:' + c); take(); takeQ();
  forceRoles(c, ROLES6);
  await press(1, 'n:' + c + ':1:wolf:506'); await press(2, 'n:' + c + ':1:wolf:506'); await press(4, 'n:' + c + ':1:seer:501'); take();
  await press(5, 'n:' + c + ':1:guard:504', T0 + 5_000); out = take(); takeQ();
  assert.equal(G(c).status, 'night', 'the cupid has not paired: the night waits');
  await B.tick(deps(T0 + 91_000)); out = take(); takeQ();
  const lv = S(c).lovers;
  assert.ok(lv && lv.length === 2 && lv[0] !== lv[1], 'the clock paired two different players: ' + lv);
  for (const id of lv) assert.ok(out.some((x) => x.method === 'sendMessage' && x.body.chat_id === id && /💘 คุณกับ/.test(x.body.text)), id + ' hears it');
  const morning = group(out, Cc).find((x) => x.method === 'sendMessage' && /☀️|ชนะ/.test(x.body.text)).body.text;
  if (lv.includes('506')) { assert.match(morning, /💀 .*Nam.* ตาย 💔 คู่รักตายตามกัน/); assert.equal(S(c).alive[lv.find((id) => id !== '506')], false); }
  else assert.match(morning, /💀 Nam ตาย · ขอเงียบ/);
  await press(1, 'cancel:' + c); take(); takeQ();

  // ---- room D: a bot cupid pairs at once; สุ่ม deals one of the two ----------------------------------------------------------
  let botCupidSeen = false, randomDealt = {};
  for (let i = 0; i < 12 && !(botCupidSeen && randomDealt.hunter && randomDealt.cupid); i++) {
    const Dc = '-5000' + i;
    await say(user(1), { id: Dc, type: 'supergroup' }, '/werewolf');
    const d = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
    await dm(1, '/start ' + d);
    for (let k = 0; k < 5; k++) await press(1, 'bot:+:' + d);
    await press(1, 'x:cupid:' + d);
    if (i % 2) { await press(1, 'x:hunter:' + d); await press(1, 'xm:' + d); }   // odd rooms: สุ่ม 1 จาก 🏹 💘 · even rooms: 💘
    take();
    await press(1, 'start:' + d); out = take(); takeQ();
    const st = S(d), g = G(d);
    const role = g.counts.cupid ? 'cupid' : 'hunter';
    if (i % 2) randomDealt[role] = true; else assert.equal(role, 'cupid');
    const cupid = Object.keys(st.roles).find((id) => st.roles[id] === 'cupid');
    if (cupid && /^bot/.test(cupid)) {
      botCupidSeen = true;
      assert.ok(st.lovers && st.lovers.length === 2 && st.lovers[0] !== st.lovers[1], 'a bot cupid paired at once');
      for (const id of st.lovers) if (!/^bot/.test(id)) assert.ok(out.some((x) => x.body.chat_id === id && /💘 คุณกับ/.test(x.body.text)), 'the human lover hears it');
    }
    await press(1, 'cancel:' + d); take(); takeQ();
  }
  assert.ok(botCupidSeen, 'saw a bot cupid'); assert.ok(randomDealt.hunter && randomDealt.cupid, 'สุ่ม dealt both over the rooms: ' + JSON.stringify(randomDealt));

  assert.ok(!all.some((x) => x.body && /^bot\d$/.test(String(x.body.chat_id))), 'nothing was ever sent to a bot id');
  console.log('wolf-cupid-check: OK (🎲 row toggles + mode chip, 💘 deck line + card, two-press pairing with self + refusals, lovers DM, night waits for the pair, vote 💔 chain, mixed pair wins 💘, night 💔 chain / clock pairs at random, bot cupid at once, สุ่ม deals both)');
})().catch((e) => { console.error(e); process.exit(1); });
