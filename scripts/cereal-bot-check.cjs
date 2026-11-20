// 🥣 Cereal Killer Phase 1½: public/cereal-bot.js plays 200 seeded games against itself through the real engine (harness shape C).
// Every bot action is re-validated by cereal-rules.js (a bot never submits an illegal move, kill, witness, question or arrest); the
// detective bot's candidate set always contains the killer's true cell; every game ends by day 7 for one of the rulebook's reasons;
// the win rates per level land in sane bands (a 🥄🥄🥄 detective catches a 🥄🥄 killer more often than a 🥄 detective does, nobody
// wins everything); a full game runs in well under 50 ms. Nothing leaves node.
const assert = require('node:assert/strict');
const MAPS = require('../public/cereal-maps.js');
const R = require('../public/cereal-rules.js');
const B = require('../public/cereal-bot.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function play(map, lk, ld, rng) {
    const st = { day: 1, pos: null, detectivePos: null, cereals: [], kills: 0, skipUsed: false, witness: null, usedQuestions: [], arrestsLeft: R.ARRESTS };
    const k = B.newKnowledge(map); let asked = 0;
    for (; st.day <= R.DAYS; st.day++) {
        // --- killer ---
        const blocked = st.detectivePos != null ? [st.detectivePos] : [];
        if (st.pos != null && R.cornered(map, st.pos, blocked)) return { winner: 'good', reason: 'cornered', day: st.day, asked };
        const turn = B.killerTurn(map, { pos: st.pos, detectivePos: st.detectivePos, cereals: st.cereals, kills: st.kills, skipUsed: st.skipUsed, day: st.day }, lk, rng);
        if (!turn) {   // no legal turn: every path lacks a fresh house and the quiet day is spent
            assert.ok(st.skipUsed && !R.legalPaths(map, st.pos, 3, { exact: true, blocked }).some(p => R.killOptions(map, p, st.cereals).length), 'the bot only gives up when the rules leave it no move');
            return { winner: 'good', reason: 'cornered', day: st.day, asked };
        }
        if (st.pos == null) { assert.equal(R.type(map, turn.home), 'H', 'home is a house'); st.pos = turn.home; }
        assert.equal(turn.path[0], st.pos, 'path starts where the killer stands');
        const v = R.validateKillerTurn(map, turn, { blocked, taken: st.cereals, kills: st.kills, skipUsed: st.skipUsed });
        assert.ok(v.ok, 'killer bot move is legal: ' + JSON.stringify({ turn, error: v.error, day: st.day }));
        st.pos = turn.path[turn.path.length - 1];
        if (v.kill != null) st.cereals.push(v.kill);
        st.kills = v.kills; st.skipUsed = v.skipUsed; st.witness = v.witness;
        B.observeKillerTurn(map, k, { blocked, kill: v.kill, witness: v.witness });
        assert.ok(k.cands.includes(st.pos), 'INVARIANT: the true killer cell stays in the candidate set after the move (day ' + st.day + ')');
        if (!R.calendarOk(st.day, st.kills)) return { winner: 'good', reason: 'calendar', day: st.day, asked };
        // --- detective ---
        if (st.detectivePos == null) { st.detectivePos = B.detectiveStart(map, k, ld, rng); assert.equal(R.type(map, st.detectivePos), 'C', 'starts at a café'); }
        const plan = B.detectivePlan(map, { pos: st.detectivePos, witness: st.witness, usedQuestions: st.usedQuestions }, k, ld, rng);
        assert.ok(R.validateDetectivePath(map, plan.path).ok && plan.path[0] === st.detectivePos, 'detective bot walk is legal');
        if (plan.q) {
            const end = plan.path[plan.path.length - 1];
            assert.ok(R.canQuestion(map, end, st.witness) && !st.usedQuestions.includes(plan.q), 'asks only next to the witness with an unused card');
            const ans = B.expectedAnswer(map, plan.q, st.pos, st.witness);   // exactly what cereal.js answers
            st.usedQuestions.push(plan.q); asked++;
            B.observeAnswer(map, k, plan.q, ans, st.witness);
            assert.ok(k.cands.includes(st.pos), 'INVARIANT: the true killer cell survives the answer filter');
        }
        const fin = B.detectiveFinish(map, { day: st.day, arrestsLeft: st.arrestsLeft, lastKill: st.cereals[st.cereals.length - 1] }, k, ld, rng, plan.path);
        assert.ok(R.validateDetectivePath(map, fin.path).ok && fin.path.slice(0, plan.path.length).join() === plan.path.join(), 'the finish extends the same walk legally');
        st.detectivePos = fin.path[fin.path.length - 1];
        if (fin.arrest != null) {
            assert.ok(R.arrestValid(map, st.detectivePos, fin.arrest), 'arrest within reach');
            if (fin.arrest === st.pos) return { winner: 'good', reason: 'arrest', day: st.day, asked };
            st.arrestsLeft -= 1; B.observeArrestMiss(k, fin.arrest);
            assert.ok(k.cands.includes(st.pos), 'INVARIANT: a missed arrest never removes the true cell');
            if (st.arrestsLeft <= 0) return { winner: 'killer', reason: 'arrests', day: st.day, asked };
        }
        st.witness = null;
    }
    assert.equal(st.kills, R.MAX_KILLS, 'a killer who reaches the end of day 7 has 6 victims (the calendar guarantees it)');
    return { winner: 'killer', reason: 'survived', day: 7, asked };
}

