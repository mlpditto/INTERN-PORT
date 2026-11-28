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
// Names (2026-11-26, owner pick B): a player joins under their Telegram name, and any plain text they DM the bot becomes
// their in-game name — in a lobby it renames them at once (the lobby line and the host tag follow), otherwise it is kept
// in wolf_tg/{tgId}.name for the next room. 24 chars, one line, no duplicate in the same room; never changeable mid-game.
// Clock C1 (2026-11-26, owner pick, every 30 s): when a phase starts, run() enqueues one Cloud Task per 30 s step and one at
// the deadline (deps.tasks); each calls phase(), which edits the phase message's ⏳ (night → the 🌙 line, day → the ☀️ line
// with its 🗳 button, vote → the ballot) or ends the phase on the second. Task names are deterministic, so a repeat is a
// harmless 409. Without deps.tasks, or when the enqueue fails, wolfTick (every minute) still runs the game as before.
// Bot players (2026-11-26, owner picks 1A 2B 3 5, mockup werewolf-bot-players): the host adds 🤖 seats in the lobby (+1 / −1,
// level 🌆 🌙 🌕 = wolf-ai.js, the solo game's brain); bots have no Telegram chat, so they decide inside the function when a
// phase starts: night picks at 🌙 (a human 🐺 sees a bot mate's wish in the DM), one line of table talk in the ☀️ message
// (🤨 / 👍 / 🔮 claims, fakes shown 🤥 at the end), ballots at 🗳. Bot ids are bot1…bot9, names carry 🤖; a game needs ≥ 1
// human. Bot knowledge lives in secret/state.ai (checks, claims, said, votes). Nothing is ever sent to a bot id.
// 🎲 extra role (2026-11-26, owner pick 4A, first role 🏹): the host's lobby chip swaps one 👤 for a 🏹 นักล่า from 6 seats,
// shown in the deck line. When the hunter dies (night or vote) the game pauses in status 'shot' (SHOT_SEC, clock-armed):
// the group sees who the hunter was and a ⏳, the hunter gets a DM menu; a press or the deadline (no shot) resolves it and
// the day / next night goes on. A bot hunter shoots at once (wolf-ai hunterPick), no pause.
// 💘 กามเทพ (2026-11-26, second 🎲 role; the chip cycles ปิด → 🏹 → 💘 → 🎲 สุ่ม): on night 1 the cupid picks two lovers by DM
// (two presses, self allowed; the clock pairs at random if they never press; a bot cupid pairs at once), both lovers get a DM.
// When one lover dies the other dies with them (engine), said as 💔 in the morning / vote / shot line; a mixed pair (🐺 + not)
// wins alone when only they remain. Bots never bite or vote their own lover.
// 🎲 row B + 😈 🃏 🧱 (2026-11-27, owner pick "ตามแนะนำทั้งหมด" on mockup werewolf-more-roles): the chip became a row of toggles, one per
// extra role (🏹 💘 😈 🃏 🧱, ✓ when ticked, g.extras in row order) and, from two ticks, a mode chip (🎲 ใส่ทุกบทที่ติ๊ก / สุ่ม 1 จากที่ติ๊ก,
// g.extraMode). ▸ เริ่ม applies every ticked role that fits the seats (each swaps a 👤, the 🧱 pair two; 😈 🧱 need 7 seats) in row
// order, or one of the fitting ones at random; the lobby line says what the current seats get. 😈 สมุน: its card names the wolves,
// the wolves are not told; no night action; it is 'everyone else' for the win rule. 🃏 คนบ้า: voted out = the game ends with
// 🃏 คนบ้าชนะ! (engine jesterWin); any other death is just a death. 🧱 ช่าง ×2: each card names the other mason.
'use strict';
const W = require('./wolf-rules');
const AI = require('./wolf-ai');

const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROLE_CARD = {
  wolf: '🐺 คุณคือ หมาป่า\nกลางคืนเลือกกัด 1 คนร่วมกับเพื่อนหมาป่า',
  seer: '🔮 คุณคือ ผู้หยั่งรู้\nกลางคืนส่อง 1 คน ว่าเป็น 🐺 ไหม',
  guard: '🛡️ คุณคือ บอดี้การ์ด\nกลางคืนคุ้มกัน 1 คน (ห้ามคนเดิม 2 คืนติด)',
  witch: '🧪 คุณคือ แม่มด\nมี 💚 ชุบ 1 + ☠️ พิษ 1 ใช้ได้ทั้งเกม',
  villager: '👤 คุณคือ ชาวบ้าน\nกลางวันช่วยกันหา 🐺 แล้วโหวตออก',
  hunter: '🏹 คุณคือ นักล่า\nตายเมื่อไร (คืนหรือโหวต) ยิงได้ 1 คนทันที · กลางวันช่วยกันหา 🐺',
  cupid: '💘 คุณคือ กามเทพ\nคืนแรกจับคู่รัก 2 คน (รวมตัวเองได้) · คนหนึ่งตาย อีกคนตายตาม · คู่ต่างฝ่ายชนะด้วยกันเมื่อเหลือแค่ 2 คน',
  minion: '😈 คุณคือ สมุนรับใช้\nคุณอยู่ฝ่ายหมาป่า แต่หมาป่าไม่รู้ว่าคุณเป็นใคร · 🔮 ส่องคุณเห็นเป็นชาวบ้าน',
  jester: '🃏 คุณคือ คนบ้า\nอยู่ฝ่ายตัวเอง · ไม่มีพลังกลางคืน\n🏆 ชนะคนเดียวทันที ถ้าหมู่บ้านโหวตคุณออก · ตายตอนกลางคืน = แพ้',
  mason: '🧱 คุณคือ ช่างก่ออิฐ\nไม่มีพลังกลางคืน · กลางวันช่วยกันหา 🐺',
};
const LIVE = ['night', 'day', 'vote', 'shot'];
const QUIET = ' · ขอเงียบในกลุ่มจนจบเกมนะ 🤐';   // owner pick Q8: ask once, delete nothing
const WARN_SEC = 60;   // ⏳ the warning goes out at the first tick with ≤ 60 s left (W1)
const STEP_SEC = 30;   // C1: the ⏳ in the phase message is edited this often
const BOT_NAMES = ['Tom', 'Ann', 'Ben', 'Jo', 'Max', 'May', 'Sam', 'Kim', 'Lee'];   // the solo game's names, in order (English, one syllable — owner 2026-11-28)
const LEVELS = { 1: '🌆 หัวค่ำ', 2: '🌙 เที่ยงคืน', 3: '🌕 คืนเดือนเพ็ญ' };   // the solo lobby's night levels
const isBotId = (id) => /^bot\d$/.test(String(id));
const SHOT_SEC = 30;   // 🏹 the dead hunter's time to aim
const EXTRAS = { hunter: '🏹 นักล่า', cupid: '💘 กามเทพ', minion: '😈 สมุนรับใช้', jester: '🃏 คนบ้า', mason: '🧱 ช่างก่ออิฐ ×2' };   // the 🎲 roles, row order
const EXTRA_MIN = { hunter: 6, cupid: 6, minion: 7, jester: 6, mason: 7 };   // seats a 🎲 role needs (the engine's countsError agrees)
/* The ticked 🎲 roles (owner pick B, 2026-11-27): g.extras = ['hunter', …] in row order, g.extraMode = 'all' | 'one'. Rooms from
   before kept g.extra = false | true | 'hunter' | 'cupid' | 'random' (true = hunter, random = both, one of them). */
