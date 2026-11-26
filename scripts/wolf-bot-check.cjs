// 🐺 Werewolf Phase 1 — functions/wolf-bot.js (the Telegram room logic) on a fake Telegram API + a tiny in-memory Firestore, no
// network. Proves: index.js exports wolfBot behind the X-Telegram-Bot-Api-Secret-Token check with its own two secrets; rules keep
// wolf_* closed; /werewolf in a group posts one lobby with a deep link t.me/<bot>?start=<code>; /start <code> in a DM seats a
// player and edits that same lobby message; a second /werewolf in the same chat is refused; host-only ▸ เริ่ม needs 5;
// 6 players get the right deck, each DM card names only their own role (wolves see each other); NO group text ever holds a
// role word; full / started / unknown / other-room joins are refused; ✕ closes the room and frees the chat and players;
// /werewolf@<bot> works; transactions read before they write (real Firestore requires it). Names (owner pick B): a plain DM
// renames you in a lobby (lobby line + host tag follow, duplicates refused, blanks ignored), is kept for the next room, and
// mid-game only changes the next room; freeing a player keeps the name (set merge).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
assert.ok(/exports\.wolfBot = onRequest\(\{ secrets: \['TELEGRAM_WOLF_TOKEN', 'TELEGRAM_WOLF_HOOK_SECRET'\]/.test(idx), 'wolfBot has its own two secrets');
assert.ok(/req\.get\('X-Telegram-Bot-Api-Secret-Token'\) !== want\) return res\.status\(403\)/.test(idx), 'wolfBot refuses updates without the secret header');
assert.ok(!/TELEGRAM_BOT_TOKEN/.test(idx.slice(idx.indexOf('exports.wolfBot'), idx.indexOf('exports.askNika'))), 'wolfBot never uses the admin alerts bot token');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
for (const m of ['wolf_games/{code=**}', 'wolf_chats/{chatId}', 'wolf_tg/{tgId}']) {
  assert.ok(new RegExp('match /' + m.replace(/[{}*=]/g, '\\$&') + ' \\{\\s*allow read, write: if false;').test(rules), 'rules: ' + m + ' closed');
}
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));

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
const colRef = (p) => ({ doc: (id) => docRef(p + '/' + id) });
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

