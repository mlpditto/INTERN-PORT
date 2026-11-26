// 🐺 Werewolf bot players (owner picks 2026-11-26: 1A 🤖 +1/−1 + level chip · 2B one talk line in ☀️ · 3 bots act at once · 5 ≥ 1
// human) — functions/wolf-bot.js with functions/wolf-ai.js on a fake Telegram + tiny Firestore, no network. Proves: the two
// wolf-ai.js copies are identical and the brain knows g.bots; the host adds / removes bots and cycles 🌆 🌙 🌕 (others refused,
// ≤ 10 seats, solo names in order, lobby line + buttons); ▸ เริ่ม counts bots but needs a human; nothing is ever sent to a bot
// id; at 🌙 every bot with a night role has picked (🔮 checks remembered, a bot 🧪 decided after the bite), a human 🐺 sees a bot
// mate's wish; the ☀️ line carries the bots' talk (or none); at 🗳 every living bot has a ballot and the message says so, bot
// buttons carry 🤖; the end lists 🤖 and 🤥; bots get no wolf_tg doc; 24 whole games of 1 human + 4–9 bots on the clock alone
// all end with the engine's winner and no role word in a group text.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
assert.equal(fs.readFileSync(path.join(root, 'functions', 'wolf-ai.js'), 'utf8'), fs.readFileSync(path.join(root, 'public', 'wolf-ai.js'), 'utf8'), 'functions/wolf-ai.js is a byte copy of public/wolf-ai.js');
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));
const AI = require(path.join(root, 'functions', 'wolf-ai.js'));
assert.deepEqual(B.BOT_NAMES.slice(0, 3), ['ต้น', 'ใบ', 'ฟ้า']);
assert.equal(B.LEVELS[2], '🌙 เที่ยงคืน');

// ---- tiny Firestore ------------------------------------------------------------------------------------------------------
let store = new Map();
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

// ---- fake Telegram -------------------------------------------------------------------------------------------------------
let sent = [], nextMsg = 100, all = [];
const toGroups = [];
const tg = async (method, body) => {
  sent.push({ method, body: clone(body) }); all.push({ method, body: clone(body) });
  if (body && body.text && String(body.chat_id).startsWith('-')) toGroups.push(body.text);
  if (method === 'sendMessage') return { message_id: ++nextMsg };
  return true;
};
let seed = 23;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const T0 = 1_800_000_000_000;
const deps = (now) => ({ db, tg, botName: async () => 'NikaWolfBot', now, rng });
const GROUP = { id: -1001, type: 'supergroup', title: 'ทีม' };
const user = (n) => ({ id: 500 + n, is_bot: false, first_name: ['Pond', 'Mint', 'Beam', 'Fah', 'Ton'][n - 1] });
const say = (from, chat, text, now = T0) => B.handle({ message: { message_id: 1, from, chat, text } }, deps(now));
const dm = (n, text, now = T0) => say(user(n), { id: 500 + n, type: 'private' }, text, now);
const press = (n, data, now = T0) => B.handle({ callback_query: { id: 'q' + n, from: user(n), data } }, deps(now));
const take = () => { const s = sent; sent = []; return s; };
const ROLE_WORDS = /คุณคือ|ผู้หยั่งรู้|บอดี้การ์ด|แม่มด|ชาวบ้าน|เพื่อน:/;
const G = (code) => store.get('wolf_games/' + code), S = (code) => store.get('wolf_games/' + code + '/secret/state');
const lastEdit = (out) => out.filter((x) => x.method === 'editMessageText').pop();
const alert = (out) => out.find((x) => x.method === 'answerCallbackQuery').body.text;

/* Run one room to the end on the clock alone (no human ever presses after the start). */
async function runOut(code, from) {
  let now = from;
  for (let i = 0; i < 80; i++) {
    const g = G(code);
    if (!g || g.status === 'over' || g.status === 'cancelled') return g;
    now = g.deadline + 1000;
    await B.tick(deps(now));
  }
  throw new Error('room ' + code + ' never ended');
}

