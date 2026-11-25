// 🐺 Werewolf Phase 2 — whole Telegram games through functions/wolf-bot.js on a fake Telegram API + a tiny in-memory Firestore
// (no network). Each game: /werewolf → 5–10 joins → ▸ เริ่ม → nights by DM buttons (🐺 / 🔮 / 🛡️, then 🧪 once the wolves have
// chosen) → morning → talk (the host's 🗳 โหวตเลย, or the clock) → secret vote with group buttons → … → the end. Some phases are
// left to time out so tick() (wolfTick) moves them. Proves: every game ends with the winner wolf-rules.js says; the end text is
// the ONLY group text that names roles (owner pick Q4); vote results are counts only, never who voted whom (Q5); the dead are
// asked to keep quiet once (Q8); the 🔮 gets an answer that matches the truth; the 🧪 sees who was bitten; stale-round, dead,
// outsider, self and double presses are refused; a phase where everyone pressed moves on without the clock; the chat and the
// players are free afterwards; index.js schedules wolfTick every minute with the wolf token only; transactions read first.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const tickSrc = idx.slice(idx.indexOf('exports.wolfTick'), idx.indexOf('exports.askNika'));
assert.ok(/schedule: 'every 1 minutes'/.test(tickSrc) && /secrets: \['TELEGRAM_WOLF_TOKEN'\]/.test(tickSrc) && /require\('\.\/wolf-bot'\)\.tick\(/.test(tickSrc), 'wolfTick: every minute, wolf token only, calls tick()');
const B = require(path.join(root, 'functions', 'wolf-bot.js'));
const W = require(path.join(root, 'functions', 'wolf-rules.js'));

// ---- tiny Firestore (with where('deadline', '<=', n) for tick) -------------------------------------------------------------
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

// ---- fake Telegram -----------------------------------------------------------------------------------------------------
let sent = [], nextMsg = 100;
let groupTexts = [];   // [{ text, over }] — over = sent after the game's status became 'over'
const tg = async (method, body) => {
  const rec = { method, body: clone(body) };
  sent.push(rec);
  if (body && body.text && String(body.chat_id).startsWith('-')) groupTexts.push(body.text);
  if (method === 'sendMessage') { rec.id = ++nextMsg; return { message_id: rec.id }; }
  return true;
};
let NOW = 1_800_000_000_000, seed = 1;
const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const deps = () => ({ db, tg, botName: async () => 'NikaWolfBot', now: NOW, rng });
const GROUP = { id: -1001, type: 'supergroup', title: 'ทีม' };
const NAMES = ['Pond', 'Mint', 'Beam', 'Fah', 'Ton', 'Nam', 'Ice', 'Gun', 'Jay', 'Kim'];
const user = (n) => ({ id: 700 + n, is_bot: false, first_name: NAMES[n - 1] });
const say = (from, chat, text) => B.handle({ message: { message_id: 1, from, chat, text } }, deps());
let qid = 0;
const press = (uid, data, msg) => B.handle({ callback_query: { id: 'q' + (++qid), from: { id: Number(uid), first_name: 'x' }, data, message: msg ? { chat: { id: msg.chat }, message_id: msg.id } : undefined } }, deps());
const take = () => { const s = sent; sent = []; return s; };
const toasts = (out) => out.filter((x) => x.method === 'answerCallbackQuery').map((x) => x.body.text);
const kb = (rec) => (rec.body.reply_markup ? rec.body.reply_markup.inline_keyboard.flat() : []);
const pick = (a) => a[Math.floor(rng() * a.length)];
const ROLE_TEXT = /คุณคือ|ผู้หยั่งรู้|บอดี้การ์ด|แม่มด|ชาวบ้าน|เพื่อน:|🔮|🛡️|🧪|👤/;

const stats = { games: 0, wolf: 0, village: 0, ticks: 0, early: 0, witchSaw: 0, seer: 0, quietAsks: 0, refused: 0 };

async function game(n, lazy) {
  store = new Map(); groupTexts = []; sent = [];
  await say(user(1), GROUP, '/werewolf');
  const code = /ห้อง ([A-Z0-9]{6})/.exec(take()[0].body.text)[1];
  for (let i = 1; i <= n; i++) await say(user(i), { id: 700 + i, type: 'private' }, '/start ' + code);
  take();
  await press(701, 'start:' + code);
  const G = () => store.get('wolf_games/' + code), S = () => store.get('wolf_games/' + code + '/secret/state');
  let out = take(), overAt = -1;
  assert.equal(G().status, 'night'); assert.ok(G().deadline > NOW);
  assert.ok(out.some((x) => x.method === 'sendMessage' && x.body.chat_id === '-1001' && /🌙 คืนที่ 1/.test(x.body.text)), 'night 1 announced');
  for (let step = 0; step < 200 && G().status !== 'over'; step++) {
    const g = G(), st = S();
    if (g.status === 'night') {
      const r = g.round;
      // stale press from a previous round is refused
      if (r > 1) { await press(Object.keys(st.alive).find((id) => st.alive[id]), 'n:' + code + ':' + (r - 1) + ':guard:' + Object.keys(st.alive)[0]); const t = toasts(take()); assert.match(t[0], /หมดเวลา/); stats.refused++; }
      const menus = out.filter((x) => x.method === 'sendMessage' && kb(x).some((b) => String(b.callback_data).startsWith('n:' + code + ':' + r + ':')));
      const skipSome = lazy && rng() < 0.3;
      for (const m of menus) {
        const who = String(m.body.chat_id), role = st.roles[who];
        if (skipSome && role !== 'wolf' && rng() < 0.5) continue;   // leave this one to the clock
        const btn = pick(kb(m).filter((b) => !/⏭/.test(b.text)));
        await press(who, btn.callback_data, { chat: who, id: m.id });
        let o = take();
        if (role === 'seer') {
          const target = btn.callback_data.split(':')[4], e = o.find((x) => x.method === 'editMessageText' && String(x.body.chat_id) === who);
          assert.equal(/= 🐺 หมาป่า/.test(e.body.text), st.roles[target] === 'wolf', '🔮 answer is the truth'); stats.seer++;
          await press(who, btn.callback_data, { chat: who, id: m.id }); assert.match(toasts(take())[0], /ไปแล้ว|หมดเวลา/); stats.refused++;
        }
        out.push(...o);
        // the witch menu arrives after the last wolf
        const wm = o.find((x) => x.method === 'sendMessage' && /^🧪 คืนที่/.test(x.body.text || ''));
        if (wm) {
          const s2 = S(); if (s2 && s2.picks) assert.ok(s2.picks.bite ? wm.body.text.includes('หมาป่ากัด ' + G().players[s2.picks.bite].name) : /ไม่มีใครถูกกัด/.test(wm.body.text), '🧪 sees the bite');
          stats.witchSaw++;
          if (!(skipSome && rng() < 0.5)) {
            const wbtn = pick(kb(wm));
            await press(String(wm.body.chat_id), wbtn.callback_data, { chat: String(wm.body.chat_id), id: wm.id });
            const o2 = take(); out.push(...o2);
            if (G().status === 'night' && S().picks && !S().picks.witchDone) { await press(String(wm.body.chat_id), 'n:' + code + ':' + r + ':done:0', { chat: String(wm.body.chat_id), id: wm.id }); out.push(...take()); }
          }
        }
        if (G().status !== 'night' || G().round !== r) break;
      }
      if (G().status === 'night' && G().round === r) { NOW = G().deadline + 1; assert.ok(await B.tick(deps()) >= 1); stats.ticks++; out.push(...take()); }
      else stats.early++;
      // the morning (or the end)
      const morning = out.filter((x) => x.method === 'sendMessage' && x.body.chat_id === '-1001').pop();
      if (G().status === 'day') {
        assert.match(morning.body.text, /☀️ เช้าวันที่ \d+/);
        if (/ตาย/.test(morning.body.text) && !/คืนสงบ/.test(morning.body.text)) { assert.match(morning.body.text, /ขอเงียบ/); stats.quietAsks++; }
      }
      out = [];
      continue;
    }
    if (g.status === 'day') {
      if (!lazy || rng() < 0.5) {
        await press('709', 'talk:' + code + ':' + g.round); if (!g.players['709'] || g.host !== '709') { assert.match(toasts(take())[0] || '', /เฉพาะหัวห้อง/); stats.refused++; }
        await press(g.host, 'talk:' + code + ':' + g.round);
      } else { NOW = g.deadline + 1; await B.tick(deps()); stats.ticks++; }
      out = take();
      assert.equal(G().status, 'vote');
      continue;
    }
    if (g.status === 'vote') {
      const vm = out.find((x) => x.method === 'sendMessage' && /^🗳 โหวตลับ วันที่/.test(x.body.text || ''));
      assert.equal(G().voteMsgId, vm.id, 'the vote message id is kept');
      const live = Object.keys(st.alive).filter((id) => st.alive[id]), dead = Object.keys(st.alive).filter((id) => !st.alive[id]);
      if (dead.length) { await press(dead[0], kb(vm)[0].callback_data); assert.match(toasts(take())[0], /คนตายโหวตไม่ได้/); stats.refused++; }
      await press('999', kb(vm)[0].callback_data); assert.match(toasts(take())[0], /ไม่ได้อยู่ในเกม/); stats.refused++;
      const r = g.round;
      const voters = lazy && rng() < 0.4 ? live.slice(0, Math.max(1, live.length - 2)) : live;
      for (const v of voters) {
        const opts = kb(vm).filter((b) => !b.callback_data.endsWith(':' + v));
        await press(v, pick(opts).callback_data);
        const o = take(); out.push(...o);
        const e = o.find((x) => x.method === 'editMessageText' && x.body.message_id === vm.id && /✅ \d/.test(x.body.text));
        if (e) assert.ok(!NAMES.some((nme) => e.body.text.split('\n')[1].includes(nme)), 'the running count names nobody');
        if (G().status !== 'vote' || G().round !== r) break;
      }
      if (G().status === 'vote' && G().round === r) { NOW = G().deadline + 1; await B.tick(deps()); stats.ticks++; out.push(...take()); }
      const res = out.filter((x) => x.method === 'sendMessage' && x.body.chat_id === '-1001' && /ผลโหวต/.test(x.body.text)).pop();
      assert.ok(res, 'a vote result was posted');
      assert.ok(!/←/.test(res.body.text), 'counts only, no voter names (Q5)');
      if (/ออกจากหมู่บ้าน/.test(res.body.text)) assert.match(res.body.text, /ขอเงียบ/);
      out = out.filter((x) => !(x.method === 'sendMessage' && /ผลโหวต/.test(x.body.text || '')));
      continue;
    }
    throw new Error('unexpected status ' + g.status);
  }
  const g = G(), st = S();
  assert.equal(g.status, 'over', 'game ' + code + ' ended');
  assert.equal(g.winner, W.winner(st), 'the winner is the rules engine\'s');
  assert.equal(g.deadline, null);
  stats[g.winner]++; stats.games++;
  // only the final text names roles, and it names all of them (the start message shows the deck counts, which are public)
  const last = groupTexts[groupTexts.length - 1];
  assert.match(last, /หมาป่าชนะ|ฝั่งชาวบ้านชนะ/);
  for (const [id, p] of Object.entries(g.players)) assert.ok(last.includes(W.EMOJI[st.roles[id]] + ' ' + p.name), 'the end shows ' + p.name + '\'s role');
  groupTexts.slice(0, -1).filter((t) => !t.startsWith('🐺 เกมเริ่ม')).forEach((t) => assert.ok(!ROLE_TEXT.test(t), 'no role in a group text before the end (Q4): ' + t));
  assert.equal(store.get('wolf_chats/-1001').game, null, 'the chat is free');
  Object.keys(g.players).forEach((id) => assert.equal(store.get('wolf_tg/' + id).game, null, 'players are free'));
  // a press after the end is refused, a new room opens
  await press(g.host, 'talk:' + code + ':' + g.round); assert.match(toasts(take())[0], /เลยช่วงคุย/);
  await say(user(1), GROUP, '/werewolf'); assert.match(take()[0].body.text, /ห้อง [A-Z0-9]{6}\n👥 0\/10/);
}

(async () => {
  for (let i = 0; i < 90; i++) { seed = i * 7919 + 3; await game(5 + (i % 6), i % 3 !== 0); }
  assert.ok(stats.wolf > 5 && stats.village > 5, 'both sides win sometimes ' + JSON.stringify(stats));
  assert.ok(stats.ticks > 20 && stats.early > 20 && stats.witchSaw > 10 && stats.seer > 20 && stats.quietAsks > 20, JSON.stringify(stats));
  // tick with nothing due moves nothing
  NOW += 1; assert.equal(await B.tick(deps()), 0);
  console.log('wolf-game-check: OK ' + JSON.stringify(stats));
})().catch((e) => { console.error(e); process.exit(1); });
