// 🐺 Werewolf Phase 1 + 2 (2026-11-23/24) — the Telegram bot. Phase 1: /werewolf in a group opens a room, ▸ เข้าร่วม is a deep
// link t.me/<bot>?start=<code> (so everyone has pressed Start and the bot can DM them), the host taps ▸ เริ่ม at 5–10 players
// and each player gets their role card by DM. Phase 2: the whole game — 🌙 night menus by DM (🐺 bite · 🔮 look · 🛡️ guard ·
// 🧪 heal / poison once the wolves have chosen) → ☀️ morning in the group → 💬 talk → 🗳 a secret vote with buttons in the group
// → … → the end, which shows every role. A phase ends early when everyone has pressed, else at its deadline: tick() (wolfTick,
// every minute) moves every room whose deadline has passed.
// Owner picks (docs/WEREWOLF-PLAN.md §8): anyone with Telegram, no app account (Q1) · a new bot (Q2) · 5 roles (Q3) · the dead
// are NOT revealed until the end (Q4) · the vote result is counts only, no names (Q5) · a 1-minute clock (Q6) · any group (Q7)
// · the dead are asked to keep quiet, nothing is deleted (Q8).
// Phase 3 (2026-11-25, mockups/werewolf-p3.html): /rules = one plain message (R1) · ⏳ "เหลือ ~1 นาที" once per phase: a group line
// in the talk, a DM to each night actor who has not pressed, nothing in the 1-minute vote (W1) · a living player who misses 2
// of their phases in a row (a night with buttons, or a vote) gets one reminder DM, the group is told nothing, no kick (D1) ·
// ✕ mid-game posts a new group line, closes the vote buttons and frees the chat + players.
// handle(update, deps) / tick(deps): deps = { db, tg(method, body), botName(), now, rng }. Roles live only in
// wolf_games/{code}/secret/state and in each player's own DM — never in a group text before the game is over.
// Messages are plain text (no parse_mode), so a player's name can never inject markup.
'use strict';
const W = require('./wolf-rules');

const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROLE_CARD = {
  wolf: '🐺 คุณคือ หมาป่า\nกลางคืนเลือกกัด 1 คนร่วมกับเพื่อนหมาป่า',
  seer: '🔮 คุณคือ ผู้หยั่งรู้\nกลางคืนส่อง 1 คน ว่าเป็น 🐺 ไหม',
  guard: '🛡️ คุณคือ บอดี้การ์ด\nกลางคืนคุ้มกัน 1 คน (ห้ามคนเดิม 2 คืนติด)',
  witch: '🧪 คุณคือ แม่มด\nมี 💚 ชุบ 1 + ☠️ พิษ 1 ใช้ได้ทั้งเกม',
  villager: '👤 คุณคือ ชาวบ้าน\nกลางวันช่วยกันหา 🐺 แล้วโหวตออก',
};
const LIVE = ['night', 'day', 'vote'];
const QUIET = ' · ขอเงียบในกลุ่มจนจบเกมนะ 🤐';   // owner pick Q8: ask once, delete nothing
const WARN_SEC = 60;   // ⏳ the warning goes out at the first tick with ≤ 60 s left (W1)
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
const RULES = [   // owner pick R1: a line per role + the flow + the win rule, plain text (~450 chars)
  '🐺 มนุษย์หมาป่า · กติกา',
  W.MIN_PLAYERS + '–' + W.MAX_PLAYERS + ' คน · บทลับส่งทาง DM',
  '🐺 หมาป่า กัด 1 คน/คืน · เห็นเพื่อนหมาป่า',
  '🔮 ผู้หยั่งรู้ ส่อง 1 คน ว่าเป็น 🐺 ไหม',
  '🛡️ บอดี้การ์ด คุ้มกัน 1 คน · ห้ามคนเดิม 2 คืนติด',
  '🧪 แม่มด 💚 ชุบ 1 + ☠️ พิษ 1 ทั้งเกม · 7 คนขึ้นไป',
  '👤 ชาวบ้าน ช่วยกันหา 🐺',
  '🌙 คืน ' + mmss(W.NIGHT_SEC) + ' → ☀️ เช้า บอกใครตาย (ไม่บอกบท) → 💬 คุย ' + mmss(W.TALK_DEFAULT) + ' → 🗳 โหวตลับ ' + mmss(W.VOTE_SEC) + ' · เสมอ = ไม่มีใครออก',
  '🏆 🐺 หมด = ชาวบ้านชนะ · 🐺 ≥ คนที่เหลือ = 🐺 ชนะ',
  '💀 ตายแล้วขอเงียบในกลุ่ม · เริ่ม /werewolf',
].join('\n');
const REMIND = (code) => '💤 ไม่ได้กด 2 รอบติดแล้ว · ยังเล่นอยู่ไหม?\nกดในข้อความถัดไปได้เลย · ห้อง ' + code;   // owner pick D1

