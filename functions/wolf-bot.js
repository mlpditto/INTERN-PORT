// 🐺 Werewolf Phase 1 (2026-11-23) — the Telegram bot's room logic: /werewolf in a group opens a room, ▸ เข้าร่วม is a deep
// link t.me/<bot>?start=<code> (so everyone has pressed Start and the bot can DM them), the host taps ▸ เริ่ม at 5–10 players
// and each player gets their role card by DM. Nights / votes come in Phase 2 (docs/WEREWOLF-PLAN.md).
// Owner picks: anyone with Telegram plays, no app account (§8 Q1) · a new bot of its own (Q2) · any group (Q7).
// handle(update, deps) is called by exports.wolfBot after the secret-token header check. deps = { db, tg(method, body),
// botName(), now, rng }. Roles live only in wolf_games/{code}/secret/state and in each player's own DM — never in a group text.
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

const nameOf = (u) => (((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.username || 'ผู้เล่น').slice(0, 24);
const seated = (g) => Object.entries(g.players || {}).sort((a, b) => a[1].seat - b[1].seat);
const isGroup = (chat) => chat && (chat.type === 'group' || chat.type === 'supergroup');

function lobbyView(g, bot) {
  const list = seated(g).map(([, p]) => p.name);
  const n = list.length;
  const text = '🐺 มนุษย์หมาป่า · ห้อง ' + g.code + '\n👥 ' + n + '/' + W.MAX_PLAYERS + (n ? ' · ' + list.join(', ') : '') +
    '\n' + (n >= W.MIN_PLAYERS ? '✅ ครบแล้ว หัวห้องกด ▸ เริ่ม' : 'ต้องมีอีก ' + (W.MIN_PLAYERS - n) + ' คน');
  const rows = [];
  if (n < W.MAX_PLAYERS) rows.push([{ text: '▸ เข้าร่วม', url: 'https://t.me/' + bot + '?start=' + g.code }]);
  rows.push([{ text: '▸ เริ่ม', callback_data: 'start:' + g.code }, { text: '✕ ยกเลิก', callback_data: 'cancel:' + g.code }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}

function startedView(g, counts) {
  const mix = W.ROLES.filter((r) => counts[r]).map((r) => W.EMOJI[r] + ' ' + counts[r]).join(' · ');
  return {
    text: '🐺 เกมเริ่ม · ห้อง ' + g.code + ' · ' + seated(g).length + ' คน\n🃏 ส่งบทให้ทุกคนทาง DM แล้ว · ' + mix + '\n🌙 คืนแรกจะมาใน Phase ถัดไป',
    reply_markup: { inline_keyboard: [[{ text: '✕ จบเกม', callback_data: 'cancel:' + g.code }]] },
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
    const g = { code, chatId, host, hostName: nameOf(msg.from), status: 'lobby', players: {}, talkSec: W.TALK_DEFAULT, round: 0, msgId: null, createdAt: deps.now, updatedAt: deps.now };
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

// ---- buttons -----------------------------------------------------------------------------------------------------------
async function onButton(q, deps) {
  const { db } = deps;
  const [kind, code] = String(q.data || '').split(':');
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
      tx.update(gRef, { status: 'cancelled', updatedAt: deps.now });
      tx.set(db.collection('wolf_chats').doc(d.chatId), { game: null, updatedAt: deps.now });
      for (const id of Object.keys(d.players)) tx.set(db.collection('wolf_tg').doc(id), { game: null, updatedAt: deps.now });
      return { g: d, cancelled: true };
    }
    if (d.status !== 'lobby') return { say: 'เกมเริ่มไปแล้ว' };
    const ids = seated(d).map(([id]) => id);
    if (ids.length < W.MIN_PLAYERS) return { say: 'ต้องมีอย่างน้อย ' + W.MIN_PLAYERS + ' คน (ตอนนี้ ' + ids.length + ')' };
    const counts = W.defaultCounts(ids.length);
    const roles = W.deal(ids, counts, deps.rng);
    tx.set(gRef.collection('secret').doc('state'), W.newState(roles));
    tx.update(gRef, { status: 'night', round: 1, counts, startedAt: deps.now, updatedAt: deps.now });
    return { g: d, roles, counts };
  });
  if (res.say) return answer(res.say);
  await answer();
  const g = res.g;
  if (res.cancelled) {
    if (g.msgId) await safe(deps, 'editMessageText', { chat_id: g.chatId, message_id: g.msgId, text: '✕ ปิดห้อง ' + g.code + ' แล้ว · พิมพ์ /werewolf เพื่อเปิดใหม่' });
    return;
  }
  if (g.msgId) await safe(deps, 'editMessageText', Object.assign({ chat_id: g.chatId, message_id: g.msgId }, startedView(g, res.counts)));
  const missed = [];
  for (const [id, p] of seated(g)) {
    const ok = await safe(deps, 'sendMessage', { chat_id: id, text: roleCard(res.roles, g.players, id, g.code) });
    if (!ok) missed.push(p.name);
  }
  if (missed.length) await safe(deps, 'sendMessage', { chat_id: g.chatId, text: '⚠️ ส่ง DM ไม่ถึง: ' + missed.join(', ') + ' · เปิดแชทกับบอทแล้วกด Start' });
}

async function handle(update, deps) {
  if (!update) return;
  if (update.callback_query) return onButton(update.callback_query, deps);
  const msg = update.message;
  if (!msg || !msg.from || msg.from.is_bot || typeof msg.text !== 'string') return;
  const [cmdRaw, arg] = msg.text.trim().split(/\s+/);
  const bot = await deps.botName();
  const cmd = cmdRaw.toLowerCase().replace('@' + String(bot).toLowerCase(), '');
  if (cmd === '/werewolf') {
    if (isGroup(msg.chat)) return openRoom(msg, deps);
    return safe(deps, 'sendMessage', { chat_id: msg.chat.id, text: '🐺 เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์ /werewolf ในกลุ่มนั้น' });
  }
  if (cmd === '/start' && msg.chat.type === 'private') {
    const code = String(arg || '').toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(code)) return join(msg, code, deps);
    return safe(deps, 'sendMessage', { chat_id: msg.chat.id, text: '🐺 สวัสดี · ในกลุ่มพิมพ์ /werewolf แล้วกด ▸ เข้าร่วม' });
  }
}

module.exports = { handle, lobbyView, startedView, roleCard, ROLE_CARD };