const extrasOf = (g) => (Array.isArray(g.extras) ? g.extras : g.extra === 'random' ? ['hunter', 'cupid'] : g.extra === true ? ['hunter'] : g.extra ? [g.extra] : []);
const modeOf = (g) => g.extraMode || (g.extra === 'random' ? 'one' : 'all');
const exEmoji = (r) => (r === 'mason' ? '🧱🧱' : W.EMOJI[r]);
/* What n seats get from the ticked roles, in row order (pick = only that role): { counts, used, skipped: [{ role, why }] }. */
function extraPlan(g, n, pick) {
  let counts = W.defaultCounts(n);
  const used = [], skipped = [];
  for (const r of extrasOf(g)) {
    if (pick && r !== pick) continue;
    const next = W.addExtra(counts, r);
    if (n < EXTRA_MIN[r]) skipped.push({ role: r, why: 'ต้อง ' + EXTRA_MIN[r] + ' ที่' });
    else if (next.villager === counts.villager || W.countsError(next, n)) skipped.push({ role: r, why: '👤 ไม่พอ' });
    else { counts = next; used.push(r); }
  }
  return { counts, used, skipped };
}
/* The lobby's 🎲 line for `total` seats (counted at 5–10): what gets in, what still needs seats; '' when nothing is ticked. */
function extraLine(g, total) {
  const ex = extrasOf(g);
  if (!ex.length) return '';
  const n = Math.min(Math.max(total, W.MIN_PLAYERS), W.MAX_PLAYERS);
  if (modeOf(g) === 'one' && ex.length > 1) {
    const fit = ex.filter((r) => extraPlan(g, n, r).used.length), no = ex.filter((r) => !fit.includes(r));
    return '\n🎲 สุ่ม 1 จาก ' + (fit.length ? fit.map(exEmoji).join(' ') : '–') + (no.length ? ' · ' + no.map((r) => exEmoji(r) + ' ต้อง ' + EXTRA_MIN[r] + ' ที่').join(' · ') : '');
  }
  const p = extraPlan(g, n), swapped = p.used.reduce((k, r) => k + (r === 'mason' ? 2 : 1), 0);
  return '\n🎲 ' + (p.used.length ? p.used.map(exEmoji).join(' ') + ' แทน 👤 ' + swapped + ' คน' : '') +
    (p.skipped.length ? (p.used.length ? ' · ' : '') + p.skipped.map((x) => exEmoji(x.role) + ' ' + x.why).join(' · ') : '');
}
const loverOf = (st, id) => (st.lovers ? (st.lovers[0] === id ? st.lovers[1] : st.lovers[1] === id ? st.lovers[0] : null) : null);
const leftSec = (g, now) => Math.max(0, Math.round((g.deadline - now) / 5000) * 5);   // what the ⏳ shows: to 5 s, task jitter hidden
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
const RULES = [   // owner pick R1: a line per role + the flow + the win rule, plain text (~450 chars)
  '🐺 มนุษย์หมาป่า · กติกา',
  W.MIN_PLAYERS + '–' + W.MAX_PLAYERS + ' คน · บทลับส่งทาง DM',
  '🐺 หมาป่า กัด 1 คน/คืน · เห็นเพื่อนหมาป่า',
  '🔮 ผู้หยั่งรู้ ส่อง 1 คน ว่าเป็น 🐺 ไหม',
  '🛡️ บอดี้การ์ด คุ้มกัน 1 คน · ห้ามคนเดิม 2 คืนติด',
  '🧪 แม่มด 💚 ชุบ 1 + ☠️ พิษ 1 ทั้งเกม · 7 คนขึ้นไป',
  '🎲 เมื่อหัวห้องติ๊ก: 🏹 นักล่า ตายแล้วยิง 1 คนทันที · 💘 กามเทพ คืนแรกจับคู่รัก คนหนึ่งตายอีกคนตายตาม (6 คนขึ้นไป)',
  '😈 สมุน รู้จัก 🐺 ชนะกับ 🐺 · 🧱 ช่าง 2 คนรู้จักกัน (7 คนขึ้นไป) · 🃏 คนบ้า ชนะคนเดียวถ้าถูกโหวตออก',
  '👤 ชาวบ้าน ช่วยกันหา 🐺',
  '🌙 คืน ' + mmss(W.NIGHT_SEC) + ' → ☀️ เช้า บอกใครตาย (ไม่บอกบท) → 💬 คุย ' + mmss(W.TALK_DEFAULT) + ' → 🗳 โหวตลับ ' + mmss(W.VOTE_SEC) + ' · เสมอ = ไม่มีใครออก',
  '🏆 🐺 หมด = ชาวบ้านชนะ · 🐺 ≥ คนที่เหลือ = 🐺 ชนะ',
  '💀 ตายแล้วขอเงียบในกลุ่ม · เริ่ม /werewolf',
].join('\n');
const REMIND = (code) => '💤 ไม่ได้กด 2 รอบติดแล้ว · ยังเล่นอยู่ไหม?\nกดในข้อความถัดไปได้เลย · ห้อง ' + code;   // owner pick D1