const nameOf = (u) => (((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.username || 'ผู้เล่น').slice(0, 24);
const seated = (g) => Object.entries(g.players || {}).sort((a, b) => a[1].seat - b[1].seat);
const isGroup = (chat) => chat && (chat.type === 'group' || chat.type === 'supergroup');
const rows2 = (btns) => { const r = []; for (let i = 0; i < btns.length; i += 2) r.push(btns.slice(i, i + 2)); return r; };

function lobbyView(g, bot) {
  const list = seated(g).map(([, p]) => p.name);
  const n = list.length;
  const text = '🐺 มนุษย์หมาป่า · ห้อง ' + g.code + '\n👥 ' + n + '/' + W.MAX_PLAYERS + (n ? ' · ' + list.join(', ') : '') +
    '\n' + (n >= W.MIN_PLAYERS ? '✅ ครบแล้ว หัวห้องกด ▸ เริ่ม' : '⏳ อีก ' + (W.MIN_PLAYERS - n) + ' คน · กติกา /rules');
  const rows = [];
  if (n < W.MAX_PLAYERS) rows.push([{ text: '▸ เข้าร่วม', url: 'https://t.me/' + bot + '?start=' + g.code }]);
  rows.push([{ text: '▸ เริ่ม', callback_data: 'start:' + g.code }, { text: '✕ ยกเลิก', callback_data: 'cancel:' + g.code }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}

function startedView(g, counts) {
  const mix = W.ROLES.filter((r) => counts[r]).map((r) => W.EMOJI[r] + ' ' + counts[r]).join(' · ');
  return {
    text: '🐺 เกมเริ่ม · ห้อง ' + g.code + ' · ' + seated(g).length + ' คน\n🃏 ส่งบทให้ทุกคนทาง DM แล้ว · ' + mix,
    reply_markup: { inline_keyboard: [[{ text: '✕ ยกเลิกเกม', callback_data: 'cancel:' + g.code }]] },
  };
}

function roleCard(roles, players, me, code) {
  const role = roles[me];
  let t = ROLE_CARD[role];
  if (role === 'wolf') {
    const mates = Object.keys(roles).filter((id) => id !== me && roles[id] === 'wolf').map((id) => players[id].name);
    t += '\n🐺 เพื่อน: ' + (mates.length ? mates.join(', ') : 'ไม่มี (คุณคนเดียว)');
  }
  return t + '\n🤫 อย่าบอกใคร · ห้อง ' + code;
}

async function safe(deps, method, body) {
  try { return await deps.tg(method, body); } catch (e) { console.error('[wolfBot] ' + method + ' failed: ' + (e && e.message)); return null; }
}
/* Send what a transaction decided, in order. An item: { method, body, save?: field for the sent message_id on the game doc,
   dm?: the player's name (a failed DM is named in the group afterwards) }. */
async function run(deps, g, out) {
  const missed = [];
  for (const o of out) {
    const r = await safe(deps, o.method, o.body);
    if (!r && o.dm) missed.push(o.dm);
    if (r && r.message_id && o.save) await deps.db.collection('wolf_games').doc(g.code).update({ [o.save]: r.message_id });
  }
  if (missed.length) await safe(deps, 'sendMessage', { chat_id: g.chatId, text: '⚠️ ส่ง DM ไม่ถึง: ' + [...new Set(missed)].join(', ') + ' · เปิดแชทกับบอทแล้วกด Start' });
}

// ---- /werewolf in a group ------------------------------------------------------------------------------------------------
async function openRoom(msg, deps) {
  const { db } = deps;
  const chatId = String(msg.chat.id), host = String(msg.from.id);
  const bot = await deps.botName();
  const chatRef = db.collection('wolf_chats').doc(chatId);
  const res = await db.runTransaction(async (tx) => {
    const c = await tx.get(chatRef);
    if (c.exists && c.data().game) {
      const g = await tx.get(db.collection('wolf_games').doc(c.data().game));
      if (g.exists && !['over', 'cancelled'].includes(g.data().status)) return { busy: g.data() };
    }
    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      let k = ''; for (let j = 0; j < 6; j++) k += CODE_ABC[Math.floor(deps.rng() * CODE_ABC.length)];
      if (!(await tx.get(db.collection('wolf_games').doc(k))).exists) code = k;
    }
    if (!code) throw new Error('no free code');
    const g = { code, chatId, host, hostName: nameOf(msg.from), status: 'lobby', players: {}, talkSec: W.TALK_DEFAULT, round: 0, msgId: null, deadline: null, createdAt: deps.now, updatedAt: deps.now };
    tx.set(db.collection('wolf_games').doc(code), g);
    tx.set(chatRef, { game: code, updatedAt: deps.now });
    return { g };
  });
  if (res.busy) {
    await safe(deps, 'sendMessage', { chat_id: chatId, text: '🐺 กลุ่มนี้มีห้อง ' + res.busy.code + ' อยู่แล้ว', reply_to_message_id: res.busy.msgId || undefined });
    return;
  }
  const sent = await safe(deps, 'sendMessage', Object.assign({ chat_id: chatId }, lobbyView(res.g, bot)));
  if (sent && sent.message_id) await db.collection('wolf_games').doc(res.g.code).update({ msgId: sent.message_id });
}

// ---- /start <code> in a DM ---------------------------------------------------------------------------------------------
async function join(msg, code, deps) {
  const { db } = deps;
  const me = String(msg.from.id);
  const bot = await deps.botName();
  const gRef = db.collection('wolf_games').doc(code), tgRef = db.collection('wolf_tg').doc(me);
  const res = await db.runTransaction(async (tx) => {
    const g = await tx.get(gRef);
    if (!g.exists) return { say: '❓ ไม่พบห้อง ' + code };
    const d = g.data();
    if (d.players[me]) return { say: '✅ คุณอยู่ในห้อง ' + code + ' แล้ว · รอหัวห้องกด ▸ เริ่ม' };
    if (d.status !== 'lobby') return { say: '⛔ ห้อง ' + code + ' เริ่มเกมไปแล้ว' };
    const n = Object.keys(d.players).length;
    if (n >= W.MAX_PLAYERS) return { say: '⛔ ห้อง ' + code + ' เต็มแล้ว (' + W.MAX_PLAYERS + ' คน)' };
    const t = await tx.get(tgRef);
    if (t.exists && t.data().game && t.data().game !== code) {
      const other = await tx.get(db.collection('wolf_games').doc(t.data().game));
      if (other.exists && !['over', 'cancelled'].includes(other.data().status)) return { say: '⛔ คุณอยู่ห้อง ' + t.data().game + ' อยู่ · จบห้องนั้นก่อน' };
    }
    const seat = Math.max(0, ...Object.values(d.players).map((p) => p.seat)) + 1;
    d.players[me] = { name: nameOf(msg.from), seat, alive: true };
    tx.update(gRef, { players: d.players, updatedAt: deps.now });
    tx.set(tgRef, { game: code, updatedAt: deps.now });
    return { say: '✅ เข้าห้อง ' + code + ' แล้ว · ที่นั่ง ' + seat + '\nรอหัวห้องกด ▸ เริ่ม แล้วบทจะมาทางนี้', g: d };
  });
  await safe(deps, 'sendMessage', { chat_id: me, text: res.say });
  if (res.g && res.g.msgId) await safe(deps, 'editMessageText', Object.assign({ chat_id: res.g.chatId, message_id: res.g.msgId }, lobbyView(res.g, bot)));
}

// ---- the game loop (pure over g = the game doc, st = secret/state; each returns the messages to send) -----------------------
const nm = (g, id) => (g.players[id] ? g.players[id].name : '?');
const liveIds = (st) => W.aliveIds(st.alive);
/* Who may be picked by actor for kind tonight, as menu buttons. */
function menu(g, st, actor, kind) {
  return seated(g).map(([id]) => id).filter((id) => !W.pickError(st, actor, kind, id))
    .map((id) => ({ text: (kind === 'poison' ? '☠️ ' : '') + nm(g, id), callback_data: 'n:' + g.code + ':' + g.round + ':' + kind + ':' + id }));
}
const ASK = { wolf: '🐺 คืนนี้กัดใคร? (เลือกแล้วเปลี่ยนไม่ได้)', seer: '🔮 คืนนี้ส่องใคร?', guard: '🛡️ คืนนี้คุ้มกันใคร?' };
function witchView(g, st) {
  const p = st.picks, w = st.witch, rows = [];
  let text = '🧪 คืนที่ ' + g.round + ' · ' + (p.bite ? '🐺 หมาป่ากัด ' + nm(g, p.bite) : '🐺 คืนนี้ไม่มีใครถูกกัด');
  if (p.heal) text += '\n💚 ชุบ ' + nm(g, p.bite) + ' แล้ว';
  if (p.poison) text += '\n☠️ วางยา ' + nm(g, p.poison) + ' แล้ว';
  if (w.heal && p.bite && !p.heal) rows.push([{ text: '💚 ชุบ ' + nm(g, p.bite), callback_data: 'n:' + g.code + ':' + g.round + ':heal:1' }]);
  if (w.poison && !p.poison) rows.push(...rows2(menu(g, st, W.withRole(st.roles, st.alive, 'witch')[0], 'poison')));
  rows.push([{ text: '⏭ เสร็จ', callback_data: 'n:' + g.code + ':' + g.round + ':done:0' }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}
function wolvesDone(st) { return W.withRole(st.roles, st.alive, 'wolf').every((id) => id in st.picks.wolf); }
function nightDone(st) {
  const t = W.nightTurns(st), p = st.picks;
  return Object.keys(t).every((id) => {
    const k = t[id];
    if (k === 'wolf') return id in p.wolf;
    if (k === 'seer') return !!p.seer;
    if (k === 'guard') return !!p.guard;
    if (k === 'witch') return p.witchDone;
    return true;
  });
}
/* After the last wolf has chosen: fix tonight's bite and hand the witch her menu (she sees who was bitten). */
function afterWolves(g, st, out, rng) {
  st.picks.bite = W.wolfTarget(st.picks.wolf, rng);
  const witch = W.withRole(st.roles, st.alive, 'witch')[0];
  if (witch && (st.witch.heal || st.witch.poison)) {
    st.picks.witchAsked = true;
    out.push({ method: 'sendMessage', body: Object.assign({ chat_id: witch }, witchView(g, st)), dm: nm(g, witch) });
  }
  else st.picks.witchDone = true;
}
function beginNight(g, st, now, out, rng) {
  g.status = 'night'; g.deadline = now + W.NIGHT_SEC * 1000;
  st.picks = { wolf: {}, bite: null, seer: null, guard: null, heal: false, poison: null, witchDone: false };
  out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: '🌙 คืนที่ ' + g.round + ' · ⏳ ' + mmss(W.NIGHT_SEC) + '\n💤 หลับตา · คนมีบทดู DM' } });
  const turns = W.nightTurns(st);
  for (const id of Object.keys(turns)) {
    const k = turns[id];
    if (k === 'witch') continue;   // after the wolves
    const btns = menu(g, st, id, k);
    if (!btns.length) { if (k === 'guard') st.picks.guard = 'none'; if (k === 'seer') st.picks.seer = 'none'; continue; }
    out.push({ method: 'sendMessage', body: { chat_id: id, text: ASK[k], reply_markup: { inline_keyboard: rows2(btns) } }, dm: nm(g, id) });
  }
}
/* Who had a menu out tonight and whether they pressed: { id: bool }. A 🔮 / 🛡️ with nobody to pick ('none') and a 🧪 who
   never got her menu were not asked. */
function nightActed(st) {
  const t = W.nightTurns(st), p = st.picks, out = {};
  for (const id of Object.keys(t)) {
    const k = t[id];
    if (k === 'wolf') out[id] = id in p.wolf;
    else if (k === 'seer' || k === 'guard') { if (p[k] !== 'none') out[id] = !!p[k]; }
    else if (k === 'witch' && p.witchAsked) out[id] = !!(p.witchDone || p.heal || p.poison);
  }
  return out;
}
/* D1: count each asked player's misses in a row (a press resets it); the ids that just reached 2. Kept in secret/state
   because a night miss shows who has a night role. */
function countMiss(st, acted) {
  st.miss = st.miss || {};
  return Object.keys(acted).filter((id) => { st.miss[id] = acted[id] ? 0 : (st.miss[id] || 0) + 1; return st.miss[id] === 2; });
}
const remind = (g, st, ids, out) => ids.filter((id) => st.alive[id]).forEach((id) => out.push({ method: 'sendMessage', body: { chat_id: id, text: REMIND(g.code) } }));
function finishNight(g, st, now, out, rng) {
  const p = st.picks;
  const missed = countMiss(st, nightActed(st));
  if (!p.bite && !wolvesDone(st) && Object.keys(p.wolf).length) p.bite = W.wolfTarget(p.wolf, rng);   // time ran out mid-vote
  const witch = W.withRole(st.roles, st.alive, 'witch')[0];
  const picks = {
    bite: p.bite && !W.pickError(st, Object.keys(p.wolf)[0], 'wolf', p.bite) ? p.bite : null,
    guard: p.guard && p.guard !== 'none' ? p.guard : null,
    seer: null,   // the seer was answered the moment they chose
    heal: !!(p.heal && witch),
    poison: p.poison && witch && !W.pickError(st, witch, 'poison', p.poison) ? p.poison : null,
  };
  const r = W.resolveNight(st, picks);
  Object.assign(st, r.state); delete st.picks;
  r.dead.forEach((id) => { g.players[id].alive = false; });
  const deadTxt = r.dead.length ? 'เมื่อคืน 💀 ' + r.dead.map((id) => nm(g, id)).join(', ') + ' ตาย' + QUIET : 'คืนสงบ ไม่มีใครตาย';
  r.dead.forEach((id) => out.push({ method: 'sendMessage', body: { chat_id: id, text: '💀 คุณตายเมื่อคืน · ดูเกมต่อได้ แต่ขอเงียบในกลุ่มจนจบนะ 🤐' } }));
  if (endIf(g, st, out, '☀️ เช้าวันที่ ' + g.round + ' · ' + deadTxt)) return;
  g.status = 'day'; g.deadline = now + (g.talkSec || W.TALK_DEFAULT) * 1000;
  out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: '☀️ เช้าวันที่ ' + g.round + ' · ' + deadTxt + '\n👥 ' + liveIds(st).length + ' · 💬 คุย ' + mmss(g.talkSec || W.TALK_DEFAULT),
    reply_markup: { inline_keyboard: [[{ text: '🗳 โหวตเลย (หัวห้อง)', callback_data: 'talk:' + g.code + ':' + g.round }]] } } });
  remind(g, st, missed, out);
}
function voteView(g, st) {
  const live = seated(g).map(([id]) => id).filter((id) => st.alive[id]);
  const btns = live.map((id) => ({ text: nm(g, id), callback_data: 'v:' + g.code + ':' + g.round + ':' + id }));
  btns.push({ text: '⏭ ข้าม', callback_data: 'v:' + g.code + ':' + g.round + ':skip' });
  const n = Object.keys(st.ballot || {}).length;
  return { text: '🗳 โหวตลับ วันที่ ' + g.round + ' · ⏳ ' + mmss(W.VOTE_SEC) + ' · เปลี่ยนได้\n✅ ' + n + '/' + live.length, reply_markup: { inline_keyboard: rows2(btns) } };
}
function beginVote(g, st, now, out) {
  g.status = 'vote'; g.deadline = now + W.VOTE_SEC * 1000; st.ballot = {};
  out.push({ method: 'sendMessage', body: Object.assign({ chat_id: g.chatId }, voteView(g, st)), save: 'voteMsgId' });
}
function finishVote(g, st, now, out, rng) {
  const acted = {};
  liveIds(st).forEach((id) => { acted[id] = id in (st.ballot || {}); });
  const missed = countMiss(st, acted);
  const t = W.tallyVotes(st, st.ballot || {});
  const parts = Object.keys(t.counts).filter((k) => k !== 'skip').sort((a, b) => t.counts[b] - t.counts[a]).map((id) => nm(g, id) + ' ' + t.counts[id]);
  if (t.counts.skip) parts.push('⏭ ข้าม ' + t.counts.skip);
  let txt = '🗳 ผลโหวต วันที่ ' + g.round + '\n' + (parts.length ? parts.join(' · ') : 'ไม่มีใครโหวต');   // owner pick Q5: counts only
  if (t.out) {
    Object.assign(st, W.eliminate(st, t.out)); g.players[t.out].alive = false;
    txt += '\n👋 ' + nm(g, t.out) + ' ออกจากหมู่บ้าน' + QUIET;
  } else txt += '\n🤝 เสมอ · ไม่มีใครออก';
  delete st.ballot;
  if (g.voteMsgId) out.push({ method: 'editMessageText', body: { chat_id: g.chatId, message_id: g.voteMsgId, text: '🗳 ปิดโหวตวันที่ ' + g.round } });
  if (endIf(g, st, out, txt)) return;
  out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: txt } });
  g.round += 1; g.voteMsgId = null;
  beginNight(g, st, now, out, rng);
  remind(g, st, missed, out);
}
/* The end: the winner and every role (the only group text that ever names roles). */
function endIf(g, st, out, lead) {
  const w = W.winner(st);
  if (!w) return false;
  g.status = 'over'; g.deadline = null; g.winner = w;
  const list = seated(g).map(([id, p]) => W.EMOJI[st.roles[id]] + ' ' + p.name + (st.alive[id] ? '' : ' 💀')).join('\n');
  out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: lead + '\n\n' + (w === 'wolf' ? '🐺 หมาป่าชนะ!' : '🏆 ฝั่งชาวบ้านชนะ!') + '\n' + list + '\n\nเล่นอีก พิมพ์ /werewolf' } });
  g.freed = true;
  return true;
}
/* Write g + st back and free the chat and the players when the game ended. */
function commit(tx, db, gRef, g, st, now) {
  const free = g.freed; delete g.freed;
  g.updatedAt = now;
  tx.set(gRef, g);
  tx.set(gRef.collection('secret').doc('state'), st);
  if (free) {
    tx.set(db.collection('wolf_chats').doc(g.chatId), { game: null, updatedAt: now });
    for (const id of Object.keys(g.players)) tx.set(db.collection('wolf_tg').doc(id), { game: null, updatedAt: now });
  }
}

