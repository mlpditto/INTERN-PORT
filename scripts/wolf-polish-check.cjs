// 🐺 Werewolf Phase 3 (polish) — functions/wolf-bot.js on a fake Telegram API + a tiny in-memory Firestore, no network.
// Owner picks (mockup-werewolf-p3/, 2026-11-25): R1 /rules = one plain message, a line per role + the flow + the win rule ·
// W1 ⏳ "เหลือ ~1 นาที": one group line in the talk, a DM to each night actor who has not pressed yet, nothing in the vote,
// at most once per phase · D1 a living player who misses 2 of their phases in a row (a night with buttons, or a vote) gets
// ONE reminder DM, the group is told nothing, nobody is kicked. Also: ✕ mid-game posts a new group line (no roles), closes
// the vote buttons, frees the chat + players, and later presses / ticks do nothing; every text is plain (no parse_mode) and
// < 4096 chars; every callback_data ≤ 64 bytes; no group text names a role before the end (Q4).
const assert = require('node:assert/strict');
const path = require('node:path');
const B = require(path.join(__dirname, '..', 'functions', 'wolf-bot.js'));

let store = new Map();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function docRef(p) {
  return {
    id: p.split('/').pop(), path: p,
    get: async () => ({ id: p.split('/').pop(), exists: store.has(p), data: () => clone(store.get(p)) }),
    set: async (v) => { store.set(p, clone(v)); },
    update: async (v) => { assert.ok(store.has(p), 'update of a missing doc ' + p); store.set(p, Object.assign(clone(store.get(p)), clone(v))); },
    collection: (n) => colRef(p + '/' + n),
  };
}
const colRef = (p) => ({
  doc: (id) => docRef(p + '/' + id),
  where: (f, op, v) => {
    assert.equal(op, '<='); assert.equal(f, 'deadline');
    return { get: async () => ({ docs: [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'))
      .filter((k) => { const d = store.get(k)[f]; return d !== null && d !== undefined && d <= v; }).map((k) => ({ id: k.split('/').pop() })) }) };
  },
});
const db = {
  collection: colRef,
  runTransaction: async (fn) => {
    const writes = [];
    const tx = {
      get: (ref) => { assert.equal(writes.length, 0, 'transaction read after a write (' + ref.path + ')'); return ref.get(); },
      set: (ref, v) => writes.push(() => ref.set(v)),
      update: (ref, v) => writes.push(() => ref.update(v)),
    };
    const out = await fn(tx);
    for (const w of writes) await w();
    return out;
  },
};
let sent = [], all = [], nextMsg = 100;
const tg = async (method, body) => {
  const rec = { method, body: clone(body) };
  sent.push(rec); all.push(rec);
  if (method === 'sendMessage') { rec.id = ++nextMsg; return { message_id: rec.id }; }
  return true;
};
let NOW = 1_800_000_000_000, seed = 5;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const deps = () => ({ db, tg, botName: async () => 'NikaWolfBot', now: NOW, rng });
const GROUP = { id: -1001, type: 'supergroup', title: 'ทีม' };
const NAMES = ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice'];
const user = (n) => ({ id: 700 + n, is_bot: false, first_name: NAMES[n - 1] });
const say = (from, chat, text) => B.handle({ message: { message_id: 1, from, chat, text } }, deps());
let qid = 0;
const press = (uid, data) => B.handle({ callback_query: { id: 'q' + (++qid), from: { id: Number(uid), first_name: 'x' }, data } }, deps());
const take = () => { const s = sent; sent = []; return s; };
const toast = (out) => (out.find((x) => x.method === 'answerCallbackQuery') || { body: {} }).body.text || '';
const toGroup = (out) => out.filter((x) => x.body && x.body.text && x.body.chat_id === '-1001');
const ROLE_TEXT = /คุณคือ|ผู้หยั่งรู้|บอดี้การ์ด|แม่มด|ชาวบ้าน|เพื่อน:|🔮|🛡️|🧪|👤/;

async function newGame(n) {
  store = new Map(); sent = [];
  await say(user(1), GROUP, '/werewolf');
  const lobby = take()[0].body.text;
  const code = /ห้อง ([A-Z0-9]{6})/.exec(lobby)[1];
  assert.match(lobby, /\/rules/, 'the lobby points to /rules');
  for (let i = 1; i <= n; i++) await say(user(i), { id: 700 + i, type: 'private' }, '/start ' + code);
  take();
  await press(701, 'start:' + code);
  take();
  const G = () => store.get('wolf_games/' + code), S = () => store.get('wolf_games/' + code + '/secret/state');
  const who = (role) => Object.keys(S().roles).filter((id) => S().roles[id] === role);
  return { code, G, S, who };
}

(async () => {
  // ---- R1: /rules -------------------------------------------------------------------------------------------------------
  for (const [chat, cmd] of [[GROUP, '/rules'], [{ id: 702, type: 'private' }, '/rules'], [GROUP, '/rules@NikaWolfBot']]) {
    await say(user(2), chat, cmd);
    const out = take();
    assert.equal(out.length, 1, cmd + ' answers once');
    const t = out[0].body.text;
    assert.equal(String(out[0].body.chat_id), String(chat.id));
    assert.ok(t.length < 1000, '/rules stays short (' + t.length + ')');
    for (const e of ['🐺', '🔮', '🛡️', '🧪', '👤', '🌙', '☀️', '💬', '🗳', '🏆']) assert.ok(t.includes(e), '/rules has ' + e);
    assert.match(t, /1:30/); assert.match(t, /3:00/); assert.match(t, /1:00/); assert.match(t, /เสมอ = ไม่มีใครออก/);
  }
  await say(user(2), { id: 702, type: 'private' }, '/start'); assert.match(take()[0].body.text, /\/rules/, 'the DM hello points to /rules');

  // ---- W1 + D1 on a scripted 5-player game: 🐺 1 · 🔮 1 · 🛡️ 1 · 👤 2 --------------------------------------------------
  let { code, G, S, who } = await newGame(5);
  const [wolf] = who('wolf'), [seer] = who('seer'), [guard] = who('guard'), [v1, v2] = who('villager');
  assert.equal(G().status, 'night');
  // too early: nothing
  NOW = G().deadline - 61_000; assert.equal(await B.tick(deps()), 0); assert.equal(take().length, 0, 'no warning with > 60 s left');
  await press(wolf, 'n:' + code + ':1:wolf:' + v1); await press(guard, 'n:' + code + ':1:guard:' + v1); take();
  NOW = G().deadline - 30_000; assert.equal(await B.tick(deps()), 0, 'a warning moves nothing');
  let out = take();
  const warns = out.filter((x) => /⏳ เหลือ ~1 นาที/.test(x.body.text || ''));
  assert.deepEqual(warns.map((x) => String(x.body.chat_id)), [seer], 'W1: only the 🔮 who has not pressed gets the night DM');
  assert.equal(toGroup(out).length, 0, 'W1: no night warning in the group');
  NOW += 10_000; await B.tick(deps()); assert.equal(take().length, 0, 'the warning is posted once per phase');
  NOW = G().deadline + 1; assert.equal(await B.tick(deps()), 1);   // 🔮 missed night 1 (miss 1)
  out = take();
  assert.ok(!out.some((x) => /💤 ไม่ได้กด/.test(x.body.text || '')), 'one miss = no reminder');
  assert.equal(G().status, 'day'); assert.equal(S().alive[v1], true, '🛡️ saved the bitten');
  // talk: warning in the group, once
  NOW = G().deadline - 20_000; await B.tick(deps()); out = take();
  assert.equal(out.length, 1); assert.equal(out[0].body.chat_id, '-1001'); assert.match(out[0].body.text, /^⏳ เหลือ ~1 นาที · แล้วโหวต 🗳$/);
  await B.tick(deps()); assert.equal(take().length, 0, 'talk warning once');
  NOW = G().deadline + 1; await B.tick(deps()); take();
  assert.equal(G().status, 'vote');
  // vote: no warning (it is only 1:00)
  NOW = G().deadline - 30_000; await B.tick(deps()); assert.equal(take().length, 0, 'W1: no vote warning');
  for (const id of [wolf, guard, v1]) await press(id, 'v:' + code + ':1:skip');   // 🔮 (miss 2) and v2 (miss 1) do not vote
  take();
  NOW = G().deadline + 1; await B.tick(deps()); out = take();
  assert.equal(G().status, 'night'); assert.equal(G().round, 2);
  let rem = out.filter((x) => /💤 ไม่ได้กด 2 รอบติด/.test(x.body.text || ''));
  assert.deepEqual(rem.map((x) => String(x.body.chat_id)), [seer], 'D1: the 🔮 who missed night 1 + vote 1 gets one DM');
  assert.match(rem[0].body.text, new RegExp('ห้อง ' + code));
  assert.ok(!toGroup(out).some((x) => /💤 ไม่ได้กด/.test(x.body.text)), 'D1: the group is told nothing');
  // night 2: the 🔮 misses a 3rd time → no second DM; the 🛡️ cannot repeat v1, guards v2 who is bitten
  await press(wolf, 'n:' + code + ':2:wolf:' + v2); await press(guard, 'n:' + code + ':2:guard:' + v2); take();
  NOW = G().deadline + 1; await B.tick(deps()); out = take();
  assert.ok(!out.some((x) => /💤 ไม่ได้กด/.test(x.body.text || '')), 'one reminder per streak');
  assert.ok(Object.values(S().alive).every(Boolean), 'nobody kicked or killed');
  // vote 2: v2 misses again → DM; the 🔮 votes → their count resets
  await press(G().host, 'talk:' + code + ':2'); take();
  for (const id of [wolf, seer, guard, v1]) await press(id, 'v:' + code + ':2:skip');
  take();
  NOW = G().deadline + 1; await B.tick(deps()); out = take();
  rem = out.filter((x) => /💤 ไม่ได้กด 2 รอบติด/.test(x.body.text || ''));
  assert.deepEqual(rem.map((x) => String(x.body.chat_id)), [v2], 'D1: the villager who missed 2 votes gets one DM');
  assert.equal(S().miss[seer], 0, 'a press resets the count');
  // night 3: the 🔮 misses once after the reset → no DM
  await press(wolf, 'n:' + code + ':3:wolf:' + v1); await press(guard, 'n:' + code + ':3:guard:' + v1); take();
  NOW = G().deadline + 1; await B.tick(deps()); out = take();
  assert.ok(!out.some((x) => /💤 ไม่ได้กด/.test(x.body.text || '')), 'no reminder after a reset + one miss');

  // ---- ✕ mid-game (vote) ------------------------------------------------------------------------------------------------
  await press(G().host, 'talk:' + code + ':3'); take();
  assert.equal(G().status, 'vote');
  const voteMsg = G().voteMsgId;
  await press(seer, 'cancel:' + code); assert.match(toast(take()), /เฉพาะหัวห้อง/);
  await press(G().host, 'cancel:' + code); out = take();
  assert.equal(G().status, 'cancelled'); assert.equal(G().deadline, null);
  const line = toGroup(out).find((x) => x.method === 'sendMessage');
  assert.ok(line, '✕ mid-game posts a new group line'); assert.match(line.body.text, /✕ ยกเลิกเกม/); assert.ok(!ROLE_TEXT.test(line.body.text), 'no roles on ✕');
  const ve = out.find((x) => x.method === 'editMessageText' && x.body.message_id === voteMsg);
  assert.ok(ve && !ve.body.reply_markup, '✕ closes the vote buttons');
  assert.equal(store.get('wolf_chats/-1001').game, null);
  for (const id of Object.keys(G().players)) assert.equal(store.get('wolf_tg/' + id).game, null, 'players freed');
  await press(seer, 'v:' + code + ':3:skip'); assert.match(toast(take()), /ยกเลิก/);
  NOW += 999_999; assert.equal(await B.tick(deps()), 0); assert.equal(take().length, 0, 'a cancelled game never ticks');
  await press(G().host, 'cancel:' + code); assert.match(toast(take()), /ปิดแล้ว/);

  // ---- ✕ mid-game (night) + the players can join a new room at once --------------------------------------------------
  ({ code, G, S, who } = await newGame(6));
  const w2 = who('wolf')[0];
  await press(701, 'cancel:' + code); out = take();
  assert.equal(G().status, 'cancelled');
  assert.ok(toGroup(out).some((x) => /✕ ยกเลิกเกม/.test(x.body.text)));
  await press(w2, 'n:' + code + ':1:wolf:' + who('villager')[0]); assert.match(toast(take()), /ยกเลิก/);
  await say(user(2), GROUP, '/werewolf'); const c2 = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  await say(user(3), { id: 703, type: 'private' }, '/start ' + c2); assert.match(take()[0].body.text, /เข้าห้อง/);

  // ---- every message: plain text, < 4096, callback_data ≤ 64 bytes, no role in a group before the end ------------------
  for (const r of all) {
    const b = r.body || {};
    assert.ok(!('parse_mode' in b), 'plain text only');
    if (b.text) assert.ok(b.text.length < 4096, 'under Telegram\'s limit');
    for (const k of (b.reply_markup ? b.reply_markup.inline_keyboard.flat() : [])) if (k.callback_data) assert.ok(Buffer.byteLength(k.callback_data) <= 64, k.callback_data);
    if (b.text && b.chat_id === '-1001' && !/^🐺 เกมเริ่ม|^🐺 มนุษย์หมาป่า · กติกา/.test(b.text) && !/ชนะ!/.test(b.text)) assert.ok(!ROLE_TEXT.test(b.text), 'no role in a group text (Q4): ' + b.text);
  }
  console.log('wolf-polish-check: OK (' + all.length + ' messages)');
})().catch((e) => { console.error(e); process.exit(1); });