const nameOf = (u) => (((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.username || 'ผู้เล่น').slice(0, 24);
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 24);
const hostNm = (g) => ((g.players || {})[g.host] || {}).name || g.hostName;   // the host may have renamed since opening the room
const seated = (g) => Object.entries(g.players || {}).sort((a, b) => a[1].seat - b[1].seat);
const bots = (g) => seated(g).filter(([id]) => isBotId(id));
const humans = (g) => seated(g).filter(([id]) => !isBotId(id));
const isGroup = (chat) => chat && (chat.type === 'group' || chat.type === 'supergroup');
const rows2 = (btns) => { const r = []; for (let i = 0; i < btns.length; i += 2) r.push(btns.slice(i, i + 2)); return r; };

function lobbyView(g, bot) {
  const list = humans(g).map(([, p]) => p.name), bl = bots(g).map(([, p]) => p.name);
  const n = list.length, total = n + bl.length;
  const text = '🐺 มนุษย์หมาป่า · ห้อง ' + g.code + '\n👥 ' + n + '/' + W.MAX_PLAYERS + (n ? ' · ' + list.join(', ') : '') +
    (bl.length ? '\n🤖 ' + bl.length + ' · ' + bl.join(' ') + ' · ' + LEVELS[g.level || 2] : '') +
    extraLine(g, total) +
    '\n' + (total >= W.MIN_PLAYERS ? '✅ ครบแล้ว หัวห้องกด ▸ เริ่ม' : '⏳ อีก ' + (W.MIN_PLAYERS - total) + ' คน · กติกา /rules' + (bl.length ? '' : ' · หรือเติม 🤖'));
  const rows = [];
  if (total < W.MAX_PLAYERS) rows.push([{ text: '▸ เข้าร่วม', url: 'https://t.me/' + bot + '?start=' + g.code }]);
  rows.push([{ text: '🤖 +1', callback_data: 'bot:+:' + g.code }, { text: '🤖 −1', callback_data: 'bot:-:' + g.code }, { text: LEVELS[g.level || 2], callback_data: 'lvl:' + g.code }]);
  const ex = extrasOf(g);   // 🎲 row B: a toggle per extra role, then the mode chip once two are ticked
  rows.push(Object.keys(EXTRAS).map((r) => ({ text: W.EMOJI[r] + (ex.includes(r) ? ' ✓' : ''), callback_data: 'x:' + r + ':' + g.code })));
  if (ex.length > 1) rows.push([{ text: modeOf(g) === 'one' ? '🎲 สุ่ม 1 จากที่ติ๊ก' : '🎲 ใส่ทุกบทที่ติ๊ก', callback_data: 'xm:' + g.code }]);
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
  if (role === 'minion') t += '\n🐺 หมาป่าในเกมนี้: ' + Object.keys(roles).filter((id) => roles[id] === 'wolf').map((id) => players[id].name).join(', ') +
    '\nไม่มีพลังกลางคืน · ช่วยหมาป่าตอนกลางวัน โดยไม่ให้ใครสงสัยว่าคุณรู้มากเกินไป\n🏆 ชนะพร้อม 🐺 · ถ้าคุณตาย 🐺 ยังชนะได้';
  if (role === 'mason') {
    const other = Object.keys(roles).find((id) => id !== me && roles[id] === 'mason');
    t += '\n🧱 อีกคน: ' + (other ? players[other].name : 'ไม่มี') + ' · ไว้ใจกันได้ 100%';
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
    if (o.body && isBotId(o.body.chat_id)) continue;   // a bot seat has no chat
    const r = await safe(deps, o.method, o.body);
    if (!r && o.dm) missed.push(o.dm);
    if (r && r.message_id && o.save) await deps.db.collection('wolf_games').doc(g.code).update({ [o.save]: r.message_id });
  }
  if (missed.length) await safe(deps, 'sendMessage', { chat_id: g.chatId, text: '⚠️ ส่ง DM ไม่ถึง: ' + [...new Set(missed)].join(', ') + ' · เปิดแชทกับบอทแล้วกด Start' });
  await armClock(deps, g);
}
/* C1: at a phase start enqueue one task per STEP_SEC and one at the deadline, once per phase (g.clock = 'status:round').
   deps.tasks(name, delaySec, body) must treat an existing name as done (409). An enqueue failure is logged, not thrown:
   wolfTick still ends the phase within a minute. */
async function armClock(deps, g) {
  const key = g.status + ':' + g.round;
  if (!deps.tasks || !LIVE.includes(g.status) || !g.deadline || g.clock === key) return;
  const total = Math.round((g.deadline - deps.now) / 1000);
  const steps = [];
  for (let t = STEP_SEC; t < total; t += STEP_SEC) steps.push(t);
  steps.push(total);
  try {
    for (const t of steps) await deps.tasks('w-' + g.code + '-' + g.status + '-' + g.round + '-' + t, t, { code: g.code, key });
    g.clock = key;
    await deps.db.collection('wolf_games').doc(g.code).update({ clock: key });
  } catch (e) { console.error('[wolfClock] ' + (e && e.message)); }
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
    const ht = await tx.get(db.collection('wolf_tg').doc(host));
    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      let k = ''; for (let j = 0; j < 6; j++) k += CODE_ABC[Math.floor(deps.rng() * CODE_ABC.length)];
      if (!(await tx.get(db.collection('wolf_games').doc(k))).exists) code = k;
    }
    if (!code) throw new Error('no free code');
    const g = { code, chatId, host, hostName: (ht.exists && ht.data().name) || nameOf(msg.from), status: 'lobby', players: {}, talkSec: W.TALK_DEFAULT, round: 0, msgId: null, deadline: null, createdAt: deps.now, updatedAt: deps.now };
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
    const name = (t.exists && t.data().name) || nameOf(msg.from);
    d.players[me] = { name, seat, alive: true };
    tx.update(gRef, { players: d.players, updatedAt: deps.now });
    tx.set(tgRef, { game: code, updatedAt: deps.now }, { merge: true });   // keep .name
    return { say: '✅ เข้าห้อง ' + code + ' แล้ว · ที่นั่ง ' + seat + ' · รอหัวห้องกด ▸ เริ่ม\n🏷 ชื่อในเกม: ' + name + '\nเปลี่ยน? พิมพ์ชื่อใหม่มาเลย (ก่อนเกมเริ่ม) · จำไว้ให้เกมหน้า', g: d };
  });
  await safe(deps, 'sendMessage', { chat_id: me, text: res.say });
  if (res.g && res.g.msgId) await safe(deps, 'editMessageText', Object.assign({ chat_id: res.g.chatId, message_id: res.g.msgId }, lobbyView(res.g, bot)));
}