// ---- buttons -----------------------------------------------------------------------------------------------------------
async function onButton(q, deps) {
  const parts = String(q.data || '').split(':');
  if (parts[0] === 'n') return onNight(q, parts, deps);
  if (parts[0] === 'v') return onVote(q, parts, deps);
  if (parts[0] === 'talk') return onTalkEnd(q, parts, deps);
  const { db } = deps;
  const [kind, code] = parts;
  const me = String(q.from.id);
  const answer = (text) => safe(deps, 'answerCallbackQuery', { callback_query_id: q.id, text, show_alert: !!text });
  if (!code || !['start', 'cancel'].includes(kind)) return answer();
  const gRef = db.collection('wolf_games').doc(code);
  const res = await db.runTransaction(async (tx) => {
    const g = await tx.get(gRef);
    if (!g.exists) return { say: 'ไม่พบห้องนี้' };
    const d = g.data();
    if (d.host !== me) return { say: 'เฉพาะหัวห้อง (' + d.hostName + ') กดได้' };
    if (kind === 'cancel') {
      if (['over', 'cancelled'].includes(d.status)) return { say: 'ห้องนี้ปิดแล้ว' };
      tx.update(gRef, { status: 'cancelled', deadline: null, updatedAt: deps.now });
      tx.set(db.collection('wolf_chats').doc(d.chatId), { game: null, updatedAt: deps.now });
      for (const id of Object.keys(d.players)) tx.set(db.collection('wolf_tg').doc(id), { game: null, updatedAt: deps.now });
      return { g: d, cancelled: true, live: LIVE.includes(d.status) };
    }
    if (d.status !== 'lobby') return { say: 'เกมเริ่มไปแล้ว' };
    const ids = seated(d).map(([id]) => id);
    if (ids.length < W.MIN_PLAYERS) return { say: 'ต้องมีอย่างน้อย ' + W.MIN_PLAYERS + ' คน (ตอนนี้ ' + ids.length + ')' };
    const counts = W.defaultCounts(ids.length);
    const roles = W.deal(ids, counts, deps.rng);
    const st = W.newState(roles);
    const out = [];
    if (d.msgId) out.push({ method: 'editMessageText', body: Object.assign({ chat_id: d.chatId, message_id: d.msgId }, startedView(d, counts)) });
    for (const [id] of seated(d)) out.push({ method: 'sendMessage', body: { chat_id: id, text: roleCard(roles, d.players, id, d.code) }, dm: nm(d, id) });
    d.round = 1; d.counts = counts; d.startedAt = deps.now;
    beginNight(d, st, deps.now, out, deps.rng);
    commit(tx, db, gRef, d, st, deps.now);
    return { g: d, out };
  });
  if (res.say) return answer(res.say);
  await answer();
  const g = res.g;
  if (res.cancelled && !res.live) {
    if (g.msgId) await safe(deps, 'editMessageText', { chat_id: g.chatId, message_id: g.msgId, text: '✕ ปิดห้อง ' + g.code + ' แล้ว · พิมพ์ /werewolf เพื่อเปิดใหม่' });
    return;
  }
  if (res.cancelled) {   // mid-game: the start message is far up the chat, so say it anew; no roles (Q4)
    if (g.voteMsgId && g.status === 'vote') await safe(deps, 'editMessageText', { chat_id: g.chatId, message_id: g.voteMsgId, text: '🗳 ปิดโหวต · ✕ ยกเลิกเกม' });
    if (g.msgId) await safe(deps, 'editMessageText', { chat_id: g.chatId, message_id: g.msgId, text: '🐺 ห้อง ' + g.code + ' · ✕ ยกเลิกแล้ว' });
    await safe(deps, 'sendMessage', { chat_id: g.chatId, text: '✕ ยกเลิกเกม ห้อง ' + g.code + ' · ไม่เฉลยบท\nเล่นใหม่ /werewolf' });
    return;
  }
  await run(deps, g, res.out);
}