// ---- fake Telegram -------------------------------------------------------------------------------------------------------
let sent = [], nextMsg = 100, failDm = new Set();
const toGroups = [];   // every text the bot ever sent or edited into a group
const tg = async (method, body) => {
  sent.push({ method, body: clone(body) });
  if (body && body.text && String(body.chat_id).startsWith('-')) toGroups.push(body.text);
  if (method === 'sendMessage' && failDm.has(String(body.chat_id))) throw new Error('sendMessage 403 Forbidden: bot was blocked by the user');
  if (method === 'sendMessage') return { message_id: ++nextMsg };
  return true;
};
let seed = 7;
const deps = () => ({ db, tg, botName: async () => 'NikaWolfBot', now: 1_800_000_000_000, rng: () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; } });
const GROUP = { id: -1001, type: 'supergroup', title: 'ทีม' };
const user = (n) => ({ id: 500 + n, is_bot: false, first_name: ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice', 'Gun', 'Jay', 'Kim', 'Lek'][n - 1] });
const say = (from, chat, text) => B.handle({ message: { message_id: 1, from, chat, text } }, deps());
const dm = (n, text) => say(user(n), { id: 500 + n, type: 'private' }, text);
const press = (n, data) => B.handle({ callback_query: { id: 'q' + n, from: user(n), data } }, deps());
const take = () => { const s = sent; sent = []; return s; };
const ROLE_WORDS = /คุณคือ|ผู้หยั่งรู้|บอดี้การ์ด|แม่มด|ชาวบ้าน|เพื่อน:/;   // 'มนุษย์หมาป่า' is the game's name

(async () => {
  // DM /werewolf and bare /start explain where to go
  await dm(1, '/werewolf');
  assert.match(take()[0].body.text, /เพิ่มบอทเข้ากลุ่ม/);
  await dm(1, '/start');
  assert.match(take()[0].body.text, /พิมพ์ \/werewolf/);

  // open a room
  await say(user(1), GROUP, '/werewolf@NikaWolfBot');
  let out = take();
  assert.equal(out.length, 1);
  const lobby = out[0].body;
  assert.equal(lobby.chat_id, '-1001');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(lobby.text)[1];
  assert.equal(lobby.reply_markup.inline_keyboard[0][0].url, 'https://t.me/NikaWolfBot?start=' + code, '▸ เข้าร่วม is a deep link');
  assert.equal(lobby.reply_markup.inline_keyboard[3][0].callback_data, 'start:' + code);   // row 1 = 🤖 +1 / −1 / level, row 2 = 🎲
  const msgId = nextMsg;
  assert.equal(store.get('wolf_games/' + code).msgId, msgId);
  assert.equal(store.get('wolf_chats/-1001').game, code);

  await say(user(2), GROUP, '/werewolf');
  out = take();
  assert.match(out[0].body.text, new RegExp('มีห้อง ' + code + ' อยู่แล้ว'), 'one open room per group');
  assert.equal(out[0].body.reply_to_message_id, msgId);

  // join 1..4, start too early
  for (let n = 1; n <= 4; n++) {
    await dm(n, '/start ' + code.toLowerCase());
    out = take();
    assert.match(out[0].body.text, new RegExp('เข้าห้อง ' + code + ' แล้ว · ที่นั่ง ' + n));
    assert.equal(out[1].method, 'editMessageText'); assert.equal(out[1].body.message_id, msgId, 'the same lobby message is edited');
    assert.match(out[1].body.text, new RegExp('👥 ' + n + '/10'));
  }
  assert.match(out[1].body.text, /Pond, Mint, Beam, Fah/);
  assert.match(out[0].body.text, /🏷 ชื่อในเกม: Fah\nเปลี่ยน\? พิมพ์ชื่อใหม่/, 'the join DM shows the name and how to change it');

  // a plain DM renames you (owner pick B): the lobby line follows, duplicates are refused, blanks ignored, kept for next time
  await dm(1, '  แนน   ไง ');
  out = take();
  assert.equal(out[0].body.text, '🏷 ชื่อในเกม: แนน ไง · จำไว้ให้เกมหน้าด้วย');
  assert.equal(out[1].method, 'editMessageText'); assert.match(out[1].body.text, /👥 4\/10 · แนน ไง, Mint, Beam, Fah/);
  assert.equal(store.get('wolf_tg/501').name, 'แนน ไง'); assert.equal(store.get('wolf_tg/501').game, code, 'merge keeps the room');
  await dm(2, 'แนน ไง'); out = take();
  assert.equal(out.length, 1); assert.match(out[0].body.text, /มีคนชื่อ แนน ไง ในห้องแล้ว/);
  assert.equal(store.get('wolf_games/' + code).players['502'].name, 'Mint');
  await dm(1, '   '); assert.equal(take().length, 0, 'blank text is ignored');
  await dm(8, 'โบว์'); assert.equal(take()[0].body.text, '🏷 ชื่อในเกม: โบว์ · ใช้ตอนเข้าห้องครั้งหน้า');
  await dm(1, '/whatever'); assert.equal(take().length, 0, 'an unknown command is not a name');
  await dm(2, '/start ' + code);
  assert.match(take()[0].body.text, /อยู่ในห้อง .* แล้ว/, 'joining twice is harmless');
  assert.equal(Object.keys(store.get('wolf_games/' + code).players).length, 4);
  await press(1, 'start:' + code);
  out = take();
  assert.equal(out[0].method, 'answerCallbackQuery'); assert.match(out[0].body.text, /อย่างน้อย 5 คน \(ตอนนี้ 4\)/);
  await dm(5, '/start ZZZZZZ');
  assert.match(take()[0].body.text, /ไม่พบห้อง/);

  await dm(5, '/start ' + code); await dm(6, '/start ' + code); take();
  assert.match(store.get('wolf_games/' + code).players['506'].name, /Nam/);

  // only the host starts
  await press(2, 'start:' + code);
  assert.match(take()[0].body.text, /เฉพาะหัวห้อง \(แนน ไง\)/, 'the host tag follows the rename');
  assert.equal(store.get('wolf_games/' + code).status, 'lobby');

  failDm.add('506');
  await press(1, 'start:' + code);
  out = take();
  const g = store.get('wolf_games/' + code), st = store.get('wolf_games/' + code + '/secret/state');
  assert.equal(g.status, 'night'); assert.equal(g.round, 1);
  assert.deepEqual(g.counts, W.defaultCounts(6));
  assert.ok(!('roles' in g), 'roles are not on the public game doc');
  const got = {}; Object.values(st.roles).forEach((r) => { got[r] = (got[r] || 0) + 1; });
  assert.deepEqual(got, { wolf: 2, seer: 1, guard: 1, villager: 2 });
  const edit = out.find((x) => x.method === 'editMessageText');
  assert.match(edit.body.text, /เกมเริ่ม .* 6 คน/); assert.match(edit.body.text, /🐺 2 · 🔮 1 · 🛡️ 1 · 👤 2/);
  const cards = out.filter((x) => x.method === 'sendMessage' && x.body.chat_id !== '-1001' && /🤫 อย่าบอกใคร/.test(x.body.text));   // Phase 2: night menus follow the cards
  assert.equal(cards.length, 6, 'one DM card per player');
  const wolves = Object.keys(st.roles).filter((id) => st.roles[id] === 'wolf');
  for (const c of cards) {
    const id = String(c.body.chat_id), role = st.roles[id];
    assert.ok(c.body.text.startsWith(B.ROLE_CARD[role]), id + ' gets the ' + role + ' card');
    for (const r of W.ROLES) if (r !== role) assert.ok(!c.body.text.includes(B.ROLE_CARD[r].split('\n')[0]), id + ' card names no other role');
    if (role === 'wolf') {
      const mate = g.players[wolves.find((w) => w !== id)].name;
      assert.ok(c.body.text.includes('🐺 เพื่อน: ' + mate), 'wolf sees the other wolf');
    } else assert.ok(!/เพื่อน/.test(c.body.text), 'non-wolves see no mates');
  }
  const warn = out.filter((x) => x.method === 'sendMessage' && x.body.chat_id === '-1001' && /ส่ง DM ไม่ถึง/.test(x.body.text));
  assert.equal(warn.length, 1); assert.match(warn[0].body.text, /ส่ง DM ไม่ถึง: Nam/, 'a failed DM is named in the group');
  failDm.clear();

  // mid-game a new name waits for the next room
  await dm(2, 'มิ้นท์'); assert.equal(take()[0].body.text, '🏷 ชื่อในเกม: มิ้นท์ · เกมนี้เริ่มแล้ว ใช้เกมหน้า');
  assert.equal(store.get('wolf_games/' + code).players['502'].name, 'Mint'); assert.equal(store.get('wolf_tg/502').name, 'มิ้นท์');

  // late join, a second /werewolf while playing, start twice
  await dm(7, '/start ' + code);
  assert.match(take()[0].body.text, /เริ่มเกมไปแล้ว/);
  await say(user(3), GROUP, '/werewolf'); assert.match(take()[0].body.text, /อยู่แล้ว/);
  await press(1, 'start:' + code); assert.match(take()[0].body.text, /เกมเริ่มไปแล้ว/);

  // a player of a live game cannot join another room
  const G2 = { id: -1002, type: 'group' };
  await say(user(7), G2, '/werewolf'); const code2 = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  assert.notEqual(code2, code);
  await dm(3, '/start ' + code2); assert.match(take()[0].body.text, new RegExp('อยู่ห้อง ' + code + ' อยู่'));

  // ✕ ends the game; the chat and players are free again
  await press(2, 'cancel:' + code); assert.match(take()[0].body.text, /เฉพาะหัวห้อง/);
  await press(1, 'cancel:' + code);
  out = take();
  assert.equal(store.get('wolf_games/' + code).status, 'cancelled');
  assert.match(out.find((x) => x.method === 'editMessageText').body.text, /ยกเลิกแล้ว/);   // Phase 3: ✕ mid-game edits the start
  assert.match(out.find((x) => x.method === 'sendMessage' && x.body.chat_id === '-1001').body.text, /✕ ยกเลิกเกม/);   // + a new line
  assert.equal(store.get('wolf_tg/503').game, null);
  assert.equal(store.get('wolf_tg/502').name, 'มิ้นท์', 'freeing a player keeps the name');
  await dm(3, '/start ' + code2); assert.match(take()[0].body.text, /เข้าห้อง .* ที่นั่ง 1/);
  await press(1, 'cancel:' + code); assert.match(take()[0].body.text, /ปิดแล้ว/);
  await say(user(1), GROUP, '/werewolf'); out = take(); assert.match(out[0].body.text, /ห้อง [A-Z0-9]{6}\n👥 0\/10/, 'a new room after ✕');
  const code3 = /ห้อง ([A-Z0-9]{6})/.exec(out[0].body.text)[1];
  await press(2, 'start:' + code3); assert.match(take()[0].body.text, /เฉพาะหัวห้อง \(แนน ไง\)/, 'a new room takes the stored host name');

  // full room: 10 seats, the 11th is refused and the join button goes away
  for (let n = 1; n <= 10; n++) await dm(n === 3 ? 11 : n, '/start ' + code2);
  out = take();
  assert.match(out.pop().body.text, /เต็มแล้ว/);
  assert.equal(store.get('wolf_games/' + code2).players['502'].name, 'มิ้นท์', 'the stored name is used at the next join');
  assert.equal(store.get('wolf_games/' + code2).players['508'].name, 'โบว์');
  assert.match(out.find((x) => x.method === 'sendMessage' && x.body.chat_id === '502').body.text, /ชื่อในเกม: มิ้นท์/);
  const last = out.filter((x) => x.method === 'editMessageText').pop().body;
  assert.match(last.text, /👥 10\/10/);
  assert.ok(!last.reply_markup.inline_keyboard[0].some((b) => b.url), 'no ▸ เข้าร่วม at 10/10');

  // nothing posted to a group ever carried a role
  assert.ok(toGroups.length >= 20, 'checked ' + toGroups.length + ' group texts');
  for (const t of toGroups) assert.ok(!ROLE_WORDS.test(t), 'group text leaks no role: ' + t);
  // bots and non-text are ignored
  await B.handle({ message: { from: { id: 9, is_bot: true }, chat: GROUP, text: '/werewolf' } }, deps());
  await B.handle({ message: { from: user(1), chat: GROUP, sticker: {} } }, deps());
  await B.handle({ callback_query: { id: 'x', from: user(1), data: 'nope' } }, deps());
  assert.ok(take().every((x) => x.method === 'answerCallbackQuery'));

  console.log('wolf-bot-check: OK (webhook guard, rules, lobby, deep-link join, names by DM, host start, 6 role DMs, no group leak, refusals, ✕, 10/10)');
})().catch((e) => { console.error(e); process.exit(1); });
