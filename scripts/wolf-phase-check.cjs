// 🐺 Werewolf Clock C1 (owner pick 2026-11-26, every 30 s) — functions/wolf-bot.js phase() + armClock on a fake Telegram, a tiny
// Firestore and a fake Cloud Tasks queue, no network. Proves: index.js exports wolfPhase behind X-Wolf-Task-Secret and gives the
// bot, the tick and the phase target the same deps with tasks; a phase start enqueues one task per 30 s + one at the deadline,
// once per phase (a vote press does not re-enqueue); a step edits the right message (🌙 line · ☀️ line keeps its 🗳 button ·
// ballot keeps its buttons) with the time left to 5 s; the one-minute warning rides the step once; the last task ends the phase
// on the second and arms the next one; a stale task does nothing; a vote press shows the real time left; an enqueue failure or
// no tasks dep leaves the game to wolfTick; no group text carries a role.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
assert.ok(/exports\.wolfPhase = onRequest\(\{ secrets: \['TELEGRAM_WOLF_TOKEN', 'TELEGRAM_WOLF_HOOK_SECRET'\]/.test(idx), 'wolfPhase has the two wolf secrets');
assert.ok(/req\.get\('X-Wolf-Task-Secret'\) !== want\) return res\.status\(403\)/.test(idx), 'wolfPhase refuses a task without the secret header');
assert.ok(/\.phase\(req\.body, wolfDeps\(\)\)/.test(idx) && /\.handle\(req\.body, wolfDeps\(\)\)/.test(idx) && /\.tick\(wolfDeps\(\)\)/.test(idx), 'bot, tick and phase share wolfDeps');
assert.ok(/tasks: wolfEnqueue/.test(idx) && /status === 409\) return/.test(idx), 'wolfEnqueue is the tasks dep and treats 409 as done');
assert.ok(/'X-Wolf-Task-Secret': process\.env\.TELEGRAM_WOLF_HOOK_SECRET/.test(idx), 'the task carries the hook secret');
assert.ok(/secrets: \['TELEGRAM_WOLF_TOKEN', 'TELEGRAM_WOLF_HOOK_SECRET'\]\n\}, async \(\) => \{\n    try \{\n        await require\('\.\/wolf-bot'\)\.tick/.test(idx), 'wolfTick gets the hook secret too (it arms the next phase)');
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));
assert.equal(B.STEP_SEC, 30);

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