/* n:<code>:<round>:<kind>:<target> — a night pick from a player's DM menu. */
async function onNight(q, parts, deps) {
  const { db } = deps;
  const [, code, round, kind, arg] = parts;
  const me = String(q.from.id);
  const gRef = db.collection('wolf_games').doc(code || '-');
  const dmMsg = q.message ? { chat_id: q.message.chat.id, message_id: q.message.message_id } : null;
  const res = await db.runTransaction(async (tx) => {
    const gs = await tx.get(gRef);
    const ss = await tx.get(gRef.collection('secret').doc('state'));
    if (!gs.exists || !ss.exists) return { say: 'ไม่พบห้องนี้' };
    const g = gs.data(), st = ss.data();
    if (g.status === 'cancelled') return { say: 'เกมนี้ถูกยกเลิกแล้ว' };
    if (g.status !== 'night' || String(g.round) !== round || !st.picks) return { say: 'หมดเวลาคืนนั้นแล้ว' };
    if (!st.alive[me]) return { say: 'คุณตายแล้ว' };
    const p = st.picks, out = [], role = st.roles[me];
    let toast = '', edit = null;
    if (kind === 'wolf' || kind === 'seer' || kind === 'guard') {
      if (W.pickError(st, me, kind, arg)) return { say: 'เลือกคนนี้ไม่ได้' };
      if (kind === 'wolf') {
        if (me in p.wolf || p.bite) return { say: 'เลือกไปแล้ว' };
        p.wolf[me] = arg;
        edit = '🐺 คุณเลือกกัด ' + nm(g, arg);
        W.withRole(st.roles, st.alive, 'wolf').filter((id) => id !== me).forEach((id) => out.push({ method: 'sendMessage', body: { chat_id: id, text: '🐺 ' + nm(g, me) + ' เลือกกัด ' + nm(g, arg) } }));
        if (wolvesDone(st)) afterWolves(g, st, out, deps.rng);
      } else if (kind === 'seer') {
        if (p.seer) return { say: 'ส่องไปแล้ว' };
        p.seer = arg;
        edit = '🔮 ' + nm(g, arg) + (st.roles[arg] === 'wolf' ? ' = 🐺 หมาป่า!' : ' = ไม่ใช่หมาป่า');
      } else {
        if (p.guard) return { say: 'เลือกไปแล้ว' };
        p.guard = arg;
        edit = '🛡️ คืนนี้คุ้มกัน ' + nm(g, arg);
      }
    } else if (kind === 'heal' || kind === 'poison' || kind === 'done') {
      if (role !== 'witch') return { say: 'ไม่ใช่บทของคุณ' };
      if (!wolvesDone(st) || p.witchDone) return { say: p.witchDone ? 'เสร็จไปแล้ว' : 'รอหมาป่าก่อน' };
      if (kind === 'heal') {
        if (!p.bite || !st.witch.heal || p.heal) return { say: 'ใช้ไม่ได้' };
        p.heal = true; toast = '💚 ชุบแล้ว';
      } else if (kind === 'poison') {
        if (p.poison || W.pickError(st, me, 'poison', arg)) return { say: 'ใช้ไม่ได้' };
        p.poison = arg; toast = '☠️ วางยาแล้ว';
      } else p.witchDone = true;
      const left = (st.witch.heal && p.bite && !p.heal) || (st.witch.poison && !p.poison);
      if (!left) p.witchDone = true;
      const v = witchView(g, st);
      if (p.witchDone) out.push({ method: 'editMessageText', body: Object.assign({}, dmMsg, { text: v.text + '\n✅ เสร็จแล้ว' }) });
      else out.push({ method: 'editMessageText', body: Object.assign({}, dmMsg, v) });
    } else return { say: '?' };
    if (edit && dmMsg) out.unshift({ method: 'editMessageText', body: Object.assign({}, dmMsg, { text: edit }) });
    if (nightDone(st)) finishNight(g, st, deps.now, out, deps.rng);
    commit(tx, db, gRef, g, st, deps.now);
    return { g, out, toast };
  });
  await safe(deps, 'answerCallbackQuery', { callback_query_id: q.id, text: res.say || res.toast || undefined, show_alert: !!res.say });
  if (res.out) await run(deps, res.g, res.out);
}