// ---- a plain DM = the player's in-game name (owner pick B, 2026-11-26) ---------------------------------------------------
async function rename(msg, deps) {
  const { db } = deps;
  const me = String(msg.from.id), name = cleanName(msg.text);
  if (!name) return;
  const bot = await deps.botName();
  const tgRef = db.collection('wolf_tg').doc(me);
  const res = await db.runTransaction(async (tx) => {
    const t = await tx.get(tgRef);
    const code = t.exists ? t.data().game : null;
    const gRef = code ? db.collection('wolf_games').doc(code) : null;
    const g = gRef ? await tx.get(gRef) : null;
    const d = g && g.exists ? g.data() : null;
    const mine = !!(d && d.players[me]);
    if (mine && d.status === 'lobby') {
      if (seated(d).some(([id, p]) => id !== me && p.name === name)) return { say: '⚠️ มีคนชื่อ ' + name + ' ในห้องแล้ว · เลือกชื่ออื่น' };
      d.players[me].name = name;
      tx.update(gRef, { players: d.players, updatedAt: deps.now });
      tx.set(tgRef, { name, updatedAt: deps.now }, { merge: true });
      return { say: '🏷 ชื่อในเกม: ' + name + ' · จำไว้ให้เกมหน้าด้วย', g: d };
    }
    tx.set(tgRef, { name, updatedAt: deps.now }, { merge: true });
    return { say: '🏷 ชื่อในเกม: ' + name + (mine && LIVE.includes(d.status) ? ' · เกมนี้เริ่มแล้ว ใช้เกมหน้า' : ' · ใช้ตอนเข้าห้องครั้งหน้า') };
  });
  await safe(deps, 'sendMessage', { chat_id: me, text: res.say });
  if (res.g && res.g.msgId) await safe(deps, 'editMessageText', Object.assign({ chat_id: res.g.chatId, message_id: res.g.msgId }, lobbyView(res.g, bot)));
}

// ---- the game loop (pure over g = the game doc, st = secret/state; each returns the messages to send) -----------------------
const nm = (g, id) => (g.players[id] ? g.players[id].name + (isBotId(id) ? ' 🤖' : '') : '?');
/* What wolf-ai.js reads: the seats, which are bots, the level, the day and the bots' memory in st.ai. */
function aiView(g, st) {
  const ids = seated(g).map(([id]) => id);
  st.ai = st.ai || { checks: {}, claims: [], said: [], votes: [] };
  return { id: g.code, me: '-', bots: ids.filter(isBotId), level: g.level || 2, day: g.round, ids, st, checks: st.ai.checks, claims: st.ai.claims, said: st.ai.said, votes: st.ai.votes };
}
/* The bots' night: every bot with a night role picks now (the 🧪 waits for the bite, see afterWolves). */
function botNight(g, st, out, rng) {
  if (!bots(g).length) return;
  const v = aiView(g, st), p = st.picks;
  const cupid = Object.keys(W.nightTurns(st)).find((id) => isBotId(id) && W.nightTurns(st)[id] === 'cupid');
  if (cupid) { const pr = AI.cupidPick(v, cupid, rng); if (pr && !W.loversError(st, pr[0], pr[1])) { Object.assign(st, W.setLovers(st, pr[0], pr[1])); loversDm(g, st, out); } }
  const wv = AI.wolfVotes(v, rng);
  Object.keys(wv).forEach((b) => {
    let x = wv[b];
    if (x === loverOf(st, b)) x = liveIds(st).find((id) => st.roles[id] !== 'wolf' && id !== x) || null;   // never bite your lover
    if (x && !W.pickError(st, b, 'wolf', x)) p.wolf[b] = x;
  });
  const t = W.nightTurns(st);
  for (const id of Object.keys(t)) {
    if (!isBotId(id)) continue;
    if (t[id] === 'seer' && !p.seer) {
      const x = AI.seerPick(v, id, rng);
      if (x && !W.pickError(st, id, 'seer', x)) { p.seer = x; st.ai.checks[id] = Object.assign(st.ai.checks[id] || {}, { [x]: st.roles[x] === 'wolf' }); } else p.seer = 'none';
    }
    if (t[id] === 'guard' && !p.guard) { const x = AI.guardPick(v, id, rng); p.guard = x && !W.pickError(st, id, 'guard', x) ? x : 'none'; }
  }
  if (wolvesDone(st)) afterWolves(g, st, out, rng);   // every wolf is a bot: the bite is fixed now, a human 🧪 gets her menu
}
/* One line of table talk for the ☀️ message (owner pick 2B): the solo tags, bots that stay quiet are not named. */
function botTalk(g, st) {
  if (!bots(g).length) return '';
  const v = aiView(g, st), t = AI.talk(v), parts = [];
  t.claims.forEach((c) => { if (isBotId(c.by)) st.ai.claims.push(c); });
  for (const [id, p] of bots(g)) {
    const tag = st.alive[id] ? t.tags[id] : null;
    if (!tag || tag.k === 'quiet') continue;
    if (tag.k === 'claim') parts.push(p.name + ' 🔮 ' + nm(g, tag.t) + (tag.wolf ? ' = 🐺' : ' ไม่ใช่ 🐺'));
    else { parts.push(p.name + (tag.k === 'sus' ? ' 🤨 ' : ' 👍 ') + nm(g, tag.t)); st.ai.said.push({ day: g.round, by: id, k: tag.k, t: tag.t, soft: !!tag.soft }); }
  }
  return parts.length ? '🤖 ' + parts.join(' · ') : '';
}
/* The bots' ballots, cast the moment the vote opens (owner pick 3). */
function botVote(g, st) {
  if (!bots(g).length) return;
  const vt = AI.votes(aiView(g, st));
  bots(g).forEach(([id]) => {
    if (!st.alive[id] || !vt[id]) return;
    const t = vt[id] !== 'skip' && st.alive[vt[id]] && vt[id] !== id && vt[id] !== loverOf(st, id) ? vt[id] : 'skip';   // never vote your lover
    st.ballot[id] = t; st.ai.votes.push({ day: g.round, by: id, t });
  });
}
const liveIds = (st) => W.aliveIds(st.alive);
/* Who may be picked by actor for kind tonight, as menu buttons. */
function menu(g, st, actor, kind) {
  return seated(g).map(([id]) => id).filter((id) => !W.pickError(st, actor, kind, id))
    .map((id) => ({ text: (kind === 'poison' ? '☠️ ' : '') + nm(g, id), callback_data: 'n:' + g.code + ':' + g.round + ':' + kind + ':' + id }));
}
const ASK = { wolf: '🐺 คืนนี้กัดใคร? (เลือกแล้วเปลี่ยนไม่ได้)', seer: '🔮 คืนนี้ส่องใคร?', guard: '🛡️ คืนนี้คุ้มกันใคร?', cupid: '💘 เลือกคู่รักคนแรก (เลือกตัวเองได้)' };
/* 💘 both lovers hear it (a bot lover has no chat; run() skips it). */
function loversDm(g, st, out) {
  const [a, b] = st.lovers;
  [[a, b], [b, a]].forEach(([me, other]) => out.push({ method: 'sendMessage', body: { chat_id: me, text: '💘 คุณกับ ' + nm(g, other) + ' เป็นคู่รัก · คนหนึ่งตาย อีกคนตายตาม · ถ้าอยู่คนละฝ่าย ชนะด้วยกันเมื่อเหลือแค่ 2 คน' }, dm: nm(g, me) }));
}
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
    if (k === 'cupid') return !!st.lovers;
    return true;
  });
}
/* After the last wolf has chosen: fix tonight's bite and hand the witch her menu (she sees who was bitten). */
function afterWolves(g, st, out, rng) {
  st.picks.bite = W.wolfTarget(st.picks.wolf, rng);
  const witch = W.withRole(st.roles, st.alive, 'witch')[0];
  if (witch && isBotId(witch)) {
    const wp = AI.witchPick(aiView(g, st), witch, st.picks.bite, rng);
    st.picks.heal = !!(wp.heal && st.picks.bite); st.picks.poison = wp.poison && !W.pickError(st, witch, 'poison', wp.poison) ? wp.poison : null; st.picks.witchDone = true;
    return;
  }
  if (witch && (st.witch.heal || st.witch.poison)) {
    st.picks.witchAsked = true;
    out.push({ method: 'sendMessage', body: Object.assign({ chat_id: witch }, witchView(g, st)), dm: nm(g, witch) });
  }
  else st.picks.witchDone = true;
}
const nightView = (g, left) => ({ text: '🌙 คืนที่ ' + g.round + ' · ⏳ ' + mmss(left) + '\n💤 หลับตา · คนมีบทดู DM' });
/* The ☀️ line (g.dayLead = who died, set by finishNight) with the talk time left and the host's 🗳 button. */
const dayView = (g, st, left) => ({ text: '☀️ เช้าวันที่ ' + g.round + ' · ' + (g.dayLead || '') + (g.botSay ? '\n' + g.botSay : '') + '\n👥 ' + liveIds(st).length + ' · 💬 คุย ' + mmss(left),
  reply_markup: { inline_keyboard: [[{ text: '🗳 โหวตเลย (หัวห้อง)', callback_data: 'talk:' + g.code + ':' + g.round }]] } });