(async () => {
  // ---- lobby: 3 humans, the host adds bots -----------------------------------------------------------------------------
  await say(user(1), GROUP, '/werewolf');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  const lobbyMsg = nextMsg;
  for (let n = 1; n <= 3; n++) await dm(n, '/start ' + code);
  let out = take();
  let lob = lastEdit(out).body;
  assert.match(lob.text, /👥 3\/10 · Pond, Mint, Beam\n⏳ อีก 2 คน · กติกา \/rules · หรือเติม 🤖/);
  assert.deepEqual(lob.reply_markup.inline_keyboard[1].map((b) => b.text), ['🤖 +1', '🤖 −1', '🌙 เที่ยงคืน']);
  assert.equal(lob.reply_markup.inline_keyboard[1][0].callback_data, 'bot:+:' + code);
  assert.equal(lob.reply_markup.inline_keyboard[1][2].callback_data, 'lvl:' + code);

  await press(2, 'bot:+:' + code); out = take();
  assert.match(alert(out), /เฉพาะหัวห้อง \(Pond\)/, 'only the host adds bots'); assert.ok(!lastEdit(out));
  await press(1, 'bot:-:' + code); out = take(); assert.match(alert(out), /ยังไม่มีบอท/);
  await press(1, 'bot:+:' + code); await press(1, 'bot:+:' + code); out = take();
  lob = lastEdit(out).body;
  assert.equal(lob.message_id, lobbyMsg, 'the same lobby message');
  assert.match(lob.text, /👥 3\/10 · Pond, Mint, Beam\n🤖 2 · ต้น ใบ · 🌙 เที่ยงคืน\n✅ ครบแล้ว หัวห้องกด ▸ เริ่ม/);
  assert.deepEqual(Object.keys(G(code).players).sort(), ['501', '502', '503', 'bot1', 'bot2']);
  assert.equal(G(code).players.bot2.seat, 5);
  // level cycles 🌙 → 🌕 → 🌆 → 🌙
  await press(1, 'lvl:' + code); assert.match(lastEdit(take()).body.text, /🌕 คืนเดือนเพ็ญ/); assert.equal(G(code).level, 3);
  await press(1, 'lvl:' + code); assert.match(lastEdit(take()).body.text, /🌆 หัวค่ำ/);
  await press(1, 'lvl:' + code); assert.match(lastEdit(take()).body.text, /🌙 เที่ยงคืน/); assert.equal(G(code).level, 2);
  // −1 removes the last bot; +1 brings the next free name back
  await press(1, 'bot:-:' + code); assert.match(lastEdit(take()).body.text, /🤖 1 · ต้น · /);
  await press(1, 'bot:+:' + code); assert.match(lastEdit(take()).body.text, /🤖 2 · ต้น ใบ · /);
  // 10 seats in all: 3 humans + 7 bots, the 8th bot is refused and ▸ เข้าร่วม goes away
  for (let i = 0; i < 5; i++) await press(1, 'bot:+:' + code);
  out = take(); lob = lastEdit(out).body;
  assert.match(lob.text, /🤖 7 · ต้น ใบ ฟ้า นนท์ มุก ภู แพร · /);
  assert.ok(!lob.reply_markup.inline_keyboard[0].some((b) => b.url), 'no ▸ เข้าร่วม at 10 seats');
  await press(1, 'bot:+:' + code); assert.match(alert(take()), /เต็มแล้ว/);
  await dm(4, '/start ' + code); assert.match(take()[0].body.text, /เต็มแล้ว/, 'a human cannot join a full table either');
  for (let i = 0; i < 3; i++) await press(1, 'bot:-:' + code);   // back to 3 + 4 = 7 seats: 🐺 2 · 🔮 · 🛡️ · 🧪 · 👤 2
  take();
  assert.deepEqual(Object.keys(G(code).players).filter((id) => /^bot/.test(id)).sort(), ['bot1', 'bot2', 'bot3', 'bot4']);

  // a room of bots only cannot start
  const G2 = { id: -1002, type: 'group' };
  await say(user(5), G2, '/werewolf'); const code2 = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let i = 0; i < 5; i++) await press(5, 'bot:+:' + code2);
  take();
  await press(5, 'start:' + code2); assert.match(alert(take()), /ต้องมีคนจริงอย่างน้อย 1 คน/);
  await press(5, 'cancel:' + code2); take();

  // ---- start: 3 humans + 4 bots ------------------------------------------------------------------------------------------
  await press(1, 'start:' + code); out = take();
  const g1 = G(code), st1 = S(code);
  assert.equal(g1.status, 'night'); assert.deepEqual(g1.counts, W.defaultCounts(7));
  const cards = out.filter((x) => x.method === 'sendMessage' && /🤫 อย่าบอกใคร/.test(x.body.text));
  assert.deepEqual(cards.map((c) => c.body.chat_id).sort(), ['501', '502', '503'], 'role cards go to the humans only');
  assert.ok(st1.ai && st1.ai.checks, 'the bots have a memory');
  const roleOf = (id) => st1.roles[id], isBot = (id) => /^bot/.test(id);
  const p = st1.picks;
  for (const id of Object.keys(st1.roles).filter(isBot)) {
    if (roleOf(id) === 'wolf') assert.ok(p.wolf[id] && roleOf(p.wolf[id]) !== 'wolf', id + ' 🐺 picked a non-wolf');
    if (roleOf(id) === 'seer') { assert.ok(p.seer && p.seer !== 'none'); assert.equal(st1.ai.checks[id][p.seer], roleOf(p.seer) === 'wolf', 'the bot 🔮 remembers a true check'); }
    if (roleOf(id) === 'guard') assert.ok(p.guard && p.guard !== 'none');
  }
  const wolves = Object.keys(st1.roles).filter((id) => roleOf(id) === 'wolf');
  const witch = Object.keys(st1.roles).find((id) => roleOf(id) === 'witch');
  if (wolves.every(isBot)) {
    assert.ok(p.bite, 'all wolves are bots: the bite is fixed at once');
    if (isBot(witch)) assert.equal(p.witchDone, true, 'a bot 🧪 decided after the bite');
    else assert.ok(out.some((x) => x.body.chat_id === witch && /🧪 คืนที่ 1 · 🐺 หมาป่ากัด/.test(x.body.text)), 'a human 🧪 got her menu at once');
  } else if (wolves.some(isBot)) {
    const human = wolves.find((id) => !isBot(id)), ask = out.find((x) => x.body.chat_id === human && /คืนนี้กัดใคร/.test(x.body.text));
    assert.match(ask.body.text, / 🤖 อยากกัด /, 'a human 🐺 sees the bot mate\'s wish');
  }
  const asked = out.filter((x) => x.method === 'sendMessage' && /คืนนี้/.test(x.body.text)).map((x) => x.body.chat_id);
  assert.ok(asked.every((id) => !isBot(id)), 'night menus go to humans only');

  // ---- night runs out → ☀️ with the bots' line, 🗳 with their ballots ------------------------------------------------------
  await B.tick(deps(g1.deadline + 1000)); out = take();
  const g2 = G(code);
  assert.ok(['day', 'over'].includes(g2.status));
  if (g2.status === 'day') {
    const morning = out.find((x) => x.body.chat_id === '-1001' && /☀️ เช้าวันที่ 1/.test(x.body.text));
    assert.equal(typeof g2.botSay, 'string');
    if (g2.botSay) { assert.ok(g2.botSay.startsWith('🤖 ')); assert.ok(morning.body.text.includes('\n' + g2.botSay + '\n'), 'the talk line sits in the ☀️ message'); }
    assert.match(morning.body.text, /\n👥 \d · 💬 คุย 3:00$/);
    await press(1, 'talk:' + code + ':1'); out = take();
    const g3 = G(code), st3 = S(code);
    assert.equal(g3.status, 'vote');
    const liveBots = Object.keys(st3.alive).filter((id) => isBot(id) && st3.alive[id]);
    for (const b of liveBots) assert.ok(b in st3.ballot, b + ' has a ballot');
    assert.equal(st3.ai.votes.length, liveBots.length);
    const ballot = out.find((x) => x.method === 'sendMessage' && x.body.chat_id === '-1001');
    assert.match(ballot.body.text, new RegExp('✅ ' + liveBots.length + '/' + Object.values(st3.alive).filter(Boolean).length + ' · 🤖 ลงแล้ว'));
    const btns = ballot.body.reply_markup.inline_keyboard.flat();
    for (const b of liveBots) assert.ok(btns.some((x) => x.callback_data.endsWith(':' + b) && / 🤖$/.test(x.text)), 'a bot button carries 🤖');
    // a human may vote a bot; a bot's ballot stands until the close
    await press(2, 'v:' + code + ':1:' + liveBots[0]); out = take();
    assert.match(out.find((x) => x.method === 'answerCallbackQuery').body.text, /โหวต .* 🤖/);
  }
  const end = await runOut(code, G(code).deadline || T0);
  assert.equal(end.status, 'over');
  const stE = S(code);
  assert.equal(end.winner, W.winner(stE));
  const endTxt = toGroups[toGroups.length - 1];
  assert.match(endTxt, /เล่นอีก พิมพ์ \/werewolf$/);
  for (const id of Object.keys(end.players).filter(isBot)) assert.ok(endTxt.includes(' ' + end.players[id].name + ' 🤖'), id + ' listed with 🤖');
  if (stE.ai.claims.some((c) => c.fake)) assert.ok(/🤥/.test(endTxt), 'a faking bot is shown 🤥');
  assert.ok(![...store.keys()].some((k) => /^wolf_tg\/bot/.test(k)), 'bots get no wolf_tg doc');
  assert.equal(store.get('wolf_tg/501').game, null, 'humans are freed');

  // ---- 24 games: 1 human + 4..9 bots, the clock alone --------------------------------------------------------------------
  const tally = { wolf: 0, village: 0 };
  take();
  for (let i = 0; i < 24; i++) {
    const nb = 4 + (i % 6), Gi = { id: -2000 - i, type: 'group' };
    await say(user(1), Gi, '/werewolf'); const c = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
    await dm(1, '/start ' + c);
    if (i % 3 === 0) await press(1, 'lvl:' + c);
    if (i % 3 === 1) { await press(1, 'lvl:' + c); await press(1, 'lvl:' + c); }
    for (let k = 0; k < nb; k++) await press(1, 'bot:+:' + c);
    take();
    await press(1, 'start:' + c); take();
    const e = await runOut(c, T0); take();
    assert.equal(e.status, 'over'); assert.equal(e.winner, W.winner(S(c)));
    tally[e.winner]++;
  }
  assert.ok(tally.wolf + tally.village === 24 && tally.wolf > 0 && tally.village > 0, 'both sides win sometimes: ' + JSON.stringify(tally));

  assert.ok(!all.some((x) => x.body && /^bot\d$/.test(String(x.body.chat_id))), 'nothing was ever sent to a bot id');
  assert.ok(toGroups.length > 100);
  for (const t of toGroups) if (!/เล่นอีก พิมพ์ \/werewolf$/.test(t)) assert.ok(!ROLE_WORDS.test(t), 'group text leaks no role before the end: ' + t);   // the end names every role by design
  console.log('wolf-botplayers-check: OK (lobby 🤖 +1/−1 + level, host only, 10 seats, start needs a human, bots pick at 🌙, ☀️ talk line, 🗳 ballots + 🤖 buttons, end 🤖/🤥, no wolf_tg, 25 games ' + JSON.stringify(tally) + ')');
})().catch((e) => { console.error(e); process.exit(1); });