/* v:<code>:<round>:<target|skip> — a secret vote from the group's buttons. Only the count of who voted is shown. */
async function onVote(q, parts, deps) {
  const { db } = deps;
  const [, code, round, arg] = parts;
  const me = String(q.from.id);
  const gRef = db.collection('wolf_games').doc(code || '-');
  const res = await db.runTransaction(async (tx) => {
    const gs = await tx.get(gRef);
    const ss = await tx.get(gRef.collection('secret').doc('state'));
    if (!gs.exists || !ss.exists) return { say: 'ไม่พบห้องนี้' };
    const g = gs.data(), st = ss.data();
    if (g.status === 'cancelled') return { say: 'เกมนี้ถูกยกเลิกแล้ว' };
    if (g.status !== 'vote' || String(g.round) !== round || !st.ballot) return { say: 'ปิดโหวตแล้ว' };
    if (!(me in st.alive)) return { say: 'คุณไม่ได้อยู่ในเกมนี้' };
    if (!st.alive[me]) return { say: 'คนตายโหวตไม่ได้ 🤐' };
    if (arg !== 'skip' && !st.alive[arg]) return { say: 'โหวตคนนี้ไม่ได้' };
    if (arg === me) return { say: 'โหวตตัวเองไม่ได้' };
    st.ballot[me] = arg;
    const out = [];
    if (liveIds(st).every((id) => id in st.ballot)) finishVote(g, st, deps.now, out, deps.rng);
    else if (g.voteMsgId) out.push({ method: 'editMessageText', body: Object.assign({ chat_id: g.chatId, message_id: g.voteMsgId }, voteView(g, st)) });
    commit(tx, db, gRef, g, st, deps.now);
    return { g, out, toast: '🗳 ' + (arg === 'skip' ? 'ข้าม' : 'โหวต ' + nm(g, arg)) + ' · เปลี่ยนได้' };
  });
  await safe(deps, 'answerCallbackQuery', { callback_query_id: q.id, text: res.say || res.toast, show_alert: !!res.say });
  if (res.out) await run(deps, res.g, res.out);
}