function beginNight(g, st, now, out, rng) {
  g.status = 'night'; g.deadline = now + W.NIGHT_SEC * 1000;
  st.picks = { wolf: {}, bite: null, seer: null, guard: null, heal: false, poison: null, witchDone: false };
  out.push({ method: 'sendMessage', body: Object.assign({ chat_id: g.chatId }, nightView(g, W.NIGHT_SEC)), save: 'phaseMsgId' });
  botNight(g, st, out, rng);
  const turns = W.nightTurns(st);
  for (const id of Object.keys(turns)) {
    const k = turns[id];
    if (k === 'witch' || isBotId(id)) continue;   // the witch after the wolves; bots picked above
    const btns = menu(g, st, id, k);
    if (!btns.length) { if (k === 'guard') st.picks.guard = 'none'; if (k === 'seer') st.picks.seer = 'none'; continue; }
    let ask = ASK[k];
    if (k === 'wolf') Object.keys(st.picks.wolf).filter(isBotId).forEach((b) => {   // a bot mate's wish, as in the solo game (pick A + D)
      const why = (g.level || 2) === 3 ? AI.wolfWhy(aiView(g, st), st.picks.wolf[b]) : null;
      ask += '\n' + nm(g, b) + ' อยากกัด ' + nm(g, st.picks.wolf[b]) + (why ? ' · ' + why : '');
    });
    out.push({ method: 'sendMessage', body: { chat_id: id, text: ask, reply_markup: { inline_keyboard: rows2(btns) } }, dm: nm(g, id) });
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
  if (!st.lovers && W.withRole(st.roles, st.alive, 'cupid').length) {   // 💘 the cupid never pressed: the clock pairs at random
    const ids = liveIds(st), i = Math.floor(rng() * ids.length), a = ids.splice(i, 1)[0], b = ids[Math.floor(rng() * ids.length)];
    Object.assign(st, W.setLovers(st, a, b)); loversDm(g, st, out);
  }
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
  const heart = st.lovers && st.lovers.every((id) => r.dead.includes(id)) ? ' 💔 คู่รักตายตามกัน' : '';
  const deadTxt = r.dead.length ? 'เมื่อคืน 💀 ' + r.dead.map((id) => nm(g, id)).join(', ') + ' ตาย' + heart + QUIET : 'คืนสงบ ไม่มีใครตาย';
  r.dead.forEach((id) => out.push({ method: 'sendMessage', body: { chat_id: id, text: '💀 คุณตายเมื่อคืน · ดูเกมต่อได้ แต่ขอเงียบในกลุ่มจนจบนะ 🤐' } }));
  if (endIf(g, st, out, '☀️ เช้าวันที่ ' + g.round + ' · ' + deadTxt)) return;
  remind(g, st, missed, out);
  let lead = deadTxt;
  const hunter = r.dead.find((id) => st.roles[id] === 'hunter');
  if (hunter) {
    const line = hunterTurn(g, st, now, out, hunter, 'day', deadTxt);
    if (line === null) return;   // a human 🏹 aims first; the day starts after the shot
    lead += '\n' + line;
    if (endIf(g, st, out, '☀️ เช้าวันที่ ' + g.round + ' · ' + lead)) return;
  }
  beginDay(g, st, now, out, lead);
}
/* ☀️ the talk. lead = who died (+ the 🏹 line). editId = the shot message to turn into the day message. */
function beginDay(g, st, now, out, lead, editId) {
  g.status = 'day'; g.deadline = now + (g.talkSec || W.TALK_DEFAULT) * 1000; g.dayLead = lead; g.botSay = botTalk(g, st);
  const body = Object.assign({ chat_id: g.chatId }, dayView(g, st, g.talkSec || W.TALK_DEFAULT));
  if (editId) out.push({ method: 'editMessageText', body: Object.assign({ message_id: editId }, body) });
  else out.push({ method: 'sendMessage', body, save: 'phaseMsgId' });
}
// ---- 🏹 the hunter's shot ------------------------------------------------------------------------------------------------
const shotView = (g, left) => ({ text: (g.shot.then === 'day' ? '☀️ เช้าวันที่ ' + g.round + ' · ' + g.shot.lead + '\n' : '') + '🏹 ' + nm(g, g.shot.who) + ' เป็นนักล่า · เล็งปืนอยู่ ⏳ ' + mmss(left) });
/* Apply the shot (target null = none) and say so. */
function shotLine(g, st, hunter, target) {
  if (target && !W.shotError(st, hunter, target)) {
    const before = liveIds(st);
    Object.assign(st, W.eliminate(st, target, 'shot'));   // a shot 🃏 does not win
    const gone = before.filter((id) => !st.alive[id]); gone.forEach((id) => { g.players[id].alive = false; });
    const lover = gone.find((id) => id !== target);
    return '🏹 ' + nm(g, hunter) + ' ยิง ' + nm(g, target) + ' 💀' + (lover ? ' · 💔 ' + nm(g, lover) + ' ตายตาม' : '');
  }
  return '🏹 ' + nm(g, hunter) + ' ไม่ได้ยิงใคร';
}
/* The hunter just died. A bot shoots at once (returns the line); a human gets SHOT_SEC and a DM menu (status 'shot', returns
   null) — then = 'day' (died at night, lead = the morning line) or 'night' (voted out). */
function hunterTurn(g, st, now, out, hunter, then, lead) {
  if (isBotId(hunter)) return shotLine(g, st, hunter, AI.hunterPick(aiView(g, st), hunter));
  g.status = 'shot'; g.deadline = now + SHOT_SEC * 1000; g.shot = { who: hunter, then, lead };
  out.push({ method: 'sendMessage', body: Object.assign({ chat_id: g.chatId }, shotView(g, SHOT_SEC)), save: 'phaseMsgId' });
  const btns = seated(g).map(([id]) => id).filter((id) => !W.shotError(st, hunter, id)).map((id) => ({ text: nm(g, id), callback_data: 'h:' + g.code + ':' + g.round + ':' + id }));
  out.push({ method: 'sendMessage', body: { chat_id: hunter, text: '🏹 คุณเป็นนักล่า · ยิงใครก่อนไป? ⏳ ' + mmss(SHOT_SEC), reply_markup: { inline_keyboard: rows2(btns) } }, dm: nm(g, hunter) });
  return null;
}
/* The human's press (target) or the clock (null): say it, then the day (the shot message becomes the ☀️ message) or the next night. */
function resolveShot(g, st, now, out, target, rng) {
  const { who, then, lead } = g.shot;
  const line = shotLine(g, st, who, target);
  g.shot = null;
  const edit = (text) => { if (g.phaseMsgId) out.push({ method: 'editMessageText', body: { chat_id: g.chatId, message_id: g.phaseMsgId, text } }); };
  if (then === 'day') {
    const full = lead + '\n' + line;
    if (W.winner(st)) { edit('☀️ เช้าวันที่ ' + g.round + ' · ' + full); endIf(g, st, out, line); return; }
    beginDay(g, st, now, out, full, g.phaseMsgId);
  } else {
    edit(line);
    if (endIf(g, st, out, line)) return;
    g.round += 1; g.voteMsgId = null;
    beginNight(g, st, now, out, rng);
  }
}
function voteView(g, st, left) {
  const live = seated(g).map(([id]) => id).filter((id) => st.alive[id]);
  const btns = live.map((id) => ({ text: nm(g, id), callback_data: 'v:' + g.code + ':' + g.round + ':' + id }));
  btns.push({ text: '⏭ ข้าม', callback_data: 'v:' + g.code + ':' + g.round + ':skip' });
  const n = Object.keys(st.ballot || {}).length, nb = live.filter(isBotId).length;
  return { text: '🗳 โหวตลับ วันที่ ' + g.round + ' · ⏳ ' + mmss(left) + ' · เปลี่ยนได้\n✅ ' + n + '/' + live.length + (nb ? ' · 🤖 ลงแล้ว' : ''), reply_markup: { inline_keyboard: rows2(btns) } };
}
function beginVote(g, st, now, out) {
  g.status = 'vote'; g.deadline = now + W.VOTE_SEC * 1000; st.ballot = {};
  botVote(g, st);
  out.push({ method: 'sendMessage', body: Object.assign({ chat_id: g.chatId }, voteView(g, st, W.VOTE_SEC)), save: 'voteMsgId' });
}
function finishVote(g, st, now, out, rng) {
  const acted = {};
  liveIds(st).forEach((id) => { acted[id] = id in (st.ballot || {}); });
  const missed = countMiss(st, acted);
  const t = W.tallyVotes(st, st.ballot || {});
  const parts = Object.keys(t.counts).filter((k) => k !== 'skip').sort((a, b) => t.counts[b] - t.counts[a]).map((id) => nm(g, id) + ' ' + t.counts[id]);
  if (t.counts.skip) parts.push('⏭ ข้าม ' + t.counts.skip);
  let txt = '🗳 ผลโหวต วันที่ ' + g.round + '\n' + (parts.length ? parts.join(' · ') : 'ไม่มีใครโหวต');   // owner pick Q5: counts only
  let gone = [];
  if (t.out) {
    const before = liveIds(st);
    Object.assign(st, W.eliminate(st, t.out, 'vote'));   // a voted-out 🃏 wins (engine jesterWin)
    gone = before.filter((id) => !st.alive[id]); gone.forEach((id) => { g.players[id].alive = false; });
    const lover = gone.find((id) => id !== t.out);
    txt += '\n👋 ' + nm(g, t.out) + ' ออกจากหมู่บ้าน' + (lover ? ' · 💔 ' + nm(g, lover) + ' ตายตาม' : '') + QUIET;
  } else txt += '\n🤝 เสมอ · ไม่มีใครออก';
  delete st.ballot;
  if (g.voteMsgId) out.push({ method: 'editMessageText', body: { chat_id: g.chatId, message_id: g.voteMsgId, text: '🗳 ปิดโหวตวันที่ ' + g.round } });
  if (endIf(g, st, out, txt)) return;
  out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: txt } });
  remind(g, st, missed, out);
  const hunter = gone.find((id) => st.roles[id] === 'hunter');
  if (hunter) {
    const line = hunterTurn(g, st, now, out, hunter, 'night', '');
    if (line === null) return;   // a human 🏹 aims first; the night starts after the shot
    if (endIf(g, st, out, line)) return;
    out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: line } });
  }
  g.round += 1; g.voteMsgId = null;
  beginNight(g, st, now, out, rng);
}
/* The end: the winner and every role (the only group text that ever names roles). */
function endIf(g, st, out, lead) {
  const w = W.winner(st);
  if (!w) return false;
  g.status = 'over'; g.deadline = null; g.winner = w;
  const faked = (id) => !!(st.ai && st.ai.claims.some((c) => c.fake && c.by === id));
  const inLove = (id) => !!(st.lovers && st.lovers.includes(id));
  const list = seated(g).map(([id]) => W.EMOJI[st.roles[id]] + ' ' + nm(g, id) + (inLove(id) ? ' 💘' : '') + (faked(id) ? ' 🤥' : '') + (st.alive[id] ? '' : ' 💀')).join('\n');
  const who = w === 'wolf' ? '🐺 หมาป่าชนะ!' : w === 'lovers' ? '💘 คู่รักชนะ!' : w === 'jester' ? '🃏 คนบ้าชนะ! · ' + nm(g, st.jesterWin) + ' หลอกทุกคนได้' : '🏆 ฝั่งชาวบ้านชนะ!';
  out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: lead + '\n\n' + who + '\n' + list + '\n\nเล่นอีก พิมพ์ /werewolf' } });
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
    for (const id of Object.keys(g.players)) if (!isBotId(id)) tx.set(db.collection('wolf_tg').doc(id), { game: null, updatedAt: now }, { merge: true });
  }
}