// ---- fake Telegram + fake Cloud Tasks ---------------------------------------------------------------------------------------
let sent = [], nextMsg = 100;
const toGroups = [];
const tg = async (method, body) => {
  sent.push({ method, body: clone(body) });
  if (body && body.text && String(body.chat_id).startsWith('-')) toGroups.push(body.text);
  if (method === 'sendMessage') return { message_id: ++nextMsg };
  return true;
};
let queue = [], tasksFail = false;
const tasks = async (name, delaySec, body) => { if (tasksFail) throw new Error('tasks 403 queue missing'); queue.push({ name, delaySec, body: clone(body) }); };
let seed = 11;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const T0 = 1_800_000_000_000;
const deps = (now, withTasks = true) => ({ db, tg, botName: async () => 'NikaWolfBot', now, rng, tasks: withTasks ? tasks : undefined });
const GROUP = { id: -1001, type: 'supergroup', title: 'ทีม' };
const user = (n) => ({ id: 500 + n, is_bot: false, first_name: ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice'][n - 1] });
const say = (from, chat, text, now = T0) => B.handle({ message: { message_id: 1, from, chat, text } }, deps(now));
const dm = (n, text, now = T0) => say(user(n), { id: 500 + n, type: 'private' }, text, now);
const press = (n, data, now = T0) => B.handle({ callback_query: { id: 'q' + n, from: user(n), data } }, deps(now));
const take = () => { const s = sent; sent = []; return s; };
const takeQ = () => { const q = queue; queue = []; return q; };
const fire = (name, now, withTasks = true) => { const t = name; return B.phase(t.body, deps(now, withTasks)); };
const ROLE_WORDS = /คุณคือ|ผู้หยั่งรู้|บอดี้การ์ด|แม่มด|ชาวบ้าน|เพื่อน:/;
const edits = (out, id) => out.filter((x) => x.method === 'editMessageText' && x.body.message_id === id);
const group = (out) => out.filter((x) => x.body && x.body.chat_id === '-1001');

(async () => {
  // a 5-player room; ▸ เริ่ม = night 1 starts and arms the clock
  await say(user(1), GROUP, '/werewolf');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let n = 1; n <= 5; n++) await dm(n, '/start ' + code);
  take(); assert.equal(takeQ().length, 0, 'the lobby arms nothing');
  await press(1, 'start:' + code);
  let out = take(), q = takeQ();
  const g0 = store.get('wolf_games/' + code);
  assert.equal(g0.status, 'night'); assert.equal(g0.deadline, T0 + W.NIGHT_SEC * 1000);
  const nightMsg = group(out).find((x) => /🌙 คืนที่ 1 · ⏳ 1:30/.test(x.body.text));
  assert.ok(nightMsg, 'the 🌙 line as before');
  assert.ok(g0.phaseMsgId, 'the 🌙 message id is saved');
  assert.deepEqual(q.map((t) => [t.name, t.delaySec]), [['w-' + code + '-night-1-30', 30], ['w-' + code + '-night-1-60', 60], ['w-' + code + '-night-1-90', 90]], 'one task per 30 s + the deadline');
  assert.deepEqual(q[0].body, { code, key: 'night:1' });
  assert.equal(g0.clock, 'night:1');

  // a step edits the 🌙 line only; a repeat does the same; nothing else moves
  let res = await fire(q[0], T0 + 30_500);   // 1:00 left → the ⏳ edit + the one-minute DMs to the night actors who have not pressed
  out = take();
  assert.ok(res && res.step);
  const e1 = edits(out, g0.phaseMsgId); assert.equal(e1.length, 1);
  assert.equal(e1[0].body.text, '🌙 คืนที่ 1 · ⏳ 1:00\n💤 หลับตา · คนมีบทดู DM');
  const nightWarn = out.filter((x) => x.method === 'sendMessage' && /เหลือ ~1 นาที/.test(x.body.text));
  assert.equal(nightWarn.length, 3, 'the night ⏳ DM rides the step with ≤ 60 s left (🐺 🔮 🛡️)');
  assert.ok(nightWarn.every((x) => x.body.chat_id !== '-1001'), 'no group warning at night');
  assert.equal(out.length, 4, 'nothing else');
  assert.equal(takeQ().length, 0, 'a step arms nothing');
  res = await fire(q[1], T0 + 61_000); out = take();
  assert.equal(out.length, 1); assert.equal(out[0].body.text.split('\n')[0], '🌙 คืนที่ 1 · ⏳ 0:30');
  res = await fire(q[1], T0 + 62_000); out = take();
  assert.ok(!out.some((x) => /เหลือ ~1 นาที/.test(x.body.text)), 'the warning goes once');

  // the last task ends the night on the second: ☀️ line with its 🗳 button, day tasks armed
  res = await fire(q[2], T0 + 90_200); out = take(); q = takeQ();
  const g1 = store.get('wolf_games/' + code);
  assert.equal(g1.status, 'day'); assert.equal(g1.round, 1); assert.equal(g1.deadline, T0 + 90_200 + W.TALK_DEFAULT * 1000);
  const morning = group(out).find((x) => /☀️ เช้าวันที่ 1/.test(x.body.text));
  assert.match(morning.body.text, /คืนสงบ ไม่มีใครตาย\n👥 5 · 💬 คุย 3:00$/);
  assert.equal(morning.body.reply_markup.inline_keyboard[0][0].callback_data, 'talk:' + code + ':1');
  assert.equal(g1.dayLead, 'คืนสงบ ไม่มีใครตาย'); assert.ok(g1.phaseMsgId !== g0.phaseMsgId, 'the ☀️ message id replaces the 🌙 one');
  assert.deepEqual(q.map((t) => t.delaySec), [30, 60, 90, 120, 150, 180]); assert.equal(q[5].name, 'w-' + code + '-day-1-180'); assert.equal(g1.clock, 'day:1');

  // stale: a night task after the night is over does nothing
  res = await fire({ body: { code, key: 'night:1' } }, T0 + 95_000); assert.equal(res, null); assert.equal(take().length, 0);
  res = await fire({ body: { code: 'bad', key: 'day:1' } }, T0); assert.equal(res, null);

  // day steps keep the 🗳 button and count down; the group ⏳ once at ≤ 60 s
  const d0 = T0 + 90_200;
  res = await fire(q[1], d0 + 60_300); out = take();
  assert.equal(out.length, 1); assert.equal(out[0].body.message_id, g1.phaseMsgId);
  assert.match(out[0].body.text, /☀️ เช้าวันที่ 1 · คืนสงบ ไม่มีใครตาย\n👥 5 · 💬 คุย 2:00$/);
  assert.equal(out[0].body.reply_markup.inline_keyboard[0][0].text, '🗳 โหวตเลย (หัวห้อง)', 'the edit keeps the host button');
  res = await fire(q[4], d0 + 150_400); out = take();
  assert.equal(group(out).filter((x) => x.method === 'sendMessage' && /⏳ เหลือ ~1 นาที · แล้วโหวต/.test(x.body.text)).length, 1, 'the talk warning rides the 150 s step');
  assert.match(edits(out, g1.phaseMsgId)[0].body.text, /💬 คุย 0:30$/);
  res = await fire(q[4], d0 + 151_000); out = take();
  assert.equal(out.filter((x) => /เหลือ ~1 นาที/.test(x.body.text)).length, 0, 'once per phase');

  // the last day task opens the vote on the second; vote tasks 30 + 60
  res = await fire(q[5], d0 + 180_000); out = take(); q = takeQ();
  const g2 = store.get('wolf_games/' + code);
  assert.equal(g2.status, 'vote'); assert.ok(g2.voteMsgId); assert.equal(g2.deadline, d0 + 180_000 + W.VOTE_SEC * 1000);
  assert.match(group(out).find((x) => x.method === 'sendMessage').body.text, /🗳 โหวตลับ วันที่ 1 · ⏳ 1:00 · เปลี่ยนได้\n✅ 0\/5/);
  assert.deepEqual(q.map((t) => t.delaySec), [30, 60]); assert.equal(g2.clock, 'vote:1');

  // a vote press shows the real time left and arms nothing again
  const v0 = d0 + 180_000;
  const st2 = store.get('wolf_games/' + code + '/secret/state');
  const victim = Object.keys(st2.roles).find((id) => id !== '502' && st2.roles[id] !== 'wolf');   // a villager out keeps the game going
  const vName = store.get('wolf_games/' + code).players[victim].name;
  await press(2, 'v:' + code + ':1:' + victim, v0 + 7_000); out = take();
  const pressEdit = edits(out, g2.voteMsgId)[0];
  assert.match(pressEdit.body.text, /⏳ 0:55 · เปลี่ยนได้\n✅ 1\/5/); assert.equal(pressEdit.body.reply_markup.inline_keyboard.flat().length, 6);
  assert.equal(takeQ().length, 0, 'a press in an armed phase enqueues nothing');
  res = await fire(q[0], v0 + 30_100); out = take();
  assert.match(edits(out, g2.voteMsgId)[0].body.text, /⏳ 0:30 · เปลี่ยนได้\n✅ 1\/5/);
  assert.equal(edits(out, g2.voteMsgId)[0].body.reply_markup.inline_keyboard.flat().length, 6, 'the ballot keeps its buttons');
  assert.ok(!out.some((x) => /เหลือ ~1 นาที/.test(x.body.text)), 'no warning in the 1-minute vote');

  // the last vote task closes the vote on the second: 1 vote vs 0 → the villager is out, night 2 armed
  res = await fire(q[1], v0 + 60_000); out = take(); q = takeQ();
  const g3 = store.get('wolf_games/' + code);
  assert.equal(g3.status, 'night'); assert.equal(g3.round, 2); assert.equal(g3.clock, 'night:2');
  assert.match(group(out).find((x) => /ผลโหวต/.test(x.body.text)).body.text, new RegExp(vName + ' 1\\n👋 ' + vName + ' ออกจากหมู่บ้าน'));
  assert.deepEqual(q.map((t) => t.name), ['w-' + code + '-night-2-30', 'w-' + code + '-night-2-60', 'w-' + code + '-night-2-90']);

  // wolfTick afterwards has nothing to end (the task did), only the ≤ 60 s warning path
  const n2 = v0 + 60_000;
  assert.equal(await B.tick(deps(n2 + 20_000)), 0); take();

  // the enqueue fails → the phase still starts, nothing is armed, the tick ends it as before
  tasksFail = true;
  await B.tick(deps(n2 + 90_000)); out = take();
  const g4 = store.get('wolf_games/' + code);
  assert.equal(g4.status, 'day'); assert.equal(g4.round, 2); assert.equal(g4.clock, 'night:2', 'no clock for a phase whose enqueue failed');
  tasksFail = false;
  // a later run with tasks arms the still-running phase on the next pass (a vote press, here the host's 🗳)
  await press(1, 'talk:' + code + ':2', n2 + 100_000); take(); q = takeQ();
  assert.equal(store.get('wolf_games/' + code).clock, 'vote:2'); assert.deepEqual(q.map((t) => t.delaySec), [30, 60]);
  // without a tasks dep at all nothing breaks
  await B.handle({ callback_query: { id: 'qq', from: user(2), data: 'v:' + code + ':2:skip' } }, deps(n2 + 101_000, false)); take();
  assert.equal(queue.length, 0);

  for (const t of toGroups) assert.ok(!ROLE_WORDS.test(t), 'group text leaks no role: ' + t);
  console.log('wolf-phase-check: OK (wolfPhase guard, shared deps, tasks per 30 s + deadline once per phase, 🌙/☀️/🗳 edits keep buttons, warning once, phase ends on the second, stale ignored, press shows time left, enqueue failure → tick)');
})().catch((e) => { console.error(e); process.exit(1); });