/* talk:<code>:<round> — the host ends the talk early. */
async function onTalkEnd(q, parts, deps) {
  const { db } = deps;
  const [, code, round] = parts;
  const gRef = db.collection('wolf_games').doc(code || '-');
  const res = await db.runTransaction(async (tx) => {
    const gs = await tx.get(gRef);
    const ss = await tx.get(gRef.collection('secret').doc('state'));
    if (!gs.exists || !ss.exists) return { say: 'ไม่พบห้องนี้' };
    const g = gs.data(), st = ss.data();
    if (g.host !== String(q.from.id)) return { say: 'เฉพาะหัวห้อง (' + g.hostName + ') กดได้' };
    if (g.status !== 'day' || String(g.round) !== round) return { say: 'เลยช่วงคุยแล้ว' };
    const out = [];
    beginVote(g, st, deps.now, out);
    commit(tx, db, gRef, g, st, deps.now);
    return { g, out };
  });
  await safe(deps, 'answerCallbackQuery', { callback_query_id: q.id, text: res.say, show_alert: !!res.say });
  if (res.out) await run(deps, res.g, res.out);
}

/* wolfTick (every minute, owner pick Q6): move every live room whose deadline has passed, and post the ⏳ warning (W1) in
   rooms with ≤ 60 s left — once per phase (g.warned = '<status>:<round>'). One query on a single field (deadline) so no
   composite index is needed; lobby / over / cancelled rooms keep deadline null. Returns how many rooms moved. */