// ---- unit checks on the knowledge model (side A) ----
const A = R.buildMap(MAPS, 'A', null);
let k = B.newKnowledge(A);
assert.deepEqual(k.cands, [1, 3, 5, 8, 11, 15, 18, 19], 'before day 1: any house');
B.observeKillerTurn(A, k, { blocked: [], kill: 3, witness: 4 });
assert.ok(k.cands.includes(1) && k.cands.includes(8) && !k.cands.includes(4), 'after 8›3›2›1 with 🥣 3 / 👁️ 4: cells 1 and 8 possible, the witness park is not');
assert.ok(k.cands.every(c => R.legalPaths(A, c, 3, { exact: true }).length), 'candidates are real cells');
const before = k.cands.length;
B.observeAnswer(A, k, 'building', 'yes', 4);
assert.ok(k.cands.length < before && k.cands.every(c => ['H', 'C', 'S'].includes(R.type(A, c))), '"in a building → yes" keeps only buildings');
B.observeArrestMiss(k, 8);
assert.ok(!k.cands.includes(8));
assert.equal(B.expectedAnswer(A, 'dir', 1, 13), 'N', 'two true directions → the one the app would give');
assert.ok(['dir', 'row'].includes(B.pickQuestion(A, { cands: [1, 8] }, ['building'], 4, 2, Math.random)), 'a card that splits {1, 8} (compass W/S or row yes/no) is picked over col / parity, which cannot');
assert.equal(B.pickQuestion(A, { cands: [8, 18] }, [], 4, 3, Math.random), null, '{8, 18} answer every card alike from witness 4 (S · no · no · yes · even) → 🥄🥄🥄 keeps its cards');
assert.ok(B.pickQuestion(A, { cands: [8, 18] }, [], 4, 2, Math.random), '🥄🥄 asks anyway');
assert.equal(B.pickQuestion(A, { cands: [1] }, [], 4, 3, Math.random), null, '🥄🥄🥄 does not burn a card on a settled case');
assert.ok(B.pickQuestion(A, { cands: [1] }, [], 4, 2, Math.random), '🥄🥄 still asks something');
const reach9 = B.detectiveReach(A, 9);
const to1 = reach9.find(r => r.end === 1);
assert.ok(reach9.some(r => r.end === 9) && reach9.some(r => r.end === 16), 'reach from 9: may stay, may ride 10→16');
assert.ok(to1 && to1.path.length === 5 && to1.path.includes(7), 'reach from 9 includes 1 only through café 7 (9›8›7›2›1, four steps with the bonus)');
assert.ok(reach9.every(r => R.validateDetectivePath(A, r.path).ok), 'every reach path is legal');
const reach7 = B.detectiveReach(A, 7).map(r => r.end);
assert.ok(reach7.includes(10) && !reach7.includes(20), 'from café 7 (no bonus for starting on it): 10 is 3 steps, 20 would be 5');

// ---- the tournament ----
const PAIRS = [[2, 1], [2, 2], [2, 3], [1, 2], [3, 2]], N = 40, results = {};
const t0 = Date.now(); let games = 0, totalAsked = 0;
for (const [lk, ld] of PAIRS) {
    const key = 'K' + lk + ' vs D' + ld; results[key] = { good: 0, killer: 0, reasons: {}, days: 0 };
    for (let i = 0; i < N; i++) {
        const side = i % 2 ? 'B' : 'A', map = R.buildMap(MAPS, side, null);
        const r = play(map, lk, ld, mulberry32(1000 * lk + 100 * ld + i));
        results[key][r.winner]++; results[key].reasons[r.reason] = (results[key].reasons[r.reason] || 0) + 1; results[key].days += r.day; totalAsked += r.asked; games++;
    }
}
const ms = (Date.now() - t0) / games;
for (const key of Object.keys(results)) { const r = results[key]; console.log(key.padEnd(10), '🕵️', String(r.good).padStart(2), '🔪', String(r.killer).padStart(2), ' avg day', (r.days / N).toFixed(1), ' ', JSON.stringify(r.reasons)); }
console.log('avg', ms.toFixed(2), 'ms / game ·', (totalAsked / games).toFixed(1), 'questions / game');
assert.equal(games, 200);
assert.ok(ms < 50, 'a game runs in < 50 ms (' + ms.toFixed(1) + ')');
const good = key => results[key].good / N;
assert.ok(good('K2 vs D3') > good('K2 vs D1'), '🥄🥄🥄 detective beats the 🥄 detective against the same killer');
assert.ok(good('K2 vs D2') >= good('K2 vs D1'), '🥄🥄 detective is at least as good as 🥄');
assert.ok(good('K1 vs D2') >= good('K3 vs D2'), 'a 🥄🥄🥄 killer is at least as hard to catch as a 🥄 killer');
for (const key of Object.keys(results)) assert.ok(results[key].good > 0 && results[key].killer > 0, key + ': nobody wins everything');
assert.ok(Object.values(results).some(r => r.reasons.arrest), 'arrests do happen');
assert.ok(Object.values(results).some(r => r.reasons.survived), 'killers do survive');
console.log('cereal-bot-check: OK — 200 games, every bot action legal, the true cell never left the candidate set, level order holds');