// ---- buttons -----------------------------------------------------------------------------------------------------------
async function onButton(q, deps) {
  const parts = String(q.data || '').split(':');
  if (parts[0] === 'n') return onNight(q, parts, deps);
  if (parts[0] === 'v') return onVote(q, parts, deps);
  if (parts[0] === 'talk') return onTalkEnd(q, parts, deps);
  if (['bot', 'lvl', 'extra', 'x', 'xm'].includes(parts[0])) return onLobbyBots(q, parts, deps);
  if (parts[0] === 'h') return onShot(q, parts, deps);
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
    if (d.host !== me) return { say: 'เฉพาะหัวห้อง (' + hostNm(d) + ') กดได้' };
    if (kind === 'cancel') {
      if (['over', 'cancelled'].includes(d.status)) return { say: 'ห้องนี้ปิดแล้ว' };
      tx.update(gRef, { status: 'cancelled', deadline: null, updatedAt: deps.now });
      tx.set(db.collection('wolf_chats').doc(d.chatId), { game: null, updatedAt: deps.now });
      for (const id of Object.keys(d.players)) if (!isBotId(id)) tx.set(db.collection('wolf_tg').doc(id), { game: null, updatedAt: deps.now }, { merge: true });
      return { g: d, cancelled: true, live: LIVE.includes(d.status) };
    }
    if (d.status !== 'lobby') return { say: 'เกมเริ่มไปแล้ว' };
    const ids = seated(d).map(([id]) => id);
    if (ids.length < W.MIN_PLAYERS) return { say: 'ต้องมีอย่างน้อย ' + W.MIN_PLAYERS + ' คน (ตอนนี้ ' + ids.length + ')' };
    if (!humans(d).length) return { say: 'ต้องมีคนจริงอย่างน้อย 1 คน' };
    const ex = extrasOf(d);   // 🎲 row B: every ticked role that fits the seats, or one fitting role at random (shown in the deck line, pick 4A)
    let pick = null;
    if (modeOf(d) === 'one' && ex.length > 1) { const fit = ex.filter((r) => extraPlan(d, ids.length, r).used.length); pick = fit.length ? fit[Math.floor(deps.rng() * fit.length)] : '-'; }
    const counts = extraPlan(d, ids.length, pick).counts;
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
/* 🤖 +1 / −1 and the level chip in the lobby (owner pick 1A): host only, humans + bots ≤ 10, names from BOT_NAMES in order.
   Also the 🎲 row: x:<role>:<code> toggles a role, xm:<code> flips the mode; an old message's extra:<code> chip just redraws. */
async function onLobbyBots(q, parts, deps) {
  const { db } = deps;
  const code = parts[0] === 'bot' || parts[0] === 'x' ? parts[2] : parts[1], me = String(q.from.id);
  const bot = await deps.botName();
  const gRef = db.collection('wolf_games').doc(code || '-');
  const res = await db.runTransaction(async (tx) => {
    const gs = await tx.get(gRef);
    if (!gs.exists) return { say: 'ไม่พบห้องนี้' };
    const g = gs.data();
    if (g.host !== me) return { say: 'เฉพาะหัวห้อง (' + hostNm(g) + ') กดได้' };
    if (g.status !== 'lobby') return { say: 'เกมเริ่มไปแล้ว' };
    if (parts[0] === 'x') {
      const r = parts[1], ex = extrasOf(g);
      if (!EXTRAS[r]) return { say: '?' };
      g.extras = ex.includes(r) ? ex.filter((x) => x !== r) : Object.keys(EXTRAS).filter((x) => ex.includes(x) || x === r);
    } else if (parts[0] === 'xm') g.extraMode = modeOf(g) === 'one' ? 'all' : 'one';
    else if (parts[0] === 'extra') { /* an old lobby message's chip: redraw with the row */ }
    else if (parts[0] === 'lvl') g.level = ((g.level || 2) % 3) + 1;
    else if (parts[1] === '+') {
      if (seated(g).length >= W.MAX_PLAYERS) return { say: 'เต็มแล้ว (' + W.MAX_PLAYERS + ' ที่)' };
      const used = seated(g).map(([, p]) => p.name);
      let k = 1; while (g.players['bot' + k]) k++;
      const name = BOT_NAMES.find((x) => !used.includes(x)) || ('บอท' + k);
      g.players['bot' + k] = { name, seat: Math.max(0, ...Object.values(g.players).map((p) => p.seat)) + 1, alive: true, bot: true };
    } else {
      const last = bots(g).pop();
      if (!last) return { say: 'ยังไม่มีบอทในห้อง' };
      delete g.players[last[0]];
    }
    g.extras = extrasOf(g); g.extraMode = modeOf(g);
    tx.update(gRef, { players: g.players, level: g.level || 2, extras: g.extras, extraMode: g.extraMode, updatedAt: deps.now });
    return { g };
  });
  await safe(deps, 'answerCallbackQuery', { callback_query_id: q.id, text: res.say, show_alert: !!res.say });
  if (res.g && res.g.msgId) await safe(deps, 'editMessageText', Object.assign({ chat_id: res.g.chatId, message_id: res.g.msgId }, lobbyView(res.g, bot)));
}

/* 🏹 the dead hunter's button: h:<code>:<round>:<target>. */
async function onShot(q, parts, deps) {
  const { db } = deps;
  const [, code, round, arg] = parts;
  const me = String(q.from.id);
  const gRef = db.collection('wolf_games').doc(code || '-');
  const dmMsg = q.message ? { chat_id: q.message.chat.id, message_id: q.message.message_id } : null;
  const res = await db.runTransaction(async (tx) => {
    const gs = await tx.get(gRef);
    const ss = await tx.get(gRef.collection('secret').doc('state'));
    if (!gs.exists || !ss.exists) return { say: 'ไม่พบห้องนี้' };
    const g = gs.data(), st = ss.data();
    if (g.status === 'cancelled') return { say: 'เกมนี้ถูกยกเลิกแล้ว' };
    if (g.status !== 'shot' || String(g.round) !== round || !g.shot) return { say: 'หมดเวลายิงแล้ว' };
    if (g.shot.who !== me) return { say: 'ไม่ใช่ตาคุณ' };
    if (W.shotError(st, me, arg)) return { say: 'ยิงคนนี้ไม่ได้' };
    const out = [];
    if (dmMsg) out.push({ method: 'editMessageText', body: Object.assign({}, dmMsg, { text: '🏹 คุณยิง ' + nm(g, arg) }) });
    resolveShot(g, st, deps.now, out, arg, deps.rng);
    commit(tx, db, gRef, g, st, deps.now);
    return { g, out };
  });
  await safe(deps, 'answerCallbackQuery', { callback_query_id: q.id, text: res.say, show_alert: !!res.say });
  if (res.out) await run(deps, res.g, res.out);
}

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
    } else if (kind === 'cupid') {
      if (role !== 'cupid') return { say: 'ไม่ใช่บทของคุณ' };
      if (st.lovers) return { say: 'จับคู่ไปแล้ว' };
      if (W.pickError(st, me, 'cupid', arg)) return { say: 'เลือกคนนี้ไม่ได้' };
      if (!p.cupid1) {
        p.cupid1 = arg;
        const btns = menu(g, st, me, 'cupid').filter((b) => !b.callback_data.endsWith(':' + arg));
        if (dmMsg) out.push({ method: 'editMessageText', body: Object.assign({}, dmMsg, { text: '💘 คนแรก ' + nm(g, arg) + ' · เลือกคนที่สอง', reply_markup: { inline_keyboard: rows2(btns) } }) });
      } else {
        if (W.loversError(st, p.cupid1, arg)) return { say: 'เลือกซ้ำ' };
        Object.assign(st, W.setLovers(st, p.cupid1, arg));
        edit = '💘 จับคู่ ' + nm(g, p.cupid1) + ' ❤ ' + nm(g, arg) + ' แล้ว';
        loversDm(g, st, out);
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
    else if (g.voteMsgId) out.push({ method: 'editMessageText', body: Object.assign({ chat_id: g.chatId, message_id: g.voteMsgId }, voteView(g, st, leftSec(g, deps.now))) });
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
    if (g.host !== String(q.from.id)) return { say: 'เฉพาะหัวห้อง (' + hostNm(g) + ') กดได้' };
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
  if (g.warned === key || g.status === 'vote' || g.status === 'shot') return false;   // the vote (1:00) and the shot (0:30) get no warning
  g.warned = key;
  if (g.status === 'day') out.push({ method: 'sendMessage', body: { chat_id: g.chatId, text: '⏳ เหลือ ~1 นาที · แล้วโหวต 🗳' } });
  else {
    const acted = nightActed(st);
    Object.keys(acted).filter((id) => !acted[id]).forEach((id) => out.push({ method: 'sendMessage', body: { chat_id: id, text: '⏳ เหลือ ~1 นาที · ยังไม่ได้เลือกคืนนี้ ☝️' } }));
  }
  return true;
}
/* C1: one Cloud Task for room code at step key = 'status:round' (wolfPhase). A step edits the phase message's ⏳ (and gives the
   one-minute warning when due); the last one ends the phase on the second. Stale (the phase already moved on) → nothing. */
async function phase(body, deps) {
  const { db } = deps;
  const code = String((body || {}).code || ''), key = String((body || {}).key || '');
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  const gRef = db.collection('wolf_games').doc(code);
  const res = await db.runTransaction(async (tx) => {
    const gs = await tx.get(gRef);
    const ss = await tx.get(gRef.collection('secret').doc('state'));
    if (!gs.exists || !ss.exists) return null;
    const g = gs.data(), st = ss.data();
    if (g.status + ':' + g.round !== key || !LIVE.includes(g.status) || !g.deadline) return null;
    const out = [];
    if (g.deadline - deps.now > 2000) {
      const left = leftSec(g, deps.now);
      const warned = left <= WARN_SEC && warn(g, st, out);
      const edit = (id, view) => id && out.push({ method: 'editMessageText', body: Object.assign({ chat_id: g.chatId, message_id: id }, view) });
      if (g.status === 'night') edit(g.phaseMsgId, nightView(g, left));
      else if (g.status === 'day') edit(g.phaseMsgId, dayView(g, st, left));
      else if (g.status === 'shot') edit(g.phaseMsgId, shotView(g, left));
      else edit(g.voteMsgId, voteView(g, st, left));
      if (warned) commit(tx, db, gRef, g, st, deps.now);
      return { g, out, step: true };
    }
    if (g.status === 'night') finishNight(g, st, deps.now, out, deps.rng);
    else if (g.status === 'day') beginVote(g, st, deps.now, out);
    else if (g.status === 'shot') resolveShot(g, st, deps.now, out, null, deps.rng);
    else finishVote(g, st, deps.now, out, deps.rng);
    commit(tx, db, gRef, g, st, deps.now);
    return { g, out };
  });
  if (res) await run(deps, res.g, res.out);
  return res;
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
      else if (g.status === 'shot') resolveShot(g, st, deps.now, out, null, deps.rng);
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
  if (msg.chat.type === 'private' && !cmdRaw.startsWith('/')) return rename(msg, deps);
}

module.exports = { handle, tick, phase, lobbyView, startedView, roleCard, ROLE_CARD, RULES, STEP_SEC, SHOT_SEC, BOT_NAMES, LEVELS, EXTRAS, EXTRA_MIN };