function warn(g, st, out) {
  const key = g.status + ':' + g.round;
  if (g.warned === key || g.status === 'vote') return false;   // the vote is only 1:00 long: no warning
  g.warned = key;
  if (g.status === 'day') out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: '⏳ เหลือ ~1 นาที · แล้วโหวต 🗳' } });
  else {
    const acted = nightActed(st);
    Object.keys(acted).filter((id) => !acted[id]).forEach((id) => out.push({ method: 'sendMessage', body: { chat_id: id, text: '⏳ เหลือ ~1 นาที · ยังไม่ได้เลือกคืนนี้ ☝️' } }));
  }
  return true;
}
async function tick(deps) {
  const { db } = deps;
  const due = await db.collection('wolf_games').where('deadline', '<=', deps.now + WARN_SEC * 1000).get();
  let moved = 0;
  for (const doc of due.docs) {
    const gRef = db.collection('wolf_games').doc(doc.id);
    const res = await db.runTransaction(async (tx) => {
      const gs = await tx.get(gRef);
      const ss = await tx.get(gRef.collection('secret').doc('state'));
      if (!gs.exists || !ss.exists) return null;
      const g = gs.data(), st = ss.data();
      if (!LIVE.includes(g.status) || !g.deadline) return null;
      const out = [];
      if (g.deadline > deps.now) {
        if (!warn(g, st, out)) return null;
        commit(tx, db, gRef, g, st, deps.now);
        return { g, out, warned: true };
      }
      if (g.status === 'night') finishNight(g, st, deps.now, out, deps.rng);
      else if (g.status === 'day') beginVote(g, st, deps.now, out);
      else finishVote(g, st, deps.now, out, deps.rng);
      commit(tx, db, gRef, g, st, deps.now);
      return { g, out };
    });
    if (res) { if (!res.warned) moved++; await run(deps, res.g, res.out); }
  }
  return moved;
}

async function handle(update, deps) {
  if (!update) return;
  if (update.callback_query) return onButton(update.callback_query, deps);
  const msg = update.message;
  if (!msg || !msg.from || msg.from.is_bot || typeof msg.text !== 'string') return;
  const [cmdRaw, arg] = msg.text.trim().split(/\s+/);
  const bot = await deps.botName();
  const cmd = cmdRaw.toLowerCase().replace('@' + String(bot).toLowerCase(), '');
  if (cmd === '/rules') return safe(deps, 'sendMessage', { chat_id: msg.chat.id, text: RULES });
  if (cmd === '/werewolf') {
    if (isGroup(msg.chat)) return openRoom(msg, deps);
    return safe(deps, 'sendMessage', { chat_id: msg.chat.id, text: '🐺 เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์ /werewolf ในกลุ่มนั้น · กติกา /rules' });
  }
  if (cmd === '/start' && msg.chat.type === 'private') {
    const code = String(arg || '').toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(code)) return join(msg, code, deps);
    return safe(deps, 'sendMessage', { chat_id: msg.chat.id, text: '🐺 สวัสดี · ในกลุ่มพิมพ์ /werewolf แล้วกด ▸ เข้าร่วม · กติกา /rules' });
  }
}

module.exports = { handle, tick, lobbyView, startedView, roleCard, ROLE_CARD, RULES };
